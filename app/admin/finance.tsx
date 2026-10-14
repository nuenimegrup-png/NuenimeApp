import React, { useEffect, useState } from "react";
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
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import { Image } from "expo-image";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  type TopUpTransaction,
  type TopUpStatus,
  type AdminUser,
  type PaymentGatewaysConfig,
  type CrystalPackage,
  getAllTransactionsForAdmin,
  adminApproveTransaction,
  adminRejectTransaction,
  adminReverseTransaction,
  getCrystalBalance,
  getPaymentGatewaysConfig,
  savePaymentGatewaysConfig,
  getAdminCrystalPackages,
  saveAdminCrystalPackages,
  formatRupiah,
  formatCrystalAmount,
} from "@/lib/admin-service";

export default function AdminFinanceScreen() {
  const [activeTab, setActiveTab] = useState<"queue" | "gateways" | "packages" | "reports">("queue");
  const [loading, setLoading] = useState(true);

  // Transactions queue
  const [transactions, setTransactions] = useState<TopUpTransaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<TopUpTransaction | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const [reverseLoading, setReverseLoading] = useState(false);
  const [userBalForReverse, setUserBalForReverse] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<TopUpStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Gateway config
  const [gatewayConfig, setGatewayConfig] = useState<PaymentGatewaysConfig | null>(null);
  const [gatewaySaving, setGatewaySaving] = useState(false);

  // Crystal packages
  const [packages, setPackages] = useState<CrystalPackage[]>([]);
  const [editingPkg, setEditingPkg] = useState<CrystalPackage | null>(null);
  const [showPkgModal, setShowPkgModal] = useState(false);

  const mockAdmin: AdminUser = {
    id: "admin-super",
    email: "finance@nuenime.com",
    username: "Finance Admin",
    role: "finance_admin",
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const txs = await getAllTransactionsForAdmin({
        status: filterStatus,
        search: searchQuery,
      });
      setTransactions(txs);

      const gw = await getPaymentGatewaysConfig();
      setGatewayConfig(gw);

      const pkgs = await getAdminCrystalPackages();
      setPackages(pkgs);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [filterStatus, searchQuery]);

  // Handle Approve
  const handleApprove = async (tx: TopUpTransaction) => {
    hapticLight();
    const res = await adminApproveTransaction({
      transactionId: tx.id,
      admin: mockAdmin,
    });

    if (res.success && res.transaction) {
      hapticSuccess();
      Alert.alert(
        "Persetujuan Berhasil! 🎉",
        `Transaksi ${tx.id} telah disetujui. Saldo ${tx.crystalAmount} Dylan Crystal berhasil ditambahkan ke akun ${tx.username}.`
      );
      setSelectedTx(null);
      loadData();
    } else {
      hapticWarning();
      Alert.alert("Gagal Menyetujui", res.error || "Terjadi kendala.");
    }
  };

  // Handle Reject
  const handleConfirmReject = async () => {
    if (!selectedTx) return;
    if (!rejectReason.trim()) {
      Alert.alert("Alasan Wajib", "Harap masukkan alasan penolakan transaksi.");
      return;
    }

    hapticLight();
    const res = await adminRejectTransaction({
      transactionId: selectedTx.id,
      reason: rejectReason.trim(),
      admin: mockAdmin,
    });

    if (res.success && res.transaction) {
      hapticWarning();
      Alert.alert("Transaksi Ditolak", `Transaksi ${selectedTx.id} telah ditandai ditolak.`);
      setShowRejectModal(false);
      setSelectedTx(null);
      setRejectReason("");
      loadData();
    } else {
      Alert.alert("Gagal Menolak", res.error || "Terjadi kendala.");
    }
  };

  // Handle Open Detail Modal
  const handleOpenDetail = (tx: TopUpTransaction) => {
    hapticLight();
    setSelectedTx(tx);
    setShowDetailModal(true);
  };

  // Handle Open Reversal Modal
  const handleOpenReverse = async (tx: TopUpTransaction) => {
    hapticLight();
    setSelectedTx(tx);
    setReverseReason("");
    setUserBalForReverse(null);
    setShowReverseModal(true);
    try {
      const bal = await getCrystalBalance(tx.userId);
      setUserBalForReverse(bal);
    } catch {
      setUserBalForReverse(0);
    }
  };

  // Handle Confirm Reversal
  const handleConfirmReverse = async () => {
    if (!selectedTx) return;
    if (!reverseReason.trim()) {
      Alert.alert("Alasan Wajib", "Harap masukkan alasan penarikan kembali (reversal) Crystal.");
      return;
    }

    if (userBalForReverse !== null && userBalForReverse < selectedTx.crystalAmount) {
      Alert.alert(
        "Saldo Tidak Mencukupi",
        `Saldo akun saat ini (${userBalForReverse.toLocaleString(
          "id-ID"
        )} Crystal) lebih kecil daripada jumlah yang ingin ditarik (${selectedTx.crystalAmount.toLocaleString(
          "id-ID"
        )} Dylan Crystal). Penarikan dibatalkan agar saldo tidak menjadi negatif.`
      );
      return;
    }

    setReverseLoading(true);
    hapticLight();
    const res = await adminReverseTransaction({
      transactionId: selectedTx.id,
      reason: reverseReason.trim(),
      admin: mockAdmin,
    });
    setReverseLoading(false);

    if (res.success && res.transaction) {
      hapticSuccess();
      Alert.alert(
        "Penarikan Crystal Berhasil 🎉",
        `Sebanyak ${selectedTx.crystalAmount.toLocaleString(
          "id-ID"
        )} Dylan Crystal berhasil ditarik kembali dari akun ${selectedTx.username}. Saldo pengguna sekarang: ${
          res.newBalance !== undefined ? res.newBalance.toLocaleString("id-ID") : "-"
        } Crystal.`
      );
      setShowReverseModal(false);
      setSelectedTx(null);
      setReverseReason("");
      loadData();
    } else {
      hapticWarning();
      Alert.alert("Gagal Melakukan Penarikan", res.error || "Terjadi kendala saat memproses penarikan.");
    }
  };

  // Handle Save Gateway Config
  const handleSaveGateways = async () => {
    if (!gatewayConfig) return;
    setGatewaySaving(true);
    await savePaymentGatewaysConfig(gatewayConfig, mockAdmin);
    setGatewaySaving(false);
    hapticSuccess();
    Alert.alert("Tersimpan", "Konfigurasi metode pembayaran berhasil diperbarui.");
  };

  // Handle Save Package
  const handleSavePackage = async () => {
    if (!editingPkg) return;
    let list = [...packages];
    const idx = list.findIndex((p) => p.id === editingPkg.id);
    if (idx !== -1) {
      list[idx] = editingPkg;
    } else {
      list.push(editingPkg);
    }
    setPackages(list);
    await saveAdminCrystalPackages(list, mockAdmin);
    setShowPkgModal(false);
    setEditingPkg(null);
    hapticSuccess();
  };

  // CSV Export
  const handleExportCSV = () => {
    hapticSuccess();
    const headers = "ID Transaksi,Username,Paket,Crystal,Total Bayar,Metode,Status,Tanggal\n";
    const rows = transactions
      .map(
        (t) =>
          `"${t.id}","${t.username}","${t.packageName}",${t.crystalAmount},${t.totalPayment},"${t.paymentMethod}","${t.status}","${t.createdAt}"`
      )
      .join("\n");
    const csvContent = headers + rows;

    if (Platform.OS === "web") {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Laporan-TopUp-Nuenime-${Date.now()}.csv`;
      a.click();
    } else {
      Alert.alert("Ekspor CSV", "Data transaksi berhasil diekspor ke format CSV.");
    }
  };

  return (
    <AdminLayout
      title="Finance & Top Up Crystal"
      subtitle="Kelola verifikasi transaksi, pembayaran, paket Crystal, dan rekap keuangan"
    >
      {/* ─── SUB TABS NAVIGATION ─── */}
      <View style={styles.tabNavRow}>
        {[
          { key: "queue", label: "Antrean Verifikasi", icon: "clipboard-check-outline" },
          { key: "gateways", label: "Konfigurasi Gateway", icon: "cog-outline" },
          { key: "packages", label: "Paket Crystal", icon: "package-variant" },
          { key: "reports", label: "Laporan & Omset", icon: "file-chart-outline" },
        ].map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => {
              hapticLight();
              setActiveTab(tab.key as any);
            }}
            style={[styles.tabNavBtn, activeTab === tab.key && styles.tabNavBtnActive]}
          >
            <AppIcon
              name={tab.icon}
              size={16}
              color={activeTab === tab.key ? "#FFFFFF" : "#94A3B8"}
            />
            <Text
              style={[
                styles.tabNavBtnText,
                activeTab === tab.key && styles.tabNavBtnTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ══════════════════════════════════════════════════════
          TAB 1: ANTREAN TRANSAKSI (VERIFIKASI TOP UP)
         ══════════════════════════════════════════════════════ */}
      {activeTab === "queue" && (
        <View style={styles.tabContentWrap}>
          {/* Filter Bar */}
          <View style={styles.filterBar}>
            <View style={styles.searchInputWrap}>
              <AppIcon name="magnify" size={18} color="#94A3B8" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Cari ID transaksi atau username..."
                placeholderTextColor="#64748B"
                style={styles.searchInput}
              />
            </View>

            <View style={styles.filterChipRow}>
              {[
                { key: "all", label: "Semua" },
                { key: "menunggu_verifikasi", label: "Pending Verifikasi" },
                { key: "berhasil", label: "Berhasil" },
                { key: "ditolak", label: "Ditolak" },
                { key: "reversed", label: "Ditarik (Reversed)" },
              ].map((f) => (
                <Pressable
                  key={f.key}
                  onPress={() => {
                    hapticLight();
                    setFilterStatus(f.key as any);
                  }}
                  style={[
                    styles.filterChip,
                    filterStatus === f.key && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filterStatus === f.key && styles.filterChipTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Tabel Transaksi */}
          <View style={styles.cardBox}>
            <View style={styles.cardBoxHeader}>
              <Text style={styles.cardBoxTitle}>
                Daftar Transaksi ({transactions.length})
              </Text>
              <Pressable onPress={handleExportCSV} style={styles.exportBtn}>
                <AppIcon name="file-download-outline" size={15} color="#10B981" />
                <Text style={styles.exportBtnText}>Ekspor CSV</Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator size="small" color="#8C57FF" style={{ padding: 20 }} />
            ) : transactions.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>Tidak ada transaksi yang cocok.</Text>
              </View>
            ) : (
              <View style={styles.tableWrap}>
                <View style={styles.thRow}>
                  <Text style={[styles.th, { flex: 1.8 }]}>ID PESANAN</Text>
                  <Text style={[styles.th, { flex: 1.6 }]}>PENGGUNA</Text>
                  <Text style={[styles.th, { flex: 1.6 }]}>PAKET</Text>
                  <Text style={[styles.th, { flex: 1.2 }]}>METODE</Text>
                  <Text style={[styles.th, { flex: 1.4 }]}>TOTAL</Text>
                  <Text style={[styles.th, { flex: 1.4 }]}>STATUS</Text>
                  <Text style={[styles.th, { flex: 2.4, textAlign: "right" }]}>AKSI</Text>
                </View>

                {transactions.map((tx) => (
                  <View key={tx.id} style={styles.trRow}>
                    <Text style={[styles.tdBold, { flex: 1.8 }]} numberOfLines={1}>
                      {tx.id}
                    </Text>
                    <Text style={[styles.td, { flex: 1.6 }]} numberOfLines={1}>
                      {tx.username}
                    </Text>
                    <Text style={[styles.td, { flex: 1.6 }]} numberOfLines={1}>
                      {tx.crystalAmount.toLocaleString("id-ID")} Crystal
                    </Text>
                    <Text style={[styles.td, { flex: 1.2 }]}>
                      {tx.paymentMethod.toUpperCase()}
                    </Text>
                    <Text style={[styles.tdBold, { flex: 1.4, color: "#38BDF8" }]}>
                      Rp{tx.totalPayment.toLocaleString("id-ID")}
                    </Text>
                    <View style={{ flex: 1.4 }}>
                      <View
                        style={[
                          styles.statusBadge,
                          tx.status === "berhasil"
                            ? styles.bgSuccess
                            : tx.status === "ditolak"
                            ? styles.bgDanger
                            : tx.status === "reversed"
                            ? styles.bgReversed
                            : styles.bgWarning,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            tx.status === "berhasil"
                              ? styles.textSuccess
                              : tx.status === "ditolak"
                              ? styles.textDanger
                              : tx.status === "reversed"
                              ? styles.textReversed
                              : styles.textWarning,
                          ]}
                          numberOfLines={1}
                        >
                          {tx.status === "berhasil"
                            ? "Berhasil"
                            : tx.status === "ditolak"
                            ? "Ditolak"
                            : tx.status === "reversed"
                            ? "Ditarik"
                            : "Menunggu"}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.actionBtnGroup, { flex: 2.4, justifyContent: "flex-end" }]}>
                      {/* Tombol Detail selalu tampil */}
                      <Pressable
                        onPress={() => handleOpenDetail(tx)}
                        style={[styles.smallBtn, styles.btnDetail]}
                      >
                        <AppIcon name="information-outline" size={12} color="#38BDF8" />
                        <Text style={[styles.smallBtnText, { color: "#38BDF8" }]}>Detail</Text>
                      </Pressable>

                      {/* Status Pending: Tombol Setujui & Tolak */}
                      {(tx.status === "menunggu_verifikasi" || tx.status === "menunggu_konfirmasi") && (
                        <>
                          <Pressable
                            onPress={() => handleApprove(tx)}
                            style={[styles.smallBtn, styles.btnApprove]}
                          >
                            <AppIcon name="check" size={12} color="#FFFFFF" />
                            <Text style={styles.smallBtnText}>Setujui</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              setSelectedTx(tx);
                              setRejectReason("");
                              setShowRejectModal(true);
                            }}
                            style={[styles.smallBtn, styles.btnReject]}
                          >
                            <AppIcon name="close" size={12} color="#FFFFFF" />
                            <Text style={styles.smallBtnText}>Tolak</Text>
                          </Pressable>
                        </>
                      )}

                      {/* Status Berhasil (Approved): Tombol Tarik Kembali Crystal */}
                      {tx.status === "berhasil" && (
                        <Pressable
                          onPress={() => handleOpenReverse(tx)}
                          style={[styles.smallBtn, styles.btnReverse]}
                        >
                          <AppIcon name="history" size={12} color="#FFFFFF" />
                          <Text style={styles.smallBtnText}>Tarik Kembali</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 2: KONFIGURASI GATEWAY PEMBAYARAN
         ══════════════════════════════════════════════════════ */}
      {activeTab === "gateways" && gatewayConfig && (
        <View style={styles.cardBox}>
          <Text style={styles.cardBoxTitle}>Konfigurasi Akun & Metode Pembayaran</Text>
          <Text style={styles.cardBoxSubtitle}>
            Pengaturan ini langsung tersinkronisasi ke aplikasi tanpa mengharuskan pengguna
            membangun ulang (rebuild) file APK.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Nomor WhatsApp Admin (Verifikasi):</Text>
            <TextInput
              value={gatewayConfig.adminWhatsapp}
              onChangeText={(t) => setGatewayConfig({ ...gatewayConfig, adminWhatsapp: t })}
              placeholder="Contoh: 628xxxxxxxxxx"
              placeholderTextColor="#64748B"
              style={styles.fieldInput}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>URL Gambar Kode QRIS Resmi:</Text>
            <TextInput
              value={gatewayConfig.qrisUrl}
              onChangeText={(t) => setGatewayConfig({ ...gatewayConfig, qrisUrl: t })}
              placeholder="https://.../qris-resmi.png"
              placeholderTextColor="#64748B"
              style={styles.fieldInput}
            />
            {/* Preview QRIS jika URL valid */}
            {gatewayConfig.qrisUrl?.startsWith("http") ? (
              <View style={styles.qrisPreviewBox}>
                <Text style={styles.qrisPreviewLabel}>Preview QRIS:</Text>
                <Image
                  source={{ uri: gatewayConfig.qrisUrl }}
                  style={styles.qrisPreviewImage}
                  contentFit="contain"
                />
              </View>
            ) : null}
          </View>

          <View style={styles.formDivider} />

          <Text style={styles.subSectionTitle}>Nomor & Nama Tujuan E-Wallet:</Text>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Nomor ShopeePay:</Text>
            <TextInput
              value={gatewayConfig.shopeepayNumber}
              onChangeText={(t) => setGatewayConfig({ ...gatewayConfig, shopeepayNumber: t })}
              placeholder="Nomor akun ShopeePay"
              placeholderTextColor="#64748B"
              style={styles.fieldInput}
            />
            <TextInput
              value={gatewayConfig.shopeepayName}
              onChangeText={(t) => setGatewayConfig({ ...gatewayConfig, shopeepayName: t })}
              placeholder="Nama pemilik ShopeePay"
              placeholderTextColor="#64748B"
              style={[styles.fieldInput, { marginTop: 6 }]}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Nomor GoPay:</Text>
            <TextInput
              value={gatewayConfig.gopayNumber}
              onChangeText={(t) => setGatewayConfig({ ...gatewayConfig, gopayNumber: t })}
              placeholder="Nomor akun GoPay"
              placeholderTextColor="#64748B"
              style={styles.fieldInput}
            />
            <TextInput
              value={gatewayConfig.gopayName}
              onChangeText={(t) => setGatewayConfig({ ...gatewayConfig, gopayName: t })}
              placeholder="Nama pemilik GoPay"
              placeholderTextColor="#64748B"
              style={[styles.fieldInput, { marginTop: 6 }]}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Nomor DANA:</Text>
            <TextInput
              value={gatewayConfig.danaNumber}
              onChangeText={(t) => setGatewayConfig({ ...gatewayConfig, danaNumber: t })}
              placeholder="Nomor akun DANA"
              placeholderTextColor="#64748B"
              style={styles.fieldInput}
            />
            <TextInput
              value={gatewayConfig.danaName}
              onChangeText={(t) => setGatewayConfig({ ...gatewayConfig, danaName: t })}
              placeholder="Nama pemilik DANA"
              placeholderTextColor="#64748B"
              style={[styles.fieldInput, { marginTop: 6 }]}
            />
          </View>

          <Pressable
            disabled={gatewaySaving}
            onPress={handleSaveGateways}
            style={[styles.saveBtn, gatewaySaving && { opacity: 0.6 }]}
          >
            <AppIcon name="content-save-outline" size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>
              {gatewaySaving ? "Menyimpan..." : "Simpan Konfigurasi"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 3: PAKET CRYSTAL CRUD
         ══════════════════════════════════════════════════════ */}
      {activeTab === "packages" && (
        <View style={styles.cardBox}>
          <View style={styles.cardBoxHeader}>
            <Text style={styles.cardBoxTitle}>Katalog Paket Dylan Crystal</Text>
            <Pressable
              onPress={() => {
                setEditingPkg({
                  id: `pkg_${Date.now()}`,
                  name: "Paket Baru",
                  amount: 2000,
                  amountFormatted: "2.000",
                  price: 2000,
                  priceFormatted: "Rp2.000",
                });
                setShowPkgModal(true);
              }}
              style={styles.addBtn}
            >
              <AppIcon name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Tambah Paket</Text>
            </Pressable>
          </View>

          <View style={styles.packageList}>
            {packages.map((pkg) => (
              <View key={pkg.id} style={styles.packageRow}>
                <View>
                  <Text style={styles.packageName}>{pkg.name}</Text>
                  <Text style={styles.packageAmount}>{pkg.amountFormatted} Crystal</Text>
                </View>
                <Text style={styles.packagePrice}>{pkg.priceFormatted}</Text>
                <Pressable
                  onPress={() => {
                    setEditingPkg({ ...pkg });
                    setShowPkgModal(true);
                  }}
                  style={styles.editBtn}
                >
                  <AppIcon name="pencil" size={14} color="#8C57FF" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 4: LAPORAN & OMSET
         ══════════════════════════════════════════════════════ */}
      {activeTab === "reports" && (
        <View style={styles.cardBox}>
          <Text style={styles.cardBoxTitle}>Laporan Omset & Rekap Keuangan</Text>
          <View style={styles.reportSummaryGrid}>
            <View style={styles.reportBox}>
              <Text style={styles.reportBoxLabel}>Total Transaksi Berhasil</Text>
              <Text style={styles.reportBoxVal}>
                {transactions.filter((t) => t.status === "berhasil").length}
              </Text>
            </View>
            <View style={styles.reportBox}>
              <Text style={styles.reportBoxLabel}>Total Pemasukan Sah</Text>
              <Text style={[styles.reportBoxVal, { color: "#10B981" }]}>
                Rp
                {transactions
                  .filter((t) => t.status === "berhasil")
                  .reduce((acc, t) => acc + t.totalPayment, 0)
                  .toLocaleString("id-ID")}
              </Text>
            </View>
          </View>
          <Pressable onPress={handleExportCSV} style={styles.downloadReportBtn}>
            <AppIcon name="download" size={18} color="#FFFFFF" />
            <Text style={styles.downloadReportBtnText}>Unduh Rekap Lengkap (CSV)</Text>
          </Pressable>
        </View>
      )}

      {/* ─── MODAL TOLAK DENGAN ALASAN WAJIB ─── */}
      <Modal visible={showRejectModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tolak Transaksi {selectedTx?.id}</Text>
            <Text style={styles.modalSub}>
              Masukkan alasan penolakan secara jelas. Status akan diperbarui dan saldo Crystal
              TIDAK akan ditambahkan.
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Contoh: Bukti transfer buram / nominal tidak sesuai"
              placeholderTextColor="#64748B"
              style={[styles.fieldInput, { height: 80, textAlignVertical: "top" }]}
              multiline
            />
            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setShowRejectModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable onPress={handleConfirmReject} style={styles.modalRejectBtn}>
                <Text style={styles.modalRejectText}>Tolak Transaksi</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL EDIT PAKET CRYSTAL ─── */}
      <Modal visible={showPkgModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Paket Crystal</Text>
            {editingPkg && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Nama Paket:</Text>
                  <TextInput
                    value={editingPkg.name}
                    onChangeText={(t) => setEditingPkg({ ...editingPkg, name: t })}
                    style={styles.fieldInput}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Jumlah Crystal:</Text>
                  <TextInput
                    value={String(editingPkg.amount)}
                    keyboardType="numeric"
                    onChangeText={(t) => {
                      const num = parseInt(t, 10) || 0;
                      setEditingPkg({
                        ...editingPkg,
                        amount: num,
                        amountFormatted: formatCrystalAmount(num),
                      });
                    }}
                    style={styles.fieldInput}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Harga (Rp):</Text>
                  <TextInput
                    value={String(editingPkg.price)}
                    keyboardType="numeric"
                    onChangeText={(t) => {
                      const num = parseInt(t, 10) || 0;
                      setEditingPkg({
                        ...editingPkg,
                        price: num,
                        priceFormatted: formatRupiah(num),
                      });
                    }}
                    style={styles.fieldInput}
                  />
                </View>
              </>
            )}
            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setShowPkgModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable onPress={handleSavePackage} style={styles.modalSaveBtn}>
                <Text style={styles.modalSaveText}>Simpan Paket</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL DETAIL TRANSAKSI ─── */}
      <Modal visible={showDetailModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Detail Transaksi Top Up</Text>
            {selectedTx && (
              <View style={styles.detailGrid}>
                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>ID Transaksi:</Text>
                  <Text style={styles.detailItemValBold}>{selectedTx.id}</Text>
                </View>
                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>Pengguna:</Text>
                  <Text style={styles.detailItemVal}>
                    {selectedTx.username} ({selectedTx.userId})
                  </Text>
                </View>
                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>Paket Crystal:</Text>
                  <Text style={styles.detailItemVal}>
                    {selectedTx.packageName} ({selectedTx.crystalAmount.toLocaleString("id-ID")} Crystal)
                  </Text>
                </View>
                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>Metode Pembayaran:</Text>
                  <Text style={styles.detailItemVal}>
                    {selectedTx.paymentMethod.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>Total Bayar:</Text>
                  <Text style={styles.detailItemValHighlight}>
                    Rp{selectedTx.totalPayment.toLocaleString("id-ID")}
                  </Text>
                </View>
                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>Status:</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      selectedTx.status === "berhasil"
                        ? styles.bgSuccess
                        : selectedTx.status === "ditolak"
                        ? styles.bgDanger
                        : selectedTx.status === "reversed"
                        ? styles.bgReversed
                        : styles.bgWarning,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        selectedTx.status === "berhasil"
                          ? styles.textSuccess
                          : selectedTx.status === "ditolak"
                          ? styles.textDanger
                          : selectedTx.status === "reversed"
                          ? styles.textReversed
                          : styles.textWarning,
                      ]}
                    >
                      {selectedTx.status === "berhasil"
                        ? "Berhasil (Disetujui)"
                        : selectedTx.status === "ditolak"
                        ? "Ditolak"
                        : selectedTx.status === "reversed"
                        ? "Ditarik (Reversed)"
                        : "Menunggu Verifikasi"}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>Crystal Diberikan:</Text>
                  <Text
                    style={[
                      styles.detailItemVal,
                      { color: selectedTx.crystalsGranted ? "#10B981" : "#F59E0B" },
                    ]}
                  >
                    {selectedTx.crystalsGranted ? "Ya (Saldo Masuk)" : "Tidak (Belum Masuk)"}
                  </Text>
                </View>
                {selectedTx.statusNote ? (
                  <View style={{ gap: 4, marginTop: 4 }}>
                    <Text style={styles.detailItemLabel}>Catatan / Alasan:</Text>
                    <Text style={styles.detailNoteText}>{selectedTx.statusNote}</Text>
                  </View>
                ) : null}
                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>Dibuat Pada:</Text>
                  <Text style={styles.detailItemValMuted}>
                    {new Date(selectedTx.createdAt).toLocaleString("id-ID")}
                  </Text>
                </View>
                {selectedTx.verifiedAt && (
                  <View style={styles.detailItemRow}>
                    <Text style={styles.detailItemLabel}>Diverifikasi Pada:</Text>
                    <Text style={styles.detailItemValMuted}>
                      {new Date(selectedTx.verifiedAt).toLocaleString("id-ID")}
                    </Text>
                  </View>
                )}
              </View>
            )}
            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setShowDetailModal(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseBtnText}>Tutup</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL TARIK KEMBALI CRYSTAL (REVERSAL) ─── */}
      <Modal visible={showReverseModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: "#F97316" }]}>
              Konfirmasi Tarik Kembali Dylan Crystal
            </Text>
            <Text style={styles.modalSub}>
              Aksi koreksi ini akan mengurangi saldo Crystal pengguna sesuai jumlah transaksi ini secara atomik. Riwayat transaksi tidak akan dihapus.
            </Text>

            {selectedTx && (
              <View style={styles.detailGrid}>
                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>ID Transaksi:</Text>
                  <Text style={styles.detailItemValBold}>{selectedTx.id}</Text>
                </View>
                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>Pengguna:</Text>
                  <Text style={styles.detailItemVal}>
                    {selectedTx.username} ({selectedTx.userId})
                  </Text>
                </View>
                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>Crystal yang Ditarik:</Text>
                  <Text style={[styles.detailItemValBold, { color: "#F97316" }]}>
                    -{selectedTx.crystalAmount.toLocaleString("id-ID")} Dylan Crystal
                  </Text>
                </View>
                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>Saldo Pengguna Saat Ini:</Text>
                  <Text style={[styles.detailItemValBold, { color: "#38BDF8" }]}>
                    {userBalForReverse !== null
                      ? `${userBalForReverse.toLocaleString("id-ID")} Crystal`
                      : "Memeriksa saldo..."}
                  </Text>
                </View>
              </View>
            )}

            {/* Peringatan Saldo Tidak Mencukupi (Mencegah Saldo Negatif) */}
            {userBalForReverse !== null &&
              selectedTx &&
              userBalForReverse < selectedTx.crystalAmount && (
                <View style={styles.reversalWarningBox}>
                  <AppIcon name="alert-circle" size={18} color="#EF4444" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.reversalWarningTitle}>
                      Saldo Pengguna Tidak Mencukupi!
                    </Text>
                    <Text style={styles.reversalWarningText}>
                      Saldo saat ini ({userBalForReverse.toLocaleString("id-ID")} Crystal) lebih kecil daripada nominal transaksi ({selectedTx.crystalAmount.toLocaleString("id-ID")} Crystal). Penarikan dicegah agar saldo tidak menjadi negatif.
                    </Text>
                  </View>
                </View>
              )}

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Alasan Penarikan Kembali (Wajib Diisi):</Text>
              <TextInput
                value={reverseReason}
                onChangeText={setReverseReason}
                placeholder="Contoh: Pembayaran di-chargeback / koreksi transaksi keliru oleh admin"
                placeholderTextColor="#64748B"
                style={[styles.fieldInput, { height: 75, textAlignVertical: "top" }]}
                multiline
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setShowReverseModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                disabled={
                  reverseLoading ||
                  !reverseReason.trim() ||
                  (userBalForReverse !== null &&
                    selectedTx !== null &&
                    userBalForReverse < selectedTx.crystalAmount)
                }
                onPress={handleConfirmReverse}
                style={[
                  styles.modalReverseBtn,
                  (reverseLoading ||
                    !reverseReason.trim() ||
                    (userBalForReverse !== null &&
                      selectedTx !== null &&
                      userBalForReverse < selectedTx.crystalAmount)) && {
                    opacity: 0.5,
                  },
                ]}
              >
                {reverseLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalReverseText}>Konfirmasi Tarik Kembali</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  tabNavRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  tabNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  tabNavBtnActive: {
    backgroundColor: "#8C57FF",
  },
  tabNavBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#94A3B8",
  },
  tabNavBtnTextActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },
  tabContentWrap: {
    gap: 16,
  },
  filterBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  searchInputWrap: {
    flex: 1,
    minWidth: 260,
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
  filterChipRow: {
    flexDirection: "row",
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  filterChipActive: {
    backgroundColor: "rgba(140, 87, 255, 0.25)",
    borderWidth: 1,
    borderColor: "#8C57FF",
  },
  filterChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  cardBox: {
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 14,
  },
  cardBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    marginBottom: 8,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  exportBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#10B981",
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
    fontSize: 12,
    color: "#FFFFFF",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
  },
  bgSuccess: { backgroundColor: "rgba(16, 185, 129, 0.15)" },
  textSuccess: { color: "#10B981" },
  bgWarning: { backgroundColor: "rgba(245, 158, 11, 0.15)" },
  textWarning: { color: "#F59E0B" },
  bgDanger: { backgroundColor: "rgba(239, 68, 68, 0.15)" },
  textDanger: { color: "#EF4444" },
  bgReversed: { backgroundColor: "rgba(249, 115, 22, 0.15)" },
  textReversed: { color: "#F97316" },
  actionBtnGroup: {
    flexDirection: "row",
    gap: 6,
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  btnDetail: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  btnApprove: {
    backgroundColor: "#10B981",
  },
  btnReject: {
    backgroundColor: "#EF4444",
  },
  btnReverse: {
    backgroundColor: "#F97316",
  },
  smallBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#FFFFFF",
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
  formDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 6,
  },
  subSectionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#E2E8F0",
  },
  qrisPreviewBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    alignItems: "center",
    gap: 8,
  },
  qrisPreviewLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },
  qrisPreviewImage: {
    width: 180,
    height: 180,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#8C57FF",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  saveBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#8C57FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },
  packageList: {
    gap: 8,
  },
  packageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  packageName: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  packageAmount: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },
  packagePrice: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#F1F5F9",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(140, 87, 255, 0.15)",
  },
  editBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#8C57FF",
  },
  reportSummaryGrid: {
    flexDirection: "row",
    gap: 16,
    marginVertical: 8,
  },
  reportBox: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    gap: 4,
  },
  reportBoxLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  reportBoxVal: {
    fontFamily: "Nunito-Black",
    fontSize: 20,
    color: "#FFFFFF",
  },
  downloadReportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  downloadReportBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
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
    lineHeight: 16,
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
  modalRejectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#EF4444",
  },
  modalRejectText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  modalSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#8C57FF",
  },
  modalSaveText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  detailGrid: {
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  detailItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailItemLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  detailItemVal: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#E2E8F0",
  },
  detailItemValBold: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  detailItemValHighlight: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#38BDF8",
  },
  detailItemValMuted: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  detailNoteText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#CBD5E1",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#8C57FF",
  },
  modalCloseBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: "#8C57FF",
  },
  modalCloseBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  modalReverseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#F97316",
  },
  modalReverseText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  reversalWarningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  reversalWarningTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#EF4444",
  },
  reversalWarningText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#FCA5A5",
    lineHeight: 16,
  },
});
