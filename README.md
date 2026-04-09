# TokenSight AI

**Scan smarter. Discover early. Trade with intelligence.**

TokenSight AI is a real-time on-chain intelligence platform for Solana tokens. It aggregates data from multiple sources — Helius, DexScreener, Birdeye, GeckoTerminal, Bags API — and transforms it into actionable insights using a transparent scoring engine, security analysis, and AI-generated summaries.

---

## What We Do

TokenSight AI analyzes on-chain and market signals to evaluate any Solana token and generate a **0–100 Intelligence Score** broken into four sub-scores.

We help traders and analysts:

- Discover early-stage tokens before they trend
- Evaluate token quality, momentum, and risk in seconds
- Verify security — mint authority, freeze authority, LP burn status
- Identify holder concentration and wallet-level breakdown
- Track portfolios, set price alerts, and swap directly from scan results

---

## Core Features

### Token Scanner

The heart of TokenSight AI. Paste any Solana token address and get a full intelligence report.

**Intelligence Score (0–100)** — Weighted average of four sub-scores:

| Sub-Score | What It Measures |
|-----------|-----------------|
| **Quality** | Liquidity depth, holder distribution, metadata, verified socials |
| **Momentum** | 24h volume, price velocity, buyer/seller ratio |
| **Confidence** | Cross-source data agreement and analysis reliability |
| **Risk Cap** | Risk ceiling — concentrated holdings, low liquidity, suspicious patterns |

**Scan results include:**

- **Token Logo & Name** — Logo, name, and symbol displayed at the top
- **Animated Score Ring** — Color-coded (red ≤30, yellow 31–59, blue 60–84, green 85+) with smooth fill animation
- **Security Badges** — Mint authority, Freeze authority, and LP burn profile (green = safe, red = risky)
- **Intelligence Signals** — AI-generated bullet points with severity-coded icons
- **Market Metrics** — 7 cards: Price, Liquidity, Volume (24h), Holders, Top 10 Concentration, Creator Tokens, Market Cap (K/M/B formatting)
- **Holder Breakdown** — Top 10 wallets with percentage bars, truncated addresses, and copy buttons
- **>1K Holder Warning** — Caution banner with Birdeye link when holder set exceeds API snapshot limits
- **Identity & Ownership** — Token Mint, Pool Address, Deployer, Owner, Created timestamp with copy-to-clipboard
- **Links & Social** — Website, Twitter, Telegram, Quote Token, Status (aggregated from Bags, DexScreener, Birdeye)
- **AI Summary** — Natural-language analysis with keyword highlighting (green = bullish, red = bearish)
- **Live Chart** — Embedded DexScreener price chart
- **Swap Widget** — Jupiter-powered swaps with MEV protection, without leaving the page
- **Quick Actions** — One-click add to portfolio, set alert, or view on explorer

**Layout:** 3-row grid with glowing widget borders. Fully responsive — stacks vertically on mobile.

### Risk Labels

| Label | Score |
|-------|-------|
| 🟢 STRONG OPPORTUNITY | 85+ |
| 🔵 GOOD ENTRY | 60–84 |
| 🟡 WATCH SIGNAL | 31–59 |
| 🔴 HIGH RISK | ≤30 |

---

### Scan History

View all your past scans with scores, tokens, and timestamps. Re-scan any token with one click.

---

### Portfolio Tracker

Track your Solana token holdings with live prices.

- **Live prices** via DexScreener
- **ROI calculation** — Real-time profit/loss per holding
- **Risk tagging** — LOW / MEDIUM / HIGH per position
- **Notes** — Personal thesis or notes per token
- **Summary cards** — Total holdings, invested value, live value, overall PnL

---

### Alerts Center

Set price alerts for any Solana token.

- **Price Drop** — Triggers below your threshold
- **Price Rise** — Triggers above your threshold
- **Volume Spike** — Triggers on unusual volume
- **Telegram notifications** — Alerts sent to your linked Telegram bot
- **Cron-based checking** — Automated background monitoring

---

### Leaderboard

Competitive analyst rankings.

- Ranked by total scans and accuracy
- League badges (Bronze → Silver → Gold → Diamond)
- Streak tracking — consecutive daily scan streaks
- Real-time updates

---

### Telegram Integration

Link your Telegram account for instant notifications via [@TokenSightai_bot](https://t.me/TokenSightai_bot).

- Alert triggers sent directly to Telegram
- Bot webhook integration
- Manage linking from Settings page

---

### Wallet Integration

Connect your Phantom wallet for Solana-native authentication.

- Wallet-based login (alongside Google / GitHub / credentials)
- Link/unlink wallet from profile settings

---

### Sight AI — Built-in AI Assistant

Sight AI is the conversational copilot that lives inside TokenSight AI as a floating chat bubble on every page.

- **Token lookup** — Ask about any Solana token by name or address for real-time price, liquidity, volume, market cap, and more
- **Full scan summaries** — Request a complete scan and get the Intelligence Score, risk label, and signals in chat
- **Alert management** — Create and manage price alerts directly from the chat
- **Profile updates** — Change your display name or avatar conversationally
- **Platform guidance** — Ask how any feature works and get answers grounded in the docs
- **Live data, no hallucination** — Every answer is backed by the same data pipeline as the scanner
- **Powered by OpenRouter (GPT-4o-mini)** — Fast, accurate, and context-aware responses

---

## Intelligence Accuracy

A weighted system that measures analyst skill:

- High-score scans → high impact on accuracy
- Low-score scans → minimal impact
- More high-quality discoveries = higher accuracy rating

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Auth** | Privy (Google, GitHub, X, Email OTP, Wallet) |
| **Database** | Supabase (PostgreSQL) |
| **AI Engine** | OpenRouter (GPT-4o-mini) — powers Sight AI assistant |
| **Blockchain Data** | Helius RPC (getAsset, getTokenAccounts) |
| **Market Data** | DexScreener (pairs, fdv, socials) |
| **Price Data** | Birdeye (price, overview, extensions) |
| **Pool Data** | GeckoTerminal (liquidity, volume, market cap fallback) |
| **Token Source** | Bags API (metadata, trending) |
| **Swaps** | Jupiter Aggregator |
| **Notifications** | Telegram Bot API |
| **Theming** | next-themes (dark / light mode) |

---

## Security & Integrity

- Server-side API handling with service-role Supabase client
- No API keys exposed to the client
- Row-Level Security (RLS) policies on all Supabase tables
- Anti-spam duplicate scan detection (24h cooldown)
- Production-safe logging
- Privy bearer-token validation on all protected routes

---

## Platform Scope

TokenSight AI scans **any Solana token** — not limited to a single ecosystem. Data is aggregated from Helius, DexScreener, Birdeye, GeckoTerminal, and Bags API for maximum coverage.

---

## Disclaimer

TokenSight AI provides AI-generated intelligence scores based on on-chain and market data. These insights are for informational purposes only and do not constitute financial advice.

Always conduct your own research (DYOR) before making any investment decisions. The crypto market is highly volatile, and users are solely responsible for their actions.

---
