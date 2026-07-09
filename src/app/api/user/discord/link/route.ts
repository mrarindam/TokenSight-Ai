import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { sendDiscordDM } from "@/lib/discord"

export const dynamic = "force-dynamic"
export const revalidate = 0

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://tokensightai.tech"
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID || ""


/**
 * POST: Link user's Discord User ID
 * Frontend will get this from Discord bot command /start
 */
export async function POST(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()

    if (body.unlink) {
      const { error } = await supabaseAdmin
        .from("users")
        .update({ discord_id: null })
        .eq("id", authUser.id)

      if (error) {
        console.error("[api/user/discord/link]", error)
        return NextResponse.json({ error: "Failed to unlink Discord" }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    const discordId = body.discord_id?.trim()

    if (!discordId) {
      return NextResponse.json({ error: "Discord User ID required" }, { status: 400 })
    }

    // Check if this Discord ID is already linked to another user
    const { data: existingLink } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("discord_id", discordId)
      .not("id", "eq", authUser.id)
      .maybeSingle()

    if (existingLink) {
      return NextResponse.json(
        { error: "This Discord User ID is already linked to another account" },
        { status: 400 }
      )
    }

    // Link Discord ID to user
    const { error } = await supabaseAdmin
      .from("users")
      .update({ discord_id: discordId })
      .eq("id", authUser.id)

    if (error) {
      console.error("[api/user/discord/link]", error)
      return NextResponse.json({ error: "Failed to link Discord" }, { status: 500 })
    }

    // Send test DM to Discord
    await sendDiscordDM(
      discordId,
      "✅ **TokenSight AI Connected!**\n\nYou will now receive token alerts here."
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[api/user/discord/link]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

/**
 * GET: Check if user has Discord linked
 */
export async function GET(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("discord_id")
    .eq("id", authUser.id)
    .maybeSingle()

  const redirect_uri = `${APP_URL}/api/auth/discord/callback`
  const discord_auth_url = DISCORD_APPLICATION_ID
    ? `https://discord.com/oauth2/authorize?client_id=${DISCORD_APPLICATION_ID}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=identify`
    : null

  const discord_bot_invite_url = DISCORD_APPLICATION_ID
    ? `https://discord.com/oauth2/authorize?client_id=${DISCORD_APPLICATION_ID}&permissions=2048&scope=bot%20applications.commands`
    : null

  return NextResponse.json({
    discord_id: user?.discord_id || null,
    discord_auth_url,
    discord_bot_invite_url,
  })
}
