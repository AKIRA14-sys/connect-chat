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

type MessageDeletion = {
  message_id: string;
  user_id: string;
  deleted_at: string;
};

export const Route = createFileRoute(
  "/_authenticated/chats/$id",
)({
  head: () => ({
    meta: [
      {
        title: "Conversation — WHATSXUP",
      },
      {
        name: "description",
        content:
          "A private real-time WHATSXUP conversation with text, media, voice notes and calls.",
      },
    ],
  }),
  component: ChatRoom,
});

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

  return (
    <audio
      src={url}
      controls
      preload="none"
      className="w-56"
    />
  );
}

function ChatRoom() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { onlineIds, startCall } = useRealtime();

  const qc = useQueryClient();
  const navigate = useNavigate();
  const online = useOnlineStatus();

  const [text, setText] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const [replyTo, setReplyTo] =
    useState<Message | null>(null);

  const [editing, setEditing] =
    useState<Message | null>(null);

  const [typingUsers, setTypingUsers] =
    useState<string[]>([]);

  const [recording, setRecording] =
    useState(false);

  const [recSecs, setRecSecs] =
    useState(0);

  const [pending, setPending] =
    useState<OutboxItem[]>([]);

  const [sendingIds, setSendingIds] =
    useState<string[]>([]);

  const [reactionPicker, setReactionPicker] =
    useState<string | null>(null);

  const [highlightedMessage, setHighlightedMessage] =
    useState<string | null>(null);

  const [swipeReplyId, setSwipeReplyId] =
    useState<string | null>(null);

  const [deletingMessageId, setDeletingMessageId] =
    useState<string | null>(null);

  const [deletingForEveryoneId, setDeletingForEveryoneId] =
    useState<string | null>(null);

  const recorder =
    useRef<MediaRecorder | null>(null);

  const recordingStream =
    useRef<MediaStream | null>(null);

  const chunks =
    useRef<Blob[]>([]);

  const cancelRecordingRef =
    useRef(false);

  const bottom =
    useRef<HTMLDivElement | null>(null);

  const fileInput =
    useRef<HTMLInputElement | null>(null);

  const roomChannel =
    useRef<
      ReturnType<typeof supabase.channel> | null
    >(null);

  const lastTypingSent =
    useRef(0);

  const typingTimeouts =
    useRef<Map<string, ReturnType<typeof setTimeout>>>(
      new Map(),
    );

  const swipeStartX =
    useRef<number | null>(null);

  const swipeCurrentX =
    useRef<number | null>(null);

  const messagesKey = useMemo(
    () =>
      ["messages", id, limit] as const,
    [id, limit],
  );

  /*
   * ---------------------------------------------------------
   * CONVERSATION
   * ---------------------------------------------------------
   */

  const { data: conv } = useQuery({
    queryKey: ["conversation", id],

    queryFn: async () => {
      const { data, error } =
        await supabase
          .from("conversations")
          .select("*")
          .eq("id", id)
          .single();

      if (error) throw error;

      return data as Conversation;
    },
  });

  /*
   * ---------------------------------------------------------
   * MEMBERS
   * ---------------------------------------------------------
   */

  const { data: members = [] } =
    useQuery({
      queryKey: ["conv-members", id],

      queryFn: async () => {
        const { data, error } =
          await supabase
            .from("conversation_members")
            .select("user_id, role")
            .eq("conversation_id", id);

        if (error) throw error;

        return (data ?? []) as {
          user_id: string;
          role: string;
        }[];
      },
    });

  const otherMember = useMemo(() => {
    if (!user?.id) return null;

    return (
      members.find(
        (member) =>
          member.user_id !== user.id,
      ) ?? null
    );
  }, [members, user?.id]);

  /*
   * ---------------------------------------------------------
   * OTHER PROFILE
   * ---------------------------------------------------------
   */

  const {
    data: otherProfile,
    isLoading: loadingProfile,
  } = useQuery({
    queryKey: [
      "chat-profile",
      otherMember?.user_id,
    ],

    enabled:
      !!otherMember?.user_id,

    queryFn: async () => {
      if (!otherMember?.user_id) {
        return null;
      }

      const { data, error } =
        await supabase
          .from("profiles")
          .select("*")
          .eq(
            "id",
            otherMember.user_id,
          )
          .maybeSingle();

      if (error) throw error;

      return (data ?? null) as Profile | null;
    },
  });

  const otherUserId =
    otherMember?.user_id ?? null;

  const otherName =
    otherProfile?.display_name?.trim() ||
    "Unknown";

  const otherAvatar =
    otherProfile?.avatar_url ?? null;

  const canShowOnline =
    otherProfile?.show_online_status !== false;

  const isOtherOnline =
    !!otherUserId &&
    onlineIds.has(otherUserId) &&
    canShowOnline;

  const directSubtitle =
    loadingProfile
      ? "Loading…"
      : isOtherOnline
        ? "online"
        : canShowOnline
          ? lastSeenLabel(
              otherProfile?.last_seen ??
                null,
            )
          : "offline";

  const title =
    conv?.type === "group"
      ? conv.name?.trim() ||
        "Group"
      : otherName;

  /*
   * ---------------------------------------------------------
   * MESSAGES
   * ---------------------------------------------------------
   */

  const {
    data: messages = [],
    isFetching: fetchingMessages,
  } = useQuery({
    queryKey: messagesKey,

    queryFn: async () => {
      const { data, error } =
        await supabase
          .from("messages")
          .select("*")
          .eq(
            "conversation_id",
            id,
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(limit);

      if (error) throw error;

      return ((data ?? []) as Message[])
        .slice()
        .reverse();
    },
  });

  /*
   * ---------------------------------------------------------
   * PROFILES
   * ---------------------------------------------------------
   */

  const memberIds = useMemo(
    () =>
      members.map(
        (member) =>
          member.user_id,
      ),
    [members],
  );

  const { data: profiles = [] } =
    useQuery({
      queryKey: [
        "conversation-profiles",
        id,
        memberIds.join(","),
      ],

      enabled:
        memberIds.length > 0,

      queryFn: async () => {
        if (!memberIds.length) {
          return [];
        }

        const { data, error } =
          await supabase
            .from("profiles")
            .select("*")
            .in("id", memberIds);

        if (error) throw error;

        return (data ??
          []) as Profile[];
      },
    });

  const profileMap = useMemo(() => {
    const map =
      new Map<string, Profile>();

    for (const profile of profiles) {
      map.set(
        profile.id,
        profile,
      );
    }

    return map;
  }, [profiles]);

  /*
   * ---------------------------------------------------------
   * READ RECEIPTS
   * ---------------------------------------------------------
   */

  const readsQuery =
    useQuery({
      queryKey: ["reads", id],

      queryFn: async () => {
        const { data } =
          await supabase
            .from(
              "conversation_members",
            )
            .select(
              "user_id, last_read_at",
            )
            .eq(
              "conversation_id",
              id,
            );

        return data ?? [];
      },
    });

  const othersReadAt =
    useMemo(() => {
      const rows =
        (
          readsQuery.data ?? []
        ).filter(
          (row) =>
            row.user_id !==
            user?.id,
        );

      if (!rows.length) {
        return null;
      }

      return (
        rows
          .map(
            (row) =>
              row.last_read_at,
          )
          .sort()
          .at(-1) ?? null
      );
    }, [
      readsQuery.data,
      user?.id,
    ]);

  /*
   * ---------------------------------------------------------
   * CONTACT
   * ---------------------------------------------------------
   */

  const isContact =
    useQuery({
      queryKey: [
        "is-contact",
        otherUserId,
      ],

      enabled:
        !!otherUserId &&
        !!user?.id,

      queryFn: async () => {
        const { data, error } =
          await supabase
            .from("contacts")
            .select("id")
            .eq(
              "owner_id",
              user!.id,
            )
            .eq(
              "contact_id",
              otherUserId!,
            )
            .maybeSingle();

        if (error) {
          return false;
        }

        return !!data;
      },
    });

  /*
   * ---------------------------------------------------------
   * MESSAGE REACTIONS
   * ---------------------------------------------------------
   */

  const reactionsTable =
    (supabase as any).from(
      "message_reactions",
    );

  const {
    data: reactions = [],
  } = useQuery({
    queryKey: [
      "message-reactions",
      id,
    ],

    enabled:
      messages.length > 0,

    queryFn: async (): Promise<
      MessageReaction[]
    > => {
      const messageIds =
        messages.map(
          (message) =>
            message.id,
        );

      if (!messageIds.length) {
        return [];
      }

      const {
        data,
        error,
      } =
        await reactionsTable
          .select("*")
          .in(
            "message_id",
            messageIds,
          );

      if (error) throw error;

      return (data ??
        []) as MessageReaction[];
    },
  });

  const reactionMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          MessageReaction[]
        >();

      for (const reaction of reactions) {
        const current =
          map.get(
            reaction.message_id,
          ) ?? [];

        current.push(reaction);

        map.set(
          reaction.message_id,
          current,
        );
      }

      return map;
    }, [reactions]);

  function reactionCounts(
    messageId: string,
  ) {
    const list =
      reactionMap.get(
        messageId,
      ) ?? [];

    const counts =
      new Map<string, number>();

    for (const reaction of list) {
      counts.set(
        reaction.reaction,
        (counts.get(
          reaction.reaction,
        ) ?? 0) + 1,
      );
    }

    return Array.from(
      counts.entries(),
    );
  }

  function hasReacted(
    messageId: string,
    emoji: string,
  ) {
    return (
      reactionMap
        .get(messageId)
        ?.some(
          (reaction) =>
            reaction.user_id ===
              user?.id &&
            reaction.reaction ===
              emoji,
        ) ?? false
    );
  }

  async function toggleReaction(
    message: Message,
    emoji: string,
  ) {
    if (!user) return;

    setReactionPicker(null);

    const existing =
      reactionMap
        .get(message.id)
        ?.find(
          (reaction) =>
            reaction.user_id ===
              user.id &&
            reaction.reaction ===
              emoji,
        );

    try {
      if (existing) {
        const { error } =
          await reactionsTable
            .delete()
            .eq(
              "id",
              existing.id,
            )
            .eq(
              "user_id",
              user.id,
            );

        if (error) throw error;
      } else {
        const { error } =
          await reactionsTable
            .insert({
              message_id:
                message.id,
              user_id:
                user.id,
              reaction: emoji,
            });

        if (error) throw error;
      }

      await qc.invalidateQueries({
        queryKey: [
          "message-reactions",
          id,
        ],
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update reaction.",
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * DELETE-FOR-ME RECORDS
   * ---------------------------------------------------------
   */

  const {
    data: myDeletions = [],
  } = useQuery({
    queryKey: [
      "message-deletions",
      id,
      user?.id,
    ],

    enabled:
      !!user?.id,

    queryFn: async (): Promise<
      MessageDeletion[]
    > => {
      const { data, error } =
        await (supabase as any)
          .from(
            "message_deletions",
          )
          .select("*")
          .eq(
            "user_id",
            user!.id,
          );

      if (error) throw error;

      return (data ??
        []) as MessageDeletion[];
    },
  });

  const deletedForMe =
    useMemo(
      () =>
        new Set(
          myDeletions.map(
            (item) =>
              item.message_id,
          ),
        ),
      [myDeletions],
    );

  /*
   * ---------------------------------------------------------
   * MESSAGE CACHE
   * ---------------------------------------------------------
   */

  const applyMessage =
    useCallback(
      (row: Message) => {
        qc.setQueryData<
          Message[]
        >(
          messagesKey,
          (prev = []) => {
            const without =
              prev.filter(
                (message) =>
                  message.id !==
                  row.id,
              );

            return [
              ...without,
              row,
            ].sort((a, b) =>
              a.created_at.localeCompare(
                b.created_at,
              ),
            );
          },
        );

        void qc.invalidateQueries({
          queryKey: [
            "chat-list",
          ],
        });
      },
      [qc, messagesKey],
    );

  /*
   * ---------------------------------------------------------
   * REALTIME
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!user) return;

    const ch =
      supabase.channel(
        `room:${id}`,
        {
          config: {
            broadcast: {
              self: false,
            },
          },
        },
      );

    ch.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
        filter:
          `conversation_id=eq.${id}`,
      },
      (payload) => {
        const row =
          (payload.new ??
            payload.old) as
            | Message
            | undefined;

        if (!row) return;

        if (
          payload.eventType ===
          "DELETE"
        ) {
          qc.setQueryData<
            Message[]
          >(
            messagesKey,
            (prev = []) =>
              prev.filter(
                (message) =>
                  message.id !==
                  row.id,
              ),
          );

          void qc.invalidateQueries({
            queryKey: [
              "chat-list",
            ],
          });

          return;
        }

        applyMessage(row);
      },
    );

    ch.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table:
          "conversation_members",
        filter:
          `conversation_id=eq.${id}`,
      },
      () => {
        void qc.invalidateQueries({
          queryKey: [
            "reads",
            id,
          ],
        });

        void qc.invalidateQueries({
          queryKey: [
            "conv-members",
            id,
          ],
        });
      },
    );

    ch.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table:
          "message_reactions",
      },
      () => {
        void qc.invalidateQueries({
          queryKey: [
            "message-reactions",
            id,
          ],
        });
      },
    );

    ch.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table:
          "message_deletions",
      },
      () => {
        void qc.invalidateQueries({
          queryKey: [
            "message-deletions",
            id,
            user.id,
          ],
        });
      },
    );

    ch.on(
      "broadcast",
      {
        event: "typing",
      },
      ({ payload }) => {
        const p =
          payload as {
            userId: string;
            name: string;
          };

        if (
          p.userId ===
          user.id
        ) {
          return;
        }

        setTypingUsers(
          (prev) =>
            prev.includes(
              p.name,
            )
              ? prev
              : [
                  ...prev,
                  p.name,
                ],
        );

        const oldTimer =
          typingTimeouts.current.get(
            p.userId,
          );

        if (oldTimer) {
          clearTimeout(
            oldTimer,
          );
        }

        const timer =
          setTimeout(() => {
            setTypingUsers(
              (prev) =>
                prev.filter(
                  (name) =>
                    name !==
                    p.name,
                ),
            );

            typingTimeouts.current.delete(
              p.userId,
            );
          }, 3500);

        typingTimeouts.current.set(
          p.userId,
          timer,
        );
      },
    );

    ch.subscribe(
      (status) => {
        if (
          status ===
          "SUBSCRIBED"
        ) {
          void qc.invalidateQueries({
            queryKey: [
              "messages",
              id,
            ],
          });
        }
      },
    );

    roomChannel.current =
      ch;

    return () => {
      for (const timer of typingTimeouts.current.values()) {
        clearTimeout(timer);
      }

      typingTimeouts.current.clear();

      roomChannel.current =
        null;

      void supabase.removeChannel(
        ch,
      );
    };
  }, [
    id,
    user,
    qc,
    applyMessage,
    messagesKey,
  ]);

  /*
   * ---------------------------------------------------------
   * MARK READ
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (
      !user ||
      !messages.length ||
      !online
    ) {
      return;
    }

    void supabase
      .from(
        "conversation_members",
      )
      .update({
        last_read_at:
          new Date().toISOString(),
      })
      .eq(
        "conversation_id",
        id,
      )
      .eq(
        "user_id",
        user.id,
      )
      .then(() =>
        qc.invalidateQueries({
          queryKey: [
            "chat-list",
          ],
        }),
      );
  }, [
    messages.length,
    id,
    user,
    qc,
    online,
  ]);

  /*
   * ---------------------------------------------------------
   * SCROLL
   * ---------------------------------------------------------
   */

  useEffect(() => {
    bottom.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [
    messages.length,
    typingUsers.length,
    pending.length,
  ]);

  /*
   * ---------------------------------------------------------
   * RECORDING TIMER
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!recording) return;

    const timer =
      setInterval(() => {
        setRecSecs(
          (seconds) =>
            seconds + 1,
        );
      }, 1000);

    return () =>
      clearInterval(timer);
  }, [recording]);

  /*
   * ---------------------------------------------------------
   * OUTBOX
   * ---------------------------------------------------------
   */

  const refreshOutbox =
    useCallback(
      () =>
        setPending(
          outboxFor(id),
        ),
      [id],
    );

  const flushOutbox =
    useCallback(
      async () => {
        if (
          !user ||
          !navigator.onLine
        ) {
          return;
        }

        for (const item of outboxFor(
          id,
        )) {
          updateItem(
            item.id,
            {
              state:
                "sending",
            },
          );

          const {
            data,
            error,
          } =
            await supabase
              .from(
                "messages",
              )
              .insert({
                conversation_id:
                  item.conversationId,
                sender_id:
                  user.id,
                type: "text",
                content:
                  item.content,
                reply_to:
                  item.replyTo,
              })
              .select("*")
              .single();

          if (error) {
            updateItem(
              item.id,
              {
                state:
                  "failed",
                error:
                  error.message,
              },
            );
          } else {
            dequeue(
              item.id,
            );

            applyMessage(
              data as Message,
            );
          }
        }

        refreshOutbox();
      },
      [
        id,
        user,
        applyMessage,
        refreshOutbox,
      ],
    );

  useEffect(() => {
    refreshOutbox();

    const onChange =
      () =>
        refreshOutbox();

    const onOnline =
      () =>
        void flushOutbox();

    window.addEventListener(
      "whatsxup:outbox",
      onChange,
    );

    window.addEventListener(
      "online",
      onOnline,
    );

    void flushOutbox();

    return () => {
      window.removeEventListener(
        "whatsxup:outbox",
        onChange,
      );

      window.removeEventListener(
        "online",
        onOnline,
      );
    };
  }, [
    refreshOutbox,
    flushOutbox,
  ]);

  /*
   * ---------------------------------------------------------
   * TYPING
   * ---------------------------------------------------------
   */

  function broadcastTyping() {
    if (!user) return;

    const now =
      Date.now();

    if (
      now -
        lastTypingSent.current <
      1500
    ) {
      return;
    }

    lastTypingSent.current =
      now;

    const meProfile =
      profileMap.get(
        user.id,
      );

    const myName =
      meProfile?.display_name?.trim() ||
      "Someone";

    void roomChannel.current?.send(
      {
        type: "broadcast",
        event: "typing",
        payload: {
          userId:
            user.id,
          name:
            myName,
        },
      },
    );
  }

  /*
   * ---------------------------------------------------------
   * PUSH
   * ---------------------------------------------------------
   */

  async function pushNotify(
    preview: string,
  ) {
    try {
      const meProfile =
        user
          ? profileMap.get(
              user.id,
            )
          : null;

      await notifyNewMessage({
        data: {
          conversationId:
            id,
          title:
            conv?.type ===
            "group"
              ? conv.name ??
                "WHATSXUP group"
              : meProfile?.display_name ??
                "WHATSXUP",
          preview:
            conv?.type ===
            "group"
              ? `${meProfile?.display_name ?? "Someone"}: ${preview}`.slice(
                  0,
                  160,
                )
              : preview.slice(
                  0,
                  160,
                ),
        },
      });
    } catch {
      // Best effort.
    }
  }

  /*
   * ---------------------------------------------------------
   * SEND MESSAGE
   * ---------------------------------------------------------
   */

  async function sendMessage(
    payload: Partial<Message>,
    preview: string,
  ) {
    if (!user) return false;

    const optimisticId =
      crypto.randomUUID();

    setSendingIds(
      (prev) => [
        ...prev,
        optimisticId,
      ],
    );

    const replyId =
      replyTo?.id ?? null;

    const {
      data,
      error,
    } =
      await supabase
        .from("messages")
        .insert({
          conversation_id:
            id,
          sender_id:
            user.id,
          type:
            payload.type ??
            "text",
          content:
            payload.content ??
            null,
          media_url:
            payload.media_url ??
            null,
          media_duration:
            payload.media_duration ??
            null,
          reply_to:
            replyId,
        })
        .select("*")
        .single();

    setSendingIds(
      (prev) =>
        prev.filter(
          (x) =>
            x !==
            optimisticId,
        ),
    );

    if (
      error ||
      !data
    ) {
      toast.error(
        error?.message ??
          "Could not send message",
      );

      return false;
    }

    setReplyTo(null);

    applyMessage(
      data as Message,
    );

    void pushNotify(
      preview,
    );

    return true;
  }

  /*
   * ---------------------------------------------------------
   * TEXT MESSAGE
   * ---------------------------------------------------------
   */

  async function submit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    const body =
      text.trim();

    if (
      !body ||
      !user
    ) {
      return;
    }

    setText("");

    if (editing) {
      const target =
        editing;

      setEditing(null);

      const editedAt =
        new Date().toISOString();

      qc.setQueryData<
        Message[]
      >(
        messagesKey,
        (prev = []) =>
          prev.map(
            (message) =>
              message.id ===
              target.id
                ? {
                    ...message,
                    content:
                      body,
                    edited_at:
                      editedAt,
                  }
                : message,
          ),
      );

      const {
        error,
      } =
        await supabase
          .from("messages")
          .update({
            content:
              body,
            edited_at:
              editedAt,
          })
          .eq(
            "id",
            target.id,
          );

      if (error) {
        toast.error(
          error.message,
        );

        void qc.invalidateQueries({
          queryKey: [
            "messages",
            id,
          ],
        });
      }

      return;
    }

    if (
      !navigator.onLine
    ) {
      enqueue({
        id:
          crypto.randomUUID(),
        conversationId:
          id,
        senderId:
          user.id,
        content:
          body,
        replyTo:
          replyTo?.id ??
          null,
        createdAt:
          new Date().toISOString(),
      });

      setReplyTo(null);
      refreshOutbox();

      return;
    }

    const ok =
      await sendMessage(
        {
          type: "text",
          content:
            body,
        },
        body,
      );

    if (!ok) {
      enqueue({
        id:
          crypto.randomUUID(),
        conversationId:
          id,
        senderId:
          user.id,
        content:
          body,
        replyTo:
          replyTo?.id ??
          null,
        createdAt:
          new Date().toISOString(),
      });

      refreshOutbox();
    }
  }

  /*
   * ---------------------------------------------------------
   * MEDIA
   * ---------------------------------------------------------
   */

  async function onFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    event.target.value =
      "";

    if (!file) return;

    if (
      !file.type.startsWith(
        "image/",
      ) &&
      !file.type.startsWith(
        "video/",
      )
    ) {
      toast.error(
        "Only images and videos are supported.",
      );

      return;
    }

    if (
      file.size >
      50 *
        1024 *
        1024
    ) {
      toast.error(
        "Files must be under 50 MB.",
      );

      return;
    }

    const kind =
      file.type.startsWith(
        "video",
      )
        ? "video"
        : "image";

    try {
      const path =
        await uploadChatMedia(
          id,
          file,
          kind ===
            "video"
            ? "mp4"
            : "jpg",
        );

      await sendMessage(
        {
          type:
            kind,
          media_url:
            path,
        },
        kind ===
          "video"
          ? "🎬 Video"
          : "📷 Photo",
      );
    } catch (error) {
      toast.error(
        (error as Error)
          .message,
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * VOICE RECORDING
   *
   * IMPORTANT:
   * cancelRecordingRef prevents onstop from uploading.
   * ---------------------------------------------------------
   */

  async function startRecording() {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
          },
        );

      recordingStream.current =
        stream;

      const mediaRecorder =
        new MediaRecorder(
          stream,
        );

      chunks.current =
        [];

      cancelRecordingRef.current =
        false;

      mediaRecorder.ondataavailable =
        (event) => {
          if (
            event.data.size >
            0
          ) {
            chunks.current.push(
              event.data,
            );
          }
        };

      mediaRecorder.onstop =
        async () => {
          stream
            .getTracks()
            .forEach(
              (track) =>
                track.stop(),
            );

          recordingStream.current =
            null;

          recorder.current =
            null;

          const wasCancelled =
            cancelRecordingRef.current;

          cancelRecordingRef.current =
            false;

          const seconds =
            recSecs;

          setRecording(
            false,
          );

          setRecSecs(
            0,
          );

          if (
            wasCancelled
          ) {
            chunks.current =
              [];

            return;
          }

          const blob =
            new Blob(
              chunks.current,
              {
                type:
                  "audio/webm",
              },
            );

          chunks.current =
            [];

          try {
            const path =
              await uploadChatMedia(
                id,
                blob,
                "webm",
              );

            await sendMessage(
              {
                type:
                  "audio",
                media_url:
                  path,
                media_duration:
                  seconds,
              },
              "🎙️ Voice note",
            );
          } catch (error) {
            toast.error(
              (error as Error)
                .message,
            );
          }
        };

      mediaRecorder.start();

      recorder.current =
        mediaRecorder;

      setRecSecs(
        0,
      );

      setRecording(
        true,
      );
    } catch (error) {
      const name =
        (
          error as DOMException
        )?.name;

      toast.error(
        name ===
          "NotAllowedError"
          ? "Microphone permission denied. Enable it in your browser settings."
          : "Could not start recording.",
      );
    }
  }

  function stopRecordingAndSend() {
    if (
      !recorder.current
    ) {
      return;
    }

    cancelRecordingRef.current =
      false;

    if (
      recorder.current.state !==
      "inactive"
    ) {
      recorder.current.stop();
    }

    setRecording(
      false,
    );
  }

  function cancelRecording() {
    if (
      !recorder.current
    ) {
      return;
    }

    cancelRecordingRef.current =
      true;

    chunks.current =
      [];

    if (
      recorder.current.state !==
      "inactive"
    ) {
      recorder.current.stop();
    }

    recordingStream.current
      ?.getTracks()
      .forEach(
        (track) =>
          track.stop(),
      );

    recordingStream.current =
      null;

    recorder.current =
      null;

    setRecording(
      false,
    );

    setRecSecs(
      0,
    );

    toast.info(
      "Voice recording cancelled",
    );
  }

  /*
   * ---------------------------------------------------------
   * DELETE FOR ME
   * ---------------------------------------------------------
   */

  async function deleteForMe(
    message: Message,
  ) {
    if (
      !user ||
      deletedForMe.has(
        message.id,
      )
    ) {
      return;
    }

    setDeletingMessageId(
      message.id,
    );

    try {
      const { error } =
        await (supabase as any)
          .from(
            "message_deletions",
          )
          .insert({
            message_id:
              message.id,
            user_id:
              user.id,
          });

      if (
        error &&
        error.code !==
          "23505"
      ) {
        throw error;
      }

      qc.setQueryData<
        MessageDeletion[]
      >(
        [
          "message-deletions",
          id,
          user.id,
        ],
        (prev = []) => [
          ...prev,
          {
            message_id:
              message.id,
            user_id:
              user.id,
            deleted_at:
              new Date().toISOString(),
          },
        ],
      );

      toast.success(
        "Message deleted for you",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete message.",
      );
    } finally {
      setDeletingMessageId(
        null,
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * DELETE FOR EVERYONE
   * ---------------------------------------------------------
   */

  async function deleteForEveryone(
    message: Message,
  ) {
    if (
      !user ||
      message.sender_id !==
        user.id
    ) {
      return;
    }

    setDeletingForEveryoneId(
      message.id,
    );

    const deletedAt =
      new Date().toISOString();

    try {
      const {
        data,
        error,
      } =
        await supabase
          .from("messages")
          .update({
            deleted_at:
              deletedAt,
            content:
              null,
            media_url:
              null,
          })
          .eq(
            "id",
            message.id,
          )
          .eq(
            "sender_id",
            user.id,
          )
          .select("*")
          .single();

      if (error) {
        throw error;
      }

      if (data) {
        applyMessage(
          data as Message,
        );
      }

      toast.success(
        "Message deleted for everyone",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete message.",
      );
    } finally {
      setDeletingForEveryoneId(
        null,
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * DELETE MENU
   * ---------------------------------------------------------
   */

  function confirmDelete(
    message: Message,
  ) {
    if (
      message.sender_id ===
      user?.id
    ) {
      const choice =
        window.confirm(
          "Delete this message for everyone?\n\nPress Cancel to delete it only for you.",
        );

      if (choice) {
        void deleteForEveryone(
          message,
        );
      } else {
        void deleteForMe(
          message,
        );
      }

      return;
    }

    void deleteForMe(
      message,
    );
  }

  /*
   * ---------------------------------------------------------
   * JUMP TO ORIGINAL MESSAGE
   * ---------------------------------------------------------
   */

  function jumpToMessage(
    messageId: string,
  ) {
    const element =
      document.getElementById(
        `message-${messageId}`,
      );

    if (!element) {
      toast.info(
        "That message isn't loaded. Try loading older messages.",
      );

      return;
    }

    element.scrollIntoView({
      behavior:
        "smooth",
      block: "center",
    });

    setHighlightedMessage(
      messageId,
    );

    window.setTimeout(() => {
      setHighlightedMessage(
        null,
      );
    }, 1800);
  }

  /*
   * ---------------------------------------------------------
   * SWIPE RIGHT TO REPLY
   * ---------------------------------------------------------
   */

  function handleSwipeStart(
    event: React.TouchEvent,
  ) {
    swipeStartX.current =
      event.touches[0]?.clientX ??
      null;

    swipeCurrentX.current =
      swipeStartX.current;
  }

  function handleSwipeMove(
    event: React.TouchEvent,
  ) {
    if (
      swipeStartX.current ===
      null
    ) {
      return;
    }

    swipeCurrentX.current =
      event.touches[0]?.clientX ??
      null;
  }

  function handleSwipeEnd(
    message: Message,
  ) {
    if (
      swipeStartX.current ===
        null ||
      swipeCurrentX.current ===
        null
    ) {
      return;
    }

    const distance =
      swipeCurrentX.current -
      swipeStartX.current;

    swipeStartX.current =
      null;

    swipeCurrentX.current =
      null;

    if (
      distance >= 70 &&
      !message.deleted_at
    ) {
      setSwipeReplyId(
        message.id,
      );

      setReplyTo(
        message,
      );

      window.setTimeout(
        () =>
          setSwipeReplyId(
            null,
          ),
        450,
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * ADD CONTACT
   * ---------------------------------------------------------
   */

  async function addContact() {
    if (
      !user?.id ||
      !otherUserId
    ) {
      toast.error(
        "Could not identify this user.",
      );

      return;
    }

    const {
      error,
    } =
      await supabase
        .from("contacts")
        .insert({
          owner_id:
            user.id,
          contact_id:
            otherUserId,
        });

    if (error) {
      if (
        error.code ===
        "23505"
      ) {
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

  /*
   * ---------------------------------------------------------
   * CALLS
   * ---------------------------------------------------------
   */

  function callVoice() {
    if (!otherUserId) {
      toast.error(
        "Could not identify the person you're calling.",
      );

      return;
    }

    void startCall(
      {
        id:
          otherUserId,
        name:
          otherName,
        avatar:
          otherAvatar,
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
        id:
          otherUserId,
        name:
          otherName,
        avatar:
          otherAvatar,
      },
      "video",
    );
  }

  const hasMore =
    messages.length >=
    limit;

  /*
   * ---------------------------------------------------------
   * CLEANUP RECORDING ON UNMOUNT
   * ---------------------------------------------------------
   */

  useEffect(() => {
    return () => {
      cancelRecordingRef.current =
        true;

      recordingStream.current
        ?.getTracks()
        .forEach(
          (track) =>
            track.stop(),
        );

      if (
        recorder.current &&
        recorder.current.state !==
          "inactive"
      ) {
        recorder.current.stop();
      }
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col app-gradient">

      {/* HEADER */}
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

        {conv?.type ===
        "group" ? (
          <Link
            to="/groups/$id"
            params={{ id }}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <UserAvatar
              path={
                conv.avatar_url
              }
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
              path={
                otherAvatar
              }
              name={
                otherName
              }
              size="sm"
              online={
                isOtherOnline
              }
            />

            <div className="min-w-0">
              <p className="truncate font-medium leading-tight">
                {otherName}
              </p>

              <p className="truncate text-xs text-muted-foreground">
                {typingUsers.length
                  ? "typing…"
                  : directSubtitle}
              </p>
            </div>
          </div>
        )}

        {conv?.type ===
          "direct" &&
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
                title={`Voice call ${otherName}`}
                onClick={
                  callVoice
                }
              >
                <Phone className="h-5 w-5" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                title={`Video call ${otherName}`}
                onClick={
                  callVideo
                }
              >
                <VideoIcon className="h-5 w-5" />
              </Button>

            </div>
          )}
      </header>

      {/* MESSAGES */}
      <div className="flex-1 space-y-2 px-3 py-4">

        {hasMore && (
          <div className="flex justify-center pb-2">
            <Button
              size="sm"
              variant="outline"
              disabled={
                fetchingMessages
              }
              onClick={() =>
                setLimit(
                  (current) =>
                    current +
                    PAGE_SIZE,
                )
              }
            >
              {fetchingMessages
                ? "Loading…"
                : "Load older messages"}
            </Button>
          </div>
        )}

        {messages.map(
          (message) => {
            if (
              deletedForMe.has(
                message.id,
              )
            ) {
              return null;
            }

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

            const counts =
              reactionCounts(
                message.id,
              );

            const pickerOpen =
              reactionPicker ===
              message.id;

            const highlighted =
              highlightedMessage ===
              message.id;

            const swiping =
              swipeReplyId ===
              message.id;

            return (
              <div
                key={
                  message.id
                }
                id={`message-${message.id}`}
                className={`group flex ${
                  mine
                    ? "justify-end"
                    : "justify-start"
                } ${
                  highlighted
                    ? "animate-pulse"
                    : ""
                }`}
                onTouchStart={
                  handleSwipeStart
                }
                onTouchMove={
                  handleSwipeMove
                }
                onTouchEnd={() =>
                  handleSwipeEnd(
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

                  {/* SWIPE REPLY INDICATOR */}
                  {swiping && (
                    <div
                      className={`absolute top-1/2 ${
                        mine
                          ? "-left-10"
                          : "-right-10"
                      } -translate-y-1/2`}
                    >
                      <Reply className="h-5 w-5 text-primary" />
                    </div>
                  )}

                  {/* BUBBLE */}
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm shadow-panel ${
                      highlighted
                        ? "ring-2 ring-primary ring-offset-2"
                        : ""
                    } ${
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface"
                    }`}
                  >

                    {conv?.type ===
                      "group" &&
                      !mine && (
                        <p className="mb-1 text-[11px] font-semibold text-primary">
                          {sender?.display_name ||
                            "Unknown"}
                        </p>
                      )}

                    {/* REPLIED MESSAGE */}
                    {parent && (
                      <button
                        type="button"
                        onClick={() =>
                          jumpToMessage(
                            parent.id,
                          )
                        }
                        className="mb-2 w-full rounded-lg border-l-2 border-current/40 bg-black/10 px-2 py-1 text-left text-[11px] opacity-80 transition hover:bg-black/20 active:scale-[0.98]"
                      >
                        <span className="block font-semibold">
                          Reply
                        </span>

                        <span className="line-clamp-2">
                          {parent.deleted_at
                            ? "Deleted message"
                            : parent.content ||
                              "Attachment"}
                        </span>
                      </button>
                    )}

                    {/* MESSAGE CONTENT */}
                    {message.deleted_at ? (
                      <p className="italic opacity-70">
                        This message was deleted
                      </p>
                    ) : message.type ===
                      "text" ? (
                      <p className="whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
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

                    {/* TIME + STATUS */}
                    <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-70">

                      {message.edited_at &&
                        !message.deleted_at && (
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
                        !message.deleted_at &&
                        (seen ? (
                          <CheckCheck className="h-3 w-3" />
                        ) : (
                          <Check className="h-3 w-3" />
                        ))}
                    </div>
                  </div>

                  {/* REACTIONS */}
                  {counts.length >
                    0 &&
                    !message.deleted_at && (
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
                              key={
                                emoji
                              }
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

                  {/* ACTION BAR */}
                  {!message.deleted_at && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">

                      {/* REACTION */}
                      <div className="relative">
                        <button
                          type="button"
                          className="rounded-full bg-background/80 px-2 py-1 text-[11px] shadow-sm transition hover:bg-background"
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
                              (
                                emoji,
                              ) => (
                                <button
                                  key={
                                    emoji
                                  }
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
                                  {
                                    emoji
                                  }
                                </button>
                              ),
                            )}
                          </div>
                        )}
                      </div>

                      {/* REPLY */}
                      <button
                        type="button"
                        className="rounded-full bg-background/80 px-2 py-1 text-[11px] shadow-sm hover:bg-background"
                        onClick={() =>
                          setReplyTo(
                            message,
                          )
                        }
                      >
                        <Reply className="mr-1 inline h-3 w-3" />
                        Reply
                      </button>

                      {/* EDIT */}
                      {mine &&
                        message.type ===
                          "text" && (
                          <button
                            type="button"
                            className="rounded-full bg-background/80 px-2 py-1 text-[11px] shadow-sm hover:bg-background"
                            onClick={() => {
                              setEditing(
                                message,
                              );

                              setReplyTo(
                                null,
                              );

                              setText(
                                message.content ??
                                  "",
                              );
                            }}
                          >
                            <Pencil className="mr-1 inline h-3 w-3" />
                            Edit
                          </button>
                        )}

                      {/* DELETE */}
                      <button
                        type="button"
                        disabled={
                          deletingMessageId ===
                            message.id ||
                          deletingForEveryoneId ===
                            message.id
                        }
                        className="rounded-full bg-background/80 px-2 py-1 text-[11px] text-destructive shadow-sm hover:bg-background disabled:opacity-50"
                        onClick={() =>
                          void confirmDelete(
                            message,
                          )
                        }
                      >
                        <Trash2 className="mr-1 inline h-3 w-3" />

                        {deletingMessageId ===
                        message.id
                          ? "Deleting…"
                          : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          },
        )}

        {/* SENDING */}
        {sendingIds.map(
          (sendingId) => (
            <div
              key={
                sendingId
              }
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

        {/* OFFLINE */}
        {pending.map(
          (item) => (
            <div
              key={item.id}
              className="flex justify-end"
            >
              <div className="max-w-[80%] rounded-2xl border border-dashed border-primary/50 bg-primary/20 px-3 py-2 text-sm">

                <p className="whitespace-pre-wrap break-words">
                  {item.content}
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
          ),
        )}

        {/* TYPING */}
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

            {typingUsers.length ===
            1
              ? `${typingUsers[0]} is typing…`
              : `${typingUsers.length} people are typing…`}
          </div>
        )}

        <div
          ref={bottom}
        />
      </div>

      {/* COMPOSER */}
      <form
        onSubmit={
          submit
        }
        className="sticky bottom-0 z-20 space-y-2 border-t border-border/60 bg-background/90 px-3 py-2.5 backdrop-blur safe-bottom"
      >

        {/* REPLY / EDIT */}
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
                    {replyTo.deleted_at
                      ? "Deleted message"
                      : replyTo.content ||
                        "Attachment"}
                  </p>
                )}
            </div>

            <button
              type="button"
              onClick={() => {
                setReplyTo(
                  null,
                );

                setEditing(
                  null,
                );

                setText("");
              }}
              className="rounded-full p-1 hover:bg-background"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* VOICE RECORDING CONTROLS */}
        {recording && (
          <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">

            <div className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />

              <span>
                Recording{" "}
                {durationLabel(
                  recSecs,
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">

              {/* CANCEL */}
              <button
                type="button"
                className="rounded-full px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                onClick={
                  cancelRecording
                }
              >
                <X className="mr-1 inline h-4 w-4" />
                Cancel
              </button>

              {/* SEND */}
              <button
                type="button"
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                onClick={
                  stopRecordingAndSend
                }
              >
                <Send className="mr-1 inline h-4 w-4" />
                Send
              </button>

            </div>
          </div>
        )}

        <div className="flex items-center gap-2">

          <input
            ref={
              fileInput
            }
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(
              event,
            ) =>
              void onFile(
                event,
              )
            }
          />

          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={
              !online ||
              recording
            }
            onClick={() =>
              fileInput.current?.click()
            }
          >
            <ImagePlus className="h-5 w-5" />
          </Button>

          <Input
            value={text}
            onChange={(
              event,
            ) => {
              setText(
                event.target
                  .value,
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
            disabled={
              recording
            }
          />

          {text.trim() ? (
            <Button
              type="submit"
              size="icon"
              disabled={
                recording
              }
            >
              <Send className="h-5 w-5" />
            </Button>
          ) : recording ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={
                stopRecordingAndSend
              }
            >
              <Send className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              variant="default"
              disabled={
                !online
              }
              onClick={() =>
                void startRecording()
              }
            >
              <Mic className="h-5 w-5" />
            </Button>
          )}

        </div>
      </form>
    </div>
  );
}