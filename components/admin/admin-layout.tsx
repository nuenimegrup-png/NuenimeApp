import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { AppIcon } from "@/components/app-icon";
import { hapticLight } from "@/lib/haptics";
import {
  type AdminRole,
  type AdminUser,
  canManageFinance,
  canManageUsers,
  canModerate,
  canManageSystem,
} from "@/lib/admin-service";
import { AdminLogin, STORAGE_ADMIN_SESSION } from "@/components/admin/admin-login";

export interface AdminLayoutProps {
  title: string;
  subtitle?: string;
  activeKey?: string;
  children: React.ReactNode;
}

interface MenuItemDef {
  key: string;
  label: string;
  icon: string;
  route: string;
  badge?: string;
  badgeColor?: string;
  section?: string;
  requiresPerm?: (role: AdminRole) => boolean;
}

const MENU_ITEMS: MenuItemDef[] = [
  // ─── DASHBOARD ───
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "view-dashboard",
    route: Platform.OS === "web" ? "/" : "/admin",
    section: "UTAMA",
  },
  // ─── TRANSAKSI & SALDO ───
  {
    key: "finance",
    label: "Finance & Top Up",
    icon: "credit-card",
    route: "/admin/finance",
    badge: "VIP",
    badgeColor: "#F59E0B",
    requiresPerm: canManageFinance,
  },
  {
    key: "users",
    label: "Kelola Pengguna",
    icon: "account-group",
    route: "/admin/users",
    section: "PENGGUNA",
  },
  // ─── INVENTORY & BORDERS ───
  {
    key: "borders",
    label: "Inventory & Border",
    icon: "shield-star",
    route: "/admin/borders",
    section: "GAMEPLAY & ASET",
  },
  {
    key: "gacha",
    label: "Gacha & Crystal Store",
    icon: "crystal-ball",
    route: "/admin/gacha",
  },
  {
    key: "gamification",
    label: "Gamification & EXP",
    icon: "trophy-outline",
    route: "/admin/gamification",
  },
  // ─── COMMUNITY ───
  {
    key: "community",
    label: "Community & Mod",
    icon: "comment-text-multiple",
    route: "/admin/community",
    section: "KOMUNITAS",
  },
  // ─── CMS ───
  {
    key: "cms",
    label: "Anime CMS & Stream",
    icon: "movie-open-outline",
    route: "/admin/cms",
    section: "KONTEN",
  },
  // ─── SYSTEM ───
  {
    key: "system",
    label: "System & APK Update",
    icon: "android",
    route: "/admin/system",
    section: "SISTEM",
  },
  {
    key: "support",
    label: "Support & Saweria",
    icon: "headset",
    route: "/admin/support",
  },
  {
    key: "developers",
    label: "Team Developer",
    icon: "account-group",
    route: "/admin/developers",
  },
  {
    key: "analytics",
    label: "Analytics & Reports",
    icon: "chart-bar",
    route: "/admin/analytics",
  },
  {
    key: "audit",
    label: "Roles, Akun & Audit",
    icon: "shield-account",
    route: "/admin/audit",
    section: "KEAMANAN",
  },
  {
    key: "settings",
    label: "Settings",
    icon: "cog",
    route: "/admin/settings",
  },
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  title,
  subtitle,
  children,
}) => {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 992;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authentication State
  const [sessionAdmin, setSessionAdmin] = useState<AdminUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Dropdown States: null | "user" | "notifications" | "search"
  const [activeDropdown, setActiveDropdown] = useState<"user" | "notifications" | "search" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCount, setUnreadCount] = useState(3);

  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_ADMIN_SESSION);
        if (stored && isMounted) {
          const parsed = JSON.parse(stored) as AdminUser;
          setSessionAdmin(parsed);
        }
      } catch (err) {
        console.warn("Failed to check admin session", err);
      } finally {
        if (isMounted) setCheckingAuth(false);
      }
    };

    checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    hapticLight();
    setActiveDropdown(null);
    try {
      await AsyncStorage.removeItem(STORAGE_ADMIN_SESSION);
    } catch {}
    setSessionAdmin(null);
  };

  const handleNavigate = (route: string) => {
    hapticLight();
    setActiveDropdown(null);
    setMobileMenuOpen(false);
    if (route === "/admin/index" || route === "/admin" || route === "/") {
      if (Platform.OS === "web") {
        router.replace("/" as any);
        return;
      }
    }
    router.replace(route as any);
  };

  // 1. Tampilkan loading jika sedang memverifikasi sesi
  if (checkingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#CBD5E1" />
        <Text style={styles.loadingText}>Memuat Otentikasi Admin...</Text>
      </View>
    );
  }

  // 2. Jika belum login, tampilkan layar Admin Login
  if (!sessionAdmin) {
    return (
      <AdminLogin
        onLoginSuccess={(user) => {
          setSessionAdmin(user);
        }}
      />
    );
  }

  // Peran aktif yang ditentukan oleh akun yang sedang login
  const currentRole: AdminRole = sessionAdmin.role || "super_admin";
  const roleAccentColor =
    currentRole === "super_admin"
      ? "#E2E8F0"
      : currentRole === "finance_admin"
      ? "#38BDF8"
      : "#10B981";

  const roleLabel =
    currentRole === "super_admin"
      ? "Super Admin"
      : currentRole === "finance_admin"
      ? "Finance Admin"
      : "Moderator";

  const roleIcon =
    currentRole === "super_admin"
      ? "shield-crown-outline"
      : currentRole === "finance_admin"
      ? "credit-card"
      : "shield-account-outline";

  // Data Searchable Modules
  const searchableModules = [
    { title: "Dashboard Eksekutif", desc: "Ringkasan metrik & KPI sistem", route: Platform.OS === "web" ? "/" : "/admin", icon: "view-dashboard" },
    { title: "Verifikasi Keuangan & Top Up", desc: "Setujui mutasi bayar & penarikan Crystal", route: "/admin/finance", icon: "credit-card" },
    { title: "Kelola Pengguna & Saldo", desc: "Koreksi saldo Crystal & reset cooldown", route: "/admin/users", icon: "account-group" },
    { title: "Koleksi Avatar Border Shop", desc: "Upload frame aset, rarity & rilis toko", route: "/admin/borders", icon: "shield-star" },
    { title: "Gacha Banner & Hadiah Mailbox", desc: "Atur rate banner & hadiah massal user", route: "/admin/gacha", icon: "crystal-ball" },
    { title: "Gamifikasi & Leaderboard Top 50", desc: "Aturan EXP nonton & peringkat pengguna", route: "/admin/gamification", icon: "trophy-outline" },
    { title: "Moderasi Komunitas & Komentar", desc: "Filter kata terlarang & sensor feed anime", route: "/admin/community", icon: "comment-text-multiple" },
    { title: "Konten Anime & Spotlight Banner", desc: "Kurasi anime unggulan & episode update", route: "/admin/cms", icon: "movie-open-outline" },
    { title: "Sistem, Maintenance & Update APK", desc: "Auto-sync GitHub release & pesan siaran", route: "/admin/system", icon: "android" },
    { title: "Bantuan CS & Integrasi Saweria", desc: "Kelola tiket bantuan pengguna & donasi", route: "/admin/support", icon: "headset" },
    { title: "Team Developer & Kontributor", desc: "Daftar staf teknis pengembang Nuenime", route: "/admin/developers", icon: "account-group" },
    { title: "Statistik & Analisis Tayangan", desc: "Grafik engagement & performa pemutaran", route: "/admin/analytics", icon: "chart-bar" },
    { title: "Audit Trail & Manajemen Akun Staf", desc: "Buat akun admin baru & riwayat aktivitas", route: "/admin/audit", icon: "shield-account" },
    { title: "Pengaturan Sistem & Gateway", desc: "Konfigurasi environment database & cache", route: "/admin/settings", icon: "cog" },
  ];

  const filteredModules = searchableModules.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Data Notifikasi Admin
  const adminNotifications = [
    {
      id: "notif-1",
      title: "Verifikasi Top Up Crystal",
      desc: "Transaksi pembayaran QRIS menunggu tinjauan manual staf finance.",
      route: "/admin/finance",
      time: "Baru saja",
      icon: "credit-card",
      color: "#38BDF8",
    },
    {
      id: "notif-2",
      title: "Tiket Bantuan Masuk",
      desc: "Pengguna melaporkan kendala video buffer pada episode anime.",
      route: "/admin/support",
      time: "20 mnt lalu",
      icon: "headset",
      color: "#F59E0B",
    },
    {
      id: "notif-3",
      title: "Sesi Login Terverifikasi",
      desc: `Aktif login sebagai ${sessionAdmin.username} (${roleLabel}).`,
      route: "/admin/audit",
      time: "Hari ini",
      icon: "shield-account",
      color: "#10B981",
    },
  ];

  const renderSidebar = () => (
    <View style={styles.sidebarContainer}>
      {/* ─── BRAND HEADER DENGAN LOGO BESAR ─── */}
      <View style={styles.brandHeader}>
        <Image
          source={require("@/assets/images/nuenime-logo.png")}
          style={styles.brandLogoImage}
          contentFit="contain"
          transition={300}
        />
        <Text style={styles.brandSubtitle}>Admin Dashboard</Text>
      </View>

      {/* ─── NAVIGATION MENU ─── */}
      <ScrollView
        style={styles.menuScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.menuScrollContent}
      >
        {MENU_ITEMS.map((item, index) => {
          const isDashboard = item.key === "dashboard";
          const isActive = isDashboard
            ? pathname === "/" || pathname === "/admin" || pathname === "/admin/index" || !pathname
            : pathname === item.route || (item.route !== "/" && item.route !== "/admin" && pathname.startsWith(item.route));

          const hasPerm = item.requiresPerm ? item.requiresPerm(currentRole) : true;

          return (
            <React.Fragment key={item.key}>
              {item.section ? (
                <View style={[styles.sectionHeaderWrap, index > 0 && { marginTop: 16 }]}>
                  <Text style={styles.sectionHeaderText}>{item.section}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => {
                  if (hasPerm) handleNavigate(item.route);
                }}
                disabled={!hasPerm}
                style={({ pressed }) => [
                  styles.menuItem,
                  isActive && styles.menuItemActive,
                  !hasPerm && styles.menuItemDisabled,
                  pressed && hasPerm && styles.menuItemPressed,
                ]}
              >
                <View style={styles.menuIconWrap}>
                  <AppIcon
                    name={item.icon}
                    size={17}
                    color={isActive ? "#FFFFFF" : hasPerm ? "#94A3B8" : "#4B4458"}
                  />
                </View>
                <Text
                  style={[
                    styles.menuLabel,
                    isActive && styles.menuLabelActive,
                    !hasPerm && styles.menuLabelDisabled,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {item.badge ? (
                  <View
                    style={[
                      styles.menuBadge,
                      { backgroundColor: item.badgeColor || "rgba(255, 255, 255, 0.16)" },
                    ]}
                  >
                    <Text style={styles.menuBadgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            </React.Fragment>
          );
        })}

        {/* Logout Button in Sidebar */}
        <View style={styles.sidebarLogoutWrap}>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.sidebarLogoutBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <AppIcon name="logout-variant" size={17} color="#F87171" />
            <Text style={styles.sidebarLogoutText}>Keluar Sesi Admin</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Sidebar Desktop (Fixed) */}
      {isDesktop ? renderSidebar() : null}

      {/* Main Content Area */}
      <View style={styles.mainContainer}>
        {/* Top Navbar */}
        <SafeAreaView edges={["top"]} style={styles.navbarContainer}>
          <View style={styles.navbarInner}>
            {!isDesktop ? (
              <Pressable
                onPress={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={styles.menuToggleBtn}
              >
                <AppIcon name="menu" size={24} color="#FFFFFF" />
              </Pressable>
            ) : null}

            <View style={styles.navbarTitleWrap}>
              <Text style={styles.navbarTitle}>{title}</Text>
              {subtitle ? (
                <Text style={styles.navbarSubtitle}>{subtitle}</Text>
              ) : null}
            </View>

            {/* ─── TOP NAVBAR RIGHT AREA ─── */}
            <View style={styles.navbarRightArea}>
              {/* 1. Icon Pencarian */}
              <Pressable
                onPress={() => {
                  hapticLight();
                  setActiveDropdown(activeDropdown === "search" ? null : "search");
                }}
                style={({ pressed }) => [
                  styles.headerIconBtn,
                  activeDropdown === "search" && styles.headerIconBtnActive,
                  pressed && { opacity: 0.8 },
                ]}
                accessibilityLabel="Pencarian Cepat Admin"
              >
                <AppIcon
                  name="magnify"
                  size={19}
                  color={activeDropdown === "search" ? "#FFFFFF" : "#CBD5E1"}
                />
              </Pressable>

              {/* 2. Icon Notifikasi */}
              <Pressable
                onPress={() => {
                  hapticLight();
                  setActiveDropdown(activeDropdown === "notifications" ? null : "notifications");
                }}
                style={({ pressed }) => [
                  styles.headerIconBtn,
                  activeDropdown === "notifications" && styles.headerIconBtnActive,
                  pressed && { opacity: 0.8 },
                ]}
                accessibilityLabel="Notifikasi Sistem"
              >
                <AppIcon
                  name="bell"
                  size={18}
                  color={activeDropdown === "notifications" ? "#FFFFFF" : "#CBD5E1"}
                />
                {unreadCount > 0 ? (
                  <View style={styles.notifBadgeDot} />
                ) : null}
              </Pressable>

              {/* Pemisah Vertikal */}
              <View style={styles.headerDivider} />

              {/* 3. Icon / Pill User dengan Dropdown (Dashboard, Pengaturan, Logout) */}
              <Pressable
                onPress={() => {
                  hapticLight();
                  setActiveDropdown(activeDropdown === "user" ? null : "user");
                }}
                style={({ pressed }) => [
                  styles.userProfilePillBtn,
                  activeDropdown === "user" && styles.userProfilePillBtnActive,
                  pressed && { opacity: 0.8 },
                ]}
                accessibilityLabel="Menu Profil Admin"
              >
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {sessionAdmin.username?.charAt(0)?.toUpperCase() || "A"}
                  </Text>
                </View>
                <View style={styles.userInfoText}>
                  <Text style={styles.userNameText} numberOfLines={1}>
                    {sessionAdmin.username || "Admin Nuenime"}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <AppIcon name={roleIcon} size={11} color="#CBD5E1" />
                    <Text style={styles.userRoleText}>
                      {roleLabel}
                    </Text>
                  </View>
                </View>
                <AppIcon
                  name={activeDropdown === "user" ? "chevron-up" : "chevron-down"}
                  size={15}
                  color={activeDropdown === "user" ? "#FFFFFF" : "#94A3B8"}
                />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>

        {/* ─── DROPDOWN BACKDROP (KLIK DILUAR MENUTUP DROPDOWN) ─── */}
        {activeDropdown !== null ? (
          <Pressable
            style={styles.dropdownBackdrop}
            onPress={() => setActiveDropdown(null)}
          />
        ) : null}

        {/* ─── 1. USER DROPDOWN MENU ─── */}
        {activeDropdown === "user" ? (
          <View style={styles.userDropdownContainer}>
            {/* Header info akun */}
            <View style={styles.userDropdownHeader}>
              <View style={styles.userDropdownAvatar}>
                <Text style={styles.userDropdownAvatarText}>
                  {sessionAdmin.username?.charAt(0)?.toUpperCase() || "A"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userDropdownName} numberOfLines={1}>
                  {sessionAdmin.username}
                </Text>
                <Text style={styles.userDropdownEmail} numberOfLines={1}>
                  {sessionAdmin.email || "admin@nuenime.internal"}
                </Text>
                <View style={styles.userDropdownRoleBadge}>
                  <AppIcon name={roleIcon} size={11} color="#CBD5E1" />
                  <Text style={styles.userDropdownRoleText}>
                    {roleLabel}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.dropdownDivider} />

            {/* Menu Items */}
            <Pressable
              style={({ pressed }) => [
                styles.dropdownMenuItem,
                pressed && styles.dropdownMenuItemPressed,
              ]}
              onPress={() => {
                setActiveDropdown(null);
                handleNavigate("/admin/index");
              }}
            >
              <View style={[styles.dropdownMenuIconWrap, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
                <AppIcon name="view-dashboard" size={16} color="#CBD5E1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownMenuTitle}>Dashboard</Text>
                <Text style={styles.dropdownMenuSubtitle}>Ringkasan eksekutif & statistik</Text>
              </View>
              <AppIcon name="chevron-right" size={14} color="#64748B" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.dropdownMenuItem,
                pressed && styles.dropdownMenuItemPressed,
              ]}
              onPress={() => {
                setActiveDropdown(null);
                handleNavigate("/admin/settings");
              }}
            >
              <View style={[styles.dropdownMenuIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                <AppIcon name="cog" size={16} color="#38BDF8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownMenuTitle}>Pengaturan</Text>
                <Text style={styles.dropdownMenuSubtitle}>Konfigurasi gateway & sistem</Text>
              </View>
              <AppIcon name="chevron-right" size={14} color="#64748B" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.dropdownMenuItem,
                pressed && styles.dropdownMenuItemPressed,
              ]}
              onPress={() => {
                setActiveDropdown(null);
                hapticLight();
                router.push("/(tabs)" as any);
              }}
            >
              <View style={[styles.dropdownMenuIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                <AppIcon name="cellphone" size={16} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownMenuTitle}>Buka Aplikasi</Text>
                <Text style={styles.dropdownMenuSubtitle}>Kembali ke antarmuka anime</Text>
              </View>
              <AppIcon name="chevron-right" size={14} color="#64748B" />
            </Pressable>

            <View style={styles.dropdownDivider} />

            {/* Logout item */}
            <Pressable
              style={({ pressed }) => [
                styles.dropdownMenuItem,
                pressed && styles.dropdownMenuItemPressed,
              ]}
              onPress={handleLogout}
            >
              <View style={[styles.dropdownMenuIconWrap, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                <AppIcon name="logout-variant" size={16} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dropdownMenuTitle, { color: "#F87171" }]}>Logout Sesi</Text>
                <Text style={styles.dropdownMenuSubtitle}>Keluar dari akun admin</Text>
              </View>
            </Pressable>
          </View>
        ) : null}

        {/* ─── 2. NOTIFICATIONS DROPDOWN MENU ─── */}
        {activeDropdown === "notifications" ? (
          <View style={styles.notificationsDropdownContainer}>
            <View style={styles.notifHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <AppIcon name="bell" size={16} color="#CBD5E1" />
                <Text style={styles.notifHeaderTitle}>Notifikasi Admin</Text>
              </View>
              {unreadCount > 0 ? (
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setUnreadCount(0);
                  }}
                  style={styles.notifMarkReadBtn}
                >
                  <Text style={styles.notifMarkReadText}>Tandai Dibaca</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.dropdownDivider} />

            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {adminNotifications.map((notif) => (
                <Pressable
                  key={notif.id}
                  style={({ pressed }) => [
                    styles.notifItemRow,
                    pressed && styles.dropdownMenuItemPressed,
                  ]}
                  onPress={() => {
                    setActiveDropdown(null);
                    handleNavigate(notif.route);
                  }}
                >
                  <View style={[styles.notifIconWrap, { backgroundColor: `${notif.color}18` }]}>
                    <AppIcon name={notif.icon} size={16} color={notif.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifItemTitle}>{notif.title}</Text>
                    <Text style={styles.notifItemDesc} numberOfLines={2}>
                      {notif.desc}
                    </Text>
                    <Text style={styles.notifItemTime}>{notif.time}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.dropdownDivider} />

            <Pressable
              style={styles.notifFooterBtn}
              onPress={() => {
                setActiveDropdown(null);
                handleNavigate("/admin/audit");
              }}
            >
              <Text style={styles.notifFooterText}>Lihat Seluruh Log di Audit Trail</Text>
              <AppIcon name="chevron-right" size={14} color="#CBD5E1" />
            </Pressable>
          </View>
        ) : null}

        {/* ─── 3. SEARCH QUICK MODAL DROPDOWN ─── */}
        {activeDropdown === "search" ? (
          <View style={styles.searchDropdownContainer}>
            <View style={styles.searchInputRow}>
              <AppIcon name="magnify" size={18} color="#CBD5E1" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Cari menu, fitur, atau modul admin..."
                placeholderTextColor="#64748B"
                style={styles.searchTextInput}
                autoFocus
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
                  <AppIcon name="close-circle" size={16} color="#64748B" />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.dropdownDivider} />

            <ScrollView style={{ maxHeight: 290 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.searchSectionLabel}>
                {searchQuery ? `Hasil Pencarian (${filteredModules.length})` : "Modul & Halaman Cepat"}
              </Text>

              {filteredModules.length > 0 ? (
                filteredModules.map((item, idx) => (
                  <Pressable
                    key={idx}
                    style={({ pressed }) => [
                      styles.searchResultItem,
                      pressed && styles.dropdownMenuItemPressed,
                    ]}
                    onPress={() => {
                      setActiveDropdown(null);
                      setSearchQuery("");
                      handleNavigate(item.route);
                    }}
                  >
                    <View style={styles.searchResultIconWrap}>
                      <AppIcon name={item.icon} size={16} color="#CBD5E1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultTitle}>{item.title}</Text>
                      <Text style={styles.searchResultDesc} numberOfLines={1}>
                        {item.desc}
                      </Text>
                    </View>
                    <AppIcon name="chevron-right" size={14} color="#64748B" />
                  </Pressable>
                ))
              ) : (
                <View style={styles.searchEmptyWrap}>
                  <AppIcon name="information-outline" size={24} color="#64748B" />
                  <Text style={styles.searchEmptyText}>Tidak ada menu yang sesuai.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        ) : null}

        {/* Content Body */}
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>

      {/* Mobile Drawer (Collapsible) */}
      {!isDesktop && mobileMenuOpen ? (
        <View style={styles.mobileDrawerOverlay}>
          <Pressable
            style={styles.mobileDrawerBackdrop}
            onPress={() => setMobileMenuOpen(false)}
          />
          <View style={styles.mobileDrawerContent}>{renderSidebar()}</View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#080A0F",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#080A0F",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#94A3B8",
  },
  sidebarContainer: {
    width: 260,
    backgroundColor: "#0D1017",
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.07)",
    flexDirection: "column",
  },
  brandHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  brandLogoImage: {
    width: 170,
    height: 52,
  },
  brandSubtitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 6,
  },
  activeAccountCard: {
    marginHorizontal: 16,
    marginVertical: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  activeAccountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  activeAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  activeAvatarText: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
  },
  activeAccountInfo: {
    flex: 1,
  },
  activeAccountName: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  activeAccountEmail: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  activeRolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  activeRoleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    letterSpacing: 0.3,
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  sectionHeaderWrap: {
    paddingHorizontal: 10,
    paddingBottom: 6,
    paddingTop: 8,
  },
  sectionHeaderText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#4B4458",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 9,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "transparent",
  },
  menuItemActive: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.28)",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  menuItemDisabled: {
    opacity: 0.35,
  },
  menuItemPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.20)",
    borderColor: "rgba(255, 255, 255, 0.40)",
    shadowOpacity: 0,
    elevation: 0,
  },
  menuIconWrap: {
    width: 22,
    alignItems: "center",
  },
  menuLabel: {
    flex: 1,
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#94A3B8",
  },
  menuLabelActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },
  menuLabelDisabled: {
    color: "#4B4458",
  },
  menuBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  menuBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    color: "#FFFFFF",
  },
  sidebarLogoutWrap: {
    marginTop: 18,
    paddingHorizontal: 4,
  },
  sidebarLogoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(248, 113, 113, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.2)",
  },
  sidebarLogoutText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#F87171",
  },
  mainContainer: {
    flex: 1,
    backgroundColor: "#080A0F",
    position: "relative",
  },
  navbarContainer: {
    backgroundColor: "#0D1017",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.07)",
    zIndex: 10,
  },
  navbarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  menuToggleBtn: {
    padding: 6,
    marginRight: 10,
  },
  navbarTitleWrap: {
    flex: 1,
  },
  navbarTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 19,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  navbarSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  navbarRightArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerIconBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  notifBadgeDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#0D1017",
  },
  headerDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginHorizontal: 4,
  },
  userProfilePillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
  },
  userProfilePillBtnActive: {
    borderColor: "rgba(255, 255, 255, 0.22)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#FFFFFF",
  },
  userInfoText: {
    display: Platform.OS === "web" ? "flex" : "none",
  },
  userNameText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
    maxWidth: 140,
  },
  userRoleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#CBD5E1",
  },
  /* ─── DROPDOWNS & BACKDROP ─── */
  dropdownBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  userDropdownContainer: {
    position: "absolute",
    top: 66,
    right: 20,
    width: 270,
    backgroundColor: "#0F131C",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 8,
    zIndex: 100,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  userDropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
  },
  userDropdownAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  userDropdownAvatarText: {
    fontFamily: "Nunito-Black",
    fontSize: 17,
    color: "#FFFFFF",
  },
  userDropdownName: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  userDropdownEmail: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 4,
  },
  userDropdownRoleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  userDropdownRoleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#CBD5E1",
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginVertical: 4,
  },
  dropdownMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  dropdownMenuItemPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  dropdownMenuIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownMenuTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#E2E8F0",
  },
  dropdownMenuSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
  },
  /* ─── NOTIFICATIONS DROPDOWN ─── */
  notificationsDropdownContainer: {
    position: "absolute",
    top: 66,
    right: 70,
    width: 320,
    backgroundColor: "#0F131C",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 8,
    zIndex: 100,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  notifHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  notifHeaderTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  notifMarkReadBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  notifMarkReadText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#CBD5E1",
  },
  notifItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 10,
    borderRadius: 8,
  },
  notifIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  notifItemTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#F1F5F9",
  },
  notifItemDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 15,
    marginTop: 2,
  },
  notifItemTime: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#64748B",
    marginTop: 4,
  },
  notifFooterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  notifFooterText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#CBD5E1",
  },
  /* ─── SEARCH DROPDOWN ─── */
  searchDropdownContainer: {
    position: "absolute",
    top: 66,
    right: 110,
    width: 360,
    backgroundColor: "#0F131C",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 10,
    zIndex: 100,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  searchTextInput: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    paddingVertical: 4,
  },
  searchSectionLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  searchResultIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchResultTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#F1F5F9",
  },
  searchResultDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  searchEmptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  searchEmptyText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#64748B",
  },
  /* ─── CONTENT SCROLL ─── */
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    gap: 20,
  },
  mobileDrawerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    flexDirection: "row",
  },
  mobileDrawerBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  mobileDrawerContent: {
    width: 260,
    height: "100%",
  },
});
