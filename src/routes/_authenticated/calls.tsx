import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PhoneIncoming, PhoneMissed, PhoneOutgoing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { timeLabel, type Profile } from "@/lib/whatsxup";

export const Route = createFileRoute("/_authenticated/calls")({
  head: () => ({
    meta: [
      { title: "Calls — WHATSXUP" },
      { name: "description", content: "Your WHATSXUP voice and video call history, including missed calls." },
      { property: "og:title", content: "Calls — WHATSXUP" },
      { property: "og:description", content: "Voice and video call history." },
    ],
  }),
  component: CallsPage,
});

function CallsPage() {
  const { user } = useAuth();
  const { data: calls = [] } = useQuery({
    queryKey: ["calls", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("*, caller:caller_id(*), callee:callee_id(*)")
        .or(`caller_id.eq.${user!.id},callee_id.eq.${user!.id}`)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        caller_id: string;
        kind: string;
        status: string;
        started_at: string;
        caller: Profile;
        callee: Profile;
      }[];
    },
  });

  return (
    <AppShell>
      <PageHeader title="Calls" subtitle="Voice and video history" />
      {calls.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">No calls yet.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {calls.map((c) => {
            const outgoing = c.caller_id === user?.id;
            const peer = outgoing ? c.callee : c.caller;
            const missed = c.status === "missed" || c.status === "declined";
            const Icon = missed ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;
            return (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <UserAvatar path={peer?.avatar_url ?? null} name={peer?.display_name ?? "Unknown"} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{peer?.display_name ?? "Unknown"}</p>
                  <p className={`flex items-center gap-1 text-xs ${missed ? "text-destructive" : "text-muted-foreground"}`}>
                    <Icon className="h-3 w-3" /> {c.kind} · {c.status}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground">{timeLabel(c.started_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
