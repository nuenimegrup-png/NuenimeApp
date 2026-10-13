import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FilterChipGroup } from "@/components/filter-chip-group";
import { AppIcon } from "@/components/app-icon";
import {
  countActiveFilters,
  EMPTY_FILTERS,
  FORMAT_OPTIONS,
  SEASON_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  YEAR_OPTIONS,
  type SearchFilters,
} from "@/lib/search-filters";
import * as Haptics from "expo-haptics";

type Props = {
  visible: boolean;
  filters: SearchFilters;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
};

/**
 * Bottom-sheet style filter panel for search results. Draft state lives here
 * so dismissing without applying never mutates the active query.
 */
export function SearchFilterSheet({ visible, filters, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<SearchFilters>(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const set = (key: keyof SearchFilters) => (value: string | null) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const activeCount = countActiveFilters(draft);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleAccent} />
              <Text style={styles.title}>Filter Pencarian</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup filter"
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
            >
              <AppIcon name="close" size={17} color="#94A3B8" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <FilterChipGroup label="Urutkan Berdasarkan" items={SORT_OPTIONS} selected={draft.sort} onToggle={set("sort")} />
            <FilterChipGroup label="Status Penayangan" items={STATUS_OPTIONS} selected={draft.status} onToggle={set("status")} />
            <FilterChipGroup label="Format Anime" items={FORMAT_OPTIONS} selected={draft.format} onToggle={set("format")} />
            <FilterChipGroup label="Musim Rilis" items={SEASON_OPTIONS} selected={draft.season} onToggle={set("season")} />
            <FilterChipGroup label="Tahun Rilis" items={YEAR_OPTIONS} selected={draft.year} onToggle={set("year")} />
          </ScrollView>

          <View style={styles.footer}>
            {/* Liquid silver glass CLEAR button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset semua filter"
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDraft({ ...EMPTY_FILTERS });
              }}
              style={({ pressed }) => [styles.clearBtn, pressed && styles.btnPressed]}
            >
              <AppIcon name="refresh" size={15} color="#CBD5E1" />
              <Text style={styles.clearText}>
                Reset{activeCount ? ` (${activeCount})` : ""}
              </Text>
            </Pressable>

            {/* Glowing red glass APPLY button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Terapkan filter"
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onApply(draft);
                onClose();
              }}
              style={({ pressed }) => [styles.applyBtn, pressed && styles.btnPressed]}
            >
              <AppIcon name="check" size={16} color="#FFFFFF" />
              <Text style={styles.applyText}>Terapkan Filter</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0F121C",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    maxHeight: "84%",
    paddingTop: 16,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        } as any)
      : {}),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleAccent: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: "#EF4444",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Nunito-Bold",
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 20,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 32 : 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(15, 18, 28, 0.95)",
  },

  // Liquid silver glass CLEAR button (identical aesthetic to home banner hero detail button)
  clearBtn: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          cursor: "pointer",
        } as any)
      : {}),
  },
  clearText: {
    color: "#CBD5E1",
    fontSize: 13,
    fontFamily: "Nunito-Bold",
    letterSpacing: 0.3,
  },

  // Primary silver liquid glass APPLY button (without shadow)
  applyBtn: {
    flex: 1.8,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          cursor: "pointer",
        } as any)
      : {}),
  },
  applyText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Nunito-Bold",
    letterSpacing: 0.4,
  },

  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
