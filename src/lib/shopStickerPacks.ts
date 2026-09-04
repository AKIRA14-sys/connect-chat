/**
 * XUPPIN Shop Sticker Packs
 *
 * Shop-owned sticker pack system.
 *
 * IMPORTANT:
 * - Built-in stickers remain untouched.
 * - Shop packs are ADDITIVE.
 * - Sticker images can come from Supabase Storage,
 *   public URLs, or future Admin-created products.
 * - Ownership/equipping remains controlled by the Shop system.
 */

export type ShopStickerPackRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export interface ShopSticker {
  id: string;

  name: string;

  /**
   * Image URL for the sticker.
   *
   * This can later be a Supabase Storage URL.
   */
  imageUrl: string;

  /**
   * Optional fallback emoji.
   *
   * Useful while a sticker does not yet have
   * an uploaded image.
   */
  fallbackEmoji?: string;

  metadata?: Record<string, unknown>;
}

export interface ShopStickerPack {
  id: string;

  name: string;

  description: string;

  rarity: ShopStickerPackRarity;

  /**
   * Optional preview image for the pack.
   */
  previewImageUrl?: string;

  /**
   * Stickers belonging to this pack.
   */
  stickers: ShopSticker[];

  metadata?: Record<string, unknown>;
}

/**
 * Built-in starter packs.
 *
 * These are examples that can work immediately
 * with fallback emojis.
 *
 * Admin-created packs can later replace/add
 * real image URLs through Supabase metadata.
 */
export const SHOP_STICKER_PACKS: Record<
  string,
  ShopStickerPack
> = {
  anime_reactions: {
    id: "anime_reactions",

    name: "Anime Reactions",

    description:
      "Anime-inspired reactions for your XUPPIN chats.",

    rarity: "rare",

    stickers: [
      {
        id: "anime_reactions_laugh",

        name: "Laugh",

        imageUrl: "",

        fallbackEmoji: "😂",
      },

      {
        id: "anime_reactions_angry",

        name: "Angry",

        imageUrl: "",

        fallbackEmoji: "😤",
      },

      {
        id: "anime_reactions_shock",

        name: "Shock",

        imageUrl: "",

        fallbackEmoji: "😱",
      },

      {
        id: "anime_reactions_happy",

        name: "Happy",

        imageUrl: "",

        fallbackEmoji: "😄",
      },

      {
        id: "anime_reactions_cry",

        name: "Cry",

        imageUrl: "",

        fallbackEmoji: "😭",
      },

      {
        id: "anime_reactions_love",

        name: "Love",

        imageUrl: "",

        fallbackEmoji: "😍",
      },
    ],

    metadata: {
      category: "anime",
      builtIn: true,
    },
  },

  gaming_reactions: {
    id: "gaming_reactions",

    name: "Gaming Reactions",

    description:
      "Gaming reactions for victories, fails and funny moments.",

    rarity: "rare",

    stickers: [
      {
        id: "gaming_reactions_win",

        name: "Victory",

        imageUrl: "",

        fallbackEmoji: "🏆",
      },

      {
        id: "gaming_reactions_gg",

        name: "GG",

        imageUrl: "",

        fallbackEmoji: "🎮",
      },

      {
        id: "gaming_reactions_lose",

        name: "Defeat",

        imageUrl: "",

        fallbackEmoji: "💀",
      },

      {
        id: "gaming_reactions_fire",

        name: "Fire",

        imageUrl: "",

        fallbackEmoji: "🔥",
      },

      {
        id: "gaming_reactions_boom",

        name: "Boom",

        imageUrl: "",

        fallbackEmoji: "💥",
      },

      {
        id: "gaming_reactions_clutch",

        name: "Clutch",

        imageUrl: "",

        fallbackEmoji: "⚡",
      },
    ],

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  cute_pack: {
    id: "cute_pack",

    name: "Cute Pack",

    description:
      "Cute reactions for everyday conversations.",

    rarity: "common",

    stickers: [
      {
        id: "cute_pack_heart",

        name: "Heart",

        imageUrl: "",

        fallbackEmoji: "💖",
      },

      {
        id: "cute_pack_happy",

        name: "Happy",

        imageUrl: "",

        fallbackEmoji: "🥰",
      },

      {
        id: "cute_pack_shy",

        name: "Shy",

        imageUrl: "",

        fallbackEmoji: "😊",
      },

      {
        id: "cute_pack_love",

        name: "Love",

        imageUrl: "",

        fallbackEmoji: "💕",
      },

      {
        id: "cute_pack_sad",

        name: "Sad",

        imageUrl: "",

        fallbackEmoji: "🥺",
      },

      {
        id: "cute_pack_wave",

        name: "Wave",

        imageUrl: "",

        fallbackEmoji: "👋",
      },
    ],

    metadata: {
      category: "cute",
      builtIn: true,
    },
  },

  funny_pack: {
    id: "funny_pack",

    name: "Funny Pack",

    description:
      "Funny stickers for chaotic conversations.",

    rarity: "uncommon",

    stickers: [
      {
        id: "funny_pack_lol",

        name: "LOL",

        imageUrl: "",

        fallbackEmoji: "🤣",
      },

      {
        id: "funny_pack_dead",

        name: "Dead",

        imageUrl: "",

        fallbackEmoji: "💀",
      },

      {
        id: "funny_pack_what",

        name: "What?",

        imageUrl: "",

        fallbackEmoji: "🤨",
      },

      {
        id: "funny_pack_bruh",

        name: "Bruh",

        imageUrl: "",

        fallbackEmoji: "😭",
      },

      {
        id: "funny_pack_sus",

        name: "Sus",

        imageUrl: "",

        fallbackEmoji: "🤨",
      },

      {
        id: "funny_pack_clown",

        name: "Clown",

        imageUrl: "",

        fallbackEmoji: "🤡",
      },
    ],

    metadata: {
      category: "funny",
      builtIn: true,
    },
  },

  premium_anime: {
    id: "premium_anime",

    name: "Premium Anime",

    description:
      "A premium anime-inspired sticker collection.",

    rarity: "epic",

    stickers: [
      {
        id: "premium_anime_power",

        name: "Power",

        imageUrl: "",

        fallbackEmoji: "⚔️",
      },

      {
        id: "premium_anime_rage",

        name: "Rage",

        imageUrl: "",

        fallbackEmoji: "😡",
      },

      {
        id: "premium_anime_hero",

        name: "Hero",

        imageUrl: "",

        fallbackEmoji: "🦸",
      },

      {
        id: "premium_anime_spark",

        name: "Spark",

        imageUrl: "",

        fallbackEmoji: "✨",
      },

      {
        id: "premium_anime_fire",

        name: "Fire",

        imageUrl: "",

        fallbackEmoji: "🔥",
      },

      {
        id: "premium_anime_cool",

        name: "Cool",

        imageUrl: "",

        fallbackEmoji: "😎",
      },
    ],

    metadata: {
      category: "anime",
      builtIn: true,
      premium: true,
    },
  },
};

/**
 * Get one sticker pack.
 */
export function getShopStickerPack(
  packId: string | null | undefined,
): ShopStickerPack | null {
  if (!packId) {
    return null;
  }

  return SHOP_STICKER_PACKS[packId] ?? null;
}

/**
 * Get all built-in packs.
 */
export function getAllShopStickerPacks(): ShopStickerPack[] {
  return Object.values(
    SHOP_STICKER_PACKS,
  );
}

/**
 * Check whether a sticker pack exists.
 */
export function hasShopStickerPack(
  packId: string | null | undefined,
): boolean {
  if (!packId) {
    return false;
  }

  return Boolean(
    SHOP_STICKER_PACKS[packId],
  );
}

/**
 * Get one sticker from a pack.
 */
export function getShopSticker(
  packId: string,
  stickerId: string,
): ShopSticker | null {
  const pack =
    getShopStickerPack(packId);

  if (!pack) {
    return null;
  }

  return (
    pack.stickers.find(
      (sticker) =>
        sticker.id === stickerId,
    ) ?? null
  );
}

/**
 * Get every sticker from multiple owned packs.
 */
export function getStickersFromShopPacks(
  packIds: string[],
): ShopSticker[] {
  const stickers: ShopSticker[] = [];

  for (const packId of packIds) {
    const pack =
      getShopStickerPack(packId);

    if (!pack) {
      continue;
    }

    stickers.push(...pack.stickers);
  }

  return stickers;
}

/**
 * Get all stickers from one pack.
 */
export function getShopPackStickers(
  packId: string,
): ShopSticker[] {
  return (
    getShopStickerPack(packId)
      ?.stickers ?? []
  );
}

/**
 * Get packs by rarity.
 */
export function getShopStickerPacksByRarity(
  rarity: ShopStickerPackRarity,
): ShopStickerPack[] {
  return getAllShopStickerPacks().filter(
    (pack) =>
      pack.rarity === rarity,
  );
}

/**
 * Get packs by category.
 */
export function getShopStickerPacksByCategory(
  category: string,
): ShopStickerPack[] {
  return getAllShopStickerPacks().filter(
    (pack) =>
      pack.metadata?['category'] ===
      category,
  );
}

/**
 * Convert a Shop sticker pack into metadata
 * suitable for shop_items.metadata.
 */
export function shopStickerPackToMetadata(
  pack: ShopStickerPack,
): Record<string, unknown> {
  return {
    cosmetic_type:
      "sticker_pack",

    sticker_pack_id:
      pack.id,

    name: pack.name,

    description:
      pack.description,

    rarity:
      pack.rarity,

    ...(pack.previewImageUrl
      ? {
          preview_image_url:
            pack.previewImageUrl,
        }
      : {}),

    stickers:
      pack.stickers.map(
        (sticker) => ({
          id: sticker.id,

          name: sticker.name,

          image_url:
            sticker.imageUrl,

          ...(sticker.fallbackEmoji
            ? {
                fallback_emoji:
                  sticker.fallbackEmoji,
              }
            : {}),
        }),
      ),

    ...(pack.metadata ?? {}),
  };
}

/**
 * Read a sticker pack from Supabase metadata.
 *
 * This allows Admin-created sticker packs
 * to work without modifying this source file.
 */
export function shopStickerPackFromMetadata(
  metadata:
    | Record<string, unknown>
    | null
    | undefined,
): ShopStickerPack | null {
  if (!metadata) {
    return null;
  }

  const id =
    typeof metadata['sticker_pack_id'] ===
    "string"
      ? metadata['sticker_pack_id']
      : typeof metadata['id'] === "string"
        ? metadata['id']
        : null;

  if (!id) {
    return null;
  }

  const name =
    typeof metadata['name'] === "string"
      ? metadata['name']
      : "Shop Sticker Pack";

  const description =
    typeof metadata['description'] ===
    "string"
      ? metadata['description']
      : "Shop sticker pack.";

  const rarity =
    isStickerPackRarity(
      metadata['rarity'],
    )
      ? metadata['rarity']
      : "common";

  const previewImageUrl =
    typeof metadata['preview_image_url'] ===
    "string"
      ? metadata['preview_image_url']
      : undefined;

  const rawStickers =
    Array.isArray(metadata['stickers'])
      ? metadata['stickers']
      : [];

  const stickers: ShopSticker[] =
    rawStickers
      .map((value) =>
        parseShopSticker(value),
      )
      .filter(
        (
          sticker,
        ): sticker is ShopSticker =>
          Boolean(sticker),
      );

  return {
    id,

    name,

    description,

    rarity,

    stickers,

    ...(previewImageUrl
      ? {
          previewImageUrl,
        }
      : {}),

    metadata,
  };
}

/**
 * Create an Admin-compatible custom
 * sticker pack.
 */
export function createCustomShopStickerPack(
  input: {
    id: string;

    name: string;

    description?: string;

    rarity?: ShopStickerPackRarity;

    previewImageUrl?: string;

    stickers: ShopSticker[];

    metadata?: Record<string, unknown>;
  },
): ShopStickerPack {
  return {
    id: input.id,

    name: input.name,

    description:
      input.description ??
      "Custom XUPPIN sticker pack.",

    rarity:
      input.rarity ??
      "common",

    stickers:
      input.stickers.map(
        (sticker) => ({
          ...sticker,
        }),
      ),

    ...(input.previewImageUrl
      ? {
          previewImageUrl:
            input.previewImageUrl,
        }
      : {}),

    metadata: {
      ...(input.metadata ?? {}),
      custom: true,
    },
  };
}

/**
 * Merge built-in packs with
 * Admin/Supabase packs.
 */
export function mergeShopStickerPacks(
  customPacks: ShopStickerPack[],
): ShopStickerPack[] {
  const map = new Map<
    string,
    ShopStickerPack
  >();

  for (const pack of getAllShopStickerPacks()) {
    map.set(pack.id, pack);
  }

  for (const pack of customPacks) {
    map.set(pack.id, pack);
  }

  return Array.from(map.values());
}

/**
 * Get a safe fallback pack.
 */
export function getDefaultShopStickerPack(): ShopStickerPack {
  return (
    SHOP_STICKER_PACKS
      ['anime_reactions']
  );
}

/**
 * Validate a sticker pack rarity.
 */
function isStickerPackRarity(
  value: unknown,
): value is ShopStickerPackRarity {
  return (
    value === "common" ||
    value === "uncommon" ||
    value === "rare" ||
    value === "epic" ||
    value === "legendary" ||
    value === "mythic"
  );
}

/**
 * Parse an individual sticker from
 * Supabase metadata.
 */
function parseShopSticker(
  value: unknown,
): ShopSticker | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const sticker =
    value as Record<string, unknown>;

  if (
    typeof sticker['id'] !== "string" ||
    typeof sticker['name'] !== "string"
  ) {
    return null;
  }

  const imageUrl =
    typeof sticker['image_url'] ===
    "string"
      ? sticker['image_url']
      : typeof sticker['imageUrl'] ===
          "string"
        ? sticker['imageUrl']
        : "";

  const fallbackEmoji =
    typeof sticker['fallback_emoji'] ===
    "string"
      ? sticker['fallback_emoji']
      : typeof sticker['fallbackEmoji'] ===
          "string"
        ? sticker['fallbackEmoji']
        : undefined;

  return {
    id: sticker['id'],

    name: sticker['name'],

    imageUrl,

    ...(fallbackEmoji
      ? {
          fallbackEmoji,
        }
      : {}),
  };
}