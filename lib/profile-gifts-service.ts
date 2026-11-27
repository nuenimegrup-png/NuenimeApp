import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { getCrystalBalance, deductCrystalBalance } from "@/lib/topup-service";
import { isSpecialRole } from "@/lib/admin-service";

export type GiftCurrency = "crystal" | "coin";
export type GiftRarity = "common" | "rare" | "epic" | "legendary";

export interface ProfileGiftItem {
  id: string;
  name: string;
  description: string;
  charisma: number;
  price: number;
  currency: GiftCurrency;
  rarity: GiftRarity;
  imageUrl: string;
  glowColor: string;
  accentColor: string;
}

/**
 * Katalog Gift Profil Nuenime (Mobile Legends Style)
 * Gambar/GIF ini dapat dengan mudah diganti oleh user dengan asset kustom sendiri
 */
export const PROFILE_GIFTS_CATALOG: ProfileGiftItem[] = [
  {
    id: "hanging_chibi",
    name: "Megumi Hanging",
    description: "Chibi Megumi imut yang menggantung menemani profil kamu dengan penuh gaya.",
    charisma: 1500, // 500 * 3
    price: 500,
    currency: "crystal",
    rarity: "rare",
    imageUrl: "https://imagepaste.org/i/xppxc5ys.png",
    glowColor: "rgba(56, 189, 248, 0.6)",
    accentColor: "#38BDF8",
  },
  {
    id: "megumi_sitting",
    name: "Megumi Santai",
    description: "Megumi duduk rileks dengan ekspresi dingin khasnya yang menggemaskan.",
    charisma: 3000, // 1000 * 3
    price: 1000,
    currency: "crystal",
    rarity: "rare",
    imageUrl: "https://imagepaste.org/i/aykk6hkh.png",
    glowColor: "rgba(99, 102, 241, 0.6)",
    accentColor: "#6366F1",
  },
  {
    id: "megumi_burger",
    name: "Megumi Burger",
    description: "Megumi asyik menikmati burger lezat sambil bersantai di atasnya.",
    charisma: 6000, // 2000 * 3
    price: 2000,
    currency: "crystal",
    rarity: "rare",
    imageUrl: "https://imagepaste.org/i/9w7b98c7.png",
    glowColor: "rgba(245, 158, 11, 0.6)",
    accentColor: "#F59E0B",
  },
  {
    id: "inumaki_toa",
    name: "Inumaki Toa",
    description: "Inumaki Toge berteriak dengan megafon melancarkan mantra kutukan suara.",
    charisma: 10500, // 3500 * 3
    price: 3500,
    currency: "crystal",
    rarity: "epic",
    imageUrl: "https://imagepaste.org/i/wcn6g7c5.png",
    glowColor: "rgba(239, 68, 68, 0.6)",
    accentColor: "#EF4444",
  },
  {
    id: "inumaki_panda",
    name: "Inumaki & Panda",
    description: "Inumaki Toge tidur pulas dengan nyaman bersandar pada tubuh hangat Panda.",
    charisma: 15000, // 5000 * 3
    price: 5000,
    currency: "crystal",
    rarity: "epic",
    imageUrl: "https://imagepaste.org/i/rpr7bkmn.png",
    glowColor: "rgba(34, 197, 94, 0.6)",
    accentColor: "#22C55E",
  },
  {
    id: "divine_dogs",
    name: "Yuji & Megumi",
    description: "Duo sahabat Yuji dan Megumi bersama anjing shikigami Divine Dogs.",
    charisma: 30000, // 10000 * 3
    price: 10000,
    currency: "crystal",
    rarity: "epic",
    imageUrl: "https://imagepaste.org/i/fze4drug.png",
    glowColor: "rgba(234, 179, 8, 0.6)",
    accentColor: "#EAB308",
  },
  {
    id: "gojo_proud",
    name: "Gojo Satoru",
    description: "Penyihir jujutsu terkuat Gojo Satoru tersenyum bangga dengan kilauan karisma.",
    charisma: 60000, // 20000 * 3
    price: 20000,
    currency: "crystal",
    rarity: "legendary",
    imageUrl: "https://imagepaste.org/i/j2ftmp7f.png",
    glowColor: "rgba(168, 85, 247, 0.7)",
    accentColor: "#A855F7",
  },
  {
    id: "gojo_geto",
    name: "Gojo & Geto",
    description: "Kenangan masa muda Gojo Satoru menikmati minuman segar bersama Suguru Geto.",
    charisma: 150000, // 50000 * 3
    price: 50000,
    currency: "crystal",
    rarity: "legendary",
    imageUrl: "https://imagepaste.org/i/kuegfqjd.png",
    glowColor: "rgba(244, 63, 94, 0.75)",
    accentColor: "#F43F5E",
  },
];

export const UNIVERSAL_DEFAULT_GIFT_ICON = "https://imagepaste.org/i/ehbjmsh9.png";

export interface UserGiftSummary {
  totalCharisma: number;
  totalGiftsCount: number;
  topGifts: Array<{
    giftId: string;
    giftName: string;
    totalQuantity: number;
    totalCharisma: number;
  }>;
  giftCounts: Record<string, number>;
  equippedGiftId: string | null;
}

export interface ReceivedGiftLog {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderBorder: string | null;
  giftId: string;
  giftName: string;
  giftPrice: number;
  currencyType: GiftCurrency;
  charismaValue: number;
  quantity: number;
  createdAt: string;
}

export interface GiftContributor {
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderBorder: string | null;
  totalCharisma: number;
  totalGiftsCount: number;
}

/**
 * Format angka Charisma (misal: 2000, 18.5K, 1.2M)
 */
export function formatCharisma(val: number): string {
  if (!val || val <= 0) return "0";
  if (val < 10_000) {
    return val.toLocaleString("id-ID");
  }
  if (val < 1_000_000) {
    const formatted = (val / 1000).toFixed(1).replace(/\.0$/, "");
    return `${formatted}K`;
  }
  const formatted = (val / 1_000_000).toFixed(1).replace(/\.0$/, "");
  return `${formatted}M`;
}

/**
 * Mengambil ID gift yang terpasang di profil pengguna
 */
export async function getEquippedProfileGift(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const cached = await AsyncStorage.getItem(`nuenime.equipped_gift.${userId}`);
    if (cached) return cached;

    const { data } = await supabase
      .from("profiles")
      .select("equipped_gift_id")
      .eq("id", userId)
      .maybeSingle();

    if (data && (data as any).equipped_gift_id) {
      const gid = (data as any).equipped_gift_id;
      await AsyncStorage.setItem(`nuenime.equipped_gift.${userId}`, gid);
      return gid;
    }
  } catch (err) {
    console.warn("[getEquippedProfileGift]", err);
  }
  return null;
}

const giftSummaryCache = new Map<string, { data: UserGiftSummary; timestamp: number }>();
const GIFT_SUMMARY_CACHE_TTL = 20_000; // 20 detik in-memory cache

export function invalidateUserGiftSummaryCache(userId?: string | null) {
  if (userId) {
    giftSummaryCache.delete(userId);
  }
}

/**
 * Menyimpan ID gift yang terpasang di profil pengguna
 */
export async function setEquippedProfileGift(userId: string, giftId: string | null): Promise<boolean> {
  if (!userId) return false;
  invalidateUserGiftSummaryCache(userId);
  try {
    if (giftId) {
      await AsyncStorage.setItem(`nuenime.equipped_gift.${userId}`, giftId);
    } else {
      await AsyncStorage.removeItem(`nuenime.equipped_gift.${userId}`);
    }

    try {
      await supabase
        .from("profiles")
        .update({ equipped_gift_id: giftId } as any)
        .eq("id", userId);
    } catch (dbErr) {
      console.warn("[setEquippedProfileGift] DB update warning:", dbErr);
    }

    return true;
  } catch (err) {
    console.warn("[setEquippedProfileGift]", err);
    return false;
  }
}

/**
 * Mengambil ringkasan Charisma dan total Gift yang diterima pengguna
 */
export async function getUserGiftSummary(
  userId: string,
  forceRefresh: boolean = false
): Promise<UserGiftSummary> {
  if (!userId) {
    return { totalCharisma: 0, totalGiftsCount: 0, topGifts: [], giftCounts: {}, equippedGiftId: null };
  }

  // Cek in-memory cache agar super ringan, 0ms, dan hemat CPU
  if (!forceRefresh) {
    const cached = giftSummaryCache.get(userId);
    if (cached && Date.now() - cached.timestamp < GIFT_SUMMARY_CACHE_TTL) {
      return cached.data;
    }
  }

  const equippedGiftId = await getEquippedProfileGift(userId);

  // 1. Coba via RPC Supabase
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("get_user_gift_summary", {
      p_user_id: userId,
    });

    if (!rpcErr && rpcData) {
      const topGifts = Array.isArray(rpcData.top_gifts)
        ? rpcData.top_gifts.map((item: any) => ({
            giftId: item.gift_id,
            giftName: item.gift_name,
            totalQuantity: Number(item.total_quantity ?? 0),
            totalCharisma: Number(item.total_charisma ?? 0),
          }))
        : [];

      const giftCounts: Record<string, number> = {};
      for (const item of topGifts) {
        giftCounts[item.giftId] = item.totalQuantity;
      }

      const summaryResult: UserGiftSummary = {
        totalCharisma: Number(rpcData.total_charisma ?? 0),
        totalGiftsCount: Number(rpcData.total_gifts_count ?? 0),
        topGifts,
        giftCounts,
        equippedGiftId,
      };

      giftSummaryCache.set(userId, { data: summaryResult, timestamp: Date.now() });
      return summaryResult;
    }
  } catch (err) {
    console.warn("[getUserGiftSummary] RPC query:", err);
  }

  // 2. Direct Query Fallback
  try {
    const { data, error } = await supabase
      .from("user_profile_gifts")
      .select("gift_id, gift_name, quantity, charisma_value")
      .eq("recipient_id", userId);

    if (error || !data) {
      const fallbackEmpty: UserGiftSummary = { totalCharisma: 0, totalGiftsCount: 0, topGifts: [], giftCounts: {}, equippedGiftId };
      giftSummaryCache.set(userId, { data: fallbackEmpty, timestamp: Date.now() });
      return fallbackEmpty;
    }

    let totalCharisma = 0;
    let totalGiftsCount = 0;
    const map = new Map<string, { giftId: string; giftName: string; totalQuantity: number; totalCharisma: number }>();
    const giftCounts: Record<string, number> = {};

    for (const row of data) {
      const qty = Number(row.quantity ?? 1);
      const char = Number(row.charisma_value ?? 0) * qty;
      totalCharisma += char;
      totalGiftsCount += qty;

      giftCounts[row.gift_id] = (giftCounts[row.gift_id] || 0) + qty;

      const existing = map.get(row.gift_id);
      if (existing) {
        existing.totalQuantity += qty;
        existing.totalCharisma += char;
      } else {
        map.set(row.gift_id, {
          giftId: row.gift_id,
          giftName: row.gift_name,
          totalQuantity: qty,
          totalCharisma: char,
        });
      }
    }

    const topGifts = Array.from(map.values()).sort((a, b) => b.totalCharisma - a.totalCharisma);
    const result: UserGiftSummary = { totalCharisma, totalGiftsCount, topGifts, giftCounts, equippedGiftId };
    giftSummaryCache.set(userId, { data: result, timestamp: Date.now() });
    return result;
  } catch {
    const fallbackEmpty: UserGiftSummary = { totalCharisma: 0, totalGiftsCount: 0, topGifts: [], giftCounts: {}, equippedGiftId };
    return fallbackEmpty;
  }
}

/**
 * Mengambil riwayat gift yang diterima pengguna
 */
export async function getUserReceivedGiftHistory(
  userId: string,
  limit: number = 20
): Promise<ReceivedGiftLog[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from("user_profile_gifts")
      .select(`
        id,
        sender_id,
        gift_id,
        gift_name,
        gift_price,
        currency_type,
        charisma_value,
        quantity,
        created_at
      `)
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data || data.length === 0) return [];

    // Ambil data profil sender
    const senderIds = Array.from(new Set(data.map((d: any) => d.sender_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, equipped_border")
      .in("id", senderIds);

    const profMap = new Map<string, any>();
    if (profiles) {
      for (const p of profiles) profMap.set(p.id, p);
    }

    return data.map((d: any) => {
      const sender = profMap.get(d.sender_id);
      return {
        id: d.id,
        senderId: d.sender_id,
        senderName: sender?.display_name || sender?.username || "Pengguna Nuenime",
        senderAvatar: sender?.avatar_url || null,
        senderBorder: sender?.equipped_border || null,
        giftId: d.gift_id,
        giftName: d.gift_name,
        giftPrice: Number(d.gift_price ?? 0),
        currencyType: (d.currency_type as GiftCurrency) || "crystal",
        charismaValue: Number(d.charisma_value ?? 0),
        quantity: Number(d.quantity ?? 1),
        createdAt: d.created_at,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Mengambil donatur gift teratas (Top Fans / Contributors) untuk pengguna
 */
export async function getUserTopGiftContributors(
  userId: string,
  limit: number = 10
): Promise<GiftContributor[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from("user_profile_gifts")
      .select("sender_id, charisma_value, quantity")
      .eq("recipient_id", userId);

    if (error || !data || data.length === 0) return [];

    const map = new Map<string, { totalCharisma: number; totalGiftsCount: number }>();
    for (const row of data) {
      const qty = Number(row.quantity ?? 1);
      const char = Number(row.charisma_value ?? 0) * qty;
      const prev = map.get(row.sender_id) || { totalCharisma: 0, totalGiftsCount: 0 };
      map.set(row.sender_id, {
        totalCharisma: prev.totalCharisma + char,
        totalGiftsCount: prev.totalGiftsCount + qty,
      });
    }

    const sortedSenderIds = Array.from(map.entries())
      .sort((a, b) => b[1].totalCharisma - a[1].totalCharisma)
      .slice(0, limit);

    if (sortedSenderIds.length === 0) return [];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, equipped_border")
      .in("id", sortedSenderIds.map((s) => s[0]));

    const profMap = new Map<string, any>();
    if (profiles) {
      for (const p of profiles) profMap.set(p.id, p);
    }

    return sortedSenderIds.map(([senderId, stats]) => {
      const sender = profMap.get(senderId);
      return {
        senderId,
        senderName: sender?.display_name || sender?.username || "Pengguna Nuenime",
        senderAvatar: sender?.avatar_url || null,
        senderBorder: sender?.equipped_border || null,
        totalCharisma: stats.totalCharisma,
        totalGiftsCount: stats.totalGiftsCount,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Mengirim Gift ke Profil Pengguna
 */
export async function sendProfileGift(params: {
  senderId: string;
  recipientId: string;
  giftId: string;
  quantity: number;
}): Promise<{
  success: boolean;
  message?: string;
  newBalance?: number;
  charismaAdded?: number;
}> {
  const { senderId, recipientId, giftId, quantity } = params;

  if (!senderId || senderId === "guest") {
    throw new Error("Silakan masuk akun terlebih dahulu untuk mengirim gift.");
  }
  if (!recipientId) {
    throw new Error("Profil penerima tidak valid.");
  }
  if (senderId === recipientId) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", senderId)
      .maybeSingle();
    const canSelfTest = prof?.role ? isSpecialRole(prof.role) : false;
    if (!canSelfTest) {
      throw new Error("Tidak dapat mengirim gift ke profil sendiri. Kunjungi profil teman untuk mengirimkan gift.");
    }
  }

  const gift = PROFILE_GIFTS_CATALOG.find((g) => g.id === giftId);
  if (!gift) {
    throw new Error("Gift tidak ditemukan di katalog.");
  }

  const safeQuantity = Math.max(1, Math.floor(quantity));
  const totalPrice = gift.price * safeQuantity;
  const totalCharisma = gift.charisma * safeQuantity;

  // 1. Validasi & Kurangi Saldo Crystal jika mata uangnya crystal
  let newBalance: number | undefined;
  if (gift.currency === "crystal") {
    const currentBalance = await getCrystalBalance(senderId);
    if (currentBalance < totalPrice) {
      throw new Error(
        `Saldo Dylan Crystal kamu tidak mencukupi (${currentBalance} Crystal). Diperlukan ${totalPrice} Crystal.`
      );
    }

    newBalance = await deductCrystalBalance(senderId, totalPrice);
  }

  // 2. Simpan transaksi pengiriman gift ke Supabase
  const { error: insertErr } = await supabase.from("user_profile_gifts").insert({
    sender_id: senderId,
    recipient_id: recipientId,
    gift_id: gift.id,
    gift_name: gift.name,
    gift_price: gift.price,
    currency_type: gift.currency,
    charisma_value: gift.charisma,
    quantity: safeQuantity,
  });

  if (insertErr) {
    console.warn("[sendProfileGift] Supabase insert warning:", insertErr);
  }

  // 3. Cache optimis di storage lokal penerima untuk performa instan
  try {
    const summaryKey = `nuenime.profile_gifts_summary.${recipientId}`;
    const cached = await AsyncStorage.getItem(summaryKey);
    const prevChar = cached ? Number(cached) : 0;
    await AsyncStorage.setItem(summaryKey, String(prevChar + totalCharisma));
  } catch {}

  invalidateUserGiftSummaryCache(recipientId);

  return {
    success: true,
    message: `Berhasil mengirim ${safeQuantity}x ${gift.name}! (+${totalCharisma} Charisma)`,
    newBalance,
    charismaAdded: totalCharisma,
  };
}

export interface ProfileCharismaLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  equippedBorder: string | null;
  role: string | null;
  isVip: boolean;
  memberNumber: number | null;
  level: number;
  charismaCount: number;
}

let charismaLeaderboardCache: { data: ProfileCharismaLeaderboardEntry[]; timestamp: number } | null = null;
const CHARISMA_LEADERBOARD_CACHE_TTL = 30_000; // 30 detik

/**
 * Mengambil papan peringkat Top Charisma (Pengguna dengan Charisma Terbanyak dari Gift)
 */
export async function getTopCharismaLeaderboard(
  limit: number = 50,
  forceRefresh: boolean = false
): Promise<ProfileCharismaLeaderboardEntry[]> {
  if (!forceRefresh && charismaLeaderboardCache && Date.now() - charismaLeaderboardCache.timestamp < CHARISMA_LEADERBOARD_CACHE_TTL) {
    return charismaLeaderboardCache.data.slice(0, limit);
  }

  // 1. Coba panggil RPC get_top_charisma_leaderboard
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_top_charisma_leaderboard", {
      p_limit: limit,
    });

    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      const results: ProfileCharismaLeaderboardEntry[] = rpcData.map((row: any, idx: number) => ({
        rank: Number(row.rank ?? idx + 1),
        userId: row.user_id,
        username: row.username ?? "Pengguna",
        displayName: row.display_name ?? row.username ?? "Pengguna",
        avatarUrl: row.avatar_url || null,
        equippedBorder: row.equipped_border || null,
        role: row.role || null,
        isVip: Boolean(row.is_vip),
        memberNumber: row.member_number ? Number(row.member_number) : null,
        level: Number(row.level ?? 1),
        charismaCount: Number(row.charisma_count ?? 0),
      }));

      charismaLeaderboardCache = { data: results, timestamp: Date.now() };
      return results;
    }
  } catch (err) {
    console.warn("[getTopCharismaLeaderboard] RPC query:", err);
  }

  // 2. Fallback: Direct Query jika RPC belum dimigrasikan
  try {
    const { data: giftRows } = await supabase
      .from("user_profile_gifts")
      .select("recipient_id, charisma_value, quantity");

    const countsMap = new Map<string, number>();
    if (giftRows && Array.isArray(giftRows)) {
      for (const row of giftRows) {
        if (row.recipient_id) {
          const qty = Number(row.quantity ?? 1);
          const val = Number(row.charisma_value ?? 0) * qty;
          countsMap.set(row.recipient_id, (countsMap.get(row.recipient_id) || 0) + val);
        }
      }
    }

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, equipped_border, role, is_vip, member_number, level, exp")
      .or("role.is.null,role.ilike.member")
      .limit(100);

    const validProfiles = (profilesData || []).filter((p: any) => !isSpecialRole(p.role));

    const sorted = validProfiles
      .map((p: any) => ({
        userId: p.id,
        username: p.username || "Pengguna",
        displayName: p.display_name || p.username || "Pengguna",
        avatarUrl: p.avatar_url || null,
        equippedBorder: p.equipped_border || null,
        role: p.role || null,
        isVip: Boolean(p.is_vip),
        memberNumber: p.member_number ? Number(p.member_number) : null,
        level: Number(p.level ?? 1),
        exp: Number(p.exp ?? 0),
        charismaCount: countsMap.get(p.id) || 0,
      }))
      .filter((p) => p.charismaCount > 0)
      .sort((a, b) => {
        if (b.charismaCount !== a.charismaCount) return b.charismaCount - a.charismaCount;
        if (b.level !== a.level) return b.level - a.level;
        return b.exp - a.exp;
      })
      .slice(0, limit);

    const results: ProfileCharismaLeaderboardEntry[] = sorted.map((item, idx) => ({
      rank: idx + 1,
      userId: item.userId,
      username: item.username,
      displayName: item.displayName,
      avatarUrl: item.avatarUrl,
      equippedBorder: item.equippedBorder,
      role: item.role,
      isVip: item.isVip,
      memberNumber: item.memberNumber,
      level: item.level,
      charismaCount: item.charismaCount,
    }));

    charismaLeaderboardCache = { data: results, timestamp: Date.now() };
    return results;
  } catch (err) {
    console.warn("[getTopCharismaLeaderboard] Fallback error:", err);
    return [];
  }
}

