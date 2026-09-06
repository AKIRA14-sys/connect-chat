import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { PENDING_JOIN_KEY } from "@/lib/groupExtras";

export const Route = createFileRoute("/g/$slug/join")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Join a group — XUPPIN" },
      {
        name: "description",
        content:
          "You have been invited to a XUPPIN group. Open the link to join the conversation.",
      },
      { property: "og:title", content: "Join a group — XUPPIN" },
      {
        property: "og:description",
        content: "You have been invited to a XUPPIN group chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinGroupPage,
});

type State =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "signin" }
  | { kind: "banned"; name: string }
  | { kind: "requested"; name: string }
  | {
      kind: "ready";
      id: string;
      name: string;
      avatar: string | null;
      approval: boolean;
    };

function JoinGroupPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      const { data: conv, error } = await supabase
        .from("conversations")
        .select(
          "id, name, avatar_url, type, invite_enabled, join_approval_required",
        )
        .eq("invite_slug", slug)
        .eq("type", "group")
        .eq("invite_enabled", true)
        .maybeSingle();

      if (cancelled) return;

      if (error || !conv) {
        setState({
          kind: "invalid",
          message:
            "This invite link is no longer active. Ask an admin for a new one.",
        });
        return;
      }

      const name = conv.name?.trim() || "Group";

      if (!user) {
        try {
          sessionStorage.setItem(
            PENDING_JOIN_KEY,
            `/g/${slug}/join`,
          );
        } catch {
          /* ignore */
        }
        setState({ kind: "signin" });
        return;
      }

      const { data: ban } = await supabase
        .from("group_bans")
        .select("user_id")
        .eq("conversation_id", conv.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (ban) {
        setState({ kind: "banned", name });
        return;
      }

      const { data: member } = await supabase
        .from("conversation_members")
        .select("id")
        .eq("conversation_id", conv.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (member) {
        void navigate({ to: "/chats/$id", params: { id: conv.id } });
        return;
      }

      setState({
        kind: "ready",
        id: conv.id,
        name,
        avatar: conv.avatar_url ?? null,
        approval: !!conv.join_approval_required,
      });
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  async function join() {
    if (state.kind !== "ready") return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        setState({ kind: "signin" });
        return;
      }

      if (state.approval) {
        const { error } = await supabase
          .from("group_join_requests")
          .upsert(
            {
              conversation_id: state.id,
              user_id: user.id,
              status: "pending",
            },
            { onConflict: "conversation_id,user_id" },
          );
        if (error) throw error;
        toast.success("Request sent — an admin will review it.");
        setState({ kind: "requested", name: state.name });
        return;
      }

      const { error } = await supabase.from("conversation_members").insert({
        conversation_id: state.id,
        user_id: user.id,
        role: "member",
      });
      if (error) throw error;

      await supabase.from("messages").insert({
        conversation_id: state.id,
        sender_id: user.id,
        type: "system",
        content: "joined the group",
      });

      toast.success(`You joined ${state.name}`);
      void navigate({ to: "/chats/$id", params: { id: state.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join the group");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center app-gradient px-6 py-12">
      <div className="w-full max-w-sm space-y-5 rounded-3xl border border-border bg-card p-6 text-center shadow-panel">
        {state.kind === "loading" ? (
          <p className="text-sm text-muted-foreground">Checking invite…</p>
        ) : null}

        {state.kind === "invalid" ? (
          <>
            <h1 className="text-xl font-semibold">Invite unavailable</h1>
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button className="w-full" onClick={() => void navigate({ to: "/chats" })}>
              Go to chats
            </Button>
          </>
        ) : null}

        {state.kind === "signin" ? (
          <>
            <h1 className="text-xl font-semibold">Sign in to join</h1>
            <p className="text-sm text-muted-foreground">
              Create an account or sign in, and we will bring you right back to
              this invite.
            </p>
            <Button className="w-full" onClick={() => void navigate({ to: "/auth" })}>
              Continue
            </Button>
          </>
        ) : null}

        {state.kind === "banned" ? (
          <>
            <h1 className="text-xl font-semibold">You are banned</h1>
            <p className="text-sm text-muted-foreground">
              An admin removed you from {state.name}. You cannot join with this
              link.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => void navigate({ to: "/chats" })}
            >
              Back to chats
            </Button>
          </>
        ) : null}

        {state.kind === "requested" ? (
          <>
            <h1 className="text-xl font-semibold">Request sent</h1>
            <p className="text-sm text-muted-foreground">
              An admin of {state.name} has to approve you before you can see the
              messages.
            </p>
            <Button className="w-full" onClick={() => void navigate({ to: "/chats" })}>
              Go to chats
            </Button>
          </>
        ) : null}

        {state.kind === "ready" ? (
          <>
            <div className="flex justify-center">
              <UserAvatar
                path={state.avatar}
                name={state.name}
                bucket="chat-media"
                size="xl"
              />
            </div>
            <h1 className="text-xl font-semibold">{state.name}</h1>
            <p className="text-sm text-muted-foreground">
              {state.approval
                ? "This group approves new members. Send a request to join."
                : "You have been invited to join this group."}
            </p>
            <Button className="w-full" disabled={busy} onClick={() => void join()}>
              {busy
                ? "Please wait…"
                : state.approval
                  ? "Request to join"
                  : "Join group"}
            </Button>
          </>
        ) : null}
      </div>
    </main>
  );
}
