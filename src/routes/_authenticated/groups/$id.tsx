import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LogOut, ShieldMinus, ShieldPlus, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { Conversation, Profile } from "@/lib/whatsxup";

export const Route = createFileRoute("/_authenticated/groups/$id")({
  head: () => ({
    meta: [
      { title: "Group settings — WHATSXUP" },
      { name: "description", content: "Manage WHATSXUP group info, members, admins and permissions." },
      { property: "og:title", content: "Group settings — WHATSXUP" },
      { property: "og:description", content: "Manage group info, members and permissions." },
    ],
  }),
  component: GroupPage,
});

function GroupPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: conv } = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("conversations").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Conversation;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["conv-members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_members")
        .select("id, user_id, role, profiles:user_id(*)")
        .eq("conversation_id", id);
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; user_id: string; role: string; profiles: Profile }[];
    },
  });

  const me = members.find((m) => m.user_id === user?.id);
  const canEdit = me?.role === "owner" || me?.role === "admin" || !conv?.only_admins_edit_info;
  const isOwner = me?.role === "owner";
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["conv-members", id] });
    void qc.invalidateQueries({ queryKey: ["conversation", id] });
  };

  async function updateConv(patch: Partial<Conversation>) {
    const { error } = await supabase.from("conversations").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  }

  async function setRole(memberId: string, role: "admin" | "member") {
    const { error } = await supabase.from("conversation_members").update({ role }).eq("id", memberId);
    if (error) toast.error(error.message);
    else refresh();
  }

  async function removeMember(memberId: string) {
    const { error } = await supabase.from("conversation_members").delete().eq("id", memberId);
    if (error) toast.error(error.message);
    else refresh();
  }

  async function leave() {
    if (!me) return;
    if (!window.confirm("Leave this group? You will not see new messages until someone adds you again.")) {
      return;
    }
    const { error } = await supabase.from("conversation_members").delete().eq("id", me.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("You left the group");
    void navigate({ to: "/chats" });
  }

  async function deleteGroup() {
    if (!isOwner) {
      toast.error("Only the group owner can delete the group");
      return;
    }
    if (
      !window.confirm(
        "Delete this group for everyone? Messages stay in the database but the group will be removed from all members' chat lists.",
      )
    ) {
      return;
    }
    // Remove all members first, then the conversation
    const { error: memErr } = await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", id);
    if (memErr) {
      toast.error(memErr.message);
      return;
    }
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Group deleted");
    void qc.invalidateQueries({ queryKey: ["chat-list"] });
    void navigate({ to: "/chats" });
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col app-gradient">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border/60 bg-background/85 px-3 py-2.5 backdrop-blur safe-top">
        <Button size="icon" variant="ghost" onClick={() => void navigate({ to: "/chats/$id", params: { id } })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Group info</h1>
      </header>

      <div className="space-y-6 p-4">
        <div className="flex flex-col items-center gap-3">
          <UserAvatar path={conv?.avatar_url ?? null} name={conv?.name ?? "Group"} bucket="chat-media" size="xl" />
          <p className="text-xs text-muted-foreground">{members.length} members</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Group name</Label>
          <Input
            id="name"
            defaultValue={conv?.name ?? ""}
            disabled={!canEdit}
            maxLength={60}
            onBlur={(e) => void updateConv({ name: e.target.value.trim() })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc"
            defaultValue={conv?.description ?? ""}
            disabled={!canEdit}
            maxLength={200}
            onBlur={(e) => void updateConv({ description: e.target.value.trim() || null })}
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Only admins can add members</p>
              <p className="text-xs text-muted-foreground">Restrict who can invite new people.</p>
            </div>
            <Switch
              checked={!!conv?.only_admins_add_members}
              disabled={!isOwner && me?.role !== "admin"}
              onCheckedChange={(v) => void updateConv({ only_admins_add_members: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Only admins can edit info</p>
              <p className="text-xs text-muted-foreground">Lock the name, picture and description.</p>
            </div>
            <Switch
              checked={!!conv?.only_admins_edit_info}
              disabled={!isOwner && me?.role !== "admin"}
              onCheckedChange={(v) => void updateConv({ only_admins_edit_info: v })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Members</Label>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <UserAvatar path={m.profiles.avatar_url} name={m.profiles.display_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.profiles.display_name}</p>
                  <p className="truncate text-xs capitalize text-muted-foreground">
                    @{m.profiles.username} · {m.role}
                    {m.user_id === conv?.created_by ? " · creator" : ""}
                  </p>
                </div>
                {isOwner && m.user_id !== user?.id && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      title={m.role === "admin" ? "Remove admin" : "Make admin"}
                      onClick={() => void setRole(m.id, m.role === "admin" ? "member" : "admin")}
                    >
                      {m.role === "admin" ? <ShieldMinus className="h-4 w-4" /> : <ShieldPlus className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" title="Remove" onClick={() => void removeMember(m.id)}>
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <Button variant="outline" className="w-full gap-2" onClick={() => void leave()}>
            <LogOut className="h-4 w-4" /> Leave group
          </Button>
          {isOwner ? (
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={() => void deleteGroup()}
            >
              <Trash2 className="h-4 w-4" /> Delete group for everyone
            </Button>
          ) : null}
          <p className="text-center text-xs text-muted-foreground">
            Owner / admins manage members above. Leaving only removes the group from your chat list.
          </p>
        </div>
      </div>
    </div>
  );
}
