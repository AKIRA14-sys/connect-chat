/**
 * Gift message payload embedded in existing chat messages.
 * Uses the same "special content prefix" pattern as effects/secrets.
 * Does not change the messages table schema.
 */

export const GIFT_MESSAGE_PREFIX = "__XUP_GIFT__:";

export type GiftMessagePayload = {
  gift_transaction_id?: string | null;
  collectible_id?: string | null;
  gift_id?: string | null;
  gift_key?: string | null;
  gift_name: string;
  value_x_coins: number;
  message?: string | null;
  limited?: boolean;
  serial_number?: number | null;
  serial_total?: number | null;
  emoji?: string | null;
};

export function encodeGiftMessage(payload: GiftMessagePayload): string {
  return `${GIFT_MESSAGE_PREFIX}${JSON.stringify(payload)}`;
}

export function decodeGiftMessage(
  content: string | null | undefined,
): GiftMessagePayload | null {
  if (!content || !content.startsWith(GIFT_MESSAGE_PREFIX)) {
    return null;
  }

  try {
    const raw = content.slice(GIFT_MESSAGE_PREFIX.length);
    const parsed = JSON.parse(raw) as GiftMessagePayload;
    if (!parsed || typeof parsed !== "object" || !parsed.gift_name) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function giftEmoji(giftKeyOrName: string | null | undefined): string {
  const s = (giftKeyOrName ?? "").toLowerCase();
  if (s.includes("dragon")) return "🐉";
  if (s.includes("galaxy")) return "🌌";
  if (s.includes("trophy")) return "🏆";
  if (s.includes("diamond")) return "💎";
  if (s.includes("mystery")) return "📦";
  if (s.includes("rocket")) return "🚀";
  if (s.includes("crown")) return "👑";
  if (s.includes("lightning")) return "⚡";
  if (s.includes("rose")) return "🌹";
  if (s.includes("star")) return "⭐";
  if (s.includes("fire")) return "🔥";
  if (s.includes("heart")) return "❤️";
  return "🎁";
}

export function formatSerial(
  serial: number | null | undefined,
  total: number | null | undefined,
): string | null {
  if (serial == null || total == null) return null;
  const s = String(serial).padStart(2, "0");
  return `#${s} / ${total}`;
}
