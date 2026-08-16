export type Sticker = {
  id: string;
  emoji: string;
  label: string;
  pack: string;
};

export const STICKERS: Sticker[] = [
  { id: "love", emoji: "🥰", label: "Love", pack: "Cute" },
  { id: "kiss", emoji: "😘", label: "Kiss", pack: "Cute" },
  { id: "heart", emoji: "❤️", label: "Heart", pack: "Cute" },
  { id: "hug", emoji: "🤗", label: "Hug", pack: "Cute" },
  { id: "laugh", emoji: "😂", label: "Laugh", pack: "Funny" },
  { id: "lol", emoji: "🤣", label: "LOL", pack: "Funny" },
  { id: "dead", emoji: "💀", label: "Dead", pack: "Funny" },
  { id: "sus", emoji: "🤨", label: "Sus", pack: "Funny" },
  { id: "fire", emoji: "🔥", label: "Fire", pack: "Reactions" },
  { id: "goat", emoji: "🐐", label: "GOAT", pack: "Reactions" },
  { id: "clap", emoji: "👏", label: "Clap", pack: "Reactions" },
  { id: "party", emoji: "🎉", label: "Party", pack: "Reactions" },
  { id: "power", emoji: "⚡", label: "Power", pack: "Anime" },
  { id: "angry", emoji: "😤", label: "Angry", pack: "Anime" },
  { id: "shock", emoji: "😱", label: "Shock", pack: "Anime" },
  { id: "cool", emoji: "😎", label: "Cool", pack: "Anime" },
];

export const STICKER_PACKS = ["All", "Cute", "Funny", "Reactions", "Anime"] as const;

export type StickerPack = (typeof STICKER_PACKS)[number];

export function getSticker(id: string | null | undefined) {
  if (!id) return null;
  return STICKERS.find((sticker) => sticker.id === id) ?? null;
}
