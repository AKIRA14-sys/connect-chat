import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminListShopCatalog,
  adminUpsertShopItem,
  adminSetShopItemAvailable,
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

const emptyVariant = (): ShopMediaVariant => ({
  id: crypto.randomUUID(),
  kind: "image",
  url: "",
  label: "",
});

/**
 * Gaming shop manager — add/edit packs (anime, cars, live wallpapers, bubbles).
 * Mount inside main /admin under a "Shop" tab.
 */
export function ShopAdminPanel() {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-shop-catalog"],
    queryFn: () => adminListShopCatalog(),
  });

  const categories = data?.categories ?? [];
  const items = data?.items ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(100);
  const [categoryId, setCategoryId] = useState<string>("");
  const [cosmeticType, setCosmeticType] = useState<CosmeticType>("wallpaper");
  const [variants, setVariants] = useState<ShopMediaVariant[]>([emptyVariant()]);
  const [busy, setBusy] = useState(false);

  const categoryOptions = useMemo(() => categories, [categories]);

  function startNew() {
    setEditingId(null);
    setName("");
    setDescription("");
    setPrice(100);
    setCategoryId(categories[0]?.category_id ?? "");
    setCosmeticType("wallpaper");
    setVariants([emptyVariant()]);
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
      const metadata = buildPackMetadata({
        cosmetic_type: cosmeticType,
        variants: clean,
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
          previewUrl: clean[0]?.url ?? null,
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
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold">Shop / Gaming catalog</h2>
        <p className="text-xs text-muted-foreground">
          Add wallpaper packs (photos + live video), bubbles, anime, cars. Set
          price and media URLs. Users pick a variant when equipping.
        </p>
      </div>

      {/* Editor */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {editingId ? "Edit item" : "New item"}
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={startNew}>
            Clear
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Anime Pack 1" />
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
            <Label>Category</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {categoryOptions.map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {c.name}
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
            placeholder="Optional"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Pictures & live wallpapers</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setVariants((v) => [...v, emptyVariant()])}
            >
              <Plus className="mr-1 h-4 w-4" /> Add media
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Paste image or video URLs (upload to gaming Storage bucket{" "}
            <code>shop-media</code> then paste the public URL). Kind = image or
            live (video).
          </p>
          {variants.map((v, idx) => (
            <div
              key={v.id}
              className="flex flex-col gap-2 rounded-xl border border-border/60 p-2 sm:flex-row sm:items-center"
            >
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
                <option value="video">Live (video)</option>
              </select>
              <Input
                className="flex-1"
                placeholder="https://… image or .mp4"
                value={v.url}
                onChange={(e) => {
                  const url = e.target.value;
                  setVariants((list) =>
                    list.map((x, i) => (i === idx ? { ...x, url } : x)),
                  );
                }}
              />
              <Input
                className="sm:w-28"
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

        <Button type="button" disabled={busy || !name.trim()} onClick={() => void save()}>
          <Save className="mr-1 h-4 w-4" />
          {busy ? "Saving…" : "Save to shop"}
        </Button>
      </div>

      {/* List */}
      <ul className="space-y-2">
        {items.map((item) => {
          const vs = parseVariants(item.metadata);
          return (
            <li
              key={item.item_id}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.price_x_coins} coins
                  {vs.length ? ` · ${vs.length} media` : ""}
                  {item.available ? "" : " · hidden"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
