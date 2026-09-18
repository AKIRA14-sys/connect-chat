import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gamingSupabaseAdmin } from "@/integrations/gaming-supabase/client.server";
import type { ShopCategory, ShopItem } from "@/lib/gaming.functions";

function masterEmailAllowed(claimsEmail: string | undefined): boolean {
  const allowed = String(
    process.env["MASTER_ADMIN_EMAIL"] ||
      process.env["VITE_MASTER_ADMIN_EMAIL"] ||
      "",
  )
    .trim()
    .toLowerCase();
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

function base64ToBuffer(fileBase64: string): Buffer {
  return Buffer.from(fileBase64, "base64");
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

export const adminListShopCatalog = createServerFn({
  method: "POST",
})
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
    if (catRes.error) {
      throw new Error(catRes.error.message);
    }
    if (itemRes.error) {
      throw new Error(itemRes.error.message);
    }
    return {
      categories: (catRes.data ?? []) as ShopCategory[],
      items: (itemRes.data ?? []) as ShopItem[],
    };
  });

export const adminUpsertShopItem = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AdminUpsertShopItemInput) => {
    if (!input || typeof input !== "object") {
      throw new Error("Invalid input");
    }
    if (!input.name || !String(input.name).trim()) {
      throw new Error("Name is required");
    }
    if (typeof input.priceXCoins !== "number" || input.priceXCoins < 0) {
      throw new Error("Invalid price");
    }
    return {
      itemId: input.itemId ?? null,
      categoryId: input.categoryId ?? null,
      name: String(input.name).trim(),
      description: input.description ?? null,
      priceXCoins: input.priceXCoins,
      available: input.available !== false,
      uniqueOwnership: input.uniqueOwnership !== false,
      itemKey: input.itemKey ?? null,
      metadata: input.metadata && typeof input.metadata === "object"
        ? input.metadata
        : {},
      previewUrl: input.previewUrl ?? null,
    };
  })
  .handler(async ({ data, context }) => {
    const email = emailFromClaims(
      (context as { claims?: unknown }).claims,
    );
    if (!masterEmailAllowed(email)) {
      throw new Error("Not authorised to manage the shop");
    }

    // item_key is NOT NULL in shop_items — always provide a non-null value
    const slug =
      data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "item";
    const itemKey =
      (typeof data.itemKey === "string" && data.itemKey.trim()
        ? data.itemKey.trim()
        : "") ||
      (data.itemId ? `item-${data.itemId}` : `${slug}-${randomUUID().slice(0, 8)}`);

    const row: Record<string, unknown> = {
      category_id: data.categoryId,
      name: data.name,
      description:
        typeof data.description === "string" && data.description.trim()
          ? data.description.trim()
          : null,
      price_x_coins: Math.round(data.priceXCoins),
      metadata: data.metadata,
      available: data.available !== false,
      unique_ownership: data.uniqueOwnership !== false,
      item_key: itemKey,
    };
    if (data.previewUrl) {
      row.preview_url = data.previewUrl;
    }

    if (data.itemId) {
      const { data: updated, error } = await gamingSupabaseAdmin
        .from("shop_items")
        .update(row)
        .eq("item_id", data.itemId)
        .select(
          "item_id, category_id, item_key, name, description, price_x_coins, metadata, available, unique_ownership",
        )
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { item: updated as ShopItem };
    }

    const { data: created, error } = await gamingSupabaseAdmin
      .from("shop_items")
      .insert(row)
      .select(
        "item_id, category_id, item_key, name, description, price_x_coins, metadata, available, unique_ownership",
      )
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { item: created as ShopItem };
  });

export const adminSetShopItemAvailable = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string; available: boolean }) => {
    if (!input || !input.itemId) {
      throw new Error("itemId required");
    }
    return {
      itemId: String(input.itemId),
      available: Boolean(input.available),
    };
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
    return { ok: true as const };
  });

export type AdminUploadShopMediaInput = {
  fileBase64: string;
  fileName: string;
  contentType: string;
};

export const adminUploadShopMedia = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AdminUploadShopMediaInput) => {
    if (!input?.fileBase64 || !input?.fileName) {
      throw new Error("File is required");
    }
    const ct = String(input.contentType || "").toLowerCase();
    if (ct && !ct.startsWith("image/") && !ct.startsWith("video/")) {
      throw new Error("Only images and videos are allowed");
    }
    const isVideo = ct.startsWith("video/");
    const maxB64 = isVideo ? 42_000_000 : 14_000_000;
    if (input.fileBase64.length > maxB64) {
      throw new Error(
        isVideo
          ? "Video too large (max 30MB for live wallpaper)"
          : "Image too large (max 10MB)",
      );
    }
    return {
      fileBase64: input.fileBase64,
      fileName: String(input.fileName),
      contentType: ct || "application/octet-stream",
    };
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
    const path = `packs/${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`;
    const buffer = base64ToBuffer(data.fileBase64);

    const { error } = await gamingSupabaseAdmin.storage
      .from("shop-media")
      .upload(path, buffer, {
        contentType: data.contentType,
        upsert: false,
      });
    if (error) {
      throw new Error(error.message);
    }

    const { data: pub } = gamingSupabaseAdmin.storage
      .from("shop-media")
      .getPublicUrl(path);

    const kind = data.contentType.startsWith("video/")
      ? ("video" as const)
      : ("image" as const);

    return {
      path,
      url: String(pub.publicUrl),
      kind,
    };
  });
