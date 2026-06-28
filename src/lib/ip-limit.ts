import { supabaseAdmin } from "./supabaseAdmin"

const WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

interface RateLimitResult {
  success: boolean
  remaining: number
  limit: number
}

/**
 * Checks if an IP has exceeded the given scan limit. If not, increments the count.
 * Resets the 24-hour window if current time is >= window_start_at + 24 hours.
 */
export async function checkAndIncrementIpLimit(ip: string, limit: number): Promise<RateLimitResult> {
  const now = new Date()

  try {
    // Fetch current IP scan record
    const { data, error } = await supabaseAdmin
      .from("ip_scans")
      .select("scan_count, window_start_at")
      .eq("ip_address", ip)
      .maybeSingle()

    if (error) {
      console.error("[IP Rate Limit] Supabase error fetching record:", error)
      // Fallback: allow request in case of DB error
      return { success: true, remaining: 1, limit }
    }

    if (!data) {
      // First scan for this IP, insert record starting at count 1
      const { error: insertError } = await supabaseAdmin
        .from("ip_scans")
        .insert({
          ip_address: ip,
          scan_count: 1,
          window_start_at: now.toISOString()
        })

      if (insertError) {
        console.error("[IP Rate Limit] Supabase error inserting record:", insertError)
      }
      return { success: true, remaining: limit - 1, limit }
    }

    const windowStart = new Date(data.window_start_at)
    const timePassed = now.getTime() - windowStart.getTime()

    if (timePassed >= WINDOW_MS) {
      // 24 hours have passed since the start of the window. Reset window.
      const { error: resetError } = await supabaseAdmin
        .from("ip_scans")
        .update({
          scan_count: 1,
          window_start_at: now.toISOString()
        })
        .eq("ip_address", ip)

      if (resetError) {
        console.error("[IP Rate Limit] Supabase error resetting window:", resetError)
      }
      return { success: true, remaining: limit - 1, limit }
    }

    // Within the active 24-hour window
    if (data.scan_count >= limit) {
      // Limit exceeded
      return { success: false, remaining: 0, limit }
    }

    // Increment count
    const nextCount = data.scan_count + 1
    const { error: updateError } = await supabaseAdmin
      .from("ip_scans")
      .update({
        scan_count: nextCount
      })
      .eq("ip_address", ip)

    if (updateError) {
      console.error("[IP Rate Limit] Supabase error updating scan count:", updateError)
    }

    return { success: true, remaining: limit - nextCount, limit }
  } catch (err) {
    console.error("[IP Rate Limit] Unexpected error in checkAndIncrementIpLimit:", err)
    return { success: true, remaining: 1, limit }
  }
}

/**
 * Gets the remaining scan count for the given IP address.
 * Respects the 24-hour window resetting logic.
 */
export async function getIpRemainingScans(ip: string, limit: number): Promise<number> {
  const now = new Date()

  try {
    const { data, error } = await supabaseAdmin
      .from("ip_scans")
      .select("scan_count, window_start_at")
      .eq("ip_address", ip)
      .maybeSingle()

    if (error || !data) {
      return limit
    }

    const windowStart = new Date(data.window_start_at)
    const timePassed = now.getTime() - windowStart.getTime()

    if (timePassed >= WINDOW_MS) {
      return limit
    }

    return Math.max(0, limit - data.scan_count)
  } catch (err) {
    console.error("[IP Rate Limit] Unexpected error in getIpRemainingScans:", err)
    return limit
  }
}
