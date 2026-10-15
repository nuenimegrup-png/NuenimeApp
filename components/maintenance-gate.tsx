import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Linking,
  Platform,
} from "react-native";
import { usePathname } from "expo-router";
import { AppIcon } from "@/components/app-icon";
import { useAnirakuAuth } from "@/providers/auth-provider";
import {
  getAdminMaintenanceConfig,
  type MaintenanceModeConfig,
} from "@/lib/admin-service";
import { supabase } from "@/lib/supabase";

export function MaintenanceGate() {
  const [config, setConfig] = useState<MaintenanceModeConfig>({
    isActive: false,
    message: "Server sedang dalam pemeliharaan berkala untuk peningkatan performa.",
  });
  const [isChecking, setIsChecking] = useState(false);
  const pathname = usePathname();
  const auth = useAnirakuAuth();

  const checkMaintenance = useCallback(async () => {
    setIsChecking(true);
    try {
      const cfg = await getAdminMaintenanceConfig();
      setConfig(cfg);
    } catch {
      // ignore
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkMaintenance();

    // Listen real-time dari Supabase jika admin mengaktifkan / menonaktifkan maintenance
    const channel = supabase
      .channel("realtime-maintenance-mode")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "system_configs",
          filter: "key=eq.maintenance_mode",
        },
        (payload: any) => {
          if (payload.new && payload.new.value) {
            const val = typeof payload.new.value === "string" ? JSON.parse(payload.new.value) : payload.new.value;
            setConfig({
              isActive: Boolean(val.is_active ?? val.isActive),
              message: val.message || "Server sedang dalam pemeliharaan berkala.",
              endsAt: val.ends_at ?? val.endsAt ?? null,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkMaintenance]);

  // Jika tidak aktif, tidak ada yang perlu ditampilkan
  if (!config.isActive) return null;

  // Izinkan bypass jika sedang di halaman admin atau user memiliki role admin
  const isAdminPath = pathname.startsWith("/admin");
  const isAdminUser =
    (auth.profile as any)?.role === "admin" ||
    (auth.profile as any)?.role === "super_admin" ||
    (auth.user?.email ? auth.user.email.includes("admin") : false);

  if (isAdminPath || isAdminUser) {
    return null;
  }

  return (
    <View style={styles.overlayContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0E14" />
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <AppIcon name="construct" size={38} color="#F59E0B" />
        </View>

        <Text style={styles.badge}>MAINTENANCE MODE</Text>
        <Text style={styles.title}>Pemeliharaan Sistem</Text>
        <Text style={styles.message}>{config.message}</Text>

        {Boolean(config.endsAt) && (
          <View style={styles.timeBox}>
            <AppIcon name="time-outline" size={14} color="#94A3B8" />
            <Text style={styles.timeText}>Estimasi selesai: {config.endsAt}</Text>
          </View>
        )}

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={checkMaintenance}
            disabled={isChecking}
            activeOpacity={0.78}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <AppIcon name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.refreshBtnText}>Cek Status Server</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.discordBtn}
            onPress={() => Linking.openURL("https://discord.gg/nuenime").catch(() => {})}
            activeOpacity={0.78}
          >
            <AppIcon name="logo-discord" size={16} color="#E2E8F0" />
            <Text style={styles.discordBtnText}>Komunitas Discord</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0B0E14",
    zIndex: 999999,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#111722",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1E2738",
    padding: 26,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(245, 158, 11, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  badge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F59E0B",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    color: "#CBD5E1",
    textAlign: "center",
    marginBottom: 18,
  },
  timeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0B0F17",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#1B2233",
  },
  timeText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
  },
  btnRow: {
    width: "100%",
    gap: 10,
  },
  refreshBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.32)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 24,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        cursor: "pointer",
        transition: "all 0.2s ease",
      } as any)
      : {}),
  },
  refreshBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  discordBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.22)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 24,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        cursor: "pointer",
        transition: "all 0.2s ease",
      } as any)
      : {}),
  },
  discordBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E2E8F0",
    letterSpacing: 0.2,
  },
});
