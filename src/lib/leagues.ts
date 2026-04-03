export interface LeagueTier {
  name: string;
  sub: string;
  color: string;
  bg: string;
  border: string;
}

export const LEAGUES: Record<string, LeagueTier> = {
  DIAMOND: { name: "Diamond", sub: "Elite Hunter", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
  PLATINUM: { name: "Platinum", sub: "Skilled Analyst", color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20" },
  GOLD: { name: "Gold", sub: "Tactical Scout", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" },
  SILVER: { name: "Silver", sub: "Reliable Node", color: "text-slate-400", bg: "bg-slate-400/10", border: "border-slate-400/20" },
  BRONZE: { name: "Bronze", sub: "Initiate Scout", color: "text-amber-700", bg: "bg-amber-700/10", border: "border-amber-700/20" },
};

/**
 * Assigns a league based strictly on scan volume (Leaderboard-style logic)
 * Diamond: 1000+ scans
 * Platinum: 500+ scans
 * Gold: 200+ scans
 * Silver: 50+ scans
 */
export function getLeague(scans: number): LeagueTier {
  if (scans >= 1000) return LEAGUES.DIAMOND;
  if (scans >= 500) return LEAGUES.PLATINUM;
  if (scans >= 200) return LEAGUES.GOLD;
  if (scans >= 50) return LEAGUES.SILVER;
  return LEAGUES.BRONZE;
}
