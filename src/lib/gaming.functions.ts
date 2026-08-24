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
 * Ensures the gaming profile exists and then loads
 * the real profile, statistics and streak information.
 */
export const ensureGamingProfile = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;

    /*
     * First make sure all gaming rows exist.
     */
    const { error: ensureError } =
      await gamingSupabaseAdmin.rpc(
        "ensure_gaming_profile",
        {
          p_user_id: userId,
        },
      );

    if (ensureError) {
      console.error(
        "Failed to ensure gaming profile:",
        ensureError,
      );

      throw new Error(
        "Unable to create gaming profile",
      );
    }

    /*
     * IMPORTANT:
     *
     * These tables are in the PUBLIC schema.
     *
     * Do NOT use:
     * .schema("gaming")
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
            "created_at",
            "updated_at",
          ].join(","),
        )
        .eq("user_id", userId)
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
            "updated_at",
          ].join(","),
        )
        .eq("user_id", userId)
        .maybeSingle(),

      gamingSupabaseAdmin
        .from("gaming_streaks")
        .select(
          [
            "user_id",
            "current_streak",
            "longest_streak",
            "last_qualifying_date",
            "streak_start_date",
            "updated_at",
          ].join(","),
        )
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      console.error(
        "Failed to load gaming profile:",
        profileResult.error,
      );

      throw new Error(
        "Unable to load gaming profile",
      );
    }

    if (statsResult.error) {
      console.error(
        "Failed to load gaming stats:",
        statsResult.error,
      );

      throw new Error(
        "Unable to load gaming statistics",
      );
    }

    if (streakResult.error) {
      console.error(
        "Failed to load gaming streak:",
        streakResult.error,
      );

      throw new Error(
        "Unable to load gaming streak",
      );
    }

    const profile = profileResult.data;
    const stats = statsResult.data;
    const streak = streakResult.data;

    if (!profile) {
      throw new Error(
        "Gaming profile was not found",
      );
    }

    /*
     * Combine the three real database records
     * into one object for GamingDashboard.
     */
    return {
      success: true,

      profile: {
        ...profile,

        games_played:
          stats?.games_played ?? 0,

        wins:
          stats?.wins ?? 0,

        losses:
          stats?.losses ?? 0,

        draws:
          stats?.draws ?? 0,

        bot_games:
          stats?.bot_games ?? 0,

        real_user_games:
          stats?.real_user_games ?? 0,

        current_streak:
          streak?.current_streak ?? 0,

        longest_streak:
          streak?.longest_streak ?? 0,

        last_qualifying_date:
          streak?.last_qualifying_date ?? null,

        streak_start_date:
          streak?.streak_start_date ?? null,
      },
    };
  });

/**
 * Start a gaming match.
 *
 * This is kept compatible with the working
 * reward/game system.
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

      return input;
    },
  )
  .handler(async ({ data, context }) => {
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
  });

/**
 * Complete a gaming match and award
 * the appropriate X Coins / XP.
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
 * Reads the reward that was already recorded
 * for a completed match.
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

        /*
         * game_rewards is also in PUBLIC.
         */
        const {
          data: reward,
          error,
        } =
          await gamingSupabaseAdmin
            .from("game_rewards")
            .select(
              [
                "match_id",
                "user_id",
                "x_coins",
                "xp",
                "reward_type",
                "created_at",
              ].join(","),
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
        };
      },
    );