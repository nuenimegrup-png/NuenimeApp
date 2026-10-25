import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";

import { AppIcon } from "@/components/app-icon";
import { hapticLight } from "@/lib/haptics";
import {
  SAWERIA_URL,
  SUPPORT_PROMPT_DISMISS_KEY,
  isSupportPromptExcluded,
  shouldShowSupportPrompt,
  supportDismissedUntil,
} from "@/lib/support";
import { getSupportConfig, type SupportConfig, DEFAULT_SUPPORT_CONFIG } from "@/lib/support-service";

const TICK_MS = 15_000;

export function SupportPrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<SupportConfig>(DEFAULT_SUPPORT_CONFIG);
  const activeMs = useRef(0);
  const activeStartedAt = useRef(Date.now());
  const dismissedUntil = useRef(0);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(SUPPORT_PROMPT_DISMISS_KEY)
      .then((value) => {
        dismissedUntil.current = Number(value || 0) || 0;
      })
      .catch(() => {});

    void getSupportConfig().then((cfg) => {
      if (mounted && cfg) {
        setConfig(cfg);
      }
    });

    const subscription = AppState.addEventListener("change", (nextState) => {
      const now = Date.now();
      if (appState.current === "active" && nextState !== "active") {
        activeMs.current += now - activeStartedAt.current;
      }
      if (appState.current !== "active" && nextState === "active") {
        activeStartedAt.current = now;
      }
      appState.current = nextState;
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isSupportPromptExcluded(pathname)) setVisible(false);
  }, [pathname]);

  useEffect(() => {
    const evaluate = () => {
      if (appState.current !== "active" || visible) return;
      const now = Date.now();
      const elapsed = activeMs.current + (now - activeStartedAt.current);
      if (
        shouldShowSupportPrompt({
          activeMs: elapsed,
          dismissedUntil: dismissedUntil.current,
          pathname,
          now,
        })
      ) {
        setVisible(true);
      }
    };
    evaluate();
    const interval = setInterval(evaluate, TICK_MS);
    return () => clearInterval(interval);
  }, [pathname, visible]);

  const dismiss = async () => {
    hapticLight();
    const until = supportDismissedUntil();
    dismissedUntil.current = until;
    setVisible(false);
    await AsyncStorage.setItem(SUPPORT_PROMPT_DISMISS_KEY, String(until)).catch(() => {});
  };

  const openSaweria = async () => {
    hapticLight();
    await dismiss();
    const url = config.saweriaUrl || SAWERIA_URL;
    await Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={() => {
        void dismiss();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          {/* 1. Header Bar: Tag & Close Button */}
          <View style={styles.topRow}>
            <View style={styles.badgeGroup}>
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>DUKUNGAN KOMUNITAS</Text>
              </View>
              <View style={styles.optionalChip}>
                <View style={styles.optionalDot} />
                <Text style={styles.optionalChipText}>OPSIONAL</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup dialog"
              onPress={() => {
                void dismiss();
              }}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
              hitSlop={8}
            >
              <AppIcon name="close" size={16} color="#94A3B8" />
            </Pressable>
          </View>

          {/* 2. Official App Icon Emblem */}
          <View style={styles.iconContainer}>
            <View style={styles.iconOuterRing}>
              <Image
                source={require("@/assets/images/logo-app.png")}
                style={styles.logoImage}
                contentFit="contain"
              />
            </View>
          </View>

          {/* 3. Title & Copywriting */}
          <Text style={styles.titleText}>
            {config.headlineTitle || "Jaga Nuenime Tetap Hidup"}
          </Text>
          <Text style={styles.copyText}>
            {config.headlineSubtitle ||
              "Dukungan sukarela darimu sangat berarti untuk membantu biaya server, update tontonan cepat, dan pengembangan fitur aplikasi Nuenime."}
          </Text>

          {/* 4. Action CTA: Dukung di Saweria */}
          <View style={styles.actionBlock}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dukung Nuenime di Saweria"
              onPress={() => void openSaweria()}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
            >
              <View style={styles.primaryBtnContent}>
                <AppIcon name="coffee" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>
                  {config.saweriaTitle ? `Dukung di ${config.saweriaTitle}` : "Dukung di Saweria"}
                </Text>
                <AppIcon name="open-in-new" size={14} color="#E0F2FE" />
              </View>
            </Pressable>

            {/* 5. Secondary Action: Nanti Saja */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Nanti saja, ingatkan lagi 7 hari"
              onPress={() => {
                void dismiss();
              }}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.secondaryBtnText}>Nanti Saja · Ingatkan Lagi 7 Hari</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.82)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#0B0E14",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.28)",
    padding: 22,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  categoryChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#38BDF8",
    letterSpacing: 0.5,
  },
  optionalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  optionalDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#F59E0B",
  },
  optionalChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    color: "#F59E0B",
    letterSpacing: 0.4,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  iconContainer: {
    alignItems: "center",
    marginTop: 14,
    marginBottom: 8,
  },
  iconOuterRing: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  titleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 19,
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0.2,
    marginTop: 6,
  },
  copyText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18.5,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  actionBlock: {
    marginTop: 18,
    gap: 8,
  },
  primaryBtn: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#0284C7",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  primaryBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  primaryBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  secondaryBtnText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11.5,
    color: "#64748B",
    letterSpacing: 0.2,
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
