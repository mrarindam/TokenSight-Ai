import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { sendTelegramMessage, formatAlertMessage } from "@/lib/telegram"

export const runtime = "nodejs"
export const maxDuration = 60

interface DexScreenerResponse {
  pairs?: Array<{
    baseToken?: { address: string }
    priceUsd?: string
    volume?: { h24: number }
  }>
}

/**
 * Fetch current token price from DexScreener
 */
async function fetchTokenPrice(tokenAddress: string): Promise<number | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`)
    if (!response.ok) return null

    const data = (await response.json()) as DexScreenerResponse
    const pair = data.pairs?.[0]
    const price = pair?.priceUsd ? parseFloat(pair.priceUsd) : null

    return price
  } catch (error) {
    console.error("[CRON] Fetch price error:", error)
    return null
  }
}

/**
 * Check if alert should trigger
 */
function shouldTriggerAlert(
  currentValue: number,
  threshold: number,
  comparisonType: string
): boolean {
  switch (comparisonType) {
    case "BELOW":
      return currentValue < threshold
    case "ABOVE":
      return currentValue > threshold
    case "CHANGE_BY_PERCENT":
      const changePercent = ((currentValue - threshold) / threshold) * 100
      return Math.abs(changePercent) >= 5 // 5% change
    default:
      return false
  }
}

/**
 * Main cron job: Check all active alerts every 5 minutes
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = request.headers.get("x-vercel-cron") === "true"

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
    return NextResponse.json({ error: "Unauthorized cron" }, { status: 401 })
  }

  console.log("[CRON] Starting alert check...")

  try {
    // 1. Fetch all active alerts
    const { data: alerts, error: alertsError } = await supabaseAdmin
      .from("price_alerts")
      .select("*")
      .eq("is_active", true)

    if (alertsError) throw alertsError

    if (!alerts || alerts.length === 0) {
      console.log("[CRON] No active alerts")
      return NextResponse.json({ checked: 0, triggered: 0 })
    }

    console.log(`[CRON] Checking ${alerts.length} alerts...`)

    let triggeredCount = 0

    // 2. Check each alert
    for (const alert of alerts) {
      try {
        // Get current price
        const currentPrice = await fetchTokenPrice(alert.token_address)
        if (!currentPrice) {
          console.log(`[CRON] Could not fetch price for ${alert.token_address}`)
          continue
        }

        // Check if should trigger
        if (!shouldTriggerAlert(currentPrice, alert.threshold, alert.comparison_type)) {
          continue
        }

        console.log(
          `[CRON] Alert triggered for ${alert.token_name} (${alert.alert_type})`
        )

        // 3. Get user's Telegram ID
        const { data: user } = await supabaseAdmin
          .from("users")
          .select("telegram_id")
          .eq("id", alert.user_id)
          .maybeSingle()

        if (!user?.telegram_id) {
          console.log(`[CRON] User ${alert.user_id} has no Telegram linked`)
          continue
        }

        // 4. Send Telegram message
        const changePercent = ((currentPrice - alert.threshold) / alert.threshold) * 100
        const message = formatAlertMessage({
          token_name: alert.token_name || alert.token_address,
          token_address: alert.token_address,
          alert_type: alert.alert_type,
          threshold: alert.threshold,
          current_value: currentPrice,
          change_percent: changePercent,
        })

        const telegramResult = await sendTelegramMessage({
          chat_id: user.telegram_id,
          text: message,
        })

        if (telegramResult.success) {
          triggeredCount++

          // 5. Update alert with trigger info
          await supabaseAdmin
            .from("price_alerts")
            .update({
              trigger_count: (alert.trigger_count || 0) + 1,
              last_triggered_at: new Date().toISOString(),
            })
            .eq("id", alert.id)
        }
      } catch (err) {
        console.error(`[CRON] Error processing alert ${alert.id}:`, err)
      }
    }

    console.log(`[CRON] Complete. Triggered: ${triggeredCount}`)

    return NextResponse.json({
      checked: alerts.length,
      triggered: triggeredCount,
    })
  } catch (error) {
    console.error("[CRON] Fatal error:", error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
