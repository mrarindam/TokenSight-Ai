import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { Connection, PublicKey } from "@solana/web3.js"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { deleteCached } from "@/lib/redis"

const ALCHEMY_RPC = "https://solana-mainnet.g.alchemy.com/v2/rYsplRw2ibwtvTWHIXDzD1MMod-1JEys"
const RECEIVE_ADDRESS = "sqdEggf9VKR6GNUFpvEMgovCeHk2JfBzbzXSy8MmB8Z"
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { signature, paymentAsset } = await request.json()
    if (!signature || !paymentAsset) {
      return NextResponse.json({ error: "Missing signature or paymentAsset" }, { status: 400 })
    }

    const connection = new Connection(ALCHEMY_RPC, "confirmed")
    
    // Fetch transaction details from Solana Mainnet
    // Retry up to 3 times to account for transaction propagation/indexing lag
    let tx = null
    for (let i = 0; i < 3; i++) {
      tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0
      })
      if (tx) break
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found on-chain. Please wait a few seconds and try again." }, { status: 404 })
    }

    // Ensure transaction executed successfully
    if (tx.meta?.err) {
      return NextResponse.json({ error: "Transaction execution failed on Solana" }, { status: 400 })
    }

    let verified = false

    // 1. First Check: Parse transaction instructions (robustly supports self-transfers)
    const instructions = tx.transaction.message.instructions
    for (const inst of instructions) {
      const parsedInst = inst as unknown as {
        program?: string;
        parsed?: {
          type?: string;
          info?: {
            destination?: string;
            lamports?: string | number;
            amount?: string | number;
            tokenAmount?: {
              amount?: string | number;
            };
          };
        };
      }
      
      // SOL Transfer Check
      if (parsedInst.program === "system" && parsedInst.parsed?.type === "transfer") {
        const info = parsedInst.parsed.info
        if (info?.destination === RECEIVE_ADDRESS && paymentAsset === "SOL") {
          const lamports = Number(info.lamports)
          let solPrice = 140
          try {
            const priceRes = await fetch("https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112")
            const priceData = await priceRes.json()
            const fetchedPrice = Number(priceData?.data?.["So11111111111111111111111111111111111111112"]?.price)
            if (fetchedPrice && !Number.isNaN(fetchedPrice)) {
              solPrice = fetchedPrice
            }
          } catch {}

          const usdReceived = (lamports / 1e9) * solPrice
          if (usdReceived >= 1.9) {
            verified = true
            break
          }
        }
      }
      // Token Transfer Check (USDC or USDT)
      else if (parsedInst.program === "spl-token" && (parsedInst.parsed?.type === "transfer" || parsedInst.parsed?.type === "transferChecked")) {
        const info = parsedInst.parsed.info
        const amount = Number(info?.amount || info?.tokenAmount?.amount || 0)
        
        const mint = new PublicKey(paymentAsset === "USDC" ? USDC_MINT : USDT_MINT)
        const receiver = new PublicKey(RECEIVE_ADDRESS)
        
        // Find expected receiver Associated Token Account address
        const expectedReceiverAta = PublicKey.findProgramAddressSync(
          [
            receiver.toBuffer(),
            new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toBuffer(),
            mint.toBuffer()
          ],
          new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
        )[0].toString()

        if (info?.destination === expectedReceiverAta && amount >= 1980000) {
          verified = true
          break
        }
      }
    }

    // 2. Second Check Fallback: Balance difference checks (standard external transfers)
    if (!verified) {
      if (paymentAsset === "SOL") {
        const receiverIndex = tx.transaction.message.accountKeys.findIndex(
          (key) => key.pubkey.toString() === RECEIVE_ADDRESS
        )
        if (receiverIndex !== -1) {
          const preBalance = tx.meta?.preBalances[receiverIndex] || 0
          const postBalance = tx.meta?.postBalances[receiverIndex] || 0
          const difference = (postBalance - preBalance) / 1e9

          let solPrice = 140
          try {
            const priceRes = await fetch("https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112")
            const priceData = await priceRes.json()
            const fetchedPrice = Number(priceData?.data?.["So11111111111111111111111111111111111111112"]?.price)
            if (fetchedPrice && !Number.isNaN(fetchedPrice)) {
              solPrice = fetchedPrice
            }
          } catch {}

          const usdReceived = difference * solPrice
          if (usdReceived >= 1.9) {
            verified = true
          }
        }
      } else if (paymentAsset === "USDC" || paymentAsset === "USDT") {
        const mint = paymentAsset === "USDC" ? USDC_MINT : USDT_MINT
        
        const preBalance = tx.meta?.preTokenBalances?.find(
          (b) => b.owner === RECEIVE_ADDRESS && b.mint === mint
        )?.uiTokenAmount?.uiAmount || 0

        const postBalance = tx.meta?.postTokenBalances?.find(
          (b) => b.owner === RECEIVE_ADDRESS && b.mint === mint
        )?.uiTokenAmount?.uiAmount || 0

        const difference = postBalance - preBalance

        if (difference >= 1.98) {
          verified = true
        }
      }
    }

    if (!verified) {
      return NextResponse.json({ error: "Payment verification failed: recipient did not receive correct amount of tokens/SOL" }, { status: 400 })
    }

    // Mark user as Premium in Supabase DB
    const { error: dbError } = await supabaseAdmin
      .from("users")
      .update({ is_premium: true })
      .eq("id", authUser.id)

    if (dbError) {
      console.error("[verify-transaction] DB Error:", dbError)
      return NextResponse.json({ error: "Payment verified, but database update failed: " + dbError.message }, { status: 500 })
    }

    // Invalidate Redis profile cache to instantly reflect changes
    const cacheKey = `user_profile:${authUser.id}`
    await deleteCached(cacheKey)

    return NextResponse.json({ success: true, isPremium: true })
  } catch (error: unknown) {
    const err = error as Error
    console.error("[api/billing/verify-transaction] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to verify transaction" }, { status: 500 })
  }
}
