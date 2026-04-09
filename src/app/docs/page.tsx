"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  BookOpen, Scan, Target, Bell, Trophy, History, Bot,
  Rocket, Cpu, Eye, Crosshair, ArrowRight, ChevronRight, Menu, X, UserCircle, MessageSquareText
} from "lucide-react"
import { cn } from "@/lib/utils"

const SECTIONS = [
  { id: "about", label: "About TokenSight AI", icon: Eye },
  { id: "mission", label: "Mission & Vision", icon: Rocket },
  { id: "scanner", label: "Token Scanner", icon: Scan },
  { id: "portfolio", label: "Portfolio Tracker", icon: Target },
  { id: "alerts", label: "Alerts Center", icon: Bell },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "telegram", label: "Telegram Bot", icon: Bot },
  { id: "profile", label: "Your Profile", icon: UserCircle },
  { id: "history", label: "Scan History", icon: History },
  { id: "sightai", label: "Sight AI", icon: MessageSquareText },
  { id: "tech", label: "Tech Stack", icon: Cpu },
  { id: "roadmap", label: "Roadmap", icon: Crosshair },
] as const

function SectionCard({ id, icon: Icon, title, iconColor, accentColor, children }: {
  id: string; icon: React.ElementType; title: string;
  iconColor: string; accentColor: string; children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-28 group/section relative rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-6 md:p-8 overflow-hidden transition-all duration-500 hover:border-primary/20">
      <div className={cn("absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent to-transparent opacity-40 group-hover/section:opacity-100 transition-opacity", accentColor)} />
      <div className="absolute -top-16 -right-16 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none group-hover/section:bg-primary/10 transition-colors" />
      <div className="relative z-10 flex items-center gap-3 mb-5">
        <div className={cn("p-2.5 rounded-xl border shadow-lg", iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="relative z-10 space-y-4 text-sm leading-relaxed text-muted-foreground/80">
        {children}
      </div>
    </section>
  )
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("about")
  const [tocOpen, setTocOpen] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    )
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <div className="container max-w-7xl px-4 py-8 md:px-6 md:py-12">
      {/* Hero */}
      <div className="relative rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-8 md:p-12 overflow-hidden mb-10">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4 mb-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20 shadow-xl shadow-primary/10">
            <BookOpen className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Documentation</h1>
            <p className="mt-1 text-sm text-muted-foreground/70">Everything you need to know about TokenSight AI</p>
          </div>
        </div>
      </div>

      {/* Mobile TOC toggle */}
      <div className="lg:hidden mb-6">
        <button
          onClick={() => setTocOpen(!tocOpen)}
          className="w-full flex items-center justify-between rounded-xl border border-border/30 bg-card/60 backdrop-blur-xl px-4 py-3 text-sm font-semibold"
        >
          <span className="flex items-center gap-2">{tocOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />} Table of Contents</span>
          <ChevronRight className={cn("h-4 w-4 transition-transform", tocOpen && "rotate-90")} />
        </button>
        {tocOpen && (
          <nav className="mt-2 rounded-xl border border-border/30 bg-card/60 backdrop-blur-xl p-3 space-y-1">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} onClick={() => setTocOpen(false)}
                className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                  activeSection === s.id ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground/60 hover:text-foreground hover:bg-primary/5"
                )}>
                <s.icon className="h-3.5 w-3.5" /> {s.label}
              </a>
            ))}
          </nav>
        )}
      </div>

      <div className="flex gap-8">
        {/* Sticky sidebar — desktop */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-28 rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-4 space-y-1">
            <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40 font-bold">On this page</p>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`}
                className={cn("group/nav flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-300",
                  activeSection === s.id
                    ? "bg-gradient-to-r from-primary/15 to-transparent text-primary font-bold shadow-sm"
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-primary/5"
                )}>
                <s.icon className={cn("h-3.5 w-3.5 transition-colors", activeSection === s.id ? "text-primary" : "text-muted-foreground/30 group-hover/nav:text-muted-foreground/60")} />
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">

          <SectionCard id="about" icon={Eye} title="About TokenSight AI"
            iconColor="bg-gradient-to-br from-primary/20 to-blue-500/20 border-primary/20 shadow-primary/10 text-primary"
            accentColor="via-primary/50">
            <p>
              <strong className="text-foreground">TokenSight AI</strong> is an AI-powered token intelligence platform built for the Solana ecosystem.
              It helps traders and researchers make data-driven decisions by analyzing on-chain data, liquidity depth, holder distribution,
              trading volume, and social signals — all distilled into a single <strong className="text-foreground">Intelligence Score</strong>.
            </p>
            <p>
              Built and maintained by a solo full-stack developer passionate about crypto and cutting-edge web technology,
              TokenSight AI combines real-time blockchain data with intelligent scoring to give you an edge in the fast-moving
              world of Solana tokens.
            </p>
            <p>
              Whether you are scouting newly launched tokens on Bags or evaluating established projects, TokenSight AI
              provides the signals you need — no noise, just intelligence.
            </p>
          </SectionCard>

          <SectionCard id="mission" icon={Rocket} title="Mission & Vision"
            iconColor="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/20 shadow-purple-500/10 text-purple-400"
            accentColor="via-purple-500/50">
            <div className="space-y-3">
              <div className="rounded-xl border border-border/20 bg-background/40 p-4">
                <h3 className="font-bold text-foreground mb-1">🎯 Mission</h3>
                <p>To democratize crypto token intelligence — making institutional-grade analysis accessible to every trader,
                  regardless of experience or portfolio size. We believe everyone deserves accurate, real-time data to make confident entry decisions.</p>
              </div>
              <div className="rounded-xl border border-border/20 bg-background/40 p-4">
                <h3 className="font-bold text-foreground mb-1">🔭 Vision</h3>
                <p>To become the go-to intelligence layer for the Solana ecosystem — expanding into scan contests,
                  community-driven insights, advanced portfolio analytics, and a full-featured mobile experience.
                  More features are actively being developed and shipped regularly.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="scanner" icon={Scan} title="Token Scanner"
            iconColor="bg-gradient-to-br from-cyan-500/20 to-primary/20 border-cyan-500/20 shadow-cyan-500/10 text-cyan-400"
            accentColor="via-cyan-500/50">
            <p>The core of TokenSight AI. Paste any Solana token address and get an instant intelligence report with a full breakdown of on-chain and market data.</p>

            <h3 className="font-bold text-foreground pt-2">How the Intelligence Score works</h3>
            <p>The overall score (0–100) is the <strong className="text-foreground">average of four sub-scores</strong>, each evaluating a different dimension of the token:</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="font-bold text-foreground text-sm">Quality</span>
                  <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-emerald-400">0–100</span>
                </div>
                <p className="text-xs text-muted-foreground/70">Evaluates token fundamentals — liquidity depth, holder distribution, metadata completeness, and whether the project has verified socials and a website.</p>
              </div>
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  <span className="font-bold text-foreground text-sm">Momentum</span>
                  <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-blue-400">0–100</span>
                </div>
                <p className="text-xs text-muted-foreground/70">Measures current market activity and trend strength — 24h trading volume, price action velocity, and buyer/seller ratio patterns.</p>
              </div>
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-2 w-2 rounded-full bg-purple-400" />
                  <span className="font-bold text-foreground text-sm">Confidence</span>
                  <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-purple-400">0–100</span>
                </div>
                <p className="text-xs text-muted-foreground/70">Indicates how much the data sources agree with each other. High confidence means multiple signals are aligned and the analysis is reliable.</p>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  <span className="font-bold text-foreground text-sm">Risk Cap</span>
                  <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-rose-400">0–100</span>
                </div>
                <p className="text-xs text-muted-foreground/70">The risk ceiling penalty. A score of 100 means no risk flags detected. Lower values indicate concentrated holdings, low liquidity, or suspicious patterns that cap the overall score.</p>
              </div>
            </div>

            <h3 className="font-bold text-foreground pt-2">What you get in a scan result</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Token Logo &amp; Name</strong> — The token&apos;s logo image, name, and symbol are displayed prominently at the top of the scan result.</li>
              <li><strong className="text-foreground">Animated score ring</strong> — Color-coded visual (red ≤30, yellow 31–59, blue 60–84, green 85+) with smooth fill animation and inline sub-scores.</li>
              <li><strong className="text-foreground">Security Badges</strong> — Three badges showing <em>Mint authority</em> (disabled = safe), <em>Freeze authority</em> (disabled = safe), and <em>LP burn profile</em> (strong = safe). Green means renounced/safe, red means still enabled/risky. Fetched from the Helius getAsset API.</li>
              <li><strong className="text-foreground">Trust Signals</strong> — Jupiter verification, strict tagging, suspicious audit status, organic score, and Helius metadata mutability. Optional rows like tax, max fee, and dev balance only appear when real provider data exists.</li>
              <li><strong className="text-foreground">Launch Metadata</strong> — Launch type, launchpad, first mint time, first pool time, first mint transaction, pool ids, and Bags launch context when available.</li>
              <li><strong className="text-foreground">Trading Flow</strong> — Jupiter Tokens V2 windows for 5m, 1h, 6h, and 24h showing buy volume, sell volume, traders, organic buyers, and price change.</li>
              <li><strong className="text-foreground">Liquidity Intelligence</strong> — Meteora DLMM + DAMM v2 liquidity analysis with total liquidity, protocol split, liquidity score, near-price coverage, reserve-based $100 / $1,000 price-impact estimates, and risk warnings.</li>
              <li><strong className="text-foreground">Intelligence Signals</strong> — AI-generated bullet points flagging key findings (e.g. &quot;Strong holder base&quot;, &quot;Low liquidity risk&quot;). Each signal is auto-classified by severity with color-coded icons.</li>
              <li><strong className="text-foreground">Market Metrics</strong> — 7 cards showing Price, Liquidity, Volume (24h), Holders, Top 10 Wallet Concentration, Creator Tokens, and Market Cap. Large numbers use compact K/M/B formatting (e.g. $1.80M instead of $1,795,000).</li>
              <li><strong className="text-foreground">Holder Breakdown</strong> — Top 10 holder wallets with percentage bars and truncated wallet addresses. Each address has a copy button on hover. Shown for all tokens regardless of holder count.</li>
              <li><strong className="text-foreground">&gt;1K Holder Warning</strong> — When a token has more than 1,000 holders, a caution banner appears explaining that Helius API cannot fully snapshot large holder sets, with a direct link to verify on Birdeye.</li>
              <li><strong className="text-foreground">Identity &amp; Ownership</strong> — Key on-chain identity data: Token Mint address, Pool Address, Deployer wallet, Owner wallet, and Created timestamp. Each address has a copy-to-clipboard button.</li>
              <li><strong className="text-foreground">Links &amp; Social</strong> — Aggregated social links: Website, Twitter, Telegram (clickable), Quote Token, Searched Mint address, and token Status (graduated, listed, etc.). Data sourced from Bags API, DexScreener, and Birdeye.</li>
              <li><strong className="text-foreground">AI Summary</strong> — A natural-language explanation with keyword highlighting (green for bullish like &quot;strong&quot;, &quot;healthy&quot;; red for bearish like &quot;extreme&quot;, &quot;low&quot;). Includes the &gt;1K holder Birdeye link when applicable.</li>
              <li><strong className="text-foreground">Live Chart</strong> — Embedded token price chart powered by DexScreener.</li>
              <li><strong className="text-foreground">Swap Widget</strong> — Swap directly into the token via Jupiter with MEV protection, without leaving the page.</li>
              <li><strong className="text-foreground">Quick Actions</strong> — Add to portfolio and alert buttons stay visible for guests too. If a guest clicks them, a login prompt appears directly above the action bar instead of redirecting or hiding the buttons.</li>
            </ul>

            <h3 className="font-bold text-foreground pt-2">Risk Labels</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400">STRONG OPPORTUNITY (85+)</span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-500/15 text-cyan-400">GOOD ENTRY (60–84)</span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400">WATCH SIGNAL (31–59)</span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-400">HIGH RISK (≤30)</span>
            </div>

            <h3 className="font-bold text-foreground pt-2">How to use</h3>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Go to the <strong className="text-foreground">Scan</strong> page.</li>
              <li>Paste a Solana token address in the search bar.</li>
              <li>Hit <strong className="text-foreground">Scan</strong> and wait for the AI analysis (3-phase loading animation).</li>
              <li>Review the overall score, 4 sub-scores (Quality, Momentum, Confidence, Risk Cap), and security badges (Mint, Freeze, LP Burn).</li>
              <li>Check Trust Signals, Launch Metadata, Trading Flow, and Liquidity Intelligence to understand verification, launch structure, execution depth, and slippage risk.</li>
              <li>Review signals, market metrics (including Market Cap), holder breakdown with wallet addresses, and identity &amp; ownership data.</li>
              <li>Review links &amp; social, the AI summary, and live chart.</li>
              <li>Use the swap widget or quick actions directly from the result. Guests can click the quick actions and then authenticate from the bottom prompt.</li>
            </ol>

            <h3 className="font-bold text-foreground pt-2">Scan Layout</h3>
            <p>Results are displayed as a multi-section dashboard with glowing widget borders:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Protocol layer</strong> — Trust Signals, Bags-specific fee or behavior details when available, and Launch Metadata</li>
              <li><strong className="text-foreground">Flow &amp; Liquidity</strong> — Jupiter Trading Flow followed by the Meteora Liquidity Intelligence widget</li>
              <li><strong className="text-foreground">Core analysis</strong> — Intelligence Signals, Live Chart, Market Metrics, Holder Breakdown, and Identity &amp; Ownership</li>
              <li><strong className="text-foreground">Execution layer</strong> — AI Summary, Swap Widget, Links &amp; Social, and bottom quick actions</li>
            </ul>
            <p className="text-xs text-muted-foreground/60">On mobile, all widgets stack vertically. Optional trust or fee rows stay hidden if provider data does not exist, and the guest login prompt opens above the quick-action buttons.</p>

            <p className="text-xs text-muted-foreground/50">Guest users get a limited number of daily scans. Log in for unlimited access.</p>
          </SectionCard>

          <SectionCard id="portfolio" icon={Target} title="Portfolio Tracker"
            iconColor="bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border-emerald-500/20 shadow-emerald-500/10 text-emerald-400"
            accentColor="via-emerald-500/50">
            <p>Track your Solana token holdings, monitor live prices, and see your ROI at a glance.</p>
            <h3 className="font-bold text-foreground pt-2">Features</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Live price tracking</strong> — Current prices fetched automatically via DexScreener.</li>
              <li><strong className="text-foreground">ROI calculation</strong> — See profit/loss percentage for each holding in real time.</li>
              <li><strong className="text-foreground">Risk tagging</strong> — Assign LOW, MEDIUM, or HIGH risk to each position.</li>
              <li><strong className="text-foreground">Notes</strong> — Add personal notes or thesis for each token.</li>
              <li><strong className="text-foreground">Summary cards</strong> — Total holdings, invested value, live portfolio value, and overall PnL.</li>
            </ul>
            <h3 className="font-bold text-foreground pt-2">How to use</h3>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Navigate to the <strong className="text-foreground">Portfolio</strong> page.</li>
              <li>Fill in the token address, name, quantity, and entry price.</li>
              <li>Click <strong className="text-foreground">Add to Portfolio</strong>.</li>
              <li>Your holdings will appear with live prices and ROI updates.</li>
              <li>Edit or delete entries anytime.</li>
            </ol>
          </SectionCard>

          <SectionCard id="alerts" icon={Bell} title="Alerts Center"
            iconColor="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/20 shadow-amber-500/10 text-amber-400"
            accentColor="via-amber-500/50">
            <p>Set up price alerts for any Solana token and get notified when your conditions are met.</p>
            <h3 className="font-bold text-foreground pt-2">Alert Types</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Price Drop</strong> — Triggers when the token price falls below your threshold.</li>
              <li><strong className="text-foreground">Price Rise</strong> — Triggers when the token price rises above your threshold.</li>
              <li><strong className="text-foreground">Volume Spike</strong> — Triggers on unusual volume activity.</li>
            </ul>
            <h3 className="font-bold text-foreground pt-2">How to use</h3>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Go to <strong className="text-foreground">Alerts</strong> and enter a token address.</li>
              <li>Select the alert type and set your price threshold.</li>
              <li>Click <strong className="text-foreground">Create Alert</strong>.</li>
              <li>Active alerts are listed below, showing status (ACTIVE/TRIGGERED) and last checked time.</li>
              <li>Alerts can be sent to your linked Telegram for instant notifications.</li>
            </ol>
          </SectionCard>

          <SectionCard id="leaderboard" icon={Trophy} title="Leaderboard"
            iconColor="bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border-yellow-500/20 shadow-yellow-500/10 text-yellow-400"
            accentColor="via-yellow-500/50">
            <p>Compete with other users and climb the ranks based on your scanning activity and accuracy.</p>
            <h3 className="font-bold text-foreground pt-2">How it works</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">XP &amp; Levels</strong> — Earn XP for every scan. More scans = higher level.</li>
              <li><strong className="text-foreground">Leagues</strong> — Progress through leagues (Bronze, Silver, Gold, etc.) as you level up.</li>
              <li><strong className="text-foreground">Streaks</strong> — Maintain daily scan streaks for bonus recognition.</li>
              <li><strong className="text-foreground">Rankings</strong> — See where you stand against the community on the public leaderboard.</li>
            </ul>
          </SectionCard>

          <SectionCard id="telegram" icon={Bot} title="Telegram Bot"
            iconColor="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/20 shadow-blue-500/10 text-blue-400"
            accentColor="via-blue-500/50">
            <p>Connect your Telegram account to receive scan results and price alerts directly in your chat via <a href="https://t.me/TokenSightai_bot" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">@TokenSightai_bot</a>.</p>
            <h3 className="font-bold text-foreground pt-2">Current features</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Alert notifications</strong> — Get instant Telegram messages when your price alerts trigger.</li>
              <li><strong className="text-foreground">Scan results</strong> — Receive token scan summaries right in Telegram.</li>
            </ul>
            <h3 className="font-bold text-foreground pt-2">How to link</h3>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open <a href="https://t.me/TokenSightai_bot" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@TokenSightai_bot</a> in Telegram and tap <strong className="text-foreground">/start</strong>.</li>
              <li>The bot will reply with your <strong className="text-foreground">Telegram ID</strong>.</li>
              <li>Go to <strong className="text-foreground">Settings → Telegram</strong> on TokenSight AI.</li>
              <li>Paste your Telegram ID and click <strong className="text-foreground">Link</strong>.</li>
              <li>You will now receive notifications for triggered alerts.</li>
            </ol>
            <p className="text-xs text-muted-foreground/50">More Telegram bot features are actively being developed — including inline scanning and portfolio summaries.</p>
          </SectionCard>

          <SectionCard id="profile" icon={UserCircle} title="Your Profile"
            iconColor="bg-gradient-to-br from-pink-500/20 to-rose-500/20 border-pink-500/20 shadow-pink-500/10 text-pink-400"
            accentColor="via-pink-500/50">
            <p>Your personal dashboard — track your progress, manage your identity, and see how you stack up against the community.</p>

            <h3 className="font-bold text-foreground pt-2">Profile Card</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Avatar &amp; Display Name</strong> — Customize your profile identity. Wallet-login users see a truncated address by default.</li>
              <li><strong className="text-foreground">Edit Profile</strong> — Update your username and avatar anytime via the edit button.</li>
              <li><strong className="text-foreground">Join Date</strong> — Shows when you created your account.</li>
              <li><strong className="text-foreground">Global Rank</strong> — Your position on the public leaderboard (e.g. #12).</li>
              <li><strong className="text-foreground">Skill Class</strong> — Automatically assigned based on your detection accuracy: <span className="text-emerald-400 font-semibold">Elite Analyst</span> (≥70%), <span className="text-cyan-400 font-semibold">Skilled</span> (≥50%), or <span className="text-amber-400 font-semibold">Learning</span> (&lt;50%).</li>
            </ul>

            <h3 className="font-bold text-foreground pt-2">Streak &amp; League</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Active Streak</strong> — Your current consecutive-day scan streak, displayed with a fire animation. Scan daily to keep it alive!</li>
              <li><strong className="text-foreground">League Tier</strong> — Determined by your total lifetime scans. Progress through Bronze, Silver, Gold, and beyond. Each league has its own color and badge.</li>
            </ul>

            <h3 className="font-bold text-foreground pt-2">Stats Dashboard</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { name: "Total Scans", desc: "Lifetime scan count plus how many you ran this week" },
                { name: "Intelligence Accuracy", desc: "Weighted detection rate — how often your scans align with positive outcomes" },
                { name: "Last Activity", desc: "Relative timestamp of your most recent scan with hover tooltip" },
                { name: "Best Accuracy Scan", desc: "Your highest-score scan ever, with token name and score displayed" },
                { name: "High Conviction Hits", desc: "Count of scans that scored above 70 — your pro analyst track record" },
                { name: "Weekly Average", desc: "Your daily scan average and total scans this week" },
              ].map((s) => (
                <div key={s.name} className="rounded-xl border border-border/20 bg-background/40 px-4 py-3 transition-all duration-300 hover:border-primary/20 hover:shadow-md">
                  <div className="font-bold text-foreground text-sm">{s.name}</div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">{s.desc}</div>
                </div>
              ))}
            </div>

            <h3 className="font-bold text-foreground pt-2">Additional Features</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Wallet Settings</strong> — Connect or manage your Solana wallet. Wallet-login users have special handling.</li>
              <li><strong className="text-foreground">Scan History Link</strong> — Quick access to your full paginated scan history.</li>
              <li><strong className="text-foreground">Disconnect Session</strong> — Sign out securely from your current session.</li>
            </ul>
          </SectionCard>

          <SectionCard id="history" icon={History} title="Scan History"
            iconColor="bg-gradient-to-br from-purple-500/20 to-primary/20 border-purple-500/20 shadow-purple-500/10 text-purple-400"
            accentColor="via-purple-500/50">
            <p>Every scan you run is saved to your personal history. Review past analyses, compare scores over time,
              and track how your token picks have evolved.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>View token name, score, risk level, and scan date for every past scan.</li>
              <li>Paginated and sortable for easy browsing.</li>
              <li>Available only for logged-in users.</li>
            </ul>
          </SectionCard>

          <SectionCard id="sightai" icon={MessageSquareText} title="Sight AI — Your TokenSight Copilot"
            iconColor="bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border-indigo-500/20 shadow-indigo-500/10 text-indigo-400"
            accentColor="via-indigo-500/50">
            <p>
              <strong className="text-foreground">Sight AI</strong> is the built-in AI assistant that lives inside TokenSight AI.
              It appears as a floating chat bubble on every page, giving you instant, conversational access to the platform’s
              intelligence engine without leaving your current workflow.
            </p>

            <h3 className="font-bold text-foreground pt-2">What Sight AI can do</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Token lookup</strong> — Ask about any Solana token by name or contract address. Sight AI fetches real-time price, liquidity, volume, market cap, holder count, and exchange listings.</li>
              <li><strong className="text-foreground">Full scan summaries</strong> — Request a complete scan and get the Intelligence Score, risk label, security badges, and AI-generated signals summarized in chat.</li>
              <li><strong className="text-foreground">Specific metrics</strong> — Ask for just the price, liquidity, holders, or any single metric and get a focused answer.</li>
              <li><strong className="text-foreground">Market &amp; exchange links</strong> — Ask where to buy or trade a token and get direct links to DexScreener, Birdeye, Jupiter, and more.</li>
              <li><strong className="text-foreground">Alert management</strong> — Create price-drop, price-rise, or score-change alerts directly from chat.</li>
              <li><strong className="text-foreground">Profile updates</strong> — Change your display name or avatar by telling Sight AI.</li>
              <li><strong className="text-foreground">Platform guidance</strong> — Ask how features work, what the leaderboard tracks, how streaks are calculated, or anything from the docs.</li>
            </ul>

            <h3 className="font-bold text-foreground pt-2">How it works</h3>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Click the <strong className="text-foreground">Sight AI</strong> bubble in the bottom-right corner of any page.</li>
              <li>Type a question or paste a token address.</li>
              <li>Sight AI determines intent — token data, platform help, or an action — and responds with live data, cards, and links.</li>
              <li>For token queries, it pulls data from Birdeye, DexScreener, GeckoTerminal, and the scan engine in real time.</li>
              <li>For open-ended questions, it uses OpenRouter (GPT-4o‑mini) grounded in TokenSight context so answers stay accurate.</li>
            </ol>

            <h3 className="font-bold text-foreground pt-2">Design principles</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Grounded in live data</strong> — Every token answer comes from the same data pipeline as the scanner, not from the AI model’s training data.</li>
              <li><strong className="text-foreground">No hallucination</strong> — If data is unavailable, Sight AI says so instead of making up numbers.</li>
              <li><strong className="text-foreground">Action-capable</strong> — Alerts and profile changes execute server-side; Sight AI confirms only after the action actually succeeds.</li>
              <li><strong className="text-foreground">Stateless per session</strong> — Chat resets on page reload for privacy. No conversation history is stored.</li>
            </ul>

            <p className="text-xs text-muted-foreground/50">Sight AI is available to all users. Some actions (alerts, profile edits) require being logged in.</p>
          </SectionCard>

          <SectionCard id="tech" icon={Cpu} title="Tech Stack & Data Sources"
            iconColor="bg-gradient-to-br from-rose-500/20 to-orange-500/20 border-rose-500/20 shadow-rose-500/10 text-rose-400"
            accentColor="via-rose-500/50">
            <p>TokenSight AI is powered by a modern stack and the best data providers in the Solana ecosystem:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { name: "Helius", desc: "On-chain data, token metadata, and holder analysis" },
                { name: "Birdeye", desc: "Real-time price feeds and trending token data" },
                { name: "DexScreener", desc: "Liquidity, volume, and pair analytics" },
                { name: "Jupiter", desc: "Swap routing and token pricing" },
                { name: "Bags", desc: "Early-stage token discovery" },
                { name: "GeckoTerminal", desc: "Pool liquidity and market cap fallback" },
                { name: "OpenRouter", desc: "AI model routing for Sight AI assistant" },
                { name: "Next.js 14", desc: "Full-stack React framework" },
                { name: "Supabase", desc: "Database, auth, and real-time backend" },
                { name: "Tailwind CSS", desc: "Utility-first styling" },
              ].map((t) => (
                <div key={t.name} className="rounded-xl border border-border/20 bg-background/40 px-4 py-3 transition-all duration-300 hover:border-primary/20 hover:shadow-md">
                  <div className="font-bold text-foreground text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">{t.desc}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard id="roadmap" icon={Crosshair} title="Roadmap & What's Next"
            iconColor="bg-gradient-to-br from-emerald-500/20 to-primary/20 border-emerald-500/20 shadow-emerald-500/10 text-emerald-400"
            accentColor="via-emerald-500/50">
            <p>TokenSight AI is actively evolving. Here is what is in the pipeline:</p>
            <div className="space-y-2">
              {[
                { label: "Solana Scan Contest", desc: "Compete by scanning tokens — best predictions earn rewards and recognition.", status: "Coming Soon" },
                { label: "Advanced Portfolio Analytics", desc: "Charts, allocation breakdown, and historical PnL tracking.", status: "Planned" },
                { label: "Telegram Bot V2", desc: "Inline scanning, portfolio summaries, and /scan commands.", status: "In Progress" },
                { label: "Mobile App", desc: "Native mobile experience for on-the-go intelligence.", status: "Planned" },
                { label: "Community Insights", desc: "Crowdsourced token ratings and shared watchlists.", status: "Exploring" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 rounded-xl border border-border/20 bg-background/40 px-4 py-3 transition-all duration-300 hover:border-primary/20">
                  <span className={cn("mt-0.5 shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest",
                    item.status === "Coming Soon" ? "bg-emerald-500/15 text-emerald-400"
                    : item.status === "In Progress" ? "bg-cyan-500/15 text-cyan-400"
                    : "bg-muted/20 text-muted-foreground/50"
                  )}>{item.status}</span>
                  <div>
                    <div className="font-bold text-foreground text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground/60 mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Back to FAQ callout */}
          <div className="rounded-2xl border border-border/30 bg-gradient-to-r from-primary/5 to-purple-500/5 p-6 text-center">
            <p className="text-sm text-muted-foreground/70 mb-3">Have more questions?</p>
            <Link href="/#faq" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-blue-500 px-6 py-3 text-sm font-bold text-primary-foreground transition-all duration-300 hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02]">
              Check the FAQ <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
