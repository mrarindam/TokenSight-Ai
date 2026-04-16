import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const authUser = await getAuthUser(request)

  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: dbUser } = await supabaseAdmin
    .from("users")
    .select("id, username, display_name, avatar_url, wallet, email, twitter_handle")
    .eq("id", authUser.id)
    .maybeSingle()

  const resolvedUser = dbUser || authUser

  return NextResponse.json({
    user: {
      id: resolvedUser.id,
      username: resolvedUser.username || null,
      display_name: resolvedUser.display_name || null,
      avatar_url: resolvedUser.avatar_url || null,
      wallet: resolvedUser.wallet || null,
      email: resolvedUser.email || null,
      twitter_handle: resolvedUser.twitter_handle || null,
    },
  })
}
