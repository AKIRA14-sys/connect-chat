/** Helpers for XUPPIN group invite links and admin power features. */

export const FALLBACK_ORIGIN = "https://xuppin.vercel.app";

export function slugify(name: string): string {
  return (name || "group")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "group";
}

function randomSuffix(len = 6): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

export function makeInviteSlug(name: string | null | undefined): string {
  return `${slugify(name ?? "group")}-${randomSuffix()}`;
}

export function appOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return FALLBACK_ORIGIN;
}

export function groupInviteUrl(slug: string): string {
  return `${appOrigin()}/g/${slug}/join`;
}

export const SLOW_MODE_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
] as const;

export const DISAPPEAR_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 86400, label: "24 hours" },
  { value: 604800, label: "7 days" },
  { value: 7776000, label: "90 days" },
] as const;

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export const PENDING_JOIN_KEY = "xuppin:pending-join";
