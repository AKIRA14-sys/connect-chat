/**
 * Xender-style nearby transfer (PRIMARY for APK).
 *
 * Design:
 * - Android: Wi‑Fi / local hotspot / same LAN → HTTP upload to peer
 * - Discovery: mDNS-style name + 6-digit code (no mobile data required for bytes)
 * - Cloud link remains separate (existing transfer.functions / short /d/code)
 *
 * WebRTC is NOT the primary path for nearby anymore.
 * Web fallback: existing WebRTC in fileTransfer.ts only when !isNative().
 */

import { isNative, isAndroid } from "./platform";

export type NearbyPeer = {
  id: string;
  name: string;
  code?: string;
};

export type NearbyProgress = {
  sent: number;
  total: number;
  pct: number;
};

const SERVICE = "xuppin-nearby";

/** Whether native Xender-style stack is available */
export function isXenderNearbyAvailable(): boolean {
  return isAndroid() && isNative();
}

/**
 * Start advertising this device as a receiver (host).
 * Native implementation will open a local HTTP server on LAN.
 * Until the Kotlin plugin is linked, this throws a clear message.
 */
export async function startNearbyHost(opts: {
  deviceName: string;
  code: string;
  onFile: (file: { name: string; blob: Blob }) => void;
  onProgress?: (p: NearbyProgress) => void;
}): Promise<{ stop: () => void }> {
  if (!isXenderNearbyAvailable()) {
    throw new Error(
      "Xender-style nearby requires the Android APK. Use Cloud link on web, or install the APK.",
    );
  }

  // Bridge to Capacitor plugin name "XuppinNearby" (Kotlin — see android docs)
  try {
    const { registerPlugin } = await import("@capacitor/core");
    const XuppinNearby = registerPlugin<{
      startHost: (o: { deviceName: string; code: string }) => Promise<void>;
      stopHost: () => Promise<void>;
    }>("XuppinNearby");

    await XuppinNearby.startHost({
      deviceName: opts.deviceName,
      code: opts.code,
    });

    return {
      stop: () => {
        void XuppinNearby.stopHost();
      },
    };
  } catch {
    throw new Error(
      "Nearby plugin not linked yet. Run cap sync after adding android/ native module XuppinNearby.",
    );
  }
}

export async function sendNearbyXender(opts: {
  code: string;
  file: File;
  onProgress?: (p: NearbyProgress) => void;
}): Promise<void> {
  if (!isXenderNearbyAvailable()) {
    throw new Error(
      "Xender-style send requires the Android APK. On web use the older Nearby (WebRTC) or Cloud link.",
    );
  }

  const { registerPlugin } = await import("@capacitor/core");
  const XuppinNearby = registerPlugin<{
    sendFile: (o: {
      code: string;
      path: string;
      name: string;
    }) => Promise<void>;
  }>("XuppinNearby");

  // Write file to cache via Filesystem then pass path — simplified interface
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const buf = await opts.file.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const path = `nearby-out/${Date.now()}_${opts.file.name}`;
  await Filesystem.writeFile({
    path,
    data: b64,
    directory: Directory.Cache,
  });

  opts.onProgress?.({ sent: 0, total: opts.file.size, pct: 0 });
  await XuppinNearby.sendFile({
    code: opts.code,
    path,
    name: opts.file.name,
  });
  opts.onProgress?.({
    sent: opts.file.size,
    total: opts.file.size,
    pct: 100,
  });
}
