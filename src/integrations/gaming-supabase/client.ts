// Browser client for Gaming Supabase Realtime (Nearby transfer signaling).
// Env: VITE_GAMING_SUPABASE_URL + VITE_GAMING_SUPABASE_ANON_KEY

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readEnv(name: string): string {
  try {
    const meta = import.meta as ImportMeta & { env?: Record<string, string> };
    if (meta.env && meta.env[name]) return String(meta.env[name]);
  } catch {
    /* ignore */
  }
  if (typeof process !== "undefined" && process.env && process.env[name]) {
    return String(process.env[name]);
  }
  return "";
}

const url =
  readEnv("VITE_GAMING_SUPABASE_URL") || readEnv("GAMING_SUPABASE_URL");
const anon =
  readEnv("VITE_GAMING_SUPABASE_ANON_KEY") ||
  readEnv("GAMING_SUPABASE_ANON_KEY");

let client: SupabaseClient | null = null;

export function getGamingSupabaseBrowser(): SupabaseClient {
  if (client) return client;
  if (!url || !anon) {
    throw new Error(
      "Set VITE_GAMING_SUPABASE_URL and VITE_GAMING_SUPABASE_ANON_KEY for Nearby transfer.",
    );
  }
  client = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export function isGamingBrowserConfigured(): boolean {
  return Boolean(url && anon);
}
