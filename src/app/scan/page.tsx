"use client"

import { useState, useEffect, useRef, Suspense, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { usePrivy } from "@privy-io/react-auth"
import Image from "next/image"
import { getAnonScanCount, incrementAnonScanCount, isAnonLimitReached, getRemainingScans, SCAN_CONFIG } from "@/lib/anon-scans"
import { useAuthFetch } from "@/lib/useAuthFetch"
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
  Globe,
  Send,
  Copy,
  ExternalLink,
  Fingerprint,
  CheckCircle2,
  XCircle,
  Info,
  TrendingUp,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
// Card components available if needed
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
      address: string;
    }>;
    ageHours?: number | null;
    isPartialHolderData?: boolean;
    security?: {
      mintAuthorityDisabled: boolean;
      freezeAuthorityDisabled: boolean;
      lpBurnProfile: string;
    };
    identity?: {
      tokenMint: string;
      poolAddress: string | null;
      deployer: string | null;
      owner: string | null;
      createdAt: string | null;
    };
    social?: {
      website: string | null;
      twitter: string | null;
      telegram: string | null;
      quoteToken: string | null;
      status: string | null;
    };
    tokenSymbol?: string;
    marketCap?: number | null;
    tokenImage?: string | null;
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

const formatCompact = (value: number | null | undefined, prefix = "") => {
  if (value === null || value === undefined || value <= 0) return "N/A"
  if (value >= 1_000_000_000) return `${prefix}${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(2)}K`
  return `${prefix}${value.toLocaleString()}`
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

const truncateAddress = (addr: string, front = 4, back = 4) => {
  if (!addr || addr.length <= front + back + 3) return addr
  return `${addr.slice(0, front)}...${addr.slice(-back)}`
}

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).catch(() => {})
}

function ScanPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { authenticated } = usePrivy()
  const authFetch = useAuthFetch()
  const urlAddress = searchParams.get("address")

  const [address, setAddress] = useState(urlAddress || "")
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [scanPhase, setScanPhase] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [limitAlert, setLimitAlert] = useState(false)
  const hasStartedScan = useRef<string | null>(null)

  const isAuthenticated = authenticated
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

      const res = await authFetch("/api/scan", {
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
  }, [address, isScanning, limitReached, anonCount, isAuthenticated, router, authFetch])

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
          <div className="space-y-5 animate-fade-up">

            {/* ===== SCORE HERO ===== */}
            <div className="relative rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-6 md:p-8 overflow-hidden shadow-[0_0_20px_-3px] shadow-primary/15 hover:shadow-primary/25 transition-shadow duration-500">
              <div className={cn("absolute inset-x-0 top-0 h-[2px] transition-colors duration-1000", signalStyle.bgColor)} />
              <div className={cn("absolute -top-20 -left-20 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none", signalStyle.bgColor)} />

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                {/* Score Circle */}
                <div className="relative group shrink-0">
                  <div className={cn("absolute inset-0 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-all duration-1000 animate-pulse-glow", signalStyle.bgColor)} />
                  <div className="w-36 h-36 rounded-full border-4 border-white/5 flex items-center justify-center relative backdrop-blur-md shadow-2xl transition-transform duration-500 group-hover:scale-105">
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

                {/* Score Info */}
                <div className="flex-1 min-w-0 text-center md:text-left space-y-3">
                  <div className="flex items-center gap-3 justify-center md:justify-start">
                    {result.meta?.tokenImage && (
                      <Image
                        src={result.meta.tokenImage}
                        alt={result.contractName}
                        width={40}
                        height={40}
                        className="rounded-full border border-border/30 shrink-0"
                        unoptimized
                      />
                    )}
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black tracking-tight">{result.contractName}</h2>
                      {result.meta?.tokenSymbol && <p className="text-sm text-muted-foreground/60 font-mono">${result.meta.tokenSymbol}</p>}
                    </div>
                  </div>
                  <div className={cn("flex flex-wrap items-center justify-center md:justify-start gap-2 transition-all duration-1000", isRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
                    <div className={cn("text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-lg border border-white/5 shadow-lg flex items-center gap-1.5", signalStyle.badgeClass)}>
                      {signalStyle.icon} {signalStyle.label}
                    </div>
                    <div className={cn("text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-lg border relative overflow-hidden group/conf", getConfidenceStyle(result.confidence))}>
                      <div className="absolute inset-0 bg-white/5 translate-x-[-100%] group-hover/conf:translate-x-[100%] transition-transform duration-1000" />
                      {result.confidence}
                    </div>
                  </div>

                  {/* Sub-scores inline */}
                  {result.meta?.scoring && (
                    <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                      {[
                        { label: "Quality", value: result.meta.scoring.quality, color: "text-emerald-400" },
                        { label: "Momentum", value: result.meta.scoring.momentum, color: "text-blue-400" },
                        { label: "Confidence", value: result.meta.scoring.confidenceScore, color: "text-purple-400" },
                        { label: "Risk Cap", value: result.meta.scoring.riskCap, color: result.meta.scoring.riskCap < 100 ? "text-rose-400" : "text-emerald-400" },
                      ].map((s) => (
                        <div key={s.label} className="text-center group/sub">
                          <div className={cn("text-lg font-black tabular-nums transition-transform group-hover/sub:scale-110", s.color)}>{s.value}</div>
                          <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ===== SECURITY BADGES ===== */}
            {result.meta?.security && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    label: result.meta.security.mintAuthorityDisabled ? "Mint authority is disabled." : "Mint authority is enabled.",
                    ok: result.meta.security.mintAuthorityDisabled,
                  },
                  {
                    label: result.meta.security.freezeAuthorityDisabled ? "Freeze authority is disabled." : "Freeze authority is enabled.",
                    ok: result.meta.security.freezeAuthorityDisabled,
                  },
                  {
                    label: `LP burn profile is ${result.meta.security.lpBurnProfile}.`,
                    ok: result.meta.security.lpBurnProfile === "strong",
                  },
                ].map((badge) => (
                  <div
                    key={badge.label}
                    className={cn(
                      "group/badge flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-300 hover:scale-[1.02]",
                      badge.ok
                        ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5"
                        : "border-rose-500/20 bg-rose-500/5 text-rose-400 hover:border-rose-500/40 hover:shadow-lg hover:shadow-rose-500/5"
                    )}
                  >
                    {badge.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                    {badge.label}
                  </div>
                ))}
              </div>
            )}

            {/* ===== ROW 1: Signals (left) | Chart (right) ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Intelligence Signals */}
              <div className="relative rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-5 overflow-hidden group/signals shadow-[0_0_15px_-3px] shadow-primary/10 hover:shadow-primary/20 transition-shadow duration-500">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-40 group-hover/signals:opacity-100 transition-opacity" />
                  <h3 className="font-black uppercase tracking-widest text-[10px] flex items-center gap-2 text-muted-foreground mb-4">
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
                        <li key={idx} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/10 bg-muted/10 transition-all duration-200 hover:bg-muted/20 hover:border-border/20">
                          <div className={cn("p-1 rounded-md border shrink-0", severityColors[mappedSeverity])}>
                            <Icon className="h-3 w-3" />
                          </div>
                          <span className="text-[11px] font-bold leading-tight">{signalText}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>

              {/* Chart (right side of row 1) */}
              <div className="min-w-0">
                <TokenChart address={address || urlAddress || ""} tokenName={result.contractName} />
              </div>
            </div>

            {/* ===== ROW 2: Metrics (left) | Holder Breakdown (middle) | Identity (right) ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Market Metrics */}
              <div className="space-y-3">
                {/* Market Metrics */}
                {result.meta && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
                    {[
                      { label: "Price", value: formatReadablePrice(result.meta.price), icon: DollarSign },
                      {
                        label: "Liquidity",
                        value: (result.meta.liquidity !== null && result.meta.liquidity > 0) ? formatCompact(result.meta.liquidity, "$") : "Discovery Phase",
                        icon: Droplets
                      },
                      {
                        label: "Volume (24h)",
                        value: (result.meta.volume !== null && result.meta.volume > 0) ? formatCompact(result.meta.volume, "$") : "Early Activity",
                        icon: Activity
                      },
                      {
                        label: "Holders",
                        value: (result.meta.holders !== null && result.meta.holders > 0) ? formatCompact(result.meta.holders) : "Unavailable",
                        icon: Users,
                        caution: result.meta.isPartialHolderData
                      },
                      {
                        label: result.meta.topHolderLabel || "Top 10 Wallets",
                        value: (result.meta.topHolderPct !== null && result.meta.topHolderPct !== undefined) ? `${result.meta.topHolderPct}%` : "Scanning...",
                        icon: result.meta.whaleWarning ? Skull : Users,
                        warn: result.meta.whaleWarning
                      },
                      { label: "Creator Tokens", value: (result.meta.creator_tokens !== null) ? result.meta.creator_tokens : "---", icon: WalletCards },
                      {
                        label: "Market Cap",
                        value: (result.meta.marketCap !== null && result.meta.marketCap !== undefined && result.meta.marketCap > 0)
                          ? formatCompact(result.meta.marketCap, "$")
                          : "Unavailable",
                        icon: TrendingUp
                      },
                    ].map((stat, i) => (
                      <div key={i} className={cn(
                        "group/metric relative rounded-xl border bg-card/60 backdrop-blur-sm p-3 flex flex-col items-center justify-center text-center space-y-1.5 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg",
                        stat.warn ? "border-rose-500/30 hover:border-rose-500/50 hover:shadow-rose-500/5" : "border-border/30 hover:border-primary/30 hover:shadow-primary/5"
                      )}>
                        <div className={cn(
                          "p-1.5 rounded-md transition-colors",
                          stat.warn ? "bg-rose-500/10 text-rose-400" : "bg-primary/10 text-primary"
                        )}><stat.icon className="h-3.5 w-3.5" /></div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{stat.label}</div>
                        <div className={cn(
                          "font-mono text-xs md:text-sm font-bold truncate max-w-full",
                          stat.warn && "text-rose-400"
                        )}>{stat.value}</div>
                        {stat.caution && (
                          <a
                            href={`https://birdeye.so/token/${address || urlAddress}?chain=solana`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] text-amber-400 font-semibold flex items-center gap-1 hover:underline"
                          >
                            <Info className="h-3 w-3" /> &gt;1K holders — verify on Birdeye
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Holder Breakdown (middle col of row 2) */}
              <div className="min-w-0">
                {!!result.meta?.holderBreakdown?.length && (
                  <div className="relative rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-5 space-y-3 overflow-hidden group/holder h-full shadow-[0_0_15px_-3px] shadow-rose-500/10 hover:shadow-rose-500/20 transition-shadow duration-500">
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-rose-500/40 to-transparent opacity-40 group-hover/holder:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "p-1.5 rounded-md",
                        result.meta.whaleWarning ? "bg-rose-500/10 text-rose-400" : "bg-primary/10 text-primary"
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

                    <div className="space-y-2">
                      {result.meta.holderBreakdown.map((wallet) => (
                        <div
                          key={wallet.rank}
                          className="group/wallet flex items-center justify-between rounded-xl border border-border/20 bg-muted/10 px-3 py-2.5 transition-all duration-200 hover:border-primary/20 hover:bg-muted/20"
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold">Wallet {wallet.rank}: {wallet.pct}%</div>
                            {wallet.address && (
                              <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/50 mt-0.5">
                                <span>{truncateAddress(wallet.address, 6, 4)}</span>
                                <button
                                  onClick={() => copyToClipboard(wallet.address)}
                                  className="opacity-0 group-hover/wallet:opacity-100 transition-opacity hover:text-primary"
                                  title="Copy address"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={cn(
                              "h-1.5 rounded-full transition-all duration-500",
                              wallet.pct > 50 ? "bg-rose-400" : wallet.pct > 20 ? "bg-amber-400" : "bg-emerald-400"
                            )} style={{ width: `${Math.max(8, wallet.pct * 0.6)}px` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* >1K Holders Caution (shown in holder column if partial) */}
                {result.meta?.isPartialHolderData && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3 mt-3">
                    <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-300/80">
                      <span className="font-bold text-amber-400">Holder data is approximate.</span> This token has &gt;1,000 holders. Helius API cannot fully snapshot large holder sets. For accurate data, visit{" "}
                      <a
                        href={`https://birdeye.so/token/${address || urlAddress}?chain=solana`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                      >
                        Birdeye <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Identity & Ownership (right col of row 2) */}
              <div className="min-w-0">
                {result.meta?.identity && (
                  <div className="relative rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-5 overflow-hidden group/id h-full shadow-[0_0_15px_-3px] shadow-cyan-500/10 hover:shadow-cyan-500/20 transition-shadow duration-500">
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent opacity-40 group-hover/id:opacity-100 transition-opacity" />
                    <h3 className="font-black uppercase tracking-widest text-[10px] flex items-center gap-2 text-muted-foreground mb-4">
                      <Fingerprint className="h-3.5 w-3.5 text-cyan-400" />
                      Identity &amp; Ownership
                    </h3>
                    <div className="space-y-2">
                      {[
                        { label: "Token Mint", value: result.meta.identity.tokenMint },
                        { label: "Pool Address", value: result.meta.identity.poolAddress },
                        { label: "Deployer", value: result.meta.identity.deployer },
                        { label: "Owner", value: result.meta.identity.owner },
                        { label: "Created", value: result.meta.identity.createdAt ? new Date(result.meta.identity.createdAt).toLocaleString() : null },
                      ].filter(row => row.value).map((row) => (
                        <div key={row.label} className="group/row flex items-center justify-between rounded-lg border border-border/10 bg-muted/5 px-3 py-2 transition-all duration-200 hover:bg-muted/15 hover:border-border/20">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{row.label}</span>
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold">
                            {row.label === "Created" ? (
                              <span>{row.value}</span>
                            ) : (
                              <>
                                <span>{truncateAddress(row.value!, 4, 4)}</span>
                                <button
                                  onClick={() => copyToClipboard(row.value!)}
                                  className="opacity-0 group-hover/row:opacity-100 transition-opacity text-muted-foreground/50 hover:text-primary"
                                  title="Copy"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ===== MOBILE ONLY: Links & Social after Identity ===== */}
            {result.meta?.social && (
              <div className="lg:hidden">
                <div className="relative rounded-2xl border border-purple-500/20 bg-card/60 backdrop-blur-xl p-5 overflow-hidden group/social shadow-[0_0_15px_-3px] shadow-purple-500/10 hover:shadow-purple-500/25 transition-shadow duration-500">
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-60 group-hover/social:opacity-100 transition-opacity" />
                  <h3 className="font-black uppercase tracking-widest text-[10px] flex items-center gap-2 text-muted-foreground mb-5">
                    <div className="p-1.5 rounded-md bg-purple-500/10">
                      <Globe className="h-3.5 w-3.5 text-purple-400" />
                    </div>
                    Links &amp; Social
                  </h3>
                  <div className="space-y-2.5">
                    {[
                      { label: "Website", value: result.meta.social.website, icon: Globe, isLink: true, iconColor: "text-blue-400" },
                      { label: "Twitter", value: result.meta.social.twitter, icon: ExternalLink, isLink: true, iconColor: "text-sky-400" },
                      { label: "Telegram", value: result.meta.social.telegram || "N/A", icon: Send, isLink: !!result.meta.social.telegram, iconColor: "text-cyan-400" },
                      { label: "Quote Token", value: result.meta.social.quoteToken || "Wrapped Sol (SOL)", icon: DollarSign, isLink: false, iconColor: "text-emerald-400" },
                      { label: "Searched Mint", value: address || urlAddress || "", icon: Fingerprint, isLink: false, isMint: true, iconColor: "text-amber-400" },
                      { label: "Status", value: result.meta.social.status || result.meta.status || "unknown", icon: Activity, isLink: false, iconColor: "text-purple-400" },
                    ].map((row) => (
                      <div key={row.label} className="group/row flex items-center justify-between py-2.5 border-b border-border/10 last:border-b-0 transition-all duration-200 hover:bg-muted/10 px-2 -mx-2 rounded-lg">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                          <row.icon className={cn("h-3.5 w-3.5", row.iconColor)} /> {row.label}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold max-w-[55%] text-right">
                          {row.isLink && row.value && row.value !== "N/A" ? (
                            <a href={row.value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex items-center gap-1">
                              {row.value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : row.isMint ? (
                            <span className="font-mono flex items-center gap-1">
                              {truncateAddress(row.value || "", 4, 4)}
                              <button
                                onClick={() => copyToClipboard(row.value || "")}
                                className="opacity-0 group-hover/row:opacity-100 transition-opacity text-muted-foreground/50 hover:text-primary"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </span>
                          ) : (
                            <span className={cn(
                              row.label === "Status" && row.value === "graduated" && "text-emerald-400",
                              row.label === "Status" && row.value !== "graduated" && "text-muted-foreground/60"
                            )}>{row.value || "N/A"}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== ROW 3: Summary (left) | Swap (middle) | Links & Social (right) ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Intelligence Summary */}
              <div className="relative rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl overflow-hidden group/summary shadow-[0_0_15px_-3px] shadow-primary/10 hover:shadow-primary/20 transition-shadow duration-500">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-40 group-hover/summary:opacity-100 transition-opacity" />
                <div className="border-b border-border/20 bg-muted/5 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    Intelligence Summary
                  </div>
                  <span className="text-[9px] text-muted-foreground/40 font-mono tracking-tighter">DYOR.</span>
                </div>
                <div className="p-5">
                  <p className="text-[13px] leading-relaxed text-foreground/90 font-medium whitespace-pre-wrap">
                    {renderHighlightedSummary(result.explanation)}
                  </p>
                </div>
              </div>

              {/* Swap */}
              <div className="min-w-0">
                <SwapWidget tokenAddress={address || urlAddress || ""} tokenSymbol={result.contractName} />
              </div>

              {/* Links & Social (desktop only) */}
              <div className="min-w-0 hidden lg:block">
                {result.meta?.social && (
                  <div className="relative rounded-2xl border border-purple-500/20 bg-card/60 backdrop-blur-xl p-5 overflow-hidden group/social shadow-[0_0_15px_-3px] shadow-purple-500/10 hover:shadow-purple-500/25 transition-shadow duration-500 h-full">
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-60 group-hover/social:opacity-100 transition-opacity" />
                    <h3 className="font-black uppercase tracking-widest text-[10px] flex items-center gap-2 text-muted-foreground mb-5">
                      <div className="p-1.5 rounded-md bg-purple-500/10">
                        <Globe className="h-3.5 w-3.5 text-purple-400" />
                      </div>
                      Links &amp; Social
                    </h3>
                    <div className="space-y-2.5">
                      {[
                        { label: "Website", value: result.meta.social.website, icon: Globe, isLink: true, iconColor: "text-blue-400" },
                        { label: "Twitter", value: result.meta.social.twitter, icon: ExternalLink, isLink: true, iconColor: "text-sky-400" },
                        { label: "Telegram", value: result.meta.social.telegram || "N/A", icon: Send, isLink: !!result.meta.social.telegram, iconColor: "text-cyan-400" },
                        { label: "Quote Token", value: result.meta.social.quoteToken || "Wrapped Sol (SOL)", icon: DollarSign, isLink: false, iconColor: "text-emerald-400" },
                        { label: "Searched Mint", value: address || urlAddress || "", icon: Fingerprint, isLink: false, isMint: true, iconColor: "text-amber-400" },
                        { label: "Status", value: result.meta.social.status || result.meta.status || "unknown", icon: Activity, isLink: false, iconColor: "text-purple-400" },
                      ].map((row) => (
                        <div key={row.label} className="group/row flex items-center justify-between py-2.5 border-b border-border/10 last:border-b-0 transition-all duration-200 hover:bg-muted/10 px-2 -mx-2 rounded-lg">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                            <row.icon className={cn("h-3.5 w-3.5", row.iconColor)} /> {row.label}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold max-w-[55%] text-right">
                            {row.isLink && row.value && row.value !== "N/A" ? (
                              <a href={row.value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex items-center gap-1">
                                {row.value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            ) : row.isMint ? (
                              <span className="font-mono flex items-center gap-1">
                                {truncateAddress(row.value || "", 4, 4)}
                                <button
                                  onClick={() => copyToClipboard(row.value || "")}
                                  className="opacity-0 group-hover/row:opacity-100 transition-opacity text-muted-foreground/50 hover:text-primary"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </span>
                            ) : (
                              <span className={cn(
                                row.label === "Status" && row.value === "graduated" && "text-emerald-400",
                                row.label === "Status" && row.value !== "graduated" && "text-muted-foreground/60"
                              )}>{row.value || "N/A"}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ===== FULL-WIDTH: Quick Actions ===== */}
            <ScanQuickActions result={result} tokenAddress={address || urlAddress || ""} />
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
