import { supabase } from "@/integrations/supabase/client";

export type AccountStatus = "active" | "suspended" | "banned";
export type MsgType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "sticker"
  | "system";
export type MemberRole = "owner" | "admin" | "member";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string;
  show_online_status: boolean;
  show_read_receipts: boolean;
  discoverable: boolean;
  status: AccountStatus;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MsgType;
  content: string | null;
  media_url: string | null;
  media_duration: number | null;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  only_admins_add_members: boolean;
  only_admins_edit_info: boolean;
  is_suspended: boolean;
  last_message_at: string;
};

const signedCache = new Map<string, { url: string; expires: number }>();

export async function signedUrl(bucket: string, path: string | null): Promise<string | null> {
  if (!path) return null;
  const key = `${bucket}/${path}`;
  const hit = signedCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data) return null;
  signedCache.set(key, { url: data.signedUrl, expires: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

export function extensionFor(file: File | Blob, fallback: string) {
  const name = "name" in file ? (file as File).name : "";
  const fromName = name.includes(".") ? name.split(".").pop() : null;
  return (fromName ?? fallback).toLowerCase();
}

export async function uploadChatMedia(conversationId: string, file: File | Blob, fallbackExt: string) {
  const path = `${conversationId}/${crypto.randomUUID()}.${extensionFor(file, fallbackExt)}`;
  const { error } = await supabase.storage.from("chat-media").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function uploadAvatar(userId: string, file: File) {
  const path = `${userId}/${crypto.randomUUID()}.${extensionFor(file, "jpg")}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

export function durationLabel(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function lastSeenLabel(iso: string | null | undefined) {
  if (!iso) return "offline";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 90) return "last seen just now";
  if (diff < 3600) return `last seen ${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `last seen ${Math.round(diff / 3600)}h ago`;
  return `last seen ${timeLabel(iso)}`;
}
