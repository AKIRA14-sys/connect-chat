import { useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Camera,
  LogOut,
  MessageCircle,
  Search,
  ShieldMinus,
  ShieldPlus,
  Trash2,
  UserPlus,
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
import { uploadChatMedia, type Conversation, type Profile } from "@/lib/whatsxup";

export const Route = createFileRoute("/_authenticated/groups/$id")({
  head: () => ({
    meta: [
      { title: "Group info — XUPPIN" },
      {
        name: "description",
        content: "Members, photo, admins, leave or delete this group.",
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
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(
    null,
  );
  const [dmBusy, setDmBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

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

  const memberIdSet = useMemo(
    () => new Set(memberRows.map((m) => m.user_id)),
    [memberRows],
  );

  const me = members.find((m) => m.user_id === user?.id);
  const isOwner = me?.role === "owner" || conv?.created_by === user?.id;
  const isAdmin = !!(isOwner || me?.role === "admin");
  /** Name + photo: admins only when lock is on; otherwise anyone in group */
  const canEditInfo =
    isAdmin || (me != null && !conv?.only_admins_edit_info);
  const canAddMembers =
    isAdmin || (me != null && !conv?.only_admins_add_members);

  const selected = members.find((m) => m.user_id === selectedMemberId) ?? null;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["conv-members", id] });
    void qc.invalidateQueries({ queryKey: ["conversation", id] });
    void qc.invalidateQueries({ queryKey: ["group-member-profiles", id] });
    void qc.invalidateQueries({ queryKey: ["chat-list"] });
  };

  async function updateConv(patch: Partial<Conversation>) {
    if (!canEditInfo && ("name" in patch || "description" in patch || "avatar_url" in patch)) {
      toast.error("Only admins can edit group info");
      return;
    }
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

  async function onPickPhoto(file: File | null) {
    if (!file || !user) return;
    if (!canEditInfo) {
      toast.error("Only admins can change the group photo");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    setPhotoBusy(true);
    try {
      const path = await uploadChatMedia(id, file, "jpg");
      const { error } = await supabase
        .from("conversations")
        .update({ avatar_url: path })
        .eq("id", id);
      if (error) throw error;
      toast.success("Group photo updated");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runSearch() {
    if (!user) return;
    const query = searchTerm.trim().replace(/^@/, "");
    if (query.length < 2) {
      toast.error("Type at least 2 characters of a username");
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .ilike("username", `%${query}%`)
        .neq("id", user.id)
        .limit(20);
      if (error) throw error;
      setSearchResults((data ?? []) as Profile[]);
      if (!(data ?? []).length) toast.message("No users found");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function addMember(profile: Profile) {
    if (!canAddMembers) {
      toast.error("Only admins can add members");
      return;
    }
    if (memberIdSet.has(profile.id)) {
      toast.message("Already in this group");
      return;
    }
    setAddingId(profile.id);
    try {
      const { error } = await supabase.from("conversation_members").insert({
        conversation_id: id,
        user_id: profile.id,
        role: "member",
      });
      if (error) throw error;
      toast.success(
        `Added ${profile.display_name || profile.username || "member"}`,
      );
      setSearchResults((prev) => prev.filter((p) => p.id !== profile.id));
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add member");
    } finally {
      setAddingId(null);
    }
  }

  async function setRole(memberId: string, role: "admin" | "member") {
    if (!isOwner) {
      toast.error("Only the owner can change admin roles");
      return;
    }
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
    if (!isOwner && !isAdmin) {
      toast.error("Only admins can remove members");
      return;
    }
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

      <div className="space-y-6 p-4 pb-28">
        {/* Photo */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <UserAvatar
              path={conv.avatar_url ?? null}
              name={conv.name ?? "Group"}
              bucket="chat-media"
              size="xl"
            />
            {canEditInfo ? (
              <button
                type="button"
                className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow"
                disabled={photoBusy}
                onClick={() => fileRef.current?.click()}
                aria-label="Change group photo"
              >
                <Camera className="h-5 w-5" />
              </button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                void onPickPhoto(e.target.files?.[0] ?? null)
              }
            />
          </div>
          <p className="text-center text-lg font-semibold">
            {conv.name?.trim() || "Group"}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            {members.length} members
            {!canEditInfo
              ? " · only admins can edit name & photo"
              : photoBusy
                ? " · uploading…"
                : " · tap camera to change photo"}
          </p>
        </div>

        {/* Name / description — disabled for non-admins when locked */}
        <div className="space-y-2">
          <Label htmlFor="name">Group name</Label>
          <Input
            id="name"
            defaultValue={conv.name ?? ""}
            disabled={!canEditInfo}
            maxLength={60}
            onBlur={(e) => {
              if (!canEditInfo) return;
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
            disabled={!canEditInfo}
            maxLength={200}
            onBlur={(e) => {
              if (!canEditInfo) return;
              const v = e.target.value.trim() || null;
              if (v !== (conv.description ?? null))
                void updateConv({ description: v });
            }}
          />
        </div>

        {/* Admin locks */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Only admins can add members</p>
              <p className="text-xs text-muted-foreground">
                Restrict who can invite people by username.
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
                Lock name, photo and description to admins.
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

        {/* Add by username — not only contacts */}
        {canAddMembers ? (
          <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <Label className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add people by username
            </Label>
            <p className="text-xs text-muted-foreground">
              They do not need to be in your contacts. Search their @username.
            </p>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="@username"
                  value={searchTerm}
                  maxLength={30}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runSearch();
                  }}
                />
              </div>
              <Button
                type="button"
                disabled={searching}
                onClick={() => void runSearch()}
              >
                {searching ? "…" : "Search"}
              </Button>
            </div>
            {searchResults.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {searchResults.map((p) => {
                  const already = memberIdSet.has(p.id);
                  const label =
                    p.display_name?.trim() ||
                    (p.username ? `@${p.username}` : "User");
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 p-2"
                    >
                      <UserAvatar
                        path={p.avatar_url}
                        name={label}
                        size="sm"
                        userId={p.id}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{label}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.username ? `@${p.username}` : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={already || addingId === p.id}
                        onClick={() => void addMember(p)}
                      >
                        {already
                          ? "In group"
                          : addingId === p.id
                            ? "…"
                            : "Add"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Only admins can add members in this group.
          </p>
        )}

        {/* Members */}
        <div className="space-y-2">
          <Label>Members · tap someone for options</Label>
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
