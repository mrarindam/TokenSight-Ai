"use client"

import FAQ from "@/components/FAQ"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Activity,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Search,
  Shield,
  BarChart3,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Token, TokenApiResponse } from "@/types/token"

// ===== Stats Section with CountUp =====
function CountUpNumber({ value, suffix = "", prefix = "", showK = true }: { value: number | string | null, suffix?: string, prefix?: string, showK?: boolean }) {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const targetValue = typeof value === 'number' ? value : 0;

  useEffect(() => {
    if (typeof value !== 'number') return;

    let start = 0;
    const duration = 2000; // 2 seconds
    const increment = targetValue / (duration / 16); // 60fps

    const timer = setInterval(() => {
      start += increment;
      if (start >= targetValue) {
        setDisplayValue(targetValue);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [targetValue, value]);

  if (value === null || value === undefined) return <span>0</span>;
  if (typeof value === 'string') return <span>{value}</span>;

  // Format number: 1200 -> 1.2K, 15000 -> 15K+
  const formatValue = (num: number) => {
    if (!showK) return num.toLocaleString();
    if (num >= 10000) return `${(num / 1000).toFixed(0)}K+`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <span>
      {prefix}
      {formatValue(displayValue)}
      {suffix}
    </span>
  );
}

// Max tokens per section
const FEED_LIMIT = 30

// ===== Status color helpers =====
function getStatusStyle(status: string) {
  switch (status) {
    case "pre-graduation":
      return {
        badge: "risk-badge-warning",
        label: "NEW-LAUNCH",
        textColor: "text-warning",
        bgColor: "bg-warning",
        borderHover: "hover:border-warning/30",
        gradientVia: "via-warning",
        avatarBg: "bg-warning/10 text-warning",
      }
    case "graduated":
      return {
        badge: "risk-badge-safe",
        label: "GRADUATED",
        textColor: "text-safe",
        bgColor: "bg-safe",
        borderHover: "hover:border-safe/30",
        gradientVia: "via-safe",
        avatarBg: "bg-safe/10 text-safe",
      }
    default:
      return {
        badge: "risk-badge-warning",
        label: "UNKNOWN",
        textColor: "text-muted-foreground",
        bgColor: "bg-muted",
        borderHover: "hover:border-border",
        gradientVia: "via-muted-foreground",
        avatarBg: "bg-muted text-muted-foreground",
      }
  }
}

export default function Home() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [lowRiskTokens, setLowRiskTokens] = useState<Token[]>([])
  const [globalStats, setGlobalStats] = useState<{ total_scans: number, monthly_scans: number, total_users: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>("")

  const fetchTokens = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const ts = Date.now()
      const [resBags, resLowRisk, resStats] = await Promise.all([
        fetch(`/api/tokens?t=${ts}`, { cache: "no-store" }),
        fetch(`/api/low-risk?t=${ts}`, { cache: "no-store" }),
        fetch(`/api/stats?t=${ts}`, { cache: "no-store" })
      ])

      const jsonBags: TokenApiResponse = await resBags.json()
      const jsonLowRisk: TokenApiResponse = await resLowRisk.json()
      const jsonStats = await resStats.json()

      if (!jsonBags.success || !Array.isArray(jsonBags.data)) {
        throw new Error(jsonBags.error || "Failed to load tokens")
      }

      setTokens(jsonBags.data)
      setGlobalStats(jsonStats)

      if (jsonLowRisk.success && Array.isArray(jsonLowRisk.data)) {
        setLowRiskTokens(jsonLowRisk.data)
      }

      setLastUpdated(
        new Date(jsonBags.timestamp || new Date()).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      )
    } catch (err) {
      console.error("[Home] Error fetching feeds:", err)
      setError(err instanceof Error ? err.message : "Failed to load tokens")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTokens()
  }, [fetchTokens])

  // ===== Filter & limit tokens by canonical status =====
  const preLaunch = tokens
    .filter((t) => t.status === "pre-graduation")
    .slice(0, FEED_LIMIT)

  const dynamicStats = [
    { label: "Total Analyzed", value: globalStats?.total_scans ?? 0, icon: Search },
    { label: "Monthly Scans", value: globalStats?.monthly_scans ?? 0, icon: Activity },
    { label: "Total Users", value: globalStats?.total_users ?? 0, icon: Shield },
    { label: "Accuracy Rate", value: "99.2%", icon: BarChart3 },
  ]

  return (
    <div className="flex flex-col min-h-screen relative">
      {/* ===== Hero Section ===== */}
      <section className="relative overflow-hidden border-b border-border/40">
        {/* Grid background */}
        <div className="absolute inset-0 hero-grid" />

        {/* Gradient orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] animate-pulse-glow" />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-safe/8 rounded-full blur-[100px] animate-pulse-glow"
          style={{ animationDelay: "1s" }}
        />

        <div className="container relative py-20 md:py-28 lg:py-32">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-black uppercase tracking-widest animate-fade-up shadow-lg shadow-primary/10 ring-1 ring-primary/20">
              <Zap className="h-3 w-3" />
              AI-Assisted Analysis
            </div>

            {/* Heading */}
            <h1
              className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] animate-fade-up drop-shadow-sm"
              style={{ animationDelay: "0.1s" }}
            >
              Analyze Tokens Smarter <br className="hidden md:block" />
              <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent animate-gradient bg-[length:200%_200%]">
                Before You Trade
              </span>
            </h1>

            {/* Subtitle / Description */}
            <p
              className="text-[17px] md:text-lg text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed animate-fade-up font-medium"
              style={{ animationDelay: "0.2s" }}
            >
              Analyze both early-stage and established tokens across the entire Bags ecosystem through liquidity, trading activity, holder behavior, volume trends and on-chain signals — giving you the clarity to make confident, data-driven entry decisions.
            </p>

            {/* CTA Buttons */}
            <div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up"
              style={{ animationDelay: "0.3s" }}
            >
              <Link
                href="/scan"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 font-semibold text-base"
                )}
              >
                <Search className="mr-2 h-5 w-5" /> Scan a Token
              </Link>
              <Link
                href="/leaderboard"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 px-8 border-border/60 hover:bg-accent/50 text-base font-medium"
                )}
              >
                View Leaderboard <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-4xl mx-auto stagger-children">
            {dynamicStats.map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl glass hover-lift cursor-default"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-black tracking-tight">
                    <CountUpNumber value={stat.value} />
                  </span>
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {stat.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===== Token Feed Sections ===== */}
      <div className="container py-12 space-y-16">
        {/* Feed header with refresh */}
        <div className="flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Image src="/logo.png" alt="" width={24} height={24} className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Live Token Feed</h2>
              <p className="text-sm text-muted-foreground">
                Real-time data from Bags API
                {lastUpdated && (
                  <span className="ml-2 text-xs opacity-60">• Updated {lastUpdated}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={fetchTokens}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* ===== Loading State ===== */}
        {isLoading && tokens.length === 0 && (
          <div className="space-y-12">
            <SkeletonSection count={4} />
            <SkeletonSection count={4} />
          </div>
        )}

        {/* ===== Error State ===== */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-up">
            <div className="p-4 rounded-2xl bg-danger/10 mb-4">
              <AlertCircle className="h-8 w-8 text-danger" />
            </div>
            <h3 className="text-lg font-bold mb-1">Failed to load tokens</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md text-center">{error}</p>
            <button
              onClick={fetchTokens}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "gap-2"
              )}
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        )}

        {/* ===== Section 1: Pre-Launch Tokens ===== */}
        {!error && !isLoading && (
          <section className="space-y-6 animate-fade-up">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <ShieldAlert className="h-5 w-5 text-warning" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Early Stage Tokens</h2>
                <p className="text-sm text-muted-foreground">
                  Newly launched tokens — exercise caution for smart entries
                </p>
              </div>
              <span className="ml-auto text-xs font-semibold text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                {preLaunch.length}
              </span>
            </div>

            {preLaunch.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-children">
                {preLaunch.map((token) => (
                  <TokenCard key={token.id} token={token} />
                ))}
              </div>
            ) : (
              <EmptySection message="No newly launched tokens found right now" />
            )}
          </section>
        )}

        {/* ===== Section 2: Low Risk Signals ===== */}
        {!error && !isLoading && (
          <section className="space-y-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-safe/10">
                <ShieldCheck className="h-5 w-5 text-safe" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Verified High-Confidence Discoveries</h2>
                <p className="text-sm text-muted-foreground">
                  A persistent archive of intelligence-led token discoveries verified by market structure and volume.
                </p>
              </div>
              <span className="ml-auto text-xs font-semibold text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                {lowRiskTokens.length} Discovered
              </span>
            </div>

            {lowRiskTokens.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-children">
                {lowRiskTokens.map((token) => (
                  <TokenCard key={token.id} token={token} />
                ))}
              </div>
            ) : (
              <EmptySection message="No high-confidence discoveries have been archived yet." />
            )}
          </section>
        )}

        {/* ===== Intelligence Hub: FAQ Section ===== */}
        <FAQ />

        {/* ===== Powered By: Tech Stack Section ===== */}
        <TechStack />
      </div>
    </div>
  )
}

// ===== Tech Stack Marquee Component =====
function TechStack() {
  const logos = [
    { name: "BAGS", color: "text-primary" },
    { name: "DEXSCREENER", color: "text-sky-400" },
    { name: "GROQ", color: "text-orange-500" },
    { name: "SUPABASE", color: "text-emerald-500" },
    { name: "HELIUS", color: "text-purple-500" },
  ]

  // Double the logos for infinite loop
  const displayLogos = [...logos, ...logos, ...logos]

  return (
    <section className="py-20 border-t border-border/20 relative overflow-hidden">
      <div className="container px-4 text-center mb-10 space-y-2">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40">Powered By</h3>
        <p className="text-sm font-bold text-muted-foreground/60">Built with cutting-edge infrastructure</p>
      </div>

      <div className="relative flex overflow-hidden group">
        {/* Edge Fades */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        {/* Marquee Container */}
        <div className="flex animate-marquee gap-12 md:gap-24 items-center whitespace-nowrap">
          {displayLogos.map((logo, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center gap-2 group/logo grayscale hover:grayscale-0 opacity-40 hover:opacity-100 transition-all duration-500 cursor-default",
                "hover:scale-110 active:scale-95"
              )}
            >
              <div className={cn(
                "text-2xl md:text-4xl font-black italic tracking-tighter transition-all duration-500 group-hover/logo:drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]",
                logo.color
              )}>
                {logo.name}
              </div>
            </div>
          ))}
          {/* Duplicate to ensure absolute seamlessness */}
          {displayLogos.map((logo, index) => (
            <div
              key={`dup-${index}`}
              className={cn(
                "flex items-center gap-2 group/logo grayscale hover:grayscale-0 opacity-40 hover:opacity-100 transition-all duration-500 cursor-default",
                "hover:scale-110 active:scale-95"
              )}
            >
              <div className={cn(
                "text-2xl md:text-4xl font-black italic tracking-tighter transition-all duration-500 group-hover/logo:drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]",
                logo.color
              )}>
                {logo.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ===== Token Card Component =====
function TokenCard({ token }: { token: Token }) {
  const [copied, setCopied] = useState(false)
  const style = getStatusStyle(token.status)

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!token.address) return
    navigator.clipboard.writeText(token.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-border/40 bg-card/40 backdrop-blur-md flex flex-col justify-between group transition-all duration-500",
        "hover-lift-premium border-glow-hover",
        token.status === 'pre-graduation' ? "hover:border-warning/40 shadow-warning/5" : "hover:border-safe/40 shadow-safe/5",
        "noise-overlay"
      )}
    >
      {/* Dynamic Glow Background (Hover) */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none bg-gradient-to-br from-primary via-purple-500 to-cyan-400 blur-2xl -z-10" />

      {/* Top accent line - Pulsating Gradient */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-primary/50 to-transparent",
          "group-hover:via-primary group-hover:h-[4px] transition-all duration-500 animate-pulse-glow",
          style.gradientVia
        )}
      />

      <CardHeader className="pb-3 relative z-10">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* Token avatar — with high-tech ring */}
            <div className="relative flex-shrink-0 group-hover:scale-110 transition-transform duration-500">
              <div className={cn(
                "absolute -inset-1 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-sm scale-110",
                token.status === 'pre-graduation' ? "bg-warning/20" : "bg-safe/20"
              )} />
              {token.image ? (
                <Image
                  src={token.image}
                  alt={token.name}
                  width={44}
                  height={44}
                  className="w-11 h-11 rounded-xl object-cover relative ring-1 ring-border/50 bg-background"
                  unoptimized
                />
              ) : (
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black relative ring-1 ring-border/50", style.avatarBg)}>
                  {token.symbol.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <CardTitle className="text-base font-black tracking-tighter truncate group-hover:text-primary transition-colors">
                {token.name}
              </CardTitle>
              <div className="text-[10px] text-muted-foreground/60 mt-0.5 font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
                <span className="text-primary/60">$</span>{token.symbol}
              </div>
            </div>
          </div>

          <span className={cn(
            "text-[9px] font-black uppercase px-2.5 py-1 rounded-lg tracking-widest flex-shrink-0 shimmer-badge border border-white/5",
            style.badge
          )}>
            {style.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pb-4 relative z-10 flex-1 flex flex-col justify-between">
        {token.description && (
          <p className="text-xs text-muted-foreground/80 line-clamp-2 mb-4 leading-relaxed font-medium">
            {token.description}
          </p>
        )}

        <div
          onClick={handleCopy}
          className="group/address relative flex flex-col p-3 rounded-xl bg-muted/20 border border-border/20 hover:bg-muted/40 hover:border-primary/30 transition-all cursor-pointer overflow-hidden"
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] text-muted-foreground/40 font-black uppercase tracking-widest flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" /> Token Address
            </span>
            {copied ? (
              <span className="text-[8px] font-black text-safe uppercase tracking-widest animate-in fade-in zoom-in-50">Copied!</span>
            ) : (
              <div className="opacity-0 group-hover/address:opacity-100 transition-opacity">
                <Search className="w-2.5 h-2.5 text-muted-foreground/40" />
              </div>
            )}
          </div>
          <span className="font-mono text-[11px] font-bold tracking-tight text-foreground/80 break-all line-clamp-1">
            {token.address || "ANALYZING NODE..."}
          </span>

          {/* Progress-like accent */}
          <div className="absolute bottom-0 left-0 h-[1.5px] bg-primary/20 w-full group-hover/address:bg-primary/40 transition-colors" />
        </div>

        {/* Social Links — Premium Pill Style */}
        {(token.twitter || token.website) && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/10">
            {token.twitter && (
              <a href={token.twitter} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-sky-400 transition-colors bg-muted/10 px-2.5 py-1.5 rounded-full border border-border/30">
                <ExternalLink className="h-2.5 w-2.5" /> Twitter
              </a>
            )}
            {token.website && (
              <a href={token.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-primary transition-colors bg-muted/10 px-2.5 py-1.5 rounded-full border border-border/30">
                <ExternalLink className="h-2.5 w-2.5" /> Web
              </a>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 relative z-10">
        <Link
          href={`/scan?address=${token.address}`}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "w-full justify-between group/scan h-11 text-[11px] font-black uppercase tracking-[0.2em] rounded-xl border border-primary/20",
            "bg-primary/5 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-500",
            "pulse-ring animate-dopamine"
          )}
        >
          <span>Initiate Analysis</span>
          <ArrowRight className="h-4 w-4 transition-all duration-500 group-hover/scan:translate-x-1.5" />
        </Link>
      </CardFooter>
    </Card>
  )
}

// ===== Skeleton Loader =====
function SkeletonSection({ count }: { count: number }) {
  return (
    <div className="space-y-6">
      {/* Section header skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted/50 animate-pulse" />
        <div className="space-y-2">
          <div className="h-5 w-32 rounded bg-muted/50 animate-pulse" />
          <div className="h-3 w-56 rounded bg-muted/30 animate-pulse" />
        </div>
      </div>
      {/* Card skeletons */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} className="border-border/40 bg-card/50 overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted/50 animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-24 rounded bg-muted/50 animate-pulse" />
                  <div className="h-3 w-16 rounded bg-muted/30 animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded-md bg-muted/40 animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-muted/30 animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-muted/20 animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <div className="h-2.5 w-12 rounded bg-muted/30 animate-pulse" />
                  <div className="h-3.5 w-20 rounded bg-muted/40 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="h-2.5 w-12 rounded bg-muted/30 animate-pulse" />
                  <div className="h-3.5 w-16 rounded bg-muted/40 animate-pulse" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-0">
              <div className="h-9 w-full rounded-lg bg-muted/20 animate-pulse" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ===== Empty State Component =====
function EmptySection({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center glass rounded-2xl border border-dashed border-border/50">
      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <Search className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  )
}
