import React, { useCallback, useEffect, useState } from "react";
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
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import { BorderAvatar } from "@/components/border-avatar";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  type AvatarBorder,
  type BorderRarity,
  BORDER_RARITIES,
  RARITY_THEME,
} from "@/lib/avatar-borders";
import {
  type AdminUser,
  getAdminBordersCatalog,
  updateAdminBorder,
} from "@/lib/admin-service";
import { useAnirakuAuth } from "@/providers/auth-provider";

export default function AdminBordersScreen() {
  const auth = useAnirakuAuth();
  const [loading, setLoading] = useState(true);
  const [borders, setBorders] = useState<AvatarBorder[]>([]);
  const [selectedRarity, setSelectedRarity] = useState<BorderRarity | "all">("all");
  const [editingBorder, setEditingBorder] = useState<AvatarBorder | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Admin user dari auth asli ───
  const adminUser: AdminUser | null = auth.user
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
    : null;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAdminBordersCatalog();
      setBorders(list);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredBorders = borders.filter((b) => {
    if (selectedRarity !== "all" && b.rarity !== selectedRarity) return false;
    return true;
  });

  // Stats
  const releasedCount = borders.filter((b) => b.isReleased).length;
  const pendingCount = borders.length - releasedCount;

  const handleToggleReleased = async (border: AvatarBorder) => {
    if (!adminUser) {
      Alert.alert("Error", "Admin tidak terautentikasi.");
      return;
    }
    hapticLight();
    // Cegah toggle aktif jika belum ada URL
    if (!border.isReleased && !border.assetUrl) {
      hapticWarning();
      Alert.alert(
        "URL Aset Diperlukan",
        `Border ${border.name} tidak memiliki URL aset. Silakan isi URL gambar PNG transparan terlebih dahulu melalui tombol Edit Pengaturan, baru border dapat dirilis.`
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
      loadData();
    }
  };

  const handleSaveBorderDetails = async () => {
    if (!editingBorder || !adminUser) return;
    setSaving(true);

    // Validasi URL jika diisi
    const url = editingBorder.assetUrl?.trim() || null;
    if (url && !url.startsWith("http")) {
      Alert.alert("URL Tidak Valid", "URL aset harus diawali dengan https://");
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
      },
      adminUser
    );

    setSaving(false);
    if (result) {
      setEditingBorder(null);
      hapticSuccess();
      Alert.alert(
        "Tersimpan!",
        url
          ? `Border ${editingBorder.name} berhasil diperbarui dan otomatis${editingBorder.isReleased ? " dirilis" : " disembunyikan"}.`
          : `Border ${editingBorder.name} disimpan. Status: Segera Hadir (URL belum diisi).`
      );
      loadData();
    } else {
      Alert.alert("Gagal", "Terjadi kesalahan saat menyimpan. Coba lagi.");
    }
  };

  return (
    <AdminLayout
      title="Inventory & Border Avatar"
      subtitle="Kelola status rilis dan URL aset 45 border avatar"
    >
      {/* ─── STATS ROW ─── */}
      <View style={styles.statsRow}>
        <View style={[styles.statChip, styles.statChipGreen]}>
          <AppIcon name="check-circle" size={13} color="#10B981" />
          <Text style={[styles.statChipText, { color: "#10B981" }]}>
            {releasedCount} Rilis (Aktif)
          </Text>
        </View>
        <View style={[styles.statChip, styles.statChipAmber]}>
          <AppIcon name="clock-outline" size={13} color="#F59E0B" />
          <Text style={[styles.statChipText, { color: "#F59E0B" }]}>
            {pendingCount} Segera Hadir
          </Text>
        </View>
        <View style={[styles.statChip, styles.statChipBlue]}>
          <AppIcon name="palette-swatch-outline" size={13} color="#38BDF8" />
          <Text style={[styles.statChipText, { color: "#38BDF8" }]}>
            {borders.length} Total
          </Text>
        </View>
      </View>

      {/* ─── INFO BANNER ─── */}
      <View style={styles.infoBanner}>
        <AppIcon name="information-outline" size={14} color="#38BDF8" />
        <Text style={styles.infoBannerText}>
          Isi URL PNG transparan → border otomatis menjadi <Text style={styles.infoBold}>Rilis (Aktif)</Text>.
          Hapus URL → otomatis kembali ke <Text style={styles.infoBold}>Segera Hadir</Text>.
        </Text>
      </View>

      {/* ─── RARITY FILTER PILLS ─── */}
      <View style={styles.rarityFilterRow}>
        <Pressable
          onPress={() => { hapticLight(); setSelectedRarity("all"); }}
          style={[styles.rarityChip, selectedRarity === "all" && styles.rarityChipActive]}
        >
          <Text style={[styles.rarityChipText, selectedRarity === "all" && styles.rarityChipTextActive]}>
            Semua ({borders.length})
          </Text>
        </Pressable>

        {BORDER_RARITIES.map((r) => {
          const theme = RARITY_THEME[r];
          const count = borders.filter((b) => b.rarity === r).length;
          const isActive = selectedRarity === r;
          return (
            <Pressable
              key={r}
              onPress={() => { hapticLight(); setSelectedRarity(r); }}
              style={[
                styles.rarityChip,
                isActive && { backgroundColor: `${theme.color}30`, borderColor: theme.color },
              ]}
            >
              <Text style={[styles.rarityChipText, isActive && { color: theme.color, fontFamily: "Nunito-Black" }]}>
                {r} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ─── GRID KARTU BORDER AVATAR ─── */}
      {loading ? (
        <ActivityIndicator size="small" color="#8C57FF" style={{ padding: 40 }} />
      ) : (
        <View style={styles.borderGrid}>
          {filteredBorders.map((b) => {
            const theme = RARITY_THEME[b.rarity];
            const hasUrl = !!(b.assetUrl && b.assetUrl.trim().length > 0);
            return (
              <View key={b.id} style={[styles.borderCard, b.isReleased && styles.borderCardReleased]}>
                {/* Rarity & Release Badge */}
                <View style={styles.cardTopRow}>
                  <View style={[styles.rarityBadge, { backgroundColor: theme.bgBadge, borderColor: theme.borderBadge }]}>
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
                      size={9}
                      color={b.isReleased ? "#10B981" : "#F59E0B"}
                    />
                    <Text style={[styles.releasedPillText, b.isReleased ? styles.textReleased : styles.textUnreleased]}>
                      {b.isReleased ? "Rilis" : "Segera Hadir"}
                    </Text>
                  </Pressable>
                </View>

                {/* Live Preview Avatar dengan Border */}
                <View style={styles.previewBox}>
                  <BorderAvatar
                    avatarUrl="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop"
                    fallbackText="N"
                    border={b}
                    avatarSize={56}
                  />
                </View>

                {/* Info Text */}
                <Text style={styles.borderName} numberOfLines={1}>{b.name}</Text>

                {/* URL Status */}
                <View style={[styles.urlStatusRow, hasUrl ? styles.urlStatusHas : styles.urlStatusMissing]}>
                  <AppIcon name={hasUrl ? "link-variant" : "link-variant-off"} size={10} color={hasUrl ? "#10B981" : "#F59E0B"} />
                  <Text style={[styles.urlStatusText, { color: hasUrl ? "#10B981" : "#F59E0B" }]}>
                    {hasUrl ? "URL Aset Tersedia" : "Belum Ada URL — Segera Hadir"}
                  </Text>
                </View>

                <Text style={styles.borderRatioText}>
                  Rasio: {b.innerRatio ?? 0.74} | Scale: {b.scale ?? 1.0}
                </Text>

                {/* Edit Action Button */}
                <Pressable
                  onPress={() => { hapticLight(); setEditingBorder({ ...b }); }}
                  style={styles.editBorderBtn}
                >
                  <AppIcon name="pencil" size={13} color="#8C57FF" />
                  <Text style={styles.editBorderBtnText}>Edit Pengaturan</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {/* ─── MODAL EDIT PENGATURAN BORDER ─── */}
      <Modal visible={editingBorder !== null} transparent animationType="fade">
        <ScrollView contentContainerStyle={styles.modalBackdrop} keyboardShouldPersistTaps="handled">
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Border</Text>
              <Pressable onPress={() => setEditingBorder(null)} style={styles.modalCloseBtn}>
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            {editingBorder && (
              <>
                {/* Preview Live */}
                <View style={styles.modalPreviewRow}>
                  <BorderAvatar
                    avatarUrl="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop"
                    fallbackText="N"
                    border={editingBorder}
                    avatarSize={52}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalPreviewName}>{editingBorder.name}</Text>
                    <Text style={[styles.modalPreviewRarity, { color: RARITY_THEME[editingBorder.rarity].color }]}>
                      {editingBorder.rarity}
                    </Text>
                    <Text style={styles.modalPreviewHint}>
                      {editingBorder.assetUrl
                        ? "✓ URL aset tersedia → akan Rilis otomatis"
                        : "⚠ Belum ada URL → Status: Segera Hadir"}
                    </Text>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Nama Border:</Text>
                  <TextInput
                    value={editingBorder.name}
                    onChangeText={(t) => setEditingBorder({ ...editingBorder, name: t })}
                    style={styles.fieldInput}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>
                    URL Aset PNG Transparan:{" "}
                    <Text style={{ color: "#F59E0B" }}>(isi → otomatis rilis)</Text>
                  </Text>
                  <TextInput
                    value={editingBorder.assetUrl || ""}
                    onChangeText={(t) => {
                      const url = t.trim() || null;
                      setEditingBorder({
                        ...editingBorder,
                        assetUrl: url,
                        // Auto-set isReleased berdasarkan URL
                        isReleased: !!(url && url.length > 0),
                      });
                    }}
                    placeholder="https://i.ibb.co.com/.../border.png"
                    placeholderTextColor="#64748B"
                    style={styles.fieldInput}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>

                {/* Toggle rilis manual */}
                <View style={styles.toggleRow}>
                  <View>
                    <Text style={styles.fieldLabel}>Status Rilis Manual:</Text>
                    <Text style={styles.toggleHint}>
                      {editingBorder.isReleased ? "✓ Aktif di Shop pengguna" : "○ Tersembunyi (Segera Hadir)"}
                    </Text>
                  </View>
                  <Switch
                    value={editingBorder.isReleased ?? false}
                    onValueChange={(val) => setEditingBorder({ ...editingBorder, isReleased: val })}
                    trackColor={{ false: "rgba(255,255,255,0.1)", true: "rgba(16,185,129,0.5)" }}
                    thumbColor={editingBorder.isReleased ? "#10B981" : "#64748B"}
                  />
                </View>

                <View style={styles.rowTwoCols}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Inner Ratio (0.60–0.90):</Text>
                    <TextInput
                      value={String(editingBorder.innerRatio ?? 0.74)}
                      keyboardType="numeric"
                      onChangeText={(t) => setEditingBorder({ ...editingBorder, innerRatio: parseFloat(t) || 0.74 })}
                      style={styles.fieldInput}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Scale (Default 1.0):</Text>
                    <TextInput
                      value={String(editingBorder.scale ?? 1.0)}
                      keyboardType="numeric"
                      onChangeText={(t) => setEditingBorder({ ...editingBorder, scale: parseFloat(t) || 1.0 })}
                      style={styles.fieldInput}
                    />
                  </View>
                </View>

                <View style={styles.rowTwoCols}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Offset X (Horisontal):</Text>
                    <TextInput
                      value={String(editingBorder.offsetX ?? 0.0)}
                      keyboardType="numeric"
                      onChangeText={(t) => setEditingBorder({ ...editingBorder, offsetX: parseFloat(t) || 0.0 })}
                      style={styles.fieldInput}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Offset Y (Vertikal):</Text>
                    <TextInput
                      value={String(editingBorder.offsetY ?? 0.0)}
                      keyboardType="numeric"
                      onChangeText={(t) => setEditingBorder({ ...editingBorder, offsetY: parseFloat(t) || 0.0 })}
                      style={styles.fieldInput}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Deskripsi Border:</Text>
                  <TextInput
                    value={editingBorder.description || ""}
                    onChangeText={(t) => setEditingBorder({ ...editingBorder, description: t })}
                    style={[styles.fieldInput, { minHeight: 60 }]}
                    multiline
                  />
                </View>
              </>
            )}

            <View style={styles.modalActionRow}>
              <Pressable onPress={() => setEditingBorder(null)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable disabled={saving} onPress={handleSaveBorderDetails} style={styles.modalSaveBtn}>
                <Text style={styles.modalSaveText}>
                  {saving ? "Menyimpan..." : "Simpan Border"}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Modal>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statChipGreen: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  statChipAmber: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  statChipBlue: {
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  statChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  infoBannerText: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    lineHeight: 17,
  },
  infoBold: {
    fontFamily: "Nunito-Bold",
    color: "#CBD5E1",
  },
  rarityFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  rarityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  rarityChipActive: {
    backgroundColor: "rgba(140, 87, 255, 0.2)",
    borderColor: "#8C57FF",
  },
  rarityChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  rarityChipTextActive: {
    color: "#FFFFFF",
  },
  borderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  borderCard: {
    width: "48%",
    minWidth: 200,
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 8,
  },
  borderCardReleased: {
    borderColor: "rgba(16, 185, 129, 0.3)",
    backgroundColor: "#1A2430",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rarityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  rarityBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
  },
  releasedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  releasedActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  releasedInactive: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
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
    paddingVertical: 12,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 8,
  },
  borderName: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  urlStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  urlStatusHas: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  urlStatusMissing: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  urlStatusText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
  },
  borderRatioText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#38BDF8",
  },
  editBorderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(140, 87, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.3)",
    marginTop: 2,
  },
  editBorderBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#8C57FF",
  },
  // ─── Modal ───
  modalBackdrop: {
    flexGrow: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#211D36",
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  modalPreviewName: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  modalPreviewRarity: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    marginTop: 2,
  },
  modalPreviewHint: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
    marginTop: 4,
    lineHeight: 14,
  },
  formGroup: { gap: 5 },
  fieldLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  fieldInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  toggleHint: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  rowTwoCols: { flexDirection: "row", gap: 10 },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  modalCancelText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#94A3B8",
  },
  modalSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#8C57FF",
  },
  modalSaveText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
});
