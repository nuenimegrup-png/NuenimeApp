import { memo, useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { AppIcon } from "@/components/app-icon";
import { AvatarImage } from "@/components/avatar-image";
import { ErrorState, LoadingState } from "@/components/async-state";
import { useComments, type SharedComment } from "@/hooks/use-comments";
import { avatarUrl } from "@/lib/aniraku-avatars";
import { canSubmitSharedComment, commentAuthorLabel } from "@/lib/comment-content";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { BorderAvatar } from "@/components/border-avatar";
import { getEquippedBorderId } from "@/lib/avatar-borders";
import { UserVerificationBadge } from "@/components/user-verification-badge";
import { getTierForLevel } from "@/components/level-progress-modal";
import { ProfileCityPlaque } from "@/components/profile-city-plaque";
import { hapticLight } from "@/lib/haptics";
import {
  checkDiscussionCooldown,
  checkDuplicateSpamAndAutoBan,
} from "@/lib/security-defense";

const NAME_COLORS = [
  "#EF4444", // Red (Developer / Admin)
  "#38BDF8", // Cyan
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#06B6D4", // Sky
  "#84CC16", // Lime
  "#F97316", // Orange
  "#6366F1", // Indigo
];

function getUsernameColor(username: string, role?: string | null): string {
  const cleanRole = (role || "").trim().toLowerCase();
  if (cleanRole && cleanRole !== "member" && cleanRole !== "guest") {
    return "#EF4444"; // Red for developer / admin
  }
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % NAME_COLORS.length;
  return NAME_COLORS[index];
}

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
        text: "#94A3B8",
      };
  }
}

function authorName(comment: SharedComment) {
  return commentAuthorLabel(comment.author);
}

function elapsedTime(iso: string) {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  if (minutes < 1) return "NOW";
  if (minutes < 60) return `${minutes}M`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}H`;
  return `${Math.floor(minutes / 1440)}D`;
}

function CommentAuthor({ comment }: { comment: SharedComment }) {
  const auth = useAnirakuAuth();
  const avatar = avatarUrl(comment.author?.avatar_url);
  const name = authorName(comment);
  const isMe = Boolean(auth.user?.id && comment.user_id === auth.user.id);
  const [myBorderId, setMyBorderId] = useState<string | null>(null);

  useEffect(() => {
    if (isMe && auth.user?.id) {
      getEquippedBorderId(auth.user.id).then(setMyBorderId);
    }
  }, [isMe, auth.user?.id]);

  const borderId =
    (isMe && (myBorderId || auth.profile?.equipped_border)) ||
    comment.author?.equipped_border ||
    null;
  const role = (isMe && auth.profile?.role) || comment.author?.role || "member";
  const isVip = (isMe && auth.profile?.is_vip) ?? comment.author?.is_vip ?? false;
  const rawMemberNumber =
    (isMe && auth.profile?.member_number) || comment.author?.member_number;
  const memberTag = rawMemberNumber
    ? `#${String(rawMemberNumber).replace(/[^0-9]/g, "")}`
    : null;
  const level = (isMe && auth.profile?.level) || comment.author?.level || 1;

  const tierInfo = getTierForLevel(level);
  const activeTier = tierInfo?.currentTier;
  const tierPillColors = getTierPillColors(activeTier?.name || "Stone");
  const nameColor = getUsernameColor(name, role);

  const handlePressUser = () => {
    if (comment.user_id) {
      hapticLight();
      router.push(`/user/${comment.user_id}` as never);
    }
  };

  return (
    <View style={styles.commentAuthor}>
      <Pressable onPress={handlePressUser} style={styles.authorAvatarWrap}>
        <BorderAvatar
          avatarUrl={avatar}
          fallbackText={name}
          borderId={borderId}
          avatarSize={34}
        />
      </Pressable>

      <View style={styles.authorCopy}>
        {/* Baris 1: Nama Pengguna + Centang Verifikasi (Merah/Biru) + Tag Nomor (#2) */}
        <View style={styles.authorHeaderRow}>
          <Pressable onPress={handlePressUser}>
            <Text
              style={[styles.authorName, { color: nameColor }]}
              numberOfLines={1}
            >
              {name}
            </Text>
          </Pressable>

          {/* Otoritatif Checkmark (Merah untuk Admin, Biru untuk Member) */}
          <UserVerificationBadge role={role} isVip={isVip} size={13} />

          {/* Member Tag Number (e.g. #2) */}
          {memberTag ? (
            <Text style={styles.memberTagText}>{memberTag}</Text>
          ) : null}
        </View>

        {/* Baris 2: Plakat Kota & Klan (Posisinya seragam di bawah nama, persis DRAKONIA / GELANDANGAN) */}
        <View style={styles.cityClanRow}>
          <ProfileCityPlaque
            userId={comment.user_id}
            compact
            inlineClan
          />
        </View>

        {/* Baris 3: Rank Tier Pill (e.g. GOLD) + Level Pill (Lvl 11) + Timestamp */}
        <View style={styles.badgesAndMetaRow}>
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
                style={[styles.rankTierText, { color: tierPillColors.text }]}
              >
                {activeTier.name.toUpperCase()}
              </Text>
            </View>
          ) : null}

          {/* Level Pill dengan Icon Sayap / Tier */}
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
              Lvl {Number(level).toLocaleString("id-ID")}
            </Text>
          </View>

          {/* Episode & Waktu */}
          <Text style={styles.authorMeta}>
            {comment.episode_number ? `EP ${comment.episode_number} · ` : ""}
            {elapsedTime(comment.created_at)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SpoilerContent({ children }: { children: React.ReactNode }) {
  const blurAnim = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.timing(blurAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [blurAnim]);

  return (
    <Animated.View
      style={{
        opacity: blurAnim.interpolate({
          inputRange: [0, 10],
          outputRange: [1, 0.6],
        }),
      }}
    >
      <Animated.View
        style={{
          opacity: blurAnim.interpolate({
            inputRange: [0, 10],
            outputRange: [1, 0.3],
          }),
        }}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const COMMENTS_PAGE_SIZE = 10;
const COMMENTS_PAGE_STEP = 20;

export const AnimeComments = memo(function AnimeComments({
  animeId,
  episodeNumber,
}: {
  animeId: number;
  episodeNumber?: number;
}) {
  const auth = useAnirakuAuth();
  const comments = useComments(animeId, episodeNumber);
  const [content, setContent] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [hideAllSpoilers, setHideAllSpoilers] = useState(false);
  const [sort, setSort] = useState<"popular" | "newest">("newest");
  const [replyTo, setReplyTo] = useState<SharedComment | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [securityWarning, setSecurityWarning] = useState<string | null>(null);

  const [visibleCount, setVisibleCount] = useState(COMMENTS_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(COMMENTS_PAGE_SIZE);
  }, [animeId, episodeNumber, sort]);

  // Cek jeda diskusi 1 menit saat pertama kali load
  useEffect(() => {
    let mounted = true;
    if (!auth.user?.id) return;

    checkDiscussionCooldown(auth.user.id).then((res) => {
      if (mounted && res.remainingSeconds > 0) {
        setCooldownSeconds(res.remainingSeconds);
      }
    });

    return () => {
      mounted = false;
    };
  }, [auth.user?.id]);

  // Interval timer countdown 60 detik
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const canPost = canSubmitSharedComment(content);
  const sortedComments = useMemo(() => {
    const rows = [...(comments.comments.data ?? [])];
    if (sort === "popular") {
      rows.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    }
    return rows;
  }, [comments.comments.data, sort]);

  const visibleComments = useMemo(
    () => sortedComments.slice(0, visibleCount),
    [sortedComments, visibleCount]
  );
  const remainingComments = Math.max(0, sortedComments.length - visibleCount);

  const repliesByParent = useMemo(() => {
    const grouped = new Map<string, typeof sortedComments>();
    for (const reply of comments.replies.data ?? []) {
      if (!reply.parent_id) continue;
      const list = grouped.get(reply.parent_id) ?? [];
      list.push(reply);
      grouped.set(reply.parent_id, list);
    }
    return grouped;
  }, [comments.replies.data]);

  useEffect(() => {
    if (replyTo && !sortedComments.some((comment) => comment.id === replyTo.id)) {
      setReplyTo(null);
    }
  }, [replyTo, sortedComments]);

  const post = async () => {
    if (cooldownSeconds > 0) {
      Alert.alert(
        "Jeda Diskusi Aktif",
        `Mohon tunggu ${cooldownSeconds} detik sebelum mengirim komentar berikutnya (aturan jeda 1 menit).`
      );
      return;
    }

    if (!auth.user) {
      router.push("/auth" as never);
      return;
    }

    // Cek spam pesan berulang (4x = Auto-Ban Akun)
    const spamCheck = await checkDuplicateSpamAndAutoBan(auth.user.id, "diskusi", content);
    if (spamCheck.isBanned) {
      await auth.refreshProfile();
      Alert.alert(
        "AKUN DIBLOKIR",
        spamCheck.errorMessage || "Akun Anda telah DIBLOKIR permanen karena melakukan spam pesan yang sama sebanyak 4 kali!"
      );
      return;
    }

    if (spamCheck.warningMessage) {
      setSecurityWarning(spamCheck.warningMessage);
      Alert.alert("Peringatan Keamanan", spamCheck.warningMessage);
    } else {
      setSecurityWarning(null);
    }

    comments.add.mutate(
      {
        content,
        spoiler,
        episode: episodeNumber,
        parentId: replyTo?.id ?? null,
      },
      {
        onSuccess: () => {
          setContent("");
          setSpoiler(false);
          setReplyTo(null);
          setCooldownSeconds(60); // Jalankan countdown 60 detik (1 menit)
          setSecurityWarning(null);
        },
        onError: (err: any) => {
          if (err.message?.includes("diblokir") || err.message?.includes("AKUN DIBLOKIR")) {
            auth.refreshProfile();
          }
        },
      }
    );
  };

  const requireUser = () => {
    if (!auth.user) {
      router.push("/auth" as never);
      return false;
    }
    return true;
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const doDelete = (commentId: string) => {
    setDeletingId(commentId);
    comments.remove.mutate(commentId, {
      onError: (err: any) => {
        setDeletingId(null);
        const msg = err?.message || "Gagal menghapus komentar dari database.";
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.alert(`Gagal menghapus komentar: ${msg}`);
        } else {
          Alert.alert("Gagal Menghapus", msg);
        }
      },
      onSettled: () => {
        setDeletingId(null);
      },
    });
  };

  const confirmDelete = (commentId: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Hapus komentar ini secara permanen?")) {
        doDelete(commentId);
      }
      return;
    }
    Alert.alert(
      "Hapus komentar?",
      "Komentar Anda akan dihapus secara permanen dari diskusi.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: () => doDelete(commentId),
        },
      ]
    );
  };

  const reveal = (id: string) => {
    Alert.alert(
      "Spoiler Warning",
      "This comment contains spoilers. Reveal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reveal",
          onPress: () =>
            setRevealed((current) => new Set(current).add(id)),
        },
      ]
    );
  };

  return (
    <View style={styles.section}>
      {/* ─── Header: COMMUNITY / Comments + Spoiler Toggle & Count ─── */}
      <View style={styles.heading}>
        <View>
          <Text style={styles.communityBadge}>
            {episodeNumber ? "EPISODE ACTIVITY" : "COMMUNITY"}
          </Text>
          <Text style={styles.title}>
            {episodeNumber ? "Comments" : "Comments"}
          </Text>
        </View>

        <View style={styles.headingRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              hideAllSpoilers ? "Show all spoilers" : "Hide all spoilers"
            }
            accessibilityHint="Toggles visibility of all spoiler comments"
            onPress={() => setHideAllSpoilers((v) => !v)}
            style={({ pressed }) => [
              styles.spoilerToggle,
              pressed && styles.pressed,
            ]}
          >
            <AppIcon
              name={hideAllSpoilers ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={hideAllSpoilers ? "#EF4444" : "rgba(255, 255, 255, 0.45)"}
            />
          </Pressable>
          <Text style={styles.count}>
            {String(comments.comments.data?.length ?? 0).padStart(2, "0")}
          </Text>
        </View>
      </View>

      {/* ─── Sort Row: Sort by [Popular] [Newest] ─── */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort by</Text>
        {(["popular", "newest"] as const).map((option) => {
          const isActive = sort === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => setSort(option)}
              style={[
                styles.sortPill,
                isActive && styles.sortPillActive,
              ]}
            >
              <Text
                style={[
                  styles.sortPillText,
                  isActive && styles.sortPillTextActive,
                ]}
              >
                {option === "popular" ? "Popular" : "Newest"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ─── Composer Card ─── */}
      {auth.user ? (
        <View style={styles.composerCard}>
          {replyTo ? (
            <View style={styles.replyBar}>
              <Text style={styles.replyBarText} numberOfLines={1}>
                Replying to {authorName(replyTo)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
                onPress={() => setReplyTo(null)}
                style={styles.replyBarClose}
              >
                <AppIcon name="close" size={14} color="#94A3B8" />
              </Pressable>
            </View>
          ) : null}

          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder={replyTo ? "Tulis balasan..." : "Share a thought"}
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            style={styles.input}
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />

          <View style={styles.composerDivider} />

          <View style={styles.composerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                spoiler
                  ? "Spoiler protection enabled"
                  : "Mark comment as a spoiler"
              }
              accessibilityState={{ selected: spoiler }}
              onPress={() => setSpoiler((value) => !value)}
              style={({ pressed }) => [
                styles.tool,
                spoiler && styles.toolActive,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon
                name="eye-off-outline"
                size={15}
                color={spoiler ? "#EF4444" : "rgba(255, 255, 255, 0.6)"}
              />
              <Text
                style={[
                  styles.toolText,
                  spoiler && styles.toolTextActive,
                ]}
              >
                SPOILER
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cooldownSeconds > 0 ? `Jeda diskusi ${cooldownSeconds}s` : "Post comment"}
              disabled={!canPost || comments.add.isPending || cooldownSeconds > 0}
              onPress={post}
              style={({ pressed }) => [
                styles.sendBtn,
                (!canPost || comments.add.isPending || cooldownSeconds > 0) && styles.sendBtnDisabled,
                cooldownSeconds > 0 && { width: "auto", minWidth: 44, paddingHorizontal: 8 },
                pressed && styles.pressed,
              ]}
            >
              {comments.add.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : cooldownSeconds > 0 ? (
                <Text style={{ fontFamily: "Nunito-Bold", fontSize: 11, color: "#94A3B8" }}>
                  {cooldownSeconds}s
                </Text>
              ) : (
                <AppIcon name="send" size={15} color="#FFFFFF" />
              )}
            </Pressable>
          </View>

          {cooldownSeconds > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>
              <AppIcon name="clock-outline" size={13} color="#38BDF8" />
              <Text style={{ fontFamily: "Nunito-Medium", fontSize: 11, color: "#38BDF8" }}>
                Jeda 1 menit aktif: dapat mengirim lagi dalam {cooldownSeconds} detik.
              </Text>
            </View>
          ) : null}

          {securityWarning ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, backgroundColor: "rgba(245, 158, 11, 0.12)", padding: 6, borderRadius: 8 }}>
              <AppIcon name="alert-circle-outline" size={14} color="#F59E0B" />
              <Text style={{ fontFamily: "Nunito-Medium", fontSize: 11, color: "#FBBF24", flex: 1 }}>
                {securityWarning}
              </Text>
            </View>
          ) : null}

          {comments.add.isError ? (
            <Text style={styles.error}>{comments.add.error.message}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.guestCard}>
          <Text style={styles.guestText}>
            Masuk dengan akun Aniraku untuk bergabung dalam diskusi komunitas.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/auth" as never)}
            style={({ pressed }) => [
              styles.guestBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.guestBtnText}>SIGN IN TO COMMENT</Text>
          </Pressable>
        </View>
      )}

      {/* ─── Comments Feed or Empty State ─── */}
      {comments.comments.isPending ? (
        <LoadingState label="Memuat komentar komunitas..." />
      ) : comments.comments.isError ? (
        <ErrorState
          message="Komentar tidak dapat dimuat saat ini."
          onRetry={() => void comments.comments.refetch()}
        />
      ) : !sortedComments.length ? (
        /* Image 1 Empty State Card: No discussion yet */
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No discussion yet</Text>
          <Text style={styles.emptyText}>
            Start the conversation without spoiling the story for everyone else.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleComments}
          keyExtractor={(comment) => comment.id}
          scrollEnabled={false}
          contentContainerStyle={styles.list}
          renderItem={({ item: comment }) => {
            const hidden =
              comment.is_spoiler &&
              (hideAllSpoilers || !revealed.has(comment.id));
            const isLiked = comments.likedIds.has(comment.id);
            const isOwn =
              Boolean(auth.user) && auth.user!.id === comment.user_id;
            const isAdmin =
              Boolean(auth.user) &&
              ((auth.profile as any)?.role === "admin" ||
                auth.user?.user_metadata?.role === "admin");
            const canDelete = isOwn || isAdmin;
            const isDeletingThis = deletingId === comment.id;
            const thread = repliesByParent.get(comment.id) ?? [];

            const isMe =
              Boolean(auth.user) && auth.user!.id === comment.user_id;
            const bannerUrl =
              (isMe && auth.profile?.banner_url) ||
              comment.author?.banner_url ||
              null;
            const hasBanner = Boolean(bannerUrl && bannerUrl.trim().length > 0);

            return (
              <View
                key={comment.id}
                style={[
                  styles.commentCard,
                  hasBanner && styles.commentCardWithBanner,
                ]}
              >
                {hasBanner ? (
                  <>
                    <Image
                      source={{ uri: bannerUrl! }}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                    <LinearGradient
                      colors={["rgba(10, 15, 26, 0.65)", "rgba(10, 15, 26, 0.40)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  </>
                ) : null}

                <CommentAuthor comment={comment} />

                {hidden ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Spoiler hidden. Reveal comment."
                    onPress={() => reveal(comment.id)}
                    style={({ pressed }) => [
                      styles.spoilerShield,
                      pressed && styles.pressed,
                    ]}
                  >
                    <AppIcon
                      name="eye-off-outline"
                      size={16}
                      color="#EF4444"
                    />
                    <Text style={styles.spoilerText}>
                      SPOILER HIDDEN · TAP TO REVEAL
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    {comment.is_spoiler ? (
                      <SpoilerContent>
                        <Text style={styles.revealedBadge}>
                          SPOILER REVEALED
                        </Text>
                        {comment.content ? (
                          <Text style={styles.commentText}>
                            {comment.content}
                          </Text>
                        ) : null}
                        {comment.gif_url ? (
                          <Image
                            source={{ uri: comment.gif_url }}
                            style={styles.commentGif}
                            resizeMode="contain"
                          />
                        ) : null}
                      </SpoilerContent>
                    ) : (
                      <>
                        {comment.content ? (
                          <Text style={styles.commentText}>
                            {comment.content}
                          </Text>
                        ) : null}
                        {comment.gif_url ? (
                          <Image
                            source={{ uri: comment.gif_url }}
                            style={styles.commentGif}
                            resizeMode="contain"
                          />
                        ) : null}
                      </>
                    )}
                  </>
                )}

                <View style={styles.commentActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      isLiked ? "Unlike comment" : "Like comment"
                    }
                    disabled={comments.toggleLike.isPending}
                    onPress={() => {
                      if (requireUser()) void comments.toggleLike.mutate(comment);
                    }}
                    style={styles.commentAction}
                  >
                    <AppIcon
                      name={isLiked ? "heart" : "heart-outline"}
                      size={15}
                      color={isLiked ? "#EF4444" : "#94A3B8"}
                    />
                    <Text
                      style={[
                        styles.commentActionText,
                        isLiked && styles.commentActionTextActive,
                      ]}
                    >
                      {comment.likes ?? 0}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Reply to comment"
                    onPress={() => {
                      if (requireUser()) setReplyTo(comment);
                    }}
                    style={styles.commentAction}
                  >
                    <AppIcon name="reply-outline" size={15} color="#94A3B8" />
                    <Text style={styles.commentActionText}>Reply</Text>
                  </Pressable>

                  {canDelete ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete comment"
                      disabled={isDeletingThis || comments.remove.isPending}
                      onPress={() => confirmDelete(comment.id)}
                      style={styles.commentAction}
                    >
                      {isDeletingThis ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <AppIcon
                          name="trash-can-outline"
                          size={15}
                          color="#EF4444"
                        />
                      )}
                    </Pressable>
                  ) : null}
                </View>

                {/* Sub-replies Thread */}
                {thread.map((reply) => {
                  const replyHidden =
                    reply.is_spoiler &&
                    (hideAllSpoilers || !revealed.has(reply.id));
                  const replyOwn =
                    Boolean(auth.user) && auth.user!.id === reply.user_id;
                  const replyCanDelete = replyOwn || isAdmin;
                  const isDeletingReply = deletingId === reply.id;

                  const replyIsMe =
                    Boolean(auth.user) && auth.user!.id === reply.user_id;
                  const replyBannerUrl =
                    (replyIsMe && auth.profile?.banner_url) ||
                    reply.author?.banner_url ||
                    null;
                  const replyHasBanner = Boolean(
                    replyBannerUrl && replyBannerUrl.trim().length > 0
                  );

                  return (
                    <View
                      key={reply.id}
                      style={[
                        styles.replyRow,
                        replyHasBanner && styles.replyRowWithBanner,
                      ]}
                    >
                      {replyHasBanner ? (
                        <>
                          <Image
                            source={{ uri: replyBannerUrl! }}
                            style={StyleSheet.absoluteFillObject}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                          />
                          <LinearGradient
                            colors={["rgba(10, 15, 26, 0.65)", "rgba(10, 15, 26, 0.40)"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFillObject}
                          />
                        </>
                      ) : null}

                      <CommentAuthor comment={reply} />
                      {replyHidden ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Spoiler hidden. Reveal reply."
                          onPress={() => reveal(reply.id)}
                          style={({ pressed }) => [
                            styles.spoilerShield,
                            pressed && styles.pressed,
                          ]}
                        >
                          <AppIcon
                            name="eye-off-outline"
                            size={14}
                            color="#EF4444"
                          />
                          <Text style={styles.spoilerText}>
                            SPOILER HIDDEN · TAP TO REVEAL
                          </Text>
                        </Pressable>
                      ) : (
                        <>
                          {reply.content ? (
                            <Text style={styles.commentText}>
                              {reply.content}
                            </Text>
                          ) : null}
                          {reply.gif_url ? (
                            <Image
                              source={{ uri: reply.gif_url }}
                              style={styles.commentGif}
                              resizeMode="contain"
                            />
                          ) : null}
                        </>
                      )}

                      <View style={styles.commentActions}>
                        {replyCanDelete ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Delete reply"
                            disabled={isDeletingReply || comments.remove.isPending}
                            onPress={() => confirmDelete(reply.id)}
                            style={styles.commentAction}
                          >
                            {isDeletingReply ? (
                              <ActivityIndicator size="small" color="#EF4444" />
                            ) : (
                              <AppIcon
                                name="trash-can-outline"
                                size={14}
                                color="#EF4444"
                              />
                            )}
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          }}
          ListFooterComponent={
            remainingComments > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Show ${Math.min(
                  COMMENTS_PAGE_STEP,
                  remainingComments
                )} more comments`}
                onPress={() =>
                  setVisibleCount((count) => count + COMMENTS_PAGE_STEP)
                }
                style={({ pressed }) => [
                  styles.showMore,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.showMoreText}>
                  SHOW MORE · {remainingComments} LEFT
                </Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    gap: 12,
    marginTop: 6,
  },
  heading: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  communityBadge: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 10,
    letterSpacing: 1.2,
    color: "rgba(255, 255, 255, 0.45)",
    textTransform: "uppercase",
  },
  title: {
    fontFamily: "Nunito-Black",
    fontSize: 22,
    color: "#FFFFFF",
    marginTop: 2,
    letterSpacing: -0.3,
  },
  headingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 2,
  },
  spoilerToggle: {
    padding: 4,
  },
  count: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.4)",
    letterSpacing: 0.5,
  },

  /* ─── Sort Row ─── */
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  sortLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    marginRight: 2,
  },
  sortPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  sortPillActive: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  sortPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#94A3B8",
  },
  sortPillTextActive: {
    color: "#EF4444",
  },

  /* ─── Composer Card ─── */
  composerCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    gap: 10,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  replyBarText: {
    flex: 1,
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  replyBarClose: {
    padding: 4,
  },
  input: {
    fontFamily: "Nunito-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#FFFFFF",
    minHeight: 52,
    padding: 0,
  },
  composerDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  composerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tool: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  toolActive: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  toolText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: "rgba(255, 255, 255, 0.6)",
  },
  toolTextActive: {
    color: "#EF4444",
  },
  sendBtn: {
    width: 36,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
  error: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#EF4444",
  },

  /* ─── Guest Card ─── */
  guestCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 16,
    gap: 12,
  },
  guestText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
    lineHeight: 18,
  },
  guestBtn: {
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  guestBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },

  /* ─── Empty Card (Matching Image 1) ─── */
  emptyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  emptyText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.5)",
    lineHeight: 18,
  },

  /* ─── Comments List & Cards ─── */
  list: {
    gap: 10,
  },
  commentCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 14,
    gap: 10,
    overflow: "hidden",
  },
  commentCardWithBanner: {
    borderColor: "rgba(255, 255, 255, 0.14)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  commentBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 15, 26, 0.52)",
  },
  commentAuthor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  authorAvatarWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  authorCopy: {
    flex: 1,
    gap: 2,
  },
  authorHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  authorName: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  memberTagText: {
    fontSize: 10.5,
    color: "#64748B",
    fontWeight: "700",
  },
  cityClanRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
    marginBottom: 1,
  },
  badgesAndMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
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
    letterSpacing: 0.5,
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
  authorMeta: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10.5,
    color: "#64748B",
    marginLeft: 2,
  },
  commentText: {
    fontFamily: "Nunito-Regular",
    fontSize: 14,
    color: "#E2E8F0",
    lineHeight: 21,
  },
  commentGif: {
    alignSelf: "flex-start",
    borderRadius: 8,
    height: 144,
    maxWidth: "100%",
    width: 220,
    marginTop: 4,
  },
  spoilerShield: {
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  spoilerText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#EF4444",
    letterSpacing: 0.4,
  },
  revealedBadge: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#EF4444",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingTop: 2,
  },
  commentAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 28,
  },
  commentActionText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  commentActionTextActive: {
    color: "#EF4444",
  },
  replyRow: {
    gap: 8,
    marginTop: 6,
    marginLeft: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  replyRowWithBanner: {
    borderRadius: 12,
    borderLeftColor: "rgba(255, 255, 255, 0.25)",
    padding: 10,
    marginTop: 8,
    backgroundColor: "transparent",
  },
  showMore: {
    height: 42,
    marginTop: 4,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  showMoreText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
