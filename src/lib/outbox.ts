// Offline outbox: text messages written while offline are persisted locally and
// flushed automatically when connectivity returns. Nothing is ever silently lost.

export type OutboxItem = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  replyTo: string | null;
  createdAt: string;
  state: "queued" | "sending" | "failed";
  error?: string;
};

const KEY = "whatsxup.outbox.v1";

function read(): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as OutboxItem[];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("whatsxup:outbox"));
}

export function outboxFor(conversationId: string): OutboxItem[] {
  return read().filter((i) => i.conversationId === conversationId);
}

export function enqueue(item: Omit<OutboxItem, "state">): OutboxItem {
  const full: OutboxItem = { ...item, state: "queued" };
  write([...read(), full]);
  return full;
}

export function updateItem(id: string, patch: Partial<OutboxItem>) {
  write(read().map((i) => (i.id === id ? { ...i, ...patch } : i)));
}

export function dequeue(id: string) {
  write(read().filter((i) => i.id !== id));
}

export function allOutbox() {
  return read();
}
