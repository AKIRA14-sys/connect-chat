/* ============================================================
 * WHATSXUP SERVICE WORKER
 *
 * Handles:
 * - PWA caching
 * - Web Push
 * - Message notifications
 * - Incoming call notifications
 * - Notification actions
 * ============================================================
 */

const VERSION = "whatsxup-v2";

const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const ICON = "/icons/icon-192.png";
const BADGE = "/icons/icon-192.png";

/*
 * ============================================================
 * INSTALL
 * ============================================================
 */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        cache
          .addAll([
            "/",
            "/manifest.webmanifest",
            ICON,
          ])
          .catch(() => undefined),
      ),
  );

  self.skipWaiting();
});

/*
 * ============================================================
 * ACTIVATE
 * ============================================================
 */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(
        names
          .filter((name) => !name.startsWith(VERSION))
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

/*
 * ============================================================
 * MESSAGE FROM APP
 * ============================================================
 */

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") {
    self.skipWaiting();
  }
});

/*
 * ============================================================
 * HASHED ASSETS
 * ============================================================
 */

function isHashedAsset(url) {
  return (
    url.origin === self.location.origin &&
    /\/(assets|_build)\//.test(url.pathname)
  );
}

/*
 * ============================================================
 * FETCH
 * ============================================================
 */

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  /*
   * Never cache server functions/auth.
   */
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_serverFn/")
  ) {
    return;
  }

  /*
   * Build assets = cache first.
   */
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);

        if (cached) {
          return cached;
        }

        const response = await fetch(request);

        if (response.ok) {
          cache.put(request, response.clone());
        }

        return response;
      }),
    );

    return;
  }

  /*
   * Everything else = network first.
   */
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);

      try {
        const response = await fetch(request);

        if (
          response.ok &&
          (request.mode === "navigate" ||
            url.pathname === "/")
        ) {
          cache.put("/", response.clone());
        }

        return response;
      } catch {
        const cached =
          (await cache.match(request)) ||
          (request.mode === "navigate"
            ? await cache.match("/")
            : undefined);

        if (cached) {
          return cached;
        }

        throw new Error("Network unavailable");
      }
    })(),
  );
});

/*
 * ============================================================
 * PUSH EVENT
 * ============================================================
 */

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data
      ? event.data.json()
      : {};
  } catch {
    data = {
      kind: "message",
      title: "WHATSXUP",
      body: event.data
        ? event.data.text()
        : "",
    };
  }

  const kind =
    data.kind || "message";

  const title =
    data.title || "WHATSXUP";

  const body =
    data.body || "";

  /*
   * Profile picture.
   *
   * If the profile avatar is a publicly accessible URL,
   * it can be used as the notification icon.
   */
  const notificationIcon =
    data.avatar || ICON;

  /*
   * ==========================================================
   * MESSAGE NOTIFICATION
   * ==========================================================
   */

  if (kind === "message") {
    event.waitUntil(
      self.registration.showNotification(
        title,
        {
          body,

          icon: notificationIcon,

          badge: BADGE,

          tag:
            data.tag ||
            "whatsxup-message",

          renotify: true,

          data: {
            kind: "message",

            conversationId:
              data.conversationId ||
              null,

            avatar:
              data.avatar ||
              null,
          },

          vibrate: [
            80,
            40,
            80,
          ],
        },
      ),
    );

    return;
  }

  /*
   * ==========================================================
   * INCOMING CALL NOTIFICATION
   * ==========================================================
   */

  if (kind === "call") {
    const missed =
      data.missed === true;

    const callerName =
      data.callerName ||
      data.title ||
      "Someone";

    const callKind =
      data.callKind ||
      "voice";

    const callTitle =
      missed
        ? "Missed call"
        : callKind === "video"
          ? "Incoming video call"
          : "Incoming voice call";

    /*
     * Actions are supported by persistent notifications
     * in service workers on browsers that implement them.
     */
    const actions = missed
      ? [
          {
            action: "open-chat",
            title: "Open chat",
          },
        ]
      : [
          {
            action: "answer",
            title: "Answer",
          },
          {
            action: "decline",
            title: "Decline",
          },
        ];

    event.waitUntil(
      self.registration.showNotification(
        callTitle,
        {
          body: missed
            ? `Missed ${callKind} call from ${callerName}`
            : `${callerName} is calling you`,

          icon:
            data.avatar ||
            notificationIcon,

          badge: BADGE,

          tag:
            data.tag ||
            `call-${data.callId || "incoming"}`,

          renotify: true,

          requireInteraction: true,

          actions,

          data: {
            kind: "call",

            callId:
              data.callId ||
              null,

            callerId:
              data.callerId ||
              null,

            callerName,

            callKind,

            conversationId:
              data.conversationId ||
              null,

            missed,
          },

          vibrate: [
            200,
            100,
            200,
            100,
            200,
          ],
        },
      ),
    );
  }
});

/*
 * ============================================================
 * NOTIFICATION CLICK
 * ============================================================
 */

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const notification =
      event.notification;

    const data =
      notification.data || {};

    const kind =
      data.kind || "message";

    /*
     * --------------------------------------------------------
     * MESSAGE
     * --------------------------------------------------------
     */

    if (kind === "message") {
      const conversationId =
        data.conversationId;

      const target =
        conversationId
          ? `/chats/${conversationId}`
          : "/chats";

      event.waitUntil(
        openApp(target),
      );

      return;
    }

    /*
     * --------------------------------------------------------
     * CALL
     * --------------------------------------------------------
     */

    if (kind === "call") {
      const action =
        event.action || "";

      /*
       * Decline:
       *
       * We don't try to perform WebRTC directly inside
       * the service worker.
       *
       * Instead we open the app, where the realtime
       * calling system can handle the call.
       */
      if (action === "decline") {
        event.waitUntil(
          openApp("/chats"),
        );

        return;
      }

      /*
       * Answer or tapping the notification itself:
       */
      if (
        action === "answer" ||
        action === "open-chat" ||
        action === ""
      ) {
        const conversationId =
          data.conversationId;

        const target =
          conversationId
            ? `/chats/${conversationId}`
            : "/chats";

        event.waitUntil(
          openApp(target),
        );

        return;
      }
    }
  },
);

/*
 * ============================================================
 * OPEN/FIND THE APP
 * ============================================================
 */

async function openApp(target) {
  const windows =
    await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

  /*
   * Prefer an already-open WHATSXUP window.
   */
  for (const client of windows) {
    try {
      const url = new URL(client.url);

      if (
        url.origin ===
        self.location.origin
      ) {
        await client.focus();

        client.postMessage({
          type: "whatsxup-navigate",
          to: target,
        });

        return;
      }
    } catch {
      // Ignore invalid client URLs.
    }
  }

  /*
   * Otherwise open a new window.
   */
  if (self.clients.openWindow) {
    await self.clients.openWindow(target);
  }
}