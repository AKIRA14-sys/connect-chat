import { useEffect, useState, type ReactNode } from "react";
import { Flame, Trophy } from "lucide-react";

import {
  getPublicGamingProfile,
  type PublicGamingProfile,
} from "@/lib/gaming.functions";

/**
 * Public gaming stats for ANOTHER user.
 * Never shows X Coin balance (public_gaming_profiles has no x_coins).
 */
export function PublicGamingStats({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<PublicGamingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await getPublicGamingProfile({
          data: { userId },
        });
        if (!cancelled) {
          setProfile(res.profile ?? null);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Unable to load gaming stats");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Loading gaming stats…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        No public gaming profile yet.
      </div>
    );
  }

  const winRate = Number(profile.win_rate ?? 0);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <Trophy className="h-4 w-4" />
        Gaming profile
      </h3>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Row label="Level" value={profile.current_level} />
        <Row label="XP" value={profile.total_xp.toLocaleString()} />
        <Row label="Games" value={profile.games_played} />
        <Row label="Wins" value={profile.wins} />
        <Row label="Losses" value={profile.losses} />
        <Row label="Draws" value={profile.draws} />
        <Row
          label="Win rate"
          value={`${Number.isFinite(winRate) ? winRate : 0}%`}
        />
        <Row
          label="Streak"
          value={profile.current_streak}
          icon={<Flame className="h-3 w-3 text-orange-400" />}
        />
        <Row label="Best streak" value={profile.longest_streak} />
      </div>

      <p className="text-[11px] text-muted-foreground">
        X Coin balance is private and is not shown on other profiles.
      </p>
    </section>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-muted/30 px-3 py-2">
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default PublicGamingStats;
