// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { env } from "node:process";

const isRewardedAdsTestPreview =
  env["VERCEL_ENV"] === "preview" && env["VERCEL_GIT_COMMIT_REF"] === "review/rewarded-ads-test";

export default defineConfig({
  vite: {
    define: {
      __REWARDED_ADS_TEST_PREVIEW__: JSON.stringify(isRewardedAdsTestPreview),
      __REWARDED_ADS_VERCEL_PRODUCTION__: JSON.stringify(env["VERCEL_ENV"] === "production"),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
