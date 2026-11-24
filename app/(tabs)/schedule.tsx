import { memo, useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  DeviceEventEmitter,
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
import { currentWeekWindow, getAiringScheduleWindow } from "@/lib/anilist";
import { animeTitle } from "@/lib/types";
import type { AiringScheduleItem } from "@/lib/types";
import { NOTIFY_ME_CHANGED_EVENT } from "@/lib/airing-reminders";
import { ErrorState, EmptyState } from "@/components/async-state";
import { Skeleton } from "@/components/skeleton";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

const ID_DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;
const NOTIFY_ME_KEY = "aniraku.notify-me.v1";

function startOfLocalDay(value: Date) {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  return start;
}

function localDayKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`;
}

type DayInfo = {
  key: string;
  dayName: string;
  dateLabel: string;
};

function getUpcoming7Days(): DayInfo[] {
  const days: DayInfo[] = [];
  const start = startOfLocalDay(new Date());
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push({
      key: localDayKey(d),
      dayName: ID_DAYS[d.getDay()] || "Senin",
      dateLabel: `${d.getDate()} ${d.toLocaleDateString("id-ID", { month: "short" })}`,
    });
  }
  return days;
}

/** Hook global satu pintu untuk reminder anime (mengurangi 50x AsyncStorage I/O per render) */
function useScheduleReminders() {
  const [remindedSet, setRemindedSet] = useState<Set<number>>(() => new Set());

  const loadReminders = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(NOTIFY_ME_KEY);
      if (raw) {
        const map = JSON.parse(raw);
        if (map && typeof map === "object") {
          const ids = new Set(
            Object.keys(map)
              .map(Number)
              .filter((id) => Number.isInteger(id) && id > 0)
          );
          setRemindedSet(ids);
          return;
        }
      }
      setRemindedSet(new Set());
    } catch {
      setRemindedSet(new Set());
    }
  }, []);

  useEffect(() => {
    void loadReminders();
    const sub = DeviceEventEmitter.addListener(NOTIFY_ME_CHANGED_EVENT, loadReminders);
    return () => sub.remove();
  }, [loadReminders]);

  const toggleReminder = useCallback(async (animeId: number) => {
    hapticSuccess();
    setRemindedSet((prev) => {
      const next = new Set(prev);
      if (next.has(animeId)) next.delete(animeId);
      else next.add(animeId);
      return next;
    });

    try {
      const raw = await AsyncStorage.getItem(NOTIFY_ME_KEY);
      const map = raw ? JSON.parse(raw) : {};
      if (map[String(animeId)]) {
        delete map[String(animeId)];
      } else {
        map[String(animeId)] = true;
      }
      await AsyncStorage.setItem(NOTIFY_ME_KEY, JSON.stringify(map));
    } catch {}
    DeviceEventEmitter.emit(NOTIFY_ME_CHANGED_EVENT);
  }, []);

  return { remindedSet, toggleReminder };
}

/** Memoized timeline item row - Ultra ringan tanpa hooks berat di dalam baris */
const TimelineScheduleRow = memo(function TimelineScheduleRow({
  item,
  isLast,
  isReminded,
  onToggleReminder,
}: {
  item: AiringScheduleItem;
  isLast: boolean;
  isReminded: boolean;
  onToggleReminder: () => void;
}) {
  const date = new Date(item.airingAt * 1000);
  const anime = item.media;
  const title = animeTitle(anime);

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const timeStr = `${hours}:${minutes}`;

  const isAired = item.airingAt * 1000 <= Date.now();

  const scoreVal =
    typeof anime.averageScore === "number" && anime.averageScore > 0
      ? (anime.averageScore / 10).toFixed(1)
      : "—";
  const popVal =
    typeof anime.popularity === "number" && anime.popularity > 0
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

      {/* Right Column: Sleek Anime Card */}
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
          <Text style={[styles.cardStatus, isAired && styles.cardStatusAired]}>
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
          accessibilityState={{ checked: isReminded }}
          accessibilityLabel={isReminded ? `Pengingat aktif untuk ${title}` : `Ingatkan ${title}`}
          hitSlop={10}
          onPress={onToggleReminder}
          style={({ pressed }) => [
            styles.bellBtn,
            isReminded && styles.bellBtnActive,
            pressed && styles.btnPressed,
          ]}
        >
          <AppIcon
            name={isReminded ? "bell" : "bell-outline"}
            size={16}
            color={isReminded ? "#38BDF8" : "rgba(255, 255, 255, 0.45)"}
          />
        </Pressable>
      </Pressable>
    </View>
  );
});

/** Skeleton loading timeline modern & estetik untuk feedback instan */
const ScheduleSkeleton = memo(function ScheduleSkeleton() {
  return (
    <View style={styles.listContent}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={styles.timelineRow}>
          <View style={styles.timelineCol}>
            <Skeleton style={{ width: 38, height: 13, borderRadius: 4, marginBottom: 8 }} />
            <View style={styles.timelineDot} />
            {i < 4 ? <View style={styles.timelineLine} /> : null}
          </View>
          <View style={styles.glassCard}>
            <Skeleton style={styles.cardPoster} />
            <View style={styles.cardInfo}>
              <Skeleton style={{ width: "80%", height: 16, borderRadius: 4 }} />
              <Skeleton style={{ width: "42%", height: 12, borderRadius: 4, marginTop: 6 }} />
              <Skeleton style={{ width: "55%", height: 11, borderRadius: 4, marginTop: 5 }} />
              <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <Skeleton style={{ width: 44, height: 12, borderRadius: 4 }} />
                <Skeleton style={{ width: 34, height: 12, borderRadius: 4 }} />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
});

export default function ScheduleScreen() {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [todayKey, setTodayKey] = useState(() => localDayKey(new Date()));

  // 1. Hook reminders global (hanya 1 listener & 1 set untuk semua row)
  const { remindedSet, toggleReminder } = useScheduleReminders();

  // 2. Update hari jika berganti tanggal di latar belakang
  useEffect(() => {
    const timer = setInterval(() => {
      setTodayKey((prev) => {
        const next = localDayKey(new Date());
        return next === prev ? prev : next;
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // 3. 7 hari ke depan dihitung instan lokal (0ms rendering untuk tab hari)
  const upcomingDays = useMemo(() => getUpcoming7Days(), [todayKey]);
  const safeIndex = Math.min(selectedDayIndex, Math.max(0, upcomingDays.length - 1));
  const activeDay = upcomingDays[safeIndex] || upcomingDays[0];
  const nextDay = upcomingDays.length > 1 ? upcomingDays[(safeIndex + 1) % upcomingDays.length] : null;

  // 4. Query jadwal mingguan dari AniList (cocok dengan queryKey startup prefetch)
  const scheduleWindow = useMemo(() => currentWeekWindow(), [todayKey]);

  const schedule = useQuery({
    queryKey: ["schedule", scheduleWindow.startAt, scheduleWindow.endAt],
    queryFn: () => getAiringScheduleWindow(scheduleWindow),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  // 5. Grouping anime berdasarkan tanggal lokal dengan performa O(N) efisien
  const scheduleMap = useMemo(() => {
    const map = new Map<string, AiringScheduleItem[]>();
    if (!schedule.data?.airingSchedules) return map;

    for (const item of schedule.data.airingSchedules) {
      if (!item.media) continue;
      const d = new Date(item.airingAt * 1000);
      const key = localDayKey(d);
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [schedule.data]);

  const currentItems = scheduleMap.get(activeDay.key) || [];
  const isLoading = schedule.isLoading || (schedule.isFetching && !schedule.data);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* 1. Header Bar: Jadwal Tayang */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Jadwal Tayang</Text>
      </View>

      {/* 2. Horizontal Day Chips Selection (Selalu Tampil Instan 0ms) */}
      <View style={styles.dayTabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayTabsScroll}
        >
          {upcomingDays.map((group, idx) => {
            const isActive = safeIndex === idx;
            return (
              <Pressable
                key={group.key}
                accessibilityRole="button"
                accessibilityLabel={`Pilih hari ${group.dayName}`}
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

      {/* 3. Day Header Row: [Hari] di Kiri, [Jumlah / Loading] di Kanan */}
      <View style={styles.dayInfoRow}>
        <View style={styles.selectedDayPill}>
          <Text style={styles.selectedDayPillText}>{activeDay.dayName}</Text>
          <Text style={styles.selectedDayDateText}>{activeDay.dateLabel}</Text>
        </View>

        <View style={styles.rightInfoWrap}>
          {schedule.isFetching && !schedule.isLoading ? (
            <View style={styles.syncingPill}>
              <ActivityIndicator size="small" color="#38BDF8" style={styles.syncSpinner} />
              <Text style={styles.syncingText}>Memperbarui</Text>
            </View>
          ) : null}

          <View style={styles.countBadgePill}>
            <Text style={styles.countBadgePillText}>
              {isLoading ? "Memuat..." : `${currentItems.length} Anime`}
            </Text>
          </View>
        </View>
      </View>

      {/* 4. Main Timeline Content & States */}
      {isLoading ? (
        <ScheduleSkeleton />
      ) : schedule.isError && !schedule.data ? (
        <ErrorState
          message={schedule.error?.message ?? "Gagal memuat jadwal tayang anime."}
          onRetry={() => void schedule.refetch()}
        />
      ) : currentItems.length === 0 ? (
        <EmptyState
          label={`Belum ada anime yang dijadwalkan tayang pada hari ${activeDay.dayName}.`}
          action={{
            label: "Muat Ulang",
            onPress: () => void schedule.refetch(),
          }}
        />
      ) : (
        <FlatList
          data={currentItems}
          keyExtractor={(item, index) =>
            `${item.media?.id ?? "anime"}:${item.episode}:${item.airingAt}:${index}`
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== "web"}
          refreshControl={
            <RefreshControl
              refreshing={schedule.isFetching && !isLoading}
              onRefresh={() => void schedule.refetch()}
              tintColor="#38BDF8"
            />
          }
          renderItem={({ item, index }) => (
            <TimelineScheduleRow
              item={item}
              isLast={index === currentItems.length - 1}
              isReminded={remindedSet.has(item.media.id)}
              onToggleReminder={() => toggleReminder(item.media.id)}
            />
          )}
        />
      )}

      {/* 5. Floating Bottom-Right Next Day Pill (e.g. "Selasa →") */}
      {nextDay && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticLight();
            setSelectedDayIndex((prev) => (prev + 1) % upcomingDays.length);
          }}
          style={({ pressed }) => [styles.floatingNextBtn, pressed && styles.btnPressed]}
          accessibilityLabel={`Pindah ke hari ${nextDay.dayName}`}
        >
          <Text style={styles.floatingNextText}>{nextDay.dayName}</Text>
          <AppIcon name="arrow-right" size={15} color="#FFFFFF" />
        </Pressable>
      )}
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

  // ─── DAY INFO ROW: [Hari] & [Jumlah Anime] ───
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
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectedDayPillText: {
    fontFamily: "Nunito-Black",
    color: "#FFFFFF",
    fontSize: 13.5,
  },
  selectedDayDateText: {
    fontFamily: "Nunito-SemiBold",
    color: "#94A3B8",
    fontSize: 11.5,
  },
  rightInfoWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  syncingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  syncSpinner: {
    transform: [{ scale: 0.65 }],
  },
  syncingText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#38BDF8",
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

  // Right Column: Sleek Solid Dark Card (Bebas CPU blur lag)
  glassCard: {
    flex: 1,
    backgroundColor: "#131824",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  cardStatusAired: {
    color: "#38BDF8",
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
    backgroundColor: "#161B26",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 100,
  },
  floatingNextText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});
