import type { Token } from "@/types/token"

const BLACKLIST = [
  "ESBCnCXtEZDmX8QnHU6qMZXd9mvjSAZVoYaLKKADBAGS" // BUY THE HAT - Removed by manual request
]

// Extend Next.js global state to keep purely in-memory across dev reloads
/* eslint-disable no-var */
declare global {
  var lowRiskTokens: Token[] | undefined
}
/* eslint-enable no-var */

/**
 * Fetch high-confidence signals from memory.
 * Sort by the order they were added (most recent first).
 */
export function getLowRiskTokens(): Token[] {
  if (!globalThis.lowRiskTokens) {
    globalThis.lowRiskTokens = []
  }
  // Filter out any blacklisted addresses
  return globalThis.lowRiskTokens.filter((t) => !BLACKLIST.includes(t.address))
}

/**
 * Adds a new high-confidence discovery or updates an existing one.
 * Maintain max 30 tokens.
 */
export function addLowRiskToken(token: Token) {
  if (BLACKLIST.includes(token.address)) {
    if (globalThis.lowRiskTokens) {
      globalThis.lowRiskTokens = globalThis.lowRiskTokens.filter(t => t.address !== token.address)
    }
    return
  }

  if (!globalThis.lowRiskTokens) {
    globalThis.lowRiskTokens = []
  }

  const store = globalThis.lowRiskTokens

  // Remove existing instance of this exact address (no duplicates / uniqueness)
  const existingIndex = store.findIndex((t) => t.address === token.address)
  if (existingIndex !== -1) {
    store.splice(existingIndex, 1)
  }

  // Add current timestamp for ordering
  const tokenWithMeta = {
    ...token,
    lastScannedAt: new Date().toISOString()
  }

  // Push latest discovery to the very top
  store.unshift(tokenWithMeta)

  // Capacity Control: Max 30 limit
  if (store.length > 30) {
    store.pop()
  }
}
