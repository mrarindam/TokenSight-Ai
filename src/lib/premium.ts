import { supabaseAdmin } from "./supabaseAdmin"
import { deleteCached } from "./redis"

export type UserPremiumRecord = {
  is_premium?: boolean | null
  premium_expires_at?: string | null
}

/**
 * Calculates the expiration timestamp for a 30-day (1 month) subscription starting now.
 */
export function getSubscriptionExpirationDate(days: number = 30): string {
  const expires = new Date()
  expires.setDate(expires.getDate() + days)
  return expires.toISOString()
}

/**
 * Evaluates whether a user currently has an active Premium subscription.
 * If the user's `premium_expires_at` has passed (or is missing for legacy expired users),
 * it auto-downgrades `is_premium` to false in Supabase and invalidates the Redis profile cache.
 */
export async function checkAndUpdatePremiumStatus(
  userId: string,
  userRecord: UserPremiumRecord
): Promise<{ isPremium: boolean; expiresAt: string | null }> {
  const isPremium = !!userRecord.is_premium
  const expiresAt = userRecord.premium_expires_at || null

  if (!isPremium) {
    return { isPremium: false, expiresAt: null }
  }

  const now = Date.now()

  // 1. If expiresAt exists and is in the past -> expire subscription
  if (expiresAt && new Date(expiresAt).getTime() <= now) {
    console.log(`[PREMIUM AUTO-EXPIRY] Subscription for user ${userId} expired on ${expiresAt}. Resetting is_premium to false.`)
    await expirePremiumUser(userId)
    return { isPremium: false, expiresAt: null }
  }

  // 2. If is_premium is true but premium_expires_at is NULL (legacy active subscription record without expiry date)
  if (isPremium && !expiresAt) {
    console.log(`[PREMIUM NOTICE] User ${userId} has active premium without premium_expires_at. Setting default 30-day window.`)
    const defaultExpiry = getSubscriptionExpirationDate(30)
    const { error: updateErr } = await supabaseAdmin
      .from("users")
      .update({ premium_expires_at: defaultExpiry })
      .eq("id", userId)

    if (updateErr) {
      console.error("[PREMIUM Error] Failed to update missing premium_expires_at:", updateErr)
    }

    return { isPremium: true, expiresAt: defaultExpiry }
  }

  return { isPremium: true, expiresAt }
}

/**
 * Helper to update database and clear cache when subscription expires
 */
export async function expirePremiumUser(userId: string) {
  try {
    const { error } = await supabaseAdmin
      .from("users")
      .update({
        is_premium: false,
        premium_expires_at: null
      })
      .eq("id", userId)

    if (error) {
      console.error(`[PREMIUM Error] Failed to reset premium status for user ${userId}:`, error)
    }

    // Invalidate Redis profile cache to instantly reflect non-premium status
    await deleteCached(`user_profile:${userId}`).catch(() => {})
  } catch (err) {
    console.error(`[PREMIUM Exception] Error expiring user ${userId}:`, err)
  }
}
