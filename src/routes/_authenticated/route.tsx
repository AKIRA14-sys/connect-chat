import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { data: profile, isLoading } = useProfile();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (isLoading) return;
    if (profile && !profile.username && path !== "/setup") {
      void navigate({ to: "/setup", replace: true });
    }
  }, [profile, isLoading, path, navigate]);

  if (isLoading) {
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
          This account has been permanently banned for violating the WHATSXUP community rules.
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

  return <Outlet />;
}
