import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pushSupported, subscribeToPush, swAllowed } from "@/lib/pwa";
import { savePushSubscription } from "@/lib/push.functions";
import { initNativePush, isNativeAndroid } from "@/lib/nativePush";

export function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // APK: try register FCM quietly when already permitted
    if (isNativeAndroid()) {
      void initNativePush();
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        return;
      }
      if (window.localStorage.getItem("whatsxup.push.dismissed") === "1") return;
      setVisible(true);
      return;
    }

    if (!pushSupported() || !swAllowed()) return;
    if (Notification.permission !== "default") return;
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
          toast.error(
            r.reason === "permission_denied"
              ? "Allow notifications in Android settings"
              : "Could not enable notifications",
          );
        }
        return;
      }

      const sub = await subscribeToPush();
      if (!sub) {
        toast.error("Notifications were not enabled.");
      } else {
        await savePushSubscription({ data: sub });
        toast.success("WHATSXUP notifications enabled");
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
          Get messages and calls even when WHATSXUP is closed.
        </p>
      </div>
      <Button size="sm" disabled={busy} onClick={() => void enable()}>
        {busy ? "…" : "Enable"}
      </Button>
      <button
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
