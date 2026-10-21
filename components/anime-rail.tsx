import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { Anime } from "@/lib/types";
import { AnimeCard } from "@/components/anime-card";

export function AnimeRail({
  label,
  title,
  items,
  seeAllParams,
}: {
  label?: string;
  title: string;
  items: Anime[];
  seeAllParams?: Record<string, string>;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={styles.headingLeft}>
          <View style={styles.verticalBar} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${title} catalog`}
          accessibilityHint="Double tap to browse the full catalog"
          onPress={() => {
            if (seeAllParams) router.push({ pathname: "/search", params: seeAllParams } as never);
            else router.push("/catalog" as never);
          }}
          style={styles.browse}
          hitSlop={8}
        >
          <Text style={styles.browseText}>Lihat Semua &gt;</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <AnimeCard anime={item} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={3}
        removeClippedSubviews
        accessibilityHint="Swipe to see more items"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headingLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  verticalBar: {
    width: 3.5,
    height: 16,
    borderRadius: 2,
    backgroundColor: "#C0C0C0",
  },
  title: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Bold",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  browse: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  browseText: {
    color: "#C0C0C0",
    fontFamily: "Nunito-Bold",
    fontSize: 12,
  },
  rail: {
    gap: 12,
    paddingRight: 18,
  },
});
