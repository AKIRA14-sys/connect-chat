import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* =========================================================
 * SUBSCRIPTION SCHEMA
 * ========================================================= */

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(10),
  auth: z.string().min(5),
  userAgent: z.string().max(300).optional(),
});

/* =========================================================
 * SAVE PUSH SUBSCRIPTION
 * ========================================================= */

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => subscriptionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );

    if (error) throw new Error(`Could not save push subscription: ${error.message}`);
    return { ok: true };
  });

/* =========================================================
 * REMOVE PUSH SUBSCRIPTION
 * ========================================================= */

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ endpoint: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* =========================================================
 * SAVE FCM TOKEN (native Android push)
 * ========================================================= */

export const saveFcmToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ token: z.string().min(20) }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("fcm_tokens").upsert(
      {
        user_id: context.userId,
        token: data.token,
      },
      { onConflict: "token" },
    );

    if (error) throw new Error(`Could not save FCM token: ${error.message}`);
    return { ok: true };
  });

/* =========================================================
 * FANOUT
 *
 * Runs with the service role so it can read the recipients'
 * subscriptions. The caller is always an authenticated user
 * whose membership was verified before we get here.
 * ========================================================= */

type PrefKey =
  | "notify_messages"
  | "notify_groups"
  | "notify_voice_calls"
  | "notify_video_calls"
  | "notify_xups";

async function fanout(
  userIds: string[],
  payload: Record<string, unknown>,
  prefKey: PrefKey,
) {
  const targets = Array.from(new Set(userIds.filter(Boolean)));
  if (!targets.length) return { sent: 0, expired: 0, failed: 0, skipped: 0 };

  const [{ supabaseAdmin }, { sendWebPush }] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("./webpush.server"),
  ]);

  /* Respect each recipient's notification preferences and account status. */
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select(`id, status, ${prefKey}`)
    .in("id", targets);

  const allowed = (profiles ?? [])
    .filter((p) => {
      const row = p as unknown as Record<string, unknown>;
      return row["status"] === "active" && row[prefKey] !== false;
    })
    .map((p) => (p as unknown as { id: string }).id);

  const skipped = targets.length - allowed.length;
  if (!allowed.length) return { sent: 0, expired: 0, failed: 0, skipped };

  const { data: subscriptions, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", allowed);

  if (error) throw new Error(`Could not load push subscriptions: ${error.message}`);
  if (!subscriptions?.length) return { sent: 0, expired: 0, failed: 0, skipped };

  const expired: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        const result = await sendWebPush(subscription, payload);
        if (result.expired) expired.push(subscription.endpoint);
        else sent++;
      } catch (err) {
        failed++;
        console.error("[WHATSXUP PUSH] Delivery failed:", err);
      }
    }),
  );

  /* Clean up dead subscriptions. */
  if (expired.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expired);
  }

  return { sent, expired: expired.length, failed, skipped };
}

/* Signed URL for a private avatar so the service worker can render it. */
async function avatarUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.storage.from("avatars").createSignedUrl(path, 60 * 60 * 12);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/* =========================================================
 * MESSAGE NOTIFICATION
 * ========================================================= */

export const notifyNewMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        preview: z.string().max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    /* RLS: the sender can only read members of conversations they belong to. */
    const { data: members, error } = await context.supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", data.conversationId);

    if (error) throw new Error(error.message);

    const recipients = (members ?? [])
      .map((m) => m.user_id)
      .filter((id) => id !== context.userId);

    if (!recipients.length) return { ok: true, sent: 0 };

    const [{ data: conv }, { data: me }] = await Promise.all([
      context.supabase
        .from("conversations")
        .select("type, name")
        .eq("id", data.conversationId)
        .maybeSingle(),
      context.supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);

    const senderName = me?.display_name?.trim() || (me?.username ? `@${me.username}` : "WHATSXUP");
    const isGroup = conv?.type === "group";
    const title = isGroup ? conv?.name?.trim() || "Group" : senderName;
    const body = isGroup ? `${senderName}: ${data.preview}` : data.preview;

    const result = await fanout(
      recipients,
      {
        kind: "message",
        title,
        body: body.slice(0, 200),
        conversationId: data.conversationId,
        icon: await avatarUrl(me?.avatar_url),
        tag: `chat-${data.conversationId}`,
      },
      isGroup ? "notify_groups" : "notify_messages",
    );

    return { ok: true, ...result };
  });

/* =========================================================
 * INCOMING CALL NOTIFICATION
 * ========================================================= */

export const notifyIncomingCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        calleeId: z.string().uuid(),
        kind: z.enum(["voice", "video"]),
        callerName: z.string().max(80).optional(),
        callerAvatar: z.string().nullable().optional(),
        callId: z.string().uuid().nullable().optional(),
        missed: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.calleeId === context.userId) return { ok: true, sent: 0 };

    const { data: me } = await context.supabase
      .from("profiles")
      .select("display_name, username, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();

    const callerName =
      data.callerName?.trim() ||
      me?.display_name?.trim() ||
      (me?.username ? `@${me.username}` : "WHATSXUP");

    const icon = await avatarUrl(data.callerAvatar ?? me?.avatar_url);

    const result = await fanout(
      [data.calleeId],
      {
        kind: "call",
        title: callerName,
        body: data.missed
          ? `Missed ${data.kind} call`
          : data.kind === "video"
            ? "Incoming video call"
            : "Incoming voice call",
        callId: data.callId ?? null,
        callerId: context.userId,
        callerName,
        callerAvatar: icon,
        icon,
        callKind: data.kind,
        tag: `call-${context.userId}`,
      },
      data.kind === "video" ? "notify_video_calls" : "notify_voice_calls",
    );

    return { ok: true, ...result };
  });