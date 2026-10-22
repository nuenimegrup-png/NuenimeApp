import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { type AdminUser, logAdminAction } from "@/lib/admin-service";
import { useAnirakuAuth } from "@/providers/auth-provider";
import AsyncStorage from "@react-native-async-storage/async-storage";

type CommunityTab = "comments" | "messages" | "blacklist" | "audit";
type CommentFilter = "all" | "flagged" | "spoiler";

interface AdminComment {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  animeId: number;
  episodeNumber?: number | null;
  content: string;
  isSpoiler: boolean;
  likes: number;
  parentId?: string | null;
  createdAt: string;
  bannedWordsFound: string[];
}

interface AdminPrivateMessage {
  id: string;
  senderId: string;
  receiverId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl: string | null;
  receiverUsername: string;
  receiverDisplayName: string;
  receiverAvatarUrl: string | null;
  message: string;
  createdAt: string;
  bannedWordsFound: string[];
}

export interface AdminChatConversation {
  id: string;
  userA: { id: string; username: string; displayName: string; avatarUrl: string | null };
  userB: { id: string; username: string; displayName: string; avatarUrl: string | null };
  lastMessage: string;
  lastMessageTime: string;
  messages: AdminPrivateMessage[];
  flaggedCount: number;
}

function formatWaTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

interface AuditLogItem {
  id: string;
  action: string;
  adminEmail: string;
  targetId: string;
  targetType: string;
  details: any;
  createdAt: string;
}

const STORAGE_WORD_BLACKLIST = "nuenime.admin.word_blacklist";
const DEFAULT_BLACKLIST = [
  "judi", "slot", "gacor", "bokep", "porn", "kontol", "memek", "anjing", "bangsat", "tolol"
];

export default function AdminCommunityScreen() {
  const auth = useAnirakuAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const [activeTab, setActiveTab] = useState<CommunityTab>("comments");
  const [loading, setLoading] = useState(true);

  // ─── DATA STATE ───
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [messages, setMessages] = useState<AdminPrivateMessage[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>(DEFAULT_BLACKLIST);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // ─── WHATSAPP WEB UI STATE ───
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [chatSearchQuery, setChatSearchQuery] = useState("");

  // ─── FILTER STATE ───
  const [searchQuery, setSearchQuery] = useState("");
  const [commentFilter, setCommentFilter] = useState<CommentFilter>("all");

  // ─── BLACKLIST INPUT STATE ───
  const [newBannedWord, setNewBannedWord] = useState("");
  const [savingWord, setSavingWord] = useState(false);

  // ─── DELETE COMMENT MODAL STATE ───
  const [commentToDelete, setCommentToDelete] = useState<AdminComment | null>(null);
  const [deleteCommentReason, setDeleteCommentReason] = useState("");
  const [deletingComment, setDeletingComment] = useState(false);

  // ─── DELETE MESSAGE MODAL STATE ───
  const [messageToDelete, setMessageToDelete] = useState<AdminPrivateMessage | null>(null);
  const [deleteMessageReason, setDeleteMessageReason] = useState("");
  const [deletingMessage, setDeletingMessage] = useState(false);

  // ─── ACTION TOAST (SESUAI GACHA & BORDERS THEME) ───
  const [actionToast, setActionToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setActionToast({ message, type });
    setTimeout(() => setActionToast(null), 4000);
  };

  const adminActor: AdminUser = useMemo(() => {
    return {
      id: auth.user?.id || "admin-super",
      email: auth.user?.email || "admin@nuenime.com",
      username: auth.profile?.display_name || auth.profile?.username || "Community Moderator",
      role: "super_admin",
    };
  }, [auth.user, auth.profile]);

  // ─── DETEKSI KATA BLACKLIST DALAM TEKS ───
  const detectBannedWords = useCallback((text: string, wordsList: string[]): string[] => {
    if (!text || !wordsList.length) return [];
    const lower = text.toLowerCase();
    const found: string[] = [];
    for (const w of wordsList) {
      if (!w || !w.trim()) continue;
      const cleanW = w.trim().toLowerCase();
      if (lower.includes(cleanW)) {
        found.push(cleanW);
      }
    }
    return found;
  }, []);

  // ─── 1. LOAD BLACKLIST DARI SYSTEM_CONFIGS ───
  const loadBlacklist = useCallback(async (): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from("system_configs")
        .select("value")
        .eq("key", "word_blacklist")
        .maybeSingle();

      if (!error && data?.value && Array.isArray(data.value)) {
        const words = (data.value as string[]).map((w) => String(w).trim().toLowerCase()).filter(Boolean);
        setBlacklist(words);
        await AsyncStorage.setItem(STORAGE_WORD_BLACKLIST, JSON.stringify(words)).catch(() => {});
        return words;
      }
    } catch {}

    try {
      const local = await AsyncStorage.getItem(STORAGE_WORD_BLACKLIST);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBlacklist(parsed);
          return parsed;
        }
      }
    } catch {}

    setBlacklist(DEFAULT_BLACKLIST);
    return DEFAULT_BLACKLIST;
  }, []);

  // ─── 2. LOAD KOMENTAR TERBARU DARI SUPABASE ───
  const loadComments = useCallback(async (activeBlacklist: string[]) => {
    try {
      const { data: rawComments, error } = await supabase
        .from("comments")
        .select("id, user_id, anime_id, episode_number, parent_id, content, is_spoiler, likes, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error || !rawComments || rawComments.length === 0) {
        setComments([]);
        return;
      }

      // Ambil seluruh user_id penulis
      const userIds = Array.from(new Set(rawComments.map((c) => c.user_id).filter(Boolean)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map<string, any>((profiles || []).map((p) => [p.id, p]));

      const parsed: AdminComment[] = rawComments.map((c) => {
        const prof = profileMap.get(c.user_id);
        const flagged = detectBannedWords(c.content || "", activeBlacklist);
        return {
          id: c.id,
          userId: c.user_id,
          username: prof?.username || "pengguna",
          displayName: prof?.display_name || prof?.username || "Pengguna Nuenime",
          avatarUrl: prof?.avatar_url || null,
          animeId: c.anime_id,
          episodeNumber: c.episode_number,
          content: c.content || "",
          isSpoiler: Boolean(c.is_spoiler),
          likes: c.likes || 0,
          parentId: c.parent_id,
          createdAt: c.created_at || new Date().toISOString(),
          bannedWordsFound: flagged,
        };
      });

      setComments(parsed);
    } catch {
      setComments([]);
    }
  }, [detectBannedWords]);

  // ─── 3. LOAD CHAT PRIBADI DARI SUPABASE (PRIVATE_MESSAGES) ───
  const loadMessages = useCallback(async (activeBlacklist: string[]) => {
    try {
      const { data: rawMessages, error } = await supabase
        .from("private_messages")
        .select("id, sender_id, receiver_id, message, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error || !rawMessages || rawMessages.length === 0) {
        setMessages([]);
        return;
      }

      // Ambil seluruh user_id pengirim dan penerima
      const allUserIds = Array.from(
        new Set(rawMessages.flatMap((m) => [m.sender_id, m.receiver_id]).filter(Boolean))
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", allUserIds);

      const profileMap = new Map<string, any>((profiles || []).map((p) => [p.id, p]));

      const parsed: AdminPrivateMessage[] = rawMessages.map((m) => {
        const sender = profileMap.get(m.sender_id);
        const receiver = profileMap.get(m.receiver_id);
        const flagged = detectBannedWords(m.message || "", activeBlacklist);
        return {
          id: m.id,
          senderId: m.sender_id,
          receiverId: m.receiver_id,
          senderUsername: sender?.username || "pengguna",
          senderDisplayName: sender?.display_name || sender?.username || "Pengirim",
          senderAvatarUrl: sender?.avatar_url || null,
          receiverUsername: receiver?.username || "pengguna",
          receiverDisplayName: receiver?.display_name || receiver?.username || "Penerima",
          receiverAvatarUrl: receiver?.avatar_url || null,
          message: m.message || "",
          createdAt: m.created_at || new Date().toISOString(),
          bannedWordsFound: flagged,
        };
      });

      setMessages(parsed);
    } catch {
      setMessages([]);
    }
  }, [detectBannedWords]);

  // ─── 4. LOAD AUDIT LOG MODERASI ───
  const loadAuditLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .or("action.ilike.%COMMENT%,action.ilike.%MESSAGE%,action.ilike.%BLACKLIST%")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data)) {
        setAuditLogs(
          data.map((d: any) => ({
            id: d.id,
            action: d.action,
            adminEmail: d.admin_email || "Admin",
            targetId: d.target_id || "-",
            targetType: d.target_type || "community",
            details: d.details || {},
            createdAt: d.created_at || new Date().toISOString(),
          }))
        );
      }
    } catch {}
  }, []);

  // ─── LOAD INITIAL DATA ───
  const reloadAll = useCallback(async () => {
    setLoading(true);
    const words = await loadBlacklist();
    await Promise.all([
      loadComments(words),
      loadMessages(words),
      loadAuditLogs(),
    ]);
    setLoading(false);
  }, [loadBlacklist, loadComments, loadMessages, loadAuditLogs]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  // ─── ACTION: SIMPAN KATA TERLARANG KE SUPABASE & ASYNCSTORAGE ───
  const saveBlacklistToDb = async (updatedList: string[]) => {
    setSavingWord(true);
    try {
      await supabase
        .from("system_configs")
        .upsert(
          {
            key: "word_blacklist",
            value: updatedList,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

      await AsyncStorage.setItem(STORAGE_WORD_BLACKLIST, JSON.stringify(updatedList)).catch(() => {});
      setBlacklist(updatedList);
      showToast("Daftar kata terlarang berhasil disinkronkan ke server!", "success");

      // Perbarui status flagged di list komentar dan chat
      setComments((prev) =>
        prev.map((c) => ({
          ...c,
          bannedWordsFound: detectBannedWords(c.content, updatedList),
        }))
      );
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          bannedWordsFound: detectBannedWords(m.message, updatedList),
        }))
      );
    } catch (err: any) {
      showToast(err?.message || "Gagal menyimpan kata terlarang.", "error");
    } finally {
      setSavingWord(false);
    }
  };

  const handleAddWord = async () => {
    if (!newBannedWord.trim()) return;
    const clean = newBannedWord.trim().toLowerCase();
    if (blacklist.includes(clean)) {
      showToast(`Kata "${clean}" sudah terdaftar di blacklist.`, "error");
      return;
    }

    const updated = [...blacklist, clean];
    setNewBannedWord("");
    hapticSuccess();
    await saveBlacklistToDb(updated);

    await logAdminAction({
      admin: adminActor,
      action: "ADD_WORD_BLACKLIST",
      targetType: "community",
      targetId: clean,
      details: { word: clean, totalWords: updated.length },
    });
    void loadAuditLogs();
  };

  const handleRemoveWord = async (word: string) => {
    hapticLight();
    const updated = blacklist.filter((w) => w !== word);
    await saveBlacklistToDb(updated);

    await logAdminAction({
      admin: adminActor,
      action: "REMOVE_WORD_BLACKLIST",
      targetType: "community",
      targetId: word,
      details: { word, totalWords: updated.length },
    });
    void loadAuditLogs();
  };

  // ─── ACTION: HAPUS KOMENTAR (WITH AUDIT LOG & REASON) ───
  const handleConfirmDeleteComment = async () => {
    if (!commentToDelete) return;
    setDeletingComment(true);
    hapticLight();
    try {
      // 1. Coba panggil Stored Procedure admin_delete_comment jika ada
      let deletedViaRpc = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("admin_delete_comment", {
          p_comment_id: commentToDelete.id,
          p_reason: deleteCommentReason.trim() || "Pelanggaran pedoman komunitas",
          p_admin_id: adminActor.id && adminActor.id !== "admin-super" ? adminActor.id : null,
        });
        if (!rpcErr && (rpcRes?.success || rpcRes === true)) {
          deletedViaRpc = true;
        }
      } catch {
        deletedViaRpc = false;
      }

      // 2. Jika RPC belum dieksekusi di database, lakukan cascade delete manual
      if (!deletedViaRpc) {
        try {
          await supabase.from("comment_likes").delete().eq("comment_id", commentToDelete.id);
          await supabase.from("comments").delete().eq("parent_id", commentToDelete.id);
        } catch {}

        const { error: directErr } = await supabase.from("comments").delete().eq("id", commentToDelete.id);
        if (directErr) {
          const { data: fnRes, error: fnErr } = await supabase.rpc("delete_comment", {
            comment_id_input: commentToDelete.id,
          });
          if (fnErr && !(fnRes as any)?.success) throw directErr;
        }
      }

      await logAdminAction({
        admin: adminActor,
        action: "DELETE_COMMENT",
        targetType: "comment",
        targetId: commentToDelete.id,
        details: {
          author: commentToDelete.username,
          animeId: commentToDelete.animeId,
          episodeNumber: commentToDelete.episodeNumber,
          contentSnippet: commentToDelete.content.slice(0, 100),
          reason: deleteCommentReason.trim() || "Pelanggaran pedoman komunitas",
        },
      });

      setComments((prev) => prev.filter((c) => c.id !== commentToDelete.id));
      setCommentToDelete(null);
      setDeleteCommentReason("");
      hapticSuccess();
      showToast("Komentar berhasil dihapus permanen.", "success");
      void loadAuditLogs();
    } catch (err: any) {
      showToast(err?.message || "Gagal menghapus komentar.", "error");
    } finally {
      setDeletingComment(false);
    }
  };

  // ─── ACTION: HAPUS CHAT PRIBADI (WITH AUDIT LOG & REASON) ───
  const handleConfirmDeleteMessage = async () => {
    if (!messageToDelete) return;
    setDeletingMessage(true);
    hapticLight();
    try {
      const { error } = await supabase.from("private_messages").delete().eq("id", messageToDelete.id);
      if (error) throw error;

      await logAdminAction({
        admin: adminActor,
        action: "DELETE_PRIVATE_MESSAGE",
        targetType: "private_message",
        targetId: messageToDelete.id,
        details: {
          sender: messageToDelete.senderUsername,
          receiver: messageToDelete.receiverUsername,
          messageSnippet: messageToDelete.message.slice(0, 100),
          reason: deleteMessageReason.trim() || "Pesan melanggar aturan etika chat",
        },
      });

      setMessages((prev) => prev.filter((m) => m.id !== messageToDelete.id));
      setMessageToDelete(null);
      setDeleteMessageReason("");
      hapticSuccess();
      showToast("Pesan chat pribadi berhasil dihapus.", "success");
      void loadAuditLogs();
    } catch (err: any) {
      showToast(err?.message || "Gagal menghapus pesan chat.", "error");
    } finally {
      setDeletingMessage(false);
    }
  };

  // ─── FILTERED COMMENTS ───
  const filteredComments = useMemo(() => {
    let list = [...comments];

    if (commentFilter === "flagged") {
      list = list.filter((c) => c.bannedWordsFound.length > 0);
    } else if (commentFilter === "spoiler") {
      list = list.filter((c) => c.isSpoiler);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.content.toLowerCase().includes(q) ||
          c.username.toLowerCase().includes(q) ||
          c.displayName.toLowerCase().includes(q) ||
          String(c.animeId).includes(q)
      );
    }

    return list;
  }, [comments, commentFilter, searchQuery]);

  // ─── CONVERSATIONS GROUPING (WHATSAPP WEB PAIRING) ───
  const conversations: AdminChatConversation[] = useMemo(() => {
    const map = new Map<string, AdminChatConversation>();
    for (const m of messages) {
      const pairKey = [m.senderId, m.receiverId].sort().join("___");
      if (!map.has(pairKey)) {
        map.set(pairKey, {
          id: pairKey,
          userA: {
            id: m.senderId,
            username: m.senderUsername,
            displayName: m.senderDisplayName,
            avatarUrl: m.senderAvatarUrl,
          },
          userB: {
            id: m.receiverId,
            username: m.receiverUsername,
            displayName: m.receiverDisplayName,
            avatarUrl: m.receiverAvatarUrl,
          },
          lastMessage: m.message,
          lastMessageTime: m.createdAt,
          messages: [],
          flaggedCount: 0,
        });
      }
      const conv = map.get(pairKey)!;
      conv.messages.push(m);
      if (m.bannedWordsFound.length > 0) {
        conv.flaggedCount += 1;
      }
    }

    const result = Array.from(map.values()).map((conv) => {
      conv.messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const lastMsg = conv.messages[conv.messages.length - 1];
      if (lastMsg) {
        conv.lastMessage = lastMsg.message;
        conv.lastMessageTime = lastMsg.createdAt;
      }
      return conv;
    });

    result.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    return result;
  }, [messages]);

  const filteredConversations = useMemo(() => {
    if (!chatSearchQuery.trim()) return conversations;
    const q = chatSearchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.userA.username.toLowerCase().includes(q) ||
        c.userA.displayName.toLowerCase().includes(q) ||
        c.userB.username.toLowerCase().includes(q) ||
        c.userB.displayName.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        c.messages.some((m) => m.message.toLowerCase().includes(q))
    );
  }, [conversations, chatSearchQuery]);

  const activeConversation = useMemo(() => {
    if (selectedConversationId) {
      const found = conversations.find((c) => c.id === selectedConversationId);
      if (found) return found;
    }
    return isWide && filteredConversations.length > 0 ? filteredConversations[0] : null;
  }, [conversations, selectedConversationId, isWide, filteredConversations]);

  // ─── KPI COUNTS ───
  const totalCommentsCount = comments.length;
  const totalMessagesCount = messages.length;
  const flaggedCommentsCount = comments.filter((c) => c.bannedWordsFound.length > 0).length;
  const flaggedMessagesCount = messages.filter((m) => m.bannedWordsFound.length > 0).length;

  return (
    <AdminLayout
      title="Komunitas & Moderasi Konten"
      subtitle="Pusat kendali moderasi komentar episode anime, pengawasan pesan chat pribadi, serta sensor kata terlarang (blacklist)"
      activeKey="community"
    >
      {/* ─── TOP KPI STRIP (SESUAI GACHA & BORDERS THEME) ─── */}
      <View style={[styles.kpiStrip, !isWide && styles.kpiStripMobile]}>
        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
            <AppIcon name="comment-text-multiple-outline" size={18} color="#38BDF8" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Total Komentar</Text>
            <Text style={styles.kpiStripVal}>{totalCommentsCount} Item</Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
            <Image
              source={require("@/assets/images/nuenime-logo.png")}
              style={{ width: 18, height: 18 }}
              contentFit="contain"
            />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Nuenime Control Chat</Text>
            <Text style={[styles.kpiStripVal, { color: "#CBD5E1" }]}>
              {conversations.length} Chat ({totalMessagesCount} Pesan)
            </Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(244, 63, 94, 0.15)" }]}>
            <AppIcon name="shield-alert-outline" size={18} color="#F43F5E" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Kata Terlarang (Blacklist)</Text>
            <Text style={[styles.kpiStripVal, { color: "#FDA4AF" }]}>
              {blacklist.length} Kata
            </Text>
          </View>
        </View>

        <View style={styles.kpiStripDivider} />

        <View style={styles.kpiStripItem}>
          <View style={[styles.kpiStripIcon, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
            <AppIcon name="flag-outline" size={18} color="#F59E0B" />
          </View>
          <View>
            <Text style={styles.kpiStripLabel}>Terdeteksi Kasar / Spam</Text>
            <Text style={[styles.kpiStripVal, { color: "#F59E0B" }]}>
              {flaggedCommentsCount + flaggedMessagesCount} Terindikasi
            </Text>
          </View>
        </View>
      </View>

      {/* ─── INFO BANNER (SESUAI GACHA & BORDERS THEME) ─── */}
      <View style={styles.infoBanner}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 }}>
          <View style={styles.infoIconWrap}>
            <AppIcon name="information-outline" size={15} color="#38BDF8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Sistem Moderasi Terintegrasi Database & Aplikasi Nuenime</Text>
            <Text style={styles.infoBannerText}>
              Seluruh komentar episode anime dan pesan chat pribadi terhubung langsung dengan Supabase secara real-time.
              Menghapus komentar atau pesan dari panel ini akan langsung menghilangkannya dari tampilan aplikasi pengguna.
              Daftar kata terlarang (blacklist) tersimpan di tabel system_configs server.
            </Text>
          </View>
        </View>
      </View>

      {/* ─── TAB NAVIGATION (CHIP STYLE SESUAI ADMIN GACHA & BORDERS) ─── */}
      <View style={styles.tabNavWrap}>
        {[
          { key: "comments", label: `Komentar Anime (${totalCommentsCount})`, icon: "comment-text-multiple-outline" },
          { key: "messages", label: `Nuenime Control Chat (${conversations.length})`, icon: "message-processing-outline" },
          { key: "blacklist", label: `Sensor Kata Terlarang (${blacklist.length})`, icon: "shield-alert-outline" },
          { key: "audit", label: `Log Tindakan Moderasi (${auditLogs.length})`, icon: "history" },
        ].map((t) => (
          <Pressable
            key={t.key}
            onPress={() => {
              hapticLight();
              setActiveTab(t.key as any);
            }}
            style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
          >
            <AppIcon
              name={t.icon as any}
              size={14}
              color={activeTab === t.key ? "#FFFFFF" : "#94A3B8"}
            />
            <Text style={[styles.tabBtnText, activeTab === t.key && styles.tabBtnTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ─── FLOATING ACTION TOAST ─── */}
      {actionToast && (
        <View
          style={[
            styles.floatingToast,
            actionToast.type === "error" ? styles.toastError : styles.toastSuccess,
          ]}
        >
          <AppIcon
            name={actionToast.type === "error" ? "alert-circle" : "check-circle"}
            size={16}
            color="#FFFFFF"
          />
          <Text style={styles.toastText}>{actionToast.message}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Memuat data komunitas dan pesan dari database Supabase...</Text>
        </View>
      ) : (
        <View style={styles.contentWrap}>
          {/* ══════════════════════════════════════════════════════
              TAB 1: KOMENTAR EPISODE ANIME
             ══════════════════════════════════════════════════════ */}
          {activeTab === "comments" && (
            <View style={{ gap: 14 }}>
              {/* Filter Card */}
              <View style={styles.filterCard}>
                <View style={styles.topFilterHeader}>
                  <Text style={styles.filterSectionTitle}>Penyaringan & Penelusuran Komentar</Text>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      reloadAll();
                    }}
                    style={styles.refreshBtn}
                  >
                    <AppIcon name="refresh" size={13} color="#94A3B8" />
                    <Text style={styles.refreshBtnText}>Muat Ulang</Text>
                  </Pressable>
                </View>

                <View style={styles.searchRow}>
                  <View style={styles.searchInputWrap}>
                    <AppIcon name="magnify" size={16} color="#64748B" />
                    <TextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Cari teks komentar, nama pengguna, atau ID anime..."
                      placeholderTextColor="#64748B"
                      style={styles.searchInput}
                    />
                    {searchQuery.length > 0 && (
                      <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                        <AppIcon name="close-circle" size={14} color="#64748B" />
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.filterPillsRow}>
                    {[
                      { id: "all", label: "Semua Komentar" },
                      { id: "flagged", label: `⚠️ Terindikasi Kasar (${flaggedCommentsCount})` },
                      { id: "spoiler", label: "Spoiler" },
                    ].map((f) => (
                      <Pressable
                        key={f.id}
                        onPress={() => {
                          hapticLight();
                          setCommentFilter(f.id as CommentFilter);
                        }}
                        style={[
                          styles.filterChip,
                          commentFilter === f.id && styles.filterChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            commentFilter === f.id && styles.filterChipTextActive,
                          ]}
                        >
                          {f.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {/* Feed Komentar List */}
              {filteredComments.length === 0 ? (
                <View style={styles.emptyCard}>
                  <AppIcon name="comment-remove-outline" size={44} color="#64748B" />
                  <Text style={styles.emptyTitle}>Tidak Ditemukan Komentar</Text>
                  <Text style={styles.emptySubtitle}>
                    {searchQuery
                      ? "Tidak ada komentar yang cocok dengan kata kunci penelusuran."
                      : "Belum ada komentar penonton yang tercatat pada episode anime."}
                  </Text>
                </View>
              ) : (
                <View style={styles.commentGrid}>
                  {filteredComments.map((c) => (
                    <View
                      key={c.id}
                      style={[
                        styles.commentCard,
                        c.bannedWordsFound.length > 0 && styles.commentCardFlagged,
                      ]}
                    >
                      <View style={styles.commentTopRow}>
                        <View style={styles.authorGroup}>
                          {c.avatarUrl ? (
                            <Image source={{ uri: c.avatarUrl }} style={styles.authorAvatar} />
                          ) : (
                            <View style={styles.authorAvatarPlaceholder}>
                              <Text style={styles.authorAvatarChar}>
                                {c.username.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={styles.authorDisplayName}>{c.displayName}</Text>
                              <Text style={styles.authorUsername}>@{c.username}</Text>
                            </View>
                            <Text style={styles.commentMeta}>
                              Anime #{c.animeId} • Episode {c.episodeNumber ?? 1} •{" "}
                              {new Date(c.createdAt).toLocaleString("id-ID")}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.commentBadgesRow}>
                          {c.isSpoiler && (
                            <View style={styles.spoilerBadge}>
                              <AppIcon name="alert-octagon" size={11} color="#F59E0B" />
                              <Text style={styles.spoilerBadgeText}>Spoiler</Text>
                            </View>
                          )}
                          <View style={styles.likesBadge}>
                            <AppIcon name="heart" size={11} color="#F43F5E" />
                            <Text style={styles.likesBadgeText}>{c.likes}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Warning Pill jika mengandung kata terlarang */}
                      {c.bannedWordsFound.length > 0 && (
                        <View style={styles.flaggedWarningBox}>
                          <AppIcon name="shield-alert" size={13} color="#F43F5E" />
                          <Text style={styles.flaggedWarningText}>
                            Terdeteksi kata terlarang:{" "}
                            <Text style={{ fontFamily: "Nunito-Black", color: "#FDA4AF" }}>
                              {c.bannedWordsFound.join(", ")}
                            </Text>
                          </Text>
                        </View>
                      )}

                      <Text style={styles.commentContent}>{c.content}</Text>

                      <View style={styles.commentFooterRow}>
                        <Text style={styles.commentIdText}>ID: {c.id.slice(0, 8)}...</Text>
                        <Pressable
                          onPress={() => {
                            hapticLight();
                            setCommentToDelete(c);
                          }}
                          style={styles.deleteActionBtn}
                        >
                          <AppIcon name="trash-can-outline" size={13} color="#F43F5E" />
                          <Text style={styles.deleteActionBtnText}>Hapus Komentar</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 2: CHAT PRIBADI (TAMPILAN WHATSAPP WEB RESMI)
             ══════════════════════════════════════════════════════ */}
          {activeTab === "messages" && (
            <View style={{ gap: 14 }}>
              {/* WhatsApp Web Container (Split-View) */}
              <View style={[styles.waOuterFrame, !isWide && { height: 680 }]}>
                {/* ─── KIRI: LIST PERCAKAPAN WHATSAPP ─── */}
                {(!activeConversation || isWide) && (
                  <View style={[styles.waLeftSidebar, !isWide && { width: "100%" }]}>
                    {/* Header Sidebar Nuenime Control Chat */}
                    <View style={styles.waLeftHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={styles.waBrandAvatar}>
                          <Image
                            source={require("@/assets/images/nuenime-logo.png")}
                            style={{ width: 22, height: 22 }}
                            contentFit="contain"
                          />
                        </View>
                        <View>
                          <Text style={styles.waBrandTitle}>Nuenime Control Chat</Text>
                          <Text style={styles.waBrandSub}>
                            {filteredConversations.length} Percakapan Pengguna
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => {
                          hapticLight();
                          reloadAll();
                        }}
                        style={styles.waHeaderRefreshBtn}
                        accessibilityLabel="Muat Ulang Pesan"
                      >
                        <AppIcon name="refresh" size={16} color="#AEBAC1" />
                      </Pressable>
                    </View>

                    {/* Search Bar WhatsApp */}
                    <View style={styles.waSearchContainer}>
                      <View style={styles.waSearchPill}>
                        <AppIcon name="magnify" size={16} color="#8696A0" />
                        <TextInput
                          value={chatSearchQuery}
                          onChangeText={setChatSearchQuery}
                          placeholder="Cari atau mulai chat baru..."
                          placeholderTextColor="#8696A0"
                          style={styles.waSearchInput}
                        />
                        {chatSearchQuery.length > 0 && (
                          <Pressable onPress={() => setChatSearchQuery("")} hitSlop={8}>
                            <AppIcon name="close" size={14} color="#8696A0" />
                          </Pressable>
                        )}
                      </View>
                    </View>

                    {/* List Percakapan Kontak */}
                    <ScrollView style={styles.waChatScroll} showsVerticalScrollIndicator={false}>
                      {filteredConversations.length === 0 ? (
                        <View style={styles.waEmptyContactsBox}>
                          <AppIcon name="chat-remove-outline" size={36} color="#8696A0" />
                          <Text style={styles.waEmptyContactsText}>Tidak ada obrolan ditemukan</Text>
                          <Text style={styles.waEmptyContactsSub}>
                            Belum ada pesan yang cocok dengan pencarian Anda.
                          </Text>
                        </View>
                      ) : (
                        filteredConversations.map((conv) => {
                          const isSelected = activeConversation?.id === conv.id;
                          const hasFlagged = conv.flaggedCount > 0;
                          const timeStr = formatWaTime(conv.lastMessageTime);

                          return (
                            <Pressable
                              key={conv.id}
                              onPress={() => {
                                hapticLight();
                                setSelectedConversationId(conv.id);
                              }}
                              style={[
                                styles.waChatItem,
                                isSelected && styles.waChatItemActive,
                              ]}
                            >
                              {/* Avatar Kontak */}
                              <View style={styles.waContactAvatarWrap}>
                                {conv.userA.avatarUrl ? (
                                  <Image source={{ uri: conv.userA.avatarUrl }} style={styles.waContactAvatar} />
                                ) : (
                                  <View style={styles.waContactAvatarFallback}>
                                    <Text style={styles.waContactInitial}>
                                      {conv.userA.username.charAt(0).toUpperCase()}
                                    </Text>
                                  </View>
                                )}
                                {hasFlagged && (
                                  <View style={styles.waFlaggedDot}>
                                    <AppIcon name="alert" size={9} color="#FFFFFF" />
                                  </View>
                                )}
                              </View>

                              {/* Info Kontak & Pesan Terakhir */}
                              <View style={styles.waContactMetaCol}>
                                <View style={styles.waContactTopRow}>
                                  <Text style={styles.waContactName} numberOfLines={1}>
                                    @{conv.userA.username} ↔ @{conv.userB.username}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.waContactTimestamp,
                                      isSelected && { color: "#25D366" },
                                    ]}
                                  >
                                    {timeStr}
                                  </Text>
                                </View>

                                <View style={styles.waContactBottomRow}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3, flex: 1 }}>
                                    <AppIcon name="check-all" size={14} color="#53BDEB" />
                                    <Text style={styles.waContactSnippet} numberOfLines={1}>
                                      {conv.lastMessage}
                                    </Text>
                                  </View>
                                  {hasFlagged ? (
                                    <View style={styles.waFlaggedPill}>
                                      <Text style={styles.waFlaggedPillText}>⚠️ {conv.flaggedCount}</Text>
                                    </View>
                                  ) : (
                                    <View style={styles.waCountPill}>
                                      <Text style={styles.waCountPillText}>{conv.messages.length}</Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </Pressable>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
                )}

                {/* ─── KANAN: JENDELA PERCAKAPAN WHATSAPP WEB ─── */}
                {activeConversation && (isWide || selectedConversationId) ? (
                  <View style={[styles.waRightPane, !isWide && { width: "100%" }]}>
                    {/* Header Chat WhatsApp */}
                    <View style={styles.waPaneHeader}>
                      {!isWide && (
                        <Pressable
                          onPress={() => setSelectedConversationId(null)}
                          style={styles.waBackBtn}
                        >
                          <AppIcon name="arrow-left" size={20} color="#AEBAC1" />
                        </Pressable>
                      )}

                      <View style={styles.waPaneAvatarWrap}>
                        <View style={styles.waPaneAvatarFallback}>
                          <Text style={styles.waContactInitial}>
                            {activeConversation.userA.username.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flex: 1, minWidth: 100 }}>
                        <Text style={styles.waPaneContactTitle} numberOfLines={1}>
                          {activeConversation.userA.displayName} (@{activeConversation.userA.username}) &{" "}
                          {activeConversation.userB.displayName} (@{activeConversation.userB.username})
                        </Text>
                        <Text style={styles.waPaneStatusSub} numberOfLines={1}>
                          Total {activeConversation.messages.length} pesan dipantau · Nuenime Private Chat
                        </Text>
                      </View>

                      {activeConversation.flaggedCount > 0 && (
                        <View style={styles.waPaneAlertBadge}>
                          <AppIcon name="shield-alert" size={13} color="#F43F5E" />
                          <Text style={styles.waPaneAlertBadgeText}>
                            {activeConversation.flaggedCount} Kata Terlarang
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Area Chat WhatsApp dengan Wallpaper Dark */}
                    <ScrollView
                      style={styles.waChatStream}
                      contentContainerStyle={styles.waChatStreamContent}
                      showsVerticalScrollIndicator={false}
                    >
                      {/* Date Header Pill WhatsApp */}
                      <View style={styles.waDateCenterWrap}>
                        <View style={styles.waDateCenterPill}>
                          <Text style={styles.waDateCenterText}>RIWAYAT CHAT PRIBADI 7 HARI</Text>
                        </View>
                      </View>

                      {/* Enkripsi & Keamanan Box */}
                      <View style={styles.waNoticeBanner}>
                        <AppIcon name="lock" size={12} color="#F59E0B" />
                        <Text style={styles.waNoticeBannerText}>
                          Pesan pribadi terenkripsi di database. Administrator memoderasi konten yang dilaporkan atau terindikasi kata terlarang.
                        </Text>
                      </View>

                      {/* Bubble Chat WhatsApp */}
                      {activeConversation.messages.map((m, mIdx) => {
                        const isUserA = m.senderId === activeConversation.userA.id;
                        const isFlagged = m.bannedWordsFound.length > 0;
                        const msgTime = formatWaTime(m.createdAt);

                        return (
                          <View
                            key={`${m.id}_${mIdx}`}
                            style={[
                              styles.waBubbleContainer,
                              isUserA ? styles.waBubbleAlignLeft : styles.waBubbleAlignRight,
                            ]}
                          >
                            <View
                              style={[
                                styles.waBubbleBox,
                                isUserA ? styles.waBubbleIncoming : styles.waBubbleOutgoing,
                                isFlagged && styles.waBubbleFlaggedAlert,
                              ]}
                            >
                              {/* Nama Pengirim */}
                              <Text
                                style={[
                                  styles.waBubbleAuthor,
                                  { color: isUserA ? "#38BDF8" : "#25D366" },
                                ]}
                              >
                                @{m.senderUsername}
                              </Text>

                              {/* Warning jika terdeteksi kata terlarang */}
                              {isFlagged && (
                                <View style={styles.waBubbleFlaggedBanner}>
                                  <AppIcon name="alert-circle" size={11} color="#FDA4AF" />
                                  <Text style={styles.waBubbleFlaggedBannerText}>
                                    Terdeteksi kata: {m.bannedWordsFound.join(", ")}
                                  </Text>
                                </View>
                              )}

                              {/* Teks Pesan */}
                              <Text style={styles.waBubbleMessageText}>{m.message}</Text>

                              {/* Meta: Waktu, Centang Biru & Tombol Hapus */}
                              <View style={styles.waBubbleFooterRow}>
                                <Pressable
                                  onPress={() => {
                                    hapticLight();
                                    setMessageToDelete(m);
                                  }}
                                  style={styles.waBubbleDeleteBtn}
                                  hitSlop={6}
                                  accessibilityLabel="Hapus pesan ini"
                                >
                                  <AppIcon name="trash-can-outline" size={12} color="#F43F5E" />
                                  <Text style={styles.waBubbleDeleteText}>Hapus</Text>
                                </Pressable>

                                <View style={{ flex: 1 }} />

                                <Text style={styles.waBubbleTimeText}>{msgTime}</Text>
                                <AppIcon name="check-all" size={13} color="#53BDEB" />
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>

                    {/* Footer Info Nuenime Control Chat */}
                    <View style={styles.waPaneFooter}>
                      <Image
                        source={require("@/assets/images/nuenime-logo.png")}
                        style={{ width: 16, height: 16 }}
                        contentFit="contain"
                      />
                      <Text style={styles.waPaneFooterText}>
                        Mode Pengawasan Nuenime Control Chat — Admin dapat memantau dan menghapus pesan yang melanggar etika.
                      </Text>
                    </View>
                  </View>
                ) : (
                  // Layar Kosong Nuenime Control Chat Saat Belum Memilih Kontak
                  <View style={styles.waNoSelectionPane}>
                    <View style={styles.waNoSelectionIconCircle}>
                      <Image
                        source={require("@/assets/images/nuenime-logo.png")}
                        style={{ width: 56, height: 56 }}
                        contentFit="contain"
                      />
                    </View>
                    <Text style={styles.waNoSelectionTitle}>Nuenime Control Chat</Text>
                    <Text style={styles.waNoSelectionSub}>
                      Pilih salah satu obrolan pengguna di sisi kiri untuk membaca riwayat percakapan teks lengkap dan memoderasi pesan.
                    </Text>
                    <View style={styles.waNoSelectionBadge}>
                      <AppIcon name="lock" size={12} color="#8696A0" />
                      <Text style={styles.waNoSelectionBadgeText}>Terenkripsi E2EE & Terintegrasi Supabase</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 3: SENSOR KATA TERLARANG (WORD BLACKLIST)
             ══════════════════════════════════════════════════════ */}
          {activeTab === "blacklist" && (
            <View style={{ gap: 16 }}>
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(244, 63, 94, 0.12)" }]}>
                    <AppIcon name="shield-alert-outline" size={18} color="#F43F5E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Daftar Kata Terlarang (Profanity Blacklist)</Text>
                    <Text style={styles.cardSubtitle}>
                      Komentar atau chat pribadi yang mengandung kata-kata di bawah ini akan otomatis ditandai
                      dan dapat dicegah / disensor secara otomatis demi keamanan komunitas.
                    </Text>
                  </View>
                </View>

                {/* Input Tambah Kata Baru */}
                <View style={styles.addWordBox}>
                  <View style={styles.addWordInputWrap}>
                    <AppIcon name="plus-circle-outline" size={16} color="#64748B" />
                    <TextInput
                      value={newBannedWord}
                      onChangeText={setNewBannedWord}
                      placeholder="Masukkan kata kasar, nama situs judi, atau ujaran kebencian..."
                      placeholderTextColor="#64748B"
                      style={styles.addWordInput}
                      onSubmitEditing={handleAddWord}
                    />
                  </View>
                  <Pressable
                    onPress={handleAddWord}
                    disabled={savingWord || !newBannedWord.trim()}
                    style={[
                      styles.addWordBtn,
                      (!newBannedWord.trim() || savingWord) && { opacity: 0.5 },
                    ]}
                  >
                    {savingWord ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <AppIcon name="plus" size={15} color="#FFFFFF" />
                        <Text style={styles.addWordBtnText}>Tambahkan Kata</Text>
                      </>
                    )}
                  </Pressable>
                </View>

                {/* Word Chips Wrap */}
                <View style={styles.wordPillSection}>
                  <Text style={styles.wordPillSectionTitle}>
                    Kata Aktif Saat Ini ({blacklist.length} Kata Terdaftar):
                  </Text>
                  <View style={styles.wordPillWrap}>
                    {blacklist.map((word) => (
                      <View key={word} style={styles.wordPill}>
                        <Text style={styles.wordPillText}>{word}</Text>
                        <Pressable
                          onPress={() => handleRemoveWord(word)}
                          hitSlop={8}
                          style={styles.wordPillRemove}
                        >
                          <AppIcon name="close" size={12} color="#F43F5E" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAB 4: LOG TINDAKAN MODERASI
             ══════════════════════════════════════════════════════ */}
          {activeTab === "audit" && (
            <View style={{ gap: 14 }}>
              <View style={styles.contentCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardHeaderIconBox, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
                    <AppIcon name="history" size={18} color="#CBD5E1" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Catatan Audit Moderasi Komunitas</Text>
                    <Text style={styles.cardSubtitle}>
                      Rekam jejak setiap aksi penghapusan komentar, pesan, atau pembaruan daftar kata terlarang.
                    </Text>
                  </View>
                </View>

                {auditLogs.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppIcon name="clipboard-text-clock-outline" size={40} color="#64748B" />
                    <Text style={styles.emptyTitle}>Belum Ada Log Moderasi</Text>
                    <Text style={styles.emptySubtitle}>
                      Setiap tindakan moderasi oleh admin akan dicatat secara otomatis di sini.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.auditListWrap}>
                    {auditLogs.map((log) => (
                      <View key={log.id} style={styles.auditRow}>
                        <View style={styles.auditLeftCol}>
                          <View
                            style={[
                              styles.auditActionBadge,
                              log.action.includes("DELETE")
                                ? { backgroundColor: "rgba(244, 63, 94, 0.12)" }
                                : { backgroundColor: "rgba(56, 189, 248, 0.12)" },
                            ]}
                          >
                            <Text
                              style={[
                                styles.auditActionText,
                                log.action.includes("DELETE")
                                  ? { color: "#F43F5E" }
                                  : { color: "#38BDF8" },
                              ]}
                            >
                              {log.action}
                            </Text>
                          </View>
                          <Text style={styles.auditTimeText}>
                            {new Date(log.createdAt).toLocaleString("id-ID")}
                          </Text>
                        </View>

                        <View style={styles.auditRightCol}>
                          <Text style={styles.auditAdminText}>
                            Moderator: <Text style={{ color: "#FFFFFF" }}>{log.adminEmail}</Text>
                          </Text>
                          <Text style={styles.auditDetailsText}>
                            Catatan:{" "}
                            {log.details?.reason ||
                              log.details?.contentSnippet ||
                              JSON.stringify(log.details || {})}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      {/* ─── MODAL 1: KONFIRMASI HAPUS KOMENTAR ─── */}
      <Modal
        visible={Boolean(commentToDelete)}
        transparent
        animationType="fade"
        onRequestClose={() => setCommentToDelete(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeaderRow}>
              <View style={[styles.modalIconBox, { backgroundColor: "rgba(244, 63, 94, 0.15)" }]}>
                <AppIcon name="trash-can-outline" size={20} color="#F43F5E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Hapus Komentar Penonton</Text>
                <Text style={styles.modalSubtitle}>
                  Komentar dari @{commentToDelete?.username} akan dihapus secara permanen dari server.
                </Text>
              </View>
              <Pressable onPress={() => setCommentToDelete(null)} hitSlop={8}>
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            <View style={styles.modalCommentSnippetBox}>
              <Text style={styles.modalSnippetAuthor}>
                @{commentToDelete?.username} (Anime #{commentToDelete?.animeId} Ep {commentToDelete?.episodeNumber ?? 1}):
              </Text>
              <Text style={styles.modalSnippetContent} numberOfLines={3}>
                "{commentToDelete?.content}"
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.modalInputLabel}>Alasan Moderasi (Wajib dicatat di Audit Log):</Text>
              <TextInput
                value={deleteCommentReason}
                onChangeText={setDeleteCommentReason}
                placeholder="Contoh: Mengandung link judi slot, spoiler kasar, spam..."
                placeholderTextColor="#64748B"
                style={styles.modalTextInput}
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setCommentToDelete(null)}
                style={styles.modalCancelBtn}
                disabled={deletingComment}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmDeleteComment}
                style={styles.modalConfirmDeleteBtn}
                disabled={deletingComment}
              >
                {deletingComment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="trash-can" size={15} color="#FFFFFF" />
                    <Text style={styles.modalConfirmDeleteText}>Hapus Permanen</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 2: KONFIRMASI HAPUS PESAN CHAT ─── */}
      <Modal
        visible={Boolean(messageToDelete)}
        transparent
        animationType="fade"
        onRequestClose={() => setMessageToDelete(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeaderRow}>
              <View style={[styles.modalIconBox, { backgroundColor: "rgba(244, 63, 94, 0.15)" }]}>
                <AppIcon name="trash-can-outline" size={20} color="#F43F5E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Hapus Pesan Chat Pribadi</Text>
                <Text style={styles.modalSubtitle}>
                  Pesan dari @{messageToDelete?.senderUsername} ke @{messageToDelete?.receiverUsername} akan dihapus.
                </Text>
              </View>
              <Pressable onPress={() => setMessageToDelete(null)} hitSlop={8}>
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            <View style={styles.modalCommentSnippetBox}>
              <Text style={styles.modalSnippetAuthor}>
                Dari @{messageToDelete?.senderUsername} ke @{messageToDelete?.receiverUsername}:
              </Text>
              <Text style={styles.modalSnippetContent} numberOfLines={3}>
                "{messageToDelete?.message}"
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.modalInputLabel}>Alasan Moderasi Chat:</Text>
              <TextInput
                value={deleteMessageReason}
                onChangeText={setDeleteMessageReason}
                placeholder="Contoh: Pelecehan verbal, penipuan, spam promosi..."
                placeholderTextColor="#64748B"
                style={styles.modalTextInput}
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setMessageToDelete(null)}
                style={styles.modalCancelBtn}
                disabled={deletingMessage}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmDeleteMessage}
                style={styles.modalConfirmDeleteBtn}
                disabled={deletingMessage}
              >
                {deletingMessage ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="trash-can" size={15} color="#FFFFFF" />
                    <Text style={styles.modalConfirmDeleteText}>Hapus Pesan</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  // ── Top KPI Strip (Persis Gacha Theme)
  kpiStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 14,
    gap: 16,
  },
  kpiStripMobile: {
    flexWrap: "wrap",
    gap: 12,
  },
  kpiStripItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 130,
  },
  kpiStripIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiStripLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#64748B",
  },
  kpiStripVal: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
    marginTop: 2,
  },
  kpiStripDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },

  // ── Info Banner (Persis Gacha Theme)
  infoBanner: {
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 14,
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  infoBannerTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  infoBannerText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
    marginTop: 2,
  },

  // ── Tabs Navigation (Chip Style Sesuai Admin Gacha & Borders)
  tabNavWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  tabBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  tabBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },

  // ── Floating Action Toast (Persis Gacha Theme)
  floatingToast: {
    position: "absolute",
    top: 14,
    right: 20,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  toastSuccess: {
    backgroundColor: "#065F46",
    borderColor: "#10B981",
  },
  toastError: {
    backgroundColor: "#881337",
    borderColor: "#F43F5E",
  },
  toastText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  loadingWrap: {
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
  },
  contentWrap: {
    gap: 16,
  },

  // ── Filter Card (Persis Gacha Theme)
  filterCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 12,
  },
  topFilterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterSectionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  refreshBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  searchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  searchInputWrap: {
    flex: 1,
    minWidth: 260,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
    padding: 0,
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  filterChipActive: {
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  filterChipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  filterChipTextActive: {
    color: "#38BDF8",
  },

  // ── Comment & Chat List Cards (Persis Gacha Content Card Style)
  commentGrid: {
    gap: 10,
  },
  commentCard: {
    backgroundColor: "#0D1117",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 10,
  },
  commentCardFlagged: {
    borderColor: "rgba(244, 63, 94, 0.35)",
    backgroundColor: "rgba(244, 63, 94, 0.03)",
  },
  commentTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  authorGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  authorAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1E293B",
  },
  authorAvatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#38BDF8",
    alignItems: "center",
    justifyContent: "center",
  },
  authorAvatarChar: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#0B0E17",
  },
  authorDisplayName: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  authorUsername: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },
  commentMeta: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
    marginTop: 1,
  },
  commentBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  spoilerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  spoilerBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#F59E0B",
  },
  likesBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  likesBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#F43F5E",
  },
  flaggedWarningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
  },
  flaggedWarningText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#FDA4AF",
  },
  commentContent: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#E2E8F0",
    lineHeight: 19,
  },
  commentFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.04)",
    paddingTop: 8,
  },
  commentIdText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
  },
  deleteActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.22)",
  },
  deleteActionBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#F43F5E",
  },

  // ── Chat Pribadi Row Specific
  chatHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  chatUserPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  chatRoleLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },
  chatUserName: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  chatTimeText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },
  chatBubbleBody: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  chatBubbleText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#CBD5E1",
    lineHeight: 18,
  },

  // ── Generic Content Card (Blacklist & Audit)
  contentCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardHeaderIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  cardTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  cardSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },

  // ── Blacklist Tab
  addWordBox: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  addWordInputWrap: {
    flex: 1,
    minWidth: 260,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addWordInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
    padding: 0,
  },
  addWordBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(244, 63, 94, 0.8)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  addWordBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  wordPillSection: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingTop: 12,
  },
  wordPillSectionTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },
  wordPillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  wordPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.3)",
  },
  wordPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FDA4AF",
  },
  wordPillRemove: {
    padding: 2,
  },

  // ── Audit Log List
  auditListWrap: {
    gap: 8,
  },
  auditRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    padding: 12,
    gap: 10,
  },
  auditLeftCol: {
    gap: 3,
  },
  auditActionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  auditActionText: {
    fontFamily: "Nunito-Black",
    fontSize: 10.5,
  },
  auditTimeText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
  },
  auditRightCol: {
    flex: 1,
    minWidth: 200,
    gap: 2,
  },
  auditAdminText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  auditDetailsText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },

  // ── Empty State Card
  emptyCard: {
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
    marginTop: 4,
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 400,
  },

  // ── Modal Styles (Persis Gacha Modal)
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalBox: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#0D1117",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  modalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  modalCommentSnippetBox: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 12,
    gap: 4,
  },
  modalSnippetAuthor: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },
  modalSnippetContent: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#CBD5E1",
    fontStyle: "italic",
  },
  modalInputLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  modalTextInput: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#FFFFFF",
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  modalCancelBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  modalConfirmDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: "#E11D48",
  },
  modalConfirmDeleteText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#FFFFFF",
  },

  // ── WhatsApp Web Container & Panes
  waOuterFrame: {
    backgroundColor: "#111b21",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    flexDirection: "row",
    height: 640,
    overflow: "hidden",
  },
  waLeftSidebar: {
    width: 350,
    backgroundColor: "#111b21",
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.08)",
    flexDirection: "column",
  },
  waLeftHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#202c33",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  waBrandAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  waBrandTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#E9EDEF",
  },
  waBrandSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#8696A0",
  },
  waHeaderRefreshBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  waSearchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#111b21",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  waSearchPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#202c33",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  waSearchInput: {
    flex: 1,
    color: "#E9EDEF",
    fontFamily: "Nunito-SemiBold",
    fontSize: 12.5,
    padding: 0,
  },
  waChatScroll: {
    flex: 1,
  },
  waEmptyContactsBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 8,
  },
  waEmptyContactsText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#8696A0",
  },
  waEmptyContactsSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
  },
  waChatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  waChatItemActive: {
    backgroundColor: "#2a3942",
  },
  waContactAvatarWrap: {
    position: "relative",
  },
  waContactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  waContactAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#202c33",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  waContactInitial: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#E9EDEF",
  },
  waFlaggedDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  waContactMetaCol: {
    flex: 1,
    gap: 2,
  },
  waContactTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  waContactName: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#E9EDEF",
    maxWidth: 180,
  },
  waContactTimestamp: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#8696A0",
  },
  waContactBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  waContactSnippet: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#8696A0",
    flex: 1,
  },
  waFlaggedPill: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  waFlaggedPillText: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
    color: "#F87171",
  },
  waCountPill: {
    backgroundColor: "#202c33",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  waCountPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#8696A0",
  },

  // ── Right Chat Area (WhatsApp Theme)
  waRightPane: {
    flex: 1,
    backgroundColor: "#0b141a",
    flexDirection: "column",
  },
  waPaneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#202c33",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  waBackBtn: {
    padding: 6,
    marginRight: 2,
  },
  waPaneAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: "hidden",
  },
  waPaneAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#111b21",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  waPaneContactTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#E9EDEF",
  },
  waPaneStatusSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#8696A0",
  },
  waPaneAlertBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
  },
  waPaneAlertBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FDA4AF",
  },
  waChatStream: {
    flex: 1,
    backgroundColor: "#0b141a",
  },
  waChatStreamContent: {
    padding: 16,
    gap: 8,
  },
  waDateCenterWrap: {
    alignItems: "center",
    marginVertical: 4,
  },
  waDateCenterPill: {
    backgroundColor: "#182229",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  waDateCenterText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#8696A0",
    letterSpacing: 0.5,
  },
  waNoticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    marginBottom: 6,
  },
  waNoticeBannerText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#F59E0B",
    flex: 1,
    lineHeight: 15,
  },
  waBubbleContainer: {
    flexDirection: "row",
    marginVertical: 2,
  },
  waBubbleAlignLeft: {
    justifyContent: "flex-start",
  },
  waBubbleAlignRight: {
    justifyContent: "flex-end",
  },
  waBubbleBox: {
    maxWidth: "78%",
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
    gap: 3,
  },
  waBubbleIncoming: {
    backgroundColor: "#202c33",
    borderTopLeftRadius: 0,
  },
  waBubbleOutgoing: {
    backgroundColor: "#005c4b",
    borderTopRightRadius: 0,
  },
  waBubbleFlaggedAlert: {
    borderColor: "#F43F5E",
    borderWidth: 1,
  },
  waBubbleAuthor: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
  },
  waBubbleFlaggedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(244, 63, 94, 0.18)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginVertical: 2,
  },
  waBubbleFlaggedBannerText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#FDA4AF",
  },
  waBubbleMessageText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#E9EDEF",
    lineHeight: 18,
  },
  waBubbleFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 5,
    marginTop: 2,
  },
  waBubbleTimeText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.6)",
  },
  waBubbleDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(244, 63, 94, 0.15)",
  },
  waBubbleDeleteText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#FDA4AF",
  },
  waPaneFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#202c33",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  waPaneFooterText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#8696A0",
    flex: 1,
  },
  waNoSelectionPane: {
    flex: 1,
    backgroundColor: "#222e35",
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 12,
  },
  waNoSelectionIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  waNoSelectionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 22,
    color: "#E9EDEF",
  },
  waNoSelectionSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#8696A0",
    textAlign: "center",
    maxWidth: 380,
    lineHeight: 19,
  },
  waNoSelectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  waNoSelectionBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#8696A0",
  },
});
