import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  RotateCcw,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type Game =
  | "menu"
  | "tictactoe"
  | "rps"
  | "emoji"
  | "reaction";

type Mark = "X" | "O" | null;

type RpsChoice = "rock" | "paper" | "scissors";

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

      <div className="mt-5 rounded-2xl bg-blue-600/10 p-4 text-center">
        <p className="text-xs text-muted-foreground">
          🎮 More XUP games coming soon
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   TIC TAC TOE — TWO PLAYER
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

  // Deterministic role: whoever has the "smaller" id plays X and goes first.
  const amX = !hasPeer || userId < (peerId as string);

  const [board, setBoard] = useState<Mark[]>(
    Array(9).fill(null),
  );

  const [turn, setTurn] = useState<"X" | "O">("X");
  const [xScore, setXScore] = useState(0);
  const [oScore, setOScore] = useState(0);

  const myMark: "X" | "O" = amX ? "X" : "O";

  const winner = useMemo(
    () => checkTicTacToeWinner(board),
    [board],
  );

  useEffect(() => {
    if (!hasPeer) return;

    const offMove = sync.on("ttt_move", (data) => {
      setBoard((prev) => {
        const next = [...prev];
        next[data.index] = data.mark;
        return next;
      });

      setTurn(data.mark === "X" ? "O" : "X");
    });

    const offReset = sync.on("ttt_reset", () => {
      setBoard(Array(9).fill(null));
      setTurn("X");
    });

    const offState = sync.on("ttt_state", (data) => {
      setBoard(data.board);
      setTurn(data.turn);
    });

    // If the peer just joined mid-game, the host re-shares state.
    return () => {
      offMove();
      offReset();
      offState();
    };
  }, [sync, hasPeer]);

  useEffect(() => {
    const result = checkTicTacToeWinner(board);

    if (result === "X") setXScore((s) => s + 1);
    if (result === "O") setOScore((s) => s + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  const play = (index: number) => {
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

  const reset = () => {
    setBoard(Array(9).fill(null));
    setTurn("X");

    if (hasPeer) {
      sync.send("ttt_reset", {});
    }
  };

  return (
    <div className="w-full">
      <GameHeader
        title="❌⭕ Tic-Tac-Toe"
        onBack={onBack}
        status={
          hasPeer
            ? `You are ${myMark}`
            : "Practice mode"
        }
      />

      {hasPeer && (
        <PeerBanner
          peerPresent={sync.peerPresent}
          peerName={peerName}
        />
      )}

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
          onClick={reset}
          className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
          Play Again
        </button>
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