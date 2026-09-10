import { isNative } from "./platform";

const APP_HOSTS = ["xuppin.vercel.app", "whatsxup.lovable.app"];
const PENDING_KEY = "xuppin:pending-deep-link";

function isAllowedPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path === "/") return false;
  if (/^\/g\/[A-Za-z0-9_-]+\/join\/?$/.test(path)) return true;
  if (/^\/chats\/[A-Za-z0-9_-]+\/?$/.test(path)) return true;
  if (/^\/groups\/[A-Za-z0-9_-]+\/?$/.test(path)) return true;
  return false;
}

function pathFromUrl(url: string): string | null {
  try {
    if (url.startsWith("xuppin://")) {
      const rest = url.replace(/^xuppin:\/\//, "").replace(/^\//, "");
      const path = ("/" + rest).split("?")[0];
      return isAllowedPath(path) ? path : null;
    }

    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") {
      if (!APP_HOSTS.includes(u.hostname)) return null;
    }
    const pathname = u.pathname || "/";
    return isAllowedPath(pathname) ? pathname + (u.search || "") : null;
  } catch {
    return null;
  }
}

/**
 * Open invite links inside the APK on the join page (not home).
 */
export async function initDeepLinks(
  navigate: (path: string) => void,
): Promise<() => void> {
  if (!isNative()) return () => {};

  let last = "";

  const go = (fullUrl: string, path: string) => {
    if (last === path) return;
    last = path;

    try {
      sessionStorage.setItem(PENDING_KEY, path);
    } catch {
      /* ignore */
    }

    try {
      if (fullUrl.startsWith("http://") || fullUrl.startsWith("https://")) {
        if (window.location.pathname !== path.split("?")[0]) {
          window.location.replace(fullUrl);
        }
        return;
      }
    } catch {
      /* ignore */
    }

    try {
      navigate(path);
    } catch {
      try {
        window.location.replace("https://xuppin.vercel.app" + path);
      } catch {
        /* ignore */
      }
    }
  };

  try {
    const { App } = await import("@capacitor/app");

    const handle = (url: string) => {
      const path = pathFromUrl(url);
      if (!path) return;
      go(url, path);
    };

    const sub = await App.addListener("appUrlOpen", (event) => {
      handle(event.url);
    });

    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url) {
        window.setTimeout(() => handle(launch.url), 500);
      }
    } catch {
      /* ignore */
    }

    return () => {
      void sub.remove();
    };
  } catch {
    return () => {};
  }
}