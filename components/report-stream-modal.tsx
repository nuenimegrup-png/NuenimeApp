import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  WarningCircle,
  Lightning,
  PlayCircle,
  SpeakerSlash,
  Subtitles,
  Question,
  PaperPlaneRight,
  X,
} from "phosphor-react-native";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { submitBrokenStreamReport } from "@/lib/admin-service";

interface ReportStreamModalProps {
  visible: boolean;
  onClose: () => void;
  animeId: number;
  animeTitle: string;
  episodeNumber: number;
  serverName?: string;
  onSuccess?: () => void;
}

interface ReportCategoryItem {
  id: string;
  label: string;
  desc: string;
  IconComponent: React.ComponentType<{ size: number; color: string; weight?: "regular" | "fill" | "bold" }>;
}

const REPORT_CATEGORIES: ReportCategoryItem[] = [
  {
    id: "buffering",
    label: "Video Berat & Buffering",
    desc: "Macet terus-menerus atau loading video sangat lambat",
    IconComponent: Lightning,
  },
  {
    id: "broken",
    label: "Video Rusak / Tidak Berputar",
    desc: "Link streaming mati, layar hitam, atau error 404",
    IconComponent: PlayCircle,
  },
  {
    id: "audio",
    label: "Audio Rusak / Tidak Sinkron",
    desc: "Suara hilang, rusak, atau tidak pas dengan video",
    IconComponent: SpeakerSlash,
  },
  {
    id: "subtitle",
    label: "Subtitle Tidak Muncul / Rusak",
    desc: "Sub Indo hilang, acak, atau terlambat dari dialog",
    IconComponent: Subtitles,
  },
  {
    id: "other",
    label: "Kendala Pemutaran Lainnya",
    desc: "Masalah teknis lainnya pada server atau player",
    IconComponent: Question,
  },
];

export function ReportStreamModal({
  visible,
  onClose,
  animeId,
  animeTitle,
  episodeNumber,
  serverName = "Server 1",
  onSuccess,
}: ReportStreamModalProps) {
  const { user, profile } = useAnirakuAuth();
  const [selectedCategory, setSelectedCategory] = useState(REPORT_CATEGORIES[0].id);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) {
      hapticWarning();
      Alert.alert(
        "Keterangan Wajib Diisi",
        "Mohon berikan sedikit keterangan kendala yang Anda alami (misalnya menit berapa kendala terjadi, dsb)."
      );
      return;
    }

    setIsSubmitting(true);
    hapticLight();

    const categoryObj = REPORT_CATEGORIES.find((c) => c.id === selectedCategory);
    const fullIssueDescription = `[${categoryObj?.label || "Kendala"}] ${description.trim()}`;

    try {
      const res = await submitBrokenStreamReport({
        animeId: Number(animeId) || 0,
        animeTitle: animeTitle || "Anime",
        episodeNumber: Number(episodeNumber) || 1,
        serverName,
        issueDescription: fullIssueDescription,
        userId: user?.id || null,
      });

      setIsSubmitting(false);

      if (res.success) {
        hapticSuccess();
        Alert.alert(
          "Laporan Berhasil Terkirim",
          "Terima kasih atas bantuan Anda. Laporan kendala ini telah masuk ke dashboard admin untuk segera diperiksa dan diperbaiki.",
          [
            {
              text: "OK",
              onPress: () => {
                setDescription("");
                onClose();
                onSuccess?.();
              },
            },
          ]
        );
      } else {
        hapticWarning();
        Alert.alert("Gagal Mengirim Laporan", res.error || "Terjadi kesalahan saat menghubungkan ke server.");
      }
    } catch (err: any) {
      setIsSubmitting(false);
      hapticWarning();
      Alert.alert("Error", err?.message || "Terjadi kesalahan sistem saat mengirim laporan.");
    }
  };

  const reporterDisplay =
    profile?.display_name ||
    profile?.username ||
    (user?.email ? user.email.split("@")[0] : "Anonim (Guest)");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Liquid Glass Card Container */}
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <WarningCircle size={20} color="#F1F5F9" weight="bold" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title}>Laporkan Kendala Video</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {animeTitle} · Episode {episodeNumber}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={18} color="#94A3B8" weight="bold" />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Liquid Glass Context Box */}
            <View style={styles.contextCard}>
              <View style={styles.contextItem}>
                <Text style={styles.contextLabel}>SERVER AKTIF</Text>
                <Text style={styles.contextValue} numberOfLines={1}>
                  {serverName}
                </Text>
              </View>
              <View style={styles.contextDivider} />
              <View style={styles.contextItem}>
                <Text style={styles.contextLabel}>PELAPOR</Text>
                <Text style={[styles.contextValue, { color: "#E2E8F0" }]} numberOfLines={1}>
                  @{reporterDisplay}
                </Text>
              </View>
            </View>

            {/* Category Selection (No Emoji, Clean Vector Icons) */}
            <Text style={styles.sectionLabel}>PILIH JENIS KENDALA</Text>
            <View style={styles.categoriesWrap}>
              {REPORT_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                const { IconComponent } = cat;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => {
                      hapticLight();
                      setSelectedCategory(cat.id);
                    }}
                    style={[
                      styles.categoryCard,
                      isSelected && styles.categoryCardActive,
                    ]}
                  >
                    {/* Vector Icon Box */}
                    <View style={[styles.categoryIconWrap, isSelected && styles.categoryIconWrapActive]}>
                      <IconComponent
                        size={17}
                        color={isSelected ? "#FFFFFF" : "#94A3B8"}
                        weight={isSelected ? "fill" : "regular"}
                      />
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.categoryTitle, isSelected && styles.categoryTitleActive]}>
                        {cat.label}
                      </Text>
                      <Text style={styles.categoryDesc}>{cat.desc}</Text>
                    </View>

                    {/* Radio Indicator */}
                    <View style={[styles.categoryRadio, isSelected && styles.categoryRadioActive]}>
                      {isSelected ? <View style={styles.categoryRadioDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Description Input */}
            <Text style={styles.sectionLabel}>KETERANGAN DETAIL KENDALA</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Tuliskan keterangan detail kendala (misal: macet di menit 14:20, suara hilang, server buffering terus, dll)..."
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={3}
              style={styles.textInput}
              textAlignVertical="top"
            />
          </ScrollView>

          {/* Action Footer (Liquid Glass Style) */}
          <View style={styles.footer}>
            <Pressable
              disabled={isSubmitting}
              onPress={onClose}
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.cancelText}>Batal</Text>
            </Pressable>

            <Pressable
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.submitBtn,
                isSubmitting && { opacity: 0.6 },
                pressed && { opacity: 0.8 },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <PaperPlaneRight size={15} color="#FFFFFF" weight="fill" />
                  <Text style={styles.submitText}>Kirim Laporan</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "86%",
    backgroundColor: "rgba(22, 27, 36, 0.97)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        } as any)
      : {}),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "800",
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  contextCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  contextItem: {
    flex: 1,
  },
  contextDivider: {
    width: 1,
    height: 26,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginHorizontal: 12,
  },
  contextLabel: {
    color: "#64748B",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  contextValue: {
    color: "#F8FAFC",
    fontSize: 12.5,
    fontWeight: "700",
    marginTop: 2,
  },
  sectionLabel: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  categoriesWrap: {
    gap: 8,
    marginBottom: 16,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  categoryCardActive: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  categoryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIconWrapActive: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  categoryTitle: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "700",
  },
  categoryTitleActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  categoryDesc: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 1,
  },
  categoryRadio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryRadioActive: {
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  categoryRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  textInput: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 12,
    color: "#FFFFFF",
    fontSize: 12.5,
    lineHeight: 18,
    minHeight: 74,
    marginBottom: 16,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: "700",
  },
  submitBtn: {
    flex: 1.6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
