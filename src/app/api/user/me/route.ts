import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const authUser = await getAuthUser(request)

  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      id: authUser.id,
      username: authUser.username || null,
      display_name: authUser.display_name || null,
      wallet: authUser.wallet || null,
      email: authUser.email || null,
      twitter_handle: authUser.twitter_handle || null,
    },
  })
}