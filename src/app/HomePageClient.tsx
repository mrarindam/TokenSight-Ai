"use client"

import FAQ from "@/components/FAQ"
import sightAiPreview from "@/app/images/ai.png"
import alertsPreview from "@/app/images/alart.png"
import historyPreview from "@/app/images/history.png"
import portfolioPreview from "@/app/images/portfolio.png"
import profilePreview from "@/app/images/profile.png"
import telegramBotPreview from "@/app/images/TG bot.png"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { usePrivy } from "@privy-io/react-auth"
import {
  Activity,
  ArrowRight,
  Loader2,
  Search,
  Shield,
  BarChart3,
  Wallet,
  Bell,
  Brain,
  LogIn,
  User,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type HomeStats = {
  total_scans: number
  monthly_scans: number
  total_users: number
}

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

export default function Home() {
  const { authenticated } = usePrivy()
  const router = useRouter()
  const [globalStats, setGlobalStats] = useState<HomeStats | null>(null)
  const [directScanAddress, setDirectScanAddress] = useState("")
  const [isRoutingToScan, setIsRoutingToScan] = useState(false)

  useEffect(() => {
    let active = true

    const fetchStats = async () => {
      try {
        const response = await fetch("/api/stats", { cache: "no-store" })
        if (!response.ok) return

        const stats: HomeStats = await response.json()
        if (active) {
          setGlobalStats(stats)
        }
      } catch (err) {
        console.error("[Home] Error fetching stats:", err)
      }
    }

    void fetchStats()

    return () => {
      active = false
    }
  }, [])

  const dynamicStats = [
    { label: "Total Analyzed", value: globalStats?.total_scans ?? 0, icon: Search },
    { label: "Monthly Scans", value: globalStats?.monthly_scans ?? 0, icon: Activity },
    { label: "Total Users", value: globalStats?.total_users ?? 0, icon: Shield },
    { label: "Accuracy Rate", value: "99.2%", icon: BarChart3 },
  ]

  const handleDirectScan = () => {
    const normalizedAddress = directScanAddress.trim()
    if (!normalizedAddress) return

    setIsRoutingToScan(true)
    router.push(`/scan?address=${encodeURIComponent(normalizedAddress)}`)
  }

  return (
    <div className="flex flex-col min-h-screen relative">
      {/* ===== Hero Section — 3D Dopamine Vibe ===== */}
      <section className="relative overflow-hidden border-b border-white/[0.04]">
        {/* Grid background */}
        <div className="absolute inset-0 hero-grid" />



        <div className="dashboard-shell relative py-16 md:py-20 lg:py-24 xl:py-28">
          <div className="dashboard-grid items-center">
            <div className="col-span-12 mx-auto flex w-full max-w-6xl flex-col items-center space-y-8 text-center xl:space-y-10">


              <div className="mx-auto flex w-full max-w-6xl flex-col items-center space-y-5">
                <h1
                  className="mx-auto w-full max-w-none text-center text-4xl font-extrabold leading-[0.98] tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-7xl xl:whitespace-nowrap animate-fade-up"
                  style={{ animationDelay: "0.1s" }}
                >
                  Solana Token Scanner
                  <span className="mt-2 block text-primary">
                    & Rug Checker
                  </span>
                </h1>

                <p
                  className="mx-auto max-w-3xl text-center text-base leading-relaxed text-zinc-800 dark:text-zinc-100 sm:text-lg xl:text-xl animate-fade-up"
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
                      <span className="text-3xl font-extrabold tracking-tight text-foreground transition-transform duration-500 group-hover:translate-x-1">
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

        {/* --- Scan Preview Section --- */}
        <section className="relative overflow-hidden py-20 md:py-28">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
          <div className="dashboard-shell relative">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="space-y-6 px-2 py-2 md:px-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-primary shadow-sm backdrop-blur-sm">
                  <Activity className="h-3.5 w-3.5 animate-pulse" />
                  Scan Preview
                </div>

                <div className="space-y-4">
                  <h3 className="max-w-xl text-3xl font-extrabold tracking-tight text-foreground md:text-5xl md:leading-tight">
                    Live Scan Preview
                  </h3>
                  <p className="max-w-xl text-base leading-relaxed text-zinc-800 dark:text-zinc-100 md:text-lg">
                    Watch the TokenSight scan experience in motion, then paste a token address below and jump straight into the full scan page with the analysis auto-started.
                  </p>
                </div>
              </div>

              <div className="relative">
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

        {/* --- Direct Scan Section --- */}
        <section id="manual-scan" className="relative overflow-hidden py-20 md:py-28">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
          <div className="dashboard-shell relative">
            <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div className="space-y-8 px-2 py-2 md:px-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-primary shadow-sm backdrop-blur-sm">
                  <Search className="h-3.5 w-3.5" />
                  Scan From Homepage
                </div>

                <div className="space-y-4">
                  <h3 className="max-w-3xl text-3xl font-black tracking-tight text-foreground md:text-5xl md:leading-tight xl:text-6xl text-3d">
                    Paste a token address and go straight into the scan
                  </h3>
                  <p className="max-w-2xl text-base leading-relaxed text-zinc-800 dark:text-zinc-100 md:text-lg">
                    Drop any Solana token address into the entry field and launch a full TokenSight scan instantly. No friction, no extra clicks, just direct intelligence on liquidity, holders, creator behavior, and momentum.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: "Input", value: "Any Solana token" },
                    { label: "Flow", value: "Scan First" },
                    { label: "Output", value: "Full risk breakdown" },
                  ].map((item) => (
                    <div key={item.label} className="space-y-2 rounded-2xl border border-border bg-muted/40 p-4 backdrop-blur-sm">
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{item.label}</div>
                      <div className="text-sm font-black text-foreground">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/scan"
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "group h-16 min-w-[260px] rounded-2xl px-8 text-lg font-black tracking-[0.08em] shadow-[0_0_36px_rgba(99,102,241,0.35)] transition-all duration-500 bg-gradient-to-r from-primary via-blue-500 to-primary text-primary-foreground hover:shadow-[0_0_56px_rgba(99,102,241,0.55)] animate-aurora bg-[length:220%_220%]"
                    )}
                  >
                    <Search className="mr-3 h-5 w-5 transition-transform duration-500 group-hover:scale-110" />
                    Scan a Token
                    <ArrowRight className="ml-3 h-5 w-5 transition-transform duration-500 group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href="/scan/history"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "h-16 min-w-[220px] rounded-2xl border-white/10 bg-white/[0.03] px-8 text-base font-semibold backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08]"
                    )}
                  >
                    <Activity className="mr-3 h-5 w-5" /> Recent Scans
                  </Link>
                </div>
              </div>

              <div className="relative">
                <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-4 shadow-xl">
                  <div className="rounded-[1.6rem] border border-border bg-muted/40 p-5 md:p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.32em] text-primary">Direct Entry</div>
                        <div className="mt-2 text-2xl font-black text-foreground md:text-3xl">Scan Workspace</div>
                      </div>
                      <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary shadow-sm">
                        <Search className="h-6 w-6" />
                      </div>
                    </div>

                    <div className="space-y-4 rounded-[1.4rem] border border-border bg-card p-4 md:p-5">
                      <form
                        className="space-y-3"
                        onSubmit={(event) => {
                          event.preventDefault()
                          handleDirectScan()
                        }}
                      >
                        <div>
                          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Token Address</div>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={directScanAddress}
                              onChange={(event) => setDirectScanAddress(event.target.value)}
                              placeholder="Paste any Solana token address to auto-scan"
                              className="h-14 rounded-2xl border-primary/15 bg-primary/[0.05] pl-11 pr-4 font-mono text-xs text-foreground/85 md:text-sm"
                            />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Press Enter or hit scan. You will be redirected to the scan page and the analysis will start automatically.
                          </p>
                        </div>

                        <button
                          type="submit"
                          disabled={!directScanAddress.trim() || isRoutingToScan}
                          className={cn(
                            buttonVariants({ size: "lg" }),
                            "h-14 w-full justify-between rounded-2xl bg-primary px-6 text-sm font-black uppercase tracking-[0.22em] text-primary-foreground shadow-md transition-all duration-300 hover:scale-[1.01] disabled:pointer-events-none disabled:opacity-60"
                          )}
                        >
                          <span className="flex items-center gap-3" >
                            {isRoutingToScan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            {isRoutingToScan ? "Launching Scan" : "Scan"}
                          </span>
                        </button>
                      </form>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-muted/40 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Checks</div>
                          <div className="mt-2 text-sm font-semibold text-foreground">Liquidity, holders, creator, socials</div>
                        </div>
                        <div className="rounded-2xl border border-border bg-muted/40 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Result</div>
                          <div className="mt-2 text-sm font-semibold text-foreground">Instant risk scoring and breakdown</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="section-glow-divider w-full px-4 sm:px-6 lg:px-12 xl:px-20" />

        {/* --- Sight AI --- */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="dashboard-shell relative">
            <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
              <div className="space-y-6 px-2 py-2 md:px-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-primary shadow-sm backdrop-blur-sm">
                  <Brain className="h-3.5 w-3.5" />
                  Sight AI
                </div>

                <div className="space-y-4">
                  <h3 className="max-w-2xl text-3xl font-extrabold tracking-tight text-foreground md:text-5xl md:leading-tight">
                    WE PROVIDE <span className="text-primary">SIGHT AI</span> - TOKENSIGHT COPILOT
                  </h3>
                  <p className="max-w-xl text-base leading-relaxed text-zinc-800 dark:text-zinc-100 md:text-lg">
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
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{item.label}</div>
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
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-primary shadow-sm backdrop-blur-sm">
                  <Bell className="h-3.5 w-3.5" />
                  Telegram Bot
                </div>

                <div className="space-y-4">
                  <h3 className="max-w-2xl text-3xl font-extrabold tracking-tight text-foreground md:text-5xl md:leading-tight">
                    WE PROVIDE <span className="text-primary">TELEGRAM BOT</span> - TOKENSIGHT AI
                  </h3>
                  <p className="max-w-xl text-base leading-relaxed text-zinc-800 dark:text-zinc-100 md:text-lg">
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
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{item.label}</div>
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
          <div className="dashboard-shell relative">
            <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
              <div className="space-y-6 px-2 py-2 md:px-3 lg:order-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-primary shadow-sm backdrop-blur-sm">
                  <Wallet className="h-3.5 w-3.5" />
                  Live Portfolio
                </div>

                <div className="space-y-4">
                  <h3 className="max-w-2xl text-3xl font-extrabold tracking-tight text-foreground md:text-5xl md:leading-tight">
                    WE PROVIDE <span className="text-primary">LIVE PORTFOLIO</span>
                  </h3>
                  <p className="max-w-xl text-base leading-relaxed text-zinc-800 dark:text-zinc-100 md:text-lg">
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
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{item.label}</div>
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
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-primary shadow-sm backdrop-blur-sm">
                  <Bell className="h-3.5 w-3.5" />
                  Alerts System
                </div>

                <div className="space-y-4">
                  <h3 className="max-w-2xl text-3xl font-extrabold tracking-tight text-foreground md:text-5xl md:leading-tight">
                    WE PROVIDE <span className="text-primary">ALERTS SYSTEM</span>
                  </h3>
                  <p className="max-w-xl text-base leading-relaxed text-zinc-800 dark:text-zinc-100 md:text-lg">
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
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{item.label}</div>
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
          <div className="dashboard-shell relative">
            <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
              <div className="space-y-6 px-2 py-2 md:px-3 lg:order-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-primary shadow-sm backdrop-blur-sm">
                  <Activity className="h-3.5 w-3.5" />
                  Scan History
                </div>

                <div className="space-y-4">
                  <h3 className="max-w-2xl text-3xl font-extrabold tracking-tight text-foreground md:text-5xl md:leading-tight">
                    WE PROVIDE <span className="text-primary">SCAN HISTORY</span> SECTION
                  </h3>
                  <p className="max-w-xl text-base leading-relaxed text-zinc-800 dark:text-zinc-100 md:text-lg">
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
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{item.label}</div>
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
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-primary shadow-sm backdrop-blur-sm">
                  <User className="h-3.5 w-3.5" />
                  Profile Intelligence
                </div>

                <div className="space-y-4">
                  <h3 className="max-w-2xl text-3xl font-extrabold tracking-tight text-foreground md:text-5xl md:leading-tight">
                    WE KNOW WHO YOU ARE VIA <span className="text-primary">PROFILE</span>
                  </h3>
                  <p className="max-w-xl text-base leading-relaxed text-zinc-800 dark:text-zinc-100 md:text-lg">
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
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{item.label}</div>
                      <div className="text-sm font-black text-foreground">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="section-glow-divider w-full px-4 sm:px-6 lg:px-12 xl:px-20" />

        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.015] via-transparent to-primary/[0.015]" />
          <div className="dashboard-shell relative space-y-12">
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
