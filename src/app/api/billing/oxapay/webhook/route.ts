import { createHmac } from "crypto"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { deleteCached } from "@/lib/redis"

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
    const status = (payload.status || "").toLowerCase()
    const userId = payload.orderId || payload.order_id

    console.log(`[OxaPay Webhook]: Received valid payment callback for user ID: ${userId}, status: ${status}`)

    if (status === "paid" && userId) {
      // Mark user as Premium in Supabase DB
      const { error: dbError } = await supabaseAdmin
        .from("users")
        .update({ is_premium: true })
        .eq("id", userId)

      if (dbError) {
        console.error("[OxaPay Webhook Error] Supabase DB Update Failed:", dbError)
        return new Response("Database update failed", { status: 500 })
      }

      // Invalidate Redis profile cache to instantly reflect changes
      const cacheKey = `user_profile:${userId}`
      await deleteCached(cacheKey)
      console.log(`[OxaPay Webhook]: Successfully activated Premium tier for user ID: ${userId}`)
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
