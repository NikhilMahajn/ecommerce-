export interface ProductRecommendation {
  product_id: string | number
  name: string
  price: number
  reason: string // grounded in a tool-returned price/spec/stock value — never invented
}

export interface CartLineItem {
  product_id: string | number
  name: string
  unit_price: number
  quantity: number
  subtotal: number
}

export interface CartSummary {
  line_items: CartLineItem[]
  subtotal: number
  total_amount: number
  errors: { product_id: string | number; error: string }[]
}

// Non-streaming contract: POST /agent/chat -> { reply, recommendations, cart }
export interface ChatResponse {
  reply: string
  recommendations?: ProductRecommendation[]
  cart?: CartSummary | null
}

// Streaming contract: POST /agent/chat/stream -> NDJSON body, one event per line.
// Mirrors backend/app/services/agent.py's AgentService.agent_chat_stream events.
export type StreamEvent =
  | { type: 'tool_call'; tool_call_id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; tool_call_id: string; name: string; result: unknown }
  | { type: 'final'; reply: string; recommendations?: ProductRecommendation[]; cart?: CartSummary | null }
  | { type: 'error'; error: string }

// One entry in the chat transcript rendered by ChatPanel.
export type CartApprovalStatus = 'pending' | 'approving' | 'approved' | 'rejected' | 'error'

export type ChatItem =
  | { kind: 'user'; text: string }
  | {
      kind: 'assistant'
      id: string
      text: string
      recommendations?: ProductRecommendation[]
      cart?: CartSummary | null
      cartStatus?: CartApprovalStatus // only meaningful when `cart` is present
    }
  | { kind: 'tool'; _id: string; tool_name: string; args?: Record<string, unknown>; result?: unknown; status: 'calling' | 'done' }
  | { kind: 'error'; text: string }