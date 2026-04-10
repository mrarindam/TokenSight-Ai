'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import Image from 'next/image'
import { useAuthFetch } from '@/lib/useAuthFetch'
import { 
  Trophy, 
  Medal, 
  Crown, 
  Flame, 
  Target, 
  Activity, 
  Users,
  TrendingUp
} from 'lucide-react'
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { LeaderboardEntry } from '@/lib/scan-analytics'

// Badge Logic (Synced with LEAGUES.ts)
const getBadge = (scans: number) => {
  if (scans >= 1000) return { label: 'DIAMOND', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', glow: 'shadow-[0_0_15px_rgba(96,165,250,0.2)]' }
  if (scans >= 500) return { label: 'PLATINUM', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20', glow: 'shadow-[0_0_15px_rgba(192,132,252,0.2)]' }
  if (scans >= 200) return { label: 'GOLD', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20', glow: 'shadow-[0_0_15px_rgba(250,204,21,0.2)]' }
  if (scans >= 50) return { label: 'SILVER', color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/20', glow: 'shadow-[0_0_15px_rgba(148,163,184,0.1)]' }
  return { label: 'BRONZE', color: 'text-amber-700', bg: 'bg-amber-700/10', border: 'border-amber-700/20', glow: 'shadow-none' }
}

// Format Name Logic
const formatName = (displayName: string | null, wallet: string | null) => {
  if (displayName) return displayName
  if (wallet) return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
  return 'Unknown'
}

// Format Accuracy Logic
const formatAccuracy = (rate: number) => {
  return `${rate.toFixed(1)}%`
}

export default function Leaderboard() {
  const { authenticated, ready } = usePrivy()
  const authFetch = useAuthFetch()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const fetchCurrentUser = useCallback(async () => {
    if (!authenticated) {
      setCurrentUserId(null)
      return
    }

    try {
      const response = await authFetch('/api/user/me', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load current user')
      }
      setCurrentUserId(data.user?.id || null)
    } catch {
      setCurrentUserId(null)
    }
  }, [authFetch, authenticated])

  const fetchLeaderboard = useCallback(async () => {
    if (!authenticated) {
      setLeaderboard([])
      setLoading(false)
      return
    }

    try {
      const response = await authFetch('/api/leaderboard', { cache: 'no-store' })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load leaderboard')
      }

      setLeaderboard(data.leaderboard || [])
    } catch (err) {
      console.error('[LEADERBOARD] Fetch Error:', err)
    } finally {
      setLoading(false)
    }
  }, [authFetch, authenticated])

  useEffect(() => {
    if (!ready) return

    fetchLeaderboard()
    if (!authenticated) return

    const interval = setInterval(fetchLeaderboard, 15000)
    return () => clearInterval(interval)
  }, [authenticated, fetchLeaderboard, ready])

  useEffect(() => {
    if (!ready) return
    void fetchCurrentUser()
  }, [fetchCurrentUser, ready])

  if (!ready) {
    return (
      <div className="flex flex-col gap-8 animate-pulse">
        <div className="flex justify-center gap-6 pt-12">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-32 h-48 glass rounded-3xl bg-muted/10 border border-border/20" />
          ))}
        </div>
        <div className="glass rounded-3xl h-96 bg-muted/10 border border-border/20" />
      </div>
    )
  }

  if (loading && leaderboard.length === 0) {
    return (
      <div className="flex flex-col gap-8 animate-pulse">
        <div className="flex justify-center gap-6 pt-12">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-32 h-48 glass rounded-3xl bg-muted/10 border border-border/20" />
          ))}
        </div>
        <div className="glass rounded-3xl h-96 bg-muted/10 border border-border/20" />
      </div>
    )
  }

  const topThree = leaderboard.slice(0, 3)
  const remaining = leaderboard.slice(3)

  return (
    <div className="w-full space-y-12 pb-20">
      {/* ===== PODIUM SECTION (TOP 3) ===== */}
      <div className="flex items-end justify-center gap-2 md:gap-8 pt-10 px-2 md:px-4">
        {/* 2nd Place */}
        {topThree[1] && (
          <div className="flex flex-col items-center gap-2 md:gap-4 group hover-lift-premium">
            <div className="relative">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl glass border border-slate-400/30 flex items-center justify-center ring-4 ring-slate-400/10 group-hover:scale-105 transition-transform duration-500 overflow-hidden shadow-lg shadow-slate-400/5">
                {topThree[1].users.avatar_url ? (
                  <Image src={topThree[1].users.avatar_url} alt="" width={80} height={80} className="w-full h-full object-cover" unoptimized />
                ) : (
                  <Users className="h-6 md:h-8 w-6 md:w-8 text-slate-400 opacity-50" />
                )}
                <div className="absolute inset-x-0 bottom-0 py-0.5 md:py-1 bg-slate-400/20 backdrop-blur-md border-t border-slate-400/30 text-[7px] md:text-[9px] font-black tracking-widest text-center uppercase">2ND</div>
              </div>
              <div className="absolute -top-2 -right-2 md:-top-3 md:-right-3 bg-slate-400 w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center border-2 md:border-4 border-background z-10">
                <Medal className="h-3 w-3 md:h-4 md:w-4 text-white" />
              </div>
            </div>
            <div className="text-center w-24 md:w-auto">
              <h3 className="font-bold text-[10px] md:text-sm tracking-tight text-foreground/90 truncate px-1">
                {formatName(topThree[1].users.display_name, topThree[1].users.wallet)}
              </h3>
              <div className="flex flex-col md:flex-row items-center justify-center gap-0 md:gap-2 mt-0.5 md:mt-1">
                <div className="text-[7px] md:text-xs font-black text-slate-400 uppercase tracking-tighter">{topThree[1].total_scans} SCANS</div>
                <div className="hidden md:block h-1 w-1 rounded-full bg-border/40" />
                <div className="flex items-center text-[7px] md:text-xs font-bold text-orange-500"><Flame className="h-2 md:h-3 w-2 md:w-3 mr-0.5 fill-current" />{topThree[1].streak}</div>
              </div>
            </div>
            <div className="w-20 md:w-32 h-12 md:h-24 bg-gradient-to-t from-slate-500/10 to-transparent border border-border/30 border-b-0 rounded-t-2xl shadow-2xl relative overflow-hidden">
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_100%)] opacity-20" />
            </div>
          </div>
        )}

        {/* 1st Place */}
        {topThree[0] && (
          <div className="flex flex-col items-center gap-2 md:gap-4 group scale-100 md:scale-110 lg:scale-125 z-20 hover-lift-premium">
            <div className="relative">
              <Crown className="absolute -top-6 md:-top-8 left-1/2 -translate-x-1/2 h-6 w-6 md:h-8 md:w-8 text-yellow-500 drop-shadow-[0_0_12px_rgba(234,179,8,0.5)] animate-bounce" />
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl glass border border-yellow-500/40 flex items-center justify-center ring-4 ring-yellow-500/20 group-hover:scale-105 transition-transform duration-500 overflow-hidden shadow-xl shadow-yellow-500/10">
                {topThree[0].users.avatar_url ? (
                  <Image src={topThree[0].users.avatar_url} alt="" width={96} height={96} className="w-full h-full object-cover" unoptimized />
                ) : (
                  <Users className="h-8 md:h-10 w-8 md:w-10 text-yellow-500 opacity-50" />
                )}
                <div className="absolute inset-x-0 bottom-0 py-0.5 md:py-1 bg-yellow-500/20 backdrop-blur-md border-t border-yellow-500/30 text-[7px] md:text-[9px] font-black tracking-widest text-center uppercase whitespace-nowrap">CYBER KING</div>
              </div>
              <div className="absolute -top-1 -right-2 md:-top-1 md:-right-3 bg-yellow-500 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 md:border-4 border-background z-10 shadow-lg shadow-yellow-500/20">
                <Trophy className="h-4 w-4 md:h-5 md:w-5 text-background" />
              </div>
            </div>
            <div className="text-center w-24 md:w-auto">
              <h3 className="font-black text-[11px] md:text-base tracking-tighter text-foreground truncate px-1">
                {formatName(topThree[0].users.display_name, topThree[0].users.wallet)}
              </h3>
              <div className="text-[6px] md:text-[8px] text-yellow-500/60 font-black uppercase tracking-[0.1em] md:tracking-[0.3em] mb-0.5 md:mb-1">Top Analyst</div>
              <div className="flex flex-col md:flex-row items-center justify-center gap-0 md:gap-2 mt-0.5 md:mt-1">
                <div className="text-[9px] md:text-xs font-black text-yellow-500 uppercase tracking-tighter">{topThree[0].total_scans} SCANS</div>
                <div className="hidden md:block h-1 w-1 rounded-full bg-border/40" />
                <div className="flex items-center text-[9px] md:text-xs font-bold text-orange-500"><Flame className="h-2.5 md:h-3 w-2.5 md:w-3 mr-0.5 fill-current" />{topThree[0].streak}</div>
              </div>
            </div>
            <div className="w-24 md:w-36 h-16 md:h-36 bg-gradient-to-t from-yellow-500/20 to-transparent border border-yellow-500/10 border-b-0 rounded-t-2xl shadow-inner relative overflow-hidden">
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(234,179,8,0.2)_0%,_transparent_100%)] opacity-30" />
               <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-2 bg-yellow-500/40 blur-md animate-pulse" />
            </div>
          </div>
        )}

        {/* 3rd Place */}
        {topThree[2] && (
          <div className="flex flex-col items-center gap-2 md:gap-4 group hover-lift-premium">
            <div className="relative">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl glass border border-amber-700/30 flex items-center justify-center ring-4 ring-amber-700/10 group-hover:scale-105 transition-transform duration-500 overflow-hidden shadow-lg shadow-amber-700/5">
                {topThree[2].users.avatar_url ? (
                  <Image src={topThree[2].users.avatar_url} alt="" width={80} height={80} className="w-full h-full object-cover" unoptimized />
                ) : (
                  <Users className="h-6 md:h-8 w-6 md:w-8 text-amber-700 opacity-50" />
                )}
                <div className="absolute inset-x-0 bottom-0 py-0.5 md:py-1 bg-amber-700/20 backdrop-blur-md border-t border-amber-700/30 text-[7px] md:text-[9px] font-black tracking-widest text-center uppercase">3RD</div>
              </div>
              <div className="absolute -top-2 -right-2 md:-top-3 md:-right-3 bg-amber-700 w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center border-2 md:border-4 border-background z-10">
                <Medal className="h-3 w-3 md:h-4 md:w-4 text-white" />
              </div>
            </div>
            <div className="text-center w-24 md:w-auto">
              <h3 className="font-bold text-[10px] md:text-sm tracking-tight text-foreground/90 truncate px-1">
                {formatName(topThree[2].users.display_name, topThree[2].users.wallet)}
              </h3>
              <div className="flex flex-col md:flex-row items-center justify-center gap-0 md:gap-2 mt-0.5 md:mt-1">
                <div className="text-[7px] md:text-xs font-black text-amber-700 uppercase tracking-tighter">{topThree[2].total_scans} SCANS</div>
                <div className="hidden md:block h-1 w-1 rounded-full bg-border/40" />
                <div className="flex items-center text-[7px] md:text-xs font-bold text-orange-500"><Flame className="h-2 md:h-3 w-2 md:w-3 mr-0.5 fill-current" />{topThree[2].streak}</div>
              </div>
            </div>
            <div className="w-20 md:w-32 h-8 md:h-16 bg-gradient-to-t from-amber-900/10 to-transparent border border-border/30 border-b-0 rounded-t-2xl shadow-2xl relative overflow-hidden">
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_100%)] opacity-20" />
            </div>
          </div>
        )}
      </div>

      {/* ===== REMAINING BOARD TABLE ===== */}
      <Card className="terminal-page-frame border-border/40 overflow-hidden shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        
        <div className="overflow-x-auto relative">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/20 bg-muted/20">
                <TableHead className="w-[60px] md:w-[80px] px-3 md:px-8 py-4 md:py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Rank</TableHead>
                <TableHead className="px-3 md:px-8 py-4 md:py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Analyst</TableHead>
                <TableHead className="hidden md:table-cell px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Identity Badge</TableHead>
                <TableHead className="px-3 md:px-8 py-4 md:py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right md:border-l border-border/10">Total Scans</TableHead>
                <TableHead className="hidden lg:table-cell px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right" title="Measures how effectively an analyst identifies strong opportunities">Intelligence Accuracy</TableHead>
                <TableHead className="hidden sm:table-cell px-4 md:px-8 py-4 md:py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right" title="Consecutive days of active scanning">Streak</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/10">
              {remaining.map((row, index) => {
                const rank = row.rank || index + 4
                const badge = getBadge(row.total_scans)
                const isYou = row.user_id === currentUserId

                return (
                  <TableRow 
                    key={row.user_id} 
                    className={`group hover:bg-primary/5 transition-all duration-300 ${isYou ? 'bg-primary/10 border-l-4 border-l-primary shadow-inner' : ''}`}
                  >
                    <TableCell className="px-3 md:px-8 py-4 md:py-5 text-center">
                      <span className="font-black text-sm text-muted-foreground group-hover:text-primary transition-colors">#{rank}</span>
                    </TableCell>
                    <TableCell className="px-3 md:px-8 py-4 md:py-5">
                      <div className="flex items-center gap-3">
                        <div className="relative h-9 w-9 rounded-xl glass border border-border/50 flex flex-shrink-0 items-center justify-center overflow-hidden">
                          {row.users.avatar_url ? (
                            <Image src={row.users.avatar_url} alt="" width={36} height={36} className="w-full h-full object-cover" unoptimized />
                          ) : (
                            <Users className="h-4 w-4 opacity-30" />
                          )}
                        </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                               <span className="font-bold text-sm tracking-tight text-foreground/90">
                                {formatName(row.users.display_name, row.users.wallet)}
                              </span>
                              {isYou && (
                                <span className="text-[9px] font-black uppercase tracking-widest bg-primary text-primary-foreground px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(var(--primary),0.4)]">
                                  YOU
                                </span>
                              )}
                            </div>
                            
                            {/* MOBILE ONLY INTELLIGENCE ROW */}
                            <div className="flex md:hidden items-center gap-2 mt-1">
                               <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border ${badge.bg} ${badge.color} ${badge.border} uppercase tracking-tighter`}>
                                {badge.label}
                               </span>
                               <div className="flex items-center gap-1 text-[8px] font-bold text-safe">
                                 <Activity className="h-2 w-2" />
                                 {formatAccuracy(row.detection_rate)}
                               </div>
                               <div className="flex items-center gap-0.5 text-[8px] font-bold text-orange-500">
                                 <Flame className="h-2 w-2 fill-current" />
                                 {row.streak}
                               </div>
                            </div>

                            <span className="text-[10px] font-medium text-muted-foreground font-mono hidden md:block">
                              {row.users.wallet?.slice(0, 8)}...{row.users.wallet?.slice(-4)}
                            </span>
                          </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-8 py-5 text-center">
                       <span className={`text-[10px] font-black px-3 py-1 rounded border shadow-sm ${badge.bg} ${badge.color} ${badge.border} ${badge.glow} uppercase tracking-tighter`}>
                        {badge.label} LEVEL
                       </span>
                    </TableCell>
                    <TableCell className="px-3 md:px-8 py-4 md:py-5 text-right font-mono font-black text-sm md:text-base text-primary md:border-l border-border/10 md:shadow-[inner_0_0_10px_rgba(var(--primary),0.05)]">
                      {row.total_scans.toLocaleString()}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                         <div className="w-16 h-1 bg-muted/20 rounded-full overflow-hidden opacity-40">
                          <div 
                            className="h-full bg-safe/60" 
                            style={{ width: `${Math.min(row.detection_rate, 100)}%` }} 
                          />
                        </div>
                        <span className="font-bold text-sm text-safe min-w-[3rem]">{formatAccuracy(row.detection_rate)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell px-4 md:px-8 py-4 md:py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 font-bold text-orange-500">
                        <Flame className="h-4 w-4 fill-current animate-pulse shadow-orange-500/50" />
                        <span className="text-sm">{row.streak}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* FOOTER INFO */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-muted-foreground/40 text-xs font-bold uppercase tracking-widest border-t border-border/20 pt-10">
        <div className="flex items-center gap-2">
           <Activity className="h-3 w-3" />
           Live Surveillance
        </div>
        <div className="h-1 w-1 rounded-full bg-border/40 hidden md:block" />
        <div className="flex items-center gap-2">
           <Target className="h-3 w-3" />
           Top 50 Ranked Analysts
        </div>
        <div className="h-1 w-1 rounded-full bg-border/40 hidden md:block" />
        <div className="flex items-center gap-2">
           <TrendingUp className="h-3 w-3" />
           Next Refresh in 5s
        </div>
      </div>
    </div>
  )
}
