import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import { useNotifications } from "@/hooks/use-notifications";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { getUserMailboxGifts, type SystemGift } from "@/lib/mailbox-service";
import { GiftClaimModal } from "@/components/gift-claim-modal";
import { supabase } from "@/lib/supabase";
import { hapticLight } from "@/lib/haptics";

const HADIAH_ICON = { uri: "https://i.ibb.co.com/BHDK5h9W/hadiah-icon.png" };

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}j lalu`;
  const days = Math.floor(hrs / 24);
  return `${days}h lalu`;
}

export function NotificationSheet({
  visible,
  onClose,
}: {
  onClose: () => void;
  visible: boolean;
}) {
  const { user } = useAnirakuAuth();
  const { notifications, markRead, markAllRead, deleteAll } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread" | "gifts">("unread");
  const [gifts, setGifts] = useState<SystemGift[]>([]);
  const [loadingGifts, setLoadingGifts] = useState(false);
  const [selectedGift, setSelectedGift] = useState<SystemGift | null>(null);
  const [claimModalVisible, setClaimModalVisible] = useState(false);

  // Ambil daftar hadiah mailbox
  const loadGifts = useCallback(async () => {
    try {
      setLoadingGifts(true);
      const data = await getUserMailboxGifts(user?.id);
      setGifts(data);
    } catch (err) {
      console.warn("[notification-sheet] loadGifts error:", err);
    } finally {
      setLoadingGifts(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (visible) {
      loadGifts();
    }
  }, [visible, loadGifts]);

  // Realtime subscription untuk system_gifts baru dari Admin
  // Channel ini menggunakan nama statis, jadi kita HARUS bersihkan channel
  // sisa dari registry Supabase sebelum subscribe agar tidak error
  // "cannot add postgres_changes callbacks after subscribe()".
  const loadGiftsRef = useRef(loadGifts);
  useEffect(() => { loadGiftsRef.current = loadGifts; }, [loadGifts]);

  useEffect(() => {
    const channelName = `realtime-system-gifts-listener-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Bersihkan semua channel lama dengan prefix ini dari registry global
    try {
      const stale = supabase.getChannels().filter((c) =>
        c.topic?.includes("realtime-system-gifts-listener")
      );
      for (const ch of stale) {
        supabase.removeChannel(ch).catch(() => {});
      }
    } catch {}

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "system_gifts" },
          () => {
            loadGiftsRef.current();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("[notification-sheet] Supabase realtime subscription warning:", err);
    }

    return () => {
      try {
        if (channel) supabase.removeChannel(channel).catch(() => {});
      } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- channel statis, cukup subscribe sekali

  const items = notifications.data ?? [];
  const filteredNotifs = filter === "unread" ? items.filter((n) => !n.read) : items;
  const unreadNotifCount = items.filter((n) => !n.read).length;
  const unclaimedGifts = gifts.filter((g) => !g.isClaimed);
  const unclaimedGiftsCount = unclaimedGifts.length;

  const handleOpenGiftModal = (gift: SystemGift) => {
    hapticLight();
    setSelectedGift(gift);
    setClaimModalVisible(true);
  };

  const handleGiftClaimSuccess = () => {
    loadGifts();
  };

  return (
    <>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
        <View style={styles.backdrop}>
          {/* Dismiss layer sits BEHIND the sheet */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Tutup notifikasi"
          />
          <View style={styles.sheet}>
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Notifikasi & Hadiah</Text>
              {unreadNotifCount + unclaimedGiftsCount > 0 ? (
                <Text style={styles.badge}>{unreadNotifCount + unclaimedGiftsCount}</Text>
              ) : null}
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterRow}>
              <Pressable
                onPress={() => {
                  hapticLight();
                  setFilter("unread");
                }}
                style={[styles.filterBtn, filter === "unread" && styles.filterActive]}
              >
                <Text style={[styles.filterText, filter === "unread" && styles.filterTextActive]}>
                  BELUM DIBACA {unreadNotifCount > 0 ? `(${unreadNotifCount})` : ""}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  hapticLight();
                  setFilter("gifts");
                }}
                style={[styles.filterBtn, filter === "gifts" && styles.filterGiftActive]}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === "gifts" && styles.filterGiftTextActive,
                    unclaimedGiftsCount > 0 && { color: "#F59E0B", fontWeight: "900" },
                  ]}
                >
                  HADIAH {unclaimedGiftsCount > 0 ? `(${unclaimedGiftsCount})` : ""}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  hapticLight();
                  setFilter("all");
                }}
                style={[styles.filterBtn, filter === "all" && styles.filterActive]}
              >
                <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
                  SEMUA
                </Text>
              </Pressable>

              {filter !== "gifts" && unreadNotifCount > 0 ? (
                <Pressable onPress={() => markAllRead.mutate()} style={styles.markAllBtn}>
                  <Text style={styles.markAllText}>BACA SEMUA</Text>
                </Pressable>
              ) : null}

              {filter !== "gifts" && items.length > 0 ? (
                <Pressable
                  onPress={() => {
                    const doDelete = async () => {
                      hapticLight();
                      try {
                        await deleteAll.mutateAsync();
                      } catch (e) {
                        console.warn("[notification-sheet] Delete error:", e);
                      }
                    };
                    if (Platform.OS === "web") {
                      const confirmed = typeof window !== "undefined" ? window.confirm("Hapus semua notifikasi akun Anda?") : true;
                      if (confirmed) void doDelete();
                    } else {
                      Alert.alert(
                        "Hapus Semua Notifikasi?",
                        "Semua notifikasi akun Anda akan dihapus permanen.",
                        [
                          { text: "Batal", style: "cancel" },
                          {
                            text: "Hapus",
                            style: "destructive",
                            onPress: () => {
                              void doDelete();
                            },
                          },
                        ]
                      );
                    }
                  }}
                  style={styles.deleteAllNotifBtn}
                >
                  <AppIcon name="trash-can-outline" size={11} color="#EF4444" />
                  <Text style={styles.deleteAllNotifText}>HAPUS</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Banner Hadiah Belum Diklaim (jika ada dan sedang di tab unread/all) */}
            {filter !== "gifts" && unclaimedGiftsCount > 0 && (
              <Pressable
                onPress={() => {
                  hapticLight();
                  setFilter("gifts");
                }}
                style={styles.unclaimedGiftBanner}
              >
                <Image source={HADIAH_ICON} style={{ width: 28, height: 28 }} contentFit="contain" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.unclaimedGiftTitle}>
                    Kamu punya {unclaimedGiftsCount} hadiah belum diklaim!
                  </Text>
                  <Text style={styles.unclaimedGiftSub}>
                    Ketuk untuk klaim Dylan Crystal atau Border
                  </Text>
                </View>
                <View style={styles.claimNowBtn}>
                  <Text style={styles.claimNowText}>KLAIM</Text>
                </View>
              </Pressable>
            )}

            {/* TAB: HADIAH MASSAL (MAILBOX) */}
            {filter === "gifts" ? (
              loadingGifts ? (
                <View style={styles.empty}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                  <Text style={styles.emptyText}>Memuat kotak hadiah...</Text>
                </View>
              ) : gifts.length === 0 ? (
                <View style={styles.empty}>
                  <Image source={HADIAH_ICON} style={{ width: 48, height: 48 }} contentFit="contain" />
                  <Text style={styles.emptyTitle}>Belum Ada Hadiah</Text>
                  <Text style={styles.emptyText}>
                    Hadiah massal dari admin akan muncul di sini.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={gifts}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => handleOpenGiftModal(item)}
                      style={[
                        styles.giftRow,
                        !item.isClaimed && styles.giftRowUnclaimed,
                      ]}
                    >
                      <View style={styles.giftIconWrap}>
                        <Image source={HADIAH_ICON} style={{ width: 30, height: 30 }} contentFit="contain" />
                      </View>
                      <View style={styles.rowBody}>
                        <View style={styles.giftTitleRow}>
                          <Text style={styles.giftRowTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
                        </View>
                        <Text style={styles.rowMessage} numberOfLines={2}>
                          {item.message}
                        </Text>
                        <View style={styles.giftBadgeRow}>
                          <View
                            style={[
                              styles.rewardTag,
                              item.giftType === "crystal"
                                ? styles.rewardTagCrystal
                                : styles.rewardTagBorder,
                            ]}
                          >
                            <Text style={styles.rewardTagText}>
                              {item.giftType === "crystal"
                                ? `💎 +${item.giftValue} Crystal`
                                : `🖼️ Border: ${item.giftValue}`}
                            </Text>
                          </View>

                          {item.isClaimed ? (
                            <View style={styles.statusClaimedTag}>
                              <Text style={styles.statusClaimedText}>✓ SUDAH DIKLAIM</Text>
                            </View>
                          ) : (
                            <View style={styles.statusUnclaimedTag}>
                              <Text style={styles.statusUnclaimedText}>KLAIM SEKARANG</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                  contentContainerStyle={styles.list}
                />
              )
            ) : filteredNotifs.length === 0 ? (
              <View style={styles.empty}>
                <AppIcon name="bell" color={nothing.dim} size={28} />
                <Text style={styles.emptyText}>
                  {filter === "unread" ? "Tidak ada notifikasi baru" : "Belum ada notifikasi"}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredNotifs}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      if (!item.read) markRead.mutate(item.id);
                      if (item.type === "gift" || item.title?.includes("🎁")) {
                        const target = gifts.find((g) => !g.isClaimed) || gifts[0];
                        if (target) {
                          handleOpenGiftModal(target);
                        } else {
                          setFilter("gifts");
                        }
                      }
                    }}
                    style={[styles.row, !item.read && styles.rowUnread]}
                  >
                    <View style={styles.rowDot}>
                      {!item.read ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <View style={styles.rowBody}>
                      {item.title ? (
                        <Text style={styles.notifTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                      ) : null}
                      <Text style={styles.rowMessage} numberOfLines={2}>
                        {item.message ?? "Pembaruan baru"}
                      </Text>
                      <Text style={styles.rowTime}>
                        {item.created_at ? timeAgo(item.created_at) : ""}
                      </Text>
                    </View>
                  </Pressable>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                contentContainerStyle={styles.list}
              />
            )}

            {/* Footer: Navigasi ke Library Tab Notifikasi */}
            <Pressable
              onPress={() => {
                hapticLight();
                onClose();
                router.push("/(tabs)/library?tab=alerts" as never);
              }}
              style={styles.viewAllFooterBtn}
            >
              <Text style={styles.viewAllFooterText}>Lihat Semua Notifikasi di Library</Text>
              <AppIcon name="chevron-right" size={15} color="#38BDF8" />
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* POPUP KLAIM HADIAH */}
      <GiftClaimModal
        visible={claimModalVisible}
        gift={selectedGift}
        onClose={() => {
          setClaimModalVisible(false);
          setSelectedGift(null);
        }}
        onClaimSuccess={handleGiftClaimSuccess}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  sheet: {
    backgroundColor: "#111422",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: "78%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderBottomWidth: 0,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  title: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  badge: {
    backgroundColor: "#EF4444",
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  filterActive: {
    borderColor: "#38BDF8",
    backgroundColor: "rgba(56,189,248,0.12)",
  },
  filterGiftActive: {
    borderColor: "#F59E0B",
    backgroundColor: "rgba(245,158,11,0.15)",
  },
  filterText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  filterTextActive: { color: "#FFFFFF" },
  filterGiftTextActive: { color: "#FDE68A" },
  markAllBtn: { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 4 },
  markAllText: {
    color: "#38BDF8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  deleteAllNotifBtn: {
    marginLeft: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
  },
  deleteAllNotifText: {
    color: "#EF4444",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  viewAllFooterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    marginHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.22)",
  },
  viewAllFooterText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
  },

  unclaimedGiftBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 18,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(245,158,11,0.14)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
  },
  unclaimedGiftTitle: {
    color: "#FDE68A",
    fontSize: 12,
    fontWeight: "800",
  },
  unclaimedGiftSub: {
    color: "#CBD5E1",
    fontSize: 10,
  },
  claimNowBtn: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  claimNowText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  empty: { alignItems: "center", gap: 10, paddingVertical: 38 },
  emptyTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  emptyText: { color: "#64748B", fontSize: 13, textAlign: "center", paddingHorizontal: 32 },
  list: { paddingHorizontal: 18 },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
  },
  rowUnread: {
    backgroundColor: "rgba(56,189,248,0.06)",
    marginHorizontal: -18,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  rowDot: { width: 14, paddingTop: 6, alignItems: "center" },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#38BDF8" },
  rowBody: { flex: 1, gap: 3 },
  notifTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  rowMessage: { color: "#CBD5E1", fontSize: 13, lineHeight: 17 },
  rowTime: { color: "#64748B", fontSize: 11 },

  // Gift row styles
  giftRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderRadius: 10,
  },
  giftRowUnclaimed: {
    backgroundColor: "rgba(245,158,11,0.06)",
    marginHorizontal: -18,
    paddingHorizontal: 18,
  },
  giftIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  giftTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  giftRowTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  giftBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  rewardTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rewardTagCrystal: {
    backgroundColor: "rgba(56,189,248,0.15)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.3)",
  },
  rewardTagBorder: {
    backgroundColor: "rgba(168,85,247,0.15)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
  },
  rewardTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  statusClaimedTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  statusClaimedText: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
  },
  statusUnclaimedTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#F59E0B",
  },
  statusUnclaimedText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginLeft: 52,
  },
});

