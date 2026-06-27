import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { Connection, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js"
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, createTransferInstruction } from "@solana/spl-token"

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

    const { paymentAsset, userAddress } = await request.json()
    if (!paymentAsset || !userAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const connection = new Connection(ALCHEMY_RPC, "confirmed")
    const sender = new PublicKey(userAddress)
    const receiver = new PublicKey(RECEIVE_ADDRESS)
    
    const instructions = []

    if (paymentAsset === "SOL") {
      // 1. Fetch live SOL price from Jupiter Price V2 API
      let solPrice = 140 // default fallback
      try {
        const priceRes = await fetch("https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112")
        const priceData = await priceRes.json()
        const fetchedPrice = Number(priceData?.data?.["So11111111111111111111111111111111111111112"]?.price)
        if (fetchedPrice && !Number.isNaN(fetchedPrice)) {
          solPrice = fetchedPrice
        }
      } catch (err) {
        console.warn("[create-transaction] Failed to fetch live SOL price, using fallback:", err)
      }

      const solAmount = 2.00 / solPrice
      const lamports = Math.floor(solAmount * 1e9)

      instructions.push(
        SystemProgram.transfer({
          fromPubkey: sender,
          toPubkey: receiver,
          lamports
        })
      )
    } else if (paymentAsset === "USDC" || paymentAsset === "USDT") {
      const mint = new PublicKey(paymentAsset === "USDC" ? USDC_MINT : USDT_MINT)
      const senderAta = await getAssociatedTokenAddress(mint, sender)
      const receiverAta = await getAssociatedTokenAddress(mint, receiver)

      // Check if receiver ATA exists, if not, add creation instruction
      const receiverAtaInfo = await connection.getAccountInfo(receiverAta)
      if (!receiverAtaInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            sender, // payer
            receiverAta, // associated token address
            receiver, // owner
            mint // mint
          )
        )
      }

      // Add transfer instruction (2.00 with 6 decimals = 2000000)
      instructions.push(
        createTransferInstruction(
          senderAta,
          receiverAta,
          sender,
          2000000
        )
      )
    } else {
      return NextResponse.json({ error: "Unsupported payment asset" }, { status: 400 })
    }

    // Compile message to Versioned Transaction
    const { blockhash } = await connection.getLatestBlockhash("confirmed")
    const messageV0 = new TransactionMessage({
      payerKey: sender,
      recentBlockhash: blockhash,
      instructions
    }).compileToV0Message()

    const transaction = new VersionedTransaction(messageV0)
    const base64 = Buffer.from(transaction.serialize()).toString("base64")

    return NextResponse.json({ transaction: base64 })
  } catch (error: unknown) {
    const err = error as Error
    console.error("[api/billing/create-transaction] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to create transaction" }, { status: 500 })
  }
}
