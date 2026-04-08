import { NextResponse } from "next/server"
import { getLeaderboardEntries } from "@/lib/scan-analytics"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const leaderboard = await getLeaderboardEntries()

    return NextResponse.json({
      leaderboard: leaderboard.slice(0, 50),
      total: leaderboard.length,
    })
  } catch (error) {
    console.error("[api/leaderboard] Failed to load leaderboard:", error)
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 })
  }
}