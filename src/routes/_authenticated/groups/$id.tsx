import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  LogOut,
  MessageCircle,
  ShieldMinus,
  ShieldPlus,
  Trash2,
  UserMinus,
  X,
} from "lucide-react";
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
      { title: "Group info — XUPPIN" },
      {
        name: "description",
        content: "Members, admins, leave or delete this group.",
      },
    ],
  }),
  component: GroupPage,
});

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
};

function GroupPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(
    null,
  );
  const [dmBusy, setDmBusy] = useState(false);

  const { data: conv, isError: convError, error: convErr } = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Group not found");
      return data as Conversation;
    },
  });

  const { data: memberRows = [], isError: memError } = useQuery({
    queryKey: ["conv-members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_members")
        .select("id, user_id, role")
        .eq("conversation_id", id);
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
  });

  const userIds = useMemo(
    () => memberRows.map((m) => m.user_id),
    [memberRows],
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ["group-member-profiles", id, userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .in("id", userIds);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const p of profiles) map.set(p.id, p);
    return map;
  }, [profiles]);

  const members = useMemo(() => {
    return memberRows.map((m) => ({
      ...m,
      profile: profileMap.get(m.user_id) ?? null,
    }));
  }, [memberRows, profileMap]);

  const me = members.find((m) => m.user_id === user?.id);
  const canEdit =
    me?.role === "owner" ||
    me?.role === "admin" ||
    !conv?.only_admins_edit_info;
  const isOwner = me?.role === "owner" || conv?.created_by === user?.id;
  const isAdmin = isOwner || me?.role === "admin";

  const selected = members.find((m) => m.user_id === selectedMemberId) ?? null;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["conv-members", id] });
    void qc.invalidateQueries({ queryKey: ["conversation", id] });
    void qc.invalidateQueries({ queryKey: ["group-member-profiles", id] });
    void qc.invalidateQueries({ queryKey: ["chat-list"] });
  };

  async function updateConv(patch: Partial<Conversation>) {
    const { error } = await supabase
      .from("conversations")
      .update(patch)
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Updated");
      refresh();
    }
  }

  async function setRole(memberId: string, role: "admin" | "member") {
    const { error } = await supabase
      .from("conversation_members")
      .update({ role })
      .eq("id", memberId);
    if (error) toast.error(error.message);
    else {
      toast.success(role === "admin" ? "Made admin" : "Admin removed");
      refresh();
    }
  }

  async function removeMember(memberId: string) {
    if (!window.confirm("Remove this member from the group?")) return;
    const { error } = await supabase
      .from("conversation_members")
      .delete()
      .eq("id", memberId);
    if (error) toast.error(error.message);
    else {
      toast.success("Member removed");
      setSelectedMemberId(null);
      refresh();
    }
  }

  async function leave() {
    if (!me) return;
    if (
      !window.confirm(
        "Leave this group? You will not see new messages until someone adds you again.",
      )
    ) {
      return;
    }
    const { error } = await supabase
      .from("conversation_members")
      .delete()
      .eq("id", me.id);
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
        "Delete this group for everyone? It will disappear from all members' chat lists.",
      )
    ) {
      return;
    }
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

  async function messageMember(otherId: string) {
    if (!user || otherId === user.id) return;
    setDmBusy(true);
    try {
      const { data, error } = await supabase.rpc("get_or_create_direct", {
        _other: otherId,
      });
      if (error || !data) {
        toast.error(error?.message ?? "Could not open chat");
        return;
      }
      setSelectedMemberId(null);
      void navigate({ to: "/chats/$id", params: { id: String(data) } });
    } finally {
      setDmBusy(false);
    }
  }

  if (convError || memError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 app-gradient">
        <p className="text-center text-sm text-muted-foreground">
          Could not load this group.
          {convErr instanceof Error ? ` ${convErr.message}` : ""}
        </p>
        <Button variant="outline" onClick={() => void navigate({ to: "/chats" })}>
          Back to chats
        </Button>
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="flex min-h-screen items-center justify-center app-gradient text-sm text-muted-foreground">
        Loading group…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col app-gradient">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border/60 bg-background/85 px-3 py-2.5 backdrop-blur safe-top">
        <Button
          size="icon"
          variant="ghost"
          onClick={() =>
            void navigate({ to: "/chats/$id", params: { id } })
          }
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">Group info</h1>
          <p className="text-xs text-muted-foreground">
            {members.length} member{members.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <div className="space-y-6 p-4 pb-24">
        <div className="flex flex-col items-center gap-3">
          <UserAvatar
            path={conv.avatar_url ?? null}
            name={conv.name ?? "Group"}
            bucket="chat-media"
            size="xl"
          />
          <p className="text-center text-lg font-semibold">
            {conv.name?.trim() || "Group"}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            {members.length} members
            {conv.description ? ` · ${conv.description}` : ""}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Group name</Label>
          <Input
            id="name"
            defaultValue={conv.name ?? ""}
            disabled={!canEdit}
            maxLength={60}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== (conv.name ?? "")) void updateConv({ name: v });
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc"
            defaultValue={conv.description ?? ""}
            disabled={!canEdit}
            maxLength={200}
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              if (v !== (conv.description ?? null))
                void updateConv({ description: v });
            }}
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Only admins can add members</p>
              <p className="text-xs text-muted-foreground">
                Restrict who can invite new people.
              </p>
            </div>
            <Switch
              checked={!!conv.only_admins_add_members}
              disabled={!isAdmin}
              onCheckedChange={(v) =>
                void updateConv({ only_admins_add_members: v })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Only admins can edit info</p>
              <p className="text-xs text-muted-foreground">
                Lock the name, picture and description.
              </p>
            </div>
            <Switch
              checked={!!conv.only_admins_edit_info}
              disabled={!isAdmin}
              onCheckedChange={(v) =>
                void updateConv({ only_admins_edit_info: v })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Members · tap a person for options</Label>
          <ul className="space-y-2">
            {members.map((m) => {
              const name =
                m.profile?.display_name?.trim() ||
                (m.profile?.username ? `@${m.profile.username}` : "Member");
              const username = m.profile?.username
                ? `@${m.profile.username}`
                : "No username";
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:bg-muted/40"
                    onClick={() => setSelectedMemberId(m.user_id)}
                  >
                    <UserAvatar
                      path={m.profile?.avatar_url ?? null}
                      name={name}
                      size="sm"
                      userId={m.user_id}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs capitalize text-muted-foreground">
                        {username} · {m.role}
                        {m.user_id === conv.created_by ? " · creator" : ""}
                        {m.user_id === user?.id ? " · you" : ""}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => void leave()}
          >
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
        </div>
      </div>

      {/* Member detail sheet */}
      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
          onClick={() => setSelectedMemberId(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-border bg-background p-4 shadow-xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar
                  path={selected.profile?.avatar_url ?? null}
                  name={
                    selected.profile?.display_name ||
                    selected.profile?.username ||
                    "Member"
                  }
                  size="lg"
                  userId={selected.user_id}
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {selected.profile?.display_name?.trim() ||
                      selected.profile?.username ||
                      "Member"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {selected.profile?.username
                      ? `@${selected.profile.username}`
                      : "No username"}
                  </p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {selected.role}
                    {selected.user_id === conv.created_by
                      ? " · group creator"
                      : ""}
                  </p>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSelectedMemberId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {selected.profile?.bio ? (
              <p className="mb-4 text-sm text-muted-foreground">
                {selected.profile.bio}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              {selected.user_id !== user?.id ? (
                <Button
                  className="w-full gap-2"
                  disabled={dmBusy}
                  onClick={() => void messageMember(selected.user_id)}
                >
                  <MessageCircle className="h-4 w-4" />
                  {dmBusy ? "Opening…" : "Message"}
                </Button>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  This is you
                </p>
              )}

              {isOwner && selected.user_id !== user?.id ? (
                <>
                  <Button
                    variant="secondary"
                    className="w-full gap-2"
                    onClick={() =>
                      void setRole(
                        selected.id,
                        selected.role === "admin" ? "member" : "admin",
                      )
                    }
                  >
                    {selected.role === "admin" ? (
                      <>
                        <ShieldMinus className="h-4 w-4" /> Remove admin
                      </>
                    ) : (
                      <>
                        <ShieldPlus className="h-4 w-4" /> Make admin
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={() => void removeMember(selected.id)}
                  >
                    <UserMinus className="h-4 w-4" /> Remove from group
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
