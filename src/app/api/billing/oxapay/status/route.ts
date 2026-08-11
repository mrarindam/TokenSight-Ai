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
    const rawStatus = (paymentInfo.status || "").toString().toLowerCase()
    const orderId = paymentInfo.orderId || paymentInfo.order_id

    const PAID_STATUSES = ["paid", "complete", "completed", "manual_accept"]
    const isPaidStatus = PAID_STATUSES.includes(rawStatus)

    // Check if orderId matches authUser.id or belongs to the same user
    const userMatchesOrder = orderId === authUser.id || !orderId

    const isPaid = isPaidStatus && userMatchesOrder

    if (isPaid || isPaidStatus) {
      const expiresAt = getSubscriptionExpirationDate(30)
      
      let updateQuery = supabaseAdmin.from("users").update({
        is_premium: true,
        premium_expires_at: expiresAt
      })

      if (authUser.email && authUser.privy_id) {
        updateQuery = updateQuery.or(`id.eq.${authUser.id},email.eq.${authUser.email},privy_id.eq.${authUser.privy_id}`)
      } else if (authUser.email) {
        updateQuery = updateQuery.or(`id.eq.${authUser.id},email.eq.${authUser.email}`)
      } else {
        updateQuery = updateQuery.eq("id", authUser.id)
      }

      const { error: dbError } = await updateQuery

      if (dbError) {
        console.error("[OxaPay status check API] DB Error:", dbError)
        return NextResponse.json({ error: "Payment verified, but database update failed: " + dbError.message }, { status: 500 })
      }

      const cacheKey = `user_profile:${authUser.id}`
      await deleteCached(cacheKey)
    }

    return NextResponse.json({
      success: true,
      status: rawStatus,
      isPremium: isPaidStatus
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error("[api/billing/oxapay/status] Error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
