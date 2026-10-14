import { useState, useEffect } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";
import {
  type SupportConfig,
  getSupportConfig,
  DEFAULT_SUPPORT_CONFIG,
} from "@/lib/support-service";

// ── Liquid Glass / Silver palette (matches home screen buttons) ──
const GLASS_BG      = "rgba(255, 255, 255, 0.12)";
const GLASS_BORDER  = "rgba(255, 255, 255, 0.22)";
const GLASS_BG_DIM  = "rgba(255, 255, 255, 0.07)";
const GLASS_BD_DIM  = "rgba(255, 255, 255, 0.14)";

export default function SupportScreen() {
  const [config, setConfig] = useState<SupportConfig>(DEFAULT_SUPPORT_CONFIG);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    getSupportConfig().then((cfg) => {
      if (mounted && cfg) {
        setConfig(cfg);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const openSaweria = async () => {
    const url = config.saweriaUrl || "https://saweria.co/Nuenime";
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", `Tidak bisa membuka link donasi. Silakan buka manual di ${url}`);
    }
  };

  const copySaweriaLink = async () => {
    const url = config.saweriaUrl || "https://saweria.co/Nuenime";
    try {
      await Clipboard.setStringAsync(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      Alert.alert("Error", "Gagal menyalin link.");
    }
  };

  const displayUrl = (config.saweriaUrl || "saweria.co/Nuenime").replace(/^https?:\/\//i, "");

  return (
    <NativeScreen scroll={false}>
      {/* ── Sticky Header ── */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <AppIcon name="arrow-left" size={21} color={nothing.white} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.headerEyebrow}>NUENIME · DUKUNGAN</Text>
          <Text style={styles.headerText}>Support</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Anime GIF Hero ── */}
        <View style={styles.gifHeroWrap}>
          {config.heroGifUrl ? (
            <Image
              source={{ uri: config.heroGifUrl }}
              style={styles.gifHero}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.gifHeroFallback} />
          )}
          <View style={styles.gifOverlay} />
          <View style={styles.gifTextOverlay}>
            <Text style={styles.gifBadge}>{config.headlineBadge || "🎌 NUENIME"}</Text>
            <Text style={styles.gifTitle}>{config.headlineTitle || "Jaga Nuenime Tetap Hidup"}</Text>
            <Text style={styles.gifSub}>
              {config.headlineSubtitle || "Setiap dukungan kamu sangat berarti untuk kami terus berkembang!"}
            </Text>
          </View>
        </View>

        {/* ── Saweria Card ── */}
        <View style={styles.card}>
          {/* Card header */}
          <View style={styles.cardTopRow}>
            <View style={styles.saweriaBadge}>
              <Text style={styles.saweriaEmoji}>☕</Text>
              <Text style={styles.saweriaTitle}>{config.saweriaTitle || "Saweria"}</Text>
            </View>
            <View style={[styles.livePill, !config.saweriaActive && styles.livePillInactive]}>
              <View
                style={[
                  styles.liveDot,
                  !config.saweriaActive && { backgroundColor: "#F87171" },
                ]}
              />
              <Text
                style={[
                  styles.liveText,
                  !config.saweriaActive && { color: "#F87171" },
                ]}
              >
                {config.saweriaActive ? "AKTIF" : "OFFLINE"}
              </Text>
            </View>
          </View>

          <Text style={styles.cardDesc}>
            {config.saweriaDescription || "Dukung Nuenime lewat Saweria — sekali bayar, nominal bebas, tidak perlu akun premium."}
          </Text>

          {/* URL display */}
          <View style={styles.urlBox}>
            <AppIcon name="earth" size={14} color="#CBD5E1" />
            <Text style={styles.urlText} numberOfLines={1}>{displayUrl}</Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="link"
              onPress={() => void openSaweria()}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.primaryBtnText}>☕ Dukung Sekarang</Text>
              <AppIcon name="open-in-new" size={14} color="#FFFFFF" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void copySaweriaLink()}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
            >
              <AppIcon name="content-copy" size={15} color={copied ? "#10B981" : "#CBD5E1"} />
            </Pressable>
          </View>

          {copied && (
            <View style={styles.copiedToast}>
              <AppIcon name="check-circle" size={13} color="#10B981" />
              <Text style={styles.copiedText}>Link disalin!</Text>
            </View>
          )}
        </View>

        {/* ── Perks ── */}
        <View style={styles.perksCard}>
          <Text style={styles.perksTitle}>Apa yang kamu dukung?</Text>
          {(config.perks && config.perks.length > 0 ? config.perks : DEFAULT_SUPPORT_CONFIG.perks).map((p) => (
            <View key={p.text} style={styles.perkRow}>
              <View style={styles.perkIconWrap}>
                <AppIcon name={p.icon || "heart"} size={15} color="#E2E8F0" />
              </View>
              <Text style={styles.perkText}>{p.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Thank you GIF ── */}
        <View style={styles.thankyouSection}>
          {config.thankYouGifUrl ? (
            <Image
              source={{ uri: config.thankYouGifUrl }}
              style={styles.thankyouGif}
              resizeMode="contain"
            />
          ) : null}
          <Text style={styles.thankyouText}>
            Arigatou gozaimasu! 🙏{"\n"}Dukunganmu sangat berarti untuk Nuenime.
          </Text>
        </View>

        <Text style={styles.footnote}>
          {config.footnote || "Dukungan bersifat sukarela dan tidak mempengaruhi akses ke fitur Nuenime."}
        </Text>
      </ScrollView>
    </NativeScreen>
  );
}

const SILVER_ACCENT = "#E2E8F0";

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 14,
    backgroundColor: "#0B0E17",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  headerTitle: { gap: 1 },
  headerEyebrow: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#94A3B8",
    letterSpacing: 1,
  },
  headerText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },

  scrollContent: {
    paddingBottom: 52,
    gap: 16,
  },

  // ── GIF Hero ──
  gifHeroWrap: {
    height: 200,
    position: "relative",
    overflow: "hidden",
  },
  gifHero: {
    width: "100%",
    height: "100%",
  },
  gifHeroFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#161922",
  },
  gifOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,14,23,0.55)",
  },
  gifTextOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    gap: 4,
  },
  gifBadge: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 10.5,
    color: "#E2E8F0",
    letterSpacing: 1.2,
  },
  gifTitle: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  gifSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 18,
  },

  // ── Saweria Card (Liquid Glass & Silver) ──
  card: {
    marginHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 18,
    gap: 14,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  saweriaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  saweriaEmoji: { fontSize: 28 },
  saweriaTitle: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
  },
  livePillInactive: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderColor: "rgba(239,68,68,0.3)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  liveText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#10B981",
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 13.5,
    color: "#94A3B8",
    lineHeight: 20,
  },
  urlBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  urlText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 13,
    color: "#CBD5E1",
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 22,
    paddingVertical: 13,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  primaryBtnText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 14,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  copiedToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
  },
  copiedText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#10B981",
  },

  // ── Perks (Liquid Glass & Silver) ──
  perksCard: {
    marginHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    padding: 18,
    gap: 12,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  perksTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#94A3B8",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  perkIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  perkText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 13.5,
    color: "#CBD5E1",
    flex: 1,
  },

  // ── Thank you (Liquid Glass & Silver) ──
  thankyouSection: {
    marginHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    overflow: "hidden",
    alignItems: "center",
    gap: 14,
    paddingBottom: 18,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  thankyouGif: {
    width: "100%",
    height: 160,
  },
  thankyouText: {
    fontFamily: "Nunito-Regular",
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },

  footnote: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 17,
  },
});
