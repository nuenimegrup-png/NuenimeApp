import React, { useState, useEffect } from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "@/components/app-icon";
import { hapticLight } from "@/lib/haptics";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { getTierForLevel } from "@/components/level-progress-modal";
import { DuniaView } from "@/components/dunia/dunia-view";
import { getCrystalBalance, deductCrystalBalance, addCrystalBalance } from "@/lib/topup-service";
import { getBorderByIdAsync } from "@/lib/avatar-borders";

// URL resmi Vercel NuePet Zoo
const DEFAULT_NUEPET_URL =
  process.env.EXPO_PUBLIC_NUEPET_URL || "https://nuepet-zoo.vercel.app";

export default function NuePetZooScreen() {
  const insets = useSafeAreaInsets();
  const auth = useAnirakuAuth();
  const routeParams = useLocalSearchParams<{ tab?: string }>();
  const initialTab = routeParams.tab;

  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Saldo Crystal Nuenime untuk Gacha & Upgrade di NuePet
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

  // Handle postMessage dari NuePet Zoo webview/iframe jika ada konsumsi atau penukaran saldo crystal
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleWebMessage = async (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data && data.type === "UPDATE_CRYSTALS" && typeof data.crystals === "number") {
          setUserCrystals(data.crystals);
        } else if (data && data.type === "ADD_CRYSTALS") {
          const amount = Number(data.amount) || 0;
          if (amount > 0) {
            await addCrystalBalance(auth.user?.id, amount);
            const newBal = await getCrystalBalance(auth.user?.id);
            setUserCrystals(newBal);
          }
        } else if (data && data.type === "DEDUCT_CRYSTALS") {
          const amount = Number(data.amount) || 0;
          if (amount > 0) {
            await deductCrystalBalance(auth.user?.id, amount);
            const newBal = await getCrystalBalance(auth.user?.id);
            setUserCrystals(newBal);
          }
        }
      } catch {}
    };

    window.addEventListener("message", handleWebMessage);
    return () => window.removeEventListener("message", handleWebMessage);
  }, [auth.user?.id]);

  // Identitas profil pengguna
  const userLevel = Number(auth.profile?.level) || 1;
  const tierInfo = getTierForLevel(userLevel);
  const rankName = tierInfo?.currentTier?.name?.toUpperCase() || "STONE";
  const displayName = auth.profile?.display_name || auth.profile?.username || "Pengasuh";
  const avatarUrl = auth.profile?.avatar_url || "";
  const equippedBorder = auth.profile?.equipped_border || "";
  const isVip = Boolean(auth.profile?.is_vip);
  const userId = auth.user?.id || "guest";

  const [resolvedBorderUrl, setResolvedBorderUrl] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    const raw = auth.profile?.equipped_border;
    if (!raw) {
      setResolvedBorderUrl("");
      return;
    }
    if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) {
      setResolvedBorderUrl(raw);
      return;
    }
    getBorderByIdAsync(raw)
      .then((b) => {
        if (mounted && b?.assetUrl) {
          setResolvedBorderUrl(b.assetUrl);
        } else if (mounted) {
          setResolvedBorderUrl(raw);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [auth.profile?.equipped_border]);

  const initialCrystalsRef = React.useRef<number | null>(null);
  if (initialCrystalsRef.current === null && userCrystals > 0) {
    initialCrystalsRef.current = userCrystals;
  }

  const targetUrl = React.useMemo(() => {
    const baseUrl = DEFAULT_NUEPET_URL.replace(/\/$/, "");
    const userExp = Number(auth.profile?.exp) || 0;
    const initialCrystals = initialCrystalsRef.current ?? userCrystals;
    const params = new URLSearchParams({
      uid: userId,
      name: displayName,
      level: String(userLevel),
      exp: String(userExp),
      rank: rankName,
      avatar: avatarUrl,
      border: resolvedBorderUrl || equippedBorder,
      vip: isVip ? "1" : "0",
      crystals: String(initialCrystals || 0),
      ...(initialTab ? { tab: initialTab } : {}),
    });
    return `${baseUrl}/?${params.toString()}`;
  }, [
    userId,
    displayName,
    userLevel,
    rankName,
    avatarUrl,
    resolvedBorderUrl,
    equippedBorder,
    isVip,
    initialTab,
    reloadKey,
  ]);

  const handleBack = () => {
    hapticLight();
    router.back();
  };

  const handleRefresh = () => {
    hapticLight();
    setHasError(false);
    setReloadKey((k) => k + 1);
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
          <View style={styles.titleRow}>
            <Text style={styles.headerIcon}>🐾</Text>
            <Text style={styles.headerTitle}>NuePet Zoo</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Muat Ulang"
            onPress={handleRefresh}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.btnPressed]}
            hitSlop={10}
          >
            <AppIcon name="refresh" size={19} color="#94A3B8" />
          </Pressable>

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

      {/* ─── OFFLINE / ERROR STATE (Hanya tampil jika server tidak merespons) ─── */}
      {hasError ? (
        <View style={styles.errorContainer}>
          <AppIcon name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Koneksi Terputus</Text>
          <Text style={styles.errorDesc}>
            Gagal terhubung ke server NuePet Zoo ({DEFAULT_NUEPET_URL}).
            {"\n\n"}Pastikan koneksi internet aktif dan server Vercel dapat diakses.
          </Text>
          <Pressable
            onPress={handleRefresh}
            style={({ pressed }) => [styles.retryBtn, pressed && styles.btnPressed]}
          >
            <AppIcon name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Coba Hubungkan Ulang</Text>
          </Pressable>
        </View>
      ) : (
        /* ─── LANGSUNG TAMPILKAN WEBVIEW / CANVAS 3D NUEPET ZOO TANPA LOADING GANDA ─── */
        <View style={styles.webviewContainer}>
          <DuniaView
            key={reloadKey}
            url={targetUrl}
            onError={() => setHasError(true)}
            onMessage={(data) => {
              if (data && data.type === "UPDATE_CRYSTALS" && typeof data.crystals === "number") {
                setUserCrystals(data.crystals);
              } else if (data && data.type === "ADD_CRYSTALS") {
                const amount = Number(data.amount) || 0;
                if (amount > 0) {
                  void addCrystalBalance(auth.user?.id, amount)
                    .then(() => getCrystalBalance(auth.user?.id))
                    .then((newBal) => setUserCrystals(newBal));
                }
              } else if (data && data.type === "DEDUCT_CRYSTALS") {
                const amount = Number(data.amount) || 0;
                if (amount > 0) {
                  void deductCrystalBalance(auth.user?.id, amount)
                    .then(() => getCrystalBalance(auth.user?.id))
                    .then((newBal) => setUserCrystals(newBal));
                }
              }
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E14",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#0F131C",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  headerTitleWrap: {
    alignItems: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: "#0B0E14",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    backgroundColor: "#0B0E14",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 14,
    marginBottom: 8,
  },
  errorDesc: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EAB308",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
});
