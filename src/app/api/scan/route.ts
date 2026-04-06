import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { supabase } from "@/lib/supabaseClient"
import { updateStreak } from "@/lib/streak-logic"
import { addLowRiskToken } from "@/lib/lowRiskStore"
import type { Token } from "@/types/token"

const BAGS_API_KEY = process.env.BAGS_API_KEY || ""
const GROQ_API_KEY = process.env.GROQ_API_KEY || ""
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || ""

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { address: rawAddress, anonCount } = body

    // --- LEVEL 7: INPUT SANITIZATION & NORMALIZATION ---
    // Strip everything except alphanumeric, trim, and normalize case to prevent address mismatches
    const address = typeof rawAddress === 'string' ? rawAddress.trim().replace(/[^a-zA-Z0-9]/g, "") : ""

    const session = await getServerSession(authOptions)

    // --- STEP 1: AUTHENTICATION & LIMIT CHECK ---
    if (!session?.user) {
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

    if (!address.endsWith("BAGS")) {
      return NextResponse.json({ error: "Only Bags tokens are supported" }, { status: 400 })
    }

    if (!BAGS_API_KEY || !GROQ_API_KEY) {
      return NextResponse.json({ error: "Server configuration error: missing API keys" }, { status: 500 })
    }

    // --- STEP 2: FETCH DATA ---

    // --- STEP 2: FETCH DATA (PARALLEL & ROBUST) ---
    if (process.env.NODE_ENV === "development") {
      console.log(`[SCAN_ENGINE] Starting full audit for: ${address}`)
    }

    const [bagsResult, dexResult, heliusResult] = await Promise.allSettled([
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
      })(),

      // 3. Fetch holder data from Helius (PAGINATED DAS for unique owner counting)
      (async () => {
        try {
          const owners = new Set<string>()
          let currentPage = 1
          const maxPages = 3 // MVP Limit for performance

          while (currentPage <= maxPages) {
            const heliusRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: "1",
                method: "getTokenAccounts",
                params: {
                  mint: address,
                  page: currentPage,
                  limit: 1000
                }
              })
            })

            if (heliusRes.status === 429) {
              console.error("[SCAN_ENGINE] Helius Rate Limit (429) Triggered")
              break
            }

            if (heliusRes.ok) {
              const rawHelius = await heliusRes.json()
              if (process.env.NODE_ENV === "development") {
                console.log(`[SCAN_ENGINE] HELIUS RAW (Page ${currentPage}):`, {
                  total: rawHelius.result?.total,
                  returned: rawHelius.result?.token_accounts?.length
                })
              }

              const accounts = rawHelius.result?.token_accounts || []
              if (accounts.length === 0) break

              // Count UNIQUE owners across pages
              accounts.forEach((acc: { owner?: string }) => {
                if (acc.owner) owners.add(acc.owner)
              })

              // Stop if we've reached the last page or no more accounts
              if (accounts.length < 1000) break
              currentPage++
            } else {
              break
            }
          }

          if (owners.size === 0) return null
          return { total: owners.size } // Return count wrapped in object
        } catch (e) {
          console.warn("[SCAN_ENGINE] Helius Paginated API Error:", e)
        }
        return null
      })()
    ])

    // --- STEP 2.5: EXTRACT DATA & FALLBACKS ---
    const bagsToken = bagsResult.status === "fulfilled" ? bagsResult.value : null
    let rawDex = dexResult.status === "fulfilled" ? dexResult.value : null
    const rawHelius = heliusResult.status === "fulfilled" ? heliusResult.value : null

    // --- FALLBACK: DexScreener Symbol Search ---
    if ((!rawDex?.pairs || rawDex.pairs.length === 0) && bagsToken?.symbol) {
      console.log(`[SCAN_ENGINE] DexScreener address lookup failed for ${address}. Retrying with symbol: ${bagsToken.symbol}`)
      try {
        const fallbackRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${bagsToken.symbol}`, {
          method: "GET",
          next: { revalidate: 15 }
        })
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json()
          // Filter pairs to find one that matches our address or is likely the same token
          const matchingPair = fallbackData.pairs?.find((p: { baseToken?: { address?: string, symbol?: string } }) => 
            p.baseToken?.address?.toLowerCase() === address.toLowerCase() ||
            p.baseToken?.symbol?.toLowerCase() === bagsToken.symbol.toLowerCase()
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

    if (rawDex?.pairs && Array.isArray(rawDex.pairs) && rawDex.pairs.length > 0) {
      // Prioritize Solana chain
      const solanaPairs = rawDex.pairs.filter((p: { chainId: string }) => p.chainId === 'solana')
      const targetPairs = solanaPairs.length > 0 ? solanaPairs : rawDex.pairs

      const highestPair = [...targetPairs].sort((a: { liquidity?: { usd?: number } }, b: { liquidity?: { usd?: number } }) => {
        const liqA = a.liquidity?.usd || 0
        const liqB = b.liquidity?.usd || 0
        return liqB - liqA
      })[0]

      dexLiquidity = highestPair.liquidity?.usd || null
      dexVolume = highestPair.volume?.h24 || null
      dexTokenName = highestPair.baseToken?.name || null
      dexTokenSymbol = highestPair.baseToken?.symbol || null
      
      if (process.env.NODE_ENV === "development") {
        console.log(`[SCAN_ENGINE] Dex Best Pair: ${highestPair.pairAddress} | Chain: ${highestPair.chainId} | Liq: ${dexLiquidity} | Vol: ${dexVolume}`)
      }
    }

    let holdersCount: number | null = null
    // Extract total from paginated unique owner set
    if (rawHelius && typeof rawHelius === 'object' && 'total' in rawHelius) {
      holdersCount = (rawHelius as { total: number }).total
    }

    // --- STRATEGIC FALLBACK: If 0 or null, treat as 'Data unavailable' ---
    if (holdersCount === 0) holdersCount = null

    if (process.env.NODE_ENV === "development") {
      console.log("HOLDER DEBUG:", {
        address,
        helius_holders: holdersCount !== null ? holdersCount : "Data unavailable"
      })
    }

    // --- STEP 3: PREPARE VARIABLES WITH FAILSAFES ---
    const status = bagsToken?.status ? classifyTokenStatus(bagsToken.status) : "unknown"
    
    // Liquidity Failsafe: Dex > Bags > null (Discovery Phase)
    const liquidity = (dexLiquidity !== null && dexLiquidity !== undefined) 
      ? dexLiquidity 
      : (bagsToken?.liquidity || null)

    // Volume Failsafe: Dex > Bags > null (Discovery Phase)
    const volume = (dexVolume !== null && dexVolume !== undefined)
      ? dexVolume
      : (bagsToken?.volume || bagsToken?.volume24h || null)

    const holders = holdersCount || null
    // Increment by 1 to include the current token (1 = First time creator)
    const creator_tokens = (bagsToken?.creatorTokens || bagsToken?.creator_tokens || 0) + 1
    // const suspicious_creator = bagsToken?.creatorFlag || bagsToken?.creator_suspicious || false

    if (process.env.NODE_ENV === "development") {
      console.log("[SCAN_ENGINE] Final Metrics Audit:", {
        address,
        liquidity,
        volume,
        holders,
        creator_tokens,
        status
      })
    }

    // --- STEP 4: OPPORTUNITY-FIRST INTELLIGENCE ENGINE (Threshold-Based Model) ---
    // GOAL: Transparent scoring where each metric contributes clearly to the final Entry Score.
    let score = 50 // Base score
    const signals: string[] = []
    let validSignalsCount = 0

    // A. LIQUIDITY SCORING
    if (liquidity !== null && liquidity > 0) {
      validSignalsCount++
      if (liquidity < 100) {
        score -= 30
        signals.push("Critically weak liquidity depth")
      } else if (liquidity < 300) {
        score -= 20
        signals.push("Low liquidity baseline")
      } else if (liquidity < 1000) {
        score -= 10
        signals.push("Developing liquidity node")
      } else if (liquidity <= 20000) {
        score += 5
        signals.push("Steady liquidity foundation")
      } else if (liquidity > 20000) {
        score += 15
        signals.push("Strong liquidity depth")
      }
    } else {
      signals.push("Market data not available yet (Discovery phase)")
    }

    // B. HOLDER SCORING
    if (holders !== null && holders > 0) {
      validSignalsCount++
      if (holders < 10) {
        score -= 20
        signals.push("Extreme holder centralization")
      } else if (holders <= 50) {
        score -= 10
        signals.push("Limited holder distribution")
      } else if (holders <= 200) {
        score += 5
        signals.push("Healthy holder growth")
      } else if (holders > 200) {
        score += 10
        signals.push("Strong holder distribution")
      }
    } else {
        signals.push("Holder distribution scanning...")
    }

    // C. VOLUME SCORING
    if (volume !== null && volume > 0) {
      validSignalsCount++
      if (volume < 500) {
        score -= 5
        signals.push("Low market activity")
      } else if (volume >= 1000 && volume <= 5000) {
        score += 5
        signals.push("Active market node")
      } else if (volume > 5000) {
        score += 10
        signals.push("High trading momentum")
      }
    }

    // D. MOMENTUM RATIO (Volume / Liquidity)
    if (liquidity && volume && liquidity > 0 && volume > 0) {
      const ratio = volume / liquidity
      if (ratio < 0.2) {
        score -= 5
        signals.push("Weak buyer interest relative to liquidity")
      } else if (ratio >= 0.5 && ratio <= 2) {
        score += 10
        signals.push("Healthy trading velocity")
      } else if (ratio > 3) {
        score -= 10
        signals.push("Suspicious activity vs liquidity depth")
      }
    }

    // E. CREATOR SCORING (1 = First-time, >5 = Risk)
    if (creator_tokens === 1) {
      score += 5
      signals.push("Single-token creator")
    } else if (creator_tokens > 5) {
      score -= 15
      signals.push("High-frequency relauncher history")
    }

    // F. EARLY STAGE ADJUSTMENT
    if (status === "pre-graduation" || status === "pre-launch") {
      score -= 5
      signals.push("Early discovery uncertainty premium")
    }

    // G. DATA CONFIDENCE LAYER
    let confidence = "LOW"
    if (validSignalsCount >= 3) confidence = "HIGH"
    else if (validSignalsCount >= 2) confidence = "MEDIUM"

    // H. FINAL SCORE CLAMPING & ROUNDING
    score = Math.round(score)
    if (score > 100) score = 100
    if (score < 0) score = 0

    // I. SIGNAL INTERPRETATION
    let label = "WATCH SIGNAL"
    if (score >= 80) label = "STRONG OPPORTUNITY"
    else if (score >= 60) label = "GOOD ENTRY"
    else if (score < 35) label = "WEAK ENTRY"

    // --- GROQ AI INTELLIGENCE SUMMARY (Institutional-Grade) ---
    let explanation = ""
    try {
      const groqPrompt = `Analyze this token like an institutional crypto analyst. Keep it to 2-4 sentences max. Output a clean paragraph with no markdown symbols (**). 

Input:
- Intelligence Score: ${score}/100 (Higher is stronger opportunity)
- Verdict: ${label}
- Confidence: ${confidence}
- Signals: ${signals.join(", ") || "None"}
- Liquidity: ${liquidity === null || liquidity === 0 ? "Under evaluation" : "$" + liquidity}
- Volume (24h): ${volume === null || volume === 0 ? "Under evaluation" : "$" + volume}
- Holders: ${holders === null || holders === 0 ? "Under evaluation" : holders}

Structure:
1. Start with the overall verdict (e.g., "Strong entry setup," "Watch zone").
2. Analyze the market structure, liquidity depth, holder distribution, and momentum.
3. Conclude with a strategic insight (e.g., accumulation phase, early discovery).
4. Always end the final sentence with "DYOR."

Rules:
- NEVER use "risk" or "danger." Use "entry conditions" or "market strength."
- NO markdown formatting or bolding allowed.
- Keep tone confident, analytical, and professional.
- Avoid generic phrases or fluff.`

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: groqPrompt }],
          temperature: 0.15, // Extremely deterministic for professional tone
          max_tokens: 150
        })
      })

      if (groqRes.ok) {
        const groqData = await groqRes.json()
        explanation = groqData.choices?.[0]?.message?.content?.trim() || "Intelligence summary unavailable."
      } else {
        explanation = `${label} entry conditions with a ${confidence} confidence rating. Current market structure shows an Intelligence Score of ${score}/100, reflecting early discovery phase dynamics.`
      }
    } catch {
      explanation = `Intelligence analysis indicates ${label} conditions for ${address} with an Intelligence Score of ${score}/100.`
    }

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

    // We run this without awaiting the final UI response to ensure speed
    // Insert Scan for ALL users (logged-in or anonymous)
    supabase.from("scans").insert({
      user_id: session?.user?.id || null, // Nullable for anonymous users
      token_name: tokenName,
      token_address: address,
      token_symbol: tokenSymbol,
      risk_level: label,
      score: score,
      confidence: confidence,
      signals: signals,
      liquidity: liquidity,
      volume: volume,
      holders: holders,
    }).then(({ error }) => {
      // Only update streaks for logged-in users
      if (!error && session?.user?.id) {
        updateStreak(session.user.id, score, tokenName).then(() => revalidatePath("/profile"))
      }
    })

    // --- CLEAN TOKEN-ONLY RESPONSE ---
    return NextResponse.json({
      score: score,
      label: label,
      confidence: confidence,
      signals: signals,
      explanation: explanation,
      contractName: bagsToken?.name || dexTokenName || bagsToken?.symbol || "Unknown Token",
      meta: {
        liquidity: liquidity, // Pass null as null
        volume: volume,       // Pass null as null
        holders: holders,     // Pass null as null
        creator_tokens: creator_tokens,
        status: status,
      }
    })

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
