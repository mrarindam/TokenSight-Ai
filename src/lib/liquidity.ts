export type LiquidityProtocol = "dlmm" | "damm"

export type LiquidityPoolToken = {
  address: string
  symbol: string
  name: string
  decimals: number
  priceUsd: number | null
  amount: number
}

export type LiquidityPoolConfig = {
  minPrice: number | null
  maxPrice: number | null
  concentratedLiquidity: boolean | null
}

export type LiquidityPoolSnapshot = {
  protocol: LiquidityProtocol
  address: string
  name: string
  launchpad: string | null
  tvlUsd: number
  currentPrice: number | null
  createdAt: number | null
  tokenX: LiquidityPoolToken
  tokenY: LiquidityPoolToken
  config: LiquidityPoolConfig
}

export type LiquidityBreakdown = {
  totalLiquidityUsd: number
  dlmmLiquidityUsd: number
  dammLiquidityUsd: number
  dlmmPct: number
  dammPct: number
  dlmmPoolCount: number
  dammPoolCount: number
  totalPoolCount: number
}

export type PriceImpactEstimate = {
  amountUsd: number
  tokensReceived: number
  effectivePriceUsd: number | null
  newPriceUsd: number | null
  priceImpactPct: number | null
  routePoolCount: number
}

export function calculateLiquidityScore(pools: LiquidityPoolSnapshot[]): number {
  const breakdown = getLiquidityBreakdown(pools)

  let score = 0
  if (breakdown.dlmmPoolCount > 0) score += 50
  if (breakdown.totalLiquidityUsd > 50_000) score += 30
  if (breakdown.totalPoolCount > 1) score += 20

  return Math.max(0, Math.min(100, score))
}

export function getLiquidityBreakdown(pools: LiquidityPoolSnapshot[]): LiquidityBreakdown {
  const dlmmLiquidityUsd = round2(sumBy(pools.filter((pool) => pool.protocol === "dlmm"), (pool) => pool.tvlUsd))
  const dammLiquidityUsd = round2(sumBy(pools.filter((pool) => pool.protocol === "damm"), (pool) => pool.tvlUsd))
  const totalLiquidityUsd = round2(dlmmLiquidityUsd + dammLiquidityUsd)

  return {
    totalLiquidityUsd,
    dlmmLiquidityUsd,
    dammLiquidityUsd,
    dlmmPct: totalLiquidityUsd > 0 ? round2((dlmmLiquidityUsd / totalLiquidityUsd) * 100) : 0,
    dammPct: totalLiquidityUsd > 0 ? round2((dammLiquidityUsd / totalLiquidityUsd) * 100) : 0,
    dlmmPoolCount: pools.filter((pool) => pool.protocol === "dlmm").length,
    dammPoolCount: pools.filter((pool) => pool.protocol === "damm").length,
    totalPoolCount: pools.length,
  }
}

export function estimatePriceImpact(
  pools: LiquidityPoolSnapshot[],
  targetMint: string,
  amountUsd: number,
  fallbackPriceUsd?: number | null,
): PriceImpactEstimate | null {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null

  const executablePools = selectTradePools(
    pools
      .map((pool) => normalizeTradePool(pool, targetMint))
      .filter((pool): pool is NormalizedTradePool => Boolean(pool))
  )

  if (executablePools.length === 0) return null

  const totalTvlUsd = sumBy(executablePools, (pool) => pool.tvlUsd)
  const baselinePriceUsd = getBaselinePrice(executablePools, fallbackPriceUsd)

  if (!baselinePriceUsd || baselinePriceUsd <= 0) {
    return null
  }

  let totalTokensReceived = 0
  let weightedNewPriceUsd = 0
  let weightedShare = 0

  for (const pool of executablePools) {
    const routeShare = totalTvlUsd > 0 ? pool.tvlUsd / totalTvlUsd : 1 / executablePools.length
    const allocatedUsd = amountUsd * routeShare
    const deltaQuoteAmount = allocatedUsd / pool.quoteTokenPriceUsd
    const invariant = pool.targetReserve * pool.quoteReserve

    if (!Number.isFinite(invariant) || invariant <= 0) continue

    const newQuoteReserve = pool.quoteReserve + deltaQuoteAmount
    const newTargetReserve = invariant / newQuoteReserve
    const tokensReceived = Math.max(0, pool.targetReserve - newTargetReserve)

    if (!Number.isFinite(tokensReceived) || tokensReceived <= 0) continue

    const newPriceUsd = (newQuoteReserve * pool.quoteTokenPriceUsd) / newTargetReserve

    totalTokensReceived += tokensReceived
    weightedNewPriceUsd += newPriceUsd * routeShare
    weightedShare += routeShare
  }

  if (totalTokensReceived <= 0) return null

  const effectivePriceUsd = amountUsd / totalTokensReceived
  const priceImpactPct = Math.abs(((effectivePriceUsd - baselinePriceUsd) / baselinePriceUsd) * 100)

  return {
    amountUsd,
    tokensReceived: round6(totalTokensReceived),
    effectivePriceUsd: round6(effectivePriceUsd),
    newPriceUsd: weightedShare > 0 ? round6(weightedNewPriceUsd / weightedShare) : null,
    priceImpactPct: round2(priceImpactPct),
    routePoolCount: executablePools.length,
  }
}

export function calculateNearPriceLiquidityRatio(pools: LiquidityPoolSnapshot[]): number {
  const breakdown = getLiquidityBreakdown(pools)
  if (breakdown.totalLiquidityUsd <= 0) return 0

  const activeLiquidityUsd = sumBy(pools, (pool) => {
    if (pool.protocol === "dlmm") {
      return pool.tvlUsd
    }

    const minPrice = pool.config.minPrice
    const maxPrice = pool.config.maxPrice
    const currentPrice = pool.currentPrice

    if (
      minPrice !== null
      && maxPrice !== null
      && currentPrice !== null
      && currentPrice >= minPrice
      && currentPrice <= maxPrice
    ) {
      return pool.tvlUsd
    }

    return 0
  })

  return round2((activeLiquidityUsd / breakdown.totalLiquidityUsd) * 100)
}

type NormalizedTradePool = {
  tvlUsd: number
  targetReserve: number
  quoteReserve: number
  quoteTokenSymbol: string
  quoteTokenPriceUsd: number
  targetTokenPriceUsd: number
}

function normalizeTradePool(pool: LiquidityPoolSnapshot, targetMint: string): NormalizedTradePool | null {
  const targetMatchesX = pool.tokenX.address === targetMint
  const targetMatchesY = pool.tokenY.address === targetMint

  if (!targetMatchesX && !targetMatchesY) return null

  const targetToken = targetMatchesX ? pool.tokenX : pool.tokenY
  const quoteToken = targetMatchesX ? pool.tokenY : pool.tokenX

  if (
    !Number.isFinite(targetToken.amount)
    || !Number.isFinite(quoteToken.amount)
    || targetToken.amount <= 0
    || quoteToken.amount <= 0
  ) {
    return null
  }

  const quoteTokenPriceUsd = quoteToken.priceUsd
  const targetTokenPriceUsd = targetToken.priceUsd

  if (
    quoteTokenPriceUsd === null
    || targetTokenPriceUsd === null
    || quoteTokenPriceUsd <= 0
    || targetTokenPriceUsd <= 0
  ) {
    return null
  }

  return {
    tvlUsd: pool.tvlUsd,
    targetReserve: targetToken.amount,
    quoteReserve: quoteToken.amount,
    quoteTokenSymbol: quoteToken.symbol,
    quoteTokenPriceUsd,
    targetTokenPriceUsd,
  }
}

function getBaselinePrice(pools: NormalizedTradePool[], fallbackPriceUsd?: number | null): number | null {
  if (fallbackPriceUsd && fallbackPriceUsd > 0) {
    return fallbackPriceUsd
  }

  const weighted = sumBy(pools, (pool) => pool.targetTokenPriceUsd * pool.tvlUsd)
  const totalTvlUsd = sumBy(pools, (pool) => pool.tvlUsd)

  if (totalTvlUsd > 0) {
    return weighted / totalTvlUsd
  }

  return null
}

function selectTradePools(pools: NormalizedTradePool[]): NormalizedTradePool[] {
  if (pools.length <= 1) return pools

  const sortedPools = [...pools].sort((left, right) => right.tvlUsd - left.tvlUsd)
  const preferredPools = sortedPools.filter((pool) => isPreferredQuotePool(pool.quoteTokenSymbol))
  const candidatePools = preferredPools.length > 0 ? preferredPools : sortedPools
  const totalCandidateTvl = sumBy(candidatePools, (pool) => pool.tvlUsd)
  const selectedPools: NormalizedTradePool[] = []
  let coveredTvl = 0

  for (const pool of candidatePools) {
    selectedPools.push(pool)
    coveredTvl += pool.tvlUsd

    const coveragePct = totalCandidateTvl > 0 ? coveredTvl / totalCandidateTvl : 1
    if (selectedPools.length >= 8 || coveragePct >= 0.85) {
      break
    }
  }

  return selectedPools
}

function isPreferredQuotePool(symbol: string): boolean {
  const normalizedSymbol = symbol.trim().toUpperCase()
  return normalizedSymbol === "SOL" || normalizedSymbol === "USDC" || normalizedSymbol === "USDT"
}

function sumBy<T>(items: T[], iteratee: (item: T) => number): number {
  return items.reduce((sum, item) => sum + iteratee(item), 0)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}