import React, { useCallback, useEffect, useState, useMemo } from "react";
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
import { BorderAvatar } from "@/components/border-avatar";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  type AvatarBorder,
  type BorderRarity,
  BORDER_RARITIES,
  BORDER_RARITY_PRICES,
  RARITY_THEME,
} from "@/lib/avatar-borders";
import {
  type AdminUser,
  getAdminBordersCatalog,
  updateAdminBorder,
  createAdminBorder,
  deleteAdminBorder,
} from "@/lib/admin-service";
import { useAnirakuAuth } from "@/providers/auth-provider";

// ─── SAMPLE AVATARS FOR LIVE TESTING ───────────────────────────────────────
const TEST_AVATARS = [
  { label: "Anime Girl", url: "https://s4.anilist.co/file/anilistcdn/character/large/b176754-PCnpqIOkjhFk.png" },
  { label: "Anime Boy", url: "https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png" },
  { label: "Cyberpunk", url: "https://s4.anilist.co/file/anilistcdn/character/large/b284158-z1uGKC3IYVa1.png" },
];

type StatusFilter = "all" | "released" | "pending" | "has_url" | "no_url";

export default function AdminBordersScreen() {
  const auth = useAnirakuAuth();
  const [loading, setLoading] = useState(true);
  const [borders, setBorders] = useState<AvatarBorder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRarity, setSelectedRarity] = useState<BorderRarity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [testAvatarIdx, setTestAvatarIdx] = useState(0);
  const [editingBorder, setEditingBorder] = useState<AvatarBorder | null>(null);
  const [saving, setSaving] = useState(false);
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);

  // ─── TAMBAH BORDER BARU MODAL STATES ───
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBorderId, setNewBorderId] = useState("");
  const [newBorderName, setNewBorderName] = useState("");
  const [newBorderRarity, setNewBorderRarity] = useState<BorderRarity>("Rare");
  const [newBorderAssetUrl, setNewBorderAssetUrl] = useState("");
  const [newBorderPrice, setNewBorderPrice] = useState("2000");
  const [newBorderInnerRatio, setNewBorderInnerRatio] = useState(0.74);
  const [newBorderScale, setNewBorderScale] = useState(1.0);
  const [newBorderOffsetX, setNewBorderOffsetX] = useState(0.0);
  const [newBorderOffsetY, setNewBorderOffsetY] = useState(0.0);
  const [newBorderDescription, setNewBorderDescription] = useState("");
  const [newBorderReleased, setNewBorderReleased] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createGeneralError, setCreateGeneralError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ─── KONFIRMASI HAPUS BORDER (WEB & MOBILE DIALOG) ───
  const [confirmDeleteBorder, setConfirmDeleteBorder] = useState<AvatarBorder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionToast, setActionToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setActionToast({ message, type });
    setTimeout(() => setActionToast(null), 4000);
  };

  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  // ─── Admin user dari auth asli atau fallback ───
  const adminUser: AdminUser = auth.user
    ? {
        id: auth.user.id,
        email: auth.user.email ?? "",
        username:
          auth.profile?.display_name ??
          auth.user.user_metadata?.full_name ??
          auth.user.email?.split("@")[0] ??
          "Admin",
        role: "super_admin",
      }
    : {
        id: "admin-super",
        email: "admin@nuenime.com",
        username: "Super Admin",
        role: "super_admin",
      };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAdminBordersCatalog();
      const seen = new Set<string>();
      const uniqueList: AvatarBorder[] = [];
      for (const b of list) {
        if (!b?.id || seen.has(b.id)) continue;
        seen.add(b.id);
        uniqueList.push(b);
      }
      setBorders(uniqueList);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── UNIQUE DEDUPLICATED BORDERS (Mencegah Duplikasi Tampilan) ───
  const uniqueBorders = useMemo(() => {
    const seen = new Set<string>();
    const list: AvatarBorder[] = [];
    for (const b of borders) {
      if (!b?.id || seen.has(b.id)) continue;
      seen.add(b.id);
      list.push(b);
    }
    return list;
  }, [borders]);

  // ─── FILTERED BORDERS ───
  const filteredBorders = useMemo(() => {
    return uniqueBorders.filter((b) => {
      // Rarity
      if (selectedRarity !== "all" && b.rarity !== selectedRarity) return false;

      // Status
      const hasUrl = !!(b.assetUrl && b.assetUrl.trim().length > 0);
      if (statusFilter === "released" && !b.isReleased) return false;
      if (statusFilter === "pending" && b.isReleased) return false;
      if (statusFilter === "has_url" && !hasUrl) return false;
      if (statusFilter === "no_url" && hasUrl) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = b.name.toLowerCase().includes(q);
        const matchId = b.id.toLowerCase().includes(q);
        const matchDesc = (b.description || "").toLowerCase().includes(q);
        if (!matchName && !matchId && !matchDesc) return false;
      }

      return true;
    });
  }, [uniqueBorders, selectedRarity, statusFilter, searchQuery]);

  // ─── STATS ───
  const totalCount = uniqueBorders.length;
  const releasedCount = uniqueBorders.filter((b) => b.isReleased).length;
  const pendingCount = totalCount - releasedCount;
  const withUrlCount = uniqueBorders.filter((b) => b.assetUrl && b.assetUrl.trim().length > 0).length;

  // Toggle Released One-Click
  const handleToggleReleased = async (border: AvatarBorder) => {
    hapticLight();
    if (!border.isReleased && !border.assetUrl) {
      hapticWarning();
      Alert.alert(
        "URL Aset Diperlukan",
        `Border ${border.name} belum memiliki URL aset. Silakan isi URL gambar PNG transparan terlebih dahulu via Edit Pengaturan.`
      );
      return;
    }

    const updated = await updateAdminBorder(
      border.id,
      { isReleased: !border.isReleased },
      adminUser
    );
    if (updated) {
      hapticSuccess();
      setBorders((prev) =>
        prev.map((b) => (b.id === border.id ? { ...b, isReleased: !border.isReleased } : b))
      );
    }
  };

  // Copy URL
  const handleCopyUrl = (border: AvatarBorder) => {
    if (!border.assetUrl) return;
    hapticLight();
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(border.assetUrl);
      setCopySuccessId(border.id);
      setTimeout(() => setCopySuccessId(null), 2000);
    } else {
      Alert.alert("URL Aset", border.assetUrl);
    }
  };

  const handleOpenAddModal = () => {
    const initialRarity: BorderRarity = "Rare";
    const count = uniqueBorders.filter((b) => b.rarity === initialRarity).length + 1;
    setNewBorderId(`${initialRarity.toLowerCase()}_${count}`);
    setNewBorderName("");
    setNewBorderRarity(initialRarity);
    setNewBorderAssetUrl("");
    setNewBorderPrice(String(BORDER_RARITY_PRICES[initialRarity] || 2000));
    setNewBorderInnerRatio(0.74);
    setNewBorderScale(1.0);
    setNewBorderOffsetX(0.0);
    setNewBorderOffsetY(0.0);
    setNewBorderDescription("");
    setNewBorderReleased(true);
    setCreateErrors({});
    setCreateGeneralError(null);
    setShowAddModal(true);
  };

  const handleRarityChangeInCreate = (rarity: BorderRarity) => {
    setNewBorderRarity(rarity);
    setNewBorderPrice(String(BORDER_RARITY_PRICES[rarity] || 2000));
    if (createErrors.price) setCreateErrors((prev) => ({ ...prev, price: "" }));
    if (!newBorderName.trim()) {
      const count = uniqueBorders.filter((b) => b.rarity === rarity).length + 1;
      setNewBorderId(`${rarity.toLowerCase()}_${count}`);
      if (createErrors.id) setCreateErrors((prev) => ({ ...prev, id: "" }));
    }
  };

  const handleNameChangeInCreate = (name: string) => {
    setNewBorderName(name);
    if (createErrors.name) setCreateErrors((prev) => ({ ...prev, name: "" }));
    if (name.trim()) {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
      setNewBorderId(`${newBorderRarity.toLowerCase()}_${slug}`);
      if (createErrors.id) setCreateErrors((prev) => ({ ...prev, id: "" }));
    }
  };

  const handleCreateBorder = async () => {
    const errors: Record<string, string> = {};

    const cleanName = newBorderName.trim();
    if (!cleanName) {
      errors.name = "Nama border wajib diisi (contoh: Cyberpunk Neon Ring).";
    } else if (cleanName.length < 2) {
      errors.name = "Nama border minimal 2 karakter.";
    }

    const cleanId = newBorderId.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!cleanId) {
      errors.id = "ID unik border wajib diisi (gunakan huruf kecil, angka, underscore).";
    } else if (uniqueBorders.some((b) => b.id.toLowerCase() === cleanId)) {
      errors.id = `ID "${cleanId}" sudah digunakan oleh border lain. Gunakan ID unik yang berbeda.`;
    }

    const cleanUrl = newBorderAssetUrl.trim();
    if (!cleanUrl) {
      errors.assetUrl = "URL gambar PNG transparan wajib diisi agar border dapat tampil.";
    } else if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      errors.assetUrl = "URL harus diawali dengan http:// atau https:// (contoh: https://i.ibb.co.com/xxx/border.png)";
    }

    const priceNum = parseInt(newBorderPrice.trim(), 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      errors.price = "Harga Crystal harus berupa angka positif lebih dari 0.";
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      setCreateGeneralError("Mohon lengkapi semua data wajib yang ditandai peringatan merah di bawah.");
      hapticWarning();
      return;
    }

    setCreateErrors({});
    setCreateGeneralError(null);
    setCreating(true);
    hapticLight();

    const res = await createAdminBorder(
      {
        id: cleanId,
        name: cleanName,
        rarity: newBorderRarity,
        assetUrl: cleanUrl,
        innerRatio: newBorderInnerRatio,
        scale: newBorderScale,
        offsetX: newBorderOffsetX,
        offsetY: newBorderOffsetY,
        isReleased: newBorderReleased,
        description: newBorderDescription.trim() || undefined,
        priceCrystal: priceNum,
      },
      adminUser
    );

    setCreating(false);

    if (res.success && res.border) {
      hapticSuccess();
      setBorders((prev) => [res.border!, ...prev.filter((b) => b.id !== res.border!.id)]);
      setShowAddModal(false);
      showToast(
        `Border "${res.border.name}" (${res.border.rarity}) berhasil disimpan ke database dan aktif di APK!`,
        "success"
      );
    } else {
      const errMsg = res.error || "Gagal menyimpan border ke database Supabase.";
      setCreateGeneralError(errMsg);
      showToast(errMsg, "error");
    }
  };

  const handleDeleteBorder = (border: AvatarBorder) => {
    hapticWarning();
    setConfirmDeleteBorder(border);
  };

  const handleExecuteDelete = async () => {
    if (!confirmDeleteBorder) return;
    const target = confirmDeleteBorder;
    setIsDeleting(true);
    setDeletingId(target.id);
    hapticLight();

    const res = await deleteAdminBorder(target.id, adminUser);
    setDeletingId(null);
    setIsDeleting(false);
    setConfirmDeleteBorder(null);

    if (res.success) {
      hapticSuccess();
      setBorders((prev) => prev.filter((b) => b.id !== target.id));
      showToast(res.message, "success");
    } else {
      showToast(res.message || "Gagal menghapus border.", "error");
    }
  };

  // Save Details from Modal
  const handleSaveBorderDetails = async () => {
    if (!editingBorder) return;
    setSaving(true);
    hapticLight();

    const url = editingBorder.assetUrl?.trim() || null;
    if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
      showToast("URL aset harus diawali dengan http:// atau https://", "error");
      setSaving(false);
      return;
    }

    const result = await updateAdminBorder(
      editingBorder.id,
      {
        name: editingBorder.name,
        assetUrl: url,
        innerRatio: editingBorder.innerRatio,
        offsetX: editingBorder.offsetX,
        offsetY: editingBorder.offsetY,
        scale: editingBorder.scale,
        isReleased: editingBorder.isReleased,
        description: editingBorder.description,
        priceCrystal: editingBorder.priceCrystal,
        isActive: editingBorder.isActive ?? true,
      },
      adminUser
    );

    setSaving(false);
    if (result) {
      hapticSuccess();
      setBorders((prev) =>
        prev.map((b) => (b.id === editingBorder.id ? { ...result } : b))
      );
      setEditingBorder(null);
      showToast(
        url
          ? `Border "${editingBorder.name}" berhasil disimpan & ${editingBorder.isReleased ? "dirilis di Shop" : "disembunyikan"}.`
          : `Border "${editingBorder.name}" disimpan. Status: Segera Hadir.`,
        "success"
      );
    } else {
      showToast("Gagal menyimpan perubahan ke database Supabase.", "error");
    }
  };

  return (
    <AdminLayout
      title="Inventory & Border Avatar"
      subtitle={`Kelola katalog ${totalCount} border avatar, penyesuaian rasio, dan status rilis`}
      activeKey="borders"
    >
      {/* ─── TOP KPI STRIP ─── */}
      <View style={[styles.kpiStrip, !isWide && styles.kpiStripMobile]}>
        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
            <AppIcon name="palette-swatch-outline" size={18} color="#38BDF8" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Total Border</Text>
            <Text style={styles.kpiStripVal}>{totalCount} Item</Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
            <AppIcon name="check-circle" size={18} color="#10B981" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Rilis di Shop (Aktif)</Text>
            <Text style={[styles.kpiStripVal, { color: "#10B981" }]}>
              {releasedCount} / {totalCount}
            </Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
            <AppIcon name="clock-outline" size={18} color="#F59E0B" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Segera Hadir</Text>
            <Text style={[styles.kpiStripVal, { color: "#F59E0B" }]}>
              {pendingCount} Item
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
              {withUrlCount} ({totalCount > 0 ? ((withUrlCount / totalCount) * 100).toFixed(0) : 0}%)
            </Text>
          </View>
        </View>
      </View>

      {/* ─── INFO BANNER & TEST AVATAR SWITCHER ─── */}
      <View style={styles.infoBanner}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 }}>
          <View style={styles.infoIconWrap}>
            <AppIcon name="information-outline" size={15} color="#38BDF8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Panduan Rilis Border Avatar</Text>
            <Text style={styles.infoBannerText}>
              Isi URL gambar PNG transparan berkualitas tinggi agar border otomatis dirilis ke Shop pengguna.
              Admin dapat mengatur inner-ratio dan offset agar avatar pas di dalam bingkai.
            </Text>
          </View>
        </View>

        {/* Avatar Tester Switcher */}
        <View style={styles.testAvatarRow}>
          <Text style={styles.testAvatarLabel}>Uji Avatar:</Text>
          <View style={styles.testAvatarPills}>
            {TEST_AVATARS.map((av, idx) => (
              <Pressable
                key={av.label}
                onPress={() => {
                  hapticLight();
                  setTestAvatarIdx(idx);
                }}
                style={[
                  styles.testAvatarBtn,
                  testAvatarIdx === idx && styles.testAvatarBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.testAvatarBtnText,
                    testAvatarIdx === idx && styles.testAvatarBtnTextActive,
                  ]}
                >
                  {av.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* ─── SEARCH & FILTER SECTION ─── */}
      <View style={styles.filterCard}>
        {/* Header Action: Tambah Border Baru Button */}
        <View style={styles.topFilterHeader}>
          <Text style={styles.filterSectionTitle}>Katalog & Filter Border</Text>
          <Pressable
            onPress={() => {
              hapticLight();
              handleOpenAddModal();
            }}
            style={styles.addNewBorderBtn}
          >
            <AppIcon name="plus" size={15} color="#FFFFFF" />
            <Text style={styles.addNewBorderBtnText}>Tambah Border Baru</Text>
          </Pressable>
        </View>

        {/* Search Bar & Status Chips */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <AppIcon name="magnify" size={18} color="#94A3B8" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cari nama border atau ID..."
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
              { key: "released", label: "Rilis (Aktif)" },
              { key: "pending", label: "Segera Hadir" },
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

        {/* Rarity Filter Row */}
        <View style={styles.rarityFilterRow}>
          <Pressable
            onPress={() => {
              hapticLight();
              setSelectedRarity("all");
            }}
            style={[
              styles.rarityChip,
              selectedRarity === "all" && styles.rarityChipActive,
            ]}
          >
            <Text
              style={[
                styles.rarityChipText,
                selectedRarity === "all" && styles.rarityChipTextActive,
              ]}
            >
              Semua Rarity ({totalCount})
            </Text>
          </Pressable>

          {BORDER_RARITIES.map((r) => {
            const theme = RARITY_THEME[r];
            const count = uniqueBorders.filter((b) => b.rarity === r).length;
            const isActive = selectedRarity === r;
            return (
              <Pressable
                key={r}
                onPress={() => {
                  hapticLight();
                  setSelectedRarity(r);
                }}
                style={[
                  styles.rarityChip,
                  isActive && {
                    backgroundColor: `${theme.color}25`,
                    borderColor: theme.color,
                  },
                ]}
              >
                <View style={[styles.rarityDot, { backgroundColor: theme.color }]} />
                <Text
                  style={[
                    styles.rarityChipText,
                    isActive && { color: theme.color, fontFamily: "Nunito-Black" },
                  ]}
                >
                  {r} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ─── GRID KARTU BORDER AVATAR ─── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#CBD5E1" />
          <Text style={styles.loadingText}>Memuat katalog border avatar...</Text>
        </View>
      ) : filteredBorders.length === 0 ? (
        <View style={styles.emptyWrap}>
          <AppIcon name="palette-swatch-outline" size={40} color="#334155" />
          <Text style={styles.emptyTitle}>Tidak ada border yang cocok</Text>
          <Text style={styles.emptySubtitle}>
            Coba ubah kata kunci pencarian atau sesuaikan filter status dan rarity
          </Text>
          <Pressable
            onPress={() => {
              setSearchQuery("");
              setSelectedRarity("all");
              setStatusFilter("all");
            }}
            style={styles.resetFilterBtn}
          >
            <AppIcon name="refresh" size={13} color="#FFFFFF" />
            <Text style={styles.resetFilterBtnText}>Reset Semua Filter</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.borderGrid}>
          {filteredBorders.map((b) => {
            const theme = RARITY_THEME[b.rarity];
            const hasUrl = !!(b.assetUrl && b.assetUrl.trim().length > 0);
            return (
              <View
                key={b.id}
                style={[
                  styles.borderCard,
                  b.isReleased && { borderColor: `${theme.color}40` },
                ]}
              >
                {/* Rarity & Release Status */}
                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.rarityBadge,
                      { backgroundColor: theme.bgBadge, borderColor: theme.borderBadge },
                    ]}
                  >
                    <View style={[styles.rarityBadgeDot, { backgroundColor: theme.color }]} />
                    <Text style={[styles.rarityBadgeText, { color: theme.color }]}>
                      {b.rarity.toUpperCase()}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleToggleReleased(b)}
                    style={[
                      styles.releasedPill,
                      b.isReleased ? styles.releasedActive : styles.releasedInactive,
                    ]}
                  >
                    <AppIcon
                      name={b.isReleased ? "check-circle" : "clock-outline"}
                      size={10}
                      color={b.isReleased ? "#10B981" : "#F59E0B"}
                    />
                    <Text
                      style={[
                        styles.releasedPillText,
                        b.isReleased ? styles.textReleased : styles.textUnreleased,
                      ]}
                    >
                      {b.isReleased ? "Rilis" : "Segera Hadir"}
                    </Text>
                  </Pressable>
                </View>

                {/* Live Preview Avatar dengan Border */}
                <View style={[styles.previewBox, { borderColor: `${theme.color}20` }]}>
                  <BorderAvatar
                    avatarUrl={TEST_AVATARS[testAvatarIdx].url}
                    fallbackText="N"
                    border={b}
                    avatarSize={60}
                  />
                </View>

                {/* Border Name & ID */}
                <View>
                  <Text style={styles.borderName} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text style={styles.borderId} numberOfLines={1}>
                    ID: {b.id}
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

                {/* Ratio & Scale Spec */}
                <View style={styles.specRow}>
                  <Text style={styles.specText}>
                    Ratio: <Text style={styles.specVal}>{b.innerRatio ?? 0.74}</Text>
                  </Text>
                  <Text style={styles.specDivider}>·</Text>
                  <Text style={styles.specText}>
                    Scale: <Text style={styles.specVal}>{b.scale ?? 1.0}</Text>
                  </Text>
                  <Text style={styles.specDivider}>·</Text>
                  <Text style={styles.specText}>
                    Offset: <Text style={styles.specVal}>{b.offsetX ?? 0}/{b.offsetY ?? 0}</Text>
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.cardActionRow}>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setEditingBorder({ ...b });
                    }}
                    style={styles.editBorderBtn}
                  >
                    <AppIcon name="pencil" size={12} color="#FFFFFF" />
                    <Text style={styles.editBorderBtnText}>Edit</Text>
                  </Pressable>

                  {hasUrl && (
                    <Pressable
                      onPress={() => handleCopyUrl(b)}
                      style={styles.copyUrlBtn}
                    >
                      <AppIcon
                        name={copySuccessId === b.id ? "check" : "content-copy"}
                        size={12}
                        color={copySuccessId === b.id ? "#10B981" : "#94A3B8"}
                      />
                    </Pressable>
                  )}

                  <Pressable
                    disabled={deletingId === b.id}
                    onPress={() => handleDeleteBorder(b)}
                    style={styles.deleteBorderBtn}
                  >
                    {deletingId === b.id ? (
                      <ActivityIndicator size="small" color="#F43F5E" />
                    ) : (
                      <AppIcon name="trash-can-outline" size={13} color="#F43F5E" />
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ─── MODAL EDIT PENGATURAN BORDER ─── */}
      <Modal visible={editingBorder !== null} transparent animationType="fade">
        <ScrollView
          contentContainerStyle={styles.modalBackdrop}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Border Avatar</Text>
                <Text style={styles.modalSubtitle}>ID: {editingBorder?.id}</Text>
              </View>
              <Pressable
                onPress={() => setEditingBorder(null)}
                style={styles.modalCloseBtn}
              >
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            {editingBorder && (
              <>
                {/* Live Preview Box in Modal */}
                <View style={styles.modalPreviewRow}>
                  <BorderAvatar
                    avatarUrl={TEST_AVATARS[testAvatarIdx].url}
                    fallbackText="N"
                    border={editingBorder}
                    avatarSize={64}
                  />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.modalPreviewName}>{editingBorder.name}</Text>
                    <View
                      style={[
                        styles.rarityBadge,
                        {
                          alignSelf: "flex-start",
                          backgroundColor: RARITY_THEME[editingBorder.rarity].bgBadge,
                          borderColor: RARITY_THEME[editingBorder.rarity].borderBadge,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rarityBadgeText,
                          { color: RARITY_THEME[editingBorder.rarity].color },
                        ]}
                      >
                        {editingBorder.rarity.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.modalPreviewHint}>
                      {editingBorder.assetUrl
                        ? "URL aset tersedia · Siap rilis di Shop"
                        : "Belum ada URL aset · Status Segera Hadir"}
                    </Text>
                  </View>
                </View>

                {/* Form Nama Border */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Nama Border:</Text>
                  <TextInput
                    value={editingBorder.name}
                    onChangeText={(t) => setEditingBorder({ ...editingBorder, name: t })}
                    style={styles.fieldInput}
                  />
                </View>

                {/* Form Harga Crystal */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>
                    Harga Crystal:{" "}
                    <Text style={{ color: "#94A3B8" }}>(Default tier {editingBorder.rarity}: {BORDER_RARITY_PRICES[editingBorder.rarity] || 2000})</Text>
                  </Text>
                  <TextInput
                    value={editingBorder.priceCrystal !== undefined && editingBorder.priceCrystal !== null ? String(editingBorder.priceCrystal) : ""}
                    onChangeText={(t) => {
                      const num = t.trim() === "" ? null : parseInt(t) || null;
                      setEditingBorder({ ...editingBorder, priceCrystal: num });
                    }}
                    placeholder={`Default tier: ${BORDER_RARITY_PRICES[editingBorder.rarity] || 2000}`}
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    style={styles.fieldInput}
                  />
                </View>

                {/* Form URL Aset */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>
                    URL Aset PNG Transparan:{" "}
                    <Text style={{ color: "#F59E0B" }}>(Isi → Otomatis Aktif)</Text>
                  </Text>
                  <TextInput
                    value={editingBorder.assetUrl || ""}
                    onChangeText={(t) => {
                      const url = t.trim() || null;
                      setEditingBorder({
                        ...editingBorder,
                        assetUrl: url,
                        isReleased: !!(url && url.length > 0),
                      });
                    }}
                    placeholder="https://.../border.png"
                    placeholderTextColor="#64748B"
                    style={styles.fieldInput}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>

                {/* Status Rilis Toggle */}
                <View style={styles.toggleRow}>
                  <View>
                    <Text style={styles.fieldLabel}>Status Rilis di Aplikasi:</Text>
                    <Text style={styles.toggleHint}>
                      {editingBorder.isReleased
                        ? "Aktif & Dapat Dilihat di Shop Pengguna"
                        : "Tersembunyi (Segera Hadir)"}
                    </Text>
                  </View>
                  <Switch
                    value={editingBorder.isReleased ?? false}
                    onValueChange={(val) =>
                      setEditingBorder({ ...editingBorder, isReleased: val })
                    }
                    trackColor={{ false: "rgba(255,255,255,0.1)", true: "rgba(16,185,129,0.5)" }}
                    thumbColor={editingBorder.isReleased ? "#10B981" : "#64748B"}
                  />
                </View>

                {/* Slider / Step Adjustment: Inner Ratio & Scale */}
                <View style={styles.rowTwoCols}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Inner Ratio (0.60–0.90):</Text>
                    <View style={styles.stepInputWrap}>
                      <TextInput
                        value={String(editingBorder.innerRatio ?? 0.74)}
                        keyboardType="numeric"
                        onChangeText={(t) =>
                          setEditingBorder({
                            ...editingBorder,
                            innerRatio: parseFloat(t) || 0.74,
                          })
                        }
                        style={[styles.fieldInput, { flex: 1 }]}
                      />
                      <Pressable
                        onPress={() =>
                          setEditingBorder({
                            ...editingBorder,
                            innerRatio: Math.max(
                              0.5,
                              parseFloat(((editingBorder.innerRatio ?? 0.74) - 0.02).toFixed(2))
                            ),
                          })
                        }
                        style={styles.stepBtn}
                      >
                        <Text style={styles.stepBtnText}>-</Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setEditingBorder({
                            ...editingBorder,
                            innerRatio: Math.min(
                              1.0,
                              parseFloat(((editingBorder.innerRatio ?? 0.74) + 0.02).toFixed(2))
                            ),
                          })
                        }
                        style={styles.stepBtn}
                      >
                        <Text style={styles.stepBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Scale (Default 1.0):</Text>
                    <View style={styles.stepInputWrap}>
                      <TextInput
                        value={String(editingBorder.scale ?? 1.0)}
                        keyboardType="numeric"
                        onChangeText={(t) =>
                          setEditingBorder({
                            ...editingBorder,
                            scale: parseFloat(t) || 1.0,
                          })
                        }
                        style={[styles.fieldInput, { flex: 1 }]}
                      />
                      <Pressable
                        onPress={() =>
                          setEditingBorder({
                            ...editingBorder,
                            scale: Math.max(
                              0.5,
                              parseFloat(((editingBorder.scale ?? 1.0) - 0.05).toFixed(2))
                            ),
                          })
                        }
                        style={styles.stepBtn}
                      >
                        <Text style={styles.stepBtnText}>-</Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setEditingBorder({
                            ...editingBorder,
                            scale: Math.min(
                              2.0,
                              parseFloat(((editingBorder.scale ?? 1.0) + 0.05).toFixed(2))
                            ),
                          })
                        }
                        style={styles.stepBtn}
                      >
                        <Text style={styles.stepBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Offset X & Offset Y */}
                <View style={styles.rowTwoCols}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Offset X (Horisontal):</Text>
                    <TextInput
                      value={String(editingBorder.offsetX ?? 0.0)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setEditingBorder({
                          ...editingBorder,
                          offsetX: parseFloat(t) || 0.0,
                        })
                      }
                      style={styles.fieldInput}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Offset Y (Vertikal):</Text>
                    <TextInput
                      value={String(editingBorder.offsetY ?? 0.0)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setEditingBorder({
                          ...editingBorder,
                          offsetY: parseFloat(t) || 0.0,
                        })
                      }
                      style={styles.fieldInput}
                    />
                  </View>
                </View>

                {/* Deskripsi */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Deskripsi Border:</Text>
                  <TextInput
                    value={editingBorder.description || ""}
                    onChangeText={(t) =>
                      setEditingBorder({ ...editingBorder, description: t })
                    }
                    placeholder="Tuliskan latar belakang atau efek border ini..."
                    placeholderTextColor="#64748B"
                    style={[styles.fieldInput, { minHeight: 60, textAlignVertical: "top" }]}
                    multiline
                  />
                </View>

                {/* Reset to Default Button */}
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setEditingBorder({
                      ...editingBorder,
                      innerRatio: 0.74,
                      scale: 1.0,
                      offsetX: 0.0,
                      offsetY: 0.0,
                    });
                  }}
                  style={styles.resetDefaultBtn}
                >
                  <AppIcon name="refresh" size={13} color="#94A3B8" />
                  <Text style={styles.resetDefaultText}>Reset Rasio ke Default (0.74 / 1.0)</Text>
                </Pressable>
              </>
            )}

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setEditingBorder(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={handleSaveBorderDetails}
                style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Simpan Perubahan</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Modal>

      {/* ─── MODAL TAMBAH BORDER BARU ─── */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <ScrollView
          contentContainerStyle={styles.modalBackdrop}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Tambah Koleksi Border Baru</Text>
                <Text style={styles.modalSubtitle}>Simpan ke database utama & langsung sinkron ke APK</Text>
              </View>
              <Pressable
                onPress={() => setShowAddModal(false)}
                style={styles.modalCloseBtn}
              >
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            {/* Live Preview Box in Modal */}
            <View style={styles.modalPreviewRow}>
              <BorderAvatar
                avatarUrl={TEST_AVATARS[testAvatarIdx].url}
                fallbackText="N"
                border={{
                  id: newBorderId || "preview",
                  name: newBorderName || "Preview Border",
                  rarity: newBorderRarity,
                  assetUrl: newBorderAssetUrl.trim() || null,
                  innerRatio: newBorderInnerRatio,
                  scale: newBorderScale,
                  offsetX: newBorderOffsetX,
                  offsetY: newBorderOffsetY,
                }}
                avatarSize={64}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.modalPreviewName}>
                  {newBorderName.trim() || "Nama Border Baru"}
                </Text>
                <View
                  style={[
                    styles.rarityBadge,
                    {
                      alignSelf: "flex-start",
                      backgroundColor: RARITY_THEME[newBorderRarity].bgBadge,
                      borderColor: RARITY_THEME[newBorderRarity].borderBadge,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.rarityBadgeText,
                      { color: RARITY_THEME[newBorderRarity].color },
                    ]}
                  >
                    {newBorderRarity.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.modalPreviewHint}>
                  Harga: {newBorderPrice ? parseInt(newBorderPrice).toLocaleString() : BORDER_RARITY_PRICES[newBorderRarity].toLocaleString()} Crystal · {newBorderAssetUrl.trim() ? "Aset Siap" : "Belum Ada URL"}
                </Text>
              </View>
            </View>

            {/* General Error Alert if any */}
            {createGeneralError && (
              <View style={styles.formGeneralError}>
                <AppIcon name="alert-circle" size={16} color="#F43F5E" />
                <Text style={styles.formGeneralErrorText}>{createGeneralError}</Text>
              </View>
            )}

            {/* Form Nama Border */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Nama Border:</Text>
                <Text style={styles.requiredMark}>*Wajib diisi</Text>
              </View>
              <TextInput
                value={newBorderName}
                onChangeText={handleNameChangeInCreate}
                placeholder="Misal: Cyberpunk Neon Ring"
                placeholderTextColor="#64748B"
                style={[
                  styles.fieldInput,
                  createErrors.name ? styles.fieldInputError : null,
                ]}
              />
              {createErrors.name ? (
                <View style={styles.fieldErrorRow}>
                  <AppIcon name="alert-circle-outline" size={13} color="#F43F5E" />
                  <Text style={styles.fieldErrorText}>{createErrors.name}</Text>
                </View>
              ) : null}
            </View>

            {/* Form ID Unik */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>
                  ID Unik Border: <Text style={{ color: "#94A3B8" }}>(Huruf kecil & underscore)</Text>
                </Text>
                <Text style={styles.requiredMark}>*Wajib diisi</Text>
              </View>
              <TextInput
                value={newBorderId}
                onChangeText={(t) => {
                  setNewBorderId(t);
                  if (createErrors.id) setCreateErrors((prev) => ({ ...prev, id: "" }));
                }}
                placeholder="misal: rare_cyber_ring"
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                style={[
                  styles.fieldInput,
                  createErrors.id ? styles.fieldInputError : null,
                ]}
              />
              {createErrors.id ? (
                <View style={styles.fieldErrorRow}>
                  <AppIcon name="alert-circle-outline" size={13} color="#F43F5E" />
                  <Text style={styles.fieldErrorText}>{createErrors.id}</Text>
                </View>
              ) : null}
            </View>

            {/* Form Kategori Rarity Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Pilih Kategori Rarity:</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {BORDER_RARITIES.map((r) => {
                  const isSel = newBorderRarity === r;
                  const theme = RARITY_THEME[r];
                  return (
                    <Pressable
                      key={r}
                      onPress={() => handleRarityChangeInCreate(r)}
                      style={[
                        styles.rarityChip,
                        isSel && {
                          backgroundColor: `${theme.color}25`,
                          borderColor: theme.color,
                        },
                      ]}
                    >
                      <View style={[styles.rarityDot, { backgroundColor: theme.color }]} />
                      <Text
                        style={[
                          styles.rarityChipText,
                          isSel && { color: theme.color, fontFamily: "Nunito-Black" },
                        ]}
                      >
                        {r}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Form Harga Crystal */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>
                  Harga Crystal: <Text style={{ color: "#94A3B8" }}>(Default kategori: {BORDER_RARITY_PRICES[newBorderRarity]})</Text>
                </Text>
                <Text style={styles.requiredMark}>*Wajib diisi</Text>
              </View>
              <TextInput
                value={newBorderPrice}
                onChangeText={(t) => {
                  setNewBorderPrice(t);
                  if (createErrors.price) setCreateErrors((prev) => ({ ...prev, price: "" }));
                }}
                placeholder={String(BORDER_RARITY_PRICES[newBorderRarity])}
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                style={[
                  styles.fieldInput,
                  createErrors.price ? styles.fieldInputError : null,
                ]}
              />
              {createErrors.price ? (
                <View style={styles.fieldErrorRow}>
                  <AppIcon name="alert-circle-outline" size={13} color="#F43F5E" />
                  <Text style={styles.fieldErrorText}>{createErrors.price}</Text>
                </View>
              ) : null}
            </View>

            {/* Form URL Aset */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>
                  URL Gambar PNG Transparan:
                </Text>
                <Text style={styles.requiredMark}>*Wajib diisi</Text>
              </View>
              <TextInput
                value={newBorderAssetUrl}
                onChangeText={(t) => {
                  setNewBorderAssetUrl(t);
                  if (createErrors.assetUrl) setCreateErrors((prev) => ({ ...prev, assetUrl: "" }));
                }}
                placeholder="https://i.ibb.co.com/.../border.png"
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                keyboardType="url"
                style={[
                  styles.fieldInput,
                  createErrors.assetUrl ? styles.fieldInputError : null,
                ]}
              />
              {createErrors.assetUrl ? (
                <View style={styles.fieldErrorRow}>
                  <AppIcon name="alert-circle-outline" size={13} color="#F43F5E" />
                  <Text style={styles.fieldErrorText}>{createErrors.assetUrl}</Text>
                </View>
              ) : (
                <Text style={styles.fieldHelperText}>
                  Masukkan link langsung gambar transparan (.png). Preview avatar akan langsung menampilkan border saat URL valid.
                </Text>
              )}
            </View>

            {/* Status Rilis Toggle */}
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.fieldLabel}>Status Rilis di Aplikasi:</Text>
                <Text style={styles.toggleHint}>
                  {newBorderReleased
                    ? "Aktif & Dapat Dilihat di Shop Pengguna"
                    : "Tersembunyi (Segera Hadir)"}
                </Text>
              </View>
              <Switch
                value={newBorderReleased}
                onValueChange={setNewBorderReleased}
                trackColor={{ false: "rgba(255,255,255,0.1)", true: "rgba(16,185,129,0.5)" }}
                thumbColor={newBorderReleased ? "#10B981" : "#64748B"}
              />
            </View>

            {/* Slider / Step Adjustment: Inner Ratio & Scale */}
            <View style={styles.rowTwoCols}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Inner Ratio (0.60–0.90):</Text>
                <View style={styles.stepInputWrap}>
                  <TextInput
                    value={String(newBorderInnerRatio)}
                    keyboardType="numeric"
                    onChangeText={(t) => setNewBorderInnerRatio(parseFloat(t) || 0.74)}
                    style={[styles.fieldInput, { flex: 1 }]}
                  />
                  <Pressable
                    onPress={() => setNewBorderInnerRatio(Math.max(0.5, parseFloat((newBorderInnerRatio - 0.02).toFixed(2))))}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepBtnText}>-</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setNewBorderInnerRatio(Math.min(1.0, parseFloat((newBorderInnerRatio + 0.02).toFixed(2))))}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Scale (Default 1.0):</Text>
                <View style={styles.stepInputWrap}>
                  <TextInput
                    value={String(newBorderScale)}
                    keyboardType="numeric"
                    onChangeText={(t) => setNewBorderScale(parseFloat(t) || 1.0)}
                    style={[styles.fieldInput, { flex: 1 }]}
                  />
                  <Pressable
                    onPress={() => setNewBorderScale(Math.max(0.5, parseFloat((newBorderScale - 0.05).toFixed(2))))}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepBtnText}>-</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setNewBorderScale(Math.min(2.0, parseFloat((newBorderScale + 0.05).toFixed(2))))}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Offset X & Offset Y */}
            <View style={styles.rowTwoCols}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Offset X (Horisontal):</Text>
                <TextInput
                  value={String(newBorderOffsetX)}
                  keyboardType="numeric"
                  onChangeText={(t) => setNewBorderOffsetX(parseFloat(t) || 0.0)}
                  style={styles.fieldInput}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Offset Y (Vertikal):</Text>
                <TextInput
                  value={String(newBorderOffsetY)}
                  keyboardType="numeric"
                  onChangeText={(t) => setNewBorderOffsetY(parseFloat(t) || 0.0)}
                  style={styles.fieldInput}
                />
              </View>
            </View>

            {/* Deskripsi */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Deskripsi Border:</Text>
              <TextInput
                value={newBorderDescription}
                onChangeText={setNewBorderDescription}
                placeholder="Tuliskan latar belakang atau efek border ini..."
                placeholderTextColor="#64748B"
                style={[styles.fieldInput, { minHeight: 60, textAlignVertical: "top" }]}
                multiline
              />
            </View>

            {/* Action buttons */}
            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setShowAddModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                disabled={creating}
                onPress={handleCreateBorder}
                style={[styles.modalSaveBtn, creating && { opacity: 0.6 }]}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Simpan Border Baru</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Modal>

      {/* ─── MODAL KONFIRMASI HAPUS BORDER PERMANEN (SILVER LIQUID GLASS) ─── */}
      <Modal visible={confirmDeleteBorder !== null} transparent animationType="fade">
        <View style={styles.modalBackdropCenter}>
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalHeader}>
              <View style={styles.deleteIconBadge}>
                <AppIcon name="trash-can-outline" size={24} color="#F43F5E" />
              </View>
              <Text style={styles.deleteModalTitle}>Hapus Border Permanen</Text>
              <Text style={styles.deleteModalDesc}>
                Apakah Anda yakin ingin menghapus border{" "}
                <Text style={{ fontWeight: "700", color: "#F8FAFC" }}>
                  "{confirmDeleteBorder?.name}"
                </Text>{" "}
                dari database?
              </Text>
            </View>

            {confirmDeleteBorder && (
              <View style={styles.deletePreviewContainer}>
                <BorderAvatar
                  avatarUrl={TEST_AVATARS[testAvatarIdx].url}
                  size={74}
                  border={confirmDeleteBorder}
                />
                <View style={styles.deletePreviewMeta}>
                  <Text style={styles.deletePreviewName}>{confirmDeleteBorder.name}</Text>
                  <Text style={styles.deletePreviewId}>ID: {confirmDeleteBorder.id}</Text>
                  <Text style={styles.deletePreviewWarning}>
                    💎 Fitur Otomatis: Setiap pengguna yang pernah membeli border ini akan otomatis menerima notifikasi dan reward pengembalian (refund) Dylan Crystal penuh di kotak masuk (Mailbox) mereka.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.deleteModalActions}>
              <Pressable
                disabled={isDeleting}
                onPress={() => setConfirmDeleteBorder(null)}
                style={styles.deleteCancelBtn}
              >
                <Text style={styles.deleteCancelBtnText}>Batal</Text>
              </Pressable>

              <Pressable
                disabled={isDeleting}
                onPress={handleExecuteDelete}
                style={[styles.deleteConfirmBtn, isDeleting && { opacity: 0.6 }]}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="trash-can-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.deleteConfirmBtnText}>Ya, Hapus Permanen</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── TOAST NOTIFIKASI AKSI ─── */}
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
    fontSize: 15,
    color: "#FFFFFF",
    marginTop: 2,
  },
  kpiStripDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },

  // ── Info Banner
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
  testAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  testAvatarLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
  },
  testAvatarPills: {
    flexDirection: "row",
    gap: 6,
  },
  testAvatarBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  testAvatarBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  testAvatarBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  testAvatarBtnTextActive: {
    color: "#FFFFFF",
  },

  // ── Filter Card
  filterCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 12,
    marginBottom: 16,
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

  // ── Rarity Filter
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

  // ── Border Card Grid
  borderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  borderCard: {
    flex: 1,
    minWidth: 200,
    maxWidth: 320,
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
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
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
    fontSize: 9,
  },
  releasedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  releasedActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  releasedInactive: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  releasedPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
  },
  textReleased: { color: "#10B981" },
  textUnreleased: { color: "#F59E0B" },

  previewBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    borderWidth: 1,
  },
  borderName: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  borderId: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
    marginTop: 1,
  },
  urlStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
  },
  urlStatusHas: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  urlStatusMissing: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  urlStatusText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    flex: 1,
  },
  specRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  specText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
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
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  editBorderBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  editBorderBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  copyUrlBtn: {
    padding: 7,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  deleteBorderBtn: {
    padding: 7,
    borderRadius: 7,
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  topFilterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    flexWrap: "wrap",
    gap: 8,
  },
  filterSectionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  addNewBorderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  addNewBorderBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },

  // ── Modal
  modalBackdrop: {
    flexGrow: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#0D1117",
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignSelf: "center",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  modalPreviewName: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  modalPreviewHint: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
    marginTop: 2,
    lineHeight: 14,
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
  fieldErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  fieldErrorText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#F43F5E",
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
  rowTwoCols: {
    flexDirection: "row",
    gap: 10,
  },
  stepInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 0,
  },
  stepBtn: {
    width: 28,
    height: 36,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  resetDefaultBtn: {
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
  resetDefaultText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    flexWrap: "wrap",
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
    marginTop: 4,
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 320,
  },
  resetFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  resetFilterBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },

  // ── Modal Konfirmasi Hapus (Silver Liquid Glass)
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  deleteModalCard: {
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.20)",
    borderRadius: 16,
    padding: 22,
    maxWidth: 480,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  deleteModalHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  deleteIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(244, 63, 94, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  deleteModalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  deleteModalDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
  },
  deletePreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 14,
  },
  deletePreviewMeta: {
    flex: 1,
  },
  deletePreviewName: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#F8FAFC",
  },
  deletePreviewId: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  deletePreviewRarity: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#F43F5E",
    marginTop: 2,
  },
  deletePreviewWarning: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#EF4444",
    marginTop: 4,
    lineHeight: 14,
  },
  deleteModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  deleteCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteCancelBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },
  deleteConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#E11D48",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.6)",
    justifyContent: "center",
  },
  deleteConfirmBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  // ── Toast Notification
  toastContainer: {
    position: "absolute",
    bottom: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  toastSuccess: {
    backgroundColor: "#065F46",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  toastError: {
    backgroundColor: "#881337",
    borderWidth: 1,
    borderColor: "#F43F5E",
  },
  toastText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
});
