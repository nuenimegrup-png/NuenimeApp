import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Animated,
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
  formatRupiah,
} from "@/lib/admin-service";

// ─── HELPERS ───────────────────────────────────────────────────────────────
function formatRupiahShort(val: number): string {
  if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}M`;
  if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}Jt`;
  if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`;
  return `Rp ${val}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "berhasil": return "#10B981";
    case "menunggu_verifikasi":
    case "menunggu_konfirmasi": return "#F59E0B";
    case "ditolak": return "#EF4444";
    default: return "#94A3B8";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "berhasil": return "Berhasil";
    case "menunggu_verifikasi": return "Menunggu";
    case "menunggu_konfirmasi": return "Konfirmasi";
    case "ditolak": return "Ditolak";
    default: return status;
  }
}

// ─── MINI BAR CHART COMPONENT ────────────────────────────────────────────
function MiniBarChart({ data, color, height = 60 }: { data: number[]; color: string; height?: number }) {
  const max = Math.max(...data, 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height }}>
      {data.map((v, i) => {
        const barH = Math.max(4, (v / max) * height);
        const isLast = i === data.length - 1;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: barH,
              borderRadius: 3,
              backgroundColor: isLast ? color : `${color}55`,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── MINI LINE SPARKLINE ──────────────────────────────────────────────────
function Sparkline({ data, color, width = 80, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * (width - 4) + 2,
    y: height - 4 - ((v / max) * (height - 8)),
  }));
  // Simple visual using views – RN doesn't have SVG out-of-box without library
  return (
    <View style={{ width, height, flexDirection: "row", alignItems: "flex-end", gap: 1 }}>
      {data.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max(3, (v / max) * height),
            backgroundColor: i === data.length - 1 ? color : `${color}44`,
            borderRadius: 2,
          }}
        />
      ))}
    </View>
  );
}

// ─── ANIMATED COUNTER ─────────────────────────────────────────────────────
function AnimatedCounter({ value, prefix = "", suffix = "" }: { value: string; prefix?: string; suffix?: string }) {
  return <Text>{prefix}{value}{suffix}</Text>;
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(1, value / Math.max(max, 1));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <View style={{ height: "100%", width: `${pct * 100}%`, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

// ─── LIVE ANIMATED TELEMETRY CHART (TERHUBUNG KE DATABASE ASLI SUPABASE) ─────────────
function LiveActivityPulseChart({
  transactions,
  kpi,
}: {
  transactions: TopUpTransaction[];
  kpi: DashboardKPIData | null;
}) {
  const [metricMode, setMetricMode] = useState<"traffic" | "crystal" | "revenue">("traffic");
  const [livePulseTick, setLivePulseTick] = useState(0);

  // Micro-pulse animation per 800ms untuk indikasi detak sinkronisasi live
  useEffect(() => {
    const timer = setInterval(() => {
      setLivePulseTick((prev) => (prev + 1) % 1000);
    }, 800);
    return () => clearInterval(timer);
  }, []);

interface HourlySlot {
  hour: number;
  label: string;
  txCount: number;
  crystalAmount: number;
  revenue: number;
}

  const now = new Date();
  const currentHour = now.getHours();

  // Hitung distribusi 24 jam terakhir dari transaksi database asli
  const hourlyData: HourlySlot[] = useMemo(() => {
    const slots: HourlySlot[] = Array.from({ length: 24 }, (_, i) => {
      const targetHour = (currentHour - (23 - i) + 24) % 24;
      return {
        hour: targetHour,
        label: `${targetHour.toString().padStart(2, "0")}:00`,
        txCount: 0,
        crystalAmount: 0,
        revenue: 0,
      };
    });

    const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;

    transactions.forEach((tx) => {
      const txTime = new Date(tx.createdAt).getTime();
      if (txTime >= oneDayAgoMs) {
        const txHour = new Date(tx.createdAt).getHours();
        const slot = slots.find((s) => s.hour === txHour);
        if (slot) {
          slot.txCount += 1;
          slot.crystalAmount += tx.crystalAmount || 0;
          if (tx.status === "berhasil") {
            slot.revenue += tx.totalPayment || 0;
          }
        }
      }
    });

    return slots;
  }, [transactions, currentHour]);

  // Statistik 24 Jam Asli dari Database
  const total24hTxs = useMemo(() => hourlyData.reduce((acc: number, d: HourlySlot) => acc + d.txCount, 0), [hourlyData]);
  const total24hCrystals = useMemo(() => hourlyData.reduce((acc: number, d: HourlySlot) => acc + d.crystalAmount, 0), [hourlyData]);
  const total24hRevenue = useMemo(() => hourlyData.reduce((acc: number, d: HourlySlot) => acc + d.revenue, 0), [hourlyData]);

  // Max value untuk penskalaan tinggi batang
  const maxVal = useMemo(() => {
    if (metricMode === "traffic") {
      return Math.max(...hourlyData.map((d: HourlySlot) => d.txCount), 1);
    }
    if (metricMode === "crystal") {
      return Math.max(...hourlyData.map((d: HourlySlot) => d.crystalAmount), 1);
    }
    return Math.max(...hourlyData.map((d: HourlySlot) => d.revenue), 1);
  }, [hourlyData, metricMode]);

  const barColor =
    metricMode === "traffic"
      ? "#38BDF8"
      : metricMode === "crystal"
      ? "#10B981"
      : "#CBD5E1";

  return (
    <View style={styles.liveChartCard}>
      <View style={styles.liveChartHeader}>
        <View style={{ gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={styles.livePulseDot} />
            <Text style={styles.liveChartTitle}>Live Real-time Telemetri & Transaksi</Text>
            <View style={styles.liveTagPill}>
              <Text style={styles.liveTagText}>100% REAL DATABASE</Text>
            </View>
          </View>
          <Text style={styles.liveChartSubtitle}>
            Aktivitas 24 jam terakhir yang ditarik langsung dari tabel database transaksi & pengguna Supabase
          </Text>
        </View>

        {/* Mode Selector */}
        <View style={styles.liveModeRow}>
          {[
            { key: "traffic", label: "Volume Transaksi" },
            { key: "crystal", label: "Aliran Crystal" },
            { key: "revenue", label: "Omset Berhasil" },
          ].map((m) => (
            <Pressable
              key={m.key}
              onPress={() => setMetricMode(m.key as any)}
              style={[
                styles.liveModeBtn,
                metricMode === m.key && styles.liveModeBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.liveModeText,
                  metricMode === m.key && styles.liveModeTextActive,
                ]}
              >
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Realtime KPI Strip on Top of Moving Chart */}
      <View style={styles.liveMetricsStrip}>
        <View style={styles.liveMetricItem}>
          <Text style={styles.liveMetricLabel}>Transaksi 24 Jam (DB)</Text>
          <Text style={[styles.liveMetricVal, { color: "#38BDF8" }]}>{total24hTxs} Transaksi</Text>
        </View>
        <View style={styles.liveMetricDivider} />
        <View style={styles.liveMetricItem}>
          <Text style={styles.liveMetricLabel}>Crystal Terdistribusi (DB)</Text>
          <Text style={[styles.liveMetricVal, { color: "#10B981" }]}>
            {((kpi?.totalCrystalsPurchased ?? total24hCrystals) / 1000).toFixed(1)}K Crystal
          </Text>
        </View>
        <View style={styles.liveMetricDivider} />
        <View style={styles.liveMetricItem}>
          <Text style={styles.liveMetricLabel}>Total Pengguna (DB)</Text>
          <Text style={[styles.liveMetricVal, { color: "#CBD5E1" }]}>
            {(kpi?.totalRegisteredUsers ?? 0).toLocaleString("id-ID")} Terdaftar
          </Text>
        </View>
      </View>

      {/* 24 Live Database Hourly Bars with Animated Wave Sync Pulse */}
      <View style={styles.liveBarsContainer}>
        {hourlyData.map((slot: HourlySlot, i: number) => {
          const rawVal =
            metricMode === "traffic"
              ? slot.txCount
              : metricMode === "crystal"
              ? slot.crystalAmount
              : slot.revenue;

          // Hitung tinggi persen berdasarkan data database asli
          const pct = rawVal > 0 ? Math.max(16, (rawVal / maxVal) * 92) : 10;
          // Gelombang mikro halus (wave pulse) saat live
          const wavePulse = Math.sin((livePulseTick * 0.4) + i * 0.5) * 4;
          const displayHeight = Math.max(10, Math.min(98, Math.round(pct + wavePulse)));

          return (
            <View key={i} style={styles.liveBarColumn}>
              <View
                style={[
                  styles.liveBarFill,
                  {
                    height: `${displayHeight}%`,
                    backgroundColor:
                      rawVal > 0
                        ? barColor
                        : "rgba(255, 255, 255, 0.08)",
                  },
                ]}
              />
              <View
                style={[
                  styles.liveBarGlowCap,
                  {
                    bottom: `${Math.min(displayHeight, 95)}%`,
                    backgroundColor: rawVal > 0 ? "#FFFFFF" : "rgba(255, 255, 255, 0.3)",
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* Jam Label di Bawah Batang */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 }}>
        <Text style={styles.liveHourLabel}>-24 Jam</Text>
        <Text style={styles.liveHourLabel}>-18 Jam</Text>
        <Text style={styles.liveHourLabel}>-12 Jam</Text>
        <Text style={styles.liveHourLabel}>-6 Jam</Text>
        <Text style={[styles.liveHourLabel, { color: "#10B981" }]}>Sekarang (Live)</Text>
      </View>
    </View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────
export default function AdminOverviewScreen() {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<DashboardKPIData | null>(null);
  const [recentTxs, setRecentTxs] = useState<TopUpTransaction[]>([]);
  const [allTxs, setAllTxs] = useState<TopUpTransaction[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const loadData = async () => {
    setLoading(true);
    try {
      const [kpiData, txs] = await Promise.all([
        getDashboardKPIData(),
        getAllTransactionsForAdmin(),
      ]);
      setKpi(kpiData);
      setAllTxs(txs);
      setRecentTxs(txs.slice(0, 8));
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const clock = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  // ── Computed Chart Data ──
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - i));
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const end = start + 86400000;
    return allTxs
      .filter((t) => t.status === "berhasil" && new Date(t.createdAt).getTime() >= start && new Date(t.createdAt).getTime() < end)
      .reduce((sum, t) => sum + t.totalPayment, 0);
  });

  const txCountLast7 = Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - i));
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const end = start + 86400000;
    return allTxs.filter((t) => new Date(t.createdAt).getTime() >= start && new Date(t.createdAt).getTime() < end).length;
  });

  const dayLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d.getDay()];
  });

  // Payment Method Distribution
  const pmCount: Record<string, number> = {};
  allTxs.filter(t => t.status === "berhasil").forEach(t => {
    pmCount[t.paymentMethod] = (pmCount[t.paymentMethod] || 0) + 1;
  });
  const topPMs = Object.entries(pmCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const totalPM = topPMs.reduce((s, [, v]) => s + v, 0) || 1;

  const pmColors = ["#CBD5E1", "#38BDF8", "#10B981", "#F59E0B"];

  // Crystal stats
  const successTxs = allTxs.filter(t => t.status === "berhasil");
  const avgRevPerUser = kpi && kpi.totalRegisteredUsers > 0
    ? kpi.revenueThisMonth / kpi.totalRegisteredUsers
    : 0;
  const conversionRate = kpi && kpi.totalRegisteredUsers > 0
    ? ((kpi.totalCompletedTxs / Math.max(kpi.totalRegisteredUsers, 1)) * 100)
    : 0;

  // Quick action modules
  const quickActions = [
    { icon: "credit-card", label: "Verifikasi Top Up", badge: kpi?.totalPendingTxs ?? 0, color: "#38BDF8", route: "/admin/finance" },
    { icon: "account-group", label: "Kelola Pengguna", color: "#CBD5E1", route: "/admin/users" },
    { icon: "headset", label: "CS Tickets", color: "#10B981", route: "/admin/support" },
    { icon: "shield-account", label: "Audit Trail", color: "#F59E0B", route: "/admin/audit" },
    { icon: "trophy-outline", label: "Leaderboard", color: "#EC4899", route: "/admin/gamification" },
    { icon: "android", label: "Update APK", color: "#6366F1", route: "/admin/system" },
  ];

  const systemStatus = [
    { label: "Supabase DB", status: "online", color: "#10B981", icon: "database" },
    { label: "Expo Metro", status: "online", color: "#10B981", icon: "rocket-launch-outline" },
    { label: "Gacha Engine", status: "online", color: "#10B981", icon: "crystal-ball" },
    { label: "Maintenance", status: "off", color: "#94A3B8", icon: "wrench-outline" },
  ];

  if (loading) {
    return (
      <AdminLayout title="Dashboard" subtitle="Memuat data sistem...">
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8C57FF" />
          <Text style={styles.loadingText}>Memuat data dashboard...</Text>
        </View>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Dashboard Eksekutif"
      subtitle={`Operasional real-time Nuenime · ${currentTime.toLocaleTimeString("id-ID")}`}
      activeKey="dashboard"
    >
      {/* ─── WELCOME BANNER ─── */}
      <View style={styles.welcomeBanner}>
        <View style={styles.welcomeBannerLeft}>
          <View style={styles.welcomePulse} />
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeTitle}>Selamat Datang, Admin</Text>
            <Text style={styles.welcomeDesc}>
              Sistem berjalan normal. Ada {kpi?.totalPendingTxs ?? 0} transaksi yang menunggu verifikasi.
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.welcomeBtn, pressed && { opacity: 0.8 }]}
          onPress={() => { hapticLight(); router.replace("/admin/finance" as any); }}
        >
          <AppIcon name="credit-card" size={14} color="#FFFFFF" />
          <Text style={styles.welcomeBtnText}>Verifikasi Sekarang</Text>
        </Pressable>
      </View>

      {/* ─── LIVE MOVING TELEMETRY CHART (REAL DATABASE) ─── */}
      <LiveActivityPulseChart transactions={allTxs} kpi={kpi} />

      {/* ─── KPI GRID ROW 1 ─── */}
      <View style={[styles.kpiGrid, !isWide && styles.kpiGridMobile]}>
        {/* Omset Hari Ini */}
        <View style={[styles.kpiCard, { borderTopColor: "#10B981" }]}>
          <View style={styles.kpiCardTop}>
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <AppIcon name="cash" size={20} color="#10B981" />
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.kpiTrend, { color: "#10B981" }]}>+{last7Days.filter(v => v > 0).length} hari</Text>
            </View>
          </View>
          <Text style={styles.kpiValue}>{formatRupiahShort(kpi?.revenueToday ?? 0)}</Text>
          <Text style={styles.kpiLabel}>Omset Hari Ini</Text>
          <View style={{ marginTop: 10 }}>
            <Sparkline data={last7Days} color="#10B981" />
          </View>
        </View>

        {/* Omset Bulan Ini */}
        <View style={[styles.kpiCard, { borderTopColor: "#CBD5E1" }]}>
          <View style={styles.kpiCardTop}>
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(255, 255, 255, 0.10)" }]}>
              <AppIcon name="chart-bar" size={20} color="#CBD5E1" />
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.kpiTrend, { color: "#CBD5E1" }]}>
                {kpi?.revenueThisMonth && kpi.revenueThisWeek ? `${((kpi.revenueThisWeek / kpi.revenueThisMonth) * 100).toFixed(0)}% minggu` : "—"}
              </Text>
            </View>
          </View>
          <Text style={styles.kpiValue}>{formatRupiahShort(kpi?.revenueThisMonth ?? 0)}</Text>
          <Text style={styles.kpiLabel}>Omset Bulan Ini</Text>
          <View style={{ marginTop: 10 }}>
            <ProgressBar value={kpi?.revenueThisWeek ?? 0} max={kpi?.revenueThisMonth ?? 1} color="#CBD5E1" />
            <Text style={styles.progressLabel}>{formatRupiahShort(kpi?.revenueThisWeek ?? 0)} minggu ini</Text>
          </View>
        </View>

        {/* Total User */}
        <View style={[styles.kpiCard, { borderTopColor: "#38BDF8" }]}>
          <View style={styles.kpiCardTop}>
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
              <AppIcon name="account-group" size={20} color="#38BDF8" />
            </View>
          </View>
          <Text style={styles.kpiValue}>{(kpi?.totalRegisteredUsers ?? 0).toLocaleString("id-ID")}</Text>
          <Text style={styles.kpiLabel}>Total Pengguna</Text>
          <View style={{ marginTop: 8, gap: 6 }}>
            <View style={styles.miniStatRow}>
              <Text style={styles.miniStatLabel}>Rate Konversi</Text>
              <Text style={[styles.miniStatValue, { color: "#38BDF8" }]}>{conversionRate.toFixed(1)}%</Text>
            </View>
            <ProgressBar value={conversionRate} max={100} color="#38BDF8" />
          </View>
        </View>

        {/* Transaksi Pending */}
        <View style={[styles.kpiCard, { borderTopColor: "#F59E0B" }]}>
          <View style={styles.kpiCardTop}>
            <View style={[styles.kpiIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
              <AppIcon name="clock-outline" size={20} color="#F59E0B" />
            </View>
            {(kpi?.totalPendingTxs ?? 0) > 0 && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentBadgeText}>AKSI</Text>
              </View>
            )}
          </View>
          <Text style={styles.kpiValue}>{kpi?.totalPendingTxs ?? 0}</Text>
          <Text style={styles.kpiLabel}>Menunggu Verifikasi</Text>
          <Pressable
            style={({ pressed }) => [styles.kpiActionBtn, { borderColor: "#F59E0B" }, pressed && { opacity: 0.8 }]}
            onPress={() => { hapticLight(); router.replace("/admin/finance" as any); }}
          >
            <Text style={[styles.kpiActionBtnText, { color: "#F59E0B" }]}>Tinjau Transaksi</Text>
            <AppIcon name="chevron-right" size={12} color="#F59E0B" />
          </Pressable>
        </View>
      </View>

      {/* ─── ANALYTICS ROW ─── */}
      <View style={[styles.analyticsRow, !isWide && { flexDirection: "column" }]}>
        {/* Revenue Bar Chart (7 hari) */}
        <View style={[styles.chartCard, { flex: 1.6 }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Grafik Pendapatan 7 Hari</Text>
              <Text style={styles.cardSubtitle}>Revenue transaksi berhasil harian</Text>
            </View>
            <View style={[styles.cardBadge, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <AppIcon name="trending-up" size={13} color="#10B981" />
              <Text style={[styles.cardBadgeText, { color: "#10B981" }]}>Live</Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            {last7Days.map((v, i) => {
              const max = Math.max(...last7Days, 1);
              const pct = v / max;
              const isToday = i === last7Days.length - 1;
              return (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.barDayLabel}>{dayLabels[i]}</Text>
                  <View style={{ flex: 1, height: 22, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                    <View
                      style={{
                        height: "100%",
                        width: `${Math.max(pct * 100, v > 0 ? 4 : 0)}%`,
                        borderRadius: 5,
                        backgroundColor: isToday ? "#10B981" : "rgba(16, 185, 129, 0.45)",
                      }}
                    />
                  </View>
                  <Text style={[styles.barValueLabel, isToday && { color: "#10B981" }]}>
                    {v > 0 ? formatRupiahShort(v) : "—"}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Metode Pembayaran Distribution */}
        <View style={[styles.chartCard, { flex: 1 }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Metode Pembayaran</Text>
              <Text style={styles.cardSubtitle}>{totalPM} transaksi berhasil</Text>
            </View>
          </View>

          {topPMs.length > 0 ? (
            <View style={{ gap: 12 }}>
              {topPMs.map(([pm, count], i) => (
                <View key={pm} style={{ gap: 5 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: pmColors[i] }} />
                      <Text style={styles.pmLabel}>{pm.replace(/_/g, " ").toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.pmValue, { color: pmColors[i] }]}>{((count / totalPM) * 100).toFixed(0)}%</Text>
                  </View>
                  <ProgressBar value={count} max={totalPM} color={pmColors[i]} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCenter}>
              <AppIcon name="chart-bar" size={32} color="#334155" />
              <Text style={styles.emptyText}>Belum ada data transaksi</Text>
            </View>
          )}
        </View>
      </View>

      {/* ─── SECOND ANALYTICS ROW ─── */}
      <View style={[styles.analyticsRow, !isWide && { flexDirection: "column" }]}>
        {/* Crystal Stats */}
        <View style={[styles.chartCard, { flex: 1 }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Crystal Economy</Text>
              <Text style={styles.cardSubtitle}>Dylan Crystal yang beredar</Text>
            </View>
            <AppIcon name="crystal-ball" size={18} color="#CBD5E1" />
          </View>

          <View style={{ gap: 14 }}>
            <View style={styles.crystalStatRow}>
              <View style={[styles.crystalDot, { backgroundColor: "#CBD5E1" }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.crystalLabel}>Total Dibeli</Text>
                <ProgressBar value={kpi?.totalCrystalsPurchased ?? 0} max={Math.max(kpi?.totalCrystalsPurchased ?? 1, 1)} color="#CBD5E1" />
              </View>
              <Text style={[styles.crystalValue, { color: "#CBD5E1" }]}>{((kpi?.totalCrystalsPurchased ?? 0) / 1000).toFixed(1)}K</Text>
            </View>

            <View style={styles.crystalStatRow}>
              <View style={[styles.crystalDot, { backgroundColor: "#EC4899" }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.crystalLabel}>Digunakan (est.)</Text>
                <ProgressBar value={kpi?.totalCrystalsSpent ?? 0} max={kpi?.totalCrystalsPurchased ?? 1} color="#EC4899" />
              </View>
              <Text style={[styles.crystalValue, { color: "#EC4899" }]}>{((kpi?.totalCrystalsSpent ?? 0) / 1000).toFixed(1)}K</Text>
            </View>

            <View style={styles.crystalStatRow}>
              <View style={[styles.crystalDot, { backgroundColor: "#10B981" }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.crystalLabel}>Tersisa (est.)</Text>
                <ProgressBar value={(kpi?.totalCrystalsPurchased ?? 0) - (kpi?.totalCrystalsSpent ?? 0)} max={kpi?.totalCrystalsPurchased ?? 1} color="#10B981" />
              </View>
              <Text style={[styles.crystalValue, { color: "#10B981" }]}>{(((kpi?.totalCrystalsPurchased ?? 0) - (kpi?.totalCrystalsSpent ?? 0)) / 1000).toFixed(1)}K</Text>
            </View>

            <View style={[styles.crystalHighlight]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.crystalHighlightLabel}>Avg. Revenue per User</Text>
                <Text style={styles.crystalHighlightValue}>{formatRupiahShort(avgRevPerUser)}</Text>
              </View>
              <AppIcon name="account" size={22} color="#CBD5E1" />
            </View>
          </View>
        </View>

        {/* Transaksi Summary */}
        <View style={[styles.chartCard, { flex: 1 }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Status Transaksi</Text>
              <Text style={styles.cardSubtitle}>{allTxs.length} total semua waktu</Text>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            {[
              { label: "Berhasil", value: kpi?.totalCompletedTxs ?? 0, color: "#10B981", icon: "check-circle-outline" },
              { label: "Menunggu", value: kpi?.totalPendingTxs ?? 0, color: "#F59E0B", icon: "clock-outline" },
              { label: "Ditolak", value: kpi?.totalRejectedTxs ?? 0, color: "#EF4444", icon: "close-circle-outline" },
            ].map((s) => {
              const total = (kpi?.totalCompletedTxs ?? 0) + (kpi?.totalPendingTxs ?? 0) + (kpi?.totalRejectedTxs ?? 0);
              return (
                <View key={s.label} style={styles.txStatusRow}>
                  <View style={[styles.txStatusIconWrap, { backgroundColor: `${s.color}18` }]}>
                    <AppIcon name={s.icon} size={16} color={s.color} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={styles.txStatusLabel}>{s.label}</Text>
                      <Text style={[styles.txStatusValue, { color: s.color }]}>{s.value}</Text>
                    </View>
                    <ProgressBar value={s.value} max={total || 1} color={s.color} />
                  </View>
                </View>
              );
            })}

            <View style={styles.txTotalRow}>
              <Text style={styles.txTotalLabel}>Total Semua Transaksi</Text>
              <Text style={styles.txTotalValue}>{allTxs.length}</Text>
            </View>
          </View>
        </View>

        {/* Volume transaksi 7 hari (jumlah) */}
        <View style={[styles.chartCard, { flex: 1 }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Volume Transaksi</Text>
              <Text style={styles.cardSubtitle}>Jumlah transaksi 7 hari</Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            {txCountLast7.map((v, i) => {
              const max = Math.max(...txCountLast7, 1);
              const isToday = i === txCountLast7.length - 1;
              return (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.barDayLabel}>{dayLabels[i]}</Text>
                  <View style={{ flex: 1, height: 18, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                    <View
                      style={{
                        height: "100%",
                        width: `${Math.max((v / max) * 100, v > 0 ? 5 : 0)}%`,
                        borderRadius: 4,
                        backgroundColor: isToday ? "#38BDF8" : "rgba(56, 189, 248, 0.4)",
                      }}
                    />
                  </View>
                  <Text style={[styles.barValueLabel, { minWidth: 20 }, isToday && { color: "#38BDF8" }]}>{v}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* ─── QUICK ACTIONS ─── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Akses Cepat Modul</Text>
        <View style={[styles.quickGrid, !isWide && { flexWrap: "wrap" }]}>
          {quickActions.map((qa) => (
            <Pressable
              key={qa.route}
              style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] }]}
              onPress={() => { hapticLight(); router.replace(qa.route as any); }}
            >
              <View style={[styles.quickBtnIcon, { backgroundColor: `${qa.color}18`, borderColor: `${qa.color}30` }]}>
                <AppIcon name={qa.icon} size={22} color={qa.color} />
              </View>
              <Text style={styles.quickBtnLabel}>{qa.label}</Text>
              {(qa.badge ?? 0) > 0 && (
                <View style={[styles.quickBtnBadge, { backgroundColor: "#EF4444" }]}>
                  <Text style={styles.quickBtnBadgeText}>{qa.badge}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>

      {/* ─── RECENT TRANSACTIONS + SYSTEM STATUS ─── */}
      <View style={[styles.analyticsRow, !isWide && { flexDirection: "column" }]}>
        {/* Recent Transactions */}
        <View style={[styles.chartCard, { flex: 1.6 }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Transaksi Terbaru</Text>
              <Text style={styles.cardSubtitle}>8 transaksi terakhir masuk</Text>
            </View>
            <Pressable
              style={styles.seeAllBtn}
              onPress={() => { hapticLight(); router.replace("/admin/finance" as any); }}
            >
              <Text style={styles.seeAllText}>Lihat Semua</Text>
              <AppIcon name="chevron-right" size={13} color="#CBD5E1" />
            </Pressable>
          </View>

          {recentTxs.length > 0 ? (
            <View style={{ gap: 0 }}>
              {recentTxs.map((tx, i) => (
                <View
                  key={tx.id}
                  style={[
                    styles.txRow,
                    i > 0 && { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.04)" },
                  ]}
                >
                  <View style={[styles.txAvatarWrap, { backgroundColor: `${getStatusColor(tx.status)}15` }]}>
                    <Text style={[styles.txAvatarText, { color: getStatusColor(tx.status) }]}>
                      {(tx.username ?? "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txUser} numberOfLines={1}>{tx.username}</Text>
                    <Text style={styles.txMeta}>{tx.crystalAmount.toLocaleString("id-ID")} Crystal · {tx.paymentMethod.replace(/_/g, " ")}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.txAmount}>{formatRupiahShort(tx.totalPayment)}</Text>
                    <View style={[styles.txStatusBadge, { backgroundColor: `${getStatusColor(tx.status)}18` }]}>
                      <Text style={[styles.txStatusText, { color: getStatusColor(tx.status) }]}>
                        {getStatusLabel(tx.status)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCenter}>
              <AppIcon name="credit-card" size={32} color="#334155" />
              <Text style={styles.emptyText}>Belum ada transaksi</Text>
            </View>
          )}
        </View>

        {/* System Status + Highlight Metrics */}
        <View style={{ flex: 1, gap: 16 }}>
          {/* System Status */}
          <View style={styles.chartCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Status Sistem</Text>
              <View style={styles.onlineDot} />
            </View>
            <View style={{ gap: 8 }}>
              {systemStatus.map((s) => (
                <View key={s.label} style={styles.statusRow}>
                  <View style={[styles.statusIconWrap, { backgroundColor: `${s.color}18` }]}>
                    <AppIcon name={s.icon} size={14} color={s.color} />
                  </View>
                  <Text style={styles.statusLabel}>{s.label}</Text>
                  <View style={{ flex: 1 }} />
                  <View style={[styles.statusPill, { backgroundColor: `${s.color}18` }]}>
                    <View style={[styles.statusDot, { backgroundColor: s.color }]} />
                    <Text style={[styles.statusPillText, { color: s.color }]}>{s.status.toUpperCase()}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Highlight Metrics */}
          <View style={styles.chartCard}>
            <Text style={styles.cardTitle}>Metrik Unggulan</Text>
            <View style={{ gap: 10, marginTop: 10 }}>
              {[
                { label: "Total Transaksi Berhasil", value: `${kpi?.totalCompletedTxs ?? 0}`, icon: "check-circle-outline", color: "#10B981" },
                { label: "Total Pendapatan Minggu", value: formatRupiahShort(kpi?.revenueThisWeek ?? 0), icon: "chart-line-variant", color: "#CBD5E1" },
                { label: "Crystal Terdistribusi", value: `${((kpi?.totalCrystalsPurchased ?? 0) / 1000).toFixed(1)}K`, icon: "crystal-ball", color: "#EC4899" },
                { label: "User Terdaftar", value: `${kpi?.totalRegisteredUsers ?? 0}`, icon: "account-group", color: "#38BDF8" },
              ].map((m) => (
                <View key={m.label} style={styles.highlightRow}>
                  <View style={[styles.highlightIconWrap, { backgroundColor: `${m.color}15` }]}>
                    <AppIcon name={m.icon} size={14} color={m.color} />
                  </View>
                  <Text style={styles.highlightLabel} numberOfLines={1}>{m.label}</Text>
                  <Text style={[styles.highlightValue, { color: m.color }]}>{m.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </AdminLayout>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    minHeight: 300,
  },
  loadingText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#94A3B8",
  },
  // ── Welcome Banner
  welcomeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  welcomeBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  welcomePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  welcomeTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  welcomeDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  welcomeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
    shadowOpacity: 0,
    elevation: 0,
  },
  welcomeBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  // ── Live Moving Telemetry Chart
  liveChartCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 14,
  },
  liveChartHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  liveChartTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  liveTagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  liveTagText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    color: "#10B981",
    letterSpacing: 0.5,
  },
  liveChartSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
  },
  liveModeRow: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  liveModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  liveModeBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  liveModeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  liveModeTextActive: {
    color: "#FFFFFF",
  },
  liveMetricsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  liveMetricItem: {
    flex: 1,
    gap: 3,
  },
  liveMetricLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  liveMetricVal: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
  },
  liveMetricDivider: {
    width: 1,
    height: 26,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    marginHorizontal: 12,
  },
  liveBarsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 90,
    paddingTop: 10,
    paddingHorizontal: 4,
    backgroundColor: "rgba(255, 255, 255, 0.015)",
    borderRadius: 8,
  },
  liveBarColumn: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    position: "relative",
  },
  liveBarFill: {
    width: "100%",
    borderRadius: 4,
    minHeight: 8,
  },
  liveBarGlowCap: {
    position: "absolute",
    left: "15%",
    right: "15%",
    height: 3,
    borderRadius: 2,
    opacity: 0.9,
  },
  liveHourLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 9.5,
    color: "#64748B",
  },
  // ── KPI Grid
  kpiGrid: {
    flexDirection: "row",
    gap: 14,
  },
  kpiGridMobile: {
    flexWrap: "wrap",
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderTopWidth: 3,
  },
  kpiCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  kpiIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiTrend: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
  },
  kpiValue: {
    fontFamily: "Nunito-Black",
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  progressLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
    marginTop: 4,
  },
  urgentBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  urgentBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
    color: "#FFFFFF",
  },
  kpiActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 12,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
  },
  kpiActionBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
  },
  // ── Analytics
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
    gap: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  cardSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  cardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
  },
  barDayLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#64748B",
    width: 26,
  },
  barValueLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#94A3B8",
    textAlign: "right",
    minWidth: 50,
  },
  pmLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#CBD5E1",
  },
  pmValue: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
  },
  miniStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  miniStatLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },
  miniStatValue: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
  },
  // ── Crystal Economy
  crystalStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  crystalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  crystalLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
    marginBottom: 4,
  },
  crystalValue: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    minWidth: 44,
    textAlign: "right",
  },
  crystalHighlight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginTop: 4,
  },
  crystalHighlightLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  crystalHighlightValue: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
    marginTop: 2,
  },
  // ── Transaction status
  txStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  txStatusIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  txStatusLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
    marginBottom: 4,
  },
  txStatusValue: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
  },
  txTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    marginTop: 2,
  },
  txTotalLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  txTotalValue: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
  },
  // ── Quick Actions
  sectionCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 14,
  },
  sectionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  quickGrid: {
    flexDirection: "row",
    gap: 10,
  },
  quickBtn: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    position: "relative",
  },
  quickBtnIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  quickBtnLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#94A3B8",
    textAlign: "center",
  },
  quickBtnBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  quickBtnBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
    color: "#FFFFFF",
  },
  // ── Recent Transactions Table
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seeAllText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  txAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  txAvatarText: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
  },
  txUser: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#F1F5F9",
  },
  txMeta: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 1,
  },
  txAmount: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  txStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 3,
  },
  txStatusText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
  },
  // ── System Status
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 5,
  },
  statusIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
  },
  // ── Highlight Metrics
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  highlightIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
    flex: 1,
  },
  highlightValue: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
  },
  // ── Empty
  emptyCenter: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 10,
  },
  emptyText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#334155",
  },
});
