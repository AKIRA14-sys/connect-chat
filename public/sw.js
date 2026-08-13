/* WHATSXUP service worker: Web Push messaging + app-shell/offline caching. */
const VERSION = "whatsxup-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const ICON = "/icons/icon-192.png";
const BADGE = "/icons/icon-192.png";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", ICON])).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

function isHashedAsset(url) {
  return url.origin === self.location.origin && /\/(assets|_build)\//.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API/auth traffic.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn/")) return;

  // Hashed build assets: cache-first (immutable).
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Navigations and everything else: network-first with cached fallback (offline viewing).
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const res = await fetch(req);
        if (res.ok && (req.mode === "navigate" || url.pathname === "/")) cache.put("/", res.clone());
        return res;
      } catch (err) {
        const hit = (await cache.match(req)) || (req.mode === "navigate" ? await cache.match("/") : undefined);
        if (hit) return hit;
        throw err;
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "WHATSXUP", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "WHATSXUP";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: ICON,
      badge: BADGE,
      tag: data.tag || "whatsxup",
      renotify: true,
      data: { conversationId: data.conversationId || null, kind: data.kind || "message" },
      vibrate: data.kind === "call" ? [200, 100, 200, 100, 200] : [80, 40, 80],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const convId = event.notification.data && event.notification.data.conversationId;
  const target = convId ? `/chats/${convId}` : "/chats";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          client.postMessage({ type: "whatsxup-navigate", to: target });
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
