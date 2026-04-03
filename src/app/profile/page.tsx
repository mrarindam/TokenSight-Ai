import { getServerSession } from "next-auth/next"
export const dynamic = 'force-dynamic'
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabaseClient"
import { Crown, Target, Zap, LogOut, Search, Clock, Award, BarChart3, TrendingUp, Calendar, User } from "lucide-react"
import RecentActivity from "@/components/RecentActivity"
import LocalTime from "@/components/LocalTime"
import EditProfile from "@/components/EditProfile"

import { getLeague } from "@/lib/leagues"
import { cn } from "@/lib/utils"

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  // 1. Fetch User Profile Data
  const { data: dbUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle()

  // 2. Fetch User Stats
  const { data: stats } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", session.user.id)
    .single()

  // 3. FETCH DYNAMIC GLOBAL RANKING (FROM RPC)
  const { data: rankData } = await supabase
    .rpc('get_user_rank', { target_user_id: session.user.id })
    .single() as { data: { dynamic_rank: number } | null }


  const currentRank = rankData?.dynamic_rank || "..."

  // 4. FETCH LAST SCAN
  const { data: lastScanData } = await supabase
    .from("scans")
    .select("created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(1)

  const lastScan = lastScanData || []

  // 5. FETCH TOTAL SCANS (Lifetime) - Single source of truth from scans table
  const { count: totalScansCount } = await supabase
    .from("scans")
    .select("*", { count: "exact", head: true })
    .eq("user_id", session.user.id)

  const totalScans = totalScansCount || 0

  // 6. FETCH HIGH CONVICTION HITS (Score > 70)
  const { count: highConvictionCount } = await supabase
    .from("scans")
    .select("*", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .gt("score", 70)

  const highConvictionHits = highConvictionCount || 0

  // 7. FETCH BEST SCAN (Highest Score)
  const { data: bestScanData } = await supabase
    .from("scans")
    .select("token_name, score")
    .eq("user_id", session.user.id)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle()

  const bestScan = (bestScanData as { token_name: string; score: number } | null) || null

  // 8. FETCH WEEKLY SCANS (Last 7 Days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: weeklyCount } = await supabase
    .from("scans")
    .select("*", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .gte("created_at", sevenDaysAgo)

  const weeklyScans = weeklyCount || 0
  const dailyAverage = (weeklyScans / 7).toFixed(1)

  const renderStats = stats
    ? { ...stats, total_scans: totalScans }
    : {
      total_scans: totalScans,
      detection_rate: 0,
      streak: 0,
      created_at: new Date().toISOString()
    }

  // 7. ASSIGN LEAGUE DYNAMICALLY
  const tier = getLeague(totalScans)

  // Format Username/Wallet (Prioritize Display Name)

  const userIdentity = dbUser?.display_name || dbUser?.username || session.user.name || "Authenticated Node"
  const isWallet = userIdentity.startsWith("0x")
  const displayName = isWallet
    ? `${userIdentity.slice(0, 6)}...${userIdentity.slice(-4)}`
    : userIdentity

  const avatarUrl = dbUser?.avatar_url || null

  // High Precision Last Activity - Strictly scan-based (No fallback to account creation)
  const activityTimestamp = lastScan?.[0]?.created_at || null
  const joinedDate = stats?.created_at || new Date().toISOString()

  return (
    <div className="flex-1 container max-w-5xl py-12 md:py-16 space-y-10">

      {/* HEADER SECTION - 3 COLUMNS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-up">

        {/* User Card */}
        <div className="glass p-6 rounded-[2rem] border border-border/40 relative group">
          <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
            <EditProfile
              currentName={dbUser?.username || userIdentity}
              currentAvatar={avatarUrl}
            />
          </div>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/5 relative group cursor-pointer overflow-hidden">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Avatar" width={56} height={56} className="h-full w-full object-cover transition-transform group-hover:scale-110" unoptimized />
              ) : (
                <User className="w-7 h-7" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                {displayName}
              </h2>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                <Calendar className="w-3 h-3" /> Joined <LocalTime timestamp={joinedDate} mode="absolute" />
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-border/20 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Global Rank</span>
              <span className="text-xl font-black text-primary">#{currentRank}</span>
            </div>

            {/* Skill Tier Badge */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Skill Class</span>
              <div className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-xl animate-pulse-glow",
                renderStats.detection_rate >= 70 ? "bg-safe/20 text-safe border-safe/30" :
                  renderStats.detection_rate >= 50 ? "bg-primary/20 text-primary border-primary/30" :
                    "bg-warning/20 text-warning border-warning/30"
              )}>
                {renderStats.detection_rate >= 70 ? "Elite Analyst" :
                  renderStats.detection_rate >= 50 ? "Skilled" : "Learning"}
              </div>
            </div>
          </div>
        </div>

        {/* Streak Card */}
        <div className="glass p-6 rounded-[2rem] border border-border/40 relative overflow-hidden group flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-4 shadow-lg shadow-orange-500/5">
            <Zap className="w-7 h-7" />
          </div>
          <div className="text-4xl font-black tracking-tighter mb-1">{renderStats.streak} days</div>
          <div className="flex items-center gap-2 text-[10px] text-orange-400/80 font-black uppercase tracking-widest">
            Active Streak <span className="animate-pulse">🔥</span>
          </div>
        </div>

        {/* Tier Card */}
        <div className={`glass p-6 rounded-[2rem] border ${tier.border} relative overflow-hidden group flex flex-col items-center justify-center text-center`}>
          <div className={`h-14 w-14 rounded-2xl ${tier.bg} border ${tier.border} flex items-center justify-center ${tier.color} mb-4 shadow-lg shadow-current/5`}>
            <Award className="w-7 h-7" />
          </div>
          <div className={`text-4xl font-black tracking-tighter mb-1 ${tier.color}`}>{tier.name}</div>
          <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
            {tier.sub}
          </div>
        </div>

      </div>

      {/* STATS MINI GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-up [animation-delay:200ms]">
        <div className="glass p-5 rounded-2xl border border-border/30 hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <Search className="w-4 h-4 text-blue-400" />
            <TrendingUp className="w-3 h-3 text-safe" />
          </div>
          <div className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-1">Total Scans</div>
          <div className="text-2xl font-black">{renderStats.total_scans}</div>
          <div className="text-[9px] text-safe font-bold mt-1">+{weeklyScans} this week</div>
        </div>

        <div className="glass p-5 rounded-2xl border border-border/30 hover:border-safe/30 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-3">
            <Target className="w-4 h-4 text-safe group-hover:scale-110 transition-transform" />
            <div className="text-[8px] bg-safe/10 text-safe px-2 py-0.5 rounded-full font-black">WEIGHTED</div>
          </div>
          <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Intelligence Accuracy</div>
          <div className="text-2xl font-black group-hover:text-safe transition-colors">{renderStats.detection_rate}%</div>
          <div className="text-[9px] text-muted-foreground/60 font-bold mt-1 leading-tight">
            Based on weighted opportunity detection. Higher = better skill.
          </div>
        </div>

        <div className="glass p-5 rounded-2xl border border-border/30 hover:border-warning/30 transition-colors group relative cursor-help">
          <div className="flex items-center justify-between mb-3">
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-1">Last Activity</div>
          <div className="text-[15px] font-black tracking-tight truncate">
            <LocalTime timestamp={activityTimestamp} mode="relative" />
          </div>

          {/* Tooltip for exact time */}
          {activityTimestamp && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-background border border-border/50 rounded-lg text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-50 pointer-events-none uppercase tracking-tighter">
              <LocalTime timestamp={activityTimestamp} mode="tooltip" />
            </div>
          )}
        </div>

        <div className="glass p-5 rounded-2xl border border-border/30 hover:border-purple-400/30 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
            <div className="text-[8px] bg-purple-400/10 text-purple-400 px-2 py-0.5 rounded-full font-black">HIGH CONVICTION</div>
          </div>
          <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Best Accuracy Scan</div>
          <div className="text-[15px] font-black tracking-tight truncate mb-1">
            {bestScan ? bestScan.token_name : "None Yet"}
          </div>
          <div className="text-[11px] text-purple-400 font-black uppercase tracking-[0.2em]">
            Score: {bestScan ? bestScan.score : 0}
          </div>
        </div>
      </div>

      {/* NEW SECONDARY STATS BAR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-up [animation-delay:300ms]">
        <div className="glass px-6 py-4 rounded-2xl border border-border/40 flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-safe/10 text-safe group-hover:bg-safe/20 transition-colors">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">High Conviction Hits</div>
              <div className="text-xl font-black">Score {">"} 70: {highConvictionHits} Total</div>
            </div>
          </div>
          <div className="text-[10px] font-black bg-muted/30 px-3 py-1 rounded-lg">PRO ANALYST</div>
        </div>

        <div className="glass px-6 py-4 rounded-2xl border border-border/40 flex items-center justify-between group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Weekly Avg Scan</div>
              <div className="text-xl font-black">{dailyAverage} Avg Scans / Day</div>
              <div className="text-[9px] text-primary/60 font-bold uppercase tracking-widest">{weeklyScans} Total This Week</div>
            </div>
          </div>
          <Award className="w-8 h-8 text-white/5 -rotate-12 group-hover:text-white/10 transition-colors" />
        </div>
      </div>

      {/* DISCONNECT OPTION */}
      <div className="flex justify-center md:justify-end">
        <form action="/api/auth/signout" method="POST">
          <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-danger transition-colors bg-muted/20 px-4 py-2 rounded-lg border border-border/40">
            <LogOut className="w-3 h-3" /> Disconnect Session
          </button>
        </form>
      </div>

      {/* RECENT SCANS SECTION */}
      <div className="animate-fade-up [animation-delay:400ms]">
        <RecentActivity userId={session.user.id} />
      </div>
    </div>
  )
}

