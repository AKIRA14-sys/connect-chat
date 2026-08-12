import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PenSquare, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/components/RealtimeProvider";
import { AppShell, PageHeader } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { timeLabel, type Conversation, type Message, type Profile } from "@/lib/whatsxup";

export const Route = createFileRoute("/_authenticated/chats/")({
  head: () => ({
    meta: [
      { title: "Chats — WHATSXUP" },
      { name: "description", content: "All your WHATSXUP conversations and groups in one fast, real-time inbox." },
      { property: "og:title", content: "Chats — WHATSXUP" },
      { property: "og:description", content: "All your conversations and groups in one real-time inbox." },
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

function ChatsPage() {
  const { user } = useAuth();
  const { onlineIds } = useRealtime();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["chat-list", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const { data: mine, error } = await supabase
        .from("conversation_members")
        .select("conversation_id, last_read_at")
        .eq("user_id", user!.id);
      if (error) throw error;
      const ids = (mine ?? []).map((m) => m.conversation_id);
      if (!ids.length) return [];

      const [{ data: convs }, { data: members }, { data: msgs }] = await Promise.all([
        supabase.from("conversations").select("*").in("id", ids).order("last_message_at", { ascending: false }),
        supabase
          .from("conversation_members")
          .select("conversation_id, user_id, profiles:user_id(id, username, display_name, avatar_url)")
          .in("conversation_id", ids),
        supabase
          .from("messages")
          .select("*")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      const readAt = new Map((mine ?? []).map((m) => [m.conversation_id, m.last_read_at]));

      return ((convs ?? []) as Conversation[]).map((conv) => {
        const convMsgs = ((msgs ?? []) as Message[]).filter((m) => m.conversation_id === conv.id);
        const last = convMsgs[0] ?? null;
        const since = readAt.get(conv.id) ?? "1970-01-01";
        const unread = convMsgs.filter((m) => m.sender_id !== user!.id && m.created_at > since).length;
        const other = (members ?? []).find(
          (m) => m.conversation_id === conv.id && m.user_id !== user!.id,
        ) as { user_id: string; profiles: Partial<Profile> | null } | undefined;

        return {
          conv,
          title:
            conv.type === "group"
              ? (conv.name ?? "Group")
              : (other?.profiles?.display_name ?? other?.profiles?.username ?? "Unknown"),
          avatar: conv.type === "group" ? conv.avatar_url : (other?.profiles?.avatar_url ?? null),
          otherId: conv.type === "group" ? null : (other?.user_id ?? null),
          last,
          unread,
        };
      });
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat-list-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        void qc.invalidateQueries({ queryKey: ["chat-list"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, () => {
        void qc.invalidateQueries({ queryKey: ["chat-list"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, qc]);

  function preview(m: Message | null) {
    if (!m) return "No messages yet";
    if (m.deleted_at) return "This message was deleted";
    if (m.type === "image") return "📷 Photo";
    if (m.type === "video") return "🎬 Video";
    if (m.type === "audio") return "🎙️ Voice note";
    return m.content ?? "";
  }

  return (
    <AppShell>
      <PageHeader
        title="Chats"
        action={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/groups/new">
                <Users className="h-4 w-4" /> Group
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/friends">
                <PenSquare className="h-4 w-4" /> New
              </Link>
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3 p-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-10 text-center">
          <h2 className="text-lg font-semibold">No conversations yet</h2>
          <p className="text-sm text-muted-foreground">
            Find friends by their username and start your first chat.
          </p>
          <Button asChild>
            <Link to="/friends">Find friends</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((r) => (
            <li key={r.conv.id}>
              <Link
                to="/chats/$id"
                params={{ id: r.conv.id }}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface"
              >
                <UserAvatar
                  path={r.avatar}
                  name={r.title}
                  bucket={r.conv.type === "group" ? "chat-media" : "avatars"}
                  {...(r.otherId ? { online: onlineIds.has(r.otherId) } : {})}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium">{r.title}</p>
                    {r.last && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeLabel(r.last.created_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-muted-foreground">{preview(r.last)}</p>
                    {r.unread > 0 && (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                        {r.unread}
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
