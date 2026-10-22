import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { sendPushToUser, sendPushToAllUsers } from "./push-notification-service";
import type { AdminUser } from "./admin-audit";
import { logAdminAction } from "./admin-audit";
import { addCrystalBalance, getCrystalBalance } from "./topup-service";
import {
  recordBorderPurchaseToSupabase,
  getOwnedBorderIds,
  setOwnedBorderIds,
} from "./avatar-borders";

export interface SystemGift {
  id: string;
  title: string;
  message: string;
  giftType: "crystal" | "border";
  giftValue: string;
  isActive: boolean;
  createdAt: string;
  targetUserId?: string | null;
  isClaimed?: boolean;
  claimedAt?: string;
}

const STORAGE_SYSTEM_GIFTS = "nuenime.system_gifts";
const STORAGE_USER_CLAIMS_PREFIX = "nuenime.user_gift_claims.";

export function getUserClaimsStorageKey(userId?: string | null): string {
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    return `${STORAGE_USER_CLAIMS_PREFIX}${userId.trim()}`;
  }
  return `${STORAGE_USER_CLAIMS_PREFIX}guest`;
}

/**
 * Mengirim hadiah massal oleh Admin ke database dan menyiarkan notifikasi.
 */
export async function sendMassGift(
  params: {
    title: string;
    message: string;
    giftType: "crystal" | "border";
    giftValue: string;
  },
  admin?: AdminUser
): Promise<{ success: boolean; data?: SystemGift; error?: string }> {
  const newGift: SystemGift = {
    id: `gift_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: params.title.trim(),
    message: params.message.trim(),
    giftType: params.giftType,
    giftValue: params.giftValue.trim(),
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  // 1. Simpan ke Supabase system_gifts
  try {
    const { data, error } = await supabase
      .from("system_gifts")
      .insert({
        title: newGift.title,
        message: newGift.message,
        gift_type: newGift.giftType,
        gift_value: newGift.giftValue,
        is_active: true,
      })
      .select("id")
      .single();

    if (!error && data?.id) {
      newGift.id = data.id;
    }
  } catch (err) {
    console.warn("[mailbox-service] Supabase insert system_gifts error:", err);
  }

  // 2. Buat entri notifikasi ke tabel notifications untuk pengguna
  try {
    const { data: profiles } = await supabase.from("profiles").select("id");
    if (profiles && profiles.length > 0) {
      const notifRows = profiles.map((p: any) => ({
        user_id: p.id,
        title: `🎁 ${newGift.title}`,
        message: `${newGift.message} (${newGift.giftType === "crystal" ? "+" + newGift.giftValue + " Dylan Crystal" : "Border: " + newGift.giftValue})`,
        type: "gift",
      }));
      await supabase.from("notifications").insert(notifRows);
    }
  } catch (notifErr) {
    console.warn("[mailbox-service] Error inserting user notifications:", notifErr);
  }

  // 3. Buat entri notifikasi siaran di broadcast_notifications
  try {
    await supabase.from("broadcast_notifications").insert({
      admin_id: admin?.id || "00000000-0000-0000-0000-000000000000",
      title: `🎁 ${newGift.title}`,
      message: newGift.message,
      type: "gift",
      action_url: `/mailbox?giftId=${newGift.id}`,
      recipients_count: 100,
    });
  } catch {}

  // 🔔 Kirim Push Notification ke seluruh pengguna (tetap sampai walaupun APK mati)
  void sendPushToAllUsers({
    title: `🎁 ${newGift.title}`,
    body: newGift.message,
    channelId: "nuenime_system",
    data: {
      type: "gift",
      actionUrl: `/mailbox?giftId=${newGift.id}`,
    },
  });

  // 3. Simpan ke local cache AsyncStorage
  try {
    const prev = await getAllAdminGifts();
    const next = [newGift, ...prev.filter((g) => g.id !== newGift.id)];
    await AsyncStorage.setItem(STORAGE_SYSTEM_GIFTS, JSON.stringify(next));
  } catch {}

  // 4. Catat audit log admin
  if (admin) {
    await logAdminAction({
      admin,
      action: "SEND_MASS_GIFT",
      targetType: "all_users",
      targetId: newGift.id,
      details: {
        title: newGift.title,
        giftType: newGift.giftType,
        giftValue: newGift.giftValue,
      },
    });
  }

  return { success: true, data: newGift };
}

/**
 * Mengambil seluruh daftar hadiah yang pernah dikirim admin.
 */
export async function getAllAdminGifts(): Promise<SystemGift[]> {
  try {
    const { data, error } = await supabase
      .from("system_gifts")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      const mapped: SystemGift[] = data.map((d: any) => ({
        id: d.id,
        title: d.title,
        message: d.message,
        giftType: d.gift_type,
        giftValue: d.gift_value,
        isActive: d.is_active !== false,
        createdAt: d.created_at,
        targetUserId: d.target_user_id || null,
      }));
      await AsyncStorage.setItem(STORAGE_SYSTEM_GIFTS, JSON.stringify(mapped));
      return mapped;
    }
  } catch {}

  try {
    const local = await AsyncStorage.getItem(STORAGE_SYSTEM_GIFTS);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  return [];
}

/**
 * Mengambil daftar hadiah aktif untuk kotak masuk (mailbox) pengguna beserta status klaimnya.
 * Memfilter hadiah siaran umum ATAU hadiah khusus untuk userId ini (misal: refund border).
 */
export async function getUserMailboxGifts(userId?: string | null): Promise<SystemGift[]> {
  const allGifts = await getAllAdminGifts();
  const activeGifts = allGifts.filter(
    (g) => g.isActive && (!g.targetUserId || (userId && g.targetUserId === userId))
  );

  // Ambil daftar klaim user
  const claimedGiftIds = new Set<string>();

  // 1. Coba dari Supabase jika user logged-in
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    try {
      const { data, error } = await supabase
        .from("user_gift_claims")
        .select("gift_id")
        .eq("user_id", userId);

      if (!error && Array.isArray(data)) {
        for (const row of data) {
          if (row.gift_id) claimedGiftIds.add(String(row.gift_id));
        }
      }
    } catch {}
  }

  // 2. Gabung dengan cache AsyncStorage
  try {
    const key = getUserClaimsStorageKey(userId);
    const local = await AsyncStorage.getItem(key);
    if (local) {
      const ids: string[] = JSON.parse(local);
      if (Array.isArray(ids)) {
        for (const id of ids) claimedGiftIds.add(id);
      }
    }
  } catch {}

  return activeGifts.map((gift) => ({
    ...gift,
    isClaimed: claimedGiftIds.has(gift.id),
  }));
}

/**
 * Mengklaim hadiah oleh pengguna:
 * Menambah Crystal / Border, mencatat ke user_gift_claims, dan mengupdate saldo realtime.
 */
export async function claimGiftForUser(
  giftId: string,
  userId: string | null | undefined
): Promise<{
  success: boolean;
  giftType?: "crystal" | "border";
  giftValue?: string;
  newBalance?: number;
  error?: string;
}> {
  if (!giftId) {
    return { success: false, error: "ID Hadiah tidak valid." };
  }

  // 1. Eksekusi via Supabase RPC jika user login
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    try {
      const { data, error } = await supabase.rpc("claim_system_gift", {
        p_gift_id: giftId,
        p_user_id: userId,
      });

      if (!error && data && typeof data === "object") {
        if (data.success === false) {
          if (data.error === "ALREADY_CLAIMED") {
            return { success: false, error: "Hadiah ini sudah pernah kamu klaim sebelumnya." };
          }
          return { success: false, error: data.error || "Gagal mengklaim hadiah." };
        }

        // Catat ke local storage
        await recordLocalClaim(userId, giftId);

        // Jika hadiah berupa border, langsung tambahkan ke cache border milik user
        if (data.gift_type === "border" && data.gift_value) {
          try {
            const currentOwned = await getOwnedBorderIds(userId);
            if (!currentOwned.includes(data.gift_value)) {
              await setOwnedBorderIds(userId, [...currentOwned, data.gift_value]);
            }
          } catch {}
        }

        return {
          success: true,
          giftType: data.gift_type,
          giftValue: data.gift_value,
          newBalance: data.new_balance,
        };
      }
    } catch (err) {
      console.warn("[mailbox-service] RPC claim error, using local fallback:", err);
    }
  }

  // 2. Fallback local / guest claim
  const allGifts = await getAllAdminGifts();
  const targetGift = allGifts.find((g) => g.id === giftId);
  if (!targetGift) {
    return { success: false, error: "Hadiah tidak ditemukan." };
  }

  // Cek apakah sudah diklaim di local
  const key = getUserClaimsStorageKey(userId);
  const localClaimsRaw = await AsyncStorage.getItem(key);
  const localClaims: string[] = localClaimsRaw ? JSON.parse(localClaimsRaw) : [];
  if (localClaims.includes(giftId)) {
    return { success: false, error: "Hadiah ini sudah pernah kamu klaim sebelumnya." };
  }

  let nextBal: number | undefined;
  if (targetGift.giftType === "crystal") {
    const amount = parseInt(targetGift.giftValue.replace(/[^0-9]/g, ""), 10) || 100;
    nextBal = await addCrystalBalance(userId, amount);
  } else if (targetGift.giftType === "border") {
    if (userId && userId !== "guest") {
      await recordBorderPurchaseToSupabase(
        userId,
        { id: targetGift.giftValue, name: targetGift.title, rarity: "Rare" },
        0
      );
    }
  }

  await recordLocalClaim(userId, giftId);

  return {
    success: true,
    giftType: targetGift.giftType,
    giftValue: targetGift.giftValue,
    newBalance: nextBal,
  };
}

async function recordLocalClaim(userId: string | null | undefined, giftId: string) {
  try {
    const key = getUserClaimsStorageKey(userId);
    const localClaimsRaw = await AsyncStorage.getItem(key);
    const localClaims: string[] = localClaimsRaw ? JSON.parse(localClaimsRaw) : [];
    if (!localClaims.includes(giftId)) {
      localClaims.push(giftId);
      await AsyncStorage.setItem(key, JSON.stringify(localClaims));
    }
  } catch {}
}

/**
 * ─── PEMBUATAN HADIAH PENGEMBALIAN CRYSTAL KHUSUS USER (BORDER REFUND) ───
 *
 * Dipanggil saat Admin menghapus border yang pernah dibeli pengguna.
 * Otomatis mengirimkan item klaim ke kotak masuk (Mailbox) user ID terkait
 * dan menyisipkan notifikasi pesan agar pengguna dapat langsung mengklaim kembali crystal-nya.
 */
export async function createBorderCompensationGift(params: {
  userId: string;
  borderId: string;
  borderName: string;
  refundAmount: number;
  admin?: AdminUser;
}): Promise<{ success: boolean; giftId?: string }> {
  const { userId, borderId, borderName, refundAmount, admin } = params;
  const giftTitle = `Pengembalian Crystal: Border "${borderName}" Dihapus`;
  const giftMessage = `Border avatar "${borderName}" telah dihapus dari sistem oleh Admin. Seluruh biaya pembelian sebesar ${refundAmount} Dylan Crystal telah dikembalikan untukmu. Silakan klik klaim untuk memasukkan kembali crystal ke saldomu!`;

  try {
    // 1. Simpan ke Supabase system_gifts khusus target_user_id
    const rowPayload: Record<string, any> = {
      title: giftTitle,
      message: giftMessage,
      gift_type: "crystal",
      gift_value: String(refundAmount),
      is_active: true,
      target_user_id: userId,
    };

    try {
      const { data, error } = await supabase
        .from("system_gifts")
        .insert(rowPayload)
        .select("id")
        .single();

      if (error) {
        // Fallback jika kolom target_user_id belum dibuat di DB
        delete rowPayload.target_user_id;
        await supabase.from("system_gifts").insert(rowPayload);
      }
    } catch {}

    // 2. Buat notifikasi langsung ke tabel notifications pengguna
    try {
      await supabase.from("notifications").insert({
        user_id: userId,
        title: `💎 Klaim Pengembalian: Border "${borderName}"`,
        message: `Border "${borderName}" dihapus. Kamu mendapatkan pengembalian ${refundAmount} Dylan Crystal. Buka tab Hadiah untuk klaim!`,
        type: "gift",
      });
    } catch {}

    // 🔔 Kirim Push Notification langsung ke target user
    void sendPushToUser(userId, {
      title: `💎 Klaim Pengembalian: Border "${borderName}"`,
      body: `Border "${borderName}" dihapus. Kamu mendapatkan pengembalian ${refundAmount} Dylan Crystal.`,
      channelId: "nuenime_system",
      data: {
        type: "gift",
        actionUrl: "/mailbox",
      },
    });

    // 3. Simpan juga ke cache lokal system_gifts
    const localGift: SystemGift = {
      id: `refund_${borderId}_${userId.substring(0, 8)}_${Date.now()}`,
      title: giftTitle,
      message: giftMessage,
      giftType: "crystal",
      giftValue: String(refundAmount),
      targetUserId: userId,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    try {
      const prev = await getAllAdminGifts();
      await AsyncStorage.setItem(
        STORAGE_SYSTEM_GIFTS,
        JSON.stringify([localGift, ...prev])
      );
    } catch {}

    // 4. Catat ke audit log admin jika admin terdefinisi
    if (admin) {
      await logAdminAction({
        admin,
        action: "BORDER_REFUND_SENT",
        targetType: "user",
        targetId: userId,
        details: { borderId, borderName, refundAmount },
      });
    }

    return { success: true, giftId: localGift.id };
  } catch (err: any) {
    console.warn("createBorderCompensationGift error:", err);
    return { success: false };
  }
}

/**
 * Membuat hadiah kompensasi refund crystal untuk pengguna tertentu yang memiliki banner gacha
 * yang dihapus oleh admin, serta mengirim notifikasi klaim langsung ke kotak masuk mereka.
 */
export async function createBannerCompensationGift(params: {
  userId: string;
  bannerId: string;
  bannerName: string;
  bannerRarity?: string;
  refundAmount: number;
  admin?: AdminUser;
}): Promise<{ success: boolean; giftId?: string }> {
  const { userId, bannerId, bannerName, bannerRarity = "Normal", refundAmount, admin } = params;
  try {
    const giftTitle = `💎 Pengembalian Crystal: Banner "${bannerName}"`;
    const giftMessage = `Banner wallpaper "${bannerName}" (${bannerRarity}) telah dihapus dari sistem oleh Administrator. Saldo Anda dikembalikan 100% sebesar ${refundAmount.toLocaleString("id-ID")} Daylan Crystal. Silakan klaim sekarang!`;

    // 1. Simpan ke Supabase system_gifts khusus target_user_id
    const rowPayload: Record<string, any> = {
      title: giftTitle,
      message: giftMessage,
      gift_type: "crystal",
      gift_value: String(refundAmount),
      is_active: true,
      target_user_id: userId,
    };

    try {
      const { error } = await supabase
        .from("system_gifts")
        .insert(rowPayload);

      if (error) {
        delete rowPayload.target_user_id;
        await supabase.from("system_gifts").insert(rowPayload);
      }
    } catch {}

    // 2. Buat notifikasi langsung ke tabel notifications pengguna
    try {
      await supabase.from("notifications").insert({
        user_id: userId,
        title: `💎 Klaim Pengembalian: Banner "${bannerName}"`,
        message: `Banner "${bannerName}" dihapus. Kamu mendapatkan pengembalian ${refundAmount.toLocaleString("id-ID")} Dylan Crystal. Buka tab Hadiah untuk klaim!`,
        type: "gift",
      });
    } catch {}

    // 3. Simpan juga ke cache lokal system_gifts
    const localGift: SystemGift = {
      id: `refund_banner_${bannerId}_${userId.substring(0, 8)}_${Date.now()}`,
      title: giftTitle,
      message: giftMessage,
      giftType: "crystal",
      giftValue: String(refundAmount),
      targetUserId: userId,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    try {
      const prev = await getAllAdminGifts();
      await AsyncStorage.setItem(
        STORAGE_SYSTEM_GIFTS,
        JSON.stringify([localGift, ...prev])
      );
    } catch {}

    // 4. Catat ke audit log admin jika admin terdefinisi
    if (admin) {
      await logAdminAction({
        admin,
        action: "BANNER_REFUND_SENT",
        targetType: "user",
        targetId: userId,
        details: { bannerId, bannerName, bannerRarity, refundAmount },
      });
    }

    return { success: true, giftId: localGift.id };
  } catch (err: any) {
    console.warn("createBannerCompensationGift error:", err);
    return { success: false };
  }
}

/**
 * Menghapus hadiah massal (system_gift) oleh Admin.
 * Ini memastikan hadiah tidak lagi muncul di mailbox pemain mana pun dan tidak akan diterima pengguna baru.
 */
export async function deleteSystemGift(
  giftId: string,
  admin?: AdminUser
): Promise<{ success: boolean; error?: string }> {
  if (!giftId) {
    return { success: false, error: "ID Hadiah tidak valid." };
  }

  try {
    let giftTitle = "";

    // 1. Ambil data hadiah di Supabase sebelum dihapus
    try {
      const { data: gData } = await supabase
        .from("system_gifts")
        .select("id, title")
        .eq("id", giftId)
        .maybeSingle();

      if (gData?.title) {
        giftTitle = gData.title;
      }
    } catch {}

    // 2. Hapus hadiah dari Supabase system_gifts (akan cascade ke user_gift_claims)
    try {
      await supabase.from("system_gifts").delete().eq("id", giftId);
    } catch (err) {
      console.warn("[mailbox-service] Error deleting system_gifts from DB:", err);
    }

    // 3. Hapus notifikasi terkait di tabel notifications agar pengguna tidak melihat notifikasi usang
    try {
      if (giftTitle) {
        await supabase.from("notifications").delete().ilike("title", `%${giftTitle}%`);
      }
      await supabase.from("broadcast_notifications").delete().ilike("action_url", `%${giftId}%`);
    } catch {}

    // 4. Hapus dari cache lokal AsyncStorage
    try {
      const local = await AsyncStorage.getItem(STORAGE_SYSTEM_GIFTS);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((g: SystemGift) => g.id !== giftId);
          await AsyncStorage.setItem(STORAGE_SYSTEM_GIFTS, JSON.stringify(filtered));
        }
      }
    } catch {}

    // 5. Catat ke audit log admin
    if (admin) {
      await logAdminAction({
        admin,
        action: "DELETE_SYSTEM_GIFT",
        targetType: "system_gift",
        targetId: giftId,
        details: { giftId, title: giftTitle || "Hadiah Massal" },
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal menghapus hadiah sistem." };
  }
}



