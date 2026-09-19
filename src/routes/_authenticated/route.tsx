import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

/**
 * Auth gate that works OFFLINE on this phone.
 * Uses local session first — does NOT call getUser() on the network when offline
 * (that was sending people to /auth when data was off).
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Local session from storage (works offline)
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData.session?.user;

    if (sessionUser) {
      // Online: optionally refresh user; if network fails, keep session user
      if (typeof navigator === "undefined" || navigator.onLine) {
        try {
          const { data, error } = await supabase.auth.getUser();
          if (!error && data.user) {
            return { user: data.user };
          }
        } catch {
          /* offline or network blip — use session */
        }
      }
      return { user: sessionUser };
    }

    // No local session → auth
    throw redirect({ to: "/auth" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { data: profile, isLoading, isError } = useProfile();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    // Don't force setup while offline / profile still loading
    if (isLoading) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (profile && !profile.username && path !== "/setup") {
      void navigate({ to: "/setup", replace: true });
    }
  }, [profile, isLoading, path, navigate]);

  // Offline with no profile yet: still allow app shell (don't spin forever)
  if (isLoading && (typeof navigator === "undefined" || navigator.onLine)) {
    return (
      <div className="flex min-h-screen items-center justify-center app-gradient">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (profile && profile.status === "banned") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 app-gradient px-8 text-center">
        <h1 className="text-2xl font-semibold">Account banned</h1>
        <p className="text-sm text-muted-foreground">
          This account has been permanently banned for violating the XUPPIN community rules.
        </p>
      </div>
    );
  }

  if (profile && profile.status === "suspended") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 app-gradient px-8 text-center">
        <h1 className="text-2xl font-semibold">Account suspended</h1>
        <p className="text-sm text-muted-foreground">
          Your account is temporarily suspended. Messaging is disabled until a moderator restores access.
        </p>
      </div>
    );
  }

  // isError offline: still render children
  void isError;

  return <Outlet />;
}
