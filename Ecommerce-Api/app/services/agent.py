import json
import logging
import os
import uuid

from groq import Groq, BadRequestError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.agent import ChatRequest
from app.schemas.tool import TOOL_SCHEMAS
from app.services.products import ProductService
from app.services.carts import CartService
from app.services.ChatHistory import ChatHistoryService
from app.core.security import get_current_user

logger = logging.getLogger(__name__)

client = Groq(api_key=settings.GROQ_API_KEY)

# Groq error codes where the model's raw text is recoverable from
# `failed_generation` instead of letting the whole request raise.
#   - output_parse_failed: model wrote something the tool-call grammar
#     couldn't parse (usually free-form prose while tools are attached).
#   - tool_use_failed: tool_choice was "required" but the model answered in
#     plain text instead of calling a tool at all.
_RECOVERABLE_TOOL_CODES = {"output_parse_failed", "tool_use_failed"}

# How many times we push the model back toward calling a tool before giving
# up and declining — we never forward an answer that skipped tool calls.
MAX_TOOL_CALL_RETRIES = 2

# No system prompt existed before — the model had zero instruction to
# justify its picks, ground them in tool data, or stay inside our catalog.
# The separate _generate_recommendations call enforces a `reason` for the
# structured cards, but that's a side channel; the actual conversational
# reply the user reads was never told to explain itself. This fixes that
# at the source instead of only patching the output after the fact.
SYSTEM_PROMPT = """You are a shopping assistant for an ecommerce store.

HARD RULES:
1. You may only recommend products that exist in our catalog. Never invent
   a product, brand, price, or spec that didn't come from a search_products,
   get_product, or check_inventory tool call in THIS conversation.
2. Before answering a product question, call search_products to find
   candidates, and get_product/check_inventory to confirm current
   price/stock for anything you're about to recommend.
3. Even for a broad or generic request (e.g. "build me a gaming setup"),
   call search_products using your best interpretation of relevant
   categories/keywords from OUR store — do not write a general buying guide
   listing brands or parts we don't sell.
4. If nothing in the catalog matches, say so plainly and suggest the user
   narrow their request — do not fill the gap with invented products.
5. EVERY product you recommend must be justified IN THE VISIBLE REPLY
   ITSELF, not just implied — state the concrete price, spec, or stock
   value (from an actual tool result) that makes it a fit for what the
   user asked. "Great choice" or "a solid option" with nothing concrete
   behind it is not acceptable; say what makes it fit, e.g. "the 16GB RAM
   handles multitasking well, and at ₹54,999 it's under your budget."
6. Once you have the data you need, answer in plain natural language — that
   reply is what the user sees. No need to call more tools at that point.
7. NEVER calculate, add up, or state a cart subtotal or total yourself — not
   even a rough estimate. To quote any total, you MUST call calculate_cart
   with the proposed {product_id, quantity} items and use exactly the
   total_amount it returns. You are not a source of truth for arithmetic;
   the tool is. If calculate_cart reports errors (invalid product, out of
   stock, bad quantity), relay those plainly rather than working around them.
8. Once the user has settled on (or you've just confirmed) a product, you MAY
   call get_related_products ONCE to suggest a genuinely relevant add-on or
   alternative — same category, in stock, and within any remaining budget you
   know about (pass max_price = their stated budget minus the price of what
   they just picked, if you know it). Don't call this speculatively on every
   turn, and never suggest something over budget or unrelated just to upsell.
   If nothing relevant or in-budget comes back, don't force a suggestion.
"""


class _FakeFunction:
    def __init__(self, name: str, arguments: str):
        self.name = name
        self.arguments = arguments  # JSON string, matching the real SDK shape


class _FakeToolCall:
    """Stand-in for a Groq tool_call, synthesized when a malformed generation
    is itself recoverable as '{"name": ..., "arguments": {...}}' — see
    _try_parse_leaked_tool_call. Shaped so it flows through the exact same
    dispatch code as a real tool_call."""
    def __init__(self, call_id: str, name: str, arguments: str):
        self.id = call_id
        self.function = _FakeFunction(name, arguments)


class _FakeMessage:
    """Stand-in for a Groq ChatCompletionMessage, used to carry a recovered
    failed_generation. tool_calls is None unless we managed to reconstruct a
    real tool call out of the salvaged text (see _safe_completion)."""

    def __init__(self, content):
        self.content = content
        self.tool_calls = None


class _FinalAnswer:
    """What run_agent_turn returns — content plus grounded recommendations
    and the authoritative cart total (if calculate_cart was called this
    turn), replacing the earlier pattern of reusing a message-like object."""
    def __init__(self, content: str, recommendations: list[dict], cart: dict | None = None):
        self.content = content
        self.recommendations = recommendations
        self.cart = cart


class AgentService:

    @staticmethod
    def agent_chat(token: str, db: Session, chat: ChatRequest):
        logger.info("Agent chat request received: message_length=%s", len(chat.message or ""))

        user_id = get_current_user(token)

        history = ChatHistoryService.load_history(db, chat.session_id, user_id)
        user_message = {"role": "user", "content": chat.message}

        # A fresh system prompt every turn, on its own list — not persisted
        # into stored history, since it's static instructions, not
        # conversation content. `api_messages` (not `history`) is what the
        # agent loop mutates with tool calls/results as it runs.
        api_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history + [user_message]
        turn_start = len(api_messages)  # everything from here on is new activity this turn

        def tool_executor(name: str, tool_input: dict):
            return AgentService.execute_tool(db, name, tool_input)

        try:
            final_msg = AgentService.run_agent_turn(api_messages, TOOL_SCHEMAS, tool_executor)
            logger.info("Agent chat request completed successfully")

            # Built explicitly rather than sliced by index — the user's own
            # message goes in first no matter what the loop did to
            # api_messages, then whatever tool calls/results the loop
            # appended, then the final reply. (A previous version computed
            # this via api_messages[1 + starting_len:], which — because
            # starting_len was captured AFTER appending the user message —
            # actually started one entry too late and silently dropped the
            # user's turn from every saved conversation.)
            new_messages = [user_message] + api_messages[turn_start:] + [
                {"role": "assistant", "content": final_msg.content}
            ]

            ChatHistoryService.save_messages(db, chat.session_id, user_id, new_messages)
            return {
                "reply": final_msg.content,
                "recommendations": final_msg.recommendations,
                "cart": final_msg.cart,
            }
        except Exception:
            logger.exception("Agent chat request failed")
            raise

    # ------------------------------------------------------------------
    # Streaming variant — yields NDJSON-ready dicts as the agent works.
    #
    # IMPORTANT: this takes an already-resolved `user_id`, not a raw token.
    # Auth must happen in the route, BEFORE StreamingResponse is constructed
    # — Starlette sends the HTTP response headers as soon as StreamingResponse
    # is returned, before this generator body ever runs. If auth happened in
    # here instead and the token was invalid, the exception would fire after
    # headers were already on the wire, and Starlette can't turn that into a
    # clean 401 anymore — it surfaces as "response already started" instead.
    # See the route for where get_current_user(token) now happens.
    #
    # Everything below IS wrapped in try/except, so any *other* failure still
    # becomes a well-formed {"type": "error"} NDJSON line instead of an
    # unhandled exception mid-stream.
    # ------------------------------------------------------------------
    @staticmethod
    def agent_chat_stream(user_id, db: Session, chat: ChatRequest):
        logger.info("Agent chat (stream) request received: message_length=%s", len(chat.message or ""))

        try:
            history = ChatHistoryService.load_history(db, chat.session_id, user_id)
            user_message = {"role": "user", "content": chat.message}

            # Same reasoning as agent_chat: fresh system prompt per turn, on
            # its own list, never persisted into stored history.
            api_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history + [user_message]
            turn_start = len(api_messages)

            def tool_executor(name: str, tool_input: dict):
                return AgentService.execute_tool(db, name, tool_input)

            final_content = None
            for event in AgentService.run_agent_turn_stream(api_messages, TOOL_SCHEMAS, tool_executor):
                if event["type"] == "final":
                    final_content = event["reply"]
                yield json.dumps(event) + "\n"

            new_messages = [user_message] + api_messages[turn_start:] + [
                {"role": "assistant", "content": final_content or ""}
            ]
            ChatHistoryService.save_messages(db, chat.session_id, user_id, new_messages)
        except Exception as e:
            logger.exception("Agent chat (stream) request failed")
            yield json.dumps({"type": "error", "error": str(e)}) + "\n"

    @staticmethod
    def _clean_tool_name(raw_name: str) -> str:
        """
        Strips Harmony-format channel markers (e.g. 'check_inventory<|channel|>commentary')
        that some models — notably openai/gpt-oss-* served via Groq — can leak into the
        function name instead of keeping them out of the parsed tool call.
        """
        if raw_name and "<|" in raw_name:
            cleaned = raw_name.split("<|", 1)[0]
            logger.warning("Tool name contained a leaked special token, sanitized '%s' -> '%s'", raw_name, cleaned)
            return cleaned
        return raw_name

    @staticmethod
    def _try_parse_leaked_tool_call(text: str):
        """
        Some malformed generations come back not as prose, but as the tool
        call itself, flattened into plain text instead of the API's proper
        tool_calls field — e.g. '{"name": "search_products<|channel|>commentary",
        "arguments": {"query": "chair"}}'. If the salvaged text parses into
        that shape, reconstruct it into a real (fake) tool call so the
        request still runs, instead of ever showing this JSON to the user or
        silently dropping the query it represents.

        Returns (name, args_dict) on success, or None if this doesn't look
        like a disguised tool call (i.e. it really was free-form prose).
        """
        try:
            obj = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return None
        if not isinstance(obj, dict) or "name" not in obj or "arguments" not in obj:
            return None
        args = obj["arguments"]
        if not isinstance(args, dict):
            return None
        name = AgentService._clean_tool_name(str(obj["name"]))
        return name, args

    @staticmethod
    def _safe_completion(messages: list[dict], tools: list[dict], tool_choice: str):
        """Wraps client.chat.completions.create. Recovers Groq's
        output_parse_failed / tool_use_failed 400s instead of raising.

        Two recovery paths:
        1. If the salvaged failed_generation parses as {"name", "arguments"},
           it's the model's actual tool call attempt, just mangled by Groq's
           parser — reconstruct it into a real tool call so it still runs.
        2. Otherwise it's genuine free-form text — return it as plain content
           (tool_calls=None) so the caller's normal "did this call a tool?"
           checks apply.
        """
        try:
            response = client.chat.completions.create(
                model=settings.MODEL,
                messages=messages,
                tools=tools,
                tool_choice=tool_choice,
            )
            return response.choices[0].message
        except BadRequestError as e:
            body = getattr(e, "body", None) or {}
            err = body.get("error", {}) if isinstance(body, dict) else {}
            if err.get("code") in _RECOVERABLE_TOOL_CODES:
                salvaged = err.get("failed_generation", "") or ""
                parsed = AgentService._try_parse_leaked_tool_call(salvaged.strip())

                msg = _FakeMessage(None)
                if parsed:
                    name, args = parsed
                    call_id = f"recovered-{uuid.uuid4().hex[:8]}"
                    logger.warning(
                        "Recovered a leaked tool call from a parse failure: %s(%s)", name, args
                    )
                    msg.tool_calls = [_FakeToolCall(call_id, name, json.dumps(args))]
                else:
                    logger.warning(
                        "Recovered from Groq error '%s' — model answered without a valid tool call",
                        err.get("code"),
                    )
                    msg.content = salvaged
                return msg
            raise

    @staticmethod
    def run_agent_turn(messages: list[dict], tools: list[dict], tool_executor):
        """Blocking version — drains the shared loop silently, returns only the final answer."""
        final_event = None
        for event in AgentService._agent_loop(messages, tools, tool_executor):
            if event["type"] == "final":
                final_event = event
        if final_event is None:
            return _FinalAnswer("Something went wrong producing a response.", [], None)
        return _FinalAnswer(
            final_event["reply"],
            final_event.get("recommendations", []),
            final_event.get("cart"),
        )

    @staticmethod
    def run_agent_turn_stream(messages: list[dict], tools: list[dict], tool_executor):
        """Streaming version — yields tool_call/tool_result events live, then a final event."""
        for event in AgentService._agent_loop(messages, tools, tool_executor):
            if event["type"] == "final":
                yield {
                    "type": "final",
                    "reply": event["reply"],
                    "recommendations": event.get("recommendations", []),
                    "cart": event.get("cart"),
                }
            else:
                yield event

    @staticmethod
    def _generate_recommendations(messages: list[dict]) -> list[dict]:
        """
        One extra, tool-free call that looks at the tool results already in
        `messages` and extracts a structured list of recommended products,
        each with a `reason` grounded in that data — e.g. a price, spec, or
        stock value actually returned by search_products/get_product/
        check_inventory this turn. Never invents a product not present in
        those results.

        Best-effort: this must never break the main reply. If the model
        doesn't produce valid JSON after one retry, this returns [] and the
        conversational `reply` is unaffected.
        """
        instruction = {
            "role": "user",
            "content": (
                "Based ONLY on the product data already returned by tool calls above, "
                "list the products you just recommended as a JSON array and nothing "
                "else — no markdown fences, no prose before or after. Each item:\n"
                '{"product_id": <id>, "name": "<title>", "price": <number>, '
                '"reason": "<why this fits, citing a concrete price, spec, or stock '
                'value from the tool results above>"}\n'
                "If you didn't recommend anything, return an empty array: []"
            ),
        }
        attempt_messages = messages + [instruction]
        raw = ""

        for attempt in range(2):
            try:
                response = client.chat.completions.create(
                    model=settings.MODEL,
                    messages=attempt_messages,
                    temperature=0,
                )
                raw = response.choices[0].message.content or "[]"
                data = json.loads(raw)
                if not isinstance(data, list):
                    raise ValueError("expected a JSON array")

                cleaned = []
                for item in data:
                    if not isinstance(item, dict) or not item.get("reason"):
                        continue
                    cleaned.append({
                        "product_id": item.get("product_id"),
                        "name": item.get("name"),
                        "price": item.get("price"),
                        "reason": item.get("reason"),
                    })
                return cleaned
            except Exception as e:
                logger.warning("Recommendation extraction attempt %s failed: %s", attempt + 1, e)
                attempt_messages = attempt_messages + [
                    {"role": "assistant", "content": raw},
                    {"role": "user", "content": "That wasn't a valid JSON array. Reply with ONLY the corrected JSON array."},
                ]

        logger.warning("Giving up on structured recommendations after retries — returning empty list")
        return []

    @staticmethod
    def _dispatch_tool_call(tool_call, tool_executor, messages):
        """Runs one tool call (real or recovered), yields tool_call/tool_result
        events, appends the result to `messages`, and returns (name, result)
        via the generator's return value (captured with `yield from` by the
        caller) — used by _agent_loop to pull out the authoritative
        calculate_cart result without re-parsing anything from `messages`."""
        name = AgentService._clean_tool_name(tool_call.function.name)
        logger.info("Executing agent tool '%s'", name)

        try:
            args = json.loads(tool_call.function.arguments)
        except Exception as e:
            logger.exception("Failed to parse arguments for tool '%s'", name)
            yield {"type": "tool_call", "tool_call_id": tool_call.id, "name": name, "args": {}}
            result = {"error": f"could not parse arguments: {e}"}
            yield {"type": "tool_result", "tool_call_id": tool_call.id, "name": name, "result": result}
            messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": json.dumps(result)})
            return name, result

        yield {"type": "tool_call", "tool_call_id": tool_call.id, "name": name, "args": args}

        try:
            logger.debug("Tool '%s' arguments: %s", name, args)
            result = tool_executor(name, args)
            logger.info("Tool '%s' executed successfully", name)
        except Exception as e:
            logger.exception("Tool '%s' failed during execution", name)
            result = {"error": str(e)}

        yield {"type": "tool_result", "tool_call_id": tool_call.id, "name": name, "result": result}
        messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": json.dumps(result)})
        return name, result

    @staticmethod
    def _agent_loop(messages: list[dict], tools: list[dict], tool_executor):
        """
        Shared core used by both the blocking and streaming entry points.

        Yields plain dicts:
          {"type": "tool_call", "tool_call_id", "name", "args"}
          {"type": "tool_result", "tool_call_id", "name", "result"}
          {"type": "final", "reply": <str>, "msg": <real message or None>, "is_fake": <bool>}
        """
        logger.info("Starting agent turn with %s messages and %s available tools", len(messages), len(tools))

        msg = AgentService._safe_completion(messages, tools, tool_choice="required")
        logger.info("Initial model response received; tool_calls=%s", bool(msg.tool_calls))

        # With tool_choice="required", the only way msg.tool_calls is falsy is
        # if _safe_completion recovered a genuine parse/tool-use failure that
        # wasn't itself a reconstructable tool call (see _try_parse_leaked_tool_call).
        # Push the model back toward the catalog rather than ever forwarding
        # that recovered text as the reply.
        retries = 0
        while not msg.tool_calls and retries < MAX_TOOL_CALL_RETRIES:
            retries += 1
            logger.warning(
                "Model answered without a usable tool call (attempt %s/%s) — retrying with tool_choice=required",
                retries, MAX_TOOL_CALL_RETRIES,
            )
            messages.append({"role": "assistant", "content": msg.content or ""})
            messages.append({
                "role": "user",
                "content": (
                    "You answered without calling a tool. This assistant may only recommend "
                    "products that exist in our catalog — call search_products now with "
                    "keywords from the request. If genuinely nothing fits, say so briefly; "
                    "do not write a general buying guide."
                ),
            })
            msg = AgentService._safe_completion(messages, tools, tool_choice="required")

        if not msg.tool_calls:
            logger.warning(
                "Model never produced a usable tool call after %s retries — declining instead of forwarding an ungrounded reply",
                MAX_TOOL_CALL_RETRIES,
            )
            yield {
                "type": "final",
                "reply": (
                    "I can only recommend products we actually carry, and couldn't map that "
                    "request to our catalog. Could you tell me a specific product type, budget, "
                    "or spec you're after?"
                ),
                "msg": None,
                "is_fake": True,
                "recommendations": [],  # no tool was ever called — nothing grounded to extract
                "cart": None,
            }
            return

        iterations = 0
        last_cart_result = None
        while msg.tool_calls and iterations < settings.MAX_TOOL_ITERATIONS:
            iterations += 1
            logger.info("Processing tool-call iteration %s", iterations)

            # A synthesized/recovered message has no real .model_dump(); only
            # append the assistant turn as-is when it's a genuine SDK message.
            if hasattr(msg, "model_dump"):
                messages.append(msg.model_dump(exclude_none=True))
            else:
                messages.append({"role": "assistant", "content": msg.content or ""})

            for tool_call in msg.tool_calls:
                dispatch_result = yield from AgentService._dispatch_tool_call(tool_call, tool_executor, messages)
                if dispatch_result:
                    tool_name, tool_result = dispatch_result
                    # This is the trust boundary: the authoritative cart total
                    # is captured directly from the tool's own return value —
                    # never parsed out of the model's later prose. Whatever
                    # the model says in its reply, THIS is what gets shown as
                    # the real total.
                    if tool_name == "calculate_cart" and isinstance(tool_result, dict) and not tool_result.get("error"):
                        last_cart_result = tool_result

            msg = AgentService._safe_completion(messages, tools, tool_choice="auto")
            logger.info("Follow-up model response received; tool_calls=%s", bool(msg.tool_calls))

            # A follow-up call can also come back as a recovered failure. If it
            # reconstructed into a real tool call, the outer while loop just
            # keeps going normally. If it's genuine unparseable/free text,
            # give it one chance to either finish the tool call properly or
            # answer in clean language, then force a plain answer (no tools
            # attached at all) using whatever's already been found, rather
            # than ever surfacing the raw recovered text as the final reply.
            if isinstance(msg, _FakeMessage) and not msg.tool_calls:
                logger.warning("Follow-up response was unparseable — retrying once before forcing a plain finalize")
                messages.append({"role": "assistant", "content": msg.content or ""})
                messages.append({
                    "role": "user",
                    "content": (
                        "That couldn't be processed as a tool call. If you still need data, "
                        "call the tool again correctly. Otherwise, answer now in plain "
                        "natural language using what you've already found — no raw JSON."
                    ),
                })
                msg = AgentService._safe_completion(messages, tools, tool_choice="auto")

                if isinstance(msg, _FakeMessage) and not msg.tool_calls:
                    logger.warning("Still unparseable after retry — forcing a plain-language finalize with existing data")
                    messages.append({"role": "assistant", "content": msg.content or ""})
                    messages.append({
                        "role": "user",
                        "content": (
                            "Answer now in plain natural language only, using the product data "
                            "already gathered. Do not attempt another tool call."
                        ),
                    })
                    response = client.chat.completions.create(
                        model=settings.MODEL, messages=messages, temperature=0.2
                    )
                    reply = response.choices[0].message.content or (
                        "I found some matching items but had trouble finishing the "
                        "recommendation — could you ask again?"
                    )
                    recommendations = AgentService._generate_recommendations(messages)
                    yield {
                        "type": "final", "reply": reply, "recommendations": recommendations,
                        "cart": last_cart_result, "msg": None, "is_fake": True,
                    }
                    return

        if msg.tool_calls:
            # Loop exited because we hit the iteration cap, not because the
            # model finished. `msg` here is still a tool-call message, whose
            # `.content` is almost always None — never forward that.
            logger.warning(
                "Agent turn stopped after %s iterations because the max tool iteration limit was reached",
                settings.MAX_TOOL_ITERATIONS,
            )
            yield {
                "type": "final",
                "reply": (
                    "I gathered some information but couldn't finish putting together a "
                    "recommendation in time. Could you try again, or narrow your request?"
                ),
                "msg": None,
                "is_fake": True,
                "recommendations": AgentService._generate_recommendations(messages),
                "cart": last_cart_result,
            }
            return

        if not msg.content:
            logger.warning("Model returned an empty final message with no tool calls pending")
            yield {
                "type": "final",
                "reply": (
                    "I wasn't able to put together a recommendation for that — could you "
                    "rephrase or give more detail?"
                ),
                "msg": None,
                "is_fake": True,
                "recommendations": [],
                "cart": last_cart_result,
            }
            return

        recommendations = AgentService._generate_recommendations(messages)
        yield {
            "type": "final", "reply": msg.content, "recommendations": recommendations,
            "cart": last_cart_result, "msg": msg, "is_fake": False,
        }

    @staticmethod
    def execute_tool(db: Session, name: str, tool_input: dict):
        logger.info("Dispatching tool '%s' with input=%s", name, tool_input)

        if name == "search_products":
            return ProductService.search_products(db, **tool_input)
        if name == "get_product":
            return ProductService.get_product_tool(db, **tool_input)
        if name == "check_inventory":
            return ProductService.check_inventory(db, **tool_input)
        if name == "calculate_cart":
            # The only place a total is computed. tool_input's "items" here
            # is exactly what the model proposed (product_id/quantity pairs)
            # — CartService looks up real prices/stock itself; nothing about
            # price or total is trusted from tool_input.
            return CartService.calculate_cart(db, tool_input.get("items", []))
        if name == "get_related_products":
            return ProductService.get_related_products(db, **tool_input)

        logger.warning("Unknown tool requested: %s", name)
        return {"error": f"unknown tool {name}"}