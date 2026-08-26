import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Package, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { XCoinIcon } from "@/components/gaming/XCoinIcon";
import {
  convertGift,
  getMyCollectibles,
  setFeaturedGift,
  type GiftCollectible,
} from "@/lib/gaming.functions";
import { formatSerial, giftEmoji } from "@/lib/giftMessage";

export function CollectiblesPanel({
  onBalanceMaybeChanged,
}: {
  onBalanceMaybeChanged?: () => void;
}) {
  const [items, setItems] = useState<GiftCollectible[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GiftCollectible | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getMyCollectibles();
      setItems(res?.collectibles ?? []);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Could not load collectibles",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onConvert(item: GiftCollectible) {
    if (busyId) return;
    if (String(item.status).toLowerCase() === "converted") {
      toast.error("Already converted");
      return;
    }

    const ok = window.confirm(
      `Convert ${item.gift_name ?? "this gift"} to X Coins? The backend applies the 80% conversion (20% platform fee).`,
    );
    if (!ok) return;

    setBusyId(item.collectible_id);
    try {
      await convertGift({
        data: { collectibleId: item.collectible_id },
      });
      toast.success("Collectible converted");
      await load();
      onBalanceMaybeChanged?.();
      setDetail(null);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Could not convert",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onFeature(item: GiftCollectible) {
    if (busyId) return;
    setBusyId(item.collectible_id);
    try {
      await setFeaturedGift({
        data: { collectibleId: item.collectible_id },
      });
      toast.success("Featured on profile");
      await load();
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Could not feature",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="mb-1 flex items-center gap-2">
        <Package className="h-4 w-4" />
        <h2 className="font-semibold">My Collectibles</h2>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="font-semibold">No collectibles yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Gifts you receive in chat will appear here.
          </p>
        </div>
      )}

      {items.map((item) => {
        const emoji = giftEmoji(item.gift_key || item.gift_name);
        const serial =
          item.limited
            ? formatSerial(item.serial_number, item.serial_total)
            : null;
        const converted =
          String(item.status).toLowerCase() === "converted";

        return (
          <button
            key={item.collectible_id}
            type="button"
            onClick={() => setDetail(item)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-primary/40"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {emoji} {item.gift_name ?? "Collectible"}
              </p>
              {serial ? (
                <p className="text-xs font-semibold text-amber-400">
                  {serial}
                </p>
              ) : null}
              {converted ? (
                <p className="text-xs text-muted-foreground">Converted</p>
              ) : null}
            </div>
            {item.featured ? (
              <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-[10px] font-semibold text-primary">
                <Star className="h-3 w-3" /> Featured
              </span>
            ) : null}
          </button>
        );
      })}

      {detail ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setDetail(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm space-y-3 rounded-3xl border border-border bg-background p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <p className="text-2xl">
              {giftEmoji(detail.gift_key || detail.gift_name)}{" "}
              <span className="text-xl font-bold">
                {detail.gift_name}
              </span>
            </p>
            {detail.value_x_coins != null ? (
              <p className="flex items-center gap-1 text-sm font-bold text-yellow-400">
                <XCoinIcon size={16} className="text-yellow-400" />
                {detail.value_x_coins.toLocaleString()} X value
              </p>
            ) : null}
            {detail.limited &&
            formatSerial(detail.serial_number, detail.serial_total) ? (
              <p className="text-sm font-semibold text-amber-400">
                Limited Edition{" "}
                {formatSerial(detail.serial_number, detail.serial_total)}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Status: {detail.status}
              {detail.received_at
                ? ` · Received ${new Date(detail.received_at).toLocaleString()}`
                : ""}
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="button"
                disabled={
                  busyId === detail.collectible_id ||
                  String(detail.status).toLowerCase() === "converted"
                }
                onClick={() => void onConvert(detail)}
              >
                {String(detail.status).toLowerCase() === "converted"
                  ? "Converted"
                  : "Convert to X Coins"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busyId === detail.collectible_id}
                onClick={() => void onFeature(detail)}
              >
                Feature on Profile
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDetail(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
