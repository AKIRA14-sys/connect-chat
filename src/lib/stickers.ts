export type Sticker = {
  id: string;
  emoji: string;
  label: string;
  pack: string;
};

/** Common emoji stickers (Android-style set for the picker). */
export const STICKERS: Sticker[] = [
  { id: "love", emoji: "🥰", label: "Love", pack: "Cute" },
  { id: "kiss", emoji: "😘", label: "Kiss", pack: "Cute" },
  { id: "heart", emoji: "❤️", label: "Heart", pack: "Cute" },
  { id: "hug", emoji: "🤗", label: "Hug", pack: "Cute" },
  { id: "sparkle", emoji: "✨", label: "Sparkle", pack: "Cute" },
  { id: "blush", emoji: "😊", label: "Smile", pack: "Cute" },
  { id: "laugh", emoji: "😂", label: "Laugh", pack: "Funny" },
  { id: "lol", emoji: "🤣", label: "LOL", pack: "Funny" },
  { id: "dead", emoji: "💀", label: "Dead", pack: "Funny" },
  { id: "sus", emoji: "🤨", label: "Sus", pack: "Funny" },
  { id: "think", emoji: "🤔", label: "Think", pack: "Funny" },
  { id: "cool", emoji: "😎", label: "Cool", pack: "Funny" },
  { id: "fire", emoji: "🔥", label: "Fire", pack: "Reactions" },
  { id: "goat", emoji: "🐐", label: "GOAT", pack: "Reactions" },
  { id: "clap", emoji: "👏", label: "Clap", pack: "Reactions" },
  { id: "ok", emoji: "👌", label: "OK", pack: "Reactions" },
  { id: "thumbs", emoji: "👍", label: "Yes", pack: "Reactions" },
  { id: "pray", emoji: "🙏", label: "Thanks", pack: "Reactions" },
  { id: "party", emoji: "🥳", label: "Party", pack: "Party" },
  { id: "tada", emoji: "🎉", label: "Tada", pack: "Party" },
  { id: "rocket", emoji: "🚀", label: "Rocket", pack: "Party" },
  { id: "star", emoji: "⭐", label: "Star", pack: "Party" },
  { id: "cry", emoji: "😢", label: "Sad", pack: "Feelings" },
  { id: "angry", emoji: "😠", label: "Mad", pack: "Feelings" },
  { id: "wow", emoji: "😮", label: "Wow", pack: "Feelings" },
  { id: "sleepy", emoji: "😴", label: "Sleepy", pack: "Feelings" },
];

export const STICKER_PACKS = [
  "All",
  "Cute",
  "Funny",
  "Reactions",
  "Party",
  "Feelings",
] as const;

export function getStickerById(id: string | null | undefined): Sticker | null {
  if (!id) return null;
  return STICKERS.find((s) => s.id === id) ?? null;
}

export function getStickerByEmoji(emoji: string | null | undefined): Sticker | null {
  if (!emoji) return null;
  const trimmed = emoji.trim();
  return STICKERS.find((s) => s.emoji === trimmed) ?? null;
}

/** True when the whole string is a single emoji (no other letters/words). */
export function isSoloEmoji(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 16) return false;
  // Reject if any letter or digit
  if (/\p{L}|\p{N}/u.test(t)) return false;
  // Must contain at least one emoji-ish symbol
  if (!/\p{Extended_Pictographic}|[\u2600-\u27BF]/u.test(t)) return false;
  // Allow one emoji (with optional variation selector / ZWJ sequences)
  const withoutVs = t.replace(/\uFE0F/g, "");
  // Rough: not multiple separate emoji if too many pictographics
  const pics = t.match(/\p{Extended_Pictographic}/gu) ?? [];
  return pics.length >= 1 && pics.length <= 3 && t.length <= 16;
}
