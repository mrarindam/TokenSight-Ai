export async function DELETE(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await request.json()
  if (!id) {
    return NextResponse.json({ error: "Missing portfolio entry ID" }, { status: 400 })
  }
  const { error } = await supabaseAdmin
    .from("user_portfolios")
    .delete()
    .eq("id", id)
    .eq("user_id", authUser.id)
  if (error) {
    console.error("[api/portfolio] delete", error)
    return NextResponse.json({ error: "Failed to delete portfolio entry" }, { status: 500 })
  }
  
  const cacheKey = `user_portfolio:${authUser.id}`
  await deleteCached(cacheKey)

  return NextResponse.json({ success: true })
}
import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { isValidSolanaAddress } from "@/lib/utils"
import type { CreatePortfolioPayload } from "@/types/app"
import { getCached, setCached, deleteCached } from "@/lib/redis"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cacheKey = `user_portfolio:${authUser.id}`
  const cachedData = await getCached<unknown[]>(cacheKey)
  if (cachedData) {
    return NextResponse.json({ portfolio: cachedData })
  }

  const { data, error } = await supabaseAdmin
    .from("user_portfolios")
    .select("*")
    .eq("user_id", authUser.id)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[api/portfolio] GET", error)
    return NextResponse.json({ error: "Failed to load portfolio" }, { status: 500 })
  }

  if (data) {
    await setCached(cacheKey, data, 300)
  }

  return NextResponse.json({ portfolio: data || [] })
}

export async function POST(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser?.id) {
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

  if (!isValidSolanaAddress(tokenAddress)) {
    return NextResponse.json({ error: "Only Solana or SVM token addresses are allowed in portfolio" }, { status: 400 })
  }

  const payload = {
    user_id: authUser.id,
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

  const { data: dbUser } = await supabaseAdmin
    .from("users")
    .select("is_premium")
    .eq("id", authUser.id)
    .maybeSingle()

  const isPremium = dbUser?.is_premium || false

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("user_portfolios")
    .select("*")
    .eq("user_id", authUser.id)
    .eq("token_address", tokenAddress)
    .eq("status", "HOLDING")
    .single()

  if (existingError && existingError.code !== "PGRST116") {
    console.error("[api/portfolio] check existing", existingError)
    return NextResponse.json({ error: "Portfolio operation failed" }, { status: 500 })
  }

  // Check limit only if inserting a new item
  if (!existing && !isPremium) {
    const { count } = await supabaseAdmin
      .from("user_portfolios")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUser.id)
      .eq("status", "HOLDING")

    if (count !== null && count >= 2) {
      return NextResponse.json({
        error: "Portfolio limit reached. Free tier is limited to 2 tokens. Upgrade to Premium for unlimited portfolio additions.",
        code: "PORTFOLIO_LIMIT_REACHED"
      }, { status: 403 })
    }
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

    const cacheKey = `user_portfolio:${authUser.id}`
    await deleteCached(cacheKey)

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

  const cacheKey = `user_portfolio:${authUser.id}`
  await deleteCached(cacheKey)

  return NextResponse.json({ portfolio: data })
}
