import { useState } from "react";
import { Button } from "@/components/ui/button";
import { parseVariants } from "@/lib/shopMedia";

type Props = {
  open: boolean;
  onClose: () => void;
  name: string;
  description?: string | null;
  price: number;
  metadata: unknown;
  onBuy?: () => void;
};

/**
 * Shop "look inside" before buy — swipe/tap through pictures & live videos.
 * Use on shop item cards when user taps the preview.
 */
export function ShopPackPreviewModal({
  open,
  onClose,
  name,
  description,
  price,
  metadata,
  onBuy,
}: Props) {
  const variants = parseVariants(metadata);
  const [idx, setIdx] = useState(0);
  if (!open) return null;

  const v = variants[idx];
  const meta = (metadata || {}) as Record<string, unknown>;
  const cover =
    (typeof meta.preview_url === "string" && meta.preview_url) || v?.url;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="relative aspect-[4/5] bg-black">
          {v?.kind === "video" ? (
            <video
              key={v.url}
              src={v.url}
              className="h-full w-full object-contain"
              controls
              playsInline
              autoPlay
              loop
              muted
            />
          ) : (
            <img
              src={v?.url || cover || ""}
              alt=""
              className="h-full w-full object-contain"
            />
          )}
          {variants.length > 1 ? (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
              {variants.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`h-1.5 w-1.5 rounded-full ${
                    i === idx ? "bg-white" : "bg-white/40"
                  }`}
                  onClick={() => setIdx(i)}
                />
              ))}
            </div>
          ) : null}
        </div>
        <div className="space-y-2 p-4">
          <h3 className="text-base font-semibold">{name}</h3>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
          <p className="text-sm font-medium">{price} X Coins</p>
          {variants.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {variants.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={`shrink-0 overflow-hidden rounded-lg border ${
                    i === idx ? "border-primary" : "border-border"
                  }`}
                >
                  {item.kind === "video" ? (
                    <video
                      src={item.url}
                      className="h-14 w-20 object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt=""
                      className="h-14 w-20 object-cover"
                    />
                  )}
                  <span className="block px-1 py-0.5 text-[10px] text-muted-foreground">
                    {item.label || (item.kind === "video" ? "Live" : "Photo")}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              Close
            </Button>
            {onBuy ? (
              <Button className="flex-1" onClick={onBuy}>
                Buy
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
