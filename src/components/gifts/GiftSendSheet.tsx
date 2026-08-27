import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XCoinIcon } from "@/components/gaming/XCoinIcon";
import {
  getGiftCatalog,
  sendGift,
  type GiftDefinition,
} from "@/lib/gaming.functions";
import {
  formatSerial,
  giftEmoji,
  type GiftMessagePayload,
} from "@/lib/giftMessage";

type Props = {
  open: boolean;
  onClose: () => void;
  recipientId: string | null;
  recipientLabel?: string | null;
  /** Called after gift RPC succeeds so chat can insert the gift message. */
  onGiftSent: (payload: GiftMessagePayload, chatMessageId?: string) => Promise<void> | void;
  coins: number;
};

export function GiftSendSheet({
  open,
  onClose,
  recipientId,
  recipientLabel,
  onGiftSent,
  coins,
}: Props) {
  const [gifts, setGifts] = useState<GiftDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<GiftDefinition | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await getGiftCatalog();
        if (!cancelled) {
          setGifts(res?.gifts ?? []);
        }
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "Could not load gifts",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const sorted = useMemo(
    () => [...gifts].sort((a, b) => a.value_x_coins - b.value_x_coins),
    [gifts],
  );

  if (!open) return null;

  async function confirmSend() {
    if (!selected || !recipientId || busyId) return;

    const recipient = recipientId.trim();
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(recipient)) {
      toast.error(
        "Invalid recipient — open a direct chat with a real user",
      );
      return;
    }

    if (coins < selected.value_x_coins) {
      toast.error("Not enough X Coins");
      return;
    }

    setBusyId(selected.gift_id);

    const chatMessageId = crypto.randomUUID();
    const idempotencyKey = crypto.randomUUID();

    try {
      const res = await sendGift({
        data: {
          recipientId: recipient,
          giftId: selected.gift_id,
          message: message.trim() || null,
          chatMessageId,
          idempotencyKey,
        },
      });

      const result = (res?.result ?? {}) as Record<string, unknown>;

      const payload: GiftMessagePayload = {
        gift_transaction_id:
          result.gift_transaction_id == null
            ? null
            : String(result.gift_transaction_id),
        collectible_id:
          result.collectible_id == null
            ? null
            : String(result.collectible_id),
        gift_id: selected.gift_id,
        gift_key: selected.gift_key,
        gift_name: selected.name,
        value_x_coins: selected.value_x_coins,
        message: message.trim() || null,
        limited: selected.limited,
        serial_number:
          result.serial_number == null
            ? null
            : Number(result.serial_number),
        serial_total:
          result.serial_total == null
            ? selected.max_supply
            : Number(result.serial_total),
        emoji: giftEmoji(selected.gift_key || selected.name),
      };

      await onGiftSent(payload, chatMessageId);
      toast.success(`Sent ${selected.name}`);
      setSelected(null);
      setMessage("");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Could not send gift",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-background shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Send a gift"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div>
            <p className="font-semibold">Send a gift</p>
            {recipientLabel ? (
              <p className="text-xs text-muted-foreground">
                To {recipientLabel}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {loading && (
            <p className="text-sm text-muted-foreground">Loading gifts…</p>
          )}

          {!loading && sorted.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No gifts available right now.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {sorted.map((gift) => {
              const emoji = giftEmoji(gift.gift_key || gift.name);
              const active = selected?.gift_id === gift.gift_id;
              const afford = coins >= gift.value_x_coins;

              return (
                <button
                  key={gift.gift_id}
                  type="button"
                  onClick={() => setSelected(gift)}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="text-2xl">{emoji}</div>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold">
                    {gift.name}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-xs font-bold text-yellow-400">
                    <XCoinIcon size={14} className="text-yellow-400" />
                    {gift.value_x_coins.toLocaleString()}
                  </div>
                  {gift.limited ? (
                    <p className="mt-1 text-[10px] font-semibold text-amber-400">
                      Limited
                      {gift.max_supply != null
                        ? ` · max ${gift.max_supply}`
                        : ""}
                    </p>
                  ) : null}
                  {!afford ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Need more coins
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>

          {selected ? (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
              <p className="text-sm font-medium">
                {giftEmoji(selected.gift_key)} {selected.name}
              </p>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder='Optional message — e.g. "Thanks for being a bro ❤️"'
                maxLength={200}
              />
              <Button
                type="button"
                className="w-full bg-green-600 text-white hover:bg-green-700"
                disabled={!!busyId || coins < selected.value_x_coins}
                onClick={() => void confirmSend()}
              >
                {busyId
                  ? "Sending…"
                  : `Send for ${selected.value_x_coins.toLocaleString()} X`}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Renders a gift card inside the chat message list. */
export function GiftMessageCard({
  payload,
  mine,
}: {
  payload: GiftMessagePayload;
  mine: boolean;
}) {
  const navigate = useNavigate();
  const emoji =
    payload.emoji || giftEmoji(payload.gift_key || payload.gift_name);
  const serial = payload.limited
    ? formatSerial(payload.serial_number, payload.serial_total)
    : null;

  return (
    <button
      type="button"
      onClick={() => {
        void navigate({
          to: "/shop",
          search: { tab: "collectibles" },
        });
      }}
      className={`max-w-[85%] rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-card to-card px-4 py-3 text-left shadow transition hover:border-amber-400/50 ${
        mine ? "ml-auto" : "mr-auto"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
        {mine ? "Gift sent" : "Gift received"}
      </p>
      <p className="mt-1 text-lg font-bold">
        {emoji} {payload.gift_name}
      </p>
      {payload.limited && serial ? (
        <p className="mt-0.5 text-xs font-semibold text-amber-300">
          Limited Collectible · {serial}
        </p>
      ) : null}
      <p className="mt-1 flex items-center gap-1 text-sm font-bold text-yellow-400">
        <XCoinIcon size={16} className="text-yellow-400" />
        {payload.value_x_coins.toLocaleString()} X
      </p>
      {payload.message ? (
        <p className="mt-2 text-sm italic text-muted-foreground">
          “{payload.message}”
        </p>
      ) : null}
      <p className="mt-2 text-xs font-semibold text-primary">
        View collectible →
      </p>
    </button>
  );
}
