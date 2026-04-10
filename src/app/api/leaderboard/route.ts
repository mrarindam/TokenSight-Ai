import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { getLeaderboardEntries } from "@/lib/scan-analytics"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: Request) {
  try {
    const authUser = await getAuthUser(req)

    if (!authUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

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