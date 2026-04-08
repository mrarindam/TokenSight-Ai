"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import type { ScanHistoryRecord } from "@/types/app"
import { ChevronLeft, ChevronRight, History, RefreshCw, Search } from "lucide-react"
import { cn } from "@/lib/utils"

const DEFAULT_API = "/api/scan/history"
const PAGE_SIZE = 10

const riskColor = (risk: string) => {
  const r = risk?.toUpperCase()
  if (r === "STRONG OPPORTUNITY") return "text-emerald-400 bg-emerald-500/15"
  if (r === "GOOD ENTRY") return "text-cyan-400 bg-cyan-500/15"
  if (r === "WATCH SIGNAL") return "text-amber-400 bg-amber-500/15"
  return "text-rose-400 bg-rose-500/15"
}

const scoreGlow = (score: number) => {
  if (score >= 75) return "text-emerald-400"
  if (score >= 60) return "text-cyan-400"
  if (score >= 40) return "text-amber-400"
  return "text-rose-400"
}

export default function ScanHistoryPage() {
  const { status } = useSession()
  const [history, setHistory] = useState<ScanHistoryRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (status === "authenticated") {
      void fetchHistory(currentPage)
    }
  }, [status, currentPage])

  async function fetchHistory(page: number) {
    setError(null)
    try {
      const response = await fetch(`${DEFAULT_API}?page=${page}&pageSize=${PAGE_SIZE}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Unable to load scan history")
      setHistory(data.scans || [])
      setCurrentPage(data.page || page)
      setTotalPages(Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || PAGE_SIZE))))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (status === "loading") {
    return <div className="container py-16">Loading scan history...</div>
  }

  if (status !== "authenticated") {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-3xl font-bold">Scan History</h1>
        <p className="mt-4 text-sm text-muted-foreground">Log in to review your past scans and intelligence signals.</p>
      </div>
    )
  }

  return (
    <div className="container max-w-6xl px-4 py-8 md:px-6 md:py-12 space-y-8">
      <div className="relative group rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-6 md:p-8 overflow-hidden transition-all duration-500 hover:border-primary/20">
        {/* Top accent */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-primary/20 border border-purple-500/20 shadow-lg shadow-purple-500/10">
              <History className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Scan History</h1>
              <p className="mt-1 text-sm text-muted-foreground/70">Review your scans and see how your token thesis has evolved.</p>
            </div>
          </div>
          <button
            onClick={() => void fetchHistory(currentPage)}
            className="group/btn flex items-center gap-2 rounded-xl border border-border/40 bg-card/80 px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
          >
            <RefreshCw className="h-4 w-4 group-hover/btn:rotate-180 transition-transform duration-500" /> Refresh
          </button>
        </div>

        {error && <div className="relative z-10 mt-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">{error}</div>}

        {/* Mobile cards */}
        <div className="relative z-10 mt-8 space-y-4 md:hidden">
          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/30 bg-background/30 px-4 py-10 text-center text-sm text-muted-foreground/50 flex flex-col items-center gap-3">
              <Search className="h-6 w-6 text-muted-foreground/30" />
              No scans found yet. Run a scan to start building your history.
            </div>
          ) : (
            history.map((item) => (
              <article key={item.id} className="group/card rounded-xl border border-border/30 bg-background/40 backdrop-blur-sm p-4 space-y-3 transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold break-words group-hover/card:text-primary transition-colors">{item.token_name}</div>
                    <div className="text-[11px] text-muted-foreground/50 break-all">{item.token_symbol || item.token_address}</div>
                  </div>
                  <div className={cn("text-2xl font-black tabular-nums", scoreGlow(item.score))}>{item.score}</div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={cn("px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest", riskColor(item.risk_level))}>{item.risk_level}</span>
                  <span className="text-[11px] text-muted-foreground/40">{new Date(item.created_at).toLocaleString()}</span>
                </div>
              </article>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="relative z-10 mt-8 hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/20 text-muted-foreground/50 uppercase tracking-[0.2em] text-[10px]">
                <th className="px-3 py-3">Token</th>
                <th className="px-3 py-3 text-center">Score</th>
                <th className="px-3 py-3 text-center">Risk</th>
                <th className="px-3 py-3 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground/50">No scans found yet. Run a scan to start building your history.</td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="group/row transition-all duration-300 hover:bg-primary/[0.03]">
                    <td className="px-3 py-4">
                      <div className="font-bold group-hover/row:text-primary transition-colors">{item.token_name}</div>
                      <div className="text-[11px] text-muted-foreground/50 mt-0.5">{item.token_symbol || item.token_address}</div>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className={cn("text-xl font-black tabular-nums", scoreGlow(item.score))}>{item.score}</span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className={cn("inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest", riskColor(item.risk_level))}>{item.risk_level}</span>
                    </td>
                    <td className="px-3 py-4 text-right text-[11px] text-muted-foreground/50">{new Date(item.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="relative z-10 mt-8 flex items-center justify-center gap-1 border-t border-border/15 pt-6">
            <button
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="h-10 w-10 rounded-xl border border-border/30 flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 disabled:opacity-20 transition-all duration-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 mx-4">
              {Array.from({ length: totalPages }).map((_, index) => {
                const page = index + 1
                if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "h-10 w-10 rounded-xl text-xs font-black transition-all duration-300 border",
                        currentPage === page
                          ? "bg-gradient-to-r from-primary to-blue-500 text-primary-foreground border-primary shadow-lg shadow-primary/25 scale-110"
                          : "border-border/30 text-muted-foreground/60 hover:bg-primary/5 hover:border-primary/30"
                      )}
                    >
                      {page}
                    </button>
                  )
                }
                if (page === 2 || page === totalPages - 1) {
                  return <span key={page} className="px-1 text-xs font-black text-muted-foreground/20">...</span>
                }
                return null
              })}
            </div>

            <button
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="h-10 w-10 rounded-xl border border-border/30 flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 disabled:opacity-20 transition-all duration-300"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
