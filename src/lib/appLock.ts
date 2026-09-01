// src/lib/appLock.ts
// Local PIN lock for the PWA (no Supabase).

const ENABLED_KEY = "xuppin-app-lock-enabled";
const PIN_KEY = "xuppin-app-lock-pin";
const UNLOCKED_KEY = "xuppin-app-lock-unlocked";
const LAST_ACTIVE_KEY = "xuppin-app-lock-last-active";
const TIMEOUT_KEY = "xuppin-app-lock-timeout-min";

/** Simple non-crypto hash — enough to avoid plain PIN in storage */
export function hashPin(pin: string): string {
  let h = 2166136261;
  for (let i = 0; i < pin.length; i++) {
    h ^= pin.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h${(h >>> 0).toString(16)}`;
}

export function isAppLockEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAppLockEnabled(on: boolean) {
  localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
  if (!on) {
    sessionStorage.setItem(UNLOCKED_KEY, "1");
  }
}

export function hasPinSet(): boolean {
  try {
    return Boolean(localStorage.getItem(PIN_KEY));
  } catch {
    return false;
  }
}

export function setPin(pin: string) {
  const clean = pin.replace(/\D/g, "");
  if (clean.length < 4 || clean.length > 8) {
    throw new Error("PIN must be 4–8 digits");
  }
  localStorage.setItem(PIN_KEY, hashPin(clean));
  setAppLockEnabled(true);
  sessionStorage.setItem(UNLOCKED_KEY, "1");
  touchActivity();
}

export function verifyPin(pin: string): boolean {
  const stored = localStorage.getItem(PIN_KEY);
  if (!stored) return false;
  return stored === hashPin(pin.replace(/\D/g, ""));
}

export function unlockWithPin(pin: string): boolean {
  if (!verifyPin(pin)) return false;
  sessionStorage.setItem(UNLOCKED_KEY, "1");
  touchActivity();
  return true;
}

export function lockNow() {
  sessionStorage.removeItem(UNLOCKED_KEY);
}

export function isUnlocked(): boolean {
  if (!isAppLockEnabled() || !hasPinSet()) return true;
  return sessionStorage.getItem(UNLOCKED_KEY) === "1";
}

export function getLockTimeoutMin(): number {
  try {
    const n = Number(localStorage.getItem(TIMEOUT_KEY) || "1");
    return Number.isFinite(n) && n >= 0 ? n : 1;
  } catch {
    return 1;
  }
}

export function setLockTimeoutMin(min: number) {
  localStorage.setItem(TIMEOUT_KEY, String(Math.max(0, Math.min(60, min))));
}

export function touchActivity() {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Re-lock if backgrounded longer than timeout (0 = lock as soon as app hides) */
export function shouldRelockFromBackground(): boolean {
  if (!isAppLockEnabled() || !hasPinSet()) return false;
  const timeoutMin = getLockTimeoutMin();
  try {
    const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) || "0");
    if (!last) return true;
    const elapsed = Date.now() - last;
    return elapsed >= timeoutMin * 60 * 1000;
  } catch {
    return true;
  }
}

export function clearAppLock() {
  localStorage.removeItem(ENABLED_KEY);
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(TIMEOUT_KEY);
  sessionStorage.removeItem(UNLOCKED_KEY);
}
