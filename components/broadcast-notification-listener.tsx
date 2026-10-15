import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { AppIcon } from "@/components/app-icon";
import {
  getLatestBroadcastNotification,
  type BroadcastNotification,
} from "@/lib/admin-service";
import { supabase } from "@/lib/supabase";

export function BroadcastNotificationListener() {
  const [broadcast, setBroadcast] = useState<BroadcastNotification | null>(null);
  const [visible, setVisible] = useState(false);

  const checkLatest = useCallback(async () => {
    try {
      const latest = await getLatestBroadcastNotification();
      if (!latest || !latest.id) return;

      // Cek apakah sudah pernah ditutup user
      const dismissed = await AsyncStorage.getItem(`nuenime.seen_broadcast.${latest.id}`);
      if (dismissed) return;

      // Cek apakah broadcast masih baru (maks 3 hari)
      const createdTime = new Date(latest.createdAt).getTime();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      if (Date.now() - createdTime > threeDaysMs) return;

      setBroadcast(latest);
      setVisible(true);
    } catch {}
  }, []);

  useEffect(() => {
    checkLatest();

    // Listen real-time broadcast dari Supabase
    const channel = supabase
      .channel("realtime-broadcast-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "system_configs",
          filter: "key=eq.broadcast_latest",
        },
        (payload: any) => {
          if (payload.new && payload.new.value) {
            const val = typeof payload.new.value === "string" ? JSON.parse(payload.new.value) : payload.new.value;
            if (val && val.id) {
              setBroadcast(val);
              setVisible(true);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkLatest]);

  const handleDismiss = async () => {
    if (broadcast?.id) {
      await AsyncStorage.setItem(`nuenime.seen_broadcast.${broadcast.id}`, "1");
    }
    setVisible(false);
  };

  const handleAction = async () => {
    if (!broadcast?.actionUrl) {
      handleDismiss();
      return;
    }
    const url = broadcast.actionUrl.trim();
    handleDismiss();

    if (url.startsWith("http://") || url.startsWith("https://")) {
      void Linking.openURL(url).catch(() => {});
    } else if (url.startsWith("/")) {
      router.push(url as never);
    }
  };

  if (!visible || !broadcast) return null;

  const getTypeColor = () => {
    switch (broadcast.type) {
      case "promo":
        return "#10B981";
      case "maintenance":
        return "#EF4444";
      case "event":
        return "#A855F7";
      case "system":
      default:
        return "#38BDF8";
    }
  };

  const accentColor = getTypeColor();

  return (
    <View style={styles.floatingContainer}>
      <View style={[styles.card, { borderColor: accentColor }]}>
        <View style={styles.contentRow}>
          <View style={[styles.iconBadge, { backgroundColor: `${accentColor}20` }]}>
            <AppIcon name="megaphone" size={16} color={accentColor} />
          </View>

          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.typeTag, { color: accentColor }]}>
                [{broadcast.type.toUpperCase()}]
              </Text>
              <Text style={styles.titleText} numberOfLines={1}>
                {broadcast.title}
              </Text>
            </View>
            <Text style={styles.messageText} numberOfLines={2}>
              {broadcast.message}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <AppIcon name="close" size={15} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {Boolean(broadcast.actionUrl) && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: accentColor }]}
            onPress={handleAction}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionBtnText, { color: accentColor }]}>
              Buka Tautan Informasi
            </Text>
            <AppIcon name="arrow-forward" size={13} color={accentColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    top: 52,
    left: 16,
    right: 16,
    zIndex: 99999,
  },
  card: {
    backgroundColor: "#111722",
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  typeTag: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  titleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
  },
  messageText: {
    fontSize: 11.5,
    lineHeight: 16,
    color: "#CBD5E1",
  },
  closeBtn: {
    padding: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 7,
    marginTop: 8,
  },
  actionBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
});
