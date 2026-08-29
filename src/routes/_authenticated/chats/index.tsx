import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  ChevronDown,
  Image,
  MoreVertical,
  Palette,
  PenSquare,
  Pin,
  Search,
  Type,
  Users,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/components/RealtimeProvider";
import { AppShell, PageHeader } from "@/components/AppShell";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  timeLabel,
  type Conversation,
  type Message,
  type Profile,
} from "@/lib/whatsxup";

import {
  CHAT_FONTS,
  CHAT_THEMES,
  CHAT_WALLPAPERS,
  getFont,
  getTheme,
  getWallpaper,
  getPageAppearance,
  savePageAppearance,
  getChatAppearance,
  saveChatAppearance,
  type ChatAppearance,
} from "@/lib/chatAppearance";

export const Route = createFileRoute("/_authenticated/chats/")({
  head: () => ({
    meta: [
      { title: "Chats — WHATSXUP" },
      {
        name: "description",
        content:
          "All your WHATSXUP conversations and groups in one fast, real-time inbox.",
      },
      {
        property: "og:title",
        content: "Chats — WHATSXUP",
      },
      {
        property: "og:description",
        content:
          "All your conversations and groups in one real-time inbox.",
      },
    ],
  }),
  component: ChatsPage,
});

type ConversationMember = {
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
  is_pinned?: boolean | null;
  is_muted?: boolean | null;
  is_archived?: boolean | null;
};

type Row = {
  conv: Conversation;
  title: string;
  avatar: string | null;
  otherId: string | null;
  last: Message | null;
  unread: number;
  searchText: string;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
};

type FilterType =
  | "all"
  | "unread"
  | "groups"
  | "favorites"
  | "archived";

type MenuState = {
  row: Row;
} | null;

type AppearanceTarget =
  | {
      type: "chat";
      chatId: string;
      title: string;
    }
  | {
      type: "page";
    }
  | null;

const FAVORITES_KEY = "whatsxup-favorite-chats";

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function saveFavorites(ids: string[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify(ids),
    );
  } catch {
    // Ignore storage errors.
  }
}


const LOCAL_CHAT_NAME_PREFIX = "whatsxup-chat-name:";

function readLocalChatName(conversationId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(
      `${LOCAL_CHAT_NAME_PREFIX}${conversationId}`,
    );
    const trimmed = stored?.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

function ChatsPage() {
  const { user } = useAuth();
  const { onlineIds } = useRealtime();
  const qc = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => {
      void qc.invalidateQueries({ queryKey: ["chat-list"] });
    };
    window.addEventListener("focus", bump);
    window.addEventListener("xup-chat-name-changed", bump);
    return () => {
      window.removeEventListener("focus", bump);
      window.removeEventListener("xup-chat-name-changed", bump);
    };
  }, [qc]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<FilterType>("all");

  const [menu, setMenu] =
    useState<MenuState>(null);

  const [appearanceTarget, setAppearanceTarget] =
    useState<AppearanceTarget>(null);

  const [appearance, setAppearance] =
    useState<ChatAppearance>({
      themeId: "default",
      fontId: "font-1",
      wallpaperId: "none",
    });

  const [appearanceLoading, setAppearanceLoading] =
    useState(false);

  const [fontSearch, setFontSearch] = useState("");

  const [favorites, setFavorites] =
    useState<string[]>([]);

  /*
   * ---------------------------------------------------------
   * Load local favorites
   * ---------------------------------------------------------
   */

  useEffect(() => {
    setFavorites(readFavorites());
  }, []);

  /*
   * ---------------------------------------------------------
   * Load Chats-page appearance
   * ---------------------------------------------------------
   */

  useEffect(() => {
    let mounted = true;

    getPageAppearance().then((saved) => {
      if (mounted) {
        setAppearance(saved);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * Load appearance when a chat is selected
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (
      !appearanceTarget ||
      appearanceTarget.type !== "chat"
    ) {
      return;
    }

    let mounted = true;

    setAppearanceLoading(true);

    getChatAppearance(
      appearanceTarget.chatId,
    )
      .then((saved) => {
        if (mounted) {
          setAppearance(saved);
        }
      })
      .finally(() => {
        if (mounted) {
          setAppearanceLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [appearanceTarget]);

  /*
   * ---------------------------------------------------------
   * Chat list
   * ---------------------------------------------------------
   */

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["chat-list", user?.id],
    refetchOnWindowFocus: true,

    enabled: !!user,

    queryFn: async (): Promise<Row[]> => {
      if (!user) return [];

      /*
       * Get this user's conversation memberships.
       */

      const { data: mine, error: mineError } =
        await supabase
          .from("conversation_members")
          .select(
            `
            conversation_id,
            last_read_at,
            is_pinned,
            is_muted,
            is_archived
          `,
          )
          .eq("user_id", user.id);

      if (mineError) {
        throw mineError;
      }

      const myMemberships =
        (mine ?? []) as ConversationMember[];

      const ids = myMemberships.map(
        (row) => row.conversation_id,
      );

      if (!ids.length) return [];

      /*
       * Get conversations.
       */

      const { data: convs, error: convError } =
        await supabase
          .from("conversations")
          .select("*")
          .in("id", ids)
          .order("last_message_at", {
            ascending: false,
            nullsFirst: false,
          });

      if (convError) {
        throw convError;
      }

      /*
       * Get members.
       */

      const {
        data: memberRows,
        error: memberError,
      } = await supabase
        .from("conversation_members")
        .select("conversation_id, user_id")
        .in("conversation_id", ids);

      if (memberError) {
        throw memberError;
      }

      const members =
        (memberRows ?? []) as Pick<
          ConversationMember,
          "conversation_id" | "user_id"
        >[];

      /*
       * Find other users.
       */

      const otherUserIds = Array.from(
        new Set(
          members
            .filter(
              (member) =>
                member.user_id !== user.id,
            )
            .map((member) => member.user_id),
        ),
      );

      /*
       * Profiles.
       */

      let profiles: Profile[] = [];

      if (otherUserIds.length > 0) {
        const {
          data: profileRows,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("*")
          .in("id", otherUserIds);

        if (profileError) {
          console.error(
            "Could not load chat profiles:",
            profileError,
          );
        } else {
          profiles =
            (profileRows ?? []) as Profile[];
        }
      }

      const profileMap =
        new Map<string, Profile>();

      for (const profile of profiles) {
        profileMap.set(profile.id, profile);
      }

      /*
       * Recent messages.
       */

      const {
        data: msgs,
        error: messageError,
      } = await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", ids)
        .order("created_at", {
          ascending: false,
        })
        .limit(500);

      if (messageError) {
        throw messageError;
      }

      const allMessages =
        (msgs ?? []) as Message[];

      /*
       * Read timestamps.
       */

      const readAt = new Map(
        myMemberships.map((row) => [
          row.conversation_id,
          row.last_read_at,
        ]),
      );

      const membershipMap =
        new Map<string, ConversationMember>();

      for (const membership of myMemberships) {
        membershipMap.set(
          membership.conversation_id,
          membership,
        );
      }

      /*
       * Build rows.
       */

      return (
        (convs ?? []) as Conversation[]
      ).map((conv) => {
        const convMembers = members.filter(
          (member) =>
            member.conversation_id === conv.id,
        );

        const convMessages = allMessages
          .filter(
            (message) =>
              message.conversation_id ===
              conv.id,
          )
          .sort((a, b) =>
            b.created_at.localeCompare(
              a.created_at,
            ),
          );

        const last =
          convMessages[0] ?? null;

        const since =
          readAt.get(conv.id) ??
          "1970-01-01T00:00:00.000Z";

        const unread =
          convMessages.filter(
            (message) =>
              message.sender_id !== user.id &&
              message.created_at > since,
          ).length;

        const membership =
          membershipMap.get(conv.id);

        const isPinned =
          membership?.is_pinned === true;

        const isMuted =
          membership?.is_muted === true;

        const isArchived =
          membership?.is_archived === true;

        /*
         * Direct chat.
         */

        if (conv.type !== "group") {
          const otherMember =
            convMembers.find(
              (member) =>
                member.user_id !== user.id,
            );

          const otherId =
            otherMember?.user_id ?? null;

          const profile = otherId
            ? profileMap.get(otherId)
            : undefined;

          const displayName =
            profile?.display_name?.trim();

          const username =
            profile?.username?.trim();

          const localNick = readLocalChatName(conv.id);

          const title =
            localNick ||
            displayName ||
            username ||
            "Unknown";

          const messageSearchText =
            convMessages
              .slice(0, 50)
              .map(
                (message) =>
                  message.content ?? "",
              )
              .join(" ");

          return {
            conv,
            title,
            avatar:
              profile?.avatar_url ?? null,
            otherId,
            last,
            unread,
            searchText:
              `${title} ${username ?? ""} ${messageSearchText}`.toLowerCase(),
            isPinned,
            isMuted,
            isArchived,
          };
        }

        /*
         * Group chat.
         */

        const groupTitle =
          conv.name?.trim() ||
          "Group";

        const messageSearchText =
          convMessages
            .slice(0, 50)
            .map(
              (message) =>
                message.content ?? "",
            )
            .join(" ");

        return {
          conv,
          title: groupTitle,
          avatar:
            conv.avatar_url ?? null,
          otherId: null,
          last,
          unread,
          searchText:
            `${groupTitle} ${messageSearchText}`.toLowerCase(),
          isPinned,
          isMuted,
          isArchived,
        };
      });
    },
  });

  /*
   * ---------------------------------------------------------
   * Realtime
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("chat-list-feed")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          void qc.invalidateQueries({
            queryKey: [
              "chat-list",
              user.id,
            ],
          });
        },
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
        },
        () => {
          void qc.invalidateQueries({
            queryKey: [
              "chat-list",
              user.id,
            ],
          });
        },
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        () => {
          void qc.invalidateQueries({
            queryKey: [
              "chat-list",
              user.id,
            ],
          });
        },
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          void qc.invalidateQueries({
            queryKey: [
              "chat-list",
              user.id,
            ],
          });
        },
      )

      .subscribe();

    return () => {
      void supabase.removeChannel(
        channel,
      );
    };
  }, [user, qc]);

  /*
   * ---------------------------------------------------------
   * Search + filters
   * ---------------------------------------------------------
   */

  const visibleRows = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (
          filter === "unread" &&
          row.unread === 0
        ) {
          return false;
        }

        if (
          filter === "groups" &&
          row.conv.type !== "group"
        ) {
          return false;
        }

        if (
          filter === "favorites" &&
          !favorites.includes(row.conv.id)
        ) {
          return false;
        }

        if (
          filter === "archived" &&
          !row.isArchived
        ) {
          return false;
        }

        if (
          filter !== "archived" &&
          row.isArchived
        ) {
          return false;
        }

        if (
          query &&
          !row.searchText.includes(query)
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (
          a.isPinned !== b.isPinned
        ) {
          return a.isPinned ? -1 : 1;
        }

        const aTime =
          a.last?.created_at ?? "";

        const bTime =
          b.last?.created_at ?? "";

        return bTime.localeCompare(
          aTime,
        );
      });
  }, [
    rows,
    search,
    filter,
    favorites,
  ]);

  /*
   * ---------------------------------------------------------
   * Appearance helpers
   * ---------------------------------------------------------
   */

  const currentTheme =
    getTheme(appearance.themeId);

  const currentWallpaper =
    getWallpaper(
      appearance.wallpaperId,
    );

  const currentFont =
    getFont(appearance.fontId);

  async function updateAppearance(
    changes: Partial<ChatAppearance>,
  ) {
    const next = {
      ...appearance,
      ...changes,
    };

    setAppearance(next);

    if (
      appearanceTarget?.type === "chat"
    ) {
      await saveChatAppearance(
        appearanceTarget.chatId,
        next,
      );
    } else {
      await savePageAppearance(next);
    }
  }

  /*
   * ---------------------------------------------------------
   * Favorites
   * ---------------------------------------------------------
   */

  function toggleFavorite(
    conversationId: string,
  ) {
    setFavorites((previous) => {
      const exists =
        previous.includes(
          conversationId,
        );

      const next = exists
        ? previous.filter(
            (id) =>
              id !== conversationId,
          )
        : [
            ...previous,
            conversationId,
          ];

      saveFavorites(next);

      return next;
    });
  }

  /*
   * ---------------------------------------------------------
   * Conversation settings
   * ---------------------------------------------------------
   */

  async function updateConversationMember(
    conversationId: string,
    changes: Record<
      string,
      boolean
    >,
  ) {
    if (!user) return;

    const { error } =
      await supabase
        .from("conversation_members")
        .update(changes)
        .eq(
          "conversation_id",
          conversationId,
        )
        .eq("user_id", user.id);

    if (error) {
      console.error(error);

      return;
    }

    await qc.invalidateQueries({
      queryKey: [
        "chat-list",
        user.id,
      ],
    });
  }

  async function markRead(
    row: Row,
  ) {
    if (!user) return;

    await supabase
      .from("conversation_members")
      .update({
        last_read_at:
          new Date().toISOString(),
      })
      .eq(
        "conversation_id",
        row.conv.id,
      )
      .eq("user_id", user.id);

    await qc.invalidateQueries({
      queryKey: [
        "chat-list",
        user.id,
      ],
    });
  }

  async function markUnread(
    row: Row,
  ) {
    if (!user) return;

    /*
     * Setting last_read_at to an older time
     * makes the conversation appear unread.
     */

    await supabase
      .from("conversation_members")
      .update({
        last_read_at:
          "1970-01-01T00:00:00.000Z",
      })
      .eq(
        "conversation_id",
        row.conv.id,
      )
      .eq("user_id", user.id);

    await qc.invalidateQueries({
      queryKey: [
        "chat-list",
        user.id,
      ],
    });
  }

  async function deleteChat(
    row: Row,
  ) {
    if (!user) return;

    /*
     * This removes THIS user's membership.
     * It does not delete the conversation or
     * other people's messages.
     */

    const { error } =
      await supabase
        .from("conversation_members")
        .delete()
        .eq(
          "conversation_id",
          row.conv.id,
        )
        .eq("user_id", user.id);

    if (error) {
      console.error(error);
      return;
    }

    setMenu(null);

    await qc.invalidateQueries({
      queryKey: [
        "chat-list",
        user.id,
      ],
    });
  }

  /*
   * ---------------------------------------------------------
   * Message preview
   * ---------------------------------------------------------
   */

  function preview(
    message: Message | null,
  ) {
    if (!message) {
      return "No messages yet";
    }

    if (message.deleted_at) {
      return "This message was deleted";
    }

    if (message.type === "image") {
      return "📷 Photo";
    }

    if (message.type === "video") {
      return "🎬 Video";
    }

    if (message.type === "audio") {
      return "🎙️ Voice note";
    }

    const content =
      message.content ?? "";

    if (!content.trim()) {
      return "Message";
    }

    return content;
  }

  /*
   * ---------------------------------------------------------
   * Open chat appearance
   * ---------------------------------------------------------
   */

  function openChatAppearance(
    row: Row,
  ) {
    setMenu(null);

    setAppearanceTarget({
      type: "chat",
      chatId: row.conv.id,
      title: row.title,
    });
  }

  /*
   * ---------------------------------------------------------
   * Open page appearance
   * ---------------------------------------------------------
   */

  function openPageAppearance() {
    setAppearanceTarget({
      type: "page",
    });
  }

  /*
   * ---------------------------------------------------------
   * Filter labels
   * ---------------------------------------------------------
   */

  const filters: {
    id: FilterType;
    label: string;
  }[] = [
    {
      id: "all",
      label: "All",
    },
    {
      id: "unread",
      label: "Unread",
    },
    {
      id: "groups",
      label: "Groups",
    },
    {
      id: "favorites",
      label: "Favorites",
    },
    {
      id: "archived",
      label: "Archived",
    },
  ];

  /*
   * ---------------------------------------------------------
   * Page appearance styles
   * ---------------------------------------------------------
   */

  const pageStyle = {
    backgroundColor:
      currentTheme.background,
    color: currentTheme.text,
    fontFamily:
      currentFont.family,
    backgroundImage:
      currentWallpaper.value ||
      undefined,
    backgroundSize:
      currentWallpaper.id ===
        "dots" ||
      currentWallpaper.id === "grid"
        ? "24px 24px"
        : "cover",
    backgroundAttachment: "fixed" as const,
  };

  return (
    <AppShell>
      <div
        className="min-h-screen"
        style={pageStyle}
      >
        <PageHeader
          title="Chats"
          action={
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={
                  openPageAppearance
                }
                aria-label="Customize Chats"
              >
                <Palette className="h-5 w-5" />
              </Button>

              <Button
                asChild
                size="sm"
                variant="outline"
              >
                <Link to="/groups/new">
                  <Users className="h-4 w-4" />
                  Group
                </Link>
              </Button>

              <Button
                asChild
                size="sm"
              >
                <Link to="/contacts">
                  <PenSquare className="h-4 w-4" />
                  New
                </Link>
              </Button>
            </div>
          }
        />

        <NotificationPrompt />

        <div className="px-4 pb-3 pt-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search chats and messages..."
              className="h-11 rounded-2xl border-white/10 bg-black/10 pl-10"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 opacity-60 hover:bg-white/10"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
          {filters.map((item) => {
            const active =
              filter === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  setFilter(item.id)
                }
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-black/10 text-muted-foreground hover:bg-white/10"
                }`}
              >
                {item.label}

                {item.id ===
                  "unread" &&
                  rows.filter(
                    (row) =>
                      row.unread > 0 &&
                      !row.isArchived,
                  ).length >
                    0 && (
                    <span className="ml-1">
                      {
                        rows.filter(
                          (row) =>
                            row.unread >
                              0 &&
                            !row.isArchived,
                        ).length
                      }
                    </span>
                  )}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3, 4].map(
              (item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-2xl bg-black/10"
                />
              ),
            )}
          </div>
        ) : visibleRows.length ===
          0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-10 text-center">
            <div className="rounded-full bg-black/10 p-5">
              {search ? (
                <Search className="h-7 w-7 opacity-50" />
              ) : (
                <Users className="h-7 w-7 opacity-50" />
              )}
            </div>

            <h2 className="text-lg font-semibold">
              {search
                ? "No chats found"
                : filter ===
                    "favorites"
                  ? "No favorites yet"
                  : filter ===
                      "archived"
                    ? "No archived chats"
                    : filter ===
                        "unread"
                      ? "No unread chats"
                      : "No conversations yet"}
            </h2>

            <p className="max-w-sm text-sm opacity-60">
              {search
                ? "Try another name, username, or message."
                : "Find people by their username and start your first chat."}
            </p>

            {!search &&
              filter === "all" && (
                <Button asChild>
                  <Link to="/contacts">
                    Find people
                  </Link>
                </Button>
              )}
          </div>
        ) : (
          <ul className="space-y-1 px-2 pb-6">
            {visibleRows.map(
              (row) => {
                const isFavorite =
                  favorites.includes(
                    row.conv.id,
                  );

                return (
                  <li
                    key={
                      row.conv.id
                    }
                  >
                    <div className="group flex items-center gap-2 rounded-2xl transition-colors hover:bg-black/10">
                      <Link
                        to="/chats/$id"
                        params={{
                          id: row.conv.id,
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3"
                      >
                        <div className="relative shrink-0">
                          <UserAvatar
                            path={
                              row.avatar
                            }
                            name={
                              row.title
                            }
                            bucket={
                              row.conv
                                .type ===
                              "group"
                                ? "chat-media"
                                : "avatars"
                            }
                            {...(row.otherId
                              ? {
                                  online:
                                    onlineIds.has(
                                      row.otherId,
                                    ),
                                }
                              : {})}
                          />

                          {row.isPinned && (
                            <span className="absolute -bottom-1 -right-1 rounded-full bg-background p-1 shadow">
                              <Pin className="h-2.5 w-2.5 fill-current" />
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1">
                              <p
                                className={`truncate ${
                                  row.unread >
                                  0
                                    ? "font-bold"
                                    : "font-medium"
                                }`}
                              >
                                {row.title}
                              </p>

                              {isFavorite && (
                                <span
                                  title="Favorite"
                                  className="shrink-0 text-xs"
                                >
                                  ⭐
                                </span>
                              )}

                              {row.isMuted && (
                                <VolumeX className="h-3 w-3 shrink-0 opacity-50" />
                              )}
                            </div>

                            {row.last && (
                              <span
                                className={`shrink-0 text-[11px] ${
                                  row.unread >
                                  0
                                    ? "font-semibold text-primary"
                                    : "opacity-50"
                                }`}
                              >
                                {timeLabel(
                                  row.last
                                    .created_at,
                                )}
                              </span>
                            )}
                          </div>

                          <div className="mt-0.5 flex items-center gap-2">
                            <p
                              className={`min-w-0 flex-1 truncate text-sm ${
                                row.unread >
                                0
                                  ? "font-medium opacity-90"
                                  : "opacity-60"
                              }`}
                            >
                              {preview(
                                row.last,
                              )}
                            </p>

                            {row.unread >
                              0 && (
                              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                                {row.unread >
                                99
                                  ? "99+"
                                  : row.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>

                      <button
                        type="button"
                        aria-label={`Options for ${row.title}`}
                        onClick={() =>
                          setMenu({
                            row,
                          })
                        }
                        className="mr-1 shrink-0 rounded-full p-2 opacity-60 transition hover:bg-white/10 hover:opacity-100"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </div>
                  </li>
                );
              },
            )}
          </ul>
        )}

        {/* =====================================================
            CHAT THREE-DOT MENU
        ===================================================== */}

        {menu && (
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-3 sm:items-center"
            onClick={() =>
              setMenu(null)
            }
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 p-2 shadow-2xl"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    path={
                      menu.row.avatar
                    }
                    name={
                      menu.row.title
                    }
                    bucket={
                      menu.row.conv
                        .type === "group"
                        ? "chat-media"
                        : "avatars"
                    }
                  />

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {menu.row.title}
                    </p>

                    <p className="text-xs text-zinc-500">
                      Chat options
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-white hover:bg-white/10"
                  onClick={async () => {
                    await updateConversationMember(
                      menu.row
                        .conv.id,
                      {
                        is_pinned:
                          !menu.row
                            .isPinned,
                      },
                    );

                    setMenu(null);
                  }}
                >
                  <Pin className="h-5 w-5" />

                  <span>
                    {menu.row.isPinned
                      ? "Unpin chat"
                      : "Pin chat"}
                  </span>
                </button>

                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-white hover:bg-white/10"
                  onClick={async () => {
                    await updateConversationMember(
                      menu.row
                        .conv.id,
                      {
                        is_muted:
                          !menu.row
                            .isMuted,
                      },
                    );

                    setMenu(null);
                  }}
                >
                  {menu.row.isMuted ? (
                    <Volume2 className="h-5 w-5" />
                  ) : (
                    <VolumeX className="h-5 w-5" />
                  )}

                  <span>
                    {menu.row.isMuted
                      ? "Unmute notifications"
                      : "Mute notifications"}
                  </span>
                </button>

                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-white hover:bg-white/10"
                  onClick={() => {
                    toggleFavorite(
                      menu.row.conv.id,
                    );

                    setMenu(null);
                  }}
                >
                  <span className="w-5 text-center">
                    ⭐
                  </span>

                  <span>
                    {favorites.includes(
                      menu.row
                        .conv.id,
                    )
                      ? "Remove from favorites"
                      : "Add to favorites"}
                  </span>
                </button>

                {menu.row.unread >
                0 ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-white hover:bg-white/10"
                    onClick={async () => {
                      await markRead(
                        menu.row,
                      );

                      setMenu(null);
                    }}
                  >
                    <Eye className="h-5 w-5" />

                    <span>
                      Mark as read
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-white hover:bg-white/10"
                    onClick={async () => {
                      await markUnread(
                        menu.row,
                      );

                      setMenu(null);
                    }}
                  >
                    <EyeOff className="h-5 w-5" />

                    <span>
                      Mark as unread
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-white hover:bg-white/10"
                  onClick={async () => {
                    await updateConversationMember(
                      menu.row
                        .conv.id,
                      {
                        is_archived:
                          !menu.row
                            .isArchived,
                      },
                    );

                    setMenu(null);
                  }}
                >
                  <Archive className="h-5 w-5" />

                  <span>
                    {menu.row
                      .isArchived
                      ? "Unarchive chat"
                      : "Archive chat"}
                  </span>
                </button>

                <div className="my-2 h-px bg-white/10" />

                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-white hover:bg-white/10"
                  onClick={() =>
                    openChatAppearance(
                      menu.row,
                    )
                  }
                >
                  <Palette className="h-5 w-5" />

                  <span>
                    Chat theme & appearance
                  </span>

                  <ChevronDown className="ml-auto h-4 w-4 -rotate-90 opacity-50" />
                </button>

                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10"
                  onClick={async () => {
                    await deleteChat(
                      menu.row,
                    );
                  }}
                >
                  <Trash2 className="h-5 w-5" />

                  <span>
                    Remove chat
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMenu(null)
                }
                className="mt-2 w-full rounded-2xl py-3 text-sm font-medium text-zinc-400 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* =====================================================
            APPEARANCE PANEL
        ===================================================== */}

        {appearanceTarget && (
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center"
            onClick={() =>
              setAppearanceTarget(null)
            }
          >
            <div
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {appearanceTarget.type ===
                    "chat"
                      ? `Customize ${appearanceTarget.title}`
                      : "Customize Chats"}
                  </h2>

                  <p className="text-xs text-zinc-500">
                    {appearanceTarget.type ===
                    "chat"
                      ? "This appearance is only for this chat."
                      : "Customize the whole Chats page."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setAppearanceTarget(
                      null,
                    )
                  }
                  className="rounded-full p-2 text-zinc-400 hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {appearanceLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                </div>
              ) : (
                <>
                  {/* THEMES */}

                  <section className="mb-7">
                    <div className="mb-3 flex items-center gap-2">
                      <Palette className="h-4 w-4 text-primary" />

                      <h3 className="text-sm font-semibold text-white">
                        Chat theme
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {CHAT_THEMES.map(
                        (theme) => {
                          const selected =
                            appearance.themeId ===
                            theme.id;

                          return (
                            <button
                              key={
                                theme.id
                              }
                              type="button"
                              onClick={() =>
                                void updateAppearance(
                                  {
                                    themeId:
                                      theme.id,
                                  },
                                )
                              }
                              className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${
                                selected
                                  ? "border-white ring-2 ring-white/20"
                                  : "border-white/10"
                              }`}
                              style={{
                                background:
                                  theme.background,
                                color:
                                  theme.text,
                              }}
                            >
                              <span className="text-sm font-semibold">
                                {
                                  theme.name
                                }
                              </span>

                              <span
                                className="mt-3 block h-1 rounded-full"
                                style={{
                                  background:
                                    theme.accent,
                                }}
                              />

                              {selected && (
                                <span className="absolute right-2 top-2 rounded-full bg-white/20 p-1">
                                  <Check className="h-3 w-3" />
                                </span>
                              )}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </section>

                  {/* WALLPAPERS */}

                  <section className="mb-7">
                    <div className="mb-3 flex items-center gap-2">
                      <Image className="h-4 w-4 text-primary" />

                      <h3 className="text-sm font-semibold text-white">
                        Wallpaper
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {CHAT_WALLPAPERS.map(
                        (wallpaper) => {
                          const selected =
                            appearance.wallpaperId ===
                            wallpaper.id;

                          return (
                            <button
                              key={
                                wallpaper.id
                              }
                              type="button"
                              onClick={() =>
                                void updateAppearance(
                                  {
                                    wallpaperId:
                                      wallpaper.id,
                                  },
                                )
                              }
                              className={`relative h-20 overflow-hidden rounded-2xl border p-3 text-left text-xs text-white ${
                                selected
                                  ? "border-white ring-2 ring-white/20"
                                  : "border-white/10"
                              }`}
                              style={{
                                backgroundColor:
                                  currentTheme.background,
                                backgroundImage:
                                  wallpaper.value ||
                                  undefined,
                                backgroundSize:
                                  wallpaper.id ===
                                    "dots" ||
                                  wallpaper.id ===
                                    "grid"
                                    ? "24px 24px"
                                    : "cover",
                              }}
                            >
                              <span className="rounded-lg bg-black/30 px-2 py-1 backdrop-blur">
                                {
                                  wallpaper.name
                                }
                              </span>

                              {selected && (
                                <span className="absolute right-2 top-2 rounded-full bg-black/40 p-1">
                                  <Check className="h-3 w-3" />
                                </span>
                              )}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </section>

                  {/* FONT */}

                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <Type className="h-4 w-4 text-primary" />

                      <h3 className="text-sm font-semibold text-white">
                        Font
                      </h3>

                      <span className="ml-auto text-xs text-zinc-500">
                        200 choices
                      </span>
                    </div>

                    <Input
                      value={fontSearch}
                      onChange={(
                        event,
                      ) =>
                        setFontSearch(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Search fonts..."
                      className="mb-3"
                    />

                    <div className="max-h-56 overflow-y-auto rounded-2xl border border-white/10">
                      {CHAT_FONTS
                        .filter(
                          (
                            font,
                          ) =>
                            font.name
                              .toLowerCase()
                              .includes(
                                fontSearch
                                  .toLowerCase(),
                              ),
                        )
                        .map(
                          (
                            font,
                          ) => {
                            const selected =
                              appearance.fontId ===
                              font.id;

                            return (
                              <button
                                key={
                                  font.id
                                }
                                type="button"
                                onClick={() =>
                                  void updateAppearance(
                                    {
                                      fontId:
                                        font.id,
                                    },
                                  )
                                }
                                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-white hover:bg-white/10 ${
                                  selected
                                    ? "bg-white/10"
                                    : ""
                                }`}
                                style={{
                                  fontFamily:
                                    font.family,
                                }}
                              >
                                <span className="flex-1">
                                  {
                                    font.name
                                  }
                                </span>

                                {selected && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </button>
                            );
                          },
                        )}
                    </div>
                  </section>
                </>
              )}

              <button
                type="button"
                onClick={() =>
                  setAppearanceTarget(
                    null,
                  )
                }
                className="mt-5 w-full rounded-2xl bg-white/5 py-3 text-sm font-medium text-zinc-300 hover:bg-white/10"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}