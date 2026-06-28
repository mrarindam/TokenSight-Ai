"use client"

import { usePathname } from "next/navigation"
import { Navbar } from "./Navbar"
import { SiteFooter } from "./SiteFooter"
import { FloatingAiChat } from "../FloatingAiChat"

export function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isDocs = pathname?.startsWith("/docs")

  if (isDocs) {
    return <main className="flex-1 flex flex-col w-full h-full">{children}</main>
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 flex flex-col">{children}</main>
      <SiteFooter />
      <FloatingAiChat />
    </>
  )
}
