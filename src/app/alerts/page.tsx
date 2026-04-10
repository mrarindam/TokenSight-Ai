"use client"

import { useState, useEffect, useCallback } from "react"
import { usePrivy } from "@privy-io/react-auth"
import { useAuthFetch } from "@/lib/useAuthFetch"
import { cn, fetchTokenPrice, isValidSolanaAddress } from "@/lib/utils"
import type { PriceAlertRecord } from "@/types/app"
import { Bell, Zap, Trash2, RefreshCw, TrendingDown, TrendingUp, Activity, LogIn } from "lucide-react"
import Link from "next/link"

const DEFAULT_API = "/api/alerts"

function formatUsdValue(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value < 1 ? 6 : 2,
    maximumFractionDigits: 9,
  })
}

function formatDateTime(value?: string | null) {
  if (!value) return "Never"
  return new Date(value).toLocaleString()
}

const alertTypeIcon = (type: string) => {
  if (type === "PRICE_DROP") return <TrendingDown className="h-4 w-4" />
  if (type === "PRICE_RISE") return <TrendingUp className="h-4 w-4" />
  return <Activity className="h-4 w-4" />
}

const alertTypeColor = (type: string) => {
  if (type === "PRICE_DROP") return "text-rose-400"
  if (type === "PRICE_RISE") return "text-emerald-400"
  return "text-cyan-400"
}

export default function AlertsPage() {
  const { ready, authenticated } = usePrivy()
  const authFetch = useAuthFetch()
  const [alerts, setAlerts] = useState<PriceAlertRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [formState, setFormState] = useState({
    token_address: "",
    token_name: "",
    alert_type: "PRICE_DROP",
    comparison_type: "BELOW",
    threshold: "",
  })

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await authFetch(DEFAULT_API)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Unable to load alerts")
      setAlerts(data.alerts || [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    if (authenticated) {
      void fetchAlerts()
    }
  }, [authenticated, fetchAlerts])

  useEffect(() => {
    const tokenAddress = formState.token_address.trim()

    if (!tokenAddress || !isValidSolanaAddress(tokenAddress)) {
      setCurrentPrice(null)
      setPriceLoading(false)
      return
    }

    setPriceLoading(true)
    const timeoutId = window.setTimeout(async () => {
      const price = await fetchTokenPrice(tokenAddress)
      setCurrentPrice(price)
      setPriceLoading(false)
    }, 400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [formState.token_address])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    if (!isValidSolanaAddress(formState.token_address)) {
      setError("Only valid Solana / SVM token addresses can be used for alerts")
      setLoading(false)
      return
    }

    try {
      const body = {
        token_address: formState.token_address,
        token_name: formState.token_name,
        alert_type: formState.alert_type,
        comparison_type: formState.comparison_type,
        threshold: Number(formState.threshold),
      }

      const response = await authFetch(DEFAULT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Unable to create alert")
      setFormState({ token_address: "", token_name: "", alert_type: "PRICE_DROP", comparison_type: "BELOW", threshold: "" })
      setSuccessMessage("Alert created successfully and notification sent if Telegram is linked.")
      fetchAlerts()
    } catch (err) {
      setError((err as Error).message)
      setSuccessMessage(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(alertId: string) {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await authFetch(DEFAULT_API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_id: alertId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Unable to delete alert")
      setSuccessMessage("Alert deleted successfully and Telegram notification sent if linked.")
      fetchAlerts()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return <div className="terminal-page-shell py-16">Loading alerts...</div>
  }

  if (!authenticated) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] overflow-hidden">
          <div className="absolute left-[8%] top-[-10%] h-72 w-72 rounded-full bg-amber-500/10 blur-[140px]" />
          <div className="absolute right-[10%] top-[8%] h-64 w-64 rounded-full bg-primary/10 blur-[130px]" />
        </div>
        <div className="terminal-page-shell relative z-10 py-24">
          <div className="terminal-page-grid">
            <div className="col-span-12 xl:col-span-6 xl:col-start-4 text-center space-y-6 terminal-page-frame p-8 md:p-10">
              <div className="terminal-icon-tile mx-auto text-amber-400 border-amber-500/20 bg-amber-500/10 shadow-[0_0_30px_rgba(251,191,36,0.16)]">
                <Bell className="h-8 w-8" />
              </div>
              <div className="space-y-3">
                <div className="terminal-page-kicker">
                  <Bell className="h-3.5 w-3.5" />
                  Alert Terminal
                </div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-3d text-3d-hero bg-gradient-to-r from-amber-300 via-foreground to-primary bg-clip-text text-transparent">Alerts</h1>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">Log in to create token alerts and monitor score or price changes.</p>
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
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] overflow-hidden">
        <div className="absolute left-[5%] top-[-12%] h-80 w-80 rounded-full bg-amber-500/10 blur-[160px] opacity-80" />
        <div className="absolute right-[8%] top-[6%] h-72 w-72 rounded-full bg-primary/10 blur-[150px] opacity-70" />
      </div>
      <div className="absolute inset-0 terminal-grid-bg opacity-[0.18] pointer-events-none" />
      <div className="terminal-page-shell relative z-10 py-8 md:py-12 space-y-8 md:space-y-10">
        <section className="terminal-page-grid items-start">
          <div className="col-span-12 xl:col-span-8 space-y-4 animate-fade-up">
            <div className="terminal-page-kicker">
              <Bell className="h-3.5 w-3.5" />
              Alert Command Center
            </div>
            <h1 className="text-4xl md:text-5xl xl:text-6xl font-black tracking-tight text-3d text-3d-hero">
              <span className="bg-gradient-to-r from-amber-300 via-foreground to-primary bg-clip-text text-transparent animate-aurora">Price & Signal Alerts</span>
            </h1>
            <p className="max-w-3xl text-sm md:text-base text-muted-foreground leading-relaxed">Monitor price inflection points and score movement from one full-width terminal surface, with live trigger state and quick control access.</p>
          </div>
          <div className="col-span-12 xl:col-span-4 animate-fade-up [animation-delay:120ms]">
            <div className="terminal-page-frame p-5">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6 terminal-mini-panel">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/55">Active</div>
                  <div className="mt-2 text-2xl font-black text-foreground">{alerts.filter((alert) => alert.is_active).length}</div>
                </div>
                <div className="col-span-6 terminal-mini-panel">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/55">Total</div>
                  <div className="mt-2 text-2xl font-black text-foreground">{alerts.length}</div>
                </div>
                <div className="col-span-6 terminal-mini-panel">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/55">Live Price</div>
                  <div className="mt-2 text-sm font-black text-cyan-300">{priceLoading ? "Loading" : currentPrice !== null ? `$${formatUsdValue(currentPrice)}` : "Awaiting"}</div>
                </div>
                <div className="col-span-6 terminal-mini-panel">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/55">Status</div>
                  <div className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-amber-300">{loading ? "Syncing" : "Ready"}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="terminal-page-grid items-start">
      {/* ===== Create Alert Section ===== */}
      <section className="col-span-12 xl:col-span-5 terminal-page-frame group p-6 md:p-8 transition-all duration-500 hover:border-primary/30 hover-lift-premium">
        {/* Top gradient accent */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
        {/* Corner glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/20 transition-colors" />

        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20 shadow-lg shadow-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Alerts Center</h1>
              <p className="text-sm text-muted-foreground/80">Create automatic alerts for price movement or score changes.</p>
            </div>
          </div>
          <button
            onClick={fetchAlerts}
            className="group/btn flex items-center gap-2 rounded-xl border border-border/40 bg-card/80 px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
          >
            <RefreshCw className="h-4 w-4 group-hover/btn:rotate-180 transition-transform duration-500" />
            Refresh
          </button>
        </div>

        <form className="relative z-10 mt-8 grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm group/label">
              <span className="font-semibold text-foreground/90">Token Address</span>
              <input
                value={formState.token_address}
                onChange={(event) => setFormState(prev => ({ ...prev, token_address: event.target.value }))}
                className="w-full rounded-xl border border-border/40 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-all duration-300 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 focus:shadow-lg focus:shadow-primary/5 hover:border-border/60"
                placeholder="Solana / SVM token address"
              />
              <p className="text-xs text-muted-foreground/60">Alerts support Solana and SVM-compatible token addresses only.</p>
            </label>
            <label className="block space-y-2 text-sm">
              <span className="font-semibold text-foreground/90">Token Name</span>
              <input
                value={formState.token_name}
                onChange={(event) => setFormState(prev => ({ ...prev, token_name: event.target.value }))}
                className="w-full rounded-xl border border-border/40 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-all duration-300 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 focus:shadow-lg focus:shadow-primary/5 hover:border-border/60"
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-2 text-sm">
              <span className="font-semibold text-foreground/90">Alert Type</span>
              <select
                value={formState.alert_type}
                onChange={(event) => setFormState(prev => ({ ...prev, alert_type: event.target.value }))}
                className="w-full rounded-xl border border-border/40 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-all duration-300 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 hover:border-border/60"
              >
                <option value="PRICE_DROP">Price Drop</option>
                <option value="PRICE_RISE">Price Rise</option>
                <option value="SCORE_CHANGE">Score Change</option>
              </select>
            </label>
            <label className="block space-y-2 text-sm">
              <span className="font-semibold text-foreground/90">Comparison</span>
              <select
                value={formState.comparison_type}
                onChange={(event) => setFormState(prev => ({ ...prev, comparison_type: event.target.value }))}
                className="w-full rounded-xl border border-border/40 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-all duration-300 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 hover:border-border/60"
              >
                <option value="BELOW">Below</option>
                <option value="ABOVE">Above</option>
                <option value="CHANGE_BY_PERCENT">Change %</option>
              </select>
            </label>
            <label className="block space-y-2 text-sm">
              <span className="font-semibold text-foreground/90">Threshold</span>
              <input
                type="number"
                step="any"
                value={formState.threshold}
                onChange={(event) => setFormState(prev => ({ ...prev, threshold: event.target.value }))}
                className="w-full rounded-xl border border-border/40 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-all duration-300 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 hover:border-border/60"
                placeholder="Value"
              />
            </label>
          </div>

          {/* Live price display */}
          <div className="rounded-xl border border-border/30 bg-gradient-to-r from-background/80 to-primary/[0.03] px-5 py-4 text-sm transition-all duration-300 hover:border-primary/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="font-bold text-foreground/90">Current live price</span>
              </div>
              <span className="text-xs text-muted-foreground/60">Checked from DexScreener best Solana pair</span>
            </div>
            <div className="mt-2 text-xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
              {priceLoading ? "Loading..." : currentPrice !== null ? `$${formatUsdValue(currentPrice)}` : "Enter a valid token address to preview live price"}
            </div>
          </div>

          {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400 backdrop-blur-sm animate-in fade-in slide-in-from-top-1">{error}</div>}
          {successMessage && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 backdrop-blur-sm animate-in fade-in slide-in-from-top-1">{successMessage}</div>}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "relative inline-flex items-center justify-center rounded-xl px-6 py-3.5 text-sm font-bold transition-all duration-300 overflow-hidden group/submit",
              loading
                ? "bg-primary/40 text-primary-foreground/60 cursor-not-allowed"
                : "bg-gradient-to-r from-primary to-blue-500 text-primary-foreground hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]"
            )}
          >
            <span className="relative z-10">{loading ? "Saving alert..." : "Create Alert"}</span>
            {!loading && <div className="absolute inset-0 bg-gradient-to-r from-primary via-purple-500 to-primary opacity-0 group-hover/submit:opacity-100 transition-opacity duration-500" />}
            <span className="relative z-10">&nbsp;</span>
          </button>
        </form>
      </section>

      {/* ===== Active Alerts Section ===== */}
      <section className="col-span-12 xl:col-span-7 terminal-page-frame group p-6 md:p-8 transition-all duration-500 hover:border-primary/20 hover-lift-premium">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent opacity-40" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <h2 className="text-xl font-bold tracking-tight">Active Alerts</h2>
          <p className="mt-2 text-sm text-muted-foreground/70">Manage your active token alerts. Triggered alerts auto-disable after sending to avoid repeat spam.</p>
        </div>

        {/* Mobile cards */}
        <div className="relative z-10 mt-6 space-y-4 md:hidden">
          {alerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/30 bg-background/30 px-4 py-10 text-center text-sm text-muted-foreground/60">
              No alerts created yet. Add one to start monitoring token moves.
            </div>
          ) : (
            alerts.map((alert) => (
              <article key={alert.id} className="group/card rounded-xl border border-border/30 bg-background/40 backdrop-blur-sm p-4 space-y-4 transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold break-words">{alert.token_name || alert.token_address}</div>
                    {alert.token_name ? <div className="text-[11px] text-muted-foreground/60 break-all mt-0.5">{alert.token_address}</div> : null}
                  </div>
                  <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider", alertTypeColor(alert.alert_type), "bg-current/10")}>
                    {alertTypeIcon(alert.alert_type)}
                    <span>{alert.alert_type.replace("_", " ")}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">Threshold</div>
                    <div className="mt-1 font-bold text-primary">${formatUsdValue(alert.threshold)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">Triggered</div>
                    <div className="mt-1 font-bold">{alert.trigger_count || 0}x</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">Status</div>
                    <div className="mt-1">
                      <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest", alert.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/20 text-muted-foreground/60")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", alert.is_active ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40")} />
                        {alert.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">Last Triggered</div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(alert.last_triggered_at)}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(alert.id)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-rose-400 transition-all duration-300 hover:bg-rose-500/20 hover:shadow-lg hover:shadow-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </article>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="relative z-10 mt-6 hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/20 text-muted-foreground/60 uppercase tracking-[0.2em] text-[10px]">
                <th className="px-3 py-3">Token</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3 text-right">Threshold</th>
                <th className="px-3 py-3 text-right">Triggered</th>
                <th className="px-3 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground/50">No alerts created yet. Add one to start monitoring token moves.</td>
                </tr>
              ) : (
                alerts.map((alert) => (
                  <tr key={alert.id} className="group/row transition-all duration-300 hover:bg-primary/[0.03]">
                    <td className="px-3 py-4">
                      <div className="font-bold group-hover/row:text-primary transition-colors">{alert.token_name || alert.token_address}</div>
                      {alert.token_name && <div className="text-[11px] text-muted-foreground/50 mt-0.5">{alert.token_address}</div>}
                    </td>
                    <td className="px-3 py-4">
                      <div className={cn("flex items-center gap-1.5 font-semibold", alertTypeColor(alert.alert_type))}>
                        {alertTypeIcon(alert.alert_type)}
                        {alert.alert_type.replace("_", " ")}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-right font-bold text-primary">${formatUsdValue(alert.threshold)}</td>
                    <td className="px-3 py-4 text-right">
                      <div className="font-bold">{alert.trigger_count || 0}x</div>
                      <div className="text-[11px] text-muted-foreground/50">Last: {formatDateTime(alert.last_triggered_at)}</div>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", alert.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/20 text-muted-foreground/60")}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", alert.is_active ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40")} />
                          {alert.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(alert.id)}
                          className="group/del flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-400 transition-all duration-300 hover:bg-rose-500/25 hover:shadow-lg hover:shadow-rose-500/10 hover:scale-105"
                        >
                          <Trash2 className="h-3 w-3 group-hover/del:rotate-12 transition-transform" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
        </div>
      </div>
    </div>
  )
}
