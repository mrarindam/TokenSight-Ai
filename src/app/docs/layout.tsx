"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  ChevronRight, Menu, X, Search
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DOC_GROUPS } from "@/lib/docs-data"
import { ThemeToggle } from "@/components/theme-toggle"
import { brandIconPath } from "@/lib/seo"

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  );
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Auto-close mobile menu on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Filter groups based on search query
  const filteredGroups = DOC_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter((group) => group.items.length > 0)

  return (
    <div className="min-h-screen bg-background flex flex-col w-full text-foreground relative">
      
      {/* CSS Slide-in Animation */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />

      {/* Custom Docs Header (Matches Screenshot 2) */}
      <header className="sticky top-0 z-40 w-full border-b border-border/30 bg-background/80 backdrop-blur-xl h-16 flex items-center justify-between px-6">
        {/* Left Side: Logo + DOCS Badge */}
        <div className="flex items-center gap-4">
          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 rounded-xl hover:bg-muted/50 transition-colors lg:hidden"
            aria-label="Open documentation drawer"
          >
            <Menu className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          </button>
          
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative rounded-xl border border-primary/20 bg-card/70 p-1 shadow-sm">
              <Image src={brandIconPath} alt="TokenSight AI logo" width={28} height={28} className="h-7 w-7 rounded-[0.45rem] object-cover" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-foreground">
                TokenSight <span className="text-primary">AI</span>
              </span>
              <span className="bg-primary/10 text-primary border border-primary/25 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                DOCS
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Search input */}
        <div className="hidden md:flex items-center gap-2.5 max-w-sm w-full bg-muted/20 border border-border/30 rounded-xl px-3 py-1.5 focus-within:border-primary/50 focus-within:bg-muted/30 transition-all duration-300">
          <Search className="h-4 w-4 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search docs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm w-full focus:outline-none text-foreground placeholder:text-muted-foreground/40 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground/50 hover:text-foreground text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* Right: Theme toggle & Github link */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="https://github.com/mrarindam/TokenSight-Ai"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            aria-label="GitHub Repository"
          >
            <GithubIcon className="h-[1.2rem] w-[1.2rem]" />
          </a>
        </div>
      </header>

      {/* Main layout container (stretches to edge, no gaps) */}
      <div className="flex-1 flex w-full relative">
        
        {/* Desktop Sticky Left Sidebar */}
        <aside className="hidden lg:block w-72 shrink-0 border-r border-border/25 bg-background sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto px-6 py-8 scrollbar-thin">
          <nav className="space-y-6">
            {filteredGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-primary/70 font-black">{group.title}</p>
                {group.items.map((s) => {
                  const href = s.id === "about" ? "/docs" : `/docs/${s.id}`
                  const isActive = pathname === href
                  return (
                    <Link
                      key={s.id}
                      href={href}
                      className={cn(
                        "group/nav flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-all duration-200",
                        isActive
                          ? "bg-primary/10 text-primary font-bold shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      )}
                    >
                      <span>{s.label}</span>
                      {isActive && (
                        <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </Link>
                  )
                })}
              </div>
            ))}
            {filteredGroups.length === 0 && (
              <p className="text-xs text-muted-foreground px-3 py-2">No documents found matching &quot;{searchQuery}&quot;</p>
            )}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0 w-full px-6 md:px-12 py-8 lg:py-12 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Navigation (Matches Screenshot 3) */}
      {drawerOpen && (
        <>
          {/* Drawer backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          />
          
          {/* Drawer panel */}
          <div className="fixed inset-y-0 left-0 w-80 bg-background border-r border-border/30 z-50 flex flex-col shadow-2xl animate-slide-in lg:hidden">
            {/* Drawer Header */}
            <div className="h-16 border-b border-border/30 px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative rounded-xl border border-primary/20 bg-card/70 p-1 shadow-sm">
                  <Image src={brandIconPath} alt="TokenSight AI logo" width={24} height={24} className="h-6 w-6 rounded-[0.4rem] object-cover" />
                </div>
                <span className="text-sm font-black tracking-tight text-foreground">
                  TokenSight <span className="text-primary">AI</span>
                </span>
                <span className="bg-primary/10 text-primary border border-primary/25 rounded px-1 text-[8px] font-black uppercase">
                  DOCS
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            {/* Mobile Search input inside drawer */}
            <div className="p-4 border-b border-border/20">
              <div className="flex items-center gap-2 w-full bg-muted/20 border border-border/30 rounded-xl px-3 py-2 focus-within:border-primary/50 transition-all duration-300">
                <Search className="h-4 w-4 text-muted-foreground/50" />
                <input
                  type="text"
                  placeholder="Search docs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs w-full focus:outline-none text-foreground placeholder:text-muted-foreground/40 font-medium"
                />
              </div>
            </div>

            {/* Drawer Navigation List */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-6">
              {filteredGroups.map((group) => (
                <div key={group.title} className="space-y-1">
                  <p className="px-3 pb-1 text-[9px] uppercase tracking-[0.2em] text-primary/70 font-black">{group.title}</p>
                  {group.items.map((s) => {
                    const href = s.id === "about" ? "/docs" : `/docs/${s.id}`
                    const isActive = pathname === href
                    return (
                      <Link
                        key={s.id}
                        href={href}
                        onClick={() => setDrawerOpen(false)}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                          isActive
                            ? "bg-primary/10 text-primary font-bold shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        )}
                      >
                        <span>{s.label}</span>
                        {isActive && (
                          <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </Link>
                    )
                  })}
                </div>
              ))}
              {filteredGroups.length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">No documents found matching &quot;{searchQuery}&quot;</p>
              )}
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
