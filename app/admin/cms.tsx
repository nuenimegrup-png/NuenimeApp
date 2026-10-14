import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  type AdminUser,
  type SpotlightItem,
  type BrokenStreamReport,
  type StreamTrackConfig,
  getAdminSpotlights,
  saveAdminSpotlight,
  deleteAdminSpotlight,
  getAdminBrokenStreamReports,
  updateBrokenStreamReportStatus,
  getAdminStreamTrackConfig,
  saveAdminStreamTrackConfig,
} from "@/lib/admin-service";
import { AppIcon } from "@/components/app-icon";

export default function AdminCmsScreen() {
  const [activeTab, setActiveTab] = useState<"spotlight" | "broken_streams" | "servers">("spotlight");
  const [spotlights, setSpotlights] = useState<SpotlightItem[]>([]);
  const [brokenReports, setBrokenReports] = useState<BrokenStreamReport[]>([]);
  const [streamConfig, setStreamConfig] = useState<StreamTrackConfig>({
    primaryTrack: "track4",
    backupTrack: "track6",
    autoFallback: true,
    hlsBufferMs: 4000,
    cdnGeoRouting: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modal State Spotlight
  const [isSpotlightModalOpen, setIsSpotlightModalOpen] = useState(false);
  const [editingSpotlight, setEditingSpotlight] = useState<Partial<SpotlightItem>>({
    animeId: 1,
    title: "",
    posterUrl: "",
    bannerUrl: "",
    synopsis: "",
    category: "spotlight",
    sortOrder: 1,
    isActive: true,
  });

  const currentAdmin: AdminUser = {
    id: "admin-master",
    email: "superadmin@nuenime.com",
    username: "Nuenime Lead Admin",
    role: "super_admin",
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [spots, reports, sConf] = await Promise.all([
        getAdminSpotlights(),
        getAdminBrokenStreamReports(),
        getAdminStreamTrackConfig(),
      ]);
      setSpotlights(spots);
      setBrokenReports(reports);
      setStreamConfig(sConf);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSpotlight = async () => {
    if (!editingSpotlight.title || !editingSpotlight.posterUrl) {
      alert("Judul dan Poster URL wajib diisi!");
      return;
    }
    const item: SpotlightItem = {
      id: editingSpotlight.id || `spot-${Date.now()}`,
      animeId: editingSpotlight.animeId || 100,
      title: editingSpotlight.title,
      posterUrl: editingSpotlight.posterUrl,
      bannerUrl: editingSpotlight.bannerUrl || editingSpotlight.posterUrl,
      synopsis: editingSpotlight.synopsis || "",
      category: editingSpotlight.category || "spotlight",
      sortOrder: editingSpotlight.sortOrder || 1,
      isActive: editingSpotlight.isActive ?? true,
    };
    const updated = await saveAdminSpotlight(item, currentAdmin);
    setSpotlights(updated);
    setIsSpotlightModalOpen(false);
    setFeedback("Konten anime spotlight berhasil disimpan ke beranda!");
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDeleteSpotlight = async (id: string) => {
    if (confirm("Hapus item spotlight ini dari beranda?")) {
      const updated = await deleteAdminSpotlight(id, currentAdmin);
      setSpotlights(updated);
    }
  };

  const handleUpdateReportStatus = async (id: string, status: BrokenStreamReport["status"]) => {
    const updated = await updateBrokenStreamReportStatus(id, status, currentAdmin);
    setBrokenReports(updated);
    setFeedback(`Status laporan diubah menjadi: ${status}`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSaveServerConfig = async () => {
    await saveAdminStreamTrackConfig(streamConfig, currentAdmin);
    setFeedback("Prioritas server streaming berhasil diperbarui!");
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <AdminLayout activeKey="cms" title="Anime CMS & Streaming">
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header & Tabs */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Anime CMS & Streaming Server</Text>
            <Text style={styles.subtitle}>
              Kelola spotlight beranda, pantau laporan broken stream, dan atur prioritas Track video.
            </Text>
          </View>

          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === "spotlight" && styles.tabButtonActive]}
              onPress={() => setActiveTab("spotlight")}
            >
              <AppIcon name="sparkles" size={16} color={activeTab === "spotlight" ? "#8C57FF" : "#94A3B8"} />
              <Text style={[styles.tabText, activeTab === "spotlight" && styles.tabTextActive]}>
                Spotlight & Carousel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === "broken_streams" && styles.tabButtonActive]}
              onPress={() => setActiveTab("broken_streams")}
            >
              <AppIcon name="alert-circle-outline" size={16} color={activeTab === "broken_streams" ? "#F59E0B" : "#94A3B8"} />
              <Text style={[styles.tabText, activeTab === "broken_streams" && styles.tabTextActive]}>
                Laporan Rusak ({brokenReports.filter((r) => r.status === "pending").length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === "servers" && styles.tabButtonActive]}
              onPress={() => setActiveTab("servers")}
            >
              <AppIcon name="wifi" size={16} color={activeTab === "servers" ? "#38BDF8" : "#94A3B8"} />
              <Text style={[styles.tabText, activeTab === "servers" && styles.tabTextActive]}>
                Server & Prioritas Track
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {feedback && (
          <View style={styles.feedbackBanner}>
            <AppIcon name="check-circle" size={18} color="#10B981" />
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator size="large" color="#8C57FF" style={{ marginVertical: 40 }} />
        ) : (
          <>
            {/* TAB 1: SPOTLIGHT & CAROUSEL */}
            {activeTab === "spotlight" && (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Daftar Spotlight Beranda ({spotlights.length})</Text>
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => {
                      setEditingSpotlight({
                        animeId: 100,
                        title: "",
                        posterUrl: "",
                        bannerUrl: "",
                        synopsis: "",
                        category: "spotlight",
                        sortOrder: spotlights.length + 1,
                        isActive: true,
                      });
                      setIsSpotlightModalOpen(true);
                    }}
                  >
                    <AppIcon name="plus" size={16} color="#FFF" />
                    <Text style={styles.addBtnText}>Tambah Anime Spotlight</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.grid}>
                  {spotlights.map((item) => (
                    <View key={item.id} style={styles.spotCard}>
                      <Image source={{ uri: item.posterUrl }} style={styles.spotPoster} />
                      <View style={styles.spotInfo}>
                        <View style={styles.spotBadgeRow}>
                          <View
                            style={[
                              styles.catBadge,
                              item.category === "trending" && { backgroundColor: "rgba(239, 68, 68, 0.2)" },
                              item.category === "featured" && { backgroundColor: "rgba(56, 189, 248, 0.2)" },
                            ]}
                          >
                            <Text
                              style={[
                                styles.catBadgeText,
                                item.category === "trending" && { color: "#F87171" },
                                item.category === "featured" && { color: "#38BDF8" },
                              ]}
                            >
                              {item.category.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.orderText}>Urutan #{item.sortOrder}</Text>
                        </View>
                        <Text style={styles.spotTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.spotSynopsis} numberOfLines={2}>
                          {item.synopsis || "Tidak ada sinopsis."}
                        </Text>

                        <View style={styles.spotActions}>
                          <TouchableOpacity
                            style={styles.editBtn}
                            onPress={() => {
                              setEditingSpotlight(item);
                              setIsSpotlightModalOpen(true);
                            }}
                          >
                            <Text style={styles.editBtnText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => handleDeleteSpotlight(item.id)}
                          >
                            <AppIcon name="trash-can-outline" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* TAB 2: BROKEN STREAM REPORTS */}
            {activeTab === "broken_streams" && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Laporan Link Streaming Rusak</Text>
                <Text style={styles.cardDesc}>
                  Laporan dari penonton yang mengalami buffering, audio rusak, atau error 404 pada server streaming.
                </Text>

                <View style={styles.table}>
                  <View style={styles.thRow}>
                    <Text style={[styles.th, { flex: 1.5 }]}>Anime & Episode</Text>
                    <Text style={[styles.th, { flex: 1.2 }]}>Server / Track</Text>
                    <Text style={[styles.th, { flex: 2 }]}>Kendala</Text>
                    <Text style={[styles.th, { flex: 1 }]}>Pelapor</Text>
                    <Text style={[styles.th, { flex: 1 }]}>Status</Text>
                    <Text style={[styles.th, { flex: 1.5, textAlign: "right" }]}>Aksi Penanganan</Text>
                  </View>

                  {brokenReports.map((r) => (
                    <View key={r.id} style={styles.trRow}>
                      <View style={{ flex: 1.5 }}>
                        <Text style={styles.boldText}>{r.animeTitle}</Text>
                        <Text style={styles.subText}>Episode {r.episodeNumber}</Text>
                      </View>
                      <View style={{ flex: 1.2 }}>
                        <Text style={styles.serverBadge}>{r.serverName}</Text>
                      </View>
                      <View style={{ flex: 2 }}>
                        <Text style={styles.issueText}>{r.issueDescription}</Text>
                        <Text style={styles.timeText}>{new Date(r.createdAt).toLocaleString("id-ID")}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reporterText}>@{r.reporter}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View
                          style={[
                            styles.statusPill,
                            r.status === "fixed" && styles.statusFixed,
                            r.status === "investigating" && styles.statusInvestigating,
                            r.status === "pending" && styles.statusPending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              r.status === "fixed" && { color: "#10B981" },
                              r.status === "investigating" && { color: "#38BDF8" },
                              r.status === "pending" && { color: "#F59E0B" },
                            ]}
                          >
                            {r.status}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.actionRow, { flex: 1.5, justifyContent: "flex-end" }]}>
                        {r.status !== "fixed" && (
                          <TouchableOpacity
                            style={styles.fixBtn}
                            onPress={() => handleUpdateReportStatus(r.id, "fixed")}
                          >
                            <AppIcon name="check" size={14} color="#FFF" />
                            <Text style={styles.fixBtnText}>Selesai</Text>
                          </TouchableOpacity>
                        )}
                        {r.status === "pending" && (
                          <TouchableOpacity
                            style={styles.investBtn}
                            onPress={() => handleUpdateReportStatus(r.id, "investigating")}
                          >
                            <Text style={styles.investBtnText}>Cek</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* TAB 3: SERVER & STREAM TRACK PRIORITIES */}
            {activeTab === "servers" && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Konfigurasi Server & Prioritas Track Video</Text>
                <Text style={styles.cardDesc}>
                  Nuenime mendukung multi-track HLS (Track 4 dan Track 6) untuk memastikan streaming lancar tanpa lag.
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Track Prioritas Utama (Primary)</Text>
                  <View style={styles.radioGroup}>
                    <TouchableOpacity
                      style={[
                        styles.radioOption,
                        streamConfig.primaryTrack === "track4" && styles.radioActive,
                      ]}
                      onPress={() => setStreamConfig({ ...streamConfig, primaryTrack: "track4" })}
                    >
                      <Text
                        style={[
                          styles.radioText,
                          streamConfig.primaryTrack === "track4" && styles.radioTextActive,
                        ]}
                      >
                        Track 4 (High Definition - Direct Fast)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.radioOption,
                        streamConfig.primaryTrack === "track6" && styles.radioActive,
                      ]}
                      onPress={() => setStreamConfig({ ...streamConfig, primaryTrack: "track6" })}
                    >
                      <Text
                        style={[
                          styles.radioText,
                          streamConfig.primaryTrack === "track6" && styles.radioTextActive,
                        ]}
                      >
                        Track 6 (Full HD - Multi-CDN Adaptive)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Track Cadangan (Fallback)</Text>
                  <View style={styles.radioGroup}>
                    <TouchableOpacity
                      style={[
                        styles.radioOption,
                        streamConfig.backupTrack === "track6" && styles.radioActive,
                      ]}
                      onPress={() => setStreamConfig({ ...streamConfig, backupTrack: "track6" })}
                    >
                      <Text
                        style={[
                          styles.radioText,
                          streamConfig.backupTrack === "track6" && styles.radioTextActive,
                        ]}
                      >
                        Track 6 (Cadangan)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.radioOption,
                        streamConfig.backupTrack === "track4" && styles.radioActive,
                      ]}
                      onPress={() => setStreamConfig({ ...streamConfig, backupTrack: "track4" })}
                    >
                      <Text
                        style={[
                          styles.radioText,
                          streamConfig.backupTrack === "track4" && styles.radioTextActive,
                        ]}
                      >
                        Track 4 (Cadangan)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 16 }]}>
                    <Text style={styles.label}>HLS Buffer (Millisecond)</Text>
                    <TextInput
                      style={styles.input}
                      value={String(streamConfig.hlsBufferMs)}
                      onChangeText={(val) =>
                        setStreamConfig({ ...streamConfig, hlsBufferMs: parseInt(val, 10) || 4000 })
                      }
                      keyboardType="numeric"
                    />
                    <Text style={styles.hint}>Rekomendasi: 4000ms untuk koneksi seluler Indonesia.</Text>
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Auto Fallback Saat Buffering</Text>
                    <TouchableOpacity
                      style={[
                        styles.toggleBtn,
                        streamConfig.autoFallback ? styles.toggleOn : styles.toggleOff,
                      ]}
                      onPress={() =>
                        setStreamConfig({ ...streamConfig, autoFallback: !streamConfig.autoFallback })
                      }
                    >
                      <Text style={styles.toggleText}>
                        {streamConfig.autoFallback ? "Aktif (Otomatis ganti server jika lag)" : "Nonaktif"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveServerConfig}>
                  <AppIcon name="check-circle" size={16} color="#FFF" />
                  <Text style={styles.saveBtnText}>Simpan Pengaturan Streaming</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* MODAL EDIT / TAMBAH SPOTLIGHT */}
        <Modal visible={isSpotlightModalOpen} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {editingSpotlight.id ? "Edit Anime Spotlight" : "Tambah Anime Spotlight Baru"}
              </Text>

              <View style={styles.modalForm}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Judul Anime</Text>
                  <TextInput
                    style={styles.input}
                    value={editingSpotlight.title}
                    onChangeText={(val) => setEditingSpotlight({ ...editingSpotlight, title: val })}
                    placeholder="Contoh: Jujutsu Kaisen Season 2"
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Poster URL</Text>
                  <TextInput
                    style={styles.input}
                    value={editingSpotlight.posterUrl}
                    onChangeText={(val) => setEditingSpotlight({ ...editingSpotlight, posterUrl: val })}
                    placeholder="https://..."
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Banner Background URL</Text>
                  <TextInput
                    style={styles.input}
                    value={editingSpotlight.bannerUrl}
                    onChangeText={(val) => setEditingSpotlight({ ...editingSpotlight, bannerUrl: val })}
                    placeholder="https://..."
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
                    <Text style={styles.label}>Kategori</Text>
                    <View style={styles.categorySelect}>
                      {(["spotlight", "featured", "trending", "editors_choice"] as const).map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[
                            styles.catBtn,
                            editingSpotlight.category === c && styles.catBtnActive,
                          ]}
                          onPress={() => setEditingSpotlight({ ...editingSpotlight, category: c })}
                        >
                          <Text
                            style={[
                              styles.catBtnText,
                              editingSpotlight.category === c && styles.catBtnTextActive,
                            ]}
                          >
                            {c}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.formGroup, { flex: 0.5 }]}>
                    <Text style={styles.label}>Urutan</Text>
                    <TextInput
                      style={styles.input}
                      value={String(editingSpotlight.sortOrder || 1)}
                      onChangeText={(val) =>
                        setEditingSpotlight({ ...editingSpotlight, sortOrder: parseInt(val, 10) || 1 })
                      }
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Sinopsis Singkat</Text>
                  <TextInput
                    style={[styles.input, { height: 70, textAlignVertical: "top" }]}
                    value={editingSpotlight.synopsis}
                    onChangeText={(val) => setEditingSpotlight({ ...editingSpotlight, synopsis: val })}
                    multiline
                    placeholder="Sinopsis anime..."
                    placeholderTextColor="#64748B"
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsSpotlightModalOpen(false)}
                >
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveSpotlight}>
                  <Text style={styles.confirmBtnText}>Simpan Spotlight</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  subtitle: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 4,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#211D36",
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.2)",
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: "rgba(140, 87, 255, 0.2)",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
  tabTextActive: {
    color: "#F8FAFC",
  },
  feedbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10B981",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  feedbackText: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#8C57FF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  spotCard: {
    width: "32%",
    minWidth: 280,
    backgroundColor: "#211D36",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.15)",
  },
  spotPoster: {
    width: "100%",
    height: 160,
    backgroundColor: "#14121F",
  },
  spotInfo: {
    padding: 14,
  },
  spotBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  catBadge: {
    backgroundColor: "rgba(140, 87, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8C57FF",
  },
  orderText: {
    fontSize: 12,
    color: "#94A3B8",
  },
  spotTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  spotSynopsis: {
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 16,
    marginBottom: 12,
  },
  spotActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingTop: 10,
  },
  editBtn: {
    backgroundColor: "rgba(140, 87, 255, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editBtnText: {
    color: "#8C57FF",
    fontSize: 13,
    fontWeight: "600",
  },
  deleteBtn: {
    padding: 6,
  },
  card: {
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.15)",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: "#94A3B8",
    marginBottom: 20,
  },
  table: {
    borderRadius: 8,
    overflow: "hidden",
  },
  thRow: {
    flexDirection: "row",
    backgroundColor: "rgba(140, 87, 255, 0.08)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  th: {
    fontSize: 12,
    fontWeight: "700",
    color: "#CBD5E1",
    textTransform: "uppercase",
  },
  trRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  boldText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F8FAFC",
  },
  subText: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  serverBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#38BDF8",
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  issueText: {
    fontSize: 13,
    color: "#F1F5F9",
    marginBottom: 2,
  },
  timeText: {
    fontSize: 11,
    color: "#64748B",
  },
  reporterText: {
    fontSize: 13,
    color: "#CBD5E1",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  statusPending: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  statusInvestigating: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  statusFixed: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  fixBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  fixBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  investBtn: {
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  investBtnText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#CBD5E1",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#14121F",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 10,
    color: "#F8FAFC",
    fontSize: 14,
  },
  hint: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
  },
  radioGroup: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  radioOption: {
    backgroundColor: "#14121F",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  radioActive: {
    borderColor: "#8C57FF",
    backgroundColor: "rgba(140, 87, 255, 0.15)",
  },
  radioText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "600",
  },
  radioTextActive: {
    color: "#F8FAFC",
  },
  toggleBtn: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  toggleOn: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
  },
  toggleOff: {
    backgroundColor: "#14121F",
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  toggleText: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "600",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#8C57FF",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  saveBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#211D36",
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.3)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 16,
  },
  modalForm: {
    marginBottom: 16,
  },
  categorySelect: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  catBtn: {
    backgroundColor: "#14121F",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  catBtnActive: {
    borderColor: "#8C57FF",
    backgroundColor: "rgba(140, 87, 255, 0.2)",
  },
  catBtnText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  catBtnTextActive: {
    color: "#8C57FF",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  cancelBtnText: {
    color: "#CBD5E1",
    fontSize: 14,
    fontWeight: "600",
  },
  confirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#8C57FF",
  },
  confirmBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
