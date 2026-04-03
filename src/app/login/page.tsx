"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Loader2, Wallet, Zap, ShieldCheck } from "lucide-react"
import Image from "next/image"
import { connectPhantom } from "@/lib/wallet"

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showWalletSelector, setShowWalletSelector] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)

  const handleOAuth = (provider: string) => {
    signIn(provider, { callbackUrl: "/profile" })
  }

  const handleWalletLogin = async (walletName: string) => {
    setIsSubmitting(true)
    setSelectedWallet(walletName)
    
    // For now, we use our existing phantom connector for all as a proxy
    // In a full build, we would use @solana/wallet-adapter-react
    const pubKey = await connectPhantom()
    
    if (pubKey) {
      await signIn("solana", {
        address: pubKey,
        callbackUrl: "/profile",
        redirect: true
      })
    }
    setIsSubmitting(false)
    setShowWalletSelector(false)
  }

  return (
    <div className="flex-1 min-h-screen flex items-center justify-center relative overflow-hidden bg-[#020408] px-4">
      
      {/* --- CINEMATIC BACKGROUND --- */}
      {/* Animated Grid */}
      <div className="absolute inset-0 z-0 opacity-20" 
           style={{ backgroundImage: `linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)`, 
                   backgroundSize: '40px 40px' }} />
      
      {/* Moving Lights */}
      <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 -right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] animate-pulse pointer-events-none" />
      
      {/* Particle Glow Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#020408_80%)] z-1" />

      {/* --- LOGIN TERMINAL --- */}
      <div className="relative z-10 w-full max-w-[440px] animate-fade-in-up">
        
        {/* Glow behind terminal */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000" />
        
        <div className="relative glass-card border border-white/5 bg-[#0a0d14]/80 backdrop-blur-2xl p-8 md:p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center">
          
          {/* Identity Header */}
          <div className="relative mb-8 group">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-full blur-xl group-hover:opacity-100 opacity-60 transition-opacity" />
            <div className="relative h-20 w-20 rounded-full bg-slate-900/50 border border-blue-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.1)] overflow-hidden transition-all duration-700 group-hover:scale-105 group-hover:shadow-[0_0_40px_rgba(59,130,246,0.2)]">
              <Image 
                src="/logo.png" 
                alt="TokenSight AI Sentinel" 
                width={56}
                height={56}
                className="h-14 w-14 object-contain animate-pulse-slow"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-safe/20 p-1.5 rounded-full border border-safe/30 backdrop-blur-md">
              <ShieldCheck className="h-3 w-3 text-safe" />
            </div>
          </div>

          <div className="text-center space-y-2 mb-10">
            <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">Access Sentinel</h1>
            <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest leading-relaxed max-w-[280px] mx-auto opacity-70">
              Securely map your on-chain identity and unlock advanced intelligence analysis
            </p>
          </div>

          {/* Primary Action */}
          <div className="w-full space-y-4">
            <button
              onClick={() => setShowWalletSelector(true)}
              className="group relative w-full h-14 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl p-[1px] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(37,99,235,0.3)] active:scale-95"
            >
              <div className="flex items-center justify-center gap-3 w-full h-full bg-[#0a0d14] rounded-[15px] group-hover:bg-transparent transition-colors">
                <Wallet className="h-5 w-5 text-blue-400 group-hover:text-white" />
                <span className="text-sm font-black uppercase tracking-widest text-white">Connect Wallet</span>
              </div>
            </button>
            <p className="text-[9px] text-center text-white/30 font-black uppercase tracking-tighter">
              Connect any Solana (SVM) wallet to begin your intelligence session
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center w-full py-8">
            <div className="grow h-[1px] bg-white/5" />
            <span className="shrink-0 px-4 text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em]">Alternative Access</span>
            <div className="grow h-[1px] bg-white/5" />
          </div>

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-4 w-full">
            <button
              onClick={() => handleOAuth("google")}
              className="flex items-center justify-center gap-2 h-12 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl transition-all group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <svg className="h-4 w-4 relative z-10 text-white/60 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.144-2.068 4.28-1.528 1.508-3.932 3.196-7.812 3.196-6.03 0-10.74-4.872-10.74-10.9s4.71-10.9 10.74-10.9c3.276 0 5.628 1.284 7.392 2.948l2.316-2.316C17.91 2.316 15.396 1 12 1 5.37 1 0 6.37 0 13s5.37 12 12 12c3.576 0 6.276-1.176 8.364-3.348 2.148-2.148 2.82-5.148 2.82-7.584 0-.732-.06-1.428-.18-2.16h-10.52z"/>
              </svg>
              <span className="text-[11px] font-black uppercase tracking-widest text-white/80 relative z-10">Google</span>
            </button>
            <button
              onClick={() => handleOAuth("github")}
              className="flex items-center justify-center gap-2 h-12 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl transition-all group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <svg className="h-4 w-4 relative z-10 text-white/60 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <span className="text-[11px] font-black uppercase tracking-widest text-white/80 relative z-10">GitHub</span>
            </button>
          </div>

          {/* Trust Footer */}
          <div className="mt-10 flex items-center gap-2 text-[10px] text-muted-foreground/30 font-bold uppercase tracking-widest">
            <ShieldCheck className="h-3 w-3" />
            Non-custodial. Your wallet, your control.
          </div>
        </div>

        {/* System ID Tag */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 w-full justify-center">
          <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
            <Image src="/logo.png" alt="" width={10} height={10} className="w-2.5 h-2.5 opacity-60 animate-pulse" />
            <span className="text-[8px] font-black text-blue-400/80 uppercase tracking-[0.2em] leading-none text-nowrap">TokenSight AI Active Engine</span>
          </div>
        </div>
      </div>

      {/* --- WALLET SELECTOR MODAL --- */}
      {showWalletSelector && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#020408]/90 backdrop-blur-md transition-all duration-500" onClick={() => setShowWalletSelector(false)} />
          <div className="relative w-full max-w-xs glass-card border border-white/10 bg-[#0a0d14]/90 p-8 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-center mb-8 text-white/40">Select SVM Provider</h2>
            <div className="space-y-4">
              {[
                { name: "Phantom", icon: "👻" },
                { name: "Solflare", icon: "🔥" },
                { name: "Backpack", icon: "🎒" }
              ].map((w) => (
                <button
                  key={w.name}
                  onClick={() => handleWalletLogin(w.name)}
                  disabled={isSubmitting}
                  className="flex items-center justify-between w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-4 relative z-10">
                    <span className="text-xl group-hover:scale-110 transition-transform">{w.icon}</span>
                    <span className="text-xs font-black uppercase tracking-widest text-white/90 group-hover:text-white">{w.name}</span>
                  </div>
                  {isSubmitting && selectedWallet === w.name ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400 relative z-10" />
                  ) : (
                     <Zap className="h-3 w-3 text-muted-foreground group-hover:text-blue-400 transition-colors relative z-10" />
                  )}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowWalletSelector(false)}
              className="mt-8 w-full py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-colors"
            >
              Cancel Mission
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
