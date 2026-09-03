import { isNative } from "./platform";

/**
 * Biometric unlock for App Lock.
 * Uses WebAuthn/platform authenticator when available; native APK can swap in
 * a Capacitor biometrics plugin without changing callers.
 *
 * Backend remains Supabase — no Firebase Auth.
 */

export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (!window.PublicKeyCredential) return false;
    const ok =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
    return Boolean(ok);
  } catch {
    return isNative(); // may still have device biometrics via future plugin
  }
}

/**
 * Prompt user verification (fingerprint / face / device credential).
 * Returns true if verified. Falls back to false (caller uses PIN).
 */
export async function authenticateBiometric(
  reason = "Unlock XUPPIN",
): Promise<boolean> {
  try {
    // Lightweight user-verification challenge via WebAuthn if credential exists.
    // First-time setup stores a local flag; full credential registration is optional.
    if (!window.PublicKeyCredential) return false;

    // Without a stored credential, we cannot complete WebAuthn.
    // Native Wave B can inject @capgo/capacitor-native-biometric here.
    const flag = localStorage.getItem("xuppin-biometric-ready");
    if (flag !== "1") {
      // Mark "available to enable" only — actual enroll in Settings
      return false;
    }

    // Placeholder: successful path when native plugin is wired
    return false;
  } catch {
    return false;
  }
}

export function setBiometricEnabled(on: boolean) {
  localStorage.setItem("xuppin-biometric-enabled", on ? "1" : "0");
}

export function isBiometricEnabled(): boolean {
  return localStorage.getItem("xuppin-biometric-enabled") === "1";
}
