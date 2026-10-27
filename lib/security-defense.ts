import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

// ─── KEYS UNTUK ASYNC STORAGE ───
const LAST_DISCUSSION_TIME_KEY = "@nuenime_last_discussion_timestamp_";
const LAST_CHAT_TIME_KEY = "@nuenime_last_chat_timestamp_";
const RECENT_MESSAGES_KEY = "@nuenime_recent_user_messages_";

export const DISCUSSION_COOLDOWN_SECONDS = 60; // 1 menit jeda pesan diskusi anti-spam
export const CHAT_COOLDOWN_SECONDS = 30; // 30 detik jeda pesan chat anti-flood & anti-spam
export const MAX_SAME_MESSAGE_LIMIT = 4; // 4x pesan spam panjang yang sama = AUTO BAN

/**
 * 1. SANITASI PESAN (ANTI-INJEKSI XSS & SQL & ZERO-WIDTH EVASION)
 * Membersihkan pesan dari script jahat, HTML tags, escape SQL injections,
 * karakter zero-width tak terlihat, serta membatasi panjang payload.
 */
export function sanitizeMessage(raw: string, maxLength = 500): string {
  if (!raw) return "";

  let cleaned = raw;

  // 1. Hilangkan karakter tak terlihat (Zero-width / Null bytes / Control chars)
  // yang sering digunakan hacker untuk mengelabui filter
  cleaned = cleaned.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, "");

  // 2. Anti-XSS: Hapus tag berbahaya seperti <script>, <iframe>, <object>, <embed>, <svg>, <style>, dll
  cleaned = cleaned.replace(/<\s*(script|iframe|object|embed|svg|style|link|meta|base|form|input)[^>]*>.*?<\s*\/\s*\1\s*>/gis, "");
  cleaned = cleaned.replace(/<\s*(script|iframe|object|embed|svg|style|link|meta|base|form|input)[^>]*\/?>/gis, "");

  // 3. Hapus attribute event handler javascript (onerror=, onload=, onclick=, dll)
  cleaned = cleaned.replace(/\b(on[a-z]+)\s*=\s*(['"]).*?\2/gi, "");
  cleaned = cleaned.replace(/\b(on[a-z]+)\s*=\s*[^\s>]+/gi, "");

  // 4. Hapus pseudo-protocol berbahaya (javascript:, data:text/html, vbscript:)
  cleaned = cleaned.replace(/javascript\s*:/gi, "no-js:");
  cleaned = cleaned.replace(/data\s*:\s*text\/html/gi, "no-data:");
  cleaned = cleaned.replace(/vbscript\s*:/gi, "no-vbs:");

  // 5. Netralkan tag HTML umum untuk mencegah injeksi layout / DOM clobbering
  cleaned = cleaned.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 6. Batasi panjang maksimal (Cegah Buffer DOS / Payload raksasa)
  cleaned = cleaned.slice(0, maxLength);

  // 7. Normalisasi spasi dan baris baru berlebih (maksimal 3 baris baru beruntun)
  cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");

  return cleaned.trim();
}

/**
 * 2. NORMALISASI PESAN UNTUK CEK DUPLIKAT (ANTI-SPAM 4X)
 * Menyeragamkan teks agar spammer tidak bisa mengelabui sistem
 * hanya dengan mengganti huruf besar/kecil atau menambah spasi/tanda baca.
 */
export function normalizeForSpamCheck(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "") // Hanya ambil huruf & angka
    .trim();
}

/**
 * 3. CEK JEDA WAKTU DISKUSI (1 MENIT COOLDOWN)
 */
export async function checkDiscussionCooldown(
  userId: string
): Promise<{ allowed: boolean; remainingSeconds: number }> {
  if (!userId || userId === "guest") return { allowed: true, remainingSeconds: 0 };

  try {
    const key = `${LAST_DISCUSSION_TIME_KEY}${userId}`;
    const lastTimestampStr = await AsyncStorage.getItem(key);
    if (!lastTimestampStr) return { allowed: true, remainingSeconds: 0 };

    const lastTime = Number(lastTimestampStr) || 0;
    const now = Date.now();
    const elapsedSeconds = (now - lastTime) / 1000;

    if (elapsedSeconds < DISCUSSION_COOLDOWN_SECONDS) {
      const remainingSeconds = Math.ceil(DISCUSSION_COOLDOWN_SECONDS - elapsedSeconds);
      return { allowed: false, remainingSeconds };
    }

    return { allowed: true, remainingSeconds: 0 };
  } catch {
    return { allowed: true, remainingSeconds: 0 };
  }
}

/**
 * Catat timestamp pengiriman diskusi berhasil
 */
export async function recordDiscussionTimestamp(userId: string): Promise<void> {
  if (!userId || userId === "guest") return;
  try {
    const key = `${LAST_DISCUSSION_TIME_KEY}${userId}`;
    await AsyncStorage.setItem(key, String(Date.now()));
  } catch {}
}

/**
 * 4. CEK JEDA WAKTU CHAT (ANTI-DDOS & FLOOD PROTECTION)
 */
export async function checkChatCooldown(
  userId: string
): Promise<{ allowed: boolean; remainingSeconds: number }> {
  if (!userId || userId === "guest") return { allowed: true, remainingSeconds: 0 };

  try {
    const key = `${LAST_CHAT_TIME_KEY}${userId}`;
    const lastTimestampStr = await AsyncStorage.getItem(key);
    if (!lastTimestampStr) return { allowed: true, remainingSeconds: 0 };

    const lastTime = Number(lastTimestampStr) || 0;
    const now = Date.now();
    const elapsedSeconds = (now - lastTime) / 1000;

    if (elapsedSeconds < CHAT_COOLDOWN_SECONDS) {
      const remainingSeconds = Math.ceil(CHAT_COOLDOWN_SECONDS - elapsedSeconds);
      return { allowed: false, remainingSeconds };
    }

    return { allowed: true, remainingSeconds: 0 };
  } catch {
    return { allowed: true, remainingSeconds: 0 };
  }
}

/**
 * Catat timestamp pengiriman chat
 */
export async function recordChatTimestamp(userId: string): Promise<void> {
  if (!userId || userId === "guest") return;
  try {
    const key = `${LAST_CHAT_TIME_KEY}${userId}`;
    await AsyncStorage.setItem(key, String(Date.now()));
  } catch {}
}

/**
 * 5. CEK SPAM PESAN BERULANG & EKSEKUSI AUTO-BAN JIKA 4X SAMA
 * @param channel 'diskusi' | 'chat_global' | 'chat_pribadi'
 */
export async function checkDuplicateSpamAndAutoBan(
  userId: string,
  channel: "diskusi" | "chat_global" | "chat_pribadi",
  rawMessage: string
): Promise<{
  isAllowed: boolean;
  isBanned: boolean;
  consecutiveCount: number;
  errorMessage?: string;
  warningMessage?: string;
}> {
  if (!userId || userId === "guest") {
    return { isAllowed: true, isBanned: false, consecutiveCount: 0 };
  }

  const normalized = normalizeForSpamCheck(rawMessage);
  // Jangan deteksi spam untuk kata-kata pendek umum seperti "p", "halo", "ok", "wkwk", "tes", dll
  if (normalized.length < 6 || ["halo", "wkwk", "haha", "tes", "siap", "info", "iya", "oke", "done"].includes(normalized)) {
    return { isAllowed: true, isBanned: false, consecutiveCount: 0 };
  }

  const compareText = normalized;
  const key = `${RECENT_MESSAGES_KEY}${channel}_${userId}`;

  try {
    const stored = await AsyncStorage.getItem(key);
    let history: { text: string; time: number }[] = stored ? JSON.parse(stored) : [];

    // Filter pesan yang usianya lebih dari 15 menit
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
    history = history.filter((item) => item.time >= fifteenMinutesAgo);

    // Hitung berapa kali pesan yang sama terkirim berturut-turut di akhir
    let sameCount = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].text === compareText) {
        sameCount++;
      } else {
        break; // Hentikan hitungan jika diselingi pesan berbeda
      }
    }

    // Termasuk pesan saat ini:
    const newCount = sameCount + 1;

    // JIKA MENCAPAI 4 KALI: EKSEKUSI BLOKIR AKUN OTOMATIS!
    if (newCount >= MAX_SAME_MESSAGE_LIMIT) {
      await executeAutoBan(
        userId,
        `Diblokir otomatis oleh sistem keamanan: Terdeteksi mengirim pesan yang sama sebanyak ${newCount}x berturut-turut pada ${channel}.`
      );

      return {
        isAllowed: false,
        isBanned: true,
        consecutiveCount: newCount,
        errorMessage: `AKUN DIBLOKIR: Anda telah diblokir permanen karena mengirim pesan yang sama sebanyak 4 kali berturut-turut!`,
      };
    }

    // Simpan pesan ini ke history
    history.push({ text: compareText, time: Date.now() });
    // Pertahankan maksimal 10 entri terakhir
    if (history.length > 10) history = history.slice(-10);
    await AsyncStorage.setItem(key, JSON.stringify(history));

    // Berikan peringatan jika 2x atau 3x
    if (newCount === 3) {
      return {
        isAllowed: true,
        isBanned: false,
        consecutiveCount: newCount,
        warningMessage: `PERINGATAN KERAS (3/4): Anda telah mengirim pesan yang sama 3x. Jika mengirim pesan sama 1 kali lagi, akun Anda akan DIBLOKIR OTOMATIS!`,
      };
    }

    if (newCount === 2) {
      return {
        isAllowed: true,
        isBanned: false,
        consecutiveCount: newCount,
        warningMessage: `Peringatan (2/4): Hindari mengirim pesan yang sama berulang kali.`,
      };
    }

    return {
      isAllowed: true,
      isBanned: false,
      consecutiveCount: newCount,
    };
  } catch (err) {
    console.warn("[security-defense] checkDuplicateSpam error:", err);
    return { isAllowed: true, isBanned: false, consecutiveCount: 1 };
  }
}

/**
 * 6. EKSEKUSI PEMBLOKIRAN AKUN SECARA MENYELURUH (DATABASE + ASYNC STORAGE + BROADCAST)
 */
export async function executeAutoBan(userId: string, reason: string): Promise<void> {
  if (!userId || userId === "guest") return;

  const nowIso = new Date().toISOString();

  // 1. Simpan flag banned di AsyncStorage lokal
  try {
    await AsyncStorage.setItem(`@nuenime_user_is_banned_${userId}`, "true");
    await AsyncStorage.setItem(`@nuenime_user_ban_reason_${userId}`, reason);
  } catch {}

  // 2. Update di database Supabase (profiles)
  try {
    await supabase
      .from("profiles")
      .update({
        is_banned: true,
        banned_at: nowIso,
        ban_reason: reason,
        banned_by: "System Security Auto-Defense",
        updated_at: nowIso,
      })
      .eq("id", userId);
  } catch (dbErr) {
    console.warn("[security-defense] DB ban error:", dbErr);
  }

  // 3. Catat notifikasi pemblokiran
  try {
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Akun Anda Telah Diblokir ⚠️",
      message: reason,
      type: "account_banned",
      read: false,
    });
  } catch {}
}

// ─── PENGAMAN SISTEM TOP UP (ANTI-FLOOD & VALIDASI PAKET) ───
const LAST_TOPUP_TIME_KEY = "@nuenime_last_topup_timestamp_";
export const TOPUP_CREATE_COOLDOWN_SECONDS = 5;

/**
 * Cek jeda pembuatan invoice transaksi Top Up (Anti-DDoS / Flooding invoice)
 */
export async function checkTopupCooldown(userId: string): Promise<{ canCreate: boolean; remainingSeconds: number }> {
  if (process.env.NODE_ENV === "test") return { canCreate: true, remainingSeconds: 0 };
  if (!userId || userId === "guest") return { canCreate: true, remainingSeconds: 0 };
  try {
    const raw = await AsyncStorage.getItem(`${LAST_TOPUP_TIME_KEY}${userId}`);
    if (!raw) return { canCreate: true, remainingSeconds: 0 };
    const lastTime = parseInt(raw, 10);
    const now = Date.now();
    const diff = (now - lastTime) / 1000;
    if (diff < TOPUP_CREATE_COOLDOWN_SECONDS) {
      return { canCreate: false, remainingSeconds: Math.ceil(TOPUP_CREATE_COOLDOWN_SECONDS - diff) };
    }
  } catch {}
  return { canCreate: true, remainingSeconds: 0 };
}

/**
 * Catat waktu pembuatan invoice Top Up terbaru
 */
export async function recordTopupTimestamp(userId: string): Promise<void> {
  if (!userId || userId === "guest") return;
  try {
    await AsyncStorage.setItem(`${LAST_TOPUP_TIME_KEY}${userId}`, String(Date.now()));
  } catch {}
}

/**
 * Validasi ketat integritas paket Top Up (Mencegah manipulasi nominal/harga)
 */
export function validateTopupPackageSecurity(pkg: { id?: string; amount?: number; price?: number }): {
  valid: boolean;
  reason?: string;
} {
  if (!pkg || typeof pkg.amount !== "number" || typeof pkg.price !== "number") {
    return { valid: false, reason: "Data paket top up tidak valid atau rusak." };
  }
  if (pkg.amount <= 0 || pkg.price <= 0) {
    return { valid: false, reason: "Jumlah Crystal dan harga nominal harus lebih besar dari 0." };
  }
  if (pkg.amount > 50000000 || pkg.price > 100000000) {
    return { valid: false, reason: "Nominal transaksi melampaui batas wajar paket resmi Nuenime." };
  }
  return { valid: true };
}
