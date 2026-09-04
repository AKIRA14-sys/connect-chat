/**
 * Native Android push (FCM via Capacitor).
 * Web Push (service worker) stays separate — APK needs this path.
 */
import { Capacitor } from "@capacitor/core";
import { saveFcmToken } from "@/lib/push.functions";

export function isNativeAndroid(): boolean {
  try {
    return (
      Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
    );
  } catch {
    return false;
  }
}

/**
 * Request permission, register with FCM, save token to Supabase.
 * Safe to call multiple times (idempotent).
 */
export async function initNativePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isNativeAndroid()) {
    return { ok: false, reason: "not_android" };
  }

  try {
    const { PushNotifications } = await import(
      "@capacitor/push-notifications"
    );

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      return { ok: false, reason: "permission_denied" };
    }

    await PushNotifications.register();

    return await new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        resolve({ ok: false, reason: "token_timeout" });
      }, 15000);

      void PushNotifications.addListener("registration", (t) => {
        window.clearTimeout(timeout);
        const token = t.value;
        if (!token || token.length < 20) {
          resolve({ ok: false, reason: "empty_token" });
          return;
        }
        void saveFcmToken({ data: { token } })
          .then(() => resolve({ ok: true }))
          .catch((err) => {
            console.error("[nativePush] saveFcmToken failed", err);
            resolve({ ok: false, reason: "save_failed" });
          });
      });

      void PushNotifications.addListener("registrationError", (err) => {
        window.clearTimeout(timeout);
        console.error("[nativePush] registrationError", err);
        resolve({ ok: false, reason: "registration_error" });
      });

      void PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          const data = action.notification.data as
            | { conversationId?: string; to?: string }
            | undefined;
          const to =
            data?.to ||
            (data?.conversationId
              ? `/chats/${data.conversationId}`
              : undefined);
          if (to && typeof window !== "undefined") {
            window.location.href = to;
          }
        },
      );
    });
  } catch (err) {
    console.error("[nativePush] init failed", err);
    return { ok: false, reason: "exception" };
  }
}
