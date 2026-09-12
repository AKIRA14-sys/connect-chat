import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { PENDING_JOIN_KEY, appOrigin } from "@/lib/groupExtras";
import { signedUrl } from "@/lib/whatsxup";

const DEFAULT_TITLE = "Join a group — XUPPIN";
const DEFAULT_DESC =
  "You have been invited to a XUPPIN group. Open the link to join the conversation.";
function defaultShareImage(): string {
  try {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}/favicon.png`;
    }
  } catch {
    /* ignore */
  }
  return "https://xuppin.vercel.app/favicon.png";
}

function setMetaTag(attr: "name" | "property", key: string, value: string) {
  if (typeof document === "undefined") return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

/** WhatsApp / Telegram style preview fields for this invite page. */
async function applyGroupShareMeta(opts: {
  name: string;
  description?: string | null;
  avatarPath?: string | null;
  pageUrl: string;
}) {
  const title = opts.name.trim() || "XUPPIN group";
  const description =
    (opts.description && opts.description.trim()) ||
    `Join ${title} on XUPPIN`;

  document.title = `${title} — Join on XUPPIN`;
  setMetaTag("name", "description", description);
  setMetaTag("property", "og:title", title);
  setMetaTag("property", "og:description", description);
  setMetaTag("property", "og:type", "website");
  setMetaTag("property", "og:url", opts.pageUrl);
  setMetaTag("name", "twitter:card", "summary_large_image");
  setMetaTag("name", "twitter:title", title);
  setMetaTag("name", "twitter:description", description);

  let imageUrl = defaultShareImage();
  if (opts.avatarPath) {
    if (/^https?:\/\//i.test(opts.avatarPath)) {
      imageUrl = opts.avatarPath;
    } else {
      const signed = await signedUrl("chat-media", opts.avatarPath);
      if (signed) imageUrl = signed;
    }
  }
  setMetaTag("property", "og:image", imageUrl);
  setMetaTag("name", "twitter:image", imageUrl);
}

export const Route = createFileRoute("/g/$slug/join")({
  ssr: false,
  head: () => ({
    meta: [
      { title: DEFAULT_TITLE },
      { name: "description", content: DEFAULT_DESC },
      { property: "og:title", content: DEFAULT_TITLE },
      { property: "og:description", content: DEFAULT_DESC },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/favicon.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinGroupPage,
});

type State =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "signin"; name: string; avatar: string | null; description: string | null }
  | { kind: "banned"; name: string }
  | { kind: "requested"; name: string }
  | {
      kind: "ready";
      id: string;
      name: string;
      avatar: string | null;
      description: string | null;
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
          "id, name, description, avatar_url, type, invite_enabled, join_approval_required",
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
      const description =
        (conv as { description?: string | null }).description ?? null;
      const avatar = conv.avatar_url ?? null;
      const pageUrl = `${appOrigin()}/g/${slug}/join`;

      // Update share preview to group photo + name + description
      void applyGroupShareMeta({
        name,
        description,
        avatarPath: avatar,
        pageUrl,
      });

      if (!user) {
        try {
          sessionStorage.setItem(PENDING_JOIN_KEY, `/g/${slug}/join`);
        } catch {
          /* ignore */
        }
        setState({ kind: "signin", name, avatar, description });
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
        avatar,
        description,
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
        setState({
          kind: "signin",
          name: state.name,
          avatar: state.avatar,
          description: state.description,
        });
        return;
      }

      if (state.approval) {
        const { error } = await supabase.from("group_join_requests").upsert(
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

  const showAvatar =
    state.kind === "ready" || state.kind === "signin"
      ? state.avatar
      : null;
  const showName =
    state.kind === "ready" ||
    state.kind === "signin" ||
    state.kind === "banned" ||
    state.kind === "requested"
      ? state.name
      : null;
  const showDesc =
    state.kind === "ready" || state.kind === "signin"
      ? state.description
      : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center app-gradient px-6 py-10">
      <div className="w-full max-w-sm space-y-4 text-center">
        {state.kind === "loading" ? (
          <p className="text-sm text-muted-foreground">Loading invite…</p>
        ) : null}

        {state.kind === "invalid" ? (
          <>
            <h1 className="text-xl font-semibold">Invite unavailable</h1>
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button
              className="w-full"
              onClick={() => void navigate({ to: "/chats" })}
            >
              Go to chats
            </Button>
          </>
        ) : null}

        {state.kind === "signin" ? (
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
            {state.description ? (
              <p className="text-sm text-muted-foreground">{state.description}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Sign in to join this group. We will bring you back here after.
            </p>
            <Button
              className="w-full"
              onClick={() => void navigate({ to: "/auth" })}
            >
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
            <Button
              className="w-full"
              onClick={() => void navigate({ to: "/chats" })}
            >
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
            {state.description ? (
              <p className="text-sm text-muted-foreground">{state.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {state.approval
                  ? "This group approves new members. Send a request to join."
                  : "You have been invited to join this group."}
              </p>
            )}
            <Button
              className="w-full"
              disabled={busy}
              onClick={() => void join()}
            >
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
