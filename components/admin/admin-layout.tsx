import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
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

export interface AdminLayoutProps {
  title: string;
  subtitle?: string;
  activeKey?: string;
  currentRole?: AdminRole;
  onRoleChange?: (role: AdminRole) => void;
  children: React.ReactNode;
}

interface MenuItemDef {
  key: string;
  label: string;
  icon: string;
  route: string;
  section?: string;
  badge?: string | number;
  badgeColor?: string;
  minRole?: AdminRole;
}

const MENU_ITEMS: MenuItemDef[] = [
  // ─── DASHBOARD ───
  {
    key: "overview",
    label: "Dashboard Overview",
    icon: "view-dashboard",
    route: "/admin",
    section: "UTAMA",
  },
  // ─── FINANCE ───
  {
    key: "finance",
    label: "Finance & Top Up",
    icon: "credit-card-outline",
    route: "/admin/finance",
    section: "KEUANGAN",
    badge: "Antrean",
    badgeColor: "#F59E0B",
  },
  // ─── USERS ───
  {
    key: "users",
    label: "User Management",
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
    label: "Support & CS",
    icon: "headset",
    route: "/admin/support",
  },
  {
    key: "analytics",
    label: "Analytics & Reports",
    icon: "chart-bar",
    route: "/admin/analytics",
  },
  {
    key: "audit",
    label: "Roles & Audit Logs",
    icon: "shield-account",
    route: "/admin/audit",
    section: "KEAMANAN",
  },
  {
    key: "settings",
    label: "Settings",
    icon: "cog-outline",
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

  // Role simulator state
  const [currentRole, setCurrentRole] = useState<AdminRole>("super_admin");

  const currentAdmin: AdminUser = {
    id: "admin-master",
    email: "admin@nuenime.com",
    username: "Super Admin Nuenime",
    role: currentRole,
  };

  const handleNavigate = (route: string) => {
    hapticLight();
    setMobileMenuOpen(false);
    router.replace(route as any);
  };

  const renderSidebar = () => (
    <View style={styles.sidebarContainer}>
      {/* ─── BRAND HEADER DENGAN LOGO MATERIO STYLE ─── */}
      <View style={styles.brandHeader}>
        <View style={styles.brandLogoWrap}>
          <AppIcon name="play-circle" size={24} color="#8C57FF" />
        </View>
        <View style={styles.brandTextGroup}>
          <Text style={styles.brandTitle}>NUENIME</Text>
          <Text style={styles.brandSubtitle}>Admin Dashboard</Text>
        </View>
      </View>

      {/* ─── SIMULATOR ROLE SELECTION ─── */}
      <View style={styles.roleBadgeCard}>
        <Text style={styles.roleBadgeLabel}>PERAN ADMIN AKTIF:</Text>
        <View style={styles.roleBtnRow}>
          {(["super_admin", "finance_admin", "moderator"] as const).map((r) => (
            <Pressable
              key={r}
              onPress={() => {
                hapticLight();
                setCurrentRole(r);
              }}
              style={[
                styles.roleChip,
                currentRole === r && styles.roleChipActive,
              ]}
            >
              <Text
                style={[
                  styles.roleChipText,
                  currentRole === r && styles.roleChipTextActive,
                ]}
              >
                {r === "super_admin"
                  ? "Super"
                  : r === "finance_admin"
                  ? "Finance"
                  : "Mod"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ─── MENU ITEMS DENGAN SECTION HEADER ─── */}
      <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
        {MENU_ITEMS.map((item, idx) => {
          const isActive =
            pathname === item.route ||
            (item.route !== "/admin" && pathname?.startsWith(item.route));

          // Cek izin akses berdasarkan role
          let hasAccess = true;
          if (item.key === "finance" && !canManageFinance(currentRole)) hasAccess = false;
          if (item.key === "users" && !canManageUsers(currentRole)) hasAccess = false;
          if (item.key === "community" && !canModerate(currentRole)) hasAccess = false;
          if (item.key === "system" && !canManageSystem(currentRole)) hasAccess = false;
          if (item.key === "audit" && !canManageSystem(currentRole)) hasAccess = false;

          return (
            <React.Fragment key={item.key}>
              {item.section ? (
                <Text style={styles.sectionHeader}>{item.section}</Text>
              ) : null}

              <Pressable
                onPress={() => handleNavigate(item.route)}
                disabled={!hasAccess}
                style={({ pressed }) => [
                  styles.menuItem,
                  isActive && styles.menuItemActive,
                  !hasAccess && styles.menuItemDisabled,
                  pressed && styles.menuItemPressed,
                ]}
              >
                <View style={styles.menuIconWrap}>
                  <AppIcon
                    name={item.icon}
                    size={19}
                    color={isActive ? "#FFFFFF" : hasAccess ? "#A098AE" : "#4B4458"}
                  />
                </View>

                <Text
                  style={[
                    styles.menuLabel,
                    isActive && styles.menuLabelActive,
                    !hasAccess && styles.menuLabelDisabled,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>

                {item.badge ? (
                  <View
                    style={[
                      styles.menuBadge,
                      { backgroundColor: item.badgeColor || "#8C57FF" },
                    ]}
                  >
                    <Text style={styles.menuBadgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            </React.Fragment>
          );
        })}

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

            <View style={styles.navbarRightArea}>
              <Pressable
                onPress={() => {
                  hapticLight();
                  router.push("/(tabs)" as any);
                }}
                style={styles.backToAppBtn}
              >
                <AppIcon name="cellphone" size={16} color="#38BDF8" />
                <Text style={styles.backToAppText}>Buka App</Text>
              </Pressable>

              <View style={styles.userProfilePill}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>A</Text>
                </View>
                <View style={styles.userInfoText}>
                  <Text style={styles.userNameText}>Super Admin</Text>
                  <Text style={styles.userRoleText}>{currentRole}</Text>
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>

        {/* Content Scroll View */}
        <ScrollView
          contentContainerStyle={styles.contentScroll}
          showsVerticalScrollIndicator={false}
        >
          {children}
          <View style={{ height: 60 }} />
        </ScrollView>
      </View>

      {/* Mobile Drawer */}
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
    backgroundColor: "#14121F",
  },
  sidebarContainer: {
    width: 260,
    backgroundColor: "#211D36",
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 16,
    paddingHorizontal: 12,
  },
  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  brandLogoWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(140, 87, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.35)",
  },
  brandTextGroup: {
    gap: 1,
  },
  brandTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 17,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  roleBadgeCard: {
    marginVertical: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    gap: 6,
  },
  roleBadgeLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  roleBtnRow: {
    flexDirection: "row",
    gap: 4,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
  },
  roleChipActive: {
    backgroundColor: "#8C57FF",
  },
  roleChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#A098AE",
  },
  roleChipTextActive: {
    color: "#FFFFFF",
  },
  menuScroll: {
    flex: 1,
  },
  sectionHeader: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#6B657B",
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 10,
    letterSpacing: 0.8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 3,
  },
  menuItemActive: {
    backgroundColor: "#8C57FF",
    shadowColor: "#8C57FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  menuItemDisabled: {
    opacity: 0.4,
  },
  menuItemPressed: {
    opacity: 0.8,
  },
  menuIconWrap: {
    width: 22,
    alignItems: "center",
  },
  menuLabel: {
    flex: 1,
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#A098AE",
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
  mainContainer: {
    flex: 1,
    backgroundColor: "#14121F",
  },
  navbarContainer: {
    backgroundColor: "#211D36",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
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
    gap: 12,
  },
  backToAppBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  backToAppText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#38BDF8",
  },
  userProfilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  userAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#8C57FF",
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
    fontSize: 11,
    color: "#FFFFFF",
  },
  userRoleText: {
    fontFamily: "Nunito-Regular",
    fontSize: 9.5,
    color: "#94A3B8",
  },
  contentScroll: {
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
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  mobileDrawerContent: {
    width: 260,
    height: "100%",
  },
});
