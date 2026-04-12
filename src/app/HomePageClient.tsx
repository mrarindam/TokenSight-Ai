"use client"

import FAQ from "@/components/FAQ"
import sightAiPreview from "@/app/images/ai.png"
import alertsPreview from "@/app/images/alart.png"
import historyPreview from "@/app/images/history.png"
import portfolioPreview from "@/app/images/portfolio.png"
import profilePreview from "@/app/images/profile.png"
import telegramBotPreview from "@/app/images/TG bot.png"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePrivy } from "@privy-io/react-auth"
import {
  Activity,
  ArrowRight,
  ShieldAlert,
  TrendingUp,
  Zap,
  Search,
  Shield,
  BarChart3,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Flame,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Bell,
  Brain,
  LogIn,
  User,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Token, TokenApiResponse, TrendingToken, TrendingTokenApiResponse } from "@/types/token"

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
const FEED_LIMIT = 50

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
  const { authenticated } = usePrivy()
  const [tokens, setTokens] = useState<Token[]>([])
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([])
  const [globalStats, setGlobalStats] = useState<{ total_scans: number, monthly_scans: number, total_users: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>("")
  const hasFetchedInitially = useRef(false)
  const liveFeedHeaderRef = useRef<HTMLDivElement | null>(null)

  const fetchTokens = useCallback(async (forceFresh = false) => {
    try {
      setIsLoading(true)
      setError(null)

      const ts = forceFresh ? Date.now() : null
      const requestInit = forceFresh ? { cache: "no-store" as const } : undefined
      const withCacheBust = (path: string) => (ts ? `${path}?t=${ts}` : path)

      const [resBags, resTrending, resStats] = await Promise.all([
        fetch(withCacheBust("/api/tokens"), requestInit),
        fetch(withCacheBust("/api/trending"), requestInit),
        fetch(withCacheBust("/api/stats"), { cache: "no-store" })
      ])

      const jsonBags: TokenApiResponse = await resBags.json()
      const jsonTrending: TrendingTokenApiResponse = await resTrending.json()
      const jsonStats = await resStats.json()

      if (!jsonBags.success || !Array.isArray(jsonBags.data)) {
        throw new Error(jsonBags.error || "Failed to load tokens")
      }

      setTokens(jsonBags.data)
      setGlobalStats(jsonStats)

      if (jsonTrending.success && Array.isArray(jsonTrending.data)) {
        setTrendingTokens(jsonTrending.data)
      } else {
        setTrendingTokens([])
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
    if (hasFetchedInitially.current) return
    hasFetchedInitially.current = true
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

  const handleJumpToFeed = useCallback(() => {
    const target = liveFeedHeaderRef.current
    if (!target) return

    const offset = 96
    const targetTop = target.getBoundingClientRect().top + window.scrollY - offset

    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: "smooth",
    })
  }, [])

  return (
    <div className="flex flex-col min-h-screen relative">
      {/* ===== Hero Section — 3D Dopamine Vibe ===== */}
      <section className="relative overflow-hidden border-b border-white/[0.04]">
        {/* Grid background */}
        <div className="absolute inset-0 hero-grid" />

        {/* Animated gradient orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-primary/20 via-purple-500/10 to-transparent rounded-full blur-[140px] animate-pulse-glow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-tl from-cyan-500/15 via-safe/10 to-transparent rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: "1s" }} />
        <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] bg-gradient-to-br from-fuchsia-500/10 to-transparent rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: "2s" }} />

        {/* Floating particles */}
        <div className="hidden md:block absolute top-[15%] left-[8%] w-2 h-2 rounded-full bg-primary/40" style={{ animation: "particle-float 6s ease-in-out infinite" }} />
        <div className="hidden md:block absolute top-[45%] right-[12%] w-1.5 h-1.5 rounded-full bg-cyan-400/50" style={{ animation: "particle-float 8s ease-in-out infinite 1s" }} />
        <div className="hidden md:block absolute bottom-[25%] left-[25%] w-1 h-1 rounded-full bg-purple-400/60" style={{ animation: "particle-float 7s ease-in-out infinite 2s" }} />
        <div className="hidden md:block absolute top-[60%] right-[30%] w-2.5 h-2.5 rounded-full bg-emerald-400/30" style={{ animation: "particle-float 9s ease-in-out infinite 0.5s" }} />
        <div className="hidden md:block absolute top-[20%] right-[40%] w-1 h-1 rounded-full bg-amber-400/40" style={{ animation: "particle-float 5s ease-in-out infinite 3s" }} />

        <div className="dashboard-shell relative py-16 md:py-20 lg:py-24 xl:py-28">
          <div className="dashboard-grid items-center">
            <div className="col-span-12 mx-auto flex w-full max-w-6xl flex-col items-center space-y-8 text-center xl:space-y-10">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-2 text-xs font-black uppercase tracking-[0.25em] text-primary shadow-[0_0_20px_rgba(99,102,241,0.25)] ring-1 ring-primary/30 backdrop-blur-sm animate-fade-up">
                <Zap className="h-3.5 w-3.5 animate-pulse" />
                Solana On-Chain Analysis
              </div>

              <div className="mx-auto flex w-full max-w-6xl flex-col items-center space-y-5">
                <h1
                  className="mx-auto w-full max-w-none text-center text-4xl font-black leading-[0.98] tracking-tight text-3d text-3d-hero sm:text-5xl lg:text-6xl xl:text-7xl xl:whitespace-nowrap animate-fade-up"
                  style={{ animationDelay: "0.1s" }}
                >
                  Solana Token Scanner
                  <span className="mt-2 block bg-gradient-to-r from-primary via-cyan-400 via-purple-400 to-primary bg-clip-text text-transparent animate-aurora bg-[length:300%_300%]">
                    & Rug Checker
                  </span>
                </h1>

                <p
                  className="mx-auto max-w-3xl text-center text-base leading-relaxed text-muted-foreground/72 sm:text-lg xl:text-xl animate-fade-up"
                  style={{ animationDelay: "0.2s" }}
                >
                  Scan any Solana token in seconds. Analyze liquidity, holder concentration, creator behavior and price momentum with real-time, AI-driven risk signals.
                </p>
              </div>

              <div
                className="mx-auto flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center animate-fade-up"
                style={{ animationDelay: "0.3s" }}
              >
                <Link
                  href="/scan"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "hero-cta-button hero-cta-button-primary group h-13 px-10 bg-gradient-to-r from-primary via-blue-500 to-primary text-primary-foreground shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_50px_rgba(99,102,241,0.6)] transition-all duration-500 font-black text-base tracking-wide animate-aurora bg-[length:200%_200%]"
                  )}
                >
                  <Search className="mr-2 h-5 w-5 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /> Scan a Token
                </Link>
                <Link
                  href="/portfolio"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "hero-cta-button hero-cta-button-secondary group h-13 px-8 border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 text-base font-semibold backdrop-blur-sm transition-all duration-300"
                  )}
                >
                  <Wallet className="mr-2 h-4 w-4 transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:rotate-[-8deg]" /> Portfolio
                </Link>
                <button
                  type="button"
                  onClick={handleJumpToFeed}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "hero-cta-button hero-cta-button-secondary group h-13 px-8 border-primary/20 bg-primary/[0.05] text-base font-semibold text-primary backdrop-blur-sm transition-all duration-300 hover:border-primary/35 hover:bg-primary/[0.09] hover:text-primary"
                  )}
                >
                  <ArrowRight className="mr-2 h-4 w-4 rotate-90 transition-transform duration-500 group-hover:translate-y-0.5" /> Jump Token Feed
                </button>
                <Link
                  href={authenticated ? "/profile" : "/login"}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "hero-cta-button hero-cta-button-secondary group h-13 px-8 border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 text-base font-semibold backdrop-blur-sm transition-all duration-300"
                  )}
                >
                  {authenticated ? (
                    <><User className="mr-2 h-4 w-4 transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:scale-110" /> Profile</>
                  ) : (
                    <><LogIn className="mr-2 h-4 w-4 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /> Login</>
                  )}
                </Link>
              </div>

              <div className="dashboard-grid stagger-children mx-auto w-full max-w-[1400px]">
                {dynamicStats.map((stat) => {
                  const Icon = stat.icon
                  return (
                    <div
                      key={stat.label}
                      className="hero-stat-card dashboard-surface group col-span-6 flex flex-col gap-3 p-5 lg:col-span-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/60">
                          {stat.label}
                        </span>
                        <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-110 group-hover:shadow-[0_0_24px_rgba(99,102,241,0.2)]">
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <span className="text-3xl font-black tracking-tight text-3d transition-transform duration-500 group-hover:translate-x-1">
                        <CountUpNumber value={stat.value} />
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Full-Width Showcase Sections ===== */}
      <div className="w-full space-y-0">

      {/* --- Video Section --- */}
      <section id="live-token-feed" className="relative scroll-mt-24 overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
        <div className="dashboard-shell relative">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-6 px-2 py-2 md:px-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-primary shadow-[0_0_20px_rgba(99,102,241,0.2)] backdrop-blur-sm">
              <Activity className="h-3.5 w-3.5 animate-pulse" />
              ANALYZING...
            </div>

            <div className="space-y-4">
              <h3 className="max-w-xl text-3xl font-black tracking-tight text-foreground md:text-5xl md:leading-tight text-3d">
                Live Scan Motion Preview
              </h3>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground/70 md:text-lg">
                Watch the TokenSight scan experience in motion: real-time intelligence framing, score-first analysis, and a professional execution flow built for fast Solana decision-making.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-r from-primary/20 via-purple-500/15 to-cyan-500/20 blur-3xl animate-pulse-glow" />
            <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-background/60 p-2 shadow-[0_0_40px_rgba(99,102,241,0.15)] backdrop-blur-xl animate-glow-border" style={{ "--glow-c": "rgba(99,102,241,0.2)" } as React.CSSProperties}>
              <div className="mb-2 flex items-center justify-between rounded-[1.1rem] border border-border/30 bg-background/60 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90 shadow-[0_0_8px_rgba(251,113,133,0.5)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">TokenSight Demo</div>
              </div>

              <div className="overflow-hidden rounded-[1.2rem] border border-primary/15 bg-black/50">
                <video
                  className="aspect-[16/10] w-full object-cover"
                  src="/media/scan-demo.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      <div className="section-glow-divider w-full px-4 sm:px-6 lg:px-12 xl:px-20" />

      {/* --- Sight AI --- */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500/[0.04] rounded-full blur-[120px]" />
        <div className="dashboard-shell relative">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="space-y-6 px-2 py-2 md:px-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.2)] backdrop-blur-sm">
              <Brain className="h-3.5 w-3.5" />
              Sight AI
            </div>

            <div className="space-y-4">
              <h3 className="max-w-2xl text-3xl font-black tracking-tight text-foreground md:text-5xl md:leading-tight text-3d">
                WE PROVIDE <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">SIGHT AI</span> - TOKENSIGHT COPILOT
              </h3>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground/70 md:text-lg">
                A scan-native copilot built for token research. Sight AI turns raw scan output into readable risk context, follow-up prompts, and decision support without breaking the flow of analysis.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Workflow", value: "Ask Anything" },
                { label: "Mode", value: "Copilot" },
                { label: "Output", value: "Guidance" },
              ].map((item) => (
                <div key={item.label} className="space-y-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/60">{item.label}</div>
                  <div className="text-sm font-black text-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center py-2">
            <div className="image-3d-container" style={{ "--halo-color": "rgba(34,211,238,0.15)" } as React.CSSProperties}>
              <Image
                src={sightAiPreview}
                alt="Sight AI TokenSight Copilot preview"
                className="h-auto w-full max-w-[640px] object-contain drop-shadow-[0_30px_60px_rgba(34,211,238,0.2)]"
                priority
              />
            </div>
          </div>
        </div>
        </div>
      </section>

      <div className="section-glow-divider w-full px-4 sm:px-6 lg:px-12 xl:px-20" />

      {/* --- Telegram Bot (image left) --- */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-sky-500/[0.04] rounded-full blur-[120px]" />
        <div className="dashboard-shell relative">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="flex items-center justify-center py-2">
            <div className="image-3d-container" style={{ "--halo-color": "rgba(56,189,248,0.15)" } as React.CSSProperties}>
              <Image
                src={telegramBotPreview}
                alt="Telegram Bot TokenSight AI preview"
                className="h-auto w-full max-w-[640px] object-contain drop-shadow-[0_30px_60px_rgba(56,189,248,0.2)]"
              />
            </div>
          </div>

          <div className="space-y-6 px-2 py-2 md:px-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.2)] backdrop-blur-sm">
              <Bell className="h-3.5 w-3.5" />
              Telegram Bot
            </div>

            <div className="space-y-4">
              <h3 className="max-w-2xl text-3xl font-black tracking-tight text-foreground md:text-5xl md:leading-tight text-3d">
                WE PROVIDE <span className="bg-gradient-to-r from-sky-400 to-blue-400 bg-clip-text text-transparent">TELEGRAM BOT</span> - TOKENSIGHT AI
              </h3>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground/70 md:text-lg">
                Get TokenSight intelligence inside Telegram with fast alerts, guided scan access, and direct follow-up actions built for mobile-first trading workflows.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Delivery", value: "Instant alerts" },
                { label: "Access", value: "Telegram chat" },
                { label: "Flow", value: "Mobile-first" },
              ].map((item) => (
                <div key={item.label} className="space-y-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-300/60">{item.label}</div>
                  <div className="text-sm font-black text-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </section>

      <div className="section-glow-divider w-full px-4 sm:px-6 lg:px-12 xl:px-20" />

      {/* --- Live Portfolio (text left, image right) --- */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute top-[20%] right-[10%] w-[350px] h-[350px] bg-emerald-500/[0.04] rounded-full blur-[120px]" />
        <div className="dashboard-shell relative">
        <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="space-y-6 px-2 py-2 md:px-3 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.2)] backdrop-blur-sm">
              <Wallet className="h-3.5 w-3.5" />
              Live Portfolio
            </div>

            <div className="space-y-4">
              <h3 className="max-w-2xl text-3xl font-black tracking-tight text-foreground md:text-5xl md:leading-tight text-3d">
                WE PROVIDE <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">LIVE PORTFOLIO</span>
              </h3>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground/70 md:text-lg">
                Track wallet performance, portfolio movement, and token exposure in one live view built for fast monitoring and cleaner position management.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Tracking", value: "Live" },
                { label: "View", value: "Unified" },
                { label: "Focus", value: "Positions" },
              ].map((item) => (
                <div key={item.label} className="space-y-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300/60">{item.label}</div>
                  <div className="text-sm font-black text-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center py-2 lg:order-2">
            <div className="image-3d-container" style={{ "--halo-color": "rgba(52,211,153,0.15)" } as React.CSSProperties}>
              <Image
                src={portfolioPreview}
                alt="TokenSight live portfolio preview"
                className="h-auto w-full max-w-[640px] object-contain drop-shadow-[0_30px_60px_rgba(52,211,153,0.2)]"
              />
            </div>
          </div>
        </div>
        </div>
      </section>

      <div className="section-glow-divider w-full px-4 sm:px-6 lg:px-12 xl:px-20" />

      {/* --- Alerts System (image left) --- */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] bg-amber-500/[0.04] rounded-full blur-[120px]" />
        <div className="dashboard-shell relative">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="flex items-center justify-center py-2">
            <div className="image-3d-container" style={{ "--halo-color": "rgba(251,191,36,0.15)" } as React.CSSProperties}>
              <Image
                src={alertsPreview}
                alt="TokenSight alerts system preview"
                className="h-auto w-full max-w-[640px] object-contain drop-shadow-[0_30px_60px_rgba(250,204,21,0.18)]"
              />
            </div>
          </div>

          <div className="space-y-6 px-2 py-2 md:px-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.2)] backdrop-blur-sm">
              <Bell className="h-3.5 w-3.5" />
              Alerts System
            </div>

            <div className="space-y-4">
              <h3 className="max-w-2xl text-3xl font-black tracking-tight text-foreground md:text-5xl md:leading-tight text-3d">
                WE PROVIDE <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">ALERTS SYSTEM</span>
              </h3>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground/70 md:text-lg">
                Stay ahead of fast token movement with smart alert delivery, quick signal tracking, and clear trigger visibility designed for active monitoring.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Alerts", value: "Real-time" },
                { label: "Tracking", value: "Smart triggers" },
                { label: "View", value: "Action-ready" },
              ].map((item) => (
                <div key={item.label} className="space-y-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300/60">{item.label}</div>
                  <div className="text-sm font-black text-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </section>

      <div className="section-glow-divider w-full px-4 sm:px-6 lg:px-12 xl:px-20" />

      {/* --- Scan History (text left, image right) --- */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute top-[30%] left-[10%] w-[350px] h-[350px] bg-fuchsia-500/[0.04] rounded-full blur-[120px]" />
        <div className="dashboard-shell relative">
        <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="space-y-6 px-2 py-2 md:px-3 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-fuchsia-300 shadow-[0_0_20px_rgba(217,70,239,0.2)] backdrop-blur-sm">
              <Activity className="h-3.5 w-3.5" />
              Scan History
            </div>

            <div className="space-y-4">
              <h3 className="max-w-2xl text-3xl font-black tracking-tight text-foreground md:text-5xl md:leading-tight text-3d">
                WE PROVIDE <span className="bg-gradient-to-r from-fuchsia-400 to-purple-400 bg-clip-text text-transparent">SCAN HISTORY</span> SECTION
              </h3>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground/70 md:text-lg">
                Revisit previous scans instantly, compare token checks over time, and keep your research flow organized without losing context.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Archive", value: "Saved scans" },
                { label: "Recall", value: "Instant" },
                { label: "Research", value: "Continuous" },
              ].map((item) => (
                <div key={item.label} className="space-y-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-300/60">{item.label}</div>
                  <div className="text-sm font-black text-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center py-2 lg:order-2">
            <div className="image-3d-container" style={{ "--halo-color": "rgba(217,70,239,0.15)" } as React.CSSProperties}>
              <Image
                src={historyPreview}
                alt="TokenSight scan history preview"
                className="h-auto w-full max-w-[640px] object-contain drop-shadow-[0_30px_60px_rgba(168,85,247,0.2)]"
              />
            </div>
          </div>
        </div>
        </div>
      </section>

      <div className="section-glow-divider w-full px-4 sm:px-6 lg:px-12 xl:px-20" />

      {/* --- Profile Intelligence (image left) --- */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute bottom-[20%] right-[10%] w-[350px] h-[350px] bg-rose-500/[0.04] rounded-full blur-[120px]" />
        <div className="dashboard-shell relative">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="flex items-center justify-center py-2">
            <div className="image-3d-container" style={{ "--halo-color": "rgba(251,113,133,0.15)" } as React.CSSProperties}>
              <Image
                src={profilePreview}
                alt="TokenSight profile preview"
                className="h-auto w-full max-w-[640px] object-contain drop-shadow-[0_30px_60px_rgba(251,113,133,0.2)]"
              />
            </div>
          </div>

          <div className="space-y-6 px-2 py-2 md:px-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-rose-300 shadow-[0_0_20px_rgba(251,113,133,0.2)] backdrop-blur-sm">
              <User className="h-3.5 w-3.5" />
              Profile Intelligence
            </div>

            <div className="space-y-4">
              <h3 className="max-w-2xl text-3xl font-black tracking-tight text-foreground md:text-5xl md:leading-tight text-3d">
                WE KNOW WHO YOU ARE VIA <span className="bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">PROFILE</span>
              </h3>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground/70 md:text-lg">
                Your profile keeps identity, personalization, and account-level context connected so TokenSight can shape a more direct and usable trading experience.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Identity", value: "Profile-based" },
                { label: "Access", value: "Personalized" },
                { label: "Context", value: "Account-aware" },
              ].map((item) => (
                <div key={item.label} className="space-y-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-300/60">{item.label}</div>
                  <div className="text-sm font-black text-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </section>

      <div className="section-glow-divider w-full px-4 sm:px-6 lg:px-12 xl:px-20" />

      {/* ===== Token Feed — Full Width ===== */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.015] via-transparent to-primary/[0.015]" />
        <div className="dashboard-shell relative space-y-12">

        {/* Feed header with glow */}
        <div ref={liveFeedHeaderRef} className="flex items-center justify-between scroll-mt-24">
          <div className="flex items-center gap-4">
            <div className="relative p-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
              <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-safe opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-safe shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
              </span>
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-3d">Live Token Feed</h2>
              <p className="text-sm text-muted-foreground/60">
                Real-time Solana token intelligence
                {lastUpdated && (
                  <span className="ml-2 text-xs opacity-60">• Updated {lastUpdated}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchTokens(true)}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:text-foreground bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 disabled:opacity-50 hover:shadow-[0_0_20px_rgba(99,102,241,0.1)]"
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
            <div className="p-4 rounded-2xl bg-danger/10 mb-4 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
              <AlertCircle className="h-8 w-8 text-danger" />
            </div>
            <h3 className="text-lg font-black mb-1">Failed to load tokens</h3>
            <p className="text-sm text-muted-foreground/60 mb-4 max-w-md text-center">{error}</p>
            <button
              onClick={() => fetchTokens(true)}
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
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-warning/10 border border-warning/20 shadow-[0_0_15px_rgba(234,179,8,0.15)]">
                <ShieldAlert className="h-5 w-5 text-warning" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black tracking-tight text-3d">Early Stage Tokens</h2>
                  <span className="px-2.5 py-1 rounded-lg bg-warning/10 text-warning text-[10px] font-black uppercase tracking-widest shadow-[0_0_12px_rgba(234,179,8,0.2)]">New</span>
                </div>
                <p className="text-sm text-muted-foreground/60">
                  Newly launched Solana tokens on Bags — exercise caution for smart entries
                </p>
              </div>
              <span className="ml-auto text-xs font-black text-muted-foreground bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.06]">
                {preLaunch.length}
              </span>
            </div>

            {preLaunch.length > 0 ? (
              <TokenSlider tokens={preLaunch} />
            ) : (
              <EmptySection message="No newly launched tokens found right now" />
            )}
          </section>
        )}

        {/* ===== Section 2: Trending Solana Tokens ===== */}
        {!error && !isLoading && (
          <section className="space-y-6" style={{ animationDelay: "0.1s" }}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-safe/10 border border-safe/20 shadow-[0_0_15px_rgba(52,211,153,0.15)]">
                  <TrendingUp className="h-5 w-5 text-safe" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black tracking-tight text-3d">Trending Solana Tokens</h2>
                    <span className="px-2.5 py-1 rounded-lg bg-safe/10 text-safe text-[10px] font-black uppercase tracking-widest shadow-[0_0_12px_rgba(52,211,153,0.2)]">24h</span>
                  </div>
                  <p className="text-sm text-muted-foreground/60">
                    Top 10 trending tokens in 24h on Solana by MCAP, volume, liquidity and social buzz
                  </p>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs font-black text-muted-foreground bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.06]">
                  {trendingTokens.length} Trending
                </span>
                <button
                  onClick={() => fetchTokens(true)}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm font-bold text-muted-foreground transition-all duration-300 hover:bg-white/[0.08] hover:text-foreground hover:border-white/[0.12] disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  Refresh
                </button>
              </div>
            </div>

            {trendingTokens.length > 0 ? (
              <div className="overflow-hidden rounded-[1.5rem] border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                <div className="hidden grid-cols-[72px_minmax(0,1.8fr)_minmax(0,1fr)_120px_120px_100px_110px] items-center gap-4 border-b border-white/[0.04] bg-white/[0.02] px-5 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 lg:grid">
                  <span>Rank</span>
                  <span>Token</span>
                  <span>Price</span>
                  <span>24H Volume</span>
                  <span>Liquidity</span>
                  <span>24H</span>
                  <span>MC</span>
                </div>

                <div className="divide-y divide-white/[0.03]">
                  {trendingTokens.map((token) => (
                    <TrendingTokenRow key={token.address} token={token} />
                  ))}
                </div>
              </div>
            ) : (
              <EmptySection message="No trending Solana tokens are available right now." />
            )}
          </section>
        )}

        {/* ===== Intelligence Hub: FAQ Section ===== */}
        <FAQ />

        </div>
      </section>

        {/* ===== Powered By: Tech Stack Section ===== */}
        <TechStack />
      </div>
    </div>
  )
}

function formatLargeNumber(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function formatCompactUsd(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
  if (value >= 1) return `$${value.toFixed(4)}`
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 9 })}`
}

function formatChange(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
}

function TrendingTokenRow({ token }: { token: TrendingToken }) {
  const [copied, setCopied] = useState(false)
  const positive = token.priceChange24h >= 0

  const handleCopy = async () => {
    await navigator.clipboard.writeText(token.address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="group px-4 py-4 transition-colors hover:bg-accent/20 lg:px-5">
      <div className="hidden grid-cols-[72px_minmax(0,1.8fr)_minmax(0,1fr)_120px_120px_100px_110px] items-center gap-4 lg:grid">
        <div className="flex items-center gap-2">
          <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">#{token.rank}</span>
          {token.rank <= 3 ? <Flame className="h-4 w-4 text-warning" /> : null}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {token.image ? (
              <Image src={token.image} alt={token.name} width={36} height={36} className="h-9 w-9 rounded-lg object-cover ring-1 ring-border/40" unoptimized />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary ring-1 ring-border/40">
                {token.symbol.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-foreground">{token.symbol}</div>
              <div className="truncate text-sm text-muted-foreground">{token.name}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <button type="button" onClick={handleCopy} className="truncate font-mono hover:text-primary">
              {copied ? "Copied" : `${token.address.slice(0, 6)}...${token.address.slice(-4)}`}
            </button>
            <Link
              href={`/scan?address=${token.address}`}
              className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Search className="h-3 w-3" />
              Scan Token
            </Link>
          </div>
        </div>

        <div className="text-sm font-semibold">{formatCompactUsd(token.price)}</div>
        <div className="text-sm font-semibold">{formatLargeNumber(token.volume24hUSD)}</div>
        <div className="text-sm font-semibold">{formatLargeNumber(token.liquidity)}</div>
        <div className={cn("text-sm font-black", positive ? "text-safe" : "text-danger")}>{formatChange(token.priceChange24h)}</div>
        <div className="text-sm font-semibold text-muted-foreground">{formatLargeNumber(token.marketCap)}</div>
      </div>

      <div className="space-y-4 rounded-[1.25rem] border border-border/30 bg-background/20 p-4 lg:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {token.image ? (
              <Image src={token.image} alt={token.name} width={40} height={40} className="h-10 w-10 rounded-xl object-cover ring-1 ring-border/40" unoptimized />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-black text-primary ring-1 ring-border/40">
                {token.symbol.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">#{token.rank}</span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">MC {formatLargeNumber(token.marketCap)}</span>
              </div>
              <div className="mt-2 truncate text-base font-black">{token.symbol}</div>
              <div className="truncate text-sm text-muted-foreground">{token.name}</div>
            </div>
          </div>

          <div className={cn("rounded-xl px-3 py-2 text-sm font-black", positive ? "bg-safe/10 text-safe" : "bg-danger/10 text-danger")}>
            {formatChange(token.priceChange24h)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Price</div>
            <div className="mt-1 font-semibold">{formatCompactUsd(token.price)}</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">24H Volume</div>
            <div className="mt-1 font-semibold">{formatLargeNumber(token.volume24hUSD)}</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Liquidity</div>
            <div className="mt-1 font-semibold">{formatLargeNumber(token.liquidity)}</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">MC</div>
            <div className="mt-1 font-semibold">{formatLargeNumber(token.marketCap)}</div>
          </div>
        </div>

        <button type="button" onClick={handleCopy} className="text-left font-mono text-xs text-primary">
          {copied ? "Copied" : `${token.address.slice(0, 6)}...${token.address.slice(-4)}`}
        </button>

        <Link
          href={`/scan?address=${token.address}`}
          className={cn(buttonVariants({ variant: "ghost" }), "h-11 w-full justify-between rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent text-[11px] font-black uppercase tracking-[0.2em] hover:border-primary hover:bg-primary hover:text-primary-foreground")}
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Scan Token
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

// ===== Tech Stack Marquee Component =====
function TechStack() {
  const logos = [
    { name: "SOLANA", color: "text-primary" },
    { name: "BAGS", color: "text-rose-400" },
    { name: "HELIUS", color: "text-purple-500" },
    { name: "BIRDEYE", color: "text-amber-500" },
    { name: "JUPITER", color: "text-teal-400" },
    { name: "DEXSCREENER", color: "text-sky-400" },
    { name: "OPENROUTER", color: "text-orange-500" },
    { name: "GECKOTERMINAL", color: "text-lime-400" },
    { name: "PRIVY", color: "text-orange-400" },
    { name: "SUPABASE", color: "text-emerald-500" },
  ]

  const displayLogos = [...logos, ...logos, ...logos]

  return (
    <section className="relative py-24 border-t border-white/[0.04] overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
      
      <div className="dashboard-shell relative mb-12 space-y-3 text-center">
        <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground/30">Powered By</h3>
        <p className="text-sm font-bold text-muted-foreground/50">Built with cutting-edge Solana infrastructure &amp; real-time data providers</p>
      </div>

      <div className="relative flex overflow-hidden group">
        <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        <div className="flex animate-marquee gap-16 md:gap-28 items-center whitespace-nowrap">
          {displayLogos.map((logo, index) => (
            <div
              key={index}
              className="flex items-center gap-2 group/logo grayscale hover:grayscale-0 opacity-30 hover:opacity-100 transition-all duration-500 cursor-default hover:scale-110"
            >
              <div className={cn(
                "text-3xl md:text-5xl font-black italic tracking-tighter transition-all duration-500",
                "group-hover/logo:drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]",
                logo.color
              )}>
                {logo.name}
              </div>
            </div>
          ))}
          {displayLogos.map((logo, index) => (
            <div
              key={`dup-${index}`}
              className="flex items-center gap-2 group/logo grayscale hover:grayscale-0 opacity-30 hover:opacity-100 transition-all duration-500 cursor-default hover:scale-110"
            >
              <div className={cn(
                "text-3xl md:text-5xl font-black italic tracking-tighter transition-all duration-500",
                "group-hover/logo:drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]",
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
// ===== Token Slider / Carousel =====
function TokenSlider({ tokens }: { tokens: Token[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener("scroll", checkScroll, { passive: true })
    window.addEventListener("resize", checkScroll)
    return () => {
      el.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
    }
  }, [checkScroll, tokens.length])

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current
    if (!el) return
    const cardWidth = el.querySelector<HTMLElement>(":scope > div")?.offsetWidth || 320
    const isMobile = window.innerWidth < 768
    const scrollAmount = cardWidth * (isMobile ? 1 : 3) + (isMobile ? 16 : 48)
    el.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" })
  }

  return (
    <div className="relative group/slider">
      {/* Left Arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 md:-left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 md:w-10 md:h-10 rounded-full bg-background/95 border border-border/50 shadow-lg flex items-center justify-center text-foreground hover:bg-accent transition-colors backdrop-blur-sm"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
        </button>
      )}

      {/* Right Arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 md:-right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 md:w-10 md:h-10 rounded-full bg-background/95 border border-border/50 shadow-lg flex items-center justify-center text-foreground hover:bg-accent transition-colors backdrop-blur-sm"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
        </button>
      )}

      {/* Left fade */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      )}
      {/* Right fade */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      )}

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {tokens.map((token) => (
          <div key={token.id} className="flex-shrink-0 w-[280px] md:w-[320px] h-full">
            <TokenCard token={token} />
          </div>
        ))}
      </div>
    </div>
  )
}

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
        "relative overflow-hidden border-border/40 bg-card/40 backdrop-blur-md flex flex-col group transition-all duration-500 h-full",
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

      <CardContent className="pb-4 relative z-10 flex-1 flex flex-col">
        <p className="text-xs text-muted-foreground/80 line-clamp-2 mb-4 leading-relaxed font-medium min-h-[2.5rem]">
          {token.description || "\u00A0"}
        </p>

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
        <div className="flex items-center gap-2 mt-auto pt-4 border-t border-border/10 min-h-[2.5rem]">
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
