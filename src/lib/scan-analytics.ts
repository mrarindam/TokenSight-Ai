import { supabaseAdmin } from "@/lib/supabaseAdmin"

export type LeaderboardEntry = {
  user_id: string
  total_scans: number
  detection_rate: number
  streak: number
  rank: number
  users: {
    display_name: string | null
    avatar_url: string | null
    wallet: string | null
  }
}

export type GlobalPlatformStats = {
  total_scans: number
  monthly_scans: number
  total_users: number
}

function getStartOfCurrentMonthIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()
}

export async function getGlobalPlatformStats(): Promise<GlobalPlatformStats> {
  const monthStartIso = getStartOfCurrentMonthIso()

  const [
    totalScansResult,
    monthlyScansResult,
    totalUsersResult,
  ] = await Promise.all([
    supabaseAdmin.from("scans").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("scans").select("id", { count: "exact", head: true }).gte("created_at", monthStartIso),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
  ])

  if (totalScansResult.error) throw totalScansResult.error
  if (monthlyScansResult.error) throw monthlyScansResult.error
  if (totalUsersResult.error) throw totalUsersResult.error

  return {
    total_scans: totalScansResult.count || 0,
    monthly_scans: monthlyScansResult.count || 0,
    total_users: totalUsersResult.count || 0,
  }
}

export async function getLeaderboardEntries(): Promise<LeaderboardEntry[]> {
  const [usersResult, userStatsResult, scansResult] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("id, display_name, avatar_url, wallet, username"),
    supabaseAdmin
      .from("user_stats")
      .select("user_id, detection_rate, streak"),
    supabaseAdmin
      .from("scans")
      .select("user_id")
      .not("user_id", "is", null),
  ])

  if (usersResult.error) throw usersResult.error
  if (userStatsResult.error) throw userStatsResult.error
  if (scansResult.error) throw scansResult.error

  const countsByUser = new Map<string, number>()
  for (const scan of scansResult.data || []) {
    const userId = scan.user_id
    if (!userId || typeof userId !== "string") continue
    countsByUser.set(userId, (countsByUser.get(userId) || 0) + 1)
  }

  const statsByUser = new Map(
    (userStatsResult.data || []).map((row) => [
      row.user_id,
      {
        detection_rate: Number(row.detection_rate || 0),
        streak: Number(row.streak || 0),
      },
    ]),
  )

  const entries = (usersResult.data || []).map((user) => {
    const stats = statsByUser.get(user.id)

    return {
      user_id: user.id,
      total_scans: countsByUser.get(user.id) || 0,
      detection_rate: stats?.detection_rate || 0,
      streak: stats?.streak || 0,
      rank: 0,
      users: {
        display_name: user.display_name || user.username || null,
        avatar_url: user.avatar_url || null,
        wallet: user.wallet || null,
      },
    }
  })

  return entries
    .sort((left, right) => {
      if (right.total_scans !== left.total_scans) return right.total_scans - left.total_scans
      if (right.detection_rate !== left.detection_rate) return right.detection_rate - left.detection_rate
      if (right.streak !== left.streak) return right.streak - left.streak
      return left.user_id.localeCompare(right.user_id)
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))
}