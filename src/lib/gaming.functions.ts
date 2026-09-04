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

/* =========================================================
   GAMING PROFILE
========================================================= */

export const ensureGamingProfile =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .handler(
      async ({ context }) => {
        const userId =
          context.userId;

        const {
          data,
          error,
        } =
          await gamingSupabaseAdmin.rpc(
            "ensure_gaming_profile",
            {
              p_user_id:
                userId,
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
      },
    );

/* =========================================================
   START GAME
========================================================= */

export const startGamingMatch =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (
        input: StartGamingMatchInput,
      ) => {
        if (
          !input ||
          typeof input !==
            "object"
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
          input.player2Id ===
            input.matchId
        ) {
          throw new Error(
            "Invalid player ID",
          );
        }

        return input;
      },
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        const actorId =
          context.userId;

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
          data.player2Id ===
            actorId
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
              p_user_id:
                actorId,
              p_match_id:
                data.matchId,
              p_game_type:
                data.gameType,
              p_player_2_id:
                data.isBot
                  ? null
                  : data.player2Id ??
                    null,
              p_is_bot:
                data.isBot,
              p_client_state_hash:
                null,
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

/* =========================================================
   COMPLETE GAME + REWARD
========================================================= */

export const completeGamingMatch =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (
        input: CompleteGamingMatchInput,
      ) => {
        if (
          !input ||
          typeof input !==
            "object"
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
          ].includes(
            input.result,
          )
        ) {
          throw new Error(
            "Invalid match result",
          );
        }

        return input;
      },
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        const actorId =
          context.userId;

        if (
          actorId !==
            data.player1Id &&
          actorId !==
            data.player2Id
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
              p_user_id:
                actorId,
              p_match_id:
                data.matchId,
              p_game_type:
                data.gameType,
              p_player_1_id:
                data.player1Id,
              p_player_2_id:
                data.player2Id ??
                null,
              p_is_bot:
                data.isBot,
              p_winner_id:
                data.winnerId ??
                null,
              p_loser_id:
                data.loserId ??
                null,
              p_result:
                data.result,
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

/* =========================================================
   GET GAME REWARD
========================================================= */

export const getGamingMatchReward =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (
        input: GamingMatchRewardInput,
      ) => {
        if (
          !input ||
          typeof input !==
            "object" ||
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
      async ({
        data,
        context,
      }) => {
        const actorId =
          context.userId;

        const {
          data: reward,
          error,
        } =
          await gamingSupabaseAdmin
            .from(
              "game_rewards",
            )
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

        if (!reward) {
          return null;
        }

        return {
          matchId:
            reward.match_id,

          userId:
            reward.user_id,

          x_coins:
            Number(
              reward.x_coins ??
                0,
            ),

          xp:
            Number(
              reward.xp ?? 0,
            ),

          rewardType:
            reward.reward_type,

          createdAt:
            reward.created_at,
        };
      },
    );

/* =========================================================
   WALLET
========================================================= */

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

export const getGamingWallet =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .handler(
      async ({
        context,
      }) => {
        const userId =
          context.userId;

        const [
          profileResult,
          statsResult,
          streakResult,
        ] =
          await Promise.all([
            gamingSupabaseAdmin
              .from(
                "gaming_profiles",
              )
              .select(
                "user_id, x_coins, total_xp, current_level",
              )
              .eq(
                "user_id",
                userId,
              )
              .maybeSingle(),

            gamingSupabaseAdmin
              .from(
                "gaming_stats",
              )
              .select(
                "user_id, games_played, wins, losses, draws, bot_games, real_user_games",
              )
              .eq(
                "user_id",
                userId,
              )
              .maybeSingle(),

            gamingSupabaseAdmin
              .from(
                "gaming_streaks",
              )
              .select(
                "user_id, current_streak, longest_streak",
              )
              .eq(
                "user_id",
                userId,
              )
              .maybeSingle(),
          ]);

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

        if (
          !profileResult.data
        ) {
          const {
            error:
              ensureError,
          } =
            await gamingSupabaseAdmin.rpc(
              "ensure_gaming_profile",
              {
                p_user_id:
                  userId,
              },
            );

          if (
            ensureError
          ) {
            console.error(
              "Failed to ensure gaming profile:",
              ensureError,
            );

            throw new Error(
              "Unable to load gaming wallet",
            );
          }

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
                "user_id, x_coins, total_xp, current_level",
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

          return {
            success: true,

            wallet: {
              user_id:
                userId,

              x_coins:
                Number(
                  newProfile?.x_coins ??
                    0,
                ),

              total_xp:
                Number(
                  newProfile?.total_xp ??
                    0,
                ),

              level:
                Number(
                  newProfile?.current_level ??
                    1,
                ),

              games_played:
                Number(
                  statsResult
                    .data
                    ?.games_played ??
                    0,
                ),

              wins:
                Number(
                  statsResult
                    .data
                    ?.wins ?? 0,
                ),

              losses:
                Number(
                  statsResult
                    .data
                    ?.losses ?? 0,
                ),

              draws:
                Number(
                  statsResult
                    .data
                    ?.draws ?? 0,
                ),

              current_streak:
                Number(
                  streakResult
                    .data
                    ?.current_streak ??
                    0,
                ),

              longest_streak:
                Number(
                  streakResult
                    .data
                    ?.longest_streak ??
                    0,
                ),

              bot_games:
                Number(
                  statsResult
                    .data
                    ?.bot_games ??
                    0,
                ),

              real_user_games:
                Number(
                  statsResult
                    .data
                    ?.real_user_games ??
                    0,
                ),
            } satisfies GamingWalletData,
          };
        }

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
                stats?.wins ?? 0,
              ),

            losses:
              Number(
                stats?.losses ?? 0,
              ),

            draws:
              Number(
                stats?.draws ?? 0,
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

/* =========================================================
   REWARD HISTORY
========================================================= */

export type GamingRewardHistoryItem = {
  match_id: string;
  user_id: string;
  x_coins: number;
  xp: number;
  reward_type: string | null;
  created_at: string | null;
};

export const getGamingRewardHistory =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (
        input:
          | {
              limit?: number;
            }
          | undefined,
      ) => {
        const limit =
          input &&
          typeof input ===
            "object" &&
          typeof input.limit ===
            "number"
            ? Math.min(
                Math.max(
                  1,
                  Math.floor(
                    input.limit,
                  ),
                ),
                50,
              )
            : 20;

        return {
          limit,
        };
      },
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        const userId =
          context.userId;

        const {
          data: rows,
          error,
        } =
          await gamingSupabaseAdmin
            .from(
              "game_rewards",
            )
            .select(
              "match_id, user_id, x_coins, xp, reward_type, created_at",
            )
            .eq(
              "user_id",
              userId,
            )
            .order(
              "created_at",
              {
                ascending:
                  false,
              },
            )
            .limit(
              data.limit,
            );

        if (error) {
          console.error(
            "Failed to load gaming reward history:",
            error,
          );

          throw new Error(
            "Unable to load reward history",
          );
        }

        const items =
          (rows ?? []).map(
            (row) => ({
              match_id:
                String(
                  row.match_id,
                ),

              user_id:
                String(
                  row.user_id,
                ),

              x_coins:
                Number(
                  row.x_coins ??
                    0,
                ),

              xp:
                Number(
                  row.xp ?? 0,
                ),

              reward_type:
                row.reward_type ==
                null
                  ? null
                  : String(
                      row.reward_type,
                    ),

              created_at:
                row.created_at ==
                null
                  ? null
                  : String(
                      row.created_at,
                    ),
            }),
          );

        return {
          success: true,
          items,
        };
      },
    );

/* =========================================================
   TRANSFER X COINS
========================================================= */

export type TransferXCoinsInput = {
  recipientId: string;
  amount: number;
  idempotencyKey: string;
};

export const transferXCoins =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (
        input: TransferXCoinsInput,
      ) => {
        if (
          !input ||
          typeof input !==
            "object"
        ) {
          throw new Error(
            "Invalid transfer input",
          );
        }

        if (
          !input.recipientId ||
          typeof input.recipientId !==
            "string"
        ) {
          throw new Error(
            "Recipient is required",
          );
        }

        if (
          !input.idempotencyKey ||
          typeof input.idempotencyKey !==
            "string"
        ) {
          throw new Error(
            "Idempotency key is required",
          );
        }

        const amount =
          Number(
            input.amount,
          );

        if (
          !Number.isFinite(
            amount,
          ) ||
          amount <= 0 ||
          !Number.isInteger(
            amount,
          )
        ) {
          throw new Error(
            "Amount must be a positive whole number",
          );
        }

        return {
          recipientId:
            input.recipientId,

          amount,

          idempotencyKey:
            input.idempotencyKey,
        };
      },
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        const actorId =
          context.userId;

        if (
          data.recipientId ===
          actorId
        ) {
          throw new Error(
            "You cannot transfer X Coins to yourself",
          );
        }

        const {
          data: result,
          error,
        } =
          await gamingSupabaseAdmin
            .schema("gaming")
            .rpc(
              "transfer_x_coins",
              {
                p_sender_id:
                  actorId,

                p_recipient_id:
                  data.recipientId,

                p_amount:
                  data.amount,

                p_idempotency_key:
                  data.idempotencyKey,
              },
            );

        if (error) {
          console.error(
            "gaming.transfer_x_coins failed:",
            error,
          );

          throw new Error(
            error.message ||
              "Transfer failed",
          );
        }

        return {
          success: true,
          result,
        };
      },
    );

/* =========================================================
   PURCHASE SHOP ITEM
========================================================= */

export type PurchaseShopItemInput = {
  itemId: string;
  quantity?: number;
};

export const purchaseShopItem =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (
        input: PurchaseShopItemInput,
      ) => {
        if (
          !input ||
          typeof input !==
            "object" ||
          !input.itemId
        ) {
          throw new Error(
            "Item ID is required",
          );
        }

        const quantity =
          input.quantity ==
          null
            ? 1
            : Math.floor(
                Number(
                  input.quantity,
                ),
              );

        if (
          !Number.isFinite(
            quantity,
          ) ||
          quantity < 1
        ) {
          throw new Error(
            "Quantity must be at least 1",
          );
        }

        return {
          itemId:
            input.itemId,
          quantity,
        };
      },
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        const actorId =
          context.userId;

        const {
          data: result,
          error,
        } =
          await gamingSupabaseAdmin.rpc(
            "purchase_shop_item",
            {
              p_actor_id:
                actorId,

              p_item_id:
                data.itemId,

              p_quantity:
                data.quantity,
            },
          );

        if (error) {
          console.error(
            "purchase_shop_item failed:",
            error,
          );

          throw new Error(
            error.message ||
              "Purchase failed",
          );
        }

        return {
          success: true,
          result,
        };
      },
    );

/* =========================================================
   SHOP CATALOG
========================================================= */

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

export const getShopCatalog =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .handler(
      async () => {
        const [
          catRes,
          itemRes,
        ] =
          await Promise.all([
            gamingSupabaseAdmin
              .from(
                "shop_categories",
              )
              .select(
                "category_id, name, description, created_at",
              )
              .order(
                "name",
                {
                  ascending:
                    true,
                },
              ),

            gamingSupabaseAdmin
              .from(
                "shop_items",
              )
              .select(
                "item_id, category_id, item_key, name, description, price_x_coins, metadata, available, unique_ownership, created_at, updated_at",
              )
              .eq(
                "available",
                true,
              )
              .order(
                "name",
                {
                  ascending:
                    true,
                },
              ),
          ]);

        if (catRes.error) {
          console.error(
            "shop_categories error:",
            catRes.error,
          );

          throw new Error(
            "Unable to load shop categories",
          );
        }

        if (itemRes.error) {
          console.error(
            "shop_items error:",
            itemRes.error,
          );

          throw new Error(
            "Unable to load shop items",
          );
        }

        const categories =
          (
            catRes.data ??
            []
          ).map(
            (c) => ({
              category_id:
                String(
                  c.category_id,
                ),

              name:
                String(
                  c.name ??
                    "",
                ),

              description:
                c.description ==
                null
                  ? null
                  : String(
                      c.description,
                    ),
            }),
          );

        const items =
          (
            itemRes.data ??
            []
          ).map(
            (i) => ({
              item_id:
                String(
                  i.item_id,
                ),

              category_id:
                i.category_id ==
                null
                  ? null
                  : String(
                      i.category_id,
                    ),

              item_key:
                i.item_key ==
                null
                  ? null
                  : String(
                      i.item_key,
                    ),

              name:
                String(
                  i.name ??
                    "",
                ),

              description:
                i.description ==
                null
                  ? null
                  : String(
                      i.description,
                    ),

              price_x_coins:
                Number(
                  i.price_x_coins ??
                    0,
                ),

              metadata:
                i.metadata ??
                null,

              available:
                Boolean(
                  i.available,
                ),

              unique_ownership:
                Boolean(
                  i.unique_ownership,
                ),
            }),
          );

        return {
          success: true,
          categories,
          items,
        };
      },
    );

/* =========================================================
   INVENTORY
========================================================= */

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

export const getUserInventory =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .handler(
      async ({
        context,
      }) => {
        const userId =
          context.userId;

        const {
          data,
          error,
        } =
          await gamingSupabaseAdmin
            .from(
              "user_inventory",
            )
            .select(
              "inventory_id, user_id, item_id, quantity, equipped, purchased_at, metadata",
            )
            .eq(
              "user_id",
              userId,
            )
            .order(
              "purchased_at",
              {
                ascending:
                  false,
              },
            );

        if (error) {
          console.error(
            "user_inventory error:",
            error,
          );

          throw new Error(
            "Unable to load inventory",
          );
        }

        const rows =
          data ?? [];

        const itemIds =
          Array.from(
            new Set(
              rows
                .map(
                  (r) =>
                    String(
                      r.item_id,
                    ),
                )
                .filter(
                  Boolean,
                ),
            ),
          );

        let itemMap =
          new Map<
            string,
            {
              name: string;
              description:
                | string
                | null;
              item_key:
                | string
                | null;
            }
          >();

        if (
          itemIds.length >
          0
        ) {
          const {
            data: items,
            error:
              itemErr,
          } =
            await gamingSupabaseAdmin
              .from(
                "shop_items",
              )
              .select(
                "item_id, name, description, item_key",
              )
              .in(
                "item_id",
                itemIds,
              );

          if (
            !itemErr &&
            items
          ) {
            itemMap =
              new Map(
                items.map(
                  (i) => [
                    String(
                      i.item_id,
                    ),
                    {
                      name: String(
                        i.name ??
                          "Item",
                      ),

                      description:
                        i.description ==
                        null
                          ? null
                          : String(
                              i.description,
                            ),

                      item_key:
                        i.item_key ==
                        null
                          ? null
                          : String(
                              i.item_key,
                            ),
                    },
                  ],
                ),
              );
          }
        }

        const inventory =
          rows.map(
            (r) => {
              const meta =
                itemMap.get(
                  String(
                    r.item_id,
                  ),
                );

              return {
                inventory_id:
                  String(
                    r.inventory_id,
                  ),

                item_id:
                  String(
                    r.item_id,
                  ),

                quantity:
                  Number(
                    r.quantity ??
                      0,
                  ),

                equipped:
                  Boolean(
                    r.equipped,
                  ),

                purchased_at:
                  r.purchased_at ==
                  null
                    ? null
                    : String(
                        r.purchased_at,
                      ),

                item_name:
                  meta?.name ??
                  null,

                item_description:
                  meta?.description ??
                  null,

                item_key:
                  meta?.item_key ??
                  null,
              };
            },
          );

        return {
          success: true,
          inventory,
        };
      },
    );

/* =========================================================
   COIN TRANSACTIONS
========================================================= */

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

export const getCoinTransactions =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .handler(
      async ({
        context,
      }) => {
        const userId =
          context.userId;

        const {
          data,
          error,
        } =
          await gamingSupabaseAdmin
            .from(
              "coin_transactions",
            )
            .select(
              "transaction_id, user_id, amount, transaction_type, reason, match_id, transfer_id, purchase_id, sender_id, recipient_id, metadata, created_at",
            )
            .eq(
              "user_id",
              userId,
            )
            .order(
              "created_at",
              {
                ascending:
                  false,
              },
            )
            .limit(50);

        if (error) {
          console.error(
            "coin_transactions error:",
            error,
          );

          throw new Error(
            "Unable to load transactions",
          );
        }

        const transactions =
          (
            data ??
            []
          ).map(
            (t) => ({
              transaction_id:
                String(
                  t.transaction_id,
                ),

              amount:
                Number(
                  t.amount ?? 0,
                ),

              transaction_type:
                t.transaction_type ==
                null
                  ? null
                  : String(
                      t.transaction_type,
                    ),

              reason:
                t.reason ==
                null
                  ? null
                  : String(
                      t.reason,
                    ),

              match_id:
                t.match_id ==
                null
                  ? null
                  : String(
                      t.match_id,
                    ),

              transfer_id:
                t.transfer_id ==
                null
                  ? null
                  : String(
                      t.transfer_id,
                    ),

              purchase_id:
                t.purchase_id ==
                null
                  ? null
                  : String(
                      t.purchase_id,
                    ),

              sender_id:
                t.sender_id ==
                null
                  ? null
                  : String(
                      t.sender_id,
                    ),

              recipient_id:
                t.recipient_id ==
                null
                  ? null
                  : String(
                      t.recipient_id,
                    ),

              created_at:
                t.created_at ==
                null
                  ? null
                  : String(
                      t.created_at,
                    ),
            }),
          );

        return {
          success: true,
          transactions,
        };
      },
    );

/* =========================================================
   PUBLIC GAMING PROFILE
========================================================= */

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

export const getPublicGamingProfile =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (
        input: GetPublicGamingProfileInput,
      ) => {
        if (
          !input ||
          typeof input !==
            "object" ||
          !input.userId
        ) {
          throw new Error(
            "User ID is required",
          );
        }

        return {
          userId:
            input.userId,
        };
      },
    )
    .handler(async ({ data }) => {
      const userId = data.userId;

      /*
       * Same tables as getGamingWallet (already works for Shop):
       * gaming_profiles + gaming_stats + gaming_streaks.
       * Do not rely on public_gaming_profiles view alone.
       */
      const [profileResult, statsResult, streakResult] =
        await Promise.all([
          gamingSupabaseAdmin
            .from("gaming_profiles")
            .select("user_id, total_xp, current_level")
            .eq("user_id", userId)
            .maybeSingle(),
          gamingSupabaseAdmin
            .from("gaming_stats")
            .select(
              "user_id, games_played, wins, losses, draws, bot_games, real_user_games",
            )
            .eq("user_id", userId)
            .maybeSingle(),
          gamingSupabaseAdmin
            .from("gaming_streaks")
            .select("user_id, current_streak, longest_streak")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

      if (profileResult.error) {
        console.warn(
          "getPublicGamingProfile profile:",
          profileResult.error.message,
        );
      }
      if (statsResult.error) {
        console.warn(
          "getPublicGamingProfile stats:",
          statsResult.error.message,
        );
      }
      if (streakResult.error) {
        console.warn(
          "getPublicGamingProfile streaks:",
          streakResult.error.message,
        );
      }

      const profileRow = profileResult.data;
      if (!profileRow) {
        return {
          success: true,
          profile: null,
        };
      }

      const stats = statsResult.data;
      const streak = streakResult.data;

      const gamesPlayed = Number(stats?.games_played ?? 0) || 0;
      const wins = Number(stats?.wins ?? 0) || 0;
      const winRate =
        gamesPlayed > 0
          ? Math.round((wins / gamesPlayed) * 10000) / 100
          : 0;

      const profile: PublicGamingProfile = {
        user_id: String(profileRow.user_id ?? userId),
        total_xp: Number(profileRow.total_xp ?? 0) || 0,
        current_level: Number(profileRow.current_level ?? 1) || 1,
        games_played: gamesPlayed,
        wins,
        losses: Number(stats?.losses ?? 0) || 0,
        draws: Number(stats?.draws ?? 0) || 0,
        bot_games: Number(stats?.bot_games ?? 0) || 0,
        real_user_games: Number(stats?.real_user_games ?? 0) || 0,
        win_rate: winRate,
        current_streak: Number(streak?.current_streak ?? 0) || 0,
        longest_streak: Number(streak?.longest_streak ?? 0) || 0,
      };

      return {
        success: true,
        profile,
      };
    });

/* =========================================================
 * SHOP COSMETIC EQUIP / LOAD
 *
 * IMPORTANT:
 * - Purchase system is untouched.
 * - X Coins system is untouched.
 * - Game rewards are untouched.
 * - Transfers are untouched.
 * - Supabase remains the source of ownership.
 * - The frontend can then store the selected appearance
 *   locally in IndexedDB/localStorage.
 * ========================================================= */

export type ShopCosmeticType =
  | "theme"
  | "wallpaper"
  | "bubble"
  | "sticker_pack"
  | "profile_frame"
  | "badge";

export type EquippedShopCosmetic = {
  item_id: string;
  item_key: string | null;
  name: string;
  description: string | null;
  cosmetic_type: ShopCosmeticType;
  metadata: Record<string, unknown>;
};

function getCosmeticType(
  metadata: unknown,
): ShopCosmeticType | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const value = (metadata as Record<string, unknown>)
    ['cosmetic_type'];

  if (
    value === "theme" ||
    value === "wallpaper" ||
    value === "bubble" ||
    value === "sticker_pack" ||
    value === "profile_frame" ||
    value === "badge"
  ) {
    return value;
  }

  return null;
}

/**
 * Equip a purchased Shop cosmetic.
 *
 * The user can ONLY equip an item that belongs to them.
 *
 * We don't require a new Supabase RPC for this.
 * The authenticated server function uses the existing
 * service-role client after checking ownership.
 */
export type EquipShopItemInput = {
  itemId: string;
};

export const equipShopItem = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EquipShopItemInput) => {
    if (
      !input ||
      typeof input !== "object" ||
      !input.itemId
    ) {
      throw new Error("Item ID is required");
    }

    return {
      itemId: String(input.itemId),
    };
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    /*
     * First get the inventory record.
     *
     * This is the ownership check.
     */
    const {
      data: inventoryRow,
      error: inventoryError,
    } = await gamingSupabaseAdmin
      .from("user_inventory")
      .select(
        "inventory_id, user_id, item_id, equipped, quantity",
      )
      .eq("user_id", userId)
      .eq("item_id", data.itemId)
      .maybeSingle();

    if (inventoryError) {
      console.error(
        "Failed to check cosmetic ownership:",
        inventoryError,
      );

      throw new Error(
        "Unable to check cosmetic ownership",
      );
    }

    if (!inventoryRow) {
      throw new Error(
        "You do not own this cosmetic",
      );
    }

    /*
     * Get the Shop item and its metadata.
     */
    const {
      data: item,
      error: itemError,
    } = await gamingSupabaseAdmin
      .from("shop_items")
      .select(
        "item_id, item_key, name, description, metadata, available",
      )
      .eq("item_id", data.itemId)
      .maybeSingle();

    if (itemError) {
      console.error(
        "Failed to load Shop cosmetic:",
        itemError,
      );

      throw new Error(
        "Unable to load cosmetic",
      );
    }

    if (!item) {
      throw new Error("Shop item not found");
    }

    const cosmeticType =
      getCosmeticType(item.metadata);

    if (!cosmeticType) {
      throw new Error(
        "This Shop item is not a usable cosmetic",
      );
    }

    /*
     * Find all cosmetics owned by this user.
     *
     * We only change equipped state for the same
     * cosmetic type.
     */
    const {
      data: ownedRows,
      error: ownedError,
    } = await gamingSupabaseAdmin
      .from("user_inventory")
      .select(
        "inventory_id, item_id",
      )
      .eq("user_id", userId);

    if (ownedError) {
      console.error(
        "Failed to load cosmetic inventory:",
        ownedError,
      );

      throw new Error(
        "Unable to load cosmetic inventory",
      );
    }

    const ownedItemIds = Array.from(
      new Set(
        (ownedRows ?? [])
          .map((row) => String(row.item_id))
          .filter(Boolean),
      ),
    );

    /*
     * Determine which owned items belong to this
     * cosmetic category.
     */
    let sameTypeItemIds: string[] = [];

    if (ownedItemIds.length > 0) {
      const {
        data: ownedItems,
        error: ownedItemsError,
      } = await gamingSupabaseAdmin
        .from("shop_items")
        .select(
          "item_id, metadata",
        )
        .in(
          "item_id",
          ownedItemIds,
        );

      if (ownedItemsError) {
        console.error(
          "Failed to load owned cosmetics:",
          ownedItemsError,
        );

        throw new Error(
          "Unable to load owned cosmetics",
        );
      }

      sameTypeItemIds = (ownedItems ?? [])
        .filter(
          (ownedItem) =>
            getCosmeticType(
              ownedItem.metadata,
            ) === cosmeticType,
        )
        .map((ownedItem) =>
          String(ownedItem.item_id),
        );
    }

    /*
     * Unequip the previous cosmetic of this type.
     *
     * Example:
     *
     * Equipping a new wallpaper should not affect
     * bubbles, themes, stickers, etc.
     */
    if (sameTypeItemIds.length > 0) {
      const {
        error: clearError,
      } = await gamingSupabaseAdmin
        .from("user_inventory")
        .update({
          equipped: false,
        })
        .eq("user_id", userId)
        .in(
          "item_id",
          sameTypeItemIds,
        );

      if (clearError) {
        console.error(
          "Failed to clear previous cosmetic:",
          clearError,
        );

        throw new Error(
          "Unable to equip cosmetic",
        );
      }
    }

    /*
     * Equip the requested item.
     */
    const {
      error: equipError,
    } = await gamingSupabaseAdmin
      .from("user_inventory")
      .update({
        equipped: true,
      })
      .eq("user_id", userId)
      .eq("item_id", data.itemId);

    if (equipError) {
      console.error(
        "Failed to equip cosmetic:",
        equipError,
      );

      throw new Error(
        "Unable to equip cosmetic",
      );
    }

    return {
      success: true,

      equipped: {
        item_id: String(item.item_id),

        item_key:
          item.item_key == null
            ? null
            : String(item.item_key),

        name:
          String(
            item.name ?? "Cosmetic",
          ),

        description:
          item.description == null
            ? null
            : String(item.description),

        cosmetic_type:
          cosmeticType,

        metadata:
          item.metadata &&
          typeof item.metadata === "object"
            ? item.metadata as Record<
                string,
                unknown
              >
            : {},
      } satisfies EquippedShopCosmetic,
    };
  });

/**
 * Load every equipped Shop cosmetic owned by
 * the authenticated user.
 *
 * The frontend uses this once when the chat/app
 * loads, then stores the appearance locally.
 */

/**
 * Unequip a Shop cosmetic the user owns.
 * Clears equipped flag on that inventory row only.
 * Does not affect purchase, wallet, or other types.
 */
export type UnequipShopItemInput = {
  itemId: string;
};

export const unequipShopItem = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UnequipShopItemInput) => {
    if (
      !input ||
      typeof input !== "object" ||
      !input.itemId
    ) {
      throw new Error("Item ID is required");
    }

    return {
      itemId: String(input.itemId),
    };
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const {
      data: inventoryRow,
      error: inventoryError,
    } = await gamingSupabaseAdmin
      .from("user_inventory")
      .select(
        "inventory_id, user_id, item_id, equipped",
      )
      .eq("user_id", userId)
      .eq("item_id", data.itemId)
      .maybeSingle();

    if (inventoryError) {
      console.error(
        "Failed to check cosmetic ownership for unequip:",
        inventoryError,
      );

      throw new Error(
        "Unable to unequip cosmetic",
      );
    }

    if (!inventoryRow) {
      throw new Error(
        "You do not own this cosmetic",
      );
    }

    const {
      data: item,
      error: itemError,
    } = await gamingSupabaseAdmin
      .from("shop_items")
      .select(
        "item_id, metadata",
      )
      .eq("item_id", data.itemId)
      .maybeSingle();

    if (itemError) {
      console.error(
        "Failed to load Shop item for unequip:",
        itemError,
      );

      throw new Error(
        "Unable to unequip cosmetic",
      );
    }

    const cosmeticType = getCosmeticType(
      item?.metadata,
    );

    const {
      error: unequipError,
    } = await gamingSupabaseAdmin
      .from("user_inventory")
      .update({
        equipped: false,
      })
      .eq("user_id", userId)
      .eq("item_id", data.itemId);

    if (unequipError) {
      console.error(
        "Failed to unequip cosmetic:",
        unequipError,
      );

      throw new Error(
        "Unable to unequip cosmetic",
      );
    }

    return {
      success: true,
      itemId: data.itemId,
      cosmetic_type: cosmeticType,
    };
  });


export const getEquippedShopCosmetics =
  createServerFn({
    method: "POST",
  })
    .middleware([requireSupabaseAuth])
    .handler(async ({ context }) => {
      const userId = context.userId;

      const {
        data: inventoryRows,
        error: inventoryError,
      } = await gamingSupabaseAdmin
        .from("user_inventory")
        .select(
          "item_id, equipped",
        )
        .eq("user_id", userId)
        .eq("equipped", true);

      if (inventoryError) {
        console.error(
          "Failed to load equipped cosmetics:",
          inventoryError,
        );

        throw new Error(
          "Unable to load equipped cosmetics",
        );
      }

      const itemIds = Array.from(
        new Set(
          (inventoryRows ?? [])
            .map((row) =>
              String(row.item_id),
            )
            .filter(Boolean),
        ),
      );

      if (itemIds.length === 0) {
        return {
          success: true,
          cosmetics: [],
        };
      }

      const {
        data: items,
        error: itemsError,
      } = await gamingSupabaseAdmin
        .from("shop_items")
        .select(
          "item_id, item_key, name, description, metadata",
        )
        .in(
          "item_id",
          itemIds,
        );

      if (itemsError) {
        console.error(
          "Failed to load equipped Shop items:",
          itemsError,
        );

        throw new Error(
          "Unable to load equipped cosmetics",
        );
      }

      const cosmetics: EquippedShopCosmetic[] =
        (items ?? [])
          .map((item) => {
            const cosmeticType =
              getCosmeticType(
                item.metadata,
              );

            if (!cosmeticType) {
              return null;
            }

            return {
              item_id:
                String(item.item_id),

              item_key:
                item.item_key == null
                  ? null
                  : String(item.item_key),

              name:
                String(
                  item.name ??
                    "Cosmetic",
                ),

              description:
                item.description == null
                  ? null
                  : String(
                      item.description,
                    ),

              cosmetic_type:
                cosmeticType,

              metadata:
                item.metadata &&
                typeof item.metadata ===
                  "object"
                  ? item.metadata as Record<
                      string,
                      unknown
                    >
                  : {},
            };
          })
          .filter(
            (
              item,
            ): item is EquippedShopCosmetic =>
              item !== null,
          );

      return {
        success: true,
        cosmetics,
      };
    });


/* =========================================================
   GIFTS & COLLECTIBLES
   Bridge to existing gift tables / RPCs on the gaming DB.
   Uses the same client pattern as shop_items (no schema() prefix),
   because shop/inventory already work that way on this project.
========================================================= */

export type GiftDefinition = {
  gift_id: string;
  gift_key: string;
  name: string;
  value_x_coins: number;
  convertible: boolean;
  conversion_bps: number;
  limited: boolean;
  max_supply: number | null;
  metadata: Record<string, unknown> | null;
  available: boolean;
};

export type GiftCollectible = {
  collectible_id: string;
  gift_id: string;
  owner_id: string;
  sender_id: string | null;
  serial_number: number | null;
  serial_total: number | null;
  status: string;
  received_at: string | null;
  converted_at: string | null;
  featured: boolean;
  metadata: Record<string, unknown> | null;
  gift_name?: string | null;
  gift_key?: string | null;
  value_x_coins?: number | null;
  limited?: boolean | null;
  personal_message?: string | null;
};

export type SendGiftInput = {
  recipientId: string;
  giftId: string;
  message?: string | null;
  chatMessageId?: string | null;
  idempotencyKey: string;
};

function mapGiftDefinition(row: Record<string, unknown>): GiftDefinition {
  return {
    gift_id: String(row['gift_id'] ?? ""),
    gift_key: String(row['gift_key'] ?? ""),
    name: String(row['name'] ?? "Gift"),
    value_x_coins: Number(row['value_x_coins'] ?? 0) || 0,
    convertible: Boolean(row['convertible'] ?? true),
    conversion_bps: Number(row['conversion_bps'] ?? 8000) || 8000,
    limited: Boolean(row['limited'] ?? false),
    max_supply:
      row['max_supply'] == null ? null : Number(row['max_supply']) || null,
    metadata:
      row['metadata'] && typeof row['metadata'] === "object"
        ? (row['metadata'] as Record<string, unknown>)
        : null,
    available: Boolean(row['available'] ?? true),
  };
}

function mapCollectible(row: Record<string, unknown>): GiftCollectible {
  const gift =
    (row['gift_definitions'] as Record<string, unknown> | undefined) ||
    (row['gift'] as Record<string, unknown> | undefined);

  return {
    collectible_id: String(row['collectible_id'] ?? ""),
    gift_id: String(row['gift_id'] ?? ""),
    owner_id: String(row['owner_id'] ?? ""),
    sender_id: row['sender_id'] == null ? null : String(row['sender_id']),
    serial_number:
      row['serial_number'] == null ? null : Number(row['serial_number']),
    serial_total:
      row['serial_total'] == null ? null : Number(row['serial_total']),
    status: String(row['status'] ?? "owned"),
    received_at: row['received_at'] == null ? null : String(row['received_at']),
    converted_at:
      row['converted_at'] == null ? null : String(row['converted_at']),
    featured: Boolean(row['featured'] ?? false),
    metadata:
      row['metadata'] && typeof row['metadata'] === "object"
        ? (row['metadata'] as Record<string, unknown>)
        : null,
    gift_name: gift?.['name'] == null ? null : String(gift['name']),
    gift_key: gift?.['gift_key'] == null ? null : String(gift['gift_key']),
    value_x_coins:
      gift?.['value_x_coins'] == null
        ? null
        : Number(gift['value_x_coins']) || null,
    limited: gift?.['limited'] == null ? null : Boolean(gift['limited']),
    personal_message: null,
  };
}

function isAuthUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function friendlyGiftError(error: { message?: string } | null): string {
  const raw = (error?.message ?? "").toLowerCase();
  if (raw.includes("insufficient") || raw.includes("balance")) {
    return "Not enough X Coins";
  }
  if (raw.includes("sold out") || raw.includes("supply")) {
    return "This limited gift is sold out";
  }
  if (raw.includes("unavailable") || raw.includes("not available")) {
    return "This gift is unavailable";
  }
  if (raw.includes("already converted")) {
    return "This collectible was already converted";
  }
  if (raw.includes("not own") || raw.includes("ownership")) {
    return "You do not own this collectible";
  }
  if (raw.includes("recipient")) {
    return "Invalid recipient";
  }
  if (raw.includes("duplicate") || raw.includes("idempoten")) {
    return "This gift was already sent";
  }
  if (raw.includes("permission denied")) {
    return "Permission denied on gift tables — grant SELECT to service_role on the gaming database";
  }
  if (raw.includes("does not exist") || raw.includes("schema cache")) {
    return "Gift table was not found on the gaming database";
  }
  return error?.message || "Gift request failed";
}

/**
 * Load gift catalog.
 * Tries public tables first (same as shop_items), then gaming schema.
 */
async function fetchGiftDefinitions(): Promise<GiftDefinition[]> {
  const selectCols =
    "gift_id, gift_key, name, value_x_coins, convertible, conversion_bps, limited, max_supply, metadata, available";

  // 1) Same pattern as shop_items / user_inventory
  {
    const { data, error } = await gamingSupabaseAdmin
      .from("gift_definitions")
      .select(selectCols)
      .order("value_x_coins", { ascending: true });

    if (!error) {
      const rows = (data ?? []) as Record<string, unknown>[];
      const mapped = rows.map(mapGiftDefinition);
      const available = mapped.filter((g) => g.available !== false);
      return available.length > 0 ? available : mapped;
    }

    console.warn("gift_definitions (public):", error.message);
  }

  // 2) Explicit gaming schema (if tables live there only)
  {
    const { data, error } = await gamingSupabaseAdmin
      .schema("gaming")
      .from("gift_definitions")
      .select(selectCols)
      .order("value_x_coins", { ascending: true });

    if (!error) {
      const rows = (data ?? []) as Record<string, unknown>[];
      const mapped = rows.map(mapGiftDefinition);
      const available = mapped.filter((g) => g.available !== false);
      return available.length > 0 ? available : mapped;
    }

    console.error("gift_definitions (gaming schema):", error);
    throw new Error(friendlyGiftError(error));
  }
}

export const getGiftCatalog = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const gifts = await fetchGiftDefinitions();
    return { gifts };
  });

export const getMyCollectibles = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const selectCols =
      "collectible_id, gift_id, owner_id, sender_id, serial_number, serial_total, status, received_at, converted_at, featured, metadata";

    let rows: Record<string, unknown>[] | null = null;
    let lastMessage = "";

    for (const useSchema of [true, false] as const) {
      const client = useSchema
        ? gamingSupabaseAdmin.schema("gaming")
        : gamingSupabaseAdmin;

      const plain = await client
        .from("gift_collectibles")
        .select(selectCols)
        .eq("owner_id", userId)
        .order("received_at", { ascending: false });

      if (plain.error) {
        lastMessage = plain.error.message || lastMessage;
        continue;
      }

      rows = (plain.data ?? []) as Record<string, unknown>[];

      const giftIds = [
        ...new Set(
          rows.map((r) => String(r['gift_id'] ?? "")).filter(Boolean),
        ),
      ];

      if (giftIds.length > 0) {
        const defs = await client
          .from("gift_definitions")
          .select("gift_id, name, gift_key, value_x_coins, limited")
          .in("gift_id", giftIds);

        if (!defs.error && defs.data) {
          const map = new Map<string, Record<string, unknown>>();
          for (const d of defs.data as Record<string, unknown>[]) {
            map.set(String(d['gift_id']), d);
          }
          rows = rows.map((row) => {
            const def = map.get(String(row['gift_id'] ?? ""));
            return def ? { ...row, gift_definitions: def } : row;
          });
        }
      }
      break;
    }

    if (rows == null) {
      throw new Error(lastMessage || "Unable to load collectibles");
    }

    return {
      collectibles: rows.map((row) => mapCollectible(row)),
    };
  });

export const getFeaturedCollectible = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("User ID is required");
    return { userId: String(input.userId) };
  })
  .handler(async ({ data }) => {
    const trySettings = async (useSchema: boolean) => {
      const client = useSchema
        ? gamingSupabaseAdmin.schema("gaming")
        : gamingSupabaseAdmin;
      return client
        .from("user_gift_settings")
        .select("featured_collectible_id")
        .eq("user_id", data.userId)
        .maybeSingle();
    };

    let settingsRes = await trySettings(false);
    if (settingsRes.error) {
      settingsRes = await trySettings(true);
    }

    if (settingsRes.error || !settingsRes.data?.featured_collectible_id) {
      return { featured: null as GiftCollectible | null };
    }

    const featuredId = settingsRes.data.featured_collectible_id;

    let rowRes = await gamingSupabaseAdmin
      .from("gift_collectibles")
      .select(
        "collectible_id, gift_id, owner_id, sender_id, serial_number, serial_total, status, received_at, converted_at, featured, metadata",
      )
      .eq("collectible_id", featuredId)
      .maybeSingle();

    if (rowRes.error) {
      rowRes = await gamingSupabaseAdmin
        .schema("gaming")
        .from("gift_collectibles")
        .select(
          "collectible_id, gift_id, owner_id, sender_id, serial_number, serial_total, status, received_at, converted_at, featured, metadata",
        )
        .eq("collectible_id", featuredId)
        .maybeSingle();
    }

    if (rowRes.error || !rowRes.data) {
      return { featured: null as GiftCollectible | null };
    }

    return {
      featured: mapCollectible(rowRes.data as Record<string, unknown>),
    };
  });

export const sendGift = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SendGiftInput) => {
    if (!input?.recipientId) throw new Error("Recipient is required");
    if (!input?.giftId) throw new Error("Gift is required");
    if (!input?.idempotencyKey) {
      throw new Error("Idempotency key is required");
    }
    return {
      recipientId: String(input.recipientId).trim(),
      giftId: String(input.giftId),
      message: input.message ? String(input.message) : null,
      chatMessageId: input.chatMessageId
        ? String(input.chatMessageId)
        : null,
      idempotencyKey: String(input.idempotencyKey),
    };
  })
  .handler(async ({ data, context }) => {
    const actorId = context.userId;

    if (data.recipientId === actorId) {
      throw new Error("You cannot gift yourself");
    }

    // Same pattern as transfer_x_coins — pass sender id (service role has no auth.uid())
    const withSender = {
      p_recipient_id: data.recipientId,
      p_gift_id: data.giftId,
      p_message: data.message,
      p_chat_message_id: data.chatMessageId,
      p_idempotency_key: data.idempotencyKey,
      p_sender_id: actorId,
    };

    let result = await gamingSupabaseAdmin.rpc("send_gift", withSender);

    if (result.error) {
      result = await gamingSupabaseAdmin
        .schema("gaming")
        .rpc("send_gift", withSender);
    }

    if (result.error) {
      const withoutSender = {
        p_recipient_id: data.recipientId,
        p_gift_id: data.giftId,
        p_message: data.message,
        p_chat_message_id: data.chatMessageId,
        p_idempotency_key: data.idempotencyKey,
      };
      result = await gamingSupabaseAdmin.rpc("send_gift", withoutSender);
      if (result.error) {
        result = await gamingSupabaseAdmin
          .schema("gaming")
          .rpc("send_gift", withoutSender);
      }
    }

    if (result.error) {
      console.error("send_gift:", result.error, {
        recipientId: data.recipientId,
        senderId: actorId,
      });
      throw new Error(friendlyGiftError(result.error));
    }

    return {
      success: true,
      result: result.data,
    };
  });

export const convertGift = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { collectibleId: string }) => {
    if (!input?.collectibleId) {
      throw new Error("Collectible ID is required");
    }
    return { collectibleId: String(input.collectibleId) };
  })
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    const argVariants = [
      { p_collectible_id: data.collectibleId, p_user_id: actorId },
      { p_collectible_id: data.collectibleId, p_actor_id: actorId },
      { p_collectible_id: data.collectibleId, p_owner_id: actorId },
      { p_collectible_id: data.collectibleId },
    ];

    let lastError: { message?: string } | null = null;
    let resultData: unknown = null;

    for (const args of argVariants) {
      let result = await gamingSupabaseAdmin.rpc("convert_gift", args);
      if (result.error) {
        result = await gamingSupabaseAdmin
          .schema("gaming")
          .rpc("convert_gift", args);
      }
      if (!result.error) {
        resultData = result.data;
        lastError = null;
        break;
      }
      lastError = result.error;
      const msg = (result.error.message || "").toLowerCase();
      if (
        msg.includes("function") &&
        (msg.includes("not found") || msg.includes("does not exist"))
      ) {
        continue;
      }
      if (
        msg.includes("auth") ||
        msg.includes("authentication") ||
        msg.includes("not authenticated")
      ) {
        continue;
      }
      break;
    }

    if (lastError) {
      console.error("convert_gift:", lastError);
      throw new Error(friendlyGiftError(lastError));
    }

    return { success: true, result: resultData };
  });

export const setFeaturedGift = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { collectibleId: string | null }) => {
    return {
      collectibleId:
        input?.collectibleId == null
          ? null
          : String(input.collectibleId),
    };
  })
  .handler(async ({ data, context }) => {
    const actorId = context.userId;

    try {
      await gamingSupabaseAdmin.rpc("ensure_gaming_profile", {
        p_user_id: actorId,
      });
    } catch (err) {
      console.warn("ensure_gaming_profile before feature:", err);
    }

    const argVariants = [
      { p_collectible_id: data.collectibleId, p_user_id: actorId },
      { p_collectible_id: data.collectibleId, p_actor_id: actorId },
      { p_collectible_id: data.collectibleId },
    ];

    let lastError: { message?: string } | null = null;
    let resultData: unknown = null;
    let ok = false;

    for (const args of argVariants) {
      let result = await gamingSupabaseAdmin.rpc("set_featured_gift", args);
      if (result.error) {
        result = await gamingSupabaseAdmin
          .schema("gaming")
          .rpc("set_featured_gift", args);
      }
      if (!result.error) {
        resultData = result.data;
        ok = true;
        lastError = null;
        break;
      }
      lastError = result.error;
      const msg = (result.error.message || "").toLowerCase();
      if (
        (msg.includes("function") &&
          (msg.includes("not found") || msg.includes("does not exist"))) ||
        msg.includes("auth") ||
        msg.includes("authentication")
      ) {
        continue;
      }
      break;
    }

    // Direct upsert if RPC fails (e.g. auth.uid() null under service role)
    if (!ok) {
      const row = {
        user_id: actorId,
        featured_collectible_id: data.collectibleId,
      };

      let upsert = await gamingSupabaseAdmin
        .from("user_gift_settings")
        .upsert(row, { onConflict: "user_id" });

      if (upsert.error) {
        upsert = await gamingSupabaseAdmin
          .schema("gaming")
          .from("user_gift_settings")
          .upsert(row, { onConflict: "user_id" });
      }

      if (upsert.error) {
        console.error("set_featured_gift failed:", lastError, upsert.error);
        throw new Error(
          upsert.error.message ||
            lastError?.message ||
            "Could not feature collectible",
        );
      }

      resultData = { featured_collectible_id: data.collectibleId };
    }

    return { success: true, result: resultData };
  });
