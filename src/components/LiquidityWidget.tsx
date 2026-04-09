"use client"

import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, BarChart3, Droplets, Loader2, RefreshCw, TrendingUp, Waves } from "lucide-react"
import { cn } from "@/lib/utils"

interface LiquidityWidgetProps {
  tokenAddress: string
  tokenSymbol?: string
  fallbackPriceUsd?: number | null
  className?: string
}

interface LiquidityRisk {
  label: string
  severity: "high" | "medium" | "info"
}

interface LiquidityImpact {
  amountUsd: number
  tokensReceived: number
  effectivePriceUsd: number | null
  newPriceUsd: number | null
  priceImpactPct: number | null
  routePoolCount: number
}

interface LiquidityResponse {
  mint: string
  updatedAt: string
  priceUsd: number | null
  totalLiquidityUsd: number
  liquidityScore: number
  nearPriceLiquidityRatio: number
  breakdown: {
    totalLiquidityUsd: number
    dlmmLiquidityUsd: number
    dammLiquidityUsd: number
    dlmmPct: number
    dammPct: number
    dlmmPoolCount: number
    dammPoolCount: number
    totalPoolCount: number
  }
  impacts: {
    usd100: LiquidityImpact | null
    usd1000: LiquidityImpact | null
  }
  risks: LiquidityRisk[]
  pools: Array<{
    protocol: "dlmm" | "damm"
    address: string
    name: string
    launchpad: string | null
    tvlUsd: number
    currentPrice: number | null
    tokenX: {
      address: string
      symbol: string
      amount: number
      priceUsd: number | null
    }
    tokenY: {
      address: string
      symbol: string
      amount: number
      priceUsd: number | null
    }
  }>
}

function LiquidityWidgetBase({
  tokenAddress,
  tokenSymbol,
  fallbackPriceUsd,
  className,
}: LiquidityWidgetProps) {
  const [data, setData] = useState<LiquidityResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState("")

  const requestUrl = useMemo(() => {
    if (!tokenAddress) return null

    const params = new URLSearchParams({ mint: tokenAddress })
    if (fallbackPriceUsd && fallbackPriceUsd > 0) {
      params.set("priceUsd", String(fallbackPriceUsd))
    }

    return `/api/liquidity?${params.toString()}`
  }, [fallbackPriceUsd, tokenAddress])

  const loadLiquidity = useCallback(async (signal?: AbortSignal) => {
    if (!requestUrl) return

    setError("")

    try {
      const response = await fetch(requestUrl, { cache: "no-store", signal })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Failed to load liquidity")
      }

      setData(payload as LiquidityResponse)
    } catch (loadError) {
      if ((loadError as Error).name === "AbortError") return
      setError((loadError as Error).message || "Failed to load liquidity")
    } finally {
      setIsLoading(false)
    }
  }, [requestUrl])

  useEffect(() => {
    setIsLoading(true)
    const controller = new AbortController()
    void loadLiquidity(controller.signal)

    return () => controller.abort()
  }, [loadLiquidity])

  const scoreTone = useMemo(() => {
    const score = data?.liquidityScore ?? 0
    if (score >= 80) {
      return {
        label: "Strong",
        badgeClass: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
        glowClass: "shadow-emerald-500/10",
      }
    }
    if (score >= 50) {
      return {
        label: "Mixed",
        badgeClass: "border-amber-400/30 bg-amber-500/10 text-amber-200",
        glowClass: "shadow-amber-500/10",
      }
    }
    return {
      label: "Fragile",
      badgeClass: "border-rose-400/30 bg-rose-500/10 text-rose-200",
      glowClass: "shadow-rose-500/10",
    }
  }, [data?.liquidityScore])

  const insightText = useMemo(() => {
    if (!data) return "Scanning Meteora liquidity surfaces."
    if (data.breakdown.dlmmPoolCount > data.breakdown.dammPoolCount && data.nearPriceLiquidityRatio >= 70) {
      return "DLMM-led liquidity is covering the active trading zone well."
    }
    if (data.breakdown.totalPoolCount <= 1) {
      return "Execution depends on a single pool, so slippage can move fast."
    }
    if ((data.impacts.usd1000?.priceImpactPct || 0) > 5) {
      return "Larger entries should be sized carefully because impact is already elevated."
    }
    return "Liquidity is distributed across Meteora pools with moderate execution depth."
  }, [data])

  if (!tokenAddress) return null

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await loadLiquidity()
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className={cn(
      "relative overflow-hidden rounded-3xl border border-sky-500/15 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_35%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(7,16,31,0.88))] p-5 text-slate-100 shadow-[0_18px_80px_-40px_rgba(14,165,233,0.45)] transition-all duration-300 hover:border-sky-400/25 hover:shadow-[0_22px_90px_-36px_rgba(14,165,233,0.55)]",
      scoreTone.glowClass,
      className,
    )}>
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/60 to-transparent" />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-2 text-sky-200">
              <Droplets className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-sky-100/60">Liquidity Intelligence</p>
              <h3 className="mt-1 text-lg font-black tracking-tight text-white">
                Meteora depth for {tokenSymbol || "this token"}
              </h3>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-slate-300/80">{insightText}</p>
        </div>

        <button
          type="button"
          onClick={() => { void handleManualRefresh() }}
          disabled={isLoading || isRefreshing}
          className="flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {(isLoading || isRefreshing) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {data?.updatedAt ? `Updated ${new Date(data.updatedAt).toLocaleTimeString()}` : "Load liquidity"}
        </button>
      </div>

      {isLoading && !data ? <LiquiditySkeleton /> : null}

      {!isLoading && error && !data ? (
        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Liquidity feed unavailable</p>
              <p className="mt-1 text-rose-100/80">{error}</p>
              <button
                onClick={() => {
                  setIsLoading(true)
                  void loadLiquidity()
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {data && data.breakdown.totalPoolCount === 0 ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
          No Meteora DLMM or DAMM v2 pools were detected for this mint yet.
        </div>
      ) : null}

      {data && data.breakdown.totalPoolCount > 0 ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard
                icon={BarChart3}
                label="Liquidity Score"
                value={String(data.liquidityScore)}
                accent={scoreTone.badgeClass}
                trailing={scoreTone.label}
              />
              <MetricCard
                icon={Droplets}
                label="Total Liquidity"
                value={formatCurrency(data.totalLiquidityUsd)}
              />
              <MetricCard
                icon={Waves}
                label="Near Price Coverage"
                value={`${data.nearPriceLiquidityRatio}%`}
              />
              <MetricCard
                icon={TrendingUp}
                label="Pool Count"
                value={String(data.breakdown.totalPoolCount)}
                trailing={`${data.breakdown.dlmmPoolCount} DLMM / ${data.breakdown.dammPoolCount} DAMM`}
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Liquidity Split</p>
                  <h4 className="mt-1 text-sm font-bold text-white">DLMM versus DAMM v2</h4>
                </div>
                <span className="rounded-full border border-slate-300/10 bg-slate-200/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                  {formatCurrency(data.breakdown.totalLiquidityUsd)} total
                </span>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-900/80">
                <div className="flex h-full w-full">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-[width] duration-700"
                    style={{ width: `${data.breakdown.dlmmPct}%` }}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-cyan-300 transition-[width] duration-700"
                    style={{ width: `${data.breakdown.dammPct}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <SplitCard
                  label="DLMM"
                  percentage={data.breakdown.dlmmPct}
                  liquidityUsd={data.breakdown.dlmmLiquidityUsd}
                  poolCount={data.breakdown.dlmmPoolCount}
                  tone="emerald"
                />
                <SplitCard
                  label="DAMM v2"
                  percentage={data.breakdown.dammPct}
                  liquidityUsd={data.breakdown.dammLiquidityUsd}
                  poolCount={data.breakdown.dammPoolCount}
                  tone="sky"
                />
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <ImpactCard label="$100 Swap" impact={data.impacts.usd100} />
              <ImpactCard label="$1,000 Swap" impact={data.impacts.usd1000} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Risk Signals</p>
                  <h4 className="mt-1 text-sm font-bold text-white">Execution warnings</h4>
                </div>
                {error ? (
                  <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200">
                    Partial refresh issue
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {data.risks.map((risk) => (
                  <span
                    key={risk.label}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-transform duration-200 hover:-translate-y-0.5",
                      risk.severity === "high" && "border-rose-400/20 bg-rose-500/10 text-rose-100",
                      risk.severity === "medium" && "border-amber-300/20 bg-amber-500/10 text-amber-100",
                      risk.severity === "info" && "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
                    )}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {risk.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Top Meteora Pools</p>
              <div className="mt-4 space-y-2.5">
                {data.pools.slice(0, 4).map((pool) => (
                  <div
                    key={pool.address}
                    className="group flex items-center justify-between rounded-2xl border border-white/8 bg-slate-950/40 px-3 py-3 transition-all duration-200 hover:border-sky-400/20 hover:bg-slate-950/60"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.25em]",
                          pool.protocol === "dlmm"
                            ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                            : "border-sky-400/20 bg-sky-500/10 text-sky-100"
                        )}>
                          {pool.protocol}
                        </span>
                        {pool.launchpad ? (
                          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{pool.launchpad}</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-white">{pool.name}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {pool.tokenX.symbol}/{pool.tokenY.symbol}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-black text-white">{formatCurrency(pool.tvlUsd)}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Spot {pool.currentPrice ? formatPrice(pool.currentPrice) : "Unavailable"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  trailing,
  accent,
}: {
  icon: typeof Droplets
  label: string
  value: string
  trailing?: string
  accent?: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-2 text-sky-100">
          <Icon className="h-4 w-4" />
        </div>
        {accent ? <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em]", accent)}>{trailing}</span> : null}
      </div>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
      {!accent && trailing ? <p className="mt-1 text-xs text-slate-400">{trailing}</p> : null}
    </div>
  )
}

function SplitCard({
  label,
  percentage,
  liquidityUsd,
  poolCount,
  tone,
}: {
  label: string
  percentage: number
  liquidityUsd: number
  poolCount: number
  tone: "emerald" | "sky"
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-white">{label}</p>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.25em]",
          tone === "emerald" ? "bg-emerald-500/10 text-emerald-200" : "bg-sky-500/10 text-sky-100"
        )}>
          {percentage}%
        </span>
      </div>
      <p className="mt-3 text-lg font-black text-white">{formatCurrency(liquidityUsd)}</p>
      <p className="mt-1 text-xs text-slate-400">{poolCount} pool{poolCount === 1 ? "" : "s"}</p>
    </div>
  )
}

function ImpactCard({ label, impact }: { label: string; impact: LiquidityImpact | null }) {
  const severityClass = !impact?.priceImpactPct
    ? "text-slate-300"
    : impact.priceImpactPct >= 5
      ? "text-rose-200"
      : impact.priceImpactPct >= 2
        ? "text-amber-200"
        : "text-emerald-200"

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Price Impact</p>
          <h4 className="mt-1 text-sm font-bold text-white">{label}</h4>
        </div>
        <span className={cn("text-lg font-black", severityClass)}>
          {impact?.priceImpactPct != null ? `${impact.priceImpactPct}%` : "Unavailable"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Eff. Price</p>
          <p className="mt-2 font-semibold text-white">{impact?.effectivePriceUsd ? formatPrice(impact.effectivePriceUsd) : "Unavailable"}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Routes</p>
          <p className="mt-2 font-semibold text-white">{impact?.routePoolCount ?? 0}</p>
        </div>
      </div>
    </div>
  )
}

function LiquiditySkeleton() {
  return (
    <div className="mt-5 animate-pulse space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl border border-white/10 bg-white/5" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="h-48 rounded-2xl border border-white/10 bg-white/5" />
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="h-32 rounded-2xl border border-white/10 bg-white/5" />
            <div className="h-32 rounded-2xl border border-white/10 bg-white/5" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-40 rounded-2xl border border-white/10 bg-white/5" />
          <div className="h-56 rounded-2xl border border-white/10 bg-white/5" />
        </div>
      </div>
    </div>
  )
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)
}

function formatPrice(value: number): string {
  if (value >= 1) return formatCurrency(value)
  return `$${value.toFixed(value >= 0.01 ? 4 : 8)}`
}

export const LiquidityWidget = memo(LiquidityWidgetBase)