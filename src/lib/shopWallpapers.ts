/**
 * XUPPIN Shop Wallpapers
 *
 * Shop-owned chat wallpapers.
 *
 * The existing chatCustomization.ts / IndexedDB
 * system remains untouched.
 *
 * Shop wallpapers are an additional source that
 * will be connected during the final integration.
 */

export type ShopWallpaperType =
  | "image"
  | "video"
  | "gradient"
  | "pattern";

export type ShopWallpaperRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export interface ShopWallpaper {
  id: string;

  name: string;

  description: string;

  type: ShopWallpaperType;

  rarity: ShopWallpaperRarity;

  /**
   * Image URL for image wallpapers.
   */
  imageUrl?: string;

  /**
   * Video URL for animated wallpapers.
   */
  videoUrl?: string;

  /**
   * CSS background for code-based wallpapers.
   *
   * This means some wallpapers don't need an
   * uploaded image at all.
   */
  css?: string;

  /**
   * Optional thumbnail shown in Shop/equip UI.
   */
  previewImageUrl?: string;

  /**
   * Optional positioning.
   */
  backgroundPosition?: string;

  /**
   * Optional sizing.
   */
  backgroundSize?: string;

  /**
   * Optional repeat behavior.
   */
  backgroundRepeat?: string;

  /**
   * Optional overlay.
   */
  overlay?: string;

  metadata?: Record<string, unknown>;
}

/**
 * Built-in code-based wallpapers.
 *
 * These work without image URLs.
 */
export const SHOP_CODE_WALLPAPERS: Record<
  string,
  ShopWallpaper
> = {
  neon_blue: {
    id: "neon_blue",

    name: "Neon Blue",

    description:
      "A futuristic blue neon chat background.",

    type: "gradient",

    rarity: "common",

    css:
      "linear-gradient(135deg, #020617 0%, #0c4a6e 45%, #0369a1 100%)",

    metadata: {
      category: "neon",
      builtIn: true,
      codeBased: true,
    },
  },

  neon_purple: {
    id: "neon_purple",

    name: "Neon Purple",

    description:
      "A glowing purple futuristic chat background.",

    type: "gradient",

    rarity: "uncommon",

    css:
      "linear-gradient(135deg, #0f071a 0%, #581c87 45%, #7e22ce 100%)",

    metadata: {
      category: "neon",
      builtIn: true,
      codeBased: true,
    },
  },

  cyber_green: {
    id: "cyber_green",

    name: "Cyber Green",

    description:
      "A cyber-inspired green background.",

    type: "gradient",

    rarity: "uncommon",

    css:
      "linear-gradient(135deg, #02140a 0%, #14532d 50%, #16a34a 100%)",

    metadata: {
      category: "cyber",
      builtIn: true,
      codeBased: true,
    },
  },

  sunset: {
    id: "sunset",

    name: "Sunset",

    description:
      "A warm orange and purple sunset background.",

    type: "gradient",

    rarity: "rare",

    css:
      "linear-gradient(135deg, #431407 0%, #c2410c 45%, #7e22ce 100%)",

    metadata: {
      category: "gradient",
      builtIn: true,
      codeBased: true,
    },
  },

  ocean: {
    id: "ocean",

    name: "Deep Ocean",

    description:
      "A deep blue ocean-inspired chat background.",

    type: "gradient",

    rarity: "rare",

    css:
      "linear-gradient(135deg, #082f49 0%, #075985 50%, #164e63 100%)",

    metadata: {
      category: "nature",
      builtIn: true,
      codeBased: true,
    },
  },

  galaxy: {
    id: "galaxy",

    name: "Galaxy",

    description:
      "A cosmic purple and blue galaxy background.",

    type: "gradient",

    rarity: "epic",

    css:
      "radial-gradient(circle at 20% 20%, #4c1d95 0%, transparent 35%), radial-gradient(circle at 80% 80%, #1d4ed8 0%, transparent 35%), linear-gradient(135deg, #020617, #111827)",

    metadata: {
      category: "space",
      builtIn: true,
      codeBased: true,
    },
  },

  fire: {
    id: "fire",

    name: "Fire",

    description:
      "A powerful red and orange flame-inspired background.",

    type: "gradient",

    rarity: "epic",

    css:
      "radial-gradient(circle at 50% 100%, #f97316 0%, transparent 40%), linear-gradient(135deg, #450a0a, #991b1b, #ea580c)",

    metadata: {
      category: "element",
      builtIn: true,
      codeBased: true,
    },
  },

  ice: {
    id: "ice",

    name: "Ice",

    description:
      "A cool frozen blue background.",

    type: "gradient",

    rarity: "rare",

    css:
      "linear-gradient(135deg, #082f49, #0ea5e9, #bae6fd)",

    metadata: {
      category: "element",
      builtIn: true,
      codeBased: true,
    },
  },

  sakura: {
    id: "sakura",

    name: "Sakura",

    description:
      "A pink anime-inspired cherry blossom style.",

    type: "gradient",

    rarity: "epic",

    css:
      "radial-gradient(circle at 20% 20%, #f9a8d4 0%, transparent 20%), radial-gradient(circle at 80% 30%, #fbcfe8 0%, transparent 20%), linear-gradient(135deg, #500724, #831843, #be185d)",

    metadata: {
      category: "anime",
      builtIn: true,
      codeBased: true,
    },
  },

  midnight: {
    id: "midnight",

    name: "Midnight",

    description:
      "A clean dark midnight background.",

    type: "gradient",

    rarity: "common",

    css:
      "linear-gradient(135deg, #020617, #0f172a, #111827)",

    metadata: {
      category: "dark",
      builtIn: true,
      codeBased: true,
    },
  },

  emerald: {
    id: "emerald",

    name: "Emerald",

    description:
      "A rich emerald green chat background.",

    type: "gradient",

    rarity: "rare",

    css:
      "linear-gradient(135deg, #022c22, #065f46, #059669)",

    metadata: {
      category: "green",
      builtIn: true,
      codeBased: true,
    },
  },

  royal: {
    id: "royal",

    name: "Royal",

    description:
      "A deep royal purple background.",

    type: "gradient",

    rarity: "legendary",

    css:
      "linear-gradient(135deg, #1e1b4b, #4c1d95, #7e22ce, #c026d3)",

    metadata: {
      category: "royal",
      builtIn: true,
      codeBased: true,
    },
  },

  x_gold: {
    id: "x_gold",

    name: "X Gold",

    description:
      "A premium XUPPIN gold background.",

    type: "gradient",

    rarity: "mythic",

    css:
      "linear-gradient(135deg, #422006, #a16207, #f59e0b, #fde68a)",

    metadata: {
      category: "xuppin",
      builtIn: true,
      codeBased: true,
    },
  },
};

/**
 * Get a code-based wallpaper.
 */
export function getShopCodeWallpaper(
  wallpaperId:
    | string
    | null
    | undefined,
): ShopWallpaper | null {
  if (!wallpaperId) {
    return null;
  }

  return (
    SHOP_CODE_WALLPAPERS[
      wallpaperId
    ] ?? null
  );
}

/**
 * Get all built-in code wallpapers.
 */
export function getAllShopCodeWallpapers(): ShopWallpaper[] {
  return Object.values(
    SHOP_CODE_WALLPAPERS,
  );
}

/**
 * Check whether a code wallpaper exists.
 */
export function hasShopCodeWallpaper(
  wallpaperId:
    | string
    | null
    | undefined,
): boolean {
  if (!wallpaperId) {
    return false;
  }

  return Boolean(
    SHOP_CODE_WALLPAPERS[
      wallpaperId
    ],
  );
}

/**
 * Convert a Shop wallpaper to
 * Supabase shop_items.metadata.
 */
export function shopWallpaperToMetadata(
  wallpaper: ShopWallpaper,
): Record<string, unknown> {
  return {
    cosmetic_type: "wallpaper",

    wallpaper_id:
      wallpaper.id,

    name:
      wallpaper.name,

    description:
      wallpaper.description,

    wallpaper_type:
      wallpaper.type,

    rarity:
      wallpaper.rarity,

    ...(wallpaper.imageUrl
      ? {
          image_url:
            wallpaper.imageUrl,
        }
      : {}),

    ...(wallpaper.videoUrl
      ? {
          video_url:
            wallpaper.videoUrl,
        }
      : {}),

    ...(wallpaper.css
      ? {
          css:
            wallpaper.css,
        }
      : {}),

    ...(wallpaper.previewImageUrl
      ? {
          preview_image_url:
            wallpaper.previewImageUrl,
        }
      : {}),

    ...(wallpaper.backgroundPosition
      ? {
          background_position:
            wallpaper.backgroundPosition,
        }
      : {}),

    ...(wallpaper.backgroundSize
      ? {
          background_size:
            wallpaper.backgroundSize,
        }
      : {}),

    ...(wallpaper.backgroundRepeat
      ? {
          background_repeat:
            wallpaper.backgroundRepeat,
        }
      : {}),

    ...(wallpaper.overlay
      ? {
          overlay:
            wallpaper.overlay,
        }
      : {}),

    ...(wallpaper.metadata ?? {}),
  };
}

/**
 * Load a Shop wallpaper from Supabase metadata.
 *
 * This is what allows the future Admin Panel
 * to create wallpapers without changing this file.
 */
export function shopWallpaperFromMetadata(
  metadata:
    | Record<string, unknown>
    | null
    | undefined,
): ShopWallpaper | null {
  if (!metadata) {
    return null;
  }

  const id =
    typeof metadata['wallpaper_id'] ===
    "string"
      ? metadata['wallpaper_id']
      : typeof metadata['id'] === "string"
        ? metadata['id']
        : null;

  if (!id) {
    return null;
  }

  const name =
    typeof metadata['name'] ===
    "string"
      ? metadata['name']
      : "Shop Wallpaper";

  const description =
    typeof metadata['description'] ===
    "string"
      ? metadata['description']
      : "Shop chat wallpaper.";

  const type =
    isWallpaperType(
      metadata['wallpaper_type'],
    )
      ? metadata['wallpaper_type']
      : "image";

  const rarity =
    isWallpaperRarity(
      metadata['rarity'],
    )
      ? metadata['rarity']
      : "common";

  const imageUrl =
    typeof metadata['image_url'] ===
    "string"
      ? metadata['image_url']
      : undefined;

  const videoUrl =
    typeof metadata['video_url'] ===
    "string"
      ? metadata['video_url']
      : undefined;

  const css =
    typeof metadata['css'] ===
    "string"
      ? metadata['css']
      : undefined;

  const previewImageUrl =
    typeof metadata['preview_image_url'] ===
    "string"
      ? metadata['preview_image_url']
      : undefined;

  const backgroundPosition =
    typeof metadata['background_position'] ===
    "string"
      ? metadata['background_position']
      : undefined;

  const backgroundSize =
    typeof metadata['background_size'] ===
    "string"
      ? metadata['background_size']
      : undefined;

  const backgroundRepeat =
    typeof metadata['background_repeat'] ===
    "string"
      ? metadata['background_repeat']
      : undefined;

  const overlay =
    typeof metadata['overlay'] ===
    "string"
      ? metadata['overlay']
      : undefined;

  return {
    id,

    name,

    description,

    type,

    rarity,

    ...(imageUrl
      ? {
          imageUrl,
        }
      : {}),

    ...(videoUrl
      ? {
          videoUrl,
        }
      : {}),

    ...(css
      ? {
          css,
        }
      : {}),

    ...(previewImageUrl
      ? {
          previewImageUrl,
        }
      : {}),

    ...(backgroundPosition
      ? {
          backgroundPosition,
        }
      : {}),

    ...(backgroundSize
      ? {
          backgroundSize,
        }
      : {}),

    ...(backgroundRepeat
      ? {
          backgroundRepeat,
        }
      : {}),

    ...(overlay
      ? {
          overlay,
        }
      : {}),

    metadata,
  };
}

/**
 * Create a custom wallpaper for
 * the future Master Admin Panel.
 */
export function createCustomShopWallpaper(
  input: {
    id: string;

    name: string;

    description?: string;

    type: ShopWallpaperType;

    rarity?: ShopWallpaperRarity;

    imageUrl?: string;

    videoUrl?: string;

    css?: string;

    previewImageUrl?: string;

    backgroundPosition?: string;

    backgroundSize?: string;

    backgroundRepeat?: string;

    overlay?: string;

    metadata?: Record<string, unknown>;
  },
): ShopWallpaper {
  return {
    id: input.id,

    name: input.name,

    description:
      input.description ??
      "Custom XUPPIN wallpaper.",

    type: input.type,

    rarity:
      input.rarity ??
      "common",

    ...(input.imageUrl
      ? {
          imageUrl:
            input.imageUrl,
        }
      : {}),

    ...(input.videoUrl
      ? {
          videoUrl:
            input.videoUrl,
        }
      : {}),

    ...(input.css
      ? {
          css:
            input.css,
        }
      : {}),

    ...(input.previewImageUrl
      ? {
          previewImageUrl:
            input.previewImageUrl,
        }
      : {}),

    ...(input.backgroundPosition
      ? {
          backgroundPosition:
            input.backgroundPosition,
        }
      : {}),

    ...(input.backgroundSize
      ? {
          backgroundSize:
            input.backgroundSize,
        }
      : {}),

    ...(input.backgroundRepeat
      ? {
          backgroundRepeat:
            input.backgroundRepeat,
        }
      : {}),

    ...(input.overlay
      ? {
          overlay:
            input.overlay,
        }
      : {}),

    metadata: {
      ...(input.metadata ?? {}),
      custom: true,
    },
  };
}

/**
 * Merge built-in wallpapers with
 * Admin/Supabase wallpapers.
 */
export function mergeShopWallpapers(
  customWallpapers:
    ShopWallpaper[],
): ShopWallpaper[] {
  const map = new Map<
    string,
    ShopWallpaper
  >();

  for (
    const wallpaper of
    getAllShopCodeWallpapers()
  ) {
    map.set(
      wallpaper.id,
      wallpaper,
    );
  }

  for (
    const wallpaper of
    customWallpapers
  ) {
    map.set(
      wallpaper.id,
      wallpaper,
    );
  }

  return Array.from(
    map.values(),
  );
}

/**
 * Find all wallpapers of a rarity.
 */
export function getShopWallpapersByRarity(
  rarity: ShopWallpaperRarity,
): ShopWallpaper[] {
  return getAllShopCodeWallpapers().filter(
    (wallpaper) =>
      wallpaper.rarity === rarity,
  );
}

/**
 * Find wallpapers by category.
 */
export function getShopWallpapersByCategory(
  category: string,
): ShopWallpaper[] {
  return getAllShopCodeWallpapers().filter(
    (wallpaper) =>
      wallpaper.metadata.?['category'] ===
      category,
  );
}

/**
 * Determine whether a wallpaper
 * actually requires an uploaded asset.
 */
export function wallpaperNeedsAsset(
  wallpaper: ShopWallpaper,
): boolean {
  return (
    wallpaper.type === "image" ||
    wallpaper.type === "video"
  );
}

/**
 * Determine whether a wallpaper
 * can be rendered entirely with CSS.
 */
export function isCodeBasedWallpaper(
  wallpaper: ShopWallpaper,
): boolean {
  return (
    wallpaper.type === "gradient" ||
    wallpaper.type === "pattern"
  );
}

/**
 * Get the CSS background value
 * for a wallpaper.
 */
export function getShopWallpaperCss(
  wallpaper:
    | ShopWallpaper
    | null
    | undefined,
): string | undefined {
  if (!wallpaper) {
    return undefined;
  }

  if (
    wallpaper.css &&
    isCodeBasedWallpaper(wallpaper)
  ) {
    return wallpaper.css;
  }

  if (
    wallpaper.imageUrl &&
    wallpaper.type === "image"
  ) {
    return `url("${escapeCssUrl(
      wallpaper.imageUrl,
    )}")`;
  }

  return undefined;
}

/**
 * Get CSS background properties.
 */
export function getShopWallpaperStyle(
  wallpaper:
    | ShopWallpaper
    | null
    | undefined,
): Record<string, string> {
  if (!wallpaper) {
    return {};
  }

  const style: Record<
    string,
    string
  > = {};

  const background =
    getShopWallpaperCss(
      wallpaper,
    );

  if (background) {
    style['background'] =
      background;
  }

  if (
    wallpaper.backgroundPosition
  ) {
    style['backgroundPosition'] =
      wallpaper.backgroundPosition;
  }

  if (
    wallpaper.backgroundSize
  ) {
    style['backgroundSize'] =
      wallpaper.backgroundSize;
  }

  if (
    wallpaper.backgroundRepeat
  ) {
    style['backgroundRepeat'] =
      wallpaper.backgroundRepeat;
  }

  return style;
}

/**
 * Escape a URL before inserting it
 * into a CSS url() value.
 */
function escapeCssUrl(
  url: string,
): string {
  return url
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "")
    .replace(/\r/g, "");
}

/**
 * Validate wallpaper type.
 */
function isWallpaperType(
  value: unknown,
): value is ShopWallpaperType {
  return (
    value === "image" ||
    value === "video" ||
    value === "gradient" ||
    value === "pattern"
  );
}

/**
 * Validate wallpaper rarity.
 */
function isWallpaperRarity(
  value: unknown,
): value is ShopWallpaperRarity {
  return (
    value === "common" ||
    value === "uncommon" ||
    value === "rare" ||
    value === "epic" ||
    value === "legendary" ||
    value === "mythic"
  );
}