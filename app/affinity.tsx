import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import Svg, { Path, Ellipse, Line } from "react-native-svg";

import { AppIcon } from "@/components/app-icon";
import { BorderAvatar } from "@/components/border-avatar";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import { getFriends, type FriendUser } from "@/lib/friends-service";
import {
  getAffinityPrivacy,
  setAffinityPrivacy,
  getUserAffinityBonds,
  getUserAffinityInvites,
  getUserAffinityHistory,
  getRealTopAffinityLeaderboard,
  sendAffinityInvite,
  acceptAffinityInvite,
  cancelAffinityInvite,
  rejectAffinityInvite,
  boostAffinityBondXp,
  breakAffinityBond,
  getFriendsSlotUsage,
  isGreetedToday,
  type RealLeaderboardItem,
} from "@/lib/affinity-service";

// ─── GEOMETRY CONSTANTS (Identik dengan D:\affinity\src\utils\affinityGeometry.ts) ───
const CONSTELLATION_WIDTH = 440;
const CONSTELLATION_HEIGHT = 224;
const CORE_CENTER = { x: 220, y: 38 };
const CORE_RADIUS = 25;
const ACTIVE_TIER_CENTER = { x: 220, y: 116 };
const ACTIVE_TIER_RADIUS = 22;
const TIER_CREST_RADIUS = 22;
const TIER_CREST_SIZE = TIER_CREST_RADIUS * 2;
const TIER_ICON_SIZE = 28;
const SATELLITE_RADIUS = 18;
const SATELLITE_SIZE = SATELLITE_RADIUS * 2;

function toPctX(x: number): string {
  return `${(x / CONSTELLATION_WIDTH) * 100}%`;
}
function toPctY(y: number): string {
  return `${(y / CONSTELLATION_HEIGHT) * 100}%`;
}

function computeConstellationSlots(slotCount: number) {
  const safeCount = Math.max(1, slotCount);
  const startX = ACTIVE_TIER_CENTER.x;
  const startY = ACTIVE_TIER_CENTER.y;

  if (safeCount === 1) {
    const center = { x: 220, y: 184 };
    return [
      {
        slotIndex: 0,
        center,
        curvePath: `M ${startX} ${startY} L ${center.x} ${center.y}`,
      },
    ];
  }

  const maxHalfSpanX = safeCount >= 5 ? 162 : 144;
  const baseArcY = 184;
  const edgeLiftY = 14;

  return Array.from({ length: safeCount }, (_, idx) => {
    const t = safeCount === 1 ? 0 : (idx / (safeCount - 1)) * 2 - 1;
    const x = Number((ACTIVE_TIER_CENTER.x + t * maxHalfSpanX).toFixed(2));
    const y = Number((baseArcY - t * t * edgeLiftY).toFixed(2));
    const center = { x, y };

    if (t === 0) {
      // Slot tengah: garis vertikal lurus sempurna masuk ke pusat satelit
      return {
        slotIndex: idx,
        center,
        curvePath: `M ${startX} ${startY} L ${x} ${y}`,
      };
    }

    const ctrlX = Number((ACTIVE_TIER_CENTER.x + t * maxHalfSpanX * 0.45).toFixed(2));
    const ctrlY = Number(((startY + y) / 2).toFixed(2));

    return {
      slotIndex: idx,
      center,
      curvePath: `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${x} ${y}`,
    };
  });
}

// ─── TYPES & LOGIC ───
export type TierId = "pasangan" | "orang_kepercayaan" | "sahabat" | "saudara";
export type PrivacyOption = "publik" | "teman" | "privat";
export type HistoryCategory = "dibatalkan" | "ditolak" | "kedaluwarsa" | "putus";
export type ActiveScreen = "affinity" | "leaderboard";

export interface TierConfig {
  id: TierId;
  labelId: string;
  labelEn: string;
  description: string;
  maxSlots: number;
}

export const TIER_CONFIGS: TierConfig[] = [
  {
    id: "pasangan",
    labelId: "Pasangan",
    labelEn: "Partner",
    description: "Ikatan eksklusif untuk satu pasangan utama.",
    maxSlots: 1,
  },
  {
    id: "orang_kepercayaan",
    labelId: "Kepercayaan",
    labelEn: "Confidants",
    description: "Lingkaran terdekat yang paling kamu percaya.",
    maxSlots: 5,
  },
  {
    id: "sahabat",
    labelId: "Sahabat",
    labelEn: "Besties",
    description: "Teman seperjuangan yang selalu hadir.",
    maxSlots: 4,
  },
  {
    id: "saudara",
    labelId: "Saudara",
    labelEn: "Bros",
    description: "Rekan satu barisan dengan solidaritas penuh.",
    maxSlots: 4,
  },
];

const TIER_ICONS: Record<TierId, any> = {
  pasangan: require("@/assets/images/affinity/pasangan.png"),
  orang_kepercayaan: require("@/assets/images/affinity/orang_kepercayaan.png"),
  sahabat: require("@/assets/images/affinity/sahabat.png"),
  saudara: require("@/assets/images/affinity/saudara.png"),
};

export interface FriendProfile {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  equippedBorder?: string | null;
  initial: string;
  avatarColor: string;
  bio?: string;
}

export interface ActiveBond {
  id: string;
  tierId: TierId;
  slotIndex: number;
  friend: FriendProfile;
  xp: number;
  level: number;
  sinceDate: string;
  streakDays: number;
  lastInteractionAt?: string | null;
}

export interface PendingInvite {
  id: string;
  tierId: TierId;
  slotIndex: number;
  senderId: string;
  receiverId: string;
  isSender: boolean;
  friend: FriendProfile;
  sentAt: string;
}

export interface HistoryRecord {
  id: string;
  category: HistoryCategory;
  tierId: TierId;
  friend: {
    id: string;
    name: string;
  };
  timestamp: string;
  reason: string;
}

export function formatXp(xp: number): string {
  return xp.toLocaleString("id-ID");
}

export function getXpProgressInLevel(xp: number): {
  level: number;
  currentIntoLevel: number;
  levelSpan: number;
  percent: number;
} {
  const levelSpan = 800;
  const level = Math.min(30, Math.floor(xp / levelSpan) + 1);
  const currentIntoLevel = xp % levelSpan;
  const percent = Math.min(100, Math.round((currentIntoLevel / levelSpan) * 100));
  return { level, currentIntoLevel, levelSpan, percent };
}

export default function AffinityScreen() {
  const auth = useAnirakuAuth();
  const routeParams = useLocalSearchParams<{
    targetUserId?: string;
    targetName?: string;
    targetAvatar?: string;
    targetBorder?: string;
    isVisitor?: string;
    screen?: string;
    view?: string;
    mode?: string;
    tab?: string;
    initialScreen?: string;
    tier?: TierId;
  }>();

  const isVisiting = Boolean(
    routeParams.isVisitor === "1" ||
      (routeParams.targetUserId && routeParams.targetUserId !== auth.user?.id)
  );
  const targetOwnerId = isVisiting && routeParams.targetUserId ? routeParams.targetUserId : auth.user?.id || "";
  const targetOwnerName = isVisiting && routeParams.targetName ? routeParams.targetName : auth.profile?.display_name || auth.profile?.username || "Pengguna";
  const targetOwnerAvatar = isVisiting && routeParams.targetAvatar ? routeParams.targetAvatar : auth.profile?.avatar_url || "";
  const [targetOwnerBorder, setTargetOwnerBorder] = useState<string | null>(
    isVisiting && routeParams.targetBorder ? routeParams.targetBorder : auth.profile?.equipped_border || null
  );
  const targetOwnerHandle = `@${(auth.profile?.username || "user").toLowerCase()}`;

  // Sinkronisasi border pengguna yang dikunjungi jika belum ada di routeParams
  useEffect(() => {
    if (isVisiting && targetOwnerId && !routeParams.targetBorder) {
      supabase
        .from("profiles")
        .select("equipped_border")
        .eq("id", targetOwnerId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.equipped_border) {
            setTargetOwnerBorder(data.equipped_border);
          }
        });
    } else if (!isVisiting) {
      setTargetOwnerBorder(auth.profile?.equipped_border || null);
    }
  }, [isVisiting, targetOwnerId, routeParams.targetBorder, auth.profile?.equipped_border]);

  const isLeaderboardParam = Boolean(
    routeParams.view === "leaderboard" ||
      routeParams.mode === "leaderboard" ||
      routeParams.tab === "leaderboard" ||
      routeParams.screen === "leaderboard" ||
      routeParams.initialScreen === "leaderboard"
  );

  const initialTier: TierId = (
    routeParams.tier && ["pasangan", "orang_kepercayaan", "sahabat", "saudara"].includes(routeParams.tier)
      ? (routeParams.tier as TierId)
      : "pasangan"
  );

  // Screens & Navigation
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>(
    isLeaderboardParam ? "leaderboard" : "affinity"
  );
  const [selectedTier, setSelectedTier] = useState<TierId>(initialTier);
  const [privacy, setPrivacy] = useState<PrivacyOption>("publik");

  // Real Database States (No Dummy Data)
  const [bonds, setBonds] = useState<ActiveBond[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [friendsList, setFriendsList] = useState<FriendProfile[]>([]);
  const [leaderboardItems, setLeaderboardItems] = useState<RealLeaderboardItem[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [friendsSlotUsage, setFriendsSlotUsage] = useState<Record<string, number>>({});

  // Modals
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [inviteModalSlot, setInviteModalSlot] = useState<number | null>(null);
  const [selectedBond, setSelectedBond] = useState<ActiveBond | null>(null);
  const [confirmEndBond, setConfirmEndBond] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [historyFilterCategory, setHistoryFilterCategory] = useState<HistoryCategory>("dibatalkan");
  const [leaderboardTab, setLeaderboardTab] = useState<TierId>(initialTier);

  // Sync routeParams jika layar dibuka dari Home Affinity Card atau link navigasi
  useEffect(() => {
    if (isLeaderboardParam) {
      setActiveScreen("leaderboard");
    }
    if (routeParams.tier && ["pasangan", "orang_kepercayaan", "sahabat", "saudara"].includes(routeParams.tier)) {
      setLeaderboardTab(routeParams.tier as TierId);
      setSelectedTier(routeParams.tier as TierId);
    }
  }, [
    isLeaderboardParam,
    routeParams.view,
    routeParams.mode,
    routeParams.tab,
    routeParams.screen,
    routeParams.initialScreen,
    routeParams.tier,
  ]);

  // 1. Sinkronisasi Data Afinitas Real dari Supabase (Ringan: tanpa fetch history & leaderboard di awal)
  const reloadAffinityData = useCallback(async () => {
    if (!targetOwnerId) return;
    try {
      const [realPrivacy, realBonds, realInvites] = await Promise.all([
        getAffinityPrivacy(targetOwnerId),
        getUserAffinityBonds(targetOwnerId),
        getUserAffinityInvites(targetOwnerId),
      ]);
      setPrivacy(realPrivacy);
      setBonds(realBonds as any);
      setPendingInvites(realInvites as any);
    } catch {}
  }, [targetOwnerId]);

  useEffect(() => {
    reloadAffinityData();
  }, [reloadAffinityData]);

  // 2. Sinkronisasi Riwayat HANYA saat Modal Riwayat dibuka (Lazy Loading)
  useEffect(() => {
    if (!isHistoryOpen || !targetOwnerId) return;
    setLoadingHistory(true);
    getUserAffinityHistory(targetOwnerId)
      .then((res) => setHistory(res as any))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [isHistoryOpen, targetOwnerId]);

  // 3. Sinkronisasi Daftar Teman HANYA saat Modal Ajak Teman dibuka (Lazy Loading)
  useEffect(() => {
    if (inviteModalSlot === null || !auth.user?.id) return;
    if (friendsList.length > 0) return;
    setLoadingFriends(true);
    getFriends(auth.user.id)
      .then((real) => {
        if (!real || real.length === 0) {
          setFriendsList([]);
          return;
        }
        const mapped: FriendProfile[] = real.map((f: FriendUser) => ({
          id: f.id,
          name: f.displayName || f.username,
          handle: `@${f.username}`,
          avatarUrl: f.avatarUrl || undefined,
          equippedBorder: f.equippedBorder || null,
          initial: (f.displayName || f.username || "U")[0].toUpperCase(),
          avatarColor: "#6366F1",
          bio: f.bio || "Teman di Nuenime",
        }));
        setFriendsList(mapped);
      })
      .catch(() => setFriendsList([]))
      .finally(() => setLoadingFriends(false));
  }, [inviteModalSlot, auth.user?.id, friendsList.length]);

  // 3b. Sinkronisasi slot terpakai masing-masing teman saat modal ajak teman dibuka
  useEffect(() => {
    if (inviteModalSlot !== null && friendsList.length > 0) {
      getFriendsSlotUsage(
        friendsList.map((f) => f.id),
        selectedTier
      )
        .then((usage) => {
          setFriendsSlotUsage(usage || {});
        })
        .catch(() => {});
    }
  }, [inviteModalSlot, selectedTier, friendsList]);

  // 4. Sinkronisasi Top Afinitas Leaderboard HANYA saat tab/layar Leaderboard aktif (Lazy Loading)
  useEffect(() => {
    if (activeScreen !== "leaderboard") return;
    setLoadingLeaderboard(true);
    getRealTopAffinityLeaderboard(leaderboardTab)
      .then((items) => {
        setLeaderboardItems(items);
      })
      .catch(() => {
        setLeaderboardItems([]);
      })
      .finally(() => {
        setLoadingLeaderboard(false);
      });
  }, [activeScreen, leaderboardTab]);

  const activeTierConfig = useMemo(
    () => TIER_CONFIGS.find((t) => t.id === selectedTier) || TIER_CONFIGS[0],
    [selectedTier]
  );
  const activeBonds = useMemo(() => bonds.filter((b) => b.tierId === selectedTier), [bonds, selectedTier]);
  const activePending = useMemo(() => pendingInvites.filter((p) => p.tierId === selectedTier), [pendingInvites, selectedTier]);
  const remainingSlots = activeTierConfig.maxSlots - activeBonds.length - activePending.length;
  const totalOccupied = bonds.length;

  // Optimasi Lookup Slot Konstelasi O(1) & Memoized Satellites
  const satellites = useMemo(
    () => computeConstellationSlots(activeTierConfig.maxSlots),
    [activeTierConfig.maxSlots]
  );
  const bondsBySlot = useMemo(() => {
    const map = new Map<number, ActiveBond>();
    for (const b of activeBonds) {
      map.set(b.slotIndex, b);
    }
    return map;
  }, [activeBonds]);
  const pendingBySlot = useMemo(() => {
    const map = new Map<number, PendingInvite>();
    for (const p of activePending) {
      map.set(p.slotIndex, p);
    }
    return map;
  }, [activePending]);

  // Optimasi Lookup Teman di Modal Ajak Teman
  const bondedFriendIds = useMemo(() => new Set(bonds.map((b) => b.friend.id)), [bonds]);
  const pendingFriendMap = useMemo(() => {
    const map = new Map<string, PendingInvite>();
    for (const p of pendingInvites) {
      map.set(p.friend.id, p);
    }
    return map;
  }, [pendingInvites]);

  const filteredFriends = useMemo(() => {
    if (!friendSearchQuery.trim()) return friendsList;
    const q = friendSearchQuery.toLowerCase();
    return friendsList.filter(
      (f) => f.name.toLowerCase().includes(q) || f.handle.toLowerCase().includes(q)
    );
  }, [friendsList, friendSearchQuery]);

  const filteredHistory = useMemo(() => {
    return history.filter((h) => h.category === historyFilterCategory);
  }, [history, historyFilterCategory]);

  // Handlers
  const handleBack = () => {
    hapticLight();
    if (isLeaderboardParam) {
      router.back();
    } else if (activeScreen === "leaderboard") {
      setActiveScreen("affinity");
    } else {
      router.back();
    }
  };

  const handleSelectTier = (tierId: TierId) => {
    hapticLight();
    setSelectedTier(tierId);
  };

  const handleSlotClick = (slotIdx: number, existingBond?: ActiveBond, pending?: PendingInvite) => {
    hapticLight();
    if (existingBond) {
      setConfirmEndBond(false);
      setSelectedBond(existingBond);
      return;
    }
    if (pending) {
      if (pending.isSender) {
        Alert.alert(
          "Ajakan Terkirim",
          `Kamu telah mengirim ajakan ${activeTierConfig.labelId} ke ${pending.friend.name}.\nStatus: Menunggu respon dari ${pending.friend.name}.`,
          [
            { text: "Tutup", style: "cancel" },
            {
              text: "Batalkan Ajakan",
              style: "destructive",
              onPress: () => handleCancelPending(pending),
            },
          ]
        );
      } else {
        Alert.alert(
          "Ajakan Masuk",
          `${pending.friend.name} mengajak kamu menjalin ikatan ${activeTierConfig.labelId}.`,
          [
            {
              text: "Tolak",
              style: "destructive",
              onPress: () => handleRejectPending(pending),
            },
            {
              text: "Terima",
              onPress: () => handleAcceptPending(pending),
            },
            { text: "Nanti", style: "cancel" },
          ]
        );
      }
      return;
    }
    if (isVisiting) return;
    setInviteModalSlot(slotIdx);
  };

  const handleSendInvite = async (friend: FriendProfile) => {
    if (!auth.user?.id) {
      Alert.alert("Perhatian", "Silakan login terlebih dahulu untuk mengirim ajakan.");
      return;
    }
    // Cek anti duplikasi: sudah punya ikatan afinitas
    if (bonds.some((b) => b.friend.id === friend.id)) {
      Alert.alert("Perhatian", "Kalian sudah memiliki Afinitas Persahabatan.");
      return;
    }
    // Cek batas slot
    if (remainingSlots <= 0 || (friendsSlotUsage[friend.id] || 0) >= activeTierConfig.maxSlots) {
      Alert.alert(
        "Perhatian",
        "Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot."
      );
      return;
    }
    hapticSuccess();
    const slotIdx = inviteModalSlot ?? activeBonds.length + activePending.length;
    const res = await sendAffinityInvite(auth.user.id, friend.id, selectedTier, slotIdx);

    if (res.success) {
      setInviteModalSlot(null);
      await reloadAffinityData();
      Alert.alert("Sukses", res.message || `Undangan ikatan ${activeTierConfig.labelId} berhasil dikirim ke ${friend.name}.`);
    } else {
      Alert.alert("Perhatian", res.message);
    }
  };

  const handleAcceptPending = async (inv: PendingInvite) => {
    if (!auth.user?.id) return;
    hapticSuccess();
    const res = await acceptAffinityInvite(
      inv.id,
      inv.senderId,
      auth.user.id,
      inv.tierId,
      inv.slotIndex
    );
    if (res.success) {
      await reloadAffinityData();
      getRealTopAffinityLeaderboard(leaderboardTab).then(setLeaderboardItems).catch(() => {});
      Alert.alert("Sukses", res.message || "Tautan Afinitas Persahabatan berhasil dibuat!");
    } else {
      Alert.alert("Perhatian", res.message || "Gagal menerima ajakan.");
    }
  };

  const handleRejectPending = async (inv: PendingInvite) => {
    if (!auth.user?.id) return;
    hapticWarning();
    await rejectAffinityInvite(inv.id, auth.user.id, inv.senderId, inv.tierId);
    await reloadAffinityData();
  };

  const handleCancelPending = async (inv: PendingInvite) => {
    if (!auth.user?.id) return;
    hapticLight();
    await cancelAffinityInvite(inv.id, auth.user.id, inv.receiverId, inv.tierId);
    await reloadAffinityData();
  };

  const handleBoostXp = async (bondId: string) => {
    const targetBond = bonds.find((b) => b.id === bondId);
    if (targetBond && isGreetedToday(targetBond.lastInteractionAt)) {
      Alert.alert(
        "Perhatian",
        "Sapaan sudah dikirim hari ini. Kamu hanya dapat menyapa 1x sehari untuk akun ini."
      );
      return;
    }

    hapticSuccess();
    const res = await boostAffinityBondXp(bondId, 200);
    if (res.success) {
      const nowIso = new Date().toISOString();
      const updatedXp = res.xp ?? ((targetBond?.xp || 0) + 200);
      const updatedLevel = res.level ?? Math.min(30, Math.floor(updatedXp / 800) + 1);
      const updatedStreak = res.streak ?? ((targetBond?.streakDays || 0) + 1);

      setBonds((prev) =>
        prev.map((b) => {
          if (b.id !== bondId) return b;
          return {
            ...b,
            xp: updatedXp,
            level: updatedLevel,
            streakDays: updatedStreak,
            lastInteractionAt: nowIso,
          };
        })
      );
      if (selectedBond?.id === bondId) {
        setSelectedBond((prev) =>
          prev
            ? {
                ...prev,
                xp: updatedXp,
                level: updatedLevel,
                streakDays: updatedStreak,
                lastInteractionAt: nowIso,
              }
            : null
        );
      }
      getRealTopAffinityLeaderboard(leaderboardTab).then(setLeaderboardItems).catch(() => {});
      Alert.alert("Sukses", res.message || "Sapaan berhasil dikirim! (+200 XP)");
    } else {
      Alert.alert("Perhatian", res.message || "Sapaan sudah dikirim hari ini. Kamu hanya dapat menyapa 1x sehari untuk akun ini.");
    }
  };

  const handleEndBond = async (bondId: string) => {
    hapticWarning();
    await breakAffinityBond(bondId);
    setSelectedBond(null);
    setConfirmEndBond(false);
    await reloadAffinityData();
    getRealTopAffinityLeaderboard(leaderboardTab).then(setLeaderboardItems).catch(() => {});
  };

  const handleSelectPrivacy = async (opt: PrivacyOption) => {
    hapticLight();
    setPrivacy(opt);
    setIsPrivacyOpen(false);
    if (auth.user?.id) {
      await setAffinityPrivacy(auth.user.id, opt);
      getRealTopAffinityLeaderboard(leaderboardTab).then(setLeaderboardItems).catch(() => {});
    }
  };

  // ─── RENDER: ORBITAL BOND GRAPH (Persis D:\affinity\src\components\OrbitalBondGraph.tsx) ───
  const renderOrbitalGraph = () => {
    return (
      <View style={styles.constellationCard}>
        {/* Header Identitas & Total Bond */}
        <View style={styles.constellationHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.constellationName} numberOfLines={1}>
              {targetOwnerName}
            </Text>
            <Text style={styles.constellationHandle} numberOfLines={1}>
              {targetOwnerHandle} · {activeTierConfig.labelId}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.totalBondLabel}>Total Bond</Text>
            <Text style={styles.totalBondCount}>{totalOccupied} / 14</Text>
          </View>
        </View>

        {/* Minimalist Architectural Constellation Canvas */}
        <View style={styles.canvasContainer}>
          <Svg viewBox={`0 0 ${CONSTELLATION_WIDTH} ${CONSTELLATION_HEIGHT}`} style={styles.svgAbsolute}>
            {/* Quiet monochrome orbital arcs */}
            <Ellipse
              cx={CORE_CENTER.x}
              cy={CORE_CENTER.y}
              rx={168}
              ry={66}
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            <Ellipse
              cx={CORE_CENTER.x}
              cy={CORE_CENTER.y}
              rx={186}
              ry={82}
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={1}
            />

            {/* Core to Active Tier spine */}
            <Line
              x1={CORE_CENTER.x}
              y1={CORE_CENTER.y}
              x2={ACTIVE_TIER_CENTER.x}
              y2={ACTIVE_TIER_CENTER.y}
              stroke="rgba(255, 255, 255, 0.24)"
              strokeWidth={1.4}
              strokeLinecap="round"
            />

            {/* Bezier Constellation Tethers */}
            {satellites.map((sat) => {
              const bond = bondsBySlot.get(sat.slotIndex);
              const pending = pendingBySlot.get(sat.slotIndex);

              return (
                <Path
                  key={`curve-${activeTierConfig.id}-${sat.slotIndex}`}
                  d={sat.curvePath}
                  fill="none"
                  stroke={
                    bond
                      ? "rgba(248, 250, 252, 0.65)"
                      : pending
                      ? "rgba(251, 191, 36, 0.5)"
                      : "rgba(255, 255, 255, 0.16)"
                  }
                  strokeWidth={bond ? 1.6 : 1.25}
                  strokeDasharray={pending ? "4 3" : undefined}
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>

          {/* Top Core Avatar Node dengan Sinkronisasi Border */}
          <View
            style={[
              styles.coreNode,
              {
                left: toPctX(CORE_CENTER.x) as any,
                top: toPctY(CORE_CENTER.y) as any,
              },
            ]}
          >
            <BorderAvatar
              size={CORE_RADIUS * 2}
              avatarUrl={targetOwnerAvatar || undefined}
              borderId={targetOwnerBorder}
              fallbackText={targetOwnerName}
            />
          </View>

          {/* Active Tier Emblem */}
          <View
            style={[
              styles.tierCrestNode,
              {
                left: toPctX(ACTIVE_TIER_CENTER.x) as any,
                top: toPctY(ACTIVE_TIER_CENTER.y) as any,
              },
            ]}
          >
            <Image
              source={TIER_ICONS[selectedTier]}
              style={styles.tierCrestImg}
              contentFit="contain"
            />
          </View>

          {/* Wide-Arc Slot Satellites dengan Sinkronisasi Border */}
          {satellites.map((sat) => {
            const bond = bondsBySlot.get(sat.slotIndex);
            const pending = pendingBySlot.get(sat.slotIndex);

            return (
              <Pressable
                key={`sat-${activeTierConfig.id}-${sat.slotIndex}`}
                style={[
                  styles.satelliteNode,
                  {
                    left: toPctX(sat.center.x) as any,
                    top: toPctY(sat.center.y) as any,
                  },
                ]}
                onPress={() => handleSlotClick(sat.slotIndex, bond, pending)}
              >
                {bond ? (
                  <View style={styles.satelliteBondWrap}>
                    <BorderAvatar
                      size={SATELLITE_RADIUS * 2}
                      avatarUrl={bond.friend.avatarUrl}
                      borderId={bond.friend.equippedBorder}
                      fallbackText={bond.friend.name}
                    />
                    <View style={styles.satLevelPill}>
                      <Text style={styles.satLevelText}>Lv {bond.level}</Text>
                    </View>
                  </View>
                ) : pending ? (
                  <View style={styles.satellitePendingWrap}>
                    <View style={{ opacity: 0.75 }}>
                      <BorderAvatar
                        size={SATELLITE_RADIUS * 2}
                        avatarUrl={pending.friend.avatarUrl}
                        borderId={pending.friend.equippedBorder}
                        fallbackText={pending.friend.name}
                      />
                    </View>
                    <View style={styles.satClockWrap}>
                      <AppIcon
                        name={pending.isSender ? "clock-outline" : "email-outline"}
                        size={10}
                        color={pending.isSender ? "#FCD34D" : "#38BDF8"}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.satelliteEmptyWrap}>
                    <AppIcon name="plus" size={14} color="#CBD5E1" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  // ─── RENDER: 4-COLUMN SEGMENTED TIER DOCK & LIST (Persis D:\affinity\src\components\TierListPanel.tsx) ───
  const renderTierListPanel = () => {
    return (
      <View style={styles.tierPanelWrap}>
        {/* Unified 4-Column Segmented Tier Switcher */}
        <View style={styles.segmentedDock}>
          {TIER_CONFIGS.map((tier) => {
            const isSelected = selectedTier === tier.id;
            const occupied = bonds.filter((b) => b.tierId === tier.id).length;

            return (
              <Pressable
                key={tier.id}
                onPress={() => handleSelectTier(tier.id)}
                style={[
                  styles.segmentedTab,
                  isSelected && styles.segmentedTabSelected,
                ]}
              >
                <Image source={TIER_ICONS[tier.id]} style={styles.segmentedIcon} contentFit="contain" />
                <Text
                  style={[
                    styles.segmentedLabel,
                    isSelected ? styles.segmentedLabelSelected : styles.segmentedLabelMuted,
                  ]}
                  numberOfLines={1}
                >
                  {tier.labelId}
                </Text>
                <Text
                  style={[
                    styles.segmentedCount,
                    isSelected ? styles.segmentedCountSelected : styles.segmentedCountMuted,
                  ]}
                >
                  {occupied}/{tier.maxSlots}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Single Clean Active Tier Card with Hairline List & Anchored Primary CTA */}
        <View style={styles.activeTierCard}>
          {/* Card Header */}
          <View style={styles.activeTierHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.activeTierTitle}>{activeTierConfig.labelId}</Text>
                <Text style={styles.activeTierSub}>{activeTierConfig.labelEn}</Text>
              </View>
              <Text style={styles.activeTierDesc} numberOfLines={2}>
                {activeTierConfig.description}
              </Text>
            </View>
            <Text style={styles.activeTierRatio}>
              {activeBonds.length}/{activeTierConfig.maxSlots}
            </Text>
          </View>

          {/* Hairline List of Connected Bonds & Pending Invites */}
          {activeBonds.length > 0 || activePending.length > 0 ? (
            <View style={styles.hairlineList}>
              {activeBonds.map((bond) => {
                const progress = getXpProgressInLevel(bond.xp);
                return (
                  <Pressable
                    key={bond.id}
                    onPress={() => {
                      setConfirmEndBond(false);
                      setSelectedBond(bond);
                    }}
                    style={({ pressed }) => [styles.bondListItem, pressed && styles.itemPressed]}
                  >
                    <BorderAvatar
                      size={42}
                      avatarUrl={bond.friend.avatarUrl}
                      borderId={bond.friend.equippedBorder}
                      fallbackText={bond.friend.name}
                    />

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.listBondTopRow}>
                        <Text style={styles.listBondName} numberOfLines={1}>
                          {bond.friend.name}
                        </Text>
                        <Text style={styles.listBondStats}>
                          Lv {bond.level} · {formatXp(bond.xp)} XP
                        </Text>
                      </View>
                      <View style={styles.listProgressBarBg}>
                        <View style={[styles.listProgressBarFill, { width: `${progress.percent}%` }]} />
                      </View>
                    </View>

                    <AppIcon name="chevron-right" size={18} color="#64748B" />
                  </Pressable>
                );
              })}

              {activePending.map((inv) => (
                <View key={inv.id} style={styles.pendingListItem}>
                  <BorderAvatar
                    size={42}
                    avatarUrl={inv.friend.avatarUrl}
                    borderId={inv.friend.equippedBorder}
                    fallbackText={inv.friend.name}
                  />

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.listBondName} numberOfLines={1}>
                      {inv.friend.name}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <AppIcon
                        name={inv.isSender ? "clock-outline" : "email-outline"}
                        size={12}
                        color={inv.isSender ? "#FCD34D" : "#38BDF8"}
                      />
                      <Text style={styles.pendingTimeText}>
                        {inv.isSender ? `Menunggu respon · ${inv.sentAt}` : `Mengajak kamu · ${inv.sentAt}`}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {inv.isSender ? (
                      <Pressable
                        style={styles.cancelPillBtn}
                        onPress={() => handleCancelPending(inv)}
                      >
                        <AppIcon name="close" size={13} color="#CBD5E1" />
                        <Text style={styles.cancelPillText}>Batalkan</Text>
                      </Pressable>
                    ) : (
                      <>
                        <Pressable
                          style={styles.acceptPillBtn}
                          onPress={() => handleAcceptPending(inv)}
                        >
                          <AppIcon name="check" size={13} color="#0A0D14" />
                          <Text style={styles.acceptPillText}>Terima</Text>
                        </Pressable>
                        <Pressable
                          style={styles.cancelPillBtn}
                          onPress={() => handleRejectPending(inv)}
                        >
                          <AppIcon name="close" size={13} color="#CBD5E1" />
                          <Text style={styles.cancelPillText}>Tolak</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyStateText}>
                Belum ada teman terhubung di tier {activeTierConfig.labelId}.
              </Text>
            </View>
          )}

          {/* Single Clean Thumb-Zone Primary Action Footer */}
          <View style={styles.tierFooterAction}>
            {remainingSlots > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.primaryWhiteBtn, pressed && styles.btnPressed]}
                onPress={() => {
                  if (isVisiting) return;
                  hapticLight();
                  setInviteModalSlot(activeBonds.length + activePending.length);
                }}
              >
                <AppIcon name="account-plus" size={18} color="#0A0D14" />
                <Text style={styles.primaryWhiteBtnText}>
                  Undang Teman ({remainingSlots} slot tersisa)
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.tierFullText}>Semua slot {activeTierConfig.labelId} telah terisi.</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ─── RENDER: TOP AFINITAS / LEADERBOARD (Persis Screenshot & Data Real Supabase) ───
  const renderTopAfinitasView = () => {
    const topOne = leaderboardItems[0];
    const restEntries = leaderboardItems.slice(1);

    const filterTabs: { id: TierId; label: string; icon: any }[] = [
      { id: "pasangan", label: "Pasangan", icon: TIER_ICONS.pasangan },
      { id: "sahabat", label: "Sahabat", icon: TIER_ICONS.sahabat },
      { id: "saudara", label: "Saudara", icon: TIER_ICONS.saudara },
      { id: "orang_kepercayaan", label: "Orang Kepercaya...", icon: TIER_ICONS.orang_kepercayaan },
    ];

    return (
      <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyScrollContent}>
        {/* Subtitle */}
        <Text style={styles.leaderboardSub}>Bond dengan XP tertinggi yang dibuka publik.</Text>

        {/* 2x2 Grid Filter Tabs */}
        <View style={styles.grid2x2Filter}>
          {filterTabs.map((t) => {
            const isSelected = leaderboardTab === t.id;
            return (
              <Pressable
                key={`lb-tab-${t.id}`}
                onPress={() => {
                  hapticLight();
                  setLeaderboardTab(t.id);
                }}
                style={[styles.gridFilterTab, isSelected && styles.gridFilterTabActive]}
              >
                <Image source={t.icon} style={styles.gridFilterIcon} contentFit="contain" />
                <Text style={[styles.gridFilterText, isSelected && styles.gridFilterTextActive]} numberOfLines={1}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Loading Indicator */}
        {loadingLeaderboard && (
          <View style={{ paddingVertical: 24, alignItems: "center", gap: 8 }}>
            <ActivityIndicator size="small" color="#38BDF8" />
            <Text style={{ fontSize: 12, color: "#94A3B8" }}>Memuat peringkat afinitas...</Text>
          </View>
        )}

        {/* Jika belum ada pasangan di leaderboard */}
        {!loadingLeaderboard && leaderboardItems.length === 0 && (
          <View style={styles.emptyLeaderboardCard}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>⭐</Text>
            <Text style={styles.emptyLeaderboardTitle}>Belum Ada Pasangan di Tier {activeTierConfig.labelId}</Text>
            <Text style={styles.emptyLeaderboardDesc}>
              Jadilah yang pertama menjalin ikatan afinitas dengan temanmu dan kumpulkan XP untuk tampil di papan peringkat!
            </Text>
          </View>
        )}

        {/* #1 Clean Editorial Spotlight Card */}
        {topOne && (
          <View style={styles.spotlightCard}>
            <View style={styles.spotlightTopRow}>
              {/* Overlapping Duos dengan Sinkronisasi Border */}
              <View style={styles.duoOverlapRow}>
                <View style={{ zIndex: 1 }}>
                  <BorderAvatar
                    size={54}
                    avatarUrl={topOne.userA.avatarUrl}
                    borderId={topOne.userA.equippedBorder}
                    fallbackText={topOne.userA.name}
                  />
                </View>
                <View style={{ marginLeft: -16, zIndex: 2 }}>
                  <BorderAvatar
                    size={54}
                    avatarUrl={topOne.userB.avatarUrl}
                    borderId={topOne.userB.equippedBorder}
                    fallbackText={topOne.userB.name}
                  />
                </View>
              </View>

              <View style={styles.spotlightInfoCol}>
                <View style={styles.rank1BadgeRow}>
                  <Text style={{ fontSize: 13 }}>🎖️</Text>
                  <Text style={styles.rank1BadgeText}>
                    #1 {activeTierConfig.labelId.toUpperCase()} TERBAIK
                  </Text>
                </View>
                <Text style={styles.spotlightDuoNames} numberOfLines={1}>
                  {topOne.duoTitle}
                </Text>
                <View style={styles.spotlightLevelRow}>
                  <Image source={TIER_ICONS[leaderboardTab]} style={styles.spotlightTierIcon} contentFit="contain" />
                  <Text style={styles.spotlightLevelText}>Bond Lv {topOne.level}</Text>
                </View>
              </View>
            </View>

            {/* Total Afinitas & XP Row */}
            <View style={styles.spotlightBottomRow}>
              <Text style={styles.totalAfinitasLabel}>TOTAL AFINITAS</Text>
              <View style={styles.totalAfinitasValRow}>
                <Text style={styles.totalAfinitasNumber}>{formatXp(topOne.xp)}</Text>
                <Text style={styles.totalAfinitasXpText}>XP</Text>
              </View>
            </View>

            {/* Bottom horizontal bar */}
            <View style={styles.spotlightDividerBar} />
          </View>
        )}

        {/* Rest of Leaderboard Entries (#2, #3, #4, #5, #6) */}
        {restEntries.length > 0 && (
          <View style={styles.restEntriesCard}>
            {restEntries.map((entry, idx) => (
              <View key={entry.id} style={styles.restEntryRow}>
                <Text style={styles.restRankNumber}>#{idx + 2}</Text>
                <View style={styles.duoMiniOverlap}>
                  <View style={{ zIndex: 1 }}>
                    <BorderAvatar
                      size={38}
                      avatarUrl={entry.userA.avatarUrl}
                      borderId={entry.userA.equippedBorder}
                      fallbackText={entry.userA.name}
                    />
                  </View>
                  <View style={{ marginLeft: -12, zIndex: 2 }}>
                    <BorderAvatar
                      size={38}
                      avatarUrl={entry.userB.avatarUrl}
                      borderId={entry.userB.equippedBorder}
                      fallbackText={entry.userB.name}
                    />
                  </View>
                </View>
                <View style={styles.restNameCol}>
                  <Text style={styles.restNames} numberOfLines={1}>
                    {entry.duoTitle}
                  </Text>
                  <Text style={styles.restLevelText}>Bond Lv {entry.level}</Text>
                </View>
                <View style={styles.restXpCol}>
                  <Text style={styles.restXpNumber}>{formatXp(entry.xp)}</Text>
                  <Text style={styles.restXpSub}>XP</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.rootContainer}>
      {/* ─── TOP BAR (Identik D:\affinity\src\components\TopBar.tsx) ─── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Pressable
            accessibilityLabel={activeScreen === "leaderboard" ? "Kembali ke Affinity" : "Kembali"}
            onPress={handleBack}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
            hitSlop={10}
          >
            <AppIcon name="arrow-left" size={20} color="#CBD5E1" />
          </Pressable>
          <Text style={styles.topBarTitle}>
            {activeScreen === "leaderboard" ? "TOP AFINITAS" : "AFFINITY"}
          </Text>
        </View>

        <View style={styles.topBarRight}>
          {activeScreen === "affinity" && (
            <>
              <Pressable
                accessibilityLabel="Top Afinitas"
                onPress={() => {
                  hapticLight();
                  setActiveScreen("leaderboard");
                }}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
              >
                <AppIcon name="trophy-outline" size={18} color="#CBD5E1" />
              </Pressable>

              <Pressable
                accessibilityLabel="Riwayat Ajakan"
                onPress={() => {
                  hapticLight();
                  setIsHistoryOpen(true);
                }}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
              >
                <AppIcon name="history" size={18} color="#CBD5E1" />
              </Pressable>
            </>
          )}

          <Pressable
            accessibilityLabel={`Privasi Bond: ${privacy}`}
            onPress={() => {
              hapticLight();
              setIsPrivacyOpen(true);
            }}
            style={({ pressed }) => [styles.privacyBtn, pressed && styles.btnPressed]}
          >
            <AppIcon
              name={privacy === "publik" ? "earth" : privacy === "teman" ? "account-multiple" : "lock"}
              size={14}
              color="#CBD5E1"
            />
            <Text style={styles.privacyBtnText}>
              {privacy === "publik" ? "Publik" : privacy === "teman" ? "Teman saja" : "Privat"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ─── BODY ─── */}
      {activeScreen === "leaderboard" ? (
        renderTopAfinitasView()
      ) : (
        <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyScrollContent}>
          {renderOrbitalGraph()}
          {renderTierListPanel()}
        </ScrollView>
      )}

      {/* ─── MODAL: DETAIL BOND (Persis D:\affinity\src\components\BondDetailModal.tsx) ─── */}
      {selectedBond !== null && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setSelectedBond(null)}>
          <View style={styles.sheetOverlay}>
            <View style={styles.sheetContent}>
              {/* Mobile Drag Handle */}
              <View style={styles.sheetDragHandle} />

              <View style={styles.sheetTopRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                  <View style={styles.friendAvatarWrap}>
                    <BorderAvatar
                      size={48}
                      avatarUrl={selectedBond.friend.avatarUrl}
                      borderId={selectedBond.friend.equippedBorder}
                      fallbackText={selectedBond.friend.name}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.sheetTitle} numberOfLines={1}>
                      {selectedBond.friend.name}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <Image source={TIER_ICONS[selectedBond.tierId]} style={{ width: 14, height: 14 }} contentFit="contain" />
                      <Text style={styles.sheetSubText}>{activeTierConfig.labelId}</Text>
                      <Text style={styles.sheetSubText}>·</Text>
                      <Text style={styles.sheetSubText}>Sejak {selectedBond.sinceDate}</Text>
                    </View>
                  </View>
                </View>
                <Pressable onPress={() => setSelectedBond(null)} style={styles.sheetCloseBtn}>
                  <AppIcon name="close" size={18} color="#94A3B8" />
                </Pressable>
              </View>

              {/* XP & Streak Summary Card */}
              {(() => {
                const progress = getXpProgressInLevel(selectedBond.xp);
                return (
                  <View style={styles.sheetSummaryCard}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={styles.summaryLvText}>Bond Lv {progress.level}</Text>
                      <Text style={styles.summaryXpText}>{formatXp(selectedBond.xp)} XP</Text>
                    </View>
                    <View style={styles.summaryBarBg}>
                      <View style={[styles.summaryBarFill, { width: `${progress.percent}%` }]} />
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <AppIcon name="fire" size={14} color="#CBD5E1" />
                        <Text style={styles.summaryInteraksiText}>{selectedBond.streakDays} interaksi</Text>
                      </View>
                      <Text style={styles.summaryIntoLvText}>
                        {formatXp(progress.currentIntoLevel)} / {formatXp(progress.levelSpan)} ke Lv {Math.min(30, progress.level + 1)}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {/* Actions */}
              <View style={{ gap: 10, marginTop: 16 }}>
                {isGreetedToday(selectedBond.lastInteractionAt) ? (
                  <View style={styles.greetedDisabledBtn}>
                    <AppIcon name="check-circle-outline" size={16} color="#94A3B8" />
                    <Text style={styles.greetedDisabledText}>Sudah Disapa Hari Ini (1x/hari)</Text>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.primaryWhiteBtn, pressed && styles.btnPressed]}
                    onPress={() => handleBoostXp(selectedBond.id)}
                  >
                    <AppIcon name="star-four-points" size={16} color="#0A0D14" />
                    <Text style={styles.primaryWhiteBtnText}>Kirim Sapaan (+200 XP)</Text>
                  </Pressable>
                )}

                {!confirmEndBond ? (
                  <Pressable
                    style={styles.unlinkBtn}
                    onPress={() => setConfirmEndBond(true)}
                  >
                    <AppIcon name="link-off" size={16} color="#FB7185" />
                    <Text style={styles.unlinkBtnText}>Putuskan Bond</Text>
                  </Pressable>
                ) : (
                  <View style={styles.confirmEndCard}>
                    <Text style={styles.confirmEndDesc}>
                      Putuskan bond {activeTierConfig.labelId} dengan{" "}
                      <Text style={{ fontWeight: "700", color: "#FFFFFF" }}>{selectedBond.friend.name}</Text>? Riwayat bond akan tercatat di tab Putus.
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <Pressable style={styles.cancelEndBtn} onPress={() => setConfirmEndBond(false)}>
                        <Text style={styles.cancelEndBtnText}>Batal</Text>
                      </Pressable>
                      <Pressable style={styles.doEndBtn} onPress={() => handleEndBond(selectedBond.id)}>
                        <Text style={styles.doEndBtnText}>Ya, Putuskan</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ─── MODAL: AJAK TEMAN (Persis D:\affinity\src\components\InviteFriendModal.tsx) ─── */}
      {inviteModalSlot !== null && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setInviteModalSlot(null)}>
          <View style={styles.sheetOverlay}>
            <View style={styles.sheetContent}>
              <View style={styles.sheetDragHandle} />

              <View style={styles.sheetTopRow}>
                <View>
                  <Text style={styles.sheetTitle}>Ajak Teman</Text>
                  <Text style={styles.sheetSubText}>
                    Slot {activeTierConfig.labelId} #{ (inviteModalSlot ?? 0) + 1 }
                  </Text>
                </View>
                <Pressable onPress={() => setInviteModalSlot(null)} style={styles.sheetCloseBtn}>
                  <AppIcon name="close" size={18} color="#94A3B8" />
                </Pressable>
              </View>

              {/* Search Input */}
              <View style={styles.searchBarWrap}>
                <AppIcon name="magnify" size={16} color="#64748B" />
                <TextInput
                  placeholder="Cari teman..."
                  placeholderTextColor="#64748B"
                  value={friendSearchQuery}
                  onChangeText={setFriendSearchQuery}
                  style={styles.searchInput}
                />
              </View>

              <ScrollView
                style={{ maxHeight: 320 }}
                contentContainerStyle={{ paddingHorizontal: 6, paddingVertical: 4 }}
                showsVerticalScrollIndicator={false}
              >
                {loadingFriends ? (
                  <View style={{ paddingVertical: 28, alignItems: "center", gap: 8 }}>
                    <ActivityIndicator size="small" color="#38BDF8" />
                    <Text style={{ fontSize: 12, color: "#94A3B8" }}>Memuat daftar teman...</Text>
                  </View>
                ) : filteredFriends.length === 0 ? (
                  <View style={styles.emptyFriendsBox}>
                    <AppIcon name="account-search-outline" size={32} color="#64748B" />
                    <Text style={styles.emptyFriendsTitle}>
                      {friendSearchQuery.trim() ? "Teman Tidak Ditemukan" : "Belum Ada Teman"}
                    </Text>
                    <Text style={styles.emptyFriendsSub}>
                      {friendSearchQuery.trim()
                        ? "Tidak ada teman yang cocok dengan kata kunci pencarian."
                        : "Kunjungi profil pengguna lain dan tambahkan sebagai teman untuk mengajak mereka ke lingkaran afinitas!"}
                    </Text>
                  </View>
                ) : (
                  filteredFriends.map((friend) => {
                    const bonded = bondedFriendIds.has(friend.id);
                    const pending = pendingFriendMap.get(friend.id);
                    const friendTierUsed = friendsSlotUsage[friend.id] || 0;
                    const isFriendSlotFull = friendTierUsed >= activeTierConfig.maxSlots;
                    const isMySlotFull = remainingSlots <= 0;

                    let statusBadge: {
                      text: string;
                      icon: string;
                      badgeStyle: any;
                      textStyle: any;
                      iconColor: string;
                    } | null = null;

                    if (bonded) {
                      statusBadge = {
                        text: "Sudah Terhubung",
                        icon: "check-circle-outline",
                        badgeStyle: styles.inviteBadgeDefault,
                        textStyle: styles.inviteBadgeTextDefault,
                        iconColor: "#94A3B8",
                      };
                    } else if (pending) {
                      statusBadge = {
                        text: pending.isSender ? "Menunggu respon" : "Mengajak kamu",
                        icon: pending.isSender ? "clock-outline" : "email-outline",
                        badgeStyle: styles.inviteBadgeWarning,
                        textStyle: styles.inviteBadgeTextWarning,
                        iconColor: "#FCD34D",
                      };
                    } else if (isFriendSlotFull) {
                      statusBadge = {
                        text: "Slot Penuh",
                        icon: "alert-circle-outline",
                        badgeStyle: styles.inviteBadgeDanger,
                        textStyle: styles.inviteBadgeTextDanger,
                        iconColor: "#F87171",
                      };
                    } else if (isMySlotFull) {
                      statusBadge = {
                        text: "Slot Penuh",
                        icon: "alert-circle-outline",
                        badgeStyle: styles.inviteBadgeDefault,
                        textStyle: styles.inviteBadgeTextDefault,
                        iconColor: "#94A3B8",
                      };
                    }

                    return (
                      <View key={friend.id} style={styles.friendRow}>
                        <View style={styles.friendAvatarWrap}>
                          <BorderAvatar
                            size={42}
                            avatarUrl={friend.avatarUrl}
                            borderId={friend.equippedBorder}
                            fallbackText={friend.name}
                          />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.listBondName} numberOfLines={1}>
                            {friend.name}
                          </Text>
                          <Text style={styles.friendBioText} numberOfLines={1}>
                            {friend.bio || friend.handle}
                          </Text>
                        </View>
                        {statusBadge ? (
                          <View style={[styles.inviteStatusBadge, statusBadge.badgeStyle]}>
                            <AppIcon
                              name={statusBadge.icon as any}
                              size={12}
                              color={statusBadge.iconColor}
                            />
                            <Text style={statusBadge.textStyle}>{statusBadge.text}</Text>
                          </View>
                        ) : (
                          <Pressable
                            style={styles.invitePillBtn}
                            onPress={() => handleSendInvite(friend)}
                          >
                            <AppIcon name="send" size={13} color="#0A0D14" />
                            <Text style={styles.invitePillText}>Ajak</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ─── MODAL: PRIVACY SHEET (Persis D:\affinity\src\components\PrivacySheet.tsx) ─── */}
      {isPrivacyOpen && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setIsPrivacyOpen(false)}>
          <View style={styles.sheetOverlay}>
            <View style={styles.sheetContent}>
              <View style={styles.sheetDragHandle} />

              <View style={styles.sheetTopRow}>
                <View>
                  <Text style={styles.sheetTitle}>Privasi Bond</Text>
                  <Text style={styles.sheetSubText}>Atur siapa yang bisa melihat daftar bond di profilmu.</Text>
                </View>
                <Pressable onPress={() => setIsPrivacyOpen(false)} style={styles.sheetCloseBtn}>
                  <AppIcon name="close" size={18} color="#94A3B8" />
                </Pressable>
              </View>

              <View style={styles.privacyOptionContainer}>
                {(["publik", "teman", "privat"] as PrivacyOption[]).map((opt) => {
                  const isSelected = privacy === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => handleSelectPrivacy(opt)}
                      style={[styles.privacyRowItem, isSelected && styles.privacyRowItemActive]}
                    >
                      <AppIcon
                        name={opt === "publik" ? "earth" : opt === "teman" ? "account-multiple" : "lock"}
                        size={18}
                        color={isSelected ? "#FFFFFF" : "#94A3B8"}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.privacyOptionTitle}>
                          {opt === "publik" ? "Publik" : opt === "teman" ? "Teman saja" : "Privat"}
                        </Text>
                        <Text style={styles.privacyOptionDesc}>
                          {opt === "publik"
                            ? "Semua orang bisa melihat daftar bond kamu."
                            : opt === "teman"
                            ? "Hanya teman yang bisa melihat bond kamu."
                            : "Tidak ada yang bisa melihat bond kamu."}
                        </Text>
                      </View>
                      {isSelected && <AppIcon name="check" size={18} color="#FFFFFF" />}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ─── MODAL: RIWAYAT SHEET (Persis D:\affinity\src\components\HistorySheet.tsx) ─── */}
      {isHistoryOpen && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setIsHistoryOpen(false)}>
          <View style={styles.sheetOverlay}>
            <View style={styles.sheetContent}>
              <View style={styles.sheetDragHandle} />

              <View style={styles.sheetTopRow}>
                <View>
                  <Text style={styles.sheetTitle}>Riwayat Ajakan</Text>
                  <Text style={styles.sheetSubText}>
                    Ajakan yang dibatalkan/ditolak/kedaluwarsa & bond yang berakhir.
                  </Text>
                </View>
                <Pressable onPress={() => setIsHistoryOpen(false)} style={styles.sheetCloseBtn}>
                  <AppIcon name="close" size={18} color="#94A3B8" />
                </Pressable>
              </View>

              {/* Category Filter Tabs */}
              <View style={styles.historyCategoryRow}>
                {(["dibatalkan", "ditolak", "kedaluwarsa", "putus"] as HistoryCategory[]).map((cat) => {
                  const isSelected = historyFilterCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setHistoryFilterCategory(cat)}
                      style={[styles.historyCatTab, isSelected && styles.historyCatTabActive]}
                    >
                      <Text style={[styles.historyCatText, isSelected && styles.historyCatTextActive]}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <ScrollView style={{ maxHeight: 300 }}>
                {loadingHistory ? (
                  <View style={{ paddingVertical: 24, alignItems: "center", gap: 8 }}>
                    <ActivityIndicator size="small" color="#38BDF8" />
                    <Text style={{ fontSize: 12, color: "#94A3B8" }}>Memuat riwayat...</Text>
                  </View>
                ) : filteredHistory.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: "center" }}>
                    <Text style={{ fontSize: 12, color: "#64748B" }}>
                      Tidak ada riwayat untuk kategori ini.
                    </Text>
                  </View>
                ) : (
                  filteredHistory.map((item) => (
                    <View key={item.id} style={styles.historyRowItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyFriendName}>{item.friend.name}</Text>
                        <Text style={styles.historyReasonText}>{item.reason}</Text>
                        <Text style={styles.historyTimeText}>{item.timestamp}</Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ─── STYLES ───
const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#0A0D14",
  },
  // TopBar
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(10, 13, 20, 0.95)",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1.5,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  privacyBtn: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    backgroundColor: "#11151E",
  },
  privacyBtnText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#E2E8F0",
  },
  btnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  // Body Scroll
  bodyScroll: {
    flex: 1,
  },
  bodyScrollContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 12,
  },
  // Orbital Bond Graph
  constellationCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    backgroundColor: "#11151E",
    padding: 16,
  },
  constellationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    paddingBottom: 12,
  },
  constellationName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  constellationHandle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  totalBondLabel: {
    fontSize: 11,
    color: "#94A3B8",
  },
  totalBondCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 2,
  },
  canvasContainer: {
    width: "100%",
    aspectRatio: CONSTELLATION_WIDTH / CONSTELLATION_HEIGHT,
    position: "relative",
    marginTop: 8,
  },
  svgAbsolute: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  coreNode: {
    position: "absolute",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    transform: [{ translateX: -CORE_RADIUS }, { translateY: -CORE_RADIUS }],
  },
  tierCrestNode: {
    position: "absolute",
    width: TIER_CREST_SIZE,
    height: TIER_CREST_SIZE,
    borderRadius: TIER_CREST_RADIUS,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.28)",
    backgroundColor: "#181E2B",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -TIER_CREST_RADIUS }, { translateY: -TIER_CREST_RADIUS }],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  tierCrestImg: {
    width: TIER_ICON_SIZE,
    height: TIER_ICON_SIZE,
  },
  satelliteNode: {
    position: "absolute",
    width: SATELLITE_SIZE,
    height: SATELLITE_SIZE,
    borderRadius: SATELLITE_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    transform: [{ translateX: -SATELLITE_RADIUS }, { translateY: -SATELLITE_RADIUS }],
  },
  satelliteBondWrap: {
    width: SATELLITE_SIZE,
    height: SATELLITE_SIZE,
    borderRadius: SATELLITE_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  satLevelPill: {
    position: "absolute",
    bottom: -6,
    alignSelf: "center",
    backgroundColor: "#0A0D14",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  satLevelText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#F1F5F9",
  },
  satellitePendingWrap: {
    width: SATELLITE_SIZE,
    height: SATELLITE_SIZE,
    borderRadius: SATELLITE_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  satClockWrap: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#0A0D14",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  satelliteEmptyWrap: {
    width: SATELLITE_SIZE,
    height: SATELLITE_SIZE,
    borderRadius: SATELLITE_RADIUS,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderStyle: "dashed",
    backgroundColor: "#181E2B",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImgFull: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholderFull: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  coreInitialText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  satInitialText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Tier List Panel
  tierPanelWrap: {
    gap: 12,
  },
  segmentedDock: {
    flexDirection: "row",
    backgroundColor: "#11151E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  segmentedTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 4,
  },
  segmentedTabSelected: {
    backgroundColor: "#1D2433",
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  segmentedIcon: {
    width: 20,
    height: 20,
  },
  segmentedLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  segmentedLabelSelected: {
    color: "#FFFFFF",
  },
  segmentedLabelMuted: {
    color: "#94A3B8",
  },
  segmentedCount: {
    fontSize: 10,
    fontWeight: "500",
  },
  segmentedCountSelected: {
    color: "#E2E8F0",
  },
  segmentedCountMuted: {
    color: "#64748B",
  },
  // Active Tier Card
  activeTierCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    backgroundColor: "#11151E",
    overflow: "hidden",
  },
  activeTierHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  activeTierTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  activeTierSub: {
    fontSize: 12,
    color: "#64748B",
  },
  activeTierDesc: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
    lineHeight: 16,
  },
  activeTierRatio: {
    fontSize: 12,
    fontWeight: "600",
    color: "#CBD5E1",
  },
  hairlineList: {
    // Divider via borderBottom on items
  },
  bondListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  pendingListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  itemPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  listAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  listAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  listAvatarInitial: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  listBondTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  listBondName: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#FFFFFF",
    flex: 1,
  },
  listBondStats: {
    fontSize: 12,
    color: "#94A3B8",
  },
  listProgressBarBg: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  },
  listProgressBarFill: {
    height: "100%",
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
  },
  pendingTimeText: {
    fontSize: 12,
    color: "rgba(252, 211, 77, 0.9)",
  },
  acceptPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  acceptPillText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#0A0D14",
  },
  cancelPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cancelPillText: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#CBD5E1",
  },
  emptyStateBox: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 12,
    color: "#94A3B8",
  },
  tierFooterAction: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "#0D1018",
    padding: 12,
  },
  primaryWhiteBtn: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    gap: 8,
  },
  primaryWhiteBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#0A0D14",
  },
  greetedDisabledBtn: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 8,
  },
  greetedDisabledText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
  tierFullText: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
    paddingVertical: 6,
  },
  // Top Afinitas (Leaderboard - Identik Screenshot)
  leaderboardSub: {
    fontSize: 12.5,
    color: "#94A3B8",
    marginTop: 4,
    marginBottom: 4,
  },
  grid2x2Filter: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    marginBottom: 12,
  },
  gridFilterTab: {
    width: "48.5%",
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "#11151E",
  },
  gridFilterTabActive: {
    borderColor: "rgba(255, 255, 255, 0.28)",
    backgroundColor: "#1D2433",
  },
  gridFilterIcon: {
    width: 18,
    height: 18,
  },
  gridFilterText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#94A3B8",
  },
  gridFilterTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  emptyLeaderboardCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "#11151E",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  emptyLeaderboardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 6,
  },
  emptyLeaderboardDesc: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
  },
  spotlightCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "#11151E",
    padding: 18,
    marginBottom: 14,
  },
  spotlightTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  duoOverlapRow: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "visible",
  },
  spotlightAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: "#11151E",
    alignItems: "center",
    justifyContent: "center",
  },
  spotlightInitial: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  spotlightInfoCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rank1BadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  rank1BadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#38BDF8",
  },
  spotlightDuoNames: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  spotlightLevelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  spotlightTierIcon: {
    width: 14,
    height: 14,
  },
  spotlightLevelText: {
    fontSize: 12,
    color: "#CBD5E1",
    fontWeight: "500",
  },
  spotlightBottomRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 20,
  },
  totalAfinitasLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#38BDF8",
  },
  totalAfinitasValRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  totalAfinitasNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  totalAfinitasXpText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  spotlightDividerBar: {
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 2,
    marginTop: 14,
    width: "100%",
  },
  restEntriesCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "#11151E",
    overflow: "hidden",
    marginBottom: 20,
  },
  restEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    gap: 12,
  },
  restRankNumber: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#38BDF8",
    width: 26,
  },
  duoMiniOverlap: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "visible",
  },
  miniAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#11151E",
    alignItems: "center",
    justifyContent: "center",
  },
  miniInitial: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  restNameCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  restNames: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  restLevelText: {
    fontSize: 12,
    color: "#94A3B8",
  },
  restXpCol: {
    alignItems: "flex-end",
  },
  restXpNumber: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  restXpSub: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "700",
    marginTop: 1,
  },
  // Modal / Bottom Sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  sheetContent: {
    backgroundColor: "#11151E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  sheetDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sheetSubText: {
    fontSize: 12,
    color: "#94A3B8",
  },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  sheetAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetAvatarInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sheetSummaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    backgroundColor: "#0D1018",
    padding: 14,
    gap: 10,
  },
  summaryLvText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  summaryXpText: {
    fontSize: 12,
    color: "#CBD5E1",
  },
  summaryBarBg: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  summaryBarFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 3,
  },
  summaryInteraksiText: {
    fontSize: 11,
    color: "#94A3B8",
  },
  summaryIntoLvText: {
    fontSize: 11,
    color: "#94A3B8",
  },
  unlinkBtn: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    gap: 8,
  },
  unlinkBtnText: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#FB7185",
  },
  confirmEndCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.3)",
    backgroundColor: "#171118",
    padding: 14,
  },
  confirmEndDesc: {
    fontSize: 12,
    color: "#E2E8F0",
    lineHeight: 18,
  },
  cancelEndBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "#181E2B",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelEndBtnText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#E2E8F0",
  },
  doEndBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#E11D48",
    alignItems: "center",
    justifyContent: "center",
  },
  doEndBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Invite Modal
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#181E2B",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#FFFFFF",
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
    gap: 12,
    overflow: "visible",
  },
  friendAvatarWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    marginLeft: 4,
  },
  friendBioText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  invitePillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  invitePillText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#0A0D14",
  },
  inviteStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inviteBadgeDefault: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  inviteBadgeWarning: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.28)",
  },
  inviteBadgeDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
  },
  inviteBadgeTextDefault: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
  },
  inviteBadgeTextWarning: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FCD34D",
  },
  inviteBadgeTextDanger: {
    fontSize: 11,
    fontWeight: "600",
    color: "#F87171",
  },
  emptyFriendsBox: {
    paddingVertical: 28,
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyFriendsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyFriendsSub: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
  },
  // Privacy Sheet
  privacyOptionContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    backgroundColor: "#0D1018",
    overflow: "hidden",
  },
  privacyRowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  privacyRowItemActive: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  privacyOptionTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  privacyOptionDesc: {
    fontSize: 11.5,
    color: "#94A3B8",
    marginTop: 2,
  },
  // History Sheet
  historyCategoryRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
  },
  historyCatTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    backgroundColor: "#181E2B",
  },
  historyCatTabActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  historyCatText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
  },
  historyCatTextActive: {
    color: "#0A0D14",
  },
  historyRowItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  historyFriendName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  historyReasonText: {
    fontSize: 11.5,
    color: "#CBD5E1",
    marginTop: 2,
  },
  historyTimeText: {
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 3,
  },
});
