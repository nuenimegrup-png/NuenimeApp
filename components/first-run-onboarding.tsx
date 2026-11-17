import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { AppIcon } from "@/components/app-icon";
import { LegalModal } from "@/components/legal-modal";
import Svg, { Circle, Path } from "react-native-svg";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

// Inject keyframes for smooth web spinner rotation
if (Platform.OS === "web" && typeof document !== "undefined") {
  const styleId = "nuenime-spin-keyframes";
  if (!document.getElementById(styleId)) {
    const styleTag = document.createElement("style");
    styleTag.id = styleId;
    styleTag.textContent = `
      @keyframes nuenime-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styleTag);
  }
}

const ONBOARDING_KEY = "nuenime.onboarding.v2";
const LEGACY_KEY = "aniraku.onboarding.v1";
const WELCOME_BANNER_IMG = require("@/assets/images/welcome-nuenime-banner.png");
const SIAP_MULAI_BANNER_IMG = require("@/assets/images/siap-mulai-banner.png");

// Google multi-colored G logo
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <View style={[styles.googleIconContainer, { width: size + 4, height: size + 4 }]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <Path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <Path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          fill="#FBBC05"
        />
        <Path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          fill="#EA4335"
        />
      </Svg>
    </View>
  );
}

// Rotating circular spinner ("bundaran berputar") for loading state
function RotatingSpinner({ size = 22, color = "#0B0E17" }: { size?: number; color?: string }) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      })
    );
    animation.start();
    return () => animation.stop();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={[styles.googleIconContainer, { width: size + 4, height: size + 4 }]}>
      <Animated.View
        style={[
          styles.spinnerRotator,
          {
            width: size,
            height: size,
            transform: [{ rotate: spin }],
          },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle
            cx="12"
            cy="12"
            r="9.5"
            stroke="rgba(11, 14, 23, 0.15)"
            strokeWidth="2.8"
            fill="none"
          />
          <Circle
            cx="12"
            cy="12"
            r="9.5"
            stroke={color}
            strokeWidth="2.8"
            strokeDasharray="22 60"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function FirstRunOnboarding({ onComplete }: { onComplete: () => void }) {
  const auth = useAnirakuAuth();
  const [currentPage, setCurrentPage] = useState(0);
  const pageRef = useRef(0);
  const insets = useSafeAreaInsets();
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeLegalDoc, setActiveLegalDoc] = useState<"terms" | "privacy" | null>(null);

  // Animation values for Page Transitions
  const translateY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Visual polish loop animations for Slide 0
  const floatAnim = useRef(new Animated.Value(0)).current;
  const swipeBounceAnim = useRef(new Animated.Value(0)).current;
  const glowPulseAnim = useRef(new Animated.Value(0.7)).current;

  // App version display
  const versionString = `v${Constants.expoConfig?.version || "0.0.1"} · build ${
    Constants.expoConfig?.android?.versionCode || 1
  }`;

  // Continuous subtle micro-animations (float emblem, gentle swipe bounce, breathing ambient aura)
  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -5,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(floatAnim, {
          toValue: 5,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
      ])
    );
    floatLoop.start();

    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(swipeBounceAnim, {
          toValue: -5,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(swipeBounceAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== "web",
        }),
      ])
    );
    bounceLoop.start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulseAnim, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(glowPulseAnim, {
          toValue: 0.55,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
      ])
    );
    glowLoop.start();

    return () => {
      floatLoop.stop();
      bounceLoop.stop();
      glowLoop.stop();
    };
  }, [floatAnim, swipeBounceAnim, glowPulseAnim]);

  // Reset to first page ('WELCOME) whenever user is signed out
  useEffect(() => {
    if (!auth.loading && !auth.user) {
      setCurrentPage(0);
      pageRef.current = 0;
      translateY.setValue(0);
      fadeAnim.setValue(1);
    }
  }, [auth.loading, auth.user]);

  const goToPage = (target: number) => {
    if (target < 0 || target > 2 || target === pageRef.current) return;
    hapticLight();
    const goingDown = target > pageRef.current;
    pageRef.current = target;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(translateY, {
        toValue: goingDown ? -30 : 30,
        duration: 120,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start(() => {
      setCurrentPage(target);
      translateY.setValue(goingDown ? 30 : -30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    });
  };

  const handleGoogleSignIn = async () => {
    hapticLight();
    setSigningIn(true);
    setAuthError(null);
    try {
      await auth.signInWithGoogle();
      // On web or when sign-in finishes, auth.user updates
    } catch (err: any) {
      const msg = err?.message || "Gagal masuk dengan Google. Silakan coba lagi.";
      if (!msg.toLowerCase().includes("cancel")) {
        setAuthError(msg);
      }
    } finally {
      setSigningIn(false);
    }
  };

  // Only trigger onComplete when auth.user has successfully been established
  useEffect(() => {
    if (auth.user) {
      hapticSuccess();
      onComplete();
    }
  }, [auth.user, onComplete]);

  // Pan gesture for swiping up and down
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        // Jangan intersep gesture swipe saat user sedang membaca artikel di Slide 1
        if (pageRef.current === 1) return false;
        return Math.abs(gesture.dy) > 15 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -40) {
          if (pageRef.current < 2) goToPage(pageRef.current + 1);
        } else if (gesture.dy > 40) {
          if (pageRef.current > 0) goToPage(pageRef.current - 1);
        }
      },
    })
  ).current;

  // 1. If user is already authenticated and not signing in, dismiss onboarding
  if (auth.user && !signingIn) return null;

  // 2. On app start, while auth is initially checking existing session:
  // keep screen covered in dark background so Home is NEVER shown prematurely
  if (auth.loading && !signingIn && pageRef.current === 0) {
    return <View style={[styles.overlay, { backgroundColor: "#0E0E11" }]} />;
  }

  return (
    <View style={styles.overlay} {...panResponder.panHandlers}>
      {/* ─── DARK GREYISH-BLACK BACKGROUND (ABU-ABU KEHITAMAN) ─── */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#16171C" }]} />
        {/* Soft Ambient Light Halo behind center */}
        <Animated.View
          style={[
            styles.ambientAuraHalo,
            {
              opacity: glowPulseAnim,
            },
          ]}
        />
      </View>

      {/* ─── VERTICAL FROSTED GLASS INDICATOR (RIGHT EDGE) ─── */}
      {currentPage !== 1 && (
        <View style={styles.indicatorContainer} pointerEvents="box-none">
          <View style={styles.indicatorGlassTrack}>
            {[0, 1, 2].map((idx) => {
              const isActive = idx === currentPage;
              return (
                <Pressable
                  key={idx}
                  onPress={() => goToPage(idx)}
                  hitSlop={14}
                  style={[
                    styles.indicatorDot,
                    isActive ? styles.indicatorActive : styles.indicatorInactive,
                  ]}
                />
              );
            })}
          </View>
        </View>
      )}

      {/* ─── MAIN SLIDE CONTENT AREA ─── */}
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            paddingTop: currentPage === 1 ? insets.top + 6 : insets.top + 20,
            paddingBottom: currentPage === 1 ? 0 : Math.max(insets.bottom, 16) + 16,
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* SLIDE 0: HERO ONBOARDING (Desain Baru: Layout Persis Screenshot, Dark Theme, Center Art Dulu + Baru, Tombol Silver Liquid Glass, Version Bawah) */}
        {currentPage === 0 && (
          <View style={styles.heroPageContainer}>
            {/* Top Area Spacing */}
            <View style={{ height: 4 }} />

            {/* Center Artwork Block: Banner Metalik Gothic Chrome dengan Floating Micro-animation */}
            <Animated.View
              style={[
                styles.heroCenterArtworkBlock,
                {
                  transform: [{ translateY: floatAnim }],
                },
              ]}
            >
              {/* Banner Metalik Gothic Chrome 'Welcome Nuenime' */}
              <Image
                source={WELCOME_BANNER_IMG}
                style={styles.heroBannerImg}
                contentFit="contain"
                priority="high"
                transition={200}
              />
            </Animated.View>

            {/* Bottom Hero Section (Persis Layout Contoh: Title Kiri, Underline Bar, Subtitle, Tombol Silver Liquid Glass, Version) */}
            <View style={styles.heroBottomSection}>
              {/* Teks Judul Kiri + Underline Bar + Subtitle */}
              <View style={styles.heroTextGroup}>
                <Text style={styles.heroBrandTitle}>Nuenime</Text>
                <View style={styles.heroUnderlineBar} />
                <Text style={styles.heroSubtitle}>Nonton anime favoritmu tanpa batas</Text>
              </View>

              {/* Tombol Utama: Clean White 'Mulai Menonton' Tanpa Bayangan */}
              <Pressable
                onPress={() => goToPage(1)}
                style={({ pressed }) => [
                  styles.cleanWhiteButton,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Mulai Menonton"
              >
                <View style={styles.cleanButtonInner}>
                  <Text style={styles.cleanButtonText}>Mulai Menonton</Text>
                  <View style={styles.cleanIconCircle}>
                    <AppIcon name="chevron-right" size={16} color="#0F172A" />
                  </View>
                </View>
              </Pressable>

              {/* Teks Versi di Bawah Tombol (Persis seperti Version 1.3.14 di contoh) */}
              <Text style={styles.heroVersionFooter}>
                Version {Constants.expoConfig?.version || "0.0.9"}
              </Text>
            </View>
          </View>
        )}

        {/* SLIDE 1: DISCLAIMER (Layout Persis Screenshot: Card Rounded Elegan, Bullet Points, Tombol Putih Solid Setuju, Tolak, Nuenime Team) */}
        {currentPage === 1 && (
          <View
            style={[
              styles.disclaimerContainer,
              { paddingBottom: Math.max(insets.bottom, 16) + 12 },
            ]}
          >
            {/* Card Kontainer Disclaimer */}
            <View style={styles.disclaimerCard}>
              <Text style={styles.disclaimerTitle}>Disclaimer</Text>

              <ScrollView
                style={styles.disclaimerScroll}
                contentContainerStyle={styles.disclaimerScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Text style={styles.disclaimerParagraph}>
                  Nuenime adalah aplikasi streaming anime pihak ketiga. Semua konten yang ditampilkan dalam aplikasi ini bersumber dari server eksternal dan tidak dihosting, dimiliki, atau berafiliasi dengan Nuenime atau Nuenime Team.
                </Text>

                <Text style={styles.disclaimerParagraph}>
                  Dengan menggunakan aplikasi ini, Anda mengakui dan menyetujui bahwa:
                </Text>

                <View style={styles.disclaimerBulletList}>
                  <View style={styles.disclaimerBulletRow}>
                    <Text style={styles.disclaimerBulletDot}>•</Text>
                    <Text style={styles.disclaimerBulletText}>
                      Nuenime tidak menghosting, mengunggah, atau mendistribusikan konten media apa pun.
                    </Text>
                  </View>
                  <View style={styles.disclaimerBulletRow}>
                    <Text style={styles.disclaimerBulletDot}>•</Text>
                    <Text style={styles.disclaimerBulletText}>
                      Semua anime, video streaming, dan metadata disediakan oleh sumber pihak ketiga.
                    </Text>
                  </View>
                  <View style={styles.disclaimerBulletRow}>
                    <Text style={styles.disclaimerBulletDot}>•</Text>
                    <Text style={styles.disclaimerBulletText}>
                      Pengembang Nuenime tidak bertanggung jawab atas konten, ketersediaan, atau legalitas aliran video.
                    </Text>
                  </View>
                  <View style={styles.disclaimerBulletRow}>
                    <Text style={styles.disclaimerBulletDot}>•</Text>
                    <Text style={styles.disclaimerBulletText}>
                      Aplikasi ini adalah search engine untuk menemukan anime di berbagai sumber.
                    </Text>
                  </View>
                  <View style={styles.disclaimerBulletRow}>
                    <Text style={styles.disclaimerBulletDot}>•</Text>
                    <Text style={styles.disclaimerBulletText}>
                      Anda bertanggung jawab penuh untuk mematuhi hukum di wilayah hukum Anda.
                    </Text>
                  </View>
                  <View style={styles.disclaimerBulletRow}>
                    <Text style={styles.disclaimerBulletDot}>•</Text>
                    <Text style={styles.disclaimerBulletText}>
                      Kami tidak mengumpulkan, menyimpan, atau mengirimkan data pribadi ke server eksternal.
                    </Text>
                  </View>
                </View>

                <Text style={styles.disclaimerFooterNote}>
                  Jika Anda tidak menyetujui persyaratan ini, silakan tutup aplikasi.
                </Text>
              </ScrollView>
            </View>

            {/* Area Tombol Tindakan Bawah */}
            <View style={styles.disclaimerActions}>
              {/* Tombol Putih Solid: Setuju (Zero Shadow / Elevation) */}
              <Pressable
                onPress={() => goToPage(2)}
                style={({ pressed }) => [
                  styles.disclaimerWhiteButton,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Setuju"
              >
                <Text style={styles.disclaimerWhiteButtonText}>Setuju</Text>
              </Pressable>

              {/* Tombol Outline: Tolak */}
              <Pressable
                onPress={() => goToPage(0)}
                style={({ pressed }) => [
                  styles.disclaimerRejectButton,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Tolak"
              >
                <Text style={styles.disclaimerRejectButtonText}>Tolak</Text>
              </Pressable>

              {/* Footer Teks Brand */}
              <Text style={styles.disclaimerBrandFooter}>Nuenime Team</Text>
            </View>
          </View>
        )}

        {/* SLIDE 2: SIAP MULAI */}
        {currentPage === 2 && (
          <View style={styles.pageContainer}>
            {/* Top spacing */}
            <View style={{ height: 10 }} />

            {/* Center Ready (Grafis Metalik 'Siap Mulai') */}
            <View style={styles.centerBlock}>
              <Image
                source={SIAP_MULAI_BANNER_IMG}
                style={styles.readyBannerImg}
                contentFit="contain"
                priority="high"
                transition={200}
              />
            </View>

            {/* Bottom Action Area */}
            <View style={styles.bottomActionArea}>
              {/* ─── LIQUID GLASS GOOGLE BUTTON ─── */}
              <Pressable
                onPress={handleGoogleSignIn}
                disabled={signingIn}
                style={({ pressed }) => [
                  styles.googleGlassButton,
                  pressed && styles.buttonPressed,
                  signingIn && styles.googleButtonLoading,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Lanjut dengan Google"
              >
                {signingIn ? (
                  <RotatingSpinner size={22} color="#0B0E17" />
                ) : (
                  <GoogleLogo size={22} />
                )}
                <Text style={styles.googleButtonText}>Lanjut dengan Google</Text>
              </Pressable>

              {authError ? (
                <Text style={styles.authErrorText}>{authError}</Text>
              ) : null}

              {/* Legal Note */}
              <Text style={styles.legalNote}>
                Dengan masuk, kamu menyetujui ketentuan layanan Nuenime.{"\n"}
                Aplikasi ini tidak mengunggah atau mendistribusikan konten media.
              </Text>

              {/* Legal Policy Links */}
              <View style={styles.legalLinksRow}>
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setActiveLegalDoc("terms");
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 10, right: 8 }}
                  style={({ pressed }) => [
                    styles.legalLinkItem,
                    pressed && styles.legalLinkPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Buka Terms of Service"
                >
                  <Text style={styles.legalLinkText}>Terms of Service</Text>
                </Pressable>

                <Text style={styles.legalLinkDot}>•</Text>

                <Pressable
                  onPress={() => {
                    hapticLight();
                    setActiveLegalDoc("privacy");
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 10 }}
                  style={({ pressed }) => [
                    styles.legalLinkItem,
                    pressed && styles.legalLinkPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Buka Privacy Policy"
                >
                  <Text style={styles.legalLinkText}>Privacy Policy</Text>
                </Pressable>
              </View>

              {/* Version at bottom */}
              <Text style={styles.bottomVersionText}>v{Constants.expoConfig?.version || "0.0.1"}</Text>
            </View>
          </View>
        )}
      </Animated.View>

      {/* ─── LEGAL DOCUMENT MODAL ─── */}
      <LegalModal
        visible={activeLegalDoc !== null}
        initialDoc={activeLegalDoc || "terms"}
        onClose={() => setActiveLegalDoc(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#16171C", // Abu-abu kehitaman (dark charcoal grey, tidak hitam pekat)
    zIndex: 99999,
    ...(Platform.OS === "web"
      ? ({
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
        } as any)
      : {}),
  },
  contentWrapper: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  // ─── AMBIENT ATMOSPHERIC HALO ───
  ambientAuraHalo: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    alignSelf: "center",
    top: "30%",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    ...(Platform.OS === "web"
      ? ({
          filter: "blur(60px)",
        } as any)
      : {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 60,
          elevation: 2,
        }),
  },

  // ─── TOP VERSION BADGE ───
  glassVersionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 6,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        } as any)
      : {}),
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 7,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 2,
  },
  topVersionText: {
    fontFamily: "Nunito-Bold",
    color: "#94A3B8",
    fontSize: 11.5,
    letterSpacing: 0.6,
  },

  // ─── HERO STEP 1 (MODERN SCREENSHOT LAYOUT) ───
  heroPageContainer: {
    flex: 1,
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 26,
    paddingTop: 8,
  },
  heroCenterArtworkBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 12,
  },
  heroLogoImg: {
    width: 220,
    height: 64,
    marginBottom: 8,
  },
  heroBannerImg: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 1024 / 380,
  },
  heroBottomSection: {
    width: "100%",
    paddingBottom: 6,
  },
  heroTextGroup: {
    marginBottom: 20,
    alignSelf: "flex-start",
    width: "100%",
  },
  heroBrandTitle: {
    fontFamily: "Nunito-Black",
    color: "#FFFFFF",
    fontSize: 34,
    letterSpacing: -0.5,
  },
  heroUnderlineBar: {
    width: 48,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  heroSubtitle: {
    fontFamily: "Nunito-SemiBold",
    color: "#94A3B8",
    fontSize: 15,
    lineHeight: 22,
  },
  cleanWhiteButton: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 15,
    paddingHorizontal: 24,
    // Nol bayangan (tanpa shadow atau elevation)
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    ...(Platform.OS === "web" ? ({ boxShadow: "none" } as any) : {}),
  },
  cleanButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  cleanButtonText: {
    fontFamily: "Nunito-Black",
    color: "#0F172A",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  cleanIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroVersionFooter: {
    fontFamily: "Nunito-SemiBold",
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    marginTop: 14,
    letterSpacing: 0.3,
  },

  // ─── CENTER BLOCKS (CLEAN FLOATING TEXT & EMBLEM) ───
  centerBlock: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: "100%",
  },
  welcomeBannerImg: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 1024 / 380,
  },
  welcomeLogoImg: {
    width: 205,
    height: 68,
    marginTop: 4,
    marginBottom: 6,
  },
  sparkleTopRight: {
    position: "absolute",
    top: 6,
    right: 22,
    opacity: 0.65,
  },
  sparkleBottomLeft: {
    position: "absolute",
    bottom: 24,
    left: 20,
    opacity: 0.55,
  },
  welcomeTitle: {
    fontFamily: "Nunito-Black",
    color: "#FFFFFF",
    fontSize: 44,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontFamily: "Nunito-SemiBold",
    color: "#94A3B8",
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 12,
    maxWidth: 320,
  },
  featurePillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
    flexWrap: "wrap",
  },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  featureDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  featurePillText: {
    fontFamily: "Nunito-Bold",
    color: "#CBD5E1",
    fontSize: 11.5,
    letterSpacing: 0.2,
  },

  // ─── SLIDE 1: DISCLAIMER SCREEN STYLES (PERSIS SCREENSHOT) ───
  disclaimerContainer: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },
  disclaimerCard: {
    flex: 1,
    backgroundColor: "#181A22",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
  },
  disclaimerTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 24,
    color: "#FFFFFF",
    marginBottom: 16,
  },
  disclaimerScroll: {
    flex: 1,
  },
  disclaimerScrollContent: {
    paddingBottom: 12,
  },
  disclaimerParagraph: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#CBD5E1",
    marginBottom: 14,
  },
  disclaimerBulletList: {
    marginBottom: 8,
    gap: 8,
  },
  disclaimerBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  disclaimerBulletDot: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    lineHeight: 20,
    color: "#94A3B8",
    marginRight: 8,
    width: 10,
  },
  disclaimerBulletText: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#CBD5E1",
  },
  disclaimerFooterNote: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#CBD5E1",
    marginTop: 10,
  },
  disclaimerActions: {
    width: "100%",
    paddingTop: 16,
    alignItems: "center",
    gap: 12,
  },
  disclaimerWhiteButton: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "none",
        } as any)
      : {}),
  },
  disclaimerWhiteButtonText: {
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#0F172A",
    letterSpacing: 0.3,
  },
  disclaimerRejectButton: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimerRejectButtonText: {
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  disclaimerBrandFooter: {
    fontFamily: "Nunito-Medium",
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
    marginBottom: 2,
    textAlign: "center",
  },

  // ─── SLIDE 2: READY BANNER ───
  readyBannerImg: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 1024 / 380,
  },
  readyTitle: {
    fontFamily: "Nunito-Black",
    color: "#E2E8F0",
    fontSize: 35,
    letterSpacing: 0.5,
    textAlign: "center",
    textShadowColor: "rgba(226, 232, 240, 0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  readySubtitle: {
    fontFamily: "Nunito-SemiBold",
    color: "#64748B",
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 14,
    maxWidth: 320,
  },

  // ─── BOTTOM ACTION AREA ───
  bottomActionArea: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },

  // ─── LIQUID GLASS GOOGLE BUTTON (SMOOTH CAPSULE, NO HARSH TOP LINES) ───
  googleGlassButton: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  authErrorText: {
    fontFamily: "Nunito-Bold",
    color: "#EF4444",
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 16,
  },
  googleIconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerRotator: {
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonLoading: {
    opacity: 0.88,
  },
  googleButtonText: {
    fontFamily: "Nunito-ExtraBold",
    color: "#0B0E17",
    fontSize: 15.5,
    letterSpacing: 0.2,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },

  // ─── DIVIDER ───
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
  },
  dividerText: {
    fontFamily: "Nunito-Bold",
    color: "#64748B",
    fontSize: 12,
    paddingHorizontal: 12,
  },

  // ─── FROSTED GLASS TESTER BUTTON (UNIFORM GLASS PILL, NO TOP LINE) ───
  testerGlassButton: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(18px) saturate(160%)",
          WebkitBackdropFilter: "blur(18px) saturate(160%)",
        } as any)
      : {}),
  },
  testerButtonText: {
    fontFamily: "Nunito-Bold",
    color: "#E2E8F0",
    fontSize: 14,
  },

  legalNote: {
    fontFamily: "Nunito-Regular",
    color: "#64748B",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 14,
    maxWidth: 320,
  },
  legalLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  legalLinkItem: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  legalLinkText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#38BDF8",
    textDecorationLine: "underline",
    textDecorationColor: "rgba(56, 189, 248, 0.45)",
  },
  legalLinkDot: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#475569",
  },
  legalLinkPressed: {
    opacity: 0.6,
  },
  bottomVersionText: {
    fontFamily: "Nunito-SemiBold",
    color: "#475569",
    fontSize: 11,
    marginTop: 8,
  },

  // ─── RIGHT VERTICAL FROSTED GLASS INDICATOR ───
  indicatorContainer: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10000,
  },
  indicatorGlassTrack: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 3,
    alignItems: "center",
    gap: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        } as any)
      : {}),
  },
  indicatorDot: {
    width: 4,
    borderRadius: 2,
  },
  indicatorActive: {
    height: 26,
    backgroundColor: "#E2E8F0",
    shadowColor: "#E2E8F0",
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  indicatorInactive: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
});
