import nacl from "tweetnacl"

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || ""
const DISCORD_API_URL = "https://discord.com/api/v10"

if (!DISCORD_BOT_TOKEN) {
  console.warn("[Discord] DISCORD_BOT_TOKEN is not configured")
}

export interface DiscordMessage {
  content: string
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
 * Verify Ed25519 signature from Discord Interactions
 */
export function verifyDiscordSignature(
  body: string | Buffer,
  signature: string,
  timestamp: string,
  publicKey: string
): boolean {
  if (!signature || !timestamp || !publicKey) return false
  try {
    const timestampBuffer = Buffer.from(timestamp)
    const bodyBuffer = typeof body === "string" ? Buffer.from(body) : body
    return nacl.sign.detached.verify(
      Buffer.concat([timestampBuffer, bodyBuffer]),
      Buffer.from(signature, "hex"),
      Buffer.from(publicKey, "hex")
    )
  } catch (err) {
    console.error("[Discord] Signature verification error:", err)
    return false
  }
}

/**
 * Send a message to a Discord channel
 */
export async function sendDiscordMessage(channelId: string, content: string) {
  if (!DISCORD_BOT_TOKEN) {
    console.warn("[Discord] Bot token not configured, skipping send")
    return { success: false, error: "Bot token not configured" }
  }

  try {
    const response = await fetch(`${DISCORD_API_URL}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("[Discord] Send failed:", data)
      return { success: false, error: data.message || "Failed to send" }
    }

    return { success: true }
  } catch (error) {
    console.error("[Discord] Error sending message:", error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Send a DM to a Discord user (creates DM channel first)
 */
export async function sendDiscordDM(userId: string, content: string) {
  if (!DISCORD_BOT_TOKEN) {
    console.warn("[Discord] Bot token not configured, skipping send")
    return { success: false, error: "Bot token not configured" }
  }

  try {
    // 1. Create DM channel
    const channelResponse = await fetch(`${DISCORD_API_URL}/users/@me/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: userId }),
    })

    const channelData = await channelResponse.json()

    if (!channelResponse.ok) {
      console.error("[Discord] Create DM channel failed:", channelData)
      return { success: false, error: channelData.message || "Failed to create DM channel" }
    }

    const dmChannelId = channelData.id

    // 2. Send message to the DM channel
    return await sendDiscordMessage(dmChannelId, content)
  } catch (error) {
    console.error("[Discord] Error sending DM:", error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Format alert notification for Discord
 */
export function formatDiscordAlertMessage(alertData: {
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
${emoji} **TokenSight Alert**

**Token:** ${alertData.token_name}
**Type:** ${alertData.alert_type.replace(/_/g, " ")}

**Threshold:** $${formatUsdValue(alertData.threshold)}
**Current:** $${formatUsdValue(alertData.current_value)}
**Change:** ${(alertData.change_percent > 0 ? "+" : "") + alertData.change_percent.toFixed(2)}%

🔗 [View Analysis](https://tokensightai.tech/scan?token=${alertData.token_address})
  `.trim()
}

/**
 * Format a scan result for Discord notification
 */
export function formatDiscordScanMessage(data: {
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
  explanation?: string
}): string {
  const scoreEmoji = data.score >= 80 ? "🟢" : data.score >= 60 ? "🔵" : data.score >= 35 ? "🟠" : "🔴"
  const whaleIcon = data.whaleWarning ? "🐋 " : ""

  const priceStr = data.price !== null ? formatReadableTokenPrice(data.price) : "N/A"
  const liqStr = data.liquidity !== null ? `$${data.liquidity.toLocaleString()}` : "N/A"
  const volStr = data.volume !== null ? `$${data.volume.toLocaleString()}` : "N/A"
  const holdersStr = data.holders !== null ? data.holders.toLocaleString() : "N/A"
  const whaleStr = data.topHolderPct !== null ? `${data.topHolderPct}%` : "N/A"

  const topSignals = data.signals.slice(0, 4).map(s => `  • ${s}`).join("\n")
  const summaryBlock = data.explanation
    ? `\n🧠 **AI Summary & Risk Report:**\n*${data.explanation}*\n`
    : ""

  return `
${scoreEmoji} **TokenSight Scan Result**

**${data.tokenName}** (${data.tokenSymbol})
\`${data.address}\`

📊 **Score:** ${data.score}/100 — ${data.label}
🎯 **Confidence:** ${data.confidence}
${summaryBlock}
**Price:** ${priceStr}
**Liquidity:** ${liqStr}
**Volume 24h:** ${volStr}
**Holders:** ${holdersStr}
${whaleIcon}**Top 10 Holders:** ${whaleStr}

**Signals:**
${topSignals}

🔗 [Chart](https://dexscreener.com/solana/${data.address}) · [Full Analysis](https://tokensightai.tech/scan?address=${data.address})
  `.trim()
}
