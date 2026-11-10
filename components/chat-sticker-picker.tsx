import React, { useState, useMemo, useEffect } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { AppIcon } from "@/components/app-icon";
import {
  DEFAULT_STICKERS,
  STICKER_CATEGORIES,
  preloadChatStickers,
  type ChatSticker,
} from "@/lib/chat-stickers";
import { hapticLight } from "@/lib/haptics";

interface ChatStickerPickerProps {
  visible: boolean;
  onSelectSticker: (sticker: ChatSticker) => void;
  onClose: () => void;
  cooldownRemaining?: number;
  sending?: boolean;
}

export const ChatStickerPicker = React.memo(function ChatStickerPicker({
  visible,
  onSelectSticker,
  onClose,
  cooldownRemaining = 0,
  sending = false,
}: ChatStickerPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Preload semua stiker ke memory-disk cache secara otomatis saat komponen dibuat
  useEffect(() => {
    preloadChatStickers();
  }, []);

  const filteredStickers = useMemo(() => {
    if (selectedCategory === "all") return DEFAULT_STICKERS;
    return DEFAULT_STICKERS.filter((s) => s.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <View
      style={[styles.container, !visible && styles.hiddenContainer]}
      pointerEvents={visible ? "auto" : "none"}
    >
      {/* ─── Header: Kategori Tabs & Close Button ─── */}
      <View style={styles.headerRow}>
        <View style={styles.tabsRow}>
          {STICKER_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => {
                  hapticLight();
                  setSelectedCategory(cat.id);
                }}
                style={({ pressed }) => [
                  styles.tabPill,
                  isActive && styles.tabPillActive,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    isActive && styles.tabPillTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tutup stiker"
          onPress={() => {
            hapticLight();
            onClose();
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
        >
          <AppIcon name="close" size={18} color="#94A3B8" />
        </Pressable>
      </View>

      {/* ─── Status / Cooldown Banner ─── */}
      {cooldownRemaining > 0 && (
        <View style={styles.cooldownBanner}>
          <AppIcon name="timer-outline" size={13} color="#F59E0B" />
          <Text style={styles.cooldownText}>
            Jeda kirim aktif: tunggu {cooldownRemaining} detik lagi
          </Text>
        </View>
      )}

      {/* ─── Grid Stiker (4 Kolom - Instan Tanpa Delay) ─── */}
      <FlatList
        data={filteredStickers}
        keyExtractor={(item) => item.id}
        numColumns={4}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={16}
        maxToRenderPerBatch={16}
        windowSize={5}
        removeClippedSubviews={false}
        renderItem={({ item }) => {
          const isDisabled = sending || cooldownRemaining > 0;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Kirim stiker ${item.name}`}
              disabled={isDisabled}
              onPress={() => {
                onSelectSticker(item);
              }}
              style={({ pressed }) => [
                styles.stickerItem,
                isDisabled && styles.stickerItemDisabled,
                pressed && styles.stickerItemPressed,
              ]}
            >
              <Image
                source={{ uri: item.url }}
                style={styles.stickerThumb}
                contentFit="contain"
                transition={0}
                cachePolicy="memory-disk"
                priority="high"
                recyclingKey={item.id}
              />
              <Text style={styles.stickerLabel} numberOfLines={1}>
                {item.name}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Belum ada stiker di kategori ini</Text>
          </View>
        }
      />

      {/* ─── Footer Keterangan Singkat ─── */}
      <View style={styles.footerNoteRow}>
        <AppIcon name="emoticon-happy-outline" size={13} color="#38BDF8" />
        <Text style={styles.footerNoteText}>
          Pilih stiker untuk mengirim langsung ke chat
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: 250,
    backgroundColor: "#11141B",
    borderTopWidth: 1,
    borderTopColor: "#1E2738",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  hiddenContainer: {
    display: "none",
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tabPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "#18202F",
    borderWidth: 1,
    borderColor: "#222D40",
  },
  tabPillActive: {
    backgroundColor: "rgba(2, 132, 199, 0.2)",
    borderColor: "#0284C7",
  },
  tabPillText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#94A3B8",
  },
  tabPillTextActive: {
    color: "#38BDF8",
    fontWeight: "700",
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  cooldownBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  cooldownText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#F59E0B",
  },
  gridContent: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  stickerItem: {
    flex: 1 / 4,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    margin: 4,
    padding: 4,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.025)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  stickerItemPressed: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.35)",
    transform: [{ scale: 0.94 }],
  },
  stickerItemDisabled: {
    opacity: 0.45,
  },
  stickerThumb: {
    width: 52,
    height: 52,
  },
  stickerLabel: {
    fontSize: 9.5,
    color: "#64748B",
    marginTop: 2,
    textAlign: "center",
  },
  emptyContainer: {
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 12,
    color: "#64748B",
  },
  footerNoteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingTop: 4,
    paddingBottom: 2,
  },
  footerNoteText: {
    fontSize: 10.5,
    color: "#64748B",
  },
});

