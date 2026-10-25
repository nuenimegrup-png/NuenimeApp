import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { nothing } from "@/components/nothing-ui";
import { AppIcon } from "@/components/app-icon";
import {
  checkForNuenimeUpdate,
  getDeviceAbi,
  updateDismissalKey,
  abiLabel,
  ABI_PRIORITY,
  type AppRelease,
  type ApkAbi,
  type ApkAsset,
} from "@/lib/app-update";
import {
  downloadAndInstallApk,
  type DownloadProgress,
} from "@/lib/android-app-installer";

// ── Constants ────────────────────────────────────────────────────────────────

const installedVersion =
  Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "0.0.1";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return mb < 100 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

function formatChangelog(body?: string): string[] {
  if (!body) return [];
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !l.startsWith("#") &&
        !l.match(/^<!--/)
    )
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

// ── Download state ────────────────────────────────────────────────────────────

type Phase =
  | "idle"
  | "checking-permission"
  | "downloading"
  | "installing"
  | "error";

// ── Component ────────────────────────────────────────────────────────────────

export function AppUpdatePrompt() {
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  // ABI selection
  const [deviceAbi, setDeviceAbi] = useState<ApkAbi | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<ApkAsset | null>(null);
  const [showAbiMenu, setShowAbiMenu] = useState(false);

  const busyRef = useRef(false);

  // ── Fetch device ABI once ──
  useEffect(() => {
    getDeviceAbi().then((abi) => setDeviceAbi(abi));
  }, []);

  // ── Compute recommended asset whenever release / deviceAbi changes ──
  useEffect(() => {
    if (!release) return;
    const assets = release.assets;
    if (assets.length === 0) return;
    // Prefer device ABI → universal → first
    const recommended =
      (deviceAbi ? assets.find((a) => a.abi === deviceAbi) : null) ??
      assets.find((a) => a.abi === "universal") ??
      assets[0];
    setSelectedAsset(recommended ?? null);
  }, [release, deviceAbi]);

  // ── Update check ──
  const check = useCallback(async () => {
    try {
      const result = await checkForNuenimeUpdate(installedVersion);
      if (!result.available || !result.release) return;
      const dismissed = await AsyncStorage.getItem(
        updateDismissalKey(result.release.version)
      ).catch(() => null);
      if (!dismissed) setRelease(result.release);
    } catch {}
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check();
    });
    return () => sub.remove();
  }, [check]);

  // ── Actions ──
  const dismiss = useCallback(async () => {
    if (busyRef.current) return;
    if (release)
      await AsyncStorage.setItem(
        updateDismissalKey(release.version),
        "1"
      ).catch(() => {});
    setRelease(null);
    setPhase("idle");
    setProgress(null);
    setErrorMsg(null);
    setShowAbiMenu(false);
  }, [release]);

  const install = useCallback(async () => {
    if (!release || !selectedAsset || busyRef.current) return;
    busyRef.current = true;
    setPhase("downloading");
    setProgress(null);
    setErrorMsg(null);
    try {
      await downloadAndInstallApk(selectedAsset, (p) => {
        setProgress(p);
      });
      setPhase("installing");
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? e.message : "Terjadi kesalahan saat mengunduh."
      );
      setPhase("error");
    } finally {
      busyRef.current = false;
    }
  }, [release, selectedAsset]);

  const changelog = useMemo(
    () => formatChangelog(release?.body),
    [release?.body]
  );

  const isAndroid = Platform.OS === "android";
  const isDownloading = phase === "downloading";
  const isInstalling = phase === "installing";
  const isBusy = isDownloading || isInstalling;

  const progressFraction = progress?.fraction ?? 0;
  const progressPct = Math.round(progressFraction * 100);
  const progressLabel =
    isInstalling
      ? "Membuka installer..."
      : isDownloading && progress
      ? `Mengunduh... ${progressPct}%  (${formatBytes(progress.bytesWritten)} / ${formatBytes(progress.totalBytes)})`
      : null;

  // ── Sorted asset list for ABI menu ──
  const sortedAssets = useMemo(() => {
    if (!release) return [];
    return [...release.assets].sort((a, b) => {
      const ai = a.abi ? ABI_PRIORITY.indexOf(a.abi) : 99;
      const bi = b.abi ? ABI_PRIORITY.indexOf(b.abi) : 99;
      return ai - bi;
    });
  }, [release]);

  if (!release) return null;

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={() => { void dismiss(); }}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.updateBadge}>
                <View style={styles.updateDot} />
                <Text style={styles.updateBadgeText}>PEMBARUAN TERSEDIA</Text>
              </View>
              <Text style={styles.versionText}>Versi {release.version}</Text>
            </View>
            {!isBusy && (
              <Pressable
                onPress={() => void dismiss()}
                accessibilityRole="button"
                accessibilityLabel="Tutup"
                hitSlop={10}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && nothing.pressed,
                ]}
              >
                <AppIcon name="close" size={16} color={nothing.dim} />
              </Pressable>
            )}
          </View>

          <View style={styles.divider} />

          {/* ── Changelog ── */}
          {changelog.length > 0 && (
            <ScrollView
              style={styles.changelogScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {changelog.map((line, i) => (
                <View key={i} style={styles.changelogRow}>
                  <View style={styles.changelogBullet} />
                  <Text style={styles.changelogText}>{line}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* ── Mandatory notice ── */}
          {release.mandatory && (
            <View style={styles.mandatoryRow}>
              <AppIcon name="alert-circle-outline" size={13} color={nothing.red} />
              <Text style={styles.mandatoryText}>Pembaruan ini wajib diinstal.</Text>
            </View>
          )}

          {/* ── ABI Selector (Android only, multi-asset) ── */}
          {isAndroid && sortedAssets.length > 1 && !isBusy && (
            <View>
              <Text style={styles.abiLabel}>Pilih Versi APK</Text>
              <Pressable
                onPress={() => setShowAbiMenu((v) => !v)}
                style={({ pressed }) => [
                  styles.abiSelector,
                  pressed && nothing.pressedSubtle,
                ]}
                accessibilityRole="button"
              >
                <View style={styles.abiSelectorLeft}>
                  <Text style={styles.abiSelectorValue}>
                    {selectedAsset
                      ? abiLabel(selectedAsset.abi)
                      : "Pilih arsitektur"}
                  </Text>
                  {selectedAsset?.size ? (
                    <Text style={styles.abiSelectorSize}>
                      {formatBytes(selectedAsset.size)}
                    </Text>
                  ) : null}
                </View>
                <AppIcon
                  name={showAbiMenu ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={nothing.muted}
                />
              </Pressable>

              {showAbiMenu && (
                <View style={styles.abiMenu}>
                  {sortedAssets.map((asset) => {
                    const isSelected = asset.name === selectedAsset?.name;
                    const isRecommended =
                      deviceAbi
                        ? asset.abi === deviceAbi
                        : asset.abi === "universal";
                    return (
                      <Pressable
                        key={asset.name}
                        onPress={() => {
                          setSelectedAsset(asset);
                          setShowAbiMenu(false);
                        }}
                        style={({ pressed }) => [
                          styles.abiMenuItem,
                          isSelected && styles.abiMenuItemSelected,
                          pressed && nothing.pressedSubtle,
                        ]}
                        accessibilityRole="menuitem"
                      >
                        <View style={styles.abiMenuItemLeft}>
                          <Text
                            style={[
                              styles.abiMenuItemText,
                              isSelected && styles.abiMenuItemTextSelected,
                            ]}
                          >
                            {abiLabel(asset.abi)}
                          </Text>
                          {isRecommended && (
                            <View style={styles.recommendedBadge}>
                              <Text style={styles.recommendedText}>
                                REKOMENDASI
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.abiMenuItemRight}>
                          <Text style={styles.abiMenuItemSize}>
                            {formatBytes(asset.size)}
                          </Text>
                          {isSelected && (
                            <AppIcon
                              name="check"
                              size={14}
                              color={nothing.green}
                            />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ── Progress bar ── */}
          {isBusy && (
            <View style={styles.progressSection}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: isInstalling
                        ? "100%"
                        : `${Math.max(progressFraction * 100, 2)}%`,
                    },
                  ]}
                />
              </View>
              {progressLabel && (
                <Text style={styles.progressLabel}>{progressLabel}</Text>
              )}
            </View>
          )}

          {/* ── Error ── */}
          {phase === "error" && errorMsg && (
            <View style={styles.errorRow}>
              <AppIcon name="alert-circle-outline" size={13} color={nothing.red} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* ── Actions ── */}
          <View style={styles.actions}>
            {isAndroid ? (
              <Pressable
                disabled={isBusy || !selectedAsset}
                onPress={() => void install()}
                style={({ pressed }) => [
                  styles.installBtn,
                  (isBusy || !selectedAsset) && styles.installBtnDisabled,
                  pressed && !isBusy && nothing.pressedSubtle,
                ]}
                accessibilityRole="button"
              >
                {isBusy ? (
                  <ActivityIndicator size="small" color={nothing.black} />
                ) : (
                  <Text style={styles.installBtnText}>
                    {phase === "error" ? "COBA LAGI" : "UNDUH DAN INSTAL"}
                  </Text>
                )}
              </Pressable>
            ) : null}

            {!isBusy && (
              <Pressable
                onPress={() => void dismiss()}
                style={({ pressed }) => [
                  styles.laterBtn,
                  pressed && nothing.pressedSubtle,
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.laterBtnText}>NANTI</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.78)",
    padding: 16,
    paddingBottom: 24,
  },
  sheet: {
    backgroundColor: nothing.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: nothing.line,
    borderBottomWidth: 3,
    borderBottomColor: nothing.red,
    padding: 20,
    gap: 14,
    overflow: "hidden",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerLeft: { gap: 6, flex: 1 },
  updateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  updateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: nothing.red,
  },
  updateBadgeText: {
    fontFamily: nothing.mono,
    fontSize: 9,
    fontWeight: "800",
    color: nothing.red,
    letterSpacing: 1,
  },
  versionText: {
    fontFamily: nothing.fontBold,
    fontSize: 24,
    fontWeight: "900",
    color: nothing.white,
    letterSpacing: -0.6,
  },
  closeBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: nothing.raised,
    borderWidth: 1,
    borderColor: nothing.line,
  },

  divider: {
    height: 1,
    backgroundColor: nothing.line,
    marginHorizontal: -20,
  },

  // Changelog
  changelogScroll: { maxHeight: 140 },
  changelogRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 3 },
  changelogBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: nothing.dim,
    marginTop: 6,
    flexShrink: 0,
  },
  changelogText: {
    fontFamily: nothing.font,
    fontSize: 12.5,
    color: nothing.muted,
    lineHeight: 18,
    flex: 1,
  },

  // Mandatory
  mandatoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,77,77,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.25)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mandatoryText: {
    fontFamily: nothing.fontMedium,
    fontSize: 12,
    color: nothing.red,
  },

  // ABI Selector
  abiLabel: {
    fontFamily: nothing.mono,
    fontSize: 9,
    fontWeight: "800",
    color: nothing.dim,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  abiSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: nothing.raised,
    borderWidth: 1,
    borderColor: nothing.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  abiSelectorLeft: { gap: 2 },
  abiSelectorValue: {
    fontFamily: nothing.fontMedium,
    fontSize: 13,
    color: nothing.white,
  },
  abiSelectorSize: {
    fontFamily: nothing.font,
    fontSize: 10.5,
    color: nothing.dim,
  },

  // ABI Dropdown menu
  abiMenu: {
    marginTop: 4,
    backgroundColor: nothing.raised,
    borderWidth: 1,
    borderColor: nothing.line,
    borderRadius: 10,
    overflow: "hidden",
  },
  abiMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: nothing.line,
  },
  abiMenuItemSelected: { backgroundColor: "rgba(246,246,242,0.06)" },
  abiMenuItemLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  abiMenuItemText: {
    fontFamily: nothing.font,
    fontSize: 13,
    color: nothing.muted,
  },
  abiMenuItemTextSelected: {
    fontFamily: nothing.fontMedium,
    color: nothing.white,
  },
  abiMenuItemRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  abiMenuItemSize: {
    fontFamily: nothing.font,
    fontSize: 11,
    color: nothing.dim,
  },
  recommendedBadge: {
    backgroundColor: "rgba(150,211,123,0.12)",
    borderWidth: 1,
    borderColor: "rgba(150,211,123,0.3)",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recommendedText: {
    fontFamily: nothing.mono,
    fontSize: 8,
    fontWeight: "800",
    color: nothing.green,
    letterSpacing: 0.5,
  },

  // Progress
  progressSection: { gap: 8 },
  progressTrack: {
    height: 3,
    backgroundColor: nothing.line,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    backgroundColor: nothing.white,
    borderRadius: 2,
  },
  progressLabel: {
    fontFamily: nothing.font,
    fontSize: 11,
    color: nothing.dim,
    textAlign: "center",
    letterSpacing: 0.2,
  },

  // Error
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "rgba(255,77,77,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.2)",
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    fontFamily: nothing.font,
    fontSize: 11.5,
    color: nothing.red,
    flex: 1,
    lineHeight: 16,
  },

  // Actions
  actions: { flexDirection: "row", gap: 10 },
  installBtn: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: nothing.white,
    borderRadius: 10,
  },
  installBtnDisabled: { opacity: 0.45 },
  installBtnText: {
    fontFamily: nothing.fontBold,
    fontSize: 12,
    fontWeight: "900",
    color: nothing.black,
    letterSpacing: 0.5,
  },
  laterBtn: {
    minWidth: 80,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: nothing.line,
    borderRadius: 10,
    backgroundColor: nothing.raised,
  },
  laterBtnText: {
    fontFamily: nothing.fontMedium,
    fontSize: 12,
    color: nothing.muted,
    letterSpacing: 0.3,
  },
});
