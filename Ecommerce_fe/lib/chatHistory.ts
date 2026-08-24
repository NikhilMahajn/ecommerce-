import type { ChatItem } from './agentTypes'

interface RawHistoryMessage {
  role?: string
  content?: string | null
  [key: string]: unknown
}

/**
 * Converts the raw {role, content} rows persisted by the backend
 * (ChatHistoryService.save_messages only ever stores role+content, matching
 * the plain Groq message shape used throughout agent.py) into ChatItems for
 * initial render.
 *
 * Only 'user' and 'assistant' turns are reconstructable this way — tool-call
 * bubbles, recommendations, and cart previews are NOT persisted alongside
 * history, so a reloaded conversation shows the text exchange but not the
 * original tool-call trace or cart card for past turns. If you want those to
 * survive a reload too, the backend would need to persist the structured
 * `recommendations`/`cart` alongside each assistant message, not just
 * `content`.
 */
export function historyToChatItems(rows: RawHistoryMessage[]): ChatItem[] {
  const items: ChatItem[] = []

  for (const row of rows) {
    if (row.role === 'user' && typeof row.content === 'string' && row.content.trim()) {
      items.push({ kind: 'user', text: row.content })
    } else if (row.role === 'assistant' && typeof row.content === 'string' && row.content.trim()) {
      items.push({ kind: 'assistant', id: crypto.randomUUID(), text: row.content })
    }
    // 'system' and 'tool' rows are intentionally skipped — not meaningful
    // to render as chat bubbles on their own.
  }

  return items
}