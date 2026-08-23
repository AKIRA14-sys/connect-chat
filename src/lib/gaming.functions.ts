import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gamingSupabaseAdmin } from "@/integrations/gaming-supabase/client.server";

export const ensureGamingProfile = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;

    const { data, error } =
      await gamingSupabaseAdmin.rpc(
        "ensure_gaming_profile",
        {
          p_user_id: userId,
        },
      );

    if (error) {
      console.error(
        "Failed to ensure gaming profile:",
        error,
      );

      throw new Error(
        "Unable to create gaming profile",
      );
    }

    return {
      success: true,
      profile: data,
    };
  });