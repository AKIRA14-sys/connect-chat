import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pushSupported, subscribeToPush, swAllowed } from "@/lib/pwa";
import { savePushSubscription } from "@/lib/push.functions";
import { initNativePush, isNativeAndroid } from "@/lib/nativePush";

function reasonMessage(reason?: string, detail?: string): string {
  let base: string;
  switch (reason) {
    case "permission_denied":
      base = "Allow notifications in Android Settings → Apps → XUPPIN";
      break;
    case "token_timeout":
      base = "No FCM token (APK needs google-services + rebuild)";
      break;
    case "registration_error":
      base = "FCM registration failed (check google-services in APK)";
      break;
    case "empty_token":
      base = "Empty FCM token from device";
      break;
    case "save_failed":
      base = "Token got but save failed (login / fcm_tokens table)";
      break;
    case "not_android":
      base = "Not running as Android APK";
      break;
    case "exception":
      base = "Push plugin missing in this APK build";
      break;
    default:
      base = "Could not enable notifications";
  }
  return detail ? `${base} [${detail}]` : base;
}

export function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNativeAndroid()) {
      void initNativePush().then((r) => {
        if (r.ok) setVisible(false);
      });
      if (window.localStorage.getItem("whatsxup.push.dismissed") === "1") {
        return;
      }
      setVisible(true);
      return;
    }

    if (!pushSupported() || !swAllowed()) return;
    if (typeof Notification !== "undefined" && Notification.permission !== "default")
      return;
    if (window.localStorage.getItem("whatsxup.push.dismissed") === "1") return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  async function enable() {
    setBusy(true);
    try {
      if (isNativeAndroid()) {
        const r = await initNativePush();
        if (r.ok) {
          toast.success("Notifications enabled");
          setVisible(false);
        } else {
          toast.error(reasonMessage(r.reason, r.detail));
        }
        return;
      }

      const sub = await subscribeToPush();
      if (!sub) {
        toast.error("Notifications were not enabled.");
      } else {
        await savePushSubscription({ data: sub });
        toast.success("Notifications enabled");
        setVisible(false);
      }
    } catch {
      toast.error("Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <Bell className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Turn on notifications</p>
        <p className="text-xs text-muted-foreground">
          Get messages and calls even when the app is closed.
        </p>
      </div>
      <Button size="sm" disabled={busy} onClick={() => void enable()}>
        {busy ? "…" : "Enable"}
      </Button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          window.localStorage.setItem("whatsxup.push.dismissed", "1");
          setVisible(false);
        }}
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
