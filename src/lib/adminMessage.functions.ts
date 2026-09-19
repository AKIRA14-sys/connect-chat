import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyNewMessage } from "@/lib/push.functions";

function masterEmailAllowed(claimsEmail: string | undefined): boolean {
  const allowed = String(
    process.env["MASTER_ADMIN_EMAIL"] ||
      process.env["VITE_MASTER_ADMIN_EMAIL"] ||
      "",
  )
    .trim()
    .toLowerCase();
  if (!allowed) return true;
  if (!claimsEmail) return false;
  return claimsEmail.trim().toLowerCase() === allowed;
}

function emailFromClaims(claims: unknown): string | undefined {
  if (!claims || typeof claims !== "object") return undefined;
  const c = claims as Record<string, unknown>;
  if (typeof c.email === "string") return c.email;
  return undefined;
}

/** Admin-only: send a direct text message as the admin user. */
export const adminSendDirectMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recipientId: string; text: string }) => {
    if (!input?.recipientId) throw new Error("Pick a recipient");
    const text = String(input.text || "").trim();
    if (!text) throw new Error("Message is empty");
    if (text.length > 4000) throw new Error("Message too long");
    return { recipientId: String(input.recipientId), text };
  })
  .handler(async ({ data, context }) => {
    const claims = (context as { claims?: unknown }).claims;
    if (!masterEmailAllowed(emailFromClaims(claims))) {
      throw new Error("Admin only");
    }
    const userId = (context as { userId: string }).userId;
    const supabase = (context as { supabase: any }).supabase;

    if (data.recipientId === userId) {
      throw new Error("Cannot message yourself");
    }

    // Prefer RPC if present
    let conversationId: string | null = null;
    const { data: rpcId, error: rpcErr } = await supabase.rpc(
      "get_or_create_direct",
      { p_other_user_id: data.recipientId },
    );
    if (!rpcErr && rpcId) {
      conversationId = typeof rpcId === "string" ? rpcId : rpcId?.id ?? null;
    }

    if (!conversationId) {
      throw new Error(
        rpcErr?.message ||
          "Could not open chat with that user (get_or_create_direct failed)",
      );
    }

    const { data: msg, error: insErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: data.text,
        type: "text",
      })
      .select("id")
      .single();

    if (insErr) throw new Error(insErr.message);

    try {
      await notifyNewMessage({
        data: {
          conversationId,
          title: "XUPPIN",
          preview: data.text.slice(0, 120),
        },
      });
    } catch {
      /* push optional */
    }

    return {
      ok: true,
      conversationId,
      messageId: msg?.id,
      message: "Message sent",
    };
  });

/** List contacts for AURA @ picker */
export const adminListContactsForAura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!masterEmailAllowed(emailFromClaims((context as { claims?: unknown }).claims))) {
      throw new Error("Admin only");
    }
    const userId = (context as { userId: string }).userId;
    const supabase = (context as { supabase: any }).supabase;

    const { data, error } = await supabase
      .from("contacts")
      .select("id, contact_id, profiles:contact_id(id, username, display_name, avatar_url)")
      .eq("owner_id", userId)
      .limit(200);

    if (error) throw new Error(error.message);

    return {
      contacts: (data ?? []).map((row: any) => ({
        id: row.contact_id as string,
        username: row.profiles?.username as string | null,
        display_name: row.profiles?.display_name as string | null,
        avatar_url: row.profiles?.avatar_url as string | null,
      })),
    };
  });
