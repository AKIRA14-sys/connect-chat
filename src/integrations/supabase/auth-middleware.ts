// src/integrations/supabase/auth-attacher.ts

import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

/**
 * Attach the current Supabase access token to every TanStack
 * server-function request.
 *
 * This is especially important for the Capacitor Android APK:
 * Supabase Auth stores the session locally, while TanStack server
 * functions require the user's JWT in the Authorization header.
 */
export const attachSupabaseAuth = createMiddleware({
  type: "function",
}).client(async ({ next }) => {
  let accessToken: string | null = null;

  try {
    /*
     * First use the current locally stored session.
     */
    const {
      data: { session },
    } = await supabase.auth.getSession();

    accessToken = session?.access_token ?? null;

    /*
     * If there is no token, try refreshing the session.
     *
     * This helps native Capacitor sessions that may have a
     * temporarily stale/missing access token.
     */
    if (!accessToken) {
      const {
        data: { session: refreshedSession },
      } = await supabase.auth.refreshSession();

      accessToken = refreshedSession?.access_token ?? null;
    }
  } catch (error) {
    console.error("[Supabase Auth] Failed to prepare server-function auth:", error);
  }

  /*
   * TanStack Start will send this Authorization header to the
   * server-side requireSupabaseAuth middleware.
   */
  return next({
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : {},
  });
});