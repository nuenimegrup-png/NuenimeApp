import { useEffect, useRef, useState } from "react";
import { Tabs } from "expo-router";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Image } from "expo-image";
import { AppIcon } from "@/components/app-icon";
import { hapticLight } from "@/lib/haptics";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { avatarUrl, defaultAvatar } from "@/lib/aniraku-avatars";

const TAB_CONFIG: Record<string, { label: string; icon: string }> = {
  index: { label: "Beranda", icon: "home" },
  schedule: { label: "Jadwal", icon: "calendar" },
  library: { label: "Subscribe", icon: "bookmark-outline" },
  history: { label: "Riwayat", icon: "history" },
  profile: { label: "Profil", icon: "account" },
};

function CustomLiquidGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPosition = Platform.OS === "web" ? 14 : Math.max(insets.bottom, 12);
  const [dockWidth, setDockWidth] = useState(Platform.OS === "web" ? 310 : 300);
  const auth = useAnirakuAuth();

  const rawAvatar = auth.profile?.avatar_url || auth.user?.user_metadata?.avatar_url;
  const username = auth.profile?.username || auth.user?.email?.split("@")[0] || "user";
  const avatarSrc = rawAvatar ? avatarUrl(rawAvatar) : (auth.user ? defaultAvatar(username.charCodeAt(0)).url : null);

  // Main dock has 4 tabs: Beranda, Jadwal, Subscribe, Riwayat
  const dockRoutes = state.routes.filter(
    (route) => route.name !== "random" && route.name !== "catalog" && route.name !== "profile"
  );
  const profileRoute = state.routes.find((r) => r.name === "profile");

  const activeRouteName = state.routes[state.index]?.name;
  const isProfileActive = activeRouteName === "profile";

  const activeVisibleIndex = Math.max(
    0,
    dockRoutes.findIndex((r) => r.name === activeRouteName)
  );

  const slideAnim = useRef(new Animated.Value(activeVisibleIndex)).current;

  useEffect(() => {
    if (!isProfileActive) {
      Animated.spring(slideAnim, {
        toValue: activeVisibleIndex,
        damping: 22,
        stiffness: 240,
        mass: 0.8,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }
  }, [activeVisibleIndex, isProfileActive]);

  const hPadding = 6;
  const availableWidth = Math.max(0, dockWidth - hPadding * 2);
  const tabCount = dockRoutes.length || 4;
  const tabItemWidth = availableWidth / tabCount;
  const pillMargin = 3;
  const pillWidth = Math.max(0, tabItemWidth - pillMargin * 2);

  const translateX = slideAnim.interpolate({
    inputRange: dockRoutes.map((_, i) => i),
    outputRange: dockRoutes.map((_, i) => i * tabItemWidth),
  });

  return (
    <View style={[styles.floatingDockRow, { bottom: bottomPosition, pointerEvents: "box-none" as any }]}>
      {/* ══════════════════════════════════════════════════════════════
          1. MAIN NAVIGATION DOCK (BERANDA, JADWAL, SUBSCRIBE, RIWAYAT)
          ══════════════════════════════════════════════════════════════ */}
      <View
        style={styles.floatingDockInner}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - dockWidth) > 1) {
            setDockWidth(w);
          }
        }}
      >
        {/* Animated Sliding Frosted Glass Pill for the 4 Dock Tabs */}
        {pillWidth > 0 && !isProfileActive ? (
          <Animated.View
            style={[
              styles.slidingActivePill,
              {
                width: pillWidth,
                left: hPadding + pillMargin,
                transform: [{ translateX }],
                pointerEvents: "none" as any,
              },
            ]}
          />
        ) : null}

        {dockRoutes.map((route, index) => {
          const config = TAB_CONFIG[route.name] || { label: route.name, icon: "circle-outline" };
          const isFocused = !isProfileActive && activeVisibleIndex === index;

          const onPress = () => {
            hapticLight();
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tabButton,
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={config.label}
              hitSlop={6}
            >
              <AppIcon
                name={config.icon}
                size={20}
                color={isFocused ? "#FFFFFF" : "#8E9AA8"}
              />
              <Text
                style={[
                  styles.tabLabel,
                  isFocused ? styles.activeTabLabel : styles.inactiveTabLabel,
                ]}
                numberOfLines={1}
              >
                {config.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ══════════════════════════════════════════════════════════════
          2. STANDALONE FLOATING CIRCULAR PROFILE (MISAH SENDIRI BULAT)
          ══════════════════════════════════════════════════════════════ */}
      <Pressable
        onPress={() => {
          hapticLight();
          if (profileRoute) {
            const event = navigation.emit({
              type: "tabPress",
              target: profileRoute.key,
              canPreventDefault: true,
            });
            if (!isProfileActive && !event.defaultPrevented) {
              navigation.navigate("profile");
            }
          } else {
            navigation.navigate("profile");
          }
        }}
        style={({ pressed }) => [
          styles.standaloneProfileCircle,
          isProfileActive && styles.standaloneProfileCircleActive,
          pressed && styles.btnPressed,
        ]}
        accessibilityRole="button"
        accessibilityState={isProfileActive ? { selected: true } : {}}
        accessibilityLabel="Profil Akun"
        hitSlop={6}
      >
        <View style={styles.standaloneAvatarWrapper}>
          {avatarSrc ? (
            <Image
              source={{ uri: avatarSrc }}
              style={styles.standaloneAvatarImg}
              contentFit="cover"
            />
          ) : (
            <AppIcon
              name="account"
              size={22}
              color={isProfileActive ? "#E2E8F0" : "#FFFFFF"}
            />
          )}
        </View>
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomLiquidGlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Beranda" }} />
      <Tabs.Screen name="schedule" options={{ title: "Jadwal" }} />
      <Tabs.Screen name="library" options={{ title: "Subscribe" }} />
      <Tabs.Screen name="history" options={{ title: "Riwayat" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
      <Tabs.Screen name="catalog" options={{ href: null }} />
      <Tabs.Screen name="random" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingDockRow: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    zIndex: 9999,
  },
  btnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },

  // ─── 1. MAIN NAVIGATION DOCK (4 TABS) ───
  floatingDockInner: {
    position: "relative",
    flex: 1,
    maxWidth: 340,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(15, 20, 29, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
        } as any)
      : {}),
  },
  slidingActivePill: {
    position: "absolute",
    top: 7,
    bottom: 7,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.11)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    zIndex: 1,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        } as any)
      : {}),
  },
  tabButton: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    zIndex: 2,
  },
  tabLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    letterSpacing: 0.1,
  },
  activeTabLabel: {
    color: "#FFFFFF",
  },
  inactiveTabLabel: {
    color: "#8E9AA8",
  },

  // ─── 2. STANDALONE CIRCULAR PROFILE BUTTON (MISAH SENDIRI BULAT) ───
  standaloneProfileCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(15, 20, 29, 0.88)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
        } as any)
      : {}),
  },
  standaloneProfileCircleActive: {
    borderColor: "#E2E8F0",
    borderWidth: 2,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "0 0 16px rgba(226, 232, 240, 0.6)",
        } as any)
      : {}),
  },
  standaloneAvatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  standaloneAvatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
  },
});
