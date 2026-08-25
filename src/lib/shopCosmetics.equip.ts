import {
  getEquippedShopCosmeticsLocal,
  getEquippedShopCosmeticLocal,
  saveEquippedShopCosmeticLocal,
  removeEquippedShopCosmeticLocal,
  clearAllShopCosmeticsLocal,
} from "@/lib/shopCosmetics.local";

/**
 * Cosmetic types supported by the Shop.
 *
 * These are deliberately kept as strings so the system can also
 * support additional cosmetic types later without changing the
 * storage architecture.
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

/**
 * A Shop cosmetic that has already been purchased/owned.
 *
 * The Shop/Supabase side remains responsible for ownership.
 * This object represents the cosmetic that is being equipped locally.
 */
export interface OwnedShopCosmetic {
  id: string;
  name: string;
  cosmetic_type: ShopCosmeticType;

  /**
   * Optional description shown by the UI.
   */
  description?: string | null;

  /**
   * Optional preview URL.
   *
   * Image-based cosmetics can use this.
   * Code/CSS cosmetics can leave it empty.
   */
  image_url?: string | null;

  /**
   * Optional metadata supplied by shop_items.metadata.
   *
   * This is intentionally flexible because themes, bubbles,
   * fonts, badges, etc. can have different properties.
   */
  metadata?: Record<string, unknown> | null;

  /**
   * Optional price information.
   *
   * This is not used when equipping, but keeping it available
   * makes the object compatible with Shop/inventory data.
   */
  price?: number | null;

  /**
   * Optional purchase timestamp.
   */
  purchased_at?: string | null;

  /**
   * Optional inventory ID if the Supabase inventory row exposes one.
   */
  inventory_id?: string | null;
}

/**
 * Result returned by equip operations.
 */
export interface EquipShopCosmeticResult {
  success: boolean;
  cosmetic: OwnedShopCosmetic | null;
  error?: string;
}

/**
 * Convert an owned Shop item into the compact local representation.
 *
 * We intentionally store only what the device needs to render the
 * currently equipped cosmetic.
 */
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

/**
 * Check whether a cosmetic has enough information to be equipped.
 */
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

/**
 * Equip an owned Shop cosmetic.
 *
 * IMPORTANT:
 * This function does NOT purchase anything.
 * It does NOT subtract X Coins.
 * It does NOT modify the wallet.
 * It does NOT modify game rewards.
 *
 * Ownership remains a Supabase concern.
 *
 * This function only stores the cosmetic that the user has chosen
 * to USE on the device.
 */
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

/**
 * Unequip a cosmetic of a specific type.
 */
export function unequipShopCosmetic(
  cosmeticType: ShopCosmeticType,
): boolean {
  try {
    if (!cosmeticType) {
      return false;
    }

    removeEquippedShopCosmeticLocal(String(cosmeticType));

    return true;
  } catch (error) {
    console.error(
      "[Shop Cosmetics] Failed to unequip cosmetic:",
      error,
    );

    return false;
  }
}

/**
 * Get every currently equipped Shop cosmetic.
 */
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

/**
 * Get the equipped cosmetic for one cosmetic type.
 */
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

/**
 * Check whether a particular Shop cosmetic is currently equipped.
 */
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
    equipped && String(equipped.id) === String(cosmetic.id),
  );
}

/**
 * Remove every equipped Shop cosmetic from local device storage.
 *
 * This is useful for a "Reset Shop Cosmetics" action later.
 */
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

/**
 * Equip a cosmetic and return the currently equipped cosmetic
 * for that type.
 */
export function equipAndGetShopCosmetic(
  cosmetic: OwnedShopCosmetic,
): OwnedShopCosmetic | null {
  const result = equipShopCosmetic(cosmetic);

  if (!result.success) {
    return null;
  }

  return getEquippedShopCosmetic(cosmetic.cosmetic_type);
}

/**
 * Toggle a cosmetic.
 *
 * If it is already equipped, it becomes unequipped.
 * Otherwise it becomes equipped.
 */
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

/**
 * Listen for cosmetic changes.
 *
 * shopCosmetics.local.ts already dispatches:
 *
 * xup-shop-cosmetic-changed
 *
 * whenever an equipped cosmetic changes.
 *
 * This helper gives the future React components a clean API.
 */
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

/**
 * Get a cosmetic metadata value safely.
 */
export function getShopCosmeticMetadataValue<T>(
  cosmetic: OwnedShopCosmetic | null | undefined,
  key: string,
  fallback: T,
): T {
  if (!cosmetic?.metadata) {
    return fallback;
  }

  const value = cosmetic.metadata[key];

  if (value === undefined || value === null) {
    return fallback;
  }

  return value as T;
}

/**
 * Get a CSS value from Shop cosmetic metadata.
 *
 * Useful for code-based cosmetics that do not need images.
 *
 * Example metadata:
 *
 * {
 *   bubble_background: "linear-gradient(...)",
 *   bubble_color: "#ffffff"
 * }
 */
export function getShopCosmeticCssValue(
  cosmetic: OwnedShopCosmetic | null | undefined,
  key: string,
  fallback = "",
): string {
  const value = getShopCosmeticMetadataValue<unknown>(
    cosmetic,
    key,
    fallback,
  );

  return typeof value === "string"
    ? value
    : fallback;
}

/**
 * Get a boolean metadata option safely.
 */
export function getShopCosmeticBoolean(
  cosmetic: OwnedShopCosmetic | null | undefined,
  key: string,
  fallback = false,
): boolean {
  const value = getShopCosmeticMetadataValue<unknown>(
    cosmetic,
    key,
    fallback,
  );

  return typeof value === "boolean"
    ? value
    : fallback;
}

/**
 * Get a numeric metadata option safely.
 */
export function getShopCosmeticNumber(
  cosmetic: OwnedShopCosmetic | null | undefined,
  key: string,
  fallback = 0,
): number {
  const value = getShopCosmeticMetadataValue<unknown>(
    cosmetic,
    key,
    fallback,
  );

  return typeof value === "number"
    ? value
    : fallback;
}