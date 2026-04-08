import { supabaseAdmin } from "./supabaseAdmin"
import { verifyPrivyToken, verifyPrivyTokenString, privyClient } from "./privy"

function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };

  const combined = [maybeError.message, maybeError.details, maybeError.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    maybeError.code === "42703" ||
    maybeError.code === "PGRST204" ||
    combined.includes(columnName.toLowerCase())
  );
}

/**
 * HELPER: Synchronize Privy user identity with Supabase native storage.
 * Maps Privy login methods (email, wallet, twitter, etc.) to our users table.
 */
export async function getOrCreateUser(userData: {
  email?: string | null;
  name?: string | null;
  wallet?: string | null;
  twitterHandle?: string | null;
}) {
  const { email, name, wallet, twitterHandle } = userData;

  try {
    // 1. Check for existing record — try wallet first, then email
    let existingUser = null;

    if (wallet) {
      const { data } = await supabaseAdmin.from("users").select("*").eq("wallet", wallet).single();
      existingUser = data;
    }

    if (!existingUser && email) {
      const { data } = await supabaseAdmin.from("users").select("*").eq("email", email).single();
      existingUser = data;
    }

    if (existingUser) {
      // Update twitter handle if newly available
      if (twitterHandle && !existingUser.twitter_handle) {
        const { error: updateErr } = await supabaseAdmin
          .from("users")
          .update({ twitter_handle: twitterHandle })
          .eq("id", existingUser.id);

        if (updateErr && !isMissingColumnError(updateErr, "twitter_handle")) {
          console.error("[AUTH] Failed to update twitter handle:", updateErr);
        }
      }
      return existingUser;
    }

    if (!wallet && !email) return null;

    // 2. Create new record if not found
    const username = wallet
      ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
      : twitterHandle
        ? `@${twitterHandle}`
        : (name || email?.split("@")[0] || "Trader");

    let { data: newUser, error: createErr } = await supabaseAdmin
      .from("users")
      .insert({
        email: wallet ? null : email,
        username,
        wallet: wallet || null,
        twitter_handle: twitterHandle || null,
      })
      .select()
      .single();

    if (createErr && isMissingColumnError(createErr, "twitter_handle")) {
      const retryResult = await supabaseAdmin
        .from("users")
        .insert({
          email: wallet ? null : email,
          username,
          wallet: wallet || null,
        })
        .select()
        .single();

      newUser = retryResult.data;
      createErr = retryResult.error;
    }

    if (createErr || !newUser) {
      console.error("[AUTH] USER CREATION FAILED:", createErr);
      return null;
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`[AUTH] USER CREATED: ${newUser.username}`);
    }

    // 3. Initialize default analytics row
    const { error: statsErr } = await supabaseAdmin.from("user_stats").insert({
      user_id: newUser.id,
      total_scans: 0,
      detection_rate: 0,
      streak: 0,
      rank: 0,
      weekly_avg: 0,
    });

    if (statsErr) console.error("[AUTH] STATS INIT FAILED:", statsErr);

    return newUser;
  } catch (err) {
    console.error("[AUTH] Fatal database handshake error:", err);
    return null;
  }
}

/**
 * Server-side helper: verify Privy token from request and return Supabase user.
 * Used in all protected API routes to resolve the signed-in user.
 */
export async function getAuthUser(req: Request) {
  const claims = await verifyPrivyToken(req);
  if (!claims) return null;

  try {
    const privyUser = await privyClient.getUser(claims.userId);

    const email = privyUser.email?.address || null;
    const wallet = privyUser.wallet?.address || null;
    const twitterHandle = privyUser.twitter?.username || null;
    const name = privyUser.google?.name || privyUser.github?.username || twitterHandle || null;

    const dbUser = await getOrCreateUser({ email, name, wallet, twitterHandle });
    return dbUser;
  } catch (err) {
    console.error("[AUTH] Failed to resolve Privy user:", err);
    return null;
  }
}

/**
 * Server-side helper for Server Components: verify Privy token from cookies.
 * Use in pages that need auth without a Request object (e.g. profile page).
 */
export async function getAuthUserFromCookies() {
  // Dynamic import to avoid bundling next/headers in client components
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get("privy-token")?.value;
  if (!token) return null;

  const claims = await verifyPrivyTokenString(token);
  if (!claims) return null;

  try {
    const privyUser = await privyClient.getUser(claims.userId);

    const email = privyUser.email?.address || null;
    const wallet = privyUser.wallet?.address || null;
    const twitterHandle = privyUser.twitter?.username || null;
    const name = privyUser.google?.name || privyUser.github?.username || twitterHandle || null;

    return await getOrCreateUser({ email, name, wallet, twitterHandle });
  } catch (err) {
    console.error("[AUTH] Failed to resolve Privy user from cookies:", err);
    return null;
  }
}
