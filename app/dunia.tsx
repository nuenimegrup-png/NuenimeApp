import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { getTierForLevel } from "@/components/level-progress-modal";
import { DuniaView } from "@/components/dunia/dunia-view";
import { getCrystalBalance, deductCrystalBalance } from "@/lib/topup-service";

// Default URL deploy Vercel atau local dev server
const DEFAULT_DUNIA_URL =
  process.env.EXPO_PUBLIC_DUNIA_NUENIME_URL ||
  (Platform.OS === "web" && typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : "https://dunia-nuenime.vercel.app");

const LOADING_STEPS = [
  "Menghubungkan ke server Dunia Nuenime...",
  "Menyiapkan identitas petualang...",
  "Mengunduh aset peta dan wilayah dunia...",
  "Memuat data klan dan emblem kota...",
  "Sinkronisasi selesai, memasuki dunia...",
];

export default function DuniaNuenimeScreen() {
  const insets = useSafeAreaInsets();
  const auth = useAnirakuAuth();
  const [loadProgress, setLoadProgress] = useState(0.1);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse glow effect saat loading
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Simulasi preloader aset game (0% -> 100%)
  useEffect(() => {
    let current = 0.1;
    const interval = setInterval(() => {
      current += 0.18;
      if (current >= 1) {
        current = 1;
        setLoadProgress(1);
        setCurrentStepIdx(LOADING_STEPS.length - 1);
        clearInterval(interval);
        setTimeout(() => {
          setIsReady(true);
        }, 500);
      } else {
        setLoadProgress(current);
        const step = Math.min(
          LOADING_STEPS.length - 2,
          Math.floor(current * (LOADING_STEPS.length - 1))
        );
        setCurrentStepIdx(step);
      }
    }, 450);

    return () => clearInterval(interval);
  }, []);

  // Saldo Crystal Nuenime untuk Pembuatan Klan (2.000 Crystal)
  const [userCrystals, setUserCrystals] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    getCrystalBalance(auth.user?.id)
      .then((bal) => {
        if (mounted) setUserCrystals(bal);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [auth.user?.id]);

  // Handle postMessage dari Dunia Nuenime webview/iframe untuk potong saldo crystal
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleWebMessage = async (event: MessageEvent) => {
      try {
        const data = event.data;
        if (data && data.type === "DEDUCT_CRYSTALS") {
          const amount = Number(data.amount) || 2000;
          await deductCrystalBalance(auth.user?.id, amount);
          const newBal = await getCrystalBalance(auth.user?.id);
          setUserCrystals(newBal);
        }
      } catch {}
    };

    window.addEventListener("message", handleWebMessage);
    return () => window.removeEventListener("message", handleWebMessage);
  }, [auth.user?.id]);

  // Susun URL dengan identitas akun Nuenime terintegrasi
  const userLevel = Number(auth.profile?.level) || 1;
  const tierInfo = getTierForLevel(userLevel);
  const rankName = tierInfo?.currentTier?.name?.toUpperCase() || "STONE";
  const displayName = auth.profile?.display_name || auth.profile?.username || "Petualang";
  const avatarUrl = auth.profile?.avatar_url || "";
  const equippedBorder = auth.profile?.equipped_border || "";
  const isVip = Boolean(auth.profile?.is_vip);
  const userId = auth.user?.id || "guest";

  const targetUrl = React.useMemo(() => {
    const baseUrl = DEFAULT_DUNIA_URL.replace(/\/$/, "");
    const params = new URLSearchParams({
      uid: userId,
      name: displayName,
      level: String(userLevel),
      rank: rankName,
      avatar: avatarUrl,
      border: equippedBorder,
      vip: isVip ? "1" : "0",
      crystals: String(userCrystals),
    });
    return `${baseUrl}/?${params.toString()}`;
  }, [userId, displayName, userLevel, rankName, avatarUrl, equippedBorder, isVip, userCrystals]);

  const handleBack = () => {
    hapticLight();
    router.back();
  };

  const handleOpenExternal = () => {
    hapticLight();
    void Linking.openURL(targetUrl);
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* ─── HEADER BAR ─── */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={handleBack}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.btnPressed]}
          hitSlop={10}
        >
          <AppIcon name="arrow-left" size={22} color="#FFFFFF" />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Dunia Nuenime</Text>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Cloud Realm</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka di Browser"
            onPress={handleOpenExternal}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.btnPressed]}
            hitSlop={10}
          >
            <AppIcon name="open-in-new" size={19} color="#94A3B8" />
          </Pressable>
        </View>
      </View>

      {/* ─── GAME PRELOADER SCREEN (SEBELUM ASET SELESAI DIMUAT) ─── */}
      {!isReady && !hasError && (
        <View style={styles.loadingOverlay}>
          {/* Glowing Emblem Icon */}
          <Animated.View
            style={[
              styles.emblemCircle,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <AppIcon name="earth" size={44} color="#38BDF8" />
          </Animated.View>

          <Text style={styles.loadingTitle}>Dunia Nuenime</Text>
          <Text style={styles.loadingSubtitle}>
            Petualangan RPG & Wilayah Klan Nuenime
          </Text>

          {/* Progress Bar Persentase */}
          <View style={styles.progressBarWrap}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.round(loadProgress * 100)}%` },
              ]}
            />
          </View>

          <View style={styles.progressTextRow}>
            <Text style={styles.progressStatusText}>
              {LOADING_STEPS[currentStepIdx]}
            </Text>
            <Text style={styles.progressPercentText}>
              {Math.round(loadProgress * 100)}%
            </Text>
          </View>

          {/* User Badge Sync Preview */}
          <View style={styles.syncCard}>
            <View style={styles.syncDot} />
            <Text style={styles.syncText}>
              Menghubungkan {displayName} (Lvl {userLevel} • {rankName})
            </Text>
          </View>
        </View>
      )}

      {/* ─── OFFLINE / ERROR STATE ─── */}
      {hasError && (
        <View style={styles.errorContainer}>
          <AppIcon name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Koneksi Terputus</Text>
          <Text style={styles.errorDesc}>
            Gagal terhubung ke server Dunia Nuenime. Periksa koneksi internet Anda atau coba lagi nanti.
          </Text>
          <Pressable
            onPress={() => {
              setHasError(false);
              setLoadProgress(0.2);
              setIsReady(false);
            }}
            style={({ pressed }) => [styles.retryBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.retryBtnText}>Muat Ulang</Text>
          </Pressable>
        </View>
      )}

      {/* ─── LIVE DUNIA NUENIME CONTAINER (WEBVIEW / IFRAME) ─── */}
      <View style={[styles.duniaContainer, !isReady && { opacity: 0 }]}>
        <DuniaView
          url={targetUrl}
          onError={() => setHasError(true)}
          onLoadEnd={() => setIsReady(true)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1115",
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#12151D",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  onlineText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#10B981",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  duniaContainer: {
    flex: 1,
    backgroundColor: "#0F1115",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 52,
    backgroundColor: "#0B0E14",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    zIndex: 10,
  },
  emblemCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  loadingTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  loadingSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 32,
  },
  progressBarWrap: {
    width: "100%",
    maxWidth: 320,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    marginBottom: 10,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#38BDF8",
  },
  progressTextRow: {
    width: "100%",
    maxWidth: 320,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  progressStatusText: {
    fontFamily: "Nunito-Medium",
    fontSize: 12,
    color: "#94A3B8",
    flex: 1,
    marginRight: 8,
  },
  progressPercentText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
  },
  syncCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#A855F7",
  },
  syncText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 18,
    color: "#FFFFFF",
  },
  errorDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  retryBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  retryBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
});
