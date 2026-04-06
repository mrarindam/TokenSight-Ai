"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Plus, Bell, ChevronDown } from "lucide-react"
import type { ScanResult } from "@/app/scan/page"

interface QuickActionsProps {
  result: ScanResult
}

export function ScanQuickActions({ result }: QuickActionsProps) {
  const { data: session } = useSession()
  const [showPortfolioForm, setShowPortfolioForm] = useState(false)
  const [showAlertForm, setShowAlertForm] = useState(false)
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [alertLoading, setAlertLoading] = useState(false)
  const [portfolioError, setPortfolioError] = useState<string | null>(null)
  const [alertError, setAlertError] = useState<string | null>(null)
  const [portfolioSuccess, setPortfolioSuccess] = useState(false)
  const [alertSuccess, setAlertSuccess] = useState(false)

  if (!session?.user) {
    return null
  }

  const handleAddPortfolio = async () => {
    setPortfolioLoading(true)
    setPortfolioError(null)
    setPortfolioSuccess(false)

    try {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_address: result.contractName || "",
          token_name: result.contractName || "Unknown",
          token_symbol: result.contractName?.split("").slice(0, 4).join("") || "???",
          quantity: 0,
          entry_price: 0,
          risk_level: result.label.includes("STRONG") ? "LOW" : result.label.includes("GOOD") ? "MEDIUM" : "HIGH",
          notes: `Score: ${result.score}/100 | Confidence: ${result.confidence}`,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to add to portfolio")
      }

      setPortfolioSuccess(true)
      setShowPortfolioForm(false)
      setTimeout(() => setPortfolioSuccess(false), 3000)
    } catch (err) {
      setPortfolioError((err as Error).message)
    } finally {
      setPortfolioLoading(false)
    }
  }

  const handleSetAlert = async () => {
    setAlertLoading(true)
    setAlertError(null)
    setAlertSuccess(false)

    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_address: result.contractName || "",
          token_name: result.contractName || "Unknown",
          alert_type: "PRICE_DROP",
          comparison_type: "BELOW",
          threshold: result.meta?.liquidity ? result.meta.liquidity * 0.8 : 100,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create alert")
      }

      setAlertSuccess(true)
      setShowAlertForm(false)
      setTimeout(() => setAlertSuccess(false), 3000)
    } catch (err) {
      setAlertError((err as Error).message)
    } finally {
      setAlertLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => setShowPortfolioForm(!showPortfolioForm)}
          className="flex-1 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors font-semibold text-sm text-primary"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add to Portfolio
          </div>
          <ChevronDown className={cn("h-4 w-4 transition-transform", showPortfolioForm && "rotate-180")} />
        </button>

        <button
          onClick={() => setShowAlertForm(!showAlertForm)}
          className="flex-1 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30 hover:bg-warning/20 transition-colors font-semibold text-sm text-warning"
        >
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Set Alert
          </div>
          <ChevronDown className={cn("h-4 w-4 transition-transform", showAlertForm && "rotate-180")} />
        </button>
      </div>

      {showPortfolioForm && (
        <div className="glass rounded-2xl border border-primary/30 p-4 space-y-3 bg-primary/5">
          <p className="text-sm text-muted-foreground">Quick add this token to your watchlist. You can update quantity and entry price later in your portfolio dashboard.</p>
          {portfolioError && <div className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{portfolioError}</div>}
          {portfolioSuccess && <div className="text-xs text-green-500 bg-green-500/10 px-3 py-2 rounded-lg border border-green-500/20">✓ Added to portfolio!</div>}
          <button
            onClick={handleAddPortfolio}
            disabled={portfolioLoading}
            className={cn(
              "w-full py-2 rounded-lg font-semibold text-sm transition-colors",
              portfolioLoading
                ? "bg-primary/30 text-primary cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {portfolioLoading ? "Adding..." : "Confirm Add to Portfolio"}
          </button>
        </div>
      )}

      {showAlertForm && (
        <div className="glass rounded-2xl border border-warning/30 p-4 space-y-3 bg-warning/5">
          <p className="text-sm text-muted-foreground">Set a price drop alert at 80% of current liquidity. You can customize thresholds in alerts dashboard.</p>
          {alertError && <div className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{alertError}</div>}
          {alertSuccess && <div className="text-xs text-green-500 bg-green-500/10 px-3 py-2 rounded-lg border border-green-500/20">✓ Alert created!</div>}
          <button
            onClick={handleSetAlert}
            disabled={alertLoading}
            className={cn(
              "w-full py-2 rounded-lg font-semibold text-sm transition-colors",
              alertLoading
                ? "bg-warning/30 text-warning cursor-not-allowed"
                : "bg-warning text-warning-foreground hover:bg-warning/90"
            )}
          >
            {alertLoading ? "Creating..." : "Confirm Create Alert"}
          </button>
        </div>
      )}
    </div>
  )
}
