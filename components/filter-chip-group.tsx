import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

type FilterItem = { key: string; label: string };

function toFilterItems(raw: (string | { label: string; value: string })[]): FilterItem[] {
  return raw.map((item) => (typeof item === "string" ? { key: item, label: item } : { key: item.value, label: item.label }));
}

export function FilterChipGroup({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: (string | { label: string; value: string })[];
  selected: string | null;
  onToggle: (key: string | null) => void;
}) {
  const filterItems = toFilterItems(items);
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.chips}>
        {filterItems.map((item) => {
          const active = selected === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${item.label}`}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onToggle(active ? null : item.key);
              }}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
    minWidth: 120,
  },
  groupLabel: {
    color: "#94A3B8",
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  chip: {
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          cursor: "pointer",
        } as any)
      : {}),
  },
  chipActive: {
    backgroundColor: "rgba(239, 68, 68, 0.22)",
    borderColor: "#EF4444",
  },
  chipPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  chipText: {
    color: "#CBD5E1",
    fontSize: 11.5,
    fontFamily: "Nunito-Bold",
    letterSpacing: 0.3,
  },
  chipTextActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },
});
