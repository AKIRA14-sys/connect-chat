import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Flame,
  Gamepad2,
  ShieldCheck,
  Star,
  Trophy,
} from "lucide-react";

import { XCoinIcon } from "@/components/gaming/XCoinIcon";
import { supabase } from "@/integrations/supabase/client";

type GamingProfile = {
  x_coins: number;
  xp: number;
  level: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  current_streak: number;
  longest_streak: number;
};

type GamingDashboardProps = {
  userId: string;
};

const DEFAULT_PROFILE: GamingProfile = {
  x_coins: 0,
  xp: 0,
  level: 1,
  games_played: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  current_streak: 0,
  longest_streak: 0,
};

export function GamingDashboard({
  userId,
}: GamingDashboardProps) {
  const [profile, setProfile] =
    useState<GamingProfile>(DEFAULT_PROFILE);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGamingProfile() {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("gaming_profiles")
          .select(
            `
              x_coins,
              xp,
              level,
              games_played,
              wins,
              losses,
              draws,
              current_streak,
              longest_streak
            `,
          )
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setProfile(data ?? DEFAULT_PROFILE);
        }
      } catch (err) {
        console.error(
          "Failed to load gaming profile:",
          err,
        );

        if (!cancelled) {
          setError(
            "Unable to load your gaming profile.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadGamingProfile();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const winRate = useMemo(() => {
    if (profile.games_played <= 0) {
      return 0;
    }

    return Math.round(
      (profile.wins / profile.games_played) * 100,
    );
  }, [profile.games_played, profile.wins]);

  const xpForNextLevel = useMemo(() => {
    return profile.level * 500;
  }, [profile.level]);

  const xpProgress = useMemo(() => {
    if (xpForNextLevel <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (profile.xp / xpForNextLevel) * 100,
      ),
    );
  }, [profile.xp, xpForNextLevel]);

  if (loading) {
    return (
      <section className="w-full rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-40 rounded bg-white/10" />
          <div className="h-24 rounded-xl bg-white/10" />
          <div className="grid grid-cols-2 gap-3">
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
        <p className="text-sm text-red-300">
          {error}
        </p>
      </section>
    );
  }

  return (
    <section className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
          <Gamepad2 className="h-6 w-6" />
        </div>

        <div>
          <h2 className="text-xl font-bold">
            Gaming Profile
          </h2>

          <p className="text-sm text-white/50">
            Your gaming progress and rewards
          </p>
        </div>
      </div>

      {/* X Coins */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50">
              X Coins
            </p>

            <div className="mt-2 flex items-center gap-3">
              <XCoinIcon
                size={42}
                className="text-yellow-400"
              />

              <span className="text-3xl font-black">
                {profile.x_coins.toLocaleString()}
              </span>
            </div>
          </div>

          <ShieldCheck className="h-6 w-6 text-green-400" />
        </div>

        <p className="mt-3 text-xs text-white/40">
          Your balance is controlled by the gaming
          server and cannot be changed directly
          from this screen.
        </p>
      </div>

      {/* Level and XP */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
              <Star className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs text-white/50">
                Current Level
              </p>

              <p className="text-2xl font-bold">
                Level {profile.level}
              </p>
            </div>
          </div>

          <p className="text-sm font-semibold">
            {profile.xp.toLocaleString()} XP
          </p>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex justify-between text-xs text-white/50">
            <span>XP Progress</span>

            <span>
              {xpProgress}%
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-current transition-all"
              style={{
                width: `${xpProgress}%`,
              }}
            />
          </div>

          <p className="mt-2 text-xs text-white/40">
            {Math.max(
              0,
              xpForNextLevel - profile.xp,
            ).toLocaleString()}{" "}
            XP until the next level
          </p>
        </div>
      </div>

      {/* Statistics */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />

          <h3 className="font-bold">
            Gaming Stats
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Games Played"
            value={profile.games_played}
            icon={<Gamepad2 className="h-4 w-4" />}
          />

          <StatCard
            label="Wins"
            value={profile.wins}
            icon={<Trophy className="h-4 w-4" />}
          />

          <StatCard
            label="Losses"
            value={profile.losses}
            icon={<span>✕</span>}
          />

          <StatCard
            label="Draws"
            value={profile.draws}
            icon={<span>＝</span>}
          />

          <StatCard
            label="Win Rate"
            value={`${winRate}%`}
            icon={<BarChart3 className="h-4 w-4" />}
          />

          <StatCard
            label="Current Streak"
            value={profile.current_streak}
            icon={<Flame className="h-4 w-4" />}
          />

          <StatCard
            label="Longest Streak"
            value={profile.longest_streak}
            icon={<Trophy className="h-4 w-4" />}
          />

          <StatCard
            label="XP"
            value={profile.xp}
            icon={<Star className="h-4 w-4" />}
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