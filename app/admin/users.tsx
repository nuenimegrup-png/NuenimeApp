import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { BorderAvatar } from "@/components/border-avatar";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  type AdminUser,
  type AdminUserListItem,
  type UserHistoryCategory,
  type UserHistoryItem,
  type UserFriendItem,
  NUENIME_USER_ROLES,
  isSpecialRole,
  getAdminUsersList,
  adminAdjustUserBalance,
  adminResetUserCooldown,
  adminUpdateUserRole,
  adminSwapMemberNumbers,
  adminSetUserBanStatus,
  getUserFullHistory,
  getUserFriendsList,
  adminDeleteFriendship,
  adminAddFriendship,
} from "@/lib/admin-service";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { getProfileCooldownStatus, BANNER_COOLDOWN_SECONDS, NAME_COOLDOWN_SECONDS, AVATAR_COOLDOWN_SECONDS } from "@/lib/profile-cooldown";

type UserDetailTab = "role" | "cooldown" | "balance" | "status" | "history" | "friends";

export default function AdminUsersScreen() {
  const auth = useAnirakuAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  // In-Page Multi-Tab Management
  const [activeTabId, setActiveTabId] = useState<string>("users");
  const [openUserTabs, setOpenUserTabs] = useState<AdminUserListItem[]>([]);
  const [activeDetailSubTab, setActiveDetailSubTab] = useState<UserDetailTab>("role");

  // Active user in detail tab
  const activeUser = useMemo(() => {
    if (activeTabId === "users") return null;
    return openUserTabs.find((u) => u.id === activeTabId) || null;
  }, [activeTabId, openUserTabs]);

  // Admin user context for audit log
  const adminActor: AdminUser = useMemo(() => {
    return {
      id: auth.user?.id || "admin-super",
      email: auth.user?.email || "admin@nuenime.com",
      username: auth.profile?.display_name || auth.profile?.username || "Super Admin",
      role: "super_admin",
    };
  }, [auth.user, auth.profile]);

  // Modals state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustMode, setAdjustMode] = useState<"add" | "deduct">("add");
  const [adjusting, setAdjusting] = useState(false);

  const [showCooldownModal, setShowCooldownModal] = useState(false);
  const [cooldownType, setCooldownType] = useState<"name" | "avatar" | "banner" | "all">("all");
  const [cooldownReason, setCooldownReason] = useState("");
  const [resettingCooldown, setResettingCooldown] = useState(false);

  // Swap Member Number (#ID) State
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTargetUserId, setSwapTargetUserId] = useState("");
  const [swapReason, setSwapReason] = useState("");
  const [swapDropdownOpen, setSwapDropdownOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedNewRole, setSelectedNewRole] = useState<string>("Member");
  const [roleChangeReason, setRoleChangeReason] = useState("");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

  const [showBanModal, setShowBanModal] = useState(false);
  const [banReasonInput, setBanReasonInput] = useState("");
  const [savingBanStatus, setSavingBanStatus] = useState(false);

  // User History State
  const [historyCategory, setHistoryCategory] = useState<UserHistoryCategory>("all");
  const [historySearch, setHistorySearch] = useState("");
  const [historyItems, setHistoryItems] = useState<UserHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // User Friends State
  const [friendsList, setFriendsList] = useState<UserFriendItem[]>([]);
  const [friendsSearch, setFriendsSearch] = useState("");
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Connect Friend Modal State
  const [showConnectFriendModal, setShowConnectFriendModal] = useState(false);
  const [targetFriendUserId, setTargetFriendUserId] = useState("");
  const [connectFriendReason, setConnectFriendReason] = useState("");
  const [connectingFriend, setConnectingFriend] = useState(false);

  // Disconnect Friend Modal State
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [friendToDisconnect, setFriendToDisconnect] = useState<UserFriendItem | null>(null);
  const [disconnectReason, setDisconnectReason] = useState("");
  const [disconnectingFriend, setDisconnectingFriend] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAdminUsersList(searchQuery);
      setUsers(list);

      // Sinkronkan data tab yang sedang terbuka jika ada perubahan
      setOpenUserTabs((prev) =>
        prev.map((tab) => list.find((u) => u.id === tab.id) || tab)
      );
    } catch {}
    setLoading(false);
  }, [searchQuery]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Refresh friends list callback
  const refreshFriendsList = useCallback(async () => {
    if (!activeUser) return;
    setLoadingFriends(true);
    try {
      const res = await getUserFriendsList(activeUser.id, friendsSearch);
      setFriendsList(res);
    } catch (err) {
      console.warn("[users.tsx] refreshFriendsList error:", err);
    } finally {
      setLoadingFriends(false);
    }
  }, [activeUser?.id, friendsSearch]);

  // Load history when active user or history category changes
  useEffect(() => {
    if (activeUser && activeDetailSubTab === "history") {
      setLoadingHistory(true);
      getUserFullHistory({
        userId: activeUser.id,
        category: historyCategory,
        search: historySearch,
      })
        .then(setHistoryItems)
        .finally(() => setLoadingHistory(false));
    }
  }, [activeUser, activeDetailSubTab, historyCategory, historySearch]);

  // Load friends when active user or friends subtab changes
  useEffect(() => {
    if (activeUser && activeDetailSubTab === "friends") {
      refreshFriendsList();
    }
  }, [activeUser?.id, activeDetailSubTab, friendsSearch, refreshFriendsList]);

  // Handler: Connect new friend
  const handleConnectFriend = async () => {
    if (!activeUser || !targetFriendUserId) {
      Alert.alert("Pilih Pengguna", "Silakan pilih salah satu pengguna dari daftar.");
      return;
    }
    setConnectingFriend(true);
    const res = await adminAddFriendship({
      userId: activeUser.id,
      targetUserId: targetFriendUserId,
      reason: connectFriendReason.trim() || "Dihubungkan oleh Administrator Nuenime",
      admin: adminActor,
    });
    setConnectingFriend(false);
    if (res.success) {
      hapticSuccess();
      setShowConnectFriendModal(false);
      setTargetFriendUserId("");
      setConnectFriendReason("");
      refreshFriendsList();
      Alert.alert("Berhasil", "Pertemanan berhasil dihubungkan di sistem!");
    } else {
      hapticWarning();
      Alert.alert("Gagal", res.error || "Gagal menghubungkan pertemanan.");
    }
  };

  // Handler: Disconnect friend
  const handleDisconnectFriend = async () => {
    if (!activeUser || !friendToDisconnect) return;
    setDisconnectingFriend(true);
    const res = await adminDeleteFriendship({
      friendshipId: friendToDisconnect.id,
      userId: activeUser.id,
      friendId: friendToDisconnect.friendId,
      reason: disconnectReason.trim() || "Diputuskan oleh Administrator Nuenime",
      admin: adminActor,
    });
    setDisconnectingFriend(false);
    if (res.success) {
      hapticSuccess();
      setShowDisconnectModal(false);
      setFriendToDisconnect(null);
      setDisconnectReason("");
      refreshFriendsList();
      Alert.alert("Berhasil", "Pertemanan telah diputuskan.");
    } else {
      hapticWarning();
      Alert.alert("Gagal", res.error || "Gagal menghapus pertemanan.");
    }
  };

  // Open user in new in-page tab
  const handleOpenUserDetail = (user: AdminUserListItem) => {
    hapticLight();
    const existingIndex = openUserTabs.findIndex((t) => t.id === user.id);
    if (existingIndex === -1) {
      setOpenUserTabs((prev) => [...prev, user]);
    }
    setActiveTabId(user.id);
    setSelectedNewRole(user.role || "Member");
  };

  // Close tab
  const handleCloseTab = (userId: string, e?: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    hapticLight();
    const remaining = openUserTabs.filter((t) => t.id !== userId);
    setOpenUserTabs(remaining);
    if (activeTabId === userId) {
      setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : "users");
    }
  };

  // Adjust Balance
  const handleAdjustBalance = async () => {
    if (!activeUser && !activeUser) return;
    const target = activeUser || users[0];
    const amountVal = parseInt(adjustAmount.replace(/\D/g, ""), 10);

    if (isNaN(amountVal) || amountVal <= 0) {
      Alert.alert("Input Salah", "Masukkan jumlah Crystal yang valid.");
      return;
    }
    if (!adjustReason.trim()) {
      Alert.alert("Alasan Wajib", "Alasan penyesuaian saldo wajib diisi.");
      return;
    }

    const finalAmount = adjustMode === "deduct" ? -amountVal : amountVal;
    setAdjusting(true);
    const res = await adminAdjustUserBalance({
      userId: target.id,
      amount: finalAmount,
      reason: adjustReason.trim(),
      admin: adminActor,
    });
    setAdjusting(false);

    if (res.success) {
      hapticSuccess();
      Alert.alert(
        "Penyesuaian Berhasil",
        `Saldo ${target.username} diperbarui dari ${res.before.toLocaleString("id-ID")} menjadi ${res.after.toLocaleString("id-ID")} Crystal.`
      );
      setShowAdjustModal(false);
      setAdjustAmount("");
      setAdjustReason("");

      // Update openUserTabs & users state immediately so the open tab and list reflect the new balance
      setOpenUserTabs((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, crystalBalance: res.after } : u))
      );
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, crystalBalance: res.after } : u))
      );

      loadUsers();
    } else {
      hapticWarning();
      Alert.alert("Gagal", res.error || "Gagal menyesuaikan saldo.");
    }
  };

  // Reset Cooldown
  const handleResetCooldown = async () => {
    if (!activeUser) return;
    if (!cooldownReason.trim()) {
      Alert.alert("Alasan Wajib", "Harap masukkan alasan reset cooldown untuk audit log.");
      return;
    }

    setResettingCooldown(true);
    const res = await adminResetUserCooldown({
      userId: activeUser.id,
      type: cooldownType,
      reason: cooldownReason.trim(),
      admin: adminActor,
    });
    setResettingCooldown(false);

    if (res.success) {
      hapticSuccess();
      Alert.alert(
        "Reset Berhasil",
        cooldownType === "all"
          ? `Seluruh cooldown (Nama, Avatar, Banner) untuk @${activeUser.username} telah dibatalkan & di-reset.`
          : `Cooldown ${cooldownType.toUpperCase()} untuk @${activeUser.username} telah di-reset.`
      );
      setShowCooldownModal(false);
      setCooldownReason("");

      // Update openUserTabs & users state immediately
      const updateCooldowns = (tab: AdminUserListItem) => {
        if (tab.id !== activeUser.id) return tab;
        const updated = { ...tab };
        if (cooldownType === "all") {
          updated.nameUpdatedAt = null;
          updated.avatarUpdatedAt = null;
          updated.bannerUpdatedAt = null;
        } else if (cooldownType === "name") {
          updated.nameUpdatedAt = null;
        } else if (cooldownType === "avatar") {
          updated.avatarUpdatedAt = null;
        } else if (cooldownType === "banner") {
          updated.bannerUpdatedAt = null;
        }
        return updated;
      };

      setOpenUserTabs((prev) => prev.map(updateCooldowns));
      setUsers((prev) => prev.map(updateCooldowns));

      loadUsers();
    } else {
      Alert.alert("Gagal", res.error || "Gagal me-reset cooldown.");
    }
  };

  // Swap Member Number (#ID) Antar Akun
  const handleSwapMemberNumbers = async () => {
    if (!activeUser || !swapTargetUserId) return;
    const targetUser = users.find((u) => u.id === swapTargetUserId);
    if (!targetUser) {
      Alert.alert("Peringatan", "Pilih akun tujuan untuk menukar nomor member.");
      return;
    }

    setSwapping(true);
    const res = await adminSwapMemberNumbers({
      userAId: activeUser.id,
      userBId: targetUser.id,
      reason: swapReason.trim() || `Tukar nomor member antara ${activeUser.username} (${activeUser.memberNumber}) dan ${targetUser.username} (${targetUser.memberNumber})`,
      admin: adminActor,
    });
    setSwapping(false);

    if (res.success) {
      hapticSuccess();
      const oldA = activeUser.memberNumber;
      const oldB = targetUser.memberNumber;

      Alert.alert(
        "Nomor Member Berhasil Ditukar",
        `Akun @${activeUser.username} kini bernomor "${oldB}" dan @${targetUser.username} kini bernomor "${oldA}".`
      );
      setShowSwapModal(false);
      setSwapReason("");

      // Update openUserTabs state immediately
      setOpenUserTabs((prev) =>
        prev.map((tab) => {
          if (tab.id === activeUser.id) return { ...tab, memberNumber: oldB };
          if (tab.id === targetUser.id) return { ...tab, memberNumber: oldA };
          return tab;
        })
      );

      loadUsers();
    } else {
      hapticWarning();
      Alert.alert("Gagal Menukar Nomor", res.error || "Terjadi kesalahan.");
    }
  };

  // Save Role
  const handleSaveRole = async () => {
    if (!activeUser) return;
    if (activeUser.role === selectedNewRole) {
      Alert.alert("Info", `Pengguna sudah memiliki role ${selectedNewRole}.`);
      return;
    }

    setSavingRole(true);
    const res = await adminUpdateUserRole({
      userId: activeUser.id,
      targetUsername: activeUser.username,
      previousRole: activeUser.role,
      newRole: selectedNewRole,
      reason: roleChangeReason.trim() || `Diubah dari ${activeUser.role} ke ${selectedNewRole}`,
      admin: adminActor,
    });
    setSavingRole(false);

    if (res.success) {
      hapticSuccess();
      Alert.alert(
        "Role Berhasil Diperbarui",
        `Role @${activeUser.username} telah diubah menjadi "${selectedNewRole}".`
      );
      setShowRoleModal(false);
      setRoleChangeReason("");

      // Update openUserTabs state immediately
      setOpenUserTabs((prev) =>
        prev.map((tab) => (tab.id === activeUser.id ? { ...tab, role: selectedNewRole } : tab))
      );

      loadUsers();
    } else {
      hapticWarning();
      Alert.alert("Gagal Mengubah Role", res.error || "Terjadi kesalahan.");
    }
  };

  // Toggle Ban Status
  const handleToggleBanStatus = async () => {
    if (!activeUser) return;
    const newBanState = !activeUser.isBanned;

    if (newBanState && !banReasonInput.trim()) {
      Alert.alert("Alasan Wajib", "Masukkan alasan pemblokiran akun pengguna.");
      return;
    }

    setSavingBanStatus(true);
    const res = await adminSetUserBanStatus({
      userId: activeUser.id,
      targetUsername: activeUser.username,
      isBanned: newBanState,
      reason: banReasonInput.trim() || "Buka blokir oleh administrator",
      admin: adminActor,
    });
    setSavingBanStatus(false);

    if (res.success) {
      hapticSuccess();
      Alert.alert(
        newBanState ? "Akun Telah Diblokir" : "Blokir Telah Dibuka",
        newBanState
          ? `Akun @${activeUser.username} berhasil diblokir secara permanen.`
          : `Akun @${activeUser.username} kini aktif kembali.`
      );
      setShowBanModal(false);
      setBanReasonInput("");

      // Update openUserTabs state immediately
      setOpenUserTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeUser.id
            ? {
                ...tab,
                isBanned: newBanState,
                status: newBanState ? "banned" : "active",
                banReason: newBanState ? banReasonInput.trim() : null,
              }
            : tab
        )
      );

      loadUsers();
    } else {
      hapticWarning();
      Alert.alert("Gagal", res.error || "Gagal memperbarui status akun.");
    }
  };

  const filteredUsers = useMemo(() => {
    let result = users;
    if (roleFilter === "special") result = users.filter((u) => isSpecialRole(u.role));
    else if (roleFilter === "member") result = users.filter((u) => !isSpecialRole(u.role));
    else if (roleFilter === "banned") result = users.filter((u) => u.isBanned);
    else if (roleFilter !== "all") result = users.filter((u) => u.role.toLowerCase() === roleFilter.toLowerCase());

    // Pastikan angka member selalu dari urutan nomor 1 (#0001) dari atas
    return [...result].sort((a, b) => {
      const numA = parseInt(String(a.memberNumber || "0").replace(/[^0-9]/g, ""), 10) || 0;
      const numB = parseInt(String(b.memberNumber || "0").replace(/[^0-9]/g, ""), 10) || 0;
      return numA - numB;
    });
  }, [users, roleFilter]);

  // Cooldown status calculation for active user
  const nameCooldown = getProfileCooldownStatus(activeUser?.nameUpdatedAt, NAME_COOLDOWN_SECONDS, "name");
  const avatarCooldown = getProfileCooldownStatus(activeUser?.avatarUpdatedAt, AVATAR_COOLDOWN_SECONDS, "avatar");
  const bannerCooldown = getProfileCooldownStatus(activeUser?.bannerUpdatedAt, BANNER_COOLDOWN_SECONDS, "banner");

  return (
    <AdminLayout
      title="User Management"
      subtitle="Pusat kontrol pengguna, hak akses 16 role, moderasi akun, riwayat audit, dan saldo Crystal"
      activeKey="users"
    >
      {/* ─── 1. TOP IN-PAGE TAB BAR ─── */}
      <View style={styles.tabBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarScroll}>
          {/* Default Tab: Users List */}
          <Pressable
            onPress={() => {
              hapticLight();
              setActiveTabId("users");
            }}
            style={[styles.tabButton, activeTabId === "users" && styles.tabButtonActive]}
          >
            <AppIcon
              name="account-multiple"
              size={15}
              color={activeTabId === "users" ? "#FFFFFF" : "#94A3B8"}
            />
            <Text style={[styles.tabButtonText, activeTabId === "users" && styles.tabButtonTextActive]}>
              Users ({users.length})
            </Text>
          </Pressable>

          {/* User Tabs Opened Via "Selengkapnya" */}
          {openUserTabs.map((tabUser) => {
            const isActive = activeTabId === tabUser.id;
            const hasSpecial = isSpecialRole(tabUser.role);
            return (
              <Pressable
                key={tabUser.id}
                onPress={() => {
                  hapticLight();
                  setActiveTabId(tabUser.id);
                  setSelectedNewRole(tabUser.role || "Member");
                }}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
              >
                {/* Red Checkmark Icon for Special Roles */}
                {hasSpecial ? (
                  <AppIcon name="check-decagram" size={14} color="#EF4444" />
                ) : (
                  <AppIcon name="account" size={14} color={isActive ? "#FFFFFF" : "#94A3B8"} />
                )}
                <Text
                  style={[
                    styles.tabButtonText,
                    isActive && styles.tabButtonTextActive,
                    hasSpecial && { color: isActive ? "#FFFFFF" : "#FCA5A5" },
                  ]}
                  numberOfLines={1}
                >
                  @{tabUser.username}
                </Text>
                {tabUser.isBanned && (
                  <View style={styles.bannedMiniDot} />
                )}
                <Pressable
                  onPress={(e) => handleCloseTab(tabUser.id, e)}
                  hitSlop={8}
                  style={styles.closeTabBtn}
                >
                  <AppIcon name="close" size={13} color="#94A3B8" />
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── 2. TAB CONTENT: MAIN USERS LIST ─── */}
      {activeTabId === "users" ? (
        <View style={styles.contentSection}>
          {/* ─── TOP KPI STRIP (MATCHING BORDERS.TSX) ─── */}
          <View style={[styles.kpiStrip, !isWide && styles.kpiStripMobile]}>
            <View style={styles.kpiStripItem}>
              <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(255, 255, 255, 0.08)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.16)" }]}>
                <AppIcon name="account-group" size={18} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.kpiStripLabel}>Total Pengguna</Text>
                <Text style={styles.kpiStripVal}>{users.length} Akun</Text>
              </View>
            </View>

            <View style={styles.kpiStripDivider} />

            <View style={styles.kpiStripItem}>
              <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(239, 68, 68, 0.12)", borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.28)" }]}>
                <AppIcon name="shield-check" size={18} color="#EF4444" />
              </View>
              <View>
                <Text style={styles.kpiStripLabel}>Role Khusus (Staff)</Text>
                <Text style={[styles.kpiStripVal, { color: "#EF4444" }]}>
                  {users.filter((u) => isSpecialRole(u.role)).length} Akun
                </Text>
              </View>
            </View>

            <View style={styles.kpiStripDivider} />

            <View style={styles.kpiStripItem}>
              <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(16, 185, 129, 0.12)", borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.28)" }]}>
                <AppIcon name="check-circle" size={18} color="#10B981" />
              </View>
              <View>
                <Text style={styles.kpiStripLabel}>Akun Aktif</Text>
                <Text style={[styles.kpiStripVal, { color: "#10B981" }]}>
                  {users.filter((u) => !u.isBanned).length} Pengguna
                </Text>
              </View>
            </View>

            <View style={styles.kpiStripDivider} />

            <View style={styles.kpiStripItem}>
              <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(244, 63, 94, 0.12)", borderWidth: 1, borderColor: "rgba(244, 63, 94, 0.28)" }]}>
                <AppIcon name="account-cancel" size={18} color="#F43F5E" />
              </View>
              <View>
                <Text style={styles.kpiStripLabel}>Akun Diblokir</Text>
                <Text style={[styles.kpiStripVal, { color: "#F43F5E" }]}>
                  {users.filter((u) => u.isBanned).length} Akun
                </Text>
              </View>
            </View>
          </View>

          {/* ─── SEARCH & FILTER SECTION (MATCHING BORDERS.TSX) ─── */}
          <View style={styles.filterCard}>
            <View style={styles.topFilterHeader}>
              <Text style={styles.filterSectionTitle}>Katalog & Filter Pengguna</Text>
              <Pressable
                onPress={() => {
                  hapticLight();
                  loadUsers();
                }}
                style={styles.refreshBtn}
              >
                <AppIcon name="refresh" size={14} color="#FFFFFF" />
                <Text style={styles.refreshBtnText}>Muat Ulang</Text>
              </Pressable>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <AppIcon name="magnify" size={18} color="#94A3B8" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Cari username, email, role, atau #nomor member..."
                  placeholderTextColor="#64748B"
                  style={styles.searchInput}
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
                    <AppIcon name="close" size={14} color="#94A3B8" />
                  </Pressable>
                ) : null}
              </View>

              {/* Status Filter Chips (Tanpa Emoji) */}
              <View style={styles.statusFilterRow}>
                {[
                  { key: "all", label: `Semua (${users.length})` },
                  { key: "special", label: "Role Khusus" },
                  { key: "member", label: "Member Biasa" },
                  { key: "banned", label: "Akun Diblokir" },
                ].map((f) => (
                  <Pressable
                    key={f.key}
                    onPress={() => {
                      hapticLight();
                      setRoleFilter(f.key);
                    }}
                    style={[
                      styles.statusFilterChip,
                      roleFilter === f.key && styles.statusFilterChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusFilterText,
                        roleFilter === f.key && styles.statusFilterTextActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Users Table Card */}
          <View style={styles.cardBox}>
            {loading ? (
              <ActivityIndicator size="small" color="#38BDF8" style={{ padding: 30 }} />
            ) : filteredUsers.length === 0 ? (
              <View style={styles.emptyWrap}>
                <AppIcon name="account-search-outline" size={44} color="#64748B" />
                <Text style={styles.emptyTitle}>Tidak Ditemukan Pengguna</Text>
                <Text style={styles.emptyText}>Coba gunakan kata kunci pencarian atau filter yang berbeda.</Text>
              </View>
            ) : (
              <View style={styles.tableWrap}>
                <View style={styles.thRow}>
                  <Text style={[styles.th, { flex: 1.1 }]}>MEMBER</Text>
                  <Text style={[styles.th, { flex: 2.5 }]}>USER / PROFIL</Text>
                  <Text style={[styles.th, { flex: 1.8 }]}>ROLE SISTEM</Text>
                  <Text style={[styles.th, { flex: 1.6 }]}>SALDO CRYSTAL</Text>
                  <Text style={[styles.th, { flex: 1.3 }]}>LEVEL & EXP</Text>
                  <Text style={[styles.th, { flex: 1.3 }]}>STATUS</Text>
                  <Text style={[styles.th, { flex: 1.8, textAlign: "right" }]}>TINDAKAN</Text>
                </View>

                {filteredUsers.map((u) => {
                  const special = isSpecialRole(u.role);
                  return (
                    <View key={u.id} style={[styles.trRow, u.isBanned && styles.trRowBanned]}>
                      {/* Member Number */}
                      <Text style={[styles.tdMember, { flex: 1.1 }]}>{u.memberNumber}</Text>

                      {/* User Info */}
                      <View style={{ flex: 2.5, flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={styles.avatarMiniWrap}>
                          {u.avatarUrl ? (
                            <Image source={{ uri: u.avatarUrl }} style={styles.avatarMini} />
                          ) : (
                            <View style={styles.avatarPlaceholder}>
                              <Text style={styles.avatarPlaceholderText}>{u.username[0]?.toUpperCase() || "U"}</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tdBold} numberOfLines={1}>
                            {u.displayName || u.username}
                          </Text>
                          <Text style={styles.tdSub} numberOfLines={1}>
                            @{u.username}
                          </Text>
                        </View>
                      </View>

                      {/* Role with Red Checkmark for Special */}
                      <View style={{ flex: 1.8, flexDirection: "row", alignItems: "center" }}>
                        <View style={[styles.roleBadge, special ? styles.roleBadgeSpecial : styles.roleBadgeMember]}>
                          {special && <AppIcon name="check-decagram" size={13} color="#EF4444" />}
                          <Text style={[styles.roleBadgeText, special && styles.roleBadgeTextSpecial]}>
                            {u.role || "Member"}
                          </Text>
                        </View>
                      </View>

                      {/* Crystal Balance */}
                      <Text style={[styles.tdBold, { flex: 1.6, color: "#38BDF8" }]}>
                        {u.crystalBalance.toLocaleString("id-ID")} Crystal
                      </Text>

                      {/* Level & EXP */}
                      <Text style={[styles.td, { flex: 1.3 }]}>
                        Lv.{u.level} ({u.exp} XP)
                      </Text>

                      {/* Account Status */}
                      <View style={{ flex: 1.3 }}>
                        <View style={u.isBanned ? styles.statusPillBanned : styles.statusPillActive}>
                          <Text style={u.isBanned ? styles.statusPillTextBanned : styles.statusPillTextActive}>
                            {u.isBanned ? "Diblokir" : "Aktif"}
                          </Text>
                        </View>
                      </View>

                      {/* Action Button: Hanya Selengkapnya Saja (Rapi & Tidak Nempel) */}
                      <View style={[styles.actionBtnRow, { flex: 1.8 }]}>
                        <Pressable
                          onPress={() => handleOpenUserDetail(u)}
                          style={styles.moreBtn}
                        >
                          <AppIcon name="account-details" size={14} color="#FFFFFF" />
                          <Text style={styles.moreBtnText}>Selengkapnya</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      ) : activeUser ? (
        /* ─── 3. TAB CONTENT: USER DETAIL DASHBOARD ─── */
        <View style={styles.detailContainer}>
          {/* Header Profile Card (Tanpa Banner User) */}
          <View style={styles.profileHeaderCard}>
            <View style={styles.profileHeaderContent}>
              <View style={styles.profileAvatarCol}>
                <BorderAvatar
                  size={68}
                  avatarUrl={activeUser.avatarUrl || "https://images.alphacoders.com/132/1328004.png"}
                  borderId={activeUser.equippedBorder}
                />
              </View>

              <View style={styles.profileInfoCol}>
                <View style={styles.nameRow}>
                  <Text style={styles.profileDisplayName}>{activeUser.displayName || activeUser.username}</Text>
                  <Text style={styles.profileMemberNumber}>{activeUser.memberNumber}</Text>

                  {/* Tombol Tukar Nomor Member (#ID) */}
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      const otherUser = users.find((u) => u.id !== activeUser.id);
                      setSwapTargetUserId(otherUser?.id || "");
                      setShowSwapModal(true);
                    }}
                    style={styles.swapMemberBtn}
                  >
                    <AppIcon name="swap-horizontal" size={13} color="#FFFFFF" />
                    <Text style={styles.swapMemberBtnText}>Tukar #ID</Text>
                  </Pressable>

                  {/* Role Badge with Red Checkmark */}
                  <View style={[styles.roleBadgeLg, isSpecialRole(activeUser.role) ? styles.roleBadgeSpecial : styles.roleBadgeMember]}>
                    {isSpecialRole(activeUser.role) && <AppIcon name="check-decagram" size={15} color="#EF4444" />}
                    <Text style={[styles.roleBadgeLgText, isSpecialRole(activeUser.role) && styles.roleBadgeTextSpecial]}>
                      {activeUser.role || "Member"}
                    </Text>
                  </View>

                  {/* Status Pill */}
                  <View style={activeUser.isBanned ? styles.statusPillBanned : styles.statusPillActive}>
                    <Text style={activeUser.isBanned ? styles.statusPillTextBanned : styles.statusPillTextActive}>
                      {activeUser.isBanned ? "Akun Diblokir" : "Akun Aktif"}
                    </Text>
                  </View>
                </View>

                <View style={styles.profileMetaRow}>
                  <Text style={styles.profileUsernameText}>@{activeUser.username}</Text>
                  <Text style={styles.profileDot}>•</Text>
                  <Text style={styles.profileMetaText}>{activeUser.email}</Text>
                  <Text style={styles.profileDot}>•</Text>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setCopiedId(activeUser.id);
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                    style={styles.copyIdBtn}
                  >
                    <Text style={styles.profileIdText}>ID: {activeUser.id.substring(0, 10)}...</Text>
                    <AppIcon name={copiedId === activeUser.id ? "check" : "content-copy"} size={12} color="#38BDF8" />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Quick Stats Grid */}
            <View style={styles.quickStatsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxLabel}>SALDO CRYSTAL</Text>
                <Text style={[styles.statBoxValue, { color: "#38BDF8" }]}>
                  {activeUser.crystalBalance.toLocaleString("id-ID")}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxLabel}>LEVEL & EXP</Text>
                <Text style={styles.statBoxValue}>Lv.{activeUser.level} ({activeUser.exp} XP)</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxLabel}>STATUS VIP</Text>
                <Text style={[styles.statBoxValue, { color: activeUser.isVip ? "#F59E0B" : "#94A3B8" }]}>
                  {activeUser.isVip ? "VIP Member ⭐" : "Standar"}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxLabel}>TERDAFTAR</Text>
                <Text style={styles.statBoxValue}>
                  {activeUser.createdAt ? new Date(activeUser.createdAt).toLocaleDateString("id-ID") : "-"}
                </Text>
              </View>
            </View>
          </View>

          {/* Sub-Tabs Navigation for User Detail */}
          <View style={styles.subTabNavRow}>
            {[
              { id: "role", label: "Manajemen Role", icon: "shield-crown" },
              { id: "cooldown", label: "Cooldown", icon: "clock-fast" },
              { id: "balance", label: "Saldo Crystal", icon: "diamond-stone" },
              { id: "status", label: "Status Akun", icon: "account-cancel" },
              { id: "history", label: "Riwayat Pengguna", icon: "history" },
              {
                id: "friends",
                label: friendsList.length > 0 ? `Pertemanan (${friendsList.length})` : "Pertemanan",
                icon: "account-multiple",
              },
            ].map((st) => (
              <Pressable
                key={st.id}
                onPress={() => {
                  hapticLight();
                  setActiveDetailSubTab(st.id as UserDetailTab);
                }}
                style={[styles.subTabBtn, activeDetailSubTab === st.id && styles.subTabBtnActive]}
              >
                <AppIcon
                  name={st.icon as any}
                  size={15}
                  color={activeDetailSubTab === st.id ? "#38BDF8" : "#94A3B8"}
                />
                <Text style={[styles.subTabBtnText, activeDetailSubTab === st.id && styles.subTabBtnTextActive]}>
                  {st.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ─── SUBTAB 1: MANAJEMEN ROLE ─── */}
          {activeDetailSubTab === "role" && (
            <View style={styles.panelCard}>
              <View style={styles.panelHeaderRow}>
                <View>
                  <Text style={styles.panelTitle}>Manajemen Role Sistem</Text>
                  <Text style={styles.panelSubtitle}>
                    Tetapkan atau ubah role untuk @{activeUser.username}. Pengguna dengan role khusus akan menampilkan tanda centang merah resmi.
                  </Text>
                </View>

                <Pressable
                  onPress={() => {
                    hapticLight();
                    setSelectedNewRole(activeUser.role || "Member");
                    setShowRoleModal(true);
                  }}
                  style={styles.primaryActionBtn}
                >
                  <AppIcon name="shield-edit" size={15} color="#FFFFFF" />
                  <Text style={styles.primaryActionBtnText}>Ubah Role Akun</Text>
                </Pressable>
              </View>

              {/* Current Role Banner */}
              <View style={styles.currentRoleCard}>
                <View style={styles.currentRoleIconBox}>
                  <AppIcon name="shield-account" size={32} color={isSpecialRole(activeUser.role) ? "#EF4444" : "#38BDF8"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.currentRoleLabel}>ROLE SAAT INI</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <Text style={styles.currentRoleValue}>{activeUser.role || "Member"}</Text>
                    {isSpecialRole(activeUser.role) && (
                      <View style={styles.redCheckmarkPill}>
                        <AppIcon name="check-decagram" size={15} color="#EF4444" />
                        <Text style={styles.redCheckmarkText}>Ikon Centang Merah Aktif</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* 16 Roles Reference Grid */}
              <Text style={styles.sectionHeaderLabel}>16 Role Sistem Nuenime Tersedia:</Text>
              <View style={styles.roleGrid}>
                {NUENIME_USER_ROLES.map((r, idx) => {
                  const isCurrent = activeUser.role === r;
                  const isSpec = r !== "Member";
                  return (
                    <View
                      key={r}
                      style={[
                        styles.roleGridItem,
                        isCurrent && styles.roleGridItemCurrent,
                      ]}
                    >
                      <View style={styles.roleGridItemHeader}>
                        <Text style={styles.roleIndexNum}>#{idx + 1}</Text>
                        {isSpec ? (
                          <AppIcon name="check-decagram" size={15} color="#EF4444" />
                        ) : (
                          <AppIcon name="account" size={15} color="#64748B" />
                        )}
                      </View>
                      <Text style={[styles.roleGridName, isCurrent && { color: "#38BDF8" }]}>{r}</Text>
                      <Text style={styles.roleGridDesc}>
                        {r === "Super Admin"
                          ? "Kewenangan tertinggi & kontrol sistem menyeluruh"
                          : r === "Member"
                          ? "Role default seluruh pengguna baru Nuenime"
                          : `Role administratif / fungsional ${r}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ─── SUBTAB 2: COOLDOWN ─── */}
          {activeDetailSubTab === "cooldown" && (
            <View style={styles.panelCard}>
              <View style={styles.panelHeaderRow}>
                <View>
                  <Text style={styles.panelTitle}>Status Cooldown Akun</Text>
                  <Text style={styles.panelSubtitle}>
                    Pantau batas waktu perubahan profil dan batalkan / reset durasi cooldown jika pengguna membutuhkan bantuan.
                  </Text>
                </View>

                {/* Tombol Batalkan Semua Cooldown Sekaligus */}
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setCooldownType("all");
                    setShowCooldownModal(true);
                  }}
                  style={styles.primaryActionBtn}
                >
                  <AppIcon name="restore" size={15} color="#FFFFFF" />
                  <Text style={styles.primaryActionBtnText}>Batalkan Semua Cooldown</Text>
                </Pressable>
              </View>

              <View style={styles.cooldownGrid}>
                {/* 1. Nama Tampilan */}
                <View style={styles.cooldownCard}>
                  <View style={styles.cooldownCardHeader}>
                    <View style={styles.cooldownIconBox}>
                      <AppIcon name="card-account-details-outline" size={22} color="#38BDF8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cooldownCardTitle}>Perubahan Nama Profil</Text>
                      <Text style={styles.cooldownCardRule}>Batas: 1x dalam 24 jam</Text>
                    </View>
                  </View>

                  <View style={styles.cooldownStatusRow}>
                    <Text style={styles.cooldownStatusLabel}>Status:</Text>
                    <Text style={[styles.cooldownStatusVal, { color: nameCooldown.canChange ? "#10B981" : "#EF4444" }]}>
                      {nameCooldown.canChange ? "Tersedia Sekarang" : `Aktif (${nameCooldown.remainingText})`}
                    </Text>
                  </View>

                  <View style={styles.cooldownMetaRow}>
                    <Text style={styles.cooldownMetaText}>
                      Update Terakhir: {activeUser.nameUpdatedAt ? new Date(activeUser.nameUpdatedAt).toLocaleString("id-ID") : "Belum pernah diubah"}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setCooldownType("name");
                      setShowCooldownModal(true);
                    }}
                    style={styles.resetCooldownBtn}
                  >
                    <AppIcon name="restore" size={13} color="#FFFFFF" />
                    <Text style={styles.resetCooldownBtnText}>Reset Cooldown Nama</Text>
                  </Pressable>
                </View>

                {/* 2. Avatar Profil */}
                <View style={styles.cooldownCard}>
                  <View style={styles.cooldownCardHeader}>
                    <View style={styles.cooldownIconBox}>
                      <AppIcon name="account-circle-outline" size={22} color="#CBD5E1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cooldownCardTitle}>Perubahan Avatar</Text>
                      <Text style={styles.cooldownCardRule}>Batas: 1x dalam 24 jam</Text>
                    </View>
                  </View>

                  <View style={styles.cooldownStatusRow}>
                    <Text style={styles.cooldownStatusLabel}>Status:</Text>
                    <Text style={[styles.cooldownStatusVal, { color: avatarCooldown.canChange ? "#10B981" : "#EF4444" }]}>
                      {avatarCooldown.canChange ? "Tersedia Sekarang" : `Aktif (${avatarCooldown.remainingText})`}
                    </Text>
                  </View>

                  <View style={styles.cooldownMetaRow}>
                    <Text style={styles.cooldownMetaText}>
                      Update Terakhir: {activeUser.avatarUpdatedAt ? new Date(activeUser.avatarUpdatedAt).toLocaleString("id-ID") : "Belum pernah diubah"}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setCooldownType("avatar");
                      setShowCooldownModal(true);
                    }}
                    style={styles.resetCooldownBtn}
                  >
                    <AppIcon name="restore" size={13} color="#FFFFFF" />
                    <Text style={styles.resetCooldownBtnText}>Reset Cooldown Avatar</Text>
                  </Pressable>
                </View>

                {/* 3. Banner Profil */}
                <View style={styles.cooldownCard}>
                  <View style={styles.cooldownCardHeader}>
                    <View style={styles.cooldownIconBox}>
                      <AppIcon name="image-outline" size={22} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cooldownCardTitle}>Perubahan Banner</Text>
                      <Text style={styles.cooldownCardRule}>Batas: 1x dalam 7 hari</Text>
                    </View>
                  </View>

                  <View style={styles.cooldownStatusRow}>
                    <Text style={styles.cooldownStatusLabel}>Status:</Text>
                    <Text style={[styles.cooldownStatusVal, { color: bannerCooldown.canChange ? "#10B981" : "#EF4444" }]}>
                      {bannerCooldown.canChange ? "Tersedia Sekarang" : `Aktif (${bannerCooldown.remainingText})`}
                    </Text>
                  </View>

                  <View style={styles.cooldownMetaRow}>
                    <Text style={styles.cooldownMetaText}>
                      Update Terakhir: {activeUser.bannerUpdatedAt ? new Date(activeUser.bannerUpdatedAt).toLocaleString("id-ID") : "Belum pernah diubah"}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setCooldownType("banner");
                      setShowCooldownModal(true);
                    }}
                    style={styles.resetCooldownBtn}
                  >
                    <AppIcon name="restore" size={13} color="#FFFFFF" />
                    <Text style={styles.resetCooldownBtnText}>Reset Cooldown Banner</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* ─── SUBTAB 3: SALDO CRYSTAL ─── */}
          {activeDetailSubTab === "balance" && (
            <View style={styles.panelCard}>
              <View style={styles.panelHeaderRow}>
                <View>
                  <Text style={styles.panelTitle}>Manajemen Saldo Crystal</Text>
                  <Text style={styles.panelSubtitle}>
                    Tambah atau kurangi saldo Crystal secara aman. Setiap penyesuaian wajib mencantumkan alasan dan tercatat otomatis pada Audit Log.
                  </Text>
                </View>
              </View>

              <View style={styles.balanceControlBox}>
                <View style={styles.balanceDisplayCard}>
                  <Text style={styles.balanceCardLabel}>SALDO SAAT INI</Text>
                  <View style={styles.balanceRow}>
                    <AppIcon name="diamond-stone" size={32} color="#38BDF8" />
                    <Text style={styles.balanceBigNumber}>{activeUser.crystalBalance.toLocaleString("id-ID")}</Text>
                    <Text style={styles.balanceUnitText}>Crystal</Text>
                  </View>
                </View>

                {/* Form Adjustment */}
                <View style={styles.balanceFormCard}>
                  <Text style={styles.fieldLabel}>Tindakan:</Text>
                  <View style={styles.adjustModeRow}>
                    <Pressable
                      onPress={() => setAdjustMode("add")}
                      style={[styles.adjustModeChip, adjustMode === "add" && styles.adjustModeChipAddActive]}
                    >
                      <AppIcon name="plus" size={15} color={adjustMode === "add" ? "#FFFFFF" : "#10B981"} />
                      <Text style={[styles.adjustModeChipText, adjustMode === "add" && { color: "#FFFFFF" }]}>
                        Tambah Saldo (+)
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setAdjustMode("deduct")}
                      style={[styles.adjustModeChip, adjustMode === "deduct" && styles.adjustModeChipDeductActive]}
                    >
                      <AppIcon name="minus" size={15} color={adjustMode === "deduct" ? "#FFFFFF" : "#EF4444"} />
                      <Text style={[styles.adjustModeChipText, adjustMode === "deduct" && { color: "#FFFFFF" }]}>
                        Kurangi Saldo (−)
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Jumlah Crystal:</Text>
                  <TextInput
                    value={adjustAmount}
                    onChangeText={setAdjustAmount}
                    placeholder="Contoh: 500 atau 2000"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    style={styles.fieldInput}
                  />

                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Alasan Penyesuaian (Wajib):</Text>
                  <TextInput
                    value={adjustReason}
                    onChangeText={setAdjustReason}
                    placeholder="Contoh: Kompensasi bug / Hadiah event mingguan"
                    placeholderTextColor="#64748B"
                    style={styles.fieldInput}
                  />

                  {/* Calculation Preview */}
                  {Boolean(adjustAmount) && (
                    <View style={styles.calcPreviewBox}>
                      <Text style={styles.calcPreviewLabel}>Estimasi Saldo Setelah Transaksi:</Text>
                      <Text style={styles.calcPreviewVal}>
                        {activeUser.crystalBalance.toLocaleString("id-ID")} {adjustMode === "add" ? "+" : "−"}{" "}
                        {parseInt(adjustAmount || "0", 10).toLocaleString("id-ID")} ={" "}
                        {(
                          activeUser.crystalBalance +
                          (adjustMode === "add" ? parseInt(adjustAmount || "0", 10) : -parseInt(adjustAmount || "0", 10))
                        ).toLocaleString("id-ID")}{" "}
                        Crystal
                      </Text>
                    </View>
                  )}

                  <Pressable
                    disabled={adjusting}
                    onPress={handleAdjustBalance}
                    style={[
                      styles.submitAdjustBtn,
                      adjustMode === "add" ? styles.submitAdjustBtnAdd : styles.submitAdjustBtnDeduct,
                    ]}
                  >
                    <Text style={styles.submitAdjustBtnText}>
                      {adjusting
                        ? "Memproses..."
                        : adjustMode === "add"
                        ? "+ Terapkan Penambahan Saldo"
                        : "− Terapkan Pengurangan Saldo"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* ─── SUBTAB 4: STATUS AKUN (BLOKIR / BUKA BLOKIR) ─── */}
          {activeDetailSubTab === "status" && (
            <View style={styles.panelCard}>
              <View style={styles.panelHeaderRow}>
                <View>
                  <Text style={styles.panelTitle}>Moderasi Status Akun</Text>
                  <Text style={styles.panelSubtitle}>
                    Kelola status blokir akun pengguna. Akun yang diblokir tidak dapat masuk atau menggunakan aplikasi Nuenime.
                  </Text>
                </View>
              </View>

              <View style={styles.statusPanelBox}>
                <View style={[styles.statusHeroCard, activeUser.isBanned ? styles.statusHeroCardBanned : styles.statusHeroCardActive]}>
                  <View style={styles.statusHeroIconBox}>
                    <AppIcon
                      name={activeUser.isBanned ? "shield-alert" : "shield-check"}
                      size={36}
                      color={activeUser.isBanned ? "#EF4444" : "#10B981"}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusHeroTitle}>
                      {activeUser.isBanned ? "Akun Saat Ini Sedang DIBLOKIR" : "Akun Berstatus AKTIF & Normal"}
                    </Text>
                    <Text style={styles.statusHeroDesc}>
                      {activeUser.isBanned
                        ? `Akun diblokir pada ${activeUser.bannedAt ? new Date(activeUser.bannedAt).toLocaleString("id-ID") : "-"} oleh ${activeUser.bannedBy || "Admin"}.`
                        : "Pengguna memiliki hak akses penuh untuk menonton anime, gacha banner, dan transaksi Crystal."}
                    </Text>

                    {activeUser.isBanned && activeUser.banReason && (
                      <View style={styles.banReasonDisplayBox}>
                        <Text style={styles.banReasonDisplayLabel}>Alasan Pemblokiran:</Text>
                        <Text style={styles.banReasonDisplayText}>{activeUser.banReason}</Text>
                      </View>
                    )}
                  </View>

                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setBanReasonInput("");
                      setShowBanModal(true);
                    }}
                    style={[styles.banActionBtn, activeUser.isBanned ? styles.unbanActionBtn : styles.banActionBtnDanger]}
                  >
                    <AppIcon name={activeUser.isBanned ? "lock-open" : "lock"} size={16} color="#FFFFFF" />
                    <Text style={styles.banActionBtnText}>
                      {activeUser.isBanned ? "Buka Blokir Akun" : "Blokir Akun Pengguna"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* ─── SUBTAB 5: RIWAYAT PENGGUNA ─── */}
          {activeDetailSubTab === "history" && (
            <View style={styles.panelCard}>
              <View style={styles.panelHeaderRow}>
                <View>
                  <Text style={styles.panelTitle}>Riwayat Aktivitas & Transaksi Lengkap</Text>
                  <Text style={styles.panelSubtitle}>
                    Seluruh catatan riwayat asli akun @{activeUser.username} dari database (Akun, Crystal, Streaming, Administrasi, dan Gacha).
                  </Text>
                </View>

                {/* Filter Category Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyCatScroll}>
                  {[
                    { id: "all", label: "Semua" },
                    { id: "crystal", label: "Crystal & Top Up" },
                    { id: "gacha", label: "Gacha Spin" },
                    { id: "activity", label: "Streaming & Komentar" },
                    { id: "admin", label: "Administrasi" },
                  ].map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        hapticLight();
                        setHistoryCategory(cat.id as UserHistoryCategory);
                      }}
                      style={[styles.filterChip, historyCategory === cat.id && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, historyCategory === cat.id && styles.filterChipTextActive]}>
                        {cat.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* History Search Bar */}
              <View style={[styles.searchWrap, { maxWidth: "100%", marginBottom: 14 }]}>
                <AppIcon name="magnify" size={16} color="#94A3B8" />
                <TextInput
                  value={historySearch}
                  onChangeText={setHistorySearch}
                  placeholder="Cari transaksi, ID gacha, episode, atau catatan audit..."
                  placeholderTextColor="#64748B"
                  style={styles.searchInput}
                />
              </View>

              {/* History List */}
              {loadingHistory ? (
                <ActivityIndicator size="small" color="#38BDF8" style={{ padding: 30 }} />
              ) : historyItems.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <AppIcon name="history" size={40} color="#64748B" />
                  <Text style={styles.emptyTitle}>Belum Ada Riwayat Tercatat</Text>
                  <Text style={styles.emptyText}>Tidak ditemukan catatan untuk kategori yang dipilih pada akun ini.</Text>
                </View>
              ) : (
                <View style={styles.historyTableWrap}>
                  {historyItems.map((item) => (
                    <View key={item.id} style={styles.historyRow}>
                      <View style={styles.historyLeftCol}>
                        <View style={[styles.historyBadge, { backgroundColor: `${item.badgeColor || "#38BDF8"}20` }]}>
                          <Text style={[styles.historyBadgeText, { color: item.badgeColor || "#38BDF8" }]}>
                            {item.badge || item.category.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.historyTimeText}>{new Date(item.createdAt).toLocaleString("id-ID")}</Text>
                      </View>

                      <View style={styles.historyRightCol}>
                        <Text style={styles.historyTitleText}>{item.title}</Text>
                        <Text style={styles.historyDescText}>{item.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ─── SUBTAB 6: PERTEMANAN ─── */}
          {activeDetailSubTab === "friends" && (
            <View style={styles.panelCard}>
              <View style={styles.panelHeaderRow}>
                <View>
                  <Text style={styles.panelTitle}>Jaringan Pertemanan Pengguna</Text>
                  <Text style={styles.panelSubtitle}>
                    Daftar teman terhubung untuk akun @{activeUser.username} ({friendsList.length} teman terdaftar di sistem).
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      refreshFriendsList();
                    }}
                    style={styles.silverRefreshBtn}
                    accessibilityLabel="Segarkan daftar pertemanan"
                  >
                    <AppIcon name="refresh" size={15} color="#CBD5E1" />
                    <Text style={styles.silverRefreshBtnText}>Segarkan</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setShowConnectFriendModal(true);
                    }}
                    style={styles.primaryActionBtnSilver}
                    accessibilityLabel="Hubungkan teman baru"
                  >
                    <AppIcon name="account-plus" size={15} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>+ Hubungkan Teman</Text>
                  </Pressable>
                </View>
              </View>

              {/* Friends Search Bar */}
              <View style={[styles.searchWrap, { maxWidth: "100%", marginBottom: 14 }]}>
                <AppIcon name="account-search" size={16} color="#94A3B8" />
                <TextInput
                  value={friendsSearch}
                  onChangeText={setFriendsSearch}
                  placeholder="Cari teman berdasarkan nama atau @username..."
                  placeholderTextColor="#64748B"
                  style={styles.searchInput}
                />
              </View>

              {loadingFriends ? (
                <View style={{ padding: 40, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                  <Text style={{ color: "#94A3B8", marginTop: 8, fontSize: 12 }}>
                    Memuat daftar pertemanan...
                  </Text>
                </View>
              ) : friendsList.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <AppIcon name="account-group-outline" size={44} color="#64748B" />
                  <Text style={styles.emptyTitle}>Belum Ada Teman Terhubung</Text>
                  <Text style={styles.emptyText}>
                    Pengguna ini belum menambahkan atau memiliki pertemanan yang diterima di Nuenime.
                  </Text>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setShowConnectFriendModal(true);
                    }}
                    style={[styles.primaryActionBtnSilver, { marginTop: 14 }]}
                  >
                    <AppIcon name="account-plus" size={15} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Hubungkan Pengguna Ini Sekarang</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.friendsGrid}>
                  {friendsList.map((f) => {
                    const friendUserObj = users.find((u) => u.id === f.friendId);
                    return (
                      <View key={f.id} style={styles.friendCard}>
                        <View style={styles.avatarMiniWrap}>
                          {f.avatarUrl ? (
                            <Image source={{ uri: f.avatarUrl }} style={styles.avatarMini} />
                          ) : (
                            <View style={styles.avatarPlaceholder}>
                              <Text style={styles.avatarPlaceholderText}>{f.username[0]?.toUpperCase()}</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 140 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Text style={styles.friendNameText}>{f.displayName}</Text>
                            {f.memberNumber && (
                              <View style={styles.friendNumBadge}>
                                <Text style={styles.friendNumBadgeText}>{f.memberNumber}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.friendUsernameText}>@{f.username}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                            <View style={styles.friendLevelBadge}>
                              <Text style={styles.friendLevelBadgeText}>Lv.{f.level || 1}</Text>
                            </View>
                            <View
                              style={[
                                styles.friendStatusPill,
                                f.status === "accepted" ? styles.friendStatusAccepted : styles.friendStatusPending,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.friendStatusPillText,
                                  f.status === "accepted" ? { color: "#34D399" } : { color: "#F59E0B" },
                                ]}
                              >
                                {f.status === "accepted" ? "✓ Berteman" : "⏳ Menunggu"}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.friendDateText}>
                            Terhubung sejak {new Date(f.createdAt).toLocaleDateString("id-ID")}
                          </Text>
                        </View>

                        {/* Actions for each friend */}
                        <View style={styles.friendActionCol}>
                          {friendUserObj && (
                            <Pressable
                              onPress={() => {
                                handleOpenUserDetail(friendUserObj);
                              }}
                              style={styles.friendOpenTabBtn}
                              accessibilityLabel="Buka tab detail akun ini"
                            >
                              <AppIcon name="open-in-new" size={13} color="#38BDF8" />
                              <Text style={styles.friendOpenTabBtnText}>Buka Akun</Text>
                            </Pressable>
                          )}
                          <Pressable
                            onPress={() => {
                              hapticLight();
                              setFriendToDisconnect(f);
                              setShowDisconnectModal(true);
                            }}
                            style={styles.friendDisconnectBtn}
                            accessibilityLabel="Putuskan pertemanan"
                          >
                            <AppIcon name="link-off" size={13} color="#EF4444" />
                            <Text style={styles.friendDisconnectBtnText}>Putuskan</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      ) : null}

      {/* ─── MODAL KOREKSI SALDO (ADJUSTMENT) ─── */}
      <Modal visible={showAdjustModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Koreksi Saldo Crystal</Text>
            <Text style={styles.modalSub}>
              Pengguna: <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{activeUser?.username}</Text>
              {"\n"}Saldo Saat Ini: {activeUser?.crystalBalance.toLocaleString("id-ID")} Crystal
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Pilih Jenis Transaksi:</Text>
              <View style={styles.adjustModeRow}>
                <Pressable
                  onPress={() => setAdjustMode("add")}
                  style={[styles.adjustModeChip, adjustMode === "add" && styles.adjustModeChipAddActive]}
                >
                  <Text style={[styles.adjustModeChipText, adjustMode === "add" && { color: "#FFFFFF" }]}>
                    Tambah (+)
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setAdjustMode("deduct")}
                  style={[styles.adjustModeChip, adjustMode === "deduct" && styles.adjustModeChipDeductActive]}
                >
                  <Text style={[styles.adjustModeChipText, adjustMode === "deduct" && { color: "#FFFFFF" }]}>
                    Kurangi (−)
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Jumlah Crystal:</Text>
              <TextInput
                value={adjustAmount}
                onChangeText={setAdjustAmount}
                placeholder="Contoh: 1500"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Alasan Koreksi (Wajib Audit Log):</Text>
              <TextInput
                value={adjustReason}
                onChangeText={setAdjustReason}
                placeholder="Contoh: Kompensasi bug / Hadiah event komunitas"
                placeholderTextColor="#64748B"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable onPress={() => setShowAdjustModal(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable disabled={adjusting} onPress={handleAdjustBalance} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>{adjusting ? "Menyimpan..." : "Terapkan Perubahan"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL RESET COOLDOWN ─── */}
      <Modal visible={showCooldownModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Batalkan Cooldown Profil</Text>
                <Text style={styles.modalSubtitle}>Pengguna: @{activeUser?.username}</Text>
              </View>
              <Pressable onPress={() => setShowCooldownModal(false)} style={styles.modalCloseBtn}>
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Pilih Jenis Cooldown yang Ingin Dibatalkan:</Text>
              <View style={styles.cooldownTypeRow}>
                {(["all", "name", "avatar", "banner"] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setCooldownType(t)}
                    style={[styles.cooldownTypeChip, cooldownType === t && styles.cooldownTypeChipActive]}
                  >
                    <Text style={[styles.cooldownTypeText, cooldownType === t && styles.cooldownTypeTextActive]}>
                      {t === "all" ? "Semua Sekaligus" : t === "name" ? "Nama (24h)" : t === "avatar" ? "Avatar (24h)" : "Banner (7d)"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Alasan Pembatalan Cooldown (Wajib):</Text>
              <TextInput
                value={cooldownReason}
                onChangeText={setCooldownReason}
                placeholder="Contoh: Bantuan pergantian foto / Permintaan pengguna"
                placeholderTextColor="#64748B"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable onPress={() => setShowCooldownModal(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable disabled={resettingCooldown} onPress={handleResetCooldown} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>{resettingCooldown ? "Memproses..." : "Batalkan Cooldown"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL TUKAR NOMOR MEMBER (#ID) ─── */}
      <Modal visible={showSwapModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 500 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Tukar Nomor Member (#ID)</Text>
                <Text style={styles.modalSubtitle}>
                  Tukar nomor member @{activeUser?.username} ({activeUser?.memberNumber}) dengan pengguna lain.
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setShowSwapModal(false);
                  setSwapDropdownOpen(false);
                }}
                style={styles.modalCloseBtn}
              >
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            {/* User A Info */}
            <View style={styles.swapUserCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.swapCardSub}>AKUN SUMBER</Text>
                <Text style={styles.swapCardName}>{activeUser?.displayName || activeUser?.username}</Text>
                <Text style={styles.swapCardUser}>@{activeUser?.username}</Text>
              </View>
              <View style={styles.swapNumBadge}>
                <Text style={styles.swapNumBadgeText}>{activeUser?.memberNumber}</Text>
              </View>
            </View>

            {/* Target User Selector Dropdown */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Pilih Akun yang Ingin Ditukar Nomornya:</Text>
              <Pressable
                onPress={() => {
                  hapticLight();
                  setSwapDropdownOpen(!swapDropdownOpen);
                }}
                style={[styles.roleDropdownTrigger, swapDropdownOpen && styles.roleDropdownTriggerActive]}
              >
                {(() => {
                  const target = users.find((u) => u.id === swapTargetUserId);
                  return (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text style={[styles.swapNumBadgeText, { color: "#38BDF8" }]}>{target?.memberNumber || "-"}</Text>
                      <Text style={styles.roleDropdownSelectedText}>
                        {target ? `${target.displayName || target.username} (@${target.username})` : "Pilih akun..."}
                      </Text>
                    </View>
                  );
                })()}
                <AppIcon name={swapDropdownOpen ? "chevron-up" : "chevron-down"} size={18} color="#CBD5E1" />
              </Pressable>

              {swapDropdownOpen && (
                <View style={styles.roleDropdownMenu}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled showsVerticalScrollIndicator>
                    {users
                      .filter((u) => u.id !== activeUser?.id)
                      .map((u) => {
                        const isTarget = swapTargetUserId === u.id;
                        return (
                          <Pressable
                            key={u.id}
                            onPress={() => {
                              hapticLight();
                              setSwapTargetUserId(u.id);
                              setSwapDropdownOpen(false);
                            }}
                            style={[styles.roleDropdownItem, isTarget && styles.roleDropdownItemActive]}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                              <Text style={[styles.tdMember, { minWidth: 46 }]}>{u.memberNumber}</Text>
                              <View>
                                <Text style={styles.roleDropdownItemText}>{u.displayName || u.username}</Text>
                                <Text style={{ fontFamily: "Nunito-Regular", fontSize: 11, color: "#94A3B8" }}>
                                  @{u.username} • {u.role}
                                </Text>
                              </View>
                            </View>
                            {isTarget && <AppIcon name="check" size={16} color="#38BDF8" />}
                          </Pressable>
                        );
                      })}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Live Swap Preview */}
            {(() => {
              const target = users.find((u) => u.id === swapTargetUserId);
              if (!target) return null;
              return (
                <View style={styles.swapPreviewBox}>
                  <Text style={styles.swapPreviewLabel}>HASIL PERTUKARAN NOMOR:</Text>
                  <View style={styles.swapPreviewRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.swapPreviewUser}>@{activeUser?.username}</Text>
                      <Text style={styles.swapPreviewArrow}>
                        {activeUser?.memberNumber} ➔ <Text style={{ color: "#38BDF8", fontWeight: "800" }}>{target.memberNumber}</Text>
                      </Text>
                    </View>
                    <View style={{ width: 1, height: 28, backgroundColor: "rgba(255, 255, 255, 0.1)" }} />
                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text style={styles.swapPreviewUser}>@{target.username}</Text>
                      <Text style={styles.swapPreviewArrow}>
                        {target.memberNumber} ➔ <Text style={{ color: "#38BDF8", fontWeight: "800" }}>{activeUser?.memberNumber}</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Alasan Pertukaran Nomor (Wajib Catat Audit):</Text>
              <TextInput
                value={swapReason}
                onChangeText={setSwapReason}
                placeholder="Contoh: Penyesuaian nomor member VIP / Permintaan owner"
                placeholderTextColor="#64748B"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => {
                  setShowSwapModal(false);
                  setSwapDropdownOpen(false);
                }}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                disabled={swapping || !swapTargetUserId}
                onPress={handleSwapMemberNumbers}
                style={[styles.modalConfirmBtn, (!swapTargetUserId || swapping) && { opacity: 0.5 }]}
              >
                <Text style={styles.modalConfirmText}>{swapping ? "Menukar..." : "Konfirmasi Tukar #ID"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL UBAH ROLE (DROPDOWN VERSION) ─── */}
      <Modal visible={showRoleModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 500 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Ubah Role Akun Pengguna</Text>
                <Text style={styles.modalSubtitle}>
                  Pengguna: @{activeUser?.username} • Role Saat Ini: {activeUser?.role || "Member"}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setShowRoleModal(false);
                  setRoleDropdownOpen(false);
                }}
                style={styles.modalCloseBtn}
              >
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            {/* Dropdown Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Pilih Role Baru (16 Role Tersedia):</Text>
              <Pressable
                onPress={() => {
                  hapticLight();
                  setRoleDropdownOpen(!roleDropdownOpen);
                }}
                style={[
                  styles.roleDropdownTrigger,
                  roleDropdownOpen && styles.roleDropdownTriggerActive,
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <AppIcon
                    name={isSpecialRole(selectedNewRole) ? "check-decagram" : "account"}
                    size={17}
                    color={isSpecialRole(selectedNewRole) ? "#EF4444" : "#38BDF8"}
                  />
                  <Text style={styles.roleDropdownSelectedText}>
                    {selectedNewRole}
                  </Text>
                  {isSpecialRole(selectedNewRole) && (
                    <View style={styles.specialRolePillMini}>
                      <Text style={styles.specialRolePillMiniText}>Khusus</Text>
                    </View>
                  )}
                </View>
                <AppIcon
                  name={roleDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#CBD5E1"
                />
              </Pressable>

              {/* Dropdown Menu List */}
              {roleDropdownOpen && (
                <View style={styles.roleDropdownMenu}>
                  <ScrollView
                    style={{ maxHeight: 220 }}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    {NUENIME_USER_ROLES.map((r) => {
                      const isSelected = selectedNewRole === r;
                      const isSpec = isSpecialRole(r);
                      return (
                        <Pressable
                          key={r}
                          onPress={() => {
                            hapticLight();
                            setSelectedNewRole(r);
                            setRoleDropdownOpen(false);
                          }}
                          style={[
                            styles.roleDropdownItem,
                            isSelected && styles.roleDropdownItemActive,
                          ]}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                            <AppIcon
                              name={isSpec ? "check-decagram" : "account"}
                              size={15}
                              color={isSpec ? "#EF4444" : "#94A3B8"}
                            />
                            <Text
                              style={[
                                styles.roleDropdownItemText,
                                isSelected && styles.roleDropdownItemTextActive,
                              ]}
                            >
                              {r}
                            </Text>
                          </View>
                          {isSelected && (
                            <AppIcon name="check" size={16} color="#38BDF8" />
                          )}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={[styles.formGroup, { marginTop: 4 }]}>
              <Text style={styles.fieldLabel}>Alasan Perubahan Role (Wajib Catat Audit):</Text>
              <TextInput
                value={roleChangeReason}
                onChangeText={setRoleChangeReason}
                placeholder="Contoh: Promosi staff tim developer / Penugasan QA"
                placeholderTextColor="#64748B"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => {
                  setShowRoleModal(false);
                  setRoleDropdownOpen(false);
                }}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable disabled={savingRole} onPress={handleSaveRole} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>{savingRole ? "Menyimpan..." : "Simpan Role"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL BLOKIR / BUKA BLOKIR ─── */}
      <Modal visible={showBanModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, activeUser?.isBanned ? { color: "#10B981" } : { color: "#EF4444" }]}>
              {activeUser?.isBanned ? "Buka Blokir Akun" : "Konfirmasi Blokir Akun"}
            </Text>
            <Text style={styles.modalSub}>
              Pengguna: <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{activeUser?.username}</Text>
              {"\n"}
              {activeUser?.isBanned
                ? "Apakah Anda yakin ingin membuka blokir akun ini? Pengguna akan dapat masuk kembali ke aplikasi."
                : "Akun ini akan diblokir dari akses APK Nuenime. Harap masukkan alasan yang jelas."}
            </Text>

            {!activeUser?.isBanned && (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Alasan Pemblokiran (Wajib):</Text>
                <TextInput
                  value={banReasonInput}
                  onChangeText={setBanReasonInput}
                  placeholder="Contoh: Pelanggaran ketentuan komunitas / Akun mencurigakan"
                  placeholderTextColor="#64748B"
                  style={styles.fieldInput}
                />
              </View>
            )}

            <View style={styles.modalActionRow}>
              <Pressable onPress={() => setShowBanModal(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                disabled={savingBanStatus}
                onPress={handleToggleBanStatus}
                style={[styles.modalConfirmBtn, !activeUser?.isBanned && { backgroundColor: "#EF4444" }]}
              >
                <Text style={styles.modalConfirmText}>
                  {savingBanStatus
                    ? "Menyimpan..."
                    : activeUser?.isBanned
                    ? "Konfirmasi Buka Blokir"
                    : "Konfirmasi Blokir Akun"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL HUBUNGKAN TEMAN BARU ─── */}
      <Modal visible={showConnectFriendModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Hubungkan Pertemanan Baru</Text>
            <Text style={styles.modalSub}>
              Hubungkan akun <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>@{activeUser?.username}</Text> dengan pengguna lain secara instan di Nuenime.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Pilih Teman yang Ingin Dihubungkan:</Text>
              <ScrollView style={{ maxHeight: 180, backgroundColor: "rgba(255, 255, 255, 0.03)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.08)", padding: 6 }}>
                {users
                  .filter((u) => u.id !== activeUser?.id && !friendsList.some((f) => f.friendId === u.id))
                  .map((u) => {
                    const isSelected = targetFriendUserId === u.id;
                    return (
                      <Pressable
                        key={u.id}
                        onPress={() => setTargetFriendUserId(u.id)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingVertical: 8,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          backgroundColor: isSelected ? "rgba(56, 189, 248, 0.15)" : "transparent",
                          marginBottom: 4,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>{u.username[0]?.toUpperCase()}</Text>
                          </View>
                          <View>
                            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>{u.displayName}</Text>
                            <Text style={{ color: "#94A3B8", fontSize: 10 }}>@{u.username} • {u.memberNumber}</Text>
                          </View>
                        </View>
                        {isSelected && <AppIcon name="check-circle" size={16} color="#38BDF8" />}
                      </Pressable>
                    );
                  })}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Alasan / Catatan Admin:</Text>
              <TextInput
                value={connectFriendReason}
                onChangeText={setConnectFriendReason}
                placeholder="Contoh: Permintaan bantuan CS / Verifikasi relasi akun"
                placeholderTextColor="#64748B"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable onPress={() => setShowConnectFriendModal(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                disabled={connectingFriend || !targetFriendUserId}
                onPress={handleConnectFriend}
                style={[styles.primaryActionBtnSilver, (!targetFriendUserId || connectingFriend) && { opacity: 0.5 }]}
              >
                <Text style={styles.primaryActionBtnText}>
                  {connectingFriend ? "Menghubungkan..." : "Konfirmasi Hubungkan"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL PUTUSKAN PERTEMANAN ─── */}
      <Modal visible={showDisconnectModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: "#EF4444" }]}>Putuskan Pertemanan</Text>
            <Text style={styles.modalSub}>
              Apakah Anda yakin ingin memutuskan hubungan pertemanan antara{" "}
              <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>@{activeUser?.username}</Text> dan{" "}
              <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>@{friendToDisconnect?.username}</Text>?
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Alasan Pemutusan (Wajib):</Text>
              <TextInput
                value={disconnectReason}
                onChangeText={setDisconnectReason}
                placeholder="Contoh: Laporan spam pertemanan / Permintaan pengguna"
                placeholderTextColor="#64748B"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => {
                  setShowDisconnectModal(false);
                  setFriendToDisconnect(null);
                }}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                disabled={disconnectingFriend}
                onPress={handleDisconnectFriend}
                style={[styles.modalConfirmBtn, { backgroundColor: "#EF4444" }]}
              >
                <Text style={styles.modalConfirmText}>
                  {disconnectingFriend ? "Memutuskan..." : "Konfirmasi Putuskan"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  // ── 1. Top In-Page Tab Bar
  tabBarContainer: {
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    marginBottom: 14,
    borderRadius: 12,
    padding: 6,
  },
  tabBarScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  tabButtonActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  tabButtonText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#94A3B8",
  },
  tabButtonTextActive: {
    fontFamily: "Nunito-Bold",
    color: "#FFFFFF",
  },
  bannedMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EF4444",
  },
  closeTabBtn: {
    marginLeft: 4,
    padding: 2,
    borderRadius: 4,
  },

  contentSection: {
    gap: 14,
  },

  // ── 2. Top KPI Strip (Matching borders.tsx)
  kpiStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    padding: 16,
    gap: 16,
    marginBottom: 2,
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

  // ── 3. Search & Filter Section (Matching borders.tsx)
  filterCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 12,
    marginBottom: 2,
  },
  topFilterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
    flexWrap: "wrap",
    gap: 8,
  },
  filterSectionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  refreshBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },
  searchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    minWidth: 260,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  statusFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statusFilterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  statusFilterChipActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  statusFilterText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  statusFilterTextActive: {
    color: "#FFFFFF",
  },

  // ── 4. Table Container
  cardBox: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  tableWrap: {
    gap: 2,
  },
  thRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 8,
  },
  th: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
    letterSpacing: 0.3,
  },
  trRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  trRowBanned: {
    backgroundColor: "rgba(239, 68, 68, 0.04)",
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

  avatarMiniWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
  },
  avatarMini: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPlaceholderText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },

  // Role Badges
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeMember: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  roleBadgeSpecial: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
  },
  roleBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  roleBadgeTextSpecial: {
    color: "#FCA5A5",
  },

  roleBadgeLg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeLgText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },

  // Status
  statusPillActive: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusPillTextActive: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#10B981",
  },
  statusPillBanned: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.18)",
  },
  statusPillTextBanned: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#EF4444",
  },

  // ── 5. Action Buttons (Clean Silver Theme matching borders.tsx)
  actionBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  moreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  moreBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },
  adjustBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  adjustBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  cooldownBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  cooldownBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
  },

  // ── 6. User Detail Screen
  detailContainer: {
    gap: 16,
  },
  profileHeaderCard: {
    backgroundColor: "#0D1117",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  profileHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  profileAvatarCol: {
    zIndex: 2,
  },
  profileInfoCol: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  profileDisplayName: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
  },
  profileMemberNumber: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
  },
  swapMemberBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 6,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.28)",
  },
  swapMemberBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },
  swapUserCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginBottom: 4,
  },
  swapCardSub: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#64748B",
    marginBottom: 2,
  },
  swapCardName: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  swapCardUser: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  swapNumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  swapNumBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#38BDF8",
  },
  swapPreviewBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
    marginVertical: 4,
  },
  swapPreviewLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#38BDF8",
    marginBottom: 6,
  },
  swapPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  swapPreviewUser: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  swapPreviewArrow: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    marginTop: 2,
  },
  profileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  profileUsernameText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#94A3B8",
  },
  profileDot: {
    color: "#64748B",
  },
  profileMetaText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
  },
  copyIdBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  profileIdText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#38BDF8",
  },
  quickStatsGrid: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  statBox: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.06)",
  },
  statBoxLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#64748B",
    marginBottom: 2,
  },
  statBoxValue: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },

  // ── 7. SubTab Navigation
  subTabNavRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  subTabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  subTabBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  subTabBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  subTabBtnTextActive: {
    color: "#FFFFFF",
  },

  // ── 8. Panels
  panelCard: {
    backgroundColor: "#0D1117",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 16,
  },
  panelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  panelTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  panelSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  primaryActionBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  // Current Role Display
  currentRoleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  currentRoleIconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  currentRoleLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#64748B",
  },
  currentRoleValue: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
  },
  redCheckmarkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  redCheckmarkText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FCA5A5",
  },

  sectionHeaderLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#CBD5E1",
    marginTop: 4,
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  roleGridItem: {
    width: "23.5%",
    minWidth: 180,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    gap: 4,
  },
  roleGridItemCurrent: {
    borderColor: "rgba(255, 255, 255, 0.30)",
    backgroundColor: "rgba(255, 255, 255, 0.10)",
  },
  roleGridItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roleIndexNum: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#64748B",
  },
  roleGridName: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  roleGridDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
    lineHeight: 14,
  },

  // Cooldown Grid
  cooldownGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  cooldownCard: {
    flex: 1,
    minWidth: 260,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 10,
  },
  cooldownCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cooldownIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  cooldownCardTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  cooldownCardRule: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  cooldownStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cooldownStatusLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
  },
  cooldownStatusVal: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
  },
  cooldownMetaRow: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.04)",
    paddingTop: 8,
  },
  cooldownMetaText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },
  resetCooldownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  resetCooldownBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },

  // Balance Control
  balanceControlBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  balanceDisplayCard: {
    flex: 1,
    minWidth: 260,
    padding: 20,
    borderRadius: 14,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
    justifyContent: "center",
  },
  balanceCardLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
    marginBottom: 6,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  balanceBigNumber: {
    fontFamily: "Nunito-Black",
    fontSize: 32,
    color: "#FFFFFF",
  },
  balanceUnitText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#94A3B8",
  },
  balanceFormCard: {
    flex: 2,
    minWidth: 320,
    padding: 20,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  adjustModeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  adjustModeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  adjustModeChipAddActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  adjustModeChipDeductActive: {
    backgroundColor: "#EF4444",
    borderColor: "#EF4444",
  },
  adjustModeChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  calcPreviewBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.15)",
  },
  calcPreviewLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#64748B",
  },
  calcPreviewVal: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
    marginTop: 2,
  },
  submitAdjustBtn: {
    marginTop: 16,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
  },
  submitAdjustBtnAdd: {
    backgroundColor: "#10B981",
  },
  submitAdjustBtnDeduct: {
    backgroundColor: "#EF4444",
  },
  submitAdjustBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },

  // Status Akun Panel
  statusPanelBox: {
    gap: 14,
  },
  statusHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusHeroCardActive: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  statusHeroCardBanned: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  statusHeroIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusHeroTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  statusHeroDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
    lineHeight: 18,
  },
  banReasonDisplayBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  banReasonDisplayLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#FCA5A5",
  },
  banReasonDisplayText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#EF4444",
  },
  banActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  banActionBtnDanger: {
    backgroundColor: "#EF4444",
  },
  unbanActionBtn: {
    backgroundColor: "#10B981",
  },
  banActionBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },

  // History Tab
  historyCatScroll: {
    flexDirection: "row",
    gap: 8,
  },
  historyTableWrap: {
    gap: 8,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    gap: 16,
  },
  historyLeftCol: {
    width: 150,
    gap: 4,
  },
  historyBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
  },
  historyTimeText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },
  historyRightCol: {
    flex: 1,
    gap: 2,
  },
  historyTitleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  historyDescText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },

  // Friends Tab (Silver Liquid Glass & Cards)
  silverRefreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  silverRefreshBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },
  primaryActionBtnSilver: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  friendsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "48%",
    minWidth: 280,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  friendNameText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  friendNumBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  friendNumBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    color: "#CBD5E1",
  },
  friendUsernameText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#38BDF8",
  },
  friendLevelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  friendLevelBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
    color: "#38BDF8",
  },
  friendStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  friendStatusAccepted: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  friendStatusPending: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  friendStatusPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
  },
  friendDateText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
    marginTop: 4,
  },
  friendActionCol: {
    gap: 6,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  friendOpenTabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
  },
  friendOpenTabBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#38BDF8",
  },
  friendDisconnectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  friendDisconnectBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#EF4444",
  },

  // ── 9. Modals (Matching borders.tsx)
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#0D1117",
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16.5,
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    marginTop: 2,
    lineHeight: 16,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  modalSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
    marginBottom: 8,
    lineHeight: 18,
  },
  formGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  fieldInput: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8.5,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  modalCancelText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  modalConfirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8.5,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  modalConfirmText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  // ── Role Dropdown Selector
  roleDropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 2,
  },
  roleDropdownTriggerActive: {
    borderColor: "rgba(255, 255, 255, 0.35)",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  roleDropdownSelectedText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  specialRolePillMini: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  specialRolePillMiniText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#EF4444",
  },
  roleDropdownMenu: {
    marginTop: 6,
    borderRadius: 8,
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    overflow: "hidden",
  },
  roleDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 9.5,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  roleDropdownItemActive: {
    backgroundColor: "rgba(255, 255, 255, 0.10)",
  },
  roleDropdownItemText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12.5,
    color: "#CBD5E1",
  },
  roleDropdownItemTextActive: {
    fontFamily: "Nunito-Bold",
    color: "#FFFFFF",
  },

  // Cooldown Type Chips
  cooldownTypeRow: {
    flexDirection: "row",
    gap: 8,
  },
  cooldownTypeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
  },
  cooldownTypeChipActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  cooldownTypeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  cooldownTypeTextActive: {
    color: "#FFFFFF",
  },

  // Filter & Search Wrap (Shared between Main & Detail Tabs)
  searchWrap: {
    flex: 1,
    minWidth: 260,
    maxWidth: 420,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  filterChipActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  filterChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },

  // Role Selection Chips inside Modal (Fallback)
  roleSelectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleSelectChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  roleSelectChipActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  roleSelectChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  roleSelectChipTextActive: {
    color: "#FFFFFF",
  },

  // Empty State
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: 36,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  emptyText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
  },
});
