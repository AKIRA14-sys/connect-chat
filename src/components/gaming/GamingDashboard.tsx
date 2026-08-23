import { useEffect, useState } from "react";
import {
  BarChart3,
  Flame,
  Gamepad2,
  ShieldCheck,
  Star,
  Trophy,
} from "lucide-react";

import { XCoinIcon } from "@/components/gaming/XCoinIcon";
import { ensureGamingProfile } from "@/lib/gaming.functions";

type GamingProfile = {
  user_id: string;
  x_coins: number;
  total_xp: number;
  current_level: number;
  created_at: string;
  updated_at: string;
};

type GamingDashboardProps = {
  userId: string;
};

const EMPTY_PROFILE: GamingProfile = {
  user_id: "",
  x_coins: 0,
  total_xp: 0,
  current_level: 1,
  created_at: "",
  updated_at: "",
};

export function GamingDashboard({
  userId,
}: GamingDashboardProps) {
  const [profile, setProfile] =
    useState<GamingProfile>(EMPTY_PROFILE);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await ensureGamingProfile({});

        if (!cancelled) {
          setProfile(
            (response.profile as GamingProfile) ??
              EMPTY_PROFILE,
          );
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

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  const xp = Number(profile.total_xp ?? 0);
  const coins = Number(profile.x_coins ?? 0);
  const level = Number(profile.current_level ?? 1);

  /*
   * The Gaming Supabase currently exposes the authoritative
   * profile values above. Match statistics and streak data
   * will be added from their dedicated gaming tables/functions
   * rather than pretending they are columns in gaming_profiles.
   */

  const xpForNextLevel = Math.max(level * 500, 500);

  const xpProgress = Math.min(
    100,
    Math.round(
      (xp % xpForNextLevel) /
        xpForNextLevel *
        100,
    ),
  );

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
            Your gaming rewards and progression
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
                {coins.toLocaleString()}
              </span>
            </div>
          </div>

          <ShieldCheck className="h-6 w-6 text-green-400" />
        </div>

        <p className="mt-3 text-xs text-white/40">
          Your X Coin balance is controlled by the
          secure gaming system.
        </p>
      </div>

      {/* XP / Level */}
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
                Level {level}
              </p>
            </div>
          </div>

          <p className="text-sm font-semibold">
            {xp.toLocaleString()} XP
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
              style={{
                width: `${xpProgress}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Coming gaming statistics */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />

          <h3 className="font-bold">
            Gaming Statistics
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Level"
            value={level}
            icon={<Trophy className="h-4 w-4" />}
          />

          <StatCard
            label="Total XP"
            value={xp}
            icon={<Star className="h-4 w-4" />}
          />

          <StatCard
            label="X Coins"
            value={coins}
            icon={<XCoinIcon size={18} />}
          />

          <StatCard
            label="Gaming"
            value="Active"
            icon={<Flame className="h-4 w-4" />}
          />
        </div>

        <p className="mt-4 text-xs text-white/40">
          Detailed wins, losses, draws and streaks
          will be connected to their dedicated gaming
          statistics data next.
        </p>
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