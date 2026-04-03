import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Ensure the variables are active on the server
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables natively mapping to .env.local")
}

export const supabase = createClient(supabaseUrl, supabaseKey)
