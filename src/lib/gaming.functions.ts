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

export const ensureGamingProfile = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;

    const { data, error } = await gamingSupabaseAdmin.rpc(
      "ensure_gaming_profile",
      { p_user_id: userId },
    );

    if (error) {
      console.error("Failed to ensure gaming profile:", error);
      throw new Error("Unable to create gaming profile");
    }

    return { success: true, profile: data };
  });

export const startGamingMatch = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StartGamingMatchInput) => {
    if (!input || typeof input !== "object") {
      throw new Error("Invalid match input");
    }
    if (!input.matchId || !input.gameType) {
      throw new Error("Match ID and game type are required");
    }
    if (input.player2Id && input.player2Id === input.matchId) {
      throw new Error("Invalid player ID");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const actorId = context.userId;

    if (!data.isBot && !data.player2Id) {
      throw new Error("Real-user matches require player 2");
    }

    if (!data.isBot && data.player2Id === actorId) {
      throw new Error("A player cannot play against themselves");
    }

    const { data: result, error } = await gamingSupabaseAdmin.rpc(
      "start_game_match_session",
      {
        p_user_id: actorId,
        p_match_id: data.matchId,
        p_game_type: data.gameType,
        p_player_2_id: data.isBot ? null : data.player2Id ?? null,
        p_is_bot: data.isBot,
        p_client_state_hash: null,
      },
    );

    if (error) {
      console.error("Failed to start gaming match:", error);
      throw new Error(error.message || "Unable to start game");
    }

    return { success: true, session: result };
  });

export const completeGamingMatch = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CompleteGamingMatchInput) => {
    if (!input || typeof input !== "object") {
      throw new Error("Invalid match input");
    }
    if (!input.matchId || !input.gameType || !input.player1Id) {
      throw new Error("Match information is incomplete");
    }
    if (!["win", "loss", "draw"].includes(input.result)) {
      throw new Error("Invalid match result");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const actorId = context.userId;

    if (actorId !== data.player1Id && actorId !== data.player2Id) {
      throw new Error("You are not a participant in this match");
    }

    const { data: result, error } = await gamingSupabaseAdmin.rpc(
      "complete_game_match_and_reward",
      {
        p_user_id: actorId,
        p_match_id: data.matchId,
        p_game_type: data.gameType,
        p_player_1_id: data.player1Id,
        p_player_2_id: data.player2Id ?? null,
        p_is_bot: data.isBot,
        p_winner_id: data.winnerId ?? null,
        p_loser_id: data.loserId ?? null,
        p_result: data.result,
      },
    );

    if (error) {
      console.error("Failed to complete gaming match:", error);
      throw new Error(error.message || "Unable to record game result");
    }

    return { success: true, result };
  });
