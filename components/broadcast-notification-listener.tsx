import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Animated,
  PanResponder,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "@/components/app-icon";
import { useAnirakuAuth } from "@/providers/auth-provider";
import {
  getLatestBroadcastNotification,
  type BroadcastNotification,
} from "@/lib/admin-service";
import { showSystemBarNotification } from "@/lib/system-notification";
import { supabase } from "@/lib/supabase";

export function BroadcastNotificationListener() {
  const [broadcast, setBroadcast] = useState<BroadcastNotification | null>(null);
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const auth = useAnirakuAuth();

  // Animation values for dynamic top notification entrance/exit
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateIn = useCallback(() => {
    translateY.setValue(-120);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  const animateOut = useCallback((onComplete?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      if (onComplete) onComplete();
    });
  }, [opacity, translateY]);

  const checkLatest = useCallback(async () => {
    // Jangan tampilkan notifikasi jika user belum login atau masih loading
    if (auth.loading || !auth.user) {
      setVisible(false);
      return;
    }

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
      animateIn();

      // Picu notifikasi murni di Status Bar HP jika belum pernah dimunculkan untuk broadcast ini
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
  }, [auth.loading, auth.user, animateIn]);

  useEffect(() => {
    if (!auth.loading && auth.user) {
      // Delay sedikit agar user mendarat di home sebelum notifikasi meluncur dari atas
      const timer = setTimeout(() => {
        checkLatest();
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [checkLatest, auth.loading, auth.user]);

  useEffect(() => {
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
            const val =
              typeof payload.new.value === "string"
                ? JSON.parse(payload.new.value)
                : payload.new.value;
            if (val && val.id) {
              setBroadcast(val);
              setVisible(true);
              animateIn();

              // Langsung munculkan notifikasi status bar HP detik ini juga
              void showSystemBarNotification({
                title: val.title,
                body: val.message,
                data: { actionUrl: val.actionUrl, type: val.type },
              });
            }
          } else if (payload.new && !payload.new.value) {
            // Admin menghapus siaran
            animateOut();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [animateIn, animateOut]);

  // Auto-dismiss setelah 12 detik agar tidak mengganggu terus-menerus
  useEffect(() => {
    if (visible) {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        handleDismiss();
      }, 12000);
    }
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [visible]);

  const handleDismiss = async () => {
    if (broadcast?.id) {
      try {
        await AsyncStorage.setItem(`nuenime.seen_broadcast.${broadcast.id}`, "1");
      } catch {}
    }
    animateOut();
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

  // PanResponder untuk gesture swipe-up to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy < -10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -20) {
          handleDismiss();
        }
      },
    })
  ).current;

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

  const getTypeIcon = () => {
    switch (broadcast.type) {
      case "promo":
        return "gift";
      case "maintenance":
        return "shield-alert-outline";
      case "event":
        return "trophy";
      case "system":
      default:
        return "megaphone";
    }
  };

  const accentColor = getTypeColor();
  const iconName = getTypeIcon();
  const topPosition = Math.max(insets.top + 8, 48);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.floatingContainer,
        {
          top: topPosition,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={[styles.card, { borderColor: `${accentColor}50` }]}>
        {/* Glow indicator line at top */}
        <View style={[styles.glowLine, { backgroundColor: accentColor }]} />

        <View style={styles.contentRow}>
          <View style={[styles.iconBadge, { backgroundColor: `${accentColor}25` }]}>
            <AppIcon name={iconName} size={16} color={accentColor} />
          </View>

          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <View style={[styles.typePill, { backgroundColor: `${accentColor}20` }]}>
                <Text style={[styles.typeTag, { color: accentColor }]}>
                  {broadcast.type.toUpperCase()}
                </Text>
              </View>
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
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Tutup notifikasi"
          >
            <AppIcon name="close" size={15} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {Boolean(broadcast.actionUrl) && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: `${accentColor}40` }]}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 99999,
  },
  card: {
    backgroundColor: "rgba(17, 23, 34, 0.95)",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 12,
  },
  glowLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
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
    marginBottom: 3,
  },
  typePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  typeTag: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
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
