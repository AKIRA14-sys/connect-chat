import { isNative } from "./platform";

const APP_HOSTS = ["xuppin.vercel.app", "whatsxup.lovable.app"];
const PENDING_KEY = "xuppin:pending-deep-link";

function pathFromUrl(url: string): string | null {
  try {
    // Custom scheme: xuppin://g/slug/join  →  /g/slug/join
    if (url.startsWith("xuppin://")) {
      const rest = url.replace(/^xuppin:\/\//, "");
      const path = rest.startsWith("/") ? rest : `/${rest}`;
      return path.split("?")[0] || null;
    }

    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") {
      if (!APP_HOSTS.includes(u.hostname)) return null;
    }
    const path = `\( {u.pathname} \){u.search}${u.hash}` || "/";
    if (!path || path === "/") return null;
    return path;
  } catch {
    return null;
  }
}

/**
 * When Android opens the app from a shared invite link, route to that path
 * (e.g. /g/my-group/join) instead of staying on the home/chats screen.
 */
export async function initDeepLinks(
  navigate: (path: string) => void,
): Promise<() => void> {
  if (!isNative()) return () => {};

  const go = (path: string) => {
    try {
      sessionStorage.setItem(PENDING_KEY, path);
    } catch {
      /* ignore */
    }
    navigate(path);
    // Cold start: router/auth may not be ready on the first tick
    window.setTimeout(() => navigate(path), 400);
    window.setTimeout(() => navigate(path), 1200);
  };

  try {
    const { App } = await import("@capacitor/app");

    const handle = (url: string) => {
      const path = pathFromUrl(url);
      if (path) go(path);
    };

    const sub = await App.addListener("appUrlOpen", (event) => {
      handle(event.url);
    });

    // App opened by the link (cold start)
    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url) handle(launch.url);
    } catch {
      /* ignore */
    }

    // If we stored a path earlier this session, apply it once
    try {
      const pending = sessionStorage.getItem(PENDING_KEY);
      if (pending && pending !== "/" && pending.startsWith("/")) {
        window.setTimeout(() => navigate(pending), 600);
      }
    } catch {
      /* ignore */
    }

    return () => void sub.remove();
  } catch {
    return () => {};
  }
}