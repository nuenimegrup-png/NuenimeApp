import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: string;
  sound?: "default" | null;
}

const STORAGE_SAVED_TOKEN = "nuenime.saved_push_token";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PROJECT_ID = "e96fc02e-d968-4f13-a688-0d553d855df7";

/**
 * Mendaftarkan perangkat ke Google FCM / Expo Push Service dan menyimpan tokennya ke Supabase
 * agar HP tetap bisa menerima notifikasi secara real-time meskipun APK sedang mati total.
 * Bekerja baik untuk pengguna yang sudah login maupun tamu (guest).
 */
export async function registerAndSavePushToken(userId?: string | null): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });
    const pushToken = tokenResponse?.data;
    if (!pushToken) return null;

    // 1. Simpan token ke global device registry (system_configs) agar perangkat tamu pun bisa menerima siaran massal
    try {
      const { data: cfg } = await supabase
        .from("system_configs")
        .select("value")
        .eq("key", "device_push_tokens")
        .maybeSingle();

      const currentTokens: string[] = Array.isArray(cfg?.value) ? (cfg.value as string[]) : [];
      if (!currentTokens.includes(pushToken)) {
        currentTokens.push(pushToken);
        await supabase.from("system_configs").upsert({
          key: "device_push_tokens",
          value: currentTokens.slice(-500),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (cfgErr) {
      console.warn("[PushService] Failed updating device_push_tokens in system_configs:", cfgErr);
    }

    // 2. Simpan ke tabel profiles jika pengguna sudah login
    if (userId) {
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ push_token: pushToken })
        .eq("id", userId);
      if (!updErr) {
        await AsyncStorage.setItem(`${STORAGE_SAVED_TOKEN}_${userId}`, pushToken);
        await AsyncStorage.setItem(STORAGE_SAVED_TOKEN, pushToken);
      }
    }

    return pushToken;
  } catch (err) {
    console.warn("[PushService] Failed to register push token:", err);
    return null;
  }
}

/**
 * Mengirim push notification langsung ke server Expo / Google FCM.
 * Pesan ini akan langsung diteruskan oleh Google ke perangkat Android target
 * walaupun aplikasinya sedang ditutup / dibersihkan dari bar recent apps.
 */
export async function sendExpoPush(
  targets: string | string[],
  payload: PushNotificationPayload
): Promise<boolean> {
  const tokenList = Array.isArray(targets) ? targets : [targets];
  const validTokens = tokenList.filter(
    (t) => typeof t === "string" && (t.startsWith("ExponentPushToken") || t.startsWith("ExpoPushToken"))
  );

  if (validTokens.length === 0) return false;

  // Chunk dalam batch maksimal 100 sesuai spesifikasi Expo API
  const chunkSize = 100;
  for (let i = 0; i < validTokens.length; i += chunkSize) {
    const chunk = validTokens.slice(i, i + chunkSize);
    const messages = chunk.map((to) => ({
      to,
      sound: payload.sound ?? "default",
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      priority: "high",
      channelId: payload.channelId || "nuenime_system",
    }));

    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
    } catch (err) {
      console.warn("[PushService] Error dispatching push chunk:", err);
    }
  }

  return true;
}

/**
 * Mengirim Push Notification ke pengguna tertentu berdasarkan userId.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  if (!userId) return false;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", userId)
      .single();

    if (error || !data?.push_token) return false;
    return await sendExpoPush(data.push_token, payload);
  } catch (err) {
    console.warn("[PushService] Failed to send push to user:", err);
    return false;
  }
}

/**
 * Mengirim Push Notification ke semua pengguna (Broadcast / Pengumuman Sistem).
 */
export async function sendPushToAllUsers(
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    // 1. Ambil dari profiles (pengguna yang sudah login)
    const { data: profData } = await supabase
      .from("profiles")
      .select("push_token")
      .not("push_token", "is", null);

    // 2. Ambil dari global device registry (system_configs) untuk semua perangkat terinstal
    const { data: cfgData } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "device_push_tokens")
      .maybeSingle();

    const profTokens = (profData || []).map((d) => d.push_token).filter(Boolean) as string[];
    const deviceTokens = Array.isArray(cfgData?.value) ? (cfgData.value as string[]) : [];

    const allTokens = Array.from(new Set([...profTokens, ...deviceTokens])).filter(
      (t) => typeof t === "string" && (t.startsWith("ExponentPushToken") || t.startsWith("ExpoPushToken"))
    );

    if (allTokens.length === 0) return false;

    return await sendExpoPush(allTokens, payload);
  } catch (err) {
    console.warn("[PushService] Failed to broadcast push:", err);
    return false;
  }
}
