import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BarChart3,
  Flame,
  Gamepad2,
  RefreshCw,
  ShieldCheck,
  Star,
  Trophy,
} from "lucide-react";

import { XCoinIcon } from "@/components/gaming/XCoinIcon";
import { getGamingWallet } from "@/lib/gaming.functions";

type GamingWallet = {
  user_id: string;
  x_coins: number;
  total_xp: number;
  level: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  current_streak: number;
  longest_streak: number;
  bot_games: number;
  real_user_games: number;
};

type GamingDashboardProps = {
  userId: string;
};

const EMPTY_WALLET: GamingWallet = {
  user_id: "",
  x_coins: 0,
  total_xp: 0,
  level: 1,
  games_played: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  current_streak: 0,
  longest_streak: 0,
  bot_games: 0,
  real_user_games: 0,
};

function safeNumber(value: unknown): number {
  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}

export function GamingDashboard({
  userId,
}: GamingDashboardProps) {
  const [wallet, setWallet] =
    useState<GamingWallet>(
      EMPTY_WALLET,
    );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const loadWallet = useCallback(
    async (refresh = false) => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setError(null);

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        /*
         * IMPORTANT:
         *
         * This now calls getGamingWallet()
         * instead of ensureGamingProfile().
         *
         * getGamingWallet() reads:
         * - gaming_profiles
         * - gaming_stats
         * - gaming_streaks
         */
        const response =
          await getGamingWallet();

        if (
          !response ||
          !response.wallet
        ) {
          throw new Error(
            "Gaming wallet was not returned.",
          );
        }

        const data =
          response.wallet;

        setWallet({
          user_id:
            String(
              data.user_id ??
                userId,
            ),

          x_coins:
            safeNumber(
              data.x_coins,
            ),

          total_xp:
            safeNumber(
              data.total_xp,
            ),

          level:
            safeNumber(
              data.level,
            ) || 1,

          games_played:
            safeNumber(
              data.games_played,
            ),

          wins:
            safeNumber(
              data.wins,
            ),

          losses:
            safeNumber(
              data.losses,
            ),

          draws:
            safeNumber(
              data.draws,
            ),

          current_streak:
            safeNumber(
              data.current_streak,
            ),

          longest_streak:
            safeNumber(
              data.longest_streak,
            ),

          bot_games:
            safeNumber(
              data.bot_games,
            ),

          real_user_games:
            safeNumber(
              data.real_user_games,
            ),
        });
      } catch (err) {
        console.error(
          "Failed to load gaming wallet:",
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your gaming wallet.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  /*
   * Load the wallet when the dashboard opens.
   */
  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const stats = useMemo(() => {
    const games =
      safeNumber(
        wallet.games_played,
      );

    const wins =
      safeNumber(
        wallet.wins,
      );

    const losses =
      safeNumber(
        wallet.losses,
      );

    const draws =
      safeNumber(
        wallet.draws,
      );

    const coins =
      safeNumber(
        wallet.x_coins,
      );

    const xp =
      safeNumber(
        wallet.total_xp,
      );

    const level =
      safeNumber(
        wallet.level,
      ) || 1;

    const currentStreak =
      safeNumber(
        wallet.current_streak,
      );

    const longestStreak =
      safeNumber(
        wallet.longest_streak,
      );

    const winRate =
      games > 0
        ? (wins / games) * 100
        : 0;

    return {
      games,
      wins,
      losses,
      draws,
      coins,
      xp,
      level,
      currentStreak,
      longestStreak,
      winRate,
    };
  }, [wallet]);

  /*
   * Loading state
   */
  if (loading) {
    return (
      <section className="w-full rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-40 rounded bg-white/10" />

          <div className="h-28 rounded-xl bg-white/10" />

          <div className="h-24 rounded-xl bg-white/10" />

          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 rounded-xl bg-white/10" />
            <div className="h-20 rounded-xl bg-white/10" />
            <div className="h-20 rounded-xl bg-white/10" />
            <div className="h-20 rounded-xl bg-white/10" />
          </div>
        </div>
      </section>
    );
  }

  /*
   * Error state
   */
  if (error) {
    return (
      <section className="w-full rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-red-400" />

          <div>
            <p className="font-semibold text-red-300">
              Gaming wallet unavailable
            </p>

            <p className="mt-1 text-sm text-red-300/70">
              {error}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadWallet(true)
          }
          disabled={refreshing}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing
                ? "animate-spin"
                : ""
            }`}
          />

          {refreshing
            ? "Refreshing..."
            : "Try again"}
        </button>
      </section>
    );
  }

  /*
   * XP progress
   */
  const xpForNextLevel = Math.max(
    stats.level * 500,
    500,
  );

  const xpIntoLevel =
    stats.xp % xpForNextLevel;

  const xpProgress = Math.min(
    100,
    Math.round(
      (xpIntoLevel /
        xpForNextLevel) *
        100,
    ),
  );

  return (
    <section className="w-full space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <Gamepad2 className="h-6 w-6" />
          </div>

          <div>
            <h2 className="text-xl font-bold">
              Gaming Profile
            </h2>

            <p className="text-sm text-white/50">
              Your rewards, wallet and progression
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadWallet(true)
          }
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/5 disabled:opacity-50"
          aria-label="Refresh gaming information"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing
                ? "animate-spin"
                : ""
            }`}
          />

          Refresh
        </button>
      </div>

      {/* X COIN WALLET */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50">
              X Coin Wallet
            </p>

            <div className="mt-2 flex items-center gap-3">
              <XCoinIcon
                size={42}
                className="text-yellow-400"
              />

              <span className="text-3xl font-black">
                {stats.coins.toLocaleString()}
              </span>
            </div>
          </div>

          <ShieldCheck className="h-6 w-6 text-green-400" />
        </div>

        <p className="mt-3 text-xs text-white/40">
          Your X Coin balance is controlled
          by the secure gaming system.
        </p>
      </div>

      {/* XP AND LEVEL */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
              <Star className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs text-white/50">
                Current Level
              </p>

              <p className="text-2xl font-bold">
                Level {stats.level}
              </p>
            </div>
          </div>

          <p className="text-sm font-semibold">
            {stats.xp.toLocaleString()} XP
          </p>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex justify-between text-xs text-white/50">
            <span>
              XP Progress
            </span>

            <span>
              {xpProgress}%
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-current transition-all duration-500"
              style={{
                width: `${xpProgress}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* GAMING STATISTICS */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />

          <h3 className="font-bold">
            Gaming Statistics
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Games Played"
            value={stats.games}
            icon={
              <Gamepad2 className="h-4 w-4" />
            }
          />

          <StatCard
            label="Wins"
            value={stats.wins}
            icon={
              <Trophy className="h-4 w-4" />
            }
          />

          <StatCard
            label="Losses"
            value={stats.losses}
            icon={
              <BarChart3 className="h-4 w-4" />
            }
          />

          <StatCard
            label="Draws"
            value={stats.draws}
            icon={
              <ShieldCheck className="h-4 w-4" />
            }
          />

          <StatCard
            label="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            icon={
              <Star className="h-4 w-4" />
            }
          />

          <StatCard
            label="Current Streak"
            value={stats.currentStreak}
            icon={
              <Flame className="h-4 w-4" />
            }
          />

          <StatCard
            label="Longest Streak"
            value={stats.longestStreak}
            icon={
              <Trophy className="h-4 w-4" />
            }
          />

          <StatCard
            label="Level"
            value={stats.level}
            icon={
              <Star className="h-4 w-4" />
            }
          />
        </div>
      </div>

      {/* GAME TYPE BREAKDOWN */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Gamepad2 className="h-5 w-5" />

          <h3 className="font-bold">
            Game Breakdown
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Bot Games"
            value={safeNumber(wallet.bot_games)}
            icon={
              <Gamepad2 className="h-4 w-4" />
            }
          />

          <StatCard
            label="Real User Games"
            value={safeNumber(
              wallet.real_user_games,
            )}
            icon={
              <Trophy className="h-4 w-4" />
            }
          />
        </div>
      </div>
    </section>
  );
}

type StatCardProps = {
  label: string;
  value: string | number;
  icon: React.ReactNode;
};

function StatCard({
  label,
  value,
  icon,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-white/50">
        {icon}

        <span className="text-xs">
          {label}
        </span>
      </div>

      <p className="mt-2 text-xl font-bold">
        {typeof value === "number"
          ? value.toLocaleString()
          : value}
      </p>
    </div>
  );
}

export default GamingDashboard;