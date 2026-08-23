// Human-readable descriptions for tool_call/tool_result events, keyed by
// tool name. Falls back to a generic description for anything not listed
// here, so a new tool never breaks the chat — it just won't be as polished
// until a case is added below.

export function describeToolCall(name: string, args: Record<string, any>): string {
  switch (name) {
    case "search_products": {
      const bits: string[] = [`"${args.query}"`]
      if (args.category) bits.push(`in ${args.category}`)
      if (args.max_price) bits.push(`under ₹${Number(args.max_price).toLocaleString()}`)
      return `🔍 Searching for ${bits.join(" ")}`
    }
    case "check_inventory":
      return `📦 Checking stock for product #${args.product_id}`
    case "get_product":
      return `📄 Looking up details for product #${args.product_id}`
    // Rename this case to match your actual tool name once a discount tool
    // exists on the backend (it isn't in TOOL_SCHEMAS yet as of this file).
    case "calculate_discount":
      return `🧮 Calculating discount for product #${args.product_id}`
    default:
      return `⚙️ Running ${name}…`
  }
}

export function describeToolResult(name: string, args: Record<string, any>, result: any): string {
  if (result && typeof result === "object" && "error" in result) {
    return `⚠️ ${result.error}`
  }

  switch (name) {
    case "search_products": {
      const count = result?.count ?? result?.products?.length ?? 0
      if (!count) return `No matches for "${args.query}".`
      const names = (result.products || []).map((p: any) => p.title).join(", ")
      return `Found ${count} match${count > 1 ? "es" : ""}: ${names}`
    }
    case "check_inventory": {
      if (result?.available) return `✅ In stock — ${result.in_stock} available`
      return `❌ Out of stock`
    }
    case "get_product": {
      if (result?.title) {
        const price = result.price !== undefined ? ` — ₹${Number(result.price).toLocaleString()}` : ""
        return `${result.title}${price}`
      }
      return "Details retrieved."
    }
    case "calculate_discount": {
      if (result?.discounted_price !== undefined) {
        return `New price: ₹${Number(result.discounted_price).toLocaleString()}`
      }
      return "Discount applied."
    }
    default:
      return "Done."
  }
}