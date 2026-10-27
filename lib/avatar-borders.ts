import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export type BorderRarity = "Mythic" | "Legends" | "Epic" | "Rare" | "Normal";

export const BORDER_RARITIES: BorderRarity[] = [
  "Mythic",
  "Legends",
  "Epic",
  "Rare",
  "Normal",
];

export interface AvatarBorder {
  id: string;
  name: string;
  rarity: BorderRarity;
  assetUrl: string | null;
  /**
   * Rasio diameter lingkaran avatar terhadap ukuran container border (default 0.65).
   * Nilai ini memastikan lingkaran avatar tepat berada di lubang transparan border.
   */
  innerRatio?: number;
  /**
   * Offset horizontal proporsional terhadap ukuran container (-0.1 hingga 0.1).
   */
  offsetX?: number;
  /**
   * Offset vertikal proporsional terhadap ukuran container (-0.1 hingga 0.1).
   */
  offsetY?: number;
  /**
   * Skala border jika memerlukan penyesuaian khusus (default 1.0).
   */
  scale?: number;
  description?: string;
  isReleased?: boolean;
  priceCrystal?: number | null;
  isActive?: boolean;
}

export const RARITY_THEME: Record<
  BorderRarity,
  {
    label: string;
    color: string;
    accent: string;
    bgBadge: string;
    borderBadge: string;
    targetCount: number;
  }
> = {
  Mythic: {
    label: "Mythic",
    color: "#EC4899",
    accent: "#F43F5E",
    bgBadge: "rgba(236, 72, 153, 0.15)",
    borderBadge: "rgba(236, 72, 153, 0.4)",
    targetCount: 5,
  },
  Legends: {
    label: "Legends",
    color: "#F59E0B",
    accent: "#EAB308",
    bgBadge: "rgba(245, 158, 11, 0.15)",
    borderBadge: "rgba(245, 158, 11, 0.4)",
    targetCount: 7,
  },
  Epic: {
    label: "Epic",
    color: "#A855F7",
    accent: "#9333EA",
    bgBadge: "rgba(168, 85, 247, 0.15)",
    borderBadge: "rgba(168, 85, 247, 0.4)",
    targetCount: 9,
  },
  Rare: {
    label: "Rare",
    color: "#3B82F6",
    accent: "#60A5FA",
    bgBadge: "rgba(59, 130, 246, 0.15)",
    borderBadge: "rgba(59, 130, 246, 0.4)",
    targetCount: 10,
  },
  Normal: {
    label: "Normal",
    color: "#10B981",
    accent: "#34D399",
    bgBadge: "rgba(16, 185, 129, 0.15)",
    borderBadge: "rgba(16, 185, 129, 0.4)",
    targetCount: 14,
  },
};

export const BORDER_RARITY_PRICES: Record<BorderRarity, number> = {
  Normal: 1000,
  Rare: 2000,
  Epic: 3000,
  Legends: 4000,
  Mythic: 5000,
};

export function getSafeRarityTheme(rarity?: string | null) {
  if (!rarity) return RARITY_THEME.Normal;
  const clean = String(rarity).trim();
  const normalized = (clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()) as BorderRarity;
  return (
    RARITY_THEME[normalized] ||
    RARITY_THEME[clean as BorderRarity] ||
    (clean.toLowerCase().includes("legend") ? RARITY_THEME.Legends : RARITY_THEME.Normal)
  );
}

export function getSafeBorderPrice(border?: AvatarBorder | null): number {
  if (!border) return 2000;
  if (border.priceCrystal && border.priceCrystal > 0) {
    return border.priceCrystal;
  }
  const clean = String(border.rarity || "Normal").trim();
  const normalized = (clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()) as BorderRarity;
  return (
    BORDER_RARITY_PRICES[normalized] ||
    BORDER_RARITY_PRICES[clean as BorderRarity] ||
    (clean.toLowerCase().includes("legend") ? BORDER_RARITY_PRICES.Legends : 2000)
  );
}

/**
 * Dynamic Border Catalog
 * All borders are sourced dynamically from Supabase (public.avatar_borders_config).
 * No hardcoded static borders are stored in code.
 */
export const AVATAR_BORDERS: AvatarBorder[] = [];

// ─── LIVE IN-MEMORY & PERSISTENT CACHE ─────────────────────────────────────
const _liveCatalogMap = new Map<string, AvatarBorder>();
let _liveCatalogList: AvatarBorder[] = [];

// Kunci cache persistent untuk kecepatan buka aplikasi 0ms (Stale-While-Revalidate)
export const CACHED_BORDER_CATALOG_KEY = "nuenime.cached_border_catalog";

// Inisialisasi cepat dari AsyncStorage saat modul dimuat agar tidak ada jeda loading
AsyncStorage.getItem(CACHED_BORDER_CATALOG_KEY)
  .then((raw) => {
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const seen = new Set<string>();
        const unique: AvatarBorder[] = [];
        parsed.forEach((b: AvatarBorder) => {
          if (b && b.id && !seen.has(b.id)) {
            seen.add(b.id);
            _liveCatalogMap.set(b.id, b);
            unique.push(b);
          }
        });
        _liveCatalogList = unique;
      }
    }
  })
  .catch(() => {});

// Lookup sinkronus cepat (0ms akses langsung dari memori)
export function getBorderById(id: string | null | undefined): AvatarBorder | undefined {
  if (!id) return undefined;
  return _liveCatalogMap.get(id);
}

// Lookup asinkronus (query langsung ke Supabase jika item belum ada di memori lokal)
export async function getBorderByIdAsync(id: string | null | undefined): Promise<AvatarBorder | undefined> {
  if (!id) return undefined;
  const existing = getBorderById(id);
  if (existing && existing.assetUrl) return existing;

  try {
    const { data } = await supabase
      .from("avatar_borders_config")
      .select("id, name, rarity, asset_url, inner_ratio, offset_x, offset_y, scale, is_released, description, price_crystal, is_active")
      .eq("id", id)
      .maybeSingle();

    if (data) {
      const rawRarity = String(data.rarity || "Normal").trim();
      const normRarity = (rawRarity.charAt(0).toUpperCase() + rawRarity.slice(1).toLowerCase()) as BorderRarity;
      const safeRarity = BORDER_RARITIES.includes(normRarity)
        ? normRarity
        : BORDER_RARITIES.includes(rawRarity as BorderRarity)
        ? (rawRarity as BorderRarity)
        : rawRarity.toLowerCase().includes("legend")
        ? "Legends"
        : "Normal";

      const border: AvatarBorder = {
        id: data.id,
        name: data.name || "Border Avatar",
        rarity: safeRarity,
        assetUrl: data.asset_url ?? null,
        innerRatio: Number(data.inner_ratio) > 0 ? Number(data.inner_ratio) : 0.74,
        offsetX: Number(data.offset_x) || 0.0,
        offsetY: Number(data.offset_y) || 0.0,
        scale: Number(data.scale) > 0 ? Number(data.scale) : 1.0,
        isReleased: data.is_released ?? true,
        description: data.description || `Border avatar tingkat ${safeRarity}`,
        priceCrystal: data.price_crystal ? Number(data.price_crystal) : null,
        isActive: data.is_active ?? true,
      };
      _liveCatalogMap.set(border.id, border);
      return border;
    }
  } catch {}

  return existing;
}

export function updateLiveBorderInCache(border: AvatarBorder) {
  _liveCatalogMap.set(border.id, border);
  const idx = _liveCatalogList.findIndex((b) => b.id === border.id);
  if (idx >= 0) {
    _liveCatalogList[idx] = border;
  } else {
    _liveCatalogList = [border, ..._liveCatalogList.filter((b) => b.id !== border.id)];
  }
  AsyncStorage.setItem(CACHED_BORDER_CATALOG_KEY, JSON.stringify(_liveCatalogList)).catch(() => {});
}

export function removeLiveBorderFromCache(id: string) {
  _liveCatalogMap.delete(id);
  _liveCatalogList = _liveCatalogList.filter((b) => b.id !== id);
  AsyncStorage.setItem(CACHED_BORDER_CATALOG_KEY, JSON.stringify(_liveCatalogList)).catch(() => {});
}

export function getBordersByRarity(rarity: BorderRarity): AvatarBorder[] {
  return _liveCatalogList.filter((b) => b.rarity === rarity);
}

/**
 * ─── FETCH KATALOG BORDER FRESH 100% DARI SUPABASE ───
 *
 * Mengambil data segar langsung dari tabel `avatar_borders_config` di Supabase.
 * Tidak ada data bawaan hardcoded di kode.
 * Hasil di-cache ke memori & disk untuk mempertahankan performa super cepat (0ms).
 */
export async function fetchLiveBorderCatalog(): Promise<AvatarBorder[]> {
  try {
    const { data, error } = await supabase
      .from("avatar_borders_config")
      .select("id, name, rarity, asset_url, inner_ratio, offset_x, offset_y, scale, is_released, description, sort_order, price_crystal, is_active")
      .order("sort_order", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      const seen = new Set<string>();
      const fullCatalog: AvatarBorder[] = [];

      for (const row of data) {
        if (!row || !row.id || seen.has(row.id)) continue;
        seen.add(row.id);

        const rawRarity = String(row.rarity || "Normal").trim();
        const normRarity = (rawRarity.charAt(0).toUpperCase() + rawRarity.slice(1).toLowerCase()) as BorderRarity;
        const safeRarity = BORDER_RARITIES.includes(normRarity)
          ? normRarity
          : BORDER_RARITIES.includes(rawRarity as BorderRarity)
          ? (rawRarity as BorderRarity)
          : rawRarity.toLowerCase().includes("legend")
          ? "Legends"
          : "Normal";

        fullCatalog.push({
          id: row.id,
          name: row.name || "Border Avatar",
          rarity: safeRarity,
          assetUrl: row.asset_url ?? null,
          innerRatio: Number(row.inner_ratio) > 0 ? Number(row.inner_ratio) : 0.74,
          offsetX: Number(row.offset_x) || 0.0,
          offsetY: Number(row.offset_y) || 0.0,
          scale: Number(row.scale) > 0 ? Number(row.scale) : 1.0,
          isReleased: row.is_released ?? false,
          description: row.description || `Border avatar tingkat ${safeRarity}`,
          priceCrystal: row.price_crystal ? Number(row.price_crystal) : null,
          isActive: row.is_active ?? true,
        });
      }

      // Update in-memory map & list (0ms sync lookup)
      _liveCatalogMap.clear();
      fullCatalog.forEach((b) => _liveCatalogMap.set(b.id, b));
      _liveCatalogList = fullCatalog;

      // Persist to AsyncStorage for instant 0ms app boot
      AsyncStorage.setItem(CACHED_BORDER_CATALOG_KEY, JSON.stringify(fullCatalog)).catch(() => {});

      return fullCatalog;
    }
  } catch {}

  // Fallback: kembalikan cached list yang ada di memori/storage
  return _liveCatalogList;
}

// ─── STORAGE MANAGEMENT PER-USER ACCOUNT ───
export function getEquippedBorderStorageKey(userId?: string | null): string {
  if (userId && userId.trim().length > 0) {
    return `nuenime.equipped_border.${userId.trim()}`;
  }
  return "nuenime.equipped_border.guest";
}

export function getOwnedBordersStorageKey(userId?: string | null): string {
  if (userId && userId.trim().length > 0) {
    return `nuenime.owned_borders.${userId.trim()}`;
  }
  return "nuenime.owned_borders.guest";
}

/**
 * Listener sistem untuk perubahan border aktif (0ms event-driven reactive sync)
 */
export type BorderEquipListener = (borderId: string | null, userId?: string | null) => void;
const _equipListeners = new Set<BorderEquipListener>();

export function subscribeEquippedBorder(listener: BorderEquipListener): () => void {
  _equipListeners.add(listener);
  return () => {
    _equipListeners.delete(listener);
  };
}

export function notifyEquippedBorderChanged(borderId: string | null, userId?: string | null) {
  _equipListeners.forEach((fn) => {
    try {
      fn(borderId, userId);
    } catch {}
  });
}

/**
 * Mengambil ID border yang sedang aktif untuk akun tertentu
 */
export async function getEquippedBorderId(userId?: string | null): Promise<string | null> {
  try {
    const key = getEquippedBorderStorageKey(userId);
    const val = await AsyncStorage.getItem(key);
    if (val) return val;

    // Fallback: ambil dari Supabase profile jika di local belum ada
    if (userId && userId.trim().length > 0 && userId !== "guest") {
      const { data } = await supabase
        .from("profiles")
        .select("equipped_border")
        .eq("id", userId)
        .maybeSingle();

      if (data?.equipped_border) {
        await AsyncStorage.setItem(key, data.equipped_border);
        return data.equipped_border;
      }
    }

    // Backward-compatibility fallback dengan legacy key
    const legacy = await AsyncStorage.getItem("nuenime.equipped.border");
    if (legacy) return legacy;

    return null;
  } catch {
    return null;
  }
}

/**
 * Menyimpan ID border aktif khusus untuk akun yang login
 */
export async function setEquippedBorderId(
  userId: string | null | undefined,
  borderId: string | null
): Promise<void> {
  const key = getEquippedBorderStorageKey(userId);
  if (borderId) {
    await AsyncStorage.setItem(key, borderId);
    // Sync ke legacy key juga agar komponen lama tetap sinkron
    await AsyncStorage.setItem("nuenime.equipped.border", borderId);
  } else {
    await AsyncStorage.removeItem(key);
    await AsyncStorage.removeItem("nuenime.equipped.border");
  }

  // Notifikasi instan ke seluruh komponen yang aktif di memori (0ms)
  notifyEquippedBorderChanged(borderId, userId);

  // Sinkronkan ke database Supabase profiles.equipped_border secara background
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    try {
      await supabase
        .from("profiles")
        .update({ equipped_border: borderId })
        .eq("id", userId);
    } catch {
      // Non-blocking
    }
  }
}

/**
 * Mengambil daftar ID border yang dimiliki akun tertentu.
 * Prioritas: Supabase user_border_purchases → AsyncStorage cache → default Rare yang rilis.
 */
export async function getOwnedBorderIds(userId?: string | null): Promise<string[]> {
  // 1. Coba ambil dari Supabase jika user valid
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    try {
      const { data, error } = await supabase
        .from("user_border_purchases")
        .select("border_id")
        .eq("user_id", userId);

      if (!error && Array.isArray(data) && data.length > 0) {
        const ids = data.map((r: any) => r.border_id as string);
        // Cache ke AsyncStorage
        const key = getOwnedBordersStorageKey(userId);
        await AsyncStorage.setItem(key, JSON.stringify(ids));
        return ids;
      }
    } catch {}
  }

  // 2. Fallback AsyncStorage
  try {
    const key = getOwnedBordersStorageKey(userId);
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  // 3. Jika akun baru (tidak ada data sama sekali), jangan default-kan pemilikan border gratis.
  //    Kembalikan array kosong — pengguna harus membeli border secara resmi.
  return [];
}

/**
 * Menyimpan daftar border yang dimiliki akun ke AsyncStorage (cache lokal).
 * Untuk pembelian resmi, gunakan purchaseBorderForUser() yang menyinkronkan ke Supabase.
 */
export async function setOwnedBorderIds(
  userId: string | null | undefined,
  borderIds: string[]
): Promise<void> {
  const key = getOwnedBordersStorageKey(userId);
  await AsyncStorage.setItem(key, JSON.stringify(borderIds));
}

/**
 * Mencatat pembelian border baru ke Supabase user_border_purchases.
 * Tidak melakukan pengurangan Crystal — pengurangan dilakukan oleh pemanggil (purchaseBorder).
 * Menggunakan ON CONFLICT DO NOTHING untuk mencegah pembelian ganda.
 */
export async function recordBorderPurchaseToSupabase(
  userId: string,
  border: { id: string; name: string; rarity: string },
  pricePaid: number
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  try {
    // 1. Coba eksekusi fungsi database atomik (aman dari tampering & bypass saldo)
    const { data: rpcData, error: rpcError } = await supabase.rpc("execute_border_purchase", {
      p_user_id: userId,
      p_border_id: border.id,
      p_border_name: border.name,
      p_rarity: border.rarity,
      p_cost: pricePaid,
    });

    if (!rpcError && rpcData && typeof rpcData === "object") {
      if (rpcData.success === false) {
        return { success: false, error: rpcData.error || "Gagal memproses transaksi border" };
      }
      return { success: true, newBalance: rpcData.new_balance };
    }

    // 2. Fallback upsert standar
    const { error } = await supabase.from("user_border_purchases").upsert(
      {
        user_id: userId,
        border_id: border.id,
        border_name: border.name,
        rarity: border.rarity,
        price_paid: pricePaid,
        purchased_at: new Date().toISOString(),
      },
      { onConflict: "user_id,border_id", ignoreDuplicates: true }
    );
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? "unknown" };
  }
}
