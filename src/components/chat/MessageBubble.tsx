import React, { type ReactNode } from "react";
import { Check, CheckCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type MessageStatus = "pending" | "sent" | "delivered" | "read";

export interface MessageBubbleProps {
  children?: ReactNode;
  mine?: boolean;
  senderName?: string;
  senderColorClass?: string;
  timestamp?: string;
  status?: MessageStatus;
  isEdited?: boolean;
  isDeleted?: boolean;
  sticker?: boolean;
  bubblePos?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function MessageBubble({
  children,
  mine = false,
  senderName,
  senderColorClass,
  timestamp,
  status = "sent",
  isEdited = false,
  isDeleted = false,
  sticker = false,
  bubblePos,
  className,
  style,
  onClick,
  onContextMenu,
}: MessageBubbleProps) {
  if (sticker) {
    return (
      <div
        className={cn("xup-bubble-sticker relative", className)}
        style={style}
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        {children}
        {timestamp && (
          <div className="xup-msg-bubble-meta bg-black/40 text-white px-1.5 py-0.5 rounded-full text-[10px] mt-1 inline-flex items-center gap-1">
            <span>{timestamp}</span>
            {mine && <StatusIcon status={status} />}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "xup-msg-bubble",
        mine ? "xup-msg-bubble--mine" : "xup-msg-bubble--other",
        bubblePos,
        className
      )}
      style={style}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {senderName && !mine && (
        <span className={cn("xup-msg-sender-name", senderColorClass)}>
          {senderName}
        </span>
      )}

      {isDeleted ? (
        <p className="italic opacity-70 text-xs">This message was deleted</p>
      ) : (
        <div className="xup-msg-bubble-body">{children}</div>
      )}

      <div className="xup-msg-bubble-meta">
        {isEdited && !isDeleted && <span>edited</span>}
        {timestamp && <span>{timestamp}</span>}
        {mine && !isDeleted && <StatusIcon status={status} />}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: MessageStatus }) {
  if (status === "pending") {
    return <Clock className="h-3 w-3 animate-spin opacity-70" />;
  }
  if (status === "read") {
    return <CheckCheck className="h-3 w-3 text-[#34b7f1] dark:text-[#53bdeb] font-bold" />;
  }
  if (status === "delivered") {
    return <CheckCheck className="h-3 w-3 opacity-80" />;
  }
  return <Check className="h-3 w-3 opacity-80" />;
}
