import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { LoaderCircle, Play, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestGoogleWebRewardedTestAd } from "@/lib/rewardedAdsTest";
import { RewardedAdsTestNative } from "@/lib/native/rewardedAdsTest";
import { REWARDED_ADS_TEST_ENABLED } from "@/lib/rewardedAdsTestConfig";

export function RewardedAdsTestPanel() {
  const [busy, setBusy] = useState(false);
  const [webReady, setWebReady] = useState(false);
  const [earned, setEarned] = useState(false);
  const [status, setStatus] = useState("No test ad requested.");
  const webShowRef = useRef<(() => void) | null>(null);
  const cancelWebRequestRef = useRef<(() => void) | null>(null);
  const isAndroid = Capacitor.getPlatform() === "android";

  useEffect(
    () => () => {
      cancelWebRequestRef.current?.();
    },
    [],
  );

  if (!REWARDED_ADS_TEST_ENABLED) return null;

  function startWebTestAd() {
    cancelWebRequestRef.current?.();
    webShowRef.current = null;
    setBusy(true);
    setWebReady(false);
    setEarned(false);
    setStatus("Requesting Google's web rewarded test ad…");

    cancelWebRequestRef.current = requestGoogleWebRewardedTestAd({
      onReady(show) {
        webShowRef.current = show;
        setWebReady(true);
        setBusy(false);
        setStatus("Test ad ready. Choose to watch it to continue.");
      },
      onReward() {
        setEarned(true);
        setStatus("Test reward earned — local test state only.");
      },
      onClosed(rewardWasEarned) {
        setBusy(false);
        setWebReady(false);
        webShowRef.current = null;
        if (!rewardWasEarned) {
          setStatus("Ad closed before the reward callback; no test reward earned.");
        }
      },
      onError(message) {
        setBusy(false);
        setWebReady(false);
        webShowRef.current = null;
        setStatus(message);
      },
    });
  }

  async function startAndroidTestAd() {
    setBusy(true);
    setEarned(false);
    setStatus("Loading Google's Android rewarded test ad…");
    try {
      const result = await RewardedAdsTestNative.showTestRewardedAd();
      if (result.earned) {
        setEarned(true);
        setStatus("Test reward earned — local test state only.");
      } else {
        setStatus("Ad closed before the reward callback; no test reward earned.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load the Android test ad.");
    } finally {
      setBusy(false);
    }
  }

  function resetTestState() {
    cancelWebRequestRef.current?.();
    cancelWebRequestRef.current = null;
    webShowRef.current = null;
    setBusy(false);
    setWebReady(false);
    setEarned(false);
    setStatus("No test ad requested.");
  }

  return (
    <div className="space-y-3 p-3">
      <p className="text-xs text-muted-foreground">
        Development only. Uses Google's sample test inventory. The reward is a temporary on-screen
        state; it is not saved, credited, or connected to chats, coins, or account data.
      </p>
      <div className="flex flex-wrap gap-2">
        {isAndroid ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => void startAndroidTestAd()}>
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Watch Android test ad
          </Button>
        ) : webReady ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              webShowRef.current?.();
              setWebReady(false);
              setBusy(true);
              setStatus("Test ad opened. Waiting for Google's reward callback…");
            }}
          >
            <Play className="h-4 w-4" /> Show web test ad
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={busy} onClick={startWebTestAd}>
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Load web test ad
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isAndroid && busy}
          onClick={resetTestState}
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
      </div>
      <p className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
        {earned ? <Sparkles className="h-4 w-4 text-primary" /> : null}
        {status}
      </p>
    </div>
  );
}
