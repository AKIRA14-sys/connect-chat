/**
 * Resolves visual styles for Shop cosmetics that do not require
 * an image URL (themes, bubbles, CSS wallpapers, profile frames, badges).
 *
 * Themes can include a full-screen emoji pattern overlay so looks like
 * Inferno X feel like fire — not only a flat color wash.
 */

import type { EquippedShopCosmetic } from "@/lib/gaming.functions";
import type { CSSProperties } from "react";

export type ResolvedBubbleStyles = {
  mine: string | null;
  other: string | null;
  boxShadow: string | null;
  borderRadius: string | null;
  textShadow: string | null;
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
  bubbleMineShadow: string | null;
  bubbleOtherShadow: string | null;
  /** Full-screen emoji pattern (e.g. fire) layered above the CSS background */
  emojiOverlay: string | null;
  emojiOpacity: number;
  emojiSizePx: number;
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

type ThemePack = {
  match: RegExp;
  background: string;
  bubbleMine: string;
  bubbleOther: string;
  bubbleMineShadow: string;
  bubbleOtherShadow: string;
  emoji: string;
  emojiSizePx: number;
  emojiOpacity: number;
};

/**
 * Full-theme packs: deep background + glowing bubbles + emoji field
 * covering the message area (not a tiny corner accent).
 */
const THEME_PACKS: ThemePack[] = [
  {
    match: /inferno|fire\s*x|firex|flame|volcan|magma|lava|ember/,
    background:
      "radial-gradient(ellipse at 50% 0%, rgba(255,120,0,0.55) 0%, transparent 55%), radial-gradient(ellipse at 20% 100%, rgba(255,40,0,0.4) 0%, transparent 50%), radial-gradient(ellipse at 90% 70%, rgba(180,0,0,0.35) 0%, transparent 45%), linear-gradient(180deg, #2a0800 0%, #120200 45%, #050100 100%)",
    bubbleMine:
      "linear-gradient(145deg, #ffb347 0%, #ff6a00 35%, #e63900 70%, #9b0000 100%)",
    bubbleOther:
      "linear-gradient(145deg, #4a1c12 0%, #2a0c08 55%, #1a0604 100%)",
    bubbleMineShadow:
      "0 0 18px rgba(255,100,0,0.65), 0 4px 14px rgba(255,60,0,0.45)",
    bubbleOtherShadow: "0 2px 10px rgba(0,0,0,0.45)",
    emoji: "🔥",
    emojiSizePx: 42,
    emojiOpacity: 0.22,
  },
  {
    match: /neon|cyber|electric/,
    background:
      "radial-gradient(circle at 15% 10%, rgba(0,255,200,0.28), transparent 45%), radial-gradient(circle at 85% 90%, rgba(180,0,255,0.25), transparent 40%), linear-gradient(180deg, #050510 0%, #0a0a18 100%)",
    bubbleMine:
      "linear-gradient(135deg, #00f5d4 0%, #7b2ff7 100%)",
    bubbleOther:
      "linear-gradient(135deg, #1a1a2e 0%, #12121f 100%)",
    bubbleMineShadow:
      "0 0 16px rgba(0,245,212,0.55), 0 0 28px rgba(123,47,247,0.35)",
    bubbleOtherShadow: "0 2px 10px rgba(0,0,0,0.4)",
    emoji: "⚡",
    emojiSizePx: 36,
    emojiOpacity: 0.18,
  },
  {
    match: /ocean|aqua|sea|wave/,
    background:
      "radial-gradient(circle at 30% 0%, rgba(0,180,255,0.32), transparent 50%), radial-gradient(circle at 80% 100%, rgba(0,100,200,0.25), transparent 45%), linear-gradient(180deg, #021018 0%, #031a24 100%)",
    bubbleMine:
      "linear-gradient(135deg, #5eead4 0%, #00b4d8 50%, #0077b6 100%)",
    bubbleOther:
      "linear-gradient(135deg, #0b2530 0%, #071820 100%)",
    bubbleMineShadow: "0 0 14px rgba(0,180,216,0.5)",
    bubbleOtherShadow: "0 2px 10px rgba(0,0,0,0.4)",
    emoji: "🌊",
    emojiSizePx: 38,
    emojiOpacity: 0.16,
  },
  {
    match: /purple|violet|galaxy/,
    background:
      "radial-gradient(circle at 70% 20%, rgba(160,80,255,0.35), transparent 50%), radial-gradient(circle at 20% 90%, rgba(100,40,200,0.25), transparent 45%), linear-gradient(180deg, #12081f 0%, #0a0412 100%)",
    bubbleMine:
      "linear-gradient(135deg, #e9d5ff 0%, #c084fc 40%, #7c3aed 100%)",
    bubbleOther:
      "linear-gradient(135deg, #221433 0%, #140a1f 100%)",
    bubbleMineShadow: "0 0 16px rgba(192,132,252,0.55)",
    bubbleOtherShadow: "0 2px 10px rgba(0,0,0,0.4)",
    emoji: "✨",
    emojiSizePx: 34,
    emojiOpacity: 0.18,
  },
  {
    match: /emerald|forest|green/,
    background:
      "radial-gradient(circle at 20% 80%, rgba(16,185,129,0.3), transparent 45%), linear-gradient(180deg, #03140d 0%, #020a06 100%)",
    bubbleMine:
      "linear-gradient(135deg, #6ee7b7 0%, #34d399 40%, #059669 100%)",
    bubbleOther:
      "linear-gradient(135deg, #0b2b1c 0%, #061810 100%)",
    bubbleMineShadow: "0 0 14px rgba(52,211,153,0.5)",
    bubbleOtherShadow: "0 2px 10px rgba(0,0,0,0.4)",
    emoji: "🌿",
    emojiSizePx: 36,
    emojiOpacity: 0.15,
  },
  {
    match: /rose|pink|sakura|cherry/,
    background:
      "radial-gradient(circle at 40% 0%, rgba(244,114,182,0.32), transparent 50%), linear-gradient(180deg, #1a0b14 0%, #0f060c 100%)",
    bubbleMine:
      "linear-gradient(135deg, #fecdd3 0%, #fb7185 45%, #e11d48 100%)",
    bubbleOther:
      "linear-gradient(135deg, #35121c 0%, #1f0a10 100%)",
    bubbleMineShadow: "0 0 14px rgba(251,113,133,0.5)",
    bubbleOtherShadow: "0 2px 10px rgba(0,0,0,0.4)",
    emoji: "🌸",
    emojiSizePx: 36,
    emojiOpacity: 0.16,
  },
  {
    match: /gold|amber|sunset/,
    background:
      "radial-gradient(circle at 50% 0%, rgba(251,191,36,0.3), transparent 50%), linear-gradient(180deg, #1c0b03 0%, #0f0602 100%)",
    bubbleMine:
      "linear-gradient(135deg, #fde68a 0%, #fbbf24 40%, #f59e0b 70%, #d97706 100%)",
    bubbleOther:
      "linear-gradient(135deg, #3a1708 0%, #1f0c04 100%)",
    bubbleMineShadow: "0 0 16px rgba(251,191,36,0.55)",
    bubbleOtherShadow: "0 2px 10px rgba(0,0,0,0.4)",
    emoji: "☀️",
    emojiSizePx: 36,
    emojiOpacity: 0.14,
  },
  {
    match: /midnight|dark|amoled|night/,
    background:
      "linear-gradient(180deg, #000000 0%, #0a0a0a 100%)",
    bubbleMine:
      "linear-gradient(135deg, #52525b 0%, #3f3f46 40%, #18181b 100%)",
    bubbleOther:
      "linear-gradient(135deg, #18181b 0%, #09090b 100%)",
    bubbleMineShadow: "0 0 10px rgba(255,255,255,0.12)",
    bubbleOtherShadow: "0 2px 8px rgba(0,0,0,0.5)",
    emoji: "🌑",
    emojiSizePx: 32,
    emojiOpacity: 0.1,
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
    mine: "linear-gradient(145deg, #ffb347 0%, #ff6a00 40%, #e63900 100%)",
    other: "linear-gradient(145deg, #4a1c12 0%, #2a0c08 100%)",
    boxShadow: "0 0 16px rgba(255,80,0,0.55)",
  },
  {
    match: /glass|frost/,
    mine: "linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.1) 100%)",
    other: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
  },
  {
    match: /neon/,
    mine: "linear-gradient(135deg, #00f5d4 0%, #7b2ff7 100%)",
    other: "linear-gradient(135deg, #1a1a2e 0%, #12121f 100%)",
    boxShadow: "0 0 14px rgba(0,245,212,0.5)",
  },
  {
    match: /blue/,
    mine: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #1d4ed8 100%)",
    other: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
  },
];

function themePack(
  cosmetic: EquippedShopCosmetic,
): ThemePack | null {
  const label = labelOf(cosmetic);
  for (const p of THEME_PACKS) {
    if (p.match.test(label)) return p;
  }
  if (cosmetic.cosmetic_type === "theme") {
    return {
      match: /.*/,
      background:
        "radial-gradient(circle at 30% 0%, rgba(124,92,255,0.28), transparent 55%), linear-gradient(180deg, #0a0e14 0%, #0d1420 100%)",
      bubbleMine:
        "linear-gradient(135deg, #a78bfa 0%, #7c5cff 50%, #00d9ff 100%)",
      bubbleOther:
        "linear-gradient(135deg, #1a2233 0%, #0f141f 100%)",
      bubbleMineShadow: "0 0 14px rgba(124,92,255,0.45)",
      bubbleOtherShadow: "0 2px 10px rgba(0,0,0,0.4)",
      emoji: "💫",
      emojiSizePx: 34,
      emojiOpacity: 0.14,
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
        textShadow: null,
      };
    }
  }
  if (cosmetic.cosmetic_type === "bubble") {
    return {
      mine: "linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)",
      other: "linear-gradient(135deg, #27272a 0%, #18181b 100%)",
      boxShadow: "0 0 10px rgba(34,197,94,0.35)",
      borderRadius: "18px",
      textShadow: null,
    };
  }
  return null;
}

export function resolveThemeStyles(
  cosmetic: EquippedShopCosmetic | null,
): ResolvedThemeStyles {
  if (!cosmetic) {
    return {
      background: null,
      bubbleMine: null,
      bubbleOther: null,
      bubbleMineShadow: null,
      bubbleOtherShadow: null,
      emojiOverlay: null,
      emojiOpacity: 0,
      emojiSizePx: 32,
    };
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
    pick(asRecord(meta?['colors']), "background", "messageAreaBackground", "bg");

  const bubbleMine =
    pickDeep(meta, [
      "bubbleMine",
      "bubble_mine",
      "mine",
      "bubbleCss",
      "bubble_css",
    ]) ||
    pick(asRecord(meta?['colors']), "bubbleMine", "bubble_mine", "mine") ||
    pick(asRecord(meta?['css']), "mine", "bubbleMine", "background");

  const bubbleOther =
    pickDeep(meta, ["bubbleOther", "bubble_other", "other"]) ||
    pick(asRecord(meta?['colors']), "bubbleOther", "other") ||
    pick(asRecord(meta?['css']), "other", "bubbleOther");

  const emojiFromMeta =
    pickDeep(meta, ["emoji", "overlayEmoji", "patternEmoji"]) ||
    pick(meta, "emoji");

  const pack = themePack(cosmetic);

  // Always prefer a full pack for atmosphere when this is a theme,
  // merging explicit metadata colors on top when present.
  if (pack) {
    return {
      background: background || pack.background,
      bubbleMine: bubbleMine || pack.bubbleMine,
      bubbleOther: bubbleOther || pack.bubbleOther,
      bubbleMineShadow: pack.bubbleMineShadow,
      bubbleOtherShadow: pack.bubbleOtherShadow,
      emojiOverlay: emojiFromMeta || pack.emoji,
      emojiOpacity: pack.emojiOpacity,
      emojiSizePx: pack.emojiSizePx,
    };
  }

  return {
    background: background,
    bubbleMine: bubbleMine,
    bubbleOther: bubbleOther,
    bubbleMineShadow: null,
    bubbleOtherShadow: null,
    emojiOverlay: emojiFromMeta,
    emojiOpacity: emojiFromMeta ? 0.16 : 0,
    emojiSizePx: 34,
  };
}

export function resolveBubbleStyles(
  cosmetic: EquippedShopCosmetic | null,
): ResolvedBubbleStyles {
  if (!cosmetic) {
    return {
      mine: null,
      other: null,
      boxShadow: null,
      borderRadius: null,
      textShadow: null,
    };
  }

  const meta = asRecord(cosmetic.metadata);
  const css = asRecord(meta?['css']) ?? meta;

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
      textShadow: null,
    };
  }

  return (
    bubblePreset(cosmetic) ?? {
      mine: null,
      other: null,
      boxShadow: null,
      borderRadius: null,
      textShadow: null,
    }
  );
}

export function resolveWallpaperStyles(
  cosmetic: EquippedShopCosmetic | null,
): ResolvedWallpaperStyles {
  if (!cosmetic) return { kind: null, url: null, css: null };

  const meta = asRecord(cosmetic.metadata);
  const media = asRecord(meta?['media']);

  const url =
    pick(media, "url", "image_url", "src", "wallpaper_url") ||
    pick(meta, "url", "image_url", "wallpaper_url", "preview_url");

  const css =
    pick(meta, "css", "background", "bg") ||
    pick(asRecord(meta?['colors']), "background", "css") ||
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
): CSSProperties | undefined {
  if (!cosmetic) return undefined;

  const meta = asRecord(cosmetic.metadata);
  const style = asRecord(meta?['style']) ?? meta;

  const ring =
    pick(style, "ring", "border", "outline", "color") ||
    pickDeep(meta, ["ring", "border", "outline", "color"]);
  const shadow =
    pick(style, "shadow", "boxShadow") ||
    pickDeep(meta, ["shadow", "boxShadow"]);

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

  const out: CSSProperties = {};
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

/**
 * CSS for a repeating emoji field that covers the whole message area.
 * Used so Inferno-style themes feel full-screen, not a thin color strip.
 */
export function emojiOverlayStyle(
  emoji: string | null | undefined,
  sizePx: number,
  opacity: number,
): CSSProperties | undefined {
  if (!emoji || opacity <= 0) return undefined;

  const size = Math.max(24, Math.min(sizePx, 72));
  // SVG data-URL pattern — tiles across the full layer
  const encoded = encodeURIComponent(emoji);
  // Use a simple repeating character grid via background on a pseudo layer
  // Implemented as large letter-spacing text isn't reliable; use radial dots of emoji
  // via CSS repeating linear gradients is hard for emoji — instead chat paints
  // a dedicated overlay div with many emoji spans. This helper returns base opacity.
  return {
    opacity,
    fontSize: `${size}px`,
    lineHeight: 1.6,
    letterSpacing: "0.35em",
    userSelect: "none",
    pointerEvents: "none",
  };
}
