import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(10),
  auth: z.string().min(5),
  userAgent: z.string().max(300).optional(),
});

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
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ endpoint: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    return { ok: true };
  });

async function fanout(userIds: string[], payload: Record<string, unknown>) {
  if (!userIds.length) return;
  const [{ supabaseAdmin }, { sendWebPush }] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("./webpush.server"),
  ]);
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);

  const expired: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        const { expired: gone } = await sendWebPush(s, payload);
        if (gone) expired.push(s.endpoint);
      } catch (error) {
  console.error("[WHATSXUP PUSH] Failed to send notification:", error);
}
  if (expired.length) await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expired);
}

export const notifyNewMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        preview: z.string().max(160),
        title: z.string().max(80),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: members, error } = await context.supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", data.conversationId);
    if (error) throw new Error(error.message);

    const recipients = (members ?? []).map((m) => m.user_id).filter((id) => id !== context.userId);
    await fanout(recipients, {
      kind: "message",
      title: data.title,
      body: data.preview,
      conversationId: data.conversationId,
      tag: `chat-${data.conversationId}`,
    });
    return { ok: true };
  });

export const notifyIncomingCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        calleeId: z.string().uuid(),
        kind: z.enum(["voice", "video"]),
        callerName: z.string().max(80),
        missed: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.calleeId === context.userId) return { ok: true };
    await fanout([data.calleeId], {
      kind: "call",
      title: "WHATSXUP",
      body: data.missed
        ? `Missed ${data.kind} call from ${data.callerName}`
        : `Incoming ${data.kind} call from ${data.callerName}`,
      conversationId: null,
      tag: `call-${context.userId}`,
    });
    return { ok: true };
  });
