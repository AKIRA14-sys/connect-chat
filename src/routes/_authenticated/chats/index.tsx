import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PenSquare, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/components/RealtimeProvider";
import { AppShell, PageHeader } from "@/components/AppShell";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  timeLabel,
  type Conversation,
  type Message,
  type Profile,
} from "@/lib/whatsxup";

export const Route = createFileRoute("/_authenticated/chats/")({
  head: () => ({
    meta: [
      { title: "Chats — WHATSXUP" },
      {
        name: "description",
        content:
          "All your WHATSXUP conversations and groups in one fast, real-time inbox.",
      },
      {
        property: "og:title",
        content: "Chats — WHATSXUP",
      },
      {
        property: "og:description",
        content:
          "All your conversations and groups in one real-time inbox.",
      },
    ],
  }),
  component: ChatsPage,
});

type Row = {
  conv: Conversation;
  title: string;
  avatar: string | null;
  otherId: string | null;
  last: Message | null;
  unread: number;
};

type MemberRow = {
  conversation_id: string;
  user_id: string;
};

function ChatsPage() {
  const { user } = useAuth();
  const { onlineIds } = useRealtime();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["chat-list", user?.id],
    enabled: !!user,

    queryFn: async (): Promise<Row[]> => {
      if (!user) return [];

      /*
       * ---------------------------------------------------------
       * 1. Get conversations belonging to the current user
       * ---------------------------------------------------------
       */

      const { data: mine, error: mineError } = await supabase
        .from("conversation_members")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id);

      if (mineError) throw mineError;

      const ids = (mine ?? []).map(
        (row) => row.conversation_id,
      );

      if (!ids.length) return [];

      /*
       * ---------------------------------------------------------
       * 2. Get conversations
       * ---------------------------------------------------------
       */

      const { data: convs, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .in("id", ids)
        .order("last_message_at", {
          ascending: false,
          nullsFirst: false,
        });

      if (convError) throw convError;

      /*
       * ---------------------------------------------------------
       * 3. Get conversation members WITHOUT relying on the
       *    profiles foreign-key relationship.
       *
       *    This is important because the previous code could
       *    receive profiles = null and display "Unknown".
       * ---------------------------------------------------------
       */

      const { data: memberRows, error: memberError } =
        await supabase
          .from("conversation_members")
          .select("conversation_id, user_id")
          .in("conversation_id", ids);

      if (memberError) throw memberError;

      const members = (memberRows ?? []) as MemberRow[];

      /*
       * ---------------------------------------------------------
       * 4. Find all OTHER user IDs that need profiles.
       * ---------------------------------------------------------
       */

      const otherUserIds = Array.from(
        new Set(
          members
            .filter((member) => member.user_id !== user.id)
            .map((member) => member.user_id),
        ),
      );

      /*
       * ---------------------------------------------------------
       * 5. Fetch the profiles directly.
       *
       *    This avoids depending on:
       *
       *    profiles:user_id(...)
       *
       *    from the previous implementation.
       * ---------------------------------------------------------
       */

      let profiles: Profile[] = [];

      if (otherUserIds.length > 0) {
        const { data: profileRows, error: profileError } =
          await supabase
            .from("profiles")
            .select("*")
            .in("id", otherUserIds);

        if (profileError) {
          console.error(
            "Could not load chat profiles:",
            profileError,
          );
        } else {
          profiles = (profileRows ?? []) as Profile[];
        }
      }

      /*
       * ---------------------------------------------------------
       * 6. Create a quick profile lookup.
       * ---------------------------------------------------------
       */

      const profileMap = new Map<string, Profile>();

      for (const profile of profiles) {
        profileMap.set(profile.id, profile);
      }

      /*
       * ---------------------------------------------------------
       * 7. Get recent messages.
       * ---------------------------------------------------------
       */

      const { data: msgs, error: messageError } =
        await supabase
          .from("messages")
          .select("*")
          .in("conversation_id", ids)
          .order("created_at", {
            ascending: false,
          })
          .limit(500);

      if (messageError) throw messageError;

      const allMessages = (msgs ?? []) as Message[];

      /*
       * ---------------------------------------------------------
       * 8. Read timestamps.
       * ---------------------------------------------------------
       */

      const readAt = new Map(
        (mine ?? []).map((row) => [
          row.conversation_id,
          row.last_read_at,
        ]),
      );

      /*
       * ---------------------------------------------------------
       * 9. Build the chat list.
       * ---------------------------------------------------------
       */

      return ((convs ?? []) as Conversation[]).map(
        (conv) => {
          const convMembers = members.filter(
            (member) =>
              member.conversation_id === conv.id,
          );

          const convMessages = allMessages
            .filter(
              (message) =>
                message.conversation_id === conv.id,
            )
            .sort((a, b) =>
              b.created_at.localeCompare(a.created_at),
            );

          const last = convMessages[0] ?? null;

          const since =
            readAt.get(conv.id) ??
            "1970-01-01T00:00:00.000Z";

          const unread = convMessages.filter(
            (message) =>
              message.sender_id !== user.id &&
              message.created_at > since,
          ).length;

          /*
           * Direct chat
           */
          if (conv.type !== "group") {
            const otherMember = convMembers.find(
              (member) =>
                member.user_id !== user.id,
            );

            const otherId =
              otherMember?.user_id ?? null;

            const profile = otherId
              ? profileMap.get(otherId)
              : undefined;

            /*
             * Prefer:
             *
             * display_name
             * username
             * fallback
             */

            const displayName =
              profile?.display_name?.trim();

            const username =
              profile?.username?.trim();

            const title =
              displayName ||
              username ||
              "Unknown";

            return {
              conv,
              title,
              avatar: profile?.avatar_url ?? null,
              otherId,
              last,
              unread,
            };
          }

          /*
           * Group chat
           */

          return {
            conv,
            title: conv.name?.trim() || "Group",
            avatar: conv.avatar_url ?? null,
            otherId: null,
            last,
            unread,
          };
        },
      );
    },
  });

  /*
   * -----------------------------------------------------------
   * Realtime updates
   * -----------------------------------------------------------
   */

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("chat-list-feed")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          void qc.invalidateQueries({
            queryKey: ["chat-list", user.id],
          });
        },
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
        },
        () => {
          void qc.invalidateQueries({
            queryKey: ["chat-list", user.id],
          });
        },
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        () => {
          /*
           * If someone changes their username or profile
           * picture, refresh the chat list automatically.
           */
          void qc.invalidateQueries({
            queryKey: ["chat-list", user.id],
          });
        },
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          void qc.invalidateQueries({
            queryKey: ["chat-list", user.id],
          });
        },
      )

      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc]);

  /*
   * -----------------------------------------------------------
   * Message preview
   * -----------------------------------------------------------
   */

  function preview(message: Message | null) {
    if (!message) {
      return "No messages yet";
    }

    if (message.deleted_at) {
      return "This message was deleted";
    }

    if (message.type === "image") {
      return "📷 Photo";
    }

    if (message.type === "video") {
      return "🎬 Video";
    }

    if (message.type === "audio") {
      return "🎙️ Voice note";
    }

    return message.content ?? "";
  }

  /*
   * -----------------------------------------------------------
   * UI
   * -----------------------------------------------------------
   */

  return (
    <AppShell>
      <PageHeader
        title="Chats"
        action={
          <div className="flex gap-2">
            <Button
              asChild
              size="sm"
              variant="outline"
            >
              <Link to="/groups/new">
                <Users className="h-4 w-4" />
                Group
              </Link>
            </Button>

            <Button asChild size="sm">
              <Link to="/contacts">
                <PenSquare className="h-4 w-4" />
                New
              </Link>
            </Button>
          </div>
        }
      />

      <NotificationPrompt />

      {isLoading ? (
        <div className="space-y-3 p-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-2xl bg-surface"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-10 text-center">
          <h2 className="text-lg font-semibold">
            No conversations yet
          </h2>

          <p className="text-sm text-muted-foreground">
            Find people by their username and start your
            first chat.
          </p>

          <Button asChild>
            <Link to="/contacts">
              Find people
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((row) => (
            <li key={row.conv.id}>
              <Link
                to="/chats/$id"
                params={{
                  id: row.conv.id,
                }}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface"
              >
                <UserAvatar
                  path={row.avatar}
                  name={row.title}
                  bucket={
                    row.conv.type === "group"
                      ? "chat-media"
                      : "avatars"
                  }
                  {...(row.otherId
                    ? {
                        online:
                          onlineIds.has(
                            row.otherId,
                          ),
                      }
                    : {})}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium">
                      {row.title}
                    </p>

                    {row.last && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeLabel(
                          row.last.created_at,
                        )}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-muted-foreground">
                      {preview(row.last)}
                    </p>

                    {row.unread > 0 && (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                        {row.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}