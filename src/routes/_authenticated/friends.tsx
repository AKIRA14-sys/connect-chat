import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, MessageCircle, Search, UserMinus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/components/RealtimeProvider";
import { AppShell, PageHeader } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { USERNAME_RE, type Profile } from "@/lib/whatsxup";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({
    meta: [
      { title: "Friends — WHATSXUP" },
      { name: "description", content: "Search WHATSXUP usernames, send friend requests and manage your contacts." },
      { property: "og:title", content: "Friends — WHATSXUP" },
      { property: "og:description", content: "Search usernames, send requests and manage your contacts." },
    ],
  }),
  component: FriendsPage,
});

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
  blocked_by: string | null;
  profile: Profile;
};

function FriendsPage() {
  const { user } = useAuth();
  const { onlineIds } = useRealtime();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  const { data: links = [] } = useQuery({
    queryKey: ["friendships", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Friendship[]> => {
      const { data, error } = await supabase
        .from("friendships")
        .select(
          "id, requester_id, addressee_id, status, blocked_by, requester:requester_id(*), addressee:addressee_id(*)",
        )
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      if (error) throw error;
      return (data ?? []).map((r) => {
        const rec = r as unknown as {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: Friendship["status"];
          blocked_by: string | null;
          requester: Profile;
          addressee: Profile;
        };
        return {
          id: rec.id,
          requester_id: rec.requester_id,
          addressee_id: rec.addressee_id,
          status: rec.status,
          blocked_by: rec.blocked_by,
          profile: rec.requester_id === user!.id ? rec.addressee : rec.requester,
        };
      });
    },
  });

  const accepted = links.filter((l) => l.status === "accepted");
  const incoming = links.filter((l) => l.status === "pending" && l.addressee_id === user?.id);
  const outgoing = links.filter((l) => l.status === "pending" && l.requester_id === user?.id);
  const blocked = links.filter((l) => l.status === "blocked" && l.blocked_by === user?.id);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["user-search", term],
    enabled: term.trim().length >= 3 && USERNAME_RE.test(term.trim().toLowerCase()),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, is_online, discoverable, status")
        .eq("discoverable", true)
        .neq("id", user!.id)
        .ilike("username", `${term.trim().toLowerCase()}%`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Partial<Profile>[];
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["friendships"] });
    void qc.invalidateQueries({ queryKey: ["user-search"] });
  };

  const request = useMutation({
    mutationFn: async (otherId: string) => {
      const { error } = await supabase
        .from("friendships")
        .insert({ requester_id: user!.id, addressee_id: otherId, status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Friend request sent");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "blocked" }) => {
      const { error } = await supabase
        .from("friendships")
        .update({ status, blocked_by: status === "blocked" ? user!.id : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("friendships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  async function openChat(otherId: string) {
    const { data, error } = await supabase.rpc("get_or_create_direct", { _other: otherId });
    if (error || !data) {
      toast.error(error?.message ?? "Could not open chat");
      return;
    }
    void navigate({ to: "/chats/$id", params: { id: data } });
  }

  const relation = (id: string) => links.find((l) => l.profile.id === id);

  return (
    <AppShell>
      <PageHeader title="Friends" subtitle="Find people by their username" />
      <div className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search @username"
            value={term}
            maxLength={20}
            onChange={(e) => setTerm(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
          />
        </div>
      </div>

      {term.trim().length >= 3 ? (
        <section className="px-4 pb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isFetching ? "Searching…" : `Results (${results.length})`}
          </h2>
          <ul className="space-y-2">
            {results.map((p) => {
              const rel = relation(p.id!);
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <UserAvatar path={p.avatar_url ?? null} name={p.display_name ?? ""} online={onlineIds.has(p.id!)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                  </div>
                  {!rel ? (
                    <Button size="sm" onClick={() => request.mutate(p.id!)}>
                      <UserPlus className="h-4 w-4" /> Add
                    </Button>
                  ) : rel.status === "accepted" ? (
                    <Button size="sm" variant="outline" onClick={() => void openChat(p.id!)}>
                      <MessageCircle className="h-4 w-4" /> Chat
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground capitalize">{rel.status}</span>
                  )}
                </li>
              );
            })}
            {!isFetching && results.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No discoverable user matches that username.
              </li>
            )}
          </ul>
        </section>
      ) : (
        <Tabs defaultValue="friends" className="px-4 pb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends">Friends {accepted.length ? `(${accepted.length})` : ""}</TabsTrigger>
            <TabsTrigger value="requests">Requests {incoming.length ? `(${incoming.length})` : ""}</TabsTrigger>
            <TabsTrigger value="blocked">Blocked</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-4 space-y-2">
            {accepted.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No friends yet — search a username above.
              </p>
            )}
            {accepted.map((l) => (
              <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <UserAvatar path={l.profile.avatar_url} name={l.profile.display_name} online={onlineIds.has(l.profile.id)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.profile.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">@{l.profile.username}</p>
                </div>
                <Button size="icon" variant="outline" onClick={() => void openChat(l.profile.id)}>
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => removeLink.mutate(l.id)} title="Remove friend">
                  <UserMinus className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setStatus.mutate({ id: l.id, status: "blocked" })}
                  title="Block user"
                >
                  <Ban className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="requests" className="mt-4 space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Incoming</h3>
              {incoming.length === 0 && <p className="text-sm text-muted-foreground">No pending requests.</p>}
              {incoming.map((l) => (
                <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <UserAvatar path={l.profile.avatar_url} name={l.profile.display_name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.profile.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{l.profile.username}</p>
                  </div>
                  <Button size="icon" onClick={() => setStatus.mutate({ id: l.id, status: "accepted" })}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => removeLink.mutate(l.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sent</h3>
              {outgoing.length === 0 && <p className="text-sm text-muted-foreground">Nothing sent.</p>}
              {outgoing.map((l) => (
                <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <UserAvatar path={l.profile.avatar_url} name={l.profile.display_name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">@{l.profile.username}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeLink.mutate(l.id)}>
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="blocked" className="mt-4 space-y-2">
            {blocked.length === 0 && <p className="text-sm text-muted-foreground">You haven't blocked anyone.</p>}
            {blocked.map((l) => (
              <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <UserAvatar path={l.profile.avatar_url} name={l.profile.display_name} />
                <p className="min-w-0 flex-1 truncate font-medium">@{l.profile.username}</p>
                <Button size="sm" variant="outline" onClick={() => removeLink.mutate(l.id)}>
                  Unblock
                </Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
