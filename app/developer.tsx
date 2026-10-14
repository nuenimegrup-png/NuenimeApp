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
import { AppIcon } from "@/components/app-icon";
import { NativeScreen } from "@/components/screen";
import { nothing } from "@/components/nothing-ui";

// ─── Types ─────────────────────────────────────────────────────────
interface SocialLink {
  icon: string;
  label: string;
  url: string;
}

interface Developer {
  name: string;
  tag: string;
  role: string;
  avatarUri?: string;
  accentColor: string;
  badgeBg: string;
  badgeBorder: string;
  social: SocialLink[];
}

// ─── Data ───────────────────────────────────────────────────────────
const developers: Developer[] = [
  {
    name: "Valora",
    tag: "Founder Valora Official Grup",
    role: "Perancang Nuenime, Desain Nuenime, Backend & Frontend",
    avatarUri: "https://i.ibb.co.com/5h7WVZ0Z/32d6acf9127007583429953eb35f37ec.jpg",
    accentColor: "#A78BFA",
    badgeBg: "rgba(139, 92, 246, 0.15)",
    badgeBorder: "rgba(139, 92, 246, 0.4)",
    social: [
      { icon: "facebook", label: "Facebook", url: "" },
      { icon: "instagram", label: "Instagram", url: "" },
      { icon: "web", label: "Website", url: "" },
    ],
  },
  {
    name: "Nueva",
    tag: "Founder Nuenime",
    role: "Founder Nuenime, Marketing & Sosial Media",
    avatarUri: undefined,
    accentColor: "#38BDF8",
    badgeBg: "rgba(56, 189, 248, 0.15)",
    badgeBorder: "rgba(56, 189, 248, 0.4)",
    social: [
      { icon: "facebook", label: "Facebook", url: "" },
      { icon: "instagram", label: "Instagram", url: "" },
      { icon: "web", label: "Website", url: "" },
    ],
  },
];

// ─── Social Button (icon only) ────────────────────────────────────────
function SocialButton({
  icon,
  label,
  url,
  accentColor,
}: SocialLink & { accentColor: string }) {
  const handlePress = async () => {
    if (!url) {
      Alert.alert("Info", `${label} belum tersedia.`);
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", `Tidak bisa membuka ${label}.`);
    }
  };

  return (
    <Pressable
      onPress={() => void handlePress()}
      accessibilityRole="link"
      accessibilityLabel={`Buka ${label}`}
      style={({ pressed }) => [
        styles.socialBtn,
        {
          backgroundColor: accentColor + "18",
          borderColor: accentColor + "50",
        },
        pressed && { opacity: 0.55, transform: [{ scale: 0.92 }] },
      ]}
    >
      <AppIcon name={icon} size={20} color={accentColor} />
    </Pressable>
  );
}

// ─── Developer Card ──────────────────────────────────────────────────
function DevCard({ dev }: { dev: Developer }) {
  const [imgError, setImgError] = useState(false);
  const initials = dev.name.charAt(0).toUpperCase();

  return (
    <View style={styles.card}>
      {/* Avatar */}
      <View style={[styles.avatarRing, { borderColor: dev.accentColor + "90" }]}>
        {dev.avatarUri && !imgError ? (
          <Image
            source={{ uri: dev.avatarUri }}
            style={styles.avatarImage}
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: dev.accentColor + "28" }]}>
            <Text style={[styles.avatarInitial, { color: dev.accentColor }]}>
              {initials}
            </Text>
          </View>
        )}
      </View>

      {/* Name */}
      <Text style={styles.devName}>{dev.name}</Text>

      {/* Tag badge */}
      <View style={[styles.tagBadge, { backgroundColor: dev.badgeBg, borderColor: dev.badgeBorder }]}>
        <AppIcon name="account-circle-outline" size={12} color={dev.accentColor} />
        <Text style={[styles.tagText, { color: dev.accentColor }]}>{dev.tag}</Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Role / Jabatan */}
      <View style={styles.sectionHeader}>
        <AppIcon name="cog-outline" size={13} color="#64748B" />
        <Text style={styles.sectionLabel}>JABATAN</Text>
      </View>
      <Text style={styles.roleText}>{dev.role}</Text>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Social Media — icons only, centered */}
      <View style={styles.sectionHeader}>
        <AppIcon name="earth" size={13} color="#64748B" />
        <Text style={styles.sectionLabel}>SOSIAL MEDIA</Text>
      </View>
      <View style={styles.socialRow}>
        {dev.social.map((s) => (
          <SocialButton key={s.label} {...s} accentColor={dev.accentColor} />
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────
export default function DeveloperScreen() {
  return (
    // scroll=false so NativeScreen is just a SafeAreaView flex container,
    // allowing us to have a sticky header + independent ScrollView below.
    <NativeScreen scroll={false}>
      {/* ── Sticky Header (tidak ikut scroll) ── */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <AppIcon name="arrow-left" size={22} color={nothing.white} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.titleText}>Developer Nuenime</Text>
          <Text style={styles.subtitleText}>Tim Pengembang & Kreator</Text>
        </View>
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroBadge}>
          <AppIcon name="users" size={13} color="#A78BFA" />
          <Text style={styles.heroBadgeText}>TEAM NUENIME</Text>
        </View>
        <Text style={styles.heroHeadline}>Orang di Balik Nuenime</Text>
        <Text style={styles.heroSub}>
          Dibangun dengan penuh dedikasi oleh tim kecil namun bersemangat.
        </Text>

        {/* Developer Cards */}
        {developers.map((dev) => (
          <DevCard key={dev.name} dev={dev} />
        ))}

        {/* Footer */}
        <Text style={styles.footerText}>
          ❤️ Dibuat untuk komunitas anime Indonesia
        </Text>
      </ScrollView>
    </NativeScreen>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Header — sticky, tidak ikut scroll
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
  headerTitle: {
    flex: 1,
    gap: 1,
  },
  titleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 19,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#64748B",
  },

  // Scroll area
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 52,
    gap: 16,
  },

  // Hero section
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(167, 139, 250, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.28)",
  },
  heroBadgeText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 11,
    color: "#A78BFA",
    letterSpacing: 1.2,
  },
  heroHeadline: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 23,
    color: "#FFFFFF",
    letterSpacing: -0.4,
    lineHeight: 29,
    marginTop: -4,
  },
  heroSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#71717A",
    lineHeight: 19,
    marginTop: -4,
  },

  // ─── Card (no gradient, no overflow needed) ───
  card: {
    backgroundColor: "#161922",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
    gap: 12,
  },

  // ─── Avatar ───
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 38,
  },

  devName: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: -0.3,
    textAlign: "center",
  },

  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    textAlign: "center",
  },

  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "center",
  },
  sectionLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#4B5563",
    letterSpacing: 0.8,
  },
  roleText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13.5,
    color: "#CBD5E1",
    lineHeight: 20,
    textAlign: "center",
  },

  // Social — icons only, centered row
  socialRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  socialBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Footer
  footerText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#3F3F46",
    textAlign: "center",
    paddingVertical: 8,
  },
});
