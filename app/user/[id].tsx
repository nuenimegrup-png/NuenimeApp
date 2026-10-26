import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { AppIcon } from "@/components/app-icon";
import { BorderAvatar } from "@/components/border-avatar";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import {
  type FriendUser,
  type FriendshipStatus,
  getPublicUserProfile,
  getFriendshipStatus,
  getFriends,
  sendFriendRequest,
  acceptFriendRequest,
  rejectOrCancelFriendRequest,
  unfriendUser,
} from "@/lib/friends-service";
import { getTierForLevel } from "@/components/level-progress-modal";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { isSpecialRole } from "@/lib/admin-service";
import { UserVerificationBadge } from "@/components/user-verification-badge";
import { ProfileCityPlaque } from "@/components/profile-city-plaque";

const DEFAULT_BANNER =
  "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1200";

type UserProfileTab = "komentar" | "favorit" | "histori";

function formatJoinDuration(createdAt?: string | null): { number: string; unit: string } {
  if (!createdAt) return { number: "1", unit: "hari" };
  const time = new Date(createdAt).getTime();
  if (!Number.isFinite(time)) return { number: "1", unit: "hari" };
  const diffMs = Math.max(0, Date.now() - time);
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 30) return { number: String(Math.max(1, days)), unit: "hari" };
  const months = Math.floor(days / 30);
  if (months < 12) return { number: String(months), unit: "bulan" };
  const years = Math.floor(days / 365);
  return { number: String(years), unit: "tahun" };
}

function formatRelativeTimeId(dateStr?: string | number | null): string {
  if (!dateStr) return "";
  const time = typeof dateStr === "number" ? dateStr : new Date(dateStr).getTime();
  if (!Number.isFinite(time)) return "";
  const diffMs = Date.now() - time;
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes}m lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}h lalu`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}bln lalu`;
  return `${Math.floor(days / 365)}thn lalu`;
}

export default function PublicUserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAnirakuAuth();
  const currentUserId = auth.user?.id;

  const [targetUser, setTargetUser] = useState<FriendUser | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendshipStatus>("none");
  const [targetFriendCount, setTargetFriendCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<UserProfileTab>("komentar");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real User Data Collections
  const [userComments, setUserComments] = useState<any[]>([]);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [userBookmarks, setUserBookmarks] = useState<any[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const isOwnProfile = Boolean(currentUserId && id && currentUserId === id);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const profile = await getPublicUserProfile(id);
      const isLocked = !Boolean(currentUserId && id && currentUserId === id) && Boolean(profile?.isPrivate);

      const [fList, commentsRes, historyRes, bookmarksRes] = await Promise.all([
        getFriends(id).catch(() => []),
        isLocked
          ? Promise.resolve({ data: [] })
          : supabase
              .from("comments")
              .select("id, user_id, anime_id, content, episode_number, created_at, likes, is_spoiler")
              .eq("user_id", id)
              .order("created_at", { ascending: false })
              .limit(30),
        isLocked
          ? Promise.resolve({ data: [] })
          : supabase
              .from("watch_history")
              .select("id, anime_id, anime_title, anime_image, episode_number, episode_thumbnail, progress, duration, updated_at")
              .eq("user_id", id)
              .order("updated_at", { ascending: false })
              .limit(30),
        isLocked
          ? Promise.resolve({ data: [] })
          : supabase
              .from("bookmarks")
              .select("id, anime_id, title, image, score, type, added_at")
              .eq("user_id", id)
              .order("added_at", { ascending: false })
              .limit(30),
      ]);

      setTargetUser(profile);
      setTargetFriendCount(fList.length);
      setUserComments(commentsRes.data || []);
      setUserHistory(historyRes.data || []);
      setUserBookmarks(bookmarksRes.data || []);

      if (currentUserId && id && currentUserId !== id) {
        const st = await getFriendshipStatus(currentUserId, id);
        setFriendStatus(st);
      }
    } catch (err) {
      console.warn("[public-profile] Error loading user:", err);
    } finally {
      setLoading(false);
    }
  }, [id, currentUserId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Compute Real Stats (100% sinkron persis useWatchStats)
  const joinData = useMemo(() => {
    return formatJoinDuration(targetUser?.createdAt);
  }, [targetUser?.createdAt]);

  const totalMinutes = useMemo(() => {
    return (userHistory || []).reduce(
      (sum, e) => sum + Math.round((Number(e.duration) || Number(e.progress) || 0) / 60),
      0
    );
  }, [userHistory]);

  // Handle Send Friend Request
  const handleSendFriendRequest = async () => {
    if (!currentUserId || !id) return;
    setActionLoading(true);
    hapticLight();
    try {
      const res = await sendFriendRequest(
        currentUserId,
        id,
        auth.profile?.display_name || auth.profile?.username
      );
      if (res.success) {
        hapticSuccess();
        setFriendStatus("pending_sent");
        showToast("Permintaan pertemanan terkirim!");
      } else {
        Alert.alert("Gagal", res.error || "Gagal mengirim permintaan pertemanan.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Accept Friend Request
  const handleAcceptFriendRequest = async () => {
    if (!currentUserId || !id) return;
    setActionLoading(true);
    hapticSuccess();
    try {
      const res = await acceptFriendRequest(
        currentUserId,
        id,
        auth.profile?.display_name || auth.profile?.username
      );
      if (res.success) {
        setFriendStatus("accepted");
        setTargetFriendCount((prev) => prev + 1);
        showToast("Sekarang Anda berteman!");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel Request
  const handleCancelRequest = async () => {
    if (!currentUserId || !id) return;
    setActionLoading(true);
    hapticLight();
    try {
      await rejectOrCancelFriendRequest(currentUserId, id);
      setFriendStatus("none");
      showToast("Permintaan dibatalkan.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Unfriend
  const handleUnfriend = async () => {
    if (!currentUserId || !id) return;
    const executeUnfriend = async () => {
      setActionLoading(true);
      hapticLight();
      try {
        await unfriendUser(currentUserId, id);
        setFriendStatus("none");
        setTargetFriendCount((prev) => Math.max(0, prev - 1));
        showToast("Pertemanan dihapus.");
      } finally {
        setActionLoading(false);
      }
    };

    if (Platform.OS === "web") {
      if (confirm(`Hapus ${targetUser?.displayName} dari daftar teman Anda?`)) {
        await executeUnfriend();
      }
    } else {
      Alert.alert(
        "Hapus Pertemanan",
        `Apakah Anda yakin ingin menghapus ${targetUser?.displayName} dari daftar teman?`,
        [
          { text: "Batal", style: "cancel" },
          { text: "Hapus", style: "destructive", onPress: executeUnfriend },
        ]
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Memuat data profil pengguna...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!targetUser) {
    return (
      <SafeAreaView edges={["top"]} style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBackBtn}>
            <AppIcon name="arrow-left" size={22} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>
        <View style={styles.centerContainer}>
          <AppIcon name="account-search" size={54} color="#64748B" />
          <Text style={styles.notFoundTitle}>Pengguna Tidak Ditemukan</Text>
          <Text style={styles.notFoundSub}>
            Akun ini mungkin sudah dihapus atau ID yang dimasukkan tidak tepat.
          </Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Kembali</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const tierInfo = getTierForLevel(targetUser.level || 1);
  const activeTier = tierInfo?.currentTier;
  const isSpecial = isSpecialRole(targetUser.role);

  // Clean member number (e.g., #1 instead of #0000001)
  const cleanMemberNum =
    "#" + (String(targetUser.memberNumber).replace(/[^0-9]/g, "").replace(/^0+/, "") || "1");

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* ─── TOAST NOTIFICATION ─── */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <View style={styles.toastBox}>
            <AppIcon name="check-circle" size={16} color="#38BDF8" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}

      {/* ─── TOP HEADER (PERSIS YANG DISUKAI USER) ─── */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerBackBtn, pressed && styles.btnPressed]}
        >
          <AppIcon name="arrow-left" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {targetUser.displayName}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka Connections"
          onPress={() => router.push("/connections" as never)}
          style={({ pressed }) => [styles.headerRightBtn, pressed && styles.btnPressed]}
        >
          <AppIcon name="account-group" size={22} color="#CBD5E1" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ─── 1. BANNER IMMERSIVE PERSIS SCREENSHOT 2 ─── */}
        <View style={styles.bannerWrapper}>
          <Image
            source={{ uri: targetUser.bannerUrl || DEFAULT_BANNER }}
            style={styles.bannerImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
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

          {/* Plakat Kota & Klan di Banner Kiri-Tengah */}
          <ProfileCityPlaque
            userId={id}
            style={styles.bannerCityPlaque}
          />
        </View>

        {/* ─── 2. AVATAR CENTERED DENGAN BORDER ASLI (PERSIS SCREENSHOT 2) ─── */}
        <View style={styles.profileHeaderBox}>
          <View style={styles.avatarWrapper}>
            <BorderAvatar
              avatarSize={80}
              borderId={targetUser.equippedBorder}
              avatarUrl={targetUser.avatarUrl || "https://images.alphacoders.com/132/1328004.png"}
            />
          </View>

          {/* User Name, Clean Member Tag, & Verified Badge */}
          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.displayNameText} numberOfLines={1}>
                {targetUser.displayName}
              </Text>
              <Text style={styles.userTagText}>{cleanMemberNum}</Text>
              <View style={styles.verifiedBadge}>
                <UserVerificationBadge role={targetUser.role} isVip={targetUser.isVip} size={17} />
              </View>
            </View>

            {/* Level Pill, Role Tag, & Teman Pill */}
            <View style={styles.pillRow}>
              {/* Level Pill */}
              <View style={styles.levelPill}>
                {activeTier?.imageUrl && (
                  <Image
                    source={{ uri: activeTier.imageUrl }}
                    style={styles.tierPillIcon}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                )}
                <Text style={styles.levelPillText}>Lvl {targetUser.level.toLocaleString("id-ID")}</Text>
              </View>

              {/* Tag Role Khusus (Jika BUKAN Member biasa) */}
              {isSpecial && (
                <View style={styles.roleTagPill}>
                  <AppIcon name="shield-check" size={13} color="#EF4444" />
                  <Text style={styles.roleTagText}>{targetUser.role}</Text>
                </View>
              )}

              {/* Teman Pill */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Lihat Teman"
                onPress={() => router.push("/connections" as never)}
                style={({ pressed }) => [styles.friendsPill, pressed && styles.btnPressed]}
              >
                <AppIcon name="account-group" size={14} color="#94A3B8" />
                <Text style={styles.friendsPillText}>{targetFriendCount} Teman</Text>
              </Pressable>

              {/* Status Profil Privat */}
              {targetUser.isPrivate ? (
                <View
                  style={[
                    styles.privacyStatusPill,
                    isOwnProfile ? styles.privacyStatusPillOwner : styles.privacyStatusPillLocked,
                  ]}
                >
                  <AppIcon
                    name={isOwnProfile ? "lock-check" : "lock"}
                    size={12}
                    color={isOwnProfile ? "#F59E0B" : "#94A3B8"}
                  />
                  <Text
                    style={[
                      styles.privacyStatusPillText,
                      isOwnProfile && { color: "#FBBF24" },
                    ]}
                  >
                    {isOwnProfile ? "Profil Privat" : "Privat"}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ─── 3. USER STATS GRID 4 KOLOM (DATA REAL DISINKRONKAN DARI DATABASE) ─── */}
        <View style={styles.statsCard}>
          <View style={styles.statColumn}>
            <Text style={styles.statNumber}>{joinData.number}</Text>
            <Text style={styles.statLabel}>{joinData.unit}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statColumn}>
            {!isOwnProfile && targetUser.isPrivate ? (
              <View style={styles.statLockWrapper}>
                <AppIcon name="lock" size={16} color="#64748B" />
              </View>
            ) : (
              <Text style={styles.statNumber}>{userComments.length}</Text>
            )}
            <Text style={styles.statLabel}>komentar</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statColumn}>
            {!isOwnProfile && targetUser.isPrivate ? (
              <View style={styles.statLockWrapper}>
                <AppIcon name="lock" size={16} color="#64748B" />
              </View>
            ) : (
              <Text style={styles.statNumber}>{userHistory.length}</Text>
            )}
            <Text style={styles.statLabel}>riwayat</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statColumn}>
            {!isOwnProfile && targetUser.isPrivate ? (
              <View style={styles.statLockWrapper}>
                <AppIcon name="lock" size={16} color="#64748B" />
              </View>
            ) : (
              <Text style={styles.statNumber}>{totalMinutes}</Text>
            )}
            <Text style={styles.statLabel}>menit</Text>
          </View>
        </View>

        {/* ─── 4. TOMBOL AKSI PERTEMANAN (LIQUID GLASS SILVER) & CHAT BULAT ─── */}
        <View style={styles.actionsWrap}>
          {isOwnProfile ? (
            <Pressable
              onPress={() => router.push("/settings" as never)}
              style={({ pressed }) => [styles.liquidGlassBtn, pressed && styles.btnPressed]}
            >
              <AppIcon name="cog-outline" size={17} color="#FFFFFF" />
              <Text style={styles.liquidGlassText}>Pengaturan Akun Saya</Text>
            </Pressable>
          ) : (
            <View style={styles.actionRowWithCircleChat}>
              {/* Tombol Utama Pertemanan (Liquid Glass Silver seperti Tonton Sekarang) */}
              {friendStatus === "accepted" ? (
                <Pressable
                  disabled={actionLoading}
                  onPress={handleUnfriend}
                  style={({ pressed }) => [styles.liquidGlassBtn, pressed && styles.btnPressed]}
                >
                  <AppIcon name="account-check" size={17} color="#34D399" />
                  <Text style={[styles.liquidGlassText, { color: "#34D399" }]}>✓ Berteman</Text>
                </Pressable>
              ) : friendStatus === "pending_sent" ? (
                <Pressable
                  disabled={actionLoading}
                  onPress={handleCancelRequest}
                  style={({ pressed }) => [styles.liquidGlassBtn, pressed && styles.btnPressed]}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <AppIcon name="clock-outline" size={17} color="#CBD5E1" />
                      <Text style={styles.liquidGlassText}>Permintaan Terkirim (Batalkan)</Text>
                    </>
                  )}
                </Pressable>
              ) : friendStatus === "pending_received" ? (
                <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
                  <Pressable
                    disabled={actionLoading}
                    onPress={handleAcceptFriendRequest}
                    style={({ pressed }) => [
                      styles.liquidGlassBtn,
                      { backgroundColor: "rgba(16, 185, 129, 0.22)", borderColor: "rgba(16, 185, 129, 0.45)" },
                      pressed && styles.btnPressed,
                    ]}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <AppIcon name="account-check" size={17} color="#FFFFFF" />
                        <Text style={styles.liquidGlassText}>Terima</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    disabled={actionLoading}
                    onPress={handleCancelRequest}
                    style={({ pressed }) => [styles.rejectBtnSmall, pressed && styles.btnPressed]}
                  >
                    <Text style={styles.rejectBtnText}>Tolak</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  disabled={actionLoading}
                  onPress={handleSendFriendRequest}
                  style={({ pressed }) => [styles.liquidGlassBtn, pressed && styles.btnPressed]}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <AppIcon name="account-plus" size={18} color="#FFFFFF" />
                      <Text style={styles.liquidGlassText}>+ Tambah Teman</Text>
                    </>
                  )}
                </Pressable>
              )}

              {/* Tombol Bulat Chat Private */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chat Private"
                onPress={() => {
                  hapticLight();
                  router.push(`/chat/${targetUser.id}` as never);
                }}
                style={({ pressed }) => [styles.chatCircleBtn, pressed && styles.btnPressed]}
              >
                <AppIcon name="comment-text" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          )}

          {/* Secondary: Peliharaan & Afinitas (Persis Screenshot 2) */}
          <View style={styles.featureRow}>
            <Pressable
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

            <Pressable
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

        {/* ─── 5. TABS KONTEN: JIKA PRIVAT MAKA TERKUNCI, JIKA TIDAK MAKA TAMPILKAN NORMAL ─── */}
        {!isOwnProfile && targetUser.isPrivate ? (
          <View style={styles.lockedContainer}>
            <View style={styles.lockedIconCircle}>
              <AppIcon name="lock" size={38} color="#38BDF8" />
            </View>
            <Text style={styles.lockedTitle}>Akun Ini Bersifat Privat</Text>
            <Text style={styles.lockedSubtitle}>
              Pengguna ini telah mengatur profilnya menjadi privat. Riwayat tontonan, anime favorit, dan komentar disembunyikan.
            </Text>
            <View style={styles.lockedBadge}>
              <AppIcon name="shield-lock-outline" size={15} color="#94A3B8" />
              <Text style={styles.lockedBadgeText}>
                Hanya pemilik akun yang dapat mengakses konten ini
              </Text>
            </View>
          </View>
        ) : (
          <>
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
                Komentar ({userComments.length})
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
                Favorit ({userBookmarks.length})
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
                Histori ({userHistory.length})
              </Text>
              {activeTab === "histori" ? <View style={styles.tabActiveBar} /> : null}
            </Pressable>
          </View>
        </View>

        {/* ─── 6. TAB CONTENT AREA (DATA REAL DARI SUPABASE) ─── */}
        <View style={styles.tabContentArea}>
          {/* TAB 1: KOMENTAR */}
          {activeTab === "komentar" && (
            <View style={styles.tabItemsContainer}>
              {userComments.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <View style={styles.emptyIconCircle}>
                    <AppIcon name="comment-outline" size={26} color="#64748B" />
                  </View>
                  <Text style={styles.emptyTitle}>Belum Ada Komentar</Text>
                  <Text style={styles.emptySubtitle}>
                    Pengguna ini belum memposting komentar pada episode anime.
                  </Text>
                </View>
              ) : (
                userComments.map((comment) => (
                  <View key={comment.id} style={styles.commentCard}>
                    <View style={styles.commentHeaderRow}>
                      <Text style={styles.commentEpisodeText}>
                        {comment.episode_number ? `Episode ${comment.episode_number}` : "Diskusi Anime"}
                      </Text>
                      <Text style={styles.commentTimeText}>
                        {formatRelativeTimeId(comment.created_at)}
                      </Text>
                    </View>
                    <Text style={styles.commentBodyText}>{comment.content}</Text>
                    <View style={styles.commentFooterRow}>
                      <View style={styles.commentLikesBadge}>
                        <AppIcon name="heart-outline" size={13} color="#94A3B8" />
                        <Text style={styles.commentLikesText}>{(comment.likes || 0).toString()}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 2: FAVORIT */}
          {activeTab === "favorit" && (
            <View style={styles.tabItemsContainer}>
              {userBookmarks.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <View style={styles.emptyIconCircle}>
                    <AppIcon name="bookmark-outline" size={26} color="#64748B" />
                  </View>
                  <Text style={styles.emptyTitle}>Belum Ada Favorit</Text>
                  <Text style={styles.emptySubtitle}>
                    Pengguna ini belum menambahkan anime ke daftar favorit.
                  </Text>
                </View>
              ) : (
                <View style={styles.bookmarksGrid}>
                  {userBookmarks.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push(`/anime/${item.anime_id}` as never)}
                      style={styles.bookmarkCard}
                    >
                      <View style={styles.bookmarkImageWrap}>
                        <Image
                          source={{ uri: item.image || item.anime_image }}
                          style={styles.bookmarkImage}
                          contentFit="cover"
                        />
                      </View>
                      <View style={styles.bookmarkBody}>
                        <Text style={styles.bookmarkTitle} numberOfLines={2}>
                          {item.title || item.anime_title || `Anime #${item.anime_id}`}
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
              {userHistory.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <View style={styles.emptyIconCircle}>
                    <AppIcon name="history" size={26} color="#64748B" />
                  </View>
                  <Text style={styles.emptyTitle}>Belum Ada Riwayat</Text>
                  <Text style={styles.emptySubtitle}>
                    Pengguna ini belum memiliki riwayat tontonan episode.
                  </Text>
                </View>
              ) : (
                userHistory.map((entry) => (
                  <Pressable
                    key={entry.id}
                    onPress={() =>
                      router.push(`/watch/${entry.anime_id}?ep=${entry.episode_number || 1}` as never)
                    }
                    style={styles.historyCard}
                  >
                    <Image
                      source={{ uri: entry.episode_thumbnail || entry.anime_image }}
                      style={styles.historyThumb}
                      contentFit="cover"
                    />
                    <View style={styles.historyMeta}>
                      <Text style={styles.historyAnimeTitle} numberOfLines={1}>
                        {entry.anime_title || `Anime #${entry.anime_id}`}
                      </Text>
                      <Text style={styles.historyEpText}>
                        Episode {entry.episode_number || 1} • {formatRelativeTimeId(entry.updated_at)}
                      </Text>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E14",
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
  },
  notFoundTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 17,
    color: "#FFFFFF",
  },
  notFoundSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 280,
  },
  backBtn: {
    backgroundColor: "#161B26",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  backBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#38BDF8",
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

  // ─── HEADER ───
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0B0E14",
    zIndex: 20,
  },
  headerBackBtn: {
    padding: 6,
    borderRadius: 8,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  headerTitle: {
    flex: 1,
    fontFamily: "Nunito-Black",
    fontSize: 17.5,
    color: "#FFFFFF",
    marginHorizontal: 12,
  },
  headerRightBtn: {
    padding: 6,
    borderRadius: 8,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  // ─── SCROLL CONTENT ───
  scrollContent: {
    paddingBottom: 40,
  },

  // ─── BANNER IMMERSIVE ───
  bannerWrapper: {
    width: "100%",
    height: 190,
    position: "relative",
    backgroundColor: "#0B0E14",
    overflow: "hidden",
  },
  bannerCityPlaque: {
    position: "absolute",
    top: 16,
    left: 14,
    zIndex: 15,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },

  // ─── PROFILE HEADER & AVATAR ───
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

  // Name Block
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

  // Pill Row
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
    flexWrap: "wrap",
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

  // ─── STATS CARD (4 STATS TRANSPARAN SEAMLESS) ───
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
  statLockWrapper: {
    height: 24,
    alignItems: "center",
    justifyContent: "center",
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

  // ─── ACTIONS SECTION ───
  actionsWrap: {
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  actionRowWithCircleChat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  liquidGlassBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.25)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        cursor: "pointer",
      } as any)
      : {}),
  },
  liquidGlassText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  chatCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        cursor: "pointer",
      } as any)
      : {}),
  },
  rejectBtnSmall: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 23,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#94A3B8",
  },

  // Secondary buttons (Peliharaan & Afinitas)
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
    fontSize: 14,
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
  },

  // ─── TAB CONTENT AREA ───
  tabContentArea: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tabItemsContainer: {
    gap: 12,
  },
  emptyStateBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
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
    fontFamily: "Nunito-Black",
    fontSize: 15.5,
    color: "#FFFFFF",
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },

  // Comment Card
  commentCard: {
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 8,
  },
  commentHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  commentEpisodeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
  },
  commentTimeText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },
  commentBodyText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#E2E8F0",
    lineHeight: 18,
  },
  commentFooterRow: {
    flexDirection: "row",
    alignItems: "center",
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

  // Bookmarks Grid
  bookmarksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  bookmarkCard: {
    width: "48.2%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  bookmarkImageWrap: {
    width: "100%",
    aspectRatio: 0.72,
    backgroundColor: "#161B26",
  },
  bookmarkImage: {
    width: "100%",
    height: "100%",
  },
  bookmarkBody: {
    padding: 8,
  },
  bookmarkTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
    lineHeight: 16,
  },

  // History Item
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  historyThumb: {
    width: 68,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#161B26",
  },
  historyMeta: {
    flex: 1,
    gap: 3,
  },
  historyAnimeTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  historyEpText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },

  // ─── PRIVACY STATUS PILLS ───
  privacyStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  privacyStatusPillOwner: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  privacyStatusPillLocked: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  privacyStatusPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },

  // ─── LOCKED STATE (PROFIL PRIVAT) ───
  lockedContainer: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 36,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "rgba(22, 27, 38, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  lockedIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  lockedTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 17,
    color: "#FFFFFF",
    textAlign: "center",
  },
  lockedSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 310,
  },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  lockedBadgeText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11.5,
    color: "#64748B",
  },
});
