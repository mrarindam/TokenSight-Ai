import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { deleteCached } from "@/lib/redis"
import { getSubscriptionExpirationDate } from "@/lib/premium"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const trackId = searchParams.get("trackId") || searchParams.get("track_id")
    if (!trackId) {
      return NextResponse.json({ error: "Missing trackId parameter" }, { status: 400 })
    }

    const OXAPAY_KEY = process.env.OXAPAY_MERCHANT_API_KEY
    if (!OXAPAY_KEY) {
      return NextResponse.json(
        { error: "OxaPay Merchant API key is not configured on the server." },
        { status: 500 }
      )
    }

    const response = await fetch(`https://api.oxapay.com/v1/payment/${trackId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "merchant_api_key": OXAPAY_KEY
      }
    })

    const data = await response.json()
    if (!response.ok || data.status !== 200) {
      console.error("[OxaPay Status Check Error]:", data)
      return NextResponse.json(
        { error: data.message || "Failed to query payment status from OxaPay" },
        { status: response.status || 400 }
      )
    }

    const paymentInfo = data.data || {}
    const status = (paymentInfo.status || "").toLowerCase()
    const orderId = paymentInfo.orderId || paymentInfo.order_id

    // Cross-verify order_id to prevent transaction hijacking / BOLA attacks
    if (status === "paid" && orderId !== authUser.id) {
      console.warn(`[OxaPay Security Warning]: User ${authUser.id} attempted to check status of invoice belonging to user ${orderId}`)
      return NextResponse.json({ error: "Unauthorized: Transaction order mismatch" }, { status: 403 })
    }

    const isPaid = status === "paid" && orderId === authUser.id

    if (isPaid) {
      const expiresAt = getSubscriptionExpirationDate(30)
      const { error: dbError } = await supabaseAdmin
        .from("users")
        .update({
          is_premium: true,
          premium_expires_at: expiresAt
        })
        .eq("id", authUser.id)

      if (dbError) {
        console.error("[OxaPay status check API] DB Error:", dbError)
        return NextResponse.json({ error: "Payment verified, but database update failed: " + dbError.message }, { status: 500 })
      }

      const cacheKey = `user_profile:${authUser.id}`
      await deleteCached(cacheKey)
    }

    return NextResponse.json({
      success: true,
      status,
      isPremium: isPaid
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error("[api/billing/oxapay/status] Error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
