// REPLACE the body of resolveWallpaperStyles in src/lib/shopCosmeticStyles.ts
// with this version (keeps imports/helpers above unchanged).

import { getSelectedVariantId, parseVariants } from "@/lib/shopMedia";

export function resolveWallpaperStyles(
  cosmetic: EquippedShopCosmetic | null,
): ResolvedWallpaperStyles {
  if (!cosmetic) return { kind: null, url: null, css: null };

  const meta = asRecord(cosmetic.metadata);
  const variants = parseVariants(cosmetic.metadata);
  if (variants.length) {
    const sel =
      getSelectedVariantId(cosmetic.item_id) ||
      (typeof meta?.["selected_variant_id"] === "string"
        ? meta["selected_variant_id"]
        : null);
    const chosen =
      variants.find((v) => v.id === sel) || variants[0];
    if (chosen) {
      return {
        kind: chosen.kind,
        url: chosen.url,
        css: null,
      };
    }
  }

  const media = asRecord(meta?.["media"]);
  const url =
    pick(media, "url", "image_url", "src", "wallpaper_url") ||
    pick(meta, "url", "image_url", "wallpaper_url", "preview_url");
  const css =
    pick(meta, "css", "background", "bg") ||
    pick(asRecord(meta?.["colors"]), "background", "css") ||
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

  // fall through to existing wallpaperPreset logic below in your file...
  return { kind: null, url: null, css: null };
}
