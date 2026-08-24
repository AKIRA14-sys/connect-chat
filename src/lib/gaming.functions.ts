import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gamingSupabaseAdmin } from "@/integrations/gaming-supabase/client.server";

export type StartGamingMatchInput = {
  matchId: string;
  gameType: string;
  player2Id?: string | null;
  isBot: boolean;
};

export type CompleteGamingMatchInput = {
  matchId: string;
  gameType: string;
  player1Id: string;
  player2Id?: string | null;
  isBot: boolean;
  winnerId?: string | null;
  loserId?: string | null;
  result: "win" | "loss" | "draw";
};

export type GamingMatchRewardInput = {
  matchId: string;
};

/**
 * Ensures the authenticated user has a Gaming profile.
 *
 * IMPORTANT:
 * This function is kept compatible with the existing
 * working reward/game system.
 */
export const ensureGamingProfile = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;

    const { data, error } =
      await gamingSupabaseAdmin.rpc(
        "ensure_gaming_profile",
        {
          p_user_id: userId,
        },
      );

    if (error) {
      console.error(
        "Failed to ensure gaming profile:",
        error,
      );

      throw new Error(
        "Unable to create gaming profile",
      );
    }

    return {
      success: true,
      profile: data,
    };
  });

/**
 * Starts a gaming match.
 *
 * This is the existing working match-start flow.
 */
export const startGamingMatch = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: StartGamingMatchInput) => {
      if (
        !input ||
        typeof input !== "object"
      ) {
        throw new Error(
          "Invalid match input",
        );
      }

      if (
        !input.matchId ||
        !input.gameType
      ) {
        throw new Error(
          "Match ID and game type are required",
        );
      }

      if (
        input.player2Id &&
        input.player2Id === input.matchId
      ) {
        throw new Error(
          "Invalid player ID",
        );
      }

      return input;
    },
  )
  .handler(
    async ({ data, context }) => {
      const actorId = context.userId;

      if (
        !data.isBot &&
        !data.player2Id
      ) {
        throw new Error(
          "Real-user matches require player 2",
        );
      }

      if (
        !data.isBot &&
        data.player2Id === actorId
      ) {
        throw new Error(
          "A player cannot play against themselves",
        );
      }

      const {
        data: result,
        error,
      } =
        await gamingSupabaseAdmin.rpc(
          "start_game_match_session",
          {
            p_user_id: actorId,
            p_match_id: data.matchId,
            p_game_type: data.gameType,
            p_player_2_id:
              data.isBot
                ? null
                : data.player2Id ?? null,
            p_is_bot: data.isBot,
            p_client_state_hash: null,
          },
        );

      if (error) {
        console.error(
          "Failed to start gaming match:",
          error,
        );

        throw new Error(
          error.message ||
            "Unable to start game",
        );
      }

      return {
        success: true,
        session: result,
      };
    },
  );

/**
 * Completes a gaming match and awards
 * the appropriate X Coins / XP.
 *
 * IMPORTANT:
 * The existing RPC is untouched.
 */
export const completeGamingMatch =
  createServerFn({
    method: "POST",
  })
    .middleware([requireSupabaseAuth])
    .inputValidator(
      (
        input: CompleteGamingMatchInput,
      ) => {
        if (
          !input ||
          typeof input !== "object"
        ) {
          throw new Error(
            "Invalid match input",
          );
        }

        if (
          !input.matchId ||
          !input.gameType ||
          !input.player1Id
        ) {
          throw new Error(
            "Match information is incomplete",
          );
        }

        if (
          ![
            "win",
            "loss",
            "draw",
          ].includes(input.result)
        ) {
          throw new Error(
            "Invalid match result",
          );
        }

        return input;
      },
    )
    .handler(
      async ({ data, context }) => {
        const actorId =
          context.userId;

        if (
          actorId !== data.player1Id &&
          actorId !== data.player2Id
        ) {
          throw new Error(
            "You are not a participant in this match",
          );
        }

        const {
          data: result,
          error,
        } =
          await gamingSupabaseAdmin.rpc(
            "complete_game_match_and_reward",
            {
              p_user_id: actorId,
              p_match_id: data.matchId,
              p_game_type: data.gameType,
              p_player_1_id:
                data.player1Id,
              p_player_2_id:
                data.player2Id ?? null,
              p_is_bot: data.isBot,
              p_winner_id:
                data.winnerId ?? null,
              p_loser_id:
                data.loserId ?? null,
              p_result: data.result,
            },
          );

        if (error) {
          console.error(
            "Failed to complete gaming match:",
            error,
          );

          throw new Error(
            error.message ||
              "Unable to record game result",
          );
        }

        return {
          success: true,
          result,
        };
      },
    );

/**
 * Returns the reward already recorded for
 * the authenticated user and match.
 *
 * Recovery path for multiplayer matches
 * when the completion RPC response does not
 * contain the original reward.
 */
export const getGamingMatchReward =
  createServerFn({
    method: "POST",
  })
    .middleware([requireSupabaseAuth])
    .inputValidator(
      (
        input: GamingMatchRewardInput,
      ) => {
        if (
          !input ||
          typeof input !== "object" ||
          !input.matchId
        ) {
          throw new Error(
            "Match ID is required",
          );
        }

        return input;
      },
    )
    .handler(
      async ({ data, context }) => {
        const actorId =
          context.userId;

        const {
          data: reward,
          error,
        } =
          await gamingSupabaseAdmin
            .from("game_rewards")
            .select(
              "match_id, user_id, x_coins, xp, reward_type, created_at",
            )
            .eq(
              "match_id",
              data.matchId,
            )
            .eq(
              "user_id",
              actorId,
            )
            .maybeSingle();

        if (error) {
          console.error(
            "Failed to read recorded gaming reward:",
            error,
          );

          throw new Error(
            "Unable to read game reward",
          );
        }

        return reward
          ? {
              matchId:
                reward.match_id,

              userId:
                reward.user_id,

              x_coins:
                Number(
                  reward.x_coins ?? 0,
                ),

              xp:
                Number(
                  reward.xp ?? 0,
                ),

              rewardType:
                reward.reward_type,

              createdAt:
                reward.created_at,
            }
          : null;
      },
    );

/**
 * Wallet data returned to the Gaming UI.
 *
 * Data comes from three separate tables:
 *
 * gaming_profiles
 * gaming_stats
 * gaming_streaks
 */
export type GamingWalletData = {
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

/**
 * Loads the authenticated user's complete
 * Gaming wallet and statistics.
 *
 * IMPORTANT:
 *
 * The Gaming tables are in the PUBLIC schema.
 *
 * We therefore intentionally DO NOT use:
 *
 * .schema("gaming")
 *
 * The actual structure is:
 *
 * public.gaming_profiles
 * public.gaming_stats
 * public.gaming_streaks
 */
export const getGamingWallet =
  createServerFn({
    method: "POST",
  })
    .middleware([requireSupabaseAuth])
    .handler(
      async ({ context }) => {
        const userId =
          context.userId;

        /*
         * Read the three tables separately.
         *
         * This is important because:
         *
         * gaming_profiles does NOT contain
         * games_played, wins, losses, etc.
         *
         * gaming_stats contains those values.
         *
         * gaming_streaks contains streak values.
         */
        const [
          profileResult,
          statsResult,
          streakResult,
        ] = await Promise.all([
          gamingSupabaseAdmin
            .from("gaming_profiles")
            .select(
              [
                "user_id",
                "x_coins",
                "total_xp",
                "current_level",
              ].join(","),
            )
            .eq(
              "user_id",
              userId,
            )
            .maybeSingle(),

          gamingSupabaseAdmin
            .from("gaming_stats")
            .select(
              [
                "user_id",
                "games_played",
                "wins",
                "losses",
                "draws",
                "bot_games",
                "real_user_games",
              ].join(","),
            )
            .eq(
              "user_id",
              userId,
            )
            .maybeSingle(),

          gamingSupabaseAdmin
            .from("gaming_streaks")
            .select(
              [
                "user_id",
                "current_streak",
                "longest_streak",
              ].join(","),
            )
            .eq(
              "user_id",
              userId,
            )
            .maybeSingle(),
        ]);

        /*
         * Check profile query.
         */
        if (
          profileResult.error
        ) {
          console.error(
            "Failed to load gaming profile:",
            profileResult.error,
          );

          throw new Error(
            "Unable to load gaming profile",
          );
        }

        /*
         * Check statistics query.
         */
        if (
          statsResult.error
        ) {
          console.error(
            "Failed to load gaming stats:",
            statsResult.error,
          );

          throw new Error(
            "Unable to load gaming statistics",
          );
        }

        /*
         * Check streak query.
         */
        if (
          streakResult.error
        ) {
          console.error(
            "Failed to load gaming streak:",
            streakResult.error,
          );

          throw new Error(
            "Unable to load gaming streak",
          );
        }

        /*
         * If the profile doesn't exist yet,
         * use the existing profile RPC.
         */
        if (
          !profileResult.data
        ) {
          await gamingSupabaseAdmin.rpc(
            "ensure_gaming_profile",
            {
              p_user_id: userId,
            },
          );

          /*
           * Re-read the profile after ensuring it.
           */
          const {
            data: newProfile,
            error:
              reloadError,
          } =
            await gamingSupabaseAdmin
              .from(
                "gaming_profiles",
              )
              .select(
                [
                  "user_id",
                  "x_coins",
                  "total_xp",
                  "current_level",
                ].join(","),
              )
              .eq(
                "user_id",
                userId,
              )
              .maybeSingle();

          if (reloadError) {
            console.error(
              "Failed to reload gaming profile:",
              reloadError,
            );

            throw new Error(
              "Unable to load gaming wallet",
            );
          }

          if (!newProfile) {
            return {
              success: true,

              wallet: {
                user_id:
                  userId,

                x_coins: 0,

                total_xp: 0,

                level: 1,

                games_played:
                  Number(
                    statsResult.data
                      ?.games_played ??
                      0,
                  ),

                wins:
                  Number(
                    statsResult.data
                      ?.wins ?? 0,
                  ),

                losses:
                  Number(
                    statsResult.data
                      ?.losses ?? 0,
                  ),

                draws:
                  Number(
                    statsResult.data
                      ?.draws ?? 0,
                  ),

                current_streak:
                  Number(
                    streakResult.data
                      ?.current_streak ??
                      0,
                  ),

                longest_streak:
                  Number(
                    streakResult.data
                      ?.longest_streak ??
                      0,
                  ),

                bot_games:
                  Number(
                    statsResult.data
                      ?.bot_games ??
                      0,
                  ),

                real_user_games:
                  Number(
                    statsResult.data
                      ?.real_user_games ??
                      0,
                  ),
              } satisfies GamingWalletData,
            };
          }

          /*
           * Return newly created profile.
           */
          return {
            success: true,

            wallet: {
              user_id:
                String(
                  newProfile.user_id,
                ),

              x_coins:
                Number(
                  newProfile.x_coins ??
                    0,
                ),

              total_xp:
                Number(
                  newProfile.total_xp ??
                    0,
                ),

              level:
                Number(
                  newProfile.current_level ??
                    1,
                ),

              games_played:
                Number(
                  statsResult.data
                    ?.games_played ??
                    0,
                ),

              wins:
                Number(
                  statsResult.data
                    ?.wins ?? 0,
                ),

              losses:
                Number(
                  statsResult.data
                    ?.losses ?? 0,
                ),

              draws:
                Number(
                  statsResult.data
                    ?.draws ?? 0,
                ),

              current_streak:
                Number(
                  streakResult.data
                    ?.current_streak ??
                    0,
                ),

              longest_streak:
                Number(
                  streakResult.data
                    ?.longest_streak ??
                    0,
                ),

              bot_games:
                Number(
                  statsResult.data
                    ?.bot_games ??
                    0,
                ),

              real_user_games:
                Number(
                  statsResult.data
                    ?.real_user_games ??
                    0,
                ),
            } satisfies GamingWalletData,
          };
        }

        /*
         * Normal wallet response.
         */
        const profile =
          profileResult.data;

        const stats =
          statsResult.data;

        const streak =
          streakResult.data;

        return {
          success: true,

          wallet: {
            user_id:
              String(
                profile.user_id,
              ),

            x_coins:
              Number(
                profile.x_coins ??
                  0,
              ),

            total_xp:
              Number(
                profile.total_xp ??
                  0,
              ),

            level:
              Number(
                profile.current_level ??
                  1,
              ),

            games_played:
              Number(
                stats?.games_played ??
                  0,
              ),

            wins:
              Number(
                stats?.wins ??
                  0,
              ),

            losses:
              Number(
                stats?.losses ??
                  0,
              ),

            draws:
              Number(
                stats?.draws ??
                  0,
              ),

            current_streak:
              Number(
                streak?.current_streak ??
                  0,
              ),

            longest_streak:
              Number(
                streak?.longest_streak ??
                  0,
              ),

            bot_games:
              Number(
                stats?.bot_games ??
                  0,
              ),

            real_user_games:
              Number(
                stats?.real_user_games ??
                  0,
              ),
          } satisfies GamingWalletData,
        };
      },
    );


/**
 * Recent reward rows for the authenticated user.
 * Reads public.game_rewards only (columns that already exist).
 */
export type GamingRewardHistoryItem = {
  match_id: string;
  user_id: string;
  x_coins: number;
  xp: number;
  reward_type: string | null;
  created_at: string | null;
};

export const getGamingRewardHistory = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number } | undefined) => {
    const limit =
      input && typeof input === "object" && typeof input.limit === "number"
        ? Math.min(Math.max(1, Math.floor(input.limit)), 50)
        : 20;
    return { limit };
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const limit = data.limit;

    const { data: rows, error } = await gamingSupabaseAdmin
      .from("game_rewards")
      .select("match_id, user_id, x_coins, xp, reward_type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to load gaming reward history:", error);
      throw new Error("Unable to load reward history");
    }

    const items: GamingRewardHistoryItem[] = (rows ?? []).map((row) => ({
      match_id: String(row.match_id),
      user_id: String(row.user_id),
      x_coins: Number(row.x_coins ?? 0),
      xp: Number(row.xp ?? 0),
      reward_type:
        row.reward_type == null ? null : String(row.reward_type),
      created_at:
        row.created_at == null ? null : String(row.created_at),
    }));

    return { success: true, items };
  });


/* =========================================================
 * SHOP / TRANSFER / PUBLIC PROFILE / TRANSACTIONS
 * Uses REAL Gaming Supabase tables + RPCs only.
 * ========================================================= */

export type TransferXCoinsInput = {
  recipientId: string;
  amount: number;
  idempotencyKey: string;
};

export const transferXCoins = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TransferXCoinsInput) => {
    if (!input || typeof input !== "object") {
      throw new Error("Invalid transfer input");
    }
    if (!input.recipientId || typeof input.recipientId !== "string") {
      throw new Error("Recipient is required");
    }
    if (!input.idempotencyKey || typeof input.idempotencyKey !== "string") {
      throw new Error("Idempotency key is required");
    }
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error("Amount must be a positive whole number");
    }
    return {
      recipientId: input.recipientId,
      amount,
      idempotencyKey: input.idempotencyKey,
    };
  })
  .handler(async ({ data, context }) => {
    const actorId = context.userId;

    if (data.recipientId === actorId) {
      throw new Error("You cannot transfer X Coins to yourself");
    }

    const { data: result, error } = await gamingSupabaseAdmin.rpc(
      "transfer_x_coins",
      {
        p_actor_id: actorId,
        p_recipient_id: data.recipientId,
        p_amount: data.amount,
        p_idempotency_key: data.idempotencyKey,
      },
    );

    if (error) {
      console.error("transfer_x_coins failed:", error);
      throw new Error(error.message || "Transfer failed");
    }

    return { success: true, result };
  });

export type PurchaseShopItemInput = {
  itemId: string;
  quantity?: number;
};

export const purchaseShopItem = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PurchaseShopItemInput) => {
    if (!input || typeof input !== "object" || !input.itemId) {
      throw new Error("Item ID is required");
    }
    const quantity =
      input.quantity == null ? 1 : Math.floor(Number(input.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }
    return { itemId: input.itemId, quantity };
  })
  .handler(async ({ data, context }) => {
    const actorId = context.userId;

    const { data: result, error } = await gamingSupabaseAdmin.rpc(
      "purchase_shop_item",
      {
        p_actor_id: actorId,
        p_item_id: data.itemId,
        p_quantity: data.quantity,
      },
    );

    if (error) {
      console.error("purchase_shop_item failed:", error);
      throw new Error(error.message || "Purchase failed");
    }

    return { success: true, result };
  });

export type ShopCategory = {
  category_id: string;
  name: string;
  description: string | null;
};

export type ShopItem = {
  item_id: string;
  category_id: string | null;
  item_key: string | null;
  name: string;
  description: string | null;
  price_x_coins: number;
  metadata: unknown;
  available: boolean;
  unique_ownership: boolean;
};

export const getShopCatalog = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const [catRes, itemRes] = await Promise.all([
      gamingSupabaseAdmin
        .from("shop_categories")
        .select("category_id, name, description, created_at")
        .order("name", { ascending: true }),
      gamingSupabaseAdmin
        .from("shop_items")
        .select(
          "item_id, category_id, item_key, name, description, price_x_coins, metadata, available, unique_ownership, created_at, updated_at",
        )
        .eq("available", true)
        .order("name", { ascending: true }),
    ]);

    if (catRes.error) {
      console.error("shop_categories error:", catRes.error);
      throw new Error("Unable to load shop categories");
    }
    if (itemRes.error) {
      console.error("shop_items error:", itemRes.error);
      throw new Error("Unable to load shop items");
    }

    const categories: ShopCategory[] = (catRes.data ?? []).map((c) => ({
      category_id: String(c.category_id),
      name: String(c.name ?? ""),
      description: c.description == null ? null : String(c.description),
    }));

    const items: ShopItem[] = (itemRes.data ?? []).map((i) => ({
      item_id: String(i.item_id),
      category_id: i.category_id == null ? null : String(i.category_id),
      item_key: i.item_key == null ? null : String(i.item_key),
      name: String(i.name ?? ""),
      description: i.description == null ? null : String(i.description),
      price_x_coins: Number(i.price_x_coins ?? 0),
      metadata: i.metadata ?? null,
      available: Boolean(i.available),
      unique_ownership: Boolean(i.unique_ownership),
    }));

    return { success: true, categories, items };
  });

export type InventoryItem = {
  inventory_id: string;
  item_id: string;
  quantity: number;
  equipped: boolean;
  purchased_at: string | null;
  item_name: string | null;
  item_description: string | null;
  item_key: string | null;
};

export const getUserInventory = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;

    const { data, error } = await gamingSupabaseAdmin
      .from("user_inventory")
      .select(
        "inventory_id, user_id, item_id, quantity, equipped, purchased_at, metadata",
      )
      .eq("user_id", userId)
      .order("purchased_at", { ascending: false });

    if (error) {
      console.error("user_inventory error:", error);
      throw new Error("Unable to load inventory");
    }

    const rows = data ?? [];
    const itemIds = Array.from(
      new Set(rows.map((r) => String(r.item_id)).filter(Boolean)),
    );

    let itemMap = new Map<
      string,
      { name: string; description: string | null; item_key: string | null }
    >();

    if (itemIds.length > 0) {
      const { data: items, error: itemErr } = await gamingSupabaseAdmin
        .from("shop_items")
        .select("item_id, name, description, item_key")
        .in("item_id", itemIds);

      if (!itemErr && items) {
        itemMap = new Map(
          items.map((i) => [
            String(i.item_id),
            {
              name: String(i.name ?? "Item"),
              description:
                i.description == null ? null : String(i.description),
              item_key: i.item_key == null ? null : String(i.item_key),
            },
          ]),
        );
      }
    }

    const inventory: InventoryItem[] = rows.map((r) => {
      const meta = itemMap.get(String(r.item_id));
      return {
        inventory_id: String(r.inventory_id),
        item_id: String(r.item_id),
        quantity: Number(r.quantity ?? 0),
        equipped: Boolean(r.equipped),
        purchased_at: r.purchased_at == null ? null : String(r.purchased_at),
        item_name: meta?.name ?? null,
        item_description: meta?.description ?? null,
        item_key: meta?.item_key ?? null,
      };
    });

    return { success: true, inventory };
  });

export type CoinTransaction = {
  transaction_id: string;
  amount: number;
  transaction_type: string | null;
  reason: string | null;
  match_id: string | null;
  transfer_id: string | null;
  purchase_id: string | null;
  sender_id: string | null;
  recipient_id: string | null;
  created_at: string | null;
};

export const getCoinTransactions = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;

    const { data, error } = await gamingSupabaseAdmin
      .from("coin_transactions")
      .select(
        "transaction_id, user_id, amount, transaction_type, reason, match_id, transfer_id, purchase_id, sender_id, recipient_id, metadata, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("coin_transactions error:", error);
      throw new Error("Unable to load transactions");
    }

    const transactions: CoinTransaction[] = (data ?? []).map((t) => ({
      transaction_id: String(t.transaction_id),
      amount: Number(t.amount ?? 0),
      transaction_type:
        t.transaction_type == null ? null : String(t.transaction_type),
      reason: t.reason == null ? null : String(t.reason),
      match_id: t.match_id == null ? null : String(t.match_id),
      transfer_id: t.transfer_id == null ? null : String(t.transfer_id),
      purchase_id: t.purchase_id == null ? null : String(t.purchase_id),
      sender_id: t.sender_id == null ? null : String(t.sender_id),
      recipient_id: t.recipient_id == null ? null : String(t.recipient_id),
      created_at: t.created_at == null ? null : String(t.created_at),
    }));

    return { success: true, transactions };
  });

export type PublicGamingProfile = {
  user_id: string;
  total_xp: number;
  current_level: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  bot_games: number;
  real_user_games: number;
  win_rate: number;
  current_streak: number;
  longest_streak: number;
};

export type GetPublicGamingProfileInput = {
  userId: string;
};

export const getPublicGamingProfile = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GetPublicGamingProfileInput) => {
    if (!input || typeof input !== "object" || !input.userId) {
      throw new Error("User ID is required");
    }
    return { userId: input.userId };
  })
  .handler(async ({ data }) => {
    const { data: row, error } = await gamingSupabaseAdmin
      .from("public_gaming_profiles")
      .select(
        "user_id, total_xp, current_level, games_played, wins, losses, draws, bot_games, real_user_games, win_rate, current_streak, longest_streak",
      )
      .eq("user_id", data.userId)
      .maybeSingle();

    if (error) {
      console.error("public_gaming_profiles error:", error);
      throw new Error("Unable to load public gaming profile");
    }

    if (!row) {
      return { success: true, profile: null };
    }

    const profile: PublicGamingProfile = {
      user_id: String(row.user_id),
      total_xp: Number(row.total_xp ?? 0),
      current_level: Number(row.current_level ?? 1),
      games_played: Number(row.games_played ?? 0),
      wins: Number(row.wins ?? 0),
      losses: Number(row.losses ?? 0),
      draws: Number(row.draws ?? 0),
      bot_games: Number(row.bot_games ?? 0),
      real_user_games: Number(row.real_user_games ?? 0),
      win_rate: Number(row.win_rate ?? 0),
      current_streak: Number(row.current_streak ?? 0),
      longest_streak: Number(row.longest_streak ?? 0),
    };

    return { success: true, profile };
  });
