import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { AppIcon } from "@/components/app-icon";

const EMPTY_ILLUSTRATION = require("@/assets/images/empty-state.png");

export function LoadingState({ label = "Memuat data anime..." }: { label?: string }) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color="#38BDF8" size="large" />
      {label ? <Text style={styles.loadingText}>{label}</Text> : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = "COBA LAGI",
  retryDisabled = false,
}: {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
  retryDisabled?: boolean;
}) {
  const anilistOutage = /AniList is temporarily unavailable due to an upstream stability issue/i.test(message);
  const friendlyMessage = /api\.aniraku|backend|graphql|network request|failed to fetch/i.test(message)
    ? "Periksa koneksi internet dan coba lagi."
    : message;

  return (
    <View accessibilityRole="alert" style={styles.stateContainer}>
      <View style={[styles.iconCard, styles.errorIconCard]}>
        <AppIcon name="alert-circle-outline" size={28} color="#EF4444" />
      </View>
      <Text style={styles.stateTitle}>
        {anilistOutage ? "Layanan AniList Sedang Sibuk" : "Gagal Memuat Data"}
      </Text>
      <Text style={styles.stateDesc}>
        {anilistOutage
          ? "AniList sedang mengalami lonjakan trafik. Silakan coba sesaat lagi."
          : friendlyMessage}
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={retryDisabled}
        onPress={onRetry}
        style={({ pressed }) => [
          styles.actionBtn,
          retryDisabled && styles.btnDisabled,
          pressed && styles.btnPressed,
        ]}
      >
        <Text style={styles.actionBtnText}>{retryLabel}</Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({
  label,
  action,
  imageSource,
  imageSize = 140,
}: {
  label: string;
  action?: { label: string; onPress: () => void };
  imageSource?: any;
  imageSize?: number;
}) {
  return (
    <View style={styles.stateContainer}>
      <Image
        source={imageSource ?? EMPTY_ILLUSTRATION}
        style={[styles.emptyIllustration, { width: imageSize, height: imageSize }]}
        contentFit="contain"
      />
      <Text style={styles.stateDesc}>{label}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [styles.actionBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.actionBtnText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    minHeight: 280,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 14,
  },
  loadingText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  stateContainer: {
    flex: 1,
    minHeight: 260,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyIllustration: {
    marginBottom: 6,
  },
  iconCard: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        } as any)
      : {}),
  },
  errorIconCard: {
    borderColor: "rgba(239, 68, 68, 0.3)",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  stateTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
    textAlign: "center",
  },
  stateDesc: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12.5,
    color: "#94A3B8",
    textAlign: "center",
    maxWidth: 290,
    lineHeight: 18,
  },
  actionBtn: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  actionBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#38BDF8",
    letterSpacing: 0.5,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
