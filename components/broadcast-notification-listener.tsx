import { useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLatestBroadcastNotification } from "@/lib/admin-service";
import { showSystemBarNotification } from "@/lib/system-notification";
import { supabase } from "@/lib/supabase";

/**
 * BroadcastNotificationListener
 * Menangani notifikasi siaran admin di luar aplikasi (Status Bar / System Tray HP).
 * Sesuai kebutuhan user: Tidak ada banner / popup di dalam tampilan APK,
 * notifikasi murni muncul di Status Bar HP (notifikasi luar).
 */
export function BroadcastNotificationListener() {
  const checkLatest = useCallback(async () => {
    try {
      const latest = await getLatestBroadcastNotification();
      if (!latest || !latest.id) return;

      // Cek apakah broadcast masih baru (maks 3 hari)
      const createdTime = new Date(latest.createdAt).getTime();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      if (Date.now() - createdTime > threeDaysMs) return;

      // Picu notifikasi murni di Status Bar HP di luar aplikasi
      const notified = await AsyncStorage.getItem(`nuenime.system_notified.${latest.id}`);
      if (!notified) {
        await AsyncStorage.setItem(`nuenime.system_notified.${latest.id}`, "1");
        void showSystemBarNotification({
          title: latest.title,
          body: latest.message,
          data: { actionUrl: latest.actionUrl, type: latest.type },
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkLatest();
    }, 1000);
    return () => clearTimeout(timer);
  }, [checkLatest]);

  useEffect(() => {
    // Listen real-time broadcast dari Supabase
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const channelName = `realtime-broadcast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "system_configs",
            filter: "key=eq.broadcast_latest",
          },
          async (payload: any) => {
            if (payload.new && payload.new.value) {
              try {
                const val =
                  typeof payload.new.value === "string"
                    ? JSON.parse(payload.new.value)
                    : payload.new.value;
                if (val && val.id && val.title) {
                  // Munculkan notifikasi murni di Status Bar HP (di luar aplikasi)
                  await AsyncStorage.setItem(`nuenime.system_notified.${val.id}`, "1");
                  void showSystemBarNotification({
                    title: val.title,
                    body: val.message || "",
                    data: { actionUrl: val.actionUrl, type: val.type },
                  });
                }
              } catch {}
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("[broadcast-listener] Supabase realtime subscription warning:", err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel).catch(() => {});
        } catch {}
      }
    };
  }, []);

  // Tidak menampilkan banner apapun di dalam APK (return null)
  // Notifikasi hanya tampil di luar (Status Bar Android)
  return null;
}
