"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatItem, CartSummary } from "@/lib/agentTypes";
import { describeToolCall, describeToolResult } from "@/lib/toolDisplay";
import { historyToChatItems } from "@/lib/chatHistory";
import Link from "next/link";
import {
	Sparkles,
	Loader2,
	Check,
	ChevronRight,
	ChevronDown,
	ArrowUp,
	AlertCircle,
	ShoppingBag,
} from "lucide-react";

import { apiClient } from "@/lib/apiClient";

const SESSION_STORAGE_KEY = "chat_session_id";

const SUGGESTIONS = [
	{ icon: "💻", label: "Laptop under ₹60k, 16GB RAM", prompt: "Recommend a laptop under ₹60,000 with 16GB RAM that's in stock" },
	{ icon: "🎮", label: "Build me a gaming setup", prompt: "Build me a complete gaming setup from your catalog" },
	{ icon: "🎧", label: "Best headphones in stock", prompt: "What are the best wireless headphones you have in stock?" },
	{ icon: "🛒", label: "Add items to my cart", prompt: "Add a keyboard and mouse to my cart" },
];

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

	const sessionIdRef = useRef<string | null>(null);

	const prevAuthRef = useRef<boolean | undefined>(undefined);

	async function loadSessionAndHistory() {
		setLoadingHistory(true);
		const sessionId = getOrCreateSessionId();
		sessionIdRef.current = sessionId;

		try {
			const res = await apiClient.getChatHistory(sessionId);
			const rows = (res as any)?.messages ?? (res as any)?.data?.messages ?? [];
			setItems(rows.length > 0 ? historyToChatItems(rows) : []);
		} catch (err) {
			console.error("[Chat] Failed to load history:", err);
			setItems([]);
		} finally {
			setLoadingHistory(false);
			queueMicrotask(() => scrollToBottom("auto"));
		}
	}

	useEffect(() => {
		if (isAuthenticated === null) {
			return;
		}

		if (isAuthenticated === false) {
			localStorage.removeItem(SESSION_STORAGE_KEY);
			sessionIdRef.current = null;
			setItems([]);
			setLoadingHistory(false);
			prevAuthRef.current = false;
			return;
		}

		if (prevAuthRef.current !== true) {
			loadSessionAndHistory();
		}
		prevAuthRef.current = true;
	}, [isAuthenticated]);

	function scrollToBottom(behavior: ScrollBehavior = "smooth") {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
	}

	useEffect(() => {
		scrollToBottom();
	}, [items.length]);

	function pushItem(item: ChatItem) {
		setItems((prev) => [...prev, item]);
		queueMicrotask(() => scrollToBottom());
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

	async function sendMessage(rawText?: string) {
		const text = (rawText ?? input).trim();
		if (!text || busy) return;

		const sessionId = sessionIdRef.current ?? getOrCreateSessionId();
		sessionIdRef.current = sessionId;

		setInput("");
		pushItem({ kind: "user", text });
		setBusy(true);
		setCurrentAction(null);

		try {
			for await (const event of apiClient.streamAgentMessage(text, sessionId)) {
				if (event.type === "tool_call") {
					pushItem({ kind: "tool", _id: event.tool_call_id, tool_name: event.name, args: event.args, status: "calling" });
					setCurrentAction(describeToolCall(event.name, event.args));
				} else if (event.type === "tool_result") {
					updateToolItem(event.tool_call_id, { status: "done", result: event.result } as Partial<ChatItem>);
					setCurrentAction(null);
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
		<div className="flex flex-col h-[520px] bg-background">
			<div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
				{loadingHistory ? (
					<div className="h-full flex flex-col items-center justify-center gap-3">
						<div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center animate-pulse">
							<Sparkles className="w-5 h-5 text-primary-foreground" />
						</div>
						<p className="text-sm text-muted-foreground">Loading conversation…</p>
					</div>
				) : items.length === 0 ? (
					<WelcomeScreen onSuggestion={(prompt) => sendMessage(prompt)} />
				) : (
					items.map((item, i) => (
						<ChatBubble key={i} item={item} onApproveCart={approveCart} onRejectCart={rejectCart} />
					))
				)}

				{busy && <AgentActivity label={currentAction} />}
			</div>

			<div className="border-t border-border p-3">
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						sendMessage();
					}}
				>
					<input
						className="flex-1 min-w-0 border border-input rounded-lg px-3 py-2 text-sm bg-background placeholder:text-muted-foreground/70 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring transition-shadow"
						placeholder="Ask about products, stock, prices…"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						disabled={busy}
					/>
					<button
						type="submit"
						aria-label="Send message"
						className="shrink-0 w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
						disabled={busy || !input.trim()}
					>
						<ArrowUp className="w-4 h-4" strokeWidth={2.5} />
					</button>
				</form>
				<p className="text-[11px] text-muted-foreground/70 text-center mt-2">
					Searches live inventory · verifies stock · builds carts for your approval
				</p>
			</div>
		</div>
	);
}

function AgentAvatar() {
	return (
		<div className="shrink-0 w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
			<Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
		</div>
	);
}

function WelcomeScreen({ onSuggestion }: { onSuggestion: (prompt: string) => void }) {
	return (
		<div className="flex flex-col items-center text-center pt-8 gap-1">
			<div className="relative mb-3">
				<div className="absolute inset-0 rounded-xl bg-primary/20 blur-lg scale-150" />
				<div className="relative w-14 h-14 rounded-xl bg-primary flex items-center justify-center shadow-lg">
					<Sparkles className="w-7 h-7 text-primary-foreground" />
				</div>
			</div>
			<h3 className="font-heading text-lg font-semibold text-foreground">Your AI shopping assistant</h3>
			<p className="text-sm text-muted-foreground max-w-[280px] mt-1 leading-relaxed">
				I search real inventory, compare prices, and build carts you approve before anything is added.
			</p>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full mt-6">
				{SUGGESTIONS.map((s) => (
					<button
						key={s.label}
						onClick={() => onSuggestion(s.prompt)}
						className="group flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-xs font-medium text-foreground hover:border-accent hover:shadow-md transition-all duration-300"
					>
						<span aria-hidden>{s.icon}</span>
						<span className="flex-1 leading-snug">{s.label}</span>
						<ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-all duration-300" />
					</button>
				))}
			</div>
		</div>
	);
}

function AgentActivity({ label }: { label: string | null }) {
	return (
		<div className="flex items-end gap-2.5">
			<AgentAvatar />
			<div className="bg-muted rounded-lg px-4 py-3">
				<div className="flex items-center gap-1.5 h-4">
					<span className="w-1.5 h-1.5 rounded-full bg-foreground/70 animate-bounce [animation-delay:-0.3s]" />
					<span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce [animation-delay:-0.15s]" />
					<span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce" />
				</div>
				{label && (
					<p className="text-xs text-muted-foreground mt-1.5">{label.replace(/^[^\w"]+/, "")}</p>
				)}
			</div>
		</div>
	);
}

function ToolBubble({ item }: { item: Extract<ChatItem, { kind: "tool" }> }) {
	const [showDetails, setShowDetails] = useState(false);
	const args = item.args ?? {};
	const calling = item.status === "calling";
	const summary = calling
		? describeToolCall(item.tool_name, args)
		: describeToolResult(item.tool_name, args, item.result);

	return (
		<div className="ml-auto max-w-[90%] w-fit">
			<button
				onClick={() => item.status === "done" && setShowDetails((v) => !v)}
				className={`inline-flex max-w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all duration-300 ${
					calling
						? "border border-border bg-background text-foreground"
						: "border border-border/60 bg-muted/50 text-muted-foreground cursor-pointer hover:bg-muted"
				}`}
			>
				{calling ? (
					<Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
				) : (
					<Check className="w-3.5 h-3.5 shrink-0 text-green-600" strokeWidth={3} />
				)}
				<span className="truncate">{summary.replace(/^[^\w"]+/, "")}</span>
				{!calling && showDetails && <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />}
			</button>

			{showDetails && item.status === "done" && (
				<pre className="mt-1.5 mr-6 whitespace-pre-wrap font-mono text-[11px] opacity-60 max-h-32 overflow-y-auto rounded-lg border border-border/60 bg-muted/30 p-2">
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
	const hasErrors = cart.errors.length > 0;

	return (
		<div className="rounded-lg overflow-hidden border border-border bg-card shadow-sm">
			<div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
				<ShoppingBag className="w-3.5 h-3.5" />
				<span className="text-xs font-semibold font-heading">Cart total (verified)</span>
			</div>
			<div className="divide-y divide-border/60">
				{cart.line_items.map((li) => (
					<div key={li.product_id} className="flex justify-between gap-3 px-3 py-1.5 text-sm">
						<span className="truncate">
							{li.name} <span className="text-muted-foreground">× {li.quantity}</span>
						</span>
						<span className="tabular-nums font-medium">₹{Number(li.subtotal).toLocaleString()}</span>
					</div>
				))}
			</div>
			<div className="flex justify-between px-3 py-2 text-sm font-semibold border-t border-border">
				<span>Total</span>
				<span className="tabular-nums">₹{Number(cart.total_amount).toLocaleString()}</span>
			</div>
			{hasErrors && (
				<div className="px-3 py-2 text-xs text-red-600 border-t border-border bg-red-50 dark:bg-red-950/20">
					{cart.errors.map((e, i) => (
						<div key={i}>
							Product #{e.product_id}: {e.error}
						</div>
					))}
				</div>
			)}

			<div className="border-t border-border px-3 py-2.5">
				{status === "pending" && (
					<div className="flex gap-2">
						<button
							onClick={onApprove}
							disabled={hasErrors && cart.line_items.length === 0}
							className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Approve — add to cart
						</button>
						<button
							onClick={onReject}
							className="flex-1 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted active:scale-[0.98] transition-all"
						>
							Reject
						</button>
					</div>
				)}
				{status === "approving" && (
					<p className="flex items-center gap-2 text-xs text-muted-foreground">
						<Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding to cart…
					</p>
				)}
				{status === "approved" && (
					<p className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
						<Check className="w-3.5 h-3.5" strokeWidth={3} /> Added to your cart
					</p>
				)}
				{status === "rejected" && (
					<p className="text-xs text-muted-foreground italic">Cancelled — nothing was added.</p>
				)}
				{status === "error" && (
					<div className="flex gap-2 items-center">
						<p className="text-xs text-destructive flex-1">Something went wrong.</p>
						<button
							onClick={onApprove}
							className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
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
			<div className="ml-auto max-w-[80%] w-fit rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm break-words">
				{item.text}
			</div>
		);
	}

	if (item.kind === "tool") {
		return <ToolBubble item={item} />;
	}

	if (item.kind === "assistant") {
		return (
			<div className="flex items-start gap-2.5 max-w-[95%]">
				<AgentAvatar />
				<div className="min-w-0 space-y-2.5 flex-1">
					<div className="bg-muted rounded-lg px-3 py-2.5 text-sm w-fit max-w-full overflow-hidden">
						<div className="prose prose-sm dark:prose-invert prose-p:my-1 prose-table:my-2 max-w-none break-words overflow-x-auto [&_code]:break-all">
							<ReactMarkdown
								remarkPlugins={[remarkGfm]}
								components={{
									table: ({ ...props }) => (
										<table className="border-collapse border border-border text-xs w-max" {...props} />
									),
									th: ({ ...props }) => (
										<th className="border border-border px-2 py-1 bg-background text-left whitespace-nowrap" {...props} />
									),
									td: ({ ...props }) => <td className="border border-border px-2 py-1 break-words" {...props} />,
							}}
						>
							{item.text}
						</ReactMarkdown>
						</div>
					</div>
					{item.recommendations && item.recommendations.length > 0 && (
						<div className="space-y-2">
							{item.recommendations.map((rec) => (
								<Link
									key={rec.product_id}
									href={`/product/${rec.product_id}`}
									className="group block rounded-lg border border-border bg-card px-3 py-2.5 hover:border-accent hover:shadow-lg transition-all duration-300"
								>
									<div className="flex justify-between items-baseline gap-2">
										<span className="font-medium text-sm group-hover:text-accent transition-colors line-clamp-1">
											{rec.name}
										</span>
										{rec.price !== undefined && (
											<span className="text-sm font-heading font-bold whitespace-nowrap tabular-nums">
												₹{Number(rec.price).toLocaleString()}
											</span>
										)}
									</div>
									<p className="text-xs text-muted-foreground mt-1.5 border-t border-border/60 pt-1.5 leading-relaxed">
										<span className="font-semibold text-foreground">Why: </span>
										{rec.reason}
									</p>
								</Link>
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
			</div>
		);
	}

	return (
		<div className="ml-auto max-w-[90%] w-fit rounded-lg bg-destructive/10 border border-destructive/30 text-destructive px-3 py-2.5 text-sm">
			<div className="flex items-start gap-2">
				<AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
				{item.text}
			</div>
		</div>
	);
}
