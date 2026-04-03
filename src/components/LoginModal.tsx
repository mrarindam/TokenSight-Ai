"use client"

import { LogIn } from "lucide-react"
import { useRouter } from "next/navigation"

export function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose?: () => void }) {
  const router = useRouter()
  
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-md transition-opacity" 
        onClick={() => onClose?.()}
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md p-8 overflow-hidden rounded-2xl bg-card border border-border/50 shadow-2xl shadow-primary/10 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="p-4 rounded-full bg-primary/10 animate-pulse">
            <LogIn className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Authentication Required</h2>
            <p className="text-sm text-muted-foreground leading-relaxed px-2">
              Securely map your scanning history and preserve access to advanced analytical metrics.
            </p>
          </div>
          
          <button 
            onClick={() => router.push("/login")}
            className="w-full flex items-center justify-center gap-2 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold tracking-wide rounded-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300"
          >
            Login to Continue
          </button>
          
          {onClose && (
            <button 
              onClick={onClose}
              className="mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
