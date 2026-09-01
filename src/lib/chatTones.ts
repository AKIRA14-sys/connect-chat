// src/lib/chatTones.ts
// Per-chat notification tones (local). Plays in-app when a message arrives.

const MAP_KEY = "xuppin-chat-tones";

export type ChatToneId =
  | "default"
  | "soft"
  | "bubble"
  | "ping"
  | "chime"
  | "pop"
  | "silent";

export const CHAT_TONES: {
  id: ChatToneId;
  name: string;
  description: string;
}[] = [
  { id: "default", name: "Default", description: "Classic two-tone" },
  { id: "soft", name: "Soft", description: "Gentle low note" },
  { id: "bubble", name: "Bubble", description: "Light blip" },
  { id: "ping", name: "Ping", description: "Sharp alert" },
  { id: "chime", name: "Chime", description: "Two soft chimes" },
  { id: "pop", name: "Pop", description: "Quick pop" },
  { id: "silent", name: "Silent", description: "No sound" },
];

function readMap(): Record<string, ChatToneId> {
  try {
    const raw = localStorage.getItem(MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed as Record<string, ChatToneId>;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, ChatToneId>) {
  localStorage.setItem(MAP_KEY, JSON.stringify(map));
}

export function getChatTone(conversationId: string): ChatToneId {
  const map = readMap();
  return map[conversationId] || "default";
}

export function setChatTone(conversationId: string, tone: ChatToneId) {
  const map = readMap();
  if (tone === "default") {
    delete map[conversationId];
  } else {
    map[conversationId] = tone;
  }
  writeMap(map);
}

function beep(
  ctx: AudioContext,
  freq: number,
  start: number,
  dur: number,
  gain = 0.08,
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Play the tone for a chat (no-op if silent or muted OS). */
export function playChatTone(conversationId: string) {
  if (typeof window === "undefined") return;
  const tone = getChatTone(conversationId);
  if (tone === "silent") return;

  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;

    switch (tone) {
      case "soft":
        beep(ctx, 440, t0, 0.15, 0.05);
        break;
      case "bubble":
        beep(ctx, 660, t0, 0.08, 0.06);
        beep(ctx, 880, t0 + 0.09, 0.06, 0.04);
        break;
      case "ping":
        beep(ctx, 1200, t0, 0.1, 0.07);
        break;
      case "chime":
        beep(ctx, 523, t0, 0.12, 0.06);
        beep(ctx, 659, t0 + 0.14, 0.14, 0.05);
        break;
      case "pop":
        beep(ctx, 300, t0, 0.05, 0.09);
        break;
      default:
        beep(ctx, 880, t0, 0.1, 0.07);
        beep(ctx, 660, t0 + 0.12, 0.12, 0.06);
        break;
    }

    window.setTimeout(() => {
      void ctx.close();
    }, 800);
  } catch {
    /* ignore autoplay blocks */
  }
}

export function previewTone(tone: ChatToneId) {
  if (tone === "silent") return;
  // temporarily play via a fake id
  const map = readMap();
  const prev = map["__preview__"];
  map["__preview__"] = tone;
  writeMap(map);
  playChatTone("__preview__");
  if (prev) map["__preview__"] = prev;
  else delete map["__preview__"];
  writeMap(map);
}
