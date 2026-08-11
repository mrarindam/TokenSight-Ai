import { createHmac } from "crypto"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { deleteCached } from "@/lib/redis"
import { getSubscriptionExpirationDate } from "@/lib/premium"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const OXAPAY_KEY = process.env.OXAPAY_MERCHANT_API_KEY
    if (!OXAPAY_KEY) {
      console.error("[OxaPay Webhook Error]: Merchant key not configured in environment variables.")
      return new Response("OxaPay webhook secret is missing", { status: 500 })
    }

    const signature = request.headers.get("hmac") || request.headers.get("HMAC")
    if (!signature) {
      console.warn("[OxaPay Webhook Warning]: Request is missing HMAC signature header.")
      return new Response("Missing signature", { status: 400 })
    }

    // Get the raw POST body to compute the HMAC
    const rawBody = await request.text()

    // Compute HMAC-SHA512 of raw text using OXAPAY_KEY
    const computedHmac = createHmac("sha512", OXAPAY_KEY)
      .update(rawBody)
      .digest("hex")

    if (computedHmac.toLowerCase() !== signature.toLowerCase()) {
      console.warn("[OxaPay Webhook Warning]: HMAC signature mismatch.", {
        received: signature,
        computed: computedHmac
      })
      return new Response("Invalid signature", { status: 401 })
    }

    const payload = JSON.parse(rawBody)
    const rawStatus = (payload.status || payload.payment_status || "").toString().toLowerCase()
    const userId = payload.orderId || payload.order_id || payload.order_Id

    console.log(`[OxaPay Webhook]: Received valid payment callback for user ID: ${userId}, status: ${rawStatus}`)

    const PAID_STATUSES = ["paid", "complete", "completed", "manual_accept"]

    if (PAID_STATUSES.includes(rawStatus) && userId) {
      const expiresAt = getSubscriptionExpirationDate(30)

      // 1. Direct update to target user ID (bulletproof)
      const { error: dbError } = await supabaseAdmin
        .from("users")
        .update({
          is_premium: true,
          premium_expires_at: expiresAt
        })
        .eq("id", userId)

      if (dbError) {
        console.error("[OxaPay Webhook Error] Supabase DB Update Failed:", dbError)
        return new Response("Database update failed", { status: 500 })
      }

      // 2. Fetch target user info to update sibling accounts if duplicates exist
      const { data: targetUser } = await supabaseAdmin
        .from("users")
        .select("id, email, privy_id")
        .eq("id", userId)
        .maybeSingle()

      if (targetUser?.email || targetUser?.privy_id) {
        const siblingIds: string[] = []

        if (targetUser.email) {
          const { data: emailMatches } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", targetUser.email)

          if (emailMatches) {
            for (const m of emailMatches) {
              if (m.id !== userId) siblingIds.push(m.id)
            }
          }
        }

        if (targetUser.privy_id) {
          const { data: privyMatches } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("privy_id", targetUser.privy_id)

          if (privyMatches) {
            for (const m of privyMatches) {
              if (m.id !== userId && !siblingIds.includes(m.id)) siblingIds.push(m.id)
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

      // Invalidate Redis profile cache for target user
      await deleteCached(`user_profile:${userId}`).catch(() => {})
      console.log(`[OxaPay Webhook]: Successfully activated Premium tier for user ID: ${userId} until ${expiresAt}`)
    }

    // Respond to OxaPay with exactly "ok" to acknowledge receipt of webhook
    return new Response("ok", {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error("[OxaPay Webhook Error]: Unexpected exception occurred:", err)
    return new Response("Internal server error", { status: 500 })
  }
}
