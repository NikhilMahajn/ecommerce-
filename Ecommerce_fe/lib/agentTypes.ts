// Mirrors backend/agent/schemas.py — keep these in sync.

export interface ProductRecommendation {
  product_id: string;
  name: string;
  price: number;
  currency: string;
  in_stock: boolean;
  spec_highlights: Record<string, unknown>;
  reason: string; // must cite concrete tool-returned fields — see backend system prompt
  source_tool_call_id: string;
}

export type StreamEvent =
  | { type: 'tool_call'; tool_call_id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; tool_call_id: string; name: string; result: unknown }
  | { type: 'final'; reply: string }
  | { type: 'error'; error: string }
 
// One entry in the chat transcript rendered by ChatPanel.
export type ChatItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; _id: string; tool_name: string; args?: Record<string, unknown>; result?: unknown; status: 'calling' | 'done' }
  | { kind: 'error'; text: string }
 

export interface ChatResponse {
  reply: string
  recommendations?: ProductRecommendation[]
}
