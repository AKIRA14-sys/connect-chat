/**
 * XUPPIN Shop Gaming Badges
 *
 * Code-based gaming badges.
 *
 * These badges do not require image files.
 * They can be rendered using:
 * - emoji
 * - text
 * - colors
 * - gradients
 * - borders
 * - glow effects
 *
 * The definitions are also compatible with future
 * Master Admin-created Shop badges.
 */

export type ShopGamingBadgeRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export interface ShopGamingBadge {
  id: string;

  name: string;

  description: string;

  icon: string;

  rarity: ShopGamingBadgeRarity;

  background: string;

  color: string;

  border?: string;

  boxShadow?: string;

  text?: string;

  metadata?: Record<string, unknown>;
}

/**
 * Built-in gaming badges.
 *
 * These are completely code-based.
 */
export const SHOP_GAMING_BADGES: Record<
  string,
  ShopGamingBadge
> = {
  rookie: {
    id: "rookie",

    name: "Rookie Gamer",

    description:
      "A badge for players starting their gaming journey.",

    icon: "🎮",

    rarity: "common",

    background: "#374151",

    color: "#ffffff",

    border: "1px solid #6b7280",

    text: "ROOKIE",

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  gamer: {
    id: "gamer",

    name: "Gamer",

    description:
      "A badge for active XUPPIN gamers.",

    icon: "🎮",

    rarity: "uncommon",

    background: "#166534",

    color: "#dcfce7",

    border: "1px solid #22c55e",

    boxShadow:
      "0 0 10px rgba(34,197,94,0.25)",

    text: "GAMER",

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  winner: {
    id: "winner",

    name: "Winner",

    description:
      "A badge for players who keep winning.",

    icon: "🏆",

    rarity: "rare",

    background:
      "linear-gradient(135deg,#ca8a04,#facc15)",

    color: "#422006",

    border: "1px solid #fde047",

    boxShadow:
      "0 0 14px rgba(250,204,21,0.3)",

    text: "WINNER",

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  champion: {
    id: "champion",

    name: "Champion",

    description:
      "A prestigious badge for outstanding gamers.",

    icon: "👑",

    rarity: "epic",

    background:
      "linear-gradient(135deg,#7e22ce,#a855f7)",

    color: "#ffffff",

    border: "1px solid #d8b4fe",

    boxShadow:
      "0 0 16px rgba(168,85,247,0.4)",

    text: "CHAMPION",

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  elite: {
    id: "elite",

    name: "Elite Gamer",

    description:
      "A badge reserved for elite players.",

    icon: "⚡",

    rarity: "epic",

    background:
      "linear-gradient(135deg,#0369a1,#06b6d4)",

    color: "#ecfeff",

    border: "1px solid #67e8f9",

    boxShadow:
      "0 0 18px rgba(6,182,212,0.4)",

    text: "ELITE",

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  master: {
    id: "master",

    name: "Game Master",

    description:
      "A high-level gaming achievement badge.",

    icon: "🔥",

    rarity: "legendary",

    background:
      "linear-gradient(135deg,#dc2626,#f97316,#facc15)",

    color: "#ffffff",

    border: "1px solid #fde68a",

    boxShadow:
      "0 0 18px rgba(249,115,22,0.45)",

    text: "MASTER",

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  legendary: {
    id: "legendary",

    name: "Legendary Gamer",

    description:
      "A legendary badge for exceptional players.",

    icon: "🌟",

    rarity: "legendary",

    background:
      "linear-gradient(135deg,#f59e0b,#facc15,#fef3c7)",

    color: "#451a03",

    border: "1px solid #fde68a",

    boxShadow:
      "0 0 20px rgba(250,204,21,0.5)",

    text: "LEGENDARY",

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  mythic: {
    id: "mythic",

    name: "Mythic Gamer",

    description:
      "The highest-tier gaming badge.",

    icon: "💠",

    rarity: "mythic",

    background:
      "linear-gradient(135deg,#06b6d4,#6366f1,#a855f7,#ec4899)",

    color: "#ffffff",

    border: "1px solid #c4b5fd",

    boxShadow:
      "0 0 12px rgba(34,211,238,0.5), 0 0 28px rgba(168,85,247,0.4)",

    text: "MYTHIC",

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  streak3: {
    id: "streak3",

    name: "3-Day Streak",

    description:
      "A badge celebrating a three-day gaming streak.",

    icon: "🔥",

    rarity: "common",

    background: "#7f1d1d",

    color: "#fee2e2",

    border: "1px solid #ef4444",

    text: "3 DAY",

    metadata: {
      category: "streak",
      builtIn: true,
    },
  },

  streak7: {
    id: "streak7",

    name: "7-Day Streak",

    description:
      "A badge celebrating a seven-day gaming streak.",

    icon: "🔥",

    rarity: "uncommon",

    background:
      "linear-gradient(135deg,#991b1b,#f97316)",

    color: "#ffffff",

    border: "1px solid #fb923c",

    boxShadow:
      "0 0 12px rgba(249,115,22,0.3)",

    text: "7 DAY",

    metadata: {
      category: "streak",
      builtIn: true,
    },
  },

  streak30: {
    id: "streak30",

    name: "30-Day Streak",

    description:
      "A badge for maintaining a 30-day gaming streak.",

    icon: "🔥",

    rarity: "epic",

    background:
      "linear-gradient(135deg,#7e22ce,#dc2626,#f97316)",

    color: "#ffffff",

    border: "1px solid #fb7185",

    boxShadow:
      "0 0 18px rgba(220,38,38,0.4)",

    text: "30 DAY",

    metadata: {
      category: "streak",
      builtIn: true,
    },
  },

  coinHunter: {
    id: "coinHunter",

    name: "Coin Hunter",

    description:
      "A badge for players who collect lots of X Coins.",

    icon: "🪙",

    rarity: "rare",

    background:
      "linear-gradient(135deg,#a16207,#f59e0b)",

    color: "#fffbeb",

    border: "1px solid #facc15",

    boxShadow:
      "0 0 14px rgba(245,158,11,0.35)",

    text: "COIN HUNTER",

    metadata: {
      category: "coins",
      builtIn: true,
    },
  },

  xpHunter: {
    id: "xpHunter",

    name: "XP Hunter",

    description:
      "A badge for dedicated XP collectors.",

    icon: "⭐",

    rarity: "rare",

    background:
      "linear-gradient(135deg,#1d4ed8,#7c3aed)",

    color: "#ffffff",

    border: "1px solid #a5b4fc",

    boxShadow:
      "0 0 14px rgba(124,58,237,0.35)",

    text: "XP HUNTER",

    metadata: {
      category: "xp",
      builtIn: true,
    },
  },

  speedrunner: {
    id: "speedrunner",

    name: "Speedrunner",

    description:
      "A badge for players who complete games quickly.",

    icon: "⚡",

    rarity: "rare",

    background:
      "linear-gradient(135deg,#0f172a,#2563eb)",

    color: "#dbeafe",

    border: "1px solid #60a5fa",

    boxShadow:
      "0 0 14px rgba(59,130,246,0.35)",

    text: "SPEEDRUNNER",

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  strategist: {
    id: "strategist",

    name: "Strategist",

    description:
      "A badge for tactical and strategic players.",

    icon: "🧠",

    rarity: "epic",

    background:
      "linear-gradient(135deg,#312e81,#7c3aed)",

    color: "#ede9fe",

    border: "1px solid #a78bfa",

    boxShadow:
      "0 0 16px rgba(124,58,237,0.35)",

    text: "STRATEGIST",

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  animeGamer: {
    id: "animeGamer",

    name: "Anime Gamer",

    description:
      "An anime-inspired gaming badge.",

    icon: "⚔️",

    rarity: "epic",

    background:
      "linear-gradient(135deg,#ec4899,#8b5cf6,#06b6d4)",

    color: "#ffffff",

    border: "1px solid #f9a8d4",

    boxShadow:
      "0 0 18px rgba(236,72,153,0.35)",

    text: "ANIME GAMER",

    metadata: {
      category: "anime",
      builtIn: true,
    },
  },

  survivor: {
    id: "survivor",

    name: "Survivor",

    description:
      "A badge for players who keep going after difficult games.",

    icon: "🛡️",

    rarity: "uncommon",

    background:
      "linear-gradient(135deg,#374151,#4b5563)",

    color: "#f9fafb",

    border: "1px solid #9ca3af",

    text: "SURVIVOR",

    metadata: {
      category: "achievement",
      builtIn: true,
    },
  },

  boss: {
    id: "boss",

    name: "Boss",

    description:
      "A bold badge for dominant gamers.",

    icon: "😈",

    rarity: "legendary",

    background:
      "linear-gradient(135deg,#111827,#7f1d1d)",

    color: "#fecaca",

    border: "1px solid #ef4444",

    boxShadow:
      "0 0 18px rgba(239,68,68,0.4)",

    text: "BOSS",

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  xChampion: {
    id: "xChampion",

    name: "X Champion",

    description:
      "A special XUPPIN gaming champion badge.",

    icon: "✕",

    rarity: "mythic",

    background:
      "linear-gradient(135deg,#052e16,#16a34a,#facc15)",

    color: "#ffffff",

    border: "1px solid #fde047",

    boxShadow:
      "0 0 14px rgba(34,197,94,0.45), 0 0 28px rgba(250,204,21,0.25)",

    text: "X CHAMPION",

    metadata: {
      category: "xuppin",
      builtIn: true,
    },
  },
};

/**
 * Get one gaming badge.
 */
export function getShopGamingBadge(
  badgeId: string | null | undefined,
): ShopGamingBadge | null {
  if (!badgeId) {
    return null;
  }

  return SHOP_GAMING_BADGES[badgeId] ?? null;
}

/**
 * Get all built-in gaming badges.
 */
export function getAllShopGamingBadges(): ShopGamingBadge[] {
  return Object.values(SHOP_GAMING_BADGES);
}

/**
 * Check whether a badge exists.
 */
export function hasShopGamingBadge(
  badgeId: string | null | undefined,
): boolean {
  if (!badgeId) {
    return false;
  }

  return Boolean(
    SHOP_GAMING_BADGES[badgeId],
  );
}

/**
 * Get badges belonging to a rarity.
 */
export function getShopGamingBadgesByRarity(
  rarity: ShopGamingBadgeRarity,
): ShopGamingBadge[] {
  return getAllShopGamingBadges().filter(
    (badge) =>
      badge.rarity === rarity,
  );
}

/**
 * Get badges belonging to a category.
 */
export function getShopGamingBadgesByCategory(
  category: string,
): ShopGamingBadge[] {
  return getAllShopGamingBadges().filter(
    (badge) =>
      badge.metadata?['category'] === category,
  );
}

/**
 * Convert a badge into Shop metadata.
 *
 * This is useful when the Master Admin Panel
 * eventually creates Shop items.
 */
export function shopGamingBadgeToMetadata(
  badge: ShopGamingBadge,
): Record<string, unknown> {
  return {
    cosmetic_type: "badge",

    badge_id: badge.id,

    name: badge.name,

    description: badge.description,

    icon: badge.icon,

    rarity: badge.rarity,

    background: badge.background,

    color: badge.color,

    ...(badge.border
      ? {
          border: badge.border,
        }
      : {}),

    ...(badge.boxShadow
      ? {
          boxShadow: badge.boxShadow,
        }
      : {}),

    ...(badge.text
      ? {
          text: badge.text,
        }
      : {}),

    ...(badge.metadata ?? {}),
  };
}

/**
 * Safely convert Supabase metadata into
 * a gaming badge.
 */
export function shopGamingBadgeFromMetadata(
  metadata:
    | Record<string, unknown>
    | null
    | undefined,
): ShopGamingBadge | null {
  if (!metadata) {
    return null;
  }

  const id =
    typeof metadata['badge_id'] === "string"
      ? metadata['badge_id']
      : typeof metadata['id'] === "string"
        ? metadata['id']
        : null;

  if (!id) {
    return null;
  }

  const name =
    typeof metadata['name'] === "string"
      ? metadata['name']
      : "Gaming Badge";

  const description =
    typeof metadata['description'] === "string"
      ? metadata['description']
      : "Gaming achievement badge.";

  const icon =
    typeof metadata['icon'] === "string"
      ? metadata['icon']
      : "🎮";

  const rarity =
    isBadgeRarity(metadata['rarity'])
      ? metadata['rarity']
      : "common";

  const background =
    typeof metadata['background'] === "string"
      ? metadata['background']
      : "#374151";

  const color =
    typeof metadata['color'] === "string"
      ? metadata['color']
      : "#ffffff";

  const border =
    typeof metadata['border'] === "string"
      ? metadata['border']
      : undefined;

  const boxShadow =
    typeof metadata['boxShadow'] === "string"
      ? metadata['boxShadow']
      : undefined;

  const text =
    typeof metadata['text'] === "string"
      ? metadata['text']
      : undefined;

  return {
    id,

    name,

    description,

    icon,

    rarity,

    background,

    color,

    ...(border
      ? { border }
      : {}),

    ...(boxShadow
      ? { boxShadow }
      : {}),

    ...(text
      ? { text }
      : {}),

    metadata,
  };
}

/**
 * Create an Admin-compatible custom badge.
 */
export function createCustomShopGamingBadge(
  input: {
    id: string;

    name: string;

    description?: string;

    icon?: string;

    rarity?: ShopGamingBadgeRarity;

    background: string;

    color: string;

    border?: string;

    boxShadow?: string;

    text?: string;

    metadata?: Record<string, unknown>;
  },
): ShopGamingBadge {
  return {
    id: input.id,

    name: input.name,

    description:
      input.description ??
      "Custom XUPPIN gaming badge.",

    icon:
      input.icon ??
      "🎮",

    rarity:
      input.rarity ??
      "common",

    background:
      input.background,

    color:
      input.color,

    ...(input.border
      ? {
          border: input.border,
        }
      : {}),

    ...(input.boxShadow
      ? {
          boxShadow: input.boxShadow,
        }
      : {}),

    ...(input.text
      ? {
          text: input.text,
        }
      : {}),

    metadata: {
      ...(input.metadata ?? {}),
      custom: true,
    },
  };
}

/**
 * Merge built-in badges with Admin/Supabase badges.
 */
export function mergeShopGamingBadges(
  customBadges: ShopGamingBadge[],
): ShopGamingBadge[] {
  const map = new Map<
    string,
    ShopGamingBadge
  >();

  for (const badge of getAllShopGamingBadges()) {
    map.set(badge.id, badge);
  }

  for (const badge of customBadges) {
    map.set(badge.id, badge);
  }

  return Array.from(map.values());
}

/**
 * Return a safe fallback badge.
 */
export function getDefaultShopGamingBadge(): ShopGamingBadge {
  return SHOP_GAMING_BADGES['rookie'];
}

/**
 * Validate rarity loaded from Supabase.
 */
function isBadgeRarity(
  value: unknown,
): value is ShopGamingBadgeRarity {
  return (
    value === "common" ||
    value === "uncommon" ||
    value === "rare" ||
    value === "epic" ||
    value === "legendary" ||
    value === "mythic"
  );
}