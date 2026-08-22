"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatItem } from "@/lib/agentTypes";

import { apiClient } from "@/lib/apiClient";

export default function ChatPanel() {
	const [items, setItems] = useState<ChatItem[]>([]);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const sessionIdRef = useRef(getOrCreateSessionId());


	function pushItem(item: ChatItem) {
		setItems((prev) => [...prev, item]);
		queueMicrotask(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
	}

	function getOrCreateSessionId() {
		let sessionId = localStorage.getItem("chat_session_id");
		if (!sessionId) {
			sessionId = crypto.randomUUID();
			localStorage.setItem("chat_session_id", sessionId);
		}
		return sessionId;
	}


	async function sendMessage() {
		const text = input.trim();
		if (!text || busy) return;
		setInput("");
		pushItem({ kind: "user", text });
		setBusy(true);

		try {
			const data = await apiClient.sendAgentMessage(text, sessionIdRef.current);
			if (!data?.reply) {
				throw new Error("Agent responded without a message.");
			}
			pushItem({ kind: "assistant", text: data.reply });
		}
		catch (err: any) {
			pushItem({ kind: "error", text: err.message ?? "Something went wrong talking to the agent." });
		} finally {
			setBusy(false);
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
				{busy && <p className="text-xs text-muted-foreground animate-pulse">thinking…</p>}
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

function ChatBubble({ item }: { item: ChatItem }) {
	if (item.kind === "user") {
		return (
			<div className="ml-auto max-w-[80%] bg-black text-white rounded-lg px-3 py-2 text-sm w-fit">
				{item.text}
			</div>
		);
	}

	if (item.kind === "assistant") {
		return (
			<div className="max-w-[90%] w-fit bg-muted rounded-lg px-3 py-2 text-sm prose prose-sm dark:prose-invert prose-p:my-1 prose-table:my-2">
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
		);
	}

	// error
	return (
		<div className="max-w-[90%] w-fit bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
			{item.text}
		</div>
	);
}