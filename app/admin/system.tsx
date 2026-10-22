import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
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
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { useAnirakuAuth } from "@/providers/auth-provider";

type SystemTab = "apk" | "popup" | "maintenance" | "broadcast";

export default function AdminSystemScreen() {
  const auth = useAnirakuAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const [activeTab, setActiveTab] = useState<SystemTab>("apk");
  const [isLoading, setIsLoading] = useState(true);

  // ─── CONFIGURATION STATE ───
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

  // ─── GITHUB AUTO-SYNC STATE ───
  const [githubUrlInput, setGithubUrlInput] = useState("");
  const [isSyncingGithub, setIsSyncingGithub] = useState(false);
  const [githubSyncFeedback, setGithubSyncFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // ─── ANNOUNCEMENT PREVIEW & SAVING STATE ───
  const [showAnnouncementPreview, setShowAnnouncementPreview] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);

  // ─── BROADCAST FORM STATE ───
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastType, setBroadcastType] = useState<BroadcastNotification["type"]>("system");
  const [broadcastUrl, setBroadcastUrl] = useState("");
  const [isSending, setIsSending] = useState(false);

  // ─── SAVING STATES ───
  const [isSavingApk, setIsSavingApk] = useState(false);
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);

  // ─── FLOATING ACTION TOAST (SESUAI ADMIN GACHA & BORDERS THEME) ───
  const [actionToast, setActionToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setActionToast({ message, type });
    setTimeout(() => setActionToast(null), 4000);
  }, []);

  const currentAdmin: AdminUser = useMemo(() => {
    return {
      id: auth.user?.id || "admin-master",
      email: auth.user?.email || "superadmin@nuenime.com",
      username: auth.profile?.display_name || auth.profile?.username || "Lead Admin",
      role: "super_admin",
    };
  }, [auth.user, auth.profile]);

  const loadData = useCallback(async () => {
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
    } catch (err: any) {
      showToast(err?.message || "Gagal memuat konfigurasi server.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── SAVE APK CONFIG ───
  const handleSaveApkRelease = async () => {
    setIsSavingApk(true);
    hapticLight();
    try {
      await saveAdminAppReleaseConfig(releaseConfig, currentAdmin);
      hapticSuccess();
      showToast("Konfigurasi rilis APK berhasil disimpan & disinkronkan ke cloud!", "success");
    } catch (err: any) {
      hapticWarning();
      showToast(err?.message || "Gagal menyimpan rilis APK.", "error");
    } finally {
      setIsSavingApk(false);
    }
  };

  // ─── GITHUB SYNC ───
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
    hapticLight();
    try {
      const info = await fetchGitHubReleaseInfo(githubUrlInput.trim());
      if (!info) {
        setGithubSyncFeedback({
          success: false,
          message: "Gagal mendeteksi rilis dari tautan GitHub. Pastikan URL valid dan repo/release bersifat publik.",
        });
        hapticWarning();
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
      hapticSuccess();
    } catch (err: any) {
      setGithubSyncFeedback({
        success: false,
        message: err?.message || "Terjadi kesalahan saat menghubungi GitHub API.",
      });
      hapticWarning();
    } finally {
      setIsSyncingGithub(false);
    }
  };

  // ─── SAVE MAINTENANCE ───
  const handleSaveMaintenance = async () => {
    setIsSavingMaintenance(true);
    hapticLight();
    try {
      await saveAdminMaintenanceConfig(maintenanceConfig, currentAdmin);
      hapticSuccess();
      showToast(
        maintenanceConfig.isActive
          ? "Status Pemeliharaan Sistem AKTIF. Aplikasi dikunci untuk publik!"
          : "Status Pemeliharaan Sistem NONAKTIF. Aplikasi normal beroperasi!",
        "success"
      );
    } catch (err: any) {
      hapticWarning();
      showToast(err?.message || "Gagal memperbarui status maintenance.", "error");
    } finally {
      setIsSavingMaintenance(false);
    }
  };

  // ─── SAVE ANNOUNCEMENT ───
  const handleSaveAnnouncement = async () => {
    setIsSavingAnnouncement(true);
    hapticLight();
    try {
      await saveAppAnnouncementConfig(announcementConfig, currentAdmin);
      hapticSuccess();
      showToast("Pop-up Pengumuman Awal berhasil disimpan & disinkronkan ke seluruh pengguna!", "success");
    } catch (err: any) {
      hapticWarning();
      showToast(err?.message || "Gagal menyimpan pengumuman pop-up.", "error");
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  // ─── SEND BROADCAST ───
  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      showToast("Judul dan pesan notifikasi wajib diisi!", "error");
      return;
    }
    setIsSending(true);
    hapticLight();
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
      hapticSuccess();
      showToast(`Notifikasi berhasil disiarkan secara real-time ke ${newBc.recipientsCount} akun!`, "success");
    } catch (err: any) {
      hapticWarning();
      showToast(err?.message || "Gagal menyiarkan notifikasi.", "error");
    } finally {
      setIsSending(false);
    }
  };

  // ─── DELETE BROADCAST ───
  const handleDeleteBroadcast = (id: string) => {
    hapticWarning();
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
              hapticSuccess();
              showToast("Siaran berhasil dihapus dari riwayat!", "success");
            } catch (err: any) {
              showToast(err?.message || "Gagal menghapus siaran.", "error");
            }
          },
        },
      ]
    );
  };

  // ─── CLEAR ALL BROADCASTS ───
  const handleClearAllBroadcasts = () => {
    hapticWarning();
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
              hapticSuccess();
              showToast("Seluruh riwayat siaran berhasil dibersihkan!", "success");
            } catch (err: any) {
              showToast(err?.message || "Gagal membersihkan riwayat siaran.", "error");
            }
          },
        },
      ]
    );
  };

  return (
    <AdminLayout
      activeKey="system"
      title="System & APK Update"
      subtitle="Pusat kendali rilis aplikasi Android, status server pemeliharaan, pop-up pengumuman, dan siaran massal"
    >
      {/* ─── TOP KPI STRIP (SESUAI ADMIN GACHA & BORDERS THEME) ─── */}
      <View style={[styles.kpiStrip, !isWide && styles.kpiStripMobile]}>
        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
            <AppIcon name="cellphone-arrow-down" size={18} color="#38BDF8" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Versi Rilis APK</Text>
            <Text style={styles.kpiStripVal}>v{releaseConfig.version}</Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View
            style={[
              styles.kpiStripIcon,
              maintenanceConfig.isActive
                ? { backgroundColor: "rgba(244, 63, 94, 0.15)" }
                : { backgroundColor: "rgba(16, 185, 129, 0.15)" },
            ]}
          >
            <AppIcon
              name={maintenanceConfig.isActive ? "shield-alert-outline" : "shield-check-outline"}
              size={18}
              color={maintenanceConfig.isActive ? "#F43F5E" : "#10B981"}
            />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Status Server</Text>
            <Text
              style={[
                styles.kpiStripVal,
                { color: maintenanceConfig.isActive ? "#F43F5E" : "#10B981" },
              ]}
            >
              {maintenanceConfig.isActive ? "Pemeliharaan ⚠️" : "Normal 🟢"}
            </Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(6, 182, 212, 0.15)" }]}>
            <AppIcon name="bell-ring-outline" size={18} color="#06B6D4" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Pop-up Pengumuman</Text>
            <Text
              style={[
                styles.kpiStripVal,
                { color: announcementConfig.isActive ? "#38BDF8" : "#94A3B8" },
              ]}
            >
              {announcementConfig.isActive ? "Tayang 📢" : "Nonaktif"}
            </Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
            <AppIcon name="broadcast" size={18} color="#F59E0B" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Siaran Terkirim</Text>
            <Text style={[styles.kpiStripVal, { color: "#F59E0B" }]}>
              {broadcasts.length} Siaran
            </Text>
          </View>
        </View>
      </View>

      {/* ─── INFO BANNER (SESUAI ADMIN GACHA & BORDERS THEME) ─── */}
      <View style={styles.infoBanner}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 }}>
          <View style={styles.infoIconWrap}>
            <AppIcon name="information-outline" size={15} color="#38BDF8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Pusat Kontrol Sistem & Infrastruktur Server Nuenime</Text>
            <Text style={styles.infoBannerText}>
              Seluruh konfigurasi rilis APK, pengumuman pop-up, status pemeliharaan (maintenance gate), dan siaran massal
              tersimpan di tabel system_configs database Supabase. Setiap perubahan langsung berlaku secara instan ke seluruh aplikasi pengguna.
            </Text>
          </View>
        </View>
      </View>

      {/* ─── TAB NAVIGATION (CHIP STYLE SESUAI ADMIN GACHA & BORDERS) ─── */}
      <View style={styles.tabNavWrap}>
        {[
          { key: "apk", label: `Rilis & Update APK (v${releaseConfig.version})`, icon: "cellphone-arrow-down" },
          { key: "popup", label: `Pop-up Pengumuman (${announcementConfig.isActive ? "Aktif" : "Mati"})`, icon: "bell-ring-outline" },
          { key: "maintenance", label: `Mode Pemeliharaan (${maintenanceConfig.isActive ? "Kunci" : "Buka"})`, icon: "shield-alert-outline" },
          { key: "broadcast", label: `Siaran Notifikasi (${broadcasts.length})`, icon: "broadcast" },
        ].map((t) => (
          <Pressable
            key={t.key}
            onPress={() => {
              hapticLight();
              setActiveTab(t.key as SystemTab);
            }}
            style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
          >
            <AppIcon
              name={t.icon as any}
              size={14}
              color={activeTab === t.key ? "#FFFFFF" : "#94A3B8"}
            />
            <Text style={[styles.tabBtnText, activeTab === t.key && styles.tabBtnTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ─── FLOATING ACTION TOAST ─── */}
      {actionToast && (
        <View
          style={[
            styles.floatingToast,
            actionToast.type === "error" ? styles.toastError : styles.toastSuccess,
          ]}
        >
          <AppIcon
            name={actionToast.type === "error" ? "alert-circle" : "check-circle"}
            size={16}
            color="#FFFFFF"
          />
          <Text style={styles.toastText}>{actionToast.message}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Memuat konfigurasi sistem dari database Supabase...</Text>
        </View>
      ) : (
        <View style={styles.contentWrap}>
          {/* ══════════════════════════════════════════════════════
              TAB 1: RILIS & UPDATE APK
             ══════════════════════════════════════════════════════ */}
          {activeTab === "apk" && (
            <View style={{ gap: 16 }}>
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                    <AppIcon name="cellphone-arrow-down" size={18} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Pengaturan Rilis Versi APK Nuenime</Text>
                    <Text style={styles.cardSubtitle}>
                      Aplikasi mobile akan memeriksa versi ini saat startup untuk mendeteksi update secara otomatis.
                    </Text>
                  </View>
                  <View style={styles.versionBadgeSilver}>
                    <Text style={styles.versionBadgeSilverText}>Rilis Saat Ini: v{releaseConfig.version}</Text>
                  </View>
                </View>

                {/* GITHUB RELEASE AUTO-SYNC BOX (SILVER LIQUID GLASS) */}
                <View style={styles.githubSyncCard}>
                  <View style={styles.githubSyncHeader}>
                    <View style={styles.githubIconBox}>
                      <AppIcon name="github" size={18} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.githubSyncTitle}>Auto-Sync dari GitHub Release</Text>
                      <Text style={styles.githubSyncDesc}>
                        Tempel tautan release GitHub (tag atau repo). Sistem akan otomatis membaca versi, file .apk, dan catatan changelog.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.githubInputRow}>
                    <View style={styles.githubInputWrap}>
                      <AppIcon name="link-variant" size={15} color="#64748B" />
                      <TextInput
                        style={styles.cleanInput}
                        value={githubUrlInput}
                        onChangeText={setGithubUrlInput}
                        placeholder="https://github.com/nuenimegrup-png/NuenimeApp/releases/tag/v1.0.1"
                        placeholderTextColor="#64748B"
                        autoCapitalize="none"
                      />
                    </View>
                    <Pressable
                      style={[styles.silverLiquidBtn, isSyncingGithub && { opacity: 0.6 }]}
                      onPress={handleSyncFromGithub}
                      disabled={isSyncingGithub}
                    >
                      {isSyncingGithub ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <AppIcon name="sync" size={15} color="#FFFFFF" />
                          <Text style={styles.silverLiquidBtnText}>Tarik Data Release</Text>
                        </>
                      )}
                    </Pressable>
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
                        size={15}
                        color={githubSyncFeedback.success ? "#10B981" : "#F43F5E"}
                      />
                      <Text
                        style={[
                          styles.syncFeedbackText,
                          { color: githubSyncFeedback.success ? "#10B981" : "#FDA4AF" },
                        ]}
                      >
                        {githubSyncFeedback.message}
                      </Text>
                    </View>
                  )}
                </View>

                {/* FORM FIELDS */}
                <View style={[styles.rowTwoCols, !isWide && { flexDirection: "column" }]}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Nomor Versi Terbaru (SemVer)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={releaseConfig.version}
                      onChangeText={(val) => setReleaseConfig({ ...releaseConfig, version: val })}
                      placeholder="0.0.1"
                      placeholderTextColor="#64748B"
                    />
                    <Text style={styles.fieldHint}>Format Major.Minor.Patch (misal: 1.0.0 atau 0.0.1)</Text>
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Versi Minimum yang Diizinkan</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={releaseConfig.minVersion}
                      onChangeText={(val) => setReleaseConfig({ ...releaseConfig, minVersion: val })}
                      placeholder="0.0.1"
                      placeholderTextColor="#64748B"
                    />
                    <Text style={styles.fieldHint}>Versi di bawah ini otomatis dipaksa update jika Force Update aktif.</Text>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Tautan Unduh APK GitHub / Direct URL</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={releaseConfig.apkUrl}
                    onChangeText={(val) => setReleaseConfig({ ...releaseConfig, apkUrl: val })}
                    placeholder="https://github.com/nuenimegrup-png/NuenimeApp/releases/download/..."
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                  />
                  <Text style={styles.fieldHint}>Tautan langsung file .apk yang diunduh pengguna saat menekan tombol update.</Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Catatan Perubahan (Changelog)</Text>
                  <TextInput
                    style={[styles.fieldInput, { height: 90, textAlignVertical: "top" }]}
                    value={releaseConfig.changelog}
                    onChangeText={(val) => setReleaseConfig({ ...releaseConfig, changelog: val })}
                    multiline
                    placeholder="Apa saja fitur baru atau perbaikan di rilis ini..."
                    placeholderTextColor="#64748B"
                  />
                </View>

                {/* TOGGLE FORCE UPDATE */}
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleTitle}>Wajibkan Pembaruan (Force Update)</Text>
                    <Text style={styles.toggleDesc}>
                      Jika aktif, pengguna aplikasi versi lama tidak dapat menutup dialog pembaruan hingga mengunduh APK baru.
                    </Text>
                  </View>
                  <Switch
                    value={releaseConfig.forceUpdate}
                    onValueChange={(val) => setReleaseConfig({ ...releaseConfig, forceUpdate: val })}
                    thumbColor={releaseConfig.forceUpdate ? "#38BDF8" : "#94A3B8"}
                    trackColor={{ false: "rgba(255, 255, 255, 0.08)", true: "rgba(56, 189, 248, 0.35)" }}
                  />
                </View>

                {/* SAVE BUTTON (SILVER LIQUID GLASS UTAMA) */}
                <Pressable
                  style={[styles.primaryActionBtnSilver, isSavingApk && { opacity: 0.6 }]}
                  onPress={handleSaveApkRelease}
                  disabled={isSavingApk}
                >
                  {isSavingApk ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <AppIcon name="check-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryActionBtnSilverText}>Simpan Konfigurasi APK</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 2: POP-UP PENGUMUMAN AWAL
             ══════════════════════════════════════════════════════ */}
          {activeTab === "popup" && (
            <View style={{ gap: 16 }}>
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(6, 182, 212, 0.12)" }]}>
                    <AppIcon name="bell-ring-outline" size={18} color="#06B6D4" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Pengaturan Pop-up Pengumuman Awal</Text>
                    <Text style={styles.cardSubtitle}>
                      Modal informasi yang otomatis muncul di layar saat pengguna membuka aplikasi Nuenime.
                    </Text>
                  </View>
                  <Pressable
                    style={styles.silverLiquidSecondaryBtn}
                    onPress={() => {
                      hapticLight();
                      setShowAnnouncementPreview(true);
                    }}
                  >
                    <AppIcon name="eye-outline" size={14} color="#CBD5E1" />
                    <Text style={styles.silverLiquidSecondaryBtnText}>Lihat Preview Modal</Text>
                  </Pressable>
                </View>

                {/* STATUS ALERT CARD */}
                <View
                  style={[
                    styles.statusAlertCard,
                    announcementConfig.isActive ? styles.popupActiveBg : styles.maintInactiveBg,
                  ]}
                >
                  <AppIcon
                    name="bell-ring-outline"
                    size={22}
                    color={announcementConfig.isActive ? "#38BDF8" : "#94A3B8"}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.maintStatusTitle}>
                      {announcementConfig.isActive
                        ? "POP-UP AWAL AKTIF (DITAMPILKAN KE PENGGUNA)"
                        : "POP-UP AWAL NONAKTIF (TIDAK DITAMPILKAN)"}
                    </Text>
                    <Text style={styles.maintStatusDesc}>
                      {announcementConfig.isActive
                        ? "Modal pengumuman akan muncul saat user membuka aplikasi (dapat ditutup dengan tombol Close)."
                        : "Pengguna langsung diarahkan ke layar utama tanpa dialog pengumuman pembuka."}
                    </Text>
                  </View>
                  <Switch
                    value={announcementConfig.isActive}
                    onValueChange={(val) =>
                      setAnnouncementConfig({ ...announcementConfig, isActive: val })
                    }
                    thumbColor={announcementConfig.isActive ? "#38BDF8" : "#94A3B8"}
                    trackColor={{ false: "rgba(255, 255, 255, 0.08)", true: "rgba(56, 189, 248, 0.35)" }}
                  />
                </View>

                <View style={[styles.rowTwoCols, !isWide && { flexDirection: "column" }]}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Judul Pengumuman</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={announcementConfig.title}
                      onChangeText={(val) =>
                        setAnnouncementConfig({ ...announcementConfig, title: val })
                      }
                      placeholder="INFO"
                      placeholderTextColor="#64748B"
                    />
                    <Text style={styles.fieldHint}>Akan ditampilkan di header modal seperti: [ INFO ]</Text>
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Tag Versi / Sub-judul</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={announcementConfig.versionTag || ""}
                      onChangeText={(val) =>
                        setAnnouncementConfig({ ...announcementConfig, versionTag: val })
                      }
                      placeholder="Versi terbaru: 1.0.0"
                      placeholderTextColor="#64748B"
                    />
                    <Text style={styles.fieldHint}>Teks badge kecil di bawah judul informasi.</Text>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Poin-Poin Informasi (Satu Baris Per Poin)</Text>
                  <TextInput
                    style={[styles.fieldInput, { height: 140, textAlignVertical: "top" }]}
                    value={announcementConfig.content}
                    onChangeText={(val) =>
                      setAnnouncementConfig({ ...announcementConfig, content: val })
                    }
                    multiline
                    placeholder={`Fitur baru telah ditambahkan:\nKatalog anime musim ini sudah diperbarui\nPlayer video lebih stabil dan hemat kuota\nLaporkan bug di saluran WhatsApp kami`}
                    placeholderTextColor="#64748B"
                  />
                  <Text style={styles.fieldHint}>
                    Setiap baris kalimat baru akan otomatis diformat dengan bullet poin cyan yang rapi.
                  </Text>
                </View>

                {/* TOMBOL 1 (LIQUID GLASS UTAMA) */}
                <View style={styles.buttonConfigSection}>
                  <View style={styles.buttonSectionHeader}>
                    <AppIcon name="play" size={15} color="#38BDF8" />
                    <Text style={styles.buttonSectionTitle}>Tombol 1 (Liquid Glass Utama - Play Icon)</Text>
                  </View>
                  <View style={[styles.rowTwoCols, !isWide && { flexDirection: "column" }]}>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Teks Tombol 1</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={announcementConfig.buttonText || ""}
                        onChangeText={(val) =>
                          setAnnouncementConfig({ ...announcementConfig, buttonText: val })
                        }
                        placeholder="Contoh: SALURAN WHATSAPP"
                        placeholderTextColor="#64748B"
                      />
                    </View>

                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Tautan URL Tombol 1</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={announcementConfig.buttonUrl || ""}
                        onChangeText={(val) =>
                          setAnnouncementConfig({ ...announcementConfig, buttonUrl: val })
                        }
                        placeholder="https://chat.whatsapp.com/..."
                        placeholderTextColor="#64748B"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                </View>

                {/* TOMBOL 2 (LIQUID GLASS SEKUNDER) */}
                <View style={styles.buttonConfigSection}>
                  <View style={styles.buttonSectionHeader}>
                    <AppIcon name="information-outline" size={15} color="#CBD5E1" />
                    <Text style={styles.buttonSectionTitle}>Tombol 2 (Liquid Glass Sekunder - Info Icon)</Text>
                  </View>
                  <View style={[styles.rowTwoCols, !isWide && { flexDirection: "column" }]}>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Teks Tombol 2</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={announcementConfig.secondaryButtonText || ""}
                        onChangeText={(val) =>
                          setAnnouncementConfig({ ...announcementConfig, secondaryButtonText: val })
                        }
                        placeholder="Contoh: DETAIL INFO / TUTUP"
                        placeholderTextColor="#64748B"
                      />
                    </View>

                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Tautan URL Tombol 2 (Opsional)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={announcementConfig.secondaryButtonUrl || ""}
                        onChangeText={(val) =>
                          setAnnouncementConfig({ ...announcementConfig, secondaryButtonUrl: val })
                        }
                        placeholder="Kosongkan jika hanya untuk tombol Tutup"
                        placeholderTextColor="#64748B"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                </View>

                {/* ACTION BUTTONS (SILVER LIQUID GLASS) */}
                <View style={styles.actionRowTwoButtons}>
                  <Pressable
                    style={styles.silverLiquidSecondaryBtnLarge}
                    onPress={() => {
                      hapticLight();
                      setShowAnnouncementPreview(true);
                    }}
                  >
                    <AppIcon name="eye-outline" size={16} color="#CBD5E1" />
                    <Text style={styles.silverLiquidSecondaryBtnLargeText}>Lihat Preview</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.primaryActionBtnSilver, isSavingAnnouncement && { opacity: 0.6 }]}
                    onPress={handleSaveAnnouncement}
                    disabled={isSavingAnnouncement}
                  >
                    {isSavingAnnouncement ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <AppIcon name="check-circle" size={16} color="#FFFFFF" />
                        <Text style={styles.primaryActionBtnSilverText}>Simpan & Terapkan Pop-up</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 3: MODE PEMELIHARAAN (MAINTENANCE GATE)
             ══════════════════════════════════════════════════════ */}
          {activeTab === "maintenance" && (
            <View style={{ gap: 16 }}>
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(244, 63, 94, 0.12)" }]}>
                    <AppIcon name="shield-alert-outline" size={18} color="#F43F5E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Status Pemeliharaan Server (Maintenance Gate)</Text>
                    <Text style={styles.cardSubtitle}>
                      Saat aktif, aplikasi Nuenime akan menampilkan layar pemeliharaan penuh dan menolak akses publik secara real-time.
                    </Text>
                  </View>
                </View>

                {/* STATUS ALERT CARD */}
                <View
                  style={[
                    styles.statusAlertCard,
                    maintenanceConfig.isActive ? styles.maintActiveBg : styles.maintInactiveBg,
                  ]}
                >
                  <AppIcon
                    name={maintenanceConfig.isActive ? "shield-alert-outline" : "shield-check-outline"}
                    size={22}
                    color={maintenanceConfig.isActive ? "#F43F5E" : "#10B981"}
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
                    thumbColor={maintenanceConfig.isActive ? "#F43F5E" : "#94A3B8"}
                    trackColor={{ false: "rgba(255, 255, 255, 0.08)", true: "rgba(244, 63, 94, 0.35)" }}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Pesan Pemeliharaan untuk Pengguna</Text>
                  <TextInput
                    style={[styles.fieldInput, { height: 80, textAlignVertical: "top" }]}
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
                  <Text style={styles.fieldLabel}>URL Gambar Icon Maintenance</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={maintenanceConfig.iconUrl || ""}
                    onChangeText={(val) =>
                      setMaintenanceConfig({ ...maintenanceConfig, iconUrl: val })
                    }
                    placeholder="https://i.ibb.co.com/rKCB8QhB/maintenance-nuenime.png"
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                  />
                  <Text style={styles.fieldHint}>URL gambar icon yang muncul di halaman maintenance. Kosongkan untuk menggunakan ikon default.</Text>
                </View>

                {/* TOMBOL 1 (UTAMA) */}
                <View style={styles.buttonConfigSection}>
                  <View style={styles.buttonSectionHeader}>
                    <AppIcon name="server" size={15} color="#38BDF8" />
                    <Text style={styles.buttonSectionTitle}>Tombol 1 – Liquid Glass Utama</Text>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>Teks Tombol 1</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={maintenanceConfig.primaryButtonText || ""}
                      onChangeText={(val) =>
                        setMaintenanceConfig({ ...maintenanceConfig, primaryButtonText: val })
                      }
                      placeholder="Contoh: Cek Status Server"
                      placeholderTextColor="#64748B"
                    />
                    <Text style={styles.fieldHint}>Tombol utama di layar maintenance (silver liquid glass). Memeriksa konektivitas server.</Text>
                  </View>
                </View>

                {/* TOMBOL 2 (SEKUNDER) */}
                <View style={styles.buttonConfigSection}>
                  <View style={styles.buttonSectionHeader}>
                    <AppIcon name="chat-question-outline" size={15} color="#CBD5E1" />
                    <Text style={styles.buttonSectionTitle}>Tombol 2 – Liquid Glass Sekunder</Text>
                  </View>
                  <View style={[styles.rowTwoCols, !isWide && { flexDirection: "column" }]}>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Teks Tombol 2</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={maintenanceConfig.secondaryButtonText || ""}
                        onChangeText={(val) =>
                          setMaintenanceConfig({ ...maintenanceConfig, secondaryButtonText: val })
                        }
                        placeholder="Contoh: Hubungi Developer"
                        placeholderTextColor="#64748B"
                      />
                    </View>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>URL Tombol 2 (Opsional)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={maintenanceConfig.secondaryButtonUrl || ""}
                        onChangeText={(val) =>
                          setMaintenanceConfig({ ...maintenanceConfig, secondaryButtonUrl: val })
                        }
                        placeholder="https://t.me/Riz_BuyX"
                        placeholderTextColor="#64748B"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                </View>

                {/* APPLY MAINTENANCE BUTTON (SILVER LIQUID GLASS WITH RED ACCENT) */}
                <Pressable
                  style={[
                    styles.primaryActionBtnSilver,
                    maintenanceConfig.isActive && { borderColor: "rgba(244, 63, 94, 0.45)" },
                    isSavingMaintenance && { opacity: 0.6 },
                  ]}
                  onPress={handleSaveMaintenance}
                  disabled={isSavingMaintenance}
                >
                  {isSavingMaintenance ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <AppIcon
                        name={maintenanceConfig.isActive ? "shield-lock-outline" : "shield-check"}
                        size={16}
                        color="#FFFFFF"
                      />
                      <Text style={styles.primaryActionBtnSilverText}>
                        {maintenanceConfig.isActive
                          ? "Kunci Aplikasi (Terapkan Mode Maintenance)"
                          : "Buka Akses Publik (Nonaktifkan Maintenance)"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 4: SIARAN NOTIFIKASI MASSAL (BROADCAST)
             ══════════════════════════════════════════════════════ */}
          {activeTab === "broadcast" && (
            <View style={{ gap: 16 }}>
              {/* Form Kirim Siaran */}
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                    <AppIcon name="broadcast" size={18} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Kirim Siaran Notifikasi Massal</Text>
                    <Text style={styles.cardSubtitle}>
                      Pesan akan langsung muncul sebagai banner real-time di layar seluruh pengguna aktif dan tersimpan di database.
                    </Text>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Judul Notifikasi</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={broadcastTitle}
                    onChangeText={setBroadcastTitle}
                    placeholder="Contoh: Event Rate-Up Gacha Banner & Bonus Crystal!"
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={[styles.rowTwoCols, !isWide && { flexDirection: "column" }]}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Tipe Kategori Pesan</Text>
                    <View style={styles.typeSelectorRow}>
                      {(["system", "promo", "maintenance", "event"] as const).map((t) => (
                        <Pressable
                          key={t}
                          style={[
                            styles.typeChip,
                            broadcastType === t && styles.typeChipActive,
                          ]}
                          onPress={() => {
                            hapticLight();
                            setBroadcastType(t);
                          }}
                        >
                          <Text
                            style={[
                              styles.typeChipText,
                              broadcastType === t && styles.typeChipTextActive,
                            ]}
                          >
                            {t.toUpperCase()}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Tautan Tindakan (Opsional)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={broadcastUrl}
                      onChangeText={setBroadcastUrl}
                      placeholder="/store/gacha atau https://..."
                      placeholderTextColor="#64748B"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Isi Pesan Notifikasi</Text>
                  <TextInput
                    style={[styles.fieldInput, { height: 80, textAlignVertical: "top" }]}
                    value={broadcastMessage}
                    onChangeText={setBroadcastMessage}
                    multiline
                    placeholder="Tuliskan detail pengumuman atau instruksi untuk seluruh pemain..."
                    placeholderTextColor="#64748B"
                  />
                </View>

                {/* SEND BROADCAST BUTTON (SILVER LIQUID GLASS) */}
                <Pressable
                  style={[styles.primaryActionBtnSilver, isSending && { opacity: 0.6 }]}
                  onPress={handleSendBroadcast}
                  disabled={isSending}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <AppIcon name="send" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryActionBtnSilverText}>Kirim Siaran Sekarang</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {/* History Broadcasts */}
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
                    <AppIcon name="history" size={18} color="#CBD5E1" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Riwayat Siaran Terkirim ({broadcasts.length})</Text>
                    <Text style={styles.cardSubtitle}>
                      Daftar notifikasi broadcast yang telah disiarkan ke seluruh perangkat pengguna.
                    </Text>
                  </View>
                  {broadcasts.length > 0 && (
                    <Pressable
                      onPress={handleClearAllBroadcasts}
                      style={styles.dangerLiquidBtn}
                    >
                      <AppIcon name="trash-can-outline" size={14} color="#F43F5E" />
                      <Text style={styles.dangerLiquidBtnText}>Bersihkan Semua</Text>
                    </Pressable>
                  )}
                </View>

                {broadcasts.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppIcon name="bell-cancel-outline" size={40} color="#64748B" />
                    <Text style={styles.emptyTitle}>Belum Ada Riwayat Siaran</Text>
                    <Text style={styles.emptySubtitle}>
                      Gunakan formulir di atas untuk mengirimkan siaran pemberitahuan baru ke seluruh pemain Nuenime.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.historyListWrap}>
                    {broadcasts.map((b) => (
                      <View key={b.id} style={styles.historyCard}>
                        <View style={styles.historyTopRow}>
                          <View style={styles.historyBadgeSilver}>
                            <Text style={styles.historyBadgeSilverText}>{b.type.toUpperCase()}</Text>
                          </View>
                          <Text style={styles.historyTimeText}>
                            {new Date(b.createdAt).toLocaleString("id-ID")}
                          </Text>
                          <View style={{ flex: 1 }} />
                          <Text style={styles.historyCountText}>
                            Kepada: {b.recipientsCount} Akun
                          </Text>
                          <Pressable
                            onPress={() => handleDeleteBroadcast(b.id)}
                            style={styles.deleteMiniBtn}
                            hitSlop={8}
                          >
                            <AppIcon name="trash-can-outline" size={13} color="#F43F5E" />
                            <Text style={styles.deleteMiniBtnText}>Hapus</Text>
                          </Pressable>
                        </View>
                        <Text style={styles.historyItemTitle}>{b.title}</Text>
                        <Text style={styles.historyItemMessage}>{b.message}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      {/* ─── POPUP ANNOUNCEMENT PREVIEW MODAL ─── */}
      <AppAnnouncementModal
        previewConfig={showAnnouncementPreview ? announcementConfig : null}
        onClosePreview={() => setShowAnnouncementPreview(false)}
      />
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  // ── Top KPI Strip (Persis Admin Gacha & Borders Theme)
  kpiStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 14,
    gap: 16,
  },
  kpiStripMobile: {
    flexWrap: "wrap",
    gap: 12,
  },
  kpiStripItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 130,
  },
  kpiStripIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiStripLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#64748B",
  },
  kpiStripVal: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
    marginTop: 2,
  },
  kpiStripDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },

  // ── Info Banner (Persis Admin Gacha & Borders Theme)
  infoBanner: {
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 14,
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  infoBannerTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  infoBannerText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
    marginTop: 2,
  },

  // ── Tab Navigation (Chip Style Sesuai Admin Gacha & Borders)
  tabNavWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  tabBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  tabBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },

  // ── Floating Action Toast (Persis Gacha Theme)
  floatingToast: {
    position: "absolute",
    top: 14,
    right: 20,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  toastSuccess: {
    backgroundColor: "#065F46",
    borderColor: "#10B981",
  },
  toastError: {
    backgroundColor: "#881337",
    borderColor: "#F43F5E",
  },
  toastText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  loadingWrap: {
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
  },
  contentWrap: {
    gap: 16,
  },

  // ── Generic Content Card (Persis Gacha Content Card Style)
  contentCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
  },
  cardHeaderIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  cardTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  cardSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },
  versionBadgeSilver: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.20)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  versionBadgeSilverText: {
    fontFamily: "Nunito-Black",
    fontSize: 11.5,
    color: "#FFFFFF",
  },

  // ── GitHub Sync Card (Liquid Glass Silver)
  githubSyncCard: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  githubSyncHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  githubIconBox: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  githubSyncTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  githubSyncDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
    marginTop: 2,
  },
  githubInputRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  githubInputWrap: {
    flex: 1,
    minWidth: 260,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cleanInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
    padding: 0,
  },
  syncFeedbackBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 6,
  },
  syncSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  syncError: {
    backgroundColor: "rgba(244, 63, 94, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
  },
  syncFeedbackText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    flex: 1,
    lineHeight: 16,
  },

  // ── Form Inputs (Silver Liquid Glass Border)
  rowTwoCols: {
    flexDirection: "row",
    gap: 12,
  },
  formGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  fieldHint: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
    lineHeight: 14,
  },
  fieldInput: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
  },

  // ── Toggle Switch Row
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  toggleTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  toggleDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
    lineHeight: 15,
  },

  // ── Status Alert Card (Popup & Maintenance)
  statusAlertCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
  },
  popupActiveBg: {
    backgroundColor: "rgba(6, 182, 212, 0.08)",
    borderColor: "rgba(6, 182, 212, 0.25)",
  },
  maintActiveBg: {
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    borderColor: "rgba(244, 63, 94, 0.25)",
  },
  maintInactiveBg: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  maintStatusTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  maintStatusDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
    lineHeight: 15,
  },

  // ── Button Config Sections
  buttonConfigSection: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  buttonSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonSectionTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },

  // ── Type Selector (Broadcast)
  typeSelectorRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  typeChipActive: {
    backgroundColor: "rgba(245, 158, 11, 0.14)",
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  typeChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  typeChipTextActive: {
    color: "#F59E0B",
    fontFamily: "Nunito-Black",
  },

  // ── History List (Broadcast)
  historyListWrap: {
    gap: 10,
  },
  historyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    gap: 6,
  },
  historyTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  historyBadgeSilver: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  historyBadgeSilverText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    color: "#CBD5E1",
  },
  historyTimeText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },
  historyCountText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },
  deleteMiniBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.20)",
  },
  deleteMiniBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#F43F5E",
  },
  historyItemTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  historyItemMessage: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 17,
  },

  // ── Empty State Card
  emptyCard: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
    marginTop: 4,
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 380,
  },

  // ── SILVER LIQUID GLASS BUTTONS (PERSIS USER REQUEST & GACHA THEME)
  primaryActionBtnSilver: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionBtnSilverText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  silverLiquidBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  silverLiquidBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  silverLiquidSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 7,
  },
  silverLiquidSecondaryBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  silverLiquidSecondaryBtnLarge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  silverLiquidSecondaryBtnLargeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#CBD5E1",
  },
  actionRowTwoButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  dangerLiquidBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.24)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  dangerLiquidBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#F43F5E",
  },
});
