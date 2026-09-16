import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users, Hash, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useProfile";
import { getMasterAdminEmail } from "@/lib/masterAdmin";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import type { Profile } from "@/lib/whatsxup";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — XUPPIN" },
      { name: "description", content: "Master admin dashboard for XUPPIN." },
    ],
  }),
  component: AdminPage,
});

type GroupRow = {
  id: string;
  name: string | null;
  description: string | null;
  created_by: string;
  last_message_at: string | null;
  member_count?: number;
  creator_name?: string;
};

function AdminPage() {
  const { user } = useAuth();
  const { data: isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const masterEmail = getMasterAdminEmail();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const counts = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_online", true),
        supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("type", "direct"),
        supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("type", "group"),
        supabase.from("messages").select("id", { count: "exact", head: true }),
        supabase.from("calls").select("id", { count: "exact", head: true }),
        supabase
          .from("reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .neq("status", "active"),
      ]);
      const [users, online, chats, groups, messages, calls, reports, restricted] =
        counts.map((c) => c.count ?? 0);
      return { users, online, chats, groups, messages, calls, reports, restricted };
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["admin-users"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      return (data ?? []) as Profile[];
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["admin-groups"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data: convs, error } = await supabase
        .from("conversations")
        .select("id, name, description, created_by, last_message_at")
        .eq("type", "group")
        .order("last_message_at", { ascending: false })
        .limit(40);
      if (error) {
        console.warn("[admin-groups]", error.message);
        return [] as GroupRow[];
      }
      const rows = (convs ?? []) as GroupRow[];
      const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))];
      let nameById: Record<string, string> = {};
      if (creatorIds.length) {
        const { data: creators } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", creatorIds);
        for (const c of creators ?? []) {
          nameById[c.id] =
            c.display_name ||
            (c.username ? `@${c.username}` : c.id.slice(0, 8));
        }
      }
      // member counts (best-effort; may be limited by RLS)
      const withCounts: GroupRow[] = [];
      for (const r of rows) {
        let member_count: number | undefined;
        try {
          const { count } = await supabase
            .from("conversation_members")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", r.id);
          if (typeof count === "number") member_count = count;
        } catch {
          /* ignore */
        }
        withCounts.push({
          ...r,
          member_count,
          creator_name: nameById[r.created_by] || "Unknown",
        });
      }
      return withCounts;
    },
  });

  async function moderate(
    target: Profile,
    status: "active" | "suspended" | "banned",
  ) {
    const label =
      status === "active"
        ? "restore"
        : status === "suspended"
          ? "suspend"
          : "ban";
    if (
      status !== "active" &&
      !window.confirm(
        `${label === "ban" ? "Ban" : "Suspend"} @${target.username || target.display_name}?`,
      )
    ) {
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ status })
      .eq("id", target.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    try {
      await supabase.from("admin_audit_log").insert({
        admin_id: user!.id,
        action: `user_${status}`,
        target_type: "user",
        target_id: target.id,
        metadata: { username: target.username },
      });
    } catch {
      /* optional */
    }
    toast.success(
      status === "active"
        ? `@${target.username || "user"} restored (can use the app again)`
        : `@${target.username || "user"} is now ${status}`,
    );
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
    void qc.invalidateQueries({ queryKey: ["admin-stats"] });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center app-gradient">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 app-gradient px-8 text-center">
        <h1 className="text-2xl font-semibold">Not authorised</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sign in with the admin email and password to open this panel.
        </p>
        {!masterEmail ? (
          <p className="max-w-sm text-xs text-amber-600">
            Add VITE_MASTER_ADMIN_EMAIL on Vercel, then redeploy.
          </p>
        ) : null}
        <Button onClick={() => void navigate({ to: "/chats" })}>Back to chats</Button>
        <Button variant="outline" onClick={() => void navigate({ to: "/auth" })}>
          Sign in
        </Button>
      </div>
    );
  }

  const tiles = [
    ["Users", stats?.users],
    ["Online", stats?.online],
    ["Direct chats", stats?.chats],
    ["Groups", stats?.groups],
    ["Messages", stats?.messages],
    ["Calls", stats?.calls],
    ["Open reports", stats?.reports],
    ["Restricted", stats?.restricted],
  ] as const;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col app-gradient">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border/60 bg-background/85 px-3 py-2.5 backdrop-blur safe-top">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => void navigate({ to: "/settings" })}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Admin panel</h1>
      </header>

      <div className="space-y-6 p-4 pb-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-2xl font-semibold">{value ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* USERS */}
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" />
            People (recent)
          </h2>
          <p className="text-xs text-muted-foreground">
            Suspend = temporary block. Ban = stronger block. Restore = unban /
            unsuspend so they can use the app again.
          </p>
          <ul className="space-y-2">
            {recent.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar
                    path={p.avatar_url}
                    name={p.display_name}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.display_name || "No name"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{p.username ?? "no-username"}
                      {p.is_online ? " · online" : ""}
                    </p>
                    <p className="truncate text-[11px] capitalize text-muted-foreground">
                      Status: {p.status}
                      {p.created_at
                        ? ` · joined ${new Date(p.created_at).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.status === "active" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void moderate(p, "suspended")}
                      >
                        Suspend
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void moderate(p, "banned")}
                      >
                        Ban
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void moderate(p, "active")}
                    >
                      Restore (unban / unsuspend)
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* GROUPS */}
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Hash className="h-4 w-4" />
            Groups
          </h2>
          <p className="text-xs text-muted-foreground">
            Names of groups on the app, who created them, and member count when
            available.
          </p>
          <ul className="space-y-2">
            {groups.length === 0 ? (
              <li className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                No groups loaded (none exist, or the database blocked the list).
              </li>
            ) : (
              groups.map((g) => (
                <li
                  key={g.id}
                  className="rounded-2xl border border-border bg-card p-3"
                >
                  <p className="text-sm font-medium">
                    {g.name?.trim() || "Unnamed group"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Created by {g.creator_name}
                    {g.member_count != null
                      ? ` · ${g.member_count} member${g.member_count === 1 ? "" : "s"}`
                      : ""}
                  </p>
                  {g.description?.trim() ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {g.description}
                    </p>
                  ) : null}
                  {g.last_message_at ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MessageSquare className="h-3 w-3" />
                      Last activity{" "}
                      {new Date(g.last_message_at).toLocaleString()}
                    </p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
