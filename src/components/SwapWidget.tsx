"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { connectAndSign, signAndSendSwapTransaction, getPhantomProvider } from "@/lib/wallet"
import {
  ArrowLeftRight,
  Shield,
  ChevronDown,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Wallet,
  Zap,
  Link2,
  CheckCircle2,
} from "lucide-react"

interface SwapWidgetProps {
  tokenAddress: string
  tokenSymbol?: string
}

const SOL_MINT = "So11111111111111111111111111111111111111112"
const SLIPPAGE_OPTIONS = [
  { label: "0.5%", value: 50 },
  { label: "1%", value: 100 },
  { label: "2%", value: 200 },
  { label: "5%", value: 500 },
] as const

interface QuoteData {
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  priceImpact?: number
  priceImpactPct?: string
  routePlan?: { swapInfo: { label: string } }[]
  slippageBps: number
  otherAmountThreshold?: string
  requestId?: string
  transaction?: string | null
  lastValidBlockHeight?: string
}

export function SwapWidget({ tokenAddress, tokenSymbol }: SwapWidgetProps) {
  const { data: session, update: updateSession } = useSession()
  const [solAmount, setSolAmount] = useState("")
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [isQuoting, setIsQuoting] = useState(false)
  const [quoteError, setQuoteError] = useState("")
  const [slippage, setSlippage] = useState(100) // 1% default
  const [showSlippage, setShowSlippage] = useState(false)
  const [solPrice, setSolPrice] = useState<number | null>(null)
  const [isLinking, setIsLinking] = useState(false)
  const [linkError, setLinkError] = useState("")
  const [isSwapping, setIsSwapping] = useState(false)
  const [swapError, setSwapError] = useState("")
  const [swapTxHash, setSwapTxHash] = useState("")

  const walletAddress = session?.user?.wallet || null
  const isLoggedIn = !!session?.user

  // Fetch SOL price once (via proxy to avoid CORS)
  useEffect(() => {
    fetch("/api/swap?action=price")
      .then(res => res.json())
      .then(data => {
        if (data?.price) setSolPrice(data.price)
      })
      .catch(() => {})
  }, [])

  // Fetch Jupiter quote
  const fetchQuote = useCallback(async () => {
    if (!solAmount || parseFloat(solAmount) <= 0) {
      setQuote(null)
      return
    }

    setIsQuoting(true)
    setQuoteError("")

    try {
      const lamports = Math.round(parseFloat(solAmount) * 1e9)
      const params = new URLSearchParams({
        action: "quote",
        inputMint: SOL_MINT,
        outputMint: tokenAddress,
        amount: lamports.toString(),
        slippageBps: slippage.toString(),
      })

      const res = await fetch(`/api/swap?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Quote failed (${res.status})`)
      }

      const data = await res.json()
      setQuote(data)
    } catch (err) {
      const error = err as Error
      setQuoteError(error.message || "Failed to get quote")
      setQuote(null)
    } finally {
      setIsQuoting(false)
    }
  }, [solAmount, tokenAddress, slippage])

  // Debounced quote fetch
  useEffect(() => {
    if (!solAmount || parseFloat(solAmount) <= 0) {
      setQuote(null)
      return
    }

    const timer = setTimeout(fetchQuote, 500)
    return () => clearTimeout(timer)
  }, [solAmount, fetchQuote])

  const formatOutputAmount = (raw: string, decimals = 6) => {
    const num = parseInt(raw) / Math.pow(10, decimals)
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`
    return num.toFixed(4)
  }

  const priceImpact = quote
    ? (quote.priceImpact != null ? Math.abs(quote.priceImpact * 100) : (quote.priceImpactPct ? parseFloat(quote.priceImpactPct) : 0))
    : 0
  const isPriceImpactHigh = priceImpact > 3
  const routeLabels = quote?.routePlan?.map(r => r.swapInfo?.label).filter(Boolean) || []

  // Execute on-site swap via Jupiter V2 /order + Phantom signAndSendTransaction
  const executeSwap = async () => {
    if (!quote || !walletAddress) return
    setIsSwapping(true)
    setSwapError("")
    setSwapTxHash("")

    try {
      // Ensure Phantom is connected
      const provider = getPhantomProvider()
      if (!provider) throw new Error("Phantom wallet not found. Please install Phantom.")
      if (!provider.isConnected) await provider.connect()

      // Step 1: Get order with transaction from Jupiter
      const lamports = Math.round(parseFloat(solAmount) * 1e9)
      const orderParams = new URLSearchParams({
        action: "order",
        inputMint: SOL_MINT,
        outputMint: tokenAddress,
        amount: lamports.toString(),
        slippageBps: slippage.toString(),
        taker: walletAddress,
      })

      const orderRes = await fetch(`/api/swap?${orderParams}`)
      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}))
        throw new Error(err.error || err.errorMessage || `Order failed (${orderRes.status})`)
      }

      const orderData = await orderRes.json()
      if (!orderData.transaction) {
        throw new Error(orderData.errorMessage || "No transaction returned from Jupiter")
      }

      // Step 2: Sign and send via Phantom (handles both in one step)
      const signature = await signAndSendSwapTransaction(orderData.transaction)
      setSwapTxHash(signature)
    } catch (err) {
      const error = err as Error
      if (error.message?.includes("User rejected") || error.message?.includes("user rejected")) {
        setSwapError("Transaction rejected by user")
      } else {
        setSwapError(error.message || "Swap failed")
      }
    } finally {
      setIsSwapping(false)
    }
  }

  // Generate Phantom deep link for the swap
  const getPhantomSwapUrl = () => {
    return `https://phantom.app/ul/swap/${SOL_MINT}/${tokenAddress}?amount=${solAmount}`
  }

  // Generate Jupiter direct link as fallback
  const getJupiterSwapUrl = () => {
    const amount = solAmount ? `&amount=${Math.round(parseFloat(solAmount) * 1e9)}` : ""
    return `https://jup.ag/swap/SOL-${tokenAddress}?slippage=${slippage / 100}${amount}`
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 bg-muted/5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Swap — Buy {tokenSymbol || "Token"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
            <Shield className="h-2.5 w-2.5" />
            MEV Protected
          </div>
          <button
            onClick={() => setShowSlippage(!showSlippage)}
            className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground bg-muted/30 px-2 py-1 rounded-full hover:text-foreground transition-colors"
          >
            Slippage: {slippage / 100}%
            <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", showSlippage && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Slippage Settings */}
      {showSlippage && (
        <div className="px-4 py-3 border-b border-border/20 bg-muted/5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground">Slippage Tolerance:</span>
            <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5">
              {SLIPPAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSlippage(opt.value)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all duration-200",
                    slippage === opt.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Swap Body */}
      <div className="p-4 space-y-4">
        {/* Input: SOL */}
        <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">You Pay</span>
            {solPrice && solAmount && parseFloat(solAmount) > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground">
                ≈ ${(parseFloat(solAmount) * solPrice).toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={solAmount}
              onChange={(e) => setSolAmount(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.01"
              className="flex-1 bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 border border-border/20">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
              <span className="text-sm font-bold">SOL</span>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            {[0.1, 0.5, 1, 2].map(amt => (
              <button
                key={amt}
                onClick={() => setSolAmount(amt.toString())}
                className="text-[10px] font-bold text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-md hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                {amt} SOL
              </button>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <div className="p-2 rounded-lg bg-muted/30 border border-border/20">
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Output: Token */}
        <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">You Receive</span>
            {isPriceImpactHigh && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                <AlertTriangle className="h-2.5 w-2.5" />
                {priceImpact.toFixed(2)}% impact
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-2xl font-bold">
              {isQuoting ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : quote ? (
                <span>{formatOutputAmount(quote.outAmount)}</span>
              ) : (
                <span className="text-muted-foreground/30">0.0</span>
              )}
            </div>
            <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 border border-border/20">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-primary/50" />
              <span className="text-sm font-bold truncate max-w-[80px]">{tokenSymbol || "TOKEN"}</span>
            </div>
          </div>
        </div>

        {/* Quote Details */}
        {quote && (
          <div className="rounded-xl bg-muted/10 border border-border/20 p-3 space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground font-medium">Route</span>
              <span className="font-bold text-foreground/80">{routeLabels.join(" → ") || "Direct"}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground font-medium">Price Impact</span>
              <span className={cn("font-bold", isPriceImpactHigh ? "text-amber-500" : "text-foreground/80")}>
                {priceImpact.toFixed(4)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground font-medium">Min Received (after slippage)</span>
              <span className="font-bold text-foreground/80">
                {formatOutputAmount(
                  Math.floor(parseInt(quote.outAmount) * (1 - slippage / 10000)).toString()
                )} {tokenSymbol || ""}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground font-medium">MEV Protection</span>
              <span className="font-bold text-emerald-500 flex items-center gap-1">
                <Shield className="h-2.5 w-2.5" /> Enabled
              </span>
            </div>
          </div>
        )}

        {quoteError && (
          <div className="flex items-center gap-2 text-[11px] font-medium text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            {quoteError}
          </div>
        )}

        {/* Swap Buttons */}
        <div className="space-y-2">
          {!isLoggedIn ? (
            /* Not logged in at all */
            <a
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm bg-muted/30 text-muted-foreground border border-border/30 hover:border-primary/30 hover:text-foreground transition-all duration-300"
            >
              <Wallet className="h-4 w-4" />
              Sign in to Swap
            </a>
          ) : !walletAddress ? (
            /* Logged in but no wallet linked */
            <div className="space-y-2">
              <button
                onClick={async () => {
                  setIsLinking(true)
                  setLinkError("")
                  try {
                    const result = await connectAndSign()
                    if (!result) { setLinkError("Connection cancelled"); return }
                    const res = await fetch("/api/user/wallet", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(result),
                    })
                    const data = await res.json()
                    if (!res.ok) { setLinkError(data.error || "Failed to link wallet"); return }
                    await updateSession()
                  } catch (err) {
                    setLinkError((err as Error).message || "Failed")
                  } finally {
                    setIsLinking(false)
                  }
                }}
                disabled={isLinking}
                className={cn(
                  "flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300",
                  "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/25",
                  isLinking && "opacity-70 cursor-not-allowed"
                )}
              >
                {isLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {isLinking ? "Verifying Wallet..." : "Connect Wallet to Swap"}
              </button>
              {linkError && (
                <div className="flex items-center gap-2 text-[10px] font-medium text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                  <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0" /> {linkError}
                </div>
              )}
              {/* Still allow Jupiter as fallback */}
              <a
                href={getJupiterSwapUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-xs text-muted-foreground bg-muted/20 border border-border/30 hover:text-foreground hover:border-primary/30 transition-all duration-200"
              >
                <Zap className="h-3.5 w-3.5" />
                Open in Jupiter (no wallet needed)
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            </div>
          ) : (
            /* Wallet connected — full swap flow */
            <>
              {/* Connected wallet badge */}
              <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-emerald-500 bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/20 mb-1">
                <Wallet className="h-3 w-3" />
                {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
              </div>

              {/* Success message */}
              {swapTxHash && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                  <span>Swap successful!</span>
                  <a
                    href={`https://solscan.io/tx/${swapTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-emerald-400 ml-auto flex items-center gap-1"
                  >
                    View tx <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              )}

              {/* Swap error */}
              {swapError && (
                <div className="flex items-center gap-2 text-[10px] font-medium text-red-500 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  {swapError}
                </div>
              )}

              {/* Primary: On-site swap via Phantom */}
              <button
                onClick={executeSwap}
                disabled={!quote || isSwapping}
                className={cn(
                  "flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300",
                  quote && !isSwapping
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 cursor-pointer"
                    : "bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50"
                )}
              >
                {isSwapping ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Confirming in Phantom...</>
                ) : (
                  <><Wallet className="h-4 w-4" /> Swap with Phantom</>
                )}
              </button>

              {/* Secondary: External fallbacks */}
              <div className="flex gap-2">
                <a
                  href={getPhantomSwapUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl font-bold text-[10px] text-muted-foreground bg-muted/20 border border-border/30 hover:text-foreground hover:border-primary/30 transition-all duration-200"
                >
                  <Wallet className="h-3 w-3" />
                  Phantom App
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </a>
                <a
                  href={getJupiterSwapUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl font-bold text-[10px] text-muted-foreground bg-muted/20 border border-border/30 hover:text-foreground hover:border-primary/30 transition-all duration-200"
                >
                  <Zap className="h-3 w-3" />
                  Jupiter
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </a>
              </div>
            </>
          )}
        </div>

        {/* Safety Notice */}
        <div className="text-center">
          <p className="text-[9px] text-muted-foreground/50 font-medium leading-relaxed">
            Swaps are executed through Jupiter Aggregator with MEV protection enabled.
            Always verify the token address before swapping. DYOR.
          </p>
        </div>
      </div>
    </div>
  )
}
