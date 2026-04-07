import { NextRequest, NextResponse } from "next/server"

const JUPITER_API = "https://api.jup.ag/swap/v2"

function getJupiterHeaders() {
  const headers: Record<string, string> = { "Accept": "application/json" }
  if (process.env.JUPITER_API_KEY) {
    headers["x-api-key"] = process.env.JUPITER_API_KEY
  }
  return headers
}

/**
 * Server-side proxy for Jupiter V2 API.
 * GET  /api/swap?action=quote — get quote only (no transaction)
 * GET  /api/swap?action=order — get quote + transaction (requires taker)
 * GET  /api/swap?action=price — get SOL price
 * POST /api/swap { action: "execute", signedTransaction, requestId, lastValidBlockHeight }
 */

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const action = params.get("action")

  if (action === "quote" || action === "order") {
    const inputMint = params.get("inputMint")
    const outputMint = params.get("outputMint")
    const amount = params.get("amount")
    const slippageBps = params.get("slippageBps") || "100"
    const taker = params.get("taker") // if provided, transaction is included

    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json({ error: "Missing required params" }, { status: 400 })
    }

    const amountNum = parseInt(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    try {
      const queryParams = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amountNum.toString(),
        slippageBps,
      })

      // Include taker for order action (returns transaction)
      if (taker && action === "order") {
        if (taker.length < 32 || taker.length > 44) {
          return NextResponse.json({ error: "Invalid taker address" }, { status: 400 })
        }
        queryParams.set("taker", taker)
      }

      const res = await fetch(`${JUPITER_API}/order?${queryParams}`, {
        headers: getJupiterHeaders(),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Jupiter API failed (${res.status})` }))
        return NextResponse.json(err, { status: res.status })
      }

      const data = await res.json()
      return NextResponse.json(data)
    } catch {
      return NextResponse.json({ error: "Failed to fetch from Jupiter" }, { status: 502 })
    }
  }

  if (action === "price") {
    try {
      const res = await fetch(
        "https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112",
        { next: { revalidate: 30 } }
      )
      const data = await res.json()
      const price = data?.pairs?.[0]?.priceUsd
      return NextResponse.json({ price: price ? parseFloat(price) : null })
    } catch {
      return NextResponse.json({ price: null })
    }
  }

  return NextResponse.json({ error: "Invalid action. Use ?action=quote, ?action=order, or ?action=price" }, { status: 400 })
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text()
    if (!text) {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 })
    }

    let body
    try {
      body = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { action, signedTransaction, requestId, lastValidBlockHeight } = body

    if (action === "execute") {
      if (!signedTransaction || !requestId) {
        return NextResponse.json({ error: "Missing signedTransaction or requestId" }, { status: 400 })
      }

      const res = await fetch(`${JUPITER_API}/execute`, {
        method: "POST",
        headers: { ...getJupiterHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction,
          requestId,
          ...(lastValidBlockHeight ? { lastValidBlockHeight } : {}),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Jupiter execute failed (${res.status})` }))
        return NextResponse.json(err, { status: res.status })
      }

      const data = await res.json()
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: `Invalid action: ${action || "(none)"}` }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: `Failed to process request: ${(e as Error).message}` }, { status: 500 })
  }
}
