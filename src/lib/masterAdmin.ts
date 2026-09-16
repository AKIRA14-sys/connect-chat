/**
 * Single master admin — identified by email (env), not a public "claim" button.
 *
 * Set in Vercel / Lovable / .env (NO Supabase dashboard needed):
 *   VITE_MASTER_ADMIN_EMAIL=you@example.com
 *
 * That account must sign up / sign in with the normal email + password flow.
 * Only this email is treated as app admin in the UI.
 */

export function getMasterAdminEmail(): string {
  try {
    const raw =
      (import.meta as { env?: Record<string, string> }).env?.[
        "VITE_MASTER_ADMIN_EMAIL"
      ] ?? "";
    return String(raw).trim().toLowerCase();
  } catch {
    return "";
  }
}

export function isMasterAdminEmail(email: string | null | undefined): boolean {
  const master = getMasterAdminEmail();
  if (!master) return false;
  if (!email) return false;
  return email.trim().toLowerCase() === master;
}
