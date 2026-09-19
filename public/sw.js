/*
 * XUPPIN SW — offline shell on THIS device
 * Open app + navigate pages without network (after one online visit).
 */
const VERSION = "xuppin-one-phone-v1";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const ICON = "/icons/icon-192.png";
const BADGE = "/icons/icon-192.png";

const VAPID_PUBLIC_KEY =
  "BDTK7jY_Z3HW7PTwjXHRy74eyiwMByASwWzryPdARs42YctaxTIr5B03jno3pzTR_ZfrfUD_WVbvHMCdJGky1ug";

const SHELL_URLS = ["/", "/chats", "/contacts", "/settings", "/shop", "/manifest.webmanifest", ICON];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const c = await caches.open(SHELL);
      await Promise.all(SHELL_URLS.map((u) => c.add(u).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return;

  const isAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(css|js|png|jpg|jpeg|svg|webp|woff2?|ico)$/.test(url.pathname);

  if (isAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS);
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          if (res.ok) await cache.put(request, res.clone());
          return res;
        } catch {
          return hit || new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL);
        try {
          const res = await fetch(request);
          if (res.ok) {
            await cache.put("/", res.clone());
            await cache.put(request.url, res.clone()).catch(() => undefined);
          }
          return res;
        } catch {
          return (
            (await cache.match(request)) ||
            (await cache.match(url.pathname)) ||
            (await cache.match("/chats")) ||
            (await cache.match("/")) ||
            new Response(
              "<!DOCTYPE html><html><body style=\"font-family:system-ui;padding:2rem;background:#09090b;color:#fff\"><h1>XUPPIN</h1><p>Offline. Open once with internet on this phone so the app can save itself.</p></body></html>",
              { headers: { "Content-Type": "text/html" }, status: 503 },
            )
          );
        }
      })(),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { kind: "message", title: "XUPPIN", body: event.data ? event.data.text() : "" };
  }
  const kind = data.kind || "message";
  const isCall = kind === "call";
  let title = data.title || "XUPPIN";
  let body = data.body || "";
  if (kind === "message") {
    title = data.title || "New message";
    body = data.body || "You received a new message.";
  }
  if (isCall) {
    const callKind = data.callKind === "video" ? "video" : "voice";
    title = data.title || (callKind === "video" ? "Incoming video call" : "Incoming voice call");
    body = data.body || title;
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: data.icon || ICON,
      badge: BADGE,
      tag: data.tag || `xuppin-${kind}`,
      data: {
        kind,
        conversationId: data.conversationId || null,
        callId: data.callId || null,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const path = data.conversationId ? `/chats/${data.conversationId}` : "/chats";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(path);
          return;
        }
      }
      await self.clients.openWindow(path);
    })(),
  );
});
