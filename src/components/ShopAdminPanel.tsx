import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminListShopCatalog,
  adminUpsertShopItem,
  adminSetShopItemAvailable,
  adminUploadShopMedia,
} from "@/lib/shopAdmin.functions";
import {
  buildPackMetadata,
  parseVariants,
  type ShopMediaVariant,
} from "@/lib/shopMedia";
import type { ShopItem } from "@/lib/gaming.functions";

type CosmeticType =
  | "wallpaper"
  | "bubble"
  | "theme"
  | "badge"
  | "sticker_pack"
  | "profile_frame";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

const emptyVariant = (): ShopMediaVariant => ({
  id: crypto.randomUUID(),
  kind: "image",
  url: "",
  label: "",
});

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function categoryChipLabel(name: string): string {
  const n = name.trim();
  if (!n) return "Other";
  // Match shop-style naming
  if (/^x\s/i.test(n)) return n;
  return n;
}

function itemCosmeticType(item: ShopItem): string {
  const m = item.metadata as Record<string, unknown> | null;
  const t = m?.cosmetic_type;
  return typeof t === "string" ? t : "other";
}

/**
 * Shop admin with category navigation (like the real Shop),
 * device upload (10MB image / 30MB video), edit scroll, preview image.
 */
export function ShopAdminPanel() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-shop-catalog"],
    queryFn: () => adminListShopCatalog(),
  });

  const categories = data?.categories ?? [];
  const items = data?.items ?? [];

  const [filterCat, setFilterCat] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(100);
  const [categoryId, setCategoryId] = useState<string>("");
  const [cosmeticType, setCosmeticType] = useState<CosmeticType>("wallpaper");
  const [variants, setVariants] = useState<ShopMediaVariant[]>([emptyVariant()]);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const filteredItems = useMemo(() => {
    if (filterCat === "all") return items;
    if (filterCat.startsWith("type:")) {
      const t = filterCat.slice(5);
      return items.filter((i) => itemCosmeticType(i) === t);
    }
    return items.filter((i) => i.category_id === filterCat);
  }, [items, filterCat]);

  function startNew() {
    setEditingId(null);
    setName("");
    setDescription("");
    setPrice(100);
    setCategoryId(categories[0]?.category_id ?? "");
    setCosmeticType("wallpaper");
    setVariants([emptyVariant()]);
    setPreviewUrl("");
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function startEdit(item: ShopItem) {
    setEditingId(item.item_id);
    setName(item.name);
    setDescription(item.description ?? "");
    setPrice(Number(item.price_x_coins) || 0);
    setCategoryId(item.category_id ?? "");
    const meta = (item.metadata || {}) as Record<string, unknown>;
    const ct = meta.cosmetic_type;
    if (
      ct === "wallpaper" ||
      ct === "bubble" ||
      ct === "theme" ||
      ct === "badge" ||
      ct === "sticker_pack" ||
      ct === "profile_frame"
    ) {
      setCosmeticType(ct);
    }
    const vs = parseVariants(item.metadata);
    setVariants(vs.length ? vs : [emptyVariant()]);
    const prev =
      (typeof meta.preview_url === "string" && meta.preview_url) ||
      (typeof (item as { preview_url?: string }).preview_url === "string"
        ? (item as { preview_url?: string }).preview_url
        : "") ||
      vs[0]?.url ||
      "";
    setPreviewUrl(prev || "");
    // Jump to editor so you don't scroll manually
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");
        if (!isVideo && !isImage) {
          toast.error(`${file.name}: only images or videos`);
          continue;
        }
        const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        if (file.size > max) {
          toast.error(
            isVideo
              ? `${file.name}: max 30MB for live wallpaper`
              : `${file.name}: max 10MB for pictures`,
          );
          continue;
        }
        const fileBase64 = await fileToBase64(file);
        const res = await adminUploadShopMedia({
          data: {
            fileBase64,
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
          },
        });
        const kind = res.kind === "video" ? "video" : "image";
        setVariants((list) => {
          const next = [
            ...list.filter((v) => v.url.trim()),
            {
              id: crypto.randomUUID(),
              kind,
              url: res.url,
              label:
                kind === "video"
                  ? "Live"
                  : file.name.replace(/\.[^.]+$/, "").slice(0, 24),
            },
          ];
          return next;
        });
        setPreviewUrl((p) => p || res.url);
        toast.success(`Uploaded ${file.name}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    setBusy(true);
    try {
      const clean = variants
        .map((v) => ({
          ...v,
          url: v.url.trim(),
          label: (v.label || "").trim() || undefined,
        }))
        .filter((v) => v.url);
      if (!clean.length) {
        toast.error("Add at least one picture or live video");
        return;
      }
      const preview = previewUrl.trim() || clean[0].url;
      const metadata = buildPackMetadata({
        cosmetic_type: cosmeticType,
        variants: clean,
        extra: { preview_url: preview },
      }) as unknown as Record<string, unknown>;

      await adminUpsertShopItem({
        data: {
          itemId: editingId,
          categoryId: categoryId || null,
          name,
          description,
          priceXCoins: price,
          available: true,
          uniqueOwnership: true,
          metadata,
          previewUrl: preview,
        },
      });
      toast.success(editingId ? "Item updated" : "Item created");
      await qc.invalidateQueries({ queryKey: ["admin-shop-catalog"] });
      await refetch();
      startNew();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAvailable(item: ShopItem) {
    try {
      await adminSetShopItemAvailable({
        data: { itemId: item.item_id, available: !item.available },
      });
      toast.success(item.available ? "Hidden from shop" : "Visible in shop");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading shop…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Shop catalog</h2>
          <p className="text-xs text-muted-foreground">
            Same categories as the shop. Pictures max 10MB · Live video max 30MB.
          </p>
        </div>
        <Button type="button" size="sm" onClick={startNew}>
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </div>

      {/* Category chips — like shop navigation */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilterCat("all")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
            filterCat === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.category_id}
            type="button"
            onClick={() => setFilterCat(c.category_id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              filterCat === c.category_id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {categoryChipLabel(c.name)}
          </button>
        ))}
        {(
          [
            ["wallpaper", "Wallpapers"],
            ["theme", "Themes"],
            ["bubble", "Bubbles"],
            ["badge", "Badges"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilterCat(`type:${id}`)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              filterCat === `type:${id}`
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* EDITOR — top so Edit jumps here */}
      <div
        ref={editorRef}
        id="shop-admin-editor"
        className="space-y-3 scroll-mt-20 rounded-2xl border border-border bg-card p-4"
      >
        <p className="text-sm font-medium">
          {editingId ? "Editing item" : "New item"}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Anime Pack 1"
            />
          </div>
          <div className="space-y-1">
            <Label>Price (X coins)</Label>
            <Input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label>Shop category</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {categoryChipLabel(c.name)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={cosmeticType}
              onChange={(e) => setCosmeticType(e.target.value as CosmeticType)}
            >
              <option value="wallpaper">Wallpaper pack</option>
              <option value="bubble">Chat bubble</option>
              <option value="theme">Theme</option>
              <option value="badge">Badge</option>
              <option value="sticker_pack">Sticker pack</option>
              <option value="profile_frame">Profile frame</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <Label>Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What buyers see"
          />
        </div>

        {/* Shop preview (card image in shop) */}
        <div className="space-y-2 rounded-xl border border-border/60 p-3">
          <Label className="flex items-center gap-1">
            <ImageIcon className="h-3.5 w-3.5" />
            Shop preview picture
          </Label>
          <p className="text-[11px] text-muted-foreground">
            This is the cover people see in the shop before buying. Tap a media
            below to use it as preview, or paste a URL.
          </p>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="h-28 w-full rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-28 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
              No preview yet
            </div>
          )}
          <Input
            placeholder="Preview image URL"
            value={previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
          />
        </div>

        <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
          <Label>From your device</Label>
          <p className="text-[11px] text-muted-foreground">
            Photos max <strong>10MB</strong> · Live video max <strong>30MB</strong>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading…" : "Choose images / videos"}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Pack media (browse before buy)</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setVariants((v) => [...v, emptyVariant()])}
            >
              <Plus className="mr-1 h-4 w-4" /> URL
            </Button>
          </div>
          {variants.map((v, idx) => (
            <div
              key={v.id}
              className="flex flex-col gap-2 rounded-xl border border-border/60 p-2 sm:flex-row sm:items-center"
            >
              {v.url && v.kind === "image" ? (
                <button
                  type="button"
                  title="Use as shop preview"
                  onClick={() => setPreviewUrl(v.url)}
                >
                  <img
                    src={v.url}
                    alt=""
                    className="h-14 w-20 rounded-lg object-cover"
                  />
                </button>
              ) : null}
              {v.url && v.kind === "video" ? (
                <button
                  type="button"
                  title="Use as shop preview"
                  onClick={() => setPreviewUrl(v.url)}
                >
                  <video
                    src={v.url}
                    className="h-14 w-20 rounded-lg object-cover"
                    muted
                  />
                </button>
              ) : null}
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={v.kind}
                onChange={(e) => {
                  const kind = e.target.value as "image" | "video";
                  setVariants((list) =>
                    list.map((x, i) => (i === idx ? { ...x, kind } : x)),
                  );
                }}
              >
                <option value="image">Picture</option>
                <option value="video">Live</option>
              </select>
              <Input
                className="flex-1"
                placeholder="URL"
                value={v.url}
                onChange={(e) => {
                  const url = e.target.value;
                  setVariants((list) =>
                    list.map((x, i) => (i === idx ? { ...x, url } : x)),
                  );
                }}
              />
              <Input
                className="sm:w-24"
                placeholder="Label"
                value={v.label || ""}
                onChange={(e) => {
                  const label = e.target.value;
                  setVariants((list) =>
                    list.map((x, i) => (i === idx ? { ...x, label } : x)),
                  );
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => v.url && setPreviewUrl(v.url)}
              >
                Preview
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
                  setVariants((list) => list.filter((_, i) => i !== idx))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void save()}
        >
          <Save className="mr-1 h-4 w-4" />
          {busy ? "Saving…" : "Save to shop"}
        </Button>
      </div>

      {/* List for current category */}
      <p className="text-xs text-muted-foreground">
        {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
      </p>
      <ul className="space-y-2">
        {filteredItems.map((item) => {
          const vs = parseVariants(item.metadata);
          const meta = (item.metadata || {}) as Record<string, unknown>;
          const cover =
            (typeof meta.preview_url === "string" && meta.preview_url) ||
            vs[0]?.url;
          return (
            <li
              key={item.item_id}
              className="flex gap-3 rounded-2xl border border-border bg-card p-3"
            >
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted text-[10px] text-muted-foreground">
                  No img
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.price_x_coins} coins
                  {vs.length ? ` · ${vs.length} media` : ""}
                  {item.available ? "" : " · hidden"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void toggleAvailable(item)}
                  >
                    {item.available ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
