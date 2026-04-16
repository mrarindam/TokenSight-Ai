"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { usePrivy } from "@privy-io/react-auth"
import { Menu, X, Scan, Trophy, Activity, Target, ShieldAlert, Settings, ChevronDown, History, Radar, BookOpen, LogIn, BadgeInfo, MessageSquareText } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { useAuthFetch } from "@/lib/useAuthFetch"
import { brandIconPath } from "@/lib/seo"
import { cn } from "@/lib/utils"

const PRIMARY_NAV_ITEMS = [
  { href: "/", label: "Feed", icon: Activity },
  { href: "/scan", label: "Scan", icon: Scan },
  { href: "/portfolio", label: "Portfolio", icon: Target },
  { href: "/alerts", label: "Alerts", icon: ShieldAlert },
  { href: "/docs", label: "Docs", icon: BookOpen },
]

const SECONDARY_NAV_ITEMS = [
  { href: "/about", label: "About Us", icon: BadgeInfo },
  { href: "/contact", label: "Contact Us", icon: MessageSquareText },
  { href: "/scan/history", label: "History", icon: History },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/settings/telegram", label: "Telegram", icon: Settings },
]

const MOBILE_NAV_ITEMS = [
  ...PRIMARY_NAV_ITEMS,
  ...SECONDARY_NAV_ITEMS,
]

type NavbarUser = {
  username: string | null
  display_name: string | null
  avatar_url?: string | null
  wallet: string | null
  email: string | null
  twitter_handle: string | null
}

export function Navbar() {
  const pathname = usePathname()
  const { authenticated, ready, user } = usePrivy()
  const authFetch = useAuthFetch()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [navUser, setNavUser] = useState<NavbarUser | null>(null)
  const moreMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMobileOpen(false)
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    let active = true

    async function loadNavUser() {
      if (!ready) {
        return
      }

      if (!authenticated) {
        setNavUser(null)
        return
      }

      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const response = await authFetch("/api/user/me", { cache: "no-store" })

          if (response.ok) {
            const data = await response.json()
            if (active) {
              setNavUser(data.user ?? null)
            }
            return
          }

          await new Promise((resolve) => setTimeout(resolve, 350))
        }
      } catch {
        if (active) {
          setNavUser(null)
        }
      }
    }

    void loadNavUser()

    return () => {
      active = false
    }
  }, [authFetch, authenticated, ready])

  const isSecondaryActive = SECONDARY_NAV_ITEMS.some((item) => pathname === item.href)
  const privyFallbackName =
    user?.google?.name ||
    user?.twitter?.username ||
    user?.github?.username ||
    user?.email?.address ||
    user?.wallet?.address ||
    "Profile"
  const profileName = navUser?.display_name || navUser?.username || privyFallbackName
  const profileLabel =
    profileName.length > 16
      ? `${profileName.slice(0, 13)}...`
      : profileName
  const profileInitial = profileName.charAt(0).toUpperCase()
  const profileHref = authenticated ? "/profile" : "/login"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/75 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/55">
      <div className="h-[2px] w-full bg-[linear-gradient(90deg,transparent,hsl(var(--primary)/0.7),transparent)]" />
      <div className="dashboard-shell flex h-16 items-center justify-between gap-3 lg:h-20">
        {/* Logo */}
        <Link href="/" className="flex min-w-0 items-center gap-3 group">
          <div className="relative rounded-2xl border border-primary/20 bg-card/70 p-1 shadow-[0_12px_30px_-18px_rgba(59,130,246,0.55)] transition-transform duration-300 group-hover:scale-105">
            <div className="overflow-hidden rounded-[0.9rem] bg-[#020408] ring-1 ring-white/6">
              <Image 
                src={brandIconPath}
                alt="TokenSight AI Logo" 
                width={34}
                height={34}
                className="h-[34px] w-[34px] object-cover"
              />
            </div>
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,0.95)]" />
          </div>
          <div className="min-w-0">
            <span className="hidden text-lg font-bold tracking-tight text-foreground sm:inline-block">
              TokenSight <span className="text-primary">AI</span>
            </span>
            <div className="hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground md:flex">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.95)]" />
              Market Signals Live
            </div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center justify-center flex-1 px-2">
          <div className="flex items-center gap-1 rounded-full border border-border/40 bg-card/70 p-1 shadow-[0_14px_34px_-24px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            const isScanItem = item.href === "/scan"
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-[0_12px_24px_-16px_rgba(59,130,246,0.9)]"
                    : isScanItem
                      ? "bg-foreground text-background shadow-[0_12px_24px_-18px_rgba(255,255,255,0.35)] hover:scale-[1.02]"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  {isScanItem ? <Radar className="h-4 w-4" /> : null}
                  {item.label}
                </span>
              </Link>
            )
          })}
          </div>
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-2 lg:gap-3">
          <div ref={moreMenuRef} className="relative hidden lg:block">
            <button
              type="button"
              onClick={() => setMoreOpen((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200",
                moreOpen || isSecondaryActive
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/40 bg-card/60 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
              )}
              aria-expanded={moreOpen}
              aria-label="Toggle secondary navigation"
            >
              More
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", moreOpen ? "rotate-180" : "rotate-0")} />
            </button>

            {moreOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.75rem)] w-64 rounded-[1.25rem] border border-border/40 bg-card/90 p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                <div className="mb-2 rounded-2xl border border-border/30 bg-background/40 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Command Center</p>
                  <p className="mt-1 text-xs text-foreground">Access supporting tools and account controls.</p>
                </div>
                {SECONDARY_NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center justify-between rounded-2xl px-3 py-3 text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </span>
                      {isActive ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>

          <Link
            href={profileHref}
            className={cn(
              "hidden lg:inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-all duration-200",
              authenticated && ready
                ? "border-primary/20 bg-card/70 text-foreground shadow-[0_12px_24px_-18px_rgba(59,130,246,0.35)] hover:border-primary/35 hover:-translate-y-0.5"
                : "border-border/40 bg-card/60 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
            )}
          >
            {authenticated && ready ? (
              <>
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 text-xs font-black uppercase text-primary">
                  {navUser?.avatar_url ? (
                    <Image
                      src={navUser.avatar_url}
                      alt={profileName}
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    profileInitial
                  )}
                </span>
                <span className="max-w-[170px] truncate" title={profileName}>{profileLabel}</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Login
              </>
            )}
          </Link>

          <ThemeToggle />

          {/* Mobile hamburger */}
          <button
            className="rounded-xl border border-border/40 bg-card/60 p-2 transition-colors hover:bg-accent/70 lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {mobileOpen && (
        <div className="border-t border-border/40 bg-background/95 backdrop-blur-2xl animate-fade-in lg:hidden">
          <nav className="dashboard-shell py-4">
            <div className="rounded-[1.5rem] border border-border/40 bg-card/65 p-2 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.5)]">
            <div className="mb-2 flex items-center justify-between rounded-[1.2rem] border border-primary/15 bg-background/50 px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Signal Status</p>
                <p className="mt-1 text-sm font-medium text-foreground">AI monitoring is active</p>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,0.95)]" />
            </div>
            {MOBILE_NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              const isScanItem = item.href === "/scan"
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "text-primary bg-primary/10"
                      : isScanItem
                        ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
            <Link
              href={profileHref}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "mt-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
                authenticated && ready
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 text-xs font-black uppercase text-primary">
                {authenticated && ready && navUser?.avatar_url ? (
                  <Image
                    src={navUser.avatar_url}
                    alt={profileName}
                    width={36}
                    height={36}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : authenticated && ready ? (
                  profileInitial
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
              </span>
              <span>{authenticated && ready ? "Profile" : "Login"}</span>
            </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
