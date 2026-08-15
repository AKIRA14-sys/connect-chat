import {
  useMemo,
  useState,
} from "react";
import {
  SmilePlus,
  X,
} from "lucide-react";

import {
  STICKERS,
  STICKER_PACKS,
} from "@/lib/stickers";

type StickerPickerProps = {
  onSelect: (
    stickerId: string,
  ) => void;

  onClose?: () => void;
};

export function StickerPicker({
  onSelect,
  onClose,
}: StickerPickerProps) {
  const [pack, setPack] =
    useState<
      (typeof STICKER_PACKS)[number]
    >("All");

  const stickers =
    useMemo(() => {
      if (pack === "All") {
        return STICKERS;
      }

      return STICKERS.filter(
        (sticker) =>
          sticker.pack === pack,
      );
    }, [pack]);

  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <SmilePlus className="h-4 w-4 text-primary" />

          <span className="text-sm font-semibold">
            Stickers
          </span>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
        {STICKER_PACKS.map(
          (name) => (
            <button
              key={name}
              type="button"
              onClick={() =>
                setPack(name)
              }
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
                pack === name
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {name}
            </button>
          ),
        )}
      </div>

      <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto p-3">
        {stickers.map(
          (sticker) => (
            <button
              key={sticker.id}
              type="button"
              title={sticker.label}
              onClick={() =>
                onSelect(
                  sticker.id,
                )
              }
              className="flex aspect-square items-center justify-center rounded-xl text-4xl transition hover:scale-110 hover:bg-muted active:scale-95"
            >
              {sticker.emoji}
            </button>
          ),
        )}
      </div>
    </div>
  );
}