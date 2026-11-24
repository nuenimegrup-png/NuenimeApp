import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { isSpecialRole } from "@/lib/admin-service";
import { batchPreloadClanProfiles } from "@/lib/global-chat-service";

export interface ProfileLikeResult {
  count: number;
  hasLiked: boolean;
}

export interface ProfileLikesLeaderboardEntry {
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
  likesCount: number;
}

// In-memory cache untuk performa tinggi & zero latency
const likesCountCache = new Map<string, number>();
const userLikedCache = new Map<string, boolean>();
let likesLeaderboardCache: { data: ProfileLikesLeaderboardEntry[]; timestamp: number } | null = null;
const LEADERBOARD_CACHE_TTL = 30_000; // 30 detik

/**
 * Format angka likes persis seperti referensi screenshot (misal: 18.3K, 1.2M, 500)
 */
export function formatLikeCount(count: number): string {
  if (!count || count <= 0) return "0";
  if (count < 1000) return String(count);
  if (count < 1_000_000) {
    const formatted = (count / 1000).toFixed(1).replace(/\.0$/, "");
    return `${formatted}K`;
  }
  const formatted = (count / 1_000_000).toFixed(1).replace(/\.0$/, "");
  return `${formatted}M`;
}

/**
 * Mengambil total like akun dan status apakah current user sudah me-like
 */
export async function getProfileLikes(
  targetUserId: string,
  currentUserId?: string | null
): Promise<ProfileLikeResult> {
  if (!targetUserId) return { count: 0, hasLiked: false };

  let count = likesCountCache.get(targetUserId) ?? 0;
  let hasLiked = currentUserId ? (userLikedCache.get(`${currentUserId}_${targetUserId}`) ?? false) : false;

  // 1. Baca cache lokal dulu agar UI instan
  try {
    const localCount = await AsyncStorage.getItem(`nuenime.profile_likes.${targetUserId}`);
    if (localCount !== null) {
      count = Math.max(count, parseInt(localCount, 10) || 0);
    }
    if (currentUserId) {
      const localLiked = await AsyncStorage.getItem(`nuenime.profile_liked.${currentUserId}.${targetUserId}`);
      if (localLiked !== null) {
        hasLiked = localLiked === "1";
      }
    }
  } catch {}

  // 2. Query data real dari Supabase (dengan graceful fallback)
  try {
    const { count: realCount, error: countErr } = await supabase
      .from("user_profile_likes")
      .select("id", { count: "exact", head: true })
      .eq("target_user_id", targetUserId);

    if (!countErr && typeof realCount === "number") {
      count = realCount;
      likesCountCache.set(targetUserId, count);
      void AsyncStorage.setItem(`nuenime.profile_likes.${targetUserId}`, String(count)).catch(() => {});
    }

    if (currentUserId && currentUserId !== "guest") {
      const { data: userLike, error: likeErr } = await supabase
        .from("user_profile_likes")
        .select("id")
        .eq("target_user_id", targetUserId)
        .eq("liker_user_id", currentUserId)
        .maybeSingle();

      if (!likeErr) {
        hasLiked = Boolean(userLike);
        userLikedCache.set(`${currentUserId}_${targetUserId}`, hasLiked);
        void AsyncStorage.setItem(`nuenime.profile_liked.${currentUserId}.${targetUserId}`, hasLiked ? "1" : "0").catch(() => {});
      }
    }
  } catch (err) {
    // Graceful offline fallback
  }

  return { count, hasLiked };
}

/**
 * Melakukan toggle Like / Batal Like pada suatu profil akun
 */
export async function toggleProfileLike(
  targetUserId: string,
  currentUserId: string
): Promise<ProfileLikeResult> {
  if (!targetUserId || !currentUserId || currentUserId === "guest") {
    throw new Error("Silakan masuk akun terlebih dahulu untuk menyukai profil.");
  }

  if (targetUserId === currentUserId) {
    throw new Error("Tidak dapat menyukai akun sendiri.");
  }

  // Cek status saat ini
  let currentLiked = userLikedCache.get(`${currentUserId}_${targetUserId}`);
  if (currentLiked === undefined) {
    const local = await AsyncStorage.getItem(`nuenime.profile_liked.${currentUserId}.${targetUserId}`);
    currentLiked = local === "1";
  }

  let count = likesCountCache.get(targetUserId) ?? 0;
  const newLiked = !currentLiked;
  const newCount = Math.max(0, count + (newLiked ? 1 : -1));

  // Optimistic update di memori & storage lokal
  userLikedCache.set(`${currentUserId}_${targetUserId}`, newLiked);
  likesCountCache.set(targetUserId, newCount);
  void AsyncStorage.setItem(`nuenime.profile_liked.${currentUserId}.${targetUserId}`, newLiked ? "1" : "0").catch(() => {});
  void AsyncStorage.setItem(`nuenime.profile_likes.${targetUserId}`, String(newCount)).catch(() => {});

  // Update ke database Supabase
  try {
    if (newLiked) {
      await supabase.from("user_profile_likes").insert({
        target_user_id: targetUserId,
        liker_user_id: currentUserId,
      });
    } else {
      await supabase
        .from("user_profile_likes")
        .delete()
        .eq("target_user_id", targetUserId)
        .eq("liker_user_id", currentUserId);
    }
  } catch (err) {
    console.warn("[toggleProfileLike] Supabase error:", err);
  }

  return { count: newCount, hasLiked: newLiked };
}

/**
 * Mengambil papan peringkat Top Profile Likes (Profil Terpopuler)
 */
export async function getTopProfileLikesLeaderboard(
  limit: number = 50,
  forceRefresh: boolean = false
): Promise<ProfileLikesLeaderboardEntry[]> {
  if (!forceRefresh && likesLeaderboardCache && Date.now() - likesLeaderboardCache.timestamp < LEADERBOARD_CACHE_TTL) {
    return likesLeaderboardCache.data.slice(0, limit);
  }

  // 1. Coba panggil RPC get_top_profile_likes_leaderboard
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_top_profile_likes_leaderboard", {
      p_limit: limit,
    });

    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      const results: ProfileLikesLeaderboardEntry[] = rpcData.map((row: any, idx: number) => ({
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
        likesCount: Number(row.likes_count ?? 0),
      }));

      likesLeaderboardCache = { data: results, timestamp: Date.now() };
      batchPreloadClanProfiles(results.map((r) => r.userId)).catch(() => {});
      return results;
    }
  } catch (err) {
    console.warn("[getTopProfileLikesLeaderboard] RPC query:", err);
  }

  // 2. Fallback: Direct Query jika RPC belum dimigrasikan
  try {
    const { data: likesRows } = await supabase
      .from("user_profile_likes")
      .select("target_user_id");

    const countsMap = new Map<string, number>();
    if (likesRows && Array.isArray(likesRows)) {
      for (const row of likesRows) {
        if (row.target_user_id) {
          countsMap.set(row.target_user_id, (countsMap.get(row.target_user_id) || 0) + 1);
        }
      }
    }

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, equipped_border, role, is_vip, member_number, level, exp")
      .or("role.is.null,role.ilike.member")
      .limit(100);

    const validProfiles = (profilesData || []).filter((p: any) => !isSpecialRole(p.role));

    const sorted = validProfiles.map((p: any) => {
      const likesCount = countsMap.get(p.id) || 0;
      return {
        userId: p.id,
        username: p.username ?? "Pengguna",
        displayName: p.display_name ?? p.username ?? "Pengguna",
        avatarUrl: p.avatar_url || null,
        equippedBorder: p.equipped_border || null,
        role: p.role || null,
        isVip: Boolean(p.is_vip),
        memberNumber: p.member_number ? Number(p.member_number) : null,
        level: Number(p.level ?? 1),
        likesCount,
        exp: Number(p.exp ?? 0),
      };
    }).sort((a, b) => {
      if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount;
      if (b.level !== a.level) return b.level - a.level;
      return b.exp - a.exp;
    });

    const results: ProfileLikesLeaderboardEntry[] = sorted.slice(0, limit).map((item, idx) => ({
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
      likesCount: item.likesCount,
    }));

    likesLeaderboardCache = { data: results, timestamp: Date.now() };
    batchPreloadClanProfiles(results.map((r) => r.userId)).catch(() => {});
    return results;
  } catch (fallbackErr) {
    console.warn("[getTopProfileLikesLeaderboard] Fallback error:", fallbackErr);
    return [];
  }
}

