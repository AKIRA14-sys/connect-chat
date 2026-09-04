/**
 * XUPPIN Shop Profile Frames
 *
 * Code-based profile/avatar frame cosmetics.
 *
 * These frames are CSS-based, so they do not require images.
 *
 * Architecture:
 *
 * Shop purchase
 *      ↓
 * user_inventory
 *      ↓
 * equipped profile_frame
 *      ↓
 * local device storage
 *      ↓
 * profile/avatar UI
 *
 * This file does NOT modify the existing profile UI yet.
 * It only provides the cosmetic definitions and helpers.
 */

export type ShopProfileFrameId =
  | "default"
  | "none"
  | "blue"
  | "cyan"
  | "purple"
  | "pink"
  | "red"
  | "orange"
  | "gold"
  | "green"
  | "emerald"
  | "ice"
  | "fire"
  | "neon"
  | "cyber"
  | "gaming"
  | "anime"
  | "royal"
  | "rainbow"
  | "sunset"
  | "midnight"
  | "diamond"
  | "legendary";

export interface ShopProfileFrame {
  id: ShopProfileFrameId | string;

  name: string;

  description: string;

  /**
   * CSS styles applied to the outer avatar frame.
   */
  frame: ShopProfileFrameStyle;

  /**
   * Optional CSS styles for the area immediately
   * around the user's avatar.
   */
  avatar?: ShopProfileFrameStyle;

  /**
   * Optional small indicator/badge shown with the frame.
   */
  indicator?: {
    background: string;
    color: string;
    border?: string;
    boxShadow?: string;
  };

  /**
   * Metadata reserved for Shop/Admin Panel.
   */
  metadata?: Record<string, unknown>;
}

export interface ShopProfileFrameStyle {
  border?: string;

  borderRadius?: string;

  boxShadow?: string;

  background?: string;

  backgroundImage?: string;

  padding?: string;

  outline?: string;

  outlineOffset?: string;

  transform?: string;
}

/**
 * Built-in profile frames.
 *
 * All of these can be rendered with CSS.
 */
export const SHOP_PROFILE_FRAMES: Record<
  string,
  ShopProfileFrame
> = {
  default: {
    id: "default",

    name: "Default",

    description:
      "The normal XUPPIN profile appearance.",

    frame: {
      border: "2px solid var(--border, #e5e7eb)",
      borderRadius: "9999px",
      padding: "2px",
    },

    metadata: {
      category: "standard",
      builtIn: true,
    },
  },

  none: {
    id: "none",

    name: "No Frame",

    description:
      "Remove the decorative profile frame.",

    frame: {
      border: "2px solid transparent",
      borderRadius: "9999px",
      padding: "2px",
    },

    metadata: {
      category: "standard",
      builtIn: true,
    },
  },

  blue: {
    id: "blue",

    name: "Blue",

    description:
      "A clean blue profile frame.",

    frame: {
      border: "3px solid #2563eb",
      borderRadius: "9999px",
      padding: "2px",
      boxShadow:
        "0 0 12px rgba(37,99,235,0.28)",
    },

    metadata: {
      category: "color",
      builtIn: true,
    },
  },

  cyan: {
    id: "cyan",

    name: "Cyan",

    description:
      "A bright cyan profile frame.",

    frame: {
      border: "3px solid #06b6d4",
      borderRadius: "9999px",
      padding: "2px",
      boxShadow:
        "0 0 14px rgba(6,182,212,0.32)",
    },

    metadata: {
      category: "color",
      builtIn: true,
    },
  },

  purple: {
    id: "purple",

    name: "Purple",

    description:
      "A vivid purple profile frame.",

    frame: {
      border: "3px solid #8b5cf6",
      borderRadius: "9999px",
      padding: "2px",
      boxShadow:
        "0 0 14px rgba(139,92,246,0.3)",
    },

    metadata: {
      category: "color",
      builtIn: true,
    },
  },

  pink: {
    id: "pink",

    name: "Pink",

    description:
      "A bright pink profile frame.",

    frame: {
      border: "3px solid #ec4899",
      borderRadius: "9999px",
      padding: "2px",
      boxShadow:
        "0 0 14px rgba(236,72,153,0.3)",
    },

    metadata: {
      category: "color",
      builtIn: true,
    },
  },

  red: {
    id: "red",

    name: "Red",

    description:
      "A powerful red profile frame.",

    frame: {
      border: "3px solid #ef4444",
      borderRadius: "9999px",
      padding: "2px",
      boxShadow:
        "0 0 14px rgba(239,68,68,0.3)",
    },

    metadata: {
      category: "color",
      builtIn: true,
    },
  },

  orange: {
    id: "orange",

    name: "Orange",

    description:
      "A bright orange profile frame.",

    frame: {
      border: "3px solid #f97316",
      borderRadius: "9999px",
      padding: "2px",
      boxShadow:
        "0 0 14px rgba(249,115,22,0.3)",
    },

    metadata: {
      category: "color",
      builtIn: true,
    },
  },

  gold: {
    id: "gold",

    name: "Gold",

    description:
      "A premium golden profile frame.",

    frame: {
      border:
        "3px solid #f59e0b",
      borderRadius: "9999px",
      padding: "3px",
      boxShadow:
        "0 0 16px rgba(245,158,11,0.35)",
    },

    metadata: {
      category: "premium",
      builtIn: true,
    },
  },

  green: {
    id: "green",

    name: "Green",

    description:
      "A clean green profile frame.",

    frame: {
      border: "3px solid #22c55e",
      borderRadius: "9999px",
      padding: "2px",
      boxShadow:
        "0 0 14px rgba(34,197,94,0.3)",
    },

    metadata: {
      category: "color",
      builtIn: true,
    },
  },

  emerald: {
    id: "emerald",

    name: "Emerald",

    description:
      "A deep emerald profile frame.",

    frame: {
      border:
        "3px solid #10b981",
      borderRadius: "9999px",
      padding: "2px",
      boxShadow:
        "0 0 16px rgba(16,185,129,0.32)",
    },

    metadata: {
      category: "nature",
      builtIn: true,
    },
  },

  ice: {
    id: "ice",

    name: "Ice",

    description:
      "A cool icy profile frame.",

    frame: {
      border:
        "3px solid #38bdf8",
      borderRadius: "9999px",
      padding: "3px",
      boxShadow:
        "0 0 18px rgba(56,189,248,0.38)",
    },

    metadata: {
      category: "element",
      builtIn: true,
    },
  },

  fire: {
    id: "fire",

    name: "Fire",

    description:
      "A fiery red-orange profile frame.",

    frame: {
      border:
        "3px solid #f97316",
      borderRadius: "9999px",
      padding: "3px",
      boxShadow:
        "0 0 20px rgba(249,115,22,0.42)",
      background:
        "linear-gradient(135deg,#ef4444,#f97316,#facc15)",
    },

    metadata: {
      category: "element",
      builtIn: true,
    },
  },

  neon: {
    id: "neon",

    name: "Neon",

    description:
      "A futuristic glowing neon frame.",

    frame: {
      border:
        "3px solid #22d3ee",
      borderRadius: "9999px",
      padding: "3px",
      boxShadow:
        "0 0 10px #22d3ee, 0 0 24px rgba(139,92,246,0.55)",
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
      "A futuristic cyan-and-purple cyber frame.",

    frame: {
      border:
        "3px solid #a855f7",
      borderRadius: "9999px",
      padding: "3px",
      outline:
        "2px solid rgba(34,211,238,0.65)",
      outlineOffset: "2px",
      boxShadow:
        "0 0 16px rgba(34,211,238,0.35)",
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
      "A bold green gaming profile frame.",

    frame: {
      border:
        "3px solid #22c55e",
      borderRadius: "9999px",
      padding: "3px",
      boxShadow:
        "0 0 8px rgba(34,197,94,0.5), 0 0 22px rgba(34,197,94,0.25)",
    },

    indicator: {
      background: "#16a34a",
      color: "#ffffff",
      border: "1px solid #86efac",
      boxShadow:
        "0 0 8px rgba(34,197,94,0.45)",
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
      "A colorful anime-inspired profile frame.",

    frame: {
      border:
        "3px solid #ec4899",
      borderRadius: "9999px",
      padding: "3px",
      background:
        "linear-gradient(135deg,#ec4899,#8b5cf6,#06b6d4)",
      boxShadow:
        "0 0 18px rgba(236,72,153,0.3)",
    },

    metadata: {
      category: "anime",
      builtIn: true,
    },
  },

  royal: {
    id: "royal",

    name: "Royal",

    description:
      "A premium purple and gold frame.",

    frame: {
      border:
        "3px solid #f59e0b",
      borderRadius: "9999px",
      padding: "3px",
      outline:
        "2px solid #7e22ce",
      outlineOffset: "2px",
      boxShadow:
        "0 0 20px rgba(245,158,11,0.32)",
    },

    metadata: {
      category: "premium",
      builtIn: true,
    },
  },

  rainbow: {
    id: "rainbow",

    name: "Rainbow",

    description:
      "A colorful rainbow profile frame.",

    frame: {
      border:
        "3px solid transparent",
      borderRadius: "9999px",
      padding: "3px",
      background:
        "linear-gradient(135deg,#ef4444,#f97316,#facc15,#22c55e,#06b6d4,#3b82f6,#8b5cf6,#ec4899)",
      boxShadow:
        "0 0 20px rgba(139,92,246,0.25)",
    },

    metadata: {
      category: "colorful",
      builtIn: true,
    },
  },

  sunset: {
    id: "sunset",

    name: "Sunset",

    description:
      "A warm sunset gradient profile frame.",

    frame: {
      border:
        "3px solid transparent",
      borderRadius: "9999px",
      padding: "3px",
      background:
        "linear-gradient(135deg,#f43f5e,#f97316,#facc15)",
      boxShadow:
        "0 0 18px rgba(249,115,22,0.3)",
    },

    metadata: {
      category: "nature",
      builtIn: true,
    },
  },

  midnight: {
    id: "midnight",

    name: "Midnight",

    description:
      "A dark blue midnight profile frame.",

    frame: {
      border:
        "3px solid #6366f1",
      borderRadius: "9999px",
      padding: "3px",
      boxShadow:
        "0 0 18px rgba(99,102,241,0.35)",
    },

    metadata: {
      category: "dark",
      builtIn: true,
    },
  },

  diamond: {
    id: "diamond",

    name: "Diamond",

    description:
      "A premium icy diamond-style profile frame.",

    frame: {
      border:
        "3px solid #67e8f9",
      borderRadius: "9999px",
      padding: "3px",
      outline:
        "2px solid rgba(255,255,255,0.65)",
      outlineOffset: "2px",
      boxShadow:
        "0 0 20px rgba(103,232,249,0.45)",
    },

    metadata: {
      category: "premium",
      builtIn: true,
    },
  },

  legendary: {
    id: "legendary",

    name: "Legendary",

    description:
      "A high-tier animated-style gradient frame.",

    frame: {
      border:
        "3px solid transparent",
      borderRadius: "9999px",
      padding: "4px",
      background:
        "linear-gradient(135deg,#facc15,#f97316,#ef4444,#8b5cf6,#06b6d4)",
      boxShadow:
        "0 0 12px rgba(250,204,21,0.45), 0 0 28px rgba(139,92,246,0.35)",
    },

    indicator: {
      background:
        "linear-gradient(135deg,#f59e0b,#8b5cf6)",
      color: "#ffffff",
      border:
        "1px solid rgba(255,255,255,0.65)",
      boxShadow:
        "0 0 10px rgba(245,158,11,0.4)",
    },

    metadata: {
      category: "legendary",
      builtIn: true,
      rarity: "legendary",
    },
  },
};

/**
 * Get one profile frame.
 */
export function getShopProfileFrame(
  frameId: string | null | undefined,
): ShopProfileFrame | null {
  if (!frameId) {
    return null;
  }

  return SHOP_PROFILE_FRAMES[frameId] ?? null;
}

/**
 * Get all built-in profile frames.
 */
export function getAllShopProfileFrames(): ShopProfileFrame[] {
  return Object.values(SHOP_PROFILE_FRAMES);
}

/**
 * Check whether a profile frame exists.
 */
export function hasShopProfileFrame(
  frameId: string | null | undefined,
): boolean {
  if (!frameId) {
    return false;
  }

  return Boolean(
    SHOP_PROFILE_FRAMES[frameId],
  );
}

/**
 * Convert a profile frame into Shop metadata.
 *
 * This can be stored in:
 *
 * shop_items.metadata
 */
export function shopProfileFrameToMetadata(
  profileFrame: ShopProfileFrame,
): Record<string, unknown> {
  return {
    cosmetic_type: "profile_frame",

    frame_id: profileFrame.id,

    name: profileFrame.name,

    description:
      profileFrame.description,

    frame: {
      ...profileFrame.frame,
    },

    ...(profileFrame.avatar
      ? {
          avatar: {
            ...profileFrame.avatar,
          },
        }
      : {}),

    ...(profileFrame.indicator
      ? {
          indicator: {
            ...profileFrame.indicator,
          },
        }
      : {}),

    ...(profileFrame.metadata ?? {}),
  };
}

/**
 * Safely create a profile frame from
 * Supabase shop_items.metadata.
 */
export function shopProfileFrameFromMetadata(
  metadata:
    | Record<string, unknown>
    | null
    | undefined,
): ShopProfileFrame | null {
  if (!metadata) {
    return null;
  }

  const id =
    typeof metadata['frame_id'] === "string"
      ? metadata['frame_id']
      : typeof metadata['id'] === "string"
        ? metadata['id']
        : null;

  if (!id) {
    return null;
  }

  const name =
    typeof metadata['name'] === "string"
      ? metadata['name']
      : "Shop Profile Frame";

  const description =
    typeof metadata['description'] === "string"
      ? metadata['description']
      : "Custom Shop profile frame.";

  const frame =
    isProfileFrameStyle(metadata['frame'])
      ? metadata['frame']
      : {
          border:
            "2px solid #e5e7eb",
          borderRadius: "9999px",
          padding: "2px",
        };

  const avatar =
    isProfileFrameStyle(metadata['avatar'])
      ? metadata['avatar']
      : undefined;

  const indicator =
    isIndicatorStyle(
      metadata['indicator'],
    )
      ? metadata['indicator']
      : undefined;

  return {
    id,

    name,

    description,

    frame,

    ...(avatar ? { avatar } : {}),

    ...(indicator
      ? { indicator }
      : {}),

    metadata,
  };
}

/**
 * Create a custom code-based profile frame.
 *
 * This is intentionally compatible with the
 * future Master Admin Panel.
 */
export function createCustomShopProfileFrame(
  input: {
    id: string;

    name: string;

    description?: string;

    frame: ShopProfileFrameStyle;

    avatar?: ShopProfileFrameStyle;

    indicator?: {
      background: string;
      color: string;
      border?: string;
      boxShadow?: string;
    };

    metadata?: Record<string, unknown>;
  },
): ShopProfileFrame {
  return {
    id: input.id,

    name: input.name,

    description:
      input.description ??
      "Custom Shop profile frame.",

    frame: {
      ...input.frame,
    },

    ...(input.avatar
      ? {
          avatar: {
            ...input.avatar,
          },
        }
      : {}),

    ...(input.indicator
      ? {
          indicator: {
            ...input.indicator,
          },
        }
      : {}),

    metadata: {
      ...(input.metadata ?? {}),
      custom: true,
    },
  };
}

/**
 * Merge built-in frames with
 * Admin-created/Supabase frames.
 */
export function mergeShopProfileFrames(
  customFrames: ShopProfileFrame[],
): ShopProfileFrame[] {
  const map = new Map<
    string,
    ShopProfileFrame
  >();

  for (const frame of getAllShopProfileFrames()) {
    map.set(frame.id, frame);
  }

  for (const frame of customFrames) {
    map.set(frame.id, frame);
  }

  return Array.from(map.values());
}

/**
 * Validate a frame style loaded from Supabase.
 */
function isProfileFrameStyle(
  value: unknown,
): value is ShopProfileFrameStyle {
  if (!value || typeof value !== "object") {
    return false;
  }

  const style =
    value as Record<string, unknown>;

  return Object.keys(style).some(
    (key) =>
      typeof style[key] === "string",
  );
}

/**
 * Validate an indicator object.
 */
function isIndicatorStyle(
  value: unknown,
): value is {
  background: string;
  color: string;
  border?: string;
  boxShadow?: string;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const indicator =
    value as Record<string, unknown>;

  return (
    typeof indicator['background'] === "string" &&
    typeof indicator['color'] === "string"
  );
}

/**
 * Safe fallback.
 */
export function getDefaultShopProfileFrame(): ShopProfileFrame {
  return SHOP_PROFILE_FRAMES['default'];
}