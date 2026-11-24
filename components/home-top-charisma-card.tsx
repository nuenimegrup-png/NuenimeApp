import React, { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppIcon } from "@/components/app-icon";
import { BorderAvatar } from "@/components/border-avatar";
import { UserVerificationBadge } from "@/components/user-verification-badge";
import { ProfileCityPlaque } from "@/components/profile-city-plaque";
import { getTierForLevel } from "@/components/level-progress-modal";
import {
  getTopCharismaLeaderboard,
  formatCharisma,
  type ProfileCharismaLeaderboardEntry,
} from "@/lib/profile-gifts-service";
import { supabase } from "@/lib/supabase";
import { hapticLight } from "@/lib/haptics";
import { isSpecialRole } from "@/lib/admin-service";
import { Image } from "expo-image";

const GOLD = "#F59E0B";
const SILVER = "#CBD5E1";
const BRONZE = "#F97316";

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

// ── Podium Item Mini Card untuk Top Charisma ────────────────────────────────
const HomeCharismaPodiumItem = React.memo(function HomeCharismaPodiumItem({
  entry,
}: {
  entry: ProfileCharismaLeaderboardEntry;
}) {
  const isFirst = entry.rank === 1;
  const clr = rankColor(entry.rank);
  const avatarSize = isFirst ? 52 : 42;
  const { currentTier, isInfinity } = getTierForLevel(entry.level, (entry as any).role);
  const nameColor = useMemo(() => getUsernameColor(entry.displayName), [entry.displayName]);

  return (
    <View
      style={[
        styles.podiumItem,
        isFirst ? styles.podiumItemFirst : styles.podiumItemOther,
      ]}
    >
      {/* Crown on top */}
      <View style={styles.crownWrapper}>
        <Text style={[styles.crownText, isFirst && styles.crownTextFirst]}>
          {crownIcon(entry.rank)}
        </Text>
      </View>

      {/* Avatar + Border + Rank Badge */}
      <View style={styles.avatarContainer}>
        <BorderAvatar
          avatarUrl={entry.avatarUrl}
          borderId={entry.equippedBorder}
          fallbackText={entry.displayName}
          avatarSize={avatarSize}
        />

        {/* Rank Number Badge (1, 2, 3) */}
        <View
          style={[
            styles.nearAvatarBadge,
            {
              backgroundColor: clr,
              bottom: isFirst ? -2 : -4,
              right: isFirst ? -2 : -4,
            },
          ]}
        >
          <Text style={styles.nearAvatarText}>{entry.rank}</Text>
        </View>
      </View>

      {/* User Name & Verification Badge */}
      <View style={styles.nameRow}>
        <Text style={[styles.userName, { color: nameColor }]} numberOfLines={1}>
          {entry.displayName}
        </Text>
        <UserVerificationBadge role={entry.role} isVip={entry.isVip} size={10} />
      </View>

      {/* Plakat Kota & Klan */}
      <View style={styles.homeCityClanRow}>
        <ProfileCityPlaque userId={entry.userId} podium />
      </View>

      {/* Level Tier Badge */}
      <View
        style={[
          styles.tierPill,
          {
            borderColor: `${currentTier.color}35`,
            backgroundColor: `${currentTier.color}15`,
          },
        ]}
      >
        <Image
          source={{ uri: currentTier.imageUrl }}
          style={styles.tierIcon}
          contentFit="contain"
          transition={150}
        />
        <Text style={[styles.tierText, { color: currentTier.color }]}>
          {isInfinity ? "∞" : `Lv.${entry.level}`}
        </Text>
      </View>

      {/* Charisma Count Badge */}
      <View style={styles.charismaCountPill}>
        <Text style={styles.charismaCountText}>
          {formatCharisma(entry.charismaCount)}
        </Text>
        <Text style={styles.charismaSubText}>Charisma</Text>
      </View>
    </View>
  );
});

// ── Main Home Top Charisma Card ─────────────────────────────────────────────
export const HomeTopCharismaCard = React.memo(function HomeTopCharismaCard() {
  const queryClient = useQueryClient();
  const lastInvalidateRef = useRef(0);

  const { data, isLoading } = useQuery({
    queryKey: ["home-top-charisma-leaderboard"],
    queryFn: () => getTopCharismaLeaderboard(3),
    staleTime: 60_000,
    retry: 2,
  });

  // Realtime listener Supabase untuk update seketika saat ada gift profil baru (dithrottle min 20 detik)
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;
    const channelName = `home-top-charisma-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const throttledInvalidate = () => {
      if (!isMounted) return;
      const now = Date.now();
      if (now - lastInvalidateRef.current < 20_000) return;
      lastInvalidateRef.current = now;
      queryClient.invalidateQueries({ queryKey: ["home-top-charisma-leaderboard"] });
    };

    try {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_profile_gifts" },
          throttledInvalidate
        )
        .subscribe();
    } catch (err) {
      console.warn("[home-top-charisma] Supabase realtime subscription warning:", err);
    }

    return () => {
      isMounted = false;
      if (channel) {
        try {
          void channel.unsubscribe();
          void supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [queryClient]);

  const entries = useMemo(() => {
    return (data ?? []).filter((e) => !isSpecialRole(e.role));
  }, [data]);
  const top3 = entries.slice(0, 3);

  // Urutan podium: 2nd (kiri) | 1st (tengah lebih tinggi) | 3rd (kanan)
  const podiumOrder =
    top3.length >= 3
      ? [top3[1], top3[0], top3[2]]
      : top3.length === 2
      ? [top3[1], top3[0], null]
      : top3.length === 1
      ? [null, top3[0], null]
      : [];

  const handleOpenCharismaLeaderboard = () => {
    hapticLight();
    router.push({
      pathname: "/leaderboard",
      params: { tab: "charisma", mode: "charisma" },
    } as never);
  };

  return (
    <View style={styles.cardContainer}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <AppIcon name="trophy" size={14} color="#F59E0B" />
          </View>
          <Text style={styles.headerTitle}>TOP CHARISMA</Text>
          <View style={styles.livePulseDot} />
        </View>

        <Pressable
          onPress={handleOpenCharismaLeaderboard}
          style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <Text style={styles.seeAllText}>Lihat Semua &gt;</Text>
        </Pressable>
      </View>

      {/* Body: Podium or Empty */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#F59E0B" />
        </View>
      ) : top3.length === 0 ? (
        <Pressable onPress={handleOpenCharismaLeaderboard} style={styles.emptyBox}>
          <AppIcon name="trophy-outline" size={24} color="#F59E0B" />
          <Text style={styles.emptyTitle}>Belum Ada Peringkat Charisma</Text>
          <Text style={styles.emptySub}>
            Kirimkan gift ke profil teman untuk menaikkan peringkat mereka!
          </Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka Leaderboard Charisma"
          onPress={handleOpenCharismaLeaderboard}
          style={styles.podiumRow}
        >
          {podiumOrder.map((entry, idx) =>
            entry ? (
              <HomeCharismaPodiumItem key={entry.userId} entry={entry} />
            ) : (
              <View key={`empty-${idx}`} style={styles.podiumItemEmpty} />
            )
          )}
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  cardContainer: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "#131A29",
    borderWidth: 1.5,
    borderColor: "rgba(245, 158, 11, 0.35)", // Amber Gold khas Charisma
    padding: 14,
    gap: 8,
    minHeight: 245,
    justifyContent: "space-between",
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({
          cursor: "pointer",
        } as any)
      : {}),
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#F59E0B",
    letterSpacing: 0.5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F59E0B",
    marginLeft: 1,
  },
  seeAllBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  seeAllText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#F59E0B",
  },

  // Loading & Empty
  loadingBox: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 4,
  },
  emptyTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
    textAlign: "center",
  },
  emptySub: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
    textAlign: "center",
  },

  // Podium Layout
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
    paddingTop: 6,
    paddingBottom: 4,
  },
  podiumItem: {
    flex: 1,
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  podiumItemFirst: {
    backgroundColor: "rgba(245, 158, 11, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    paddingBottom: 10,
  },
  podiumItemOther: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  podiumItemEmpty: {
    flex: 1,
  },

  // Crown
  crownWrapper: {
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  crownText: {
    fontSize: 12,
  },
  crownTextFirst: {
    fontSize: 15,
  },

  // Avatar + Rank Badge
  avatarContainer: {
    position: "relative",
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  nearAvatarBadge: {
    position: "absolute",
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#0B0E14",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 1.5,
    zIndex: 10,
  },
  nearAvatarText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    color: "#0B0E14",
    lineHeight: 11,
  },

  // Name & Badges
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 3,
    maxWidth: "100%",
    paddingHorizontal: 2,
  },
  userName: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    maxWidth: 68,
  },

  // City & Clan
  homeCityClanRow: {
    marginBottom: 4,
    alignItems: "center",
  },

  // Tier Pill
  tierPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    marginBottom: 4,
  },
  tierIcon: {
    width: 11,
    height: 11,
  },
  tierText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    letterSpacing: 0.2,
  },

  // Charisma Count Pill
  charismaCountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.35)",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  charismaCountText: {
    fontFamily: "Nunito-Black",
    fontSize: 10.5,
    color: "#F59E0B",
  },
  charismaSubText: {
    fontFamily: "Nunito-Regular",
    fontSize: 9,
    color: "#CBD5E1",
  },
});

