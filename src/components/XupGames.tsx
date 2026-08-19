import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";

type Game =
  | "menu"
  | "tictactoe"
  | "rps"
  | "emoji"
  | "reaction";

type Mark = "X" | "O" | null;

type RpsChoice =
  | "rock"
  | "paper"
  | "scissors";

interface XupGamesProps {
  onClose?: () => void;
}

/* =========================================================
   EMOJI QUESTIONS
========================================================= */

const EMOJI_QUESTIONS = [
  {
    emojis: "🦁👑",
    answer: "the lion king",
  },
  {
    emojis: "❄️👸",
    answer: "frozen",
  },
  {
    emojis: "🕷️🧑",
    answer: "spider-man",
  },
  {
    emojis: "🚢💔",
    answer: "titanic",
  },
  {
    emojis: "🧙‍♂️⚡",
    answer: "harry potter",
  },
  {
    emojis: "🐠🔎",
    answer: "finding nemo",
  },
  {
    emojis: "🤖🚗",
    answer: "transformers",
  },
  {
    emojis: "🦖🏝️",
    answer: "jurassic park",
  },
  {
    emojis: "👻🚫",
    answer: "ghostbusters",
  },
  {
    emojis: "🍫🏭",
    answer: "willy wonka",
  },
];

/* =========================================================
   ROCK PAPER SCISSORS
========================================================= */

const RPS_CHOICES: {
  value: RpsChoice;
  emoji: string;
  label: string;
}[] = [
  {
    value: "rock",
    emoji: "✊",
    label: "Rock",
  },
  {
    value: "paper",
    emoji: "✋",
    label: "Paper",
  },
  {
    value: "scissors",
    emoji: "✌️",
    label: "Scissors",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function getRandomItem<T>(items: T[]): T {
  return items[
    Math.floor(Math.random() * items.length)
  ];
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

  if (board.every(Boolean)) {
    return "draw";
  }

  return null;
}

function getRpsResult(
  player: RpsChoice,
  opponent: RpsChoice,
): "win" | "lose" | "draw" {
  if (player === opponent) {
    return "draw";
  }

  if (
    (player === "rock" &&
      opponent === "scissors") ||
    (player === "paper" &&
      opponent === "rock") ||
    (player === "scissors" &&
      opponent === "paper")
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
}: {
  title: string;
  onBack: () => void;
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
        <h2 className="truncate text-lg font-bold">
          {title}
        </h2>

        <p className="text-xs text-muted-foreground">
          XUP Games
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   GAME MENU
========================================================= */

function GameMenu({
  onSelect,
}: {
  onSelect: (game: Game) => void;
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
      description: "Guess the movie",
    },
    {
      id: "reaction" as Game,
      emoji: "⚡",
      title: "Reaction Battle",
      description: "Test your speed",
    },
  ];

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600/15 text-5xl shadow-sm">
          🎮
        </div>

        <h2 className="text-2xl font-black">
          XUP Games
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Take a break and play something fun.
        </p>
      </div>

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

            <div className="text-sm font-bold">
              {game.title}
            </div>

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
   TIC TAC TOE
========================================================= */

function TicTacToe({
  onBack,
}: {
  onBack: () => void;
}) {
  const [board, setBoard] = useState<Mark[]>(
    Array(9).fill(null),
  );

  const [turn, setTurn] =
    useState<"X" | "O">("X");

  const [xScore, setXScore] = useState(0);
  const [oScore, setOScore] = useState(0);

  const winner = useMemo(
    () => checkTicTacToeWinner(board),
    [board],
  );

  const play = (index: number) => {
    if (board[index] || winner) {
      return;
    }

    const nextBoard = [...board];

    nextBoard[index] = turn;

    setBoard(nextBoard);

    const result =
      checkTicTacToeWinner(nextBoard);

    if (result === "X") {
      setXScore((score) => score + 1);
      return;
    }

    if (result === "O") {
      setOScore((score) => score + 1);
      return;
    }

    if (!result) {
      setTurn((current) =>
        current === "X" ? "O" : "X",
      );
    }
  };

  const reset = () => {
    setBoard(Array(9).fill(null));
    setTurn("X");
  };

  return (
    <div className="w-full">
      <GameHeader
        title="❌⭕ Tic-Tac-Toe"
        onBack={onBack}
      />

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
          <div className="font-bold">
            🤝 It's a draw!
          </div>
        ) : winner ? (
          <div className="font-bold">
            🏆 {winner} wins!
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Turn:{" "}
            <span className="font-bold text-foreground">
              {turn}
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
   ROCK PAPER SCISSORS
========================================================= */

function RockPaperScissors({
  onBack,
}: {
  onBack: () => void;
}) {
  const [result, setResult] =
    useState<string | null>(null);

  const [playerChoice, setPlayerChoice] =
    useState<RpsChoice | null>(null);

  const [opponentChoice, setOpponentChoice] =
    useState<RpsChoice | null>(null);

  const [score, setScore] = useState({
    wins: 0,
    losses: 0,
    draws: 0,
  });

  const play = (choice: RpsChoice) => {
    const opponent =
      getRandomItem(
        RPS_CHOICES.map(
          (item) => item.value,
        ),
      );

    const outcome = getRpsResult(
      choice,
      opponent,
    );

    setPlayerChoice(choice);
    setOpponentChoice(opponent);

    if (outcome === "win") {
      setScore((current) => ({
        ...current,
        wins: current.wins + 1,
      }));

      setResult("🔥 You win!");
    }

    if (outcome === "lose") {
      setScore((current) => ({
        ...current,
        losses: current.losses + 1,
      }));

      setResult("💀 You lose!");
    }

    if (outcome === "draw") {
      setScore((current) => ({
        ...current,
        draws: current.draws + 1,
      }));

      setResult("🤝 Draw!");
    }
  };

  const reset = () => {
    setResult(null);
    setPlayerChoice(null);
    setOpponentChoice(null);
    setScore({
      wins: 0,
      losses: 0,
      draws: 0,
    });
  };

  const getEmoji = (
    choice: RpsChoice | null,
  ) => {
    return (
      RPS_CHOICES.find(
        (item) => item.value === choice,
      )?.emoji || "❔"
    );
  };

  return (
    <div className="w-full">
      <GameHeader
        title="✊ Rock Paper Scissors"
        onBack={onBack}
      />

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

            <span className="text-xl text-muted-foreground">
              VS
            </span>

            <span>
              {getEmoji(opponentChoice)}
            </span>
          </div>

          <div className="text-xl font-black">
            {result}
          </div>
        </div>
      )}

      {!result && (
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
            onClick={() =>
              play(choice.value)
            }
            className="rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-1 hover:bg-muted active:scale-95"
          >
            <div className="text-4xl">
              {choice.emoji}
            </div>

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
          Reset Score
        </button>
      )}
    </div>
  );
}

/* =========================================================
   EMOJI GUESS
========================================================= */

function EmojiGuess({
  onBack,
}: {
  onBack: () => void;
}) {
  const [question, setQuestion] =
    useState(() =>
      getRandomItem(EMOJI_QUESTIONS),
    );

  const [answer, setAnswer] = useState("");

  const [score, setScore] = useState(0);

  const [wrong, setWrong] = useState(false);

  const nextQuestion = () => {
    let next = getRandomItem(
      EMOJI_QUESTIONS,
    );

    while (
      next.emojis === question.emojis &&
      EMOJI_QUESTIONS.length > 1
    ) {
      next = getRandomItem(
        EMOJI_QUESTIONS,
      );
    }

    setQuestion(next);
    setAnswer("");
    setWrong(false);
  };

  const submit = () => {
    const normalized = answer
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "");

    const correct = question.answer
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "");

    if (normalized === correct) {
      setScore((current) => current + 1);
      nextQuestion();
      return;
    }

    setWrong(true);
  };

  return (
    <div className="w-full">
      <GameHeader
        title="🧠 Emoji Guess"
        onBack={onBack}
      />

      <div className="mb-5 flex justify-center">
        <div className="rounded-xl bg-blue-600/10 px-4 py-2 text-sm font-bold">
          🏆 Score: {score}
        </div>
      </div>

      <div className="mb-5 rounded-3xl border bg-card p-8 text-center shadow-sm">
        <p className="mb-5 text-xs text-muted-foreground">
          Guess the movie
        </p>

        <div className="text-6xl">
          {question.emojis}
        </div>
      </div>

      <input
        value={answer}
        onChange={(event) => {
          setAnswer(event.target.value);
          setWrong(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            submit();
          }
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
        onClick={nextQuestion}
        className="mx-auto mt-3 block text-xs text-muted-foreground underline"
      >
        Skip question
      </button>
    </div>
  );
}

/* =========================================================
   REACTION BATTLE
========================================================= */

function ReactionBattle({
  onBack,
}: {
  onBack: () => void;
}) {
  const [state, setState] = useState<
    "idle" | "waiting" | "ready" | "result" | "tooSoon"
  >("idle");

  const [reactionTime, setReactionTime] =
    useState<number | null>(null);

  const [bestTime, setBestTime] =
    useState<number | null>(null);

  const [startTime, setStartTime] =
    useState<number | null>(null);

  const timerRef =
    useState<ReturnType<typeof setTimeout> | null>(
      null,
    )[0];

  useEffect(() => {
    return () => {
      if (timerRef) {
        clearTimeout(timerRef);
      }
    };
  }, [timerRef]);

  const start = () => {
    setState("waiting");
    setReactionTime(null);
    setStartTime(null);

    const delay =
      1500 + Math.random() * 3500;

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

      setBestTime((current) => {
        if (current === null) {
          return time;
        }

        return Math.min(current, time);
      });

      setState("result");
    }

    if (
      state === "result" ||
      state === "tooSoon"
    ) {
      start();
    }
  };

  const buttonText = {
    idle: "TAP TO START",
    waiting: "WAIT...",
    ready: "TAP NOW!",
    result: `${reactionTime}ms`,
    tooSoon: "TOO SOON!",
  }[state];

  return (
    <div className="w-full">
      <GameHeader
        title="⚡ Reaction Battle"
        onBack={onBack}
      />

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

        {state === "result" && (
          <p className="text-xs font-semibold">
            🔥 Nice! Try to beat your record.
          </p>
        )}
      </div>

      {(state === "result" ||
        state === "tooSoon") && (
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
========================================================= */

export default function XupGames({
  onClose,
}: XupGamesProps) {
  const [game, setGame] =
    useState<Game>("menu");

  const goBack = () => {
    setGame("menu");
  };

  const content = () => {
    switch (game) {
      case "tictactoe":
        return (
          <TicTacToe
            onBack={goBack}
          />
        );

      case "rps":
        return (
          <RockPaperScissors
            onBack={goBack}
          />
        );

      case "emoji":
        return (
          <EmojiGuess
            onBack={goBack}
          />
        );

      case "reaction":
        return (
          <ReactionBattle
            onBack={goBack}
          />
        );

      default:
        return (
          <GameMenu
            onSelect={setGame}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur-md">
      <div className="relative my-auto w-full max-w-md rounded-3xl border bg-background p-5 shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close XUP Games"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-90"
        >
          <X className="h-5 w-5" />
        </button>

        {content()}
      </div>
    </div>
  );
}