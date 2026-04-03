import { NextResponse } from "next/server"
import type { BagsApiResponse, Token, TokenApiResponse } from "@/types/token"

const BAGS_API_URL = "https://public-api-v2.bags.fm/api/v1/token-launch/feed"
const BAGS_API_KEY = process.env.BAGS_API_KEY || ""

/**
 * Proxy route for the Bags Token Launch Feed.
 * Fetches from the Bags API server-side, maps the data to a clean shape,
 * and returns structured JSON: { success, data, timestamp }
 */
export async function GET() {
  try {
    if (!BAGS_API_KEY) {
      console.error("[api/tokens] BAGS_API_KEY is not set")
      return NextResponse.json<TokenApiResponse>(
        {
          success: false,
          data: [],
          error: "Server configuration error: API key missing",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }

    const response = await fetch(BAGS_API_URL, {
      method: "GET",
      headers: {
        "x-api-key": BAGS_API_KEY,
        "Content-Type": "application/json",
      },
      // Revalidate every 30 seconds for near-real-time data
      next: { revalidate: 30 },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[api/tokens] Bags API returned ${response.status}: ${errorText}`)
      return NextResponse.json<TokenApiResponse>(
        {
          success: false,
          data: [],
          error: `Bags API error: ${response.status}`,
          timestamp: new Date().toISOString(),
        },
        { status: response.status }
      )
    }

    const raw: BagsApiResponse = await response.json()

    if (!raw.success || !Array.isArray(raw.response)) {
      console.error("[api/tokens] Bags API returned unsuccessful response:", raw)
      return NextResponse.json<TokenApiResponse>(
        {
          success: false,
          data: [],
          error: "Unexpected response format from Bags API",
          timestamp: new Date().toISOString(),
        },
        { status: 502 }
      )
    }

    // Log raw count for debugging
    if (process.env.NODE_ENV === "development") {
      console.log(`[api/tokens] Fetched ${raw.response.length} tokens from Bags API`)
    }

    // Map to clean frontend model — extract only needed fields
    const tokens: Token[] = raw.response.map((item, index) => {
      // Normalize status into canonical categories:
      //   "pre-graduation" = early-stage, high-risk
      //   "graduated"      = post-launch, more stable
      const normalizedStatus = classifyTokenStatus(item.status)

      return {
        id: item.tokenMint || `token-${index}`,
        name: item.name || "Unknown Token",
        symbol: item.symbol || "???",
        description: item.description || "",
        image: item.image || "",
        address: item.tokenMint || "",
        status: normalizedStatus,
        launchTime: normalizedStatus === "graduated" ? "Graduated" : "Pre-graduation",
        twitter: item.twitter || null,
        website: item.website || null,
      }
    })

    return NextResponse.json<TokenApiResponse>(
      {
        success: true,
        data: tokens,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          // Allow client-side caching for 15s, stale-while-revalidate for 30s
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
        },
      }
    )
  } catch (error) {
    console.error("[api/tokens] Unexpected error:", error)
    return NextResponse.json<TokenApiResponse>(
      {
        success: false,
        data: [],
        error: "Internal server error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * Classify a raw Bags API status into one of two canonical categories.
 *
 * Returns:
 *   "pre-graduation" — early-stage, high-risk tokens
 *   "graduated"      — post-launch, more stable tokens
 *
 * Fallback: unknown statuses default to "pre-graduation" (safer assumption).
 */
function classifyTokenStatus(rawStatus: string): string {
  const s = rawStatus?.toUpperCase?.() || ""

  // Post-launch / graduated statuses
  if (
    s === "POST_GRAD" ||
    s === "GRADUATED" ||
    s === "POST-GRADUATION" ||
    s === "POST_GRADUATION" ||
    s === "LAUNCHED" ||
    s === "MIGRATED"
  ) {
    return "graduated"
  }

  // Pre-launch / pre-graduation statuses (explicit + fallback)
  // PRE_GRAD, PRE_LAUNCH, or anything else → treat as pre-graduation
  return "pre-graduation"
}
