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
  "Inter",
  "Roboto",
  "Poppins",
  "Montserrat",
  "Nunito",
  "Quicksand",
  "Raleway",
  "Lato",
  "Oswald",
  "Merriweather",
  "Playfair Display",
  "Ubuntu",
  "Fira Sans",
  "Space Grotesk",
  "Orbitron",
  "Caveat",
  "Pacifico",
  "Bebas Neue",
  "DM Sans",
  "Manrope",
  "Outfit",
  "Sora",
  "Rubik",
  "Work Sans",
  "Karla",
  "Mulish",
  "Barlow",
  "Cabin",
  "Comfortaa",
  "Josefin Sans",
  "Libre Baskerville",
  "Lora",
  "Raleway",
  "Source Sans 3",
  "Titillium Web",
  "Varela Round",
  "Archivo",
  "Bitter",
  "Chakra Petch",
  "Cinzel",
];

export const CHAT_FONTS = Array.from({ length: 200 }, (_, index) => {
  const base = FONT_NAMES[index % FONT_NAMES.length];

  return {
    id: `font-${index + 1}`,
    name: index < FONT_NAMES.length ? base : `${base} ${Math.floor(index / FONT_NAMES.length) + 1}`,
    family: `"${base}", system-ui, sans-serif`,
  };
});

const DB_NAME = "whatsxup-chat-appearance";
const STORE_NAME = "appearance";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getChatAppearance(
  chatId: string,
): Promise<ChatAppearance> {
  const fallback: ChatAppearance = {
    themeId: "default",
    fontId: "font-1",
    wallpaperId: "none",
  };

  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return fallback;
  }

  try {
    const db = await openDB();

    return await new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(`chat:${chatId}`);

      request.onsuccess = () => {
        resolve(request.result ?? fallback);
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
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return;
  }

  const db = await openDB();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.objectStore(STORE_NAME).put(
      appearance,
      `chat:${chatId}`,
    );

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getPageAppearance(): Promise<ChatAppearance> {
  return getChatAppearance("__chats_page__");
}

export async function savePageAppearance(
  appearance: ChatAppearance,
) {
  return saveChatAppearance("__chats_page__", appearance);
}

export function getTheme(id: string) {
  return (
    CHAT_THEMES.find((theme) => theme.id === id) ??
    CHAT_THEMES[0]
  );
}

export function getWallpaper(id: string) {
  return (
    CHAT_WALLPAPERS.find((wallpaper) => wallpaper.id === id) ??
    CHAT_WALLPAPERS[0]
  );
}

export function getFont(id: string) {
  return (
    CHAT_FONTS.find((font) => font.id === id) ??
    CHAT_FONTS[0]
  );
}