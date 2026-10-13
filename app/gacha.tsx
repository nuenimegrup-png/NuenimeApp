import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppIcon } from "@/components/app-icon";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  CRYSTAL_ICON,
  GACHA_BANNER_IMAGE,
  GACHA_SETTINGS,
  GACHA_ANIMATION_GIF,
  RARITY_CONFIG,
  WALLPAPER_CATALOG,
  WallpaperItem,
  WallpaperRarity,
} from "@/lib/gacha-data";
import {
  executeGachaSummon,
  getActiveWallpaperId,
  getCrystalBalance,
  getOwnedWallpaperIds,
  setActiveWallpaperId,
} from "@/lib/gacha-service";

export default function GachaScreen() {
  const auth = useAnirakuAuth();
  const { width: windowWidth } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);

  // ─── STATE ───
  const [crystalBalance, setCrystalBalance] = useState<number>(0);
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [activeWallpaperId, setActiveWallpaperIdState] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLocked, setShowLocked] = useState(true);

  // ─── TRANSACTION & ANIMATION STATES ───
  const [isSummoning, setIsSummoning] = useState(false);
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(false);
  const [animationResetKey, setAnimationResetKey] = useState<number>(0);
  const [showResultModal, setShowResultModal] = useState(false);
  const [gachaResults, setGachaResults] = useState<WallpaperItem[]>([]);
  const [lastSummonType, setLastSummonType] = useState<1 | 10>(1);

  const gifTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (gifTimerRef.current) clearTimeout(gifTimerRef.current);
    };
  }, []);

  // ─── BANNER CONFIRMATION MODAL ───
  const [previewItem, setPreviewItem] = useState<WallpaperItem | null>(null);
  const [isApplyingBanner, setIsApplyingBanner] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // ─── INFO MODAL ───
  const [showCrystalInfo, setShowCrystalInfo] = useState(false);

  // ─── INSUFFICIENT CRYSTAL MODAL ───
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [insufficientDetails, setInsufficientDetails] = useState<{ cost: number; count: 1 | 10 } | null>(null);

  // Responsive 2-column calculation
  const cardWidth = Math.floor((Math.min(windowWidth, 600) - 32 - 12) / 2);

  // ─── INITIAL LOAD ───
  const loadData = useCallback(async () => {
    try {
      const balance = await getCrystalBalance();
      setCrystalBalance(balance);

      const owned = await getOwnedWallpaperIds();
      // If user has no wallpapers yet, grant default normal wallpaper as starter
      if (owned.length === 0) {
        const starter = ["naruto_ramen"];
        await AsyncStorage.setItem("nuenime.owned.wallpapers", JSON.stringify(starter));
        setOwnedIds(starter);
      } else {
        setOwnedIds(owned);
      }

      // Sync active equipped wallpaper (either from profile.banner_url or storage)
      const localActive = await getActiveWallpaperId();
      if (auth.profile?.banner_url) {
        const matching = WALLPAPER_CATALOG.find((w) => w.image === auth.profile?.banner_url);
        if (matching) {
          setActiveWallpaperIdState(matching.id);
        } else if (localActive) {
          setActiveWallpaperIdState(localActive);
        }
      } else if (localActive) {
        setActiveWallpaperIdState(localActive);
      }
    } catch {}
  }, [auth.profile?.banner_url]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setFeedbackToast({ message, type });
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // ─── SUMMON HANDLERS ───
  const handleStartSummon = async (count: 1 | 10) => {
    if (isSummoning || isAnimationPlaying) return;

    const cost = count === 1 ? GACHA_SETTINGS.cost1x : GACHA_SETTINGS.cost10x;
    if (crystalBalance < cost) {
      hapticWarning();
      setInsufficientDetails({ cost, count });
      setShowInsufficientModal(true);
      showToast(`Crystal tidak cukup! Silakan top up untuk melakukan gacha lagi.`, "error");
      return;
    }

    hapticLight();
    setIsSummoning(true);
    setLastSummonType(count);

    try {
      // 1. Process transaction safely & atomic
      const result = await executeGachaSummon(count);
      if (!result.success) {
        setIsSummoning(false);
        Alert.alert("Gagal Summon", result.error || "Terjadi kesalahan saat memproses gacha.");
        return;
      }

      // Update state data immediately in memory
      setCrystalBalance(result.newBalance);
      setGachaResults(result.results);
      const updatedOwned = await getOwnedWallpaperIds();
      setOwnedIds(updatedOwned);

      // 2. Play GIF animation: reset key to restart GIF from frame 0
      setAnimationResetKey((prev) => prev + 1);
      setIsAnimationPlaying(true);

      // 3. Timer 3 detik untuk durasi animasi GIF sebelum reveal hasil gacha
      if (gifTimerRef.current) clearTimeout(gifTimerRef.current);
      gifTimerRef.current = setTimeout(() => {
        setIsAnimationPlaying(false);
        setIsSummoning(false);
        hapticSuccess();
        setShowResultModal(true);
      }, GACHA_SETTINGS.gifDurationMs);
    } catch (err: any) {
      if (gifTimerRef.current) clearTimeout(gifTimerRef.current);
      setIsSummoning(false);
      setIsAnimationPlaying(false);
      Alert.alert("Error", err?.message || "Gagal melakukan gacha");
    }
  };

  // ─── APPLY WALLPAPER AS PROFILE BANNER ───
  const handleConfirmApplyBanner = async () => {
    if (!previewItem) return;
    const isOwned = ownedIds.includes(previewItem.id);
    if (!isOwned) {
      hapticWarning();
      Alert.alert("Wallpaper Terkunci", "Kamu belum memiliki wallpaper ini. Lakukan Summon untuk membukanya!");
      return;
    }

    setIsApplyingBanner(true);
    try {
      // 1. Persist to active wallpaper
      await setActiveWallpaperId(previewItem.id);
      setActiveWallpaperIdState(previewItem.id);

      // 2. Persist to Supabase user profile banner_url
      if (auth.user) {
        await auth.updateProfile({ banner_url: previewItem.image });
      }

      hapticSuccess();
      showToast(`Wallpaper "${previewItem.name}" berhasil diterapkan sebagai banner profil!`, "success");
      setPreviewItem(null);
    } catch (err: any) {
      hapticWarning();
      Alert.alert("Gagal Menerapkan", err?.message || "Terjadi kesalahan saat menyimpan banner profil.");
    } finally {
      setIsApplyingBanner(false);
    }
  };

  // ─── FILTERED WALLPAPERS ───
  const filteredWallpapers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return WALLPAPER_CATALOG.filter((item) => {
      // Filter by search query
      if (q && !item.name.toLowerCase().includes(q) && !item.anime.toLowerCase().includes(q)) {
        return false;
      }
      // Filter by locked visibility
      const isOwned = ownedIds.includes(item.id);
      if (!showLocked && !isOwned) {
        return false;
      }
      return true;
    });
  }, [searchQuery, showLocked, ownedIds]);

  // Group wallpapers by rarity in order: Mythic, Legendary, Epic, Rare, Normal
  const rarityGroups: WallpaperRarity[] = ["Mythic", "Legendary", "Epic", "Rare", "Normal"];

  return (
    <View style={styles.container}>
      {/* ─── FEEDBACK TOAST ─── */}
      {feedbackToast && (
        <View
          style={[
            styles.toastBox,
            feedbackToast.type === "error" ? styles.toastError : styles.toastSuccess,
          ]}
        >
          <AppIcon
            name={feedbackToast.type === "error" ? "alert-circle" : "check-circle"}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.toastText}>{feedbackToast.message}</Text>
        </View>
      )}

      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        {/* ─── 1. TOP HEADER (SESUAI SCREENSHOT: BACK + NUENIME GACHA) ─── */}
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            onPress={() => {
              hapticLight();
              router.back();
            }}
            style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
            hitSlop={12}
          >
            <AppIcon name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.headerTitle}>Nuenime Gacha</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── 2. BANNER ILUSTRASI GACHA (SESUAI SCREENSHOT) ─── */}
          <View style={styles.bannerContainer}>
            <Image
              source={GACHA_BANNER_IMAGE}
              style={styles.bannerImage}
              contentFit="cover"
              autoplay
              transition={200}
            />
            {/* Subtle inner dark gradient for contrast */}
            <LinearGradient
              colors={["transparent", "rgba(10, 14, 23, 0.45)"]}
              style={StyleSheet.absoluteFillObject}
            />
          </View>

          {/* ─── 3. TOMBOL SUMMON 1X & SUMMON 10X (SESUAI SCREENSHOT) ─── */}
          <View style={styles.summonButtonsRow}>
            {/* Summon 1x (Navy/Slate button) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Summon 1x, biaya ${GACHA_SETTINGS.cost1x} Daylan Crystal`}
              disabled={isSummoning}
              onPress={() => handleStartSummon(1)}
              style={({ pressed }) => [
                styles.summonBtn,
                styles.summonBtn1x,
                pressed && styles.btnPressed,
                isSummoning && styles.btnDisabled,
              ]}
            >
              <Text style={styles.summonTitle1x}>Summon 1x</Text>
              <View style={styles.summonCostPill}>
                <Image source={CRYSTAL_ICON} style={styles.btnCrystalIcon} contentFit="contain" />
                <Text style={styles.summonCostText1x}>{GACHA_SETTINGS.cost1x.toLocaleString()}</Text>
              </View>
            </Pressable>

            {/* Summon 10x (Warm Gold button) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Summon 10x, biaya ${GACHA_SETTINGS.cost10x} Daylan Crystal`}
              disabled={isSummoning}
              onPress={() => handleStartSummon(10)}
              style={({ pressed }) => [
                styles.summonBtn,
                styles.summonBtn10x,
                pressed && styles.btnPressed,
                isSummoning && styles.btnDisabled,
              ]}
            >
              <Text style={styles.summonTitle10x}>Summon 10x</Text>
              <View style={styles.summonCostPill}>
                <Image source={CRYSTAL_ICON} style={styles.btnCrystalIcon} contentFit="contain" />
                <Text style={styles.summonCostText10x}>{GACHA_SETTINGS.cost10x.toLocaleString()}</Text>
              </View>
            </Pressable>
          </View>

          {/* ─── 4. CARA MENDAPATKAN DAYLAN CRYSTAL (SESUAI SCREENSHOT) ─── */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cara mendapatkan Daylan Crystal"
            onPress={() => setShowCrystalInfo(true)}
            style={({ pressed }) => [styles.infoCard, pressed && styles.btnPressed]}
          >
            <View style={styles.infoCardLeft}>
              <Image source={CRYSTAL_ICON} style={styles.infoCrystalIcon} contentFit="contain" />
              <Text style={styles.infoCardTitle}>Cara mendapatkan Daylan Crystal</Text>
            </View>
            <View style={styles.infoCardRight}>
              <Text style={styles.infoCardLink}>Lihat info</Text>
              <AppIcon name="arrow-right" size={14} color="#38BDF8" />
            </View>
          </Pressable>

          {/* ─── 5. BONUS EXP WALLPAPER CARD (SESUAI SCREENSHOT) ─── */}
          <View style={styles.expBonusCard}>
            <Text style={styles.expBonusTitle}>Bonus EXP Wallpaper</Text>
            <Text style={styles.expBonusSubtitle}>
              Hanya wallpaper yang sedang dipakai yang memberi bonus.
            </Text>

            {/* Row 1: Mythic */}
            <View style={styles.expPillRow}>
              <View style={[styles.rarityPill, { borderColor: RARITY_CONFIG.Mythic.borderColor }]}>
                <Text style={[styles.rarityPillText, { color: RARITY_CONFIG.Mythic.color }]}>
                  Mythic
                </Text>
              </View>
              <Text style={styles.expPercentText}>+25%</Text>
            </View>

            {/* Row 2: Legendary & Epic */}
            <View style={styles.expPillGridRow}>
              <View style={styles.expPillItem}>
                <View style={[styles.rarityPill, { borderColor: RARITY_CONFIG.Legendary.borderColor }]}>
                  <Text style={[styles.rarityPillText, { color: RARITY_CONFIG.Legendary.color }]}>
                    Legendary
                  </Text>
                </View>
                <Text style={styles.expPercentText}>+20%</Text>
              </View>

              <View style={styles.expPillItem}>
                <View style={[styles.rarityPill, { borderColor: RARITY_CONFIG.Epic.borderColor }]}>
                  <Text style={[styles.rarityPillText, { color: RARITY_CONFIG.Epic.color }]}>
                    Epic
                  </Text>
                </View>
                <Text style={styles.expPercentText}>+15%</Text>
              </View>
            </View>

            {/* Row 3: Rare & Normal */}
            <View style={styles.expPillGridRow}>
              <View style={styles.expPillItem}>
                <View style={[styles.rarityPill, { borderColor: RARITY_CONFIG.Rare.borderColor }]}>
                  <Text style={[styles.rarityPillText, { color: RARITY_CONFIG.Rare.color }]}>
                    Rare
                  </Text>
                </View>
                <Text style={styles.expPercentText}>+10%</Text>
              </View>

              <View style={styles.expPillItem}>
                <View style={[styles.rarityPill, { borderColor: RARITY_CONFIG.Normal.borderColor }]}>
                  <Text style={[styles.rarityPillText, { color: RARITY_CONFIG.Normal.color }]}>
                    Normal
                  </Text>
                </View>
                <Text style={styles.expPercentText}>+5%</Text>
              </View>
            </View>
          </View>

          {/* ─── 6. KOLEKSI SECTION HEADER & TOGGLE TERKUNCI (SESUAI SCREENSHOT) ─── */}
          <View style={styles.koleksiHeaderRow}>
            <Text style={styles.koleksiTitle}>Koleksi</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showLocked ? "Sembunyikan wallpaper terkunci" : "Tampilkan wallpaper terkunci"}
              onPress={() => {
                hapticLight();
                setShowLocked((prev) => !prev);
              }}
              style={({ pressed }) => [styles.toggleLockedBtn, pressed && styles.btnPressed]}
            >
              <AppIcon
                name={showLocked ? "eye-outline" : "eye-off-outline"}
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.toggleLockedText}>
                {showLocked ? "Tampilkan terkunci" : "Hanya milik saya"}
              </Text>
            </Pressable>
          </View>

          {/* ─── 7. SEARCH INPUT (SESUAI SCREENSHOT) ─── */}
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Cari koleksi wallpaper"
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery("")}
                hitSlop={8}
                style={styles.clearSearchBtn}
              >
                <AppIcon name="close" size={16} color="#94A3B8" />
              </Pressable>
            )}
          </View>

          {/* ─── 8. WALLPAPER GROUPS BY RARITY ─── */}
          {rarityGroups.map((rarityKey) => {
            const config = RARITY_CONFIG[rarityKey];
            const groupAllItems = WALLPAPER_CATALOG.filter((w) => w.rarity === rarityKey);
            const groupVisibleItems = filteredWallpapers.filter((w) => w.rarity === rarityKey);

            if (groupVisibleItems.length === 0) return null;

            const ownedInGroup = groupAllItems.filter((w) => ownedIds.includes(w.id)).length;
            const totalInGroup = groupAllItems.length;

            return (
              <View key={rarityKey} style={styles.rarityGroupContainer}>
                {/* Rarity Section Header Bar */}
                <View
                  style={[
                    styles.rarityGroupHeader,
                    { borderColor: config.borderColor },
                  ]}
                >
                  <View style={styles.rarityGroupLeft}>
                    <View
                      style={[
                        styles.rarityVerticalBar,
                        { backgroundColor: config.color },
                      ]}
                    />
                    <Text style={styles.rarityGroupTitle}>{config.label}</Text>
                  </View>

                  <View
                    style={[
                      styles.rarityGroupBadge,
                      { borderColor: config.borderColor },
                    ]}
                  >
                    <Text style={[styles.rarityGroupBadgeText, { color: config.color }]}>
                      +{config.expBonus}% EXP · {ownedInGroup}/{totalInGroup} items
                    </Text>
                  </View>
                </View>

                {/* 2-Column Grid */}
                <View style={styles.wallpaperGrid}>
                  {groupVisibleItems.map((item) => {
                    const isOwned = ownedIds.includes(item.id);
                    const isEquipped = activeWallpaperId === item.id;

                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.wallpaperCard,
                          { width: cardWidth },
                          !isOwned && styles.wallpaperCardLocked,
                        ]}
                      >
                        {/* Wallpaper Image */}
                        <Image
                          source={{ uri: item.image }}
                          style={styles.wallpaperThumbnail}
                          contentFit="cover"
                          transition={200}
                        />

                        {/* Top dark gradient */}
                        <LinearGradient
                          colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0.2)", "transparent"]}
                          style={styles.wallpaperTopGradient}
                        />

                        {/* Title on image top left */}
                        <Text style={styles.wallpaperCardTitle} numberOfLines={1}>
                          {item.name}
                        </Text>

                        {/* Bottom action row */}
                        <View style={styles.wallpaperCardBottom}>
                          {isEquipped ? (
                            <View style={styles.equippedBadge}>
                              <AppIcon name="check" size={11} color="#10B981" />
                              <Text style={styles.equippedBadgeText}>Dipakai</Text>
                            </View>
                          ) : isOwned ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Pakai wallpaper ${item.name}`}
                              onPress={() => {
                                hapticLight();
                                setPreviewItem(item);
                              }}
                              style={({ pressed }) => [
                                styles.pakaiBtn,
                                pressed && styles.btnPressed,
                              ]}
                            >
                              <Text style={styles.pakaiBtnText}>Pakai</Text>
                            </Pressable>
                          ) : (
                            <View style={styles.lockedPill}>
                              <AppIcon name="lock" size={11} color="#94A3B8" />
                              <Text style={styles.lockedPillText}>Terkunci</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ─── 9. FLOATING BOTTOM CONTROLS (SESUAI SCREENSHOT) ─── */}
        <View style={styles.floatingControlsContainer} pointerEvents="box-none">
          {/* Scroll to Top */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scroll ke atas"
            onPress={() => {
              hapticLight();
              scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            }}
            style={({ pressed }) => [styles.floatingScrollTopBtn, pressed && styles.btnPressed]}
          >
            <AppIcon name="arrow-up" size={18} color="#FFFFFF" />
          </Pressable>

          {/* Floating Daylan Crystal Balance Pill */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Saldo: ${crystalBalance} Daylan Crystal. Klik untuk top up.`}
            onPress={() => {
              hapticLight();
              router.push("/topup" as never);
            }}
            style={({ pressed }) => [styles.floatingCrystalPill, pressed && styles.btnPressed]}
          >
            <Image source={CRYSTAL_ICON} style={styles.floatingCrystalIcon} contentFit="contain" />
            <Text style={styles.floatingCrystalText}>{crystalBalance.toLocaleString()}</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* ─── 10. GACHA ANIMATION OVERLAY (BAGIAN 5 & SESUAI KETENTUAN MUTLAK) ─── */}
      {/* Animasi GIF diputar apa adanya tanpa partikel, flash, glow, zoom, atau dekorasi tambahan */}
      <Modal visible={isAnimationPlaying} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.animationOverlayBackdrop}>
          <Image
            key={`gacha_gif_${animationResetKey}`}
            source={GACHA_ANIMATION_GIF}
            style={styles.animationPlayer}
            contentFit="contain"
            autoplay
          />
        </View>
      </Modal>

      {/* ─── 11. GACHA RESULT REVEAL MODAL (BAGIAN 6) ─── */}
      <Modal visible={showResultModal} transparent animationType="fade">
        <View style={styles.resultModalBackdrop}>
          <View style={styles.resultCardBox}>
            {/* Header info */}
            <View style={styles.resultHeader}>
              <Text style={styles.resultHeadline}>
                {lastSummonType === 1 ? "Hasil Summon" : "Hasil Summon 10x"}
              </Text>
              <Text style={styles.resultSubHeadline}>
                Wallpaper baru telah berhasil ditambahkan ke koleksi kamu!
              </Text>
            </View>

            {/* Results Display */}
            {lastSummonType === 1 && gachaResults.length > 0 ? (
              <View style={styles.singleResultContainer}>
                {(() => {
                  const item = gachaResults[0];
                  const cfg = RARITY_CONFIG[item.rarity];
                  return (
                    <View style={styles.singleResultCard}>
                      <View style={[styles.singleImageWrapper, { borderColor: cfg.borderColor }]}>
                        <Image
                          source={{ uri: item.image }}
                          style={styles.singleResultImage}
                          contentFit="cover"
                        />
                        <View style={[styles.singleRarityBadge, { backgroundColor: cfg.color }]}>
                          <Text style={styles.singleRarityBadgeText}>{item.rarity}</Text>
                        </View>
                      </View>

                      <Text style={styles.singleItemName}>{item.name}</Text>
                      <Text style={styles.singleItemAnime}>{item.anime}</Text>

                      <View style={[styles.singleExpBonusPill, { borderColor: cfg.borderColor }]}>
                        <Text style={[styles.singleExpBonusText, { color: cfg.color }]}>
                          Bonus Profil: +{item.expBonus}% EXP
                        </Text>
                      </View>

                      {/* Action buttons */}
                      <View style={styles.singleActionRow}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            setShowResultModal(false);
                            setPreviewItem(item);
                          }}
                          style={[styles.resultActionBtn, styles.resultApplyBtn]}
                        >
                          <AppIcon name="image-outline" size={16} color="#FFFFFF" />
                          <Text style={styles.resultApplyBtnText}>Pakai Banner</Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setShowResultModal(false)}
                          style={[styles.resultActionBtn, styles.resultCloseBtn]}
                        >
                          <Text style={styles.resultCloseBtnText}>Tutup</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })()}
              </View>
            ) : (
              /* 10x Multi Results Grid */
              <ScrollView
                style={styles.multiResultScroll}
                contentContainerStyle={styles.multiResultGrid}
                showsVerticalScrollIndicator={false}
              >
                {gachaResults.map((item, idx) => {
                  const cfg = RARITY_CONFIG[item.rarity];
                  return (
                    <Pressable
                      key={`${item.id}_${idx}`}
                      onPress={() => {
                        setShowResultModal(false);
                        setPreviewItem(item);
                      }}
                      style={[
                        styles.multiResultCard,
                        { borderColor: cfg.borderColor, width: Math.floor((Math.min(windowWidth, 540) - 48 - 10) / 2) },
                      ]}
                    >
                      <Image
                        source={{ uri: item.image }}
                        style={styles.multiResultThumb}
                        contentFit="cover"
                      />
                      <LinearGradient
                        colors={["rgba(0,0,0,0.8)", "transparent"]}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <View style={[styles.multiRarityPill, { backgroundColor: cfg.color }]}>
                        <Text style={styles.multiRarityPillText}>{item.rarity}</Text>
                      </View>
                      <Text style={styles.multiResultName} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {lastSummonType === 10 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowResultModal(false)}
                style={[styles.resultActionBtn, styles.resultApplyBtn, { marginTop: 14 }]}
              >
                <Text style={styles.resultApplyBtnText}>Simpan & Tutup</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── 12. BANNER PREVIEW & APPLY CONFIRMATION MODAL (BAGIAN 8) ─── */}
      <Modal visible={previewItem !== null} transparent animationType="slide">
        <View style={styles.previewModalBackdrop}>
          <View style={styles.previewCardBox}>
            <Text style={styles.previewTitle}>Terapkan Banner Profil</Text>
            <Text style={styles.previewSubtitle}>
              Wallpaper ini akan ditampilkan sebagai header utama profil Nuenime kamu.
            </Text>

            {previewItem && (
              <>
                {/* 16:9 Banner Preview */}
                <View style={styles.previewBannerFrame}>
                  <Image
                    source={{ uri: previewItem.image }}
                    style={styles.previewBannerImage}
                    contentFit="cover"
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.7)"]}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={styles.previewBannerMeta}>
                    <Text style={styles.previewBannerName}>{previewItem.name}</Text>
                    <Text style={styles.previewBannerExp}>+{previewItem.expBonus}% EXP Bonus</Text>
                  </View>
                </View>

                {/* Dialog buttons */}
                <View style={styles.previewBtnRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isApplyingBanner}
                    onPress={() => setPreviewItem(null)}
                    style={[styles.previewBtn, styles.previewCancelBtn]}
                  >
                    <Text style={styles.previewCancelText}>Batal</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    disabled={isApplyingBanner}
                    onPress={handleConfirmApplyBanner}
                    style={[styles.previewBtn, styles.previewApplyBtn]}
                  >
                    {isApplyingBanner ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <AppIcon name="check" size={16} color="#FFFFFF" />
                        <Text style={styles.previewApplyText}>Terapkan</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── 13. INFO DAYLAN CRYSTAL MODAL ─── */}
      <Modal visible={showCrystalInfo} transparent animationType="fade">
        <View style={styles.previewModalBackdrop}>
          <View style={styles.previewCardBox}>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <Image source={CRYSTAL_ICON} style={{ width: 48, height: 48 }} contentFit="contain" />
            </View>
            <Text style={[styles.previewTitle, { textAlign: "center" }]}>
              Cara Mendapatkan Daylan Crystal
            </Text>
            <Text style={[styles.previewSubtitle, { textAlign: "center" }]}>
              Daylan Crystal adalah mata uang resmi Nuenime untuk melakukan Summon wallpaper langka.
            </Text>

            <View style={styles.crystalInfoList}>
              <View style={styles.crystalInfoItem}>
                <Text style={styles.crystalInfoNumber}>1.</Text>
                <Text style={styles.crystalInfoText}>
                  Menyelesaikan tontonan episode anime untuk meraih bonus harian.
                </Text>
              </View>
              <View style={styles.crystalInfoItem}>
                <Text style={styles.crystalInfoNumber}>2.</Text>
                <Text style={styles.crystalInfoText}>
                  Menaikkan level akun profil melalui riwayat menonton aktif.
                </Text>
              </View>
              <View style={styles.crystalInfoItem}>
                <Text style={styles.crystalInfoNumber}>3.</Text>
                <Text style={styles.crystalInfoText}>
                  Top Up instan melalui menu Daylan Crystal resmi.
                </Text>
              </View>
            </View>

            <View style={styles.previewBtnRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowCrystalInfo(false)}
                style={[styles.previewBtn, styles.previewCancelBtn]}
              >
                <Text style={styles.previewCancelText}>Tutup</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setShowCrystalInfo(false);
                  router.push("/topup" as never);
                }}
                style={[styles.previewBtn, styles.previewApplyBtn]}
              >
                <Text style={styles.previewApplyText}>Top Up Sekarang</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── 14. INSUFFICIENT CRYSTAL WARNING MODAL ─── */}
      <Modal visible={showInsufficientModal} transparent animationType="fade">
        <View style={styles.previewModalBackdrop}>
          <View style={[styles.previewCardBox, { alignItems: "center" }]}>
            <View style={styles.insufficientBadgeContainer}>
              <Image source={CRYSTAL_ICON} style={styles.insufficientCrystalIcon} contentFit="contain" />
              <View style={styles.insufficientAlertBadge}>
                <AppIcon name="alert-circle" size={16} color="#FFFFFF" />
              </View>
            </View>

            <Text style={[styles.previewTitle, { textAlign: "center", marginTop: 8 }]}>
              Daylan Crystal Tidak Cukup
            </Text>

            <Text style={[styles.previewSubtitle, { textAlign: "center", marginBottom: 16, lineHeight: 20 }]}>
              Saldo Crystal kamu saat ini{" "}
              <Text style={{ color: "#38BDF8", fontWeight: "700" }}>{crystalBalance.toLocaleString()} Crystal</Text>,
              sedangkan untuk Summon {insufficientDetails?.count}x dibutuhkan{" "}
              <Text style={{ color: "#F59E0B", fontWeight: "700" }}>{insufficientDetails?.cost.toLocaleString()} Crystal</Text>.
              {"\n"}Silakan top up terlebih dahulu untuk melakukan gacha lagi!
            </Text>

            <View style={styles.previewBtnRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Batal"
                onPress={() => setShowInsufficientModal(false)}
                style={({ pressed }) => [
                  styles.previewBtn,
                  styles.previewCancelBtn,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={styles.previewCancelText} numberOfLines={1}>
                  Nanti Dulu
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Top up Crystal sekarang"
                onPress={() => {
                  setShowInsufficientModal(false);
                  router.push("/topup" as never);
                }}
                style={({ pressed }) => [
                  styles.previewBtn,
                  styles.insufficientTopupBtn,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={styles.insufficientTopupText} numberOfLines={1}>
                  Top Up Sekarang
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D111A", // Dark navy background
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  // ─── HEADER ───
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },

  // ─── BANNER ILUSTRASI ───
  bannerContainer: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E293B",
    marginTop: 6,
    marginBottom: 16,
    backgroundColor: "#111827",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },

  // ─── SUMMON BUTTONS ───
  summonButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  summonBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    gap: 6,
  },
  summonBtn1x: {
    backgroundColor: "#162338",
    borderColor: "#2B4365",
  },
  summonBtn10x: {
    backgroundColor: "#2B2412",
    borderColor: "#6B5320",
  },
  summonTitle1x: {
    fontSize: 16,
    fontWeight: "700",
    color: "#38BDF8", // Cyan-blue
  },
  summonTitle10x: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EAB308", // Gold
  },
  summonCostPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
  },
  btnCrystalIcon: {
    width: 14,
    height: 14,
  },
  summonCostText1x: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
  summonCostText10x: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E2E8F0",
  },

  // ─── CARA MENDAPATKAN CRYSTAL ───
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#121722",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E2738",
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 16,
  },
  infoCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  infoCrystalIcon: {
    width: 22,
    height: 22,
  },
  infoCardTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#E2E8F0",
  },
  infoCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  infoCardLink: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#38BDF8",
  },

  // ─── BONUS EXP WALLPAPER CARD ───
  expBonusCard: {
    backgroundColor: "#121722",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E2738",
    padding: 16,
    marginBottom: 20,
  },
  expBonusTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  expBonusSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 12,
  },
  expPillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0F131D",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1B2233",
  },
  expPillGridRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  expPillItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0F131D",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#1B2233",
  },
  rarityPill: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  rarityPillText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  expPercentText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // ─── KOLEKSI SECTION HEADER ───
  koleksiHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  koleksiTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  toggleLockedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#161D2A",
    borderWidth: 1,
    borderColor: "#222D42",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  toggleLockedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#CBD5E1",
  },

  // ─── SEARCH INPUT ───
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121722",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E2738",
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13.5,
  },
  clearSearchBtn: {
    padding: 4,
  },

  // ─── RARITY GROUP HEADER ───
  rarityGroupContainer: {
    marginBottom: 20,
  },
  rarityGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#121722",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  rarityGroupLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rarityVerticalBar: {
    width: 3.5,
    height: 16,
    borderRadius: 2,
  },
  rarityGroupTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  rarityGroupBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  rarityGroupBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // ─── WALLPAPER GRID ───
  wallpaperGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  wallpaperCard: {
    aspectRatio: 16 / 9.5,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E2738",
    backgroundColor: "#161D2B",
  },
  wallpaperCardLocked: {
    opacity: 0.55,
  },
  wallpaperThumbnail: {
    width: "100%",
    height: "100%",
  },
  wallpaperTopGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 38,
  },
  wallpaperCardTitle: {
    position: "absolute",
    top: 7,
    left: 9,
    right: 9,
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  wallpaperCardBottom: {
    position: "absolute",
    bottom: 7,
    right: 7,
  },
  pakaiBtn: {
    backgroundColor: "#1E2C42",
    borderWidth: 1,
    borderColor: "#334A6E",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pakaiBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#38BDF8",
  },
  equippedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1,
    borderColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  equippedBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#10B981",
  },
  lockedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  lockedPillText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
  },

  // ─── FLOATING CONTROLS (BOTTOM RIGHT) ───
  floatingControlsContainer: {
    position: "absolute",
    bottom: 24,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  floatingScrollTopBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  floatingCrystalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#161D2B",
    borderWidth: 1,
    borderColor: "#2A364F",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingCrystalIcon: {
    width: 18,
    height: 18,
  },
  floatingCrystalText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // ─── ANIMATION OVERLAY (CLEAN PLAYBACK WITHOUT EXTRA EFFECTS) ───
  animationOverlayBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 15, 26, 0.72)",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        } as any)
      : {}),
    alignItems: "center",
    justifyContent: "center",
  },
  animationPlayer: {
    width: "70%",
    maxWidth: 300,
    maxHeight: 300,
    aspectRatio: 1,
  },

  // ─── GACHA RESULT MODAL ───
  resultModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.88)",
    ...(Platform.OS === "web" ? { backdropFilter: "blur(20px)" } : {}),
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  resultCardBox: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "88%",
    backgroundColor: "#111622",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#222D42",
    padding: 18,
    alignItems: "center",
  },
  resultHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  resultHeadline: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  resultSubHeadline: {
    fontSize: 12.5,
    color: "#94A3B8",
    textAlign: "center",
  },

  // 1x Result
  singleResultContainer: {
    width: "100%",
    alignItems: "center",
  },
  singleResultCard: {
    width: "100%",
    alignItems: "center",
  },
  singleImageWrapper: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    position: "relative",
    marginBottom: 12,
  },
  singleResultImage: {
    width: "100%",
    height: "100%",
  },
  singleRarityBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  singleRarityBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#000000",
  },
  singleItemName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  singleItemAnime: {
    fontSize: 13,
    color: "#94A3B8",
    marginBottom: 10,
  },
  singleExpBonusPill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 18,
  },
  singleExpBonusText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  singleActionRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  resultActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  resultApplyBtn: {
    backgroundColor: "#0284C7",
  },
  resultApplyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  resultCloseBtn: {
    backgroundColor: "#1E2738",
  },
  resultCloseBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#CBD5E1",
  },

  // 10x Results
  multiResultScroll: {
    width: "100%",
    maxHeight: 380,
  },
  multiResultGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    paddingBottom: 10,
  },
  multiResultCard: {
    aspectRatio: 16 / 10,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1.5,
    position: "relative",
  },
  multiResultThumb: {
    width: "100%",
    height: "100%",
  },
  multiRarityPill: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  multiRarityPillText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#000000",
  },
  multiResultName: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // ─── PREVIEW / CONFIRMATION MODAL ───
  previewModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  previewCardBox: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#121722",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E2738",
    padding: 20,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 12.5,
    color: "#94A3B8",
    marginBottom: 14,
  },
  previewBannerFrame: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "#2B374E",
    marginBottom: 16,
  },
  previewBannerImage: {
    width: "100%",
    height: "100%",
  },
  previewBannerMeta: {
    position: "absolute",
    bottom: 10,
    left: 12,
    right: 12,
  },
  previewBannerName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  previewBannerExp: {
    fontSize: 12,
    fontWeight: "600",
    color: "#38BDF8",
  },
  previewBtnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  previewBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 6,
  },
  previewCancelBtn: {
    backgroundColor: "#1E2738",
    flex: 1,
  },
  previewCancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
    textAlign: "center",
    ...(Platform.OS === "web" ? ({ whiteSpace: "nowrap" } as any) : {}),
  },
  previewApplyBtn: {
    backgroundColor: "#0284C7",
  },
  previewApplyText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // ─── CRYSTAL INFO MODAL LIST ───
  crystalInfoList: {
    gap: 10,
    marginBottom: 18,
    backgroundColor: "#0F131D",
    padding: 12,
    borderRadius: 10,
  },
  crystalInfoItem: {
    flexDirection: "row",
    gap: 8,
  },
  crystalInfoNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#38BDF8",
  },
  crystalInfoText: {
    fontSize: 13,
    color: "#CBD5E1",
    flex: 1,
  },

  // ─── FEEDBACK TOAST ───
  toastBox: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  toastSuccess: {
    backgroundColor: "#065F46",
    borderColor: "#10B981",
    borderWidth: 1,
  },
  toastError: {
    backgroundColor: "#7F1D1D",
    borderColor: "#EF4444",
    borderWidth: 1,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
  },

  // ─── INSUFFICIENT CRYSTAL MODAL ───
  insufficientBadgeContainer: {
    position: "relative",
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  insufficientCrystalIcon: {
    width: 50,
    height: 50,
  },
  insufficientAlertBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#121722",
  },
  insufficientTopupBtn: {
    backgroundColor: "#0284C7",
    flex: 1.25,
    paddingHorizontal: 12,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  insufficientTopupText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    ...(Platform.OS === "web" ? ({ whiteSpace: "nowrap" } as any) : {}),
  },

  // ─── UTILS ───
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
