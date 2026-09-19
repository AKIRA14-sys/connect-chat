/**
 * XUPPIN — offline reading on THIS phone only
 *
 * When ONLINE on this phone:
 *   Opening a chat saves its loaded messages here (full list, no 150-cap).
 *
 * When OFFLINE on this same phone:
 *   You can open the app and read those saved chats/messages.
 *
 * Not a multi-device backup. Just local offline viewing on one device.
 */

const LS = "xuppin.offline.v3";
const IDB_NAME = "xuppin-offline-msgs-v3";
const IDB_STORE = "byConversation";
const IDB_VER = 1;

const MAX_CHAT_LIST = 100;
const MAX_CONTACTS = 400;

function lsGet<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(`${LS}.${key}`);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function lsSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${LS}.${key}`, JSON.stringify(value));
  } catch {
    try {
      // free a bit of space
      const drop: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(`${LS}.msgs.`)) drop.push(k);
      }
      drop.slice(0, 10).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(`${LS}.${key}`, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onerror = () => reject(req.error ?? new Error("idb"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbWrite(conversationId: string, messages: unknown[]) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({
      id: conversationId,
      messages,
      savedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbRead<T>(conversationId: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(conversationId);
    req.onsuccess = () => {
      const row = req.result as { messages?: T } | undefined;
      resolve(row?.messages);
    };
    req.onerror = () => reject(req.error);
  });
}

export function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/* —— Chat list —— */

export function loadCachedChatList<T>(userId: string | undefined): T | undefined {
  if (!userId) return undefined;
  return lsGet<T>(`chats.${userId}`);
}

export function saveCachedChatList(userId: string | undefined, rows: unknown): void {
  if (!userId || !Array.isArray(rows)) return;
  lsSet(`chats.${userId}`, rows.slice(0, MAX_CHAT_LIST));
}

/* —— Messages (unlimited on this phone for what was loaded online) —— */

/** Fast sync read (for placeholderData). */
export function loadCachedMessages<T>(
  conversationId: string | undefined,
): T | undefined {
  if (!conversationId) return undefined;
  return lsGet<T>(`msgs.${conversationId}`);
}

/** Full history from IndexedDB on this phone. */
export async function loadCachedMessagesAsync<T>(
  conversationId: string | undefined,
): Promise<T | undefined> {
  if (!conversationId) return undefined;
  try {
    const full = await idbRead<T>(conversationId);
    if (full != null) return full;
  } catch {
    /* fall through */
  }
  return lsGet<T>(`msgs.${conversationId}`);
}

/**
 * Call whenever messages are loaded online for a chat.
 * Saves the FULL array (no 150/250 cut) on this phone.
 */
export function saveCachedMessages(
  conversationId: string | undefined,
  msgs: unknown,
): void {
  if (!conversationId || !Array.isArray(msgs)) return;
  // Quick mirror for instant offline open
  lsSet(`msgs.${conversationId}`, msgs.slice(-300));
  // Full copy — unlimited within this phone's storage
  void idbWrite(conversationId, msgs as unknown[]).catch(() => {
    lsSet(`msgs.${conversationId}`, msgs.slice(-800));
  });
}

/* —— Contacts —— */

export function loadCachedContacts<T>(userId: string | undefined): T | undefined {
  if (!userId) return undefined;
  return lsGet<T>(`contacts.${userId}`);
}

export function saveCachedContacts(userId: string | undefined, rows: unknown): void {
  if (!userId || !Array.isArray(rows)) return;
  lsSet(`contacts.${userId}`, rows.slice(0, MAX_CONTACTS));
}

export function loadCachedSnapshot<T>(key: string): T | undefined {
  return lsGet<T>(`snap.${key}`);
}

export function saveCachedSnapshot(key: string, value: unknown): void {
  lsSet(`snap.${key}`, value);
}



/**
 * Merge one new message into the offline cache for a conversation
 * WITHOUT opening the chat (WhatsApp-style: received while online → readable offline).
 */
export function appendCachedMessage(
  conversationId: string | undefined,
  message: unknown,
): void {
  if (!conversationId || !message || typeof message !== "object") return;
  const msg = message as { id?: string };
  const existing =
    (loadCachedMessages<unknown[]>(conversationId) as unknown[] | undefined) ||
    [];
  if (msg.id && existing.some((m) => (m as { id?: string })?.id === msg.id)) {
    return;
  }
  const next = [...existing, message];
  saveCachedMessages(conversationId, next);
}

/** Update chat-list row preview when a message arrives in background. */
export function touchCachedChatListPreview(
  userId: string | undefined,
  conversationId: string,
  preview: string,
  at: string,
): void {
  if (!userId) return;
  const rows = loadCachedChatList<Record<string, unknown>[]>(userId);
  if (!Array.isArray(rows)) return;
  const next = rows.map((row) => {
    const conv = (row as { conv?: { id?: string } }).conv;
    const id =
      conv?.id ||
      (row as { id?: string }).id ||
      (row as { conversation_id?: string }).conversation_id;
    if (id !== conversationId) return row;
    return {
      ...row,
      lastMessage: preview,
      last_message_at: at,
      conv: conv
        ? { ...conv, last_message_at: at }
        : conv,
    };
  });
  // Move active chat toward top if structure allows
  saveCachedChatList(userId, next);
}

export function clearOfflineCache(): void {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (
      k?.startsWith(LS) ||
      k?.startsWith("xuppin.offline.v2") ||
      k?.startsWith("whatsxup.offline")
    ) {
      keys.push(k);
    }
  }
  keys.forEach((k) => localStorage.removeItem(k));
  try {
    indexedDB.deleteDatabase(IDB_NAME);
    indexedDB.deleteDatabase("xuppin-offline-v2");
  } catch {
    /* ignore */
  }
}

export function migrateLegacyOfflineCache(): void {
  if (typeof window === "undefined") return;
  const prefixes = ["whatsxup.offline.v1.", "xuppin.offline.v2."];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      for (const p of prefixes) {
        if (!k.startsWith(p)) continue;
        const raw = localStorage.getItem(k);
        if (raw == null) continue;
        const next = `${LS}.${k.slice(p.length)}`;
        if (!localStorage.getItem(next)) localStorage.setItem(next, raw);
      }
    }
  } catch {
    /* ignore */
  }
}
