export const REWARDED_ADS_TEST_ENABLED =
  import.meta.env.MODE === "development" && import.meta.env["VITE_REWARDED_ADS_TEST"] === "true";
