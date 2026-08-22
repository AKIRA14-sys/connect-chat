import { useEffect, useMemo, useRef, useState } from "react";
import { X, Palette, Type, Image as ImageIcon, Check, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  THEMES,
  BUILTIN_WALLPAPERS,
  getChatCustomization,
  setChatTheme,
  setChatFont,
  setChatWallpaperBuiltin,
  setChatWallpaperCustomFile,
  type ChatCustomization,
  type ThemeId,
} from "@/lib/chatCustomization";
import { FONTS, loadGoogleFont, type ChatFont } from "@/lib/chatFonts";

type Tab = "theme" | "font" | "wallpaper";

export default function ChatCustomizeSheet({
  chatId,
  open,
  onClose,
  onChanged,
}: {
  chatId: string;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("theme");
  const [customization, setCustomization] = useState<ChatCustomization | null>(null);
  const [fontQuery, setFontQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    getChatCustomization(chatId).then((result) => {
      if (!cancelled) setCustomization(result);
    });

    return () => {
      cancelled = true;
    };
  }, [open, chatId]);

  const filteredFonts = useMemo(() => {
    const query = fontQuery.trim().toLowerCase();
    const list = query
      ? FONTS.filter((font) => font.family.toLowerCase().includes(query))
      : FONTS.slice(0, 30); // light default view — search unlocks the rest

    // Preload only what's actually rendered.
    list.forEach((font) => loadGoogleFont(font.id));
    return list;
  }, [fontQuery]);

  if (!open) return null;

  async function chooseTheme(themeId: ThemeId) {
    await setChatTheme(chatId, themeId);
    setCustomization((current) => (current ? { ...current, themeId } : current));
    onChanged();
  }

  async function chooseFont(font: ChatFont | null) {
    loadGoogleFont(font?.id);
    await setChatFont(chatId, font?.id ?? null);
    setCustomization((current) =>
      current ? { ...current, fontId: font?.id ?? null } : current,
    );
    onChanged();
  }

  async function chooseBuiltinWallpaper(builtinId: string) {
    await setChatWallpaperBuiltin(chatId, builtinId);
    setCustomization((current) =>
      current
        ? { ...current, wallpaper: { kind: builtinId === "none" ? "none" : "builtin", builtinId } }
        : current,
    );
    onChanged();
  }

  async function handleFilePicked(file: File | undefined) {
    if (!file) return;
    setUploading(true);

    const result = await setChatWallpaperCustomFile(chatId, file);

    setUploading(false);

    if (!result.ok) {
      if (result.reason === "too-large") {
        toast.error("That file is too large (max 20MB). Try a smaller image or video.");
      } else if (result.reason === "unsupported") {
        toast.error("Please choose an image or video file.");
      } else {
        toast.error("Couldn't save that wallpaper on this device.");
      }
      return;
    }

    const refreshed = await getChatCustomization(chatId);
    setCustomization(refreshed);
    onChanged();
    toast.success("Wallpaper updated for this chat");
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Customize this chat</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted"
            aria-label="Close customize chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-border px-3 py-2">
          {(
            [
              { id: "theme" as const, label: "Theme", icon: Palette },
              { id: "font" as const, label: "Font", icon: Type },
              { id: "wallpaper" as const, label: "Wallpaper", icon: ImageIcon },
            ]
          ).map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                tab === entry.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              <entry.icon className="h-3.5 w-3.5" />
              {entry.label}
            </button>
          ))}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {tab === "theme" && (
            <div className="grid grid-cols-2 gap-3">
              {THEMES.map((theme) => {
                const active = customization?.themeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => void chooseTheme(theme.id)}
                    className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${
                      active ? "border-primary" : "border-border hover:bg-muted/50"
                    }`}
                    style={{
                      background: theme.messageAreaBackground || undefined,
                    }}
                  >
                    <span
                      className="mb-2 block h-8 w-8 rounded-full border border-white/20"
                      style={{ background: theme.bubbleMine || theme.swatch }}
                    />
                    <span className="block text-xs font-semibold">{theme.name}</span>
                    {active && (
                      <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {tab === "font" && (
            <div>
              <input
                value={fontQuery}
                onChange={(event) => setFontQuery(event.target.value)}
                placeholder="Search 200 fonts…"
                className="mb-3 w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-primary"
              />

              <button
                type="button"
                onClick={() => void chooseFont(null)}
                className={`mb-2 flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  !customization?.fontId
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                App default
                {!customization?.fontId && <Check className="h-4 w-4 text-primary" />}
              </button>

              <div className="space-y-1.5">
                {filteredFonts.map((font) => {
                  const active = customization?.fontId === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => void chooseFont(font)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <span className="min-w-0">
                        <span
                          className="block truncate text-base"
                          style={{ fontFamily: `"${font.family}", sans-serif` }}
                        >
                          {font.family}
                        </span>
                        <span className="block text-[10px] capitalize text-muted-foreground">
                          {font.category}
                        </span>
                      </span>
                      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}

                {fontQuery && filteredFonts.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No fonts match "{fontQuery}"
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === "wallpaper" && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(event) => {
                  void handleFilePicked(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />

              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/50 bg-primary/5 px-3 py-4 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? "Saving…" : "Choose photo or video from device"}
              </button>

              <p className="mb-3 text-[11px] font-semibold text-muted-foreground">
                Built-in wallpapers
              </p>

              <div className="grid grid-cols-3 gap-2">
                {BUILTIN_WALLPAPERS.map((wallpaper) => {
                  const active =
                    customization?.wallpaper.kind === "builtin" &&
                    customization.wallpaper.builtinId === wallpaper.id;
                  const activeNone =
                    wallpaper.id === "none" && customization?.wallpaper.kind === "none";

                  return (
                    <button
                      key={wallpaper.id}
                      type="button"
                      onClick={() => void chooseBuiltinWallpaper(wallpaper.id)}
                      className={`relative flex h-16 items-center justify-center overflow-hidden rounded-xl border text-[10px] font-medium ${
                        active || activeNone ? "border-primary" : "border-border"
                      }`}
                      style={{ background: wallpaper.css || undefined }}
                    >
                      <span className="rounded bg-black/40 px-1.5 py-0.5 text-white">
                        {wallpaper.name}
                      </span>
                      {(active || activeNone) && (
                        <Check className="absolute right-1 top-1 h-3.5 w-3.5 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}