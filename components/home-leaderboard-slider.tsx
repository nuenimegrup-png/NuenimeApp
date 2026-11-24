import React, { useRef, useState, useEffect } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { HomeTopLeaderboard } from "@/components/home-top-leaderboard";
import { HomeTopAffinityCard } from "@/components/home-top-affinity-card";
import { HomeTopLikesCard } from "@/components/home-top-likes-card";
import { HomeTopCharismaCard } from "@/components/home-top-charisma-card";
import { hapticLight } from "@/lib/haptics";

export const HomeLeaderboardSlider = React.memo(function HomeLeaderboardSlider() {
  const { width: screenWidth } = useWindowDimensions();
  // Padding horizontal layar home adalah 16 di kiri dan 16 di kanan (total 32)
  const cardWidth = Math.max(screenWidth - 32, 280);
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isMountedRef = useRef(true);
  const activeIndexRef = useRef(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-slide setiap 7 detik melingkar antar 4 Kotak (EXP, Afinitas, Like, Charisma)
  // Dipisah keluar dari setState updater agar murni dan aman di React 19 / Native
  useEffect(() => {
    const timer = setInterval(() => {
      if (isDraggingRef.current || !isMountedRef.current) return;
      const next = (activeIndexRef.current + 1) % 4;
      activeIndexRef.current = next;
      setActiveIndex(next);
      scrollRef.current?.scrollTo({
        x: next * (cardWidth + 12),
        animated: true,
      });
    }, 7000);

    return () => clearInterval(timer);
  }, [cardWidth]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / (cardWidth + 12));
    if (page !== activeIndexRef.current && (page >= 0 && page <= 3)) {
      activeIndexRef.current = page;
      setActiveIndex(page);
    }
  };

  const handleSelectPage = (page: number) => {
    hapticLight();
    activeIndexRef.current = page;
    setActiveIndex(page);
    scrollRef.current?.scrollTo({
      x: page * (cardWidth + 12),
      animated: true,
    });
  };

  return (
    <View style={styles.container}>
      {/* ─── BARISAN KOTAK HORIZONTAL (EXP, AFINITAS, LIKE, CHARISMA TERPISAH) ─── */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + 12}
        decelerationRate="fast"
        snapToAlignment="start"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          isDraggingRef.current = true;
        }}
        onScrollEndDrag={() => {
          setTimeout(() => {
            isDraggingRef.current = false;
          }, 3000);
        }}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Kotak 1: Leaderboard EXP (Kotaknya sendiri utuh) */}
        <View style={[styles.cardItem, { width: cardWidth, marginRight: 12 }]}>
          <HomeTopLeaderboard />
        </View>

        {/* Kotak 2: Afinitas (Kotaknya sendiri utuh) */}
        <View style={[styles.cardItem, { width: cardWidth, marginRight: 12 }]}>
          <HomeTopAffinityCard isActive={activeIndex === 1} />
        </View>

        {/* Kotak 3: Like Profil Terbanyak (Kotaknya sendiri utuh) */}
        <View style={[styles.cardItem, { width: cardWidth, marginRight: 12 }]}>
          <HomeTopLikesCard />
        </View>

        {/* Kotak 4: Charisma Profil Terbanyak (Kotaknya sendiri utuh) */}
        <View style={[styles.cardItem, { width: cardWidth }]}>
          <HomeTopCharismaCard />
        </View>
      </ScrollView>

      {/* ─── DOTS INDIKATOR CAROUSEL (EXP • AFINITAS • LIKE • CHARISMA) ─── */}
      <View style={styles.dotsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kotak Top Leaderboard"
          onPress={() => handleSelectPage(0)}
          hitSlop={10}
          style={[
            styles.dot,
            activeIndex === 0 ? styles.dotActiveLeaderboard : styles.dotInactive,
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kotak Top Afinitas"
          onPress={() => handleSelectPage(1)}
          hitSlop={10}
          style={[
            styles.dot,
            activeIndex === 1 ? styles.dotActiveAffinity : styles.dotInactive,
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kotak Top Like Profil"
          onPress={() => handleSelectPage(2)}
          hitSlop={10}
          style={[
            styles.dot,
            activeIndex === 2 ? styles.dotActiveLikes : styles.dotInactive,
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kotak Top Charisma"
          onPress={() => handleSelectPage(3)}
          hitSlop={10}
          style={[
            styles.dot,
            activeIndex === 3 ? styles.dotActiveCharisma : styles.dotInactive,
          ]}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 8,
  },
  cardItem: {
    minHeight: 245,
  },
  scrollContent: {
    alignItems: "stretch",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 2,
  },
  dot: {
    borderRadius: 3,
  },
  dotActiveLeaderboard: {
    width: 20,
    height: 5,
    backgroundColor: "#38BDF8", // Cyan Sky khas Leaderboard
  },
  dotActiveAffinity: {
    width: 20,
    height: 5,
    backgroundColor: "#F43F5E", // Rose Pink khas Afinitas
  },
  dotActiveLikes: {
    width: 20,
    height: 5,
    backgroundColor: "#EF4444", // Crimson Red khas Like Profil
  },
  dotActiveCharisma: {
    width: 20,
    height: 5,
    backgroundColor: "#F59E0B", // Amber Gold khas Charisma Profil
  },
  dotInactive: {
    width: 6,
    height: 5,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
});

