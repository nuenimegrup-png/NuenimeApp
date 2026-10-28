import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Image } from "expo-image";

import { AppIcon } from "@/components/app-icon";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { getAnimePage } from "@/lib/anilist";
import { animeTitle, type Anime } from "@/lib/types";
import {
  getActiveNobarRooms,
  createNobarRoom,
  getRoomCode,
  type NobarRoom,
} from "@/lib/nobar-service";

type FilterTab = "all" | "public" | "private";

export default function NobarLobbyScreen() {
  const insets = useSafeAreaInsets();
  const auth = useAnirakuAuth();

  const [rooms, setRooms] = useState<NobarRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal: Buat Room
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomTitleInput, setRoomTitleInput] = useState("");
  const [isPrivateInput, setIsPrivateInput] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [episodeInput, setEpisodeInput] = useState(1);
  const [submittingRoom, setSubmittingRoom] = useState(false);

  // Search Anime untuk Buat Room
  const [animeSearchQuery, setAnimeSearchQuery] = useState("");
  const [animeSearchResults, setAnimeSearchResults] = useState<Anime[]>([]);
  const [searchingAnime, setSearchingAnime] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);

  // Batas Maksimal Episode Anime Terpilih
  const maxEpisodes = useMemo(() => {
    if (selectedAnime?.episodes && selectedAnime.episodes > 0) {
      return selectedAnime.episodes;
    }
    return null;
  }, [selectedAnime?.episodes]);

  // Otomatis batasi episode input saat anime dipilih/berganti
  useEffect(() => {
    if (maxEpisodes && episodeInput > maxEpisodes) {
      setEpisodeInput(maxEpisodes);
    }
  }, [maxEpisodes, episodeInput]);

  // Modal: Masuk Room Privat (Password Prompt)
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [targetRoom, setTargetRoom] = useState<NobarRoom | null>(null);
  const [inputtedPassword, setInputtedPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Load Rooms
  const loadRooms = useCallback(async () => {
    try {
      const data = await getActiveNobarRooms();
      setRooms(data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
    const interval = setInterval(() => {
      void loadRooms();
    }, 8000);
    return () => clearInterval(interval);
  }, [loadRooms]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadRooms();
  };

  // Filtered Rooms (Mendukung pencarian Judul, Anime, Host, serta Tag #Nomor Room)
  const filteredRooms = useMemo(() => {
    let result = rooms;
    if (filterTab === "public") {
      result = result.filter((r) => !r.is_private);
    } else if (filterTab === "private") {
      result = result.filter((r) => r.is_private);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const cleanNum = q.replace(/^#/, "");
      result = result.filter((r) => {
        const code = getRoomCode(r).toLowerCase();
        const codeNum = code.replace(/^#/, "");
        return (
          r.title.toLowerCase().includes(q) ||
          r.anime_title.toLowerCase().includes(q) ||
          r.host_name.toLowerCase().includes(q) ||
          code.includes(q) ||
          (cleanNum.length >= 2 && codeNum.includes(cleanNum))
        );
      });
    }

    return result;
  }, [rooms, filterTab, searchQuery]);

  // Cari Anime saat buat room
  useEffect(() => {
    if (!animeSearchQuery.trim()) {
      setAnimeSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingAnime(true);
      try {
        const res = await getAnimePage({ search: animeSearchQuery.trim(), perPage: 8 });
        setAnimeSearchResults(res.media ?? []);
      } catch {
        setAnimeSearchResults([]);
      } finally {
        setSearchingAnime(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [animeSearchQuery]);

  // Handle Klik Gabung Room
  const handleJoinRoom = (room: NobarRoom) => {
    hapticLight();
    if (room.is_private) {
      setTargetRoom(room);
      setInputtedPassword("");
      setPasswordError(null);
      setShowPasswordModal(true);
    } else {
      router.push(`/nobar/${room.id}` as never);
    }
  };

  // Submit Password Room Privat
  const handleSubmitPassword = () => {
    if (!targetRoom) return;

    if (!inputtedPassword.trim()) {
      setPasswordError("Harap masukkan password room.");
      hapticWarning();
      return;
    }

    if (inputtedPassword.trim() !== (targetRoom.password || "").trim()) {
      setPasswordError("Password salah. Silakan coba lagi.");
      hapticWarning();
      return;
    }

    hapticSuccess();
    setShowPasswordModal(false);
    router.push(`/nobar/${targetRoom.id}` as never);
  };

  // Submit Buat Room
  const handleCreateRoom = async () => {
    if (!selectedAnime) {
      Alert.alert("Perhatian", "Pilih anime yang ingin ditonton terlebih dahulu.");
      return;
    }

    if (!roomTitleInput.trim()) {
      Alert.alert("Perhatian", "Masukkan nama room nobar.");
      return;
    }

    if (isPrivateInput && !passwordInput.trim()) {
      Alert.alert("Perhatian", "Masukkan password untuk room privat.");
      return;
    }

    setSubmittingRoom(true);
    hapticLight();

    const hostId = auth.user?.id || `guest-${Date.now()}`;
    const hostName =
      auth.profile?.display_name ||
      auth.profile?.username ||
      auth.user?.user_metadata?.full_name ||
      "Host Nobar";
    const hostAvatar = auth.profile?.avatar_url || null;

    const finalEpisode = maxEpisodes
      ? Math.min(maxEpisodes, Math.max(1, episodeInput))
      : Math.max(1, episodeInput);

    const res = await createNobarRoom({
      title: roomTitleInput.trim(),
      anime_id: selectedAnime.id,
      anime_title: animeTitle(selectedAnime) || "Anime",
      anime_poster: selectedAnime.coverImage?.large || null,
      episode: finalEpisode,
      host_id: hostId,
      host_name: hostName,
      host_avatar: hostAvatar,
      is_private: isPrivateInput,
      password: isPrivateInput ? passwordInput.trim() : null,
    });

    setSubmittingRoom(false);

    if (res.success && res.data) {
      hapticSuccess();
      setShowCreateModal(false);
      setRoomTitleInput("");
      setSelectedAnime(null);
      setIsPrivateInput(false);
      setPasswordInput("");
      setEpisodeInput(1);
      router.push(`/nobar/${res.data.id}` as never);
    } else {
      hapticWarning();
      Alert.alert("Gagal", res.error || "Gagal membuat room nobar.");
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* ── 1. TOP HEADER BAR (SAMAKAN DENGAN RIWAYAT / LIBRARYVIEW) ── */}
      <View style={styles.topHeaderBar}>
        <View style={styles.headerLeftCol}>
          <View style={styles.headerTitleRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kembali"
              onPress={() => {
                hapticLight();
                router.back();
              }}
              style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
              hitSlop={10}
            >
              <AppIcon name="arrow-left" size={18} color="#FFFFFF" />
            </Pressable>

            <Text style={styles.topHeaderTitleText}>Nobar Anime</Text>
            <View style={styles.liveBadgeTop}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitleText}>Nonton bareng komunitas & teman</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buat Room Baru"
          onPress={() => {
            hapticLight();
            setShowCreateModal(true);
          }}
          style={({ pressed }) => [styles.createBtnTop, pressed && styles.btnPressed]}
        >
          <AppIcon name="plus" size={15} color="#0B0E17" />
          <Text style={styles.createBtnTopText}>Buat Room</Text>
        </Pressable>
      </View>

      {/* ── 2. SEARCH BAR (STYLE PERSIS SEARCHGLASSBAR DI LIBRARYVIEW) ── */}
      <View style={styles.controlsRow}>
        <View style={styles.searchGlassBar}>
          <AppIcon name="magnify" size={17} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari anime, room, host, atau #tag..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
              <AppIcon name="close" size={15} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── 3. FILTER TABS (CHIP ROW DENGAN WARNA SILVER PERSIS LIBRARYVIEW) ── */}
      <View style={styles.filterBar}>
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => {
              hapticLight();
              setFilterTab("all");
            }}
            style={[styles.chip, filterTab === "all" && styles.chipActive]}
          >
            <Text style={[styles.chipText, filterTab === "all" && styles.chipTextActive]}>
              Semua ({rooms.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              hapticLight();
              setFilterTab("public");
            }}
            style={[styles.chip, filterTab === "public" && styles.chipActive]}
          >
            <AppIcon
              name="earth"
              size={12}
              color={filterTab === "public" ? "#E2E8F0" : "#94A3B8"}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.chipText, filterTab === "public" && styles.chipTextActive]}>
              Publik
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              hapticLight();
              setFilterTab("private");
            }}
            style={[styles.chip, filterTab === "private" && styles.chipActive]}
          >
            <AppIcon
              name="lock"
              size={12}
              color={filterTab === "private" ? "#E2E8F0" : "#94A3B8"}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.chipText, filterTab === "private" && styles.chipTextActive]}>
              Privat
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── 4. ROOMS LIST (STYLE PERSIS GLASSCARD DI RIWAYAT) ── */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#CBD5E1" />
          <Text style={styles.loadingText}>Memuat room aktif...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#CBD5E1"
              colors={["#CBD5E1"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <AppIcon name="television-play" size={32} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyTitle}>Belum Ada Room Nobar Aktif</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? "Tidak ada room yang sesuai dengan pencarian."
                  : "Buat room nobar pertamamu sekarang dan ajak anggota lain menonton bersama."}
              </Text>
              <Pressable
                onPress={() => {
                  hapticLight();
                  setShowCreateModal(true);
                }}
                style={styles.emptyActionBtn}
              >
                <AppIcon name="plus" size={16} color="#0B0E17" />
                <Text style={styles.emptyActionBtnText}>Buat Room Sekarang</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleJoinRoom(item)}
              style={({ pressed }) => [styles.glassCard, pressed && styles.btnPressed]}
            >
              {/* Poster Cover */}
              <View style={styles.cardPosterWrap}>
                {item.anime_poster ? (
                  <Image
                    source={{ uri: item.anime_poster }}
                    style={styles.cardPoster}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={[styles.cardPoster, styles.placeholderPoster]}>
                    <AppIcon name="movie-open" size={24} color="#64748B" />
                  </View>
                )}
                <View style={styles.epBadge}>
                  <Text style={styles.epBadgeText}>EP {item.episode}</Text>
                </View>
              </View>

              {/* Card Body */}
              <View style={styles.cardBody}>
                <View style={styles.badgeRow}>
                  {/* Tag Nomor Room */}
                  <View style={styles.roomTagBadge}>
                    <Text style={styles.roomTagText}>{getRoomCode(item)}</Text>
                  </View>

                  <View style={styles.liveIndicatorBadge}>
                    <View style={styles.liveDotSmall} />
                    <Text style={styles.liveIndicatorText}>LIVE</Text>
                  </View>

                  {item.is_private ? (
                    <View style={styles.privateBadge}>
                      <AppIcon name="lock" size={10} color="#CBD5E1" />
                      <Text style={styles.privateBadgeText}>Privat</Text>
                    </View>
                  ) : (
                    <View style={styles.publicBadge}>
                      <AppIcon name="earth" size={10} color="#94A3B8" />
                      <Text style={styles.publicBadgeText}>Publik</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>

                <Text style={styles.cardAnimeTitle} numberOfLines={1}>
                  {item.anime_title}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.cardHostRow}>
                    {item.host_avatar ? (
                      <Image
                        source={{ uri: item.host_avatar }}
                        style={styles.cardHostAvatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.cardHostAvatar, styles.placeholderAvatar]}>
                        <Text style={styles.placeholderAvatarText}>
                          {(item.host_name || "H").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.cardHostName} numberOfLines={1}>
                      {item.host_name}
                    </Text>
                  </View>

                  <View style={styles.joinBtn}>
                    <Text style={styles.joinBtnText}>Gabung</Text>
                    <AppIcon name="chevron-right" size={13} color="#E2E8F0" />
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* ── MODAL: BUAT ROOM (SILVER GLASS THEME) ── */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Buat Room Nobar</Text>
                <Text style={styles.modalSubtitle}>Pilih anime dan atur privasi room</Text>
              </View>
              <Pressable
                onPress={() => setShowCreateModal(false)}
                style={styles.modalCloseBtn}
                hitSlop={10}
              >
                <AppIcon name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
              {/* 1. Nama Room */}
              <Text style={styles.inputLabel}>Nama Room</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Contoh: Nobar Solo Leveling"
                placeholderTextColor="#64748B"
                value={roomTitleInput}
                onChangeText={setRoomTitleInput}
                maxLength={50}
              />

              {/* 2. Pilih Anime */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Pilih Anime</Text>
              {selectedAnime ? (
                <View style={styles.selectedAnimeBox}>
                  <Image
                    source={{ uri: selectedAnime.coverImage?.large || undefined }}
                    style={styles.selectedAnimeCover}
                    contentFit="cover"
                  />
                  <View style={styles.selectedAnimeMeta}>
                    <Text style={styles.selectedAnimeTitle} numberOfLines={2}>
                      {animeTitle(selectedAnime)}
                    </Text>
                    <Text style={styles.selectedAnimeEpisodes}>
                      Total Episode: {selectedAnime.episodes || "Ongoing"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSelectedAnime(null)}
                    style={styles.changeAnimeBtn}
                  >
                    <Text style={styles.changeAnimeText}>Ganti</Text>
                  </Pressable>
                </View>
              ) : (
                <View>
                  <View style={styles.animeSearchInputWrap}>
                    <AppIcon name="magnify" size={16} color="#64748B" />
                    <TextInput
                      style={styles.animeSearchInput}
                      placeholder="Ketik judul anime..."
                      placeholderTextColor="#64748B"
                      value={animeSearchQuery}
                      onChangeText={setAnimeSearchQuery}
                    />
                    {searchingAnime ? (
                      <ActivityIndicator size="small" color="#CBD5E1" />
                    ) : null}
                  </View>

                  {animeSearchResults.length > 0 && (
                    <View style={styles.animeResultsList}>
                      {animeSearchResults.map((anime) => (
                        <Pressable
                          key={anime.id}
                          onPress={() => {
                            hapticLight();
                            setSelectedAnime(anime);
                            setAnimeSearchQuery("");
                            setAnimeSearchResults([]);
                          }}
                          style={styles.animeResultItem}
                        >
                          <Image
                            source={{ uri: anime.coverImage?.large || undefined }}
                            style={styles.animeResultThumb}
                            contentFit="cover"
                          />
                          <View style={styles.animeResultInfo}>
                            <Text style={styles.animeResultTitle} numberOfLines={1}>
                              {animeTitle(anime)}
                            </Text>
                            <Text style={styles.animeResultSub}>
                              {anime.format || "TV"} • {anime.episodes ? `${anime.episodes} Eps` : "Ongoing"}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* 3. Mulai Dari Episode */}
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>Mulai Dari Episode</Text>
                {maxEpisodes ? (
                  <View style={styles.maxEpBadge}>
                    <Text style={styles.maxEpBadgeText}>Maks. {maxEpisodes} Eps</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.episodePickerRow}>
                <Pressable
                  onPress={() => {
                    if (episodeInput <= 1) {
                      hapticWarning();
                      return;
                    }
                    hapticLight();
                    setEpisodeInput((e) => Math.max(1, e - 1));
                  }}
                  style={[
                    styles.episodeStepBtn,
                    episodeInput <= 1 && styles.episodeStepBtnDisabled,
                  ]}
                  disabled={episodeInput <= 1}
                >
                  <AppIcon
                    name="minus"
                    size={16}
                    color={episodeInput <= 1 ? "#475569" : "#E2E8F0"}
                  />
                </Pressable>
                <TextInput
                  style={styles.episodeInput}
                  keyboardType="numeric"
                  value={String(episodeInput)}
                  onChangeText={(val) => {
                    const digits = val.replace(/[^0-9]/g, "");
                    if (!digits) {
                      setEpisodeInput(1);
                      return;
                    }
                    let parsed = parseInt(digits, 10);
                    if (isNaN(parsed) || parsed < 1) parsed = 1;
                    if (maxEpisodes && parsed > maxEpisodes) {
                      parsed = maxEpisodes;
                      hapticWarning();
                    }
                    setEpisodeInput(parsed);
                  }}
                />
                <Pressable
                  onPress={() => {
                    if (maxEpisodes && episodeInput >= maxEpisodes) {
                      hapticWarning();
                      return;
                    }
                    hapticLight();
                    setEpisodeInput((e) => (maxEpisodes ? Math.min(maxEpisodes, e + 1) : e + 1));
                  }}
                  style={[
                    styles.episodeStepBtn,
                    Boolean(maxEpisodes && episodeInput >= maxEpisodes) &&
                      styles.episodeStepBtnDisabled,
                  ]}
                  disabled={Boolean(maxEpisodes && episodeInput >= maxEpisodes)}
                >
                  <AppIcon
                    name="plus"
                    size={16}
                    color={
                      maxEpisodes && episodeInput >= maxEpisodes ? "#475569" : "#E2E8F0"
                    }
                  />
                </Pressable>
              </View>

              {maxEpisodes && episodeInput >= maxEpisodes ? (
                <Text style={styles.episodeLimitNote}>
                  Episode telah mencapai batas maksimal ({maxEpisodes} episode).
                </Text>
              ) : null}

              {/* 4. Privasi Room (Publik / Privat) */}
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Privasi Room</Text>
              <View style={styles.privacyOptionRow}>
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setIsPrivateInput(false);
                  }}
                  style={[
                    styles.privacyOptionCard,
                    !isPrivateInput && styles.privacyOptionCardActive,
                  ]}
                >
                  <AppIcon
                    name="earth"
                    size={18}
                    color={!isPrivateInput ? "#E2E8F0" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.privacyOptionTitle,
                      !isPrivateInput && styles.privacyOptionTitleActive,
                    ]}
                  >
                    Publik
                  </Text>
                  <Text style={styles.privacyOptionDesc}>Siapa saja bebas masuk</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    hapticLight();
                    setIsPrivateInput(true);
                  }}
                  style={[
                    styles.privacyOptionCard,
                    isPrivateInput && styles.privacyOptionCardActive,
                  ]}
                >
                  <AppIcon
                    name="lock"
                    size={18}
                    color={isPrivateInput ? "#E2E8F0" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.privacyOptionTitle,
                      isPrivateInput && styles.privacyOptionTitleActive,
                    ]}
                  >
                    Privat
                  </Text>
                  <Text style={styles.privacyOptionDesc}>Perlu password room</Text>
                </Pressable>
              </View>

              {/* 5. Password Input jika Privat */}
              {isPrivateInput && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.inputLabel}>Password / PIN Room</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Masukkan password"
                    placeholderTextColor="#64748B"
                    value={passwordInput}
                    onChangeText={setPasswordInput}
                    secureTextEntry
                    maxLength={16}
                  />
                </View>
              )}

              {/* Tombol Buat */}
              <Pressable
                onPress={handleCreateRoom}
                disabled={submittingRoom}
                style={[styles.submitCreateBtn, submittingRoom && { opacity: 0.6 }]}
              >
                {submittingRoom ? (
                  <ActivityIndicator size="small" color="#0B0E17" />
                ) : (
                  <>
                    <AppIcon name="play-circle" size={18} color="#0B0E17" />
                    <Text style={styles.submitCreateBtnText}>Mulai Room Nobar</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: PASSWORD PROMPT UNTUK GABUNG PRIVAT ── */}
      <Modal
        visible={showPasswordModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.passwordCard}>
            <View style={styles.lockIconCircle}>
              <AppIcon name="lock" size={24} color="#E2E8F0" />
            </View>

            <Text style={styles.passwordModalTitle}>Room Terkunci</Text>
            <Text style={styles.passwordModalSubtitle}>
              Room "{targetRoom?.title}" membutuhkan password untuk bergabung.
            </Text>

            <TextInput
              style={[styles.textInput, styles.passwordInputBox]}
              placeholder="Masukkan password room"
              placeholderTextColor="#64748B"
              value={inputtedPassword}
              onChangeText={(t) => {
                setInputtedPassword(t);
                setPasswordError(null);
              }}
              secureTextEntry
              autoFocus
            />

            {passwordError ? (
              <Text style={styles.passwordErrorText}>{passwordError}</Text>
            ) : null}

            <View style={styles.passwordActionRow}>
              <Pressable
                onPress={() => setShowPasswordModal(false)}
                style={styles.passwordCancelBtn}
              >
                <Text style={styles.passwordCancelText}>Batal</Text>
              </Pressable>

              <Pressable
                onPress={handleSubmitPassword}
                style={styles.passwordJoinBtn}
              >
                <Text style={styles.passwordJoinText}>Masuk</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E17",
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  // Top Header (Sama dengan Riwayat / LibraryView)
  topHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerLeftCol: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  topHeaderTitleText: {
    fontFamily: "Nunito-Black",
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  liveBadgeTop: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    gap: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#EF4444",
  },
  liveBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    color: "#EF4444",
    letterSpacing: 0.5,
  },
  headerSubtitleText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    marginTop: 2,
    marginLeft: 42,
  },
  createBtnTop: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    gap: 4,
  },
  createBtnTopText: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
    color: "#0B0E17",
    letterSpacing: 0.4,
  },
  // Controls Row: Search Bar (Sama dengan searchGlassBar LibraryView)
  controlsRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchGlassBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-SemiBold",
    color: "#FFFFFF",
    fontSize: 12.5,
    paddingVertical: 0,
  },
  // Filter Bar (Sama dengan chipRow LibraryView)
  filterBar: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  chipActive: {
    borderColor: "rgba(226, 232, 240, 0.35)",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  chipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#94A3B8",
    letterSpacing: 0.3,
  },
  chipTextActive: {
    color: "#E2E8F0",
    fontFamily: "Nunito-Black",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    fontFamily: "Nunito-Regular",
    marginTop: 10,
    fontSize: 12,
    color: "#94A3B8",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  // Liquid Glass Card (Persis glassCard di LibraryView)
  glassCard: {
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  cardPosterWrap: {
    width: 68,
    height: 96,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#161B26",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cardPoster: {
    width: "100%",
    height: "100%",
  },
  placeholderPoster: {
    alignItems: "center",
    justifyContent: "center",
  },
  epBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(11, 14, 23, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.3)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  epBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
    color: "#CBD5E1",
  },
  cardBody: {
    flex: 1,
    justifyContent: "center",
    gap: 3,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roomTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  roomTagText: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  liveIndicatorBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.14)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    gap: 3,
  },
  liveDotSmall: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#EF4444",
  },
  liveIndicatorText: {
    fontFamily: "Nunito-Bold",
    fontSize: 8.5,
    color: "#EF4444",
  },
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    gap: 3,
  },
  privateBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 8.5,
    color: "#CBD5E1",
  },
  publicBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    gap: 3,
  },
  publicBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 8.5,
    color: "#94A3B8",
  },
  cardTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
    marginTop: 1,
  },
  cardAnimeTitle: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  cardHostRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  cardHostAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  placeholderAvatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderAvatarText: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
    color: "#CBD5E1",
  },
  cardHostName: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginLeft: 6,
    flex: 1,
  },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 5,
    gap: 2,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.22)",
  },
  joinBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#E2E8F0",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  emptyTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#FFFFFF",
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6,
    marginTop: 18,
    gap: 6,
  },
  emptyActionBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#0B0E17",
  },
  // Modal Styles (Silver Glass)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#131722",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "85%",
    padding: 18,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 17,
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    flexShrink: 1,
  },
  inputLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: "Nunito-SemiBold",
    fontSize: 12.5,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  animeSearchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 8,
  },
  animeSearchInput: {
    flex: 1,
    fontFamily: "Nunito-SemiBold",
    fontSize: 12.5,
    color: "#FFFFFF",
    padding: 0,
  },
  animeResultsList: {
    backgroundColor: "#161B26",
    borderRadius: 6,
    marginTop: 6,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  animeResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  animeResultThumb: {
    width: 32,
    height: 44,
    borderRadius: 4,
    backgroundColor: "#0B0E17",
  },
  animeResultInfo: {
    marginLeft: 10,
    flex: 1,
  },
  animeResultTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  animeResultSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  selectedAnimeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.3)",
  },
  selectedAnimeCover: {
    width: 40,
    height: 56,
    borderRadius: 4,
  },
  selectedAnimeMeta: {
    flex: 1,
    marginLeft: 10,
  },
  selectedAnimeTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  selectedAnimeEpisodes: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#CBD5E1",
    marginTop: 2,
  },
  changeAnimeBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  changeAnimeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#E2E8F0",
  },
  inputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 6,
  },
  maxEpBadge: {
    backgroundColor: "rgba(226, 232, 240, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.25)",
  },
  maxEpBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#CBD5E1",
  },
  episodePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  episodeStepBtn: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  episodeStepBtnDisabled: {
    opacity: 0.35,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  episodeLimitNote: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 6,
  },
  episodeInput: {
    width: 54,
    height: 38,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    textAlign: "center",
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  privacyOptionRow: {
    flexDirection: "row",
    gap: 8,
  },
  privacyOptionCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  privacyOptionCardActive: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderColor: "rgba(226, 232, 240, 0.4)",
  },
  privacyOptionTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 4,
  },
  privacyOptionTitleActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },
  privacyOptionDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 9.5,
    color: "#64748B",
    marginTop: 2,
    textAlign: "center",
  },
  submitCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2E8F0",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    gap: 6,
  },
  submitCreateBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#0B0E17",
    letterSpacing: 0.3,
  },
  // Password Prompt Card
  passwordCard: {
    backgroundColor: "#131722",
    marginHorizontal: 24,
    marginBottom: "auto",
    marginTop: "auto",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
  },
  lockIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.25)",
  },
  passwordModalTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#FFFFFF",
    textAlign: "center",
  },
  passwordModalSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
  },
  passwordInputBox: {
    width: "100%",
    marginTop: 14,
    textAlign: "center",
  },
  passwordErrorText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#EF4444",
    marginTop: 6,
  },
  passwordActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    width: "100%",
  },
  passwordCancelBtn: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  passwordCancelText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  passwordJoinBtn: {
    flex: 1,
    backgroundColor: "#E2E8F0",
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: "center",
  },
  passwordJoinText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#0B0E17",
  },
});
