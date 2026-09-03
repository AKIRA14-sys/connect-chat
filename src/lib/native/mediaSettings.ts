/** Local preferences for media download / gallery — Tier 2 */

const PREFIX = "xuppin-media-";

export type AutoDownloadKind = "photos" | "videos" | "documents" | "voice";

export type NetworkBucket = "wifi" | "mobile";

export function getAutoDownload(
  network: NetworkBucket,
  kind: AutoDownloadKind,
): boolean {
  const raw = localStorage.getItem(`${PREFIX}auto-${network}-${kind}`);
  if (raw === null) {
    // defaults: wifi all on, mobile photos+voice on
    if (network === "wifi") return true;
    return kind === "photos" || kind === "voice";
  }
  return raw === "1";
}

export function setAutoDownload(
  network: NetworkBucket,
  kind: AutoDownloadKind,
  on: boolean,
) {
  localStorage.setItem(`${PREFIX}auto-${network}-${kind}`, on ? "1" : "0");
}

export function getSaveToGallery(): boolean {
  return localStorage.getItem(`${PREFIX}save-gallery`) === "1";
}

export function setSaveToGallery(on: boolean) {
  localStorage.setItem(`${PREFIX}save-gallery`, on ? "1" : "0");
}

export function getDownloadBeforeView(): boolean {
  return localStorage.getItem(`${PREFIX}download-before-view`) === "1";
}

export function setDownloadBeforeView(on: boolean) {
  localStorage.setItem(`${PREFIX}download-before-view`, on ? "1" : "0");
}

export function getCacheLimitMb(): number {
  const n = Number(localStorage.getItem(`${PREFIX}cache-mb`) || "500");
  return Number.isFinite(n) ? n : 500;
}

export function setCacheLimitMb(mb: number) {
  localStorage.setItem(`${PREFIX}cache-mb`, String(mb));
}
