import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // We'll use a more direct query approach to bypass any potential Supabase SDK count glitches
    
    // 1. Get ALL scans for lifetime count
    const { data: allScans, error: scansError } = await supabase
      .from("scans")
      .select("id")

    if (scansError) throw scansError
    const totalScans = allScans?.length || 0

    // 2. Get monthly scans (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: monthlyData, error: monthlyError } = await supabase
      .from("scans")
      .select("id")
      .gte("created_at", thirtyDaysAgo)

    if (monthlyError) throw monthlyError
    const monthlyScans = monthlyData?.length || 0

    // 3. Get total registered users
    const { data: userData, error: usersError } = await supabase
      .from("users")
      .select("id")

    if (usersError) throw usersError
    const totalUsers = userData?.length || 0

    return NextResponse.json({
      total_scans: totalScans,
      monthly_scans: monthlyScans,
      total_users: totalUsers,
    })
  } catch (error) {
    console.error("[api/stats] Failed to fetch global stats:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
