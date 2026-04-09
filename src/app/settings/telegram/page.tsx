"use client"

import { useState, useEffect, useCallback } from "react"
import { usePrivy } from "@privy-io/react-auth"
import { useAuthFetch } from "@/lib/useAuthFetch"
import { cn } from "@/lib/utils"
import { Send, CheckCircle, AlertCircle } from "lucide-react"

export default function TelegramSettingsPage() {
  const { authenticated } = usePrivy()
  const authFetch = useAuthFetch()
  const [telegramId, setTelegramId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const fetchTelegramStatus = useCallback(async () => {
    try {
      const response = await authFetch("/api/user/telegram/link")
      const data = await response.json()
      setTelegramId(data.telegram_id || null)
    } catch (err) {
      console.error("Failed to fetch Telegram status:", err)
    }
  }, [authFetch])

  useEffect(() => {
    if (authenticated) {
      void fetchTelegramStatus()
    }
  }, [authenticated, fetchTelegramStatus])

  async function handleLink() {
    if (!inputValue.trim()) {
      setError("Please enter your Telegram ID")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await authFetch("/api/user/telegram/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_id: inputValue }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to link Telegram")
      }

      setSuccess(true)
      setTelegramId(inputValue)
      setInputValue("")
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-3xl font-bold">Telegram Alerts</h1>
        <p className="mt-4 text-sm text-muted-foreground">Log in to receive alerts via Telegram.</p>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl py-12 space-y-8">
      <div className="glass rounded-[2rem] border border-border/40 p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 flex-shrink-0">
            <Send className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Telegram Alerts</h1>
            <p className="text-sm text-muted-foreground mt-1">Get real-time price and score alerts via Telegram bot</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Step 1: Create Bot */}
          <div className="border border-border/30 rounded-xl p-4 bg-muted/5">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                1
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold">Open Telegram Bot</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Search for <a href="https://t.me/TokenSightai_bot" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><code className="bg-muted px-2 py-1 rounded text-xs">@TokenSightai_bot</code></a> in Telegram
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
                  Click the bot and tap <code className="bg-muted px-2 py-1 rounded text-xs">/start</code> or send it
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
                <h3 className="font-semibold">Copy Your Telegram ID</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  The bot will send you a message with your Telegram ID. Copy it below.
                </p>
              </div>
            </div>
          </div>

          {/* Link Status */}
          {telegramId && (
            <div className="border border-green-500/30 rounded-xl p-4 bg-green-500/5 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-600">Connected to Telegram</p>
                <p className="text-sm text-muted-foreground mt-1">Your Telegram ID: <code className="bg-muted px-2 py-1 rounded text-xs">{telegramId}</code></p>
                <p className="text-xs text-muted-foreground mt-2">You will receive alerts as direct messages from the bot</p>
              </div>
            </div>
          )}

          {/* Input Section */}
          {!telegramId && (
            <div className="space-y-3">
              <label className="block space-y-2 text-sm">
                <span className="font-semibold">Your Telegram ID</span>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLink()}
                  className="w-full rounded-xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
                  placeholder="Eg. 123456789"
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
                  <p className="text-sm text-green-600">✓ Telegram connected! Check your messages.</p>
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
                {loading ? "Linking..." : "Link Telegram"}
              </button>
            </div>
          )}

          {/* Features */}
          <div className="space-y-3 pt-4 border-t border-border/30">
            <p className="text-sm font-semibold">You&apos;ll receive alerts for:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                📉 Price drops below threshold
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                📈 Price rises above threshold
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                ⚠️ Score changes detected
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                ✅ Instant notifications (every 5 mins)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
