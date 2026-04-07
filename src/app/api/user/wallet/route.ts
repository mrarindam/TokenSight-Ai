import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { createClient } from "@supabase/supabase-js"
import nacl from "tweetnacl"
import bs58 from "bs58"

const SIGN_MESSAGE_PREFIX = "TokenSight AI Wallet Verification\n\nSign this message to link your wallet.\nThis does not cost any SOL.\n\nNonce: "

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST — Link wallet (with signature verification)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { address, signature, nonce } = await req.json()

    if (!address || !signature || !nonce) {
      return NextResponse.json({ error: "Missing address, signature, or nonce" }, { status: 400 })
    }

    // Validate address format (base58, 32-44 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      return NextResponse.json({ error: "Invalid Solana address format" }, { status: 400 })
    }

    // Verify Ed25519 signature
    const message = new TextEncoder().encode(SIGN_MESSAGE_PREFIX + nonce)
    const signatureBytes = bs58.decode(signature)
    const publicKeyBytes = bs58.decode(address)

    const isValid = nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes)
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature — wallet ownership not verified" }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()

    // Check if wallet is already linked to another account
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("wallet", address)
      .neq("id", session.user.id)
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json({ error: "This wallet is already linked to another account" }, { status: 409 })
    }

    // Link wallet to current user
    const { error: updateError } = await supabase
      .from("users")
      .update({ wallet: address })
      .eq("id", session.user.id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, wallet: address })
  } catch (err) {
    const error = err as Error
    console.error("[API_WALLET_LINK] Error:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}

// DELETE — Unlink wallet
export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()

    // Don't allow wallet-only users to unlink (they'd lose access)
    const { data: user } = await supabase
      .from("users")
      .select("email, wallet")
      .eq("id", session.user.id)
      .single()

    if (!user?.email && user?.wallet) {
      return NextResponse.json({
        error: "Cannot disconnect wallet — it's your only login method. Link a Google or GitHub account first."
      }, { status: 400 })
    }

    const { error } = await supabase
      .from("users")
      .update({ wallet: null })
      .eq("id", session.user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    const error = err as Error
    console.error("[API_WALLET_UNLINK] Error:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}

// GET — Fetch current wallet for user
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data: user } = await supabase
      .from("users")
      .select("wallet")
      .eq("id", session.user.id)
      .single()

    return NextResponse.json({ wallet: user?.wallet || null })
  } catch (err) {
    const error = err as Error
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
