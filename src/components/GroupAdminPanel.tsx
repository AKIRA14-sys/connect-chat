import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, RefreshCw, ShieldOff, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/UserAvatar";
import {
  DISAPPEAR_OPTIONS,
  SLOW_MODE_OPTIONS,
  copyToClipboard,
  groupInviteUrl,
  makeInviteSlug,
} from "@/lib/groupExtras";
import type { Profile } from "@/lib/whatsxup";

type Props = {
  conversationId: string;
  groupName: string | null;
  inviteSlug: string | null;
  inviteEnabled: boolean;
  joinApprovalRequired: boolean;
  slowModeSeconds: number;
  disappearSeconds: number;
  announceOnly: boolean;
  isAdmin: boolean;
  onChanged: () => void;
};

type JoinRequest = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
};

type BanRow = { user_id: string; created_at: string };

export function GroupAdminPanel(props: Props) {
  const {
    conversationId,
    groupName,
    inviteSlug,
    inviteEnabled,
    joinApprovalRequired,
    slowModeSeconds,
    disappearSeconds,
    announceOnly,
    isAdmin,
    onChanged,
  } = props;
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const link = inviteSlug ? groupInviteUrl(inviteSlug) : null;

  const { data: requests = [] } = useQuery({
    queryKey: ["group-join-requests", conversationId],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_join_requests")
        .select("id, user_id, status, created_at")
        .eq("conversation_id", conversationId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as JoinRequest[];
    },
  });

  const { data: bans = [] } = useQuery({
    queryKey: ["group-bans", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_bans")
        .select("user_id, created_at")
        .eq("conversation_id", conversationId);
      if (error) throw error;
      return (data ?? []) as BanRow[];
    },
  });

  const peopleIds = useMemo(
    () => [
      ...new Set([
        ...requests.map((r) => r.user_id),
        ...bans.map((b) => b.user_id),
      ]),
    ],
    [requests, bans],
  );

  const { data: people = [] } = useQuery({
    queryKey: ["group-admin-profiles", conversationId, peopleIds.join(",")],
    enabled: peopleIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .in("id", peopleIds);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of people) m.set(p.id, p);
    return m;
  }, [people]);

  const refreshAll = () => {
    onChanged();
    void qc.invalidateQueries({ queryKey: ["group-join-requests", conversationId] });
    void qc.invalidateQueries({ queryKey: ["group-bans", conversationId] });
  };

  async function patchConv(patch: Record<string, unknown>) {
    if (!isAdmin) {
      toast.error("Only admins can change this");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("conversations")
      .update(patch)
      .eq("id", conversationId);
    setBusy(false);
    if (error) toast.error(error.message);
    else refreshAll();
  }

  async function createOrRotateLink() {
    await patchConv({
      invite_slug: makeInviteSlug(groupName),
      invite_enabled: true,
    });
    toast.success("Invite link ready");
  }

  async function copy() {
    if (!link) return;
    const ok = await copyToClipboard(link);
    toast[ok ? "success" : "error"](
      ok ? "Link copied — paste it in WhatsApp" : "Could not copy the link",
    );
  }

  async function decide(req: JoinRequest, approve: boolean) {
    setBusy(true);
    try {
      if (approve) {
        const { error } = await supabase.from("conversation_members").insert({
          conversation_id: conversationId,
          user_id: req.user_id,
          role: "member",
        });
        if (error && !error.message.includes("duplicate")) throw error;
      }
      const { error: uErr } = await supabase
        .from("group_join_requests")
        .update({ status: approve ? "approved" : "rejected" })
        .eq("id", req.id);
      if (uErr) throw uErr;
      toast.success(approve ? "Member approved" : "Request rejected");
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function unban(userId: string) {
    setBusy(true);
    const { error } = await supabase
      .from("group_bans")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Unbanned");
      refreshAll();
    }
  }

  function nameOf(id: string) {
    const p = profileMap.get(id);
    return p?.display_name?.trim() || (p?.username ? `@${p.username}` : "User");
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4" />
        <p className="text-sm font-semibold">Invite link</p>
      </div>

      {!isAdmin ? (
        <p className="text-xs text-muted-foreground">
          The invite link for this group is managed by the admins.
        </p>
      ) : (
        <>
          {link && inviteEnabled ? (
            <div className="space-y-2">
              <p className="break-all rounded-xl border border-border/60 bg-background/60 p-2 text-xs">
                {link}
              </p>
              <div className="flex gap-2">
                <Button className="flex-1 gap-2" disabled={busy} onClick={() => void copy()}>
                  <Copy className="h-4 w-4" /> Copy link
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={busy}
                  onClick={() => void createOrRotateLink()}
                >
                  <RefreshCw className="h-4 w-4" /> Reset
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link on WhatsApp or other messaging app or in xuppin
                so others can join.
              </p>
            </div>
          ) : (
            <Button
              className="w-full gap-2"
              disabled={busy}
              onClick={() => void createOrRotateLink()}
            >
              <Link2 className="h-4 w-4" />
              {inviteSlug ? "Turn invite link back on" : "Create invite link"}
            </Button>
          )}

          {inviteSlug ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Invite link active</p>
                <p className="text-xs text-muted-foreground">
                  Turn off to stop anyone new joining with the link.
                </p>
              </div>
              <Switch
                checked={inviteEnabled}
                disabled={busy}
                onCheckedChange={(v) => void patchConv({ invite_enabled: v })}
              />
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Approve new members</p>
              <p className="text-xs text-muted-foreground">
                People who use the link must be approved first.
              </p>
            </div>
            <Switch
              checked={joinApprovalRequired}
              disabled={busy}
              onCheckedChange={(v) =>
                void patchConv({ join_approval_required: v })
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Announcements only</p>
              <p className="text-xs text-muted-foreground">
                Only admins can send messages.
              </p>
            </div>
            <Switch
              checked={announceOnly}
              disabled={busy}
              onCheckedChange={(v) => void patchConv({ announce_only: v })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="slowmode">Slow mode</Label>
              <select
                id="slowmode"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                value={slowModeSeconds}
                disabled={busy}
                onChange={(e) =>
                  void patchConv({ slow_mode_seconds: Number(e.target.value) })
                }
              >
                {SLOW_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="disappear">Disappearing messages</Label>
              <select
                id="disappear"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                value={disappearSeconds}
                disabled={busy}
                onChange={(e) =>
                  void patchConv({ disappear_seconds: Number(e.target.value) })
                }
              >
                {DISAPPEAR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {requests.length > 0 ? (
            <div className="space-y-2">
              <Label>Pending join requests</Label>
              <ul className="space-y-2">
                {requests.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 p-2"
                  >
                    <UserAvatar
                      path={profileMap.get(r.user_id)?.avatar_url ?? null}
                      name={nameOf(r.user_id)}
                      size="sm"
                      userId={r.user_id}
                    />
                    <p className="min-w-0 flex-1 truncate text-sm">
                      {nameOf(r.user_id)}
                    </p>
                    <Button
                      size="icon"
                      disabled={busy}
                      onClick={() => void decide(r, true)}
                      aria-label="Approve"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void decide(r, false)}
                      aria-label="Reject"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      {bans.length > 0 ? (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <ShieldOff className="h-4 w-4" /> Banned people
          </Label>
          <ul className="space-y-2">
            {bans.map((b) => (
              <li
                key={b.user_id}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 p-2"
              >
                <UserAvatar
                  path={profileMap.get(b.user_id)?.avatar_url ?? null}
                  name={nameOf(b.user_id)}
                  size="sm"
                  userId={b.user_id}
                />
                <p className="min-w-0 flex-1 truncate text-sm">
                  {nameOf(b.user_id)}
                </p>
                {isAdmin ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void unban(b.user_id)}
                  >
                    Unban
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
