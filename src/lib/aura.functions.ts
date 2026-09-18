import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  adminListShopCatalog,
  adminSetShopItemAvailable,
} from "@/lib/shopAdmin.functions";
import {
  getAdminUnlimitedCoins,
  setAdminUnlimitedCoins,
} from "@/lib/adminCoins.functions";

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

function assertAdmin(context: { claims?: unknown }) {
  if (!masterEmailAllowed(emailFromClaims(context.claims))) {
    throw new Error("AURA is admin-only for now");
  }
}

export type AuraMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AuraChatInput = {
  messages: AuraMessage[];
};

const SYSTEM = `You are AURA, the admin assistant for XUPPIN (chat + shop + games).
Help the app owner only. Be clear and practical.

You can discuss shop items, themes, badges, prices, unlimited coins, and admin ideas.
If the user wants unlimited coins, they can say "turn unlimited coins on" or "off".
For image / badge / theme VISUAL generation, the system may route to OpenRouter.
Do not claim you changed the database unless a tool result confirms it.`;

/** Main brain: Groq (GROQ_API_KEY) — text, reasoning, admin Q&A */
async function callGroq(messages: AuraMessage[]): Promise<string> {
  const key = process.env["GROQ_API_KEY"] || "";
  if (!key) {
    return (
      "AURA is online in tool mode (no GROQ_API_KEY yet). " +
      "Add GROQ_API_KEY on Vercel for full chat. " +
      "You can still say: unlimited coins on/off, list shop, hide ITEM, design a badge…"
    );
  }

  const model =
    process.env["GROQ_MODEL"] || "llama-3.3-70b-versatile";

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: SYSTEM }, ...messages],
      temperature: 0.6,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq error: ${res.status} ${t.slice(0, 240)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return (
    json.choices?.[0]?.message?.content?.trim() ||
    "I could not generate a reply."
  );
}

/**
 * OpenRouter — images, badge/theme design, visual creative work.
 * Returns text design brief and optional image URL if the model returns one.
 */
async function callOpenRouterVisual(prompt: string): Promise<{
  text: string;
  imageUrl?: string;
}> {
  const key = process.env["OPENROUTER_API_KEY"] || "";
  if (!key) {
    return {
      text: "OPENROUTER_API_KEY is not set. Add it on Vercel for image/theme/badge design.",
    };
  }

  const model =
    process.env["OPENROUTER_MODEL"] ||
    process.env["OPENROUTER_IMAGE_MODEL"] ||
    "openai/gpt-4o-mini";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": process.env["APP_URL"] || "https://xuppin.vercel.app",
      "X-Title": "XUPPIN AURA",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You help design shop themes, badges, wallpapers, and UI for a mobile chat app (XUPPIN). " +
            "Give concrete colors, emoji, CSS ideas, badge text, and image prompts. " +
            "If you can output a markdown image URL, include it.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenRouter error: ${res.status} ${t.slice(0, 240)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text =
    json.choices?.[0]?.message?.content?.trim() || "No design output.";

  // Pull first markdown image if present
  const imgMatch = text.match(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/);
  const urlMatch = text.match(/https?:\/\/\S+\.(png|jpg|jpeg|webp|gif)/i);

  return {
    text,
    imageUrl: imgMatch?.[1] || urlMatch?.[0],
  };
}

function wantsVisual(text: string): boolean {
  const l = text.toLowerCase();
  return (
    l.includes("image") ||
    l.includes("picture") ||
    l.includes("photo") ||
    l.includes("badge") ||
    l.includes("theme") ||
    l.includes("wallpaper") ||
    l.includes("design") ||
    l.includes("draw") ||
    l.includes("generate art") ||
    l.includes("logo") ||
    l.includes("icon")
  );
}

export const auraChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AuraChatInput) => {
    if (!input?.messages || !Array.isArray(input.messages)) {
      throw new Error("messages required");
    }
    return {
      messages: input.messages
        .filter((m) => m && (m.role === "user" || m.role === "assistant"))
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: String(m.content || "").slice(0, 8000),
        }))
        .slice(-20),
    };
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context as { claims?: unknown });
    const last = data.messages[data.messages.length - 1]?.content || "";
    const lower = last.toLowerCase().trim();

    // --- Tools (no API required) ---
    if (
      lower === "unlimited coins on" ||
      lower === "coins on" ||
      lower.includes("turn unlimited coins on")
    ) {
      const res = await setAdminUnlimitedCoins({ data: { enabled: true } });
      return { reply: res.message, imageUrl: null as string | null, tool: "unlimited_coins_on" };
    }
    if (
      lower === "unlimited coins off" ||
      lower === "coins off" ||
      lower.includes("turn unlimited coins off")
    ) {
      const res = await setAdminUnlimitedCoins({ data: { enabled: false } });
      return { reply: res.message, imageUrl: null, tool: "unlimited_coins_off" };
    }
    if (lower === "list shop" || lower === "shop list") {
      const cat = await adminListShopCatalog();
      const lines = (cat.items || [])
        .slice(0, 40)
        .map(
          (i) =>
            `• ${i.name} — ${i.price_x_coins} coins${i.available ? "" : " (hidden)"}`,
        );
      return {
        reply:
          lines.length > 0
            ? `Shop items:\n${lines.join("\n")}`
            : "No shop items yet.",
        imageUrl: null,
        tool: "shop_list",
      };
    }
    if (lower.startsWith("hide ") || lower.startsWith("show ")) {
      const hide = lower.startsWith("hide ");
      const name = last.slice(5).trim().toLowerCase();
      const cat = await adminListShopCatalog();
      const item = (cat.items || []).find(
        (i) =>
          i.name.toLowerCase() === name ||
          i.name.toLowerCase().includes(name),
      );
      if (!item) {
        return {
          reply: "No item matching that name.",
          imageUrl: null,
          tool: "shop_toggle",
        };
      }
      await adminSetShopItemAvailable({
        data: { itemId: item.item_id, available: !hide },
      });
      return {
        reply: hide
          ? `Hidden "${item.name}" from the shop.`
          : `Showing "${item.name}" again.`,
        imageUrl: null,
        tool: "shop_toggle",
      };
    }

    // --- Visual / design → OpenRouter ---
    if (wantsVisual(last)) {
      const visual = await callOpenRouterVisual(last);
      return {
        reply: visual.text,
        imageUrl: visual.imageUrl || null,
        tool: "openrouter_visual",
      };
    }

    // --- Main chat → Groq ---
    const reply = await callGroq(data.messages);
    return { reply, imageUrl: null, tool: "groq" };
  });

export const getAuraStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context as { claims?: unknown });
    const coins = await getAdminUnlimitedCoins();
    return {
      name: "AURA",
      unlimitedCoins: coins.enabled,
      hasGroq: Boolean(process.env["GROQ_API_KEY"]),
      hasOpenRouter: Boolean(process.env["OPENROUTER_API_KEY"]),
    };
  });
