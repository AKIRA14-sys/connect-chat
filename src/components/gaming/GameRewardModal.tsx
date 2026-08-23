import {
  CheckCircle2,
  Clock,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";

import { XCoinIcon } from "@/components/gaming/XCoinIcon";

export type GameRewardResult =
  | "win"
  | "draw"
  | "loss";

export type GameRewardModalProps = {
  open: boolean;
  result: GameRewardResult;
  xCoins?: number;
  xp?: number;
  onClose: () => void;
};

export function GameRewardModal({
  open,
  result,
  xCoins = 0,
  xp = 0,
  onClose,
}: GameRewardModalProps) {
  if (!open) {
    return null;
  }

  const isWin = result === "win";
  const isDraw = result === "draw";

  const title = isWin
    ? "YOU WON!"
    : isDraw
      ? "DRAW!"
      : "GAME OVER";

  const subtitle = isWin
    ? "Congratulations! 🎉"
    : isDraw
      ? "A well-played match."
      : "Better luck next time!";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-reward-title"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-black/90 p-6 shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close reward"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Result icon */}
        <div className="flex justify-center pt-2">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
            {isWin ? (
              <Trophy className="h-10 w-10" />
            ) : isDraw ? (
              <Clock className="h-10 w-10" />
            ) : (
              <CheckCircle2 className="h-10 w-10" />
            )}
          </div>
        </div>

        {/* Title */}
        <div className="mt-5 text-center">
          <h2
            id="game-reward-title"
            className="text-2xl font-black tracking-wide text-white"
          >
            {title}
          </h2>

          <p className="mt-1 text-sm text-white/50">
            {subtitle}
          </p>
        </div>

        {/* Rewards */}
        <div className="mt-6 space-y-3">
          {/* X Coins */}
          {xCoins > 0 && (
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <XCoinIcon
                  size={38}
                  className="text-yellow-400"
                />

                <div>
                  <p className="text-sm font-semibold text-white">
                    X Coins
                  </p>

                  <p className="text-xs text-white/40">
                    Gaming reward
                  </p>
                </div>
              </div>

              <p className="text-lg font-black text-white">
                +{xCoins.toLocaleString()}
              </p>
            </div>
          )}

          {/* XP */}
          {xp > 0 && (
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/10">
                  <Sparkles className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-white">
                    XP
                  </p>

                  <p className="text-xs text-white/40">
                    Experience earned
                  </p>
                </div>
              </div>

              <p className="text-lg font-black text-white">
                +{xp.toLocaleString()}
              </p>
            </div>
          )}

          {/* No reward */}
          {xCoins <= 0 && xp <= 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-sm text-white/50">
                No rewards were awarded for this match.
              </p>
            </div>
          )}
        </div>

        {/* Continue */}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:opacity-90 active:scale-[0.98]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export default GameRewardModal;