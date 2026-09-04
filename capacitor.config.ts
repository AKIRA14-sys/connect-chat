import type { CapacitorConfig } from "@capacitor/cli";

/**
 * XUPPIN / WHATSXUP Capacitor config
 * Web UI stays the source of truth. Native only for Android capabilities.
 */
const config: CapacitorConfig = {
  appId: "app.xuppin.chat",
  appName: "XUPPIN",
  webDir: ".output/public",
  server: {
    url: "https://xuppin.vercel.app",
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
