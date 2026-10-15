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

/**
 * ─── KATALOG 45 BORDER AVATAR NUENIME ───
 * - Mythic: 5 border
 * - Legends: 7 border
 * - Epic: 9 border
 * - Rare: 10 border (10 asset URL resmi dari user terintegrasi)
 * - Normal: 14 border
 * Total: 45 border
 */
export const AVATAR_BORDERS: AvatarBorder[] = [
  // ─── 1. MYTHIC (5 border) ───
  {
    id: "mythic_01",
    name: "Divine Celestial",
    rarity: "Mythic",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Border berkekuatan kosmik tingkat Mythic (Akan segera hadir).",
  },
  {
    id: "mythic_02",
    name: "Dragon Emperor",
    rarity: "Mythic",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Border mahkota naga suci tingkat Mythic (Akan segera hadir).",
  },
  {
    id: "mythic_03",
    name: "Void Archon",
    rarity: "Mythic",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Kekuatan kehampaan abadi tingkat Mythic (Akan segera hadir).",
  },
  {
    id: "mythic_04",
    name: "Genesis Aura",
    rarity: "Mythic",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Pancaran awal semesta tingkat Mythic (Akan segera hadir).",
  },
  {
    id: "mythic_05",
    name: "Eternal Chrono",
    rarity: "Mythic",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Penjaga dimensi waktu tingkat Mythic (Akan segera hadir).",
  },

  // ─── 2. LEGENDS (7 border) ───
  {
    id: "legends_01",
    name: "Solar Monarch",
    rarity: "Legends",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Mahkota emas penguasa surya tingkat Legends (Akan segera hadir).",
  },
  {
    id: "legends_02",
    name: "Phoenix Rebirth",
    rarity: "Legends",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Sayap burung api abadi tingkat Legends (Akan segera hadir).",
  },
  {
    id: "legends_03",
    name: "Valkyrie Grace",
    rarity: "Legends",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Pelindung suci asgard tingkat Legends (Akan segera hadir).",
  },
  {
    id: "legends_04",
    name: "Thunder Sovereign",
    rarity: "Legends",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Kilatan petir sang raja petir tingkat Legends (Akan segera hadir).",
  },
  {
    id: "legends_05",
    name: "Aether Sentinel",
    rarity: "Legends",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Penjaga batas ether tingkat Legends (Akan segera hadir).",
  },
  {
    id: "legends_06",
    name: "Abyssal Leviathan",
    rarity: "Legends",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Penguasa samudra terdalam tingkat Legends (Akan segera hadir).",
  },
  {
    id: "legends_07",
    name: "Starlight Knight",
    rarity: "Legends",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Bintang pelindung kesatria malam tingkat Legends (Akan segera hadir).",
  },

  // ─── 3. EPIC (9 border) ───
  {
    id: "epic_01",
    name: "Phantom Mirage",
    rarity: "Epic",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Bayangan misterius dunia bayangan tingkat Epic (Akan segera hadir).",
  },
  {
    id: "epic_02",
    name: "Frostbite Sigil",
    rarity: "Epic",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Kristal es abadi kutub utara tingkat Epic (Akan segera hadir).",
  },
  {
    id: "epic_03",
    name: "Infernal Blaze",
    rarity: "Epic",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Kobaran magma berkobar tingkat Epic (Akan segera hadir).",
  },
  {
    id: "epic_04",
    name: "Storm Bringer",
    rarity: "Epic",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Pusaran angin badai tingkat Epic (Akan segera hadir).",
  },
  {
    id: "epic_05",
    name: "Venomous Shadow",
    rarity: "Epic",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Racun mematikan malam hari tingkat Epic (Akan segera hadir).",
  },
  {
    id: "epic_06",
    name: "Rune Guardian",
    rarity: "Epic",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Aksara kuno pelindung jiwa tingkat Epic (Akan segera hadir).",
  },
  {
    id: "epic_07",
    name: "Blood Moon",
    rarity: "Epic",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Pancaran bulan merah tingkat Epic (Akan segera hadir).",
  },
  {
    id: "epic_08",
    name: "Arcane Nova",
    rarity: "Epic",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Ledakan energi magis tingkat Epic (Akan segera hadir).",
  },
  {
    id: "epic_09",
    name: "Golden Aegis",
    rarity: "Epic",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Perisai emas kehormatan tingkat Epic (Akan segera hadir).",
  },

  // ─── 4. RARE (10 border — SEMUA ASET RESMI TERINTEGRASI) ───
  {
    id: "rare_01",
    name: "Azure Dragon",
    rarity: "Rare",
    assetUrl: "https://i.ibb.co.com/sdfKwzT2/1.png",
    innerRatio: 0.74,
    offsetX: 0.0,
    offsetY: 0.0,
    isReleased: true,
    description: "Bingkai berornamen naga biru samudra mistis dengan lingkar kristal.",
  },
  {
    id: "rare_02",
    name: "Crimson Flame",
    rarity: "Rare",
    assetUrl: "https://i.ibb.co.com/ZzvLgMch/2.png",
    innerRatio: 0.74,
    offsetX: 0.0,
    offsetY: 0.0,
    isReleased: true,
    description: "Bingkai kobaran api merah membara yang mengelilingi avatar.",
  },
  {
    id: "rare_03",
    name: "Emerald Bloom",
    rarity: "Rare",
    assetUrl: "https://i.ibb.co.com/ZzmjPPHB/3.png",
    innerRatio: 0.74,
    offsetX: 0.0,
    offsetY: 0.0,
    isReleased: true,
    description: "Sentuhan zamrud alami berpadu aura hijau hutan magis.",
  },
  {
    id: "rare_04",
    name: "Golden Sovereign",
    rarity: "Rare",
    assetUrl: "https://i.ibb.co.com/x8Ysr5cq/4.png",
    innerRatio: 0.74,
    offsetX: 0.0,
    offsetY: 0.0,
    isReleased: true,
    description: "Ornamen emas bangsawan dengan ukiran sayap yang anggun.",
  },
  {
    id: "rare_05",
    name: "Abyssal Shadow",
    rarity: "Rare",
    assetUrl: "https://i.ibb.co.com/zwxRY8Y/5.png",
    innerRatio: 0.74,
    offsetX: 0.0,
    offsetY: 0.0,
    isReleased: true,
    description: "Sentuhan energi ungu malam gelap dengan aksen kristal tajam.",
  },
  {
    id: "rare_06",
    name: "Celestial Violet",
    rarity: "Rare",
    assetUrl: "https://i.ibb.co.com/k6htGsZL/6.png",
    innerRatio: 0.74,
    offsetX: 0.0,
    offsetY: 0.0,
    isReleased: true,
    description: "Bingkai kosmik ungu bertahtakan ornamen mahkota bintang.",
  },
  {
    id: "rare_07",
    name: "Silver Crest",
    rarity: "Rare",
    assetUrl: "https://i.ibb.co.com/Nn1PXwqB/7.png",
    innerRatio: 0.74,
    offsetX: 0.0,
    offsetY: 0.0,
    isReleased: true,
    description: "Lingkar perak berkilau dengan proporsi lubang avatar sempurna.",
  },
  {
    id: "rare_08",
    name: "Gilded Phoenix",
    rarity: "Rare",
    assetUrl: "https://i.ibb.co.com/1fhNKGFL/8.png",
    innerRatio: 0.74,
    offsetX: 0.0,
    offsetY: 0.0,
    isReleased: true,
    description: "Ukiran bulu phoenix emas yang memancarkan aura kebangkitan.",
  },
  {
    id: "rare_09",
    name: "Frozen Mirage",
    rarity: "Rare",
    assetUrl: "https://i.ibb.co.com/Zzr9Svyq/9.png",
    innerRatio: 0.74,
    offsetX: 0.0,
    offsetY: 0.0,
    isReleased: true,
    description: "Kristal es dingin berkilau dengan efek refleksi embun salju.",
  },
  {
    id: "rare_10",
    name: "Solar Flare",
    rarity: "Rare",
    assetUrl: "https://i.ibb.co.com/RMNmBBk/10.png",
    innerRatio: 0.74,
    offsetX: 0.0,
    offsetY: 0.0,
    isReleased: true,
    description: "Ledakan cahaya matahari dengan dekorasi suci bermotif surya.",
  },

  // ─── 5. NORMAL (14 border) ───
  {
    id: "normal_01",
    name: "Iron Ring",
    rarity: "Normal",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Bingkai besi sederhana tingkat Normal (Akan segera hadir).",
  },
  {
    id: "normal_02",
    name: "Bronze Edge",
    rarity: "Normal",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Bingkai perunggu petualang tingkat Normal (Akan segera hadir).",
  },
  {
    id: "normal_03",
    name: "Wooden Oak",
    rarity: "Normal",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Bingkai kayu hutan tingkat Normal (Akan segera hadir).",
  },
  {
    id: "normal_04",
    name: "Stone Border",
    rarity: "Normal",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Bingkai batu kokoh tingkat Normal (Akan segera hadir).",
  },
  {
    id: "normal_05",
    name: "Novice Circle",
    rarity: "Normal",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Lingkar dasar pemula tingkat Normal (Akan segera hadir).",
  },
  {
    id: "normal_06",
    name: "Green Leaf",
    rarity: "Normal",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Aksen dedaunan hijau tingkat Normal (Akan segera hadir).",
  },
  {
    id: "normal_07",
    name: "Copper Ring",
    rarity: "Normal",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Lingkar tembaga berkilau tingkat Normal (Akan segera hadir).",
  },
  {
    id: "normal_08",
    name: "Bamboo Rim",
    rarity: "Normal",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Anyaman bambu alami tingkat Normal (Akan segera hadir).",
  },
  {
    id: "normal_09",
    name: "River Pebble",
    rarity: "Normal",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Susunan batu kali tingkat Normal (Akan segera hadir).",
  },
  {
    id: "normal_10",
    name: "Leather Strap",
    rarity: "Normal",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Ikat kulit pengelana tingkat Normal (Akan segera hadir).",
  },
  {
    id: "normal_11",
    name: "Simple Steel",
    rarity: "Normal",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Baja polos rapi tingkat Normal (Akan segera hadir).",
  },
  {
    id: "normal_12",
    name: "Clay Mold",
    rarity: "Normal",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Ukiran tembikar tingkat Normal (Akan segera hadir).",
  },
  {
    id: "normal_13",
    name: "Forest Twig",
    rarity: "Normal",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Ranting pohon pelindung tingkat Normal (Akan segera hadir).",
  },
  {
    id: "normal_14",
    name: "Plain Ribbon",
    rarity: "Normal",
    assetUrl: null,
    innerRatio: 0.74,
    isReleased: false,
    description: "Pita sederhana penyambut petualang tingkat Normal (Akan segera hadir).",
  },
];

// Helper lookup
export function getBorderById(id: string | null | undefined): AvatarBorder | undefined {
  if (!id) return undefined;
  return AVATAR_BORDERS.find((b) => b.id === id);
}

export function getBordersByRarity(rarity: BorderRarity): AvatarBorder[] {
  return AVATAR_BORDERS.filter((b) => b.rarity === rarity);
}

/**
 * ─── FETCH KATALOG BORDER DINAMIS DARI SUPABASE ───
 *
 * Mengambil data border dari tabel `avatar_borders_config` di Supabase
 * dan menggabungkannya (merge/override) ke AVATAR_BORDERS static.
 *
 * Logika override:
 * - Jika admin set is_released = true + asset_url → border langsung aktif di Shop
 * - Jika admin masih kosong / is_released = false → border tetap "Segera Hadir"
 *
 * Hasil dikembalikan sebagai array baru (tidak mutasi AVATAR_BORDERS).
 * Fallback: kembalikan AVATAR_BORDERS asli jika offline / tabel kosong.
 */
export async function fetchLiveBorderCatalog(): Promise<AvatarBorder[]> {
  try {
    const { data, error } = await supabase
      .from("avatar_borders_config")
      .select("id, name, rarity, asset_url, inner_ratio, offset_x, offset_y, scale, is_released, description, sort_order")
      .order("sort_order", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      // Buat map dari data DB untuk lookup cepat
      const dbMap = new Map<string, any>();
      data.forEach((row: any) => dbMap.set(row.id, row));

      // Override data static dengan data dari DB
      return AVATAR_BORDERS.map((border) => {
        const dbRow = dbMap.get(border.id);
        if (!dbRow) return border;

        return {
          ...border,
          // Override field yang bisa diubah admin:
          assetUrl: dbRow.asset_url ?? border.assetUrl,
          isReleased: dbRow.is_released ?? border.isReleased,
          innerRatio: dbRow.inner_ratio ?? border.innerRatio,
          offsetX: dbRow.offset_x ?? border.offsetX,
          offsetY: dbRow.offset_y ?? border.offsetY,
          scale: dbRow.scale ?? border.scale,
          description: dbRow.description ?? border.description,
        };
      });
    }
  } catch {}

  // Fallback: kembalikan data static jika offline atau tabel kosong
  return AVATAR_BORDERS;
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
): Promise<{ success: boolean; error?: string }> {
  try {
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
