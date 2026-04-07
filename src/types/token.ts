// ===== Bags API Raw Response Types =====

export interface BagsTokenRaw {
  name: string
  symbol: string
  description: string
  image: string
  tokenMint: string
  status: "PRE_LAUNCH" | "PRE_GRAD" | "POST_GRAD" | "LAUNCHED" | "MIGRATED" | string
  twitter: string | null
  website: string | null
  launchSignature: string | null
  accountKeys: string[]
  numRequiredSigners: number
  uri: string
  dbcPoolKey: string
  dbcConfigKey: string
}

export interface BagsApiResponse {
  success: boolean
  response: BagsTokenRaw[]
}

// ===== Mapped Token for Frontend =====

export interface Token {
  id: string
  name: string
  symbol: string
  description: string
  image: string
  address: string
  status: string
  launchTime: string
  twitter: string | null
  website: string | null
  score?: number
  lastScannedAt?: string
}

export interface TrendingToken {
  rank: number
  name: string
  symbol: string
  address: string
  price: number
  volume24hUSD: number
  liquidity: number
  marketCap: number
  priceChange24h: number
  txns?: number | null
  createdAt: string
  age: string
  score: number
  image?: string | null
}

// ===== API Route Response =====

export interface TokenApiResponse {
  success: boolean
  data: Token[]
  error?: string
  timestamp: string
}

export interface TrendingTokenApiResponse {
  success: boolean
  data: TrendingToken[]
  error?: string
  timestamp: string
}
