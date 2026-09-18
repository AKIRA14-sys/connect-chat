/** Shop media pack helpers — variants (still image + live video). */

export type ShopMediaVariant = {
  id: string;
  kind: "image" | "video";
  url: string;
  label?: string;
};

export type ShopPackMetadata = {
  cosmetic_type: "wallpaper" | "bubble" | "theme" | "badge" | "sticker_pack" | "profile_frame";
  /** Multi-choice pack (anime/cars/etc.) */
  variants?: ShopMediaVariant[];
  /** Currently selected variant (also stored locally after equip) */
  selected_variant_id?: string;
  /** Legacy single media */
  media?: { kind?: string; url?: string; type?: string };
  url?: string;
  image_url?: string;
  wallpaper_url?: string;
  preview_url?: string;
  [key: string]: unknown;
};

const VARIANT_KEY = "xup-shop-selected-variants-v1";

export function loadSelectedVariants(): Record<string, string> {
  try {
    const raw = localStorage.getItem(VARIANT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveSelectedVariant(itemId: string, variantId: string) {
  try {
    const all = loadSelectedVariants();
    all[itemId] = variantId;
    localStorage.setItem(VARIANT_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function getSelectedVariantId(itemId: string): string | null {
  return loadSelectedVariants()[itemId] ?? null;
}

export function parseVariants(metadata: unknown): ShopMediaVariant[] {
  if (!metadata || typeof metadata !== "object") return [];
  const m = metadata as Record<string, unknown>;
  const raw = m.variants;
  if (!Array.isArray(raw)) return [];
  const out: ShopMediaVariant[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const url = typeof r.url === "string" ? r.url.trim() : "";
    if (!url) continue;
    const kind: "image" | "video" =
      r.kind === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(url)
        ? "video"
        : "image";
    out.push({
      id: String(r.id || url),
      kind,
      url,
      label: typeof r.label === "string" ? r.label : undefined,
    });
  }
  return out;
}

export function buildPackMetadata(opts: {
  cosmetic_type: ShopPackMetadata["cosmetic_type"];
  variants: ShopMediaVariant[];
  extra?: Record<string, unknown>;
}): ShopPackMetadata {
  const variants = opts.variants.filter((v) => v.url.trim());
  const preview = variants[0]?.url;
  return {
    cosmetic_type: opts.cosmetic_type,
    variants,
    preview_url: preview,
    media: preview
      ? {
          kind: variants[0]?.kind || "image",
          url: preview,
        }
      : undefined,
    ...(opts.extra || {}),
  };
}
