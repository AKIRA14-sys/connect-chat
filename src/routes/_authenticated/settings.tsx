import { useRef, useState } from "react";
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
