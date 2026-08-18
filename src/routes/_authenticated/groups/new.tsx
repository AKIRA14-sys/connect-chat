import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { Profile } from "@/lib/whatsxup";

export const Route = createFileRoute("/_authenticated/groups/new")({
  head: () => ({
    meta: [
      { title: "New group — WHATSXUP" },
      { name: "description", content: "Create a WHATSXUP group, name it and invite friends to chat together." },
      { property: "og:title", content: "New group — WHATSXUP" },
      { property: "og:description", content: "Create a group and invite your friends." },
    ],
  }),
  component: NewGroup,
});

function NewGroup() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Search state — lets you add anyone by username, not just contacts.
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  // Keeps track of every profile we've ever shown (contacts + search
  // results), so selected people always render correctly regardless
  // of which list they came from.
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({});

  const { data: friends = [] } = useQuery({
    queryKey: ["contacts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("contact_id, profiles:contact_id(*)")
        .eq("owner_id", user!.id);

      if (error) throw error;

      const profiles = (data ?? []).map(
        (r) => (r as unknown as { profiles: Profile }).profiles,
      );

      setProfileMap((prev) => {
        const next = { ...prev };
        for (const profile of profiles) {
          next[profile.id] = profile;
        }
        return next;
      });

      return profiles;
    },
  });

  /* =========================================================
     SEARCH USERS (NOT LIMITED TO CONTACTS)
     ========================================================= */

  async function runSearch(term: string) {
    setSearchTerm(term);

    const query = term.trim();

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", `%${query}%`)
      .neq("id", user!.id)
      .limit(20);

    setSearching(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const results = (data ?? []) as Profile[];

    setSearchResults(results);

    setProfileMap((prev) => {
      const next = { ...prev };
      for (const profile of results) {
        next[profile.id] = profile;
      }
      return next;
    });
  }

  function toggleSelected(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function create() {
    if (name.trim().length < 2) {
      toast.error("Give the group a name.");
      return;
    }

    setBusy(true);

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        type: "group",
        name: name.trim().slice(0, 60),
        description: description.trim().slice(0, 200) || null,
        created_by: user!.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      setBusy(false);
      toast.error(error?.message ?? "Could not create group");
      return;
    }

    const rows = [
      { conversation_id: data.id, user_id: user!.id, role: "owner" as const },
      ...selected.map((uid) => ({
        conversation_id: data.id,
        user_id: uid,
        role: "member" as const,
      })),
    ];

    const { error: memberError } = await supabase
      .from("conversation_members")
      .insert(rows);

    setBusy(false);

    if (memberError) {
      toast.error(memberError.message);
      return;
    }

    void navigate({ to: "/chats/$id", params: { id: data.id } });
  }

  const selectedProfiles = selected
    .map((id) => profileMap[id])
    .filter((p): p is Profile => !!p);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col app-gradient">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border/60 bg-background/85 px-3 py-2.5 backdrop-blur safe-top">
        <Button size="icon" variant="ghost" onClick={() => void navigate({ to: "/chats" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">New group</h1>
      </header>

      <div className="space-y-5 p-4">
        <div className="space-y-2">
          <Label htmlFor="gname">Group name</Label>
          <Input id="gname" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gdesc">Description</Label>
          <Textarea id="gdesc" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        </div>

        {/* =====================================================
            SELECTED PEOPLE
            ===================================================== */}

        {selectedProfiles.length > 0 && (
          <div className="space-y-2">
            <Label>Selected ({selectedProfiles.length})</Label>
            <div className="flex flex-wrap gap-2">
              {selectedProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleSelected(p.id)}
                  className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-sm"
                >
                  <UserAvatar path={p.avatar_url} name={p.display_name} size="sm" />
                  <span className="max-w-[120px] truncate">{p.display_name}</span>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* =====================================================
            SEARCH FOR ANYONE (NOT JUST CONTACTS)
            ===================================================== */}

        <div className="space-y-2">
          <Label htmlFor="search">Add anyone by username</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              value={searchTerm}
              onChange={(e) => void runSearch(e.target.value)}
              placeholder="Search by username..."
              className="pl-9"
            />
          </div>

          {searching && (
            <p className="text-xs text-muted-foreground">Searching…</p>
          )}

          {!searching && searchTerm.trim().length >= 2 && (
            <ul className="space-y-2">
              {searchResults.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No users found for "{searchTerm.trim()}".
                </li>
              ) : (
                searchResults.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                  >
                    <Checkbox
                      checked={selected.includes(p.id)}
                      onCheckedChange={() => toggleSelected(p.id)}
                    />
                    <UserAvatar path={p.avatar_url} name={p.display_name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.display_name}</p>
                      <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {/* =====================================================
            CONTACTS
            ===================================================== */}

        <div className="space-y-2">
          <Label>Your contacts</Label>
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <Checkbox
                  checked={selected.includes(f.id)}
                  onCheckedChange={() => toggleSelected(f.id)}
                />
                <UserAvatar path={f.avatar_url} name={f.display_name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{f.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">@{f.username}</p>
                </div>
              </li>
            ))}
            {friends.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No contacts yet — use search above to add anyone by username.
              </li>
            )}
          </ul>
        </div>

        <Button className="w-full" disabled={busy} onClick={() => void create()}>
          {busy ? "Creating…" : "Create group"}
        </Button>
      </div>
    </div>
  );
}