import type { ExpoConfig } from "expo/config";

const env = {
  appName: "Nuenime",
  appSlug: "nuenime",
  logoUrl: "/manus-storage/icon_cc474f8c.png",
  scheme: "nuenime",
  iosBundleId: "tech.nuenime.app",
  androidPackage: "nuenime.anime.app",
  easProjectId: "e96fc02e-d968-4f13-a688-0d553d855df7",
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "0.0.6",
  orientation: "default",
  icon: "./assets/images/logo-app.png",
  scheme: env.scheme,
  userInterfaceStyle: "dark",
  // SDK 54 is the final Expo release that supports the proven legacy RN
  // architecture. Use it for the compatibility build after the new-architecture
  // APK terminated immediately on a Snapdragon 680 device.
  newArchEnabled: false,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    versionCode: 6,
    adaptiveIcon: { backgroundColor: "#0E0E11", foregroundImage: "./assets/images/logo-app.png" },
    edgeToEdgeEnabled: true,
    softwareKeyboardLayoutMode: "resize",
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS", "REQUEST_INSTALL_PACKAGES", "RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS"],
    intentFilters: [
      { action: "VIEW", autoVerify: true, data: [{ scheme: env.scheme, host: "auth" }], category: ["BROWSABLE", "DEFAULT"] },
      { action: "VIEW", data: [{ scheme: env.scheme, host: "anime", pathPattern: ".*" }], category: ["BROWSABLE", "DEFAULT"] },
      { action: "VIEW", autoVerify: true, data: [{ scheme: "https", host: "aniraku.tech", pathPrefix: "/anime/" }], category: ["BROWSABLE", "DEFAULT"] },
    ],
  },
  web: { bundler: "metro", output: "single", favicon: "./assets/images/logo-app.png" },
  plugins: [
    "expo-router",
    "expo-asset",
    "expo-audio",
    "expo-font",
    "expo-web-browser",
    ["react-native-video", { enableAndroidPictureInPicture: true }],
    ["expo-screen-orientation", { initialOrientation: "DEFAULT" }],
    ["expo-secure-store", { configureAndroidBackup: false }],
    ["expo-notifications", { icon: "./assets/images/logo-app.png", color: "#FF4D4D" }],
    ["expo-splash-screen", { image: "./assets/images/logo-app.png", imageWidth: 200, resizeMode: "contain", backgroundColor: "#0E0E11", dark: { backgroundColor: "#0E0E11" } }],
    ["expo-build-properties", {
      android: {
        buildArchs: ["armeabi-v7a", "arm64-v8a", "x86_64"],
        minSdkVersion: 28,
        usesCleartextTraffic: true,
      }
    }],
    "@react-native-google-signin/google-signin",
  ],
  // Keep file-route typing, but remove optional compiler/runtime experiments
  // from the compatibility build's startup path.
  experiments: { typedRoutes: true },
  extra: { eas: { projectId: env.easProjectId } },
};

export default config;
