import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  MoreVertical,
  Play,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { signedUrl } from "@/lib/whatsxup";

export const Route = createFileRoute("/_authenticated/xups/")({
  head: () => ({
    meta: [
      { title: "XUPs — WHATSXUP" },
      {
        name: "description",
        content:
          "Share photos, videos and moments with your WHATSXUP audience.",
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
  background: string | null;
  audience: string;
  audience_ids: string[] | null;
  created_at: string;
  expires_at: string;
  deleted_at: string | null;
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

type AudienceMode = "contacts" | "selected" | "private";

const REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

function isVideo(path: string | null) {
  if (!path) return false;
  return /\.(mp4|webm|mov|m4v)$/i.test(path);
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < 60_000) return "just now";

  if (diff < 3_600_000) {
    return `${Math.floor(diff / 60_000)}m`;
  }

  if (diff < 86_400_000) {
    return `${Math.floor(diff / 3_600_000)}h`;
  }

  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
  });
}

function XupMedia({
  path,
  className = "",
}: {
  path: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void signedUrl("xups", path).then((value) => {
      if (active) setUrl(value);
    });

    return () => {
      active = false;
    };
  }, [path]);

  if (!url) {
    return (
      <div
        className={`flex aspect-[9/16] items-center justify-center rounded-3xl bg-surface ${className}`}
      >
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isVideo(path)) {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className={`h-full w-full rounded-3xl object-cover ${className}`}
      />
    );
  }

  return (
    <img
      src={url}
      alt="XUP"
      loading="lazy"
      className={`h-full w-full rounded-3xl object-cover ${className}`}
    />
  );
}

function XupsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const fileInput = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  const [audienceMode, setAudienceMode] =
    useState<AudienceMode>("contacts");

  const [selectedContactIds, setSelectedContactIds] =
    useState<string[]>([]);

  const [activeUserId, setActiveUserId] =
    useState<string | null>(null);

  const [activeIndex, setActiveIndex] =
    useState(0);

  const [reactionPicker, setReactionPicker] =
    useState(false);

  const [showSettings, setShowSettings] =
    useState(false);

  const [now, setNow] = useState(Date.now());

  /*
   * ---------------------------------------------------------
   * LOAD XUPS
   * ---------------------------------------------------------
   */

  const {
    data: xups = [],
    isLoading,
  } = useQuery({
    queryKey: ["xups", user?.id],
    enabled: !!user,

    queryFn: async (): Promise<Xup[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("xups")
        .select("*")
        .is("deleted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      return (data ?? []) as Xup[];
    },
  });

  /*
   * ---------------------------------------------------------
   * CONTACTS
   * ---------------------------------------------------------
   */

  const { data: myContacts = [] } = useQuery({
    queryKey: ["xup-audience-contacts", user?.id],
    enabled: !!user,

    queryFn: async (): Promise<Contact[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("contacts")
        .select(
          "id, contact_id, profiles:contact_id(id, username, display_name, avatar_url)",
        )
        .eq("owner_id", user.id);

      if (error) throw error;

      return (data ?? []) as unknown as Contact[];
    },
  });

  /*
   * ---------------------------------------------------------
   * PROFILES
   * ---------------------------------------------------------
   */

  const userIds = Array.from(
    new Set(xups.map((xup) => xup.user_id)),
  );

  const { data: profiles = [] } = useQuery({
    queryKey: [
      "xup-profiles",
      userIds.join(","),
    ],
    enabled: userIds.length > 0,

    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url",
        )
        .in("id", userIds);

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

  /*
   * ---------------------------------------------------------
   * REACTIONS
   * ---------------------------------------------------------
   */

  const xupIds = xups.map((xup) => xup.id);

  const { data: reactions = [] } = useQuery({
    queryKey: [
      "xup-reactions",
      xupIds.join(","),
    ],
    enabled: xupIds.length > 0,

    queryFn: async () => {
      const { data, error } = await supabase
        .from("xup_reactions")
        .select("*")
        .in("xup_id", xupIds);

      if (error) throw error;

      return (data ?? []) as XupReaction[];
    },
  });

  /*
   * ---------------------------------------------------------
   * CLOCK
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * REALTIME
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("xups-feed")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "xups",
        },
        () => {
          void qc.invalidateQueries({
            queryKey: ["xups", user.id],
          });
        },
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "xup_reactions",
        },
        () => {
          void qc.invalidateQueries({
            queryKey: ["xup-reactions"],
          });
        },
      )

      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc]);

  /*
   * ---------------------------------------------------------
   * FILE PICKER
   * ---------------------------------------------------------
   */

  function chooseFile(
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
        "XUPs can only contain photos or videos.",
      );
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error(
        "XUP media must be under 50 MB.",
      );
      return;
    }

    setSelectedFile(file);
  }

  /*
   * ---------------------------------------------------------
   * CREATE XUP
   * ---------------------------------------------------------
   */

  async function createXup() {
    if (!user || !selectedFile) return;

    if (
      audienceMode === "selected" &&
      selectedContactIds.length === 0
    ) {
      toast.error(
        "Select at least one contact.",
      );
      return;
    }

    setUploading(true);

    try {
      const extension =
        selectedFile.name.includes(".")
          ? selectedFile.name
              .split(".")
              .pop()
              ?.toLowerCase() || "bin"
          : "bin";

      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
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

      const expiresAt = new Date(
        Date.now() +
          24 * 60 * 60 * 1000,
      ).toISOString();

      const audience =
        audienceMode === "private"
          ? "only"
          : audienceMode === "selected"
            ? "only"
            : "contacts";

      const audienceIds =
        audienceMode === "selected"
          ? selectedContactIds
          : [];

      const { error: insertError } =
        await supabase
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
              caption.trim() || null,
            audience,
            audience_ids: audienceIds,
            expires_at: expiresAt,
          });

      if (insertError) {
        await supabase.storage
          .from("xups")
          .remove([path]);

        throw insertError;
      }

      setSelectedFile(null);
      setCaption("");
      setAudienceMode("contacts");
      setSelectedContactIds([]);

      toast.success("XUP posted!");

      await qc.invalidateQueries({
        queryKey: ["xups", user.id],
      });
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

  /*
   * ---------------------------------------------------------
   * DELETE XUP
   * ---------------------------------------------------------
   */

  async function deleteXup(xup: Xup) {
    if (!user || xup.user_id !== user.id) {
      return;
    }

    const { error } = await supabase
      .from("xups")
      .update({
        deleted_at:
          new Date().toISOString(),
      })
      .eq("id", xup.id)
      .eq("user_id", user.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (xup.content) {
      await supabase.storage
        .from("xups")
        .remove([xup.content]);
    }

    closeViewer();

    toast.success("XUP deleted.");

    await qc.invalidateQueries({
      queryKey: ["xups", user.id],
    });
  }

  /*
   * ---------------------------------------------------------
   * VISIBLE XUPS
   * ---------------------------------------------------------
   */

  const visibleXups = useMemo(() => {
    return xups.filter(
      (xup) =>
        !xup.deleted_at &&
        new Date(xup.expires_at).getTime() >
          now,
    );
  }, [xups, now]);

  /*
   * ---------------------------------------------------------
   * GROUP XUPS BY USER
   *
   * Each person gets ONE story card.
   * Their individual XUPs remain inside
   * the viewer.
   * ---------------------------------------------------------
   */

  const groupedXups = useMemo(() => {
    const groups = new Map<string, Xup[]>();

    for (const xup of visibleXups) {
      const current =
        groups.get(xup.user_id) ?? [];

      current.push(xup);

      groups.set(
        xup.user_id,
        current,
      );
    }

    for (const [id, items] of groups) {
      items.sort(
        (a, b) =>
          new Date(
            a.created_at,
          ).getTime() -
          new Date(
            b.created_at,
          ).getTime(),
      );

      groups.set(id, items);
    }

    return groups;
  }, [visibleXups]);

  /*
   * ---------------------------------------------------------
   * CURRENT STORY
   * ---------------------------------------------------------
   */

  const activeStory = useMemo(() => {
    if (!activeUserId) return [];

    return (
      groupedXups.get(activeUserId) ?? []
    );
  }, [activeUserId, groupedXups]);

  const activeXup =
    activeStory[activeIndex] ?? null;

  /*
   * ---------------------------------------------------------
   * OPEN STORY
   * ---------------------------------------------------------
   */

  function openStory(userId: string) {
    const story =
      groupedXups.get(userId) ?? [];

    if (story.length === 0) return;

    setActiveUserId(userId);
    setActiveIndex(0);
    setReactionPicker(false);
    setShowSettings(false);

    void recordView(story[0]);
  }

  /*
   * ---------------------------------------------------------
   * CLOSE STORY
   * ---------------------------------------------------------
   */

  function closeViewer() {
    setActiveUserId(null);
    setActiveIndex(0);
    setReactionPicker(false);
    setShowSettings(false);
  }

  /*
   * ---------------------------------------------------------
   * RECORD VIEW
   * ---------------------------------------------------------
   */

  async function recordView(xup: Xup) {
    if (!user) return;

    if (xup.user_id === user.id) {
      return;
    }

    const { error } = await supabase
      .from("xup_views")
      .upsert(
        {
          xup_id: xup.id,
          viewer_id: user.id,
        },
        {
          onConflict:
            "xup_id,viewer_id",
          ignoreDuplicates: true,
        },
      );

    if (error) {
      console.error(
        "Could not record XUP view:",
        error,
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * NEXT XUP
   * ---------------------------------------------------------
   */

  function nextXup() {
    if (!activeUserId) return;

    const story =
      groupedXups.get(activeUserId) ?? [];

    if (
      activeIndex <
      story.length - 1
    ) {
      const nextIndex =
        activeIndex + 1;

      setActiveIndex(nextIndex);

      void recordView(
        story[nextIndex],
      );

      setReactionPicker(false);

      return;
    }

    /*
     * If this is the final XUP from this person,
     * move to the next person's story.
     */

    const people = Array.from(
      groupedXups.keys(),
    );

    const currentPosition =
      people.indexOf(activeUserId);

    if (
      currentPosition >= 0 &&
      currentPosition <
        people.length - 1
    ) {
      const nextUser =
        people[currentPosition + 1];

      const nextStory =
        groupedXups.get(nextUser) ?? [];

      setActiveUserId(nextUser);
      setActiveIndex(0);
      setReactionPicker(false);

      if (nextStory[0]) {
        void recordView(
          nextStory[0],
        );
      }

      return;
    }

    closeViewer();
  }

  /*
   * ---------------------------------------------------------
   * PREVIOUS XUP
   * ---------------------------------------------------------
   */

  function previousXup() {
    if (!activeUserId) return;

    const story =
      groupedXups.get(activeUserId) ?? [];

    if (activeIndex > 0) {
      const previousIndex =
        activeIndex - 1;

      setActiveIndex(previousIndex);

      void recordView(
        story[previousIndex],
      );

      setReactionPicker(false);

      return;
    }

    /*
     * If this is the first XUP from this person,
     * move to the previous person's final XUP.
     */

    const people = Array.from(
      groupedXups.keys(),
    );

    const currentPosition =
      people.indexOf(activeUserId);

    if (currentPosition > 0) {
      const previousUser =
        people[currentPosition - 1];

      const previousStory =
        groupedXups.get(previousUser) ??
        [];

      const previousIndex =
        Math.max(
          0,
          previousStory.length - 1,
        );

      setActiveUserId(previousUser);
      setActiveIndex(
        previousIndex,
      );
      setReactionPicker(false);

      if (previousStory[previousIndex]) {
        void recordView(
          previousStory[previousIndex],
        );
      }

      return;
    }

    closeViewer();
  }

  /*
   * ---------------------------------------------------------
   * REACTION
   * ---------------------------------------------------------
   */

  async function react(
    xup: Xup,
    emoji: string,
  ) {
    if (!user) return;

    setReactionPicker(false);

    const existing =
      reactions.find(
        (item) =>
          item.xup_id === xup.id &&
          item.user_id === user.id &&
          item.reaction === emoji,
      );

    if (existing) {
      const { error } =
        await supabase
          .from("xup_reactions")
          .delete()
          .eq("id", existing.id)
          .eq("user_id", user.id);

      if (error) {
        toast.error(error.message);
      }
    } else {
      const { error } =
        await supabase
          .from("xup_reactions")
          .insert({
            xup_id: xup.id,
            user_id: user.id,
            reaction: emoji,
          });

      if (error) {
        toast.error(error.message);
      }
    }

    await qc.invalidateQueries({
      queryKey: ["xup-reactions"],
    });
  }

  /*
   * ---------------------------------------------------------
   * REACTION COUNTS
   * ---------------------------------------------------------
   */

  function reactionCounts(xupId: string) {
    const counts = new Map<
      string,
      number
    >();

    for (const reaction of reactions) {
      if (reaction.xup_id !== xupId) {
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

  /*
   * ---------------------------------------------------------
   * HANDLE VIEWER CLICK
   *
   * Left side = previous
   * Right side = next
   * Center = nothing
   * ---------------------------------------------------------
   */

  function handleViewerClick(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    if (
      showSettings ||
      reactionPicker
    ) {
      return;
    }

    const target =
      event.target as HTMLElement;

    if (
      target.closest("button") ||
      target.closest("video") ||
      target.closest("input")
    ) {
      return;
    }

    const rect =
      event.currentTarget.getBoundingClientRect();

    const x =
      event.clientX - rect.left;

    if (x < rect.width * 0.35) {
      previousXup();
      return;
    }

    if (x > rect.width * 0.65) {
      nextXup();
    }
  }

  /*
   * ---------------------------------------------------------
   * KEYBOARD NAVIGATION
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!activeXup) return;

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "ArrowRight") {
        nextXup();
      }

      if (event.key === "ArrowLeft") {
        previousXup();
      }

      if (event.key === "Escape") {
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
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <AppShell>
      <PageHeader title="XUPs" />

      <div className="flex flex-1 flex-col">

        {/* CREATE XUP */}
        <section className="border-b border-border/60 p-4">
          <div className="rounded-3xl bg-surface p-4">

            <div className="mb-4 flex items-center gap-3">
              <UserAvatar
                path={null}
                name="Your XUP"
                size="sm"
              />

              <div>
                <p className="font-semibold">
                  Your XUP
                </p>

                <p className="text-xs text-muted-foreground">
                  Photos and videos disappear
                  after 24 hours.
                </p>
              </div>
            </div>

            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={chooseFile}
            />

            {selectedFile ? (
              <div className="space-y-3">

                <div className="relative overflow-hidden rounded-2xl bg-background">
                  {selectedFile.type.startsWith(
                    "video/",
                  ) ? (
                    <video
                      src={URL.createObjectURL(
                        selectedFile,
                      )}
                      controls
                      playsInline
                      className="max-h-80 w-full object-cover"
                    />
                  ) : (
                    <img
                      src={URL.createObjectURL(
                        selectedFile,
                      )}
                      alt="XUP preview"
                      className="max-h-80 w-full object-cover"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedFile(null)
                    }
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">
                    Who can see this XUP?
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        audienceMode ===
                        "contacts"
                          ? "default"
                          : "outline"
                      }
                      onClick={() => {
                        setAudienceMode(
                          "contacts",
                        );
                        setSelectedContactIds(
                          [],
                        );
                      }}
                    >
                      Contacts
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={
                        audienceMode ===
                        "selected"
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        setAudienceMode(
                          "selected",
                        )
                      }
                    >
                      Selected
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={
                        audienceMode ===
                        "private"
                          ? "default"
                          : "outline"
                      }
                      onClick={() => {
                        setAudienceMode(
                          "private",
                        );
                        setSelectedContactIds(
                          [],
                        );
                      }}
                    >
                      Only Me
                    </Button>
                  </div>

                  {audienceMode ===
                    "selected" && (
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-border p-2">
                      {myContacts.length ===
                      0 ? (
                        <p className="p-3 text-center text-sm text-muted-foreground">
                          You don't have any
                          contacts yet.
                        </p>
                      ) : (
                        myContacts.map(
                          (contact) => {
                            const selected =
                              selectedContactIds.includes(
                                contact.contact_id,
                              );

                            return (
                              <button
                                key={
                                  contact.contact_id
                                }
                                type="button"
                                onClick={() => {
                                  setSelectedContactIds(
                                    (
                                      current,
                                    ) =>
                                      selected
                                        ? current.filter(
                                            (
                                              id,
                                            ) =>
                                              id !==
                                              contact.contact_id,
                                          )
                                        : [
                                            ...current,
                                            contact.contact_id,
                                          ],
                                  );
                                }}
                                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted"
                              >
                                <UserAvatar
                                  path={
                                    contact
                                      .profiles
                                      .avatar_url
                                  }
                                  name={
                                    contact
                                      .profiles
                                      .display_name ||
                                    contact
                                      .profiles
                                      .username ||
                                    "User"
                                  }
                                  size="sm"
                                />

                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">
                                    {contact
                                      .profiles
                                      .display_name ||
                                      contact
                                        .profiles
                                        .username ||
                                      "User"}
                                  </p>

                                  <p className="truncate text-xs text-muted-foreground">
                                    @
                                    {contact
                                      .profiles
                                      .username ||
                                      "user"}
                                  </p>
                                </div>

                                {selected && (
                                  <Check className="h-5 w-5 text-primary" />
                                )}
                              </button>
                            );
                          },
                        )
                      )}
                    </div>
                  )}

                  {audienceMode ===
                    "selected" &&
                    selectedContactIds.length ===
                      0 && (
                      <p className="text-xs text-destructive">
                        Select at least one
                        contact.
                      </p>
                    )}

                  {audienceMode ===
                    "contacts" && (
                    <p className="text-xs text-muted-foreground">
                      Your XUP will be visible
                      to your contacts.
                    </p>
                  )}

                  {audienceMode ===
                    "private" && (
                    <p className="text-xs text-muted-foreground">
                      Only you will be able to
                      see this XUP.
                    </p>
                  )}
                </div>

                <Input
                  value={caption}
                  onChange={(event) =>
                    setCaption(
                      event.target.value,
                    )
                  }
                  placeholder="Add a caption..."
                  maxLength={500}
                />

                <Button
                  className="w-full"
                  disabled={
                    uploading ||
                    (audienceMode ===
                      "selected" &&
                      selectedContactIds.length ===
                        0)
                  }
                  onClick={() =>
                    void createXup()
                  }
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Post XUP
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  fileInput.current?.click()
                }
              >
                <ImagePlus className="h-5 w-5" />
                Create XUP
              </Button>
            )}
          </div>
        </section>

        {/* XUPS */}
        <section className="p-4">
          <div className="mb-4">
            <h2 className="text-lg font-bold">
              Recent XUPs
            </h2>

            <p className="text-xs text-muted-foreground">
              Tap someone's XUP to view their
              moments.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map(
                (item) => (
                  <div
                    key={item}
                    className="aspect-[9/16] animate-pulse rounded-3xl bg-surface"
                  />
                ),
              )}
            </div>
          ) : groupedXups.size === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl bg-surface px-6 py-12 text-center">
              <Camera className="mb-3 h-10 w-10 text-muted-foreground" />

              <h3 className="font-semibold">
                No XUPs yet
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Be the first person to share a
                moment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from(
                groupedXups.entries(),
              ).map(
                ([
                  ownerId,
                  story,
                ]) => {
                  const profile =
                    profileMap.get(
                      ownerId,
                    );

                  const latest =
                    story[
                      story.length - 1
                    ];

                  const counts =
                    reactionCounts(
                      latest.id,
                    );

                  return (
                    <button
                      key={ownerId}
                      type="button"
                      onClick={() =>
                        openStory(
                          ownerId,
                        )
                      }
                      className="group relative aspect-[9/16] overflow-hidden rounded-3xl bg-surface text-left shadow-panel"
                    >
                      <XupMedia
                        path={
                          latest.content ??
                          ""
                        }
                        className="transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* STORY COUNT */}
                      {story.length >
                        1 && (
                        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                          {story.length} XUPs
                        </span>
                      )}

                      {/* PROFILE */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3 pt-12 text-white">
                        <div className="flex items-center gap-2">
                          <div
                            onClick={(event) => {
                              event.stopPropagation();
                              openStory(
                                ownerId,
                              );
                            }}
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
                              size="sm"
                            />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">
                              {ownerId ===
                              user?.id
                                ? "Your XUP"
                                : profile?.display_name ||
                                  profile?.username ||
                                  "User"}
                            </p>

                            <p className="text-[10px] opacity-75">
                              {formatTime(
                                latest.created_at,
                              )}
                            </p>
                          </div>
                        </div>

                        {latest.background && (
                          <p className="mt-2 line-clamp-2 text-xs">
                            {
                              latest.background
                            }
                          </p>
                        )}

                        {counts.length >
                          0 && (
                          <div className="mt-2 flex gap-1">
                            {counts
                              .slice(
                                0,
                                3,
                              )
                              .map(
                                ([
                                  emoji,
                                  count,
                                ]) => (
                                  <span
                                    key={
                                      emoji
                                    }
                                    className="rounded-full bg-black/40 px-2 py-0.5 text-[10px]"
                                  >
                                    {
                                      emoji
                                    }{" "}
                                    {
                                      count
                                    }
                                  </span>
                                ),
                              )}
                          </div>
                        )}
                      </div>

                      {isVideo(
                        latest.content,
                      ) && (
                        <span className="absolute left-2 top-2 rounded-full bg-black/50 p-2 text-white">
                          <Play className="h-3 w-3 fill-current" />
                        </span>
                      )}
                    </button>
                  );
                },
              )}
            </div>
          )}
        </section>
      </div>

      {/* =====================================================
          STORY VIEWER
          ===================================================== */}

      {activeXup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-0 sm:p-3"
          onClick={handleViewerClick}
        >
          <div className="relative h-full max-h-[900px] w-full max-w-md overflow-hidden bg-black sm:rounded-3xl">

            {/* =================================================
                PROGRESS INDICATORS
                ================================================= */}

            <div className="absolute inset-x-0 top-0 z-30 flex gap-1 px-3 pt-3">
              {activeStory.map(
                (storyItem, index) => (
                  <div
                    key={storyItem.id}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
                  >
                    <div
                      className={`h-full rounded-full transition-all ${
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

            {/* MEDIA */}

            <XupMedia
              path={
                activeXup.content ?? ""
              }
            />

            {/* =================================================
                TOP BAR
                ================================================= */}

            <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/80 via-black/30 to-transparent p-4 pb-20 pt-7 text-white">

              <div className="flex items-center justify-between">

                <div className="flex min-w-0 items-center gap-3">

                  <button
                    type="button"
                    onClick={(event) => {
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

                  <button
                    type="button"
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                    className="min-w-0 text-left"
                  >
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
                  </button>
                </div>

                <div className="flex items-center gap-1">

                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-white hover:bg-white/10 hover:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowSettings(
                        (value) =>
                          !value,
                      );
                    }}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-white hover:bg-white/10 hover:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      closeViewer();
                    }}
                  >
                    <X className="h-5 w-5" />
                  </Button>

                </div>
              </div>
            </div>

            {/* =================================================
                LEFT / RIGHT VISUAL ARROWS
                ================================================= */}

            <button
              type="button"
              aria-label="Previous XUP"
              onClick={(event) => {
                event.stopPropagation();
                previousXup();
              }}
              className="absolute left-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-white opacity-50 transition hover:bg-black/50 hover:opacity-100"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>

            <button
              type="button"
              aria-label="Next XUP"
              onClick={(event) => {
                event.stopPropagation();
                nextXup();
              }}
              className="absolute right-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-white opacity-50 transition hover:bg-black/50 hover:opacity-100"
            >
              <ChevronRight className="h-7 w-7" />
            </button>

            {/* =================================================
                CAPTION
                ================================================= */}

            {activeXup.background && (
              <div className="absolute inset-x-0 bottom-20 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 pt-20 text-white">
                <p className="text-sm">
                  {activeXup.background}
                </p>
              </div>
            )}

            {/* =================================================
                SETTINGS MENU
                ================================================= */}

            {showSettings && (
              <div
                className="absolute right-3 top-16 z-50 w-64 overflow-hidden rounded-2xl bg-surface shadow-2xl"
                onClick={(event) =>
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

                <button
                  type="button"
                  className="w-full px-4 py-3 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    toast.info(
                      "XUP resharing will be connected to Supabase later.",
                    );
                    setShowSettings(false);
                  }}
                >
                  🔁 Reshare XUP
                </button>

                <button
                  type="button"
                  className="w-full px-4 py-3 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    toast.info(
                      "XUP privacy controls will be connected later.",
                    );
                    setShowSettings(false);
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
                    setShowSettings(false);
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
                      setShowSettings(false);

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

            {/* =================================================
                BOTTOM ACTIONS
                ================================================= */}

            <div
              className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-2 bg-black/70 p-3 backdrop-blur"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="relative flex-1">

                {reactionPicker && (
                  <div className="absolute bottom-14 left-0 flex gap-1 rounded-2xl bg-surface p-2 shadow-xl">
                    {REACTIONS.map(
                      (emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="rounded-full p-2 text-xl transition-transform hover:scale-125"
                          onClick={() =>
                            void react(
                              activeXup,
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

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    setReactionPicker(
                      (current) =>
                        !current,
                    )
                  }
                >
                  ❤️ React
                </Button>
              </div>

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

            {/* =================================================
                STORY POSITION
                ================================================= */}

            <div className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[10px] text-white">
              {activeIndex + 1} /{" "}
              {activeStory.length}
            </div>

          </div>
        </div>
      )}
    </AppShell>
  );
}