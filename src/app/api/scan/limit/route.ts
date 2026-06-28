import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { getIpRemainingScans } from "@/lib/ip-limit"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const ip = request.headers.get("cf-connecting-ip") || 
               request.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
               request.headers.get("x-real-ip") || 
               "127.0.0.1"

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
      
      // Logged-in non-premium users get a limit of 10 scans per IP
      const remaining = await getIpRemainingScans(ip, 10)
      return NextResponse.json({ authenticated: true, isPremium: false, remaining })
    }

    // Anonymous users get a limit of 5 scans per IP
    const remaining = await getIpRemainingScans(ip, 5)
    return NextResponse.json({ authenticated: false, isPremium: false, remaining })
  } catch (error) {
    console.error("[api/scan/limit] GET error:", error)
    return NextResponse.json({ error: "Failed to load scan limit" }, { status: 500 })
  }
}
