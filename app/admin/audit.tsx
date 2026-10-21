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
  Alert,
  Platform,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  type AuditLogItem,
  getAdminAuditLogs,
  type AdminRole,
} from "@/lib/admin-service";
import {
  type AdminAccount,
  getAdminAccounts,
  createAdminAccount,
  updateAdminAccount,
  deleteAdminAccount,
} from "@/lib/admin-auth-service";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";

export default function AdminAuditScreen() {
  const [activeTab, setActiveTab] = useState<"accounts" | "audit">("accounts");

  // Accounts state
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [searchAccount, setSearchAccount] = useState("");

  // Create / Edit Account Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<AdminRole>("finance_admin");
  const [formNotes, setFormNotes] = useState("");
  const [submittingAccount, setSubmittingAccount] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Role Modal
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);

  // Audit Logs state
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [searchLog, setSearchLog] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");
  const [inspectItem, setInspectItem] = useState<AuditLogItem | null>(null);

  const loadAccountsData = async () => {
    setLoadingAccounts(true);
    try {
      const list = await getAdminAccounts();
      setAccounts(list);
    } catch {}
    setLoadingAccounts(false);
  };

  const loadAuditLogsData = async () => {
    setIsLoadingLogs(true);
    try {
      const list = await getAdminAuditLogs();
      setLogs(list);
    } catch {}
    setIsLoadingLogs(false);
  };

  useEffect(() => {
    loadAccountsData();
    loadAuditLogsData();
  }, []);

  const handleOpenCreateModal = () => {
    hapticLight();
    setFormUsername("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("finance_admin");
    setFormNotes("");
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleSaveNewAccount = async () => {
    if (!formUsername.trim()) {
      setFormError("Nama / Username akun wajib diisi.");
      return;
    }
    if (!formEmail.trim() || !formEmail.includes("@")) {
      setFormError("Format email tidak valid.");
      return;
    }
    if (formPassword.trim().length < 4) {
      setFormError("Kata sandi minimal 4 karakter.");
      return;
    }

    setSubmittingAccount(true);
    setFormError(null);

    const res = await createAdminAccount({
      username: formUsername.trim(),
      email: formEmail.trim(),
      password: formPassword.trim(),
      role: formRole,
      notes: formNotes.trim(),
    });

    setSubmittingAccount(false);

    if (res.success) {
      hapticSuccess();
      setShowCreateModal(false);
      loadAccountsData();
      loadAuditLogsData();
      if (Platform.OS === "web") {
        window.alert(`Akun ${res.account?.email} berhasil dibuat!`);
      } else {
        Alert.alert("Berhasil", `Akun ${res.account?.email} berhasil dibuat!`);
      }
    } else {
      hapticWarning();
      setFormError(res.error || "Gagal membuat akun.");
    }
  };

  const handleToggleStatus = async (account: AdminAccount) => {
    hapticLight();
    const newStatus = account.status === "active" ? "inactive" : "active";
    const res = await updateAdminAccount(account.id, { status: newStatus });
    if (res.success) {
      loadAccountsData();
    }
  };

  const handleDeleteAccount = async (account: AdminAccount) => {
    hapticLight();
    const confirmMsg = `Yakin ingin menghapus akun ${account.email}? Akun tidak akan bisa login lagi ke dashboard.`;
    const proceed = Platform.OS === "web" ? window.confirm(confirmMsg) : true;
    if (!proceed) return;

    const res = await deleteAdminAccount(account.id);
    if (res.success) {
      hapticSuccess();
      loadAccountsData();
      loadAuditLogsData();
    } else {
      hapticWarning();
      if (Platform.OS === "web") {
        window.alert(res.error || "Gagal menghapus akun.");
      } else {
        Alert.alert("Gagal", res.error || "Gagal menghapus akun.");
      }
    }
  };

  const handleSaveRoleChange = async (newRole: AdminRole) => {
    if (!editingAccount) return;
    hapticLight();
    const res = await updateAdminAccount(editingAccount.id, { role: newRole });
    if (res.success) {
      hapticSuccess();
      setEditingAccount(null);
      loadAccountsData();
      loadAuditLogsData();
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    if (!searchAccount.trim()) return true;
    const q = searchAccount.toLowerCase();
    return (
      acc.username.toLowerCase().includes(q) ||
      acc.email.toLowerCase().includes(q) ||
      acc.role.toLowerCase().includes(q)
    );
  });

  const filteredLogs = logs.filter((log) => {
    if (selectedRoleFilter !== "all" && log.adminRole !== selectedRoleFilter) return false;
    if (searchLog.trim()) {
      const q = searchLog.toLowerCase();
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
    <AdminLayout activeKey="audit" title="Manajemen Akun & Audit Logs">
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Admin Roles, Akun & Audit Trail</Text>
            <Text style={styles.subtitle}>
              Buat dan kelola akun login staf dashboard, tentukan tingkat akses peran, dan pantau rekam jejak aktivitas audit.
            </Text>
          </View>
        </View>

        {/* TAB SWITCHER */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "accounts" && styles.tabBtnActive]}
            onPress={() => {
              hapticLight();
              setActiveTab("accounts");
            }}
          >
            <AppIcon
              name="account-multiple-outline"
              size={18}
              color={activeTab === "accounts" ? "#8C57FF" : "#94A3B8"}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "accounts" && styles.tabBtnTextActive,
              ]}
            >
              Akun Admin & Staf ({accounts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "audit" && styles.tabBtnActive]}
            onPress={() => {
              hapticLight();
              setActiveTab("audit");
            }}
          >
            <AppIcon
              name="shield-check-outline"
              size={18}
              color={activeTab === "audit" ? "#8C57FF" : "#94A3B8"}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "audit" && styles.tabBtnTextActive,
              ]}
            >
              Catatan Audit Trail ({logs.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── TAB 1: MANAJEMEN AKUN ADMIN & STAF ─── */}
        {activeTab === "accounts" && (
          <View>
            {/* Roles Summary Cards */}
            <View style={styles.rolesGrid}>
              <View style={styles.roleCard}>
                <View style={[styles.roleIconWrap, { backgroundColor: "rgba(140, 87, 255, 0.15)" }]}>
                  <AppIcon name="shield-crown-outline" size={20} color="#8C57FF" />
                </View>
                <Text style={styles.roleName}>Super Admin</Text>
                <Text style={styles.roleDesc}>
                  Akses penuh ke seluruh 13 modul admin. Dapat membuat akun staf baru, mengubah gateway, rilis sistem, dan audit trail.
                </Text>
                <View style={styles.permList}>
                  <View style={styles.permRow}>
                    <AppIcon name="check" size={13} color="#10B981" />
                    <Text style={styles.permItem}>Finance, User, Saldo & Border</Text>
                  </View>
                  <View style={styles.permRow}>
                    <AppIcon name="check" size={13} color="#10B981" />
                    <Text style={styles.permItem}>Kelola & Buat Akun Staf</Text>
                  </View>
                  <View style={styles.permRow}>
                    <AppIcon name="check" size={13} color="#10B981" />
                    <Text style={styles.permItem}>Sistem, APK & Maintenance</Text>
                  </View>
                </View>
              </View>

              <View style={styles.roleCard}>
                <View style={[styles.roleIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                  <AppIcon name="credit-card-outline" size={20} color="#38BDF8" />
                </View>
                <Text style={styles.roleName}>Finance Admin</Text>
                <Text style={styles.roleDesc}>
                  Fokus pada persetujuan transaksi Top Up Crystal, verifikasi bukti bayar manual, omset, dan penanganan tiket bantuan.
                </Text>
                <View style={styles.permList}>
                  <View style={styles.permRow}>
                    <AppIcon name="check" size={13} color="#10B981" />
                    <Text style={styles.permItem}>Verifikasi Top Up & Saldo</Text>
                  </View>
                  <View style={styles.permRow}>
                    <AppIcon name="check" size={13} color="#10B981" />
                    <Text style={styles.permItem}>Bantuan Support & Saweria</Text>
                  </View>
                  <View style={styles.permRow}>
                    <AppIcon name="close" size={13} color="#EF4444" />
                    <Text style={styles.permItem}>Kunci Akses Sistem & Pembuatan Akun</Text>
                  </View>
                </View>
              </View>

              <View style={styles.roleCard}>
                <View style={[styles.roleIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                  <AppIcon name="comment-text-multiple-outline" size={20} color="#10B981" />
                </View>
                <Text style={styles.roleName}>Moderator</Text>
                <Text style={styles.roleDesc}>
                  Menangani feed komentar anime, menghapus konten spam / toxic, filter kata terlarang, dan membisukan user pelanggar.
                </Text>
                <View style={styles.permList}>
                  <View style={styles.permRow}>
                    <AppIcon name="check" size={13} color="#10B981" />
                    <Text style={styles.permItem}>Moderasi Komentar & Feed</Text>
                  </View>
                  <View style={styles.permRow}>
                    <AppIcon name="check" size={13} color="#10B981" />
                    <Text style={styles.permItem}>Pelaporan & Community Policy</Text>
                  </View>
                  <View style={styles.permRow}>
                    <AppIcon name="close" size={13} color="#EF4444" />
                    <Text style={styles.permItem}>Akses Keuangan & Sistem Tertutup</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ACCOUNTS TABLE CARD */}
            <View style={styles.card}>
              <View style={styles.tableHeader}>
                <View>
                  <Text style={styles.cardTitle}>Daftar Akun Login Admin ({filteredAccounts.length})</Text>
                  <Text style={styles.cardDesc}>
                    Akun yang dapat digunakan untuk masuk ke dashboard ini.
                  </Text>
                </View>

                <View style={styles.filterRow}>
                  <View style={styles.searchBox}>
                    <AppIcon name="search" size={14} color="#94A3B8" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Cari email atau nama..."
                      placeholderTextColor="#64748B"
                      value={searchAccount}
                      onChangeText={setSearchAccount}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.createAccountBtn}
                    onPress={handleOpenCreateModal}
                  >
                    <AppIcon name="plus-circle-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.createAccountBtnText}>Buat Akun Staf Baru</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {loadingAccounts ? (
                <ActivityIndicator size="large" color="#8C57FF" style={{ marginVertical: 40 }} />
              ) : filteredAccounts.length === 0 ? (
                <Text style={styles.emptyText}>Tidak ada akun admin yang sesuai pencarian.</Text>
              ) : (
                <View style={styles.table}>
                  <View style={styles.thRow}>
                    <Text style={[styles.th, { flex: 2 }]}>Nama / Email Login</Text>
                    <Text style={[styles.th, { flex: 1.4 }]}>Peran / Role</Text>
                    <Text style={[styles.th, { flex: 1 }]}>Status</Text>
                    <Text style={[styles.th, { flex: 1.4 }]}>Login Terakhir</Text>
                    <Text style={[styles.th, { flex: 1.5, textAlign: "right" }]}>Aksi</Text>
                  </View>

                  {filteredAccounts.map((acc) => {
                    const isMaster = acc.email === "admin@nuenime.com" || acc.id === "admin-super-01";
                    const roleColor =
                      acc.role === "super_admin"
                        ? "#8C57FF"
                        : acc.role === "finance_admin"
                        ? "#38BDF8"
                        : "#10B981";

                    return (
                      <View key={acc.id} style={styles.trRow}>
                        <View style={{ flex: 2, flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View
                            style={[
                              styles.userAvatar,
                              { backgroundColor: `${roleColor}25`, borderColor: roleColor },
                            ]}
                          >
                            <Text style={[styles.userAvatarText, { color: roleColor }]}>
                              {acc.username.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View>
                            <Text style={styles.accountName}>{acc.username}</Text>
                            <Text style={styles.accountEmail}>{acc.email}</Text>
                          </View>
                        </View>

                        <View style={{ flex: 1.4 }}>
                          <View style={[styles.roleBadge, { backgroundColor: `${roleColor}20` }]}>
                            <AppIcon
                              name={
                                acc.role === "super_admin"
                                  ? "shield-crown"
                                  : acc.role === "finance_admin"
                                  ? "credit-card"
                                  : "shield-check"
                              }
                              size={12}
                              color={roleColor}
                            />
                            <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                              {acc.role === "super_admin"
                                ? "Super Admin"
                                : acc.role === "finance_admin"
                                ? "Finance Admin"
                                : "Moderator"}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flex: 1 }}>
                          <TouchableOpacity
                            onPress={() => !isMaster && handleToggleStatus(acc)}
                            disabled={isMaster}
                            style={[
                              styles.statusChip,
                              acc.status === "active" ? styles.statusActive : styles.statusInactive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusChipText,
                                acc.status === "active"
                                  ? styles.statusActiveText
                                  : styles.statusInactiveText,
                              ]}
                            >
                              {acc.status === "active" ? "Aktif" : "Nonaktif"}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <View style={{ flex: 1.4 }}>
                          <Text style={styles.lastLoginText}>
                            {acc.lastLoginAt
                              ? new Date(acc.lastLoginAt).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Belum pernah"}
                          </Text>
                        </View>

                        <View style={{ flex: 1.5, flexDirection: "row", justifyContent: "flex-end", gap: 6 }}>
                          <TouchableOpacity
                            style={styles.editRoleBtn}
                            onPress={() => {
                              hapticLight();
                              setEditingAccount(acc);
                            }}
                          >
                            <AppIcon name="shield-edit-outline" size={14} color="#8C57FF" />
                            <Text style={styles.editRoleBtnText}>Ubah Role</Text>
                          </TouchableOpacity>

                          {!isMaster ? (
                            <TouchableOpacity
                              style={styles.deleteAccBtn}
                              onPress={() => handleDeleteAccount(acc)}
                            >
                              <AppIcon name="trash-can-outline" size={14} color="#F87171" />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ─── TAB 2: AUDIT LOG TABLE CARD ─── */}
        {activeTab === "audit" && (
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
                    value={searchLog}
                    onChangeText={setSearchLog}
                  />
                </View>

                <View style={styles.roleFilterGroup}>
                  {(["all", "super_admin", "finance_admin", "moderator"] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleFilterBtn, selectedRoleFilter === r && styles.roleFilterBtnActive]}
                      onPress={() => setSelectedRoleFilter(r)}
                    >
                      <Text
                        style={[
                          styles.roleFilterBtnText,
                          selectedRoleFilter === r && styles.roleFilterBtnTextActive,
                        ]}
                      >
                        {r === "all" ? "Semua Role" : r.replace("_", " ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {isLoadingLogs ? (
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
        )}

        {/* ─── MODAL BUAT AKUN ADMIN BARU ─── */}
        <Modal visible={showCreateModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <View>
                  <Text style={styles.modalTitle}>Buat Akun Staf Baru</Text>
                  <Text style={styles.modalSub}>
                    Akun ini akan langsung dapat digunakan untuk masuk ke Dashboard Admin.
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <AppIcon name="close" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {formError ? (
                <View style={styles.errorBox}>
                  <AppIcon name="alert-circle-outline" size={16} color="#F87171" />
                  <Text style={styles.errorBoxText}>{formError}</Text>
                </View>
              ) : null}

              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>NAMA LENGKAP / USERNAME *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Contoh: Rian Finance atau Siti Moderator"
                    placeholderTextColor="#64748B"
                    value={formUsername}
                    onChangeText={setFormUsername}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>EMAIL LOGIN *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="rian@nuenime.com"
                    placeholderTextColor="#64748B"
                    value={formEmail}
                    onChangeText={setFormEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>KATA SANDI LOGIN *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Minimal 4 karakter"
                    placeholderTextColor="#64748B"
                    value={formPassword}
                    onChangeText={setFormPassword}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>PILIH PERAN / ROLE ADMIN *</Text>
                  <View style={styles.roleSelectionRow}>
                    {(
                      [
                        { role: "super_admin", label: "Super Admin", icon: "shield-crown", desc: "Akses Penuh Semua Modul" },
                        { role: "finance_admin", label: "Finance Admin", icon: "credit-card", desc: "Top Up & Saldo" },
                        { role: "moderator", label: "Moderator", icon: "shield-account", desc: "Komunitas & Komentar" },
                      ] as const
                    ).map((r) => {
                      const isSelected = formRole === r.role;
                      return (
                        <TouchableOpacity
                          key={r.role}
                          onPress={() => {
                            hapticLight();
                            setFormRole(r.role);
                          }}
                          style={[
                            styles.roleOptionCard,
                            isSelected && styles.roleOptionCardSelected,
                          ]}
                        >
                          <AppIcon
                            name={r.icon}
                            size={18}
                            color={isSelected ? "#8C57FF" : "#94A3B8"}
                          />
                          <Text
                            style={[
                              styles.roleOptionTitle,
                              isSelected && styles.roleOptionTitleSelected,
                            ]}
                          >
                            {r.label}
                          </Text>
                          <Text style={styles.roleOptionDesc}>{r.desc}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>CATATAN / KETERANGAN (OPSIONAL)</Text>
                  <TextInput
                    style={[styles.formInput, { height: 60 }]}
                    placeholder="Contoh: Staff Shift Siang Keuangan"
                    placeholderTextColor="#64748B"
                    value={formNotes}
                    onChangeText={setFormNotes}
                    multiline
                  />
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitModalBtn, submittingAccount && { opacity: 0.6 }]}
                  onPress={handleSaveNewAccount}
                  disabled={submittingAccount}
                >
                  {submittingAccount ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitModalBtnText}>Simpan & Buat Akun</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ─── MODAL UBAH ROLE AKUN ─── */}
        <Modal visible={!!editingAccount} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Ubah Peran (Role) Akun</Text>
              <Text style={styles.modalSub}>
                Akun: {editingAccount?.username} ({editingAccount?.email})
              </Text>

              <View style={{ gap: 10, marginVertical: 18 }}>
                {(
                  [
                    { role: "super_admin", label: "Super Admin", icon: "shield-crown", desc: "Akses penuh ke seluruh 13 modul admin." },
                    { role: "finance_admin", label: "Finance Admin", icon: "credit-card", desc: "Akses verifikasi transaksi Top Up & bantuan CS." },
                    { role: "moderator", label: "Moderator", icon: "shield-check", desc: "Akses moderasi komentar & feed anime." },
                  ] as const
                ).map((r) => {
                  const isCurrent = editingAccount?.role === r.role;
                  return (
                    <TouchableOpacity
                      key={r.role}
                      onPress={() => handleSaveRoleChange(r.role)}
                      style={[
                        styles.roleSelectRow,
                        isCurrent && styles.roleSelectRowCurrent,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <AppIcon name={r.icon} size={14} color={isCurrent ? "#8C57FF" : "#94A3B8"} />
                          <Text style={[styles.roleSelectLabel, isCurrent && { color: "#8C57FF" }]}>
                            {r.label} {isCurrent ? "(Saat Ini)" : ""}
                          </Text>
                        </View>
                        <Text style={styles.roleSelectDesc}>{r.desc}</Text>
                      </View>
                      <AppIcon
                        name={isCurrent ? "radiobox-marked" : "radiobox-blank"}
                        size={20}
                        color={isCurrent ? "#8C57FF" : "#64748B"}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setEditingAccount(null)}
                >
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ─── MODAL INSPECT AUDIT ITEM ─── */}
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
    marginBottom: 20,
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
  tabBar: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: 12,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  tabBtnActive: {
    backgroundColor: "rgba(140, 87, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.4)",
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
  tabBtnTextActive: {
    color: "#8C57FF",
    fontWeight: "700",
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
    backgroundColor: "#0D1017",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
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
    gap: 6,
  },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  permItem: {
    fontSize: 11,
    color: "#CBD5E1",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#0D1017",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
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
    backgroundColor: "#080A0F",
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    width: 220,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    color: "#F8FAFC",
    fontSize: 12,
  },
  createAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#8C57FF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createAccountBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#FFFFFF",
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
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    fontSize: 13,
    fontWeight: "800",
  },
  accountName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  accountEmail: {
    fontSize: 11.5,
    color: "#94A3B8",
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusActiveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
  },
  statusInactive: {
    backgroundColor: "rgba(248, 113, 113, 0.15)",
  },
  statusInactiveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#F87171",
  },
  lastLoginText: {
    fontSize: 12,
    color: "#94A3B8",
  },
  editRoleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(140, 87, 255, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.25)",
  },
  editRoleBtnText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#8C57FF",
  },
  deleteAccBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(248, 113, 113, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.25)",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 30,
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
    backgroundColor: "#11141D",
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  modalSub: {
    fontSize: 12.5,
    color: "#94A3B8",
    marginTop: 2,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(248, 113, 113, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.3)",
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorBoxText: {
    fontSize: 12,
    color: "#F87171",
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: 14,
    gap: 6,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  formInput: {
    backgroundColor: "#080A0F",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#FFFFFF",
  },
  roleSelectionRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleOptionCard: {
    flex: 1,
    backgroundColor: "#080A0F",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    gap: 4,
  },
  roleOptionCardSelected: {
    borderColor: "#8C57FF",
    backgroundColor: "rgba(140, 87, 255, 0.12)",
  },
  roleOptionTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#94A3B8",
    textAlign: "center",
  },
  roleOptionTitleSelected: {
    color: "#8C57FF",
  },
  roleOptionDesc: {
    fontSize: 9.5,
    color: "#64748B",
    textAlign: "center",
  },
  roleSelectRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#080A0F",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  roleSelectRowCurrent: {
    borderColor: "#8C57FF",
    backgroundColor: "rgba(140, 87, 255, 0.1)",
  },
  roleSelectLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 2,
  },
  roleSelectDesc: {
    fontSize: 11,
    color: "#94A3B8",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  cancelBtnText: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: "600",
  },
  submitModalBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#8C57FF",
  },
  submitModalBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
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
    backgroundColor: "#080A0F",
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
