import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { scanRateLimiter, userScanRateLimiter } from "@/lib/redis"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (authUser?.id) {
      // Check if user is premium
      const { data: dbUser } = await supabaseAdmin
        .from("users")
        .select("is_premium")
        .eq("id", authUser.id)
        .maybeSingle()
      
      const isPremium = dbUser?.is_premium || false
      if (isPremium) {
        return NextResponse.json({ authenticated: true, isPremium: true, remaining: 99999 })
      }
      
      if (userScanRateLimiter) {
        const { remaining } = await userScanRateLimiter.getRemaining(authUser.id)
        return NextResponse.json({ authenticated: true, isPremium: false, remaining })
      }
      
      return NextResponse.json({ authenticated: true, isPremium: false, remaining: 10 })
    }

    if (scanRateLimiter) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
                 request.headers.get("x-real-ip") || 
                 "127.0.0.1"
      
      const { remaining } = await scanRateLimiter.getRemaining(ip)
      return NextResponse.json({ authenticated: false, isPremium: false, remaining })
    }

    // Safe fallback if Redis is not configured in local environment
    return NextResponse.json({ authenticated: false, isPremium: false, remaining: 5 })
  } catch (error) {
    console.error("[api/scan/limit] GET error:", error)
    return NextResponse.json({ error: "Failed to load scan limit" }, { status: 500 })
  }
}
