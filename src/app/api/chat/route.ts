import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { ChatCard, ChatLink, ChatMessage, ChatResponse, ChatResult } from "@/types/chat"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const ADDRESS_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/
const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY?.trim() || ""
const BUILDER_REPLY = "Arindam the Solo builder created me. His website is https://mrarindam.vercel.app/."
const PRODUCT_CONTEXT = `
TokenSight AI is a Solana token intelligence platform.

Core features:
- Token Scanner: analyze any Solana token contract and return score, label, confidence, signals, security, holder structure, socials, and identity details.
- Portfolio Tracker: track saved holdings, quantity, entry price, risk level, and notes.
- Alerts Center: create token alerts for price rise, price drop, or score changes.
- Leaderboard: compare users by total scans, detection rate, and streak.
- Profile: view rank, streak, stats, best scan, wallet connection, and edit profile.
- Scan History: view recent token scans.
- Telegram Settings: connect Telegram for alerts.
- Docs: user-facing guide for platform features.

Chat behavior rules:
- You are TokenSight Copilot for this website only.
- Stay grounded in the provided website context and live tool results.
- If the user asks for token analysis and a contract address is present, use the scan result context.
- If the user asks to scan a token without a valid Solana contract address, ask them to paste the token address.
- If the user asks to manage alerts, portfolio entries, display name, or avatar, you may execute those actions.
- Never claim an action was completed unless it actually ran.
- You cannot link wallets, sign transactions, or move funds automatically because those require explicit wallet approval.
- Prefer normal product language instead of raw route strings in the prose of your answer.
- If the user asks who created you, who built you, or who the CEO is, answer that Arindam the Solo builder created you and his website is https://mrarindam.vercel.app/.
- Be concise, action-oriented, and avoid hype.
- Never invent market data, security findings, or platform capabilities.
`

type TokenMetric =
  | "price"
  | "liquidity"
  | "marketCap"
  | "holders"
  | "volume"
  | "exchanges"
  | "lp"
  | "website"
  | "twitter"
  | "telegram"

type ScanPayload = {
  score: number
  label: string
  confidence: string
  signals?: string[]
  explanation?: string
  contractName?: string
  meta?: {
    liquidity?: number
    volume?: number
    holders?: number
    price?: number | null
    marketCap?: number | null
    tokenSymbol?: string | null
    identity?: {
      tokenMint?: string | null
      poolAddress?: string | null
      deployer?: string | null
      owner?: string | null
      createdAt?: string | null
    }
    social?: {
      website?: string | null
      twitter?: string | null
      telegram?: string | null
      quoteToken?: string | null
      status?: string | null
    }
  }
}

type ScanContext = {
  tokenAddress: string
  ok: boolean
  payload: ScanPayload | null
}

type DexSearchResult = {
  tokenAddress: string
  tokenName: string
  tokenSymbol: string
  pairAddress: string | null
  dexes: string[]
  priceUsd: number | null
  liquidityUsd: number | null
  volume24h: number | null
}

type DexPair = {
  chainId?: string
  pairAddress?: string
  dexId?: string
  liquidity?: { usd?: number }
  volume?: { h24?: number }
  priceUsd?: string
  fdv?: number
  marketCap?: number
  baseToken?: { address?: string; name?: string; symbol?: string }
  quoteToken?: { address?: string; symbol?: string }
  info?: {
    imageUrl?: string
    socials?: { type: string; url: string }[]
    websites?: { url: string }[]
  }
}

type DexMarketSnapshot = {
  bestPair: DexPair | null
  dexes: string[]
  price: number | null
  liquidity: number | null
  volume24h: number | null
  marketCap: number | null
}

type TokenSnapshot = {
  tokenAddress: string
  tokenName: string
  tokenSymbol: string
  price: number | null
  liquidity: number | null
  volume24h: number | null
  marketCap: number | null
  holders: number | null
  pairAddress: string | null
  exchanges: string[]
  quoteToken: string | null
  website: string | null
  twitter: string | null
  telegram: string | null
}

type UserContext = Awaited<ReturnType<typeof getUserContext>>

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getLastUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content || ""
}

function isLikelyQuestion(input: string) {
  const trimmed = input.trim().toLowerCase()
  return trimmed.endsWith("?") || /^(did|do|does|is|are|what|where|when|why|how)\b/.test(trimmed)
}

function toPlainText(input: string) {
  return input.toLowerCase().replace(/[`*_#>]/g, " ")
}

function extractConversationAddress(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const match = messages[index].content.match(ADDRESS_REGEX)
    if (match?.[0]) return match[0]
  }
  return null
}

function extractTokenQuery(input: string) {
  const quoted = input.match(/["']([^"']{2,40})["']/)?.[1]?.trim()
  if (quoted) return quoted

  const afterKeyword = input.match(/(?:scan|search|find|buy|trade|analyze|analyse|review|research|token)\s+(?:for\s+)?([a-zA-Z0-9$\- ]{2,30})/i)?.[1]?.trim()
  if (afterKeyword && !/^(my|the|this|that|it)$/i.test(afterKeyword)) return afterKeyword

  const upperTicker = input.match(/\b[A-Z][A-Z0-9]{2,9}\b/g)?.find((value) => !["SOL", "LP", "AI"].includes(value))
  if (upperTicker) return upperTicker

  return null
}

function wantsFullScan(input: string) {
  return /(scan|full scan|full report|risk report|audit|rug|score|confidence|watch signal|strong opportunity|good entry|weak entry|signals?)/i.test(input)
}

function wantsMarketLinks(input: string) {
  return /(buy|trade|exchange|dex|chart|listed|where.*buy|swap|links?)/i.test(input)
}

function wantsProductHelp(input: string) {
  return /(what can|how do|help|docs|feature|platform|tokensight)/i.test(input)
}

function mentionsAlert(input: string) {
  return /alert|notify/i.test(input)
}

function mentionsPortfolio(input: string) {
  return /portfolio|holding/i.test(input)
}

function mentionsProfile(input: string) {
  return /profile|display name|username|avatar|photo|picture/i.test(input)
}

function isCreatorQuestion(input: string) {
  return /(who (created|built|made) you|who is your ceo|ceo name|ceo website|company website|creator website|builder website)/i.test(input)
}

function getRequestedTokenMetrics(input: string): TokenMetric[] {
  const lower = input.toLowerCase()
  const metrics = new Set<TokenMetric>()

  if (/price|exact price|current price/.test(lower)) metrics.add("price")
  if (/liquidity/.test(lower)) metrics.add("liquidity")
  if (/market ?cap|marketcap|fdv/.test(lower)) metrics.add("marketCap")
  if (/holders?|holder count/.test(lower)) metrics.add("holders")
  if (/volume|24h volume/.test(lower)) metrics.add("volume")
  if (/exchange|listed|where.*buy|where.*trade|dex/.test(lower)) metrics.add("exchanges")
  if (/\blp\b|liquidity pool|pool|pair/.test(lower)) metrics.add("lp")
  if (/website/.test(lower)) metrics.add("website")
  if (/twitter|x account|x link/.test(lower)) metrics.add("twitter")
  if (/telegram/.test(lower)) metrics.add("telegram")

  return Array.from(metrics)
}

function wantsSpecificTokenData(input: string) {
  return getRequestedTokenMetrics(input).length > 0
}

function isCreateIntent(input: string) {
  return /\b(create|set|add|save|make|record|update|change|rename|remove|delete|clear)\b/i.test(input) && !/^did\b/i.test(input.trim().toLowerCase())
}

function parseThreshold(input: string) {
  const percent = input.match(/([0-9]+(?:\.[0-9]+)?)\s*%/)
  if (percent?.[1]) return Number(percent[1])

  const threshold = input.match(/(?:below|above|at|threshold|price|score(?:\s*change)?(?:\s*by)?)\s*\$?([0-9]+(?:\.[0-9]+)?)/i)
  if (threshold?.[1]) return Number(threshold[1])

  return null
}

function parseQuantity(input: string) {
  const explicit = input.match(/(?:quantity|qty|amount|holding)\s*(?:of)?\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1]
  if (explicit) return Number(explicit)

  const addPattern = input.match(/add\s+([0-9]+(?:\.[0-9]+)?)\s+(?:tokens?|units?|coins?)/i)?.[1]
  if (addPattern) return Number(addPattern)

  return null
}

function parseEntryPrice(input: string) {
  const match = input.match(/(?:entry price|buy price|at|price)\s*\$?([0-9]+(?:\.[0-9]+)?)/i)?.[1]
  return match ? Number(match) : null
}

function parseDisplayName(input: string) {
  return input.match(/(?:change|update|edit|rename)\s+(?:my\s+)?(?:display\s+name|username|name)\s+(?:to|as)\s+["']?([^"'\n]{3,40})/i)?.[1]?.trim() || null
}

function parseAvatarUrl(input: string) {
  const url = input.match(/https?:\/\/\S+/i)?.[0] || null
  if (!url) return null

  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null
  } catch {
    return null
  }
}

function normalizeDexName(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A"
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  if (value < 1 && value > 0) return `$${value.toFixed(6)}`
  return `$${value.toFixed(2)}`
}

function formatExactValue(value: number | null | undefined, kind: TokenMetric) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A"

  if (kind === "price") {
    if (value >= 1) return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 12 })}`
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function pickString(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function pickNumber(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return null
}

async function fetchBirdeyeData(path: string, params: Record<string, string>, label: string) {
  if (!BIRDEYE_API_KEY) return null

  try {
    const query = new URLSearchParams(params)
    const endpoint = `https://public-api.birdeye.so${path}?${query.toString()}`
    const headerVariants: Record<string, string>[] = [
      { accept: "application/json", "x-chain": "solana", "X-API-KEY": BIRDEYE_API_KEY },
      { accept: "application/json", "x-chain": "solana", "x-api-key": BIRDEYE_API_KEY },
      { accept: "application/json", "x-chain": "solana", Authorization: `Bearer ${BIRDEYE_API_KEY}` },
    ]

    let res: Response | null = null
    for (const headers of headerVariants) {
      res = await fetch(endpoint, { method: "GET", cache: "no-store", headers })
      if (res.ok) break
      if (res.status !== 401) break
    }

    if (!res?.ok) return null

    const data = await res.json()
    return data?.data || null
  } catch (error) {
    console.warn(`[api/chat] Birdeye ${label} error:`, error)
    return null
  }
}

function normalizeBirdeyeMarketData(overview: Record<string, unknown> | null, price: Record<string, unknown> | null) {
  if (!overview && !price) return null

  const extensions = asRecord(overview?.extensions)

  return {
    name: pickString(overview, ["name", "tokenName"]),
    symbol: pickString(overview, ["symbol", "tokenSymbol"]),
    price: pickNumber(price, ["value", "price", "priceUsd", "priceValue"]) ?? pickNumber(overview, ["price", "priceUsd", "value"]),
    liquidity: pickNumber(price, ["liquidity", "liquidityUsd", "liquidityUSD"]) ?? pickNumber(overview, ["liquidity", "liquidityUsd", "liquidityUSD"]),
    volume24h: pickNumber(overview, ["v24hUSD", "volume24hUSD", "volume24h", "volume24hUsd", "volume24h_usd"]),
    holders: pickNumber(overview, ["holders", "holderCount", "uniqueHolders", "holder"]),
    marketCap: pickNumber(overview, ["marketCap", "market_cap", "fdv", "fullyDilutedValuation"]),
    website: pickString(extensions, ["website"]),
    twitter: pickString(extensions, ["twitter"]),
    telegram: pickString(extensions, ["telegram"]),
  }
}

async function searchDexToken(query: string): Promise<DexSearchResult | null> {
  const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`, {
    cache: "no-store",
  })

  if (!response.ok) return null

  const payload = (await response.json().catch(() => null)) as { pairs?: Array<Record<string, unknown>> } | null
  const pairs = Array.isArray(payload?.pairs) ? payload.pairs : []
  const solanaPairs = pairs.filter((pair) => pair.chainId === "solana")
  if (solanaPairs.length === 0) return null

  const rankedPairs = [...solanaPairs].sort((left, right) => {
    const leftLiquidity = Number((left.liquidity as { usd?: number } | undefined)?.usd || 0)
    const rightLiquidity = Number((right.liquidity as { usd?: number } | undefined)?.usd || 0)
    return rightLiquidity - leftLiquidity
  })

  const bestPair = rankedPairs[0]
  const dexes = Array.from(new Set(rankedPairs.map((pair) => String(pair.dexId || "Unknown"))))
  const baseToken = (bestPair.baseToken as { address?: string; name?: string; symbol?: string } | undefined) || {}

  return {
    tokenAddress: baseToken.address || "",
    tokenName: baseToken.name || query,
    tokenSymbol: baseToken.symbol || query.toUpperCase(),
    pairAddress: typeof bestPair.pairAddress === "string" ? bestPair.pairAddress : null,
    dexes,
    priceUsd: bestPair.priceUsd ? Number(bestPair.priceUsd) : null,
    liquidityUsd: Number((bestPair.liquidity as { usd?: number } | undefined)?.usd || 0),
    volume24h: Number((bestPair.volume as { h24?: number } | undefined)?.h24 || 0),
  }
}

async function fetchDexMarketSnapshot(address: string): Promise<DexMarketSnapshot | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
      cache: "no-store",
    })

    if (!response.ok) return null

    const payload = (await response.json().catch(() => null)) as { pairs?: DexPair[] } | null
    const pairs = Array.isArray(payload?.pairs) ? payload.pairs.filter((pair) => pair.chainId === "solana") : []
    if (pairs.length === 0) return null

    const bestPair = [...pairs].sort((left, right) => {
      const leftLiquidity = Number(left.liquidity?.usd || 0)
      const rightLiquidity = Number(right.liquidity?.usd || 0)
      return rightLiquidity - leftLiquidity
    })[0]

    return {
      bestPair,
      dexes: Array.from(new Set(pairs.map((pair) => String(pair.dexId || "Unknown")))),
      price: bestPair.priceUsd ? Number(bestPair.priceUsd) : null,
      liquidity: Number(bestPair.liquidity?.usd || 0),
      volume24h: Number(bestPair.volume?.h24 || 0),
      marketCap: Number(bestPair.marketCap || bestPair.fdv || 0),
    }
  } catch (error) {
    console.warn("[api/chat] Dex market snapshot error:", error)
    return null
  }
}

async function fetchTokenSnapshot(address: string, searchResult: DexSearchResult | null): Promise<TokenSnapshot | null> {
  const [dexSnapshot, birdeyePrice, birdeyeOverview] = await Promise.all([
    fetchDexMarketSnapshot(address),
    fetchBirdeyeData("/defi/price", { address, include_liquidity: "true", ui_amount_mode: "scaled" }, "price"),
    fetchBirdeyeData("/defi/token_overview", { address, ui_amount_mode: "scaled", frames: "24h" }, "overview"),
  ])

  const birdeye = normalizeBirdeyeMarketData(asRecord(birdeyeOverview), asRecord(birdeyePrice))
  const bestPair = dexSnapshot?.bestPair || null
  const socials = bestPair?.info?.socials || []

  return {
    tokenAddress: address,
    tokenName: birdeye?.name || bestPair?.baseToken?.name || searchResult?.tokenName || address,
    tokenSymbol: birdeye?.symbol || bestPair?.baseToken?.symbol || searchResult?.tokenSymbol || "???",
    price: birdeye?.price ?? dexSnapshot?.price ?? searchResult?.priceUsd ?? null,
    liquidity: birdeye?.liquidity ?? dexSnapshot?.liquidity ?? searchResult?.liquidityUsd ?? null,
    volume24h: birdeye?.volume24h ?? dexSnapshot?.volume24h ?? searchResult?.volume24h ?? null,
    marketCap: birdeye?.marketCap ?? dexSnapshot?.marketCap ?? null,
    holders: birdeye?.holders ?? null,
    pairAddress: bestPair?.pairAddress || searchResult?.pairAddress || null,
    exchanges: dexSnapshot?.dexes || searchResult?.dexes || [],
    quoteToken: bestPair?.quoteToken?.symbol || null,
    website: birdeye?.website || bestPair?.info?.websites?.[0]?.url || null,
    twitter: birdeye?.twitter || socials.find((social) => social.type === "twitter")?.url || null,
    telegram: birdeye?.telegram || socials.find((social) => social.type === "telegram")?.url || null,
  }
}

function sanitizeMessages(rawMessages: unknown): ChatMessage[] {
  if (!Array.isArray(rawMessages)) return []

  return rawMessages
    .filter((message): message is ChatMessage => {
      return (
        !!message &&
        typeof message === "object" &&
        (message as ChatMessage).role !== undefined &&
        ((message as ChatMessage).role === "user" || (message as ChatMessage).role === "assistant") &&
        typeof (message as ChatMessage).content === "string"
      )
    })
    .map((message) => ({
      id: typeof message.id === "string" ? message.id : makeId(message.role),
      role: message.role,
      content: message.content.trim().slice(0, 5000),
      links: Array.isArray(message.links) ? message.links : undefined,
      results: Array.isArray(message.results) ? message.results : undefined,
      cards: Array.isArray(message.cards) ? message.cards : undefined,
    }))
    .filter((message) => message.content.length > 0)
    .slice(-10)
}

function getRelevantInternalLinks(input: string): ChatLink[] {
  const lower = input.toLowerCase()
  const links: ChatLink[] = []

  if (lower.includes("portfolio") || lower.includes("holding")) links.push({ href: "/portfolio", label: "Portfolio" })
  if (lower.includes("alert")) links.push({ href: "/alerts", label: "Alerts Center" })
  if (lower.includes("telegram")) links.push({ href: "/settings/telegram", label: "Telegram Settings" })
  if (lower.includes("profile") || lower.includes("wallet")) links.push({ href: "/profile", label: "Profile" })
  if (lower.includes("leaderboard") || lower.includes("rank")) links.push({ href: "/leaderboard", label: "Leaderboard" })
  if (lower.includes("docs") || lower.includes("how do") || lower.includes("help")) links.push({ href: "/docs", label: "Docs" })

  return links.filter((link, index, array) => array.findIndex((entry) => entry.href === link.href) === index).slice(0, 3)
}

function getFollowUpSuggestions(input: string, usedScan = false): string[] {
  if (usedScan) {
    return [
      "Summarize this scan in plain English",
      "What are the main risks in this token?",
      "Should I add this token to my portfolio?",
      "What alert strategy should I use for this token?",
    ]
  }

  const lower = input.toLowerCase()

  if (lower.includes("portfolio")) {
    return [
      "Review my portfolio risk",
      "Which holding looks weakest?",
      "How should I use TokenSight for portfolio tracking?",
    ]
  }

  if (lower.includes("alert")) {
    return [
      "How do price alerts work?",
      "What alert types should I use?",
      "How do I connect Telegram alerts?",
    ]
  }

  return [
    "Scan a token for me",
    "What can TokenSight AI do?",
    "Review my portfolio risk",
    "How do I use alerts and Telegram?",
  ]
}

async function getUserContext(userId: string) {
  const [
    { data: user },
    { data: stats },
    { data: portfolio },
    { data: alerts },
    { data: scans },
  ] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("display_name, username, wallet, email, twitter_handle, telegram_id")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("user_stats")
      .select("total_scans, detection_rate, streak, weekly_avg")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("user_portfolios")
      .select("id, token_address, token_name, token_symbol, quantity, entry_price, risk_level, status, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("price_alerts")
      .select("id, token_address, token_name, alert_type, comparison_type, threshold, is_active, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("scans")
      .select("token_name, risk_level, score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  return {
    user: {
      displayName: user?.display_name || user?.username || null,
      email: user?.email || null,
      wallet: user?.wallet || null,
      twitterHandle: user?.twitter_handle || null,
      telegramConnected: Boolean(user?.telegram_id),
    },
    stats: stats || null,
    portfolio: portfolio || [],
    alerts: alerts || [],
    recentScans: scans || [],
  }
}

async function getScanContext(request: Request, tokenAddress: string | null): Promise<ScanContext | null> {
  if (!tokenAddress) return null

  const origin = new URL(request.url).origin
  const authHeader = request.headers.get("authorization")

  const response = await fetch(`${origin}/api/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    body: JSON.stringify({ address: tokenAddress }),
    cache: "no-store",
  })

  const payload = await response.json().catch(() => null)

  return {
    tokenAddress,
    ok: response.ok,
    payload,
  }
}

function buildExternalLinks(scanContext: ScanContext | null, snapshot: TokenSnapshot | null): ChatLink[] {
  const tokenAddress = scanContext?.tokenAddress || snapshot?.tokenAddress || null
  const poolAddress = scanContext?.payload?.meta?.identity?.poolAddress || snapshot?.pairAddress || null
  const social = scanContext?.payload?.meta?.social || snapshot

  if (!tokenAddress) return []

  const links: ChatLink[] = [
    { href: `https://dexscreener.com/solana/${poolAddress || tokenAddress}`, label: "DexScreener", external: true },
    { href: `https://birdeye.so/token/${tokenAddress}?chain=solana`, label: "Birdeye", external: true },
    { href: `https://jup.ag/swap/SOL-${tokenAddress}`, label: "Jupiter Swap", external: true },
  ]

  if (social?.website) links.push({ href: social.website, label: "Project Website", external: true })
  if (social?.twitter) links.push({ href: social.twitter, label: "X / Twitter", external: true })
  if (social?.telegram) links.push({ href: social.telegram, label: "Telegram", external: true })

  return links.filter((link, index, array) => array.findIndex((entry) => entry.href === link.href) === index).slice(0, 6)
}

function findMatchingAlert(userContext: UserContext, input: string, tokenAddress: string | null) {
  if (tokenAddress) {
    const byAddress = userContext.alerts.find((alert) => alert.token_address === tokenAddress)
    if (byAddress) return byAddress
  }

  const lower = input.toLowerCase()
  const byName = userContext.alerts.find((alert) => {
    const tokenName = String(alert.token_name || "").toLowerCase()
    return tokenName && lower.includes(tokenName)
  })
  if (byName) return byName

  if (/last|latest|recent/.test(lower)) return userContext.alerts[0] || null
  if (userContext.alerts.length === 1) return userContext.alerts[0]

  return null
}

function findMatchingPortfolio(userContext: UserContext, input: string, tokenAddress: string | null) {
  if (tokenAddress) {
    const byAddress = userContext.portfolio.find((entry) => entry.token_address === tokenAddress)
    if (byAddress) return byAddress
  }

  const lower = input.toLowerCase()
  const byName = userContext.portfolio.find((entry) => {
    const tokenName = String(entry.token_name || "").toLowerCase()
    const tokenSymbol = String(entry.token_symbol || "").toLowerCase()
    return (tokenName && lower.includes(tokenName)) || (tokenSymbol && lower.includes(tokenSymbol))
  })
  if (byName) return byName

  if (/last|latest|recent/.test(lower)) return userContext.portfolio[0] || null
  if (userContext.portfolio.length === 1) return userContext.portfolio[0]

  return null
}

async function executeAgentActions(params: {
  userId: string
  input: string
  userContext: UserContext
  tokenAddress: string | null
  scanContext: ScanContext | null
  searchResult: DexSearchResult | null
}): Promise<{ handled: boolean; results: ChatResult[] }> {
  const { userId, input, userContext, tokenAddress, scanContext, searchResult } = params
  const lower = toPlainText(input)
  const results: ChatResult[] = []
  let handled = false

  const tokenName = scanContext?.payload?.contractName || searchResult?.tokenName || null
  const tokenSymbol = scanContext?.payload?.meta?.tokenSymbol || searchResult?.tokenSymbol || null
  const riskLevel = scanContext?.payload?.label?.includes("STRONG")
    ? "LOW"
    : scanContext?.payload?.label?.includes("GOOD")
      ? "MEDIUM"
      : "HIGH"

  if (/did you .*alert/.test(lower)) {
    return {
      handled: true,
      results: [{
        title: "No alert has been created yet",
        description: "I only create alerts when you explicitly ask. If you want one, tell me the threshold and whether it should trigger above, below, or by percentage change.",
        tone: "info",
      }],
    }
  }

  if (mentionsAlert(lower) && isCreateIntent(lower) && /(create|set|add|make|alert me|notify me)/i.test(lower)) {
    handled = true
    const threshold = parseThreshold(input)

    if (!tokenAddress) {
      results.push({ title: "Token needed for alert", description: "Tell me which token to watch by pasting a Solana contract address or naming the token clearly.", tone: "info" })
    } else if (threshold === null || Number.isNaN(threshold) || threshold <= 0) {
      results.push({ title: "Threshold needed for alert", description: "Tell me the trigger value, for example 'alert me below 0.0012' or 'alert me if score changes by 15%'.", tone: "info" })
    } else {
      const alertType = /score/i.test(lower) ? "SCORE_CHANGE" : /above|rise|pump|break/i.test(lower) ? "PRICE_RISE" : "PRICE_DROP"
      const comparisonType = /score|%|percent/i.test(lower) ? "CHANGE_BY_PERCENT" : /above|rise|pump|break/i.test(lower) ? "ABOVE" : "BELOW"

      const { data, error } = await supabaseAdmin
        .from("price_alerts")
        .insert({
          user_id: userId,
          token_address: tokenAddress,
          token_name: tokenName,
          alert_type: alertType,
          comparison_type: comparisonType,
          threshold,
          is_active: true,
          trigger_count: 0,
        })
        .select("token_name, threshold, alert_type")
        .single()

      if (error) {
        results.push({ title: "Alert creation failed", description: error.message || "The alert could not be created.", tone: "warning" })
      } else {
        results.push({ title: "Alert created", description: `${data?.token_name || tokenAddress} will now be monitored with a ${data?.alert_type?.replaceAll("_", " ").toLowerCase()} trigger at ${threshold}.`, tone: "success" })
      }
    }
  }

  if (mentionsAlert(lower) && isCreateIntent(lower) && /(delete|remove|cancel|clear)/i.test(lower)) {
    handled = true
    const targetAlert = findMatchingAlert(userContext, input, tokenAddress)

    if (!targetAlert) {
      results.push({ title: "Alert not found", description: "I could not identify which alert to remove. Mention the token name or say 'delete my latest alert'.", tone: "info" })
    } else {
      const { error } = await supabaseAdmin.from("price_alerts").delete().eq("id", targetAlert.id).eq("user_id", userId)
      if (error) {
        results.push({ title: "Alert deletion failed", description: error.message || "The alert could not be removed.", tone: "warning" })
      } else {
        results.push({ title: "Alert deleted", description: `${targetAlert.token_name || targetAlert.token_address} has been removed from your alerts.`, tone: "success" })
      }
    }
  }

  if (mentionsPortfolio(lower) && isCreateIntent(lower) && /(add|save|record|put|create|update)/i.test(lower)) {
    handled = true
    const quantity = parseQuantity(input)
    const entryPrice = parseEntryPrice(input) ?? scanContext?.payload?.meta?.price ?? searchResult?.priceUsd ?? null

    if (!tokenAddress || !tokenName) {
      results.push({ title: "Token needed for portfolio", description: "Tell me which token to add by pasting the contract address or naming the token clearly.", tone: "info" })
    } else if (quantity === null || Number.isNaN(quantity) || quantity <= 0) {
      results.push({ title: "Quantity needed for portfolio", description: "Tell me how many tokens you want to record, for example 'add 2500 tokens to my portfolio'.", tone: "info" })
    } else if (entryPrice === null || Number.isNaN(entryPrice) || entryPrice <= 0) {
      results.push({ title: "Entry price needed for portfolio", description: "Tell me the entry price, or ask right after a scan so I can use the live token price.", tone: "info" })
    } else {
      const payload = {
        user_id: userId,
        token_address: tokenAddress,
        token_name: tokenName,
        token_symbol: tokenSymbol,
        quantity,
        entry_price: entryPrice,
        current_price: null,
        status: "HOLDING",
        risk_level: riskLevel,
        notes: scanContext?.payload ? `Saved by AI agent from ${scanContext.payload.label} scan.` : "Saved by AI agent.",
      }

      const { data: existing } = await supabaseAdmin
        .from("user_portfolios")
        .select("id")
        .eq("user_id", userId)
        .eq("token_address", tokenAddress)
        .eq("status", "HOLDING")
        .maybeSingle()

      const operation = existing
        ? await supabaseAdmin
            .from("user_portfolios")
            .update({ quantity, entry_price: entryPrice, risk_level: riskLevel, notes: payload.notes, updated_at: new Date().toISOString() })
            .eq("id", existing.id)
        : await supabaseAdmin.from("user_portfolios").insert(payload)

      if (operation.error) {
        results.push({ title: existing ? "Portfolio update failed" : "Portfolio add failed", description: operation.error.message || "The portfolio entry could not be saved.", tone: "warning" })
      } else {
        results.push({ title: existing ? "Portfolio updated" : "Portfolio entry created", description: `${tokenName} has been saved with quantity ${quantity} and entry price ${formatMoney(entryPrice)}.`, tone: "success" })
      }
    }
  }

  if (mentionsPortfolio(lower) && isCreateIntent(lower) && /(delete|remove|sell|clear)/i.test(lower)) {
    handled = true
    const targetEntry = findMatchingPortfolio(userContext, input, tokenAddress)

    if (!targetEntry) {
      results.push({ title: "Portfolio entry not found", description: "I could not tell which holding to remove. Mention the token name or say 'remove my latest holding'.", tone: "info" })
    } else {
      const { error } = await supabaseAdmin.from("user_portfolios").delete().eq("id", targetEntry.id).eq("user_id", userId)
      if (error) {
        results.push({ title: "Portfolio deletion failed", description: error.message || "The holding could not be removed.", tone: "warning" })
      } else {
        results.push({ title: "Portfolio entry removed", description: `${targetEntry.token_name} is no longer in your portfolio records.`, tone: "success" })
      }
    }
  }

  if (mentionsProfile(lower) && isCreateIntent(lower) && /(display name|username|name)/i.test(lower)) {
    handled = true
    const displayName = parseDisplayName(input)

    if (!displayName) {
      results.push({ title: "New display name needed", description: "Tell me the exact name to save, for example 'change my display name to Satoshi Hunter'.", tone: "info" })
    } else {
      const { error } = await supabaseAdmin.from("users").update({ display_name: displayName, username: displayName }).eq("id", userId)
      if (error) {
        results.push({ title: "Profile name update failed", description: error.message || "Your display name could not be updated.", tone: "warning" })
      } else {
        results.push({ title: "Display name updated", description: `Your profile name is now ${displayName}.`, tone: "success" })
      }
    }
  }

  if (mentionsProfile(lower) && isCreateIntent(lower) && /(avatar|photo|picture)/i.test(lower)) {
    handled = true
    const removeAvatar = /(remove|delete|clear)/i.test(lower)
    const avatarUrl = parseAvatarUrl(input)

    if (!removeAvatar && !avatarUrl) {
      results.push({ title: "Avatar URL needed", description: "Send a direct image URL if you want me to update your profile picture from chat.", tone: "info" })
    } else {
      const { error } = await supabaseAdmin.from("users").update({ avatar_url: removeAvatar ? null : avatarUrl }).eq("id", userId)
      if (error) {
        results.push({ title: "Avatar update failed", description: error.message || "Your profile picture could not be updated.", tone: "warning" })
      } else {
        results.push({ title: removeAvatar ? "Avatar removed" : "Avatar updated", description: removeAvatar ? "Your profile picture has been cleared." : "Your profile picture now points to the image link you provided.", tone: "success" })
      }
    }
  }

  return { handled, results }
}

function buildActionReply(results: ChatResult[]) {
  if (results.length === 1) return results[0].description
  return results.map((result) => `${result.title}: ${result.description}`).join("\n")
}

function buildMetricReply(snapshot: TokenSnapshot, requestedMetrics: TokenMetric[]) {
  const metricLines: string[] = []

  for (const metric of requestedMetrics) {
    if (metric === "price") metricLines.push(`Price: ${formatExactValue(snapshot.price, "price")}`)
    if (metric === "liquidity") metricLines.push(`Liquidity: ${formatExactValue(snapshot.liquidity, "liquidity")}`)
    if (metric === "marketCap") metricLines.push(`Market cap: ${formatExactValue(snapshot.marketCap, "marketCap")}`)
    if (metric === "holders") metricLines.push(`Holders: ${formatExactValue(snapshot.holders, "holders")}`)
    if (metric === "volume") metricLines.push(`24h volume: ${formatExactValue(snapshot.volume24h, "volume")}`)
    if (metric === "website") metricLines.push(`Website: ${snapshot.website || "N/A"}`)
    if (metric === "twitter") metricLines.push(`X / Twitter: ${snapshot.twitter || "N/A"}`)
    if (metric === "telegram") metricLines.push(`Telegram: ${snapshot.telegram || "N/A"}`)
    if (metric === "exchanges") metricLines.push(snapshot.exchanges.length ? `Exchanges: ${snapshot.exchanges.map(normalizeDexName).join(", ")}` : "Exchanges: No active Solana DEX listing found.")
    if (metric === "lp") {
      metricLines.push(`LP / pool: ${snapshot.pairAddress || "N/A"}`)
      metricLines.push(`Primary quote token: ${snapshot.quoteToken || "N/A"}`)
    }
  }

  return `Latest live data for ${snapshot.tokenName} (${snapshot.tokenSymbol}):\n\n${metricLines.join("\n")}`
}

function buildTokenVenueReply(snapshot: TokenSnapshot) {
  const exchanges = snapshot.exchanges.length ? snapshot.exchanges.map(normalizeDexName).join(", ") : "No active Solana DEX listing found yet"
  return [
    `${snapshot.tokenName} (${snapshot.tokenSymbol}) currently routes through: ${exchanges}.`,
    `Primary pool: ${snapshot.pairAddress || "N/A"}.`,
    `Liquidity: ${formatMoney(snapshot.liquidity)}. 24h volume: ${formatMoney(snapshot.volume24h)}.`,
  ].join("\n")
}

function buildScanCards(scanContext: ScanContext | null): ChatCard[] {
  const scan = scanContext?.ok ? scanContext.payload : null
  if (!scan) return []

  return [
    {
      type: "scan-summary",
      title: `${scan.contractName || "Token"} Scan Summary`,
      subtitle: scan.meta?.tokenSymbol || undefined,
      tone: scan.score >= 75 ? "success" : scan.score >= 60 ? "info" : "warning",
      badges: [scan.label, `${scan.confidence} confidence`],
      metrics: [
        { label: "Score", value: `${scan.score}/100` },
        { label: "Price", value: formatMoney(scan.meta?.price) },
        { label: "Liquidity", value: formatMoney(scan.meta?.liquidity) },
        { label: "Holders", value: scan.meta?.holders?.toLocaleString() || "N/A" },
        { label: "Market cap", value: formatMoney(scan.meta?.marketCap) },
      ],
    },
  ]
}

function buildSnapshotCards(snapshot: TokenSnapshot, requestedMetrics: TokenMetric[], includeMarketVenues: boolean): ChatCard[] {
  const metricSet = new Set(requestedMetrics)
  const cards: ChatCard[] = []

  const marketMetrics = [
    metricSet.has("price") || requestedMetrics.length === 0 ? { label: "Price", value: formatExactValue(snapshot.price, "price") } : null,
    metricSet.has("liquidity") || requestedMetrics.length === 0 ? { label: "Liquidity", value: formatExactValue(snapshot.liquidity, "liquidity") } : null,
    metricSet.has("marketCap") || requestedMetrics.length === 0 ? { label: "Market cap", value: formatExactValue(snapshot.marketCap, "marketCap") } : null,
    metricSet.has("holders") ? { label: "Holders", value: formatExactValue(snapshot.holders, "holders") } : null,
    metricSet.has("volume") ? { label: "24h volume", value: formatExactValue(snapshot.volume24h, "volume") } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>

  if (marketMetrics.length) {
    cards.push({
      type: "market-overview",
      title: `${snapshot.tokenName} Market Snapshot`,
      subtitle: snapshot.tokenSymbol,
      tone: "info",
      metrics: marketMetrics,
    })
  }

  if (metricSet.has("exchanges") || includeMarketVenues) {
    cards.push({
      type: "exchange-listings",
      title: "Exchange Listings",
      tone: "neutral",
      badges: snapshot.exchanges.map(normalizeDexName),
      metrics: [
        { label: "Primary pair", value: snapshot.pairAddress || "N/A" },
        { label: "Quote token", value: snapshot.quoteToken || "N/A" },
      ],
    })
  }

  if (metricSet.has("lp") || includeMarketVenues || metricSet.has("liquidity")) {
    cards.push({
      type: "lp-summary",
      title: "LP Summary",
      tone: "neutral",
      metrics: [
        { label: "Pool address", value: snapshot.pairAddress || "N/A" },
        { label: "Liquidity", value: formatExactValue(snapshot.liquidity, "liquidity") },
        { label: "24h volume", value: formatExactValue(snapshot.volume24h, "volume") },
      ],
    })
  }

  return cards.filter((card) => (card.metrics?.length || card.badges?.length))
}

function buildMarketReply(params: {
  scanContext: ScanContext | null
  snapshot: TokenSnapshot | null
  includeMarketLinks: boolean
}) {
  const { scanContext, snapshot, includeMarketLinks } = params
  const scan = scanContext?.ok ? scanContext.payload : null

  if (!scan && !snapshot) {
    return "I can help with TokenSight features, your saved data, and token scans. Paste a Solana contract address or name the token clearly if you want live token data."
  }

  if (!scan && snapshot) {
    return buildTokenVenueReply(snapshot)
  }

  const lines = [
    `I analyzed ${scan?.contractName || "this token"}. It is currently ${scan?.label.toLowerCase()} with a score of ${scan?.score}/100 and ${scan?.confidence.toLowerCase()} confidence.`,
    scan?.explanation || "",
    scan?.signals?.length ? `Main signals: ${scan.signals.slice(0, 4).join(" | ")}.` : "",
    scan?.meta ? `Price: ${formatMoney(scan.meta.price)}. Liquidity: ${formatMoney(scan.meta.liquidity)}. Volume: ${formatMoney(scan.meta.volume)}. Holders: ${scan.meta.holders ?? "N/A"}.` : "",
    includeMarketLinks ? "I added live trading, chart, and data links below so you can inspect liquidity and route options directly." : "",
  ]

  return lines.filter(Boolean).join("\n\n")
}

function buildSystemPrompt(params: {
  currentPath?: string | null
  userContext: UserContext
  scanContext: ScanContext | null
  tokenSnapshot: TokenSnapshot | null
  actionResults?: ChatResult[]
}) {
  const { currentPath, userContext, scanContext, tokenSnapshot, actionResults } = params

  return [
    PRODUCT_CONTEXT.trim(),
    `Current page: ${currentPath || "/"}`,
    `Signed-in user context: ${JSON.stringify(userContext)}`,
    `Token scan context: ${JSON.stringify(scanContext)}`,
    `Token snapshot context: ${JSON.stringify(tokenSnapshot)}`,
    `Executed action results: ${JSON.stringify(actionResults || [])}`,
  ].join("\n\n")
}

function buildFallbackReply(scanContext: ScanContext | null) {
  if (!scanContext?.ok || !scanContext.payload) {
    return "I can help with TokenSight features, your saved data, and token scans. If you want live token intelligence, paste a Solana contract address and I will analyze it."
  }

  const scan = scanContext.payload

  return [
    `${scan.contractName || "This token"} currently scores ${scan.score}/100 and is labeled ${scan.label} with ${scan.confidence} confidence.`,
    scan.explanation || "",
    scan.signals?.length ? `Key signals: ${scan.signals.slice(0, 4).join(" | ")}.` : "",
    scan.meta ? `Liquidity: ${scan.meta.liquidity ?? "N/A"}, Volume: ${scan.meta.volume ?? "N/A"}, Holders: ${scan.meta.holders ?? "N/A"}, Market cap: ${scan.meta.marketCap ?? "N/A"}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
}

export async function POST(request: Request) {
  const authUser = await getAuthUser(request)

  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const groqApiKey = process.env.GROQ_API_KEY
  const body = await request.json().catch(() => null)
  const messages = sanitizeMessages(body?.messages)
  const currentPath = typeof body?.currentPath === "string" ? body.currentPath : null
  const latestUserMessage = getLastUserMessage(messages)

  if (!latestUserMessage) {
    return NextResponse.json({ error: "A user message is required." }, { status: 400 })
  }

  try {
    const explicitAddress = latestUserMessage.match(ADDRESS_REGEX)?.[0] || extractConversationAddress(messages)
    const searchQuery = explicitAddress ? null : extractTokenQuery(latestUserMessage)
    const requestedMetrics = getRequestedTokenMetrics(latestUserMessage)
    const creatorQuestion = isCreatorQuestion(latestUserMessage)

    const [userContext, searchResult] = await Promise.all([
      getUserContext(authUser.id),
      searchQuery ? searchDexToken(searchQuery) : Promise.resolve(null),
    ])

    const activeTokenAddress = explicitAddress || searchResult?.tokenAddress || null
    const shouldDoFullScan = Boolean(activeTokenAddress) && wantsFullScan(latestUserMessage)
    const shouldDoTokenLookup = Boolean(activeTokenAddress) && !creatorQuestion && !shouldDoFullScan && (wantsSpecificTokenData(latestUserMessage) || wantsMarketLinks(latestUserMessage))

    const scanContext = shouldDoFullScan ? await getScanContext(request, activeTokenAddress) : null
    const tokenSnapshot = activeTokenAddress ? await fetchTokenSnapshot(activeTokenAddress, searchResult) : null

    const actionExecution = isCreateIntent(latestUserMessage) && (mentionsAlert(latestUserMessage) || mentionsPortfolio(latestUserMessage) || mentionsProfile(latestUserMessage))
      ? await executeAgentActions({
          userId: authUser.id,
          input: latestUserMessage,
          userContext,
          tokenAddress: activeTokenAddress,
          scanContext,
          searchResult,
        })
      : { handled: false, results: [] as ChatResult[] }

    const shouldShareExternalLinks = wantsMarketLinks(latestUserMessage) || /website|twitter|telegram/i.test(latestUserMessage)
    const shouldShareInternalLinks = !actionExecution.handled && wantsProductHelp(latestUserMessage)
    const externalLinks = shouldShareExternalLinks ? buildExternalLinks(scanContext, tokenSnapshot) : []
    const internalLinks = shouldShareInternalLinks ? getRelevantInternalLinks(latestUserMessage) : []
    const allLinks = [
      ...(creatorQuestion && /website/i.test(latestUserMessage)
        ? [{ href: "https://mrarindam.vercel.app/", label: "Arindam Website", external: true } as ChatLink]
        : []),
      ...externalLinks,
      ...internalLinks,
    ]
      .filter((link, index, array) => array.findIndex((entry) => entry.href === link.href) === index)
      .slice(0, 6)

    let reply = buildFallbackReply(scanContext)
    let cards: ChatCard[] = []

    if (creatorQuestion) {
      reply = BUILDER_REPLY
    } else if (actionExecution.handled) {
      reply = buildActionReply(actionExecution.results)
      if (tokenSnapshot && wantsMarketLinks(latestUserMessage)) {
        cards = buildSnapshotCards(tokenSnapshot, ["exchanges", "lp"], true)
      }
    } else if (shouldDoFullScan && scanContext?.ok && scanContext.payload) {
      reply = buildMarketReply({ scanContext, snapshot: tokenSnapshot, includeMarketLinks: externalLinks.length > 0 })
      cards = [
        ...buildScanCards(scanContext),
        ...(tokenSnapshot ? buildSnapshotCards(tokenSnapshot, ["exchanges", "lp"], true) : []),
      ]
    } else if (shouldDoTokenLookup && tokenSnapshot) {
      reply = requestedMetrics.length > 0 ? buildMetricReply(tokenSnapshot, requestedMetrics) : buildTokenVenueReply(tokenSnapshot)
      cards = buildSnapshotCards(tokenSnapshot, requestedMetrics, wantsMarketLinks(latestUserMessage))
    }

    if (!creatorQuestion && !actionExecution.handled && !shouldDoTokenLookup && groqApiKey && (!shouldDoFullScan || wantsProductHelp(latestUserMessage) || isLikelyQuestion(latestUserMessage))) {
      const systemPrompt = buildSystemPrompt({
        currentPath,
        userContext,
        scanContext,
        tokenSnapshot,
        actionResults: actionExecution.results,
      })

      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          temperature: 0.35,
          max_tokens: 900,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map((message) => ({ role: message.role, content: message.content })),
          ],
        }),
      })

      if (groqResponse.ok) {
        const groqPayload = await groqResponse.json()
        reply = groqPayload?.choices?.[0]?.message?.content?.trim() || reply
      }
    }

    const response: ChatResponse = {
      reply,
      usedScan: Boolean(scanContext?.ok && scanContext?.payload),
      tokenAddress: activeTokenAddress,
      links: allLinks,
      suggestions: getFollowUpSuggestions(latestUserMessage, Boolean(scanContext?.ok && scanContext?.payload)),
      results: actionExecution.results,
      cards,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[api/chat]", error)
    return NextResponse.json({ error: "Failed to generate AI response." }, { status: 500 })
  }
}
