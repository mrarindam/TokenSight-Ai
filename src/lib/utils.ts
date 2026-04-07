import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isValidSolanaAddress(address: string): boolean {
  const trimmed = address.trim()

  // Solana/SVM addresses are base58 and typically 32-44 chars.
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)
}

// Fetch current price from DexScreener for a given token address
export async function fetchTokenPrice(tokenAddress: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`)
    if (!res.ok) return null
    const data = await res.json()
    // Find the pair with the highest liquidity (preferably Solana)
    if (data?.pairs && Array.isArray(data.pairs) && data.pairs.length > 0) {
      const solanaPairs = data.pairs.filter((p: { chainId: string }) => p.chainId === 'solana')
      const targetPairs = solanaPairs.length > 0 ? solanaPairs : data.pairs
      const highestPair = [...targetPairs].sort((a: { liquidity?: { usd?: number } }, b: { liquidity?: { usd?: number } }) => {
        const liqA = a.liquidity?.usd || 0
        const liqB = b.liquidity?.usd || 0
        return liqB - liqA
      })[0]
      return highestPair.priceUsd ? Number(highestPair.priceUsd) : null
    }
    return null
  } catch {
    return null
  }
}
