import React, { useEffect, useState, useMemo } from "react";
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

// ─── HELPERS ───────────────────────────────────────────────────────────────
function formatRupiahShort(val: number): string {
  if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}M`;
  if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}Jt`;
  if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`;
  return `Rp ${val.toLocaleString("id-ID")}`;
}

type PeriodFilter = "today" | "week" | "month" | "all";

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

  // Report Period Filter
  const [reportPeriod, setReportPeriod] = useState<PeriodFilter>("month");
  const [copySuccess, setCopySuccess] = useState(false);

  const { width } = useWindowDimensions();
  const isWide = width >= 860;

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
      setTransactions((prev) =>
        prev.map((t) => (t.id === tx.id ? res.transaction! : t))
      );
      Alert.alert("Berhasil", `Transaksi ${tx.id} berhasil disetujui.`);
    } else {
      Alert.alert("Gagal", res.error || "Gagal menyetujui transaksi.");
    }
  };

  // Handle Reject
  const handleConfirmReject = async () => {
    if (!selectedTx) return;
    if (!rejectReason.trim()) {
      Alert.alert("Alasan Wajib", "Masukkan alasan penolakan secara jelas.");
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
      setTransactions((prev) =>
        prev.map((t) => (t.id === selectedTx.id ? res.transaction! : t))
      );
      setShowRejectModal(false);
      setSelectedTx(null);
      setRejectReason("");
      Alert.alert("Ditolak", `Transaksi ${selectedTx.id} telah ditolak.`);
    } else {
      Alert.alert("Gagal", res.error || "Gagal menolak transaksi.");
    }
  };

  // Handle Open Reverse Modal
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
      Alert.alert("Alasan Wajib", "Masukkan alasan penarikan kembali secara spesifik.");
      return;
    }

    setReverseLoading(true);
    try {
      const res = await adminReverseTransaction({
        transactionId: selectedTx.id,
        reason: reverseReason.trim(),
        admin: mockAdmin,
      });

      if (res.success && res.transaction) {
        hapticSuccess();
        setTransactions((prev) =>
          prev.map((t) => (t.id === selectedTx.id ? res.transaction! : t))
        );
        setShowReverseModal(false);
        setSelectedTx(null);
        setReverseReason("");
        Alert.alert(
          "Berhasil Ditarik",
          `Dylan Crystal untuk transaksi ${selectedTx.id} berhasil ditarik kembali.`
        );
      } else {
        Alert.alert("Gagal", res.error || "Gagal melakukan penarikan transaksi.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Terjadi kesalahan internal.");
    } finally {
      setReverseLoading(false);
    }
  };

  // Handle Save Gateway Config
  const handleSaveGateways = async () => {
    if (!gatewayConfig) return;
    setGatewaySaving(true);
    hapticLight();

    try {
      await savePaymentGatewaysConfig(gatewayConfig, mockAdmin);
      hapticSuccess();
      Alert.alert("Tersimpan", "Konfigurasi metode pembayaran berhasil diperbarui.");
    } catch {
      Alert.alert("Gagal", "Tidak dapat menyimpan konfigurasi pembayaran.");
    } finally {
      setGatewaySaving(false);
    }
  };

  // Handle Save Package
  const handleSavePackage = async () => {
    if (!editingPkg) return;
    hapticLight();

    const exists = packages.some((p) => p.id === editingPkg.id);
    const updated = exists
      ? packages.map((p) => (p.id === editingPkg.id ? editingPkg : p))
      : [...packages, editingPkg];

    try {
      await saveAdminCrystalPackages(updated, mockAdmin);
      hapticSuccess();
      setPackages(updated);
      setShowPkgModal(false);
      setEditingPkg(null);
      Alert.alert("Tersimpan", "Paket Crystal berhasil diperbarui.");
    } catch {
      Alert.alert("Gagal", "Tidak dapat menyimpan paket Crystal.");
    }
  };

  // Handle Open Detail Modal
  const handleOpenDetail = (tx: TopUpTransaction) => {
    hapticLight();
    setSelectedTx(tx);
    setShowDetailModal(true);
  };

  // ─── FILTERED TRANSACTIONS FOR REPORTS ─────────────────────────────────────
  const filteredReportTxs = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return transactions.filter((t) => {
      const time = new Date(t.createdAt).getTime();
      if (reportPeriod === "today") return time >= startOfToday;
      if (reportPeriod === "week") return time >= startOfWeek;
      if (reportPeriod === "month") return time >= startOfMonth;
      return true;
    });
  }, [transactions, reportPeriod]);

  // Report Metrics Computation
  const reportMetrics = useMemo(() => {
    const success = filteredReportTxs.filter((t) => t.status === "berhasil");
    const pending = filteredReportTxs.filter(
      (t) => t.status === "menunggu_verifikasi" || t.status === "menunggu_konfirmasi"
    );
    const rejected = filteredReportTxs.filter((t) => t.status === "ditolak");

    const grossRevenue = success.reduce((acc, t) => acc + t.totalPayment, 0);
    const estGatewayFee = Math.round(grossRevenue * 0.015); // 1.5% MDR
    const netRevenue = grossRevenue - estGatewayFee;
    const totalCrystals = success.reduce((acc, t) => acc + t.crystalAmount, 0);
    const aov = success.length > 0 ? Math.round(grossRevenue / success.length) : 0;
    const successRate =
      filteredReportTxs.length > 0
        ? ((success.length / filteredReportTxs.length) * 100).toFixed(1)
        : "0.0";

    // 7-day revenue trend for chart
    const dailyTrend = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const dayTxs = transactions.filter(
        (t) =>
          t.status === "berhasil" &&
          new Date(t.createdAt).getTime() >= dayStart &&
          new Date(t.createdAt).getTime() < dayEnd
      );
      const total = dayTxs.reduce((sum, t) => sum + t.totalPayment, 0);
      const label = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d.getDay()];
      const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
      return { label, dateStr, total, count: dayTxs.length };
    });

    // Payment Method Breakdown
    const pmStats: Record<string, { count: number; total: number }> = {};
    success.forEach((t) => {
      const pm = t.paymentMethod || "lainnya";
      if (!pmStats[pm]) pmStats[pm] = { count: 0, total: 0 };
      pmStats[pm].count++;
      pmStats[pm].total += t.totalPayment;
    });

    const topGateways = Object.entries(pmStats)
      .map(([name, data]) => ({
        name,
        count: data.count,
        total: data.total,
        pct: grossRevenue > 0 ? ((data.total / grossRevenue) * 100).toFixed(0) : "0",
      }))
      .sort((a, b) => b.total - a.total);

    // Crystal Package Breakdown
    const pkgStats: Record<string, { count: number; totalRev: number; crystals: number }> = {};
    success.forEach((t) => {
      const key = `${t.crystalAmount} Crystal`;
      if (!pkgStats[key]) pkgStats[key] = { count: 0, totalRev: 0, crystals: 0 };
      pkgStats[key].count++;
      pkgStats[key].totalRev += t.totalPayment;
      pkgStats[key].crystals += t.crystalAmount;
    });

    const topPackages = Object.entries(pkgStats)
      .map(([name, data]) => ({
        name,
        count: data.count,
        totalRev: data.totalRev,
        crystals: data.crystals,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      successCount: success.length,
      pendingCount: pending.length,
      rejectedCount: rejected.length,
      totalCount: filteredReportTxs.length,
      grossRevenue,
      estGatewayFee,
      netRevenue,
      totalCrystals,
      aov,
      successRate,
      dailyTrend,
      topGateways,
      topPackages,
    };
  }, [filteredReportTxs, transactions]);

  // Overall Global Stats for Header Strip
  const globalSuccessTxs = transactions.filter((t) => t.status === "berhasil");
  const globalTotalRevenue = globalSuccessTxs.reduce((acc, t) => acc + t.totalPayment, 0);
  const globalPendingCount = transactions.filter(
    (t) => t.status === "menunggu_verifikasi" || t.status === "menunggu_konfirmasi"
  ).length;

  // Handle Export CSV
  const handleExportCSV = () => {
    hapticLight();
    const targetTxs = activeTab === "reports" ? filteredReportTxs : transactions;
    const headers = [
      "ID Transaksi",
      "User ID",
      "Username",
      "Jumlah Crystal",
      "Metode Pembayaran",
      "Total Bayar (IDR)",
      "Status",
      "Crystal Diberikan",
      "Catatan",
      "Tanggal Dibuat",
    ];

    const rows = targetTxs.map((t) => [
      t.id,
      t.userId,
      t.username,
      t.crystalAmount,
      t.paymentMethod,
      t.totalPayment,
      t.status,
      t.crystalsGranted ? "Ya" : "Tidak",
      `"${(t.statusNote || "").replace(/"/g, '""')}"`,
      new Date(t.createdAt).toLocaleString("id-ID"),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    if (Platform.OS === "web") {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Laporan-Keuangan-Nuenime-${reportPeriod}-${Date.now()}.csv`;
      a.click();
    } else {
      Alert.alert("Ekspor CSV", "Data transaksi berhasil diekspor ke format CSV.");
    }
  };

  // Handle Copy Report Summary
  const handleCopySummary = () => {
    hapticLight();
    const periodLabel = {
      today: "Hari Ini",
      week: "7 Hari Terakhir",
      month: "Bulan Ini",
      all: "Semua Waktu",
    }[reportPeriod];

    const text = `📊 *REKAP KEUANGAN NUENIME (${periodLabel})*
----------------------------------------
💰 *Omset Bruto:* ${formatRupiah(reportMetrics.grossRevenue)}
🛡️ *Est. Biaya Gateway (1.5%):* -${formatRupiah(reportMetrics.estGatewayFee)}
✨ *Omset Bersih:* ${formatRupiah(reportMetrics.netRevenue)}
💎 *Crystal Terjual:* ${reportMetrics.totalCrystals.toLocaleString("id-ID")} Dylan Crystal
🎯 *Rata-rata Order (AOV):* ${formatRupiah(reportMetrics.aov)}
📈 *Tingkat Keberhasilan:* ${reportMetrics.successRate}%
📦 *Total Transaksi Berhasil:* ${reportMetrics.successCount} transaksi
⏳ *Antrean Pending Saat Ini:* ${reportMetrics.pendingCount} transaksi
----------------------------------------
_Laporan digenerate dari Admin Portal Nuenime_`;

    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } else {
      Alert.alert("Ringkasan Laporan", text);
    }
  };

  return (
    <AdminLayout
      title="Finance & Top Up Crystal"
      subtitle="Kelola verifikasi transaksi, pembayaran, paket Crystal, dan rekap omset keuangan"
      activeKey="finance"
    >
      {/* ─── QUICK KPI STRIP ─── */}
      <View style={[styles.kpiStrip, !isWide && styles.kpiStripMobile]}>
        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
            <AppIcon name="cash" size={18} color="#10B981" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Total Omset Sah</Text>
            <Text style={styles.kpiStripVal}>{formatRupiahShort(globalTotalRevenue)}</Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View
            style={[
              styles.kpiStripIcon,
              {
                backgroundColor:
                  globalPendingCount > 0 ? "rgba(245, 158, 11, 0.15)" : "rgba(255, 255, 255, 0.05)",
              },
            ]}
          >
            <AppIcon
              name="clock-outline"
              size={18}
              color={globalPendingCount > 0 ? "#F59E0B" : "#94A3B8"}
            />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Menunggu Verifikasi</Text>
            <Text
              style={[
                styles.kpiStripVal,
                globalPendingCount > 0 && { color: "#F59E0B" },
              ]}
            >
              {globalPendingCount} Transaksi
            </Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
            <AppIcon name="check-circle-outline" size={18} color="#38BDF8" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Transaksi Sukses</Text>
            <Text style={styles.kpiStripVal}>{globalSuccessTxs.length}</Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(140, 87, 255, 0.15)" }]}>
            <AppIcon name="crystal-ball" size={18} color="#8C57FF" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Katalog Paket</Text>
            <Text style={styles.kpiStripVal}>{packages.length} Tier</Text>
          </View>
        </View>
      </View>

      {/* ─── SUB TABS NAVIGATION ─── */}
      <View style={styles.tabNavRow}>
        {[
          { key: "queue", label: "Antrean Verifikasi", icon: "clipboard-check-outline", badge: globalPendingCount },
          { key: "reports", label: "Laporan & Omset", icon: "file-chart-outline" },
          { key: "packages", label: "Paket Crystal", icon: "package-variant" },
          { key: "gateways", label: "Konfigurasi Gateway", icon: "cog-outline" },
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
            {tab.badge !== undefined && tab.badge > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.badge}</Text>
              </View>
            )}
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
                { key: "menunggu_verifikasi", label: "Pending" },
                { key: "berhasil", label: "Berhasil" },
                { key: "ditolak", label: "Ditolak" },
                { key: "reversed", label: "Ditarik" },
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
              <View>
                <Text style={styles.cardBoxTitle}>
                  Daftar Transaksi ({transactions.length})
                </Text>
                <Text style={styles.cardBoxSubtitle}>
                  Klik Detail untuk melihat bukti transfer dan informasi lengkap
                </Text>
              </View>
              <Pressable onPress={handleExportCSV} style={styles.exportBtn}>
                <AppIcon name="file-download-outline" size={15} color="#10B981" />
                <Text style={styles.exportBtnText}>Ekspor CSV</Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator size="small" color="#E2E8F0" style={{ padding: 24 }} />
            ) : transactions.length === 0 ? (
              <View style={styles.emptyWrap}>
                <AppIcon name="credit-card" size={36} color="#334155" />
                <Text style={styles.emptyText}>Tidak ada transaksi yang cocok.</Text>
              </View>
            ) : (
              <View style={styles.tableWrap}>
                <View style={styles.thRow}>
                  <Text style={[styles.th, { flex: 1.8 }]}>ID PESANAN</Text>
                  <Text style={[styles.th, { flex: 1.5 }]}>PENGGUNA</Text>
                  <Text style={[styles.th, { flex: 1.4 }]}>PAKET</Text>
                  <Text style={[styles.th, { flex: 1.1 }]}>METODE</Text>
                  <Text style={[styles.th, { flex: 1.4 }]}>TOTAL</Text>
                  <Text style={[styles.th, { flex: 1.3 }]}>STATUS</Text>
                  <Text style={[styles.th, { flex: 2.2, textAlign: "right" }]}>AKSI</Text>
                </View>

                {transactions.map((tx) => (
                  <View key={tx.id} style={styles.trRow}>
                    <Text style={[styles.tdBold, { flex: 1.8 }]} numberOfLines={1}>
                      {tx.id}
                    </Text>
                    <Text style={[styles.td, { flex: 1.5 }]} numberOfLines={1}>
                      {tx.username}
                    </Text>
                    <Text style={[styles.td, { flex: 1.4 }]} numberOfLines={1}>
                      {tx.crystalAmount.toLocaleString("id-ID")} Crystal
                    </Text>
                    <Text style={[styles.td, { flex: 1.1 }]}>
                      {tx.paymentMethod.replace(/_/g, " ").toUpperCase()}
                    </Text>
                    <Text style={[styles.tdBold, { flex: 1.4, color: "#38BDF8" }]}>
                      {formatRupiahShort(tx.totalPayment)}
                    </Text>
                    <View style={{ flex: 1.3 }}>
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
                    <View style={[styles.actionBtnGroup, { flex: 2.2, justifyContent: "flex-end" }]}>
                      {/* Tombol Detail */}
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

                      {/* Status Berhasil: Tombol Tarik Kembali Crystal */}
                      {tx.status === "berhasil" && (
                        <Pressable
                          onPress={() => handleOpenReverse(tx)}
                          style={[styles.smallBtn, styles.btnReverse]}
                        >
                          <AppIcon name="history" size={12} color="#FFFFFF" />
                          <Text style={styles.smallBtnText}>Tarik</Text>
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
          TAB 2: LAPORAN & OMSET (SUPER CHARGED & BEAUTIFUL)
         ══════════════════════════════════════════════════════ */}
      {activeTab === "reports" && (
        <View style={styles.tabContentWrap}>
          {/* Header Action & Period Filter */}
          <View style={styles.reportHeaderCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportHeaderTitle}>Analitik Keuangan & Omset</Text>
              <Text style={styles.reportHeaderSubtitle}>
                Ringkasan performa finansial, konversi Crystal, dan estimasi laba bersih
              </Text>
            </View>

            {/* Time Filter Pills */}
            <View style={styles.periodPillRow}>
              {[
                { key: "today", label: "Hari Ini" },
                { key: "week", label: "7 Hari" },
                { key: "month", label: "Bulan Ini" },
                { key: "all", label: "Semua" },
              ].map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => {
                    hapticLight();
                    setReportPeriod(p.key as any);
                  }}
                  style={[
                    styles.periodPill,
                    reportPeriod === p.key && styles.periodPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.periodPillText,
                      reportPeriod === p.key && styles.periodPillTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ─── 4 MAIN FINANCIAL KPI BOXES ─── */}
          <View style={[styles.reportMetricGrid, !isWide && styles.reportMetricGridMobile]}>
            {/* Omset Bruto */}
            <View style={[styles.reportCard, { borderTopColor: "#10B981" }]}>
              <View style={styles.reportCardTop}>
                <View style={[styles.reportIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                  <AppIcon name="cash" size={20} color="#10B981" />
                </View>
                <View style={[styles.badgePill, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                  <Text style={[styles.badgePillText, { color: "#10B981" }]}>Bruto</Text>
                </View>
              </View>
              <Text style={styles.reportValText}>{formatRupiahShort(reportMetrics.grossRevenue)}</Text>
              <Text style={styles.reportLabelText}>Total Pemasukan Kotor</Text>
              <Text style={styles.reportFootnote}>
                Dari {reportMetrics.successCount} transaksi berhasil
              </Text>
            </View>

            {/* Omset Bersih (Net Revenue) */}
            <View style={[styles.reportCard, { borderTopColor: "#8C57FF" }]}>
              <View style={styles.reportCardTop}>
                <View style={[styles.reportIconWrap, { backgroundColor: "rgba(140, 87, 255, 0.15)" }]}>
                  <AppIcon name="shield-check" size={20} color="#8C57FF" />
                </View>
                <View style={[styles.badgePill, { backgroundColor: "rgba(140, 87, 255, 0.15)" }]}>
                  <Text style={[styles.badgePillText, { color: "#8C57FF" }]}>Netto</Text>
                </View>
              </View>
              <Text style={styles.reportValText}>{formatRupiahShort(reportMetrics.netRevenue)}</Text>
              <Text style={styles.reportLabelText}>Estimasi Omset Bersih</Text>
              <Text style={styles.reportFootnote}>
                Potongan MDR ~1.5% (-{formatRupiahShort(reportMetrics.estGatewayFee)})
              </Text>
            </View>

            {/* Dylan Crystal Terjual */}
            <View style={[styles.reportCard, { borderTopColor: "#EC4899" }]}>
              <View style={styles.reportCardTop}>
                <View style={[styles.reportIconWrap, { backgroundColor: "rgba(236, 72, 153, 0.15)" }]}>
                  <AppIcon name="crystal-ball" size={20} color="#EC4899" />
                </View>
                <View style={[styles.badgePill, { backgroundColor: "rgba(236, 72, 153, 0.15)" }]}>
                  <Text style={[styles.badgePillText, { color: "#EC4899" }]}>Crystal</Text>
                </View>
              </View>
              <Text style={styles.reportValText}>
                {((reportMetrics.totalCrystals || 0) / 1000).toFixed(1)}K
              </Text>
              <Text style={styles.reportLabelText}>Dylan Crystal Diterbitkan</Text>
              <Text style={styles.reportFootnote}>
                Total: {(reportMetrics.totalCrystals || 0).toLocaleString("id-ID")} Crystal
              </Text>
            </View>

            {/* AOV & Success Rate */}
            <View style={[styles.reportCard, { borderTopColor: "#38BDF8" }]}>
              <View style={styles.reportCardTop}>
                <View style={[styles.reportIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                  <AppIcon name="chart-bar" size={20} color="#38BDF8" />
                </View>
                <View style={[styles.badgePill, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                  <Text style={[styles.badgePillText, { color: "#38BDF8" }]}>{reportMetrics.successRate}% OK</Text>
                </View>
              </View>
              <Text style={styles.reportValText}>{formatRupiahShort(reportMetrics.aov)}</Text>
              <Text style={styles.reportLabelText}>Rata-rata Order (AOV)</Text>
              <Text style={styles.reportFootnote}>
                {reportMetrics.pendingCount} menunggu · {reportMetrics.rejectedCount} ditolak
              </Text>
            </View>
          </View>

          {/* ─── ROW: DAILY REVENUE CHART + PAYMENT BREAKDOWN ─── */}
          <View style={[styles.analyticsRow, !isWide && { flexDirection: "column" }]}>
            {/* Visual Bar Chart 7 Hari */}
            <View style={[styles.chartCard, { flex: 1.6 }]}>
              <View style={styles.cardBoxHeader}>
                <View>
                  <Text style={styles.cardBoxTitle}>Tren Omset 7 Hari Terakhir</Text>
                  <Text style={styles.cardBoxSubtitle}>Fluktuasi pendapatan harian sukses</Text>
                </View>
                <View style={[styles.badgePill, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                  <AppIcon name="trending-up" size={13} color="#10B981" />
                  <Text style={[styles.badgePillText, { color: "#10B981" }]}>Live Trend</Text>
                </View>
              </View>

              <View style={{ gap: 10, marginTop: 4 }}>
                {reportMetrics.dailyTrend.map((d, i) => {
                  const max = Math.max(...reportMetrics.dailyTrend.map((t) => t.total), 1);
                  const pct = d.total / max;
                  const isToday = i === reportMetrics.dailyTrend.length - 1;
                  return (
                    <View key={i} style={styles.trendBarRow}>
                      <View style={{ width: 62 }}>
                        <Text style={styles.trendBarDay}>{d.label}</Text>
                        <Text style={styles.trendBarDate}>{d.dateStr}</Text>
                      </View>
                      <View style={styles.trendBarBg}>
                        <View
                          style={[
                            styles.trendBarFill,
                            {
                              width: `${Math.max(pct * 100, d.total > 0 ? 4 : 0)}%`,
                              backgroundColor: isToday ? "#10B981" : "rgba(16, 185, 129, 0.45)",
                            },
                          ]}
                        />
                      </View>
                      <View style={{ minWidth: 70, alignItems: "flex-end" }}>
                        <Text style={[styles.trendBarVal, isToday && { color: "#10B981" }]}>
                          {d.total > 0 ? formatRupiahShort(d.total) : "—"}
                        </Text>
                        <Text style={styles.trendBarCount}>{d.count} tx</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Metode Pembayaran Terpopuler */}
            <View style={[styles.chartCard, { flex: 1 }]}>
              <View style={styles.cardBoxHeader}>
                <View>
                  <Text style={styles.cardBoxTitle}>Metode Pembayaran</Text>
                  <Text style={styles.cardBoxSubtitle}>Pangsa revenue channel</Text>
                </View>
              </View>

              {reportMetrics.topGateways.length > 0 ? (
                <View style={{ gap: 14, marginTop: 4 }}>
                  {reportMetrics.topGateways.map((gw, idx) => {
                    const colors = ["#8C57FF", "#38BDF8", "#10B981", "#F59E0B", "#EC4899"];
                    const col = colors[idx % colors.length];
                    return (
                      <View key={gw.name} style={{ gap: 5 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col }} />
                            <Text style={styles.pmTitle}>{gw.name.replace(/_/g, " ").toUpperCase()}</Text>
                          </View>
                          <Text style={[styles.pmPct, { color: col }]}>{gw.pct}% ({formatRupiahShort(gw.total)})</Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${gw.pct}%` as any, backgroundColor: col }]} />
                        </View>
                        <Text style={styles.pmSub}>{gw.count} transaksi berhasil</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyCenter}>
                  <AppIcon name="chart-bar" size={32} color="#334155" />
                  <Text style={styles.emptyText}>Belum ada data pembayaran</Text>
                </View>
              )}
            </View>
          </View>

          {/* ─── ROW: TOP PACKAGES SOLD & REPORT ACTIONS ─── */}
          <View style={[styles.analyticsRow, !isWide && { flexDirection: "column" }]}>
            {/* Paket Crystal Terlaris */}
            <View style={[styles.chartCard, { flex: 1.5 }]}>
              <View style={styles.cardBoxHeader}>
                <View>
                  <Text style={styles.cardBoxTitle}>Paket Crystal Terlaris</Text>
                  <Text style={styles.cardBoxSubtitle}>Peringkat volume pembelian user</Text>
                </View>
              </View>

              {reportMetrics.topPackages.length > 0 ? (
                <View style={{ gap: 8, marginTop: 4 }}>
                  {reportMetrics.topPackages.map((pkg, i) => (
                    <View key={pkg.name} style={styles.pkgStatRow}>
                      <View style={styles.pkgRankBadge}>
                        <Text style={styles.pkgRankText}>#{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pkgStatName}>{pkg.name}</Text>
                        <Text style={styles.pkgStatSub}>
                          {pkg.count} pesanan · {pkg.crystals.toLocaleString("id-ID")} Crystal
                        </Text>
                      </View>
                      <Text style={styles.pkgStatRev}>{formatRupiahShort(pkg.totalRev)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCenter}>
                  <AppIcon name="package-variant" size={32} color="#334155" />
                  <Text style={styles.emptyText}>Belum ada paket terjual pada periode ini</Text>
                </View>
              )}
            </View>

            {/* Quick Actions & Ekspor */}
            <View style={[styles.chartCard, { flex: 1 }]}>
              <Text style={styles.cardBoxTitle}>Aksi Laporan & Rekonsiliasi</Text>
              <Text style={styles.cardBoxSubtitle}>Unduh rekap atau bagikan ke tim manajemen</Text>

              <View style={{ gap: 10, marginTop: 6 }}>
                <Pressable onPress={handleExportCSV} style={styles.reportActionBtn}>
                  <View style={[styles.reportActionIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                    <AppIcon name="file-download-outline" size={18} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reportActionTitle}>Unduh Rekap CSV</Text>
                    <Text style={styles.reportActionSub}>Format spreadsheet detail</Text>
                  </View>
                  <AppIcon name="chevron-right" size={14} color="#94A3B8" />
                </Pressable>

                <Pressable onPress={handleCopySummary} style={styles.reportActionBtn}>
                  <View style={[styles.reportActionIcon, { backgroundColor: "rgba(140, 87, 255, 0.15)" }]}>
                    <AppIcon name="content-copy" size={18} color="#8C57FF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reportActionTitle}>
                      {copySuccess ? "Tersalin ke Clipboard!" : "Salin Ringkasan Teks"}
                    </Text>
                    <Text style={styles.reportActionSub}>Format WhatsApp & Telegram</Text>
                  </View>
                  <AppIcon name="chevron-right" size={14} color="#94A3B8" />
                </Pressable>

                <View style={styles.auditReconBox}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <AppIcon name="shield-account" size={16} color="#38BDF8" />
                    <Text style={styles.auditReconTitle}>Status Audit Finansial</Text>
                  </View>
                  <Text style={styles.auditReconText}>
                    Semua transaksi tercatat permanen di audit log. Penarikan saldo memerlukan konfirmasi admin super.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 3: PAKET CRYSTAL CRUD
         ══════════════════════════════════════════════════════ */}
      {activeTab === "packages" && (
        <View style={styles.cardBox}>
          <View style={styles.cardBoxHeader}>
            <View>
              <Text style={styles.cardBoxTitle}>Katalog Paket Dylan Crystal</Text>
              <Text style={styles.cardBoxSubtitle}>
                Daftar harga dan tier paket Dylan Crystal yang dapat dibeli oleh pengguna
              </Text>
            </View>
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

          <View style={styles.packageGrid}>
            {packages.map((pkg) => (
              <View key={pkg.id} style={styles.packageCard}>
                <View style={styles.packageCardTop}>
                  <View style={styles.packageCrystalIcon}>
                    <AppIcon name="crystal-ball" size={24} color="#E2E8F0" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.packageName}>{pkg.name}</Text>
                    <Text style={styles.packageAmount}>{pkg.amountFormatted} Crystal</Text>
                  </View>
                </View>
                <View style={styles.packagePriceRow}>
                  <Text style={styles.packagePrice}>{pkg.priceFormatted}</Text>
                  <Pressable
                    onPress={() => {
                      setEditingPkg({ ...pkg });
                      setShowPkgModal(true);
                    }}
                    style={styles.editBtn}
                  >
                    <AppIcon name="pencil" size={13} color="#FFFFFF" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 4: KONFIGURASI GATEWAY PEMBAYARAN
         ══════════════════════════════════════════════════════ */}
      {activeTab === "gateways" && gatewayConfig && (
        <View style={styles.cardBox}>
          <View>
            <Text style={styles.cardBoxTitle}>Konfigurasi Akun & Metode Pembayaran</Text>
            <Text style={styles.cardBoxSubtitle}>
              Pengaturan ini langsung tersinkronisasi ke aplikasi tanpa mengharuskan pengguna
              membangun ulang (rebuild) file APK.
            </Text>
          </View>

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
              {gatewaySaving ? "Menyimpan..." : "Simpan Konfigurasi Gateway"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ─── MODAL TOLAK TRANSAKSI ─── */}
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
            <Text style={styles.modalTitle}>Kelola Paket Crystal</Text>
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
            <Text style={styles.modalTitle}>Detail Transaksi</Text>
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
                  <Text style={styles.detailItemLabel}>Jumlah Crystal:</Text>
                  <Text style={[styles.detailItemValBold, { color: "#8C57FF" }]}>
                    {selectedTx.crystalAmount.toLocaleString("id-ID")} Crystal
                  </Text>
                </View>
                <View style={styles.detailItemRow}>
                  <Text style={styles.detailItemLabel}>Metode Pembayaran:</Text>
                  <Text style={styles.detailItemVal}>
                    {selectedTx.paymentMethod.replace(/_/g, " ").toUpperCase()}
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
    marginBottom: 16,
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

  // ── Tabs
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
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  tabNavBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.32)",
    shadowOpacity: 0,
    elevation: 0,
  },
  tabNavBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  tabNavBtnTextActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },
  tabBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
    color: "#FFFFFF",
  },

  tabContentWrap: {
    gap: 16,
  },

  // ── Filter Bar
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
    backgroundColor: "#0D1117",
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
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  filterChipActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.30)",
    shadowOpacity: 0,
    elevation: 0,
  },
  filterChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },

  // ── Card Box
  cardBox: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 14,
  },
  cardBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardBoxTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  cardBoxSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  exportBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#10B981",
  },

  // ── Table
  tableWrap: {
    gap: 2,
  },
  thRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 6,
  },
  th: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#64748B",
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
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
  },
  btnDetail: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
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
    fontSize: 10.5,
    color: "#FFFFFF",
  },

  // ── Reports Header Card
  reportHeaderCard: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 12,
  },
  reportHeaderTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  reportHeaderSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  periodPillRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  periodPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  periodPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.32)",
    shadowOpacity: 0,
    elevation: 0,
  },
  periodPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  periodPillTextActive: {
    color: "#FFFFFF",
  },

  // ── Report Metrics Grid
  reportMetricGrid: {
    flexDirection: "row",
    gap: 14,
  },
  reportMetricGridMobile: {
    flexWrap: "wrap",
  },
  reportCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderTopWidth: 3,
    gap: 6,
  },
  reportCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  reportIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  reportValText: {
    fontFamily: "Nunito-Black",
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  reportLabelText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
  },
  reportFootnote: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgePillText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
  },

  // ── Analytics Row
  analyticsRow: {
    flexDirection: "row",
    gap: 14,
  },
  chartCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 14,
  },

  // ── Daily Trend Bar
  trendBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trendBarDay: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
    color: "#FFFFFF",
  },
  trendBarDate: {
    fontFamily: "Nunito-Regular",
    fontSize: 9.5,
    color: "#64748B",
  },
  trendBarBg: {
    flex: 1,
    height: 18,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    overflow: "hidden",
  },
  trendBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  trendBarVal: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
    color: "#FFFFFF",
  },
  trendBarCount: {
    fontFamily: "Nunito-Regular",
    fontSize: 9.5,
    color: "#64748B",
  },

  // ── Payment method stats
  pmTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#CBD5E1",
  },
  pmPct: {
    fontFamily: "Nunito-Black",
    fontSize: 10.5,
  },
  pmSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 9.5,
    color: "#64748B",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },

  // ── Packages ranking
  packageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  packageCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  packageCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  packageCrystalIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(140, 87, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
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
    marginTop: 2,
  },
  packagePriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.04)",
  },
  packagePrice: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.20)",
  },
  editBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
  },

  // ── Package Stat Rows in Reports
  pkgStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  pkgRankBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  pkgRankText: {
    fontFamily: "Nunito-Black",
    fontSize: 10.5,
    color: "#CBD5E1",
  },
  pkgStatName: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },
  pkgStatSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
    marginTop: 1,
  },
  pkgStatRev: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#10B981",
  },

  // ── Report Action Buttons
  reportActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  reportActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  reportActionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#FFFFFF",
  },
  reportActionSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
  },
  auditReconBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.18)",
    gap: 6,
    marginTop: 4,
  },
  auditReconTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },
  auditReconText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#94A3B8",
    lineHeight: 14,
  },

  // ── Forms & Gateways
  formGroup: {
    gap: 6,
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
    paddingVertical: 9,
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#FFFFFF",
  },
  formDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginVertical: 6,
  },
  subSectionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#E2E8F0",
  },
  qrisPreviewBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
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
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    shadowOpacity: 0,
    elevation: 0,
  },
  addBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },

  // ── Modals
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
    borderColor: "rgba(255, 255, 255, 0.09)",
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  modalSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
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
    backgroundColor: "rgba(255, 255, 255, 0.05)",
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
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
    shadowOpacity: 0,
    elevation: 0,
  },
  modalSaveText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  detailGrid: {
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
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
    fontSize: 11.5,
    color: "#94A3B8",
  },
  detailItemVal: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#E2E8F0",
  },
  detailItemValBold: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#FFFFFF",
  },
  detailItemValHighlight: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#38BDF8",
  },
  detailItemValMuted: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  detailNoteText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#CBD5E1",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#8C57FF",
  },
  modalCloseBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
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
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  reversalWarningTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 11.5,
    color: "#EF4444",
  },
  reversalWarningText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#FCA5A5",
    lineHeight: 15,
  },

  // ── Empties
  emptyWrap: {
    padding: 30,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#475569",
  },
  emptyCenter: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 10,
  },
});
