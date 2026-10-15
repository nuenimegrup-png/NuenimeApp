import { memo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { AppIcon } from "@/components/app-icon";
import { getLevelProgressInfo } from "@/lib/user-level";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";

export type LevelTier = {
  id: number;
  name: string;
  minLevel: number;
  maxLevel: number;
  rangeLabel: string;
  color: string;
  imageUrl: string;
};

export const LEVEL_TIERS: readonly LevelTier[] = [
  {
    id: 1,
    name: "Stone",
    minLevel: 0,
    maxLevel: 1,
    rangeLabel: "Level 1",
    color: "#94A3B8",
    imageUrl: "https://i.ibb.co.com/jvMvJ5qn/1.png",
  },
  {
    id: 2,
    name: "Bronze",
    minLevel: 2,
    maxLevel: 4,
    rangeLabel: "Level 2 - 4",
    color: "#D97706",
    imageUrl: "https://i.ibb.co.com/vxjGKNQB/2.png",
  },
  {
    id: 3,
    name: "Silver",
    minLevel: 5,
    maxLevel: 9,
    rangeLabel: "Level 5 - 9",
    color: "#CBD5E1",
    imageUrl: "https://i.ibb.co.com/C5bsnJ50/3.png",
  },
  {
    id: 4,
    name: "Gold",
    minLevel: 10,
    maxLevel: 19,
    rangeLabel: "Level 10 - 19",
    color: "#FBBF24",
    imageUrl: "https://i.ibb.co.com/39LhRyPW/4.png",
  },
  {
    id: 5,
    name: "Emerald",
    minLevel: 20,
    maxLevel: 34,
    rangeLabel: "Level 20 - 34",
    color: "#34D399",
    imageUrl: "https://i.ibb.co.com/chpNM56V/5.png",
  },
  {
    id: 6,
    name: "Sapphire",
    minLevel: 35,
    maxLevel: 49,
    rangeLabel: "Level 35 - 49",
    color: "#38BDF8",
    imageUrl: "https://i.ibb.co.com/VWY9GPKh/6.png",
  },
  {
    id: 7,
    name: "Amethyst",
    minLevel: 50,
    maxLevel: 74,
    rangeLabel: "Level 50 - 74",
    color: "#C084FC",
    imageUrl: "https://i.ibb.co.com/bM2Mvdbg/7.png",
  },
  {
    id: 8,
    name: "Ruby Star",
    minLevel: 75,
    maxLevel: 99,
    rangeLabel: "Level 75 - 99",
    color: "#FB7185",
    imageUrl: "https://i.ibb.co.com/Ndtxp5Cj/8.png",
  },
  {
    id: 9,
    name: "Celestial",
    minLevel: 100,
    maxLevel: 149,
    rangeLabel: "Level 100 - 149",
    color: "#FB923C",
    imageUrl: "https://i.ibb.co.com/W8Nx0bR/9.png",
  },
  {
    id: 10,
    name: "Eternal",
    minLevel: 150,
    maxLevel: Infinity,
    rangeLabel: "Level 150+",
    color: "#F8FAFC",
    imageUrl: "https://i.ibb.co.com/sdyN9q4j/10.png",
  },
];

export function getTierForLevel(level: number) {
  const currentTier =
    LEVEL_TIERS.find(
      (t) => level >= t.minLevel && (level <= t.maxLevel || t.maxLevel === Infinity)
    ) || LEVEL_TIERS[0];

  const currentTierIndex = LEVEL_TIERS.findIndex((t) => t.id === currentTier.id);
  const nextTier = LEVEL_TIERS[currentTierIndex + 1] || null;

  let progressPercent = 0;
  let levelsRemaining = 0;

  if (nextTier) {
    const range = nextTier.minLevel - currentTier.minLevel;
    const progress = Math.max(0, level - currentTier.minLevel);
    progressPercent =
      range > 0
        ? Math.min(100, Math.max(0, Math.floor((progress / range) * 100)))
        : 100;
    levelsRemaining = Math.max(0, nextTier.minLevel - level);
  } else {
    progressPercent = 100;
    levelsRemaining = 0;
  }

  return {
    currentTier,
    nextTier,
    progressPercent,
    levelsRemaining,
  };
}

export type LevelProgressModalProps = {
  visible: boolean;
  onClose: () => void;
  userLevel: number;
  totalXP: number;
  totalMinutesWatched?: number;
};

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  const time = new Date(dateStr).getTime();
  if (!Number.isFinite(time)) return "";
  const diffMs = Date.now() - time;
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes}m lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j lalu`;
  const days = Math.floor(hours / 24);
  return `${days}h lalu`;
}

export const LevelProgressModal = memo(function LevelProgressModal({
  visible,
  onClose,
  userLevel,
  totalXP,
  totalMinutesWatched = 0,
}: LevelProgressModalProps) {
  const { user } = useAnirakuAuth();
  const [activeTab, setActiveTab] = useState<"tiers" | "history">("tiers");

  const { currentTier } = getTierForLevel(userLevel);
  const levelInfo = getLevelProgressInfo(totalXP);

  // Format EXP with Indonesian number separator (dots)
  const formattedXP = totalXP.toLocaleString("id-ID");
  const formattedNextXP = levelInfo.nextLevelRequiredXp.toLocaleString("id-ID");

  // Format watch duration as [X]j [Y]m
  const hours = Math.floor(totalMinutesWatched / 60);
  const minutes = totalMinutesWatched % 60;
  const formattedTime = `${hours}j ${minutes}m`;

  // Query audit transaksi EXP user dari database
  const xpHistoryQuery = useQuery({
    queryKey: ["user-xp-history", user?.id],
    enabled: visible && Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_xp_transactions")
        .select("id, activity_type, base_xp, bonus_xp, total_xp, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) {
        console.warn("Gagal memuat riwayat EXP:", error.message);
        return [];
      }
      return data ?? [];
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        // @ts-ignore
        onClick={onClose}
      >
        <Pressable
          style={styles.dialog}
          onPress={(e) => e.stopPropagation()}
          // @ts-ignore
          onClick={(e: any) => e?.stopPropagation?.()}
        >
          {/* Close button at top right */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup"
            onPress={onClose}
            // @ts-ignore
            onClick={onClose}
            style={styles.closeBtn}
            hitSlop={8}
          >
            <AppIcon name="close" size={14} color="#94A3B8" />
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Level Progress</Text>
            <Text style={styles.subtitle}>
              Level {userLevel} · {currentTier.name}
            </Text>
          </View>

          {/* ─── KOTAK PROGRESS LEVEL SAAT INI MENUJU LEVEL BERIKUTNYA ─── */}
          <View style={styles.currentProgressCard}>
            <View style={styles.progressTopRow}>
              <View style={styles.progressTierBadge}>
                <Image
                  source={{ uri: currentTier.imageUrl }}
                  style={styles.miniTierImg}
                  contentFit="contain"
                />
                <Text style={[styles.progressTierName, { color: currentTier.color }]}>
                  Level {userLevel}
                </Text>
              </View>
              <Text style={styles.progressExpRatio}>
                {formattedXP} / {formattedNextXP} EXP
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarTrackOuter}>
              <View
                style={[
                  styles.progressBarFillOuter,
                  {
                    width: `${Math.max(4, Math.min(100, levelInfo.progressPercent))}%`,
                    backgroundColor: currentTier.color || "#38BDF8",
                  },
                ]}
              />
            </View>

            <View style={styles.progressBottomRow}>
              <Text style={styles.progressRemainingLabel}>
                Sisa {levelInfo.xpRemaining.toLocaleString("id-ID")} EXP menuju Level {levelInfo.level + 1}
              </Text>
              <Text style={styles.progressPercentLabel}>{levelInfo.progressPercent}%</Text>
            </View>
          </View>

          {/* ─── TAB SWITCHER: TINGKAT vs RIWAYAT EXP ─── */}
          <View style={styles.tabRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveTab("tiers")}
              style={[
                styles.tabBtn,
                activeTab === "tiers" && styles.tabBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === "tiers" && styles.tabBtnTextActive,
                ]}
              >
                Tingkat Tier
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveTab("history")}
              style={[
                styles.tabBtn,
                activeTab === "history" && styles.tabBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === "history" && styles.tabBtnTextActive,
                ]}
              >
                Riwayat EXP
              </Text>
            </Pressable>
          </View>

          {/* ─── TAB 1: 10 TIERS VERTICAL LIST ─── */}
          {activeTab === "tiers" ? (
            <ScrollView
              style={styles.tierScroll}
              contentContainerStyle={styles.tierListContent}
              showsVerticalScrollIndicator={false}
            >
              {LEVEL_TIERS.map((tier) => {
                const isPassed = userLevel > tier.maxLevel;
                const isActive =
                  userLevel >= tier.minLevel &&
                  (userLevel <= tier.maxLevel || tier.maxLevel === Infinity);

                return (
                  <View
                    key={tier.id}
                    style={[
                      styles.tierRow,
                      isActive && styles.tierRowActive,
                    ]}
                  >
                    {/* Left: Tier Badge Asset */}
                    <View style={styles.tierIconBox}>
                      <Image
                        source={{ uri: tier.imageUrl }}
                        style={styles.tierImage}
                        contentFit="contain"
                        transition={150}
                        cachePolicy="memory-disk"
                      />
                    </View>

                    {/* Center: Info */}
                    <View style={styles.tierCenter}>
                      <Text
                        style={[styles.tierName, { color: tier.color }]}
                        numberOfLines={1}
                      >
                        {tier.name}
                      </Text>
                      <Text style={styles.tierRange}>{tier.rangeLabel}</Text>
                    </View>

                    {/* Right: Status Indicator */}
                    <View style={styles.statusBox}>
                      {isPassed ? (
                        <View style={styles.passedBadge}>
                          <AppIcon name="check" size={11} color="#FFFFFF" />
                        </View>
                      ) : isActive ? (
                        <View style={styles.activeBadge}>
                          <AppIcon name="check" size={11} color="#111622" />
                        </View>
                      ) : (
                        <View style={styles.lockedBadge}>
                          <AppIcon name="timer-sand" size={13} color="#64748B" />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            /* ─── TAB 2: RIWAYAT TRANSAKSI EXP ─── */
            <ScrollView
              style={styles.tierScroll}
              contentContainerStyle={styles.historyListContent}
              showsVerticalScrollIndicator={false}
            >
              {xpHistoryQuery.isPending ? (
                <View style={styles.historyLoadingWrap}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                  <Text style={styles.historyEmptyText}>Memuat riwayat EXP...</Text>
                </View>
              ) : !xpHistoryQuery.data?.length ? (
                <View style={styles.historyEmptyWrap}>
                  <AppIcon name="database-outline" size={28} color="#64748B" />
                  <Text style={styles.historyEmptyTitle}>Belum Ada Riwayat EXP</Text>
                  <Text style={styles.historyEmptyText}>
                    Tonton anime, selesaikan episode, beri rating, atau tinggalkan komentar untuk mendapatkan EXP!
                  </Text>
                </View>
              ) : (
                xpHistoryQuery.data.map((tx) => {
                  const isPositive = (tx.total_xp ?? 0) >= 0;
                  return (
                    <View key={tx.id} style={styles.historyItemRow}>
                      <View
                        style={[
                          styles.historyIconCircle,
                          !isPositive && { backgroundColor: "rgba(239, 68, 68, 0.15)" },
                        ]}
                      >
                        <AppIcon
                          name={
                            tx.activity_type.includes("watch")
                              ? "play-circle-outline"
                              : tx.activity_type.includes("like")
                              ? "heart-outline"
                              : tx.activity_type.includes("comment")
                              ? "comment-outline"
                              : tx.activity_type.includes("rate")
                              ? "star-outline"
                              : "arrow-up"
                          }
                          size={15}
                          color={isPositive ? "#38BDF8" : "#EF4444"}
                        />
                      </View>

                      <View style={styles.historyMetaCol}>
                        <Text style={styles.historyDesc} numberOfLines={1}>
                          {tx.description}
                        </Text>
                        <Text style={styles.historyTime}>
                          {formatRelativeTime(tx.created_at)}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.historyXpBadge,
                          !isPositive && { color: "#EF4444" },
                        ]}
                      >
                        {isPositive ? `+${tx.total_xp}` : tx.total_xp} EXP
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Footer: EXP and Waktu Info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              <Text style={styles.footerBold}>EXP: {formattedXP}</Text>
              {"   |   "}
              <Text style={styles.footerBold}>Waktu: {formattedTime}</Text>
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    ...(Platform.OS === "web"
      ? ({
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
        } as any)
      : {}),
  },
  dialog: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "78%",
    backgroundColor: "#121722",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  header: {
    alignItems: "center",
    marginBottom: 10,
    gap: 2,
  },
  title: {
    fontSize: 16.5,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    letterSpacing: 0.1,
  },
  currentProgressCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  progressTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  miniTierImg: {
    width: 18,
    height: 18,
  },
  progressTierName: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressExpRatio: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E2E8F0",
  },
  progressBarTrackOuter: {
    height: 5,
    backgroundColor: "#1E293B",
    borderRadius: 3,
    marginVertical: 6,
    overflow: "hidden",
  },
  progressBarFillOuter: {
    height: "100%",
    borderRadius: 3,
  },
  progressBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressRemainingLabel: {
    fontSize: 10,
    color: "#94A3B8",
  },
  progressPercentLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#38BDF8",
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 8,
    padding: 2,
    marginBottom: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  tabBtnText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748B",
  },
  tabBtnTextActive: {
    color: "#F8FAFC",
  },
  tierScroll: {
    flexShrink: 1,
    minHeight: 180,
  },
  tierListContent: {
    paddingVertical: 2,
    gap: 9,
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    gap: 10,
  },
  tierRowActive: {
    paddingVertical: 3,
  },
  tierIconBox: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  tierImage: {
    width: 26,
    height: 26,
  },
  tierCenter: {
    flex: 1,
    gap: 1.5,
  },
  tierName: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  tierRange: {
    fontSize: 11,
    color: "#64748B",
  },
  statusBox: {
    width: 20,
    alignItems: "center",
  },
  passedBadge: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  activeBadge: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: "#38BDF8",
    alignItems: "center",
    justifyContent: "center",
  },
  lockedBadge: {
    width: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  historyListContent: {
    paddingVertical: 4,
    gap: 8,
  },
  historyLoadingWrap: {
    paddingVertical: 30,
    alignItems: "center",
    gap: 8,
  },
  historyEmptyWrap: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  historyEmptyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E2E8F0",
  },
  historyEmptyText: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 16,
  },
  historyItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 8,
    gap: 8,
  },
  historyIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  historyMetaCol: {
    flex: 1,
  },
  historyDesc: {
    fontSize: 12,
    fontWeight: "600",
    color: "#F1F5F9",
  },
  historyTime: {
    fontSize: 10,
    color: "#64748B",
  },
  historyXpBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#38BDF8",
  },
  footer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
  },
  footerText: {
    fontSize: 11.5,
    color: "#94A3B8",
  },
  footerBold: {
    fontWeight: "700",
    color: "#E2E8F0",
  },
});
