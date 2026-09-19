import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  appendCachedMessage,
  touchCachedChatListPreview,
} from "@/lib/offlineCache";

/**
 * WhatsApp-style offline prep on THIS phone:
 * While ONLINE, any new message in your chats is saved to the offline cache
 * even if you never open that chat. Then offline you can still read it.
 *
 * Mount once under AuthProvider (e.g. in __root next to RealtimeProvider).
 */
export function MessageOfflineSync() {
  const { user } = useAuth();
  const ready = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function start() {
      const { data: memberships, error } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user!.id);

      if (error || cancelled) return;
      const ids = (memberships ?? [])
        .map((m) => m.conversation_id)
        .filter(Boolean) as string[];

      if (!ids.length) return;

      // Supabase filter: conversation_id=in.(uuid,uuid,...)
      // Cap filter size — refresh periodically via membership changes
      const batch = ids.slice(0, 80);
      const filter = `conversation_id=in.(${batch.join(",")})`;

      channel = supabase
        .channel(`offline-sync-${user!.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter,
          },
          (payload) => {
            const row = payload.new as {
              id: string;
              conversation_id: string;
              content?: string | null;
              sender_id?: string;
              created_at?: string;
              type?: string;
            };
            if (!row?.conversation_id) return;
            appendCachedMessage(row.conversation_id, row);
            const preview = (row.content || "[message]").slice(0, 80);
            touchCachedChatListPreview(
              user!.id,
              row.conversation_id,
              preview,
              row.created_at || new Date().toISOString(),
            );
          },
        )
        .subscribe();

      ready.current = true;
    }

    void start();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return null;
}
