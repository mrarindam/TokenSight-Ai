"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import type { ScanHistoryRecord } from "@/types/app"

const DEFAULT_API = "/api/scan/history"

export default function ScanHistoryPage() {
  const { status } = useSession()
  const [history, setHistory] = useState<ScanHistoryRecord[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "authenticated") fetchHistory()
  }, [status])

  async function fetchHistory() {
    setError(null)
    try {
      const response = await fetch(DEFAULT_API)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Unable to load scan history")
      setHistory(data.scans || [])
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
      <div className="glass rounded-[2rem] border border-border/40 p-5 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Scan History</h1>
            <p className="mt-2 text-sm text-muted-foreground">Review your scans and see how your token thesis has evolved.</p>
          </div>
          <button
            onClick={fetchHistory}
            className="rounded-full border border-border/50 bg-background px-4 py-2 text-sm font-semibold hover:bg-primary/5"
          >
            Refresh
          </button>
        </div>

        {error && <div className="mt-6 rounded-3xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}

        <div className="mt-8 space-y-4 md:hidden">
          {history.length === 0 ? (
            <div className="rounded-[1.5rem] border border-border/30 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
              No scans found yet. Run a scan to start building your history.
            </div>
          ) : (
            history.map((item) => (
              <article key={item.id} className="rounded-[1.5rem] border border-border/30 bg-background/35 p-4 space-y-3">
                <div>
                  <div className="font-semibold break-words">{item.token_name}</div>
                  <div className="text-[11px] text-muted-foreground break-all">{item.token_symbol || item.token_address}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Score</div>
                    <div className="mt-1 font-bold">{item.score}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Risk</div>
                    <div className="mt-1 uppercase text-xs tracking-[0.16em] text-muted-foreground">{item.risk_level}</div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Created</div>
                  <div className="mt-1 text-sm text-muted-foreground">{new Date(item.created_at).toLocaleString()}</div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="mt-8 hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground uppercase tracking-[0.2em] text-[10px]">
                <th className="px-3 py-3">Token</th>
                <th className="px-3 py-3 text-right">Score</th>
                <th className="px-3 py-3 text-right">Risk</th>
                <th className="px-3 py-3 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No scans found yet. Run a scan to start building your history.</td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-3 py-4">
                      <div className="font-semibold">{item.token_name}</div>
                      <div className="text-[11px] text-muted-foreground">{item.token_symbol || item.token_address}</div>
                    </td>
                    <td className="px-3 py-4 text-right font-bold">{item.score}</td>
                    <td className="px-3 py-4 text-right uppercase text-xs tracking-[0.16em] text-muted-foreground">{item.risk_level}</td>
                    <td className="px-3 py-4 text-right text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
