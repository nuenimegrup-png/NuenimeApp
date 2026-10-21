import React, { useEffect, useState } from "react";
import {
  ImageStyle,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { AvatarBorder, getBorderById, getBorderByIdAsync } from "@/lib/avatar-borders";

// Backward-compatibility local assets
const LEGACY_BORDER_ASSETS: Record<string, any> = {
  white_mage: require("@/assets/images/inventory/border-white-mage.png"),
  magic_book: require("@/assets/images/inventory/border-magic-book.png"),
};

export interface BorderAvatarProps {
  avatarUrl?: string | null;
  fallbackText?: string;
  borderId?: string | null;
  border?: AvatarBorder | null;
  /**
   * Ukuran avatar tetap (diameter lingkaran avatar dalam pixel).
   * Ditentukan oleh masing-masing komponen atau lokasi tampilan.
   * Ukuran ini TIDAK AKAN BERUBAH saat pengguna mengganti border.
   * Default: 48
   */
  avatarSize?: number;
  /**
   * Alias untuk avatarSize untuk kompatibilitas.
   */
  size?: number;
  style?: StyleProp<ViewStyle>;
  avatarStyle?: StyleProp<ImageStyle>;
  onPress?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const BorderAvatar: React.FC<BorderAvatarProps> = ({
  avatarUrl,
  fallbackText = "N",
  borderId,
  border: borderProp,
  avatarSize: avatarSizeProp,
  size: sizeProp,
  style,
  avatarStyle,
  onPress,
  disabled = !onPress,
  children,
}) => {
  const [avatarError, setAvatarError] = useState(false);
  const [borderError, setBorderError] = useState(false);

  // 1. UKURAN AVATAR TETAP SESUAI KOMPONEN PEMANGGIL (TIDAK PERNAH DIUBAH OLEH BORDER)
  const avatarSize = Math.max(16, avatarSizeProp ?? sizeProp ?? 48);

  // Cari data border dari ID, direct URL, atau prop
  const isDirectUrl = typeof borderId === "string" && (borderId.startsWith("http://") || borderId.startsWith("https://"));
  
  // State untuk border dinamis jika baru di-input admin dan belum termuat di cache in-memory
  const [asyncBorder, setAsyncBorder] = useState<AvatarBorder | null>(null);

  const synchronousBorder =
    borderProp ||
    (isDirectUrl
      ? {
          id: "custom_url",
          name: "Custom Border",
          rarity: "Rare" as const,
          assetUrl: borderId,
          innerRatio: 0.74,
          isReleased: true,
        }
      : borderId
      ? getBorderById(borderId)
      : undefined);

  const borderData = synchronousBorder || asyncBorder;

  // Fallback async fetch jika borderId adalah border baru hasil input admin
  useEffect(() => {
    if (borderId && !synchronousBorder && !isDirectUrl) {
      let isMounted = true;
      getBorderByIdAsync(borderId).then((b) => {
        if (isMounted && b) {
          setAsyncBorder(b);
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [borderId, synchronousBorder, isDirectUrl]);

  const legacyAsset = borderId ? LEGACY_BORDER_ASSETS[borderId] : undefined;
  const hasActiveBorder = Boolean((borderData && borderData.assetUrl) || legacyAsset);

  // 2. BORDER MENYESUAIKAN UKURAN AVATAR (BUKAN SEBALIKNYA)
  // Rasio diameter lubang tengah terhadap ukuran aset border (standar seragam 0.74)
  const innerRatio = borderData?.innerRatio ?? 0.74;

  // Ukuran border dihitung dari avatarSize dibagi rasio lubang,
  // sehingga lubang tengah border tepat pas membungkus avatar tanpa celah.
  const borderSize = hasActiveBorder ? Math.round(avatarSize / innerRatio) : avatarSize;

  // Offset per-aset proporsional terhadap ukuran border
  const offsetX = borderData?.offsetX ? Math.round(borderSize * borderData.offsetX) : 0;
  const offsetY = borderData?.offsetY ? Math.round(borderSize * borderData.offsetY) : 0;

  // Penjajaran border: diposisikan di tengah avatar + offset
  const borderLeft = Math.round((avatarSize - borderSize) / 2) + offsetX;
  const borderTop = Math.round((avatarSize - borderSize) / 2) + offsetY;

  const initial = (fallbackText || "N").trim().charAt(0).toUpperCase() || "N";

  const renderContent = () => (
    <View style={[styles.container, { width: avatarSize, height: avatarSize }, style]}>
      {/* ─── 1. LAPISAN AVATAR (BAWAH) ─── */}
      {/* Ukuran lingkaran avatar TETAP SAMA di lokasi tersebut */}
      <View
        style={[
          styles.avatarCircle,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
          },
        ]}
      >
        {avatarUrl && !avatarError ? (
          <Image
            source={{ uri: avatarUrl }}
            style={[styles.avatarImage, avatarStyle]}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={[styles.avatarInitial, { fontSize: Math.round(avatarSize * 0.42) }]}>
              {initial}
            </Text>
          </View>
        )}
      </View>

      {/* ─── 2. LAPISAN BORDER (ATAS) ─── */}
      {/* Border diskalakan dan diposisikan mengelilingi avatar */}
      {hasActiveBorder && !borderError ? (
        <Image
          source={legacyAsset || { uri: borderData!.assetUrl! }}
          style={[
            styles.borderFrame,
            {
              width: borderSize,
              height: borderSize,
              left: borderLeft,
              top: borderTop,
              transform: borderData?.scale ? [{ scale: borderData.scale }] : undefined,
            },
          ]}
          contentFit="contain"
          pointerEvents="none"
          transition={150}
          cachePolicy="memory-disk"
          onError={() => setBorderError(true)}
        />
      ) : null}

      {/* Child elements seperti badge kamera atau indikator online */}
      {children}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <View
        accessible
        accessibilityRole="button"
        hitSlop={6}
        onTouchEnd={(e) => {
          e.stopPropagation();
          onPress();
        }}
        // Web: tidak pakai Pressable (→ <button>) karena bisa ada Pressable child
        // sehingga menghasilkan nested <button> yang tidak valid di HTML
        style={{ cursor: "pointer" } as any}
      >
        {renderContent()}
      </View>
    );
  }

  return renderContent();
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    // Overflow visible agar ornamen luar border bebas tampil tanpa terpotong
    overflow: "visible",
  },
  avatarCircle: {
    position: "absolute",
    overflow: "hidden",
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#24324D",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  borderFrame: {
    position: "absolute",
    zIndex: 2,
  },
  pressedState: {
    opacity: 0.85,
  },
});
