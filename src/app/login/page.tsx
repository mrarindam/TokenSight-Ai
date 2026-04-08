"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePrivy } from "@privy-io/react-auth"
import { useRouter } from "next/navigation"
import { useAuthFetch } from "@/lib/useAuthFetch"
import { Loader2 } from "lucide-react"
import Image from "next/image"

export default function LoginPage() {
  const router = useRouter()
  const { login, ready, authenticated } = usePrivy()
  const authFetch = useAuthFetch()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusText, setStatusText] = useState("Waiting for Privy...")
  const hasOpenedModal = useRef(false)

  const syncUserAndRedirect = useCallback(async () => {
    setStatusText("Finalizing your account...")

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const response = await authFetch("/api/user/me", { cache: "no-store" })

        if (response.ok) {
          router.replace("/profile")
          return
        }
      } catch {
        // Retry while Privy finishes session setup.
      }

      await new Promise((resolve) => setTimeout(resolve, 400))
    }

    setStatusText("Signed in. If the modal closed, tap below to continue.")
    setIsSubmitting(false)
  }, [authFetch, router])

  const handleLogin = useCallback(async () => {
    setIsSubmitting(true)
    setStatusText("Launching Privy...")

    try {
      await login()
    } finally {
      setIsSubmitting(false)
    }
  }, [login])

  useEffect(() => {
    if (ready && authenticated) {
      void syncUserAndRedirect()
    }
  }, [authenticated, ready, syncUserAndRedirect])

  useEffect(() => {
    if (!ready || authenticated || hasOpenedModal.current) {
      return
    }

    hasOpenedModal.current = true
    void handleLogin()
  }, [authenticated, handleLogin, ready])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020408] px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <Image
          src="/logo.png"
          alt="TokenSight AI"
          width={72}
          height={72}
          className="h-16 w-16 object-contain"
        />
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-white">Opening sign-in</h1>
          <p className="text-sm text-white/50">
            The Privy login modal should appear automatically.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" />
          {isSubmitting ? "Launching Privy..." : statusText}
        </div>

        <button
          onClick={handleLogin}
          disabled={!ready || isSubmitting}
          className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Open Privy login
        </button>
      </div>
    </div>
  )
}
