import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { AppIcon } from "@/components/app-icon";
import { BorderAvatar } from "@/components/border-avatar";
import { useAnirakuAuth } from "@/providers/auth-provider";
import {
  type PrivateMessage,
  getPrivateMessages,
  sendPrivateMessage,
  subscribePrivateMessages,
} from "@/lib/private-chat-service";
import { getPublicUserProfile, type FriendUser } from "@/lib/friends-service";
import { isSpecialRole } from "@/lib/admin-service";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { filterAndCensorMessage } from "@/lib/word-filter";

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

export default function PrivateChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAnirakuAuth();
  const currentUserId = auth.user?.id;

  const [friend, setFriend] = useState<FriendUser | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Load friend profile and chat messages
  const loadChat = useCallback(async () => {
    if (!id || !currentUserId) return;
    setLoading(true);
    try {
      const [fProfile, historyMsgs] = await Promise.all([
        getPublicUserProfile(id),
        getPrivateMessages(currentUserId, id),
      ]);
      setFriend(fProfile);
      // Pastikan tidak ada pesan duplikat dari cache maupun database
      const seen = new Set<string>();
      const unique = (historyMsgs || []).filter((m) => {
        if (!m?.id || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      setMessages(unique);
    } catch (err) {
      console.warn("[private-chat-screen] loadChat error:", err);
    } finally {
      setLoading(false);
    }
  }, [id, currentUserId]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!currentUserId || !id) return;

    const unsubscribe = subscribePrivateMessages(currentUserId, id, (newMsg) => {
      setMessages((prev) => {
        // Jika ID pesan sudah ada dalam list, jangan tambahkan lagi
        if (prev.some((m) => m.id === newMsg.id)) return prev;

        // Jika pesan ini dikirim oleh user sendiri dan ada optimistic message sementara (temp_*)
        if (newMsg.senderId === currentUserId) {
          const tempIdx = prev.findIndex((m) => m.id.startsWith("temp_"));
          if (tempIdx !== -1) {
            const copy = [...prev];
            copy[tempIdx] = newMsg;
            return copy;
          }
        }

        return [...prev, newMsg];
      });
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUserId, id]);

  // Handle Send Message
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !currentUserId || !id || sending) return;

    hapticLight();
    setSending(true);
    setInputText("");

    // Filter otomatis kata terlarang secara realtime
    const filterRes = filterAndCensorMessage(text);
    const textToSend = filterRes.processedText;

    // Optimistic message
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: PrivateMessage = {
      id: tempId,
      senderId: currentUserId,
      receiverId: id,
      message: textToSend,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    const res = await sendPrivateMessage(
      currentUserId,
      id,
      text,
      auth.profile?.display_name || auth.profile?.username
    );

    setSending(false);
    if (res.success && res.data) {
      hapticSuccess();
      const serverMsg = res.data;
      setMessages((prev) => {
        // Cek apakah pesan server ini sudah dimasukkan duluan oleh WebSocket Realtime
        const alreadyExists = prev.some((m) => m.id === serverMsg.id);
        if (alreadyExists) {
          // Buang saja tempId agar tidak terjadi duplikasi key
          return prev.filter((m) => m.id !== tempId);
        }
        // Gantikan tempId dengan data resmi dari server
        return prev.map((m) => (m.id === tempId ? serverMsg : m));
      });
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
      {/* ─── 1. TOP HEADER (PERSIS SCREENSHOT 1) ─── */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerBackBtn, pressed && styles.btnPressed]}
        >
          <AppIcon name="arrow-left" size={22} color="#FFFFFF" />
        </Pressable>

        {friend ? (
          <Pressable
            onPress={() => router.push(`/user/${friend.id}` as never)}
            style={styles.headerFriendInfo}
          >
            <View style={styles.avatarWrap}>
              <BorderAvatar
                size={38}
                borderId={friend.equippedBorder}
                avatarUrl={friend.avatarUrl || "https://images.alphacoders.com/132/1328004.png"}
              />
            </View>
            <View style={styles.headerTextCol}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Text style={styles.headerFriendName} numberOfLines={1}>
                  {friend.displayName}
                </Text>
                <Text style={styles.headerMemberTag}>
                  #{String(friend.memberNumber).replace(/[^0-9]/g, "").replace(/^0+/, "") || "1"}
                </Text>
                <AppIcon
                  name={isSpecialRole(friend.role) ? "check-decagram" : "check-circle"}
                  size={14}
                  color={isSpecialRole(friend.role) ? "#EF4444" : "#38BDF8"}
                />
              </View>
              <Text style={styles.headerSubtitle}>Chat pribadi</Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.headerTextCol}>
            <Text style={styles.headerFriendName}>Memuat...</Text>
          </View>
        )}
      </View>

      {/* ─── 2. CHAT MESSAGES BODY ─── */}
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#38BDF8" />
          </View>
        ) : messages.length === 0 ? (
          /* EMPTY STATE (PERSIS SCREENSHOT 1) */
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Belum ada pesan</Text>
            <Text style={styles.emptySubtitle}>
              Mulai obrolan dengan mengirim pesan pertamamu.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => `${item.id}_${index}`}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const isMine = item.senderId === currentUserId;
              const isCensored = item.message.includes("[Pesan mengandung kata terlarang]");

              return (
                <View
                  style={[
                    styles.messageRow,
                    isMine ? styles.messageRowMine : styles.messageRowOther,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isMine ? styles.bubbleMine : styles.bubbleOther,
                      isCensored && {
                        backgroundColor: isMine ? "rgba(239, 68, 68, 0.18)" : "rgba(239, 68, 68, 0.14)",
                        borderColor: "rgba(239, 68, 68, 0.35)",
                        borderWidth: 1,
                      },
                    ]}
                  >
                    {isCensored ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <AppIcon name="shield-alert-outline" size={13} color="#F87171" />
                        <Text
                          style={[
                            styles.messageText,
                            { color: "#FCA5A5", fontStyle: "italic", fontSize: 12.5 },
                          ]}
                        >
                          {item.message}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.messageText}>{item.message}</Text>
                    )}
                    <Text style={styles.messageTimeText}>{formatChatTime(item.createdAt)}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* ─── 3. BOTTOM INPUT BAR (PERSIS SCREENSHOT 1) ─── */}
        <View style={styles.bottomBar}>
          <View style={styles.inputWrap}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ketik pesan..."
              placeholderTextColor="#64748B"
              style={styles.textInput}
              multiline
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
          </View>

          <Pressable
            disabled={!inputText.trim() || sending}
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendBtn,
              inputText.trim() ? styles.sendBtnActive : styles.sendBtnInactive,
              pressed && styles.btnPressed,
            ]}
          >
            <AppIcon
              name="send"
              size={18}
              color={inputText.trim() ? "#0B0E14" : "#64748B"}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E14",
  },
  btnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  keyboardContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── HEADER ───
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#0B0E14",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  headerBackBtn: {
    padding: 6,
    borderRadius: 8,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  headerFriendInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextCol: {
    flex: 1,
    gap: 1,
  },
  headerFriendName: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  headerMemberTag: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#64748B",
  },
  headerSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
  },

  // ─── EMPTY STATE (PERSIS SCREENSHOT 1) ───
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },

  // ─── MESSAGE LIST & BUBBLES ───
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 2,
  },
  messageRowMine: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    gap: 4,
  },
  bubbleMine: {
    backgroundColor: "#1E293B",
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  bubbleOther: {
    backgroundColor: "#161B26",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  messageText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13.5,
    color: "#FFFFFF",
    lineHeight: 19,
  },
  messageTimeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#64748B",
    alignSelf: "flex-end",
  },

  // ─── BOTTOM INPUT BAR ───
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "#0B0E14",
  },
  inputWrap: {
    flex: 1,
    backgroundColor: "#161B26",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    maxHeight: 100,
  },
  textInput: {
    fontFamily: "Nunito-Regular",
    fontSize: 13.5,
    color: "#FFFFFF",
    padding: 0,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnActive: {
    backgroundColor: "#38BDF8",
    shadowColor: "#38BDF8",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnInactive: {
    backgroundColor: "#161B26",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
});
