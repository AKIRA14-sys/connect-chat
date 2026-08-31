import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gamingSupabaseAdmin } from "@/integrations/gaming-supabase/client.server";

const BUCKET = "transfers";
const MAX_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
const SIGNED_SECS = 60 * 60 * 24 * 7;

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

export const beginGamingTransferUpload = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BeginTransferUploadInput) => {
    if (!input || typeof input !== "object" || !input.fileName) {
      throw new Error("Invalid upload request");
    }
    if (typeof input.size !== "number" || input.size <= 0) {
      throw new Error("Invalid file size");
    }
    if (input.size > MAX_BYTES) {
      throw new Error("File too large for cloud transfer (max 5GB).");
    }
    return {
      fileName: String(input.fileName),
      contentType: String(input.contentType || "application/octet-stream"),
      size: input.size,
    };
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const path = `transfers/${userId}/${crypto.randomUUID()}_${safeName(data.fileName)}`;

    const { data: signed, error } = await gamingSupabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !signed?.signedUrl) {
      throw new Error(
        error?.message ??
          'Could not create upload URL. Create private bucket "transfers" on Gaming Supabase.',
      );
    }

    return {
      path,
      token: signed.token as string,
      signedUrl: signed.signedUrl as string,
      bucket: BUCKET,
    };
  });

export const finishGamingTransferUpload = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: FinishTransferUploadInput) => {
    if (!input || typeof input !== "object" || !input.path) {
      throw new Error("Missing path");
    }
    return { path: String(input.path) };
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
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
      url: signed.signedUrl as string,
      path: data.path,
      expiresIn: SIGNED_SECS,
    };
  });
