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
  .validator((data: unknown) => subscriptionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: context.userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent ?? null,
        },
        {
          onConflict: "endpoint",
        },
      );

    if (error) {
      throw new Error(error.message);
    }

    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        endpoint: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);

    if (error) {
      throw new Error(error.message);
    }

    return { ok: true };
  });

async function fanout(
  userIds: string[],
  payload: Record<string, unknown>,
) {
  if (!userIds.length) return;

  const [{ supabaseAdmin }, { sendWebPush }] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("./webpush.server"),
  ]);

  const { data: subscriptions, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (error) {
    throw new Error(
      `Could not load push subscriptions: ${error.message}`,
    );
  }

  const expired: string[] = [];

  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      try {
        const result = await sendWebPush(
          subscription,
          payload,
        );

        if (result.expired) {
          expired.push(subscription.endpoint);
        }
      } catch (error) {
        console.error(
          "[WHATSXUP PUSH] Failed:",
          error,
        );
      }
    }),
  );

  if (expired.length) {
    await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expired);
  }
}

/*
 * ---------------------------------------------------------
 * MESSAGE NOTIFICATION
 * ---------------------------------------------------------
 */

export const notifyNewMessage = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        preview: z.string().max(160),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    /*
     * Find everyone in this conversation.
     */
    const { data: members, error: memberError } =
      await context.supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", data.conversationId);

    if (memberError) {
      throw new Error(memberError.message);
    }

    const recipients = (members ?? [])
      .map((member) => member.user_id)
      .filter(
        (userId) => userId !== context.userId,
      );

    if (!recipients.length) {
      return { ok: true };
    }

    /*
     * IMPORTANT:
     * Get the sender's profile directly from Supabase.
     *
     * This prevents "Unknown" when the client doesn't
     * have the profile loaded.
     */
    const { data: sender } = await context.supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();

    const senderName =
      sender?.display_name?.trim() ||
      sender?.username?.trim() ||
      "Someone";

    await fanout(recipients, {
      kind: "message",

      title: senderName,

      body: data.preview,

      conversationId: data.conversationId,

      avatar: sender?.avatar_url ?? null,

      tag: `chat-${data.conversationId}`,
    });

    return { ok: true };
  });

/*
 * ---------------------------------------------------------
 * INCOMING CALL NOTIFICATION
 * ---------------------------------------------------------
 */

export const notifyIncomingCall = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        calleeId: z.string().uuid(),
        kind: z.enum(["voice", "video"]),
        callId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.calleeId === context.userId) {
      return { ok: true };
    }

    /*
     * Get caller profile directly from Supabase.
     */
    const { data: caller } = await context.supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();

    const callerName =
      caller?.display_name?.trim() ||
      caller?.username?.trim() ||
      "Someone";

    await fanout([data.calleeId], {
      kind: "call",

      title:
        data.kind === "video"
          ? `Incoming video call`
          : `Incoming voice call`,

      body: `Call from ${callerName}`,

      callerName,

      callerId: context.userId,

      callerAvatar:
        caller?.avatar_url ?? null,

      callId: data.callId ?? null,

      conversationId: null,

      tag: `call-${context.userId}`,
    });

    return { ok: true };
  });