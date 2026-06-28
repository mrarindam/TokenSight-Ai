import { Trophy, TrendingUp, LogIn } from "lucide-react"
import Link from "next/link"
import Leaderboard from "@/components/Leaderboard"
import { getAuthUserFromCookies } from "@/lib/auth"

/**
 * MISSION: Global Leaderboard
 * Purpose: Display top performing analysts based on scans, accuracy, and streaks.
 * Theme: Cyberpunk Intelligence / Dark Glassmorphism
 */
export default async function LeaderboardPage() {
  const authUser = await getAuthUserFromCookies()

  if (!authUser) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden bg-background">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] overflow-hidden">
          <div className="absolute left-[8%] top-[-10%] h-72 w-72 rounded-full bg-warning/10 blur-[140px]" />
          <div className="absolute right-[10%] top-[8%] h-64 w-64 rounded-full bg-primary/10 blur-[130px]" />
        </div>
        <div className="terminal-page-shell relative z-10 py-24">
          <div className="terminal-page-grid">
            <div className="col-span-12 xl:col-span-6 xl:col-start-4 text-center space-y-6 terminal-page-frame p-8 md:p-10">
              <div className="terminal-icon-tile mx-auto text-warning border-warning/20 bg-warning/10 shadow-[0_0_30px_rgba(245,158,11,0.16)]">
                <Trophy className="h-8 w-8" />
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">Global Leaderboard</h1>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">Log in to view the global leaderboard and see where you stand among top Solana token analysts.</p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm tracking-wide shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                <LogIn className="h-4 w-4" />
                Sign in to continue
              </Link>
              <p className="text-[11px] text-muted-foreground/40">Google, GitHub, or Solana wallet</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-background">
      {/* BACKGROUND ACCENTS */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/5 rounded-full blur-[160px] pointer-events-none opacity-40 animate-pulse" />
      <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-warning/5 rounded-full blur-[120px] pointer-events-none opacity-20" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-sky-500/5 rounded-full blur-[100px] pointer-events-none opacity-10" />

      {/* NOISE OVERLAY FOR TEXTURE */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0 mix-blend-overlay">
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <filter id="noiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noiseFilter)" />
        </svg>
      </div>

      <div className="terminal-page-shell py-8 md:py-16 space-y-12 relative z-10">
        {/* HEADER SECTION */}
        <div className="terminal-page-grid items-start animate-in fade-in slide-in-from-top duration-700">
          <div className="col-span-12 xl:col-span-8 space-y-4 text-center xl:text-left">
            <div className="terminal-page-kicker">
              <Trophy className="h-3.5 w-3.5" />
              Live Intelligence Ranking
            </div>
            <h1 className="text-4xl md:text-6xl xl:text-7xl font-extrabold tracking-tight text-foreground">
              GLOBAL LEADERBOARD
            </h1>
            <p className="max-w-3xl text-foreground/90 text-sm md:text-base font-black leading-relaxed">
              Top analysts are ranked purely by total scan activity across the network.
            </p>
            <div className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-[0.2em] animate-pulse">
              More scans = Higher rank. Accuracy and streak reflect skill, not rank.
            </div>
          </div>
          <div className="col-span-12 xl:col-span-4">
            <div className="terminal-page-frame p-5">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6 terminal-mini-panel">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/55">Board</div>
                  <div className="mt-2 text-2xl font-black text-foreground">Top 50</div>
                </div>
                <div className="col-span-6 terminal-mini-panel">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/55">Refresh</div>
                  <div className="mt-2 text-2xl font-black text-safe">Live</div>
                </div>
                <div className="col-span-6 terminal-mini-panel">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/55">Signal</div>
                  <div className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-primary">Volume</div>
                </div>
                <div className="col-span-6 terminal-mini-panel">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/55">Mode</div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-safe"><TrendingUp className="h-4 w-4" /> Live</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN COMPONENT */}
        <div className="animate-in fade-in zoom-in-95 duration-1000 delay-300">
          <Leaderboard />
        </div>
      </div>
    </div>
  )
}

