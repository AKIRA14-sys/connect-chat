package app.xuppin.chat;

import com.getcapacitor.BridgeActivity;

/**
 * Plain BridgeActivity on purpose.
 *
 * Capacitor's own BridgeWebChromeClient already handles WebView permission
 * requests (CAMERA / RECORD_AUDIO runtime grant) AND the file chooser used
 * by <input type=file> gallery attachment. A custom WebChromeClient here
 * would replace it and silently break gallery picking, JS dialogs and
 * geolocation — so don't add one.
 */
public class MainActivity extends BridgeActivity {}
