// src/lib/pwa.ts
// WHATSXUP Web Push + Service Worker registration

export const VAPID_PUBLIC_KEY =
  "BDTK7jY_Z3HW7PTwjXHRy74eyiwMByASwWzryPdARs42YctaxTIr5B03jno3pzTR_ZfrfUD_WVbvHMCdJGky1ug";

function isPreviewHost() {
  if (typeof window === "undefined") return true;

  const host = window.location.hostname;

  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

export function swAllowed() {
  if (typeof window === "undefined") return false;

  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  if (!("Notification" in window)) return false;

  if (!window.isSecureContext) return false;

  if (!import.meta.env.PROD) return false;

  if (window.top !== window.self) return false;

  if (isPreviewHost()) return false;

  if (
    new URL(window.location.href).searchParams.get("sw") ===
    "off"
  ) {
    return false;
  }

  return true;
}

/* ---------------------------------------------------------
 * REGISTER SERVICE WORKER
 * --------------------------------------------------------- */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;

  if (!("serviceWorker" in navigator)) {
    console.error(
      "[WHATSXUP PUSH] Service workers are not supported.",
    );
    return null;
  }

  if (!swAllowed()) {
    return null;
  }

  try {
    const registration =
      await navigator.serviceWorker.register(
        "/sw.js",
        {
          scope: "/",
          updateViaCache: "none",
        },
      );

    await navigator.serviceWorker.ready;

    console.log(
      "[WHATSXUP PUSH] Service worker registered:",
      registration.scope,
    );

    return registration;
  } catch (error) {
    console.error(
      "[WHATSXUP PUSH] Service worker registration failed:",
      error,
    );

    return null;
  }
}

/* ---------------------------------------------------------
 * BASE64URL → UINT8ARRAY
 * --------------------------------------------------------- */

function urlBase64ToUint8Array(
  base64String: string,
) {
  const padding =
    "=".repeat(
      (4 - (base64String.length % 4)) % 4,
    );

  const base64 =
    (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const raw = window.atob(base64);

  const output =
    new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i++) {
    output[i] =
      raw.charCodeAt(i);
  }

  return output;
}

/* ---------------------------------------------------------
 * ARRAY BUFFER → BASE64URL
 * --------------------------------------------------------- */

function bufferToBase64Url(
  buffer: ArrayBuffer,
) {
  const bytes =
    new Uint8Array(buffer);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/* ---------------------------------------------------------
 * PUSH PAYLOAD
 * --------------------------------------------------------- */

export type PushPayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
};

/* ---------------------------------------------------------
 * GET CURRENT SUBSCRIPTION
 * --------------------------------------------------------- */

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!swAllowed()) return null;

  const registration =
    await navigator.serviceWorker.ready;

  return registration.pushManager.getSubscription();
}

/* ---------------------------------------------------------
 * SUBSCRIBE TO WEB PUSH
 * --------------------------------------------------------- */

export async function subscribeToPush(): Promise<PushPayload | null> {
  if (!swAllowed()) {
    console.warn(
      "[WHATSXUP PUSH] Push is not supported or SW is not allowed.",
    );

    return null;
  }

  try {
    const registration =
      await navigator.serviceWorker.ready;

    let permission =
      Notification.permission;

    if (permission !== "granted") {
      permission =
        await Notification.requestPermission();
    }

    if (permission !== "granted") {
      console.warn(
        "[WHATSXUP PUSH] Notification permission was not granted.",
      );

      return null;
    }

    let subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription =
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(
              VAPID_PUBLIC_KEY,
            ) as BufferSource,
        });
    }

    const p256dhKey =
      subscription.getKey("p256dh");

    const authKey =
      subscription.getKey("auth");

    if (!p256dhKey || !authKey) {
      console.error(
        "[WHATSXUP PUSH] Push subscription keys are missing.",
      );

      return null;
    }

    const payload: PushPayload = {
      endpoint:
        subscription.endpoint,

      p256dh:
        bufferToBase64Url(
          p256dhKey,
        ),

      auth:
        bufferToBase64Url(
          authKey,
        ),

      userAgent:
        navigator.userAgent.slice(
          0,
          300,
        ),
    };

    console.log(
      "[WHATSXUP PUSH] Subscription ready.",
    );

    return payload;
  } catch (error) {
    console.error(
      "[WHATSXUP PUSH] Subscription failed:",
      error,
    );

    return null;
  }
}

/* ---------------------------------------------------------
 * CURRENT PUSH ENDPOINT
 * --------------------------------------------------------- */

export async function currentPushEndpoint(): Promise<string | null> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return null;
  }

  try {
    const registration =
      await navigator.serviceWorker.ready;

    const subscription =
      await registration.pushManager.getSubscription();

    return subscription?.endpoint ?? null;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------
 * UNSUBSCRIBE
 * --------------------------------------------------------- */

export async function unsubscribeFromPush(): Promise<string | null> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return null;
  }

  try {
    const registration =
      await navigator.serviceWorker.ready;

    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      return null;
    }

    const endpoint =
      subscription.endpoint;

    await subscription.unsubscribe();

    return endpoint;
  } catch (error) {
    console.error(
      "[WHATSXUP PUSH] Unsubscribe failed:",
      error,
    );

    return null;
  }
}

/* ---------------------------------------------------------
 * SUPPORT CHECK
 * --------------------------------------------------------- */

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}