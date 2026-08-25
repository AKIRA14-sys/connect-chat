import type { EquippedShopCosmetic } from "@/lib/gaming.functions";

const STORAGE_KEY = "xup-shop-equipped-cosmetics";

export type LocalShopCosmetics = {
  theme: EquippedShopCosmetic | null;
  wallpaper: EquippedShopCosmetic | null;
  bubble: EquippedShopCosmetic | null;
  sticker_pack: EquippedShopCosmetic | null;
  profile_frame: EquippedShopCosmetic | null;
  badge: EquippedShopCosmetic | null;
};

const EMPTY_STATE: LocalShopCosmetics = {
  theme: null,
  wallpaper: null,
  bubble: null,
  sticker_pack: null,
  profile_frame: null,
  badge: null,
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readState(): LocalShopCosmetics {
  if (!isBrowser()) {
    return { ...EMPTY_STATE };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return { ...EMPTY_STATE };
    }

    const parsed = JSON.parse(raw);

    return {
      ...EMPTY_STATE,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };
  } catch (error) {
    console.warn(
      "Unable to read Shop cosmetic state:",
      error,
    );

    return { ...EMPTY_STATE };
  }
}

function writeState(
  state: LocalShopCosmetics,
): void {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch (error) {
    console.warn(
      "Unable to save Shop cosmetic state:",
      error,
    );
  }
}

export function getEquippedShopCosmeticsLocal(): LocalShopCosmetics {
  return readState();
}

export function getEquippedShopCosmeticLocal(
  type: keyof LocalShopCosmetics,
): EquippedShopCosmetic | null {
  return readState()[type];
}

export function saveEquippedShopCosmeticLocal(
  cosmetic: EquippedShopCosmetic,
): LocalShopCosmetics {
  const state = readState();

  state[cosmetic.cosmetic_type] = cosmetic;

  writeState(state);

  if (isBrowser()) {
    window.dispatchEvent(
      new CustomEvent(
        "xup-shop-cosmetic-changed",
        {
          detail: cosmetic,
        },
      ),
    );
  }

  return state;
}

export function removeEquippedShopCosmeticLocal(
  type: keyof LocalShopCosmetics,
): LocalShopCosmetics {
  const state = readState();

  state[type] = null;

  writeState(state);

  if (isBrowser()) {
    window.dispatchEvent(
      new CustomEvent(
        "xup-shop-cosmetic-changed",
        {
          detail: {
            type,
            removed: true,
          },
        },
      ),
    );
  }

  return state;
}

export function clearAllShopCosmeticsLocal(): void {
  writeState({ ...EMPTY_STATE });

  if (isBrowser()) {
    window.dispatchEvent(
      new CustomEvent(
        "xup-shop-cosmetic-changed",
        {
          detail: {
            cleared: true,
          },
        },
      ),
    );
  }
}