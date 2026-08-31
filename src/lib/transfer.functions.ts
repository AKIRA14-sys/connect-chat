// src/lib/transfer.functions.ts
// Cloud transfer uses GAMING Supabase Storage (service role on server).
// Auth is still your main chat login via requireSupabaseAuth.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gamingSupabaseAdmin } from "@/integrations/gaming-supabase/client.server";

const BUCKET = "transfers";
const MAX_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
const SIGNED_SECS = 60 * 60 * 24 * 7; // 7 days

export type BeginTransferUploadInput = {
  fileName: string;
  contentType: string;
  size: number;
};

export type FinishTransferUploadInput = {
  path: string;
};

function safeName(name: string) {
  return name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 120) || "file";
}

/**
 * Returns a signed upload target on the gaming bucket.
 * Browser PUTs the file bytes directly (no main Supabase).
 */
export const beginGamingTransferUpload = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BeginTransferUploadInput) => {
    if (!input?.fileName || typeof input.size !== "number") {
      throw new Error("Invalid upload request");
    }
    if (input.size <= 0 || input.size > MAX_BYTES) {
      throw new Error("File too large for cloud transfer (max 5GB).");
    }
    return input;
  })
  .handler(async ({ context, data }) => {
    const userId = context.user.id;
    const path = `transfers/${userId}/${crypto.randomUUID()}_${safeName(data.fileName)}`;

    // Ensure bucket exists is a dashboard/SQL step; upload via signed URL
    const { data: signed, error } = await gamingSupabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !signed) {
      throw new Error(
        error?.message ??
          "Could not create upload URL. Create bucket `transfers` on gaming Supabase and run storage policies.",
      );
    }

    return {
      path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      bucket: BUCKET,
    };
  });

/**
 * After browser upload succeeds, create a 7-day download link.
 */
export const finishGamingTransferUpload = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: FinishTransferUploadInput) => {
    if (!input?.path || typeof input.path !== "string") {
      throw new Error("Missing path");
    }
    // Must be under this user's folder
    return input;
  })
  .handler(async ({ context, data }) => {
    const userId = context.user.id;
    const prefix = `transfers/${userId}/`;
    if (!data.path.startsWith(prefix)) {
      throw new Error("Invalid transfer path");
    }

    const { data: signed, error } = await gamingSupabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.path, SIGNED_SECS);

    if (error || !signed?.signedUrl) {
      throw new Error(error?.message ?? "Could not create download link");
    }

    return {
      url: signed.signedUrl,
      path: data.path,
      expiresIn: SIGNED_SECS,
    };
  });