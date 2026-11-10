import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Image } from "expo-image";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Circle,
  Path,
  Rect,
  G,
} from "react-native-svg";
import { LelangItem } from "@/lib/lelang-service";
import { getBorderById } from "@/lib/avatar-borders";
import { AppIcon } from "@/components/app-icon";

const LEGACY_BORDER_ASSETS: Record<string, any> = {
  white_mage: require("@/assets/images/inventory/border-white-mage.png"),
  magic_book: require("@/assets/images/inventory/border-magic-book.png"),
  border_white_mage: require("@/assets/images/inventory/border-white-mage.png"),
  border_magic_book: require("@/assets/images/inventory/border-magic-book.png"),
};

export interface LelangItemArtProps {
  item: LelangItem;
  size?: number;
  variant?: "card" | "showcase";
  style?: StyleProp<ViewStyle>;
}

export function LelangItemArt({
  item,
  size = 72,
  variant = "card",
  style,
}: LelangItemArtProps) {
  const isBorder = item.type === "border";
  const isShowcase = variant === "showcase";

  // Cek apakah item border memiliki asset PNG nyata dari Supabase / catalog
  const catalogBorder = item.sourceId ? getBorderById(item.sourceId) : undefined;
  const legacyAsset =
    (item.sourceId && LEGACY_BORDER_ASSETS[item.sourceId]) ||
    (item.id && LEGACY_BORDER_ASSETS[item.id]);

  const rawAssetUrl = item.imageUrl || catalogBorder?.assetUrl;
  const borderAssetUrl =
    rawAssetUrl ||
    (typeof item.sourceId === "string" &&
    (item.sourceId.startsWith("http://") || item.sourceId.startsWith("https://"))
      ? item.sourceId
      : null);

  const hasRealBorderAsset = Boolean(borderAssetUrl || legacyAsset);

  // Cek identifikasi SVG hardcoded (Nebula, Golden Flame, Crimson Moon, Lunar Eclipse)
  const isCrimsonMoon =
    item.id === "lelang-crimson-moon" ||
    item.sourceId === "lelang-crimson-moon" ||
    item.title?.toLowerCase().includes("crimson moon");

  const isLunarEclipse =
    item.id === "lelang-lunar-eclipse" ||
    item.sourceId === "lelang-lunar-eclipse" ||
    item.title?.toLowerCase().includes("lunar eclipse");

  const isNebula =
    item.id === "lelang-nebula" ||
    item.sourceId === "lelang-nebula" ||
    item.title?.toLowerCase().includes("nebula");

  const isGoldenFlame =
    item.id === "lelang-golden-flame" ||
    item.sourceId === "lelang-golden-flame" ||
    item.title?.toLowerCase().includes("golden flame");

  // ─────────────────────────────────────────────────────────────
  // 1. TAMPILAN BORDER (DI MANA PUN: LIST, SHOWCASE, RIWAYAT, DLL)
  // TIDAK ADA KOTAK BIRU, TIDAK ADA BORDER WIDTH/COLOR,
  // TIDAK ADA BACKGROUND KOTAK.
  // HANYA LINGKARAN AVATAR PROFIL DI TENGAH DAN FRAME BORDER SIRKULAR.
  // ─────────────────────────────────────────────────────────────
  if (isBorder) {
    const avatarCircleSize = Math.round(size * 0.72);
    const iconSize = Math.round(size * 0.36);

    return (
      <View
        style={[
          styles.borderContainer,
          { width: size, height: size },
          style,
        ]}
      >
        {/* Lingkaran Avatar Profil Tengah (Wajib Tetap Ada) */}
        <View
          style={[
            styles.borderAvatarCircle,
            {
              width: avatarCircleSize,
              height: avatarCircleSize,
              borderRadius: avatarCircleSize / 2,
            },
          ]}
        >
          <AppIcon name="account" size={iconSize} color="rgba(255, 255, 255, 0.28)" />
        </View>

        {/* Layer Border: Real PNG dari Supabase (misal: Phantom Mirage / 11.png) */}
        {hasRealBorderAsset ? (
          <Image
            source={legacyAsset || { uri: borderAssetUrl! }}
            style={[StyleSheet.absoluteFillObject, { width: "100%", height: "100%" }]}
            contentFit="contain"
            transition={150}
          />
        ) : isNebula ? (
          /* SVG Nebula */
          <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <LinearGradient id="nebulaGradAll" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#C084FC" />
                <Stop offset="50%" stopColor="#9333EA" />
                <Stop offset="100%" stopColor="#6366F1" />
              </LinearGradient>
            </Defs>
            <Circle cx="50" cy="50" r="38" fill="#A855F7" opacity="0.18" />
            <Circle cx="50" cy="50" r="28" stroke="url(#nebulaGradAll)" strokeWidth="4" fill="none" />
            <Circle
              cx="50"
              cy="50"
              r="22"
              stroke="#E9D5FF"
              strokeWidth="1.2"
              opacity="0.8"
              fill="none"
              strokeDasharray="4, 3"
            />
            <Path
              d="M 50 14 L 52 20 L 50 26 L 48 20 Z M 50 86 L 52 80 L 50 74 L 48 80 Z M 14 50 L 20 52 L 26 50 L 20 48 Z M 86 50 L 80 52 L 74 50 L 80 48 Z"
              fill="#C084FC"
            />
            <Circle cx="28" cy="28" r="2.5" fill="#F472B6" />
            <Circle cx="72" cy="28" r="2.5" fill="#818CF8" />
            <Circle cx="28" cy="72" r="2.5" fill="#818CF8" />
            <Circle cx="72" cy="72" r="2.5" fill="#F472B6" />
          </Svg>
        ) : isGoldenFlame ? (
          /* SVG Golden Flame */
          <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <LinearGradient id="goldFlameGradAll" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FDE047" />
                <Stop offset="50%" stopColor="#F59E0B" />
                <Stop offset="100%" stopColor="#B45309" />
              </LinearGradient>
            </Defs>
            <Circle cx="50" cy="50" r="38" fill="#F59E0B" opacity="0.2" />
            <Path
              d="
                M 50 12 L 55 24 L 67 15 L 65 29 L 79 25 L 72 37 L 87 39 L 76 48
                L 88 50 L 76 52 L 87 61 L 72 63 L 79 75 L 65 71 L 67 85 L 55 76
                L 50 88 L 45 76 L 33 85 L 35 71 L 21 75 L 28 63 L 13 61 L 24 52
                L 12 50 L 24 48 L 13 39 L 28 37 L 21 25 L 35 29 L 33 15 L 45 24 Z
              "
              fill="url(#goldFlameGradAll)"
            />
            <Circle cx="50" cy="50" r="24" stroke="#FEF08A" strokeWidth="1.5" fill="none" opacity="0.9" />
          </Svg>
        ) : (
          /* Fallback Procedural Ring */
          <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <LinearGradient id="procRingGradAll" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={item.accentColor || "#38BDF8"} />
                <Stop offset="50%" stopColor={item.glowColor || "#818CF8"} />
                <Stop offset="100%" stopColor={item.accentColor || "#38BDF8"} />
              </LinearGradient>
            </Defs>
            <Circle cx="50" cy="50" r="38" fill={item.accentColor || "#38BDF8"} opacity="0.16" />
            <Circle cx="50" cy="50" r="28" stroke="url(#procRingGradAll)" strokeWidth="3" fill="none" />
            <Circle
              cx="50"
              cy="50"
              r="22"
              stroke="#FFFFFF"
              strokeWidth="1.2"
              opacity="0.75"
              fill="none"
              strokeDasharray="4, 3"
            />
            <Path
              d="M 50 14 L 52 20 L 50 26 L 48 20 Z M 50 86 L 52 80 L 50 74 L 48 80 Z M 14 50 L 20 52 L 26 50 L 20 48 Z M 86 50 L 80 52 L 74 50 L 80 48 Z"
              fill={item.accentColor || "#38BDF8"}
            />
          </Svg>
        )}
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. TAMPILAN BANNER (SHOWCASE ATAU CARD)
  // JIKA SHOWCASE: MENGISI CONTAINER SECARA PENUH
  // ─────────────────────────────────────────────────────────────
  if (isShowcase && item.imageUrl) {
    return (
      <View style={[styles.showcaseBannerContainer, style]}>
        <Image
          source={{ uri: item.imageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={200}
        />
      </View>
    );
  }

  // Banner dengan gambar URL di card
  if (item.imageUrl) {
    return (
      <View
        style={[
          styles.bannerCard,
          {
            width: size,
            height: size,
            borderColor: item.accentColor,
            shadowColor: item.accentColor,
          },
          style,
        ]}
      >
        <Image
          source={{ uri: item.imageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={150}
        />
      </View>
    );
  }

  // Fallback SVG Banner Artwork
  return (
    <View
      style={[
        styles.bannerCard,
        {
          width: size,
          height: size,
          borderColor: item.accentColor,
          shadowColor: item.accentColor,
        },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="crimsonMoonGrad" cx="50%" cy="35%" r="40%">
            <Stop offset="0%" stopColor="#FF4D4D" stopOpacity="1" />
            <Stop offset="70%" stopColor="#DC2626" stopOpacity="1" />
            <Stop offset="100%" stopColor="#7F1D1D" stopOpacity="0.8" />
          </RadialGradient>

          <RadialGradient id="lunarGrad" cx="50%" cy="40%" r="45%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="60%" stopColor="#38BDF8" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#0369A1" stopOpacity="0.7" />
          </RadialGradient>

          <LinearGradient id="fallbackBannerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={item.accentColor || "#3B82F6"} />
            <Stop offset="100%" stopColor="#0B132B" />
          </LinearGradient>
        </Defs>

        <Rect width="100" height="100" rx="10" fill="#070A12" />

        {isCrimsonMoon ? (
          <G>
            <Circle cx="50" cy="38" r="22" fill="url(#crimsonMoonGrad)" />
            <Circle cx="50" cy="38" r="28" fill="#EF4444" opacity="0.25" />
            <Path d="M 5 95 L 35 60 L 60 85 L 80 52 L 95 95 Z" fill="#180508" />
            <Path d="M 20 95 L 50 68 L 75 95 Z" fill="#2A0B10" opacity="0.9" />
            <Path
              d="M 12 18 L 12 12 L 18 12 M 82 12 L 88 12 L 88 18 M 88 82 L 88 88 L 82 88 M 18 88 L 12 88 L 12 82"
              stroke="#EF4444"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </G>
        ) : isLunarEclipse ? (
          <G>
            <Circle cx="50" cy="35" r="28" fill="#38BDF8" opacity="0.22" />
            <Circle cx="50" cy="35" r="20" fill="url(#lunarGrad)" />
            <Path d="M 0 100 Q 50 70 100 100 Z" fill="#061226" />
            <Circle cx="50" cy="62" r="3" fill="#0C2044" />
            <Path d="M 47 65 L 53 65 L 54 75 L 46 75 Z" fill="#0C2044" />
            <Circle cx="20" cy="25" r="1.2" fill="#E0F2FE" />
            <Circle cx="80" cy="20" r="1.5" fill="#BAE6FD" />
            <Circle cx="85" cy="45" r="1" fill="#BAE6FD" />
            <Circle cx="15" cy="48" r="1" fill="#BAE6FD" />
            <Path d="M 50 6 L 54 10 L 46 10 Z M 50 94 L 54 90 L 46 90 Z" fill="#38BDF8" />
          </G>
        ) : (
          <G>
            <Rect width="100" height="100" fill="url(#fallbackBannerGrad)" opacity="0.4" />
            <Circle cx="50" cy="40" r="20" fill={item.accentColor || "#38BDF8"} opacity="0.4" />
            <Circle cx="50" cy="40" r="14" fill="#FFFFFF" opacity="0.9" />
            <Path d="M 0 95 L 35 65 L 65 85 L 85 55 L 100 95 Z" fill="#090E17" />
          </G>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  borderContainer: {
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "visible",
  },
  borderAvatarCircle: {
    backgroundColor: "#070A12",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bannerCard: {
    borderRadius: 10,
    borderWidth: 1.2,
    backgroundColor: "rgba(10, 14, 23, 0.95)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
    position: "relative",
  },
  showcaseBannerContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    overflow: "hidden",
  },
});
