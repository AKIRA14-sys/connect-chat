import { Button } from "@/components/ui/button";
import {
  getSelectedVariantId,
  parseVariants,
  saveSelectedVariant,
  type ShopMediaVariant,
} from "@/lib/shopMedia";

type Props = {
  itemId: string;
  itemName: string;
  metadata: unknown;
  onConfirm: (variant: ShopMediaVariant) => void;
  onClose: () => void;
};

/**
 * After buying a wallpaper/bubble pack, user picks picture vs live wallpaper.
 */
export function EquipVariantPicker({
  itemId,
  itemName,
  metadata,
  onConfirm,
  onClose,
}: Props) {
  const variants = parseVariants(metadata);
  const selected = getSelectedVariantId(itemId);

  if (!variants.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm">
        <p>No media variants on this item.</p>
        <Button className="mt-2" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-4 shadow-2xl">
        <h3 className="text-base font-semibold">Choose look</h3>
        <p className="text-xs text-muted-foreground">{itemName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pictures or live wallpaper — pick one to equip.
        </p>
        <div className="mt-3 grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto">
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`overflow-hidden rounded-xl border text-left ${
                selected === v.id ? "border-primary ring-2 ring-primary/40" : "border-border"
              }`}
              onClick={() => {
                saveSelectedVariant(itemId, v.id);
                onConfirm(v);
              }}
            >
              {v.kind === "video" ? (
                <video
                  src={v.url}
                  className="aspect-video w-full object-cover"
                  muted
                  playsInline
                  loop
                  autoPlay
                />
              ) : (
                <img
                  src={v.url}
                  alt=""
                  className="aspect-video w-full object-cover"
                />
              )}
              <span className="block px-2 py-1 text-[11px] text-muted-foreground">
                {v.label || (v.kind === "video" ? "Live" : "Picture")}
              </span>
            </button>
          ))}
        </div>
        <Button className="mt-3 w-full" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
