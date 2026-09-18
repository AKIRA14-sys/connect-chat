import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gamingSupabaseAdmin } from "@/integrations/gaming-supabase/client.server";

const UNLIMITED_BALANCE = 9_999_999;

function masterEmailAllowed(claimsEmail: string | undefined): boolean {
  const allowed = String(
    process.env["MASTER_ADMIN_EMAIL"] ||
      process.env["VITE_MASTER_ADMIN_EMAIL"] ||
      "",
  )
    .trim()
    .toLowerCase();
  if (!allowed) return true;
  if (!claimsEmail) return false;
  return claimsEmail.trim().toLowerCase() === allowed;
}

function emailFromClaims(claims: unknown): string | undefined {
  if (!claims || typeof claims !== "object") return undefined;
  const c = claims as Record<string, unknown>;
  if (typeof c.email === "string") return c.email;
  return undefined;
}

function assertAdmin(context: { claims?: unknown }) {
  const email = emailFromClaims(context.claims);
  if (!masterEmailAllowed(email)) {
    throw new Error("Not authorised");
  }
}

/** Read unlimited-coins flag for the signed-in admin. */
export const getAdminUnlimitedCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context as { claims?: unknown });
    const userId = (context as { userId: string }).userId;

    const { data, error } = await gamingSupabaseAdmin
      .from("admin_runtime_flags")
      .select("unlimited_coins, coins_before_unlimited")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // Table may not exist yet
      console.warn("[getAdminUnlimitedCoins]", error.message);
      return { enabled: false, balanceHint: null as number | null };
    }

    return {
      enabled: Boolean(data?.unlimited_coins),
      balanceHint:
        data?.coins_before_unlimited != null
          ? Number(data.coins_before_unlimited)
          : null,
    };
  });

/**
 * Toggle unlimited X coins for the admin only.
 * ON  → snapshot current balance, set x_coins to a huge number
 * OFF → restore snapshot (or leave as-is if missing)
 */
export const setAdminUnlimitedCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enabled: boolean }) => {
    if (!input || typeof input.enabled !== "boolean") {
      throw new Error("enabled boolean required");
    }
    return { enabled: input.enabled };
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context as { claims?: unknown });
    const userId = (context as { userId: string }).userId;

    const { data: profile, error: pErr } = await gamingSupabaseAdmin
      .from("gaming_profiles")
      .select("user_id, x_coins")
      .eq("user_id", userId)
      .maybeSingle();

    if (pErr) throw new Error(pErr.message);

    if (!profile) {
      // Ensure profile exists
      await gamingSupabaseAdmin.rpc("ensure_gaming_profile", {
        p_user_id: userId,
      });
    }

    const { data: profile2 } = await gamingSupabaseAdmin
      .from("gaming_profiles")
      .select("user_id, x_coins")
      .eq("user_id", userId)
      .maybeSingle();

    const current = Number(profile2?.x_coins ?? 0);

    if (data.enabled) {
      const { data: existing } = await gamingSupabaseAdmin
        .from("admin_runtime_flags")
        .select("coins_before_unlimited, unlimited_coins")
        .eq("user_id", userId)
        .maybeSingle();

      const snapshot =
        existing?.unlimited_coins
          ? existing.coins_before_unlimited
          : current;

      const { error: upFlag } = await gamingSupabaseAdmin
        .from("admin_runtime_flags")
        .upsert(
          {
            user_id: userId,
            unlimited_coins: true,
            coins_before_unlimited: snapshot,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      if (upFlag) throw new Error(upFlag.message);

      const { error: upCoins } = await gamingSupabaseAdmin
        .from("gaming_profiles")
        .update({ x_coins: UNLIMITED_BALANCE })
        .eq("user_id", userId);
      if (upCoins) throw new Error(upCoins.message);

      return {
        enabled: true,
        x_coins: UNLIMITED_BALANCE,
        message: "Unlimited coins ON — you can test the shop freely",
      };
    }

    // OFF — restore
    const { data: flag } = await gamingSupabaseAdmin
      .from("admin_runtime_flags")
      .select("coins_before_unlimited")
      .eq("user_id", userId)
      .maybeSingle();

    const restore =
      flag?.coins_before_unlimited != null
        ? Number(flag.coins_before_unlimited)
        : 0;

    const { error: upFlag } = await gamingSupabaseAdmin
      .from("admin_runtime_flags")
      .upsert(
        {
          user_id: userId,
          unlimited_coins: false,
          coins_before_unlimited: restore,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (upFlag) throw new Error(upFlag.message);

    const { error: upCoins } = await gamingSupabaseAdmin
      .from("gaming_profiles")
      .update({ x_coins: restore })
      .eq("user_id", userId);
    if (upCoins) throw new Error(upCoins.message);

    return {
      enabled: false,
      x_coins: restore,
      message: "Unlimited coins OFF — balance restored",
    };
  });
