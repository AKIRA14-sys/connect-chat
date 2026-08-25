import React from "react";

export type ShopCosmeticType =
  | "theme"
  | "wallpaper"
  | "bubble"
  | "font"
  | "sticker_pack"
  | "profile_frame"
  | "badge";

export type ShopCosmeticRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export interface ShopCosmeticEquipItem {
  id: string;
  name: string;
  description?: string;
  cosmetic_type: ShopCosmeticType;
  rarity?: ShopCosmeticRarity;

  image_url?: string;
  preview_image_url?: string;

  css?: string;
  bubble_css?: string;

  metadata?: Record<string, unknown>;
}

interface ShopCosmeticEquipCardProps {
  item: ShopCosmeticEquipItem;

  equipped?: boolean;

  busy?: boolean;

  onEquip: (
    item: ShopCosmeticEquipItem,
  ) => void | Promise<void>;

  onUnequip?: (
    item: ShopCosmeticEquipItem,
  ) => void | Promise<void>;
}

const rarityClasses: Record<
  ShopCosmeticRarity,
  string
> = {
  common:
    "border-slate-500/40 bg-slate-500/10",

  uncommon:
    "border-emerald-500/40 bg-emerald-500/10",

  rare:
    "border-blue-500/40 bg-blue-500/10",

  epic:
    "border-purple-500/40 bg-purple-500/10",

  legendary:
    "border-orange-500/40 bg-orange-500/10",

  mythic:
    "border-pink-500/40 bg-pink-500/10",
};

const rarityTextClasses: Record<
  ShopCosmeticRarity,
  string
> = {
  common: "text-slate-300",

  uncommon: "text-emerald-400",

  rare: "text-blue-400",

  epic: "text-purple-400",

  legendary: "text-orange-400",

  mythic: "text-pink-400",
};

const typeLabels: Record<
  ShopCosmeticType,
  string
> = {
  theme: "Theme",

  wallpaper: "Wallpaper",

  bubble: "Chat Bubble",

  font: "Font",

  sticker_pack: "Sticker Pack",

  profile_frame: "Profile Frame",

  badge: "Gaming Badge",
};

function getPreviewUrl(
  item: ShopCosmeticEquipItem,
): string | null {
  if (
    item.preview_image_url
  ) {
    return item.preview_image_url;
  }

  if (item.image_url) {
    return item.image_url;
  }

  return null;
}

function getRarity(
  item: ShopCosmeticEquipItem,
): ShopCosmeticRarity {
  return item.rarity ?? "common";
}

function isCodeBased(
  item: ShopCosmeticEquipItem,
): boolean {
  return Boolean(
    item.css ||
      item.bubble_css ||
      item.metadata?.codeBased === true ||
      item.metadata?.code_based === true,
  );
}

function getCodePreview(
  item: ShopCosmeticEquipItem,
): React.CSSProperties | undefined {
  if (item.css) {
    return {
      background: item.css,
    };
  }

  if (item.bubble_css) {
    return {
      background: item.bubble_css,
    };
  }

  return undefined;
}

export default function ShopCosmeticEquipCard({
  item,
  equipped = false,
  busy = false,
  onEquip,
  onUnequip,
}: ShopCosmeticEquipCardProps) {
  const rarity = getRarity(item);

  const previewUrl =
    getPreviewUrl(item);

  const codePreview =
    getCodePreview(item);

  const typeLabel =
    typeLabels[item.cosmetic_type];

  const canUnequip =
    Boolean(onUnequip);

  async function handleAction() {
    if (busy) {
      return;
    }

    if (equipped && onUnequip) {
      await onUnequip(item);
      return;
    }

    await onEquip(item);
  }

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-2xl border",
        "bg-background/80 shadow-sm",
        "transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg",
        equipped
          ? "border-emerald-500/70 ring-1 ring-emerald-500/30"
          : "border-border",
      ].join(" ")}
    >
      {/* Preview */}
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={item.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : codePreview ? (
          <div
            className="h-full w-full transition-transform duration-300 group-hover:scale-105"
            style={codePreview}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-background">
            <div className="text-center">
              <div className="mb-2 text-4xl">
                {item.cosmetic_type ===
                "theme"
                  ? "🎨"
                  : item.cosmetic_type ===
                      "wallpaper"
                    ? "🖼️"
                    : item.cosmetic_type ===
                        "bubble"
                      ? "💬"
                      : item.cosmetic_type ===
                          "font"
                        ? "🔤"
                        : item.cosmetic_type ===
                            "sticker_pack"
                          ? "✨"
                          : item.cosmetic_type ===
                              "profile_frame"
                            ? "🖼️"
                            : "🏅"}
              </div>

              <span className="text-xs text-muted-foreground">
                Code-based cosmetic
              </span>
            </div>
          </div>
        )}

        {/* Equipped badge */}
        {equipped && (
          <div className="absolute left-3 top-3 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-md">
            Equipped
          </div>
        )}

        {/* Rarity */}
        <div
          className={[
            "absolute right-3 top-3 rounded-full border px-2.5 py-1",
            "text-[10px] font-semibold uppercase tracking-wide backdrop-blur",
            rarityClasses[rarity],
            rarityTextClasses[rarity],
          ].join(" ")}
        >
          {rarity}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3 p-4">
        <div>
          <div className="mb-1 flex items-start justify-between gap-3">
            <h3 className="font-semibold text-foreground">
              {item.name}
            </h3>
          </div>

          <div className="mb-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {typeLabel}
          </div>

          {item.description && (
            <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
              {item.description}
            </p>
          )}
        </div>

        {/* Code indicator */}
        {isCodeBased(item) && (
          <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            ✨ Built with XUPPIN styling
          </div>
        )}

        {/* Action */}
        <button
          type="button"
          disabled={busy}
          onClick={handleAction}
          className={[
            "w-full rounded-xl px-4 py-2.5",
            "text-sm font-semibold",
            "transition-all duration-150",
            "focus:outline-none focus:ring-2",
            busy
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : equipped
                ? "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500/40"
                : "bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-500/40",
          ].join(" ")}
        >
          {busy
            ? "Saving..."
            : equipped
              ? canUnequip
                ? "Unequip"
                : "Equipped"
              : "Equip"}
        </button>
      </div>
    </article>
  );
}