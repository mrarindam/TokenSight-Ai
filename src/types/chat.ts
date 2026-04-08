export type ChatRole = "user" | "assistant"

export type ChatLink = {
  href: string
  label: string
  external?: boolean
}

export type ChatResultTone = "success" | "warning" | "info"

export type ChatResult = {
  title: string
  description: string
  tone?: ChatResultTone
}

export type ChatCardTone = ChatResultTone | "neutral"

export type ChatCardMetric = {
  label: string
  value: string
}

export type ChatCard = {
  type: "scan-summary" | "market-overview" | "exchange-listings" | "lp-summary"
  title: string
  subtitle?: string
  tone?: ChatCardTone
  metrics?: ChatCardMetric[]
  badges?: string[]
  links?: ChatLink[]
}

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  links?: ChatLink[]
  results?: ChatResult[]
  cards?: ChatCard[]
}

export type ChatResponse = {
  reply: string
  usedScan: boolean
  tokenAddress: string | null
  links: ChatLink[]
  suggestions: string[]
  results?: ChatResult[]
  cards?: ChatCard[]
}