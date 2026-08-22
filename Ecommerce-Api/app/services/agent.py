import json
import logging
import os

from groq import Groq, BadRequestError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.agent import ChatRequest
from app.schemas.tool import TOOL_SCHEMAS
from app.services.products import ProductService
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


class _FakeMessage:
    """Stand-in for a Groq ChatCompletionMessage, used both to carry a
    recovered failed_generation and for the decline reply we generate
    ourselves. Only ever has tool_calls=None."""

    def __init__(self, content: str):
        self.content = content
        self.tool_calls = None


class AgentService:

    @staticmethod
    def agent_chat(token:str, db: Session, chat: ChatRequest):
        logger.info("Agent chat request received: message_length=%s", len(chat.message or ""))

        user_id = get_current_user(token)

        history = ChatHistoryService.load_history(db, chat.session_id, user_id)
        history.append({"role": "user", "content": chat.message})
        starting_len = len(history)

        # messages = [{"role": "user", "content": chat.message}]

        def tool_executor(name: str, tool_input: dict):
            return AgentService.execute_tool(db, name, tool_input)

        try:
            
            final_msg = AgentService.run_agent_turn(history, TOOL_SCHEMAS, tool_executor)
            logger.info("Agent chat request completed successfully")

            new_messages = history[starting_len:]
            new_messages.append({"role": "assistant", "content": final_msg.content})

            ChatHistoryService.save_messages(db, chat.session_id, user_id, new_messages)
            return {"reply": final_msg.content}
        except Exception:
            logger.exception("Agent chat request failed")
            raise

    @staticmethod
    def _clean_tool_name(raw_name: str) -> str:
        """
        Strips Harmony-format channel markers (e.g. 'check_inventory<|channel|>commentary')
        that some models — notably openai/gpt-oss-* served via Groq — can leak into the
        function name instead of keeping them out of the parsed tool call. Without this,
        the leaked name never matches a known tool and silently falls into the
        'unknown tool' branch even though the model called a real one.
        """
        if raw_name and "<|" in raw_name:
            cleaned = raw_name.split("<|", 1)[0]
            logger.warning("Tool name contained a leaked special token, sanitized '%s' -> '%s'", raw_name, cleaned)
            return cleaned
        return raw_name

    @staticmethod
    def _safe_completion(messages: list[dict], tools: list[dict], tool_choice: str):
        """Wraps client.chat.completions.create. Recovers Groq's
        output_parse_failed / tool_use_failed 400s instead of raising, so a
        model that answers in prose instead of calling a tool doesn't crash
        the request — it comes back as a message with tool_calls=None and
        gets routed through the normal 'did this call a tool?' check."""
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
                logger.warning(
                    "Recovered from Groq error '%s' — model answered without a valid tool call",
                    err.get("code"),
                )
                return _FakeMessage(err.get("failed_generation", "") or "")
            raise

    @staticmethod
    def run_agent_turn(messages: list[dict], tools: list[dict], tool_executor):
        logger.info("Starting agent turn with %s messages and %s available tools", len(messages), len(tools))

        msg = AgentService._safe_completion(messages, tools, tool_choice="required")
        logger.info("Initial model response received; tool_calls=%s", bool(msg.tool_calls))

        # tool_choice="required" still doesn't guarantee a tool call — the
        # model can refuse and answer in text anyway (that's the traceback
        # you hit). Push it back toward the catalog rather than ever
        # forwarding that text as the reply.
        retries = 0
        while not msg.tool_calls and retries < MAX_TOOL_CALL_RETRIES:
            retries += 1
            logger.warning(
                "Model answered without calling a tool (attempt %s/%s) — retrying with tool_choice=required",
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
                "Model never called a tool after %s retries — declining instead of forwarding an ungrounded reply",
                MAX_TOOL_CALL_RETRIES,
            )
            return _FakeMessage(
                "I can only recommend products we actually carry, and couldn't map that "
                "request to our catalog. Could you tell me a specific product type, budget, "
                "or spec you're after?"
            )

        iterations = 0
        while msg.tool_calls and iterations < settings.MAX_TOOL_ITERATIONS:
            iterations += 1
            logger.info("Processing tool-call iteration %s", iterations)
            messages.append(msg.model_dump(exclude_none=True))

            for tool_call in msg.tool_calls:
                name = AgentService._clean_tool_name(tool_call.function.name)
                logger.info("Executing agent tool '%s'", name)
                try:
                    args = json.loads(tool_call.function.arguments)
                    logger.debug("Tool '%s' arguments: %s", name, args)
                    result = tool_executor(name, args)
                    logger.info("Tool '%s' executed successfully", name)
                except Exception as e:
                    logger.exception("Tool '%s' failed during execution", name)
                    result = {"error": str(e)}

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result),
                })

            msg = AgentService._safe_completion(messages, tools, tool_choice="auto")
            logger.info("Follow-up model response received; tool_calls=%s", bool(msg.tool_calls))

        if msg.tool_calls:
            # Loop exited because we hit the iteration cap, not because the
            # model finished. `msg` here is still a tool-call message, whose
            # `.content` is almost always None (Groq/OpenAI messages carry
            # either tool_calls or content, rarely both) — returning it as-is
            # sends `reply: None` through a response model that requires a
            # string. Decline instead of forwarding a null/empty reply.
            logger.warning(
                "Agent turn stopped after %s iterations because the max tool iteration limit was reached",
                settings.MAX_TOOL_ITERATIONS,
            )
            return _FakeMessage(
                "I gathered some information but couldn't finish putting together a "
                "recommendation in time. Could you try again, or narrow your request?"
            )

        # Defensive: a normal final message should always carry text, but
        # guard against None/empty content reaching the response model.
        if not msg.content:
            logger.warning("Model returned an empty final message with no tool calls pending")
            return _FakeMessage(
                "I wasn't able to put together a recommendation for that — could you rephrase "
                "or give more detail?"
            )

        return msg

    @staticmethod
    def execute_tool(db: Session, name: str, tool_input: dict):
        logger.info("Dispatching tool '%s' with input=%s", name, tool_input)

        if name == "search_products":
            return ProductService.search_products(db, **tool_input)
        if name == "get_product":
            return ProductService.get_product_tool(db, **tool_input)
        if name == "check_inventory":
            return ProductService.check_inventory(db, **tool_input)

        logger.warning("Unknown tool requested: %s", name)
        return {"error": f"unknown tool {name}"}