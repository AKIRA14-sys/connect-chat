import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gamingSupabaseAdmin } from "@/integrations/gaming-supabase/client.server";
import type { ShopCategory, ShopItem } from "@/lib/gaming.functions";

function masterEmailAllowed(claimsEmail: string | undefined): boolean {
  const allowed = String(
    process.env.MASTER_ADMIN_EMAIL ||
      process.env.VITE_MASTER_ADMIN_EMAIL ||
      "",
  )
    .trim()
    .toLowerCase();
  // If not configured on server, allow authenticated callers (UI is still gated).
  if (!allowed) return true;
  if (!claimsEmail) return false;
  return claimsEmail.trim().toLowerCase() === allowed;
}

function emailFromClaims(claims: unknown): string | undefined {
  if (!claims || typeof claims !== "object") return undefined;
  const c = claims as Record<string, unknown>;
  if (typeof c.email === "string") return c.email;
  return undefined;
}

export type AdminUpsertShopItemInput = {
  itemId?: string | null;
  categoryId: string | null;
  name: string;
  description?: string | null;
  priceXCoins: number;
  available?: boolean;
  uniqueOwnership?: boolean;
  itemKey?: string | null;
  metadata: Record<string, unknown>;
  previewUrl?: string | null;
};

export const adminListShopCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const [catRes, itemRes] = await Promise.all([
      gamingSupabaseAdmin
        .from("shop_categories")
        .select("category_id, name, description")
        .order("name", { ascending: true }),
      gamingSupabaseAdmin
        .from("shop_items")
        .select(
          "item_id, category_id, item_key, name, description, price_x_coins, metadata, available, unique_ownership",
        )
        .order("name", { ascending: true }),
    ]);
    if (catRes.error) throw new Error(catRes.error.message);
    if (itemRes.error) throw new Error(itemRes.error.message);
    return {
      categories: (catRes.data ?? []) as ShopCategory[],
      items: (itemRes.data ?? []) as ShopItem[],
    };
  });

export const adminUpsertShopItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AdminUpsertShopItemInput) => {
    if (!input?.name?.trim()) throw new Error("Name is required");
    if (typeof input.priceXCoins !== "number" || input.priceXCoins < 0) {
      throw new Error("Invalid price");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const email = emailFromClaims(
      (context as { claims?: unknown }).claims,
    );
    if (!masterEmailAllowed(email)) {
      throw new Error("Not authorised to manage the shop");
    }

    const row: Record<string, unknown> = {
      category_id: data.categoryId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      price_x_coins: Math.round(data.priceXCoins),
      metadata: data.metadata,
      available: data.available !== false,
      unique_ownership: data.uniqueOwnership !== false,
      item_key: data.itemKey?.trim() || null,
    };
    if (data.previewUrl) row.preview_url = data.previewUrl;

    if (data.itemId) {
      const { data: updated, error } = await gamingSupabaseAdmin
        .from("shop_items")
        .update(row)
        .eq("item_id", data.itemId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { item: updated as ShopItem };
    }

    const { data: created, error } = await gamingSupabaseAdmin
      .from("shop_items")
      .insert(row)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { item: created as ShopItem };
  });

export const adminSetShopItemAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string; available: boolean }) => {
    if (!input?.itemId) throw new Error("itemId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const email = emailFromClaims(
      (context as { claims?: unknown }).claims,
    );
    if (!masterEmailAllowed(email)) {
      throw new Error("Not authorised");
    }
    const { error } = await gamingSupabaseAdmin
      .from("shop_items")
      .update({ available: data.available })
      .eq("item_id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AdminUploadShopMediaInput = {
  /** base64 without data: prefix */
  fileBase64: string;
  fileName: string;
  contentType: string;
};

/**
 * Upload image/video from admin device to gaming Storage bucket shop-media.
 * Uses service role (browser is not logged into gaming Supabase).
 */
export const adminUploadShopMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AdminUploadShopMediaInput) => {
    if (!input?.fileBase64 || !input?.fileName) {
      throw new Error("File is required");
    }
    const ct = String(input.contentType || "").toLowerCase();
    const ok =
      ct.startsWith("image/") ||
      ct.startsWith("video/") ||
      !ct;
    if (!ok) throw new Error("Only images and videos are allowed");
    const isVideo = String(input.contentType || "").toLowerCase().startsWith("video/");
    // base64 is ~4/3 of binary size
    const maxB64 = isVideo ? 42_000_000 : 14_000_000; // ~30MB video, ~10MB image
    if (input.fileBase64.length > maxB64) {
      throw new Error(
        isVideo
          ? "Video too large (max 30MB for live wallpaper)"
          : "Image too large (max 10MB)",
      );
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const email = emailFromClaims(
      (context as { claims?: unknown }).claims,
    );
    if (!masterEmailAllowed(email)) {
      throw new Error("Not authorised to upload shop media");
    }

    const safeName = data.fileName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 80);
    const path = `packs/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

    const buffer = Buffer.from(data.fileBase64, "base64");
    const { error } = await gamingSupabaseAdmin.storage
      .from("shop-media")
      .upload(path, buffer, {
        contentType: data.contentType || "application/octet-stream",
        upsert: false,
      });
    if (error) throw new Error(error.message);

    const { data: pub } = gamingSupabaseAdmin.storage
      .from("shop-media")
      .getPublicUrl(path);

    return {
      path,
      url: pub.publicUrl as string,
      kind: (data.contentType || "").startsWith("video/")
        ? ("video" as const)
        : ("image" as const),
    };
  });
