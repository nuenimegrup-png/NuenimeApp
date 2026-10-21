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
  Alert,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  type AdminUser,
  type AppReleaseConfig,
  type MaintenanceModeConfig,
  type BroadcastNotification,
  type AppAnnouncementConfig,
  DEFAULT_ANNOUNCEMENT_CONFIG,
  getAdminAppReleaseConfig,
  saveAdminAppReleaseConfig,
  getAdminMaintenanceConfig,
  saveAdminMaintenanceConfig,
  getAdminBroadcasts,
  sendAdminBroadcast,
  deleteAdminBroadcast,
  clearAllAdminBroadcasts,
  fetchGitHubReleaseInfo,
  getAppAnnouncementConfig,
  saveAppAnnouncementConfig,
} from "@/lib/admin-service";
import { AppIcon } from "@/components/app-icon";
import { AppAnnouncementModal } from "@/components/app-announcement-modal";

export default function AdminSystemScreen() {
  const [activeTab, setActiveTab] = useState<"apk" | "maintenance" | "broadcast" | "popup">("apk");
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
    iconUrl: "https://i.ibb.co.com/rKCB8QhB/maintenance-nuenime.png",
    primaryButtonText: "Cek Status Server",
    secondaryButtonText: "Discord Support",
    secondaryButtonUrl: "",
  });
  const [announcementConfig, setAnnouncementConfig] = useState<AppAnnouncementConfig>(DEFAULT_ANNOUNCEMENT_CONFIG);
  const [broadcasts, setBroadcasts] = useState<BroadcastNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // GitHub Auto-Sync State
  const [githubUrlInput, setGithubUrlInput] = useState("");
  const [isSyncingGithub, setIsSyncingGithub] = useState(false);
  const [githubSyncFeedback, setGithubSyncFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Announcement Modal Preview State
  const [showAnnouncementPreview, setShowAnnouncementPreview] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);

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
      const [rConf, mConf, bList, aConf] = await Promise.all([
        getAdminAppReleaseConfig(),
        getAdminMaintenanceConfig(),
        getAdminBroadcasts(),
        getAppAnnouncementConfig(),
      ]);
      setReleaseConfig(rConf);
      setMaintenanceConfig(mConf);
      setBroadcasts(bList);
      if (aConf) {
        setAnnouncementConfig(aConf);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveApkRelease = async () => {
    await saveAdminAppReleaseConfig(releaseConfig, currentAdmin);
    setFeedback("Konfigurasi rilis APK berhasil disimpan & disinkronkan ke cloud!");
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSyncFromGithub = async () => {
    if (!githubUrlInput.trim()) {
      setGithubSyncFeedback({
        success: false,
        message: "Silakan tempel tautan rilis GitHub terlebih dahulu.",
      });
      return;
    }

    setIsSyncingGithub(true);
    setGithubSyncFeedback(null);
    try {
      const info = await fetchGitHubReleaseInfo(githubUrlInput.trim());
      if (!info) {
        setGithubSyncFeedback({
          success: false,
          message: "Gagal mendeteksi rilis dari tautan GitHub. Pastikan URL valid dan repo/release bersifat publik.",
        });
        return;
      }

      setReleaseConfig((prev) => ({
        ...prev,
        version: info.version || prev.version,
        apkUrl: info.apkUrl || prev.apkUrl,
        changelog: info.changelog || prev.changelog,
      }));

      const sizeStr = info.assetSizeFormatted
        ? ` (${info.assetSizeFormatted})`
        : info.assetSize
        ? ` (${(info.assetSize / (1024 * 1024)).toFixed(1)} MB)`
        : "";
      setGithubSyncFeedback({
        success: true,
        message: `Berhasil tersinkron! Tag: v${info.version}, File APK: ${info.assetName || "APK"}${sizeStr}. Klik "Simpan Konfigurasi APK" untuk menerapkannya.`,
      });
    } catch (err: any) {
      setGithubSyncFeedback({
        success: false,
        message: err?.message || "Terjadi kesalahan saat menghubungi GitHub API.",
      });
    } finally {
      setIsSyncingGithub(false);
    }
  };

  const handleSaveMaintenance = async () => {
    await saveAdminMaintenanceConfig(maintenanceConfig, currentAdmin);
    setFeedback("Status Pemeliharaan Sistem berhasil diperbarui secara real-time!");
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSaveAnnouncement = async () => {
    setIsSavingAnnouncement(true);
    try {
      await saveAppAnnouncementConfig(announcementConfig, currentAdmin);
      setFeedback("Pop-up Pengumuman Awal berhasil disimpan & disinkronkan ke seluruh pengguna!");
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert("Gagal menyimpan pop-up: " + (err?.message || "Error"));
    } finally {
      setIsSavingAnnouncement(false);
    }
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
      setFeedback(`Notifikasi berhasil disiarkan secara real-time ke ${newBc.recipientsCount} pengguna!`);
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteBroadcast = (id: string) => {
    Alert.alert(
      "Hapus Siaran",
      "Apakah Anda yakin ingin menghapus siaran ini dari riwayat dan menghentikan notifikasi aktif ke pengguna?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAdminBroadcast(id, currentAdmin);
              setBroadcasts((prev) => prev.filter((b) => b.id !== id));
              setFeedback("Siaran berhasil dihapus dan notifikasi dihentikan!");
              setTimeout(() => setFeedback(null), 3000);
            } catch (err: any) {
              Alert.alert("Gagal", err?.message || "Gagal menghapus siaran.");
            }
          },
        },
      ]
    );
  };

  const handleClearAllBroadcasts = () => {
    Alert.alert(
      "Hapus Semua Siaran",
      "Hapus semua riwayat siaran dan bersihkan notifikasi siaran aktif?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus Semua",
          style: "destructive",
          onPress: async () => {
            try {
              await clearAllAdminBroadcasts(currentAdmin);
              setBroadcasts([]);
              setFeedback("Seluruh riwayat siaran berhasil dibersihkan!");
              setTimeout(() => setFeedback(null), 3000);
            } catch (err: any) {
              Alert.alert("Gagal", err?.message || "Gagal membersihkan riwayat siaran.");
            }
          },
        },
      ]
    );
  };

  return (
    <AdminLayout activeKey="system" title="System & APK Update">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>System, APK Update & Maintenance</Text>
            <Text style={styles.subtitle}>
              Pusat kendali rilis aplikasi Android, status server, pop-up pengumuman, dan siaran massal.
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
              style={[styles.tabButton, activeTab === "popup" && styles.tabButtonActive]}
              onPress={() => setActiveTab("popup")}
            >
              <AppIcon name="bell-ring-outline" size={16} color={activeTab === "popup" ? "#06B6D4" : "#94A3B8"} />
              <Text style={[styles.tabText, activeTab === "popup" && { color: "#06B6D4" }]}>
                Pop-up Awal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === "maintenance" && styles.tabButtonActive]}
              onPress={() => setActiveTab("maintenance")}
            >
              <AppIcon name="shield-alert-outline" size={16} color={activeTab === "maintenance" ? "#EF4444" : "#94A3B8"} />
              <Text style={[styles.tabText, activeTab === "maintenance" && { color: "#EF4444" }]}>
                Maintenance
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === "broadcast" && styles.tabButtonActive]}
              onPress={() => setActiveTab("broadcast")}
            >
              <AppIcon name="bell" size={16} color={activeTab === "broadcast" ? "#38BDF8" : "#94A3B8"} />
              <Text style={[styles.tabText, activeTab === "broadcast" && { color: "#38BDF8" }]}>
                Broadcast
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
                      Aplikasi mobile akan memeriksa versi ini saat startup untuk mendeteksi update secara otomatis.
                    </Text>
                  </View>
                  <View style={styles.versionBadge}>
                    <Text style={styles.versionBadgeText}>Current: v{releaseConfig.version}</Text>
                  </View>
                </View>

                {/* GITHUB RELEASE AUTO-SYNC BOX */}
                <View style={styles.githubSyncCard}>
                  <View style={styles.githubSyncHeader}>
                    <AppIcon name="github" size={20} color="#38BDF8" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.githubSyncTitle}>Auto-Sync dari GitHub Release</Text>
                      <Text style={styles.githubSyncDesc}>
                        Tempel tautan release GitHub (tag atau repo). Sistem akan otomatis membaca versi, file .apk, dan catatan changelog.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.githubInputRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={githubUrlInput}
                      onChangeText={setGithubUrlInput}
                      placeholder="Contoh: https://github.com/nuenimegrup-png/NuenimeApp/releases/tag/v1.0.1"
                      placeholderTextColor="#64748B"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={[styles.githubSyncBtn, isSyncingGithub && { opacity: 0.6 }]}
                      onPress={handleSyncFromGithub}
                      disabled={isSyncingGithub}
                    >
                      {isSyncingGithub ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <AppIcon name="sync" size={16} color="#FFF" />
                          <Text style={styles.githubSyncBtnText}>Tarik Data Release</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {githubSyncFeedback && (
                    <View
                      style={[
                        styles.syncFeedbackBox,
                        githubSyncFeedback.success ? styles.syncSuccess : styles.syncError,
                      ]}
                    >
                      <AppIcon
                        name={githubSyncFeedback.success ? "check-circle" : "alert-circle"}
                        size={16}
                        color={githubSyncFeedback.success ? "#10B981" : "#EF4444"}
                      />
                      <Text
                        style={[
                          styles.syncFeedbackText,
                          { color: githubSyncFeedback.success ? "#10B981" : "#EF4444" },
                        ]}
                      >
                        {githubSyncFeedback.message}
                      </Text>
                    </View>
                  )}
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
                    <Text style={styles.hint}>Format SemVer: Major.Minor.Patch (misal: 1.4.9)</Text>
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
                    placeholder="https://github.com/nuenimegrup-png/NuenimeApp/releases/download/..."
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

            {/* TAB 2: POP-UP AWAL (ANNOUNCEMENT MODAL) */}
            {activeTab === "popup" && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>Pengaturan Pop-up Pengumuman Awal</Text>
                    <Text style={styles.cardDesc}>
                      Modal informasi yang otomatis muncul di layar saat pengguna membuka aplikasi Nuenime.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.previewBtn}
                    onPress={() => setShowAnnouncementPreview(true)}
                  >
                    <AppIcon name="eye-outline" size={16} color="#06B6D4" />
                    <Text style={styles.previewBtnText}>Lihat Preview Modal</Text>
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.statusAlertCard,
                    announcementConfig.isActive ? styles.popupActiveBg : styles.maintInactiveBg,
                  ]}
                >
                  <AppIcon
                    name="bell-ring-outline"
                    size={24}
                    color={announcementConfig.isActive ? "#06B6D4" : "#94A3B8"}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.maintStatusTitle}>
                      {announcementConfig.isActive
                        ? "POP-UP AWAL AKTIF (DITAMPILKAN KE PENGGUNA)"
                        : "POP-UP AWAL NONAKTIF (TIDAK DITAMPILKAN)"}
                    </Text>
                    <Text style={styles.maintStatusDesc}>
                      {announcementConfig.isActive
                        ? "Modal pengumuman akan muncul saat user membuka aplikasi (bisa ditutup dengan tombol Close)."
                        : "Pengguna langsung diarahkan ke layar utama tanpa dialog pengumuman pembuka."}
                    </Text>
                  </View>
                  <Switch
                    value={announcementConfig.isActive}
                    onValueChange={(val) =>
                      setAnnouncementConfig({ ...announcementConfig, isActive: val })
                    }
                    thumbColor={announcementConfig.isActive ? "#06B6D4" : "#94A3B8"}
                    trackColor={{ false: "#14121F", true: "rgba(6, 182, 212, 0.4)" }}
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 16 }]}>
                    <Text style={styles.label}>Judul Pengumuman</Text>
                    <TextInput
                      style={styles.input}
                      value={announcementConfig.title}
                      onChangeText={(val) =>
                        setAnnouncementConfig({ ...announcementConfig, title: val })
                      }
                      placeholder="INFO"
                      placeholderTextColor="#64748B"
                    />
                    <Text style={styles.hint}>Akan ditampilkan di header modal seperti: [ INFO ]</Text>
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Tag Versi / Sub-judul</Text>
                    <TextInput
                      style={styles.input}
                      value={announcementConfig.versionTag || ""}
                      onChangeText={(val) =>
                        setAnnouncementConfig({ ...announcementConfig, versionTag: val })
                      }
                      placeholder="Versi terbaru: 1.4.9"
                      placeholderTextColor="#64748B"
                    />
                    <Text style={styles.hint}>Teks badge di bawah poin informasi.</Text>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Poin-Poin Informasi (Satu Baris Per Poin)</Text>
                  <TextInput
                    style={[styles.input, { height: 160, textAlignVertical: "top" }]}
                    value={announcementConfig.content}
                    onChangeText={(val) =>
                      setAnnouncementConfig({ ...announcementConfig, content: val })
                    }
                    multiline
                    placeholder={`Fitur baru telah ditambahkan:\nKatalog anime musim ini sudah diperbarui\nPlayer video lebih stabil dan hemat kuota\nLaporkan bug di Discord kami`}
                    placeholderTextColor="#64748B"
                  />
                  <Text style={styles.hint}>
                    Setiap baris kalimat baru akan otomatis diformat dengan bullet poin cyan yang rapi.
                  </Text>
                </View>

                {/* TOMBOL 1 (LIQUID GLASS UTAMA) */}
                <View style={styles.buttonConfigSection}>
                  <View style={styles.buttonSectionHeader}>
                    <AppIcon name="play" size={16} color="#38BDF8" />
                    <Text style={styles.buttonSectionTitle}>Tombol 1 (Liquid Glass Utama - Play Icon)</Text>
                  </View>
                  <View style={styles.row}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 16 }]}>
                      <Text style={styles.label}>Teks Tombol 1</Text>
                      <TextInput
                        style={styles.input}
                        value={announcementConfig.buttonText || ""}
                        onChangeText={(val) =>
                          setAnnouncementConfig({ ...announcementConfig, buttonText: val })
                        }
                        placeholder="Contoh: Tonton Sekarang / JOIN DISCORD"
                        placeholderTextColor="#64748B"
                      />
                    </View>

                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Tautan URL Tombol 1</Text>
                      <TextInput
                        style={styles.input}
                        value={announcementConfig.buttonUrl || ""}
                        onChangeText={(val) =>
                          setAnnouncementConfig({ ...announcementConfig, buttonUrl: val })
                        }
                        placeholder="https://discord.gg/nuenime atau /anime/..."
                        placeholderTextColor="#64748B"
                      />
                    </View>
                  </View>
                </View>

                {/* TOMBOL 2 (LIQUID GLASS SEKUNDER) */}
                <View style={styles.buttonConfigSection}>
                  <View style={styles.buttonSectionHeader}>
                    <AppIcon name="information" size={16} color="#CBD5E1" />
                    <Text style={styles.buttonSectionTitle}>Tombol 2 (Liquid Glass Sekunder - Info Icon)</Text>
                  </View>
                  <View style={styles.row}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 16 }]}>
                      <Text style={styles.label}>Teks Tombol 2</Text>
                      <TextInput
                        style={styles.input}
                        value={announcementConfig.secondaryButtonText || ""}
                        onChangeText={(val) =>
                          setAnnouncementConfig({ ...announcementConfig, secondaryButtonText: val })
                        }
                        placeholder="Contoh: Detail / Tutup"
                        placeholderTextColor="#64748B"
                      />
                    </View>

                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Tautan URL Tombol 2 (Opsional)</Text>
                      <TextInput
                        style={styles.input}
                        value={announcementConfig.secondaryButtonUrl || ""}
                        onChangeText={(val) =>
                          setAnnouncementConfig({ ...announcementConfig, secondaryButtonUrl: val })
                        }
                        placeholder="Kosongkan jika hanya untuk tombol Tutup"
                        placeholderTextColor="#64748B"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.previewBtnLarge, { marginRight: 12 }]}
                    onPress={() => setShowAnnouncementPreview(true)}
                  >
                    <AppIcon name="eye-outline" size={16} color="#06B6D4" />
                    <Text style={styles.previewBtnLargeText}>Lihat Preview</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBtn, { flex: 1, backgroundColor: "#06B6D4" }]}
                    onPress={handleSaveAnnouncement}
                    disabled={isSavingAnnouncement}
                  >
                    {isSavingAnnouncement ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <AppIcon name="check-circle" size={16} color="#FFF" />
                        <Text style={styles.saveBtnText}>Simpan & Terapkan Pop-up</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* TAB 3: MAINTENANCE MODE */}
            {activeTab === "maintenance" && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>Status Pemeliharaan Sistem (Maintenance Mode)</Text>
                    <Text style={styles.cardDesc}>
                      Saat aktif, aplikasi Nuenime akan menampilkan layar pemeliharaan penuh dan menolak akses publik secara real-time.
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
                        ? "Hanya administrator terdaftar yang dapat mengakses aplikasi. Layar Maintenance Gate otomatis mengunci penonton."
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

                {/* ICON URL */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>URL Gambar Icon Maintenance</Text>
                  <TextInput
                    style={styles.input}
                    value={maintenanceConfig.iconUrl || ""}
                    onChangeText={(val) =>
                      setMaintenanceConfig({ ...maintenanceConfig, iconUrl: val })
                    }
                    placeholder="https://i.ibb.co.com/rKCB8QhB/maintenance-nuenime.png"
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                  />
                  <Text style={styles.hint}>URL gambar icon yang muncul di halaman maintenance. Kosongkan untuk menggunakan ikon default.</Text>
                </View>

                {/* TOMBOL 1 (UTAMA) */}
                <View style={styles.buttonConfigSection}>
                  <View style={styles.buttonSectionHeader}>
                    <AppIcon name="server" size={16} color="#38BDF8" />
                    <Text style={styles.buttonSectionTitle}>Tombol 1 – Liquid Glass Utama</Text>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Teks Tombol 1</Text>
                    <TextInput
                      style={styles.input}
                      value={maintenanceConfig.primaryButtonText || ""}
                      onChangeText={(val) =>
                        setMaintenanceConfig({ ...maintenanceConfig, primaryButtonText: val })
                      }
                      placeholder="Contoh: Cek Status Server"
                      placeholderTextColor="#64748B"
                    />
                    <Text style={styles.hint}>Tombol utama di layar maintenance (silver liquid glass). Tidak bisa dikonfigurasi URL-nya.</Text>
                  </View>
                </View>

                {/* TOMBOL 2 (SEKUNDER) */}
                <View style={styles.buttonConfigSection}>
                  <View style={styles.buttonSectionHeader}>
                    <AppIcon name="discord" size={16} color="#CBD5E1" />
                    <Text style={styles.buttonSectionTitle}>Tombol 2 – Liquid Glass Sekunder</Text>
                  </View>
                  <View style={styles.row}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 16 }]}>
                      <Text style={styles.label}>Teks Tombol 2</Text>
                      <TextInput
                        style={styles.input}
                        value={maintenanceConfig.secondaryButtonText || ""}
                        onChangeText={(val) =>
                          setMaintenanceConfig({ ...maintenanceConfig, secondaryButtonText: val })
                        }
                        placeholder="Contoh: Discord Support"
                        placeholderTextColor="#64748B"
                      />
                    </View>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.label}>URL Tombol 2 (Opsional)</Text>
                      <TextInput
                        style={styles.input}
                        value={maintenanceConfig.secondaryButtonUrl || ""}
                        onChangeText={(val) =>
                          setMaintenanceConfig({ ...maintenanceConfig, secondaryButtonUrl: val })
                        }
                        placeholder="https://discord.gg/nuenime"
                        placeholderTextColor="#64748B"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
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

            {/* TAB 4: BROADCAST NOTIFICATIONS */}
            {activeTab === "broadcast" && (
              <View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Kirim Siaran Notifikasi Massal</Text>
                  <Text style={styles.cardDesc}>
                    Pesan akan langsung muncul sebagai banner real-time di layar seluruh pengguna aktif dan tersimpan di database.
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                      <AppIcon name="history" size={18} color="#CBD5E1" />
                      <Text style={styles.historyTitle}>Riwayat Siaran Terkirim ({broadcasts.length})</Text>
                    </View>
                    {broadcasts.length > 0 && (
                      <TouchableOpacity
                        onPress={handleClearAllBroadcasts}
                        style={styles.clearAllBtn}
                        activeOpacity={0.7}
                      >
                        <AppIcon name="trash" size={14} color="#EF4444" />
                        <Text style={styles.clearAllBtnText}>Bersihkan Semua</Text>
                      </TouchableOpacity>
                    )}
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
                          <TouchableOpacity
                            onPress={() => handleDeleteBroadcast(b.id)}
                            style={styles.deleteBroadcastBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <AppIcon name="trash" size={14} color="#EF4444" />
                            <Text style={styles.deleteBroadcastText}>Hapus</Text>
                          </TouchableOpacity>
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

      {/* POPUP ANNOUNCEMENT PREVIEW MODAL */}
      <AppAnnouncementModal
        previewConfig={showAnnouncementPreview ? announcementConfig : null}
        onClosePreview={() => setShowAnnouncementPreview(false)}
      />
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
    flexWrap: "wrap",
    gap: 4,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
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
    flexWrap: "wrap",
    gap: 12,
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
    maxWidth: 600,
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
  githubSyncCard: {
    backgroundColor: "#17142A",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  githubSyncHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  githubSyncTitle: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "700",
  },
  githubSyncDesc: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 18,
  },
  githubInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  githubSyncBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0284C7",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  githubSyncBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 13,
  },
  syncFeedbackBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
  },
  syncSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  syncError: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  syncFeedbackText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    borderColor: "#06B6D4",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  previewBtnText: {
    color: "#06B6D4",
    fontSize: 13,
    fontWeight: "700",
  },
  previewBtnLarge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    borderColor: "#06B6D4",
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 12,
  },
  previewBtnLargeText: {
    color: "#06B6D4",
    fontSize: 14,
    fontWeight: "700",
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
    alignItems: "center",
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
  popupActiveBg: {
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    borderColor: "#06B6D4",
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
  buttonConfigSection: {
    backgroundColor: "#161325",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  buttonSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  buttonSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E2E8F0",
  },
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  clearAllBtnText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "600",
  },
  deleteBroadcastBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    marginLeft: 10,
  },
  deleteBroadcastText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "600",
  },
});
