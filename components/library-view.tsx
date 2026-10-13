import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useNotifications } from "@/hooks/use-notifications";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import { FirstRunImportPrompt } from "@/components/first-run-import-prompt";
import { hapticLight } from "@/lib/haptics";
import { RESUME_ROWS_STORAGE_KEY, buildResumeRows, type ResumeRow } from "@/lib/up-next";

export type LibraryTab = "history" | "bookmarks" | "alerts";
export type LibrarySort = "recent" | "title" | "score";
export type LibraryLayout = "list" | "grid";

const tabMeta: Record<LibraryTab, { label: string }> = {
  history: { label: "Riwayat" },
  bookmarks: { label: "Subscribe" },
  alerts: { label: "Notifikasi" },
};
const sectionTitle: Record<LibraryTab, string> = {
  history: "Lanjutkan anime yang kamu tonton",
  bookmarks: "Daftar anime langganan & favorit",
  alerts: "Pemberitahuan episode & aktivitas",
};
const emptyLabel: Record<LibraryTab, string> = {
  history: "Belum ada riwayat tontonan anime.",
  bookmarks: "Belum ada anime yang disubscribe / disimpan.",
  alerts: "Belum ada notifikasi akun saat ini.",
};
const sortLabels: Record<LibrarySort, string> = {
  recent: "TERBARU",
  title: "JUDUL",
  score: "RATING",
};

function sortOptionsFor(tab: LibraryTab): LibrarySort[] {
  if (tab === "history") return ["recent", "title"];
  if (tab === "bookmarks") return ["recent", "title", "score"];
  return ["recent"];
}

function searchText(tab: LibraryTab, row: any, query: string) {
  const haystack =
    tab === "history"
      ? `${row?.anime_title ?? ""} ${row?.episode_title ?? ""} ${row?.episode_number ?? ""}`
      : tab === "bookmarks"
      ? `${row?.title ?? ""} ${row?.anime_title ?? ""} ${row?.type ?? ""}`
      : `${row?.message ?? ""} ${row?.type ?? ""}`;
  return haystack.toLowerCase().includes(query);
}

/** Server order already is "recent"; only the other sorts reorder. */
function sortRecords(tab: LibraryTab, sort: LibrarySort, rows: any[]): any[] {
  if (tab === "alerts" || sort === "recent") return rows;
  const copy = rows.slice();
  if (sort === "title") {
    copy.sort((left, right) =>
      String(left?.anime_title ?? left?.title ?? "").localeCompare(
        String(right?.anime_title ?? right?.title ?? "")
      )
    );
  } else if (sort === "score") {
    copy.sort((left, right) => (Number(right?.score) || 0) - (Number(left?.score) || 0));
  }
  return copy;
}

function watchedPercent(row: any): number {
  const progress = Number(row?.progress);
  const duration = Number(row?.duration);
  if (!Number.isFinite(progress) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((progress / duration) * 100)));
}

type LibraryViewProps = {
  variant?: "tab" | "route";
  initialTab?: LibraryTab;
  allowedTabs?: LibraryTab[];
  showTopBar?: boolean;
  headerTitle?: string;
  headerSubtitle?: string;
};

export function LibraryView({
  variant = "tab",
  initialTab = "history",
  allowedTabs,
  showTopBar = false,
  headerTitle,
  headerSubtitle,
}: LibraryViewProps) {
  const history = useWatchHistory();
  const bookmarks = useBookmarks();
  const notifications = useNotifications();
  const [tab, setTab] = useState<LibraryTab>(initialTab);
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [layout, setLayout] = useState<LibraryLayout>("list");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [cachedResumeRows, setCachedResumeRows] = useState<ResumeRow[] | null>(null);

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(RESUME_ROWS_STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        try {
          const parsed = JSON.parse(raw) as { rows?: ResumeRow[] };
          if (active && Array.isArray(parsed.rows)) setCachedResumeRows(parsed.rows);
        } catch {
          // Corrupted cache reads as empty; live query repopulates it.
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const liveHistory = history.history.data;
  useEffect(() => {
    if (!liveHistory) return;
    try {
      const rows = buildResumeRows(
        liveHistory.map((item) => ({
          anime_id: item.anime_id,
          anime_title: item.anime_title,
          anime_image: item.anime_image,
          episode_number: item.episode_number,
          progress: item.progress,
          duration: item.duration,
          updated_at: item.updated_at ?? null,
        }))
      );
      void AsyncStorage.setItem(RESUME_ROWS_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), rows })).catch(() => {});
    } catch {
      // Precompute is best-effort; live rows still render.
    }
  }, [liveHistory]);

  const fallbackRows =
    history.history.isPending && !history.history.data && cachedResumeRows?.length
      ? cachedResumeRows.map((row) => ({
          id: `${row.animeId}:${row.episode}`,
          anime_id: row.animeId,
          anime_title: row.animeTitle,
          anime_image: row.animeImage,
          episode_number: row.episode,
          progress: row.progress,
          duration: row.duration,
        }))
      : null;
  const data =
    tab === "history"
      ? history.history
      : tab === "bookmarks"
      ? bookmarks.bookmarks
      : notifications.notifications;
  const allRecords: any[] = tab === "history" && fallbackRows?.length ? fallbackRows : data.data ?? [];
  const canRemoveHistory = tab === "history" && Boolean(history.history.data) && !fallbackRows?.length;
  const activeSort = sortOptionsFor(tab).includes(sort) ? sort : "recent";
  const query = search.trim().toLowerCase();
  const searched = query ? allRecords.filter((row) => searchText(tab, row, query)) : allRecords;
  const records =
    tab === "alerts"
      ? unreadOnly
        ? searched.filter((row) => !row.read)
        : searched
      : sortRecords(tab, activeSort, searched);
  const isGrid = tab === "bookmarks" && layout === "grid";
  const pending = data.isPending && !(tab === "history" && fallbackRows?.length);

  const confirmRemoveHistory = (row: any) => {
    const animeId = Number(row?.anime_id);
    const episode = Number(row?.episode_number);
    if (!Number.isInteger(animeId) || !Number.isInteger(episode)) return;
    const key = `${animeId}:${episode}`;
    const title = String(row?.anime_title || "Anime");
    Alert.alert("Hapus dari riwayat?", `Hapus ${title} · Episode ${episode} dari riwayat tontonan kamu?`, [
      { text: "BATAL", style: "cancel" },
      {
        text: "HAPUS",
        style: "destructive",
        onPress: () => {
          hapticLight();
          setRemovingKey(key);
          void history.remove
            .mutateAsync({ animeId, episode })
            .catch(() => Alert.alert("Gagal", "Tidak dapat menghapus baris riwayat. Coba lagi saat online."))
            .finally(() => setRemovingKey(null));
        },
      },
    ]);
  };

  const renderHistoryRow = (item: any) => {
    const percent = watchedPercent(item);
    const key = `${Number(item?.anime_id)}:${Number(item?.episode_number)}`;
    const removing = removingKey === key;
    return (
      <View style={styles.glassCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Lanjutkan ${item.anime_title || "Anime"} episode ${item.episode_number}`}
          onPress={() => {
            hapticLight();
            router.push({
              pathname: "/watch/[id]",
              params: {
                id: String(item.anime_id),
                episode: String(item.episode_number),
                title: item.anime_title ?? "Anime",
                image: item.anime_image ?? "",
              },
            } as never);
          }}
          onLongPress={() => canRemoveHistory && confirmRemoveHistory(item)}
          style={({ pressed }) => [styles.historyContentWrap, pressed && styles.btnPressed]}
        >
          <Image
            source={{ uri: item.episode_thumbnail || item.anime_image || "" }}
            style={styles.cardPoster}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
          <View style={styles.cardBody}>
            <View style={styles.badgeRow}>
              <View style={styles.epBadge}>
                <Text style={styles.epBadgeText}>EP {item.episode_number}</Text>
              </View>
              <Text style={styles.resumeStatusText}>{percent}% Ditonton</Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.anime_title || "Anime"}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
            <Text style={styles.cardSubText}>Lanjutkan Menonton</Text>
          </View>
        </Pressable>
        {canRemoveHistory ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hapus riwayat"
            disabled={removing}
            hitSlop={8}
            onPress={() => confirmRemoveHistory(item)}
            style={({ pressed }) => [styles.actionCircleBtn, pressed && styles.btnPressed]}
          >
            <AppIcon
              name="trash-can-outline"
              size={16}
              color={removing ? "#EF4444" : "#94A3B8"}
            />
          </Pressable>
        ) : null}
      </View>
    );
  };

  const openBookmark = (item: any) => {
    hapticLight();
    router.push((`/anime/${item.anime_id}`) as never);
  };

  const renderBookmarkRow = (item: any) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => openBookmark(item)}
      style={({ pressed }) => [styles.glassCard, pressed && styles.btnPressed]}
    >
      <Image
        source={{ uri: item.image || item.anime_image || "" }}
        style={styles.cardPoster}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
      />
      <View style={styles.cardBody}>
        <View style={styles.badgeRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.type || "ANIME"}</Text>
          </View>
          {Number(item?.score) > 0 ? (
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreStarIcon}>★</Text>
              <Text style={styles.scoreBadgeText}>{(Number(item.score) / 10).toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title || item.anime_title || "Anime"}
        </Text>
        <Text style={styles.cardSubText}>
          {[item.format || "TV Series", item.episodes ? `${item.episodes} Eps` : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <AppIcon name="chevron-right" size={18} color="#64748B" />
    </Pressable>
  );

  const renderBookmarkGrid = (item: any) => {
    const uri = item.image || item.anime_image || "";
    const score = Number(item?.score);
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => openBookmark(item)}
        style={({ pressed }) => [styles.gridCard, pressed && styles.btnPressed]}
      >
        <View style={styles.gridImageWrapper}>
          {uri ? (
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
            />
          ) : (
            <Text style={styles.gridFallbackLetter}>
              {String(item.title || item.anime_title || "A").charAt(0).toUpperCase()}
            </Text>
          )}
          {Number.isFinite(score) && score > 0 ? (
            <View style={styles.gridBadge}>
              <Text style={styles.gridBadgeText}>★ {(score / 10).toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.gridTitle} numberOfLines={2}>
          {item.title || item.anime_title || "Anime"}
        </Text>
        <Text style={styles.gridMeta} numberOfLines={1}>
          {item.type || item.format || "ANIME"}
        </Text>
      </Pressable>
    );
  };

  const renderAlertRow = (item: any) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        hapticLight();
        void notifications.markRead.mutateAsync(item.id);
        if (item.anime_id) router.push((`/anime/${item.anime_id}`) as never);
      }}
      style={({ pressed }) => [styles.glassCard, styles.alertCard, pressed && styles.btnPressed]}
    >
      <View style={styles.alertIndicatorCol}>
        <View style={[styles.alertDot, !item.read && styles.alertDotUnread]} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.alertText}>{item.message}</Text>
        <Text style={styles.alertTimeText}>
          {item.read ? "Sudah dibaca" : "Pemberitahuan baru"}
        </Text>
      </View>
    </Pressable>
  );

  const renderItem = ({ item }: { item: any }) => {
    if (tab === "history") return renderHistoryRow(item);
    if (tab === "bookmarks") return isGrid ? renderBookmarkGrid(item) : renderBookmarkRow(item);
    return renderAlertRow(item);
  };

  const emptyMessage = query
    ? `Tidak ada anime yang cocok dengan "${search.trim()}".`
    : emptyLabel[tab];

  const content = pending ? (
    <LoadingState label="Menyelaraskan data..." />
  ) : data.isError ? (
    <ErrorState
      message="Gagal memuat data saat ini."
      onRetry={() => void data.refetch()}
    />
  ) : records.length === 0 ? (
    <EmptyState
      label={emptyMessage}
      action={query ? { label: "HAPUS PENCARIAN", onPress: () => setSearch("") } : undefined}
    />
  ) : (
    <FlatList
      key={`${tab}-${layout}`}
      data={records}
      numColumns={isGrid ? 2 : 1}
      columnWrapperStyle={isGrid ? styles.gridRow : undefined}
      keyExtractor={(item: any) => String(item?.id ?? `${item?.anime_id}:${item?.episode_number}`)}
      contentContainerStyle={[
        styles.listContent,
        isGrid && styles.gridListContent,
        { paddingBottom: variant === "route" ? 40 : 110 },
      ]}
      showsVerticalScrollIndicator={false}
      renderItem={renderItem}
    />
  );

  const visibleTabs = allowedTabs ?? (["history", "bookmarks", "alerts"] as LibraryTab[]);

  return (
    <View style={styles.container}>
      {/* 0. Top App Bar: Title Text (Replacing Logo for Sub & Riwayat) + DylanCrystal & Search */}
      {showTopBar ? (
        <View style={styles.topHeaderBar}>
          <View style={styles.topHeaderTitleWrap}>
            <Text style={styles.topHeaderTitleText}>
              {headerTitle || (tab === "history" ? "Riwayat" : tab === "bookmarks" ? "Subscribe" : "Notifikasi")}
            </Text>
          </View>
          <View style={styles.topHeaderActions}>
            <Pressable
              onPress={() => {
                hapticLight();
                router.push("/search" as never);
              }}
              style={({ pressed }) => [styles.headerIconBtn, pressed && styles.btnPressed]}
            >
              <AppIcon name="magnify" size={22} color="#FFFFFF" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Top Up Crystal"
              onPress={() => {
                hapticLight();
                router.push("/topup" as never);
              }}
              style={({ pressed }) => [styles.headerCrystalBtn, pressed && styles.btnPressed]}
              hitSlop={14}
            >
              <Image
                source={require("@/assets/images/topup/topup-crystal.png")}
                style={styles.headerCrystalImg}
                contentFit="contain"
              />
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* 1. Liquid Glass Segmented Tab Selector (only when >1 tabs available) */}
      {visibleTabs.length > 1 ? (
        <View style={styles.tabSelectorRow}>
          {visibleTabs.map((item) => {
            const isActive = tab === item;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                key={item}
                onPress={() => {
                  hapticLight();
                  setTab(item);
                }}
                style={({ pressed }) => [
                  styles.tabPill,
                  isActive && styles.tabPillActive,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>
                  {tabMeta[item].label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <FirstRunImportPrompt />

      {/* 2. Section Header: Subtitle & Total Count Badge */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{sectionTitle[tab]}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>
            {records.length} {tab === "alerts" ? "Notifikasi" : "Anime"}
          </Text>
        </View>
      </View>

      {/* 3. Search Bar & Controls */}
      <View style={styles.controlsRow}>
        {tab === "alerts" ? (
          <View style={styles.flex} />
        ) : (
          <View style={styles.searchGlassBar}>
            <AppIcon name="magnify" size={16} color="#64748B" />
            <TextInput
              accessibilityRole="search"
              accessibilityLabel="Cari anime"
              value={search}
              onChangeText={setSearch}
              placeholder={tab === "history" ? "Cari riwayat anime..." : "Cari anime tersimpan..."}
              placeholderTextColor="#64748B"
              style={styles.searchInput}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hapus pencarian"
                hitSlop={8}
                onPress={() => setSearch("")}
              >
                <AppIcon name="close" size={14} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka download offline"
          onPress={() => router.push("/downloads" as never)}
          style={({ pressed }) => [styles.offlineBtn, pressed && styles.btnPressed]}
        >
          <AppIcon name="download" size={15} color="#FFFFFF" />
          <Text style={styles.offlineBtnText}>OFFLINE</Text>
        </Pressable>
      </View>

      {/* 4. Filter Chips & Grid/List Toggle */}
      {tab !== "alerts" ? (
        <View style={styles.filterBar}>
          <View style={styles.chipRow}>
            {sortOptionsFor(tab).map((option) => {
              const isActive = activeSort === option;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  key={option}
                  onPress={() => {
                    hapticLight();
                    setSort(option);
                  }}
                  style={({ pressed }) => [
                    styles.chip,
                    isActive && styles.chipActive,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {sortLabels[option]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.flex} />

          {tab === "bookmarks" ? (
            <View style={styles.chipRow}>
              {(["list", "grid"] as LibraryLayout[]).map((option) => {
                const isActive = layout === option;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={option === "grid" ? "Tampilan Grid" : "Tampilan List"}
                    accessibilityState={{ selected: isActive }}
                    key={option}
                    onPress={() => {
                      hapticLight();
                      setLayout(option);
                    }}
                    style={({ pressed }) => [
                      styles.chip,
                      styles.iconChip,
                      isActive && styles.chipActive,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <AppIcon
                      name={option === "grid" ? "view-grid-outline" : "layers"}
                      size={15}
                      color={isActive ? "#38BDF8" : "#94A3B8"}
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 5. Alerts Specific Action Row */}
      {tab === "alerts" ? (
        <View style={styles.alertActionsRow}>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: unreadOnly }}
            onPress={() => {
              hapticLight();
              setUnreadOnly((val) => !val);
            }}
            style={({ pressed }) => [
              styles.alertActionPill,
              unreadOnly && styles.alertActionPillActive,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={[styles.alertActionPillText, unreadOnly && styles.alertActionPillTextActive]}>
              BELUM DIBACA
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={notifications.markAllRead.isPending || !allRecords.some((item) => !item.read)}
            onPress={() => {
              hapticLight();
              void notifications.markAllRead.mutateAsync();
            }}
            style={({ pressed }) => [
              styles.alertActionPill,
              (!allRecords.some((item) => !item.read) || notifications.markAllRead.isPending) &&
                styles.alertActionPillDisabled,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.alertActionPillText}>
              {notifications.markAllRead.isPending ? "MEMPROSES..." : "TANDAI SEMUA DIBACA"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* 6. Main List / Grid Content */}
      <View style={styles.contentWrap}>{content}</View>
    </View>
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
  flex: {
    flex: 1,
  },

  // ─── 0. TOP APP BAR (NUENIME BRAND & ACTIONS) ───
  topHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  topHeaderTitleWrap: {
    justifyContent: "center",
    alignItems: "flex-start",
  },
  topHeaderTitleText: {
    fontFamily: "Nunito-Black",
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  topHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerIconBtn: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCrystalBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  headerCrystalImg: {
    width: 28,
    height: 28,
  },

  // ─── 1. TABS SELECTOR ───
  tabSelectorRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 8,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  tabPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#94A3B8",
  },
  tabPillTextActive: {
    color: "#38BDF8",
    fontFamily: "Nunito-Black",
  },

  // ─── 2. SECTION HEADER ───
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: -0.2,
    flex: 1,
  },
  countBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },

  // ─── 3. CONTROLS ROW: SEARCH & OFFLINE ───
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchGlassBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        } as any)
      : {}),
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-SemiBold",
    color: "#FFFFFF",
    fontSize: 13,
  },
  offlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  offlineBtnText: {
    fontFamily: "Nunito-Black",
    color: "#FFFFFF",
    fontSize: 11,
    letterSpacing: 0.5,
  },

  // ─── 4. FILTER BAR: SORT & LAYOUT ───
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  iconChip: {
    paddingHorizontal: 8,
    minWidth: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  chipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#94A3B8",
    letterSpacing: 0.4,
  },
  chipTextActive: {
    color: "#38BDF8",
    fontFamily: "Nunito-Black",
  },

  // ─── 5. ALERT ACTIONS ───
  alertActionsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  alertActionPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  alertActionPillActive: {
    borderColor: "#E2E8F0",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  alertActionPillDisabled: {
    opacity: 0.35,
  },
  alertActionPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  alertActionPillTextActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },

  // ─── 6. CONTENT & CARDS (LIQUID GLASS) ───
  contentWrap: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  gridListContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
  },
  gridRow: {
    gap: 12,
  },

  // Liquid Glass Row Card
  glassCard: {
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        } as any)
      : {}),
  },
  cardPoster: {
    width: 68,
    height: 96,
    borderRadius: 6,
    backgroundColor: "#161B26",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cardBody: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  epBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  epBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
    color: "#38BDF8",
  },
  resumeStatusText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  typeBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    color: "#FFFFFF",
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  scoreStarIcon: {
    color: "#F5C518",
    fontSize: 11,
  },
  scoreBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#F5C518",
  },
  cardTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  cardSubText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#94A3B8",
  },
  progressTrack: {
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
    marginVertical: 2,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#38BDF8",
    borderRadius: 2,
  },
  historyContentWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  actionCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  // Grid Card
  gridCard: {
    flex: 1,
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    padding: 8,
    gap: 6,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        } as any)
      : {}),
  },
  gridImageWrapper: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#161B26",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  gridFallbackLetter: {
    fontFamily: "Nunito-Black",
    fontSize: 32,
    color: "#64748B",
  },
  gridBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gridBadgeText: {
    fontFamily: "Nunito-Black",
    color: "#F5C518",
    fontSize: 10,
  },
  gridTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#FFFFFF",
    lineHeight: 16,
  },
  gridMeta: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#94A3B8",
  },

  // Alert Card
  alertCard: {
    paddingVertical: 12,
    alignItems: "flex-start",
  },
  alertIndicatorCol: {
    paddingTop: 4,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  alertDotUnread: {
    backgroundColor: "#38BDF8",
  },
  alertText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    lineHeight: 18,
  },
  alertTimeText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10.5,
    color: "#94A3B8",
  },
});
