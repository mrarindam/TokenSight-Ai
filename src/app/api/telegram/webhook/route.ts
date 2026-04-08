import { NextResponse } from "next/server"
import { sendTelegramMessage, extractChatIdFromUpdate, extractUserIdFromUpdate, formatScanMessage } from "@/lib/telegram"
import { supabase } from "@/lib/supabaseClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://tokensightai.tech"
const LOGIN_URL = `${APP_URL}/login`
const TELEGRAM_SETTINGS_URL = `${APP_URL}/settings/telegram`

async function getLinkedUserId(telegramId: string) {
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegramId)
    .maybeSingle()

  return user?.id || null
}

function getLinkAccountMessage(telegramId: string) {
  return `🔒 <b>Link your TokenSight account to unlock bot features.</b>\n\nYour Telegram ID is <code>${telegramId}</code>.\n\n1. <a href="${LOGIN_URL}">Log in to TokenSight AI</a>\n2. Open <a href="${TELEGRAM_SETTINGS_URL}">Settings → Telegram</a>\n3. Paste your Telegram ID to complete linking\n\nAfter linking, you can use /scan and /alerts.`
}

export async function POST(request: Request) {
  try {
    const update = await request.json()
    const telegramId = extractUserIdFromUpdate(update)
    const chatId = extractChatIdFromUpdate(update)

    if (!telegramId && !chatId) {
      // MUST return 200 for non-message updates (my_chat_member, edited_message, etc.)
      // Returning 400 causes Telegram to disable the webhook after repeated failures,
      // which stops the bot from responding to ALL users
      return NextResponse.json({ ok: true })
    }

    const replyChatId = chatId || telegramId

    const text = update.message?.text?.trim?.() || ""
    const lowerText = String(text).toLowerCase()
    const linkedUserId = telegramId ? await getLinkedUserId(telegramId) : null

    // /start — Welcome + ID
    if (lowerText === "/start") {
      await sendTelegramMessage({
        chat_id: replyChatId!,
        text: linkedUserId
          ? `✅ <b>TokenSight AI is already linked.</b>\n\nYour Telegram ID is <code>${telegramId}</code>.\n\nYou can now use:\n/scan &lt;address&gt; — Scan any Solana token\n/alerts — View your active alerts\n/help — Show all commands`
          : `✅ <b>TokenSight AI is ready!</b>\n\n${getLinkAccountMessage(telegramId || "")}`,
      })
      return NextResponse.json({ ok: true })
    }

    // /help — Command list
    if (lowerText === "/help") {
      await sendTelegramMessage({
        chat_id: replyChatId!,
        text: linkedUserId
          ? `🤖 <b>TokenSight AI Commands</b>\n\n/scan &lt;address&gt; — Scan any Solana token\n/alerts — View your active price alerts\n/help — Show this message\n\n🔗 <a href="${APP_URL}">Open TokenSight AI</a>`
          : `🤖 <b>TokenSight AI Commands</b>\n\n/start — Get your Telegram ID\n/help — Show this message\n\n${getLinkAccountMessage(telegramId || "")}`,
      })
      return NextResponse.json({ ok: true })
    }

    // /scan <address> — Run a scan from TG
    if (lowerText.startsWith("/scan")) {
      if (!telegramId) {
        return NextResponse.json({ ok: true })
      }

      if (!linkedUserId) {
        await sendTelegramMessage({
          chat_id: replyChatId!,
          text: `🔒 <b>Scan is only available for linked TokenSight accounts.</b>\n\n${getLinkAccountMessage(telegramId)}`,
        })
        return NextResponse.json({ ok: true })
      }

      const parts = text.split(/\s+/)
      const tokenAddress = parts[1]

      if (!tokenAddress || tokenAddress.length < 10) {
        await sendTelegramMessage({
          chat_id: replyChatId!,
          text: `⚠️ Please provide a token address.\n\n<b>Usage:</b> /scan &lt;token_address&gt;\n<b>Example:</b> /scan So11111111111111111111111111111111111111112`,
        })
        return NextResponse.json({ ok: true })
      }

      // Send "scanning..." feedback
      await sendTelegramMessage({
        chat_id: replyChatId!,
        text: `🔍 Scanning <code>${tokenAddress}</code>...\nThis may take a few seconds.`,
      })

      try {
        // Call our own scan API internally
        const scanRes = await fetch(`${APP_URL}/api/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: tokenAddress }),
        })

        if (!scanRes.ok) {
          const err = await scanRes.json().catch(() => ({}))
          await sendTelegramMessage({
            chat_id: replyChatId!,
            text: `❌ Scan failed: ${err.error || `HTTP ${scanRes.status}`}`,
          })
          return NextResponse.json({ ok: true })
        }

        const scanData = await scanRes.json()

        await sendTelegramMessage({
          chat_id: replyChatId!,
          text: formatScanMessage({
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
          }),
        })
      } catch (err) {
        console.error("[telegram/webhook] Scan error:", err)
        await sendTelegramMessage({
          chat_id: replyChatId!,
          text: `❌ Scan failed. Please try again later.`,
        })
      }

      return NextResponse.json({ ok: true })
    }

    // /alerts — Show user's active alerts
    if (lowerText === "/alerts") {
      if (!telegramId) {
        return NextResponse.json({ ok: true })
      }

      if (!linkedUserId) {
        await sendTelegramMessage({
          chat_id: replyChatId!,
          text: `🔒 <b>Alerts are only available for linked TokenSight accounts.</b>\n\n${getLinkAccountMessage(telegramId)}`,
        })
        return NextResponse.json({ ok: true })
      }

      const { data: alerts } = await supabase
        .from("price_alerts")
        .select("token_name, token_address, alert_type, threshold, is_active, trigger_count")
        .eq("user_id", linkedUserId)
        .eq("is_active", true)
        .limit(10)

      if (!alerts || alerts.length === 0) {
        await sendTelegramMessage({
          chat_id: replyChatId!,
          text: `📭 You have no active alerts.\n\nSet alerts at <a href="${APP_URL}/alerts">TokenSight Alerts</a>`,
        })
        return NextResponse.json({ ok: true })
      }

      const alertLines = alerts.map((a, i) => {
        const emoji = a.alert_type === "PRICE_DROP" ? "📉" : a.alert_type === "PRICE_RISE" ? "📈" : "⚠️"
        return `${i + 1}. ${emoji} <b>${a.token_name}</b>\n   ${a.alert_type.replace(/_/g, " ")} at $${a.threshold}\n   Triggered: ${a.trigger_count}x`
      }).join("\n\n")

      await sendTelegramMessage({
        chat_id: replyChatId!,
        text: `🔔 <b>Active Alerts (${alerts.length})</b>\n\n${alertLines}\n\n<a href="${APP_URL}/alerts">Manage Alerts</a>`,
      })
      return NextResponse.json({ ok: true })
    }

    // Unknown command
    if (lowerText) {
      await sendTelegramMessage({
        chat_id: replyChatId!,
        text: linkedUserId
          ? `🤖 Unknown command. Send /help to see available commands.`
          : `🔒 <b>This bot feature requires a linked TokenSight account.</b>\n\n${getLinkAccountMessage(telegramId || "")}`,
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/telegram/webhook] Error handling update", error)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
