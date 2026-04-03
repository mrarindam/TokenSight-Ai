import { supabase } from "./supabaseClient";

/**
 * STRICT DAILY STREAK & WEIGHTED ACCURACY SYSTEM
 */
export async function updateStreak(userId: string, riskScore: number = 0, tokenName: string = "") {
  try {
    // 1. DUPLICATION CHECK (Rule 4: Exclude same token within 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Check if this token was scanned by this user in last 24h
    // Since we called after insert, we check for count > 1
    const { count: dupCount } = await supabase
      .from("scans")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("token_name", tokenName)
      .gte("created_at", twentyFourHoursAgo);

    const isDuplicate = (dupCount || 0) > 1;

    // 2. GET CURRENT USER STATS
    const { data: stats, error: statsErr } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (statsErr) throw statsErr;

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split("T")[0];

    // Handle missing stats record (First Scan ever)
    if (!stats) {
      let weight = 0.1;
      if (riskScore > 70) weight = 1.0;
      else if (riskScore >= 40) weight = 0.5;

      const weightedScore = riskScore * weight;

      await supabase.from("user_stats").insert({
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
    const lastUpdateDate = stats.updated_at ? stats.updated_at.split("T")[0] : null;

    if (!lastUpdateDate) {
      newStreak = 1;
    } else if (lastUpdateDate === today) {
      // Maintain current streak if already scanned today
      newStreak = currentStreak > 0 ? currentStreak : 1;
    } else if (lastUpdateDate === yesterday) {
      // Consecutive day: increment
      newStreak = (currentStreak || 0) + 1;
    } else {
      // Gap detected: reset
      newStreak = 0;
    }

    // 5. UPDATE DATABASE
    const { error: updateErr } = await supabase
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
