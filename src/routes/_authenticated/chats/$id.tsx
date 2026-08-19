import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  ImagePlus,
  Mic,
  Pencil,
  Phone,
  Reply,
  Send,
  SmilePlus,
  Square,
  Trash2,
  UserPlus,
  Video as VideoIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/components/RealtimeProvider";
import { UserAvatar } from "@/components/UserAvatar";
import XupGames from "@/components/XupGames";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOnlineStatus } from "@/components/ConnectionBanner";

import {
  dequeue,
  enqueue,
  outboxFor,
  updateItem,
  type OutboxItem,
} from "@/lib/outbox";

import { notifyNewMessage } from "@/lib/push.functions";

import {
  durationLabel,
  lastSeenLabel,
  signedUrl,
  timeLabel,
  uploadChatMedia,
  type Conversation,
  type Message,
  type Profile,
} from "@/lib/whatsxup";

const PAGE_SIZE = 40;

/* ============================================================
 * MESSAGE REACTIONS
 * ============================================================ */

const REACTIONS = [
  "❤️",
  "😂",
  "😮",
  "😢",
  "🔥",
  "👍",
];

type MessageReaction = {
  id: string;
  message_id: string;
  user_id: string;
  reaction: string;
  created_at?: string;
};

type DeliveryReceipt = {
  message_id: string;
  user_id: string;
  delivered_at: string;
};

/* ============================================================
 * STICKERS
 *
 * Stored in messages.content as the sticker ID.
 * This keeps stickers inside the existing messages system.
 * ============================================================ */

type Sticker = {
  id: string;
  emoji: string;
  label: string;
  pack: string;
};

const STICKERS: Sticker[] = [
  { id: "love", emoji: "🥰", label: "Love", pack: "Cute" },
  { id: "kiss", emoji: "😘", label: "Kiss", pack: "Cute" },
  { id: "heart", emoji: "❤️", label: "Heart", pack: "Cute" },
  { id: "hug", emoji: "🤗", label: "Hug", pack: "Cute" },

  { id: "laugh", emoji: "😂", label: "Laugh", pack: "Funny" },
  { id: "lol", emoji: "🤣", label: "LOL", pack: "Funny" },
  { id: "dead", emoji: "💀", label: "Dead", pack: "Funny" },
  { id: "sus", emoji: "🤨", label: "Sus", pack: "Funny" },

  { id: "fire", emoji: "🔥", label: "Fire", pack: "Reactions" },
  { id: "goat", emoji: "🐐", label: "GOAT", pack: "Reactions" },
  { id: "clap", emoji: "👏", label: "Clap", pack: "Reactions" },
  { id: "party", emoji: "🎉", label: "Party", pack: "Reactions" },

  { id: "power", emoji: "⚡", label: "Power", pack: "Anime" },
  { id: "angry", emoji: "😤", label: "Angry", pack: "Anime" },
  { id: "shock", emoji: "😱", label: "Shock", pack: "Anime" },
  { id: "cool", emoji: "😎", label: "Cool", pack: "Anime" },
];

const STICKER_PACKS = [
  "All",
  "Cute",
  "Funny",
  "Reactions",
  "Anime",
] as const;

type StickerPack = (typeof STICKER_PACKS)[number];

function getSticker(id: string | null | undefined) {
  if (!id) return null;
  return STICKERS.find((sticker) => sticker.id === id) ?? null;
}

/* ============================================================
 * DELETE MENU
 * ============================================================ */

type DeleteMenuState = {
  message: Message;
  x: number;
  y: number;
} | null;

/* ============================================================
 * ROUTE
 * ============================================================ */

export const Route = createFileRoute("/_authenticated/chats/$id")({
  head: () => ({
    meta: [
      { title: "Conversation — WHATSXUP" },
      {
        name: "description",
        content:
          "A private real-time WHATSXUP conversation with text, media, stickers, voice notes and calls.",
      },
    ],
  }),
  component: ChatRoom,
});

/* ============================================================
 * MEDIA BUBBLE
 * ============================================================ */

function MediaBubble({
  path,
  type,
}: {
  path: string;
  type: "image" | "video" | "audio";
}) {
  const { data: url } = useQuery({
    queryKey: ["signed", "chat-media", path],
    queryFn: () => signedUrl("chat-media", path),
    staleTime: 50 * 60 * 1000,
  });

  if (!url) {
    return (
      <div className="h-40 w-56 animate-pulse rounded-xl bg-surface-2" />
    );
  }

  if (type === "image") {
    return (
      <img
        src={url}
        alt="Shared"
        loading="lazy"
        decoding="async"
        className="max-h-72 rounded-xl object-cover"
      />
    );
  }

  if (type === "video") {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="max-h-72 rounded-xl"
      />
    );
  }

  return <audio src={url} controls preload="none" className="w-56" />;
}

/* ============================================================
 * CHAT ROOM
 * ============================================================ */

function ChatRoom() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { onlineIds, startCall } = useRealtime();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const online = useOnlineStatus();

  const [text, setText] = useState("");
  const [gamesOpen, setGamesOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [sendingIds, setSendingIds] = useState<string[]>([]);
  const [reactionPicker, setReactionPicker] = useState<string | null>(null);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickerPack, setStickerPack] = useState<StickerPack>("All");
  const [deleteMenu, setDeleteMenu] = useState<DeleteMenuState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [swipingMessageId, setSwipingMessageId] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const recordingStream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelRecordingRef = useRef(false);
  const bottom = useRef<HTMLDivElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const roomChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const touchStartX = useRef<Map<string, number>>(new Map());

  const messagesKey = useMemo(
    () => ["messages", id, limit] as const,
    [id, limit],
  );

  /* ==========================================================
   * CONVERSATION
   * ========================================================== */

  const { data: conv } = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Conversation;
    },
  });

  /* ==========================================================
   * MEMBERS
   * ========================================================== */

  const { data: members = [] } = useQuery({
    queryKey: ["conv-members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_members")
        .select("user_id, role")
        .eq("conversation_id", id);

      if (error) throw error;
      return (data ?? []) as { user_id: string; role: string }[];
    },
  });

  const otherMember = useMemo(() => {
    if (!user?.id) return null;
    return members.find((member) => member.user_id !== user.id) ?? null;
  }, [members, user?.id]);

  /* ==========================================================
   * OTHER PROFILE
   * ========================================================== */

  const { data: otherProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ["chat-profile", otherMember?.user_id],
    enabled: !!otherMember?.user_id,
    queryFn: async () => {
      if (!otherMember?.user_id) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", otherMember.user_id)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as Profile | null;
    },
  });

  const otherUserId = otherMember?.user_id ?? null;
  const otherName = otherProfile?.display_name?.trim() || "Unknown";
  const otherAvatar = otherProfile?.avatar_url ?? null;
  const canShowOnline = otherProfile?.show_online_status !== false;
  const isOtherOnline =
    !!otherUserId && onlineIds.has(otherUserId) && canShowOnline;

  const directSubtitle = loadingProfile
    ? "Loading…"
    : isOtherOnline
      ? "online"
      : canShowOnline
        ? lastSeenLabel(otherProfile?.last_seen ?? null)
        : "offline";

  const title =
    conv?.type === "group" ? conv.name?.trim() || "Group" : otherName;

  /* ==========================================================
   * MESSAGES
   * ========================================================== */

  const { data: messages = [], isFetching: fetchingMessages } = useQuery({
    queryKey: messagesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return ((data ?? []) as Message[]).slice().reverse();
    },
  });

  /* ==========================================================
   * PROFILES
   * ========================================================== */

  const memberIds = useMemo(
    () => members.map((member) => member.user_id),
    [members],
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ["conversation-profiles", id, memberIds.join(",")],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      if (!memberIds.length) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("id", memberIds);

      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const profile of profiles) {
      map.set(profile.id, profile);
    }
    return map;
  }, [profiles]);

  /* ==========================================================
   * READ RECEIPTS
   * ========================================================== */

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
    const rows = (readsQuery.data ?? []).filter(
      (row) => row.user_id !== user?.id,
    );

    if (!rows.length) return null;

    return rows.map((row) => row.last_read_at).sort().at(-1) ?? null;
  }, [readsQuery.data, user?.id]);

  /* ==========================================================
   * DELIVERY RECEIPTS
   * ========================================================== */

  const { data: deliveries = [] } = useQuery({
    queryKey: ["message-deliveries", id],
    queryFn: async () => {
      const messageIds = messages.map((message) => message.id);
      if (!messageIds.length) return [];

      const { data, error } = await (supabase as any)
        .from("message_deliveries")
        .select("*")
        .in("message_id", messageIds);

      if (error) {
        console.error("Delivery receipt query:", error);
        return [];
      }

      return (data ?? []) as DeliveryReceipt[];
    },
    enabled: messages.length > 0,
  });

  const deliveryMap = useMemo(() => {
    const map = new Map<string, DeliveryReceipt[]>();
    for (const delivery of deliveries) {
      const current = map.get(delivery.message_id) ?? [];
      current.push(delivery);
      map.set(delivery.message_id, current);
    }
    return map;
  }, [deliveries]);

  /* ==========================================================
   * MARK INCOMING MESSAGES DELIVERED
   * ========================================================== */

  useEffect(() => {
    if (!user?.id || !messages.length) return;

    const incoming = messages.filter(
      (message) => message.sender_id !== user.id,
    );

    if (!incoming.length) return;

    void (async () => {
      const rows = incoming.map((message) => ({
        message_id: message.id,
        user_id: user.id,
      }));

      const { error } = await (supabase as any)
        .from("message_deliveries")
        .upsert(rows, {
          onConflict: "message_id,user_id",
          ignoreDuplicates: true,
        });

      if (error) {
        console.error("Could not mark delivered:", error);
        return;
      }

      void qc.invalidateQueries({
        queryKey: ["message-deliveries", id],
      });
    })();
  }, [messages, user?.id, id, qc]);

  /* ==========================================================
   * CONTACT CHECK
   * ========================================================== */

  const isContact = useQuery({
    queryKey: ["is-contact", otherUserId],
    enabled: !!otherUserId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id")
        .eq("owner_id", user!.id)
        .eq("contact_id", otherUserId!)
        .maybeSingle();

      if (error) return false;
      return !!data;
    },
  });

  /* ==========================================================
   * REACTIONS
   * ========================================================== */

  const reactionsTable = (supabase as any).from("message_reactions");

  const { data: reactions = [] } = useQuery({
    queryKey: ["message-reactions", id],
    enabled: messages.length > 0,
    queryFn: async (): Promise<MessageReaction[]> => {
      const messageIds = messages.map((message) => message.id);
      if (!messageIds.length) return [];

      const { data, error } = await reactionsTable
        .select("*")
        .in("message_id", messageIds);

      if (error) throw error;
      return (data ?? []) as MessageReaction[];
    },
  });

  const reactionMap = useMemo(() => {
    const map = new Map<string, MessageReaction[]>();
    for (const reaction of reactions) {
      const current = map.get(reaction.message_id) ?? [];
      current.push(reaction);
      map.set(reaction.message_id, current);
    }
    return map;
  }, [reactions]);

  function reactionCounts(messageId: string) {
    const messageReactions = reactionMap.get(messageId) ?? [];
    const counts = new Map<string, number>();

    for (const reaction of messageReactions) {
      counts.set(reaction.reaction, (counts.get(reaction.reaction) ?? 0) + 1);
    }

    return Array.from(counts.entries());
  }

  function hasReacted(messageId: string, emoji: string) {
    return (
      reactionMap
        .get(messageId)
        ?.some(
          (reaction) =>
            reaction.user_id === user?.id && reaction.reaction === emoji,
        ) ?? false
    );
  }

  async function toggleReaction(message: Message, emoji: string) {
    if (!user) return;

    setReactionPicker(null);

    const existing = reactionMap
      .get(message.id)
      ?.find(
        (reaction) =>
          reaction.user_id === user.id && reaction.reaction === emoji,
      );

    try {
      if (existing) {
        const { error } = await reactionsTable
          .delete()
          .eq("id", existing.id)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await reactionsTable.insert({
          message_id: message.id,
          user_id: user.id,
          reaction: emoji,
        });

        if (error) throw error;
      }

      await qc.invalidateQueries({
        queryKey: ["message-reactions", id],
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update reaction.",
      );
    }
  }

  /* ==========================================================
   * MESSAGE CACHE
   * ========================================================== */

  const applyMessage = useCallback(
    (row: Message) => {
      qc.setQueryData<Message[]>(messagesKey, (prev = []) => {
        const without = prev.filter((message) => message.id !== row.id);
        return [...without, row].sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        );
      });

      void qc.invalidateQueries({
        queryKey: ["chat-list"],
      });
    },
    [qc, messagesKey],
  );

  /* ==========================================================
   * REALTIME
   *
   * Uses BOTH postgres_changes (in case Realtime replication is
   * enabled on the server) AND a direct broadcast fallback (sent
   * by the sender right after a successful insert). The broadcast
   * path does not depend on any Supabase dashboard configuration,
   * so it works even if the "messages" table isn't added to the
   * realtime publication. applyMessage dedupes by id, so if both
   * paths fire for the same message, nothing breaks or duplicates.
   * ========================================================== */

  useEffect(() => {
    if (!user) return;

    const ch = supabase.channel(`room:${id}`, {
      config: {
        broadcast: {
          self: false,
        },
      },
    });

    ch.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${id}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as Message | undefined;
        if (!row) return;

        if (payload.eventType === "DELETE") {
          qc.setQueryData<Message[]>(messagesKey, (prev = []) =>
            prev.filter((message) => message.id !== row.id),
          );
          return;
        }

        applyMessage(row);
      },
    );

    // NEW: direct broadcast fallback for new/edited/deleted messages.
    ch.on("broadcast", { event: "message_upsert" }, ({ payload }) => {
      const row = payload?.message as Message | undefined;
      if (!row) return;

      applyMessage(row);
    });

    ch.on("broadcast", { event: "message_delete" }, ({ payload }) => {
      const messageId = payload?.messageId as string | undefined;
      if (!messageId) return;

      qc.setQueryData<Message[]>(messagesKey, (prev = []) =>
        prev.filter((message) => message.id !== messageId),
      );
    });

    ch.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversation_members",
        filter: `conversation_id=eq.${id}`,
      },
      () => {
        void qc.invalidateQueries({ queryKey: ["reads", id] });
        void qc.invalidateQueries({ queryKey: ["conv-members", id] });
      },
    );

    ch.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_deliveries",
      },
      () => {
        void qc.invalidateQueries({
          queryKey: ["message-deliveries", id],
        });
      },
    );

    ch.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_reactions",
      },
      () => {
        void qc.invalidateQueries({
          queryKey: ["message-reactions", id],
        });
      },
    );

    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      const p = payload as { userId: string; name: string };

      if (p.userId === user.id) return;

      setTypingUsers((prev) =>
        prev.includes(p.name) ? prev : [...prev, p.name],
      );

      const oldTimer = typingTimeouts.current.get(p.userId);
      if (oldTimer) clearTimeout(oldTimer);

      const timer = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((name) => name !== p.name));
        typingTimeouts.current.delete(p.userId);
      }, 3500);

      typingTimeouts.current.set(p.userId, timer);
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void qc.invalidateQueries({ queryKey: ["messages", id] });
      }
    });

    roomChannel.current = ch;

    return () => {
      for (const timer of typingTimeouts.current.values()) {
        clearTimeout(timer);
      }

      typingTimeouts.current.clear();
      roomChannel.current = null;

      void supabase.removeChannel(ch);
    };
  }, [id, user, qc, applyMessage, messagesKey]);

  /* ==========================================================
   * MARK READ
   * ========================================================== */

  useEffect(() => {
    if (!user || !messages.length || !online) return;

    void supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .eq("user_id", user.id)
      .then(() => qc.invalidateQueries({ queryKey: ["chat-list"] }));
  }, [messages.length, id, user, qc, online]);

  /* ==========================================================
   * AUTO SCROLL
   * ========================================================== */

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingUsers.length, pending.length]);

  /* ==========================================================
   * RECORDING TIMER
   * ========================================================== */

  useEffect(() => {
    if (!recording) return;

    const timer = setInterval(() => {
      setRecSecs((seconds) => seconds + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [recording]);

  /* ==========================================================
   * OUTBOX
   * ========================================================== */

  const refreshOutbox = useCallback(() => setPending(outboxFor(id)), [id]);

  const flushOutbox = useCallback(async () => {
    if (!user || !navigator.onLine) return;

    for (const item of outboxFor(id)) {
      updateItem(item.id, { state: "sending" });

      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: item.conversationId,
          sender_id: user.id,
          type: "text",
          content: item.content,
          reply_to: item.replyTo,
        })
        .select("*")
        .single();

      if (error) {
        updateItem(item.id, {
          state: "failed",
          error: error.message,
        });
      } else {
        dequeue(item.id);
        applyMessage(data as Message);

        // NEW: broadcast so the other person sees it instantly too.
        void roomChannel.current?.send({
          type: "broadcast",
          event: "message_upsert",
          payload: { message: data },
        });
      }
    }

    refreshOutbox();
  }, [id, user, applyMessage, refreshOutbox]);

  useEffect(() => {
    refreshOutbox();

    const onChange = () => refreshOutbox();
    const onOnline = () => void flushOutbox();

    window.addEventListener("whatsxup:outbox", onChange);
    window.addEventListener("online", onOnline);

    void flushOutbox();

    return () => {
      window.removeEventListener("whatsxup:outbox", onChange);
      window.removeEventListener("online", onOnline);
    };
  }, [refreshOutbox, flushOutbox]);

  /* ==========================================================
   * TYPING
   * ========================================================== */

  function broadcastTyping() {
    if (!user) return;

    const now = Date.now();
    if (now - lastTypingSent.current < 1500) return;

    lastTypingSent.current = now;

    const meProfile = profileMap.get(user.id);
    const myName = meProfile?.display_name?.trim() || "Someone";

    void roomChannel.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id, name: myName },
    });
  }

  /* ==========================================================
   * PUSH
   * ========================================================== */

  async function pushNotify(preview: string) {
    try {
      const meProfile = user ? profileMap.get(user.id) : null;

      await notifyNewMessage({
        data: {
          conversationId: id,
          title:
            conv?.type === "group"
              ? conv.name ?? "WHATSXUP group"
              : meProfile?.display_name ?? "WHATSXUP",
          preview:
            conv?.type === "group"
              ? `${meProfile?.display_name ?? "Someone"}: ${preview}`.slice(
                  0,
                  160,
                )
              : preview.slice(0, 160),
        },
      });
    } catch {
      // Best effort.
    }
  }

  /* ==========================================================
   * SEND MESSAGE
   *
   * Optimistic bubble shows instantly for the sender. After the
   * insert succeeds, the confirmed row is also broadcast directly
   * to everyone else in the room, so they see it immediately too
   * — independent of whether postgres_changes/replication works.
   * ========================================================== */

  async function sendMessage(payload: Partial<Message>, preview: string) {
    if (!user) return false;

    const optimisticId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const optimisticReplyTo = replyTo?.id ?? null;

    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: id,
      sender_id: user.id,
      type: (payload.type ?? "text") as any,
      content: payload.content ?? null,
      media_url: payload.media_url ?? null,
      media_duration: payload.media_duration ?? null,
      reply_to: optimisticReplyTo,
      created_at: nowIso,
      edited_at: null,
    } as Message;

    applyMessage(optimisticMessage);
    setReplyTo(null);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: id,
        sender_id: user.id,
        type: (payload.type ?? "text") as any,
        content: payload.content ?? null,
        media_url: payload.media_url ?? null,
        media_duration: payload.media_duration ?? null,
        reply_to: optimisticReplyTo,
      })
      .select("*")
      .single();

    if (error || !data) {
      qc.setQueryData<Message[]>(messagesKey, (prev = []) =>
        prev.filter((message) => message.id !== optimisticId),
      );

      toast.error(error?.message ?? "Could not send message");
      return false;
    }

    qc.setQueryData<Message[]>(messagesKey, (prev = []) => {
      const withoutTemp = prev.filter(
        (message) => message.id !== optimisticId,
      );

      return [...withoutTemp, data as Message].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      );
    });

    // NEW: broadcast the confirmed message directly to everyone else
    // in the room, instead of waiting on postgres_changes replication.
    void roomChannel.current?.send({
      type: "broadcast",
      event: "message_upsert",
      payload: { message: data },
    });

    void pushNotify(preview);

    return true;
  }

  /* ==========================================================
   * SEND STICKER
   * ========================================================== */

  async function sendSticker(stickerId: string) {
    if (!user || !online) return;

    const sticker = getSticker(stickerId);
    if (!sticker) return;

    setStickerPickerOpen(false);

    await sendMessage(
      { type: "sticker" as any, content: sticker.id },
      `${sticker.emoji} Sticker`,
    );
  }

  /* ==========================================================
   * TEXT MESSAGE
   * ========================================================== */

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const body = text.trim();
    if (!body || !user) return;

    setText("");

    if (editing) {
      const target = editing;
      setEditing(null);

      const editedAt = new Date().toISOString();

      qc.setQueryData<Message[]>(messagesKey, (prev = []) =>
        prev.map((message) =>
          message.id === target.id
            ? { ...message, content: body, edited_at: editedAt }
            : message,
        ),
      );

      const { data, error } = await supabase
        .from("messages")
        .update({ content: body, edited_at: editedAt })
        .eq("id", target.id)
        .select("*")
        .single();

      if (error) {
        toast.error(error.message);
      } else if (data) {
        // NEW: broadcast the edit too, so it's instant for others.
        void roomChannel.current?.send({
          type: "broadcast",
          event: "message_upsert",
          payload: { message: data },
        });
      }

      return;
    }

    if (!navigator.onLine) {
      enqueue({
        id: crypto.randomUUID(),
        conversationId: id,
        senderId: user.id,
        content: body,
        replyTo: replyTo?.id ?? null,
        createdAt: new Date().toISOString(),
      });

      setReplyTo(null);
      refreshOutbox();
      return;
    }

    const ok = await sendMessage({ type: "text", content: body }, body);

    if (!ok) {
      enqueue({
        id: crypto.randomUUID(),
        conversationId: id,
        senderId: user.id,
        content: body,
        replyTo: replyTo?.id ?? null,
        createdAt: new Date().toISOString(),
      });

      refreshOutbox();
    }
  }

  /* ==========================================================
   * MEDIA
   * ========================================================== */

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (
      !file.type.startsWith("image/") &&
      !file.type.startsWith("video/")
    ) {
      toast.error("Only images and videos are supported.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Files must be under 50 MB.");
      return;
    }

    const kind = file.type.startsWith("video") ? "video" : "image";

    try {
      const path = await uploadChatMedia(
        id,
        file,
        kind === "video" ? "mp4" : "jpg",
      );

      await sendMessage(
        { type: kind, media_url: path },
        kind === "video" ? "🎬 Video" : "📷 Photo",
      );
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  /* ==========================================================
   * VOICE RECORDING
   * ========================================================== */

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const mediaRecorder = new MediaRecorder(stream);
      chunks.current = [];
      cancelRecordingRef.current = false;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingStream.current = null;

        const wasCancelled = cancelRecordingRef.current;
        const seconds = recSecs;

        setRecording(false);
        setRecSecs(0);
        recorder.current = null;

        if (wasCancelled) {
          chunks.current = [];
          return;
        }

        const blob = new Blob(chunks.current, { type: "audio/webm" });
        chunks.current = [];

        if (!blob.size) return;

        try {
          const path = await uploadChatMedia(id, blob, "webm");

          await sendMessage(
            { type: "audio", media_url: path, media_duration: seconds },
            "🎙️ Voice note",
          );
        } catch (error) {
          toast.error((error as Error).message);
        }
      };

      mediaRecorder.start();
      recorder.current = mediaRecorder;
      recordingStream.current = stream;

      setRecSecs(0);
      setRecording(true);
    } catch (error) {
      const name = (error as DOMException)?.name;

      toast.error(
        name === "NotAllowedError"
          ? "Microphone permission denied. Enable it in your browser settings."
          : "Could not start recording.",
      );
    }
  }

  function stopRecordingAndSend() {
    cancelRecordingRef.current = false;

    if (recorder.current && recorder.current.state !== "inactive") {
      recorder.current.stop();
    }
  }

  function cancelRecording() {
    cancelRecordingRef.current = true;
    chunks.current = [];

    if (recorder.current && recorder.current.state !== "inactive") {
      recorder.current.stop();
    } else {
      recordingStream.current?.getTracks().forEach((track) => track.stop());
      recordingStream.current = null;
      recorder.current = null;

      setRecording(false);
      setRecSecs(0);
    }
  }

  /* ==========================================================
   * DELETE FOR ME
   * ========================================================== */

  async function deleteForMe(message: Message) {
    if (!user) return;

    setDeletingId(message.id);

    try {
      const { error } = await (supabase as any)
        .from("message_deletions")
        .upsert(
          { message_id: message.id, user_id: user.id },
          { onConflict: "message_id,user_id" },
        );

      if (error) throw error;

      qc.setQueryData<Message[]>(messagesKey, (prev = []) =>
        prev.filter((item) => item.id !== message.id),
      );

      setDeleteMenu(null);
      toast.success("Message deleted for you");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete message for you.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  /* ==========================================================
   * DELETE FOR EVERYONE
   * ========================================================== */

  async function deleteForEveryone(message: Message) {
    if (!user || message.sender_id !== user.id) {
      toast.error("You can only delete your own messages for everyone.");
      return;
    }

    setDeletingId(message.id);

    const deletedAt = new Date().toISOString();

    try {
      const { data, error } = await (supabase as any)
        .from("messages")
        .update({ deleted_at: deletedAt, content: null, media_url: null })
        .eq("id", message.id)
        .eq("sender_id", user.id)
        .select("*")
        .single();

      if (error) throw error;

      if (data) {
        applyMessage(data as Message);

        // NEW: broadcast the deletion so it's instant for others.
        void roomChannel.current?.send({
          type: "broadcast",
          event: "message_upsert",
          payload: { message: data },
        });
      }

      setDeleteMenu(null);
      toast.success("Message deleted for everyone");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete message for everyone.",
      );

      void qc.invalidateQueries({ queryKey: ["messages", id] });
    } finally {
      setDeletingId(null);
    }
  }

  /* ==========================================================
   * DELETE MENU
   * ========================================================== */

  function openDeleteMenu(event: React.MouseEvent, message: Message) {
    event.stopPropagation();

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    setDeleteMenu({
      message,
      x: Math.min(rect.left, window.innerWidth - 240),
      y: Math.min(rect.bottom + 8, window.innerHeight - 150),
    });
  }

  /* ==========================================================
   * REPLY
   * ========================================================== */

  function startReply(message: Message) {
    setReplyTo(message);
    setEditing(null);
    setReactionPicker(null);
    setStickerPickerOpen(false);

    setTimeout(() => {
      document
        .querySelector(
          "input[placeholder='Message'], input[placeholder='Message (offline)']",
        )
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  /* ==========================================================
   * JUMP TO REPLIED MESSAGE
   * ========================================================== */

  function jumpToMessage(messageId: string) {
    const element = document.getElementById(`message-${messageId}`);

    if (!element) {
      toast.info(
        "That message is not loaded. Load older messages to find it.",
      );
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });

    element.classList.add(
      "ring-2",
      "ring-primary",
      "ring-offset-2",
      "ring-offset-background",
    );

    setTimeout(() => {
      element.classList.remove(
        "ring-2",
        "ring-primary",
        "ring-offset-2",
        "ring-offset-background",
      );
    }, 1500);
  }

  /* ==========================================================
   * SWIPE RIGHT TO REPLY
   * ========================================================== */

  function handleTouchStart(event: React.TouchEvent, messageId: string) {
    touchStartX.current.set(messageId, event.touches[0]?.clientX ?? 0);
  }

  function handleTouchEnd(event: React.TouchEvent, message: Message) {
    const start = touchStartX.current.get(message.id);
    touchStartX.current.delete(message.id);

    if (start == null) return;

    const end = event.changedTouches[0]?.clientX ?? start;
    const distance = end - start;

    if (distance > 70) {
      setSwipingMessageId(message.id);
      startReply(message);

      setTimeout(() => {
        setSwipingMessageId(null);
      }, 300);
    }
  }

  /* ==========================================================
   * ADD CONTACT
   * ========================================================== */

  async function addContact() {
    if (!user?.id || !otherUserId) {
      toast.error("Could not identify this user.");
      return;
    }

    const { error } = await supabase
      .from("contacts")
      .insert({ owner_id: user.id, contact_id: otherUserId });

    if (error) {
      if (error.code === "23505") {
        toast.info("This person is already in your contacts.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    toast.success(`${otherName} added to your contacts`);

    void qc.invalidateQueries({
      queryKey: ["is-contact", otherUserId],
    });
  }

  /* ==========================================================
   * CALLS
   * ========================================================== */

  function callVoice() {
    if (!otherUserId) {
      toast.error("Could not identify the person you're calling.");
      return;
    }

    void startCall(
      { id: otherUserId, name: otherName, avatar: otherAvatar },
      "voice",
    );
  }

  function callVideo() {
    if (!otherUserId) {
      toast.error("Could not identify the person you're calling.");
      return;
    }

    void startCall(
      { id: otherUserId, name: otherName, avatar: otherAvatar },
      "video",
    );
  }

  const hasMore = messages.length >= limit;

  /* ==========================================================
   * CLOSE DELETE MENU
   * ========================================================== */

  useEffect(() => {
    function closeMenu() {
      setDeleteMenu(null);
    }

    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);

    return () => {
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, []);

  /* ==========================================================
   * FILTERED STICKERS
   * ========================================================== */

  const visibleStickers = useMemo(() => {
    if (stickerPack === "All") return STICKERS;
    return STICKERS.filter((sticker) => sticker.pack === stickerPack);
  }, [stickerPack]);

  /* ==========================================================
   * UI
   * ========================================================== */

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col app-gradient">
      {/* ======================================================
       * HEADER
       * ====================================================== */}

      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border/60 bg-background/85 px-2 py-2.5 backdrop-blur safe-top">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => void navigate({ to: "/chats" })}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {conv?.type === "group" ? (
          <Link
            to="/groups/$id"
            params={{ id }}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <UserAvatar
              path={conv.avatar_url}
              name={title}
              bucket="chat-media"
              size="sm"
            />

            <div className="min-w-0">
              <p className="truncate font-medium leading-tight">{title}</p>

              <p className="truncate text-xs text-muted-foreground">
                {typingUsers.length
                  ? `${typingUsers[0]} is typing…`
                  : `${members.length} members`}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <UserAvatar
              path={otherAvatar}
              name={otherName}
              size="sm"
              online={isOtherOnline}
            />

            <div className="min-w-0">
              <p className="truncate font-medium leading-tight">
                {otherName}
              </p>

              <p className="truncate text-xs text-muted-foreground">
                {typingUsers.length ? "typing…" : directSubtitle}
              </p>
            </div>
          </div>
        )}

        {conv?.type === "direct" && otherUserId && (
          <div className="flex items-center gap-0.5">
            {!isContact.data && (
              <Button
                size="icon"
                variant="ghost"
                title={`Add ${otherName} to contacts`}
                onClick={() => void addContact()}
              >
                <UserPlus className="h-5 w-5" />
              </Button>
            )}

            <Button size="icon" variant="ghost" onClick={callVoice}>
              <Phone className="h-5 w-5" />
            </Button>

            <Button size="icon" variant="ghost" onClick={callVideo}>
              <VideoIcon className="h-5 w-5" />
            </Button>
          </div>
        )}
      </header>

      {/* ======================================================
       * MESSAGES
       * ====================================================== */}

      <div className="flex-1 space-y-2 px-3 py-4">
        {hasMore && (
          <div className="flex justify-center pb-2">
            <Button
              size="sm"
              variant="outline"
              disabled={fetchingMessages}
              onClick={() =>
                setLimit((current) => current + PAGE_SIZE)
              }
            >
              {fetchingMessages ? "Loading…" : "Load older messages"}
            </Button>
          </div>
        )}

        {messages.map((message) => {
          const mine = message.sender_id === user?.id;
          const sender = profileMap.get(message.sender_id);

          const parent = message.reply_to
            ? messages.find((item) => item.id === message.reply_to)
            : null;

          const seen =
            mine && !!othersReadAt && message.created_at <= othersReadAt;

          const delivered =
            mine &&
            (deliveryMap
              .get(message.id)
              ?.some((delivery) => delivery.user_id !== user?.id) ?? false);

          const counts = reactionCounts(message.id);
          const pickerOpen = reactionPicker === message.id;
          const deleted = !!(message as any).deleted_at;
          const swiping = swipingMessageId === message.id;

          const sticker =
            (message.type as string) === "sticker"
              ? getSticker(message.content)
              : null;

          return (
            <div
              id={`message-${message.id}`}
              key={message.id}
              className={`group flex ${
                mine ? "justify-end" : "justify-start"
              }`}
              onTouchStart={(event) =>
                handleTouchStart(event, message.id)
              }
              onTouchEnd={(event) => handleTouchEnd(event, message)}
            >
              <div
                className={`relative max-w-[82%] transition-transform ${
                  swiping ? "translate-x-3" : ""
                }`}
              >
                {swiping && (
                  <div className="absolute -left-10 top-1/2 -translate-y-1/2 text-primary">
                    <Reply className="h-5 w-5" />
                  </div>
                )}

                <div
                  className={`rounded-2xl px-3 py-2 text-sm shadow-panel ${
                    sticker
                      ? "bg-transparent px-1 py-1 shadow-none"
                      : mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface"
                  }`}
                >
                  {conv?.type === "group" && !mine && !sticker && (
                    <p className="mb-1 text-[11px] font-semibold text-primary">
                      {sender?.display_name || "Unknown"}
                    </p>
                  )}

                  {parent && (
                    <button
                      type="button"
                      onClick={() => jumpToMessage(parent.id)}
                      className="mb-2 w-full rounded-lg border-l-2 border-current/40 bg-black/10 px-2 py-1 text-left text-[11px] opacity-80 transition hover:bg-black/20"
                    >
                      <span className="block font-semibold">Reply</span>

                      <span className="line-clamp-2">
                        {(parent as any).deleted_at
                          ? "Deleted message"
                          : parent.type === ("sticker" as any)
                            ? getSticker(parent.content)?.emoji ?? "Sticker"
                            : parent.content || "Attachment"}
                      </span>
                    </button>
                  )}

                  {deleted ? (
                    <p className="italic opacity-70">
                      This message was deleted
                    </p>
                  ) : sticker ? (
                    <div className="flex flex-col items-center justify-center">
                      <span
                        className="select-none text-7xl leading-none drop-shadow-sm"
                        title={sticker.label}
                      >
                        {sticker.emoji}
                      </span>
                    </div>
                  ) : message.type === "text" ? (
                    <p className="whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {message.media_url && (
                        <MediaBubble
                          path={message.media_url}
                          type={
                            message.type as "image" | "video" | "audio"
                          }
                        />
                      )}

                      {message.type === "audio" &&
                        message.media_duration != null && (
                          <p className="text-[11px] opacity-70">
                            {durationLabel(message.media_duration)}
                          </p>
                        )}
                    </div>
                  )}

                  <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-70">
                    {message.edited_at && !deleted && <span>edited</span>}

                    <span>{timeLabel(message.created_at)}</span>

                    {mine &&
                      !deleted &&
                      (seen ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : delivered ? (
                        <CheckCheck className="h-3 w-3 opacity-80" />
                      ) : (
                        <Check className="h-3 w-3" />
                      ))}
                  </div>
                </div>

                {counts.length > 0 && !deleted && (
                  <div
                    className={`-mt-2 flex flex-wrap gap-1 ${
                      mine ? "justify-end" : "justify-start"
                    }`}
                  >
                    {counts.map(([emoji, count]) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => void toggleReaction(message, emoji)}
                        className={`rounded-full border px-2 py-0.5 text-[11px] shadow-sm ${
                          hasReacted(message.id, emoji)
                            ? "border-primary bg-primary/20"
                            : "border-border bg-surface"
                        }`}
                      >
                        {emoji} {count}
                      </button>
                    ))}
                  </div>
                )}

                {!deleted && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <div className="relative">
                      <button
                        type="button"
                        className="rounded-full bg-background/80 px-2 py-1 text-[11px] shadow-sm hover:bg-background"
                        onClick={() =>
                          setReactionPicker(
                            pickerOpen ? null : message.id,
                          )
                        }
                      >
                        ❤️
                      </button>

                      {pickerOpen && (
                        <div
                          className={`absolute bottom-full z-30 mb-2 flex gap-1 rounded-2xl border border-border bg-surface p-2 shadow-xl ${
                            mine ? "right-0" : "left-0"
                          }`}
                        >
                          {REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className={`rounded-full p-1.5 text-lg transition hover:scale-125 ${
                                hasReacted(message.id, emoji)
                                  ? "bg-primary/20"
                                  : ""
                              }`}
                              onClick={() =>
                                void toggleReaction(message, emoji)
                              }
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="rounded-full bg-background/80 px-2 py-1 text-[11px] shadow-sm hover:bg-background"
                      onClick={() => startReply(message)}
                    >
                      <Reply className="mr-1 inline h-3 w-3" />
                      Reply
                    </button>

                    {mine && message.type === "text" && (
                      <button
                        type="button"
                        className="rounded-full bg-background/80 px-2 py-1 text-[11px] shadow-sm hover:bg-background"
                        onClick={() => {
                          setEditing(message);
                          setReplyTo(null);
                          setText(message.content ?? "");
                        }}
                      >
                        <Pencil className="mr-1 inline h-3 w-3" />
                        Edit
                      </button>
                    )}

                    <button
                      type="button"
                      className="rounded-full bg-background/80 px-2 py-1 text-[11px] text-destructive shadow-sm hover:bg-background"
                      onClick={(event) => openDeleteMenu(event, message)}
                    >
                      <Trash2 className="mr-1 inline h-3 w-3" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {sendingIds.map((sendingId) => (
          <div key={sendingId} className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl bg-primary/60 px-3 py-2 text-sm text-primary-foreground">
              <span className="inline-flex items-center gap-1 text-[11px] opacity-80">
                <Clock className="h-3 w-3" />
                Sending…
              </span>
            </div>
          </div>
        ))}

        {pending.map((item) => (
          <div key={item.id} className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl border border-dashed border-primary/50 bg-primary/20 px-3 py-2 text-sm">
              <p className="whitespace-pre-wrap break-words">
                {item.content}
              </p>

              <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
                {item.state === "failed" ? (
                  <>
                    <AlertCircle className="h-3 w-3" />
                    Failed
                    <button
                      type="button"
                      className="underline"
                      onClick={() => void flushOutbox()}
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        dequeue(item.id);
                        refreshOutbox();
                      }}
                    >
                      Discard
                    </button>
                  </>
                ) : (
                  <>
                    <Clock className="h-3 w-3" />
                    Waiting for connection
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
                style={{ animationDelay: "120ms" }}
              />
              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
                style={{ animationDelay: "240ms" }}
              />
            </span>

            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing…`
              : `${typingUsers.length} people are typing…`}
          </div>
        )}

        <div ref={bottom} />
      </div>

      {/* ======================================================
       * DELETE MENU
       * ====================================================== */}

      {deleteMenu && (
        <>
          <button
            type="button"
            aria-label="Close delete menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setDeleteMenu(null)}
          />

          <div
            className="fixed z-50 w-56 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            style={{ left: deleteMenu.x, top: deleteMenu.y }}
          >
            <div className="border-b border-border px-3 py-2">
              <p className="text-xs font-semibold">Delete message</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Choose how to delete it
              </p>
            </div>

            <button
              type="button"
              disabled={deletingId === deleteMenu.message.id}
              className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm hover:bg-muted disabled:opacity-50"
              onClick={() => void deleteForMe(deleteMenu.message)}
            >
              <Trash2 className="h-4 w-4" />
              <span>
                <span className="block font-medium">Delete for me</span>
                <span className="block text-[10px] text-muted-foreground">
                  Removes it only from your chat
                </span>
              </span>
            </button>

            {deleteMenu.message.sender_id === user?.id && (
              <button
                type="button"
                disabled={deletingId === deleteMenu.message.id}
                className="flex w-full items-center gap-3 border-t border-border px-3 py-3 text-left text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                onClick={() => void deleteForEveryone(deleteMenu.message)}
              >
                <Trash2 className="h-4 w-4" />
                <span>
                  <span className="block font-medium">
                    Delete for everyone
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    Removes the message for everyone
                  </span>
                </span>
              </button>
            )}
          </div>
        </>
      )}

      {/* ======================================================
       * COMPOSER
       * ====================================================== */}

      <form
        onSubmit={submit}
        className="sticky bottom-0 z-20 space-y-2 border-t border-border/60 bg-background/90 px-3 py-2.5 backdrop-blur safe-bottom"
      >
        {(replyTo || editing) && (
          <div className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {editing ? "Editing message" : "Replying to message"}
              </p>

              {!editing && replyTo && (
                <p className="truncate text-muted-foreground">
                  {(replyTo as any).deleted_at
                    ? "Deleted message"
                    : replyTo.type === ("sticker" as any)
                      ? getSticker(replyTo.content)?.emoji ?? "Sticker"
                      : replyTo.content || "Attachment"}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setReplyTo(null);
                setEditing(null);
                setText("");
              }}
              className="rounded-full p-1 hover:bg-background"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {recording && (
          <div className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
              <span className="text-sm font-medium">Recording</span>
              <span className="text-xs text-muted-foreground">
                {durationLabel(recSecs)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                onClick={cancelRecording}
              >
                <X className="mr-1 inline h-3.5 w-3.5" />
                Cancel
              </button>

              <button
                type="button"
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                onClick={stopRecordingAndSend}
              >
                <Send className="mr-1 inline h-3.5 w-3.5" />
                Send
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(event) => void onFile(event)}
          />

          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={!online || recording}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus className="h-5 w-5" />
          </Button>

          <div className="relative">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={!online || recording}
              title="Stickers"
              onClick={() => {
                setStickerPickerOpen((value) => !value);
                setReactionPicker(null);
              }}
            >
              <SmilePlus className="h-5 w-5" />
            </Button>

            {stickerPickerOpen && (
              <div className="absolute bottom-full left-0 z-50 mb-2 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <SmilePlus className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Stickers</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStickerPickerOpen(false)}
                    className="rounded-full p-1 hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
                  {STICKER_PACKS.map((pack) => (
                    <button
                      key={pack}
                      type="button"
                      onClick={() => setStickerPack(pack)}
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
                        stickerPack === pack
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {pack}
                    </button>
                  ))}
                </div>

                <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto p-3">
                  {visibleStickers.map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      title={sticker.label}
                      onClick={() => void sendSticker(sticker.id)}
                      className="flex aspect-square items-center justify-center rounded-xl text-4xl transition hover:scale-110 hover:bg-muted active:scale-95"
                    >
                      {sticker.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Input
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              broadcastTyping();
            }}
            placeholder={
              recording
                ? `Recording ${durationLabel(recSecs)}`
                : online
                  ? "Message"
                  : "Message (offline)"
            }
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
              disabled={!online && !recording}
              onClick={() => {
                if (recording) {
                  stopRecordingAndSend();
                } else {
                  void startRecording();
                }
              }}
            >
              {recording ? (
                <Square className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}