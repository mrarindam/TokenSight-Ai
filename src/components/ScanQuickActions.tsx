"use client"

import { useState, useEffect, useRef } from "react"
import { usePrivy } from "@privy-io/react-auth"
import { useRouter } from "next/navigation"
import { useAuthFetch } from "@/lib/useAuthFetch"
import { cn } from "@/lib/utils"
import { Plus, Bell, X, Loader2, LogIn } from "lucide-react"
import type { ScanResult } from "@/app/scan/ScanPageClient"

interface QuickActionsProps {
  result: ScanResult
  tokenAddress: string
}

function Overlay({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div ref={ref} className="relative w-full max-w-md glass border border-border/40 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        {children}
      </div>
    </div>
  )
}

export function ScanQuickActions({ result, tokenAddress }: QuickActionsProps) {
  const { authenticated } = usePrivy()
  const router = useRouter()
  const authFetch = useAuthFetch()
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  // Portfolio state
  const [showPortfolio, setShowPortfolio] = useState(false)
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [portfolioError, setPortfolioError] = useState<string | null>(null)
  const [portfolioSuccess, setPortfolioSuccess] = useState(false)
  const [pQuantity, setPQuantity] = useState("")
  const [pEntryPrice, setPEntryPrice] = useState("")
  const [pStatus, setPStatus] = useState("HOLDING")
  const [pNotes, setPNotes] = useState("")

  // Alert state
  const [showAlert, setShowAlert] = useState(false)
  const [alertLoading, setAlertLoading] = useState(false)
  const [alertError, setAlertError] = useState<string | null>(null)
  const [alertSuccess, setAlertSuccess] = useState(false)
  const [aType, setAType] = useState("PRICE_DROP")
  const [aComparison, setAComparison] = useState("BELOW")
  const [aThreshold, setAThreshold] = useState("")

  // Auto-fill entry price from scan result
  useEffect(() => {
    if (result.meta?.price && result.meta.price > 0) {
      setPEntryPrice(String(result.meta.price))
    }
  }, [result.meta?.price])

  // Sync comparison type with alert type
  useEffect(() => {
    if (aType === "PRICE_DROP") setAComparison("BELOW")
    else if (aType === "PRICE_RISE") setAComparison("ABOVE")
    else setAComparison("CHANGE_BY_PERCENT")
  }, [aType])

  const tokenName = result.contractName || "Unknown"
  const tokenSymbol = result.contractName?.split(" ")[0]?.slice(0, 10) || "???"
  const riskLevel = result.label.includes("STRONG") ? "LOW" : result.label.includes("GOOD") ? "MEDIUM" : "HIGH"

  const handleAddPortfolio = async () => {
    const qty = parseFloat(pQuantity)
    const price = parseFloat(pEntryPrice)
    if (!qty || qty <= 0) { setPortfolioError("Quantity must be greater than 0"); return }
    if (!price || price <= 0) { setPortfolioError("Entry price must be greater than 0"); return }

    setPortfolioLoading(true)
    setPortfolioError(null)
    try {
      const res = await authFetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_address: tokenAddress,
          token_name: tokenName,
          token_symbol: tokenSymbol,
          quantity: qty,
          entry_price: price,
          risk_level: riskLevel,
          notes: pNotes || `Score: ${result.score}/100 | ${pStatus}`,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to add to portfolio")
      }
      setPortfolioSuccess(true)
      setShowPortfolio(false)
      setPQuantity("")
      setPNotes("")
      setTimeout(() => setPortfolioSuccess(false), 3000)
    } catch (err) {
      setPortfolioError((err as Error).message)
    } finally {
      setPortfolioLoading(false)
    }
  }

  const handleSetAlert = async () => {
    const threshold = parseFloat(aThreshold)
    if (!threshold || threshold <= 0) { setAlertError("Threshold must be greater than 0"); return }

    setAlertLoading(true)
    setAlertError(null)
    try {
      const res = await authFetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_address: tokenAddress,
          token_name: tokenName,
          alert_type: aType,
          comparison_type: aComparison,
          threshold,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create alert")
      }
      setAlertSuccess(true)
      setShowAlert(false)
      setAThreshold("")
      setTimeout(() => setAlertSuccess(false), 3000)
    } catch (err) {
      setAlertError((err as Error).message)
    } finally {
      setAlertLoading(false)
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-lg bg-background/50 border border-border/40 text-sm font-medium focus:outline-none focus:border-primary/60 transition-colors"
  const labelClass = "text-[10px] font-black uppercase tracking-widest text-muted-foreground/70"

  return (
    <div className="relative space-y-4">
      {/* Success toasts */}
      {portfolioSuccess && (
        <div className="text-xs text-green-500 bg-green-500/10 px-4 py-2.5 rounded-lg border border-green-500/20 font-semibold text-center">✓ Added to portfolio!</div>
      )}
      {alertSuccess && (
        <div className="text-xs text-green-500 bg-green-500/10 px-4 py-2.5 rounded-lg border border-green-500/20 font-semibold text-center">✓ Alert created!</div>
      )}

      {showLoginPrompt && !authenticated && (
        <div className="absolute inset-x-0 bottom-full z-30 mb-3 rounded-2xl border border-primary/20 bg-background/95 px-4 py-4 shadow-2xl shadow-primary/10 backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Login required for portfolio and alerts</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sign in to save tokens to your portfolio and create alerts from this scan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <LogIn className="h-4 w-4" />
                Login to Continue
              </button>
              <button
                type="button"
                onClick={() => setShowLoginPrompt(false)}
                className="rounded-xl border border-border/40 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => {
            if (!authenticated) {
              setShowLoginPrompt(true)
              return
            }
            setShowPortfolio(true)
            setPortfolioError(null)
          }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors font-semibold text-sm text-primary"
        >
          <Plus className="h-4 w-4" />
          Add to Portfolio
        </button>
        <button
          onClick={() => {
            if (!authenticated) {
              setShowLoginPrompt(true)
              return
            }
            setShowAlert(true)
            setAlertError(null)
          }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30 hover:bg-warning/20 transition-colors font-semibold text-sm text-warning"
        >
          <Bell className="h-4 w-4" />
          Set Alert
        </button>
      </div>

      {!authenticated && (
        <div className="text-center text-[11px] font-medium text-muted-foreground/70">
          Login to save portfolio entries and alerts.
        </div>
      )}

      {/* ===== PORTFOLIO POPUP ===== */}
      <Overlay open={showPortfolio} onClose={() => setShowPortfolio(false)}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-primary">Add to Portfolio</h3>
          <button onClick={() => setShowPortfolio(false)} className="p-1 rounded-lg hover:bg-muted/50 transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Auto-filled read-only fields */}
          <div className="space-y-1">
            <label className={labelClass}>Token Address</label>
            <input type="text" readOnly value={tokenAddress} className={cn(inputClass, "text-muted-foreground cursor-not-allowed")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelClass}>Token Name</label>
              <input type="text" readOnly value={tokenName} className={cn(inputClass, "text-muted-foreground cursor-not-allowed")} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Risk Level</label>
              <input type="text" readOnly value={riskLevel} className={cn(inputClass, "text-muted-foreground cursor-not-allowed")} />
            </div>
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelClass}>Quantity *</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 1000"
                value={pQuantity}
                onChange={(e) => setPQuantity(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Entry Price ($) *</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 0.0025"
                value={pEntryPrice}
                onChange={(e) => setPEntryPrice(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Status</label>
            <select value={pStatus} onChange={(e) => setPStatus(e.target.value)} className={inputClass}>
              <option value="HOLDING">Holding</option>
              <option value="WATCHING">Watching</option>
              <option value="SOLD">Sold</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Notes (optional)</label>
            <input
              type="text"
              placeholder="e.g. Good entry on dip..."
              value={pNotes}
              onChange={(e) => setPNotes(e.target.value)}
              className={inputClass}
            />
          </div>

          {portfolioError && (
            <div className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{portfolioError}</div>
          )}

          <button
            onClick={handleAddPortfolio}
            disabled={portfolioLoading}
            className={cn(
              "w-full py-2.5 rounded-xl font-bold text-sm transition-colors",
              portfolioLoading ? "bg-primary/30 text-primary cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {portfolioLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Confirm Add to Portfolio"}
          </button>
        </div>
      </Overlay>

      {/* ===== ALERT POPUP ===== */}
      <Overlay open={showAlert} onClose={() => setShowAlert(false)}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-warning">Set Price Alert</h3>
          <button onClick={() => setShowAlert(false)} className="p-1 rounded-lg hover:bg-muted/50 transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Auto-filled read-only fields */}
          <div className="space-y-1">
            <label className={labelClass}>Token Address</label>
            <input type="text" readOnly value={tokenAddress} className={cn(inputClass, "text-muted-foreground cursor-not-allowed")} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Token Name</label>
            <input type="text" readOnly value={tokenName} className={cn(inputClass, "text-muted-foreground cursor-not-allowed")} />
          </div>

          {/* Editable fields */}
          <div className="space-y-1">
            <label className={labelClass}>Alert Type</label>
            <select value={aType} onChange={(e) => setAType(e.target.value)} className={inputClass}>
              <option value="PRICE_DROP">Price Drop</option>
              <option value="PRICE_RISE">Price Rise</option>
              <option value="SCORE_CHANGE">Score Change</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Condition</label>
            <select value={aComparison} onChange={(e) => setAComparison(e.target.value)} className={inputClass}>
              <option value="BELOW">Below threshold</option>
              <option value="ABOVE">Above threshold</option>
              <option value="CHANGE_BY_PERCENT">Change by %</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className={labelClass}>
              Threshold {aComparison === "CHANGE_BY_PERCENT" ? "(%)" : "($)"} *
            </label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder={aComparison === "CHANGE_BY_PERCENT" ? "e.g. 20" : result.meta?.price ? `Current: $${result.meta.price}` : "e.g. 0.001"}
              value={aThreshold}
              onChange={(e) => setAThreshold(e.target.value)}
              className={inputClass}
            />
            {result.meta?.price && result.meta.price > 0 && aComparison !== "CHANGE_BY_PERCENT" && (
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Current price: ${result.meta.price}
              </p>
            )}
          </div>

          {alertError && (
            <div className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{alertError}</div>
          )}

          <button
            onClick={handleSetAlert}
            disabled={alertLoading}
            className={cn(
              "w-full py-2.5 rounded-xl font-bold text-sm transition-colors",
              alertLoading ? "bg-warning/30 text-warning cursor-not-allowed" : "bg-warning text-warning-foreground hover:bg-warning/90"
            )}
          >
            {alertLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Confirm Create Alert"}
          </button>
        </div>
      </Overlay>
    </div>
  )
}
