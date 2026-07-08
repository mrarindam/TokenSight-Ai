import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const OXAPAY_KEY = process.env.OXAPAY_MERCHANT_API_KEY
    if (!OXAPAY_KEY) {
      return NextResponse.json(
        { error: "OxaPay Merchant API key is not configured on the server. Please add OXAPAY_MERCHANT_API_KEY to your environment variables." },
        { status: 500 }
      )
    }

    const appUrl = process.env.APP_URL || "http://localhost:3000"

    const response = await fetch("https://api.oxapay.com/v1/payment/invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "merchant_api_key": OXAPAY_KEY
      },
      body: JSON.stringify({
        amount: 2.00,
        currency: "USD",
        lifeTime: 30,
        lifetime: 30,
        feePaidByPayer: 1,
        fee_paid_by_payer: 1,
        orderId: authUser.id,
        order_id: authUser.id,
        description: "TokenSight AI Premium - 1 Month",
        callbackUrl: `${appUrl}/api/billing/oxapay/webhook`,
        callback_url: `${appUrl}/api/billing/oxapay/webhook`,
        returnUrl: `${appUrl}/pricing?payment=success`,
        return_url: `${appUrl}/pricing?payment=success`
      })
    })

    const data = await response.json()
    if (!response.ok || data.status !== 200) {
      console.error("[OxaPay Create Payment Error]:", data)
      return NextResponse.json(
        { error: data.message || "Failed to initiate payment session with OxaPay" },
        { status: response.status || 400 }
      )
    }

    const payData = data.data || {}
    return NextResponse.json({
      trackId: payData.trackId || payData.track_id,
      payLink: payData.payLink || payData.pay_link || payData.payUrl || payData.pay_url || payData.payment_url || payData.paymentUrl,
      amount: payData.amount,
      currency: payData.currency
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error("[api/billing/oxapay/create-payment] Error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
