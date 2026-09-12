import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { PENDING_JOIN_KEY, FALLBACK_ORIGIN } from "@/lib/groupExtras";

/** Absolute OG image — WhatsApp needs full https URL (relative = no preview). */
const SITE = FALLBACK_ORIGIN;
const DEFAULT_TITLE = "Join a group — XUPPIN";
const DEFAULT_DESC =
  "You have been invited to a XUPPIN group. Open the link to join the conversation.";
const DEFAULT_OG_IMAGE = `${SITE}/icons/icon-512.png`;

export const Route = createFileRoute("/g/$slug/join")({
  ssr: false,
  head: () => ({
    meta: [
      { title: DEFAULT_TITLE },
      { name: "description", content: DEFAULT_DESC },
      { property: "og:title", content: DEFAULT_TITLE },
      { property: "og:description", content: DEFAULT_DESC },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "XUPPIN" },
      { property: "og:image", content: DEFAULT_OG_IMAGE },
      { property: "og:image:secure_url", content: DEFAULT_OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: DEFAULT_TITLE },
      { name: "twitter:description", content: DEFAULT_DESC },
      { name: "twitter:image", content: DEFAULT_OG_IMAGE },
    ],
  }),
  component: JoinGroupPage,
});

type PreviewInfo = {
  id: string;
  name: string;
  avatar: string | null;
  description: string | null;
  approval: boolean;
  memberCount: number | null;
};

type State =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "signin"; preview: PreviewInfo }
  | { kind: "banned"; name: string }
  | { kind: "requested"; name: string }
  | { kind: "preview"; preview: PreviewInfo };

function JoinGroupPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [showChatPreview, setShowChatPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      // Safe columns only (do not select description here — can break invite lookup)
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
        console.warn("[join] invite lookup failed", error?.message, slug);
        setState({
          kind: "invalid",
          message:
            "This invite link is no longer active. Ask an admin for a new one.",
        });
        return;
      }

      const name = conv.name?.trim() || "Group";
      const avatar = conv.avatar_url ?? null;
      const approval = !!conv.join_approval_required;

      // Optional extras — never fail the invite if these fail
      let description: string | null = null;
      let memberCount: number | null = null;
      try {
        const { data: extra } = await supabase
          .from("conversations")
          .select("description")
          .eq("id", conv.id)
          .maybeSingle();
        description = (extra as { description?: string | null } | null)
          ?.description ?? null;
      } catch {
        /* ignore */
      }
      try {
        const { count } = await supabase
          .from("conversation_members")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id);
        if (typeof count === "number") memberCount = count;
      } catch {
        /* ignore */
      }

      const preview: PreviewInfo = {
        id: conv.id,
        name,
        avatar,
        description,
        approval,
        memberCount,
      };

      try {
        document.title = `${name} — Join on XUPPIN`;
      } catch {
        /* ignore */
      }

      if (!user) {
        try {
          sessionStorage.setItem(PENDING_JOIN_KEY, `/g/${slug}/join`);
        } catch {
          /* ignore */
        }
        setState({ kind: "signin", preview });
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
        // Already in group → open chat (not auto-join)
        void navigate({ to: "/chats/$id", params: { id: conv.id } });
        return;
      }

      // Always land on preview first — user must tap Join
      setState({ kind: "preview", preview });
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  async function join() {
    const preview =
      state.kind === "preview"
        ? state.preview
        : state.kind === "signin"
          ? state.preview
          : null;
    if (!preview) return;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setState({ kind: "signin", preview });
      return;
    }

    setBusy(true);
    try {
      if (preview.approval) {
        const { error } = await supabase.from("group_join_requests").upsert(
          {
            conversation_id: preview.id,
            user_id: auth.user.id,
            status: "pending",
          },
          { onConflict: "conversation_id,user_id" },
        );
        if (error) throw error;
        toast.success("Request sent — an admin will review it.");
        setState({ kind: "requested", name: preview.name });
        return;
      }

      const { error } = await supabase.from("conversation_members").insert({
        conversation_id: preview.id,
        user_id: auth.user.id,
        role: "member",
      });
      if (error) throw error;

      await supabase.from("messages").insert({
        conversation_id: preview.id,
        sender_id: auth.user.id,
        type: "system",
        content: "joined the group",
      });

      toast.success(`You joined ${preview.name}`);
      void navigate({ to: "/chats/$id", params: { id: preview.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join the group");
    } finally {
      setBusy(false);
    }
  }

  const info =
    state.kind === "preview" || state.kind === "signin"
      ? state.preview
      : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center app-gradient px-6 py-10">
      <div className="w-full max-w-sm space-y-4">
        {state.kind === "loading" ? (
          <p className="text-center text-sm text-muted-foreground">
            Loading invite…
          </p>
        ) : null}

        {state.kind === "invalid" ? (
          <div className="space-y-4 text-center">
            <h1 className="text-xl font-semibold">Invite unavailable</h1>
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button
              className="w-full"
              onClick={() => void navigate({ to: "/chats" })}
            >
              Go to chats
            </Button>
          </div>
        ) : null}

        {state.kind === "banned" ? (
          <div className="space-y-4 text-center">
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
          </div>
        ) : null}

        {state.kind === "requested" ? (
          <div className="space-y-4 text-center">
            <h1 className="text-xl font-semibold">Request sent</h1>
            <p className="text-sm text-muted-foreground">
              An admin of {state.name} has to approve you before you can see the
              messages.
            </p>
            <Button
              className="w-full"
              onClick={() => void navigate({ to: "/chats" })}
            >
              Go to chats
            </Button>
          </div>
        ) : null}

        {/* Telegram-style invite preview (not joined yet) */}
        {info ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-lg backdrop-blur">
              <div className="flex flex-col items-center gap-3 text-center">
                <UserAvatar
                  path={info.avatar}
                  name={info.name}
                  bucket="chat-media"
                  size="xl"
                />
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold tracking-tight">
                    {info.name}
                  </h1>
                  {info.memberCount != null ? (
                    <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {info.memberCount}{" "}
                      {info.memberCount === 1 ? "member" : "members"}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">XUPPIN group</p>
                  )}
                </div>

                {info.description?.trim() ? (
                  <p className="max-h-40 w-full overflow-y-auto whitespace-pre-wrap break-words rounded-2xl bg-muted/40 px-3 py-2 text-left text-sm leading-relaxed text-foreground">
                    {info.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {info.approval
                      ? "Admins approve new members before they can chat."
                      : "You are invited to join this group on XUPPIN."}
                  </p>
                )}
              </div>

              {/* Non-sensitive chat style preview (no real private messages) */}
              {showChatPreview ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-border/50 bg-zinc-950/80">
                  <div className="border-b border-white/10 px-3 py-2 text-left text-xs font-medium text-zinc-300">
                    Chat preview
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-3 py-2 text-left text-xs text-zinc-200">
                      Welcome to the group 👋
                    </div>
                    <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-emerald-600/80 px-3 py-2 text-left text-xs text-white">
                      Say hi when you join
                    </div>
                    <p className="pt-1 text-center text-[10px] text-zinc-500">
                      Real messages stay private until you join. This is only a
                      sample layout.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-2">
                {state.kind === "signin" ? (
                  <Button
                    className="w-full"
                    onClick={() => void navigate({ to: "/auth" })}
                  >
                    Sign in to join
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    disabled={busy}
                    onClick={() => void join()}
                  >
                    {busy
                      ? "Please wait…"
                      : info.approval
                        ? "Request to join"
                        : "Join group"}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowChatPreview((v) => !v)}
                >
                  {showChatPreview ? "Hide chat preview" : "Preview chat style"}
                </Button>
              </div>
            </div>

            <p className="text-center text-[11px] text-muted-foreground">
              You will not join until you confirm above.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
