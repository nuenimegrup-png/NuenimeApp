import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAnimePage, getHomeAnime, getHomeRailAnime } from "@/lib/anilist";
import { BANNER_W, POSTER_W, getOptimizedImageUri } from "@/lib/image-optimization";
import { nsfwFilterParam, useNsfwPreference } from "@/lib/nsfw-preference";
import { animeTitle } from "@/lib/types";
import { hapticLight } from "@/lib/haptics";
import { usePrefetchAnime } from "@/lib/prefetch";
import { AnimeRail } from "@/components/anime-rail";
import { ErrorState } from "@/components/async-state";
import { SkeletonCard, SkeletonRail, SkeletonHero } from "@/components/skeleton";
import { NotificationSheet } from "@/components/notification-sheet";
import { AppIcon } from "@/components/app-icon";
import { InAppEpisodeAlertMonitor } from "@/hooks/use-in-app-episode-alerts";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useNotifications } from "@/hooks/use-notifications";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { useExp } from "@/providers/exp-toast-provider";
import { EXP_RULES } from "@/lib/user-level";
import { HomeTopLeaderboard } from "@/components/home-top-leaderboard";
import { HomePublicDiscussionBar } from "@/components/home-public-discussion-bar";

const DUNIA_EMBLEM_IMG = require("@/assets/images/dunia-nuenime-emblem.png");

export const SERIES_GENRES = [
  { id: "Action", label: "Action" },
  { id: "Game", label: "Game" },
  { id: "Fantasy", label: "Fantasy" },
  { id: "Sci-Fi", label: "Sci-Fi" },
  { id: "Adventure", label: "Adventure" },
  { id: "Comedy", label: "Comedy" },
  { id: "Romance", label: "Romance" },
  { id: "Mystery", label: "Mystery" },
  { id: "Supernatural", label: "Supernatural" },
  { id: "Sports", label: "Sports" },
  { id: "Slice of Life", label: "Slice of Life" },
  { id: "Drama", label: "Drama" },
  { id: "Mecha", label: "Mecha" },
  { id: "Music", label: "Music" },
  { id: "Psychological", label: "Psychological" },
  { id: "Horror", label: "Horror" },
] as const;

let memoryCachedHome: { trending: any[]; popular: any[]; upcoming: any[] } | null = null;

export default function HomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  // 16 horizontal padding on each side = 32 total. 3 gaps of 8px between 4 items = 24.
  const genreColWidth = Math.floor((Math.min(windowWidth, 600) - 32 - 24) / 4);
  const prefetch = usePrefetchAnime();
  const nsfw = useNsfwPreference();
  const auth = useAnirakuAuth();
  const bookmarks = useBookmarks();
  const { grantXp } = useExp();
  const dailyLoginChecked = useRef(false);

  useEffect(() => {
    if (!auth.user || dailyLoginChecked.current) return;
    dailyLoginChecked.current = true;
    const today = new Date().toISOString().split("T")[0];
    void grantXp({
      activityType: EXP_RULES.DAILY_LOGIN.type,
      targetId: today,
      baseXp: EXP_RULES.DAILY_LOGIN.xp,
      description: EXP_RULES.DAILY_LOGIN.label,
      metadata: { date: today },
    });
  }, [auth.user, grantXp]);

  const isAdultParam = nsfwFilterParam(nsfw.enabled);
  const { notifications } = useNotifications();
  const unreadNotifCount = notifications.data?.filter((n) => !n.read).length || 0;
  const [notifSheetVisible, setNotifSheetVisible] = useState(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [selectedGenre, setSelectedGenre] = useState<string>("Action");

  const [cachedHome, setCachedHome] = useState<{ trending: any[]; popular: any[]; upcoming: any[] } | null>(memoryCachedHome);

  // Load cached home data instantly on startup for zero-delay first paint
  useEffect(() => {
    void AsyncStorage.getItem(`nuenime.cache.home.${isAdultParam}`).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.trending) && parsed.trending.length > 0) {
            memoryCachedHome = parsed;
            setCachedHome(parsed);
          }
        } catch {}
      }
    });
  }, [isAdultParam]);

  const home = useQuery({
    queryKey: ["home-anime", isAdultParam],
    queryFn: () => getHomeAnime(isAdultParam),
    placeholderData: cachedHome ?? undefined,
    staleTime: 10 * 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  });

  // Save fresh home data to cache
  useEffect(() => {
    if (home.data && home.data.trending && home.data.trending.length > 0) {
      memoryCachedHome = home.data;
      void AsyncStorage.setItem(`nuenime.cache.home.${isAdultParam}`, JSON.stringify(home.data)).catch(() => {});
    }
  }, [home.data, isAdultParam]);

  // Secondary rails only fetch AFTER the hero & trending cards have arrived,
  // preventing network bottleneck and AniList rate limit choke during initial load
  const rails = useQuery({
    queryKey: ["home-rails", isAdultParam],
    queryFn: () => getHomeRailAnime(isAdultParam),
    enabled: Boolean(home.data),
    staleTime: 10 * 60_000,
    retry: 2,
    retryDelay: 1_500,
  });

  const genreAnime = useQuery({
    queryKey: ["home-genre-rail", selectedGenre, isAdultParam],
    queryFn: () =>
      getAnimePage({
        genre: selectedGenre,
        format: "TV",
        sort: ["POPULARITY_DESC"],
        perPage: 12,
        isAdult: isAdultParam,
      }).then((res) => res.media),
    enabled: Boolean(home.data),
    staleTime: 10 * 60_000,
  });

  const latestAnime = useQuery({
    queryKey: ["home-latest-anime", isAdultParam],
    queryFn: () =>
      getAnimePage({
        status: "RELEASING",
        sort: ["TRENDING_DESC", "POPULARITY_DESC"],
        perPage: 12,
        isAdult: isAdultParam,
      }).then((res) => res.media),
    enabled: Boolean(home.data),
    staleTime: 10 * 60_000,
  });

  const [refreshing, setRefreshing] = useState(false);

  const trendingList = home.data?.trending || [];
  const heroCount = Math.min(trendingList.length, 5);
  const touchStartX = useRef<number>(0);

  // Auto-slide featured banner setiap 5 detik
  useEffect(() => {
    if (heroCount <= 1) return;
    const timer = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % heroCount);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroCount, activeBannerIndex]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([home.refetch(), rails.refetch(), latestAnime.refetch()]);
    setRefreshing(false);
  };

  if (home.isPending) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
        <InAppEpisodeAlertMonitor />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <SkeletonHero />
          <Text style={styles.skeletonRailLabel}>MEMUAT ANIME POPULER...</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skeletonRailRow}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRail key={i} />
            ))}
          </ScrollView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (home.isError || !home.data) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
        <InAppEpisodeAlertMonitor />
        <ErrorState
          message={home.error?.message ?? "Gagal memuat anime saat ini."}
          onRetry={() => void home.refetch()}
        />
      </SafeAreaView>
    );
  }

  const heroList = trendingList.slice(0, 5);
  const currentHero = heroList[activeBannerIndex % (heroList.length || 1)] || trendingList[0];
  const top10Popular = trendingList.slice(0, 10);

  const displayName =
    auth.user?.user_metadata?.full_name ||
    auth.user?.user_metadata?.name ||
    auth.user?.email?.split("@")[0] ||
    "Official Valoranime #25";

  const avatarUri =
    auth.user?.user_metadata?.avatar_url ||
    "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=120&q=80";

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      <InAppEpisodeAlertMonitor />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════════════════════════
            1. TOP APP BAR (NUENIME BRAND & ACTIONS)
            ══════════════════════════════════════════════════════════════ */}
        <View style={styles.topHeaderBar}>
          {/* Official Nuenime Logo Emblem */}
          <View style={styles.brandLogoContainer}>
            <Image
              source={require("@/assets/images/nuenime-logo.png")}
              style={styles.brandLogoImg}
              contentFit="contain"
            />
          </View>

          {/* Right Action Icons: Chat Global, Search, Notifications/Hadiah & DylanCrystal */}
          <View style={styles.topHeaderActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chat Global"
              onPress={() => {
                hapticLight();
                router.push("/chat-global" as never);
              }}
              style={({ pressed }) => [styles.headerIconBtn, pressed && styles.btnPressed]}
              hitSlop={10}
            >
              <AppIcon name="chat" size={21} color="#FFFFFF" />
            </Pressable>

            <Pressable
              onPress={() => {
                hapticLight();
                router.push("/search" as never);
              }}
              style={({ pressed }) => [styles.headerIconBtn, pressed && styles.btnPressed]}
              accessibilityLabel="Pencarian"
              hitSlop={10}
            >
              <AppIcon name="magnify" size={22} color="#FFFFFF" />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifikasi dan Hadiah"
              onPress={() => {
                hapticLight();
                setNotifSheetVisible(true);
              }}
              style={({ pressed }) => [styles.headerIconBtn, pressed && styles.btnPressed]}
              hitSlop={10}
            >
              <View style={{ position: "relative" }}>
                <AppIcon name="bell" size={22} color="#FFFFFF" />
                {unreadNotifCount > 0 ? <View style={styles.notifBadgeDot} /> : null}
              </View>
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

        {/* ══════════════════════════════════════════════════════════════
            2. FEATURED CAROUSEL BANNER (LIQUID GLASS)
            ══════════════════════════════════════════════════════════════ */}
        {currentHero ? (
          <View
            style={styles.heroSection}
            onTouchStart={(e) => {
              touchStartX.current = e.nativeEvent.pageX;
            }}
            onTouchEnd={(e) => {
              if (heroCount <= 1) return;
              const dx = e.nativeEvent.pageX - touchStartX.current;
              if (dx > 45) {
                hapticLight();
                setActiveBannerIndex((prev) => (prev - 1 + heroCount) % heroCount);
              } else if (dx < -45) {
                hapticLight();
                setActiveBannerIndex((prev) => (prev + 1) % heroCount);
              }
            }}
          >
            <Pressable
              onPress={() => {
                hapticLight();
                prefetch(currentHero.id);
                router.push((`/anime/${currentHero.id}`) as never);
              }}
              style={({ pressed }) => [styles.heroCard, pressed && styles.btnPressed]}
            >
              <Image
                source={{
                  uri: currentHero.bannerImage
                    ? getOptimizedImageUri(currentHero.bannerImage, BANNER_W)
                    : currentHero.coverImage?.extraLarge
                      ? getOptimizedImageUri(currentHero.coverImage.extraLarge, BANNER_W)
                      : currentHero.coverImage?.large || "",
                }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={400}
                cachePolicy="memory-disk"
              />
              {/* Gradient Dark Overlay */}
              <View style={styles.heroDarkMask} />

              {/* Top Badges */}
              <View style={styles.heroTopBadges}>
                <View style={styles.populerBadge}>
                  <Text style={styles.populerBadgeText}>POPULER</Text>
                </View>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreStarText}>★</Text>
                  <Text style={styles.scoreValueText}>
                    {currentHero.averageScore
                      ? (currentHero.averageScore / 10).toFixed(1)
                      : "8.2"}
                  </Text>
                </View>
              </View>

              {/* Bottom Details */}
              <View style={styles.heroBottomContent}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {animeTitle(currentHero)}
                </Text>

                <View style={styles.heroMetaRow}>
                  <View style={styles.heroEpsBadge}>
                    <Text style={styles.heroEpsBadgeText}>
                      {currentHero.episodes ? `${currentHero.episodes} Eps` : "Ongoing"}
                    </Text>
                  </View>
                  <Text style={styles.heroSubText}>Sub Indo</Text>
                  <View style={styles.heroHdBadge}>
                    <Text style={styles.heroHdBadgeText}>HD</Text>
                  </View>
                </View>

                {/* Interactive Action Buttons */}
                <View style={styles.heroActionsRow}>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      prefetch(currentHero.id);
                      router.push((`/anime/${currentHero.id}`) as never);
                    }}
                    style={({ pressed }) => [
                      styles.heroTontonBtn,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <AppIcon name="play" size={13} color="#FFFFFF" />
                    <Text style={styles.heroTontonText}>Tonton Sekarang</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      hapticLight();
                      prefetch(currentHero.id);
                      router.push((`/anime/${currentHero.id}`) as never);
                    }}
                    style={({ pressed }) => [
                      styles.heroDetailBtn,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <AppIcon name="information" size={15} color="#E2E8F0" />
                    <Text style={styles.heroDetailText}>Detail</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>

            {/* Carousel Dot Indicators */}
            <View style={styles.heroDotsRow}>
              {heroList.map((_, idx) => {
                const isActive = idx === (activeBannerIndex % (heroList.length || 1));
                return (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      hapticLight();
                      setActiveBannerIndex(idx);
                    }}
                    hitSlop={10}
                    style={[
                      styles.heroDot,
                      isActive ? styles.heroDotActive : styles.heroDotInactive,
                    ]}
                  />
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ══════════════════════════════════════════════════════════════
            4.5 PUBLIC DISKUSI (AKSES LANGSUNG KE CHAT GLOBAL)
            ══════════════════════════════════════════════════════════════ */}
        <HomePublicDiscussionBar />

        {/* ══════════════════════════════════════════════════════════════
            5. TOP LEADERBOARD CARD (REALTIME)
            ══════════════════════════════════════════════════════════════ */}
        <HomeTopLeaderboard />

        {/* ══════════════════════════════════════════════════════════════
            5.1 DUNIA NUENIME ACCESS BANNER (CLOUD HYBRID RPG REALM)
            ══════════════════════════════════════════════════════════════ */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Masuk ke Dunia Nuenime"
          onPress={() => {
            hapticLight();
            router.push("/dunia" as never);
          }}
          // @ts-ignore
          onClick={() => {
            hapticLight();
            router.push("/dunia" as never);
          }}
          style={({ pressed }) => [styles.duniaBannerCard, pressed && styles.btnPressed]}
        >
          <View style={styles.duniaBannerLeft}>
            <View style={styles.duniaIconBadge}>
              <Image
                source={DUNIA_EMBLEM_IMG}
                style={{ width: 34, height: 34 }}
                contentFit="contain"
              />
            </View>
            <View style={styles.duniaTextWrap}>
              <View style={styles.duniaTitleRow}>
                <Text style={styles.duniaTitle}>Dunia Nuenime</Text>
                <View style={styles.duniaRpgPill}>
                  <Text style={styles.duniaRpgText}>RPG CLOUD</Text>
                </View>
              </View>
              <Text style={styles.duniaSubtitle} numberOfLines={1}>
                Jelajahi peta dunia, klan & kota fantasi
              </Text>
            </View>
          </View>
          <View style={styles.duniaEnterBtn}>
            <Text style={styles.duniaEnterText}>Masuk</Text>
            <AppIcon name="chevron-right" size={13} color="#38BDF8" />
          </View>
        </Pressable>

        {/* ══════════════════════════════════════════════════════════════
            5.5. ANIME TERBARU (REKOMENDASI ANIME TERBARU)
            ══════════════════════════════════════════════════════════════ */}
        {(latestAnime.data?.length || rails.data?.ongoing?.length) ? (
          <AnimeRail
            title="Anime Terbaru"
            items={latestAnime.data?.length ? latestAnime.data : (rails.data?.ongoing ?? [])}
            seeAllParams={{ status: "RELEASING", sort: "TRENDING_DESC", title: "Anime Terbaru" }}
          />
        ) : null}

        {/* ══════════════════════════════════════════════════════════════
            6. TOP 10 ANIME TERPOPULER
            ══════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.verticalBar} />
              <Text style={styles.sectionTitleText}>Top 10 Anime Terpopuler</Text>
            </View>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/search",
                  params: { sort: "POPULARITY_DESC", title: "Top 10 Anime" },
                } as never)
              }
            >
              <Text style={styles.rankingLinkText}>Ranking Lengkap &gt;</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalRailContent}
          >
            {top10Popular.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  hapticLight();
                  prefetch(item.id);
                  router.push((`/anime/${item.id}`) as never);
                }}
                style={({ pressed }) => [styles.animeCardWrap, pressed && styles.btnPressed]}
              >
                <View style={styles.animePosterWrap}>
                  <Image
                    source={{
                      uri: getOptimizedImageUri(
                        item.coverImage?.extraLarge || item.coverImage?.large || "",
                        POSTER_W
                      ),
                    }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                  {/* Rating Tag */}
                  <View style={styles.cardScoreBadge}>
                    <Text style={styles.cardScoreStar}>★</Text>
                    <Text style={styles.cardScoreValue}>
                      {item.averageScore
                        ? (item.averageScore / 10).toFixed(2)
                        : "8.50"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.animeCardTitle} numberOfLines={1}>
                  {animeTitle(item)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ══════════════════════════════════════════════════════════════
            7. OTHER ANIME RAILS (TRENDING, ONGOING, POPULAR, MOVIES)
            ══════════════════════════════════════════════════════════════ */}
        {home.data.trending?.length ? (
          <AnimeRail
            title="Trending now"
            items={home.data.trending}
            seeAllParams={{ sort: "TRENDING_DESC", title: "Trending now" }}
          />
        ) : null}

        {rails.data?.ongoing?.length ? (
          <AnimeRail
            title="Airing this season"
            items={rails.data.ongoing}
            seeAllParams={{ status: "RELEASING", sort: "POPULARITY_DESC", title: "Airing this season" }}
          />
        ) : null}

        {home.data.popular?.length ? (
          <AnimeRail
            title="All-time popular"
            items={home.data.popular}
            seeAllParams={{ sort: "POPULARITY_DESC", title: "All-time popular" }}
          />
        ) : null}

        {rails.data?.topMovies?.length ? (
          <AnimeRail
            title="Top movies"
            items={rails.data.topMovies}
            seeAllParams={{ format: "MOVIE", sort: "SCORE_DESC", title: "Top Movies" }}
          />
        ) : null}

        {/* ══════════════════════════════════════════════════════════════
            8. GENRE SERIES EXPLORER (DI BAGIAN BAWAH HOME)
            ══════════════════════════════════════════════════════════════ */}
        <View style={styles.genreSectionWrap}>
          {/* Section Header */}
          <View style={styles.genreSectionHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.genreSectionBadgeRow}>
                <View style={styles.genreBadgePill}>
                  <Text style={styles.genreBadgeText}>SERIES</Text>
                </View>
                <Text style={styles.genreSectionTitle}>Genre Series</Text>
              </View>
              <Text style={styles.genreSectionSubtitle}>
                Temukan anime series favoritmu berdasarkan kategori genre
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Lihat semua series genre ${selectedGenre}`}
              onPress={() => {
                hapticLight();
                router.push(
                  `/search?genre=${selectedGenre}&format=TV&title=${encodeURIComponent(
                    selectedGenre + " Series"
                  )}` as never
                );
              }}
              style={({ pressed }) => [styles.seeAllGenreBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.seeAllGenreText}>Lihat Semua</Text>
              <AppIcon name="chevron-right" size={14} color="#C0C0C0" />
            </Pressable>
          </View>

          {/* 4-Column Text-Only Genre Grid (1 Baris 4 Kolom, Lalu ke Bawah) */}
          <View style={styles.genreGrid}>
            {SERIES_GENRES.map((g) => {
              const active = g.id === selectedGenre;
              return (
                <Pressable
                  key={g.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Pilih genre ${g.label}`}
                  onPress={() => {
                    hapticLight();
                    if (selectedGenre === g.id) {
                      router.push(
                        `/search?genre=${g.id}&format=TV&title=${encodeURIComponent(
                          g.label + " Series"
                        )}` as never
                      );
                    } else {
                      setSelectedGenre(g.id);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.genreBtn,
                    { width: genreColWidth },
                    active && styles.genreBtnActive,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Text
                    style={[styles.genreBtnText, active && styles.genreBtnTextActive]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {g.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Dynamic Anime Rail for Selected Genre */}
          {genreAnime.isLoading ? (
            <View style={{ marginTop: 8 }}>
              <SkeletonRail />
            </View>
          ) : genreAnime.data?.length ? (
            <View style={{ marginTop: 4 }}>
              <AnimeRail
                title={`Top ${selectedGenre} Series`}
                items={genreAnime.data}
                seeAllParams={{
                  genre: selectedGenre,
                  format: "TV",
                  sort: "POPULARITY_DESC",
                  title: `${selectedGenre} Series`,
                }}
              />
            </View>
          ) : null}
        </View>

        {/* Bottom space to scroll comfortably over floating liquid glass tab bar */}
        <View style={{ height: 90 }} />
      </ScrollView>

      <NotificationSheet
        visible={notifSheetVisible}
        onClose={() => setNotifSheetVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E17", // Sleek dark grey background matching reference
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 16,
  },
  btnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },

  // ─── 1. TOP APP BAR (NUENIME BRAND & ACTIONS) ───
  topHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },
  brandLogoContainer: {
    justifyContent: "center",
    alignItems: "flex-start",
  },
  brandLogoImg: {
    width: 110,
    height: 36,
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
  notifBadgeDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#0B0E17",
  },

  // ─── NUEGAME BAR ───
  nueGameBar: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.22)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  nueGameLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nueGameTitle: {
    fontFamily: "Nunito-Black",
    color: "#38BDF8",
    fontSize: 13,
  },
  nueGameSub: {
    fontFamily: "Nunito-SemiBold",
    color: "#94A3B8",
    fontSize: 11.5,
  },

  // ─── 2. FEATURED CAROUSEL BANNER ───
  heroSection: {
    width: "100%",
    gap: 10,
  },
  heroCard: {
    width: "100%",
    height: 220,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#161B26",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  heroDarkMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 14, 23, 0.3)",
    ...(Platform.OS === "web"
      ? ({
        backgroundImage:
          "linear-gradient(180deg, rgba(11,14,23,0) 0%, rgba(11,14,23,0.3) 35%, rgba(11,14,23,0.82) 75%, rgba(11,14,23,0.98) 100%)",
      } as any)
      : {}),
  },
  heroTopBadges: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  populerBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  populerBadgeText: {
    fontFamily: "Nunito-Black",
    color: "#FFFFFF",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  scoreStarText: {
    color: "#F5C518",
    fontSize: 11,
  },
  scoreValueText: {
    fontFamily: "Nunito-Bold",
    color: "#FFFFFF",
    fontSize: 11,
  },
  heroBottomContent: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
    gap: 2,
  },
  heroTitle: {
    fontFamily: "Nunito-Black",
    color: "#FFFFFF",
    fontSize: 19,
    letterSpacing: -0.3,
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
    marginBottom: 6,
  },
  heroEpsBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  heroEpsBadgeText: {
    fontFamily: "Nunito-Bold",
    color: "#E2E8F0",
    fontSize: 11,
  },
  heroSubText: {
    fontFamily: "Nunito-SemiBold",
    color: "#CBD5E1",
    fontSize: 11.5,
  },
  heroHdBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  heroHdBadgeText: {
    fontFamily: "Nunito-Black",
    color: "#38BDF8",
    fontSize: 9.5,
  },
  heroActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  heroTontonBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  heroTontonText: {
    fontFamily: "Nunito-Bold",
    color: "#FFFFFF",
    fontSize: 12.5,
  },
  heroDetailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 8,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  heroDetailText: {
    fontFamily: "Nunito-Bold",
    color: "#E2E8F0",
    fontSize: 12.5,
  },
  heroDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  heroDot: {
    borderRadius: 3,
  },
  heroDotActive: {
    width: 22,
    height: 5,
    backgroundColor: "#38BDF8",
  },
  heroDotInactive: {
    width: 5,
    height: 5,
    backgroundColor: "#334155",
  },

  // ─── 3. SEARCH BAR ───
  searchGlassBar: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.045)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  searchPlaceholderText: {
    fontFamily: "Nunito-SemiBold",
    color: "#64748B",
    fontSize: 13,
  },

  // ─── 4. LIVE CHAT GLOBAL BAR ───
  liveChatGlassBar: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.045)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  liveBadge: {
    backgroundColor: "#0284C7",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  liveBadgeText: {
    fontFamily: "Nunito-Black",
    color: "#FFFFFF",
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  liveChatText: {
    flex: 1,
    fontFamily: "Nunito-SemiBold",
    color: "#94A3B8",
    fontSize: 12,
  },

  // ─── 5. TOP GIVEAWAY USERS CARD ───
  giveawayGlassCard: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 16,
    gap: 4,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      } as any)
      : {}),
  },
  giveawayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  giveawayTitleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  leaderboardIcon: {
    width: 20,
    height: 20,
  },
  giveawayTrophyIcon: {
    fontSize: 14,
  },
  giveawayTitleText: {
    fontFamily: "Nunito-ExtraBold",
    color: "#FFFFFF",
    fontSize: 13,
    letterSpacing: 0.4,
  },
  giveawayLinkText: {
    fontFamily: "Nunito-Bold",
    color: "#38BDF8",
    fontSize: 11,
  },
  giveawayMainNotice: {
    fontFamily: "Nunito-Bold",
    color: "#CBD5E1",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  giveawaySubNotice: {
    fontFamily: "Nunito-Regular",
    color: "#64748B",
    fontSize: 11,
    textAlign: "center",
  },

  // ─── 6. TOP 10 ANIME TERPOPULER RAIL ───
  sectionWrap: {
    width: "100%",
    gap: 12,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  verticalBar: {
    width: 3.5,
    height: 16,
    borderRadius: 2,
    backgroundColor: "#C0C0C0",
  },
  sectionTitleText: {
    fontFamily: "Nunito-Black",
    color: "#FFFFFF",
    fontSize: 16,
    letterSpacing: -0.3,
  },
  rankingLinkText: {
    fontFamily: "Nunito-Bold",
    color: "#38BDF8",
    fontSize: 11,
  },
  horizontalRailContent: {
    gap: 12,
    paddingRight: 10,
  },
  animeCardWrap: {
    width: 120,
    gap: 6,
  },
  animePosterWrap: {
    width: 120,
    height: 165,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#1E293B",
  },
  cardScoreBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cardScoreStar: {
    color: "#F5C518",
    fontSize: 9.5,
  },
  cardScoreValue: {
    fontFamily: "Nunito-Bold",
    color: "#FFFFFF",
    fontSize: 10,
  },
  animeCardTitle: {
    fontFamily: "Nunito-Bold",
    color: "#FFFFFF",
    fontSize: 12,
  },

  skeletonRailLabel: {
    fontFamily: "Nunito-Bold",
    color: "#64748B",
    fontSize: 11,
    paddingHorizontal: 4,
  },
  skeletonRailRow: {
    gap: 10,
  },

  // ─── GENRE SERIES EXPLORER STYLES ───
  genreSectionWrap: {
    marginTop: 10,
    gap: 14,
  },
  genreSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    gap: 12,
  },
  genreSectionBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  genreBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(192, 192, 192, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(192, 192, 192, 0.35)",
  },
  genreBadgeText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 9.5,
    color: "#C0C0C0",
    letterSpacing: 0.6,
  },
  genreSectionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 19,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  genreSectionSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#8E9AA8",
    marginTop: 2,
  },
  seeAllGenreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(192, 192, 192, 0.25)",
  },
  seeAllGenreText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#C0C0C0",
  },
  genreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  genreBtn: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(192, 192, 192, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      } as any)
      : {}),
  },
  genreBtnActive: {
    backgroundColor: "rgba(192, 192, 192, 0.22)",
    borderColor: "#E2E8F0",
  },
  genreBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#CBD5E1",
    textAlign: "center",
  },
  genreBtnTextActive: {
    fontFamily: "Nunito-Black",
    color: "#FFFFFF",
  },
  duniaBannerCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#131722",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.28)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  duniaBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  duniaIconBadge: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  duniaTextWrap: {
    flex: 1,
    gap: 2,
  },
  duniaTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  duniaTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  duniaRpgPill: {
    backgroundColor: "rgba(168, 85, 247, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.4)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  duniaRpgText: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
    color: "#D8B4FE",
    letterSpacing: 0.5,
  },
  duniaSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  duniaEnterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  duniaEnterText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#38BDF8",
  },
});
