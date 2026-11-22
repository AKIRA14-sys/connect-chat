export const REWARDED_ADS_TEST_REWARD_XCOINS = 100_000;

export const REWARDED_ADS_TEST_NON_PRODUCTION_ENABLED =
  (!__REWARDED_ADS_VERCEL_PRODUCTION__ &&
    import.meta.env.MODE === "development" &&
    import.meta.env["VITE_REWARDED_ADS_TEST"] === "true") ||
  (import.meta.env.MODE === "production" && __REWARDED_ADS_TEST_PREVIEW__);

export const REWARDED_ADS_TEST_ENABLED =
  REWARDED_ADS_TEST_NON_PRODUCTION_ENABLED ||
  (import.meta.env.MODE === "production" && __REWARDED_ADS_TEST_PRODUCTION__);
