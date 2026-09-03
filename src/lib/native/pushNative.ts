import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { isAndroid, isNative } from "./platform";

/**
 * Native push registration.
 * Device token can be stored in Supabase (same as web push path).
 * Do NOT use Firebase Auth / Firestore — only optional FCM transport for Android.
 */

export async function initNativePush(onToken?: (token: string) => void) {
  if (!isNative()) return;

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", (t) => {
    onToken?.(t.value);
  });

  PushNotifications.addListener("registrationError", (e) => {
    console.warn("[push] registration error", e);
  });

  PushNotifications.addListener(
    "pushNotificationReceived",
    (notification) => {
      console.info("[push] received", notification.title);
    },
  );

  PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (action) => {
      const data = action.notification.data as { to?: string } | undefined;
      if (data?.to && typeof window !== "undefined") {
        window.location.href = data.to;
      }
    },
  );

  if (isAndroid()) {
    // Ensure channels exist (messages / calls)
    try {
      await LocalNotifications.createChannel({
        id: "messages",
        name: "Messages",
        importance: 5,
        sound: "default",
        vibration: true,
        visibility: 1,
      });
      await LocalNotifications.createChannel({
        id: "calls",
        name: "Calls",
        importance: 5,
        sound: "default",
        vibration: true,
        visibility: 1,
      });
    } catch {
      /* older plugins */
    }
  }
}
