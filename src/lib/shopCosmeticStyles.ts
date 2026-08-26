/**
 * Resolves visual styles for Shop cosmetics that do not require
 * an image URL (themes, bubbles, CSS wallpapers, profile frames, badges).
 *
 * Priority:
 * 1. Explicit metadata fields (flexible key names)
 * 2. Built-in presets matched by item_key / name
 */

import type { EquippedShopCosmetic } from "@/lib/gaming.functions";

export type ResolvedBubbleStyles = {
  mine: string | null;
  other: string | null;
  boxShadow: string | null;
  borderRadius: string | null;
};

export type ResolvedWallpaperStyles = {
  kind: "image" | "video" | "css" | null;
  url: string | null;
  css: string | null;
};

export type ResolvedThemeStyles = {
  background: string | null;
  bubbleMine: string | null;
  bubbleOther: string | null;
};

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

/** Pick first non-empty string from candidate keys on an object. */
function pick(
  obj: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | null {
  if (!obj) return null;
  for (const key of keys) {
    const v = asString(obj[key]);
    if (v) return v;
  }
  return null;
}

/** Deep-ish scan for a CSS-looking string under common keys. */
function pickDeep(
  meta: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!meta) return null;
  const direct = pick(meta, ...keys);
  if (direct) return direct;

  for (const nestedKey of [
    "colors",
    "css",
    "style",
    "styles",
    "theme",
    "appearance",
    "visual",
    "config",
  ]) {
    const nested = asRecord(meta[nestedKey]);
    if (!nested) continue;
    const found = pick(nested, ...keys);
    if (found) return found;
  }
  return null;
}

function labelOf(cosmetic: EquippedShopCosmetic): string {
  return `${cosmetic.item_key ?? ""} ${cosmetic.name ?? ""}`.toLowerCase();
}

/** Built-in CSS presets when shop metadata has no style fields. */
const THEME_PRESETS: {
  match: RegExp;
  background: string;
  bubbleMine: string;
  bubbleOther: string;
}[] = [
  {
    match: /inferno|fire\s*x|firex|flame|volcan|magma|lava/,
    background:
      "radial-gradient(circle at 20% 0%, rgba(255,100,0,0.35), transparent 50%), radial-gradient(circle at 80% 100%, rgba(180,0,0,0.3), transparent 45%), linear-gradient(180deg, #1a0500 0%, #0a0200 100%)",
    bubbleMine:
      "linear-gradient(135deg, #ff4d00 0%, #c91800 45%, #7a0000 100%)",
    bubbleOther: "linear-gradient(135deg, #3a1510 0%, #1f0a08 100%)",
  },
  {
    match: /neon|cyber|electric/,
    background:
      "radial-gradient(circle at 15% 10%, rgba(0,255,200,0.18), transparent 45%), radial-gradient(circle at 85% 90%, rgba(180,0,255,0.16), transparent 40%), linear-gradient(180deg, #050510 0%, #0a0a18 100%)",
    bubbleMine:
      "linear-gradient(135deg, #00f5d4 0%, #7b2ff7 100%)",
    bubbleOther: "linear-gradient(135deg, #1a1a2e 0%, #12121f 100%)",
  },
  {
    match: /ocean|aqua|sea|wave/,
    background:
      "radial-gradient(circle at 30% 0%, rgba(0,180,255,0.22), transparent 50%), linear-gradient(180deg, #021018 0%, #031a24 100%)",
    bubbleMine:
      "linear-gradient(135deg, #00b4d8 0%, #0077b6 100%)",
    bubbleOther: "linear-gradient(135deg, #0b2530 0%, #071820 100%)",
  },
  {
    match: /purple|violet|galaxy/,
    background:
      "radial-gradient(circle at 70% 20%, rgba(160,80,255,0.25), transparent 50%), linear-gradient(180deg, #12081f 0%, #0a0412 100%)",
    bubbleMine:
      "linear-gradient(135deg, #c084fc 0%, #7c3aed 100%)",
    bubbleOther: "linear-gradient(135deg, #221433 0%, #140a1f 100%)",
  },
  {
    match: /emerald|forest|green/,
    background:
      "radial-gradient(circle at 20% 80%, rgba(16,185,129,0.2), transparent 45%), linear-gradient(180deg, #03140d 0%, #020a06 100%)",
    bubbleMine:
      "linear-gradient(135deg, #34d399 0%, #059669 100%)",
    bubbleOther: "linear-gradient(135deg, #0b2b1c 0%, #061810 100%)",
  },
  {
    match: /rose|pink|sakura|cherry/,
    background:
      "radial-gradient(circle at 40% 0%, rgba(244,114,182,0.22), transparent 50%), linear-gradient(180deg, #1a0b14 0%, #0f060c 100%)",
    bubbleMine:
      "linear-gradient(135deg, #fb7185 0%, #e11d48 100%)",
    bubbleOther: "linear-gradient(135deg, #35121c 0%, #1f0a10 100%)",
  },
  {
    match: /gold|amber|sunset/,
    background:
      "radial-gradient(circle at 50% 0%, rgba(251,191,36,0.2), transparent 50%), linear-gradient(180deg, #1c0b03 0%, #0f0602 100%)",
    bubbleMine:
      "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)",
    bubbleOther: "linear-gradient(135deg, #3a1708 0%, #1f0c04 100%)",
  },
  {
    match: /midnight|dark|amoled|night/,
    background:
      "linear-gradient(180deg, #000000 0%, #0a0a0a 100%)",
    bubbleMine:
      "linear-gradient(135deg, #3f3f46 0%, #18181b 100%)",
    bubbleOther: "linear-gradient(135deg, #18181b 0%, #09090b 100%)",
  },
];

const WALLPAPER_PRESETS: { match: RegExp; css: string }[] = [
  {
    match: /blue/,
    css: "radial-gradient(circle at 30% 20%, rgba(59,130,246,0.45), transparent 50%), radial-gradient(circle at 80% 80%, rgba(37,99,235,0.35), transparent 45%), linear-gradient(180deg, #0a1628 0%, #020617 100%)",
  },
  {
    match: /red|crimson|blood/,
    css: "radial-gradient(circle at 40% 10%, rgba(239,68,68,0.4), transparent 50%), linear-gradient(180deg, #1a0505 0%, #0a0202 100%)",
  },
  {
    match: /green/,
    css: "radial-gradient(circle at 25% 30%, rgba(34,197,94,0.35), transparent 50%), linear-gradient(180deg, #052e16 0%, #022c22 100%)",
  },
  {
    match: /purple|violet/,
    css: "radial-gradient(circle at 60% 20%, rgba(168,85,247,0.4), transparent 50%), linear-gradient(180deg, #1e1033 0%, #0f0720 100%)",
  },
  {
    match: /gold|yellow/,
    css: "radial-gradient(circle at 50% 0%, rgba(250,204,21,0.35), transparent 55%), linear-gradient(180deg, #1c1400 0%, #0a0800 100%)",
  },
  {
    match: /black|dark|night/,
    css: "linear-gradient(180deg, #000000 0%, #111111 100%)",
  },
  {
    match: /gradient|aurora/,
    css: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 70%, #0f172a 100%)",
  },
];

const BUBBLE_PRESETS: {
  match: RegExp;
  mine: string;
  other: string;
  boxShadow?: string;
}[] = [
  {
    match: /inferno|fire|flame|lava/,
    mine: "linear-gradient(135deg, #ff4d00 0%, #c91800 100%)",
    other: "linear-gradient(135deg, #3a1510 0%, #1f0a08 100%)",
    boxShadow: "0 4px 14px rgba(255,80,0,0.35)",
  },
  {
    match: /glass|frost/,
    mine: "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 100%)",
    other: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
  },
  {
    match: /neon/,
    mine: "linear-gradient(135deg, #00f5d4 0%, #7b2ff7 100%)",
    other: "linear-gradient(135deg, #1a1a2e 0%, #12121f 100%)",
    boxShadow: "0 0 12px rgba(0,245,212,0.4)",
  },
  {
    match: /blue/,
    mine: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    other: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
  },
];

function themePreset(
  cosmetic: EquippedShopCosmetic,
): ResolvedThemeStyles | null {
  const label = labelOf(cosmetic);
  for (const p of THEME_PRESETS) {
    if (p.match.test(label)) {
      return {
        background: p.background,
        bubbleMine: p.bubbleMine,
        bubbleOther: p.bubbleOther,
      };
    }
  }
  // Generic readable theme if type is theme but no match
  if (cosmetic.cosmetic_type === "theme") {
    return {
      background:
        "radial-gradient(circle at 30% 0%, rgba(124,92,255,0.18), transparent 55%), linear-gradient(180deg, #0a0e14 0%, #0d1420 100%)",
      bubbleMine:
        "linear-gradient(135deg, #7c5cff 0%, #00d9ff 100%)",
      bubbleOther: "linear-gradient(135deg, #1a2233 0%, #0f141f 100%)",
    };
  }
  return null;
}

function wallpaperPreset(
  cosmetic: EquippedShopCosmetic,
): string | null {
  const label = labelOf(cosmetic);
  for (const p of WALLPAPER_PRESETS) {
    if (p.match.test(label)) return p.css;
  }
  if (cosmetic.cosmetic_type === "wallpaper") {
    return "radial-gradient(circle at 40% 20%, rgba(56,189,248,0.25), transparent 50%), linear-gradient(180deg, #0b1220 0%, #020617 100%)";
  }
  return null;
}

function bubblePreset(
  cosmetic: EquippedShopCosmetic,
): ResolvedBubbleStyles | null {
  const label = labelOf(cosmetic);
  for (const p of BUBBLE_PRESETS) {
    if (p.match.test(label)) {
      return {
        mine: p.mine,
        other: p.other,
        boxShadow: p.boxShadow ?? null,
        borderRadius: "18px",
      };
    }
  }
  if (cosmetic.cosmetic_type === "bubble") {
    return {
      mine: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
      other: "linear-gradient(135deg, #27272a 0%, #18181b 100%)",
      boxShadow: null,
      borderRadius: "18px",
    };
  }
  return null;
}

export function resolveThemeStyles(
  cosmetic: EquippedShopCosmetic | null,
): ResolvedThemeStyles {
  if (!cosmetic) {
    return { background: null, bubbleMine: null, bubbleOther: null };
  }

  const meta = asRecord(cosmetic.metadata);
  const background =
    pickDeep(meta, [
      "background",
      "messageAreaBackground",
      "bg",
      "areaBackground",
      "chatBackground",
    ]) ||
    pick(asRecord(meta?.colors), "background", "messageAreaBackground", "bg");

  const bubbleMine =
    pickDeep(meta, [
      "bubbleMine",
      "bubble_mine",
      "mine",
      "bubbleCss",
      "bubble_css",
    ]) ||
    pick(asRecord(meta?.colors), "bubbleMine", "bubble_mine", "mine") ||
    pick(asRecord(meta?.css), "mine", "bubbleMine", "background");

  const bubbleOther =
    pickDeep(meta, ["bubbleOther", "bubble_other", "other"]) ||
    pick(asRecord(meta?.colors), "bubbleOther", "other") ||
    pick(asRecord(meta?.css), "other", "bubbleOther");

  if (background || bubbleMine || bubbleOther) {
    return {
      background: background,
      bubbleMine: bubbleMine,
      bubbleOther: bubbleOther,
    };
  }

  const preset = themePreset(cosmetic);
  return (
    preset ?? {
      background: null,
      bubbleMine: null,
      bubbleOther: null,
    }
  );
}

export function resolveBubbleStyles(
  cosmetic: EquippedShopCosmetic | null,
): ResolvedBubbleStyles {
  if (!cosmetic) {
    return { mine: null, other: null, boxShadow: null, borderRadius: null };
  }

  const meta = asRecord(cosmetic.metadata);
  const css = asRecord(meta?.css) ?? meta;

  const mine =
    pick(css, "mine", "bubbleMine", "background", "bg") ||
    pickDeep(meta, ["mine", "bubbleMine", "background"]);
  const other =
    pick(css, "other", "bubbleOther") ||
    pickDeep(meta, ["other", "bubbleOther"]);
  const boxShadow =
    pick(css, "boxShadow", "shadow") ||
    pickDeep(meta, ["boxShadow", "shadow"]);
  const borderRadius =
    pick(css, "borderRadius", "radius") ||
    pickDeep(meta, ["borderRadius", "radius"]);

  if (mine || other || boxShadow || borderRadius) {
    return {
      mine,
      other,
      boxShadow,
      borderRadius,
    };
  }

  return (
    bubblePreset(cosmetic) ?? {
      mine: null,
      other: null,
      boxShadow: null,
      borderRadius: null,
    }
  );
}

export function resolveWallpaperStyles(
  cosmetic: EquippedShopCosmetic | null,
): ResolvedWallpaperStyles {
  if (!cosmetic) return { kind: null, url: null, css: null };

  const meta = asRecord(cosmetic.metadata);
  const media = asRecord(meta?.media);

  const url =
    pick(media, "url", "image_url", "src", "wallpaper_url") ||
    pick(meta, "url", "image_url", "wallpaper_url", "preview_url");

  const css =
    pick(meta, "css", "background", "bg") ||
    pick(asRecord(meta?.colors), "background", "css") ||
    pickDeep(meta, ["background", "css"]);

  if (css && !url) {
    return { kind: "css", url: null, css };
  }

  if (url) {
    const kindRaw = pick(media, "kind", "type");
    const kind =
      kindRaw === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(url)
        ? "video"
        : "image";
    return { kind, url, css: null };
  }

  const presetCss = wallpaperPreset(cosmetic);
  if (presetCss) {
    return { kind: "css", url: null, css: presetCss };
  }

  return { kind: null, url: null, css: null };
}

export function resolveProfileFrameStyle(
  cosmetic: EquippedShopCosmetic | null,
): import("react").CSSProperties | undefined {
  if (!cosmetic) return undefined;

  const meta = asRecord(cosmetic.metadata);
  const style = asRecord(meta?.style) ?? meta;

  const ring =
    pick(style, "ring", "border", "outline", "color") ||
    pickDeep(meta, ["ring", "border", "outline", "color"]);
  const shadow =
    pick(style, "shadow", "boxShadow") ||
    pickDeep(meta, ["shadow", "boxShadow"]);

  // Name-based fallback frames (no image needed)
  if (!ring && !shadow) {
    const label = labelOf(cosmetic);
    if (/gold|legend/.test(label)) {
      return {
        outline: "2px solid #fbbf24",
        outlineOffset: "2px",
        boxShadow: "0 0 12px rgba(251,191,36,0.45)",
      };
    }
    if (/neon|cyber/.test(label)) {
      return {
        outline: "2px solid #00f5d4",
        outlineOffset: "2px",
        boxShadow: "0 0 12px rgba(0,245,212,0.45)",
      };
    }
    if (/fire|inferno/.test(label)) {
      return {
        outline: "2px solid #ff4d00",
        outlineOffset: "2px",
        boxShadow: "0 0 12px rgba(255,77,0,0.45)",
      };
    }
    if (cosmetic.cosmetic_type === "profile_frame") {
      return {
        outline: "2px solid #a78bfa",
        outlineOffset: "2px",
      };
    }
    return undefined;
  }

  const out: import("react").CSSProperties = {};
  if (ring) {
    out.outline =
      ring.includes("solid") || ring.includes("px")
        ? ring
        : `2px solid ${ring}`;
    out.outlineOffset =
      pick(style, "ringOffset", "offset") || "2px";
  }
  if (shadow) {
    out.boxShadow = shadow;
  }
  return out;
}

export function resolveBadgeLabel(
  cosmetic: EquippedShopCosmetic | null,
): string | null {
  if (!cosmetic) return null;
  const meta = asRecord(cosmetic.metadata);
  const label =
    pick(meta, "label", "text", "badge", "title") ||
    (cosmetic.name ? String(cosmetic.name) : null);
  return label;
}
