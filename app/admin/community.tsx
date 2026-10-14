import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { type AdminUser, logAdminAction } from "@/lib/admin-service";

interface AdminComment {
  id: string;
  userId: string;
  username: string;
  animeId: number;
  episodeNumber?: number;
  content: string;
  createdAt: string;
}

export default function AdminCommunityScreen() {
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([
    "judi", "slot", "gacor", "bokep", "porn", "kontol", "memek", "anjing", "bangsat"
  ]);
  const [newBannedWord, setNewBannedWord] = useState("");

  const mockAdmin: AdminUser = {
    id: "admin-mod",
    email: "moderator@nuenime.com",
    username: "Community Moderator",
    role: "moderator",
  };

  const loadComments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .select("id, user_id, anime_id, episode_number, content, created_at, profiles(username)")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && Array.isArray(data)) {
        const parsed = data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          username: d.profiles?.username || "Pengguna",
          animeId: d.anime_id,
          episodeNumber: d.episode_number,
          content: d.content,
          createdAt: d.created_at,
        }));
        setComments(parsed);
      } else {
        // Fallback sample
        setComments([
          {
            id: "comm-01",
            userId: "user-test",
            username: "AnimeLover99",
            animeId: 21,
            episodeNumber: 1,
            content: "Episode 1 seru banget! Grafisnya mantap abis min!",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadComments();
  }, []);

  const handleDeleteComment = async (comment: AdminComment) => {
    hapticWarning();
    try {
      await supabase.from("comments").delete().eq("id", comment.id);

      await logAdminAction({
        admin: mockAdmin,
        action: "DELETE_COMMENT",
        targetType: "comment",
        targetId: comment.id,
        details: {
          author: comment.username,
          contentSnippet: comment.content.slice(0, 50),
        },
      });

      hapticSuccess();
      Alert.alert("Terhapus", "Komentar berhasil dihapus dari sistem.");
      loadComments();
    } catch {
      Alert.alert("Gagal", "Tidak dapat menghapus komentar.");
    }
  };

  const handleAddWord = () => {
    if (!newBannedWord.trim()) return;
    const word = newBannedWord.trim().toLowerCase();
    if (!blacklist.includes(word)) {
      setBlacklist([...blacklist, word]);
      setNewBannedWord("");
      hapticSuccess();
    }
  };

  const handleRemoveWord = (word: string) => {
    setBlacklist(blacklist.filter((w) => w !== word));
    hapticLight();
  };

  return (
    <AdminLayout
      title="Community & Moderation"
      subtitle="Moderasi komentar pengguna, kata terlarang (word blacklist), dan kenyamanan komunitas"
    >
      <View style={styles.contentWrap}>
        {/* ─── KARTU WORD BLACKLIST ─── */}
        <View style={styles.cardBox}>
          <Text style={styles.cardBoxTitle}>🚫 Filter Sensor Kata Terlarang (Blacklist)</Text>
          <Text style={styles.cardBoxSubtitle}>
            Komentar yang mengandung kata-kata di bawah akan otomatis disensor atau dicegah masuk.
          </Text>

          <View style={styles.addWordRow}>
            <TextInput
              value={newBannedWord}
              onChangeText={setNewBannedWord}
              placeholder="Tambahkan kata terlarang baru..."
              placeholderTextColor="#64748B"
              style={styles.addWordInput}
            />
            <Pressable onPress={handleAddWord} style={styles.addWordBtn}>
              <AppIcon name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.addWordBtnText}>Tambah Kata</Text>
            </Pressable>
          </View>

          <View style={styles.wordPillWrap}>
            {blacklist.map((word) => (
              <View key={word} style={styles.wordPill}>
                <Text style={styles.wordPillText}>{word}</Text>
                <Pressable onPress={() => handleRemoveWord(word)} hitSlop={6}>
                  <AppIcon name="close-circle" size={14} color="#EF4444" />
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        {/* ─── FEED KOMENTAR TERBARU ─── */}
        <View style={styles.cardBox}>
          <Text style={styles.cardBoxTitle}>💬 Feed Komentar Terbaru Episode Anime</Text>
          <Text style={styles.cardBoxSubtitle}>
            Tinjau komentar penonton di seluruh episode. Hapus komentar berbau spam, spoiler kasar,
            atau ujaran kebencian.
          </Text>

          {loading ? (
            <ActivityIndicator size="small" color="#8C57FF" style={{ padding: 20 }} />
          ) : comments.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Belum ada komentar.</Text>
            </View>
          ) : (
            <View style={styles.commentList}>
              {comments.map((c) => (
                <View key={c.id} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <View style={styles.commentUserGroup}>
                      <View style={styles.avatarMini}>
                        <Text style={styles.avatarMiniText}>
                          {c.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.commentAuthor}>{c.username}</Text>
                        <Text style={styles.commentEpisodeMeta}>
                          Anime #{c.animeId} • Episode {c.episodeNumber ?? 1} •{" "}
                          {new Date(c.createdAt).toLocaleDateString("id-ID")}
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => handleDeleteComment(c)}
                      style={styles.deleteCommentBtn}
                    >
                      <AppIcon name="trash-can-outline" size={14} color="#EF4444" />
                      <Text style={styles.deleteCommentText}>Hapus</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.commentBody}>{c.content}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  contentWrap: {
    gap: 20,
  },
  cardBox: {
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 14,
  },
  cardBoxTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  cardBoxSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
  },
  addWordRow: {
    flexDirection: "row",
    gap: 10,
  },
  addWordInput: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#FFFFFF",
  },
  addWordBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#8C57FF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addWordBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
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
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  wordPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#EF4444",
  },
  commentList: {
    gap: 10,
  },
  commentCard: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 8,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commentUserGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#38BDF8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMiniText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#0B0E17",
  },
  commentAuthor: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  commentEpisodeMeta: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  deleteCommentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  deleteCommentText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#EF4444",
  },
  commentBody: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#CBD5E1",
    lineHeight: 18,
  },
  emptyWrap: {
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
  },
});
