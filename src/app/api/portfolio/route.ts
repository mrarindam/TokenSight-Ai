import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { CreatePortfolioPayload } from "@/types/app"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from("user_portfolios")
    .select("*")
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[api/portfolio] GET", error)
    return NextResponse.json({ error: "Failed to load portfolio" }, { status: 500 })
  }

  return NextResponse.json({ portfolio: data || [] })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json()) as CreatePortfolioPayload
  const tokenAddress = body.token_address?.trim()
  const tokenName = body.token_name?.trim()
  const quantity = Number(body.quantity)
  const entryPrice = Number(body.entry_price)

  if (!tokenAddress || !tokenName || !quantity || !entryPrice) {
    return NextResponse.json({ error: "Missing required portfolio fields" }, { status: 400 })
  }

  const payload = {
    user_id: session.user.id,
    token_address: tokenAddress,
    token_name: tokenName,
    token_symbol: body.token_symbol?.trim() || null,
    quantity,
    entry_price: entryPrice,
    current_price: null,
    status: "HOLDING",
    risk_level: body.risk_level?.trim() || "MEDIUM",
    notes: body.notes?.trim() || null,
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("user_portfolios")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("token_address", tokenAddress)
    .eq("status", "HOLDING")
    .single()

  if (existingError && existingError.code !== "PGRST116") {
    console.error("[api/portfolio] check existing", existingError)
    return NextResponse.json({ error: "Portfolio operation failed" }, { status: 500 })
  }

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("user_portfolios")
      .update({ quantity, entry_price: entryPrice, risk_level: payload.risk_level, notes: payload.notes, updated_at: new Date().toISOString() })
      .eq("id", existing.id)

    if (error) {
      console.error("[api/portfolio] update", error)
      return NextResponse.json({ error: "Failed to update portfolio" }, { status: 500 })
    }

    return NextResponse.json({ portfolio: data?.[0] || null })
  }

  const { data, error } = await supabaseAdmin
    .from("user_portfolios")
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error("[api/portfolio] insert", error)
    return NextResponse.json({ error: "Failed to add portfolio entry" }, { status: 500 })
  }

  return NextResponse.json({ portfolio: data })
}
