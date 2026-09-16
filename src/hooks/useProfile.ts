import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Profile } from "@/lib/whatsxup";
import { isMasterAdminEmail } from "@/lib/masterAdmin";

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

/** Admin if Vercel email matches, or DB is_admin (for when you restore Supabase roles). */
export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-admin", user?.id, user?.email],
    enabled: !!user,
    queryFn: async () => {
      if (isMasterAdminEmail(user?.email)) return true;
      try {
        const { data, error } = await supabase.rpc("is_admin", {
          _user_id: user!.id,
        });
        if (!error && data) return true;
      } catch {
        /* ignore */
      }
      return false;
    },
  });
}
