/**
 * Native Android push (FCM via Capacitor).
 * No static @capacitor imports.
 */

export function isNativeAndroid(): boolean {
  try {
    const C = (
      globalThis as {
        Capacitor?: {
          isNativePlatform?: () => boolean;
          getPlatform?: () => string;
        };
      }
    ).Capacitor;
    return (
      C?.isNativePlatform?.() === true && C?.getPlatform?.() === "android"
    );
  } catch {
    return false;
  }
}

export async function initNativePush(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  if (!isNativeAndroid()) {
    return { ok: false, reason: "not_android" };
  }

  try {
    const mod = await import("@capacitor/push-notifications");
    const PushNotifications = mod.PushNotifications;

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      return { ok: false, reason: "permission_denied" };
    }

    await PushNotifications.register();

    return await new Promise((resolve) => {
      let settled = false;
      const done = (result: { ok: boolean; reason?: string }) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(result);
      };

      const timeout = window.setTimeout(() => {
        done({ ok: false, reason: "token_timeout" });
      }, 20000);

      void PushNotifications.addListener(
        "registration",
        (t: { value: string }) => {
          const token = t?.value;
          console.info(
            "[nativePush] got token length",
            token ? token.length : 0,
          );
          if (!token || token.length < 20) {
            done({ ok: false, reason: "empty_token" });
            return;
          }

          void import("@/lib/push.functions")
            .then(({ saveFcmToken }) =>
              saveFcmToken({ data: { token } } as { data: { token: string } }),
            )
            .then(() => done({ ok: true }))
            .catch((err: unknown) => {
              console.error("[nativePush] saveFcmToken failed", err);
              done({ ok: false, reason: "save_failed" });
            });
        },
      );

      void PushNotifications.addListener(
        "registrationError",
        (err: unknown) => {
          console.error("[nativePush] registrationError", err);
          done({ ok: false, reason: "registration_error" });
        },
      );

      void PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action: {
          notification: { data?: { conversationId?: string; to?: string } };
        }) => {
          const data = action?.notification?.data;
          const to =
            data?.to ||
            (data?.conversationId
              ? `/chats/${data.conversationId}`
              : undefined);
          if (to) window.location.href = to;
        },
      );
    });
  } catch (err) {
    console.error("[nativePush] init failed", err);
    return { ok: false, reason: "exception" };
  }
}
