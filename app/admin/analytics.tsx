import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  type DashboardKPIData,
  getDashboardKPIData,
  getAllTransactionsForAdmin,
} from "@/lib/admin-service";
import { type TopUpTransaction } from "@/lib/topup-service";
import { AppIcon } from "@/components/app-icon";

export default function AdminAnalyticsScreen() {
  const [kpi, setKpi] = useState<DashboardKPIData | null>(null);
  const [transactions, setTransactions] = useState<TopUpTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month">("month");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [kpiData, txs] = await Promise.all([
          getDashboardKPIData(),
          getAllTransactionsForAdmin(),
        ]);
        setKpi(kpiData);
        setTransactions(txs);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // Breakdown by payment methods
  const methodStats = transactions.reduce((acc, tx) => {
    if (tx.status === "berhasil") {
      acc[tx.paymentMethod] = (acc[tx.paymentMethod] || 0) + tx.totalPayment;
    }
    return acc;
  }, {} as Record<string, number>);

  // Breakdown by package popularity
  const packageStats = transactions.reduce((acc, tx) => {
    if (tx.status === "berhasil") {
      acc[tx.packageName] = (acc[tx.packageName] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const handleExportCSV = () => {
    const headers = "ID Transaksi,Username,Paket,Harga,Metode,Status,Waktu\n";
    const rows = transactions
      .map(
        (t) =>
          `"${t.id}","${t.username}","${t.packageName}",${t.totalPayment},"${t.paymentMethod}","${t.status}","${t.createdAt}"`
      )
      .join("\n");
    const csvContent = headers + rows;

    if (typeof window !== "undefined" && window.navigator) {
      // Browser download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `nuenime_financial_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      Share.share({ message: csvContent, title: "Export Laporan Keuangan Nuenime" });
    }
  };

  return (
    <AdminLayout activeKey="analytics" title="Analytics & Reports">
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Laporan Keuangan & Analitik Bisnis</Text>
            <Text style={styles.subtitle}>
              Data transaksi terverifikasi, pertumbuhan ekonomi Dylan Crystal, dan metrik operasional.
            </Text>
          </View>

          <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
            <AppIcon name="download" size={16} color="#FFF" />
            <Text style={styles.exportBtnText}>Ekspor Laporan CSV</Text>
          </TouchableOpacity>
        </View>

        {isLoading || !kpi ? (
          <ActivityIndicator size="large" color="#8C57FF" style={{ marginVertical: 40 }} />
        ) : (
          <>
            {/* KPI CARDS GRID */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <View style={styles.kpiIconWrap}>
                  <AppIcon name="fire" size={20} color="#8C57FF" />
                </View>
                <Text style={styles.kpiLabel}>Omset Hari Ini</Text>
                <Text style={styles.kpiValue}>Rp{kpi.revenueToday.toLocaleString("id-ID")}</Text>
                <Text style={styles.kpiMeta}>Berdasarkan transaksi berhasil</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                  <AppIcon name="calendar" size={20} color="#38BDF8" />
                </View>
                <Text style={styles.kpiLabel}>Omset Minggu Ini</Text>
                <Text style={styles.kpiValue}>Rp{kpi.revenueThisWeek.toLocaleString("id-ID")}</Text>
                <Text style={styles.kpiMeta}>7 hari terakhir</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                  <AppIcon name="storefront-outline" size={20} color="#10B981" />
                </View>
                <Text style={styles.kpiLabel}>Omset Bulan Ini</Text>
                <Text style={styles.kpiValue}>Rp{kpi.revenueThisMonth.toLocaleString("id-ID")}</Text>
                <Text style={styles.kpiMeta}>Bulan berjalan</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                  <AppIcon name="sparkles" size={20} color="#F59E0B" />
                </View>
                <Text style={styles.kpiLabel}>Total Crystal Dibeli</Text>
                <Text style={styles.kpiValue}>{kpi.totalCrystalsPurchased.toLocaleString("id-ID")}</Text>
                <Text style={styles.kpiMeta}>Total minted via Top Up</Text>
              </View>
            </View>

            {/* TRANSACTIONS STATS BAR */}
            <View style={styles.statBarCard}>
              <Text style={styles.cardTitle}>Status Verifikasi Transaksi Keseluruhan</Text>
              <View style={styles.statusBreakdown}>
                <View style={styles.statusItem}>
                  <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
                  <Text style={styles.statusItemLabel}>Berhasil / Sah:</Text>
                  <Text style={[styles.statusItemVal, { color: "#10B981" }]}>
                    {kpi.totalCompletedTxs} transaksi
                  </Text>
                </View>

                <View style={styles.statusItem}>
                  <View style={[styles.dot, { backgroundColor: "#F59E0B" }]} />
                  <Text style={styles.statusItemLabel}>Antrean Pending:</Text>
                  <Text style={[styles.statusItemVal, { color: "#F59E0B" }]}>
                    {kpi.totalPendingTxs} transaksi
                  </Text>
                </View>

                <View style={styles.statusItem}>
                  <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
                  <Text style={styles.statusItemLabel}>Ditolak:</Text>
                  <Text style={[styles.statusItemVal, { color: "#EF4444" }]}>
                    {kpi.totalRejectedTxs} transaksi
                  </Text>
                </View>
              </View>
            </View>

            {/* TWO COLUMN BREAKDOWNS */}
            <View style={styles.twoCol}>
              {/* Left: Payment Method Breakdown */}
              <View style={styles.colCard}>
                <Text style={styles.cardTitle}>Omset Berdasarkan Saluran Pembayaran</Text>
                <Text style={styles.cardDesc}>
                  Total nominal pembayaran berhasil dari masing-masing metode gateway.
                </Text>

                <View style={styles.breakdownList}>
                  {Object.entries(methodStats).length === 0 ? (
                    <Text style={styles.emptyText}>Belum ada data transaksi berhasil.</Text>
                  ) : (
                    Object.entries(methodStats).map(([method, total]) => {
                      const percentage =
                        kpi.revenueThisMonth > 0
                          ? Math.min(100, Math.round((total / kpi.revenueThisMonth) * 100))
                          : 100;
                      return (
                        <View key={method} style={styles.breakdownRow}>
                          <View style={styles.breakdownRowHeader}>
                            <Text style={styles.methodName}>{method.toUpperCase()}</Text>
                            <Text style={styles.methodTotal}>Rp{total.toLocaleString("id-ID")}</Text>
                          </View>
                          <View style={styles.progressBg}>
                            <View style={[styles.progressBar, { width: `${percentage}%` }]} />
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>

              {/* Right: Crystal Package Popularity */}
              <View style={styles.colCard}>
                <Text style={styles.cardTitle}>Popularitas Paket Crystal</Text>
                <Text style={styles.cardDesc}>
                  Frekuensi pembelian paket oleh pengguna sejak peluncuran.
                </Text>

                <View style={styles.breakdownList}>
                  {Object.entries(packageStats).length === 0 ? (
                    <Text style={styles.emptyText}>Belum ada data paket terjual.</Text>
                  ) : (
                    Object.entries(packageStats).map(([pkg, count]) => {
                      const percentage =
                        kpi.totalCompletedTxs > 0
                          ? Math.min(100, Math.round((count / kpi.totalCompletedTxs) * 100))
                          : 100;
                      return (
                        <View key={pkg} style={styles.breakdownRow}>
                          <View style={styles.breakdownRowHeader}>
                            <Text style={styles.methodName}>{pkg}</Text>
                            <Text style={styles.methodTotal}>{count} kali dibeli</Text>
                          </View>
                          <View style={styles.progressBg}>
                            <View
                              style={[
                                styles.progressBar,
                                { width: `${percentage}%`, backgroundColor: "#38BDF8" },
                              ]}
                            />
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            </View>

            {/* CIRCULATION METRICS */}
            <View style={[styles.colCard, { marginTop: 24 }]}>
              <Text style={styles.cardTitle}>Metrik Sirkulasi Ekonomi Dylan Crystal</Text>
              <Text style={styles.cardDesc}>
                Perbandingan crystal yang dicetak (minted) versus crystal yang dibakar (gacha sink).
              </Text>

              <View style={styles.circulationRow}>
                <View style={styles.circItem}>
                  <Text style={styles.circLabel}>Total Minted (Top Up Berhasil)</Text>
                  <Text style={[styles.circVal, { color: "#8C57FF" }]}>
                    +{kpi.totalCrystalsPurchased.toLocaleString("id-ID")} Crystal
                  </Text>
                </View>

                <View style={styles.circItem}>
                  <Text style={styles.circLabel}>Total Burned (Gacha Spending)</Text>
                  <Text style={[styles.circVal, { color: "#F59E0B" }]}>
                    -{kpi.totalCrystalsSpent.toLocaleString("id-ID")} Crystal
                  </Text>
                </View>

                <View style={styles.circItem}>
                  <Text style={styles.circLabel}>Net Sirkulasi Pengguna</Text>
                  <Text style={[styles.circVal, { color: "#10B981" }]}>
                    {(kpi.totalCrystalsPurchased - kpi.totalCrystalsSpent).toLocaleString("id-ID")} Crystal
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  subtitle: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 4,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#8C57FF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  exportBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  kpiCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.15)",
  },
  kpiIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "rgba(140, 87, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  kpiLabel: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "600",
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F8FAFC",
    marginVertical: 4,
  },
  kpiMeta: {
    fontSize: 11,
    color: "#64748B",
  },
  statBarCard: {
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.15)",
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: "#94A3B8",
    marginBottom: 16,
  },
  statusBreakdown: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 24,
    marginTop: 10,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusItemLabel: {
    fontSize: 13,
    color: "#CBD5E1",
  },
  statusItemVal: {
    fontSize: 14,
    fontWeight: "700",
  },
  twoCol: {
    flexDirection: "row",
    gap: 20,
    flexWrap: "wrap",
  },
  colCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.15)",
  },
  breakdownList: {
    marginTop: 12,
  },
  breakdownRow: {
    marginBottom: 14,
  },
  breakdownRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  methodName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F8FAFC",
  },
  methodTotal: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "600",
  },
  progressBg: {
    height: 8,
    backgroundColor: "#14121F",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#8C57FF",
    borderRadius: 4,
  },
  emptyText: {
    color: "#64748B",
    fontSize: 13,
    fontStyle: "italic",
    marginVertical: 12,
  },
  circulationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginTop: 12,
  },
  circItem: {
    flex: 1,
    minWidth: 200,
    backgroundColor: "#14121F",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  circLabel: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 6,
  },
  circVal: {
    fontSize: 18,
    fontWeight: "700",
  },
});
