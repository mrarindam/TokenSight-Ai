import { supabaseAdmin } from "./supabaseAdmin"
import { deleteCached } from "./redis"

export type UserPremiumRecord = {
  id?: string
  email?: string | null
  privy_id?: string | null
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
 * Synchronizes active premium status from sibling duplicate accounts (matching email or privy_id)
 * onto the current active user ID.
 */
export async function syncUserPremiumFromSiblings(
  userId: string,
  email?: string | null,
  privyId?: string | null
): Promise<{ isPremium: boolean; expiresAt: string | null }> {
  if (!email && !privyId) return { isPremium: false, expiresAt: null }

  try {
    let query = supabaseAdmin
      .from("users")
      .select("id, is_premium, premium_expires_at")
      .eq("is_premium", true)

    if (email && privyId) {
      query = query.or(`email.eq.${email},privy_id.eq.${privyId}`)
    } else if (email) {
      query = query.eq("email", email)
    } else if (privyId) {
      query = query.eq("privy_id", privyId)
    }

    const { data: activeSiblings } = await query.limit(1)

    if (activeSiblings && activeSiblings.length > 0) {
      const activeSibling = activeSiblings[0]
      const expiresAt = activeSibling.premium_expires_at || getSubscriptionExpirationDate(30)

      console.log(`[PREMIUM SYNC] Copying active premium status to user ${userId} from sibling ${activeSibling.id}`)

      await supabaseAdmin
        .from("users")
        .update({
          is_premium: true,
          premium_expires_at: expiresAt
        })
        .eq("id", userId)

      await deleteCached(`user_profile:${userId}`).catch(() => {})

      return { isPremium: true, expiresAt }
    }
  } catch (err) {
    console.error(`[PREMIUM SYNC ERROR] Failed to sync sibling premium for user ${userId}:`, err)
  }

  return { isPremium: false, expiresAt: null }
}

/**
 * Evaluates whether a user currently has an active Premium subscription.
 * If the user's `premium_expires_at` has passed, it auto-downgrades.
 * If current user has is_premium: false, checks if sibling accounts (same email/privy_id) have active premium!
 */
export async function checkAndUpdatePremiumStatus(
  userId: string,
  userRecord: UserPremiumRecord
): Promise<{ isPremium: boolean; expiresAt: string | null }> {
  const isPremium = !!userRecord.is_premium
  const expiresAt = userRecord.premium_expires_at || null

  if (!isPremium) {
    // Attempt fallback check: Does any duplicate account of this user have active premium?
    if (userRecord.email || userRecord.privy_id) {
      const synced = await syncUserPremiumFromSiblings(userId, userRecord.email, userRecord.privy_id)
      if (synced.isPremium) {
        return synced
      }
    }
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
