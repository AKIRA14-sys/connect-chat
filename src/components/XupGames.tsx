import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  Crown,
  RotateCcw,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  completeGamingMatch,
  getGamingMatchReward,
  startGamingMatch,
} from "@/lib/gaming.functions";
import type { Message } from "@/lib/whatsxup";
import { GameRewardModal } from "@/components/gaming/GameRewardModal";

type Game =
  | "menu"
  | "tictactoe"
  | "rps"
  | "emoji"
  | "reaction"
  | "chess"
  | "checkers"
  | "ludo";

type Mark = "X" | "O" | null;

type RpsChoice = "rock" | "paper" | "scissors";

type CoinResult = "heads" | "tails";

interface XupGamesProps {
  onClose?: () => void;
  conversationId: string;
  userId: string;
  peerId?: string | null;
  peerName?: string | null;
  /*
   * OPTIONAL — powers the in-game 💬 chat bubble. If either
   * prop is omitted, the bubble simply doesn't render, so
   * this stays backward compatible with older call sites.
   */
  messages?: Message[];
  onSendChatMessage?: (text: string) => Promise<boolean>;
}

/* =========================================================
   GAME SYNC — shared realtime channel for two-player games.
   Reuses the same broadcast pattern as instant messaging,
   just on its own dedicated channel so it doesn't interfere
   with the chat's own realtime listeners.
========================================================= */

type GameSync = {
  send: (type: string, data: any) => void;
  on: (
    type: string,
    handler: (data: any, from: string) => void,
  ) => () => void;
  peerPresent: boolean;
};

function useGameSync(
  conversationId: string,
  userId: string,
): GameSync {
  const channelRef = useRef<ReturnType<
    typeof supabase.channel
  > | null>(null);

  const [peerPresent, setPeerPresent] =
    useState(false);

  const listenersRef = useRef<
    Map<string, (payload: any) => void>
  >(new Map());

  useEffect(() => {
    if (!userId) return;

    const ch = supabase.channel(
      `games:${conversationId}`,
      {
        config: {
          broadcast: { self: false },
          presence: { key: userId },
        },
      },
    );

    ch.on(
      "broadcast",
      { event: "game" },
      ({ payload }) => {
        const handler = listenersRef.current.get(
          payload?.type,
        );

        if (handler) handler(payload);
      },
    );

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();

      const others = Object.keys(state).filter(
        (key) => key !== userId,
      );

      setPeerPresent(others.length > 0);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          userId,
          joinedAt: Date.now(),
        });
      }
    });

    channelRef.current = ch;

    return () => {
      void supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [conversationId, userId]);

  const send = useCallback(
    (type: string, data: any) => {
      void channelRef.current?.send({
        type: "broadcast",
        event: "game",
        payload: { type, data, from: userId },
      });
    },
    [userId],
  );

  const on = useCallback(
    (
      type: string,
      handler: (data: any, from: string) => void,
    ) => {
      listenersRef.current.set(type, (payload) =>
        handler(payload.data, payload.from),
      );

      return () => {
        listenersRef.current.delete(type);
      };
    },
    [],
  );

  return { send, on, peerPresent };
}

/* =========================================================
   EMOJI QUESTIONS
========================================================= */

const EMOJI_QUESTIONS = [
  { emojis: "🦁👑", answer: "the lion king" },
  { emojis: "❄️👸", answer: "frozen" },
  { emojis: "🕷️🧑", answer: "spider-man" },
  { emojis: "🚢💔", answer: "titanic" },
  { emojis: "🧙‍♂️⚡", answer: "harry potter" },
  { emojis: "🐠🔎", answer: "finding nemo" },
  { emojis: "🤖🚗", answer: "transformers" },
  { emojis: "🦖🏝️", answer: "jurassic park" },
  { emojis: "👻🚫", answer: "ghostbusters" },
  { emojis: "🍫🏭", answer: "willy wonka" },
];

/* =========================================================
   ROCK PAPER SCISSORS DATA
========================================================= */

const RPS_CHOICES: {
  value: RpsChoice;
  emoji: string;
  label: string;
}[] = [
  { value: "rock", emoji: "✊", label: "Rock" },
  { value: "paper", emoji: "✋", label: "Paper" },
  { value: "scissors", emoji: "✌️", label: "Scissors" },
];

/* =========================================================
   HELPERS
========================================================= */

function getRandomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function checkTicTacToeWinner(
  board: Mark[],
): Mark | "draw" | null {
  const combinations: [number, number, number][] = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const [a, b, c] of combinations) {
    if (
      board[a] &&
      board[a] === board[b] &&
      board[a] === board[c]
    ) {
      return board[a];
    }
  }

  if (board.every(Boolean)) return "draw";
  return null;
}

function getRpsResult(
  player: RpsChoice,
  opponent: RpsChoice,
): "win" | "loss" | "draw" {
  if (player === opponent) return "draw";

  if (
    (player === "rock" && opponent === "scissors") ||
    (player === "paper" && opponent === "rock") ||
    (player === "scissors" && opponent === "paper")
  ) {
    return "win";
  }

  return "loss";
}

/* =========================================================
   CHESS ENGINE

   Self-contained, local move generation and validation —
   no external chess library, no AI API. Castling and en
   passant are intentionally left out ("basic legal move
   validation" per spec); pawns auto-promote to queen.
   Everything else (check, checkmate, stalemate, legal move
   filtering) is fully implemented.
========================================================= */

type PieceType = "P" | "N" | "B" | "R" | "Q" | "K";
type PieceColor = "w" | "b";

type ChessPiece = {
  type: PieceType;
  color: PieceColor;
} | null;

type ChessBoard = ChessPiece[][];

type ChessMove = {
  fr: number;
  fc: number;
  tr: number;
  tc: number;
  promotion?: PieceType;
};

type ChessStatus =
  | "playing"
  | "check"
  | "checkmate"
  | "stalemate";

const CHESS_ROOK_DIRS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const CHESS_BISHOP_DIRS: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const CHESS_QUEEN_DIRS: [number, number][] = [
  ...CHESS_ROOK_DIRS,
  ...CHESS_BISHOP_DIRS,
];

const CHESS_KNIGHT_OFFSETS: [number, number][] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

const CHESS_PIECE_VALUES: Record<PieceType, number> = {
  P: 1,
  N: 3,
  B: 3,
  R: 5,
  Q: 9,
  K: 0,
};

const CHESS_UNICODE: Record<
  PieceColor,
  Record<PieceType, string>
> = {
  w: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
  b: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
};

function chessInBounds(r: number, c: number) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function createInitialChessBoard(): ChessBoard {
  const backRank: PieceType[] = [
    "R",
    "N",
    "B",
    "Q",
    "K",
    "B",
    "N",
    "R",
  ];

  const board: ChessBoard = Array.from(
    { length: 8 },
    () => Array(8).fill(null),
  );

  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: backRank[c], color: "b" };
    board[1][c] = { type: "P", color: "b" };
    board[6][c] = { type: "P", color: "w" };
    board[7][c] = { type: backRank[c], color: "w" };
  }

  return board;
}

function generateChessPseudoMoves(
  board: ChessBoard,
  color: PieceColor,
): ChessMove[] {
  const moves: ChessMove[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];

      if (!piece || piece.color !== color) continue;

      if (piece.type === "P") {
        const dir = color === "w" ? -1 : 1;
        const startRow = color === "w" ? 6 : 1;
        const promoRow = color === "w" ? 0 : 7;
        const oneStep = r + dir;

        if (
          chessInBounds(oneStep, c) &&
          !board[oneStep][c]
        ) {
          moves.push({
            fr: r,
            fc: c,
            tr: oneStep,
            tc: c,
            ...(oneStep === promoRow
              ? { promotion: "Q" as PieceType }
              : {}),
          });

          const twoStep = r + dir * 2;

          if (
            r === startRow &&
            chessInBounds(twoStep, c) &&
            !board[twoStep][c]
          ) {
            moves.push({
              fr: r,
              fc: c,
              tr: twoStep,
              tc: c,
            });
          }
        }

        for (const dc of [-1, 1]) {
          const tr = r + dir;
          const tc = c + dc;

          if (!chessInBounds(tr, tc)) continue;

          const target = board[tr][tc];

          if (target && target.color !== color) {
            moves.push({
              fr: r,
              fc: c,
              tr,
              tc,
              ...(tr === promoRow
                ? { promotion: "Q" as PieceType }
                : {}),
            });
          }
        }
      } else if (piece.type === "N") {
        for (const [dr, dc] of CHESS_KNIGHT_OFFSETS) {
          const tr = r + dr;
          const tc = c + dc;

          if (!chessInBounds(tr, tc)) continue;

          const target = board[tr][tc];

          if (!target || target.color !== color) {
            moves.push({ fr: r, fc: c, tr, tc });
          }
        }
      } else if (piece.type === "K") {
        for (const [dr, dc] of CHESS_QUEEN_DIRS) {
          const tr = r + dr;
          const tc = c + dc;

          if (!chessInBounds(tr, tc)) continue;

          const target = board[tr][tc];

          if (!target || target.color !== color) {
            moves.push({ fr: r, fc: c, tr, tc });
          }
        }
      } else {
        const dirs =
          piece.type === "B"
            ? CHESS_BISHOP_DIRS
            : piece.type === "R"
              ? CHESS_ROOK_DIRS
              : CHESS_QUEEN_DIRS;

        for (const [dr, dc] of dirs) {
          let tr = r + dr;
          let tc = c + dc;

          while (chessInBounds(tr, tc)) {
            const target = board[tr][tc];

            if (!target) {
              moves.push({ fr: r, fc: c, tr, tc });
            } else {
              if (target.color !== color) {
                moves.push({ fr: r, fc: c, tr, tc });
              }
              break;
            }

            tr += dr;
            tc += dc;
          }
        }
      }
    }
  }

  return moves;
}

function applyChessMove(
  board: ChessBoard,
  move: ChessMove,
): ChessBoard {
  const next = board.map((row) => row.slice());
  const piece = next[move.fr][move.fc];

  next[move.fr][move.fc] = null;

  if (piece) {
    next[move.tr][move.tc] = move.promotion
      ? { type: move.promotion, color: piece.color }
      : piece;
  }

  return next;
}

function findChessKing(
  board: ChessBoard,
  color: PieceColor,
): { r: number; c: number } | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];

      if (
        piece &&
        piece.type === "K" &&
        piece.color === color
      ) {
        return { r, c };
      }
    }
  }

  return null;
}

function isChessKingInCheck(
  board: ChessBoard,
  color: PieceColor,
): boolean {
  const king = findChessKing(board, color);

  if (!king) return false;

  const opponentMoves = generateChessPseudoMoves(
    board,
    color === "w" ? "b" : "w",
  );

  return opponentMoves.some(
    (move) => move.tr === king.r && move.tc === king.c,
  );
}

function generateChessLegalMoves(
  board: ChessBoard,
  color: PieceColor,
): ChessMove[] {
  const pseudo = generateChessPseudoMoves(board, color);

  return pseudo.filter((move) => {
    const next = applyChessMove(board, move);
    return !isChessKingInCheck(next, color);
  });
}

function getChessStatus(
  board: ChessBoard,
  color: PieceColor,
): ChessStatus {
  const legal = generateChessLegalMoves(board, color);
  const inCheck = isChessKingInCheck(board, color);

  if (legal.length === 0) {
    return inCheck ? "checkmate" : "stalemate";
  }

  return inCheck ? "check" : "playing";
}

/* Programmed bot: no AI API. Prefers captures (weighted by
   piece value) and moves that give check, with a small
   random factor so it isn't perfectly predictable. */
function chooseChessBotMove(
  board: ChessBoard,
  color: PieceColor,
): ChessMove | null {
  const moves = generateChessLegalMoves(board, color);

  if (!moves.length) return null;

  let best = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const target = board[move.tr][move.tc];
    const captureValue = target
      ? CHESS_PIECE_VALUES[target.type]
      : 0;

    const nextBoard = applyChessMove(board, move);
    const opponentColor = color === "w" ? "b" : "w";
    const givesCheck = isChessKingInCheck(
      nextBoard,
      opponentColor,
    );

    const score =
      captureValue * 2 +
      (givesCheck ? 1 : 0) +
      Math.random();

    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  return best;
}

/* =========================================================
   CHECKERS ENGINE

   Standard American/English checkers rules: men move and
   capture diagonally forward only, kings move/capture both
   directions (no "flying kings"), captures are mandatory
   across the whole board, and multi-jumps with the same
   piece are enforced. No external library, no AI API.
========================================================= */

type CheckersColor = "r" | "b";

type CheckersPiece = {
  color: CheckersColor;
  king: boolean;
} | null;

type CheckersBoard = CheckersPiece[][];

type CheckersMove = {
  fr: number;
  fc: number;
  tr: number;
  tc: number;
  capture?: { r: number; c: number };
};

type CheckersState = {
  board: CheckersBoard;
  turn: CheckersColor;
  forced: { r: number; c: number } | null;
  noCapture: number;
};

const CHECKERS_DRAW_LIMIT = 40;

function checkersInBounds(r: number, c: number) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function createInitialCheckersBoard(): CheckersBoard {
  const board: CheckersBoard = Array.from(
    { length: 8 },
    () => Array(8).fill(null),
  );

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        board[r][c] = { color: "b", king: false };
      }
    }
  }

  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        board[r][c] = { color: "r", king: false };
      }
    }
  }

  return board;
}

function getCheckersPieceMoves(
  board: CheckersBoard,
  r: number,
  c: number,
): { simple: CheckersMove[]; captures: CheckersMove[] } {
  const piece = board[r][c];

  if (!piece) return { simple: [], captures: [] };

  const dirs = piece.king
    ? [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]
    : piece.color === "b"
      ? [
          [1, -1],
          [1, 1],
        ]
      : [
          [-1, -1],
          [-1, 1],
        ];

  const simple: CheckersMove[] = [];
  const captures: CheckersMove[] = [];

  for (const [dr, dc] of dirs) {
    const tr = r + dr;
    const tc = c + dc;

    if (checkersInBounds(tr, tc) && !board[tr][tc]) {
      simple.push({ fr: r, fc: c, tr, tc });
    }

    const mr = r + dr;
    const mc = c + dc;
    const jr = r + dr * 2;
    const jc = c + dc * 2;

    if (checkersInBounds(jr, jc)) {
      const mid = board[mr]?.[mc];

      if (
        mid &&
        mid.color !== piece.color &&
        !board[jr][jc]
      ) {
        captures.push({
          fr: r,
          fc: c,
          tr: jr,
          tc: jc,
          capture: { r: mr, c: mc },
        });
      }
    }
  }

  return { simple, captures };
}

/* If forcedFrom is provided (mid multi-jump), only that
   piece's captures are legal. Otherwise: captures are
   mandatory across the whole board if any piece has one;
   simple moves are only legal when nobody can capture. */
function generateCheckersMoves(
  board: CheckersBoard,
  color: CheckersColor,
  forcedFrom?: { r: number; c: number } | null,
): CheckersMove[] {
  if (forcedFrom) {
    return getCheckersPieceMoves(
      board,
      forcedFrom.r,
      forcedFrom.c,
    ).captures;
  }

  const allSimple: CheckersMove[] = [];
  const allCaptures: CheckersMove[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];

      if (piece && piece.color === color) {
        const { simple, captures } =
          getCheckersPieceMoves(board, r, c);

        allSimple.push(...simple);
        allCaptures.push(...captures);
      }
    }
  }

  return allCaptures.length ? allCaptures : allSimple;
}

function applyCheckersMove(
  board: CheckersBoard,
  move: CheckersMove,
): CheckersBoard {
  const next = board.map((row) => row.slice());
  const piece = next[move.fr][move.fc];

  next[move.fr][move.fc] = null;

  if (move.capture) {
    next[move.capture.r][move.capture.c] = null;
  }

  if (piece) {
    let king = piece.king;

    if (!king) {
      if (piece.color === "r" && move.tr === 0) king = true;
      if (piece.color === "b" && move.tr === 7) king = true;
    }

    next[move.tr][move.tc] = { color: piece.color, king };
  }

  return next;
}

/* Applies one atomic move and figures out whether the same
   piece must continue jumping (multi-capture) or the turn
   passes to the other player. Deterministic given the same
   board + move, so both devices reach the same result just
   by broadcasting the move itself. */
function stepCheckersMove(
  board: CheckersBoard,
  turn: CheckersColor,
  move: CheckersMove,
): {
  board: CheckersBoard;
  forced: { r: number; c: number } | null;
  turn: CheckersColor;
  wasCapture: boolean;
} {
  const nextBoard = applyCheckersMove(board, move);

  if (move.capture) {
    const continuation = getCheckersPieceMoves(
      nextBoard,
      move.tr,
      move.tc,
    ).captures;

    if (continuation.length) {
      return {
        board: nextBoard,
        forced: { r: move.tr, c: move.tc },
        turn,
        wasCapture: true,
      };
    }
  }

  return {
    board: nextBoard,
    forced: null,
    turn: turn === "r" ? "b" : "r",
    wasCapture: !!move.capture,
  };
}

/* Programmed bot: no AI API. Captures are already mandatory
   via generateCheckersMoves; among available moves it favors
   captures, promotions, and modest forward progress. */
function chooseCheckersBotMove(
  board: CheckersBoard,
  color: CheckersColor,
  forced: { r: number; c: number } | null,
): CheckersMove | null {
  const moves = generateCheckersMoves(board, color, forced);

  if (!moves.length) return null;

  const promoteRow = color === "r" ? 0 : 7;

  let best = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    let score = move.capture ? 5 : 0;

    if (move.tr === promoteRow) score += 3;

    score +=
      (color === "r" ? 7 - move.tr : move.tr) * 0.05;

    score += Math.random() * 0.5;

    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  return best;
}

/* =========================================================
   LUDO ENGINE — simplified 2-player Ludo-style game.

   Shared 28-square loop (not the full 52-square cross-board,
   per the "keep it simple" requirement). Each color has an
   offset starting point on that loop, a private 4-square
   home stretch, and 4 tokens starting in the yard (pos -1).
   Pure/deterministic functions, so both devices reach the
   same result from the same starting state + move — no
   external library, no AI API.
========================================================= */

type LudoColor = "red" | "blue";

type LudoTokens = Record<LudoColor, number[]>;

type LudoState = {
  tokens: LudoTokens;
  turn: LudoColor;
  dice: number | null;
};

const LUDO_TRACK_LEN = 28;
const LUDO_HOME_STRETCH = 4;
const LUDO_FINISH = LUDO_TRACK_LEN + LUDO_HOME_STRETCH; // 32
const LUDO_OFFSET: Record<LudoColor, number> = {
  red: 0,
  blue: 14,
};
const LUDO_SAFE_CELLS = [0, 14];

function createInitialLudoState(): LudoState {
  return {
    tokens: {
      red: [-1, -1, -1, -1],
      blue: [-1, -1, -1, -1],
    },
    turn: "red",
    dice: null,
  };
}

function ludoBoardCell(
  color: LudoColor,
  pos: number,
): number | null {
  if (pos < 0 || pos >= LUDO_TRACK_LEN) return null;
  return (LUDO_OFFSET[color] + pos) % LUDO_TRACK_LEN;
}

function getLudoLegalMoves(
  tokens: LudoTokens,
  color: LudoColor,
  dice: number,
): number[] {
  const result: number[] = [];

  tokens[color].forEach((pos, idx) => {
    if (pos === -1) {
      if (dice === 6) result.push(idx);
      return;
    }

    if (pos === LUDO_FINISH) return;

    if (pos + dice <= LUDO_FINISH) {
      result.push(idx);
    }
  });

  return result;
}

function applyLudoMove(
  tokens: LudoTokens,
  color: LudoColor,
  tokenIndex: number,
  dice: number,
): { tokens: LudoTokens; captured: boolean } {
  const next: LudoTokens = {
    red: [...tokens.red],
    blue: [...tokens.blue],
  };

  const current = next[color][tokenIndex];
  const newPos = current === -1 ? 0 : current + dice;

  next[color][tokenIndex] = newPos;

  let captured = false;
  const cell = ludoBoardCell(color, newPos);

  if (cell !== null && !LUDO_SAFE_CELLS.includes(cell)) {
    const opponent: LudoColor =
      color === "red" ? "blue" : "red";

    next[opponent] = next[opponent].map((oppPos) => {
      const oppCell = ludoBoardCell(opponent, oppPos);

      if (oppCell !== null && oppCell === cell) {
        captured = true;
        return -1;
      }

      return oppPos;
    });
  }

  return { tokens: next, captured };
}

function isLudoWinner(
  tokens: LudoTokens,
  color: LudoColor,
): boolean {
  return tokens[color].every((pos) => pos === LUDO_FINISH);
}

/* Programmed bot: no AI API. Prefers captures, then bringing
   a new token out on a 6, then advancing the furthest token. */
function chooseLudoBotMove(
  tokens: LudoTokens,
  color: LudoColor,
  dice: number,
): number | null {
  const legal = getLudoLegalMoves(tokens, color, dice);

  if (!legal.length) return null;

  for (const idx of legal) {
    const { captured } = applyLudoMove(
      tokens,
      color,
      idx,
      dice,
    );

    if (captured) return idx;
  }

  if (dice === 6) {
    const yardIdx = legal.find(
      (idx) => tokens[color][idx] === -1,
    );

    if (yardIdx !== undefined) return yardIdx;
  }

  let best = legal[0];
  let bestPos = tokens[color][best];

  for (const idx of legal) {
    if (tokens[color][idx] > bestPos) {
      best = idx;
      bestPos = tokens[color][idx];
    }
  }

  return best;
}

/* =========================================================
   GAME HEADER
========================================================= */

function GameHeader({
  title,
  onBack,
  status,
}: {
  title: string;
  onBack: () => void;
  status?: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-muted active:scale-90"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="min-w-0">
        <h2 className="truncate text-lg font-bold">{title}</h2>
        <p className="text-xs text-muted-foreground">
          {status ?? "XUP Games"}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   PEER STATUS BANNER
========================================================= */

function PeerBanner({
  peerPresent,
  peerName,
}: {
  peerPresent: boolean;
  peerName?: string | null;
}) {
  if (peerPresent) {
    return (
      <div className="mb-4 rounded-xl bg-green-500/10 px-3 py-2 text-center text-xs font-semibold text-green-600">
        🟢 {peerName ?? "Opponent"} is in the game
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl bg-yellow-500/10 px-3 py-2 text-center text-xs font-semibold text-yellow-600">
      ⏳ Waiting for {peerName ?? "the other person"} to open Games…
    </div>
  );
}

/* =========================================================
   COIN FLIP OVERLAY — shared by any game that needs a
   synchronized "who goes first" decision before a match.
========================================================= */

function CoinFlip({
  result,
  flipping,
  label,
}: {
  result: CoinResult | null;
  flipping: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full border-4 border-yellow-500/40 bg-yellow-500/10 text-4xl shadow-lg transition-transform duration-300 ${
          flipping ? "animate-spin" : ""
        }`}
      >
        {flipping
          ? "🪙"
          : result === "heads"
            ? "👑"
            : result === "tails"
              ? "🎯"
              : "🪙"}
      </div>

      <p className="mt-4 text-center text-sm font-semibold">
        {flipping
          ? "Flipping the coin…"
          : result
            ? `${result === "heads" ? "Heads" : "Tails"}! ${label}`
            : "Waiting for the coin flip…"}
      </p>
    </div>
  );
}

/* =========================================================
   GAME MENU
========================================================= */

function GameMenu({
  onSelect,
  peerPresent,
  peerName,
  hasPeer,
}: {
  onSelect: (game: Game) => void;
  peerPresent: boolean;
  peerName?: string | null;
  hasPeer: boolean;
}) {
  const games = [
    {
      id: "tictactoe" as Game,
      emoji: "❌⭕",
      title: "Tic-Tac-Toe",
      description: "Classic X vs O",
    },
    {
      id: "rps" as Game,
      emoji: "✊",
      title: "Rock Paper Scissors",
      description: "Choose your weapon",
    },
    {
      id: "emoji" as Game,
      emoji: "🧠",
      title: "Emoji Guess",
      description: "First to answer wins",
    },
    {
      id: "reaction" as Game,
      emoji: "⚡",
      title: "Reaction Battle",
      description: "Fastest tap wins",
    },
    {
      id: "chess" as Game,
      emoji: "♟️",
      title: "Chess",
      description: "vs friend or bot",
    },
    {
      id: "checkers" as Game,
      emoji: "🔴⚫",
      title: "Checkers",
      description: "vs friend or bot",
    },
    {
      id: "ludo" as Game,
      emoji: "🎲",
      title: "Ludo",
      description: "vs friend or bot",
    },
  ];

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600/15 text-5xl shadow-sm">
          🎮
        </div>

        <h2 className="text-2xl font-black">XUP Games</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Play live against {peerName ?? "each other"}.
        </p>
      </div>

      {hasPeer && (
        <PeerBanner
          peerPresent={peerPresent}
          peerName={peerName}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        {games.map((game) => (
          <button
            key={game.id}
            type="button"
            onClick={() => onSelect(game.id)}
            className="group rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-1 hover:bg-muted active:scale-95"
          >
            <div className="mb-3 text-4xl transition-transform group-hover:scale-110">
              {game.emoji}
            </div>

            <div className="text-sm font-bold">{game.title}</div>

            <div className="mt-1 text-xs text-muted-foreground">
              {game.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   TIC TAC TOE — TWO PLAYER, WITH SYNCHRONIZED COIN FLIP
========================================================= */

function TicTacToe({
  onBack,
  sync,
  userId,
  peerId,
  peerName,
}: {
  onBack: () => void;
  sync: GameSync;
  userId: string;
  peerId?: string | null;
  peerName?: string | null;
}) {
  const hasPeer = !!peerId;
  const isHost = !hasPeer || userId < (peerId as string);

  const [phase, setPhase] = useState<
    "flip" | "playing"
  >(hasPeer ? "flip" : "playing");

  const [flipping, setFlipping] = useState(hasPeer);
  const [coinResult, setCoinResult] =
    useState<CoinResult | null>(null);

  const [board, setBoard] = useState<Mark[]>(
    Array(9).fill(null),
  );

  const [turn, setTurn] = useState<"X" | "O">("X");
  const [xScore, setXScore] = useState(0);
  const [oScore, setOScore] = useState(0);

  const myMark: "X" | "O" = !hasPeer
    ? "X"
    : coinResult === null
      ? "X"
      : coinResult === "heads"
        ? isHost
          ? "X"
          : "O"
        : isHost
          ? "O"
          : "X";

  const winner = useMemo(
    () => checkTicTacToeWinner(board),
    [board],
  );

  const gamingMatch = useGamingMatchSession({
    sync,
    userId,
    peerId,
    gameType: "tictactoe",
    isBot: !hasPeer,
  });

  useEffect(() => {
    if (!winner) return;

    const winnerId = winner === "draw"
      ? null
      : winner === myMark
        ? userId
        : peerId ?? null;
    const loserId = winner === "draw"
      ? null
      : winner === myMark
        ? peerId ?? null
        : userId;

    void gamingMatch.complete({
      result: winner === "draw" ? "draw" : winner === myMark ? "win" : "loss",
      winnerId,
      loserId,
    });
  }, [gamingMatch.complete, myMark, peerId, userId, winner]);

  const runFlip = useCallback(
    (broadcast: boolean) => {
      setPhase("flip");
      setFlipping(true);
      setCoinResult(null);
      setBoard(Array(9).fill(null));
      setTurn("X");

      const result: CoinResult =
        Math.random() < 0.5 ? "heads" : "tails";

      if (broadcast && hasPeer) {
        sync.send("ttt_coin", { result });
      }

      window.setTimeout(() => {
        setCoinResult(result);
        setFlipping(false);

        window.setTimeout(() => {
          setPhase("playing");
        }, 1100);
      }, 900);
    },
    [hasPeer, sync],
  );

  useEffect(() => {
    if (!hasPeer) return;
    if (isHost) {
      runFlip(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasPeer) return;

    const offCoin = sync.on("ttt_coin", (data) => {
      setPhase("flip");
      setFlipping(true);
      setCoinResult(null);
      setBoard(Array(9).fill(null));
      setTurn("X");

      window.setTimeout(() => {
        setCoinResult(data.result);
        setFlipping(false);

        window.setTimeout(() => {
          setPhase("playing");
        }, 1100);
      }, 900);
    });

    const offMove = sync.on("ttt_move", (data) => {
      setBoard((prev) => {
        const next = [...prev];
        next[data.index] = data.mark;
        return next;
      });

      setTurn(data.mark === "X" ? "O" : "X");
    });

    const offReset = sync.on("ttt_reset", () => {});

    return () => {
      offCoin();
      offMove();
      offReset();
    };
  }, [sync, hasPeer]);

  useEffect(() => {
    const result = checkTicTacToeWinner(board);

    if (result === "X") setXScore((s) => s + 1);
    if (result === "O") setOScore((s) => s + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  const play = (index: number) => {
    if (phase !== "playing") return;
    if (board[index] || winner) return;

    if (hasPeer) {
      if (turn !== myMark) return;

      const next = [...board];
      next[index] = myMark;
      setBoard(next);
      setTurn(myMark === "X" ? "O" : "X");

      sync.send("ttt_move", { index, mark: myMark });
      return;
    }

    const next = [...board];
    next[index] = turn;
    setBoard(next);

    const result = checkTicTacToeWinner(next);
    if (!result) {
      setTurn((current) => (current === "X" ? "O" : "X"));
    }
  };

  const playAgain = () => {
    gamingMatch.start();
    if (hasPeer) {
      if (isHost) {
        runFlip(true);
      } else {
        sync.send("ttt_reset", {});
        setPhase("flip");
        setFlipping(true);
        setCoinResult(null);
        setBoard(Array(9).fill(null));
        setTurn("X");
      }
      return;
    }

    setBoard(Array(9).fill(null));
    setTurn("X");
  };

  useEffect(() => {
    if (!hasPeer || !isHost) return;

    const offRequest = sync.on("ttt_reset", () => {
      runFlip(true);
    });

    return () => offRequest();
  }, [hasPeer, isHost, sync, runFlip]);

  return (
    <div className="w-full">
      <GameHeader
        title="❌⭕ Tic-Tac-Toe"
        onBack={onBack}
        status={
          hasPeer
            ? phase === "flip"
              ? "Flipping for X…"
              : `You are ${myMark}`
            : "Practice mode"
        }
      />

      {hasPeer && (
        <PeerBanner
          peerPresent={sync.peerPresent}
          peerName={peerName}
        />
      )}

      {phase === "flip" && hasPeer ? (
        <CoinFlip
          result={coinResult}
          flipping={flipping}
          label={coinResult ? `You are ${myMark}.` : ""}
        />
      ) : (
        <>
          <div className="mb-5 flex justify-center gap-3">
            <div className="rounded-xl bg-blue-600/10 px-4 py-2 text-sm font-semibold">
              ❌ {xScore}
            </div>

            <div className="rounded-xl bg-muted px-4 py-2 text-sm font-semibold">
              🤝
            </div>

            <div className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold">
              ⭕ {oScore}
            </div>
          </div>

          <div className="mb-5 text-center">
            {winner === "draw" ? (
              <div className="font-bold">🤝 It's a draw!</div>
            ) : winner ? (
              <div className="font-bold">🏆 {winner} wins!</div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Turn:{" "}
                <span className="font-bold text-foreground">
                  {turn}
                  {hasPeer && turn === myMark ? " (You)" : ""}
                </span>
              </div>
            )}
          </div>

          <div className="mx-auto grid max-w-xs grid-cols-3 gap-2">
            {board.map((cell, index) => (
              <button
                key={index}
                type="button"
                onClick={() => play(index)}
                className="flex aspect-square items-center justify-center rounded-2xl border bg-card text-4xl font-black shadow-sm transition hover:bg-muted active:scale-95"
              >
                {cell === "X" && "❌"}
                {cell === "O" && "⭕"}
              </button>
            ))}
          </div>

          {(winner === "X" ||
            winner === "O" ||
            winner === "draw") && (
            <button
              type="button"
              onClick={playAgain}
              className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              Play Again
            </button>
          )}
        </>
      )}
    {gamingMatch.RewardModal}
    </div>
  );
}

/* =========================================================
   ROCK PAPER SCISSORS — TWO PLAYER
========================================================= */

function RockPaperScissors({
  onBack,
  sync,
  userId,
  peerId,
  peerName,
}: {
  onBack: () => void;
  sync: GameSync;
  userId: string;
  peerId?: string | null;
  peerName?: string | null;
}) {
  const hasPeer = !!peerId;

  const gamingMatch = useGamingMatchSession({
    sync,
    userId,
    peerId,
    gameType: "rps",
    isBot: !hasPeer,
  });

  const [result, setResult] = useState<string | null>(null);
  const [playerChoice, setPlayerChoice] =
    useState<RpsChoice | null>(null);
  const [opponentChoice, setOpponentChoice] =
    useState<RpsChoice | null>(null);
  const [score, setScore] = useState({
    wins: 0,
    losses: 0,
    draws: 0,
  });

  useEffect(() => {
    if (!hasPeer) return;

    const offChoice = sync.on("rps_choice", (data) => {
      setOpponentChoice(data.choice);
    });

    const offReset = sync.on("rps_reset", () => {
      setResult(null);
      setPlayerChoice(null);
      setOpponentChoice(null);
    });

    return () => {
      offChoice();
      offReset();
    };
  }, [sync, hasPeer]);

  useEffect(() => {
    if (!playerChoice || !opponentChoice) return;
    if (result) return;

    const outcome = getRpsResult(
      playerChoice,
      opponentChoice,
    );

    if (outcome === "win") {
      setScore((c) => ({ ...c, wins: c.wins + 1 }));
      setResult("🔥 You win!");
    } else if (outcome === "lose") {
      setScore((c) => ({ ...c, losses: c.losses + 1 }));
      setResult("💀 You lose!");
    } else {
      setScore((c) => ({ ...c, draws: c.draws + 1 }));
      setResult("🤝 Draw!");
    }

    const winnerId = outcome === "win"
      ? userId
      : outcome === "lose"
        ? peerId ?? null
        : null;
    const loserId = outcome === "win"
      ? peerId ?? null
      : outcome === "lose"
        ? userId
        : null;

    void gamingMatch.complete({
      result: outcome === "win" ? "win" : outcome === "lose" ? "loss" : "draw",
      winnerId,
      loserId,
    });
  }, [gamingMatch.complete, playerChoice, opponentChoice, hasPeer, result, peerId, userId]);

  const play = (choice: RpsChoice) => {
    if (hasPeer) {
      if (playerChoice) return;

      setPlayerChoice(choice);
      sync.send("rps_choice", { choice });
      return;
    }

    const opponent = getRandomItem(
      RPS_CHOICES.map((item) => item.value),
    );

    const outcome = getRpsResult(choice, opponent);

    setPlayerChoice(choice);
    setOpponentChoice(opponent);

    if (outcome === "win") {
      setScore((c) => ({ ...c, wins: c.wins + 1 }));
      setResult("🔥 You win!");
    } else if (outcome === "lose") {
      setScore((c) => ({ ...c, losses: c.losses + 1 }));
      setResult("💀 You lose!");
    } else {
      setScore((c) => ({ ...c, draws: c.draws + 1 }));
      setResult("🤝 Draw!");
    }

    void gamingMatch.complete({
      result:
        outcome === "win" ? "win" : outcome === "lose" ? "loss" : "draw",
      winnerId: outcome === "win" ? userId : null,
      loserId: outcome === "lose" ? userId : null,
    });
  };

  const reset = () => {
    gamingMatch.start();
    setResult(null);
    setPlayerChoice(null);
    setOpponentChoice(null);

    if (hasPeer) {
      sync.send("rps_reset", {});
    }
  };

  const getEmoji = (choice: RpsChoice | null) =>
    RPS_CHOICES.find((item) => item.value === choice)
      ?.emoji || "❔";

  const waitingForPeer =
    hasPeer && !!playerChoice && !opponentChoice;

  return (
    <div className="w-full">
      <GameHeader
        title="✊ Rock Paper Scissors"
        onBack={onBack}
        status={hasPeer ? "Live vs opponent" : "Practice mode"}
      />

      {hasPeer && (
        <PeerBanner
          peerPresent={sync.peerPresent}
          peerName={peerName}
        />
      )}

      <div className="mb-5 flex justify-center gap-3 text-sm">
        <div className="rounded-xl bg-green-500/10 px-3 py-2">
          🔥 {score.wins}
        </div>

        <div className="rounded-xl bg-red-500/10 px-3 py-2">
          💀 {score.losses}
        </div>

        <div className="rounded-xl bg-muted px-3 py-2">
          🤝 {score.draws}
        </div>
      </div>

      {result && (
        <div className="mb-6 rounded-2xl border bg-card p-5 text-center">
          <div className="mb-3 flex items-center justify-center gap-8 text-5xl">
            <span>{getEmoji(playerChoice)}</span>
            <span className="text-xl text-muted-foreground">VS</span>
            <span>{getEmoji(opponentChoice)}</span>
          </div>

          <div className="text-xl font-black">{result}</div>
        </div>
      )}

      {!result && waitingForPeer && (
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold text-yellow-600">
            ⏳ Waiting for {peerName ?? "opponent"}'s move…
          </p>
        </div>
      )}

      {!result && !waitingForPeer && (
        <div className="mb-6 text-center">
          <p className="text-sm text-muted-foreground">
            Choose your weapon!
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {RPS_CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            disabled={hasPeer && !!playerChoice}
            onClick={() => play(choice.value)}
            className="rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-1 hover:bg-muted active:scale-95 disabled:opacity-40"
          >
            <div className="text-4xl">{choice.emoji}</div>
            <div className="mt-2 text-xs font-semibold">
              {choice.label}
            </div>
          </button>
        ))}
      </div>

      {result && (
        <button
          type="button"
          onClick={reset}
          className="mx-auto mt-5 flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-muted active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
          Next Round
        </button>
      )}
    {gamingMatch.RewardModal}
    </div>
  );
}

/* =========================================================
   EMOJI GUESS — TWO PLAYER RACE
========================================================= */

function EmojiGuess({
  onBack,
  sync,
  userId,
  peerId,
  peerName,
}: {
  onBack: () => void;
  sync: GameSync;
  userId: string;
  peerId?: string | null;
  peerName?: string | null;
}) {
  const hasPeer = !!peerId;
  const amHost = !hasPeer || userId < (peerId as string);

  const gamingMatch = useGamingMatchSession({
    sync,
    userId,
    peerId,
    gameType: "emoji",
    isBot: !hasPeer,
  });

  const [question, setQuestion] = useState(() =>
    getRandomItem(EMOJI_QUESTIONS),
  );

  const [answer, setAnswer] = useState("");
  const [myScore, setMyScore] = useState(0);
  const [peerScore, setPeerScore] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [lastWinner, setLastWinner] = useState<
    string | null
  >(null);

  const pickQuestion = useCallback(() => {
    let next = getRandomItem(EMOJI_QUESTIONS);

    while (
      next.emojis === question.emojis &&
      EMOJI_QUESTIONS.length > 1
    ) {
      next = getRandomItem(EMOJI_QUESTIONS);
    }

    return next;
  }, [question]);

  useEffect(() => {
    if (!hasPeer) return;

    const offQuestion = sync.on(
      "emoji_question",
      (data) => {
        setQuestion(data.question);
        setAnswer("");
        setWrong(false);
        setLastWinner(null);
      },
    );

    const offCorrect = sync.on("emoji_correct", (data) => {
      if (data.by === userId) {
        setMyScore((s) => s + 1);
        setLastWinner("You");
      } else {
        setPeerScore((s) => s + 1);
        setLastWinner(peerName ?? "Opponent");
      }
    });

    if (amHost) {
      sync.send("emoji_question", { question });
    }

    return () => {
      offQuestion();
      offCorrect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync, hasPeer]);

  const submit = () => {
    const normalized = answer
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "");

    const correct = question.answer
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "");

    if (normalized !== correct) {
      setWrong(true);
      return;
    }

    if (hasPeer) {
      sync.send("emoji_correct", { by: userId });

      setMyScore((s) => s + 1);
      setLastWinner("You");

      void gamingMatch.complete({
        result: "win",
        winnerId: userId,
        loserId: peerId ?? null,
      }).then(() => {
        // New match for the next question — never reuse the previous matchId
        gamingMatch.start();
      });

      const next = pickQuestion();
      setQuestion(next);
      setAnswer("");
      setWrong(false);

      sync.send("emoji_question", { question: next });
      return;
    }

    setMyScore((s) => s + 1);

    void gamingMatch.complete({
      result: "win",
      winnerId: userId,
      loserId: null,
    }).then(() => {
      gamingMatch.start();
    });

    const next = pickQuestion();
    setQuestion(next);
    setAnswer("");
    setWrong(false);
  };

  const skip = () => {
    const next = pickQuestion();

    setQuestion(next);
    setAnswer("");
    setWrong(false);
    setLastWinner(null);

    if (hasPeer) {
      sync.send("emoji_question", { question: next });
    }
  };

  return (
    <div className="w-full">
      <GameHeader
        title="🧠 Emoji Guess"
        onBack={onBack}
        status={hasPeer ? "First to answer wins" : "Practice mode"}
      />

      {hasPeer && (
        <PeerBanner
          peerPresent={sync.peerPresent}
          peerName={peerName}
        />
      )}

      <div className="mb-5 flex justify-center gap-3">
        <div className="rounded-xl bg-blue-600/10 px-4 py-2 text-sm font-bold">
          🏆 You: {myScore}
        </div>

        {hasPeer && (
          <div className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-bold">
            🏆 {peerName ?? "Opponent"}: {peerScore}
          </div>
        )}
      </div>

      {lastWinner && (
        <p className="mb-3 text-center text-xs font-semibold text-green-600">
          {lastWinner} got it! Next question loaded.
        </p>
      )}

      <div className="mb-5 rounded-3xl border bg-card p-8 text-center shadow-sm">
        <p className="mb-5 text-xs text-muted-foreground">
          Guess the movie
        </p>

        <div className="text-6xl">{question.emojis}</div>
      </div>

      <input
        value={answer}
        onChange={(event) => {
          setAnswer(event.target.value);
          setWrong(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
        }}
        placeholder="Type your answer..."
        className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition focus:ring-2"
      />

      {wrong && (
        <p className="mt-2 text-center text-xs font-semibold text-red-500">
          ❌ Not quite! Try again.
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition hover:bg-blue-700 active:scale-[0.98]"
      >
        Guess 🎯
      </button>

      <button
        type="button"
        onClick={skip}
        className="mx-auto mt-3 block text-xs text-muted-foreground underline"
      >
        Skip question
      </button>
    {gamingMatch.RewardModal}
    </div>
  );
}

/* =========================================================
   REACTION BATTLE — TWO PLAYER RACE
========================================================= */

function ReactionBattle({
  onBack,
  sync,
  userId,
  peerId,
  peerName,
}: {
  onBack: () => void;
  sync: GameSync;
  userId: string;
  peerId?: string | null;
  peerName?: string | null;
}) {
  const hasPeer = !!peerId;

  const gamingMatch = useGamingMatchSession({
    sync,
    userId,
    peerId,
    gameType: "reaction",
    isBot: !hasPeer,
  });

  const [state, setState] = useState<
    "idle" | "waiting" | "ready" | "result" | "tooSoon"
  >("idle");

  const [reactionTime, setReactionTime] = useState<
    number | null
  >(null);

  const [peerTime, setPeerTime] = useState<
    number | null
  >(null);

  const [bestTime, setBestTime] = useState<
    number | null
  >(null);

  const [startTime, setStartTime] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (!hasPeer) return;

    const offStart = sync.on("reaction_start", () => {
      setState("waiting");
      setReactionTime(null);
      setPeerTime(null);
      setStartTime(null);

      const delay = 1500 + Math.random() * 3500;

      setTimeout(() => {
        setStartTime(performance.now());
        setState("ready");
      }, delay);
    });

    const offTime = sync.on("reaction_time", (data) => {
      setPeerTime(data.ms);
    });

    return () => {
      offStart();
      offTime();
    };
  }, [sync, hasPeer]);

  const start = () => {
    // Fresh match session for every new reaction attempt
    gamingMatch.start();

    setState("waiting");
    setReactionTime(null);
    setPeerTime(null);
    setStartTime(null);

    if (hasPeer) {
      sync.send("reaction_start", {});
    }

    const delay = 1500 + Math.random() * 3500;

    setTimeout(() => {
      setStartTime(performance.now());
      setState("ready");
    }, delay);
  };

  const handleTap = () => {
    if (state === "idle") {
      start();
      return;
    }

    if (state === "waiting") {
      setState("tooSoon");
      return;
    }

    if (state === "ready" && startTime) {
      const time = Math.round(
        performance.now() - startTime,
      );

      setReactionTime(time);

      setBestTime((current) =>
        current === null ? time : Math.min(current, time),
      );

      setState("result");

      if (hasPeer) {
        sync.send("reaction_time", { ms: time });
      }
      return;
    }

    if (state === "result" || state === "tooSoon") {
      start();
    }
  };

  const buttonText = {
    idle: "TAP TO START",
    waiting: "WAIT...",
    ready: "TAP NOW!",
    result: reactionTime != null ? `${reactionTime}ms` : "...",
    tooSoon: "TOO SOON!",
  }[state];

  const showMatchup =
    hasPeer &&
    state === "result" &&
    reactionTime != null &&
    peerTime != null;

  useEffect(() => {
    if (!showMatchup) return;

    const result = reactionTime! < peerTime!
      ? "win"
      : reactionTime! > peerTime!
        ? "loss"
        : "draw";
    void gamingMatch.complete({
      result,
      winnerId: result === "draw" ? null : result === "win" ? userId : peerId ?? null,
      loserId: result === "draw" ? null : result === "win" ? peerId ?? null : userId,
    });
  }, [gamingMatch.complete, peerId, peerTime, reactionTime, showMatchup, userId]);

  return (
    <div className="w-full">
      <GameHeader
        title="⚡ Reaction Battle"
        onBack={onBack}
        status={hasPeer ? "Live vs opponent" : "Practice mode"}
      />

      {hasPeer && (
        <PeerBanner
          peerPresent={sync.peerPresent}
          peerName={peerName}
        />
      )}

      <div className="mb-6 text-center">
        <p className="text-sm text-muted-foreground">
          Tap only when the button turns green.
        </p>

        {bestTime !== null && (
          <div className="mt-2 text-xs font-semibold">
            🏆 Best: {bestTime}ms
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleTap}
        className={`mx-auto flex aspect-square w-64 max-w-full items-center justify-center rounded-full text-center text-lg font-black text-white shadow-2xl transition active:scale-95 ${
          state === "ready"
            ? "bg-green-500"
            : state === "tooSoon"
              ? "bg-red-500"
              : "bg-blue-600"
        }`}
      >
        {buttonText}
      </button>

      <div className="mt-6 text-center">
        {state === "idle" && (
          <p className="text-xs text-muted-foreground">
            Get ready...
          </p>
        )}

        {state === "waiting" && (
          <p className="text-xs font-semibold">
            👀 Wait for green!
          </p>
        )}

        {state === "ready" && (
          <p className="text-xs font-bold text-green-600">
            ⚡ TAP!
          </p>
        )}

        {state === "tooSoon" && (
          <p className="text-xs font-bold text-red-500">
            😂 Too fast! Try again.
          </p>
        )}

        {state === "result" && !showMatchup && (
          <p className="text-xs font-semibold">
            🔥 Nice! Try to beat your record.
          </p>
        )}

        {showMatchup && (
          <p className="text-xs font-bold">
            {reactionTime! < peerTime!
              ? `🏆 You beat ${peerName ?? "them"}! (${reactionTime}ms vs ${peerTime}ms)`
              : reactionTime! > peerTime!
                ? `😅 ${peerName ?? "They"} were faster (${peerTime}ms vs ${reactionTime}ms)`
                : "🤝 Tied!"}
          </p>
        )}
      </div>

      {(state === "result" || state === "tooSoon") && (
        <button
          type="button"
          onClick={start}
          className="mx-auto mt-5 flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-muted active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
          Try Again
        </button>
      )}
    {gamingMatch.RewardModal}
    </div>
  );
}

/* =========================================================
   CHESS — TWO PLAYER OR VS PROGRAMMED BOT
========================================================= */

function ChessGame({
  onBack,
  sync,
  userId,
  peerId,
  peerName,
}: {
  onBack: () => void;
  sync: GameSync;
  userId: string;
  peerId?: string | null;
  peerName?: string | null;
}) {
  const hasPeer = !!peerId;

  const isHost = !hasPeer || userId < (peerId as string);

  const [mode, setMode] = useState<
    "select" | "friend" | "bot"
  >(hasPeer ? "select" : "bot");

  const gamingMatch = useGamingMatchSession({
    sync,
    userId,
    peerId: mode === "friend" ? peerId : null,
    gameType: "chess",
    isBot: mode === "bot",
    enabled: mode !== "select",
  });

  const [board, setBoard] = useState<ChessBoard>(() =>
    createInitialChessBoard(),
  );

  const [turnColor, setTurnColor] =
    useState<PieceColor>("w");

  const [selected, setSelected] = useState<{
    r: number;
    c: number;
  } | null>(null);

  const [status, setStatus] =
    useState<ChessStatus>("playing");

  const [botThinking, setBotThinking] = useState(false);

  const myColor: PieceColor =
    mode === "bot" ? "w" : isHost ? "w" : "b";

  const flipped = myColor === "b";

  const legalTargets = useMemo(() => {
    if (!selected) return [];

    return generateChessLegalMoves(
      board,
      turnColor,
    ).filter(
      (move) =>
        move.fr === selected.r && move.fc === selected.c,
    );
  }, [board, turnColor, selected]);

  const isMyTurn =
    mode === "bot"
      ? turnColor === "w"
      : turnColor === myColor;

  const gameOver =
    status === "checkmate" || status === "stalemate";

  useEffect(() => {
    if (mode !== "friend") return;

    const offMove = sync.on("chess_move", (data) => {
      setBoard((prev) => applyChessMove(prev, data.move));
      setTurnColor((prev) => (prev === "w" ? "b" : "w"));
      setSelected(null);
    });

    const offNew = sync.on("chess_new", () => {
      setBoard(createInitialChessBoard());
      setTurnColor("w");
      setSelected(null);
      setStatus("playing");
    });

    const offSync = sync.on("chess_sync", (data) => {
      setBoard(data.board);
      setTurnColor(data.turn);
    });

    return () => {
      offMove();
      offNew();
      offSync();
    };
  }, [mode, sync]);

  useEffect(() => {
    if (mode !== "friend" || !isHost) return;
    if (!sync.peerPresent) return;

    sync.send("chess_sync", { board, turn: turnColor });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.peerPresent, mode, isHost]);

  useEffect(() => {
    setStatus(getChessStatus(board, turnColor));
  }, [board, turnColor]);

  useEffect(() => {
    if (mode !== "bot") return;
    if (turnColor !== "b") return;
    if (gameOver) return;

    setBotThinking(true);

    const timer = window.setTimeout(() => {
      setBoard((prev) => {
        const move = chooseChessBotMove(prev, "b");
        return move ? applyChessMove(prev, move) : prev;
      });

      setTurnColor("w");
      setBotThinking(false);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [mode, turnColor, gameOver]);

  const handleSquareTap = (r: number, c: number) => {
    if (gameOver) return;
    if (!isMyTurn) return;
    if (mode === "bot" && botThinking) return;

    const piece = board[r][c];

    if (selected) {
      const target = legalTargets.find(
        (move) => move.tr === r && move.tc === c,
      );

      if (target) {
        setBoard((prev) => applyChessMove(prev, target));
        setTurnColor((prev) => (prev === "w" ? "b" : "w"));
        setSelected(null);

        if (mode === "friend") {
          sync.send("chess_move", { move: target });
        }
        return;
      }

      if (piece && piece.color === myColor) {
        setSelected({ r, c });
        return;
      }

      setSelected(null);
      return;
    }

    if (piece && piece.color === myColor) {
      setSelected({ r, c });
    }
  };

  const startNewGame = () => {
    gamingMatch.start();
    setBoard(createInitialChessBoard());
    setTurnColor("w");
    setSelected(null);
    setStatus("playing");

    if (mode === "friend") {
      sync.send("chess_new", {});
    }
  };

  const outcome: "win" | "lose" | "draw" | null =
    status === "stalemate"
      ? "draw"
      : status === "checkmate"
        ? (turnColor === "w" ? "b" : "w") === myColor
          ? "win"
          : "lose"
        : null;

  useEffect(() => {
    if (!outcome) return;
    const winnerId = outcome === "win" ? userId : peerId ?? null;
    const loserId = outcome === "win" ? peerId ?? null : userId;
    void gamingMatch.complete({ result: outcome, winnerId, loserId });
  }, [gamingMatch.complete, outcome, peerId, userId]);

  if (mode === "select") {
    return (
      <div className="w-full">
        <GameHeader
          title="♟️ Chess"
          onBack={onBack}
          status="Choose an opponent"
        />

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setMode("friend")}
            className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:bg-muted active:scale-95"
          >
            <div className="text-sm font-bold">
              🧑‍🤝‍🧑 Play vs {peerName ?? "Friend"}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Live, synced in real time
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode("bot")}
            className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:bg-muted active:scale-95"
          >
            <div className="text-sm font-bold">
              🤖 Play vs Bot
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Practice anytime, no waiting
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <GameHeader
        title="♟️ Chess"
        onBack={onBack}
        status={
          mode === "bot"
            ? botThinking
              ? "Bot is thinking…"
              : isMyTurn
                ? "Your turn"
                : "Bot's turn"
            : isMyTurn
              ? "Your turn"
              : `${peerName ?? "Opponent"}'s turn`
        }
      />

      {mode === "friend" && (
        <PeerBanner
          peerPresent={sync.peerPresent}
          peerName={peerName}
        />
      )}

      {status === "check" && !gameOver && (
        <div className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-center text-xs font-semibold text-red-600">
          ⚠️ Check!
        </div>
      )}

      <div className="mx-auto mb-2 flex max-w-xs items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>You: {myColor === "w" ? "White ♙" : "Black ♟"}</span>
        <span>
          {mode === "bot" ? "Bot" : peerName ?? "Opponent"}:{" "}
          {myColor === "w" ? "Black ♟" : "White ♙"}
        </span>
      </div>

      <div className="mx-auto grid max-w-xs grid-cols-8 overflow-hidden rounded-xl border shadow-sm">
        {Array.from({ length: 8 }).map((_, rowIdx) => {
          const r = flipped ? 7 - rowIdx : rowIdx;

          return Array.from({ length: 8 }).map(
            (_, colIdx) => {
              const c = flipped ? 7 - colIdx : colIdx;
              const piece = board[r][c];
              const isDark = (r + c) % 2 === 1;
              const isSelected =
                selected &&
                selected.r === r &&
                selected.c === c;
              const isTarget = legalTargets.some(
                (move) => move.tr === r && move.tc === c,
              );

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => handleSquareTap(r, c)}
                  className={`relative flex aspect-square items-center justify-center text-xl ${
                    isDark
                      ? "bg-emerald-800/70"
                      : "bg-emerald-100"
                  } ${
                    isSelected
                      ? "ring-2 ring-blue-500 ring-inset"
                      : ""
                  }`}
                >
                  {piece && (
                    <span
                      className={
                        piece.color === "w"
                          ? "text-white drop-shadow"
                          : "text-black"
                      }
                    >
                      {CHESS_UNICODE[piece.color][piece.type]}
                    </span>
                  )}

                  {isTarget && (
                    <span className="absolute h-2.5 w-2.5 rounded-full bg-blue-500/70" />
                  )}
                </button>
              );
            },
          );
        })}
      </div>

      {gameOver && (
        <div className="mt-5 rounded-2xl border bg-card p-5 text-center">
          <div className="text-xl font-black">
            {outcome === "draw"
              ? "🤝 Draw!"
              : outcome === "win"
                ? "🏆 You Win!"
                : "😅 You Lost!"}
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            {status === "checkmate" ? "Checkmate" : "Stalemate"}
          </p>

          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={startNewGame}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              Play Again
            </button>

            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-muted active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      )}
    {gamingMatch.RewardModal}
    </div>
  );
}

/* =========================================================
   CHECKERS — TWO PLAYER OR VS PROGRAMMED BOT
========================================================= */

function CheckersGame({
  onBack,
  sync,
  userId,
  peerId,
  peerName,
}: {
  onBack: () => void;
  sync: GameSync;
  userId: string;
  peerId?: string | null;
  peerName?: string | null;
}) {
  const hasPeer = !!peerId;
  const isHost = !hasPeer || userId < (peerId as string);

  const [mode, setMode] = useState<
    "select" | "friend" | "bot"
  >(hasPeer ? "select" : "bot");

  const gamingMatch = useGamingMatchSession({
    sync,
    userId,
    peerId: mode === "friend" ? peerId : null,
    gameType: "checkers",
    isBot: mode === "bot",
    enabled: mode !== "select",
  });

  const [state, setState] = useState<CheckersState>(() => ({
    board: createInitialCheckersBoard(),
    turn: "r",
    forced: null,
    noCapture: 0,
  }));

  const [selected, setSelected] = useState<{
    r: number;
    c: number;
  } | null>(null);

  const [botThinking, setBotThinking] = useState(false);

  const myColor: CheckersColor =
    mode === "bot" ? "r" : isHost ? "r" : "b";

  const flipped = myColor === "b";

  const isMyTurn =
    mode === "bot"
      ? state.turn === "r"
      : state.turn === myColor;

  const legalMoves = useMemo(() => {
    if (!isMyTurn) return [];
    return generateCheckersMoves(
      state.board,
      state.turn,
      state.forced,
    );
  }, [state.board, state.turn, state.forced, isMyTurn]);

  const activeSelected = state.forced ?? selected;

  const targetsForSelected = useMemo(() => {
    if (!activeSelected) return [];

    return legalMoves.filter(
      (move) =>
        move.fr === activeSelected.r &&
        move.fc === activeSelected.c,
    );
  }, [legalMoves, activeSelected]);

  const outcome = useMemo(():
    | { type: "win" | "lose" | "draw"; }
    | null => {
    if (state.noCapture >= CHECKERS_DRAW_LIMIT) {
      return { type: "draw" };
    }

    const moves = generateCheckersMoves(
      state.board,
      state.turn,
      state.forced,
    );

    const hasPieces = state.board.some((row) =>
      row.some((p) => p && p.color === state.turn),
    );

    if (!hasPieces || moves.length === 0) {
      const winnerColor: CheckersColor =
        state.turn === "r" ? "b" : "r";

      return {
        type: winnerColor === myColor ? "win" : "lose",
      };
    }

    return null;
  }, [state, myColor]);

  const gameOver = outcome !== null;

  useEffect(() => {
    if (!outcome) return;
    const winnerId = outcome.type === "win" ? userId : peerId ?? null;
    const loserId = outcome.type === "win" ? peerId ?? null : userId;
    void gamingMatch.complete({
      result: outcome.type,
      winnerId,
      loserId,
    });
  }, [gamingMatch.complete, outcome, peerId, userId]);

  const commitLocalMove = useCallback(
    (move: CheckersMove) => {
      setState((prev) => {
        const result = stepCheckersMove(
          prev.board,
          prev.turn,
          move,
        );

        const noCapture = result.wasCapture
          ? 0
          : prev.noCapture + (result.forced ? 0 : 1);

        return {
          board: result.board,
          turn: result.turn,
          forced: result.forced,
          noCapture,
        };
      });

      setSelected(null);

      if (mode === "friend") {
        sync.send("checkers_move", { move });
      }
    },
    [mode, sync],
  );

  useEffect(() => {
    if (mode !== "friend") return;

    const offMove = sync.on("checkers_move", (data) => {
      setState((prev) => {
        const result = stepCheckersMove(
          prev.board,
          prev.turn,
          data.move,
        );

        const noCapture = result.wasCapture
          ? 0
          : prev.noCapture + (result.forced ? 0 : 1);

        return {
          board: result.board,
          turn: result.turn,
          forced: result.forced,
          noCapture,
        };
      });

      setSelected(null);
    });

    const offNew = sync.on("checkers_new", () => {
      setState({
        board: createInitialCheckersBoard(),
        turn: "r",
        forced: null,
        noCapture: 0,
      });

      setSelected(null);
    });

    const offSync = sync.on("checkers_sync", (data) => {
      setState({
        board: data.board,
        turn: data.turn,
        forced: data.forced,
        noCapture: data.noCapture,
      });
    });

    return () => {
      offMove();
      offNew();
      offSync();
    };
  }, [mode, sync]);

  useEffect(() => {
    if (mode !== "friend" || !isHost) return;
    if (!sync.peerPresent) return;

    sync.send("checkers_sync", {
      board: state.board,
      turn: state.turn,
      forced: state.forced,
      noCapture: state.noCapture,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.peerPresent, mode, isHost]);

  useEffect(() => {
    if (mode !== "bot") return;
    if (state.turn !== "b") return;
    if (gameOver) return;

    setBotThinking(true);

    const timer = window.setTimeout(() => {
      setState((prev) => {
        const move = chooseCheckersBotMove(
          prev.board,
          "b",
          prev.forced,
        );

        if (!move) return prev;

        const result = stepCheckersMove(
          prev.board,
          prev.turn,
          move,
        );

        const noCapture = result.wasCapture
          ? 0
          : prev.noCapture + (result.forced ? 0 : 1);

        return {
          board: result.board,
          turn: result.turn,
          forced: result.forced,
          noCapture,
        };
      });

      setBotThinking(false);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [mode, state.turn, state.forced, gameOver]);

  const handleSquareTap = (r: number, c: number) => {
    if (gameOver) return;
    if (!isMyTurn) return;
    if (mode === "bot" && botThinking) return;

    const piece = state.board[r][c];

    if (activeSelected) {
      const target = targetsForSelected.find(
        (move) => move.tr === r && move.tc === c,
      );

      if (target) {
        commitLocalMove(target);
        return;
      }

      if (state.forced) return;

      if (
        piece &&
        piece.color === myColor &&
        legalMoves.some(
          (move) => move.fr === r && move.fc === c,
        )
      ) {
        setSelected({ r, c });
        return;
      }

      setSelected(null);
      return;
    }

    if (
      piece &&
      piece.color === myColor &&
      legalMoves.some(
        (move) => move.fr === r && move.fc === c,
      )
    ) {
      setSelected({ r, c });
    }
  };

  const startNewGame = () => {
    gamingMatch.start();
    setState({
      board: createInitialCheckersBoard(),
      turn: "r",
      forced: null,
      noCapture: 0,
    });

    setSelected(null);

    if (mode === "friend") {
      sync.send("checkers_new", {});
    }
  };

  const mustCapture =
    isMyTurn &&
    !gameOver &&
    legalMoves.length > 0 &&
    !!legalMoves[0].capture;

  if (mode === "select") {
    return (
      <div className="w-full">
        <GameHeader
          title="🔴⚫ Checkers"
          onBack={onBack}
          status="Choose an opponent"
        />

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setMode("friend")}
            className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:bg-muted active:scale-95"
          >
            <div className="text-sm font-bold">
              🧑‍🤝‍🧑 Play vs {peerName ?? "Friend"}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Live, synced in real time
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode("bot")}
            className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:bg-muted active:scale-95"
          >
            <div className="text-sm font-bold">
              🤖 Play vs Bot
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Practice anytime, no waiting
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <GameHeader
        title="🔴⚫ Checkers"
        onBack={onBack}
        status={
          mode === "bot"
            ? botThinking
              ? "Bot is thinking…"
              : isMyTurn
                ? "Your turn"
                : "Bot's turn"
            : isMyTurn
              ? "Your turn"
              : `${peerName ?? "Opponent"}'s turn`
        }
      />

      {mode === "friend" && (
        <PeerBanner
          peerPresent={sync.peerPresent}
          peerName={peerName}
        />
      )}

      {mustCapture && (
        <div className="mb-3 rounded-xl bg-blue-500/10 px-3 py-2 text-center text-xs font-semibold text-blue-600">
          🔺 Capture available — you must jump
        </div>
      )}

      <div className="mx-auto mb-2 flex max-w-xs items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>
          You: {myColor === "r" ? "Red 🔴" : "Black ⚫"}
        </span>
        <span>
          {mode === "bot" ? "Bot" : peerName ?? "Opponent"}:{" "}
          {myColor === "r" ? "Black ⚫" : "Red 🔴"}
        </span>
      </div>

      <div className="mx-auto grid max-w-xs grid-cols-8 overflow-hidden rounded-xl border shadow-sm">
        {Array.from({ length: 8 }).map((_, rowIdx) => {
          const r = flipped ? 7 - rowIdx : rowIdx;

          return Array.from({ length: 8 }).map(
            (_, colIdx) => {
              const c = flipped ? 7 - colIdx : colIdx;
              const piece = state.board[r][c];
              const isDark = (r + c) % 2 === 1;
              const isSelected =
                activeSelected &&
                activeSelected.r === r &&
                activeSelected.c === c;
              const isTarget = targetsForSelected.some(
                (move) => move.tr === r && move.tc === c,
              );

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => handleSquareTap(r, c)}
                  className={`relative flex aspect-square items-center justify-center ${
                    isDark ? "bg-amber-900/60" : "bg-amber-100"
                  } ${
                    isSelected
                      ? "ring-2 ring-blue-500 ring-inset"
                      : ""
                  }`}
                >
                  {piece && (
                    <div
                      className={`flex h-[75%] w-[75%] items-center justify-center rounded-full shadow-md ${
                        piece.color === "r"
                          ? "bg-red-600"
                          : "bg-zinc-900"
                      }`}
                    >
                      {piece.king && (
                        <Crown className="h-4 w-4 text-yellow-300" />
                      )}
                    </div>
                  )}

                  {isTarget && (
                    <span className="absolute h-2.5 w-2.5 rounded-full bg-blue-500/70" />
                  )}
                </button>
              );
            },
          );
        })}
      </div>

      {gameOver && (
        <div className="mt-5 rounded-2xl border bg-card p-5 text-center">
          <div className="text-xl font-black">
            {outcome?.type === "draw"
              ? "🤝 Draw!"
              : outcome?.type === "win"
                ? "🏆 You Win!"
                : "😅 You Lost!"}
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            {outcome?.type === "draw"
              ? "40 moves without a capture"
              : "No legal moves left"}
          </p>

          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={startNewGame}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              Play Again
            </button>

            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-muted active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      )}
    {gamingMatch.RewardModal}
    </div>
  );
}

/* =========================================================
   LUDO — TWO PLAYER OR VS PROGRAMMED BOT

   Like Chess/Checkers, host (lower userId) always plays Red
   and moves first — no coin flip. Simplified 28-square shared
   loop with 4-square private home stretch per color; capture
   sends an opponent token back to its yard. Full state is
   re-shared to a late-joining peer via "ludo_sync", same
   pattern as the other two-player games above.
========================================================= */

function LudoGame({
  onBack,
  sync,
  userId,
  peerId,
  peerName,
}: {
  onBack: () => void;
  sync: GameSync;
  userId: string;
  peerId?: string | null;
  peerName?: string | null;
}) {
  const hasPeer = !!peerId;
  const isHost = !hasPeer || userId < (peerId as string);

  const [mode, setMode] = useState<
    "select" | "friend" | "bot"
  >(hasPeer ? "select" : "bot");

  const gamingMatch = useGamingMatchSession({
    sync,
    userId,
    peerId: mode === "friend" ? peerId : null,
    gameType: "ludo",
    isBot: mode === "bot",
    enabled: mode !== "select",
  });

  const [state, setState] = useState<LudoState>(() =>
    createInitialLudoState(),
  );

  const [botThinking, setBotThinking] = useState(false);

  const myColor: LudoColor =
    mode === "bot" ? "red" : isHost ? "red" : "blue";

  const isMyTurn =
    mode === "bot"
      ? state.turn === "red"
      : state.turn === myColor;

  const gameOver =
    isLudoWinner(state.tokens, "red") ||
    isLudoWinner(state.tokens, "blue");

  const outcome: "win" | "lose" | null = gameOver
    ? isLudoWinner(state.tokens, myColor)
      ? "win"
      : "lose"
    : null;

  useEffect(() => {
    if (!outcome) return;
    const winnerId = outcome === "win" ? userId : peerId ?? null;
    const loserId = outcome === "win" ? peerId ?? null : userId;
    void gamingMatch.complete({ result: outcome, winnerId, loserId });
  }, [gamingMatch.complete, outcome, peerId, userId]);

  const legalForCurrentDice =
    state.dice !== null
      ? getLudoLegalMoves(
          state.tokens,
          state.turn,
          state.dice,
        )
      : [];

  useEffect(() => {
    if (mode !== "friend") return;

    const offRoll = sync.on("ludo_roll", (data) => {
      setState((prev) => ({ ...prev, dice: data.dice }));
    });

    const offMove = sync.on("ludo_move", (data) => {
      setState((prev) => {
        const { tokens } = applyLudoMove(
          prev.tokens,
          prev.turn,
          data.tokenIndex,
          data.dice,
        );

        const six = data.dice === 6;

        return {
          tokens,
          turn: six
            ? prev.turn
            : prev.turn === "red"
              ? "blue"
              : "red",
          dice: null,
        };
      });
    });

    const offPass = sync.on("ludo_pass", () => {
      setState((prev) => ({
        ...prev,
        turn: prev.turn === "red" ? "blue" : "red",
        dice: null,
      }));
    });

    const offNew = sync.on("ludo_new", () => {
      setState(createInitialLudoState());
    });

    const offSync = sync.on("ludo_sync", (data) => {
      setState(data.state);
    });

    return () => {
      offRoll();
      offMove();
      offPass();
      offNew();
      offSync();
    };
  }, [mode, sync]);

  useEffect(() => {
    if (mode !== "friend" || !isHost) return;
    if (!sync.peerPresent) return;

    sync.send("ludo_sync", { state });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.peerPresent, mode, isHost]);

  const rollDice = () => {
    if (!isMyTurn || gameOver || state.dice !== null) return;
    if (mode === "bot" && botThinking) return;

    const value = 1 + Math.floor(Math.random() * 6);

    setState((prev) => ({ ...prev, dice: value }));

    if (mode === "friend") {
      sync.send("ludo_roll", { dice: value });
    }

    const legal = getLudoLegalMoves(
      state.tokens,
      state.turn,
      value,
    );

    if (legal.length === 0) {
      window.setTimeout(() => {
        setState((prev) => ({
          ...prev,
          turn: prev.turn === "red" ? "blue" : "red",
          dice: null,
        }));

        if (mode === "friend") {
          sync.send("ludo_pass", {});
        }
      }, 700);
    }
  };

  const moveToken = (idx: number) => {
    if (!isMyTurn || gameOver) return;
    if (state.dice === null) return;
    if (mode === "bot" && botThinking) return;

    const legal = getLudoLegalMoves(
      state.tokens,
      state.turn,
      state.dice,
    );

    if (!legal.includes(idx)) return;

    const dice = state.dice;

    const { tokens } = applyLudoMove(
      state.tokens,
      state.turn,
      idx,
      dice,
    );

    const six = dice === 6;

    setState((prev) => ({
      tokens,
      turn: six
        ? prev.turn
        : prev.turn === "red"
          ? "blue"
          : "red",
      dice: null,
    }));

    if (mode === "friend") {
      sync.send("ludo_move", { tokenIndex: idx, dice });
    }
  };

  // Bot's turn.
  useEffect(() => {
    if (mode !== "bot") return;
    if (state.turn !== "blue") return;
    if (gameOver) return;
    if (botThinking) return;

    setBotThinking(true);

    const rollTimer = window.setTimeout(() => {
      const value = 1 + Math.floor(Math.random() * 6);
      const legal = getLudoLegalMoves(
        state.tokens,
        "blue",
        value,
      );

      if (legal.length === 0) {
        window.setTimeout(() => {
          setState((prev) => ({
            ...prev,
            turn: "red",
            dice: null,
          }));

          setBotThinking(false);
        }, 500);

        return;
      }

      const chosen = chooseLudoBotMove(
        state.tokens,
        "blue",
        value,
      );

      window.setTimeout(() => {
        if (chosen === null) {
          setState((prev) => ({
            ...prev,
            turn: "red",
            dice: null,
          }));

          setBotThinking(false);
          return;
        }

        const { tokens } = applyLudoMove(
          state.tokens,
          "blue",
          chosen,
          value,
        );

        const six = value === 6;

        setState({
          tokens,
          turn: six ? "blue" : "red",
          dice: null,
        });

        setBotThinking(false);
      }, 600);
    }, 500);

    return () => window.clearTimeout(rollTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, state.turn, gameOver]);

  const startNewGame = () => {
    gamingMatch.start();
    setState(createInitialLudoState());

    if (mode === "friend") {
      sync.send("ludo_new", {});
    }
  };

  const renderToken = (color: LudoColor) => (
    <span
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${
        color === "red" ? "bg-red-600" : "bg-blue-600"
      }`}
    >
      {color === "red" ? "R" : "B"}
    </span>
  );

  if (mode === "select") {
    return (
      <div className="w-full">
        <GameHeader
          title="🎲 Ludo"
          onBack={onBack}
          status="Choose an opponent"
        />

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setMode("friend")}
            className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:bg-muted active:scale-95"
          >
            <div className="text-sm font-bold">
              🧑‍🤝‍🧑 Play vs {peerName ?? "Friend"}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Live, synced in real time
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode("bot")}
            className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:bg-muted active:scale-95"
          >
            <div className="text-sm font-bold">
              🤖 Play vs Bot
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Practice anytime, no waiting
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <GameHeader
        title="🎲 Ludo"
        onBack={onBack}
        status={
          mode === "bot"
            ? botThinking
              ? "Bot is playing…"
              : isMyTurn
                ? "Your turn"
                : "Bot's turn"
            : isMyTurn
              ? "Your turn"
              : `${peerName ?? "Opponent"}'s turn`
        }
      />

      {mode === "friend" && (
        <PeerBanner
          peerPresent={sync.peerPresent}
          peerName={peerName}
        />
      )}

      <div className="mb-4 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={rollDice}
          disabled={
            !isMyTurn ||
            gameOver ||
            state.dice !== null ||
            (mode === "bot" && botThinking)
          }
          className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 bg-card text-2xl font-black shadow-sm transition active:scale-95 disabled:opacity-40"
        >
          {state.dice ?? "🎲"}
        </button>

        <p className="text-xs text-muted-foreground">
          {gameOver
            ? ""
            : isMyTurn
              ? state.dice === null
                ? "Tap to roll"
                : "Tap a highlighted token to move"
              : `${
                  mode === "bot"
                    ? "Bot"
                    : peerName ?? "Opponent"
                } is playing…`}
        </p>
      </div>

      <div className="mx-auto grid max-w-xs grid-cols-7 gap-1">
        {Array.from({ length: LUDO_TRACK_LEN }).map(
          (_, cell) => {
            const here: {
              color: LudoColor;
              idx: number;
            }[] = [];

            (["red", "blue"] as LudoColor[]).forEach(
              (color) => {
                state.tokens[color].forEach(
                  (pos, idx) => {
                    if (ludoBoardCell(color, pos) === cell) {
                      here.push({ color, idx });
                    }
                  },
                );
              },
            );

            const isSafe = LUDO_SAFE_CELLS.includes(cell);

            return (
              <div
                key={cell}
                className={`flex aspect-square items-center justify-center rounded-md border ${
                  isSafe
                    ? "border-yellow-500/40 bg-yellow-500/10"
                    : "bg-muted/40"
                }`}
              >
                {here.length === 0 ? (
                  <span className="text-[9px] text-muted-foreground">
                    {isSafe ? "★" : ""}
                  </span>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-0.5">
                    {here.map((token) => {
                      const canMove =
                        isMyTurn &&
                        !gameOver &&
                        state.dice !== null &&
                        token.color === myColor &&
                        legalForCurrentDice.includes(
                          token.idx,
                        );

                      return (
                        <button
                          key={`${token.color}-${token.idx}`}
                          type="button"
                          onClick={() =>
                            moveToken(token.idx)
                          }
                          disabled={!canMove}
                          className={
                            canMove
                              ? "animate-pulse"
                              : "opacity-90"
                          }
                        >
                          {renderToken(token.color)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>

      {(["red", "blue"] as LudoColor[]).map((color) => (
        <div key={color} className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-xl border bg-card p-2 text-xs">
            <span className="font-semibold">
              {color === "red" ? "🔴 Red" : "🔵 Blue"} yard
            </span>

            <div className="flex gap-1">
              {state.tokens[color].map((pos, idx) => {
                const canMove =
                  pos === -1 &&
                  isMyTurn &&
                  !gameOver &&
                  color === myColor &&
                  state.dice !== null &&
                  legalForCurrentDice.includes(idx);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => moveToken(idx)}
                    disabled={pos !== -1 || !canMove}
                    className={
                      pos === -1
                        ? canMove
                          ? "animate-pulse"
                          : "opacity-40"
                        : "opacity-10"
                    }
                  >
                    {renderToken(color)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border bg-card p-2 text-xs">
            <span className="font-semibold">
              Home stretch
            </span>

            <div className="flex gap-1">
              {[0, 1, 2, 3].map((step) => {
                const boardPos = LUDO_TRACK_LEN + step;

                const tokenIdx = state.tokens[
                  color
                ].findIndex((p) => p === boardPos);

                const canMove =
                  tokenIdx !== -1 &&
                  isMyTurn &&
                  !gameOver &&
                  color === myColor &&
                  state.dice !== null &&
                  legalForCurrentDice.includes(tokenIdx);

                return (
                  <div
                    key={step}
                    className="flex h-5 w-5 items-center justify-center rounded border bg-muted/40"
                  >
                    {tokenIdx !== -1 && (
                      <button
                        type="button"
                        onClick={() =>
                          moveToken(tokenIdx)
                        }
                        disabled={!canMove}
                        className={
                          canMove ? "animate-pulse" : ""
                        }
                      >
                        {renderToken(color)}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            {color === "red" ? "🔴 Red" : "🔵 Blue"} finished:{" "}
            {
              state.tokens[color].filter(
                (p) => p === LUDO_FINISH,
              ).length
            }
            /4
          </p>
        </div>
      ))}

      {gameOver && (
        <div className="mt-5 rounded-2xl border bg-card p-5 text-center">
          <div className="text-xl font-black">
            {outcome === "win" ? "🏆 You Win!" : "😅 You Lost!"}
          </div>

          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={startNewGame}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              Play Again
            </button>

            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-muted active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      )}
    {gamingMatch.RewardModal}
    </div>
  );
}

/* =========================================================
   IN-GAME CHAT BUBBLE (💬)

   CRITICAL: this does NOT create a second messaging system.
   It renders messages passed down from the parent chat
   ($id.tsx's own `messages` state, which is already kept
   live by the existing realtime pipeline) and sends new ones
   through `onSendChatMessage`, which the parent wires to its
   own existing `sendMessage` function. So every message sent
   here is a completely normal WHATSXUP message — it lands in
   the same `messages` table, goes out over the same `room:$id`
   broadcast, and is still there if the user closes the game
   and looks at the regular chat.
========================================================= */

/* =========================================================
   FLOATING BUTTON POSITION

   Persisted per-device so the button stays where the person
   last dragged it, across game sessions. Falls back to the
   original bottom-right spot on first use or if storage is
   unavailable.
========================================================= */

const BUBBLE_POSITION_KEY = "whatsxup-game-chat-bubble-pos";
const BUBBLE_SIZE = 48;
const BUBBLE_MARGIN = 16;
const DRAG_THRESHOLD = 6;

function loadBubblePosition(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(BUBBLE_POSITION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (
      typeof parsed?.x === "number" &&
      typeof parsed?.y === "number"
    ) {
      return parsed;
    }
  } catch {
    // Fall through to default position.
  }

  return null;
}

function saveBubblePosition(position: { x: number; y: number }) {
  try {
    localStorage.setItem(
      BUBBLE_POSITION_KEY,
      JSON.stringify(position),
    );
  } catch {
    // Non-critical — position just won't persist this time.
  }
}

function defaultBubblePosition(): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x: 0, y: 0 };
  }

  return {
    x: window.innerWidth - BUBBLE_SIZE - BUBBLE_MARGIN,
    y: window.innerHeight - BUBBLE_SIZE - 96,
  };
}

function clampBubblePosition(x: number, y: number) {
  if (typeof window === "undefined") return { x, y };

  const maxX = window.innerWidth - BUBBLE_SIZE - BUBBLE_MARGIN / 2;
  const maxY = window.innerHeight - BUBBLE_SIZE - BUBBLE_MARGIN / 2;

  return {
    x: Math.min(Math.max(BUBBLE_MARGIN / 2, x), maxX),
    y: Math.min(Math.max(BUBBLE_MARGIN / 2, y), maxY),
  };
}

function GameChatBubble({
  messages,
  onSend,
  currentUserId,
  peerName,
}: {
  messages: Message[];
  onSend: (text: string) => Promise<boolean>;
  currentUserId: string;
  peerName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [position, setPosition] = useState(() =>
    loadBubblePosition() ?? defaultBubblePosition(),
  );

  const listRef = useRef<HTMLDivElement | null>(null);
  const lastSeenLength = useRef(messages.length);
  const dragState = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    dragging: boolean;
  } | null>(null);

  const quickPhrases = [
    "Your turn 😂",
    "Wait",
    "I'm done",
    "I won 😎",
    "Let's stop",
    "GG",
    "Bye",
  ];

  useEffect(() => {
    if (!open) return;

    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
    });
  }, [open, messages.length]);

  // Unread badge: only counts up while the panel is closed,
  // and only for messages that arrived from the other person.
  useEffect(() => {
    if (messages.length <= lastSeenLength.current) {
      lastSeenLength.current = messages.length;
      return;
    }

    const newOnes = messages.slice(lastSeenLength.current);
    lastSeenLength.current = messages.length;

    if (open) return;

    const fromPeer = newOnes.filter(
      (message) => message.sender_id !== currentUserId,
    );

    if (fromPeer.length > 0) {
      setUnreadCount((count) => count + fromPeer.length);
    }
  }, [messages, open, currentUserId]);

  useEffect(() => {
    if (open) setUnreadCount(0);
  }, [open]);

  function handlePointerDown(event: React.PointerEvent) {
    (event.target as Element).setPointerCapture(
      event.pointerId,
    );

    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      dragging: false,
    };
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!dragState.current) return;

    const dx = event.clientX - dragState.current.startX;
    const dy = event.clientY - dragState.current.startY;

    if (
      !dragState.current.dragging &&
      Math.hypot(dx, dy) > DRAG_THRESHOLD
    ) {
      dragState.current.dragging = true;
    }

    if (dragState.current.dragging) {
      setPosition(
        clampBubblePosition(
          dragState.current.originX + dx,
          dragState.current.originY + dy,
        ),
      );
    }
  }

  function handlePointerUp() {
    const wasDragging = dragState.current?.dragging ?? false;

    if (wasDragging) {
      setPosition((current) => {
        saveBubblePosition(current);
        return current;
      });
    }

    dragState.current = null;

    // Only treat it as a tap (open/close the panel) if the
    // pointer never actually moved past the drag threshold.
    if (!wasDragging) {
      setOpen((value) => !value);
    }
  }

  const send = async (value: string) => {
    const body = value.trim();
    if (!body || sending) return;

    setSending(true);
    const ok = await onSend(body);
    setSending(false);

    if (ok) setText("");
  };

  const recent = messages.slice(-25);

  // Position the chat panel just above wherever the bubble
  // currently sits, clamped so it never runs off-screen —
  // same idea as a normal popover anchored to its trigger.
  const PANEL_WIDTH = 320;
  const PANEL_HEIGHT = 360;
  const PANEL_GAP = 10;

  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 400;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 800;

  const panelLeft = Math.min(
    Math.max(12, position.x - PANEL_WIDTH / 2 + BUBBLE_SIZE / 2),
    viewportWidth - PANEL_WIDTH - 12,
  );

  const panelTop = Math.max(
    12,
    position.y - PANEL_HEIGHT - PANEL_GAP,
  );

  const panelStyle: React.CSSProperties = {
    left: panelLeft,
    top:
      panelTop < 12
        ? Math.min(
            position.y + BUBBLE_SIZE + PANEL_GAP,
            viewportHeight - PANEL_HEIGHT - 12,
          )
        : panelTop,
  };

  const labelFor = (message: Message) => {
    if ((message as any).deleted_at) return "Deleted message";

    switch (message.type) {
      case "text":
        return message.content;
      case "sticker":
        return "Sticker";
      case "image":
        return "📷 Photo";
      case "video":
        return "🎬 Video";
      case "audio":
        return "🎙️ Voice note";
      default:
        return message.content ?? "Message";
    }
  };

  return (
    <>
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="Game chat"
        className="fixed z-[110] flex h-12 w-12 touch-none items-center justify-center rounded-full bg-blue-600 text-xl text-white shadow-xl transition active:scale-90"
        style={{ left: position.x, top: position.y }}
      >
        💬
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-background bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed z-[110] flex max-h-[360px] w-[calc(100vw-1.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
          style={panelStyle}
        >
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-xs font-semibold">
              Chat with {peerName ?? "them"}
            </p>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={listRef}
            className="flex-1 space-y-1.5 overflow-y-auto p-3"
          >
            {recent.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No messages yet
              </p>
            ) : (
              recent.map((message) => {
                const mine =
                  message.sender_id === currentUserId;

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      mine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[75%] break-words rounded-xl px-3 py-1.5 text-xs ${
                        mine
                          ? "bg-blue-600 text-white"
                          : "bg-muted"
                      }`}
                    >
                      {labelFor(message)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto border-t px-2 py-2">
            {quickPhrases.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => void send(phrase)}
                className="flex-shrink-0 whitespace-nowrap rounded-full border border-border bg-muted px-3 py-1.5 text-[11px] font-medium text-foreground transition hover:bg-muted/70 active:scale-95"
              >
                {phrase}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t p-2">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void send(text);
              }}
              placeholder="Message..."
              className="flex-1 rounded-full border bg-background px-3 py-2 text-xs outline-none"
            />

            <button
              type="button"
              disabled={!text.trim() || sending}
              onClick={() => void send(text)}
              className="rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* =========================================================
   SECURE GAMING REWARD SESSION
   Starts a server-side match session and submits the final
   result through the protected gaming server functions.
========================================================= */

function createMatchId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function useGamingMatchSession({
  sync,
  userId,
  peerId,
  gameType,
  isBot,
  enabled = true,
}: {
  sync: GameSync;
  userId: string;
  peerId?: string | null;
  gameType: string;
  isBot: boolean;
  enabled?: boolean;
}) {
  const isHost = !peerId || userId < peerId;
  const matchIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const rewardShownMatchIdsRef = useRef<Set<string>>(new Set());
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const nonHostReadyResolveRef = useRef<(() => void) | null>(null);

  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardResult, setRewardResult] = useState<"win" | "draw" | "loss">("win");
  const [rewardCoins, setRewardCoins] = useState(0);
  const [rewardXp, setRewardXp] = useState(0);

  const closeReward = useCallback(() => {
    setRewardOpen(false);
  }, []);

  const start = useCallback(async () => {
    startedRef.current = true;
    completedRef.current = false;

    // Every call to start() represents a genuinely NEW round.
    const id = createMatchId();
    matchIdRef.current = isBot || isHost ? id : null;

    setRewardOpen(false);
    setRewardCoins(0);
    setRewardXp(0);

    if (isBot || isHost) {
      const promise = (async () => {
        try {
          // IMPORTANT: create the server-side match BEFORE telling the peer
          // that this match exists. This removes the race where the peer can
          // finish a game before Gaming Supabase has created the session.
          await startGamingMatch({
            data: {
              matchId: id,
              gameType,
              player2Id: isBot ? null : peerId,
              isBot,
            },
          });

          if (matchIdRef.current === id && !isBot && peerId) {
            sync.send("gaming_match_started", { matchId: id });
          }
        } catch (error) {
          if (matchIdRef.current === id) {
            matchIdRef.current = null;
            completedRef.current = false;
          }
          console.error("Failed to start gaming match:", error);
          throw error;
        }
      })();

      startPromiseRef.current = promise;
      await promise;
      return;
    }

    // Non-host: the host owns creation of the server session. Wait for the
    // host's NEW match ID instead of allowing completion to race ahead of it.
    startPromiseRef.current = new Promise<void>((resolve) => {
      nonHostReadyResolveRef.current = resolve;
    });

    sync.send("gaming_match_request", {});
    await startPromiseRef.current;
  }, [gameType, isBot, isHost, peerId, sync]);

  useEffect(() => {
    const offStart = sync.on("gaming_match_started", (data) => {
      if (!data?.matchId) return;

      matchIdRef.current = data.matchId;
      completedRef.current = false;
      nonHostReadyResolveRef.current?.();
      nonHostReadyResolveRef.current = null;
    });

    const offRequest = sync.on("gaming_match_request", () => {
      if (!isHost || isBot) return;
      if (!matchIdRef.current || completedRef.current) return;

      // The host only announces a match after startGamingMatch() has
      // successfully created it in Gaming Supabase.
      sync.send("gaming_match_started", {
        matchId: matchIdRef.current,
      });
    });

    if (enabled && !startedRef.current) {
      void start();
    }

    // Non-hosts request the currently active match after their listener is
    // installed. This also recovers from a missed initial realtime broadcast.
    if (enabled && !isBot && !isHost) {
      sync.send("gaming_match_request", {});
    }

    return () => {
      offStart();
      offRequest();
    };
  }, [enabled, isBot, isHost, start, sync]);

  const complete = useCallback(
    async ({
      result,
      winnerId,
      loserId,
    }: {
      result: "win" | "loss" | "draw";
      winnerId?: string | null;
      loserId?: string | null;
    }) => {
      // A game can finish extremely quickly, before the asynchronous match
      // creation/broadcast has completed. Always wait for the CURRENT round
      // to be ready before submitting its result.
      if (!matchIdRef.current) {
        try {
          await start();
        } catch {
          completedRef.current = false;
          return;
        }
      } else if (startPromiseRef.current) {
        try {
          await startPromiseRef.current;
        } catch {
          // If the original start failed, create one fresh match and retry.
          try {
            await start();
          } catch {
            completedRef.current = false;
            return;
          }
        }
      }

      const matchId = matchIdRef.current;
      if (!matchId || completedRef.current) return;

      completedRef.current = true;

      try {
        if (!isBot) {
          const staggerMs =
            result === "win" ? 0 : result === "draw" ? (isHost ? 0 : 150) : 280;

          if (staggerMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, staggerMs));
          }
        }

        const response = await completeGamingMatch({
          data: {
            matchId,
            gameType,
            player1Id: isBot ? userId : isHost ? userId : peerId ?? userId,
            player2Id: isBot ? null : isHost ? peerId : userId,
            isBot,
            winnerId: winnerId ?? null,
            loserId: loserId ?? null,
            result,
          },
        });

        const rpcPayload =
          response && typeof response === "object" && "result" in response
            ? (response as { result?: unknown }).result
            : response;

        const data =
          rpcPayload && typeof rpcPayload === "object"
            ? (rpcPayload as Record<string, unknown>)
            : {};

        const rewardObj =
          data['reward'] && typeof data['reward'] === "object"
            ? (data['reward'] as Record<string, unknown>)
            : {};

        const coins = Number(
          rewardObj['x_coins_awarded'] ??
            rewardObj['xCoinsAwarded'] ??
            data['x_coins_awarded'] ??
            data['x_coins'] ??
            0,
        );

        const xp = Number(
          rewardObj['xp_awarded'] ??
            rewardObj['xpAwarded'] ??
            data['xp_awarded'] ??
            data['xp'] ??
            0,
        );

        let finalCoins = Number.isFinite(coins) ? Math.max(0, coins) : 0;
        let finalXp = Number.isFinite(xp) ? Math.max(0, xp) : 0;

        const isCurrentUserWinner = winnerId === userId;

        if (
          result === "win" &&
          isCurrentUserWinner &&
          finalCoins <= 0 &&
          finalXp <= 0
        ) {
          for (let attempt = 0; attempt < 5; attempt += 1) {
            try {
              const storedReward = await getGamingMatchReward({
                data: { matchId },
              });

              const storedCoins = Number(storedReward?.x_coins ?? 0);
              const storedXp = Number(storedReward?.xp ?? 0);

              if (storedCoins > 0 || storedXp > 0) {
                finalCoins = Number.isFinite(storedCoins)
                  ? Math.max(0, storedCoins)
                  : 0;
                finalXp = Number.isFinite(storedXp)
                  ? Math.max(0, storedXp)
                  : 0;
                break;
              }
            } catch (rewardLookupError) {
              console.error(
                "Failed to recover recorded gaming reward:",
                rewardLookupError,
              );
            }

            if (attempt < 4) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          }
        }

        const shouldShowReward =
          result === "win" &&
          isCurrentUserWinner &&
          (finalCoins > 0 || finalXp > 0) &&
          !rewardShownMatchIdsRef.current.has(matchId);

        if (shouldShowReward) {
          rewardShownMatchIdsRef.current.add(matchId);
          setRewardResult("win");
          setRewardCoins(finalCoins);
          setRewardXp(finalXp);
          setRewardOpen(true);
        } else if (
          result === "draw" &&
          !rewardShownMatchIdsRef.current.has(matchId)
        ) {
          rewardShownMatchIdsRef.current.add(matchId);
          setRewardResult("draw");
          setRewardCoins(finalCoins);
          setRewardXp(finalXp);
          setRewardOpen(true);
        }

        // Only clear the current match after successful completion. A later
        // Play Again call gets its own brand-new UUID.
        if (matchIdRef.current === matchId) {
          matchIdRef.current = null;
        }
      } catch (error) {
        // Do not poison a NEW round if an older completion request fails.
        // Only reset the completion guard if this is still the same match.
        if (matchIdRef.current === matchId) {
          completedRef.current = false;
        }
        console.error("Failed to submit gaming result:", error);
      }
    },
    [gameType, isBot, isHost, peerId, start, userId],
  );

  const RewardModal = (
    <GameRewardModal
      open={rewardOpen}
      result={rewardResult}
      xCoins={rewardCoins}
      xp={rewardXp}
      onClose={closeReward}
    />
  );

  return { complete, start, RewardModal };
}

/* =========================================================
   MAIN XUP GAMES COMPONENT

   Renders game content only — the parent ($id.tsx) provides
   the modal overlay, backdrop, and close button. The 💬 chat
   bubble floats above whatever game is active, and only
   renders if the parent passed both `messages` and
   `onSendChatMessage` (see the note on GameChatBubble above).
========================================================= */

export default function XupGames({
  onClose,
  conversationId,
  userId,
  peerId,
  peerName,
  messages,
  onSendChatMessage,
}: XupGamesProps) {
  const [game, setGame] = useState<Game>("menu");

  const sync = useGameSync(conversationId, userId);

  const goBack = () => {
    setGame("menu");
  };

  const content = () => {
    switch (game) {
      case "tictactoe":
        return (
          <TicTacToe
            onBack={goBack}
            sync={sync}
            userId={userId}
            peerId={peerId}
            peerName={peerName}
          />
        );

      case "rps":
        return (
          <RockPaperScissors
            onBack={goBack}
            sync={sync}
            userId={userId}
            peerId={peerId}
            peerName={peerName}
          />
        );

      case "emoji":
        return (
          <EmojiGuess
            onBack={goBack}
            sync={sync}
            userId={userId}
            peerId={peerId}
            peerName={peerName}
          />
        );

      case "reaction":
        return (
          <ReactionBattle
            onBack={goBack}
            sync={sync}
            userId={userId}
            peerId={peerId}
            peerName={peerName}
          />
        );

      case "chess":
        return (
          <ChessGame
            onBack={goBack}
            sync={sync}
            userId={userId}
            peerId={peerId}
            peerName={peerName}
          />
        );

      case "checkers":
        return (
          <CheckersGame
            onBack={goBack}
            sync={sync}
            userId={userId}
            peerId={peerId}
            peerName={peerName}
          />
        );

      case "ludo":
        return (
          <LudoGame
            onBack={goBack}
            sync={sync}
            userId={userId}
            peerId={peerId}
            peerName={peerName}
          />
        );

      default:
        return (
          <GameMenu
            onSelect={setGame}
            peerPresent={sync.peerPresent}
            peerName={peerName}
            hasPeer={!!peerId}
          />
        );
    }
  };

  return (
    <>
      {content()}

      {messages && onSendChatMessage && (
        <GameChatBubble
          messages={messages}
          onSend={onSendChatMessage}
          currentUserId={userId}
          peerName={peerName}
        />
      )}
    </>
  );
}
