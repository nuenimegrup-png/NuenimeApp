import { memo, useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { AppIcon } from "@/components/app-icon";
import { getLevelProgressInfo } from "@/lib/user-level";

export type ExpToastData = {
  id: string;
  totalXp: number;
  baseXp: number;
  bonusXp?: number;
  description: string;
  level: number;
  oldLevel?: number;
  levelUp?: boolean;
  newTotalXp: number;
  isVip?: boolean;
};

export type ExpPopupToastProps = {
  data: ExpToastData | null;
  onDismiss: () => void;
};

export const ExpPopupToast = memo(function ExpPopupToast({
  data,
  onDismiss,
}: ExpPopupToastProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 32, 380);

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(-30)).current;

  useEffect(() => {
    if (!data) return;

    // Masuk dengan animasi halus (fade in & slide down)
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        damping: 15,
        stiffness: 150,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();

    // Tunggu 3.6 detik lalu keluar dengan animasi halus
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(translateYAnim, {
          toValue: -25,
          duration: 250,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start(() => {
        onDismiss();
      });
    }, 3600);

    return () => clearTimeout(timer);
  }, [data, opacityAnim, translateYAnim, onDismiss]);

  if (!data) return null;

  const levelInfo = getLevelProgressInfo(data.newTotalXp);
  const bonusXp = data.bonusXp || 0;
  const isLevelUp = Boolean(data.levelUp && (data.oldLevel ?? 0) < data.level);

  return (
    <View style={styles.toastWrapper} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.container,
          {
            width: cardWidth,
            opacity: opacityAnim,
            transform: [{ translateY: translateYAnim }],
          },
        ]}
      >
        {/* Banner Khusus Ketika LEVEL UP */}
        {isLevelUp ? (
          <View style={styles.levelUpBanner}>
            <AppIcon name="party-popper" size={15} color="#FBBF24" />
            <Text style={styles.levelUpBannerText}>
              LEVEL UP! Lvl {data.oldLevel ?? data.level - 1} → Lvl {data.level}
            </Text>
          </View>
        ) : null}

        {/* ─── 1. BARIS ATAS: IKON PANAH NAIK + JUMLAH EXP ─── */}
        <View style={styles.topRow}>
          <View style={styles.arrowCircle}>
            <AppIcon name="arrow-up" size={20} color="#38BDF8" />
          </View>
          <View style={styles.expTitleRow}>
            <Text style={styles.expValue}>+{data.totalXp}</Text>
            <Text style={styles.expUnit}> EXP</Text>
          </View>
        </View>

        {/* ─── 2. KOTAK TENGAH: RINCIAN BASE & PREMIUM (SESUAI GAMBAR) ─── */}
        <View style={styles.detailBox}>
          {/* Base EXP */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Base</Text>
            <Text style={styles.detailValue}>+{data.baseXp}xp</Text>
          </View>

          {/* Premium / VIP Bonus EXP */}
          {bonusXp > 0 || data.isVip ? (
            <View style={[styles.detailRow, { marginTop: 6 }]}>
              <View style={styles.premiumLabelWrap}>
                <Text style={styles.detailLabel}>Premium</Text>
                <Text style={styles.premiumPercent}>(+50%)</Text>
              </View>
              <Text style={styles.detailValue}>+{bonusXp}xp</Text>
            </View>
          ) : (
            <View style={[styles.detailRow, { marginTop: 6 }]}>
              <Text style={styles.detailDesc} numberOfLines={1}>
                {data.description || "Aktivitas Terverifikasi"}
              </Text>
            </View>
          )}
        </View>

        {/* ─── 3. BARIS BAWAH: LEVEL & SISA EXP UNTUK NAIK LEVEL ─── */}
        <View style={styles.bottomRow}>
          <Text style={styles.levelLabel}>Level {data.level}</Text>
          <Text style={styles.remainingXpText}>
            Sisa {levelInfo.xpRemaining.toLocaleString("id-ID")} xp lagi
          </Text>
        </View>

        {/* PROGRESS BAR BIRU MODERN */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.max(4, levelInfo.progressPercent)}%` },
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  toastWrapper: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 42,
    left: 0,
    right: 0,
    zIndex: 999999,
    alignItems: "center",
    justifyContent: "center",
    elevation: 999,
  },
  container: {
    backgroundColor: "#111622",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 12,
  },
  levelUpBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 12,
    gap: 6,
  },
  levelUpBannerText: {
    color: "#FBBF24",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  arrowCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1E2638",
    alignItems: "center",
    justifyContent: "center",
  },
  expTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  expValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#38BDF8",
    letterSpacing: 0.2,
  },
  expUnit: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  detailBox: {
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.03)",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  premiumLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  detailLabel: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500",
  },
  premiumPercent: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "600",
  },
  detailValue: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "600",
  },
  detailDesc: {
    color: "#64748B",
    fontSize: 11,
    fontStyle: "italic",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  levelLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  remainingXpText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: "#1E293B",
    borderRadius: 3,
    marginTop: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#38BDF8",
    borderRadius: 3,
  },
});
