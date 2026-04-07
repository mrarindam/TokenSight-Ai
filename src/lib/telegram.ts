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

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined
}

function formatUsdValue(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value < 1 ? 6 : 2,
    maximumFractionDigits: 9,
  })
}

function formatReadableTokenPrice(value: number) {
  if (value >= 1) {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
  }
  if (value >= 0.01) {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`
  }

  const decimals = value >= 0.0001 ? 8 : value >= 0.000001 ? 10 : 12
  const fixed = value.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "")
  return `$${fixed}`
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

<b>Threshold:</b> $${formatUsdValue(alertData.threshold)}
<b>Current:</b> $${formatUsdValue(alertData.current_value)}
<b>Change:</b> ${(alertData.change_percent > 0 ? "+" : "") + alertData.change_percent.toFixed(2)}%

🔗 <a href="https://tokensightai.tech/scan?token=${alertData.token_address}">View Analysis</a>
  `.trim()
}

/**
 * Extract Telegram user ID from message
 */
export function extractUserIdFromUpdate(update: Record<string, unknown>): string | null {
  const message = getRecord(update.message)
  const editedMessage = getRecord(update.edited_message)
  const callbackQuery = getRecord(update.callback_query)
  const myChatMember = getRecord(update.my_chat_member)

  const from = getRecord(message?.from)
    ?? getRecord(editedMessage?.from)
    ?? getRecord(callbackQuery?.from)
    ?? getRecord(myChatMember?.from)

  return from?.id?.toString() || null
}

export function extractChatIdFromUpdate(update: Record<string, unknown>): string | null {
  const message = getRecord(update.message)
  const editedMessage = getRecord(update.edited_message)
  const callbackQuery = getRecord(update.callback_query)
  const myChatMember = getRecord(update.my_chat_member)

  const chat = getRecord(message?.chat)
    ?? getRecord(editedMessage?.chat)
    ?? getRecord(getRecord(callbackQuery?.message)?.chat)
    ?? getRecord(myChatMember?.chat)

  return chat?.id?.toString() || null
}

/**
 * Format a scan result for Telegram notification
 */
export function formatScanMessage(data: {
  tokenName: string
  tokenSymbol: string
  address: string
  score: number
  label: string
  confidence: string
  signals: string[]
  liquidity: number | null
  volume: number | null
  holders: number | null
  price: number | null
  topHolderPct: number | null
  whaleWarning: boolean
}): string {
  const scoreEmoji = data.score >= 80 ? "🟢" : data.score >= 60 ? "🟡" : data.score >= 35 ? "🟠" : "🔴"
  const whaleIcon = data.whaleWarning ? "🐋 " : ""

  const priceStr = data.price !== null ? formatReadableTokenPrice(data.price) : "N/A"
  const liqStr = data.liquidity !== null ? `$${data.liquidity.toLocaleString()}` : "N/A"
  const volStr = data.volume !== null ? `$${data.volume.toLocaleString()}` : "N/A"
  const holdersStr = data.holders !== null ? data.holders.toLocaleString() : "N/A"
  const whaleStr = data.topHolderPct !== null ? `${data.topHolderPct}%` : "N/A"

  const topSignals = data.signals.slice(0, 4).map(s => `  • ${s}`).join("\n")

  return `
${scoreEmoji} <b>TokenSight Scan Result</b>

<b>${data.tokenName}</b> (${data.tokenSymbol})
<code>${data.address}</code>

📊 <b>Score:</b> ${data.score}/100 — ${data.label}
🎯 <b>Confidence:</b> ${data.confidence}

💰 <b>Price:</b> ${priceStr}
💧 <b>Liquidity:</b> ${liqStr}
📈 <b>Volume 24h:</b> ${volStr}
👥 <b>Holders:</b> ${holdersStr}
${whaleIcon}<b>Top 10 Holders:</b> ${whaleStr}

<b>Signals:</b>
${topSignals}

🔗 <a href="https://dexscreener.com/solana/${data.address}">Chart</a> · <a href="https://tokensightai.tech/scan?address=${data.address}">Full Analysis</a>
  `.trim()
}
