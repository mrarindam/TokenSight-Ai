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

    const [birdeyePriceResult, birdeyeOverviewResult, bagsResult, dexResult, heliusAssetResult] = await Promise.allSettled([
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

      // 1. Fetch token details from Bags API Feed
      (async () => {
        const bagsUrl = "https://public-api-v2.bags.fm/api/v1/token-launch/feed"
        try {
          const bagsRes = await fetch(bagsUrl, {
            method: "GET",
            headers: { "x-api-key": BAGS_API_KEY, "Content-Type": "application/json" },
            next: { revalidate: 30 },
          })
          
          if (bagsRes.status === 429) console.error("[SCAN_ENGINE] Bags API Rate Limit (429) Triggered")

          if (bagsRes.ok) {
            const rawBags = await bagsRes.json()
            if (rawBags && Array.isArray(rawBags.response)) {
              const targetAddress = address.toLowerCase()
              const found = rawBags.response.find((t: { tokenMint?: string }) => t.tokenMint?.toLowerCase() === targetAddress) || null
              if (process.env.NODE_ENV === "development") {
                console.log(`[SCAN_ENGINE] Bags API: Found=${!!found}`)
              }
              return found
            }
          }
        } catch (e) {
          console.warn("[SCAN_ENGINE] Bags API Error:", e)
        }
        return null
      })(),

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
      })()
      ,
      fetchHeliusAsset(address, HELIUS_API_KEY)
    ])

    // --- STEP 2.5: EXTRACT DATA & FALLBACKS ---
    const rawBirdeyePrice = birdeyePriceResult.status === "fulfilled" ? birdeyePriceResult.value : null
    const rawBirdeyeOverview = birdeyeOverviewResult.status === "fulfilled" ? birdeyeOverviewResult.value : null
    const fallbackBagsToken = bagsResult.status === "fulfilled" ? bagsResult.value : null
    let rawDex = dexResult.status === "fulfilled" ? dexResult.value : null
    const rawHeliusAsset = heliusAssetResult.status === "fulfilled" ? heliusAssetResult.value : null

    const birdeyeToken = normalizeBirdeyeToken(rawBirdeyeOverview, rawBirdeyePrice)
    const bagsToken = fallbackBagsToken

    // --- FALLBACK: DexScreener Symbol Search ---
    if ((!rawDex?.pairs || rawDex.pairs.length === 0) && fallbackBagsToken?.symbol) {
      console.log(`[SCAN_ENGINE] DexScreener address lookup failed for ${address}. Retrying with symbol: ${bagsToken.symbol}`)
      try {
        const fallbackRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${fallbackBagsToken.symbol}`, {
          method: "GET",
          next: { revalidate: 15 }
        })
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json()
          // Filter pairs to find one that matches our address or is likely the same token
          const matchingPair = fallbackData.pairs?.find((p: { baseToken?: { address?: string, symbol?: string } }) => 
            p.baseToken?.address?.toLowerCase() === address.toLowerCase() ||
            p.baseToken?.symbol?.toLowerCase() === fallbackBagsToken.symbol.toLowerCase()
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

      if (process.env.NODE_ENV === "development" && highestPair) {
        console.log(`[SCAN_ENGINE] Dex Best Pair: ${highestPair.pairAddress} | Chain: ${highestPair.chainId} | Liq: ${dexLiquidity} | Vol: ${dexVolume} | Price: ${dexPrice}`)
      }
    }

    if (birdeyeToken) {
      dexLiquidity = birdeyeToken.liquidity ?? dexLiquidity
      dexVolume = birdeyeToken.volume ?? dexVolume
      dexTokenName = birdeyeToken.name || dexTokenName
      dexTokenSymbol = birdeyeToken.symbol || dexTokenSymbol
      dexPrice = birdeyeToken.price ?? dexPrice

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

    const holderSnapshot = HELIUS_API_KEY
      ? await fetchHolderSnapshot(address, HELIUS_API_KEY)
      : { holdersCount: null, topHolderPct: null, whaleWarning: false, holderBreakdown: [], isPartialSnapshot: false }
    const creatorBehavior = HELIUS_API_KEY
      ? await fetchHeliusCreatorBehavior(rawHeliusAsset, HELIUS_API_KEY)
      : { creatorAddress: null, createdTokens: null, source: null }
    const holdersCount = holderSnapshot.holdersCount ?? birdeyeToken?.holders ?? null
    const topHolderPct = holderSnapshot.topHolderPct
    const whaleWarning = holderSnapshot.whaleWarning
    const holderBreakdown = holderSnapshot.holderBreakdown
    const isPartialHolderData = holderSnapshot.isPartialSnapshot

    // --- EXTRACT SECURITY & IDENTITY FROM HELIUS ASSET ---
    const tokenInfo = rawHeliusAsset?.token_info as Record<string, unknown> | undefined
    const mintAuthority = tokenInfo?.mint_authority as string | null ?? null
    const freezeAuthority = tokenInfo?.freeze_authority as string | null ?? null
    const lpBurnStatus = (() => {
      // If no freeze authority, LP burn is considered strong
      if (!freezeAuthority) return "strong"
      return "unknown"
    })()

    // Identity & Ownership
    const deployerAddress = creatorBehavior.creatorAddress
      ?? (rawHeliusAsset?.authorities as { address: string }[] | undefined)?.[0]?.address
      ?? null
    const poolAddress = highestPair?.pairAddress ?? null
    const pairCreatedTimestamp = highestPair?.pairCreatedAt
      ?? parseTimestamp(bagsToken?.pairCreatedAt || bagsToken?.createdAt || bagsToken?.created_at || bagsToken?.launchTime || bagsToken?.launchedAt || null)
      ?? null

    // Links & Social
    const websiteUrl = bagsToken?.website || highestPair?.info?.websites?.[0]?.url || birdeyeToken?.website || null
    const twitterUrl = bagsToken?.twitter || highestPair?.info?.socials?.find((s: { type: string; url: string }) => s.type === "twitter")?.url || birdeyeToken?.twitter || null
    const telegramUrl = highestPair?.info?.socials?.find((s: { type: string; url: string }) => s.type === "telegram")?.url || null
    const quoteToken = highestPair?.baseToken?.address === address ? "Wrapped Sol (SOL)" : null
    const marketCap = highestPair?.fdv ?? highestPair?.marketCap ?? null
    const tokenImage = bagsToken?.image || highestPair?.info?.imageUrl || birdeyeToken?.image || null

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
      bagsToken?.description,
    ].filter(Boolean).length
    const ageHours = extractAgeHours([
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
    } else if (authUser?.id) {
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
          mintAuthorityDisabled: !mintAuthority,
          freezeAuthorityDisabled: !freezeAuthority,
          lpBurnProfile: lpBurnStatus,
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
          price: birdeyeToken?.price !== null && birdeyeToken?.price !== undefined ? "birdeye" : dexPrice !== null ? "dexscreener" : "unknown",
          liquidity: birdeyeToken?.liquidity !== null && birdeyeToken?.liquidity !== undefined ? "birdeye" : dexLiquidity !== null ? "dexscreener" : bagsToken?.liquidity ? "bags" : "unknown",
          volume: birdeyeToken?.volume !== null && birdeyeToken?.volume !== undefined ? "birdeye" : dexVolume !== null ? "dexscreener" : bagsToken?.volume || bagsToken?.volume24h ? "bags" : "unknown",
          holders: holderSnapshot.holdersCount !== null ? "helius" : birdeyeToken?.holders !== null && birdeyeToken?.holders !== undefined ? "birdeye" : "unknown",
          whale: holderSnapshot.topHolderPct !== null ? "helius" : "unknown",
          creator: creatorBehavior.createdTokens !== null ? "helius" : creatorTokenBase !== null ? "bags" : "unknown",
          metadata: fallbackBagsToken ? "bags" : birdeyeToken ? "birdeye" : "unknown",
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

function roundPct(value: number): number {
  return Math.round(value * 100) / 100
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

async function fetchHolderSnapshot(address: string, heliusApiKey: string): Promise<HolderSnapshot> {
  try {
    const ownerBalances = new Map<string, number>()
    const limit = 1000
    let currentPage = 1
    const maxPages = 250
    let expectedTotalAccounts: number | null = null
    let fetchedTokenAccounts = 0
    let lastPageSize = 0
    let snapshotComplete = true

    while (currentPage <= maxPages) {
      const heliusRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `holders-${currentPage}`,
          method: "getTokenAccounts",
          params: {
            mint: address,
            page: currentPage,
            limit,
          },
        }),
      })

      if (heliusRes.status === 429) {
        console.error("[SCAN_ENGINE] Helius Rate Limit (429) Triggered")
        snapshotComplete = false
        break
      }

      if (!heliusRes.ok) {
        snapshotComplete = false
        break
      }

      const rawHelius = await heliusRes.json()
      const reportedTotal = Number(rawHelius.result?.total || 0)
      if (Number.isFinite(reportedTotal) && reportedTotal > 0) {
        expectedTotalAccounts = reportedTotal
      }

      const accounts: { owner?: string; amount?: number }[] = rawHelius.result?.token_accounts || []
      lastPageSize = accounts.length
      if (accounts.length === 0) {
        break
      }

      fetchedTokenAccounts += accounts.length

      accounts.forEach((account) => {
        const owner = account.owner || "unknown"
        const amount = Number(account.amount || 0)
        ownerBalances.set(owner, (ownerBalances.get(owner) || 0) + amount)
      })

      if (process.env.NODE_ENV === "development") {
        console.log(`[SCAN_ENGINE] HELIUS RAW (Page ${currentPage}):`, {
          total: expectedTotalAccounts,
          returned: accounts.length,
          fetchedTokenAccounts,
        })
      }

      const reachedReportedEnd = expectedTotalAccounts !== null && fetchedTokenAccounts >= expectedTotalAccounts
      if (reachedReportedEnd || accounts.length < limit) {
        break
      }

      currentPage++
    }

    if (currentPage > maxPages && lastPageSize === limit) {
      snapshotComplete = false
      console.warn(`[SCAN_ENGINE] Holder snapshot reached max page limit for ${address}`)
    }

    if (ownerBalances.size === 0) {
      return {
        holdersCount: null,
        topHolderPct: null,
        whaleWarning: false,
        holderBreakdown: [],
        isPartialSnapshot: false,
      }
    }

    const reachedReportedEnd = expectedTotalAccounts !== null && fetchedTokenAccounts >= expectedTotalAccounts
    const reachedNaturalEnd = lastPageSize > 0 && lastPageSize < limit
    if (!reachedReportedEnd && !reachedNaturalEnd) {
      snapshotComplete = false
    }

    if (!snapshotComplete) {
      // Return partial data with caution flag instead of empty
      return {
        holdersCount: expectedTotalAccounts ?? ownerBalances.size,
        topHolderPct: null,
        whaleWarning: false,
        holderBreakdown: [],
        isPartialSnapshot: true,
      }
    }

    const sortedBalances = Array.from(ownerBalances.values()).sort((a, b) => b - a)
    const totalSupply = sortedBalances.reduce((sum, amount) => sum + amount, 0)
    if (totalSupply <= 0) {
      return {
        holdersCount: ownerBalances.size,
        topHolderPct: null,
        whaleWarning: false,
        holderBreakdown: [],
        isPartialSnapshot: false,
      }
    }

    const sortedEntries = Array.from(ownerBalances.entries()).sort((a, b) => b[1] - a[1])
    const breakdownCount = Math.min(sortedEntries.length, 10)
    const holderBreakdown = sortedEntries.slice(0, breakdownCount).map(([addr, amount], index) => ({
      rank: index + 1,
      pct: roundPct((amount / totalSupply) * 100),
      address: addr,
    }))
    const topSliceSum = sortedBalances.slice(0, breakdownCount).reduce((sum, amount) => sum + amount, 0)
    const topHolderPct = roundPct((topSliceSum / totalSupply) * 100)

    return {
      holdersCount: ownerBalances.size,
      topHolderPct,
      whaleWarning: topHolderPct > 50,
      holderBreakdown,
      isPartialSnapshot: false,
    }
  } catch (error) {
    console.warn("[SCAN_ENGINE] Helius holder snapshot error:", error)
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
