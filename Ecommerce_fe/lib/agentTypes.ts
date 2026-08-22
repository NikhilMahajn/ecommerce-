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


 
// One entry in the chat transcript rendered by ChatPanel.
export type ChatItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "error"; text: string };
