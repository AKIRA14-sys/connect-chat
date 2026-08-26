import {
  getEquippedShopCosmeticsLocal,
  getEquippedShopCosmeticLocal,
  saveEquippedShopCosmeticLocal,
  removeEquippedShopCosmeticLocal,
  clearAllShopCosmeticsLocal,
} from "@/lib/shopCosmetics.local";

/**
 * Cosmetic types supported by the Shop.
 */
export type ShopCosmeticType =
  | "theme"
  | "wallpaper"
  | "bubble"
  | "font"
  | "sticker_pack"
  | "profile_frame"
  | "badge"
  | "profile_cosmetic"
  | "chat_cosmetic"
  | string;

export interface OwnedShopCosmetic {
  id: string;
  name: string;
  cosmetic_type: ShopCosmeticType;
  description?: string | null;
  image_url?: string | null;
  metadata?: Record<string, unknown> | null;
  price?: number | null;
  purchased_at?: string | null;
  inventory_id?: string | null;
}

export interface EquipShopCosmeticResult {
  success: boolean;
  cosmetic: OwnedShopCosmetic | null;
  error?: string;
}

function normalizeCosmetic(
  cosmetic: OwnedShopCosmetic,
): OwnedShopCosmetic {
  return {
    id: String(cosmetic.id),
    name: String(cosmetic.name),
    cosmetic_type: String(cosmetic.cosmetic_type),

    description:
      cosmetic.description === undefined
        ? null
        : cosmetic.description,

    image_url:
      cosmetic.image_url === undefined
        ? null
        : cosmetic.image_url,

    metadata:
      cosmetic.metadata === undefined
        ? null
        : cosmetic.metadata,

    price:
      cosmetic.price === undefined
        ? null
        : cosmetic.price,

    purchased_at:
      cosmetic.purchased_at === undefined
        ? null
        : cosmetic.purchased_at,

    inventory_id:
      cosmetic.inventory_id === undefined
        ? null
        : cosmetic.inventory_id,
  };
}

export function canEquipShopCosmetic(
  cosmetic: OwnedShopCosmetic | null | undefined,
): boolean {
  if (!cosmetic) {
    return false;
  }

  if (!cosmetic.id) {
    return false;
  }

  if (!cosmetic.name) {
    return false;
  }

  if (!cosmetic.cosmetic_type) {
    return false;
  }

  return true;
}

export function equipShopCosmetic(
  cosmetic: OwnedShopCosmetic,
): EquipShopCosmeticResult {
  try {
    if (!canEquipShopCosmetic(cosmetic)) {
      return {
        success: false,
        cosmetic: null,
        error: "Invalid Shop cosmetic.",
      };
    }

    const normalized = normalizeCosmetic(cosmetic);

    saveEquippedShopCosmeticLocal(normalized);

    return {
      success: true,
      cosmetic: normalized,
    };
  } catch (error) {
    console.error(
      "[Shop Cosmetics] Failed to equip cosmetic:",
      error,
    );

    return {
      success: false,
      cosmetic: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to equip Shop cosmetic.",
    };
  }
}

export function unequipShopCosmetic(
  cosmeticType: ShopCosmeticType,
): boolean {
  try {
    if (!cosmeticType) {
      return false;
    }

    removeEquippedShopCosmeticLocal(
      String(cosmeticType),
    );

    return true;
  } catch (error) {
    console.error(
      "[Shop Cosmetics] Failed to unequip cosmetic:",
      error,
    );

    return false;
  }
}

export function getEquippedShopCosmetics(): Record<
  string,
  OwnedShopCosmetic
> {
  try {
    return getEquippedShopCosmeticsLocal() as Record<
      string,
      OwnedShopCosmetic
    >;
  } catch (error) {
    console.error(
      "[Shop Cosmetics] Failed to load equipped cosmetics:",
      error,
    );

    return {};
  }
}

export function getEquippedShopCosmetic(
  cosmeticType: ShopCosmeticType,
): OwnedShopCosmetic | null {
  try {
    if (!cosmeticType) {
      return null;
    }

    return (
      (getEquippedShopCosmeticLocal(
        String(cosmeticType),
      ) as OwnedShopCosmetic | null) ?? null
    );
  } catch (error) {
    console.error(
      "[Shop Cosmetics] Failed to load equipped cosmetic:",
      error,
    );

    return null;
  }
}

export function isShopCosmeticEquipped(
  cosmetic: OwnedShopCosmetic,
): boolean {
  if (!canEquipShopCosmetic(cosmetic)) {
    return false;
  }

  const equipped = getEquippedShopCosmetic(
    cosmetic.cosmetic_type,
  );

  return Boolean(
    equipped &&
      String(equipped.id) === String(cosmetic.id),
  );
}

export function clearEquippedShopCosmetics(): boolean {
  try {
    clearAllShopCosmeticsLocal();

    return true;
  } catch (error) {
    console.error(
      "[Shop Cosmetics] Failed to clear cosmetics:",
      error,
    );

    return false;
  }
}

export function equipAndGetShopCosmetic(
  cosmetic: OwnedShopCosmetic,
): OwnedShopCosmetic | null {
  const result = equipShopCosmetic(cosmetic);

  if (!result.success) {
    return null;
  }

  return getEquippedShopCosmetic(
    cosmetic.cosmetic_type,
  );
}

export function toggleShopCosmetic(
  cosmetic: OwnedShopCosmetic,
): EquipShopCosmeticResult {
  if (!canEquipShopCosmetic(cosmetic)) {
    return {
      success: false,
      cosmetic: null,
      error: "Invalid Shop cosmetic.",
    };
  }

  if (isShopCosmeticEquipped(cosmetic)) {
    const removed = unequipShopCosmetic(
      cosmetic.cosmetic_type,
    );

    return {
      success: removed,
      cosmetic: removed ? null : cosmetic,
      error: removed
        ? undefined
        : "Failed to unequip Shop cosmetic.",
    };
  }

  return equipShopCosmetic(cosmetic);
}

export function subscribeToShopCosmeticChanges(
  callback: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => {
    callback();
  };

  window.addEventListener(
    "xup-shop-cosmetic-changed",
    handler,
  );

  return () => {
    window.removeEventListener(
      "xup-shop-cosmetic-changed",
      handler,
    );
  };
}

export function getShopCosmeticMetadataValue<T>(
  cosmetic:
    | OwnedShopCosmetic
    | null
    | undefined,
  key: string,
  fallback: T,
): T {
  if (!cosmetic?.metadata) {
    return fallback;
  }

  const value = cosmetic.metadata[key];

  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  return value as T;
}

export function getShopCosmeticCssValue(
  cosmetic:
    | OwnedShopCosmetic
    | null
    | undefined,
  key: string,
  fallback = "",
): string {
  const value =
    getShopCosmeticMetadataValue<unknown>(
      cosmetic,
      key,
      fallback,
    );

  return typeof value === "string"
    ? value
    : fallback;
}

export function getShopCosmeticBoolean(
  cosmetic:
    | OwnedShopCosmetic
    | null
    | undefined,
  key: string,
  fallback = false,
): boolean {
  const value =
    getShopCosmeticMetadataValue<unknown>(
      cosmetic,
      key,
      fallback,
    );

  return typeof value === "boolean"
    ? value
    : fallback;
}

export function getShopCosmeticNumber(
  cosmetic:
    | OwnedShopCosmetic
    | null
    | undefined,
  key: string,
  fallback = 0,
): number {
  const value =
    getShopCosmeticMetadataValue<unknown>(
      cosmetic,
      key,
      fallback,
    );

  return typeof value === "number"
    ? value
    : fallback;
}