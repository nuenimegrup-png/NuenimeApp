import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { type AdminUser, type AdminUserListItem, getAdminUsersList, logAdminAction } from "@/lib/admin-service";
import { getTierForLevel, LEVEL_TIERS, type LevelTier } from "@/components/level-progress-modal";
import { getLevelProgressInfo } from "@/lib/user-level";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";
import AsyncStorage from "@react-native-async-storage/async-storage";

type GamificationTab = "leaderboard" | "quests" | "exp_rules" | "simulator";

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

const STORAGE_QUESTS_KEY = "nuenime.admin.quests_config";
const STORAGE_EXP_RULES_KEY = "nuenime.admin.exp_rules";

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
    title: "Presensi Login Harian",
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
  const auth = useAnirakuAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const [activeTab, setActiveTab] = useState<GamificationTab>("leaderboard");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>("ALL");

  // ─── EXP RULES STATE ───
  const [watchExp, setWatchExp] = useState("20");
  const [commentExp, setCommentExp] = useState("5");
  const [dailyLoginExp, setDailyLoginExp] = useState("10");
  const [weekendBoostActive, setWeekendBoostActive] = useState(true);
  const [weekendBoostMultiplier, setWeekendBoostMultiplier] = useState("1.5");
  const [savingRules, setSavingRules] = useState(false);

  // ─── QUESTS STATE ───
  const [quests, setQuests] = useState<QuestConfig[]>(DEFAULT_QUESTS);
  const [editingQuest, setEditingQuest] = useState<QuestConfig | null>(null);
  const [isCreatingNewQuest, setIsCreatingNewQuest] = useState(false);

  // ─── NEW QUEST FORM STATE ───
  const [newQuestTitle, setNewQuestTitle] = useState("");
  const [newQuestDesc, setNewQuestDesc] = useState("");
  const [newQuestType, setNewQuestType] = useState<"daily" | "weekly">("daily");
  const [newQuestExp, setNewQuestExp] = useState("50");
  const [newQuestCrystal, setNewQuestCrystal] = useState("10");
  const [newQuestIcon, setNewQuestIcon] = useState("star-outline");

  // ─── EXP ADJUSTMENT MODAL STATE (TAMBAH, KURANGI, SET EXP) ───
  const [selectedUserForExp, setSelectedUserForExp] = useState<AdminUserListItem | null>(null);
  const [expAdjustMode, setExpAdjustMode] = useState<"add" | "deduct" | "set">("add");
  const [bonusExpAmount, setBonusExpAmount] = useState("100");
  const [bonusExpReason, setBonusExpReason] = useState("");
  const [givingBonus, setGivingBonus] = useState(false);

  // ─── SIMULATOR STATE (FITUR MENARIK BARU) ───
  const [simStartLevel, setSimStartLevel] = useState("1");
  const [simTargetLevel, setSimTargetLevel] = useState("20");

  // ─── FLOATING ACTION TOAST (SESUAI GACHA THEME) ───
  const [actionToast, setActionToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setActionToast({ message, type });
    setTimeout(() => setActionToast(null), 4000);
  }, []);

  const adminActor: AdminUser = useMemo(() => {
    return {
      id: auth.user?.id || "admin-master",
      email: auth.user?.email || "admin@nuenime.com",
      username: auth.profile?.display_name || auth.profile?.username || "Super Admin",
      role: "super_admin",
    };
  }, [auth.user, auth.profile]);

  // ─── LOAD DATA (USERS, EXP RULES & QUESTS) ───
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Ambil Leaderboard Pengguna
      const list = await getAdminUsersList();
      const sorted = [...list].sort((a, b) => b.level - a.level || b.exp - a.exp);
      setUsers(sorted.slice(0, 50));

      // 2. Ambil Aturan EXP dari system_configs
      const { data: expConfigData } = await supabase
        .from("system_configs")
        .select("value")
        .eq("key", "exp_rules")
        .maybeSingle();

      if (expConfigData?.value && typeof expConfigData.value === "object") {
        const val = expConfigData.value as any;
        if (typeof val.watch_episode === "number") setWatchExp(String(val.watch_episode));
        if (typeof val.comment === "number") setCommentExp(String(val.comment));
        if (typeof val.daily_login === "number") setDailyLoginExp(String(val.daily_login));
        if (typeof val.weekend_boost_active === "boolean") setWeekendBoostActive(val.weekend_boost_active);
        if (typeof val.weekend_multiplier === "number") setWeekendBoostMultiplier(String(val.weekend_multiplier));
      }

      // 3. Ambil Quests dari system_configs
      const { data: questsData } = await supabase
        .from("system_configs")
        .select("value")
        .eq("key", "quests_config")
        .maybeSingle();

      if (questsData?.value && Array.isArray(questsData.value) && questsData.value.length > 0) {
        setQuests(questsData.value);
      } else {
        const local = await AsyncStorage.getItem(STORAGE_QUESTS_KEY);
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) setQuests(parsed);
        }
      }
    } catch (err: any) {
      showToast(err?.message || "Gagal memuat data gamifikasi.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  // ─── ACTION: SIMPAN EXP RULES KE SUPABASE & ASYNCSTORAGE ───
  const handleSaveExpRules = async () => {
    hapticLight();
    setSavingRules(true);
    try {
      const payload = {
        watch_episode: parseInt(watchExp, 10) || 20,
        comment: parseInt(commentExp, 10) || 5,
        daily_login: parseInt(dailyLoginExp, 10) || 10,
        weekend_boost_active: weekendBoostActive,
        weekend_multiplier: parseFloat(weekendBoostMultiplier) || 1.5,
      };

      await supabase
        .from("system_configs")
        .upsert(
          {
            key: "exp_rules",
            value: payload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

      await AsyncStorage.setItem(STORAGE_EXP_RULES_KEY, JSON.stringify(payload)).catch(() => {});

      await logAdminAction({
        admin: adminActor,
        action: "UPDATE_EXP_RULES",
        targetType: "system",
        targetId: "exp_rules",
        details: payload,
      });

      hapticSuccess();
      showToast("Aturan perolehan EXP & Weekend Booster berhasil disinkronkan ke server!", "success");
    } catch (err: any) {
      hapticWarning();
      showToast(err?.message || "Gagal menyimpan aturan EXP.", "error");
    } finally {
      setSavingRules(false);
    }
  };

  // ─── ACTION: SAVE QUESTS KE SUPABASE & ASYNCSTORAGE ───
  const saveQuestsToDb = async (updatedQuests: QuestConfig[]) => {
    try {
      await supabase
        .from("system_configs")
        .upsert(
          {
            key: "quests_config",
            value: updatedQuests,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

      await AsyncStorage.setItem(STORAGE_QUESTS_KEY, JSON.stringify(updatedQuests)).catch(() => {});
      setQuests(updatedQuests);
      showToast("Misi quest berhasil diperbarui dan tersinkron ke cloud!", "success");
    } catch (err: any) {
      showToast(err?.message || "Gagal menyimpan misi quest.", "error");
    }
  };

  // Toggle Quest Active
  const handleToggleQuestActive = async (questId: string) => {
    hapticLight();
    const updated = quests.map((q) => (q.id === questId ? { ...q, isActive: !q.isActive } : q));
    await saveQuestsToDb(updated);
  };

  // Save Edited Quest
  const handleSaveEditedQuest = async () => {
    if (!editingQuest) return;
    hapticLight();
    const updated = quests.map((q) => (q.id === editingQuest.id ? editingQuest : q));
    setEditingQuest(null);
    hapticSuccess();
    await saveQuestsToDb(updated);
  };

  // Create New Quest
  const handleCreateNewQuest = async () => {
    if (!newQuestTitle.trim() || !newQuestDesc.trim()) {
      showToast("Judul dan deskripsi misi wajib diisi.", "error");
      return;
    }

    hapticLight();
    const newQ: QuestConfig = {
      id: `q_${Date.now()}`,
      title: newQuestTitle.trim(),
      desc: newQuestDesc.trim(),
      type: newQuestType,
      expReward: parseInt(newQuestExp, 10) || 50,
      crystalReward: parseInt(newQuestCrystal, 10) || 10,
      isActive: true,
      icon: newQuestIcon.trim() || "star-outline",
    };

    const updated = [...quests, newQ];
    setIsCreatingNewQuest(false);
    setNewQuestTitle("");
    setNewQuestDesc("");
    hapticSuccess();
    await saveQuestsToDb(updated);

    await logAdminAction({
      admin: adminActor,
      action: "CREATE_QUEST",
      targetType: "quest",
      targetId: newQ.id,
      details: newQ,
    });
  };

  // Delete Quest
  const handleDeleteQuest = (questId: string) => {
    hapticWarning();
    Alert.alert("Hapus Misi", "Apakah Anda yakin ingin menghapus misi ini dari daftar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          const updated = quests.filter((q) => q.id !== questId);
          hapticSuccess();
          await saveQuestsToDb(updated);
        },
      },
    ]);
  };

  // ─── ACTION: ADJUST USER EXP (TAMBAH, KURANGI / TURUNKAN, SET NILAI) ───
  const handleAdjustUserExp = async () => {
    if (!selectedUserForExp) return;
    const amount = parseInt(bonusExpAmount.replace(/\D/g, ""), 10);
    if (isNaN(amount) || (expAdjustMode !== "set" && amount <= 0)) {
      showToast("Masukkan jumlah EXP yang valid.", "error");
      return;
    }

    const currentExp = selectedUserForExp.exp || 0;
    let newTotalXp = currentExp;

    if (expAdjustMode === "add") {
      newTotalXp = currentExp + amount;
    } else if (expAdjustMode === "deduct") {
      newTotalXp = Math.max(0, currentExp - amount);
    } else if (expAdjustMode === "set") {
      newTotalXp = Math.max(0, amount);
    }

    let progressInfo = getLevelProgressInfo(newTotalXp);
    const expDiff = newTotalXp - currentExp;

    setGivingBonus(true);
    hapticLight();
    try {
      // Coba panggil Stored Procedure atomic SQL jika sudah dieksekusi di Supabase
      let rpcSuccess = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("admin_adjust_user_exp", {
          p_user_id: selectedUserForExp.id,
          p_mode: expAdjustMode,
          p_amount: amount,
          p_reason: bonusExpReason.trim(),
          p_admin_id: adminActor.id && adminActor.id !== "admin-master" ? adminActor.id : null,
        });

        if (!rpcErr && Array.isArray(rpcRes) && rpcRes.length > 0 && rpcRes[0].success) {
          rpcSuccess = true;
          newTotalXp = Number(rpcRes[0].new_exp);
          progressInfo = getLevelProgressInfo(newTotalXp);
        }
      } catch (rpcCatch) {
        rpcSuccess = false;
      }

      // Jika RPC belum ada di database Supabase, gunakan update tabel langsung sebagai fallback
      if (!rpcSuccess) {
        // 1. Simpan perubahan langsung ke database profiles
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({
            exp: newTotalXp,
            level: progressInfo.level,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedUserForExp.id);

        if (profileErr) throw profileErr;

        // 2. Simpan record transaksi ke user_xp_transactions jika tabel ada
        try {
          await supabase.from("user_xp_transactions").insert({
            user_id: selectedUserForExp.id,
            activity_type:
              expAdjustMode === "add"
                ? "admin_bonus"
                : expAdjustMode === "deduct"
                ? "admin_penalty"
                : "admin_manual_override",
            target_id: `admin_adj_${Date.now()}`,
            base_xp: expDiff,
            bonus_xp: 0,
            total_xp: expDiff,
            multiplier: 1.0,
            description:
              bonusExpReason.trim() ||
              (expAdjustMode === "add"
                ? "Bonus EXP dari Administrator"
                : expAdjustMode === "deduct"
                ? "Pengurangan EXP oleh Administrator"
                : "Koreksi EXP Manual oleh Administrator"),
            metadata: {
              admin_id: adminActor.id,
              previous_exp: currentExp,
              new_exp: newTotalXp,
              previous_level: selectedUserForExp.level,
              new_level: progressInfo.level,
              mode: expAdjustMode,
            },
          });
        } catch (txErr) {
          console.warn("[gamification] user_xp_transactions log warning:", txErr);
        }
      }

      // 3. Catat ke admin audit logs
      await logAdminAction({
        admin: adminActor,
        action:
          expAdjustMode === "add"
            ? "GIVE_BONUS_EXP"
            : expAdjustMode === "deduct"
            ? "DEDUCT_EXP"
            : "SET_USER_EXP",
        targetType: "user",
        targetId: selectedUserForExp.id,
        details: {
          username: selectedUserForExp.username,
          mode: expAdjustMode,
          inputAmount: amount,
          diff: expDiff,
          previousExp: currentExp,
          newExp: newTotalXp,
          previousLevel: selectedUserForExp.level,
          newLevel: progressInfo.level,
          reason: bonusExpReason.trim() || "Penyesuaian EXP Administrator",
        },
      });

      // 4. Kirim notifikasi sistem resmi ke pengguna
      try {
        await supabase.from("notifications").insert({
          user_id: selectedUserForExp.id,
          title:
            expAdjustMode === "add"
              ? "Bonus EXP Diterima! 🎉"
              : "Pembaruan EXP Akun ⚙️",
          message:
            expAdjustMode === "add"
              ? `Selamat! Anda menerima bonus +${amount.toLocaleString("id-ID")} EXP dari administrator Nuenime.`
              : `Status EXP Anda telah disesuaikan oleh administrator (Kini Lv.${progressInfo.level} · ${newTotalXp.toLocaleString("id-ID")} XP). Alasan: ${bonusExpReason.trim() || "-"}`,
          type: "gamification_update",
          read: false,
        });
      } catch {}

      // 5. Update state lokal dan urutkan kembali leaderboard
      setUsers((prev) => {
        const updated = prev.map((u) =>
          u.id === selectedUserForExp.id
            ? { ...u, exp: newTotalXp, level: progressInfo.level }
            : u
        );
        return [...updated].sort((a, b) => b.level - a.level || b.exp - a.exp);
      });

      setSelectedUserForExp(null);
      setBonusExpAmount("100");
      setBonusExpReason("");
      setExpAdjustMode("add");
      hapticSuccess();

      const labelDiff = expDiff >= 0 ? `+${expDiff.toLocaleString("id-ID")}` : `${expDiff.toLocaleString("id-ID")}`;
      showToast(
        `Berhasil menyesuaikan EXP @${selectedUserForExp.username} (${labelDiff} XP, Kini Lv.${progressInfo.level})!`,
        "success"
      );
    } catch (err: any) {
      hapticWarning();
      showToast(err?.message || "Gagal menyesuaikan EXP pemain.", "error");
    } finally {
      setGivingBonus(false);
    }
  };

  // ─── SIMULATOR CALCULATION (FITUR MENARIK BARU) ───
  const simCalculation = useMemo(() => {
    const s = Math.max(1, parseInt(simStartLevel, 10) || 1);
    const t = Math.max(s + 1, parseInt(simTargetLevel, 10) || 2);

    let totalExpNeeded = 0;
    for (let l = s; l < t; l++) {
      totalExpNeeded += 50 + (l - 1) * 15;
    }

    const watchEpisodes = Math.ceil(totalExpNeeded / (parseInt(watchExp, 10) || 20));
    const commentsCount = Math.ceil(totalExpNeeded / (parseInt(commentExp, 10) || 5));
    const dailyLogins = Math.ceil(totalExpNeeded / (parseInt(dailyLoginExp, 10) || 10));
    const targetTier = getTierForLevel(t).currentTier;

    return {
      startLevel: s,
      targetLevel: t,
      totalExpNeeded,
      watchEpisodes,
      commentsCount,
      dailyLogins,
      targetTier,
    };
  }, [simStartLevel, simTargetLevel, watchExp, commentExp, dailyLoginExp]);

  return (
    <AdminLayout
      title="Gamification & Leaderboard"
      subtitle="Kelola aturan level, kurva EXP, misi harian/mingguan, simulator progresi, dan pantau peringkat Top 50"
      activeKey="gamification"
    >
      {/* ─── TOP KPI STRIP (PERSIS ADMIN GACHA THEME) ─── */}
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
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(255, 255, 255, 0.08)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.18)" }]}>
            <AppIcon name="crown" size={18} color="#CBD5E1" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Pemain #1 Teratas</Text>
            <Text style={[styles.kpiStripVal, { color: "#FFFFFF" }]}>
              {top1 ? `@${top1.username} (Lv.${top1.level})` : "—"}
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
            <Text style={styles.kpiStripLabel}>Weekend Booster</Text>
            <Text style={[styles.kpiStripVal, { color: weekendBoostActive ? "#10B981" : "#94A3B8" }]}>
              {weekendBoostActive ? `${weekendBoostMultiplier}x EXP Aktif` : "Normal (1.0x)"}
            </Text>
          </View>
        </View>
      </View>

      {/* ─── INFO BANNER (PERSIS GACHA THEME) ─── */}
      <View style={styles.infoBanner}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 }}>
          <View style={styles.infoIconWrap}>
            <AppIcon name="information-outline" size={15} color="#38BDF8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Sistem Progresi Gamifikasi & Aturan Level Nuenime</Text>
            <Text style={styles.infoBannerText}>
              Setiap aktivitas menonton episode, memberi like, menulis komentar, dan login harian otomatis memicu perolehan EXP.
              Level pemain dihitung secara matematis menggunakan rumus kurva PostgreSQL calculate_user_level.
              Pemberian bonus EXP melalui tombol (+EXP) langsung tersimpan ke Supabase secara real-time.
            </Text>
          </View>
        </View>
      </View>

      {/* ─── TAB NAVIGATION (CHIP STYLE SILVER LIQUID GLASS) ─── */}
      <View style={styles.tabNavWrap}>
        {[
          { key: "leaderboard", label: `Leaderboard Top 50 (${users.length})`, icon: "trophy-outline" },
          { key: "quests", label: `Misi & Quests (${quests.length})`, icon: "calendar-check" },
          { key: "exp_rules", label: "Sistem & Kurva EXP", icon: "cog-outline" },
          { key: "simulator", label: "Simulator & Kalkulator Progresi", icon: "calculator-variant-outline" },
        ].map((t) => (
          <Pressable
            key={t.key}
            onPress={() => {
              hapticLight();
              setActiveTab(t.key as GamificationTab);
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

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Memuat data gamifikasi dan peringkat dari database...</Text>
        </View>
      ) : (
        <View style={styles.contentWrap}>
          {/* ══════════════════════════════════════════════════════
              TAB 1: LEADERBOARD & RANKING TOP 50
             ══════════════════════════════════════════════════════ */}
          {activeTab === "leaderboard" && (
            <View style={{ gap: 16 }}>
              {/* TOP 3 PODIUM CARDS (SILVER / GOLD / BRONZE LIQUID GLASS) */}
              {users.length >= 3 && (
                <View style={[styles.podiumRow, !isWide && styles.podiumRowMobile]}>
                  {/* Rank 2 (Silver) */}
                  {top2 && (
                    <View style={[styles.podiumCard, styles.podiumCardSilver]}>
                      <View style={[styles.podiumMedalWrap, { backgroundColor: "rgba(255, 255, 255, 0.10)" }]}>
                        <Text style={[styles.podiumMedalText, { color: "#CBD5E1" }]}>#2</Text>
                      </View>
                      <Text style={styles.podiumUsername} numberOfLines={1}>{top2.username}</Text>
                      <Text style={styles.podiumLevel}>Lv.{top2.level} · {top2.exp.toLocaleString("id-ID")} XP</Text>
                      <View style={[styles.podiumTierPill, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
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
                    <View style={[styles.podiumCard, styles.podiumCardBronze]}>
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
                      placeholder="Cari username atau display name pemain..."
                      placeholderTextColor="#64748B"
                      style={styles.searchInput}
                    />
                    {searchQuery.length > 0 && (
                      <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
                        <AppIcon name="close-circle" size={14} color="#64748B" />
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

              {/* Leaderboard Table (Dark Obsidian Card) */}
              <View style={styles.contentCard}>
                <View style={styles.tableHeaderRow}>
                  <Text style={styles.cardTitle}>Peringkat Level & EXP Pemain ({filteredUsers.length})</Text>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      loadData();
                    }}
                    style={styles.silverLiquidSecondaryBtn}
                  >
                    <AppIcon name="refresh" size={13} color="#CBD5E1" />
                    <Text style={styles.silverLiquidSecondaryBtnText}>Muat Ulang</Text>
                  </Pressable>
                </View>

                {filteredUsers.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppIcon name="trophy-outline" size={36} color="#64748B" />
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
                              index === 1 && { color: "#CBD5E1" },
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
                          <View style={{ flex: 1.8, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                            <Pressable
                              onPress={() => {
                                hapticLight();
                                setExpAdjustMode("add");
                                setBonusExpAmount("100");
                                setSelectedUserForExp(u);
                              }}
                              style={styles.silverBonusExpBtnAdd}
                              accessibilityLabel={`Tambah EXP untuk @${u.username}`}
                            >
                              <AppIcon name="plus" size={12} color="#34D399" />
                              <Text style={styles.silverBonusExpBtnTextAdd}>+EXP</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                hapticLight();
                                setExpAdjustMode("deduct");
                                setBonusExpAmount("100");
                                setSelectedUserForExp(u);
                              }}
                              style={styles.silverBonusExpBtnDeduct}
                              accessibilityLabel={`Kurangi EXP untuk @${u.username}`}
                            >
                              <AppIcon name="minus" size={12} color="#F87171" />
                              <Text style={styles.silverBonusExpBtnTextDeduct}>−EXP</Text>
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
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                    <AppIcon name="calendar-check" size={18} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Daftar Misi Harian & Mingguan</Text>
                    <Text style={styles.cardSubtitle}>
                      Pemain mendapatkan EXP dan Crystal saat menyelesaikan misi ini di aplikasi Nuenime.
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setIsCreatingNewQuest(true);
                    }}
                    style={styles.primaryActionBtnSilverMini}
                  >
                    <AppIcon name="plus" size={14} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnSilverMiniText}>+ Tambah Misi Baru</Text>
                  </Pressable>
                </View>

                <View style={styles.questGrid}>
                  {quests.map((q) => (
                    <View
                      key={q.id}
                      style={[
                        styles.questCard,
                        { width: isWide ? "48.9%" : "100%" },
                        q.isActive && styles.questCardActive,
                      ]}
                    >
                      <View style={styles.questCardTop}>
                        <View style={styles.questIconWrap}>
                          <AppIcon name={q.icon as any} size={20} color="#38BDF8" />
                        </View>
                        <View style={{ flex: 1, minWidth: 120 }}>
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

                      {/* Reward & Actions Row */}
                      <View style={styles.questRewardRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <View style={styles.rewardChip}>
                            <AppIcon name="trending-up" size={12} color="#10B981" />
                            <Text style={[styles.rewardChipText, { color: "#10B981" }]}>+{q.expReward} EXP</Text>
                          </View>
                          <View style={styles.rewardChip}>
                            <AppIcon name="crystal-ball" size={12} color="#38BDF8" />
                            <Text style={[styles.rewardChipText, { color: "#38BDF8" }]}>+{q.crystalReward} Crystal</Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {/* Switch Active */}
                          <Pressable
                            onPress={() => handleToggleQuestActive(q.id)}
                            style={[
                              styles.questStatusBtn,
                              q.isActive ? styles.questStatusOn : styles.questStatusOff,
                            ]}
                            accessibilityLabel={q.isActive ? "Nonaktifkan misi" : "Aktifkan misi"}
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
                            hitSlop={8}
                            accessibilityLabel="Edit misi"
                          >
                            <AppIcon name="pencil" size={13} color="#CBD5E1" />
                          </Pressable>

                          <Pressable
                            onPress={() => handleDeleteQuest(q.id)}
                            style={styles.questDeleteBtn}
                            hitSlop={8}
                            accessibilityLabel="Hapus misi"
                          >
                            <AppIcon name="trash-can-outline" size={13} color="#F43F5E" />
                          </Pressable>
                        </View>
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
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                    <AppIcon name="cog-outline" size={18} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Aturan Perolehan EXP Dasar Pemain</Text>
                    <Text style={styles.cardSubtitle}>
                      Tentukan jumlah perolehan EXP dasar saat pemain beraktivitas di aplikasi Nuenime.
                    </Text>
                  </View>
                </View>

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
                      trackColor={{ false: "rgba(255, 255, 255, 0.08)", true: "rgba(16, 185, 129, 0.4)" }}
                      thumbColor={weekendBoostActive ? "#10B981" : "#64748B"}
                    />
                  </View>
                </View>

                {/* Tier Threshold Reference */}
                <View style={styles.tierRefBox}>
                  <Text style={styles.tierRefTitle}>Daftar Tingkatan (Tier Rank) Nuenime:</Text>
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

                {/* SAVE BUTTON (SILVER LIQUID GLASS) */}
                <Pressable
                  disabled={savingRules}
                  onPress={handleSaveExpRules}
                  style={[styles.primaryActionBtnSilver, savingRules && { opacity: 0.6 }]}
                >
                  {savingRules ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <AppIcon name="check-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryActionBtnSilverText}>Simpan Aturan & Multiplier EXP</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 4: SIMULATOR & KALKULATOR PROGRESI (FITUR MENARIK BARU)
             ══════════════════════════════════════════════════════ */}
          {activeTab === "simulator" && (
            <View style={{ gap: 16 }}>
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
                    <AppIcon name="calculator-variant-outline" size={18} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Simulator & Kalkulator Kurva EXP Level</Text>
                    <Text style={styles.cardSubtitle}>
                      Hitung secara akurat berapa total EXP yang diperlukan pemain untuk naik dari level awal ke target, serta simulasi jumlah episode yang harus ditonton.
                    </Text>
                  </View>
                </View>

                <View style={[styles.rowTwoCols, !isWide && { flexDirection: "column" }]}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Level Awal Pemain:</Text>
                    <TextInput
                      value={simStartLevel}
                      onChangeText={setSimStartLevel}
                      keyboardType="numeric"
                      style={styles.fieldInput}
                      placeholder="1"
                      placeholderTextColor="#64748B"
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Target Level yang Dituju:</Text>
                    <TextInput
                      value={simTargetLevel}
                      onChangeText={setSimTargetLevel}
                      keyboardType="numeric"
                      style={styles.fieldInput}
                      placeholder="20"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                </View>

                {/* Hasil Perhitungan Simulator (Liquid Glass Banner) */}
                <View style={styles.simResultBox}>
                  <View style={styles.simResultRow}>
                    <View style={styles.simResultItem}>
                      <Text style={styles.simResultLabel}>TOTAL EXP DIBUTUHKAN</Text>
                      <Text style={styles.simResultValHighlight}>
                        {simCalculation.totalExpNeeded.toLocaleString("id-ID")} XP
                      </Text>
                      <Text style={styles.simResultSub}>
                        Progresi dari Lv.{simCalculation.startLevel} ➡️ Lv.{simCalculation.targetLevel}
                      </Text>
                    </View>

                    <View style={styles.simResultDivider} />

                    <View style={styles.simResultItem}>
                      <Text style={styles.simResultLabel}>TIER CAPAIAN</Text>
                      <Text style={[styles.simResultValHighlight, { color: simCalculation.targetTier.color }]}>
                        {simCalculation.targetTier.name.toUpperCase()}
                      </Text>
                      <Text style={styles.simResultSub}>{simCalculation.targetTier.rangeLabel}</Text>
                    </View>
                  </View>

                  <View style={styles.formDivider} />

                  <Text style={styles.simEstimateTitle}>Estimasi Aktivitas Pemain untuk Mencapai Target:</Text>
                  <View style={styles.simEstimateGrid}>
                    <View style={styles.simEstimateCard}>
                      <AppIcon name="play-circle-outline" size={20} color="#38BDF8" />
                      <Text style={styles.simEstimateVal}>{simCalculation.watchEpisodes} Episode</Text>
                      <Text style={styles.simEstimateLabel}>Nonton Selesai (@{watchExp} XP)</Text>
                    </View>

                    <View style={styles.simEstimateCard}>
                      <AppIcon name="comment-text-outline" size={20} color="#CBD5E1" />
                      <Text style={styles.simEstimateVal}>{simCalculation.commentsCount} Komentar</Text>
                      <Text style={styles.simEstimateLabel}>Diskusi Anime (@{commentExp} XP)</Text>
                    </View>

                    <View style={styles.simEstimateCard}>
                      <AppIcon name="calendar-check" size={20} color="#F59E0B" />
                      <Text style={styles.simEstimateVal}>{simCalculation.dailyLogins} Hari</Text>
                      <Text style={styles.simEstimateLabel}>Presensi Login (@{dailyLoginExp} XP)</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ─── MODAL 1: ATUR & KOREKSI EXP PEMAIN (TAMBAH, KURANGI, SET NILAI) ─── */}
      <Modal visible={selectedUserForExp !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View
                style={[
                  styles.modalIconBox,
                  {
                    backgroundColor:
                      expAdjustMode === "deduct"
                        ? "rgba(239, 68, 68, 0.12)"
                        : expAdjustMode === "set"
                        ? "rgba(16, 185, 129, 0.12)"
                        : "rgba(56, 189, 248, 0.12)",
                  },
                ]}
              >
                <AppIcon
                  name={
                    expAdjustMode === "deduct"
                      ? "minus-circle-outline"
                      : expAdjustMode === "set"
                      ? "tune"
                      : "plus-circle-outline"
                  }
                  size={18}
                  color={
                    expAdjustMode === "deduct"
                      ? "#EF4444"
                      : expAdjustMode === "set"
                      ? "#10B981"
                      : "#38BDF8"
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Atur & Koreksi EXP Pemain</Text>
                <Text style={styles.modalSub}>
                  Akun:{" "}
                  <Text style={{ color: "#FFFFFF", fontFamily: "Nunito-Black" }}>
                    @{selectedUserForExp?.username}
                  </Text>{" "}
                  ({selectedUserForExp?.displayName || "Pengguna"})
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setSelectedUserForExp(null);
                  setExpAdjustMode("add");
                }}
                hitSlop={8}
              >
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            {/* Mode Switcher Tabs */}
            <View style={styles.expModeTabsRow}>
              <Pressable
                onPress={() => {
                  hapticLight();
                  setExpAdjustMode("add");
                }}
                style={[
                  styles.expModeTabBtn,
                  expAdjustMode === "add" && styles.expModeTabBtnAddActive,
                ]}
              >
                <AppIcon
                  name="plus"
                  size={13}
                  color={expAdjustMode === "add" ? "#34D399" : "#94A3B8"}
                />
                <Text
                  style={[
                    styles.expModeTabText,
                    expAdjustMode === "add" && { color: "#34D399", fontFamily: "Nunito-Black" },
                  ]}
                >
                  Tambah (+)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  hapticLight();
                  setExpAdjustMode("deduct");
                }}
                style={[
                  styles.expModeTabBtn,
                  expAdjustMode === "deduct" && styles.expModeTabBtnDeductActive,
                ]}
              >
                <AppIcon
                  name="minus"
                  size={13}
                  color={expAdjustMode === "deduct" ? "#F87171" : "#94A3B8"}
                />
                <Text
                  style={[
                    styles.expModeTabText,
                    expAdjustMode === "deduct" && { color: "#F87171", fontFamily: "Nunito-Black" },
                  ]}
                >
                  Kurangi (−)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  hapticLight();
                  setExpAdjustMode("set");
                }}
                style={[
                  styles.expModeTabBtn,
                  expAdjustMode === "set" && styles.expModeTabBtnSetActive,
                ]}
              >
                <AppIcon
                  name="equal"
                  size={13}
                  color={expAdjustMode === "set" ? "#38BDF8" : "#94A3B8"}
                />
                <Text
                  style={[
                    styles.expModeTabText,
                    expAdjustMode === "set" && { color: "#38BDF8", fontFamily: "Nunito-Black" },
                  ]}
                >
                  Set Nilai (=)
                </Text>
              </Pressable>
            </View>

            {/* Live Calculation Preview Card */}
            {selectedUserForExp &&
              (() => {
                const curExp = selectedUserForExp.exp || 0;
                const amt = parseInt(bonusExpAmount.replace(/\D/g, ""), 10) || 0;
                let targetExp = curExp;
                if (expAdjustMode === "add") targetExp = curExp + amt;
                else if (expAdjustMode === "deduct") targetExp = Math.max(0, curExp - amt);
                else if (expAdjustMode === "set") targetExp = Math.max(0, amt);

                const curInfo = getLevelProgressInfo(curExp);
                const targetInfo = getLevelProgressInfo(targetExp);
                const curTier = getTierForLevel(curInfo.level).currentTier;
                const targetTier = getTierForLevel(targetInfo.level).currentTier;

                return (
                  <View style={styles.expPreviewCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.expPreviewSub}>Saat Ini</Text>
                      <Text style={styles.expPreviewValue}>
                        Lv.{curInfo.level} · {curExp.toLocaleString("id-ID")} XP
                      </Text>
                      <Text style={[styles.expPreviewTier, { color: curTier.color }]}>
                        {curTier.name.toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.expPreviewArrowWrap}>
                      <AppIcon
                        name="arrow-right-bold"
                        size={16}
                        color={expAdjustMode === "deduct" ? "#F87171" : "#38BDF8"}
                      />
                    </View>

                    <View style={{ flex: 1, alignItems: "flex-end" }}>
                      <Text style={styles.expPreviewSub}>Setelah Penyesuaian</Text>
                      <Text
                        style={[
                          styles.expPreviewValue,
                          {
                            color:
                              expAdjustMode === "deduct"
                                ? "#F87171"
                                : expAdjustMode === "set"
                                ? "#38BDF8"
                                : "#34D399",
                          },
                        ]}
                      >
                        Lv.{targetInfo.level} · {targetExp.toLocaleString("id-ID")} XP
                      </Text>
                      <Text style={[styles.expPreviewTier, { color: targetTier.color }]}>
                        {targetTier.name.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                );
              })()}

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>
                {expAdjustMode === "add"
                  ? "Jumlah EXP yang Ditambahkan:"
                  : expAdjustMode === "deduct"
                  ? "Jumlah EXP yang Dikurangkan:"
                  : "Tetapkan Total EXP Akun Menjadi:"}
              </Text>
              <TextInput
                value={bonusExpAmount}
                onChangeText={setBonusExpAmount}
                keyboardType="numeric"
                style={styles.fieldInput}
                placeholder="100"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Alasan / Keterangan (Wajib untuk Audit Log):</Text>
              <TextInput
                value={bonusExpReason}
                onChangeText={setBonusExpReason}
                placeholder={
                  expAdjustMode === "add"
                    ? "Contoh: Juara Event Fanart, Kompensasi Bug..."
                    : expAdjustMode === "deduct"
                    ? "Contoh: Penalti pelanggaran TOS / Rollback exploit..."
                    : "Contoh: Penyesuaian sinkronisasi data manual..."
                }
                placeholderTextColor="#64748B"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => {
                  setSelectedUserForExp(null);
                  setExpAdjustMode("add");
                }}
                style={styles.modalCancelBtn}
                disabled={givingBonus}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>

              <Pressable
                onPress={handleAdjustUserExp}
                style={[
                  styles.primaryActionBtnSilver,
                  expAdjustMode === "deduct" && {
                    backgroundColor: "rgba(239, 68, 68, 0.16)",
                    borderColor: "rgba(239, 68, 68, 0.4)",
                  },
                  givingBonus && { opacity: 0.6 },
                ]}
                disabled={givingBonus}
              >
                {givingBonus ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon
                      name={
                        expAdjustMode === "deduct"
                          ? "alert-circle-outline"
                          : "check-circle"
                      }
                      size={15}
                      color="#FFFFFF"
                    />
                    <Text style={styles.primaryActionBtnSilverText}>
                      {expAdjustMode === "add"
                        ? "Kirim Tambahan EXP"
                        : expAdjustMode === "deduct"
                        ? "Konfirmasi Kurangi EXP"
                        : "Simpan Nilai EXP Baru"}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 2: TAMBAH MISI BARU (CREATE QUEST MODAL) ─── */}
      <Modal visible={isCreatingNewQuest} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={[styles.modalIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                <AppIcon name="calendar-plus" size={18} color="#38BDF8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Buat Misi Baru</Text>
                <Text style={styles.modalSub}>Tambahkan misi harian atau mingguan untuk seluruh pemain Nuenime.</Text>
              </View>
              <Pressable onPress={() => setIsCreatingNewQuest(false)} hitSlop={8}>
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Judul Misi:</Text>
              <TextInput
                value={newQuestTitle}
                onChangeText={setNewQuestTitle}
                placeholder="Contoh: Tonton 5 Episode Anime Populer"
                placeholderTextColor="#64748B"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Deskripsi Petunjuk:</Text>
              <TextInput
                value={newQuestDesc}
                onChangeText={setNewQuestDesc}
                placeholder="Contoh: Tonton anime kategori apa saja hingga selesai"
                placeholderTextColor="#64748B"
                style={styles.fieldInput}
              />
            </View>

            <View style={[styles.rowTwoCols, !isWide && { flexDirection: "column" }]}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Tipe Misi:</Text>
                <View style={styles.typeSelectorRow}>
                  {(["daily", "weekly"] as const).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setNewQuestType(t)}
                      style={[styles.typeChip, newQuestType === t && styles.typeChipActive]}
                    >
                      <Text style={[styles.typeChipText, newQuestType === t && styles.typeChipTextActive]}>
                        {t === "daily" ? "Harian" : "Mingguan"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Nama Icon (MCI):</Text>
                <TextInput
                  value={newQuestIcon}
                  onChangeText={setNewQuestIcon}
                  placeholder="play-circle, fire, star..."
                  placeholderTextColor="#64748B"
                  style={styles.fieldInput}
                />
              </View>
            </View>

            <View style={[styles.rowTwoCols, !isWide && { flexDirection: "column" }]}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Reward EXP:</Text>
                <TextInput
                  value={newQuestExp}
                  onChangeText={setNewQuestExp}
                  keyboardType="numeric"
                  style={styles.fieldInput}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Reward Crystal:</Text>
                <TextInput
                  value={newQuestCrystal}
                  onChangeText={setNewQuestCrystal}
                  keyboardType="numeric"
                  style={styles.fieldInput}
                />
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setIsCreatingNewQuest(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>

              <Pressable
                onPress={handleCreateNewQuest}
                style={styles.primaryActionBtnSilver}
              >
                <AppIcon name="check-circle" size={15} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnSilverText}>Simpan Misi</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 3: EDIT QUEST MODAL ─── */}
      <Modal visible={editingQuest !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={[styles.modalIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                <AppIcon name="pencil" size={18} color="#38BDF8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Edit Misi Quest</Text>
                <Text style={styles.modalSub}>Sesuaikan judul, deskripsi, dan reward hadiah misi.</Text>
              </View>
              <Pressable onPress={() => setEditingQuest(null)} hitSlop={8}>
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            {editingQuest && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Judul Misi:</Text>
                  <TextInput
                    value={editingQuest.title}
                    onChangeText={(val) => setEditingQuest({ ...editingQuest, title: val })}
                    style={styles.fieldInput}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Deskripsi Petunjuk:</Text>
                  <TextInput
                    value={editingQuest.desc}
                    onChangeText={(val) => setEditingQuest({ ...editingQuest, desc: val })}
                    style={styles.fieldInput}
                  />
                </View>

                <View style={[styles.rowTwoCols, !isWide && { flexDirection: "column" }]}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Reward EXP:</Text>
                    <TextInput
                      value={String(editingQuest.expReward)}
                      onChangeText={(val) =>
                        setEditingQuest({
                          ...editingQuest,
                          expReward: parseInt(val, 10) || 0,
                        })
                      }
                      keyboardType="numeric"
                      style={styles.fieldInput}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Reward Crystal:</Text>
                    <TextInput
                      value={String(editingQuest.crystalReward)}
                      onChangeText={(val) =>
                        setEditingQuest({
                          ...editingQuest,
                          crystalReward: parseInt(val, 10) || 0,
                        })
                      }
                      keyboardType="numeric"
                      style={styles.fieldInput}
                    />
                  </View>
                </View>

                <View style={styles.modalActionRow}>
                  <Pressable
                    onPress={() => setEditingQuest(null)}
                    style={styles.modalCancelBtn}
                  >
                    <Text style={styles.modalCancelText}>Batal</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSaveEditedQuest}
                    style={styles.primaryActionBtnSilver}
                  >
                    <AppIcon name="check-circle" size={15} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnSilverText}>Simpan Perubahan</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  // ── Top KPI Strip (Persis Admin Gacha Theme)
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

  // ── Info Banner (Persis Admin Gacha Theme)
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

  // ── Top 3 Podium (Silver / Gold / Bronze Liquid Glass)
  podiumRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-end",
  },
  podiumRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  podiumCard: {
    flex: 1,
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 6,
    position: "relative",
  },
  podiumCardGold: {
    borderColor: "rgba(245, 158, 11, 0.4)",
    backgroundColor: "rgba(245, 158, 11, 0.03)",
    paddingTop: 24,
  },
  podiumCardSilver: {
    borderColor: "rgba(255, 255, 255, 0.25)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  podiumCardBronze: {
    borderColor: "rgba(217, 119, 6, 0.35)",
    backgroundColor: "rgba(217, 119, 6, 0.03)",
  },
  crownWrap: {
    position: "absolute",
    top: -12,
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
    fontSize: 13,
  },
  podiumUsername: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
    textAlign: "center",
  },
  podiumLevel: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  podiumTierPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  podiumTierText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
  },

  // ── Filter Card & Search Row
  filterCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 12,
  },
  searchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  searchInputWrap: {
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
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
    padding: 0,
  },
  tierChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tierChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  tierChipActive: {
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  tierChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  tierChipTextActive: {
    color: "#38BDF8",
  },

  // ── Leaderboard Table
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tableWrap: {
    gap: 6,
  },
  thRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  th: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#64748B",
    letterSpacing: 0.5,
  },
  trRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  rankNumber: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#CBD5E1",
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
    color: "#94A3B8",
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  tierBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
  },
  silverBonusExpBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  silverBonusExpBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  silverBonusExpBtnAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(16, 185, 129, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.30)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  silverBonusExpBtnTextAdd: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#34D399",
  },
  silverBonusExpBtnDeduct: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(239, 68, 68, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.30)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  silverBonusExpBtnTextDeduct: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#F87171",
  },

  // EXP Adjustment Modal Mode Tabs & Preview
  expModeTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  expModeTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  expModeTabBtnAddActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  expModeTabBtnDeductActive: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  expModeTabBtnSetActive: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  expModeTabText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  expPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    marginBottom: 8,
  },
  expPreviewSub: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  expPreviewValue: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
    marginTop: 2,
  },
  expPreviewTier: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    marginTop: 1,
  },
  expPreviewArrowWrap: {
    paddingHorizontal: 8,
  },

  // ── Quests Grid
  questGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  questCard: {
    minWidth: 280,
    backgroundColor: "rgba(255, 255, 255, 0.025)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 12,
  },
  questCardActive: {
    borderColor: "rgba(56, 189, 248, 0.28)",
    backgroundColor: "rgba(56, 189, 248, 0.03)",
  },
  questCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  questIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  questTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  questDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
    lineHeight: 15,
  },
  questTypePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  questTypeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
  },
  questRewardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  rewardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
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
    backgroundColor: "rgba(16, 185, 129, 0.10)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  questStatusOff: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  questStatusText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
  },
  questEditBtn: {
    padding: 6,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  questDeleteBtn: {
    padding: 6,
    borderRadius: 5,
    backgroundColor: "rgba(244, 63, 94, 0.08)",
  },

  // ── EXP Rules Tab
  expRulesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  ruleInputBox: {
    flex: 1,
    minWidth: 200,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
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
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  ruleInput: {
    flex: 1,
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#38BDF8",
    paddingVertical: 6,
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
    backgroundColor: "rgba(245, 158, 11, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  boosterTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#F59E0B",
  },
  boosterSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 15,
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
  tierRefBox: {
    gap: 8,
  },
  tierRefTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
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

  // ── Simulator Tab (Fitur Menarik Baru)
  simResultBox: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  simResultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  simResultItem: {
    flex: 1,
    gap: 4,
  },
  simResultLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#64748B",
    letterSpacing: 0.5,
  },
  simResultValHighlight: {
    fontFamily: "Nunito-Black",
    fontSize: 20,
    color: "#38BDF8",
  },
  simResultSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  simResultDivider: {
    width: 1,
    height: 48,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  simEstimateTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },
  simEstimateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  simEstimateCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 4,
    alignItems: "center",
  },
  simEstimateVal: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  simEstimateLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
    textAlign: "center",
  },

  // ── SILVER LIQUID GLASS BUTTONS (PERSIS GACHA & REQUEST USER)
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
  primaryActionBtnSilverMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  primaryActionBtnSilverMiniText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },
  silverLiquidSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  silverLiquidSecondaryBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#CBD5E1",
  },

  // ── Form Groups & Modals
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
  typeSelectorRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  typeChipActive: {
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  typeChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  typeChipTextActive: {
    color: "#38BDF8",
    fontFamily: "Nunito-Black",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  modalIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
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
    lineHeight: 16,
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
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  modalCancelText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
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
    fontSize: 13.5,
    color: "#64748B",
  },
});
