import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const url = new URL("/media/scan-demo.mp4", request.url)
  return NextResponse.redirect(url, 307)
}