import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

const NSFW_KEY = "aniraku.nsfw.content.v1";
const SYSTEM_CONFIG_KEY = "app_content_safety";

/**
 * Membaca preferensi konten 18+ global yang dikontrol oleh Admin Dashboard.
 * Prioritas: Supabase system_configs ('app_content_safety') -> AsyncStorage cache lokal -> default false.
 */
export async function readNsfwPreference(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", SYSTEM_CONFIG_KEY)
      .maybeSingle();

    if (!error && data?.value && typeof data.value === "object") {
      const val = Boolean(data.value.allow_nsfw);
      await AsyncStorage.setItem(NSFW_KEY, val ? "true" : "false");
      return val;
    }
  } catch (err) {
    console.warn("[nsfw-preference] Error fetching global nsfw config from Supabase:", err);
  }

  try {
    const raw = await AsyncStorage.getItem(NSFW_KEY);
    return raw === "true";
  } catch {
    return false;
  }
}

/**
 * Menyimpan konfigurasi konten 18+ oleh Admin Dashboard ke Supabase & cache.
 */
export async function writeAdminNsfwPreference(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    await AsyncStorage.setItem(NSFW_KEY, enabled ? "true" : "false");

    const { error } = await supabase.from("system_configs").upsert(
      {
        key: SYSTEM_CONFIG_KEY,
        value: {
          allow_nsfw: enabled,
          updated_at: new Date().toISOString(),
        },
      },
      { onConflict: "key" }
    );

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal menyimpan konfigurasi" };
  }
}

export async function writeNsfwPreference(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(NSFW_KEY, enabled ? "true" : "false");
  } catch { /* preference loss is acceptable */ }
}

/**
 * Returns the AniList `isAdult` query parameter:
 * - `false` → exclude adult content (default)
 * - `null` → include all content (when NSFW toggle is on by admin)
 */
export function nsfwFilterParam(nsfwEnabled: boolean): boolean | null {
  return nsfwEnabled ? null : false;
}

export function useNsfwPreference() {
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    // 1. Ambil nilai preferensi terkini
    void readNsfwPreference().then((content) => {
      if (active) {
        setEnabledState(content);
        setReady(true);
      }
    }).catch(() => {
      if (active) setReady(true);
    });

    // 2. Realtime listener: jika Admin mengganti toggle di Dashboard, APK langsung berubah instan
    const channel = supabase
      .channel("realtime-nsfw-preference")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "system_configs",
          filter: `key=eq.${SYSTEM_CONFIG_KEY}`,
        },
        (payload: any) => {
          if (payload?.new?.value?.allow_nsfw !== undefined) {
            const nextVal = Boolean(payload.new.value.allow_nsfw);
            setEnabledState(nextVal);
            void AsyncStorage.setItem(NSFW_KEY, nextVal ? "true" : "false");
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { enabled, ready };
}
