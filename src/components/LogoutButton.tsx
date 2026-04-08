"use client"

import { usePrivy } from "@privy-io/react-auth"
import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"

export function LogoutButton() {
  const { logout } = usePrivy()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-danger transition-colors bg-muted/20 px-4 py-2 rounded-lg border border-border/40"
    >
      <LogOut className="w-3 h-3" /> Disconnect Session
    </button>
  )
}
