import { useEffect, useMemo, useState } from "react";
import {
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
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAnirakuAuth } from "@/providers/auth-provider";
import { avatarUrl } from "@/lib/aniraku-avatars";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";

// ─── LOCAL ASSETS ───
const TOPUP_CRYSTAL_ICON = require("@/assets/images/topup/topup-crystal.png");
const BORDER_WHITE_MAGE = require("@/assets/images/inventory/border-white-mage.png");
const BORDER_MAGIC_BOOK = require("@/assets/images/inventory/border-magic-book.png");

// Storage keys
const STORAGE_EQUIPPED_BORDER = "nuenime.equipped.border";
const STORAGE_OWNED_BORDERS = "nuenime.owned.borders";
const STORAGE_CRYSTAL_BALANCE = "nuenime.crystal.balance";

export type BorderRarity = "Mythic" | "Legendary" | "Epic" | "Rare" | "Normal";
export type BorderCategory = "Semua" | BorderRarity;

export interface BorderDecorationItem {
  id: string;
  name: string;
  category: BorderRarity;
  priceLabel: string;
  priceValue: number;
  image: any;
  scale?: number;
  offsetY?: number;
  description: string;
}

// ─── HARGA SESUAI RARITY ───
export const BORDER_RARITY_PRICES: Record<BorderRarity, number> = {
  Normal: 1000,
  Rare: 1500,
  Epic: 2000,
  Legendary: 3500,
  Mythic: 5000,
};

// ─── DAFTAR BORDER DECORATIONS (MAPPING DATA BERSIH & SIAP ASET BARU) ───
export const BORDER_CATALOG: BorderDecorationItem[] = [
  {
    id: "magic_book",
    name: "Grimoire Spell",
    category: "Mythic",
    priceLabel: "5.000",
    priceValue: BORDER_RARITY_PRICES.Mythic,
    image: BORDER_MAGIC_BOOK,
    scale: 1.15,
    offsetY: 0,
    description: "Kitab sihir kuno terikat mantra kosmik yang mengitari lingkaran avatar.",
  },
  {
    id: "white_mage",
    name: "White Mage Halo",
    category: "Legendary",
    priceLabel: "3.500",
    priceValue: BORDER_RARITY_PRICES.Legendary,
    image: BORDER_WHITE_MAGE,
    scale: 1.18,
    offsetY: 0,
    description: "Aura sihir suci putih memancarkan keanggunan pelindung misterius.",
  },
];

export default function AvatarDecorationsScreen() {
  const auth = useAnirakuAuth();
  const { width: windowWidth } = useWindowDimensions();

  // ─── Tabs & Filters ───
  const [activeTab, setActiveTab] = useState<"shop" | "collection">("shop");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<BorderCategory>("Semua");

  // ─── Ownership & Equipped States ───
  const [equippedBorderId, setEquippedBorderId] = useState<string | null>(null);
  const [ownedBorderIds, setOwnedBorderIds] = useState<string[]>([]);
  const [crystalBalance, setCrystalBalance] = useState<number>(0);

  // ─── Detail Modal ───
  const [selectedItemDetail, setSelectedItemDetail] = useState<BorderDecorationItem | null>(null);

  // Responsive 2-column card calculation
  const cardWidth = Math.floor((Math.min(windowWidth, 600) - 32 - 14) / 2);

  // Load saved borders & crystal balance
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_EQUIPPED_BORDER).then((v) => {
      if (v) setEquippedBorderId(v);
    });
    AsyncStorage.getItem(STORAGE_OWNED_BORDERS).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setOwnedBorderIds(parsed);
        } catch {}
      }
    });
    AsyncStorage.getItem(STORAGE_CRYSTAL_BALANCE).then((val) => {
      if (val !== null) {
        const num = parseInt(val, 10);
        if (!isNaN(num)) setCrystalBalance(num);
      }
    });
  }, []);

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
    return BORDER_CATALOG.filter((item) => {
      // Tab filter
      if (activeTab === "collection" && !ownedBorderIds.includes(item.id)) {
        return false;
      }
      // Category filter
      if (selectedCategory !== "Semua" && item.category !== selectedCategory) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(query);
        const matchCat = item.category.toLowerCase().includes(query);
        if (!matchName && !matchCat) return false;
      }
      return true;
    });
  }, [activeTab, ownedBorderIds, selectedCategory, searchQuery]);

  // Handle equip / unequip
  const handleToggleEquip = (borderId: string) => {
    hapticSuccess();
    const nextEquipped = equippedBorderId === borderId ? null : borderId;
    setEquippedBorderId(nextEquipped);
    if (nextEquipped) {
      void AsyncStorage.setItem(STORAGE_EQUIPPED_BORDER, nextEquipped);
    } else {
      void AsyncStorage.removeItem(STORAGE_EQUIPPED_BORDER);
    }
  };

  // Handle buy press
  const handleBuyPress = (item: BorderDecorationItem) => {
    hapticLight();
    const isOwned = ownedBorderIds.includes(item.id);
    if (isOwned) {
      handleToggleEquip(item.id);
      return;
    }

    // Check balance
    if (crystalBalance < item.priceValue) {
      hapticWarning();
      Alert.alert(
        "Crystal Tidak Cukup",
        `Saldo Anda saat ini ${crystalBalance.toLocaleString()} Crystal. Diperlukan ${item.priceLabel} Crystal untuk membeli ${item.name}.`,
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Top Up Crystal",
            onPress: () => {
              router.push("/topup" as never);
            },
          },
        ]
      );
      return;
    }

    // Purchase confirmation
    Alert.alert(
      "Beli Border Avatar?",
      `Beli ${item.name} seharga ${item.priceLabel} Crystal?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Beli & Pasang",
          onPress: async () => {
            const nextBalance = crystalBalance - item.priceValue;
            const nextOwned = [...ownedBorderIds, item.id];
            setCrystalBalance(nextBalance);
            setOwnedBorderIds(nextOwned);
            setEquippedBorderId(item.id);
            await AsyncStorage.setItem(STORAGE_CRYSTAL_BALANCE, String(nextBalance));
            await AsyncStorage.setItem(STORAGE_OWNED_BORDERS, JSON.stringify(nextOwned));
            await AsyncStorage.setItem(STORAGE_EQUIPPED_BORDER, item.id);
            hapticSuccess();
            Alert.alert("Berhasil!", `${item.name} berhasil dibeli dan dipasang di avatar Anda.`);
          },
        },
      ]
    );
  };

  // Find equipped border data for header preview
  const equippedItem = BORDER_CATALOG.find((b) => b.id === equippedBorderId);

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
        <Text style={styles.headerTitle}>Avatar Decorations</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 2. CARD INFORMASI AVATAR (UNDER HEADER) ─── */}
        <View style={styles.avatarProfileCard}>
          {/* Circular avatar on the left */}
          <View style={styles.profileAvatarWrapper}>
            {userAvatar ? (
              <Image source={{ uri: userAvatar }} style={styles.profileAvatarImg} contentFit="cover" />
            ) : (
              <View style={styles.profileAvatarFallback}>
                <Text style={styles.profileAvatarInitial}>{initialLetter}</Text>
              </View>
            )}

            {/* Live border overlay on user's avatar if equipped */}
            {equippedItem && (
              <Image
                source={equippedItem.image}
                style={[
                  styles.profileBorderOverlay,
                  {
                    transform: [
                      { scale: equippedItem.scale || 1.15 },
                      { translateY: equippedItem.offsetY || 0 },
                    ],
                  },
                ]}
                contentFit="contain"
              />
            )}
          </View>

          {/* Right info: Title, Status, and Crystal Balance */}
          <View style={styles.profileInfoRight}>
            <View style={styles.profileTitleRow}>
              <Text style={styles.profileCardTitle}>Border avatar</Text>
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
                >
                  {equippedItem ? equippedItem.name : "Belum dipakai"}
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
              Shop ({BORDER_CATALOG.length})
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

        {/* ─── 4. SEARCH BAR & FILTER KATEGORI ─── */}
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

          {/* Category Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChipsRow}
          >
            {(["Semua", "Mythic", "Legendary", "Epic", "Rare", "Normal"] as BorderCategory[]).map((cat) => {
              const isSelected = selectedCategory === cat;
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
                    {cat}
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
                ? "Anda belum memiliki koleksi border. Kunjungi tab Shop untuk memilih border idaman!"
                : "Coba ubah kata kunci pencarian atau ganti filter kategori."}
            </Text>
          </View>
        ) : (
          <View style={styles.bordersGrid}>
            {filteredBorders.map((border) => {
              const isOwned = ownedBorderIds.includes(border.id);
              const isEquipped = equippedBorderId === border.id;
              const hasEnoughCrystal = crystalBalance >= border.priceValue;

              return (
                <View key={border.id} style={[styles.borderCard, { width: cardWidth }]}>
                  {/* Category Badge di sudut kiri atas preview */}
                  <View style={styles.previewContainer}>
                    <View
                      style={[
                        styles.categoryBadge,
                        border.category === "Mythic"
                          ? styles.badgeMythic
                          : border.category === "Legendary"
                          ? styles.badgeLegendary
                          : border.category === "Epic"
                          ? styles.badgeEpic
                          : border.category === "Rare"
                          ? styles.badgeRare
                          : styles.badgeNormal,
                      ]}
                    >
                      <Text style={styles.categoryBadgeText}>{border.category.toUpperCase()}</Text>
                    </View>

                    {/* Preview avatar lingkaran di tengah */}
                    <View style={styles.previewAvatarWrap}>
                      {userAvatar ? (
                        <Image
                          source={{ uri: userAvatar }}
                          style={styles.previewAvatarImg}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.previewAvatarFallback}>
                          <Text style={styles.previewAvatarInitial}>{initialLetter}</Text>
                        </View>
                      )}

                      {/* Mentahan border membungkus avatar */}
                      <Image
                        source={border.image}
                        style={[
                          styles.previewBorderOverlay,
                          {
                            transform: [
                              { scale: border.scale || 1.15 },
                              { translateY: border.offsetY || 0 },
                            ],
                          },
                        ]}
                        contentFit="contain"
                      />
                    </View>
                  </View>

                  {/* Info Nama Border */}
                  <View style={styles.cardInfoWrap}>
                    <Text style={styles.borderNameText} numberOfLines={1}>
                      {border.name}
                    </Text>
                  </View>

                  {/* Tombol Harga & Status Kepemilikan */}
                  <View style={styles.cardActionWrap}>
                    {isOwned ? (
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
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => handleBuyPress(border)}
                        style={({ pressed }) => [
                          styles.actionBtnPrice,
                          pressed && styles.btnPressed,
                        ]}
                      >
                        <View style={styles.priceRow}>
                          <Image source={TOPUP_CRYSTAL_ICON} style={styles.priceCrystalIcon} contentFit="contain" />
                          <Text style={styles.priceNumberText}>{border.priceLabel}</Text>
                        </View>
                        {!hasEnoughCrystal && (
                          <Text style={styles.priceWarningText}>Crystal Kurang</Text>
                        )}
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
    backgroundColor: "#0B0E17", // Navy gelap elegan
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
    backgroundColor: "#13192B", // Navy sedikit lebih terang
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  profileAvatarWrapper: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  profileAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  profileAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarInitial: {
    fontFamily: "Nunito-Black",
    fontSize: 20,
    color: "#FFFFFF",
  },
  profileBorderOverlay: {
    position: "absolute",
    width: 66,
    height: 66,
    pointerEvents: "none",
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
    backgroundColor: "#1F2942", // Lebih terang
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
  previewContainer: {
    width: "100%",
    height: 145,
    backgroundColor: "#0A0D15", // Darker preview container
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
    zIndex: 2,
  },
  badgeMythic: {
    backgroundColor: "rgba(236, 72, 153, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(236, 72, 153, 0.55)",
  },
  badgeLegendary: {
    backgroundColor: "rgba(234, 179, 8, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.55)",
  },
  badgeEpic: {
    backgroundColor: "rgba(168, 85, 247, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.55)",
  },
  badgeRare: {
    backgroundColor: "rgba(56, 189, 248, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.55)",
  },
  badgeNormal: {
    backgroundColor: "rgba(148, 163, 184, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.4)",
  },
  categoryBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  previewAvatarWrap: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  previewAvatarImg: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  previewAvatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  previewAvatarInitial: {
    fontFamily: "Nunito-Black",
    fontSize: 22,
    color: "#94A3B8",
  },
  previewBorderOverlay: {
    position: "absolute",
    width: 86,
    height: 86,
    pointerEvents: "none",
  },
  cardInfoWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  borderNameText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
    textAlign: "center",
  },
  cardActionWrap: {
    padding: 10,
  },

  // Price button (Belum Dimiliki)
  actionBtnPrice: {
    backgroundColor: "rgba(217, 119, 6, 0.16)", // Cokelat keemasan
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
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
    color: "#FBBF24", // Warna emas
  },
  priceWarningText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#FCA5A5", // Merah muda lembut
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
});
