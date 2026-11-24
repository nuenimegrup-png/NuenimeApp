import React from "react";
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { hapticLight } from "@/lib/haptics";
import {
  getUserGiftSummary,
  PROFILE_GIFTS_CATALOG,
  UNIVERSAL_DEFAULT_GIFT_ICON,
} from "@/lib/profile-gifts-service";

export interface ProfileGiftShowcaseProps {
  userId?: string | null;
  userName?: string;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}

/**
 * Komponen Showcase Gift di Samping Kiri Profil (Mobile Legends Style)
 * Menampilkan ikon/gambar gift kustom murni:
 * - Jika belum memiliki/menerima gift: Menggunakan icon universal default (ehbjmsh9.png)
 * - Jika sudah memiliki/menerima gift: Menampilkan gift yang dipasang (equipped) atau top gift
 * - Tanpa background / lingkaran belakang
 * - Tanpa animasi ngambang-ngambang (posisi diam dan stabil)
 * - Sentuhan responsif 100% di Android & iOS tanpa nesting View bermasalah
 */
export const ProfileGiftShowcase = React.memo(function ProfileGiftShowcase({
  userId,
  userName,
  style,
  onPress,
}: ProfileGiftShowcaseProps) {
  // Query total charisma & top gift yang diterima pengguna
  const { data: giftSummary, isLoading } = useQuery({
    queryKey: ["profile-gift-summary", userId],
    queryFn: () => (userId ? getUserGiftSummary(userId) : null),
    staleTime: 30_000,
    enabled: Boolean(userId),
  });

  // Tentukan gift mana yang ditampilkan:
  // 1. Gift yang dipilih/dipasang sendiri (equipped) jika pengguna memilikinya
  // 2. Atau gift dengan perolehan terbanyak (top gift) jika ada
  // 3. Jika belum pernah menerima gift sama sekali: tampilkan UNIVERSAL_DEFAULT_GIFT_ICON
  let displayImage = UNIVERSAL_DEFAULT_GIFT_ICON;

  if (giftSummary && giftSummary.totalGiftsCount > 0) {
    const equippedId = giftSummary.equippedGiftId;
    const equippedCount = equippedId ? (giftSummary.giftCounts?.[equippedId] || 0) : 0;

    let targetGift = null;
    if (equippedId && equippedCount > 0) {
      targetGift = PROFILE_GIFTS_CATALOG.find((g) => g.id === equippedId);
    } else if (giftSummary.topGifts?.[0]?.giftId) {
      targetGift = PROFILE_GIFTS_CATALOG.find((g) => g.id === giftSummary.topGifts[0].giftId);
    }

    if (targetGift?.imageUrl) {
      displayImage = targetGift.imageUrl;
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Kirim atau Lihat Gift Profil untuk ${userName || "Pengguna"}`}
      onPress={() => {
        hapticLight();
        onPress();
      }}
      style={({ pressed }) => [
        styles.container,
        style,
        pressed && styles.containerPressed,
        Platform.OS === "web" && ({ cursor: "pointer" } as any),
      ]}
      hitSlop={16}
    >
      <Image
        source={{ uri: displayImage }}
        style={[styles.giftImg, isLoading && styles.giftImgLoading]}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={150}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  containerPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.92 }],
  },
  giftImg: {
    width: 48,
    height: 48,
  },
  giftImgLoading: {
    opacity: 0.6,
  },
});
