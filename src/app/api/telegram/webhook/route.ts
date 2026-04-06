import { NextResponse } from "next/server"
import { sendTelegramMessage, extractUserIdFromUpdate } from "@/lib/telegram"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(request: Request) {
  try {
    const update = await request.json()
    const telegramId = extractUserIdFromUpdate(update)

    if (!telegramId) {
      console.error("[api/telegram/webhook] No telegram ID found in update", update)
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const text = update.message?.text?.trim?.() || ""
    const lowerText = String(text).toLowerCase()

    if (lowerText === "/start") {
      await sendTelegramMessage({
        chat_id: telegramId,
        text: `✅ <b>TokenSight AI is ready!</b>\n\nYour Telegram ID is <code>${telegramId}</code>. Copy this and paste it into your app settings to receive alerts.`,
      })
      return NextResponse.json({ ok: true })
    }

    if (lowerText) {
      await sendTelegramMessage({
        chat_id: telegramId,
        text: `🤖 Hello! Send /start to get your Telegram ID for TokenSight AI alerts.`,
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/telegram/webhook] Error handling update", error)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
