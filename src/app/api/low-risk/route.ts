import { NextResponse } from "next/server"
import { getLowRiskTokens } from "@/lib/lowRiskStore"
import type { TokenApiResponse } from "@/types/token"

export async function GET() {
  try {
    const tokens = getLowRiskTokens()

    return NextResponse.json<TokenApiResponse>(
      {
        success: true,
        data: tokens,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[api/low-risk] Failed to fetch low risk tokens:", error)
    return NextResponse.json<TokenApiResponse>(
      {
        success: false,
        data: [],
        error: "Failed to load low risk tokens",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
