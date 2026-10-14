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
import { LinearGradient } from "expo-linear-gradient";
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

// ─── Social Button ───────────────────────────────────────────────────
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

  const borderColor = accentColor + "60";
  const bgColor = accentColor + "18";

  return (
    <Pressable
      onPress={() => void handlePress()}
      accessibilityRole="link"
      accessibilityLabel={`Buka ${label}`}
      style={({ pressed }) => [
        styles.socialBtn,
        { backgroundColor: bgColor, borderColor: borderColor },
        pressed && { opacity: 0.6 },
      ]}
    >
      <AppIcon name={icon} size={15} color={accentColor} />
      <Text style={[styles.socialBtnText, { color: accentColor }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Developer Card ──────────────────────────────────────────────────
function DevCard({ dev }: { dev: Developer }) {
  const [imgError, setImgError] = useState(false);
  const initials = dev.name.charAt(0).toUpperCase();

  return (
    <View style={styles.card}>
      {/* Gradient header */}
      <LinearGradient
        colors={[dev.accentColor + "22", "transparent"]}
        style={styles.cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Avatar */}
      <View style={styles.avatarOuterRing}>
        <View style={[styles.avatarRing, { borderColor: dev.accentColor + "80" }]}>
          {dev.avatarUri && !imgError ? (
            <Image
              source={{ uri: dev.avatarUri }}
              style={styles.avatarImage}
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: dev.accentColor + "33" }]}>
              <Text style={[styles.avatarInitial, { color: dev.accentColor }]}>
                {initials}
              </Text>
            </View>
          )}
        </View>
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
      <View style={styles.roleRow}>
        <AppIcon name="cog-outline" size={14} color="#64748B" />
        <Text style={styles.roleLabel}>Jabatan</Text>
      </View>
      <Text style={styles.roleText}>{dev.role}</Text>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Social Media */}
      <View style={styles.roleRow}>
        <AppIcon name="earth" size={14} color="#64748B" />
        <Text style={styles.roleLabel}>Sosial Media</Text>
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
    <NativeScreen>
      {/* Header */}
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero badge */}
        <View style={styles.heroBadge}>
          <AppIcon name="users" size={14} color="#A78BFA" />
          <Text style={styles.heroBadgeText}>TEAM NUENIME</Text>
        </View>

        <Text style={styles.heroHeadline}>Orang di Balik Nuenime</Text>
        <Text style={styles.heroSub}>
          Nuenime dibangun dengan penuh dedikasi oleh tim kecil namun bersemangat.
        </Text>

        {/* Developer Cards */}
        {developers.map((dev) => (
          <DevCard key={dev.name} dev={dev} />
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Dibuat dengan sepenuh hati untuk komunitas anime Indonesia</Text>
        </View>
      </ScrollView>
    </NativeScreen>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 18,
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
    gap: 2,
  },
  titleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#64748B",
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 48,
    gap: 18,
  },

  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(167, 139, 250, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.3)",
  },
  heroBadgeText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 11,
    color: "#A78BFA",
    letterSpacing: 1,
  },
  heroHeadline: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 24,
    color: "#FFFFFF",
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  heroSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 13.5,
    color: "#71717A",
    lineHeight: 20,
  },

  // ─── Card ───
  card: {
    backgroundColor: "#161922",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 22,
    alignItems: "center",
    gap: 14,
    overflow: "hidden",
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
  },

  // ─── Avatar ───
  avatarOuterRing: {
    padding: 3,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2.5,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 36,
  },

  devName: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: -0.3,
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
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
  },

  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  roleLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#64748B",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  roleText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13.5,
    color: "#CBD5E1",
    lineHeight: 20,
    alignSelf: "flex-start",
    textAlign: "left",
  },

  socialRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    alignSelf: "flex-start",
  },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  socialBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
  },

  // ─── Footer ───
  footer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    paddingVertical: 12,
  },
  footerText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#52525B",
    textAlign: "center",
  },
});
