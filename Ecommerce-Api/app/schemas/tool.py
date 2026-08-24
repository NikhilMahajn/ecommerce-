TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Search the product catalog by query, category, and max price.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "category": {"type": ["string", "null"]},
                	"max_price": {"type": ["number", "null"]},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product",
            "description": "Get full details for a single product by ID.",
            "parameters": {
                "type": "object",
                "properties": {"product_id": {"type": "integer"}},
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_inventory",
            "description": "Check available stock quantity for a product.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer"},
                    "quantity": {"type": "integer"},
                },
                "required": ["product_id", "quantity"],
            },
        },
    },
	{
        "type": "function",
        "function": {
            "name": "calculate_cart",
            "description": (
                "Computes the authoritative subtotal and total for a proposed set of "
                "cart items. This is the ONLY source of truth for any total or "
                "subtotal — you must call this before stating any total to the user, "
                "and you must display exactly the total_amount this returns. Never "
                "compute, estimate, or restate a total yourself; if you do the math "
                "in your head it WILL be wrong and the user will see the correct "
                "number from this tool anyway, so there's no reason to guess. Also "
                "reports validation errors (invalid product_id, insufficient stock, "
                "non-positive quantity) for any line that couldn't be priced."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "description": "The proposed cart lines.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "product_id": {"type": "integer"},
                                "quantity": {"type": "integer", "description": "Must be a positive integer."},
                            },
                            "required": ["product_id", "quantity"],
                        },
                    }
                },
                "required": ["items"],
            },
        },
    },
	{
        "type": "function",
        "function": {
            "name": "get_related_products",
            "description": (
                "Finds products related to a given product for cross-sell/upsell — "
                "same category, in stock, and optionally within a budget. Use this "
                "AFTER you've identified or the user has confirmed a primary product, "
                "to suggest at most one relevant complementary or alternative item. "
                "Always pass max_price when you know the user's remaining budget "
                "(their stated total minus the price of what they just picked) — "
                "never suggest something that blows their budget. Don't call this "
                "speculatively on every turn; only for a genuine cross-sell moment "
                "(right after confirming a product, or when the user asks what else "
                "goes with it / what else they should get)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer", "description": "The anchor product to find related items for."},
                    "max_price": {"type": "number", "description": "Optional. Only suggest items at or under this price."},
                    "limit": {"type": "integer", "description": "Optional. Max number of related products to return (default 5)."},
                },
                "required": ["product_id"],
            },
        },
    },
    

]