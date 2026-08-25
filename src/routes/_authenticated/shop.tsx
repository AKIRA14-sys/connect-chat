import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Flame,
  Gamepad2,
  Package,
  RefreshCw,
  Search,
  Send,
  Star,
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
        content: "X Coin wallet, shop, transfers, inventory and history.",
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

function ShopPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("shop");
  const [wallet, setWallet] = useState<GamingWalletData>(EMPTY_WALLET);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
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

      if (invRes?.inventory) setInventory(invRes.inventory);
      if (txRes?.transactions) setTransactions(txRes.transactions);
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
      setSearching(false);
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

      return (
        item.name.toLowerCase().includes(term) ||
        (item.description ?? "").toLowerCase().includes(term)
      );
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
      console.error("Shop purchase failed:", err);
      toast.error(
        err instanceof Error ? err.message : "Purchase failed",
      );
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
      toast.error(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransferring(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "wallet", label: "Wallet" },
    { id: "shop", label: "Shop" },
    { id: "transfer", label: "Transfer" },
    { id: "inventory", label: "Inventory" },
    { id: "history", label: "History" },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Shop"
        subtitle="X Coins, items & transfers"
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
        {/* X COIN BALANCE — deliberately unchanged/yellow */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <XCoinIcon size={36} className="text-yellow-400" />

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
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
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
            {/* Shop search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 rounded-2xl border-border bg-card pl-9"
                placeholder="Search anime, gaming, movies, cars, stickers…"
                value={shopSearch}
                onChange={(e) => setShopSearch(e.target.value)}
              />
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <FilterChip
                active={categoryFilter === "all"}
                onClick={() => setCategoryFilter("all")}
                label="All"
              />

              {categories.map((c) => (
                <FilterChip
                  key={c.category_id}
                  active={categoryFilter === c.category_id}
                  onClick={() => setCategoryFilter(c.category_id)}
                  label={c.name}
                />
              ))}
            </div>

            {loading && (
              <p className="text-sm text-muted-foreground">
                Loading shop…
              </p>
            )}

            {!loading && filteredItems.length === 0 && (
              <div className="rounded-3xl border border-border bg-card p-8 text-center">
                <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 font-semibold">Nothing found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try another search or category.
                </p>
              </div>
            )}

            {/* Large visual product cards */}
            {!loading && filteredItems.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filteredItems.map((item) => {
                  const owned =
                    item.unique_ownership &&
                    ownedItemIds.has(item.item_id);

                  const purchasing = busyItemId === item.item_id;
                  const cannotAfford =
                    coins < item.price_x_coins;

                  const meta =
                    item.metadata &&
                    typeof item.metadata === "object"
                      ? (item.metadata as Record<string, unknown>)
                      : {};

                  const imageUrl =
                    typeof meta.image_url === "string" &&
                    /^https?:\/\//i.test(meta.image_url)
                      ? meta.image_url
                      : typeof meta.preview_url === "string" &&
                          /^https?:\/\//i.test(meta.preview_url)
                        ? meta.preview_url
                        : null;

                  const rawCategory =
                    typeof meta.category === "string"
                      ? meta.category
                      : "Shop";

                  const categoryText =
                    rawCategory.replace(/^X\s+/i, "") || "Shop";

                  const typeText =
                    typeof meta.type === "string"
                      ? meta.type
                      : "collectible";

                  const lower = `${categoryText} ${typeText} ${item.name}`.toLowerCase();

                  let PreviewIcon = Sparkles;

                  if (lower.includes("gaming") || lower.includes("game")) {
                    PreviewIcon = Gamepad2;
                  } else if (
                    lower.includes("movie") ||
                    lower.includes("film") ||
                    lower.includes("action")
                  ) {
                    PreviewIcon = Film;
                  } else if (lower.includes("car") || lower.includes("auto")) {
                    PreviewIcon = Car;
                  } else if (
                    lower.includes("sticker") ||
                    lower.includes("funny") ||
                    lower.includes("reaction")
                  ) {
                    PreviewIcon = Smile;
                  } else if (
                    lower.includes("bubble") ||
                    lower.includes("chat")
                  ) {
                    PreviewIcon = MessageCircle;
                  } else if (
                    lower.includes("badge") ||
                    lower.includes("level")
                  ) {
                    PreviewIcon = BadgeCheck;
                  } else if (
                    lower.includes("theme") ||
                    lower.includes("color") ||
                    lower.includes("cosmetic") ||
                    lower.includes("frame")
                  ) {
                    PreviewIcon = Palette;
                  } else if (
                    lower.includes("wallpaper") ||
                    lower.includes("image")
                  ) {
                    PreviewIcon = ImageIcon;
                  } else if (lower.includes("anime")) {
                    PreviewIcon = Sparkles;
                  } else if (lower.includes("trophy")) {
                    PreviewIcon = Trophy;
                  }

                  return (
                    <article
                      key={item.item_id}
                      className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
                    >
                      {/* Big visual preview.
                          If Supabase metadata eventually contains image_url
                          or preview_url, the real image is displayed here.
                          Otherwise this remains a polished built-in poster
                          instead of a tiny emoji/icon. */}
                      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-primary/20 via-card to-muted">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center px-5 text-center">
                            <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-background/40 shadow-lg backdrop-blur">
                              <PreviewIcon className="h-10 w-10 text-primary" />
                            </div>

                            <p className="text-lg font-black tracking-tight">
                              {item.name}
                            </p>

                            <p className="mt-1 max-w-[90%] text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                              {categoryText}
                            </p>
                          </div>
                        )}

                        <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
                          {categoryText}
                        </div>
                      </div>

                      <div className="space-y-3 p-4">
                        <div>
                          <h3 className="font-bold">{item.name}</h3>

                          {item.description && (
                            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5 text-sm font-black text-yellow-500">
                            <XCoinIcon
                              size={18}
                              className="text-yellow-400"
                            />
                            {item.price_x_coins.toLocaleString()} X Coins
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            className="bg-green-600 font-bold text-white shadow-sm hover:bg-green-700 active:bg-green-800 disabled:bg-green-600/40 disabled:text-white/70"
                            disabled={
                              purchasing ||
                              owned ||
                              cannotAfford
                            }
                            onClick={() => void onPurchase(item)}
                          >
                            {owned
                              ? "Owned"
                              : purchasing
                                ? "Buying…"
                                : cannotAfford
                                  ? "Need X Coins"
                                  : "Buy"}
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
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
                    {searchResults.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setRecipient({
                              id: p.id,
                              username: p.username,
                              display_name: p.display_name,
                            });

                            setSearchTerm(p.username ?? "");
                            setSearchResults([]);
                          }}
                        >
                          <UserAvatar
                            path={p.avatar_url ?? null}
                            name={
                              p.display_name ??
                              p.username ??
                              "?"
                            }
                            size="sm"
                          />

                          <span>
                            {p.display_name ?? p.username}

                            {p.username ? (
                              <span className="text-muted-foreground">
                                {" "}
                                @{p.username}
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
                className="w-full bg-green-600 text-white hover:bg-green-700"
                disabled={!recipient || transferring || !amount}
                onClick={() => void onTransfer()}
              >
                {transferring ? "Sending…" : "Send X Coins"}
              </Button>

              <p className="text-xs text-muted-foreground">
                Transfers use the secure Gaming Supabase RPC. Balances
                are never changed in the browser.
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
              <p className="text-sm text-muted-foreground">
                Loading…
              </p>
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
                  {row.quantity > 1
                    ? `×${row.quantity}`
                    : ""}
                </p>

                {row.item_description && (
                  <p className="text-xs text-muted-foreground">
                    {row.item_description}
                  </p>
                )}

                {row.equipped && (
                  <p className="mt-1 text-xs text-primary">
                    Equipped
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-2">
            <h2 className="font-semibold">
              Coin transactions
            </h2>

            {loading && (
              <p className="text-sm text-muted-foreground">
                Loading…
              </p>
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
                      ? ` · ${new Date(
                          tx.created_at,
                        ).toLocaleString()}`
                      : ""}
                  </p>
                </div>

                <p
                  className={`shrink-0 text-sm font-bold tabular-nums ${
                    tx.amount >= 0
                      ? "text-green-500"
                      : "text-red-400"
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

function ShoppingBagIcon({
  small = false,
}: {
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-lg bg-muted text-muted-foreground ${
        small ? "h-7 w-7" : "h-10 w-10"
      }`}
    >
      <span className={small ? "text-sm" : "text-lg"}>
        🛍️
      </span>
    </span>
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
