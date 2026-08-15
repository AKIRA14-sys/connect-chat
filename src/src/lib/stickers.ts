export type Sticker = {
  id: string;
  emoji: string;
  label: string;
  pack: string;
};

export const STICKERS: Sticker[] = [
  // Cute
  {
    id: "love",
    emoji: "🥰",
    label: "Love",
    pack: "Cute",
  },
  {
    id: "kiss",
    emoji: "😘",
    label: "Kiss",
    pack: "Cute",
  },
  {
    id: "heart",
    emoji: "❤️",
    label: "Heart",
    pack: "Cute",
  },
  {
    id: "hug",
    emoji: "🤗",
    label: "Hug",
    pack: "Cute",
  },

  // Funny
  {
    id: "laugh",
    emoji: "😂",
    label: "Laugh",
    pack: "Funny",
  },
  {
    id: "lol",
    emoji: "🤣",
    label: "LOL",
    pack: "Funny",
  },
  {
    id: "dead",
    emoji: "💀",
    label: "Dead",
    pack: "Funny",
  },
  {
    id: "sus",
    emoji: "🤨",
    label: "Sus",
    pack: "Funny",
  },

  // Reactions
  {
    id: "fire",
    emoji: "🔥",
    label: "Fire",
    pack: "Reactions",
  },
  {
    id: "goat",
    emoji: "🐐",
    label: "GOAT",
    pack: "Reactions",
  },
  {
    id: "clap",
    emoji: "👏",
    label: "Clap",
    pack: "Reactions",
  },
  {
    id: "party",
    emoji: "🎉",
    label: "Party",
    pack: "Reactions",
  },

  // Anime-style
  {
    id: "power",
    emoji: "⚡",
    label: "Power",
    pack: "Anime",
  },
  {
    id: "angry",
    emoji: "😤",
    label: "Angry",
    pack: "Anime",
  },
  {
    id: "shock",
    emoji: "😱",
    label: "Shock",
    pack: "Anime",
  },
  {
    id: "cool",
    emoji: "😎",
    label: "Cool",
    pack: "Anime",
  },
];

export function stickerById(
  id: string | null | undefined,
) {
  if (!id) return null;

  return (
    STICKERS.find(
      (sticker) =>
        sticker.id === id,
    ) ?? null
  );
}

export const STICKER_PACKS = [
  "All",
  "Cute",
  "Funny",
  "Reactions",
  "Anime",
] as const;