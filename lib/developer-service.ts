import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { AdminUser } from "@/lib/admin-service";
import { logAdminAction } from "@/lib/admin-service";

export interface SocialLink {
  icon: string;
  label: string;
  url: string;
}

export interface DeveloperMember {
  id: string;
  name: string;
  tag: string;
  role: string;
  avatarUri?: string;
  accentColor: string;
  badgeBg?: string;
  badgeBorder?: string;
  social: SocialLink[];
  order?: number;
}

export const STORAGE_DEVELOPERS_KEY = "nuenime.developer_team";
export const SUPABASE_CONFIG_DEVELOPERS_KEY = "developer_team";

export const DEFAULT_DEVELOPERS: DeveloperMember[] = [
  {
    id: "dev-valora",
    name: "Valora",
    tag: "Founder Valora Official Grup",
    role: "Perancang Nuenime, Desain Nuenime, Backend & Frontend",
    avatarUri: "https://i.ibb.co.com/5h7WVZ0Z/32d6acf9127007583429953eb35f37ec.jpg",
    accentColor: "#E2E8F0",
    badgeBg: "rgba(226, 232, 240, 0.12)",
    badgeBorder: "rgba(226, 232, 240, 0.3)",
    social: [
      { icon: "facebook", label: "Facebook", url: "" },
      { icon: "instagram", label: "Instagram", url: "" },
      { icon: "web", label: "Website", url: "" },
    ],
    order: 1,
  },
  {
    id: "dev-nueva",
    name: "Nueva",
    tag: "Founder Nuenime",
    role: "Founder Nuenime, Marketing & Sosial Media",
    avatarUri: undefined,
    accentColor: "#38BDF8",
    badgeBg: "rgba(56, 189, 248, 0.15)",
    badgeBorder: "rgba(56, 189, 248, 0.4)",
    social: [
      { icon: "facebook", label: "Facebook", url: "" },
      { icon: "instagram", label: "Instagram", url: "" },
      { icon: "web", label: "Website", url: "" },
    ],
    order: 2,
  },
];

/**
 * Mengambil daftar Tim Developer dari Supabase (dengan cache AsyncStorage & fallback default)
 */
export async function getDevelopers(): Promise<DeveloperMember[]> {
  try {
    // 1. Coba ambil dari Supabase system_configs
    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", SUPABASE_CONFIG_DEVELOPERS_KEY)
      .maybeSingle();

    if (!error && data?.value && Array.isArray(data.value) && data.value.length > 0) {
      await AsyncStorage.setItem(STORAGE_DEVELOPERS_KEY, JSON.stringify(data.value));
      return data.value;
    }
  } catch (err) {
    console.warn("[developer-service] Supabase query failed, using local cache:", err);
  }

  // 2. Fallback ke AsyncStorage
  try {
    const local = await AsyncStorage.getItem(STORAGE_DEVELOPERS_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[developer-service] Local storage read error:", err);
  }

  // 3. Fallback default
  return DEFAULT_DEVELOPERS;
}

/**
 * Menyimpan seluruh daftar Tim Developer ke Supabase dan cache lokal
 */
export async function saveDevelopers(
  list: DeveloperMember[],
  admin?: AdminUser
): Promise<void> {
  const sorted = [...list].map((item, idx) => ({
    ...item,
    order: item.order ?? idx + 1,
  }));

  // Simpan ke AsyncStorage
  await AsyncStorage.setItem(STORAGE_DEVELOPERS_KEY, JSON.stringify(sorted));

  // Simpan ke Supabase system_configs
  try {
    await supabase.from("system_configs").upsert({
      key: SUPABASE_CONFIG_DEVELOPERS_KEY,
      value: sorted,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[developer-service] Supabase upsert error:", err);
  }

  // Audit log jika dijalankan admin
  if (admin) {
    await logAdminAction({
      admin,
      action: "UPDATE_DEVELOPER_TEAM",
      targetType: "developer_team",
      targetId: "developer_team",
      details: { totalMembers: sorted.length },
    });
  }
}

/**
 * Menambahkan developer baru
 */
export async function addDeveloper(
  newDev: Omit<DeveloperMember, "id">,
  admin?: AdminUser
): Promise<DeveloperMember> {
  const current = await getDevelopers();
  const id = `dev-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const created: DeveloperMember = {
    ...newDev,
    id,
    order: current.length + 1,
  };
  const updated = [...current, created];
  await saveDevelopers(updated, admin);
  return created;
}

/**
 * Memperbarui data developer yang sudah ada
 */
export async function updateDeveloper(
  id: string,
  updates: Partial<DeveloperMember>,
  admin?: AdminUser
): Promise<DeveloperMember> {
  const current = await getDevelopers();
  const index = current.findIndex((d) => d.id === id);
  if (index === -1) {
    throw new Error(`Developer dengan ID ${id} tidak ditemukan.`);
  }

  const updatedItem: DeveloperMember = {
    ...current[index],
    ...updates,
    id, // protect ID
  };

  const updatedList = [...current];
  updatedList[index] = updatedItem;
  await saveDevelopers(updatedList, admin);
  return updatedItem;
}

/**
 * Menghapus developer berdasarkan ID
 */
export async function deleteDeveloper(id: string, admin?: AdminUser): Promise<void> {
  const current = await getDevelopers();
  const filtered = current.filter((d) => d.id !== id);
  await saveDevelopers(filtered, admin);
}

/**
 * Mengembalikan konfigurasi tim developer ke default
 */
export async function resetDevelopersToDefault(admin?: AdminUser): Promise<DeveloperMember[]> {
  await saveDevelopers(DEFAULT_DEVELOPERS, admin);
  return DEFAULT_DEVELOPERS;
}
