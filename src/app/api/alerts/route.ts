import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { sendTelegramMessage } from "@/lib/telegram"
import type { CreateAlertPayload } from "@/types/app"

export const dynamic = "force-dynamic"
export const revalidate = 0

const VALID_ALERT_TYPES = ["PRICE_DROP", "PRICE_RISE", "SCORE_CHANGE"]
const VALID_COMPARISON_TYPES = ["BELOW", "ABOVE", "CHANGE_BY_PERCENT"]

async function notifyUser(userId: string, text: string) {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("telegram_id")
    .eq("id", userId)
    .maybeSingle()

  if (!user?.telegram_id) {
    return
  }

  await sendTelegramMessage({
    chat_id: user.telegram_id,
    text,
  })
}

export async function GET(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from("price_alerts")
    .select("*")
    .eq("user_id", authUser.id)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[api/alerts] GET", error)
    return NextResponse.json({ error: "Failed to load alerts" }, { status: 500 })
  }

  return NextResponse.json({ alerts: data || [] })
}

export async function POST(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser?.id) {
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
      user_id: authUser.id,
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

  if (data) {
    notifyUser(
      authUser.id,
      `✅ <b>Alert Created</b>\n\nYour alert for <b>${data.token_name || data.token_address}</b> has been created successfully.`
    )
  }

  return NextResponse.json({ alert: data })
}

export async function DELETE(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const alertId = body.alert_id?.toString?.().trim()

  if (!alertId) {
    return NextResponse.json({ error: "Alert ID required" }, { status: 400 })
  }

  const { data: alert, error: fetchError } = await supabaseAdmin
    .from("price_alerts")
    .select("id, token_address, token_name")
    .eq("id", alertId)
    .eq("user_id", authUser.id)
    .single()

  if (fetchError || !alert) {
    console.error("[api/alerts] DELETE fetch", fetchError)
    return NextResponse.json({ error: "Alert not found" }, { status: 404 })
  }

  const { error: deleteError } = await supabaseAdmin
    .from("price_alerts")
    .delete()
    .eq("id", alertId)

  if (deleteError) {
    console.error("[api/alerts] DELETE", deleteError)
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 })
  }

  notifyUser(
    authUser.id,
    `🗑️ <b>Alert Deleted</b>\n\nYour alert for <b>${alert.token_name || alert.token_address}</b> has been removed.`
  )

  return NextResponse.json({ deleted: true })
}
