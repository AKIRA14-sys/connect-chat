// src/integrations/gaming-supabase/client.ts
// Browser client for gaming project (Realtime + optional public ops).
// Set in .env / host env:
//   VITE_GAMING_SUPABASE_URL
//   VITE_GAMING_SUPABASE_ANON_KEY
// (from Gaming Supabase → Settings → API)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_GAMING_SUPABASE_URL) ||
  (typeof process !== "undefined" && process.env?.VITE_GAMING_SUPABASE_URL) ||
  (typeof process !== "undefined" && process.env?.GAMING_SUPABASE_URL) ||
  "";

const anon =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_GAMING_SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" && process.env?.VITE_GAMING_SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" && process.env?.GAMING_SUPABASE_ANON_KEY) ||
  "";

let _client: SupabaseClient | null = null;

export function getGamingSupabaseBrowser(): SupabaseClient {
  if (_client) return _client;
  if (!url || !anon) {
    throw new Error(
      "Gaming Supabase is not configured. Set VITE_GAMING_SUPABASE_URL and VITE_GAMING_SUPABASE_ANON_KEY.",
    );
  }
  _client = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

export function isGamingBrowserConfigured(): boolean {
  return Boolean(url && anon);
}
