import { NextResponse } from "next/server"
import { getGlobalPlatformStats } from "@/lib/scan-analytics"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const stats = await getGlobalPlatformStats()

    return NextResponse.json(stats, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    })
  } catch (error) {
    console.error("[api/stats] Failed to fetch global stats:", error)

    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
