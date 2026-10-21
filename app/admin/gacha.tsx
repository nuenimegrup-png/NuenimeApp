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
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  type AdminUser,
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
import {
  sendMassGift,
  getAllAdminGifts,
  deleteSystemGift,
  type SystemGift,
} from "@/lib/mailbox-service";
import {
  fetchLiveBorderCatalog,
  type AvatarBorder,
  RARITY_THEME as BORDER_RARITY_THEME,
} from "@/lib/avatar-borders";
import { useAnirakuAuth } from "@/providers/auth-provider";

type ActiveTab = "banners" | "pricing" | "simulator" | "gifts";
type StatusFilter = "all" | "active" | "inactive" | "has_url" | "no_url";

interface SimResultItem {
  name: string;
  rarity: WallpaperRarity;
  color: string;
  image?: string;
}

export default function AdminGachaScreen() {
  const auth = useAnirakuAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>("banners");
  const [loading, setLoading] = useState(true);

  // ─── GACHA CONFIG STATE ───
  const [gachaConfig, setGachaConfig] = useState<DynamicGachaConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // ─── BANNERS LIST STATE (DEDUPLICATED) ───
  const [banners, setBanners] = useState<WallpaperItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRarityFilter, setSelectedRarityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);

  // ─── BANNER FORM MODAL STATE ───
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<WallpaperItem | null>(null);
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formAnime, setFormAnime] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formRarity, setFormRarity] = useState<WallpaperRarity>("Normal");
  const [formIsActive, setFormIsActive] = useState(true);
  const [savingBanner, setSavingBanner] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formGeneralError, setFormGeneralError] = useState<string | null>(null);

  // ─── DELETE CONFIRM MODAL STATE (WITH AUTOMATIC 100% REFUND) ───
  const [bannerToDelete, setBannerToDelete] = useState<WallpaperItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── FLOATING ACTION TOAST (SESUAI ADMIN BORDERS) ───
  const [actionToast, setActionToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setActionToast({ message, type });
    setTimeout(() => setActionToast(null), 4000);
  };

  // ─── SIMULATOR STATE ───
  const [simResults, setSimResults] = useState<SimResultItem[]>([]);
  const [simHistory, setSimHistory] = useState<{ mythic: number; legends: number; epic: number; rare: number; normal: number; total: number }>({
    mythic: 0,
    legends: 0,
    epic: 0,
    rare: 0,
    normal: 0,
    total: 0,
  });

  // ─── MAILBOX MASS GIFT STATE ───
  const [giftTitle, setGiftTitle] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftType, setGiftType] = useState<"crystal" | "border">("crystal");
  const [giftValue, setGiftValue] = useState("100");
  const [showGiftConfirm, setShowGiftConfirm] = useState(false);
  const [sendingGift, setSendingGift] = useState(false);
  const [adminGifts, setAdminGifts] = useState<SystemGift[]>([]);
  const [loadingGifts, setLoadingGifts] = useState(false);
  const [giftToDelete, setGiftToDelete] = useState<SystemGift | null>(null);
  const [deletingGift, setDeletingGift] = useState(false);
  const [availableBorders, setAvailableBorders] = useState<AvatarBorder[]>([]);
  const [showBorderDropdown, setShowBorderDropdown] = useState(false);

  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const adminUser: AdminUser = auth.user
    ? {
        id: auth.user.id,
        email: auth.user.email ?? "admin@nuenime.com",
        username:
          auth.profile?.display_name ??
          auth.user.user_metadata?.full_name ??
          auth.user.email?.split("@")[0] ??
          "Admin",
        role: "super_admin",
      }
    : {
        id: "admin-super",
        email: "superadmin@nuenime.com",
        username: "Super Admin",
        role: "super_admin",
      };

  // ─── LOAD DATA (DEDUPLICATED) ───
  const loadAdminGifts = async () => {
    setLoadingGifts(true);
    try {
      const list = await getAllAdminGifts();
      setAdminGifts(list);
    } catch (err) {
      console.warn("[AdminGacha] Error loading gifts:", err);
    } finally {
      setLoadingGifts(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfg, bList, bCatalog] = await Promise.all([
        getGachaConfig(),
        getAllGachaBanners(),
        fetchLiveBorderCatalog().catch(() => []),
      ]);
      setGachaConfig(cfg);
      if (Array.isArray(bCatalog)) setAvailableBorders(bCatalog);

      const seen = new Set<string>();
      const uniqueList: WallpaperItem[] = [];
      for (const b of bList) {
        if (!b?.id || seen.has(b.id)) continue;
        seen.add(b.id);
        uniqueList.push(b);
      }
      setBanners(uniqueList);
      void loadAdminGifts();
    } catch (err) {
      console.warn("[AdminGacha] Error loading data:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // ─── UNIQUE BANNERS MEMO ───
  const uniqueBanners = useMemo(() => {
    const seen = new Set<string>();
    const list: WallpaperItem[] = [];
    for (const b of banners) {
      if (!b?.id || seen.has(b.id)) continue;
      seen.add(b.id);
      list.push(b);
    }
    return list;
  }, [banners]);

  // ─── FILTERED BANNERS ───
  const filteredBanners = useMemo(() => {
    return uniqueBanners.filter((b) => {
      // Rarity
      if (selectedRarityFilter !== "ALL" && b.rarity !== selectedRarityFilter) {
        return false;
      }

      // Status
      const hasUrl = !!(b.image && b.image.trim().length > 0);
      if (statusFilter === "active" && !b.isActive) return false;
      if (statusFilter === "inactive" && b.isActive) return false;
      if (statusFilter === "has_url" && !hasUrl) return false;
      if (statusFilter === "no_url" && hasUrl) return false;

      // Search Query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = b.name.toLowerCase().includes(q);
        const matchAnime = (b.anime || "").toLowerCase().includes(q);
        const matchId = b.id.toLowerCase().includes(q);
        if (!matchName && !matchAnime && !matchId) return false;
      }
      return true;
    });
  }, [uniqueBanners, selectedRarityFilter, statusFilter, searchQuery]);

  // ─── COMPUTED TOTAL RATE ───
  const totalRate = useMemo(() => {
    if (!gachaConfig?.rates) return 0;
    const r = gachaConfig.rates;
    return Number(
      (
        (r.mythic || 0) +
        (r.legends || 0) +
        (r.epic || 0) +
        (r.rare || 0) +
        (r.normal || 0)
      ).toFixed(2)
    );
  }, [gachaConfig]);

  const totalBannersCount = uniqueBanners.length;
  const activeBannersCount = useMemo(() => uniqueBanners.filter((b) => b.isActive !== false).length, [uniqueBanners]);
  const pendingBannersCount = totalBannersCount - activeBannersCount;
  const withUrlCount = useMemo(() => uniqueBanners.filter((b) => b.image && b.image.trim().length > 0).length, [uniqueBanners]);

  // ─── SAVE GACHA CONFIG ───
  const handleSaveGachaConfig = async () => {
    if (!gachaConfig) return;
    setSavingConfig(true);
    hapticLight();

    try {
      await saveGachaConfig(gachaConfig, adminUser);
      hapticSuccess();
      showToast("Biaya spin Dylan Crystal dan drop rates gacha berhasil disimpan!", "success");
    } catch (err: any) {
      showToast(err?.message || "Gagal mengupdate konfigurasi gacha.", "error");
    }
    setSavingConfig(false);
  };

  // ─── OPEN ADD BANNER MODAL ───
  const handleOpenAddBanner = () => {
    hapticLight();
    const count = uniqueBanners.length + 1;
    setEditingBanner(null);
    setFormId(`banner_${count}`);
    setFormName("");
    setFormAnime("");
    setFormImage("");
    setFormRarity("Normal");
    setFormIsActive(true);
    setFormErrors({});
    setFormGeneralError(null);
    setShowBannerModal(true);
  };

  // ─── OPEN EDIT BANNER MODAL ───
  const handleOpenEditBanner = (b: WallpaperItem) => {
    hapticLight();
    setEditingBanner(b);
    setFormId(b.id);
    setFormName(b.name);
    setFormAnime(b.anime || "");
    setFormImage(b.image);
    setFormRarity(b.rarity);
    setFormIsActive(b.isActive ?? true);
    setFormErrors({});
    setFormGeneralError(null);
    setShowBannerModal(true);
  };

  const handleNameChange = (name: string) => {
    setFormName(name);
    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: "" }));
    if (!editingBanner && name.trim()) {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
      setFormId(`${formRarity.toLowerCase()}_${slug}`);
      if (formErrors.id) setFormErrors((prev) => ({ ...prev, id: "" }));
    }
  };

  const handleRarityChange = (rarity: WallpaperRarity) => {
    setFormRarity(rarity);
    if (!editingBanner && formName.trim()) {
      const slug = formName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
      setFormId(`${rarity.toLowerCase()}_${slug}`);
    }
  };

  const handleCopyUrl = (item: WallpaperItem) => {
    if (!item.image) return;
    hapticLight();
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(item.image);
      setCopySuccessId(item.id);
      setTimeout(() => setCopySuccessId(null), 2000);
    } else {
      Alert.alert("URL Aset", item.image);
    }
  };

  // ─── SAVE BANNER (WITH STRICT VALIDATION) ───
  const handleSaveBanner = async () => {
    const errors: Record<string, string> = {};

    const cleanName = formName.trim();
    if (!cleanName) {
      errors.name = "Nama banner wajib diisi (contoh: Satoru Gojo - Hollow Void).";
    } else if (cleanName.length < 2) {
      errors.name = "Nama banner minimal 2 karakter.";
    }

    const cleanId = formId.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!cleanId) {
      errors.id = "ID unik banner wajib diisi (gunakan huruf kecil, angka, underscore).";
    } else if (!editingBanner && uniqueBanners.some((b) => b.id.toLowerCase() === cleanId)) {
      errors.id = `ID "${cleanId}" sudah digunakan oleh banner lain. Gunakan ID unik yang berbeda.`;
    }

    const cleanAnime = formAnime.trim();
    if (!cleanAnime) {
      errors.anime = "Judul anime asal wajib diisi (contoh: Jujutsu Kaisen).";
    }

    const cleanImage = formImage.trim();
    if (!cleanImage) {
      errors.image = "URL gambar/GIF banner wajib diisi agar banner dapat tampil.";
    } else if (!cleanImage.startsWith("http://") && !cleanImage.startsWith("https://")) {
      errors.image = "URL harus diawali dengan http:// atau https:// (contoh: https://i.ibb.co.com/xxx/banner.png).";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setFormGeneralError("Mohon lengkapi semua data wajib yang ditandai peringatan merah di bawah.");
      hapticWarning();
      return;
    }

    setFormErrors({});
    setFormGeneralError(null);
    setSavingBanner(true);
    hapticLight();

    try {
      if (editingBanner) {
        const updated: WallpaperItem = {
          ...editingBanner,
          name: cleanName,
          anime: cleanAnime,
          image: cleanImage,
          rarity: formRarity,
          isActive: formIsActive,
        };
        const res = await updateGachaBanner(updated, adminUser);
        if (!res.success) {
          const errMsg = res.error || "Gagal mengupdate banner.";
          setFormGeneralError(errMsg);
          showToast(errMsg, "error");
          setSavingBanner(false);
          return;
        }
        setBanners((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
        hapticSuccess();
        setShowBannerModal(false);
        showToast(`Banner "${updated.name}" berhasil diperbarui!`, "success");
      } else {
        const res = await addGachaBanner(
          {
            id: cleanId,
            name: cleanName,
            anime: cleanAnime,
            image: cleanImage,
            rarity: formRarity,
            isActive: formIsActive,
          },
          adminUser
        );
        if (!res.success || !res.data) {
          const errMsg = res.error || "Gagal menambahkan banner baru.";
          setFormGeneralError(errMsg);
          showToast(errMsg, "error");
          setSavingBanner(false);
          return;
        }
        setBanners((prev) => [res.data!, ...prev.filter((b) => b.id !== res.data!.id)]);
        hapticSuccess();
        setShowBannerModal(false);
        showToast(`Banner baru "${res.data.name}" (${res.data.rarity}) berhasil ditambahkan ke pool!`, "success");
      }
    } catch (err: any) {
      const errMsg = err?.message || "Terjadi kesalahan sistem saat menyimpan banner.";
      setFormGeneralError(errMsg);
      showToast(errMsg, "error");
    }
    setSavingBanner(false);
  };

  // ─── TOGGLE BANNER ACTIVE ───
  const handleToggleActive = async (b: WallpaperItem) => {
    const nextState = !b.isActive;
    hapticLight();
    setBanners((prev) => prev.map((item) => (item.id === b.id ? { ...item, isActive: nextState } : item)));
    await toggleGachaBannerActive(b.id, nextState, adminUser);
    showToast(`Status banner "${b.name}" diubah menjadi ${nextState ? "Aktif di Pool" : "Nonaktif"}.`);
  };

  // ─── DELETE BANNER (WITH 100% CRYSTAL REFUND TO MAILBOX) ───
  const handleConfirmDelete = async () => {
    if (!bannerToDelete) return;
    setDeleting(true);
    hapticLight();
    try {
      const res = await deleteGachaBanner(bannerToDelete.id, adminUser);
      if (!res.success) {
        showToast(res.error || "Tidak dapat memproses penghapusan banner.", "error");
        setDeleting(false);
        return;
      }

      setBanners((prev) => prev.filter((b) => b.id !== bannerToDelete.id));
      hapticSuccess();
      const refundInfo = res.refundedUsersCount && res.refundedUsersCount > 0
        ? ` Kompensasi refund crystal telah dikirim ke Mailbox ${res.refundedUsersCount} pengguna!`
        : "";
      showToast(`Banner "${bannerToDelete.name}" berhasil dihapus.${refundInfo}`, "success");
      setBannerToDelete(null);
    } catch (err: any) {
      showToast(err?.message || "Gagal menghapus banner.", "error");
    }
    setDeleting(false);
  };

  // ─── GACHA SIMULATOR FUNCTION ───
  const handleRunSimulation = (pullCount: number) => {
    hapticLight();
    if (!gachaConfig?.rates) return;

    const { mythic, legends, epic, rare, normal } = gachaConfig.rates;
    const poolBanners = uniqueBanners.filter((b) => b.isActive !== false);

    const results: SimResultItem[] = [];
    let addedMythic = 0;
    let addedLegends = 0;
    let addedEpic = 0;
    let addedRare = 0;
    let addedNormal = 0;

    for (let i = 0; i < pullCount; i++) {
      const rand = Math.random() * 100;
      let pulledRarity: WallpaperRarity = "Normal";

      if (rand < mythic) {
        pulledRarity = "Mythic";
        addedMythic++;
      } else if (rand < mythic + legends) {
        pulledRarity = "Legendary";
        addedLegends++;
      } else if (rand < mythic + legends + epic) {
        pulledRarity = "Epic";
        addedEpic++;
      } else if (rand < mythic + legends + epic + rare) {
        pulledRarity = "Rare";
        addedRare++;
      } else {
        pulledRarity = "Normal";
        addedNormal++;
      }

      const matches = poolBanners.filter((b) => b.rarity === pulledRarity);
      const chosen = matches.length > 0 ? matches[Math.floor(Math.random() * matches.length)] : null;
      const rMeta = RARITY_CONFIG[pulledRarity] || RARITY_CONFIG.Normal;

      results.push({
        name: chosen ? chosen.name : `Banner ${pulledRarity}`,
        rarity: pulledRarity,
        color: rMeta.color,
        image: chosen?.image,
      });
    }

    setSimResults(results);
    setSimHistory((prev) => ({
      mythic: prev.mythic + addedMythic,
      legends: prev.legends + addedLegends,
      epic: prev.epic + addedEpic,
      rare: prev.rare + addedRare,
      normal: prev.normal + addedNormal,
      total: prev.total + pullCount,
    }));
  };

  // ─── MAILBOX MASS GIFT ───
  const handleSendMassGift = async () => {
    if (!giftTitle.trim() || !giftMessage.trim()) {
      showToast("Judul dan pesan hadiah wajib diisi.", "error");
      return;
    }

    setSendingGift(true);
    hapticLight();
    try {
      const res = await sendMassGift(
        {
          title: giftTitle,
          message: giftMessage,
          giftType: giftType,
          giftValue: giftValue,
        },
        adminUser
      );

      if (!res.success) {
        showToast(res.error || "Gagal menyiarkan hadiah.", "error");
        setSendingGift(false);
        return;
      }

      setSendingGift(false);
      setShowGiftConfirm(false);
      setGiftTitle("");
      setGiftMessage("");
      hapticSuccess();
      showToast(`Hadiah massal "${giftTitle}" berhasil disiarkan ke seluruh pemain!`, "success");
      void loadAdminGifts();
    } catch (err: any) {
      setSendingGift(false);
      showToast(err?.message || "Terjadi kesalahan sistem.", "error");
    }
  };

  // ─── DELETE SYSTEM GIFT ───
  const handleConfirmDeleteGift = async () => {
    if (!giftToDelete) return;
    setDeletingGift(true);
    hapticLight();
    try {
      const res = await deleteSystemGift(giftToDelete.id, adminUser);
      if (res.success) {
        hapticSuccess();
        setAdminGifts((prev) => prev.filter((g) => g.id !== giftToDelete.id));
        showToast(
          `Hadiah "${giftToDelete.title}" berhasil dihapus. Pengguna baru tidak akan melihat notif/hadiah ini lagi.`,
          "success"
        );
        setGiftToDelete(null);
      } else {
        showToast(res.error || "Gagal menghapus hadiah.", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Gagal menghapus hadiah.", "error");
    } finally {
      setDeletingGift(false);
    }
  };

  return (
    <AdminLayout
      title="Gacha & Koleksi Banner Profil"
      subtitle={`Kelola katalog ${totalBannersCount} banner wallpaper, biaya spin Crystal, drop rates, dan kompensasi otomatis`}
      activeKey="gacha"
    >
      {/* ─── TOP KPI STRIP (SESUAI ADMIN BORDERS) ─── */}
      <View style={[styles.kpiStrip, !isWide && styles.kpiStripMobile]}>
        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
            <AppIcon name="image-multiple-outline" size={18} color="#38BDF8" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Total Banner</Text>
            <Text style={styles.kpiStripVal}>{totalBannersCount} Item</Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
            <AppIcon name="check-circle" size={18} color="#10B981" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Aktif di Pool</Text>
            <Text style={[styles.kpiStripVal, { color: "#10B981" }]}>
              {activeBannersCount} / {totalBannersCount}
            </Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
            <AppIcon name="crystal-ball" size={18} color="#F59E0B" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Biaya Spin (1x / 10x)</Text>
            <Text style={[styles.kpiStripVal, { color: "#F59E0B" }]}>
              {(gachaConfig?.costSingle ?? 1000).toLocaleString("id-ID")} / {(gachaConfig?.costMulti ?? 9000).toLocaleString("id-ID")}
            </Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(255, 255, 255, 0.08)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.18)" }]}>
            <AppIcon name="link-variant" size={18} color="#CBD5E1" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>URL Aset Terisi</Text>
            <Text style={[styles.kpiStripVal, { color: "#FFFFFF" }]}>
              {withUrlCount} ({totalBannersCount > 0 ? ((withUrlCount / totalBannersCount) * 100).toFixed(0) : 0}%)
            </Text>
          </View>
        </View>
      </View>

      {/* ─── INFO BANNER (SESUAI ADMIN BORDERS) ─── */}
      <View style={styles.infoBanner}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 }}>
          <View style={styles.infoIconWrap}>
            <AppIcon name="information-outline" size={15} color="#38BDF8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Panduan Rilis Banner Gacha & Kompensasi</Text>
            <Text style={styles.infoBannerText}>
              Isi URL gambar beresolusi tinggi (PNG/JPG/GIF) agar banner otomatis aktif dalam pool gacha APK.
              Setiap banner yang dihapus secara otomatis memicu pengembalian crystal penuh ke Mailbox pemain.
            </Text>
          </View>
        </View>
      </View>

      {/* ─── TAB NAVIGATION (SESUAI ADMIN BORDERS CHIP STYLE) ─── */}
      <View style={styles.tabNavWrap}>
        {[
          { key: "banners", label: `Katalog Banner (${totalBannersCount})`, icon: "image-multiple-outline" },
          { key: "pricing", label: "Biaya & Drop Rates", icon: "cash-multiple" },
          { key: "simulator", label: "Simulator Gacha", icon: "rocket-launch-outline" },
          { key: "gifts", label: "Hadiah Massal (Mailbox)", icon: "gift-outline" },
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
              size={14}
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
          <ActivityIndicator size="large" color="#CBD5E1" />
          <Text style={styles.loadingText}>Memuat data gacha dari database Supabase...</Text>
        </View>
      ) : (
        <View style={styles.contentWrap}>
          {/* ══════════════════════════════════════════════════════
              TAB 1: KOLEKSI BANNER PROFIL
             ══════════════════════════════════════════════════════ */}
          {activeTab === "banners" && (
            <View style={{ gap: 14 }}>
              {/* Filter Card (Sesuai Persis Admin Borders) */}
              <View style={styles.filterCard}>
                {/* Header Action: Tambah Banner Baru */}
                <View style={styles.topFilterHeader}>
                  <Text style={styles.filterSectionTitle}>Katalog & Filter Banner</Text>
                  <Pressable
                    onPress={handleOpenAddBanner}
                    style={styles.addNewBannerBtn}
                  >
                    <AppIcon name="plus" size={15} color="#FFFFFF" />
                    <Text style={styles.addNewBannerBtnText}>Tambah Banner Baru</Text>
                  </Pressable>
                </View>

                {/* Search Row & Status Filters */}
                <View style={styles.searchRow}>
                  <View style={styles.searchInputWrap}>
                    <AppIcon name="magnify" size={18} color="#94A3B8" />
                    <TextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Cari nama banner, ID, atau anime..."
                      placeholderTextColor="#64748B"
                      style={styles.searchInput}
                    />
                    {searchQuery.length > 0 && (
                      <Pressable onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
                        <AppIcon name="close" size={14} color="#94A3B8" />
                      </Pressable>
                    )}
                  </View>

                  {/* Status Filters */}
                  <View style={styles.statusFilterRow}>
                    {[
                      { key: "all", label: "Semua Status" },
                      { key: "active", label: "Aktif di Pool" },
                      { key: "inactive", label: "Nonaktif" },
                      { key: "has_url", label: "Ada URL" },
                      { key: "no_url", label: "Belum Ada URL" },
                    ].map((f) => (
                      <Pressable
                        key={f.key}
                        onPress={() => {
                          hapticLight();
                          setStatusFilter(f.key as any);
                        }}
                        style={[
                          styles.statusFilterChip,
                          statusFilter === f.key && styles.statusFilterChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusFilterText,
                            statusFilter === f.key && styles.statusFilterTextActive,
                          ]}
                        >
                          {f.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Rarity Filter Row dengan dot warna (Persis Admin Borders) */}
                <View style={styles.rarityFilterRow}>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setSelectedRarityFilter("ALL");
                    }}
                    style={[
                      styles.rarityChip,
                      selectedRarityFilter === "ALL" && styles.rarityChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rarityChipText,
                        selectedRarityFilter === "ALL" && styles.rarityChipTextActive,
                      ]}
                    >
                      Semua Rarity ({totalBannersCount})
                    </Text>
                  </Pressable>

                  {(["Mythic", "Legendary", "Epic", "Rare", "Normal"] as WallpaperRarity[]).map((r) => {
                    const meta = RARITY_CONFIG[r];
                    const count = uniqueBanners.filter((b) => b.rarity === r).length;
                    const isActive = selectedRarityFilter === r;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => {
                          hapticLight();
                          setSelectedRarityFilter(r);
                        }}
                        style={[
                          styles.rarityChip,
                          isActive && styles.rarityChipActive,
                        ]}
                      >
                        <View style={[styles.rarityDot, { backgroundColor: meta.color }]} />
                        <Text
                          style={[
                            styles.rarityChipText,
                            isActive && styles.rarityChipTextActive,
                          ]}
                        >
                          {r} ({count})
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Banners Grid (Persis Layout Kartu Admin Borders) */}
              {filteredBanners.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <AppIcon name="image-multiple-outline" size={40} color="#334155" />
                  <Text style={styles.emptyTitle}>Tidak ada banner yang cocok</Text>
                  <Text style={styles.emptySubtitle}>
                    Coba sesuaikan kata kunci pencarian atau ubah filter status dan kelangkaan
                  </Text>
                  <Pressable
                    onPress={() => {
                      setSearchQuery("");
                      setSelectedRarityFilter("ALL");
                      setStatusFilter("all");
                    }}
                    style={styles.resetFilterBtn}
                  >
                    <AppIcon name="refresh" size={13} color="#FFFFFF" />
                    <Text style={styles.resetFilterBtnText}>Reset Semua Filter</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.bannerGrid}>
                  {filteredBanners.map((item) => {
                    const rMeta = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.Normal;
                    const hasUrl = !!(item.image && item.image.trim().length > 0);
                    const isGif = item.image.toLowerCase().includes(".gif");
                    const itemPrice = rMeta.price || 1500;

                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.bannerCard,
                          item.isActive && { borderColor: `${rMeta.color}40` },
                        ]}
                      >
                        {/* Top: Rarity Badge & Active Status (Sesuai Borders) */}
                        <View style={styles.cardTopRow}>
                          <View
                            style={[
                              styles.rarityBadge,
                              { backgroundColor: rMeta.bgColor, borderColor: rMeta.borderColor },
                            ]}
                          >
                            <View style={[styles.rarityBadgeDot, { backgroundColor: rMeta.color }]} />
                            <Text style={[styles.rarityBadgeText, { color: rMeta.color }]}>
                              {item.rarity.toUpperCase()}
                            </Text>
                          </View>

                          <Pressable
                            onPress={() => handleToggleActive(item)}
                            style={[
                              styles.statusPill,
                              item.isActive ? styles.statusActive : styles.statusInactive,
                            ]}
                          >
                            <AppIcon
                              name={item.isActive ? "check-circle" : "clock-outline"}
                              size={10}
                              color={item.isActive ? "#10B981" : "#F59E0B"}
                            />
                            <Text
                              style={[
                                styles.statusPillText,
                                item.isActive ? styles.textActive : styles.textInactive,
                              ]}
                            >
                              {item.isActive ? "Aktif di Pool" : "Nonaktif"}
                            </Text>
                          </Pressable>
                        </View>

                        {/* Middle: Image Preview Box (Sesuai PreviewBox Borders) */}
                        <View style={[styles.imagePreviewBox, { borderColor: `${rMeta.color}25` }]}>
                          <Image
                            source={{ uri: item.image }}
                            style={styles.bannerImage}
                            contentFit="cover"
                            transition={200}
                          />
                          {isGif && (
                            <View style={styles.gifBadge}>
                              <Text style={styles.gifBadgeText}>GIF</Text>
                            </View>
                          )}
                        </View>

                        {/* Banner Name & ID */}
                        <View>
                          <Text style={styles.bannerName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.bannerId} numberOfLines={1}>
                            ID: {item.id} • {item.anime || "Anime Collection"}
                          </Text>
                        </View>

                        {/* URL Status */}
                        <View
                          style={[
                            styles.urlStatusRow,
                            hasUrl ? styles.urlStatusHas : styles.urlStatusMissing,
                          ]}
                        >
                          <AppIcon
                            name={hasUrl ? "link-variant" : "link-variant-off"}
                            size={11}
                            color={hasUrl ? "#10B981" : "#F59E0B"}
                          />
                          <Text
                            style={[
                              styles.urlStatusText,
                              { color: hasUrl ? "#10B981" : "#F59E0B" },
                            ]}
                            numberOfLines={1}
                          >
                            {hasUrl ? "URL Aset Tersedia" : "Belum Ada URL Aset"}
                          </Text>
                        </View>

                        {/* Price & Bonus Spec */}
                        <View style={styles.specRow}>
                          <Text style={styles.specText}>
                            Nilai: <Text style={styles.specVal}>💎 {itemPrice.toLocaleString("id-ID")}</Text>
                          </Text>
                          <Text style={styles.specDivider}>·</Text>
                          <Text style={styles.specText}>
                            EXP Bonus: <Text style={styles.specVal}>+{item.expBonus || rMeta.expBonus}%</Text>
                          </Text>
                        </View>

                        {/* Action Buttons (Sesuai Persis Borders: Edit, Copy, Delete) */}
                        <View style={styles.cardActionRow}>
                          <Pressable
                            onPress={() => handleOpenEditBanner(item)}
                            style={styles.editBtn}
                          >
                            <AppIcon name="pencil" size={12} color="#FFFFFF" />
                            <Text style={styles.editBtnText}>Edit</Text>
                          </Pressable>

                          {hasUrl && (
                            <Pressable
                              onPress={() => handleCopyUrl(item)}
                              style={styles.copyUrlBtn}
                            >
                              <AppIcon
                                name={copySuccessId === item.id ? "check" : "content-copy"}
                                size={12}
                                color={copySuccessId === item.id ? "#10B981" : "#94A3B8"}
                              />
                            </Pressable>
                          )}

                          <Pressable
                            onPress={() => setBannerToDelete(item)}
                            style={styles.deleteBtn}
                          >
                            <AppIcon name="trash-can-outline" size={13} color="#F43F5E" />
                          </Pressable>
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
            <View style={styles.contentCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderIconBox}>
                  <AppIcon name="cash-multiple" size={16} color="#38BDF8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Pengaturan Biaya Spin Dylan Crystal</Text>
                  <Text style={styles.cardSubtitle}>
                    Biaya Crystal yang ditetapkan di sini akan langsung digunakan oleh aplikasi saat pengguna melakukan summon.
                  </Text>
                </View>
              </View>

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
                    Total: {totalRate.toFixed(1)}% {Math.abs(totalRate - 100) < 0.01 ? "✓" : "⚠️"}
                  </Text>
                </View>
              </View>

              <View style={styles.ratesGrid}>
                {[
                  { key: "mythic", label: "Mythic", color: "#EC4899", val: gachaConfig.rates.mythic },
                  { key: "legends", label: "Legends", color: "#EAB308", val: gachaConfig.rates.legends },
                  { key: "epic", label: "Epic", color: "#38BDF8", val: gachaConfig.rates.epic },
                  { key: "rare", label: "Rare", color: "#0EA5E9", val: gachaConfig.rates.rare },
                  { key: "normal", label: "Normal", color: "#94A3B8", val: gachaConfig.rates.normal },
                ].map((item) => (
                  <View key={item.key} style={styles.rateBox}>
                    <Text style={[styles.rateLabel, { color: item.color }]}>{item.label} (%)</Text>
                    <TextInput
                      value={String(item.val)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({
                          ...gachaConfig,
                          rates: { ...gachaConfig.rates, [item.key]: parseFloat(t) || 0 },
                        })
                      }
                      style={styles.fieldInputSmall}
                    />
                  </View>
                ))}
              </View>

              {Math.abs(totalRate - 100) >= 0.01 && (
                <View style={styles.warnRateBox}>
                  <AppIcon name="alert-circle-outline" size={16} color="#F59E0B" />
                  <Text style={styles.warnRateText}>
                    Perhatian: Total drop rate saat ini {totalRate.toFixed(1)}%. Pastikan total tepat 100.0%.
                  </Text>
                </View>
              )}

              <Pressable
                disabled={savingConfig}
                onPress={handleSaveGachaConfig}
                style={[styles.saveConfigBtn, savingConfig && { opacity: 0.6 }]}
              >
                {savingConfig ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="content-save-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.saveConfigBtnText}>Simpan Pengaturan Biaya & Drop Rates</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 3: SIMULATOR GACHA
             ══════════════════════════════════════════════════════ */}
          {activeTab === "simulator" && (
            <View style={{ gap: 14 }}>
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderIconBox}>
                    <AppIcon name="rocket-launch-outline" size={16} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Simulator Uji Algoritma Gacha</Text>
                    <Text style={styles.cardSubtitle}>
                      Uji peluang drop rate secara langsung tanpa memotong Crystal akun pengguna untuk memverifikasi distribusi statistik RNG.
                    </Text>
                  </View>
                </View>

                <View style={styles.simActionRow}>
                  <Pressable
                    onPress={() => handleRunSimulation(1)}
                    style={styles.simBtn}
                  >
                    <AppIcon name="crystal-ball" size={14} color="#38BDF8" />
                    <Text style={styles.simBtnText}>Tarik 1x (Simulasi)</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleRunSimulation(10)}
                    style={styles.simBtn}
                  >
                    <AppIcon name="sparkles" size={14} color="#10B981" />
                    <Text style={styles.simBtnText}>Tarik 10x (Multi)</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleRunSimulation(100)}
                    style={styles.simBtn}
                  >
                    <AppIcon name="trending-up" size={14} color="#F59E0B" />
                    <Text style={styles.simBtnText}>Tarik 100x (Stress Test)</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setSimResults([]);
                      setSimHistory({ mythic: 0, legends: 0, epic: 0, rare: 0, normal: 0, total: 0 });
                    }}
                    style={styles.simResetBtn}
                  >
                    <AppIcon name="refresh" size={13} color="#94A3B8" />
                    <Text style={styles.simResetText}>Reset Statistik</Text>
                  </Pressable>
                </View>

                {/* History Stats */}
                {simHistory.total > 0 && (
                  <View style={styles.simStatsBox}>
                    <Text style={styles.simStatsTitle}>
                      Statistik Hasil ({simHistory.total} Total Tarikan):
                    </Text>
                    <View style={styles.simStatsRow}>
                      {[
                        { label: "Mythic", count: simHistory.mythic, color: "#EC4899" },
                        { label: "Legends", count: simHistory.legends, color: "#EAB308" },
                        { label: "Epic", count: simHistory.epic, color: "#38BDF8" },
                        { label: "Rare", count: simHistory.rare, color: "#0EA5E9" },
                        { label: "Normal", count: simHistory.normal, color: "#94A3B8" },
                      ].map((s) => (
                        <View key={s.label} style={styles.simStatPill}>
                          <Text style={[styles.simStatLabel, { color: s.color }]}>{s.label}</Text>
                          <Text style={styles.simStatCount}>{s.count}</Text>
                          <Text style={styles.simStatPct}>
                            {((s.count / simHistory.total) * 100).toFixed(1)}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Results Preview */}
                {simResults.length > 0 && (
                  <View style={{ gap: 10, marginTop: 4 }}>
                    <Text style={styles.simResultsHeading}>Hasil Tarikan Terakhir:</Text>
                    <View style={styles.simResultsGrid}>
                      {simResults.map((item, idx) => (
                        <View key={idx} style={[styles.simResultCard, { borderColor: `${item.color}35` }]}>
                          {item.image && (
                            <Image
                              source={{ uri: item.image }}
                              style={styles.simResultImg}
                              contentFit="cover"
                            />
                          )}
                          <View style={{ padding: 8, gap: 2 }}>
                            <View style={[styles.simRarityTag, { backgroundColor: `${item.color}20` }]}>
                              <Text style={[styles.simRarityText, { color: item.color }]}>
                                {item.rarity.toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.simResultName} numberOfLines={1}>{item.name}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 4: HADIAH MASSAL (MAILBOX BROADCAST & RIWAYAT)
             ══════════════════════════════════════════════════════ */}
          {activeTab === "gifts" && (
            <View style={{ gap: 16 }}>
              {/* Form Siaran Hadiah Baru */}
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderIconBox}>
                    <AppIcon name="gift-outline" size={16} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Siaran Hadiah Massal ke Kotak Surat Pemain</Text>
                    <Text style={styles.cardSubtitle}>
                      Kirimkan Crystal gratis atau item kompensasi ke seluruh pengguna terdaftar secara instan.
                    </Text>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Judul Pengumuman Hadiah:</Text>
                  <TextInput
                    value={giftTitle}
                    onChangeText={setGiftTitle}
                    placeholder="Contoh: Kompensasi Maintenance Server v2.4"
                    placeholderTextColor="#64748B"
                    style={styles.fieldInput}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Pesan Kotak Surat:</Text>
                  <TextInput
                    value={giftMessage}
                    onChangeText={setGiftMessage}
                    placeholder="Terima kasih atas kesabaran Anda. Nikmati bonus Crystal ini!"
                    placeholderTextColor="#64748B"
                    style={[styles.fieldInput, { minHeight: 70, textAlignVertical: "top" }]}
                    multiline
                  />
                </View>

                <View style={styles.rowTwoCols}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Jenis Hadiah:</Text>
                    <View style={styles.giftTypeRow}>
                      <Pressable
                        onPress={() => setGiftType("crystal")}
                        style={[
                          styles.giftTypeBtn,
                          giftType === "crystal" && styles.giftTypeBtnActive,
                        ]}
                      >
                        <AppIcon name="crystal-ball" size={14} color={giftType === "crystal" ? "#FFFFFF" : "#94A3B8"} />
                        <Text style={[styles.giftTypeText, giftType === "crystal" && styles.giftTypeTextActive]}>
                          Dylan Crystal
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          setGiftType("border");
                          if (availableBorders.length > 0 && (!giftValue || giftValue === "100")) {
                            const first = availableBorders[0];
                            setGiftValue(first.id);
                            if (!giftTitle) setGiftTitle(`Hadiah Border: ${first.name}`);
                            if (!giftMessage) setGiftMessage(`Selamat! Anda mendapatkan hadiah Border Avatar eksklusif "${first.name}" (${first.rarity}). Buka profil untuk memakainya!`);
                          }
                        }}
                        style={[
                          styles.giftTypeBtn,
                          giftType === "border" && styles.giftTypeBtnActive,
                        ]}
                      >
                        <AppIcon name="palette-swatch-outline" size={14} color={giftType === "border" ? "#FFFFFF" : "#94A3B8"} />
                        <Text style={[styles.giftTypeText, giftType === "border" && styles.giftTypeTextActive]}>
                          Border Avatar
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>
                      {giftType === "crystal" ? "Jumlah Crystal:" : "Pilih Border Avatar:"}
                    </Text>
                    {giftType === "crystal" ? (
                      <TextInput
                        value={giftValue}
                        onChangeText={setGiftValue}
                        placeholder="100"
                        keyboardType="numeric"
                        placeholderTextColor="#64748B"
                        style={styles.fieldInput}
                      />
                    ) : (
                      <>
                        <Pressable
                          onPress={() => setShowBorderDropdown(!showBorderDropdown)}
                          style={[styles.borderSelectTrigger, showBorderDropdown && styles.borderSelectTriggerActive]}
                        >
                          {(() => {
                            const sel = availableBorders.find((b) => b.id === giftValue) || availableBorders[0];
                            const rTheme = sel ? BORDER_RARITY_THEME[sel.rarity] : null;
                            return (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                                {sel?.assetUrl ? (
                                  <Image source={{ uri: sel.assetUrl }} style={styles.borderThumbMini} contentFit="contain" />
                                ) : (
                                  <View style={styles.borderThumbFallback}>
                                    <AppIcon name="palette-swatch-outline" size={16} color="#38BDF8" />
                                  </View>
                                )}
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.borderSelectName} numberOfLines={1}>
                                    {sel ? sel.name : giftValue || "Pilih Border..."}
                                  </Text>
                                  <Text style={styles.borderSelectId}>
                                    ID: {sel ? sel.id : giftValue} {sel ? `• ${sel.rarity}` : ""}
                                  </Text>
                                </View>
                                {rTheme && (
                                  <View style={[styles.borderRarityPill, { backgroundColor: rTheme.bgBadge, borderColor: rTheme.borderBadge }]}>
                                    <Text style={[styles.borderRarityPillText, { color: rTheme.color }]}>{sel.rarity}</Text>
                                  </View>
                                )}
                              </View>
                            );
                          })()}
                          <AppIcon name={showBorderDropdown ? "chevron-up" : "chevron-down"} size={18} color="#94A3B8" />
                        </Pressable>

                        {showBorderDropdown && (
                          <View style={styles.borderDropdownMenu}>
                            <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled showsVerticalScrollIndicator>
                              {availableBorders.map((b) => {
                                const isSelected = giftValue === b.id;
                                const rTheme = BORDER_RARITY_THEME[b.rarity];
                                return (
                                  <Pressable
                                    key={b.id}
                                    onPress={() => {
                                      hapticLight();
                                      setGiftValue(b.id);
                                      setShowBorderDropdown(false);
                                      if (!giftTitle || giftTitle.startsWith("Hadiah Border:")) {
                                        setGiftTitle(`Hadiah Border: ${b.name}`);
                                      }
                                      if (!giftMessage || giftMessage.includes("Border Avatar eksklusif")) {
                                        setGiftMessage(`Selamat! Anda mendapatkan hadiah Border Avatar eksklusif "${b.name}" (${b.rarity}). Buka profil untuk memakainya!`);
                                      }
                                    }}
                                    style={[styles.borderDropdownItem, isSelected && styles.borderDropdownItemActive]}
                                  >
                                    {b.assetUrl ? (
                                      <Image source={{ uri: b.assetUrl }} style={styles.borderThumbMini} contentFit="contain" />
                                    ) : (
                                      <View style={styles.borderThumbFallback}>
                                        <AppIcon name="palette-swatch-outline" size={14} color="#38BDF8" />
                                      </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.borderItemName} numberOfLines={1}>{b.name}</Text>
                                      <Text style={styles.borderItemId}>ID: {b.id}</Text>
                                    </View>
                                    <View style={[styles.borderRarityPill, { backgroundColor: rTheme.bgBadge, borderColor: rTheme.borderBadge }]}>
                                      <Text style={[styles.borderRarityPillText, { color: rTheme.color }]}>{b.rarity}</Text>
                                    </View>
                                    {isSelected && <AppIcon name="check" size={16} color="#38BDF8" />}
                                  </Pressable>
                                );
                              })}
                            </ScrollView>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                </View>

                <Pressable
                  disabled={sendingGift}
                  onPress={() => setShowGiftConfirm(true)}
                  style={[styles.broadcastBtn, sendingGift && { opacity: 0.6 }]}
                >
                  <AppIcon name="send" size={15} color="#FFFFFF" />
                  <Text style={styles.broadcastBtnText}>
                    {sendingGift ? "Mengirim Hadiah..." : "Siarkan Hadiah ke Seluruh Pemain"}
                  </Text>
                </Pressable>
              </View>

              {/* Riwayat Siaran Hadiah Massal & Tombol Hapus */}
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderIconBox}>
                    <AppIcon name="history" size={16} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Riwayat Siaran Hadiah Massal ({adminGifts.length})</Text>
                    <Text style={styles.cardSubtitle}>
                      Daftar hadiah yang aktif di sistem. Hapus riwayat jika event berakhir agar pengguna baru tidak lagi menerima notifikasi atau klaim Crystal gratis.
                    </Text>
                  </View>
                  <Pressable
                    onPress={loadAdminGifts}
                    style={styles.refreshGiftsBtn}
                  >
                    <AppIcon name="refresh" size={13} color="#94A3B8" />
                    <Text style={styles.refreshGiftsText}>Muat Ulang</Text>
                  </Pressable>
                </View>

                {loadingGifts ? (
                  <View style={{ padding: 24, alignItems: "center" }}>
                    <ActivityIndicator size="small" color="#38BDF8" />
                  </View>
                ) : adminGifts.length === 0 ? (
                  <View style={styles.giftEmptyBox}>
                    <AppIcon name="gift-outline" size={32} color="#334155" />
                    <Text style={styles.giftEmptyTitle}>Belum Ada Riwayat Hadiah Massal</Text>
                    <Text style={styles.giftEmptySubtitle}>
                      Hadiah yang pernah Anda siarkan ke pemain akan tercatat di sini dan dapat dihapus sewaktu-waktu.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {adminGifts.map((gift) => (
                      <View key={gift.id} style={styles.giftHistoryCard}>
                        <View style={styles.giftHistoryLeft}>
                          <View
                            style={[
                              styles.giftHistoryIconBox,
                              gift.giftType === "crystal" ? styles.giftTypeCrystalBox : styles.giftTypeBorderBox,
                            ]}
                          >
                            <AppIcon
                              name={gift.giftType === "crystal" ? "crystal-ball" : "palette-swatch-outline"}
                              size={20}
                              color={gift.giftType === "crystal" ? "#38BDF8" : "#F59E0B"}
                            />
                          </View>
                          <View style={{ flex: 1, gap: 3 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <Text style={styles.giftHistoryTitle}>{gift.title}</Text>
                              <View style={styles.giftAudienceBadge}>
                                <Text style={styles.giftAudienceText}>
                                  {gift.targetUserId ? "Penerima Khusus" : "Semua Pemain (Global)"}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.giftHistoryMsg} numberOfLines={2}>
                              {gift.message}
                            </Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                              <Text style={styles.giftHistoryDate}>
                                {gift.createdAt ? new Date(gift.createdAt).toLocaleString("id-ID") : "-"}
                              </Text>
                              <Text style={{ color: "#64748B" }}>•</Text>
                              <Text style={styles.giftHistoryValue}>
                                {gift.giftType === "crystal" ? `💎 +${gift.giftValue} Crystal` : `🎨 Border ID: ${gift.giftValue}`}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <Pressable
                          onPress={() => {
                            hapticLight();
                            setGiftToDelete(gift);
                          }}
                          style={styles.deleteGiftBtn}
                        >
                          <AppIcon name="trash-can-outline" size={13} color="#EF4444" />
                          <Text style={styles.deleteGiftBtnText}>Hapus Hadiah</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      {/* ─── MODAL ADD/EDIT BANNER (DENGAN VALIDASI KETAT & PERINGATAN MERAH PERSIS ADMIN BORDERS) ─── */}
      <Modal visible={showBannerModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingBanner ? "Edit Banner Gacha" : "Tambah Banner Gacha Baru"}
                </Text>
                <Text style={styles.modalHeaderSub}>
                  {editingBanner ? `Perbarui data untuk ID: ${editingBanner.id}` : "Lengkapi semua data wajib di bawah untuk menambahkan banner baru"}
                </Text>
              </View>
              <Pressable onPress={() => setShowBannerModal(false)} style={styles.modalCloseBtn}>
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            {/* Peringatan error umum jika ada field belum diisi */}
            {formGeneralError && (
              <View style={styles.formGeneralError}>
                <AppIcon name="alert-circle" size={15} color="#F43F5E" />
                <Text style={styles.formGeneralErrorText}>{formGeneralError}</Text>
              </View>
            )}

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12 }}>
                {/* ID Unik Banner */}
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>ID Unik Banner</Text>
                    <Text style={styles.requiredMark}>*WAJIB</Text>
                  </View>
                  <TextInput
                    value={formId}
                    onChangeText={(t) => {
                      setFormId(t.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
                      if (formErrors.id) setFormErrors((prev) => ({ ...prev, id: "" }));
                    }}
                    editable={!editingBanner}
                    placeholder="Contoh: mythic_gojo_void"
                    placeholderTextColor="#64748B"
                    style={[
                      styles.fieldInput,
                      editingBanner && { opacity: 0.6, backgroundColor: "rgba(255, 255, 255, 0.02)" },
                      formErrors.id ? styles.fieldInputError : null,
                    ]}
                    autoCapitalize="none"
                  />
                  {formErrors.id ? (
                    <Text style={styles.fieldErrorText}>{formErrors.id}</Text>
                  ) : (
                    <Text style={styles.fieldHelperText}>Gunakan huruf kecil, angka, dan garis bawah (underscore).</Text>
                  )}
                </View>

                {/* Nama Banner */}
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Nama Karakter / Banner</Text>
                    <Text style={styles.requiredMark}>*WAJIB</Text>
                  </View>
                  <TextInput
                    value={formName}
                    onChangeText={handleNameChange}
                    placeholder="Contoh: Satoru Gojo - Hollow Void"
                    placeholderTextColor="#64748B"
                    style={[styles.fieldInput, formErrors.name ? styles.fieldInputError : null]}
                  />
                  {formErrors.name && (
                    <Text style={styles.fieldErrorText}>{formErrors.name}</Text>
                  )}
                </View>

                {/* Judul Anime Asal */}
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Judul Anime Asal</Text>
                    <Text style={styles.requiredMark}>*WAJIB</Text>
                  </View>
                  <TextInput
                    value={formAnime}
                    onChangeText={(t) => {
                      setFormAnime(t);
                      if (formErrors.anime) setFormErrors((prev) => ({ ...prev, anime: "" }));
                    }}
                    placeholder="Contoh: Jujutsu Kaisen"
                    placeholderTextColor="#64748B"
                    style={[styles.fieldInput, formErrors.anime ? styles.fieldInputError : null]}
                  />
                  {formErrors.anime && (
                    <Text style={styles.fieldErrorText}>{formErrors.anime}</Text>
                  )}
                </View>

                {/* URL Gambar / GIF */}
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>URL Gambar / GIF Banner</Text>
                    <Text style={styles.requiredMark}>*WAJIB</Text>
                  </View>
                  <TextInput
                    value={formImage}
                    onChangeText={(t) => {
                      setFormImage(t);
                      if (formErrors.image) setFormErrors((prev) => ({ ...prev, image: "" }));
                    }}
                    placeholder="https://.../banner.png atau .gif"
                    placeholderTextColor="#64748B"
                    style={[styles.fieldInput, formErrors.image ? styles.fieldInputError : null]}
                    autoCapitalize="none"
                  />
                  {formErrors.image && (
                    <Text style={styles.fieldErrorText}>{formErrors.image}</Text>
                  )}
                </View>

                {/* Preview image in modal if URL entered */}
                {isValidImageUrl(formImage) && (
                  <View style={styles.modalImgPreviewWrap}>
                    <Image
                      source={{ uri: formImage }}
                      style={styles.modalImgPreview}
                      contentFit="cover"
                    />
                  </View>
                )}

                {/* Tingkat Kelangkaan (Rarity) */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Tingkat Kelangkaan (Rarity):</Text>
                  <View style={styles.raritySelectRow}>
                    {(["Mythic", "Legendary", "Epic", "Rare", "Normal"] as WallpaperRarity[]).map((r) => {
                      const meta = RARITY_CONFIG[r];
                      const isSel = formRarity === r;
                      return (
                        <Pressable
                          key={r}
                          onPress={() => handleRarityChange(r)}
                          style={[
                            styles.raritySelectBtn,
                            isSel && { backgroundColor: "rgba(255, 255, 255, 0.14)", borderColor: meta.color },
                          ]}
                        >
                          <Text style={[styles.raritySelectText, isSel && { color: meta.color, fontFamily: "Nunito-Black" }]}>
                            {r} ({meta.price} 💎)
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Status Aktif di Pool */}
                <View style={styles.toggleRow}>
                  <View>
                    <Text style={styles.fieldLabel}>Status Aktif di Pool Gacha</Text>
                    <Text style={styles.toggleHint}>Jika aktif, banner dapat diundi oleh pemain di menu Gacha APK.</Text>
                  </View>
                  <Switch
                    value={formIsActive}
                    onValueChange={setFormIsActive}
                    trackColor={{ false: "rgba(255,255,255,0.1)", true: "rgba(16,185,129,0.5)" }}
                    thumbColor={formIsActive ? "#10B981" : "#64748B"}
                  />
                </View>
              </View>
            </ScrollView>

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
                style={[styles.modalSaveBtn, savingBanner && { opacity: 0.6 }]}
              >
                <Text style={styles.modalSaveText}>
                  {savingBanner ? "Menyimpan..." : editingBanner ? "Simpan Perubahan" : "Tambah Banner"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL CONFIRM DELETE BANNER (WITH 100% CRYSTAL REFUND INFORMATION) ─── */}
      <Modal visible={bannerToDelete !== null} transparent animationType="fade">
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalHeader}>
              <View style={styles.deleteIconWrap}>
                <AppIcon name="alert-circle-outline" size={22} color="#F43F5E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deleteModalTitle}>Hapus Banner Ini?</Text>
                <Text style={styles.deleteModalSubtitle}>Tindakan ini permanen dan tidak dapat dibatalkan</Text>
              </View>
            </View>

            {bannerToDelete && (
              <View style={styles.deletePreviewRow}>
                {bannerToDelete.image && (
                  <Image
                    source={{ uri: bannerToDelete.image }}
                    style={styles.deletePreviewImg}
                    contentFit="cover"
                  />
                )}
                <View style={styles.deletePreviewMeta}>
                  <Text style={styles.deletePreviewName}>{bannerToDelete.name}</Text>
                  <Text style={styles.deletePreviewId}>ID: {bannerToDelete.id} • {bannerToDelete.anime}</Text>
                  <Text style={styles.deletePreviewWarning}>
                    💎 Fitur Otomatis: Setiap pengguna yang telah memiliki banner ini akan otomatis menerima notifikasi dan reward pengembalian (refund) {(RARITY_CONFIG[bannerToDelete.rarity]?.price || 1500).toLocaleString("id-ID")} Dylan Crystal penuh di kotak masuk (Mailbox) mereka.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.deleteModalActions}>
              <Pressable
                disabled={deleting}
                onPress={() => setBannerToDelete(null)}
                style={styles.deleteCancelBtn}
              >
                <Text style={styles.deleteCancelBtnText}>Batal</Text>
              </Pressable>

              <Pressable
                disabled={deleting}
                onPress={handleConfirmDelete}
                style={[styles.deleteConfirmBtn, deleting && { opacity: 0.6 }]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="trash-can-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.deleteConfirmBtnText}>Ya, Hapus & Kembalikan Crystal</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL CONFIRM MASS GIFT ─── */}
      <Modal visible={showGiftConfirm} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Konfirmasi Kirim Hadiah Massal</Text>
            <Text style={styles.modalHeaderSub}>
              Hadiah ini akan disiarkan ke kotak surat seluruh pengguna terdaftar di APK Nuenime.
            </Text>
            <View style={styles.giftConfirmDetailBox}>
              <Text style={styles.giftConfirmDetailLabel}>Judul: <Text style={{ color: "#FFFFFF" }}>{giftTitle}</Text></Text>
              <Text style={styles.giftConfirmDetailLabel}>
                Isi: <Text style={{ color: "#38BDF8" }}>
                  {giftType === "crystal"
                    ? `+${giftValue} Dylan Crystal`
                    : `Border Avatar: "${availableBorders.find((b) => b.id === giftValue)?.name || giftValue}" (${giftValue})`}
                </Text>
              </Text>
            </View>
            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setShowGiftConfirm(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                onPress={handleSendMassGift}
                style={styles.modalSaveBtn}
              >
                <Text style={styles.modalSaveText}>Konfirmasi & Siarkan</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL KONFIRMASI HAPUS HADIAH MASSAL ─── */}
      <Modal visible={giftToDelete !== null} transparent animationType="fade">
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalHeader}>
              <View style={styles.deleteIconWrap}>
                <AppIcon name="trash-can-outline" size={20} color="#F43F5E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deleteModalTitle}>Hapus Riwayat Hadiah?</Text>
                <Text style={styles.deleteModalSubtitle}>Tindakan ini permanen dan tidak dapat dibatalkan</Text>
              </View>
            </View>

            <View style={styles.deletePreviewRow}>
              <View style={styles.deletePreviewMeta}>
                <Text style={styles.deletePreviewName}>{giftToDelete?.title}</Text>
                <Text style={styles.deletePreviewId}>
                  Isi: {giftToDelete?.giftType === "crystal" ? `+${giftToDelete?.giftValue} Dylan Crystal` : `Border ID: ${giftToDelete?.giftValue}`}
                </Text>
                <Text style={[styles.deletePreviewWarning, { color: "#F43F5E" }]}>
                  ⚠️ Hadiah akan dihapus dari sistem. Pengguna baru atau pemain yang belum klaim tidak akan lagi menerima notifikasi atau hadiah ini.
                </Text>
              </View>
            </View>

            <View style={styles.deleteModalActions}>
              <Pressable
                onPress={() => setGiftToDelete(null)}
                style={styles.deleteCancelBtn}
              >
                <Text style={styles.deleteCancelBtnText}>Batal</Text>
              </Pressable>

              <Pressable
                disabled={deletingGift}
                onPress={handleConfirmDeleteGift}
                style={[styles.deleteConfirmBtn, deletingGift && { opacity: 0.6 }]}
              >
                {deletingGift ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="trash-can-outline" size={13} color="#FFFFFF" />
                    <Text style={styles.deleteConfirmBtnText}>Ya, Hapus Hadiah</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── FLOATING TOAST (SESUAI PERSIS ADMIN BORDERS) ─── */}
      {actionToast && (
        <View
          style={[
            styles.toastContainer,
            actionToast.type === "error" ? styles.toastError : styles.toastSuccess,
          ]}
        >
          <AppIcon
            name={actionToast.type === "error" ? "alert-circle" : "check-circle"}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.toastText}>{actionToast.message}</Text>
        </View>
      )}
    </AdminLayout>
  );
}

// ─── STYLES (100% IDENTIK DENGAN ADMIN BORDERS PALETTE & CARD SYSTEM) ─────────────
const styles = StyleSheet.create({
  // ── KPI Top Strip (Persis Admin Borders)
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
    fontSize: 15,
    color: "#FFFFFF",
    marginTop: 2,
  },
  kpiStripDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },

  // ── Info Banner (Persis Admin Borders)
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

  // ── Tabs Navigation (Chip Style Sesuai Admin Borders)
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
  contentWrap: {
    gap: 16,
  },

  // ── Filter Card (Persis Admin Borders)
  filterCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 12,
    marginBottom: 14,
  },
  topFilterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  filterSectionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
  },
  addNewBannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addNewBannerBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
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
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  statusFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statusFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  statusFilterChipActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  statusFilterText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  statusFilterTextActive: {
    color: "#FFFFFF",
  },

  // ── Rarity Filter (Persis Admin Borders)
  rarityFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.04)",
  },
  rarityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  rarityChipActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  rarityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rarityChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  rarityChipTextActive: {
    color: "#FFFFFF",
  },

  // ── Grid Banner Cards (Persis Admin Borders Layout)
  bannerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  bannerCard: {
    flex: 1,
    minWidth: 210,
    maxWidth: 340,
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 10,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rarityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  rarityBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  rarityBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  statusInactive: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  statusPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
  },
  textActive: {
    color: "#10B981",
  },
  textInactive: {
    color: "#F59E0B",
  },

  // ── Image Preview Box (Sesuai PreviewBox Borders)
  imagePreviewBox: {
    height: 120,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  gifBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  gifBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 8.5,
    color: "#FFFFFF",
  },

  // ── Card Details
  bannerName: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  bannerId: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  urlStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
  },
  urlStatusHas: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  urlStatusMissing: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  urlStatusText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
  },
  specRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  specText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },
  specVal: {
    fontFamily: "Nunito-Bold",
    color: "#94A3B8",
  },
  specDivider: {
    color: "#475569",
    fontSize: 10,
  },

  // ── Card Action Buttons (Persis Admin Borders)
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 7,
    paddingVertical: 7,
  },
  editBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },
  copyUrlBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.22)",
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Generic Content Card (Pricing & Simulator)
  contentCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardHeaderIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
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
    marginTop: 1,
  },
  rowTwoCols: {
    flexDirection: "row",
    gap: 10,
  },
  formGroup: {
    gap: 5,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  requiredMark: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#F43F5E",
    letterSpacing: 0.3,
  },
  fieldLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  fieldHint: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
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
    minWidth: 0,
  },
  fieldInputError: {
    borderColor: "#F43F5E",
    backgroundColor: "rgba(244, 63, 94, 0.06)",
  },
  fieldErrorText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#F43F5E",
    marginTop: 2,
  },
  fieldHelperText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 14,
  },
  formGeneralError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.35)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 4,
  },
  formGeneralErrorText: {
    flex: 1,
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FDA4AF",
    lineHeight: 16,
  },
  formDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginVertical: 4,
  },
  ratesHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  ratesSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 1,
  },
  totalRateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  totalRateOk: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  totalRateWarn: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  totalRateText: {
    fontFamily: "Nunito-Black",
    fontSize: 11.5,
  },
  ratesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rateBox: {
    flex: 1,
    minWidth: 100,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 5,
  },
  rateLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
  },
  fieldInputSmall: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  warnRateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  warnRateText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#F59E0B",
    flex: 1,
  },
  saveConfigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  saveConfigBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },

  // ── Simulator Tab (Persis Borders Style)
  simActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 4,
  },
  simBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  simBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },
  simResetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  simResetText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  simStatsBox: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 8,
  },
  simStatsTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  simStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  simStatPill: {
    flex: 1,
    minWidth: 80,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 7,
    padding: 8,
    alignItems: "center",
    gap: 2,
  },
  simStatLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
  },
  simStatCount: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  simStatPct: {
    fontFamily: "Nunito-Regular",
    fontSize: 9.5,
    color: "#64748B",
  },
  simResultsHeading: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  simResultsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  simResultCard: {
    flex: 1,
    minWidth: 120,
    maxWidth: 160,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  simResultImg: {
    height: 70,
    width: "100%",
  },
  simRarityTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  simRarityText: {
    fontFamily: "Nunito-Black",
    fontSize: 8.5,
  },
  simResultName: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
    marginTop: 2,
  },

  // ── Mass Gift Tab
  giftTypeRow: {
    flexDirection: "row",
    gap: 8,
  },
  giftTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  giftTypeBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  giftTypeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  giftTypeTextActive: {
    color: "#FFFFFF",
  },
  broadcastBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 6,
  },
  broadcastBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#FFFFFF",
  },

  // ── Modals (Persis Admin Borders)
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  modalHeaderSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  modalImgPreviewWrap: {
    height: 100,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  modalImgPreview: {
    width: "100%",
    height: "100%",
  },
  raritySelectRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  raritySelectBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  raritySelectText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  toggleHint: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 2,
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  modalCancelText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  modalSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
    minWidth: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSaveText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  // ── Modal Delete Confirmation (Persis Admin Borders)
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  deleteModalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.3)",
    gap: 14,
  },
  deleteModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deleteIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteModalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  deleteModalSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  deletePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  deletePreviewImg: {
    width: 64,
    height: 50,
    borderRadius: 6,
  },
  deletePreviewMeta: {
    flex: 1,
    gap: 2,
  },
  deletePreviewName: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  deletePreviewId: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },
  deletePreviewWarning: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#F87171",
    lineHeight: 14,
    marginTop: 2,
  },
  deleteModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  deleteCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  deleteCancelBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  deleteConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: "#E11D48",
  },
  deleteConfirmBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  giftConfirmDetailBox: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 12,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  giftConfirmDetailLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
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
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 36,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  emptyTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
  resetFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.20)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 6,
  },
  resetFilterBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },

  // ── Toast Notifikasi Aksi (Persis Admin Borders)
  toastContainer: {
    position: "absolute",
    bottom: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 9999,
    maxWidth: 420,
  },
  toastSuccess: {
    backgroundColor: "#065F46",
    borderColor: "#059669",
  },
  toastError: {
    backgroundColor: "#9F1239",
    borderColor: "#E11D48",
  },
  toastText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
    flex: 1,
  },

  // ── Hadiah Massal Riwayat Styles
  refreshGiftsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  refreshGiftsText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  giftHistoryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  giftHistoryLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  giftHistoryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  giftTypeCrystalBox: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  giftTypeBorderBox: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  giftHistoryTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  giftAudienceBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
  },
  giftAudienceText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#38BDF8",
  },
  giftHistoryMsg: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
    lineHeight: 17,
  },
  giftHistoryDate: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },
  giftHistoryValue: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#38BDF8",
  },
  deleteGiftBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  deleteGiftBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#EF4444",
  },
  giftEmptyBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 8,
  },
  giftEmptyTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  giftEmptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    textAlign: "center",
    maxWidth: 380,
  },

  // ── Border Selector Styles
  borderSelectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 46,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  borderSelectTriggerActive: {
    borderColor: "#38BDF8",
  },
  borderThumbMini: {
    width: 32,
    height: 32,
  },
  borderThumbFallback: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  borderSelectName: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  borderSelectId: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  borderRarityPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  borderRarityPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
  },
  borderDropdownMenu: {
    marginTop: 6,
    backgroundColor: "#161B26",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },
  borderDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  borderDropdownItemActive: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
  },
  borderItemName: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  borderItemId: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },
});
