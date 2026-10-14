import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  type AuditLogItem,
  getAdminAuditLogs,
  type AdminRole,
} from "@/lib/admin-service";
import { AppIcon } from "@/components/app-icon";

export default function AdminAuditScreen() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [inspectItem, setInspectItem] = useState<AuditLogItem | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const list = await getAdminAuditLogs();
        setLogs(list);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (selectedRole !== "all" && log.adminRole !== selectedRole) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.adminEmail.toLowerCase().includes(q) ||
        log.targetType.toLowerCase().includes(q) ||
        log.targetId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <AdminLayout activeKey="audit" title="Admin Roles & Audit Logs">
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Admin Roles & Audit Trail</Text>
            <Text style={styles.subtitle}>
              Rekam jejak setiap aksi krusial staf: persetujuan keuangan, perubahan saldo, moderasi, dan konfigurasi sistem.
            </Text>
          </View>
        </View>

        {/* ROLES REFERENCE CARDS */}
        <View style={styles.rolesGrid}>
          <View style={styles.roleCard}>
            <View style={[styles.roleIconWrap, { backgroundColor: "rgba(140, 87, 255, 0.15)" }]}>
              <AppIcon name="shield-check-outline" size={20} color="#8C57FF" />
            </View>
            <Text style={styles.roleName}>Super Admin</Text>
            <Text style={styles.roleDesc}>
              Akses penuh ke 13 modul. Dapat mengubah gateway pembayaran, rilis APK, maintenance mode, dan mengelola role staf.
            </Text>
            <View style={styles.permList}>
              <Text style={styles.permItem}>✓ Finance & Transaksi</Text>
              <Text style={styles.permItem}>✓ User & Saldo Manual</Text>
              <Text style={styles.permItem}>✓ System & APK Rilis</Text>
            </View>
          </View>

          <View style={styles.roleCard}>
            <View style={[styles.roleIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
              <AppIcon name="cog" size={20} color="#38BDF8" />
            </View>
            <Text style={styles.roleName}>Finance / CS Admin</Text>
            <Text style={styles.roleDesc}>
              Fokus pada verifikasi transaksi Top Up, antrean tiket CS, koreksi saldo dengan alasan wajib, dan laporan omset.
            </Text>
            <View style={styles.permList}>
              <Text style={styles.permItem}>✓ Verifikasi Top Up</Text>
              <Text style={styles.permItem}>✓ Tiket Bantuan CS</Text>
              <Text style={styles.permItem}>✕ Kunci Sistem & APK</Text>
            </View>
          </View>

          <View style={styles.roleCard}>
            <View style={[styles.roleIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <AppIcon name="shield-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.roleName}>Moderator Komunitas</Text>
            <Text style={styles.roleDesc}>
              Menangani feed komentar anime, menghapus konten spam / toxic, mendaftar word blacklist, dan mute akun pelanggar.
            </Text>
            <View style={styles.permList}>
              <Text style={styles.permItem}>✓ Hapus Komentar</Text>
              <Text style={styles.permItem}>✓ Word Blacklist</Text>
              <Text style={styles.permItem}>✕ Akses Keuangan Tertutup</Text>
            </View>
          </View>
        </View>

        {/* AUDIT LOG TABLE CARD */}
        <View style={styles.card}>
          <View style={styles.tableHeader}>
            <View>
              <Text style={styles.cardTitle}>Catatan Audit Aktivitas ({filteredLogs.length})</Text>
              <Text style={styles.cardDesc}>
                Terlindungi dan tersimpan secara berurutan waktu (immutable audit trail).
              </Text>
            </View>

            <View style={styles.filterRow}>
              <View style={styles.searchBox}>
                <AppIcon name="search" size={14} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari aksi, admin, atau target..."
                  placeholderTextColor="#64748B"
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              <View style={styles.roleFilterGroup}>
                {(["all", "super_admin", "finance_admin", "moderator"] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleFilterBtn, selectedRole === r && styles.roleFilterBtnActive]}
                    onPress={() => setSelectedRole(r)}
                  >
                    <Text
                      style={[
                        styles.roleFilterBtnText,
                        selectedRole === r && styles.roleFilterBtnTextActive,
                      ]}
                    >
                      {r === "all" ? "Semua Role" : r.replace("_", " ")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color="#8C57FF" style={{ marginVertical: 40 }} />
          ) : filteredLogs.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada aktivitas audit log yang tercatat.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.thRow}>
                <Text style={[styles.th, { flex: 1.5 }]}>Waktu Log</Text>
                <Text style={[styles.th, { flex: 1.8 }]}>Pelaksana Admin</Text>
                <Text style={[styles.th, { flex: 1.6 }]}>Tindakan</Text>
                <Text style={[styles.th, { flex: 1.4 }]}>Target</Text>
                <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Detail</Text>
              </View>

              {filteredLogs.map((item) => (
                <View key={item.id} style={styles.trRow}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.logTime}>
                      {new Date(item.createdAt).toLocaleString("id-ID")}
                    </Text>
                    <Text style={styles.logId}>{item.id}</Text>
                  </View>

                  <View style={{ flex: 1.8 }}>
                    <Text style={styles.adminEmail}>{item.adminEmail}</Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{item.adminRole.replace("_", " ").toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={{ flex: 1.6 }}>
                    <View style={styles.actionPill}>
                      <Text style={styles.actionPillText}>{item.action}</Text>
                    </View>
                  </View>

                  <View style={{ flex: 1.4 }}>
                    <Text style={styles.targetType}>{item.targetType}</Text>
                    <Text style={styles.targetId} numberOfLines={1}>
                      {item.targetId}
                    </Text>
                  </View>

                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <TouchableOpacity
                      style={styles.detailBtn}
                      onPress={() => setInspectItem(item)}
                    >
                      <AppIcon name="eye-outline" size={14} color="#8C57FF" />
                      <Text style={styles.detailBtnText}>Lihat</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* MODAL INSPECT AUDIT ITEM */}
        <Modal visible={!!inspectItem} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Detail Catatan Audit</Text>

              {inspectItem && (
                <View style={styles.modalContent}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>ID Log:</Text>
                    <Text style={styles.metaVal}>{inspectItem.id}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Admin:</Text>
                    <Text style={styles.metaVal}>
                      {inspectItem.adminEmail} ({inspectItem.adminRole})
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Aksi:</Text>
                    <Text style={[styles.metaVal, { color: "#8C57FF", fontWeight: "700" }]}>
                      {inspectItem.action}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Target:</Text>
                    <Text style={styles.metaVal}>
                      {inspectItem.targetType} ({inspectItem.targetId})
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Waktu:</Text>
                    <Text style={styles.metaVal}>
                      {new Date(inspectItem.createdAt).toISOString()}
                    </Text>
                  </View>

                  <Text style={[styles.metaLabel, { marginTop: 14, marginBottom: 6 }]}>
                    Payload Perubahan (Details):
                  </Text>
                  <ScrollView style={styles.jsonBox}>
                    <Text style={styles.jsonText}>
                      {JSON.stringify(inspectItem.details, null, 2)}
                    </Text>
                  </ScrollView>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setInspectItem(null)}
                >
                  <Text style={styles.closeBtnText}>Tutup</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  rolesGrid: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  roleCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.15)",
  },
  roleIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  roleName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 6,
  },
  roleDesc: {
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 16,
    marginBottom: 12,
  },
  permList: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingTop: 10,
    gap: 4,
  },
  permItem: {
    fontSize: 11,
    color: "#CBD5E1",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.15)",
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  cardDesc: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#14121F",
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    width: 240,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    color: "#F8FAFC",
    fontSize: 12,
  },
  roleFilterGroup: {
    flexDirection: "row",
    gap: 6,
  },
  roleFilterBtn: {
    backgroundColor: "#14121F",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  roleFilterBtnActive: {
    backgroundColor: "rgba(140, 87, 255, 0.2)",
    borderColor: "#8C57FF",
  },
  roleFilterBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    textTransform: "capitalize",
  },
  roleFilterBtnTextActive: {
    color: "#8C57FF",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 30,
  },
  table: {
    borderRadius: 8,
    overflow: "hidden",
  },
  thRow: {
    flexDirection: "row",
    backgroundColor: "rgba(140, 87, 255, 0.08)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  th: {
    fontSize: 12,
    fontWeight: "700",
    color: "#CBD5E1",
    textTransform: "uppercase",
  },
  trRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  logTime: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F8FAFC",
  },
  logId: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  adminEmail: {
    fontSize: 13,
    fontWeight: "600",
    color: "#CBD5E1",
  },
  roleBadge: {
    backgroundColor: "rgba(140, 87, 255, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  roleBadgeText: {
    fontSize: 10,
    color: "#8C57FF",
    fontWeight: "700",
  },
  actionPill: {
    backgroundColor: "#14121F",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#38BDF8",
  },
  targetType: {
    fontSize: 12,
    fontWeight: "600",
    color: "#CBD5E1",
  },
  targetId: {
    fontSize: 11,
    color: "#64748B",
  },
  detailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(140, 87, 255, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  detailBtnText: {
    fontSize: 12,
    color: "#8C57FF",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 550,
    backgroundColor: "#211D36",
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.3)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 16,
  },
  modalContent: {
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  metaLabel: {
    width: 100,
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
  metaVal: {
    flex: 1,
    fontSize: 13,
    color: "#F8FAFC",
  },
  jsonBox: {
    maxHeight: 180,
    backgroundColor: "#14121F",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  jsonText: {
    fontSize: 12,
    color: "#A7F3D0",
    fontFamily: "monospace",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  closeBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#8C57FF",
  },
  closeBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
