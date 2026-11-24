import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ActivityIndicator,
  Modal,
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
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import {
  getRealTopAffinityLeaderboard,
  type RealLeaderboardItem,
} from "@/lib/affinity-service";
import type { TierId } from "@/app/affinity";

export interface AffinityTierCardConfig {
  id: TierId;
  label: string;
  headerTitle: string;
  color: string;
  glowColor: string;
  borderColor: string;
  bgGradient: string;
  icon: any;
  headerIcon: string;
}

export const AFFINITY_TIERS: AffinityTierCardConfig[] = [
  {
    id: "pasangan",
    label: "Pasangan",
    headerTitle: "PASANGAN TERBAIK",
    color: "#F43F5E",
    glowColor: "#FDA4AF",
    borderColor: "rgba(244, 63, 94, 0.65)",
    bgGradient: "rgba(244, 63, 94, 0.09)",
    icon: require("@/assets/images/affinity/pasangan.png"),
    headerIcon: "heart",
  },
  {
    id: "orang_kepercayaan",
    label: "Kepercayaan",
    headerTitle: "KEPERCAYAAN TERBAIK",
    color: "#F59E0B",
    glowColor: "#FDE68A",
    borderColor: "rgba(245, 158, 11, 0.65)",
    bgGradient: "rgba(245, 158, 11, 0.09)",
    icon: require("@/assets/images/affinity/orang_kepercayaan.png"),
    headerIcon: "hand-heart",
  },
  {
    id: "sahabat",
    label: "Sahabat",
    headerTitle: "SAHABAT TERBAIK",
    color: "#EC4899",
    glowColor: "#FBCFE8",
    borderColor: "rgba(236, 72, 153, 0.65)",
    bgGradient: "rgba(236, 72, 153, 0.09)",
    icon: require("@/assets/images/affinity/sahabat.png"),
    headerIcon: "star-four-points",
  },
  {
    id: "saudara",
    label: "Saudara",
    headerTitle: "SAUDARA TERBAIK",
    color: "#06B6D4",
    glowColor: "#A5F3FC",
    borderColor: "rgba(6, 182, 212, 0.65)",
    bgGradient: "rgba(6, 182, 212, 0.09)",
    icon: require("@/assets/images/affinity/saudara.png"),
    headerIcon: "shield-star",
  },
];

export const HomeTopAffinityCard = React.memo(function HomeTopAffinityCard({
  isActive = true,
}: {
  isActive?: boolean;
}) {
  const queryClient = useQueryClient();
  const lastInvalidateRef = useRef(0);
  const [activeTierIndex, setActiveTierIndex] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const activeTier = AFFINITY_TIERS[activeTierIndex] || AFFINITY_TIERS[0];

  // 1. Ambil data Top #1 Duo untuk semua 4 Tier secara real dari Supabase
  const { data: topDuos, isLoading } = useQuery({
    queryKey: ["home-top-affinity-duos"],
    queryFn: async () => {
      try {
        const [pasangan, kepercayaan, sahabat, saudara] = await Promise.all([
          getRealTopAffinityLeaderboard("pasangan"),
          getRealTopAffinityLeaderboard("orang_kepercayaan"),
          getRealTopAffinityLeaderboard("sahabat"),
          getRealTopAffinityLeaderboard("saudara"),
        ]);
        return {
          pasangan: pasangan[0] || null,
          orang_kepercayaan: kepercayaan[0] || null,
          sahabat: sahabat[0] || null,
          saudara: saudara[0] || null,
        };
      } catch {
        return {
          pasangan: null,
          orang_kepercayaan: null,
          sahabat: null,
          saudara: null,
        };
      }
    },
    staleTime: 60_000,
    retry: 2,
  });

  // 2. Realtime listener Supabase untuk update seketika saat ada interaksi afinitas (dithrottle min 20 detik)
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;
    const channelName = `home-top-affinity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const throttledInvalidate = () => {
      if (!isMounted) return;
      const now = Date.now();
      if (now - lastInvalidateRef.current < 20_000) return;
      lastInvalidateRef.current = now;
      queryClient.invalidateQueries({ queryKey: ["home-top-affinity-duos"] });
    };

    try {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_affinity_bonds" },
          throttledInvalidate
        )
        .subscribe();
    } catch (err) {
      console.warn("[home-affinity] Supabase realtime subscription warning:", err);
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

  // 3. Auto-slide setiap 5 detik HANYA jika kartu sedang aktif terlihat (cegah re-render CPU di background)
  useEffect(() => {
    if (isDropdownOpen || !isActive) return;
    const timer = setInterval(() => {
      setActiveTierIndex((prev) => (prev + 1) % AFFINITY_TIERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isDropdownOpen, isActive]);

  const currentDuo: RealLeaderboardItem | null = topDuos ? topDuos[activeTier.id] : null;

  const handleOpenAffinity = () => {
    hapticLight();
    router.push({
      pathname: "/affinity",
      params: {
        view: "leaderboard",
        mode: "leaderboard",
        screen: "leaderboard",
        tier: activeTier.id,
      },
    } as never);
  };

  const handleSelectTier = (idx: number) => {
    hapticSuccess();
    setActiveTierIndex(idx);
    setIsDropdownOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.cardContainer,
          {
            borderColor: activeTier.borderColor,
            backgroundColor: "#111422",
          },
        ]}
      >
        {/* Subtle Background Glow Tint */}
        <View
          style={[
            styles.bgGlowLayer,
            { backgroundColor: activeTier.bgGradient },
          ]}
        />

        {/* ─── HEADER: TITLE & TIER DROPDOWN BUTTON ─── */}
        <View style={styles.headerRow}>
          {/* Header Title (Kiri) - Tekan untuk membuka leaderboard afinitas */}
          <Pressable
            onPress={handleOpenAffinity}
            style={({ pressed }) => [styles.headerTitleGroup, pressed && { opacity: 0.8 }]}
            hitSlop={8}
          >
            <Text style={[styles.headerTitleText, { color: activeTier.color }]}>
              {activeTier.headerTitle}
            </Text>
          </Pressable>

          {/* Tombol Pilihan Tier (Pojok Kanan Atas - Sesuai Permintaan) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Pilih Tier Afinitas: ${activeTier.label}`}
            onPress={() => {
              hapticLight();
              setIsDropdownOpen(true);
            }}
            style={({ pressed }) => [
              styles.tierDropdownBtn,
              { borderColor: activeTier.borderColor },
              pressed && styles.btnPressed,
            ]}
            hitSlop={6}
          >
            <Image
              source={activeTier.icon}
              style={styles.tierDropdownIcon}
              contentFit="contain"
            />
            <Text style={styles.tierDropdownText}>{activeTier.label}</Text>
            <AppIcon name="chevron-down" size={12} color="#CBD5E1" />
          </Pressable>
        </View>

        {/* ─── BODY: DUO AVATARS & CENTER ICON (NO BACKGROUND DISC) ─── */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={activeTier.color} />
          </View>
        ) : currentDuo ? (
          <Pressable
            onPress={handleOpenAffinity}
            style={({ pressed }) => [styles.bodyContent, pressed && styles.cardPressed]}
          >
            {/* Duos Row: Avatar A ── Center Icon (Murni tanpa background) ── Avatar B */}
            <View style={styles.avatarsRow}>
              {/* User A Avatar */}
              <View style={styles.avatarWrap}>
                <BorderAvatar
                  size={52}
                  avatarUrl={currentDuo.userA.avatarUrl}
                  borderId={currentDuo.userA.equippedBorder}
                  fallbackText={currentDuo.userA.name}
                  disabled
                />
              </View>

              {/* Center Tier Icon Murni Tanpa Background Apapun */}
              <View style={styles.centerIconWrapper}>
                <Image
                  source={activeTier.icon}
                  style={styles.centerIconImg}
                  contentFit="contain"
                />
              </View>

              {/* User B Avatar */}
              <View style={styles.avatarWrap}>
                <BorderAvatar
                  size={52}
                  avatarUrl={currentDuo.userB.avatarUrl}
                  borderId={currentDuo.userB.equippedBorder}
                  fallbackText={currentDuo.userB.name}
                  disabled
                />
              </View>
            </View>

            {/* Duo Title (Nama Bersih tanpa emoji mahkota) */}
            <View style={styles.duoTitleRow}>
              <Text style={styles.duoTitleText} numberOfLines={1}>
                {currentDuo.duoTitle}
              </Text>
            </View>

            {/* Stats Row: Bond Lv + XP (Bersih & Elegan Sesuai Mockup) */}
            <View style={styles.statsRow}>
              <View style={[styles.statsLvBadge, { borderColor: `${activeTier.color}80`, backgroundColor: `${activeTier.color}15` }]}>
                <Text style={[styles.statsLvText, { color: activeTier.color }]}>
                  Bond Lv {currentDuo.level}
                </Text>
              </View>
              <Text style={styles.statsXpText}>
                {Number(currentDuo.xp).toLocaleString("id-ID")} XP
              </Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleOpenAffinity}
            style={({ pressed }) => [styles.emptyDuoBox, pressed && styles.cardPressed]}
          >
            <View style={styles.emptyAvatarsRow}>
              <View style={[styles.emptyAvatarCircle, { borderColor: activeTier.borderColor }]}>
                <AppIcon name="account" size={24} color="#64748B" />
              </View>
              <Image source={activeTier.icon} style={styles.centerIconImg} contentFit="contain" />
              <View style={[styles.emptyAvatarCircle, { borderColor: activeTier.borderColor }]}>
                <AppIcon name="plus" size={24} color="#64748B" />
              </View>
            </View>
            <Text style={styles.emptyTitleText}>
              Belum ada ikatan terhubung di {activeTier.label}
            </Text>
            <View style={[styles.emptyCtaPill, { borderColor: activeTier.color }]}>
              <Text style={[styles.emptyCtaText, { color: activeTier.color }]}>
                Lihat Top Afinitas &gt;
              </Text>
            </View>
          </Pressable>
        )}

        {/* ─── CAROUSEL DOTS (Menunjukkan Slide Tier yang Sedang Aktif) ─── */}
        <View style={styles.dotsRow}>
          {AFFINITY_TIERS.map((tier, idx) => {
            const isSelected = idx === activeTierIndex;
            return (
              <Pressable
                key={tier.id}
                onPress={() => handleSelectTier(idx)}
                hitSlop={8}
                style={[
                  styles.dotItem,
                  isSelected
                    ? [styles.dotActive, { backgroundColor: tier.color }]
                    : styles.dotInactive,
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* ─── MODAL DROPDOWN PILIHAN TIER (4 Opsi: Pasangan, Kepercayaan, Sahabat, Saudara) ─── */}
      {isDropdownOpen && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setIsDropdownOpen(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setIsDropdownOpen(false)}
          >
            <View style={styles.dropdownSheet}>
              {/* Header */}
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>Pilih Tier Afinitas</Text>
                <Pressable
                  onPress={() => setIsDropdownOpen(false)}
                  style={styles.dropdownCloseBtn}
                  hitSlop={8}
                >
                  <AppIcon name="close" size={18} color="#94A3B8" />
                </Pressable>
              </View>

              {/* 4 Opsi Tier */}
              <View style={styles.tierOptionsList}>
                {AFFINITY_TIERS.map((tier, idx) => {
                  const isSelected = idx === activeTierIndex;
                  return (
                    <Pressable
                      key={tier.id}
                      onPress={() => handleSelectTier(idx)}
                      style={({ pressed }) => [
                        styles.tierOptionItem,
                        isSelected && [
                          styles.tierOptionActive,
                          { borderColor: tier.borderColor },
                        ],
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <Image source={tier.icon} style={styles.optionTierIcon} contentFit="contain" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionTierTitle, isSelected && { color: tier.color }]}>
                          {tier.label}
                        </Text>
                        <Text style={styles.optionTierSub}>{tier.headerTitle}</Text>
                      </View>
                      {isSelected && (
                        <View style={[styles.optionCheckBadge, { backgroundColor: tier.color }]}>
                          <AppIcon name="check" size={14} color="#0A0D14" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  cardContainer: {
    backgroundColor: "#131A29",
    width: "100%",
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: "hidden",
    position: "relative",
    padding: 14,
    minHeight: 245,
    justifyContent: "space-between",
    gap: 8,
    ...(Platform.OS === "web"
      ? ({
        cursor: "pointer",
      } as any)
      : {}),
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  bgGlowLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
  },

  // Header Row
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  headerTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitleText: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    letterSpacing: 0.8,
  },
  tierDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  tierDropdownIcon: {
    width: 14,
    height: 14,
  },
  tierDropdownText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },

  // Body Content
  loadingBox: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  bodyContent: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    zIndex: 2,
  },
  avatarsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  centerIconWrapper: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  centerIconImg: {
    width: 28,
    height: 28,
  },
  duoTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  duoTitleText: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 1,
  },
  statsLvBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statsLvText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
  },
  statsXpText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  // Empty Duo State
  emptyDuoBox: {
    alignItems: "center",
    paddingVertical: 14,
    gap: 8,
  },
  emptyAvatarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginBottom: 4,
  },
  emptyAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  emptyTitleText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#94A3B8",
  },
  emptyCtaPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  emptyCtaText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
  },

  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 4,
    zIndex: 2,
  },
  dotItem: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 18,
  },
  dotInactive: {
    width: 5,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },

  // Modal Dropdown Sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  dropdownSheet: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#11151E",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 16,
    gap: 12,
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    paddingBottom: 10,
  },
  dropdownTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  dropdownCloseBtn: {
    padding: 4,
  },
  tierOptionsList: {
    gap: 8,
  },
  tierOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  tierOptionActive: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
  },
  optionTierIcon: {
    width: 22,
    height: 22,
  },
  optionTierTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  optionTierSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  optionCheckBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});

