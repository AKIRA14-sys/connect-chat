/* ================================================================
 * CHAT CUSTOMIZATION (themes + wallpapers)
 *
 * Per-chat, local-only, stored in IndexedDB under its own database
 * so it never touches any other app data. Falls back safely (no
 * throws) if IndexedDB is unavailable (private browsing, quota, etc).
 * ================================================================ */

export type ThemeId =
  | "default"
  | "midnight"
  | "cyberpunk"
  | "sunset"
  | "ocean"
  | "forest"
  | "roseGold"
  | "aurora";

export type WallpaperKind = "none" | "builtin" | "custom-image" | "custom-video";

export type ChatCustomization = {
  themeId: ThemeId;
  fontId: string | null; // null = app default font
  wallpaper: {
    kind: WallpaperKind;
    builtinId?: string; // used when kind === "builtin"
  };
};

export const DEFAULT_CUSTOMIZATION: ChatCustomization = {
  themeId: "default",
  fontId: null,
  wallpaper: { kind: "none" },
};

export type Theme = {
  id: ThemeId;
  name: string;
  swatch: string; // for the picker chip
  messageAreaBackground: string; // css `background` value
  bubbleMine: string; // css `background` value for "mine" bubbles
};

export const THEMES: Theme[] = [
  {
    id: "default",
    name: "Default",
    swatch: "#0a0e14",
    messageAreaBackground: "",
    bubbleMine: "",
  },
  {
    id: "midnight",
    name: "Midnight",
    swatch: "#0a0e14",
    messageAreaBackground:
      "radial-gradient(circle at 20% 0%, rgba(0,217,255,0.08), transparent 55%), linear-gradient(180deg, #0a0e14 0%, #0d1420 100%)",
    bubbleMine: "linear-gradient(135deg, #00d9ff 0%, #7c5cff 100%)",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    swatch: "#7c5cff",
    messageAreaBackground:
      "radial-gradient(circle at 80% 100%, rgba(124,92,255,0.18), transparent 50%), radial-gradient(circle at 10% 10%, rgba(0,217,255,0.14), transparent 45%), #0a0e14",
    bubbleMine: "linear-gradient(135deg, #7c5cff 0%, #ff2fd0 100%)",
  },
  {
    id: "sunset",
    name: "Sunset",
    swatch: "#ff7a45",
    messageAreaBackground: "linear-gradient(180deg, #2a1220 0%, #3d1a14 100%)",
    bubbleMine: "linear-gradient(135deg, #ff7a45 0%, #ff2f6c 100%)",
  },
  {
    id: "ocean",
    name: "Ocean",
    swatch: "#00b4d8",
    messageAreaBackground: "linear-gradient(180deg, #031421 0%, #06263d 100%)",
    bubbleMine: "linear-gradient(135deg, #0077b6 0%, #00b4d8 100%)",
  },
  {
    id: "forest",
    name: "Forest",
    swatch: "#2ecc71",
    messageAreaBackground: "linear-gradient(180deg, #0c1b14 0%, #12291d 100%)",
    bubbleMine: "linear-gradient(135deg, #1f7a4d 0%, #2ecc71 100%)",
  },
  {
    id: "roseGold",
    name: "Rose Gold",
    swatch: "#f6c1c9",
    messageAreaBackground: "linear-gradient(180deg, #241418 0%, #331b22 100%)",
    bubbleMine: "linear-gradient(135deg, #e8a0b4 0%, #f6c1c9 100%)",
  },
  {
    id: "aurora",
    name: "Aurora",
    swatch: "#5cffb0",
    messageAreaBackground:
      "radial-gradient(circle at 30% 0%, rgba(92,255,176,0.14), transparent 50%), radial-gradient(circle at 80% 100%, rgba(0,217,255,0.14), transparent 50%), #0a0e14",
    bubbleMine: "linear-gradient(135deg, #5cffb0 0%, #00d9ff 100%)",
  },
];

export function getTheme(themeId: ThemeId | null | undefined): Theme {
  return THEMES.find((theme) => theme.id === themeId) ?? THEMES[0];
}

export type BuiltinWallpaper = {
  id: string;
  name: string;
  swatch: string;
  css: string; // css `background` value
};

export const BUILTIN_WALLPAPERS: BuiltinWallpaper[] = [
  { id: "none", name: "None", swatch: "transparent", css: "" },
  {
    id: "dots-cyan",
    name: "Cyan Dots",
    swatch: "#0a0e14",
    css: "radial-gradient(rgba(0,217,255,0.25) 1px, transparent 1px) 0 0/18px 18px, #0a0e14",
  },
  {
    id: "grid-violet",
    name: "Violet Grid",
    swatch: "#0d0a14",
    css:
      "linear-gradient(rgba(124,92,255,0.14) 1px, transparent 1px) 0 0/24px 24px, linear-gradient(90deg, rgba(124,92,255,0.14) 1px, transparent 1px) 0 0/24px 24px, #0d0a14",
  },
  {
    id: "glow-navy",
    name: "Navy Glow",
    swatch: "#0a0e14",
    css: "radial-gradient(circle at 50% 0%, rgba(0,217,255,0.15), transparent 60%), #0a0e14",
  },
  {
    id: "sunset-fade",
    name: "Sunset Fade",
    swatch: "#3d1a14",
    css: "linear-gradient(180deg, #2a1220 0%, #3d1a14 100%)",
  },
  {
    id: "deep-forest",
    name: "Deep Forest",
    swatch: "#12291d",
    css: "linear-gradient(180deg, #0c1b14 0%, #12291d 100%)",
  },
  {
    id: "paper",
    name: "Paper",
    swatch: "#e9e3d8",
    css: "#e9e3d8",
  },
];

export function getBuiltinWallpaper(id: string | undefined): BuiltinWallpaper | null {
  if (!id) return null;
  return BUILTIN_WALLPAPERS.find((wallpaper) => wallpaper.id === id) ?? null;
}

/* ================================================================
 * INDEXEDDB LAYER
 * ================================================================ */

const DB_NAME = "whatsxup-chat-customization";
const DB_VERSION = 1;
const SETTINGS_STORE = "settings";
const MEDIA_STORE = "wallpaperMedia";
const MAX_WALLPAPER_BYTES = 20 * 1024 * 1024; // 20MB, keeps mobile safe

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: "chatId" });
        }

        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          db.createObjectStore(MEDIA_STORE, { keyPath: "chatId" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getChatCustomization(
  chatId: string,
): Promise<ChatCustomization> {
  try {
    const db = await openDb();
    if (!db) return DEFAULT_CUSTOMIZATION;

    return await new Promise((resolve) => {
      const tx = db.transaction(SETTINGS_STORE, "readonly");
      const store = tx.objectStore(SETTINGS_STORE);
      const request = store.get(chatId);

      request.onsuccess = () => {
        const record = request.result as
          | ({ chatId: string } & ChatCustomization)
          | undefined;

        if (!record) {
          resolve(DEFAULT_CUSTOMIZATION);
          return;
        }

        resolve({
          themeId: record.themeId ?? "default",
          fontId: record.fontId ?? null,
          wallpaper: record.wallpaper ?? { kind: "none" },
        });
      };

      request.onerror = () => resolve(DEFAULT_CUSTOMIZATION);
    });
  } catch {
    return DEFAULT_CUSTOMIZATION;
  }
}

async function saveCustomization(
  chatId: string,
  patch: Partial<ChatCustomization>,
): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;

    const current = await getChatCustomization(chatId);
    const next: ChatCustomization = { ...current, ...patch };

    await new Promise<void>((resolve) => {
      const tx = db.transaction(SETTINGS_STORE, "readwrite");
      tx.objectStore(SETTINGS_STORE).put({ chatId, ...next });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Best effort — customization is a non-critical local preference.
  }
}

export async function setChatTheme(chatId: string, themeId: ThemeId) {
  await saveCustomization(chatId, { themeId });
}

export async function setChatFont(chatId: string, fontId: string | null) {
  await saveCustomization(chatId, { fontId });
}

export async function setChatWallpaperBuiltin(chatId: string, builtinId: string) {
  await clearChatWallpaperMedia(chatId);
  await saveCustomization(chatId, {
    wallpaper: { kind: builtinId === "none" ? "none" : "builtin", builtinId },
  });
}

export async function setChatWallpaperCustomFile(
  chatId: string,
  file: File,
): Promise<{ ok: true } | { ok: false; reason: "too-large" | "unsupported" | "storage-failed" }> {
  if (file.size > MAX_WALLPAPER_BYTES) {
    return { ok: false, reason: "too-large" };
  }

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  if (!isImage && !isVideo) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    const db = await openDb();
    if (!db) return { ok: false, reason: "storage-failed" };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, "readwrite");
      tx.objectStore(MEDIA_STORE).put({
        chatId,
        blob: file,
        mediaType: isImage ? "image" : "video",
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await saveCustomization(chatId, {
      wallpaper: { kind: isImage ? "custom-image" : "custom-video" },
    });

    return { ok: true };
  } catch {
    return { ok: false, reason: "storage-failed" };
  }
}

export async function getChatWallpaperMedia(
  chatId: string,
): Promise<{ blob: Blob; mediaType: "image" | "video" } | null> {
  try {
    const db = await openDb();
    if (!db) return null;

    return await new Promise((resolve) => {
      const tx = db.transaction(MEDIA_STORE, "readonly");
      const request = tx.objectStore(MEDIA_STORE).get(chatId);

      request.onsuccess = () => {
        const record = request.result as
          | { chatId: string; blob: Blob; mediaType: "image" | "video" }
          | undefined;

        resolve(record ? { blob: record.blob, mediaType: record.mediaType } : null);
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function clearChatWallpaperMedia(chatId: string): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      const tx = db.transaction(MEDIA_STORE, "readwrite");
      tx.objectStore(MEDIA_STORE).delete(chatId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // best effort
  }
}

export async function clearChatWallpaper(chatId: string): Promise<void> {
  await clearChatWallpaperMedia(chatId);
  await saveCustomization(chatId, { wallpaper: { kind: "none" } });
}