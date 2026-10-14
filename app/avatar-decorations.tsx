import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";

import { useAnirakuAuth } from "@/providers/auth-provider";
import { avatarUrl } from "@/lib/aniraku-avatars";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  AVATAR_BORDERS,
  AvatarBorder,
  BorderRarity,
  RARITY_THEME,
  fetchLiveBorderCatalog,
  getBorderById,
  getEquippedBorderId,
  getOwnedBorderIds,
  recordBorderPurchaseToSupabase,
  setEquippedBorderId,
  setOwnedBorderIds,
} from "@/lib/avatar-borders";
import { BorderAvatar } from "@/components/border-avatar";
import {
  getCrystalBalance,
  deductCrystalBalance,
} from "@/lib/topup-service";
import { supabase } from "@/lib/supabase";

const TOPUP_CRYSTAL_ICON = require("@/assets/images/topup/topup-crystal.png");

export type BorderFilterCategory = "Semua" | BorderRarity;

// ─── HARGA BORDER BERDASARKAN RARITY (sesuai spesifikasi resmi) ───
export const BORDER_RARITY_PRICES: Record<BorderRarity, number> = {
  Normal: 1000,
  Rare: 2000,
  Epic: 3000,
  Legends: 4000,
  Mythic: 5000,
};

export default function AvatarDecorationsScreen() {
  const auth = useAnirakuAuth();
  const { width: windowWidth } = useWindowDimensions();

  // ─── Tabs & Filters ───
  const [activeTab, setActiveTab] = useState<"shop" | "collection">("shop");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<BorderFilterCategory>("Semua");

  // ─── Ownership & Equipped States (Per User ID) ───
  const [equippedBorderIdState, setEquippedBorderIdState] = useState<string | null>(null);
  const [ownedBorderIds, setOwnedBorderIdsState] = useState<string[]>([]);
  const [crystalBalance, setCrystalBalance] = useState<number>(0);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // ─── CHECKOUT (CO) MODE STATES (Alur Pembelian Transparan) ───
  const [checkoutBorder, setCheckoutBorder] = useState<AvatarBorder | null>(null);
  const [checkoutState, setCheckoutState] = useState<"review" | "processing" | "success" | "error">("review");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // ─── Katalog border live (dari Supabase, override data static) ───
  const [liveBorders, setLiveBorders] = useState<AvatarBorder[]>(AVATAR_BORDERS);

  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Responsive 2-column card calculation
  const cardWidth = Math.floor((Math.min(windowWidth, 600) - 32 - 14) / 2);

  const userId = auth.user?.id || null;

  // ─── Load crystal balance (Supabase + AsyncStorage) ───
  const loadCrystalBalance = useCallback(async () => {
    const balance = await getCrystalBalance(userId);
    setCrystalBalance(balance);
  }, [userId]);

  // ─── Load saved borders per-user ───
  const loadOwnedBorders = useCallback(async () => {
    const [equipped, owned] = await Promise.all([
      getEquippedBorderId(userId),
      getOwnedBorderIds(userId),
    ]);
    setEquippedBorderIdState(equipped);
    setOwnedBorderIdsState(owned);
  }, [userId]);

  // Initial load
  useEffect(() => {
    loadCrystalBalance();
    loadOwnedBorders();
    // Fetch katalog border live dari Supabase
    fetchLiveBorderCatalog().then((catalog) => setLiveBorders(catalog));
  }, [loadCrystalBalance, loadOwnedBorders]);

  // Refresh crystal balance when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCrystalBalance();
    }, [loadCrystalBalance])
  );

  // ─── Supabase Realtime: subscribe to user_balances changes ───
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`avatar_dec_balance_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_balances",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const newBalance = payload.new?.crystal_balance;
          if (typeof newBalance === "number") {
            setCrystalBalance(newBalance);
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // User Profile
  const username =
    auth.profile?.username ||
    auth.user?.user_metadata?.username ||
    auth.user?.user_metadata?.full_name ||
    auth.user?.email?.split("@")[0] ||
    "User";

  const displayName =
    auth.profile?.display_name ||
    auth.user?.user_metadata?.full_name ||
    auth.user?.user_metadata?.name ||
    username;

  const rawAvatar =
    auth.profile?.avatar_url ||
    auth.user?.user_metadata?.avatar_url ||
    auth.user?.user_metadata?.picture;

  const userAvatar = rawAvatar ? avatarUrl(rawAvatar) : null;
  const initialLetter = (displayName || username).trim().charAt(0).toUpperCase() || "N";

  // Filter border list
  const filteredBorders = useMemo(() => {
    return liveBorders.filter((item) => {
      // Tab filter
      if (activeTab === "collection" && !ownedBorderIds.includes(item.id)) {
        return false;
      }
      // Category filter
      if (selectedCategory !== "Semua" && item.rarity !== selectedCategory) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(query);
        const matchCat = item.rarity.toLowerCase().includes(query);
        if (!matchName && !matchCat) return false;
      }
      return true;
    });
  }, [activeTab, liveBorders, ownedBorderIds, selectedCategory, searchQuery]);

  // Handle equip / unequip (revert to no border if currently equipped)
  const handleToggleEquip = async (borderId: string) => {
    hapticSuccess();
    const nextEquipped = equippedBorderIdState === borderId ? null : borderId;
    setEquippedBorderIdState(nextEquipped);
    await setEquippedBorderId(userId, nextEquipped);
  };

  // Handle buy press: Langsung buka halaman/mode Checkout (CO) seperti alur topup
  const handleBuyPress = (item: AvatarBorder) => {
    hapticLight();

    const isOwned = ownedBorderIds.includes(item.id);
    if (isOwned) {
      handleToggleEquip(item.id);
      return;
    }

    // Guard: border belum rilis — tidak bisa dibeli
    if (item.isReleased === false || !item.assetUrl) {
      hapticWarning();
      Alert.alert(
        "Belum Tersedia",
        `Border "${item.name}" belum dirilis. Nantikan updatenya ya!`,
        [{ text: "Mengerti" }]
      );
      return;
    }

    if (!userId) {
      router.push("/auth" as never);
      return;
    }

    // Masuk ke Mode Checkout (CO) transparan
    setCheckoutBorder(item);
    setCheckoutState("review");
    setCheckoutError(null);
  };

  // Konfirmasi pembayaran di Mode Checkout (CO): Langsung aktif tanpa verifikasi admin
  const handleConfirmPurchase = async () => {
    if (!checkoutBorder || !userId || isPurchasing) return;
    const price = BORDER_RARITY_PRICES[checkoutBorder.rarity];

    setIsPurchasing(true);
    setCheckoutState("processing");
    setCheckoutError(null);

    try {
      // 1. Cek ulang kepemilikan (anti double-buy)
      const latestOwned = await getOwnedBorderIds(userId);
      if (latestOwned.includes(checkoutBorder.id)) {
        setOwnedBorderIdsState(latestOwned);
        handleToggleEquip(checkoutBorder.id);
        setCheckoutState("success");
        return;
      }

      // 2. Cek saldo terbaru dari Supabase
      const latestBalance = await getCrystalBalance(userId);
      if (latestBalance < price) {
        hapticWarning();
        setCrystalBalance(latestBalance);
        setCheckoutState("error");
        setCheckoutError(
          `Saldo Crystal tidak cukup. Anda membutuhkan ${price.toLocaleString()} Crystal, saldo saat ini ${latestBalance.toLocaleString()} Crystal.`
        );
        return;
      }

      // 3. Kurangi saldo Crystal secara atomik
      const newBalance = await deductCrystalBalance(userId, price);

      // 4. Catat pembelian ke Supabase (tabel user_border_purchases)
      const result = await recordBorderPurchaseToSupabase(
        userId,
        { id: checkoutBorder.id, name: checkoutBorder.name, rarity: checkoutBorder.rarity },
        price
      );

      if (!result.success) {
        // Rollback saldo jika gagal catat di database
        await deductCrystalBalance(userId, -price);
        setCheckoutState("error");
        setCheckoutError("Gagal mencatat transaksi pembelian border ke server. Saldo Anda aman dan tidak terpotong.");
        return;
      }

      // 5. Update state lokal & pasang langsung ke avatar (INSTANT AKTIF)
      const nextOwned = [...latestOwned, checkoutBorder.id];
      setOwnedBorderIdsState(nextOwned);
      setEquippedBorderIdState(checkoutBorder.id);
      setCrystalBalance(newBalance);

      // 6. Simpan ke cache lokal
      await setOwnedBorderIds(userId, nextOwned);
      await setEquippedBorderId(userId, checkoutBorder.id);

      hapticSuccess();
      setCheckoutState("success");
    } catch (err: any) {
      console.warn("handleConfirmPurchase error:", err);
      setCheckoutState("error");
      setCheckoutError(err?.message || "Terjadi kesalahan saat memproses pembelian. Silakan coba lagi.");
    } finally {
      setIsPurchasing(false);
    }
  };

  // Find equipped border data for header preview
  const equippedItem = getBorderById(equippedBorderIdState);

  // ─── TAMPILAN MODE CHECKOUT (CO) — ALUR PEMBELIAN LANGSUNG SEPERTI TOPUP ───
  if (checkoutBorder) {
    const price = BORDER_RARITY_PRICES[checkoutBorder.rarity];
    const theme = RARITY_THEME[checkoutBorder.rarity];
    const hasEnough = crystalBalance >= price;
    const remainingBalance = Math.max(0, crystalBalance - price);

    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeContainer}>
        {/* HEADER CHECKOUT */}
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali ke Shop"
            onPress={() => {
              hapticLight();
              setCheckoutBorder(null);
              setCheckoutState("review");
            }}
            style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
            hitSlop={12}
          >
            <AppIcon name="chevron-left" size={26} color="#FFFFFF" />
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.headerTitle}>
              {checkoutState === "success" ? "Pembelian Berhasil" : "Checkout Border Avatar"}
            </Text>
            <Text style={styles.checkoutSubTitle}>
              {checkoutState === "success" ? "Border Otomatis Aktif" : "Mode Pembayaran Langsung"}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.checkoutScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {checkoutState === "success" ? (
            /* ─── LAYAR SUKSES PEMBELIAN (CHECKOUT SUCCESS) ─── */
            <View style={styles.successCard}>
              <View style={styles.successIconOuter}>
                <View style={styles.successIconInner}>
                  <AppIcon name="check-bold" size={32} color="#10B981" />
                </View>
              </View>

              <Text style={styles.successTitle}>Pembelian Berhasil!</Text>
              <Text style={styles.successSubtitle}>
                Border{" "}
                <Text style={{ color: theme.color, fontFamily: "Nunito-Bold" }}>
                  {checkoutBorder.name}
                </Text>{" "}
                telah resmi menjadi milik Anda dan langsung otomatis terpasang di avatar profil.
              </Text>

              {/* Preview Avatar dengan Border yang Baru Dibeli */}
              <View style={styles.successAvatarBox}>
                <BorderAvatar
                  avatarUrl={userAvatar}
                  fallbackText={initialLetter}
                  border={checkoutBorder}
                  avatarSize={72}
                />
                <Text style={styles.successBorderName}>{checkoutBorder.name}</Text>
                <View
                  style={[
                    styles.categoryBadge,
                    {
                      backgroundColor: theme.bgBadge,
                      borderColor: theme.borderBadge,
                      position: "relative",
                      top: 0,
                      left: 0,
                    },
                  ]}
                >
                  <Text style={[styles.categoryBadgeText, { color: theme.color }]}>
                    {checkoutBorder.rarity.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Rincian Sisa Saldo */}
              <View style={styles.successBalanceRow}>
                <Text style={styles.successBalanceLabel}>Sisa Saldo Crystal:</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Image source={TOPUP_CRYSTAL_ICON} style={{ width: 16, height: 16 }} contentFit="contain" />
                  <Text style={styles.successBalanceValue}>
                    {crystalBalance.toLocaleString()} Crystal
                  </Text>
                </View>
              </View>

              {/* Tombol Aksi */}
              <View style={styles.successActionCol}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    hapticLight();
                    router.push("/settings" as never);
                  }}
                  style={({ pressed }) => [styles.successProfileBtn, pressed && styles.btnPressed]}
                >
                  <AppIcon name="account-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.successProfileBtnText}>Lihat di Pengaturan Profil</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    hapticLight();
                    setCheckoutBorder(null);
                    setCheckoutState("review");
                  }}
                  style={({ pressed }) => [styles.successBackBtn, pressed && styles.btnPressed]}
                >
                  <Text style={styles.successBackBtnText}>Selesai & Kembali ke Shop</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* ─── LAYAR RINGKASAN CHECKOUT (MODE CO) ─── */
            <>
              {/* 1. Preview Border yang Dipilih */}
              <View style={styles.coItemCard}>
                <View style={styles.coPreviewWrap}>
                  <BorderAvatar
                    avatarUrl={userAvatar}
                    fallbackText={initialLetter}
                    border={checkoutBorder}
                    avatarSize={66}
                  />
                </View>
                <View style={styles.coItemDetails}>
                  <View
                    style={[
                      styles.categoryBadge,
                      {
                        backgroundColor: theme.bgBadge,
                        borderColor: theme.borderBadge,
                        position: "relative",
                        top: 0,
                        left: 0,
                        alignSelf: "flex-start",
                        marginBottom: 4,
                      },
                    ]}
                  >
                    <Text style={[styles.categoryBadgeText, { color: theme.color }]}>
                      {checkoutBorder.rarity.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.coItemName}>{checkoutBorder.name}</Text>
                  <Text style={styles.coItemDesc} numberOfLines={2}>
                    {checkoutBorder.description || `Border avatar eksklusif kategori ${checkoutBorder.rarity}`}
                  </Text>
                  <View style={styles.coPricePill}>
                    <Image source={TOPUP_CRYSTAL_ICON} style={{ width: 14, height: 14 }} contentFit="contain" />
                    <Text style={styles.coPriceText}>{price.toLocaleString()} Crystal</Text>
                  </View>
                </View>
              </View>

              {/* 2. Detail Metode Pembayaran */}
              <View style={styles.coSectionCard}>
                <Text style={styles.coSectionTitle}>Metode Pembayaran</Text>
                <View style={styles.coMethodRow}>
                  <View style={styles.coMethodIconWrap}>
                    <Image source={TOPUP_CRYSTAL_ICON} style={{ width: 22, height: 22 }} contentFit="contain" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coMethodName}>Daylan Crystal</Text>
                    <Text style={styles.coMethodSub}>Saldo resmi akun Nuenime</Text>
                  </View>
                  <View style={styles.coAutoBadge}>
                    <Text style={styles.coAutoBadgeText}>Otomatis</Text>
                  </View>
                </View>
              </View>

              {/* 4. Rincian Saldo & Biaya */}
              <View style={styles.coSectionCard}>
                <Text style={styles.coSectionTitle}>Rincian Saldo Akun</Text>

                <View style={styles.coSummaryRow}>
                  <Text style={styles.coSummaryLabel}>Saldo Crystal Anda Saat Ini:</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Image source={TOPUP_CRYSTAL_ICON} style={{ width: 14, height: 14 }} contentFit="contain" />
                    <Text style={styles.coSummaryValue}>{crystalBalance.toLocaleString()}</Text>
                  </View>
                </View>

                <View style={styles.coSummaryRow}>
                  <Text style={styles.coSummaryLabel}>Harga Border ({checkoutBorder.rarity}):</Text>
                  <Text style={[styles.coSummaryValue, { color: "#F43F5E" }]}>
                    - {price.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.coDivider} />

                <View style={styles.coSummaryRow}>
                  <Text style={styles.coSummaryTotalLabel}>Sisa Saldo Setelah Beli:</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Image source={TOPUP_CRYSTAL_ICON} style={{ width: 15, height: 15 }} contentFit="contain" />
                    <Text
                      style={[
                        styles.coSummaryTotalValue,
                        !hasEnough && { color: "#F43F5E" },
                      ]}
                    >
                      {remainingBalance.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 5. Error banner jika ada error */}
              {checkoutError && (
                <View style={styles.coErrorBanner}>
                  <AppIcon name="alert-circle" size={16} color="#F43F5E" />
                  <Text style={styles.coErrorText}>{checkoutError}</Text>
                </View>
              )}

              {/* 6. Saldo Kurang Notice */}
              {!hasEnough && (
                <View style={styles.coWarningBanner}>
                  <AppIcon name="alert-outline" size={18} color="#F59E0B" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coWarningTitle}>Saldo Crystal Tidak Mencukupi</Text>
                    <Text style={styles.coWarningText}>
                      Anda membutuhkan {price.toLocaleString()} Crystal, saldo saat ini {crystalBalance.toLocaleString()} Crystal (kurang {(price - crystalBalance).toLocaleString()} Crystal).
                    </Text>
                  </View>
                </View>
              )}

              {/* 7. Action Button */}
              {hasEnough ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={isPurchasing}
                  onPress={handleConfirmPurchase}
                  style={({ pressed }) => [
                    styles.coPayBtn,
                    pressed && styles.btnPressed,
                    isPurchasing && { opacity: 0.7 },
                  ]}
                >
                  {isPurchasing ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.coPayBtnText}>Memproses Pembelian...</Text>
                    </>
                  ) : (
                    <>
                      <AppIcon name="cart-check" size={20} color="#FFFFFF" />
                      <Text style={styles.coPayBtnText}>
                        Konfirmasi & Bayar ({price.toLocaleString()} Crystal)
                      </Text>
                    </>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    hapticLight();
                    router.push("/topup" as never);
                  }}
                  style={({ pressed }) => [styles.coTopUpBtn, pressed && styles.btnPressed]}
                >
                  <AppIcon name="plus-circle" size={19} color="#FFFFFF" />
                  <Text style={styles.coTopUpBtnText}>Top Up Crystal Sekarang</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeContainer}>
      {/* ─── 1. HEADER UTAMA ─── */}
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
          <AppIcon name="chevron-left" size={26} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Avatar Borders</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 2. CARD INFORMASI AVATAR (UNDER HEADER) ─── */}
        <View style={styles.avatarProfileCard}>
          {/* BorderAvatar component with exact layering */}
          <BorderAvatar
            avatarUrl={userAvatar}
            fallbackText={initialLetter}
            borderId={equippedBorderIdState}
            avatarSize={48}
          />

          {/* Right info: Title, Status, and Crystal Balance */}
          <View style={styles.profileInfoRight}>
            <View style={styles.profileTitleRow}>
              <Text style={styles.profileCardTitle}>Border Avatar</Text>
              <View
                style={[
                  styles.statusBadgePill,
                  equippedItem ? styles.statusBadgeActive : styles.statusBadgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    equippedItem ? styles.statusBadgeTextActive : styles.statusBadgeTextInactive,
                  ]}
                  numberOfLines={1}
                >
                  {equippedItem ? equippedItem.name : "Tanpa Border"}
                </Text>
              </View>
            </View>

            {/* Saldo crystal button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Top Up Crystal"
              onPress={() => {
                hapticLight();
                router.push("/topup" as never);
              }}
              style={({ pressed }) => [styles.crystalBalanceBtn, pressed && styles.btnPressed]}
            >
              <View style={styles.crystalBalanceLeft}>
                <Image source={TOPUP_CRYSTAL_ICON} style={styles.crystalIconSmall} contentFit="contain" />
                <Text style={styles.crystalBalanceText}>
                  {crystalBalance.toLocaleString()} <Text style={styles.crystalUnitText}>Crystal</Text>
                </Text>
              </View>
              <View style={styles.crystalPlusPill}>
                <AppIcon name="plus" size={12} color="#38BDF8" />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ─── 3. TAB NAVIGASI (SHOP & KOLEKSI) ─── */}
        <View style={styles.tabsCard}>
          <Pressable
            accessibilityRole="tab"
            onPress={() => {
              hapticLight();
              setActiveTab("shop");
            }}
            style={[styles.tabButton, activeTab === "shop" && styles.tabButtonActive]}
          >
            <AppIcon
              name="storefront-outline"
              size={16}
              color={activeTab === "shop" ? "#FFFFFF" : "#94A3B8"}
            />
            <Text style={[styles.tabText, activeTab === "shop" && styles.tabTextActive]}>
              Shop ({AVATAR_BORDERS.length})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            onPress={() => {
              hapticLight();
              setActiveTab("collection");
            }}
            style={[styles.tabButton, activeTab === "collection" && styles.tabButtonActive]}
          >
            <AppIcon
              name="image-multiple-outline"
              size={16}
              color={activeTab === "collection" ? "#FFFFFF" : "#94A3B8"}
            />
            <Text style={[styles.tabText, activeTab === "collection" && styles.tabTextActive]}>
              Koleksi ({ownedBorderIds.length})
            </Text>
          </Pressable>
        </View>

        {/* ─── 4. SEARCH BAR & FILTER 5 KATEGORI RARITY ─── */}
        <View style={styles.filterSection}>
          {/* Search bar */}
          <View style={styles.searchBar}>
            <AppIcon name="magnify" size={19} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari nama border..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery("")}
                hitSlop={8}
                style={styles.clearSearchBtn}
              >
                <AppIcon name="close-circle" size={16} color="#64748B" />
              </Pressable>
            )}
          </View>

          {/* Category Filter Chips (Mythic, Legends, Epic, Rare, Normal) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChipsRow}
          >
            {(["Semua", "Mythic", "Legends", "Epic", "Rare", "Normal"] as BorderFilterCategory[]).map((cat) => {
              const isSelected = selectedCategory === cat;
              const count =
                cat === "Semua"
                  ? AVATAR_BORDERS.length
                  : RARITY_THEME[cat]?.targetCount || 0;

              return (
                <Pressable
                  key={cat}
                  onPress={() => {
                    hapticLight();
                    setSelectedCategory(cat);
                  }}
                  style={[
                    styles.chipBtn,
                    isSelected ? styles.chipBtnActive : styles.chipBtnInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected ? styles.chipTextActive : styles.chipTextInactive,
                    ]}
                  >
                    {cat} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ─── 5. GRID KARTU BORDER (2 KOLOM PER BARIS) ─── */}
        {filteredBorders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <AppIcon name="palette-swatch-outline" size={48} color="#475569" />
            <Text style={styles.emptyTitle}>Tidak ada border ditemukan</Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "collection"
                ? "Anda belum memiliki border di kategori ini. Buka tab Shop untuk melihat koleksi border!"
                : "Coba ubah kata kunci pencarian atau ganti filter kategori."}
            </Text>
          </View>
        ) : (
          <View style={styles.bordersGrid}>
            {filteredBorders.map((border) => {
              const isOwned = ownedBorderIds.includes(border.id);
              const isEquipped = equippedBorderIdState === border.id;
              const theme = RARITY_THEME[border.rarity];
              const price = BORDER_RARITY_PRICES[border.rarity];

              return (
                <View
                  key={border.id}
                  style={[
                    styles.borderCard,
                    { width: cardWidth },
                    isEquipped && styles.borderCardEquipped,
                  ]}
                >
                  {/* Category Badge di sudut kiri atas preview */}
                  <View style={styles.previewContainer}>
                    <View
                      style={[
                        styles.categoryBadge,
                        {
                          backgroundColor: theme.bgBadge,
                          borderColor: theme.borderBadge,
                        },
                      ]}
                    >
                      <Text style={[styles.categoryBadgeText, { color: theme.color }]}>
                        {border.rarity.toUpperCase()}
                      </Text>
                    </View>

                    {/* Status Badge di kanan atas: Khusus jika Rilis */}
                    {border.assetUrl && border.isReleased !== false && (
                      <View style={[styles.cardStatusBadge, styles.cardStatusReleased]}>
                        <AppIcon name="check-circle" size={8.5} color="#10B981" />
                        <Text style={[styles.cardStatusText, styles.cardStatusTextReleased]}>
                          Rilis
                        </Text>
                      </View>
                    )}

                    {/* Preview avatar presisi menggunakan BorderAvatar */}
                    <BorderAvatar
                      avatarUrl={userAvatar}
                      fallbackText={initialLetter}
                      border={border}
                      avatarSize={58}
                    />
                  </View>

                  {/* Info Nama Border */}
                  <View style={styles.cardInfoWrap}>
                    {/* Jika Segera Hadir: posisikan di atas nama, tepat di bawah border */}
                    {(!border.assetUrl || border.isReleased === false) && (
                      <View style={styles.comingSoonPillWrap}>
                        <View style={styles.comingSoonPill}>
                          <AppIcon name="clock-outline" size={9.5} color="#F59E0B" />
                          <Text style={styles.comingSoonPillText}>Segera Hadir</Text>
                        </View>
                      </View>
                    )}

                    <Text style={styles.borderNameText} numberOfLines={1}>
                      {border.name}
                    </Text>
                    <Text style={styles.borderDescText} numberOfLines={1}>
                      {border.description || `Kategori ${border.rarity}`}
                    </Text>
                  </View>

                  {/* Tombol Aksi */}
                  <View style={styles.cardActionWrap}>
                    {/* Di tab Shop: tampilkan harga hanya jika border sudah rilis */}
                    {activeTab === "shop" && (border.isReleased !== false && border.assetUrl) && (
                      <View style={styles.shopPriceRow}>
                        <Image source={TOPUP_CRYSTAL_ICON} style={styles.priceCrystalIcon} contentFit="contain" />
                        <Text style={[
                          styles.shopPriceText,
                          isOwned && styles.shopPriceTextOwned,
                        ]}>
                          {price.toLocaleString()}
                        </Text>
                        {isOwned && (
                          <View style={styles.ownedBadgeInline}>
                            <AppIcon name="check" size={9} color="#10B981" />
                            <Text style={styles.ownedBadgeText}>Dimiliki</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {isOwned ? (
                      // Sudah dimiliki: tombol Pakai/Sedang Dipakai
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => handleToggleEquip(border.id)}
                        style={({ pressed }) => [
                          styles.actionBtnOwned,
                          isEquipped ? styles.actionBtnEquipped : styles.actionBtnUnequipped,
                          pressed && styles.btnPressed,
                        ]}
                      >
                        {isEquipped ? (
                          <>
                            <AppIcon name="check-circle" size={14} color="#10B981" />
                            <Text style={styles.actionTextEquipped}>Sedang Dipakai</Text>
                          </>
                        ) : (
                          <Text style={styles.actionTextUnequipped}>Pakai</Text>
                        )}
                      </Pressable>
                    ) : (border.isReleased === false || !border.assetUrl) ? (
                      // Belum rilis: tombol dikunci, tidak bisa ditekan
                      <View style={styles.actionBtnLocked}>
                        <AppIcon name="lock-outline" size={12} color="#64748B" />
                        <Text style={styles.actionTextLocked}>Segera Hadir</Text>
                      </View>
                    ) : (
                      // Sudah rilis, belum dimiliki: tombol Beli
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => handleBuyPress(border)}
                        style={({ pressed }) => [
                          styles.actionBtnBuy,
                          pressed && styles.btnPressed,
                        ]}
                      >
                        <Text style={styles.actionTextBuy}>Beli</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "#0B0E17",
  },
  btnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },

  // ─── 1. HEADER ───
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backBtn: {
    padding: 6,
    marginLeft: -6,
  },
  headerTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 19,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 32,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 16,
  },

  // ─── 2. CARD INFORMASI AVATAR ───
  avatarProfileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#13192B",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  profileInfoRight: {
    flex: 1,
    gap: 8,
  },
  profileTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  profileCardTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  statusBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 130,
  },
  statusBadgeActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  statusBadgeInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  statusBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
  },
  statusBadgeTextActive: {
    color: "#10B981",
  },
  statusBadgeTextInactive: {
    color: "#94A3B8",
  },
  crystalBalanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  crystalBalanceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  crystalIconSmall: {
    width: 17,
    height: 17,
  },
  crystalBalanceText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  crystalUnitText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
  },
  crystalPlusPill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── 3. TABS ───
  tabsCard: {
    flexDirection: "row",
    backgroundColor: "#13192B",
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: "#1F2942",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  tabText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 13.5,
    color: "#94A3B8",
  },
  tabTextActive: {
    fontFamily: "Nunito-Bold",
    color: "#FFFFFF",
  },

  // ─── 4. SEARCH & FILTERS ───
  filterSection: {
    gap: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#13192B",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
    height: "100%",
  },
  clearSearchBtn: {
    padding: 4,
  },
  categoryChipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  chipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipBtnActive: {
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    borderColor: "#38BDF8",
  },
  chipBtnInactive: {
    backgroundColor: "#13192B",
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  chipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
  },
  chipTextActive: {
    color: "#38BDF8",
  },
  chipTextInactive: {
    color: "#94A3B8",
  },

  // ─── 5. GRID BORDERS ───
  bordersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  borderCard: {
    borderRadius: 18,
    backgroundColor: "#13192B",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  borderCardEquipped: {
    borderColor: "rgba(16, 185, 129, 0.6)",
    backgroundColor: "#142338",
  },
  previewContainer: {
    width: "100%",
    height: 145,
    backgroundColor: "#0A0D15",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  categoryBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    zIndex: 3,
  },
  categoryBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    letterSpacing: 0.4,
  },
  cardStatusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
    zIndex: 3,
  },
  cardStatusReleased: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.45)",
  },
  cardStatusComingSoon: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.45)",
  },
  cardStatusText: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
    letterSpacing: 0.3,
  },
  cardStatusTextReleased: {
    color: "#10B981",
  },
  cardStatusTextComingSoon: {
    color: "#F59E0B",
  },
  unreleasedBadge: {
    position: "absolute",
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    zIndex: 3,
  },
  unreleasedBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#94A3B8",
  },
  cardInfoWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 2,
    alignItems: "center",
  },
  comingSoonPillWrap: {
    alignItems: "center",
    marginBottom: 4,
  },
  comingSoonPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.35)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  comingSoonPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#F59E0B",
    letterSpacing: 0.2,
  },
  borderNameText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
    textAlign: "center",
  },
  borderDescText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
  },
  cardActionWrap: {
    padding: 10,
    gap: 6,
  },

  // ─── Baris harga di Shop (selalu tampil) ───
  shopPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
  },
  shopPriceText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 13,
    color: "#FBBF24",
  },
  shopPriceTextOwned: {
    color: "#94A3B8",
    fontSize: 12,
  },
  ownedBadgeInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(16, 185, 129, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  ownedBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    color: "#10B981",
  },


  // Price button (Belum Dimiliki) — legacy
  actionBtnPrice: {
    backgroundColor: "rgba(217, 119, 6, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  // Tombol Beli
  actionBtnBuy: {
    backgroundColor: "rgba(217, 119, 6, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.5)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextBuy: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 13,
    color: "#FBBF24",
    letterSpacing: 0.2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  priceCrystalIcon: {
    width: 14,
    height: 14,
  },
  priceNumberText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 13,
    color: "#FBBF24",
  },

  // Locked button (Unreleased slots)
  actionBtnLocked: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionTextLocked: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#64748B",
  },

  // Action button (Sudah Dimiliki)
  actionBtnOwned: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionBtnEquipped: {
    backgroundColor: "rgba(16, 185, 129, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  actionBtnUnequipped: {
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  actionTextEquipped: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#10B981",
  },
  actionTextUnequipped: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#CBD5E1",
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },

  // ─── CHECKOUT (CO) MODE STYLES ───
  checkoutSubTitle: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: -2,
  },
  checkoutScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 14,
  },
  coItemCard: {
    flexDirection: "row",
    backgroundColor: "#13192B",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 14,
    alignItems: "center",
  },
  coPreviewWrap: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: "#0A0D15",
    alignItems: "center",
    justifyContent: "center",
  },
  coItemDetails: {
    flex: 1,
    gap: 3,
  },
  coItemName: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  coItemDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 16,
  },
  coPricePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.3)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  coPriceText: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#38BDF8",
  },
  coInstantBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    padding: 14,
    borderRadius: 16,
  },
  coInstantIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  coInstantTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#10B981",
    marginBottom: 2,
  },
  coInstantText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#CBD5E1",
    lineHeight: 16,
  },
  coSectionCard: {
    backgroundColor: "#13192B",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 10,
  },
  coSectionTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  coMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  coMethodIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  coMethodName: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  coMethodSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  coAutoBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  coAutoBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#10B981",
  },
  coSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coSummaryLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
  },
  coSummaryValue: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  coDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 4,
  },
  coSummaryTotalLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  coSummaryTotalValue: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#10B981",
  },
  coErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.35)",
    padding: 12,
    borderRadius: 14,
  },
  coErrorText: {
    flex: 1,
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#F43F5E",
  },
  coWarningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    padding: 14,
    borderRadius: 16,
  },
  coWarningTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#F59E0B",
    marginBottom: 2,
  },
  coWarningText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#E2E8F0",
    lineHeight: 16,
  },
  coPayBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: "#10B981",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginTop: 6,
  },
  coPayBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  coTopUpBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#8C57FF",
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: "#8C57FF",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginTop: 6,
  },
  coTopUpBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
  },

  // Success view styles
  successCard: {
    backgroundColor: "#13192B",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    alignItems: "center",
    gap: 14,
    marginTop: 10,
  },
  successIconOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  successIconInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 20,
    color: "#FFFFFF",
    textAlign: "center",
  },
  successSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  successAvatarBox: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  successBorderName: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  successBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    backgroundColor: "#0A0D15",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  successBalanceLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
  },
  successBalanceValue: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#38BDF8",
  },
  successActionCol: {
    width: "100%",
    gap: 10,
    marginTop: 8,
  },
  successProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#8C57FF",
    paddingVertical: 13,
    borderRadius: 14,
  },
  successProfileBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  successBackBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  successBackBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#CBD5E1",
  },
});
