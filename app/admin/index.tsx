import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import { hapticLight } from "@/lib/haptics";
import {
  type DashboardKPIData,
  type TopUpTransaction,
  getDashboardKPIData,
  getAllTransactionsForAdmin,
} from "@/lib/admin-service";

export default function AdminOverviewScreen() {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<DashboardKPIData | null>(null);
  const [recentTxs, setRecentTxs] = useState<TopUpTransaction[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const kpiData = await getDashboardKPIData();
      setKpi(kpiData);

      const txs = await getAllTransactionsForAdmin();
      setRecentTxs(txs.slice(0, 5));
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <AdminLayout
      title="Dashboard Overview"
      subtitle="Ringkasan metrik kinerja, keuangan, dan status operasional Nuenime"
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8C57FF" />
          <Text style={styles.loadingText}>Memuat data dashboard...</Text>
        </View>
      ) : (
        <>
          {/* ─── ROW 1: KARTU STATISTIK MATERIO STYLE ─── */}
          <View style={styles.kpiGrid}>
            {/* Omset Hari Ini */}
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={[styles.statIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                  <AppIcon name="cash" size={20} color="#10B981" />
                </View>
                <View style={[styles.trendBadge, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                  <Text style={[styles.trendBadgeText, { color: "#10B981" }]}>+12.5%</Text>
                </View>
              </View>
              <Text style={styles.statValue}>
                Rp{(kpi?.revenueToday ?? 0).toLocaleString("id-ID")}
              </Text>
              <Text style={styles.statLabel}>Omset Hari Ini</Text>
              <Text style={styles.statSub}>
                Minggu ini: Rp{(kpi?.revenueThisWeek ?? 0).toLocaleString("id-ID")}
              </Text>
            </View>

            {/* Total Transaksi */}
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={[styles.statIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                  <AppIcon name="receipt" size={20} color="#38BDF8" />
                </View>
                <View
                  style={[
                    styles.trendBadge,
                    {
                      backgroundColor:
                        (kpi?.totalPendingTxs ?? 0) > 0
                          ? "rgba(245, 158, 11, 0.2)"
                          : "rgba(56, 189, 248, 0.15)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.trendBadgeText,
                      { color: (kpi?.totalPendingTxs ?? 0) > 0 ? "#F59E0B" : "#38BDF8" },
                    ]}
                  >
                    {(kpi?.totalPendingTxs ?? 0) > 0
                      ? `${kpi?.totalPendingTxs} Pending`
                      : "Semua Beres"}
                  </Text>
                </View>
              </View>
              <Text style={styles.statValue}>{kpi?.totalCompletedTxs ?? 0}</Text>
              <Text style={styles.statLabel}>Transaksi Berhasil</Text>
              <Text style={styles.statSub}>Ditolak: {kpi?.totalRejectedTxs ?? 0} pesanan</Text>
            </View>

            {/* Pengguna Terdaftar & DAU */}
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={[styles.statIconWrap, { backgroundColor: "rgba(140, 87, 255, 0.15)" }]}>
                  <AppIcon name="account-group" size={20} color="#8C57FF" />
                </View>
                <View style={[styles.trendBadge, { backgroundColor: "rgba(140, 87, 255, 0.15)" }]}>
                  <Text style={[styles.trendBadgeText, { color: "#8C57FF" }]}>Aktif</Text>
                </View>
              </View>
              <Text style={styles.statValue}>{kpi?.totalRegisteredUsers ?? 0}</Text>
              <Text style={styles.statLabel}>Total Pengguna</Text>
              <Text style={styles.statSub}>Aktif Harian (DAU): {kpi?.dau ?? 0} user</Text>
            </View>

            {/* Dylan Crystal Beredar */}
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={[styles.statIconWrap, { backgroundColor: "rgba(236, 72, 153, 0.15)" }]}>
                  <AppIcon name="crystal-ball" size={20} color="#EC4899" />
                </View>
                <View style={[styles.trendBadge, { backgroundColor: "rgba(236, 72, 153, 0.15)" }]}>
                  <Text style={[styles.trendBadgeText, { color: "#EC4899" }]}>Ekonomi</Text>
                </View>
              </View>
              <Text style={styles.statValue}>
                {(kpi?.totalCrystalsPurchased ?? 0).toLocaleString("id-ID")}
              </Text>
              <Text style={styles.statLabel}>Crystal Terjual</Text>
              <Text style={styles.statSub}>
                Gacha/Shop: {(kpi?.totalCrystalsSpent ?? 0).toLocaleString("id-ID")} Crystal
              </Text>
            </View>
          </View>

          {/* ─── ROW 2: AKSI CEPAT ADMIN (SHORTCUTS) ─── */}
          <View style={styles.cardBox}>
            <Text style={styles.cardBoxTitle}>Aksi Cepat Pengelolaan</Text>
            <View style={styles.quickActionRow}>
              <Pressable
                onPress={() => {
                  hapticLight();
                  router.push("/admin/finance" as any);
                }}
                style={styles.quickActionBtn}
              >
                <AppIcon name="check-decagram" size={20} color="#F59E0B" />
                <View>
                  <Text style={styles.quickActionBtnTitle}>Verifikasi Top Up</Text>
                  <Text style={styles.quickActionBtnSub}>
                    {kpi?.totalPendingTxs ?? 0} pesanan menunggu
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  hapticLight();
                  router.push("/admin/users" as any);
                }}
                style={styles.quickActionBtn}
              >
                <AppIcon name="account-edit" size={20} color="#38BDF8" />
                <View>
                  <Text style={styles.quickActionBtnTitle}>Kelola Akun</Text>
                  <Text style={styles.quickActionBtnSub}>Edit saldo & cooldown</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  hapticLight();
                  router.push("/admin/borders" as any);
                }}
                style={styles.quickActionBtn}
              >
                <AppIcon name="shield-star" size={20} color="#A855F7" />
                <View>
                  <Text style={styles.quickActionBtnTitle}>45 Border Avatar</Text>
                  <Text style={styles.quickActionBtnSub}>Atur rilis & rasio 0.74</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  hapticLight();
                  router.push("/admin/system" as any);
                }}
                style={styles.quickActionBtn}
              >
                <AppIcon name="android" size={20} color="#10B981" />
                <View>
                  <Text style={styles.quickActionBtnTitle}>Versi APK & Siaran</Text>
                  <Text style={styles.quickActionBtnSub}>Update rilis APK v0.0.1</Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* ─── ROW 3: TABEL TRANSAKSI TERBARU ─── */}
          <View style={styles.cardBox}>
            <View style={styles.tableHeaderRow}>
              <View>
                <Text style={styles.cardBoxTitle}>Transaksi Top Up Terbaru</Text>
                <Text style={styles.cardBoxSubtitle}>5 transaksi terakhir yang masuk ke sistem</Text>
              </View>
              <Pressable
                onPress={() => {
                  hapticLight();
                  router.push("/admin/finance" as any);
                }}
                style={styles.viewAllBtn}
              >
                <Text style={styles.viewAllBtnText}>Lihat Semua →</Text>
              </Pressable>
            </View>

            {recentTxs.length === 0 ? (
              <View style={styles.emptyTableWrap}>
                <AppIcon name="receipt" size={32} color="#6B657B" />
                <Text style={styles.emptyTableText}>Belum ada transaksi di sistem.</Text>
              </View>
            ) : (
              <View style={styles.tableContainer}>
                <View style={styles.tableHead}>
                  <Text style={[styles.thCell, { flex: 2 }]}>ID TRANSAKSI</Text>
                  <Text style={[styles.thCell, { flex: 2 }]}>PENGGUNA</Text>
                  <Text style={[styles.thCell, { flex: 2 }]}>PAKET</Text>
                  <Text style={[styles.thCell, { flex: 1.5 }]}>METODE</Text>
                  <Text style={[styles.thCell, { flex: 1.5 }]}>TOTAL</Text>
                  <Text style={[styles.thCell, { flex: 1.5 }]}>STATUS</Text>
                </View>

                {recentTxs.map((t) => (
                  <View key={t.id} style={styles.tableRow}>
                    <Text style={[styles.tdCellBold, { flex: 2 }]} numberOfLines={1}>
                      {t.id}
                    </Text>
                    <Text style={[styles.tdCell, { flex: 2 }]} numberOfLines={1}>
                      {t.username}
                    </Text>
                    <Text style={[styles.tdCell, { flex: 2 }]} numberOfLines={1}>
                      {t.crystalAmount.toLocaleString("id-ID")} Crystal
                    </Text>
                    <Text style={[styles.tdCell, { flex: 1.5 }]}>
                      {t.paymentMethod.toUpperCase()}
                    </Text>
                    <Text style={[styles.tdCellBold, { flex: 1.5, color: "#38BDF8" }]}>
                      Rp{t.totalPayment.toLocaleString("id-ID")}
                    </Text>
                    <View style={{ flex: 1.5 }}>
                      <View
                        style={[
                          styles.statusChip,
                          t.status === "berhasil"
                            ? styles.statusSuccess
                            : t.status === "ditolak"
                            ? styles.statusDanger
                            : styles.statusWarning,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            t.status === "berhasil"
                              ? styles.statusSuccessText
                              : t.status === "ditolak"
                              ? styles.statusDangerText
                              : styles.statusWarningText,
                          ]}
                          numberOfLines={1}
                        >
                          {t.status === "berhasil"
                            ? "Berhasil"
                            : t.status === "ditolak"
                            ? "Ditolak"
                            : "Pending"}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#94A3B8",
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  statCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 6,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trendBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 10.5,
  },
  statValue: {
    fontFamily: "Nunito-Black",
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#E2E8F0",
  },
  statSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  cardBox: {
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 16,
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
  },
  quickActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickActionBtn: {
    flex: 1,
    minWidth: 200,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  quickActionBtnTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  quickActionBtnSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(140, 87, 255, 0.15)",
  },
  viewAllBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#8C57FF",
  },
  tableContainer: {
    gap: 2,
  },
  tableHead: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 6,
    marginBottom: 4,
  },
  thCell: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  tdCell: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#CBD5E1",
  },
  tdCellBold: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  statusChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusSuccessText: {
    color: "#10B981",
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
  },
  statusWarning: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  statusWarningText: {
    color: "#F59E0B",
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
  },
  statusDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  statusDangerText: {
    color: "#EF4444",
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
  },
  statusChipText: {},
  emptyTableWrap: {
    alignItems: "center",
    padding: 30,
    gap: 8,
  },
  emptyTableText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
  },
});
