import { PrivyClient } from "@privy-io/server-auth"

export const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
)

/**
 * Verify Privy auth token from request headers.
 * Returns the Privy user or null if invalid.
 */
export async function verifyPrivyToken(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  try {
    const token = authHeader.slice(7)
    const verifiedClaims = await privyClient.verifyAuthToken(token)
    return verifiedClaims
  } catch {
    return null
  }
}

/**
 * Verify Privy auth token from a raw token string (e.g. from cookies).
 */
export async function verifyPrivyTokenString(token: string) {
  try {
    return await privyClient.verifyAuthToken(token)
  } catch {
    return null
  }
}
