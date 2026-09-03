import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { isNative } from "./platform";

const KEY = "xuppin-haptics";

export function isHapticsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean) {
  localStorage.setItem(KEY, on ? "1" : "0");
}

export async function hapticLight() {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch {
    /* ignore */
  }
}

export async function hapticMedium() {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (navigator.vibrate) {
      navigator.vibrate(20);
    }
  } catch {
    /* ignore */
  }
}
