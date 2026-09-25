/**
 * Sender bubble customization (shown to others).
 * Never apply raw user CSS — only validated fields.
 */
import type { CSSProperties } from "react";

export type BubbleStyleKind =
  | "default"
  | "solid"
  | "gradient"
  | "glass"
  | "image";

export type SenderBubbleStyle = {
  kind: BubbleStyleKind;
  color?: string;
  color2?: string;
  imageUrl?: string;
  textColor?: string;
  borderRadius?: number;
  opacity?: number;
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SAFE_URL =
  /^(https:\/\/[^\s]+|avatars\/[^\s]+|chat-media\/[^\s]+|cosmetics\/[^\s]+)$/i;

export function sanitizeBubbleStyle(raw: unknown): SenderBubbleStyle | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = (o.kind as string) || "default";
  if (!["default", "solid", "gradient", "glass", "image"].includes(kind)) {
    return null;
  }
  const style: SenderBubbleStyle = { kind: kind as BubbleStyleKind };
  if (typeof o.color === "string" && HEX.test(o.color)) style.color = o.color;
  if (typeof o.color2 === "string" && HEX.test(o.color2)) style.color2 = o.color2;
  if (typeof o.textColor === "string" && HEX.test(o.textColor))
    style.textColor = o.textColor;
  if (typeof o.imageUrl === "string" && SAFE_URL.test(o.imageUrl.trim())) {
    style.imageUrl = o.imageUrl.trim();
  }
  if (
    typeof o.borderRadius === "number" &&
    o.borderRadius >= 4 &&
    o.borderRadius <= 28
  ) {
    style.borderRadius = o.borderRadius;
  }
  if (typeof o.opacity === "number" && o.opacity >= 0.4 && o.opacity <= 1) {
    style.opacity = o.opacity;
  }
  return style;
}

export function bubbleStyleToReact(
  style: SenderBubbleStyle | null | undefined,
  mine: boolean,
): CSSProperties | undefined {
  if (!style || style.kind === "default") return undefined;
  const radius = style.borderRadius ?? 16;
  const base: CSSProperties = {
    borderRadius: mine
      ? `${radius}px ${radius}px 6px ${radius}px`
      : `${radius}px ${radius}px ${radius}px 6px`,
  };
  if (style.textColor) base.color = style.textColor;
  if (style.kind === "solid" && style.color) {
    base.background = style.color;
  } else if (style.kind === "gradient" && style.color) {
    base.background = `linear-gradient(135deg, ${style.color}, ${
      style.color2 || style.color
    })`;
  } else if (style.kind === "glass") {
    base.background = "rgba(15, 23, 42, 0.55)";
    base.backdropFilter = "blur(12px)";
    base.WebkitBackdropFilter = "blur(12px)";
    base.border = "1px solid rgba(148,163,184,0.2)";
  } else if (style.kind === "image" && style.imageUrl) {
    const overlay = "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45))";
    base.backgroundImage = `${overlay}, url(${JSON.stringify(style.imageUrl).slice(1, -1)})`;
    base.backgroundSize = "cover";
    base.backgroundPosition = "center";
    base.color = style.textColor || "#fff";
  }
  if (style.opacity != null) base.opacity = style.opacity;
  return base;
}
