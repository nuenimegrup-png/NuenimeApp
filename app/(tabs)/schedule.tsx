import { memo, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { getAiringScheduleWindow, type AiringScheduleWindow } from "@/lib/anilist";
import { APP_CONFIG } from "@/lib/app-config";
import { animeTitle } from "@/lib/types";
import type { AiringScheduleItem, AiringSchedulePage } from "@/lib/types";
import { useNotifyMe } from "@/hooks/use-notify-me";
import { ErrorState, LoadingState, EmptyState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import { hapticLight } from "@/lib/haptics";

/** Same slim media fragment lib/anilist.ts ships for schedule rows. */
const SCHEDULE_MEDIA_FIELDS = `id type title { romaji english native } coverImage { large extraLarge } format status averageScore popularity`;

type ArchivePage = {
  pageInfo?: { currentPage?: number; hasNextPage?: boolean; total?: number | null };
  airingSchedules?: AiringScheduleItem[];
};

// Archive round trips are spaced so rapid "previous day" taps cannot burn AniList rate limit
let nextArchiveRequestAt = 0;
const ARCHIVE_REQUEST_INTERVAL_MS = 2_500;

async function fetchAiringArchive(window: AiringScheduleWindow): Promise<AiringSchedulePage> {
  const query = `query AiringArchive($startAt: Int, $endAt: Int) {
    first: Page(page: 1, perPage: 50) { pageInfo { currentPage hasNextPage total } airingSchedules(airingAt_greater: $startAt, airingAt_lesser: $endAt, sort: [TIME]) { airingAt episode media { ${SCHEDULE_MEDIA_FIELDS} } } }
    second: Page(page: 2, perPage: 50) { airingSchedules(airingAt_greater: $startAt, airingAt_lesser: $endAt, sort: [TIME]) { airingAt episode media { ${SCHEDULE_MEDIA_FIELDS} } } }
  }`;
  const now = Date.now();
  const scheduledAt = Math.max(now, nextArchiveRequestAt);
  nextArchiveRequestAt = scheduledAt + ARCHIVE_REQUEST_INTERVAL_MS;
  if (scheduledAt > now) await new Promise<void>((resolve) => { setTimeout(resolve, scheduledAt - now); });
  const response = await fetch(APP_CONFIG.anilistGraphqlUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { startAt: window.startAt, endAt: window.endAt } }),
  });
  if (response.status === 429) throw new Error("AniList sedang sibuk. Tunggu sebentar dan coba lagi.");
  const payload = (await response.json().catch(() => null)) as {
    data?: { first?: ArchivePage; second?: ArchivePage };
    errors?: Array<{ message?: string }>;
  } | null;
  if (!response.ok || payload?.errors?.length || !payload?.data?.first) {
    throw new Error(payload?.errors?.[0]?.message || "Gagal memuat jadwal tayang anime.");
  }
  const first = payload.data.first;
  const airingSchedules = [...(first.airingSchedules ?? []), ...(payload.data.second?.airingSchedules ?? [])];
  return {
    pageInfo: {
      currentPage: first.pageInfo?.currentPage ?? 1,
      hasNextPage: Boolean(first.pageInfo?.hasNextPage),
      total: first.pageInfo?.total ?? airingSchedules.length,
    },
    airingSchedules,
  };
}

function startOfLocalDay(value: Date) {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  return start;
}

function localDayKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`;
}

const ID_DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

type DayGroup = {
  key: string;
  dayName: string;
  dateLabel: string;
  items: AiringScheduleItem[];
};

/** Memoized timeline item row with authentic Liquid Glass card */
const TimelineScheduleRow = memo(function TimelineScheduleRow({
  item,
  isLast,
}: {
  item: AiringScheduleItem;
  isLast: boolean;
}) {
  const notify = useNotifyMe(item.media.id);
  const date = new Date(item.airingAt * 1000);
  const anime = item.media;
  const title = animeTitle(anime);

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const timeStr = `${hours}:${minutes}`;

  const isAired = item.airingAt * 1000 <= Date.now();

  // Score & popularity formatting from live AniList metadata (no longer dummy data)
  const scoreVal = typeof anime.averageScore === "number" && anime.averageScore > 0
    ? (anime.averageScore / 10).toFixed(1)
    : "—";
  const popVal = typeof anime.popularity === "number" && anime.popularity > 0
    ? anime.popularity >= 1000
      ? `${(anime.popularity / 1000).toFixed(anime.popularity >= 10000 ? 0 : 1)}K`
      : String(anime.popularity)
    : "—";

  return (
    <View style={styles.timelineRow}>
      {/* Left Column: Time & Silver Dot & Vertical Connector */}
      <View style={styles.timelineCol}>
        <Text style={styles.timelineTime}>{timeStr}</Text>
        <View style={styles.timelineDot} />
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>

      {/* Right Column: Liquid Glass Anime Card */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Buka ${title}`}
        onPress={() => {
          hapticLight();
          router.push((`/anime/${anime.id}`) as never);
        }}
        style={({ pressed }) => [styles.glassCard, pressed && styles.btnPressed]}
      >
        <Image
          source={{ uri: anime.coverImage?.large || anime.coverImage?.extraLarge || "" }}
          style={styles.cardPoster}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.cardEpisode}>Episode {item.episode}</Text>
          <Text style={styles.cardStatus}>
            {isAired ? "Sudah Tayang" : "Menunggu Update"}
          </Text>

          <View style={styles.cardStatsRow}>
            <View style={styles.cardStatItem}>
              <AppIcon name="play" size={11} color="#94A3B8" />
              <Text style={styles.cardStatText}>{popVal}</Text>
            </View>
            <View style={styles.cardStatItem}>
              <Text style={styles.cardStarIcon}>★</Text>
              <Text style={styles.cardScoreText}>{scoreVal}</Text>
            </View>
          </View>
        </View>

        {/* Bell Alert Toggle */}
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: notify.enabled }}
          accessibilityLabel={notify.enabled ? `Pengingat aktif untuk ${title}` : `Ingatkan ${title}`}
          hitSlop={10}
          onPress={() => {
            hapticLight();
            void notify.toggle();
          }}
          style={({ pressed }) => [
            styles.bellBtn,
            notify.enabled && styles.bellBtnActive,
            pressed && styles.btnPressed,
          ]}
        >
          <AppIcon
            name={notify.enabled ? "bell" : "bell-outline"}
            size={16}
            color={notify.enabled ? "#38BDF8" : "rgba(255, 255, 255, 0.45)"}
          />
        </Pressable>
      </Pressable>
    </View>
  );
});

export default function ScheduleScreen() {
  const [dayOffset, setDayOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const [todayKey, setTodayKey] = useState(() => localDayKey(new Date()));
  useEffect(() => {
    const timer = setInterval(() => {
      setTodayKey((prev) => {
        const next = localDayKey(new Date());
        return next === prev ? prev : next;
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const window = useMemo(() => {
    const start = startOfLocalDay(new Date());
    start.setDate(start.getDate() + dayOffset);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { startAt: Math.floor(start.getTime() / 1000), endAt: Math.floor(end.getTime() / 1000) };
  }, [dayOffset, todayKey]);

  const schedule = useQuery({
    queryKey: ["schedule", window.startAt, window.endAt],
    queryFn: () => (dayOffset < 0 ? fetchAiringArchive(window) : getAiringScheduleWindow(window)),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  // Group schedules by local day
  const dayGroups: DayGroup[] = useMemo(() => {
    if (!schedule.data?.airingSchedules) return [];
    const map = new Map<string, { dayName: string; dateLabel: string; items: AiringScheduleItem[] }>();

    schedule.data.airingSchedules.forEach((item) => {
      const d = new Date(item.airingAt * 1000);
      const dayKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const dayName = ID_DAYS[d.getDay()] || "Senin";
      const dateLabel = `${d.getDate()} ${d.toLocaleDateString("id-ID", { month: "short" })}`;

      const current = map.get(dayKey) ?? { dayName, dateLabel, items: [] };
      current.items.push(item);
      map.set(dayKey, current);
    });

    return [...map.entries()].map(([key, val]) => ({
      key,
      dayName: val.dayName,
      dateLabel: val.dateLabel,
      items: val.items,
    }));
  }, [schedule.data]);

  const safeIndex = Math.min(selectedDayIndex, Math.max(0, dayGroups.length - 1));
  const currentGroup = dayGroups[safeIndex];
  const nextGroup = dayGroups.length > 1 ? dayGroups[(safeIndex + 1) % dayGroups.length] : null;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* 1. Header Bar: Jadwal Tayang */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Jadwal Tayang</Text>
      </View>

      {/* 2. Horizontal Day Chips Selection */}
      {dayGroups.length > 0 ? (
        <View style={styles.dayTabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayTabsScroll}
          >
            {dayGroups.map((group, idx) => {
              const isActive = safeIndex === idx;
              return (
                <Pressable
                  key={group.key}
                  onPress={() => {
                    hapticLight();
                    setSelectedDayIndex(idx);
                  }}
                  style={({ pressed }) => [
                    styles.dayTabPill,
                    isActive && styles.dayTabPillActive,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayTabPillText,
                      isActive && styles.dayTabPillTextActive,
                    ]}
                  >
                    {group.dayName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* 3. Day Header Row: [Senin] on Left, [7 Anime] on Right */}
      {currentGroup ? (
        <View style={styles.dayInfoRow}>
          <View style={styles.selectedDayPill}>
            <Text style={styles.selectedDayPillText}>{currentGroup.dayName}</Text>
          </View>
          <View style={styles.countBadgePill}>
            <Text style={styles.countBadgePillText}>
              {currentGroup.items.length} Anime
            </Text>
          </View>
        </View>
      ) : null}

      {/* 4. Main Timeline Content & States */}
      {schedule.isPending ? (
        <LoadingState label="Memuat jadwal tayang anime..." />
      ) : schedule.isError || !schedule.data ? (
        <ErrorState
          message={schedule.error?.message ?? "Gagal memuat jadwal tayang."}
          onRetry={() => void schedule.refetch()}
        />
      ) : !dayGroups.length || !currentGroup?.items.length ? (
        <EmptyState label="Belum ada anime yang dijadwalkan untuk hari ini." />
      ) : (
        <FlatList
          data={currentGroup.items}
          keyExtractor={(item, index) => `${item.media?.id ?? "anime"}:${item.episode}:${item.airingAt}:${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={schedule.isFetching && !schedule.isPending}
              onRefresh={() => void schedule.refetch()}
              tintColor="#38BDF8"
            />
          }
          renderItem={({ item, index }) => (
            <TimelineScheduleRow
              item={item}
              isLast={index === currentGroup.items.length - 1}
            />
          )}
        />
      )}

      {/* 5. Floating Bottom-Right Next Day Pill (e.g. "Selasa →") */}
      {nextGroup ? (
        <Pressable
          onPress={() => {
            hapticLight();
            setSelectedDayIndex((prev) => (prev + 1) % dayGroups.length);
          }}
          style={({ pressed }) => [styles.floatingNextBtn, pressed && styles.btnPressed]}
          accessibilityLabel={`Pindah ke hari ${nextGroup.dayName}`}
        >
          <Text style={styles.floatingNextText}>{nextGroup.dayName}</Text>
          <AppIcon name="arrow-right" size={15} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E17",
  },
  btnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },

  // ─── HEADER ───
  headerBar: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  // ─── HORIZONTAL DAY TABS ───
  dayTabsWrapper: {
    paddingVertical: 6,
  },
  dayTabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dayTabPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  dayTabPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderColor: "#E2E8F0",
  },
  dayTabPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#94A3B8",
  },
  dayTabPillTextActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },

  // ─── DAY INFO ROW: [Senin] & [7 Anime] ───
  dayInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  selectedDayPill: {
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  selectedDayPillText: {
    fontFamily: "Nunito-Black",
    color: "#FFFFFF",
    fontSize: 13.5,
  },
  countBadgePill: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  countBadgePillText: {
    fontFamily: "Nunito-Bold",
    color: "#94A3B8",
    fontSize: 12.5,
  },

  // ─── TIMELINE & LIST ───
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 110,
    paddingTop: 4,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 16,
  },

  // Left Column
  timelineCol: {
    width: 52,
    alignItems: "center",
    paddingTop: 10,
    position: "relative",
    marginRight: 8,
    alignSelf: "stretch",
  },
  timelineTime: {
    fontFamily: "Nunito-Black",
    color: "#CBD5E1",
    fontSize: 12.5,
    marginBottom: 8,
    textAlign: "center",
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#CBD5E1",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    zIndex: 2,
  },
  timelineLine: {
    position: "absolute",
    top: 40,
    bottom: -18,
    width: 2,
    backgroundColor: "rgba(203, 213, 225, 0.35)",
    zIndex: 1,
  },

  // Right Column: Liquid Glass Anime Card
  glassCard: {
    flex: 1,
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        } as any)
      : {}),
  },
  cardPoster: {
    width: 70,
    height: 98,
    borderRadius: 12,
    backgroundColor: "#161B26",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cardInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 3,
  },
  cardTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  cardEpisode: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#E2E8F0",
  },
  cardStatus: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#94A3B8",
  },
  cardStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 3,
  },
  cardStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardStatText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  cardStarIcon: {
    fontSize: 11,
    color: "#CBD5E1",
  },
  cardScoreText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#CBD5E1",
  },
  bellBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  bellBtnActive: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "rgba(56, 189, 248, 0.4)",
  },

  // ─── FLOATING NEXT DAY BUTTON ───
  floatingNextBtn: {
    position: "absolute",
    bottom: 84,
    right: 18,
    backgroundColor: "rgba(22, 27, 38, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 100,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        } as any)
      : {}),
  },
  floatingNextText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});
