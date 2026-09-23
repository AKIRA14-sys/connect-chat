// src/integrations/supabase/auth-middleware.ts

import { createMiddleware } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Server-side authentication middleware for TanStack Start server functions.
 *
 * It reads the Supabase access token from the Authorization header,
 * verifies the user with Supabase Auth, and exposes:
 *
 *   context.supabase
 *   context.userId
 *   context.claims
 *
 * to authenticated server functions.
 */

function getSupabaseConfig() {
  const url =
    process.env["SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"] ||
    import.meta.env["VITE_SUPABASE_URL"];

  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variables: SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  return { url, key };
}

/**
 * Require an authenticated Supabase user.
 *
 * Used by:
 *
 *   .middleware([requireSupabaseAuth])
 */
export const requireSupabaseAuth = createMiddleware({
  type: "function",
}).server(async ({ request, next }) => {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    throw new Error("Authentication required");
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new Error("Invalid authorization header");
  }

  const accessToken = match[1]?.trim();

  if (!accessToken) {
    throw new Error("Missing access token");
  }

  const { url, key } = getSupabaseConfig();

  /*
   * Create a user-scoped Supabase client.
   *
   * The caller's JWT is sent with every request so Supabase RLS
   * evaluates the request as the authenticated user.
   */
  const userSupabase = createClient<Database>(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  /*
   * Verify the JWT with Supabase Auth.
   */
  const {
    data: { user },
    error,
  } = await userSupabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new Error("Invalid or expired authentication session");
  }

  /*
   * Make authenticated user information available to server functions.
   */
  return next({
    context: {
      supabase: userSupabase,
      userId: user.id,
      claims: {
        sub: user.id,
        email: user.email,
        role: user.role,
        aud: user.aud,
        app_metadata: user.app_metadata,
        user_metadata: user.user_metadata,
      },
    },
  });
});

/**
 * Client-side auth attacher.
 *
 * Kept here for compatibility with any existing imports.
 * The main application currently uses the dedicated
 * auth-attacher.ts for this behavior.
 */
export const attachSupabaseAuth = createMiddleware({
  type: "function",
}).client(async ({ next }) => {
  return next();
});