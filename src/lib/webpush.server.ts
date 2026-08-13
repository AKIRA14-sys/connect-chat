// Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) implemented on WebCrypto so it
// runs inside the edge worker runtime. Server-only: never import from the client.

const enc = new TextEncoder();

function b64urlToBytes(input: string): Uint8Array {
  const pad = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = pad + "=".repeat((4 - (pad.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data as BufferSource));
}

function vapidJwk(publicKey: string, privateKey: string): JsonWebKey {
  const pub = b64urlToBytes(publicKey);
  return {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: privateKey,
    ext: true,
  };
}

async function vapidHeader(endpoint: string, publicKey: string, privateKey: string, subject: string) {
  const audience = new URL(endpoint).origin;
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = bytesToB64url(
    enc.encode(
      JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }),
    ),
  );
  const signingInput = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    "jwk",
    vapidJwk(publicKey, privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signingInput)),
  );
  return `vapid t=${signingInput}.${bytesToB64url(sig)}, k=${publicKey}`;
}

async function encryptPayload(payload: string, p256dh: string, authSecret: string): Promise<Uint8Array> {
  const clientPublic = b64urlToBytes(p256dh);
  const auth = b64urlToBytes(authSecret);

  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublic as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, ephemeral.privateKey, 256),
  );

  const prkKey = await hmac(auth, shared);
  const keyInfo = concat(enc.encode("WebPush: info\0"), clientPublic, asPublic, new Uint8Array([1]));
  const ikm = await hmac(prkKey, keyInfo);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const record = concat(enc.encode(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, record as BufferSource),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** Returns true when the subscription is gone (404/410) and should be deleted. */
export async function sendWebPush(target: PushTarget, payload: unknown): Promise<{ expired: boolean }> {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:push@whatsxup.app";
  if (!publicKey || !privateKey) {
  throw new Error(
    `Missing VAPID environment variables: ${
      !publicKey ? "VAPID_PUBLIC_KEY " : ""
    }${!privateKey ? "VAPID_PRIVATE_KEY" : ""}`.trim(),
  );
}

  const body = await encryptPayload(JSON.stringify(payload), target.p256dh, target.auth);
  const authorization = await vapidHeader(target.endpoint, publicKey, privateKey, subject);

  const res = await fetch(target.endpoint, {
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

  return { expired: res.status === 404 || res.status === 410 };
}
