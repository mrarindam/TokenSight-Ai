import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { deleteCached } from "@/lib/redis"
import { getSubscriptionExpirationDate } from "@/lib/premium"

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const expiresAt = getSubscriptionExpirationDate(30)
    // Attempt to set is_premium = true and premium_expires_at in Supabase users table
    const { error } = await supabaseAdmin
      .from("users")
      .update({
        is_premium: true,
        premium_expires_at: expiresAt
      })
      .eq("id", authUser.id)

    if (error) {
      console.error("[api/billing/mock-success] DB Error:", error)
      return NextResponse.json({ 
        error: "Failed to update premium status. Please make sure you have added the 'is_premium' column to your Supabase 'users' table.",
        details: error.message
      }, { status: 500 })
    }

    // Invalidate Redis profile cache to force immediate UI reload
    const cacheKey = `user_profile:${authUser.id}`
    await deleteCached(cacheKey)

    return NextResponse.json({ success: true, isPremium: true })
  } catch (error: unknown) {
    const err = error as Error
    console.error("[api/billing/mock-success] Unexpected error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
