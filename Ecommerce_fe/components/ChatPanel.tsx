"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatItem, CartSummary } from "@/lib/agentTypes";
import { describeToolCall, describeToolResult } from "@/lib/toolDisplay";
import { historyToChatItems } from "@/lib/chatHistory";

import { apiClient } from "@/lib/apiClient";

const SESSION_STORAGE_KEY = "chat_session_id";

function getOrCreateSessionId() {
	let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
	if (!sessionId) {
		sessionId = crypto.randomUUID();
		localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
	}
	return sessionId;
}

// ChatPanel takes:
//  - onCartApproved: lets the hosting page (which owns "real" cart state —
//    see Home's loadCart()) refresh the cart badge after an approve.
//  - isAuthenticated: drives the session lifecycle below. Pass this from
//    wherever your app already tracks auth (e.g. useAuth() in Home) so
//    ChatPanel knows when to load/clear history instead of guessing from
//    localStorage alone. Three states matter here, not two:
//      true      -> logged in: load/reload the session and its history.
//      false     -> definitely logged out: clear the session.
//      null      -> auth status not resolved yet (e.g. an initial token
//                   check still in flight on page load) — wait, don't guess.
//                   Pass null (not false!) from the parent during that
//                   window, or ChatPanel will wipe a perfectly good session
//                   because it looks indistinguishable from a real logout.
//      undefined -> prop omitted entirely: falls back to the old
//                   "just load once on mount" behavior, no logout-clearing.
export default function ChatPanel({
	onCartApproved,
	isAuthenticated,
}: {
	onCartApproved?: () => void;
	isAuthenticated?: boolean | null;
}) {
	const [items, setItems] = useState<ChatItem[]>([]);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [currentAction, setCurrentAction] = useState<string | null>(null);
	const [loadingHistory, setLoadingHistory] = useState(true);
	const scrollRef = useRef<HTMLDivElement>(null);

	// localStorage doesn't exist during SSR — only ever touched inside
	// useEffect/handlers, never at render time.
	const sessionIdRef = useRef<string | null>(null);

	// Tracks the previous isAuthenticated value so the effect below can tell
	// "just logged in" (false/undefined -> true) apart from "still logged
	// in" (true -> true, e.g. an unrelated re-render) — without this, every
	// re-render while logged in would re-fetch history from scratch.
	const prevAuthRef = useRef<boolean | undefined>(undefined);

	async function loadSessionAndHistory() {
		setLoadingHistory(true);
		const sessionId = getOrCreateSessionId();
		sessionIdRef.current = sessionId;

		try {
			const res = await apiClient.getChatHistory(sessionId);
			// Defensive: the agent routes return their payload directly rather
			// than ResponseHandler-wrapped, but fall back to `.data` in case
			// that ever changes.
			const rows = (res as any)?.messages ?? (res as any)?.data?.messages ?? [];
			setItems(rows.length > 0 ? historyToChatItems(rows) : []);
		} catch (err) {
			console.error("[Chat] Failed to load history:", err);
			// Fail silently in the UI — worst case the user starts with an
			// empty panel instead of their saved conversation.
			setItems([]);
		} finally {
			setLoadingHistory(false);
			queueMicrotask(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
		}
	}

	useEffect(() => {
		// Auth status genuinely not resolved yet (parent explicitly passed
		// null, e.g. while an initial token check is still in flight). Do
		// NOT treat this like a logout — that was the actual bug: on every
		// page reload, isAuthenticated briefly reads `false` while auth is
		// still loading, which used to get misread as "user logged out" and
		// wiped the session id a moment before the real `true` arrived,
		// producing a fresh empty session on every single reload. Waiting
		// here for a real true/false fixes that.
		if (isAuthenticated === null) {
			return;
		}

		// Logged out (explicitly false — a real, resolved logout, not the
		// "still checking" state above): drop this browser's session id and
		// any in-memory chat. This is the actual fix for the ORIGINAL session
		// problem — without it, a second person logging into the same
		// browser would load (and could keep adding to) the first person's
		// conversation, since the session id lived in plain localStorage
		// with no relationship to who's authenticated.
		if (isAuthenticated === false) {
			localStorage.removeItem(SESSION_STORAGE_KEY);
			sessionIdRef.current = null;
			setItems([]);
			setLoadingHistory(false);
			prevAuthRef.current = false;
			return;
		}

		// isAuthenticated is true, or undefined (prop omitted entirely —
		// caller doesn't track auth for this, fall back to "just try once").
		// Load on the transition INTO being authenticated. This is what
		// makes login-after-mount work: previously this only ran once in a
		// mount-only effect, so logging in after ChatPanel was already on
		// screen never triggered a (re)load.
		if (prevAuthRef.current !== true) {
			loadSessionAndHistory();
		}
		prevAuthRef.current = true;
	}, [isAuthenticated]);

	function pushItem(item: ChatItem) {
		setItems((prev) => [...prev, item]);
		queueMicrotask(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
	}

	function updateToolItem(tool_call_id: string, patch: Partial<ChatItem>) {
		setItems((prev) => {
			const idx = prev.findIndex((it) => it.kind === "tool" && it._id === tool_call_id);
			if (idx === -1) return prev;
			const copy = [...prev];
			copy[idx] = { ...copy[idx], ...patch } as ChatItem;
			return copy;
		});
	}

	function updateAssistantItem(id: string, patch: Partial<Extract<ChatItem, { kind: "assistant" }>>) {
		setItems((prev) => {
			const idx = prev.findIndex((it) => it.kind === "assistant" && it.id === id);
			if (idx === -1) return prev;
			const copy = [...prev];
			copy[idx] = { ...copy[idx], ...patch } as ChatItem;
			return copy;
		});
	}

	// The ONLY place a cart write happens. This calls your existing
	// apiClient.addToCart — the same REST path the manual "Add to Cart"
	// buttons on product cards already use — with just {product_id,
	// quantity} pairs taken from the backend-verified `cart.line_items`.
	// The agent's calculate_cart tool never writes anything; it only
	// produces the preview the user is approving here. create_cart on the
	// backend recomputes price/discount itself, so even this approved total
	// isn't blindly trusted twice over.
	async function approveCart(assistantId: string, cart: CartSummary) {
		updateAssistantItem(assistantId, { cartStatus: "approving" });
		try {
			const cartItems = cart.line_items.map((li) => ({
				product_id: String(li.product_id),
				quantity: li.quantity,
			}));
			const response = await apiClient.addToCart(cartItems);
			if (response?.error) {
				throw new Error(response.error);
			}
			updateAssistantItem(assistantId, { cartStatus: "approved" });
			onCartApproved?.();
		} catch (err: any) {
			updateAssistantItem(assistantId, { cartStatus: "error" });
			pushItem({ kind: "error", text: err.message ?? "Couldn't add that to your cart — please try again." });
		}
	}

	function rejectCart(assistantId: string) {
		updateAssistantItem(assistantId, { cartStatus: "rejected" });
	}

	async function sendMessage() {
		const text = input.trim();
		if (!text || busy) return;

		// Guards the edge case where someone sends before the auth effect has
		// resolved a session id yet. Falls back to creating one on the spot
		// rather than silently sending null.
		const sessionId = sessionIdRef.current ?? getOrCreateSessionId();
		sessionIdRef.current = sessionId;

		setInput("");
		pushItem({ kind: "user", text });
		setBusy(true);
		setCurrentAction("🤔 Thinking…");

		try {
			// streamAgentMessage is an async generator on apiClient. It yields
			// one parsed event per NDJSON line as the backend produces them.
			for await (const event of apiClient.streamAgentMessage(text, sessionId)) {
				if (event.type === "tool_call") {
					pushItem({ kind: "tool", _id: event.tool_call_id, tool_name: event.name, args: event.args, status: "calling" });
					setCurrentAction(describeToolCall(event.name, event.args));
				} else if (event.type === "tool_result") {
					updateToolItem(event.tool_call_id, { status: "done", result: event.result } as Partial<ChatItem>);
					setCurrentAction("🤔 Thinking…");
				} else if (event.type === "final") {
					pushItem({
						kind: "assistant",
						id: crypto.randomUUID(),
						text: event.reply,
						recommendations: event.recommendations,
						cart: event.cart,
						cartStatus: event.cart ? "pending" : undefined,
					});
					setCurrentAction(null);
				} else if (event.type === "error") {
					pushItem({ kind: "error", text: event.error });
					setCurrentAction(null);
				}
			}
		} catch (err: any) {
			pushItem({ kind: "error", text: err.message ?? "Something went wrong talking to the agent." });
		} finally {
			setBusy(false);
			setCurrentAction(null);
		}
	}

	return (
		<div className="flex flex-col h-[500px] bg-background">
			<div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
				{loadingHistory ? (
					<p className="text-sm text-muted-foreground animate-pulse">Loading conversation…</p>
				) : items.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Ask something like "a laptop under ₹60,000 with 16GB RAM in stock".
					</p>
				) : null}
				{items.map((item, i) => (
					<ChatBubble key={i} item={item} onApproveCart={approveCart} onRejectCart={rejectCart} />
				))}
				{busy && currentAction && (
					<p className="text-xs text-muted-foreground animate-pulse">{currentAction}</p>
				)}
			</div>

			<div className="border-t p-3 flex gap-2">
				<input
					className="flex-1 border rounded px-3 py-2 text-sm"
					placeholder="Ask about a product…"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && sendMessage()}
					disabled={busy}
				/>
				<button
					className="px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
					onClick={sendMessage}
					disabled={busy || !input.trim()}
				>
					Send
				</button>
			</div>
		</div>
	);
}

function ToolBubble({ item }: { item: Extract<ChatItem, { kind: "tool" }> }) {
	const [showDetails, setShowDetails] = useState(false);
	const args = item.args ?? {};
	const summary =
		item.status === "calling"
			? describeToolCall(item.tool_name, args)
			: describeToolResult(item.tool_name, args, item.result);

	return (
		<div className="max-w-[90%] w-fit bg-muted/50 border border-border/60 rounded-lg px-3 py-2 text-sm">
			<div className="flex items-center gap-2">
				<span className={item.status === "calling" ? "animate-pulse" : ""}>
					{item.status === "calling" ? "⏳" : "✅"}
				</span>
				<span className="text-muted-foreground">{summary}</span>
			</div>
			{item.status === "done" && (
				<button
					onClick={() => setShowDetails((v) => !v)}
					className="text-[11px] text-muted-foreground/70 hover:text-muted-foreground mt-1 underline underline-offset-2"
				>
					{showDetails ? "Hide details" : "Show details"}
				</button>
			)}
			{showDetails && (
				<pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] opacity-70 max-h-32 overflow-y-auto">
					{JSON.stringify({ args, result: item.result }, null, 2)}
				</pre>
			)}
		</div>
	);
}

function CartSummaryCard({
	cart,
	status,
	onApprove,
	onReject,
}: {
	cart: CartSummary;
	status?: Extract<ChatItem, { kind: "assistant" }>["cartStatus"];
	onApprove: () => void;
	onReject: () => void;
}) {
	// The line items and total here come straight from the calculate_cart
	// tool result the backend captured during the turn — never from
	// anything the model said in its text reply above. Approving hits the
	// real add-to-cart endpoint with only {product_id, quantity} — the
	// backend recomputes price/discount itself when it actually writes the
	// cart, so this preview is never trusted twice over either.
	const hasErrors = cart.errors.length > 0;

	return (
		<div className="border border-border rounded-lg overflow-hidden bg-background">
			<div className="px-3 py-2 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
				Cart total (verified)
			</div>
			<div className="divide-y divide-border/60">
				{cart.line_items.map((li) => (
					<div key={li.product_id} className="flex justify-between px-3 py-1.5 text-sm">
						<span>
							{li.name} × {li.quantity}
						</span>
						<span className="tabular-nums">₹{Number(li.subtotal).toLocaleString()}</span>
					</div>
				))}
			</div>
			<div className="flex justify-between px-3 py-2 text-sm font-semibold border-t border-border">
				<span>Total</span>
				<span className="tabular-nums">₹{Number(cart.total_amount).toLocaleString()}</span>
			</div>
			{hasErrors && (
				<div className="px-3 py-2 text-xs text-red-600 border-t border-border bg-red-50">
					{cart.errors.map((e, i) => (
						<div key={i}>
							Product #{e.product_id}: {e.error}
						</div>
					))}
				</div>
			)}

			<div className="border-t border-border px-3 py-2">
				{status === "pending" && (
					<div className="flex gap-2">
						<button
							onClick={onApprove}
							disabled={hasErrors && cart.line_items.length === 0}
							className="flex-1 px-3 py-1.5 rounded bg-black text-white text-xs font-medium disabled:opacity-50"
						>
							Approve — add to cart
						</button>
						<button
							onClick={onReject}
							className="flex-1 px-3 py-1.5 rounded border border-border text-xs font-medium hover:bg-muted"
						>
							Reject
						</button>
					</div>
				)}
				{status === "approving" && (
					<p className="text-xs text-muted-foreground animate-pulse">Adding to cart…</p>
				)}
				{status === "approved" && (
					<p className="text-xs text-green-600 font-medium">✅ Added to your cart</p>
				)}
				{status === "rejected" && (
					<p className="text-xs text-muted-foreground">Cancelled — nothing was added.</p>
				)}
				{status === "error" && (
					<div className="flex gap-2 items-center">
						<p className="text-xs text-red-600 flex-1">Something went wrong.</p>
						<button
							onClick={onApprove}
							className="px-3 py-1.5 rounded bg-black text-white text-xs font-medium"
						>
							Retry
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

function ChatBubble({
	item,
	onApproveCart,
	onRejectCart,
}: {
	item: ChatItem;
	onApproveCart: (assistantId: string, cart: CartSummary) => void;
	onRejectCart: (assistantId: string) => void;
}) {
	if (item.kind === "user") {
		return (
			<div className="ml-auto max-w-[80%] bg-black text-white rounded-lg px-3 py-2 text-sm w-fit">
				{item.text}
			</div>
		);
	}

	if (item.kind === "tool") {
		return <ToolBubble item={item} />;
	}

	if (item.kind === "assistant") {
		return (
			<div className="max-w-[90%] w-fit space-y-2">
				<div className="bg-muted rounded-lg px-3 py-2 text-sm prose prose-sm dark:prose-invert prose-p:my-1 prose-table:my-2">
					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						components={{
							table: ({ ...props }) => (
								<table className="border-collapse border border-border text-xs" {...props} />
							),
							th: ({ ...props }) => (
								<th className="border border-border px-2 py-1 bg-background text-left" {...props} />
							),
							td: ({ ...props }) => <td className="border border-border px-2 py-1" {...props} />,
						}}
					>
						{item.text}
					</ReactMarkdown>
				</div>
				{item.recommendations && item.recommendations.length > 0 && (
					<div className="space-y-2">
						{item.recommendations.map((rec) => (
							<div key={rec.product_id} className="border border-border rounded-lg px-3 py-2 bg-background">
								<div className="flex justify-between items-baseline gap-2">
									<span className="font-medium text-sm">{rec.name}</span>
									{rec.price !== undefined && (
										<span className="text-sm font-semibold whitespace-nowrap">
											₹{Number(rec.price).toLocaleString()}
										</span>
									)}
								</div>
								<p className="text-xs text-muted-foreground mt-1 italic border-t border-border/60 pt-1">
									Why: {rec.reason}
								</p>
							</div>
						))}
					</div>
				)}
				{item.cart && (
					<CartSummaryCard
						cart={item.cart}
						status={item.cartStatus}
						onApprove={() => onApproveCart(item.id, item.cart!)}
						onReject={() => onRejectCart(item.id)}
					/>
				)}
			</div>
		);
	}

	// error
	return (
		<div className="max-w-[90%] w-fit bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
			{item.text}
		</div>
	);
}