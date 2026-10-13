import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import {
  getAnimePage,
  isAniListRateLimitError,
  sanitizeMediaFormat,
  sanitizeMediaSortList,
  sanitizeMediaStatus,
} from "@/lib/anilist";
import { searchCommitDelayMs } from "@/lib/search-input";
import { nsfwFilterParam, useNsfwPreference } from "@/lib/nsfw-preference";
import {
  EMPTY_FILTERS,
  coerceFilters,
  countActiveFilters,
  filterSignature,
  hasActiveFilters,
  type SearchFilters,
} from "@/lib/search-filters";
import { animeTitle, type Anime } from "@/lib/types";
import { POSTER_W, getOptimizedImageUri } from "@/lib/image-optimization";
import { ErrorState, LoadingState, EmptyState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import { DotLabel, nothing } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";
import { SearchFilterSheet } from "@/components/search-filter-sheet";
import { SearchResultRow } from "@/components/search-result-row";

type HistoryEntry = { term: string; timestamp: number };
const STORAGE_KEY = "aniraku.search.recent";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const GENRE_DATA = [
  "Action",
  "Romance",
  "Comedy",
  "Fantasy",
  "Sci-Fi",
  "Horror",
  "Slice of Life",
  "Sports",
  "Mystery",
  "Adventure",
  "Supernatural",
  "Music",
] as const;

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Baru saja";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}j lalu`;
  return `${Math.floor(diff / 86_400_000)}h lalu`;
}

function pruneOldEntries(entries: HistoryEntry[]): HistoryEntry[] {
  const cutoff = Date.now() - MAX_AGE_MS;
  return entries.filter((e) => e.timestamp > cutoff);
}

function upgradeLegacyEntries(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return { term: item, timestamp: Date.now() };
      if (item && typeof item === "object" && "term" in item && "timestamp" in item) {
        return item as HistoryEntry;
      }
      return null;
    })
    .filter((e): e is HistoryEntry => e !== null);
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{
    genre?: string;
    sort?: string | string[];
    status?: string;
    format?: string;
    title?: string;
  }>();
  const genreFilter =
    typeof params.genre === "string" && params.genre.trim()
      ? params.genre.trim().slice(0, 40)
      : null;
  const sortFilter = sanitizeMediaSortList(params.sort ?? null);
  const statusFilter = sanitizeMediaStatus(params.status);
  const formatFilter = sanitizeMediaFormat(params.format);
  const categoryTitle = params.title || null;
  const nsfw = useNsfwPreference();
  const isAdultParam = nsfwFilterParam(nsfw.enabled);
  const [input, setInput] = useState("");
  const normalizedInput = input.trim().replace(/\s+/g, " ");
  const [query, setQuery] = useState("");
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(() =>
    coerceFilters({
      sort: sortFilter?.[0],
      status: statusFilter,
      format: formatFilter,
    })
  );
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const entries = upgradeLegacyEntries(parsed);
          const pruned = pruneOldEntries(entries);
          setRecent(pruned);
          if (pruned.length !== entries.length) {
            void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pruned)).catch(() => {});
          }
        } catch {
          /* ignore malformed */
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const delay = searchCommitDelayMs(normalizedInput);
    const timer = setTimeout(() => setQuery(normalizedInput), delay);
    return () => clearTimeout(timer);
  }, [normalizedInput]);

  const waitingForInput = normalizedInput.length > 1 && query !== normalizedInput;
  const hasCategory = Boolean(genreFilter || sortFilter || statusFilter || formatFilter);
  const isCategoryMode = hasCategory;
  const categoryLabel = categoryTitle || genreFilter || "JELAJAHI";
  const hasQuery = query.length > 1;
  const hasLocalFilters = hasActiveFilters(filters);

  const results = useInfiniteQuery({
    queryKey: [
      "search",
      query,
      genreFilter,
      sortFilter?.join(","),
      statusFilter,
      formatFilter,
      isAdultParam,
      filterSignature(filters),
    ],
    queryFn: ({ pageParam }) =>
      getAnimePage({
        search: hasQuery ? query : undefined,
        page: pageParam,
        perPage: 20,
        genre: genreFilter || undefined,
        sort: [filters.sort ?? sortFilter?.[0] ?? (hasQuery ? "SEARCH_MATCH" : "POPULARITY_DESC")],
        status: filters.status ?? statusFilter ?? undefined,
        format: filters.format ?? formatFilter ?? undefined,
        season: filters.season ?? undefined,
        seasonYear: filters.year ? Number(filters.year) : undefined,
        isAdult: isAdultParam,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage?.pageInfo?.hasNextPage ? (lastPage.pageInfo.currentPage ?? 1) + 1 : undefined,
    enabled: isCategoryMode || hasQuery || hasLocalFilters,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    retry: (failureCount, error) => !isAniListRateLimitError(error) && failureCount < 1,
    retryDelay: 1_200,
  });

  const isIdle = !isCategoryMode && normalizedInput.length <= 1 && !hasLocalFilters;

  const trendingAnime = useQuery({
    queryKey: ["search-idle-trending", isAdultParam],
    queryFn: () =>
      getAnimePage({
        sort: ["TRENDING_DESC", "POPULARITY_DESC"],
        perPage: 8,
        isAdult: isAdultParam,
      }).then((res) => res.media),
    enabled: isIdle,
    staleTime: 10 * 60_000,
  });

  const media = useMemo(() => {
    const seen = new Set<number>();
    const merged: Anime[] = [];
    for (const page of results.data?.pages ?? []) {
      for (const item of page?.media ?? []) {
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push(item);
      }
    }
    return merged;
  }, [results.data]);

  const rateLimitError = isAniListRateLimitError(results.error) ? results.error : null;
  const retryAfterMs = rateLimitError?.retryAfterMs ?? null;

  useEffect(() => {
    if (retryAfterMs === null) {
      setRetryAt(null);
      return;
    }
    setRetryAt((current) =>
      current && current > Date.now() ? current : Date.now() + retryAfterMs
    );
  }, [retryAfterMs]);

  useEffect(() => {
    if (!retryAt || retryAt <= Date.now()) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [retryAt]);

  const retryIsBlocked = Boolean(retryAt && now < retryAt);
  const retrySeconds = retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0;
  const retrySearch = () => {
    if (retryIsBlocked) return;
    setRetryAt(null);
    void results.refetch();
  };

  useEffect(() => {
    if (!results.isSuccess || query.length < 2) return;
    setRecent((current) => {
      const nowTs = Date.now();
      const filtered = current.filter((item) => item.term.toLowerCase() !== query.toLowerCase());
      const next = [{ term: query, timestamp: nowTs }, ...filtered].slice(0, 8);
      const pruned = pruneOldEntries(next);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pruned)).catch(() => {});
      return pruned;
    });
  }, [query, results.isSuccess]);

  const removeRecent = useCallback((term: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRecent((current) => {
      const next = current.filter((e) => e.term.toLowerCase() !== term.toLowerCase());
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearAllRecent = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRecent([]);
    void AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const activeFilterCount = countActiveFilters(filters);

  const openAnime = useCallback((id: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/anime/${id}` as never);
  }, []);

  const renderResult = useCallback(
    ({ item }: { item: Anime }) => (
      <SearchResultRow anime={item} onPress={() => openAnime(item.id)} />
    ),
    [openAnime]
  );

  const refetchResults = results.refetch;
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refetchResults().finally(() => setRefreshing(false));
  }, [refetchResults]);

  const loadMore = useCallback(() => {
    if (!results.hasNextPage || results.isFetchingNextPage || retryIsBlocked) return;
    void results.fetchNextPage().catch(() => {});
  }, [results.hasNextPage, results.isFetchingNextPage, results.fetchNextPage, retryIsBlocked]);

  return (
    <NativeScreen scroll={false} style={styles.fill}>
      {/* ── Top Header Bar ── */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
        >
          <AppIcon name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>

        <View style={styles.searchInputWrap}>
          <AppIcon name="magnify" size={18} color="#38BDF8" />
          <TextInput
            accessibilityRole="search"
            accessibilityLabel="Cari anime"
            autoFocus={!isCategoryMode}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => setQuery(normalizedInput)}
            placeholder={
              hasCategory
                ? `Cari dalam ${categoryLabel}...`
                : "Cari judul anime, genre, karakter..."
            }
            placeholderTextColor="#64748B"
            style={styles.input}
            returnKeyType="search"
          />
          {input.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hapus ketikan"
              onPress={() => {
                setInput("");
                setQuery("");
              }}
              hitSlop={8}
              style={styles.clearInputIconBtn}
            >
              <AppIcon name="close-circle" size={16} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            activeFilterCount
              ? `Filter, ${activeFilterCount} aktif`
              : "Buka filter pencarian"
          }
          onPress={() => setFiltersVisible(true)}
          style={({ pressed }) => [
            styles.filterBtn,
            activeFilterCount > 0 && styles.filterBtnActive,
            pressed && styles.btnPressed,
          ]}
        >
          <AppIcon
            name="tune-variant"
            size={18}
            color={activeFilterCount ? "#EF4444" : "#94A3B8"}
          />
          {activeFilterCount ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* ── Content Body ── */}
      {isIdle ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.idleScrollContent}
        >
          {/* 1. Recent Searches Section */}
          {recent.length > 0 ? (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Pencarian Terakhir</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hapus semua riwayat"
                  onPress={clearAllRecent}
                  style={styles.clearAllBtn}
                >
                  <AppIcon name="trash-can-outline" size={13} color="#EF4444" />
                  <Text style={styles.clearAllText}>Hapus Semua</Text>
                </Pressable>
              </View>

              <View style={styles.recentGrid}>
                {recent.map((entry) => (
                  <View key={entry.term} style={styles.recentItemCard}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Cari ${entry.term}`}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setInput(entry.term);
                      }}
                      style={styles.recentItemClickable}
                    >
                      <AppIcon name="clock-outline" size={14} color="#64748B" />
                      <Text numberOfLines={1} style={styles.recentTermText}>
                        {entry.term}
                      </Text>
                      <Text style={styles.recentTimeText}>
                        {relativeTime(entry.timestamp)}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Hapus ${entry.term}`}
                      onPress={() => removeRecent(entry.term)}
                      hitSlop={8}
                      style={styles.recentRemoveBtn}
                    >
                      <AppIcon name="close" size={13} color="#64748B" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* 2. Browse by Genre Section */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Jelajahi Genre Populer</Text>
            </View>

            <View style={styles.genrePillsWrap}>
              {GENRE_DATA.map((genre) => (
                <Pressable
                  key={genre}
                  accessibilityRole="button"
                  accessibilityLabel={`Genre ${genre}`}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setInput(genre);
                  }}
                  style={({ pressed }) => [
                    styles.genrePill,
                    pressed && styles.genrePillPressed,
                  ]}
                >
                  <Text style={styles.genrePillText}>{genre}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 3. Trending Anime Discovery Section */}
          {trendingAnime.data?.length ? (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Trending Sekarang</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.trendingRailContent}
              >
                {trendingAnime.data.map((item) => {
                  const poster =
                    item.coverImage?.extraLarge || item.coverImage?.large || "";
                  const tStr = animeTitle(item);
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={tStr}
                      onPress={() => openAnime(item.id)}
                      style={({ pressed }) => [
                        styles.trendingCard,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <View style={styles.trendingPoster}>
                        {poster ? (
                          <Image
                            source={{
                              uri: getOptimizedImageUri(poster, POSTER_W),
                            }}
                            style={StyleSheet.absoluteFillObject}
                            contentFit="cover"
                            transition={150}
                            cachePolicy="memory-disk"
                          />
                        ) : null}
                        {item.averageScore ? (
                          <View style={styles.trendingScoreBadge}>
                            <AppIcon name="star" size={9} color="#F5C518" />
                            <Text style={styles.trendingScoreText}>
                              {(item.averageScore / 10).toFixed(1)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text numberOfLines={2} style={styles.trendingCardTitle}>
                        {tStr}
                      </Text>
                      <Text style={styles.trendingCardMeta}>
                        {[
                          item.format,
                          item.episodes ? `${item.episodes} Ep` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>
      ) : waitingForInput || results.isPending ? (
        <LoadingState
          label={
            isCategoryMode
              ? `Memuat anime ${categoryLabel}...`
              : hasQuery
              ? `Mencari "${normalizedInput}"...`
              : "Memuat hasil jelajah..."
          }
        />
      ) : results.isError && media.length === 0 ? (
        <ErrorState
          message={results.error?.message ?? "Pencarian tidak tersedia."}
          onRetry={retrySearch}
          retryDisabled={retryIsBlocked}
          retryLabel={
            retryIsBlocked ? `COBA LAGI DALAM ${retrySeconds}D` : "COBA LAGI"
          }
        />
      ) : media.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            label={
              isCategoryMode
                ? `Tidak ditemukan anime ${categoryLabel}.`
                : hasQuery
                ? `Tidak ada anime untuk "${query}".`
                : "Tidak ada judul yang sesuai filter ini."
            }
            action={
              activeFilterCount
                ? {
                    label: "RESET FILTER",
                    onPress: () => setFilters({ ...EMPTY_FILTERS }),
                  }
                : !retryIsBlocked
                ? { label: "Coba Lagi", onPress: retrySearch }
                : undefined
            }
          />
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Coba Genre Lain</Text>
            </View>
            <View style={styles.genrePillsWrap}>
              {GENRE_DATA.map((genre) => (
                <Pressable
                  key={genre}
                  accessibilityRole="button"
                  accessibilityLabel={`Genre ${genre}`}
                  onPress={() => setInput(genre)}
                  style={({ pressed }) => [
                    styles.genrePill,
                    pressed && styles.genrePillPressed,
                  ]}
                >
                  <Text style={styles.genrePillText}>{genre}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.resultsWrap}>
          <View style={styles.resultsHead}>
            <View style={styles.resultsHeadLeft}>
              <View style={styles.resultsCountBadge}>
                <Text style={styles.resultsCountText}>
                  {media.length} DITEMUKAN
                </Text>
              </View>
              {isCategoryMode ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Bersihkan kategori ${categoryLabel}`}
                  onPress={() => router.replace("/search" as never)}
                  style={styles.activeCategoryPill}
                >
                  <Text style={styles.activeCategoryText} numberOfLines={1}>
                    {categoryLabel.toUpperCase()}
                  </Text>
                  <AppIcon name="close" size={12} color="#EF4444" />
                </Pressable>
              ) : (
                <Text style={styles.resultsCategoryText}>
                  {`HASIL UNTUK "${query.toUpperCase()}"`}
                </Text>
              )}
            </View>
          </View>
          <FlatList
            data={media}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderResult}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#EF4444"
                colors={["#EF4444"]}
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.6}
            ListFooterComponent={
              results.hasNextPage ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Muat lebih banyak hasil"
                  onPress={loadMore}
                  style={({ pressed }) => [
                    styles.loadMore,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Text style={styles.loadMoreText}>
                    {results.isFetchingNextPage
                      ? "MEMUAT LEBIH BANYAK…"
                      : "MUAT LEBIH BANYAK"}
                  </Text>
                </Pressable>
              ) : null
            }
          />
        </View>
      )}

      <SearchFilterSheet
        visible={filtersVisible}
        filters={filters}
        onClose={() => setFiltersVisible(false)}
        onApply={setFilters}
      />
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: "#0B0E17",
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 12 : 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0B0E17",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
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
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.055)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  input: {
    flex: 1,
    minHeight: 44,
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Nunito-SemiBold",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  clearInputIconBtn: {
    padding: 3,
  },
  activeCategoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  activeCategoryText: {
    color: "#EF4444",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  filterBtnActive: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  filterBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },

  // ─── IDLE VIEW ───
  idleScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 24,
    paddingBottom: 48,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Nunito-Bold",
    letterSpacing: -0.2,
  },
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  clearAllText: {
    color: "#EF4444",
    fontSize: 12,
    fontFamily: "Nunito-Bold",
  },

  // Recent searches list (clean, no heavy card background)
  recentGrid: {
    gap: 0,
  },
  recentItemCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    gap: 10,
  },
  recentItemClickable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recentTermText: {
    flex: 1,
    color: "#F1F5F9",
    fontSize: 13.5,
    fontFamily: "Nunito-Bold",
  },
  recentTimeText: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Nunito-SemiBold",
  },
  recentRemoveBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },

  // Genre pills
  genrePillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  genrePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.045)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  genrePillPressed: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.35)",
    transform: [{ scale: 0.98 }],
  },
  genrePillText: {
    color: "#E2E8F0",
    fontSize: 12.5,
    fontFamily: "Nunito-Bold",
  },

  // Trending rail
  trendingRailContent: {
    gap: 12,
    paddingVertical: 2,
  },
  trendingCard: {
    width: 112,
    gap: 6,
  },
  trendingPoster: {
    width: 112,
    height: 156,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#161B26",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  trendingScoreBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(11, 14, 23, 0.85)",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  trendingScoreText: {
    color: "#F5C518",
    fontSize: 10,
    fontFamily: "Nunito-Bold",
  },
  trendingCardTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Nunito-Bold",
    lineHeight: 16,
  },
  trendingCardMeta: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Nunito-SemiBold",
  },

  // ─── RESULTS VIEW ───
  resultsWrap: {
    flex: 1,
  },
  resultsHead: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resultsHeadLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultsCountBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  resultsCountText: {
    color: "#EF4444",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  resultsCategoryText: {
    color: "#94A3B8",
    fontSize: 12,
    fontFamily: "Nunito-Bold",
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingBottom: 112,
    gap: 4,
  },

  emptyWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 28,
  },
  loadMore: {
    minHeight: 46,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },

  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
});
