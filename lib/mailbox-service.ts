import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import type { AdminUser } from "./admin-service";
import { logAdminAction } from "./admin-service";
import { addCrystalBalance, getCrystalBalance } from "./topup-service";
import { recordBorderPurchaseToSupabase } from "./avatar-borders";

export interface SystemGift {
  id: string;
  title: string;
  message: string;
  giftType: "crystal" | "border";
  giftValue: string;
  isActive: boolean;
  createdAt: string;
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
 */
export async function getUserMailboxGifts(userId?: string | null): Promise<SystemGift[]> {
  const allGifts = await getAllAdminGifts();
  const activeGifts = allGifts.filter((g) => g.isActive);

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
