import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { type AdminUserListItem, getAdminUsersList } from "@/lib/admin-service";
import { getTierForLevel, LEVEL_TIERS, type LevelTier } from "@/components/level-progress-modal";

type GamificationTab = "leaderboard" | "quests" | "exp_rules";

interface QuestConfig {
  id: string;
  title: string;
  desc: string;
  type: "daily" | "weekly";
  expReward: number;
  crystalReward: number;
  isActive: boolean;
  icon: string;
}

const DEFAULT_QUESTS: QuestConfig[] = [
  {
    id: "q_watch_3",
    title: "Nonton 3 Episode Anime",
    desc: "Selesaikan 3 episode anime hari ini",
    type: "daily",
    expReward: 60,
    crystalReward: 10,
    isActive: true,
    icon: "play-circle-outline",
  },
  {
    id: "q_comment_3",
    title: "Diskusi & Komentar",
    desc: "Tulis 3 komentar pada episode atau forum anime",
    type: "daily",
    expReward: 30,
    crystalReward: 5,
    isActive: true,
    icon: "comment-text-multiple-outline",
  },
  {
    id: "q_login_daily",
    title: "Presensi Harian",
    desc: "Buka dan login ke aplikasi Nuenime hari ini",
    type: "daily",
    expReward: 25,
    crystalReward: 5,
    isActive: true,
    icon: "calendar-check",
  },
  {
    id: "q_gacha_spin",
    title: "Coba Keberuntungan Gacha",
    desc: "Lakukan summon 1x pada banner gacha apa saja",
    type: "daily",
    expReward: 50,
    crystalReward: 15,
    isActive: true,
    icon: "crystal-ball",
  },
  {
    id: "q_week_marathon",
    title: "Maraton Anime Mingguan",
    desc: "Tonton total 15 episode anime dalam 1 minggu",
    type: "weekly",
    expReward: 250,
    crystalReward: 50,
    isActive: true,
    icon: "fire",
  },
  {
    id: "q_week_share",
    title: "Dukung Kreator & Bagikan",
    desc: "Bagikan tautan anime ke media sosial sebanyak 5 kali",
    type: "weekly",
    expReward: 120,
    crystalReward: 25,
    isActive: true,
    icon: "share-variant",
  },
];

export default function AdminGamificationScreen() {
  const [activeTab, setActiveTab] = useState<GamificationTab>("leaderboard");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>("ALL");

  // EXP Rules State
  const [watchExp, setWatchExp] = useState("20");
  const [commentExp, setCommentExp] = useState("5");
  const [dailyLoginExp, setDailyLoginExp] = useState("25");
  const [weekendBoostActive, setWeekendBoostActive] = useState(true);
  const [weekendBoostMultiplier, setWeekendBoostMultiplier] = useState("1.5");
  const [savingRules, setSavingRules] = useState(false);

  // Quests State
  const [quests, setQuests] = useState<QuestConfig[]>(DEFAULT_QUESTS);
  const [editingQuest, setEditingQuest] = useState<QuestConfig | null>(null);

  // Bonus EXP Modal
  const [selectedUserForExp, setSelectedUserForExp] = useState<AdminUserListItem | null>(null);
  const [bonusExpAmount, setBonusExpAmount] = useState("100");
  const [bonusExpReason, setBonusExpReason] = useState("");
  const [givingBonus, setGivingBonus] = useState(false);

  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await getAdminUsersList();
      const sorted = [...list].sort((a, b) => b.level - a.level || b.exp - a.exp);
      setUsers(sorted.slice(0, 50));
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // ─── FILTERED LEADERBOARD ───
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const tier = getTierForLevel(u.level).currentTier;
      if (selectedTierFilter !== "ALL" && tier.name.toLowerCase() !== selectedTierFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchUser = u.username.toLowerCase().includes(q);
        const matchName = (u.displayName || "").toLowerCase().includes(q);
        if (!matchUser && !matchName) return false;
      }
      return true;
    });
  }, [users, selectedTierFilter, searchQuery]);

  // Top 3 Podium
  const top1 = users[0] || null;
  const top2 = users[1] || null;
  const top3 = users[2] || null;

  // Save EXP Rules
  const handleSaveExpRules = () => {
    hapticLight();
    setSavingRules(true);
    setTimeout(() => {
      setSavingRules(false);
      hapticSuccess();
      Alert.alert("Tersimpan!", "Aturan perolehan EXP & Multiplier berhasil diperbarui.");
    }, 400);
  };

  // Toggle Quest Active
  const handleToggleQuestActive = (questId: string) => {
    hapticLight();
    setQuests((prev) =>
      prev.map((q) => (q.id === questId ? { ...q, isActive: !q.isActive } : q))
    );
  };

  // Save Edited Quest
  const handleSaveEditedQuest = () => {
    if (!editingQuest) return;
    hapticLight();
    setQuests((prev) =>
      prev.map((q) => (q.id === editingQuest.id ? editingQuest : q))
    );
    setEditingQuest(null);
    hapticSuccess();
  };

  // Give Bonus EXP
  const handleGiveBonusExp = () => {
    if (!selectedUserForExp) return;
    const amount = parseInt(bonusExpAmount, 10) || 0;
    if (amount <= 0) {
      Alert.alert("Nominal Salah", "Masukkan jumlah bonus EXP positif.");
      return;
    }

    setGivingBonus(true);
    hapticLight();
    setTimeout(() => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUserForExp.id ? { ...u, exp: u.exp + amount } : u
        )
      );
      setGivingBonus(false);
      setSelectedUserForExp(null);
      setBonusExpAmount("100");
      setBonusExpReason("");
      hapticSuccess();
      Alert.alert(
        "Bonus Terkirim",
        `Berhasil memberikan +${amount} EXP kepada ${selectedUserForExp.username}.`
      );
    }, 400);
  };

  return (
    <AdminLayout
      title="Gamification & Leaderboard"
      subtitle="Kelola aturan level, kurva EXP, misi harian/mingguan, dan pantau peringkat Top 50"
      activeKey="gamification"
    >
      {/* ─── TOP KPI STRIP ─── */}
      <View style={[styles.kpiStrip, !isWide && styles.kpiStripMobile]}>
        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
            <AppIcon name="trophy-outline" size={18} color="#F59E0B" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Leaderboard Top 50</Text>
            <Text style={styles.kpiStripVal}>{users.length} Pemain Aktif</Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(140, 87, 255, 0.15)" }]}>
            <AppIcon name="crown" size={18} color="#8C57FF" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Pemain #1 Teratas</Text>
            <Text style={[styles.kpiStripVal, { color: "#8C57FF" }]}>
              {top1 ? `${top1.username} (Lv.${top1.level})` : "—"}
            </Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
            <AppIcon name="fire" size={18} color="#38BDF8" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Misi Aktif</Text>
            <Text style={[styles.kpiStripVal, { color: "#38BDF8" }]}>
              {quests.filter((q) => q.isActive).length} / {quests.length} Quest
            </Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
            <AppIcon name="trending-up" size={18} color="#10B981" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Weekend Boost</Text>
            <Text style={[styles.kpiStripVal, { color: weekendBoostActive ? "#10B981" : "#94A3B8" }]}>
              {weekendBoostActive ? `${weekendBoostMultiplier}x EXP Aktif` : "Normal (1.0x)"}
            </Text>
          </View>
        </View>
      </View>

      {/* ─── TAB NAVIGATION ─── */}
      <View style={styles.tabNavWrap}>
        {[
          { key: "leaderboard", label: "Leaderboard Top 50", icon: "trophy-outline" },
          { key: "quests", label: `Misi & Quests (${quests.length})`, icon: "calendar-check" },
          { key: "exp_rules", label: "Sistem & Kurva EXP", icon: "cog-outline" },
        ].map((t) => (
          <Pressable
            key={t.key}
            onPress={() => {
              hapticLight();
              setActiveTab(t.key as any);
            }}
            style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
          >
            <AppIcon
              name={t.icon}
              size={15}
              color={activeTab === t.key ? "#FFFFFF" : "#94A3B8"}
            />
            <Text style={[styles.tabBtnText, activeTab === t.key && styles.tabBtnTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8C57FF" />
          <Text style={styles.loadingText}>Memuat data gamifikasi...</Text>
        </View>
      ) : (
        <View style={styles.contentWrap}>
          {/* ══════════════════════════════════════════════════════
              TAB 1: LEADERBOARD & RANKING TOP 50
             ══════════════════════════════════════════════════════ */}
          {activeTab === "leaderboard" && (
            <View style={{ gap: 16 }}>
              {/* TOP 3 PODIUM CARDS */}
              {users.length >= 3 && (
                <View style={[styles.podiumRow, !isWide && styles.podiumRowMobile]}>
                  {/* Rank 2 (Silver) */}
                  {top2 && (
                    <View style={[styles.podiumCard, { borderColor: "#94A3B8" }]}>
                      <View style={[styles.podiumMedalWrap, { backgroundColor: "rgba(148, 163, 184, 0.15)" }]}>
                        <Text style={[styles.podiumMedalText, { color: "#CBD5E1" }]}>#2</Text>
                      </View>
                      <Text style={styles.podiumUsername} numberOfLines={1}>{top2.username}</Text>
                      <Text style={styles.podiumLevel}>Lv.{top2.level} · {top2.exp.toLocaleString("id-ID")} XP</Text>
                      <View style={[styles.podiumTierPill, { backgroundColor: "rgba(148, 163, 184, 0.15)" }]}>
                        <Text style={[styles.podiumTierText, { color: "#CBD5E1" }]}>
                          {getTierForLevel(top2.level).currentTier.name.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Rank 1 (Gold / Crown) */}
                  {top1 && (
                    <View style={[styles.podiumCard, styles.podiumCardGold]}>
                      <View style={styles.crownWrap}>
                        <AppIcon name="crown" size={24} color="#F59E0B" />
                      </View>
                      <View style={[styles.podiumMedalWrap, { backgroundColor: "rgba(245, 158, 11, 0.2)" }]}>
                        <Text style={[styles.podiumMedalText, { color: "#F59E0B" }]}>#1</Text>
                      </View>
                      <Text style={[styles.podiumUsername, { color: "#F59E0B" }]} numberOfLines={1}>
                        {top1.username}
                      </Text>
                      <Text style={styles.podiumLevel}>Lv.{top1.level} · {top1.exp.toLocaleString("id-ID")} XP</Text>
                      <View style={[styles.podiumTierPill, { backgroundColor: "rgba(245, 158, 11, 0.2)" }]}>
                        <Text style={[styles.podiumTierText, { color: "#F59E0B" }]}>
                          {getTierForLevel(top1.level).currentTier.name.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Rank 3 (Bronze) */}
                  {top3 && (
                    <View style={[styles.podiumCard, { borderColor: "#D97706" }]}>
                      <View style={[styles.podiumMedalWrap, { backgroundColor: "rgba(217, 119, 6, 0.15)" }]}>
                        <Text style={[styles.podiumMedalText, { color: "#D97706" }]}>#3</Text>
                      </View>
                      <Text style={styles.podiumUsername} numberOfLines={1}>{top3.username}</Text>
                      <Text style={styles.podiumLevel}>Lv.{top3.level} · {top3.exp.toLocaleString("id-ID")} XP</Text>
                      <View style={[styles.podiumTierPill, { backgroundColor: "rgba(217, 119, 6, 0.15)" }]}>
                        <Text style={[styles.podiumTierText, { color: "#D97706" }]}>
                          {getTierForLevel(top3.level).currentTier.name.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Filter & Search Bar */}
              <View style={styles.filterCard}>
                <View style={styles.searchRow}>
                  <View style={styles.searchInputWrap}>
                    <AppIcon name="magnify" size={16} color="#64748B" />
                    <TextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Cari username atau display name..."
                      placeholderTextColor="#64748B"
                      style={styles.searchInput}
                    />
                    {searchQuery.length > 0 && (
                      <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
                        <AppIcon name="close" size={14} color="#94A3B8" />
                      </Pressable>
                    )}
                  </View>

                  {/* Tier Chips */}
                  <View style={styles.tierChipsRow}>
                    {["ALL", "Grandmaster", "Diamond", "Platinum", "Gold", "Silver", "Bronze", "Stone"].map((tier) => {
                      const isSel = selectedTierFilter.toLowerCase() === tier.toLowerCase();
                      return (
                        <Pressable
                          key={tier}
                          onPress={() => {
                            hapticLight();
                            setSelectedTierFilter(tier);
                          }}
                          style={[
                            styles.tierChip,
                            isSel && styles.tierChipActive,
                          ]}
                        >
                          <Text style={[styles.tierChipText, isSel && styles.tierChipTextActive]}>
                            {tier}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Leaderboard Table */}
              <View style={styles.cardBox}>
                <View style={styles.tableHeaderRow}>
                  <Text style={styles.cardBoxTitle}>Peringkat Level & EXP Pemain ({filteredUsers.length})</Text>
                </View>

                {filteredUsers.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <AppIcon name="trophy-outline" size={36} color="#334155" />
                    <Text style={styles.emptyTitle}>Tidak ada pemain yang cocok</Text>
                  </View>
                ) : (
                  <View style={styles.tableWrap}>
                    <View style={styles.thRow}>
                      <Text style={[styles.th, { flex: 1 }]}>RANK</Text>
                      <Text style={[styles.th, { flex: 2.6 }]}>PENGGUNA</Text>
                      <Text style={[styles.th, { flex: 1.4 }]}>LEVEL</Text>
                      <Text style={[styles.th, { flex: 1.6 }]}>EXP</Text>
                      <Text style={[styles.th, { flex: 1.8 }]}>TIER</Text>
                      <Text style={[styles.th, { flex: 1.6, textAlign: "right" }]}>AKSI</Text>
                    </View>

                    {filteredUsers.map((u, index) => {
                      const tier = getTierForLevel(u.level).currentTier;
                      return (
                        <View key={u.id} style={styles.trRow}>
                          <Text
                            style={[
                              styles.rankNumber,
                              index === 0 && { color: "#F59E0B" },
                              index === 1 && { color: "#94A3B8" },
                              index === 2 && { color: "#D97706" },
                              { flex: 1 },
                            ]}
                          >
                            #{index + 1}
                          </Text>
                          <View style={{ flex: 2.6 }}>
                            <Text style={styles.tdBold} numberOfLines={1}>{u.username}</Text>
                            <Text style={styles.tdSub} numberOfLines={1}>{u.displayName || "Pengguna Nuenime"}</Text>
                          </View>
                          <Text style={[styles.tdBold, { flex: 1.4, color: "#38BDF8" }]}>
                            Lv.{u.level}
                          </Text>
                          <Text style={[styles.td, { flex: 1.6 }]}>{u.exp.toLocaleString("id-ID")} XP</Text>
                          <View style={{ flex: 1.8 }}>
                            <View
                              style={[
                                styles.tierBadge,
                                {
                                  backgroundColor: `${tier.color}15`,
                                  borderColor: `${tier.color}35`,
                                },
                              ]}
                            >
                              <Text style={[styles.tierBadgeText, { color: tier.color }]}>
                                {tier.name.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                          <View style={{ flex: 1.6, alignItems: "flex-end" }}>
                            <Pressable
                              onPress={() => {
                                hapticLight();
                                setSelectedUserForExp(u);
                              }}
                              style={styles.bonusExpBtn}
                            >
                              <AppIcon name="plus" size={11} color="#8C57FF" />
                              <Text style={styles.bonusExpBtnText}>+EXP</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 2: MISI HARIAN & MINGGUAN (QUESTS)
             ══════════════════════════════════════════════════════ */}
          {activeTab === "quests" && (
            <View style={{ gap: 14 }}>
              <View style={styles.cardBox}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={styles.cardBoxTitle}>Daftar Misi Harian & Mingguan</Text>
                    <Text style={styles.cardBoxSubtitle}>
                      Pemain mendapatkan EXP dan Dylan Crystal saat menyelesaikan misi ini di aplikasi
                    </Text>
                  </View>
                </View>

                <View style={styles.questGrid}>
                  {quests.map((q) => (
                    <View
                      key={q.id}
                      style={[
                        styles.questCard,
                        q.isActive && { borderColor: "rgba(140, 87, 255, 0.3)" },
                      ]}
                    >
                      <View style={styles.questCardTop}>
                        <View style={styles.questIconWrap}>
                          <AppIcon name={q.icon} size={20} color="#8C57FF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.questTitle}>{q.title}</Text>
                          <Text style={styles.questDesc}>{q.desc}</Text>
                        </View>
                        <View
                          style={[
                            styles.questTypePill,
                            { backgroundColor: q.type === "daily" ? "rgba(56, 189, 248, 0.15)" : "rgba(236, 72, 153, 0.15)" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.questTypeText,
                              { color: q.type === "daily" ? "#38BDF8" : "#EC4899" },
                            ]}
                          >
                            {q.type.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Reward Row */}
                      <View style={styles.questRewardRow}>
                        <View style={styles.rewardChip}>
                          <AppIcon name="trending-up" size={12} color="#10B981" />
                          <Text style={[styles.rewardChipText, { color: "#10B981" }]}>+{q.expReward} EXP</Text>
                        </View>
                        <View style={styles.rewardChip}>
                          <AppIcon name="crystal-ball" size={12} color="#8C57FF" />
                          <Text style={[styles.rewardChipText, { color: "#8C57FF" }]}>+{q.crystalReward} Crystal</Text>
                        </View>

                        <View style={{ flex: 1 }} />

                        {/* Switch Active */}
                        <Pressable
                          onPress={() => handleToggleQuestActive(q.id)}
                          style={[
                            styles.questStatusBtn,
                            q.isActive ? styles.questStatusOn : styles.questStatusOff,
                          ]}
                        >
                          <Text
                            style={[
                              styles.questStatusText,
                              { color: q.isActive ? "#10B981" : "#64748B" },
                            ]}
                          >
                            {q.isActive ? "Aktif" : "Nonaktif"}
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => setEditingQuest({ ...q })}
                          style={styles.questEditBtn}
                        >
                          <AppIcon name="pencil" size={13} color="#38BDF8" />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 3: SISTEM & KURVA EXP
             ══════════════════════════════════════════════════════ */}
          {activeTab === "exp_rules" && (
            <View style={{ gap: 14 }}>
              <View style={styles.cardBox}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <AppIcon name="cog-outline" size={18} color="#38BDF8" />
                  <Text style={styles.cardBoxTitle}>Aturan Perolehan EXP Pengguna</Text>
                </View>
                <Text style={styles.cardBoxSubtitle}>
                  Tentukan jumlah perolehan EXP dasar saat pemain beraktivitas di aplikasi Nuenime.
                </Text>

                <View style={styles.expRulesGrid}>
                  <View style={styles.ruleInputBox}>
                    <Text style={styles.ruleLabel}>Nonton 1 Episode Selesai:</Text>
                    <View style={styles.expPillInput}>
                      <TextInput
                        value={watchExp}
                        onChangeText={setWatchExp}
                        keyboardType="numeric"
                        style={styles.ruleInput}
                      />
                      <Text style={styles.expUnitText}>+EXP</Text>
                    </View>
                  </View>

                  <View style={styles.ruleInputBox}>
                    <Text style={styles.ruleLabel}>Mengirim 1 Komentar / Ulasan:</Text>
                    <View style={styles.expPillInput}>
                      <TextInput
                        value={commentExp}
                        onChangeText={setCommentExp}
                        keyboardType="numeric"
                        style={styles.ruleInput}
                      />
                      <Text style={styles.expUnitText}>+EXP</Text>
                    </View>
                  </View>

                  <View style={styles.ruleInputBox}>
                    <Text style={styles.ruleLabel}>Presensi Login Harian:</Text>
                    <View style={styles.expPillInput}>
                      <TextInput
                        value={dailyLoginExp}
                        onChangeText={setDailyLoginExp}
                        keyboardType="numeric"
                        style={styles.ruleInput}
                      />
                      <Text style={styles.expUnitText}>+EXP</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.formDivider} />

                {/* Weekend Booster Toggle */}
                <View style={styles.boosterRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <AppIcon name="fire" size={16} color="#F59E0B" />
                      <Text style={styles.boosterTitle}>Weekend Event EXP Booster</Text>
                    </View>
                    <Text style={styles.boosterSub}>
                      Lipatgandakan seluruh perolehan EXP pemain di hari Sabtu & Minggu secara otomatis.
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={styles.multiplierBox}>
                      <TextInput
                        value={weekendBoostMultiplier}
                        onChangeText={setWeekendBoostMultiplier}
                        keyboardType="numeric"
                        style={styles.multiplierInput}
                      />
                      <Text style={styles.multiplierText}>x</Text>
                    </View>
                    <Switch
                      value={weekendBoostActive}
                      onValueChange={setWeekendBoostActive}
                      trackColor={{ false: "rgba(255,255,255,0.1)", true: "rgba(16,185,129,0.5)" }}
                      thumbColor={weekendBoostActive ? "#10B981" : "#64748B"}
                    />
                  </View>
                </View>

                {/* Tier Threshold Reference */}
                <View style={styles.tierRefBox}>
                  <Text style={styles.tierRefTitle}>Daftar Tier Rank Level Nuenime:</Text>
                  <View style={styles.tierRefGrid}>
                    {LEVEL_TIERS.map((tier) => (
                      <View key={tier.name} style={[styles.tierRefCard, { borderColor: `${tier.color}35` }]}>
                        <View style={[styles.tierRefDot, { backgroundColor: tier.color }]} />
                        <Text style={[styles.tierRefName, { color: tier.color }]}>{tier.name}</Text>
                        <Text style={styles.tierRefRange}>{tier.rangeLabel}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <Pressable
                  disabled={savingRules}
                  onPress={handleSaveExpRules}
                  style={[styles.saveRulesBtn, savingRules && { opacity: 0.6 }]}
                >
                  <AppIcon name="content-save-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.saveRulesBtnText}>
                    {savingRules ? "Menyimpan Aturan..." : "Simpan Aturan & Multiplier EXP"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ─── MODAL BONUS EXP KE PEMAIN ─── */}
      <Modal visible={selectedUserForExp !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Beri Bonus EXP Pengguna</Text>
            <Text style={styles.modalSub}>
              Pemain: <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{selectedUserForExp?.username}</Text> (Saat ini: Lv.{selectedUserForExp?.level})
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Jumlah Bonus EXP:</Text>
              <TextInput
                value={bonusExpAmount}
                onChangeText={setBonusExpAmount}
                keyboardType="numeric"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Alasan / Keterangan (Opsional):</Text>
              <TextInput
                value={bonusExpReason}
                onChangeText={setBonusExpReason}
                placeholder="Contoh: Juara Event Fanart Bulanan"
                placeholderTextColor="#64748B"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setSelectedUserForExp(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                disabled={givingBonus}
                onPress={handleGiveBonusExp}
                style={[styles.modalSaveBtn, givingBonus && { opacity: 0.6 }]}
              >
                <Text style={styles.modalSaveText}>
                  {givingBonus ? "Mengirim..." : "Kirim Bonus EXP"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL EDIT QUEST ─── */}
      <Modal visible={editingQuest !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Konfigurasi Quest</Text>

            {editingQuest && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Judul Misi:</Text>
                  <TextInput
                    value={editingQuest.title}
                    onChangeText={(t) => setEditingQuest({ ...editingQuest, title: t })}
                    style={styles.fieldInput}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Deskripsi:</Text>
                  <TextInput
                    value={editingQuest.desc}
                    onChangeText={(t) => setEditingQuest({ ...editingQuest, desc: t })}
                    style={styles.fieldInput}
                  />
                </View>

                <View style={styles.rowTwoCols}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Reward EXP:</Text>
                    <TextInput
                      value={String(editingQuest.expReward)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setEditingQuest({ ...editingQuest, expReward: parseInt(t, 10) || 0 })
                      }
                      style={styles.fieldInput}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Reward Crystal:</Text>
                    <TextInput
                      value={String(editingQuest.crystalReward)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setEditingQuest({ ...editingQuest, crystalReward: parseInt(t, 10) || 0 })
                      }
                      style={styles.fieldInput}
                    />
                  </View>
                </View>
              </>
            )}

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setEditingQuest(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveEditedQuest}
                style={styles.modalSaveBtn}
              >
                <Text style={styles.modalSaveText}>Simpan Quest</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AdminLayout>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── KPI Top Strip
  kpiStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    padding: 16,
    gap: 16,
    marginBottom: 14,
  },
  kpiStripMobile: {
    flexWrap: "wrap",
    gap: 12,
  },
  kpiStripItem: {
    flex: 1,
    minWidth: 140,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  kpiStripIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
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
    fontSize: 14.5,
    color: "#FFFFFF",
    marginTop: 2,
  },
  kpiStripDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },

  // ── Tabs
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
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  tabBtnActive: {
    backgroundColor: "#8C57FF",
    borderColor: "#8C57FF",
  },
  tabBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },
  contentWrap: {
    gap: 16,
  },

  // ── Podium Cards
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
  },
  podiumRowMobile: {
    flexWrap: "wrap",
  },
  podiumCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
    position: "relative",
  },
  podiumCardGold: {
    borderColor: "#F59E0B",
    backgroundColor: "rgba(245, 158, 11, 0.05)",
    transform: [{ scale: 1.03 }],
  },
  crownWrap: {
    position: "absolute",
    top: -16,
  },
  podiumMedalWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  podiumMedalText: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
  },
  podiumUsername: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  podiumLevel: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  podiumTierPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 2,
  },
  podiumTierText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
  },

  // ── Filter Card
  filterCard: {
    backgroundColor: "#0D1117",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 10,
  },
  searchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    minWidth: 260,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  tierChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tierChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  tierChipActive: {
    backgroundColor: "rgba(140, 87, 255, 0.2)",
    borderColor: "#8C57FF",
  },
  tierChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  tierChipTextActive: {
    color: "#FFFFFF",
  },

  // ── Card Box
  cardBox: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 14,
  },
  tableHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardBoxTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  cardBoxSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
  },

  // ── Table
  tableWrap: {
    gap: 2,
  },
  thRow: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 6,
  },
  th: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#64748B",
  },
  trRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  rankNumber: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#94A3B8",
  },
  tdBold: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  tdSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },
  td: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#CBD5E1",
  },
  tierBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  tierBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
  },
  bonusExpBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: "rgba(140, 87, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.3)",
  },
  bonusExpBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#8C57FF",
  },

  // ── Quests
  questGrid: {
    gap: 10,
  },
  questCard: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 10,
  },
  questCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  questIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(140, 87, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  questTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  questDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  questTypePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  questTypeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
  },
  questRewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.04)",
  },
  rewardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  rewardChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
  },
  questStatusBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  questStatusOn: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  questStatusOff: {
    backgroundColor: "rgba(100, 116, 139, 0.1)",
    borderColor: "rgba(100, 116, 139, 0.3)",
  },
  questStatusText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
  },
  questEditBtn: {
    padding: 5,
    borderRadius: 5,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
  },

  // ── EXP Rules
  expRulesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  ruleInputBox: {
    flex: 1,
    minWidth: 180,
    gap: 6,
  },
  ruleLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  expPillInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ruleInput: {
    flex: 1,
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#38BDF8",
  },
  expUnitText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
  },
  formDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginVertical: 4,
  },
  boosterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(245, 158, 11, 0.05)",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    gap: 10,
  },
  boosterTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  boosterSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  multiplierBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  multiplierInput: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#F59E0B",
    width: 32,
    textAlign: "center",
  },
  multiplierText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },

  // ── Tier Ref
  tierRefBox: {
    gap: 8,
    marginTop: 4,
  },
  tierRefTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  tierRefGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tierRefCard: {
    flex: 1,
    minWidth: 90,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    gap: 2,
  },
  tierRefDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tierRefName: {
    fontFamily: "Nunito-Black",
    fontSize: 10.5,
  },
  tierRefRange: {
    fontFamily: "Nunito-Regular",
    fontSize: 9.5,
    color: "#64748B",
  },
  saveRulesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#8C57FF",
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 6,
  },
  saveRulesBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },

  // ── Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  modalSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  formGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  fieldInput: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  rowTwoCols: {
    flexDirection: "row",
    gap: 10,
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  modalCancelText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  modalSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#8C57FF",
  },
  modalSaveText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  // ── Empties & Loading
  loadingWrap: {
    padding: 40,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#94A3B8",
  },
  emptyWrap: {
    padding: 30,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#64748B",
  },
});
