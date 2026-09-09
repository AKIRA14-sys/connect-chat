import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  MessageCircle,
  MoreVertical,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { signedUrl } from "@/lib/whatsxup";
export const Route = createFileRoute("/_authenticated/xups/")({
  head: () => ({
    meta: [
      { title: "XUPs — XUPPIN" },
      {
        name: "description",
        content:
          "Share photos, videos and moments with your XUPPIN audience.",
      },
    ],
  }),
  component: XupsPage,
});
type Xup = {
  id: string;
  user_id: string;
  kind: string;
  content: string | null;
  media_url?: string | null;
  caption?: string | null;
  background: string | null;
  audience: string;
  audience_ids: string[];
  created_at: string;
  expires_at: string;
  deleted_at: string | null;
  reshared_from?: string | null;
};
type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};
type XupReaction = {
  id: string;
  xup_id: string;
  user_id: string;
  reaction: string;
};
type XupView = {
  id: string;
  xup_id: string;
  viewer_id: string;
  created_at?: string;
};
type XupComment = {
  id: string;
  xup_id: string;
  user_id: string;
  comment: string;
  created_at: string;
};
type Contact = {
  id: string;
  contact_id: string;
  profiles: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
};
type AudienceMode =
  | "contacts"
  | "selected"
  | "private";
const REACTIONS = [
  "❤️",
  "😂",
  "😮",
  "😢",
  "🔥",
  "👍",
];
function isVideo(path: string | null) {
  if (!path) return false;
  return /\.(mp4|webm|mov|m4v)$/i.test(
    path,
  );
}
function formatTime(iso: string) {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60_000) {
    return "just now";
  }
  if (diff < 3_600_000) {
    return `${Math.floor(
      diff / 60_000,
    )}m`;
  }
  if (diff < 86_400_000) {
    return `${Math.floor(
      diff / 3_600_000,
    )}h`;
  }
  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
  });
}
function XupMedia({
  path,
  className = "",
  viewer = false,
  videoRef,
  onLongPressStart,
  onLongPressEnd,
  onEnded,
}: {
  path: string;
  className?: string;
  viewer?: boolean;
  videoRef?: React.MutableRefObject<
    HTMLVideoElement | null
  >;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
  onEnded?: () => void;
}) {
  const [url, setUrl] =
    useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void signedUrl(
      "xups",
      path,
    ).then((value) => {
      if (active) {
        setUrl(value);
      }
    });
    return () => {
      active = false;
    };
  }, [path]);
  if (!url) {
    return (
      <div
        className={`flex h-full min-h-[240px] w-full items-center justify-center bg-black ${className}`}
      >
        <Loader2 className="h-7 w-7 animate-spin text-white" />
      </div>
    );
  }
  if (isVideo(path)) {
    return (
      <video
        ref={(element) => {
          if (videoRef) {
            videoRef.current =
              element;
          }
        }}
        src={url}
        autoPlay={viewer}
        muted={false}
        loop={false}
        playsInline
        preload="auto"
        controls={false}
        onEnded={onEnded}
        onContextMenu={(event) =>
          event.preventDefault()
        }
        onPointerDown={
          onLongPressStart
        }
        onPointerUp={onLongPressEnd}
        onPointerCancel={
          onLongPressEnd
        }
        onPointerLeave={
          onLongPressEnd
        }
        className={`h-full w-full ${
          viewer
            ? "object-contain"
            : "object-cover"
        } ${className}`}
      />
    );
  }
  return (
    <img
      src={url}
      alt="XUP"
      draggable={false}
      loading={viewer ? "eager" : "lazy"}
      className={`h-full w-full ${
        viewer
          ? "object-contain"
          : "object-cover"
      } ${className}`}
    />
  );
}
function XupsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInput =
    useRef<HTMLInputElement | null>(
      null,
    );
  const viewerVideoRef =
    useRef<HTMLVideoElement | null>(
      null,
    );
  const longPressTimer =
    useRef<number | null>(null);
  const touchStartX =
    useRef<number | null>(null);
  const touchStartY =
    useRef<number | null>(null);
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);
  const [caption, setCaption] =
    useState("");
  const [uploading, setUploading] =
    useState(false);
  const [audienceMode, setAudienceMode] =
    useState<AudienceMode>(
      "contacts",
    );
  const [
    selectedContactIds,
    setSelectedContactIds,
  ] = useState<string[]>([]);
  const [
    activeUserId,
    setActiveUserId,
  ] = useState<string | null>(
    null,
  );
  const [
    activeIndex,
    setActiveIndex,
  ] = useState(0);
  const [
    reactionPicker,
    setReactionPicker,
  ] = useState(false);
  const [
    showSettings,
    setShowSettings,
  ] = useState(false);
  const [
    showViewers,
    setShowViewers,
  ] = useState(false);
  const [
    showComments,
    setShowComments,
  ] = useState(false);
  const [
    commentText,
    setCommentText,
  ] = useState("");
  const [now, setNow] =
    useState(Date.now());
  const {
    data: xups = [],
    isLoading,
  } = useQuery({
    queryKey: ["xups", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Xup[]> => {
      if (!user) return [];
      const { data, error } =
        await supabase
          .from("xups")
          .select("*")
          .is("deleted_at", null)
          .gt(
            "expires_at",
            new Date().toISOString(),
          )
          .order("created_at", {
            ascending: false,
          });
      if (error) {
        throw error;
      }
      return (data ??
        []) as Xup[];
    },
  });
  const {
    data: myContacts = [],
  } = useQuery({
    queryKey: [
      "xup-audience-contacts",
      user?.id,
    ],
    enabled: !!user,
    queryFn: async (): Promise<
      Contact[]
    > => {
      if (!user) return [];
      const { data, error } =
        await supabase
          .from("contacts")
          .select(
            "id, contact_id, profiles:contact_id(id, username, display_name, avatar_url)",
          )
          .eq(
            "owner_id",
            user.id,
          );
      if (error) {
        throw error;
      }
      return (data ??
        []) as unknown as Contact[];
    },
  });


  /* =========================================================
     REACTIONS
     ========================================================= */

  const xupIds = xups.map(
    (xup) => xup.id,
  );
  const {
    data: reactions = [],
  } = useQuery({
    queryKey: [
      "xup-reactions",
      xupIds.join(","),
    ],
    enabled:
      xupIds.length > 0,
    queryFn: async () => {
      const { data, error } =
        await supabase
          .from(
            "xup_reactions",
          )
          .select("*")
          .in(
            "xup_id",
            xupIds,
          );
      if (error) {
        throw error;
      }
      return (data ??
        []) as XupReaction[];
    },
  });
  const {
    data: xupViews = [],
  } = useQuery({
    queryKey: [
      "xup-views",
      xupIds.join(","),
    ],
    enabled:
      xupIds.length > 0,
    queryFn: async () => {
      const { data, error } =
        await supabase
          .from("xup_views")
          .select("*")
          .in(
            "xup_id",
            xupIds,
          );
      if (error) {
        console.error(
          "Could not load XUP views:",
          error,
        );
        return [];
      }
      return (data ??
        []) as XupView[];
    },
  });
  const {
    data: comments = [],
  } = useQuery({
    queryKey: [
      "xup-comments",
      xupIds.join(","),
    ],
    enabled:
      xupIds.length > 0,
    queryFn: async () => {
      const { data, error } =
        await supabase
          .from(
            "xup_comments",
          )
          .select("*")
          .in(
            "xup_id",
            xupIds,
          )
          .order(
            "created_at",
            {
              ascending: true,
            },
          );
      if (error) {
        console.error(
          "Could not load XUP comments:",
          error,
        );
        return [];
      }
      return (data ??
        []) as XupComment[];
    },
  });

  /* =========================================================
     PROFILES
     ========================================================= */

  const userIds = useMemo(() => {
    return Array.from(
      new Set([
        ...xups.map((xup) => xup.user_id),
        ...comments.map((comment) => comment.user_id),
        ...xupViews.map((view) => view.viewer_id),
        user?.id,
      ].filter(Boolean) as string[]),
    );
  }, [xups, comments, xupViews, user]);

  const {
    data: profiles = [],
  } = useQuery({
    queryKey: [
      "xup-profiles",
      userIds.join(","),
    ],
    enabled:
      userIds.length > 0,

    queryFn: async () => {
      const { data, error } =
        await supabase
          .from("profiles")
          .select(
            "id, username, display_name, avatar_url",
          )
          .in(
            "id",
            userIds,
          );

      if (error) {
        throw error;
      }

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

  /* =========================================================
     CLOCK
     ========================================================= */

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setNow(Date.now());
        },
        30_000,
      );
    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    const channel =
      supabase
        .channel("xups-feed")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "xups",
          },
          () => {
            void qc.invalidateQueries(
              {
                queryKey: [
                  "xups",
                  user.id,
                ],
              },
            );
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "xup_reactions",
          },
          () => {
            void qc.invalidateQueries(
              {
                queryKey: [
                  "xup-reactions",
                ],
              },
            );
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "xup_views",
          },
          () => {
            void qc.invalidateQueries(
              {
                queryKey: [
                  "xup-views",
                ],
              },
            );
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "xup_comments",
          },
          () => {
            void qc.invalidateQueries(
              {
                queryKey: [
                  "xup-comments",
                ],
              },
            );
          },
        )
        .subscribe();
    return () => {
      void supabase.removeChannel(
        channel,
      );
    };
  }, [user, qc]);
  function chooseFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];
    event.target.value = "";
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
        "XUPs can only contain photos or videos.",
      );
      return;
    }
    if (
      file.size >
      50 * 1024 * 1024
    ) {
      toast.error(
        "XUP media must be under 50 MB.",
      );
      return;
    }
    setSelectedFile(file);
  }
  async function createXup() {
    if (
      !user ||
      !selectedFile
    ) {
      return;
    }
    if (
      audienceMode ===
        "selected" &&
      selectedContactIds.length ===
        0
    ) {
      toast.error(
        "Select at least one contact.",
      );
      return;
    }
    setUploading(true);
    try {
      const extension =
        selectedFile.name.includes(
          ".",
        )
          ? selectedFile.name
              .split(".")
              .pop()
              ?.toLowerCase() ||
            "bin"
          : "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const {
        error: uploadError,
      } = await supabase.storage
        .from("xups")
        .upload(
          path,
          selectedFile,
          {
            contentType:
              selectedFile.type ||
              "application/octet-stream",
            upsert: false,
          },
        );
      if (uploadError) {
        throw uploadError;
      }
      const expiresAt =
        new Date(
          Date.now() +
            24 *
              60 *
              60 *
              1000,
        ).toISOString();
      const audience =
        audienceMode ===
        "private"
          ? "only"
          : audienceMode ===
              "selected"
            ? "only"
            : "contacts";
      const audienceIds =
        audienceMode ===
        "selected"
          ? selectedContactIds
          : [];
      const {
        error: insertError,
      } = await supabase
        .from("xups")
        .insert({
          user_id: user.id,
          kind: selectedFile.type.startsWith(
            "video/",
          )
            ? "video"
            : "image",
          content: path,
          background:
            caption.trim() ||
            null,
          audience,
          audience_ids:
            audienceIds,
          expires_at:
            expiresAt,
        });
      if (insertError) {
        await supabase.storage
          .from("xups")
          .remove([path]);
        throw insertError;
      }
      setSelectedFile(null);
      setCaption("");
      setAudienceMode(
        "contacts",
      );
      setSelectedContactIds(
        [],
      );
      toast.success(
        "XUP posted!",
      );
      await qc.invalidateQueries(
        {
          queryKey: [
            "xups",
            user.id,
          ],
        },
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create XUP.",
      );
    } finally {
      setUploading(false);
    }
  }
  async function deleteXup(
    xup: Xup,
  ) {
    if (
      !user ||
      xup.user_id !== user.id
    ) {
      return;
    }
    const { error } =
      await supabase
        .from("xups")
        .update({
          deleted_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          xup.id,
        )
        .eq(
          "user_id",
          user.id,
        );
    if (error) {
      toast.error(
        error.message,
      );
      return;
    }
    if (xup.content) {
      await supabase.storage
        .from("xups")
        .remove([
          xup.content,
        ]);
    }
    closeViewer();
    toast.success(
      "XUP deleted.",
    );
    await qc.invalidateQueries(
      {
        queryKey: [
          "xups",
          user.id,
        ],
      },
    );
  }
  const visibleXups =
    useMemo(() => {
      return xups.filter(
        (xup) =>
          !xup.deleted_at &&
          new Date(
            xup.expires_at,
          ).getTime() > now,
      );
    }, [xups, now]);
  const groupedXups =
    useMemo(() => {
      const groups =
        new Map<
          string,
          Xup[]
        >();
      for (const xup of visibleXups) {
        const current =
          groups.get(
            xup.user_id,
          ) ?? [];
        current.push(xup);
        groups.set(
          xup.user_id,
          current,
        );
      }
      for (const [
        id,
        items,
      ] of groups) {
        items.sort(
          (a, b) =>
            new Date(
              a.created_at,
            ).getTime() -
            new Date(
              b.created_at,
            ).getTime(),
        );
        groups.set(
          id,
          items,
        );
      }
      return groups;
    }, [visibleXups]);
  const people =
    useMemo(
      () =>
        Array.from(
          groupedXups.keys(),
        ),
      [groupedXups],
    );
  function hasViewedUser(
    userId: string,
  ) {
    const story =
      groupedXups.get(
        userId,
      ) ?? [];
    if (
      story.length ===
      0
    ) {
      return false;
    }
    return story.every(
      (xup) =>
        xupViews.some(
          (view) =>
            view.xup_id ===
              xup.id &&
            view.viewer_id ===
              user?.id,
        ),
    );
  }
  const activeStory =
    useMemo(() => {
      if (!activeUserId) {
        return [];
      }
      return (
        groupedXups.get(
          activeUserId,
        ) ?? []
      );
    }, [
      activeUserId,
      groupedXups,
    ]);
  const activeXup =
    activeStory[
      activeIndex
    ] ?? null;
  function openStory(
    userId: string,
  ) {
    const story =
      groupedXups.get(
        userId,
      ) ?? [];
    if (
      story.length ===
      0
    ) {
      return;
    }
    setActiveUserId(
      userId,
    );
    setActiveIndex(0);
    setReactionPicker(
      false,
    );
    setShowSettings(
      false,
    );
    setShowViewers(
      false,
    );
    setShowComments(
      false,
    );
    void recordView(
      story[0],
    );
  }
  function closeViewer() {
    if (
      longPressTimer.current
    ) {
      window.clearTimeout(
        longPressTimer.current,
      );
      longPressTimer.current =
        null;
    }
    setActiveUserId(
      null,
    );
    setActiveIndex(0);
    setReactionPicker(
      false,
    );
    setShowSettings(
      false,
    );
    setShowViewers(
      false,
    );
    setShowComments(
      false,
    );
  }
  async function recordView(
    xup:
      | Xup
      | undefined,
  ) {
    if (
      !user ||
      !xup
    ) {
      return;
    }
    if (
      xup.user_id ===
      user.id
    ) {
      return;
    }
    const { error } =
      await supabase
        .from("xup_views")
        .upsert(
          {
            xup_id:
              xup.id,
            viewer_id:
              user.id,
          },
          {
            onConflict:
              "xup_id,viewer_id",
            ignoreDuplicates:
              true,
          },
        );
    if (error) {
      console.error(
        "Could not record XUP view:",
        error,
      );
    }
    void qc.invalidateQueries(
      {
        queryKey: [
          "xup-views",
        ],
      },
    );
  }
  /*
     TAP LEFT/RIGHT = SAME PERSON'S XUPS.
     AT THE EDGES, ROLLS OVER INTO THE
     PREVIOUS/NEXT PERSON'S STORY.
  */
  function tapNextXup() {
    if (
      !activeUserId
    ) {
      return;
    }
    const story =
      groupedXups.get(
        activeUserId,
      ) ?? [];
    if (
      activeIndex <
      story.length - 1
    ) {
      const next =
        activeIndex + 1;
      setActiveIndex(
        next,
      );
      setReactionPicker(
        false,
      );
      setShowComments(
        false,
      );
      void recordView(
        story[next],
      );
      return;
    }
    // End of this person's story — roll over to the next person.
    swipeNextUser();
  }
  function tapPreviousXup() {
    if (
      !activeUserId
    ) {
      return;
    }
    const story =
      groupedXups.get(
        activeUserId,
      ) ?? [];
    if (
      activeIndex > 0
    ) {
      const previous =
        activeIndex - 1;
      setActiveIndex(
        previous,
      );
      setReactionPicker(
        false,
      );
      setShowComments(
        false,
      );
      void recordView(
        story[previous],
      );
      return;
    }
    // Start of this person's story — roll back to the previous person.
    swipePreviousUser();
  }
  /*
     USED BY: THE 20s PHOTO TIMER AND
     THE VIDEO onEnded HANDLER.
  */
  function advanceStory() {
    if (
      !activeUserId
    ) {
      return;
    }
    const story =
      groupedXups.get(
        activeUserId,
      ) ?? [];
    // Next XUP in the same person's story.
    if (
      activeIndex <
      story.length - 1
    ) {
      const next =
        activeIndex + 1;
      setActiveIndex(
        next,
      );
      setReactionPicker(
        false,
      );
      setShowComments(
        false,
      );
      void recordView(
        story[next],
      );
      return;
    }
    // No more XUPs for this person — move to the next person.
    const current =
      people.indexOf(
        activeUserId,
      );
    if (
      current >= 0 &&
      current <
        people.length - 1
    ) {
      const nextUser =
        people[
          current + 1
        ];
      const nextStory =
        groupedXups.get(
          nextUser,
        ) ?? [];
      if (
        nextStory.length >
        0
      ) {
        setActiveUserId(
          nextUser,
        );
        setActiveIndex(0);
        setReactionPicker(
          false,
        );
        setShowComments(
          false,
        );
        void recordView(
          nextStory[0],
        );
        return;
      }
    }
    // No more people either — close the viewer.
    closeViewer();
  }
  /*
     SWIPE LEFT = NEXT PERSON
     SWIPE RIGHT = PREVIOUS PERSON
  */
  function swipeNextUser() {
    if (
      !activeUserId
    ) {
      return;
    }
    const current =
      people.indexOf(
        activeUserId,
      );
    if (
      current < 0 ||
      current >=
        people.length - 1
    ) {
      closeViewer();
      return;
    }
    const nextUser =
      people[
        current + 1
      ];
    const nextStory =
      groupedXups.get(
        nextUser,
      ) ?? [];
    if (
      nextStory.length ===
      0
    ) {
      closeViewer();
      return;
    }
    setActiveUserId(
      nextUser,
    );
    setActiveIndex(0);
    setReactionPicker(
      false,
    );
    setShowComments(
      false,
    );
    void recordView(
      nextStory[0],
    );
  }
  function swipePreviousUser() {
    if (
      !activeUserId
    ) {
      return;
    }
    const current =
      people.indexOf(
        activeUserId,
      );
    if (
      current <= 0
    ) {
      return;
    }
    const previousUser =
      people[
        current - 1
      ];
    const previousStory =
      groupedXups.get(
        previousUser,
      ) ?? [];
    if (
      previousStory.length ===
      0
    ) {
      return;
    }
    const lastIndex =
      previousStory.length -
      1;
    setActiveUserId(
      previousUser,
    );
    setActiveIndex(
      lastIndex,
    );
    setReactionPicker(
      false,
    );
    setShowComments(
      false,
    );
    void recordView(
      previousStory[
        lastIndex
      ],
    );
  }
  function handleTouchStart(
    event: React.TouchEvent,
  ) {
    if (
      showSettings ||
      showViewers ||
      showComments ||
      reactionPicker
    ) {
      return;
    }
    const touch =
      event.touches[0];
    if (!touch) return;
    touchStartX.current =
      touch.clientX;
    touchStartY.current =
      touch.clientY;
  }
  function handleTouchEnd(
    event: React.TouchEvent,
  ) {
    if (
      touchStartX.current ===
        null ||
      touchStartY.current ===
        null
    ) {
      return;
    }
    const touch =
      event.changedTouches[0];
    if (!touch) {
      return;
    }
    const dx =
      touch.clientX -
      touchStartX.current;
    const dy =
      touch.clientY -
      touchStartY.current;
    touchStartX.current =
      null;
    touchStartY.current =
      null;
    if (
      Math.abs(dx) <
        60 ||
      Math.abs(dx) <
        Math.abs(dy)
    ) {
      return;
    }
    if (dx < 0) {
      swipeNextUser();
    } else {
      swipePreviousUser();
    }
  }
  function startVideoLongPress() {
    if (
      !viewerVideoRef.current
    ) {
      return;
    }
    if (
      longPressTimer.current
    ) {
      window.clearTimeout(
        longPressTimer.current,
      );
    }
    longPressTimer.current =
      window.setTimeout(
        () => {
          viewerVideoRef.current?.pause();
        },
        180,
      );
  }
  function endVideoLongPress() {
    if (
      longPressTimer.current
    ) {
      window.clearTimeout(
        longPressTimer.current,
      );
      longPressTimer.current =
        null;
    }
    const video =
      viewerVideoRef.current;
    if (
      video &&
      video.paused &&
      video.currentTime <
        video.duration
    ) {
      void video.play().catch(
        () => {},
      );
    }
  }
  /*
     TAP RIGHT HALF = NEXT XUP (ROLLS OVER TO NEXT PERSON)
     TAP LEFT HALF = PREVIOUS XUP (ROLLS OVER TO PREVIOUS PERSON)
  */
  function handleViewerClick(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    if (
      showSettings ||
      showViewers ||
      showComments ||
      reactionPicker
    ) {
      return;
    }
    const target =
      event.target as HTMLElement;
    if (
      target.closest(
        "button",
      ) ||
      target.closest(
        "video",
      ) ||
      target.closest(
        "input",
      ) ||
      target.closest(
        "textarea",
      )
    ) {
      return;
    }
    const rect =
      event.currentTarget.getBoundingClientRect();
    const x =
      event.clientX -
      rect.left;
    if (
      x <
      rect.width * 0.5
    ) {
      tapPreviousXup();
    } else {
      tapNextXup();
    }
  }
  async function react(
    xup: Xup,
    emoji: string,
  ) {
    if (!user) {
      return;
    }
    setReactionPicker(
      false,
    );
    const existing =
      reactions.find(
        (item) =>
          item.xup_id ===
            xup.id &&
          item.user_id ===
            user.id &&
          item.reaction ===
            emoji,
      );
    if (existing) {
      const { error } =
        await supabase
          .from(
            "xup_reactions",
          )
          .delete()
          .eq(
            "id",
            existing.id,
          )
          .eq(
            "user_id",
            user.id,
          );
      if (error) {
        toast.error(
          error.message,
        );
      }
    } else {
      const { error } =
        await supabase
          .from(
            "xup_reactions",
          )
          .insert({
            xup_id:
              xup.id,
            user_id:
              user.id,
            reaction:
              emoji,
          });
      if (error) {
        toast.error(
          error.message,
        );
      }
    }
    await qc.invalidateQueries(
      {
        queryKey: [
          "xup-reactions",
        ],
      },
    );
  }
  function reactionCounts(
    xupId: string,
  ) {
    const counts =
      new Map<
        string,
        number
      >();
    for (const reaction of reactions) {
      if (
        reaction.xup_id !==
        xupId
      ) {
        continue;
      }
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
  const activeComments =
    useMemo(() => {
      if (!activeXup) {
        return [];
      }
      return comments.filter(
        (comment) =>
          comment.xup_id ===
          activeXup.id,
      );
    }, [
      comments,
      activeXup,
    ]);
  async function reshareXup() {
    if (!user || !activeXup) {
      return;
    }
    const original = activeXup;
    // Match createXup: DB expects expires_at (+ audience_ids).
    // Missing expires_at was the main reshare failure after Lovable's column work.
    const expiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    ).toISOString();
    const kind =
      original.kind === "video"
        ? "video"
        : original.kind === "image"
          ? "image"
          : "text";
    const { error } = await supabase.from("xups").insert({
      user_id: user.id,
      kind,
      content: original.content ?? null,
      media_url: original.media_url ?? null,
      caption: original.caption ?? null,
      background: original.background ?? null,
      audience: "contacts",
      audience_ids: [] as string[],
      expires_at: expiresAt,
      reshared_from: original.reshared_from ?? original.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("XUP reshared to your contacts.");
    await qc.invalidateQueries({
      queryKey: ["xups", user.id],
    });
  }
  async function submitComment() {
    if (
      !user ||
      !activeXup ||
      !commentText.trim()
    ) {
      return;
    }
    const text =
      commentText.trim();
    setCommentText("");
    const { error } =
      await supabase
        .from(
          "xup_comments",
        )
        .insert({
          xup_id:
            activeXup.id,
          user_id:
            user.id,
          comment:
            text,
        });
    if (error) {
      toast.error(
        error.message,
      );
      setCommentText(text);
      return;
    }
    await qc.invalidateQueries({
      queryKey: ["xup-comments"],
    });
    await qc.invalidateQueries({
      queryKey: ["xups", user.id],
    });
  }
  const activeViewers =
    useMemo(() => {
      if (!activeXup) {
        return [];
      }
      return xupViews.filter(
        (view) =>
          view.xup_id ===
          activeXup.id,
      );
    }, [
      xupViews,
      activeXup,
    ]);
  const viewerProfiles =
    useMemo(() => {
      return activeViewers
        .map((view) =>
          profileMap.get(
            view.viewer_id,
          ),
        )
        .filter(
          (
            profile,
          ): profile is Profile =>
            !!profile,
        );
    }, [
      activeViewers,
      profileMap,
    ]);
  useEffect(() => {
    if (!activeXup) {
      return;
    }
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
        "ArrowRight"
      ) {
        tapNextXup();
      }
      if (
        event.key ===
        "ArrowLeft"
      ) {
        tapPreviousXup();
      }
      if (
        event.key ===
        "Escape"
      ) {
        closeViewer();
      }
    }
    window.addEventListener(
      "keydown",
      handleKeyDown,
    );
    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    activeXup,
    activeUserId,
    activeIndex,
    groupedXups,
  ]);
  /*
     PHOTO AUTO-ADVANCE TIMER (20s)
     onEnded HANDLER PASSED TO XupMedia.
  */
  useEffect(() => {
    if (!activeXup) {
      return;
    }
    if (
      showSettings ||
      showViewers ||
      showComments
    ) {
      return;
    }
    if (activeXup.kind === "video") {
      return;
    }
    const timer =
      window.setTimeout(() => {
        advanceStory();
      }, 20_000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    activeXup?.id,
    showSettings,
    showViewers,
    showComments,
  ]);
  return (
    <AppShell>
      <PageHeader title="XUPs" />
      <div className="flex flex-1 flex-col">
        {/* CREATE_XUP_START */}
        <section className="border-b border-border/60 p-4">
          <Drawer>
            <DrawerTrigger asChild>
              <Button className="w-full rounded-2xl h-14 text-lg font-semibold shadow-sm transition-all active:scale-[0.98]" variant="default">
                <ImagePlus className="mr-2 h-5 w-5" />
                Create XUP
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[90vh]">
              <DrawerHeader className="flex flex-col items-center gap-2">
                <DrawerTitle className="text-2xl font-bold">Create XUP</DrawerTitle>
                <DrawerDescription>Share a moment with your XUPPIN audience</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-6 pt-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  onChange={chooseFile}
                />
                {selectedFile ? (
                  <div className="space-y-6">
                    <div className="relative overflow-hidden rounded-3xl bg-background ring-1 ring-border">
                      {selectedFile.type.startsWith("video/") ? (
                        <video
                          src={URL.createObjectURL(selectedFile)}
                          controls
                          playsInline
                          className="max-h-[60vh] w-full object-contain"
                        />
                      ) : (
                        <img
                          src={URL.createObjectURL(selectedFile)}
                          alt="XUP preview"
                          className="max-h-[60vh] w-full object-contain"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-bold tracking-tight">Who can see this XUP?</p>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={audienceMode === "contacts" ? "default" : "outline"}
                          className="rounded-xl h-10"
                          onClick={() => {
                            setAudienceMode("contacts");
                            setSelectedContactIds([]);
                          }}
                        >
                          Contacts
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={audienceMode === "selected" ? "default" : "outline"}
                          className="rounded-xl h-10"
                          onClick={() => setAudienceMode("selected")}
                        >
                          Selected
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={audienceMode === "private" ? "default" : "outline"}
                          className="rounded-xl h-10"
                          onClick={() => {
                            setAudienceMode("private");
                            setSelectedContactIds([]);
                          }}
                        >
                          Only Me
                        </Button>
                      </div>
                      {audienceMode === "selected" && (
                        <div className="max-h-40 space-y-1 overflow-y-auto rounded-2xl border border-border bg-muted/30 p-2">
                          {myContacts.length === 0 ? (
                            <p className="p-3 text-center text-sm text-muted-foreground">
                              You don't have any contacts yet.
                            </p>
                          ) : (
                            myContacts.map((contact) => {
                              const selected = selectedContactIds.includes(contact.contact_id);
                              return (
                                <button
                                  key={contact.contact_id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedContactIds((current) =>
                                      selected
                                        ? current.filter((id) => id !== contact.contact_id)
                                        : [...current, contact.contact_id]
                                    );
                                  }}
                                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-muted"
                                >
                                  <UserAvatar
                                    path={contact.profiles.avatar_url}
                                    name={contact.profiles.display_name || contact.profiles.username || "User"}
                                    size="sm"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                      {contact.profiles.display_name || contact.profiles.username || "User"}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      @{contact.profiles.username || "user"}
                                    </p>
                                  </div>
                                  {selected && <Check className="h-4 w-4 text-primary" />}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                      {audienceMode === "contacts" && (
                        <p className="px-1 text-xs text-muted-foreground">
                          Visible to your contacts.
                        </p>
                      )}
                      {audienceMode === "private" && (
                        <p className="px-1 text-xs text-muted-foreground">
                          Only you will be able to see this XUP.
                        </p>
                      )}
                      {audienceMode === "selected" && selectedContactIds.length === 0 && (
                        <p className="px-1 text-xs text-destructive">
                          Select at least one contact.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-bold tracking-tight">Caption</p>
                      <Input
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Add a caption..."
                        maxLength={500}
                        className="rounded-xl h-12"
                      />
                    </div>
                    <Button
                      className="w-full h-12 rounded-xl text-lg font-semibold shadow-md"
                      disabled={uploading || (audienceMode === "selected" && selectedContactIds.length === 0)}
                      onClick={() => void createXup()}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Posting...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-5 w-5" />
                          Post XUP
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-16 rounded-2xl text-lg font-medium border-dashed border-2"
                    onClick={() => fileInput.current?.click()}
                  >
                    <ImagePlus className="mr-2 h-6 w-6" />
                    Select Media
                  </Button>
                )}
              </div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="ghost" className="w-full">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </section>
        <section className="p-4">
          <div className="mb-4">
            <h2 className="text-lg font-bold">
              Recent XUPs
            </h2>
            <p className="text-xs text-muted-foreground">
              Swipe through
              people's XUPs.
            </p>
          </div>
          {isLoading ? (
            <div className="flex gap-4 overflow-hidden">
              {[
                0,
                1,
                2,
                3,
                4,
              ].map((item) => (
                <div
                  key={item}
                  className="h-28 w-24 shrink-0 animate-pulse rounded-3xl bg-surface"
                />
              ))}
            </div>
          ) : groupedXups.size ===
            0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl bg-surface px-6 py-12 text-center">
              <Camera className="mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">
                No XUPs yet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Be the first
                person to
                share a
                moment.
              </p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
              {people.map(
                (ownerId) => {
                  const story =
                    groupedXups.get(
                      ownerId,
                    ) ?? [];
                  if (
                    story.length ===
                    0
                  ) {
                    return null;
                  }
                  const profile =
                    profileMap.get(
                      ownerId,
                    );
                  const latest =
                    story[
                      story.length -
                        1
                    ];
                  const viewed =
                    hasViewedUser(
                      ownerId,
                    );
                  return (
                    <button
                      key={
                        ownerId
                      }
                      type="button"
                      onClick={() =>
                        openStory(
                          ownerId,
                        )
                      }
                      className="flex w-24 shrink-0 flex-col items-center gap-2"
                    >
                      <div
                        className={`rounded-full p-[3px] ${
                          viewed
                            ? "bg-transparent"
                            : "bg-blue-500"
                        }`}
                      >
                        <div className="rounded-full bg-background p-[2px]">
                          <UserAvatar
                            path={
                              profile?.avatar_url ??
                              null
                            }
                            name={
                              profile?.display_name ||
                              profile?.username ||
                              "User"
                            }
                            size="lg"
                          />
                        </div>
                      </div>
                      <div className="w-full text-center">
                        <p className="truncate text-xs font-semibold">
                          {ownerId ===
                          user?.id
                            ? "Your XUP"
                            : profile?.display_name ||
                              profile?.username ||
                              "User"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {story.length >
                          1
                            ? `${story.length} XUPs`
                            : formatTime(
                                latest.created_at,
                              )}
                        </p>
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          )}
        </section>
      </div>
      {activeXup && (
        <div
          className="fixed inset-0 z-50 bg-black"
          onClick={
            handleViewerClick
          }
          onTouchStart={
            handleTouchStart
          }
          onTouchEnd={
            handleTouchEnd
          }
        >
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
            <div className="absolute inset-x-0 top-0 z-40 flex gap-1 px-3 pt-3">
              {activeStory.map(
                (
                  storyItem,
                  index,
                ) => (
                  <div
                    key={
                      storyItem.id
                    }
                    className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
                  >
                    <div
                      className={`h-full rounded-full ${
                        index <=
                        activeIndex
                          ? "w-full bg-white"
                          : "w-0"
                      }`}
                    />
                  </div>
                ),
              )}
            </div>
            <XupMedia
              path={
                activeXup.content ??
                ""
              }
              viewer
              videoRef={
                viewerVideoRef
              }
              onLongPressStart={
                startVideoLongPress
              }
              onLongPressEnd={
                endVideoLongPress
              }
              onEnded={
                advanceStory
              }
            />
            <div className="absolute inset-x-0 top-0 z-30 bg-black/40 p-4 pb-20 pt-8 text-white">
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={(
                      event,
                    ) => {
                      event.stopPropagation();
                      if (
                        activeUserId
                      ) {
                        openStory(
                          activeUserId,
                        );
                      }
                    }}
                    className="rounded-full"
                  >
                    <UserAvatar
                      path={
                        profileMap.get(
                          activeXup.user_id,
                        )?.avatar_url ??
                        null
                      }
                      name={
                        profileMap.get(
                          activeXup.user_id,
                        )?.display_name ||
                        profileMap.get(
                          activeXup.user_id,
                        )?.username ||
                        "User"
                      }
                      size="sm"
                    />
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {activeXup.user_id ===
                      user?.id
                        ? "Your XUP"
                        : profileMap.get(
                            activeXup.user_id,
                          )?.display_name ||
                          profileMap.get(
                            activeXup.user_id,
                          )?.username ||
                          "User"}
                    </p>
                    <p className="text-[11px] opacity-70">
                      {formatTime(
                        activeXup.created_at,
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-white hover:bg-white/10 hover:text-white"
                    onClick={(
                      event,
                    ) => {
                      event.stopPropagation();
                      setShowSettings(
                        (value) =>
                          !value,
                      );
                      setShowViewers(
                        false,
                      );
                      setShowComments(
                        false,
                      );
                    }}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-white hover:bg-white/10 hover:text-white"
                    onClick={(
                      event,
                    ) => {
                      event.stopPropagation();
                      closeViewer();
                    }}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
            {activeXup.caption && (
              <div className="absolute inset-x-4 bottom-24 z-20 flex justify-center">
                <div className="bg-black/40 px-4 py-2 rounded-lg text-white max-w-md">
                  <p className="text-sm text-center">
                    {activeXup.caption}
                  </p>
                </div>
              </div>
            )}
            {showSettings && (
              <div
                className="absolute right-3 top-16 z-50 w-64 overflow-hidden rounded-2xl bg-surface shadow-2xl"
                onClick={(
                  event,
                ) =>
                  event.stopPropagation()
                }
              >
                <div className="border-b border-border px-4 py-3">
                  <p className="font-semibold">
                    XUP Settings
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Story options
                  </p>
                </div>
                {activeXup.user_id ===
                  user?.id && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setShowSettings(
                        false,
                      );
                      setShowViewers(
                        true,
                      );
                    }}
                  >
                    <Users className="h-4 w-4" />
                    Viewers
                  </button>
                )}
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setShowSettings(
                      false,
                    );
                    setShowComments(
                      true,
                    );
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Comments
                </button>
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setShowSettings(
                      false,
                    );
                    void reshareXup();
                  }}
                >
                  🔁 Reshare XUP
                </button>
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    toast.info(
                      "Privacy controls are available through the XUP audience settings.",
                    );
                    setShowSettings(
                      false,
                    );
                  }}
                >
                  🔒 Privacy
                </button>
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    toast.info(
                      "Mute controls will be connected later.",
                    );
                    setShowSettings(
                      false,
                    );
                  }}
                >
                  🔇 Mute XUPs
                </button>
                {activeXup.user_id ===
                  user?.id && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-destructive hover:bg-muted"
                    onClick={() => {
                      setShowSettings(
                        false,
                      );
                      void deleteXup(
                        activeXup,
                      );
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete XUP
                  </button>
                )}
              </div>
            )}
            {showViewers && (
              <div
                className="absolute inset-x-0 bottom-0 z-50 max-h-[65%] overflow-y-auto rounded-t-3xl bg-surface p-4 text-foreground shadow-2xl"
                onClick={(
                  event,
                ) =>
                  event.stopPropagation()
                }
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">
                      XUP Viewers
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {activeViewers.length}{" "}
                      {activeViewers.length ===
                      1
                        ? "view"
                        : "views"}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setShowViewers(
                        false,
                      )
                    }
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                {viewerProfiles.length ===
                0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nobody has viewed
                    this XUP yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {viewerProfiles.map(
                      (
                        profile,
                      ) => (
                        <div
                          key={
                            profile.id
                          }
                          className="flex items-center gap-3 rounded-2xl p-2"
                        >
                          <UserAvatar
                            path={
                              profile.avatar_url
                            }
                            name={
                              profile.display_name ||
                              profile.username ||
                              "User"
                            }
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {profile.display_name ||
                                profile.username ||
                                "User"}
                            </p>
                            {profile.username && (
                              <p className="text-xs text-muted-foreground">
                                @
                                {
                                  profile.username
                                }
                              </p>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            )}
            <div
              className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[90%] flex-col rounded-t-3xl bg-surface text-foreground shadow-2xl transition-all duration-500 ease-out ${
                showComments ? "translate-y-0" : "translate-y-full pointer-events-none"
              }`}
              onClick={(
                event,
              ) =>
                event.stopPropagation()
              }
            >
              <div className="flex items-center justify-between border-b border-border p-4">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-bold">Comments</h3>
                    <p className="text-xs text-muted-foreground">
                      {activeComments.length} comments
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setShowComments(
                      false,
                    )
                  }
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {activeComments.length ===
                0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No comments yet. Be the first to react!
                  </div>
                ) : (
                  <div className="space-y-6">
                    {activeComments.map(
                      (
                        comment,
                      ) => {
                        const profile =
                          profileMap.get(
                            comment.user_id,
                          );
                        return (
                          <div
                            key={
                              comment.id
                            }
                            className="flex gap-3"
                          >
                            <UserAvatar
                              path={
                                profile?.avatar_url ??
                                null
                              }
                              name={
                                profile?.display_name ||
                                profile?.username ||
                                "User"
                              }
                              size="md"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-bold">
                                  {profile?.display_name ||
                                    profile?.username ||
                                    "User"}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {formatTime(
                                    comment.created_at,
                                  )}
                                </p>
                              </div>
                              <p className="mt-1 break-words text-sm leading-relaxed">
                                {
                                  comment.comment
                                }
                              </p>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 border-t border-border p-4 bg-background/50">
                <Input
                  value={
                    commentText
                  }
                  onChange={(
                    event,
                    ) =>
                      setCommentText(
                        event
                          .target
                          .value,
                    )
                  }
                  placeholder="Write a comment..."
                  onKeyDown={(
                    event,
                    ) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        void submitComment();
                      }
                    }}
                  className="rounded-xl h-12"
                />
                <Button
                  size="icon"
                  className="h-12 w-12 rounded-xl"
                  onClick={() =>
                    void submitComment()
                  }
                  disabled={
                    !commentText.trim()
                  }
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
                  <div
                    className="absolute bottom-8 inset-x-0 z-30 flex items-center justify-center gap-2 px-4"
                    onClick={(event) => event.stopPropagation()}
                  >
                  <div className="relative flex-1">
                    {reactionPicker && (
                      <div className="absolute bottom-14 left-0 flex gap-1 rounded-2xl bg-surface p-2 shadow-xl">
                        {REACTIONS.map(
                          (
                            emoji,
                          ) => (
                            <button
                              key={
                                emoji
                              }
                              type="button"
                              className="rounded-full p-2 text-xl transition-transform hover:scale-125"
                              onClick={() =>
                                void react(
                                  activeXup,
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
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        setReactionPicker(
                          (
                            current,
                          ) =>
                            !current,
                        )
                      }
                    >
                      ❤️ React
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setShowComments(
                        true,
                      )
                    }
                  >
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                  {activeXup.user_id ===
                    user?.id && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setShowViewers(
                          true,
                        )
                      }
                    >
                      <Users className="h-5 w-5" />
                    </Button>
                  )}
                  {activeXup.user_id ===
                    user?.id && (
                    <Button
                      variant="destructive"
                      size="icon"
                      title="Delete XUP"
                      onClick={() =>
                        void deleteXup(
                          activeXup,
                        )
                      }
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                </div>
            {!showViewers &&
              !showComments && (
                <div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[10px] text-white">
                  {activeIndex + 1}{" "}
                  /{" "}
                  {activeStory.length}
                </div>
              )}
          </div>
        </div>
      )}
    </AppShell>
  );
}