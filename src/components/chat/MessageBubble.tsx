/* ============================================================
   XUPPIN CHAT BUBBLE REPLACEMENT
   WhatsApp-inspired proportions, but XUPPIN visual identity.
   Append/replace the existing .xup-msg-* bubble section in
   src/styles.css with this block.
   ============================================================ */

.xup-msg-bubble {
  display: inline-block;
  width: fit-content;
  max-width: min(80%, 34rem);
  min-width: 0;
  min-height: 40px;
  padding: 7px 12px 6px;
  box-sizing: border-box;

  font-size: 15px;
  line-height: 1.45;

  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;

  vertical-align: top;
}

.xup-msg-bubble--mine {
  margin-left: auto;
  background: linear-gradient(
    160deg,
    #2dd4bf 0%,
    #14b8a6 52%,
    #0d9488 100%
  );
  color: #042f2e;
  border-radius: 16px 16px 4px 16px;
  box-shadow: 0 2px 10px rgba(13, 148, 136, 0.22);
}

.xup-msg-bubble--other {
  margin-right: auto;
  background: rgba(30, 41, 59, 0.92);
  color: #f1f5f9;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 16px 16px 16px 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
}

/* Consecutive messages become visually connected. */
.xup-msg-bubble--mine.xup-b-middle,
.xup-msg-bubble--mine.xup-b-last {
  border-radius: 16px 6px 4px 16px;
}

.xup-msg-bubble--other.xup-b-middle,
.xup-msg-bubble--other.xup-b-last {
  border-radius: 6px 16px 16px 4px;
}

/* Group sender name: full name, never artificial ellipsis. */
.xup-msg-sender-name {
  display: block;
  width: 100%;
  margin: 0 0 4px;
  padding: 0;

  font-size: 13px;
  font-weight: 650;
  line-height: 1.25;

  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* Keep text and media from forcing the bubble wider. */
.xup-msg-bubble-body {
  display: block;
  min-width: 0;
  max-width: 100%;
}

/*
 * Timestamp/read receipt stays inside the bubble.
 * Floating lets short messages remain compact while long messages
 * keep a comfortable readable width.
 */
.xup-msg-bubble-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;

  float: right;
  clear: both;

  margin: 3px 0 0 10px;
  padding-left: 2px;

  font-size: 11px;
  line-height: 1.2;
  opacity: 0.75;

  white-space: nowrap;
}

.xup-msg-bubble-body::after {
  content: "";
  display: table;
  clear: both;
}

/* Normal message gap: ~8px. Consecutive messages: ~3px. */
.xup-msg-row {
  margin-top: 8px;
  display: flex;
  width: 100%;
  align-items: flex-end;
}

.xup-msg-row.xup-msg-follow {
  margin-top: 3px;
}

/*
 * IMPORTANT:
 * Message avatars must only be rendered by the group-message route.
 * This selector gives them a stable size when the route renders them.
 */
.xup-msg-avatar {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  margin-right: 8px;
  align-self: flex-end;
}

/* Sent messages never need a message avatar. */
.xup-msg-row[data-chat-type="direct"] .xup-msg-avatar {
  display: none !important;
}

/* Long display names should remain readable. */
.xup-msg-avatar + .xup-msg-bubble,
.xup-msg-avatar + div {
  min-width: 0;
}

/* Small phones. */
@media (max-width: 380px) {
  .xup-msg-bubble {
    max-width: 84%;
    padding-left: 11px;
    padding-right: 11px;
    font-size: 14px;
  }

  .xup-msg-avatar {
    flex-basis: 32px;
    width: 32px;
    height: 32px;
    margin-right: 6px;
  }
}

/* Larger screens: keep chat bubbles from becoming giant paragraphs. */
@media (min-width: 768px) {
  .xup-msg-bubble {
    max-width: min(72%, 38rem);
  }
}

.xup-bubble-sticker {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0.15rem !important;
}
