import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import CredentialsProvider from "next-auth/providers/credentials"
import { supabaseAdmin } from "./supabaseAdmin"

// Extend NextAuth Session typings to include our tracked Supabase UUID natively
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      wallet?: string | null
    }
  }
}

/**
 * HELPER: Synchronize NextAuth user identity with Supabase native storage
 */
export async function getOrCreateUser(userData: {
  email?: string | null;
  name?: string | null;
  wallet?: string | null;
}) {
  const { email, name, wallet } = userData;

  try {
    // 1. Check for existing record
    let query = supabaseAdmin.from("users").select("*");
    if (wallet) {
      query = query.eq("wallet", wallet);
    } else if (email) {
      query = query.eq("email", email);
    } else {
      return null;
    }

    const { data: existingUser } = await query.single();

    if (existingUser) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[AUTH] USER FETCHED: ${existingUser.username}`);
      }
      return existingUser;
    }

    // 2. Create new record if not found
    const username = wallet
      ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
      : (name || email?.split("@")[0] || "Trader");

    const { data: newUser, error: createErr } = await supabaseAdmin
      .from("users")
      .insert({
        email: wallet ? null : email,
        username,
        wallet: wallet || null,
      })
      .select()
      .single();

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

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
    }),
    CredentialsProvider({
      id: "solana",
      name: "Solana Wallet",
      credentials: {
        address: { label: "Wallet Address", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.address) return null
        return {
          id: credentials.address,
          name: "Solana User",
          email: `${credentials.address}@solana.wallet`,
          image: null,
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      const isWallet = account?.provider === "solana";

      const dbUser = await getOrCreateUser({
        email: isWallet ? null : user.email,
        name: user.name,
        wallet: isWallet ? user.id : null,
      });

      if (dbUser) {
        user.id = dbUser.id; // Correctly map Supabase UUID to session object
        return true;
      }

      return false;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id; // Persist Supabase UUID
        token.provider = account?.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // Fetch wallet from DB for every session refresh
        try {
          const { data } = await supabaseAdmin
            .from("users")
            .select("wallet")
            .eq("id", token.id)
            .single();
          session.user.wallet = data?.wallet || null;
        } catch {
          session.user.wallet = null;
        }
      }
      return session;
    }
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  }
}
