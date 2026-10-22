import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { setHapticsEnabled } from "@/lib/haptics";
import { getDownloadSettings, saveDownloadSettings } from "@/lib/downloads";

export const PREFS_AUTOPLAY = "nuenime.playback.autoplay";
export const PREFS_GESTURES = "nuenime.playback.gestures";
export const PREFS_SKIPINTRO = "nuenime.playback.skipintro";
export const PREFS_INTRO_DURATION = "nuenime.playback.intro_duration";
export const PREFS_QUALITY = "nuenime.playback.quality";
export const PREFS_WIFI_ONLY = "nuenime.download.wifi_only";
export const PREFS_HAPTICS = "nuenime.system.haptics";
export const PREFS_PROFILE_PRIVATE_LEGACY = "nuenime.profile.private";

export function getAccountSettingsStorageKey(userId?: string | null): string {
  return userId ? `nuenime.account_settings.${userId}` : "nuenime.account_settings.guest";
}

export type UserAccountSettings = {
  privateProfile: boolean;
};

export type DevicePlaybackSettings = {
  autoPlay: boolean;
  gestures: boolean;
  skipIntro: boolean;
  introDuration: string;
  quality: string;
};

const DEFAULT_ACCOUNT_SETTINGS: UserAccountSettings = {
  privateProfile: false,
};

const DEFAULT_PLAYBACK_SETTINGS: DevicePlaybackSettings = {
  autoPlay: false,
  gestures: true,
  skipIntro: false,
  introDuration: "85s",
  quality: "720p",
};

/**
 * Loads per-account settings (e.g. private profile), isolated per user.
 * Reads from local storage cache, and if authenticated, synchronizes with Supabase `user_settings`.
 */
export async function loadAccountSettings(userId?: string | null): Promise<UserAccountSettings> {
  const storageKey = getAccountSettingsStorageKey(userId);
  let localSettings: UserAccountSettings = { ...DEFAULT_ACCOUNT_SETTINGS };

  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw) {
      localSettings = { ...localSettings, ...JSON.parse(raw) };
    } else if (!userId) {
      // Legacy fallback check for guest
      const legacy = await AsyncStorage.getItem(PREFS_PROFILE_PRIVATE_LEGACY);
      if (legacy !== null) {
        localSettings.privateProfile = legacy === "true";
      }
    }
  } catch {
    // Ignore parse error
  }

  // If user is authenticated, sync with Supabase `user_settings`
  if (userId) {
    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("settings")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data?.settings && typeof data.settings === "object") {
        const remote = data.settings as Record<string, any>;
        if (typeof remote.private_profile === "boolean") {
          localSettings.privateProfile = remote.private_profile;
          // Update local cache
          await AsyncStorage.setItem(storageKey, JSON.stringify(localSettings)).catch(() => {});
        }
      } else {
        // Fallback: check profiles.is_private if user_settings is empty
        const { data: prof } = await supabase
          .from("profiles")
          .select("is_private")
          .eq("id", userId)
          .maybeSingle();
        if (prof && typeof prof.is_private === "boolean") {
          localSettings.privateProfile = prof.is_private;
          await AsyncStorage.setItem(storageKey, JSON.stringify(localSettings)).catch(() => {});
        }
      }
    } catch {
      // Offline / network failure - fall back to local cached settings
    }
  }

  return localSettings;
}

/**
 * Saves per-account settings. Updates local user-scoped storage, Supabase `user_settings`,
 * and Supabase `profiles.is_private` so other users will see the locked state.
 */
export async function saveAccountSettings(
  patch: Partial<UserAccountSettings>,
  userId?: string | null
): Promise<UserAccountSettings> {
  const current = await loadAccountSettings(userId);
  const updated: UserAccountSettings = { ...current, ...patch };
  const storageKey = getAccountSettingsStorageKey(userId);

  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    // Also update legacy key for backward compatibility if user is guest or current
    if (typeof patch.privateProfile === "boolean") {
      await AsyncStorage.setItem(PREFS_PROFILE_PRIVATE_LEGACY, String(patch.privateProfile));
    }
  } catch {}

  // Sync to Supabase `user_settings` and `profiles` if user is logged in
  if (userId) {
    try {
      const { data: existing } = await supabase
        .from("user_settings")
        .select("settings")
        .eq("user_id", userId)
        .maybeSingle();

      const existingSettings = (existing?.settings as Record<string, any>) || {};
      const newSettings = {
        ...existingSettings,
        private_profile: updated.privateProfile,
      };

      await supabase.from("user_settings").upsert(
        {
          user_id: userId,
          settings: newSettings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    } catch {
      // Best effort remote sync
    }

    // Explicitly update profiles.is_private so public user profile queries see it
    if (typeof patch.privateProfile === "boolean") {
      try {
        await supabase
          .from("profiles")
          .update({
            is_private: patch.privateProfile,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
      } catch {
        // Best effort
      }

      // Also sync user metadata
      try {
        await supabase.auth.updateUser({
          data: { is_private: patch.privateProfile },
        });
      } catch {}
    }
  }

  return updated;
}

/**
 * Loads device-level playback settings.
 */
export async function loadPlaybackSettings(): Promise<DevicePlaybackSettings> {
  const result: DevicePlaybackSettings = { ...DEFAULT_PLAYBACK_SETTINGS };
  try {
    const [autoPlayVal, gesturesVal, skipIntroVal, introDurVal, qualityVal, legacyWatch] =
      await Promise.all([
        AsyncStorage.getItem(PREFS_AUTOPLAY),
        AsyncStorage.getItem(PREFS_GESTURES),
        AsyncStorage.getItem(PREFS_SKIPINTRO),
        AsyncStorage.getItem(PREFS_INTRO_DURATION),
        AsyncStorage.getItem(PREFS_QUALITY),
        AsyncStorage.getItem("aniraku.watch.preferences"),
      ]);

    if (autoPlayVal !== null) {
      result.autoPlay = autoPlayVal === "true";
    } else if (legacyWatch) {
      try {
        const parsed = JSON.parse(legacyWatch);
        if (typeof parsed.autoPlayNext === "boolean") {
          result.autoPlay = parsed.autoPlayNext;
        }
      } catch {}
    }

    if (gesturesVal !== null) result.gestures = gesturesVal === "true";
    if (skipIntroVal !== null) result.skipIntro = skipIntroVal === "true";
    if (introDurVal) result.introDuration = introDurVal;
    if (qualityVal) result.quality = qualityVal;
  } catch {}

  return result;
}

/**
 * Persists playback setting update across both nuenime keys and watch engine keys.
 */
export async function savePlaybackSetting<K extends keyof DevicePlaybackSettings>(
  key: K,
  value: DevicePlaybackSettings[K]
): Promise<void> {
  switch (key) {
    case "autoPlay": {
      const boolVal = Boolean(value);
      await Promise.all([
        AsyncStorage.setItem(PREFS_AUTOPLAY, String(boolVal)),
        AsyncStorage.getItem("aniraku.watch.preferences").then((raw) => {
          const current = raw ? JSON.parse(raw) : {};
          return AsyncStorage.setItem(
            "aniraku.watch.preferences",
            JSON.stringify({ ...current, autoPlayNext: boolVal })
          );
        }),
      ]);
      break;
    }
    case "gestures":
      await AsyncStorage.setItem(PREFS_GESTURES, String(value));
      break;
    case "skipIntro":
      await AsyncStorage.setItem(PREFS_SKIPINTRO, String(value));
      break;
    case "introDuration":
      await AsyncStorage.setItem(PREFS_INTRO_DURATION, String(value));
      break;
    case "quality":
      await AsyncStorage.setItem(PREFS_QUALITY, String(value));
      break;
  }
}

/**
 * Loads and toggles WiFi only setting with full lib/downloads.ts integration.
 */
export async function loadWifiOnlySetting(): Promise<boolean> {
  try {
    const ds = await getDownloadSettings();
    return ds.wifiOnly;
  } catch {
    const val = await AsyncStorage.getItem(PREFS_WIFI_ONLY);
    return val === null ? true : val === "true";
  }
}

export async function saveWifiOnlySetting(value: boolean): Promise<void> {
  await Promise.all([
    saveDownloadSettings({ wifiOnly: value }),
    AsyncStorage.setItem(PREFS_WIFI_ONLY, String(value)),
  ]);
}
