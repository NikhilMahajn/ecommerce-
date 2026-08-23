"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatItem } from "@/lib/agentTypes";
import { describeToolCall, describeToolResult } from "@/lib/toolDisplay";

import { apiClient } from "@/lib/apiClient";

function getOrCreateSessionId() {
	let sessionId = localStorage.getItem("chat_session_id");
	if (!sessionId) {
		sessionId = crypto.randomUUID();
		localStorage.setItem("chat_session_id", sessionId);
	}
	return sessionId;
}

export default function ChatPanel() {
	const [items, setItems] = useState<ChatItem[]>([]);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [currentAction, setCurrentAction] = useState<string | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	// localStorage doesn't exist during SSR — reading it in useRef's
	// initializer runs at render time, which can happen server-side and
	// throws/returns undefined depending on the environment. Assigning it in
	// useEffect guarantees this only ever runs client-side, after mount.
	const sessionIdRef = useRef<string | null>(null);
	useEffect(() => {
		sessionIdRef.current = getOrCreateSessionId();
	}, []);

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

	async function sendMessage() {
		const text = input.trim();
		if (!text || busy) return;

		// Guards the edge case where someone sends before the mount effect has
		// run (fast typing + Enter on first paint). Falls back to creating the
		// session id on the spot rather than silently sending null.
		const sessionId = sessionIdRef.current ?? getOrCreateSessionId();
		sessionIdRef.current = sessionId;

		setInput("");
		pushItem({ kind: "user", text });
		setBusy(true);
		setCurrentAction("🤔 Thinking…");

		try {
			// streamAgentMessage is an async generator on apiClient — see
			// lib/apiClient_agent_addition.ts for what to add there. It yields
			// one parsed event per NDJSON line as the backend produces them.
			for await (const event of apiClient.streamAgentMessage(text, sessionId)) {
				if (event.type === "tool_call") {
					pushItem({ kind: "tool", _id: event.tool_call_id, tool_name: event.name, args: event.args, status: "calling" });
					setCurrentAction(describeToolCall(event.name, event.args));
				} else if (event.type === "tool_result") {
					updateToolItem(event.tool_call_id, { status: "done", result: event.result } as Partial<ChatItem>);
					setCurrentAction("🤔 Thinking…");
				} else if (event.type === "final") {
					pushItem({ kind: "assistant", text: event.reply, recommendations: event.recommendations });
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
				{items.length === 0 && (
					<p className="text-sm text-muted-foreground">
						Ask something like "a laptop under ₹60,000 with 16GB RAM in stock".
					</p>
				)}
				{items.map((item, i) => (
					<ChatBubble key={i} item={item} />
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

function ChatBubble({ item }: { item: ChatItem }) {
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