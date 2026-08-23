import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gamingSupabaseAdmin } from "@/integrations/gaming-supabase/client.server";

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

export type TransferXCoinsInput = {
  recipientId: string;
  amount: number;
  idempotencyKey: string;
};

export type PurchaseShopItemInput = {
  itemId: string;
  idempotencyKey: string;
};

export type EquipCosmeticInput = {
  itemId: string;
};

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

export const completeGamingMatch = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const input = data as CompleteGamingMatchInput;
    const actorId = context.userId;

    if (!input?.matchId || !input?.gameType) {
      throw new Error(
        "Match ID and game type are required",
      );
    }

    if (!input.player1Id) {
      throw new Error("Player 1 is required");
    }

    if (
      actorId !== input.player1Id &&
      actorId !== input.player2Id
    ) {
      throw new Error(
        "You are not a participant in this match",
      );
    }

    if (
      !["win", "loss", "draw"].includes(
        input.result,
      )
    ) {
      throw new Error(
        "Invalid match result",
      );
    }

    const { data: result, error } =
      await gamingSupabaseAdmin.rpc(
        "record_match_for_user",
        {
          p_actor_id: actorId,
          p_match_id: input.matchId,
          p_game_type: input.gameType,
          p_player_1_id: input.player1Id,
          p_player_2_id:
            input.player2Id ?? null,
          p_is_bot: input.isBot,
          p_winner_id:
            input.winnerId ?? null,
          p_loser_id:
            input.loserId ?? null,
          p_result: input.result,
        },
      );

    if (error) {
      console.error(
        "Failed to record gaming match:",
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
  });

export const transferXCoins = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const input = data as TransferXCoinsInput;

    if (!input?.recipientId) {
      throw new Error(
        "Recipient is required",
      );
    }

    if (
      !Number.isSafeInteger(input.amount) ||
      input.amount <= 0
    ) {
      throw new Error(
        "Coin amount must be a positive whole number",
      );
    }

    if (!input.idempotencyKey) {
      throw new Error(
        "Idempotency key is required",
      );
    }

    if (
      input.recipientId ===
      context.userId
    ) {
      throw new Error(
        "You cannot send X Coins to yourself",
      );
    }

    const { data: result, error } =
      await gamingSupabaseAdmin.rpc(
        "transfer_x_coins",
        {
          p_sender_id: context.userId,
          p_recipient_id:
            input.recipientId,
          p_amount: input.amount,
          p_idempotency_key:
            input.idempotencyKey,
        },
      );

    if (error) {
      console.error(
        "Failed to transfer X Coins:",
        error,
      );

      throw new Error(
        error.message ||
          "Unable to transfer X Coins",
      );
    }

    return {
      success: true,
      result,
    };
  });

export const purchaseShopItem = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const input =
      data as PurchaseShopItemInput;

    if (!input?.itemId) {
      throw new Error(
        "Shop item is required",
      );
    }

    if (!input.idempotencyKey) {
      throw new Error(
        "Idempotency key is required",
      );
    }

    const { data: result, error } =
      await gamingSupabaseAdmin.rpc(
        "purchase_shop_item",
        {
          p_user_id: context.userId,
          p_item_id: input.itemId,
          p_idempotency_key:
            input.idempotencyKey,
        },
      );

    if (error) {
      console.error(
        "Failed to purchase shop item:",
        error,
      );

      throw new Error(
        error.message ||
          "Unable to purchase shop item",
      );
    }

    return {
      success: true,
      result,
    };
  });

export const equipCosmetic = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const input =
      data as EquipCosmeticInput;

    if (!input?.itemId) {
      throw new Error(
        "Cosmetic item is required",
      );
    }

    const { data: result, error } =
      await gamingSupabaseAdmin.rpc(
        "equip_cosmetic",
        {
          p_user_id: context.userId,
          p_item_id: input.itemId,
        },
      );

    if (error) {
      console.error(
        "Failed to equip cosmetic:",
        error,
      );

      throw new Error(
        error.message ||
          "Unable to equip cosmetic",
      );
    }

    return {
      success: true,
      result,
    };
  });