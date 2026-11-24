import React, { useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  StyleProp,
  ViewStyle,
  Animated,
  Easing,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { hapticLight } from "@/lib/haptics";
import {
  getUserAffinityBonds,
  getAffinityPrivacy,
  type RealAffinityBond,
} from "@/lib/affinity-service";
import { BorderAvatar } from "@/components/border-avatar";
import type { TierId } from "@/app/affinity";

export interface ProfileAffinityShowcaseProps {
  userId?: string | null;
  style?: StyleProp<ViewStyle>;
  onPress?: (() => void) | null;
}

const TIER_ICONS: Record<TierId, any> = {
  pasangan: require("@/assets/images/affinity/pasangan.png"),
  orang_kepercayaan: require("@/assets/images/affinity/orang_kepercayaan.png"),
  sahabat: require("@/assets/images/affinity/sahabat.png"),
  saudara: require("@/assets/images/affinity/saudara.png"),
};

const TIER_THEMES: Record<
  TierId,
  {
    glowColor: string;
    borderColor: string;
    avatarBorderColor: string;
    label: string;
  }
> = {
  pasangan: {
    glowColor: "#F43F5E",
    borderColor: "rgba(244, 63, 94, 0.4)",
    avatarBorderColor: "#E2B876", // Golden metallic frame
    label: "Pasangan",
  },
  orang_kepercayaan: {
    glowColor: "#F59E0B",
    borderColor: "rgba(245, 158, 11, 0.4)",
    avatarBorderColor: "#F59E0B",
    label: "Kepercayaan",
  },
  sahabat: {
    glowColor: "#EC4899",
    borderColor: "rgba(236, 72, 153, 0.4)",
    avatarBorderColor: "#EC4899",
    label: "Sahabat",
  },
  saudara: {
    glowColor: "#06B6D4",
    borderColor: "rgba(6, 182, 212, 0.4)",
    avatarBorderColor: "#06B6D4",
    label: "Saudara",
  },
};

export const ProfileAffinityShowcase: React.FC<ProfileAffinityShowcaseProps> = React.memo(
  ({ userId, style, onPress }) => {
    const auth = useAnirakuAuth();
    const activeUserId = userId || auth.user?.id;
    const isOwner = !userId || userId === auth.user?.id;

    // Heartbeat pulse animation
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, [pulseAnim]);

    const { data: affinityData } = useQuery({
      queryKey: ["profile-affinity-showcase", activeUserId],
      queryFn: async () => {
        if (!activeUserId || activeUserId === "guest") return null;
        try {
          const [bonds, privacy] = await Promise.all([
            getUserAffinityBonds(activeUserId),
            getAffinityPrivacy(activeUserId),
          ]);
          return { bonds, privacy };
        } catch {
          return null;
        }
      },
      enabled: Boolean(activeUserId && activeUserId !== "guest"),
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    });

    const activeBond = useMemo<RealAffinityBond | null>(() => {
      if (!affinityData?.bonds || affinityData.bonds.length === 0) return null;
      // Prioritas 1: Pasangan
      const pasangan = affinityData.bonds.find((b) => b.tierId === "pasangan");
      if (pasangan) return pasangan;
      // Prioritas 2: Ikatan dengan XP / level tertinggi
      return [...affinityData.bonds].sort((a, b) => (b.xp || 0) - (a.xp || 0))[0] || null;
    }, [affinityData?.bonds]);

    // Jika bukan owner dan privacy privat, jangan tampilkan
    if (!isOwner && affinityData?.privacy === "privat") {
      return null;
    }

    // Jika tidak ada ikatan, sembunyikan sepenuhnya (tidak ada icon dan tidak ada garis detak jantung)
    if (!activeBond) {
      return null;
    }

    const handlePress = () => {
      hapticLight();
      if (onPress) {
        onPress();
        return;
      }
      if (isOwner) {
        router.push("/affinity" as never);
      } else if (activeUserId) {
        router.push({
          pathname: "/affinity",
          params: {
            targetUserId: activeUserId,
            isVisitor: "1",
          },
        });
      }
    };

    const theme = TIER_THEMES[activeBond.tierId] || TIER_THEMES.pasangan;
    const tierIcon = TIER_ICONS[activeBond.tierId] || TIER_ICONS.pasangan;
    const friendInitial =
      activeBond.friend.name?.trim()?.charAt(0)?.toUpperCase() || "N";

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Afinitas ${theme.label} bersama ${activeBond.friend.name}`}
        onPress={handlePress}
        // @ts-ignore
        onClick={handlePress}
        style={({ pressed }) => [
          styles.container,
          pressed && styles.pressed,
          Platform.OS === "web" && ({ cursor: "pointer" } as any),
          style,
        ]}
      >
        {/* ─── 1. Gelombang Detak Jantung Sisi Kiri (Muncul dari belakang avatar utama) ─── */}
        <Svg style={styles.waveSvg} viewBox="0 0 100 26" preserveAspectRatio="none">
          {/* Outer Glow Path */}
          <Path
            d="M 0 13 L 26 13 L 34 18 L 45 3 L 57 23 L 65 7 L 73 13 L 100 13"
            stroke={theme.glowColor}
            strokeWidth={3.2}
            strokeOpacity={0.65}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Inner Sharp Core */}
          <Path
            d="M 0 13 L 26 13 L 34 18 L 45 3 L 57 23 L 65 7 L 73 13 L 100 13"
            stroke="#FFFFFF"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>

        {/* ─── 2. Icon Bunga Mawar / Lambang Tier (100% Bersih & Transparan Tanpa Box/Shadow Hitam) ─── */}
        <View style={styles.iconWrapper}>
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
            }}
          >
            <Image
              source={tierIcon}
              style={styles.tierIconImg}
              contentFit="contain"
            />
          </Animated.View>
        </View>

        {/* ─── 3. Gelombang Detak Jantung Sisi Kanan (Menghubungkan ke Avatar Teman) ─── */}
        <Svg style={styles.waveSvg} viewBox="0 0 100 26" preserveAspectRatio="none">
          {/* Outer Glow Path */}
          <Path
            d="M 0 13 L 24 13 L 32 18 L 43 3 L 55 23 L 63 7 L 71 13 L 100 13"
            stroke={theme.glowColor}
            strokeWidth={3.2}
            strokeOpacity={0.65}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Inner Sharp Core */}
          <Path
            d="M 0 13 L 24 13 L 32 18 L 43 3 L 55 23 L 63 7 L 71 13 L 100 13"
            stroke="#FFFFFF"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>

        {/* ─── 4. Avatar Teman / Pasangan di Sisi Kanan (Diperbesar Proporsional & Digeser Lebih ke Kiri) ─── */}
        {activeBond.friend.equippedBorder ? (
          <View style={styles.borderAvatarWrapper}>
            <BorderAvatar
              avatarUrl={activeBond.friend.avatarUrl}
              fallbackText={friendInitial}
              borderId={activeBond.friend.equippedBorder}
              avatarSize={36}
              disabled
            />
          </View>
        ) : (
          <View
            style={[
              styles.avatarFrame,
              { borderColor: theme.avatarBorderColor },
            ]}
          >
            {activeBond.friend.avatarUrl ? (
              <Image
                source={{ uri: activeBond.friend.avatarUrl }}
                style={styles.avatarImg}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{friendInitial}</Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
    );
  }
);

ProfileAffinityShowcase.displayName = "ProfileAffinityShowcase";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingVertical: 0,
    paddingHorizontal: 0,
    width: "100%",
    maxWidth: 136,
  },
  containerEmpty: {
    gap: 4,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  waveSvg: {
    flex: 1,
    height: 24,
    minWidth: 18,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  tierIconImg: {
    width: 26,
    height: 26,
  },
  borderAvatarWrapper: {
    marginLeft: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFrame: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 1,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "700",
  },
});
