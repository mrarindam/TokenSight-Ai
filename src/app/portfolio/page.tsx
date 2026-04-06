"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import type { PortfolioRecord } from "@/types/app"

const DEFAULT_API = "/api/portfolio"

export default function PortfolioPage() {
  const { status } = useSession()
  const [portfolio, setPortfolio] = useState<PortfolioRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formState, setFormState] = useState({
    token_address: "",
    token_name: "",
    token_symbol: "",
    quantity: "",
    entry_price: "",
    risk_level: "MEDIUM",
    notes: "",
  })

  useEffect(() => {
    if (status === "authenticated") {
      fetchPortfolio()
    }
  }, [status])

  async function fetchPortfolio() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(DEFAULT_API)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Unable to load portfolio")
      setPortfolio(data.portfolio || [])
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

    try {
      const body = {
        token_address: formState.token_address,
        token_name: formState.token_name,
        token_symbol: formState.token_symbol,
        quantity: Number(formState.quantity),
        entry_price: Number(formState.entry_price),
        risk_level: formState.risk_level,
        notes: formState.notes,
      }

      const response = await fetch(DEFAULT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data?.error || "Unable to save portfolio item")
      setFormState({ token_address: "", token_name: "", token_symbol: "", quantity: "", entry_price: "", risk_level: "MEDIUM", notes: "" })
      fetchPortfolio()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading") {
    return <div className="container py-16">Loading portfolio...</div>
  }

  if (status !== "authenticated") {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-3xl font-bold">Portfolio</h1>
        <p className="mt-4 text-sm text-muted-foreground">Log in to track holdings, entry price, and ROI for scanned tokens.</p>
      </div>
    )
  }

  return (
    <div className="container max-w-6xl py-12 space-y-10">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="glass rounded-[2rem] border border-border/40 p-8">
          <h1 className="text-2xl font-bold tracking-tight">Portfolio Tracker</h1>
          <p className="mt-2 text-sm text-muted-foreground">Add tokens to your watchlist and keep track of holdings from one place.</p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm">
                <span className="font-semibold">Token Address</span>
                <input
                  value={formState.token_address}
                  onChange={(event) => setFormState(prev => ({ ...prev, token_address: event.target.value }))}
                  className="w-full rounded-3xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
                  placeholder="Eg. ABC123..."
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-semibold">Token Name</span>
                <input
                  value={formState.token_name}
                  onChange={(event) => setFormState(prev => ({ ...prev, token_name: event.target.value }))}
                  className="w-full rounded-3xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
                  placeholder="Eg. Bonk Token"
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-semibold">Quantity</span>
                <input
                  type="number"
                  step="any"
                  value={formState.quantity}
                  onChange={(event) => setFormState(prev => ({ ...prev, quantity: event.target.value }))}
                  className="w-full rounded-3xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
                  placeholder="0.00"
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-semibold">Entry Price</span>
                <input
                  type="number"
                  step="any"
                  value={formState.entry_price}
                  onChange={(event) => setFormState(prev => ({ ...prev, entry_price: event.target.value }))}
                  className="w-full rounded-3xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
                  placeholder="USD"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm">
                <span className="font-semibold">Symbol</span>
                <input
                  value={formState.token_symbol}
                  onChange={(event) => setFormState(prev => ({ ...prev, token_symbol: event.target.value }))}
                  className="w-full rounded-3xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
                  placeholder="BONK"
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-semibold">Risk Level</span>
                <select
                  value={formState.risk_level}
                  onChange={(event) => setFormState(prev => ({ ...prev, risk_level: event.target.value }))}
                  className="w-full rounded-3xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </label>
            </div>

            <label className="block space-y-2 text-sm">
              <span className="font-semibold">Notes</span>
              <textarea
                value={formState.notes}
                onChange={(event) => setFormState(prev => ({ ...prev, notes: event.target.value }))}
                className="min-h-[96px] w-full rounded-3xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
                placeholder="Optional notes about this token or thesis"
              />
            </label>

            {error && <div className="rounded-3xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "inline-flex items-center justify-center rounded-3xl px-6 py-3 text-sm font-bold transition",
                loading ? "bg-primary/50 text-background cursor-not-allowed" : "bg-primary text-background hover:bg-primary/90"
              )}
            >
              {loading ? "Saving..." : "Add to Portfolio"}
            </button>
          </form>
        </section>

        <section className="glass rounded-[2rem] border border-border/40 p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Your Holdings</h2>
              <p className="text-sm text-muted-foreground">Live portfolio entries and positions you are tracking.</p>
            </div>
            <button
              onClick={fetchPortfolio}
              className="rounded-full border border-border/50 bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-primary/5"
            >
              Refresh
            </button>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/30 text-muted-foreground uppercase tracking-[0.2em] text-[10px]">
                  <th className="px-3 py-3">Token</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-3 py-3 text-right">Entry</th>
                  <th className="px-3 py-3 text-right">Risk</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {portfolio.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No holdings yet. Add a token to begin monitoring your portfolio.</td>
                  </tr>
                ) : (
                  portfolio.map((item) => (
                    <tr key={item.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-3 py-4">
                        <div className="font-semibold">{item.token_name}</div>
                        <div className="text-[11px] text-muted-foreground">{item.token_symbol || item.token_address}</div>
                      </td>
                      <td className="px-3 py-4 text-right">{item.quantity}</td>
                      <td className="px-3 py-4 text-right">${item.entry_price.toFixed(4)}</td>
                      <td className="px-3 py-4 text-right">{item.risk_level}</td>
                      <td className="px-3 py-4">
                        <span className="rounded-full bg-muted/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{item.status}</span>
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
  )
}
