/**
 * XUPPIN Shop Themes
 *
 * Code-based themes for Shop cosmetics.
 *
 * IMPORTANT:
 * - These themes do NOT require images.
 * - They do NOT modify the existing chat customization system.
 * - They are standalone Shop cosmetic definitions.
 * - $id.tsx will consume these later in the final integration step.
 */

export type ShopThemeId =
  | "zenitsu-storm"
  | "akaza-crimson"
  | "itachi-moon"
  | "gaming-neon"
  | "cinematic-dark"
  | "cyber-night"
  | "crystal"
  | "anime-sakura"
  | "x-gaming"
  | "x-coins"
  | "midnight"
  | "emerald"
  | "royal-purple"
  | "ocean-blue"
  | "sunset"
  | "custom-gradient";

export interface ShopTheme {
  id: ShopThemeId;
  name: string;
  description: string;

  /**
   * Main chat area background.
   */
  messageAreaBackground: string;

  /**
   * Overall chat background.
   */
  background: string;

  /**
   * User's own message bubble.
   */
  bubbleMine: string;

  /**
   * Other user's message bubble.
   */
  bubbleTheirs: string;

  /**
   * Main text color.
   */
  text: string;

  /**
   * Secondary text color.
   */
  secondaryText: string;

  /**
   * Accent color.
   */
  accent: string;

  /**
   * Border color.
   */
  border: string;

  /**
   * Chat input background.
   */
  inputBackground: string;

  /**
   * Chat input text color.
   */
  inputText: string;

  /**
   * Optional shadow.
   */
  shadow?: string;

  /**
   * Optional glow.
   */
  glow?: string;

  /**
   * Whether this is considered a dark theme.
   */
  dark: boolean;

  /**
   * Optional Shop metadata.
   */
  metadata?: Record<string, unknown>;
}

/**
 * All code-based Shop themes.
 */
export const SHOP_THEMES: Record<ShopThemeId, ShopTheme> = {
  "zenitsu-storm": {
    id: "zenitsu-storm",
    name: "Zenitsu Storm",
    description:
      "Electric yellow and storm-blue colors inspired by lightning and anime energy.",

    messageAreaBackground:
      "linear-gradient(135deg, #07111f 0%, #0d1b2f 45%, #101c32 100%)",

    background:
      "linear-gradient(135deg, #050b14 0%, #0b1628 50%, #111d33 100%)",

    bubbleMine:
      "linear-gradient(135deg, #facc15 0%, #eab308 100%)",

    bubbleTheirs:
      "linear-gradient(135deg, #172554 0%, #1e3a8a 100%)",

    text: "#ffffff",
    secondaryText: "#cbd5e1",
    accent: "#facc15",
    border: "rgba(250, 204, 21, 0.35)",

    inputBackground:
      "rgba(15, 23, 42, 0.92)",

    inputText: "#ffffff",

    shadow:
      "0 8px 30px rgba(250, 204, 21, 0.12)",

    glow:
      "0 0 24px rgba(250, 204, 21, 0.25)",

    dark: true,

    metadata: {
      style: "anime",
      inspiration: "lightning",
      primaryColor: "#facc15",
      secondaryColor: "#1e3a8a",
    },
  },

  "akaza-crimson": {
    id: "akaza-crimson",
    name: "Akaza Crimson",
    description:
      "A powerful crimson and violet theme inspired by intense anime battle energy.",

    messageAreaBackground:
      "linear-gradient(135deg, #18040b 0%, #2a0615 50%, #1e0834 100%)",

    background:
      "linear-gradient(135deg, #100208 0%, #260512 55%, #160525 100%)",

    bubbleMine:
      "linear-gradient(135deg, #dc2626 0%, #be123c 100%)",

    bubbleTheirs:
      "linear-gradient(135deg, #3b0764 0%, #581c87 100%)",

    text: "#ffffff",
    secondaryText: "#fecdd3",
    accent: "#ef4444",
    border: "rgba(239, 68, 68, 0.35)",

    inputBackground:
      "rgba(35, 5, 20, 0.95)",

    inputText: "#ffffff",

    shadow:
      "0 8px 30px rgba(239, 68, 68, 0.16)",

    glow:
      "0 0 24px rgba(239, 68, 68, 0.28)",

    dark: true,

    metadata: {
      style: "anime",
      inspiration: "battle",
      primaryColor: "#ef4444",
      secondaryColor: "#7e22ce",
    },
  },

  "itachi-moon": {
    id: "itachi-moon",
    name: "Itachi Moon",
    description:
      "A dark red and black cinematic theme with a subtle moonlit atmosphere.",

    messageAreaBackground:
      "linear-gradient(135deg, #030303 0%, #160508 55%, #090909 100%)",

    background:
      "linear-gradient(135deg, #020202 0%, #120306 50%, #050505 100%)",

    bubbleMine:
      "linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)",

    bubbleTheirs:
      "linear-gradient(135deg, #171717 0%, #262626 100%)",

    text: "#ffffff",
    secondaryText: "#d4d4d4",
    accent: "#dc2626",
    border: "rgba(220, 38, 38, 0.30)",

    inputBackground:
      "rgba(10, 10, 10, 0.96)",

    inputText: "#ffffff",

    shadow:
      "0 8px 30px rgba(0, 0, 0, 0.45)",

    glow:
      "0 0 20px rgba(220, 38, 38, 0.18)",

    dark: true,

    metadata: {
      style: "anime",
      inspiration: "moon",
      primaryColor: "#dc2626",
      secondaryColor: "#000000",
    },
  },

  "gaming-neon": {
    id: "gaming-neon",
    name: "Gaming Neon",
    description:
      "A neon gaming interface combining electric green, blue, and purple.",

    messageAreaBackground:
      "linear-gradient(135deg, #020617 0%, #07132a 45%, #160b2e 100%)",

    background:
      "linear-gradient(135deg, #01040b 0%, #061225 50%, #120620 100%)",

    bubbleMine:
      "linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)",

    bubbleTheirs:
      "linear-gradient(135deg, #312e81 0%, #581c87 100%)",

    text: "#ffffff",
    secondaryText: "#cbd5e1",
    accent: "#22c55e",
    border: "rgba(34, 197, 94, 0.35)",

    inputBackground:
      "rgba(2, 6, 23, 0.95)",

    inputText: "#ffffff",

    shadow:
      "0 8px 30px rgba(34, 197, 94, 0.14)",

    glow:
      "0 0 28px rgba(34, 197, 94, 0.25)",

    dark: true,

    metadata: {
      style: "gaming",
      primaryColor: "#22c55e",
      secondaryColor: "#7c3aed",
    },
  },

  "cinematic-dark": {
    id: "cinematic-dark",
    name: "Cinematic Dark",
    description:
      "A premium black and gold movie-style theme.",

    messageAreaBackground:
      "linear-gradient(135deg, #050505 0%, #111111 55%, #17120a 100%)",

    background:
      "linear-gradient(135deg, #020202 0%, #0b0b0b 60%, #171107 100%)",

    bubbleMine:
      "linear-gradient(135deg, #d4af37 0%, #a16207 100%)",

    bubbleTheirs:
      "linear-gradient(135deg, #18181b 0%, #27272a 100%)",

    text: "#ffffff",
    secondaryText: "#d4d4d8",
    accent: "#d4af37",
    border: "rgba(212, 175, 55, 0.35)",

    inputBackground:
      "rgba(10, 10, 10, 0.96)",

    inputText: "#ffffff",

    shadow:
      "0 8px 30px rgba(212, 175, 55, 0.12)",

    glow:
      "0 0 24px rgba(212, 175, 55, 0.18)",

    dark: true,

    metadata: {
      style: "cinematic",
      primaryColor: "#d4af37",
      secondaryColor: "#000000",
    },
  },

  "cyber-night": {
    id: "cyber-night",
    name: "Cyber Night",
    description:
      "A futuristic blue and purple cyber interface.",

    messageAreaBackground:
      "linear-gradient(135deg, #020617 0%, #0c1640 50%, #1e1147 100%)",

    background:
      "linear-gradient(135deg, #01030a 0%, #081337 55%, #190b3d 100%)",

    bubbleMine:
      "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",

    bubbleTheirs:
      "linear-gradient(135deg, #111827 0%, #1e293b 100%)",

    text: "#ffffff",
    secondaryText: "#c7d2fe",
    accent: "#8b5cf6",
    border: "rgba(139, 92, 246, 0.35)",

    inputBackground:
      "rgba(3, 7, 18, 0.96)",

    inputText: "#ffffff",

    shadow:
      "0 8px 30px rgba(124, 58, 237, 0.16)",

    glow:
      "0 0 26px rgba(139, 92, 246, 0.28)",

    dark: true,

    metadata: {
      style: "cyber",
      primaryColor: "#8b5cf6",
      secondaryColor: "#2563eb",
    },
  },

  crystal: {
    id: "crystal",
    name: "Crystal",
    description:
      "A clean cyan and icy-blue theme with a glass-like appearance.",

    messageAreaBackground:
      "linear-gradient(135deg, #ecfeff 0%, #cffafe 50%, #dbeafe 100%)",

    background:
      "linear-gradient(135deg, #f8fafc 0%, #ecfeff 50%, #eff6ff 100%)",

    bubbleMine:
      "linear-gradient(135deg, #0891b2 0%, #2563eb 100%)",

    bubbleTheirs:
      "rgba(255, 255, 255, 0.90)",

    text: "#0f172a",
    secondaryText: "#475569",
    accent: "#0891b2",
    border: "rgba(8, 145, 178, 0.25)",

    inputBackground:
      "rgba(255, 255, 255, 0.90)",

    inputText: "#0f172a",

    shadow:
      "0 8px 30px rgba(8, 145, 178, 0.10)",

    glow:
      "0 0 20px rgba(8, 145, 178, 0.16)",

    dark: false,

    metadata: {
      style: "crystal",
      primaryColor: "#0891b2",
      secondaryColor: "#2563eb",
    },
  },

  "anime-sakura": {
    id: "anime-sakura",
    name: "Anime Sakura",
    description:
      "Soft pink and violet colors inspired by anime sakura scenes.",

    messageAreaBackground:
      "linear-gradient(135deg, #fff1f2 0%, #fce7f3 50%, #f3e8ff 100%)",

    background:
      "linear-gradient(135deg, #fff7f8 0%, #fdf2f8 50%, #faf5ff 100%)",

    bubbleMine:
      "linear-gradient(135deg, #ec4899 0%, #a855f7 100%)",

    bubbleTheirs:
      "rgba(255, 255, 255, 0.92)",

    text: "#1f1720",
    secondaryText: "#6b5261",
    accent: "#ec4899",
    border: "rgba(236, 72, 153, 0.25)",

    inputBackground:
      "rgba(255, 255, 255, 0.92)",

    inputText: "#1f1720",

    shadow:
      "0 8px 30px rgba(236, 72, 153, 0.10)",

    glow:
      "0 0 20px rgba(236, 72, 153, 0.16)",

    dark: false,

    metadata: {
      style: "anime",
      inspiration: "sakura",
      primaryColor: "#ec4899",
      secondaryColor: "#a855f7",
    },
  },

  "x-gaming": {
    id: "x-gaming",
    name: "X Gaming",
    description:
      "The official-style X Gaming green and black theme.",

    messageAreaBackground:
      "linear-gradient(135deg, #020604 0%, #07130d 50%, #03100a 100%)",

    background:
      "linear-gradient(135deg, #010302 0%, #06100a 50%, #020a06 100%)",

    bubbleMine:
      "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",

    bubbleTheirs:
      "linear-gradient(135deg, #111827 0%, #1f2937 100%)",

    text: "#ffffff",
    secondaryText: "#bbf7d0",
    accent: "#22c55e",
    border: "rgba(34, 197, 94, 0.35)",

    inputBackground:
      "rgba(3, 10, 6, 0.96)",

    inputText: "#ffffff",

    shadow:
      "0 8px 30px rgba(34, 197, 94, 0.14)",

    glow:
      "0 0 26px rgba(34, 197, 94, 0.24)",

    dark: true,

    metadata: {
      style: "gaming",
      primaryColor: "#22c55e",
      secondaryColor: "#000000",
    },
  },

  "x-coins": {
    id: "x-coins",
    name: "X Coins",
    description:
      "A gold and dark theme inspired by the X Coin economy.",

    messageAreaBackground:
      "linear-gradient(135deg, #0c0800 0%, #191100 50%, #0d0a02 100%)",

    background:
      "linear-gradient(135deg, #050400 0%, #120c00 50%, #080600 100%)",

    bubbleMine:
      "linear-gradient(135deg, #facc15 0%, #eab308 100%)",

    bubbleTheirs:
      "linear-gradient(135deg, #292524 0%, #44403c 100%)",

    text: "#ffffff",
    secondaryText: "#fde68a",
    accent: "#facc15",
    border: "rgba(250, 204, 21, 0.35)",

    inputBackground:
      "rgba(12, 8, 0, 0.96)",

    inputText: "#ffffff",

    shadow:
      "0 8px 30px rgba(250, 204, 21, 0.15)",

    glow:
      "0 0 26px rgba(250, 204, 21, 0.25)",

    dark: true,

    metadata: {
      style: "economy",
      primaryColor: "#facc15",
      secondaryColor: "#000000",

      /**
       * The actual X Coin icon/color in the app remains
       * controlled by the existing wallet/coin UI.
       */
      preservesCoinColor: true,
    },
  },

  midnight: {
    id: "midnight",
    name: "Midnight",
    description:
      "A simple deep-blue night theme.",

    messageAreaBackground:
      "linear-gradient(135deg, #020617 0%, #0f172a 100%)",

    background:
      "linear-gradient(135deg, #020617 0%, #0b1120 100%)",

    bubbleMine:
      "linear-gradient(135deg, #334155 0%, #475569 100%)",

    bubbleTheirs:
      "linear-gradient(135deg, #111827 0%, #1f2937 100%)",

    text: "#ffffff",
    secondaryText: "#cbd5e1",
    accent: "#60a5fa",
    border: "rgba(96, 165, 250, 0.25)",

    inputBackground:
      "rgba(15, 23, 42, 0.95)",

    inputText: "#ffffff",

    shadow:
      "0 8px 30px rgba(15, 23, 42, 0.35)",

    dark: true,
  },

  emerald: {
    id: "emerald",
    name: "Emerald",
    description:
      "A clean emerald green theme.",

    messageAreaBackground:
      "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",

    background:
      "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",

    bubbleMine:
      "linear-gradient(135deg, #059669 0%, #10b981 100%)",

    bubbleTheirs:
      "rgba(255, 255, 255, 0.92)",

    text: "#052e16",
    secondaryText: "#166534",
    accent: "#10b981",
    border: "rgba(16, 185, 129, 0.25)",

    inputBackground:
      "rgba(255, 255, 255, 0.95)",

    inputText: "#052e16",

    shadow:
      "0 8px 30px rgba(16, 185, 129, 0.10)",

    dark: false,
  },

  "royal-purple": {
    id: "royal-purple",
    name: "Royal Purple",
    description:
      "A rich purple theme with a premium appearance.",

    messageAreaBackground:
      "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #ede9fe 100%)",

    background:
      "linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)",

    bubbleMine:
      "linear-gradient(135deg, #7e22ce 0%, #9333ea 100%)",

    bubbleTheirs:
      "rgba(255, 255, 255, 0.94)",

    text: "#2e1065",
    secondaryText: "#6b21a8",
    accent: "#9333ea",
    border: "rgba(147, 51, 234, 0.25)",

    inputBackground:
      "rgba(255, 255, 255, 0.94)",

    inputText: "#2e1065",

    shadow:
      "0 8px 30px rgba(147, 51, 234, 0.12)",

    glow:
      "0 0 20px rgba(147, 51, 234, 0.16)",

    dark: false,
  },

  "ocean-blue": {
    id: "ocean-blue",
    name: "Ocean Blue",
    description:
      "A calm blue ocean-inspired theme.",

    messageAreaBackground:
      "linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #cffafe 100%)",

    background:
      "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",

    bubbleMine:
      "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",

    bubbleTheirs:
      "rgba(255, 255, 255, 0.94)",

    text: "#082f49",
    secondaryText: "#075985",
    accent: "#0284c7",
    border: "rgba(2, 132, 199, 0.25)",

    inputBackground:
      "rgba(255, 255, 255, 0.94)",

    inputText: "#082f49",

    shadow:
      "0 8px 30px rgba(2, 132, 199, 0.10)",

    dark: false,
  },

  sunset: {
    id: "sunset",
    name: "Sunset",
    description:
      "A warm orange, pink, and purple sunset gradient.",

    messageAreaBackground:
      "linear-gradient(135deg, #fff7ed 0%, #fce7f3 50%, #f3e8ff 100%)",

    background:
      "linear-gradient(135deg, #fff7ed 0%, #fdf2f8 55%, #faf5ff 100%)",

    bubbleMine:
      "linear-gradient(135deg, #f97316 0%, #ec4899 100%)",

    bubbleTheirs:
      "rgba(255, 255, 255, 0.94)",

    text: "#431407",
    secondaryText: "#7c2d12",
    accent: "#f97316",
    border: "rgba(249, 115, 22, 0.25)",

    inputBackground:
      "rgba(255, 255, 255, 0.94)",

    inputText: "#431407",

    shadow:
      "0 8px 30px rgba(249, 115, 22, 0.12)",

    glow:
      "0 0 20px rgba(236, 72, 153, 0.14)",

    dark: false,
  },

  "custom-gradient": {
    id: "custom-gradient",
    name: "Custom Gradient",
    description:
      "A flexible gradient-based theme that can be customized later.",

    messageAreaBackground:
      "linear-gradient(135deg, #111827 0%, #312e81 50%, #581c87 100%)",

    background:
      "linear-gradient(135deg, #030712 0%, #1e1b4b 50%, #3b0764 100%)",

    bubbleMine:
      "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",

    bubbleTheirs:
      "linear-gradient(135deg, #1f2937 0%, #374151 100%)",

    text: "#ffffff",
    secondaryText: "#ddd6fe",
    accent: "#a855f7",
    border: "rgba(168, 85, 247, 0.35)",

    inputBackground:
      "rgba(3, 7, 18, 0.95)",

    inputText: "#ffffff",

    shadow:
      "0 8px 30px rgba(168, 85, 247, 0.15)",

    glow:
      "0 0 26px rgba(168, 85, 247, 0.25)",

    dark: true,

    metadata: {
      style: "customizable",
      supportsCustomColors: true,
    },
  },
};

/**
 * Get a Shop theme by ID.
 */
export function getShopTheme(
  themeId: string | null | undefined,
): ShopTheme | null {
  if (!themeId) {
    return null;
  }

  return (
    SHOP_THEMES[themeId as ShopThemeId] ?? null
  );
}

/**
 * Get all Shop themes.
 */
export function getAllShopThemes(): ShopTheme[] {
  return Object.values(SHOP_THEMES);
}

/**
 * Check whether a Shop theme exists.
 */
export function hasShopTheme(
  themeId: string | null | undefined,
): boolean {
  if (!themeId) {
    return false;
  }

  return Boolean(
    SHOP_THEMES[themeId as ShopThemeId],
  );
}

/**
 * Convert a Shop theme into metadata that can be stored
 * in shop_items.metadata.
 */
export function shopThemeToMetadata(
  theme: ShopTheme,
): Record<string, unknown> {
  return {
    cosmetic_type: "theme",
    theme_id: theme.id,
    name: theme.name,

    background: theme.background,
    message_area_background:
      theme.messageAreaBackground,

    bubble_mine: theme.bubbleMine,
    bubble_theirs: theme.bubbleTheirs,

    text: theme.text,
    secondary_text: theme.secondaryText,
    accent: theme.accent,
    border: theme.border,

    input_background:
      theme.inputBackground,

    input_text: theme.inputText,

    shadow: theme.shadow ?? null,
    glow: theme.glow ?? null,

    dark: theme.dark,

    ...(theme.metadata ?? {}),
  };
}

/**
 * Create a theme directly from Shop metadata.
 *
 * This is useful when the Shop item is stored in Supabase
 * and its metadata contains the theme colors.
 */
export function shopThemeFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): ShopTheme | null {
  if (!metadata) {
    return null;
  }

  const themeId =
    typeof metadata.theme_id === "string"
      ? metadata.theme_id
      : null;

  if (themeId && hasShopTheme(themeId)) {
    return getShopTheme(themeId);
  }

  const name =
    typeof metadata.name === "string"
      ? metadata.name
      : "Shop Theme";

  const background =
    typeof metadata.background === "string"
      ? metadata.background
      : "#111827";

  const messageAreaBackground =
    typeof metadata.message_area_background === "string"
      ? metadata.message_area_background
      : background;

  const bubbleMine =
    typeof metadata.bubble_mine === "string"
      ? metadata.bubble_mine
      : "#22c55e";

  const bubbleTheirs =
    typeof metadata.bubble_theirs === "string"
      ? metadata.bubble_theirs
      : "#1f2937";

  const text =
    typeof metadata.text === "string"
      ? metadata.text
      : "#ffffff";

  const secondaryText =
    typeof metadata.secondary_text === "string"
      ? metadata.secondary_text
      : "#cbd5e1";

  const accent =
    typeof metadata.accent === "string"
      ? metadata.accent
      : "#22c55e";

  const border =
    typeof metadata.border === "string"
      ? metadata.border
      : "rgba(255,255,255,0.15)";

  const inputBackground =
    typeof metadata.input_background === "string"
      ? metadata.input_background
      : "rgba(15,23,42,0.95)";

  const inputText =
    typeof metadata.input_text === "string"
      ? metadata.input_text
      : "#ffffff";

  const shadow =
    typeof metadata.shadow === "string"
      ? metadata.shadow
      : undefined;

  const glow =
    typeof metadata.glow === "string"
      ? metadata.glow
      : undefined;

  const dark =
    typeof metadata.dark === "boolean"
      ? metadata.dark
      : true;

  return {
    id: "custom-gradient",
    name,
    description:
      "A Shop theme created from cosmetic metadata.",

    messageAreaBackground,
    background,
    bubbleMine,
    bubbleTheirs,

    text,
    secondaryText,
    accent,
    border,

    inputBackground,
    inputText,

    shadow,
    glow,

    dark,

    metadata,
  };
}

/**
 * Build CSS variables for a Shop theme.
 *
 * Later, the Chat Customize UI can apply these variables
 * to the chat container without putting theme logic into $id.tsx.
 */
export function getShopThemeCssVariables(
  theme: ShopTheme,
): Record<string, string> {
  return {
    "--shop-theme-background":
      theme.background,

    "--shop-theme-message-area":
      theme.messageAreaBackground,

    "--shop-theme-bubble-mine":
      theme.bubbleMine,

    "--shop-theme-bubble-theirs":
      theme.bubbleTheirs,

    "--shop-theme-text":
      theme.text,

    "--shop-theme-secondary-text":
      theme.secondaryText,

    "--shop-theme-accent":
      theme.accent,

    "--shop-theme-border":
      theme.border,

    "--shop-theme-input-background":
      theme.inputBackground,

    "--shop-theme-input-text":
      theme.inputText,

    "--shop-theme-shadow":
      theme.shadow ?? "none",

    "--shop-theme-glow":
      theme.glow ?? "none",
  };
}

/**
 * Create a custom code-based theme.
 *
 * This allows us to generate themes without images.
 */
export function createCustomShopTheme(
  input: Partial<Omit<ShopTheme, "id">> & {
    name: string;
  },
): ShopTheme {
  return {
    id: "custom-gradient",

    name: input.name,

    description:
      input.description ??
      "Custom code-based Shop theme.",

    messageAreaBackground:
      input.messageAreaBackground ??
      input.background ??
      "#111827",

    background:
      input.background ??
      "#111827",

    bubbleMine:
      input.bubbleMine ??
      "#22c55e",

    bubbleTheirs:
      input.bubbleTheirs ??
      "#1f2937",

    text:
      input.text ??
      "#ffffff",

    secondaryText:
      input.secondaryText ??
      "#cbd5e1",

    accent:
      input.accent ??
      "#22c55e",

    border:
      input.border ??
      "rgba(255,255,255,0.15)",

    inputBackground:
      input.inputBackground ??
      "rgba(15,23,42,0.95)",

    inputText:
      input.inputText ??
      "#ffffff",

    shadow:
      input.shadow,

    glow:
      input.glow,

    dark:
      input.dark ??
      true,

    metadata:
      input.metadata,
  };
}