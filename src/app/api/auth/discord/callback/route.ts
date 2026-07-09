import { NextResponse } from "next/server"
import { getAuthUserFromCookies } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { sendDiscordDM } from "@/lib/discord"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")

    if (!code) {
      return NextResponse.redirect(`${url.origin}/settings/discord?error=Missing+authorization+code`)
    }

    const authUser = await getAuthUserFromCookies()
    if (!authUser?.id) {
      // Redirect to login if user is unauthorized, but save redirect path
      return NextResponse.redirect(`${url.origin}/login?redirect=/settings/discord`)
    }

    const client_id = process.env.DISCORD_APPLICATION_ID || ""
    const client_secret = process.env.DISCORD_CLIENT_SECRET || ""
    const redirect_uri = `${url.origin}/api/auth/discord/callback`

    if (!client_id || !client_secret) {
      console.error("[Discord OAuth Callback] Missing client_id or client_secret")
      return NextResponse.redirect(`${url.origin}/settings/discord?error=Server+configuration+error`)
    }

    // 1. Exchange OAuth code for Access Token
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id,
        client_secret,
        grant_type: "authorization_code",
        code,
        redirect_uri,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok) {
      console.error("[Discord OAuth Callback] Token exchange failed:", tokenData)
      return NextResponse.redirect(`${url.origin}/settings/discord?error=OAuth+token+exchange+failed`)
    }

    const accessToken = tokenData.access_token

    // 2. Fetch User Profile using access token
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const userData = await userRes.json()

    if (!userRes.ok) {
      console.error("[Discord OAuth Callback] Failed to fetch user profile:", userData)
      return NextResponse.redirect(`${url.origin}/settings/discord?error=Failed+to+fetch+user+profile`)
    }

    const discordId = userData.id
    if (!discordId) {
      return NextResponse.redirect(`${url.origin}/settings/discord?error=No+Discord+User+ID+found`)
    }

    // 3. Link user's Discord ID in Database
    // Check if this Discord ID is already linked to another user
    const { data: existingLink } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("discord_id", discordId)
      .not("id", "eq", authUser.id)
      .maybeSingle()

    if (existingLink) {
      return NextResponse.redirect(
        `${url.origin}/settings/discord?error=This+Discord+User+ID+is+already+linked+to+another+account`
      )
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({ discord_id: discordId })
      .eq("id", authUser.id)

    if (error) {
      console.error("[Discord OAuth Callback] Database link failed:", error)
      return NextResponse.redirect(`${url.origin}/settings/discord?error=Database+update+failed`)
    }

    // 4. Send Confirmation DM via Discord
    await sendDiscordDM(
      discordId,
      "✅ **TokenSight AI Connected!**\n\nYou will now receive token alerts here."
    ).catch((err) => {
      console.error("[Discord OAuth Callback] Failed to send confirmation DM:", err)
    })

    return NextResponse.redirect(`${url.origin}/settings/discord?success=true`)
  } catch (err) {
    console.error("[Discord OAuth Callback] Fatal error:", err)
    return NextResponse.redirect(
      `${new URL(request.url).origin}/settings/discord?error=Internal+server+error`
    )
  }
}
