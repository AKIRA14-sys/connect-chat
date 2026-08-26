import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, LogOut, ShieldCheck } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Your profile — WHATSXUP" },
      { name: "description", content: "Update your WHATSXUP profile picture, display name, bio and privacy settings." },
      { property: "og:title", content: "Your profile — WHATSXUP" },
      { property: "og:description", content: "Update your profile and privacy settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function patch(fields: Record<string, unknown>) {
    const { error } = await supabase.from("profiles").update(fields as never).eq("id", user!.id);
    if (error) toast.error(error.message);
    else void qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadAvatar(user!.id, file);
      await patch({ avatar_url: path });
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(false);
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell>
      <PageHeader title="You" {...(profile?.username ? { subtitle: `@${profile.username}` } : {})} />
      <div className="space-y-6 p-4">
        <div className="flex flex-col items-center gap-3">
          <button className="relative" onClick={() => fileRef.current?.click()} disabled={busy}>
            <UserAvatar path={profile?.avatar_url ?? null} name={profile?.display_name ?? ""} size="xl" />
            <span className="absolute bottom-1 right-1 rounded-full bg-primary p-2 text-primary-foreground">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onAvatar(e)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dn">Display name</Label>
          <Input
            id="dn"
            defaultValue={profile?.display_name ?? ""}
            maxLength={50}
            onBlur={(e) => void patch({ display_name: e.target.value.trim().slice(0, 50) })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            defaultValue={profile?.bio ?? ""}
            maxLength={160}
            onBlur={(e) => void patch({ bio: e.target.value.trim().slice(0, 160) || null })}
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Privacy</h2>
          {[
            { key: "show_online_status", label: "Show online status", hint: "Let friends see when you're active." },
            { key: "show_read_receipts", label: "Read receipts", hint: "Share when you've read a message." },
            { key: "discoverable", label: "Discoverable", hint: "Allow people to find you by username." },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4">
              
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold">Featured Collectible</h2>
          <p className="text-xs text-muted-foreground">
            Choose a gift collectible to show on your profile. Only you can change this.
          </p>
          <FeaturedCollectiblePicker />
        </div>
<div>
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.hint}</p>
              </div>
              <Switch
                checked={Boolean(profile?.[row.key as "discoverable"])}
                onCheckedChange={(v) => void patch({ [row.key]: v })}
              />
            </div>
          ))}
        </div>

        {isAdmin && (
          <Button asChild variant="outline" className="w-full">
            <Link to="/admin">
              <ShieldCheck className="h-4 w-4" /> Admin panel
            </Link>
          </Button>
        )}

        <Button variant="destructive" className="w-full" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </AppShell>
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
      toast.success(id ? "Featured collectible updated" : "Featured collectible cleared");
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

