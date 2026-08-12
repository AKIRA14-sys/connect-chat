import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
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

  const { data: friends = [] } = useQuery({
    queryKey: ["accepted-friends", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id, requester:requester_id(*), addressee:addressee_id(*)")
        .eq("status", "accepted")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      if (error) throw error;
      return (data ?? []).map((r) => {
        const rec = r as unknown as { requester_id: string; requester: Profile; addressee: Profile };
        return rec.requester_id === user!.id ? rec.addressee : rec.requester;
      });
    },
  });

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
      ...selected.map((uid) => ({ conversation_id: data.id, user_id: uid, role: "member" as const })),
    ];
    const { error: memberError } = await supabase.from("conversation_members").insert(rows);
    setBusy(false);
    if (memberError) {
      toast.error(memberError.message);
      return;
    }
    void navigate({ to: "/chats/$id", params: { id: data.id } });
  }

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

        <div className="space-y-2">
          <Label>Add friends ({selected.length})</Label>
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <Checkbox
                  checked={selected.includes(f.id)}
                  onCheckedChange={(v) =>
                    setSelected((prev) => (v ? [...prev, f.id] : prev.filter((x) => x !== f.id)))
                  }
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
                Add friends first to invite them here.
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
