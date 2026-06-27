import { NextResponse } from "next/server"
import { getGlobalPlatformStats } from "@/lib/scan-analytics"
import { getCached, setCached } from "@/lib/redis"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const cacheKey = "global_platform_stats"
    const cachedStats = await getCached<unknown>(cacheKey)
    if (cachedStats) {
      return NextResponse.json(cachedStats, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      })
    }

    const stats = await getGlobalPlatformStats()
    if (stats) {
      await setCached(cacheKey, stats, 60)
    }

    return NextResponse.json(stats, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    })
  } catch (error) {
    console.error("[api/stats] Failed to fetch global stats:", error)

    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
