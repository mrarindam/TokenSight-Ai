import { NextResponse } from "next/server"
import { getGlobalPlatformStats } from "@/lib/scan-analytics"

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STATS_CACHE_TTL_MS = 60 * 1000
const STATS_CACHE_CONTROL = "public, max-age=15, stale-while-revalidate=45"

type StatsPayload = Awaited<ReturnType<typeof getGlobalPlatformStats>>

let statsCache: { data: StatsPayload; fetchedAt: number } | null = null
let statsRequest: Promise<StatsPayload> | null = null

export async function GET() {
  try {
    if (statsCache && Date.now() - statsCache.fetchedAt < STATS_CACHE_TTL_MS) {
      return NextResponse.json(statsCache.data, {
        headers: { "Cache-Control": STATS_CACHE_CONTROL },
      })
    }

    if (!statsRequest) {
      statsRequest = getGlobalPlatformStats()
    }

    const stats = await statsRequest
    statsCache = { data: stats, fetchedAt: Date.now() }
    statsRequest = null

    return NextResponse.json(stats, {
      headers: { "Cache-Control": STATS_CACHE_CONTROL },
    })
  } catch (error) {
    statsRequest = null
    console.error("[api/stats] Failed to fetch global stats:", error)

    if (statsCache) {
      return NextResponse.json(statsCache.data, {
        headers: { "Cache-Control": STATS_CACHE_CONTROL },
      })
    }

    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
