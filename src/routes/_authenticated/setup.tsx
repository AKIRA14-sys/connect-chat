import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { USERNAME_RE } from "@/lib/whatsxup";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Choose your username — WHATSXUP" },
      { name: "description", content: "Pick a unique WHATSXUP username so friends can find you without sharing your email." },
      { property: "og:title", content: "Choose your username — WHATSXUP" },
      { property: "og:description", content: "Pick a unique username so friends can find you." },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const uname = username.trim().toLowerCase();
    if (!USERNAME_RE.test(uname)) {
      toast.error("Usernames are 3–20 characters: lowercase letters, numbers and underscores.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: uname,
        display_name: displayName.trim().slice(0, 50) || uname,
        bio: bio.trim().slice(0, 160) || null,
      })
      .eq("id", user!.id);
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "That username is already taken." : error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["profile"] });
    void navigate({ to: "/chats" });
  }

  if (profile?.username) {
    return (
      <main className="flex min-h-screen items-center justify-center app-gradient px-6">
        <Button onClick={() => void navigate({ to: "/chats" })}>Go to chats</Button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col justify-center app-gradient px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight">Pick your username</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is how friends find you on WHATSXUP. Your email stays private.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-panel">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3">
              <span className="text-muted-foreground">@</span>
              <Input
                id="username"
                className="border-0 bg-transparent px-0 focus-visible:ring-0"
                value={username}
                maxLength={20}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
                placeholder="yourname"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="display">Display name</Label>
            <Input
              id="display"
              value={displayName}
              maxLength={50}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How your name appears"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio (optional)</Label>
            <Textarea
              id="bio"
              value={bio}
              maxLength={160}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short line about you"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Start chatting"}
          </Button>
        </form>
      </div>
    </main>
  );
}
