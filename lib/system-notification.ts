import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export interface SystemBarNotificationOptions {
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: string;
  channelName?: string;
}

/**
 * Memunculkan notifikasi native murni di Status Bar / Notification Drawer sistem Android/iOS
 * dengan getar, suara, dan prioritas Heads-up (MAX)
 */
export async function showSystemBarNotification({
  title,
  body,
  data,
  channelId = "nuenime_system",
  channelName = "Siaran & Pengumuman Nuenime",
}: SystemBarNotificationOptions): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(channelId, {
        name: channelName,
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#8C57FF",
        sound: "default",
        showBadge: true,
        enableLights: true,
        enableVibrate: true,
      });
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: data || {},
      },
      trigger: null, // trigger null = langsung muncul detik ini juga di status bar
    });
  } catch (err) {
    console.warn("Failed to show system bar notification:", err);
  }
}
