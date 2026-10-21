import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import {
  GACHA_SETTINGS,
  RARITY_CONFIG,
  STORAGE_ACTIVE_WALLPAPER,
  STORAGE_CRYSTAL_BALANCE,
  STORAGE_GACHA_HISTORY,
  STORAGE_OWNED_WALLPAPERS,
  WallpaperItem,
  WallpaperRarity,
  GachaTransaction,
} from "./gacha-data";
import {
  getCrystalBalance as getTopUpCrystalBalance,
  setCrystalBalance as setTopUpCrystalBalance,
  deductCrystalBalance as deductTopUpCrystalBalance,
} from "./topup-service";
import type { AdminUser } from "./admin-service";
import { logAdminAction } from "./admin-service";
import { createBannerCompensationGift } from "./mailbox-service";

// ─── CONFIGURATION TYPES & CONSTANTS ───
export interface DynamicGachaConfig {
  costSingle: number;
  costMulti: number;
  rates: {
    mythic: number;
    legends: number;
    epic: number;
    rare: number;
    normal: number;
  };
  bannerTitle: string;
  bannerDesc: string;
}

export const SUPABASE_CONFIG_GACHA_KEY = "gacha_config";
export const STORAGE_GACHA_CONFIG_KEY = "nuenime.admin.gacha_config";

export const DEFAULT_GACHA_CONFIG: DynamicGachaConfig = {
  costSingle: 1000,
  costMulti: 9000,
  rates: {
    mythic: 2.0,
    legends: 8.0,
    epic: 20.0,
    rare: 30.0,
    normal: 40.0,
  },
  bannerTitle: "Bintang Istana Malam",
  bannerDesc: "Wallpaper edisi terbatas & bingkai mistis malam purnama.",
};

// ─── STORAGE KEY HELPERS (ACCOUNT ISOLATION) ───
export function getOwnedWallpapersStorageKey(userId?: string | null): string {
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    return `nuenime.owned.wallpapers.${userId.trim()}`;
  }
  return STORAGE_OWNED_WALLPAPERS;
}

export function getActiveWallpaperStorageKey(userId?: string | null): string {
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    return `nuenime.active.wallpaper.${userId.trim()}`;
  }
  return STORAGE_ACTIVE_WALLPAPER;
}

export function getGachaHistoryStorageKey(userId?: string | null): string {
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    return `nuenime.gacha.history.${userId.trim()}`;
  }
  return STORAGE_GACHA_HISTORY;
}

// ─── 1. CRYSTAL BALANCE INTEGRATION ───
/**
 * Mengambil saldo Dylan Crystal akun pengguna dari database utama (user_balances).
 * Terhubung penuh dengan sistem Top Up dan profil pengguna.
 */
export async function getCrystalBalance(userId?: string | null): Promise<number> {
  return getTopUpCrystalBalance(userId);
}

/**
 * Menetapkan saldo Crystal akun pengguna (sinkron ke Supabase & AsyncStorage).
 */
export async function setCrystalBalance(
  userId: string | null | undefined,
  amount: number
): Promise<number> {
  return setTopUpCrystalBalance(userId, amount);
}

// ─── 2. DYNAMIC GACHA CONFIG (PRICING & RATES) ───
/**
 * Mengambil konfigurasi harga dan probabilitas gacha dari Supabase system_configs.
 * Fallback ke AsyncStorage dan nilai default.
 */
export async function getGachaConfig(): Promise<DynamicGachaConfig> {
  // 1. Coba ambil dari Supabase system_configs
  try {
    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", SUPABASE_CONFIG_GACHA_KEY)
      .maybeSingle();

    if (!error && data?.value && typeof data.value === "object") {
      const val = data.value as any;
      const merged: DynamicGachaConfig = {
        costSingle: typeof val.cost_single === "number" ? val.cost_single : (val.costSingle ?? DEFAULT_GACHA_CONFIG.costSingle),
        costMulti: typeof val.cost_multi === "number" ? val.cost_multi : (val.costMulti ?? DEFAULT_GACHA_CONFIG.costMulti),
        rates: {
          mythic: typeof val.rates?.mythic === "number" ? val.rates.mythic : DEFAULT_GACHA_CONFIG.rates.mythic,
          legends: typeof val.rates?.legends === "number" ? val.rates.legends : DEFAULT_GACHA_CONFIG.rates.legends,
          epic: typeof val.rates?.epic === "number" ? val.rates.epic : DEFAULT_GACHA_CONFIG.rates.epic,
          rare: typeof val.rates?.rare === "number" ? val.rates.rare : DEFAULT_GACHA_CONFIG.rates.rare,
          normal: typeof val.rates?.normal === "number" ? val.rates.normal : DEFAULT_GACHA_CONFIG.rates.normal,
        },
        bannerTitle: typeof val.banner_title === "string" ? val.banner_title : (val.bannerTitle ?? DEFAULT_GACHA_CONFIG.bannerTitle),
        bannerDesc: typeof val.banner_desc === "string" ? val.banner_desc : (val.bannerDesc ?? DEFAULT_GACHA_CONFIG.bannerDesc),
      };

      await AsyncStorage.setItem(STORAGE_GACHA_CONFIG_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn("[gacha-service] Supabase query system_configs failed:", err);
  }

  // 2. Fallback AsyncStorage
  try {
    const local = await AsyncStorage.getItem(STORAGE_GACHA_CONFIG_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && typeof parsed === "object") {
        return { ...DEFAULT_GACHA_CONFIG, ...parsed };
      }
    }
  } catch {}

  return DEFAULT_GACHA_CONFIG;
}

/**
 * Menyimpan konfigurasi harga gacha dan drop rate ke Supabase & AsyncStorage oleh Admin.
 */
export async function saveGachaConfig(
  config: DynamicGachaConfig,
  admin?: AdminUser
): Promise<void> {
  // Simpan ke AsyncStorage lokal
  await AsyncStorage.setItem(STORAGE_GACHA_CONFIG_KEY, JSON.stringify(config));

  // Simpan ke Supabase system_configs
  try {
    await supabase.from("system_configs").upsert({
      key: SUPABASE_CONFIG_GACHA_KEY,
      value: {
        cost_single: config.costSingle,
        cost_multi: config.costMulti,
        rates: config.rates,
        banner_title: config.bannerTitle,
        banner_desc: config.bannerDesc,
      },
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[gacha-service] Failed to persist system_configs:", err);
  }

  // Audit log jika dijalankan admin
  if (admin) {
    await logAdminAction({
      admin,
      action: "UPDATE_GACHA_CONFIG",
      targetType: "gacha",
      targetId: "pricing_and_rates",
      details: config,
    });
  }
}

// ─── 3. GACHA BANNERS CRUD (DATABASE POOL) ───
const STORAGE_CACHED_BANNERS = "nuenime.cached.gacha_banners";

/**
 * Mengambil seluruh koleksi banner dari database Supabase (gacha_banners).
 * Jika tabel belum ada atau offline, menggabungkan dengan katalog awal WALLPAPER_CATALOG.
 */
export async function getAllGachaBanners(): Promise<WallpaperItem[]> {
  try {
    const { data, error } = await supabase
      .from("gacha_banners")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped: WallpaperItem[] = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        anime: row.anime || "",
        rarity: (row.rarity as WallpaperRarity) || "Normal",
        category: (row.category as any) || RARITY_CONFIG[row.rarity as WallpaperRarity]?.category || "Standard",
        expBonus: typeof row.exp_bonus === "number" ? row.exp_bonus : (RARITY_CONFIG[row.rarity as WallpaperRarity]?.expBonus || 5),
        image: row.image,
        color: row.color || RARITY_CONFIG[row.rarity as WallpaperRarity]?.color || "#94A3B8",
        isActive: row.is_active !== false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      await AsyncStorage.setItem(STORAGE_CACHED_BANNERS, JSON.stringify(mapped));
      return mapped;
    }
  } catch (err) {
    console.warn("[gacha-service] Supabase query gacha_banners failed:", err);
  }

  // Fallback cache AsyncStorage jika offline
  try {
    const raw = await AsyncStorage.getItem(STORAGE_CACHED_BANNERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  // Murni database: jangan me-return data dummy jika data belum ada
  return [];
}

/**
 * Mengambil daftar banner aktif yang saat ini masuk ke pool hadiah Gacha.
 */
export async function getActiveGachaBanners(): Promise<WallpaperItem[]> {
  const all = await getAllGachaBanners();
  return all.filter((item) => item.isActive !== false);
}

/**
 * Menambahkan banner baru oleh Admin ke Supabase gacha_banners.
 */
export async function addGachaBanner(
  item: {
    id?: string;
    name: string;
    anime?: string;
    rarity: WallpaperRarity;
    image: string;
    isActive?: boolean;
  },
  admin?: AdminUser
): Promise<{ success: boolean; data?: WallpaperItem; error?: string }> {
  const rarity = item.rarity || "Normal";
  const rarityMeta = RARITY_CONFIG[rarity];

  const bannerId =
    (item.id && item.id.trim().length > 0)
      ? item.id.trim().toLowerCase().replace(/\s+/g, "_")
      : `banner_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newBanner: WallpaperItem = {
    id: bannerId,
    name: item.name.trim(),
    anime: (item.anime || "").trim(),
    rarity,
    category: rarityMeta.category,
    expBonus: rarityMeta.expBonus,
    image: item.image.trim(),
    color: rarityMeta.color,
    isActive: item.isActive !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const { error } = await supabase.from("gacha_banners").insert({
      id: newBanner.id,
      name: newBanner.name,
      anime: newBanner.anime,
      rarity: newBanner.rarity,
      category: newBanner.category,
      exp_bonus: newBanner.expBonus,
      image: newBanner.image,
      color: newBanner.color,
      is_active: newBanner.isActive,
      created_at: newBanner.createdAt,
      updated_at: newBanner.updatedAt,
    });

    if (error) {
      return { success: false, error: error.message };
    }
  } catch (err: any) {
    console.warn("[gacha-service] Supabase insert failed:", err);
    return { success: false, error: err?.message || "Koneksi Supabase gagal" };
  }

  // Update local cache
  try {
    const current = await getAllGachaBanners();
    const next = [newBanner, ...current.filter((b) => b.id !== newBanner.id)];
    await AsyncStorage.setItem(STORAGE_CACHED_BANNERS, JSON.stringify(next));
  } catch {}

  if (admin) {
    await logAdminAction({
      admin,
      action: "ADD_GACHA_BANNER",
      targetType: "gacha_banner",
      targetId: newBanner.id,
      details: newBanner,
    });
  }

  return { success: true, data: newBanner };
}

/**
 * Mengubah data banner profil oleh Admin.
 */
export async function updateGachaBanner(
  item: WallpaperItem,
  admin?: AdminUser
): Promise<{ success: boolean; error?: string }> {
  const rarityMeta = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.Normal;
  const updatedItem: WallpaperItem = {
    ...item,
    category: rarityMeta.category,
    expBonus: rarityMeta.expBonus,
    color: rarityMeta.color,
    updatedAt: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from("gacha_banners")
      .update({
        name: updatedItem.name,
        anime: updatedItem.anime,
        rarity: updatedItem.rarity,
        category: updatedItem.category,
        exp_bonus: updatedItem.expBonus,
        image: updatedItem.image,
        color: updatedItem.color,
        is_active: updatedItem.isActive,
        updated_at: updatedItem.updatedAt,
      })
      .eq("id", updatedItem.id);

    if (error) {
      return { success: false, error: error.message };
    }
  } catch (err: any) {
    console.warn("[gacha-service] Supabase update failed:", err);
    return { success: false, error: err?.message || "Koneksi Supabase gagal" };
  }

  // Update local cache
  try {
    const current = await getAllGachaBanners();
    const next = current.map((b) => (b.id === updatedItem.id ? updatedItem : b));
    await AsyncStorage.setItem(STORAGE_CACHED_BANNERS, JSON.stringify(next));
  } catch {}

  if (admin) {
    await logAdminAction({
      admin,
      action: "UPDATE_GACHA_BANNER",
      targetType: "gacha_banner",
      targetId: updatedItem.id,
      details: updatedItem,
    });
  }

  return { success: true };
}

/**
 * Menghapus banner dari database oleh Admin.
 * Secara otomatis mendeteksi semua user pemilik banner ini dan mengembalikan
 * 100% Dylan Crystal ke kotak masuk (Mailbox) serta notifikasi klaim mereka.
 */
export async function deleteGachaBanner(
  id: string,
  admin?: AdminUser
): Promise<{ success: boolean; error?: string; refundedUsersCount?: number; bannerName?: string }> {
  try {
    const all = await getAllGachaBanners();
    const target = all.find((b) => b.id === id);
    const bannerName = target?.name || id;
    const bannerRarity = target?.rarity || "Normal";
    const refundPrice = RARITY_CONFIG[bannerRarity]?.price || 1500;

    // 1. Ambil data semua pengguna yang memiliki banner ini untuk dikembalikan crystal-nya
    let owners: { user_id: string }[] = [];
    try {
      const { data } = await supabase
        .from("user_banner_inventory")
        .select("user_id")
        .eq("banner_id", id);

      if (Array.isArray(data) && data.length > 0) {
        owners = data;
      }
    } catch {}

    // 2. Berikan kompensasi refund crystal ke Mailbox masing-masing pengguna
    let refundedCount = 0;
    if (owners.length > 0) {
      for (const o of owners) {
        if (!o.user_id) continue;
        await createBannerCompensationGift({
          userId: o.user_id,
          bannerId: id,
          bannerName,
          bannerRarity,
          refundAmount: refundPrice,
          admin,
        });
        refundedCount++;
      }
    }

    // 3. Reset active_wallpaper pada profile pengguna jika ada yang sedang memakai banner ini
    try {
      await supabase
        .from("profiles")
        .update({ active_wallpaper: null })
        .eq("active_wallpaper", id);
    } catch {}

    // 4. Bersihkan kepemilikan dari user_banner_inventory
    try {
      await supabase
        .from("user_banner_inventory")
        .delete()
        .eq("banner_id", id);
    } catch {}

    // 5. Hapus banner dari tabel gacha_banners
    const { error } = await supabase.from("gacha_banners").delete().eq("id", id);
    if (error) {
      console.warn("deleteGachaBanner delete error:", error.message);
      // Fallback nonaktifkan jika foreign key membatasi
      await supabase
        .from("gacha_banners")
        .update({ is_active: false })
        .eq("id", id);
    }

    // 6. Update local cache
    try {
      const next = all.filter((b) => b.id !== id);
      await AsyncStorage.setItem(STORAGE_CACHED_BANNERS, JSON.stringify(next));
    } catch {}

    if (admin) {
      await logAdminAction({
        admin,
        action: "DELETE_GACHA_BANNER",
        targetType: "gacha_banner",
        targetId: id,
        details: { id, bannerName, refundedCount, refundPrice },
      });
    }

    return { success: true, refundedUsersCount: refundedCount, bannerName };
  } catch (err: any) {
    console.warn("[gacha-service] Supabase delete banner error:", err);
    return { success: false, error: err?.message || "Gagal memproses penghapusan banner" };
  }
}

/**
 * Mengubah status aktif / nonaktif banner dari pool gacha oleh Admin.
 */
export async function toggleGachaBannerActive(
  id: string,
  isActive: boolean,
  admin?: AdminUser
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("gacha_banners")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }
  } catch (err: any) {
    console.warn("[gacha-service] Supabase toggle active error:", err);
  }

  try {
    const current = await getAllGachaBanners();
    const next = current.map((b) => (b.id === id ? { ...b, isActive } : b));
    await AsyncStorage.setItem(STORAGE_CACHED_BANNERS, JSON.stringify(next));
  } catch {}

  if (admin) {
    await logAdminAction({
      admin,
      action: isActive ? "ACTIVATE_GACHA_BANNER" : "DEACTIVATE_GACHA_BANNER",
      targetType: "gacha_banner",
      targetId: id,
      details: { id, isActive },
    });
  }

  return { success: true };
}

// ─── 4. USER BANNER INVENTORY & OWNERSHIP (PER AKUN) ───
/**
 * Mengambil daftar ID banner yang dimiliki akun pengguna.
 * Prioritas: Supabase user_banner_inventory → AsyncStorage cache per user.
 */
export async function getOwnedWallpaperIds(userId?: string | null): Promise<string[]> {
  // 1. Coba dari Supabase jika user logged-in
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    try {
      const { data, error } = await supabase
        .from("user_banner_inventory")
        .select("banner_id")
        .eq("user_id", userId);

      if (!error && Array.isArray(data)) {
        const ids = data.map((r: any) => r.banner_id as string);
        const key = getOwnedWallpapersStorageKey(userId);
        await AsyncStorage.setItem(key, JSON.stringify(ids));
        return ids;
      }
    } catch (err) {
      console.warn("[gacha-service] Supabase query user_banner_inventory failed:", err);
    }
  }

  // 2. Fallback AsyncStorage per user
  try {
    const key = getOwnedWallpapersStorageKey(userId);
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  // 3. Jika pengguna tamu (guest) atau profil baru tanpa wallpaper
  return [];
}

/**
 * Menyimpan kepemilikan banner baru ke Supabase user_banner_inventory & AsyncStorage.
 */
export async function recordBannerOwnership(
  userId: string | null | undefined,
  bannerIds: string[]
): Promise<void> {
  if (!bannerIds || bannerIds.length === 0) return;

  // 1. Simpan ke local cache AsyncStorage
  const current = await getOwnedWallpaperIds(userId);
  const nextSet = new Set([...current, ...bannerIds]);
  const nextArray = Array.from(nextSet);
  const key = getOwnedWallpapersStorageKey(userId);
  await AsyncStorage.setItem(key, JSON.stringify(nextArray));

  // 2. Simpan ke Supabase jika user valid
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    try {
      const rows = bannerIds.map((bid) => ({
        user_id: userId,
        banner_id: bid,
        obtained_at: new Date().toISOString(),
      }));

      await supabase
        .from("user_banner_inventory")
        .upsert(rows, { onConflict: "user_id,banner_id", ignoreDuplicates: true });
    } catch (err) {
      console.warn("[gacha-service] Supabase upsert user_banner_inventory failed:", err);
    }
  }
}

/**
 * Memverifikasi dan memastikan seluruh hasil spin 10x tersimpan secara idempoten
 * ke database dan storage lokal pengguna tanpa mengurangi saldo Crystal lagi.
 */
export async function verifyAndSaveSummonResults(
  userId: string | null | undefined,
  results: WallpaperItem[]
): Promise<{ success: boolean; savedCount: number; error?: string }> {
  if (!results || results.length === 0) {
    return { success: true, savedCount: 0 };
  }

  try {
    const bannerIds = results.map((r) => r.id);
    await recordBannerOwnership(userId, bannerIds);
    return { success: true, savedCount: bannerIds.length };
  } catch (err: any) {
    console.warn("[gacha-service] verifyAndSaveSummonResults error:", err);
    return {
      success: false,
      savedCount: 0,
      error: err?.message || "Gagal memverifikasi penyimpanan hadiah ke database",
    };
  }
}

// ─── 5. ACTIVE / EQUIPPED BANNER PER USER ───
export async function getActiveWallpaperId(userId?: string | null): Promise<string | null> {
  try {
    const key = getActiveWallpaperStorageKey(userId);
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setActiveWallpaperId(
  userId: string | null | undefined,
  id: string | null
): Promise<void> {
  const key = getActiveWallpaperStorageKey(userId);
  if (id) {
    await AsyncStorage.setItem(key, id);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

// ─── 6. RANDOM ROLL ALGORITHM ───
/**
 * Memilih item gacha secara acak berdasarkan konfigurasi probabilitas drop rate terkini.
 */
function rollSingleItemFromPool(
  pool: WallpaperItem[],
  rates: { mythic: number; legends: number; epic: number; rare: number; normal: number }
): WallpaperItem {
  if (!pool || pool.length === 0) {
    throw new Error("Pool hadiah gacha sedang kosong. Silakan tambahkan banner di admin.");
  }

  const rand = Math.random() * 100;
  let chosenRarity: WallpaperRarity = "Normal";

  const tMythic = rates.mythic;
  const tLegends = tMythic + rates.legends;
  const tEpic = tLegends + rates.epic;
  const tRare = tEpic + rates.rare;

  if (rand < tMythic) {
    chosenRarity = "Mythic";
  } else if (rand < tLegends) {
    chosenRarity = "Legendary";
  } else if (rand < tEpic) {
    chosenRarity = "Epic";
  } else if (rand < tRare) {
    chosenRarity = "Rare";
  } else {
    chosenRarity = "Normal";
  }

  // Ambil item dari pool aktif yang memiliki rarity terpilih
  const matched = pool.filter((w) => w.rarity === chosenRarity);
  if (matched.length > 0) {
    const idx = Math.floor(Math.random() * matched.length);
    return matched[idx];
  }

  // Fallback acak dari seluruh pool aktif
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── 7. GACHA SUMMON EXECUTION (SECURE & ATOMIC) ───
export function generateGachaTransactionId(): string {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `NUE-GC-${year}${month}${day}-${rand}`;
}

/**
 * Melakukan proses Gacha Summon (1x atau 10x) dengan transaksi database yang aman:
 * 1. Menggunakan saldo Dylan Crystal utama pengguna.
 * 2. Menolak proses jika Crystal tidak mencukupi.
 * 3. Mengurangi Crystal dan memasukkan banner yang didapat ke inventory.
 * 4. Mencatat riwayat transaksi dengan ID unik.
 */
// ─── XP REWARD PER RARITY (flat XP per item yang didapat) ───
export const GACHA_XP_REWARD: Record<WallpaperRarity, number> = {
  Normal:    10,
  Rare:      20,
  Epic:      40,
  Legendary: 80,
  Mythic:    150,
};

/**
 * Memberikan XP ke profil pengguna berdasarkan hasil pull gacha.
 * Update langsung ke Supabase profiles (kolom exp) dan kembalikan
 * nilai exp + level baru agar UI bisa tampilkan animasi level-up.
 */
export async function awardGachaXp(
  userId: string,
  results: WallpaperItem[]
): Promise<{ totalXpAwarded: number; newExp: number; newLevel: number; oldLevel: number; levelUp: boolean }> {
  const totalXpAwarded = results.reduce(
    (sum, item) => sum + (GACHA_XP_REWARD[item.rarity] ?? 10),
    0
  );
  if (totalXpAwarded === 0) return { totalXpAwarded: 0, newExp: 0, newLevel: 1, oldLevel: 1, levelUp: false };

  try {
    const { data: profile, error: fetchErr } = await supabase
      .from("profiles")
      .select("exp, level")
      .eq("id", userId)
      .maybeSingle();

    const oldExp = profile?.exp ?? 0;
    const oldLevel = profile?.level ?? 1;
    const newExp = oldExp + totalXpAwarded;

    let level = 1;
    let xpAcc = 0;
    while (true) {
      const needed = 50 + (level - 1) * 15;
      if (newExp < xpAcc + needed) break;
      xpAcc += needed;
      level++;
      if (level >= 200000) break;
    }
    const levelUp = level > oldLevel;

    await supabase
      .from("profiles")
      .update({ exp: newExp, level })
      .eq("id", userId);

    try {
      await supabase.from("user_xp_transactions").insert({
        user_id: userId,
        activity_type: "gacha_summon",
        target_id: `gacha_pull_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        base_xp: totalXpAwarded,
        bonus_xp: 0,
        total_xp: totalXpAwarded,
        multiplier: 1.0,
        description: `Hadiah Gacha Summon (${results.length} item didapat)`,
        metadata: {
          results_count: results.length,
          rarities: results.map((r) => r.rarity),
        },
      });
    } catch {}

    return { totalXpAwarded, newExp, newLevel: level, oldLevel, levelUp };
  } catch (err) {
    console.warn("[gacha-service] awardGachaXp failed:", err);
    return { totalXpAwarded, newExp: totalXpAwarded, newLevel: 1, oldLevel: 1, levelUp: false };
  }
}

/**
 * Memberikan atau mensimulasikan penambahan EXP langsung ke akun pengguna.
 * Menghitung base XP + bonus XP berdasarkan wallpaper/border yang dipakai,
 * memperbarui tabel `profiles` di Supabase, dan mencatat transaksi ke `user_xp_transactions`.
 */
export async function awardDirectUserXp(
  userId: string,
  baseXp: number,
  bonusPercent: number,
  description: string,
  activityType: string = "simulation"
): Promise<{
  success: boolean;
  baseXp: number;
  bonusXp: number;
  totalXp: number;
  newExp: number;
  newLevel: number;
  oldLevel: number;
  levelUp: boolean;
  message?: string;
}> {
  if (!userId || userId === "guest") {
    return {
      success: false,
      baseXp,
      bonusXp: 0,
      totalXp: baseXp,
      newExp: 0,
      newLevel: 1,
      oldLevel: 1,
      levelUp: false,
      message: "Masuk/login terlebih dahulu untuk menyimpan EXP ke akun Anda.",
    };
  }

  const bonusXp = Math.round((baseXp * bonusPercent) / 100);
  const totalXp = baseXp + bonusXp;

  try {
    const { data: profile, error: fetchErr } = await supabase
      .from("profiles")
      .select("exp, level")
      .eq("id", userId)
      .maybeSingle();

    if (fetchErr) {
      console.warn("[gacha-service] awardDirectUserXp fetch error:", fetchErr);
    }

    const oldExp = profile?.exp ?? 0;
    const oldLevel = profile?.level ?? 1;
    const newExp = oldExp + totalXp;

    let level = 1;
    let xpAcc = 0;
    while (true) {
      const needed = 50 + (level - 1) * 15;
      if (newExp < xpAcc + needed) break;
      xpAcc += needed;
      level++;
      if (level >= 200000) break;
    }
    const levelUp = level > oldLevel;

    await supabase
      .from("profiles")
      .update({ exp: newExp, level })
      .eq("id", userId);

    try {
      await supabase.from("user_xp_transactions").insert({
        user_id: userId,
        activity_type: activityType,
        target_id: `${activityType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        base_xp: baseXp,
        bonus_xp: bonusXp,
        total_xp: totalXp,
        multiplier: 1.0 + bonusPercent / 100,
        description,
        metadata: {
          bonus_percent: bonusPercent,
          source: "gacha_simulation",
        },
      });
    } catch {}

    return {
      success: true,
      baseXp,
      bonusXp,
      totalXp,
      newExp,
      newLevel: level,
      oldLevel,
      levelUp,
    };
  } catch (err: any) {
    console.warn("[gacha-service] awardDirectUserXp error:", err);
    return {
      success: false,
      baseXp,
      bonusXp,
      totalXp,
      newExp: 0,
      newLevel: 1,
      oldLevel: 1,
      levelUp: false,
      message: err?.message || "Gagal menyimpan EXP",
    };
  }
}

export async function executeGachaSummon(
  userId: string | null | undefined,
  count: 1 | 10,
  configOverride?: DynamicGachaConfig
): Promise<{
  success: boolean;
  results: WallpaperItem[];
  newBalance: number;
  newOwnedCount: number;
  xpAwarded?: number;
  newExp?: number;
  newLevel?: number;
  txId?: string;
  error?: string;
}> {
  // 1. Ambil konfigurasi harga & drop rate dinamis
  const config = configOverride || (await getGachaConfig());
  const cost = count === 1 ? config.costSingle : config.costMulti;

  // 2. Ambil pool banner aktif
  const activePool = await getActiveGachaBanners();
  if (activePool.length === 0) {
    return {
      success: false,
      results: [],
      newBalance: await getCrystalBalance(userId),
      newOwnedCount: 0,
      error: "Pool hadiah Gacha sedang kosong. Silakan hubungi admin.",
    };
  }

  // 3. Validasi saldo akun saat ini
  const currentBalance = await getCrystalBalance(userId);
  if (currentBalance < cost) {
    return {
      success: false,
      results: [],
      newBalance: currentBalance,
      newOwnedCount: 0,
      error: `Daylan Crystal tidak mencukupi! Anda memiliki ${currentBalance.toLocaleString("id-ID")} Crystal, dibutuhkan ${cost.toLocaleString("id-ID")} Crystal.`,
    };
  }

  // 4. Undi hadiah banner
  const results: WallpaperItem[] = [];
  for (let i = 0; i < count; i++) {
    results.push(rollSingleItemFromPool(activePool, config.rates));
  }
  const bannerIds = results.map((r) => r.id);
  const txId = generateGachaTransactionId();

  // 5. Eksekusi transaksi ke Supabase (jika user authenticated)
  let finalBalance = currentBalance - cost;
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    try {
      // Coba panggil RPC atomik execute_gacha_pull
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("execute_gacha_pull", {
        p_user_id: userId,
        p_type: count === 1 ? "single" : "multi",
        p_cost: cost,
        p_banner_ids: bannerIds,
        p_results: results,
        p_tx_id: txId,
      });

      if (!rpcErr && rpcRes && typeof rpcRes === "object") {
        if (rpcRes.success === false) {
          return {
            success: false,
            results: [],
            newBalance: typeof rpcRes.current_balance === "number" ? rpcRes.current_balance : currentBalance,
            newOwnedCount: 0,
            error: "Saldo Crystal tidak mencukupi untuk melakukan gacha.",
          };
        }
        if (typeof rpcRes.new_balance === "number") {
          finalBalance = rpcRes.new_balance;
        }
      } else {
        // Fallback jika RPC function belum dimigrasi di server: potong via service & catat manual
        finalBalance = await deductTopUpCrystalBalance(userId, cost);
        await recordBannerOwnership(userId, bannerIds);

        await supabase.from("gacha_transactions").insert({
          id: txId,
          user_id: userId,
          summon_type: count === 1 ? "single" : "multi",
          cost,
          results,
          status: "success",
          created_at: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.warn("[gacha-service] Supabase transaction failed, applying local fallback:", err);
      finalBalance = await deductTopUpCrystalBalance(userId, cost);
      await recordBannerOwnership(userId, bannerIds);
    }
  } else {
    // Akun guest / offline mode
    finalBalance = await deductTopUpCrystalBalance(userId, cost);
    await recordBannerOwnership(userId, bannerIds);
  }

  // 6. Update cache lokal AsyncStorage & riwayat
  const updatedOwned = await getOwnedWallpaperIds(userId);
  try {
    const txLog: GachaTransaction = {
      id: txId,
      timestamp: Date.now(),
      type: count === 1 ? "single" : "multi",
      cost,
      results,
    };
    const histKey = getGachaHistoryStorageKey(userId);
    const prevHistoryRaw = await AsyncStorage.getItem(histKey);
    const history: GachaTransaction[] = prevHistoryRaw ? JSON.parse(prevHistoryRaw) : [];
    history.unshift(txLog);
    await AsyncStorage.setItem(histKey, JSON.stringify(history.slice(0, 50)));
  } catch {}

  // 7. Award XP berdasarkan rarity item yang didapat
  let xpAwarded = 0;
  let newExp = 0;
  let newLevel = 1;
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    try {
      const xpResult = await awardGachaXp(userId, results);
      xpAwarded = xpResult.totalXpAwarded;
      newExp = xpResult.newExp;
      newLevel = xpResult.newLevel;
    } catch (err) {
      console.warn("[gacha-service] XP award failed (non-critical):", err);
    }
  }

  return {
    success: true,
    results,
    newBalance: finalBalance,
    newOwnedCount: updatedOwned.length,
    xpAwarded,
    newExp,
    newLevel,
    txId,
  };
}

/**
 * Menghitung bonus EXP dari wallpaper yang sedang aktif dipasang
 */
export async function getEquippedExpBonus(userId?: string | null): Promise<number> {
  const activeId = await getActiveWallpaperId(userId);
  if (!activeId) return 0;
  const all = await getAllGachaBanners();
  const wallpaper = all.find((w) => w.id === activeId);
  return wallpaper ? wallpaper.expBonus : 0;
}
