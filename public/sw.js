/*
 * WHATSXUP SERVICE WORKER
 *
 * Handles:
 * - Web Push
 * - Background notifications
 * - Message notifications
 * - Voice call notifications
 * - Video call notifications
 * - Notification clicks
 * - PWA caching
 */

const VERSION = "whatsxup-v2";

const SHELL_CACHE =
  `${VERSION}-shell`;

const ASSET_CACHE =
  `${VERSION}-assets`;

const ICON =
  "/icons/icon-192.png";

const BADGE =
  "/icons/icon-192.png";

/* ---------------------------------------------------------
 * INSTALL
 * --------------------------------------------------------- */

self.addEventListener(
  "install",
  (event) => {
    event.waitUntil(
      caches
        .open(SHELL_CACHE)
        .then((cache) =>
          cache.addAll([
            "/",
            "/manifest.webmanifest",
            ICON,
          ]),
        )
        .catch(() => undefined),
    );

    self.skipWaiting();
  },
);

/* ---------------------------------------------------------
 * ACTIVATE
 * --------------------------------------------------------- */

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      (async () => {
        const cacheNames =
          await caches.keys();

        await Promise.all(
          cacheNames
            .filter(
              (name) =>
                !name.startsWith(
                  VERSION,
                ),
            )
            .map((name) =>
              caches.delete(name),
            ),
        );

        await self.clients.claim();
      })(),
    );
  },
);

/* ---------------------------------------------------------
 * MESSAGE FROM APP
 * --------------------------------------------------------- */

self.addEventListener(
  "message",
  (event) => {
    if (
      event.data ===
      "skip-waiting"
    ) {
      self.skipWaiting();
    }
  },
);

/* ---------------------------------------------------------
 * HASHED ASSETS
 * --------------------------------------------------------- */

function isHashedAsset(url) {
  return (
    url.origin ===
      self.location.origin &&
    /\/(assets|_build)\//.test(
      url.pathname,
    )
  );
}

/* ---------------------------------------------------------
 * FETCH
 * --------------------------------------------------------- */

self.addEventListener(
  "fetch",
  (event) => {
    const request =
      event.request;

    if (
      request.method !==
      "GET"
    ) {
      return;
    }

    const url =
      new URL(request.url);

    if (
      url.origin !==
      self.location.origin
    ) {
      return;
    }

    /*
     * Never cache APIs/server functions.
     */

    if (
      url.pathname.startsWith(
        "/api/",
      ) ||
      url.pathname.startsWith(
        "/_serverFn/",
      )
    ) {
      return;
    }

    /*
     * Immutable build assets.
     */

    if (
      isHashedAsset(url)
    ) {
      event.respondWith(
        caches
          .open(ASSET_CACHE)
          .then(async (cache) => {
            const cached =
              await cache.match(
                request,
              );

            if (cached) {
              return cached;
            }

            const response =
              await fetch(
                request,
              );

            if (response.ok) {
              await cache.put(
                request,
                response.clone(),
              );
            }

            return response;
          }),
      );

      return;
    }

    /*
     * Network first.
     */

    event.respondWith(
      (async () => {
        const cache =
          await caches.open(
            SHELL_CACHE,
          );

        try {
          const response =
            await fetch(
              request,
            );

          if (
            response.ok &&
            request.mode ===
              "navigate"
          ) {
            await cache.put(
              "/",
              response.clone(),
            );
          }

          return response;
        } catch {
          const cached =
            (await cache.match(
              request,
            )) ||
            (request.mode ===
            "navigate"
              ? await cache.match(
                  "/",
                )
              : undefined);

          if (cached) {
            return cached;
          }

          throw new Error(
            "Network unavailable",
          );
        }
      })(),
    );
  },
);

/* =========================================================
 * WEB PUSH
 * ========================================================= */

self.addEventListener(
  "push",
  (event) => {
    let data = {};

    try {
      data =
        event.data
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
      data.kind ||
      "message";

    let title =
      data.title ||
      "WHATSXUP";

    let body =
      data.body ||
      "";

    /*
     * MESSAGE
     */

    if (
      kind ===
      "message"
    ) {
      title =
        data.title ||
        "New message";

      body =
        data.body ||
        "You received a new message.";
    }

    /*
     * VOICE CALL
     */

    if (
      kind ===
      "call" &&
      data.callKind ===
        "voice"
    ) {
      title =
        data.title ||
        "Incoming voice call";

      body =
        data.body ||
        "Incoming voice call";
    }

    /*
     * VIDEO CALL
     */

    if (
      kind ===
      "call" &&
      data.callKind ===
        "video"
    ) {
      title =
        data.title ||
        "Incoming video call";

      body =
        data.body ||
        "Incoming video call";
    }

    const notificationData = {
      kind,
      conversationId:
        data.conversationId ||
        null,
      callId:
        data.callId ||
        null,
      callerId:
        data.callerId ||
        null,
      callerName:
        data.callerName ||
        null,
      callerAvatar:
        data.callerAvatar ||
        null,
      callKind:
        data.callKind ||
        null,
    };

    /*
     * IMPORTANT:
     *
     * showNotification() is the system-level
     * notification. It is NOT an in-app popup.
     */

    event.waitUntil(
      self.registration.showNotification(
        title,
        {
          body,

          icon: ICON,

          badge: BADGE,

          tag:
            data.tag ||
            `whatsxup-${kind}`,

          renotify: true,

          requireInteraction:
            kind === "call",

          vibrate:
            kind === "call"
              ? [
                  200,
                  100,
                  200,
                  100,
                  300,
                ]
              : [
                  100,
                  50,
                  100,
                ],

          data:
            notificationData,
        },
      ),
    );
  },
);

/* =========================================================
 * NOTIFICATION CLICK
 * ========================================================= */

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const data =
      event.notification
        .data || {};

    let target =
      "/chats";

    /*
     * Message notification
     */

    if (
      data.kind ===
        "message" &&
      data.conversationId
    ) {
      target =
        `/chats/${data.conversationId}`;
    }

    /*
     * Call notification
     */

    if (
      data.kind ===
        "call"
    ) {
      target =
        "/chats";
    }

    event.waitUntil(
      (async () => {
        const windows =
          await self.clients.matchAll(
            {
              type: "window",
              includeUncontrolled:
                true,
            },
          );

        for (
          const client of windows
        ) {
          try {
            const url =
              new URL(
                client.url,
              );

            if (
              url.origin ===
              self.location.origin
            ) {
              await client.focus();

              client.postMessage({
                type:
                  "whatsxup-navigate",
                to: target,
              });

              return;
            }
          } catch {
            // Continue.
          }
        }

        await self.clients.openWindow(
          target,
        );
      })(),
    );
  },
);

/* =========================================================
 * NOTIFICATION CLOSE
 * ========================================================= */

self.addEventListener(
  "notificationclose",
  () => {
    // Intentionally empty.
  },
);

/* =========================================================
 * PUSH SUBSCRIPTION CHANGE
 * ========================================================= */

self.addEventListener(
  "pushsubscriptionchange",
  () => {
    /*
     * The application will refresh the
     * subscription whenever the user opens
     * WHATSXUP again.
     */
  },
);