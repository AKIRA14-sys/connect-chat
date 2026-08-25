import type {
  EquippedShopCosmetic,
} from "./gaming.functions";

const STORAGE_KEY =
  "xup-shop-equipped-cosmetics";

type LocalShopCosmeticState = {
  theme: EquippedShopCosmetic | null;
  wallpaper: EquippedShopCosmetic | null;
  bubble: EquippedShopCosmetic | null;
  sticker_pack: EquippedShopCosmetic | null;
  profile_frame: EquippedShopCosmetic | null;
  badge: EquippedShopCosmetic | null;
};

const EMPTY_STATE: LocalShopCosmeticState = {
  theme: null,
  wallpaper: null,
  bubble: null,
  sticker_pack: null,
  profile_frame: null,
  badge: null,
};

function isBrowser() {
  return (
    typeof window !== "undefined"
  );
}

function readState(): LocalShopCosmeticState {
  if (!isBrowser()) {
    return {
      ...EMPTY_STATE,
    };
  }

  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY,
      );

    if (!raw) {
      return {
        ...EMPTY_STATE,
      };
    }

    const parsed =
      JSON.parse(raw);

    return {
      ...EMPTY_STATE,
      ...(parsed ?? {}),
    };
  } catch {
    return {
      ...EMPTY_STATE,
    };
  }
}

function writeState(
  state: LocalShopCosmeticState,
) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state),
  );
}

export function getLocalShopCosmetics() {
  return readState();
}

export function setLocalShopCosmetic(
  cosmetic: EquippedShopCosmetic,
) {
  const state =
    readState();

  state[
    cosmetic.cosmetic_type
  ] = cosmetic;

  writeState(state);

  window.dispatchEvent(
    new CustomEvent(
      "xup-shop-cosmetic-changed",
      {
        detail: cosmetic,
      },
    ),
  );

  return state;
}

export function removeLocalShopCosmetic(
  type: EquippedShopCosmetic["cosmetic_type"],
) {
  const state =
    readState();

  state[type] = null;

  writeState(state);

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

  return state;
}

export function getLocalShopCosmetic(
  type: EquippedShopCosmetic["cosmetic_type"],
) {
  return readState()[type];
}

export function getShopCosmeticMetadata(
  type: EquippedShopCosmetic["cosmetic_type"],
) {
  return (
    readState()[type]
      ?.metadata ?? null
  );
}