import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — WHATSXUP" },
      {
        name: "description",
        content:
          "Create your WHATSXUP account with an email and password and start chatting instantly.",
      },
      { property: "og:title", content: "Sign in — WHATSXUP" },
      {
        property: "og:description",
        content: "Create your WHATSXUP account and start chatting instantly.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Please enter your email.");
      return;
    }

    if (mode === "forgot") {
      setBusy(true);

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      );

      setBusy(false);

      /*
       * Do not tell the user whether the email exists.
       * This prevents account/email enumeration.
       */
      if (error) {
        console.error("Password reset error:", error);
      }

      toast.success(
        "If an XUP account exists with this email, we've sent a password reset link.",
      );

      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);

    const fn =
      mode === "signup"
        ? supabase.auth.signUp({
            email: email.trim(),
            password,
          })
        : supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

    const { error } = await fn;

    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    void navigate({ to: "/chats" });
  }

  if (mode === "forgot") {
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
              Forgot password?
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Enter the email you used to create your XUP account.
            </p>
          </div>

          <form
            onSubmit={submit}
            className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-panel"
          >
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>

              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </Button>

            <button
              type="button"
              className="w-full text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setMode("signin")}
            >
              Back to sign in
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            If an account exists with that email, you'll receive instructions
            to reset your password.
          </p>
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
            WHATSXUP
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Real-time messaging. No phone number required.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-panel"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>

            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>

            <Input
              id="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          {mode === "signin" && (
            <div className="-mt-1 text-right">
              <button
                type="button"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setMode("forgot")}
              >
                Forgot password?
              </button>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "signup"
              ? "Already have an account?"
              : "New to WHATSXUP?"}{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() =>
                setMode(mode === "signup" ? "signin" : "signup")
              }
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your email is never shown to other users. People find you by username
          only.
        </p>
      </div>
    </main>
  );
}