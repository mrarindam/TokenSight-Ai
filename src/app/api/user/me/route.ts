import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { getCached, setCached } from "@/lib/redis"
import { checkAndUpdatePremiumStatus } from "@/lib/premium"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const authUser = await getAuthUser(request)

  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cacheKey = `user_profile:${authUser.id}`
  const cachedUser = await getCached<unknown>(cacheKey)
  if (cachedUser) {
    return NextResponse.json({ user: cachedUser })
  }

  const { data: dbUser } = await supabaseAdmin
    .from("users")
    .select("id, username, display_name, avatar_url, wallet, email, twitter_handle, is_premium, premium_expires_at")
    .eq("id", authUser.id)
    .maybeSingle()

  const resolvedUser = dbUser || authUser
  const { isPremium, expiresAt } = await checkAndUpdatePremiumStatus(authUser.id, dbUser || {})

  const userResponse = {
    id: resolvedUser.id,
    username: resolvedUser.username || null,
    display_name: resolvedUser.display_name || null,
    avatar_url: resolvedUser.avatar_url || null,
    wallet: resolvedUser.wallet || null,
    email: resolvedUser.email || null,
    twitter_handle: resolvedUser.twitter_handle || null,
    is_premium: isPremium,
    premium_expires_at: expiresAt,
  }

  await setCached(cacheKey, userResponse, 300)

  return NextResponse.json({ user: userResponse })
}
