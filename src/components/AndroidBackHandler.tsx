import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

/**
 * Android-style back: from any deep screen, hardware/browser back
 * goes to the main Chats home — not through every previous chat.
 */
const HOME = "/chats";

function isDeepPath(pathname: string): boolean {
  if (pathname === HOME || pathname === "/") return false;
  // chat thread
  if (pathname.startsWith("/chats/")) return true;
  // other app sections still count as "opened something"
  if (
    pathname.startsWith("/settings") ||
    pathname.startsWith("/shop") ||
    pathname.startsWith("/contacts") ||
    pathname.startsWith("/xups") ||
    pathname.startsWith("/admin")
  ) {
    return true;
  }
  return false;
}

export function AndroidBackHandler() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Seed a state so the first back from a deep page stays in-app
    if (isDeepPath(pathname)) {
      const st = window.history.state;
      if (!st || !(st as { xuppinHome?: boolean }).xuppinHome) {
        window.history.pushState({ xuppinHome: true }, "");
      }
    }

    const onPopState = () => {
      const path = window.location.pathname;
      if (isDeepPath(path)) {
        // Consume back: go to main chats list
        void navigate({ to: HOME });
        window.history.pushState({ xuppinHome: true }, "");
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [pathname, navigate]);

  return null;
}
