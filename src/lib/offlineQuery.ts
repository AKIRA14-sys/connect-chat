import {
  loadCachedMessages,
  loadCachedMessagesAsync,
  loadCachedSnapshot,
  saveCachedSnapshot,
} from "@/lib/offlineCache";

/** Return cached messages if network fails or device is offline. */
export async function messagesQueryWithOfflineCache<T>(
  conversationId: string,
  fetchOnline: () => Promise<T>,
): Promise<T> {
  const offline =
    typeof navigator !== "undefined" && navigator.onLine === false;

  if (offline) {
    const sync = loadCachedMessages<T>(conversationId);
    if (sync) return sync;
    const asyncCached = await loadCachedMessagesAsync<T>(conversationId);
    if (asyncCached) return asyncCached;
    return [] as unknown as T;
  }

  try {
    return await fetchOnline();
  } catch (e) {
    const sync = loadCachedMessages<T>(conversationId);
    if (sync) return sync;
    const asyncCached = await loadCachedMessagesAsync<T>(conversationId);
    if (asyncCached) return asyncCached;
    throw e;
  }
}

export async function conversationQueryWithOfflineCache<T>(
  conversationId: string,
  fetchOnline: () => Promise<T>,
): Promise<T> {
  const key = `conversation.${conversationId}`;
  const offline =
    typeof navigator !== "undefined" && navigator.onLine === false;

  if (offline) {
    const cached = loadCachedSnapshot<T>(key);
    if (cached) return cached;
    throw new Error("Offline — open this chat once while online first");
  }

  try {
    const data = await fetchOnline();
    if (data) saveCachedSnapshot(key, data);
    return data;
  } catch (e) {
    const cached = loadCachedSnapshot<T>(key);
    if (cached) return cached;
    throw e;
  }
}
