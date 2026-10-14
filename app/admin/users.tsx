import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  type AdminUser,
  type AdminUserListItem,
  getAdminUsersList,
  adminAdjustUserBalance,
  adminResetUserCooldown,
} from "@/lib/admin-service";

export default function AdminUsersScreen() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);

  // Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Cooldown Modal
  const [showCooldownModal, setShowCooldownModal] = useState(false);
  const [cooldownType, setCooldownType] = useState<"name" | "avatar" | "banner">("avatar");
  const [cooldownReason, setCooldownReason] = useState("");

  const mockAdmin: AdminUser = {
    id: "admin-super",
    email: "superadmin@nuenime.com",
    username: "Super Admin",
    role: "super_admin",
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await getAdminUsersList(searchQuery);
      setUsers(list);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [searchQuery]);

  const handleAdjustBalance = async () => {
    if (!selectedUser) return;
    const amountNum = parseInt(adjustAmount, 10);
    if (isNaN(amountNum) || amountNum === 0) {
      Alert.alert("Input Salah", "Masukkan jumlah saldo yang valid (positif atau negatif).");
      return;
    }
    if (!adjustReason.trim()) {
      Alert.alert("Alasan Wajib", "Alasan penyesuaian saldo wajib diisi.");
      return;
    }

    setAdjusting(true);
    const res = await adminAdjustUserBalance({
      userId: selectedUser.id,
      amount: amountNum,
      reason: adjustReason.trim(),
      admin: mockAdmin,
    });
    setAdjusting(false);

    if (res.success) {
      hapticSuccess();
      Alert.alert(
        "Penyesuaian Berhasil",
        `Saldo ${selectedUser.username} diperbarui dari ${res.before} menjadi ${res.after} Crystal.`
      );
      setShowAdjustModal(false);
      setAdjustAmount("");
      setAdjustReason("");
      setSelectedUser(null);
      loadData();
    } else {
      hapticWarning();
      Alert.alert("Gagal", res.error || "Gagal menyesuaikan saldo.");
    }
  };

  const handleResetCooldown = async () => {
    if (!selectedUser) return;
    if (!cooldownReason.trim()) {
      Alert.alert("Alasan Wajib", "Harap masukkan alasan reset cooldown.");
      return;
    }

    const res = await adminResetUserCooldown({
      userId: selectedUser.id,
      type: cooldownType,
      reason: cooldownReason.trim(),
      admin: mockAdmin,
    });

    if (res.success) {
      hapticSuccess();
      Alert.alert(
        "Reset Berhasil",
        `Cooldown ${cooldownType.toUpperCase()} untuk ${selectedUser.username} telah di-reset.`
      );
      setShowCooldownModal(false);
      setCooldownReason("");
      setSelectedUser(null);
    } else {
      Alert.alert("Gagal", res.error || "Gagal me-reset cooldown.");
    }
  };

  return (
    <AdminLayout
      title="User Management"
      subtitle="Kelola akun pengguna, level, penyesuaian saldo manual, dan moderasi cooldown"
    >
      <View style={styles.topControlRow}>
        <View style={styles.searchWrap}>
          <AppIcon name="magnify" size={18} color="#94A3B8" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cari email, username, atau #nomor member..."
            placeholderTextColor="#64748B"
            style={styles.searchInput}
          />
        </View>
        <Text style={styles.totalUserCount}>Total: {users.length} Akun</Text>
      </View>

      <View style={styles.cardBox}>
        {loading ? (
          <ActivityIndicator size="small" color="#8C57FF" style={{ padding: 20 }} />
        ) : users.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Tidak ditemukan pengguna.</Text>
          </View>
        ) : (
          <View style={styles.tableWrap}>
            <View style={styles.thRow}>
              <Text style={[styles.th, { flex: 1.2 }]}>MEMBER</Text>
              <Text style={[styles.th, { flex: 2.2 }]}>USERNAME / EMAIL</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>SALDO CRYSTAL</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>LEVEL & EXP</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>STATUS</Text>
              <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>TINDAKAN</Text>
            </View>

            {users.map((u) => (
              <View key={u.id} style={styles.trRow}>
                <Text style={[styles.tdMember, { flex: 1.2 }]}>{u.memberNumber}</Text>
                <View style={{ flex: 2.2 }}>
                  <Text style={styles.tdBold}>{u.username}</Text>
                  <Text style={styles.tdSub}>{u.email}</Text>
                </View>
                <Text style={[styles.tdBold, { flex: 1.5, color: "#38BDF8" }]}>
                  {u.crystalBalance.toLocaleString("id-ID")} Crystal
                </Text>
                <Text style={[styles.td, { flex: 1.2 }]}>
                  Lv.{u.level} ({u.exp} XP)
                </Text>
                <View style={{ flex: 1.2 }}>
                  <View style={styles.statusPillActive}>
                    <Text style={styles.statusPillTextActive}>Aktif</Text>
                  </View>
                </View>
                <View style={[styles.actionBtnRow, { flex: 2 }]}>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setSelectedUser(u);
                      setShowAdjustModal(true);
                    }}
                    style={styles.adjustBtn}
                  >
                    <AppIcon name="plus-minus" size={13} color="#FFFFFF" />
                    <Text style={styles.adjustBtnText}>Saldo</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setSelectedUser(u);
                      setShowCooldownModal(true);
                    }}
                    style={styles.cooldownBtn}
                  >
                    <AppIcon name="clock-fast" size={13} color="#A855F7" />
                    <Text style={styles.cooldownBtnText}>Cooldown</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ─── MODAL KOREKSI SALDO (ADJUSTMENT) ─── */}
      <Modal visible={showAdjustModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Koreksi Saldo Crystal</Text>
            <Text style={styles.modalSub}>
              Pengguna: <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{selectedUser?.username}</Text>
              {"\n"}Saldo Saat Ini: {selectedUser?.crystalBalance.toLocaleString("id-ID")} Crystal
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Jumlah Penyesuaian (+/-):</Text>
              <TextInput
                value={adjustAmount}
                onChangeText={setAdjustAmount}
                placeholder="Contoh: 1500 atau -500"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Alasan Koreksi (Wajib Masuk Audit Log):</Text>
              <TextInput
                value={adjustReason}
                onChangeText={setAdjustReason}
                placeholder="Contoh: Kompensasi bug gacha / Hadiah event komunitas"
                placeholderTextColor="#64748B"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setShowAdjustModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                disabled={adjusting}
                onPress={handleAdjustBalance}
                style={styles.modalConfirmBtn}
              >
                <Text style={styles.modalConfirmText}>
                  {adjusting ? "Menyimpan..." : "Terapkan Perubahan"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL RESET COOLDOWN ─── */}
      <Modal visible={showCooldownModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset Cooldown Profil</Text>
            <Text style={styles.modalSub}>
              Pengguna: <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{selectedUser?.username}</Text>
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Pilih Jenis Cooldown:</Text>
              <View style={styles.cooldownTypeRow}>
                {(["avatar", "name", "banner"] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setCooldownType(t)}
                    style={[
                      styles.cooldownTypeChip,
                      cooldownType === t && styles.cooldownTypeChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cooldownTypeText,
                        cooldownType === t && styles.cooldownTypeTextActive,
                      ]}
                    >
                      {t === "avatar" ? "Avatar (7d)" : t === "name" ? "Nama (30d)" : "Banner (7d)"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Alasan Reset (Wajib):</Text>
              <TextInput
                value={cooldownReason}
                onChangeText={setCooldownReason}
                placeholder="Contoh: Permintaan bantuan user salah upload foto"
                placeholderTextColor="#64748B"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setShowCooldownModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable onPress={handleResetCooldown} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>Reset Cooldown</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  topControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  searchWrap: {
    flex: 1,
    maxWidth: 400,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#211D36",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#FFFFFF",
  },
  totalUserCount: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  cardBox: {
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  tableWrap: {
    gap: 2,
  },
  thRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 6,
  },
  th: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  trRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  td: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
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
    color: "#94A3B8",
  },
  tdMember: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
    color: "#38BDF8",
  },
  statusPillActive: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusPillTextActive: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#10B981",
  },
  actionBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
  },
  adjustBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#2563EB",
  },
  adjustBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#FFFFFF",
  },
  cooldownBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(168, 85, 247, 0.15)",
  },
  cooldownBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#A855F7",
  },
  emptyWrap: {
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#211D36",
    borderRadius: 14,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  modalSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 18,
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
    paddingVertical: 8,
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#FFFFFF",
  },
  cooldownTypeRow: {
    flexDirection: "row",
    gap: 8,
  },
  cooldownTypeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
  },
  cooldownTypeChipActive: {
    backgroundColor: "#8C57FF",
  },
  cooldownTypeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  cooldownTypeTextActive: {
    color: "#FFFFFF",
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  modalCancelText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  modalConfirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#8C57FF",
  },
  modalConfirmText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
});
