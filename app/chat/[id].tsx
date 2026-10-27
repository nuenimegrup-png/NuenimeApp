import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { AppIcon } from "@/components/app-icon";
import { BorderAvatar } from "@/components/border-avatar";
import { useAnirakuAuth } from "@/providers/auth-provider";
import {
  type PrivateMessage,
  getPrivateMessages,
  sendPrivateMessage,
  subscribePrivateMessages,
  setActiveChatPartner,
} from "@/lib/private-chat-service";
import { getPublicUserProfile, type FriendUser } from "@/lib/friends-service";
import { isSpecialRole } from "@/lib/admin-service";
import { UserVerificationBadge } from "@/components/user-verification-badge";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { filterAndCensorMessage } from "@/lib/word-filter";
import { checkChatCooldown, CHAT_COOLDOWN_SECONDS } from "@/lib/security-defense";

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

  const insets = useSafeAreaInsets();
  const [friend, setFriend] = useState<FriendUser | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const isNearBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const isUserInteractingRef = useRef(false);
  const userHasScrolledUpRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldownTimer = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    setCooldownRemaining(seconds);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Tandai partner chat yang aktif dibuka agar notifikasi tidak membunyikan HP saat sedang membaca chat ini
  useEffect(() => {
    if (id) {
      setActiveChatPartner(id);
    }
    return () => {
      setActiveChatPartner(null);
    };
  }, [id]);

  // Listener keyboard agar bottom bar naik dengan mulus di atas software keyboard
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardOpen(true);
      if (isNearBottomRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardOpen(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  // Cek sisa cooldown saat layar chat dibuka
  useEffect(() => {
    if (!currentUserId || currentUserId === "guest") return;
    void checkChatCooldown(currentUserId).then((res) => {
      if (!res.allowed && res.remainingSeconds > 0) {
        startCooldownTimer(res.remainingSeconds);
      }
    });
  }, [currentUserId, startCooldownTimer]);

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

  // Saat pertama kali buka layar ATAU saat masuk kembali setelah keluar chat
  useFocusEffect(
    useCallback(() => {
      userHasScrolledUpRef.current = false;
      isInitialLoadRef.current = true;
      isNearBottomRef.current = true;
      isUserInteractingRef.current = false;
      void loadChat();

      const t1 = setTimeout(() => {
        if (!userHasScrolledUpRef.current && !isUserInteractingRef.current) {
          flatListRef.current?.scrollToEnd({ animated: false });
        }
      }, 60);
      const t2 = setTimeout(() => {
        if (!userHasScrolledUpRef.current && !isUserInteractingRef.current) {
          flatListRef.current?.scrollToEnd({ animated: false });
        }
      }, 180);
      const t3 = setTimeout(() => {
        if (!userHasScrolledUpRef.current && !isUserInteractingRef.current) {
          flatListRef.current?.scrollToEnd({ animated: false });
        }
      }, 350);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }, [loadChat])
  );

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!currentUserId || !id) return;

    const unsubscribe = subscribePrivateMessages(currentUserId, id, (newMsg) => {
      setMessages((prev) => {
        // Jika ID pesan sudah ada dalam list, jangan tambahkan lagi
        if (prev.some((m) => m.id === newMsg.id)) return prev;

        // Jika pesan ini dikirim oleh user sendiri dan ada optimistic message sementara (temp_*)
        if (newMsg.senderId === currentUserId) {
          const tempIdx = prev.findIndex((m) => m.id.startsWith("temp_") && m.message === newMsg.message);
          if (tempIdx !== -1) {
            const copy = [...prev];
            copy[tempIdx] = newMsg;
            return copy;
          }
        }

        const updated = [...prev, newMsg];
        // JAGA MEMORI: Batasi riwayat pesan aktif di RAM maksimal 100 agar hemat memori
        if (updated.length > 100) {
          return updated.slice(updated.length - 100);
        }
        return updated;
      });

      // Kalo ada pesan baru masuk, otomatis scroll ke paling bawah!
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 60);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUserId, id]);

  // Handle Send Message
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !currentUserId || !id || sending || cooldownRemaining > 0) return;

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
    userHasScrolledUpRef.current = false;
    isNearBottomRef.current = true;
    isInitialLoadRef.current = false;
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

    if (res.isBanned) {
      // Buang optimistic message jika akun diblokir
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      await auth.refreshProfile();
      Alert.alert(
        "AKUN DIBLOKIR",
        res.error || "Akun Anda telah DIBLOKIR permanen!"
      );
      return;
    }

    if (res.warning) {
      Alert.alert("Peringatan Keamanan", res.warning);
    }

    if (res.success && res.data) {
      hapticSuccess();
      startCooldownTimer(CHAT_COOLDOWN_SECONDS);
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
    } else if (!res.success && res.error) {
      // Buang optimistic message jika pengiriman gagal
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      const matchSeconds = res.error.match(/tunggu\s+(\d+)\s+detik/i);
      if (matchSeconds && matchSeconds[1]) {
        startCooldownTimer(Number(matchSeconds[1]));
      }
      Alert.alert("Pesan Gagal Terkirim", res.error);
    }
  };

  const renderMessageItem = useCallback(({ item }: { item: PrivateMessage }) => {
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
  }, [currentUserId]);

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
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
                <UserVerificationBadge role={friend.role} isVip={friend.isVip} size={14} />
                <Text style={styles.headerMemberTag}>
                  #{String(friend.memberNumber).replace(/[^0-9]/g, "").replace(/^0+/, "") || "1"}
                </Text>
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
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
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
            showsVerticalScrollIndicator={false}
            initialNumToRender={25}
            maxToRenderPerBatch={15}
            windowSize={7}
            removeClippedSubviews={Platform.OS !== "web"}
            onContentSizeChange={() => {
              // Hanya posisikan ke bawah saat pertama masuk (sebelum user scroll manual)
              if (isInitialLoadRef.current && !userHasScrolledUpRef.current && !isUserInteractingRef.current) {
                flatListRef.current?.scrollToEnd({ animated: false });
                isInitialLoadRef.current = false;
              }
            }}
            onScrollBeginDrag={() => {
              isUserInteractingRef.current = true;
              userHasScrolledUpRef.current = true;
            }}
            onScrollEndDrag={() => {
              isUserInteractingRef.current = false;
            }}
            onMomentumScrollBegin={() => {
              isUserInteractingRef.current = true;
              userHasScrolledUpRef.current = true;
            }}
            onMomentumScrollEnd={() => {
              isUserInteractingRef.current = false;
            }}
            onScroll={(e) => {
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
              const isAtBottom = distanceFromBottom <= 40;
              isNearBottomRef.current = isAtBottom;

              // Jika menjauh dari dasar bawah, pastikan status terkunci
              if (distanceFromBottom > 40) {
                userHasScrolledUpRef.current = true;
              }

              // Hanya buka kembali auto-scroll jika user sengaja scroll kembali sampai menyentuh dasar paling bawah
              if (isAtBottom && isUserInteractingRef.current) {
                userHasScrolledUpRef.current = false;
              }
            }}
            scrollEventThrottle={16}
            renderItem={renderMessageItem}
          />
        )}

        {/* ─── 3. BOTTOM INPUT BAR ─── */}
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: keyboardOpen ? 8 : Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View style={styles.inputWrap}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={cooldownRemaining > 0 ? `Tunggu ${cooldownRemaining} detik...` : "Ketik pesan..."}
              placeholderTextColor="#64748B"
              style={styles.textInput}
              multiline
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
          </View>

          <Pressable
            disabled={!inputText.trim() || sending || cooldownRemaining > 0}
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendBtn,
              inputText.trim() && cooldownRemaining === 0 ? styles.sendBtnActive : styles.sendBtnInactive,
              cooldownRemaining > 0 && styles.sendBtnCooldown,
              pressed && styles.btnPressed,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#0B0E14" />
            ) : cooldownRemaining > 0 ? (
              <Text style={styles.sendBtnCooldownText}>{cooldownRemaining}s</Text>
            ) : (
              <AppIcon
                name="send"
                size={18}
                color={inputText.trim() ? "#0B0E14" : "#64748B"}
              />
            )}
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
  sendBtnCooldown: {
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.45)",
  },
  sendBtnCooldownText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    fontWeight: "800",
    color: "#F59E0B",
  },
});
