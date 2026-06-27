import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/"/g, "")?.trim()
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.replace(/"/g, "")?.trim()

export const redis = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null

export const scanRateLimiter = redis
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(5, "1 d"),
      prefix: "ratelimit:scan",
    })
  : null

export const userScanRateLimiter = redis
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(10, "1 d"),
      prefix: "ratelimit:scan:user",
    })
  : null

export async function getCached<T>(key: string): Promise<T | null> {
  if (!redis) return null
  try {
    return await redis.get<T>(key)
  } catch (error) {
    console.error(`[Redis] Error getting key ${key}:`, error)
    return null
  }
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (!redis) return
  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch (error) {
    console.error(`[Redis] Error setting key ${key}:`, error)
  }
}

export async function deleteCached(key: string): Promise<void> {
  if (!redis) return
  try {
    await redis.del(key)
  } catch (error) {
    console.error(`[Redis] Error deleting key ${key}:`, error)
  }
}
