import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";

import { useAnirakuAuth } from "@/providers/auth-provider";
import { useWatchStats } from "@/hooks/use-watch-stats";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { avatarUrl, isDefaultAvatar } from "@/lib/aniraku-avatars";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { LevelProgressModal, getTierForLevel } from "@/components/level-progress-modal";
import { UserVerificationBadge } from "@/components/user-verification-badge";
import { getLevelProgressInfo } from "@/lib/user-level";
import {
  AVATAR_COOLDOWN_SECONDS,
  getProfileCooldownStatus,
  validateImageUrl,
  extractDirectImageUrl,
} from "@/lib/profile-cooldown";
import { BorderAvatar } from "@/components/border-avatar";
import { getEquippedBorderId, subscribeEquippedBorder } from "@/lib/avatar-borders";
import { isSpecialRole } from "@/lib/admin-service";
import { getFriends } from "@/lib/friends-service";
import { loadAccountSettings } from "@/lib/user-settings";
import { ProfileCityPlaque } from "@/components/profile-city-plaque";

const DEFAULT_BANNER =
  "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1200";

const BORDER_IMAGES: Record<string, any> = {
  white_mage: require("@/assets/images/inventory/border-white-mage.png"),
  magic_book: require("@/assets/images/inventory/border-magic-book.png"),
};

const INVENTORY_STAR_IMG = require("@/assets/images/inventory/crystal-star.png");
const BORDER_WHITE_MAGE_IMG = require("@/assets/images/inventory/border-white-mage.png");
const GACHA_BOOK_IMG = require("@/assets/images/inventory/border-magic-book.png");
const DUNIA_EMBLEM_IMG = require("@/assets/images/dunia-nuenime-emblem.png");

function formatJoinDuration(createdAt?: string | null): string {
  if (!createdAt) return "1 bulan";
  const time = new Date(createdAt).getTime();
  if (!Number.isFinite(time)) return "1 bulan";
  const diffDays = Math.max(1, Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24)));
  if (diffDays < 30) return `${diffDays} hari`;
  const months = Math.floor(diffDays / 30);
  if (months < 12) return `${months} bulan`;
  const years = Math.floor(months / 12);
  return `${years} tahun`;
}

function formatRelativeTimeId(dateStr?: string | number | null): string {
  if (!dateStr) return "";
  const time = typeof dateStr === "number" ? dateStr : new Date(dateStr).getTime();
  if (!Number.isFinite(time)) return "";
  const diffMs = Date.now() - time;
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} bulan lalu`;
  const years = Math.floor(days / 365);
  return `${years} tahun lalu`;
}

type ProfileTab = "komentar" | "favorit" | "histori";

export default function ProfileScreen() {
  const auth = useAnirakuAuth();
  const stats = useWatchStats();
  const { displayRows } = useWatchHistory();
  const { bookmarks } = useBookmarks();
  const navigation = useNavigation();
  const searchParams = useLocalSearchParams<{ detail?: string; view?: string; userId?: string; id?: string }>();
  const targetUserId = searchParams.userId || searchParams.id;
  const isOwnProfile = !targetUserId || targetUserId === auth.user?.id;

  // Selalu mulai di layar awal (overview/social screen dari screenshot user), atau detail jika diminta query param
  const [showDetailProfile, setShowDetailProfile] = useState(
    searchParams.detail === "true" || searchParams.view === "detail"
  );
  const [activeTab, setActiveTab] = useState<ProfileTab>("komentar");
  const [showLevelProgressModal, setShowLevelProgressModal] = useState(false);
  const [equippedBorderId, setEquippedBorderId] = useState<string | null>(null);

  // Floating Toast State for Coming Soon features
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [bannerLoadError, setBannerLoadError] = useState(false);
  const [friendCount, setFriendCount] = useState<number>(0);
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);

  useEffect(() => {
    let active = true;
    void loadAccountSettings(auth.user?.id).then((settings) => {
      if (active) setIsPrivateAccount(settings.privateProfile);
    });
    return () => {
      active = false;
    };
  }, [auth.user?.id]);

  useEffect(() => {
    if (auth.user?.id) {
      getFriends(auth.user.id)
        .then((list) => setFriendCount(list.length))
        .catch(() => {});
    }
  }, [auth.user?.id]);

  useEffect(() => {
    setBannerLoadError(false);
  }, [auth.profile?.banner_url]);

  // ─── Avatar Change & Cooldown State ───
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarMode, setAvatarMode] = useState<"choice" | "google" | "link">("choice");
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [googleQuery, setGoogleQuery] = useState("");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarPreviewFailed, setAvatarPreviewFailed] = useState(false);
  const [, setAvatarTick] = useState(0);

  useEffect(() => {
    if (!showAvatarModal) return;
    const interval = setInterval(() => setAvatarTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, [showAvatarModal]);

  const avatarCooldown = getProfileCooldownStatus(
    auth.profile?.avatar_updated_at,
    AVATAR_COOLDOWN_SECONDS,
    "avatar"
  );

  const handleOpenGoogleSearch = () => {
    const q = googleQuery.trim() || "anime avatar pfp";
    const googleUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
    void Linking.openURL(googleUrl);
  };

  const handlePasteAvatarUrl = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        const extracted = extractDirectImageUrl(text.trim());
        setAvatarUrlInput(extracted);
        setAvatarError(null);
        setAvatarPreviewFailed(false);
        hapticLight();
      }
    } catch {}
  };

  const handleSaveAvatar = async () => {
    const cleanUrl = extractDirectImageUrl(avatarUrlInput.trim());
    if (!avatarCooldown.canChange) {
      setAvatarError(avatarCooldown.message);
      return;
    }
    const validation = validateImageUrl(cleanUrl);
    if (!validation.valid) {
      setAvatarError(validation.error || "URL gambar avatar tidak valid.");
      return;
    }

    setAvatarError(null);
    setSavingAvatar(true);
    try {
      await auth.updateAvatar(cleanUrl);
      hapticSuccess();
      setShowAvatarModal(false);
      Alert.alert("Sukses", "Avatar profil berhasil diperbarui!");
    } catch (err: any) {
      const msg = err?.message || "Terjadi kesalahan saat menyimpan avatar.";
      setAvatarError(msg);
      Alert.alert("Gagal Memperbarui", msg);
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleOpenDetail = () => {
    hapticLight();
    setShowDetailProfile(true);
  };

  const handleCloseDetail = () => {
    hapticLight();
    setShowDetailProfile(false);
  };

  // Sinkronkan jika URL parameter berubah
  useEffect(() => {
    if (searchParams.detail === "true" || searchParams.view === "detail") {
      setShowDetailProfile(true);
    }
  }, [searchParams.detail, searchParams.view]);

  // Setiap kali tab Profil ditekan di bottom bar, kembalikan ke layar awal overview
  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress" as any, () => {
      setShowDetailProfile(false);
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const syncBorder = () => {
      getEquippedBorderId(auth.user?.id)
        .then((id) => setEquippedBorderId(id))
        .catch(() => {});
    };
    syncBorder();
    const unsubFocus = navigation.addListener("focus" as any, syncBorder);
    const unsubEquip = subscribeEquippedBorder((newBorderId, targetUserId) => {
      if (!targetUserId || targetUserId === auth.user?.id) {
        setEquippedBorderId(newBorderId);
      }
    });
    return () => {
      unsubFocus();
      unsubEquip();
    };
  }, [navigation, auth.user?.id]);

  const showToast = (message: string) => {
    hapticLight();
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 2500);
  };

  // Query real user comments from Supabase
  const userCommentsQuery = useQuery({
    queryKey: ["user-profile-comments", auth.user?.id],
    enabled: Boolean(auth.user?.id),
    queryFn: async () => {
      if (!auth.user?.id) return [];
      const { data, error } = await supabase
        .from("comments")
        .select("id, user_id, anime_id, content, episode_number, created_at, likes, is_spoiler")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) {
        console.warn("Failed to fetch user comments:", error);
        return [];
      }
      return data ?? [];
    },
  });

  // Map anime posters from watch history for fast lookup in comments
  const animePosterMap = useMemo(() => {
    const map = new Map<number, { title: string; image: string }>();
    for (const row of displayRows) {
      const id = Number(row?.anime_id);
      if (id && !map.has(id)) {
        map.set(id, {
          title: String(row.anime_title || "Anime"),
          image: String(row.episode_thumbnail || row.anime_image || ""),
        });
      }
    }
    for (const b of bookmarks.data ?? []) {
      const id = Number(b?.anime_id);
      if (id && !map.has(id)) {
        map.set(id, {
          title: String(b.title || "Anime"),
          image: String(b.image || ""),
        });
      }
    }
    return map;
  }, [displayRows, bookmarks.data]);

  if (auth.loading) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
        </View>
      </SafeAreaView>
    );
  }

  // Synchronized Profile Information (with fallback for guest/offline)
  const username =
    auth.profile?.username ||
    auth.user?.user_metadata?.username ||
    auth.user?.email?.split("@")[0] ||
    "Aprizal Febrian";

  const displayName =
    auth.profile?.display_name ||
    auth.user?.user_metadata?.full_name ||
    auth.user?.user_metadata?.name ||
    username;

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
  const initialLetter = (displayName || username).trim().charAt(0).toUpperCase() || "A";

  // Sequential user tag (#1, #2, dst.) berdasarkan urutan pendaftaran member
  const memberNumber = auth.profile?.member_number ?? 1;
  const userTag = `#${memberNumber}`;

  // Role pengguna & verifikasi centang (Merah untuk role khusus, Biru untuk member)
  const userRole = auth.profile?.role || "Member";
  const isSpecial = isSpecialRole(userRole);

  // Individual User Level & EXP from database
  const userExp = Math.max(0, Number(auth.profile?.exp || 0));
  const levelInfo = getLevelProgressInfo(userExp);
  const userLevel = auth.profile?.level ?? levelInfo.level;
  const activeTier = getTierForLevel(userLevel).currentTier;

  // Stats values
  const joinDuration = formatJoinDuration(auth.user?.created_at);
  const commentCount = userCommentsQuery.data?.length ?? 0;
  const historyCount = displayRows.length;
  const totalMinutes = stats.totalMinutesWatched || 0;

  // ─── INITIAL SOCIAL / FEED SCREEN (MATCHING SCREENSHOT) ───
  if (!showDetailProfile) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.socialContainer}>
        {/* Floating Toast Notification */}
        {toastMessage ? (
          <View style={styles.toastContainer} pointerEvents="none">
            <View style={styles.toastBox}>
              <AppIcon name="information-outline" size={17} color="#38BDF8" />
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          </View>
        ) : null}

        {/* 1. TOP HEADER (AKUN SAYA & SETTINGS) */}
        {/* 1. TOP HEADER (AKUN SAYA & SETTINGS) */}
        <View style={styles.socialHeader}>
          {/* User Account Info Row - Komponen mandiri terpisah, tidak di-nest */}
          <View style={styles.socialUserRow}>
            {/* 1. Tombol Avatar -> Buka Detail Profil */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Buka Profil Pengguna"
              onPress={handleOpenDetail}
              // @ts-ignore
              onClick={handleOpenDetail}
              style={({ pressed }) => [
                styles.socialAvatarWrap,
                pressed && styles.btnPressed,
                Platform.OS === "web" && ({ cursor: "pointer", userSelect: "none" } as any),
              ]}
              hitSlop={10}
            >
              <BorderAvatar
                avatarUrl={avatar}
                fallbackText={initialLetter}
                borderId={equippedBorderId}
                avatarSize={46}
              />
            </Pressable>

            {/* Kolom sebelah kanan Avatar */}
            <View style={styles.socialUserMeta}>
              {/* 2. Tombol Nama & Tag -> Buka Detail Profil */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Buka Profil Pengguna"
                onPress={handleOpenDetail}
                // @ts-ignore
                onClick={handleOpenDetail}
                style={({ pressed }) => [
                  styles.socialNameRow,
                  pressed && { opacity: 0.75 },
                  Platform.OS === "web" && ({ cursor: "pointer", userSelect: "none" } as any),
                ]}
                hitSlop={{ top: 8, bottom: 4, left: 4, right: 24 }}
              >
                <Text
                  style={[styles.socialDisplayName, { pointerEvents: "none" } as any]}
                  numberOfLines={1}
                  pointerEvents="none"
                >
                  {displayName}
                </Text>
                <Text
                  style={[styles.socialUserTag, { pointerEvents: "none" } as any]}
                  pointerEvents="none"
                >
                  {userTag}
                </Text>
                <View style={styles.socialVerifiedBadge}>
                  <UserVerificationBadge role={auth.profile?.role} isVip={auth.profile?.is_vip} size={15} />
                </View>
              </Pressable>

              {/* 3. Tombol Level Pill & Role Tag Khusus */}
              <View style={styles.socialPillRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Lihat Level Progress (Lvl ${userLevel})`}
                  onPress={() => {
                    hapticLight();
                    setShowLevelProgressModal(true);
                  }}
                  // @ts-ignore
                  onClick={() => {
                    hapticLight();
                    setShowLevelProgressModal(true);
                  }}
                  style={({ pressed }) => [
                    styles.socialLevelPill,
                    pressed && styles.btnPressed,
                    Platform.OS === "web" && ({ cursor: "pointer", userSelect: "none" } as any),
                  ]}
                  hitSlop={{ top: 4, bottom: 8, left: 4, right: 16 }}
                >
                  {activeTier?.imageUrl ? (
                    <Image
                      source={{ uri: activeTier.imageUrl }}
                      style={[styles.socialTierIcon, { pointerEvents: "none" } as any]}
                      contentFit="contain"
                      transition={150}
                      cachePolicy="memory-disk"
                      pointerEvents="none"
                    />
                  ) : (
                    <Text style={[styles.socialStoneIcon, { pointerEvents: "none" } as any]} pointerEvents="none">
                      🪨
                    </Text>
                  )}
                  <Text
                    style={[styles.socialLevelText, { pointerEvents: "none" } as any]}
                    pointerEvents="none"
                  >
                    Lvl. {userLevel}
                  </Text>
                </Pressable>

                {isSpecial && (
                  <View style={styles.socialRolePill}>
                    <AppIcon name="shield-check" size={11} color="#EF4444" />
                    <Text style={styles.socialRolePillText}>{userRole}</Text>
                  </View>
                )}

                {isPrivateAccount && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Profil Privat"
                    onPress={() => {
                      hapticLight();
                      router.push("/settings" as never);
                    }}
                    style={({ pressed }) => [styles.socialPrivatePill, pressed && styles.btnPressed]}
                  >
                    <AppIcon name="lock" size={11} color="#F59E0B" />
                    <Text style={styles.socialPrivatePillText}>Privat</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>

          {/* Chat Global Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chat Global"
            onPress={() => {
              hapticLight();
              router.push("/chat-global" as never);
            }}
            // @ts-ignore
            onClick={() => {
              hapticLight();
              router.push("/chat-global" as never);
            }}
            style={({ pressed }) => [
              styles.socialSettingsBtn,
              pressed && styles.btnPressed,
              Platform.OS === "web" && ({ cursor: "pointer" } as any),
              { marginRight: 8 },
            ]}
            hitSlop={12}
          >
            <View pointerEvents="none" style={{ pointerEvents: "none" } as any}>
              <AppIcon name="chat" size={22} color="#FFFFFF" />
            </View>
          </Pressable>

          {/* Settings Gear Icon */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pengaturan"
            onPress={() => {
              hapticLight();
              router.push("/settings" as never);
            }}
            // @ts-ignore
            onClick={() => {
              hapticLight();
              router.push("/settings" as never);
            }}
            style={({ pressed }) => [
              styles.socialSettingsBtn,
              pressed && styles.btnPressed,
              Platform.OS === "web" && ({ cursor: "pointer" } as any),
            ]}
            hitSlop={12}
          >
            <View pointerEvents="none" style={{ pointerEvents: "none" } as any}>
              <AppIcon name="cog-outline" size={24} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>

        {/* 2. BODY: SCROLLABLE MENU (INVENTORY BANNER, BORDER SHOP, GACHA BANNER) */}
        <ScrollView
          style={styles.socialScrollView}
          contentContainerStyle={styles.socialScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* A. COMPACT INVENTORY INFO BANNER */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka Tas dan Inventory"
            onPress={() => {
              hapticLight();
              router.push("/inventory" as never);
            }}
            // @ts-ignore
            onClick={() => {
              hapticLight();
              router.push("/inventory" as never);
            }}
            style={({ pressed }) => [
              styles.inventoryInfoBanner,
              pressed && styles.btnPressed,
              Platform.OS === "web" && ({ cursor: "pointer" } as any),
            ]}
          >
            <Image
              source={INVENTORY_STAR_IMG}
              style={styles.inventoryImg}
              contentFit="contain"
            />
            <View style={styles.inventoryTextCol}>
              <View style={styles.inventoryTitleRow}>
                <Text style={styles.inventoryTitle}>Tas & Inventory</Text>
                <View style={styles.inventoryBadge}>
                  <Text style={styles.inventoryBadgeText}>Koleksi</Text>
                </View>
              </View>
              <Text style={styles.inventorySubtitle} numberOfLines={1}>
                Kelola koleksi border, banner & item eksklusif
              </Text>
            </View>
            <View style={styles.inventoryActionBtn}>
              <Text style={styles.inventoryActionText}>Buka</Text>
              <AppIcon name="chevron-right" size={16} color="#CBD5E1" />
            </View>
          </Pressable>

          {/* B. SECTION: TOKO BORDER & GACHA BANNER */}
          <View style={styles.socialSectionHeader}>
            <Text style={styles.socialSectionTitle}>Koleksi & Kustomisasi</Text>
            <Text style={styles.socialSectionSubtitle}>Hias profilmu dengan item langka</Text>
          </View>

          <View style={styles.featureCardsGrid}>
            {/* 1. Beli Border Avatar Card */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Beli Border Avatar"
              onPress={() => {
                hapticLight();
                router.push("/avatar-decorations" as never);
              }}
              // @ts-ignore
              onClick={() => {
                hapticLight();
                router.push("/avatar-decorations" as never);
              }}
              style={({ pressed }) => [
                styles.featureCard,
                pressed && styles.btnPressed,
                Platform.OS === "web" && ({ cursor: "pointer" } as any),
              ]}
            >
              <View style={styles.featureCardHeader}>
                <Image
                  source={BORDER_WHITE_MAGE_IMG}
                  style={styles.featureCardImg}
                  contentFit="contain"
                />
                <View style={styles.featureCardBadge}>
                  <Text style={styles.featureCardBadgeText}>STORE</Text>
                </View>
              </View>

              <Text style={styles.featureCardTitle}>Beli Border Avatar</Text>
              <Text style={styles.featureCardDesc}>
                Koleksi border anime Mythic, Legends & Epic untuk bingkai profilmu.
              </Text>

              <View style={styles.featureCardFooter}>
                <Text style={styles.featureCardCta}>Lihat Toko Border</Text>
                <AppIcon name="arrow-right" size={15} color="#E2E8F0" />
              </View>
            </Pressable>

            {/* 2. Gacha Banner Keren Card */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gacha Banner Keren"
              onPress={() => {
                hapticLight();
                router.push("/gacha" as never);
              }}
              // @ts-ignore
              onClick={() => {
                hapticLight();
                router.push("/gacha" as never);
              }}
              style={({ pressed }) => [
                styles.featureCard,
                pressed && styles.btnPressed,
                Platform.OS === "web" && ({ cursor: "pointer" } as any),
              ]}
            >
              <View style={styles.featureCardHeader}>
                <Image
                  source={GACHA_BOOK_IMG}
                  style={styles.featureCardImg}
                  contentFit="contain"
                />
                <View style={styles.featureCardBadge}>
                  <Text style={styles.featureCardBadgeText}>SUMMON</Text>
                </View>
              </View>

              <Text style={styles.featureCardTitle}>Gacha Banner Keren</Text>
              <Text style={styles.featureCardDesc}>
                Dapatkan banner anime eksklusif, wallpaper profil & aura visual langka!
              </Text>

              <View style={styles.featureCardFooter}>
                <Text style={styles.featureCardCta}>Mulai Gacha</Text>
                <AppIcon name="arrow-right" size={15} color="#E2E8F0" />
              </View>
            </Pressable>
          </View>

          {/* C. SUBTLE ACTIVITY NOTICE */}
          <View style={styles.socialNoticeCard}>
            <View style={styles.socialNoticeIconBox}>
              <AppIcon name="account-group-outline" size={20} color="#94A3B8" />
            </View>
            <View style={styles.socialNoticeTextCol}>
              <Text style={styles.socialNoticeTitle}>Belum ada aktivitas pertemanan</Text>
              <Text style={styles.socialNoticeSubtitle}>
                Follow teman sesama wibu untuk memantau anime yang sedang mereka tonton!
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* 2. FLOATING ACTION BUTTON (DUNIA NUENIME) - DI ATAS ICON PERTEMANAN */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Masuk Dunia Nuenime"
          onPress={() => {
            hapticLight();
            router.push("/dunia" as never);
          }}
          // @ts-ignore
          onClick={() => {
            hapticLight();
            router.push("/dunia" as never);
          }}
          style={({ pressed }) => [styles.duniaFab, pressed && styles.btnPressed]}
          hitSlop={8}
        >
          <View pointerEvents="none" style={{ pointerEvents: "none", alignItems: "center", justifyContent: "center" } as any}>
            <Image
              source={DUNIA_EMBLEM_IMG}
              style={{ width: 54, height: 54 }}
              contentFit="contain"
            />
          </View>
          <View style={styles.duniaFabBadge}>
            <Text style={styles.duniaFabBadgeText}>RPG</Text>
          </View>
        </Pressable>

        {/* 3. FLOATING ACTION BUTTON (ADD FRIENDS) - SILVER & RAISED */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka menu pertemanan"
          onPress={() => {
            hapticLight();
            router.push("/connections" as never);
          }}
          style={({ pressed }) => [styles.socialFab, pressed && styles.btnPressed]}
          hitSlop={8}
        >
          <View pointerEvents="none" style={{ pointerEvents: "none" } as any}>
            <AppIcon name="account-multiple-plus" size={26} color="#0B0E14" />
          </View>
        </Pressable>

        {/* ─── LEVEL PROGRESS 10 TIERS MODAL (POPU-UP TERBARU) ─── */}
        <LevelProgressModal
          visible={showLevelProgressModal}
          onClose={() => setShowLevelProgressModal(false)}
          userLevel={userLevel}
          totalXP={userExp}
          totalMinutesWatched={stats.totalMinutesWatched || 0}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* ─── TOAST NOTIFICATION ─── */}
      {toastMessage ? (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={styles.toastBox}>
            <AppIcon name="information-outline" size={17} color="#38BDF8" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 1. BANNER & TOP NAV BAR ─── */}
        <View style={styles.bannerWrapper}>
          <Image
            source={{ uri: !bannerLoadError && auth.profile?.banner_url ? auth.profile.banner_url : DEFAULT_BANNER }}
            style={styles.bannerImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            onError={() => setBannerLoadError(true)}
          />
          <LinearGradient
            colors={[
              "rgba(11, 14, 20, 0.3)",
              "transparent",
              "rgba(11, 14, 20, 0.45)",
              "rgba(11, 14, 20, 0.85)",
              "#0B0E14",
            ]}
            locations={[0, 0.25, 0.65, 0.88, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Floating Top Actions Bar */}
          <View style={styles.topActionsBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kembali"
              onPress={handleCloseDetail}
              // @ts-ignore
              onClick={handleCloseDetail}
              style={({ pressed }) => [
                styles.iconActionBtn,
                pressed && styles.btnPressed,
                Platform.OS === "web" && ({ cursor: "pointer" } as any),
              ]}
              hitSlop={10}
            >
              <AppIcon name="arrow-left" size={20} color="#FFFFFF" />
            </Pressable>

            <View style={styles.topRightRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Inventory"
                onPress={() => {
                  hapticLight();
                  router.push("/inventory" as never);
                }}
                // @ts-ignore
                onClick={() => {
                  router.push("/inventory" as never);
                }}
                style={({ pressed }) => [
                  styles.iconActionBtn,
                  pressed && styles.btnPressed,
                  Platform.OS === "web" && ({ cursor: "pointer" } as any),
                ]}
                hitSlop={10}
              >
                <Image
                  source={require("@/assets/images/profile-inventory-icon.png")}
                  style={{ width: 22, height: 22 }}
                  contentFit="contain"
                />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pengaturan"
                onPress={() => {
                  hapticLight();
                  router.push("/settings" as never);
                }}
                // @ts-ignore
                onClick={() => {
                  router.push("/settings" as never);
                }}
                style={({ pressed }) => [
                  styles.iconActionBtn,
                  pressed && styles.btnPressed,
                  Platform.OS === "web" && ({ cursor: "pointer" } as any),
                ]}
                hitSlop={10}
              >
                <AppIcon name="cog-outline" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Plakat Kota & Klan di Banner Kiri-Tengah */}
          <ProfileCityPlaque
            userId={auth.user?.id}
            style={styles.bannerCityPlaque}
          />
        </View>

        {/* ─── 2. USER IDENTITY SECTION ─── */}
        <View style={styles.profileHeaderBox}>
          {/* Avatar with Equipped Border if active */}
          <View style={styles.avatarWrapper}>
            <BorderAvatar
              avatarUrl={avatar}
              fallbackText={initialLetter}
              borderId={equippedBorderId}
              avatarSize={80}
              onPress={() => {
                hapticLight();
                setShowAvatarModal(true);
                setAvatarMode("choice");
                setAvatarUrlInput("");
                setAvatarError(null);
                setAvatarPreviewFailed(false);
              }}
            >
              {/* Camera / Edit Badge Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ubah Foto Avatar"
                onPress={() => {
                  hapticLight();
                  setShowAvatarModal(true);
                  setAvatarMode("choice");
                  setAvatarUrlInput("");
                  setAvatarError(null);
                  setAvatarPreviewFailed(false);
                }}
                style={({ pressed }) => [
                  styles.avatarEditBadge,
                  pressed && styles.btnPressed,
                  !avatarCooldown.canChange && { backgroundColor: "rgba(245, 158, 11, 0.9)" },
                ]}
                hitSlop={8}
              >
                <AppIcon
                  name={!avatarCooldown.canChange ? "clock-outline" : "camera"}
                  size={14}
                  color="#FFFFFF"
                />
              </Pressable>
            </BorderAvatar>
          </View>


          {/* User Name, Tag & Verified Badge */}
          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.displayNameText} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.userTagText}>{userTag}</Text>
              <View style={styles.verifiedBadge}>
                <UserVerificationBadge role={auth.profile?.role} isVip={auth.profile?.is_vip} size={17} />
              </View>
            </View>

            {/* Level Pill, Role Tag (Khusus), & Teman Pill */}
            <View style={styles.pillRow}>
              {/* Level Progress Pill (Interactive) */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Lihat Level Progress (Lvl ${userLevel})`}
                onPress={() => {
                  hapticLight();
                  setShowLevelProgressModal(true);
                }}
                // @ts-ignore
                onClick={() => {
                  hapticLight();
                  setShowLevelProgressModal(true);
                }}
                style={({ pressed }) => [
                  styles.levelPill,
                  pressed && styles.btnPressed,
                  Platform.OS === "web" && ({ cursor: "pointer" } as any),
                ]}
                hitSlop={6}
              >
                <Image
                  source={{ uri: activeTier.imageUrl }}
                  style={styles.tierPillIcon}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
                <Text style={styles.levelPillText}>Lvl {userLevel.toLocaleString("id-ID")}</Text>
              </Pressable>

              {/* Tag Role Khusus (Hanya jika BUKAN Member) */}
              {isSpecial && (
                <View style={styles.roleTagPill}>
                  <AppIcon name="shield-check" size={13} color="#EF4444" />
                  <Text style={styles.roleTagText}>{userRole}</Text>
                </View>
              )}

              {/* Teman Pill */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Buka menu pertemanan"
                onPress={() => {
                  hapticLight();
                  router.push("/connections" as never);
                }}
                style={({ pressed }) => [styles.friendsPill, pressed && styles.btnPressed]}
              >
                <AppIcon name="account-group" size={14} color="#94A3B8" />
                <Text style={styles.friendsPillText}>{friendCount} Teman</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ─── 3. USER STATS GRID (4 STATS) ─── */}
        <View style={styles.statsCard}>
          <View style={styles.statColumn}>
            <Text style={styles.statNumber}>{joinDuration.split(" ")[0]}</Text>
            <Text style={styles.statLabel}>{joinDuration.split(" ")[1] || "bulan"}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statColumn}>
            <Text style={styles.statNumber}>{commentCount}</Text>
            <Text style={styles.statLabel}>komentar</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statColumn}>
            <Text style={styles.statNumber}>{historyCount}</Text>
            <Text style={styles.statLabel}>riwayat</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statColumn}>
            <Text style={styles.statNumber}>{totalMinutes}</Text>
            <Text style={styles.statLabel}>menit</Text>
          </View>
        </View>

        {/* ─── 4. ACTION BUTTONS ─── */}
        <View style={styles.actionsWrap}>
          {/* Primary: Tambah Teman (hanya ditampilkan jika melihat profil pengguna lain) */}
          {!isOwnProfile && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tambah Teman"
              onPress={() => showToast("Fitur Pertemanan akan segera hadir.")}
              style={({ pressed }) => [styles.addFriendBtn, pressed && styles.btnPressed]}
            >
              <AppIcon name="plus" size={18} color="#FFFFFF" />
              <Text style={styles.addFriendText}>Tambah Teman</Text>
            </Pressable>
          )}

          {/* Secondary: Peliharaan & Afinitas */}
          <View style={styles.featureRow}>
            {/* Peliharaan */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fitur Peliharaan NuePet Zoo"
              onPress={() => {
                hapticLight();
                router.push("/nuepet" as any);
              }}
              style={({ pressed }) => [styles.featureCardBtn, pressed && styles.btnPressed]}
            >
              <View style={styles.featureLabelRow}>
                <Text style={styles.featureIcon}>🐾</Text>
                <Text style={styles.featureBtnText}>Peliharaan</Text>
              </View>
            </Pressable>

            {/* Afinitas */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fitur Afinitas"
              onPress={() => showToast("Fitur Afinitas akan segera hadir.")}
              style={({ pressed }) => [styles.featureCardBtn, pressed && styles.btnPressed]}
            >
              <View style={styles.featureLabelRow}>
                <Text style={styles.featureIcon}>⭐</Text>
                <Text style={styles.featureBtnText}>Afinitas</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ─── 5. CONTENT TABS: KOMENTAR | FAVORIT | HISTORI ─── */}
        <View style={styles.tabBarSection}>
          <View style={styles.tabHeaderRow}>
            <Pressable
              onPress={() => setActiveTab("komentar")}
              style={[styles.tabButton, activeTab === "komentar" && styles.tabButtonActive]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === "komentar" && styles.tabButtonTextActive,
                ]}
              >
                Komentar
              </Text>
              {activeTab === "komentar" ? <View style={styles.tabActiveBar} /> : null}
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("favorit")}
              style={[styles.tabButton, activeTab === "favorit" && styles.tabButtonActive]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === "favorit" && styles.tabButtonTextActive,
                ]}
              >
                Favorit
              </Text>
              {activeTab === "favorit" ? <View style={styles.tabActiveBar} /> : null}
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("histori")}
              style={[styles.tabButton, activeTab === "histori" && styles.tabButtonActive]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === "histori" && styles.tabButtonTextActive,
                ]}
              >
                Histori
              </Text>
              {activeTab === "histori" ? <View style={styles.tabActiveBar} /> : null}
            </Pressable>
          </View>
        </View>

        {/* ─── 6. TAB CONTENT DISPLAY ─── */}
        <View style={styles.tabContentArea}>
          {/* TAB 1: KOMENTAR */}
          {activeTab === "komentar" && (
            <View style={styles.tabItemsContainer}>
              {userCommentsQuery.isLoading ? (
                <View style={styles.emptyStateBox}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                  <Text style={styles.emptySubtitle}>Memuat komentar Anda...</Text>
                </View>
              ) : (userCommentsQuery.data?.length ?? 0) === 0 ? (
                <View style={styles.emptyStateBox}>
                  <View style={styles.emptyIconCircle}>
                    <AppIcon name="comment-outline" size={26} color="#64748B" />
                  </View>
                  <Text style={styles.emptyTitle}>Belum Ada Komentar</Text>
                  <Text style={styles.emptySubtitle}>
                    Komentar yang Anda tulis pada episode anime akan muncul di sini.
                  </Text>
                </View>
              ) : (
                userCommentsQuery.data!.map((comment) => {
                  const animeInfo = animePosterMap.get(comment.anime_id);
                  return (
                    <View key={comment.id} style={styles.commentCard}>
                      {/* Author Bar */}
                      <View style={styles.commentAuthorRow}>
                        {avatar ? (
                          <Image
                            source={{ uri: avatar }}
                            style={styles.commentAuthorAvatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.commentAvatarFallback}>
                            <Text style={styles.commentAvatarInitial}>{initialLetter}</Text>
                          </View>
                        )}
                        <Text style={styles.commentAuthorName} numberOfLines={1}>
                          {displayName}
                        </Text>
                        <AppIcon name="check-circle" size={13} color="#38BDF8" />
                        <Text style={styles.commentTimeDot}>•</Text>
                        <Text style={styles.commentTimeText}>
                          {formatRelativeTimeId(comment.created_at)}
                        </Text>
                      </View>

                      {/* Anime Context Box */}
                      <Pressable
                        onPress={() => router.push(`/anime/${comment.anime_id}` as never)}
                        style={({ pressed }) => [
                          styles.commentAnimeRow,
                          pressed && styles.btnPressed,
                        ]}
                      >
                        {animeInfo?.image ? (
                          <Image
                            source={{ uri: animeInfo.image }}
                            style={styles.commentAnimeThumb}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.commentAnimeThumbFallback}>
                            <AppIcon name="movie-open-outline" size={16} color="#64748B" />
                          </View>
                        )}
                        <View style={styles.commentAnimeInfo}>
                          <Text style={styles.commentAnimeTitle} numberOfLines={1}>
                            {animeInfo?.title || `Anime #${comment.anime_id}`}
                          </Text>
                          <Text style={styles.commentEpisodeText}>
                            {comment.episode_number
                              ? `Episode ${comment.episode_number}`
                              : "Diskusi Umum"}
                          </Text>
                        </View>
                      </Pressable>

                      {/* Comment Body */}
                      <Text style={styles.commentBodyText}>{comment.content}</Text>

                      {/* Comment Footer */}
                      <View style={styles.commentFooterRow}>
                        <View style={styles.commentRepliesBadge}>
                          <AppIcon name="reply-outline" size={13} color="#94A3B8" />
                          <Text style={styles.commentRepliesText}>Balasan</Text>
                        </View>
                        <View style={styles.commentLikesBadge}>
                          <AppIcon name="heart-outline" size={13} color="#94A3B8" />
                          <Text style={styles.commentLikesText}>
                            {(comment.likes || 0).toString()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 2: FAVORIT */}
          {activeTab === "favorit" && (
            <View style={styles.tabItemsContainer}>
              {(bookmarks.data?.length ?? 0) === 0 ? (
                <View style={styles.emptyStateBox}>
                  <View style={styles.emptyIconCircle}>
                    <AppIcon name="bookmark-outline" size={26} color="#64748B" />
                  </View>
                  <Text style={styles.emptyTitle}>Belum Ada Favorit</Text>
                  <Text style={styles.emptySubtitle}>
                    Simpan judul anime favorit Anda untuk kemudahan akses di sini.
                  </Text>
                </View>
              ) : (
                <View style={styles.bookmarksGrid}>
                  {bookmarks.data!.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push(`/anime/${item.anime_id}` as never)}
                      style={({ pressed }) => [
                        styles.bookmarkCard,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <View style={styles.bookmarkImageWrap}>
                        {item.image ? (
                          <Image
                            source={{ uri: item.image }}
                            style={styles.bookmarkImage}
                            contentFit="cover"
                            transition={150}
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <View style={styles.bookmarkImageFallback}>
                            <AppIcon name="movie-open-outline" size={26} color="#64748B" />
                          </View>
                        )}
                        <LinearGradient
                          colors={["transparent", "rgba(11, 14, 20, 0.75)"]}
                          style={styles.bookmarkPosterGradient}
                        />
                        {item.score ? (
                          <View style={styles.bookmarkScoreBadge}>
                            <AppIcon name="star" size={11} color="#FBBF24" />
                            <Text style={styles.bookmarkScoreText}>
                              {(Number(item.score) / 10).toFixed(1)}
                            </Text>
                          </View>
                        ) : null}
                        {item.type ? (
                          <View style={styles.bookmarkTypeBadge}>
                            <Text style={styles.bookmarkTypeText}>{item.type}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.bookmarkBody}>
                        <Text style={styles.bookmarkTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: HISTORI */}
          {activeTab === "histori" && (
            <View style={styles.tabItemsContainer}>
              {displayRows.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <View style={styles.emptyIconCircle}>
                    <AppIcon name="history" size={26} color="#64748B" />
                  </View>
                  <Text style={styles.emptyTitle}>Belum Ada Riwayat</Text>
                  <Text style={styles.emptySubtitle}>
                    Episode anime yang Anda tonton akan otomatis tersimpan di sini.
                  </Text>
                </View>
              ) : (
                displayRows.map((entry) => {
                  const poster = entry.episode_thumbnail || entry.anime_image;
                  return (
                    <Pressable
                      key={`${entry.anime_id}-${entry.episode_number}`}
                      onPress={() =>
                        router.push(
                          `/watch/${entry.anime_id}?ep=${entry.episode_number}` as never
                        )
                      }
                      style={({ pressed }) => [
                        styles.historyCard,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      {poster ? (
                        <Image
                          source={{ uri: poster }}
                          style={styles.historyThumb}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.historyThumbFallback}>
                          <AppIcon name="play" size={20} color="#64748B" />
                        </View>
                      )}
                      <View style={styles.historyMeta}>
                        <Text style={styles.historyAnimeTitle} numberOfLines={1}>
                          {entry.anime_title || "Anime"}
                        </Text>
                        <View style={styles.historyBadgeRow}>
                          <View style={styles.historyEpBadge}>
                            <Text style={styles.historyEpText}>
                              Episode {entry.episode_number}
                            </Text>
                          </View>
                          <Text style={styles.historyTimeText}>
                            {formatRelativeTimeId(entry.updated_at)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.historyPlayBtn}>
                        <AppIcon name="play" size={16} color="#FFFFFF" />
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── LEVEL PROGRESS 10 TIERS MODAL (REUSED CLEAN) ─── */}
      <LevelProgressModal
        visible={showLevelProgressModal}
        onClose={() => setShowLevelProgressModal(false)}
        userLevel={userLevel}
        totalXP={userExp}
        totalMinutesWatched={stats.totalMinutesWatched || 0}
      />

      {/* ─── AVATAR SELECTION & CHANGE MODAL ─── */}
      <Modal
        visible={showAvatarModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingAvatar) setShowAvatarModal(false);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (!savingAvatar) setShowAvatarModal(false);
          }}
        >
          <Pressable
            style={[styles.modalCard, { maxHeight: "90%" }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={styles.avatarModalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <AppIcon name="camera" size={20} color="#38BDF8" />
                <Text style={styles.modalTitle}>
                  {avatarMode === "choice"
                    ? "Ganti Avatar Profil"
                    : avatarMode === "google"
                    ? "Cari Gambar di Google"
                    : "Tautan Gambar Avatar"}
                </Text>
              </View>
              {avatarMode !== "choice" && (
                <Pressable
                  onPress={() => {
                    setAvatarMode("choice");
                    setAvatarError(null);
                    setAvatarPreviewFailed(false);
                  }}
                  style={styles.avatarBackPill}
                >
                  <AppIcon name="arrow-left" size={14} color="#94A3B8" />
                  <Text style={styles.avatarBackText}>Pilihan</Text>
                </Pressable>
              )}
            </View>

            {/* Cooldown Alert if Active */}
            {!avatarCooldown.canChange && (
              <View style={styles.cooldownAlertBox}>
                <AppIcon name="clock-outline" size={16} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cooldownAlertTitle}>Batas Perubahan 24 Jam Aktif</Text>
                  <Text style={styles.cooldownAlertDesc}>
                    Avatar dapat diganti lagi dalam {avatarCooldown.remainingText}
                  </Text>
                </View>
              </View>
            )}

            {/* Mode 1: Choice Menu (Google, Direct Link, Cancel) */}
            {avatarMode === "choice" ? (
              <View style={{ gap: 12, marginTop: 4 }}>
                <Text style={styles.modalSubtitle}>
                  Pilih sumber gambar untuk avatar profil Anda. Avatar hanya dapat diganti 1 kali per 24 jam. Tanpa upload file perangkat.
                </Text>

                {/* Option 1: Google Image Search */}
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setAvatarMode("google");
                    setAvatarError(null);
                    setAvatarPreviewFailed(false);
                  }}
                  style={({ pressed }) => [styles.avatarOptionCard, pressed && styles.btnPressed]}
                >
                  <View style={[styles.avatarOptionIconWrap, { backgroundColor: "rgba(66, 133, 244, 0.15)" }]}>
                    <AppIcon name="google" size={22} color="#4285F4" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.avatarOptionTitle}>1. Cari Gambar melalui Google</Text>
                    <Text style={styles.avatarOptionDesc}>
                      Buka pencarian gambar Google, salin URL gambar langsung, dan terapkan
                    </Text>
                  </View>
                  <AppIcon name="chevron-right" size={16} color="#64748B" />
                </Pressable>

                {/* Option 2: Direct Image URL */}
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setAvatarMode("link");
                    setAvatarError(null);
                    setAvatarPreviewFailed(false);
                  }}
                  style={({ pressed }) => [styles.avatarOptionCard, pressed && styles.btnPressed]}
                >
                  <View style={[styles.avatarOptionIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                    <AppIcon name="link-variant" size={22} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.avatarOptionTitle}>2. Gunakan Tautan Gambar</Text>
                    <Text style={styles.avatarOptionDesc}>
                      Masukkan URL direct image (GIF animasi, PNG, JPG, JPEG)
                    </Text>
                  </View>
                  <AppIcon name="chevron-right" size={16} color="#64748B" />
                </Pressable>

                {/* Option 3: Cancel */}
                <Pressable
                  onPress={() => setShowAvatarModal(false)}
                  style={({ pressed }) => [styles.modalBtnSecondary, { marginTop: 6 }, pressed && styles.btnPressed]}
                >
                  <Text style={styles.modalBtnSecondaryText}>3. Batal</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Mode 2: Google Search Flow */}
            {avatarMode === "google" ? (
              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 12 }}>
                  <Text style={styles.modalSubtitle}>
                    Cari gambar avatar anime di Google, salin tautan gambarnya, lalu tempel di kolom bawah ini.
                  </Text>

                  {/* Search Query Input & Launch Button */}
                  <View style={styles.googleQueryRow}>
                    <TextInput
                      style={[styles.modalTextInput, { flex: 1, marginTop: 0 }]}
                      value={googleQuery}
                      onChangeText={setGoogleQuery}
                      placeholder="Contoh: luffy gear 5 pfp"
                      placeholderTextColor="#71717A"
                    />
                    <Pressable
                      onPress={handleOpenGoogleSearch}
                      style={({ pressed }) => [styles.googleSearchBtn, pressed && styles.btnPressed]}
                    >
                      <AppIcon name="magnify" size={16} color="#FFFFFF" />
                      <Text style={styles.googleSearchBtnText}>Cari ↗</Text>
                    </Pressable>
                  </View>

                  {/* Step Guides */}
                  <View style={styles.googleStepBox}>
                    <Text style={styles.googleStepItem}>1. Tekan Cari ↗ untuk membuka Google Images</Text>
                    <Text style={styles.googleStepItem}>2. Klik tahan gambar hasil & pilih 'Salin tautan gambar'</Text>
                    <Text style={styles.googleStepItem}>3. Tempel tautan di bawah ini untuk melihat pratinjau</Text>
                  </View>

                  {/* Live Avatar Circular Preview */}
                  <View style={styles.avatarPreviewCenter}>
                    <BorderAvatar
                      avatarUrl={avatarUrlInput.trim().length > 0 && !avatarPreviewFailed ? avatarUrlInput.trim() : null}
                      fallbackText={initialLetter}
                      borderId={equippedBorderId}
                      avatarSize={76}
                    />
                    <Text style={[styles.avatarPreviewHint, avatarPreviewFailed && { color: "#EF4444" }]}>
                      {avatarPreviewFailed
                        ? "Gambar tidak dapat dimuat atau bukan link langsung"
                        : avatarUrlInput.trim()
                        ? "Pratinjau Avatar (Mendukung GIF Animasi)"
                        : "Pratinjau avatar akan muncul di sini"}
                    </Text>
                  </View>

                  {/* Format Badges */}
                  <View style={styles.formatBadgesRow}>
                    {["GIF Animasi", "PNG", "JPG", "JPEG"].map((fmt) => (
                      <View key={fmt} style={styles.formatBadge}>
                        <Text style={styles.formatBadgeText}>{fmt}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Input URL with Paste Button */}
                  <View style={styles.avatarInputRow}>
                    <TextInput
                      style={[
                        styles.modalTextInput,
                        { flex: 1, marginTop: 0 },
                        !avatarCooldown.canChange && styles.modalTextInputDisabled,
                        avatarError ? styles.modalTextInputError : null,
                      ]}
                      value={avatarUrlInput}
                      onChangeText={(t) => {
                        setAvatarUrlInput(t);
                        setAvatarPreviewFailed(false);
                        if (avatarError) setAvatarError(null);
                      }}
                      placeholder="https://.../avatar.jpg"
                      placeholderTextColor="#71717A"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={avatarCooldown.canChange && !savingAvatar}
                    />
                    {avatarCooldown.canChange && (
                      <Pressable
                        onPress={handlePasteAvatarUrl}
                        style={({ pressed }) => [styles.avatarPasteBtn, pressed && styles.btnPressed]}
                      >
                        <AppIcon name="clipboard-outline" size={15} color="#38BDF8" />
                        <Text style={styles.avatarPasteText}>Tempel</Text>
                      </Pressable>
                    )}
                  </View>

                  {avatarError ? (
                    <Text style={styles.inputErrorText}>{avatarError}</Text>
                  ) : null}

                  {/* Action Buttons */}
                  <View style={styles.modalBtnRow}>
                    <Pressable
                      onPress={() => setAvatarMode("choice")}
                      style={({ pressed }) => [styles.modalBtnSecondary, pressed && styles.btnPressed]}
                    >
                      <Text style={styles.modalBtnSecondaryText}>Kembali</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleSaveAvatar}
                      disabled={
                        savingAvatar ||
                        !avatarCooldown.canChange ||
                        !avatarUrlInput.trim() ||
                        avatarPreviewFailed
                      }
                      style={({ pressed }) => [
                        styles.modalBtnPrimary,
                        (savingAvatar ||
                          !avatarCooldown.canChange ||
                          !avatarUrlInput.trim() ||
                          avatarPreviewFailed) &&
                          styles.modalBtnDisabled,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      {savingAvatar ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.modalBtnPrimaryText}>Simpan Avatar</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            ) : null}

            {/* Mode 3: Direct Link Flow */}
            {avatarMode === "link" ? (
              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 12 }}>
                  <Text style={styles.modalSubtitle}>
                    Masukkan tautan langsung gambar avatar Anda (GIF animasi, PNG, JPG, JPEG).
                  </Text>

                  {/* Live Avatar Circular Preview */}
                  <View style={styles.avatarPreviewCenter}>
                    <BorderAvatar
                      avatarUrl={avatarUrlInput.trim().length > 0 && !avatarPreviewFailed ? avatarUrlInput.trim() : null}
                      fallbackText={initialLetter}
                      borderId={equippedBorderId}
                      avatarSize={76}
                    />
                    <Text style={[styles.avatarPreviewHint, avatarPreviewFailed && { color: "#EF4444" }]}>
                      {avatarPreviewFailed
                        ? "Gambar tidak dapat dimuat atau format tidak didukung"
                        : avatarUrlInput.trim()
                        ? "Pratinjau Avatar (Mendukung GIF Animasi)"
                        : "Pratinjau avatar akan muncul di sini"}
                    </Text>
                  </View>

                  {/* Format Badges */}
                  <View style={styles.formatBadgesRow}>
                    {["GIF Animasi", "PNG", "JPG", "JPEG"].map((fmt) => (
                      <View key={fmt} style={styles.formatBadge}>
                        <Text style={styles.formatBadgeText}>{fmt}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Input URL with Paste Button */}
                  <View style={styles.avatarInputRow}>
                    <TextInput
                      style={[
                        styles.modalTextInput,
                        { flex: 1, marginTop: 0 },
                        !avatarCooldown.canChange && styles.modalTextInputDisabled,
                        avatarError ? styles.modalTextInputError : null,
                      ]}
                      value={avatarUrlInput}
                      onChangeText={(t) => {
                        setAvatarUrlInput(t);
                        setAvatarPreviewFailed(false);
                        if (avatarError) setAvatarError(null);
                      }}
                      placeholder="https://contoh.com/avatar.gif"
                      placeholderTextColor="#71717A"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={avatarCooldown.canChange && !savingAvatar}
                      autoFocus={avatarCooldown.canChange}
                    />
                    {avatarCooldown.canChange && (
                      <Pressable
                        onPress={handlePasteAvatarUrl}
                        style={({ pressed }) => [styles.avatarPasteBtn, pressed && styles.btnPressed]}
                      >
                        <AppIcon name="clipboard-outline" size={15} color="#38BDF8" />
                        <Text style={styles.avatarPasteText}>Tempel</Text>
                      </Pressable>
                    )}
                  </View>

                  {avatarError ? (
                    <Text style={styles.inputErrorText}>{avatarError}</Text>
                  ) : null}

                  {/* Action Buttons */}
                  <View style={styles.modalBtnRow}>
                    <Pressable
                      onPress={() => setAvatarMode("choice")}
                      style={({ pressed }) => [styles.modalBtnSecondary, pressed && styles.btnPressed]}
                    >
                      <Text style={styles.modalBtnSecondaryText}>Batal</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleSaveAvatar}
                      disabled={
                        savingAvatar ||
                        !avatarCooldown.canChange ||
                        !avatarUrlInput.trim() ||
                        avatarPreviewFailed
                      }
                      style={({ pressed }) => [
                        styles.modalBtnPrimary,
                        (savingAvatar ||
                          !avatarCooldown.canChange ||
                          !avatarUrlInput.trim() ||
                          avatarPreviewFailed) &&
                          styles.modalBtnDisabled,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      {savingAvatar ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.modalBtnPrimaryText}>Simpan Avatar</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E14",
  },

  // ─── INITIAL SOCIAL / FEED SCREEN (MATCHING SCREENSHOT) ───
  socialContainer: {
    flex: 1,
    backgroundColor: "#0B0E14",
  },
  socialHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.03)",
    zIndex: 50,
  },
  socialUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  socialUserButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  socialAvatarWrap: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  socialAvatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 23,
  },
  socialAvatarFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 23,
    backgroundColor: "#65A30D",
    alignItems: "center",
    justifyContent: "center",
  },
  socialAvatarInitial: {
    fontFamily: "Nunito-Bold",
    fontSize: 22,
    color: "#FFFFFF",
  },
  socialUserMeta: {
    gap: 3,
  },
  socialNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  socialDisplayName: {
    fontFamily: "Nunito-Bold",
    fontSize: 15.5,
    color: "#FFFFFF",
    letterSpacing: -0.2,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  socialUserTag: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#808A98",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  socialLevelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  socialTierIcon: {
    width: 15,
    height: 15,
  },
  socialStoneIcon: {
    fontSize: 10,
  },
  socialLevelText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  socialSettingsBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  socialScrollView: {
    flex: 1,
    width: "100%",
  },
  socialScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 130,
  },
  inventoryInfoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.45)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.2)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 18,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
        } as any)
      : {}),
  },
  inventoryImg: {
    width: 38,
    height: 38,
    marginRight: 12,
  },
  inventoryTextCol: {
    flex: 1,
    marginRight: 8,
  },
  inventoryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  inventoryTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#F8FAFC",
  },
  inventoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: "rgba(226, 232, 240, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.3)",
  },
  inventoryBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#E2E8F0",
    textTransform: "uppercase",
  },
  inventorySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  inventoryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.2)",
  },
  inventoryActionText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#E2E8F0",
    marginRight: 2,
  },
  socialSectionHeader: {
    marginBottom: 12,
  },
  socialSectionTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#F1F5F9",
  },
  socialSectionSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  featureCardsGrid: {
    gap: 12,
    marginBottom: 18,
  },
  featureCard: {
    backgroundColor: "rgba(18, 22, 31, 0.75)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.22)",
    padding: 16,
    position: "relative",
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 6px 20px rgba(0, 0, 0, 0.35)",
        } as any)
      : {}),
  },
  featureCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  featureCardImg: {
    width: 48,
    height: 48,
  },
  featureCardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(226, 232, 240, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.3)",
  },
  featureCardBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#E2E8F0",
    letterSpacing: 0.6,
  },
  featureCardTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 15.5,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  featureCardDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 17,
    marginBottom: 12,
  },
  featureCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  featureCardCta: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#E2E8F0",
  },
  socialNoticeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 12,
    gap: 12,
  },
  socialNoticeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  socialNoticeTextCol: {
    flex: 1,
  },
  socialNoticeTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#CBD5E1",
    marginBottom: 2,
  },
  socialNoticeSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
    lineHeight: 15,
  },
  duniaFab: {
    position: "absolute",
    bottom: 178,
    right: 18,
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    backgroundColor: "transparent",
    borderWidth: 0,
    ...(Platform.OS === "web"
      ? ({
          cursor: "pointer",
        } as any)
      : {}),
  },
  duniaFabBadge: {
    position: "absolute",
    top: -4,
    right: -2,
    backgroundColor: "#EF4444",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0F172A",
  },
  duniaFabBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  socialFab: {
    position: "absolute",
    bottom: 112,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E2E8F0",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    ...(Platform.OS === "web"
      ? ({
          cursor: "pointer",
        } as any)
      : {}),
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 90,
  },
  btnPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },

  // ─── FLOATING TOAST NOTIFICATION ───
  toastContainer: {
    position: "absolute",
    top: 54,
    left: 20,
    right: 20,
    zIndex: 999,
    alignItems: "center",
  },
  toastBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#161E2E",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },

  // ─── BANNER & TOP ACTIONS ───
  bannerWrapper: {
    width: "100%",
    height: 180,
    position: "relative",
    backgroundColor: "#0B0E14",
    overflow: "hidden",
  },
  bannerCityPlaque: {
    position: "absolute",
    top: 56,
    left: 14,
    zIndex: 15,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  topActionsBar: {
    position: "absolute",
    top: 10,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  topRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(11, 14, 20, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      } as any)
      : {}),
  },

  // ─── AVATAR & USER IDENTITY ───
  profileHeaderBox: {
    paddingHorizontal: 18,
    marginTop: -42,
    alignItems: "center",
  },
  avatarWrapper: {
    position: "relative",
    width: 86,
    height: 86,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3.5,
    borderColor: "#0B0E14",
    overflow: "hidden",
    backgroundColor: "#1E2536",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: "Nunito-Black",
    fontSize: 32,
    color: "#FFFFFF",
  },
  equippedBorderImage: {
    position: "absolute",
    width: 104,
    height: 104,
    top: -9,
    left: -9,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    borderWidth: 2,
    borderColor: "#0B0E14",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 5,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  nameBlock: {
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  displayNameText: {
    fontFamily: "Nunito-Black",
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: -0.3,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  userTagText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#64748B",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  verifiedBadge: {
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 2,
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
    flexWrap: "wrap",
  },
  roleTagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  roleTagText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#EF4444",
    letterSpacing: 0.1,
  },
  socialVerifiedBadge: {
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 1,
  },
  socialPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  socialRolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  socialRolePillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#EF4444",
  },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  tierPillIcon: {
    width: 16,
    height: 16,
  },
  levelPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
  },
  friendsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  friendsPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },

  // ─── STATS CARD (SEAMLESS / TRANSPARENT) ───
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
  },
  statColumn: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statNumber: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  statLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
    textTransform: "lowercase",
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },

  // ─── ACTION BUTTONS ───
  actionsWrap: {
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  addFriendBtn: {
    height: 46,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.28)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    ...(Platform.OS === "web"
      ? ({
        boxShadow: "none",
        cursor: "pointer",
      } as any)
      : {}),
  },
  addFriendText: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureCardBtn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.075)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(18px) saturate(180%)",
        WebkitBackdropFilter: "blur(18px) saturate(180%)",
      } as any)
      : {}),
  },
  featureLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureIcon: {
    fontSize: 16,
  },
  featureBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },

  // ─── CONTENT TABS ───
  tabBarSection: {
    marginTop: 22,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 16,
  },
  tabHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tabButtonActive: {},
  tabButtonText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14.5,
    color: "#64748B",
    textAlign: "center",
  },
  tabButtonTextActive: {
    fontFamily: "Nunito-Black",
    color: "#FFFFFF",
  },
  tabActiveBar: {
    position: "absolute",
    bottom: -1,
    left: "18%",
    right: "18%",
    height: 3,
    backgroundColor: "#38BDF8",
    borderRadius: 1.5,
  },

  // ─── TAB CONTENT AREA ───
  tabContentArea: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tabItemsContainer: {
    gap: 12,
  },

  // ─── COMMENTS CARD ───
  commentCard: {
    paddingVertical: 10,
    paddingHorizontal: 2,
    gap: 10,
  },
  commentAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  commentAuthorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  commentAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarInitial: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  commentAuthorName: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    maxWidth: 140,
  },
  commentTimeDot: {
    color: "#64748B",
    fontSize: 12,
  },
  commentTimeText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
  },
  commentAnimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  commentAnimeThumb: {
    width: 36,
    height: 48,
    borderRadius: 6,
  },
  commentAnimeThumbFallback: {
    width: 36,
    height: 48,
    borderRadius: 6,
    backgroundColor: "#161B26",
    alignItems: "center",
    justifyContent: "center",
  },
  commentAnimeInfo: {
    flex: 1,
    gap: 2,
  },
  commentAnimeTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  commentEpisodeText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  commentBodyText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13.5,
    color: "#E2E8F0",
    lineHeight: 19,
  },
  commentFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 4,
  },
  commentRepliesBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  commentRepliesText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  commentLikesBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  commentLikesText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },

  // ─── BOOKMARKS GRID (1 BARIS UNTUK 2 CARD) ───
  bookmarksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  bookmarkCard: {
    width: "48.2%",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  bookmarkImageWrap: {
    width: "100%",
    aspectRatio: 0.72,
    position: "relative",
    backgroundColor: "#161B26",
  },
  bookmarkImage: {
    width: "100%",
    height: "100%",
  },
  bookmarkImageFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#161B26",
    alignItems: "center",
    justifyContent: "center",
  },
  bookmarkPosterGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "45%",
  },
  bookmarkScoreBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(11, 14, 20, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.35)",
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      } as any)
      : {}),
  },
  bookmarkScoreText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FBBF24",
  },
  bookmarkTypeBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    backgroundColor: "rgba(11, 14, 20, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  bookmarkTypeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  bookmarkBody: {
    padding: 10,
    minHeight: 48,
    justifyContent: "center",
  },
  bookmarkTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    lineHeight: 17,
  },

  // ─── WATCH HISTORY LIST ───
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  historyThumb: {
    width: 70,
    height: 48,
    borderRadius: 8,
  },
  historyThumbFallback: {
    width: 70,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#161B26",
    alignItems: "center",
    justifyContent: "center",
  },
  historyMeta: {
    flex: 1,
    gap: 4,
  },
  historyAnimeTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  historyBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyEpBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  historyEpText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#38BDF8",
  },
  historyTimeText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },
  historyPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── EMPTY STATE ───
  emptyStateBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 8,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 18,
  },

  // ─── AVATAR MODAL & SELECTION STYLES ───
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    padding: 22,
    borderRadius: 22,
    backgroundColor: "#161922",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    gap: 12,
  },
  avatarModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarBackPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  avatarBackText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  modalTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 16.5,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
    lineHeight: 18,
  },
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
  avatarOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  avatarOptionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOptionTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  avatarOptionDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#808A98",
    lineHeight: 16,
  },
  googleQueryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  googleSearchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#2563EB",
  },
  googleSearchBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  googleStepBox: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    gap: 4,
  },
  googleStepItem: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 15,
  },
  avatarPreviewCenter: {
    alignItems: "center",
    gap: 8,
    marginVertical: 4,
  },
  avatarModalPreviewOuter: {
    position: "relative",
    width: 82,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarModalPreviewInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: "#0B0E14",
    overflow: "hidden",
    backgroundColor: "#1E2536",
  },
  avatarModalPreviewImage: {
    width: "100%",
    height: "100%",
  },
  avatarModalPreviewPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  avatarModalPreviewBorder: {
    position: "absolute",
    width: 98,
    height: 98,
    top: -8,
    left: -8,
  },
  avatarPreviewHint: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
  },
  formatBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
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
  avatarInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarPasteBtn: {
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
  avatarPasteText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
  },
  modalTextInput: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  modalTextInputDisabled: {
    opacity: 0.5,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  modalTextInputError: {
    borderColor: "#EF4444",
  },
  inputErrorText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#EF4444",
    marginTop: -4,
  },
  modalBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  modalBtnSecondary: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnSecondaryText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#94A3B8",
  },
  modalBtnPrimary: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnPrimaryText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  modalBtnDisabled: {
    opacity: 0.45,
    backgroundColor: "#334155",
  },
  socialPrivatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  socialPrivatePillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FBBF24",
  },
});
