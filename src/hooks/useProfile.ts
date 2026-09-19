import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Profile } from "@/lib/whatsxup";
import { isMasterAdminEmail } from "@/lib/masterAdmin";
import {
  loadCachedSnapshot,
  saveCachedSnapshot,
} from "@/lib/offlineCache";

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    networkMode: "offlineFirst",
    placeholderData: () =>
      user?.id
        ? loadCachedSnapshot<Profile>(`profile.${user.id}`)
        : undefined,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user!.id)
          .maybeSingle();
        if (error) throw error;
        if (data && user?.id) {
          saveCachedSnapshot(`profile.${user.id}`, data);
        }
        return data as Profile | null;
      } catch (e) {
        const cached = user?.id
          ? loadCachedSnapshot<Profile>(`profile.${user.id}`)
          : undefined;
        if (cached) return cached;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          return null;
        }
        throw e;
      }
    },
  });
}

/** Admin if Vercel email matches, or DB is_admin (for when you restore Supabase roles). */
export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-admin", user?.id, user?.email],
    enabled: !!user,
    networkMode: "offlineFirst",
    queryFn: async () => {
      if (isMasterAdminEmail(user?.email)) return true;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return isMasterAdminEmail(user?.email);
      }
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
