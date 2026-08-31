import { useMemo, useState } from "react";
import { SmilePlus, X } from "lucide-react";
import {
  STICKERS,
  STICKER_PACKS,
  stickerEffectClass,
} from "@/lib/stickers";

type StickerPickerProps = {
  onSelect: (stickerId: string) => void;
  onClose?: () => void;
};

export function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
  const [pack, setPack] = useState<(typeof STICKER_PACKS)[number]>("All");
  const [query, setQuery] = useState("");

  const stickers = useMemo(() => {
    let list =
      pack === "All"
        ? STICKERS
        : STICKERS.filter((s) => s.pack === pack);
    const q = query.trim();
    if (q) {
      list = list.filter(
        (s) => s.emoji.includes(q) || s.label.includes(q) || s.pack.toLowerCase().includes(q.toLowerCase()),
      );
    }
    return list;
  }, [pack, query]);

  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <SmilePlus className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Stickers</span>
          <span className="text-[10px] text-muted-foreground">
            {STICKERS.length}
          </span>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="border-b border-border px-2 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji…"
          className="w-full rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
        {STICKER_PACKS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setPack(name)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
              pack === name
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto p-2">
        {stickers.map((sticker) => (
          <button
            key={sticker.id}
            type="button"
            title={`${sticker.emoji} · ${sticker.effect}`}
            onClick={() => onSelect(sticker.id)}
            className="flex aspect-square items-center justify-center rounded-xl text-2xl transition hover:bg-muted active:scale-95"
          >
            <span className={`xup-sticker-fx ${stickerEffectClass(sticker.emoji)}`}>
              {sticker.emoji}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
