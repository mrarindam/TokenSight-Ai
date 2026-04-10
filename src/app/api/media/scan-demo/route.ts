import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"

export const runtime = "nodejs"

export async function GET() {
  try {
    const videoPath = path.join(process.cwd(), "src", "app", "video", "scan.mp4")
    const fileBuffer = await readFile(videoPath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(fileBuffer.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error("[api/media/scan-demo] Failed to load scan video:", error)
    return NextResponse.json({ error: "Scan demo video unavailable" }, { status: 404 })
  }
}