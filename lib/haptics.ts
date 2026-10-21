import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const HAPTICS_PREF_KEY = "nuenime.system.haptics";
let hapticsEnabled = true;

// Initialize preference from AsyncStorage
void AsyncStorage.getItem(HAPTICS_PREF_KEY).then((val) => {
  if (val !== null) {
    hapticsEnabled = val === "true";
  }
});

export function setHapticsEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
  void AsyncStorage.setItem(HAPTICS_PREF_KEY, String(enabled)).catch(() => {});
}

export function isHapticsEnabled(): boolean {
  return hapticsEnabled;
}

export function hapticLight() {
  if (Platform.OS === "web" || !hapticsEnabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function hapticMedium() {
  if (Platform.OS === "web" || !hapticsEnabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function hapticHeavy() {
  if (Platform.OS === "web" || !hapticsEnabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

export function hapticSuccess() {
  if (Platform.OS === "web" || !hapticsEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticWarning() {
  if (Platform.OS === "web" || !hapticsEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
