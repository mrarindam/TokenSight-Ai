import { supabaseAdmin } from "./supabaseAdmin";

type UserScanRow = {
  token_name: string | null;
  created_at: string;
};

function getUtcDayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().split("T")[0];
}

function shiftUtcDay(dayKey: string, dayDelta: number): string {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayDelta);
  return getUtcDayKey(date);
}

function buildValidScanDays(scans: UserScanRow[]): Set<string> {
  const lastAcceptedByToken = new Map<string, number>();
  const validDayKeys = new Set<string>();

  for (const scan of scans) {
    const tokenName = (scan.token_name || "unknown-token").trim().toLowerCase();
    const createdAtMs = new Date(scan.created_at).getTime();
    if (!Number.isFinite(createdAtMs)) continue;

    const lastAcceptedMs = lastAcceptedByToken.get(tokenName);
    const isDuplicateWithin24Hours = lastAcceptedMs !== undefined && (createdAtMs - lastAcceptedMs) < 24 * 60 * 60 * 1000;

    if (isDuplicateWithin24Hours) {
      continue;
    }

    lastAcceptedByToken.set(tokenName, createdAtMs);
    validDayKeys.add(getUtcDayKey(scan.created_at));
  }

  return validDayKeys;
}

export async function getUserActiveStreak(userId: string, now = new Date()): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("scans")
    .select("token_name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const scans = (data || []) as UserScanRow[];
  if (scans.length === 0) return 0;

  const validDayKeys = buildValidScanDays(scans);
  if (validDayKeys.size === 0) return 0;

  const sortedDaysDesc = Array.from(validDayKeys).sort((left, right) => right.localeCompare(left));
  const latestValidDay = sortedDaysDesc[0];
  const todayKey = getUtcDayKey(now);
  const yesterdayKey = shiftUtcDay(todayKey, -1);

  if (latestValidDay !== todayKey && latestValidDay !== yesterdayKey) {
    return 0;
  }

  let streak = 0;
  let currentDay = latestValidDay;

  while (validDayKeys.has(currentDay)) {
    streak += 1;
    currentDay = shiftUtcDay(currentDay, -1);
  }

  return streak;
}

/**
 * STRICT DAILY STREAK & WEIGHTED ACCURACY SYSTEM
 */
export async function updateStreak(userId: string, riskScore: number = 0, tokenName: string = "") {
  try {
    // 1. DUPLICATION CHECK (Rule 4: Exclude same token within 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Check if this token was scanned by this user in last 24h
    // Since we called after insert, we check for count > 1
    const { count: dupCount } = await supabaseAdmin
      .from("scans")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("token_name", tokenName)
      .gte("created_at", twentyFourHoursAgo);

    const isDuplicate = (dupCount || 0) > 1;

    // 2. GET CURRENT USER STATS
    const { data: stats, error: statsErr } = await supabaseAdmin
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (statsErr) throw statsErr;

    const now = new Date();
    // Handle missing stats record (First Scan ever)
    if (!stats) {
      let weight = 0.1;
      if (riskScore > 70) weight = 1.0;
      else if (riskScore >= 40) weight = 0.5;

      const weightedScore = riskScore * weight;

      await supabaseAdmin.from("user_stats").insert({
        user_id: userId,
        total_scans: 1,
        streak: 1,
        detection_rate: parseFloat(weightedScore.toFixed(2)),
        updated_at: now.toISOString()
      });
      return 1;
    }

    const currentStreak = stats.streak || 0;
    let newStreak = currentStreak;
    let totalValidScans = stats.total_scans || 0;
    const currentAccuracy = stats.detection_rate || 0;
    let newAccuracy = currentAccuracy;

    // 3. ACCURACY CALCULATION (Weighted Running Average)
    if (!isDuplicate) {
      let weight = 0.1;
      if (riskScore > 70) weight = 1.0;
      else if (riskScore >= 40) weight = 0.5;

      const weightedScore = riskScore * weight;

      // Formula: ((currentAccuracy * totalValidScans) + weightedScore) / (totalValidScans + 1)
      newAccuracy = parseFloat(((currentAccuracy * totalValidScans + weightedScore) / (totalValidScans + 1)).toFixed(2));
      totalValidScans += 1;

      if (process.env.NODE_ENV === "development") {
        console.log("ACCURACY DEBUG:", {
          score: riskScore,
          weight,
          weightedScore,
          totalValidScans,
          newAccuracy
        });
      }
    } else {
      if (process.env.NODE_ENV === "development") {
        console.log(`[STREAK] Duplicate scan detected for ${tokenName}. Skipping accuracy update.`);
      }
    }

    // 4. STREAK LOGIC
    newStreak = await getUserActiveStreak(userId, now);

    // 5. UPDATE DATABASE
    const { error: updateErr } = await supabaseAdmin
      .from("user_stats")
      .update({
        streak: newStreak,
        total_scans: totalValidScans,
        detection_rate: newAccuracy,
        updated_at: now.toISOString(),
      })
      .eq("user_id", userId);

    if (updateErr) throw updateErr;

    return newStreak;
  } catch (error) {
    console.error("[STREAK] Update failed:", error);
    return 0;
  }
}
