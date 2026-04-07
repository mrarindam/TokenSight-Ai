import { NextResponse } from "next/server"
import { isValidSolanaAddress } from "@/lib/utils"
import type { TrendingToken, TrendingTokenApiResponse } from "@/types/token"

export const dynamic = "force-dynamic"
export const revalidate = 0

const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || ""
const TRENDING_PAGE_SIZE = 20
const MAX_TRENDING_TOKENS = 10
const MIN_TRENDING_TOKENS = 10
const CACHE_TTL_MS = 60 * 1000

let trendingCache:
  | {
      data: TrendingToken[]
      timestamp: string
      fetchedAt: number
    }
  | null = null
let trendingRequest: Promise<{ data: TrendingToken[]; timestamp: string }> | null = null

interface BirdeyeTrendingResponse {
  data?: {
    tokens?: BirdeyeTrendingItem[]
  }
}

interface BirdeyeTrendingItem {
  address: string
  rank?: number | null
  name?: string | null
  symbol?: string | null
  price?: number | null
  marketcap?: number | null
  liquidity?: number | null
  volume24hUSD?: number | null
  trade24h?: number | null
  price24hChangePercent?: number | null
  updateUnixTime?: number | null
  logoURI?: string | null
}

interface RankedTrendingToken extends TrendingToken {
  sourceRank: number
}

function formatAge(createdAtUnix?: number | null) {
  if (!createdAtUnix) return "Live"

  const nowSeconds = Math.floor(Date.now() / 1000)
  const diffSeconds = Math.max(0, nowSeconds - createdAtUnix)

  if (diffSeconds < 3600) {
    const minutes = Math.max(1, Math.floor(diffSeconds / 60))
    return `${minutes}m`
  }

  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600)
    return `${hours}h`
  }

  const days = Math.floor(diffSeconds / 86400)
  return `${days}d`
}

function calculateTrendingScore(token: BirdeyeTrendingItem) {
  const volume24h = token.volume24hUSD || 0
  const priceChange24h = token.price24hChangePercent || 0
  const txns = token.trade24h

  if (typeof txns === "number") {
    return volume24h * 0.6 + priceChange24h * 0.3 + txns * 0.1
  }

  return volume24h * 0.7 + priceChange24h * 0.3
}

function normalizeTokenKey(token: BirdeyeTrendingItem) {
  const name = (token.name || "").trim().toLowerCase()
  const symbol = (token.symbol || "").trim().toLowerCase()
  return `${name}::${symbol}`
}

async function fetchTrendingPage(offset: number) {
  const response = await fetch(
    `https://public-api.birdeye.so/defi/token_trending?sort_by=rank&sort_type=asc&offset=${offset}&limit=${TRENDING_PAGE_SIZE}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "x-chain": "solana",
        "X-API-KEY": BIRDEYE_API_KEY,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Birdeye API error ${response.status}: ${errorText}`)
  }

  const raw = (await response.json()) as BirdeyeTrendingResponse
  return raw.data?.tokens || []
}

async function fetchTrendingPageWithRetry(offset: number, retries = 1): Promise<BirdeyeTrendingItem[]> {
  try {
    return await fetchTrendingPage(offset)
  } catch (error) {
    const isRateLimited = error instanceof Error && error.message.includes("Birdeye API error 429")

    if (!isRateLimited || retries <= 0) {
      throw error
    }

    await new Promise((resolve) => setTimeout(resolve, 800))
    return fetchTrendingPageWithRetry(offset, retries - 1)
  }
}

function isCacheFresh() {
  if (!trendingCache) return false
  return Date.now() - trendingCache.fetchedAt < CACHE_TTL_MS
}

function buildTrendingTokens(items: BirdeyeTrendingItem[]) {
  const deduped = new Map<string, BirdeyeTrendingItem>()

  for (const item of items) {
    if (!item.address || !isValidSolanaAddress(item.address)) continue
    if (!item.name || !item.symbol) continue

    const key = normalizeTokenKey(item)
    const existing = deduped.get(key)

    if (!existing) {
      deduped.set(key, item)
      continue
    }

    const existingRank = existing.rank ?? Number.POSITIVE_INFINITY
    const nextRank = item.rank ?? Number.POSITIVE_INFINITY

    if (nextRank < existingRank) {
      deduped.set(key, item)
    }
  }

  const normalized = Array.from(deduped.values()).map((item): RankedTrendingToken => {
    const createdAtUnix = item.updateUnixTime ?? null

    return {
      rank: 0,
      sourceRank: item.rank ?? Number.POSITIVE_INFINITY,
      name: item.name as string,
      symbol: item.symbol as string,
      address: item.address,
      price: item.price || 0,
      volume24hUSD: item.volume24hUSD || 0,
      liquidity: item.liquidity || 0,
      marketCap: item.marketcap || 0,
      priceChange24h: item.price24hChangePercent || 0,
      txns: item.trade24h ?? null,
      createdAt: createdAtUnix ? new Date(createdAtUnix * 1000).toISOString() : new Date().toISOString(),
      age: formatAge(createdAtUnix),
      score: calculateTrendingScore(item),
      image: item.logoURI || null,
    }
  })

  const qualityFiltered = normalized.filter((item) => item.liquidity > 10000 && item.volume24hUSD > 10000)
  const selected = qualityFiltered.length >= MIN_TRENDING_TOKENS ? qualityFiltered : normalized

  return selected
    .sort((left, right) => {
      const rankGap = left.sourceRank - right.sourceRank
      if (Number.isFinite(rankGap) && rankGap !== 0) return rankGap
      return right.score - left.score
    })
    .slice(0, MAX_TRENDING_TOKENS)
    .map((item, index): TrendingToken => ({
      rank: index + 1,
      name: item.name,
      symbol: item.symbol,
      address: item.address,
      price: item.price,
      volume24hUSD: item.volume24hUSD,
      liquidity: item.liquidity,
      marketCap: item.marketCap,
      priceChange24h: item.priceChange24h,
      txns: item.txns,
      createdAt: item.createdAt,
      age: item.age,
      score: item.score,
      image: item.image,
    }))
}

export async function GET() {
  try {
    if (!BIRDEYE_API_KEY) {
      return NextResponse.json<TrendingTokenApiResponse>(
        {
          success: false,
          data: [],
          error: "Server configuration error: Birdeye API key missing",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }

    if (isCacheFresh()) {
      const cached = trendingCache

      return NextResponse.json<TrendingTokenApiResponse>(
        {
          success: true,
          data: cached!.data,
          timestamp: cached!.timestamp,
        },
        { status: 200 }
      )
    }

    if (trendingRequest) {
      const pending = await trendingRequest

      return NextResponse.json<TrendingTokenApiResponse>(
        {
          success: true,
          data: pending.data,
          timestamp: pending.timestamp,
        },
        { status: 200 }
      )
    }

    trendingRequest = (async () => {
      const items = await fetchTrendingPageWithRetry(0)
      const rankedTokens = buildTrendingTokens(items)
      const timestamp = new Date().toISOString()

      if (rankedTokens.length > 0) {
        trendingCache = {
          data: rankedTokens,
          timestamp,
          fetchedAt: Date.now(),
        }
      }

      return {
        data: rankedTokens,
        timestamp,
      }
    })()

    const result = await trendingRequest
    trendingRequest = null

    return NextResponse.json<TrendingTokenApiResponse>(
      {
        success: true,
        data: result.data,
        timestamp: result.timestamp,
      },
      { status: 200 }
    )
  } catch (error) {
    trendingRequest = null
    console.error("[api/trending] Unexpected error:", error)

    if (trendingCache) {
      const cached = trendingCache

      return NextResponse.json<TrendingTokenApiResponse>(
        {
          success: true,
          data: cached.data,
          error: "Serving cached trending data while Birdeye is rate-limited",
          timestamp: cached.timestamp,
        },
        { status: 200 }
      )
    }

    return NextResponse.json<TrendingTokenApiResponse>(
      {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Failed to load trending Solana tokens",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}