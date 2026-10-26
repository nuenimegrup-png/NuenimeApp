import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Image } from "expo-image";

import { AppIcon } from "@/components/app-icon";
import { BorderAvatar } from "@/components/border-avatar";
import { UserVerificationBadge } from "@/components/user-verification-badge";
import { getTierForLevel } from "@/components/level-progress-modal";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { getEquippedBorderId } from "@/lib/avatar-borders";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  type GlobalRoom,
  type GlobalChatMessage,
  GLOBAL_ROOMS,
  getGlobalMessages,
  sendGlobalMessage,
  subscribeGlobalMessages,
  purgeGlobalChatMockCache,
} from "@/lib/global-chat-service";

function formatChatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch {
    return "";
  }
}

// Generate nama warna yang harmonis dan konsisten berdasarkan string username
const NAME_COLORS = [
  "#38BDF8", // Cyan Sky
  "#4ADE80", // Emerald Green
  "#F43F5E", // Rose Red
  "#A855F7", // Purple
  "#F59E0B", // Amber Gold
  "#2DD4BF", // Teal
  "#EC4899", // Pink
  "#60A5FA", // Blue
];

function getUsernameColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % NAME_COLORS.length;
  return NAME_COLORS[index];
}

/**
 * Mendapatkan tema warna kapsul Rank Tier persis sesuai referensi (ETERNAL dsb.)
 */
function getTierPillColors(tierName: string) {
  switch (tierName.toLowerCase()) {
    case "eternal":
      return {
        bg: "rgba(168, 85, 247, 0.16)",
        border: "rgba(168, 85, 247, 0.45)",
        text: "#D8B4FE",
      };
    case "celestial":
      return {
        bg: "rgba(251, 146, 60, 0.16)",
        border: "rgba(251, 146, 60, 0.45)",
        text: "#FDBA74",
      };
    case "ruby star":
      return {
        bg: "rgba(251, 113, 133, 0.16)",
        border: "rgba(251, 113, 133, 0.45)",
        text: "#FDA4AF",
      };
    case "amethyst":
      return {
        bg: "rgba(192, 132, 252, 0.16)",
        border: "rgba(192, 132, 252, 0.45)",
        text: "#E9D5FF",
      };
    case "sapphire":
      return {
        bg: "rgba(56, 189, 248, 0.16)",
        border: "rgba(56, 189, 248, 0.45)",
        text: "#7DD3FC",
      };
    case "emerald":
      return {
        bg: "rgba(52, 211, 153, 0.16)",
        border: "rgba(52, 211, 153, 0.45)",
        text: "#6EE7B7",
      };
    case "gold":
      return {
        bg: "rgba(251, 191, 36, 0.16)",
        border: "rgba(251, 191, 36, 0.45)",
        text: "#FDE047",
      };
    case "silver":
      return {
        bg: "rgba(203, 213, 225, 0.16)",
        border: "rgba(203, 213, 225, 0.45)",
        text: "#E2E8F0",
      };
    case "bronze":
      return {
        bg: "rgba(217, 119, 6, 0.16)",
        border: "rgba(217, 119, 6, 0.45)",
        text: "#FDBA74",
      };
    default:
      return {
        bg: "rgba(148, 163, 184, 0.16)",
        border: "rgba(148, 163, 184, 0.45)",
        text: "#CBD5E1",
      };
  }
}

export default function ChatGlobalScreen() {
  const auth = useAnirakuAuth();
  const insets = useSafeAreaInsets();
  const currentUserId = auth.user?.id;

  const [activeRoom, setActiveRoom] = useState<GlobalRoom>("ngobrol_1");
  const [messages, setMessages] = useState<GlobalChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<GlobalChatMessage | null>(null);
  const [bottomNavTab, setBottomNavTab] = useState<"global" | "clan" | "teman">("global");

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // ─── 1. LOAD PESAN ───
  const loadMessages = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await getGlobalMessages(activeRoom);
      setMessages(data);
    } catch (err) {
      console.warn("[chat-global] load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeRoom]);

  useEffect(() => {
    // Bersihkan cache pesan tiruan sebelumnya
    void purgeGlobalChatMockCache();
    void loadMessages();
  }, [loadMessages]);

  // ─── 2. REALTIME SUBSCRIPTION ───
  useEffect(() => {
    const unsubscribe = subscribeGlobalMessages(activeRoom, (newMsg) => {
      setMessages((prev) => {
        // Hindari duplikasi pesan jika sudah masuk
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // Otomatis scroll ke pesan terbaru
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => {
      unsubscribe();
    };
  }, [activeRoom]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 120);
    }
  }, [loading, activeRoom]);

  // ─── 3. SEND MESSAGE ───
  const handleSendMessage = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || sending) return;

    if (!currentUserId || currentUserId === "guest") {
      hapticWarning();
      router.push("/auth" as never);
      return;
    }

    setSending(true);
    hapticLight();

    const senderProfile = auth.profile;
    const equippedBorder = await getEquippedBorderId(currentUserId);
    const res = await sendGlobalMessage({
      room: activeRoom,
      senderId: currentUserId,
      senderName: senderProfile?.display_name || senderProfile?.username || "Pengguna Nuenime",
      senderAvatar: senderProfile?.avatar_url || null,
      senderBorder: equippedBorder || senderProfile?.equipped_border || null,
      senderRole: senderProfile?.role || "Member",
      senderLevel: Number(senderProfile?.level) || 1,
      senderMemberNumber: "#" + (String(senderProfile?.member_number).replace(/[^0-9]/g, "") || "1"),
      senderIsVip: Boolean(senderProfile?.is_vip),
      clanTag: null,
      message: textToSend,
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            senderName: replyingTo.senderName,
            text: replyingTo.message,
            memberNumber: replyingTo.senderMemberNumber,
            role: replyingTo.senderRole,
            isVip: replyingTo.senderIsVip,
          }
        : null,
    });

    setSending(false);

    if (res.isBanned) {
      await auth.refreshProfile();
      Alert.alert(
        "AKUN DIBLOKIR",
        res.error || "Akun Anda telah DIBLOKIR permanen karena melakukan spam pesan berulang 4 kali!"
      );
      return;
    }

    if (res.warning) {
      Alert.alert("Peringatan Keamanan", res.warning);
    }

    if (res.success && res.data) {
      hapticSuccess();
      setInputText("");
      setReplyingTo(null);

      // Tambahkan ke UI lokal seketika jika belum ada
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data!.id)) return prev;
        return [...prev, res.data!];
      });

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
    } else if (!res.success && res.error) {
      hapticWarning();
      Alert.alert("Pesan Gagal Terkirim", res.error);
    }
  };

  // ─── 4. REPLY MESSAGE ───
  const handleReplyMessage = (msg: GlobalChatMessage) => {
    hapticLight();
    setReplyingTo(msg);
    inputRef.current?.focus();
  };

  // ─── 5. BOTTOM NAVIGATION HANDLER ───
  const handleBottomTabPress = (tab: "global" | "clan" | "teman") => {
    hapticLight();
    if (tab === "teman") {
      // Sesuai Aturan 6: Buka fitur Pertemanan yang sudah ada
      router.push("/connections" as never);
      return;
    }
    if (tab === "clan") {
      router.push({
        pathname: "/dunia",
        params: { tab: "klan" },
      } as never);
      return;
    }
    setBottomNavTab("global");
    setActiveRoom("ngobrol_1");
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* ─── A. TOP HEADER ─── */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerBackBtn, pressed && styles.btnPressed]}
          hitSlop={10}
        >
          <AppIcon name="arrow-left" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Chat Global</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      {/* ─── B. WARNING BANNER (PERSIS SCREENSHOT) ─── */}
      <View style={styles.warningBannerContainer}>
        <View style={styles.warningBanner}>
          <AppIcon name="alert" size={16} color="#F59E0B" />
          <Text style={styles.warningBannerText}>
            Dilarang berjualan premium dan harus sopan
          </Text>
        </View>
      </View>

      {/* ─── C. ROOM PILLS TABS (PERSIS SCREENSHOT) ─── */}
      <View style={styles.roomPillsRow}>
        {GLOBAL_ROOMS.map((r) => {
          const isActive = activeRoom === r.id;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="tab"
              accessibilityLabel={`Ruang ${r.label}`}
              onPress={() => {
                hapticLight();
                if (r.comingSoon) {
                  Alert.alert(
                    "Rekrut Clan",
                    "Fitur Rekrut Clan sedang dalam tahap pengembangan dan akan segera hadir (Coming Soon)!"
                  );
                  return;
                }
                setActiveRoom(r.id);
                setBottomNavTab("global");
              }}
              style={({ pressed }) => [
                styles.roomPill,
                isActive && styles.roomPillActive,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={[styles.roomPillHash, isActive && styles.roomPillHashActive]}>#</Text>
              <Text style={[styles.roomPillLabel, isActive && styles.roomPillLabelActive]}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ─── D. CHAT MESSAGES FEED ─── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text style={styles.loadingText}>Memuat percakapan global...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadMessages(true)}
                tintColor="#38BDF8"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <AppIcon name="chat" size={32} color="#64748B" />
                </View>
                <Text style={styles.emptyTitle}>Belum Ada Pesan</Text>
                <Text style={styles.emptySubtitle}>
                  Belum ada percakapan di ruang ini. Jadilah yang pertama menyapa komunitas!
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const tierInfo = getTierForLevel(item.senderLevel || 1);
              const activeTier = tierInfo?.currentTier;
              const nameColor = getUsernameColor(item.senderName);
              const tierPillColors = getTierPillColors(activeTier?.name || "Stone");

              return (
                <View style={styles.messageRow}>
                  {/* Left Avatar with live border */}
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      router.push(`/user/${item.senderId}` as never);
                    }}
                    style={styles.avatarWrap}
                  >
                    <BorderAvatar
                      size={42}
                      borderId={item.senderBorder}
                      avatarUrl={item.senderAvatar || "https://images.alphacoders.com/132/1328004.png"}
                    />
                  </Pressable>

                  {/* Right Bubble Content */}
                  <View style={styles.bubbleCol}>
                    <Pressable
                      onLongPress={() => handleReplyMessage(item)}
                      delayLongPress={250}
                      style={({ pressed }) => [
                        styles.messageCard,
                        pressed && styles.messageCardPressed,
                      ]}
                    >
                      {/* 1. Header: Display Name + Verification Checkmark + Member Tag */}
                      <View style={styles.senderHeaderRow}>
                        <Pressable
                          onPress={() => {
                            hapticLight();
                            router.push(`/user/${item.senderId}` as never);
                          }}
                        >
                          <Text style={[styles.senderNameText, { color: nameColor }]} numberOfLines={1}>
                            {item.senderName}
                          </Text>
                        </Pressable>

                        {/* Otoritatif Checkmark: Merah (Admin/Dev) | Biru (VIP/Verified) | None */}
                        <UserVerificationBadge
                          role={item.senderRole}
                          isVip={item.senderIsVip}
                          size={13}
                        />

                        {/* Member Tag Number */}
                        <Text style={styles.memberTagText}>{item.senderMemberNumber}</Text>
                      </View>

                      {/* 2. Badges Row: Rank Tier Pill (e.g. ETERNAL, GOLD) + Level Pill (Persis Screenshot 2) */}
                      <View style={styles.badgesRow}>
                        {activeTier ? (
                          <View
                            style={[
                              styles.rankTierPill,
                              {
                                backgroundColor: tierPillColors.bg,
                                borderColor: tierPillColors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.rankTierText,
                                { color: tierPillColors.text },
                              ]}
                            >
                              {activeTier.name.toUpperCase()}
                            </Text>
                          </View>
                        ) : null}

                        {/* Level Badge Pill */}
                        <View style={styles.levelPill}>
                          {activeTier?.imageUrl && (
                            <Image
                              source={{ uri: activeTier.imageUrl }}
                              style={styles.tierPillIcon}
                              contentFit="contain"
                              cachePolicy="memory-disk"
                            />
                          )}
                          <Text style={styles.levelPillText}>
                            Lvl {item.senderLevel.toLocaleString("id-ID")}
                          </Text>
                        </View>
                      </View>

                      {/* 3. Reply Quote Box (jika membalas pesan lain) */}
                      {item.replyTo && (
                        <View style={styles.quoteBox}>
                          <View style={styles.quoteAccentLine} />
                          <View style={styles.quoteContent}>
                            <View style={styles.quoteHeaderRow}>
                              <Text style={styles.quoteSenderName} numberOfLines={1}>
                                {item.replyTo.senderName}
                              </Text>
                              {item.replyTo.memberNumber ? (
                                <Text style={styles.quoteMemberNumber}>{item.replyTo.memberNumber}</Text>
                              ) : null}
                              <UserVerificationBadge
                                role={item.replyTo.role}
                                isVip={item.replyTo.isVip}
                                size={11}
                              />
                            </View>
                            <Text style={styles.quoteText} numberOfLines={1}>
                              {item.replyTo.text}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* 4. Isi Pesan */}
                      <Text style={styles.messageText}>{item.message}</Text>
                    </Pressable>

                    {/* Timestamp di kanan bawah bubble */}
                    <Text style={styles.timestampText}>{formatChatTime(item.createdAt)}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* ─── E. REPLYING PREVIEW BAR ─── */}
        {replyingTo && (
          <View style={styles.replyingBar}>
            <View style={styles.replyingBarLeft}>
              <AppIcon name="reply" size={16} color="#38BDF8" />
              <View style={{ flex: 1 }}>
                <Text style={styles.replyingTargetName} numberOfLines={1}>
                  Membalas {replyingTo.senderName}
                </Text>
                <Text style={styles.replyingTextSnippet} numberOfLines={1}>
                  {replyingTo.message}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setReplyingTo(null)}
              hitSlop={8}
              style={styles.replyingCloseBtn}
            >
              <AppIcon name="close" size={16} color="#94A3B8" />
            </Pressable>
          </View>
        )}

        {/* ─── F. INPUT BAR (PERSIS SCREENSHOT: COUNTER 0/255 & TOMBOL SEND BULAT) ─── */}
        <View style={styles.inputContainer}>
          {/* Character Counter */}
          <Text style={styles.charCounterText}>{inputText.length}/255</Text>

          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Silakan masukkan pesan..."
              placeholderTextColor="#64748B"
              value={inputText}
              onChangeText={setInputText}
              maxLength={255}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kirim pesan"
              onPress={handleSendMessage}
              disabled={sending || !inputText.trim()}
              style={({ pressed }) => [
                styles.sendBtn,
                (!inputText.trim() || sending) && styles.sendBtnDisabled,
                pressed && styles.btnPressed,
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <AppIcon name="send" size={17} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ─── G. BOTTOM NAVIGATION (GLOBAL | CLAN | TEMAN) (PERSIS SCREENSHOT) ─── */}
      <View style={[styles.bottomNavContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {/* Tab Global */}
        <Pressable
          accessibilityRole="tab"
          onPress={() => handleBottomTabPress("global")}
          style={styles.bottomNavItem}
        >
          {bottomNavTab === "global" && <View style={styles.activeTabIndicatorTop} />}
          <Text
            style={[
              styles.bottomNavText,
              bottomNavTab === "global" && styles.bottomNavTextActive,
            ]}
          >
            Global
          </Text>
        </Pressable>

        {/* Tab Clan */}
        <Pressable
          accessibilityRole="tab"
          onPress={() => handleBottomTabPress("clan")}
          style={styles.bottomNavItem}
        >
          {bottomNavTab === "clan" && <View style={styles.activeTabIndicatorTop} />}
          <Text
            style={[
              styles.bottomNavText,
              bottomNavTab === "clan" && styles.bottomNavTextActive,
            ]}
          >
            Clan
          </Text>
        </Pressable>

        {/* Tab Teman (Arahkan ke Fitur Pertemanan Nuenime /connections) */}
        <Pressable
          accessibilityRole="tab"
          onPress={() => handleBottomTabPress("teman")}
          style={styles.bottomNavItem}
        >
          <Text style={styles.bottomNavText}>Teman</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1115",
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1A202C",
    backgroundColor: "#0F1115",
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
  },
  headerRightSpacer: {
    width: 36,
  },

  // ─── WARNING BANNER ───
  warningBannerContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2B220B",
    borderWidth: 1,
    borderColor: "#4A3B18",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  warningBannerText: {
    fontSize: 12.5,
    color: "#D97706",
    fontWeight: "600",
    flex: 1,
  },

  // ─── ROOM PILLS ───
  roomPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  roomPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#161B24",
    borderWidth: 1,
    borderColor: "#222D3D",
  },
  roomPillActive: {
    borderColor: "#0284C7",
    backgroundColor: "rgba(2, 132, 199, 0.15)",
  },
  roomPillHash: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  roomPillHashActive: {
    color: "#38BDF8",
  },
  roomPillLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#94A3B8",
  },
  roomPillLabelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  // ─── MESSAGE FEED ───
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 10,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  messageListContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  avatarWrap: {
    paddingTop: 2,
  },
  bubbleCol: {
    flex: 1,
    maxWidth: "88%",
  },
  messageCard: {
    backgroundColor: "#171B24",
    borderWidth: 1,
    borderColor: "#222A38",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageCardPressed: {
    backgroundColor: "#1C212D",
  },

  // ─── SENDER HEADER ROW ───
  senderHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  senderNameText: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  memberTagText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },

  // ─── BADGES ROW ───
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  rankTierPill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rankTierText: {
    fontFamily: "Nunito-Black",
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1E2636",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 7,
  },
  tierPillIcon: {
    width: 13,
    height: 13,
  },
  levelPillText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#38BDF8",
  },

  // ─── REPLY QUOTE BOX ───
  quoteBox: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 6,
    gap: 6,
  },
  quoteAccentLine: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "#10B981",
  },
  quoteContent: {
    flex: 1,
  },
  quoteHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  quoteSenderName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A7F3D0",
  },
  quoteMemberNumber: {
    fontSize: 10,
    color: "#64748B",
  },
  quoteText: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },

  // ─── MESSAGE TEXT & TIMESTAMP ───
  messageText: {
    fontSize: 13.5,
    color: "#F1F5F9",
    lineHeight: 19,
  },
  timestampText: {
    fontSize: 10,
    color: "#64748B",
    alignSelf: "flex-end",
    marginTop: 2,
    marginRight: 2,
  },

  // ─── REPLYING BAR ───
  replyingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#131A26",
    borderTopWidth: 1,
    borderTopColor: "#1E2738",
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  replyingBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  replyingTargetName: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#38BDF8",
  },
  replyingTextSnippet: {
    fontSize: 11,
    color: "#94A3B8",
  },
  replyingCloseBtn: {
    padding: 4,
  },

  // ─── INPUT BAR (PERSIS SCREENSHOT) ───
  inputContainer: {
    backgroundColor: "#0F1115",
    borderTopWidth: 1,
    borderTopColor: "#1A202C",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  charCounterText: {
    alignSelf: "flex-end",
    fontSize: 10,
    color: "#64748B",
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#161B24",
    borderWidth: 1,
    borderColor: "#222D3D",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 13.5,
    color: "#FFFFFF",
    maxHeight: 90,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#1E293B",
    opacity: 0.6,
  },

  // ─── BOTTOM NAVIGATION (GLOBAL | CLAN | TEMAN) (PERSIS SCREENSHOT) ───
  bottomNavContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#0F1115",
    borderTopWidth: 1,
    borderTopColor: "#1A202C",
    paddingTop: 8,
  },
  bottomNavItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 18,
    position: "relative",
  },
  activeTabIndicatorTop: {
    position: "absolute",
    top: -8,
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#0284C7",
  },
  bottomNavText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#64748B",
  },
  bottomNavTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
