import { migrateLegacyOfflineCache } from "@/lib/offlineCache";

export function initOfflineViewing() {
  if (typeof window === "undefined") return;
  migrateLegacyOfflineCache();
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.getRegistration().then((r) => r?.update());
  }
}
