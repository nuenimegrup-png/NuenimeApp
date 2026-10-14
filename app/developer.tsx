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
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { AppIcon } from "@/components/app-icon";
import { NativeScreen } from "@/components/screen";
import { nothing } from "@/components/nothing-ui";
import {
  type DeveloperMember,
  type SocialLink,
  getDevelopers,
  DEFAULT_DEVELOPERS,
} from "@/lib/developer-service";

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
function DevCard({ dev }: { dev: DeveloperMember }) {
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
      {dev.tag ? (
        <View
          style={[
            styles.tagBadge,
            {
              backgroundColor: dev.badgeBg || "rgba(255,255,255,0.08)",
              borderColor: dev.badgeBorder || "rgba(255,255,255,0.2)",
            },
          ]}
        >
          <AppIcon name="account-circle-outline" size={12} color={dev.accentColor} />
          <Text style={[styles.tagText, { color: dev.accentColor }]}>{dev.tag}</Text>
        </View>
      ) : null}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Role / Jabatan */}
      <View style={styles.roleSection}>
        <Text style={styles.roleLabel}>PERAN & TANGGUNG JAWAB</Text>
        <Text style={styles.roleText}>{dev.role}</Text>
      </View>

      {/* Social Media (horizontal row, centered) */}
      <View style={styles.socialSection}>
        <View style={styles.socialRow}>
          {dev.social && dev.social.length > 0 ? (
            dev.social.map((s) => (
              <SocialButton
                key={s.label}
                icon={s.icon}
                label={s.label}
                url={s.url}
                accentColor={dev.accentColor}
              />
            ))
          ) : (
            <SocialButton
              icon="web"
              label="Website"
              url=""
              accentColor={dev.accentColor}
            />
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────
export default function DeveloperScreen() {
  const [devList, setDevList] = useState<DeveloperMember[]>(DEFAULT_DEVELOPERS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getDevelopers()
      .then((list) => {
        if (mounted && list && list.length > 0) {
          setDevList(list);
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <NativeScreen scroll={false}>
      {/* ── Sticky Header (tidak ikut scroll) ── */}
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
          <AppIcon name="users" size={13} color="#E2E8F0" />
          <Text style={styles.heroBadgeText}>TEAM NUENIME</Text>
        </View>
        <Text style={styles.heroHeadline}>Orang di Balik Nuenime</Text>
        <Text style={styles.heroSub}>
          Dibangun dengan penuh dedikasi oleh tim kecil namun bersemangat.
        </Text>

        {/* Loading Indicator if fetching */}
        {isLoading && devList.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#E2E8F0" />
            <Text style={styles.loadingText}>Memuat data tim developer...</Text>
          </View>
        ) : (
          /* Developer Cards */
          devList.map((dev) => <DevCard key={dev.id || dev.name} dev={dev} />)
        )}

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
    color: "#94A3B8",
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
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  heroBadgeText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 11,
    color: "#E2E8F0",
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
    color: "#94A3B8",
    lineHeight: 19,
    marginTop: -4,
  },

  // ─── Liquid Glass Card ───
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
    gap: 12,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
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
    borderRadius: 20,
    borderWidth: 1,
  },
  tagText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    letterSpacing: 0.2,
  },

  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 4,
  },

  // ─── Role ───
  roleSection: {
    width: "100%",
    alignItems: "center",
    gap: 5,
  },
  roleLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#94A3B8",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  roleText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 13,
    color: "#CBD5E1",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 10,
  },

  // ─── Social ───
  socialSection: {
    width: "100%",
    alignItems: "center",
    paddingTop: 4,
  },
  socialRow: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  socialBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    paddingVertical: 20,
  },
  loadingText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 13,
    color: "#94A3B8",
  },

  footerText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
  },
});
