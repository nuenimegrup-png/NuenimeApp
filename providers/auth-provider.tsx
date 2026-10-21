import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { AppState, Platform, Modal, StyleSheet, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { AppIcon } from "@/components/app-icon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import { serverUserCanStartSession, sessionIsVerified } from "@/lib/auth-session";
import { ANIRAKU_AUTH_REDIRECT_URL } from "@/lib/auth-redirect";
import { defaultAvatar, isDefaultAvatar } from "@/lib/aniraku-avatars";
import type { AnirakuProfile } from "@/lib/types";

import {
  BANNER_COOLDOWN_SECONDS,
  NAME_COOLDOWN_SECONDS,
  AVATAR_COOLDOWN_SECONDS,
  formatDurationIndonesian,
  validateImageUrl,
} from "@/lib/profile-cooldown";

WebBrowser.maybeCompleteAuthSession();

type ProfileUpdate = Pick<
  AnirakuProfile,
  | "username"
  | "display_name"
  | "bio"
  | "avatar_url"
  | "banner_url"
  | "banner_updated_at"
  | "name_updated_at"
  | "avatar_updated_at"
>;

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: AnirakuProfile | null;
  loading: boolean;
  verified: boolean;
  signInWithGoogle: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  sendRecovery: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateProfile: (updates: ProfileUpdate) => Promise<void>;
  updateBanner: (bannerUrl: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updateAvatar: (avatarUrl: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfileExpAndLevel: (exp: number, level: number) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function extractOAuthAvatar(user: User | null | undefined): string | null {
  if (!user) return null;
  const meta = user.user_metadata || {};
  if (typeof meta.avatar_url === "string" && meta.avatar_url.trim()) return meta.avatar_url.trim();
  if (typeof meta.picture === "string" && meta.picture.trim()) return meta.picture.trim();
  const identityData = user.identities?.[0]?.identity_data || {};
  if (typeof identityData.avatar_url === "string" && identityData.avatar_url.trim()) return identityData.avatar_url.trim();
  if (typeof identityData.picture === "string" && identityData.picture.trim()) return identityData.picture.trim();
  return null;
}

const BASE_PROFILE_COLUMNS =
  "id, username, display_name, bio, avatar_url, banner_url, location, socials, created_at, member_number, exp, level, is_vip";

function sanitizeUsername(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return (normalized || "aniraku_member").slice(0, 20);
}

function fallbackProfile(user: User): AnirakuProfile {
  const googleAvatar = extractOAuthAvatar(user);
  const username = sanitizeUsername(
    String(
      user.user_metadata?.username ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      `user_${user.id.slice(0, 6)}`
    )
  );
  const displayName = String(
    user.user_metadata?.full_name ||
    user.user_metadata?.display_name ||
    user.user_metadata?.name ||
    username
  );

  return {
    id: user.id,
    username,
    display_name: displayName,
    avatar_url: googleAvatar || defaultAvatar(username.charCodeAt(0)).url,
    member_number: 1,
    exp: 0,
    level: 1,
    is_vip: false,
    banner_updated_at: null,
    name_updated_at: null,
    avatar_updated_at: null,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AnirakuProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionValidation = useRef(0);

  const loadProfile = useCallback(async (user: User) => {
    const fallback = fallbackProfile(user);
    const googleAvatar = extractOAuthAvatar(user);

    try {
      // Baca riwayat waktu cooldown dari penyimpanan lokal akun
      const [localBannerAt, localNameAt, localAvatarAt] = await Promise.all([
        AsyncStorage.getItem(`aniraku.cooldown.${user.id}.banner`).catch(() => null),
        AsyncStorage.getItem(`aniraku.cooldown.${user.id}.name`).catch(() => null),
        AsyncStorage.getItem(`aniraku.cooldown.${user.id}.avatar`).catch(() => null),
      ]);

      // Query database profil pengguna
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileErr && profileData) {
        const [overrideRole, overrideBan, overrideBanReason] = await Promise.all([
          AsyncStorage.getItem(`@nuenime_user_role_${user.id}`).catch(() => null),
          AsyncStorage.getItem(`@nuenime_user_ban_${user.id}`).catch(() => null),
          AsyncStorage.getItem(`@nuenime_user_ban_reason_${user.id}`).catch(() => null),
        ]);

        const fullProfile = {
          ...profileData,
          role: overrideRole || (profileData as any)?.role || "Member",
          is_banned: overrideBan !== null ? overrideBan === "true" : Boolean((profileData as any)?.is_banned),
          banned_at: (profileData as any)?.banned_at || null,
          ban_reason: overrideBanReason || (profileData as any)?.ban_reason || null,
          banner_updated_at: (profileData as any)?.banner_updated_at || localBannerAt || null,
          name_updated_at: (profileData as any)?.name_updated_at || localNameAt || null,
          avatar_updated_at: (profileData as any)?.avatar_updated_at || localAvatarAt || null,
        } as AnirakuProfile;

        // Jika profil di DB belum memiliki avatar_url, atau masih memakai avatar placeholder bawaan,
        // dan akun login dengan Google (memiliki foto akun Google),
        // otomatis jadikan foto Google sebagai avatar default dan simpan ke database!
        if ((!fullProfile.avatar_url || isDefaultAvatar(fullProfile.avatar_url)) && googleAvatar) {
          fullProfile.avatar_url = googleAvatar;
          void Promise.resolve(
            supabase
              .from("profiles")
              .update({ avatar_url: googleAvatar })
              .eq("id", user.id)
          ).catch(() => {});
        }
        setProfile(fullProfile);
        return;
      }

      // Jika belum ada row di `profiles` (akun baru dari Google OAuth),
      // buat row baru dengan foto profil Google!
      const initialPayload = {
        id: fallback.id,
        username: fallback.username,
        display_name: fallback.display_name,
        avatar_url: fallback.avatar_url,
        member_number: fallback.member_number,
        exp: fallback.exp,
        level: fallback.level,
        is_vip: fallback.is_vip,
      };

      const { data: created, error: createError } = await supabase
        .from("profiles")
        .upsert(initialPayload, { onConflict: "id" })
        .select("*")
        .maybeSingle();

      if (createError) throw createError;
      const finalProfile = {
        ...((created as AnirakuProfile | null) || fallback),
        banner_updated_at: localBannerAt || null,
        name_updated_at: localNameAt || null,
        avatar_updated_at: localAvatarAt || null,
      };
      setProfile(finalProfile);
    } catch {
      setProfile(fallback);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const clearSessionState = () => {
      if (!mounted) return;
      setSession(null);
      setProfile(null);
      setLoading(false);
    };
    const applySession = async (candidate: Session | null) => {
      const validationId = ++sessionValidation.current;
      if (!candidate?.user) {
        clearSessionState();
        return;
      }
      if (mounted) setLoading(true);
      try {
        // getUser always asks Supabase Auth for the present user record. This
        // deliberately rejects a cached token after an account was deleted.
        const { data, error } = await supabase.auth.getUser();
        if (!mounted || validationId !== sessionValidation.current) return;
        if (error || !serverUserCanStartSession(candidate, data.user)) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          clearSessionState();
          return;
        }
        const next = { ...candidate, user: data.user };
        setSession(next);
        void loadProfile(data.user).finally(() => {
          if (mounted && validationId === sessionValidation.current) setLoading(false);
        });
      } catch {
        if (!mounted || validationId !== sessionValidation.current) return;
        // Offline or malformed stored sessions must not grant app access.
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        clearSessionState();
      }
    };
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      if (code) {
        void supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
          if (!error && data?.session) {
            void applySession(data.session);
            try {
              window.history.replaceState({}, document.title, window.location.pathname);
            } catch {}
          }
        }).catch(() => {});
      }
    }
    void supabase.auth.getSession().then(({ data }) => void applySession(data.session)).catch(() => void applySession(null));
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void supabase.auth.getSession().then(({ data }) => void applySession(data.session));
    });
    let subscription: ReturnType<typeof supabase.auth.onAuthStateChange>["data"]["subscription"] | undefined;
    try {
      ({ data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        // Defer the Supabase Auth network request outside the state-change callback.
        setTimeout(() => { if (mounted) void applySession(nextSession); }, 0);
      }));
    } catch {
      clearSessionState();
    }
    return () => { mounted = false; sessionValidation.current += 1; appStateSubscription.remove(); subscription?.unsubscribe(); };
  }, [loadProfile]);

let GoogleSigninModule: typeof import("@react-native-google-signin/google-signin") | null = null;
function getGoogleSignin() {
  if (Platform.OS === "web") return null;
  if (!GoogleSigninModule) {
    try {
      GoogleSigninModule = require("@react-native-google-signin/google-signin");
    } catch {
      return null;
    }
  }
  return GoogleSigninModule;
}

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      if (Platform.OS === "web") {
        // Web: pakai OAuth redirect biasa
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
        if (error) throw error;
        return;
      }

      // ── Android / iOS: native Google Sign-In ONLY ──
      // Tidak ada fallback ke web browser. Kalau native gagal, lempar error
      // ke UI agar user mendapat pesan yang jelas, bukan diarahkan ke Chrome.
      const gModule = getGoogleSignin();
      const webClientId =
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
        "444728416290-rtacl8l6hofjhm0uauid82vppsda4e1i.apps.googleusercontent.com";

      if (!gModule || !webClientId) {
        throw new Error("Login Google belum dikonfigurasi untuk perangkat ini.");
      }

      gModule.GoogleSignin.configure({
        webClientId,
        scopes: ["profile", "email"],
      });

      await gModule.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await gModule.GoogleSignin.signIn();
      const idToken = response.data?.idToken ?? (response as any)?.idToken;

      if (!idToken) {
        throw new Error("Tidak dapat mengambil token Google. Silakan coba lagi.");
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });
      if (sessionError) throw sessionError;
      if (sessionData?.session) {
        setSession(sessionData.session);
      }
    } catch (err: any) {
      const gModule = getGoogleSignin();
      // Abaikan pembatalan user — jangan tampilkan error
      const isCancelled =
        err?.code === gModule?.statusCodes?.SIGN_IN_CANCELLED ||
        err?.message?.toLowerCase().includes("cancel");
      if (!isCancelled) {
        // Re-throw supaya komponen pemanggil bisa menampilkan pesan error
        throw err;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    const { data: current, error: currentUserError } = await supabase.auth.getUser();
    if (currentUserError || !serverUserCanStartSession(data.session, current.user)) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      throw new Error("Please confirm your email before signing in.");
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    const clean = sanitizeUsername(username || email.split("@")[0]);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: clean, display_name: clean }, emailRedirectTo: ANIRAKU_AUTH_REDIRECT_URL },
    });
    if (error) throw error;
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: ANIRAKU_AUTH_REDIRECT_URL },
    });
    if (error) throw error;
  }, []);

  const sendRecovery = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: ANIRAKU_AUTH_REDIRECT_URL });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const updateProfile = useCallback(async (updates: ProfileUpdate) => {
    const user = session?.user;
    if (!user) throw new Error("Sign in to edit your profile.");
    const fields: ProfileUpdate = { ...updates };
    if (fields.username) fields.username = sanitizeUsername(fields.username);
    if (fields.avatar_url !== undefined) {
      const url = String(fields.avatar_url ?? "").trim();
      if (url && (!/^https?:\/\//i.test(url) || url.length > 2048)) {
        throw new Error("That avatar image is not supported.");
      }
      fields.avatar_url = url || null;
    }
    if (fields.banner_url !== undefined) {
      const bUrl = String(fields.banner_url ?? "").trim();
      fields.banner_url = bUrl || null;
    }
    const { error } = await supabase.from("profiles").update(fields).eq("id", user.id);
    if (error) throw error;
    if (fields.username || fields.display_name) {
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          username: fields.username || user.user_metadata?.username,
          display_name: fields.display_name || user.user_metadata?.display_name,
        },
      });
      if (metadataError) throw metadataError;
    }
    setProfile((current) => ({ ...(current || fallbackProfile(user)), ...fields }));
  }, [session?.user]);

  const updateBanner = useCallback(async (bannerUrl: string) => {
    const user = session?.user;
    if (!user) throw new Error("Sign in to edit your banner.");

    const validation = validateImageUrl(bannerUrl);
    if (bannerUrl.trim() && !validation.valid) {
      throw new Error(validation.error || "Tautan banner tidak valid.");
    }
    const cleanUrl = bannerUrl.trim() ? validation.cleanUrl : null;

    // Cooldown check
    const lastAt = profile?.banner_updated_at;
    if (lastAt) {
      const elapsed = (Date.now() - new Date(lastAt).getTime()) / 1000;
      if (elapsed < BANNER_COOLDOWN_SECONDS) {
        const sec = Math.ceil(BANNER_COOLDOWN_SECONDS - elapsed);
        throw new Error(`Banner dapat diganti lagi dalam ${formatDurationIndonesian(sec)}.`);
      }
    }

    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        banner_url: cleanUrl,
        banner_updated_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", user.id);
    if (updateErr) throw updateErr;

    await AsyncStorage.setItem(`aniraku.cooldown.${user.id}.banner`, nowIso).catch(() => {});
    setProfile((current) => ({
      ...(current || fallbackProfile(user)),
      banner_url: cleanUrl,
      banner_updated_at: nowIso,
    }));
  }, [session?.user, profile?.banner_updated_at]);

  const updateDisplayName = useCallback(async (newDisplayName: string) => {
    const user = session?.user;
    if (!user) throw new Error("Sign in to edit your display name.");

    const clean = newDisplayName.trim();
    if (!clean || clean.length < 2) {
      throw new Error("Nama tampilan minimal 2 karakter.");
    }
    if (clean.length > 30) {
      throw new Error("Nama tampilan maksimal 30 karakter.");
    }

    // Cooldown check
    const lastAt = profile?.name_updated_at;
    if (lastAt) {
      const elapsed = (Date.now() - new Date(lastAt).getTime()) / 1000;
      if (elapsed < NAME_COOLDOWN_SECONDS) {
        const sec = Math.ceil(NAME_COOLDOWN_SECONDS - elapsed);
        throw new Error(`Nama dapat diubah lagi dalam ${formatDurationIndonesian(sec)}.`);
      }
    }

    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        display_name: clean,
        name_updated_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", user.id);
    if (updateErr) throw updateErr;

    void supabase.auth.updateUser({ data: { display_name: clean } }).catch(() => {});
    await AsyncStorage.setItem(`aniraku.cooldown.${user.id}.name`, nowIso).catch(() => {});
    setProfile((current) => ({
      ...(current || fallbackProfile(user)),
      display_name: clean,
      name_updated_at: nowIso,
    }));
  }, [session?.user, profile?.name_updated_at]);

  const updateAvatar = useCallback(async (avatarUrlInput: string) => {
    const user = session?.user;
    if (!user) throw new Error("Sign in to edit your avatar.");

    const validation = validateImageUrl(avatarUrlInput);
    if (!validation.valid) {
      throw new Error(validation.error || "Tautan avatar tidak valid.");
    }
    const cleanUrl = validation.cleanUrl;

    // Cooldown check
    const lastAt = profile?.avatar_updated_at;
    if (lastAt) {
      const elapsed = (Date.now() - new Date(lastAt).getTime()) / 1000;
      if (elapsed < AVATAR_COOLDOWN_SECONDS) {
        const sec = Math.ceil(AVATAR_COOLDOWN_SECONDS - elapsed);
        throw new Error(`Avatar dapat diganti lagi dalam ${formatDurationIndonesian(sec)}.`);
      }
    }

    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        avatar_url: cleanUrl,
        avatar_updated_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", user.id);
    if (updateErr) throw updateErr;

    void supabase.auth.updateUser({ data: { avatar_url: cleanUrl } }).catch(() => {});
    await AsyncStorage.setItem(`aniraku.cooldown.${user.id}.avatar`, nowIso).catch(() => {});
    setProfile((current) => ({
      ...(current || fallbackProfile(user)),
      avatar_url: cleanUrl,
      avatar_updated_at: nowIso,
    }));
  }, [session?.user, profile?.avatar_updated_at]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await loadProfile(session.user);
    }
  }, [session?.user, loadProfile]);

  const updateProfileExpAndLevel = useCallback((exp: number, level: number) => {
    setProfile((current) => (current ? { ...current, exp, level } : current));
  }, []);

  const signOut = useCallback(async () => {
    sessionValidation.current += 1;
    await supabase.auth.signOut().catch(() => {});
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    verified: sessionIsVerified(session),
    signInWithGoogle,
    signIn,
    signUp,
    resendVerification,
    sendRecovery,
    updatePassword,
    updateProfile,
    updateBanner,
    updateDisplayName,
    updateAvatar,
    refreshProfile,
    updateProfileExpAndLevel,
    signOut,
  }), [loading, profile, resendVerification, session, sendRecovery, signInWithGoogle, signIn, signOut, signUp, updatePassword, updateProfile, updateBanner, updateDisplayName, updateAvatar, refreshProfile, updateProfileExpAndLevel]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {profile?.is_banned ? (
        <Modal visible transparent animationType="fade" statusBarTranslucent>
          <View style={banStyles.overlay}>
            <View style={banStyles.card}>
              <View style={banStyles.iconBox}>
                <AppIcon name="shield-alert" size={40} color="#EF4444" />
              </View>
              <Text style={banStyles.title}>Akun Anda Diblokir</Text>
              <Text style={banStyles.desc}>
                Akun Anda telah diblokir oleh administrator. Silakan hubungi developer Nuenime untuk meminta pembukaan blokir akun.
              </Text>
              {profile.ban_reason ? (
                <View style={banStyles.reasonBox}>
                  <Text style={banStyles.reasonLabel}>Alasan Pemblokiran:</Text>
                  <Text style={banStyles.reasonText}>{profile.ban_reason}</Text>
                </View>
              ) : null}
              <View style={banStyles.btnCol}>
                <Pressable
                  onPress={() => {
                    try {
                      router.push("/developer" as any);
                    } catch {}
                  }}
                  style={banStyles.btnContact}
                >
                  <AppIcon name="account-wrench" size={17} color="#FFFFFF" />
                  <Text style={banStyles.btnContactText}>Hubungi Developer</Text>
                </Pressable>
                <Pressable onPress={signOut} style={banStyles.btnSignOut}>
                  <Text style={banStyles.btnSignOutText}>Keluar Akun</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAnirakuAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAnirakuAuth must be used inside AuthProvider.");
  return context;
}

const banStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.88)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0B0E14",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    alignItems: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: "Nunito-Black",
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  desc: {
    fontFamily: "Nunito-Medium",
    fontSize: 13,
    color: "#94A3B8",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 16,
  },
  reasonBox: {
    width: "100%",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  reasonLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FCA5A5",
    marginBottom: 4,
  },
  reasonText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 13,
    color: "#F87171",
  },
  btnCol: {
    width: "100%",
    gap: 10,
  },
  btnContact: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "#EF4444",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnContactText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  btnSignOut: {
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnSignOutText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#94A3B8",
  },
});
