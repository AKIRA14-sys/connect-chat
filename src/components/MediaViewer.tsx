import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Item = {
  url: string;
  type: "image" | "video";
};

type Props = {
  items: Item[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange: (i: number) => void;
};

/**
 * Full-screen image/video viewer (WhatsApp-style).
 * No Supabase changes — only displays signed URLs already loaded in chat.
 */
export function MediaViewer({
  items,
  index,
  open,
  onClose,
  onIndexChange,
}: Props) {
  const item = items[index] ?? null;

  const prev = useCallback(() => {
    if (items.length < 2) return;
    onIndexChange((index - 1 + items.length) % items.length);
  }, [index, items.length, onIndexChange]);

  const next = useCallback(() => {
    if (items.length < 2) return;
    onIndexChange((index + 1) % items.length);
  }, [index, items.length, onIndexChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, prev, next]);

  if (!open || !item) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between px-3 py-3 text-white">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
        <span className="text-sm tabular-nums opacity-80">
          {items.length > 1 ? `${index + 1} / ${items.length}` : ""}
        </span>
        <div className="w-10" />
      </div>

      <div className="relative flex flex-1 items-center justify-center px-2 pb-6">
        {items.length > 1 ? (
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 z-10 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
            aria-label="Previous"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        ) : null}

        {item.type === "video" ? (
          <video
            key={item.url}
            src={item.url}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-lg"
          />
        ) : (
          <img
            key={item.url}
            src={item.url}
            alt=""
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        )}

        {items.length > 1 ? (
          <button
            type="button"
            onClick={next}
            className="absolute right-2 z-10 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
            aria-label="Next"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
