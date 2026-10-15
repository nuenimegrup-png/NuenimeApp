import { useState, useEffect } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders } from "@/providers/app-providers";
import { nothing } from "@/components/nothing-ui";
import { ConnectivitySignal } from "@/components/connectivity-signal";
import { AppUpdatePrompt } from "@/components/app-update-prompt";
import { SupportPrompt } from "@/components/support-prompt";
import { AniListDownBanner } from "@/components/anilist-down-banner";
import { FirstRunOnboarding } from "@/components/first-run-onboarding";
import { useStartupPrefetch } from "@/hooks/use-startup-prefetch";
import { AiringReminderScheduler } from "@/hooks/use-airing-reminders";
import { AppAnnouncementModal } from "@/components/app-announcement-modal";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { BroadcastNotificationListener } from "@/components/broadcast-notification-listener";

const APP_BG_COLOR = "#0E0E11";

/** Must render inside AppProviders — calls useQueryClient. */
function StartupPrefetcher() {
  useStartupPrefetch();
  return null;
}

// Set Nunito as the global default font (matching the welcome / onboarding theme).
// Text and TextInput are class components in RN so defaultProps works at runtime.
// @ts-expect-error — defaultProps is removed from RN 0.81 types but still functions
Text.defaultProps = { ...(Text.defaultProps ?? {}), style: [{ fontFamily: "Nunito-SemiBold" }, Text.defaultProps?.style].filter(Boolean) };
// @ts-expect-error — same as above
TextInput.defaultProps = { ...(TextInput.defaultProps ?? {}), style: [{ fontFamily: "Nunito-SemiBold" }, TextInput.defaultProps?.style].filter(Boolean) };

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "SpaceGrotesk-Regular": require("../assets/fonts/SpaceGrotesk-Regular.ttf"),
    "SpaceGrotesk-Medium": require("../assets/fonts/SpaceGrotesk-Medium.ttf"),
    "SpaceGrotesk-SemiBold": require("../assets/fonts/SpaceGrotesk-SemiBold.ttf"),
    "Caveat-Bold": require("../assets/fonts/Caveat-Bold.ttf"),
    "Caveat-Medium": require("../assets/fonts/Caveat-Medium.ttf"),
    "Caveat-Regular": require("../assets/fonts/Caveat-Regular.ttf"),
    "Caveat-SemiBold": require("../assets/fonts/Caveat-SemiBold.ttf"),
    "HennyPenny-Regular": require("../assets/fonts/HennyPenny-Regular.ttf"),
    "Nunito-Regular": require("../assets/fonts/Nunito-Regular.ttf"),
    "Nunito-SemiBold": require("../assets/fonts/Nunito-SemiBold.ttf"),
    "Nunito-Bold": require("../assets/fonts/Nunito-Bold.ttf"),
    "Nunito-ExtraBold": require("../assets/fonts/Nunito-ExtraBold.ttf"),
    "Nunito-Black": require("../assets/fonts/Nunito-Black.ttf"),
  });

  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(APP_BG_COLOR).catch(() => {});
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      const timer = setTimeout(() => {
        setSplashVisible(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded || splashVisible) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: APP_BG_COLOR }}>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <View style={{ flex: 1, backgroundColor: APP_BG_COLOR, alignItems: "center", justifyContent: "center" }}>
          <Image
            source={require("../assets/images/loading.gif")}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
          />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: APP_BG_COLOR }}>
      <SafeAreaProvider>
        <AppProviders>
          <StartupPrefetcher />
          <AiringReminderScheduler />
          <StatusBar style="light" translucent backgroundColor="transparent" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "fade",
              contentStyle: { backgroundColor: APP_BG_COLOR },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="anime/[id]" />
            <Stack.Screen name="watch/[id]" />
            <Stack.Screen name="search" options={{ presentation: "card" }} />
            <Stack.Screen name="auth" options={{ presentation: "modal" }} />
            <Stack.Screen name="settings" options={{ presentation: "modal" }} />
            <Stack.Screen name="support" options={{ presentation: "modal" }} />
            <Stack.Screen name="library" />
            <Stack.Screen name="legal" options={{ presentation: "modal" }} />
            <Stack.Screen name="topup" options={{ presentation: "card" }} />
            <Stack.Screen name="inventory" options={{ presentation: "card" }} />
            <Stack.Screen name="avatar-decorations" options={{ presentation: "card" }} />
            <Stack.Screen name="developer" options={{ presentation: "card" }} />
          </Stack>
          <ConnectivitySignal />
          <AppUpdatePrompt />
          <SupportPrompt />
          <AniListDownBanner />
          <FirstRunOnboarding onComplete={() => {}} />
          <MaintenanceGate />
          <BroadcastNotificationListener />
          <AppAnnouncementModal />
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <GestureHandlerRootView style={{ flex: 1, padding: 24, gap: 14, alignItems: "center", justifyContent: "center", backgroundColor: nothing.black }}><StatusBar style="light" /><Text style={{ color: nothing.red, fontFamily: "monospace", fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>APPLICATION STATE</Text><Text style={{ color: nothing.white, fontSize: 22, fontWeight: "900", textAlign: "center" }}>Aniraku needs to restart this screen.</Text><Text style={{ color: nothing.muted, fontSize: 14, lineHeight: 20, textAlign: "center" }}>{error.message || "An unexpected state occurred."}</Text><Pressable onPress={retry} style={{ minHeight: 48, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", backgroundColor: nothing.white, borderRadius: 14 }}><Text style={{ color: nothing.black, fontWeight: "900" }}>Retry</Text></Pressable></GestureHandlerRootView>;
}
