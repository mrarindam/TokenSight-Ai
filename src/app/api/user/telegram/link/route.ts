import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { sendTelegramMessage } from "@/lib/telegram"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface LinkTelegramBody {
  telegram_id: string
}

/**
 * POST: Link user's Telegram ID
 * Frontend will get this from Telegram bot /start command
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as LinkTelegramBody
    const telegramId = body.telegram_id?.trim()

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    // Check if this Telegram ID is already linked to another user
    const { data: existingLink } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .not("id", "eq", session.user.id)
      .maybeSingle()

    if (existingLink) {
      return NextResponse.json(
        { error: "This Telegram ID is already linked to another account" },
        { status: 400 }
      )
    }

    // Link Telegram ID to user
    const { error } = await supabaseAdmin
      .from("users")
      .update({ telegram_id: telegramId })
      .eq("id", session.user.id)

    if (error) {
      console.error("[api/user/telegram/link]", error)
      return NextResponse.json({ error: "Failed to link Telegram" }, { status: 500 })
    }

    // Send test message to Telegram
    await sendTelegramMessage({
      chat_id: telegramId,
      text: "✅ <b>TokenSight AI Connected!</b>\n\nYou will now receive token alerts here.",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[api/user/telegram/link]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

/**
 * GET: Check if user has Telegram linked
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("telegram_id")
    .eq("id", session.user.id)
    .maybeSingle()

  return NextResponse.json({
    telegram_id: user?.telegram_id || null,
  })
}
