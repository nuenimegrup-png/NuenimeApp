import { Alert, Platform, ToastAndroid } from "react-native";

export function showToast(message: string): void {
  if (Platform.OS === "android") {
    try {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } catch {
      // Fallback
    }
  } else if (Platform.OS === "web") {
    // Graceful web feedback
    console.log("[Toast]:", message);
  }
}

