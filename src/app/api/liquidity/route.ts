import { NextRequest, NextResponse } from "next/server"
import {
  calculateLiquidityScore,
  calculateNearPriceLiquidityRatio,
  estimatePriceImpact,
  getLiquidityBreakdown,
  type LiquidityPoolSnapshot,
} from "@/lib/liquidity"

const DLMM_API = "https://dlmm.datapi.meteora.ag"
const DAMM_API = "https://damm-v2.datapi.meteora.ag"
const JUPITER_API_KEY = process.env.JUPITER_API_KEY?.trim() || ""
const CACHE_TTL_MS = 8_000

const responseCache = new Map<string, { expiresAt: number; payload: unknown }>()

type MeteoraPoolRecord = Record<string, unknown>

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const mint = request.nextUrl.searchParams.get("mint")?.trim() || ""
  const fallbackPriceUsd = parseOptionalNumber(request.nextUrl.searchParams.get("priceUsd"))

  if (!mint || mint.length < 10) {
    return NextResponse.json({ error: "Missing or invalid mint" }, { status: 400 })
  }

  const cacheKey = `${mint}:${fallbackPriceUsd ?? "na"}`
  const cached = responseCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, { headers: getCacheHeaders() })
  }

  try {
    const [dlmmPools, dammPools, jupiterPriceUsd] = await Promise.all([
      fetchMeteoraPools(DLMM_API, mint, "dlmm"),
      fetchMeteoraPools(DAMM_API, mint, "damm"),
      fetchJupiterPriceUsd(mint),
    ])

    const pools = [...dlmmPools, ...dammPools].sort((left, right) => right.tvlUsd - left.tvlUsd)
    const effectiveFallbackPrice = fallbackPriceUsd ?? jupiterPriceUsd
    const breakdown = getLiquidityBreakdown(pools)
    const liquidityScore = calculateLiquidityScore(pools)
    const nearPriceLiquidityRatio = calculateNearPriceLiquidityRatio(pools)
    const impact100 = estimatePriceImpact(pools, mint, 100, effectiveFallbackPrice)
    const impact1000 = estimatePriceImpact(pools, mint, 1000, effectiveFallbackPrice)

    const payload = {
      mint,
      updatedAt: new Date().toISOString(),
      priceUsd: resolveTokenPrice(pools, mint, effectiveFallbackPrice),
      totalLiquidityUsd: breakdown.totalLiquidityUsd,
      liquidityScore,
      nearPriceLiquidityRatio,
      breakdown,
      impacts: {
        usd100: impact100,
        usd1000: impact1000,
      },
      risks: buildRiskSignals(breakdown, impact100, impact1000),
      pools: pools.slice(0, 6).map((pool) => ({
        protocol: pool.protocol,
        address: pool.address,
        name: pool.name,
        launchpad: pool.launchpad,
        tvlUsd: pool.tvlUsd,
        currentPrice: pool.currentPrice,
        tokenX: {
          address: pool.tokenX.address,
          symbol: pool.tokenX.symbol,
          amount: pool.tokenX.amount,
          priceUsd: pool.tokenX.priceUsd,
        },
        tokenY: {
          address: pool.tokenY.address,
          symbol: pool.tokenY.symbol,
          amount: pool.tokenY.amount,
          priceUsd: pool.tokenY.priceUsd,
        },
      })),
    }

    responseCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    })

    return NextResponse.json(payload, { headers: getCacheHeaders() })
  } catch (error) {
    console.error("[api/liquidity] Failed to build liquidity intelligence:", error)
    return NextResponse.json({ error: "Failed to load liquidity intelligence" }, { status: 502 })
  }
}

async function fetchMeteoraPools(
  baseUrl: string,
  mint: string,
  protocol: LiquidityPoolSnapshot["protocol"],
): Promise<LiquidityPoolSnapshot[]> {
  const url = new URL(`${baseUrl}/pools`)
  url.searchParams.set("query", mint)
  url.searchParams.set("page", "1")
  url.searchParams.set("page_size", "200")
  url.searchParams.set("sort_by", "tvl:desc")

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    throw new Error(`Meteora ${protocol} pool fetch failed (${res.status})`)
  }

  const raw = (await res.json().catch(() => null)) as { data?: unknown[] } | null
  const rows = Array.isArray(raw?.data) ? raw.data : []

  return rows
    .map((row) => normalizePool(row as MeteoraPoolRecord, protocol))
    .filter((pool): pool is LiquidityPoolSnapshot => Boolean(pool))
    .filter((pool) => pool.tokenX.address === mint || pool.tokenY.address === mint)
}

function normalizePool(record: MeteoraPoolRecord, protocol: LiquidityPoolSnapshot["protocol"]): LiquidityPoolSnapshot | null {
  const tokenX = asRecord(record.token_x)
  const tokenY = asRecord(record.token_y)
  if (!tokenX || !tokenY) return null

  return {
    protocol,
    address: pickString(record, ["address"]) || "unknown",
    name: pickString(record, ["name"]) || "Unnamed Pool",
    launchpad: pickString(record, ["launchpad"]),
    tvlUsd: pickNumber(record, ["tvl"]) || 0,
    currentPrice: pickNumber(record, ["current_price"]),
    createdAt: pickNumber(record, ["created_at"]),
    tokenX: {
      address: pickString(tokenX, ["address"]) || "",
      symbol: pickString(tokenX, ["symbol"]) || "?",
      name: pickString(tokenX, ["name"]) || "Unknown Token",
      decimals: pickNumber(tokenX, ["decimals"]) || 0,
      priceUsd: pickNumber(tokenX, ["price"]),
      amount: pickNumber(record, ["token_x_amount"]) || 0,
    },
    tokenY: {
      address: pickString(tokenY, ["address"]) || "",
      symbol: pickString(tokenY, ["symbol"]) || "?",
      name: pickString(tokenY, ["name"]) || "Unknown Token",
      decimals: pickNumber(tokenY, ["decimals"]) || 0,
      priceUsd: pickNumber(tokenY, ["price"]),
      amount: pickNumber(record, ["token_y_amount"]) || 0,
    },
    config: {
      minPrice: pickNestedNumber(record, ["pool_config", "min_price"]),
      maxPrice: pickNestedNumber(record, ["pool_config", "max_price"]),
      concentratedLiquidity: pickNestedBoolean(record, ["pool_config", "concentrated_liquidity"]),
    },
  }
}

async function fetchJupiterPriceUsd(mint: string): Promise<number | null> {
  try {
    const headers: Record<string, string> = { accept: "application/json" }
    if (JUPITER_API_KEY) {
      headers["x-api-key"] = JUPITER_API_KEY
    }

    const res = await fetch(`https://api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`, {
      method: "GET",
      cache: "no-store",
      headers,
    })

    if (!res.ok) return null

    const rows = (await res.json().catch(() => null)) as Array<Record<string, unknown>> | null
    const match = rows?.find((entry) => pickString(entry, ["id"]) === mint) || null
    return match ? pickNumber(match, ["usdPrice"]) : null
  } catch {
    return null
  }
}

function resolveTokenPrice(
  pools: LiquidityPoolSnapshot[],
  mint: string,
  fallbackPriceUsd?: number | null,
): number | null {
  const prices = pools.flatMap((pool) => {
    if (pool.tokenX.address === mint && pool.tokenX.priceUsd) return [{ price: pool.tokenX.priceUsd, weight: pool.tvlUsd }]
    if (pool.tokenY.address === mint && pool.tokenY.priceUsd) return [{ price: pool.tokenY.priceUsd, weight: pool.tvlUsd }]
    return []
  })

  const totalWeight = prices.reduce((sum, entry) => sum + entry.weight, 0)
  if (totalWeight > 0) {
    return Math.round((prices.reduce((sum, entry) => sum + entry.price * entry.weight, 0) / totalWeight) * 1_000_000) / 1_000_000
  }

  return fallbackPriceUsd ?? null
}

function buildRiskSignals(
  breakdown: ReturnType<typeof getLiquidityBreakdown>,
  impact100: ReturnType<typeof estimatePriceImpact>,
  impact1000: ReturnType<typeof estimatePriceImpact>,
) {
  const risks: Array<{ label: string; severity: "high" | "medium" | "info" }> = []

  if (breakdown.totalLiquidityUsd < 5_000) {
    risks.push({ label: "Low liquidity below $5k", severity: "high" })
  }
  if (breakdown.totalPoolCount <= 1) {
    risks.push({ label: "Single pool concentration", severity: "medium" })
  }
  if (breakdown.dlmmPoolCount === 0) {
    risks.push({ label: "No DLMM pool detected", severity: "medium" })
  }
  if ((impact1000?.priceImpactPct || 0) > 5 || (impact100?.priceImpactPct || 0) > 2) {
    risks.push({ label: "High slippage on simulated swaps", severity: "high" })
  }
  if (risks.length === 0) {
    risks.push({ label: "Liquidity structure looks stable", severity: "info" })
  }

  return risks
}

function getCacheHeaders() {
  return {
    "Cache-Control": "public, max-age=8, stale-while-revalidate=20",
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function pickString(source: Record<string, unknown> | null, keys: string[]): string | null {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function pickNumber(source: Record<string, unknown> | null, keys: string[]): number | null {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function pickNestedNumber(source: Record<string, unknown> | null, path: string[]): number | null {
  const value = pickNestedValue(source, path)
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function pickNestedBoolean(source: Record<string, unknown> | null, path: string[]): boolean | null {
  const value = pickNestedValue(source, path)
  return typeof value === "boolean" ? value : null
}

function pickNestedValue(source: Record<string, unknown> | null, path: string[]): unknown {
  let current: unknown = source
  for (const key of path) {
    if (!current || typeof current !== "object") return null
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function parseOptionalNumber(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}