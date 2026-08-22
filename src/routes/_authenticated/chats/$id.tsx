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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  Clock,
  ImagePlus,
  Mic,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Reply,
  Send,
  SmilePlus,
  Sparkles,
  Square,
  Trash2,
  UserPlus,
  UserRound,
  Video as VideoIcon,
  X,
  Zap,
  Eye,
  EyeOff,
  Wand2,
  Palette,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/components/RealtimeProvider";
import { UserAvatar } from "@/components/UserAvatar";
import XupGames from "@/components/XupGames";
import ChatCustomizeSheet from "@/components/ChatCustomizeSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOnlineStatus } from "@/components/ConnectionBanner";
import {
  getChatCustomization,
  getChatWallpaperMedia,
  getTheme,
  getBuiltinWallpaper,
  type ChatCustomization,
} from "@/lib/chatCustomization";
import { getFontFamilyCss, loadGoogleFont } from "@/lib/chatFonts";

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
 * CHAT EFFECTS
 *
 * Effects are stored inside the existing message content.
 * This means no new Supabase table/column is required.
 * ============================================================ */

type ChatEffect =
  | "none"
  | "dramatic"
  | "bounce"
  | "shake"
  | "pop"
  | "neon"
  | "rainbow"
  | "zoom"
  | "from-top"
  | "from-right"
  | "from-left"
  | "from-bottom"
  | "explosion"
  | "spin";

type EffectOption = {
  id: ChatEffect;
  name: string;
  emoji: string;
  description: string;
};

const EFFECTS: EffectOption[] = [
  {
    id: "none",
    name: "Normal",
    emoji: "💬",
    description: "Normal message",
  },
  {
    id: "dramatic",
    name: "Dramatic",
    emoji: "💥",
    description: "Big dramatic entrance",
  },
  {
    id: "bounce",
    name: "Bounce",
    emoji: "🏀",
    description: "Bouncy entrance",
  },
  {
    id: "shake",
    name: "Shake",
    emoji: "📳",
    description: "Shakes when it appears",
  },
  {
    id: "pop",
    name: "Pop",
    emoji: "🎉",
    description: "Pops into the chat",
  },
  {
    id: "neon",
    name: "Neon",
    emoji: "✨",
    description: "Glowing neon effect",
  },
  {
    id: "rainbow",
    name: "Rainbow",
    emoji: "🌈",
    description: "Rainbow color effect",
  },
  {
    id: "zoom",
    name: "Zoom",
    emoji: "🔎",
    description: "Zooms into the chat",
  },
  {
    id: "from-top",
    name: "Drop In",
    emoji: "⬇️",
    description: "Drops from the top",
  },
  {
    id: "from-right",
    name: "Slide Right",
    emoji: "➡️",
    description: "Slides in from the right",
  },
  {
    id: "from-left",
    name: "Slide Left",
    emoji: "⬅️",
    description: "Slides in from the left",
  },
  {
    id: "from-bottom",
    name: "Rise Up",
    emoji: "⬆️",
    description: "Rises from the bottom",
  },
  {
    id: "explosion",
    name: "Explosion",
    emoji: "💣",
    description: "Explosive entrance",
  },
  {
    id: "spin",
    name: "Spin",
    emoji: "🌀",
    description: "Spins into the chat",
  },
];

/* ============================================================
 * SPECIAL MESSAGE FORMAT
 *
 * These markers allow the new features to use the existing
 * messages table without requiring new database columns.
 * ============================================================ */

const EFFECT_PREFIX = "__XUP_EFFECT__:";
const SECRET_PREFIX = "__XUP_SECRET__:";
const SECRET_SEPARATOR = "__XUP_SECRET_SEPARATOR__:";

function encodeSpecialMessage(
  text: string,
  effect: ChatEffect,
  secret: boolean,
) {
  let result = text;

  if (secret) {
    result = `${SECRET_PREFIX}${result}${SECRET_SEPARATOR}`;
  }

  if (effect !== "none") {
    result = `${EFFECT_PREFIX}${effect}:${result}`;
  }

  return result;
}

function decodeSpecialMessage(content: string | null | undefined): {
  text: string;
  effect: ChatEffect;
  secret: boolean;
} {
  if (!content) {
    return {
      text: "",
      effect: "none",
      secret: false,
    };
  }

  let value = content;
  let effect: ChatEffect = "none";
  let secret = false;

  if (value.startsWith(EFFECT_PREFIX)) {
    const rest = value.slice(EFFECT_PREFIX.length);
    const separator = rest.indexOf(":");

    if (separator !== -1) {
      const possibleEffect = rest.slice(0, separator) as ChatEffect;

      if (EFFECTS.some((item) => item.id === possibleEffect)) {
        effect = possibleEffect;
        value = rest.slice(separator + 1);
      }
    }
  }

  if (value.startsWith(SECRET_PREFIX)) {
    secret = true;
    value = value.slice(SECRET_PREFIX.length);

    const separatorIndex = value.indexOf(SECRET_SEPARATOR);

    if (separatorIndex !== -1) {
      value = value.slice(0, separatorIndex);
    }
  }

  return {
    text: value,
    effect,
    secret,
  };
}

/* ============================================================
 * EFFECT CLASS
 * ============================================================ */

function effectClass(effect: ChatEffect) {
  switch (effect) {
    case "dramatic":
      return "xup-effect-dramatic";

    case "bounce":
      return "xup-effect-bounce";

    case "shake":
      return "xup-effect-shake";

    case "pop":
      return "xup-effect-pop";

    case "neon":
      return "xup-effect-neon";

    case "rainbow":
      return "xup-effect-rainbow";

    case "zoom":
      return "xup-effect-zoom";

    case "from-top":
      return "xup-effect-from-top";

    case "from-right":
      return "xup-effect-from-right";

    case "from-left":
      return "xup-effect-from-left";

    case "from-bottom":
      return "xup-effect-from-bottom";

    case "explosion":
      return "xup-effect-explosion";

    case "spin":
      return "xup-effect-spin";

    case "none":
    default:
      return "";
  }
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
  const [swipingMessageId, setSwipingMessageId] = useState<string | null>(
    null,
  );

  /* ==========================================================
   * NEW FUN FEATURES
   * ========================================================== */

  const [plusOpen, setPlusOpen] = useState(false);
  const [effectsOpen, setEffectsOpen] = useState(false);
  const [selectedEffect, setSelectedEffect] =
    useState<ChatEffect>("none");
  const [secretMode, setSecretMode] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(
    new Set(),
  );
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "environment",
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraBusy, setCameraBusy] = useState(false);

  /* ==========================================================
   * CHAT MENU (three-dot) + CUSTOM CHAT NAME
   *
   * Customize name is LOCAL ONLY: it lives in the browser's
   * localStorage under a conversation-specific key, and is
   * never written to Supabase. It only changes what the
   * current device shows for this chat's header — the real
   * profile display_name (used for calls, notifications,
   * add-contact, etc.) is untouched.
   * ========================================================== */

  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [customName, setCustomName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");

  /* ==========================================================
   * CHAT CUSTOMIZATION (theme / font / wallpaper)
   *
   * Local-only, per-chat, stored in IndexedDB (see
   * src/lib/chatCustomization.ts). Never written to Supabase,
   * never affects other chats or other devices.
   * ========================================================== */

  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customization, setCustomization] =
    useState<ChatCustomization | null>(null);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  const [wallpaperType, setWallpaperType] = useState<
    "image" | "video" | null
  >(null);
  const [customizationVersion, setCustomizationVersion] = useState(0);

  const localChatNameKey = useMemo(
    () => `whatsxup-chat-name:${id}`,
    [id],
  );

  const recorder = useRef<MediaRecorder | null>(null);
  const recordingStream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelRecordingRef = useRef(false);
  const bottom = useRef<HTMLDivElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const cameraInput = useRef<HTMLInputElement | null>(null);

  const cameraVideo = useRef<HTMLVideoElement | null>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const cameraCanvas = useRef<HTMLCanvasElement | null>(null);

  const roomChannel = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const lastTypingSent = useRef(0);
  const typingTimeouts = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const touchStartX = useRef<Map<string, number>>(new Map());

  const messagesKey = useMemo(
    () => ["messages", id, limit] as const,
    [id, limit],
  );

  /* ==========================================================
   * LOAD CUSTOM CHAT NAME FROM LOCALSTORAGE
   *
   * Guarded with typeof window so this is safe if the route
   * is ever rendered in a non-browser environment.
   * ========================================================== */

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem(
        localChatNameKey,
      );

      setCustomName(
        stored && stored.trim() ? stored.trim() : null,
      );
    } catch {
      setCustomName(null);
    }
  }, [localChatNameKey]);

  /* ==========================================================
   * LOAD CHAT CUSTOMIZATION (theme / font) FROM INDEXEDDB
   * ========================================================== */

  useEffect(() => {
    let cancelled = false;

    getChatCustomization(id).then((result) => {
      if (cancelled) return;
      setCustomization(result);
      loadGoogleFont(result.fontId);
    });

    return () => {
      cancelled = true;
    };
  }, [id, customizationVersion]);

  /* ==========================================================
   * LOAD CUSTOM WALLPAPER MEDIA (image/video blob) FROM
   * INDEXEDDB WHEN THIS CHAT HAS ONE SELECTED
   * ========================================================== */

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadWallpaperMedia() {
      if (
        customization?.wallpaper.kind !== "custom-image" &&
        customization?.wallpaper.kind !== "custom-video"
      ) {
        setWallpaperUrl(null);
        setWallpaperType(null);
        return;
      }

      const media = await getChatWallpaperMedia(id);
      if (cancelled || !media) return;

      objectUrl = URL.createObjectURL(media.blob);
      setWallpaperUrl(objectUrl);
      setWallpaperType(media.mediaType);
    }

    void loadWallpaperMedia();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, customization?.wallpaper]);

  const activeTheme = getTheme(customization?.themeId);
  const activeFontFamily = getFontFamilyCss(customization?.fontId);

  const builtinWallpaperCss =
    customization?.wallpaper.kind === "builtin"
      ? getBuiltinWallpaper(customization.wallpaper.builtinId)?.css
      : null;

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

  // Only the header display for direct chats uses the local
  // nickname. `otherName` itself stays the real profile name
  // everywhere else (calls, add-contact, push previews, etc.).
  const displayedChatName = customName || otherName;

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
      counts.set(
        reaction.reaction,
        (counts.get(reaction.reaction) ?? 0) + 1,
      );
    }

    return Array.from(counts.entries());
  }

  function hasReacted(messageId: string, emoji: string) {
    return (
      reactionMap
        .get(messageId)
        ?.some(
          (reaction) =>
            reaction.user_id === user?.id &&
            reaction.reaction === emoji,
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
          reaction.user_id === user.id &&
          reaction.reaction === emoji,
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
        error instanceof Error
          ? error.message
          : "Could not update reaction.",
      );
    }
  }

  /* ==========================================================
   * MESSAGE CACHE
   * ========================================================== */

  const applyMessage = useCallback(
    (row: Message) => {
      qc.setQueryData<Message[]>(messagesKey, (prev = []) => {
        const without = prev.filter(
          (message) => message.id !== row.id,
        );

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

    ch.on(
      "broadcast",
      { event: "message_upsert" },
      ({ payload }) => {
        const row = payload?.message as Message | undefined;

        if (!row) return;

        applyMessage(row);
      },
    );

    ch.on(
      "broadcast",
      { event: "message_delete" },
      ({ payload }) => {
        const messageId = payload?.messageId as string | undefined;

        if (!messageId) return;

        qc.setQueryData<Message[]>(messagesKey, (prev = []) =>
          prev.filter((message) => message.id !== messageId),
        );
      },
    );

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
        void qc.invalidateQueries({
          queryKey: ["conv-members", id],
        });
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
      const p = payload as {
        userId: string;
        name: string;
      };

      if (p.userId === user.id) return;

      setTypingUsers((prev) =>
        prev.includes(p.name) ? prev : [...prev, p.name],
      );

      const oldTimer = typingTimeouts.current.get(p.userId);

      if (oldTimer) clearTimeout(oldTimer);

      const timer = setTimeout(() => {
        setTypingUsers((prev) =>
          prev.filter((name) => name !== p.name),
        );

        typingTimeouts.current.delete(p.userId);
      }, 3500);

      typingTimeouts.current.set(p.userId, timer);
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void qc.invalidateQueries({
          queryKey: ["messages", id],
        });
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
      .update({
        last_read_at: new Date().toISOString(),
      })
      .eq("conversation_id", id)
      .eq("user_id", user.id)
      .then(() =>
        qc.invalidateQueries({
          queryKey: ["chat-list"],
        }),
      );
  }, [messages.length, id, user, qc, online]);

  /* ==========================================================
   * AUTO SCROLL
   * ========================================================== */

  useEffect(() => {
    bottom.current?.scrollIntoView({
      behavior: "smooth",
    });
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

  const refreshOutbox = useCallback(
    () => setPending(outboxFor(id)),
    [id],
  );

  const flushOutbox = useCallback(async () => {
    if (!user || !navigator.onLine) return;

    for (const item of outboxFor(id)) {
      updateItem(item.id, {
        state: "sending",
      });

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

        void roomChannel.current?.send({
          type: "broadcast",
          event: "message_upsert",
          payload: {
            message: data,
          },
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
    const myName =
      meProfile?.display_name?.trim() || "Someone";

    void roomChannel.current?.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId: user.id,
        name: myName,
      },
    });
  }

  /* ==========================================================
   * PUSH
   * ========================================================== */

  async function pushNotify(preview: string) {
    try {
      const meProfile = user
        ? profileMap.get(user.id)
        : null;

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
   * ========================================================== */

  async function sendMessage(
    payload: Partial<Message>,
    preview: string,
  ) {
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
        prev.filter(
          (message) => message.id !== optimisticId,
        ),
      );

      toast.error(
        error?.message ?? "Could not send message",
      );

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

    void roomChannel.current?.send({
      type: "broadcast",
      event: "message_upsert",
      payload: {
        message: data,
      },
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
    setPlusOpen(false);

    await sendMessage(
      {
        type: "sticker" as any,
        content: sticker.id,
      },
      `${sticker.emoji} Sticker`,
    );
  }

  /* ==========================================================
   * SEND EFFECT MESSAGE
   * ========================================================== */

  async function sendEffectMessage() {
    const body = text.trim();

    if (!body || !user) {
      toast.error("Type a message first.");
      return;
    }

    const encoded = encodeSpecialMessage(
      body,
      selectedEffect,
      secretMode,
    );

    setText("");
    setEffectsOpen(false);
    setPlusOpen(false);

    const effectPreview =
      selectedEffect === "none"
        ? body
        : `${EFFECTS.find(
            (item) => item.id === selectedEffect,
          )?.emoji ?? "✨"} ${body}`;

    const ok = await sendMessage(
      {
        type: "text",
        content: encoded,
      },
      secretMode ? "🔐 Secret message" : effectPreview,
    );

    if (!ok) {
      setText(body);
      toast.error("Could not send the special message.");
    }

    setSelectedEffect("none");
    setSecretMode(false);
  }

  /* ==========================================================
   * TEXT MESSAGE
   * ========================================================== */

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const body = text.trim();

    if (!body || !user) return;

    if (selectedEffect !== "none" || secretMode) {
      await sendEffectMessage();
      return;
    }

    setText("");

    if (editing) {
      const target = editing;

      setEditing(null);

      const editedAt = new Date().toISOString();

      qc.setQueryData<Message[]>(messagesKey, (prev = []) =>
        prev.map((message) =>
          message.id === target.id
            ? {
                ...message,
                content: body,
                edited_at: editedAt,
              }
            : message,
        ),
      );

      const { data, error } = await supabase
        .from("messages")
        .update({
          content: body,
          edited_at: editedAt,
        })
        .eq("id", target.id)
        .select("*")
        .single();

      if (error) {
        toast.error(error.message);
      } else if (data) {
        void roomChannel.current?.send({
          type: "broadcast",
          event: "message_upsert",
          payload: {
            message: data,
          },
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

    const ok = await sendMessage(
      {
        type: "text",
        content: body,
      },
      body,
    );

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

  async function onFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (
      !file.type.startsWith("image/") &&
      !file.type.startsWith("video/")
    ) {
      toast.error(
        "Only images and videos are supported.",
      );

      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Files must be under 50 MB.");
      return;
    }

    const kind = file.type.startsWith("video")
      ? "video"
      : "image";

    try {
      const path = await uploadChatMedia(
        id,
        file,
        kind === "video" ? "mp4" : "jpg",
      );

      await sendMessage(
        {
          type: kind,
          media_url: path,
        },
        kind === "video"
          ? "🎬 Video"
          : "📷 Photo",
      );
    } catch (error) {
      toast.error(
        (error as Error).message,
      );
    }
  }

  /* ==========================================================
   * CAMERA FILE
   *
   * Uses the phone's native camera through the existing file
   * input. No new backend is required.
   * ========================================================== */

  async function onCameraFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please capture a photo.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Photo must be under 50 MB.");
      return;
    }

    try {
      setCameraBusy(true);

      const path = await uploadChatMedia(
        id,
        file,
        "jpg",
      );

      await sendMessage(
        {
          type: "image",
          media_url: path,
        },
        "📸 Camera photo",
      );
    } catch (error) {
      toast.error(
        (error as Error).message,
      );
    } finally {
      setCameraBusy(false);
    }
  }

  /* ==========================================================
   * OPEN CAMERA
   * ========================================================== */

  async function openCamera() {
    setPlusOpen(false);
    setCameraError(null);
    setCameraOpen(true);
    setCameraReady(false);

    await startCamera();
  }

  /* ==========================================================
   * START CAMERA
   * ========================================================== */

  async function startCamera() {
    try {
      setCameraError(null);

      cameraStream.current
        ?.getTracks()
        .forEach((track) => track.stop());

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacing,
            width: {
              ideal: 1280,
            },
            height: {
              ideal: 1280,
            },
          },
          audio: false,
        });

      cameraStream.current = stream;

      if (cameraVideo.current) {
        cameraVideo.current.srcObject = stream;
        await cameraVideo.current.play();
      }

      setCameraReady(true);
    } catch (error) {
      const name =
        error instanceof DOMException
          ? error.name
          : "";

      setCameraReady(false);

      setCameraError(
        name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser settings."
          : "Could not open the camera on this device.",
      );
    }
  }

  /* ==========================================================
   * SWITCH CAMERA
   * ========================================================== */

  async function switchCamera() {
    setCameraFacing((current) =>
      current === "environment"
        ? "user"
        : "environment",
    );
  }

  useEffect(() => {
    if (!cameraOpen) return;

    if (!cameraReady) return;

    void startCamera();
    // The camera is intentionally restarted when the user
    // changes between front and rear cameras.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraFacing]);

  /* ==========================================================
   * TAKE PHOTO
   * ========================================================== */

  async function takeCameraPhoto() {
    const video = cameraVideo.current;

    if (!video || !cameraStream.current) {
      toast.error("Camera is not ready.");
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 1280;

    const canvas =
      cameraCanvas.current ??
      document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      toast.error("Could not capture photo.");
      return;
    }

    context.drawImage(
      video,
      0,
      0,
      width,
      height,
    );

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          toast.error("Could not capture photo.");
          return;
        }

        try {
          setCameraBusy(true);

          const file = new File(
            [blob],
            `camera-${Date.now()}.jpg`,
            {
              type: "image/jpeg",
            },
          );

          const path =
            await uploadChatMedia(
              id,
              file,
              "jpg",
            );

          await sendMessage(
            {
              type: "image",
              media_url: path,
            },
            "📸 Camera photo",
          );

          closeCamera();
        } catch (error) {
          toast.error(
            (error as Error).message,
          );
        } finally {
          setCameraBusy(false);
        }
      },
      "image/jpeg",
      0.9,
    );
  }

  /* ==========================================================
   * CLOSE CAMERA
   * ========================================================== */

  function closeCamera() {
    cameraStream.current
      ?.getTracks()
      .forEach((track) => track.stop());

    cameraStream.current = null;

    if (cameraVideo.current) {
      cameraVideo.current.srcObject = null;
    }

    setCameraOpen(false);
    setCameraReady(false);
    setCameraError(null);
  }

  useEffect(() => {
    return () => {
      cameraStream.current
        ?.getTracks()
        .forEach((track) => track.stop());
    };
  }, []);

  /* ==========================================================
   * VOICE RECORDING
   * ========================================================== */

  async function startRecording() {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      const mediaRecorder =
        new MediaRecorder(stream);

      chunks.current = [];
      cancelRecordingRef.current = false;

      mediaRecorder.ondataavailable = (
        event,
      ) => {
        if (event.data.size > 0) {
          chunks.current.push(
            event.data,
          );
        }
      };

      mediaRecorder.onstop =
        async () => {
          stream
            .getTracks()
            .forEach((track) =>
              track.stop(),
            );

          recordingStream.current = null;

          const wasCancelled =
            cancelRecordingRef.current;

          const seconds = recSecs;

          setRecording(false);
          setRecSecs(0);
          recorder.current = null;

          if (wasCancelled) {
            chunks.current = [];
            return;
          }

          const blob = new Blob(
            chunks.current,
            {
              type: "audio/webm",
            },
          );

          chunks.current = [];

          if (!blob.size) return;

          try {
            const path =
              await uploadChatMedia(
                id,
                blob,
                "webm",
              );

            await sendMessage(
              {
                type: "audio",
                media_url: path,
                media_duration: seconds,
              },
              "🎙️ Voice note",
            );
          } catch (error) {
            toast.error(
              (error as Error).message,
            );
          }
        };

      mediaRecorder.start();

      recorder.current = mediaRecorder;
      recordingStream.current = stream;

      setRecSecs(0);
      setRecording(true);
    } catch (error) {
      const name =
        (error as DOMException)?.name;

      toast.error(
        name === "NotAllowedError"
          ? "Microphone permission denied. Enable it in your browser settings."
          : "Could not start recording.",
      );
    }
  }

  function stopRecordingAndSend() {
    cancelRecordingRef.current = false;

    if (
      recorder.current &&
      recorder.current.state !==
        "inactive"
    ) {
      recorder.current.stop();
    }
  }

  function cancelRecording() {
    cancelRecordingRef.current = true;
    chunks.current = [];

    if (
      recorder.current &&
      recorder.current.state !==
        "inactive"
    ) {
      recorder.current.stop();
    } else {
      recordingStream.current
        ?.getTracks()
        .forEach((track) =>
          track.stop(),
        );

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
      const { error } =
        await (supabase as any)
          .from("message_deletions")
          .upsert(
            {
              message_id: message.id,
              user_id: user.id,
            },
            {
              onConflict:
                "message_id,user_id",
            },
          );

      if (error) throw error;

      qc.setQueryData<Message[]>(
        messagesKey,
        (prev = []) =>
          prev.filter(
            (item) =>
              item.id !== message.id,
          ),
      );

      setDeleteMenu(null);

      toast.success(
        "Message deleted for you",
      );
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

  async function deleteForEveryone(
    message: Message,
  ) {
    if (
      !user ||
      message.sender_id !== user.id
    ) {
      toast.error(
        "You can only delete your own messages for everyone.",
      );

      return;
    }

    setDeletingId(message.id);

    const deletedAt =
      new Date().toISOString();

    try {
      const { data, error } =
        await (supabase as any)
          .from("messages")
          .update({
            deleted_at: deletedAt,
            content: null,
            media_url: null,
          })
          .eq("id", message.id)
          .eq("sender_id", user.id)
          .select("*")
          .single();

      if (error) throw error;

      if (data) {
        applyMessage(data as Message);

        void roomChannel.current?.send(
          {
            type: "broadcast",
            event: "message_upsert",
            payload: {
              message: data,
            },
          },
        );
      }

      setDeleteMenu(null);

      toast.success(
        "Message deleted for everyone",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete message for everyone.",
      );

      void qc.invalidateQueries({
        queryKey: ["messages", id],
      });
    } finally {
      setDeletingId(null);
    }
  }

  /* ==========================================================
   * DELETE MENU
   * ========================================================== */

  function openDeleteMenu(
    event: React.MouseEvent,
    message: Message,
  ) {
    event.stopPropagation();

    const rect = (
      event.currentTarget as HTMLElement
    ).getBoundingClientRect();

    setDeleteMenu({
      message,
      x: Math.min(
        rect.left,
        window.innerWidth - 240,
      ),
      y: Math.min(
        rect.bottom + 8,
        window.innerHeight - 150,
      ),
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
    setPlusOpen(false);
    setEffectsOpen(false);

    setTimeout(() => {
      document
        .querySelector(
          "input[placeholder='Message'], input[placeholder='Message (offline)']",
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 50);
  }

  /* ==========================================================
   * JUMP TO REPLIED MESSAGE
   * ========================================================== */

  function jumpToMessage(
    messageId: string,
  ) {
    const element =
      document.getElementById(
        `message-${messageId}`,
      );

    if (!element) {
      toast.info(
        "That message is not loaded. Load older messages to find it.",
      );

      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

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

  function handleTouchStart(
    event: React.TouchEvent,
    messageId: string,
  ) {
    touchStartX.current.set(
      messageId,
      event.touches[0]?.clientX ?? 0,
    );
  }

  function handleTouchEnd(
    event: React.TouchEvent,
    message: Message,
  ) {
    const start =
      touchStartX.current.get(
        message.id,
      );

    touchStartX.current.delete(
      message.id,
    );

    if (start == null) return;

    const end =
      event.changedTouches[0]
        ?.clientX ?? start;

    const distance = end - start;

    if (distance > 70) {
      setSwipingMessageId(
        message.id,
      );

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
      toast.error(
        "Could not identify this user.",
      );

      return;
    }

    const { error } =
      await supabase
        .from("contacts")
        .insert({
          owner_id: user.id,
          contact_id: otherUserId,
        });

    if (error) {
      if (error.code === "23505") {
        toast.info(
          "This person is already in your contacts.",
        );
      } else {
        toast.error(
          error.message,
        );
      }

      return;
    }

    toast.success(
      `${otherName} added to your contacts`,
    );

    void qc.invalidateQueries({
      queryKey: [
        "is-contact",
        otherUserId,
      ],
    });
  }

  /* ==========================================================
   * CALLS
   *
   * Calls intentionally keep using the real profile name
   * (otherName), not the local nickname, per spec.
   * ========================================================== */

  function callVoice() {
    if (!otherUserId) {
      toast.error(
        "Could not identify the person you're calling.",
      );

      return;
    }

    void startCall(
      {
        id: otherUserId,
        name: otherName,
        avatar: otherAvatar,
      },
      "voice",
    );
  }

  function callVideo() {
    if (!otherUserId) {
      toast.error(
        "Could not identify the person you're calling.",
      );

      return;
    }

    void startCall(
      {
        id: otherUserId,
        name: otherName,
        avatar: otherAvatar,
      },
      "video",
    );
  }

  /* ==========================================================
   * SECRET MESSAGE REVEAL
   * ========================================================== */

  function toggleSecret(
    messageId: string,
  ) {
    setRevealedSecrets((previous) => {
      const next = new Set(
        previous,
      );

      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }

      return next;
    });
  }

  /* ==========================================================
   * CLOSE EXTRA MENUS
   * ========================================================== */

  function closePlusMenus() {
    setPlusOpen(false);
    setStickerPickerOpen(false);
    setEffectsOpen(false);
  }

  const hasMore =
    messages.length >= limit;

  /* ==========================================================
   * CLOSE DELETE MENU + CHAT MENU ON SCROLL/RESIZE
   * ========================================================== */

  useEffect(() => {
    function closeMenu() {
      setDeleteMenu(null);
      setChatMenuOpen(false);
    }

    window.addEventListener(
      "scroll",
      closeMenu,
      true,
    );

    window.addEventListener(
      "resize",
      closeMenu,
    );

    return () => {
      window.removeEventListener(
        "scroll",
        closeMenu,
        true,
      );

      window.removeEventListener(
        "resize",
        closeMenu,
      );
    };
  }, []);

  /* ==========================================================
   * CHAT MENU ACTIONS
   * ========================================================== */

  function openCustomizeNameModal() {
    setChatMenuOpen(false);
    setNameInput(customName ?? otherName);
    setNameModalOpen(true);
  }

  function saveCustomChatName() {
    const trimmed = nameInput.trim().slice(0, 40);

    if (!trimmed) {
      toast.error("Name can't be empty.");
      return;
    }

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          localChatNameKey,
          trimmed,
        );
      }

      setCustomName(trimmed);
      setNameModalOpen(false);

      toast.success("Chat name changed on your device");
    } catch {
      toast.error(
        "Could not save the name on this device.",
      );
    }
  }

  function resetCustomChatName() {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(
          localChatNameKey,
        );
      }
    } catch {
      // Best effort — nothing else to do if storage is
      // unavailable (e.g. private browsing restrictions).
    }

    setCustomName(null);
    setNameModalOpen(false);

    toast.success("Original profile name restored");
  }

  function handleProfilePictureTap() {
    setChatMenuOpen(false);

    toast.info(
      "Profile pictures are controlled by the account owner.",
    );
  }

  /* ==========================================================
   * FILTERED STICKERS
   * ========================================================== */

  const visibleStickers = useMemo(() => {
    if (stickerPack === "All")
      return STICKERS;

    return STICKERS.filter(
      (sticker) =>
        sticker.pack === stickerPack,
    );
  }, [stickerPack]);

  /* ==========================================================
   * UI
   * ========================================================== */

  return (
    <div
      className="mx-auto flex min-h-screen w-full max-w-2xl flex-col app-gradient"
      style={{ fontFamily: activeFontFamily }}
    >
      {/* ======================================================
       * ANIMATION STYLES
       * ====================================================== */}

      <style>{`
  @keyframes xup-dramatic {
    0% {
      opacity: 0;
      transform: scale(.45) rotate(-7deg);
    }

    55% {
      opacity: 1;
      transform: scale(1.08) rotate(2deg);
    }

    75% {
      transform: scale(.97) rotate(-1deg);
    }

    100% {
      opacity: 1;
      transform: scale(1) rotate(0);
    }
  }

  @keyframes xup-bounce {
    0% {
      transform: translateY(22px) scale(.82);
      opacity: 0;
    }

    45% {
      transform: translateY(-8px) scale(1.04);
      opacity: 1;
    }

    70% {
      transform: translateY(3px) scale(.98);
    }

    100% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  @keyframes xup-shake {
    0%,
    100% {
      transform: translateX(0) rotate(0);
    }

    15% {
      transform: translateX(-7px) rotate(-1deg);
    }

    30% {
      transform: translateX(7px) rotate(1deg);
    }

    45% {
      transform: translateX(-5px) rotate(-1deg);
    }

    60% {
      transform: translateX(5px) rotate(1deg);
    }

    75% {
      transform: translateX(-2px);
    }
  }

  @keyframes xup-pop {
    0% {
      opacity: 0;
      transform: scale(.55);
    }

    65% {
      opacity: 1;
      transform: scale(1.12);
    }

    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes xup-neon {
    0%,
    100% {
      filter: drop-shadow(0 0 2px currentColor);
    }

    50% {
      filter:
        drop-shadow(0 0 5px currentColor)
        drop-shadow(0 0 12px currentColor);
    }
  }

  @keyframes xup-rainbow {
    0% {
      filter: hue-rotate(0deg);
    }

    25% {
      filter: hue-rotate(90deg);
    }

    50% {
      filter: hue-rotate(180deg);
    }

    75% {
      filter: hue-rotate(270deg);
    }

    100% {
      filter: hue-rotate(360deg);
    }
  }

  @keyframes xup-zoom {
    0% {
      opacity: 0;
      transform: scale(1.5);
    }

    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* ==========================================
   * NEW DIRECTIONAL EFFECTS
   * ========================================== */

  @keyframes xup-from-top {
    0% {
      opacity: 0;
      transform: translateY(-100vh) scale(.85);
    }

    60% {
      opacity: 1;
      transform: translateY(18px) scale(1.03);
    }

    78% {
      transform: translateY(-7px) scale(.99);
    }

    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes xup-from-right {
    0% {
      opacity: 0;
      transform: translateX(100vw) rotate(5deg);
    }

    65% {
      opacity: 1;
      transform: translateX(-14px) rotate(-1deg);
    }

    100% {
      opacity: 1;
      transform: translateX(0) rotate(0);
    }
  }

  @keyframes xup-from-left {
    0% {
      opacity: 0;
      transform: translateX(-100vw) rotate(-5deg);
    }

    65% {
      opacity: 1;
      transform: translateX(14px) rotate(1deg);
    }

    100% {
      opacity: 1;
      transform: translateX(0) rotate(0);
    }
  }

  @keyframes xup-from-bottom {
    0% {
      opacity: 0;
      transform: translateY(100vh) scale(.9);
    }

    60% {
      opacity: 1;
      transform: translateY(-16px) scale(1.03);
    }

    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes xup-explosion {
    0% {
      opacity: 0;
      transform: scale(.05) rotate(-20deg);
      filter: blur(8px);
    }

    35% {
      opacity: 1;
      transform: scale(1.35) rotate(8deg);
      filter: blur(0);
    }

    55% {
      transform: scale(.82) rotate(-3deg);
    }

    75% {
      transform: scale(1.08) rotate(1deg);
    }

    100% {
      opacity: 1;
      transform: scale(1) rotate(0);
      filter: blur(0);
    }
  }

  @keyframes xup-spin {
    0% {
      opacity: 0;
      transform: rotate(-180deg) scale(.3);
    }

    60% {
      opacity: 1;
      transform: rotate(20deg) scale(1.08);
    }

    100% {
      opacity: 1;
      transform: rotate(0) scale(1);
    }
  }

  .xup-effect-dramatic {
    animation: xup-dramatic 650ms cubic-bezier(.2,.8,.2,1);
    transform-origin: center;
  }

  .xup-effect-bounce {
    animation: xup-bounce 650ms cubic-bezier(.2,.8,.2,1);
  }

  .xup-effect-shake {
    animation: xup-shake 600ms ease-in-out;
  }

  .xup-effect-pop {
    animation: xup-pop 450ms cubic-bezier(.2,1.4,.4,1);
  }

  .xup-effect-neon {
    animation: xup-neon 1200ms ease-in-out infinite;
  }

  .xup-effect-rainbow {
    animation: xup-rainbow 1800ms linear infinite;
  }

  .xup-effect-zoom {
    animation: xup-zoom 550ms cubic-bezier(.2,.8,.2,1);
  }

  .xup-effect-from-top {
    animation: xup-from-top 750ms cubic-bezier(.2,.85,.2,1);
  }

  .xup-effect-from-right {
    animation: xup-from-right 650ms cubic-bezier(.2,.85,.2,1);
  }

  .xup-effect-from-left {
    animation: xup-from-left 650ms cubic-bezier(.2,.85,.2,1);
  }

  .xup-effect-from-bottom {
    animation: xup-from-bottom 700ms cubic-bezier(.2,.85,.2,1);
  }

  .xup-effect-explosion {
    animation: xup-explosion 750ms cubic-bezier(.2,.8,.2,1);
  }

  .xup-effect-spin {
    animation: xup-spin 700ms cubic-bezier(.2,.85,.2,1);
  }

  @media (prefers-reduced-motion: reduce) {
    .xup-effect-dramatic,
    .xup-effect-bounce,
    .xup-effect-shake,
    .xup-effect-pop,
    .xup-effect-neon,
    .xup-effect-rainbow,
    .xup-effect-zoom,
    .xup-effect-from-top,
    .xup-effect-from-right,
    .xup-effect-from-left,
    .xup-effect-from-bottom,
    .xup-effect-explosion,
    .xup-effect-spin {
      animation: none !important;
      filter: none !important;
      transform: none !important;
    }
  }
`}</style>

      {/* ======================================================
       * HEADER
       * ====================================================== */}

      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border/60 bg-background/85 px-2 py-2.5 backdrop-blur safe-top">
        <Button
          size="icon"
          variant="ghost"
          onClick={() =>
            void navigate({
              to: "/chats",
            })
          }
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
              <p className="truncate font-medium leading-tight">
                {title}
              </p>

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
              name={displayedChatName}
              size="sm"
              online={isOtherOnline}
            />

            <div className="min-w-0">
              <p className="truncate font-medium leading-tight">
                {displayedChatName}
              </p>

              <p className="truncate text-xs text-muted-foreground">
                {typingUsers.length
                  ? "typing…"
                  : directSubtitle}
              </p>
            </div>
          </div>
        )}

        {conv?.type === "direct" &&
          otherUserId && (
            <div className="flex items-center gap-0.5">
              {!isContact.data && (
                <Button
                  size="icon"
                  variant="ghost"
                  title={`Add ${otherName} to contacts`}
                  onClick={() =>
                    void addContact()
                  }
                >
                  <UserPlus className="h-5 w-5" />
                </Button>
              )}

              <Button
                size="icon"
                variant="ghost"
                onClick={callVoice}
              >
                <Phone className="h-5 w-5" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={callVideo}
              >
                <VideoIcon className="h-5 w-5" />
              </Button>

              {/* ==========================================
               * CHAT MENU (three-dot)
               * ========================================== */}

              <div className="relative">
                <Button
                  size="icon"
                  variant="ghost"
                  title="Chat options"
                  onClick={() =>
                    setChatMenuOpen(
                      (value) => !value,
                    )
                  }
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>

                {chatMenuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close chat menu"
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() =>
                        setChatMenuOpen(false)
                      }
                    />

                    <div className="fixed right-2 top-14 z-50 w-64 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                      <button
                        type="button"
                        onClick={
                          openCustomizeNameModal
                        }
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-muted"
                      >
                        <Pencil className="h-4 w-4 shrink-0" />

                        <span>
                          <span className="block font-medium">
                            Customize name
                          </span>

                          <span className="block text-[10px] text-muted-foreground">
                            Change how this chat appears
                            to you
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setChatMenuOpen(false);
                          setCustomizeOpen(true);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-muted"
                      >
                        <Palette className="h-4 w-4 shrink-0" />

                        <span>
                          <span className="block font-medium">
                            Customize chat
                          </span>

                          <span className="block text-[10px] text-muted-foreground">
                            Theme, font, and wallpaper
                            for this chat
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={
                          handleProfilePictureTap
                        }
                        className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left text-sm transition hover:bg-muted"
                      >
                        <UserRound className="h-4 w-4 shrink-0" />

                        <span>
                          <span className="block font-medium">
                            Profile picture
                          </span>

                          <span className="block text-[10px] text-muted-foreground">
                            Set by the account owner
                          </span>
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
      </header>

      {/* ======================================================
       * CUSTOMIZE NAME MODAL
       * ====================================================== */}

      {nameModalOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm safe-top safe-bottom">
          <button
            type="button"
            aria-label="Close customize name"
            className="fixed inset-0 cursor-default"
            onClick={() => setNameModalOpen(false)}
          />

          <div className="relative w-full max-w-sm rounded-3xl border border-border bg-background p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-bold">
                  Customize name
                </h3>

                <p className="mt-1 text-xs text-muted-foreground">
                  This changes the name only for you.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setNameModalOpen(false)
                }
                className="rounded-full p-1 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <Input
              value={nameInput}
              onChange={(event) =>
                setNameInput(
                  event.target.value.slice(0, 40),
                )
              }
              placeholder={otherName}
              maxLength={40}
              autoFocus
            />

            <p className="mt-1 text-right text-[10px] text-muted-foreground">
              {nameInput.length}/40
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={resetCustomChatName}
                className="rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-muted active:scale-95"
              >
                Reset
              </button>

              <button
                type="button"
                onClick={saveCustomChatName}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-95"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
       * MESSAGES
       * ====================================================== */}

      <div className="relative flex-1 space-y-2 px-3 py-4">
        {(wallpaperUrl ||
          builtinWallpaperCss ||
          activeTheme.messageAreaBackground) && (
          <div
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
            style={{
              background:
                builtinWallpaperCss ||
                activeTheme.messageAreaBackground ||
                undefined,
            }}
          >
            {wallpaperUrl && wallpaperType === "image" && (
              <img
                src={wallpaperUrl}
                alt=""
                className="h-full w-full object-cover opacity-70"
              />
            )}

            {wallpaperUrl && wallpaperType === "video" && (
              <video
                src={wallpaperUrl}
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover opacity-70"
              />
            )}
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center pb-2">
            <Button
              size="sm"
              variant="outline"
              disabled={fetchingMessages}
              onClick={() =>
                setLimit(
                  (current) =>
                    current + PAGE_SIZE,
                )
              }
            >
              {fetchingMessages
                ? "Loading…"
                : "Load older messages"}
            </Button>
          </div>
        )}

        {messages.map((message) => {
          const mine =
            message.sender_id ===
            user?.id;

          const sender =
            profileMap.get(
              message.sender_id,
            );

          const parent =
            message.reply_to
              ? messages.find(
                  (item) =>
                    item.id ===
                    message.reply_to,
                )
              : null;

          const seen =
            mine &&
            !!othersReadAt &&
            message.created_at <=
              othersReadAt;

          const delivered =
            mine &&
            (deliveryMap
              .get(message.id)
              ?.some(
                (delivery) =>
                  delivery.user_id !==
                  user?.id,
              ) ?? false);

          const counts =
            reactionCounts(
              message.id,
            );

          const pickerOpen =
            reactionPicker ===
            message.id;

          const deleted = !!(
            message as any
          ).deleted_at;

          const swiping =
            swipingMessageId ===
            message.id;

          const sticker =
            (message.type as string) ===
            "sticker"
              ? getSticker(
                  message.content,
                )
              : null;

          const decoded =
            message.type === "text"
              ? decodeSpecialMessage(
                  message.content,
                )
              : {
                  text:
                    message.content ??
                    "",
                  effect:
                    "none" as ChatEffect,
                  secret: false,
                };

          const secretRevealed =
            revealedSecrets.has(
              message.id,
            );

          const hasSpecialEffect =
            decoded.effect !==
            "none";

          return (
            <div
              id={`message-${message.id}`}
              key={message.id}
              className={`group flex ${
                mine
                  ? "justify-end"
                  : "justify-start"
              }`}
              onTouchStart={(event) =>
                handleTouchStart(
                  event,
                  message.id,
                )
              }
              onTouchEnd={(event) =>
                handleTouchEnd(
                  event,
                  message,
                )
              }
            >
              <div
                className={`relative max-w-[82%] transition-transform ${
                  swiping
                    ? "translate-x-3"
                    : ""
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
                        ? "text-primary-foreground"
                        : "bg-surface"
                  } ${
                    hasSpecialEffect &&
                    !sticker
                      ? effectClass(
                          decoded.effect,
                        )
                      : ""
                  } ${
                    mine && !sticker && !activeTheme.bubbleMine
                      ? "bg-primary"
                      : ""
                  }`}
                  style={
                    mine && !sticker && activeTheme.bubbleMine
                      ? { background: activeTheme.bubbleMine }
                      : undefined
                  }
                >
                  {conv?.type ===
                    "group" &&
                    !mine &&
                    !sticker && (
                      <p className="mb-1 text-[11px] font-semibold text-primary">
                        {sender?.display_name ||
                          "Unknown"}
                      </p>
                    )}

                  {parent && (
                    <button
                      type="button"
                      onClick={() =>
                        jumpToMessage(
                          parent.id,
                        )
                      }
                      className="mb-2 w-full rounded-lg border-l-2 border-current/40 bg-black/10 px-2 py-1 text-left text-[11px] opacity-80 transition hover:bg-black/20"
                    >
                      <span className="block font-semibold">
                        Reply
                      </span>

                      <span className="line-clamp-2">
                        {(parent as any)
                          .deleted_at
                          ? "Deleted message"
                          : parent.type ===
                              ("sticker" as any)
                            ? getSticker(
                                parent.content,
                              )?.emoji ??
                              "Sticker"
                            : decodeSpecialMessage(
                                parent.content,
                              ).text ||
                              "Attachment"}
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
                        title={
                          sticker.label
                        }
                      >
                        {sticker.emoji}
                      </span>
                    </div>
                  ) : message.type ===
                    "text" ? (
                    <div className="relative">
                      {decoded.secret &&
                      !secretRevealed ? (
                        <button
                          type="button"
                          onClick={() =>
                            toggleSecret(
                              message.id,
                            )
                          }
                          className="flex min-h-16 w-full min-w-[150px] items-center justify-center rounded-xl border border-white/20 bg-black/10 px-4 py-3 transition hover:bg-black/20 active:scale-[.98]"
                        >
                          <span className="flex items-center gap-2 font-medium">
                            <Eye className="h-4 w-4" />
                            Tap to reveal
                          </span>
                        </button>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">
                          {decoded.text}
                        </p>
                      )}

                      {decoded.secret &&
                        secretRevealed && (
                          <button
                            type="button"
                            onClick={() =>
                              toggleSecret(
                                message.id,
                              )
                            }
                            className="mt-2 flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100"
                          >
                            <EyeOff className="h-3 w-3" />
                            Hide secret
                          </button>
                        )}

                      {decoded.secret &&
                        !secretRevealed && (
                          <div className="mt-1 flex items-center gap-1 text-[9px] opacity-60">
                            🔐 Secret message
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {message.media_url && (
                        <MediaBubble
                          path={
                            message.media_url
                          }
                          type={
                            message.type as
                              | "image"
                              | "video"
                              | "audio"
                          }
                        />
                      )}

                      {message.type ===
                        "audio" &&
                        message.media_duration !=
                          null && (
                          <p className="text-[11px] opacity-70">
                            {durationLabel(
                              message.media_duration,
                            )}
                          </p>
                        )}
                    </div>
                  )}

                  <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-70">
                    {message.edited_at &&
                      !deleted && (
                        <span>
                          edited
                        </span>
                      )}

                    <span>
                      {timeLabel(
                        message.created_at,
                      )}
                    </span>

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

                {counts.length > 0 &&
                  !deleted && (
                    <div
                      className={`-mt-2 flex flex-wrap gap-1 ${
                        mine
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      {counts.map(
                        ([
                          emoji,
                          count,
                        ]) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() =>
                              void toggleReaction(
                                message,
                                emoji,
                              )
                            }
                            className={`rounded-full border px-2 py-0.5 text-[11px] shadow-sm ${
                              hasReacted(
                                message.id,
                                emoji,
                              )
                                ? "border-primary bg-primary/20"
                                : "border-border bg-surface"
                            }`}
                          >
                            {emoji}{" "}
                            {count}
                          </button>
                        ),
                      )}
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
                            pickerOpen
                              ? null
                              : message.id,
                          )
                        }
                      >
                        ❤️
                      </button>

                      {pickerOpen && (
                        <div
                          className={`absolute bottom-full z-30 mb-2 flex gap-1 rounded-2xl border border-border bg-surface p-2 shadow-xl ${
                            mine
                              ? "right-0"
                              : "left-0"
                          }`}
                        >
                          {REACTIONS.map(
                            (emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className={`rounded-full p-1.5 text-lg transition hover:scale-125 ${
                                  hasReacted(
                                    message.id,
                                    emoji,
                                  )
                                    ? "bg-primary/20"
                                    : ""
                                }`}
                                onClick={() =>
                                  void toggleReaction(
                                    message,
                                    emoji,
                                  )
                                }
                              >
                                {emoji}
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="rounded-full bg-background/80 px-2 py-1 text-[11px] shadow-sm hover:bg-background"
                      onClick={() =>
                        startReply(
                          message,
                        )
                      }
                    >
                      <Reply className="mr-1 inline h-3 w-3" />
                      Reply
                    </button>

                    {mine &&
                      message.type ===
                        "text" && (
                        <button
                          type="button"
                          className="rounded-full bg-background/80 px-2 py-1 text-[11px] shadow-sm hover:bg-background"
                          onClick={() => {
                            const decodedMessage =
                              decodeSpecialMessage(
                                message.content,
                              );

                            setEditing(
                              message,
                            );
                            setReplyTo(
                              null,
                            );
                            setSelectedEffect(
                              decodedMessage.effect,
                            );
                            setSecretMode(
                              decodedMessage.secret,
                            );
                            setText(
                              decodedMessage.text,
                            );
                          }}
                        >
                          <Pencil className="mr-1 inline h-3 w-3" />
                          Edit
                        </button>
                      )}

                    <button
                      type="button"
                      className="rounded-full bg-background/80 px-2 py-1 text-[11px] text-destructive shadow-sm hover:bg-background"
                      onClick={(
                        event,
                      ) =>
                        openDeleteMenu(
                          event,
                          message,
                        )
                      }
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

        {sendingIds.map(
          (sendingId) => (
            <div
              key={sendingId}
              className="flex justify-end"
            >
              <div className="max-w-[80%] rounded-2xl bg-primary/60 px-3 py-2 text-sm text-primary-foreground">
                <span className="inline-flex items-center gap-1 text-[11px] opacity-80">
                  <Clock className="h-3 w-3" />
                  Sending…
                </span>
              </div>
            </div>
          ),
        )}

        {pending.map((item) => (
          <div
            key={item.id}
            className="flex justify-end"
          >
            <div className="max-w-[80%] rounded-2xl border border-dashed border-primary/50 bg-primary/20 px-3 py-2 text-sm">
              <p className="whitespace-pre-wrap break-words">
                {decodeSpecialMessage(
                  item.content,
                ).text}
              </p>

              <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
                {item.state ===
                "failed" ? (
                  <>
                    <AlertCircle className="h-3 w-3" />
                    Failed

                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        void flushOutbox()
                      }
                    >
                      Retry
                    </button>

                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        dequeue(
                          item.id,
                        );

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

        {typingUsers.length >
          0 && (
          <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />

              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
                style={{
                  animationDelay:
                    "120ms",
                }}
              />

              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
                style={{
                  animationDelay:
                    "240ms",
                }}
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
            onClick={() =>
              setDeleteMenu(null)
            }
          />

          <div
            className="fixed z-50 w-56 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            style={{
              left: deleteMenu.x,
              top: deleteMenu.y,
            }}
          >
            <div className="border-b border-border px-3 py-2">
              <p className="text-xs font-semibold">
                Delete message
              </p>

              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Choose how to delete it
              </p>
            </div>

            <button
              type="button"
              disabled={
                deletingId ===
                deleteMenu.message.id
              }
              className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm hover:bg-muted disabled:opacity-50"
              onClick={() =>
                void deleteForMe(
                  deleteMenu.message,
                )
              }
            >
              <Trash2 className="h-4 w-4" />

              <span>
                <span className="block font-medium">
                  Delete for me
                </span>

                <span className="block text-[10px] text-muted-foreground">
                  Removes it only from your chat
                </span>
              </span>
            </button>

            {deleteMenu.message
              .sender_id ===
              user?.id && (
              <button
                type="button"
                disabled={
                  deletingId ===
                  deleteMenu.message.id
                }
                className="flex w-full items-center gap-3 border-t border-border px-3 py-3 text-left text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                onClick={() =>
                  void deleteForEveryone(
                    deleteMenu.message,
                  )
                }
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
       * CAMERA OVERLAY
       * ====================================================== */}

      {cameraOpen && (
        <div className="fixed inset-0 z-[130] flex flex-col bg-black">
          <div className="flex items-center justify-between px-4 py-3 safe-top">
            <button
              type="button"
              onClick={closeCamera}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
            >
              <X className="h-5 w-5" />
            </button>

            <span className="font-medium text-white">
              Camera
            </span>

            <button
              type="button"
              onClick={() =>
                void switchCamera()
              }
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
            >
              <Camera className="h-5 w-5" />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            <video
              ref={cameraVideo}
              playsInline
              muted
              className="h-full w-full object-cover"
            />

            <canvas
              ref={cameraCanvas}
              className="hidden"
            />

            {!cameraReady &&
              !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <div className="text-center">
                    <Camera className="mx-auto mb-3 h-10 w-10 animate-pulse" />
                    <p>Opening camera…</p>
                  </div>
                </div>
              )}

            {cameraError && (
              <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-2xl bg-black/70 p-5 text-center text-white backdrop-blur">
                <AlertCircle className="mx-auto mb-3 h-8 w-8" />

                <p className="text-sm">
                  {cameraError}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void startCamera()
                  }
                  className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center px-4 py-6 safe-bottom">
            <button
              type="button"
              disabled={
                !cameraReady ||
                cameraBusy
              }
              onClick={() =>
                void takeCameraPhoto()
              }
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 transition active:scale-90 disabled:opacity-40"
            >
              <span className="h-14 w-14 rounded-full bg-white" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================
       * COMPOSER
       * ====================================================== */}

      <form
        onSubmit={submit}
        className="sticky bottom-0 z-20 space-y-2 border-t border-border/60 bg-background/90 px-3 py-2.5 backdrop-blur safe-bottom"
      >
        {(replyTo ||
          editing) && (
          <div className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {editing
                  ? "Editing message"
                  : "Replying to message"}
              </p>

              {!editing &&
                replyTo && (
                  <p className="truncate text-muted-foreground">
                    {(replyTo as any)
                      .deleted_at
                      ? "Deleted message"
                      : replyTo.type ===
                          ("sticker" as any)
                        ? getSticker(
                            replyTo.content,
                          )?.emoji ??
                          "Sticker"
                        : decodeSpecialMessage(
                            replyTo.content,
                          ).text ||
                          "Attachment"}
                  </p>
                )}
            </div>

            <button
              type="button"
              onClick={() => {
                setReplyTo(null);
                setEditing(null);
                setText("");
                setSelectedEffect(
                  "none",
                );
                setSecretMode(false);
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

              <span className="text-sm font-medium">
                Recording
              </span>

              <span className="text-xs text-muted-foreground">
                {durationLabel(
                  recSecs,
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                onClick={
                  cancelRecording
                }
              >
                <X className="mr-1 inline h-3.5 w-3.5" />
                Cancel
              </button>

              <button
                type="button"
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                onClick={
                  stopRecordingAndSend
                }
              >
                <Send className="mr-1 inline h-3.5 w-3.5" />
                Send
              </button>
            </div>
          </div>
        )}

        {/* ====================================================
         * EFFECT PREVIEW
         * ==================================================== */}

        {(selectedEffect !==
          "none" ||
          secretMode) && (
          <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              {secretMode ? (
                <span className="text-lg">
                  🔐
                </span>
              ) : (
                <span className="text-lg">
                  {
                    EFFECTS.find(
                      (item) =>
                        item.id ===
                        selectedEffect,
                    )?.emoji
                  }
                </span>
              )}

              <div className="min-w-0">
                <p className="text-xs font-semibold">
                  {secretMode
                    ? "Secret message"
                    : `${
                        EFFECTS.find(
                          (item) =>
                            item.id ===
                            selectedEffect,
                        )?.name
                      } effect`}
                </p>

                <p className="truncate text-[10px] text-muted-foreground">
                  {secretMode
                    ? "The receiver taps to reveal it"
                    : "This animation will play when sent"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedEffect(
                  "none",
                );
                setSecretMode(false);
              }}
              className="rounded-full p-1 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(event) =>
              void onFile(event)
            }
          />

          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) =>
              void onCameraFile(event)
            }
          />

          {/* ==================================================
           * PLUS BUTTON
           * ================================================== */}

          <div className="relative">
            <Button
              type="button"
              size="icon"
              variant={
                plusOpen
                  ? "default"
                  : "ghost"
              }
              disabled={recording}
              title="More"
              onClick={() => {
                setPlusOpen(
                  (value) => !value,
                );

                setStickerPickerOpen(
                  false,
                );

                setEffectsOpen(
                  false,
                );
              }}
            >
              <Plus
                className={`h-5 w-5 transition-transform ${
                  plusOpen
                    ? "rotate-45"
                    : ""
                }`}
              />
            </Button>

            {plusOpen && (
              <div className="absolute bottom-full left-0 z-50 mb-2 w-[min(330px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-border bg-background p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div>
                    <p className="text-sm font-semibold">
                      WHATSXUP+
                    </p>

                    <p className="text-[10px] text-muted-foreground">
                      More ways to have fun in chat
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setPlusOpen(
                        false,
                      )
                    }
                    className="rounded-full p-1 hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* CAMERA */}
                  <button
                    type="button"
                    disabled={!online}
                    onClick={() =>
                      void openCamera()
                    }
                    className="flex flex-col items-center gap-1 rounded-2xl bg-muted/60 p-3 text-center transition hover:bg-muted active:scale-95 disabled:opacity-40"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Camera className="h-5 w-5" />
                    </span>

                    <span className="text-[11px] font-medium">
                      Camera
                    </span>
                  </button>

                  {/* GALLERY */}
                  <button
                    type="button"
                    disabled={!online}
                    onClick={() => {
                      setPlusOpen(
                        false,
                      );

                      fileInput.current?.click();
                    }}
                    className="flex flex-col items-center gap-1 rounded-2xl bg-muted/60 p-3 text-center transition hover:bg-muted active:scale-95 disabled:opacity-40"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <ImagePlus className="h-5 w-5" />
                    </span>

                    <span className="text-[11px] font-medium">
                      Gallery
                    </span>
                  </button>

                  {/* STICKERS */}
                  <button
                    type="button"
                    disabled={!online}
                    onClick={() => {
                      setPlusOpen(
                        false,
                      );

                      setStickerPickerOpen(
                        true,
                      );
                    }}
                    className="flex flex-col items-center gap-1 rounded-2xl bg-muted/60 p-3 text-center transition hover:bg-muted active:scale-95 disabled:opacity-40"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl">
                      😎
                    </span>

                    <span className="text-[11px] font-medium">
                      Stickers
                    </span>
                  </button>

                  {/* EFFECTS */}
                  <button
                    type="button"
                    onClick={() => {
                      setPlusOpen(
                        false,
                      );

                      setEffectsOpen(
                        true,
                      );
                    }}
                    className="flex flex-col items-center gap-1 rounded-2xl bg-muted/60 p-3 text-center transition hover:bg-muted active:scale-95"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </span>

                    <span className="text-[11px] font-medium">
                      Effects
                    </span>
                  </button>

                  {/* SECRET */}
                  <button
                    type="button"
                    onClick={() => {
                      setPlusOpen(
                        false,
                      );

                      setSecretMode(
                        (value) =>
                          !value,
                      );

                      setSelectedEffect(
                        "none",
                      );
                    }}
                    className={`flex flex-col items-center gap-1 rounded-2xl p-3 text-center transition active:scale-95 ${
                      secretMode
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 hover:bg-muted"
                    }`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/10 text-xl">
                      🔐
                    </span>

                    <span className="text-[11px] font-medium">
                      Secret
                    </span>
                  </button>

                  {/* GAMES */}
                  <button
                    type="button"
                    disabled={!online}
                    onClick={() => {
                      setPlusOpen(
                        false,
                      );

                      setGamesOpen(
                        true,
                      );
                    }}
                    className="flex flex-col items-center gap-1 rounded-2xl bg-muted/60 p-3 text-center transition hover:bg-muted active:scale-95 disabled:opacity-40"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-xl">
                      🎮
                    </span>

                    <span className="text-[11px] font-medium">
                      Games
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ==================================================
           * QUICK CAMERA
           * ================================================== */}

          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={!online || recording}
            title="Camera"
            onClick={() =>
              void openCamera()
            }
          >
            <Camera className="h-5 w-5" />
          </Button>

          {/* ==================================================
           * STICKER BUTTON
           * ================================================== */}

          <div className="relative">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={
                !online ||
                recording
              }
              title="Stickers"
              onClick={() => {
                setStickerPickerOpen(
                  (value) =>
                    !value,
                );

                setReactionPicker(
                  null,
                );

                setPlusOpen(false);
                setEffectsOpen(
                  false,
                );
              }}
            >
              <SmilePlus className="h-5 w-5" />
            </Button>

            {stickerPickerOpen && (
              <div className="absolute bottom-full left-0 z-50 mb-2 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <SmilePlus className="h-4 w-4 text-primary" />

                    <span className="text-sm font-semibold">
                      Stickers
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setStickerPickerOpen(
                        false,
                      )
                    }
                    className="rounded-full p-1 hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
                  {STICKER_PACKS.map(
                    (pack) => (
                      <button
                        key={pack}
                        type="button"
                        onClick={() =>
                          setStickerPack(
                            pack,
                          )
                        }
                        className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
                          stickerPack ===
                          pack
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {pack}
                      </button>
                    ),
                  )}
                </div>

                <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto p-3">
                  {visibleStickers.map(
                    (sticker) => (
                      <button
                        key={
                          sticker.id
                        }
                        type="button"
                        title={
                          sticker.label
                        }
                        onClick={() =>
                          void sendSticker(
                            sticker.id,
                          )
                        }
                        className="flex aspect-square items-center justify-center rounded-xl text-4xl transition hover:scale-110 hover:bg-muted active:scale-95"
                      >
                        {sticker.emoji}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ==================================================
           * INPUT
           * ================================================== */}

          <Input
            value={text}
            onChange={(event) => {
              setText(
                event.target.value,
              );

              broadcastTyping();
            }}
            placeholder={
              recording
                ? `Recording ${durationLabel(
                    recSecs,
                  )}`
                : online
                  ? "Message"
                  : "Message (offline)"
            }
            disabled={recording}
          />

          {text.trim() ? (
            <Button
              type="submit"
              size="icon"
              title={
                selectedEffect !==
                  "none" ||
                secretMode
                  ? "Send special message"
                  : "Send"
              }
            >
              {selectedEffect !==
                "none" ||
              secretMode ? (
                <Sparkles className="h-5 w-5" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              variant={
                recording
                  ? "destructive"
                  : "default"
              }
              disabled={
                !online &&
                !recording
              }
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

        {/* ====================================================
         * EFFECT PICKER
         * ==================================================== */}

        {effectsOpen && (
          <div className="rounded-2xl border border-border bg-background p-3 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Choose message animation
                </p>

                <p className="text-[10px] text-muted-foreground">
                  Pick the animation before sending your message.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setEffectsOpen(
                    false,
                  )
                }
                className="rounded-full p-1 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {EFFECTS.map(
                (effect) => {
                  const active =
                    selectedEffect ===
                    effect.id;

                  return (
                    <button
                      key={
                        effect.id
                      }
                      type="button"
                      onClick={() => {
                        setSelectedEffect(
                          effect.id,
                        );

                        setSecretMode(
                          false,
                        );
                      }}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[.98] ${
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border bg-muted/30 hover:bg-muted"
                      }`}
                    >
                      <span className="text-2xl">
                        {
                          effect.emoji
                        }
                      </span>

                      <span className="min-w-0">
                        <span className="block text-xs font-semibold">
                          {
                            effect.name
                          }
                        </span>

                        <span className="block truncate text-[10px] text-muted-foreground">
                          {
                            effect.description
                          }
                        </span>
                      </span>
                    </button>
                  );
                },
              )}
            </div>

            {selectedEffect !==
              "none" && (
              <div className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-[11px] text-primary">
                ✨{" "}
                {
                  EFFECTS.find(
                    (effect) =>
                      effect.id ===
                      selectedEffect,
                  )?.name
                }{" "}
                is selected. Type your message and tap send.
              </div>
            )}
          </div>
        )}
      </form>

      {/* ======================================================
       * XUP GAMES OVERLAY
       * ====================================================== */}

      {gamesOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-background p-4 shadow-2xl">
            <button
              type="button"
              aria-label="Close XUP Games"
              onClick={() =>
                setGamesOpen(false)
              }
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/80 active:scale-90"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pr-8">
              <XupGames
                onClose={() =>
                  setGamesOpen(false)
                }
                conversationId={
                  id
                }
                userId={
                  user?.id ?? ""
                }
                peerId={
                  otherUserId
                }
                peerName={
                  otherName
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
       * CHAT CUSTOMIZATION SHEET (theme / font / wallpaper)
       * ====================================================== */}

      <ChatCustomizeSheet
        chatId={id}
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        onChanged={() =>
          setCustomizationVersion((value) => value + 1)
        }
      />
    </div>
  );
}
