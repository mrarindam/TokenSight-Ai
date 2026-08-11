"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { usePrivy } from "@privy-io/react-auth"
import { useAuthFetch } from "@/lib/useAuthFetch"
import { Check, Sparkles, Loader2, ArrowLeft, Lock, X, Coins } from "lucide-react"
import Link from "next/link"

export default function PricingPage() {
  const { ready, authenticated, login } = usePrivy()
  const authFetch = useAuthFetch()
  const router = useRouter()

  const [isLoadingUser, setIsLoadingUser] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<"select" | "processing" | "success">("select")
  const [errorMsg, setErrorMsg] = useState("")

  // OxaPay states
  const [oxapayLoading, setOxapayLoading] = useState(false)
  const [oxapayPayLink, setOxapayPayLink] = useState<string | null>(null)
  const [oxapayTrackId, setOxapayTrackId] = useState<string | null>(null)

  useEffect(() => {
    if (ready && authenticated) {
      setIsLoadingUser(true)
      authFetch("/api/user/me")
        .then((res) => res.json())
        .then((data) => {
          if (data?.user?.is_premium) {
            setIsPremium(true)
          }
        })
        .catch((err) => console.error("Error loading user profile status:", err))
        .finally(() => setIsLoadingUser(false))
    }
  }, [ready, authenticated, authFetch])

  // Recover pending trackId from URL or localStorage on page return
  useEffect(() => {
    if (!ready || !authenticated) return

    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
    const urlTrackId = urlParams?.get("trackId") || urlParams?.get("track_id")
    const storedTrackId = typeof window !== "undefined" ? localStorage.getItem("pending_oxapay_track_id") : null
    const isPaymentSuccessReturn = urlParams?.get("payment") === "success"

    const targetTrackId = urlTrackId || storedTrackId

    if (targetTrackId && !isPremium) {
      if (oxapayTrackId !== targetTrackId) {
        setOxapayTrackId(targetTrackId)
      }
      if (checkoutStep === "select" || isPaymentSuccessReturn) {
        setShowCheckoutModal(true)
        setCheckoutStep("processing")
      }
    }
  }, [ready, authenticated, oxapayTrackId, checkoutStep, isPremium])

  // Polling OxaPay payment status
  useEffect(() => {
    const activeTrackId = oxapayTrackId || (typeof window !== "undefined" ? localStorage.getItem("pending_oxapay_track_id") : null)
    if (!activeTrackId) return

    const checkStatus = async () => {
      try {
        const fetchFn = authenticated ? authFetch : fetch
        const res = await fetchFn(`/api/billing/oxapay/status?trackId=${activeTrackId}`)
        if (res.ok) {
          const data = await res.json()
          const PAID_STATUSES = ["paid", "complete", "completed", "manual_accept"]
          const rawStatus = (data.status || "").toString().toLowerCase()

          if (data.isPremium || PAID_STATUSES.includes(rawStatus)) {
            if (typeof window !== "undefined") {
              localStorage.removeItem("pending_oxapay_track_id")
            }
            setIsPremium(true)
            setShowCheckoutModal(true)
            setCheckoutStep("success")

            // Force refresh user profile state bypassing cache
            if (authenticated) {
              authFetch("/api/user/me?fresh=true").catch(() => {})
            }

            setTimeout(() => {
              setShowCheckoutModal(false)
              router.push("/scan")
              router.refresh()
            }, 3500)
            return true
          } else if (["expired", "failed", "canceled", "cancelled", "underpaid"].includes(rawStatus)) {
            if (typeof window !== "undefined") {
              localStorage.removeItem("pending_oxapay_track_id")
            }
            setOxapayTrackId(null)
            setErrorMsg("Payment session expired or canceled. Please try creating a new invoice.")
            setCheckoutStep("select")
            return true
          }
        }
      } catch (err) {
        console.error("Error polling OxaPay status:", err)
      }
      return false
    }

    // Run immediate status check
    checkStatus()

    // Poll status every 3 seconds
    const intervalId = setInterval(async () => {
      const isDone = await checkStatus()
      if (isDone) clearInterval(intervalId)
    }, 3000)

    return () => clearInterval(intervalId)
  }, [oxapayTrackId, authenticated, authFetch, router])

  const handleCloseModal = () => {
    setShowCheckoutModal(false)
    if (checkoutStep === "processing") {
      setCheckoutStep("select")
      setOxapayTrackId(null)
      setOxapayPayLink(null)
      if (typeof window !== "undefined") {
        localStorage.removeItem("pending_oxapay_track_id")
      }
    }
  }

  const handleCancelPayment = () => {
    setCheckoutStep("select")
    setOxapayTrackId(null)
    setOxapayPayLink(null)
    setErrorMsg("")
    if (typeof window !== "undefined") {
      localStorage.removeItem("pending_oxapay_track_id")
    }
  }

  const handleUpgradeClick = async () => {
    if (!authenticated) {
      login()
      return
    }
    setCheckoutStep("select")
    setOxapayPayLink(null)
    setOxapayTrackId(null)
    setErrorMsg("")
    setShowCheckoutModal(true)
  }

  const handleOxapaySubmit = async () => {
    setOxapayLoading(true)
    setErrorMsg("")
    try {
      const res = await authFetch("/api/billing/oxapay/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate OxaPay checkout")
      }

      const generatedTrackId = data.trackId
      setOxapayPayLink(data.payLink)
      setOxapayTrackId(generatedTrackId)
      if (typeof window !== "undefined" && generatedTrackId) {
        localStorage.setItem("pending_oxapay_track_id", generatedTrackId)
      }
      setCheckoutStep("processing")

      if (data.payLink) {
        window.open(data.payLink, "_blank", "noopener,noreferrer")
      }
    } catch (err: unknown) {
      const error = err as Error
      setErrorMsg(error.message || "Failed to start checkout.")
    } finally {
      setOxapayLoading(false)
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
            Choose Your <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">Tier</span>
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
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted/20"
              title="Close Modal"
            >
              <X className="h-5 w-5" />
            </button>

            {checkoutStep === "select" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                    <Coins className="h-5 w-5 text-purple-400" /> OxaPay Checkout
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Pay with Bitcoin, Ethereum, BNB, SOL, USDT, LTC, TRX or any other cryptocurrency. A payment invoice will be generated.
                  </p>
                </div>

                <div className="p-5 border border-dashed border-border/40 rounded-xl space-y-4 text-center">
                  <div className="h-10 w-10 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
                    <Coins className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">Global Crypto Checkout</p>
                    <p className="text-xs text-muted-foreground max-w-[80%] mx-auto font-medium">
                      You will be redirected to OxaPay&apos;s secure checkout page to complete the transfer in your chosen cryptocurrency.
                    </p>
                  </div>
                  <div className="p-3 bg-muted/10 rounded-xl text-[10px] font-bold text-muted-foreground">
                    <span>Plan Duration: 30 Days (1 Month) — $2.00 USD</span>
                  </div>
                </div>

                {errorMsg && (
                  <p className="text-xs text-danger font-semibold bg-danger/10 border border-danger/20 p-2.5 rounded-lg text-center">
                    {errorMsg}
                  </p>
                )}

                <button
                  onClick={handleOxapaySubmit}
                  disabled={oxapayLoading}
                  className="w-full py-3.5 text-xs font-black uppercase tracking-widest bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-600/90 hover:to-indigo-600/90 text-white rounded-xl shadow-lg shadow-purple-600/10 transition-all duration-200"
                >
                  {oxapayLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Confirm & Generate Invoice"}
                </button>
              </div>
            )}

            {checkoutStep === "processing" && (
              <div className="py-6 flex flex-col items-center justify-center space-y-5 text-center animate-in fade-in duration-200">
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-md animate-pulse" />
                  <Loader2 className="h-12 w-12 text-purple-400 animate-spin relative z-10" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-base font-black uppercase tracking-wider text-foreground">
                    Awaiting Crypto Payment...
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-[85%] mx-auto font-medium leading-relaxed">
                    We opened the OxaPay checkout window. Complete your transfer there and this page will update automatically once verified.
                  </p>
                  
                  {oxapayPayLink && (
                    <div className="pt-2">
                      <a
                        href={oxapayPayLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-purple-400 hover:text-purple-300 hover:underline"
                      >
                        Didn&apos;t open? Click here to pay <span className="text-[10px]">↗</span>
                      </a>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border/20 mt-4 flex flex-col gap-2">
                    <button
                      onClick={handleCancelPayment}
                      className="w-full py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/20 border border-border/40 rounded-xl transition-all duration-200"
                    >
                      Cancel Payment & Select Options
                    </button>
                  </div>
                </div>
              </div>
            )}

            {checkoutStep === "success" && (
              <div className="py-8 flex flex-col items-center justify-center space-y-5 text-center animate-in zoom-in-95 duration-500">
                <div className="h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <Check className="h-9 w-9 animate-bounce" />
                </div>
                <div className="space-y-3">
                  <h4 className="text-xl font-black uppercase tracking-wider text-emerald-400">Payment Successful! 🎉</h4>
                  <p className="text-sm font-bold text-foreground max-w-[90%] mx-auto leading-relaxed">
                    Welcome to the Premium Family! 💜
                  </p>
                  <p className="text-xs text-muted-foreground max-w-[85%] mx-auto leading-relaxed">
                    Thank you so much for your support. Your account is now fully upgraded with all premium access tier features active. Redirecting to your scan page...
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
