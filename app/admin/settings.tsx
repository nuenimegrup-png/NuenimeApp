import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AdminLayout } from "@/components/admin/admin-layout";
import { supabase } from "@/lib/supabase";
import { AppIcon } from "@/components/app-icon";
import { readNsfwPreference, writeAdminNsfwPreference } from "@/lib/nsfw-preference";

export default function AdminSettingsScreen() {
  const [supabaseStatus, setSupabaseStatus] = useState<"checking" | "connected" | "fallback">("checking");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [nsfwEnabled, setNsfwEnabled] = useState(false);
  const [savingNsfw, setSavingNsfw] = useState(false);

  const checkConnection = async () => {
    setSupabaseStatus("checking");
    const t0 = Date.now();
    try {
      const { data, error } = await supabase.from("profiles").select("id").limit(1);
      const diff = Date.now() - t0;
      setLatencyMs(diff);
      if (error) {
        setSupabaseStatus("fallback");
      } else {
        setSupabaseStatus("connected");
      }
    } catch {
      setSupabaseStatus("fallback");
    }
  };

  useEffect(() => {
    checkConnection();
    readNsfwPreference().then((val) => setNsfwEnabled(val));
  }, []);

  const handleToggleNsfw = async (val: boolean) => {
    setNsfwEnabled(val);
    setSavingNsfw(true);
    const res = await writeAdminNsfwPreference(val);
    setSavingNsfw(false);
    if (res.success) {
      setFeedback(
        val
          ? "Filter Konten 18+ diaktifkan! Pengguna sekarang dapat melihat anime dewasa."
          : "Filter Konten 18+ dinonaktifkan! Seluruh anime dewasa disembunyikan dari aplikasi."
      );
      setTimeout(() => setFeedback(null), 4000);
    } else {
      alert(res.error || "Gagal mengubah konfigurasi konten");
      setNsfwEnabled(!val);
    }
  };

  const handleClearCache = async () => {
    if (confirm("Reset data cache lokal admin?")) {
      const keys = await AsyncStorage.getAllKeys();
      const adminKeys = keys.filter((k) => k.startsWith("nuenime.admin."));
      for (const k of adminKeys) {
        await AsyncStorage.removeItem(k);
      }
      setFeedback("Cache lokal admin berhasil dibersihkan!");
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <AdminLayout activeKey="settings" title="Settings">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>System Settings & Connectivity</Text>
            <Text style={styles.subtitle}>
              Status infrastruktur backend Supabase, variabel lingkungan runtime, dan konfigurasi platform.
            </Text>
          </View>
        </View>

        {feedback && (
          <View style={styles.feedbackBanner}>
            <AppIcon name="check-circle" size={18} color="#10B981" />
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        )}

        {/* KONTROL GLOBAL KONTEN 18+ (DEWASA) */}
        <View style={[styles.card, { marginBottom: 20 }]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={styles.safetyIconBox}>
                <AppIcon name="shield-lock" size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.cardTitle}>Filter Konten 18+ (Dewasa / Ecchi)</Text>
                  <View style={styles.nsfwTagPill}>
                    <Text style={styles.nsfwTagText}>18+</Text>
                  </View>
                </View>
                <Text style={styles.cardDesc}>
                  Kontrol pusat filter konten dewasa untuk seluruh pengguna aplikasi Nuenime. Pengguna biasa tidak dapat mengubah pengaturan ini sendiri.
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {savingNsfw && <ActivityIndicator size="small" color="#EF4444" />}
              <Switch
                value={nsfwEnabled}
                onValueChange={handleToggleNsfw}
                trackColor={{ false: "#27272A", true: "#EF4444" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={[styles.statusBox, { backgroundColor: nsfwEnabled ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)", borderColor: nsfwEnabled ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AppIcon name={nsfwEnabled ? "alert-circle" : "check-circle"} size={16} color={nsfwEnabled ? "#EF4444" : "#10B981"} />
              <Text style={{ fontFamily: "Nunito-Bold", fontSize: 13, color: nsfwEnabled ? "#FCA5A5" : "#6EE7B7" }}>
                {nsfwEnabled
                  ? "STATUS: KONTEN 18+ AKTIF (DITAMPILKAN)"
                  : "STATUS: MODE AMAN AKTIF (18+ DISEMBUNYIKAN)"}
              </Text>
            </View>
            <Text style={{ fontFamily: "Nunito-Regular", fontSize: 12, color: "#CBD5E1", marginTop: 4, lineHeight: 17 }}>
              {nsfwEnabled
                ? "Semua anime termasuk kategori dewasa/ecchi/18+ sedang ditampilkan kepada seluruh pengguna di halaman katalog, pencarian, dan rekomendasi acak."
                : "Semua anime berkategori dewasa/ecchi/18+ otomatis disembunyikan dari aplikasi untuk seluruh pengguna secara global (Ramah semua umur)."}
            </Text>
          </View>
        </View>

        {/* SUPABASE CONNECTION STATUS */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <AppIcon name="database" size={22} color="#8C57FF" />
              <View>
                <Text style={styles.cardTitle}>Status Database & Storage Supabase</Text>
                <Text style={styles.cardDesc}>
                  Pemeriksaan koneksi realtime ke Postgres cluster Supabase Nuenime.
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.refreshBtn} onPress={checkConnection}>
              <AppIcon name="refresh" size={14} color="#CBD5E1" />
              <Text style={styles.refreshBtnText}>Uji Ulang Koneksi</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statusBox}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status Koneksi:</Text>
              <View
                style={[
                  styles.badge,
                  supabaseStatus === "connected" && styles.badgeSuccess,
                  supabaseStatus === "fallback" && styles.badgeWarning,
                  supabaseStatus === "checking" && styles.badgeNeutral,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    supabaseStatus === "connected" && { color: "#10B981" },
                    supabaseStatus === "fallback" && { color: "#F59E0B" },
                    supabaseStatus === "checking" && { color: "#94A3B8" },
                  ]}
                >
                  {supabaseStatus === "connected"
                    ? "TERHUBUNG (ONLINE SUPABASE)"
                    : supabaseStatus === "fallback"
                    ? "STANDBY (LOCAL PERSISTENT MODE)"
                    : "MEMERIKSA..."}
                </Text>
              </View>
            </View>

            {latencyMs !== null && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Latensi Respon:</Text>
                <Text style={styles.statusValue}>{latencyMs} ms</Text>
              </View>
            )}

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Supabase Endpoint:</Text>
              <Text style={styles.statusValue}>
                {process.env.EXPO_PUBLIC_SUPABASE_URL || "Terkonfigurasi di file .env"}
              </Text>
            </View>
          </View>
        </View>

        {/* ENVIRONMENT VARIABLES INSPECTOR */}
        <View style={[styles.card, { marginTop: 24 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <AppIcon name="cog" size={22} color="#38BDF8" />
            <View>
              <Text style={styles.cardTitle}>Variabel Lingkungan Aplikasi (Public Envs)</Text>
              <Text style={styles.cardDesc}>
                Memeriksa apakah konfigurasi sisi klien terdeteksi dengan benar tanpa membocorkan secret backend.
              </Text>
            </View>
          </View>

          <View style={styles.envTable}>
            <View style={styles.envRow}>
              <Text style={styles.envKey}>EXPO_PUBLIC_SUPABASE_URL</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <AppIcon
                  name={process.env.EXPO_PUBLIC_SUPABASE_URL ? "check" : "close"}
                  size={13}
                  color={process.env.EXPO_PUBLIC_SUPABASE_URL ? "#10B981" : "#94A3B8"}
                />
                <Text style={styles.envStatus}>
                  {process.env.EXPO_PUBLIC_SUPABASE_URL ? "Terpasang" : "Belum disetel"}
                </Text>
              </View>
            </View>

            <View style={styles.envRow}>
              <Text style={styles.envKey}>EXPO_PUBLIC_SUPABASE_ANON_KEY</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <AppIcon
                  name={process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? "check" : "close"}
                  size={13}
                  color={process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? "#10B981" : "#94A3B8"}
                />
                <Text style={styles.envStatus}>
                  {process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? "Terpasang (Masked)" : "Belum disetel"}
                </Text>
              </View>
            </View>

            <View style={styles.envRow}>
              <Text style={styles.envKey}>EXPO_PUBLIC_ADMIN_WHATSAPP</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <AppIcon
                  name={process.env.EXPO_PUBLIC_ADMIN_WHATSAPP ? "check" : "close"}
                  size={13}
                  color={process.env.EXPO_PUBLIC_ADMIN_WHATSAPP ? "#10B981" : "#94A3B8"}
                />
                <Text style={styles.envStatus}>
                  {process.env.EXPO_PUBLIC_ADMIN_WHATSAPP ? "Terpasang" : "Default (Kosong)"}
                </Text>
              </View>
            </View>

            <View style={styles.envRow}>
              <Text style={styles.envKey}>EXPO_PUBLIC_QRIS_URL</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <AppIcon
                  name={process.env.EXPO_PUBLIC_QRIS_URL ? "check" : "close"}
                  size={13}
                  color={process.env.EXPO_PUBLIC_QRIS_URL ? "#10B981" : "#94A3B8"}
                />
                <Text style={styles.envStatus}>
                  {process.env.EXPO_PUBLIC_QRIS_URL ? "Terpasang" : "Default (Kosong)"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* CACHE PURGE */}
        <View style={[styles.card, { marginTop: 24 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <AppIcon name="trash-can-outline" size={22} color="#EF4444" />
            <View>
              <Text style={styles.cardTitle}>Pembersihan Cache Lokal</Text>
              <Text style={styles.cardDesc}>
                Gunakan tombol ini saat ingin menguji ulang state default tanpa memengaruhi database pusat.
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.dangerBtn} onPress={handleClearCache}>
            <Text style={styles.dangerBtnText}>Bersihkan Cache Lokal Admin</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
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
  feedbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10B981",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  feedbackText: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.15)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  cardDesc: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 2,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  refreshBtnText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
  },
  statusBox: {
    backgroundColor: "#14121F",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  statusLabel: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "600",
  },
  statusValue: {
    fontSize: 13,
    color: "#F8FAFC",
    fontFamily: "monospace",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  badgeWarning: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  badgeNeutral: {
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  envTable: {
    backgroundColor: "#14121F",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  envRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  envKey: {
    fontSize: 13,
    color: "#CBD5E1",
    fontFamily: "monospace",
  },
  envStatus: {
    fontSize: 12,
    color: "#38BDF8",
    fontWeight: "600",
  },
  dangerBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "#EF4444",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  dangerBtnText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "700",
  },
  safetyIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  nsfwTagPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  nsfwTagText: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});
