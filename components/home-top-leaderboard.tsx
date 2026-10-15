import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppIcon } from "@/components/app-icon";
import { BorderAvatar } from "@/components/border-avatar";
import { getTierForLevel } from "@/components/level-progress-modal";
import { getLeaderboard, formatXp, type LeaderboardEntry } from "@/lib/leaderboard-service";
import { supabase } from "@/lib/supabase";
import { hapticLight } from "@/lib/haptics";

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

// ── Podium Item Mini Card ───────────────────────────────────────────────────
function HomePodiumItem({ entry }: { entry: LeaderboardEntry }) {
  const isFirst = entry.rank === 1;
  const clr = rankColor(entry.rank);
  const avatarSize = isFirst ? 52 : 42;
  const { currentTier } = getTierForLevel(entry.level);

  return (
    <View
      style={[
        styles.podiumItem,
        isFirst ? styles.podiumItemFirst : styles.podiumItemOther,
        {
          borderColor: isFirst
            ? "rgba(245, 158, 11, 0.35)"
            : entry.rank === 2
            ? "rgba(203, 213, 225, 0.2)"
            : "rgba(249, 115, 22, 0.2)",
          backgroundColor: isFirst
            ? "rgba(245, 158, 11, 0.05)"
            : "rgba(255, 255, 255, 0.025)",
        },
      ]}
    >
      {/* Crown on top */}
      <View style={styles.crownWrapper}>
        <Text style={[styles.crownText, isFirst && styles.crownTextFirst]}>
          {crownIcon(entry.rank)}
        </Text>
      </View>

      {/* Avatar + Border + Rank Badge menempel di kanan bawah */}
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

      {/* User Name */}
      <View style={styles.nameRow}>
        <Text style={styles.userName} numberOfLines={1}>
          {entry.displayName}
        </Text>
        {entry.isVip && (
          <AppIcon name="check-decagram" size={10} color="#06B6D4" />
        )}
      </View>

      {/* Level Tier Badge with Official Tier Icon */}
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
          Lv.{entry.level}
        </Text>
      </View>

      {/* XP Counter */}
      <Text style={[styles.xpText, { color: clr }]}>
        {formatXp(entry.xpGained)}
      </Text>
    </View>
  );
}

// ── Main Home Top Leaderboard Card ──────────────────────────────────────────
export function HomeTopLeaderboard() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["home-top-leaderboard"],
    queryFn: () => getLeaderboard("alltime", 3),
    staleTime: 30_000,
    retry: 2,
  });

  // Realtime listener Supabase untuk update otomatis seketika
  useEffect(() => {
    const channel = supabase
      .channel("home-top-leaderboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["home-top-leaderboard"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_xp_transactions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["home-top-leaderboard"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const entries = data ?? [];
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

  const handleOpenLeaderboard = () => {
    hapticLight();
    router.push("/leaderboard" as never);
  };

  return (
    <View style={styles.cardContainer}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Image
            source={{ uri: "https://i.ibb.co.com/ccJmQCfx/download-7-removebg-preview.png" }}
            style={styles.leaderboardIcon}
            contentFit="contain"
          />
          <Text style={styles.headerTitle}>TOP LEADERBOARD</Text>
          <View style={styles.livePulseDot} />
        </View>

        <Pressable
          onPress={handleOpenLeaderboard}
          style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <Text style={styles.seeAllText}>Lihat Semua &gt;</Text>
        </Pressable>
      </View>

      {/* Body: Podium or Empty */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#38BDF8" />
        </View>
      ) : top3.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Belum ada data Top Leaderboard.</Text>
          <Text style={styles.emptySubtitle}>
            Papan peringkat akan segera diperbarui saat pengguna mulai beraktivitas!
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={handleOpenLeaderboard}
          style={styles.podiumRow}
        >
          {podiumOrder.map((entry, idx) =>
            entry ? (
              <HomePodiumItem key={entry.userId} entry={entry} />
            ) : (
              <View key={`empty-${idx}`} style={styles.podiumItemEmpty} />
            )
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "rgba(18, 24, 38, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    gap: 8,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
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
  leaderboardIcon: {
    width: 20,
    height: 20,
  },
  headerTitle: {
    fontFamily: "Nunito-ExtraBold",
    color: "#FFFFFF",
    fontSize: 13,
    letterSpacing: 0.4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  seeAllBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  seeAllText: {
    fontFamily: "Nunito-Bold",
    color: "#38BDF8",
    fontSize: 11,
  },

  // Podium Container
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
    paddingTop: 4,
  },
  podiumItem: {
    flex: 1,
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingBottom: 10,
    gap: 3,
  },
  podiumItemFirst: {
    paddingTop: 4,
    minHeight: 165,
    justifyContent: "flex-end",
    zIndex: 2,
    elevation: 3,
  },
  podiumItemOther: {
    paddingTop: 10,
    minHeight: 150,
    justifyContent: "flex-end",
  },
  podiumItemEmpty: {
    flex: 1,
  },

  // Crown
  crownWrapper: {
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  crownText: {
    fontSize: 15,
  },
  crownTextFirst: {
    fontSize: 18,
  },

  // Avatar + Rank Badge
  avatarContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  nearAvatarBadge: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#0B0E14",
    elevation: 4,
    zIndex: 10,
  },
  nearAvatarText: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#0B0E14",
  },

  // Name & VIP
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
    maxWidth: "92%",
  },
  userName: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F1F5F9",
    textAlign: "center",
  },

  // Tier Badge
  tierPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderWidth: 1,
  },
  tierIcon: {
    width: 12,
    height: 12,
  },
  tierText: {
    fontSize: 9,
    fontWeight: "800",
  },

  // XP
  xpText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.2,
    marginTop: 1,
  },

  // Loading & Empty
  loadingBox: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: {
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  emptyTitle: {
    fontFamily: "Nunito-Bold",
    color: "#CBD5E1",
    fontSize: 12,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    color: "#64748B",
    fontSize: 11,
    textAlign: "center",
  },
});
