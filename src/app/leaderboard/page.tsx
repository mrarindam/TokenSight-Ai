import { Trophy, TrendingUp } from "lucide-react"
import Leaderboard from "@/components/Leaderboard"

/**
 * MISSION: Global Leaderboard
 * Purpose: Display top performing analysts based on scans, accuracy, and streaks.
 * Theme: Cyberpunk Intelligence / Dark Glassmorphism
 */
export default function LeaderboardPage() {
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

      <div className="container max-w-6xl py-8 md:py-16 space-y-12 relative z-10">
        {/* HEADER SECTION */}
        <div className="space-y-4 text-center animate-in fade-in slide-in-from-top duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-md shadow-lg shadow-primary/5">
             <div className="relative">
               <Trophy className="h-4 w-4 text-primary animate-pulse" />
               <div className="absolute inset-0 bg-primary/20 blur-sm animate-ping rounded-full" />
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Live Intelligence Ranking</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black tracking-tight bg-gradient-to-b from-foreground via-foreground/90 to-foreground/40 bg-clip-text text-transparent">
            GLOBAL LEADERBOARD
          </h1>
          
          <p className="text-foreground/90 text-sm md:text-base max-w-xl mx-auto font-black leading-relaxed">
            Top analysts are ranked purely by total scan activity across the network.
          </p>
          <div className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-[0.2em] animate-pulse">
            More scans = Higher rank. Accuracy and streak reflect skill, not rank.
          </div>

          {/* REAL-TIME INDICATOR */}
          <div className="flex items-center justify-center gap-8 pt-4">
            <div className="flex items-center gap-2 group cursor-default">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.6)]" />
              <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors">ESTABLISHED ANALYSTS</span>
            </div>
            <div className="flex items-center gap-2 group cursor-default">
              <TrendingUp className="h-4 w-4 text-safe group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-muted-foreground group-hover:text-safe transition-colors uppercase tracking-widest">Live updating</span>
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

