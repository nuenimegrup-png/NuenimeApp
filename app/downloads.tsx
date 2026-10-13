import { useEffect, useMemo } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { NetworkStateType, useNetworkState } from "expo-network";
import * as Haptics from "expo-haptics";
import { useDownloadQueue, useOfflineDownloads } from "@/hooks/use-downloads";
import { useDownloadSettings } from "@/hooks/use-download-settings";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import {
  cancelDownloadJob,
  dismissDownloadJob,
  formatBytes,
  isOfflineSavingSupported,
  retryDownloadJob,
  type OfflineDownload,
  type OfflineDownloadJob,
} from "@/lib/downloads";
import { NativeScreen } from "@/components/screen";
import { Toggle } from "@/components/toggle";

const MEGABYTE = 1024 * 1024;
const quotaOptionsMb = [0, 1024, 2048, 5120];
const quotaLabels: Record<number, string> = {
  0: "TANPA BATAS",
  1024: "1 GB",
  2048: "2 GB",
  5120: "5 GB",
};

const jobStateLabel: Record<OfflineDownloadJob["state"], string> = {
  queued: "DALAM ANTREAN",
  downloading: "MENGUNDUH",
  done: "SELESAI",
  failed: "GAGAL",
};

function jobStatusLabel(job: OfflineDownloadJob): string {
  if (job.state === "queued" && job.hold === "wifi") return "MENUNGGU WI-FI";
  if (job.state === "queued" && job.hold === "quota") return "MEMORI PENUH";
  return jobStateLabel[job.state];
}

export default function DownloadsScreen() {
  const queue = useDownloadQueue();
  const saved = useOfflineDownloads();
  const prefs = useDownloadSettings();
  const network = useNetworkState();
  const { displayRows } = useWatchHistory();
  const supported = isOfflineSavingSupported();

  // New files change the storage readout; keep the bar in sync.
  useEffect(() => {
    void prefs.refresh();
  }, [prefs.refresh, saved.entries.length]);

  const posterByAnimeId = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of displayRows) {
      const id = Number(row?.anime_id);
      if (!Number.isInteger(id) || map.has(id)) continue;
      const uri = row?.episode_thumbnail || row?.anime_image;
      if (uri) map.set(id, String(uri));
    }
    return map;
  }, [displayRows]);

  const waitingForWifi =
    prefs.settings.wifiOnly &&
    (network.type === NetworkStateType.CELLULAR || network.isConnected === false);

  const quotaBytes = prefs.settings.quotaMb > 0 ? prefs.settings.quotaMb * MEGABYTE : 0;
  const capacityBytes = quotaBytes > 0 ? quotaBytes : prefs.usedBytes + prefs.freeBytes;
  const fillRatio = capacityBytes > 0 ? Math.min(1, prefs.usedBytes / capacityBytes) : 0;
  const overQuota = quotaBytes > 0 && prefs.usedBytes >= quotaBytes;

  const confirmRemove = (entry: OfflineDownload) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Hapus Unduhan?",
      `${entry.title} · Episode ${entry.episode} akan dihapus dari penyimpanan perangkat ini.`,
      [
        { text: "BATAL", style: "cancel" },
        {
          text: "HAPUS",
          style: "destructive",
          onPress: () =>
            void saved.remove(entry).catch(() => {
              Alert.alert(
                "Gagal Menghapus",
                "File masih digunakan atau tidak dapat dihapus. Silakan coba sesaat lagi."
              );
              void saved.refresh();
            }),
        },
      ]
    );
  };

  const openEpisode = (animeId: number, episode: number, title: string, image: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/watch/[id]",
      params: { id: String(animeId), episode: String(episode), title, image },
    } as never);
  };

  const renderJob = (job: OfflineDownloadJob) => {
    const poster = posterByAnimeId.get(job.animeId) ?? "";
    const label = jobStatusLabel(job);
    const isError = job.state === "failed" || Boolean(job.hold);
    return (
      <View key={job.id} style={styles.jobCard}>
        {poster ? (
          <Image
            source={{ uri: poster }}
            style={styles.thumb}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.thumbFallback}>
            <Text style={styles.thumbLetter}>{String(job.title || "A").charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.rowBody}>
          <View style={styles.badgeRow}>
            <View style={styles.qualityBadge}>
              <Text style={styles.qualityBadgeText}>{`EP ${job.episode} · ${job.quality.toUpperCase()}`}</Text>
            </View>
          </View>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {job.title}
          </Text>
          <Text style={[styles.rowMeta, isError && styles.rowMetaAlert]}>{label}</Text>
          {job.state === "downloading" ? (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${Math.round(Math.min(1, Math.max(0, job.progress)) * 100)}%` },
                ]}
              />
            </View>
          ) : null}
          {job.state === "failed" && job.error ? (
            <Text style={styles.jobError} numberOfLines={2}>
              {job.error}
            </Text>
          ) : null}
        </View>
        <View style={styles.jobActions}>
          {job.state === "failed" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Coba lagi unduh ${job.title}`}
              onPress={() => retryDownloadJob(job.id)}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
            >
              <AppIcon name="refresh" size={16} color="#FFFFFF" />
            </Pressable>
          ) : null}
          {job.state === "queued" || job.state === "downloading" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Batalkan unduhan ${job.title}`}
              onPress={() => cancelDownloadJob(job.id)}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
            >
              <AppIcon name="close" size={16} color="#94A3B8" />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Hapus ${job.title} dari antrean`}
              onPress={() => dismissDownloadJob(job.id)}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
            >
              <AppIcon name="trash-can-outline" size={16} color="#EF4444" />
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const renderSavedEntry = (entry: OfflineDownload) => {
    const poster = posterByAnimeId.get(entry.animeId) ?? "";
    return (
      <Pressable
        key={`${entry.animeId}-${entry.episode}`}
        accessibilityRole="button"
        accessibilityLabel={`Tonton offline ${entry.title} episode ${entry.episode}`}
        onPress={() => openEpisode(entry.animeId, entry.episode, entry.title, poster)}
        onLongPress={() => confirmRemove(entry)}
        style={({ pressed }) => [styles.rowCard, pressed && styles.btnPressed]}
      >
        {poster ? (
          <Image
            source={{ uri: poster }}
            style={styles.thumb}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.thumbFallback}>
            <Text style={styles.thumbLetter}>{String(entry.title || "A").charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.rowBody}>
          <View style={styles.badgeRow}>
            <View style={styles.qualityBadge}>
              <Text style={styles.qualityBadgeText}>{`EP ${entry.episode} · ${entry.quality.toUpperCase()}`}</Text>
            </View>
          </View>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {entry.title}
          </Text>
          <Text style={styles.rowMeta}>{`${formatBytes(entry.size)} · Tersimpan di HP`}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Hapus unduhan ${entry.title} episode ${entry.episode}`}
          hitSlop={10}
          onPress={() => confirmRemove(entry)}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
        >
          <AppIcon name="trash-can-outline" size={16} color="#64748B" />
        </Pressable>
        <View style={styles.playIconCircle}>
          <AppIcon name="play" size={16} color="#FFFFFF" />
        </View>
      </Pressable>
    );
  };

  const header = (
    <View style={styles.headerWrap}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
        >
          <AppIcon name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>OFFLINE · EPISODE TERSIMPAN</Text>
          <Text style={styles.screenTitle}>Unduhan</Text>
        </View>
        <View style={styles.headerBrandBadge}>
          <AppIcon name="download" size={18} color="#38BDF8" />
        </View>
      </View>

      {/* Android-Only Notice Banner (for Web or unsupported platforms) */}
      {!supported ? (
        <View style={styles.bannerCard}>
          <View style={styles.bannerHeaderRow}>
            <View style={styles.bannerDotRed} />
            <Text style={styles.bannerTitle}>HANYA TERSEDIA DI ANDROID</Text>
          </View>
          <Text style={styles.bannerText}>
            Fitur unduh episode untuk ditonton secara offline saat ini khusus perangkat Android. Semua episode yang kamu simpan di aplikasi Android akan tetap tercatat di sini.
          </Text>
        </View>
      ) : null}

      {/* Storage Settings Glass Card */}
      <View style={styles.glassCard}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Pengaturan Penyimpanan</Text>
          <Text style={styles.storageText}>
            {`${formatBytes(prefs.usedBytes)} Digunakan`}{quotaBytes > 0 ? ` / Batas ${formatBytes(quotaBytes)}` : prefs.freeBytes > 0 ? ` · Sisa ${formatBytes(prefs.freeBytes)}` : ""}
          </Text>
        </View>

        {/* Storage Progress Track */}
        <View style={styles.storageTrack}>
          <View
            style={[
              styles.storageFill,
              { width: `${Math.max(3, Math.round(fillRatio * 100))}%` },
              overQuota && styles.storageFillOver,
            ]}
          />
        </View>

        {/* Wi-Fi Only Toggle Row */}
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Unduh Hanya Lewat Wi-Fi</Text>
            <Text style={styles.settingHint}>Tunda unduhan baru hingga terhubung ke jaringan Wi-Fi.</Text>
          </View>
          <Toggle
            enabled={prefs.settings.wifiOnly}
            onToggle={() => void prefs.toggleWifiOnly()}
            label="Unduh hanya lewat Wi-Fi"
          />
        </View>

        {waitingForWifi ? (
          <View style={styles.warningPill}>
            <AppIcon name="wifi-off" size={14} color="#EF4444" />
            <Text style={styles.warningText}>Menunggu koneksi Wi-Fi — antrean unduhan dijeda.</Text>
          </View>
        ) : null}

        {/* Quota Limit Chips */}
        <View style={styles.quotaRow}>
          {quotaOptionsMb.map((mb) => {
            const active = prefs.settings.quotaMb === mb;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Batas memori ${quotaLabels[mb]}`}
                accessibilityState={{ selected: active }}
                key={mb}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  prefs.setQuotaMb(mb);
                }}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {quotaLabels[mb]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {overQuota ? (
          <Text style={styles.overQuota}>
            Penyimpanan melampaui batas — unduhan antrean akan dijeda hingga ruang penyimpanan dikosongkan atau batas dinaikkan.
          </Text>
        ) : null}
      </View>

      {/* Downloading Queue Section */}
      {queue.length ? (
        <View style={styles.queueSection}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Sedang Mengunduh</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{String(queue.length)}</Text>
            </View>
          </View>
          <View style={styles.cardsStack}>
            {queue.map(renderJob)}
          </View>
        </View>
      ) : null}
    </View>
  );

  const body = saved.loading ? (
    <LoadingState label="Membaca daftar unduhan..." />
  ) : saved.error ? (
    <ErrorState message={saved.error} onRetry={() => void saved.refresh()} retryLabel="COBA LAGI" />
  ) : saved.entries.length === 0 ? (
    <EmptyState
      label="Belum ada episode yang diunduh untuk diputar secara offline."
      action={{ label: "JELAJAHI KATALOG", onPress: () => router.push("/catalog" as never) }}
    />
  ) : (
    <View style={styles.cardsStack}>
      {saved.entries.map(renderSavedEntry)}
    </View>
  );

  return (
    <NativeScreen style={styles.fill}>
      {header}
      <View style={styles.listSection}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Tersimpan di Perangkat Ini</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{String(saved.entries.length)}</Text>
          </View>
        </View>
        {body}
      </View>
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: "#0B0E17",
  },
  headerWrap: {
    gap: 16,
    marginBottom: 8,
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  // ─── TOP BAR ───
  topBar: {
    minHeight: 64,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: "#64748B",
    fontSize: 10,
    fontFamily: "Nunito-Bold",
    letterSpacing: 0.5,
  },
  screenTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: "Nunito-Black",
    letterSpacing: -0.4,
  },
  headerBrandBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── BANNER (UNSUPPORTED PLATFORM) ───
  bannerCard: {
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.22)",
  },
  bannerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bannerDotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EF4444",
  },
  bannerTitle: {
    color: "#EF4444",
    fontSize: 11,
    fontFamily: "Nunito-Black",
    letterSpacing: 0.4,
  },
  bannerText: {
    color: "#94A3B8",
    fontSize: 12.5,
    fontFamily: "Nunito-Regular",
    lineHeight: 18,
  },

  // ─── GLASS CARD (STORAGE SETTINGS) ───
  glassCard: {
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        } as any)
      : {}),
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Nunito-Bold",
    letterSpacing: -0.2,
  },
  storageText: {
    color: "#94A3B8",
    fontFamily: "Nunito-Bold",
    fontSize: 11,
  },
  storageTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  storageFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 3,
  },
  storageFillOver: {
    backgroundColor: "#EF4444",
  },

  // ─── TOGGLE ROW ───
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingTop: 2,
  },
  settingCopy: {
    flex: 1,
    gap: 2,
  },
  settingTitle: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Nunito-Bold",
  },
  settingHint: {
    color: "#64748B",
    fontSize: 11.5,
    fontFamily: "Nunito-Regular",
    lineHeight: 16,
  },
  warningPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  warningText: {
    color: "#EF4444",
    fontSize: 11,
    fontFamily: "Nunito-Bold",
  },

  // ─── QUOTA CHIPS ───
  quotaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 32,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.055)",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          cursor: "pointer",
        } as any)
      : {}),
  },
  chipActive: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  chipText: {
    color: "#94A3B8",
    fontSize: 11,
    fontFamily: "Nunito-Bold",
    letterSpacing: 0.3,
  },
  chipTextActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },
  overQuota: {
    color: "#EF4444",
    fontSize: 11.5,
    fontFamily: "Nunito-Bold",
    lineHeight: 16,
  },

  // ─── QUEUE & LIST SECTIONS ───
  queueSection: {
    gap: 10,
  },
  listSection: {
    gap: 12,
    paddingTop: 10,
    paddingBottom: 48,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  countBadgeText: {
    color: "#94A3B8",
    fontSize: 11,
    fontFamily: "Nunito-Bold",
  },
  cardsStack: {
    gap: 8,
  },

  // ─── ROW CARD ───
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  thumb: {
    width: 52,
    height: 74,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  thumbFallback: {
    width: 52,
    height: 74,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbLetter: {
    color: "#64748B",
    fontSize: 24,
    fontFamily: "Nunito-Black",
  },
  rowBody: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  badgeRow: {
    flexDirection: "row",
  },
  qualityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  qualityBadgeText: {
    color: "#38BDF8",
    fontSize: 9.5,
    fontFamily: "Nunito-Black",
    letterSpacing: 0.3,
  },
  rowTitle: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Nunito-Bold",
    lineHeight: 18,
  },
  rowMeta: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Nunito-SemiBold",
  },
  rowMetaAlert: {
    color: "#EF4444",
  },
  jobError: {
    color: "#EF4444",
    fontSize: 11,
    fontFamily: "Nunito-SemiBold",
    lineHeight: 15,
  },
  progressTrack: {
    height: 4,
    overflow: "hidden",
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginTop: 4,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#EF4444",
    borderRadius: 2,
  },
  jobActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  playIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
  },
});
