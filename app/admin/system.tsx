import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Modal,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  type AdminUser,
  type AppReleaseConfig,
  type MaintenanceModeConfig,
  type BroadcastNotification,
  getAdminAppReleaseConfig,
  saveAdminAppReleaseConfig,
  getAdminMaintenanceConfig,
  saveAdminMaintenanceConfig,
  getAdminBroadcasts,
  sendAdminBroadcast,
} from "@/lib/admin-service";
import { AppIcon } from "@/components/app-icon";

export default function AdminSystemScreen() {
  const [activeTab, setActiveTab] = useState<"apk" | "maintenance" | "broadcast">("apk");
  const [releaseConfig, setReleaseConfig] = useState<AppReleaseConfig>({
    version: "0.0.1",
    apkUrl: "https://github.com/nuenimegrup-png/NuenimeApp.git",
    changelog: "Pembaruan perdana Nuenime dengan fitur Avatar Borders & Dylan Crystal Store.",
    forceUpdate: false,
    minVersion: "0.0.1",
  });
  const [maintenanceConfig, setMaintenanceConfig] = useState<MaintenanceModeConfig>({
    isActive: false,
    message: "Server sedang dalam pemeliharaan berkala untuk peningkatan performa.",
  });
  const [broadcasts, setBroadcasts] = useState<BroadcastNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Broadcast Form State
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastType, setBroadcastType] = useState<BroadcastNotification["type"]>("system");
  const [broadcastUrl, setBroadcastUrl] = useState("");
  const [isSending, setIsSending] = useState(false);

  const currentAdmin: AdminUser = {
    id: "admin-master",
    email: "superadmin@nuenime.com",
    username: "Nuenime Lead Admin",
    role: "super_admin",
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rConf, mConf, bList] = await Promise.all([
        getAdminAppReleaseConfig(),
        getAdminMaintenanceConfig(),
        getAdminBroadcasts(),
      ]);
      setReleaseConfig(rConf);
      setMaintenanceConfig(mConf);
      setBroadcasts(bList);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveApkRelease = async () => {
    await saveAdminAppReleaseConfig(releaseConfig, currentAdmin);
    setFeedback("Konfigurasi rilis APK berhasil disimpan!");
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSaveMaintenance = async () => {
    await saveAdminMaintenanceConfig(maintenanceConfig, currentAdmin);
    setFeedback("Status Pemeliharaan Sistem berhasil diperbarui!");
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      alert("Judul dan pesan notifikasi wajib diisi!");
      return;
    }
    setIsSending(true);
    try {
      const newBc = await sendAdminBroadcast({
        title: broadcastTitle,
        message: broadcastMessage,
        type: broadcastType,
        actionUrl: broadcastUrl || undefined,
        admin: currentAdmin,
      });
      setBroadcasts([newBc, ...broadcasts]);
      setBroadcastTitle("");
      setBroadcastMessage("");
      setBroadcastUrl("");
      setFeedback(`Notifikasi berhasil disiarkan ke ${newBc.recipientsCount} pengguna!`);
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AdminLayout activeKey="system" title="System & APK Update">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>System, APK Update & Maintenance</Text>
            <Text style={styles.subtitle}>
              Pusat kendali rilis aplikasi Android, status server, dan siaran pengumuman massal.
            </Text>
          </View>

          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === "apk" && styles.tabButtonActive]}
              onPress={() => setActiveTab("apk")}
            >
              <AppIcon name="cellphone" size={16} color={activeTab === "apk" ? "#8C57FF" : "#94A3B8"} />
              <Text style={[styles.tabText, activeTab === "apk" && styles.tabTextActive]}>
                Rilis APK
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === "maintenance" && styles.tabButtonActive]}
              onPress={() => setActiveTab("maintenance")}
            >
              <AppIcon name="shield-alert-outline" size={16} color={activeTab === "maintenance" ? "#EF4444" : "#94A3B8"} />
              <Text style={[styles.tabText, activeTab === "maintenance" && styles.tabTextActive]}>
                Maintenance Mode
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === "broadcast" && styles.tabButtonActive]}
              onPress={() => setActiveTab("broadcast")}
            >
              <AppIcon name="bell" size={16} color={activeTab === "broadcast" ? "#38BDF8" : "#94A3B8"} />
              <Text style={[styles.tabText, activeTab === "broadcast" && styles.tabTextActive]}>
                Broadcast Notifikasi
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
            {/* TAB 1: APK RELEASE CONFIG */}
            {activeTab === "apk" && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>Pengaturan Rilis Versi APK Nuenime</Text>
                    <Text style={styles.cardDesc}>
                      Aplikasi mobile akan memeriksa versi ini saat startup untuk mendeteksi update.
                    </Text>
                  </View>
                  <View style={styles.versionBadge}>
                    <Text style={styles.versionBadgeText}>Current: v{releaseConfig.version}</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 16 }]}>
                    <Text style={styles.label}>Nomor Versi Terbaru</Text>
                    <TextInput
                      style={styles.input}
                      value={releaseConfig.version}
                      onChangeText={(val) => setReleaseConfig({ ...releaseConfig, version: val })}
                      placeholder="0.0.1"
                      placeholderTextColor="#64748B"
                    />
                    <Text style={styles.hint}>Format SemVer: Major.Minor.Patch (misal: 0.0.1)</Text>
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Versi Minimum yang Diizinkan</Text>
                    <TextInput
                      style={styles.input}
                      value={releaseConfig.minVersion}
                      onChangeText={(val) => setReleaseConfig({ ...releaseConfig, minVersion: val })}
                      placeholder="0.0.1"
                      placeholderTextColor="#64748B"
                    />
                    <Text style={styles.hint}>Versi di bawah ini otomatis dipaksa update jika Force Update aktif.</Text>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Tautan Unduh APK GitHub / Direct URL</Text>
                  <TextInput
                    style={styles.input}
                    value={releaseConfig.apkUrl}
                    onChangeText={(val) => setReleaseConfig({ ...releaseConfig, apkUrl: val })}
                    placeholder="https://github.com/nuenimegrup-png/NuenimeApp/releases/..."
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Catatan Perubahan (Changelog)</Text>
                  <TextInput
                    style={[styles.input, { height: 90, textAlignVertical: "top" }]}
                    value={releaseConfig.changelog}
                    onChangeText={(val) => setReleaseConfig({ ...releaseConfig, changelog: val })}
                    multiline
                    placeholder="Apa saja yang baru di rilis ini..."
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleTitle}>Wajibkan Pembaruan (Force Update)</Text>
                    <Text style={styles.toggleDesc}>
                      Jika aktif, pengguna aplikasi lama tidak dapat menutup dialog pembaruan hingga mengunduh APK baru.
                    </Text>
                  </View>
                  <Switch
                    value={releaseConfig.forceUpdate}
                    onValueChange={(val) => setReleaseConfig({ ...releaseConfig, forceUpdate: val })}
                    thumbColor={releaseConfig.forceUpdate ? "#8C57FF" : "#94A3B8"}
                    trackColor={{ false: "#14121F", true: "rgba(140, 87, 255, 0.4)" }}
                  />
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveApkRelease}>
                  <AppIcon name="check-circle" size={16} color="#FFF" />
                  <Text style={styles.saveBtnText}>Simpan Konfigurasi APK</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* TAB 2: MAINTENANCE MODE */}
            {activeTab === "maintenance" && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>Status Pemeliharaan Sistem (Maintenance Mode)</Text>
                    <Text style={styles.cardDesc}>
                      Saat aktif, aplikasi Nuenime akan menampilkan layar pemeliharaan penuh dan menolak akses publik.
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statusAlertCard,
                    maintenanceConfig.isActive ? styles.maintActiveBg : styles.maintInactiveBg,
                  ]}
                >
                  <AppIcon
                    name="shield-alert-outline"
                    size={24}
                    color={maintenanceConfig.isActive ? "#EF4444" : "#10B981"}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.maintStatusTitle}>
                      {maintenanceConfig.isActive
                        ? "SISTEM SEDANG DALAM PEMELIHARAAN (PUBLIC LOCKED)"
                        : "SISTEM BERJALAN NORMAL (PUBLIC ACCESSIBLE)"}
                    </Text>
                    <Text style={styles.maintStatusDesc}>
                      {maintenanceConfig.isActive
                        ? "Hanya administrator terdaftar yang dapat mengakses data."
                        : "Semua penonton dan pengguna dapat mengakses aplikasi secara lancar."}
                    </Text>
                  </View>
                  <Switch
                    value={maintenanceConfig.isActive}
                    onValueChange={(val) =>
                      setMaintenanceConfig({ ...maintenanceConfig, isActive: val })
                    }
                    thumbColor={maintenanceConfig.isActive ? "#EF4444" : "#94A3B8"}
                    trackColor={{ false: "#14121F", true: "rgba(239, 68, 68, 0.4)" }}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Pesan Pemeliharaan untuk Pengguna</Text>
                  <TextInput
                    style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                    value={maintenanceConfig.message}
                    onChangeText={(val) =>
                      setMaintenanceConfig({ ...maintenanceConfig, message: val })
                    }
                    multiline
                    placeholder="Contoh: Kami sedang meningkatkan performa server. Harap kembali pukul 02:00 WIB."
                    placeholderTextColor="#64748B"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: "#EF4444" }]}
                  onPress={handleSaveMaintenance}
                >
                  <AppIcon name="check-circle" size={16} color="#FFF" />
                  <Text style={styles.saveBtnText}>Terapkan Status Maintenance</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* TAB 3: BROADCAST NOTIFICATIONS */}
            {activeTab === "broadcast" && (
              <View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Kirim Siaran Notifikasi Massal</Text>
                  <Text style={styles.cardDesc}>
                    Pesan akan dikirim langsung ke tab pemberitahuan akun seluruh pengguna Nuenime.
                  </Text>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Judul Notifikasi</Text>
                    <TextInput
                      style={styles.input}
                      value={broadcastTitle}
                      onChangeText={setBroadcastTitle}
                      placeholder="Contoh: Event Rate-Up Gacha & Bonus Crystal!"
                      placeholderTextColor="#64748B"
                    />
                  </View>

                  <View style={styles.row}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
                      <Text style={styles.label}>Tipe Pesan</Text>
                      <View style={styles.typeSelector}>
                        {(["system", "promo", "maintenance", "event"] as const).map((t) => (
                          <TouchableOpacity
                            key={t}
                            style={[
                              styles.typeBtn,
                              broadcastType === t && styles.typeBtnActive,
                            ]}
                            onPress={() => setBroadcastType(t)}
                          >
                            <Text
                              style={[
                                styles.typeBtnText,
                                broadcastType === t && styles.typeBtnTextActive,
                              ]}
                            >
                              {t.toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Tautan Tindakan (Optional)</Text>
                      <TextInput
                        style={styles.input}
                        value={broadcastUrl}
                        onChangeText={setBroadcastUrl}
                        placeholder="/store/gacha atau https://..."
                        placeholderTextColor="#64748B"
                      />
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Isi Pesan</Text>
                    <TextInput
                      style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                      value={broadcastMessage}
                      onChangeText={setBroadcastMessage}
                      multiline
                      placeholder="Tuliskan detail pengumuman atau instruksi untuk pengguna..."
                      placeholderTextColor="#64748B"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.saveBtn, isSending && { opacity: 0.6 }]}
                    onPress={handleSendBroadcast}
                    disabled={isSending}
                  >
                    <AppIcon name="send" size={16} color="#FFF" />
                    <Text style={styles.saveBtnText}>
                      {isSending ? "Mengirimkan Siaran..." : "Kirim Siaran Sekarang"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* History Broadcasts */}
                <View style={[styles.card, { marginTop: 24 }]}>
                  <View style={styles.historyHeader}>
                    <AppIcon name="history" size={18} color="#CBD5E1" />
                    <Text style={styles.historyTitle}>Riwayat Siaran Terkirim ({broadcasts.length})</Text>
                  </View>

                  {broadcasts.length === 0 ? (
                    <Text style={styles.emptyText}>Belum ada riwayat siaran yang dikirim.</Text>
                  ) : (
                    broadcasts.map((b) => (
                      <View key={b.id} style={styles.historyItem}>
                        <View style={styles.historyMeta}>
                          <View style={styles.historyBadge}>
                            <Text style={styles.historyBadgeText}>{b.type.toUpperCase()}</Text>
                          </View>
                          <Text style={styles.historyTime}>
                            {new Date(b.createdAt).toLocaleString("id-ID")}
                          </Text>
                          <Text style={styles.historyCount}>
                            Kepada: {b.recipientsCount} Akun
                          </Text>
                        </View>
                        <Text style={styles.historyItemTitle}>{b.title}</Text>
                        <Text style={styles.historyItemMessage}>{b.message}</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}
          </>
        )}
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
  card: {
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.15)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
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
  },
  versionBadge: {
    backgroundColor: "rgba(140, 87, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#8C57FF",
  },
  versionBadgeText: {
    color: "#8C57FF",
    fontWeight: "700",
    fontSize: 13,
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
    padding: 12,
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#14121F",
    padding: 16,
    borderRadius: 8,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F8FAFC",
  },
  toggleDesc: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
    maxWidth: 550,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#8C57FF",
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 12,
  },
  saveBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  statusAlertCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
  },
  maintActiveBg: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#EF4444",
  },
  maintInactiveBg: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
  },
  maintStatusTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  maintStatusDesc: {
    fontSize: 12,
    color: "#CBD5E1",
    marginTop: 2,
  },
  typeSelector: {
    flexDirection: "row",
    gap: 8,
  },
  typeBtn: {
    backgroundColor: "#14121F",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  typeBtnActive: {
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    borderColor: "#38BDF8",
  },
  typeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
  },
  typeBtnTextActive: {
    color: "#38BDF8",
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 13,
    fontStyle: "italic",
  },
  historyItem: {
    backgroundColor: "#14121F",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  historyMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  historyBadge: {
    backgroundColor: "rgba(140, 87, 255, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyBadgeText: {
    color: "#8C57FF",
    fontSize: 10,
    fontWeight: "700",
  },
  historyTime: {
    fontSize: 12,
    color: "#64748B",
  },
  historyCount: {
    fontSize: 12,
    color: "#38BDF8",
    marginLeft: "auto",
  },
  historyItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  historyItemMessage: {
    fontSize: 13,
    color: "#94A3B8",
    lineHeight: 18,
  },
});
