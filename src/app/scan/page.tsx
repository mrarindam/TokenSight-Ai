"use client"

import { useState, useEffect, useRef, Suspense, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { getAnonScanCount, incrementAnonScanCount, isAnonLimitReached, getRemainingScans, SCAN_CONFIG } from "@/lib/anon-scans"
import { cn } from "@/lib/utils"

import {
  Search,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Sparkles,
  Lock,
  ArrowRight,
  Droplets,
  Activity,
  Users,
  WalletCards,
  Zap,
  DollarSign,
  Skull,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScanQuickActions } from "@/components/ScanQuickActions"
import { TokenChart } from "@/components/TokenChart"
import { SwapWidget } from "@/components/SwapWidget"

interface ScanResult {
  score: number;
  label: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  signals: string[];
  explanation: string;
  contractName: string;
  meta?: {
    liquidity: number;
    volume: number;
    holders: number;
    creator_tokens: number | null;
    website?: string | null;
    twitter?: string | null;
    status?: string;
    price?: number | null;
    topHolderPct?: number | null;
    topHolderLabel?: string;
    whaleWarning?: boolean;
    holderBreakdown?: Array<{
      rank: number;
      pct: number;
    }>;
    ageHours?: number | null;
    scoring?: {
      quality: number;
      momentum: number;
      confidenceScore: number;
      riskCap: number;
      dataCoverage: number;
      metadataTrust: number;
    };
  };
}

export type { ScanResult }

const renderHighlightedSummary = (text: string) => {
  if (!text) return null

  const highlights = [
    {
      words: ["strong", "solid", "healthy", "favorable", "stable", "accumulation"],
      colorClass: "text-green-400",
      shadow: "0 0 8px rgba(74,222,128,0.6)",
    },
    {
      words: ["moderate", "developing", "early", "monitoring"],
      colorClass: "text-blue-400",
      shadow: "0 0 8px rgba(96,165,250,0.6)",
    },
    {
      words: ["weak", "low", "limited", "uncertainty"],
      colorClass: "text-yellow-400",
      shadow: "0 0 8px rgba(250,204,21,0.6)",
    },
    {
      words: ["suspicious", "unusual", "extreme", "critical"],
      colorClass: "text-red-400",
      shadow: "0 0 8px rgba(248,113,113,0.6)",
    },
  ]

  const wordMap = new Map()
  highlights.forEach(({ words, colorClass, shadow }) => {
    words.forEach((word) => wordMap.set(word.toLowerCase(), { colorClass, shadow }))
  })

  const allWords = Array.from(wordMap.keys())
  const regex = new RegExp(`\\b(${allWords.join("|")})\\b`, "gi")
  const parts = text.split(regex)

  return parts.map((part, i) => {
    const lowerPart = part.toLowerCase()
    if (wordMap.has(lowerPart)) {
      const styleInfo = wordMap.get(lowerPart)
      return (
        <span
          key={i}
          className={`${styleInfo.colorClass} font-bold`}
          style={{ textShadow: styleInfo.shadow }}
        >
          {part}
        </span>
      )
    }
    return part
  })
}

const formatReadablePrice = (value: number | null | undefined) => {
  if (value === null || value === undefined || value <= 0) return "N/A"
  if (value >= 1) {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
  }
  if (value >= 0.01) {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`
  }

  const decimals = value >= 0.0001 ? 8 : value >= 0.000001 ? 10 : 12
  const fixed = value.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "")
  return `$${fixed}`
}

const formatHolderBreakdownLine = (rank: number, pct: number) => {
  const walletLabel = rank === 1 ? "Wallet 1" : `Wallet ${rank}`
  return `${walletLabel}: ${pct}%`
}

function ScanPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const urlAddress = searchParams.get("address")

  const [address, setAddress] = useState(urlAddress || "")
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [scanPhase, setScanPhase] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [limitAlert, setLimitAlert] = useState(false)
  const hasStartedScan = useRef<string | null>(null)

  const isAuthenticated = !!session?.user
  const [anonCount, setAnonCount] = useState(0)
  const [remaining, setRemaining] = useState(SCAN_CONFIG.LIMIT)
  const [limitReached, setLimitReached] = useState(false)

  useEffect(() => {
    setAnonCount(getAnonScanCount())
    setRemaining(getRemainingScans())
    setLimitReached(!isAuthenticated && isAnonLimitReached())
  }, [isAuthenticated])

  const handleScan = useCallback(async (targetAddress = address) => {
    if (!targetAddress || isScanning) return
    if (limitReached) {
      setLimitAlert(true)
      return
    }

    setIsScanning(true)
    setResult(null)
    setLimitAlert(false)
    setErrorMsg("")
    setScanPhase("Connecting to blockchain data provider...")

    try {
      setTimeout(() => setScanPhase("Analyzing market data and holder dynamics..."), 800)
      setTimeout(() => setScanPhase("Calculating opportunity score..."), 1500)

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: targetAddress,
          anonCount: anonCount
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to scan token")
      if (data.code === 'LIMIT_REACHED') {
        setLimitAlert(true)
        return
      }

      setResult(data)
      if (!isAuthenticated) {
        incrementAnonScanCount()
        setAnonCount(getAnonScanCount())
        setRemaining(getRemainingScans())
        setLimitReached(isAnonLimitReached())
      }
      router.refresh()
    } catch (err: unknown) {
      const error = err as Error
      setErrorMsg(error.message || "An unexpected error occurred.")
    } finally {
      setIsScanning(false)
      setScanPhase("")
    }
  }, [address, isScanning, limitReached, anonCount, isAuthenticated, router])

  useEffect(() => {
    if (urlAddress) {
      // Force scroll to top immediately on navigation from feed
      window.scrollTo(0, 0)
      
      if (!isScanning && !result && !errorMsg) {
        if (limitReached) {
          setLimitAlert(true)
          return
        }
        if (hasStartedScan.current === urlAddress) return
        hasStartedScan.current = urlAddress
        handleScan(urlAddress)
      }
    }
  }, [urlAddress, limitReached, isScanning, result, errorMsg, handleScan])

  // Post-scan stabilization: Ensure user stays at top to see the results from start
  useEffect(() => {
    if (result && !isScanning) {
      // Use a micro-task delay to ensure the DOM has rendered the new result state
      const timer = setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [result, isScanning])

  const getSignalStyle = (scoreValue: number) => {
    if (scoreValue <= 30) {
      return {
        color: "text-red-500",
        bgColor: "bg-red-500",
        glowClass: "glow-danger shadow-red-500/10",
        badgeClass: "bg-red-500/10 text-red-500 border-red-500/20",
        icon: <ShieldAlert className="h-3.5 w-3.5" />,
        label: "WEAK ENTRY",
      }
    } else if (scoreValue < 60) {
      return {
        color: "text-yellow-500",
        bgColor: "bg-yellow-500",
        glowClass: "glow-warning border-yellow-500/20 shadow-yellow-500/5",
        badgeClass: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        label: "WATCH SIGNAL",
      }
    } else if (scoreValue < 85) {
      return {
        color: "text-blue-500",
        bgColor: "bg-blue-500",
        glowClass: "glow-primary border-blue-500/20 shadow-blue-500/10",
        badgeClass: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        icon: <Zap className="h-3.5 w-3.5" />,
        label: "GOOD ENTRY",
      }
    } else {
      return {
        color: "text-green-500",
        bgColor: "bg-green-500",
        glowClass: "glow-safe shadow-green-500/10",
        badgeClass: "bg-green-500/10 text-green-500 border-green-500/20",
        icon: <ShieldCheck className="h-3.5 w-3.5" />,
        label: "STRONG ENTRY",
      }
    }
  }

  // --- Score Animation Logic ---
  const [animatedScore, setAnimatedScore] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)

  useEffect(() => {
    if (result && !isScanning) {
      setIsRevealed(false)
      setAnimatedScore(0)

      const duration = 2000
      const target = result.score
      const startTime = performance.now()

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Ease out quad
        const easedProgress = 1 - (1 - progress) * (1 - progress)
        const currentScore = Math.floor(easedProgress * target)

        setAnimatedScore(currentScore)

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setIsRevealed(true)
        }
      }

      requestAnimationFrame(animate)
    }
  }, [result, isScanning])

  const getConfidenceStyle = (level: string) => {
    switch (level) {
      case "HIGH": return "bg-safe/10 text-safe border-safe/20"
      case "MEDIUM": return "bg-warning/10 text-warning border-warning/20"
      case "LOW": return "bg-danger/10 text-danger border-danger/20"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const signalStyle = result ? getSignalStyle(animatedScore) : null

  return (
    <div className="flex flex-col min-h-screen relative overflow-x-hidden w-full outline outline-0 outline-red-500/0">
      {/* BACKGROUND ACCENT WRAPPER TO PREVENT OVERFLOW */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] h-[400px] pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 rounded-full blur-[150px] opacity-50" />
      </div>

      <div className="container w-full max-w-7xl py-10 md:py-16 px-4 md:px-8 space-y-10 relative z-10">
        <div className="space-y-3 text-center animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium">
            <Sparkles className="h-3 w-3" />
            AI Tokens Scan
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-b from-foreground via-foreground to-foreground/40 bg-clip-text text-transparent">
            Opportunity Intelligence
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto leading-relaxed font-medium">
            Paste any Solana token contract address to get instant AI-powered entry signals and market confidence distribution.
            {!isAuthenticated && (
              <span className={cn(
                "block mt-3 text-xs font-black uppercase tracking-widest transition-all duration-500",
                remaining <= SCAN_CONFIG.THRESHOLD_ANIMATE ? 'text-warning scale-110 animate-bounce' : 'text-primary/70'
              )}>
                {remaining > 0 ? (
                  <span className="bg-muted/30 px-3 py-1 rounded-full border border-border/20">
                    {remaining} FREE DAILY {remaining === 1 ? 'SCAN' : 'SCANS'} LEFT
                  </span>
                ) : (
                  <span className="bg-danger/10 text-danger border border-danger/30 px-3 py-1 rounded-full">
                    Scan Limit Reached ⛔
                  </span>
                )}
              </span>
            )}
          </p>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto w-full">
            <div className="relative flex-1 w-full min-w-0 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Paste any Solana token address..."
                className="h-12 md:h-13 w-full min-w-0 pl-11 pr-4 border-border/50 bg-card/50 backdrop-blur-sm text-sm md:text-base font-mono rounded-xl focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all duration-200 shadow-sm"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan(address)}
              />
            </div>
            <Button
              size="lg"
              className="h-12 md:h-13 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 rounded-xl font-semibold w-full sm:w-36 flex-shrink-0"
              onClick={() => handleScan(address)}
              disabled={!address || isScanning}
            >
              {isScanning ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary-foreground" />
              ) : (
                <div className="flex items-center justify-center gap-2">
                  Scan <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </div>

          {isScanning && scanPhase && (
            <div className="text-center mt-4 animate-fade-in">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground font-medium bg-muted/30 px-4 py-1.5 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {scanPhase}
              </div>
            </div>
          )}

          {limitAlert && (
            <div className="text-center mt-6 animate-in zoom-in-95 duration-500">
              <div className="glass bg-danger/10 border-danger/30 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl shadow-danger/5">
                <div className="h-12 w-12 rounded-full bg-danger/20 flex items-center justify-center text-danger mx-auto">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-black tracking-tight text-foreground uppercase">Identity Required</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto font-medium">
                  Log in now to unlock unlimited scanning, leaderboard access, and surveillance stats.
                </p>
                <Button
                  onClick={() => router.push('/login')}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest h-12 rounded-xl shadow-lg ring-1 ring-white/10"
                >
                  SIGN IN FOR UNLIMITED ACCESS
                </Button>
              </div>
            </div>
          )}

          {isScanning && (
            <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in duration-500">
              <div className="relative">
                <div className="absolute -inset-12 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                <div className="w-44 h-44 rounded-full border-4 border-primary/10 flex items-center justify-center relative backdrop-blur-3xl shadow-[0_0_50px_rgba(var(--primary),0.1)]">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" style={{ animationDuration: '3s' }} />
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <div className="absolute -inset-2 rounded-full border-t-2 border-primary animate-spin" style={{ animationDuration: '2s' }} />
                </div>
              </div>
              <div className="text-center space-y-3">
                <h3 className="text-3xl font-black tracking-tighter text-foreground animate-pulse-glow">Analyzing Token Intelligence...</h3>
                <div className="flex items-center justify-center gap-4">
                  <span className="h-1 w-12 bg-gradient-to-r from-transparent to-primary/50 rounded-full" />
                  <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">{scanPhase || "Scanning Market Nodes"}</p>
                  <span className="h-1 w-12 bg-gradient-to-l from-transparent to-primary/50 rounded-full" />
                </div>
              </div>
            </div>
          )}

          {errorMsg && !isScanning && (
            <div className="text-center mt-6 animate-fade-up">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-danger bg-danger/10 px-4 py-2 rounded-lg border border-danger/20">
                <AlertTriangle className="h-4 w-4" />
                {errorMsg}
              </div>
            </div>
          )}
        </div>

        {result && signalStyle && !isScanning && !errorMsg && (
          <div className="space-y-6 animate-fade-up">
            {/* ===== TWO-COLUMN DASHBOARD LAYOUT ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

              {/* ===== LEFT COLUMN: Scan Analysis ===== */}
              <div className="lg:col-span-5 space-y-5">
                {/* Score + Signals Card */}
                <Card className={cn("glass border-border/40 overflow-hidden relative transition-all duration-1000", signalStyle.glowClass)}>
                  <div className={cn("h-1 w-full transition-colors duration-1000 relative z-20", signalStyle.bgColor)} />
                  <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col items-center gap-6 w-full">
                      {/* Score Circle */}
                      <div className="flex flex-col items-center space-y-4">
                        <div className="relative group">
                          <div className={cn("absolute inset-0 rounded-full blur-2xl opacity-20 transition-all duration-1000 group-hover:opacity-40 animate-pulse-glow", signalStyle.bgColor)} />
                          <div className="w-32 h-32 rounded-full border-4 border-white/5 flex items-center justify-center relative backdrop-blur-md shadow-2xl transition-transform duration-500 group-hover:scale-105">
                            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 128 128">
                              <circle cx="64" cy="64" r="58" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                              <circle
                                cx="64" cy="64" r="58"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="6"
                                strokeDasharray="364"
                                strokeDashoffset={364 - (animatedScore / 100) * 364}
                                strokeLinecap="round"
                                className={cn(signalStyle.color, "transition-all duration-300 ease-out drop-shadow-[0_0_12px_currentColor]")}
                              />
                            </svg>
                            <div className="text-center relative z-10">
                              <div className={cn("text-4xl font-black tracking-tighter transition-colors duration-1000", signalStyle.color)}>
                                {animatedScore}
                              </div>
                              <div className="text-[8px] text-muted-foreground/80 font-black uppercase tracking-[0.2em] whitespace-nowrap mt-0.5">Intelligence</div>
                            </div>
                          </div>
                        </div>

                        <div className={cn("flex flex-wrap items-center justify-center gap-2 transition-all duration-1000", isRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
                          <div className={cn("text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-lg border border-white/5 shadow-lg flex items-center gap-1.5", signalStyle.badgeClass)}>
                            {signalStyle.icon} {signalStyle.label}
                          </div>
                          <div className={cn("text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-lg border relative overflow-hidden group/conf", getConfidenceStyle(result.confidence))}>
                            <div className="absolute inset-0 bg-white/5 translate-x-[-100%] group-hover/conf:translate-x-[100%] transition-transform duration-1000" />
                            {result.confidence}
                          </div>
                        </div>
                      </div>

                      {/* Signals List */}
                      <div className="w-full space-y-3">
                        <h3 className="font-black uppercase tracking-widest text-[10px] flex items-center gap-2 text-muted-foreground">
                          Intelligence Signals
                          <span className="text-[9px] text-muted-foreground/60 font-black bg-muted/50 px-1.5 py-0.5 rounded-full">
                            {result.signals?.length || 0}
                          </span>
                        </h3>
                        <ul className="grid gap-1.5">
                          {result.signals?.map((signalText: string, idx: number) => {
                            const normalizedSignal = signalText.toLowerCase()
                            let mappedSeverity = "medium"
                            let mappedIcon = Activity
                            if (normalizedSignal.includes("missing") || normalizedSignal.includes("discovery") || normalizedSignal.includes("evaluated")) {
                              mappedSeverity = "info"
                              mappedIcon = Sparkles
                            } else if (
                              normalizedSignal.includes("capped")
                              || normalizedSignal.includes("weak")
                              || normalizedSignal.includes("fragile")
                              || normalizedSignal.includes("limited")
                              || normalizedSignal.includes("concentration")
                            ) {
                              mappedSeverity = "critical"
                              mappedIcon = ShieldAlert
                            } else if (
                              normalizedSignal.includes("strong")
                              || normalizedSignal.includes("healthy")
                              || normalizedSignal.includes("solid")
                              || normalizedSignal.includes("agrees well")
                            ) {
                              mappedSeverity = "success"
                              mappedIcon = Zap
                            }

                            const severityColors: Record<string, string> = {
                              critical: "bg-danger/10 text-danger border-danger/20",
                              high: "bg-warning/20 text-warning border-warning/30",
                              medium: "bg-primary/10 text-primary/80 border-primary/20",
                              success: "bg-safe/20 text-safe border-safe/30",
                              info: "bg-primary/5 text-primary/70 border-primary/10",
                            }

                            const Icon = mappedIcon
                            return (
                              <li key={idx} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/10 bg-muted/10">
                                <div className={cn("p-1 rounded-md border", severityColors[mappedSeverity])}>
                                  <Icon className="h-3 w-3" />
                                </div>
                                <span className="text-[11px] font-bold leading-tight">{signalText}</span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Metric Cards */}
                {result.meta && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                      {
                        label: "Price",
                        value: formatReadablePrice(result.meta.price),
                        icon: DollarSign
                      },
                      {
                        label: "Liquidity",
                        value: (result.meta.liquidity !== null && result.meta.liquidity > 0)
                          ? `$${result.meta.liquidity.toLocaleString()}`
                          : "Discovery Phase",
                        icon: Droplets
                      },
                      {
                        label: "Volume (24h)",
                        value: (result.meta.volume !== null && result.meta.volume > 0)
                          ? `$${result.meta.volume.toLocaleString()}`
                          : "Early Activity",
                        icon: Activity
                      },
                      {
                        label: "Holders",
                        value: (result.meta.holders !== null && result.meta.holders > 0)
                          ? result.meta.holders.toLocaleString()
                          : "Unavailable",
                        icon: Users
                      },
                      {
                        label: result.meta.topHolderLabel || "Top 10 Wallets",
                        value: (result.meta.topHolderPct !== null && result.meta.topHolderPct !== undefined)
                          ? `${result.meta.topHolderPct}%`
                          : "Scanning...",
                        icon: result.meta.whaleWarning ? Skull : Users,
                        warn: result.meta.whaleWarning
                      },
                      {
                        label: "Creator Tokens",
                        value: (result.meta.creator_tokens !== null)
                          ? result.meta.creator_tokens
                          : "---",
                        icon: WalletCards
                      },
                      ].map((stat, i) => (
                        <Card key={i} className={cn(
                          "glass border-border/40 hover:border-primary/30 transition-colors",
                          stat.warn && "border-red-500/40 hover:border-red-500/60"
                        )}>
                          <CardContent className="p-3 flex flex-col items-center justify-center text-center space-y-1.5">
                            <div className={cn(
                              "p-1.5 rounded-md",
                              stat.warn ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"
                            )}><stat.icon className="h-3.5 w-3.5" /></div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{stat.label}</div>
                            <div className={cn(
                              "font-mono text-xs md:text-sm font-bold truncate max-w-full",
                              stat.warn && "text-red-400"
                            )}>{stat.value}</div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {!!result.meta.holderBreakdown?.length && (result.meta.holders !== null && result.meta.holders <= 10) && (
                      <Card className="glass border-border/40 hover:border-primary/30 transition-colors">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "p-1.5 rounded-md",
                              result.meta.whaleWarning ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"
                            )}>
                              {result.meta.whaleWarning ? <Skull className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                            </div>
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Holder Breakdown</div>
                              <div className="text-xs font-semibold text-foreground/90">
                                {result.meta.holders === 1 ? "Single wallet ownership" : `${result.meta.holders} wallets currently hold the supply`}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {result.meta.holderBreakdown.map((wallet) => (
                              <div
                                key={wallet.rank}
                                className="rounded-lg border border-border/20 bg-muted/10 px-3 py-2 text-[11px] font-medium"
                              >
                                {formatHolderBreakdownLine(wallet.rank, wallet.pct)}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {result.meta.scoring && (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                          {
                            label: "Quality",
                            value: `${result.meta.scoring.quality}/100`,
                            icon: ShieldCheck,
                            tone: "bg-safe/10 text-safe"
                          },
                          {
                            label: "Momentum",
                            value: `${result.meta.scoring.momentum}/100`,
                            icon: Activity,
                            tone: "bg-blue-500/10 text-blue-400"
                          },
                          {
                            label: "Confidence",
                            value: `${result.meta.scoring.confidenceScore}/100`,
                            icon: Sparkles,
                            tone: "bg-primary/10 text-primary"
                          },
                          {
                            label: "Risk Cap",
                            value: `${result.meta.scoring.riskCap}/100`,
                            icon: ShieldAlert,
                            tone: result.meta.scoring.riskCap < 100 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                          },
                        ].map((stat, i) => (
                          <Card key={i} className="glass border-border/40 hover:border-primary/30 transition-colors">
                            <CardContent className="p-3 flex flex-col items-center justify-center text-center space-y-1.5">
                              <div className={cn("p-1.5 rounded-md", stat.tone)}><stat.icon className="h-3.5 w-3.5" /></div>
                              <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{stat.label}</div>
                              <div className="font-mono text-xs md:text-sm font-bold truncate max-w-full">{stat.value}</div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Intelligence Summary */}
                <Card className="glass border-border/40 overflow-hidden relative">
                  <CardHeader className="pb-2 pt-4 px-5 border-b border-border/20 bg-muted/5">
                    <CardTitle className="flex items-center justify-between w-full text-[10px] uppercase font-black tracking-widest">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                          <Sparkles className="h-3.5 w-3.5" />
                        </div>
                        Intelligence Summary
                      </div>
                      <span className="text-[9px] text-muted-foreground/40 font-mono tracking-tighter">DYOR.</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 pb-5 px-5 relative z-10">
                    <p className="text-[13px] leading-relaxed text-foreground/90 font-medium whitespace-pre-wrap">
                      {renderHighlightedSummary(result.explanation)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* ===== RIGHT COLUMN: Charts + Swap ===== */}
              <div className="lg:col-span-7 space-y-5">
                {/* Chart */}
                <TokenChart address={address || urlAddress || ""} tokenName={result.contractName} />

                {/* Swap Widget */}
                <SwapWidget
                  tokenAddress={address || urlAddress || ""}
                  tokenSymbol={result.contractName}
                />
              </div>
            </div>

            {/* ===== FULL-WIDTH: Quick Actions ===== */}
            <ScanQuickActions result={result} />
          </div>
        )}

        {!result && !isScanning && !errorMsg && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4 shadow-inner">
              <Search className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground text-sm font-bold">Paste a contract address to begin analysis</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="flex h-[400px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ScanPageContent />
    </Suspense>
  )
}
