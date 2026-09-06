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

export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isNative()) {
    try {
      const bio = await nativeBio();
      if (!bio) return false;
      const r = await bio.checkBiometry();
      return r?.isAvailable === true;
    } catch {
      return false;
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
