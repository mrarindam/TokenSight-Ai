import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const page = Number(url.searchParams.get("page") || "1")
  const pageSize = Math.min(Number(url.searchParams.get("pageSize") || "20"), 50)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabaseAdmin
    .from("scans")
    .select("*", { count: "exact" })
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .range(from, to)

  if (error) {
    console.error("[api/scan/history]", error)
    return NextResponse.json(
      { error: "Failed to load scan history" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    scans: data || [],
    page,
    pageSize,
    total: count || 0,
  })
}
