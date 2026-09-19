import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Safe notification health check for the logged-in user.
 * Does not expose private keys.
 */
export const getPushDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId: string }).userId;
    const supabase = (context as { supabase: any }).supabase;

    const [{ data: web }, { data: fcm }, { data: profile }] = await Promise.all([
      supabase
        .from("push_subscriptions")
        .select("endpoint")
        .eq("user_id", userId),
      supabase.from("fcm_tokens").select("token").eq("user_id", userId),
      supabase
        .from("profiles")
        .select(
          "status, notify_messages, notify_groups, notify_voice_calls, notify_video_calls",
        )
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const fcmSa = process.env["FCM_SERVICE_ACCOUNT"];
    let fcmKeyStatus: "ok" | "missing" | "invalid_json" | "incomplete" =
      "missing";
    if (fcmSa) {
      try {
        const j = JSON.parse(fcmSa) as Record<string, unknown>;
        if (j.project_id && j.private_key && j.client_email) fcmKeyStatus = "ok";
        else fcmKeyStatus = "incomplete";
      } catch {
        fcmKeyStatus = "invalid_json";
      }
    }

    const vapidPrivate = Boolean(
      process.env["VAPID_PRIVATE_KEY"] || process.env["VAPID_PRIVATE"],
    );
    const vapidPublic = Boolean(
      process.env["VAPID_PUBLIC_KEY"] || process.env["NEXT_PUBLIC_VAPID_PUBLIC_KEY"],
    );

    return {
      userId,
      webSubscriptionCount: (web ?? []).length,
      fcmTokenCount: (fcm ?? []).length,
      profileStatus: profile?.status ?? null,
      notify_messages: profile?.notify_messages ?? null,
      notify_groups: profile?.notify_groups ?? null,
      server: {
        fcmServiceAccount: fcmKeyStatus,
        vapidPrivateKeySet: vapidPrivate,
        vapidPublicKeySet: vapidPublic,
      },
      hints: buildHints({
        web: (web ?? []).length,
        fcm: (fcm ?? []).length,
        fcmKeyStatus,
        vapidPrivate,
        notify: profile?.notify_messages,
        status: profile?.status,
      }),
    };
  });

function buildHints(p: {
  web: number;
  fcm: number;
  fcmKeyStatus: string;
  vapidPrivate: boolean;
  notify: boolean | null | undefined;
  status: string | null | undefined;
}): string[] {
  const h: string[] = [];
  if (p.status && p.status !== "active") {
    h.push("Profile status is not active — push is skipped.");
  }
  if (p.notify === false) {
    h.push("notify_messages is OFF on your profile — turn it on in settings.");
  }
  if (p.web === 0 && p.fcm === 0) {
    h.push(
      "No push token saved for your account. Tap Enable notifications in the app (PWA or APK).",
    );
  }
  if (p.fcm > 0 && p.fcmKeyStatus !== "ok") {
    h.push(
      "FCM tokens exist but FCM_SERVICE_ACCOUNT on Vercel is missing/invalid — APK push cannot send.",
    );
  }
  if (p.web > 0 && !p.vapidPrivate) {
    h.push(
      "Web subscriptions exist but VAPID_PRIVATE_KEY may be missing on the server.",
    );
  }
  if (p.web > 0 && p.fcmKeyStatus === "ok" && p.fcm === 0) {
    h.push("Web push may work; APK needs FCM token from a native install.");
  }
  if (h.length === 0) {
    h.push(
      "Tokens + server keys look present. If still silent: check Android battery optimization, notification channel, and that the sender calls notifyNewMessage after send.",
    );
  }
  return h;
}
