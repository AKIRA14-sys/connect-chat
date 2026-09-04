/**
 * XUPPIN Shop Fonts
 *
 * Code/data-based font cosmetics.
 *
 * IMPORTANT:
 * - This file does not modify the existing chat system.
 * - It does not replace chatCustomization.ts.
 * - It provides a safe font catalog that the final chat integration
 *   can consume later.
 * - Future Admin Panel entries can use the same metadata structure.
 */

export type ShopFontId =
  | "default"
  | "modern"
  | "classic"
  | "gaming"
  | "cyber"
  | "anime"
  | "comic"
  | "elegant"
  | "minimal"
  | "typewriter"
  | "pixel"
  | "rounded"
  | "bold"
  | "mono"
  | "neon";

export interface ShopFont {
  id: ShopFontId | string;
  name: string;
  description: string;

  /**
   * CSS font-family value.
   *
   * These use common/system fonts so the app does not need
   * to download anything just to display the font.
   */
  fontFamily: string;

  /**
   * Optional CSS font-weight.
   */
  fontWeight?: number;

  /**
   * Optional CSS letter spacing.
   */
  letterSpacing?: string;

  /**
   * Whether the font is primarily designed for
   * normal chat readability.
   */
  readable: boolean;

  /**
   * Optional metadata for Shop/Admin Panel.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Built-in Shop fonts.
 *
 * These are deliberately based on common/system fonts.
 * That means they can work without external font files.
 */
export const SHOP_FONTS: Record<string, ShopFont> = {
  default: {
    id: "default",
    name: "Default",
    description:
      "The normal XUPPIN chat font.",

    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",

    fontWeight: 400,
    letterSpacing: "normal",
    readable: true,

    metadata: {
      category: "standard",
      builtIn: true,
    },
  },

  modern: {
    id: "modern",
    name: "Modern",
    description:
      "A clean modern interface font.",

    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",

    fontWeight: 400,
    letterSpacing: "normal",
    readable: true,

    metadata: {
      category: "modern",
      builtIn: true,
    },
  },

  classic: {
    id: "classic",
    name: "Classic",
    description:
      "A traditional serif style for a classic appearance.",

    fontFamily:
      "Georgia, \"Times New Roman\", Times, serif",

    fontWeight: 400,
    letterSpacing: "normal",
    readable: true,

    metadata: {
      category: "classic",
      builtIn: true,
    },
  },

  gaming: {
    id: "gaming",
    name: "Gaming",
    description:
      "A bold gaming-style font for an energetic chat.",

    fontFamily:
      "\"Trebuchet MS\", Arial, sans-serif",

    fontWeight: 700,
    letterSpacing: "0.01em",
    readable: true,

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  cyber: {
    id: "cyber",
    name: "Cyber",
    description:
      "A futuristic monospace-inspired cyber style.",

    fontFamily:
      "\"Courier New\", Courier, monospace",

    fontWeight: 500,
    letterSpacing: "0.025em",
    readable: true,

    metadata: {
      category: "cyber",
      builtIn: true,
    },
  },

  anime: {
    id: "anime",
    name: "Anime",
    description:
      "A playful anime-inspired chat font.",

    fontFamily:
      "\"Trebuchet MS\", \"Comic Sans MS\", Arial, sans-serif",

    fontWeight: 600,
    letterSpacing: "0.005em",
    readable: true,

    metadata: {
      category: "anime",
      builtIn: true,
    },
  },

  comic: {
    id: "comic",
    name: "Comic",
    description:
      "A fun casual comic-style font.",

    fontFamily:
      "\"Comic Sans MS\", \"Trebuchet MS\", sans-serif",

    fontWeight: 500,
    letterSpacing: "normal",
    readable: true,

    metadata: {
      category: "fun",
      builtIn: true,
    },
  },

  elegant: {
    id: "elegant",
    name: "Elegant",
    description:
      "A refined serif font for a premium chat style.",

    fontFamily:
      "\"Palatino Linotype\", Palatino, Georgia, serif",

    fontWeight: 400,
    letterSpacing: "0.01em",
    readable: true,

    metadata: {
      category: "premium",
      builtIn: true,
    },
  },

  minimal: {
    id: "minimal",
    name: "Minimal",
    description:
      "A simple lightweight font for a clean interface.",

    fontFamily:
      "Arial, Helvetica, sans-serif",

    fontWeight: 400,
    letterSpacing: "normal",
    readable: true,

    metadata: {
      category: "minimal",
      builtIn: true,
    },
  },

  typewriter: {
    id: "typewriter",
    name: "Typewriter",
    description:
      "A classic typewriter-style monospace font.",

    fontFamily:
      "\"Courier New\", Courier, monospace",

    fontWeight: 400,
    letterSpacing: "0.02em",
    readable: true,

    metadata: {
      category: "retro",
      builtIn: true,
    },
  },

  pixel: {
    id: "pixel",
    name: "Pixel",
    description:
      "A retro gaming-style monospace appearance.",

    fontFamily:
      "\"Lucida Console\", Monaco, monospace",

    fontWeight: 700,
    letterSpacing: "0.02em",
    readable: true,

    metadata: {
      category: "gaming",
      builtIn: true,
    },
  },

  rounded: {
    id: "rounded",
    name: "Rounded",
    description:
      "A friendly rounded interface style.",

    fontFamily:
      "\"Trebuchet MS\", Arial, sans-serif",

    fontWeight: 500,
    letterSpacing: "normal",
    readable: true,

    metadata: {
      category: "friendly",
      builtIn: true,
    },
  },

  bold: {
    id: "bold",
    name: "Bold",
    description:
      "A strong bold style designed to stand out.",

    fontFamily:
      "Arial, Helvetica, sans-serif",

    fontWeight: 700,
    letterSpacing: "0.005em",
    readable: true,

    metadata: {
      category: "bold",
      builtIn: true,
    },
  },

  mono: {
    id: "mono",
    name: "Mono",
    description:
      "A clean developer-style monospace font.",

    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",

    fontWeight: 400,
    letterSpacing: "normal",
    readable: true,

    metadata: {
      category: "developer",
      builtIn: true,
    },
  },

  neon: {
    id: "neon",
    name: "Neon",
    description:
      "A futuristic monospace style designed for neon themes.",

    fontFamily:
      "\"Courier New\", Courier, monospace",

    fontWeight: 700,
    letterSpacing: "0.035em",
    readable: true,

    metadata: {
      category: "cyber",
      builtIn: true,
    },
  },
};

/**
 * Get one Shop font.
 */
export function getShopFont(
  fontId: string | null | undefined,
): ShopFont | null {
  if (!fontId) {
    return null;
  }

  return SHOP_FONTS[fontId] ?? null;
}

/**
 * Get every available built-in Shop font.
 */
export function getAllShopFonts(): ShopFont[] {
  return Object.values(SHOP_FONTS);
}

/**
 * Check whether a font exists.
 */
export function hasShopFont(
  fontId: string | null | undefined,
): boolean {
  if (!fontId) {
    return false;
  }

  return Boolean(SHOP_FONTS[fontId]);
}

/**
 * Return a CSS style object for a Shop font.
 */
export function getShopFontStyle(
  font: ShopFont,
): {
  fontFamily: string;
  fontWeight?: number;
  letterSpacing?: string;
} {
  return {
    fontFamily: font.fontFamily,
    fontWeight: font.fontWeight,
    letterSpacing: font.letterSpacing,
  };
}

/**
 * Return CSS variables for a Shop font.
 */
export function getShopFontCssVariables(
  font: ShopFont,
): Record<string, string> {
  return {
    "--shop-font-family": font.fontFamily,
    "--shop-font-weight": String(
      font.fontWeight ?? 400,
    ),
    "--shop-font-letter-spacing":
      font.letterSpacing ?? "normal",
  };
}

/**
 * Convert a Shop font into Supabase Shop metadata.
 *
 * This makes the structure compatible with the future
 * Admin Panel.
 */
export function shopFontToMetadata(
  font: ShopFont,
): Record<string, unknown> {
  return {
    cosmetic_type: "font",

    font_id: font.id,
    name: font.name,
    description: font.description,

    font_family: font.fontFamily,
    font_weight: font.fontWeight ?? 400,
    letter_spacing:
      font.letterSpacing ?? "normal",

    readable: font.readable,

    ...(font.metadata ?? {}),
  };
}

/**
 * Build a font from Supabase metadata.
 *
 * This allows future Admin-created fonts to be loaded
 * without changing this file.
 */
export function shopFontFromMetadata(
  metadata:
    | Record<string, unknown>
    | null
    | undefined,
): ShopFont | null {
  if (!metadata) {
    return null;
  }

  const id =
    typeof metadata['font_id'] === "string"
      ? metadata['font_id']
      : typeof metadata['id'] === "string"
        ? metadata['id']
        : null;

  if (!id) {
    return null;
  }

  const name =
    typeof metadata['name'] === "string"
      ? metadata['name']
      : "Shop Font";

  const description =
    typeof metadata['description'] === "string"
      ? metadata['description']
      : "A Shop font.";

  const fontFamily =
    typeof metadata['font_family'] === "string"
      ? metadata['font_family']
      : "ui-sans-serif, system-ui, sans-serif";

  const fontWeight =
    typeof metadata['font_weight'] === "number"
      ? metadata['font_weight']
      : 400;

  const letterSpacing =
    typeof metadata['letter_spacing'] === "string"
      ? metadata['letter_spacing']
      : "normal";

  const readable =
    typeof metadata['readable'] === "boolean"
      ? metadata['readable']
      : true;

  return {
    id,
    name,
    description,

    fontFamily,
    fontWeight,
    letterSpacing,

    readable,

    metadata,
  };
}

/**
 * Create an Admin-compatible custom font definition.
 *
 * The future Admin Panel can generate the same shape
 * and save the values inside shop_items.metadata.
 */
export function createCustomShopFont(
  input: {
    id: string;
    name: string;
    description?: string;
    fontFamily: string;
    fontWeight?: number;
    letterSpacing?: string;
    readable?: boolean;
    metadata?: Record<string, unknown>;
  },
): ShopFont {
  return {
    id: input.id,

    name: input.name,

    description:
      input.description ??
      "Custom Shop font.",

    fontFamily: input.fontFamily,

    fontWeight:
      input.fontWeight ?? 400,

    letterSpacing:
      input.letterSpacing ?? "normal",

    readable:
      input.readable ?? true,

    metadata: {
      ...(input.metadata ?? {}),
      custom: true,
    },
  };
}

/**
 * Merge built-in fonts with fonts loaded from Supabase.
 *
 * This is important for the future Admin Panel:
 *
 * Built-in fonts
 * +
 * Admin-created fonts
 * =
 * available Shop fonts
 */
export function mergeShopFonts(
  customFonts: ShopFont[],
): ShopFont[] {
  const map = new Map<string, ShopFont>();

  for (const font of getAllShopFonts()) {
    map.set(font.id, font);
  }

  for (const font of customFonts) {
    map.set(font.id, font);
  }

  return Array.from(map.values());
}

/**
 * Safe fallback font.
 */
export function getDefaultShopFont(): ShopFont {
  return SHOP_FONTS['default'];
}