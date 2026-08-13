// src/lib/webpush.server.ts
// Web Push using WebCrypto + VAPID - FIXED.
// Server-only: do not import this file into client-side code.

const encoder = new TextEncoder();

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);

  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

async function hmacSha256(
  keyBytes: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    data as BufferSource,
  );

  return new Uint8Array(signature);
}

function createVapidJwk(
  publicKey: string,
  privateKey: string,
): JsonWebKey {
  const publicBytes = base64UrlToBytes(publicKey);

  if (publicBytes.length !== 65 || publicBytes[0] !== 4) {
    throw new Error("Invalid VAPID public key");
  }

  return {
    kty: "EC",
    crv: "P-256",
    x: bytesToBase64Url(publicBytes.slice(1, 33)),
    y: bytesToBase64Url(publicBytes.slice(33, 65)),
    d: privateKey,
    ext: true,
  };
}

async function createVapidAuthorization(
  endpoint: string,
  publicKey: string,
  privateKey: string,
  subject: string,
): Promise<string> {
  const audience = new URL(endpoint).origin;

  const header = bytesToBase64Url(
    encoder.encode(
      JSON.stringify({
        typ: "JWT",
        alg: "ES256",
      }),
    ),
  );

  const payload = bytesToBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  );

  const signingInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "jwk",
    createVapidJwk(publicKey, privateKey),
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256",
    },
    key,
    encoder.encode(signingInput),
  );

  return `vapid t=${signingInput}.${bytesToBase64Url(
    new Uint8Array(signature),
  )}, k=${publicKey}`;
}

async function encryptPayload(
  payload: string,
  p256dh: string,
  authSecret: string,
): Promise<Uint8Array> {
  const clientPublicKey = base64UrlToBytes(p256dh);
  const auth = base64UrlToBytes(authSecret);

  if (clientPublicKey.length !== 65) {
    throw new Error("Invalid push subscription public key");
  }

  const ephemeralKeyPair = await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveBits"],
  );

  const ephemeralPublicKey = new Uint8Array(
    await crypto.subtle.exportKey(
      "raw",
      ephemeralKeyPair.publicKey,
    ),
  );

  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey as BufferSource,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    [],
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "ECDH",
        public: clientKey,
      },
      ephemeralKeyPair.privateKey,
      256,
    ),
  );

  const prk = await hmacSha256(auth, sharedSecret);

  const info = concatBytes(
    encoder.encode("WebPush: info\0"),
    clientPublicKey,
    ephemeralPublicKey,
    new Uint8Array([1]),
  );

  const ikm = await hmacSha256(prk, info);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const contentPrk = await hmacSha256(salt, ikm);

  const cek = (
    await hmacSha256(
      contentPrk,
      concatBytes(
        encoder.encode("Content-Encoding: aes128gcm\0"),
        new Uint8Array([1]),
      ),
    )
  ).slice(0, 16);

  const nonce = (
    await hmacSha256(
      contentPrk,
      concatBytes(
        encoder.encode("Content-Encoding: nonce\0"),
        new Uint8Array([1]),
      ),
    )
  ).slice(0, 12);

  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek as BufferSource,
    {
      name: "AES-GCM",
    },
    false,
    ["encrypt"],
  );

  const plaintext = concatBytes(
    encoder.encode(payload),
    new Uint8Array([2]),
  );

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonce as BufferSource,
      },
      aesKey,
      plaintext as BufferSource,
    ),
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);

  return concatBytes(
    salt,
    recordSize,
    new Uint8Array([ephemeralPublicKey.length]),
    ephemeralPublicKey,
    encrypted,
  );
}

export type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendWebPush(
  target: PushTarget,
  payload: unknown,
): Promise<{ expired: boolean }> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT ?? "mailto:push@whatsxup.app";

  if (!publicKey || !privateKey) {
    throw new Error(
      `Missing VAPID environment variables: ${
        !publicKey ? "VAPID_PUBLIC_KEY " : ""
      }${!privateKey ? "VAPID_PRIVATE_KEY" : ""}`.trim(),
    );
  }

  const body = await encryptPayload(
    JSON.stringify(payload),
    target.p256dh,
    target.auth,
  );

  const authorization = await createVapidAuthorization(
    target.endpoint,
    publicKey,
    privateKey,
    subject,
  );

  const response = await fetch(target.endpoint, {
    method: "POST",

    headers: {
      Authorization: authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },

    body: body as BodyInit,
  });

  if (response.status === 404 || response.status === 410) {
    return {
      expired: true,
    };
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    throw new Error(
      `Web Push failed: HTTP ${response.status} ${response.statusText}${
        errorText ? ` - ${errorText}` : ""
      }`,
    );
  }

  return {
    expired: false,
  };
}
