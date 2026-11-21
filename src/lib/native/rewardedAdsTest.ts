import { registerPlugin } from "@capacitor/core";

export interface RewardedAdsTestPlugin {
  showTestRewardedAd(): Promise<{ earned: boolean }>;
}

export const RewardedAdsTestNative = registerPlugin<RewardedAdsTestPlugin>("RewardedAdsTest");
