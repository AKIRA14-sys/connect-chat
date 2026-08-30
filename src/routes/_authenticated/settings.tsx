import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Palette,
  Shield,
  ShieldCheck,
  Upload,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin, useProfile } from "@/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { uploadAvatar } from "@/lib/whatsxup";
import {
  getMyCollectibles,
  setFeaturedGift,
  type GiftCollectible,
} from "@/lib/gaming.functions";
import { formatSerial, giftEmoji } from "@/lib/giftMessage";
import {
  BUILTIN_WALLPAPERS,
  GLOBAL_CHAT_ID,
  clearChatWallpaper,
  getLocalChatCustomization,
  getChatWallpaperMedia,
  setChatWallpaperBuiltin,
  setChatWallpaperCustomFile,
  type ChatCustomization,
} from "@/lib/chatCustomization";
import {
  getPushSubscription,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pwa";
import {
  removePushSubscription,
  savePushSubscription,
} from "@/lib/push.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "You — XUPPIN" },
      {
        name: "description",
        content: "Manage your XUPPIN profile, privacy, alerts and chat look.",
      },
      { property: "og:title", content: "You — XUPPIN" },
    ],
  }),
  component: SettingsPage,
});

type SectionId =
  | "home"
  | "profile"
  | "privacy"
  | "alerts"
  | "chat-look"
  | "showcase";

function SettingsPage() {
  const { user } = useAuth();
  const { data: profile, refetch } = useProfile();
  const { data: isAdmin = false } = useIsAdmin();
  const fileRef = useRef<HTMLInputElement>(null);

  const [section, setSection] = useState<SectionId>("home");
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [showOnline, setShowOnline] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [discoverable, setDiscoverable] = useState(true);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setUsername(profile.username ?? "");
    setBio(profile.bio ?? "");
    setShowOnline(profile.show_online_status ?? true);
    setReadReceipts(profile.show_read_receipts ?? true);
    setDiscoverable(profile.discoverable ?? true);
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!pushSupported()) return;
        const sub = await getPushSubscription();
        if (!cancelled) setPushSubscribed(!!sub);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setBusy(true);
    try {
      await uploadAvatar(user.id, file);
      await refetch();
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update photo");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function saveProfile() {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          username: username.trim().toLowerCase() || null,
          bio: bio.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      await refetch();
      toast.success("Profile saved");
      setSection("home");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function savePrivacy() {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          show_online_status: showOnline,
          show_read_receipts: readReceipts,
          discoverable,
        })
        .eq("id", user.id);
      if (error) throw error;
      await refetch();
      toast.success("Privacy updated");
      setSection("home");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function enablePush() {
    setPushBusy(true);
    try {
      window.localStorage.removeItem("whatsxup.push.dismissed");
      const payload = await subscribeToPush();
      if (!payload) {
        toast.error(
          Notification.permission === "denied"
            ? "Notifications are blocked in browser settings"
            : "Could not enable alerts on this device",
        );
        setPushSubscribed(!!(await getPushSubscription()));
        return;
      }
      await savePushSubscription({ data: payload });
      toast.success("Alerts enabled on this device");
      setPushSubscribed(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not enable alerts",
      );
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) {
        try {
          await removePushSubscription({ data: { endpoint } });
        } catch {
          /* ignore server cleanup */
        }
      }
      toast.success("Alerts disabled on this device");
      setPushSubscribed(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disable");
    } finally {
      setPushBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign out");
    }
  }

  const title =
    section === "home"
      ? "You"
      : section === "profile"
        ? "Your profile"
        : section === "privacy"
          ? "Privacy"
          : section === "alerts"
            ? "Alerts"
            : section === "chat-look"
              ? "Chat look"
              : "Showcase";

  return (
    <AppShell>
      <PageHeader
        title={title}
        {...(profile?.username && section === "home"
          ? { subtitle: `@${profile.username}` }
          : {})}
        {...(section !== "home"
          ? {
              action: (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSection("home")}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              ),
            }
          : {})}
      />

      <div className="space-y-4 p-4 pb-10">
        {section === "home" ? (
          <>
            <button
              type="button"
              onClick={() => setSection("profile")}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border border-border bg-card px-4 py-6 text-center"
            >
              <UserAvatar
                path={profile?.avatar_url ?? null}
                name={profile?.display_name ?? "You"}
                size="xl"
              />
              <p className="text-lg font-semibold">
                {profile?.display_name || "Your name"}
              </p>
              {profile?.username ? (
                <p className="text-sm text-muted-foreground">
                  @{profile.username}
                </p>
              ) : null}
              {profile?.bio ? (
                <p className="max-w-xs text-xs text-muted-foreground">
                  {profile.bio}
                </p>
              ) : null}
            </button>

            <SettingsGroup title="Account">
              <SettingsRow
                icon={<User className="h-4 w-4" />}
                label="Your profile"
                hint="Name, username, about, photo"
                onClick={() => setSection("profile")}
              />
            </SettingsGroup>

            <SettingsGroup title="Privacy">
              <SettingsRow
                icon={<Shield className="h-4 w-4" />}
                label="Visibility & safety"
                hint="Active status, read marks, discovery"
                onClick={() => setSection("privacy")}
              />
            </SettingsGroup>

            <SettingsGroup title="Alerts">
              <SettingsRow
                icon={<Bell className="h-4 w-4" />}
                label="Device alerts"
                hint="Messages and calls on this phone"
                onClick={() => setSection("alerts")}
              />
            </SettingsGroup>

            <SettingsGroup title="Chat look">
              <SettingsRow
                icon={<Palette className="h-4 w-4" />}
                label="Default backdrop"
                hint="Photo or video for every conversation"
                onClick={() => setSection("chat-look")}
              />
              <p className="px-3 pb-3 text-[11px] text-muted-foreground">
                For one chat only: open that chat → customize → backdrop. That
                overrides the default.
              </p>
            </SettingsGroup>

            <SettingsGroup title="Showcase">
              <SettingsRow
                icon={<ImageIcon className="h-4 w-4" />}
                label="Featured collectible"
                hint="Shown on your public profile"
                onClick={() => setSection("showcase")}
              />
            </SettingsGroup>

            {isAdmin ? (
              <Button asChild variant="outline" className="w-full">
                <Link to="/admin">
                  <ShieldCheck className="h-4 w-4" /> Control room
                </Link>
              </Button>
            ) : null}

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </>
        ) : null}

        {section === "profile" ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                className="relative"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                <UserAvatar
                  path={profile?.avatar_url ?? null}
                  name={displayName || "You"}
                  size="xl"
                />
                <span className="absolute bottom-1 right-1 rounded-full bg-primary p-2 text-primary-foreground">
                  <Camera className="h-4 w-4" />
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => void onAvatar(e)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">About</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              className="w-full"
              disabled={busy}
              onClick={() => void saveProfile()}
            >
              {busy ? "Saving…" : "Save profile"}
            </Button>
          </div>
        ) : null}

        {section === "privacy" ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            {(
              [
                {
                  key: "online",
                  label: "Show when I’m active",
                  hint: "Friends can see your online status.",
                  value: showOnline,
                  set: setShowOnline,
                },
                {
                  key: "read",
                  label: "Share read marks",
                  hint: "Others see when you’ve opened a message.",
                  value: readReceipts,
                  set: setReadReceipts,
                },
                {
                  key: "discover",
                  label: "Findable by username",
                  hint: "People can look you up by username.",
                  value: discoverable,
                  set: setDiscoverable,
                },
              ] as const
            ).map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-4 py-1"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.hint}</p>
                </div>
                <Switch checked={row.value} onCheckedChange={row.set} />
              </div>
            ))}
            <Button
              className="mt-2 w-full"
              disabled={busy}
              onClick={() => void savePrivacy()}
            >
              {busy ? "Saving…" : "Save privacy"}
            </Button>
          </div>
        ) : null}

        {section === "alerts" ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium">Device alerts</p>
            <p className="text-xs text-muted-foreground">
              {pushSubscribed
                ? "This device is ready for message and call alerts."
                : "Turn on to get messages and calls when XUPPIN is closed."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={pushBusy}
                onClick={() => void enablePush()}
              >
                {pushBusy ? "…" : pushSubscribed ? "Refresh" : "Enable"}
              </Button>
              {pushSubscribed ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pushBusy}
                  onClick={() => void disablePush()}
                >
                  Disable
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {section === "chat-look" ? <GlobalBackdropPanel /> : null}

        {section === "showcase" ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h2 className="font-semibold">Featured collectible</h2>
            <p className="text-xs text-muted-foreground">
              Choose a gift collectible to show on your profile.
            </p>
            <FeaturedCollectiblePicker />
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <p className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-muted/40"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function GlobalBackdropPanel() {
  const [customization, setCustomization] = useState<ChatCustomization | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "video" | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  async function reload() {
    const local = await getLocalChatCustomization(GLOBAL_CHAT_ID);
    setCustomization(local);
    const media = await getChatWallpaperMedia(GLOBAL_CHAT_ID);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    if (media) {
      const url = URL.createObjectURL(media.blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setPreviewType(media.mediaType);
    } else {
      setPreviewUrl(null);
      setPreviewType(null);
    }
  }

  useEffect(() => {
    void reload();
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  async function chooseBuiltin(id: string) {
    await setChatWallpaperBuiltin(GLOBAL_CHAT_ID, id);
    toast.success("Default backdrop updated");
    await reload();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const result = await setChatWallpaperCustomFile(GLOBAL_CHAT_ID, file);
      if (!result.ok) {
        if (result.reason === "too-large") {
          toast.error("File is too large (max 20MB)");
        } else if (result.reason === "unsupported") {
          toast.error("Use a photo or video file");
        } else {
          toast.error("Could not save backdrop");
        }
        return;
      }
      toast.success(
        file.type.startsWith("video/")
          ? "Default video backdrop set"
          : "Default photo backdrop set",
      );
      await reload();
    } finally {
      setUploading(false);
    }
  }

  async function clearAll() {
    await clearChatWallpaper(GLOBAL_CHAT_ID);
    toast.success("Default backdrop cleared");
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-medium">Default backdrop</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Photo or video for every chat that has no personal backdrop. In a
          chat: customize → choose photo/video for that chat only.
        </p>

        <div className="relative mt-3 h-28 overflow-hidden rounded-xl border border-border bg-muted">
          {previewType === "video" && previewUrl ? (
            <video
              src={previewUrl}
              className="h-full w-full object-cover"
              muted
              loop
              autoPlay
              playsInline
            />
          ) : previewType === "image" && previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : customization?.wallpaper.kind === "builtin" ? (
            <div
              className="h-full w-full"
              style={{
                background:
                  BUILTIN_WALLPAPERS.find(
                    (w) => w.id === customization.wallpaper.builtinId,
                  )?.css || undefined,
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No default backdrop
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/50 bg-primary/5 px-3 py-3 text-sm font-medium text-primary disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? "Saving…" : "Upload photo or video"}
        </button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 w-full"
          onClick={() => void clearAll()}
        >
          Clear default
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-[11px] font-semibold text-muted-foreground">
          Built-in patterns
        </p>
        <div className="grid grid-cols-3 gap-2">
          {BUILTIN_WALLPAPERS.map((wallpaper) => {
            const active =
              (wallpaper.id === "none" &&
                customization?.wallpaper.kind === "none") ||
              (customization?.wallpaper.kind === "builtin" &&
                customization.wallpaper.builtinId === wallpaper.id);
            return (
              <button
                key={wallpaper.id}
                type="button"
                onClick={() => void chooseBuiltin(wallpaper.id)}
                className={`relative flex h-16 items-center justify-center overflow-hidden rounded-xl border text-[10px] font-medium ${
                  active ? "border-primary" : "border-border"
                }`}
                style={{ background: wallpaper.css || undefined }}
              >
                <span className="rounded bg-black/40 px-1.5 py-0.5 text-white">
                  {wallpaper.name}
                </span>
                {active ? (
                  <Check className="absolute right-1 top-1 h-3.5 w-3.5 text-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FeaturedCollectiblePicker() {
  const [items, setItems] = useState<GiftCollectible[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await getMyCollectibles();
        if (!cancelled) setItems(res?.collectibles ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function choose(id: string | null) {
    setBusy(true);
    try {
      await setFeaturedGift({ data: { collectibleId: id } });
      toast.success(
        id ? "Featured collectible updated" : "Featured collectible cleared",
      );
      const res = await getMyCollectibles();
      setItems(res?.collectibles ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No collectibles yet. Receive a gift in chat first.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const serial = item.limited
          ? formatSerial(item.serial_number, item.serial_total)
          : null;
        return (
          <button
            key={item.collectible_id}
            type="button"
            disabled={busy}
            onClick={() => void choose(item.collectible_id)}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
              item.featured
                ? "border-primary bg-primary/10"
                : "border-border bg-background"
            }`}
          >
            <span>
              {giftEmoji(item.gift_key || item.gift_name)}{" "}
              {item.gift_name ?? "Collectible"}
              {serial ? ` · ${serial}` : ""}
            </span>
            {item.featured ? (
              <span className="text-[10px] font-semibold text-primary">
                Featured
              </span>
            ) : null}
          </button>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => void choose(null)}
      >
        Clear featured
      </Button>
    </div>
  );
}
