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
  return items[Math.floor(Math.random() * items.length)];
}

function checkTicTacToeWinner(
  board: Mark[],
): Mark | "draw" | null {
  const combinations = [
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
): "win" | "lose" | "draw" {
  if (player === opponent) return "draw";

  if (
    (player === "rock" && opponent === "scissors") ||
    (player === "paper" && opponent === "rock") ||
    (player === "scissors" && opponent === "paper")
  ) {
    return "win";
  }

  return "lose";
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

const CHESS_ROOK_DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const CHESS_BISHOP_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const CHESS_QUEEN_DIRS = [
  ...CHESS_ROOK_DIRS,
  ...CHESS_BISHOP_DIRS,
];

const CHESS_KNIGHT_OFFSETS = [
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

   Role assignment (X vs O) is decided by a coin flip before
   every match instead of a fixed rule. The player with the
   "smaller" userId is the coin-flip HOST: only the host
   generates the random result and broadcasts it, so both
   devices always agree on the same outcome.
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

  // Heads → host is X, peer is O. Tails → the reverse.
  // Solo mode always plays as X with no flip needed.
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

  // Kick off the very first flip.
  useEffect(() => {
    if (!hasPeer) return;
    if (isHost) {
      runFlip(true);
    }
    // Non-host waits for "ttt_coin" from the host below.
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

    const offReset = sync.on("ttt_reset", () => {
      // The host always initiates the re-flip, so non-hosts
      // just wait for the incoming "ttt_coin" broadcast.
    });

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
      if (turn !== myMark) return; // not your turn

      const next = [...board];
      next[index] = myMark;
      setBoard(next);
      setTurn(myMark === "X" ? "O" : "X");

      sync.send("ttt_move", { index, mark: myMark });
      return;
    }

    // Solo fallback (no peer detected — e.g. group chat)
    const next = [...board];
    next[index] = turn;
    setBoard(next);

    const result = checkTicTacToeWinner(next);
    if (!result) {
      setTurn((current) => (current === "X" ? "O" : "X"));
    }
  };

  const playAgain = () => {
    if (hasPeer) {
      if (isHost) {
        runFlip(true);
      } else {
        // Ask the host to re-flip; host listens for this and
        // starts a fresh coin flip for both players.
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

  // Host reacts to a non-host requesting a rematch.
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
          label={
            coinResult
              ? `You are ${myMark}.`
              : ""
          }
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
    </div>
  );
}

/* =========================================================
   ROCK PAPER SCISSORS — TWO PLAYER
========================================================= */

function RockPaperScissors({
  onBack,
  sync,
  peerId,
  peerName,
}: {
  onBack: () => void;
  sync: GameSync;
  peerId?: string | null;
  peerName?: string | null;
}) {
  const hasPeer = !!peerId;

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

  // Resolve the round once both choices are in (two-player mode).
  useEffect(() => {
    if (!hasPeer) return;
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
  }, [playerChoice, opponentChoice, hasPeer, result]);

  const play = (choice: RpsChoice) => {
    if (hasPeer) {
      if (playerChoice) return; // already picked this round

      setPlayerChoice(choice);
      sync.send("rps_choice", { choice });
      return;
    }

    // Solo fallback
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
  };

  const reset = () => {
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

    // Host shares the starting question when the peer joins.
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
      // First correct answer wins the round; broadcast it, then move on.
      sync.send("emoji_correct", { by: userId });

      setMyScore((s) => s + 1);
      setLastWinner("You");

      const next = pickQuestion();
      setQuestion(next);
      setAnswer("");
      setWrong(false);

      sync.send("emoji_question", { question: next });
      return;
    }

    // Solo fallback
    setMyScore((s) => s + 1);

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
    </div>
  );
}

/* =========================================================
   REACTION BATTLE — TWO PLAYER RACE
========================================================= */

function ReactionBattle({
  onBack,
  sync,
  peerId,
  peerName,
}: {
  onBack: () => void;
  sync: GameSync;
  peerId?: string | null;
  peerName?: string | null;
}) {
  const hasPeer = !!peerId;

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

      // Each device schedules its own "go" locally. Minor clock
      // drift between phones is fine for a casual reflex game.
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
    </div>
  );
}

/* =========================================================
   CHESS — TWO PLAYER OR VS PROGRAMMED BOT

   No coin flip here (unlike Tic-Tac-Toe): the host (lower
   userId) always plays White and always moves first, which
   is standard chess convention. In bot mode the human is
   always White; the bot (Black) moves via chooseChessBotMove
   above — plain heuristic code, no AI API.
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

  // Realtime listeners — friend mode only.
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

  // Host re-shares the current state whenever the peer
  // (re)joins mid-game, so a late joiner catches up.
  useEffect(() => {
    if (mode !== "friend" || !isHost) return;
    if (!sync.peerPresent) return;

    sync.send("chess_sync", { board, turn: turnColor });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.peerPresent, mode, isHost]);

  // Recompute check/checkmate/stalemate whenever the
  // position or side-to-move changes.
  useEffect(() => {
    setStatus(getChessStatus(board, turnColor));
  }, [board, turnColor]);

  // Bot's move.
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
    setBoard(createInitialChessBoard());
    setTurnColor("w");
    setSelected(null);
    setStatus("playing");

    if (mode === "friend") {
      sync.send("chess_new", {});
    }
  };

  // On checkmate, turnColor is the side with no legal moves
  // — i.e. the side that just lost.
  const outcome: "win" | "lose" | "draw" | null =
    status === "stalemate"
      ? "draw"
      : status === "checkmate"
        ? (turnColor === "w" ? "b" : "w") === myColor
          ? "win"
          : "lose"
        : null;

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
    </div>
  );
}

/* =========================================================
   CHECKERS — TWO PLAYER OR VS PROGRAMMED BOT

   Like Chess, the host (lower userId) always plays Red and
   moves first — no coin flip. Captures are mandatory across
   the whole board (generateCheckersMoves enforces this), and
   a piece that just captured must keep jumping if another
   capture is available to it ("forced" state below).
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

  // Realtime listeners — friend mode only.
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

  // Host re-shares the current state whenever the peer
  // (re)joins mid-game, so a late joiner catches up.
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

  // Bot's move — re-fires on every continuation step of a
  // multi-jump because `state.forced` changes each time.
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

      // Can't switch pieces mid multi-jump.
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
    </div>
  );
}

/* =========================================================
   COMING SOON PLACEHOLDER — Ludo lands in its own pass;
   wired into the menu and sync channel already with the
   exact props signature it'll need.
========================================================= */

function ComingSoonGame({
  onBack,
  title,
  emoji,
}: {
  onBack: () => void;
  title: string;
  emoji: string;
}) {
  return (
    <div className="w-full">
      <GameHeader
        title={`${emoji} ${title}`}
        onBack={onBack}
        status="Coming in the next update"
      />

      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 px-6 py-14 text-center">
        <div className="mb-4 text-6xl">{emoji}</div>

        <p className="text-sm font-semibold">
          {title} is on the way
        </p>

        <p className="mt-2 max-w-xs text-xs text-muted-foreground">
          We're finishing the board and bot mode for this
          one. It'll appear here once it's ready — no
          separate download needed.
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN XUP GAMES COMPONENT

   Renders content only — the parent ($id.tsx) provides the
   modal overlay, backdrop, and close button.
========================================================= */

export default function XupGames({
  onClose,
  conversationId,
  userId,
  peerId,
  peerName,
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
          <ComingSoonGame
            onBack={goBack}
            title="Ludo"
            emoji="🎲"
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

  return content();
}