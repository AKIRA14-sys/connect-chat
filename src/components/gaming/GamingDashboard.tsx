import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Flame,
  Gamepad2,
  ShieldCheck,
  Star,
  Trophy,
  RefreshCw,
} from "lucide-react";

import { XCoinIcon } from "@/components/gaming/XCoinIcon";
import { ensureGamingProfile } from "@/lib/gaming.functions";

type GamingProfile = {
  user_id: string;
  x_coins: number;
  total_xp: number;
  level?: number;
  current_level?: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  bot_games?: number;
  real_user_games?: number;
  current_streak: number;
  longest_streak: number;
  created_at?: string;
  updated_at?: string;
};

type GamingDashboardProps = {
  userId: string;
};

const EMPTY_PROFILE: GamingProfile = {
  user_id: "",
  x_coins: 0,
  total_xp: 0,
  level: 1,
  current_level: 1,
  games_played: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  bot_games: 0,
  real_user_games: 0,
  current_streak: 0,
  longest_streak: 0,
};

function number(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export function GamingDashboard({ userId }: GamingDashboardProps) {
  const [profile, setProfile] = useState<GamingProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(
    async (refresh = false) => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setError(null);
        if (refresh) setRefreshing(true);
        else setLoading(true);

        const response = await ensureGamingProfile({});
        const nextProfile = response.profile as GamingProfile | null;

        if (!nextProfile) {
          throw new Error("Gaming profile was not returned.");
        }

        setProfile({
          ...EMPTY_PROFILE,
          ...nextProfile,
          x_coins: number(nextProfile.x_coins),
          total_xp: number(nextProfile.total_xp),
          level: number(nextProfile.level ?? nextProfile.current_level) || 1,
          current_level:
            number(nextProfile.current_level ?? nextProfile.level) || 1,
          games_played: number(nextProfile.games_played),
          wins: number(nextProfile.wins),
          losses: number(nextProfile.losses),
          draws: number(nextProfile.draws),
          current_streak: number(nextProfile.current_streak),
          longest_streak: number(nextProfile.longest_streak),
        });
      } catch (err) {
        console.error("Failed to load gaming profile:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your gaming profile.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const stats = useMemo(() => {
    const games = number(profile.games_played);
    const wins = number(profile.wins);

    return {
      coins: number(profile.x_coins),
      xp: number(profile.total_xp),
      level: number(profile.level ?? profile.current_level) || 1,
      games,
      wins,
      losses: number(profile.losses),
      draws: number(profile.draws),
      currentStreak: number(profile.current_streak),
      longestStreak: number(profile.longest_streak),
      winRate: games > 0 ? (wins / games) * 100 : 0,
    };
  }, [profile]);

  if (loading) {
    return (
      <section className="w-full rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-40 rounded bg-white/10" />
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

  if (error) {
    return (
      <section className="w-full rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
        <p className="text-sm text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void loadProfile(true)}
          disabled={refreshing}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          {refreshing ? "Refreshing..." : "Try again"}
        </button>
      </section>
    );
  }

  const xpForNextLevel = Math.max(stats.level * 500, 500);
  const xpProgress = Math.min(
    100,
    Math.round(((stats.xp % xpForNextLevel) / xpForNextLevel) * 100),
  );

  return (
    <section className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <Gamepad2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Gaming Profile</h2>
            <p className="text-sm text-white/50">
              Your rewards, wallet and progression
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadProfile(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          aria-label="Refresh gaming information"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50">X Coin Wallet</p>
            <div className="mt-2 flex items-center gap-3">
              <XCoinIcon size={42} className="text-yellow-400" />
              <span className="text-3xl font-black">
                {stats.coins.toLocaleString()}
              </span>
            </div>
          </div>
          <ShieldCheck className="h-6 w-6 text-green-400" />
        </div>

        <p className="mt-3 text-xs text-white/40">
          Your balance is controlled by the secure gaming system.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-white/50">Current Level</p>
              <p className="text-2xl font-bold">Level {stats.level}</p>
            </div>
          </div>
          <p className="text-sm font-semibold">
            {stats.xp.toLocaleString()} XP
          </p>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex justify-between text-xs text-white/50">
            <span>XP Progress</span>
            <span>{xpProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-current transition-all"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          <h3 className="font-bold">Gaming Statistics</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Games Played" value={stats.games} icon={<Gamepad2 className="h-4 w-4" />} />
          <StatCard label="Wins" value={stats.wins} icon={<Trophy className="h-4 w-4" />} />
          <StatCard label="Losses" value={stats.losses} icon={<BarChart3 className="h-4 w-4" />} />
          <StatCard label="Draws" value={stats.draws} icon={<ShieldCheck className="h-4 w-4" />} />
          <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} icon={<Star className="h-4 w-4" />} />
          <StatCard label="Current Streak" value={stats.currentStreak} icon={<Flame className="h-4 w-4" />} />
          <StatCard label="Longest Streak" value={stats.longestStreak} icon={<Trophy className="h-4 w-4" />} />
          <StatCard label="Level" value={stats.level} icon={<Star className="h-4 w-4" />} />
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

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-white/50">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

export default GamingDashboard;
