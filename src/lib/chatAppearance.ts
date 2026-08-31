// src/lib/chatAppearance.ts

export type ChatTheme = {
  id: string;
  name: string;
  background: string;
  bubble: string;
  text: string;
  accent: string;
};

export type ChatWallpaper = {
  id: string;
  name: string;
  value: string;
};

export type ChatAppearance = {
  themeId: string;
  fontId: string;
  wallpaperId: string;
  /** When set, overrides builtin wallpaper with local photo/video */
  customMedia?: "image" | "video" | null;
};

export const CHAT_THEMES: ChatTheme[] = [
  { id: "default", name: "Default", background: "#09090b", bubble: "#18181b", text: "#ffffff", accent: "#22c55e" },
  { id: "midnight", name: "Midnight", background: "#020617", bubble: "#0f172a", text: "#f8fafc", accent: "#38bdf8" },
  { id: "purple", name: "Purple", background: "#12091f", bubble: "#25113d", text: "#faf5ff", accent: "#c084fc" },
  { id: "ocean", name: "Ocean", background: "#031923", bubble: "#073344", text: "#ecfeff", accent: "#22d3ee" },
  { id: "emerald", name: "Emerald", background: "#03140d", bubble: "#0b2b1c", text: "#ecfdf5", accent: "#34d399" },
  { id: "rose", name: "Rose", background: "#1a080d", bubble: "#35121c", text: "#fff1f2", accent: "#fb7185" },
  { id: "sunset", name: "Sunset", background: "#1c0b03", bubble: "#3a1708", text: "#fff7ed", accent: "#fb923c" },
  { id: "sakura", name: "Sakura", background: "#1a0b14", bubble: "#351426", text: "#fff1f2", accent: "#f472b6" },
  { id: "neon", name: "Neon", background: "#05050a", bubble: "#151525", text: "#f5f3ff", accent: "#a78bfa" },
  { id: "amoled", name: "AMOLED", background: "#000000", bubble: "#090909", text: "#ffffff", accent: "#22c55e" },
];

export const CHAT_WALLPAPERS: ChatWallpaper[] = [
  { id: "none", name: "None", value: "" },
  { id: "dots", name: "Dots", value: "radial-gradient(circle, rgba(255,255,255,.08) 1px, transparent 1px)" },
  { id: "grid", name: "Grid", value: "linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)" },
  { id: "waves", name: "Waves", value: "radial-gradient(circle at 20% 20%, rgba(99,102,241,.18), transparent 35%), radial-gradient(circle at 80% 80%, rgba(236,72,153,.15), transparent 35%)" },
  { id: "aurora", name: "Aurora", value: "linear-gradient(135deg, rgba(34,211,238,.15), rgba(168,85,247,.18), rgba(236,72,153,.12))" },
  { id: "night", name: "Night Sky", value: "radial-gradient(circle at 30% 20%, rgba(59,130,246,.18), transparent 25%), radial-gradient(circle at 70% 80%, rgba(139,92,246,.15), transparent 30%)" },
  { id: "sunset", name: "Sunset", value: "linear-gradient(135deg, rgba(251,146,60,.18), rgba(244,63,94,.15))" },
  { id: "ocean", name: "Ocean", value: "linear-gradient(135deg, rgba(6,182,212,.18), rgba(37,99,235,.16))" },
];

const FONT_NAMES = [
  "Inter", "Roboto", "Poppins", "Montserrat", "Nunito", "Quicksand", "Raleway", "Lato",
  "Oswald", "Merriweather", "Playfair Display", "Ubuntu", "Fira Sans", "Space Grotesk",
  "Orbitron", "Caveat", "Pacifico", "Bebas Neue", "DM Sans", "Manrope", "Outfit", "Sora",
  "Rubik", "Work Sans", "Karla", "Mulish", "Barlow", "Cabin", "Comfortaa", "Josefin Sans",
  "Libre Baskerville", "Lora", "Source Sans 3", "Titillium Web", "Varela Round", "Archivo",
  "Bitter", "Chakra Petch", "Cinzel",
];

export const CHAT_FONTS = Array.from({ length: 200 }, (_, index) => {
  const base = FONT_NAMES[index % FONT_NAMES.length]!;
  return {
    id: `font-${index + 1}`,
    name: index < FONT_NAMES.length ? base : `${base} ${Math.floor(index / FONT_NAMES.length) + 1}`,
    family: `"${base}", system-ui, sans-serif`,
  };
});

const DB_NAME = "whatsxup-chat-appearance";
const STORE_NAME = "appearance";
const MEDIA_STORE = "pageMedia";
const DB_VERSION = 3;
const MAX_PAGE_MEDIA_BYTES = 25 * 1024 * 1024;

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          db.createObjectStore(MEDIA_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

const fallbackAppearance = (): ChatAppearance => ({
  themeId: "default",
  fontId: "font-1",
  wallpaperId: "none",
  customMedia: null,
});

export async function getChatAppearance(
  chatId: string,
): Promise<ChatAppearance> {
  const fallback = fallbackAppearance();
  if (typeof window === "undefined") return fallback;

  try {
    const db = await openDB();
    if (!db) return fallback;

    return await new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(`chat:${chatId}`);
      request.onsuccess = () => {
        const raw = request.result as ChatAppearance | undefined;
        resolve(
          raw
            ? {
                themeId: raw.themeId ?? "default",
                fontId: raw.fontId ?? "font-1",
                wallpaperId: raw.wallpaperId ?? "none",
                customMedia: raw.customMedia ?? null,
              }
            : fallback,
        );
      };
      request.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
}

export async function saveChatAppearance(
  chatId: string,
  appearance: ChatAppearance,
) {
  if (typeof window === "undefined") return;
  const db = await openDB();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(appearance, `chat:${chatId}`);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

export async function getPageAppearance(): Promise<ChatAppearance> {
  return getChatAppearance("__chats_page__");
}

export async function savePageAppearance(appearance: ChatAppearance) {
  return saveChatAppearance("__chats_page__", appearance);
}

export async function getPageWallpaperMedia(): Promise<{
  blob: Blob;
  mediaType: "image" | "video";
} | null> {
  try {
    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(MEDIA_STORE)) return null;
    return await new Promise((resolve) => {
      const tx = db.transaction(MEDIA_STORE, "readonly");
      const req = tx.objectStore(MEDIA_STORE).get("__chats_page__");
      req.onsuccess = () => {
        const row = req.result as
          | { blob: Blob; mediaType: "image" | "video" }
          | undefined;
        resolve(row ? { blob: row.blob, mediaType: row.mediaType } : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setPageWallpaperFile(
  file: File,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (file.size > MAX_PAGE_MEDIA_BYTES) {
    return { ok: false, reason: "too-large" };
  }
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) return { ok: false, reason: "unsupported" };

  try {
    const db = await openDB();
    if (!db) return { ok: false, reason: "storage-failed" };
    if (!db.objectStoreNames.contains(MEDIA_STORE)) {
      return { ok: false, reason: "storage-failed" };
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, "readwrite");
      tx.objectStore(MEDIA_STORE).put(
        {
          blob: file,
          mediaType: isImage ? "image" : "video",
        },
        "__chats_page__",
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const current = await getPageAppearance();
    await savePageAppearance({
      ...current,
      wallpaperId: "none",
      customMedia: isImage ? "image" : "video",
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "storage-failed" };
  }
}

export async function clearPageWallpaperMedia(): Promise<void> {
  try {
    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(MEDIA_STORE)) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(MEDIA_STORE, "readwrite");
      tx.objectStore(MEDIA_STORE).delete("__chats_page__");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    const current = await getPageAppearance();
    await savePageAppearance({
      ...current,
      customMedia: null,
    });
  } catch {
    /* ignore */
  }
}

export function getTheme(id: string) {
  return CHAT_THEMES.find((theme) => theme.id === id) ?? CHAT_THEMES[0]!;
}

export function getWallpaper(id: string) {
  return CHAT_WALLPAPERS.find((wallpaper) => wallpaper.id === id) ?? CHAT_WALLPAPERS[0]!;
}

export function getFont(id: string) {
  return CHAT_FONTS.find((font) => font.id === id) ?? CHAT_FONTS[0]!;
}
