import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ImagePlus,
  Mic,
  Pencil,
  Phone,
  Reply,
  Send,
  Square,
  Trash2,
  Video as VideoIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/components/RealtimeProvider";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  durationLabel,
  signedUrl,
  timeLabel,
  uploadChatMedia,
  type Conversation,
  type Message,
  type Profile,
} from "@/lib/whatsxup";

export const Route = createFileRoute("/_authenticated/chats/$id")({
  head: () => ({
    meta: [
      { title: "Conversation — WHATSXUP" },
      { name: "description", content: "A private real-time WHATSXUP conversation with text, media, voice notes and calls." },
      { property: "og:title", content: "Conversation — WHATSXUP" },
      { property: "og:description", content: "Private real-time messaging with media and calls." },
    ],
  }),
  component: ChatRoom,
});

function MediaBubble({ path, type }: { path: string; type: "image" | "video" | "audio" }) {
  const { data: url } = useQuery({
    queryKey: ["signed", "chat-media", path],
    queryFn: () => signedUrl("chat-media", path),
    staleTime: 50 * 60 * 1000,
  });
  if (!url) return <div className="h-40 w-56 animate-pulse rounded-xl bg-surface-2" />;
  if (type === "image") return <img src={url} alt="Shared" className="max-h-72 rounded-xl object-cover" />;
  if (type === "video") return <video src={url} controls className="max-h-72 rounded-xl" />;
  return <audio src={url} controls className="w-56" />;
}

function ChatRoom() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { onlineIds, startCall } = useRealtime();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const bottom = useRef<HTMLDivElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

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
        .select("user_id, role, profiles:user_id(*)")
        .eq("conversation_id", id);
      if (error) throw error;
      return (data ?? []) as unknown as { user_id: string; role: string; profiles: Profile }[];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  const other = members.find((m) => m.user_id !== user?.id);
  const title = conv?.type === "group" ? (conv.name ?? "Group") : (other?.profiles.display_name ?? "Chat");
  const isOnline = other ? onlineIds.has(other.user_id) : false;

  const readsQuery = useQuery({
    queryKey: ["reads", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversation_members")
        .select("user_id, last_read_at")
        .eq("conversation_id", id);
      return data ?? [];
    },
  });

  const othersReadAt = useMemo(() => {
    const rows = (readsQuery.data ?? []).filter((r) => r.user_id !== user?.id);
    if (!rows.length) return null;
    return rows.map((r) => r.last_read_at).sort().at(-1) ?? null;
  }, [readsQuery.data, user?.id]);

  // realtime messages + typing
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`room:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["messages", id] });
          void qc.invalidateQueries({ queryKey: ["chat-list"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${id}` },
        () => void qc.invalidateQueries({ queryKey: ["reads", id] }),
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as { userId: string; name: string };
        if (p.userId === user.id) return;
        setTypingUsers((prev) => (prev.includes(p.name) ? prev : [...prev, p.name]));
        setTimeout(() => setTypingUsers((prev) => prev.filter((n) => n !== p.name)), 3000);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [id, user, qc]);

  // mark read
  useEffect(() => {
    if (!user || !messages.length) return;
    void supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .eq("user_id", user.id);
    void qc.invalidateQueries({ queryKey: ["chat-list"] });
  }, [messages.length, id, user, qc]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingUsers.length]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  async function broadcastTyping() {
    const ch = supabase.channel(`room:${id}`);
    await ch.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user!.id, name: "Someone" },
    });
  }

  async function sendMessage(payload: Partial<Message>) {
    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user!.id,
      type: payload.type ?? "text",
      content: payload.content ?? null,
      media_url: payload.media_url ?? null,
      media_duration: payload.media_duration ?? null,
      reply_to: replyTo?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setReplyTo(null);
    void supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["messages", id] });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    if (editing) {
      const { error } = await supabase
        .from("messages")
        .update({ content: body, edited_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (error) toast.error(error.message);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["messages", id] });
      return;
    }
    await sendMessage({ type: "text", content: body });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Files must be under 50 MB.");
      return;
    }
    const kind = file.type.startsWith("video") ? "video" : "image";
    try {
      const path = await uploadChatMedia(id, file, kind === "video" ? "mp4" : "jpg");
      await sendMessage({ type: kind, media_url: path });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (ev) => chunks.current.push(ev.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        const seconds = recSecs;
        setRecSecs(0);
        try {
          const path = await uploadChatMedia(id, blob, "webm");
          await sendMessage({ type: "audio", media_url: path, media_duration: seconds });
        } catch (err) {
          toast.error((err as Error).message);
        }
      };
      mr.start();
      recorder.current = mr;
      setRecSecs(0);
      setRecording(true);
    } catch (err) {
      const name = (err as DOMException)?.name;
      toast.error(
        name === "NotAllowedError"
          ? "Microphone permission denied. Enable it in your browser settings."
          : "Could not start recording.",
      );
    }
  }

  async function deleteMessage(m: Message) {
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), content: null, media_url: null })
      .eq("id", m.id);
    if (error) toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["messages", id] });
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col app-gradient">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/85 px-3 py-2.5 backdrop-blur safe-top">
        <Button size="icon" variant="ghost" onClick={() => void navigate({ to: "/chats" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {conv?.type === "group" ? (
          <Link to="/groups/$id" params={{ id }} className="flex min-w-0 flex-1 items-center gap-3">
            <UserAvatar path={conv.avatar_url} name={title} bucket="chat-media" size="sm" />
            <div className="min-w-0">
              <p className="truncate font-medium leading-tight">{title}</p>
              <p className="truncate text-xs text-muted-foreground">{members.length} members</p>
            </div>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <UserAvatar path={other?.profiles.avatar_url ?? null} name={title} size="sm" online={isOnline} />
            <div className="min-w-0">
              <p className="truncate font-medium leading-tight">{title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {typingUsers.length ? "typing…" : isOnline ? "online" : "offline"}
              </p>
            </div>
          </div>
        )}
        {conv?.type === "direct" && other && (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                void startCall(
                  { id: other.user_id, name: other.profiles.display_name, avatar: other.profiles.avatar_url },
                  "voice",
                )
              }
            >
              <Phone className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                void startCall(
                  { id: other.user_id, name: other.profiles.display_name, avatar: other.profiles.avatar_url },
                  "video",
                )
              }
            >
              <VideoIcon className="h-5 w-5" />
            </Button>
          </>
        )}
      </header>

      <div className="flex-1 space-y-2 px-3 py-4">
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const sender = members.find((x) => x.user_id === m.sender_id)?.profiles;
          const parent = m.reply_to ? messages.find((x) => x.id === m.reply_to) : null;
          const seen = mine && othersReadAt ? m.created_at <= othersReadAt : false;
          return (
            <div key={m.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-panel ${
                  mine ? "bg-primary text-primary-foreground" : "bg-surface"
                }`}
              >
                {conv?.type === "group" && !mine && (
                  <p className="mb-1 text-[11px] font-semibold text-primary">{sender?.display_name}</p>
                )}
                {parent && (
                  <div className="mb-1 border-l-2 border-current/40 pl-2 text-[11px] opacity-80">
                    {parent.deleted_at ? "Deleted message" : (parent.content ?? "Attachment")}
                  </div>
                )}
                {m.deleted_at ? (
                  <p className="italic opacity-70">This message was deleted</p>
                ) : m.type === "text" ? (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                ) : (
                  <div className="space-y-1">
                    <MediaBubble path={m.media_url!} type={m.type as "image" | "video" | "audio"} />
                    {m.type === "audio" && m.media_duration != null && (
                      <p className="text-[11px] opacity-70">{durationLabel(m.media_duration)}</p>
                    )}
                  </div>
                )}
                <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-70">
                  {m.edited_at && <span>edited</span>}
                  <span>{timeLabel(m.created_at)}</span>
                  {mine && !m.deleted_at && (seen ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                </div>
                {!m.deleted_at && (
                  <div className="mt-1 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button className="text-[11px] underline-offset-2 hover:underline" onClick={() => setReplyTo(m)}>
                      <Reply className="inline h-3 w-3" /> Reply
                    </button>
                    {mine && m.type === "text" && (
                      <button
                        className="text-[11px] underline-offset-2 hover:underline"
                        onClick={() => {
                          setEditing(m);
                          setText(m.content ?? "");
                        }}
                      >
                        <Pencil className="inline h-3 w-3" /> Edit
                      </button>
                    )}
                    {mine && (
                      <button
                        className="text-[11px] underline-offset-2 hover:underline"
                        onClick={() => void deleteMessage(m)}
                      >
                        <Trash2 className="inline h-3 w-3" /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {typingUsers.length > 0 && (
          <p className="px-2 text-xs text-muted-foreground">Typing…</p>
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={submit}
        className="sticky bottom-0 z-20 space-y-2 border-t border-border/60 bg-background/90 px-3 py-2.5 backdrop-blur safe-bottom"
      >
        {(replyTo || editing) && (
          <div className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-xs">
            <span className="truncate text-muted-foreground">
              {editing ? "Editing message" : `Replying to: ${replyTo?.content ?? "attachment"}`}
            </span>
            <button
              type="button"
              onClick={() => {
                setReplyTo(null);
                setEditing(null);
                setText("");
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input ref={fileInput} type="file" accept="image/*,video/*" hidden onChange={(e) => void onFile(e)} />
          <Button type="button" size="icon" variant="ghost" onClick={() => fileInput.current?.click()}>
            <ImagePlus className="h-5 w-5" />
          </Button>
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              void broadcastTyping();
            }}
            placeholder={recording ? `Recording ${durationLabel(recSecs)}` : "Message"}
            disabled={recording}
          />
          {text.trim() ? (
            <Button type="submit" size="icon">
              <Send className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              variant={recording ? "destructive" : "default"}
              onClick={() => void toggleRecording()}
            >
              {recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
