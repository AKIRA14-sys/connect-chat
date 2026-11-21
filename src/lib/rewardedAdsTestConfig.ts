export const REWARDED_ADS_TEST_REWARD_XCOINS = 100_000;

export const REWARDED_ADS_TEST_ENABLED =
  !__REWARDED_ADS_VERCEL_PRODUCTION__ &&
  ((import.meta.env.MODE === "development" &&
    import.meta.env["VITE_REWARDED_ADS_TEST"] === "true") ||
    (import.meta.env.MODE === "production" && __REWARDED_ADS_TEST_PREVIEW__));
