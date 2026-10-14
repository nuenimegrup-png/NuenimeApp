import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { AdminUser } from "@/lib/admin-service";
import { logAdminAction } from "@/lib/admin-service";

export interface SupportPerk {
  icon: string;
  text: string;
}

export interface SupportConfig {
  saweriaUrl: string;
  saweriaActive: boolean;
  heroGifUrl: string;
  thankYouGifUrl: string;
  headlineBadge: string;
  headlineTitle: string;
  headlineSubtitle: string;
  saweriaTitle: string;
  saweriaDescription: string;
  perks: SupportPerk[];
  footnote: string;
}

export const STORAGE_SUPPORT_KEY = "nuenime.support_config";
export const SUPABASE_CONFIG_SUPPORT_KEY = "support_config";

export const DEFAULT_SUPPORT_CONFIG: SupportConfig = {
  saweriaUrl: "https://saweria.co/Nuenime",
  saweriaActive: true,
  heroGifUrl: "https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUyNjlyNmhqaWgzaHBvYXA0cXEzZ3BuaDV4cTFxdHl0dTRod3JzMTcxdSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/Al9XitEIwGgLU9yMfS/giphy.gif",
  thankYouGifUrl: "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUydG11ZWV3OXNkdzYzdjV6bXdmNTk2ZWNmcW9ydjRjczZ5dDNrOGF2YiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/UJuLfuG78YTDslaBcK/giphy.gif",
  headlineBadge: "🎌 NUENIME",
  headlineTitle: "Jaga Nuenime Tetap Hidup",
  headlineSubtitle: "Setiap dukungan kamu sangat berarti untuk kami terus berkembang!",
  saweriaTitle: "Saweria",
  saweriaDescription: "Dukung Nuenime lewat Saweria — sekali bayar, nominal bebas, tidak perlu akun premium.",
  perks: [
    { icon: "play-circle", text: "Server & hosting aplikasi Nuenime" },
    { icon: "bell", text: "Update konten & fitur baru" },
    { icon: "account-group", text: "Komunitas anime Indonesia" },
    { icon: "heart", text: "Semangat tim pengembang" },
  ],
  footnote: "Dukungan bersifat sukarela dan tidak mempengaruhi akses ke fitur Nuenime.",
};

/**
 * Mengambil konfigurasi Support & Saweria
 */
export async function getSupportConfig(): Promise<SupportConfig> {
  try {
    // 1. Coba ambil dari Supabase system_configs
    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", SUPABASE_CONFIG_SUPPORT_KEY)
      .maybeSingle();

    if (!error && data?.value && typeof data.value === "object") {
      const merged = { ...DEFAULT_SUPPORT_CONFIG, ...data.value };
      await AsyncStorage.setItem(STORAGE_SUPPORT_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn("[support-service] Supabase query failed, checking local cache:", err);
  }

  // 2. Fallback ke AsyncStorage
  try {
    const local = await AsyncStorage.getItem(STORAGE_SUPPORT_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && typeof parsed === "object") {
        return { ...DEFAULT_SUPPORT_CONFIG, ...parsed };
      }
    }
  } catch (err) {
    console.warn("[support-service] Local storage read error:", err);
  }

  // 3. Fallback default
  return DEFAULT_SUPPORT_CONFIG;
}

/**
 * Menyimpan konfigurasi Support & Saweria
 */
export async function saveSupportConfig(
  config: SupportConfig,
  admin?: AdminUser
): Promise<void> {
  // Simpan ke AsyncStorage
  await AsyncStorage.setItem(STORAGE_SUPPORT_KEY, JSON.stringify(config));

  // Simpan ke Supabase system_configs
  try {
    await supabase.from("system_configs").upsert({
      key: SUPABASE_CONFIG_SUPPORT_KEY,
      value: config,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[support-service] Supabase upsert error:", err);
  }

  // Audit log jika dijalankan admin
  if (admin) {
    await logAdminAction({
      admin,
      action: "UPDATE_SUPPORT_CONFIG",
      targetType: "support_config",
      targetId: "support_config",
      details: { saweriaUrl: config.saweriaUrl, active: config.saweriaActive },
    });
  }
}

/**
 * Mengembalikan konfigurasi Support ke default
 */
export async function resetSupportConfigToDefault(
  admin?: AdminUser
): Promise<SupportConfig> {
  await saveSupportConfig(DEFAULT_SUPPORT_CONFIG, admin);
  return DEFAULT_SUPPORT_CONFIG;
}
