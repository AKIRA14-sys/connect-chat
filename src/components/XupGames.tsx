import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, RotateCcw, Trophy, Users, Zap, Hash, Gamepad2, MessageSquare, Reply } from "lucide-react";

/* =========================================================
   TYPES & REALTIME ENGINE TYPES
========================================================= */

export type GameId = "ttt" | "rps" | "emoji" | "reaction" | "chess" | "checkers" | "ludo";

export interface GameSync {
  send: (event: string, payload: any) => void;
  on: (event: string, handler: (payload: any) => void) => () => void;
  peerPresent: boolean;
}

export interface XupGamesProps {
  conversationId: string;
  userId: string;
  peerId?: string | null;
  peerName?: string | null;
  onClose?: () => void;
  /** Pass your actual Supabase channel sync adapter here */
  gameSync?: GameSync;
}

/* =========================================================
   FALLBACK / MOCK SYNC HOOK (If no custom sync is provided)
========================================================= */

function useFallbackSync(): GameSync {
  const handlersRef = useRef<{ [key: string]: Set<(payload: any) => void> }>({});

  const send = useCallback((event: string, payload: any) => {
    const list = handlersRef.current[event];
    if (list) {
      list.forEach((fn) => fn(payload));
    }
  }, []);

  const on = useCallback((event: string, handler: (payload: any) => void) => {
    if (!handlersRef.current[event]) {
      handlersRef.current[event] = new Set();
    }
    handlersRef.current[event].add(handler);

    return () => {
      handlersRef.current[event]?.delete(handler);
    };
  }, []);

  return { send, on, peerPresent: false };
}

/* =========================================================
   SHARED UI & IN-GAME CHAT OVERLAY SYSTEM
========================================================= */

function GameHeader({ title, onBack, status }: { title: string; onBack: () => void; status?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between border-b pb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl p-2 transition hover:bg-muted active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {status && <span className="text-xs font-semibold text-muted-foreground">{status}</span>}
    </div>
  );
}

function PeerBanner({ peerPresent, peerName }: { peerPresent: boolean; peerName?: string | null }) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl border bg-muted/40 p-2.5 text-xs">
      <span className={`h-2.5 w-2.5 rounded-full ${peerPresent ? "bg-emerald-500" : "bg-amber-500"}`} />
      <span>
        {peerPresent
          ? `${peerName ?? "Peer"} is connected`
          : `Waiting for ${peerName ?? "peer"} to join game view…`}
      </span>
    </div>
  );
}

function GameChatOverlay({ sync, peerName }: { sync: GameSync; peerName?: string | null }) {
  const [activeBubble, setActiveBubble] = useState<{ sender: string; text: string; isPeer: boolean } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const QUICK_MESSAGES = [
    "Good move! 🎯",
    "Your turn! ⏳",
    "Nice try! 😉",
    "Rematch? 🔄",
    "🔥",
    "😂",
    "😱",
    "👏",
  ];

  useEffect(() => {
    const offChat = sync.on("game_chat_bubble", (data) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setActiveBubble({ sender: peerName ?? "Peer", text: data.text, isPeer: true });
      timerRef.current = setTimeout(() => setActiveBubble(null), 4000);
    });

    return () => {
      offChat();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sync, peerName]);

  const sendBubble = (text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActiveBubble({ sender: "You", text, isPeer: false });
    sync.send("game_chat_bubble", { text });
    setIsOpen(false);
    timerRef.current = setTimeout(() => setActiveBubble(null), 4000);
  };

  return (
    <div className="relative mb-4">
      {/* Floating Active Chat Bubble */}
      {activeBubble && (
        <div
          className={`mb-2 flex items-center justify-between gap-2 rounded-2xl p-2.5 px-3 text-xs shadow-md transition-all animate-in fade-in slide-in-from-top-2 ${
            activeBubble.isPeer
              ? "border border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200"
              : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="font-bold">{activeBubble.sender}:</span>
            <span>{activeBubble.text}</span>
          </div>
          {activeBubble.isPeer && (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 font-bold text-white transition hover:bg-blue-700 active:scale-95"
            >
              <Reply className="h-3 w-3" />
              Reply
            </button>
          )}
        </div>
      )}

      {/* Quick Chat Menu Toggle Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-semibold shadow-sm hover:bg-muted active:scale-95"
        >
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
          <span>Quick Chat</span>
        </button>
      </div>

      {/* Preset Reply Options Popover */}
      {isOpen && (
        <div className="absolute right-0 top-8 z-50 flex flex-wrap gap-1.5 rounded-2xl border bg-card p-3 shadow-xl max-w-[240px] animate-in fade-in zoom-in-95">
          {QUICK_MESSAGES.map((msg) => (
            <button
              key={msg}
              type="button"
              onClick={() => sendBubble(msg)}
              className="rounded-xl border bg-muted/60 px-2.5 py-1 text-xs font-medium hover:bg-primary hover:text-primary-foreground transition active:scale-95"
            >
              {msg}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   GAME 1: TIC TAC TOE (WITH COIN FLIP & CHAT)
========================================================= */

type Board = (string | null)[];

function calculateTTTWinner(squares: Board): { winner: string | null; line: number[] | null } {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a], line: [a, b, c] };
    }
  }
  return { winner: null, line: null };
}

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

  const [mode, setMode] = useState<"select" | "friend" | "bot">(hasPeer ? "select" : "bot");
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [firstPlayer, setFirstPlayer] = useState<string | null>(null);
  const [flipping, setFlipping] = useState(false);

  const mySymbol = mode === "bot" ? "X" : isHost ? "X" : "O";
  const currentSymbol = xIsNext ? "X" : "O";
  const isMyTurn = mode === "bot" ? xIsNext : currentSymbol === mySymbol;

  const { winner, line } = calculateTTTWinner(board);
  const isDraw = !winner && board.every((cell) => cell !== null);

  const triggerCoinFlip = useCallback(() => {
    if (mode !== "friend" || !isHost) return;
    setFlipping(true);

    const winnerIsHost = Math.random() < 0.5;
    const starter = winnerIsHost ? "X" : "O";

    setTimeout(() => {
      setFirstPlayer(starter);
      setXIsNext(starter === "X");
      setFlipping(false);
      sync.send("ttt_coin_flip", { starter });
    }, 1000);
  }, [isHost, mode, sync]);

  useEffect(() => {
    if (mode === "friend") {
      if (isHost && !firstPlayer) {
        triggerCoinFlip();
      }

      const offFlip = sync.on("ttt_coin_flip", (data) => {
        setFlipping(true);
        setTimeout(() => {
          setFirstPlayer(data.starter);
          setXIsNext(data.starter === "X");
          setFlipping(false);
        }, 1000);
      });

      const offMove = sync.on("ttt_move", (data) => {
        setBoard((prev) => {
          if (prev[data.index]) return prev;
          const next = [...prev];
          next[data.index] = data.symbol;
          return next;
        });
        setXIsNext(data.symbol === "O");
      });

      const offReset = sync.on("ttt_reset", () => {
        setBoard(Array(9).fill(null));
        triggerCoinFlip();
      });

      return () => {
        offFlip();
        offMove();
        offReset();
      };
    }
  }, [mode, isHost, firstPlayer, sync, triggerCoinFlip]);

  // Bot logic
  useEffect(() => {
    if (mode === "bot" && !xIsNext && !winner && !isDraw) {
      const timer = setTimeout(() => {
        const emptyIndices = board.map((val, idx) => (val === null ? idx : null)).filter((val) => val !== null) as number[];
        if (emptyIndices.length > 0) {
          const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          const nextBoard = [...board];
          nextBoard[randomIndex] = "O";
          setBoard(nextBoard);
          setXIsNext(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [mode, xIsNext, board, winner, isDraw]);

  const handleClick = (index: number) => {
    if (board[index] || winner || isDraw || !isMyTurn || flipping) return;

    const nextBoard = [...board];
    nextBoard[index] = mySymbol;
    setBoard(nextBoard);
    setXIsNext(!xIsNext);

    if (mode === "friend") {
      sync.send("ttt_move", { index, symbol: mySymbol });
    }
  };

  const handleReset = () => {
    setBoard(Array(9).fill(null));
    if (mode === "friend") {
      triggerCoinFlip();
      sync.send("ttt_reset", {});
    } else {
      setXIsNext(true);
    }
  };

  if (mode === "select") {
    return (
      <div className="w-full">
        <GameHeader title="❌⭕ Tic-Tac-Toe" onBack={onBack} status="Select Mode" />
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setMode("friend")}
            className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:bg-muted active:scale-95"
          >
            <div className="text-sm font-bold">🧑‍🤝‍🧑 Play vs {peerName ?? "Friend"}</div>
            <div className="mt-1 text-xs text-muted-foreground">Synchronized coin flip determines who starts</div>
          </button>
          <button
            type="button"
            onClick={() => setMode("bot")}
            className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:bg-muted active:scale-95"
          >
            <div className="text-sm font-bold">🤖 Play vs Bot</div>
            <div className="mt-1 text-xs text-muted-foreground">Practice solo anytime</div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <GameHeader
        title="❌⭕ Tic-Tac-Toe"
        onBack={onBack}
        status={
          flipping
            ? "Flipping coin…"
            : winner
              ? "Game Over"
              : isDraw
                ? "Draw"
                : isMyTurn
                  ? "Your turn"
                  : "Opponent's turn"
        }
      />

      {mode === "friend" && (
        <>
          <PeerBanner peerPresent={sync.peerPresent} peerName={peerName} />
          <GameChatOverlay sync={sync} peerName={peerName} />
        </>
      )}

      {flipping ? (
        <div className="my-8 flex flex-col items-center justify-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="text-sm font-semibold">Deciding who goes first…</div>
        </div>
      ) : (
        <>
          <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-2">
            {board.map((cell, idx) => {
              const isWinningSquare = line?.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleClick(idx)}
                  className={`flex h-20 w-20 items-center justify-center rounded-2xl border text-2xl font-black transition active:scale-95 ${
                    isWinningSquare
                      ? "bg-emerald-500 text-white"
                      : "bg-card hover:bg-muted"
                  }`}
                >
                  {cell}
                </button>
              );
            })}
          </div>

          {(winner || isDraw) && (
            <div className="mt-5 rounded-2xl border bg-card p-4 text-center shadow-sm">
              <div className="text-base font-bold">
                {winner ? (winner === mySymbol ? "🏆 You Won!" : "😅 Opponent Won!") : "🤝 It's a Tie!"}
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="mx-auto mt-3 flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:opacity-90"
              >
                <RotateCcw className="h-4 w-4" />
                Play Again
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* =========================================================
   GAME 2: ROCK PAPER SCISSORS (WITH CHAT)
========================================================= */

type RPSChoice = "rock" | "paper" | "scissors";

function RPSGame({ onBack, sync, peerName }: { onBack: () => void; sync: GameSync; peerName?: string | null }) {
  const [myChoice, setMyChoice] = useState<RPSChoice | null>(null);
  const [peerChoice, setPeerChoice] = useState<RPSChoice | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const offChoice = sync.on("rps_choice", (data) => {
      setPeerChoice(data.choice);
    });

    const offReset = sync.on("rps_reset", () => {
      setMyChoice(null);
      setPeerChoice(null);
      setResult(null);
    });

    return () => {
      offChoice();
      offReset();
    };
  }, [sync]);

  useEffect(() => {
    if (myChoice && peerChoice) {
      if (myChoice === peerChoice) {
        setResult("Tie!");
      } else if (
        (myChoice === "rock" && peerChoice === "scissors") ||
        (myChoice === "paper" && peerChoice === "rock") ||
        (myChoice === "scissors" && peerChoice === "paper")
      ) {
        setResult("You Win! 🎉");
      } else {
        setResult(`${peerName ?? "Peer"} Wins!`);
      }
    }
  }, [myChoice, peerChoice, peerName]);

  const handleSelect = (choice: RPSChoice) => {
    if (myChoice) return;
    setMyChoice(choice);
    sync.send("rps_choice", { choice });
  };

  const handleReset = () => {
    setMyChoice(null);
    setPeerChoice(null);
    setResult(null);
    sync.send("rps_reset", {});
  };

  return (
    <div className="w-full">
      <GameHeader title="🪨📄✂️ Rock Paper Scissors" onBack={onBack} />
      <PeerBanner peerPresent={sync.peerPresent} peerName={peerName} />
      <GameChatOverlay sync={sync} peerName={peerName} />

      <div className="my-6 text-center">
        {!myChoice ? (
          <div className="text-sm font-semibold">Choose your move:</div>
        ) : !peerChoice ? (
          <div className="text-sm font-semibold animate-pulse">Waiting for {peerName ?? "Peer"}…</div>
        ) : (
          <div className="text-lg font-black">{result}</div>
        )}
      </div>

      <div className="flex justify-center gap-4">
        {(["rock", "paper", "scissors"] as RPSChoice[]).map((c) => {
          const icon = c === "rock" ? "🪨" : c === "paper" ? "📄" : "✂️";
          const isSelected = myChoice === c;
          return (
            <button
              key={c}
              type="button"
              disabled={!!myChoice}
              onClick={() => handleSelect(c)}
              className={`flex h-20 w-20 flex-col items-center justify-center rounded-2xl border text-3xl transition active:scale-95 disabled:opacity-50 ${
                isSelected ? "border-primary bg-primary/10" : "bg-card hover:bg-muted"
              }`}
            >
              {icon}
            </button>
          );
        })}
      </div>

      {result && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleReset}
            className="mx-auto flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" /> Play Again
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   GAME 3: EMOJI GUESS
========================================================= */

const EMOJI_PUZZLES = [
  { emoji: "🍿🎬", answer: "movie" },
  { emoji: "🚀🌕", answer: "moon" },
  { emoji: "🍦☀️", answer: "summer" },
  { emoji: "👑🦁", answer: "lion king" },
];

function EmojiGuess({ onBack }: { onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [solved, setSolved] = useState(false);

  const current = EMOJI_PUZZLES[index];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim().toLowerCase() === current.answer) {
      setSolved(true);
    }
  };

  const handleNext = () => {
    setInput("");
    setSolved(false);
    setIndex((prev) => (prev + 1) % EMOJI_PUZZLES.length);
  };

  return (
    <div className="w-full">
      <GameHeader title="🧩 Emoji Quiz" onBack={onBack} />
      <div className="my-6 flex flex-col items-center text-center">
        <div className="text-6xl">{current.emoji}</div>
        <form onSubmit={handleSubmit} className="mt-6 flex w-full max-w-xs gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your guess…"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
          >
            Guess
          </button>
        </form>

        {solved && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <span className="text-sm font-bold text-emerald-500">Correct! 🎉</span>
            <button
              type="button"
              onClick={handleNext}
              className="rounded-xl border bg-card px-4 py-2 text-xs font-bold transition hover:bg-muted"
            >
              Next Puzzle ➔
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   GAME 4: REACTION SPEED TEST
========================================================= */

function ReactionGame({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<"idle" | "waiting" | "ready" | "result">("idle");
  const [startTime, setStartTime] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startTest = () => {
    setState("waiting");
    const delay = Math.floor(Math.random() * 2000) + 1500;
    timerRef.current = setTimeout(() => {
      setStartTime(Date.now());
      setState("ready");
    }, delay);
  };

  const handleClick = () => {
    if (state === "waiting") {
      if (timerRef.current) clearTimeout(timerRef.current);
      setState("idle");
      alert("Too early! Wait for GREEN.");
    } else if (state === "ready") {
      const elapsed = Date.now() - startTime;
      setScore(elapsed);
      setState("result");
    }
  };

  return (
    <div className="w-full">
      <GameHeader title="⚡ Reaction Time" onBack={onBack} />
      <div className="my-6 flex flex-col items-center">
        {state === "idle" && (
          <button
            type="button"
            onClick={startTest}
            className="rounded-2xl bg-primary px-6 py-4 text-sm font-bold text-primary-foreground transition active:scale-95"
          >
            Start Reaction Test
          </button>
        )}

        {state === "waiting" && (
          <div
            onClick={handleClick}
            className="flex h-40 w-full max-w-xs cursor-pointer items-center justify-center rounded-2xl bg-amber-500 text-lg font-black text-white"
          >
            Wait for GREEN…
          </div>
        )}

        {state === "ready" && (
          <div
            onClick={handleClick}
            className="flex h-40 w-full max-w-xs cursor-pointer items-center justify-center rounded-2xl bg-emerald-500 text-lg font-black text-white animate-pulse"
          >
            TAP NOW!
          </div>
        )}

        {state === "result" && (
          <div className="text-center">
            <div className="text-2xl font-black">{score} ms</div>
            <button
              type="button"
              onClick={startTest}
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   GAME 5: CHESS ENGINE
========================================================= */

type Piece = string | null;
type BoardState = Piece[];

function createInitialChessBoard(): BoardState {
  return [
    'r', 'n', 'b', 'q', 'k', 'b', 'n', 'r',
    'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p',
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
    'R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R',
  ];
}

const CHESS_UNICODE: Record<string, string> = {
  r: "♜", n: "♞", b: "♝", q: "♛", k: "♚", p: "♟",
  R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔", P: "♙",
};

function ChessGame({ onBack }: { onBack: () => void }) {
  const [board, setBoard] = useState<BoardState>(createInitialChessBoard);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [turn, setTurn] = useState<"white" | "black">("white");

  const handleClick = (idx: number) => {
    const piece = board[idx];
    if (selectedIdx === null) {
      if (piece && ((turn === "white" && piece === piece.toUpperCase()) || (turn === "black" && piece === piece.toLowerCase()))) {
        setSelectedIdx(idx);
      }
    } else {
      const nextBoard = [...board];
      nextBoard[idx] = nextBoard[selectedIdx];
      nextBoard[selectedIdx] = null;
      setBoard(nextBoard);
      setSelectedIdx(null);
      setTurn(turn === "white" ? "black" : "white");
    }
  };

  return (
    <div className="w-full">
      <GameHeader title="♟️ Chess" onBack={onBack} status={`${turn.toUpperCase()}'s Turn`} />
      <div className="mx-auto grid max-w-[280px] grid-cols-8 gap-0.5 rounded-xl border bg-muted p-1">
        {board.map((cell, idx) => {
          const row = Math.floor(idx / 8);
          const col = idx % 8;
          const isDark = (row + col) % 2 === 1;
          const isSelected = selectedIdx === idx;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleClick(idx)}
              className={`flex h-8 w-8 items-center justify-center text-lg transition ${
                isSelected
                  ? "bg-amber-400"
                  : isDark
                    ? "bg-amber-800 text-amber-100"
                    : "bg-amber-100 text-amber-900"
              }`}
            >
              {cell ? CHESS_UNICODE[cell] : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   GAME 6: CHECKERS ENGINE
========================================================= */

type CheckerPiece = "r" | "b" | "R" | "B" | null;

function createInitialCheckersBoard(): CheckerPiece[] {
  const b: CheckerPiece[] = Array(64).fill(null);
  for (let i = 0; i < 64; i++) {
    const row = Math.floor(i / 8);
    const col = i % 8;
    if ((row + col) % 2 === 1) {
      if (row < 3) b[i] = "b";
      else if (row > 4) b[i] = "r";
    }
  }
  return b;
}

function CheckersGame({ onBack }: { onBack: () => void }) {
  const [board, setBoard] = useState<CheckerPiece[]>(createInitialCheckersBoard);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [turn, setTurn] = useState<"r" | "b">("r");

  const handleClick = (idx: number) => {
    const piece = board[idx];
    if (selectedIdx === null) {
      if (piece && piece.toLowerCase() === turn) {
        setSelectedIdx(idx);
      }
    } else {
      const nextBoard = [...board];
      nextBoard[idx] = nextBoard[selectedIdx];
      nextBoard[selectedIdx] = null;
      setBoard(nextBoard);
      setSelectedIdx(null);
      setTurn(turn === "r" ? "b" : "r");
    }
  };

  return (
    <div className="w-full">
      <GameHeader title="⚪🔴 Checkers" onBack={onBack} status={`${turn === "r" ? "RED" : "BLACK"}'s Turn`} />
      <div className="mx-auto grid max-w-[280px] grid-cols-8 gap-0.5 rounded-xl border bg-muted p-1">
        {board.map((cell, idx) => {
          const row = Math.floor(idx / 8);
          const col = idx % 8;
          const isDark = (row + col) % 2 === 1;
          const isSelected = selectedIdx === idx;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleClick(idx)}
              className={`flex h-8 w-8 items-center justify-center text-sm transition ${
                isSelected
                  ? "bg-amber-400"
                  : isDark
                    ? "bg-slate-700"
                    : "bg-slate-200"
              }`}
            >
              {cell && (
                <span
                  className={`h-6 w-6 rounded-full border ${
                    cell.toLowerCase() === "r" ? "bg-red-500 border-red-700" : "bg-slate-900 border-black"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   GAME 7: LUDO ENGINE (WITH CHAT)
========================================================= */

type LudoColor = "r" | "y";

type TokenState = {
  id: number;
  color: LudoColor;
  step: number;
};

type LudoGameState = {
  tokens: TokenState[];
  turn: LudoColor;
  dice: number | null;
  hasRolled: boolean;
  winner: LudoColor | null;
};

function createInitialLudoState(): LudoGameState {
  const tokens: TokenState[] = [
    { id: 0, color: "r", step: -1 },
    { id: 1, color: "r", step: -1 },
    { id: 2, color: "y", step: -1 },
    { id: 3, color: "y", step: -1 },
  ];
  return { tokens, turn: "r", dice: null, hasRolled: false, winner: null };
}

function canMoveLudoToken(token: TokenState, dice: number): boolean {
  if (token.step === 32) return false;
  if (token.step === -1) return dice === 6;
  return token.step + dice <= 32;
}

function getMovableLudoTokens(tokens: TokenState[], color: LudoColor, dice: number): TokenState[] {
  return tokens.filter((t) => t.color === color && canMoveLudoToken(t, dice));
}

function chooseLudoBotMove(tokens: TokenState[], dice: number): TokenState | null {
  const movable = getMovableLudoTokens(tokens, "y", dice);
  if (!movable.length) return null;

  const inBase = movable.find((t) => t.step === -1);
  if (inBase) return inBase;

  return movable.sort((a, b) => b.step - a.step)[0];
}

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

  const [mode, setMode] = useState<"select" | "friend" | "bot">(hasPeer ? "select" : "bot");
  const [state, setState] = useState<LudoGameState>(createInitialLudoState);
  const [botThinking, setBotThinking] = useState(false);

  const myColor: LudoColor = mode === "bot" ? "r" : isHost ? "r" : "y";
  const isMyTurn = mode === "bot" ? state.turn === "r" : state.turn === myColor;

  useEffect(() => {
    if (mode !== "friend") return;

    const offDice = sync.on("ludo_dice", (data) => {
      setState((prev) => ({ ...prev, dice: data.dice, hasRolled: true }));
    });

    const offMove = sync.on("ludo_move", (data) => {
      handleMoveToken(data.tokenId, data.dice, false);
    });

    const offReset = sync.on("ludo_reset", () => {
      setState(createInitialLudoState());
    });

    return () => {
      offDice();
      offMove();
      offReset();
    };
  }, [mode, sync]);

  useEffect(() => {
    if (mode !== "bot" || state.turn !== "y" || state.winner) return;

    setBotThinking(true);
    const timer = setTimeout(() => {
      if (!state.hasRolled) {
        const roll = Math.floor(Math.random() * 6) + 1;
        const movable = getMovableLudoTokens(state.tokens, "y", roll);

        if (!movable.length) {
          setState((prev) => ({ ...prev, dice: roll, turn: "r", hasRolled: false }));
          setBotThinking(false);
        } else {
          setState((prev) => ({ ...prev, dice: roll, hasRolled: true }));
        }
      } else if (state.dice) {
        const choice = chooseLudoBotMove(state.tokens, state.dice);
        if (choice) {
          handleMoveToken(choice.id, state.dice, false);
        } else {
          setState((prev) => ({ ...prev, turn: "r", hasRolled: false }));
        }
        setBotThinking(false);
      }
    }, 750);

    return () => clearTimeout(timer);
  }, [mode, state.turn, state.hasRolled, state.dice, state.winner]);

  const rollDice = () => {
    if (!isMyTurn || state.hasRolled || state.winner) return;

    const roll = Math.floor(Math.random() * 6) + 1;
    const movable = getMovableLudoTokens(state.tokens, state.turn, roll);

    if (mode === "friend") {
      sync.send("ludo_dice", { dice: roll });
    }

    if (!movable.length) {
      setState((prev) => ({
        ...prev,
        dice: roll,
        turn: prev.turn === "r" ? "y" : "r",
        hasRolled: false,
      }));
    } else {
      setState((prev) => ({ ...prev, dice: roll, hasRolled: true }));
    }
  };

  const handleMoveToken = (tokenId: number, diceVal: number, isLocalAction = true) => {
    setState((prev) => {
      const nextTokens = prev.tokens.map((t) => {
        if (t.id !== tokenId) return t;
        const newStep = t.step === -1 ? 0 : t.step + diceVal;
        return { ...t, step: newStep };
      });

      const redWon = nextTokens.filter((t) => t.color === "r").every((t) => t.step === 32);
      const yellowWon = nextTokens.filter((t) => t.color === "y").every((t) => t.step === 32);
      const winner = redWon ? "r" : yellowWon ? "y" : null;

      const nextTurn = diceVal === 6 ? prev.turn : prev.turn === "r" ? "y" : "r";

      return {
        ...prev,
        tokens: nextTokens,
        turn: nextTurn,
        hasRolled: false,
        winner,
      };
    });

    if (isLocalAction && mode === "friend") {
      sync.send("ludo_move", { tokenId, dice: diceVal });
    }
  };

  if (mode === "select") {
    return (
      <div className="w-full">
        <GameHeader title="🎲 Ludo" onBack={onBack} status="Choose an opponent" />
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setMode("friend")}
            className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:bg-muted active:scale-95"
          >
            <div className="text-sm font-bold">🧑‍🤝‍🧑 Play vs {peerName ?? "Friend"}</div>
            <div className="mt-1 text-xs text-muted-foreground">Live, synced in real time</div>
          </button>
          <button
            type="button"
            onClick={() => setMode("bot")}
            className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:bg-muted active:scale-95"
          >
            <div className="text-sm font-bold">🤖 Play vs Bot</div>
            <div className="mt-1 text-xs text-muted-foreground">Practice anytime, no waiting</div>
          </button>
        </div>
      </div>
    );
  }

  const movableTokens = state.hasRolled && state.dice ? getMovableLudoTokens(state.tokens, myColor, state.dice) : [];

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
        <>
          <PeerBanner peerPresent={sync.peerPresent} peerName={peerName} />
          <GameChatOverlay sync={sync} peerName={peerName} />
        </>
      )}

      <div className="mb-4 flex items-center justify-between rounded-2xl border bg-card p-4 shadow-sm">
        <div className="text-sm font-bold">
          {state.turn === "r" ? "🔴 Red's Turn" : "🟡 Yellow's Turn"}
        </div>
        <button
          type="button"
          disabled={!isMyTurn || state.hasRolled || !!state.winner}
          onClick={rollDice}
          className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white transition hover:bg-blue-700 active:scale-95 disabled:opacity-40"
        >
          {state.dice ? `Rolled: ${state.dice}` : "Roll 🎲"}
        </button>
      </div>

      <div className="mx-auto flex max-w-xs flex-col gap-3 rounded-2xl border bg-muted/30 p-4">
        {state.tokens.map((token) => {
          const isMine = token.color === myColor;
          const isMovable = movableTokens.some((t) => t.id === token.id);

          return (
            <div
              key={token.id}
              className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-sm"
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <span>{token.color === "r" ? "🔴 Red" : "🟡 Yellow"}</span>
                <span className="text-muted-foreground">
                  {token.step === -1 ? "(In Base)" : token.step === 32 ? "(Finished 🏆)" : `(Step ${token.step}/32)`}
                </span>
              </div>
              {isMine && isMovable && state.dice && (
                <button
                  type="button"
                  onClick={() => handleMoveToken(token.id, state.dice!, true)}
                  className="rounded-lg bg-green-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-green-700"
                >
                  Move ➔
                </button>
              )}
            </div>
          );
        })}
      </div>

      {state.winner && (
        <div className="mt-5 rounded-2xl border bg-card p-5 text-center shadow-sm">
          <div className="text-xl font-black">
            {state.winner === myColor ? "🏆 You Win!" : "😅 You Lost!"}
          </div>
          <button
            type="button"
            onClick={() => {
              setState(createInitialLudoState());
              if (mode === "friend") sync.send("ludo_reset", {});
            }}
            className="mx-auto mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <RotateCcw className="h-4 w-4" />
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   MAIN SUITE CONTAINER & MENU
========================================================= */

export function XupGames({
  conversationId,
  userId,
  peerId,
  peerName,
  onClose,
  gameSync,
}: XupGamesProps) {
  const fallbackSync = useFallbackSync();
  const sync = gameSync ?? fallbackSync;

  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  const goBack = () => setActiveGame(null);

  const renderActiveGame = () => {
    switch (activeGame) {
      case "ttt":
        return <TicTacToe onBack={goBack} sync={sync} userId={userId} peerId={peerId} peerName={peerName} />;
      case "rps":
        return <RPSGame onBack={goBack} sync={sync} peerName={peerName} />;
      case "emoji":
        return <EmojiGuess onBack={goBack} />;
      case "reaction":
        return <ReactionGame onBack={goBack} />;
      case "chess":
        return <ChessGame onBack={goBack} />;
      case "checkers":
        return <CheckersGame onBack={goBack} />;
      case "ludo":
        return <LudoGame onBack={goBack} sync={sync} userId={userId} peerId={peerId} peerName={peerName} />;
      default:
        return null;
    }
  };

  if (activeGame) {
    return <div className="p-4">{renderActiveGame()}</div>;
  }

  const gameList: { id: GameId; title: string; desc: string; icon: string }[] = [
    { id: "ttt", title: "Tic-Tac-Toe", desc: "Turn-based classic with coin flip & chat", icon: "❌⭕" },
    { id: "rps", title: "Rock Paper Scissors", desc: "Simultaneous reveal match with chat", icon: "🪨📄" },
    { id: "emoji", title: "Emoji Quiz", desc: "Guess the hidden phrase", icon: "🧩" },
    { id: "reaction", title: "Reaction Speed", desc: "Tap fast when screen turns green", icon: "⚡" },
    { id: "chess", title: "Chess", desc: "Classic strategy with legal moves & bot", icon: "♟️" },
    { id: "checkers", title: "Checkers", desc: "Drafts with jumps, kings & bot", icon: "⚪🔴" },
    { id: "ludo", title: "Ludo", desc: "2-Player track race vs friend or bot", icon: "🎲" },
  ];

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Xup Mini Games</h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-1 text-xs font-semibold hover:bg-muted"
          >
            Close
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {gameList.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setActiveGame(g.id)}
            className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 text-left shadow-sm transition hover:bg-muted active:scale-95"
          >
            <span className="text-2xl">{g.icon}</span>
            <div>
              <div className="text-sm font-bold">{g.title}</div>
              <div className="text-xs text-muted-foreground">{g.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default XupGames;