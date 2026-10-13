import { describe, it, expect, beforeEach, vi } from "vitest";

const { memoryStorage } = vi.hoisted(() => ({
  memoryStorage: new Map<string, string>(),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  DeviceEventEmitter: { emit: vi.fn(), addListener: vi.fn() },
  TurboModuleRegistry: { get: vi.fn(), getEnforcing: vi.fn() },
}));

vi.mock("expo-modules-core", () => ({
  EventEmitter: class {
    emit() {}
    addListener() {
      return { remove() {} };
    }
  },
  SharedObject: class {},
  SharedRef: class {},
  NativeModulesProxy: {},
  requireNativeModule: () => ({}),
  Platform: { OS: "ios" },
}));

vi.mock("expo-file-system", () => ({
  File: class {},
  Directory: class {},
  Paths: {},
}));

vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "/mock/cache/",
  getInfoAsync: vi.fn().mockResolvedValue({ exists: true, size: 1024 }),
  readDirectoryAsync: vi.fn().mockResolvedValue([]),
  deleteAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("expo-image", () => ({
  Image: {
    clearDiskCache: vi.fn().mockResolvedValue(undefined),
    clearMemoryCache: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => memoryStorage.get(key) ?? null),
    setItem: vi.fn(async (key: string, val: string) => {
      memoryStorage.set(key, String(val));
    }),
    removeItem: vi.fn(async (key: string) => {
      memoryStorage.delete(key);
    }),
    clear: vi.fn(async () => {
      memoryStorage.clear();
    }),
    getAllKeys: vi.fn(async () => Array.from(memoryStorage.keys())),
    multiRemove: vi.fn(async (keys: string[]) => {
      keys.forEach((k) => memoryStorage.delete(k));
    }),
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

import {
  loadAccountSettings,
  saveAccountSettings,
  loadPlaybackSettings,
  savePlaybackSetting,
  loadWifiOnlySetting,
  saveWifiOnlySetting,
  getAccountSettingsStorageKey,
  PREFS_AUTOPLAY,
  PREFS_GESTURES,
  PREFS_SKIPINTRO,
  PREFS_INTRO_DURATION,
  PREFS_QUALITY,
  PREFS_WIFI_ONLY,
} from "@/lib/user-settings";
import { setHapticsEnabled, isHapticsEnabled, hapticLight } from "@/lib/haptics";
import { formatBytes } from "@/lib/app-cache";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

describe("Pengaturan (Settings) Logic & Persistence Audit", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    vi.clearAllMocks();
  });

  describe("Account Isolation (User A vs User B)", () => {
    it("isolates private profile preferences between two different user accounts", async () => {
      const userA = "user-uuid-1111";
      const userB = "user-uuid-2222";

      // User A sets private profile to true
      await saveAccountSettings({ privateProfile: true }, userA);

      // User B sets private profile to false
      await saveAccountSettings({ privateProfile: false }, userB);

      // Loading User A's settings should return privateProfile = true
      const settingsA = await loadAccountSettings(userA);
      expect(settingsA.privateProfile).toBe(true);

      // Loading User B's settings should return privateProfile = false
      const settingsB = await loadAccountSettings(userB);
      expect(settingsB.privateProfile).toBe(false);

      // Storage keys must be distinct
      expect(getAccountSettingsStorageKey(userA)).toBe("nuenime.account_settings.user-uuid-1111");
      expect(getAccountSettingsStorageKey(userB)).toBe("nuenime.account_settings.user-uuid-2222");
    });

    it("guest account settings do not leak into authenticated accounts", async () => {
      await saveAccountSettings({ privateProfile: true }, null);
      const guestSettings = await loadAccountSettings(null);
      expect(guestSettings.privateProfile).toBe(true);

      const userSettings = await loadAccountSettings("authenticated-user");
      expect(userSettings.privateProfile).toBe(false);
    });
  });

  describe("Playback Preferences Persistence", () => {
    it("loads default playback preferences correctly", async () => {
      const pb = await loadPlaybackSettings();
      expect(pb.autoPlay).toBe(false);
      expect(pb.gestures).toBe(true);
      expect(pb.skipIntro).toBe(false);
      expect(pb.introDuration).toBe("85s");
      expect(pb.quality).toBe("720p");
    });

    it("saves and unifies autoPlay across both nuenime and watch preferences", async () => {
      await savePlaybackSetting("autoPlay", true);

      const pb = await loadPlaybackSettings();
      expect(pb.autoPlay).toBe(true);

      const nuenimeVal = await AsyncStorage.getItem(PREFS_AUTOPLAY);
      expect(nuenimeVal).toBe("true");

      const rawWatch = await AsyncStorage.getItem("aniraku.watch.preferences");
      expect(rawWatch).toBeTruthy();
      const parsed = JSON.parse(rawWatch!);
      expect(parsed.autoPlayNext).toBe(true);
    });

    it("persists gesture toggle, skip intro, duration, and quality", async () => {
      await savePlaybackSetting("gestures", false);
      await savePlaybackSetting("skipIntro", true);
      await savePlaybackSetting("introDuration", "90s");
      await savePlaybackSetting("quality", "1080p");

      const pb = await loadPlaybackSettings();
      expect(pb.gestures).toBe(false);
      expect(pb.skipIntro).toBe(true);
      expect(pb.introDuration).toBe("90s");
      expect(pb.quality).toBe("1080p");

      expect(await AsyncStorage.getItem(PREFS_GESTURES)).toBe("false");
      expect(await AsyncStorage.getItem(PREFS_SKIPINTRO)).toBe("true");
      expect(await AsyncStorage.getItem(PREFS_INTRO_DURATION)).toBe("90s");
      expect(await AsyncStorage.getItem(PREFS_QUALITY)).toBe("1080p");
    });
  });

  describe("Download Preferences Integration", () => {
    it("synchronizes wifiOnly setting with download manager", async () => {
      await saveWifiOnlySetting(false);
      expect(await loadWifiOnlySetting()).toBe(false);
      expect(await AsyncStorage.getItem(PREFS_WIFI_ONLY)).toBe("false");

      await saveWifiOnlySetting(true);
      expect(await loadWifiOnlySetting()).toBe(true);
      expect(await AsyncStorage.getItem(PREFS_WIFI_ONLY)).toBe("true");
    });
  });

  describe("Haptics System Toggle", () => {
    it("mutes all haptic feedback when disabled", () => {
      setHapticsEnabled(true);
      expect(isHapticsEnabled()).toBe(true);
      hapticLight();
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

      // Disable haptics
      setHapticsEnabled(false);
      expect(isHapticsEnabled()).toBe(false);

      // Calling hapticLight while disabled should be a no-op
      hapticLight();
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1); // still 1, not called again
    });
  });

  describe("Cache Formatting", () => {
    it("formats bytes into human readable MB/GB", () => {
      expect(formatBytes(0)).toBe("0.0 MB");
      expect(formatBytes(512)).toBe("512 B");
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(15 * 1024 * 1024)).toBe("15.0 MB");
      expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2.50 GB");
    });
  });
});
