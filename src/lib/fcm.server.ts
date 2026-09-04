/**
 * Server-only FCM sender for native Android tokens.
 * Env (set on Vercel):
 *   FCM_SERVER_KEY  — Firebase Cloud Messaging server key (legacy HTTP API)
 *
 * Project: xuppin-5f158 (from google-services.json)
 */

export type FcmPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  tag?: string;
};

export async function sendFcm(
  token: string,
  payload: FcmPayload,
): Promise<{ ok: boolean; expired?: boolean; error?: string }> {
  const key = process.env["FCM_SERVER_KEY"];
  if (!key) {
    console.error("[FCM] Missing FCM_SERVER_KEY env");
    return { ok: false, error: "missing_key" };
  }

  const data: Record<string, string> = {};
  if (payload.data) {
    for (const [k, v] of Object.entries(payload.data)) {
      data[k] = String(v ?? "");
    }
  }
  data["title"] = payload.title;
  data["body"] = payload.body;
  if (payload.tag) data["tag"] = payload.tag;

  try {
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        priority: "high",
        notification: {
          title: payload.title,
          body: payload.body,
          sound: "default",
          tag: payload.tag,
          click_action: "FCM_PLUGIN_ACTIVITY",
        },
        data,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      success?: number;
      failure?: number;
      results?: Array<{ error?: string }>;
    };

    if (!res.ok) {
      return { ok: false, error: `http_${res.status}` };
    }

    const err = json.results?.[0]?.error;
    if (err === "NotRegistered" || err === "InvalidRegistration") {
      return { ok: false, expired: true, error: err };
    }
    if (json.failure && json.failure > 0) {
      return { ok: false, error: err || "failure" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[FCM] send failed", e);
    return { ok: false, error: "network" };
  }
}
