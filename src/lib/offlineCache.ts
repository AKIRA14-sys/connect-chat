// Offline snapshot cache: last-loaded chats + messages, so recently viewed
// conversations stay readable when connectivity drops. Best-effort only:
// localStorage-backed, capped, quota-safe. Served via React Query
// `placeholderData`; fresh network data always wins when available.

const PREFIX = "whatsxup.offline.v1";

function loadJSON<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(`${PREFIX}.${key}`);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function saveJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${PREFIX}.${key}`, JSON.stringify(value));
  } catch {
    // Quota or privacy mode — offline snapshots are optional.
    try {
      // Make room: drop the oldest message snapshots first.
      const doomed: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k?.startsWith(`${PREFIX}.msgs.`)) doomed.push(k);
      }
      doomed.slice(0, 5).forEach((k) => window.localStorage.removeItem(k));
      window.localStorage.setItem(`${PREFIX}.${key}`, JSON.stringify(value));
    } catch {
      /* give up silently */
    }
  }
}

const MAX_CHATS = 30;
const MAX_MSGS = 150;

export function loadCachedChatList<T>(userId: string | undefined): T | undefined {
  if (!userId) return undefined;
  return loadJSON<T>(`chats.${userId}`);
}

export function saveCachedChatList(userId: string | undefined, rows: unknown): void {
  if (!userId || !Array.isArray(rows)) return;
  saveJSON(`chats.${userId}`, rows.slice(0, MAX_CHATS));
}

export function loadCachedMessages<T>(conversationId: string | undefined): T | undefined {
  if (!conversationId) return undefined;
  return loadJSON<T>(`msgs.${conversationId}`);
}

export function saveCachedMessages(
  conversationId: string | undefined,
  msgs: unknown,
): void {
  if (!conversationId || !Array.isArray(msgs)) return;
  saveJSON(`msgs.${conversationId}`, msgs.slice(-MAX_MSGS));
}
