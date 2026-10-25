import { useEffect, useRef, useState } from "react";
import { AppState, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";

import { DotLabel, nothing, Signal } from "@/components/nothing-ui";
import { SAWERIA_URL, SUPPORT_PROMPT_DISMISS_KEY, isSupportPromptExcluded, shouldShowSupportPrompt, supportDismissedUntil } from "@/lib/support";

const TICK_MS = 15_000;

export function SupportPrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const activeMs = useRef(0);
  const activeStartedAt = useRef(Date.now());
  const dismissedUntil = useRef(0);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    void AsyncStorage.getItem(SUPPORT_PROMPT_DISMISS_KEY).then((value) => {
      dismissedUntil.current = Number(value || 0) || 0;
    }).catch(() => {});

    const subscription = AppState.addEventListener("change", (nextState) => {
      const now = Date.now();
      if (appState.current === "active" && nextState !== "active") activeMs.current += now - activeStartedAt.current;
      if (appState.current !== "active" && nextState === "active") activeStartedAt.current = now;
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isSupportPromptExcluded(pathname)) setVisible(false);
  }, [pathname]);

  useEffect(() => {
    const evaluate = () => {
      if (appState.current !== "active" || visible) return;
      const now = Date.now();
      const elapsed = activeMs.current + (now - activeStartedAt.current);
      if (shouldShowSupportPrompt({ activeMs: elapsed, dismissedUntil: dismissedUntil.current, pathname, now })) setVisible(true);
    };
    evaluate();
    const interval = setInterval(evaluate, TICK_MS);
    return () => clearInterval(interval);
  }, [pathname, visible]);

  const dismiss = async () => {
    const until = supportDismissedUntil();
    dismissedUntil.current = until;
    setVisible(false);
    await AsyncStorage.setItem(SUPPORT_PROMPT_DISMISS_KEY, String(until)).catch(() => {});
  };

  const openSaweria = async () => {
    await dismiss();
    await Linking.openURL(SAWERIA_URL).catch(() => {});
  };

  return <Modal transparent visible={visible} animationType="fade" onRequestClose={() => { void dismiss(); }}>
    <View style={styles.backdrop}><View style={styles.sheet} accessibilityViewIsModal>
      <View style={styles.top}><DotLabel tone="signal">NUENIME / DUKUNGAN KOMUNITAS</DotLabel><Signal label="OPSIONAL" tone="live" /></View>
      <View style={styles.mark}>
        <Image
          source={require("@/assets/images/logo-app.png")}
          style={styles.markImage}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.title}>Jaga Nuenime tetap hidup.</Text>
      <Text style={styles.copy}>Jika Nuenime membantumu menemukan tontonan seru, dukunganmu membantu membiayai server, update, dan pengembangan aplikasi ini.</Text>
      <Pressable accessibilityRole="button" onPress={() => void openSaweria()} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}><Text style={styles.primaryText}>☕ DUKUNG DI SAWERIA</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { void dismiss(); }} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={styles.secondaryText}>NANTI SAJA · INGATKAN LAGI 7 HARI</Text></Pressable>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: 20, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.76)" },
  sheet: { gap: 14, padding: 18, borderRadius: 6, borderWidth: 1, borderColor: nothing.line, borderBottomWidth: 3, borderBottomColor: nothing.red, backgroundColor: nothing.black },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mark: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.raised, borderRadius: 8, overflow: "hidden" },
  markImage: { width: 48, height: 48 },
  title: { color: nothing.white, fontSize: 27, fontWeight: "900", letterSpacing: -0.8, lineHeight: 31 },
  copy: { color: nothing.muted, fontSize: 13, lineHeight: 19 },
  primary: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundColor: nothing.white },
  primaryText: { color: nothing.black, fontSize: 10, fontWeight: "800", letterSpacing: 0.45 },
  secondary: { minHeight: 42, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: nothing.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.45 },
  pressed: nothing.pressed,
});
