import { isNative } from "./platform";

/**
 * Biometric unlock for App Lock.
 * Native APK: device fingerprint / face via native biometric plugin.
 * Web: platform authenticator probe (PIN remains the fallback everywhere).
 */

async function nativeBio(): Promise<{
  checkBiometry: () => Promise<{ isAvailable?: boolean }>;
  authenticate: (options?: Record<string, unknown>) => Promise<void>;
} | null> {
  try {
    const mod = await import("@aparajita/capacitor-biometric-auth");
    return mod.BiometricAuth ?? null;
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    p,
    new Promise<undefined>((resolve) => window.setTimeout(() => resolve(undefined), ms)),
  ]);
}

export async function isBiometricAvailable(): Promise<boolean> {
  return (await getBiometryStatus()).available;
}

/** Availability plus the plugin's own reason/code when unavailable. */
export async function getBiometryStatus(): Promise<{
  available: boolean;
  reason?: string;
  code?: string;
}> {
  if (typeof window === "undefined") return { available: false };
  if (isNative()) {
    try {
      const bio = await withTimeout(nativeBio(), 6000);
      if (!bio) return { available: false, reason: "plugin missing in APK" };
      const r = (await withTimeout(bio.checkBiometry(), 6000)) as
        | {
            isAvailable?: boolean;
            reason?: string;
            code?: string | number;
            biometryType?: string | number;
          }
        | undefined;
      if (!r) return { available: false, reason: "check timed out" };
      if (r.isAvailable === true) return { available: true };
      return {
        available: false,
        reason: r.reason || "unknown",
        code: r.code != null ? String(r.code) : undefined,
      };
    } catch {
      return { available: false, reason: "check threw" };
    }
  }
  try {
    if (!window.PublicKeyCredential) return false;
    const ok =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
    return Boolean(ok);
  } catch {
    return false;
  }
}

/**
 * Prompt user verification (fingerprint / face / device credential).
 * Returns true if verified. Caller falls back to PIN on false.
 */
export async function authenticateBiometric(
  reason = "Unlock XUPPIN",
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isNative()) {
    try {
      const bio = await nativeBio();
      if (!bio) return false;
      await bio.authenticate({
        reason,
        allowDeviceCredential: true,
        cancelTitle: "Use PIN",
      });
      return true;
    } catch {
      return false; // user cancelled, locked out, or no hardware
    }
  }
  return false; // web: PIN only for now
}

const ENABLED_KEY = "xuppin-biometric-enabled";

export function setBiometricEnabled(on: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}
