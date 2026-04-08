"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { cn, fetchTokenPrice, isValidSolanaAddress } from "@/lib/utils"
import type { PortfolioRecord } from "@/types/app"
import { Wallet, TrendingUp, TrendingDown, DollarSign, BarChart3, RefreshCw, Pencil, Trash2, Plus } from "lucide-react"

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
    <div className="container max-w-7xl px-4 py-8 md:px-6 md:py-12 space-y-8 md:space-y-10">
      {/* ===== Summary Cards ===== */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Holdings", value: String(summary.totalHoldings), icon: Wallet, sub: "Tracked positions in your portfolio.", color: "from-primary/20 to-blue-500/20", iconColor: "text-primary" },
          { label: "Total Invested", value: `$${summary.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, icon: DollarSign, sub: "Based on your saved entry prices.", color: "from-purple-500/20 to-pink-500/20", iconColor: "text-purple-400" },
          { label: "Live Value", value: `$${summary.totalCurrentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, icon: BarChart3, sub: "Calculated from current market prices.", color: "from-cyan-500/20 to-blue-500/20", iconColor: "text-cyan-400" },
          { label: "Total PnL", value: `${totalPnL >= 0 ? "+" : ""}$${totalPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, icon: totalPnL >= 0 ? TrendingUp : TrendingDown, sub: `${totalRoi >= 0 ? "+" : ""}${totalRoi.toFixed(2)}% ROI`, color: totalPnL >= 0 ? "from-emerald-500/20 to-green-500/20" : "from-rose-500/20 to-red-500/20", iconColor: totalPnL >= 0 ? "text-emerald-400" : "text-rose-400" },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="group relative rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-6 overflow-hidden transition-all duration-500 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 hover:scale-[1.02]">
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500", card.color)} />
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={cn("h-4 w-4", card.iconColor)} />
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/60">{card.label}</p>
                </div>
                <div className={cn("text-3xl font-black tracking-tight", card.label === "Total PnL" ? (totalPnL >= 0 ? "text-emerald-400" : "text-rose-400") : "")}>{card.value}</div>
                <p className="mt-2 text-xs text-muted-foreground/50">{card.sub}</p>
              </div>
            </div>
          )
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)] xl:items-start">
        {/* ===== Portfolio Form ===== */}
        <section className="relative group rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-6 md:p-8 xl:sticky xl:top-28 overflow-hidden transition-all duration-500 hover:border-primary/20">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="absolute -top-16 -right-16 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/20 transition-colors" />

          <div className="relative z-10 flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20 shadow-lg shadow-primary/10">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Portfolio Tracker</h1>
          </div>
          <p className="relative z-10 text-sm text-muted-foreground/70 mb-6">
            {editingId ? "Update the selected holding and save the changes." : "Add tokens to your watchlist and keep track of holdings from one place."}
          </p>

          <form className="relative z-10 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm">
                <span className="font-semibold text-foreground/90">Token Address</span>
                <input
                  value={formState.token_address}
                  onChange={(event) => setFormState(prev => ({ ...prev, token_address: event.target.value }))}
                  disabled={Boolean(editingId)}
                  className="w-full rounded-xl border border-border/40 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-all duration-300 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 focus:shadow-lg focus:shadow-primary/5 hover:border-border/60 disabled:opacity-50"
                  placeholder="Solana / SVM token address"
                />
                <p className="text-[11px] text-muted-foreground/50">Only Solana and other SVM-compatible addresses.</p>
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-semibold text-foreground/90">Token Name</span>
                <input
                  value={formState.token_name}
                  onChange={(event) => setFormState(prev => ({ ...prev, token_name: event.target.value }))}
                  className="w-full rounded-xl border border-border/40 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-all duration-300 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 hover:border-border/60"
                  placeholder="Eg. Bonk Token"
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-semibold text-foreground/90">Quantity</span>
                <input
                  type="number"
                  step="any"
                  value={formState.quantity}
                  onChange={(event) => setFormState(prev => ({ ...prev, quantity: event.target.value }))}
                  className="w-full rounded-xl border border-border/40 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-all duration-300 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 hover:border-border/60"
                  placeholder="0.00"
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-semibold text-foreground/90">Entry Price</span>
                <input
                  type="number"
                  step="any"
                  value={formState.entry_price}
                  onChange={(event) => setFormState(prev => ({ ...prev, entry_price: event.target.value }))}
                  className="w-full rounded-xl border border-border/40 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-all duration-300 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 hover:border-border/60"
                  placeholder="USD"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm">
                <span className="font-semibold text-foreground/90">Symbol</span>
                <input
                  value={formState.token_symbol}
                  onChange={(event) => setFormState(prev => ({ ...prev, token_symbol: event.target.value }))}
                  className="w-full rounded-xl border border-border/40 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-all duration-300 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 hover:border-border/60"
                  placeholder="BONK"
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-semibold text-foreground/90">Risk Level</span>
                <select
                  value={formState.risk_level}
                  onChange={(event) => setFormState(prev => ({ ...prev, risk_level: event.target.value }))}
                  className="w-full rounded-xl border border-border/40 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-all duration-300 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 hover:border-border/60"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </label>
            </div>

            <label className="block space-y-2 text-sm">
              <span className="font-semibold text-foreground/90">Notes</span>
              <textarea
                value={formState.notes}
                onChange={(event) => setFormState(prev => ({ ...prev, notes: event.target.value }))}
                className="min-h-[80px] w-full rounded-xl border border-border/40 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-all duration-300 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 hover:border-border/60 resize-none"
                placeholder="Optional notes about this token or thesis"
              />
            </label>

            {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400 backdrop-blur-sm">{error}</div>}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "relative inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-bold transition-all duration-300 overflow-hidden sm:min-w-[170px] group/submit",
                  loading
                    ? "bg-primary/40 text-primary-foreground/60 cursor-not-allowed"
                    : "bg-gradient-to-r from-primary to-blue-500 text-primary-foreground hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]"
                )}
              >
                <span className="relative z-10">{loading ? "Saving..." : editingId ? "Update Holding" : "Add to Portfolio"}</span>
                {!loading && <div className="absolute inset-0 bg-gradient-to-r from-primary via-purple-500 to-primary opacity-0 group-hover/submit:opacity-100 transition-opacity duration-500" />}
              </button>

              {editingId ? (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex items-center justify-center rounded-xl border border-border/40 px-6 py-3 text-sm font-bold text-foreground transition-all duration-300 hover:bg-primary/5 hover:border-primary/30 sm:min-w-[140px]"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </section>

        {/* ===== Holdings Section ===== */}
        <section className="relative rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-6 md:p-8 min-w-0 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent opacity-40" />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Your Holdings</h2>
              <p className="text-sm text-muted-foreground/70">Live portfolio entries and positions you are tracking.</p>
            </div>
            <button
              onClick={fetchPortfolio}
              className="group/btn flex items-center gap-2 rounded-xl border border-border/40 bg-card/80 px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
            >
              <RefreshCw className="h-4 w-4 group-hover/btn:rotate-180 transition-transform duration-500" /> Refresh
            </button>
          </div>

          {/* Mobile cards */}
          <div className="mt-6 space-y-4 md:hidden">
            {portfolio.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/30 bg-background/30 px-4 py-10 text-center text-sm text-muted-foreground/50">
                No holdings yet. Add a token to begin monitoring your portfolio.
              </div>
            ) : (
              portfolio.map((item) => {
                const currentPrice = livePrices[item.token_address] ?? null
                const roi = currentPrice !== null ? ((currentPrice - item.entry_price) / item.entry_price) * 100 : null
                return (
                  <article key={item.id} className="group/card rounded-xl border border-border/30 bg-background/40 backdrop-blur-sm p-4 space-y-4 transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold break-words group-hover/card:text-primary transition-colors">{item.token_name}</div>
                        <div className="text-[11px] text-muted-foreground/50 break-all">{item.token_symbol || item.token_address}</div>
                      </div>
                      <span className={cn("px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest", item.risk_level === "HIGH" ? "bg-rose-500/15 text-rose-400" : item.risk_level === "LOW" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400")}>{item.risk_level}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/40">Quantity</div>
                        <div className="mt-1 font-bold break-all">{item.quantity}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/40">Entry</div>
                        <div className="mt-1 font-bold break-all">${Number(item.entry_price).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 9 })}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/40">Current</div>
                        <div className="mt-1 font-bold break-all">{currentPrice === null ? <span className="text-muted-foreground/40">--</span> : `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 9 })}`}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/40">ROI</div>
                        <div className={cn("mt-1 font-black", roi === null ? "text-muted-foreground/40" : roi >= 0 ? "text-emerald-400" : "text-rose-400")}>
                          {roi === null ? "--" : `${roi > 0 ? "+" : ""}${roi.toFixed(2)}%`}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2.5 text-xs font-bold text-primary transition-all duration-300 hover:bg-primary/20 hover:scale-[1.02]" onClick={() => handleEdit(item)}>
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-rose-500/10 px-3 py-2.5 text-xs font-bold text-rose-400 transition-all duration-300 hover:bg-rose-500/20 hover:scale-[1.02]"
                        onClick={async () => {
                          if (!window.confirm('Delete this portfolio entry?')) return
                          setLoading(true); setError(null)
                          try {
                            const response = await fetch(DEFAULT_API, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) })
                            const data = await response.json()
                            if (!response.ok) throw new Error(data?.error || 'Failed to delete entry')
                            fetchPortfolio()
                          } catch (err) { setError((err as Error).message) } finally { setLoading(false) }
                        }}
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </article>
                )
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/20 text-muted-foreground/50 uppercase tracking-[0.2em] text-[10px]">
                  <th className="px-3 py-3">Token</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-3 py-3 text-right">Entry</th>
                  <th className="px-3 py-3 text-right">Current</th>
                  <th className="px-3 py-3 text-right">ROI</th>
                  <th className="px-3 py-3 text-right">Risk</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {portfolio.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground/50">No holdings yet. Add a token to begin monitoring your portfolio.</td>
                  </tr>
                ) : (
                  portfolio.map((item) => {
                    const currentPrice = livePrices[item.token_address] ?? null
                    const roi = currentPrice !== null ? ((currentPrice - item.entry_price) / item.entry_price) * 100 : null
                    return (
                      <tr key={item.id} className="group/row transition-all duration-300 hover:bg-primary/[0.03]">
                        <td className="px-3 py-4">
                          <div className="font-bold group-hover/row:text-primary transition-colors">{item.token_name}</div>
                          <div className="text-[11px] text-muted-foreground/50">{item.token_symbol || item.token_address}</div>
                        </td>
                        <td className="px-3 py-4 text-right font-semibold">{item.quantity}</td>
                        <td className="px-3 py-4 text-right font-semibold">${Number(item.entry_price).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 9 })}</td>
                        <td className="px-3 py-4 text-right font-semibold">
                          {currentPrice === null ? <span className="text-muted-foreground/40">--</span> : `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 9 })}`}
                        </td>
                        <td className="px-3 py-4 text-right">
                          {roi === null ? <span className="text-muted-foreground/40">--</span> : (
                            <span className={cn("font-black", roi >= 0 ? "text-emerald-400" : "text-rose-400")}>
                              {roi > 0 ? "+" : ""}{roi.toFixed(2)}%
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-4 text-right">
                          <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest", item.risk_level === "HIGH" ? "bg-rose-500/15 text-rose-400" : item.risk_level === "LOW" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400")}>{item.risk_level}</span>
                        </td>
                        <td className="px-3 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-muted/15 text-muted-foreground/60">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button className="group/edit flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary transition-all duration-300 hover:bg-primary/20 hover:scale-105" onClick={() => handleEdit(item)}>
                              <Pencil className="h-3 w-3 group-hover/edit:rotate-12 transition-transform" /> Edit
                            </button>
                            <button
                              className="group/del flex items-center gap-1 rounded-xl bg-rose-500/10 text-rose-400 px-3 py-1.5 text-[11px] font-bold hover:bg-rose-500/20 hover:scale-105 transition-all duration-300"
                              onClick={async () => {
                                if (!window.confirm('Delete this portfolio entry?')) return
                                setLoading(true); setError(null)
                                try {
                                  const response = await fetch(DEFAULT_API, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) })
                                  const data = await response.json()
                                  if (!response.ok) throw new Error(data?.error || 'Failed to delete entry')
                                  fetchPortfolio()
                                } catch (err) { setError((err as Error).message) } finally { setLoading(false) }
                              }}
                            >
                              <Trash2 className="h-3 w-3 group-hover/del:rotate-12 transition-transform" /> Delete
                            </button>
                          </div>
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
