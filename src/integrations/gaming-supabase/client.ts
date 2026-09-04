// Browser client for Gaming Supabase Realtime (Nearby transfer).
//
// IMPORTANT:
// - These are public/browser-safe Supabase values.
// - NEVER put GAMING_SUPABASE_SERVICE_ROLE_KEY in this file.
// - Vite requires VITE_* variables to be referenced statically.

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const url = import.meta.env['VITE_GAMING_SUPABASE_URL'];
const anonKey = import.meta.env['VITE_GAMING_SUPABASE_ANON_KEY'];

let client: SupabaseClient | null = null;

function getGamingConfig() {
  const gamingUrl = String(url ?? "").trim();
  const gamingAnonKey = String(anonKey ?? "").trim();

  if (!gamingUrl || !gamingAnonKey) {
    throw new Error(
      "Gaming Supabase is not configured. Make sure VITE_GAMING_SUPABASE_URL and VITE_GAMING_SUPABASE_ANON_KEY are configured in Vercel and redeploy the application.",
    );
  }

  return {
    url: gamingUrl,
    anonKey: gamingAnonKey,
  };
}

export function getGamingSupabaseBrowser(): SupabaseClient {
  if (client) {
    return client;
  }

  const config = getGamingConfig();

  client = createClient(
    config.url,
    config.anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  return client;
}

export function isGamingBrowserConfigured(): boolean {
  return Boolean(
    String(url ?? "").trim() &&
      String(anonKey ?? "").trim(),
  );
}