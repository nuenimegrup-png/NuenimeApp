import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";

import { useAnirakuAuth } from "@/providers/auth-provider";
import { useWatchStats } from "@/hooks/use-watch-stats";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { readNotificationPrefs, emitNotificationPrefsChanged } from "@/providers/notifications-provider";
import { avatarUrl, isDefaultAvatar } from "@/lib/aniraku-avatars";
import { AppIcon } from "@/components/app-icon";
import { BorderAvatar } from "@/components/border-avatar";
import { getEquippedBorderId } from "@/lib/avatar-borders";
import {
  BANNER_COOLDOWN_SECONDS,
  NAME_COOLDOWN_SECONDS,
  getProfileCooldownStatus,
  validateImageUrl,
  extractDirectImageUrl,
} from "@/lib/profile-cooldown";
import {
  setHapticsEnabled,
  isHapticsEnabled,
  hapticLight,
  hapticSuccess,
  hapticWarning,
} from "@/lib/haptics";
import {
  loadSubtitlePreferences,
  saveSubtitlePreferences,
  type SubtitlePreferences,
} from "@/lib/subtitle-preferences";
import { checkForAnirakuUpdate } from "@/lib/app-update";
import { LevelProgressModal, getTierForLevel } from "@/components/level-progress-modal";
import { getLevelProgressInfo } from "@/lib/user-level";
import {
  loadAccountSettings,
  saveAccountSettings,
  loadPlaybackSettings,
  savePlaybackSetting,
  loadWifiOnlySetting,
  saveWifiOnlySetting,
} from "@/lib/user-settings";
import { calculateAppCacheSize, clearAllAppCache } from "@/lib/app-cache";
import { LOCAL_WATCH_KEY_PREFIX } from "@/lib/watch-progress";

export default function SettingsScreen() {
  const auth = useAnirakuAuth();
  const stats = useWatchStats();
  const history = useWatchHistory();

  // ─── Playback Preferences ───
  const [autoPlay, setAutoPlay] = useState(false);
  const [gestures, setGestures] = useState(true);
  const [skipIntro, setSkipIntro] = useState(false);
  const [introDuration, setIntroDuration] = useState("85s");
  const [showIntroModal, setShowIntroModal] = useState(false);

  const [quality, setQuality] = useState("720p");
  const [showQualityModal, setShowQualityModal] = useState(false);

  // ─── Subtitle Preferences (Original Feature) ───
  const [subPrefs, setSubPrefs] = useState<SubtitlePreferences | null>(null);
  const [showSubLangModal, setShowSubLangModal] = useState(false);
  const [showSubSizeModal, setShowSubSizeModal] = useState(false);

  // ─── Account & Profile (Isolated Per Account) ───
  const [privateProfile, setPrivateProfile] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [showEditBannerModal, setShowEditBannerModal] = useState(false);
  const [bannerInput, setBannerInput] = useState("");
  const [savingBanner, setSavingBanner] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerPreviewFailed, setBannerPreviewFailed] = useState(false);
  const [, setCooldownTick] = useState(0);

  useEffect(() => {
    if (!showEditNameModal && !showEditBannerModal) return;
    const interval = setInterval(() => setCooldownTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, [showEditNameModal, showEditBannerModal]);

  // ─── Notification & System ───
  const [notifTopic, setNotifTopic] = useState(true);
  const [hapticsOn, setHapticsOn] = useState(isHapticsEnabled());

  // ─── Downloads ───
  const [wifiOnly, setWifiOnly] = useState(true);

  // ─── Cache State (Real Calculation) ───
  const [cacheSize, setCacheSize] = useState("Memuat...");

  // ─── App Version & Update ───
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const appVersion = `Nuenime v${Constants.expoConfig?.version || "0.0.1"} (${
    Constants.expoConfig?.android?.versionCode || 1
  })`;

  // Load account-specific settings whenever auth user changes (isolating Account A and B)
  useEffect(() => {
    let active = true;
    void loadAccountSettings(auth.user?.id).then((accountSettings) => {
      if (active) setPrivateProfile(accountSettings.privateProfile);
    });
    return () => {
      active = false;
    };
  }, [auth.user?.id]);

  // Load device preferences and cache
  useEffect(() => {
    let active = true;

    void loadPlaybackSettings().then((pb) => {
      if (!active) return;
      setAutoPlay(pb.autoPlay);
      setGestures(pb.gestures);
      setSkipIntro(pb.skipIntro);
      setIntroDuration(pb.introDuration);
      setQuality(pb.quality);
    });

    void loadWifiOnlySetting().then((v) => {
      if (active) setWifiOnly(v);
    });

    void readNotificationPrefs().then((np) => {
      if (active) setNotifTopic(np.newEpisodes);
    });

    void calculateAppCacheSize().then((res) => {
      if (active) setCacheSize(res.formatted);
    });

    void loadSubtitlePreferences().then((sp) => {
      if (active) setSubPrefs(sp);
    });

    setHapticsOn(isHapticsEnabled());

    return () => {
      active = false;
    };
  }, []);

  const toggleAutoPlay = (value: boolean) => {
    hapticLight();
    setAutoPlay(value);
    void savePlaybackSetting("autoPlay", value);
  };

  const toggleGestures = (value: boolean) => {
    hapticLight();
    setGestures(value);
    void savePlaybackSetting("gestures", value);
  };

  const toggleSkipIntro = (value: boolean) => {
    hapticLight();
    setSkipIntro(value);
    void savePlaybackSetting("skipIntro", value);
  };

  const chooseIntroDuration = (val: string) => {
    hapticLight();
    setIntroDuration(val);
    setShowIntroModal(false);
    void savePlaybackSetting("introDuration", val);
  };

  const chooseQuality = (selected: string) => {
    hapticLight();
    setQuality(selected);
    setShowQualityModal(false);
    void savePlaybackSetting("quality", selected);
  };

  const chooseSubLang = (lang: string) => {
    hapticLight();
    setShowSubLangModal(false);
    void saveSubtitlePreferences({ preferredLanguage: lang }).then(setSubPrefs);
  };

  const chooseSubFontSize = (size: number) => {
    hapticLight();
    setShowSubSizeModal(false);
    void saveSubtitlePreferences({ fontSize: size }).then(setSubPrefs);
  };

  const togglePrivateProfile = (value: boolean) => {
    hapticLight();
    setPrivateProfile(value);
    void saveAccountSettings({ privateProfile: value }, auth.user?.id);
  };

  const toggleWifiOnly = (value: boolean) => {
    hapticLight();
    setWifiOnly(value);
    void saveWifiOnlySetting(value);
  };

  const toggleHaptics = (value: boolean) => {
    setHapticsOn(value);
    setHapticsEnabled(value);
    if (value) hapticLight();
  };

  const toggleNotifTopic = async (value: boolean) => {
    hapticLight();
    setNotifTopic(value);
    try {
      const current = await readNotificationPrefs();
      const updated = { ...current, newEpisodes: value };
      await AsyncStorage.setItem("aniraku.notificationprefs", JSON.stringify(updated));
      emitNotificationPrefsChanged();
    } catch {}
  };

  // Real disk cache clearing with calculateAppCacheSize
  const clearAppCache = () => {
    hapticLight();
    Alert.alert("Bersihkan Cache?", "Ini akan membersihkan thumbnail gambar dan file cache sementara.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Bersihkan",
        onPress: async () => {
          try {
            await clearAllAppCache();
            const recalculated = await calculateAppCacheSize();
            setCacheSize(recalculated.formatted);
          } catch {
            setCacheSize("0.0 MB");
          }
          hapticSuccess();
          Alert.alert("Cache Dibersihkan", "Penyimpanan cache sementara aplikasi berhasil dikosongkan.");
        },
      },
    ]);
  };

  // Real watch history clearing (both Supabase and local storage cache)
  const handleClearHistory = () => {
    hapticWarning();
    Alert.alert(
      "Hapus Semua Riwayat?",
      "Seluruh riwayat anime yang pernah Anda tonton akan dihapus secara permanen.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus Semua",
          style: "destructive",
          onPress: async () => {
            try {
              await history.clear.mutateAsync();
              // Also purge local device-level watch history keys
              const allKeys = await AsyncStorage.getAllKeys();
              const historyKeys = allKeys.filter(
                (k) => k.startsWith(LOCAL_WATCH_KEY_PREFIX) || k.startsWith("aniraku.history-cache.v1:")
              );
              if (historyKeys.length > 0) {
                await AsyncStorage.multiRemove(historyKeys);
              }
              hapticSuccess();
              Alert.alert("Riwayat Dihapus", "Seluruh riwayat tontonan berhasil dibersihkan.");
            } catch {
              Alert.alert("Gagal", "Tidak dapat menghapus riwayat saat ini.");
            }
          },
        },
      ]
    );
  };

  // Real cooldown calculation for Name (24h) and Banner (7d)
  const bannerCooldown = getProfileCooldownStatus(
    auth.profile?.banner_updated_at,
    BANNER_COOLDOWN_SECONDS,
    "banner"
  );
  const nameCooldown = getProfileCooldownStatus(
    auth.profile?.name_updated_at,
    NAME_COOLDOWN_SECONDS,
    "nama"
  );

  // Real display name update to Supabase (enforces 24-hour cooldown & validation)
  const handleSaveDisplayName = async () => {
    const cleanName = nameInput.trim();
    if (!nameCooldown.canChange) {
      setNameError(nameCooldown.message);
      return;
    }
    if (cleanName.length < 2) {
      setNameError("Nama tampilan minimal 2 karakter.");
      return;
    }
    if (cleanName.length > 30) {
      setNameError("Nama tampilan maksimal 30 karakter.");
      return;
    }

    setNameError(null);
    setSavingName(true);
    try {
      await auth.updateDisplayName(cleanName);
      hapticSuccess();
      setShowEditNameModal(false);
      Alert.alert("Sukses", "Nama tampilan berhasil diperbarui.");
    } catch (err: any) {
      const msg = err?.message || "Terjadi kesalahan saat menyimpan nama.";
      setNameError(msg);
      Alert.alert("Gagal Memperbarui", msg);
    } finally {
      setSavingName(false);
    }
  };

  // Real banner URL update to Supabase (enforces 7-day cooldown & image validation)
  const handleSaveBannerUrl = async () => {
    const cleanBanner = extractDirectImageUrl(bannerInput.trim());
    if (!bannerCooldown.canChange) {
      setBannerError(bannerCooldown.message);
      return;
    }
    const validation = validateImageUrl(cleanBanner);
    if (!validation.valid) {
      setBannerError(validation.error || "URL banner tidak valid.");
      return;
    }

    setBannerError(null);
    setSavingBanner(true);
    try {
      await auth.updateBanner(cleanBanner);
      hapticSuccess();
      setShowEditBannerModal(false);
      Alert.alert("Sukses", "Banner profil berhasil diperbarui.");
    } catch (err: any) {
      const msg = err?.message || "Terjadi kesalahan saat menyimpan banner.";
      setBannerError(msg);
      Alert.alert("Gagal Memperbarui", msg);
    } finally {
      setSavingBanner(false);
    }
  };

  const handlePasteBannerUrl = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        const extracted = extractDirectImageUrl(text.trim());
        setBannerInput(extracted);
        setBannerError(null);
        setBannerPreviewFailed(false);
        hapticLight();
      }
    } catch {}
  };

  // Check app update
  const handleCheckUpdate = async () => {
    hapticLight();
    setCheckingUpdate(true);
    try {
      const res = await checkForAnirakuUpdate(Constants.expoConfig?.version || "0.0.1", { force: true });
      if (res.available && res.release) {
        Alert.alert(
          "Pembaruan Tersedia!",
          `Versi ${res.release.name} telah rilis. Ingin mengunduh sekarang?`,
          [
            { text: "Nanti", style: "cancel" },
            {
              text: "Unduh Sekarang",
              onPress: () => {
                if (res.release?.downloadUrl) {
                  void Linking.openURL(res.release.downloadUrl);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert("Aplikasi Terkini", `Nuenime v${Constants.expoConfig?.version || "0.0.1"} sudah merupakan versi terbaru.`);
      }
    } catch {
      Alert.alert("Info Versi", `Nuenime v${Constants.expoConfig?.version || "0.0.1"} adalah versi aktif.`);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleSignOut = () => {
    hapticLight();
    setShowLogoutModal(true);
  };

  const confirmSignOut = async () => {
    hapticLight();
    setLoggingOut(true);
    try {
      await auth.signOut();
      setShowLogoutModal(false);
      if (router.canGoBack()) {
        router.back();
      }
      router.replace("/(tabs)" as never);
    } catch (err) {
      console.error("Sign out error:", err);
      setShowLogoutModal(false);
    } finally {
      setLoggingOut(false);
    }
  };

  // ─── Profile Info Sync ───
  const username =
    auth.profile?.username ||
    auth.user?.user_metadata?.username ||
    auth.user?.email?.split("@")[0] ||
    "User";

  const displayName =
    auth.profile?.display_name ||
    auth.user?.user_metadata?.full_name ||
    auth.user?.user_metadata?.name ||
    username;

  const email = auth.user?.email || "user@gmail.com";

  const googleAvatar =
    auth.user?.user_metadata?.avatar_url ||
    auth.user?.user_metadata?.picture ||
    auth.user?.identities?.[0]?.identity_data?.avatar_url ||
    auth.user?.identities?.[0]?.identity_data?.picture ||
    null;

  const rawAvatar =
    auth.profile?.avatar_url && !isDefaultAvatar(auth.profile.avatar_url)
      ? auth.profile.avatar_url
      : (googleAvatar || auth.profile?.avatar_url);

  const avatar = rawAvatar ? avatarUrl(rawAvatar) : null;
  const initialLetter = (displayName || username).trim().charAt(0).toUpperCase() || "N";
  const [equippedBorderId, setEquippedBorderId] = useState<string | null>(null);

  useEffect(() => {
    getEquippedBorderId(auth.user?.id).then((id) => setEquippedBorderId(id));
  }, [auth.user?.id]);

  // ─── Real Individual XP & Level from Database ───
  const userExp = Math.max(0, Number(auth.profile?.exp || 0));
  const levelInfo = getLevelProgressInfo(userExp);
  const userLevel = auth.profile?.level ?? levelInfo.level;
  const currentXP = userExp;
  const progressPercent = levelInfo.progressPercent;
  const xpRemaining = levelInfo.xpRemaining;

  const subLangLabel =
    subPrefs?.preferredLanguage === "id"
      ? "Indonesia"
      : subPrefs?.preferredLanguage === "jp"
        ? "Jepang (Romaji)"
        : "English";

  const subSizeLabel =
    subPrefs?.fontSize === 12
      ? "Kecil (12px)"
      : subPrefs?.fontSize === 16
        ? "Besar (16px)"
        : subPrefs?.fontSize === 18
          ? "Ekstra (18px)"
          : "Standar (14px)";

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* ─── TOP APP BAR (HEADER PENGATURAN) ─── */}
      <View style={styles.headerBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
          hitSlop={12}
        >
          <AppIcon name="chevron-left" size={26} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Pengaturan</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 1. USER PROFILE CARD (TOP CARD) ─── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <BorderAvatar
              avatarUrl={avatar}
              fallbackText={initialLetter}
              borderId={equippedBorderId}
              avatarSize={50}
            />
          </View>
          <View style={styles.profileTextWrap}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.profileName} numberOfLines={1}>
                {displayName}
              </Text>
              <Pressable
                onPress={() => {
                  setNameInput(displayName);
                  setNameError(null);
                  setShowEditNameModal(true);
                }}
                hitSlop={8}
                style={[
                  styles.editNameIconBtn,
                  !nameCooldown.canChange && { backgroundColor: "rgba(245, 158, 11, 0.12)" },
                ]}
              >
                <AppIcon
                  name={!nameCooldown.canChange ? "clock-outline" : "pencil"}
                  size={14}
                  color={!nameCooldown.canChange ? "#F59E0B" : "#38BDF8"}
                />
              </Pressable>
            </View>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {email}
            </Text>
          </View>
        </View>

        {/* ─── 2. XP & LEVEL CARD (DYNAMIC REAL CALCULATION) ─── */}
        <View style={styles.xpCard}>
          {/* Top Row: Badges & Leaderboard Button */}
          <View style={styles.xpTopRow}>
            <View style={styles.xpBadgesRow}>
              <View style={styles.xpBadgePill}>
                <Text style={styles.xpBadgeText}>XP {currentXP}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Lihat Level Progress"
                onPress={() => {
                  hapticLight();
                  setShowLeaderboardModal(true);
                }}
                style={({ pressed }) => [styles.levelBadgePill, pressed && styles.btnPressed]}
              >
                <Image
                  source={{ uri: getTierForLevel(userLevel).currentTier.imageUrl }}
                  style={{ width: 17, height: 17 }}
                  contentFit="contain"
                  transition={150}
                  cachePolicy="memory-disk"
                />
                <Text style={styles.levelBadgeText}>Lvl. {userLevel}</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticLight();
                setShowLeaderboardModal(true);
              }}
              style={({ pressed }) => [styles.leaderboardBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.leaderboardText}>Leaderboard XP</Text>
              <AppIcon name="chevron-right" size={14} color="#A1A1AA" />
            </Pressable>
          </View>

          {/* Middle Row: Sisa XP & Persentase Nyata */}
          <View style={styles.xpProgressMeta}>
            <Text style={styles.xpMetaText}>
              Sisa {xpRemaining.toLocaleString("id-ID")} XP ke Lvl. {userLevel + 1}
            </Text>
            <Text style={styles.xpPercentText}>{progressPercent}%</Text>
          </View>

          {/* Bottom Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            <View style={[styles.progressDot, { left: `${progressPercent}%` }]} />
          </View>
        </View>

        {/* ─── 3. SEKSI PROFIL ─── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Profil</Text>
          <View style={styles.cardGroup}>
            {/* Nama profil */}
            <Pressable
              onPress={() => {
                setNameInput(displayName);
                setNameError(null);
                setShowEditNameModal(true);
              }}
              style={({ pressed }) => [styles.rowItemClickable, styles.rowBorder, pressed && styles.btnPressed]}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Nama profil</Text>
                <Text style={styles.rowSubLabel}>
                  {!nameCooldown.canChange
                    ? `${displayName} • Cooldown (${nameCooldown.remainingText})`
                    : displayName}
                </Text>
              </View>
              <View style={styles.rowRightWrap}>
                <Text
                  style={[
                    styles.actionEditText,
                    !nameCooldown.canChange && { color: "#F59E0B" },
                  ]}
                >
                  {!nameCooldown.canChange ? "Cooldown" : "Ubah"}
                </Text>
                <AppIcon
                  name={!nameCooldown.canChange ? "clock-outline" : "pencil"}
                  size={13}
                  color={!nameCooldown.canChange ? "#F59E0B" : "#38BDF8"}
                />
              </View>
            </Pressable>

            {/* Banner URL */}
            <Pressable
              onPress={() => {
                setBannerInput(auth.profile?.banner_url || "");
                setBannerError(null);
                setBannerPreviewFailed(false);
                setShowEditBannerModal(true);
              }}
              style={({ pressed }) => [styles.rowItemClickable, styles.rowBorder, pressed && styles.btnPressed]}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Banner URL</Text>
                <Text style={styles.rowSubLabel} numberOfLines={1}>
                  {!bannerCooldown.canChange
                    ? `Cooldown: ${bannerCooldown.remainingText}`
                    : (auth.profile?.banner_url ? auth.profile.banner_url : "Belum diatur (Default)")}
                </Text>
              </View>
              <View style={styles.rowRightWrap}>
                <Text
                  style={[
                    styles.actionEditText,
                    !bannerCooldown.canChange && { color: "#F59E0B" },
                  ]}
                >
                  {!bannerCooldown.canChange ? "Cooldown" : (auth.profile?.banner_url ? "Ubah" : "Atur")}
                </Text>
                <AppIcon
                  name={!bannerCooldown.canChange ? "clock-outline" : "pencil"}
                  size={13}
                  color={!bannerCooldown.canChange ? "#F59E0B" : "#38BDF8"}
                />
              </View>
            </Pressable>

            {/* Profil private */}
            <View style={[styles.rowItem, styles.rowBorder]}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Profil private</Text>
                <Text style={styles.rowSubLabel}>Sembunyikan aktivitas tontonan dari publik</Text>
              </View>
              <Switch
                value={privateProfile}
                onValueChange={togglePrivateProfile}
                trackColor={{ false: "#27272A", true: "#2563EB" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Akses Inventory Nuenime */}
            <Pressable
              onPress={() => {
                hapticLight();
                router.push("/inventory" as never);
              }}
              style={({ pressed }) => [styles.rowItemClickable, pressed && styles.btnPressed]}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Nuenime Inventory</Text>
                <Text style={styles.rowSubLabel}>Koleksi avatar border, profil effects & title</Text>
              </View>
              <View style={styles.rowRightWrap}>
                <AppIcon name="chevron-right" size={16} color="#71717A" />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ─── 4. SEKSI PEMUTARAN (PLAYBACK) ─── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Pemutaran Video</Text>
          <View style={styles.cardGroup}>
            {/* Auto play */}
            <View style={[styles.rowItem, styles.rowBorder]}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Auto play episode berikutnya</Text>
                <Text style={styles.rowSubLabel}>Lanjut otomatis setelah episode selesai</Text>
              </View>
              <Switch
                value={autoPlay}
                onValueChange={toggleAutoPlay}
                trackColor={{ false: "#27272A", true: "#2563EB" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Kontrol brightness & volume */}
            <View style={[styles.rowItem, styles.rowBorder]}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Kontrol brightness & volume</Text>
                <Text style={styles.rowSubLabel}>Tampilkan tombol geser brightness dan volume di pemutar</Text>
              </View>
              <Switch
                value={gestures}
                onValueChange={toggleGestures}
                trackColor={{ false: "#27272A", true: "#2563EB" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Skip intro */}
            <View style={[styles.rowItem, styles.rowBorder]}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Skip intro</Text>
                <Text style={styles.rowSubLabel}>Tampilkan tombol untuk lompat intro lagu pembuka</Text>
              </View>
              <Switch
                value={skipIntro}
                onValueChange={toggleSkipIntro}
                trackColor={{ false: "#27272A", true: "#2563EB" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Durasi intro default (Bisa Diklik & Dipilih) */}
            <Pressable
              onPress={() => setShowIntroModal(true)}
              style={({ pressed }) => [styles.rowItemClickable, styles.rowBorder, pressed && styles.btnPressed]}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Durasi intro default</Text>
                <Text style={styles.rowSubLabel}>Waktu lompatan tombol skip intro</Text>
              </View>
              <View style={styles.rowRightWrap}>
                <Text style={styles.rowRightTextActive}>{introDuration}</Text>
                <AppIcon name="chevron-right" size={16} color="#71717A" />
              </View>
            </Pressable>

            {/* Kualitas default */}
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowQualityModal(true)}
              style={({ pressed }) => [styles.rowItemClickable, pressed && styles.btnPressed]}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Kualitas video default</Text>
                <Text style={styles.rowSubLabel}>Resolusi awal saat streaming dimulai</Text>
              </View>
              <View style={styles.rowRightWrap}>
                <Text style={styles.rowRightTextActive}>{quality}</Text>
                <AppIcon name="chevron-right" size={16} color="#71717A" />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ─── 5. SEKSI SUBTITLE (FITUR ASLI) ─── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Subtitle & Bahasa</Text>
          <View style={styles.cardGroup}>
            {/* Bahasa Subtitle Utama */}
            <Pressable
              onPress={() => setShowSubLangModal(true)}
              style={({ pressed }) => [styles.rowItemClickable, styles.rowBorder, pressed && styles.btnPressed]}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Bahasa Subtitle Preferensi</Text>
                <Text style={styles.rowSubLabel}>Prioritas subtitle yang dipilih otomatis</Text>
              </View>
              <View style={styles.rowRightWrap}>
                <Text style={styles.rowRightTextActive}>{subLangLabel}</Text>
                <AppIcon name="chevron-right" size={16} color="#71717A" />
              </View>
            </Pressable>

            {/* Ukuran Font Subtitle */}
            <Pressable
              onPress={() => setShowSubSizeModal(true)}
              style={({ pressed }) => [styles.rowItemClickable, pressed && styles.btnPressed]}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Ukuran Teks Subtitle</Text>
                <Text style={styles.rowSubLabel}>Skala besar kecilnya huruf subtitle video</Text>
              </View>
              <View style={styles.rowRightWrap}>
                <Text style={styles.rowRightTextActive}>{subSizeLabel}</Text>
                <AppIcon name="chevron-right" size={16} color="#71717A" />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ─── 6. SEKSI UNDUHAN & OFFLINE (FITUR ASLI) ─── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Unduhan & Offline</Text>
          <View style={styles.cardGroup}>
            {/* Download Wi-Fi Only */}
            <View style={[styles.rowItem, styles.rowBorder]}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Unduh hanya lewat Wi-Fi</Text>
                <Text style={styles.rowSubLabel}>Mencegah pemborosan kuota data seluler</Text>
              </View>
              <Switch
                value={wifiOnly}
                onValueChange={toggleWifiOnly}
                trackColor={{ false: "#27272A", true: "#2563EB" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Menu Kelola Unduhan */}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticLight();
                router.push("/downloads" as never);
              }}
              style={({ pressed }) => [styles.rowItemClickable, pressed && styles.btnPressed]}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Kelola Episode Terunduh</Text>
                <Text style={styles.rowSubLabel}>Lihat dan hapus episode offline yang tersimpan</Text>
              </View>
              <View style={styles.rowRightWrap}>
                <AppIcon name="chevron-right" size={16} color="#71717A" />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ─── 8. SEKSI NOTIFIKASI & SISTEM ─── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Notifikasi & Sistem</Text>
          <View style={styles.cardGroup}>
            {/* Topic Anime Update */}
            <View style={[styles.rowItem, styles.rowBorder]}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Notifikasi Episode Baru</Text>
                <Text style={styles.rowSubLabel}>Pemberitahuan saat anime bookmark rilis episode baru</Text>
              </View>
              <Switch
                value={notifTopic}
                onValueChange={toggleNotifTopic}
                trackColor={{ false: "#27272A", true: "#2563EB" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Efek Getar / Haptics */}
            <View style={styles.rowItem}>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Getaran Haptic Feedback</Text>
                <Text style={styles.rowSubLabel}>Respon getar saat tombol ditekan</Text>
              </View>
              <Switch
                value={hapticsOn}
                onValueChange={toggleHaptics}
                trackColor={{ false: "#27272A", true: "#2563EB" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* ─── 9. SEKSI PENYIMPANAN & DATA ─── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Penyimpanan & Data</Text>
          <View style={styles.cardGroup}>
            {/* Bersihkan Cache Gambar (Real) */}
            <Pressable
              accessibilityRole="button"
              onPress={clearAppCache}
              style={({ pressed }) => [styles.rowItemClickable, styles.rowBorder, pressed && styles.btnPressed]}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Bersihkan Cache Gambar</Text>
                <Text style={styles.rowSubLabel}>Kosongkan memori penyimpanan thumbnail</Text>
              </View>
              <View style={styles.rowRightWrap}>
                <Text style={styles.rowRightText}>{cacheSize}</Text>
                <AppIcon name="chevron-right" size={16} color="#71717A" />
              </View>
            </Pressable>

            {/* Bersihkan Riwayat Tontonan (Real) */}
            <Pressable
              accessibilityRole="button"
              onPress={handleClearHistory}
              style={({ pressed }) => [styles.rowItemClickable, pressed && styles.btnPressed]}
            >
              <View style={styles.rowTextCol}>
                <Text style={[styles.rowLabel, { color: "#F87171" }]}>Hapus Riwayat Tontonan</Text>
                <Text style={styles.rowSubLabel}>Bersihkan semua jejak tontonan anime Anda</Text>
              </View>
              <View style={styles.rowRightWrap}>
                <AppIcon name="chevron-right" size={16} color="#71717A" />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ─── 10. SEKSI BANTUAN & LEGAL (FITUR ASLI) ─── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Dukungan & Legal</Text>
          <View style={styles.cardGroup}>
            {/* Dukungan & Donasi */}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticLight();
                router.push("/support" as never);
              }}
              style={({ pressed }) => [styles.rowItemClickable, styles.rowBorder, pressed && styles.btnPressed]}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Dukungan & Donasi</Text>
                <Text style={styles.rowSubLabel}>Bantu kelangsungan server & pengembangan Nuenime</Text>
              </View>
              <View style={styles.rowRightWrap}>
                <AppIcon name="chevron-right" size={16} color="#71717A" />
              </View>
            </Pressable>

            {/* Kebijakan Privasi & Ketentuan */}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticLight();
                router.push("/legal" as never);
              }}
              style={({ pressed }) => [styles.rowItemClickable, pressed && styles.btnPressed]}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Kebijakan Privasi & DMCA</Text>
                <Text style={styles.rowSubLabel}>Ketentuan layanan, hak cipta & privasi data</Text>
              </View>
              <View style={styles.rowRightWrap}>
                <AppIcon name="chevron-right" size={16} color="#71717A" />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ─── 11. SEKSI APLIKASI ─── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Tentang Aplikasi</Text>
          <View style={styles.cardGroup}>
            {/* Versi aplikasi + Tombol Cek Pembaruan */}
            <Pressable
              onPress={handleCheckUpdate}
              style={({ pressed }) => [styles.rowItemClickable, styles.rowBorder, pressed && styles.btnPressed]}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Versi Aplikasi</Text>
                <Text style={styles.rowSubLabel}>{appVersion}</Text>
              </View>
              <View style={styles.rowRightWrap}>
                {checkingUpdate ? (
                  <ActivityIndicator size="small" color="#38BDF8" />
                ) : (
                  <Text style={styles.actionCheckUpdateText}>Cek Update</Text>
                )}
                <AppIcon name="refresh" size={15} color="#38BDF8" />
              </View>
            </Pressable>

            {/* Developer */}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/developer" as never)}
              style={({ pressed }) => [styles.rowItem, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Developer</Text>
                <Text style={styles.rowSubLabel}>Tim Pengembang</Text>
              </View>
              <View style={styles.rowRightWrap}>
                <Text style={styles.rowRightText}>Team Nuenime</Text>
                <AppIcon name="chevron-right" size={16} color="#64748B" />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ─── 12. LOGOUT BUTTON CARD ─── */}
        <View style={styles.logoutCard}>
          <Pressable
            accessibilityRole="button"
            onPress={handleSignOut}
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.btnPressed]}
          >
            <AppIcon name="logout" size={18} color="#F87171" />
            <Text style={styles.logoutText}>Logout dari Akun</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════
          MODAL-MODAL INTERAKTIF (PILIHAN & AKSI NYATA)
          ══════════════════════════════════════════════════════════════ */}

      {/* Modal 1: Edit Nama Tampilan */}
      <Modal
        visible={showEditNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditNameModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowEditNameModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AppIcon name="pencil" size={20} color="#38BDF8" />
              <Text style={styles.modalTitle}>Ubah Nama Tampilan</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Nama ini akan muncul pada profil dan komentar Anda. Nama hanya dapat diubah 1 kali per 24 jam.
            </Text>

            {!nameCooldown.canChange && (
              <View style={styles.cooldownAlertBox}>
                <AppIcon name="clock-outline" size={16} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cooldownAlertTitle}>Batas Perubahan 24 Jam Aktif</Text>
                  <Text style={styles.cooldownAlertDesc}>
                    Nama dapat diganti lagi dalam {nameCooldown.remainingText}
                  </Text>
                </View>
              </View>
            )}

            <TextInput
              style={[
                styles.modalTextInput,
                !nameCooldown.canChange && styles.modalTextInputDisabled,
                nameError ? styles.modalTextInputError : null,
              ]}
              value={nameInput}
              onChangeText={(t) => {
                setNameInput(t);
                if (nameError) setNameError(null);
              }}
              placeholder="Masukkan nama baru..."
              placeholderTextColor="#71717A"
              maxLength={30}
              editable={nameCooldown.canChange && !savingName}
              autoFocus={nameCooldown.canChange}
            />

            <View style={styles.inputCharCountRow}>
              {nameError ? (
                <Text style={styles.inputErrorText}>{nameError}</Text>
              ) : (
                <Text style={styles.inputHintText}>2 - 30 karakter</Text>
              )}
              <Text style={styles.inputCharCountText}>{nameInput.trim().length}/30</Text>
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable
                onPress={() => setShowEditNameModal(false)}
                style={({ pressed }) => [styles.modalBtnSecondary, pressed && styles.btnPressed]}
              >
                <Text style={styles.modalBtnSecondaryText}>Batal</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveDisplayName}
                disabled={
                  savingName ||
                  !nameCooldown.canChange ||
                  nameInput.trim().length < 2 ||
                  nameInput.trim() === displayName
                }
                style={({ pressed }) => [
                  styles.modalBtnPrimary,
                  (savingName ||
                    !nameCooldown.canChange ||
                    nameInput.trim().length < 2 ||
                    nameInput.trim() === displayName) &&
                    styles.modalBtnDisabled,
                  pressed && styles.btnPressed,
                ]}
              >
                {savingName ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Simpan</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Edit Banner URL */}
      <Modal
        visible={showEditBannerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditBannerModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowEditBannerModal(false)}>
          <Pressable style={[styles.modalCard, { maxHeight: "88%" }]} onPress={(e) => e.stopPropagation()}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AppIcon name="camera" size={20} color="#38BDF8" />
              <Text style={styles.modalTitle}>Banner URL Profil</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Ganti banner profil dengan tautan gambar langsung (URL). Mendukung GIF animasi, PNG, JPG, dan JPEG. Banner hanya dapat diubah 1 kali per 7 hari.
            </Text>

            {!bannerCooldown.canChange && (
              <View style={styles.cooldownAlertBox}>
                <AppIcon name="clock-outline" size={16} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cooldownAlertTitle}>Batas Perubahan 7 Hari Aktif</Text>
                  <Text style={styles.cooldownAlertDesc}>
                    Banner dapat diganti lagi dalam {bannerCooldown.remainingText}
                  </Text>
                </View>
              </View>
            )}

            {/* Live Banner Preview Card */}
            <View style={styles.bannerPreviewContainer}>
              {bannerInput.trim().length > 0 && !bannerPreviewFailed ? (
                <Image
                  source={{ uri: bannerInput.trim() }}
                  style={styles.bannerPreviewImage}
                  contentFit="cover"
                  transition={150}
                  onError={() => setBannerPreviewFailed(true)}
                  onLoad={() => setBannerPreviewFailed(false)}
                />
              ) : (
                <View style={styles.bannerPreviewEmptyBox}>
                  <AppIcon
                    name={bannerPreviewFailed ? "alert-circle-outline" : "image-outline"}
                    size={28}
                    color={bannerPreviewFailed ? "#EF4444" : "#64748B"}
                  />
                  <Text style={[styles.bannerPreviewEmptyText, bannerPreviewFailed && { color: "#F87171" }]}>
                    {bannerPreviewFailed
                      ? "Gambar gagal dimuat atau tautan tidak valid"
                      : "Pratinjau banner akan ditampilkan di sini"}
                  </Text>
                </View>
              )}
              {/* Format Support Badges */}
              <View style={styles.formatBadgesRow}>
                {["GIF Animasi", "PNG", "JPG", "JPEG"].map((fmt) => (
                  <View key={fmt} style={styles.formatBadge}>
                    <Text style={styles.formatBadgeText}>{fmt}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Input with Paste Helper */}
            <View style={styles.bannerInputWrap}>
              <TextInput
                style={[
                  styles.modalTextInput,
                  styles.bannerTextInput,
                  !bannerCooldown.canChange && styles.modalTextInputDisabled,
                  bannerError ? styles.modalTextInputError : null,
                ]}
                value={bannerInput}
                onChangeText={(t) => {
                  setBannerInput(t);
                  setBannerPreviewFailed(false);
                  if (bannerError) setBannerError(null);
                }}
                placeholder="https://contoh.com/banner.gif"
                placeholderTextColor="#71717A"
                autoCapitalize="none"
                autoCorrect={false}
                editable={bannerCooldown.canChange && !savingBanner}
                autoFocus={bannerCooldown.canChange}
              />
              {bannerCooldown.canChange && (
                <Pressable
                  onPress={handlePasteBannerUrl}
                  style={({ pressed }) => [styles.bannerPasteBtn, pressed && styles.btnPressed]}
                >
                  <AppIcon name="clipboard-outline" size={15} color="#38BDF8" />
                  <Text style={styles.bannerPasteText}>Tempel</Text>
                </Pressable>
              )}
            </View>

            {bannerError ? (
              <Text style={styles.inputErrorText}>{bannerError}</Text>
            ) : null}

            <View style={styles.modalBtnRow}>
              <Pressable
                onPress={() => setShowEditBannerModal(false)}
                style={({ pressed }) => [styles.modalBtnSecondary, pressed && styles.btnPressed]}
              >
                <Text style={styles.modalBtnSecondaryText}>Batal</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveBannerUrl}
                disabled={
                  savingBanner ||
                  !bannerCooldown.canChange ||
                  !bannerInput.trim() ||
                  bannerPreviewFailed
                }
                style={({ pressed }) => [
                  styles.modalBtnPrimary,
                  (savingBanner ||
                    !bannerCooldown.canChange ||
                    !bannerInput.trim() ||
                    bannerPreviewFailed) &&
                    styles.modalBtnDisabled,
                  pressed && styles.btnPressed,
                ]}
              >
                {savingBanner ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Simpan</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal 2: Pilih Kualitas Video */}
      <Modal
        visible={showQualityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQualityModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowQualityModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Kualitas Default</Text>
            {["Auto", "360p", "480p", "720p", "1080p"].map((res) => (
              <Pressable
                key={res}
                onPress={() => chooseQuality(res)}
                style={({ pressed }) => [
                  styles.choiceRow,
                  quality === res && styles.choiceRowActive,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={[styles.choiceText, quality === res && styles.choiceTextActive]}>{res}</Text>
                {quality === res && <AppIcon name="check" size={18} color="#2563EB" />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Modal 3: Pilih Durasi Skip Intro */}
      <Modal
        visible={showIntroModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIntroModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowIntroModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Durasi Skip Intro</Text>
            {["60s", "75s", "85s", "90s"].map((dur) => (
              <Pressable
                key={dur}
                onPress={() => chooseIntroDuration(dur)}
                style={({ pressed }) => [
                  styles.choiceRow,
                  introDuration === dur && styles.choiceRowActive,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={[styles.choiceText, introDuration === dur && styles.choiceTextActive]}>
                  {dur} {dur === "85s" ? "(Standar Anime)" : ""}
                </Text>
                {introDuration === dur && <AppIcon name="check" size={18} color="#2563EB" />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Modal 4: Pilih Bahasa Subtitle */}
      <Modal
        visible={showSubLangModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSubLangModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSubLangModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Bahasa Subtitle Utama</Text>
            {[
              { id: "id", label: "Bahasa Indonesia" },
              { id: "en", label: "English" },
              { id: "jp", label: "Jepang (Romaji)" },
            ].map((item) => (
              <Pressable
                key={item.id}
                onPress={() => chooseSubLang(item.id)}
                style={({ pressed }) => [
                  styles.choiceRow,
                  subPrefs?.preferredLanguage === item.id && styles.choiceRowActive,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    subPrefs?.preferredLanguage === item.id && styles.choiceTextActive,
                  ]}
                >
                  {item.label}
                </Text>
                {subPrefs?.preferredLanguage === item.id && <AppIcon name="check" size={18} color="#2563EB" />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Modal 5: Pilih Ukuran Font Subtitle */}
      <Modal
        visible={showSubSizeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSubSizeModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSubSizeModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ukuran Font Subtitle</Text>
            {[
              { size: 12, label: "Kecil (12px)" },
              { size: 14, label: "Standar (14px)" },
              { size: 16, label: "Besar (16px)" },
              { size: 18, label: "Ekstra (18px)" },
            ].map((item) => (
              <Pressable
                key={item.size}
                onPress={() => chooseSubFontSize(item.size)}
                style={({ pressed }) => [
                  styles.choiceRow,
                  subPrefs?.fontSize === item.size && styles.choiceRowActive,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    subPrefs?.fontSize === item.size && styles.choiceTextActive,
                  ]}
                >
                  {item.label}
                </Text>
                {subPrefs?.fontSize === item.size && <AppIcon name="check" size={18} color="#2563EB" />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Modal 6: Level Progress (Redesign UI — 10 Tiers) */}
      <LevelProgressModal
        visible={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
        userLevel={userLevel}
        totalXP={currentXP}
        totalMinutesWatched={stats.totalMinutesWatched || 0}
      />

      {/* Modal: Konfirmasi Logout */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!loggingOut) setShowLogoutModal(false);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (!loggingOut) setShowLogoutModal(false);
          }}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AppIcon name="logout" size={20} color="#EF4444" />
              </View>
              <Text style={styles.modalTitle}>Keluar dari Akun?</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Sesi kamu akan diakhiri dan kamu akan kembali ke tampilan awal (halaman login).
            </Text>
            <View style={styles.modalBtnRow}>
              <Pressable
                onPress={() => setShowLogoutModal(false)}
                disabled={loggingOut}
                style={({ pressed }) => [styles.modalBtnSecondary, pressed && styles.btnPressed]}
              >
                <Text style={styles.modalBtnSecondaryText}>Batal</Text>
              </Pressable>
              <Pressable
                onPress={confirmSignOut}
                disabled={loggingOut}
                style={({ pressed }) => [
                  styles.modalBtnPrimary,
                  { backgroundColor: "#EF4444" },
                  pressed && styles.btnPressed,
                  loggingOut && { opacity: 0.8 },
                ]}
              >
                {loggingOut ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalBtnPrimaryText, { color: "#FFFFFF" }]}>Logout</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1117",
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },

  // ─── TOP HEADER BAR ───
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backBtn: {
    padding: 6,
    marginLeft: -6,
  },
  headerTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 19,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 32,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 16,
  },

  // ─── 1. USER PROFILE CARD ───
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#161922",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  avatarWrap: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#52A447",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: "Nunito-Bold",
    fontSize: 24,
    color: "#FFFFFF",
  },
  profileTextWrap: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    fontFamily: "Nunito-Bold",
    fontSize: 16.5,
    color: "#FFFFFF",
    letterSpacing: -0.2,
    flex: 1,
  },
  editNameIconBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
  },
  profileEmail: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#8E9AA8",
  },

  // ─── 2. XP & LEVEL CARD ───
  xpCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#161922",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  xpTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  xpBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  xpBadgePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  xpBadgeText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 12,
    color: "#10B981",
  },
  levelBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  levelIcon: {
    fontSize: 10,
  },
  levelBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#A1A1AA",
  },
  leaderboardBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  leaderboardText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },
  xpProgressMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  xpMetaText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#8E9AA8",
  },
  xpPercentText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#60A5FA",
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    position: "relative",
    justifyContent: "center",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#2563EB",
  },
  progressDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#38BDF8",
    top: -1,
    marginLeft: -4,
  },

  // ─── SEKSI UMUM & GROUP CARD ───
  sectionWrap: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#71717A",
    marginLeft: 4,
    letterSpacing: 0.2,
  },
  cardGroup: {
    borderRadius: 18,
    backgroundColor: "#161922",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowItemClickable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 52,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  rowTextCol: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  rowLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 14.5,
    color: "#FFFFFF",
  },
  rowSubLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#71717A",
    lineHeight: 16,
  },
  rowRightWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowRightText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#71717A",
  },
  rowRightTextActive: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#38BDF8",
  },
  actionEditText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#38BDF8",
  },
  actionCheckUpdateText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#38BDF8",
  },
  nsfwTagPill: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  nsfwTagText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 10,
    color: "#FFFFFF",
  },

  // ─── LOGOUT CARD ───
  logoutCard: {
    borderRadius: 18,
    backgroundColor: "#161922",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
    marginTop: 4,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  logoutText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14.5,
    color: "#F87171",
  },

  // ─── MODAL REUSABLE STYLES ───
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    padding: 22,
    borderRadius: 22,
    backgroundColor: "#161922",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    gap: 12,
  },
  modalTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 17,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
    lineHeight: 18,
  },
  modalTextInput: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#FFFFFF",
    marginTop: 4,
  },
  modalBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  modalBtnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnSecondaryText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#94A3B8",
  },
  modalBtnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnPrimaryText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  modalCloseFullBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  choiceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  choiceRowActive: {
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.3)",
  },
  choiceText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#94A3B8",
  },
  choiceTextActive: {
    color: "#FFFFFF",
  },
  ageIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  ageIconText: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#EF4444",
  },
  trophyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(245, 197, 24, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  xpInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  xpInfoLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
  },
  xpInfoVal: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },

  // ─── COOLDOWN & BANNER PREVIEW MODAL STYLES ───
  cooldownAlertBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  cooldownAlertTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#F59E0B",
  },
  cooldownAlertDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#FDE68A",
    marginTop: 2,
    lineHeight: 16,
  },
  modalTextInputDisabled: {
    opacity: 0.5,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  modalTextInputError: {
    borderColor: "#EF4444",
  },
  modalBtnDisabled: {
    opacity: 0.45,
    backgroundColor: "#334155",
  },
  inputCharCountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: -4,
  },
  inputCharCountText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },
  inputHintText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },
  inputErrorText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#EF4444",
    marginTop: -4,
  },

  bannerPreviewContainer: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  bannerPreviewImage: {
    width: "100%",
    height: 110,
  },
  bannerPreviewEmptyBox: {
    width: "100%",
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  bannerPreviewEmptyText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    textAlign: "center",
  },
  formatBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  formatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  formatBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#94A3B8",
  },
  bannerInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerTextInput: {
    flex: 1,
    marginTop: 0,
  },
  bannerPasteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  bannerPasteText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
  },
});
