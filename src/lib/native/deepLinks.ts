import { isNative } from "./platform";

const APP_HOSTS = ["xuppin.vercel.app", "whatsxup.lovable.app"];

/**
 * When the installed Android app is opened via a shared link
 * (e.g. https://xuppin.vercel.app/g/my-group/join), route in-app
 * instead of loading a fresh page.
 */
export async function initDeepLinks(navigate: (path: string) => void): Promise<() => void> {
  if (!isNative()) return () => {};
  try {
    const { App } = await import("@capacitor/app");

    const handle = (url: string) => {
      try {
        const u = new URL(url);
        if (u.protocol === "http:" || u.protocol === "https:") {
          if (!APP_HOSTS.includes(u.hostname)) return;
        }
        const path = `${u.pathname}${u.search}${u.hash}` || "/";
        if (path && path !== "/") navigate(path);
      } catch {
        /* ignore malformed urls */
      }
    };

    const sub = await App.addListener("appUrlOpen", (event) => handle(event.url));

    // Cold start: the app may have been launched by the link itself.
    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url) handle(launch.url);
    } catch {
      /* ignore */
    }

    return () => void sub.remove();
  } catch {
    return () => {};
  }
}
