import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import { AppIcon } from "@/components/app-icon";
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

  // Animation values for Page Transitions
  const translateY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // App version display
  const versionString = `v${Constants.expoConfig?.version || "0.0.1"} · build ${
    Constants.expoConfig?.android?.versionCode || 1
  }`;

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
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: goingDown ? -30 : 30,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentPage(target);
      translateY.setValue(goingDown ? 30 : -30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
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
      {/* ─── VERTICAL FROSTED GLASS INDICATOR (RIGHT EDGE) ─── */}
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

      {/* ─── MAIN SLIDE CONTENT AREA ─── */}
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            paddingTop: insets.top + 20,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* SLIDE 0: 'WELCOME */}
        {currentPage === 0 && (
          <View style={styles.pageContainer}>
            {/* Top Version */}
            <View style={styles.glassVersionPill}>
              <Text style={styles.topVersionText}>{versionString}</Text>
            </View>

            {/* Center Welcome (No Box) */}
            <View style={styles.centerBlock}>
              <Text style={styles.welcomeTitle}>’WELCOME</Text>
              <Text style={styles.welcomeSubtitle}>
                Platform anime & movie{"\n"}untuk komunitas Nuenime.
              </Text>
            </View>

            {/* Bottom Liquid Glass Swipe Prompt (Clean Glass Pill without top lines) */}
            <Pressable
              onPress={() => goToPage(1)}
              style={({ pressed }) => [
                styles.swipeGlassPill,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={20}
            >
              <AppIcon name="chevron-up" size={18} color="#CBD5E1" />
              <Text style={styles.swipePromptText}>Geser ke atas</Text>
            </Pressable>
          </View>
        )}

        {/* SLIDE 1: KETENTUAN LAYANAN */}
        {currentPage === 1 && (
          <View style={styles.pageContainer}>
            {/* Top spacing */}
            <View style={{ height: 10 }} />

            {/* Content Left-Aligned in Glass Frame */}
            <View style={styles.termsContentWrap}>
              <View style={styles.disclaimerGlassBadge}>
                <Text style={styles.disclaimerBadgeText}>Disclaimer</Text>
              </View>

              <Text style={styles.termsTitle}>Ketentuan Layanan</Text>

              <View style={styles.termsPointsList}>
                {/* Point 1 */}
                <View style={styles.pointGlassCard}>
                  <View style={styles.yellowBullet} />
                  <View style={styles.pointTextWrap}>
                    <Text style={styles.pointHeading}>Aplikasi tidak resmi</Text>
                    <Text style={styles.pointDescription}>
                      Nuenime adalah aplikasi pihak ketiga. Semua merek dagang dan hak
                      cipta menjadi milik pemiliknya masing-masing.
                    </Text>
                  </View>
                </View>

                {/* Point 2 */}
                <View style={styles.pointGlassCard}>
                  <View style={styles.yellowBullet} />
                  <View style={styles.pointTextWrap}>
                    <Text style={styles.pointHeading}>Tidak mengunggah konten</Text>
                    <Text style={styles.pointDescription}>
                      Aplikasi ini tidak mengunggah, menyimpan, atau mendistribusikan
                      konten media. Semua konten bersumber dari tautan yang tersedia secara
                      publik di internet.
                    </Text>
                  </View>
                </View>

                {/* Point 3 */}
                <View style={styles.pointGlassCard}>
                  <View style={styles.yellowBullet} />
                  <View style={styles.pointTextWrap}>
                    <Text style={styles.pointHeading}>Pelanggaran hak cipta</Text>
                    <Text style={styles.pointDescription}>
                      Jika kamu adalah pemilik hak cipta dan merasa kontenmu digunakan
                      secara tidak tepat, hubungi nuenime@gmail.com.
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Bottom Liquid Glass Swipe Prompt */}
            <Pressable
              onPress={() => goToPage(2)}
              style={({ pressed }) => [
                styles.swipeGlassPill,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={20}
            >
              <AppIcon name="chevron-up" size={18} color="#CBD5E1" />
              <Text style={styles.swipePromptText}>Geser ke atas</Text>
            </Pressable>
          </View>
        )}

        {/* SLIDE 2: SIAP MULAI */}
        {currentPage === 2 && (
          <View style={styles.pageContainer}>
            {/* Top spacing */}
            <View style={{ height: 10 }} />

            {/* Center Ready (No Box) */}
            <View style={styles.centerBlock}>
              <Text style={styles.readyTitle}>SIAP MULAI</Text>
              <Text style={styles.readySubtitle}>
                Masuk untuk sinkronisasi riwayat{"\n"}dan preferensi tontonan kamu.
              </Text>
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

              {/* Version at bottom */}
              <Text style={styles.bottomVersionText}>v{Constants.expoConfig?.version || "0.0.1"}</Text>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0E0E11", // Sleek dark grey background
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

  // ─── TOP VERSION BADGE ───
  glassVersionPill: {
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
  topVersionText: {
    fontFamily: "Nunito-Bold",
    color: "#94A3B8",
    fontSize: 11.5,
    letterSpacing: 0.6,
  },

  // ─── CENTER BLOCKS (CLEAN FLOATING TEXT, NO BOX) ───
  centerBlock: {
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeTitle: {
    fontFamily: "Nunito-Black",
    color: "#FFFFFF",
    fontSize: 46,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontFamily: "Nunito-SemiBold",
    color: "#64748B",
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 16,
    maxWidth: 320,
  },

  // ─── BOTTOM FROSTED GLASS SWIPE PROMPT (UNIFORM GLASS PILL, NO TOP LINE) ───
  swipeGlassPill: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(16px) saturate(160%)",
          WebkitBackdropFilter: "blur(16px) saturate(160%)",
        } as any)
      : {}),
  },
  swipePromptText: {
    fontFamily: "Nunito-SemiBold",
    color: "#E2E8F0",
    fontSize: 13,
    letterSpacing: 0.2,
  },

  // ─── SLIDE 1: TERMS ───
  termsContentWrap: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
  },
  disclaimerGlassBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(226, 232, 240, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.28)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 16,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        } as any)
      : {}),
  },
  disclaimerBadgeText: {
    fontFamily: "Nunito-Bold",
    color: "#CBD5E1",
    fontSize: 12,
    letterSpacing: 0.3,
  },
  termsTitle: {
    fontFamily: "Nunito-Black",
    color: "#FFFFFF",
    fontSize: 28,
    letterSpacing: -0.4,
    marginBottom: 20,
  },
  termsPointsList: {
    gap: 12,
  },
  pointGlassCard: {
    backgroundColor: "rgba(255, 255, 255, 0.045)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        } as any)
      : {}),
  },
  yellowBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
    marginTop: 7,
    marginRight: 12,
    shadowColor: "#CBD5E1",
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  pointTextWrap: {
    flex: 1,
  },
  pointHeading: {
    fontFamily: "Nunito-Bold",
    color: "#FFFFFF",
    fontSize: 14.5,
    marginBottom: 3,
  },
  pointDescription: {
    fontFamily: "Nunito-Regular",
    color: "#94A3B8",
    fontSize: 12.5,
    lineHeight: 18,
  },

  // ─── SLIDE 2: READY TITLE ───
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
