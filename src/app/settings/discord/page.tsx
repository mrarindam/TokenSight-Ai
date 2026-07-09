"use client"

import { useState, useEffect, useCallback } from "react"
import { usePrivy } from "@privy-io/react-auth"
import { useAuthFetch } from "@/lib/useAuthFetch"
import { cn } from "@/lib/utils"
import { MessageSquare, CheckCircle, AlertCircle, LogIn, ExternalLink } from "lucide-react"
import Link from "next/link"

export default function DiscordSettingsPage() {
  const { ready, authenticated } = usePrivy()
  const authFetch = useAuthFetch()
  const [discordId, setDiscordId] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const fetchDiscordStatus = useCallback(async () => {
    try {
      const response = await authFetch("/api/user/discord/link")
      const data = await response.json()
      setDiscordId(data.discord_id || null)
      setInviteUrl(data.discord_bot_invite_url || null)
    } catch (err) {
      console.error("Failed to fetch Discord status:", err)
    }
  }, [authFetch])

  useEffect(() => {
    if (authenticated) {
      void fetchDiscordStatus()
    }
  }, [authenticated, fetchDiscordStatus])

  async function handleLink() {
    if (!inputValue.trim()) {
      setError("Please enter your Discord User ID")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await authFetch("/api/user/discord/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord_id: inputValue }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to link Discord")
      }

      setSuccess(true)
      setDiscordId(inputValue)
      setInputValue("")
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUnlink() {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await authFetch("/api/user/discord/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlink: true }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to unlink Discord")
      }

      setDiscordId(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return <div className="terminal-page-shell py-16 text-center">Loading Discord settings...</div>
  }

  if (!authenticated) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] overflow-hidden">
          <div className="absolute left-[8%] top-[-10%] h-72 w-72 rounded-full bg-indigo-500/10 blur-[140px]" />
          <div className="absolute right-[10%] top-[8%] h-64 w-64 rounded-full bg-primary/10 blur-[130px]" />
        </div>
        <div className="terminal-page-shell relative z-10 py-24">
          <div className="terminal-page-grid">
            <div className="col-span-12 xl:col-span-6 xl:col-start-4 text-center space-y-6 terminal-page-frame p-8 md:p-10">
              <div className="terminal-icon-tile mx-auto text-indigo-400 border-indigo-500/20 bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.16)]">
                <MessageSquare className="h-8 w-8" />
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">Discord Alerts & Bot</h1>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">Log in to link your Discord account and use bot features.</p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm tracking-wide shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                <LogIn className="h-4 w-4" />
                Sign in to continue
              </Link>
              <p className="text-[11px] text-muted-foreground/40">Google, GitHub, or Solana wallet</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl py-12 space-y-8">
      <div className="glass rounded-[2rem] border border-border/40 p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="h-12 w-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 flex-shrink-0">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Discord Alerts & Bot</h1>
            <p className="text-sm text-muted-foreground mt-1">Get real-time price and score alerts via Discord bot</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Step 1: Open Bot */}
          <div className="border border-border/30 rounded-xl p-4 bg-muted/5">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                1
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold">Add TokenSight Bot</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {inviteUrl ? (
                    <a
                      href={inviteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline font-semibold"
                    >
                      Click here to invite the TokenSight Bot to your server/DM
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span>Invite the TokenSight Bot to your server or start a DM</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Step 2: Start Bot */}
          <div className="border border-border/30 rounded-xl p-4 bg-muted/5">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                2
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold">Send /start Command</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Type and send the slash command <code className="bg-muted px-2 py-1 rounded text-xs">/start</code> in Discord.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3: Get ID */}
          <div className="border border-border/30 rounded-xl p-4 bg-muted/5">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                3
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold">Copy Your Discord User ID</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  The bot will respond with your unique Discord User ID. Copy it and paste it below.
                </p>
              </div>
            </div>
          </div>

          {/* Link Status */}
          {discordId && (
            <div className="border border-green-500/30 rounded-xl p-4 bg-green-500/5 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-green-600">Connected to Discord</p>
                  <p className="text-sm text-muted-foreground mt-1">Your Linked Discord ID: <code className="bg-muted px-2 py-1 rounded text-xs">{discordId}</code></p>
                  <p className="text-xs text-muted-foreground mt-2">You will receive alerts as Direct Messages from the bot, and you can scan tokens directly.</p>
                </div>
              </div>
              
              <button
                onClick={handleUnlink}
                disabled={loading}
                className="inline-flex items-center gap-2 text-xs font-semibold text-red-500 hover:text-red-600 border border-red-500/30 hover:border-red-500/50 bg-red-500/5 px-3 py-2 rounded-lg transition-colors"
              >
                Disconnect Discord
              </button>
            </div>
          )}

          {/* Input Section */}
          {!discordId && (
            <div className="space-y-3">
              <label className="block space-y-2 text-sm">
                <span className="font-semibold">Your Discord User ID</span>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLink()}
                  className="w-full rounded-xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
                  placeholder="Eg. 1056180691987091467"
                />
              </label>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {success && (
                <div className="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-600">✓ Action completed successfully!</p>
                </div>
              )}

              <button
                onClick={handleLink}
                disabled={loading || !inputValue.trim()}
                className={cn(
                  "w-full py-3 rounded-xl font-semibold text-sm transition-colors",
                  loading || !inputValue.trim()
                    ? "bg-primary/30 text-primary cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {loading ? "Linking..." : "Link Discord"}
              </button>
            </div>
          )}

          {/* Features */}
          <div className="space-y-3 pt-4 border-t border-border/30">
            <p className="text-sm font-semibold">Discord Bot Features:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                📉 Real-time price drop notifications directly in your DMs
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                📈 Real-time price rise notifications directly in your DMs
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                🔍 Direct token scanning via slash command: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/scan &lt;address&gt;</code>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                📊 Check active price alerts via <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/alerts</code>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
