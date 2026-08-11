import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { deleteCached } from "@/lib/redis"
import { getSubscriptionExpirationDate } from "@/lib/premium"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
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

    // Try optional auth user resolution (non-blocking)
    const authUser = await getAuthUser(request).catch(() => null)

    let rawStatus = ""
    let orderId = ""
    let isApiSuccess = false

    // 1. Method 1: OxaPay v1 GET endpoint
    try {
      const response = await fetch(`https://api.oxapay.com/v1/payment/${trackId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "merchant_api_key": OXAPAY_KEY
        },
        cache: "no-store"
      })

      if (response.ok) {
        const data = await response.json()
        const paymentInfo = data.data || data.result || data || {}
        rawStatus = (paymentInfo.status || data.status || "").toString().toLowerCase()
        orderId = (paymentInfo.order_id || paymentInfo.orderId || data.order_id || data.orderId || "").toString()
        if (data.status === 200 || data.result === 100 || rawStatus) {
          isApiSuccess = true
        }
      }
    } catch (e) {
      console.warn("[OxaPay Status Check] v1 API call exception:", e)
    }

    // 2. Method 2: OxaPay legacy merchants/inquiry POST fallback
    if (!isApiSuccess || !rawStatus) {
      try {
        const trackIdNum = parseInt(trackId, 10)
        const response = await fetch("https://api.oxapay.com/merchants/inquiry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchant: OXAPAY_KEY,
            trackId: isNaN(trackIdNum) ? trackId : trackIdNum
          }),
          cache: "no-store"
        })

        if (response.ok) {
          const data = await response.json()
          rawStatus = (data.status || data.payStatus || data.payment_status || "").toString().toLowerCase()
          orderId = (data.order_id || data.orderId || orderId || "").toString()
          if (data.result === 100 || data.status === 200 || rawStatus) {
            isApiSuccess = true
          }
        }
      } catch (e) {
        console.warn("[OxaPay Status Check] Legacy inquiry call exception:", e)
      }
    }

    const PAID_STATUSES = ["paid", "complete", "completed", "manual_accept"]
    const isPaidStatus = PAID_STATUSES.includes(rawStatus)

    // Determine target user ID to upgrade
    const targetUserId = authUser?.id || orderId

    if (isPaidStatus && targetUserId) {
      const expiresAt = getSubscriptionExpirationDate(30)
      
      // 1. Direct update to target user ID
      const { error: dbError } = await supabaseAdmin
        .from("users")
        .update({
          is_premium: true,
          premium_expires_at: expiresAt
        })
        .eq("id", targetUserId)

      if (dbError) {
        console.error("[OxaPay status check API] DB Error:", dbError)
      }

      // 2. Fetch user details to update duplicate sibling accounts by email or privy_id
      const { data: userRec } = await supabaseAdmin
        .from("users")
        .select("id, email, privy_id")
        .eq("id", targetUserId)
        .maybeSingle()

      const emailToMatch = authUser?.email || userRec?.email
      const privyToMatch = authUser?.privy_id || userRec?.privy_id

      if (emailToMatch || privyToMatch) {
        const siblingIds: string[] = []

        if (emailToMatch) {
          const { data: emailMatches } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", emailToMatch)

          if (emailMatches) {
            for (const m of emailMatches) {
              if (m.id !== targetUserId) siblingIds.push(m.id)
            }
          }
        }

        if (privyToMatch) {
          const { data: privyMatches } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("privy_id", privyToMatch)

          if (privyMatches) {
            for (const m of privyMatches) {
              if (m.id !== targetUserId && !siblingIds.includes(m.id)) siblingIds.push(m.id)
            }
          }
        }

        if (siblingIds.length > 0) {
          await supabaseAdmin
            .from("users")
            .update({
              is_premium: true,
              premium_expires_at: expiresAt
            })
            .in("id", siblingIds)
        }
      }

      // Invalidate Redis profile cache
      await deleteCached(`user_profile:${targetUserId}`).catch(() => {})
      if (authUser?.id && authUser.id !== targetUserId) {
        await deleteCached(`user_profile:${authUser.id}`).catch(() => {})
      }
    }

    return NextResponse.json({
      success: true,
      status: rawStatus,
      isPremium: isPaidStatus,
      orderId: targetUserId
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error("[api/billing/oxapay/status] Error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
