import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { CreateAlertPayload } from "@/types/app"

export const dynamic = "force-dynamic"
export const revalidate = 0

const VALID_ALERT_TYPES = ["PRICE_DROP", "PRICE_RISE", "SCORE_CHANGE"]
const VALID_COMPARISON_TYPES = ["BELOW", "ABOVE", "CHANGE_BY_PERCENT"]

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from("price_alerts")
    .select("*")
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[api/alerts] GET", error)
    return NextResponse.json({ error: "Failed to load alerts" }, { status: 500 })
  }

  return NextResponse.json({ alerts: data || [] })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json()) as CreateAlertPayload
  const tokenAddress = body.token_address?.trim()
  const tokenName = body.token_name?.trim() || null
  const threshold = Number(body.threshold)

  if (!tokenAddress || !body.alert_type || !body.comparison_type || Number.isNaN(threshold)) {
    return NextResponse.json({ error: "Missing required alert fields" }, { status: 400 })
  }

  if (!VALID_ALERT_TYPES.includes(body.alert_type)) {
    return NextResponse.json({ error: "Invalid alert type" }, { status: 400 })
  }

  if (!VALID_COMPARISON_TYPES.includes(body.comparison_type)) {
    return NextResponse.json({ error: "Invalid comparison type" }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from("price_alerts")
    .insert({
      user_id: session.user.id,
      token_address: tokenAddress,
      token_name: tokenName,
      alert_type: body.alert_type,
      comparison_type: body.comparison_type,
      threshold,
      is_active: true,
      trigger_count: 0,
    })
    .select()
    .single()

  if (error) {
    console.error("[api/alerts] POST", error)
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 })
  }

  return NextResponse.json({ alert: data })
}
