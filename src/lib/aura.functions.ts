import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  adminListShopCatalog,
  adminSetShopItemAvailable,
  adminUpsertShopItem,
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

const XUPPIN_KNOWLEDGE = `
You are AURA, the official XUPPIN admin co-pilot (not a generic chatbot).

## What XUPPIN is
XUPPIN is a messaging + social + gaming app (web PWA, TWA, Android APK).
Brand name users see: XUPPIN. Features include:

### Chats
- Direct messages and group chats
- Reply (swipe/long-press), reactions, stickers (emoji-as-sticker), voice messages
- Themes, wallpapers (image/video/CSS), chat bubbles, fonts
- Per-chat appearance and global main-chat wallpaper
- Offline cache for recent chats/messages where implemented
- Gifts (shop gifts → send in chat)
- Transfer / large file links (Xender-style + cloud link)

### Groups
- Create/join groups, admins, members, leave/delete
- Invite links: short app URL style join pages + optional preview
- Group info panel: members, ban/remove, description, avatar
- Slow mode, disappear messages, announce-only, join approval (where DB supports)

### Contacts & profiles
- Contacts list, usernames, profile pictures
- Nicknames (local display names)
- Gaming stats / badges when profile has opened Shop/Games once

### Shop (X Coins)
- Catalog of cosmetics: themes, wallpapers (static + live/video), badges, packs
- Buy with X Coins, equip/unequip
- Admin Control Room can add/edit items, prices, media, availability
- Unlimited coins toggle is ADMIN-ONLY for testing

### Games
- Local/bot games and online-style play where wired
- Gaming wallet (X Coins) on gaming Supabase

### XUP (social feed)
- Posts, images, comments, reshare (keep working; avoid breaking feed)

### Settings
- Telegram-inspired settings layout (unique wording)
- Appearance, privacy-style options, app lock, sounds where present
- Link to Control Room for master admin only

### Admin / Control Room (/admin)
- People: list users, suspend/ban (needs DB role for writes)
- Groups: list groups with avatar, creator, dates
- Shop/Gaming tab: manage shop items
- Tools: unlimited coins + open AURA
- Master admin gated by MASTER_ADMIN_EMAIL / VITE_MASTER_ADMIN_EMAIL

### AURA tools you can use via user commands
- list shop / shop list → full catalog from database
- hide NAME / show NAME → toggle availability
- unlimited coins on/off
- implement it → create shop item from last design
- design / badge / theme / wallpaper → OpenRouter design help

Be practical. When unsure about live data, tell the user to run "list shop".
Never invent fake item prices — use tool results.
`.trim();

/** Prefer models the free/dev Groq key actually has */
const GROQ_MODEL_CANDIDATES = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "groq/compound",
  "groq/compound-mini",
  "allam-2-7b",
  "qwen/qwen3.8-27b",
  "qwen/qwen3.6-27b",
];

async function listGroqModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { id?: string }[] };
    return (json.data || [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

async function resolveGroqModel(apiKey: string): Promise<string> {
  const forced = String(process.env["GROQ_MODEL"] || "").trim();
  if (forced) return forced;

  const available = await listGroqModels(apiKey);
  if (available.length) {
    for (const id of GROQ_MODEL_CANDIDATES) {
      if (available.includes(id)) return id;
    }
    const chat = available.find(
      (id) =>
        !id.includes("whisper") &&
        !id.includes("prompt-guard") &&
        !id.includes("orpheus"),
    );
    if (chat) return chat;
    return available[0];
  }
  return GROQ_MODEL_CANDIDATES[0];
}

async function callGroq(messages: AuraMessage[]): Promise<string> {
  const key = process.env["GROQ_API_KEY"] || "";
  if (!key) {
    return (
      "AURA is in tool mode (no GROQ_API_KEY). " +
      "You can still: list shop, hide/show items, unlimited coins on/off, implement it."
    );
  }

  const model = await resolveGroqModel(key);
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: XUPPIN_KNOWLEDGE },
        ...messages,
      ],
      temperature: 0.55,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    if (res.status === 404 || t.includes("model_not_found")) {
      const available = await listGroqModels(key);
      const hint =
        available.length > 0
          ? ` Models your key can use: ${available.slice(0, 12).join(", ")}. Set GROQ_MODEL on Vercel.`
          : " Set GROQ_MODEL=openai/gpt-oss-20b on Vercel.";
      throw new Error(`Groq model "${model}" not available.${hint}`);
    }
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

async function callOpenRouterVisual(prompt: string): Promise<{
  text: string;
  imageUrl?: string;
}> {
  const key = process.env["OPENROUTER_API_KEY"] || "";
  if (!key) {
    return {
      text: "OPENROUTER_API_KEY is not set. Add it on Vercel for design help.",
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
            "You design shop cosmetics for XUPPIN (themes, badges, wallpapers). " +
            "Return concrete name, colors (hex), CSS/bubble ideas, badge label. " +
            "End with a clear block the admin can implement into the shop.",
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
  const imgMatch = text.match(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/);
  const urlMatch = text.match(/https?:\/\/\S+\.(png|jpg|jpeg|webp|gif)/i);
  return { text, imageUrl: imgMatch?.[1] || urlMatch?.[0] };
}

function wantsVisual(text: string): boolean {
  const l = text.toLowerCase();
  return (
    (l.includes("design") ||
      l.includes("create badge") ||
      l.includes("create theme") ||
      l.includes("draw") ||
      l.includes("generate art")) &&
    (l.includes("badge") ||
      l.includes("theme") ||
      l.includes("wallpaper") ||
      l.includes("image") ||
      l.includes("logo") ||
      l.includes("icon") ||
      l.includes("anime"))
  );
}

function formatFullShopCatalog(
  categories: { category_id: string; name: string; description?: string | null }[],
  items: {
    item_id: string;
    category_id: string | null;
    name: string;
    description?: string | null;
    price_x_coins: number;
    available?: boolean;
    metadata?: Record<string, unknown> | null;
  }[],
): string {
  const byCat = new Map<string, typeof items>();
  const uncategorized: typeof items = [];

  for (const it of items) {
    if (!it.category_id) {
      uncategorized.push(it);
      continue;
    }
    const list = byCat.get(it.category_id) || [];
    list.push(it);
    byCat.set(it.category_id, list);
  }

  const lines: string[] = [];
  lines.push(`XUPPIN Shop catalog — ${items.length} item(s), ${categories.length} categor${categories.length === 1 ? "y" : "ies"}`);
  lines.push("");

  for (const cat of categories) {
    const list = byCat.get(cat.category_id) || [];
    lines.push(`▸ ${cat.name} (${list.length})`);
    if (cat.description) lines.push(`  ${cat.description}`);
    if (list.length === 0) {
      lines.push("  (empty)");
    } else {
      for (const it of list) {
        const meta = it.metadata || {};
        const ctype =
          typeof meta.cosmetic_type === "string"
            ? meta.cosmetic_type
            : typeof meta.type === "string"
              ? meta.type
              : "";
        const flag = it.available === false ? " [HIDDEN]" : "";
        lines.push(
          `  • ${it.name} — ${it.price_x_coins} X Coins${ctype ? ` · ${ctype}` : ""}${flag}`,
        );
        if (it.description?.trim()) {
          lines.push(`    ${it.description.trim().slice(0, 120)}`);
        }
      }
    }
    lines.push("");
  }

  if (uncategorized.length) {
    lines.push(`▸ Uncategorized (${uncategorized.length})`);
    for (const it of uncategorized) {
      const flag = it.available === false ? " [HIDDEN]" : "";
      lines.push(`  • ${it.name} — ${it.price_x_coins} X Coins${flag}`);
    }
    lines.push("");
  }

  lines.push("Commands: hide NAME | show NAME | implement it | unlimited coins on/off");
  return lines.join("\n").trim();
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
          content: String(m.content || "").slice(0, 12000),
        }))
        .slice(-40),
    };
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context as { claims?: unknown });
    const last = data.messages[data.messages.length - 1]?.content || "";
    const lower = last.toLowerCase().trim();

    // --- Full shop list (NO CAP) ---
    if (
      lower === "list shop" ||
      lower === "shop list" ||
      lower === "list shops" ||
      lower === "list everything" ||
      lower.includes("list all shop") ||
      lower.includes("list the shop") ||
      lower.includes("what is in the shop") ||
      lower.includes("what's in the shop") ||
      lower.includes("show shop") ||
      lower.includes("shop catalog") ||
      lower.includes("list items")
    ) {
      const cat = await adminListShopCatalog();
      const text = formatFullShopCatalog(
        (cat.categories || []) as {
          category_id: string;
          name: string;
          description?: string | null;
        }[],
        (cat.items || []) as {
          item_id: string;
          category_id: string | null;
          name: string;
          description?: string | null;
          price_x_coins: number;
          available?: boolean;
          metadata?: Record<string, unknown> | null;
        }[],
      );
      return { reply: text, imageUrl: null as string | null, tool: "shop_list_full" };
    }

    if (
      lower === "unlimited coins on" ||
      lower === "coins on" ||
      lower.includes("turn unlimited coins on")
    ) {
      const res = await setAdminUnlimitedCoins({ data: { enabled: true } });
      return { reply: res.message, imageUrl: null, tool: "unlimited_coins_on" };
    }
    if (
      lower === "unlimited coins off" ||
      lower === "coins off" ||
      lower.includes("turn unlimited coins off")
    ) {
      const res = await setAdminUnlimitedCoins({ data: { enabled: false } });
      return { reply: res.message, imageUrl: null, tool: "unlimited_coins_off" };
    }

    if (lower.startsWith("hide ") || lower.startsWith("show ")) {
      const hide = lower.startsWith("hide ");
      const name = last.slice(5).trim().toLowerCase();
      const cat = await adminListShopCatalog();
      const item = (cat.items || []).find(
        (i: { name: string }) =>
          i.name.toLowerCase() === name ||
          i.name.toLowerCase().includes(name),
      );
      if (!item) {
        return {
          reply: `No shop item matching "${last.slice(5).trim()}". Say "list shop" to see every name.`,
          imageUrl: null,
          tool: "shop_toggle",
        };
      }
      await adminSetShopItemAvailable({
        data: {
          itemId: (item as { item_id: string }).item_id,
          available: !hide,
        },
      });
      return {
        reply: hide
          ? `Hidden "${(item as { name: string }).name}" from the shop.`
          : `Showing "${(item as { name: string }).name}" again.`,
        imageUrl: null,
        tool: "shop_toggle",
      };
    }

    // --- Implement into shop ---
    if (
      lower === "implement it" ||
      lower === "implement" ||
      lower.startsWith("implement as ") ||
      lower.startsWith("add to shop") ||
      lower.startsWith("create shop item")
    ) {
      const prevAssistant = [...data.messages]
        .reverse()
        .find((m) => m.role === "assistant");
      const designText = prevAssistant?.content || last;

      let cosmetic_type: "badge" | "theme" | "wallpaper" = "badge";
      if (lower.includes("theme") || /theme/i.test(designText)) {
        cosmetic_type = "theme";
      } else if (
        lower.includes("wallpaper") ||
        /wallpaper/i.test(designText)
      ) {
        cosmetic_type = "wallpaper";
      }

      const nameMatch = designText.match(
        /(?:name|title|badge|theme)\s*[:\-–]\s*([^\n]+)/i,
      );
      const name = (
        nameMatch?.[1] ||
        designText.split("\n").find((l) => l.trim().length > 3)?.slice(0, 48) ||
        `AURA ${cosmetic_type}`
      )
        .replace(/[*#`]/g, "")
        .trim()
        .slice(0, 60);

      const priceMatch = last.match(/(\d+)\s*coins?/i);
      const price = Math.max(1, priceMatch ? Number(priceMatch[1]) : 50);

      const hexes =
        designText.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g) || [];
      const bg = hexes[0] || "#1a1a2e";
      const accent = hexes[1] || "#e94560";

      // Optional category match by name in command: "implement as badge under Themes"
      const cat = await adminListShopCatalog();
      let categoryId: string | null = null;
      const underMatch = lower.match(/under\s+([a-z0-9 \-_]+)/i);
      if (underMatch) {
        const want = underMatch[1].trim();
        const found = (cat.categories || []).find((c: { name: string }) =>
          c.name.toLowerCase().includes(want),
        );
        if (found) categoryId = (found as { category_id: string }).category_id;
      }

      const metadata: Record<string, unknown> = {
        cosmetic_type,
        source: "aura_implement",
        design_notes: designText.slice(0, 2000),
      };

      if (cosmetic_type === "theme") {
        metadata.background = bg;
        metadata.colors = {
          background: bg,
          bubbleMine: accent,
          bubbleOther: "#2a2a3e",
        };
        metadata.bubbleMine = accent;
        metadata.bubbleOther = "#2a2a3e";
      } else if (cosmetic_type === "badge") {
        metadata.label = name.slice(0, 24);
        metadata.color = accent;
        metadata.background = bg;
      } else {
        metadata.variants = [];
      }

      const created = await adminUpsertShopItem({
        data: {
          itemId: null,
          categoryId,
          name,
          description: designText.slice(0, 280),
          priceXCoins: price,
          available: true,
          uniqueOwnership: true,
          metadata,
          previewUrl: null,
        },
      });

      return {
        reply: `Implemented in the XUPPIN shop as "${name}" (${cosmetic_type}) for ${price} X Coins${categoryId ? " in matched category" : ""}.\nOpen Shop → buy → equip.\nSay "list shop" to see the full catalog including this item.`,
        imageUrl: null,
        tool: "implement_shop",
        itemId: (created as { item?: { item_id?: string } })?.item?.item_id,
      };
    }

    if (wantsVisual(last)) {
      const visual = await callOpenRouterVisual(last);
      return {
        reply:
          visual.text +
          "\n\nWhen ready, say: implement it   (or: implement as theme 80 coins)",
        imageUrl: visual.imageUrl || null,
        tool: "openrouter_visual",
      };
    }

    // Inject live shop summary into context for smarter answers (names only, full on list shop)
    let extra = "";
    if (
      lower.includes("shop") ||
      lower.includes("theme") ||
      lower.includes("badge") ||
      lower.includes("wallpaper") ||
      lower.includes("price") ||
      lower.includes("catalog")
    ) {
      try {
        const cat = await adminListShopCatalog();
        const items = cat.items || [];
        extra =
          `\n\n[Live shop snapshot: ${items.length} items. Categories: ${(cat.categories || []).map((c: { name: string }) => c.name).join(", ") || "none"}. ` +
          `Sample names: ${items
            .slice(0, 15)
            .map((i: { name: string }) => i.name)
            .join(", ")}. For the COMPLETE list the user should say "list shop".]`;
      } catch {
        /* ignore */
      }
    }

    const msgs = data.messages.map((m, idx) =>
      idx === data.messages.length - 1 && m.role === "user"
        ? { ...m, content: m.content + extra }
        : m,
    );

    const reply = await callGroq(msgs);
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
