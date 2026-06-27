"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { usePrivy } from "@privy-io/react-auth"
import { useAuthFetch } from "@/lib/useAuthFetch"
import { Check, Sparkles, Loader2, ArrowLeft, Lock, X, Wallet, Coins } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { connectAndSign, signAndSendSwapTransaction, getPhantomProvider } from "@/lib/wallet"

export default function PricingPage() {
  const { ready, authenticated, login } = usePrivy()
  const authFetch = useAuthFetch()
  const router = useRouter()

  const [isLoadingUser, setIsLoadingUser] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<"select" | "processing" | "success">("select")
  
  // Solana Pay states
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null)
  const [isConnectingWallet, setIsConnectingWallet] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<"SOL" | "USDC" | "USDT" | null>(null)
  
  // SOL pricing estimate state (approx based on live price)
  const [estimatedSolPrice, setEstimatedSolPrice] = useState<number>(0.04)
  const [errorMsg, setErrorMsg] = useState("")

  const fetchSolConversion = useCallback(async () => {
    try {
      const jupRes = await fetch("https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112")
      const jupData = await jupRes.json()
      const liveSolPrice = Number(jupData?.data?.["So11111111111111111111111111111111111111112"]?.price || 140)
      setEstimatedSolPrice(2.00 / liveSolPrice)
    } catch (err) {
      console.error("Failed to query SOL price conversion on-chain:", err)
    }
  }, [])

  // Check active browser Phantom wallet session (like jup.ag)
  const checkActiveWallet = useCallback(async () => {
    const provider = getPhantomProvider()
    if (provider && provider.isConnected && provider.publicKey) {
      const activeAddress = provider.publicKey.toString()
      setConnectedWallet(activeAddress)
      void fetchSolConversion()
      return activeAddress
    }
    return null
  }, [fetchSolConversion])

  useEffect(() => {
    // Initial check on load
    void checkActiveWallet()

    if (ready && authenticated) {
      setIsLoadingUser(true)
      authFetch("/api/user/me")
        .then((res) => res.json())
        .then((data) => {
          if (data?.user?.is_premium) {
            setIsPremium(true)
          }
          // Only fallback to DB wallet if no active provider is connected
          if (data?.user?.wallet) {
            const provider = getPhantomProvider()
            if (!provider || !provider.isConnected) {
              setConnectedWallet(data.user.wallet)
              void fetchSolConversion()
            }
          }
        })
        .catch((err) => console.error("Error loading user profile status:", err))
        .finally(() => setIsLoadingUser(false))
    }
  }, [ready, authenticated, authFetch, checkActiveWallet, fetchSolConversion, connectedWallet])

  const handleUpgradeClick = async () => {
    if (!authenticated) {
      login()
      return
    }
    setCheckoutStep("select")
    setSelectedAsset(null)
    setErrorMsg("")
    setShowCheckoutModal(true)

    // Check active browser connection before loading checkout
    const activeAddr = await checkActiveWallet()
    if (!activeAddr && connectedWallet) {
      void fetchSolConversion()
    }
  }

  const handleConnectWallet = async () => {
    setIsConnectingWallet(true)
    setErrorMsg("")
    try {
      const result = await connectAndSign()
      if (!result) {
        throw new Error("Wallet connection was cancelled or Phantom is not installed")
      }

      // Link wallet to current profile (Gmail/Twitter/Github) using existing API logic
      const res = await authFetch("/api/user/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to link wallet to your profile")
      }

      setConnectedWallet(result.address)
      await fetchSolConversion()
    } catch (err: unknown) {
      const error = err as Error
      setErrorMsg(error.message || "Failed to connect wallet")
    } finally {
      setIsConnectingWallet(false)
    }
  }

  const handlePaymentSubmit = async () => {
    if (!selectedAsset || !connectedWallet) {
      setErrorMsg("Please select a payment asset and connect your wallet.")
      return
    }
    setCheckoutStep("processing")
    setErrorMsg("")

    try {
      // 1. Request transaction assembly from backend
      const createRes = await authFetch("/api/billing/create-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentAsset: selectedAsset,
          userAddress: connectedWallet
        })
      })

      const createData = await createRes.json()
      if (!createRes.ok) {
        throw new Error(createData.error || "Failed to create checkout transaction")
      }

      // 2. Trigger transaction signing via connected wallet provider
      const signature = await signAndSendSwapTransaction(createData.transaction)
      if (!signature) {
        throw new Error("Transaction cancelled or rejected by wallet")
      }

      // 3. Verify transaction on-chain on the backend
      const verifyRes = await authFetch("/api/billing/verify-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature,
          paymentAsset: selectedAsset
        })
      })

      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "On-chain verification failed. Please check Solscan.")
      }

      setCheckoutStep("success")
      setIsPremium(true)
      
      // Auto redirect to scan page on success
      setTimeout(() => {
        router.push("/scan")
        router.refresh()
      }, 2500)
    } catch (err: unknown) {
      const error = err as Error
      setErrorMsg(error.message || "Transaction signature or verification failed.")
      setCheckoutStep("select")
    }
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground py-16 px-4 md:px-8">
      {/* Background glow node */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto space-y-12">
        {/* Navigation link back to dashboard */}
        <div className="flex justify-start">
          <Link
            href="/scan"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors duration-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to scanner
          </Link>
        </div>

        {/* Pricing page headers */}
        <div className="text-center space-y-4 max-w-xl mx-auto">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/80">Premium Access Plans</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground uppercase">
            Choose Your <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">Intelligence Tier</span>
          </h1>
          <p className="text-muted-foreground text-sm font-medium leading-relaxed">
            Upgrade your account to unlock professional Solana contract analysis features, custom alerts, and AI-powered copilot assistance.
          </p>
        </div>

        {/* Comparison Tier Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-6">
          {/* FREE PLAN */}
          <div className="relative rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-6 md:p-8 flex flex-col justify-between shadow-[0_0_15px_-3px_rgba(0,0,0,0.1)]">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Free Tier</h3>
                <p className="text-xs text-muted-foreground">Standard access level for everyday hobbyists.</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">$0</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">/ Month</span>
              </div>

              <div className="border-t border-border/10 pt-6 space-y-4">
                {[
                  "10 token scans per 24 hours",
                  "Save up to 2 portfolio items",
                  "Create up to 2 active price alerts",
                  "Basic token metrics evaluation",
                ].map((feat) => (
                  <div key={feat} className="flex items-start gap-3 text-xs font-semibold text-muted-foreground/80">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
                
                {[
                  "Sight AI chat copilot disabled",
                  "No priority node support",
                ].map((feat) => (
                  <div key={feat} className="flex items-start gap-3 text-xs font-semibold text-muted-foreground/45">
                    <Lock className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground/30" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border/10">
              {ready && authenticated && !isPremium ? (
                <div className="w-full text-center py-3 text-xs font-black uppercase tracking-widest bg-muted/40 rounded-xl text-muted-foreground border border-border/20">
                  Current Active Plan
                </div>
              ) : (
                <div className="w-full text-center py-3 text-xs font-black uppercase tracking-widest bg-muted/20 rounded-xl text-muted-foreground/60 border border-border/10">
                  Standard Access Plan
                </div>
              )}
            </div>
          </div>

          {/* PREMIUM PLAN */}
          <div className="relative rounded-2xl border border-purple-500/30 bg-card/60 backdrop-blur-xl p-6 md:p-8 flex flex-col justify-between shadow-[0_0_20px_-3px_rgba(147,51,234,0.15)]">
            {/* Glowing top line decorator */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                    Premium <Sparkles className="h-4.5 w-4.5 text-purple-400" />
                  </h3>
                  <p className="text-xs text-muted-foreground">For serious researchers and on-chain traders.</p>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full shrink-0">
                  Popular
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">$2</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">/ Month</span>
              </div>

              <div className="border-t border-border/10 pt-6 space-y-4">
                {[
                  "1,000+ token scans per 24 hours",
                  "Full Sight AI Chat Copilot access",
                  "Unlimited portfolio items adding",
                  "Unlimited price & score alerts",
                  "Instant alert notifications via Telegram",
                ].map((feat) => (
                  <div key={feat} className="flex items-start gap-3 text-xs font-semibold text-foreground/90">
                    <Check className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border/10">
              {isPremium ? (
                <div className="w-full text-center py-3 text-xs font-black uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl">
                  Premium Active Plan
                </div>
              ) : (
                <button
                  onClick={handleUpgradeClick}
                  disabled={isLoadingUser}
                  className="w-full py-3.5 text-xs font-black uppercase tracking-widest bg-gradient-to-r from-primary to-purple-600 hover:from-primary/95 hover:to-purple-600/95 text-white rounded-xl shadow-lg shadow-purple-600/10 hover:shadow-purple-600/25 transition-all duration-300"
                >
                  {isLoadingUser ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "UPGRADE TO PREMIUM"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subscription / Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 md:p-8 shadow-2xl space-y-6">
            <button
              onClick={() => setShowCheckoutModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {checkoutStep === "select" && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                    <Coins className="h-5 w-5 text-primary" /> Solana Pay
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Complete your checkout on Solana Mainnet. Funds are sent directly to recipient receiver address.
                  </p>
                </div>

                {/* Connection Box Check */}
                {!connectedWallet ? (
                  <div className="p-5 border border-dashed border-border/40 rounded-xl text-center space-y-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Solana Wallet Required</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-[80%] mx-auto font-medium">
                        Please connect your Solana wallet. It will automatically link to your current account.
                      </p>
                    </div>
                    <button
                      onClick={handleConnectWallet}
                      disabled={isConnectingWallet}
                      className="w-full py-2.5 text-xs font-black uppercase tracking-widest bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl shadow-lg transition-all"
                    >
                      {isConnectingWallet ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Connect Phantom Wallet"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Connected status */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs font-semibold">
                      <span className="text-muted-foreground font-medium">Connected Address:</span>
                      <span className="font-mono text-emerald-400">{connectedWallet.slice(0, 5)}...{connectedWallet.slice(-5)}</span>
                    </div>

                    <div className="space-y-2.5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Select Payment Asset</p>
                      
                      <div className="grid grid-cols-3 gap-2.5">
                        {/* SOL */}
                        <button
                          onClick={() => setSelectedAsset("SOL")}
                          className={cn(
                            "flex flex-col items-center justify-center p-3.5 border rounded-xl transition-all duration-200",
                            selectedAsset === "SOL"
                              ? "border-primary bg-primary/5 text-foreground font-black"
                              : "border-border/30 hover:border-border/60 text-muted-foreground"
                          )}
                        >
                          <span className="text-xs font-black">SOL</span>
                          <span className="text-[9px] font-mono mt-1 text-muted-foreground/70">~{estimatedSolPrice.toFixed(4)}</span>
                        </button>

                        {/* USDC */}
                        <button
                          onClick={() => setSelectedAsset("USDC")}
                          className={cn(
                            "flex flex-col items-center justify-center p-3.5 border rounded-xl transition-all duration-200",
                            selectedAsset === "USDC"
                              ? "border-primary bg-primary/5 text-foreground font-black"
                              : "border-border/30 hover:border-border/60 text-muted-foreground"
                          )}
                        >
                          <span className="text-xs font-black">USDC</span>
                          <span className="text-[9px] font-mono mt-1 text-muted-foreground/70">$2.00</span>
                        </button>

                        {/* USDT */}
                        <button
                          onClick={() => setSelectedAsset("USDT")}
                          className={cn(
                            "flex flex-col items-center justify-center p-3.5 border rounded-xl transition-all duration-200",
                            selectedAsset === "USDT"
                              ? "border-primary bg-primary/5 text-foreground font-black"
                              : "border-border/30 hover:border-border/60 text-muted-foreground"
                          )}
                        >
                          <span className="text-xs font-black">USDT</span>
                          <span className="text-[9px] font-mono mt-1 text-muted-foreground/70">$2.00</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-muted/10 rounded-xl text-[10px] font-bold text-muted-foreground text-center">
                      <span>Plan Duration: 30 Days (1 Month)</span>
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <p className="text-xs text-danger font-semibold bg-danger/10 border border-danger/20 p-2.5 rounded-lg text-center">
                    {errorMsg}
                  </p>
                )}

                <button
                  onClick={handlePaymentSubmit}
                  disabled={!selectedAsset || !connectedWallet}
                  className="w-full py-3.5 text-xs font-black uppercase tracking-widest bg-primary disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground rounded-xl shadow-lg transition-all duration-200"
                >
                  Confirm &amp; Sign Pay Transaction
                </button>
              </div>
            )}

            {checkoutStep === "processing" && (
              <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <div className="space-y-2">
                  <h4 className="text-md font-black uppercase tracking-wider text-foreground">Verifying On-Chain Pay...</h4>
                  <p className="text-xs text-muted-foreground max-w-[80%] mx-auto font-medium">
                    Waiting for block confirmations. We are verifying the on-chain transfer to the receiver address.
                  </p>
                </div>
              </div>
            )}

            {checkoutStep === "success" && (
              <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center animate-in zoom-in-95 duration-500">
                <div className="h-14 w-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Check className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-md font-black uppercase tracking-wider text-foreground">Premium Active!</h4>
                  <p className="text-xs text-muted-foreground max-w-[80%] mx-auto font-medium">
                    Your Solana transaction verified successfully! Setting up your premium profile tier. Redirecting...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
