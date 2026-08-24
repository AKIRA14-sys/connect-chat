import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Flame,
  Gamepad2,
  RefreshCw,
  ShoppingBag,
  Star,
  Trophy,
} from "lucide-react";

import { AppShell, PageHeader } from "@/components/AppShell";
import { XCoinIcon } from "@/components/gaming/XCoinIcon";
import { Button } from "@/components/ui/button";
import {
  getGamingRewardHistory,
  getGamingWallet,
  type GamingRewardHistoryItem,
  type GamingWalletData,
} from "@/lib/gaming.functions";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({
    meta: [
      { title: "Shop — XUPS" },
      {
        name: "description",
        content: "Your X Coin wallet, gaming stats, and the XUPS shop.",
      },
      { property: "og:title", content: "Shop — XUPS" },
      {
        property: "og:description",
        content: "View your X Coins, stats, and upcoming shop items.",
      },
    ],
  }),
  component: ShopPage,
});

const EMPTY_WALLET: GamingWalletData = {
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

function ShopPage() {
  const [wallet, setWallet] = useState<GamingWalletData>(EMPTY_WALLET);
  const [rewards, setRewards] = useState<GamingRewardHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [walletRes, historyRes] = await Promise.all([
        getGamingWallet({}),
        getGamingRewardHistory({ data: { limit: 20 } }),
      ]);

      if (walletRes?.wallet) {
        setWallet(walletRes.wallet as GamingWalletData);
      }

      if (historyRes?.items) {
        setRewards(historyRes.items as GamingRewardHistoryItem[]);
      }
    } catch (err) {
      console.error("Failed to load shop data:", err);
      setError("Unable to load your wallet right now. Try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const coins = Number(wallet.x_coins ?? 0);
  const xp = Number(wallet.total_xp ?? 0);
  const level = Number(wallet.level ?? 1);
  const games = Number(wallet.games_played ?? 0);
  const wins = Number(wallet.wins ?? 0);
  const losses = Number(wallet.losses ?? 0);
  const draws = Number(wallet.draws ?? 0);
  const currentStreak = Number(wallet.current_streak ?? 0);
  const longestStreak = Number(wallet.longest_streak ?? 0);

  const decided = wins + losses + draws;
  const winRate =
    decided > 0 ? Math.round((wins / decided) * 1000) / 10 : 0;

  const xpForNextLevel = Math.max(level * 500, 500);
  const xpProgress = Math.min(
    100,
    Math.round(((xp % xpForNextLevel) / xpForNextLevel) * 100),
  );

  return (
    <AppShell>
      <PageHeader
        title="Shop"
        subtitle="X Coins, stats & rewards"
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void load(true)}
            disabled={loading || refreshing}
            aria-label="Refresh wallet"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
        }
      />

      <div className="space-y-5 p-4 pb-8">
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Wallet */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            X Coin Wallet
          </p>
          <div className="mt-3 flex items-center gap-3">
            <XCoinIcon size={48} className="text-yellow-400" />
            <div>
              <p className="text-3xl font-black tabular-nums">
                {loading ? "—" : coins.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">X Coins</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Balance is loaded securely from Gaming Supabase. It is not stored
            only in this browser.
          </p>
        </section>

        {/* Level / XP */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current level</p>
                <p className="text-xl font-bold">
                  {loading ? "—" : `Level ${level}`}
                </p>
              </div>
            </div>
            <p className="text-sm font-semibold tabular-nums">
              {loading ? "—" : `${xp.toLocaleString()} XP`}
            </p>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>Progress to next level</span>
              <span>{loading ? "—" : `${xpProgress}%`}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: loading ? "0%" : `${xpProgress}%` }}
              />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Gamepad2 className="h-5 w-5" />
            <h2 className="font-semibold">Gaming statistics</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Games played"
              value={loading ? "—" : games}
              icon={<Gamepad2 className="h-4 w-4" />}
            />
            <StatCard
              label="Wins"
              value={loading ? "—" : wins}
              icon={<Trophy className="h-4 w-4" />}
            />
            <StatCard
              label="Losses"
              value={loading ? "—" : losses}
              icon={<span className="text-xs font-bold">L</span>}
            />
            <StatCard
              label="Draws"
              value={loading ? "—" : draws}
              icon={<span className="text-xs font-bold">D</span>}
            />
            <StatCard
              label="Win rate"
              value={loading ? "—" : `${winRate}%`}
              icon={<Star className="h-4 w-4" />}
            />
            <StatCard
              label="Current streak"
              value={loading ? "—" : currentStreak}
              icon={<Flame className="h-4 w-4" />}
            />
            <StatCard
              label="Longest streak"
              value={loading ? "—" : longestStreak}
              icon={<Flame className="h-4 w-4" />}
            />
            <StatCard
              label="Level"
              value={loading ? "—" : level}
              icon={<Trophy className="h-4 w-4" />}
            />
          </div>
        </section>

        {/* Shop placeholder — no fake purchases */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            <h2 className="font-semibold">Shop items</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Cosmetics, themes, and badges will appear here. Purchases are not
            enabled yet — nothing will charge X Coins until the secure shop
            backend is ready.
          </p>
        </section>

        {/* Transfer placeholder */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Transfer X Coins</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Secure peer-to-peer transfers will be enabled after the Gaming
            Supabase transfer RPC is installed. The browser will never update
            balances directly.
          </p>
        </section>

        {/* Reward history */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">Recent rewards</h2>
          {loading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {!loading && rewards.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No rewards yet. Win a game to earn X Coins and XP.
            </p>
          )}
          {!loading && rewards.length > 0 && (
            <ul className="space-y-2">
              {rewards.map((row) => (
                <li
                  key={`${row.match_id}-${row.created_at ?? ""}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {row.reward_type ?? "Game reward"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm font-semibold">
                    <p className="flex items-center justify-end gap-1 text-yellow-500">
                      <XCoinIcon size={14} className="text-yellow-500" />+
                      {row.x_coins}
                    </p>
                    <p className="text-xs text-muted-foreground">+{row.xp} XP</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="mt-1.5 text-lg font-bold tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
