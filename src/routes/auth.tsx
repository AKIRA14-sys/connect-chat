import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PENDING_JOIN_KEY } from "@/lib/groupExtras";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — XUPPIN" },
      {
        name: "description",
        content: "Sign in or create your XUPPIN account with email verification.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup-email" | "signup-otp" | "signup-password";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signup-email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  function goAfterAuth() {
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_JOIN_KEY);
      if (pending) sessionStorage.removeItem(PENDING_JOIN_KEY);
    } catch {
      /* ignore */
    }
    if (pending && pending.startsWith("/g/")) {
      window.location.assign(pending);
      return;
    }
    void navigate({ to: "/chats" });
  }

  /** Existing users: email + password */
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    goAfterAuth();
  }

  /** Step 1: send 6-digit code to email */
  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    const em = email.trim().toLowerCase();
    if (!em.includes("@")) {
      toast.error("Enter a valid email.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: em,
      options: {
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Check your email for the 6-digit code.");
    setMode("signup-otp");
  }

  /** Step 2: verify OTP */
  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const token = otp.trim().replace(/\s/g, "");
    if (token.length < 6) {
      toast.error("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Email verified. Set a password.");
    setMode("signup-password");
  }

  /** Step 3: set password after OTP */
  async function setPasswordAfterOtp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account ready.");
    goAfterAuth();
  }

  return (
    <main className="flex min-h-screen flex-col justify-center app-gradient px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 text-center">
          <img
            src="/icons/icon-192.png"
            alt="XUPPIN"
            width={72}
            height={72}
            className="mx-auto rounded-2xl"
          />
          <h1 className="mt-5 text-3xl font-bold tracking-tight">XUPPIN</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in with email and password."
              : "We send a code to your email so only a real inbox can join."}
          </p>
        </div>

        {/* SIGN IN */}
        {mode === "signin" && (
          <form
            onSubmit={signIn}
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
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : "Sign in"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              New to XUPPIN?{" "}
              <button
                type="button"
                className="font-medium text-primary underline"
                onClick={() => setMode("signup-email")}
              >
                Create account
              </button>
            </p>
          </form>
        )}

        {/* SIGN UP — email */}
        {mode === "signup-email" && (
          <form
            onSubmit={sendOtp}
            className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-panel"
          >
            <div className="space-y-2">
              <Label htmlFor="email2">Email</Label>
              <Input
                id="email2"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send verification code"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                className="font-medium text-primary underline"
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
            </p>
          </form>
        )}

        {/* SIGN UP — OTP */}
        {mode === "signup-otp" && (
          <form
            onSubmit={verifyOtp}
            className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-panel"
          >
            <p className="text-sm text-muted-foreground">
              Code sent to <strong>{email}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="otp">6-digit code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                maxLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Checking…" : "Verify code"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={busy}
              onClick={() => void sendOtp()}
            >
              Resend code
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline"
              onClick={() => setMode("signup-email")}
            >
              Change email
            </button>
          </form>
        )}

        {/* SIGN UP — password after verify */}
        {mode === "signup-password" && (
          <form
            onSubmit={setPasswordAfterOtp}
            className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-panel"
          >
            <p className="text-sm text-muted-foreground">
              Email verified. Choose a password for next time.
            </p>
            <div className="space-y-2">
              <Label htmlFor="password2">Password</Label>
              <Input
                id="password2"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Saving…" : "Finish & continue"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your email is never shown to other users. People find you by username
          only.
        </p>
      </div>
    </main>
  );
}