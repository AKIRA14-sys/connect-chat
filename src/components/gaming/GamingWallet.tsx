import { useCallback, useEffect, useMemo, useState } from "react";
import { ensureGamingProfile } from "@/lib/gaming.functions";

type GamingProfile = {
  user_id?: string;
  x_coins?: number | string | null;
  total_xp?: number | string | null;
  current_level?: number | string | null;
  level?: number | string | null;
  games_played?: number | string | null;
  wins?: number | string | null;
  losses?: number | string | null;
  draws?: number | string | null;
  current_streak?: number | string | null;
  longest_streak?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatNumber(value: unknown) {
  return toNumber(value).toLocaleString();
}

function XCoinIcon({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `${Math.max(2, Math.round(size / 12))}px solid currentColor`,
        boxSizing: "border-box",
        fontWeight: 900,
        fontSize: Math.round(size * 0.48),
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      X
    </span>
  );
}

export default function GamingWallet() {
  const [profile, setProfile] = useState<GamingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (isRefresh = false) => {
    try {
      setError(null);
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await ensureGamingProfile();
      const raw = response?.profile;

      const nextProfile =
        raw && typeof raw === "object"
          ? (raw as GamingProfile)
          : null;

      if (!nextProfile) {
        throw new Error("Gaming profile was not returned.");
      }

      setProfile(nextProfile);
    } catch (err) {
      console.error("Failed to load gaming wallet:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your gaming information.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const stats = useMemo(() => {
    const gamesPlayed = toNumber(profile?.games_played);
    const wins = toNumber(profile?.wins);
    const losses = toNumber(profile?.losses);
    const draws = toNumber(profile?.draws);
    const winRate =
      gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;

    return {
      gamesPlayed,
      wins,
      losses,
      draws,
      winRate,
      currentStreak: toNumber(profile?.current_streak),
      longestStreak: toNumber(profile?.longest_streak),
      coins: toNumber(profile?.x_coins),
      xp: toNumber(profile?.total_xp),
      level: toNumber(profile?.current_level ?? profile?.level),
    };
  }, [profile]);

  if (loading) {
    return (
      <section
        aria-label="Gaming wallet"
        className="rounded-2xl border p-5"
      >
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-40 rounded bg-muted" />
          <div className="h-24 rounded-2xl bg-muted" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 rounded-xl bg-muted" />
            <div className="h-20 rounded-xl bg-muted" />
            <div className="h-20 rounded-xl bg-muted" />
            <div className="h-20 rounded-xl bg-muted" />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-label="Gaming wallet"
        className="rounded-2xl border p-5"
      >
        <h2 className="text-xl font-bold">Gaming Wallet</h2>
        <p className="mt-3 text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => void loadProfile(true)}
          disabled={refreshing}
          className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Try again"}
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Gaming wallet and stats"
      className="space-y-4 rounded-2xl border p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Gaming</p>
          <h2 className="text-2xl font-black">Wallet & Stats</h2>
        </div>

        <button
          type="button"
          onClick={() => void loadProfile(true)}
          disabled={refreshing}
          className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          aria-label="Refresh gaming wallet"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="rounded-2xl border p-5">
        <div className="flex items-center gap-3">
          <XCoinIcon size={38} />
          <div>
            <p className="text-sm text-muted-foreground">X Coins</p>
            <p className="text-3xl font-black">
              {formatNumber(stats.coins)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">XP</p>
          <p className="mt-1 text-xl font-bold">
            {formatNumber(stats.xp)}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Level</p>
          <p className="mt-1 text-xl font-bold">
            {formatNumber(stats.level)}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Games Played</p>
          <p className="mt-1 text-xl font-bold">
            {formatNumber(stats.gamesPlayed)}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Wins</p>
          <p className="mt-1 text-xl font-bold">
            {formatNumber(stats.wins)}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Losses</p>
          <p className="mt-1 text-xl font-bold">
            {formatNumber(stats.losses)}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Draws</p>
          <p className="mt-1 text-xl font-bold">
            {formatNumber(stats.draws)}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Win Rate</p>
          <p className="mt-1 text-xl font-bold">
            {stats.winRate.toFixed(1)}%
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Current Streak</p>
          <p className="mt-1 text-xl font-bold">
            {formatNumber(stats.currentStreak)}
          </p>
        </div>

        <div className="col-span-2 rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Longest Streak</p>
          <p className="mt-1 text-xl font-bold">
            {formatNumber(stats.longestStreak)}
          </p>
        </div>
      </div>
    </section>
  );
}
