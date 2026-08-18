import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset Password — WHATSXUP" },
      {
        name: "description",
        content: "Create a new password for your WHATSXUP account.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setReady(Boolean(session));
      setChecking(false);

      if (!session) {
        toast.error(
          "This password reset link is invalid or has expired. Please request a new one.",
        );
      }
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY") {
        setReady(Boolean(session));
        setChecking(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Your XUP password has been changed successfully.");

    // Sign the recovery session out after changing the password.
    await supabase.auth.signOut();

    void navigate({ to: "/auth" });
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center app-gradient px-6">
        <div className="text-center">
          <img
            src="/icons/icon-192.png"
            alt="WHATSXUP"
            width={64}
            height={64}
            className="mx-auto rounded-2xl"
          />

          <p className="mt-4 text-sm text-muted-foreground">
            Checking reset link…
          </p>
        </div>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen flex-col justify-center app-gradient px-6 py-12">
        <div className="mx-auto w-full max-w-sm text-center">
          <img
            src="/icons/icon-192.png"
            alt="WHATSXUP"
            width={72}
            height={72}
            className="mx-auto rounded-2xl"
          />

          <h1 className="mt-5 text-2xl font-bold">
            Reset link unavailable
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            This password reset link is invalid or has expired.
          </p>

          <Button
            className="mt-6 w-full"
            onClick={() => void navigate({ to: "/auth" })}
          >
            Back to XUP
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col justify-center app-gradient px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 text-center">
          <img
            src="/icons/icon-192.png"
            alt="WHATSXUP"
            width={72}
            height={72}
            className="mx-auto rounded-2xl"
          />

          <h1 className="mt-5 text-3xl font-bold tracking-tight">
            Create a new password
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Choose a new password for your XUP account.
          </p>
        </div>

        <form
          onSubmit={updatePassword}
          className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-panel"
        >
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>

            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">
              Confirm new password
            </Label>

            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Enter your password again"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={busy}
          >
            {busy ? "Updating password…" : "Change password"}
          </Button>
        </form>
      </div>
    </main>
  );
}