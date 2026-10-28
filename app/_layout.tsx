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
import { ChoiceSheetProvider } from "@/components/choice-sheet";
import { AppAnnouncementModal } from "@/components/app-announcement-modal";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { BroadcastNotificationListener } from "@/components/broadcast-notification-listener";
import { AppIcon } from "@/components/app-icon";

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
      setSplashVisible(false);
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
          <ChoiceSheetProvider>
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
              <Stack.Screen name="nobar/index" options={{ presentation: "card" }} />
              <Stack.Screen name="nobar/[id]" options={{ presentation: "card" }} />
            </Stack>
            <ConnectivitySignal />
            <AppUpdatePrompt />
            <SupportPrompt />
            <AniListDownBanner />
            <FirstRunOnboarding onComplete={() => {}} />
            <MaintenanceGate />
            <BroadcastNotificationListener />
            <AppAnnouncementModal />
          </ChoiceSheetProvider>
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const [pressed, setPressed] = useState(false);

  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
        padding: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#080B11",
      }}
    >
      <StatusBar style="light" />

      {/* Ambient background glow */}
      <View
        style={{
          position: "absolute",
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: "rgba(56, 189, 248, 0.04)",
          top: "28%",
        }}
        pointerEvents="none"
      />

      {/* Liquid Glass Container Card */}
      <View
        style={{
          width: "100%",
          maxWidth: 440,
          padding: 28,
          borderRadius: 24,
          backgroundColor: "rgba(255, 255, 255, 0.03)",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.08)",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Status Pill Badge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 20,
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(239, 68, 68, 0.28)",
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: "#EF4444",
            }}
          />
          <Text
            style={{
              color: "#F87171",
              fontFamily: "SpaceGrotesk-Bold",
              fontSize: 10.5,
              letterSpacing: 1.2,
            }}
          >
            APPLICATION STATE
          </Text>
        </View>

        {/* Brand Title: Nuenime */}
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 22,
            fontWeight: "900",
            fontFamily: "Nunito-Black",
            textAlign: "center",
            letterSpacing: 0.3,
          }}
        >
          Nuenime needs to restart this screen.
        </Text>

        {/* Error Detail Glass Box */}
        <View
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 12,
            backgroundColor: "rgba(0, 0, 0, 0.40)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.06)",
          }}
        >
          <Text
            style={{
              color: "#94A3B8",
              fontSize: 12.5,
              lineHeight: 18,
              textAlign: "center",
              fontFamily: "Nunito-Regular",
            }}
          >
            {error.message || "An unexpected state occurred."}
          </Text>
        </View>

        {/* Liquid Glass Silver Retry Button */}
        <Pressable
          onPress={retry}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 48,
            paddingHorizontal: 32,
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: pressed
              ? "rgba(255, 255, 255, 0.22)"
              : "rgba(255, 255, 255, 0.12)",
            borderWidth: 1,
            borderColor: pressed
              ? "rgba(255, 255, 255, 0.45)"
              : "rgba(255, 255, 255, 0.28)",
            marginTop: 4,
          }}
        >
          <AppIcon name="refresh" size={17} color="#FFFFFF" />
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: "900",
              fontFamily: "Nunito-Black",
              letterSpacing: 0.2,
            }}
          >
            Retry
          </Text>
        </Pressable>
      </View>
    </GestureHandlerRootView>
  );
}
