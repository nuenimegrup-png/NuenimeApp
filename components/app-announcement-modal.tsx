import React, { useEffect, useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppIcon } from "@/components/app-icon";
import {
  getAppAnnouncementConfig,
  type AppAnnouncementConfig,
} from "@/lib/admin-service";

const STORAGE_DISMISSED_ANNOUNCEMENT = "nuenime.announcement.dismissed_timestamp";

interface AppAnnouncementModalProps {
  /** Jika diberikan previewConfig, komponen akan bertindak sebagai mode Preview untuk admin */
  previewConfig?: AppAnnouncementConfig | null;
  onClosePreview?: () => void;
}

export function AppAnnouncementModal({
  previewConfig,
  onClosePreview,
}: AppAnnouncementModalProps) {
  const [config, setConfig] = useState<AppAnnouncementConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const checkAnnouncement = useCallback(async () => {
    if (previewConfig) {
      setConfig(previewConfig);
      setVisible(true);
      return;
    }

    try {
      const liveConfig = await getAppAnnouncementConfig();
      if (!liveConfig || !liveConfig.isActive) {
        setVisible(false);
        return;
      }

      // Periksa apakah user sudah pernah menutup pengumuman versi/update ini
      const lastDismissedTime = await AsyncStorage.getItem(STORAGE_DISMISSED_ANNOUNCEMENT);
      if (liveConfig.updatedAt && lastDismissedTime === liveConfig.updatedAt) {
        setVisible(false);
        return;
      }

      setConfig(liveConfig);
      setVisible(true);
    } catch {
      setVisible(false);
    }
  }, [previewConfig]);

  useEffect(() => {
    checkAnnouncement();
  }, [checkAnnouncement]);

  const handleDismiss = async () => {
    setVisible(false);
    if (onClosePreview) {
      onClosePreview();
      return;
    }
    if (config?.updatedAt) {
      try {
        await AsyncStorage.setItem(STORAGE_DISMISSED_ANNOUNCEMENT, config.updatedAt);
      } catch {}
    }
  };

  const handleAction = async () => {
    if (!config) return;
    handleDismiss();

    if (config.buttonUrl) {
      try {
        await Linking.openURL(config.buttonUrl);
      } catch (err) {
        console.warn("Gagal membuka tautan pengumuman:", err);
      }
    }
  };

  const handleSecondaryAction = async () => {
    if (!config) return;
    handleDismiss();

    const secUrl = config.secondaryButtonUrl?.trim();
    if (secUrl && secUrl !== "#close") {
      try {
        await Linking.openURL(secUrl);
      } catch (err) {
        console.warn("Gagal membuka tautan tombol sekunder:", err);
      }
    }
  };

  if (!visible || !config) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.cardContainer}>
          {/* Header Row: Bell Icon + Title + Close Button */}
          <View style={styles.headerRow}>
            <View style={styles.titleWithIcon}>
              <AppIcon name="bell" size={18} color="#38BDF8" />
              <Text style={styles.headerTitle}>{config.title || "[ INFO ]"}</Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Tutup pengumuman"
              onPress={handleDismiss}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <AppIcon name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <ScrollView
            style={styles.contentScrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {config.content.split("\n").map((line, idx) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <View key={idx} style={styles.emptyLineSpacer} />;
              }

              // Format baris bullet points (dimulai dengan • atau - atau *)
              const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*");
              if (isBullet) {
                const bulletText = trimmed.replace(/^[•\-\*]\s*/, "");
                return (
                  <View key={idx} style={styles.bulletRow}>
                    <Text style={styles.bulletSymbol}>•</Text>
                    <Text style={styles.bulletText}>{bulletText}</Text>
                  </View>
                );
              }

              return (
                <Text key={idx} style={styles.paragraphText}>
                  {line}
                </Text>
              );
            })}
          </ScrollView>

          {/* Version Tag */}
          {Boolean(config.versionTag) && (
            <View style={styles.versionContainer}>
              <Text style={styles.versionTagText}>{config.versionTag}</Text>
            </View>
          )}

          {/* DUAL LIQUID GLASS BUTTONS (HOME BANNER THEME) */}
          <View style={styles.glassActionsRow}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={config.buttonText || "Tonton Sekarang"}
              onPress={handleAction}
              style={styles.glassBtnPrimary}
              activeOpacity={0.78}
            >
              <AppIcon name="play" size={14} color="#FFFFFF" />
              <Text style={styles.glassBtnTextPrimary} numberOfLines={1}>
                {config.buttonText || "Tonton Sekarang"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={config.secondaryButtonText || "Detail"}
              onPress={handleSecondaryAction}
              style={styles.glassBtnSecondary}
              activeOpacity={0.78}
            >
              <AppIcon name="information" size={15} color="#E2E8F0" />
              <Text style={styles.glassBtnTextSecondary} numberOfLines={1}>
                {config.secondaryButtonText || "Detail"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  cardContainer: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#111A2E",
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#1E293B",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  titleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  contentScrollView: {
    maxHeight: 280,
    marginBottom: 14,
  },
  contentContainer: {
    paddingVertical: 2,
  },
  emptyLineSpacer: {
    height: 10,
  },
  paragraphText: {
    fontSize: 13.5,
    lineHeight: 21,
    color: "#E2E8F0",
    fontWeight: "500",
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
    paddingLeft: 4,
  },
  bulletSymbol: {
    fontSize: 14,
    color: "#38BDF8",
    marginRight: 8,
    lineHeight: 20,
    fontWeight: "800",
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "#CBD5E1",
    fontWeight: "500",
  },
  versionContainer: {
    marginBottom: 16,
  },
  versionTagText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#38BDF8",
    letterSpacing: 0.3,
  },
  glassActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    marginTop: 6,
  },
  glassBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "rgba(255, 255, 255, 0.13)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        cursor: "pointer",
      } as any)
      : {}),
  },
  glassBtnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        cursor: "pointer",
      } as any)
      : {}),
  },
  glassBtnTextPrimary: {
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  glassBtnTextSecondary: {
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
    fontSize: 13,
    fontWeight: "700",
    color: "#E2E8F0",
    letterSpacing: 0.3,
  },
});
