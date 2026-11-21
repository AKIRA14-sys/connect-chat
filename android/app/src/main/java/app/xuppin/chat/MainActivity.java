package app.xuppin.chat;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * Capacitor's own BridgeWebChromeClient handles WebView permissions and file
 * picking. Keep it intact; only register the local, test-only ads plugin here.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RewardedAdsTestPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
