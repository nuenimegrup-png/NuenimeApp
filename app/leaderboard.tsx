import React, { useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { AppIcon } from "@/components/app-icon";
import { BorderAvatar } from "@/components/border-avatar";
import { getTierForLevel } from "@/components/level-progress-modal";
import { getEquippedBorderId, getEquippedBorderStorageKey } from "@/lib/avatar-borders";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import { hapticLight } from "@/lib/haptics";
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

// ── Podium Top-3 Card ────────────────────────────────────────────────────────
interface PodiumCardProps {
  entry: LeaderboardEntry;
  localMyBorderId?: string | null;
  currentUserId?: string | null;
  currentUsername?: string | null;
}

function PodiumCard({
  entry,
  localMyBorderId,
  currentUserId,
  currentUsername,
}: PodiumCardProps) {
  const isFirst = entry.rank === 1;
  const clr = rankColor(entry.rank);
  const avatarSize = isFirst ? 68 : 54;
  const { currentTier } = getTierForLevel(entry.level);

  // Periksa apakah ini akun user yang sedang aktif
  const isMe =
    (Boolean(currentUserId) && currentUserId === entry.userId) ||
    (Boolean(currentUsername) &&
      currentUsername?.toLowerCase() === entry.username?.toLowerCase());

  // Prioritas border: dari DB -> jika ini user sendiri, gunakan border lokal jika di DB belum ada
  const activeBorder = entry.equippedBorder || (isMe ? localMyBorderId : null);

  return (
    <View
      style={[
        styles.podiumCard,
        isFirst ? styles.podiumCardFirst : styles.podiumCardOther,
        {
          borderColor: isFirst
            ? "rgba(245, 158, 11, 0.4)"
            : entry.rank === 2
            ? "rgba(203, 213, 225, 0.25)"
            : "rgba(249, 115, 22, 0.25)",
          backgroundColor: isFirst
            ? "rgba(245, 158, 11, 0.05)"
            : "rgba(255, 255, 255, 0.03)",
        },
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

      {/* ── User Name & VIP ── */}
      <View style={styles.podiumNameRow}>
        <Text style={styles.podiumName} numberOfLines={1}>
          {entry.displayName}
        </Text>
        {entry.isVip && (
          <AppIcon name="check-decagram" size={11} color="#06B6D4" />
        )}
      </View>

      {/* Member # Tag */}
      {entry.memberNumber != null && (
        <Text style={styles.podiumMember}>#{entry.memberNumber}</Text>
      )}

      {/* ── Level Badge dengan Icon Tier Resmi ── */}
      <View
        style={[
          styles.podiumTierBadge,
          {
            borderColor: `${currentTier.color}45`,
            backgroundColor: `${currentTier.color}15`,
          },
        ]}
      >
        <Image
          source={{ uri: currentTier.imageUrl }}
          style={styles.podiumTierIcon}
          contentFit="contain"
          transition={200}
        />
        <Text style={[styles.podiumTierText, { color: currentTier.color }]}>
          Lv.{entry.level.toLocaleString()}
        </Text>
      </View>

      {/* ── XP Counter ── */}
      <View style={styles.podiumXpPill}>
        <Text style={[styles.podiumXp, { color: clr }]}>
          {formatXp(entry.xpGained)}
        </Text>
      </View>
    </View>
  );
}

// ── Row item (#4+) ──────────────────────────────────────────────────────────
interface LeaderRowProps {
  entry: LeaderboardEntry;
  localMyBorderId?: string | null;
  currentUserId?: string | null;
  currentUsername?: string | null;
}

function LeaderRow({
  entry,
  localMyBorderId,
  currentUserId,
  currentUsername,
}: LeaderRowProps) {
  const clr = rankColor(entry.rank);
  const { currentTier } = getTierForLevel(entry.level);

  const isMe =
    (Boolean(currentUserId) && currentUserId === entry.userId) ||
    (Boolean(currentUsername) &&
      currentUsername?.toLowerCase() === entry.username?.toLowerCase());

  const activeBorder = entry.equippedBorder || (isMe ? localMyBorderId : null);

  return (
    <View style={styles.leaderRow}>
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

      {/* Info Name, Member, Level */}
      <View style={styles.rowInfo}>
        <View style={styles.rowNameRow}>
          <Text style={styles.rowName} numberOfLines={1}>
            {entry.displayName}
          </Text>
          {entry.isVip && (
            <AppIcon name="check-decagram" size={13} color="#06B6D4" />
          )}
          {entry.memberNumber != null && (
            <Text style={styles.rowMember}>#{entry.memberNumber}</Text>
          )}
        </View>

        {/* Level Tier Badge with Official Level Icon */}
        <View style={styles.rowBadges}>
          <View
            style={[
              styles.rowTierBadge,
              {
                borderColor: `${currentTier.color}35`,
                backgroundColor: `${currentTier.color}12`,
              },
            ]}
          >
            <Image
              source={{ uri: currentTier.imageUrl }}
              style={styles.rowTierIcon}
              contentFit="contain"
              transition={200}
            />
            <Text style={[styles.rowTierText, { color: currentTier.color }]}>
              {currentTier.name} • Lv.{entry.level.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* XP Counter */}
      <View style={styles.rowXpBox}>
        <Text style={styles.rowXpText}>{formatXp(entry.xpGained)}</Text>
      </View>
    </View>
  );
}

// ── Main Leaderboard Screen ─────────────────────────────────────────────────
const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "daily", label: "Harian" },
  { key: "weekly", label: "Mingguan" },
  { key: "monthly", label: "Bulanan" },
  { key: "alltime", label: "All Time" },
];

export default function LeaderboardScreen() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("alltime");
  const { user, profile } = useAnirakuAuth();
  const [localMyBorderId, setLocalMyBorderId] = useState<string | null>(null);

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

          // AUTO-SYNC: jika user login dan punya border di HP, simpan ke database Supabase
          if (user?.id) {
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
  }, [user?.id]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () => getLeaderboard(period, 50),
    staleTime: 60_000,
    retry: 2,
  });

  const entries = data ?? [];
  const top3 = entries.slice(0, 3);

  // Re-order podium: 2nd (kiri) | 1st (tengah lebih tinggi) | 3rd (kanan)
  const podiumOrder =
    top3.length >= 3
      ? [top3[1], top3[0], top3[2]]
      : top3.length === 2
      ? [top3[1], top3[0], null]
      : top3.length === 1
      ? [null, top3[0], null]
      : [];

  const rest = entries.slice(3);
  const periodLabel = getPeriodLabel(period);

  const handleRefresh = useCallback(async () => {
    // Refresh local border & query
    getEquippedBorderId(user?.id)
      .then((id) => setLocalMyBorderId(id))
      .catch(() => {});
    await refetch();
  }, [refetch, user?.id]);

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
        <Text style={styles.headerTitle}>Leaderboard XP</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period Tabs (Ramping & Proporsional, tidak meregang ke bawah) */}
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

      {/* Period date label */}
      <Text style={styles.periodDateLabel}>{periodLabel}</Text>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color="#38BDF8"
          style={{ marginTop: 60 }}
        />
      ) : entries.length === 0 ? (
        <View style={styles.empty}>
          <AppIcon name="trophy-outline" size={48} color="#334155" />
          <Text style={styles.emptyTitle}>Belum Ada Data</Text>
          <Text style={styles.emptyDesc}>
            Papan peringkat{" "}
            {period === "daily"
              ? "harian"
              : period === "weekly"
              ? "mingguan"
              : period === "monthly"
              ? "bulanan"
              : "all-time"}{" "}
            akan terisi saat pengguna mulai aktif beraktivitas.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(item) => item.userId}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor="#38BDF8"
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
          renderItem={({ item }) => (
            <LeaderRow
              entry={item}
              localMyBorderId={localMyBorderId}
              currentUserId={user?.id}
              currentUsername={profile?.username}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
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
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 16,
    paddingTop: 8,
    backgroundColor: "rgba(18, 24, 38, 0.7)",
    marginHorizontal: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 16,
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
    borderRadius: 20,
    borderWidth: 1.2,
    paddingHorizontal: 6,
    paddingBottom: 12,
    gap: 4,
  },
  podiumCardFirst: {
    paddingTop: 8,
    minHeight: 205,
    justifyContent: "flex-end",
    zIndex: 2,
    elevation: 3,
  },
  podiumCardOther: {
    paddingTop: 14,
    minHeight: 185,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
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
    gap: 3,
    marginTop: 2,
    maxWidth: "95%",
  },
  podiumName: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#F1F5F9",
    textAlign: "center",
  },
  podiumMember: {
    fontSize: 9,
    color: "#64748B",
    fontWeight: "700",
  },

  // Level Tier Badge on Podium
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
    marginTop: 2,
  },
  podiumXp: {
    fontSize: 12.5,
    fontWeight: "900",
    letterSpacing: 0.2,
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
  rowBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
});
