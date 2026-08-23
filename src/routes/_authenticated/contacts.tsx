import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, MessageCircle, Search, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/components/RealtimeProvider";
import { AppShell, PageHeader } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Profile } from "@/lib/whatsxup";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts — WHATSXUP" },
      {
        name: "description",
        content: "Find WHATSXUP people by username, message them instantly and manage your contact list.",
      },
      { property: "og:title", content: "Contacts — WHATSXUP" },
      { property: "og:description", content: "Search usernames and start chatting instantly — no requests needed." },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const { user } = useAuth();
  const { onlineIds } = useRealtime();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, contact_id, profiles:contact_id(*)")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; contact_id: string; profiles: Profile }[];
    },
  });

  const { data: blocked = [] } = useQuery({
    queryKey: ["blocks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocks")
        .select("id, blocked_id, profiles:blocked_id(*)")
        .eq("blocker_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; blocked_id: string; profiles: Profile }[];
    },
  });

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["user-search", term],
    enabled: term.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, discoverable")
        .eq("discoverable", true)
        .neq("id", user!.id)
        .ilike("username", `${term.trim().toLowerCase()}%`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Partial<Profile>[];
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["contacts"] });
    void qc.invalidateQueries({ queryKey: ["blocks"] });
    void qc.invalidateQueries({ queryKey: ["is-contact"] });
  };

  const addContact = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.from("contacts").insert({ owner_id: user!.id, contact_id: contactId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to contacts");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const block = useMutation({
    mutationFn: async (blockedId: string) => {
      const { error } = await supabase.from("blocks").insert({ blocker_id: user!.id, blocked_id: blockedId });
      if (error) throw error;
      await supabase.from("contacts").delete().eq("owner_id", user!.id).eq("contact_id", blockedId);
    },
    onSuccess: () => {
      toast.success("User blocked");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unblock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blocks").delete().eq("id", id);
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

  const isContact = (uid: string) => contacts.some((c) => c.contact_id === uid);

  return (
    <AppShell>
      <PageHeader title="Contacts" subtitle="Find anyone by their WHATSXUP username" />
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

      {term.trim().length >= 2 ? (
        <section className="px-4 pb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isFetching ? "Searching…" : `Results (${results.length})`}
          </h2>
          <ul className="space-y-2">
            {results.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <UserAvatar path={p.avatar_url ?? null} name={p.display_name ?? ""} online={onlineIds.has(p.id!)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                </div>
                {!isContact(p.id!) && (
                  <Button size="icon" variant="ghost" title="Add contact" onClick={() => addContact.mutate(p.id!)}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" onClick={() => void openChat(p.id!)}>
                  <MessageCircle className="h-4 w-4" /> Message
                </Button>
              </li>
            ))}
            {!isFetching && results.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No discoverable user matches that username.
              </li>
            )}
          </ul>
        </section>
      ) : (
        <Tabs defaultValue="contacts" className="px-4 pb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contacts">Contacts {contacts.length ? `(${contacts.length})` : ""}</TabsTrigger>
            <TabsTrigger value="blocked">Blocked</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="mt-4 space-y-2">
            {contacts.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No contacts yet — search a username above and tap Message or add them here.
              </p>
            )}
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <UserAvatar
                  path={c.profiles.avatar_url}
                  name={c.profiles.display_name}
                  online={onlineIds.has(c.contact_id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.profiles.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">@{c.profiles.username}</p>
                </div>
                <Button size="icon" variant="outline" onClick={() => void openChat(c.contact_id)}>
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Remove contact" onClick={() => removeContact.mutate(c.id)}>
                  <UserMinus className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Block" onClick={() => block.mutate(c.contact_id)}>
                  <Ban className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="blocked" className="mt-4 space-y-2">
            {blocked.length === 0 && <p className="text-sm text-muted-foreground">You haven't blocked anyone.</p>}
            {blocked.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <UserAvatar path={b.profiles.avatar_url} name={b.profiles.display_name} />
                <p className="min-w-0 flex-1 truncate font-medium">@{b.profiles.username}</p>
                <Button size="sm" variant="outline" onClick={() => unblock.mutate(b.id)}>
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
