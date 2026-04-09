import { supabaseAdmin } from "./supabaseAdmin"
import { verifyPrivyToken, verifyPrivyTokenString, privyClient } from "./privy"

type PrivyLinkedAccount = {
  type?: string;
  address?: string | null;
  email?: string | null;
  username?: string | null;
  name?: string | null;
};

type PrivyResolvedIdentity = {
  email: string | null;
  name: string | null;
  wallet: string | null;
  twitterHandle: string | null;
};

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;

  const prefix = `${name}=`;
  const parts = cookieHeader.split(";");

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }

  return null;
}

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

async function findExistingUserByField(field: "privy_id" | "wallet" | "email" | "twitter_handle", value: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq(field, value)
    .order("created_at", { ascending: true })
    .limit(2);

  if (error) {
    console.error(`[AUTH] Failed user lookup by ${field}:`, error);
    return null;
  }

  if ((data || []).length > 1) {
    console.warn(`[AUTH] Duplicate user rows found for ${field}. Reusing the oldest record to avoid account drift.`);
  }

  return data?.[0] || null;
}

function resolvePrivyIdentity(privyUser: {
  email?: { address?: string | null };
  wallet?: { address?: string | null };
  google?: { email?: string | null; name?: string | null };
  github?: { email?: string | null; username?: string | null; name?: string | null };
  twitter?: { username?: string | null; name?: string | null };
  linkedAccounts?: PrivyLinkedAccount[];
}): PrivyResolvedIdentity {
  let email = privyUser.email?.address || privyUser.google?.email || privyUser.github?.email || null;
  let wallet = privyUser.wallet?.address || null;
  let twitterHandle = privyUser.twitter?.username || null;
  let name =
    privyUser.google?.name ||
    privyUser.github?.name ||
    privyUser.github?.username ||
    privyUser.twitter?.name ||
    twitterHandle ||
    null;

  for (const account of privyUser.linkedAccounts || []) {
    if (!wallet && account.type === "wallet" && account.address) {
      wallet = account.address;
    }

    if (!email && ["email", "google_oauth", "github_oauth", "apple_oauth", "linkedin_oauth", "discord_oauth"].includes(account.type || "") && account.email) {
      email = account.email;
    }

    if (!twitterHandle && account.type === "twitter_oauth" && account.username) {
      twitterHandle = account.username;
    }

    if (!name && account.name) {
      name = account.name;
    }
  }

  return { email, name, wallet, twitterHandle };
}

/**
 * HELPER: Synchronize Privy user identity with Supabase native storage.
 * Maps Privy login methods (email, wallet, twitter, etc.) to our users table.
 */
export async function getOrCreateUser(userData: {
  privyId?: string | null;
  email?: string | null;
  name?: string | null;
  wallet?: string | null;
  twitterHandle?: string | null;
}) {
  const { privyId, email, name, wallet, twitterHandle } = userData;

  try {
    // 1. Check for existing record — try Privy user ID first, then wallet, email, and X handle
    let existingUser = null;

    if (privyId) {
      existingUser = await findExistingUserByField("privy_id", privyId);
    }

    if (!existingUser && wallet) {
      existingUser = await findExistingUserByField("wallet", wallet);
    }

    if (!existingUser && email) {
      existingUser = await findExistingUserByField("email", email);
    }

    if (!existingUser && twitterHandle) {
      existingUser = await findExistingUserByField("twitter_handle", twitterHandle);
    }

    if (existingUser) {
      const patch: { email?: string; wallet?: string; twitter_handle?: string; username?: string; privy_id?: string } = {};

      if (privyId && !existingUser.privy_id) {
        patch.privy_id = privyId;
      }

      if (email && !existingUser.email) {
        patch.email = email;
      }

      if (wallet && !existingUser.wallet) {
        patch.wallet = wallet;
      }

      if (twitterHandle && !existingUser.twitter_handle) {
        patch.twitter_handle = twitterHandle;
      }

      if (!existingUser.username && (name || twitterHandle || email || wallet)) {
        patch.username = wallet
          ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
          : twitterHandle
            ? `@${twitterHandle}`
            : (name || email?.split("@")[0] || "Trader");
      }

      if (Object.keys(patch).length > 0) {
        const { error: updateErr } = await supabaseAdmin
          .from("users")
          .update(patch)
          .eq("id", existingUser.id);

        if (updateErr && !isMissingColumnError(updateErr, "twitter_handle") && !isMissingColumnError(updateErr, "privy_id")) {
          console.error("[AUTH] Failed to update existing user:", updateErr);
        }
      }

      return existingUser;
    }

    if (!privyId && !wallet && !email && !twitterHandle) return null;

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
        privy_id: privyId || null,
        twitter_handle: twitterHandle || null,
      })
      .select()
      .single();

    if (
      createErr &&
      (isMissingColumnError(createErr, "twitter_handle") || isMissingColumnError(createErr, "privy_id"))
    ) {
      const fallbackInsert: {
        email: string | null;
        username: string;
        wallet: string | null;
        privy_id?: string | null;
        twitter_handle?: string | null;
      } = {
        email: wallet ? null : (email || null),
        username,
        wallet: wallet || null,
      };

      if (!isMissingColumnError(createErr, "privy_id")) {
        fallbackInsert.privy_id = privyId || null;
      }

      if (!isMissingColumnError(createErr, "twitter_handle")) {
        fallbackInsert.twitter_handle = twitterHandle || null;
      }

      const retryResult = await supabaseAdmin
        .from("users")
        .insert(fallbackInsert)
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
  const cookieHeader = req.headers.get("cookie");
  const idToken = getCookieValue(cookieHeader, "privy-id-token");

  if (!claims && !idToken) return null;

  try {
    let privyUser;

    if (claims?.userId) {
      privyUser = await privyClient.getUser(claims.userId);
    } else {
      privyUser = await privyClient.getUser({ idToken: idToken! });
    }

    const { email, name, wallet, twitterHandle } = resolvePrivyIdentity(privyUser);

    const dbUser = await getOrCreateUser({ privyId: privyUser.id, email, name, wallet, twitterHandle });
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
  const idToken = cookieStore.get("privy-id-token")?.value;
  const accessToken = cookieStore.get("privy-token")?.value;

  if (!idToken && !accessToken) return null;

  try {
    let privyUser;

    if (idToken) {
      privyUser = await privyClient.getUser({ idToken });
    } else {
      const claims = await verifyPrivyTokenString(accessToken!);
      if (!claims?.userId) return null;
      privyUser = await privyClient.getUser(claims.userId);
    }

    const { email, name, wallet, twitterHandle } = resolvePrivyIdentity(privyUser);

    return await getOrCreateUser({ privyId: privyUser.id, email, name, wallet, twitterHandle });
  } catch (err) {
    console.error("[AUTH] Failed to resolve Privy user from cookies:", err);
    return null;
  }
}
