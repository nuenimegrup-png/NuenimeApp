import React, { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle } from "react";
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
import { router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";

import { AppIcon } from "@/components/app-icon";
import { ChibiLoading } from "@/components/chibi-loading";
import { BorderAvatar } from "@/components/border-avatar";
import { UserVerificationBadge } from "@/components/user-verification-badge";
import { getTierForLevel } from "@/components/level-progress-modal";
import { ProfileCityPlaque } from "@/components/profile-city-plaque";
import { ChatStickerPicker } from "@/components/chat-sticker-picker";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { getEquippedBorderId } from "@/lib/avatar-borders";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  type GlobalRoom,
  type GlobalChatMessage,
  type GlobalChatReplyInfo,
  GLOBAL_ROOMS,
  getGlobalMessages,
  sendGlobalMessage,
  subscribeGlobalMessages,
  purgeGlobalChatMockCache,
} from "@/lib/global-chat-service";
import {
  isStickerMessage,
  extractStickerUrl,
  formatStickerMessage,
  preloadChatStickers,
  type ChatSticker,
} from "@/lib/chat-stickers";
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

interface ChatMessageItemProps {
  item: GlobalChatMessage;
  isHighlighted: boolean;
  onReply: (msg: GlobalChatMessage) => void;
  onQuotePress: (replyInfo?: GlobalChatReplyInfo | null) => void;
}

const ChatMessageItem = React.memo(
  function ChatMessageItem({
    item,
    isHighlighted,
    onReply,
    onQuotePress,
  }: ChatMessageItemProps) {
    const tierInfo = useMemo(() => getTierForLevel(item.senderLevel || 1), [item.senderLevel]);
    const activeTier = tierInfo?.currentTier;
    const nameColor = useMemo(() => getUsernameColor(item.senderName), [item.senderName]);
    const tierPillColors = useMemo(
      () => getTierPillColors(activeTier?.name || "Stone"),
      [activeTier?.name]
    );
    const isSticker = isStickerMessage(item.message);
    const stickerUrl = isSticker ? extractStickerUrl(item.message) : null;

    const handlePressAvatar = useCallback(() => {
      hapticLight();
      router.push(`/user/${item.senderId}` as never);
    }, [item.senderId]);

    const handleLongPressCard = useCallback(() => {
      onReply(item);
    }, [onReply, item]);

    const handleQuotePress = useCallback(() => {
      onQuotePress(item.replyTo);
    }, [onQuotePress, item.replyTo]);

    return (
      <View
        key={item.id}
        // @ts-ignore
        id={Platform.OS === "web" ? `chat-msg-${item.id}` : undefined}
        nativeID={`chat-msg-${item.id}`}
        style={[
          styles.messageRow,
          isHighlighted && styles.messageRowHighlighted,
        ]}
      >
        {/* Left Avatar with live border */}
        <Pressable onPress={handlePressAvatar} style={styles.avatarWrap}>
          <BorderAvatar
            size={32}
            borderId={item.senderBorder}
            avatarUrl={item.senderAvatar || "https://images.alphacoders.com/132/1328004.png"}
          />
        </Pressable>

        {/* Right Bubble Content */}
        <View style={styles.bubbleCol}>
          <Pressable
            onLongPress={handleLongPressCard}
            delayLongPress={250}
            style={({ pressed }) => [
              styles.messageCard,
              isSticker && styles.messageCardSticker,
              isHighlighted && styles.messageCardHighlighted,
              pressed && styles.messageCardPressed,
            ]}
          >
            {/* 1. Header: Display Name + Verification Checkmark + Member Tag */}
            <View style={styles.senderHeaderRow}>
              <Pressable onPress={handlePressAvatar}>
                <Text style={[styles.senderNameText, { color: nameColor }]} numberOfLines={1}>
                  {item.senderName}
                </Text>
              </Pressable>

              <UserVerificationBadge
                role={item.senderRole}
                isVip={item.senderIsVip}
                size={13}
              />

              <Text style={styles.memberTagText}>{item.senderMemberNumber}</Text>
            </View>

            {/* 2. Plakat Kota & Klan (DRAKONIA / GELANDANGAN, tanpa banner) */}
            <View style={styles.cityClanRow}>
              <ProfileCityPlaque
                userId={item.senderId}
                compact
                inlineClan
              />
            </View>

            {/* 3. Badges Row: Rank Tier Pill + Level Pill */}
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
                  <Text style={[styles.rankTierText, { color: tierPillColors.text }]}>
                    {activeTier.name.toUpperCase()}
                  </Text>
                </View>
              ) : null}

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
                  Lvl {Number(item.senderLevel || 1).toLocaleString("id-ID")}
                </Text>
              </View>
            </View>

            {/* 4. Reply Quote Box */}
            {item.replyTo && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Menuju pesan yang dikutip dari ${item.replyTo.senderName}`}
                onPress={handleQuotePress}
                style={({ pressed }) => [
                  styles.quoteBox,
                  pressed && styles.quoteBoxPressed,
                  Platform.OS === "web" && ({ cursor: "pointer" } as any),
                ]}
              >
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
                    <AppIcon
                      name="arrow-up"
                      size={12}
                      color="#38BDF8"
                      style={{ marginLeft: "auto" }}
                    />
                  </View>
                  <Text style={styles.quoteText} numberOfLines={1}>
                    {isStickerMessage(item.replyTo.text) ? "🎨 [Stiker]" : item.replyTo.text}
                  </Text>
                </View>
              </Pressable>
            )}

            {/* 5. Isi Pesan atau Tampilan Stiker */}
            {isSticker && stickerUrl ? (
              <View style={styles.stickerMessageWrap}>
                <Image
                  source={{ uri: stickerUrl }}
                  style={styles.stickerMessageImage}
                  contentFit="contain"
                  transition={0}
                  cachePolicy="memory-disk"
                  priority="high"
                />
              </View>
            ) : (
              <Text style={styles.messageText}>{item.message}</Text>
            )}
          </Pressable>

          <Text style={styles.timestampText}>{formatChatTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  },
  (prev, next) => {
    return (
      prev.item.id === next.item.id &&
      prev.isHighlighted === next.isHighlighted &&
      prev.item.message === next.item.message &&
      prev.item.senderLevel === next.item.senderLevel &&
      prev.item.senderAvatar === next.item.senderAvatar &&
      prev.item.senderBorder === next.item.senderBorder &&
      prev.item.senderRole === next.item.senderRole &&
      prev.item.senderIsVip === next.item.senderIsVip &&
      prev.onReply === next.onReply &&
      prev.onQuotePress === next.onQuotePress
    );
  }
);

interface ChatInputBarProps {
  cooldownRemaining: number;
  keyboardVisible: boolean;
  bottomPadding: number;
  sending: boolean;
  showStickerPicker: boolean;
  onToggleStickerPicker: () => void;
  onFocusInput: () => void;
  onSend: (text: string) => Promise<boolean>;
}

export interface ChatInputBarRef {
  focus: () => void;
  setText: (text: string) => void;
  clear: () => void;
}

const ChatInputBar = React.memo(
  React.forwardRef<ChatInputBarRef, ChatInputBarProps>(function ChatInputBar(
    {
      cooldownRemaining,
      bottomPadding,
      sending,
      showStickerPicker,
      onToggleStickerPicker,
      onFocusInput,
      onSend,
    },
    ref
  ) {
    const [text, setText] = useState("");
    const internalInputRef = useRef<TextInput>(null);

    useImperativeHandle(ref, () => ({
      focus: () => internalInputRef.current?.focus(),
      setText: (val: string) => setText(val),
      clear: () => setText(""),
    }));

    const handleSendPress = async () => {
      const trimmed = text.trim();
      if (!trimmed || sending || cooldownRemaining > 0) return;
      const success = await onSend(trimmed);
      if (success) {
        setText("");
      }
    };

    const hasContent = text.trim().length > 0;
    const canSend = hasContent && !sending && cooldownRemaining <= 0;

    return (
      <View style={[styles.inputContainer, { paddingBottom: bottomPadding }]}>
        {/* Metadata Row: Detik Cooldown & Counter Karakter 0/255 */}
        <View style={styles.inputMetaRow}>
          {cooldownRemaining > 0 ? (
            <View style={styles.cooldownBadge}>
              <AppIcon name="timer-outline" size={12} color="#F59E0B" />
              <Text style={styles.cooldownBadgeText}>Jeda chat: {cooldownRemaining}s</Text>
            </View>
          ) : (
            <View />
          )}
          <Text style={styles.charCounterText}>{text.length}/255</Text>
        </View>

        <View style={styles.inputRow}>
          {/* Tombol Buka Panel Stiker */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka panel stiker"
            onPress={onToggleStickerPicker}
            hitSlop={6}
            style={({ pressed }) => [
              styles.stickerToggleBtn,
              showStickerPicker && styles.stickerToggleBtnActive,
              pressed && styles.btnPressed,
            ]}
          >
            <AppIcon
              name="emoticon-happy-outline"
              size={22}
              color={showStickerPicker ? "#38BDF8" : "#94A3B8"}
            />
          </Pressable>

          <TextInput
            ref={internalInputRef}
            style={styles.textInput}
            placeholder={
              cooldownRemaining > 0
                ? `Tunggu ${cooldownRemaining} detik...`
                : "Silakan masukkan pesan..."
            }
            placeholderTextColor="#64748B"
            value={text}
            onChangeText={setText}
            onFocus={onFocusInput}
            maxLength={255}
            multiline
            blurOnSubmit={false}
            returnKeyType="send"
            onSubmitEditing={() => {
              void handleSendPress();
            }}
          />

          {/* Tombol Kirim */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kirim pesan"
            onPress={handleSendPress}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendBtn,
              !canSend && styles.sendBtnDisabled,
              pressed && styles.btnPressed,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : cooldownRemaining > 0 ? (
              <Text style={styles.sendBtnCooldownText}>{cooldownRemaining}s</Text>
            ) : (
              <AppIcon name="send" size={17} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </View>
    );
  })
);

export default function ChatGlobalScreen() {
  const auth = useAnirakuAuth();
  const insets = useSafeAreaInsets();
  const currentUserId = auth.user?.id;

  const [activeRoom, setActiveRoom] = useState<GlobalRoom>("ngobrol_1");
  const [messages, setMessages] = useState<GlobalChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<GlobalChatMessage | null>(null);
  const [bottomNavTab, setBottomNavTab] = useState<"global" | "clan" | "teman">("global");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [showNewMessageBadge, setShowNewMessageBadge] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [unreadCountWhileScrolled, setUnreadCountWhileScrolled] = useState(0);
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<ChatInputBarRef>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isNearBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const isUserInteractingRef = useRef(false);
  const userHasScrolledUpRef = useRef(false);

  // ID pesan yang disorot saat tombol quote reply ditekan
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper scroll ke pesan paling akhir (andal di Web maupun Native)
  const scrollToLatest = useCallback((animated = false) => {
    if (flatListRef.current) {
      try {
        flatListRef.current.scrollToEnd({ animated });
      } catch {}
      if (Platform.OS === "web") {
        try {
          const ref = flatListRef.current as any;
          const node =
            ref?.getScrollableNode?.() ||
            ref?.getScrollResponder?.()?.getScrollableNode?.() ||
            ref?._listRef?._scrollRef?.getScrollableNode?.() ||
            ref?._scrollRef?.getScrollableNode?.() ||
            (typeof document !== "undefined"
              ? (document.querySelector('[data-testid="global-chat-list"]') as HTMLElement) ||
                (document.getElementById("global-chat-scroll-container") as HTMLElement)
              : null);
          if (node) {
            node.scrollTop = node.scrollHeight;
          }
        } catch {}
      }
    }
  }, []);

  const jumpToLatestMessages = useCallback(() => {
    hapticLight();
    setShowNewMessageBadge(false);
    setShowScrollBottomBtn(false);
    setUnreadCountWhileScrolled(0);
    userHasScrolledUpRef.current = false;
    isNearBottomRef.current = true;
    scrollToLatest(true);
  }, [scrollToLatest]);

  // Melompat ke pesan yang dibalas saat kotak kutipan ditekan
  const handleScrollToRepliedMessage = useCallback((replyInfo?: GlobalChatReplyInfo | null) => {
    if (!replyInfo) return;
    hapticLight();

    // 1. Cari berdasarkan ID pesan jika ada & valid
    let targetIndex = -1;
    if (replyInfo.id && replyInfo.id !== "reply") {
      targetIndex = messages.findIndex((m) => m.id === replyInfo.id);
    }

    // 2. Fallback: Cari berdasarkan pengirim dan cuplikan teks
    if (targetIndex === -1 && replyInfo.senderName) {
      const cleanSnippet = (replyInfo.text || "").trim();
      targetIndex = messages.findLastIndex((m) => {
        if (m.senderName !== replyInfo.senderName) return false;
        if (!cleanSnippet) return true;
        const mText = (m.message || "").trim();
        return mText === cleanSnippet || mText.includes(cleanSnippet) || cleanSnippet.includes(mText);
      });
    }

    if (targetIndex !== -1) {
      const targetMsg = messages[targetIndex];
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      setHighlightedMessageId(targetMsg.id);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2200);

      // Web: Scroll smooth ke elemen menggunakan DOM jika sudah ada di viewport
      if (Platform.OS === "web") {
        try {
          const el = document.getElementById(`chat-msg-${targetMsg.id}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
        } catch {}
      }

      // Native / Fallback Web: Scroll FlatList ke index yang dituju
      try {
        flatListRef.current?.scrollToIndex({
          index: targetIndex,
          animated: true,
          viewPosition: 0.5,
        });
      } catch {
        flatListRef.current?.scrollToOffset({
          offset: Math.max(0, targetIndex * 100),
          animated: true,
        });
      }

      // Web: Cek ulang setelah FlatList me-render item virtual
      if (Platform.OS === "web") {
        setTimeout(() => {
          const elAfter = document.getElementById(`chat-msg-${targetMsg.id}`);
          if (elAfter) {
            elAfter.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 120);
      }
    } else {
      Alert.alert(
        "Pesan Tidak Ditemukan",
        "Pesan yang dikutip sudah berada di luar batas riwayat pesan saat ini."
      );
    }
  }, [messages]);

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

  // ─── 0. PRELOAD & PRE-CACHE STIKER (AGAR DATA INSTAN 0ms SAAT DIBUKA) ───
  useEffect(() => {
    preloadChatStickers();
  }, []);

  // ─── 0. KEYBOARD LISTENER (AGAR INPUT NAIK TEPAT DI ATAS KEYBOARD) ───
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      if (isNearBottomRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 40);
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  // Cek sisa jeda waktu chat aktif saat layar dibuka
  useEffect(() => {
    if (!currentUserId || currentUserId === "guest") return;
    void checkChatCooldown(currentUserId).then((res) => {
      if (!res.allowed && res.remainingSeconds > 0) {
        startCooldownTimer(res.remainingSeconds);
      }
    });
  }, [currentUserId, startCooldownTimer]);

  const messagesLengthRef = useRef(messages.length);
  messagesLengthRef.current = messages.length;

  // ─── 1. LOAD PESAN ───
  const loadMessages = useCallback(async (isRefresh = false) => {
    if (!isRefresh && messagesLengthRef.current === 0) setLoading(true);
    else if (isRefresh) setRefreshing(true);

    try {
      const data = await getGlobalMessages(activeRoom);
      setMessages(data);
      // Posisikan seketika ke pesan paling baru saat data selesai dimuat
      userHasScrolledUpRef.current = false;
      isNearBottomRef.current = true;
      isInitialLoadRef.current = true;

      const performScroll = () => {
        if (!userHasScrolledUpRef.current && !isUserInteractingRef.current) {
          scrollToLatest(false);
        }
      };

      requestAnimationFrame(performScroll);
      setTimeout(performScroll, 25);
      setTimeout(performScroll, 75);
      setTimeout(performScroll, 180);
      setTimeout(performScroll, 400);
      setTimeout(performScroll, 800);
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 1200);
    } catch (err) {
      console.warn("[chat-global] load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeRoom, scrollToLatest]);

  // Saat pertama kali buka layar ATAU saat masuk kembali setelah keluar room / diskusi
  useFocusEffect(
    useCallback(() => {
      userHasScrolledUpRef.current = false;
      isInitialLoadRef.current = true;
      isNearBottomRef.current = true;
      isUserInteractingRef.current = false;
      setShowNewMessageBadge(false);
      setShowScrollBottomBtn(false);
      setUnreadCountWhileScrolled(0);
      void purgeGlobalChatMockCache();
      void loadMessages();

      const scrollIfInitial = () => {
        if (!userHasScrolledUpRef.current && !isUserInteractingRef.current) {
          scrollToLatest(false);
        }
      };

      const t1 = setTimeout(scrollIfInitial, 30);
      const t2 = setTimeout(scrollIfInitial, 100);
      const t3 = setTimeout(scrollIfInitial, 250);
      const t4 = setTimeout(scrollIfInitial, 500);
      const t5 = setTimeout(scrollIfInitial, 850);
      const tClose = setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 1400);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(t5);
        clearTimeout(tClose);
      };
    }, [loadMessages, scrollToLatest])
  );

  // Otomatis posisikan ke pesan paling akhir saat layar/room dibuka
  useEffect(() => {
    if (!loading && messages.length > 0 && !userHasScrolledUpRef.current) {
      scrollToLatest(false);
      const t1 = setTimeout(() => {
        if (!userHasScrolledUpRef.current && !isUserInteractingRef.current) scrollToLatest(false);
      }, 30);
      const t2 = setTimeout(() => {
        if (!userHasScrolledUpRef.current && !isUserInteractingRef.current) scrollToLatest(false);
      }, 120);
      const t3 = setTimeout(() => {
        if (!userHasScrolledUpRef.current && !isUserInteractingRef.current) scrollToLatest(false);
      }, 280);
      const t4 = setTimeout(() => {
        if (!userHasScrolledUpRef.current && !isUserInteractingRef.current) scrollToLatest(false);
      }, 600);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  }, [loading, activeRoom, messages.length, scrollToLatest]);

  // ─── 2. REALTIME SUBSCRIPTION ───
  useEffect(() => {
    const unsubscribe = subscribeGlobalMessages(activeRoom, (newMsg) => {
      setMessages((prev) => {
        // Hindari duplikasi pesan jika sudah masuk
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        const updated = [...prev, newMsg];
        // JAGA MEMORI: Batasi riwayat pesan aktif di RAM maksimal 100 agar ringan di HP RAM kecil
        if (updated.length > 100) {
          return updated.slice(updated.length - 100);
        }
        return updated;
      });

      // Kalo ada pesan baru masuk:
      // Pengguna berada tepat di paling bawah atau pesan sendiri -> scroll instan tanpa animasi
      // Pengguna sedang membaca pesan lama / tidak di paling bawah -> munculkan tombol panah bawah dengan badge
      const isMyMessage = newMsg.senderId === currentUserId;
      if (isMyMessage || (isNearBottomRef.current && !userHasScrolledUpRef.current)) {
        setShowNewMessageBadge(false);
        setShowScrollBottomBtn(false);
        setUnreadCountWhileScrolled(0);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 10);
      } else {
        setShowNewMessageBadge(true);
        setShowScrollBottomBtn(true);
        setUnreadCountWhileScrolled((prev) => prev + 1);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeRoom, currentUserId]);

  // ─── 3. SEND MESSAGE ───
  const handleSendMessage = useCallback(
    async (textOverride?: string): Promise<boolean> => {
      const textToSend = (textOverride || "").trim();
      if (!textToSend || sending || cooldownRemaining > 0) return false;

      if (!currentUserId || currentUserId === "guest") {
        hapticWarning();
        router.push("/auth" as never);
        return false;
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
        return false;
      }

      if (res.warning) {
        Alert.alert("Peringatan Keamanan", res.warning);
      }

      if (res.success && res.data) {
        hapticSuccess();
        setReplyingTo(null);

        // Mulai jeda countdown 30 detik setelah berhasil mengirim pesan
        startCooldownTimer(CHAT_COOLDOWN_SECONDS);

        // Tambahkan ke UI lokal seketika jika belum ada
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data!.id)) return prev;
          return [...prev, res.data!];
        });

        setShowNewMessageBadge(false);
        setShowScrollBottomBtn(false);
        setUnreadCountWhileScrolled(0);
        userHasScrolledUpRef.current = false;
        isNearBottomRef.current = true;
        isInitialLoadRef.current = false;
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 10);
        return true;
      } else if (!res.success && res.error) {
        hapticWarning();
        // Jika error terkait jeda waktu, ekstrak detiknya dan mulai timer
        const matchSeconds = res.error.match(/tunggu\s+(\d+)\s+detik/i);
        if (matchSeconds && matchSeconds[1]) {
          startCooldownTimer(Number(matchSeconds[1]));
        }
        Alert.alert("Pesan Gagal Terkirim", res.error);
      }
      return false;
    },
    [
      sending,
      cooldownRemaining,
      currentUserId,
      auth,
      activeRoom,
      replyingTo,
      startCooldownTimer,
    ]
  );

  // ─── 3b. SEND STICKER ───
  const handleSendSticker = async (sticker: ChatSticker) => {
    if (sending || cooldownRemaining > 0) return;

    if (!currentUserId || currentUserId === "guest") {
      hapticWarning();
      router.push("/auth" as never);
      return;
    }

    setSending(true);
    hapticLight();

    const senderProfile = auth.profile;
    const equippedBorder = await getEquippedBorderId(currentUserId);
    const formattedStickerMsg = formatStickerMessage(sticker);

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
      message: formattedStickerMsg,
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
      setReplyingTo(null);

      // Mulai jeda countdown 30 detik setelah berhasil mengirim stiker
      startCooldownTimer(CHAT_COOLDOWN_SECONDS);

      // Tambahkan ke UI lokal seketika jika belum ada
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data!.id)) return prev;
        return [...prev, res.data!];
      });

      setShowNewMessageBadge(false);
      setShowScrollBottomBtn(false);
      setUnreadCountWhileScrolled(0);
      userHasScrolledUpRef.current = false;
      isNearBottomRef.current = true;
      isInitialLoadRef.current = false;
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 10);
    } else if (!res.success && res.error) {
      hapticWarning();
      const matchSeconds = res.error.match(/tunggu\s+(\d+)\s+detik/i);
      if (matchSeconds && matchSeconds[1]) {
        startCooldownTimer(Number(matchSeconds[1]));
      }
      Alert.alert("Stiker Gagal Terkirim", res.error);
    }
  };

  // ─── 4. REPLY MESSAGE ───
  const handleReplyMessage = useCallback((msg: GlobalChatMessage) => {
    hapticLight();
    setReplyingTo(msg);
    inputRef.current?.focus();
  }, []);

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

  const renderMessageItem = useCallback(
    ({ item }: { item: GlobalChatMessage }) => (
      <ChatMessageItem
        item={item}
        isHighlighted={highlightedMessageId === item.id}
        onReply={handleReplyMessage}
        onQuotePress={handleScrollToRepliedMessage}
      />
    ),
    [highlightedMessageId, handleReplyMessage, handleScrollToRepliedMessage]
  );

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

      {/* ─── B. WARNING BANNER ─── */}
      <View style={styles.warningBannerContainer}>
        <View style={styles.warningBanner}>
          <AppIcon name="alert" size={16} color="#F59E0B" />
          <Text style={styles.warningBannerText}>
            Dilarang toksik atau spam, akan otomatis terblokir
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
                userHasScrolledUpRef.current = false;
                isInitialLoadRef.current = true;
                isNearBottomRef.current = true;
                isUserInteractingRef.current = false;
                setShowNewMessageBadge(false);
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
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <View style={styles.chatFeedContainer}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ChibiLoading size={76} style={{ marginBottom: 12 }} />
              <Text style={styles.loadingText}>Memuat percakapan global...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              extraData={highlightedMessageId}
              style={{ flex: 1 }}
              contentContainerStyle={styles.messageListContent}
              showsVerticalScrollIndicator={false}
              testID="global-chat-list"
              nativeID="global-chat-scroll-container"
              initialNumToRender={20}
              maxToRenderPerBatch={8}
              windowSize={5}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews={Platform.OS !== "web"}
              onScrollToIndexFailed={(info) => {
                flatListRef.current?.scrollToOffset({
                  offset: Math.max(0, info.averageItemLength * info.index),
                  animated: true,
                });
              }}
              onLayout={() => {
                if (!userHasScrolledUpRef.current && !isUserInteractingRef.current) {
                  scrollToLatest(false);
                }
              }}
              onContentSizeChange={(_w, h) => {
                // Posisikan ke bawah seketika saat pertama kali layar dibuka (sebelum user scroll manual)
                if (h > 0 && !userHasScrolledUpRef.current && !isUserInteractingRef.current) {
                  scrollToLatest(false);
                  requestAnimationFrame(() => scrollToLatest(false));
                }
              }}
              onScrollBeginDrag={() => {
                isUserInteractingRef.current = true;
                userHasScrolledUpRef.current = true;
                isNearBottomRef.current = false;
                isInitialLoadRef.current = false;
              }}
              onScrollEndDrag={() => {
                isUserInteractingRef.current = false;
              }}
              onMomentumScrollBegin={() => {
                isUserInteractingRef.current = true;
                isInitialLoadRef.current = false;
              }}
              onMomentumScrollEnd={() => {
                isUserInteractingRef.current = false;
              }}
              onScroll={(e) => {
                const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
                if (contentSize.height <= 0) return;
                const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);

                // Toleransi presisi 30 piksel untuk mendeteksi posisi paling bawah
                const isAtBottom = distanceFromBottom <= 30;
                isNearBottomRef.current = isAtBottom;

                if (isAtBottom) {
                  userHasScrolledUpRef.current = false;
                  setShowScrollBottomBtn(false);
                  setShowNewMessageBadge(false);
                  setUnreadCountWhileScrolled(0);
                  isInitialLoadRef.current = false;
                } else {
                  // Selama fase inisialisasi awal saat layar baru dibuka,
                  // offset 0 jangan pernah dianggap sebagai aksi user scroll naik!
                  if (isInitialLoadRef.current && !isUserInteractingRef.current) {
                    return;
                  }

                  // Jika user aktif dragging atau momentum scroll ke atas
                  userHasScrolledUpRef.current = true;
                  setShowScrollBottomBtn(distanceFromBottom > 100);
                }
              }}
              scrollEventThrottle={16}
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
              renderItem={renderMessageItem}
            />
          )}

          {/* ─── FLOATING SCROLL TO BOTTOM BUTTON DENGAN TANDA PANAH KE BAWAH (SELALU DI ATAS NAVBAR KETIK) ─── */}
          {(showScrollBottomBtn || showNewMessageBadge) && (
            <View style={styles.scrollToBottomWrap} pointerEvents="box-none">
              <Pressable
                style={({ pressed }) => [
                  styles.scrollToBottomBtn,
                  pressed && styles.scrollToBottomBtnPressed,
                ]}
                onPress={jumpToLatestMessages}
                accessibilityRole="button"
                accessibilityLabel="Scroll ke pesan paling bawah"
                hitSlop={8}
              >
                <AppIcon name="chevron-down" size={26} color="#FFFFFF" />
                {unreadCountWhileScrolled > 0 && (
                  <View style={styles.scrollBadge}>
                    <Text style={styles.scrollBadgeText}>
                      {unreadCountWhileScrolled > 99 ? "99+" : unreadCountWhileScrolled}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          )}
        </View>

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
                  {isStickerMessage(replyingTo.message) ? "🎨 [Stiker]" : replyingTo.message}
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

        {/* ─── F. INPUT BAR (TERISOLASI AGAR KETIKAN SUPER RINGAN 0ms DELAY) ─── */}
        <ChatInputBar
          ref={inputRef}
          cooldownRemaining={cooldownRemaining}
          keyboardVisible={keyboardVisible}
          bottomPadding={
            keyboardVisible
              ? 8
              : Math.max(insets.bottom > 0 ? 8 : 12, 10)
          }
          sending={sending}
          showStickerPicker={showStickerPicker}
          onToggleStickerPicker={useCallback(() => {
            hapticLight();
            if (showStickerPicker) {
              setShowStickerPicker(false);
            } else {
              Keyboard.dismiss();
              setShowStickerPicker(true);
            }
          }, [showStickerPicker])}
          onFocusInput={useCallback(() => {
            setShowStickerPicker(false);
          }, [])}
          onSend={handleSendMessage}
        />

        {/* ─── STICKER PICKER TRAY ─── */}
        <ChatStickerPicker
          visible={showStickerPicker}
          onSelectSticker={handleSendSticker}
          onClose={() => setShowStickerPicker(false)}
          cooldownRemaining={cooldownRemaining}
          sending={sending}
        />
      </KeyboardAvoidingView>

      {/* ─── G. BOTTOM NAVIGATION (GLOBAL | CLAN | TEMAN) (SEMBUNYIKAN KETIKA KEYBOARD ATAU STIKER AKTIF) ─── */}
      {!keyboardVisible && !showStickerPicker && (
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
      )}
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
    gap: 10,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingRight: 24, // Memberi jarak kosong proporsional di kanan agar bubble rapi
  },
  messageRowHighlighted: {
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderRadius: 14,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  avatarWrap: {
    paddingTop: 2,
  },
  bubbleCol: {
    flex: 1,
    maxWidth: "88%", // Lebar proporsional (88%) agar muat plakat klan & kota tanpa berdesakan
  },
  messageCard: {
    backgroundColor: "#171B24",
    borderWidth: 1,
    borderColor: "#222A38",
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    width: "100%", // Panjang / lebar akhir rata dan seragam untuk semua pesan
  },
  messageCardHighlighted: {
    borderColor: "#38BDF8",
    borderWidth: 1.5,
    backgroundColor: "rgba(14, 165, 233, 0.22)",
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
  messageCardSticker: {
    backgroundColor: "rgba(22, 27, 36, 0.45)",
    borderColor: "rgba(34, 45, 61, 0.5)",
  },
  messageCardPressed: {
    backgroundColor: "#1C212D",
  },
  stickerMessageWrap: {
    paddingVertical: 4,
    alignItems: "flex-start",
  },
  stickerMessageImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },

  // ─── SENDER HEADER ROW ───
  senderHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 2,
    flexWrap: "wrap",
  },
  senderNameText: {
    fontSize: 12,
    fontWeight: "700",
  },
  memberTagText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "500",
  },
  cityClanRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 2,
    marginBottom: 3,
  },

  // ─── BADGES ROW ───
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  rankTierPill: {
    paddingHorizontal: 5.5,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rankTierText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#1E2636",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  tierPillIcon: {
    width: 11,
    height: 11,
  },
  levelPillText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#38BDF8",
  },

  // ─── REPLY QUOTE BOX ───
  quoteBox: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 5,
    marginBottom: 4,
    gap: 5,
  },
  quoteBoxPressed: {
    opacity: 0.7,
    backgroundColor: "rgba(56, 189, 248, 0.16)",
  },
  quoteAccentLine: {
    width: 2.5,
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
    fontSize: 10.5,
    fontWeight: "700",
    color: "#A7F3D0",
  },
  quoteMemberNumber: {
    fontSize: 9.5,
    color: "#64748B",
  },
  quoteText: {
    fontSize: 10.5,
    color: "#94A3B8",
    marginTop: 1,
  },

  // ─── MESSAGE TEXT & TIMESTAMP ───
  messageText: {
    fontSize: 12.5,
    color: "#F1F5F9",
    lineHeight: 17.5,
  },
  timestampText: {
    fontSize: 9.5,
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
  inputMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cooldownBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.14)",
    borderColor: "rgba(245, 158, 11, 0.35)",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cooldownBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#F59E0B",
  },
  charCounterText: {
    fontSize: 10,
    color: "#64748B",
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
  stickerToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#161B24",
    borderWidth: 1,
    borderColor: "#222D3D",
  },
  stickerToggleBtnActive: {
    backgroundColor: "rgba(2, 132, 199, 0.18)",
    borderColor: "#0284C7",
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
  sendBtnCooldown: {
    backgroundColor: "rgba(245, 158, 11, 0.22)",
    borderColor: "rgba(245, 158, 11, 0.45)",
    borderWidth: 1,
    opacity: 1,
  },
  sendBtnCooldownText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#F59E0B",
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

  // ─── CHAT FEED CONTAINER & FLOATING SCROLL BUTTON ───
  chatFeedContainer: {
    flex: 1,
    position: "relative",
  },
  scrollToBottomWrap: {
    position: "absolute",
    right: 16,
    bottom: 12,
    zIndex: 999,
  },
  scrollToBottomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#161D2B",
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  scrollToBottomBtnPressed: {
    backgroundColor: "#1F2B3E",
    transform: [{ scale: 0.94 }],
  },
  scrollBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#0F1115",
  },
  scrollBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
});
