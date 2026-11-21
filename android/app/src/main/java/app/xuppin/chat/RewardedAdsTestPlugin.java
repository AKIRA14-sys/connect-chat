package app.xuppin.chat;

import android.app.Activity;
import android.content.Context;
import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.ads.mobile.sdk.MobileAds;
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback;
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest;
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError;
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError;
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationConfig;
import com.google.android.libraries.ads.mobile.sdk.rewarded.OnUserEarnedRewardListener;
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAd;
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAdEventCallback;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Test-only rewarded-ad bridge. Both identifiers below are Google's published
 * demo IDs; this plugin does not award or persist anything in app data.
 */
@CapacitorPlugin(name = "RewardedAdsTest")
public class RewardedAdsTestPlugin extends Plugin {
    private static final String TEST_APP_ID = "ca-app-pub-3940256099942544~3347511713";
    private static final String TEST_REWARDED_AD_UNIT_ID =
        "ca-app-pub-3940256099942544/5224354917";

    private final Object callLock = new Object();
    private PluginCall pendingCall;
    private volatile boolean sdkInitialized;
    private boolean sdkInitializationStarted;

    @PluginMethod
    public void showTestRewardedAd(PluginCall call) {
        synchronized (callLock) {
            if (pendingCall != null) {
                call.reject("A rewarded test ad is already in progress.");
                return;
            }
            pendingCall = call;
        }

        if (sdkInitialized) {
            loadAndShow(call);
            return;
        }

        synchronized (callLock) {
            if (sdkInitializationStarted) return;
            sdkInitializationStarted = true;
        }

        Context context = getContext();
        new Thread(() -> {
            try {
                MobileAds.initialize(
                    context,
                    new InitializationConfig.Builder(TEST_APP_ID).build(),
                    initializationStatus -> {
                        synchronized (callLock) {
                            sdkInitialized = true;
                        }
                        Activity activity = getActivity();
                        if (activity == null) {
                            rejectIfPending(call, "Android activity is no longer available.");
                            return;
                        }
                        activity.runOnUiThread(() -> loadAndShow(call));
                    }
                );
            } catch (Exception error) {
                synchronized (callLock) {
                    sdkInitializationStarted = false;
                }
                rejectIfPending(call, "Could not initialize Google's test ads: " + error.getMessage());
            }
        }).start();
    }

    private void loadAndShow(PluginCall call) {
        if (!isPending(call)) return;
        Activity activity = getActivity();
        if (activity == null) {
            rejectIfPending(call, "Android activity is no longer available.");
            return;
        }

        AdRequest request = new AdRequest.Builder(TEST_REWARDED_AD_UNIT_ID).build();
        RewardedAd.load(
            request,
            new AdLoadCallback<RewardedAd>() {
                @Override
                public void onAdLoaded(@NonNull RewardedAd ad) {
                    Activity currentActivity = getActivity();
                    if (currentActivity == null) {
                        rejectIfPending(call, "Android activity is no longer available.");
                        return;
                    }

                    AtomicBoolean earned = new AtomicBoolean(false);
                    AtomicBoolean completed = new AtomicBoolean(false);
                    ad.setAdEventCallback(
                        new RewardedAdEventCallback() {
                            @Override
                            public void onAdDismissedFullScreenContent() {
                                if (completed.compareAndSet(false, true)) {
                                    resolveIfPending(call, earned.get());
                                }
                            }

                            @Override
                            public void onAdFailedToShowFullScreenContent(
                                @NonNull FullScreenContentError error
                            ) {
                                if (completed.compareAndSet(false, true)) {
                                    rejectIfPending(call, "Could not show the Android test ad: " + error.getMessage());
                                }
                            }
                        }
                    );

                    currentActivity.runOnUiThread(() -> {
                        if (!isPending(call)) return;
                        try {
                            ad.show(
                                currentActivity,
                                (OnUserEarnedRewardListener) rewardItem -> {
                                    earned.set(true);
                                    if (completed.compareAndSet(false, true)) {
                                        resolveIfPending(call, true);
                                    }
                                }
                            );
                        } catch (Exception error) {
                            if (completed.compareAndSet(false, true)) {
                                rejectIfPending(call, "Could not show the Android test ad: " + error.getMessage());
                            }
                        }
                    });
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError error) {
                    rejectIfPending(call, "Could not load Google's Android test ad: " + error.getMessage());
                }
            }
        );
    }

    private boolean isPending(PluginCall call) {
        synchronized (callLock) {
            return pendingCall == call;
        }
    }

    private void resolveIfPending(PluginCall call, boolean earned) {
        synchronized (callLock) {
            if (pendingCall != call) return;
            pendingCall = null;
        }
        JSObject result = new JSObject();
        result.put("earned", earned);
        call.resolve(result);
    }

    private void rejectIfPending(PluginCall call, String message) {
        synchronized (callLock) {
            if (pendingCall != call) return;
            pendingCall = null;
        }
        call.reject(message);
    }
}
