import { useState } from "react";
import {
  Alert,
  Image,
  Linking,
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

const SAWERIA_URL = "https://saweria.co/Nuenime";

// GIF URLs
const ANIME_GIF_URI = "https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUyNjlyNmhqaWgzaHBvYXA0cXEzZ3BuaDV4cTFxdHl0dTRod3JzMTcxdSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/Al9XitEIwGgLU9yMfS/giphy.gif";
const THANKYOU_GIF_URI = "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUydG11ZWV3OXNkdzYzdjV6bXdmNTk2ZWNmcW9ydjRjczZ5dDNrOGF2YiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/UJuLfuG78YTDslaBcK/giphy.gif";

export default function SupportScreen() {
  const [copied, setCopied] = useState(false);

  const openSaweria = async () => {
    try {
      await Linking.openURL(SAWERIA_URL);
    } catch {
      Alert.alert("Error", "Tidak bisa membuka Saweria. Silakan buka manual di saweria.co/Nuenime");
    }
  };

  const copySaweriaLink = async () => {
    try {
      await Clipboard.setStringAsync(SAWERIA_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      Alert.alert("Error", "Gagal menyalin link.");
    }
  };

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
          <Image
            source={{ uri: ANIME_GIF_URI }}
            style={styles.gifHero}
            resizeMode="cover"
          />
          <View style={styles.gifOverlay} />
          <View style={styles.gifTextOverlay}>
            <Text style={styles.gifBadge}>🎌 NUENIME</Text>
            <Text style={styles.gifTitle}>Jaga Nuenime Tetap Hidup</Text>
            <Text style={styles.gifSub}>
              Setiap dukungan kamu sangat berarti untuk kami terus berkembang!
            </Text>
          </View>
        </View>

        {/* ── Saweria Card ── */}
        <View style={styles.card}>
          {/* Card header */}
          <View style={styles.cardTopRow}>
            <View style={styles.saweriaBadge}>
              <Text style={styles.saweriaEmoji}>☕</Text>
              <Text style={styles.saweriaTitle}>Saweria</Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>AKTIF</Text>
            </View>
          </View>

          <Text style={styles.cardDesc}>
            Dukung Nuenime lewat Saweria — sekali bayar, nominal bebas, tidak perlu akun premium.
          </Text>

          {/* URL display */}
          <View style={styles.urlBox}>
            <AppIcon name="earth" size={14} color="#94A3B8" />
            <Text style={styles.urlText} numberOfLines={1}>saweria.co/Nuenime</Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="link"
              onPress={() => void openSaweria()}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.primaryBtnText}>☕ Dukung Sekarang</Text>
              <AppIcon name="open-in-new" size={14} color="#0B0E17" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void copySaweriaLink()}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
            >
              <AppIcon name="content-copy" size={15} color={copied ? "#10B981" : "#94A3B8"} />
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
          {[
            { icon: "play-circle", text: "Server & hosting aplikasi Nuenime" },
            { icon: "bell", text: "Update konten & fitur baru" },
            { icon: "account-group", text: "Komunitas anime Indonesia" },
            { icon: "heart", text: "Semangat tim pengembang" },
          ].map((p) => (
            <View key={p.text} style={styles.perkRow}>
              <View style={styles.perkIconWrap}>
                <AppIcon name={p.icon} size={15} color="#A78BFA" />
              </View>
              <Text style={styles.perkText}>{p.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Thank you GIF ── */}
        <View style={styles.thankyouSection}>
          <Image
            source={{ uri: THANKYOU_GIF_URI }}
            style={styles.thankyouGif}
            resizeMode="contain"
          />
          <Text style={styles.thankyouText}>
            Arigatou gozaimasu! 🙏{"\n"}Dukunganmu sangat berarti untuk Nuenime.
          </Text>
        </View>

        <Text style={styles.footnote}>
          Dukungan bersifat sukarela dan tidak mempengaruhi akses ke fitur Nuenime.
        </Text>
      </ScrollView>
    </NativeScreen>
  );
}

const ACCENT = "#A78BFA";

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
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  headerTitle: { gap: 1 },
  headerEyebrow: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#64748B",
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
    color: ACCENT,
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

  // ── Saweria Card ──
  card: {
    marginHorizontal: 16,
    backgroundColor: "#161922",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.2)",
    padding: 18,
    gap: 14,
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
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 13,
  },
  primaryBtnText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 14,
    color: "#0B0E17",
  },
  secondaryBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
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

  // ── Perks ──
  perksCard: {
    marginHorizontal: 16,
    backgroundColor: "#161922",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 18,
    gap: 12,
  },
  perksTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#64748B",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  perkIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(167,139,250,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  perkText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 13.5,
    color: "#CBD5E1",
    flex: 1,
  },

  // ── Thank you ──
  thankyouSection: {
    marginHorizontal: 16,
    backgroundColor: "#161922",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
    alignItems: "center",
    gap: 14,
    paddingBottom: 18,
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
    color: "#3F3F46",
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 17,
  },
});
