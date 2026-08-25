import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Flame,
  Gamepad2,
  History,
  Image as ImageIcon,
  Package,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Star,
  Trophy,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/AppShell";
import { XCoinIcon } from "@/components/gaming/XCoinIcon";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  getCoinTransactions,
  getGamingWallet,
  getShopCatalog,
  getUserInventory,
  purchaseShopItem,
  transferXCoins,
  type CoinTransaction,
  type GamingWalletData,
  type InventoryItem,
  type ShopCategory,
  type ShopItem,
} from "@/lib/gaming.functions";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({
    meta: [
      { title: "Shop — XUPS" },
      {
        name: "description",
        content: "X Coins, cosmetics, anime, games, movies, cars, stickers and more.",
      },
    ],
  }),
  component: ShopPage,
});

type Tab = "wallet" | "shop" | "transfer" | "inventory" | "history";

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

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `xfer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getMetadataString(metadata: unknown, keys: string[]): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = metadata as Record<string, unknown>;

  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function getItemImage(item: ShopItem): string | null {
  return getMetadataString(item.metadata, [
    "image_url",
    "imageUrl",
    "image",
    "preview_url",
    "previewUrl",
    "hero_url",
    "heroUrl",
    "thumbnail_url",
    "thumbnailUrl",
    "cover_url",
    "coverUrl",
  ]);
}

function getItemBadge(item: ShopItem): string | null {
  return getMetadataString(item.metadata, [
    "badge",
    "tag",
    "label",
  ]);
}

function getItemTheme(item: ShopItem): string {
  const key = `${item.item_key ?? ""} ${item.name} ${item.description ?? ""}`.toLowerCase();

  if (key.includes("anime") || key.includes("zenitsu") || key.includes("naruto")) {
    return "from-purple-950 via-indigo-900 to-blue-950";
  }
  if (key.includes("game") || key.includes("gaming") || key.includes("xbox") || key.includes("playstation")) {
    return "from-emerald-950 via-green-900 to-slate-950";
  }
  if (key.includes("movie") || key.includes("spider") || key.includes("marvel")) {
    return "from-red-950 via-rose-900 to-slate-950";
  }
  if (key.includes("car") || key.includes("bmw") || key.includes("lamborghini")) {
    return "from-cyan-950 via-slate-900 to-blue-950";
  }
  if (key.includes("sticker")) {
    return "from-yellow-950 via-orange-900 to-pink-950";
  }
  if (key.includes("gif")) {
    return "from-fuchsia-950 via-purple-900 to-indigo-950";
  }
  if (key.includes("bubble")) {
    return "from-sky-950 via-blue-900 to-indigo-950";
  }
  if (key.includes("theme") || key.includes("cosmetic")) {
    return "from-pink-950 via-violet-900 to-purple-950";
  }

  return "from-slate-950 via-slate-900 to-zinc-900";
}

function getCategoryIcon(categoryName: string) {
  const name = categoryName.toLowerCase();

  if (name.includes("anime")) return Sparkles;
  if (name.includes("game")) return Gamepad2;
  if (name.includes("movie")) return Trophy;
  if (name.includes("car")) return Sparkles;
  if (name.includes("sticker")) return Star;
  if (name.includes("gif")) return ImageIcon;
  if (name.includes("bubble")) return Send;
  if (name.includes("theme")) return Sparkles;
  if (name.includes("cosmetic")) return Star;
  if (name.includes("badge")) return Trophy;

  return ShoppingBag;
}

function ShopItemPreview({ item }: { item: ShopItem }) {
  const image = getItemImage(item);
  const badge = getItemBadge(item);
  const Icon = getCategoryIcon(item.name);

  return (
    <div
      className={`relative h-40 overflow-hidden rounded-xl bg-gradient-to-br ${getItemTheme(item)}`}
    >
      {image ? (
        <img
          src={image}
          alt={item.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/80">
          <Icon className="h-12 w-12" />
          <span className="px-4 text-center text-xs font-semibold">
            {item.name}
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

      {badge && (
        <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
          {badge}
        </span>
      )}

      <div className="absolute bottom-2 left-2 right-2">
        <p className="truncate text-sm font-bold text-white drop-shadow">
          {item.name}
        </p>
      </div>
    </div>
  );
}

function ShopPage() {
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("wallet");
  const [wallet, setWallet] = useState<GamingWalletData>(EMPTY_WALLET);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [shopSearch, setShopSearch] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<
    {
      id: string;
      username?: string | null;
      display_name?: string | null;
      avatar_url?: string | null;
    }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<{
    id: string;
    username?: string | null;
    display_name?: string | null;
  } | null>(null);
  const [amount, setAmount] = useState("");
  const [transferring, setTransferring] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      setError(null);
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [walletRes, catalogRes, invRes, txRes] = await Promise.all([
        getGamingWallet(),
        getShopCatalog(),
        getUserInventory(),
        getCoinTransactions(),
      ]);

      if (walletRes?.wallet) {
        const data = walletRes.wallet;

        setWallet({
          user_id: String(data.user_id ?? ""),
          x_coins: safeNumber(data.x_coins),
          total_xp: safeNumber(data.total_xp),
          level: safeNumber(data.level) || 1,
          games_played: safeNumber(data.games_played),
          wins: safeNumber(data.wins),
          losses: safeNumber(data.losses),
          draws: safeNumber(data.draws),
          current_streak: safeNumber(data.current_streak),
          longest_streak: safeNumber(data.longest_streak),
          bot_games: safeNumber(data.bot_games),
          real_user_games: safeNumber(data.real_user_games),
        });
      }

      if (catalogRes) {
        setCategories(catalogRes.categories ?? []);
        setItems(catalogRes.items ?? []);
      }

      if (invRes?.inventory) {
        setInventory(invRes.inventory);
      }

      if (txRes?.transactions) {
        setTransactions(txRes.transactions);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to load shop data. Try refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();

    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);

    void (async () => {
      const { data, error: qErr } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, discoverable")
        .eq("discoverable", true)
        .neq("id", user?.id ?? "")
        .ilike("username", `${term}%`)
        .limit(15);

      if (cancelled) return;

      setSearching(false);

      if (qErr) {
        console.error(qErr);
        return;
      }

      setSearchResults((data ?? []) as typeof searchResults);
    })();

    return () => {
      cancelled = true;
    };
  }, [searchTerm, user?.id]);

  const ownedItemIds = useMemo(
    () => new Set(inventory.map((i) => i.item_id)),
    [inventory],
  );

  const filteredItems = useMemo(() => {
    const term = shopSearch.trim().toLowerCase();

    return items.filter((item) => {
      const categoryMatch =
        categoryFilter === "all" || item.category_id === categoryFilter;

      if (!categoryMatch) return false;
      if (!term) return true;

      return `${item.name} ${item.description ?? ""} ${item.item_key ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [items, categoryFilter, shopSearch]);

  const coins = wallet.x_coins;
  const decided = wallet.wins + wallet.losses + wallet.draws;
  const winRate =
    decided > 0 ? Math.round((wallet.wins / decided) * 1000) / 10 : 0;

  async function onPurchase(item: ShopItem) {
    if (busyItemId) return;

    if (item.unique_ownership && ownedItemIds.has(item.item_id)) {
      toast.error("You already own this item");
      return;
    }

    if (coins < item.price_x_coins) {
      toast.error("Not enough X Coins");
      return;
    }

    setBusyItemId(item.item_id);

    try {
      await purchaseShopItem({
        data: {
          itemId: item.item_id,
          quantity: 1,
        },
      });

      toast.success(`Purchased ${item.name}`);
      await load(true);
    } catch (err) {
      toast.error((err as Error).message || "Purchase failed");
    } finally {
      setBusyItemId(null);
    }
  }

  async function onTransfer() {
    if (!recipient || transferring) return;

    const amt = Math.floor(Number(amount));

    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a positive whole number");
      return;
    }

    if (amt > coins) {
      toast.error("Not enough X Coins");
      return;
    }

    if (recipient.id === user?.id) {
      toast.error("You cannot transfer to yourself");
      return;
    }

    const ok = window.confirm(
      `Send ${amt.toLocaleString()} X Coins to @${recipient.username ?? "user"}?`,
    );

    if (!ok) return;

    setTransferring(true);

    try {
      await transferXCoins({
        data: {
          recipientId: recipient.id,
          amount: amt,
          idempotencyKey: newIdempotencyKey(),
        },
      });

      toast.success("Transfer sent");
      setAmount("");
      setRecipient(null);
      setSearchTerm("");
      await load(true);
    } catch (err) {
      toast.error((err as Error).message || "Transfer failed");
    } finally {
      setTransferring(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof ShoppingBag }[] = [
    { id: "wallet", label: "Wallet", icon: XCoinIcon as never },
    { id: "shop", label: "Shop", icon: ShoppingBag },
    { id: "transfer", label: "Transfer", icon: Send },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "history", label: "History", icon: History },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Shop"
        subtitle="X Coins, cosmetics, anime, games, movies, cars & more"
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void load(true)}
            disabled={loading || refreshing}
            aria-label="Refresh"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
        }
      />

      <div className="space-y-4 p-4 pb-8">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <XCoinIcon size={38} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Your balance</p>
            <p className="text-2xl font-black tabular-nums">
              {loading ? "—" : coins.toLocaleString()}{" "}
              <span className="text-sm font-semibold text-muted-foreground">
                X Coins
              </span>
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto pb-1">
          {tabs.map((t) => {
            const Icon = t.icon;

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "wallet" && (
          <div className="space-y-4">
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Star className="h-4 w-4" />
                <h2 className="font-semibold">Level & XP</h2>
              </div>

              <p className="text-lg font-bold">
                Level {loading ? "—" : wallet.level}
              </p>

              <p className="text-sm text-muted-foreground">
                {loading ? "—" : `${wallet.total_xp.toLocaleString()} XP`}
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Gamepad2 className="h-4 w-4" />
                <h2 className="font-semibold">Your stats</h2>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Stat label="Games" value={wallet.games_played} loading={loading} />
                <Stat label="Wins" value={wallet.wins} loading={loading} />
                <Stat label="Losses" value={wallet.losses} loading={loading} />
                <Stat label="Draws" value={wallet.draws} loading={loading} />
                <Stat label="Win rate" value={`${winRate}%`} loading={loading} />
                <Stat
                  label="Streak"
                  value={wallet.current_streak}
                  loading={loading}
                  icon={<Flame className="h-3 w-3" />}
                />
                <Stat
                  label="Best streak"
                  value={wallet.longest_streak}
                  loading={loading}
                />
                <Stat
                  label="Bot games"
                  value={wallet.bot_games}
                  loading={loading}
                />
              </div>
            </section>
          </div>
        )}

        {tab === "shop" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search anime, games, movies, cars, stickers..."
                value={shopSearch}
                onChange={(e) => setShopSearch(e.target.value)}
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1">
              <FilterChip
                active={categoryFilter === "all"}
                onClick={() => setCategoryFilter("all")}
                label="All"
              />

              {categories.map((category) => {
                const Icon = getCategoryIcon(category.name);

                return (
                  <button
                    key={category.category_id}
                    type="button"
                    onClick={() => setCategoryFilter(category.category_id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      categoryFilter === category.category_id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {category.name}
                  </button>
                );
              })}
            </div>

            {loading && (
              <p className="text-sm text-muted-foreground">
                Loading shop items…
              </p>
            )}

            {!loading && filteredItems.length === 0 && (
              <div className="rounded-2xl border border-border bg-card p-6 text-center">
                <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="font-semibold">No items found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try another category or search.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {filteredItems.map((item) => {
                const owned =
                  item.unique_ownership && ownedItemIds.has(item.item_id);

                return (
                  <article
                    key={item.item_id}
                    className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                  >
                    <ShopItemPreview item={item} />

                    <div className="space-y-3 p-3">
                      <div className="min-h-12">
                        <h3 className="line-clamp-2 text-sm font-bold">
                          {item.name}
                        </h3>

                        {item.description && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1 text-sm font-black text-yellow-500">
                          <XCoinIcon size={17} />
                          <span className="truncate">
                            {item.price_x_coins.toLocaleString()}
                          </span>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          className="shrink-0"
                          disabled={
                            !!busyItemId ||
                            owned ||
                            coins < item.price_x_coins
                          }
                          onClick={() => void onPurchase(item)}
                        >
                          {owned
                            ? "Owned"
                            : busyItemId === item.item_id
                              ? "Buying…"
                              : "Buy"}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {tab === "transfer" && (
          <div className="space-y-4">
            <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                <h2 className="font-semibold">Send X Coins</h2>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Find user by username
                </label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    className="pl-9"
                    placeholder="username"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setRecipient(null);
                    }}
                  />
                </div>

                {searching && (
                  <p className="text-xs text-muted-foreground">
                    Searching…
                  </p>
                )}

                {searchResults.length > 0 && !recipient && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-border">
                    {searchResults.map((profile) => (
                      <li key={profile.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setRecipient({
                              id: profile.id,
                              username: profile.username,
                              display_name: profile.display_name,
                            });

                            setSearchTerm(profile.username ?? "");
                            setSearchResults([]);
                          }}
                        >
                          <UserAvatar
                            path={profile.avatar_url ?? null}
                            name={
                              profile.display_name ??
                              profile.username ??
                              "?"
                            }
                            size="sm"
                          />

                          <span>
                            {profile.display_name ?? profile.username}

                            {profile.username ? (
                              <span className="text-muted-foreground">
                                {" "}
                                @{profile.username}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {recipient && (
                <p className="text-sm">
                  To:{" "}
                  <span className="font-semibold">
                    @{recipient.username ?? recipient.id.slice(0, 8)}
                  </span>
                </p>
              )}

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Amount
                </label>

                <Input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  placeholder="100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <Button
                type="button"
                className="w-full"
                disabled={!recipient || transferring || !amount}
                onClick={() => void onTransfer()}
              >
                {transferring ? "Sending…" : "Send X Coins"}
              </Button>

              <p className="text-xs text-muted-foreground">
                Transfers use the secure Gaming Supabase RPC. Balances are
                never changed in the browser.
              </p>
            </section>
          </div>
        )}

        {tab === "inventory" && (
          <div className="space-y-2">
            <div className="mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" />
              <h2 className="font-semibold">Your inventory</h2>
            </div>

            {loading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}

            {!loading && inventory.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No items yet. Buy something from the Shop tab.
              </p>
            )}

            {inventory.map((row) => (
              <div
                key={row.inventory_id}
                className="rounded-xl border border-border bg-card px-4 py-3"
              >
                <p className="font-medium">
                  {row.item_name ?? "Item"}{" "}
                  {row.quantity > 1 ? `×${row.quantity}` : ""}
                </p>

                {row.item_description && (
                  <p className="text-xs text-muted-foreground">
                    {row.item_description}
                  </p>
                )}

                {row.equipped && (
                  <p className="mt-1 text-xs text-primary">Equipped</p>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-2">
            <h2 className="font-semibold">Coin transactions</h2>

            {loading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}

            {!loading && transactions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No transactions yet.
              </p>
            )}

            {transactions.map((tx) => (
              <div
                key={tx.transaction_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {tx.transaction_type ?? "Transaction"}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {tx.reason ?? "—"}
                    {tx.created_at
                      ? ` · ${new Date(tx.created_at).toLocaleString()}`
                      : ""}
                  </p>
                </div>

                <p
                  className={`shrink-0 text-sm font-bold tabular-nums ${
                    tx.amount >= 0 ? "text-green-500" : "text-red-400"
                  }`}
                >
                  {tx.amount >= 0 ? "+" : ""}
                  {tx.amount.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  loading,
  icon,
}: {
  label: string;
  value: string | number;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>

      <p className="mt-1 text-lg font-bold tabular-nums">
        {loading
          ? "—"
          : typeof value === "number"
            ? value.toLocaleString()
            : value}
      </p>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}
