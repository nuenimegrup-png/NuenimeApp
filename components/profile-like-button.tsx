import React, { useState, useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { AppIcon } from "@/components/app-icon";
import { useAnirakuAuth } from "@/providers/auth-provider";
import {
  getProfileLikes,
  toggleProfileLike,
  formatLikeCount,
} from "@/lib/profile-likes-service";
import { supabase } from "@/lib/supabase";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { showToast } from "@/lib/toast";

export interface ProfileLikeButtonProps {
  targetUserId: string;
  isOwnProfile?: boolean;
  targetUsername?: string;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}

export function ProfileLikeButton({
  targetUserId,
  isOwnProfile = false,
  targetUsername,
  size = "md",
  style,
}: ProfileLikeButtonProps) {
  const auth = useAnirakuAuth();
  const currentUserId = auth.user?.id || null;

  const [likeCount, setLikeCount] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [isLiking, setIsLiking] = useState<boolean>(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // 1. Ambil data like profil dari server / local cache
  useEffect(() => {
    if (!targetUserId) return;
    let isMounted = true;

    getProfileLikes(targetUserId, currentUserId)
      .then((res) => {
        if (isMounted) {
          setLikeCount(res.count);
          setHasLiked(res.hasLiked);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [targetUserId, currentUserId]);

  // 2. Realtime listener Supabase untuk update seketika saat ada yang menyukai
  useEffect(() => {
    if (!targetUserId) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;
    const channelName = `profile-likes-${targetUserId}-${Math.random().toString(36).slice(2, 6)}`;

    try {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_profile_likes",
            filter: `target_user_id=eq.${targetUserId}`,
          },
          () => {
            if (isMounted) {
              getProfileLikes(targetUserId, currentUserId).then((res) => {
                if (isMounted) {
                  setLikeCount(res.count);
                  setHasLiked(res.hasLiked);
                }
              }).catch(() => {});
            }
          }
        )
        .subscribe();
    } catch {}

    return () => {
      isMounted = false;
      if (channel) {
        try {
          void channel.unsubscribe();
          void supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [targetUserId, currentUserId]);

  const handlePress = async () => {
    if (isLiking) return;

    if (isOwnProfile) {
      hapticLight();
      showToast(`Total apresiasi akun kamu: ${likeCount.toLocaleString("id-ID")} like`);
      return;
    }

    if (!currentUserId || currentUserId === "guest") {
      hapticLight();
      showToast("Silakan masuk akun untuk menyukai profil ini.");
      return;
    }

    // Animasi bounce tombol
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.22,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    // Optimistic Update
    const prevCount = likeCount;
    const prevLiked = hasLiked;
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

    setHasLiked(nextLiked);
    setLikeCount(nextCount);

    if (nextLiked) {
      hapticSuccess();
      if (targetUsername) {
        showToast(`Menyukai profil ${targetUsername}! ❤️`);
      }
    } else {
      hapticLight();
    }

    setIsLiking(true);
    try {
      const res = await toggleProfileLike(targetUserId, currentUserId);
      setLikeCount(res.count);
      setHasLiked(res.hasLiked);
    } catch {
      // Revert if error
      setLikeCount(prevCount);
      setHasLiked(prevLiked);
    } finally {
      setIsLiking(false);
    }
  };

  const isSmall = size === "sm";

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isOwnProfile
            ? `Total like profil: ${formatLikeCount(likeCount)}`
            : hasLiked
            ? `Sudah menyukai profil ini (${formatLikeCount(likeCount)} like). Tekan untuk membatalkan.`
            : `Sukai profil ini (${formatLikeCount(likeCount)} like)`
        }
        onPress={handlePress}
        style={({ pressed }) => [
          styles.pillContainer,
          isSmall && styles.pillSmall,
          hasLiked && styles.pillLiked,
          pressed && styles.pillPressed,
        ]}
        hitSlop={6}
      >
        <AppIcon
          name="thumb-up"
          size={isSmall ? 11 : 13}
          color="#EF4444"
        />
        <Text
          style={[
            styles.likeCountText,
            isSmall && styles.likeCountTextSmall,
          ]}
          numberOfLines={1}
        >
          {formatLikeCount(likeCount)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pillContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4.5,
    paddingHorizontal: 8.5,
    paddingVertical: 3.5,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.14)", // Merah gelap transparan persis Screenshot
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.45)", // Garis border merah persis Screenshot
    ...(Platform.OS === "web"
      ? ({
          cursor: "pointer",
          userSelect: "none",
        } as any)
      : {}),
  },
  pillSmall: {
    paddingHorizontal: 6.5,
    paddingVertical: 2.5,
    borderRadius: 10,
    gap: 3.5,
  },
  pillLiked: {
    backgroundColor: "rgba(239, 68, 68, 0.24)",
    borderColor: "#EF4444",
  },
  pillPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  likeCountText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#EF4444", // Teks merah terang persis Screenshot
    letterSpacing: 0.2,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  likeCountTextSmall: {
    fontSize: 10,
  },
});

