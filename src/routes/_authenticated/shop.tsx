import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  Car,
  Check,
  ChevronRight,
  Film,
  Flame,
  Gamepad2,
  Gift,
  Image as ImageIcon,
  MessageCircle,
  Package,
  Palette,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Star,
  Sticker,
  Trophy,
  User,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { CollectiblesPanel } from "@/components/gifts/CollectiblesPanel";

import { AppShell, PageHeader } from "@/components/AppShell";
import { XCoinIcon } from "@/components/gaming/XCoinIcon";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  equipShopItem,
  getCoinTransactions,
  getGamingWallet,
  getShopCatalog,
  getUserInventory,
  purchaseShopItem,
  transferXCoins,
  unequipShopItem,
  type CoinTransaction,
  type GamingWalletData,
  type InventoryItem,
  type ShopCategory,
  type ShopItem,
} from "@/lib/gaming.functions";
import {
  removeEquippedShopCosmeticLocal,
  saveEquippedShopCosmeticLocal,
} from "@/lib/shopCosmetics.local";

export const Route = createFileRoute("/_authenticated/shop")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => {
    const tab = typeof search.tab === "string" ? search.tab : undefined;
    return { tab };
  },
  head: () => ({
    meta: [
      { title: "Shop" },
      {
        name: "description",
        content:
          "Shop for anime, gaming, movies, cars, wallpapers, stickers, GIFs, chat cosmetics and more.",
      },
    ],
  }),
  component: ShopPage,
});

type Tab =
  | "wallet"
  | "shop"
  | "transfer"
  | "inventory"
  | "collectibles"
  | "history";

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
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return crypto.randomUUID();
  }

  return `xfer-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

/**
 * Reads possible image fields from shop item metadata.
 *
 * This is intentionally flexible because existing shop rows may
 * have metadata stored with different property names.
 */
function getItemImage(item: ShopItem): string | null {
  const metadata = item.metadata;

  if (!metadata) {
    return null;
  }

  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata) as unknown;

      if (
        parsed &&
        typeof parsed === "object"
      ) {
        const obj = parsed as Record<string, unknown>;

        const candidates = [
          obj.image_url,
          obj.imageUrl,
          obj.preview_url,
          obj.previewUrl,
          obj.hero_url,
          obj.heroUrl,
          obj.thumbnail_url,
          obj.thumbnailUrl,
          obj.cover_url,
          obj.coverUrl,
        ];

        const found = candidates.find(
          (value) =>
            typeof value === "string" &&
            value.trim().length > 0,
        );

        return typeof found === "string"
          ? found
          : null;
      }
    } catch {
      return null;
    }

    return null;
  }

  if (
    typeof metadata === "object" &&
    metadata !== null
  ) {
    const obj =
      metadata as Record<string, unknown>;

    const candidates = [
      obj.image_url,
      obj.imageUrl,
      obj.preview_url,
      obj.previewUrl,
      obj.hero_url,
      obj.heroUrl,
      obj.thumbnail_url,
      obj.thumbnailUrl,
      obj.cover_url,
      obj.coverUrl,
    ];

    const found = candidates.find(
      (value) =>
        typeof value === "string" &&
        value.trim().length > 0,
    );

    return typeof found === "string"
      ? found
      : null;
  }

  return null;
}

function getCategoryKey(
  category?: ShopCategory,
): string {
  return `${category?.name ?? ""}`.toLowerCase();
}

function getCategoryIcon(
  categoryName: string,
) {
  const name = categoryName.toLowerCase();

  if (
    name.includes("anime") ||
    name.includes("manga")
  ) {
    return Sparkles;
  }

  if (
    name.includes("gaming") ||
    name.includes("game")
  ) {
    return Gamepad2;
  }

  if (
    name.includes("movie") ||
    name.includes("film")
  ) {
    return Film;
  }

  if (name.includes("car")) {
    return Car;
  }

  if (
    name.includes("sticker") ||
    name.includes("emoji")
  ) {
    return Sticker;
  }

  if (name.includes("gif")) {
    return Gift;
  }

  if (
    name.includes("chat bubble") ||
    name.includes("bubble")
  ) {
    return MessageCircle;
  }

  if (
    name.includes("chat theme") ||
    name.includes("theme")
  ) {
    return Palette;
  }

  if (
    name.includes("profile") ||
    name.includes("avatar")
  ) {
    return User;
  }

  if (
    name.includes("badge") ||
    name.includes("level")
  ) {
    return BadgeCheck;
  }

  if (
    name.includes("wallpaper") ||
    name.includes("background")
  ) {
    return ImageIcon;
  }

  if (
    name.includes("cosmetic")
  ) {
    return Sparkles;
  }

  return ShoppingBag;
}

function getCategoryAccent(
  categoryName: string,
): string {
  const name = categoryName.toLowerCase();

  if (name.includes("anime")) {
    return "from-purple-500/20 via-pink-500/10 to-transparent";
  }

  if (
    name.includes("gaming") ||
    name.includes("game")
  ) {
    return "from-green-500/20 via-emerald-500/10 to-transparent";
  }

  if (
    name.includes("movie") ||
    name.includes("film")
  ) {
    return "from-red-500/20 via-orange-500/10 to-transparent";
  }

  if (name.includes("car")) {
    return "from-blue-500/20 via-cyan-500/10 to-transparent";
  }

  if (name.includes("sticker")) {
    return "from-yellow-500/20 via-orange-500/10 to-transparent";
  }

  if (name.includes("gif")) {
    return "from-pink-500/20 via-purple-500/10 to-transparent";
  }

  if (name.includes("bubble")) {
    return "from-cyan-500/20 via-blue-500/10 to-transparent";
  }

  if (name.includes("theme")) {
    return "from-indigo-500/20 via-purple-500/10 to-transparent";
  }

  if (name.includes("profile")) {
    return "from-green-500/20 via-teal-500/10 to-transparent";
  }

  if (
    name.includes("badge") ||
    name.includes("level")
  ) {
    return "from-amber-500/20 via-yellow-500/10 to-transparent";
  }

  if (
    name.includes("wallpaper") ||
    name.includes("background")
  ) {
    return "from-sky-500/20 via-blue-500/10 to-transparent";
  }

  return "from-primary/20 via-primary/5 to-transparent";
}

function getCategoryDescription(
  categoryName: string,
): string {
  const name = categoryName.toLowerCase();

  if (name.includes("anime")) {
    return "Anime-inspired cosmetics, characters and wallpapers.";
  }

  if (
    name.includes("gaming") ||
    name.includes("game")
  ) {
    return "Gaming cosmetics, effects, badges and gamer items.";
  }

  if (
    name.includes("movie") ||
    name.includes("film")
  ) {
    return "Movie and action-inspired cosmetics.";
  }

  if (name.includes("car")) {
    return "Car-inspired themes and profile cosmetics.";
  }

  if (name.includes("sticker")) {
    return "Sticker packs for your conversations.";
  }

  if (name.includes("gif")) {
    return "Fun GIFs and reaction packs.";
  }

  if (name.includes("bubble")) {
    return "Chat bubbles inspired by your favorite themes.";
  }

  if (name.includes("theme")) {
    return "Customize the look of your conversations.";
  }

  if (name.includes("profile")) {
    return "Cosmetics for your profile and identity.";
  }

  if (
    name.includes("badge") ||
    name.includes("level")
  ) {
    return "Show-off badges for your profile.";
  }

  if (
    name.includes("wallpaper") ||
    name.includes("background")
  ) {
    return "Wallpapers and backgrounds for your app.";
  }

  return "Special items available in the Shop.";
}

function getCategoryLabel(
  categoryName: string,
): string {
  const lower = categoryName.toLowerCase();

  if (
    lower.includes("chat") &&
    lower.includes("bubble")
  ) {
    return "Chat Bubbles";
  }

  if (
    lower.includes("chat") &&
    lower.includes("theme")
  ) {
    return "Chat Themes";
  }

  if (
    lower.includes("profile") &&
    lower.includes("cosmetic")
  ) {
    return "Profile Cosmetics";
  }

  if (
    lower.includes("chat") &&
    lower.includes("cosmetic")
  ) {
    return "Chat Cosmetics";
  }

  return categoryName;
}

function ShopPage() {
  const { user } = useAuth();

  const search = Route.useSearch();
  const initialTab: Tab =
    search.tab === "collectibles" ||
    search.tab === "inventory" ||
    search.tab === "wallet" ||
    search.tab === "transfer" ||
    search.tab === "history" ||
    search.tab === "shop"
      ? (search.tab as Tab)
      : "shop";

  const [tab, setTab] =
    useState<Tab>(initialTab);

  const [wallet, setWallet] =
    useState<GamingWalletData>(
      EMPTY_WALLET,
    );

  const [categories, setCategories] =
    useState<ShopCategory[]>([]);

  const [items, setItems] =
    useState<ShopItem[]>([]);

  const [inventory, setInventory] =
    useState<InventoryItem[]>([]);

  const [transactions, setTransactions] =
    useState<CoinTransaction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [busyItemId, setBusyItemId] =
    useState<string | null>(null);

  const [equipBusyId, setEquipBusyId] =
    useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] =
    useState<string>("all");

  const [search, setSearch] =
    useState("");

  const [selectedItem, setSelectedItem] =
    useState<ShopItem | null>(null);

  // Transfer state
  const [searchTerm, setSearchTerm] =
    useState("");

  const [searchResults, setSearchResults] =
    useState<
      {
        id: string;
        username?: string | null;
        display_name?: string | null;
        avatar_url?: string | null;
      }[]
    >([]);

  const [searching, setSearching] =
    useState(false);

  const [recipient, setRecipient] =
    useState<{
      id: string;
      username?: string | null;
      display_name?: string | null;
    } | null>(null);

  const [amount, setAmount] =
    useState("");

  const [transferring, setTransferring] =
    useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        setError(null);

        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [
          walletRes,
          catalogRes,
          invRes,
          txRes,
        ] = await Promise.all([
          getGamingWallet(),
          getShopCatalog(),
          getUserInventory(),
          getCoinTransactions(),
        ]);

        if (walletRes?.wallet) {
          const data =
            walletRes.wallet;

          setWallet({
            user_id: String(
              data.user_id ?? "",
            ),
            x_coins: safeNumber(
              data.x_coins,
            ),
            total_xp: safeNumber(
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
            wins: safeNumber(
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
        }

        if (catalogRes) {
          setCategories(
            catalogRes.categories ??
              [],
          );

          setItems(
            catalogRes.items ?? [],
          );
        }

        if (invRes?.inventory) {
          setInventory(
            invRes.inventory,
          );
        }

        if (txRes?.transactions) {
          setTransactions(
            txRes.transactions,
          );
        }
      } catch (err) {
        console.error(
          "Shop load error:",
          err,
        );

        setError(
          "Unable to load shop data. Try refreshing.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  /**
   * User search for coin transfer.
   *
   * This remains separate from the Gaming database.
   * It uses the existing Connect Chat profiles table.
   */
  useEffect(() => {
    const term =
      searchTerm
        .trim()
        .toLowerCase();

    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;

    setSearching(true);

    void (async () => {
      const {
        data,
        error: qErr,
      } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, discoverable",
        )
        .eq(
          "discoverable",
          true,
        )
        .neq(
          "id",
          user?.id ?? "",
        )
        .ilike(
          "username",
          `${term}%`,
        )
        .limit(15);

      if (cancelled) {
        return;
      }

      setSearching(false);

      if (qErr) {
        console.error(
          qErr,
        );
        return;
      }

      setSearchResults(
        (data ??
          []) as typeof searchResults,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [
    searchTerm,
    user?.id,
  ]);

  const ownedItemIds =
    useMemo(
      () =>
        new Set(
          inventory.map(
            (i) => i.item_id,
          ),
        ),
      [inventory],
    );

  const filteredItems =
    useMemo(() => {
      let result =
        items;

      if (
        categoryFilter !==
        "all"
      ) {
        result =
          result.filter(
            (item) =>
              item.category_id ===
              categoryFilter,
          );
      }

      const term =
        search
          .trim()
          .toLowerCase();

      if (term) {
        result =
          result.filter(
            (item) => {
              return (
                item.name
                  .toLowerCase()
                  .includes(term) ||
                (
                  item.description ??
                  ""
                )
                  .toLowerCase()
                  .includes(
                    term,
                  ) ||
                (
                  item.item_key ??
                  ""
                )
                  .toLowerCase()
                  .includes(
                    term,
                  )
              );
            },
          );
      }

      return result;
    }, [
      items,
      categoryFilter,
      search,
    ]);

  const groupedItems =
    useMemo(() => {
      const map =
        new Map<
          string,
          ShopItem[]
        >();

      for (const item of filteredItems) {
        const key =
          item.category_id ??
          "uncategorized";

        const current =
          map.get(key) ??
          [];

        current.push(item);

        map.set(
          key,
          current,
        );
      }

      return map;
    }, [filteredItems]);

  const coins =
    wallet.x_coins;

  const decided =
    wallet.wins +
    wallet.losses +
    wallet.draws;

  const winRate =
    decided > 0
      ? Math.round(
          (wallet.wins /
            decided) *
            1000,
        ) / 10
      : 0;

  async function onPurchase(
    item: ShopItem,
  ) {
    if (busyItemId) {
      return;
    }

    if (
      item.unique_ownership &&
      ownedItemIds.has(
        item.item_id,
      )
    ) {
      toast.error(
        "You already own this item",
      );
      return;
    }

    if (
      coins <
      item.price_x_coins
    ) {
      toast.error(
        "Not enough X Coins",
      );
      return;
    }

    setBusyItemId(
      item.item_id,
    );

    try {
      await purchaseShopItem({
        data: {
          itemId:
            item.item_id,
          quantity: 1,
        },
      });

      toast.success(
        `Purchased ${item.name}`,
      );

      setSelectedItem(
        null,
      );

      await load(true);
    } catch (err) {
      console.error(
        "Purchase error:",
        err,
      );

      toast.error(
        err instanceof Error
          ? err.message
          : "Purchase failed",
      );
    } finally {
      setBusyItemId(
        null,
      );
    }
  }

  async function onEquip(row: InventoryItem) {
    if (equipBusyId) return;

    setEquipBusyId(row.item_id);

    try {
      const result = await equipShopItem({
        data: {
          itemId: row.item_id,
        },
      });

      if (result?.equipped) {
        saveEquippedShopCosmeticLocal(result.equipped);
      }

      toast.success(
        `Equipped ${row.item_name ?? "item"}`,
      );

      await load(true);
    } catch (err) {
      console.error("Equip error:", err);

      toast.error(
        err instanceof Error
          ? err.message
          : "Could not equip item",
      );
    } finally {
      setEquipBusyId(null);
    }
  }

  async function onUnequip(row: InventoryItem) {
    if (equipBusyId) return;

    setEquipBusyId(row.item_id);

    try {
      const result = await unequipShopItem({
        data: {
          itemId: row.item_id,
        },
      });

      if (
        result?.cosmetic_type === "theme" ||
        result?.cosmetic_type === "wallpaper" ||
        result?.cosmetic_type === "bubble" ||
        result?.cosmetic_type === "sticker_pack" ||
        result?.cosmetic_type === "profile_frame" ||
        result?.cosmetic_type === "badge"
      ) {
        removeEquippedShopCosmeticLocal(result.cosmetic_type);
      }

      toast.success(
        `Unequipped ${row.item_name ?? "item"}`,
      );

      await load(true);
    } catch (err) {
      console.error("Unequip error:", err);

      toast.error(
        err instanceof Error
          ? err.message
          : "Could not unequip item",
      );
    } finally {
      setEquipBusyId(null);
    }
  }

  async function onTransfer() {
    if (
      !recipient ||
      transferring
    ) {
      return;
    }

    const amt =
      Math.floor(
        Number(amount),
      );

    if (
      !Number.isFinite(
        amt,
      ) ||
      amt <= 0
    ) {
      toast.error(
        "Enter a positive whole number",
      );
      return;
    }

    if (amt > coins) {
      toast.error(
        "Not enough X Coins",
      );
      return;
    }

    if (
      recipient.id ===
      user?.id
    ) {
      toast.error(
        "You cannot transfer to yourself",
      );
      return;
    }

    const ok =
      window.confirm(
        `Send ${amt.toLocaleString()} X Coins to @${
          recipient.username ??
          "user"
        }?`,
      );

    if (!ok) {
      return;
    }

    setTransferring(
      true,
    );

    try {
      await transferXCoins({
        data: {
          recipientId:
            recipient.id,
          amount: amt,
          idempotencyKey:
            newIdempotencyKey(),
        },
      });

      toast.success(
        "Transfer sent",
      );

      setAmount("");
      setRecipient(
        null,
      );
      setSearchTerm("");

      await load(true);
    } catch (err) {
      console.error(
        "Transfer error:",
        err,
      );

      toast.error(
        err instanceof Error
          ? err.message
          : "Transfer failed",
      );
    } finally {
      setTransferring(
        false,
      );
    }
  }

  const tabs: {
    id: Tab;
    label: string;
    icon: typeof WalletCards;
  }[] = [
    {
      id: "shop",
      label: "Shop",
      icon: ShoppingBag,
    },
    {
      id: "wallet",
      label: "Wallet",
      icon: WalletCards,
    },
    {
      id: "transfer",
      label: "Transfer",
      icon: Send,
    },
    {
      id: "inventory",
      label: "Inventory",
      icon: Package,
    },
    {
      id: "collectibles",
      label: "Collectibles",
      icon: Gift,
    },
    {
      id: "history",
      label: "History",
      icon: RefreshCw,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Shop"
        subtitle="X Coins, cosmetics, stickers, games & more"
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() =>
              void load(true)
            }
            disabled={
              loading ||
              refreshing
            }
            aria-label="Refresh shop"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing
                  ? "animate-spin"
                  : ""
              }`}
            />
          </Button>
        }
      />

      <div className="space-y-4 p-4 pb-8">
        {/* X COIN BALANCE */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          {/* DO NOT CHANGE THIS COIN COLOR */}
          <XCoinIcon
            size={38}
            className="text-yellow-400"
          />

          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              Your X Coins
            </p>

            <p className="text-2xl font-black tabular-nums">
              {loading
                ? "—"
                : coins.toLocaleString()}{" "}
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

        {/* TABS */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {tabs.map(
            ({
              id,
              label,
              icon: Icon,
            }) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  setTab(id)
                }
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ),
          )}
        </div>

        {/* =========================
            SHOP
        ========================== */}
        {tab === "shop" && (
          <div className="space-y-5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value,
                  )
                }
                placeholder="Search anime, games, movies, cars, stickers..."
                className="pl-9"
              />
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <FilterChip
                active={
                  categoryFilter ===
                  "all"
                }
                onClick={() =>
                  setCategoryFilter(
                    "all",
                  )
                }
                label="All"
              />

              {categories.map(
                (category) => {
                  const Icon =
                    getCategoryIcon(
                      category.name,
                    );

                  return (
                    <button
                      key={
                        category.category_id
                      }
                      type="button"
                      onClick={() =>
                        setCategoryFilter(
                          category.category_id,
                        )
                      }
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        categoryFilter ===
                        category.category_id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {getCategoryLabel(
                        category.name,
                      )}
                    </button>
                  );
                },
              )}
            </div>

            {loading && (
              <div className="rounded-2xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
                Loading Shop...
              </div>
            )}

            {!loading &&
              filteredItems.length ===
                0 && (
                <div className="rounded-2xl border border-border bg-card p-6 text-center">
                  <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />

                  <p className="font-semibold">
                    Nothing found
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Try another category or search.
                  </p>
                </div>
              )}

            {/* Category sections */}
            {!loading &&
              Array.from(
                groupedItems.entries(),
              ).map(
                ([
                  categoryId,
                  categoryItems,
                ]) => {
                  const category =
                    categories.find(
                      (c) =>
                        c.category_id ===
                        categoryId,
                    );

                  const categoryName =
                    category?.name ??
                    "More";

                  const Icon =
                    getCategoryIcon(
                      categoryName,
                    );

                  return (
                    <section
                      key={
                        categoryId
                      }
                      className="space-y-3"
                    >
                      {/* Section header */}
                      <div
                        className={`overflow-hidden rounded-2xl border border-border bg-gradient-to-r ${getCategoryAccent(
                          categoryName,
                        )}`}
                      >
                        <div className="flex items-center gap-3 p-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/70">
                            <Icon className="h-5 w-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <h2 className="font-bold">
                              {getCategoryLabel(
                                categoryName,
                              )}
                            </h2>

                            <p className="text-xs text-muted-foreground">
                              {category?.description ||
                                getCategoryDescription(
                                  categoryName,
                                )}
                            </p>
                          </div>

                          <span className="rounded-full bg-background/70 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                            {
                              categoryItems.length
                            }{" "}
                            items
                          </span>
                        </div>
                      </div>

                      {/* Item grid */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {categoryItems.map(
                          (
                            item,
                          ) => (
                            <ShopItemCard
                              key={
                                item.item_id
                              }
                              item={
                                item
                              }
                              owned={Boolean(
                                item.unique_ownership &&
                                  ownedItemIds.has(
                                    item.item_id,
                                  ),
                              )}
                              busy={
                                busyItemId ===
                                item.item_id
                              }
                              canAfford={
                                coins >=
                                item.price_x_coins
                              }
                              onOpen={() =>
                                setSelectedItem(
                                  item,
                                )
                              }
                            />
                          ),
                        )}
                      </div>
                    </section>
                  );
                },
              )}

            {/* Selected item modal */}
            {selectedItem && (
              <ItemPreviewModal
                item={
                  selectedItem
                }
                owned={
                  Boolean(
                    selectedItem.unique_ownership &&
                      ownedItemIds.has(
                        selectedItem.item_id,
                      ),
                  )
                }
                busy={
                  busyItemId ===
                  selectedItem.item_id
                }
                canAfford={
                  coins >=
                  selectedItem.price_x_coins
                }
                onClose={() =>
                  setSelectedItem(
                    null,
                  )
                }
                onPurchase={() =>
                  void onPurchase(
                    selectedItem,
                  )
                }
              />
            )}
          </div>
        )}

        {/* =========================
            WALLET
        ========================== */}
        {tab === "wallet" && (
          <div className="space-y-4">
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Star className="h-4 w-4" />
                <h2 className="font-semibold">
                  Level & XP
                </h2>
              </div>

              <p className="text-lg font-bold">
                Level{" "}
                {loading
                  ? "—"
                  : wallet.level}
              </p>

              <p className="text-sm text-muted-foreground">
                {loading
                  ? "—"
                  : `${wallet.total_xp.toLocaleString()} XP`}
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Gamepad2 className="h-4 w-4" />
                <h2 className="font-semibold">
                  Your gaming stats
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="Games"
                  value={
                    wallet.games_played
                  }
                  loading={
                    loading
                  }
                />

                <Stat
                  label="Wins"
                  value={
                    wallet.wins
                  }
                  loading={
                    loading
                  }
                />

                <Stat
                  label="Losses"
                  value={
                    wallet.losses
                  }
                  loading={
                    loading
                  }
                />

                <Stat
                  label="Draws"
                  value={
                    wallet.draws
                  }
                  loading={
                    loading
                  }
                />

                <Stat
                  label="Win rate"
                  value={`${winRate}%`}
                  loading={
                    loading
                  }
                />

                <Stat
                  label="Streak"
                  value={
                    wallet.current_streak
                  }
                  loading={
                    loading
                  }
                  icon={
                    <Flame className="h-3 w-3" />
                  }
                />

                <Stat
                  label="Best streak"
                  value={
                    wallet.longest_streak
                  }
                  loading={
                    loading
                  }
                />

                <Stat
                  label="Bot games"
                  value={
                    wallet.bot_games
                  }
                  loading={
                    loading
                  }
                />
              </div>
            </section>
          </div>
        )}

        {/* =========================
            TRANSFER
        ========================== */}
        {tab ===
          "transfer" && (
          <div className="space-y-4">
            <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                <h2 className="font-semibold">
                  Send X Coins
                </h2>
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
                    value={
                      searchTerm
                    }
                    onChange={(
                      e,
                    ) => {
                      setSearchTerm(
                        e.target
                          .value,
                      );

                      setRecipient(
                        null,
                      );
                    }}
                  />
                </div>

                {searching && (
                  <p className="text-xs text-muted-foreground">
                    Searching...
                  </p>
                )}

                {searchResults.length >
                  0 &&
                  !recipient && (
                    <ul className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-border">
                      {searchResults.map(
                        (p) => (
                          <li
                            key={
                              p.id
                            }
                          >
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => {
                                setRecipient(
                                  {
                                    id: p.id,
                                    username:
                                      p.username,
                                    display_name:
                                      p.display_name,
                                  },
                                );

                                setSearchTerm(
                                  p.username ??
                                    "",
                                );

                                setSearchResults(
                                  [],
                                );
                              }}
                            >
                              <UserAvatar
                                path={
                                  p.avatar_url ??
                                  null
                                }
                                name={
                                  p.display_name ??
                                  p.username ??
                                  "?"
                                }
                                size="sm"
                              />

                              <span>
                                {p.display_name ??
                                  p.username}

                                {p.username ? (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    @
                                    {
                                      p.username
                                    }
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
              </div>

              {recipient && (
                <p className="text-sm">
                  To:{" "}
                  <span className="font-semibold">
                    @
                    {recipient.username ??
                      recipient.id.slice(
                        0,
                        8,
                      )}
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
                  value={
                    amount
                  }
                  onChange={(
                    e,
                  ) =>
                    setAmount(
                      e.target
                        .value,
                    )
                  }
                />
              </div>

              <Button
                type="button"
                className="w-full bg-green-600 text-white hover:bg-green-700"
                disabled={
                  !recipient ||
                  transferring ||
                  !amount
                }
                onClick={() =>
                  void onTransfer()
                }
              >
                {transferring
                  ? "Sending..."
                  : "Send X Coins"}
              </Button>

              <p className="text-xs text-muted-foreground">
                Transfers use the secure Gaming backend.
                Your balance is never changed directly
                by the browser.
              </p>
            </section>
          </div>
        )}

        {/* =========================
            INVENTORY
        ========================== */}
        {tab ===
          "inventory" && (
          <div className="space-y-2">
            <div className="mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" />
              <h2 className="font-semibold">
                Your inventory
              </h2>
            </div>

            {loading && (
              <p className="text-sm text-muted-foreground">
                Loading...
              </p>
            )}

            {!loading &&
              inventory.length ===
                0 && (
                <div className="rounded-2xl border border-border bg-card p-6 text-center">
                  <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />

                  <p className="font-semibold">
                    Your inventory is empty
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Buy items from the Shop and
                    they will appear here.
                  </p>
                </div>
              )}

            {inventory.map(
              (row) => (
                <div
                  key={
                    row.inventory_id
                  }
                  className="rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {row.item_name ??
                          "Item"}{" "}
                        {row.quantity >
                        1
                          ? `×${row.quantity}`
                          : ""}
                      </p>

                      {row.item_description && (
                        <p className="text-xs text-muted-foreground">
                          {
                            row.item_description
                          }
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={
                        equipBusyId ===
                        row.item_id
                      }
                      onClick={() =>
                        void (
                          row.equipped
                            ? onUnequip(
                                row,
                              )
                            : onEquip(
                                row,
                              )
                        )
                      }
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-50 ${
                        row.equipped
                          ? "bg-green-500/15 text-green-500 hover:bg-green-500/25"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {equipBusyId ===
                      row.item_id
                        ? "…"
                        : row.equipped
                          ? "Equipped"
                          : "Equip"}
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        {/* =========================
            COLLECTIBLES (gifts received)
        ========================== */}
        {tab === "collectibles" && (
          <CollectiblesPanel
            onBalanceMaybeChanged={() => {
              void load(true);
            }}
          />
        )}

        {/* =========================
            HISTORY
        ========================== */}
        {tab ===
          "history" && (
          <div className="space-y-2">
            <h2 className="font-semibold">
              X Coin transactions
            </h2>

            {loading && (
              <p className="text-sm text-muted-foreground">
                Loading...
              </p>
            )}

            {!loading &&
              transactions.length ===
                0 && (
                <p className="text-sm text-muted-foreground">
                  No transactions yet.
                </p>
              )}

            {transactions.map(
              (tx) => (
                <div
                  key={
                    tx.transaction_id
                  }
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {tx.transaction_type ??
                        "Transaction"}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {tx.reason ??
                        "—"}

                      {tx.created_at
                        ? ` · ${new Date(
                            tx.created_at,
                          ).toLocaleString()}`
                        : ""}
                    </p>
                  </div>

                  <p
                    className={`shrink-0 text-sm font-bold tabular-nums ${
                      tx.amount >=
                      0
                        ? "text-green-500"
                        : "text-red-400"
                    }`}
                  >
                    {tx.amount >=
                    0
                      ? "+"
                      : ""}
                    {tx.amount.toLocaleString()}
                  </p>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* =========================================================
   SHOP ITEM CARD
========================================================= */

function ShopItemCard({
  item,
  owned,
  busy,
  canAfford,
  onOpen,
}: {
  item: ShopItem;
  owned: boolean;
  busy: boolean;
  canAfford: boolean;
  onOpen: () => void;
}) {
  const image =
    getItemImage(item);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
    >
      {/* Preview */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {image ? (
          <img
            src={image}
            alt={item.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
            onError={(
              event,
            ) => {
              event.currentTarget.style.display =
                "none";
            }}
          />
        ) : (
          <ItemFallback
            item={
              item
            }
          />
        )}

        {owned && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-green-600 px-2 py-1 text-[10px] font-bold text-white shadow">
            <Check className="h-3 w-3" />
            Owned
          </div>
        )}
      </div>

      {/* Information */}
      <div className="space-y-2 p-3">
        <p className="line-clamp-1 text-sm font-bold">
          {item.name}
        </p>

        {item.description && (
          <p className="line-clamp-2 min-h-8 text-[11px] leading-4 text-muted-foreground">
            {
              item.description
            }
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-sm font-black text-yellow-400">
            <XCoinIcon
              size={17}
              className="text-yellow-400"
            />
            {item.price_x_coins.toLocaleString()}
          </div>

          <span
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
              owned
                ? "bg-muted text-muted-foreground"
                : !canAfford
                  ? "bg-muted text-muted-foreground"
                  : "bg-green-600 text-white"
            }`}
          >
            {owned
              ? "Owned"
              : busy
                ? "..."
                : !canAfford
                  ? "Need more"
                  : "Buy"}
          </span>
        </div>
      </div>
    </button>
  );
}

/* =========================================================
   FALLBACK PREVIEW
========================================================= */

function ItemFallback({
  item,
}: {
  item: ShopItem;
}) {
  const name =
    item.name.toLowerCase();

  let Icon =
    ShoppingBag;

  if (
    name.includes("anime")
  ) {
    Icon = Sparkles;
  } else if (
    name.includes("game") ||
    name.includes("gaming")
  ) {
    Icon = Gamepad2;
  } else if (
    name.includes("movie") ||
    name.includes("film")
  ) {
    Icon = Film;
  } else if (
    name.includes("car")
  ) {
    Icon = Car;
  } else if (
    name.includes("sticker")
  ) {
    Icon = Sticker;
  } else if (
    name.includes("gif")
  ) {
    Icon = Gift;
  } else if (
    name.includes("badge")
  ) {
    Icon = Trophy;
  } else if (
    name.includes("wallpaper")
  ) {
    Icon = ImageIcon;
  } else if (
    name.includes("bubble")
  ) {
    Icon = MessageCircle;
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted via-card to-muted p-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/80 shadow">
        <Icon className="h-7 w-7 text-primary" />
      </div>

      <p className="line-clamp-2 text-center text-xs font-semibold text-muted-foreground">
        {item.name}
      </p>
    </div>
  );
}

/* =========================================================
   ITEM PREVIEW MODAL
========================================================= */

function ItemPreviewModal({
  item,
  owned,
  busy,
  canAfford,
  onClose,
  onPurchase,
}: {
  item: ShopItem;
  owned: boolean;
  busy: boolean;
  canAfford: boolean;
  onClose: () => void;
  onPurchase: () => void;
}) {
  const image =
    getItemImage(item);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-background shadow-2xl"
        onClick={(e) =>
          e.stopPropagation()
        }
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
      >
        {/* Large image */}
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {image ? (
            <img
              src={image}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <ItemFallback
              item={item}
            />
          )}

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <h2 className="text-xl font-bold">
              {item.name}
            </h2>

            {item.description && (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {
                  item.description
                }
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <span className="text-sm text-muted-foreground">
              Price
            </span>

            <span className="flex items-center gap-1 text-lg font-black text-yellow-400">
              <XCoinIcon
                size={21}
                className="text-yellow-400"
              />
              {item.price_x_coins.toLocaleString()}
            </span>
          </div>

          {owned ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-green-500/10 p-3 text-sm font-semibold text-green-500">
              <Check className="h-4 w-4" />
              You already own this item
            </div>
          ) : (
            <Button
              type="button"
              disabled={
                busy ||
                !canAfford
              }
              onClick={
                onPurchase
              }
              className="w-full bg-green-600 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? "Buying..."
                : !canAfford
                  ? "Not enough X Coins"
                  : "Buy Now"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   STAT
========================================================= */

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
        <span className="text-[11px]">
          {label}
        </span>
      </div>

      <p className="mt-1 text-lg font-bold tabular-nums">
        {loading
          ? "—"
          : typeof value ===
              "number"
            ? value.toLocaleString()
            : value}
      </p>
    </div>
  );
}

/* =========================================================
   FILTER CHIP
========================================================= */

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
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}