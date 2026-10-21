import { supabase } from "./supabase";

export type FriendshipStatus =
  | "none"
  | "pending_sent"
  | "pending_received"
  | "accepted"
  | "blocked";

export interface FriendUser {
  id: string;
  friendshipId?: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl?: string | null;
  equippedBorder: string | null;
  level: number;
  exp: number;
  memberNumber: string;
  role: string;
  isVip: boolean;
  bio?: string | null;
  status: "pending" | "accepted" | "blocked" | "none";
  direction?: "incoming" | "outgoing";
  createdAt?: string;
}

/**
 * Format nomor member menjadi string 7 digit dengan prefix '#' (contoh: #1075752).
 */
export function formatMemberNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined || num === "") return "#0000001";
  const str = String(num).replace(/[^0-9]/g, "");
  if (!str) return "#0000001";
  return "#" + str.padStart(7, "0");
}

/**
 * Mengambil daftar teman resmi akun tertentu (status = 'accepted').
 */
export async function getFriends(userId: string): Promise<FriendUser[]> {
  if (!userId || userId === "guest") return [];

  try {
    // 1. Ambil baris pertemanan yang sudah diterima
    const { data: rows, error: fError } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, status, created_at")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq("status", "accepted");

    if (fError || !rows || rows.length === 0) return [];

    // 2. Kumpulkan ID teman (lawan bicara)
    const otherUserMap = new Map<string, { friendshipId: string; createdAt: string }>();
    rows.forEach((r) => {
      const otherId = r.user_id === userId ? r.friend_id : r.user_id;
      if (otherId && otherId !== userId) {
        otherUserMap.set(otherId, { friendshipId: r.id, createdAt: r.created_at });
      }
    });

    const otherIds = Array.from(otherUserMap.keys());
    if (otherIds.length === 0) return [];

    // 3. Ambil data profil teman
    const { data: profiles, error: pError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, banner_url, equipped_border, level, exp, member_number, role, is_vip, bio")
      .in("id", otherIds);

    if (pError || !profiles) return [];

    return profiles.map((p) => {
      const meta = otherUserMap.get(p.id);
      return {
        id: p.id,
        friendshipId: meta?.friendshipId,
        username: p.username || "pengguna",
        displayName: p.display_name || p.username || "Pengguna Nuenime",
        avatarUrl: p.avatar_url || null,
        bannerUrl: p.banner_url || null,
        equippedBorder: p.equipped_border || null,
        level: Number(p.level) || 1,
        exp: Number(p.exp) || 0,
        memberNumber: formatMemberNumber(p.member_number),
        role: p.role || "Member",
        isVip: Boolean(p.is_vip),
        bio: p.bio || null,
        status: "accepted",
        createdAt: meta?.createdAt,
      };
    });
  } catch (err) {
    console.warn("[friends-service] getFriends error:", err);
    return [];
  }
}

/**
 * Mengambil daftar permintaan pertemanan yang masuk (pending).
 */
export async function getIncomingFriendRequests(userId: string): Promise<FriendUser[]> {
  if (!userId || userId === "guest") return [];

  try {
    const { data: rows, error: fError } = await supabase
      .from("friendships")
      .select("id, user_id, status, created_at")
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (fError || !rows || rows.length === 0) return [];

    const requesterMap = new Map<string, { friendshipId: string; createdAt: string }>();
    rows.forEach((r) => {
      requesterMap.set(r.user_id, { friendshipId: r.id, createdAt: r.created_at });
    });

    const requesterIds = Array.from(requesterMap.keys());
    const { data: profiles, error: pError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, banner_url, equipped_border, level, exp, member_number, role, is_vip, bio")
      .in("id", requesterIds);

    if (pError || !profiles) return [];

    return profiles.map((p) => {
      const meta = requesterMap.get(p.id);
      return {
        id: p.id,
        friendshipId: meta?.friendshipId,
        username: p.username || "pengguna",
        displayName: p.display_name || p.username || "Pengguna Nuenime",
        avatarUrl: p.avatar_url || null,
        bannerUrl: p.banner_url || null,
        equippedBorder: p.equipped_border || null,
        level: Number(p.level) || 1,
        exp: Number(p.exp) || 0,
        memberNumber: formatMemberNumber(p.member_number),
        role: p.role || "Member",
        isVip: Boolean(p.is_vip),
        bio: p.bio || null,
        status: "pending",
        direction: "incoming",
        createdAt: meta?.createdAt,
      };
    });
  } catch (err) {
    console.warn("[friends-service] getIncomingFriendRequests error:", err);
    return [];
  }
}

/**
 * Mengambil status pertemanan antara pengguna saat ini dan target profil.
 */
export async function getFriendshipStatus(
  currentUserId: string,
  targetUserId: string
): Promise<FriendshipStatus> {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) return "none";

  try {
    const { data, error } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, status")
      .or(
        `and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`
      )
      .maybeSingle();

    if (error || !data) return "none";

    if (data.status === "accepted") return "accepted";
    if (data.status === "blocked") return "blocked";
    if (data.status === "pending") {
      return data.user_id === currentUserId ? "pending_sent" : "pending_received";
    }

    return "none";
  } catch {
    return "none";
  }
}

/**
 * Mengirim permintaan pertemanan ke pengguna lain dan mengirimkan notifikasi resmi.
 */
export async function sendFriendRequest(
  fromUserId: string,
  toUserId: string,
  fromUserName?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!fromUserId || !toUserId) return { success: false, error: "ID pengguna tidak valid." };
  if (fromUserId === toUserId) return { success: false, error: "Tidak dapat menambahkan diri sendiri." };

  try {
    // 1. Simpan baris pertemanan (pending)
    const { error: insErr } = await supabase.from("friendships").upsert(
      {
        user_id: fromUserId,
        friend_id: toUserId,
        status: "pending",
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,friend_id" }
    );

    if (insErr) {
      return { success: false, error: insErr.message };
    }

    // 2. Kirim notifikasi ke penerima
    try {
      await supabase.from("notifications").insert({
        user_id: toUserId,
        title: "Permintaan Pertemanan Baru",
        message: `${fromUserName || "Seseorang"} telah mengirimkan permintaan pertemanan kepada Anda. Buka menu Connections untuk merespons.`,
        type: "friend_request",
        read: false,
      });
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal mengirim permintaan pertemanan." };
  }
}

/**
 * Menerima permintaan pertemanan.
 */
export async function acceptFriendRequest(
  currentUserId: string,
  requesterUserId: string,
  currentUserName?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!currentUserId || !requesterUserId) return { success: false, error: "ID tidak valid." };

  try {
    // 1. Update status pertemanan menjadi accepted
    const { error: updErr } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("user_id", requesterUserId)
      .eq("friend_id", currentUserId);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    // 2. Kirim notifikasi konfirmasi ke pengirim awal
    try {
      await supabase.from("notifications").insert({
        user_id: requesterUserId,
        title: "Pertemanan Diterima 🎉",
        message: `${currentUserName || "Teman Anda"} telah menerima permintaan pertemanan Anda! Anda sekarang terhubung.`,
        type: "friend_accepted",
        read: false,
      });
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal menerima permintaan." };
  }
}

/**
 * Menolak atau membatalkan permintaan pertemanan.
 */
export async function rejectOrCancelFriendRequest(
  userA: string,
  userB: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .or(`and(user_id.eq.${userA},friend_id.eq.${userB}),and(user_id.eq.${userB},friend_id.eq.${userA})`)
      .eq("status", "pending");

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal memproses." };
  }
}

/**
 * Menghapus pertemanan (unfriend).
 */
export async function unfriendUser(
  userA: string,
  userB: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .or(`and(user_id.eq.${userA},friend_id.eq.${userB}),and(user_id.eq.${userB},friend_id.eq.${userA})`);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal menghapus pertemanan." };
  }
}

/**
 * Mencari pengguna berdasarkan username, display_name, nomor member, atau UUID.
 */
export async function searchUsers(
  query: string,
  currentUserId?: string | null
): Promise<FriendUser[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const cleanQ = q.replace(/^#/, "").trim();
    const numOnly = cleanQ.replace(/[^0-9]/g, "");
    const parsedNum = numOnly ? parseInt(numOnly, 10) : NaN;

    const results: any[] = [];
    const seen = new Set<string>();

    // 1. Jika input mengandung angka, query langsung kolom member_number
    if (!isNaN(parsedNum)) {
      const { data: numData } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, banner_url, equipped_border, level, exp, member_number, role, is_vip, bio")
        .eq("member_number", parsedNum)
        .limit(10);

      if (numData) {
        numData.forEach((p) => {
          if (p && p.id && !seen.has(p.id)) {
            seen.add(p.id);
            results.push(p);
          }
        });
      }
    }

    // 2. Query berdasarkan username & display_name
    if (cleanQ.length > 0) {
      const { data: textData } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, banner_url, equipped_border, level, exp, member_number, role, is_vip, bio")
        .or(`username.ilike.%${cleanQ}%,display_name.ilike.%${cleanQ}%`)
        .limit(15);

      if (textData) {
        textData.forEach((p) => {
          if (p && p.id && !seen.has(p.id)) {
            seen.add(p.id);
            results.push(p);
          }
        });
      }
    }

    return results.map((p) => ({
      id: p.id,
      username: p.username || "pengguna",
      displayName: p.display_name || p.username || "Pengguna Nuenime",
      avatarUrl: p.avatar_url || null,
      bannerUrl: p.banner_url || null,
      equippedBorder: p.equipped_border || null,
      level: Number(p.level) || 1,
      exp: Number(p.exp) || 0,
      memberNumber: formatMemberNumber(p.member_number),
      role: p.role || "Member",
      isVip: Boolean(p.is_vip),
      bio: p.bio || null,
      status: "none",
    }));
  } catch (err) {
    console.warn("[friends-service] searchUsers error:", err);
    return [];
  }
}

/**
 * Mengambil profil publik pengguna berdasarkan UUID atau nomor member.
 */
export async function getPublicUserProfile(identifier: string): Promise<FriendUser | null> {
  if (!identifier) return null;

  try {
    let req = supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, banner_url, equipped_border, level, exp, member_number, role, is_vip, bio, created_at");

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    if (isUuid) {
      req = req.eq("id", identifier);
    } else {
      const cleanNum = identifier.replace(/[^0-9]/g, "");
      if (cleanNum) {
        req = req.or(`username.eq.${identifier},member_number.eq.${cleanNum}`);
      } else {
        req = req.eq("username", identifier);
      }
    }

    const { data, error } = await req.maybeSingle();
    if (error || !data) return null;

    return {
      id: data.id,
      username: data.username || "pengguna",
      displayName: data.display_name || data.username || "Pengguna Nuenime",
      avatarUrl: data.avatar_url || null,
      bannerUrl: data.banner_url || null,
      equippedBorder: data.equipped_border || null,
      level: Number(data.level) || 1,
      exp: Number(data.exp) || 0,
      memberNumber: formatMemberNumber(data.member_number),
      role: data.role || "Member",
      isVip: Boolean(data.is_vip),
      bio: data.bio || null,
      status: "none",
      createdAt: data.created_at || null,
    };
  } catch {
    return null;
  }
}
