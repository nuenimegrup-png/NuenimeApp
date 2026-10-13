import { useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";

type AiringScheduleProps = {
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
  totalEpisodes?: number | null;
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Tayang Sekarang";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days} Hari ${hours} Jam`;
  if (hours > 0) return `${hours} Jam ${minutes} Menit`;
  return `${minutes} Menit`;
}

export function AiringSchedule({ nextAiringEpisode, totalEpisodes }: AiringScheduleProps) {
  const countdown = useMemo(() => {
    if (!nextAiringEpisode?.airingAt) return null;
    const ms = nextAiringEpisode.airingAt * 1000 - Date.now();
    return formatCountdown(ms);
  }, [nextAiringEpisode?.airingAt]);

  if (!nextAiringEpisode) return null;

  const ep = nextAiringEpisode.episode;
  const aired = totalEpisodes ? ep > totalEpisodes : false;

  return (
    <View style={styles.cardContainer}>
      <View style={styles.leftContent}>
        <View style={styles.iconCircle}>
          <AppIcon name="calendar" size={16} color="#38BDF8" />
        </View>
        <View style={styles.metaCol}>
          <View style={styles.badgeRow}>
            <View style={styles.liveDot} />
            <Text style={styles.labelTitle}>JADWAL RILIS</Text>
            {aired ? (
              <View style={styles.finaleBadge}>
                <Text style={styles.finaleText}>FINALE</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.episodeText}>
            Episode {String(ep).padStart(2, "0")}
          </Text>
        </View>
      </View>

      <View style={styles.countdownBadge}>
        <AppIcon name="clock-outline" size={13} color="#38BDF8" />
        <Text style={styles.countdownText}>
          {countdown ? `Rilis dalam ${countdown}` : "Tayang Sekarang"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    gap: 12,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        } as any)
      : {}),
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  metaCol: {
    gap: 2,
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  labelTitle: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 10,
    color: "#94A3B8",
    letterSpacing: 0.6,
  },
  finaleBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  finaleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    color: "#EF4444",
  },
  episodeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  countdownBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countdownText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
  },
});
