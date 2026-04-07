"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { TrendingUp, Maximize2, Minimize2 } from "lucide-react"

interface TokenChartProps {
  address: string
  tokenName?: string
}

const TIMEFRAMES = [
  { label: "5M", value: "5" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "24H", value: "1440" },
  { label: "7D", value: "10080" },
] as const

export function TokenChart({ address, tokenName }: TokenChartProps) {
  const [timeframe, setTimeframe] = useState("60")
  const [isExpanded, setIsExpanded] = useState(false)

  const dexScreenerUrl = `https://dexscreener.com/solana/${address}?embed=1&theme=dark&trades=0&info=0`

  return (
    <div className={cn(
      "rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-300",
      isExpanded && "fixed inset-4 z-50 rounded-2xl shadow-2xl"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 bg-muted/5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Price Chart {tokenName && `— ${tokenName}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Timeframe Pills */}
          <div className="flex items-center bg-muted/30 rounded-lg p-0.5 gap-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={cn(
                  "px-2 py-1 text-[10px] font-bold rounded-md transition-all duration-200",
                  timeframe === tf.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* DexScreener Embed */}
      <div className={cn("w-full", isExpanded ? "h-[calc(100%-52px)]" : "h-[400px]")}>
        <iframe
          src={`${dexScreenerUrl}&chartInterval=${timeframe}`}
          className="w-full h-full border-0"
          title={`Chart for ${address}`}
          sandbox="allow-scripts allow-same-origin allow-popups"
          loading="lazy"
        />
      </div>

      {/* Fullscreen backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  )
}
