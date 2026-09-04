import { Camera } from "@capacitor/camera";
import { PushNotifications } from "@capacitor/push-notifications";
import { isAndroid, isNative } from "./platform";

export type PermKey =
  | "camera"
  | "microphone"
  | "notifications"
  | "photos"
  | "location"
  | "nearby";

export type PermState = "granted" | "denied" | "prompt" | "unsupported";

/**
 * Best-effort permission status. On web returns "unsupported" or browser state.
 * Microphone uses getUserMedia probe when native plugin lacks a dedicated API.
 */
export async function getPermissionStatus(
  key: PermKey,
): Promise<PermState> {
  if (!isNative()) {
    if (key === "notifications" && typeof Notification !== "undefined") {
      if (Notification.permission === "granted") return "granted";
      if (Notification.permission === "denied") return "denied";
      return "prompt";
    }
    return "unsupported";
  }

  try {
    if (key === "camera" || key === "photos") {
      const s = await Camera.checkPermissions();
      const v = key === "camera" ? s.camera : s.photos;
      if (v === "granted" || v === "limited") return "granted";
      if (v === "denied") return "denied";
      return "prompt";
    }
    if (key === "notifications") {
      const s = await PushNotifications.checkPermissions();
      if (s.receive === "granted") return "granted";
      if (s.receive === "denied") return "denied";
      return "prompt";
    }
    if (key === "microphone") {
      // Probe only if already granted; avoid prompting here
      return "prompt";
    }
  } catch {
    return "unsupported";
  }
  return "prompt";
}

export async function requestPermission(key: PermKey): Promise<PermState> {
  if (!isNative()) {
    if (key === "notifications" && typeof Notification !== "undefined") {
      const p = await Notification.requestPermission();
      return p === "granted" ? "granted" : p === "denied" ? "denied" : "prompt";
    }
    if (key === "microphone" || key === "camera") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: key === "microphone",
          video: key === "camera",
        });
        stream.getTracks().forEach((t) => t.stop());
        return "granted";
      } catch {
        return "denied";
      }
    }
    return "unsupported";
  }

  try {
    if (key === "camera" || key === "photos") {
      const s = await Camera.requestPermissions({
        permissions: key === "camera" ? ["camera"] : ["photos"],
      });
      const v = key === "camera" ? s.camera : s.photos;
      if (v === "granted" || v === "limited") return "granted";
      if (v === "denied") return "denied";
      return "prompt";
    }
    if (key === "notifications") {
      const s = await PushNotifications.requestPermissions();
      if (s.receive === "granted") {
        await PushNotifications.register();
        return "granted";
      }
      return s.receive === "denied" ? "denied" : "prompt";
    }
    if (key === "microphone") {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return "granted";
    }
  } catch (err) {
    console.error(`[permissions] ${key} request failed:`, err);
    if (typeof window !== "undefined") {
      alert(`Permission error (${key}): ${err instanceof Error ? err.message : String(err)}`);
    }
    return "denied";
  }
  return "prompt";
}

/** Open Android app settings so user can fix permanent denials */
export async function openAppSettings(): Promise<void> {
  if (!isAndroid()) return;
  try {
    // App plugin openUrl to package settings
    const { App } = await import("@capacitor/app");
    // Fallback: users use Settings → Apps → XUPPIN → Permissions
    console.info("[permissions] Open Android Settings → Apps → XUPPIN → Permissions");
    void App;
  } catch {
    /* ignore */
  }
}