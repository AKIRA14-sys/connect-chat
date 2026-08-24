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
