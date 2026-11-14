import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "@/components/app-icon";
import { hapticLight } from "@/lib/haptics";
import {
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
  LegalDocument,
} from "@/constants/legal-content";

interface LegalModalProps {
  visible: boolean;
  initialDoc?: "terms" | "privacy";
  onClose: () => void;
}

export function LegalModal({
  visible,
  initialDoc = "terms",
  onClose,
}: LegalModalProps) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">(initialDoc);

  useEffect(() => {
    if (visible && initialDoc) {
      setActiveTab(initialDoc);
    }
  }, [visible, initialDoc]);

  const currentDoc: LegalDocument =
    activeTab === "terms" ? TERMS_OF_SERVICE : PRIVACY_POLICY;

  const handleClose = () => {
    hapticLight();
    onClose();
  };

  const handleSwitchTab = (tab: "terms" | "privacy") => {
    if (activeTab !== tab) {
      hapticLight();
      setActiveTab(tab);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      transparent={false}
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0E17" />

        {/* ─── STICKY HEADER ─── */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerTopRow}>
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Kembali ke halaman sebelumnya"
            >
              <AppIcon name="arrow-left" size={20} color="#F8FAFC" />
              <Text style={styles.backButtonText}>Kembali</Text>
            </Pressable>

            <View style={styles.headerCenter}>
              <Text style={styles.headerEyebrow}>NUENIME · LEGAL</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {activeTab === "terms" ? "Terms of Service" : "Privacy Policy"}
              </Text>
            </View>

            <Pressable
              onPress={handleClose}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeIconBtn,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Tutup"
            >
              <AppIcon name="close" size={20} color="#94A3B8" />
            </Pressable>
          </View>

          {/* ─── TAB SWITCHER ─── */}
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => handleSwitchTab("terms")}
              style={[
                styles.tabItem,
                activeTab === "terms" && styles.tabItemActive,
              ]}
            >
              <AppIcon
                name="file-document-outline"
                size={16}
                color={activeTab === "terms" ? "#38BDF8" : "#64748B"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "terms" && styles.tabTextActive,
                ]}
              >
                Terms of Service
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleSwitchTab("privacy")}
              style={[
                styles.tabItem,
                activeTab === "privacy" && styles.tabItemActive,
              ]}
            >
              <AppIcon
                name="shield-check-outline"
                size={16}
                color={activeTab === "privacy" ? "#38BDF8" : "#64748B"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "privacy" && styles.tabTextActive,
                ]}
              >
                Privacy Policy
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ─── SCROLLABLE CONTENT ─── */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 80 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Official Verification Badge */}
          <View style={styles.badgeCard}>
            <View style={styles.badgeLeft}>
              <View style={styles.badgeIconWrap}>
                <AppIcon name="shield-check-outline" size={18} color="#38BDF8" />
              </View>
              <View>
                <Text style={styles.badgeTitle}>Dokumen Resmi Nuenime</Text>
                <Text style={styles.badgeSubtitle}>
                  Terakhir diperbarui: {currentDoc.lastUpdated}
                </Text>
              </View>
            </View>
            <View style={styles.statusPill}>
              <View style={styles.greenPulseDot} />
              <Text style={styles.statusPillText}>Aktif</Text>
            </View>
          </View>

          {/* Summary Quote Box */}
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>{currentDoc.summary}</Text>
          </View>

          {/* Render All Sections */}
          <View style={styles.sectionsList}>
            {currentDoc.sections.map((sec, idx) => {
              const numStr = idx + 1 < 10 ? `0${idx + 1}` : `${idx + 1}`;
              return (
                <View key={sec.title + idx} style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.numberBadge}>
                      <Text style={styles.numberBadgeText}>{numStr}</Text>
                    </View>
                    <Text style={styles.sectionTitle}>{sec.title}</Text>
                  </View>
                  <Text style={styles.sectionBody}>{sec.content}</Text>
                </View>
              );
            })}
          </View>

          {/* Contact Box */}
          <View style={styles.contactCard}>
            <Text style={styles.contactTitle}>Pertanyaan atau Bantuan?</Text>
            <Text style={styles.contactDesc}>
              Jika kamu memiliki pertanyaan mengenai {currentDoc.title} atau ingin mengajukan hak cipta/data pribadi:
            </Text>
            <View style={styles.emailPill}>
              <Text style={styles.emailText}>Email: {currentDoc.contactEmail}</Text>
            </View>
          </View>
        </ScrollView>

        {/* ─── FIXED BOTTOM BUTTON ─── */}
        <View
          style={[
            styles.bottomStickyBar,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.understandButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Saya Mengerti"
          >
            <Text style={styles.understandButtonText}>Saya Mengerti</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E17",
  },
  header: {
    backgroundColor: "rgba(11, 14, 23, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 20,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        } as any)
      : {}),
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  backButtonText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#F8FAFC",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerEyebrow: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 10,
    color: "#38BDF8",
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#F1F5F9",
  },
  closeIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  // Tab switcher
  tabBar: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 12,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabItemActive: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  tabText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 13,
    color: "#64748B",
  },
  tabTextActive: {
    fontFamily: "Nunito-Bold",
    color: "#F1F5F9",
  },

  // Scroll Content
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Badge Card
  badgeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.18)",
    padding: 12,
    marginBottom: 14,
  },
  badgeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badgeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#F1F5F9",
  },
  badgeSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  statusPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#4ADE80",
  },

  // Summary Box
  summaryBox: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderLeftWidth: 3,
    borderLeftColor: "#38BDF8",
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
  },
  summaryText: {
    fontFamily: "Nunito-Medium",
    fontSize: 12.5,
    lineHeight: 19,
    color: "#CBD5E1",
  },

  // Sections
  sectionsList: {
    gap: 14,
  },
  sectionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  numberBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  numberBadgeText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 11,
    color: "#38BDF8",
  },
  sectionTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14.5,
    color: "#F8FAFC",
    flex: 1,
  },
  sectionBody: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    lineHeight: 21,
    color: "#94A3B8",
  },

  // Contact
  contactCard: {
    marginTop: 18,
    backgroundColor: "rgba(30, 41, 59, 0.4)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    alignItems: "center",
  },
  contactTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#F8FAFC",
    marginBottom: 4,
  },
  contactDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    lineHeight: 18,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 10,
  },
  emailPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(56, 189, 248, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  emailText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
  },

  // Bottom Sticky Bar
  bottomStickyBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(11, 14, 23, 0.92)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 16,
    paddingTop: 10,
    zIndex: 30,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        } as any)
      : {}),
  },
  understandButton: {
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  understandButtonText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 14.5,
    color: "#0B0E17",
  },
});

