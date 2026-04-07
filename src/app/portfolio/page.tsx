"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { cn, fetchTokenPrice, isValidSolanaAddress } from "@/lib/utils"
import type { PortfolioRecord } from "@/types/app"

const DEFAULT_API = "/api/portfolio"

export default function PortfolioPage() {
  const { status } = useSession()
  const [portfolio, setPortfolio] = useState<PortfolioRecord[]>([])
  const [livePrices, setLivePrices] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
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

  // Fetch live prices for all portfolio tokens
  useEffect(() => {
    if (portfolio.length > 0) {
      const fetchAllPrices = async () => {
        const prices: Record<string, number | null> = {}
        await Promise.all(
          portfolio.map(async (item) => {
            if (item.token_address) {
              prices[item.token_address] = await fetchTokenPrice(item.token_address)
            }
          })
        )
        setLivePrices(prices)
      }
      fetchAllPrices()
    } else {
      setLivePrices({})
    }
  }, [portfolio])

  const summary = portfolio.reduce(
    (acc, item) => {
      const currentPrice = livePrices[item.token_address] ?? null
      const investedValue = item.quantity * item.entry_price
      const currentValue = currentPrice !== null ? item.quantity * currentPrice : 0

      acc.totalHoldings += 1
      acc.totalInvested += investedValue
      if (currentPrice !== null) {
        acc.totalCurrentValue += currentValue
        if (currentValue >= investedValue) {
          acc.winners += 1
        } else {
          acc.losers += 1
        }
      }

      return acc
    },
    {
      totalHoldings: 0,
      totalInvested: 0,
      totalCurrentValue: 0,
      winners: 0,
      losers: 0,
    }
  )

  const totalPnL = summary.totalCurrentValue - summary.totalInvested
  const totalRoi = summary.totalInvested > 0 ? (totalPnL / summary.totalInvested) * 100 : 0

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

    if (!isValidSolanaAddress(formState.token_address)) {
      setError("Only Solana or SVM token addresses can be added to portfolio")
      setLoading(false)
      return
    }

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
      setEditingId(null)
      setFormState({ token_address: "", token_name: "", token_symbol: "", quantity: "", entry_price: "", risk_level: "MEDIUM", notes: "" })
      fetchPortfolio()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleEdit(item: PortfolioRecord) {
    setEditingId(item.id)
    setError(null)
    setFormState({
      token_address: item.token_address,
      token_name: item.token_name,
      token_symbol: item.token_symbol || "",
      quantity: String(item.quantity),
      entry_price: String(item.entry_price),
      risk_level: item.risk_level,
      notes: item.notes || "",
    })
  }

  function handleCancelEdit() {
    setEditingId(null)
    setError(null)
    setFormState({ token_address: "", token_name: "", token_symbol: "", quantity: "", entry_price: "", risk_level: "MEDIUM", notes: "" })
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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="glass rounded-[1.5rem] border border-border/40 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Holdings</p>
          <div className="mt-3 text-3xl font-bold">{summary.totalHoldings}</div>
          <p className="mt-2 text-sm text-muted-foreground">Tracked positions in your portfolio.</p>
        </div>
        <div className="glass rounded-[1.5rem] border border-border/40 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Total Invested</p>
          <div className="mt-3 text-3xl font-bold">${summary.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          <p className="mt-2 text-sm text-muted-foreground">Based on your saved entry prices and quantity.</p>
        </div>
        <div className="glass rounded-[1.5rem] border border-border/40 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Live Value</p>
          <div className="mt-3 text-3xl font-bold">${summary.totalCurrentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          <p className="mt-2 text-sm text-muted-foreground">Calculated from current market prices.</p>
        </div>
        <div className="glass rounded-[1.5rem] border border-border/40 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Total PnL</p>
          <div className={cn("mt-3 text-3xl font-bold", totalPnL >= 0 ? "text-green-600" : "text-red-500")}>
            {totalPnL >= 0 ? "+" : ""}${totalPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {totalRoi >= 0 ? "+" : ""}{totalRoi.toFixed(2)}% ROI • {summary.winners} up / {summary.losers} down
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="glass rounded-[2rem] border border-border/40 p-8">
          <h1 className="text-2xl font-bold tracking-tight">Portfolio Tracker</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {editingId ? "Update the selected holding and save the changes." : "Add tokens to your watchlist and keep track of holdings from one place."}
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm">
                <span className="font-semibold">Token Address</span>
                <input
                  value={formState.token_address}
                  onChange={(event) => setFormState(prev => ({ ...prev, token_address: event.target.value }))}
                  disabled={Boolean(editingId)}
                  className="w-full rounded-3xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary/70"
                  placeholder="Solana / SVM token address"
                />
                <p className="text-xs text-muted-foreground">Only Solana and other SVM-compatible token addresses are accepted.</p>
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
              {loading ? "Saving..." : editingId ? "Update Holding" : "Add to Portfolio"}
            </button>

            {editingId ? (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="ml-3 inline-flex items-center justify-center rounded-3xl border border-border/50 px-6 py-3 text-sm font-bold text-foreground transition hover:bg-primary/5"
              >
                Cancel
              </button>
            ) : null}
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
                  <th className="px-3 py-3 text-right">Current</th>
                  <th className="px-3 py-3 text-right">ROI</th>
                  <th className="px-3 py-3 text-right">Risk</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Edit</th>
                  <th className="px-3 py-3 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {portfolio.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No holdings yet. Add a token to begin monitoring your portfolio.</td>
                  </tr>
                ) : (
                  portfolio.map((item) => {
                    const currentPrice = livePrices[item.token_address] ?? null
                    const roi = currentPrice !== null ? ((currentPrice - item.entry_price) / item.entry_price) * 100 : null
                    return (
                      <tr key={item.id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-3 py-4">
                          <div className="font-semibold">{item.token_name}</div>
                          <div className="text-[11px] text-muted-foreground">{item.token_symbol || item.token_address}</div>
                        </td>
                        <td className="px-3 py-4 text-right">{item.quantity}</td>
                        <td className="px-3 py-4 text-right">${Number(item.entry_price).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 9 })}</td>
                        <td className="px-3 py-4 text-right">
                          {currentPrice === null ? <span className="text-muted-foreground">—</span> : `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 9 })}`}
                        </td>
                        <td className="px-3 py-4 text-right">
                          {roi === null ? <span className="text-muted-foreground">—</span> : (
                            <span className={roi >= 0 ? "text-green-600" : "text-red-500"}>
                              {roi > 0 ? "+" : ""}{roi.toFixed(2)}%
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-4 text-right">{item.risk_level}</td>
                        <td className="px-3 py-4">
                          <span className="rounded-full bg-muted/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{item.status}</span>
                        </td>
                        <td className="px-3 py-4 text-right">
                          <button
                            className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition hover:bg-primary/20"
                            title="Edit holding"
                            onClick={() => handleEdit(item)}
                          >
                            Edit
                          </button>
                        </td>
                        <td className="px-3 py-4 text-right">
                          <button
                            className="rounded-full bg-red-500/10 text-red-600 px-3 py-1 text-xs font-bold hover:bg-red-500/20 transition"
                            title="Delete entry"
                            onClick={async () => {
                              if (!window.confirm('Delete this portfolio entry?')) return
                              setLoading(true)
                              setError(null)
                              try {
                                const response = await fetch(DEFAULT_API, {
                                  method: 'DELETE',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: item.id })
                                })
                                const data = await response.json()
                                if (!response.ok) throw new Error(data?.error || 'Failed to delete entry')
                                fetchPortfolio()
                              } catch (err) {
                                setError((err as Error).message)
                              } finally {
                                setLoading(false)
                              }
                            }}
                          >Delete</button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
