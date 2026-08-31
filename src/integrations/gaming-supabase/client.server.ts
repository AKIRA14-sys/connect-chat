import { createClient } from "@supabase/supabase-js";

const gamingSupabaseUrl = process.env.GAMING_SUPABASE_URL;
const gamingSupabaseServiceRoleKey =
  process.env.GAMING_SUPABASE_SERVICE_ROLE_KEY;

if (!gamingSupabaseUrl) {
  throw new Error("GAMING_SUPABASE_URL is missing");
}

if (!gamingSupabaseServiceRoleKey) {
  throw new Error("GAMING_SUPABASE_SERVICE_ROLE_KEY is missing");
}

export const gamingSupabaseAdmin = createClient(
  gamingSupabaseUrl,
  gamingSupabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
