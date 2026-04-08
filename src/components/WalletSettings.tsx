"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthFetch } from "@/lib/useAuthFetch"
import { cn } from "@/lib/utils"
import { connectAndSign, getPhantomProvider } from "@/lib/wallet"
import {
  Wallet,
  Loader2,
  Check,
  X,
  AlertTriangle,
  Link2,
  Unlink,
  ExternalLink,
  Copy,
  CheckCheck,
} from "lucide-react"

interface WalletSettingsProps {
  currentWallet: string | null
  isWalletLogin: boolean // true if user logged in via wallet (can't disconnect)
}

export function WalletSettings({ currentWallet, isWalletLogin }: WalletSettingsProps) {
  const router = useRouter()
  const authFetch = useAuthFetch()
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [copied, setCopied] = useState(false)

  const hasPhantom = typeof window !== "undefined" && getPhantomProvider() !== null

  const handleConnect = async () => {
    setIsConnecting(true)
    setError("")
    setSuccess("")

    try {
      const result = await connectAndSign()
      if (!result) {
        setError("Wallet connection was cancelled or Phantom is not installed")
        return
      }

      const res = await authFetch("/api/user/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to link wallet")
        return
      }

      setSuccess(`Wallet ${result.address.slice(0, 4)}...${result.address.slice(-4)} linked successfully!`)
      router.refresh()
    } catch (err) {
      const e = err as Error
      setError(e.message || "Connection failed")
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    setError("")
    setSuccess("")

    try {
      const res = await authFetch("/api/user/wallet", { method: "DELETE" })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to disconnect wallet")
        return
      }

      setSuccess("Wallet disconnected")
      router.refresh()
    } catch (err) {
      const e = err as Error
      setError(e.message || "Disconnect failed")
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleCopy = () => {
    if (currentWallet) {
      navigator.clipboard.writeText(currentWallet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="glass rounded-2xl border border-border/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/20 bg-muted/5">
        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
          <Wallet className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider">Wallet Connection</h3>
          <p className="text-[10px] text-muted-foreground font-medium">
            {currentWallet ? "Wallet linked to your account" : "Connect a Solana wallet for swaps"}
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Current Wallet Display */}
        {currentWallet ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Connected</div>
                <div className="text-xs font-mono text-foreground/80">
                  {currentWallet.slice(0, 6)}...{currentWallet.slice(-6)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Copy address"
              >
                {copied ? <CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <a
                href={`https://solscan.io/account/${currentWallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="View on Solscan"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/10 border border-border/20">
            <div className="p-1.5 rounded-lg bg-muted/30">
              <Unlink className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No Wallet Connected</div>
              <div className="text-[11px] text-muted-foreground/60">Connect to enable token swaps</div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!currentWallet ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-300",
                "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/20",
                isConnecting && "opacity-70 cursor-not-allowed"
              )}
            >
              {isConnecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              {isConnecting ? "Signing..." : hasPhantom ? "Connect Phantom Wallet" : "Install Phantom"}
            </button>
          ) : (
            <>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-200",
                  "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20",
                  isConnecting && "opacity-70 cursor-not-allowed"
                )}
              >
                {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                Change Wallet
              </button>
              {!isWalletLogin && (
                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200",
                    "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20",
                    isDisconnecting && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {isDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Disconnect
                </button>
              )}
            </>
          )}
        </div>

        {isWalletLogin && currentWallet && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-medium">
            <AlertTriangle className="h-3 w-3" />
            This wallet is your login method. Link Google/GitHub first to disconnect it.
          </div>
        )}

        {/* Status Messages */}
        {error && (
          <div className="flex items-center gap-2 text-[11px] font-medium text-danger bg-danger/10 px-3 py-2 rounded-lg border border-danger/20">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-500 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
            <Check className="h-3 w-3 flex-shrink-0" />
            {success}
          </div>
        )}
      </div>
    </div>
  )
}
