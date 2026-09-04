/**
 * XUPPIN Shop Chat Bubbles
 *
 * Code-based chat bubble cosmetics.
 *
 * This file is intentionally independent from the existing
 * chat rendering system.
 *
 * Later:
 *
 * Shop purchase
 *      ↓
 * user_inventory
 *      ↓
 * equip
 *      ↓
 * local device storage
 *      ↓
 * $id.tsx
 *      ↓
 * actual message bubble
 *
 * No image is required for these bubbles.
 */

export type ShopBubbleId =
  | "default"
  | "classic"
  | "rounded"
  | "soft"
  | "glass"
  | "neon"
  | "cyber"
  | "gaming"
  | "anime"
  | "fire"
  | "ice"
  | "ocean"
  | "purple"
  | "emerald"
  | "gold"
  | "midnight"
  | "bubble-pop"
  | "shadow"
  | "outline"
  | "gradient"
  | "pixel"
  | "royal"
  | "sunset";

export interface ShopBubble {
  id: ShopBubbleId | string;
  name: string;
  description: string;

  /**
   * CSS styles for the user's own messages.
   */
  mine: ShopBubbleStyle;

  /**
   * CSS styles for incoming messages.
   */
  theirs: ShopBubbleStyle;

  /**
   * Optional metadata for Shop/Admin Panel.
   */
  metadata?: Record<string, unknown>;
}

export interface ShopBubbleStyle {
  background: string;
  color: string;

  border?: string;
  borderRadius?: string;

  boxShadow?: string;

  backgroundImage?: string;

  backdropFilter?: string;
  WebkitBackdropFilter?: string;

  opacity?: number;

  fontWeight?: number;

  /**
   * Useful for futuristic/pixel styles.
   */
  letterSpacing?: string;
}

/**
 * Built-in code-based bubbles.
 *
 * These require no image files.
 */
export const SHOP_BUBBLES: Record<
  string,
  ShopBubble
> = {
  default: {
    id: "default",
    name: "Default",
    description:
      "The normal XUPPIN chat bubble.",

    mine: {
      background: "var(--primary)",
      color: "var(--primary-foreground)",
      borderRadius: "1rem",
    },

    theirs: {
      background: "var(--surface, #f1f5f9)",
      color: "var(--foreground, #0f172a)",
      borderRadius: "1rem",
    },

    metadata: {
      category: "standard",
      builtIn: true,
    },
  },

  classic: {
    id: "classic",
    name: "Classic",
    description:
      "A clean traditional chat bubble.",

    mine: {
      background: "#2563eb",
      color: "#ffffff",
      borderRadius: "0.9rem",
    },

    theirs: {
      background: "#e5e7eb",
      color: "#111827",
      borderRadius: "0.9rem",
    },

    metadata: {
      category: "classic",
      builtIn: true,
    },
  },

  rounded: {
    id: "rounded",
    name: "Extra Rounded",
    description:
      "A soft bubble with extra rounded corners.",

    mine: {
      background: "#2563eb",
      color: "#ffffff",
      borderRadius: "1.75rem",
    },

    theirs: {
      background: "#e5e7eb",
      color: "#111827",
      borderRadius: "1.75rem",
    },

    metadata: {
      category: "soft",
      builtIn: true,
    },
  },

  soft: {
    id: "soft",
    name: "Soft",
    description:
      "A gentle pastel-style conversation bubble.",

    mine: {
      background: "#818cf8",
      color: "#ffffff",
      borderRadius: "1.4rem",
      boxShadow: "0 4px 14px rgba(99,102,241,0.18)",
    },

    theirs: {
      background: "#eef2ff",
      color: "#312e81",
      borderRadius: "1.4rem",
    },

    metadata: {
      category: "pastel",
      builtIn: true,
    },
  },

  glass: {
    id: "glass",
    name: "Glass",
    description:
      "A translucent glass-style chat bubble.",

    mine: {
      background:
        "rgba(59,130,246,0.55)",
      color: "#ffffff",
      border:
        "1px solid rgba(255,255,255,0.28)",
      borderRadius: "1.25rem",
      boxShadow:
        "0 8px 25px rgba(0,0,0,0.12)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    },

    theirs: {
      background:
        "rgba(255,255,255,0.60)",
      color: "#111827",
      border:
        "1px solid rgba(255,255,255,0.35)",
      borderRadius: "1.25rem",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    },

    metadata: {
      category: "glass",
      builtIn: true,
    },
  },

  neon: {
    id: "neon",
    name: "Neon",
    description:
      "A bright futuristic neon chat bubble.",

    mine: {
      background:
        "linear-gradient(135deg, #7c3aed, #06b6d4)",
      color: "#ffffff",
      border:
        "1px solid rgba(103,232,249,0.7)",
      borderRadius: "1.15rem",
      boxShadow:
        "0 0 14px rgba(34,211,238,0.45), 0 0 30px rgba(124,58,237,0.28)",
    },

    theirs: {
      background:
        "rgba(15,23,42,0.92)",
      color: "#67e8f9",
      border:
        "1px solid rgba(103,232,249,0.45)",
      borderRadius: "1.15rem",
      boxShadow:
        "0 0 10px rgba(34,211,238,0.15)",
    },

    metadata: {
      category: "futuristic",
      builtIn: true,
    },
  },

  cyber: {
    id: "cyber",
    name: "Cyber",
    description:
      "A dark futuristic cyber-style bubble.",

    mine: {
      background:
        "linear-gradient(135deg, #111827, #1e1b4b)",
      color: "#a5f3fc",
      border:
        "1px solid #22d3ee",
      borderRadius: "0.55rem",
      boxShadow:
        "0 0 12px rgba(34,211,238,0.25)",
      letterSpacing: "0.01em",
    },

    theirs: {
      background: "#020617",
      color: "#c4b5fd",
      border:
        "1px solid rgba(139,92,246,0.55)",
      borderRadius: "0.55rem",
    },

    metadata: {
      category: "cyber",
      builtIn: true,
    },
  },

  gaming: {
    id: "gaming",
    name: "Gaming",
    description:
      "A bold gaming-inspired chat bubble.",

    mine: {
      background:
        "linear-gradient(135deg, #16a34a, #22c55e)",
      color: "#ffffff",
      border:
        "2px solid rgba(187,247,208,0.75)",
      borderRadius: "0.65rem",
      boxShadow:
        "0 5px 18px rgba(22,163,74,0.28)",
      fontWeight: 700,
    },

    theirs: {
      background: "#172033",
      color: "#d1fae5",
      border:
        "1px solid rgba(34,197,94,0.35)",
      borderRadius: "0.65rem",
    },

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  anime: {
    id: "anime",
    name: "Anime",
    description:
      "A colorful anime-inspired chat bubble.",

    mine: {
      background:
        "linear-gradient(135deg, #ec4899, #8b5cf6)",
      color: "#ffffff",
      borderRadius: "1.35rem",
      boxShadow:
        "0 5px 18px rgba(236,72,153,0.25)",
    },

    theirs: {
      background: "#fdf2f8",
      color: "#831843",
      borderRadius: "1.35rem",
    },

    metadata: {
      category: "anime",
      builtIn: true,
    },
  },

  fire: {
    id: "fire",
    name: "Fire",
    description:
      "A fiery orange-red bubble.",

    mine: {
      background:
        "linear-gradient(135deg, #ef4444, #f97316, #facc15)",
      color: "#ffffff",
      borderRadius: "1.05rem",
      boxShadow:
        "0 5px 20px rgba(249,115,22,0.3)",
      fontWeight: 600,
    },

    theirs: {
      background: "#431407",
      color: "#fed7aa",
      borderRadius: "1.05rem",
    },

    metadata: {
      category: "element",
      builtIn: true,
    },
  },

  ice: {
    id: "ice",
    name: "Ice",
    description:
      "A cool icy-blue bubble.",

    mine: {
      background:
        "linear-gradient(135deg, #38bdf8, #60a5fa)",
      color: "#ffffff",
      border:
        "1px solid rgba(255,255,255,0.5)",
      borderRadius: "1.2rem",
      boxShadow:
        "0 5px 20px rgba(56,189,248,0.25)",
    },

    theirs: {
      background: "#e0f2fe",
      color: "#075985",
      borderRadius: "1.2rem",
    },

    metadata: {
      category: "element",
      builtIn: true,
    },
  },

  ocean: {
    id: "ocean",
    name: "Ocean",
    description:
      "A deep blue ocean-inspired bubble.",

    mine: {
      background:
        "linear-gradient(135deg, #0369a1, #0e7490)",
      color: "#ffffff",
      borderRadius: "1.1rem",
      boxShadow:
        "0 5px 18px rgba(3,105,161,0.3)",
    },

    theirs: {
      background: "#082f49",
      color: "#bae6fd",
      borderRadius: "1.1rem",
    },

    metadata: {
      category: "nature",
      builtIn: true,
    },
  },

  purple: {
    id: "purple",
    name: "Purple Dream",
    description:
      "A purple fantasy-style conversation bubble.",

    mine: {
      background:
        "linear-gradient(135deg, #7e22ce, #a855f7)",
      color: "#ffffff",
      borderRadius: "1.25rem",
      boxShadow:
        "0 5px 20px rgba(168,85,247,0.3)",
    },

    theirs: {
      background: "#3b0764",
      color: "#e9d5ff",
      borderRadius: "1.25rem",
    },

    metadata: {
      category: "fantasy",
      builtIn: true,
    },
  },

  emerald: {
    id: "emerald",
    name: "Emerald",
    description:
      "A rich emerald-green chat bubble.",

    mine: {
      background:
        "linear-gradient(135deg, #047857, #10b981)",
      color: "#ffffff",
      borderRadius: "1.05rem",
      boxShadow:
        "0 5px 18px rgba(16,185,129,0.25)",
    },

    theirs: {
      background: "#022c22",
      color: "#a7f3d0",
      borderRadius: "1.05rem",
    },

    metadata: {
      category: "nature",
      builtIn: true,
    },
  },

  gold: {
    id: "gold",
    name: "Gold",
    description:
      "A premium golden chat bubble.",

    mine: {
      background:
        "linear-gradient(135deg, #b45309, #f59e0b, #facc15)",
      color: "#ffffff",
      border:
        "1px solid rgba(254,243,199,0.75)",
      borderRadius: "1rem",
      boxShadow:
        "0 5px 22px rgba(245,158,11,0.3)",
      fontWeight: 600,
    },

    theirs: {
      background: "#451a03",
      color: "#fde68a",
      borderRadius: "1rem",
    },

    metadata: {
      category: "premium",
      builtIn: true,
    },
  },

  midnight: {
    id: "midnight",
    name: "Midnight",
    description:
      "A dark midnight-style conversation bubble.",

    mine: {
      background:
        "linear-gradient(135deg, #1e293b, #312e81)",
      color: "#ffffff",
      border:
        "1px solid rgba(129,140,248,0.45)",
      borderRadius: "0.95rem",
    },

    theirs: {
      background: "#0f172a",
      color: "#cbd5e1",
      border:
        "1px solid rgba(148,163,184,0.25)",
      borderRadius: "0.95rem",
    },

    metadata: {
      category: "dark",
      builtIn: true,
    },
  },

  "bubble-pop": {
    id: "bubble-pop",
    name: "Bubble Pop",
    description:
      "A playful colorful bubble design.",

    mine: {
      background:
        "linear-gradient(135deg, #f472b6, #c084fc)",
      color: "#ffffff",
      borderRadius: "2rem",
      boxShadow:
        "0 7px 20px rgba(192,132,252,0.28)",
    },

    theirs: {
      background:
        "linear-gradient(135deg, #fce7f3, #ede9fe)",
      color: "#581c87",
      borderRadius: "2rem",
    },

    metadata: {
      category: "fun",
      builtIn: true,
    },
  },

  shadow: {
    id: "shadow",
    name: "Shadow",
    description:
      "A powerful dark bubble with a strong shadow.",

    mine: {
      background: "#18181b",
      color: "#ffffff",
      borderRadius: "0.85rem",
      boxShadow:
        "0 8px 25px rgba(0,0,0,0.35)",
    },

    theirs: {
      background: "#27272a",
      color: "#e4e4e7",
      borderRadius: "0.85rem",
      boxShadow:
        "0 5px 16px rgba(0,0,0,0.2)",
    },

    metadata: {
      category: "dark",
      builtIn: true,
    },
  },

  outline: {
    id: "outline",
    name: "Outline",
    description:
      "A clean bubble with transparent background and a strong outline.",

    mine: {
      background: "transparent",
      color: "var(--foreground, #111827)",
      border:
        "2px solid var(--primary, #2563eb)",
      borderRadius: "1rem",
    },

    theirs: {
      background: "transparent",
      color: "var(--foreground, #111827)",
      border:
        "2px solid rgba(100,116,139,0.45)",
      borderRadius: "1rem",
    },

    metadata: {
      category: "minimal",
      builtIn: true,
    },
  },

  gradient: {
    id: "gradient",
    name: "Gradient",
    description:
      "A colorful smooth gradient bubble.",

    mine: {
      background:
        "linear-gradient(135deg, #2563eb, #7c3aed, #db2777)",
      color: "#ffffff",
      borderRadius: "1.15rem",
      boxShadow:
        "0 6px 22px rgba(124,58,237,0.25)",
    },

    theirs: {
      background:
        "linear-gradient(135deg, #e0e7ff, #fce7f3)",
      color: "#312e81",
      borderRadius: "1.15rem",
    },

    metadata: {
      category: "gradient",
      builtIn: true,
    },
  },

  pixel: {
    id: "pixel",
    name: "Pixel",
    description:
      "A retro gaming-style bubble.",

    mine: {
      background: "#111827",
      color: "#4ade80",
      border:
        "2px solid #4ade80",
      borderRadius: "0.35rem",
      boxShadow:
        "4px 4px 0 rgba(74,222,128,0.35)",
      letterSpacing: "0.015em",
      fontWeight: 700,
    },

    theirs: {
      background: "#030712",
      color: "#86efac",
      border:
        "2px solid rgba(74,222,128,0.45)",
      borderRadius: "0.35rem",
    },

    metadata: {
      category: "retro-gaming",
      builtIn: true,
    },
  },

  royal: {
    id: "royal",
    name: "Royal",
    description:
      "A premium purple-and-gold bubble.",

    mine: {
      background:
        "linear-gradient(135deg, #581c87, #7e22ce)",
      color: "#fef3c7",
      border:
        "1px solid #f59e0b",
      borderRadius: "1rem",
      boxShadow:
        "0 6px 22px rgba(88,28,135,0.35)",
      fontWeight: 600,
    },

    theirs: {
      background: "#2e1065",
      color: "#e9d5ff",
      border:
        "1px solid rgba(245,158,11,0.35)",
      borderRadius: "1rem",
    },

    metadata: {
      category: "premium",
      builtIn: true,
    },
  },

  sunset: {
    id: "sunset",
    name: "Sunset",
    description:
      "A warm sunset-inspired conversation bubble.",

    mine: {
      background:
        "linear-gradient(135deg, #f43f5e, #f97316, #facc15)",
      color: "#ffffff",
      borderRadius: "1.15rem",
      boxShadow:
        "0 6px 22px rgba(249,115,22,0.28)",
    },

    theirs: {
      background:
        "linear-gradient(135deg, #fff1f2, #ffedd5)",
      color: "#7c2d12",
      borderRadius: "1.15rem",
    },

    metadata: {
      category: "nature",
      builtIn: true,
    },
  },
};

/**
 * Get one bubble by ID.
 */
export function getShopBubble(
  bubbleId: string | null | undefined,
): ShopBubble | null {
  if (!bubbleId) {
    return null;
  }

  return SHOP_BUBBLES[bubbleId] ?? null;
}

/**
 * Get every built-in Shop bubble.
 */
export function getAllShopBubbles(): ShopBubble[] {
  return Object.values(SHOP_BUBBLES);
}

/**
 * Check whether a bubble exists.
 */
export function hasShopBubble(
  bubbleId: string | null | undefined,
): boolean {
  if (!bubbleId) {
    return false;
  }

  return Boolean(SHOP_BUBBLES[bubbleId]);
}

/**
 * Get the style for the user's own message.
 */
export function getShopBubbleMineStyle(
  bubble: ShopBubble,
): ShopBubbleStyle {
  return {
    ...bubble.mine,
  };
}

/**
 * Get the style for incoming messages.
 */
export function getShopBubbleTheirsStyle(
  bubble: ShopBubble,
): ShopBubbleStyle {
  return {
    ...bubble.theirs,
  };
}

/**
 * Convert a bubble into Shop metadata.
 *
 * This structure is ready for Supabase shop_items.metadata.
 */
export function shopBubbleToMetadata(
  bubble: ShopBubble,
): Record<string, unknown> {
  return {
    cosmetic_type: "bubble",

    bubble_id: bubble.id,

    name: bubble.name,

    description: bubble.description,

    mine: {
      ...bubble.mine,
    },

    theirs: {
      ...bubble.theirs,
    },

    ...(bubble.metadata ?? {}),
  };
}

/**
 * Build a Shop bubble from Supabase metadata.
 *
 * This allows future Admin-created bubbles to work
 * without changing this file.
 */
export function shopBubbleFromMetadata(
  metadata:
    | Record<string, unknown>
    | null
    | undefined,
): ShopBubble | null {
  if (!metadata) {
    return null;
  }

  const id =
    typeof metadata['bubble_id'] === "string"
      ? metadata['bubble_id']
      : typeof metadata['id'] === "string"
        ? metadata['id']
        : null;

  if (!id) {
    return null;
  }

  const name =
    typeof metadata['name'] === "string"
      ? metadata['name']
      : "Shop Bubble";

  const description =
    typeof metadata['description'] === "string"
      ? metadata['description']
      : "Custom Shop bubble.";

  const mine =
    isShopBubbleStyle(metadata['mine'])
      ? metadata['mine']
      : {
          background: "#2563eb",
          color: "#ffffff",
          borderRadius: "1rem",
        };

  const theirs =
    isShopBubbleStyle(metadata['theirs'])
      ? metadata['theirs']
      : {
          background: "#e5e7eb",
          color: "#111827",
          borderRadius: "1rem",
        };

  return {
    id,

    name,

    description,

    mine,

    theirs,

    metadata,
  };
}

/**
 * Create a custom bubble.
 *
 * The future Admin Panel can use this same structure.
 */
export function createCustomShopBubble(
  input: {
    id: string;

    name: string;

    description?: string;

    mine: ShopBubbleStyle;

    theirs: ShopBubbleStyle;

    metadata?: Record<string, unknown>;
  },
): ShopBubble {
  return {
    id: input.id,

    name: input.name,

    description:
      input.description ??
      "Custom Shop bubble.",

    mine: {
      ...input.mine,
    },

    theirs: {
      ...input.theirs,
    },

    metadata: {
      ...(input.metadata ?? {}),
      custom: true,
    },
  };
}

/**
 * Merge built-in bubbles with custom/admin bubbles.
 *
 * Built-in bubbles are kept unless a custom bubble
 * deliberately uses the same ID.
 */
export function mergeShopBubbles(
  customBubbles: ShopBubble[],
): ShopBubble[] {
  const map = new Map<string, ShopBubble>();

  for (const bubble of getAllShopBubbles()) {
    map.set(bubble.id, bubble);
  }

  for (const bubble of customBubbles) {
    map.set(bubble.id, bubble);
  }

  return Array.from(map.values());
}

/**
 * Validate a bubble style.
 */
function isShopBubbleStyle(
  value: unknown,
): value is ShopBubbleStyle {
  if (!value || typeof value !== "object") {
    return false;
  }

  const style =
    value as Record<string, unknown>;

  return (
    typeof style['background'] === "string" &&
    typeof style['color'] === "string"
  );
}

/**
 * Safe fallback bubble.
 */
export function getDefaultShopBubble(): ShopBubble {
  return SHOP_BUBBLES['default'];
}