"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { cn, fetchTokenPrice, isValidSolanaAddress } from "@/lib/utils"
import type { PriceAlertRecord } from "@/types/app"

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

export default function AlertsPage() {
  const { status } = useSession()
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

  useEffect(() => {
    if (status === "authenticated") {
      fetchAlerts()
    }
  }, [status])

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

  async function fetchAlerts() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(DEFAULT_API)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Unable to load alerts")
      setAlerts(data.alerts || [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

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

      const response = await fetch(DEFAULT_API, {
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
      const response = await fetch(DEFAULT_API, {
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

  if (status === "loading") {
    return <div className="container py-16">Loading alerts...</div>
  }

  if (status !== "authenticated") {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-3xl font-bold">Alerts</h1>
        <p className="mt-4 text-sm text-muted-foreground">Log in to create token alerts and monitor score or price changes.</p>
      </div>
    )
  }

  return (
    <div className="container max-w-6xl px-4 py-8 md:px-6 md:py-12 space-y-8 md:space-y-10">
      <section className="glass rounded-[2rem] border border-border/40 p-5 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alerts Center</h1>
            <p className="text-sm text-muted-foreground">Create automatic alerts for price movement or score changes.</p>
          </div>
          <button
            onClick={fetchAlerts}
            className="rounded-full border border-border/50 bg-background px-4 py-2 text-sm font-semibold hover:bg-primary/5"
          >
            Refresh
          </button>
        </div>

        <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm">
              <span className="font-semibold">Token Address</span>
              <input
                value={formState.token_address}
                onChange={(event) => setFormState(prev => ({ ...prev, token_address: event.target.value }))}
                className="w-full rounded-3xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
                placeholder="Solana / SVM token address"
              />
              <p className="text-xs text-muted-foreground">Alerts support Solana and SVM-compatible token addresses only.</p>
            </label>
            <label className="block space-y-2 text-sm">
              <span className="font-semibold">Token Name</span>
              <input
                value={formState.token_name}
                onChange={(event) => setFormState(prev => ({ ...prev, token_name: event.target.value }))}
                className="w-full rounded-3xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-2 text-sm">
              <span className="font-semibold">Alert Type</span>
              <select
                value={formState.alert_type}
                onChange={(event) => setFormState(prev => ({ ...prev, alert_type: event.target.value }))}
                className="w-full rounded-3xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
              >
                <option value="PRICE_DROP">Price Drop</option>
                <option value="PRICE_RISE">Price Rise</option>
                <option value="SCORE_CHANGE">Score Change</option>
              </select>
            </label>
            <label className="block space-y-2 text-sm">
              <span className="font-semibold">Comparison</span>
              <select
                value={formState.comparison_type}
                onChange={(event) => setFormState(prev => ({ ...prev, comparison_type: event.target.value }))}
                className="w-full rounded-3xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
              >
                <option value="BELOW">Below</option>
                <option value="ABOVE">Above</option>
                <option value="CHANGE_BY_PERCENT">Change %</option>
              </select>
            </label>
            <label className="block space-y-2 text-sm">
              <span className="font-semibold">Threshold</span>
              <input
                type="number"
                step="any"
                value={formState.threshold}
                onChange={(event) => setFormState(prev => ({ ...prev, threshold: event.target.value }))}
                className="w-full rounded-3xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
                placeholder="Value"
              />
            </label>
          </div>

          <div className="rounded-3xl border border-border/40 bg-background/60 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">Current live price</span>
              <span className="text-muted-foreground">Checked from DexScreener best Solana pair</span>
            </div>
            <div className="mt-2 text-lg font-bold">
              {priceLoading ? "Loading..." : currentPrice !== null ? `$${formatUsdValue(currentPrice)}` : "Enter a valid token address to preview live price"}
            </div>
          </div>

          {error && <div className="rounded-3xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}
          {successMessage && <div className="rounded-3xl border border-green-400/25 bg-green-500/10 px-4 py-3 text-sm text-green-600">{successMessage}</div>}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "inline-flex items-center justify-center rounded-3xl px-6 py-3 text-sm font-bold transition",
              loading ? "bg-primary/50 text-background cursor-not-allowed" : "bg-primary text-background hover:bg-primary/90"
            )}
          >
            {loading ? "Saving alert..." : "Create Alert"}
          </button>
        </form>
      </section>

      <section className="glass rounded-[2rem] border border-border/40 p-5 md:p-8">
        <h2 className="text-xl font-bold tracking-tight">Active Alerts</h2>
        <p className="mt-2 text-sm text-muted-foreground">Manage your active token alerts, review thresholds, and see when alerts last fired. Triggered alerts auto-disable after sending to avoid repeat spam.</p>

        <div className="mt-6 space-y-4 md:hidden">
          {alerts.length === 0 ? (
            <div className="rounded-[1.5rem] border border-border/30 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
              No alerts created yet. Add one to start monitoring token moves.
            </div>
          ) : (
            alerts.map((alert) => (
              <article key={alert.id} className="rounded-[1.5rem] border border-border/30 bg-background/35 p-4 space-y-4">
                <div className="min-w-0">
                  <div className="font-semibold break-words">{alert.token_name || alert.token_address}</div>
                  {alert.token_name ? <div className="text-[11px] text-muted-foreground break-all">{alert.token_address}</div> : null}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Type</div>
                    <div className="mt-1 font-semibold">{alert.alert_type.replace("_", " ")}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Threshold</div>
                    <div className="mt-1 font-semibold break-all">${formatUsdValue(alert.threshold)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Triggered</div>
                    <div className="mt-1 font-semibold">{alert.trigger_count || 0}x</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Status</div>
                    <div className="mt-1">
                      <span className="rounded-full bg-muted/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{alert.is_active ? "ACTIVE" : "INACTIVE"}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Last Triggered</div>
                  <div className="mt-1 text-sm text-foreground">{formatDateTime(alert.last_triggered_at)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(alert.id)}
                  className="w-full rounded-full border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-500 transition hover:bg-red-500/15"
                >
                  Delete
                </button>
              </article>
            ))
          )}
        </div>

        <div className="mt-6 hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground uppercase tracking-[0.2em] text-[10px]">
                <th className="px-3 py-3">Token</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3 text-right">Threshold</th>
                <th className="px-3 py-3 text-right">Triggered</th>
                <th className="px-3 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No alerts created yet. Add one to start monitoring token moves.</td>
                </tr>
              ) : (
                alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-3 py-4">
                      <div className="font-semibold">{alert.token_name || alert.token_address}</div>
                      {alert.token_name && <div className="text-[11px] text-muted-foreground">{alert.token_address}</div>}
                    </td>
                    <td className="px-3 py-4">{alert.alert_type.replace("_", " ")}</td>
                    <td className="px-3 py-4 text-right">${formatUsdValue(alert.threshold)}</td>
                    <td className="px-3 py-4 text-right">
                      <div className="font-semibold">{alert.trigger_count || 0}x</div>
                      <div className="text-[11px] text-muted-foreground">Last: {formatDateTime(alert.last_triggered_at)}</div>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="rounded-full bg-muted/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{alert.is_active ? "ACTIVE" : "INACTIVE"}</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(alert.id)}
                          className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-500 transition hover:bg-red-500/15"
                        >
                          Delete
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
  )
}
