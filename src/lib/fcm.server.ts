/**
 * Server-only FCM sender for native Android tokens — FCM HTTP v1 API.
 * Env (set on Vercel, marked Sensitive):
 *   FCM_SERVICE_ACCOUNT — full Firebase service-account JSON
 *     ({ project_id, private_key, client_email }).
 *
 * Project: xuppin-5f158
 */

export type FcmPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  tag?: string;
};

type ServiceAccount = {
  project_id: string;
  private_key: string;
  client_email: string;
};

function loadServiceAccount(): ServiceAccount | { error: string } {
  const raw = process.env["FCM_SERVICE_ACCOUNT"];
  if (!raw) return { error: "missing_key" };
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
      return { error: "invalid_key" };
    }
    return {
      project_id: parsed.project_id,
      private_key: parsed.private_key,
      client_email: parsed.client_email,
    };
  } catch {
    return { error: "invalid_key" };
  }
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const { createSign } = await import("node:crypto");
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(sa.private_key, "base64");
  const jwt = `${header}.${claims}.${base64Url(Buffer.from(signature, "base64"))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });
  if (!res.ok) {
    cachedToken = null;
    throw new Error(`oauth_http_${res.status}`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) throw new Error("oauth_no_token");
  cachedToken = {
    token: json.access_token,
    exp: now + (json.expires_in ?? 3600),
  };
  return cachedToken.token;
}

export async function sendFcm(
  token: string,
  payload: FcmPayload,
): Promise<{ ok: boolean; expired?: boolean; error?: string }> {
  const sa = loadServiceAccount();
  if ("error" in sa) {
    console.error("[FCM] Bad service account:", sa.error);
    return { ok: false, error: sa.error };
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

  const body = {
    message: {
      token,
      notification: { title: payload.title, body: payload.body },
      data,
      android: {
        priority: "HIGH",
        notification: {
          sound: "default",
          ...(payload.tag ? { tag: payload.tag } : {}),
          click_action: "FCM_PLUGIN_ACTIVITY",
        },
      },
    },
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    let accessToken: string;
    try {
      accessToken = await getAccessToken(sa);
    } catch (e) {
      console.error("[FCM] oauth failed", e);
      return {
        ok: false,
        error: e instanceof Error ? e.message : "oauth_failed",
      };
    }

    let res: Response;
    try {
      res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
    } catch (e) {
      console.error("[FCM] send failed", e);
      return { ok: false, error: "network" };
    }

    if (res.ok) return { ok: true };

    const errJson = (await res.json().catch(() => ({}))) as {
      error?: { status?: string; message?: string };
    };
    const status = errJson.error?.status ?? "";
    const msg = errJson.error?.message ?? "";

    if (status === "NOT_FOUND" || status === "UNREGISTERED") {
      return { ok: false, expired: true, error: status };
    }
    if (res.status === 401 && attempt === 0) {
      cachedToken = null; // stale token — refresh once and retry
      continue;
    }
    console.error("[FCM] send rejected", res.status, status, msg);
    return { ok: false, error: `${status || `http_${res.status}`}` };
  }
  return { ok: false, error: "retry_failed" };
}
