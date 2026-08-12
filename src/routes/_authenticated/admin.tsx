import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import type { Profile } from "@/lib/whatsxup";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — WHATSXUP" },
      { name: "description", content: "Master admin dashboard for WHATSXUP moderation, users, groups and reports." },
      { property: "og:title", content: "Admin panel — WHATSXUP" },
      { property: "og:description", content: "Moderation dashboard for users, groups and reports." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const { data: isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const counts = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_online", true),
        supabase.from("conversations").select("id", { count: "exact", head: true }).eq("type", "direct"),
        supabase.from("conversations").select("id", { count: "exact", head: true }).eq("type", "group"),
        supabase.from("messages").select("id", { count: "exact", head: true }),
        supabase.from("calls").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).neq("status", "active"),
      ]);
      const [users, online, chats, groups, messages, calls, reports, restricted] = counts.map((c) => c.count ?? 0);
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
        .limit(25);
      return (data ?? []) as Profile[];
    },
  });

  async function moderate(target: Profile, status: "active" | "suspended" | "banned") {
    if (status === "banned" && !window.confirm(`Ban @${target.username}? This blocks all access.`)) return;
    const { error } = await supabase.from("profiles").update({ status }).eq("id", target.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("admin_audit_log").insert({
      admin_id: user!.id,
      action: `user_${status}`,
      target_type: "user",
      target_id: target.id,
      metadata: { username: target.username },
    });
    toast.success(`@${target.username} is now ${status}`);
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
        <p className="text-sm text-muted-foreground">This area is restricted to the WHATSXUP master admin.</p>
        <Button onClick={() => void navigate({ to: "/chats" })}>Back to chats</Button>
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
        <Button size="icon" variant="ghost" onClick={() => void navigate({ to: "/settings" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Admin panel</h1>
      </header>

      <div className="space-y-6 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-2xl font-semibold">{value ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Recent users</h2>
          <ul className="space-y-2">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <UserAvatar path={p.avatar_url} name={p.display_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.display_name}</p>
                  <p className="truncate text-xs capitalize text-muted-foreground">
                    @{p.username ?? "no-username"} · {p.status}
                  </p>
                </div>
                {p.status === "active" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => void moderate(p, "suspended")}>
                      Suspend
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void moderate(p, "banned")}>
                      Ban
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void moderate(p, "active")}>
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
