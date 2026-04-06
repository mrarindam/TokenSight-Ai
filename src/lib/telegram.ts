const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

if (!TELEGRAM_BOT_TOKEN) {
  console.warn("[Telegram] TELEGRAM_BOT_TOKEN is not configured")
}

export interface TelegramMessage {
  chat_id: number | string
  text: string
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2"
}

/**
 * Send a message via Telegram bot
 */
export async function sendTelegramMessage(message: TelegramMessage) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[Telegram] Bot token not configured, skipping send")
    return { success: false, error: "Bot token not configured" }
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: message.chat_id,
        text: message.text,
        parse_mode: message.parse_mode || "HTML",
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("[Telegram] Send failed:", data)
      return { success: false, error: data.description || "Failed to send" }
    }

    return { success: true }
  } catch (error) {
    console.error("[Telegram] Error:", error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Format alert notification
 */
export function formatAlertMessage(alertData: {
  token_name: string
  token_address: string
  alert_type: string
  threshold: number
  current_value: number
  change_percent: number
}) {
  const emoji =
    alertData.alert_type === "PRICE_DROP"
      ? "📉"
      : alertData.alert_type === "PRICE_RISE"
        ? "📈"
        : "⚠️"

  return `
${emoji} <b>TokenSight Alert</b>

<b>Token:</b> ${alertData.token_name}
<b>Type:</b> ${alertData.alert_type.replace(/_/g, " ")}

<b>Threshold:</b> $${alertData.threshold.toFixed(4)}
<b>Current:</b> $${alertData.current_value.toFixed(4)}
<b>Change:</b> ${(alertData.change_percent > 0 ? "+" : "") + alertData.change_percent.toFixed(2)}%

🔗 <a href="https://tokensightai.tech/scan?token=${alertData.token_address}">View Analysis</a>
  `.trim()
}

/**
 * Extract Telegram user ID from message
 */
export function extractUserIdFromUpdate(update: any): string | null {
  return update.message?.from?.id?.toString() || null
}
