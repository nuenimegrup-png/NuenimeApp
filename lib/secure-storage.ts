import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const webFallback = {
  // Use localStorage on web so user session persists across reloads/tabs
  getItem: (key: string) => {
    try {
      if (typeof localStorage !== "undefined") {
        const item = localStorage.getItem(key);
        if (item !== null) return item;
      }
      return typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
      }
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(key, value);
      }
    } catch {
      // Private-mode quota errors must not break guest browsing.
    }
  },
  removeItem: (key: string) => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(key);
      }
    } catch {
      // Ignore errors during removal
    }
  },
};

export const secureStorage = {
  async getItem(key: string) {
    if (Platform.OS === "web") return webFallback.getItem(key);
    try {
      const secureVal = await SecureStore.getItemAsync(key);
      if (secureVal !== null) return secureVal;
    } catch {
      // Fallback to AsyncStorage if SecureStore fails
    }
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      webFallback.setItem(key, value);
      return;
    }
    let secureSaved = false;
    try {
      await SecureStore.setItemAsync(key, value);
      secureSaved = true;
    } catch {
      // SecureStore may throw on Android when payload exceeds 2048 bytes limit
    }
    // Always sync to AsyncStorage as robust fallback for large tokens (> 2048 bytes)
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      if (!secureSaved) {
        // Both failed
      }
    }
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      webFallback.removeItem(key);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore delete errors
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Ignore delete errors
    }
  },
};
