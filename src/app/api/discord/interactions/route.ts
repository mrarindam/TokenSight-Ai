import { NextResponse } from "next/server"
import { verifyDiscordSignature, formatDiscordScanMessage } from "@/lib/discord"
import { supabase } from "@/lib/supabaseClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://tokensightai.tech"
const LOGIN_URL = `${APP_URL}/login`
const DISCORD_SETTINGS_URL = `${APP_URL}/settings/discord`
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID || ""
const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || ""

async function getLinkedUserId(discordId: string) {
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("discord_id", discordId)
    .maybeSingle()

  return user?.id || null
}

function getLinkAccountMessage(discordId: string) {
  return `🔒 **Link your TokenSight account to unlock bot features.**\n\nYour Discord User ID is \`${discordId}\`.\n\n1. [Log in to TokenSight AI](${LOGIN_URL})\n2. Open [Settings → Discord](${DISCORD_SETTINGS_URL})\n3. Paste your Discord User ID to complete linking\n\nAfter linking, you can use \`/scan\` and \`/alerts\`.`
}

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("x-signature-ed25519") || ""
    const timestamp = request.headers.get("x-signature-timestamp") || ""
    
    // Read raw body as arrayBuffer for 100% byte-safe verification
    const arrayBuffer = await request.arrayBuffer()
    const bodyBuffer = Buffer.from(arrayBuffer)
    const rawBody = bodyBuffer.toString("utf-8")

    console.log(`[Discord Interactions] Received request. Timestamp: ${timestamp}, Signature length: ${signature.length}`)

    // Verify signature (required by Discord)
    if (DISCORD_PUBLIC_KEY) {
      const isValid = verifyDiscordSignature(bodyBuffer, signature, timestamp, DISCORD_PUBLIC_KEY)
      console.log(`[Discord Interactions] Signature verification result: ${isValid}`)
      if (!isValid) {
        console.warn("[Discord Interactions] Invalid request signature")
        return new Response("Invalid request signature", { status: 401 })
      }
    } else {
      console.warn("[Discord Interactions] DISCORD_PUBLIC_KEY is not configured. Skipping signature check (dev mode).")
    }

    const update = JSON.parse(rawBody)

    // Type 1: Ping (for webhook verification)
    if (update.type === 1) {
      console.log("[Discord Interactions] Received PING. Responding with PONG.")
      return NextResponse.json({ type: 1 })
    }

    // Type 2: Application Command (Slash Commands)
    if (update.type === 2) {
      const commandName = update.data?.name
      const discordUser = update.user || update.member?.user
      const discordId = discordUser?.id || ""
      const token = update.token || ""
      const isGuild = !!update.guild_id

      console.log(`[Discord Interactions] Command received: /${commandName}. User ID: ${discordId}, Username: ${discordUser?.username || "unknown"}, isGuild: ${isGuild}`)

      if (!discordId) {
        console.warn("[Discord Interactions] Could not determine Discord User ID")
        return NextResponse.json({
          type: 4,
          data: { content: "❌ Error: Could not determine your Discord User ID." },
        })
      }

      const linkedUserId = await getLinkedUserId(discordId)
      console.log(`[Discord Interactions] Discord user ${discordId} is linked to DB user: ${linkedUserId}`)

      // command: /start
      if (commandName === "start") {
        if (isGuild) {
          return NextResponse.json({
            type: 4,
            data: { content: "⚠️ The `/start` command is only available in private Direct Messages (DMs) with the bot to link your account." },
          })
        }

        const text = linkedUserId
          ? `✅ **TokenSight AI is already linked.**\n\nYour Discord User ID is \`${discordId}\`.\n\nYou can now use:\n\`/scan <address>\` — Scan any Solana token\n\`/alerts\` — View your active alerts\n\`/help\` — Show all commands`
          : `✅ **TokenSight AI is ready!**\n\n${getLinkAccountMessage(discordId)}`

        return NextResponse.json({
          type: 4,
          data: { content: text },
        })
      }

      // command: /help
      if (commandName === "help") {
        const text = isGuild
          ? `🤖 **TokenSight AI Commands (Server)**\n\n\`/scan <address>\` — Scan any Solana token\n\`/help\` — Show this message\n\n🔗 [Open TokenSight AI](${APP_URL})`
          : linkedUserId
            ? `🤖 **TokenSight AI Commands**\n\n\`/scan <address>\` — Scan any Solana token\n\`/alerts\` — View your active price alerts\n\`/help\` — Show this message\n\n🔗 [Open TokenSight AI](${APP_URL})`
            : `🤖 **TokenSight AI Commands**\n\n\`/start\` — Get your Discord User ID\n\`/help\` — Show this message\n\n${getLinkAccountMessage(discordId)}`

        return NextResponse.json({
          type: 4,
          data: { content: text },
        })
      }

      // command: /scan
      if (commandName === "scan") {
        if (!isGuild && !linkedUserId) {
          return NextResponse.json({
            type: 4,
            data: { content: `🔒 **Scan is only available for linked TokenSight accounts in DMs.**\n\n${getLinkAccountMessage(discordId)}` },
          })
        }

        const addressOption = update.data?.options?.find((opt: { name: string }) => opt.name === "address")
        const tokenAddress = addressOption?.value?.trim() || ""

        if (!tokenAddress || tokenAddress.length < 10) {
          return NextResponse.json({
            type: 4,
            data: { content: "⚠️ Please provide a valid Solana token address." },
          })
        }

        // Return a deferred response (type 5) because the scan API takes more than 3 seconds
        // Discord will display "bot is thinking..."
        // Then we run the scan asynchronously and update the interaction via webhook
        
        // Execute background fetch and message edit
        void (async () => {
          try {
            const scanRes = await fetch(`${APP_URL}/api/scan`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address: tokenAddress }),
            })

            const updateUrl = `https://discord.com/api/v10/webhooks/${DISCORD_APPLICATION_ID}/${token}/messages/@original`

            if (!scanRes.ok) {
              const err = await scanRes.json().catch(() => ({}))
              await fetch(updateUrl, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  content: `❌ Scan failed: ${err.error || `HTTP ${scanRes.status}`}`,
                }),
              })
              return
            }

            const scanData = await scanRes.json()
            const scanMessage = formatDiscordScanMessage({
              tokenName: scanData.contractName || "Unknown",
              tokenSymbol: scanData.contractName || "???",
              address: tokenAddress,
              score: scanData.score,
              label: scanData.label,
              confidence: scanData.confidence,
              signals: scanData.signals || [],
              liquidity: scanData.meta?.liquidity ?? null,
              volume: scanData.meta?.volume ?? null,
              holders: scanData.meta?.holders ?? null,
              price: scanData.meta?.price ?? null,
              topHolderPct: scanData.meta?.topHolderPct ?? null,
              whaleWarning: scanData.meta?.whaleWarning ?? false,
              explanation: scanData.explanation,
            })

            await fetch(updateUrl, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: scanMessage }),
            })
          } catch (err) {
            console.error("[Discord Interactions] Async scan error:", err)
            const updateUrl = `https://discord.com/api/v10/webhooks/${DISCORD_APPLICATION_ID}/${token}/messages/@original`
            await fetch(updateUrl, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: `❌ Scan failed. Please try again later.`,
              }),
            }).catch(() => {})
          }
        })()

        return NextResponse.json({
          type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE ("bot is thinking...")
        })
      }

      // command: /alerts
      if (commandName === "alerts") {
        if (isGuild) {
          return NextResponse.json({
            type: 4,
            data: { content: "⚠️ The `/alerts` command is only available in private Direct Messages (DMs) with the bot." },
          })
        }

        if (!linkedUserId) {
          return NextResponse.json({
            type: 4,
            data: { content: `🔒 **To view your active alerts, you must link your TokenSight account.**\n\n${getLinkAccountMessage(discordId)}` },
          })
        }

        const { data: alerts } = await supabase
          .from("price_alerts")
          .select("token_name, token_address, alert_type, threshold, is_active, trigger_count")
          .eq("user_id", linkedUserId)
          .eq("is_active", true)
          .limit(10)

        if (!alerts || alerts.length === 0) {
          return NextResponse.json({
            type: 4,
            data: { content: `📭 You have no active alerts.\n\nSet alerts at [TokenSight Alerts](${APP_URL}/alerts)` },
          })
        }

        const alertLines = alerts
          .map((a, i) => {
            const emoji = a.alert_type === "PRICE_DROP" ? "📉" : a.alert_type === "PRICE_RISE" ? "📈" : "⚠️"
            return `${i + 1}. ${emoji} **${a.token_name}**\n   ${a.alert_type.replace(/_/g, " ")} at $${a.threshold}\n   Triggered: ${a.trigger_count}x`
          })
          .join("\n\n")

        return NextResponse.json({
          type: 4,
          data: { content: `🔔 **Active Alerts (${alerts.length})**\n\n${alertLines}\n\n[Manage Alerts](${APP_URL}/alerts)` },
        })
      }
    }

    return NextResponse.json({ error: "Unknown interaction type" }, { status: 400 })
  } catch (error) {
    console.error("[Discord Interactions] Webhook handler error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
