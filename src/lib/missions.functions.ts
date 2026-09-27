import { supabase } from "@/integrations/supabase/client";

export interface Mission {
  id: string;
  title: string;
  description: string;
  rewardCoins: number;
  category: "chat" | "social" | "shop" | "daily";
}

export const MISSIONS_LIST: Mission[] = [
  { id: "m1", title: "Daily Check-in", description: "Open WHATSXUP today", rewardCoins: 50, category: "daily" },
  { id: "m2", title: "Chat Explorer", description: "Send 5 messages in any chat", rewardCoins: 100, category: "chat" },
  { id: "m3", title: "Group Contributor", description: "Send a message in a group chat", rewardCoins: 80, category: "chat" },
  { id: "m4", title: "Voice Messenger", description: "Send a voice note in a conversation", rewardCoins: 120, category: "chat" },
  { id: "m5", title: "Media Sharer", description: "Share an image or video in chat", rewardCoins: 100, category: "chat" },
  { id: "m6", title: "XUP Post Master", description: "Post a XUP on your social feed", rewardCoins: 150, category: "social" },
  { id: "m7", title: "Social Butterfly", description: "Comment or reshare a post on XUPs", rewardCoins: 90, category: "social" },
  { id: "m8", title: "Generous Giver", description: "Send a gift to a friend", rewardCoins: 200, category: "shop" },
  { id: "m9", title: "Coin Transfer", description: "Transfer XCoins to another user", rewardCoins: 100, category: "shop" },
  { id: "m10", title: "Game Competitor", description: "Play a match in XupGames", rewardCoins: 150, category: "social" },
];

const LOCAL_COMPLETED_KEY = "whatsxup_user_completed_missions";

export function getCompletedMissionsCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(LOCAL_COMPLETED_KEY);
    if (!raw) return 0;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.length : Number(raw) || 0;
  } catch {
    return 0;
  }
}

export function recordCompletedMission(missionId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(LOCAL_COMPLETED_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    arr.push(missionId);
    localStorage.setItem(LOCAL_COMPLETED_KEY, JSON.stringify(arr));
    return arr.length;
  } catch {
    return 0;
  }
}

export async function checkAuraAccess(userId: string): Promise<{
  allowed: boolean;
  completedMissions: number;
  coins: number;
  requiredMissions: number;
  requiredCoins: number;
  isAdmin: boolean;
}> {
  const REQUIRED_MISSIONS = 50;
  const REQUIRED_COINS = 2000;

  try {
    // Check if user is Master Admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_master_admin, wallet_balance")
      .eq("id", userId)
      .maybeSingle();

    const isAdmin = Boolean(profile?.is_master_admin);
    const coins = Number(profile?.wallet_balance || 0);
    const completedMissions = getCompletedMissionsCount();

    if (isAdmin) {
      return {
        allowed: true,
        completedMissions,
        coins,
        requiredMissions: REQUIRED_MISSIONS,
        requiredCoins: REQUIRED_COINS,
        isAdmin: true,
      };
    }

    const allowed = completedMissions >= REQUIRED_MISSIONS && coins >= REQUIRED_COINS;

    return {
      allowed,
      completedMissions,
      coins,
      requiredMissions: REQUIRED_MISSIONS,
      requiredCoins: REQUIRED_COINS,
      isAdmin: false,
    };
  } catch {
    return {
      allowed: false,
      completedMissions: 0,
      coins: 0,
      requiredMissions: REQUIRED_MISSIONS,
      requiredCoins: REQUIRED_COINS,
      isAdmin: false,
    };
  }
}
