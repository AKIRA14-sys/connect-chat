import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* =========================================================
 * SUBSCRIPTION SCHEMA
 * ========================================================= */

const subscriptionSchema =
  z.object({
    endpoint:
      z.string().url(),

    p256dh:
      z.string().min(10),

    auth:
      z.string().min(5),

    userAgent:
      z.string().max(300).optional(),
  });

/* =========================================================
 * SAVE PUSH SUBSCRIPTION
 * ========================================================= */

export const savePushSubscription =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (data: unknown) =>
        subscriptionSchema.parse(
          data,
        ),
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        const {
          error,
        } =
          await context.supabase
            .from(
              "push_subscriptions",
            )
            .upsert(
              {
                user_id:
                  context.userId,

                endpoint:
                  data.endpoint,

                p256dh:
                  data.p256dh,

                auth:
                  data.auth,

                user_agent:
                  data.userAgent ??
                  null,
              },
              {
                onConflict:
                  "endpoint",
              },
            );

        if (error) {
          throw new Error(
            `Could not save push subscription: ${error.message}`,
          );
        }

        return {
          ok: true,
        };
      },
    );

/* =========================================================
 * REMOVE PUSH SUBSCRIPTION
 * ========================================================= */

export const removePushSubscription =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (data: unknown) =>
        z
          .object({
            endpoint:
              z.string().url(),
          })
          .parse(data),
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        const {
          error,
        } =
          await context.supabase
            .from(
              "push_subscriptions",
            )
            .delete()
            .eq(
              "endpoint",
              data.endpoint,
            )
            .eq(
              "user_id",
              context.userId,
            );

        if (error) {
          throw new Error(
            error.message,
          );
        }

        return {
          ok: true,
        };
      },
    );

/* =========================================================
 * SEND TO SUBSCRIPTIONS
 * ========================================================= */

async function fanout(
  userIds: string[],
  payload: Record<
    string,
    unknown
  >,
) {
  if (!userIds.length) {
    return {
      sent: 0,
      expired: 0,
      failed: 0,
    };
  }

  const [
    {
      supabaseAdmin,
    },
    {
      sendWebPush,
    },
  ] =
    await Promise.all([
      import(
        "@/integrations/supabase/client.server"
      ),

      import(
        "./webpush.server"
      ),
    ]);

  const {
    data: subscriptions,
    error,
  } =
    await supabaseAdmin
      .from(
        "push_subscriptions",
      )
      .select(
        "endpoint, p256dh, auth",
      )
      .in(
        "user_id",
        userIds,
      );

  if (error) {
    throw new Error(
      `Could not load push subscriptions: ${error.message}`,
    );
  }

  if (
    !subscriptions?.length
  ) {
    console.warn(
      "[WHATSXUP PUSH] Recipient has no push subscription.",
    );

    return {
      sent: 0,
      expired: 0,
      failed: 0,
    };
  }

  const expired: string[] =
    [];

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(
      async (subscription) => {
        try {
          const result =
            await sendWebPush(
              subscription,
              payload,
            );

          if (
            result.expired
          ) {
            expired.push(
              subscription.endpoint,
            );
          } else {
            sent++;
          }
        } catch (error) {
          failed++;

          console.error(
            "[WHATSXUP PUSH] Delivery failed:",
            error,
          );
        }
      },
    ),
  );

  /*
   * Delete dead subscriptions.
   */

  if (expired.length) {
    await supabaseAdmin
      .from(
        "push_subscriptions",
      )
      .delete()
      .in(
        "endpoint",
        expired,
      );
  }

  /*
   * Do not silently pretend everything
   * succeeded if every push failed.
   */

  if (
    sent === 0 &&
    failed > 0
  ) {
    throw new Error(
      "Web Push delivery failed for all recipient devices.",
    );
  }

  return {
    sent,
    expired:
      expired.length,
    failed,
  };
}

/* =========================================================
 * MESSAGE NOTIFICATION
 * ========================================================= */

export const notifyNewMessage =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (data: unknown) =>
        z
          .object({
            conversationId:
              z.string().uuid(),

            preview:
              z.string().max(160),

            title:
              z.string().max(80),
          })
          .parse(data),
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        const {
          data: members,
          error,
        } =
          await context.supabase
            .from(
              "conversation_members",
            )
            .select(
              "user_id",
            )
            .eq(
              "conversation_id",
              data.conversationId,
            );

        if (error) {
          throw new Error(
            error.message,
          );
        }

        const recipients =
          (members ?? [])
            .map(
              (member) =>
                member.user_id,
            )
            .filter(
              (id) =>
                id !==
                context.userId,
            );

        if (
          !recipients.length
        ) {
          return {
            ok: true,
            sent: 0,
          };
        }

        const result =
          await fanout(
            recipients,
            {
              kind:
                "message",

              title:
                data.title,

              body:
                data.preview,

              conversationId:
                data.conversationId,

              tag:
                `chat-${data.conversationId}`,
            },
          );

        return {
          ok: true,
          ...result,
        };
      },
    );

/* =========================================================
 * INCOMING CALL NOTIFICATION
 * ========================================================= */

export const notifyIncomingCall =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (data: unknown) =>
        z
          .object({
            calleeId:
              z.string().uuid(),

            kind:
              z.enum([
                "voice",
                "video",
              ]),

            callerName:
              z.string().max(80),

            callerAvatar:
              z
                .string()
                .nullable()
                .optional(),

            callId:
              z
                .string()
                .uuid()
                .nullable()
                .optional(),

            missed:
              z.boolean()
                .optional(),
          })
          .parse(data),
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        if (
          data.calleeId ===
          context.userId
        ) {
          return {
            ok: true,
            sent: 0,
          };
        }

        const result =
          await fanout(
            [data.calleeId],
            {
              kind:
                "call",

              title:
                data.callerName,

              body:
                data.missed
                  ? `Missed ${data.kind} call`
                  : `Incoming ${data.kind} call`,

              conversationId:
                null,

              callId:
                data.callId ??
                null,

              callerId:
                context.userId,

              callerName:
                data.callerName,

              callerAvatar:
                data.callerAvatar ??
                null,

              callKind:
                data.kind,

              tag:
                `call-${context.userId}`,
            },
          );

        return {
          ok: true,
          ...result,
        };
      },
    );