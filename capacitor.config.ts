import type { CapacitorConfig } from "@capacitor/cli";

/**
 * XUPPIN / WHATSXUP Capacitor config
 * Web UI stays the source of truth. Native only for Android capabilities.
 *
 * Package: change appId if you already registered another id.
 */
const config: CapacitorConfig = {
  appId: "app.xuppin.chat",
  appName: "XUPPIN",
  webDir: "dist",
  server: {
    // Production: serve bundled web assets (use OTA later for UI updates).
    // Dev only — uncomment to load a live URL:
    // url: "https://YOUR-DEPLOYED-APP.example",
    // cleartext: true,
    androidScheme: "https",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      sound: "default",
    },
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: "#09090b",
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#09090b",
  },
};

export default config;
