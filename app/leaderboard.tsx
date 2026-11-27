import React, { useState, useCallback, useEffect, useMemo } from "react";
import { createShadow } from "@/lib/shadow-style";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeModal as Modal } from "@/components/safe-modal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { AppIcon } from "@/components/app-icon";
import { ChibiLoading } from "@/components/chibi-loading";
import { BorderAvatar } from "@/components/border-avatar";
import { UserVerificationBadge } from "@/components/user-verification-badge";
import { getTierForLevel } from "@/components/level-progress-modal";
import { getEquippedBorderId, getEquippedBorderStorageKey } from "@/lib/avatar-borders";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { isSpecialRole } from "@/lib/admin-service";
import {
  getTopProfileLikesLeaderboard,
  formatLikeCount,
} from "@/lib/profile-likes-service";
import {
  getTopCharismaLeaderboard,
  formatCharisma,
} from "@/lib/profile-gifts-service";
import {
  getFriendshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  rejectOrCancelFriendRequest,
  unfriendUser,
  type FriendshipStatus,
} from "@/lib/friends-service";
import {
  getLeaderboard,
  formatXp,
  getPeriodLabel,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from "@/lib/leaderboard-service";

// ── Medal colors & glow ─────────────────────────────────────────────────────
const GOLD = "#F59E0B";
const SILVER = "#CBD5E1";
const BRONZE = "#F97316";

function rankColor(rank: number): string {
  if (rank === 1) return GOLD;
  if (rank === 2) return SILVER;
  if (rank === 3) return BRONZE;
  return "#64748B";
}

function crownIcon(rank: number): string | null {
  if (rank === 1) return "👑";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

// ── Generate nama warna yang harmonis persis seperti di Chat Global ──────────
const NAME_COLORS = [
  "#38BDF8", // Cyan Sky
  "#4ADE80", // Emerald Green
  "#F43F5E", // Rose Red
  "#A855F7", // Purple
  "#F59E0B", // Amber Gold
  "#2DD4BF", // Teal
  "#EC4899", // Pink
  "#60A5FA", // Blue
];

function getUsernameColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % NAME_COLORS.length;
  return NAME_COLORS[index];
}

/**
 * Mendapatkan tema warna kapsul Rank Tier persis sesuai referensi Chat Global
 */
function getTierPillColors(tierName: string) {
  switch (tierName.toLowerCase()) {
    case "infinity":
      return {
        bg: "rgba(239, 68, 68, 0.16)",
        border: "rgba(239, 68, 68, 0.45)",
        text: "#FCA5A5",
      };
    case "eternal":
      return {
        bg: "rgba(168, 85, 247, 0.16)",
        border: "rgba(168, 85, 247, 0.45)",
        text: "#D8B4FE",
      };
    case "celestial":
      return {
        bg: "rgba(251, 146, 60, 0.16)",
        border: "rgba(251, 146, 60, 0.45)",
        text: "#FDBA74",
      };
    case "ruby star":
      return {
        bg: "rgba(251, 113, 133, 0.16)",
        border: "rgba(251, 113, 133, 0.45)",
        text: "#FDA4AF",
      };
    case "amethyst":
      return {
        bg: "rgba(192, 132, 252, 0.16)",
        border: "rgba(192, 132, 252, 0.45)",
        text: "#E9D5FF",
      };
    case "sapphire":
      return {
        bg: "rgba(56, 189, 248, 0.16)",
        border: "rgba(56, 189, 248, 0.45)",
        text: "#7DD3FC",
      };
    case "emerald":
      return {
        bg: "rgba(52, 211, 153, 0.16)",
        border: "rgba(52, 211, 153, 0.45)",
        text: "#6EE7B7",
      };
    case "gold":
      return {
        bg: "rgba(251, 191, 36, 0.16)",
        border: "rgba(251, 191, 36, 0.45)",
        text: "#FDE047",
      };
    case "silver":
      return {
        bg: "rgba(203, 213, 225, 0.16)",
        border: "rgba(203, 213, 225, 0.45)",
        text: "#E2E8F0",
      };
    case "bronze":
      return {
        bg: "rgba(217, 119, 6, 0.16)",
        border: "rgba(217, 119, 6, 0.45)",
        text: "#FDBA74",
      };
    default:
      return {
        bg: "rgba(148, 163, 184, 0.16)",
        border: "rgba(148, 163, 184, 0.45)",
        text: "#CBD5E1",
      };
  }
}

// ── Podium Top-3 Card ────────────────────────────────────────────────────────
interface PodiumCardProps {
  entry: LeaderboardEntry;
  localMyBorderId?: string | null;
  currentUserId?: string | null;
  currentUsername?: string | null;
  onPress?: () => void;
  isLikesMode?: boolean;
  isCharismaMode?: boolean;
}

const PodiumCard = React.memo(function PodiumCard({
  entry,
  localMyBorderId,
  currentUserId,
  currentUsername,
  onPress,
  isLikesMode,
  isCharismaMode,
}: PodiumCardProps) {
  const isFirst = entry.rank === 1;
  const clr = rankColor(entry.rank);
  const avatarSize = isFirst ? 58 : 48;
  const { currentTier, isInfinity } = getTierForLevel(entry.level, entry.role);
  const nameColor = useMemo(() => getUsernameColor(entry.displayName), [entry.displayName]);
  const tierPillColors = useMemo(
    () => getTierPillColors(currentTier?.name || "Stone"),
    [currentTier?.name]
  );

  // Periksa apakah ini akun user yang sedang aktif
  const isMe =
    (Boolean(currentUserId) && currentUserId === entry.userId) ||
    (Boolean(currentUsername) &&
      currentUsername?.toLowerCase() === entry.username?.toLowerCase());

  // Prioritas border: dari DB -> jika ini user sendiri, gunakan border lokal jika di DB belum ada
  const activeBorder = entry.equippedBorder || (isMe ? localMyBorderId : null);
  const cleanMemberNum =
    entry.memberNumber != null
      ? "#" + (String(entry.memberNumber).replace(/[^0-9]/g, "").replace(/^0+/, "") || "1")
      : null;

  return (
    <View
      style={[
        styles.podiumCard,
        isFirst ? styles.podiumCardFirst : styles.podiumCardOther,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Lihat profil ${entry.displayName}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.podiumTapSection,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        ]}
      >
        {/* ── Avatar Wrapper with Crown & Close Rank Badge ── */}
        <View style={styles.podiumAvatarWrapper}>
          {/* Crown on top */}
          <View style={styles.crownContainer}>
            <Text style={[styles.podiumCrown, isFirst && styles.podiumCrownFirst]}>
              {crownIcon(entry.rank)}
            </Text>
          </View>

          {/* Sync Avatar + Equipped Border */}
          <BorderAvatar
            avatarUrl={entry.avatarUrl}
            borderId={activeBorder}
            fallbackText={entry.displayName}
            avatarSize={avatarSize}
          />

          {/* Rank Badge (1, 2, 3) DI DEKAT AVATAR (kanan bawah avatar) */}
          <View
            style={[
              styles.nearAvatarRankBadge,
              {
                backgroundColor: clr,
                bottom: isFirst ? -2 : -4,
                right: isFirst ? -2 : -4,
              },
            ]}
          >
            <Text style={styles.nearAvatarRankText}>{entry.rank}</Text>
          </View>
        </View>

        {/* ── User Name & Verification Badge ── */}
        <View style={styles.podiumNameRow}>
          <Text style={[styles.podiumName, { color: nameColor }]} numberOfLines={1} ellipsizeMode="tail">
            {entry.displayName}
          </Text>
          <UserVerificationBadge role={entry.role} isVip={entry.isVip} size={11} />
        </View>

        {/* Member # Tag */}
        {cleanMemberNum != null && (
          <Text style={styles.podiumMember}>{cleanMemberNum}</Text>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Detail peringkat ${entry.displayName}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.podiumTapSection,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        ]}
      >
        {/* ── Badges Row: Rank Tier Pill + Level Pill (Persis Chat Global & LeaderRow) ── */}
        <View style={styles.podiumBadgesRow}>
          {currentTier ? (
            <View
              style={[
                styles.podiumRankTierPill,
                {
                  backgroundColor: tierPillColors.bg,
                  borderColor: tierPillColors.border,
                },
              ]}
            >
              <Text style={[styles.podiumRankTierText, { color: tierPillColors.text }]}>
                {currentTier.name.toUpperCase()}
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.podiumLevelPill,
              isInfinity && {
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                borderColor: "rgba(239, 68, 68, 0.35)",
              },
            ]}
          >
            {currentTier?.imageUrl && (
              <Image
                source={{ uri: currentTier.imageUrl }}
                style={styles.podiumTierPillIcon}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            )}
            <Text
              style={[
                styles.podiumLevelPillText,
                isInfinity && {
                  color: "#EF4444",
                  fontFamily: "Nunito-Black",
                },
              ]}
              numberOfLines={1}
            >
              {isInfinity ? "∞" : `Lvl ${entry.level}`}
            </Text>
          </View>
        </View>

        {/* ── XP / Like / Charisma Counter ── */}
        {isCharismaMode ? (
          <View style={styles.podiumCharismaBadge}>
            <Text style={styles.podiumCharismaText}>
              {formatCharisma(entry.xpGained)} Charisma
            </Text>
          </View>
        ) : isLikesMode ? (
          <View style={styles.podiumLikeBadge}>
            <AppIcon name="thumb-up" size={11} color="#EF4444" />
            <Text style={styles.podiumLikeText}>
              {formatLikeCount(entry.xpGained)}
            </Text>
          </View>
        ) : (
          <View style={styles.podiumXpPill}>
            <Text style={[styles.podiumXp, { color: clr }]}>
              {formatXp(entry.xpGained)}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
});

// ── Row item (#4+) ──────────────────────────────────────────────────────────
interface LeaderRowProps {
  entry: LeaderboardEntry;
  localMyBorderId?: string | null;
  currentUserId?: string | null;
  currentUsername?: string | null;
  onPress?: () => void;
  isLikesMode?: boolean;
  isCharismaMode?: boolean;
}

const LeaderRow = React.memo(function LeaderRow({
  entry,
  localMyBorderId,
  currentUserId,
  currentUsername,
  onPress,
  isLikesMode,
  isCharismaMode,
}: LeaderRowProps) {
  const clr = rankColor(entry.rank);
  const { currentTier, isInfinity } = getTierForLevel(entry.level, entry.role);
  const nameColor = useMemo(() => getUsernameColor(entry.displayName), [entry.displayName]);
  const tierPillColors = useMemo(
    () => getTierPillColors(currentTier?.name || "Stone"),
    [currentTier?.name]
  );

  const isMe =
    (Boolean(currentUserId) && currentUserId === entry.userId) ||
    (Boolean(currentUsername) &&
      currentUsername?.toLowerCase() === entry.username?.toLowerCase());

  const activeBorder = entry.equippedBorder || (isMe ? localMyBorderId : null);
  const cleanMemberNum =
    entry.memberNumber != null
      ? "#" + (String(entry.memberNumber).replace(/[^0-9]/g, "").replace(/^0+/, "") || "1")
      : null;

  return (
    <View style={styles.leaderRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Lihat profil ${entry.displayName}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.rowLeftTap,
          pressed && { opacity: 0.82, transform: [{ scale: 0.985 }] },
        ]}
      >
        {/* Rank Number */}
        <View style={styles.rowRankBox}>
          <Text style={[styles.rowRank, { color: clr }]}>#{entry.rank}</Text>
        </View>

        {/* Avatar with Equipped Border */}
        <View style={styles.rowAvatarBox}>
          <BorderAvatar
            avatarUrl={entry.avatarUrl}
            borderId={activeBorder}
            fallbackText={entry.displayName}
            avatarSize={44}
          />
        </View>
      </Pressable>

      {/* Info Name, Clan Plaque, Badges Row */}
      <View style={styles.rowInfo}>
        {/* 1. Header: Display Name + Verification Checkmark + Member Tag */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Lihat detail ${entry.displayName}`}
          onPress={onPress}
          style={({ pressed }) => [styles.rowNameRow, pressed && { opacity: 0.8 }]}
        >
          <Text style={[styles.rowName, { color: nameColor }]} numberOfLines={1}>
            {entry.displayName}
          </Text>
          <UserVerificationBadge
            role={entry.role}
            isVip={entry.isVip}
            size={13}
          />
          {cleanMemberNum != null && (
            <Text style={styles.rowMember}>{cleanMemberNum}</Text>
          )}
        </Pressable>

        {/* 3. Badges Row: Rank Tier Pill + Level Pill (Persis Chat Global) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Lihat level ${entry.displayName}`}
          onPress={onPress}
          style={({ pressed }) => [styles.rowBadges, pressed && { opacity: 0.8 }]}
        >
          {currentTier ? (
            <View
              style={[
                styles.rankTierPill,
                {
                  backgroundColor: tierPillColors.bg,
                  borderColor: tierPillColors.border,
                },
              ]}
            >
              <Text style={[styles.rankTierText, { color: tierPillColors.text }]}>
                {currentTier.name.toUpperCase()}
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.levelPill,
              isInfinity && {
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                borderColor: "rgba(239, 68, 68, 0.35)",
              },
            ]}
          >
            {currentTier?.imageUrl && (
              <Image
                source={{ uri: currentTier.imageUrl }}
                style={styles.tierPillIcon}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            )}
            <Text
              style={[
                styles.levelPillText,
                isInfinity && {
                  color: "#EF4444",
                  fontSize: 13,
                  fontFamily: "Nunito-Black",
                },
              ]}
            >
              {isInfinity ? "∞" : `Lvl ${entry.level.toLocaleString()}`}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* XP / Like / Charisma Counter */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Skor ${entry.displayName}`}
        onPress={onPress}
        style={({ pressed }) => [pressed && { opacity: 0.8 }]}
      >
        {isCharismaMode ? (
          <View style={styles.rowCharismaBox}>
            <Text style={styles.rowCharismaText}>
              {formatCharisma(entry.xpGained)}
            </Text>
            <Text style={styles.rowCharismaSubText}>Charisma</Text>
          </View>
        ) : isLikesMode ? (
          <View style={styles.rowLikeBox}>
            <AppIcon name="thumb-up" size={13} color="#EF4444" />
            <Text style={styles.rowLikeText}>{formatLikeCount(entry.xpGained)}</Text>
          </View>
        ) : (
          <View style={styles.rowXpBox}>
            <Text style={[styles.rowXpText, { color: clr }]}>{formatXp(entry.xpGained)}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
});

const ListSeparator = React.memo(function ListSeparator() {
  return <View style={styles.separator} />;
});

// ── Main Leaderboard Screen ─────────────────────────────────────────────────
const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "daily", label: "Harian" },
  { key: "weekly", label: "Mingguan" },
  { key: "monthly", label: "Bulanan" },
  { key: "alltime", label: "All Time" },
];

export default function LeaderboardScreen() {
  const routeParams = useLocalSearchParams<{ tab?: string; mode?: string }>();
  const initialMode =
    routeParams.tab === "charisma" || routeParams.mode === "charisma"
      ? "charisma"
      : routeParams.tab === "likes" || routeParams.mode === "likes"
      ? "likes"
      : "xp";
  const [activeMenu, setActiveMenu] = useState<"xp" | "likes" | "charisma">(initialMode);
  const [period, setPeriod] = useState<LeaderboardPeriod>("alltime");
  const { user, profile } = useAnirakuAuth();
  const [localMyBorderId, setLocalMyBorderId] = useState<string | null>(null);

  // Sync tab dari route params jika layar dibuka dari Home Cards
  useEffect(() => {
    if (routeParams.tab === "charisma" || routeParams.mode === "charisma") {
      setActiveMenu("charisma");
    } else if (routeParams.tab === "likes" || routeParams.mode === "likes") {
      setActiveMenu("likes");
    } else if (routeParams.tab === "xp" || routeParams.mode === "xp") {
      setActiveMenu("xp");
    }
  }, [routeParams.tab, routeParams.mode]);

  // User Bottom Sheet Modal State
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [friendStatus, setFriendStatus] = useState<FriendshipStatus>("none");
  const [actionLoading, setActionLoading] = useState(false);

  // Handler buka modal profile saat card diklik
  const handleSelectEntry = useCallback(
    async (entry: LeaderboardEntry) => {
      hapticLight();
      setSelectedEntry(entry);
      setShowUserModal(true);
      if (user?.id && entry.userId && user.id !== entry.userId) {
        try {
          const st = await getFriendshipStatus(user.id, entry.userId);
          setFriendStatus(st);
        } catch {
          setFriendStatus("none");
        }
      } else {
        setFriendStatus("none");
      }
    },
    [user?.id]
  );

  // Handler aksi pertemanan di modal
  const handleFriendAction = async () => {
    if (!user?.id || !selectedEntry || actionLoading) return;
    hapticLight();
    setActionLoading(true);

    try {
      if (friendStatus === "accepted") {
        const doUnfriend = async () => {
          await unfriendUser(user.id, selectedEntry.userId);
          setFriendStatus("none");
        };

        if (Platform.OS === "web") {
          if (confirm(`Hapus ${selectedEntry.displayName} dari daftar teman?`)) {
            await doUnfriend();
          }
        } else {
          Alert.alert(
            "Hapus Teman",
            `Apakah Anda yakin ingin menghapus ${selectedEntry.displayName} dari daftar teman?`,
            [
              { text: "Batal", style: "cancel" },
              { text: "Hapus", style: "destructive", onPress: doUnfriend },
            ]
          );
        }
      } else if (friendStatus === "pending_sent") {
        await rejectOrCancelFriendRequest(user.id, selectedEntry.userId);
        setFriendStatus("none");
      } else if (friendStatus === "pending_received") {
        hapticSuccess();
        await acceptFriendRequest(
          user.id,
          selectedEntry.userId,
          profile?.display_name || profile?.username
        );
        setFriendStatus("accepted");
      } else {
        hapticSuccess();
        const res = await sendFriendRequest(
          user.id,
          selectedEntry.userId,
          profile?.display_name || profile?.username
        );
        if (res.success) {
          setFriendStatus("pending_sent");
        } else {
          Alert.alert("Gagal", res.error || "Gagal mengirim permintaan pertemanan.");
        }
      }
    } catch (err) {
      console.warn("[leaderboard] friend action error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Ambil border aktif dari local storage dan sinkronkan ke database Supabase jika perlu
  useEffect(() => {
    let isMounted = true;

    async function loadAndSyncBorder() {
      try {
        // Cek berbagai key penyimpanan lokal (per-user, legacy, guest)
        let border: string | null = null;
        if (user?.id) {
          border = await AsyncStorage.getItem(getEquippedBorderStorageKey(user.id));
        }
        if (!border) {
          border = await AsyncStorage.getItem("nuenime.equipped.border");
        }
        if (!border) {
          border = await AsyncStorage.getItem("nuenime.equipped_border.guest");
        }

        if (isMounted && border) {
          setLocalMyBorderId(border);

          // AUTO-SYNC: simpan ke database hanya jika di database belum ada atau berbeda
          if (user?.id && profile?.equipped_border !== border) {
            await supabase
              .from("profiles")
              .update({ equipped_border: border })
              .eq("id", user.id);
          }
        }
      } catch {
        // Ignore
      }
    }

    loadAndSyncBorder();
    return () => {
      isMounted = false;
    };
  }, [user?.id, profile?.equipped_border]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () => getLeaderboard(period, 50),
    staleTime: 60_000,
    retry: 2,
    enabled: activeMenu === "xp",
  });

  const likesQuery = useQuery({
    queryKey: ["leaderboard-likes"],
    queryFn: () => getTopProfileLikesLeaderboard(50),
    staleTime: 30_000,
    retry: 2,
    enabled: activeMenu === "likes",
  });

  const charismaQuery = useQuery({
    queryKey: ["leaderboard-charisma"],
    queryFn: () => getTopCharismaLeaderboard(50),
    staleTime: 30_000,
    retry: 2,
    enabled: activeMenu === "charisma",
  });

  // Realtime update saat ada interaksi like profil atau gift baru
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;
    const channelName = `leaderboard-realtime-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_profile_likes" },
          () => {
            if (isMounted) {
              likesQuery.refetch();
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_profile_gifts" },
          () => {
            if (isMounted) {
              charismaQuery.refetch();
            }
          }
        )
        .subscribe();
    } catch {}

    return () => {
      isMounted = false;
      if (channel) {
        try {
          void channel.unsubscribe();
          void supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, []);

  const xpEntries = useMemo(() => {
    return (data ?? []).filter((e) => !isSpecialRole(e.role));
  }, [data]);

  const likesEntries = useMemo(() => {
    return (likesQuery.data ?? []).map((item) => ({
      rank: item.rank,
      userId: item.userId,
      username: item.username,
      displayName: item.displayName,
      avatarUrl: item.avatarUrl,
      memberNumber: item.memberNumber,
      level: item.level,
      isVip: item.isVip,
      xpGained: item.likesCount,
      periodStart: "",
      periodEnd: "",
      equippedBorder: item.equippedBorder,
      role: item.role,
    }));
  }, [likesQuery.data]);

  const charismaEntries = useMemo(() => {
    return (charismaQuery.data ?? []).map((item) => ({
      rank: item.rank,
      userId: item.userId,
      username: item.username,
      displayName: item.displayName,
      avatarUrl: item.avatarUrl,
      memberNumber: item.memberNumber,
      level: item.level,
      isVip: item.isVip,
      xpGained: item.charismaCount,
      periodStart: "",
      periodEnd: "",
      equippedBorder: item.equippedBorder,
      role: item.role,
    }));
  }, [charismaQuery.data]);

  const activeEntries =
    activeMenu === "charisma"
      ? charismaEntries
      : activeMenu === "likes"
      ? likesEntries
      : xpEntries;

  const isCurrentLoading =
    activeMenu === "charisma"
      ? charismaQuery.isLoading
      : activeMenu === "likes"
      ? likesQuery.isLoading
      : isLoading;

  const isCurrentRefetching =
    activeMenu === "charisma"
      ? charismaQuery.isRefetching
      : activeMenu === "likes"
      ? likesQuery.isRefetching
      : isRefetching;

  const top3 = activeEntries.slice(0, 3);

  // Re-order podium: 2nd (kiri) | 1st (tengah lebih tinggi) | 3rd (kanan)
  const podiumOrder =
    top3.length >= 3
      ? [top3[1], top3[0], top3[2]]
      : top3.length === 2
      ? [top3[1], top3[0], null]
      : top3.length === 1
      ? [null, top3[0], null]
      : [];

  const rest = activeEntries.slice(3);
  const periodLabel = getPeriodLabel(period);

  const handleRefresh = useCallback(async () => {
    // Refresh local border & query
    getEquippedBorderId(user?.id)
      .then((id) => setLocalMyBorderId(id))
      .catch(() => {});
    if (activeMenu === "charisma") {
      await charismaQuery.refetch();
    } else if (activeMenu === "likes") {
      await likesQuery.refetch();
    } else {
      await refetch();
    }
  }, [activeMenu, charismaQuery, likesQuery, refetch, user?.id]);

  const renderLeaderRow = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <LeaderRow
        entry={item}
        localMyBorderId={localMyBorderId}
        currentUserId={user?.id}
        currentUsername={profile?.username}
        onPress={() => handleSelectEntry(item)}
        isLikesMode={activeMenu === "likes"}
        isCharismaMode={activeMenu === "charisma"}
      />
    ),
    [localMyBorderId, user?.id, profile?.username, handleSelectEntry, activeMenu]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0E14" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            hapticLight();
            router.back();
          }}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          hitSlop={12}
        >
          <AppIcon name="arrow-left" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {activeMenu === "charisma"
            ? "Leaderboard Charisma"
            : activeMenu === "likes"
            ? "Leaderboard Like"
            : "Leaderboard XP"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Menu Switcher Tab: Peringkat XP vs Top Like vs Top Charisma ── */}
      <View style={styles.menuSwitcherContainer}>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Menu Leaderboard XP"
          onPress={() => {
            hapticLight();
            setActiveMenu("xp");
          }}
          style={[
            styles.menuSwitcherBtn,
            activeMenu === "xp" && styles.menuSwitcherBtnActiveXp,
          ]}
        >
          <AppIcon
            name="trophy"
            size={14}
            color={activeMenu === "xp" ? "#38BDF8" : "#94A3B8"}
          />
          <Text
            style={[
              styles.menuSwitcherText,
              activeMenu === "xp" && styles.menuSwitcherTextActiveXp,
            ]}
          >
            Peringkat XP
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Menu Leaderboard Top Like"
          onPress={() => {
            hapticLight();
            setActiveMenu("likes");
          }}
          style={[
            styles.menuSwitcherBtn,
            activeMenu === "likes" && styles.menuSwitcherBtnActiveLikes,
          ]}
        >
          <AppIcon
            name="thumb-up"
            size={13}
            color={activeMenu === "likes" ? "#EF4444" : "#94A3B8"}
          />
          <Text
            style={[
              styles.menuSwitcherText,
              activeMenu === "likes" && styles.menuSwitcherTextActiveLikes,
            ]}
          >
            Top Like
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Menu Leaderboard Top Charisma"
          onPress={() => {
            hapticLight();
            setActiveMenu("charisma");
          }}
          style={[
            styles.menuSwitcherBtn,
            activeMenu === "charisma" && styles.menuSwitcherBtnActiveCharisma,
          ]}
        >
          <AppIcon
            name="trophy"
            size={14}
            color={activeMenu === "charisma" ? "#F59E0B" : "#94A3B8"}
          />
          <Text
            style={[
              styles.menuSwitcherText,
              activeMenu === "charisma" && styles.menuSwitcherTextActiveCharisma,
            ]}
          >
            Top Charisma
          </Text>
        </Pressable>
      </View>

      {/* Konten Menu XP: Period Tabs */}
      {activeMenu === "xp" ? (
        <>
          <View style={styles.tabWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabScrollView}
              contentContainerStyle={styles.tabRow}
            >
              {PERIODS.map((p) => {
                const isActive = period === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => {
                      hapticLight();
                      setPeriod(p.key);
                    }}
                    style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                  >
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <Text style={styles.periodDateLabel}>{periodLabel}</Text>
        </>
      ) : activeMenu === "likes" ? (
        <View style={styles.likesSubtitleWrapper}>
          <Text style={styles.likesSubtitleText}>
            Profil dengan like terbanyak dari komunitas Nuenime.
          </Text>
        </View>
      ) : (
        <View style={styles.likesSubtitleWrapper}>
          <Text style={styles.likesSubtitleText}>
            Profil dengan Charisma terbanyak yang diperoleh dari kiriman gift.
          </Text>
        </View>
      )}

      {isCurrentLoading ? (
        <ChibiLoading size={80} style={{ marginTop: 60 }} />
      ) : activeEntries.length === 0 ? (
        <View style={styles.empty}>
          <AppIcon
            name={
              activeMenu === "charisma"
                ? "trophy"
                : activeMenu === "likes"
                ? "thumb-up"
                : "trophy-outline"
            }
            size={48}
            color={
              activeMenu === "charisma"
                ? "#F59E0B"
                : activeMenu === "likes"
                ? "#EF4444"
                : "#334155"
            }
          />
          <Text style={styles.emptyTitle}>Belum Ada Data</Text>
          <Text style={styles.emptyDesc}>
            {activeMenu === "charisma"
              ? "Papan peringkat Charisma akan terisi saat pengguna saling mengirimkan gift profil."
              : activeMenu === "likes"
              ? "Papan peringkat like profil akan terisi saat pengguna saling memberikan like akun."
              : `Papan peringkat ${
                  period === "daily"
                    ? "harian"
                    : period === "weekly"
                    ? "mingguan"
                    : period === "monthly"
                    ? "bulanan"
                    : "all-time"
                } akan terisi saat pengguna mulai aktif beraktivitas.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(item) => item.userId}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== "web"}
          refreshControl={
            <RefreshControl
              refreshing={isCurrentRefetching}
              onRefresh={handleRefresh}
              tintColor={
                activeMenu === "charisma"
                  ? "#F59E0B"
                  : activeMenu === "likes"
                  ? "#EF4444"
                  : "#38BDF8"
              }
            />
          }
          ListHeaderComponent={
            <>
              {/* Podium Top-3 */}
              {podiumOrder.length > 0 && (
                <View style={styles.podiumRow}>
                  {podiumOrder.map((entry, idx) =>
                    entry ? (
                      <PodiumCard
                        key={entry.userId}
                        entry={entry}
                        localMyBorderId={localMyBorderId}
                        currentUserId={user?.id}
                        currentUsername={profile?.username}
                        onPress={() => handleSelectEntry(entry)}
                        isLikesMode={activeMenu === "likes"}
                        isCharismaMode={activeMenu === "charisma"}
                      />
                    ) : (
                      <View key={`empty-${idx}`} style={styles.podiumEmpty} />
                    )
                  )}
                </View>
              )}

              {rest.length > 0 && (
                <View style={styles.restHeader}>
                  <AppIcon name="format-list-numbered" size={14} color="#64748B" />
                  <Text style={styles.restHeaderText}>Peringkat Selanjutnya</Text>
                </View>
              )}
            </>
          }
          renderItem={renderLeaderRow}
          ItemSeparatorComponent={ListSeparator}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {/* ─── BOTTOM SHEET MODAL: USER OPTIONS (PERSIS SCREENSHOT) ─── */}
      <Modal
        visible={showUserModal && Boolean(selectedEntry)}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUserModal(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setShowUserModal(false)}
        >
          <Pressable style={styles.bottomSheetCard} onPress={(e) => e.stopPropagation()}>
            {/* Grab Handle */}
            <View style={styles.sheetGrabHandle} />

            {/* Friend Header Preview */}
            {selectedEntry && (() => {
              const seTierInfo = getTierForLevel(selectedEntry.level, selectedEntry.role);
              const seTier = seTierInfo.currentTier;
              const seCleanNum =
                selectedEntry.memberNumber != null
                  ? "#" + (String(selectedEntry.memberNumber).replace(/[^0-9]/g, "").replace(/^0+/, "") || "1")
                  : "#1";
              const seBorder =
                selectedEntry.equippedBorder ||
                (selectedEntry.userId === user?.id ? localMyBorderId : null);
              const seNameColor = getUsernameColor(selectedEntry.displayName);
              const seTierColors = getTierPillColors(seTier?.name || "Stone");

              return (
                <View style={styles.sheetFriendHeader}>
                  <BorderAvatar
                    size={46}
                    borderId={seBorder}
                    avatarUrl={selectedEntry.avatarUrl}
                    fallbackText={selectedEntry.displayName}
                  />
                  <View style={styles.sheetFriendInfo}>
                    <View style={styles.sheetNameRow}>
                      <Text style={[styles.sheetDisplayNameText, { color: seNameColor }]} numberOfLines={1}>
                        {selectedEntry.displayName}
                      </Text>
                      <UserVerificationBadge
                        role={selectedEntry.role}
                        isVip={selectedEntry.isVip}
                        size={14}
                      />
                      <Text style={styles.sheetMemberNumberText}>{seCleanNum}</Text>
                    </View>

                    <View style={styles.sheetBadgesRow}>
                      <View
                        style={[
                          styles.rankTierPill,
                          {
                            backgroundColor: seTierColors.bg,
                            borderColor: seTierColors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.rankTierText, { color: seTierColors.text }]}>
                          {seTier.name.toUpperCase()}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.levelPill,
                          seTierInfo.isInfinity && {
                            backgroundColor: "rgba(239, 68, 68, 0.12)",
                            borderColor: "rgba(239, 68, 68, 0.35)",
                          },
                        ]}
                      >
                        {seTier?.imageUrl && (
                          <Image
                            source={{ uri: seTier.imageUrl }}
                            style={styles.tierPillIcon}
                            contentFit="contain"
                            cachePolicy="memory-disk"
                          />
                        )}
                        <Text style={styles.levelPillText}>
                          {seTierInfo.isInfinity ? "∞" : `Lvl ${selectedEntry.level.toLocaleString("id-ID")}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })()}

            <View style={styles.sheetDivider} />

            {/* Opsi 1: Lihat Profil */}
            <Pressable
              onPress={() => {
                if (!selectedEntry) return;
                setShowUserModal(false);
                hapticLight();
                router.push(`/user/${selectedEntry.userId}` as never);
              }}
              style={({ pressed }) => [styles.sheetActionRow, pressed && { opacity: 0.7 }]}
            >
              <AppIcon name="account" size={20} color="#CBD5E1" />
              <Text style={styles.sheetActionText}>Lihat Profil</Text>
            </Pressable>

            {/* Opsi 2: Aksi Pertemanan (Hanya jika BUKAN akun sendiri) */}
            {selectedEntry && user?.id && selectedEntry.userId !== user.id && (
              <>
                <View style={styles.sheetDivider} />

                <Pressable
                  disabled={actionLoading}
                  onPress={handleFriendAction}
                  style={({ pressed }) => [styles.sheetActionRow, pressed && { opacity: 0.7 }]}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#38BDF8" />
                  ) : friendStatus === "accepted" ? (
                    <>
                      <AppIcon name="trash-can-outline" size={20} color="#F87171" />
                      <Text style={[styles.sheetActionText, { color: "#F87171" }]}>
                        Hapus Teman
                      </Text>
                    </>
                  ) : friendStatus === "pending_sent" ? (
                    <>
                      <AppIcon name="clock-outline" size={20} color="#94A3B8" />
                      <Text style={[styles.sheetActionText, { color: "#94A3B8" }]}>
                        Permintaan Terkirim (Batalkan)
                      </Text>
                    </>
                  ) : friendStatus === "pending_received" ? (
                    <>
                      <AppIcon name="account-check" size={20} color="#34D399" />
                      <Text style={[styles.sheetActionText, { color: "#34D399" }]}>
                        Terima Permintaan
                      </Text>
                    </>
                  ) : (
                    <>
                      <AppIcon name="account-plus" size={20} color="#38BDF8" />
                      <Text style={[styles.sheetActionText, { color: "#38BDF8" }]}>
                        Tambah Teman
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E14",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  // Menu Switcher: Peringkat XP vs Top Like Profil
  menuSwitcherContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: "rgba(18, 24, 38, 0.7)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 3,
    gap: 4,
  },
  menuSwitcherBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 11,
  },
  menuSwitcherBtnActiveXp: {
    backgroundColor: "rgba(56, 189, 248, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.45)",
  },
  menuSwitcherBtnActiveLikes: {
    backgroundColor: "rgba(239, 68, 68, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.45)",
  },
  menuSwitcherBtnActiveCharisma: {
    backgroundColor: "rgba(245, 158, 11, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.45)",
  },
  menuSwitcherText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  menuSwitcherTextActiveXp: {
    color: "#38BDF8",
    fontFamily: "Nunito-Black",
  },
  menuSwitcherTextActiveLikes: {
    color: "#EF4444",
    fontFamily: "Nunito-Black",
  },
  menuSwitcherTextActiveCharisma: {
    color: "#F59E0B",
    fontFamily: "Nunito-Black",
  },
  likesSubtitleWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  likesSubtitleText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
  },

  // Tabs (Fixed Height & Ramping)
  tabWrapper: {
    height: 46,
    marginVertical: 4,
  },
  tabScrollView: {
    flexGrow: 0,
    height: 44,
  },
  tabRow: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  tabBtn: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "rgba(56,189,248,0.18)",
    borderColor: "#38BDF8",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.2,
  },
  tabTextActive: {
    color: "#38BDF8",
  },

  // Period date
  periodDateLabel: {
    fontSize: 11,
    color: "#64748B",
    paddingHorizontal: 18,
    marginTop: 6,
    marginBottom: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  // Podium
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 2,
    paddingHorizontal: 4,
    paddingBottom: 14,
    paddingTop: 10,
    backgroundColor: "rgba(18, 24, 38, 0.7)",
    marginHorizontal: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 16,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({ backdropFilter: "blur(20px)" } as any)
      : {}),
  },
  podiumEmpty: {
    flex: 1,
  },
  podiumCard: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 1,
    paddingBottom: 4,
    maxWidth: "33.33%",
    overflow: "hidden",
  },
  podiumTapSection: {
    width: "100%",
    alignItems: "center",
  },
  podiumCardFirst: {
    paddingTop: 6,
    minHeight: 250,
    justifyContent: "flex-end",
    zIndex: 2,
  },
  podiumCardOther: {
    paddingTop: 14,
    minHeight: 232,
    justifyContent: "flex-end",
  },

  // Avatar + Crown + Near Avatar Rank Badge
  podiumAvatarWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  crownContainer: {
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  podiumCrown: {
    fontSize: 18,
  },
  podiumCrownFirst: {
    fontSize: 22,
  },
  nearAvatarRankBadge: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0B0E14",
    ...createShadow({ color: "#000", offset: { width: 0, height: 2 }, opacity: 0.3, radius: 3, elevation: 4 }),
    zIndex: 10,
  },
  nearAvatarRankText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#0B0E14",
  },

  // Podium Names & Member
  podiumNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    marginTop: 2,
    width: "100%",
    paddingHorizontal: 2,
  },
  podiumName: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F1F5F9",
    textAlign: "center",
    maxWidth: "80%",
  },
  podiumMember: {
    fontSize: 9,
    color: "#64748B",
    fontWeight: "700",
    marginTop: 1,
  },
  podiumCityClanRow: {
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: 2,
    marginBottom: 2,
  },
  podiumBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: 22,
    width: "100%",
    marginTop: 2,
  },
  podiumRankTierPill: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  podiumRankTierText: {
    fontFamily: "Nunito-Black",
    fontSize: 8,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  podiumLevelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2.5,
    backgroundColor: "#1E2636",
    paddingHorizontal: 4,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  podiumTierPillIcon: {
    width: 10,
    height: 10,
  },
  podiumLevelPillText: {
    fontSize: 8.5,
    fontWeight: "700",
    color: "#38BDF8",
  },

  // Level Tier Badge on Podium (legacy fallback)
  podiumTierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderWidth: 1,
    marginTop: 2,
  },
  podiumTierIcon: {
    width: 14,
    height: 14,
  },
  podiumTierText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  // XP Pill
  podiumXpPill: {
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
  },
  podiumXp: {
    fontSize: 12.5,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  podiumLikeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    marginTop: 3,
  },
  podiumLikeText: {
    fontFamily: "Nunito-Black",
    fontSize: 10.5,
    color: "#EF4444",
  },
  podiumCharismaBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.16)",
    borderColor: "rgba(245, 158, 11, 0.45)",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    marginTop: 3,
    gap: 3,
  },
  podiumCharismaText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    color: "#F59E0B",
  },

  // Rest header
  restHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  restHeaderText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // Leader row
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  rowLeftTap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowRankBox: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  rowRank: {
    fontSize: 13,
    fontWeight: "900",
  },
  rowAvatarBox: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  rowInfo: {
    flex: 1,
    gap: 3,
    marginLeft: 2,
  },
  rowNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  rowName: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#F1F5F9",
    maxWidth: "60%",
  },
  rowMember: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "700",
  },
  rowCityClanRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 2,
    marginBottom: 3,
  },
  rowBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },

  // ─── TIER & LEVEL PILLS (PERSIS CHAT GLOBAL) ───
  rankTierPill: {
    paddingHorizontal: 5.5,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rankTierText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#1E2636",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  tierPillIcon: {
    width: 11,
    height: 11,
  },
  levelPillText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#38BDF8",
  },

  rowTierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  rowTierIcon: {
    width: 13,
    height: 13,
  },
  rowTierText: {
    fontSize: 10,
    fontWeight: "700",
  },

  rowXpBox: {
    alignItems: "flex-end",
    minWidth: 64,
  },
  rowXpText: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#F1F5F9",
    letterSpacing: 0.2,
  },
  rowLikeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 6,
  },
  rowLikeText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#EF4444",
  },
  rowCharismaBox: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 64,
    marginLeft: 6,
  },
  rowCharismaText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#F59E0B",
  },
  rowCharismaSubText: {
    fontFamily: "Nunito-Regular",
    fontSize: 9.5,
    color: "#64748B",
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginHorizontal: 16,
  },

  // Empty state
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#334155",
  },
  emptyDesc: {
    fontSize: 13,
    color: "#334155",
    textAlign: "center",
    lineHeight: 20,
  },

  // ─── BOTTOM SHEET MODAL (MATCHES SCREENSHOT) ───
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  bottomSheetCard: {
    backgroundColor: "#111622",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  sheetGrabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetFriendHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 14,
    marginBottom: 14,
  },
  sheetFriendInfo: {
    flex: 1,
    gap: 4,
  },
  sheetNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sheetDisplayNameText: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  sheetBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  sheetLevelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  sheetTierPillIcon: {
    width: 13,
    height: 13,
  },
  sheetLevelPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#34D399",
  },
  sheetTierPill: {
    backgroundColor: "rgba(168, 85, 247, 0.16)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  sheetTierPillText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    color: "#C084FC",
    letterSpacing: 0.5,
  },
  sheetMemberNumberText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
  },
  sheetDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    marginVertical: 4,
  },
  sheetActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  sheetActionText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
});
