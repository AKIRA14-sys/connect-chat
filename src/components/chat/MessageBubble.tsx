import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  bubbleStyleToReact,
  type SenderBubbleStyle,
} from "@/lib/bubbleStyle";

type BubblePos = "xup-b-only" | "xup-b-first" | "xup-b-middle" | "xup-b-last";

type Props = {
  mine: boolean;
  sticker?: boolean;
  bubblePos?: BubblePos;
  /** Group chats: sender display name on received messages */
  senderName?: string | null;
  senderColorClass?: string;
  className?: string;
  style?: CSSProperties;
  /** Validated sender customization (shown to everyone) */
  senderStyle?: SenderBubbleStyle | null;
  children: ReactNode;
  meta?: ReactNode;
};

/**
 * XUPPIN WhatsApp-inspired bubble shell.
 * width: fit-content, max ~80%, tight short messages, tall long messages.
 */
export function MessageBubble({
  mine,
  sticker,
  bubblePos = "xup-b-only",
  senderName,
  senderColorClass,
  className,
  style,
  senderStyle,
  children,
  meta,
}: Props) {
  if (sticker) {
    return (
      <div className={cn("xup-bubble-sticker", className)} style={style}>
        {children}
        {meta}
      </div>
    );
  }

  const custom = bubbleStyleToReact(senderStyle, mine);

  return (
    <div
      className={cn(
        "xup-msg-bubble",
        mine ? "xup-msg-bubble--mine" : "xup-msg-bubble--other",
        bubblePos,
        className,
      )}
      style={{ ...custom, ...style }}
    >
      {!mine && senderName ? (
        <p
          className={cn(
            "xup-msg-sender-name",
            senderColorClass,
          )}
        >
          {senderName}
        </p>
      ) : null}
      <div className="xup-msg-bubble-body">{children}</div>
      {meta ? <div className="xup-msg-bubble-meta">{meta}</div> : null}
    </div>
  );
}
