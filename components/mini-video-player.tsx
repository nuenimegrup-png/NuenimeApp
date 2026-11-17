import React, { useRef } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "@/components/app-icon";
import { UniversalVideo } from "@/components/universal-video";
import { useMiniPlayer } from "@/providers/mini-player-provider";
import { hapticLight } from "@/lib/haptics";
import type { VideoRef } from "react-native-video";

export function MiniVideoPlayer() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const {
    playerData,
    isMinimized,
    isPlaying,
    currentTime,
    restorePlayer,
    closeMiniPlayer,
    togglePlayPause,
    updatePlaybackTime,
  } = useMiniPlayer();

  const videoRef = useRef<VideoRef>(null);

  // Jika sedang berada di layar nonton (/watch) atau tidak ada video diminimalkan, jangan render mini player
  if (!isMinimized || !playerData || (pathname && pathname.startsWith("/watch"))) {
    return null;
  }

  // Cek apakah halaman saat ini memiliki bottom tab dock
  const isTabScreen =
    pathname === "/" ||
    pathname === "/schedule" ||
    pathname === "/library" ||
    pathname === "/history" ||
    pathname === "/profile" ||
    pathname === "/catalog" ||
    pathname.startsWith("/(tabs)");

  // Sesuaikan posisi bottom agar melayang pas di atas dock tab (atau di atas safe area layar biasa)
  const bottomOffset = isTabScreen
    ? (Platform.OS === "web" ? 14 : Math.max(insets.bottom, 12)) + 70
    : (Platform.OS === "web" ? 16 : Math.max(insets.bottom, 16));

  return (
    <View style={[styles.floatingWrapper, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.container}>
        {/* AREA KLIK UNTUK KEMBALI KE LAYAR PENUH (KIRI & TENGAH) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali ke layar video penuh"
          onPress={() => {
            hapticLight();
            restorePlayer();
          }}
          // @ts-ignore
          onClick={() => {
            hapticLight();
            restorePlayer();
          }}
          style={({ pressed }) => [
            styles.restoreArea,
            pressed && styles.restoreAreaPressed,
            Platform.OS === "web" && ({ cursor: "pointer" } as any),
          ]}
        >
          {/* 1. KIRI: FRAME VIDEO KECIL / THUMBNAIL (ASPECT RATIO 16:9) */}
          <View style={styles.videoBox}>
            {playerData.thumbnail ? (
              <Image
                source={{ uri: playerData.thumbnail }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0B0E14" }]} />
            )}

            {playerData.videoSourceUri ? (
              <UniversalVideo
                ref={videoRef}
                style={StyleSheet.absoluteFill}
                source={{
                  uri: playerData.videoSourceUri,
                  headers: playerData.videoSourceHeaders,
                  type: playerData.videoContentType,
                }}
                paused={!isPlaying}
                resizeMode="cover"
                onLoad={() => {
                  if (playerData.currentTime > 0) {
                    videoRef.current?.seek(playerData.currentTime);
                  }
                }}
                onProgress={(e) => {
                  if (e?.currentTime) {
                    updatePlaybackTime(e.currentTime, e?.seekableDuration);
                  }
                }}
              />
            ) : null}
          </View>

          {/* 2. TENGAH: JUDUL ANIME & EPISODE */}
          <View style={styles.infoCol}>
            <Text style={styles.titleText} numberOfLines={1}>
              {playerData.animeTitle}
            </Text>
            <Text style={styles.subtitleText} numberOfLines={1}>
              {playerData.episodeTitle}
            </Text>
          </View>
        </Pressable>

        {/* 3. KANAN: KONTROL PLAY/PAUSE & TOMBOL TUTUP (X) - TERPISAH MANDIRI, BUKAN DESCENDANT BUTTON */}
        <View style={styles.actionsRow} pointerEvents="box-none">
          {/* Tombol Play / Pause */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Jeda video" : "Lanjutkan video"}
            onPress={(e) => {
              e.stopPropagation?.();
              hapticLight();
              togglePlayPause();
            }}
            // @ts-ignore
            onClick={(e: any) => {
              e?.stopPropagation?.();
              hapticLight();
              togglePlayPause();
            }}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.btnPressed]}
            hitSlop={10}
          >
            <AppIcon name={isPlaying ? "pause" : "play"} size={22} color="#FFFFFF" />
          </Pressable>

          {/* Tombol Close (X) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup pemutar mini"
            onPress={(e) => {
              e.stopPropagation?.();
              hapticLight();
              closeMiniPlayer();
            }}
            // @ts-ignore
            onClick={(e: any) => {
              e?.stopPropagation?.();
              hapticLight();
              closeMiniPlayer();
            }}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.btnPressed]}
            hitSlop={10}
          >
            <AppIcon name="close" size={20} color="#CBD5E1" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 99998,
    alignItems: "center",
  },
  container: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#161922",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 7,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    ...(Platform.OS !== "web"
      ? {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 16,
          elevation: 12,
        }
      : ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.55)",
        } as any)),
  },
  restoreArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  restoreAreaPressed: {
    opacity: 0.85,
  },
  btnPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.92 }],
  },
  videoBox: {
    width: 84,
    height: 48,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#0B0E14",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  infoCol: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  titleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },
  subtitleText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 4,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});

