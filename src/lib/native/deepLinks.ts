import { isNative } from "./platform";

const APP_HOSTS = ["xuppin.vercel.app", "whatsxup.lovable.app"];
const PENDING_KEY = "xuppin:pending-deep-link";

/** Only allow safe internal paths (invite join, etc.). */
function isAllowedPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path === "/") return false;
  // /g/some-slug/join
  if (/^\/g\/[A-Za-z0-9_-]+\/join\/?$/.test(path)) return true;
  // optional: chats, groups
  if (/^\/chats\/[A-Za-z0-9_-]+\/?$/.test(path)) return true;
  if (/^\/groups\/[A-Za-z0-9_-]+\/?$/.test(path)) return true;
  return false;
}

function pathFromUrl(url: string): string | null {
  try {
    // Custom scheme: xuppin://g/slug/join → /g/slug/join
    if (url.startsWith("xuppin://")) {
      const rest = url.replace(/^xuppin:\/\//, "").replace(/^\//, "");
      const path = `/${rest}`.split("?")[0];
      return isAllowedPath(path) ? path : null;
    }

    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") {
      if (!APP_HOSTS.includes(u.hostname)) return null;
    }
    const path = `\( {u.pathname} \){u.search}` || "/";
    return isAllowedPath(path.split("?")[0] || path) ? path : null;
  } catch {
    return null;
  }
}

/**
 * App Links open the APK, but must land on the invite page.
 * With server.url → live site, the safest fix is to load the full HTTPS URL
 * once (avoids black screen from broken in-app navigate on cold start).
 */
export async function initDeepLinks(
  _navigate: (path: string) => void,
): Promise<() => void> {
  if (!isNative()) return () => {};

  let last = "";
  let handled = false;

  const go = (urlOrPath: string) => {
    if (handled && last === urlOrPath) return;
    handled = true;
    last = urlOrPath;

    try {
      sessionStorage.setItem(PENDING_KEY, urlOrPath);
    } catch {
      /* ignore */
    }

    try {
      // Prefer full https URL when we have it
      if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
        const u = new URL(urlOrPath);
        const path = `\( {u.pathname} \){u.search}`;
        if (!isAllowedPath(u.pathname)) return;
        // Only redirect if we are not already on that path
        if (window.location.pathname + window.location.search !== path) {
          window.location.replace(urlOrPath);
        }
        return;
      }

      // Path only: build live origin URL (matches capacitor server.url)
      if (urlOrPath.startsWith("/") && isAllowedPath(urlOrPath.split("?")[0])) {
        const origin =
          window.location.origin && window.location.origin.startsWith("http")
            ? window.location.origin
            : "https://xuppin.vercel.app";
        const target = `\( {origin} \){urlOrPath}`;
        if (window.location.pathname + window.location.search !== urlOrPath) {
          window.location.replace(target);
        }
      }
    } catch {
      /* ignore */
    }
  };

  try {
    const { App } = await import("@capacitor/app");

    const handle = (url: string) => {
      const path = pathFromUrl(url);
      if (!path) return;
      // Keep full https URL when possible so WebView loads join page correctly
      if (url.startsWith("https://") || url.startsWith("http://")) {
        go(url);
      } else {
        go(path);
      }
    };

    const sub = await App.addListener("appUrlOpen", (event) => {
      handle(event.url);
    });

    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url) {
        // Small delay so WebView/shell is ready (reduces black screen)
        window.setTimeout(() => handle(launch.url), 300);
      }
    } catch {
      /* ignore */
    }

    return () => void sub.remove();
  } catch {
    return () => {};
  }
}