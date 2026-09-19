import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getPushDiagnostics } from "@/lib/pushDiagnostics.functions";
import { initNativePush, isNativeAndroid } from "@/lib/nativePush";
import { pushSupported, subscribeToPush, swAllowed } from "@/lib/pwa";
import { savePushSubscription } from "@/lib/push.functions";

/** Put on Settings or Control Room — shows why push fails. */
export function NotificationHealthPanel() {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["push-diagnostics"],
    queryFn: () => getPushDiagnostics(),
  });
  const [busy, setBusy] = useState(false);

  async function reEnable() {
    setBusy(true);
    try {
      window.localStorage.removeItem("whatsxup.push.dismissed");
      if (isNativeAndroid()) {
        const r = await initNativePush();
        if (r.ok) toast.success("FCM token saved");
        else toast.error(r.reason || "Native push failed");
      } else if (pushSupported() && swAllowed()) {
        const sub = await subscribeToPush();
        if (sub) {
          await savePushSubscription({ data: sub });
          toast.success("Web push subscription saved");
        } else toast.error("Could not subscribe (permission or SW)");
      } else {
        toast.message("Use the installed PWA or Android APK for push");
      }
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-semibold">Notification health</h2>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>
      {data ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>Web subscriptions: {data.webSubscriptionCount}</li>
          <li>FCM tokens (APK): {data.fcmTokenCount}</li>
          <li>Profile status: {String(data.profileStatus)}</li>
          <li>notify_messages: {String(data.notify_messages)}</li>
          <li>Server FCM key: {data.server.fcmServiceAccount}</li>
          <li>VAPID private set: {String(data.server.vapidPrivateKeySet)}</li>
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Loading…</p>
      )}
      {data?.hints?.length ? (
        <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700 dark:text-amber-300">
          {data.hints.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      ) : null}
      <Button size="sm" disabled={busy} onClick={() => void reEnable()}>
        {busy ? "Working…" : "Re-enable / refresh token"}
      </Button>
    </div>
  );
}
