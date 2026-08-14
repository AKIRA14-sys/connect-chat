/*
 * WHATSXUP SERVICE WORKER
 *
 * - Web Push (messages, voice calls, video calls)
 * - Background / closed-tab / installed-PWA notifications
 * - Notification click routing
 * - Subscription refresh
 * - App shell caching
 */

const VERSION = "whatsxup-v4";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const ICON = "/icons/icon-192.png";
const BADGE = "/icons/icon-192.png";

const VAPID_PUBLIC_KEY =
  "BDTK7jY_Z3HW7PTwjXHRy74eyiwMByASwWzryPdARs42YctaxTIr5B03jno3pzTR_ZfrfUD_WVbvHMCdJGky1ug";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = self.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/* ---------------------------------------------------------
 * INSTALL / ACTIVATE
 * --------------------------------------------------------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(["/", "/manifest.webmanifest", ICON]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/* ---------------------------------------------------------
 * FETCH — cache-first assets, network-first navigations
 * --------------------------------------------------------- */

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache server functions or API routes.
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return;

  const isAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(css|js|png|jpg|jpeg|svg|webp|woff2?)$/.test(url.pathname);

  if (isAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })(),
    );
    return;
  }

  if (request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put("/", response.clone());
        return response;
      } catch {
        const cached = (await cache.match(request)) || (await cache.match("/"));
        if (cached) return cached;
        throw new Error("Network unavailable");
      }
    })(),
  );
});

/* =========================================================
 * WEB PUSH
 * ========================================================= */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { kind: "message", title: "WHATSXUP", body: event.data ? event.data.text() : "" };
  }

  const kind = data.kind || "message";
  const isCall = kind === "call";

  let title = data.title || "WHATSXUP";
  let body = data.body || "";

  if (kind === "message") {
    title = data.title || "New message";
    body = data.body || "You received a new message.";
  }

  if (isCall) {
    const callKind = data.callKind === "video" ? "video" : "voice";
    title = data.title || (callKind === "video" ? "Incoming video call" : "Incoming voice call");
    body = data.body || (callKind === "video" ? "Incoming video call" : "Incoming voice call");
  }

  const notificationData = {
    kind,
    conversationId: data.conversationId || null,
    callId: data.callId || null,
    callerId: data.callerId || null,
    callerName: data.callerName || null,
    callerAvatar: data.callerAvatar || null,
    callKind: data.callKind || null,
  };

  const options = {
    body,
    icon: data.icon || ICON,
    badge: BADGE,
    tag: data.tag || `whatsxup-${kind}`,
    renotify: true,
    requireInteraction: isCall,
    vibrate: isCall ? [300, 150, 300, 150, 300, 150, 300] : [120, 60, 120],
    timestamp: Date.now(),
    data: notificationData,
    actions: isCall
      ? [
          { action: "answer", title: "Answer" },
          { action: "dismiss", title: "Dismiss" },
        ]
      : [{ action: "open", title: "Open chat" }],
  };

  event.waitUntil(
    (async () => {
      // Let open tabs react (ringtone / in-app UI) without replacing the OS notification.
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        client.postMessage({ type: "whatsxup-push", payload: notificationData });
      }
      await self.registration.showNotification(title, options);
    })(),
  );
});

/* =========================================================
 * NOTIFICATION CLICK
 * ========================================================= */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const data = event.notification.data || {};

  let target = "/chats";
  if (data.kind === "message" && data.conversationId) target = `/chats/${data.conversationId}`;
  if (data.kind === "call") target = "/calls";
  if (data.kind === "xup") target = "/xups";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        try {
          if (new URL(client.url).origin === self.location.origin) {
            await client.focus();
            client.postMessage({ type: "whatsxup-navigate", to: target });
            return;
          }
        } catch {
          /* try the next client */
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

/* =========================================================
 * SUBSCRIPTION REFRESH
 *
 * The browser may rotate the endpoint. Resubscribe here and
 * tell any open client so it can persist the new endpoint.
 * ========================================================= */

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        const clientsList = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of clientsList) {
          client.postMessage({
            type: "whatsxup-subscription-change",
            subscription: subscription.toJSON(),
          });
        }
      } catch (error) {
        console.error("[WHATSXUP PUSH] Resubscribe failed:", error);
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "whatsxup-skip-waiting") self.skipWaiting();
});
