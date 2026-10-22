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
 */
export async function registerAndSavePushToken(userId: string): Promise<string | null> {
  if (Platform.OS === "web" || !userId) return null;

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

    // Simpan ke Supabase jika token belum pernah disimpan atau ada perubahan
    const savedToken = await AsyncStorage.getItem(STORAGE_SAVED_TOKEN);
    if (savedToken !== pushToken) {
      await supabase
        .from("profiles")
        .update({ push_token: pushToken })
        .eq("id", userId);
      await AsyncStorage.setItem(STORAGE_SAVED_TOKEN, pushToken);
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
    const { data, error } = await supabase
      .from("profiles")
      .select("push_token")
      .not("push_token", "is", null);

    if (error || !data || data.length === 0) return false;

    const allTokens = data.map((d) => d.push_token).filter(Boolean) as string[];
    return await sendExpoPush(allTokens, payload);
  } catch (err) {
    console.warn("[PushService] Failed to broadcast push:", err);
    return false;
  }
}
