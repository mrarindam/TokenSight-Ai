'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import LocalTime from './LocalTime'
import { cn } from '@/lib/utils'

interface Scan {
  id: string
  token_name: string
  risk_level: string
  score: number
  created_at: string
}

interface RecentActivityProps {
  userId: string
}

export default function RecentActivity({ userId }: RecentActivityProps) {
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const pageSize = 10

  const fetchScans = useCallback(async (page: number) => {
    setLoading(true)
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1

    try {
      const { data, error, count } = await supabase
        .from('scans')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(start, end)

      if (error) throw error

      setScans(data || [])
      setTotalPages(Math.ceil((count || 0) / pageSize))
    } catch (err) {
      console.error('[RECENT_ACTIVITY] Fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchScans(currentPage)
  }, [currentPage, fetchScans])

  if (loading && scans.length === 0) {
    return (
      <div className="glass rounded-3xl border border-border/50 p-12 text-center animate-pulse">
        <div className="h-4 w-1/4 bg-muted/20 mx-auto rounded mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 bg-muted/10 w-full rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <Search className="h-6 w-6 text-primary" />
          Recent Activity
        </h2>
      </div>

      <div className="glass rounded-[2rem] border border-border/40 overflow-hidden shadow-xl shadow-black/10">
        {!scans || scans.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium">No scanning data found yet. Start a scan to begin tracking intelligence.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {scans.map((scan) => {
                const isStrong = scan.score >= 80
                const isGood = scan.score >= 50

                return (
                  <article key={scan.id} className="rounded-[1.5rem] border border-border/30 bg-background/35 p-4 space-y-3">
                    <div className="font-extrabold text-sm tracking-tight break-words">{scan.token_name}</div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Risk</div>
                        <div className="mt-1">
                          <span className={cn(
                            "text-[9px] font-black px-2.5 py-1 rounded-full border shadow-sm whitespace-nowrap inline-flex items-center justify-center",
                            isStrong ? "bg-safe/20 text-safe border-safe/30" : 
                            isGood ? "bg-primary/20 text-primary border-primary/30" : 
                            "bg-danger/20 text-danger border-danger/30"
                          )}>
                            {isStrong ? 'STRONG ENTRY' : isGood ? 'GOOD ENTRY' : 'WEAK ENTRY'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Score</div>
                        <div className="mt-1 font-black">{scan.score}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Date</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        <LocalTime timestamp={scan.created_at} mode="tooltip" />
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/20 bg-muted/20">
                    <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Token</th>
                    <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap text-center">Risk Level</th>
                    <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center whitespace-nowrap">Score</th>
                    <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {scans.map((scan) => {
                    const isStrong = scan.score >= 80
                    const isGood = scan.score >= 50
                    const isPrimeHit = scan.score > 75
                    
                    return (
                      <tr key={scan.id} className="hover:bg-primary/5 transition-colors group">
                        <td className="px-4 md:px-8 py-3 md:py-4">
                          <div className="font-extrabold text-sm tracking-tight truncate max-w-[100px] md:max-w-none">{scan.token_name}</div>
                        </td>
                        <td className="px-4 md:px-8 py-3 md:py-4 text-center">
                           <span className={cn(
                             "text-[9px] md:text-[10px] font-black px-2.5 md:px-3 py-1 rounded-full border shadow-sm whitespace-nowrap inline-flex items-center justify-center min-w-[90px] md:min-w-[100px]",
                             isStrong ? "bg-safe/20 text-safe border-safe/30" : 
                             isGood ? "bg-primary/20 text-primary border-primary/30" : 
                             "bg-danger/20 text-danger border-danger/30"
                           )}>
                             {isStrong ? 'STRONG ENTRY' : isGood ? 'GOOD ENTRY' : 'WEAK ENTRY'}
                           </span>
                        </td>
                        <td className="px-4 md:px-8 py-3 md:py-4 text-center">
                          <div className={cn(
                            "font-mono text-xs md:text-sm font-black mx-auto w-fit px-2 py-0.5 rounded",
                            isPrimeHit ? "text-primary animate-pulse-glow shadow-[0_0_15px_rgba(var(--primary),0.3)] bg-primary/5" : "text-muted-foreground/80"
                          )}>
                            {scan.score}
                          </div>
                        </td>
                        <td className="px-4 md:px-8 py-3 md:py-4 text-right">
                          <div className="group relative cursor-help">
                            <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                              <LocalTime timestamp={scan.created_at} mode="smart" />
                            </div>

                            {/* Hover Tooltip for exact timestamp */}
                            <div className="absolute -top-10 right-0 px-3 py-1.5 bg-background border border-border/50 rounded-lg text-[9px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-50 pointer-events-none uppercase tracking-tighter">
                              <LocalTime timestamp={scan.created_at} mode="tooltip" />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 border-t border-border/20 py-6 bg-muted/10">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-10 w-10 rounded-xl glass border border-border/30 flex items-center justify-center hover:bg-primary/10 disabled:opacity-20 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-1.5 mx-6">
                  {[...Array(totalPages)].map((_, i) => {
                    const p = i + 1
                    if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                      return (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`h-10 w-10 rounded-xl text-xs font-black transition-all border ${currentPage === p
                              ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25'
                              : 'glass border-border/30 text-muted-foreground hover:bg-primary/5'
                            }`}
                        >
                          {p}
                        </button>
                      )
                    }
                    if (p === 2 || p === totalPages - 1) {
                      return <span key={p} className="text-muted-foreground/30 font-black px-1 text-xs">. . .</span>
                    }
                    return null
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-10 w-10 rounded-xl glass border border-border/30 flex items-center justify-center hover:bg-primary/10 disabled:opacity-20 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
