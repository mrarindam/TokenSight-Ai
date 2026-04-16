import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { getAuthUser } from "@/lib/auth"
import { supabase } from "@/lib/supabaseClient"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { updateStreak } from "@/lib/streak-logic"
import { addLowRiskToken } from "@/lib/lowRiskStore"
import type { Token } from "@/types/token"

const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY?.trim() || ""
const BAGS_API_KEY = process.env.BAGS_API_KEY?.trim() || ""
const HELIUS_API_KEY = process.env.HELIUS_API_KEY?.trim() || ""
const JUPITER_API_KEY = process.env.JUPITER_API_KEY?.trim() || ""

type DexPair = {
  chainId?: string
  pairAddress?: string
  liquidity?: { usd?: number }
  volume?: { h24?: number }
  baseToken?: { name?: string; symbol?: string; address?: string }
  priceUsd?: string
  pairCreatedAt?: number
  fdv?: number
  marketCap?: number
  info?: {
    imageUrl?: string
    socials?: { type: string; url: string }[]
    websites?: { url: string }[]
  }
}

type GeckoTerminalPoolSnapshot = {
  dexes: string[]
  pairAddress: string | null
  poolCreatedAt: string | null
  price: number | null
  liquidity: number | null
  volume24h: number | null
  marketCap: number | null
}

type HolderSnapshot = {
  holdersCount: number | null
  topHolderPct: number | null
  whaleWarning: boolean
  holderBreakdown: Array<{ rank: number; pct: number; address: string }>
  isPartialSnapshot: boolean
}

type HeliusCreatorBehavior = {
  creatorAddress: string | null
  createdTokens: number | null
  source: "helius-authority" | "helius-creator" | null
}

type BagsCreatorProfile = {
  wallet: string | null
  provider: string | null
  providerUsername: string | null
  royaltyBps: number | null
  isCreator: boolean
}

type BagsClaimSnapshot = {
  totalClaimedSol: number | null
  claimersCount: number | null
}

type BagsLaunchToken = {
  tokenMint?: string | null
  symbol?: string | null
  name?: string | null
  image?: string | null
  website?: string | null
  twitter?: string | null
  description?: string | null
  status?: string | null
  liquidity?: number | null
  volume?: number | null
  volume24h?: number | null
  creatorTokens?: number | null
  creator_tokens?: number | null
  dbcPoolKey?: string | null
  pairCreatedAt?: string | number | null
  createdAt?: string | number | null
  created_at?: string | number | null
  launchTime?: string | number | null
  launchedAt?: string | number | null
  [key: string]: unknown
}

type HeliusFirstMintSnapshot = {
  firstMintTime: string | null
  firstMintTx: string | null
}

type JupiterStatsWindow = {
  priceChange: number | null
  buyVolume: number | null
  sellVolume: number | null
  traders: number | null
  buys: number | null
  sells: number | null
  organicBuyers: number | null
  netBuyers: number | null
}

type JupiterTokenSnapshot = {
  id: string
  name: string | null
  symbol: string | null
  icon: string | null
  decimals: number | null
  circSupply: number | null
  totalSupply: number | null
  tokenProgram: string | null
  twitter: string | null
  telegram: string | null
  website: string | null
  dev: string | null
  launchpad: string | null
  partnerConfig: string | null
  graduatedPool: string | null
  graduatedAt: string | null
  holderCount: number | null
  fdv: number | null
  mcap: number | null
  usdPrice: number | null
  liquidity: number | null
  createdAt: string | null
  updatedAt: string | null
  mintAuthority: string | null
  freezeAuthority: string | null
  organicScore: number | null
  organicScoreLabel: string | null
  isVerified: boolean | null
  tags: string[]
  firstPool: {
    id: string | null
    createdAt: string | null
  } | null
  audit: {
    isSus: boolean
    mintAuthorityDisabled: boolean | null
    freezeAuthorityDisabled: boolean | null
    topHoldersPercentage: number | null
    devBalancePercentage: number | null
    devMints: number | null
  } | null
  stats5m: JupiterStatsWindow | null
  stats1h: JupiterStatsWindow | null
  stats6h: JupiterStatsWindow | null
  stats24h: JupiterStatsWindow | null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { address: rawAddress, anonCount } = body

    // --- LEVEL 7: INPUT SANITIZATION & NORMALIZATION ---
    // Strip everything except alphanumeric, trim, and normalize case to prevent address mismatches
    const address = typeof rawAddress === 'string' ? rawAddress.trim().replace(/[^a-zA-Z0-9]/g, "") : ""

    const authUser = await getAuthUser(request)

    // --- STEP 1: AUTHENTICATION & LIMIT CHECK ---
    if (!authUser) {
      // If not logged in, enforce the 5-scan daily limit
      if (anonCount !== undefined && anonCount >= 5) {
        return NextResponse.json({
          error: "Identity verification required. You have reached your daily limit of 5 free scans. Please log in to continue.",
          code: "LIMIT_REACHED"
        }, { status: 401 })
      }
      if (process.env.NODE_ENV === "development") {
        console.log(`[api/scan] Anonymous daily scan attempt. Local count: ${anonCount || 0}`)
      }
    }

    if (!address || address.length < 10) {
      return NextResponse.json({ error: "Invalid token address format" }, { status: 400 })
    }

    // --- STEP 2: FETCH DATA ---

    // --- STEP 2: FETCH DATA (PARALLEL & ROBUST) ---
    if (process.env.NODE_ENV === "development") {
      console.log(`[SCAN_ENGINE] Starting full audit for: ${address}`)
    }

    const [
      birdeyePriceResult,
      birdeyeOverviewResult,
      bagsResult,
      dexResult,
      geckoResult,
      heliusAssetResult,
      jupiterResult,
      bagsLifetimeFeesResult,
      bagsCreatorsResult,
      bagsClaimsResult,
      heliusFirstMintResult,
    ] = await Promise.allSettled([
      fetchBirdeyeData(
        "/defi/price",
        { address, include_liquidity: "true", ui_amount_mode: "scaled" },
        BIRDEYE_API_KEY,
        "price"
      ),
      fetchBirdeyeData(
        "/defi/token_overview",
        { address, ui_amount_mode: "scaled", frames: "24h" },
        BIRDEYE_API_KEY,
        "token_overview"
      ),
      fetchBagsLaunchToken(address, BAGS_API_KEY),

      // 2. Fetch on-chain data from DexScreener (with RETRY)
      (async () => {
        const fetchDex = async (addr: string) => {
          const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`, {
            method: "GET",
            next: { revalidate: 15 }
          })
          if (res.status === 429) console.error("[SCAN_ENGINE] DexScreener Rate Limit (429) Triggered")
          return res.ok ? await res.json() : null
        }

        try {
          let rawDex = await fetchDex(address)

          // Retry Logic: If no pairs found, wait 500ms and try one more time
          if (!rawDex?.pairs || rawDex.pairs.length === 0) {
            if (process.env.NODE_ENV === "development") {
              console.log(`[SCAN_ENGINE] DexScreener empty for ${address}. Retrying...`)
            }
            await new Promise(resolve => setTimeout(resolve, 500))
            rawDex = await fetchDex(address)
          }

          if (process.env.NODE_ENV === "development") {
            console.log("DEX DATA:", rawDex)
            console.log(`[SCAN_ENGINE] DexScreener Lookup: pairs=${rawDex?.pairs?.length || 0}`)
          }
          return rawDex
        } catch (e) {
          console.warn("[SCAN_ENGINE] DexScreener API Error:", e)
        }
        return null
      })(),
      fetchGeckoTerminalPoolSnapshot(address),
      fetchHeliusAsset(address, HELIUS_API_KEY),
      fetchJupiterTokenSnapshot(address, JUPITER_API_KEY),
      fetchBagsLifetimeFees(address, BAGS_API_KEY),
      fetchBagsCreators(address, BAGS_API_KEY),
      fetchBagsClaimStats(address, BAGS_API_KEY),
      fetchHeliusFirstMintSnapshot(address, HELIUS_API_KEY),
    ])

    // --- STEP 2.5: EXTRACT DATA & FALLBACKS ---
    const rawBirdeyePrice = birdeyePriceResult.status === "fulfilled" ? birdeyePriceResult.value : null
    const rawBirdeyeOverview = birdeyeOverviewResult.status === "fulfilled" ? birdeyeOverviewResult.value : null
    const fallbackBagsToken = bagsResult.status === "fulfilled" ? bagsResult.value : null
    let rawDex = dexResult.status === "fulfilled" ? dexResult.value : null
    const rawGeckoPool = geckoResult.status === "fulfilled" ? geckoResult.value : null
    const rawHeliusAsset = heliusAssetResult.status === "fulfilled" ? heliusAssetResult.value : null
    const rawJupiterToken = jupiterResult.status === "fulfilled" ? jupiterResult.value : null
    const bagsLifetimeFeesSol = bagsLifetimeFeesResult.status === "fulfilled" ? bagsLifetimeFeesResult.value : null
    const bagsCreators = bagsCreatorsResult.status === "fulfilled" ? bagsCreatorsResult.value : []
    const bagsClaims = bagsClaimsResult.status === "fulfilled"
      ? bagsClaimsResult.value
      : { totalClaimedSol: null, claimersCount: null }
    const firstMintSnapshot = heliusFirstMintResult.status === "fulfilled"
      ? heliusFirstMintResult.value
      : { firstMintTime: null, firstMintTx: null }

    const birdeyeToken = normalizeBirdeyeToken(rawBirdeyeOverview, rawBirdeyePrice)
    const bagsToken = fallbackBagsToken
    const bagsRecord = asRecord(bagsToken)
    const bagsSymbol = pickString(bagsRecord, ["symbol"])
    const isBagsToken = Boolean(bagsToken)

    // --- FALLBACK: DexScreener Symbol Search ---
    if ((!rawDex?.pairs || rawDex.pairs.length === 0) && bagsSymbol) {
      console.log(`[SCAN_ENGINE] DexScreener address lookup failed for ${address}. Retrying with symbol: ${bagsSymbol}`)
      try {
        const fallbackRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${bagsSymbol}`, {
          method: "GET",
          next: { revalidate: 15 }
        })
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json()
          // Filter pairs to find one that matches our address or is likely the same token
          const matchingPair = fallbackData.pairs?.find((p: { baseToken?: { address?: string, symbol?: string } }) =>
            p.baseToken?.address?.toLowerCase() === address.toLowerCase() ||
            p.baseToken?.symbol?.toLowerCase() === bagsSymbol.toLowerCase()
          )
          if (matchingPair) {
            if (process.env.NODE_ENV === "development") {
              console.log(`[SCAN_ENGINE] DexScreener Symbol Search found matching pair: ${matchingPair.pairAddress}`)
            }
            rawDex = { pairs: [matchingPair] }
          }
        }
      } catch (e) {
        console.warn("[SCAN_ENGINE] DexScreener Fallback Error:", e)
      }
    }

    let dexLiquidity: number | null = null
    let dexVolume: number | null = null
    let dexTokenName: string | null = null
    let dexTokenSymbol: string | null = null
    let dexPrice: number | null = null
    let highestPair: DexPair | null = null
    let priceSource: "birdeye" | "dexscreener" | "geckoterminal" | "unknown" = "unknown"
    let liquiditySource: "birdeye" | "dexscreener" | "geckoterminal" | "unknown" = "unknown"
    let volumeSource: "birdeye" | "dexscreener" | "geckoterminal" | "unknown" = "unknown"

    if (rawDex?.pairs && Array.isArray(rawDex.pairs) && rawDex.pairs.length > 0) {
      // Prioritize Solana chain
      const solanaPairs = rawDex.pairs.filter((p: DexPair) => p.chainId === 'solana')
      const targetPairs = solanaPairs.length > 0 ? solanaPairs : rawDex.pairs

      highestPair = [...targetPairs].sort((a: DexPair, b: DexPair) => {
        const liqA = a.liquidity?.usd || 0
        const liqB = b.liquidity?.usd || 0
        return liqB - liqA
      })[0]

      dexLiquidity = roundMoney(targetPairs.reduce((sum: number, pair: DexPair) => sum + (pair.liquidity?.usd || 0), 0))
      dexVolume = roundMoney(targetPairs.reduce((sum: number, pair: DexPair) => sum + (pair.volume?.h24 || 0), 0))

      if (highestPair) {
        dexTokenName = highestPair.baseToken?.name || null
        dexTokenSymbol = highestPair.baseToken?.symbol || null
        dexPrice = highestPair.priceUsd ? parseFloat(highestPair.priceUsd) : null
      }

      if (dexLiquidity !== null) liquiditySource = "dexscreener"
      if (dexVolume !== null) volumeSource = "dexscreener"
      if (dexPrice !== null) priceSource = "dexscreener"

      if (process.env.NODE_ENV === "development" && highestPair) {
        console.log(`[SCAN_ENGINE] Dex Best Pair: ${highestPair.pairAddress} | Chain: ${highestPair.chainId} | Liq: ${dexLiquidity} | Vol: ${dexVolume} | Price: ${dexPrice}`)
      }
    }

    if (birdeyeToken) {
      if (birdeyeToken.liquidity !== null && birdeyeToken.liquidity !== undefined) {
        dexLiquidity = birdeyeToken.liquidity
        liquiditySource = "birdeye"
      }
      if (birdeyeToken.volume !== null && birdeyeToken.volume !== undefined) {
        dexVolume = birdeyeToken.volume
        volumeSource = "birdeye"
      }
      dexTokenName = birdeyeToken.name || dexTokenName
      dexTokenSymbol = birdeyeToken.symbol || dexTokenSymbol
      if (birdeyeToken.price !== null && birdeyeToken.price !== undefined) {
        dexPrice = birdeyeToken.price
        priceSource = "birdeye"
      }

      if (!highestPair) {
        highestPair = {
          pairAddress: "birdeye",
          chainId: "solana",
          liquidity: { usd: birdeyeToken.liquidity || undefined },
          volume: { h24: birdeyeToken.volume || undefined },
          baseToken: {
            name: birdeyeToken.name || undefined,
            symbol: birdeyeToken.symbol || undefined,
            address,
          },
          priceUsd: birdeyeToken.price !== null ? String(birdeyeToken.price) : undefined,
          pairCreatedAt: parseTimestamp(birdeyeToken.createdAt || null) || undefined,
          info: {
            imageUrl: birdeyeToken.image || undefined,
            socials: birdeyeToken.twitter ? [{ type: "twitter", url: birdeyeToken.twitter }] : [],
            websites: birdeyeToken.website ? [{ url: birdeyeToken.website }] : [],
          },
        }
      }
    }

    if (rawGeckoPool) {
      if (dexLiquidity === null && rawGeckoPool.liquidity !== null) {
        dexLiquidity = rawGeckoPool.liquidity
        liquiditySource = "geckoterminal"
      }
      if (dexVolume === null && rawGeckoPool.volume24h !== null) {
        dexVolume = rawGeckoPool.volume24h
        volumeSource = "geckoterminal"
      }
      if (dexPrice === null && rawGeckoPool.price !== null) {
        dexPrice = rawGeckoPool.price
        priceSource = "geckoterminal"
      }

      if (!highestPair && rawGeckoPool.pairAddress) {
        highestPair = {
          pairAddress: rawGeckoPool.pairAddress,
          chainId: "solana",
          liquidity: { usd: rawGeckoPool.liquidity || undefined },
          volume: { h24: rawGeckoPool.volume24h || undefined },
          baseToken: {
            address,
          },
          priceUsd: rawGeckoPool.price !== null ? String(rawGeckoPool.price) : undefined,
          pairCreatedAt: parseTimestamp(rawGeckoPool.poolCreatedAt) || undefined,
          marketCap: rawGeckoPool.marketCap || undefined,
        }
      }
    }

    const holderSnapshot = HELIUS_API_KEY
      ? await fetchHolderSnapshot(address, HELIUS_API_KEY)
      : { holdersCount: null, topHolderPct: null, whaleWarning: false, holderBreakdown: [], isPartialSnapshot: false }
    const creatorBehavior = HELIUS_API_KEY
      ? await fetchHeliusCreatorBehavior(rawHeliusAsset, HELIUS_API_KEY)
      : { creatorAddress: null, createdTokens: null, source: null }
    const holdersCount = rawJupiterToken?.holderCount ?? null
    const topHolderPct = holderSnapshot.topHolderPct ?? rawJupiterToken?.audit?.topHoldersPercentage ?? null
    const whaleWarning = holderSnapshot.topHolderPct !== null
      ? holderSnapshot.whaleWarning
      : topHolderPct !== null && topHolderPct > 50
    const holderBreakdown = holderSnapshot.topHolderPct !== null ? holderSnapshot.holderBreakdown : []
    const isPartialHolderData = holderSnapshot.isPartialSnapshot

    // --- EXTRACT SECURITY & IDENTITY FROM HELIUS ASSET ---
    const tokenInfo = rawHeliusAsset?.token_info as Record<string, unknown> | undefined
    const mintAuthority = rawJupiterToken?.mintAuthority ?? tokenInfo?.mint_authority as string | null ?? null
    const freezeAuthority = rawJupiterToken?.freezeAuthority ?? tokenInfo?.freeze_authority as string | null ?? null
    const mutableMetadata = typeof rawHeliusAsset?.mutable === "boolean" ? rawHeliusAsset.mutable : null
    const isBurnt = typeof rawHeliusAsset?.burnt === "boolean" ? rawHeliusAsset.burnt : null
    const mintAuthorityDisabled = rawJupiterToken?.audit?.mintAuthorityDisabled ?? !mintAuthority
    const freezeAuthorityDisabled = rawJupiterToken?.audit?.freezeAuthorityDisabled ?? !freezeAuthority
    const lpBurnStatus = (() => {
      // If no freeze authority, LP burn is considered strong
      if (freezeAuthorityDisabled) return "strong"
      return "unknown"
    })()

    // Identity & Ownership
    const primaryCreator = bagsCreators.find((creator) => creator.isCreator) ?? bagsCreators[0] ?? null
    const deployerAddress = creatorBehavior.creatorAddress
      ?? primaryCreator?.wallet
      ?? rawJupiterToken?.dev
      ?? (rawHeliusAsset?.authorities as { address: string }[] | undefined)?.[0]?.address
      ?? null
    const poolAddress = rawJupiterToken?.firstPool?.id ?? highestPair?.pairAddress ?? bagsToken?.dbcPoolKey ?? null
    const pairCreatedTimestamp = parseTimestamp(rawJupiterToken?.firstPool?.createdAt || null)
      ?? highestPair?.pairCreatedAt
      ?? parseTimestamp(bagsToken?.pairCreatedAt || bagsToken?.createdAt || bagsToken?.created_at || bagsToken?.launchTime || bagsToken?.launchedAt || null)
      ?? null

    // Links & Social
    const websiteUrl = bagsToken?.website || rawJupiterToken?.website || highestPair?.info?.websites?.[0]?.url || birdeyeToken?.website || null
    const twitterUrl = bagsToken?.twitter || rawJupiterToken?.twitter || highestPair?.info?.socials?.find((s: { type: string; url: string }) => s.type === "twitter")?.url || birdeyeToken?.twitter || null
    const telegramUrl = pickString(bagsRecord, ["telegram"]) || rawJupiterToken?.telegram || highestPair?.info?.socials?.find((s: { type: string; url: string }) => s.type === "telegram")?.url || null
    const quoteToken = highestPair?.baseToken?.address === address ? "Wrapped Sol (SOL)" : null
    const marketCap = rawJupiterToken?.mcap ?? highestPair?.fdv ?? highestPair?.marketCap ?? rawGeckoPool?.marketCap ?? null
    const tokenImage = bagsToken?.image || rawJupiterToken?.icon || highestPair?.info?.imageUrl || birdeyeToken?.image || null
    const decimals = rawJupiterToken?.decimals ?? pickNumber(tokenInfo || null, ["decimals"]) ?? null
    const supply = pickNumber(tokenInfo || null, ["supply"]) ?? rawJupiterToken?.totalSupply ?? null
    const circulatingSupply = rawJupiterToken?.circSupply ?? null
    const tokenProgram = pickString(tokenInfo || null, ["token_program"]) ?? rawJupiterToken?.tokenProgram ?? null
    const buyTaxPct = pickNumber(bagsRecord, ["buyTax", "buy_tax", "buyTaxPct", "buyFee", "buyFeePct", "buy_fee_pct"])
    const sellTaxPct = pickNumber(bagsRecord, ["sellTax", "sell_tax", "sellTaxPct", "sellFee", "sellFeePct", "sell_fee_pct"])
    const maxFeePct = pickNumber(bagsRecord, ["maxFee", "max_fee", "maxFeePct", "max_fee_pct"])
    const bundleWallets = pickNumber(bagsRecord, ["bundleWallets", "bundle_wallets"])
    const bundleHoldPct = pickNumber(bagsRecord, ["bundleHold", "bundle_hold", "bundleHoldPct", "bundle_hold_pct"])
    const phishingWallets = pickNumber(bagsRecord, ["phishingWallets", "phishing_wallets"])
    const phishingHoldPct = pickNumber(bagsRecord, ["phishingHold", "phishing_hold", "phishingHoldPct", "phishing_hold_pct"])
    const initialLiquidity = pickNumber(bagsRecord, ["initialLiquidity", "initial_liquidity", "initialLiquidityUsd", "initialLiquiditySol", "startLiquidity"])
    const curveProgressPct = pickNumber(bagsRecord, ["curveProgressPct", "curve_pct", "curvePct", "progressPct", "bondingCurvePct"])
    const bagsStatus = pickString(bagsRecord, ["status"])
    const launchType = formatLaunchType(
      pickString(bagsRecord, ["launchType", "launch_type", "poolType"])
      || rawJupiterToken?.launchpad
      || bagsStatus
      || null,
    )
    const createdOn = resolveLaunchOrigin(bagsRecord, rawJupiterToken?.launchpad ?? null)
    const strictList = rawJupiterToken?.tags.includes("strict") || false
    const suspicious = rawJupiterToken?.audit?.isSus || false
    const honeypotRisk = suspicious
      ? {
        level: "critical",
        summary: "Jupiter audit flagged this token as suspicious. Treat tradability and token behavior as high risk.",
      }
      : rawJupiterToken
        ? {
          level: "low",
          summary: "No direct suspicious-trading flag was returned by Jupiter audit data.",
        }
        : {
          level: "unknown",
          summary: "No honeypot-specific signal is available from the current API set.",
        }

    if (process.env.NODE_ENV === "development") {
      console.log("HOLDER DEBUG:", {
        address,
        helius_holders: holdersCount !== null ? holdersCount : "Data unavailable",
        topHolderPct,
      })
    }

    // --- STEP 3: PREPARE VARIABLES WITH FAILSAFES ---
    // Liquidity Failsafe: Birdeye/Dex > fallback metadata > null
    const liquidity = (dexLiquidity !== null && dexLiquidity !== undefined)
      ? dexLiquidity
      : (bagsToken?.liquidity || null)

    // Volume Failsafe: Dex > Bags > null (Discovery Phase)
    const volume = (dexVolume !== null && dexVolume !== undefined)
      ? dexVolume
      : (bagsToken?.volume || bagsToken?.volume24h || null)

    const holders = holdersCount || null
    const creatorTokenBase = typeof bagsToken?.creatorTokens === "number"
      ? bagsToken.creatorTokens
      : typeof bagsToken?.creator_tokens === "number"
        ? bagsToken.creator_tokens
        : null
    const creator_tokens = creatorBehavior.createdTokens
      ?? (creatorTokenBase !== null ? creatorTokenBase + 1 : null)
      ?? (creatorBehavior.creatorAddress ? 1 : null)
    const metadataCompleteness = [
      bagsToken?.image || highestPair?.info?.imageUrl,
      bagsToken?.website || highestPair?.info?.websites?.[0]?.url,
      bagsToken?.twitter || highestPair?.info?.socials?.find((s) => s.type === "twitter")?.url,
      rawJupiterToken?.website,
      rawJupiterToken?.twitter,
      rawJupiterToken?.telegram,
      bagsToken?.description,
    ].filter(Boolean).length
    const ageHours = extractAgeHours([
      rawJupiterToken?.firstPool?.createdAt,
      rawJupiterToken?.createdAt,
      highestPair?.pairCreatedAt,
      bagsToken?.pairCreatedAt,
      bagsToken?.createdAt,
      bagsToken?.created_at,
      bagsToken?.launchTime,
      bagsToken?.launchedAt,
    ])
    const status = bagsToken?.status
      ? classifyTokenStatus(bagsToken.status)
      : inferTokenStatus(liquidity, volume, holders, ageHours)
    const volumeLiquidityRatio = liquidity && volume && liquidity > 0 ? volume / liquidity : null

    if (process.env.NODE_ENV === "development") {
      console.log("[SCAN_ENGINE] Final Metrics Audit:", {
        address,
        liquidity,
        volume,
        holders,
        creator_tokens,
        status,
        metadataCompleteness,
        ageHours,
      })
    }

    // --- STEP 4: RISK-CAPPED INTELLIGENCE ENGINE ---
    const signals: string[] = []
    const liquidityScore = getLiquidityScore(liquidity)
    const holderScore = getHolderScore(holders)
    const whaleScore = getWhaleScore(topHolderPct)
    const creatorScore = getCreatorScore(creator_tokens)
    const metadataTrustScore = getMetadataTrustScore(metadataCompleteness)
    const ageScore = getAgeScore(ageHours, status)
    const volumeScore = getVolumeScore(volume)
    const efficiencyScore = getEfficiencyScore(volumeLiquidityRatio)
    const marketReadinessScore = getMarketReadinessScore(status, liquidity, volume, highestPair)

    const qualityScore = clampScore(weightedAverage([
      { score: liquidityScore, weight: 26 },
      { score: holderScore, weight: 16 },
      { score: whaleScore, weight: 18 },
      { score: creatorScore, weight: 16 },
      { score: metadataTrustScore, weight: 10 },
      { score: ageScore, weight: 14 },
    ]))

    const momentumScore = clampScore(weightedAverage([
      { score: volumeScore, weight: 40 },
      { score: efficiencyScore, weight: 35 },
      { score: marketReadinessScore, weight: 25 },
    ]))

    const dataCoverageScore = getDataCoverageScore([
      liquidity !== null,
      volume !== null,
      holders !== null,
      topHolderPct !== null,
      dexPrice !== null,
      metadataCompleteness > 0,
      ageHours !== null,
    ])
    const sourceAgreementScore = getSourceAgreementScore(
      bagsToken?.name,
      dexTokenName,
      bagsToken?.symbol,
      dexTokenSymbol,
    )
    const confidenceScore = clampScore(weightedAverage([
      { score: dataCoverageScore, weight: 55 },
      { score: sourceAgreementScore, weight: 25 },
      { score: highestPair ? 85 : 35, weight: 20 },
    ]))

    const { cap: riskCap, reasons: riskCapReasons } = getRiskCap({
      liquidity,
      topHolderPct,
      volumeLiquidityRatio,
      creatorTokens: creator_tokens,
      ageHours,
      metadataCompleteness,
      status,
      hasLiveMarket: !!highestPair,
    })

    if (qualityScore >= 75) {
      signals.push("Market structure looks strong across depth, distribution, and creator history")
    } else if (qualityScore < 45) {
      signals.push("Market structure is still weak across the main scan checks")
    }
    if (momentumScore >= 75) {
      signals.push("Trading activity looks efficient for the available liquidity")
    } else if (momentumScore < 45) {
      signals.push("Trading activity is still too weak or uneven")
    }
    if (metadataCompleteness >= 3) {
      signals.push("Project metadata is filled out across multiple sources")
    } else if (metadataCompleteness === 0) {
      signals.push("Project metadata is still very limited")
    }
    const ownershipSignal = getOwnershipSignal(holders, topHolderPct, holderBreakdown)
    if (ownershipSignal) {
      signals.push(ownershipSignal)
    }
    if (creator_tokens === 1) {
      signals.push("Creator wallet appears to be on its first tracked token launch")
    } else if (creator_tokens !== null && creator_tokens > 1) {
      signals.push(`Creator wallet has launched ${creator_tokens} tracked tokens`)
    } else if (creator_tokens === null) {
      signals.push("Creator launch history is not available on the current data plan")
    }
    if (ageHours !== null) {
      if (ageHours < 6) {
        signals.push(`Token is very new (${formatAge(ageHours)} old)`)
      } else if (ageHours >= 72) {
        signals.push(`Token has stayed live past the first volatility window (${formatAge(ageHours)} old)`)
      }
    }
    if (status === "pre-graduation" || status === "pre-launch") {
      signals.push("Token is still in an early discovery phase")
    }
    if (confidenceScore >= 80) {
      signals.push("Scan data agrees well across the available sources")
    } else if (confidenceScore < 50) {
      signals.push("Scan confidence is limited because some data is still missing")
    }
    if (rawJupiterToken?.isVerified) {
      signals.push("Jupiter marks this token as verified")
    } else if (rawJupiterToken && !rawJupiterToken.isVerified) {
      signals.push("Jupiter has not verified this token yet")
    }
    if (strictList) {
      signals.push("Token is included in Jupiter strict tagging")
    }
    if (suspicious) {
      signals.push("Jupiter audit flagged suspicious token behavior")
    }
    if (mutableMetadata === true) {
      signals.push("Token metadata remains mutable and can still be changed by the authority")
    }

    // Intelligence Score = average of the 4 core parameters
    const score = clampScore(Math.round((qualityScore + momentumScore + confidenceScore + riskCap) / 4))

    let confidence = "LOW"
    if (confidenceScore >= 75) confidence = "HIGH"
    else if (confidenceScore >= 50) confidence = "MEDIUM"

    let label = "WATCH SIGNAL"
    if (score >= 75 && confidence === "HIGH") label = "STRONG OPPORTUNITY"
    else if (score >= 60) label = "GOOD ENTRY"
    else if (score < 40) label = "WEAK ENTRY"

    const explanation = buildReadableSummary({
      label,
      confidence,
      score,
      qualityScore,
      momentumScore,
      confidenceScore,
      riskCap,
      riskCapReasons,
      liquidity,
      volume,
      holders,
      topHolderPct,
      holderBreakdown,
      creator_tokens,
      ageHours,
      status,
      metadataCompleteness,
      volumeLiquidityRatio,
      isPartialHolderData: isPartialHolderData,
      tokenAddress: address,
    })

    // --- OPPORTUNITY SIGNAL CAPTURE (High-Fidelity Metadata Filter) ---
    if (score >= 65 && liquidity !== null && liquidity > 1000 && volume !== null && volume > 1000) {
      const highestPair = rawDex?.pairs?.[0] || null
      const dexImg = highestPair?.info?.imageUrl || null
      const dexTwit = highestPair?.info?.socials?.find((s: { type: string, url: string }) => s.type === 'twitter')?.url || null
      const dexWeb = highestPair?.info?.websites?.[0]?.url || null

      // Metadata Qualification Layer (Min 2 traits required)
      let metadataScore = 0
      if (bagsToken?.image || dexImg) metadataScore++
      if (bagsToken?.website || dexWeb) metadataScore++
      if (bagsToken?.twitter || dexTwit) metadataScore++
      if (bagsToken?.description) metadataScore++

      if (metadataScore >= 2) {
        const liveToken: Token = {
          id: address,
          name: (bagsToken?.name && bagsToken.name !== "Unknown Token") ? bagsToken.name : (dexTokenName || "Unknown Token"),
          symbol: (bagsToken?.symbol && bagsToken.symbol !== "???") ? bagsToken.symbol : (dexTokenSymbol || "???"),
          description: bagsToken?.description || "High-precision market intelligence signal identified on-chain. Tactical entry conditions under evaluation based on liquidity and momentum nodes.",
          image: bagsToken?.image || dexImg || "",
          address: address,
          status: "graduated", // Intelligence-led graduation
          launchTime: "Established Opportunity",
          twitter: bagsToken?.twitter || dexTwit || null,
          website: bagsToken?.website || dexWeb || null,
          score: score,
        }
        addLowRiskToken(liveToken)
      } else {
        console.warn(`[api/scan] Token ${address} failed metadata qualification (Score: ${metadataScore}). Not promoted to High-Confidence Signals.`)
      }
    }

    // --- DATABASE PERSISTENCE (Backgrounded logically) ---
    const tokenName = bagsToken?.name || dexTokenName || bagsToken?.symbol || "Unknown Token"
    const tokenSymbol = bagsToken?.symbol || dexTokenSymbol || "???"

    const { error: scanPersistError } = await supabaseAdmin.from("scans").insert({
      user_id: authUser?.id || null, // Nullable for anonymous users
      token_name: tokenName,
      risk_level: label,
      score: score,
    })

    if (scanPersistError) {
      console.error("[api/scan] Failed to persist scan:", scanPersistError)
    } else {
      revalidatePath("/")
    }

    if (!scanPersistError && authUser?.id) {
      await updateStreak(authUser.id, score, tokenName)
      revalidatePath("/profile")
    }

    // --- CLEAN TOKEN-ONLY RESPONSE ---
    const scanResponse = {
      score: score,
      label: label,
      confidence: confidence,
      signals: signals,
      explanation: explanation,
      contractName: bagsToken?.name || dexTokenName || bagsToken?.symbol || "Unknown Token",
      meta: {
        liquidity: liquidity,
        volume: volume,
        holders: holders,
        creator_tokens: creator_tokens,
        status: status,
        price: dexPrice,
        topHolderPct: topHolderPct,
        whaleWarning: whaleWarning,
        topHolderLabel: getTopHolderLabel(holders, holderBreakdown.length),
        holderBreakdown: holderBreakdown,
        ageHours: ageHours,
        isPartialHolderData: isPartialHolderData,
        security: {
          mintAuthorityDisabled,
          freezeAuthorityDisabled,
          lpBurnProfile: lpBurnStatus,
        },
        verification: {
          isVerified: rawJupiterToken?.isVerified ?? null,
          strictList,
          organicScore: rawJupiterToken?.organicScore ?? null,
          organicScoreLabel: rawJupiterToken?.organicScoreLabel ?? null,
          suspicious,
          tags: rawJupiterToken?.tags ?? [],
          launchpad: rawJupiterToken?.launchpad ?? null,
          graduatedAt: rawJupiterToken?.graduatedAt ?? null,
          updatedAt: rawJupiterToken?.updatedAt ?? null,
        },
        behavior: {
          mutableMetadata,
          honeypotRisk,
          buyTaxPct,
          sellTaxPct,
          maxFeePct,
          bundleWallets,
          bundleHoldPct,
          phishingWallets,
          phishingHoldPct,
          devBalancePct: rawJupiterToken?.audit?.devBalancePercentage ?? null,
          devMints: rawJupiterToken?.audit?.devMints ?? null,
        },
        fees: {
          totalFeeSol: bagsLifetimeFeesSol,
          totalClaimedSol: bagsClaims.totalClaimedSol,
          creatorCount: bagsCreators.length,
          claimersCount: bagsClaims.claimersCount,
          createdOn,
        },
        launch: {
          launchType,
          launchpad: rawJupiterToken?.launchpad ?? null,
          initialLiquidity,
          curveProgressPct,
          firstMintTime: firstMintSnapshot.firstMintTime ?? rawJupiterToken?.createdAt ?? null,
          firstMintTx: firstMintSnapshot.firstMintTx,
          firstPoolTime: rawJupiterToken?.firstPool?.createdAt ?? (pairCreatedTimestamp ? new Date(pairCreatedTimestamp).toISOString() : null),
          firstPoolId: rawJupiterToken?.firstPool?.id ?? poolAddress,
          graduatedAt: rawJupiterToken?.graduatedAt ?? null,
          poolDexes: rawGeckoPool?.dexes ?? [],
          bagsPoolKey: pickString(bagsRecord, ["dbcPoolKey"]),
          bagsConfigKey: pickString(bagsRecord, ["dbcConfigKey"]),
        },
        tokenInfo: {
          decimals,
          supply,
          circulatingSupply,
          tokenProgram,
          mutableMetadata,
          burned: isBurnt,
          mintAuthority,
          freezeAuthority,
        },
        platforms: {
          bags: isBagsToken,
          jupiter: Boolean(rawJupiterToken),
          helius: Boolean(rawHeliusAsset),
        },
        tradingFlow: {
          m5: rawJupiterToken?.stats5m ?? null,
          h1: rawJupiterToken?.stats1h ?? null,
          h6: rawJupiterToken?.stats6h ?? null,
          h24: rawJupiterToken?.stats24h ?? null,
        },
        identity: {
          tokenMint: address,
          poolAddress: poolAddress,
          deployer: deployerAddress,
          owner: deployerAddress,
          createdAt: pairCreatedTimestamp ? new Date(pairCreatedTimestamp).toISOString() : null,
        },
        social: {
          website: websiteUrl,
          twitter: twitterUrl,
          telegram: telegramUrl,
          quoteToken: quoteToken,
          status: status,
        },
        tokenSymbol: bagsToken?.symbol || dexTokenSymbol || "???",
        marketCap: marketCap,
        tokenImage: tokenImage,
        scoring: {
          quality: qualityScore,
          momentum: momentumScore,
          confidenceScore: confidenceScore,
          riskCap: riskCap,
          dataCoverage: dataCoverageScore,
          metadataTrust: metadataTrustScore,
        },
        sources: {
          price: priceSource,
          liquidity: liquiditySource !== "unknown" ? liquiditySource : bagsToken?.liquidity ? "bags" : "unknown",
          volume: volumeSource !== "unknown" ? volumeSource : bagsToken?.volume || bagsToken?.volume24h ? "bags" : "unknown",
          holders: rawJupiterToken?.holderCount !== null && rawJupiterToken?.holderCount !== undefined ? "jupiter" : "unknown",
          whale: holderSnapshot.topHolderPct !== null ? "helius" : "unknown",
          creator: creatorBehavior.createdTokens !== null ? "helius" : creatorTokenBase !== null ? "bags" : "unknown",
          metadata: fallbackBagsToken ? "bags" : birdeyeToken ? "birdeye" : "unknown",
          verification: rawJupiterToken ? "jupiter" : "unknown",
          fees: bagsLifetimeFeesSol !== null ? "bags" : "unknown",
          launch: (rawJupiterToken?.launchpad || bagsToken) ? "jupiter+bags" : "unknown",
        },
      }
    }

    // --- TELEGRAM NOTIFICATION (fire & forget) ---
    if (authUser?.id) {
      supabase.from("users").select("telegram_id").eq("id", authUser.id).single()
        .then(({ data }) => {
          if (data?.telegram_id) {
            import("@/lib/telegram").then(({ sendTelegramMessage, formatScanMessage }) => {
              sendTelegramMessage({
                chat_id: data.telegram_id,
                text: formatScanMessage({
                  tokenName: scanResponse.contractName,
                  tokenSymbol: tokenSymbol,
                  address,
                  score,
                  label,
                  confidence,
                  signals,
                  liquidity,
                  volume,
                  holders,
                  price: dexPrice,
                  topHolderPct,
                  whaleWarning,
                }),
              })
            })
          }
        })
    }

    return NextResponse.json(scanResponse)

  } catch (error) {
    console.error("[api/scan] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function classifyTokenStatus(rawStatus: string): string {
  if (!rawStatus) return "unknown"
  const lower = rawStatus.toLowerCase()
  if (lower.includes("pre-graduation") || lower.includes("pre_grad")) return "pre-graduation"
  if (lower.includes("graduated") || lower.includes("post")) return "graduated"
  return "pre-graduation"
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function weightedAverage(entries: Array<{ score: number; weight: number }>): number {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)
  if (totalWeight === 0) return 0
  const weightedSum = entries.reduce((sum, entry) => sum + entry.score * entry.weight, 0)
  return weightedSum / totalWeight
}

function getLiquidityScore(liquidity: number | null): number {
  if (liquidity === null || liquidity <= 0) return 35
  if (liquidity < 100) return 5
  if (liquidity < 300) return 15
  if (liquidity < 1000) return 30
  if (liquidity < 5000) return 55
  if (liquidity < 20000) return 80
  return 95
}

function getHolderScore(holders: number | null): number {
  if (holders === null || holders <= 0) return 35
  if (holders < 10) return 10
  if (holders <= 50) return 25
  if (holders <= 200) return 60
  if (holders <= 1000) return 80
  return 92
}

function getWhaleScore(topHolderPct: number | null): number {
  if (topHolderPct === null) return 40
  if (topHolderPct > 85) return 5
  if (topHolderPct > 70) return 20
  if (topHolderPct > 55) return 40
  if (topHolderPct > 40) return 60
  if (topHolderPct > 30) return 75
  return 92
}

function getCreatorScore(creatorTokens: number | null): number {
  if (creatorTokens === null) return 40
  if (creatorTokens <= 1) return 95
  if (creatorTokens === 2) return 35
  if (creatorTokens === 3) return 18
  if (creatorTokens <= 5) return 8
  return 0
}

function getMetadataTrustScore(metadataCompleteness: number): number {
  if (metadataCompleteness <= 0) return 15
  if (metadataCompleteness === 1) return 35
  if (metadataCompleteness === 2) return 60
  if (metadataCompleteness === 3) return 82
  return 96
}

function getAgeScore(ageHours: number | null, status: string): number {
  if (ageHours === null) {
    return status === "graduated" ? 70 : 45
  }
  if (ageHours < 1) return 10
  if (ageHours < 6) return 25
  if (ageHours < 24) return 45
  if (ageHours < 72) return 65
  if (ageHours < 168) return 82
  return 95
}

function getVolumeScore(volume: number | null): number {
  if (volume === null || volume <= 0) return 25
  if (volume < 250) return 10
  if (volume < 1000) return 30
  if (volume < 5000) return 55
  if (volume < 20000) return 78
  return 92
}

function getEfficiencyScore(ratio: number | null): number {
  if (ratio === null) return 35
  if (ratio < 0.05) return 10
  if (ratio < 0.2) return 30
  if (ratio < 0.5) return 60
  if (ratio <= 2) return 92
  if (ratio <= 3) return 70
  if (ratio <= 5) return 35
  return 10
}

function getMarketReadinessScore(
  status: string,
  liquidity: number | null,
  volume: number | null,
  highestPair: DexPair | null,
): number {
  if (!highestPair) return 20

  let score = status === "graduated" ? 82 : status === "pre-graduation" ? 58 : 50
  if (liquidity !== null && liquidity >= 1000) score += 8
  if (volume !== null && volume >= 1000) score += 10
  return clampScore(score)
}

function getDataCoverageScore(dataPoints: boolean[]): number {
  if (dataPoints.length === 0) return 0
  const present = dataPoints.filter(Boolean).length
  return clampScore((present / dataPoints.length) * 100)
}

function getSourceAgreementScore(
  bagsName: string | null | undefined,
  dexName: string | null,
  bagsSymbol: string | null | undefined,
  dexSymbol: string | null,
): number {
  let score = 35
  if (bagsName || bagsSymbol) score += 15
  if (dexName || dexSymbol) score += 15

  if (normalizeValue(bagsName) && normalizeValue(dexName)) {
    score += normalizeValue(bagsName) === normalizeValue(dexName) ? 20 : -10
  }
  if (normalizeValue(bagsSymbol) && normalizeValue(dexSymbol)) {
    score += normalizeValue(bagsSymbol) === normalizeValue(dexSymbol) ? 25 : -15
  }

  return clampScore(score)
}

function normalizeValue(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase()
}

function getRiskCap(input: {
  liquidity: number | null
  topHolderPct: number | null
  volumeLiquidityRatio: number | null
  creatorTokens: number | null
  ageHours: number | null
  metadataCompleteness: number
  status: string
  hasLiveMarket: boolean
}) {
  let cap = 100
  const reasons: string[] = []

  if (!input.hasLiveMarket && input.status !== "graduated") {
    cap = Math.min(cap, 55)
    reasons.push("live market depth is not established yet")
  }
  if (input.liquidity !== null) {
    if (input.liquidity < 150) {
      cap = Math.min(cap, 35)
      reasons.push("liquidity is too thin")
    } else if (input.liquidity < 500) {
      cap = Math.min(cap, 50)
      reasons.push("liquidity is still fragile")
    } else if (input.liquidity < 1200) {
      cap = Math.min(cap, 65)
      reasons.push("liquidity is still maturing")
    }
  }
  if (input.topHolderPct !== null) {
    if (input.topHolderPct > 85) {
      cap = Math.min(cap, 35)
      reasons.push("wallet concentration is extreme")
    } else if (input.topHolderPct > 70) {
      cap = Math.min(cap, 45)
      reasons.push("wallet concentration is elevated")
    } else if (input.topHolderPct > 55) {
      cap = Math.min(cap, 60)
      reasons.push("holder concentration stays above healthy range")
    }
  }
  if (input.volumeLiquidityRatio !== null) {
    if (input.volumeLiquidityRatio > 5) {
      cap = Math.min(cap, 45)
      reasons.push("volume is outsized versus liquidity")
    } else if (input.volumeLiquidityRatio > 3) {
      cap = Math.min(cap, 60)
      reasons.push("volume efficiency looks overheated")
    }
  }
  if (input.creatorTokens !== null && input.creatorTokens > 10) {
    cap = Math.min(cap, 55)
    reasons.push("creator has a heavy relaunch history")
  } else if (input.creatorTokens !== null && input.creatorTokens > 5) {
    cap = Math.min(cap, 70)
    reasons.push("creator has repeated launch history")
  }
  if (input.ageHours !== null && input.ageHours < 2 && (input.liquidity || 0) < 2000) {
    cap = Math.min(cap, 65)
    reasons.push("pair is extremely new with shallow depth")
  }
  if (input.metadataCompleteness === 0 && input.status !== "graduated") {
    cap = Math.min(cap, 70)
    reasons.push("trust surface is not established")
  }

  return { cap, reasons }
}

function extractAgeHours(candidates: unknown[]): number | null {
  const now = Date.now()

  for (const candidate of candidates) {
    const timestamp = parseTimestamp(candidate)
    if (timestamp === null) continue

    const diff = now - timestamp
    if (diff < 0) continue

    return Math.round((diff / 3600000) * 10) / 10
  }

  return null
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1e12) return value
    if (value > 1e9) return value * 1000
  }

  if (typeof value === "string") {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric > 0) {
      return parseTimestamp(numeric)
    }

    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }

  return null
}

function formatAge(ageHours: number): string {
  if (ageHours < 24) return `${Math.max(1, Math.round(ageHours))}h`
  if (ageHours < 24 * 7) return `${Math.round(ageHours / 24)}d`
  return `${Math.round(ageHours / (24 * 7))}w`
}

function getTopHolderLabel(holders: number | null, breakdownCount: number): string {
  if (holders !== null && holders <= 1) return "1 Wallet"
  if (holders !== null && holders <= 10) return `Top ${holders} Wallets`
  if (breakdownCount > 0 && breakdownCount < 10) return `Top ${breakdownCount} Wallets`
  return "Top 10 Wallets"
}

function getOwnershipSignal(
  holders: number | null,
  topHolderPct: number | null,
  holderBreakdown: Array<{ rank: number; pct: number }>,
): string | null {
  if (topHolderPct === null) return null

  if (holders !== null && holders <= 1) {
    return `1 wallet currently holds ${topHolderPct}% of supply`
  }
  if (holders !== null && holders <= 10) {
    return `${holders} wallets currently hold ${topHolderPct}% of supply`
  }
  if (topHolderPct > 70) {
    return `Top 10 wallets hold ${topHolderPct}% of supply`
  }
  if (topHolderPct <= 30) {
    return `Top 10 wallets hold only ${topHolderPct}% of supply`
  }

  if (holderBreakdown.length > 0) {
    return `Top 10 wallets hold ${topHolderPct}% of supply`
  }

  return null
}

function buildReadableSummary(input: {
  label: string
  confidence: string
  score: number
  qualityScore: number
  momentumScore: number
  confidenceScore: number
  riskCap: number
  riskCapReasons: string[]
  liquidity: number | null
  volume: number | null
  holders: number | null
  topHolderPct: number | null
  holderBreakdown: Array<{ rank: number; pct: number }>
  creator_tokens: number | null
  ageHours: number | null
  status: string
  metadataCompleteness: number
  volumeLiquidityRatio: number | null
  isPartialHolderData?: boolean
  tokenAddress?: string
}) {
  const lines: string[] = []

  // Verdict
  const verdict = input.label === "STRONG OPPORTUNITY"
    ? "This setup looks strong right now."
    : input.label === "GOOD ENTRY"
      ? "This setup looks constructive."
      : input.label === "WEAK ENTRY"
        ? "This setup still looks weak."
        : "This setup is still a watchlist candidate."
  lines.push(verdict)

  // Quality explanation
  const qualityParts: string[] = []
  if (input.liquidity !== null && input.liquidity > 0) {
    qualityParts.push(input.liquidity >= 5000 ? `liquidity is strong at $${input.liquidity.toLocaleString()}` : input.liquidity >= 1000 ? `liquidity is moderate at $${input.liquidity.toLocaleString()}` : `liquidity is thin at $${input.liquidity.toLocaleString()}`)
  } else {
    qualityParts.push("liquidity data is unavailable")
  }
  if (input.holders !== null && input.holders > 0) {
    qualityParts.push(input.holders >= 200 ? `holder base is healthy (${input.holders.toLocaleString()})` : input.holders >= 50 ? `holder base is growing (${input.holders.toLocaleString()})` : `holder count is low (${input.holders})`)
  }
  if (input.topHolderPct !== null) {
    qualityParts.push(input.topHolderPct <= 40 ? `wallet distribution is well spread (top 10 hold ${input.topHolderPct}%)` : input.topHolderPct <= 55 ? `wallet concentration is moderate (top 10 hold ${input.topHolderPct}%)` : `wallet concentration is high (top 10 hold ${input.topHolderPct}%)`)
  }
  if (input.creator_tokens !== null) {
    qualityParts.push(input.creator_tokens <= 1 ? "creator is on their first token" : input.creator_tokens <= 5 ? `creator has launched ${input.creator_tokens} tokens` : `creator has a heavy relaunch history (${input.creator_tokens} tokens)`)
  }
  lines.push(`Quality ${input.qualityScore}/100 — ${qualityParts.join(", ")}.`)

  // Momentum explanation
  const momParts: string[] = []
  if (input.volume !== null && input.volume > 0) {
    momParts.push(input.volume >= 5000 ? `24h volume is strong at $${input.volume.toLocaleString()}` : input.volume >= 1000 ? `24h volume is moderate at $${input.volume.toLocaleString()}` : `24h volume is light at $${input.volume.toLocaleString()}`)
  } else {
    momParts.push("volume data is unavailable")
  }
  if (input.volumeLiquidityRatio !== null) {
    momParts.push(input.volumeLiquidityRatio >= 0.5 && input.volumeLiquidityRatio <= 2 ? "volume-to-liquidity ratio is healthy" : input.volumeLiquidityRatio > 3 ? "volume-to-liquidity ratio looks overheated" : "volume-to-liquidity ratio is low")
  }
  if (input.status === "graduated") {
    momParts.push("token has graduated to open market")
  } else if (input.status === "pre-graduation") {
    momParts.push("token is still in pre-graduation phase")
  }
  lines.push(`Momentum ${input.momentumScore}/100 — ${momParts.join(", ")}.`)

  // Confidence explanation
  const confParts: string[] = []
  confParts.push(`data confidence is ${input.confidence.toLowerCase()}`)
  if (input.metadataCompleteness >= 3) {
    confParts.push("project metadata is well populated")
  } else if (input.metadataCompleteness === 0) {
    confParts.push("project metadata is very limited")
  } else {
    confParts.push("project metadata is partially filled")
  }
  lines.push(`Confidence ${input.confidenceScore}/100 — ${confParts.join(", ")}.`)

  // Risk Cap explanation
  if (input.riskCapReasons.length > 0) {
    lines.push(`Risk Cap ${input.riskCap}/100 — ${input.riskCapReasons.join(", ")}.`)
  } else {
    lines.push(`Risk Cap ${input.riskCap}/100 — no major risk flags detected.`)
  }

  // Age context
  if (input.ageHours !== null) {
    lines.push(input.ageHours < 6 ? `Token is very new (${formatAge(input.ageHours)} old).` : `Token has been live for ${formatAge(input.ageHours)}.`)
  }

  // Intelligence formula
  // Partial holder data warning
  if (input.isPartialHolderData && input.tokenAddress) {
    lines.push(`Note: Holder data is approximate (>1,000 holders). Helius API cannot fully snapshot large holder sets. For accurate holder data, visit https://birdeye.so/token/${input.tokenAddress}?chain=solana`)
  }

  lines.push(`Intelligence Score ${input.score}/100 = avg of Quality (${input.qualityScore}) + Momentum (${input.momentumScore}) + Confidence (${input.confidenceScore}) + Risk Cap (${input.riskCap}). DYOR.`)

  return lines.join("\n")
}

function roundPctFromBigInt(numerator: bigint, denominator: bigint): number {
  if (denominator <= BigInt(0)) return 0
  const scaled = (numerator * BigInt(10000) + denominator / BigInt(2)) / denominator
  return Number(scaled) / 100
}

async function fetchHolderSnapshot(address: string, heliusApiKey: string): Promise<HolderSnapshot> {
  if (!heliusApiKey) {
    return {
      holdersCount: null,
      topHolderPct: null,
      whaleWarning: false,
      holderBreakdown: [],
      isPartialSnapshot: false,
    }
  }

  try {
    const [largestAccountsRes, tokenSupplyRes] = await Promise.all([
      fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "largest-holders",
          method: "getTokenLargestAccounts",
          params: [address],
        }),
      }),
      fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "token-supply",
          method: "getTokenSupply",
          params: [address],
        }),
      }),
    ])

    if (!largestAccountsRes.ok || !tokenSupplyRes.ok) {
      return {
        holdersCount: null,
        topHolderPct: null,
        whaleWarning: false,
        holderBreakdown: [],
        isPartialSnapshot: false,
      }
    }

    const largestAccountsPayload = await largestAccountsRes.json().catch(() => null) as Record<string, unknown> | null
    const tokenSupplyPayload = await tokenSupplyRes.json().catch(() => null) as Record<string, unknown> | null

    const largestAccountsResult = asRecord(largestAccountsPayload?.result)
    const largestAccounts = Array.isArray(largestAccountsResult?.value) ? largestAccountsResult.value : []

    const supplyValue = asRecord(asRecord(tokenSupplyPayload?.result)?.value)
    const totalSupplyRaw = (() => {
      const amountString = pickString(supplyValue, ["amount"])
      if (!amountString) return BigInt(0)

      try {
        return BigInt(amountString)
      } catch {
        return BigInt(0)
      }
    })()

    if (largestAccounts.length === 0 || totalSupplyRaw <= BigInt(0)) {
      return {
        holdersCount: null,
        topHolderPct: null,
        whaleWarning: false,
        holderBreakdown: [],
        isPartialSnapshot: false,
      }
    }

    const tokenAccounts = largestAccounts
      .map((entry) => {
        const record = asRecord(entry)
        const tokenAccount = pickString(record, ["address"])
        const amountString = pickString(record, ["amount"])

        if (!tokenAccount || !amountString) return null

        try {
          return {
            tokenAccount,
            amount: BigInt(amountString),
          }
        } catch {
          return null
        }
      })
      .filter((entry): entry is { tokenAccount: string; amount: bigint } => Boolean(entry))

    if (tokenAccounts.length === 0) {
      return {
        holdersCount: null,
        topHolderPct: null,
        whaleWarning: false,
        holderBreakdown: [],
        isPartialSnapshot: false,
      }
    }

    const ownersRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "largest-holder-owners",
        method: "getMultipleAccounts",
        params: [
          tokenAccounts.map((entry) => entry.tokenAccount),
          { encoding: "jsonParsed" },
        ],
      }),
    })

    const ownersPayload = ownersRes.ok
      ? await ownersRes.json().catch(() => null) as Record<string, unknown> | null
      : null
    const ownerValues = Array.isArray(asRecord(ownersPayload?.result)?.value)
      ? (asRecord(ownersPayload?.result)?.value as unknown[])
      : []

    const ownerBalances = new Map<string, bigint>()

    tokenAccounts.forEach((entry, index) => {
      const ownerRecord = asRecord(ownerValues[index])
      const ownerAddress =
        pickNestedString(ownerRecord, [["data", "parsed", "info", "owner"]]) ||
        entry.tokenAccount

      ownerBalances.set(ownerAddress, (ownerBalances.get(ownerAddress) || BigInt(0)) + entry.amount)
    })

    const sortedEntries = Array.from(ownerBalances.entries()).sort((a, b) => {
      if (a[1] === b[1]) return 0
      return a[1] > b[1] ? -1 : 1
    })

    const holderBreakdown = sortedEntries.slice(0, 10).map(([addr, amount], index) => ({
      rank: index + 1,
      pct: roundPctFromBigInt(amount, totalSupplyRaw),
      address: addr,
    }))

    const topTenBalance = sortedEntries
      .slice(0, 10)
      .reduce((sum, [, amount]) => sum + amount, BigInt(0))
    const topHolderPct = roundPctFromBigInt(topTenBalance, totalSupplyRaw)

    return {
      holdersCount: null,
      topHolderPct,
      whaleWarning: topHolderPct > 50,
      holderBreakdown,
      isPartialSnapshot: false,
    }
  } catch (error) {
    console.warn("[SCAN_ENGINE] Helius largest holder snapshot error:", error)
    return {
      holdersCount: null,
      topHolderPct: null,
      whaleWarning: false,
      holderBreakdown: [],
      isPartialSnapshot: false,
    }
  }
}

function roundMoney(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100) / 100
}

async function fetchBirdeyeData(
  path: string,
  params: Record<string, string>,
  apiKey: string,
  label: string,
) {
  if (!apiKey) return null

  try {
    const query = new URLSearchParams(params)
    const endpoint = `https://public-api.birdeye.so${path}?${query.toString()}`
    const headerVariants: Record<string, string>[] = [
      { accept: "application/json", "x-chain": "solana", "X-API-KEY": apiKey },
      { accept: "application/json", "x-chain": "solana", "x-api-key": apiKey },
      { accept: "application/json", "x-chain": "solana", Authorization: `Bearer ${apiKey}` },
    ]

    let res: Response | null = null
    for (const headers of headerVariants) {
      res = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        headers,
      })

      if (res.ok) break
      if (res.status !== 401) break
    }

    if (!res) return null

    if (res.status === 403) {
      console.warn(`[SCAN_ENGINE] Birdeye ${label} forbidden on current plan`)
      return null
    }
    if (res.status === 429) {
      console.warn(`[SCAN_ENGINE] Birdeye ${label} rate limited`)
      return null
    }
    if (!res.ok) {
      console.warn(`[SCAN_ENGINE] Birdeye ${label} failed with status ${res.status}`)
      return null
    }

    const data = await res.json()
    return data?.data || null
  } catch (error) {
    console.warn(`[SCAN_ENGINE] Birdeye ${label} error:`, error)
    return null
  }
}

async function fetchGeckoTerminalPoolSnapshot(address: string): Promise<GeckoTerminalPoolSnapshot | null> {
  try {
    const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${address}/pools?page=1`, {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    })

    if (!res.ok) {
      if (res.status !== 404) {
        console.warn(`[SCAN_ENGINE] GeckoTerminal pool fetch failed with status ${res.status}`)
      }
      return null
    }

    const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null
    const poolRows = Array.isArray(payload?.data) ? payload.data : []
    const pools = poolRows
      .map((pool) => {
        const record = asRecord(pool)
        const attributes = asRecord(record?.attributes)
        const relationships = asRecord(record?.relationships)
        const dex = asRecord(asRecord(relationships?.dex)?.data)

        return {
          dexId: pickString(dex, ["id"]),
          pairAddress: pickString(attributes, ["address"]),
          poolCreatedAt: pickString(attributes, ["pool_created_at"]),
          price: pickNumber(attributes, ["token_price_usd", "base_token_price_usd"]),
          liquidity: pickNumber(attributes, ["reserve_in_usd"]),
          volume24h: pickNumber(asRecord(attributes?.volume_usd), ["h24"]),
          marketCap: pickNumber(attributes, ["market_cap_usd", "fdv_usd"]),
        }
      })
      .filter((pool) => pool.price !== null || pool.liquidity !== null || pool.volume24h !== null)

    if (pools.length === 0) return null

    const bestPool = [...pools].sort((left, right) => (right.liquidity || 0) - (left.liquidity || 0))[0]

    return {
      dexes: Array.from(new Set(pools.map((pool) => pool.dexId).filter((value): value is string => Boolean(value)))),
      pairAddress: bestPool.pairAddress || null,
      poolCreatedAt: bestPool.poolCreatedAt || null,
      price: bestPool.price,
      liquidity: bestPool.liquidity,
      volume24h: bestPool.volume24h,
      marketCap: bestPool.marketCap,
    }
  } catch (error) {
    console.warn("[SCAN_ENGINE] GeckoTerminal pool fetch error:", error)
    return null
  }
}

async function fetchHeliusAsset(address: string, heliusApiKey: string) {
  if (!heliusApiKey) return null

  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "asset",
        method: "getAsset",
        params: {
          id: address,
          options: {
            showFungible: true,
          },
        },
      }),
    })

    if (!res.ok) return null
    const raw = await res.json()
    return raw?.result || null
  } catch (error) {
    console.warn("[SCAN_ENGINE] Helius getAsset error:", error)
    return null
  }
}

async function fetchHeliusCreatorBehavior(
  asset: Record<string, unknown> | null,
  heliusApiKey: string,
): Promise<HeliusCreatorBehavior> {
  if (!asset || !heliusApiKey) {
    return { creatorAddress: null, createdTokens: null, source: null }
  }

  const authorityAddress = pickNestedString(asset, [
    ["token_info", "mint_authority"],
    ["authorities", "0", "address"],
    ["creators", "0", "address"],
  ])

  if (!authorityAddress) {
    return { creatorAddress: null, createdTokens: null, source: null }
  }

  const strategies: Array<{ label: "helius-authority" | "helius-creator"; params: Record<string, unknown> }> = [
    {
      label: "helius-authority",
      params: {
        authorityAddress,
        tokenType: "fungible",
        limit: 1,
        page: 1,
        options: { showGrandTotal: true },
      },
    },
    {
      label: "helius-creator",
      params: {
        creatorAddress: authorityAddress,
        tokenType: "fungible",
        limit: 1,
        page: 1,
        options: { showGrandTotal: true },
      },
    },
  ]

  for (const strategy of strategies) {
    try {
      const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: strategy.label,
          method: "searchAssets",
          params: strategy.params,
        }),
      })

      if (!res.ok) continue
      const raw = await res.json()
      const total = raw?.result?.total ?? raw?.assets?.total ?? raw?.result?.assets?.total ?? null
      const totalNumber = typeof total === "number" ? total : Number(total)
      if (Number.isFinite(totalNumber) && totalNumber > 0) {
        return {
          creatorAddress: authorityAddress,
          createdTokens: totalNumber,
          source: strategy.label,
        }
      }
    } catch (error) {
      console.warn(`[SCAN_ENGINE] Helius creator behavior ${strategy.label} error:`, error)
    }
  }

  return {
    creatorAddress: authorityAddress,
    createdTokens: null,
    source: null,
  }
}

async function fetchBagsLaunchToken(address: string, bagsApiKey: string): Promise<BagsLaunchToken | null> {
  if (!bagsApiKey) return null

  const bagsUrl = "https://public-api-v2.bags.fm/api/v1/token-launch/feed"

  try {
    const bagsRes = await fetch(bagsUrl, {
      method: "GET",
      headers: { "x-api-key": bagsApiKey, "Content-Type": "application/json" },
      next: { revalidate: 30 },
    })

    if (bagsRes.status === 429) {
      console.error("[SCAN_ENGINE] Bags API Rate Limit (429) Triggered")
      return null
    }

    if (!bagsRes.ok) return null

    const rawBags = await bagsRes.json()
    if (!rawBags || !Array.isArray(rawBags.response)) return null

    const targetAddress = address.toLowerCase()
    const found = rawBags.response.find((token: BagsLaunchToken) => token.tokenMint?.toLowerCase() === targetAddress) || null

    if (process.env.NODE_ENV === "development") {
      console.log(`[SCAN_ENGINE] Bags API: Found=${!!found}`)
    }

    return found
  } catch (error) {
    console.warn("[SCAN_ENGINE] Bags API Error:", error)
    return null
  }
}

async function fetchBagsLifetimeFees(address: string, bagsApiKey: string): Promise<number | null> {
  if (!bagsApiKey) return null

  try {
    const res = await fetch(`https://public-api-v2.bags.fm/api/v1/token-launch/lifetime-fees?tokenMint=${encodeURIComponent(address)}`, {
      method: "GET",
      cache: "no-store",
      headers: { "x-api-key": bagsApiKey, accept: "application/json" },
    })

    if (!res.ok) return null
    const raw = await res.json().catch(() => null)
    return parseLamportsToSol(raw?.response)
  } catch (error) {
    console.warn("[SCAN_ENGINE] Bags lifetime fees error:", error)
    return null
  }
}

async function fetchBagsCreators(address: string, bagsApiKey: string): Promise<BagsCreatorProfile[]> {
  if (!bagsApiKey) return []

  try {
    const res = await fetch(`https://public-api-v2.bags.fm/api/v1/token-launch/creator/v3?tokenMint=${encodeURIComponent(address)}`, {
      method: "GET",
      cache: "no-store",
      headers: { "x-api-key": bagsApiKey, accept: "application/json" },
    })

    if (!res.ok) return []

    const raw = await res.json().catch(() => null)
    const rows = Array.isArray(raw?.response) ? raw.response : []

    return rows
      .map((entry: unknown): BagsCreatorProfile => {
        const record = asRecord(entry)
        return {
          wallet: pickString(record, ["wallet"]),
          provider: pickString(record, ["provider"]),
          providerUsername: pickString(record, ["providerUsername", "twitterUsername", "bagsUsername", "username"]),
          royaltyBps: pickNumber(record, ["royaltyBps"]),
          isCreator: pickBoolean(record, ["isCreator"]) || false,
        }
      })
      .filter((entry: BagsCreatorProfile) => Boolean(entry.wallet || entry.providerUsername))
  } catch (error) {
    console.warn("[SCAN_ENGINE] Bags creators error:", error)
    return []
  }
}

async function fetchBagsClaimStats(address: string, bagsApiKey: string): Promise<BagsClaimSnapshot> {
  if (!bagsApiKey) {
    return { totalClaimedSol: null, claimersCount: null }
  }

  try {
    const res = await fetch(`https://public-api-v2.bags.fm/api/v1/token-launch/claim-stats?tokenMint=${encodeURIComponent(address)}`, {
      method: "GET",
      cache: "no-store",
      headers: { "x-api-key": bagsApiKey, accept: "application/json" },
    })

    if (!res.ok) {
      return { totalClaimedSol: null, claimersCount: null }
    }

    const raw = await res.json().catch(() => null)
    const rows = Array.isArray(raw?.response) ? raw.response : []
    let totalClaimedLamports = BigInt(0)
    let hasClaims = false

    for (const entry of rows) {
      const record = asRecord(entry)
      const claimed = parseBigIntLike(pickString(record, ["totalClaimed"]))
      if (claimed !== null) {
        totalClaimedLamports += claimed
        hasClaims = true
      }
    }

    return {
      totalClaimedSol: hasClaims ? roundMoney(Number(totalClaimedLamports) / 1_000_000_000) : null,
      claimersCount: rows.length,
    }
  } catch (error) {
    console.warn("[SCAN_ENGINE] Bags claim stats error:", error)
    return { totalClaimedSol: null, claimersCount: null }
  }
}

async function fetchJupiterTokenSnapshot(address: string, jupiterApiKey: string): Promise<JupiterTokenSnapshot | null> {
  try {
    const headers: Record<string, string> = { accept: "application/json" }
    if (jupiterApiKey) {
      headers["x-api-key"] = jupiterApiKey
    }

    const res = await fetch(`https://api.jup.ag/tokens/v2/search?query=${encodeURIComponent(address)}`, {
      method: "GET",
      cache: "no-store",
      headers,
    })

    if (!res.ok) {
      if (res.status !== 401 && res.status !== 404) {
        console.warn(`[SCAN_ENGINE] Jupiter token search failed with status ${res.status}`)
      }
      return null
    }

    const raw = await res.json().catch(() => null)
    const rows = Array.isArray(raw) ? raw : []
    const match = rows.find((entry) => normalizeValue(pickString(asRecord(entry), ["id"])) === normalizeValue(address))
    const record = asRecord(match)
    if (!record) return null

    const audit = asRecord(record.audit)
    const firstPool = asRecord(record.firstPool)

    return {
      id: pickString(record, ["id"]) || address,
      name: pickString(record, ["name"]),
      symbol: pickString(record, ["symbol"]),
      icon: pickString(record, ["icon"]),
      decimals: pickNumber(record, ["decimals"]),
      circSupply: pickNumber(record, ["circSupply"]),
      totalSupply: pickNumber(record, ["totalSupply"]),
      tokenProgram: pickString(record, ["tokenProgram"]),
      twitter: pickString(record, ["twitter"]),
      telegram: pickString(record, ["telegram"]),
      website: pickString(record, ["website"]),
      dev: pickString(record, ["dev"]),
      launchpad: pickString(record, ["launchpad"]),
      partnerConfig: pickString(record, ["partnerConfig"]),
      graduatedPool: pickString(record, ["graduatedPool"]),
      graduatedAt: pickString(record, ["graduatedAt"]),
      holderCount: pickNumber(record, ["holderCount"]),
      fdv: pickNumber(record, ["fdv"]),
      mcap: pickNumber(record, ["mcap"]),
      usdPrice: pickNumber(record, ["usdPrice"]),
      liquidity: pickNumber(record, ["liquidity"]),
      createdAt: pickString(record, ["createdAt"]),
      updatedAt: pickString(record, ["updatedAt"]),
      mintAuthority: pickString(record, ["mintAuthority"]),
      freezeAuthority: pickString(record, ["freezeAuthority"]),
      organicScore: pickNumber(record, ["organicScore"]),
      organicScoreLabel: pickString(record, ["organicScoreLabel"]),
      isVerified: typeof record.isVerified === "boolean" ? record.isVerified : null,
      tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : [],
      firstPool: firstPool
        ? {
          id: pickString(firstPool, ["id"]),
          createdAt: pickString(firstPool, ["createdAt"]),
        }
        : null,
      audit: audit
        ? {
          isSus: pickBoolean(audit, ["isSus"]) || false,
          mintAuthorityDisabled: pickBoolean(audit, ["mintAuthorityDisabled"]),
          freezeAuthorityDisabled: pickBoolean(audit, ["freezeAuthorityDisabled"]),
          topHoldersPercentage: pickNumber(audit, ["topHoldersPercentage"]),
          devBalancePercentage: pickNumber(audit, ["devBalancePercentage"]),
          devMints: pickNumber(audit, ["devMints"]),
        }
        : null,
      stats5m: parseJupiterStatsWindow(asRecord(record.stats5m)),
      stats1h: parseJupiterStatsWindow(asRecord(record.stats1h)),
      stats6h: parseJupiterStatsWindow(asRecord(record.stats6h)),
      stats24h: parseJupiterStatsWindow(asRecord(record.stats24h)),
    }
  } catch (error) {
    console.warn("[SCAN_ENGINE] Jupiter token search error:", error)
    return null
  }
}

async function fetchHeliusFirstMintSnapshot(address: string, heliusApiKey: string): Promise<HeliusFirstMintSnapshot> {
  if (!heliusApiKey) {
    return { firstMintTime: null, firstMintTx: null }
  }

  try {
    const limit = 1000
    const maxPages = 8
    let before: string | undefined
    let oldestSignature: string | null = null
    let oldestBlockTime: number | null = null

    for (let page = 0; page < maxPages; page++) {
      const config: Record<string, unknown> = { limit }
      if (before) {
        config.before = before
      }

      const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `first-mint-${page}`,
          method: "getSignaturesForAddress",
          params: [address, config],
        }),
      })

      if (!res.ok) break

      const raw = await res.json().catch(() => null)
      const rows = Array.isArray(raw?.result) ? raw.result : []
      if (rows.length === 0) break

      const oldestEntry = asRecord(rows[rows.length - 1])
      oldestSignature = pickString(oldestEntry, ["signature"]) ?? oldestSignature
      oldestBlockTime = pickNumber(oldestEntry, ["blockTime"]) ?? oldestBlockTime

      if (rows.length < limit) break

      before = pickString(oldestEntry, ["signature"]) || undefined
      if (!before) break
    }

    if (oldestSignature && oldestBlockTime === null) {
      oldestBlockTime = await fetchHeliusTransactionBlockTime(oldestSignature, heliusApiKey)
    }

    return {
      firstMintTime: oldestBlockTime ? new Date(oldestBlockTime * 1000).toISOString() : null,
      firstMintTx: oldestSignature,
    }
  } catch (error) {
    console.warn("[SCAN_ENGINE] Helius first mint history error:", error)
    return { firstMintTime: null, firstMintTx: null }
  }
}

async function fetchHeliusTransactionBlockTime(signature: string, heliusApiKey: string): Promise<number | null> {
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "first-mint-tx",
        method: "getTransaction",
        params: [signature, { commitment: "finalized", encoding: "jsonParsed" }],
      }),
    })

    if (!res.ok) return null

    const raw = await res.json().catch(() => null)
    return pickNumber(asRecord(raw?.result), ["blockTime"])
  } catch (error) {
    console.warn("[SCAN_ENGINE] Helius transaction lookup error:", error)
    return null
  }
}

function parseJupiterStatsWindow(source: Record<string, unknown> | null): JupiterStatsWindow | null {
  if (!source) return null

  return {
    priceChange: pickNumber(source, ["priceChange"]),
    buyVolume: pickNumber(source, ["buyVolume"]),
    sellVolume: pickNumber(source, ["sellVolume"]),
    traders: pickNumber(source, ["numTraders"]),
    buys: pickNumber(source, ["numBuys"]),
    sells: pickNumber(source, ["numSells"]),
    organicBuyers: pickNumber(source, ["numOrganicBuyers"]),
    netBuyers: pickNumber(source, ["numNetBuyers"]),
  }
}

function parseLamportsToSol(value: unknown): number | null {
  const lamports = parseBigIntLike(typeof value === "string" ? value : typeof value === "number" ? String(value) : null)
  if (lamports === null) return null
  return roundMoney(Number(lamports) / 1_000_000_000)
}

function parseBigIntLike(value: string | null): bigint | null {
  if (!value) return null

  try {
    return BigInt(value)
  } catch {
    return null
  }
}

function formatLaunchType(value: string | null): string | null {
  if (!value) return null
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function resolveLaunchOrigin(bagsRecord: Record<string, unknown> | null, jupiterLaunchpad: string | null): string | null {
  const uri = pickString(bagsRecord, ["uri"])
  if (uri) {
    try {
      return new URL(uri).origin
    } catch {
      // Ignore malformed URIs and fall through to known launch origins.
    }
  }

  if (bagsRecord) {
    return "https://bags.fm"
  }

  if (!jupiterLaunchpad) return null

  const lower = jupiterLaunchpad.toLowerCase()
  if (lower.includes("bags")) return "https://bags.fm"
  if (lower.includes("pump")) return "https://pump.fun"
  if (lower.includes("meteora")) return "https://meteora.ag"
  if (lower.includes("jupiter")) return "https://jup.ag"

  return formatLaunchType(jupiterLaunchpad)
}

function normalizeBirdeyeToken(
  overview: Record<string, unknown> | null,
  price: Record<string, unknown> | null,
) {
  if (!overview && !price) return null

  const extensions = asRecord(overview?.extensions)
  const volume24h = pickNumber(overview, ["v24hUSD", "volume24hUSD", "volume24h", "volume24hUsd", "volume24h_usd"])
    ?? extractFrameMetric(overview, ["24h", "24H", "h24"], ["volumeUSD", "volume", "volumeUsd", "v"])

  return {
    name: pickString(overview, ["name", "tokenName"]),
    symbol: pickString(overview, ["symbol", "tokenSymbol"]),
    price: pickNumber(price, ["value", "price", "priceUsd", "priceValue"]) ?? pickNumber(overview, ["price", "priceUsd", "value"]),
    liquidity: pickNumber(price, ["liquidity", "liquidityUsd", "liquidityUSD"]) ?? pickNumber(overview, ["liquidity", "liquidityUsd", "liquidityUSD"]),
    volume: volume24h,
    holders: pickNumber(overview, ["holders", "holder", "holderCount", "uniqueHolders"]),
    totalSupply: pickNumber(overview, ["totalSupply", "supply", "tokenSupply", "total_supply"]),
    circulatingSupply: pickNumber(overview, ["circulatingSupply", "circulating_supply"]),
    image: pickString(overview, ["logoURI", "logo_uri", "logo", "image"]) || pickString(extensions, ["imageUrl"]),
    website: pickString(extensions, ["website"]),
    twitter: pickString(extensions, ["twitter"]),
    description: pickString(overview, ["description"]),
    createdAt: pickNumber(overview, ["createdAt", "created_at", "pairCreatedAt"]) ?? pickString(overview, ["createdAt", "created_at", "pairCreatedAt"]),
    status: pickString(overview, ["status"]),
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function pickNestedString(source: Record<string, unknown> | null, paths: string[][]): string | null {
  if (!source) return null

  for (const path of paths) {
    let current: unknown = source
    for (const key of path) {
      if (Array.isArray(current)) {
        const index = Number(key)
        current = Number.isInteger(index) ? current[index] : undefined
      } else if (current && typeof current === "object") {
        current = (current as Record<string, unknown>)[key]
      } else {
        current = undefined
      }
    }

    if (typeof current === "string" && current.trim()) {
      return current.trim()
    }
  }

  return null
}

function pickNumber(source: Record<string, unknown> | null, keys: string[]): number | null {
  if (!source) return null
  for (const key of keys) {
    const raw = source[key]
    if (typeof raw === "number" && Number.isFinite(raw)) return raw
    if (typeof raw === "string") {
      const parsed = Number(raw)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function pickBoolean(source: Record<string, unknown> | null, keys: string[]): boolean | null {
  if (!source) return null
  for (const key of keys) {
    const raw = source[key]
    if (typeof raw === "boolean") return raw
    if (typeof raw === "string") {
      if (raw.toLowerCase() === "true") return true
      if (raw.toLowerCase() === "false") return false
    }
  }
  return null
}

function pickString(source: Record<string, unknown> | null, keys: string[]): string | null {
  if (!source) return null
  for (const key of keys) {
    const raw = source[key]
    if (typeof raw === "string" && raw.trim()) return raw.trim()
  }
  return null
}

function extractFrameMetric(
  source: Record<string, unknown> | null,
  frameKeys: string[],
  metricKeys: string[],
): number | null {
  if (!source) return null
  for (const frameKey of frameKeys) {
    const frame = asRecord(source[frameKey])
    const value = pickNumber(frame, metricKeys)
    if (value !== null) return value
  }
  return null
}

function inferTokenStatus(
  liquidity: number | null,
  volume: number | null,
  holders: number | null,
  ageHours: number | null,
): string {
  if (ageHours !== null && ageHours < 72) return "pre-graduation"
  if ((liquidity || 0) >= 1000 || (volume || 0) >= 1000 || (holders || 0) >= 200) return "graduated"
  return "unknown"
}
