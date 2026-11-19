import { supabase } from "./supabase";
import type { TierId, PrivacyOption, HistoryCategory } from "@/app/affinity";

export interface RealAffinityBond {
  id: string;
  tierId: TierId;
  slotIndex: number;
  friend: {
    id: string;
    name: string;
    handle: string;
    avatarUrl?: string;
    equippedBorder?: string | null;
    initial: string;
    avatarColor: string;
    bio?: string;
  };
  xp: number;
  level: number;
  sinceDate: string;
  streakDays: number;
  lastInteractionAt?: string | null;
}

export interface RealAffinityInvite {
  id: string;
  tierId: TierId;
  slotIndex: number;
  senderId: string;
  receiverId: string;
  isSender: boolean;
  friend: {
    id: string;
    name: string;
    handle: string;
    avatarUrl?: string;
    equippedBorder?: string | null;
    initial: string;
    avatarColor: string;
  };
  sentAt: string;
}

export interface RealAffinityHistory {
  id: string;
  category: HistoryCategory;
  tierId: TierId;
  friend: {
    id: string;
    name: string;
  };
  timestamp: string;
  reason: string;
}

export interface RealLeaderboardItem {
  id: string;
  tierId: TierId;
  userA: {
    id: string;
    name: string;
    avatarUrl?: string;
    equippedBorder?: string | null;
    initial: string;
    avatarColor: string;
  };
  userB: {
    id: string;
    name: string;
    avatarUrl?: string;
    equippedBorder?: string | null;
    initial: string;
    avatarColor: string;
  };
  duoTitle: string;
  level: number;
  xp: number;
}

/**
 * Mengambil pengaturan privasi afinitas pengguna dari Supabase
 */
export async function getAffinityPrivacy(userId: string): Promise<PrivacyOption> {
  if (!userId || userId === "guest") return "publik";
  try {
    const { data, error } = await supabase
      .from("user_affinity_settings")
      .select("privacy")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return "publik";
    return (data.privacy as PrivacyOption) || "publik";
  } catch {
    return "publik";
  }
}

/**
 * Menyimpan pengaturan privasi afinitas ke Supabase
 */
export async function setAffinityPrivacy(userId: string, privacy: PrivacyOption): Promise<boolean> {
  if (!userId || userId === "guest") return false;
  try {
    const { error } = await supabase
      .from("user_affinity_settings")
      .upsert(
        {
          user_id: userId,
          privacy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Mengambil ikatan aktif pengguna yang terhubung dengan profil nyata di Supabase
 */
export async function getUserAffinityBonds(userId: string): Promise<RealAffinityBond[]> {
  if (!userId || userId === "guest") return [];
  try {
    const { data: rows, error } = await supabase
      .from("user_affinity_bonds")
      .select("id, tier_id, slot_index, friend_id, xp, level, streak_days, created_at, last_interaction_at")
      .eq("user_id", userId);

    if (error || !rows || rows.length === 0) return [];

    // Ambil detail profil teman
    const friendIds = Array.from(new Set(rows.map((r) => r.friend_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, equipped_border")
      .in("id", friendIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    return rows.map((r) => {
      const p = profileMap.get(r.friend_id);
      const name = p?.display_name || p?.username || "Teman Nuenime";
      const initial = (name[0] || "T").toUpperCase();
      const dateStr = new Date(r.created_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      return {
        id: r.id,
        tierId: r.tier_id as TierId,
        slotIndex: r.slot_index,
        friend: {
          id: r.friend_id,
          name,
          handle: `@${p?.username || "user"}`,
          avatarUrl: p?.avatar_url || undefined,
          equippedBorder: p?.equipped_border || null,
          initial,
          avatarColor: "#6366F1",
          bio: p?.bio || undefined,
        },
        xp: Number(r.xp) || 0,
        level: Number(r.level) || 1,
        sinceDate: dateStr,
        streakDays: Number(r.streak_days) || 1,
        lastInteractionAt: r.last_interaction_at,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Mengambil ajakan afinitas tertunda (pending invites)
 */
export async function getUserAffinityInvites(userId: string): Promise<RealAffinityInvite[]> {
  if (!userId || userId === "guest") return [];
  try {
    const { data: rows, error } = await supabase
      .from("user_affinity_invites")
      .select("id, tier_id, slot_index, sender_id, receiver_id, created_at")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq("status", "pending");

    if (error || !rows || rows.length === 0) return [];

    const otherIds = rows.map((r) => (r.sender_id === userId ? r.receiver_id : r.sender_id));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, equipped_border")
      .in("id", otherIds);

    const pMap = new Map((profiles || []).map((p) => [p.id, p]));

    return rows.map((r) => {
      const isSender = r.sender_id === userId;
      const otherId = isSender ? r.receiver_id : r.sender_id;
      const p = pMap.get(otherId);
      const name = p?.display_name || p?.username || "Pengguna";

      return {
        id: r.id,
        tierId: r.tier_id as TierId,
        slotIndex: r.slot_index,
        senderId: r.sender_id,
        receiverId: r.receiver_id,
        isSender,
        friend: {
          id: otherId,
          name,
          handle: `@${p?.username || "user"}`,
          avatarUrl: p?.avatar_url || undefined,
          equippedBorder: p?.equipped_border || null,
          initial: (name[0] || "U").toUpperCase(),
          avatarColor: isSender ? "#64748B" : "#F59E0B",
        },
        sentAt: new Date(r.created_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
        }),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Mengambil jumlah slot ikatan afinitas yang sudah terpakai oleh masing-masing teman pada tier tertentu
 */
export async function getFriendsSlotUsage(
  friendIds: string[],
  tierId: TierId
): Promise<Record<string, number>> {
  if (!friendIds || friendIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from("user_affinity_bonds")
      .select("user_id")
      .in("user_id", friendIds)
      .eq("tier_id", tierId);

    if (error || !data) return {};

    const usage: Record<string, number> = {};
    for (const row of data) {
      usage[row.user_id] = (usage[row.user_id] || 0) + 1;
    }
    return usage;
  } catch {
    return {};
  }
}

/**
 * Mengambil riwayat ikatan afinitas
 */
export async function getUserAffinityHistory(userId: string): Promise<RealAffinityHistory[]> {
  if (!userId || userId === "guest") return [];
  try {
    const { data: rows, error } = await supabase
      .from("user_affinity_history")
      .select("id, tier_id, category, target_user_id, reason, created_at")
      .or(`user_id.eq.${userId},target_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error || !rows || rows.length === 0) return [];

    const targetIds = rows.map((r) => r.target_user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", targetIds);

    const pMap = new Map((profiles || []).map((p) => [p.id, p]));

    return rows.map((r) => {
      const p = pMap.get(r.target_user_id);
      const name = p?.display_name || p?.username || "Pengguna";
      return {
        id: r.id,
        category: r.category as HistoryCategory,
        tierId: r.tier_id as TierId,
        friend: {
          id: r.target_user_id,
          name,
        },
        timestamp: new Date(r.created_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        reason: r.reason || "Tidak ada keterangan.",
      };
    });
  } catch {
    return [];
  }
}

/**
 * Mengambil Top Afinitas Leaderboard dari database nyata Supabase
 */
export async function getRealTopAffinityLeaderboard(tierId: TierId): Promise<RealLeaderboardItem[]> {
  try {
    const { data, error } = await supabase.rpc("get_top_affinity_leaderboard", {
      p_tier_id: tierId,
      p_limit: 25,
    });

    if (error) {
      console.warn("[Affinity Leaderboard RPC Error]:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      // Fallback: Query tabel database langsung agar leaderboard tetap tampil sempurna
      return await getLeaderboardDirectFallback(tierId, 25);
    }

    if (!data || !Array.isArray(data)) {
      return await getLeaderboardDirectFallback(tierId, 25);
    }

    return data.map((row: any) => ({
      id: row.bond_id,
      tierId: row.tier_id as TierId,
      userA: {
        id: row.user_a_id,
        name: row.user_a_name,
        avatarUrl: row.user_a_avatar || undefined,
        equippedBorder: row.user_a_border || null,
        initial: row.user_a_initial || "A",
        avatarColor: "#6366F1",
      },
      userB: {
        id: row.user_b_id,
        name: row.user_b_name,
        avatarUrl: row.user_b_avatar || undefined,
        equippedBorder: row.user_b_border || null,
        initial: row.user_b_initial || "B",
        avatarColor: "#3B82F6",
      },
      duoTitle: row.duo_title || `${row.user_a_name} & ${row.user_b_name}`,
      level: Number(row.level) || 1,
      xp: Number(row.xp) || 0,
    }));
  } catch (err) {
    console.error("[Affinity Leaderboard Exception]:", err);
    return await getLeaderboardDirectFallback(tierId, 25);
  }
}

/**
 * Fallback query langsung ke tabel user_affinity_bonds jika RPC mengalami error/belum termigrasi
 */
async function getLeaderboardDirectFallback(
  tierId: TierId,
  limit: number = 25
): Promise<RealLeaderboardItem[]> {
  try {
    const { data: bonds, error: bondsErr } = await supabase
      .from("user_affinity_bonds")
      .select("id, user_id, friend_id, tier_id, level, xp, paired_bond_id")
      .eq("tier_id", tierId)
      .order("xp", { ascending: false });

    if (bondsErr || !bonds || bonds.length === 0) return [];

    // Deduplikasi pasangan A-B & B-A agar tidak ada relasi ganda
    const seenPairs = new Set<string>();
    const uniqueBonds: typeof bonds = [];

    for (const b of bonds) {
      const pairKey = [b.user_id, b.friend_id].sort().join(":");
      if (!seenPairs.has(pairKey)) {
        seenPairs.add(pairKey);
        uniqueBonds.push(b);
      }
    }

    if (uniqueBonds.length === 0) return [];

    const userIds = Array.from(new Set(uniqueBonds.flatMap((b) => [b.user_id, b.friend_id])));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, equipped_border")
      .in("id", userIds);

    const profMap = new Map((profiles || []).map((p) => [p.id, p]));

    const { data: settings } = await supabase
      .from("user_affinity_settings")
      .select("user_id, privacy")
      .in("user_id", userIds);

    const privMap = new Map((settings || []).map((s) => [s.user_id, s.privacy]));

    const results: RealLeaderboardItem[] = [];
    for (const b of uniqueBonds) {
      const privA = privMap.get(b.user_id) || "publik";
      const privB = privMap.get(b.friend_id) || "publik";
      if (privA !== "publik" || privB !== "publik") continue;

      const pA = profMap.get(b.user_id);
      const pB = profMap.get(b.friend_id);

      const nameA = pA?.display_name || pA?.username || "Pengguna";
      const nameB = pB?.display_name || pB?.username || "Pengguna";

      results.push({
        id: b.id,
        tierId: b.tier_id as TierId,
        userA: {
          id: b.user_id,
          name: nameA,
          avatarUrl: pA?.avatar_url || undefined,
          equippedBorder: pA?.equipped_border || null,
          initial: (nameA[0] || "A").toUpperCase(),
          avatarColor: "#6366F1",
        },
        userB: {
          id: b.friend_id,
          name: nameB,
          avatarUrl: pB?.avatar_url || undefined,
          equippedBorder: pB?.equipped_border || null,
          initial: (nameB[0] || "B").toUpperCase(),
          avatarColor: "#3B82F6",
        },
        duoTitle: `${nameA} & ${nameB}`,
        level: Number(b.level) || 1,
        xp: Number(b.xp) || 0,
      });

      if (results.length >= limit) break;
    }

    return results;
  } catch (fallbackErr) {
    console.error("[Affinity Leaderboard Fallback Exception]:", fallbackErr);
    return [];
  }
}

/**
 * Mengirim ajakan afinitas ke teman dengan validasi anti-duplikasi & batas slot
 */
export async function sendAffinityInvite(
  senderId: string,
  receiverId: string,
  tierId: TierId,
  slotIndex: number
): Promise<{ success: boolean; message: string }> {
  if (!senderId || !receiverId) return { success: false, message: "Identitas tidak valid." };
  if (senderId === receiverId) return { success: false, message: "Tidak dapat membuat hubungan afinitas dengan diri sendiri." };

  try {
    // 1. Coba panggil RPC atomik PostgreSQL
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("send_affinity_invite_atomic", {
      p_sender_id: senderId,
      p_receiver_id: receiverId,
      p_tier_id: tierId,
      p_slot_index: slotIndex,
    });

    if (!rpcErr && rpcRes && typeof rpcRes === "object") {
      return {
        success: Boolean(rpcRes.success),
        message: rpcRes.message || (rpcRes.success ? "Ajakan afinitas berhasil dikirim." : "Gagal mengirim ajakan."),
      };
    }

    // 2. Fallback validasi sisi-klien jika RPC belum dimigrasi di database
    // A. Cek hubungan afinitas aktif (dua arah)
    const { data: existingBonds } = await supabase
      .from("user_affinity_bonds")
      .select("id")
      .or(`and(user_id.eq.${senderId},friend_id.eq.${receiverId}),and(user_id.eq.${receiverId},friend_id.eq.${senderId})`)
      .limit(1);

    if (existingBonds && existingBonds.length > 0) {
      return { success: false, message: "Kalian sudah memiliki Afinitas Persahabatan." };
    }

    // B. Cek ajakan pending
    const { data: existingInvites } = await supabase
      .from("user_affinity_invites")
      .select("id")
      .eq("status", "pending")
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
      .limit(1);

    if (existingInvites && existingInvites.length > 0) {
      return { success: false, message: "Ajakan masih menunggu respon teman tersebut." };
    }

    // C. Cek batas slot masing-masing akun
    const maxSlots = tierId === "pasangan" ? 1 : tierId === "orang_kepercayaan" ? 5 : 4;

    const { count: senderUsed } = await supabase
      .from("user_affinity_bonds")
      .select("id", { count: "exact", head: true })
      .eq("user_id", senderId)
      .eq("tier_id", tierId);

    const { count: receiverUsed } = await supabase
      .from("user_affinity_bonds")
      .select("id", { count: "exact", head: true })
      .eq("user_id", receiverId)
      .eq("tier_id", tierId);

    if ((senderUsed ?? 0) >= maxSlots || (receiverUsed ?? 0) >= maxSlots) {
      return {
        success: false,
        message: "Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot.",
      };
    }

    const { error: insertErr } = await supabase.from("user_affinity_invites").insert({
      sender_id: senderId,
      receiver_id: receiverId,
      tier_id: tierId,
      slot_index: slotIndex,
      status: "pending",
    });

    if (insertErr) {
      if (insertErr.code === "23505") {
        return { success: false, message: "Kalian sudah memiliki Afinitas Persahabatan." };
      }
      return { success: false, message: insertErr.message };
    }

    return { success: true, message: "Ajakan afinitas berhasil dikirim." };
  } catch (err: any) {
    return { success: false, message: err?.message || "Gagal mengirim ajakan." };
  }
}

/**
 * Menerima ajakan ikatan afinitas dengan validasi atomik, anti duplikasi, dan batas slot kedua akun
 */
export async function acceptAffinityInvite(
  inviteId: string,
  senderId: string,
  receiverId: string,
  tierId: TierId,
  slotIndex: number
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Coba panggil RPC atomik PostgreSQL
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("accept_affinity_invite_atomic", {
      p_invite_id: inviteId,
      p_receiver_id: receiverId,
    });

    if (!rpcErr && rpcRes && typeof rpcRes === "object") {
      return {
        success: Boolean(rpcRes.success),
        message: rpcRes.message || (rpcRes.success ? "Tautan Afinitas Persahabatan berhasil dibuat!" : "Gagal membuat ikatan."),
      };
    }

    // 2. Fallback validasi sisi-klien jika RPC belum dieksekusi
    // A. Cek hubungan afinitas aktif (dua arah)
    const { data: existingBonds } = await supabase
      .from("user_affinity_bonds")
      .select("id")
      .or(`and(user_id.eq.${senderId},friend_id.eq.${receiverId}),and(user_id.eq.${receiverId},friend_id.eq.${senderId})`)
      .limit(1);

    if (existingBonds && existingBonds.length > 0) {
      return { success: false, message: "Kalian sudah memiliki Afinitas Persahabatan." };
    }

    // B. Cek batas slot kedua akun
    const maxSlots = tierId === "pasangan" ? 1 : tierId === "orang_kepercayaan" ? 5 : 4;

    const { count: senderUsed } = await supabase
      .from("user_affinity_bonds")
      .select("id", { count: "exact", head: true })
      .eq("user_id", senderId)
      .eq("tier_id", tierId);

    const { count: receiverUsed } = await supabase
      .from("user_affinity_bonds")
      .select("id", { count: "exact", head: true })
      .eq("user_id", receiverId)
      .eq("tier_id", tierId);

    if ((senderUsed ?? 0) >= maxSlots || (receiverUsed ?? 0) >= maxSlots) {
      return {
        success: false,
        message: "Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot.",
      };
    }

    // C. Cari slot kosong untuk receiver
    const { data: receiverBonds } = await supabase
      .from("user_affinity_bonds")
      .select("slot_index")
      .eq("user_id", receiverId)
      .eq("tier_id", tierId);

    const takenReceiverSlots = new Set((receiverBonds || []).map((b) => b.slot_index));
    let receiverSlot = 0;
    for (let i = 0; i < maxSlots; i++) {
      if (!takenReceiverSlots.has(i)) {
        receiverSlot = i;
        break;
      }
    }

    // D. Buat ikatan untuk sender
    const { data: bondA, error: errA } = await supabase
      .from("user_affinity_bonds")
      .insert({
        user_id: senderId,
        friend_id: receiverId,
        tier_id: tierId,
        slot_index: slotIndex,
        xp: 150,
        level: 1,
        streak_days: 1,
      })
      .select("id")
      .single();

    if (errA || !bondA) {
      if (errA?.message?.includes("batas slot")) {
        return { success: false, message: "Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot." };
      }
      if (errA?.code === "23505") {
        return { success: false, message: "Kalian sudah memiliki Afinitas Persahabatan." };
      }
      return { success: false, message: errA?.message || "Gagal membuat ikatan." };
    }

    // E. Buat ikatan timbal balik untuk receiver
    const { data: bondB, error: errB } = await supabase
      .from("user_affinity_bonds")
      .insert({
        user_id: receiverId,
        friend_id: senderId,
        tier_id: tierId,
        slot_index: receiverSlot,
        xp: 150,
        level: 1,
        streak_days: 1,
        paired_bond_id: bondA.id,
      })
      .select("id")
      .single();

    if (errB) {
      if (errB?.message?.includes("batas slot")) {
        await supabase.from("user_affinity_bonds").delete().eq("id", bondA.id);
        return { success: false, message: "Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot." };
      }
      if (errB?.code === "23505") {
        await supabase.from("user_affinity_bonds").delete().eq("id", bondA.id);
        return { success: false, message: "Kalian sudah memiliki Afinitas Persahabatan." };
      }
    }

    if (bondB) {
      await supabase
        .from("user_affinity_bonds")
        .update({ paired_bond_id: bondB.id })
        .eq("id", bondA.id);
    }

    // F. Update status invite menjadi accepted
    await supabase
      .from("user_affinity_invites")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", inviteId);

    // G. Bersihkan ajakan pending ganda lainnya
    await supabase
      .from("user_affinity_invites")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("status", "pending")
      .neq("id", inviteId)
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`);

    return {
      success: true,
      message: "Tautan Afinitas Persahabatan berhasil dibuat!",
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Gagal menerima ajakan." };
  }
}

/**
 * Membatalkan ajakan afinitas
 */
export async function cancelAffinityInvite(
  inviteId: string,
  userId: string,
  targetUserId: string,
  tierId: TierId
): Promise<boolean> {
  try {
    await supabase
      .from("user_affinity_invites")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", inviteId);

    await supabase.from("user_affinity_history").insert({
      user_id: userId,
      target_user_id: targetUserId,
      tier_id: tierId,
      category: "dibatalkan",
      reason: "Ajakan dibatalkan oleh pengguna.",
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Menolak ajakan afinitas (hanya untuk receiver yang diajak)
 */
export async function rejectAffinityInvite(
  inviteId: string,
  userId: string,
  senderUserId: string,
  tierId: TierId
): Promise<boolean> {
  try {
    await supabase
      .from("user_affinity_invites")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", inviteId);

    await supabase.from("user_affinity_history").insert({
      user_id: userId,
      target_user_id: senderUserId,
      tier_id: tierId,
      category: "ditolak",
      reason: "Ajakan ditolak oleh pengguna.",
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Mengecek apakah sapaan sudah dikirim hari ini untuk ikatan tertentu (1 hari 1x per akun)
 */
export function isGreetedToday(lastInteractionAt?: string | null): boolean {
  if (!lastInteractionAt) return false;
  try {
    const lastDate = new Date(lastInteractionAt);
    const now = new Date();
    return (
      lastDate.getFullYear() === now.getFullYear() &&
      lastDate.getMonth() === now.getMonth() &&
      lastDate.getDate() === now.getDate()
    );
  } catch {
    return false;
  }
}

/**
 * Mengirim sapaan harian dan menaikkan XP afinitas (Boost XP +200)
 * Aturan: 1 hari hanya 1x untuk satu akun
 */
export async function boostAffinityBondXp(
  bondId: string,
  gainAmount: number = 200
): Promise<{ success: boolean; message?: string; xp?: number; level?: number; streak?: number }> {
  try {
    const { data, error } = await supabase.rpc("boost_affinity_bond_xp", {
      p_bond_id: bondId,
      p_xp_gain: gainAmount,
    });

    if (!error && data && typeof data === "object") {
      return {
        success: Boolean(data.success),
        message: data.message || (data.success ? "Sapaan berhasil dikirim! (+200 XP)" : "Gagal mengirim sapaan."),
        xp: data.xp,
        level: data.level,
        streak: data.streak,
      };
    }

    // Fallback validasi sisi-klien jika RPC belum termigrasi di database
    const { data: bond, error: bErr } = await supabase
      .from("user_affinity_bonds")
      .select("id, xp, streak_days, paired_bond_id, last_interaction_at")
      .eq("id", bondId)
      .single();

    if (bErr || !bond) {
      return { success: false, message: "Ikatan afinitas tidak ditemukan." };
    }

    if (isGreetedToday(bond.last_interaction_at)) {
      return {
        success: false,
        message: "Sapaan sudah dikirim hari ini. Kamu hanya dapat menyapa 1x sehari untuk akun ini.",
      };
    }

    const newXp = (bond.xp || 0) + gainAmount;
    const newLevel = Math.min(30, Math.floor(newXp / 800) + 1);
    const newStreak = (bond.streak_days || 0) + 1;
    const nowIso = new Date().toISOString();

    await supabase
      .from("user_affinity_bonds")
      .update({
        xp: newXp,
        level: newLevel,
        streak_days: newStreak,
        last_interaction_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", bondId);

    if (bond.paired_bond_id) {
      await supabase
        .from("user_affinity_bonds")
        .update({
          xp: newXp,
          level: newLevel,
          streak_days: newStreak,
          last_interaction_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", bond.paired_bond_id);
    }

    return {
      success: true,
      message: "Sapaan berhasil dikirim! (+200 XP)",
      xp: newXp,
      level: newLevel,
      streak: newStreak,
    };
  } catch {
    return { success: false, message: "Terjadi kesalahan sistem saat mengirim sapaan." };
  }
}

/**
 * Memutuskan ikatan afinitas
 */
export async function breakAffinityBond(
  bondId: string,
  reason: string = "Ikatan diakhiri."
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("break_affinity_bond", {
      p_bond_id: bondId,
      p_reason: reason,
    });

    if (error || !data) return false;
    return Boolean(data.success);
  } catch {
    return false;
  }
}

