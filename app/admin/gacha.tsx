import React, { useEffect, useMemo, useState } from "react";
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
} from "react-native";
import { Image } from "expo-image";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  type AdminUser,
  type GachaConfig,
  logAdminAction,
} from "@/lib/admin-service";
import {
  type WallpaperItem,
  type WallpaperRarity,
  RARITY_CONFIG,
  isValidImageUrl,
} from "@/lib/gacha-data";
import {
  getAllGachaBanners,
  addGachaBanner,
  updateGachaBanner,
  deleteGachaBanner,
  toggleGachaBannerActive,
  getGachaConfig,
  saveGachaConfig,
  type DynamicGachaConfig,
} from "@/lib/gacha-service";
import { sendMassGift } from "@/lib/mailbox-service";

type ActiveTab = "banners" | "pricing" | "gifts";

export default function AdminGachaScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("banners");
  const [loading, setLoading] = useState(true);

  // ─── GACHA CONFIG STATE ───
  const [gachaConfig, setGachaConfig] = useState<DynamicGachaConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // ─── BANNERS LIST STATE ───
  const [banners, setBanners] = useState<WallpaperItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRarityFilter, setSelectedRarityFilter] = useState<string>("ALL");

  // ─── BANNER FORM MODAL STATE ───
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<WallpaperItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formAnime, setFormAnime] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formRarity, setFormRarity] = useState<WallpaperRarity>("Normal");
  const [formIsActive, setFormIsActive] = useState(true);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);

  // ─── DELETE CONFIRM MODAL STATE ───
  const [bannerToDelete, setBannerToDelete] = useState<WallpaperItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── MAILBOX MASS GIFT STATE ───
  const [giftTitle, setGiftTitle] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftType, setGiftType] = useState<"crystal" | "border">("crystal");
  const [giftValue, setGiftValue] = useState("100");
  const [showGiftConfirm, setShowGiftConfirm] = useState(false);
  const [sendingGift, setSendingGift] = useState(false);

  const mockAdmin: AdminUser = {
    id: "admin-super",
    email: "superadmin@nuenime.com",
    username: "Super Admin",
    role: "super_admin",
  };

  // ─── LOAD DATA ───
  const loadData = async () => {
    setLoading(true);
    try {
      const [cfg, bList] = await Promise.all([
        getGachaConfig(),
        getAllGachaBanners(),
      ]);
      setGachaConfig(cfg);
      setBanners(bList);
    } catch (err) {
      console.warn("[AdminGacha] Error loading data:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // ─── FILTERED BANNERS ───
  const filteredBanners = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return banners.filter((b) => {
      if (selectedRarityFilter !== "ALL" && b.rarity !== selectedRarityFilter) {
        return false;
      }
      if (q && !b.name.toLowerCase().includes(q) && !b.anime.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [banners, searchQuery, selectedRarityFilter]);

  const activeBannersCount = useMemo(() => {
    return banners.filter((b) => b.isActive !== false).length;
  }, [banners]);

  // Total rate check
  const totalRate = useMemo(() => {
    if (!gachaConfig) return 100;
    const r = gachaConfig.rates;
    return (
      (r.mythic || 0) +
      (r.legends || 0) +
      (r.epic || 0) +
      (r.rare || 0) +
      (r.normal || 0)
    );
  }, [gachaConfig]);

  // ─── PRICING SAVE HANDLER ───
  const handleSaveGachaConfig = async () => {
    if (!gachaConfig) return;
    if (gachaConfig.costSingle < 0 || gachaConfig.costMulti < 0) {
      Alert.alert("Nilai Tidak Valid", "Biaya gacha tidak boleh bernilai negatif.");
      return;
    }

    setSavingConfig(true);
    try {
      await saveGachaConfig(gachaConfig, mockAdmin);
      hapticSuccess();
      Alert.alert("Tersimpan 🎉", "Biaya gacha dan pengaturan drop rate berhasil disimpan ke database!");
    } catch (err: any) {
      hapticWarning();
      Alert.alert("Gagal Menyimpan", err?.message || "Terjadi kesalahan saat menyimpan.");
    }
    setSavingConfig(false);
  };

  // ─── BANNER FORM HANDLERS ───
  const handleOpenAddBanner = () => {
    hapticLight();
    setEditingBanner(null);
    setFormName("");
    setFormAnime("");
    setFormImage("");
    setFormRarity("Normal");
    setFormIsActive(true);
    setImageLoadError(false);
    setShowBannerModal(true);
  };

  const handleOpenEditBanner = (b: WallpaperItem) => {
    hapticLight();
    setEditingBanner(b);
    setFormName(b.name);
    setFormAnime(b.anime || "");
    setFormImage(b.image);
    setFormRarity(b.rarity);
    setFormIsActive(b.isActive !== false);
    setImageLoadError(false);
    setShowBannerModal(true);
  };

  const handleSaveBanner = async () => {
    if (!formName.trim()) {
      Alert.alert("Input Kurang", "Nama banner wajib diisi.");
      return;
    }
    if (!formImage.trim() || !isValidImageUrl(formImage)) {
      Alert.alert("URL Tidak Valid", "Masukkan URL gambar banner yang diawali http:// atau https://");
      return;
    }

    setSavingBanner(true);
    try {
      if (editingBanner) {
        // Edit existing banner
        const updated: WallpaperItem = {
          ...editingBanner,
          name: formName.trim(),
          anime: formAnime.trim(),
          image: formImage.trim(),
          rarity: formRarity,
          isActive: formIsActive,
        };
        const res = await updateGachaBanner(updated, mockAdmin);
        if (!res.success) {
          Alert.alert("Gagal", res.error || "Gagal mengupdate banner.");
          setSavingBanner(false);
          return;
        }
        setBanners((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
        hapticSuccess();
        Alert.alert("Berhasil", `Banner "${updated.name}" berhasil diperbarui.`);
      } else {
        // Add new banner
        const res = await addGachaBanner(
          {
            name: formName.trim(),
            anime: formAnime.trim(),
            image: formImage.trim(),
            rarity: formRarity,
            isActive: formIsActive,
          },
          mockAdmin
        );
        if (!res.success || !res.data) {
          Alert.alert("Gagal", res.error || "Gagal menambahkan banner.");
          setSavingBanner(false);
          return;
        }
        setBanners((prev) => [res.data!, ...prev]);
        hapticSuccess();
        Alert.alert("Berhasil 🎉", `Banner baru "${res.data.name}" berhasil ditambahkan ke pool!`);
      }
      setShowBannerModal(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Terjadi kesalahan sistem.");
    }
    setSavingBanner(false);
  };

  // ─── TOGGLE BANNER ACTIVE ───
  const handleToggleActive = async (b: WallpaperItem) => {
    const nextState = !b.isActive;
    hapticLight();
    setBanners((prev) => prev.map((item) => (item.id === b.id ? { ...item, isActive: nextState } : item)));
    await toggleGachaBannerActive(b.id, nextState, mockAdmin);
  };

  // ─── DELETE BANNER ───
  const handleConfirmDelete = async () => {
    if (!bannerToDelete) return;
    setDeleting(true);
    try {
      const res = await deleteGachaBanner(bannerToDelete.id, mockAdmin);
      if (!res.success) {
        Alert.alert("Gagal Hapus", res.error || "Tidak dapat menghapus banner.");
        setDeleting(false);
        return;
      }
      setBanners((prev) => prev.filter((b) => b.id !== bannerToDelete.id));
      hapticSuccess();
      Alert.alert("Terhapus", `Banner "${bannerToDelete.name}" berhasil dihapus.`);
      setBannerToDelete(null);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Gagal menghapus banner.");
    }
    setDeleting(false);
  };

  // ─── MAILBOX MASS GIFT ───
  const handleSendMassGift = async () => {
    if (!giftTitle.trim() || !giftMessage.trim()) {
      Alert.alert("Input Kosong", "Judul dan pesan hadiah wajib diisi.");
      return;
    }

    setSendingGift(true);
    try {
      const res = await sendMassGift(
        {
          title: giftTitle,
          message: giftMessage,
          giftType: giftType,
          giftValue: giftValue,
        },
        mockAdmin
      );

      if (!res.success) {
        Alert.alert("Gagal Kirim", res.error || "Gagal menyiarkan hadiah.");
        setSendingGift(false);
        return;
      }

      setSendingGift(false);
      setShowGiftConfirm(false);
      setGiftTitle("");
      setGiftMessage("");
      hapticSuccess();
      Alert.alert(
        "Hadiah Terkirim 🎉",
        `Hadiah massal "${giftTitle}" berhasil disimpan ke database dan disiarkan ke seluruh pemain!`
      );
    } catch (err: any) {
      setSendingGift(false);
      Alert.alert("Error", err?.message || "Terjadi kesalahan sistem.");
    }
  };

  return (
    <AdminLayout
      title="Gacha & Koleksi Banner"
      subtitle="Kelola banner profil (GIF, PNG, JPG), biaya spin Dylan Crystal, dan drop rates gacha"
    >
      {/* ─── TAB NAVIGATION ─── */}
      <View style={styles.tabNavWrap}>
        <Pressable
          onPress={() => {
            hapticLight();
            setActiveTab("banners");
          }}
          style={[styles.tabBtn, activeTab === "banners" && styles.tabBtnActive]}
        >
          <AppIcon
            name="image-multiple-outline"
            size={16}
            color={activeTab === "banners" ? "#8C57FF" : "#94A3B8"}
          />
          <Text style={[styles.tabBtnText, activeTab === "banners" && styles.tabBtnTextActive]}>
            Koleksi Banner ({banners.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            hapticLight();
            setActiveTab("pricing");
          }}
          style={[styles.tabBtn, activeTab === "pricing" && styles.tabBtnActive]}
        >
          <AppIcon
            name="cash-multiple"
            size={16}
            color={activeTab === "pricing" ? "#8C57FF" : "#94A3B8"}
          />
          <Text style={[styles.tabBtnText, activeTab === "pricing" && styles.tabBtnTextActive]}>
            Biaya & Drop Rates
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            hapticLight();
            setActiveTab("gifts");
          }}
          style={[styles.tabBtn, activeTab === "gifts" && styles.tabBtnActive]}
        >
          <AppIcon
            name="gift-outline"
            size={16}
            color={activeTab === "gifts" ? "#8C57FF" : "#94A3B8"}
          />
          <Text style={[styles.tabBtnText, activeTab === "gifts" && styles.tabBtnTextActive]}>
            Hadiah Massal
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#8C57FF" style={{ padding: 40 }} />
      ) : (
        <View style={styles.contentWrap}>
          {/* ══════════════════════════════════════════════════════
              TAB 1: KOLEKSI BANNER PROFIL & POOL GACHA
             ══════════════════════════════════════════════════════ */}
          {activeTab === "banners" && (
            <View style={styles.tabContent}>
              {/* Header Info & Add Button */}
              <View style={styles.bannerHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Daftar Banner Profil Pengguna</Text>
                  <Text style={styles.sectionSubtitle}>
                    Mendukung format GIF (animasi), PNG, dan JPG via URL gambar eksternal.
                    {"\n"}
                    <Text style={{ color: "#10B981", fontWeight: "700" }}>{activeBannersCount}</Text> banner aktif di pool gacha dari total {banners.length} banner.
                  </Text>
                </View>

                <Pressable onPress={handleOpenAddBanner} style={styles.addBannerBtn}>
                  <AppIcon name="plus" size={18} color="#FFFFFF" />
                  <Text style={styles.addBannerBtnText}>Tambah Banner</Text>
                </Pressable>
              </View>

              {/* Search & Rarity Filter Pills */}
              <View style={styles.searchAndFilterRow}>
                <View style={styles.searchBox}>
                  <AppIcon name="magnify" size={16} color="#64748B" />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Cari banner atau judul anime..."
                    placeholderTextColor="#64748B"
                    style={styles.searchInput}
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
                      <AppIcon name="close-circle" size={16} color="#94A3B8" />
                    </Pressable>
                  )}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rarityPillsScroll}
                >
                  {["ALL", "Mythic", "Legendary", "Epic", "Rare", "Normal"].map((r) => {
                    const isSelected = selectedRarityFilter === r;
                    const meta = r === "ALL" ? null : RARITY_CONFIG[r as WallpaperRarity];
                    return (
                      <Pressable
                        key={r}
                        onPress={() => setSelectedRarityFilter(r)}
                        style={[
                          styles.rarityPill,
                          isSelected && styles.rarityPillActive,
                          meta && isSelected && { borderColor: meta.color, backgroundColor: meta.bgColor },
                        ]}
                      >
                        <Text
                          style={[
                            styles.rarityPillText,
                            isSelected && { color: meta ? meta.color : "#8C57FF", fontWeight: "700" },
                          ]}
                        >
                          {r === "ALL" ? "Semua Rarity" : r}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Banners Grid / List */}
              {filteredBanners.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <AppIcon name="image-off-outline" size={42} color="#64748B" />
                  <Text style={styles.emptyTitle}>Tidak ada banner yang cocok</Text>
                  <Text style={styles.emptySubtitle}>
                    Coba sesuaikan kata kunci pencarian atau ubah filter kelangkaan.
                  </Text>
                </View>
              ) : (
                <View style={styles.bannersGrid}>
                  {filteredBanners.map((item) => {
                    const rMeta = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.Normal;
                    const isGif = item.image.toLowerCase().includes(".gif");

                    return (
                      <View key={item.id} style={styles.bannerCard}>
                        {/* Banner Image Preview Container */}
                        <View style={styles.bannerImageWrap}>
                          <Image
                            source={{ uri: item.image }}
                            style={styles.bannerImage}
                            contentFit="cover"
                            transition={200}
                          />

                          {/* Top Badges */}
                          <View style={styles.bannerBadgeTopRow}>
                            <View
                              style={[
                                styles.rarityBadge,
                                { backgroundColor: rMeta.bgColor, borderColor: rMeta.borderColor },
                              ]}
                            >
                              <Text style={[styles.rarityBadgeText, { color: rMeta.color }]}>
                                {item.rarity}
                              </Text>
                            </View>

                            {isGif && (
                              <View style={styles.gifBadge}>
                                <Text style={styles.gifBadgeText}>GIF</Text>
                              </View>
                            )}
                          </View>

                          {/* Status Overlay if Inactive */}
                          {!item.isActive && (
                            <View style={styles.inactiveOverlay}>
                              <Text style={styles.inactiveOverlayText}>NONAKTIF DI GACHA</Text>
                            </View>
                          )}
                        </View>

                        {/* Banner Details */}
                        <View style={styles.bannerBody}>
                          <Text style={styles.bannerName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.bannerAnime} numberOfLines={1}>
                            {item.anime || "Anime Collection"}
                          </Text>

                          <View style={styles.bannerFooterRow}>
                            {/* Toggle Active Switch */}
                            <Pressable
                              onPress={() => handleToggleActive(item)}
                              style={[
                                styles.activeToggleBtn,
                                item.isActive ? styles.activeToggleBtnOn : styles.activeToggleBtnOff,
                              ]}
                            >
                              <View
                                style={[
                                  styles.activeDot,
                                  { backgroundColor: item.isActive ? "#10B981" : "#64748B" },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.activeToggleText,
                                  { color: item.isActive ? "#10B981" : "#94A3B8" },
                                ]}
                              >
                                {item.isActive ? "Aktif di Pool" : "Nonaktif"}
                              </Text>
                            </Pressable>

                            {/* Action Buttons */}
                            <View style={styles.bannerActionBtns}>
                              <Pressable
                                onPress={() => handleOpenEditBanner(item)}
                                style={styles.iconBtn}
                                hitSlop={8}
                              >
                                <AppIcon name="pencil" size={15} color="#38BDF8" />
                              </Pressable>

                              <Pressable
                                onPress={() => setBannerToDelete(item)}
                                style={styles.iconBtn}
                                hitSlop={8}
                              >
                                <AppIcon name="trash-can-outline" size={15} color="#EF4444" />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 2: BIAYA SPIN & DROP RATES
             ══════════════════════════════════════════════════════ */}
          {activeTab === "pricing" && gachaConfig && (
            <View style={styles.tabContent}>
              <View style={styles.cardBox}>
                <Text style={styles.cardBoxTitle}>💰 Pengaturan Biaya Spin Dylan Crystal</Text>
                <Text style={styles.cardBoxSubtitle}>
                  Biaya Crystal yang ditetapkan di sini akan langsung digunakan oleh aplikasi saat pengguna melakukan summon.
                  Divalidasi di backend & database secara persisten.
                </Text>

                <View style={styles.rowTwoCols}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Biaya 1x Spin (Crystal):</Text>
                    <TextInput
                      value={String(gachaConfig.costSingle)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({ ...gachaConfig, costSingle: parseInt(t, 10) || 0 })
                      }
                      style={styles.fieldInput}
                    />
                    <Text style={styles.fieldHint}>Standar: 1.000 Dylan Crystal</Text>
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Biaya 10x Spin (Crystal):</Text>
                    <TextInput
                      value={String(gachaConfig.costMulti)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({ ...gachaConfig, costMulti: parseInt(t, 10) || 0 })
                      }
                      style={styles.fieldInput}
                    />
                    <Text style={styles.fieldHint}>Standar: 9.000 Dylan Crystal (Diskon 10%)</Text>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Judul Banner Promo Gacha:</Text>
                  <TextInput
                    value={gachaConfig.bannerTitle}
                    onChangeText={(t) => setGachaConfig({ ...gachaConfig, bannerTitle: t })}
                    style={styles.fieldInput}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Deskripsi Banner Promo:</Text>
                  <TextInput
                    value={gachaConfig.bannerDesc}
                    onChangeText={(t) => setGachaConfig({ ...gachaConfig, bannerDesc: t })}
                    style={styles.fieldInput}
                  />
                </View>

                <View style={styles.formDivider} />

                {/* Drop Rates */}
                <View style={styles.ratesHeaderRow}>
                  <View>
                    <Text style={styles.subTitle}>Peluang Drop Rate Per Rarity (%):</Text>
                    <Text style={styles.ratesSub}>
                      Persentase peluang munculnya masing-masing tingkat kelangkaan saat gacha.
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.totalRateBadge,
                      Math.abs(totalRate - 100) < 0.01 ? styles.totalRateOk : styles.totalRateWarn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.totalRateText,
                        Math.abs(totalRate - 100) < 0.01 ? { color: "#10B981" } : { color: "#F59E0B" },
                      ]}
                    >
                      Total: {totalRate.toFixed(1)}%
                    </Text>
                  </View>
                </View>

                <View style={styles.ratesGrid}>
                  <View style={styles.rateBox}>
                    <Text style={[styles.rateLabel, { color: "#EC4899" }]}>Mythic (%)</Text>
                    <TextInput
                      value={String(gachaConfig.rates.mythic)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({
                          ...gachaConfig,
                          rates: { ...gachaConfig.rates, mythic: parseFloat(t) || 0 },
                        })
                      }
                      style={styles.fieldInputSmall}
                    />
                  </View>

                  <View style={styles.rateBox}>
                    <Text style={[styles.rateLabel, { color: "#EAB308" }]}>Legends (%)</Text>
                    <TextInput
                      value={String(gachaConfig.rates.legends)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({
                          ...gachaConfig,
                          rates: { ...gachaConfig.rates, legends: parseFloat(t) || 0 },
                        })
                      }
                      style={styles.fieldInputSmall}
                    />
                  </View>

                  <View style={styles.rateBox}>
                    <Text style={[styles.rateLabel, { color: "#A855F7" }]}>Epic (%)</Text>
                    <TextInput
                      value={String(gachaConfig.rates.epic)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({
                          ...gachaConfig,
                          rates: { ...gachaConfig.rates, epic: parseFloat(t) || 0 },
                        })
                      }
                      style={styles.fieldInputSmall}
                    />
                  </View>

                  <View style={styles.rateBox}>
                    <Text style={[styles.rateLabel, { color: "#38BDF8" }]}>Rare (%)</Text>
                    <TextInput
                      value={String(gachaConfig.rates.rare)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({
                          ...gachaConfig,
                          rates: { ...gachaConfig.rates, rare: parseFloat(t) || 0 },
                        })
                      }
                      style={styles.fieldInputSmall}
                    />
                  </View>

                  <View style={styles.rateBox}>
                    <Text style={[styles.rateLabel, { color: "#94A3B8" }]}>Normal (%)</Text>
                    <TextInput
                      value={String(gachaConfig.rates.normal)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({
                          ...gachaConfig,
                          rates: { ...gachaConfig.rates, normal: parseFloat(t) || 0 },
                        })
                      }
                      style={styles.fieldInputSmall}
                    />
                  </View>
                </View>

                {Math.abs(totalRate - 100) >= 0.01 && (
                  <Text style={styles.warnRateText}>
                    ⚠️ Perhatian: Total drop rate saat ini {totalRate.toFixed(1)}%. Disarankan agar total persentase tepat bernilai 100.0%.
                  </Text>
                )}

                <Pressable
                  disabled={savingConfig}
                  onPress={handleSaveGachaConfig}
                  style={styles.saveBtn}
                >
                  {savingConfig ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <AppIcon name="content-save-outline" size={18} color="#FFFFFF" />
                  )}
                  <Text style={styles.saveBtnText}>
                    {savingConfig ? "Menyimpan ke Database..." : "Simpan Pengaturan Biaya & Drop Rates"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 3: HADIAH MASSAL (MAILBOX BROADCAST)
             ══════════════════════════════════════════════════════ */}
          {activeTab === "gifts" && (
            <View style={styles.tabContent}>
              <View style={styles.cardBox}>
                <Text style={styles.cardBoxTitle}>🎁 Kirim Hadiah Massal (Mailbox Broadcast)</Text>
                <Text style={styles.cardBoxSubtitle}>
                  Kirimkan Dylan Crystal atau Border gratis kepada seluruh pengguna aplikasi untuk
                  perayaan event atau kompensasi maintenance.
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Judul Hadiah:</Text>
                  <TextInput
                    value={giftTitle}
                    onChangeText={setGiftTitle}
                    placeholder="Contoh: Hadiah Spesial Perayaan Rilis Nuenime v0.0.1"
                    placeholderTextColor="#64748B"
                    style={styles.fieldInput}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Pesan untuk Pengguna:</Text>
                  <TextInput
                    value={giftMessage}
                    onChangeText={setGiftMessage}
                    placeholder="Terima kasih atas dukungan Anda menonton anime di Nuenime!"
                    placeholderTextColor="#64748B"
                    style={styles.fieldInput}
                  />
                </View>

                <View style={styles.rowTwoCols}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Jenis Hadiah:</Text>
                    <View style={styles.giftTypeRow}>
                      <Pressable
                        onPress={() => setGiftType("crystal")}
                        style={[styles.giftTypeBtn, giftType === "crystal" && styles.giftTypeBtnActive]}
                      >
                        <Text style={styles.giftTypeBtnText}>Crystal</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setGiftType("border")}
                        style={[styles.giftTypeBtn, giftType === "border" && styles.giftTypeBtnActive]}
                      >
                        <Text style={styles.giftTypeBtnText}>Border Avatar</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>
                      {giftType === "crystal" ? "Jumlah Crystal:" : "ID Border Avatar:"}
                    </Text>
                    <TextInput
                      value={giftValue}
                      onChangeText={setGiftValue}
                      placeholder={giftType === "crystal" ? "100" : "rare_06"}
                      placeholderTextColor="#64748B"
                      style={styles.fieldInput}
                    />
                  </View>
                </View>

                <Pressable
                  onPress={() => setShowGiftConfirm(true)}
                  style={styles.sendGiftBtn}
                >
                  <AppIcon name="gift-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.sendGiftBtnText}>Kirim Hadiah ke Semua Pemain</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL: TAMBAH / EDIT BANNER PROFIL
         ══════════════════════════════════════════════════════ */}
      <Modal visible={showBannerModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCardLarge}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingBanner ? "Edit Banner Profil" : "Tambah Banner Profil Baru"}
                </Text>
                <Text style={styles.modalSub}>
                  Mendukung GIF animasi, PNG, dan JPG. Banner aktif otomatis masuk ke pool hadiah gacha.
                </Text>
              </View>
              <Pressable
                onPress={() => setShowBannerModal(false)}
                style={styles.modalCloseBtn}
                hitSlop={10}
              >
                <AppIcon name="close" size={20} color="#94A3B8" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalFormContent}>
              {/* Live Preview Kotak Gambar */}
              <View style={styles.previewBoxWrapper}>
                <Text style={styles.previewBoxLabel}>PRATINJAU GAMBAR BANNER (LIVE PREVIEW):</Text>
                <View style={styles.previewFrame}>
                  {formImage.trim() && isValidImageUrl(formImage) ? (
                    <Image
                      source={{ uri: formImage.trim() }}
                      style={styles.previewImage}
                      contentFit="cover"
                      transition={200}
                      onError={() => setImageLoadError(true)}
                      onLoad={() => setImageLoadError(false)}
                    />
                  ) : (
                    <View style={styles.previewPlaceholder}>
                      <AppIcon name="image-outline" size={36} color="#64748B" />
                      <Text style={styles.previewPlaceholderText}>
                        Masukkan URL gambar di bawah untuk melihat pratinjau
                      </Text>
                    </View>
                  )}

                  {imageLoadError && (
                    <View style={styles.previewErrorOverlay}>
                      <AppIcon name="alert-circle-outline" size={24} color="#EF4444" />
                      <Text style={styles.previewErrorText}>Gambar gagal dimuat dari URL ini</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Form Input: URL Gambar */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>URL Gambar Banner (GIF / PNG / JPG): *</Text>
                <TextInput
                  value={formImage}
                  onChangeText={(t) => {
                    setFormImage(t);
                    setImageLoadError(false);
                  }}
                  placeholder="https://images.alphacoders.com/... atau https://media.giphy.com/.../giphy.gif"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.fieldInput,
                    formImage.trim().length > 0 &&
                      (isValidImageUrl(formImage) ? styles.inputValid : styles.inputInvalid),
                  ]}
                />
                <Text style={styles.fieldHint}>
                  Pastikan URL langsung menuju file gambar atau file GIF animasi (.gif).
                </Text>
              </View>

              {/* Form Input: Nama Banner & Anime */}
              <View style={styles.rowTwoCols}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Nama Banner: *</Text>
                  <TextInput
                    value={formName}
                    onChangeText={setFormName}
                    placeholder="Contoh: Satoru Gojo Void"
                    placeholderTextColor="#64748B"
                    style={styles.fieldInput}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Judul Anime / Karakter:</Text>
                  <TextInput
                    value={formAnime}
                    onChangeText={setFormAnime}
                    placeholder="Contoh: Jujutsu Kaisen"
                    placeholderTextColor="#64748B"
                    style={styles.fieldInput}
                  />
                </View>
              </View>

              {/* Form Input: Rarity Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Tingkat Kelangkaan (Rarity): *</Text>
                <View style={styles.raritySelectorRow}>
                  {(["Mythic", "Legendary", "Epic", "Rare", "Normal"] as WallpaperRarity[]).map((r) => {
                    const isSelected = formRarity === r;
                    const rMeta = RARITY_CONFIG[r];
                    return (
                      <Pressable
                        key={r}
                        onPress={() => setFormRarity(r)}
                        style={[
                          styles.raritySelectBtn,
                          isSelected && {
                            borderColor: rMeta.color,
                            backgroundColor: rMeta.bgColor,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.raritySelectBtnText,
                            isSelected && { color: rMeta.color, fontWeight: "700" },
                          ]}
                        >
                          {r}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Form Input: Active in Pool Toggle */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Aktifkan di Pool Hadiah Gacha</Text>
                  <Text style={styles.toggleSub}>
                    Jika dinonaktifkan, banner ini tidak dapat diperoleh oleh pemain dari gacha baru.
                  </Text>
                </View>
                <Switch
                  value={formIsActive}
                  onValueChange={setFormIsActive}
                  trackColor={{ false: "#334155", true: "#8C57FF" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setShowBannerModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>

              <Pressable
                disabled={savingBanner}
                onPress={handleSaveBanner}
                style={styles.modalConfirmBtn}
              >
                {savingBanner ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <AppIcon name="check" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.modalConfirmText}>
                  {savingBanner ? "Menyimpan..." : editingBanner ? "Simpan Perubahan" : "Tambahkan ke Pool"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════
          MODAL: KONFIRMASI HAPUS BANNER
         ══════════════════════════════════════════════════════ */}
      <Modal visible={Boolean(bannerToDelete)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.deleteIconWrap}>
              <AppIcon name="alert-outline" size={32} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Hapus Banner Profil?</Text>
            <Text style={styles.modalSub}>
              Apakah Anda yakin ingin menghapus banner <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>"{bannerToDelete?.name}"</Text>?
              {"\n\n"}
              Banner ini tidak akan muncul lagi di pool gacha. Pemain yang sudah memilikinya di profil tidak akan kehilangan banner ini.
            </Text>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setBannerToDelete(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>

              <Pressable
                disabled={deleting}
                onPress={handleConfirmDelete}
                style={[styles.modalConfirmBtn, { backgroundColor: "#EF4444" }]}
              >
                <Text style={styles.modalConfirmText}>
                  {deleting ? "Menghapus..." : "Ya, Hapus Banner"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════
          MODAL: KONFIRMASI HADIAH MASSAL
         ══════════════════════════════════════════════════════ */}
      <Modal visible={showGiftConfirm} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Konfirmasi Pengiriman Hadiah Massal</Text>
            <Text style={styles.modalSub}>
              Hadiah akan didistribusikan ke seluruh akun pengguna aktif Nuenime:
              {"\n"}• Judul: {giftTitle}
              {"\n"}• Hadiah: {giftValue} {giftType === "crystal" ? "Dylan Crystal" : "Border ID"}
            </Text>
            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setShowGiftConfirm(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                disabled={sendingGift}
                onPress={handleSendMassGift}
                style={styles.modalConfirmBtn}
              >
                <Text style={styles.modalConfirmText}>
                  {sendingGift ? "Mengirim..." : "Ya, Kirim Sekarang"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  contentWrap: {
    gap: 20,
  },
  tabNavWrap: {
    flexDirection: "row",
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 6,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: "rgba(140, 87, 255, 0.16)",
    borderWidth: 1,
    borderColor: "#8C57FF",
  },
  tabBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#94A3B8",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },
  tabContent: {
    gap: 16,
  },
  bannerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
  },
  sectionSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
    marginTop: 2,
    lineHeight: 18,
  },
  addBannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#8C57FF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBannerBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  searchAndFilterRow: {
    gap: 10,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#211D36",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#FFFFFF",
    padding: 0,
  },
  rarityPillsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  rarityPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#211D36",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  rarityPillActive: {
    backgroundColor: "rgba(140, 87, 255, 0.15)",
    borderColor: "#8C57FF",
  },
  rarityPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "#211D36",
    borderRadius: 12,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
    marginTop: 6,
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
    textAlign: "center",
  },
  bannersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  bannerCard: {
    width: Platform.OS === "web" ? "calc(33.333% - 10px)" as any : "48%",
    minWidth: 260,
    backgroundColor: "#211D36",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  bannerImageWrap: {
    width: "100%",
    height: 120,
    backgroundColor: "#161329",
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerBadgeTopRow: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  rarityBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
    textTransform: "uppercase",
  },
  gifBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  gifBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
    color: "#38BDF8",
  },
  inactiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveOverlayText: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
    color: "#F87171",
    letterSpacing: 0.5,
  },
  bannerBody: {
    padding: 12,
    gap: 6,
  },
  bannerName: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  bannerAnime: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  bannerFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  activeToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  activeToggleBtnOn: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  activeToggleBtnOff: {
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeToggleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
  },
  bannerActionBtns: {
    flexDirection: "row",
    gap: 6,
  },
  iconBtn: {
    padding: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cardBox: {
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 14,
  },
  cardBoxTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  cardBoxSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 16,
  },
  formGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },
  fieldInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#FFFFFF",
  },
  inputValid: {
    borderColor: "#10B981",
  },
  inputInvalid: {
    borderColor: "#EF4444",
  },
  fieldHint: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },
  rowTwoCols: {
    flexDirection: "row",
    gap: 12,
  },
  formDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 4,
  },
  ratesHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  ratesSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  totalRateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  totalRateOk: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
  },
  totalRateWarn: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "#F59E0B",
  },
  totalRateText: {
    fontFamily: "Nunito-Black",
    fontSize: 11.5,
  },
  ratesGrid: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  rateBox: {
    flex: 1,
    minWidth: 80,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 6,
    alignItems: "center",
  },
  rateLabel: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
    textTransform: "uppercase",
  },
  fieldInputSmall: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    textAlign: "center",
    width: "100%",
  },
  warnRateText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#F59E0B",
    lineHeight: 16,
  },
  saveBtn: {
    backgroundColor: "#8C57FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 6,
  },
  saveBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  giftTypeRow: {
    flexDirection: "row",
    gap: 8,
  },
  giftTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  giftTypeBtnActive: {
    backgroundColor: "#8C57FF",
    borderColor: "#8C57FF",
  },
  giftTypeBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  sendGiftBtn: {
    backgroundColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  sendGiftBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCardLarge: {
    width: "100%",
    maxWidth: 600,
    maxHeight: "90%",
    backgroundColor: "#211D36",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    gap: 14,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#211D36",
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    gap: 14,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 17,
    color: "#FFFFFF",
  },
  modalSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 18,
    marginTop: 4,
  },
  modalFormContent: {
    gap: 14,
    paddingVertical: 6,
  },
  previewBoxWrapper: {
    gap: 6,
  },
  previewBoxLabel: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
    color: "#A78BFA",
    letterSpacing: 0.5,
  },
  previewFrame: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    backgroundColor: "#161329",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 20,
  },
  previewPlaceholderText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    textAlign: "center",
  },
  previewErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  previewErrorText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#EF4444",
  },
  raritySelectorRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  raritySelectBtn: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  raritySelectBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  toggleLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  toggleSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  deleteIconWrap: {
    alignSelf: "center",
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  modalCancelText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#CBD5E1",
  },
  modalConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#8C57FF",
  },
  modalConfirmText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
});
