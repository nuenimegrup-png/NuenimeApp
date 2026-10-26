import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { useExp } from "@/providers/exp-toast-provider";
import { EXP_RULES } from "@/lib/user-level";
import { canSubmitSharedComment, cleanCommentContent } from "@/lib/comment-content";
import { filterAndCensorMessage } from "@/lib/word-filter";

import {
  sanitizeMessage,
  checkDiscussionCooldown,
  recordDiscussionTimestamp,
  checkDuplicateSpamAndAutoBan,
} from "@/lib/security-defense";

export type SharedComment = {
  id: string;
  user_id: string;
  content: string;
  gif_url: string | null;
  is_spoiler: boolean;
  episode_number: number | null;
  likes: number | null;
  created_at: string;
  author: { username: string | null; display_name: string | null; avatar_url: string | null; member_number?: number | null } | null;
};

export type SharedReply = SharedComment & { parent_id: string | null };

export function useComments(animeId?: number, episodeNumber?: number) {
  const auth = useAnirakuAuth();
  const user = auth.user;
  const { grantXp } = useExp();
  const queryClient = useQueryClient();
  const queryKey = ["comments", animeId, episodeNumber ?? "all"];
  const comments = useQuery<SharedComment[]>({ queryKey, enabled: Boolean(animeId && animeId > 0), queryFn: async () => {
    let request = supabase.from("comments").select("id, user_id, content, gif_url, is_spoiler, episode_number, likes, created_at").eq("anime_id", animeId!).is("parent_id", null);
    if (typeof episodeNumber === "number") request = request.eq("episode_number", episodeNumber);
    const { data, error } = await request.order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const rows = data ?? [];
    const authorIds = [...new Set(rows.map((comment) => comment.user_id).filter(Boolean))];
    if (!authorIds.length) return rows.map((comment) => ({ ...comment, author: null }));
    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, username, display_name, avatar_url, member_number").in("id", authorIds);
    if (profilesError) return rows.map((comment) => ({ ...comment, author: null }));
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return rows.map((comment) => ({ ...comment, author: profileById.get(comment.user_id) ?? null }));
  } });
  const commentIds = (comments.data ?? []).map((comment) => comment.id);
  const likesKey = ["comment-likes", animeId, episodeNumber ?? "all", user?.id ?? "guest"];
  const liked = useQuery<Set<string>>({ queryKey: likesKey, enabled: Boolean(animeId && animeId > 0) && Boolean(user) && commentIds.length > 0, queryFn: async () => {
    const { data, error } = await supabase.from("comment_likes").select("comment_id").eq("user_id", user!.id).in("comment_id", commentIds);
    if (error) throw error;
    return new Set((data ?? []).map((row) => String(row.comment_id)));
  } });
  const repliesKey = ["comment-replies", animeId, episodeNumber ?? "all"];
  const replies = useQuery<SharedReply[]>({ queryKey: repliesKey, enabled: Boolean(animeId && animeId > 0) && commentIds.length > 0, queryFn: async () => {
    const { data, error } = await supabase.from("comments").select("id, user_id, content, gif_url, is_spoiler, episode_number, likes, created_at, parent_id").eq("anime_id", animeId!).not("parent_id", "is", null).in("parent_id", commentIds).order("created_at", { ascending: true }).limit(200);
    if (error) throw error;
    const rows = (data ?? []) as SharedReply[];
    const authorIds = [...new Set(rows.map((comment) => comment.user_id).filter(Boolean))];
    if (!authorIds.length) return rows.map((comment) => ({ ...comment, author: null }));
    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, username, display_name, avatar_url, member_number").in("id", authorIds);
    if (profilesError) return rows.map((comment) => ({ ...comment, author: null }));
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return rows.map((comment) => ({ ...comment, author: profileById.get(comment.user_id) ?? null }));
  } });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: repliesKey });
    void queryClient.invalidateQueries({ queryKey: likesKey });
  };
  const add = useMutation({
    mutationFn: async (input: { content?: string; spoiler?: boolean; episode?: number | null; parentId?: string | null }) => {
      if (!user || !animeId) throw new Error("Sign in to post a comment.");

      const rawContent = cleanCommentContent(input.content);
      if (!canSubmitSharedComment(rawContent)) throw new Error("Write a comment before posting.");

      // 1. Sanitasi anti-injeksi XSS, script, dan batasi panjang karakter
      const sanitized = sanitizeMessage(rawContent, 1000);
      if (!sanitized) throw new Error("Komentar tidak valid.");

      // 2. Cek jeda pengiriman diskusi 1 menit (60 detik)
      const cooldownCheck = await checkDiscussionCooldown(user.id);
      if (!cooldownCheck.allowed) {
        throw new Error(`Jeda keamanan aktif. Mohon tunggu ${cooldownCheck.remainingSeconds} detik sebelum mengirim komentar berikutnya.`);
      }

      // 3. Cek spam pesan sama berulang (4x = Auto-Ban Akun)
      const spamCheck = await checkDuplicateSpamAndAutoBan(user.id, "diskusi", sanitized);
      if (spamCheck.isBanned) {
        auth.refreshProfile();
        throw new Error(spamCheck.errorMessage || "Akun Anda telah DIBLOKIR permanen karena melakukan spam pesan berulang 4 kali!");
      }

      // 4. Filter kata terlarang
      const content = filterAndCensorMessage(sanitized).processedText;

      const { data, error } = await supabase
        .from("comments")
        .insert({
          user_id: user.id,
          anime_id: animeId,
          episode_number: input.episode ?? episodeNumber ?? null,
          parent_id: input.parentId ?? null,
          content,
          gif_url: null,
          is_spoiler: Boolean(input.spoiler),
        })
        .select("id")
        .single();

      if (error) {
        if (error.message?.includes("AKUN DIBLOKIR") || error.message?.includes("diblokir")) {
          auth.refreshProfile();
        }
        throw error;
      }

      // Catat timestamp sukses untuk menghitung jeda 1 menit
      await recordDiscussionTimestamp(user.id);

      // Berikan EXP untuk komentar valid
      if (data?.id) {
        void grantXp({
          activityType: EXP_RULES.COMMENT.type,
          targetId: data.id,
          baseXp: EXP_RULES.COMMENT.xp,
          description: EXP_RULES.COMMENT.label,
          metadata: { anime_id: animeId, episode: input.episode ?? episodeNumber ?? null },
        });
      }
    },
    onSuccess: refresh,
  });
  const toggleLike = useMutation({ mutationFn: async (comment: SharedComment) => {
    if (!user) throw new Error("Sign in to like comments.");
    const isLiked = liked.data?.has(comment.id);
    // Optimistically update the UI
    queryClient.setQueryData<Set<string>>(likesKey, (prev) => {
      const next = new Set(prev ?? []);
      if (isLiked) next.delete(comment.id);
      else next.add(comment.id);
      return next;
    });
    queryClient.setQueryData<SharedComment[]>(queryKey, (prev) =>
      (prev ?? []).map((c) => c.id === comment.id ? { ...c, likes: Math.max(0, (c.likes ?? 0) + (isLiked ? -1 : 1)) } : c)
    );
    try {
      if (isLiked) {
        const { error } = await supabase.from("comment_likes").delete().eq("user_id", user.id).eq("comment_id", comment.id);
        if (error) throw error;
        const { error: countError } = await supabase.rpc("decrement_comment_likes", { comment_id_input: comment.id });
        if (countError) {
          await supabase.from("comments").update({ likes: Math.max(0, (comment.likes ?? 1) - 1) }).eq("id", comment.id);
        }
      } else {
        const { error } = await supabase.from("comment_likes").insert({ user_id: user.id, comment_id: comment.id });
        if (error) throw error;
        const { error: countError } = await supabase.rpc("increment_comment_likes", { comment_id_input: comment.id });
        if (countError) {
          await supabase.from("comments").update({ likes: (comment.likes ?? 0) + 1 }).eq("id", comment.id);
        }
      }
    } catch (err) {
      queryClient.setQueryData<Set<string>>(likesKey, (prev) => {
        const next = new Set(prev ?? []);
        if (isLiked) next.add(comment.id);
        else next.delete(comment.id);
        return next;
      });
      queryClient.setQueryData<SharedComment[]>(queryKey, (prev) =>
        (prev ?? []).map((c) => c.id === comment.id ? { ...c, likes: (c.likes ?? 0) + (isLiked ? 1 : -1) } : c)
      );
      throw err;
    }
  }, onSuccess: refresh });
  const remove = useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) throw new Error("Sign in to delete comments.");
      
      // 1. Coba panggil RPC delete_comment terlebih dahulu (SECURITY DEFINER, menangani cascade RLS)
      const { data: rpcData, error: rpcError } = await supabase.rpc("delete_comment", {
        comment_id_input: commentId,
      });

      if (rpcError) {
        // Fallback: hapus child likes dahulu, kemudian hapus komentar
        await supabase.from("comment_likes").delete().eq("comment_id", commentId);
        const { error: directError } = await supabase
          .from("comments")
          .delete()
          .eq("id", commentId)
          .eq("user_id", user.id);
        if (directError) throw directError;
      } else if (rpcData && rpcData.success === false) {
        throw new Error(rpcData.error || "Gagal menghapus komentar.");
      }

      // Refresh profil pengguna untuk sinkronisasi EXP dan Level jika ada reversal
      await auth.refreshProfile();
    },
    onMutate: async (commentId: string) => {
      // Optimistic delete: langsung hilangkan komentar dari state tampilan
      queryClient.setQueryData<SharedComment[]>(queryKey, (prev) =>
        (prev ?? []).filter((c) => c.id !== commentId)
      );
      queryClient.setQueryData<SharedReply[]>(repliesKey, (prev) =>
        (prev ?? []).filter((r) => r.id !== commentId && r.parent_id !== commentId)
      );
    },
    onSuccess: () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["user-profile-comments"] });
    },
  });
  return { comments, replies, likedIds: liked.data ?? new Set<string>(), add, toggleLike, remove };
}
