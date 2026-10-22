import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import type { AdminUser } from "@/lib/admin-service";
import { authenticateAdmin, STORAGE_ADMIN_SESSION } from "@/lib/admin-auth-service";

export { STORAGE_ADMIN_SESSION };

interface AdminLoginProps {
  onLoginSuccess: (admin: AdminUser) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      hapticWarning();
      setErrorMessage("Silakan masukkan email / username dan kata sandi.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    hapticLight();

    const res = await authenticateAdmin(email.trim(), password.trim());
    setLoading(false);

    if (res.success && res.user) {
      hapticSuccess();
      onLoginSuccess(res.user);
    } else {
      hapticWarning();
      setErrorMessage(res.error || "Kredensial tidak valid.");
    }
  };

  return (
    <View style={styles.container}>
      {/* Background radial glow */}
      <View style={styles.glowCircle} pointerEvents="none" />

      {/* Background Mascot Anime Banner */}
      <Image
        source={require("@/assets/images/admin-login-banner.png")}
        style={styles.bgBanner}
        contentFit="cover"
        contentPosition="bottom center"
        pointerEvents="none"
        priority="high"
      />

      <View style={styles.card}>
        {/* Header Branding with Nuenime Logo */}
        <View style={styles.header}>
          <Image
            source={require("@/assets/images/nuenime-logo.png")}
            style={styles.logoImage}
            contentFit="contain"
            transition={300}
          />
          <Text style={styles.portalTag}>PORTAL ADMIN NUENIME</Text>
          <Text style={styles.title}>Masuk ke Dashboard</Text>
          <Text style={styles.subtitle}>
            Akses kontrol panel terpusat. Masukkan kredensial akun admin Anda.
          </Text>
        </View>

        {/* Error Notification */}
        {errorMessage ? (
          <View style={styles.errorBox}>
            <AppIcon name="alert-circle-outline" size={18} color="#F87171" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Form Inputs */}
        <View style={styles.form}>
          {/* Email / Username Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL ATAU USERNAME</Text>
            <View style={styles.inputWrap}>
              <AppIcon name="account-circle-outline" size={20} color="#94A3B8" />
              <TextInput
                style={styles.textInput}
                placeholder="nama@nuenime.com atau username"
                placeholderTextColor="#64748B"
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>KATA SANDI</Text>
            <View style={styles.inputWrap}>
              <AppIcon name="lock-outline" size={20} color="#94A3B8" />
              <TextInput
                style={styles.textInput}
                placeholder="Masukkan kata sandi akun"
                placeholderTextColor="#64748B"
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                accessibilityLabel="Toggle kata sandi"
              >
                <AppIcon
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={19}
                  color="#94A3B8"
                />
              </Pressable>
            </View>
          </View>

          {/* Liquid Glass Theme Submit Button */}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [
              styles.liquidGlassBtn,
              loading && styles.liquidGlassBtnDisabled,
              pressed && styles.liquidGlassBtnPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <AppIcon name="shield-check-outline" size={18} color="#FFFFFF" />
                <Text style={styles.liquidGlassBtnText}>Masuk ke Dashboard</Text>
                <AppIcon name="arrow-right" size={17} color="#E2E8F0" />
              </>
            )}
          </Pressable>
        </View>

        {/* Security Footer Notice */}
        <View style={styles.footer}>
          <AppIcon name="shield-check" size={14} color="#10B981" />
          <Text style={styles.footerText}>
            Enkripsi Sesi 256-bit • Role terverifikasi otomatis oleh sistem
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E14",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    position: "relative",
  },
  glowCircle: {
    position: "absolute",
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: "rgba(140, 87, 255, 0.08)",
    top: "20%",
    left: "50%",
    transform: [{ translateX: -300 }, { translateY: -300 }],
  },
  bgBanner: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "rgba(22, 25, 34, 0.88)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 32,
    elevation: 14,
    zIndex: 10,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        } as any)
      : {}),
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoImage: {
    width: 140,
    height: 140,
    marginBottom: 8,
  },
  portalTag: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#CBD5E1",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontFamily: "Nunito-Black",
    fontSize: 22,
    color: "#FFFFFF",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(248, 113, 113, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.3)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 18,
  },
  errorText: {
    flex: 1,
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#F87171",
  },
  form: {
    gap: 18,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#A098AE",
    letterSpacing: 0.8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F121A",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: "Nunito-SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
    paddingVertical: 0,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  eyeBtn: {
    padding: 6,
  },
  liquidGlassBtn: {
    marginTop: 10,
    height: 50,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        } as any)
      : {}),
  },
  liquidGlassBtnDisabled: {
    opacity: 0.5,
  },
  liquidGlassBtnPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    borderColor: "rgba(255, 255, 255, 0.38)",
    transform: [{ scale: 0.99 }],
  },
  liquidGlassBtnText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  footer: {
    marginTop: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footerText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
  },
});
