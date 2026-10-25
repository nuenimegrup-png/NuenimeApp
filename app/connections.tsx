import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Image } from "expo-image";
import { AppIcon } from "@/components/app-icon";
import { BorderAvatar } from "@/components/border-avatar";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { isSpecialRole } from "@/lib/admin-service";
import { UserVerificationBadge } from "@/components/user-verification-badge";
import {
  type FriendUser,
  getFriends,
  getIncomingFriendRequests,
  acceptFriendRequest,
  rejectOrCancelFriendRequest,
  sendFriendRequest,
  searchUsers,
  unfriendUser,
} from "@/lib/friends-service";
import { getTierForLevel } from "@/components/level-progress-modal";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

export default function ConnectionsScreen() {
  const auth = useAnirakuAuth();
  const currentUserId = auth.user?.id;

  const [activeTab, setActiveTab] = useState<"teman" | "permintaan">("teman");
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [requests, setRequests] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search in Friends list
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  // Modals
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showFriendOptionsModal, setShowFriendOptionsModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendUser | null>(null);

  // Add Friend Search Modal State
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [requestSentIds, setRequestSentIds] = useState<Set<string>>(new Set());

  // Load friends and requests
  const loadData = useCallback(async () => {
    if (!currentUserId || currentUserId === "guest") {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [friendList, requestList] = await Promise.all([
        getFriends(currentUserId),
        getIncomingFriendRequests(currentUserId),
      ]);
      setFriends(friendList);
      setRequests(requestList);
    } catch (err) {
      console.warn("[connections] Error loading data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Filtered friends
  const filteredFriends = useMemo(() => {
    if (!searchFilter.trim()) return friends;
    const q = searchFilter.toLowerCase();
    return friends.filter(
      (f) =>
        f.displayName.toLowerCase().includes(q) ||
        f.username.toLowerCase().includes(q) ||
        f.memberNumber.toLowerCase().includes(q)
    );
  }, [friends, searchFilter]);

  // Handle Accept Request
  const handleAccept = async (requesterId: string) => {
    if (!currentUserId) return;
    hapticSuccess();
    setRequests((prev) => prev.filter((r) => r.id !== requesterId));
    await acceptFriendRequest(
      currentUserId,
      requesterId,
      auth.profile?.display_name || auth.profile?.username
    );
    loadData();
  };

  // Handle Reject Request
  const handleReject = async (requesterId: string) => {
    if (!currentUserId) return;
    hapticLight();
    setRequests((prev) => prev.filter((r) => r.id !== requesterId));
    await rejectOrCancelFriendRequest(
      currentUserId,
      requesterId,
      auth.profile?.display_name || auth.profile?.username
    );
  };

  // Auto-search realtime as user types (300ms debounce)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const res = await searchUsers(searchQuery, currentUserId);
          setSearchResults(res);
          setHasSearched(true);
        } catch (err) {
          console.warn("[connections] search error:", err);
        } finally {
          setSearching(false);
        }
      })();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUserId]);

  // Handle Search Users in Add Friend modal
  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    hapticLight();
    try {
      const res = await searchUsers(searchQuery, currentUserId);
      setSearchResults(res);
      setHasSearched(true);
    } catch (err) {
      console.warn("[connections] search error:", err);
    } finally {
      setSearching(false);
    }
  };

  // Handle Send Friend Request
  const handleSendRequest = async (targetId: string) => {
    if (!currentUserId) return;
    hapticLight();
    setRequestSentIds((prev) => new Set(prev).add(targetId));
    await sendFriendRequest(
      currentUserId,
      targetId,
      auth.profile?.display_name || auth.profile?.username
    );
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* ─── 1. TOP HEADER ─── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.btnPressed]}
          >
            <AppIcon name="arrow-left" size={22} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Connections</Text>
        </View>

        <View style={styles.headerRight}>
          {/* Chat Global Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chat Global"
            onPress={() => {
              hapticLight();
              router.push("/chat-global" as never);
            }}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.btnPressed]}
          >
            <AppIcon name="forum" size={21} color="#38BDF8" />
          </Pressable>

          {/* Info Modal Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Info Chat"
            onPress={() => {
              hapticLight();
              setShowInfoModal(true);
            }}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.btnPressed]}
          >
            <AppIcon name="information" size={21} color="#CBD5E1" />
          </Pressable>

          {/* Search Toggle Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSearchOpen ? "Tutup pencarian" : "Cari teman"}
            onPress={() => {
              hapticLight();
              setIsSearchOpen((prev) => !prev);
              if (isSearchOpen) setSearchFilter("");
            }}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.btnPressed]}
          >
            <AppIcon name={isSearchOpen ? "close" : "magnify"} size={21} color="#CBD5E1" />
          </Pressable>

          {/* Add Friend Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tambah Teman"
            onPress={() => {
              hapticLight();
              setShowAddFriendModal(true);
            }}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.btnPressed]}
          >
            <AppIcon name="account-plus" size={22} color="#CBD5E1" />
          </Pressable>
        </View>
      </View>

      {/* ─── 1B. SEARCH BAR (COLLAPSIBLE) ─── */}
      {isSearchOpen && (
        <View style={styles.searchBarWrap}>
          <View style={styles.searchBarInner}>
            <AppIcon name="magnify" size={17} color="#64748B" />
            <TextInput
              value={searchFilter}
              onChangeText={setSearchFilter}
              placeholder="Cari teman berdasarkan nama atau ID..."
              placeholderTextColor="#64748B"
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
            />
            {searchFilter ? (
              <Pressable onPress={() => setSearchFilter("")}>
                <AppIcon name="close-circle" size={16} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      {/* ─── 2. TABS: TEMAN & PERMINTAAN ─── */}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => {
            hapticLight();
            setActiveTab("teman");
          }}
          style={styles.tabItem}
        >
          <Text style={[styles.tabText, activeTab === "teman" && styles.tabTextActive]}>
            Teman
          </Text>
          {activeTab === "teman" && <View style={styles.activeTabIndicator} />}
        </Pressable>

        <Pressable
          onPress={() => {
            hapticLight();
            setActiveTab("permintaan");
          }}
          style={styles.tabItem}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[styles.tabText, activeTab === "permintaan" && styles.tabTextActive]}>
              Permintaan
            </Text>
            {requests.length > 0 && (
              <View style={styles.reqBadge}>
                <Text style={styles.reqBadgeText}>{requests.length}</Text>
              </View>
            )}
          </View>
          {activeTab === "permintaan" && <View style={styles.activeTabIndicator} />}
        </Pressable>
      </View>

      {/* ─── 3. CONTENT AREA ─── */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Menghubungkan jaringan teman...</Text>
        </View>
      ) : activeTab === "teman" ? (
        /* TAB TEMAN */
        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const tierInfo = getTierForLevel(item.level || 1);
            const activeTier = tierInfo?.currentTier;
            const tierName = activeTier?.name || "Member";
            const isSpecial = isSpecialRole(item.role);
            const cleanMemberNum =
              "#" + (String(item.memberNumber).replace(/[^0-9]/g, "").replace(/^0+/, "") || "1");

            return (
              <Pressable
                onPress={() => {
                  hapticLight();
                  setSelectedFriend(item);
                  setShowFriendOptionsModal(true);
                }}
                style={({ pressed }) => [styles.friendCard, pressed && styles.btnPressed]}
              >
                {/* Avatar with live border */}
                <View style={styles.avatarWrap}>
                  <BorderAvatar
                    size={46}
                    borderId={item.equippedBorder}
                    avatarUrl={item.avatarUrl || "https://images.alphacoders.com/132/1328004.png"}
                  />
                </View>

                {/* Info Column */}
                <View style={styles.friendInfoCol}>
                  <View style={styles.nameRow}>
                    <Text style={styles.displayNameText} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    <UserVerificationBadge role={item.role} isVip={item.isVip} size={14} />
                  </View>

                  <View style={styles.badgesRow}>
                    {/* Level Pill */}
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
                        Lvl {item.level.toLocaleString("id-ID")}
                      </Text>
                    </View>

                    {/* Tier Pill */}
                    <View style={styles.tierPill}>
                      <Text style={styles.tierPillText}>{tierName.toUpperCase()}</Text>
                    </View>

                    {/* Member Number */}
                    <Text style={styles.memberNumberText}>{cleanMemberNum}</Text>
                  </View>
                </View>

                {/* Right Chat Bubble Icon (Langsung Masuk Room Chat) */}
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    hapticLight();
                    router.push(`/chat/${item.id}` as never);
                  }}
                  style={({ pressed }) => [styles.chatIconBtn, pressed && styles.btnPressed]}
                >
                  <AppIcon name="comment-text" size={22} color="#38BDF8" />
                </Pressable>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <AppIcon name="account-group-outline" size={48} color="#475569" />
              <Text style={styles.emptyTitle}>Belum ada teman terhubung</Text>
              <Text style={styles.emptySubtitle}>
                Cari teman menggunakan tombol tambah di kanan atas untuk mulai berinteraksi!
              </Text>
            </View>
          }
        />
      ) : (
        /* TAB PERMINTAAN */
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const tierInfo = getTierForLevel(item.level || 1);
            const activeTier = tierInfo?.currentTier;
            const tierName = activeTier?.name || "Member";
            const isSpecial = isSpecialRole(item.role);
            const cleanMemberNum =
              "#" + (String(item.memberNumber).replace(/[^0-9]/g, "").replace(/^0+/, "") || "1");

            return (
              <View style={styles.requestCard}>
                {/* Pressable kiri → profil */}
                <Pressable
                  onPress={() => { hapticLight(); router.push(`/user/${item.id}` as never); }}
                  style={styles.requestLeft}
                >
                  <BorderAvatar
                    size={46}
                    borderId={item.equippedBorder}
                    avatarUrl={item.avatarUrl || "https://images.alphacoders.com/132/1328004.png"}
                  />

                  {/* Info Column */}
                  <View style={styles.friendInfoCol}>
                    {/* Nama + Verified Badge */}
                    <View style={styles.nameRow}>
                      <Text style={styles.displayNameText} numberOfLines={1}>
                        {item.displayName}
                      </Text>
                      <UserVerificationBadge role={item.role} isVip={item.isVip} size={14} />
                    </View>

                    {/* Level + Tier + Member Number */}
                    <View style={styles.badgesRow}>
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
                          Lvl {item.level.toLocaleString("id-ID")}
                        </Text>
                      </View>
                      <View style={styles.tierPill}>
                        <Text style={styles.tierPillText}>{tierName.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.memberNumberText}>{cleanMemberNum}</Text>
                    </View>
                  </View>
                </Pressable>

                {/* Tombol Aksi */}
                <View style={styles.requestActionRow}>
                  <Pressable
                    onPress={() => handleAccept(item.id)}
                    style={({ pressed }) => [styles.acceptBtn, pressed && styles.btnPressed]}
                  >
                    <AppIcon name="check" size={13} color="#FFFFFF" />
                    <Text style={styles.acceptBtnText}>Terima</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleReject(item.id)}
                    style={({ pressed }) => [styles.rejectBtn, pressed && styles.btnPressed]}
                  >
                    <Text style={styles.rejectBtnText}>Tolak</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Belum ada permintaan</Text>
              <Text style={styles.emptySubtitle}>
                Permintaan teman masuk/terkirim akan muncul di sini.
              </Text>
            </View>
          }
        />
      )}

      {/* ─── 4. FLOATING ACTION BUTTON (BOTTOM RIGHT) ─── */}
      <Pressable
        onPress={() => {
          hapticLight();
          setShowInfoModal(true);
        }}
        style={({ pressed }) => [styles.floatingCameraBtn, pressed && styles.btnPressed]}
      >
        <AppIcon name="account-plus" size={20} color="#38BDF8" />
      </Pressable>

      {/* ─── 5. MODAL: INFO CHAT PRIVATE ─── */}
      <Modal visible={showInfoModal} transparent animationType="fade" onRequestClose={() => setShowInfoModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowInfoModal(false)}>
          <Pressable style={styles.infoModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.infoModalTitle}>Info Chat Private</Text>
            <Text style={styles.infoModalBody}>
              Pesan chat private disimpan sementara di server dan akan dihapus otomatis setelah 7 hari. Mohon tetap sopan, saling menghormati, dan gunakan fitur chat dengan bijak.
            </Text>
            <Pressable
              onPress={() => {
                hapticLight();
                setShowInfoModal(false);
              }}
              style={styles.infoModalBtn}
            >
              <Text style={styles.infoModalBtnText}>Mengerti</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── 6. MODAL / SCREEN: CARI TEMAN (MATCHES SCREENSHOT 3) ─── */}
      <Modal visible={showAddFriendModal} transparent animationType="slide" onRequestClose={() => setShowAddFriendModal(false)}>
        <SafeAreaView edges={["top", "bottom"]} style={styles.searchModalContainer}>
          {/* Header Cari Teman */}
          <View style={styles.searchModalHeader}>
            <Pressable
              onPress={() => setShowAddFriendModal(false)}
              style={({ pressed }) => [styles.headerBtn, pressed && styles.btnPressed]}
            >
              <AppIcon name="arrow-left" size={22} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Cari Teman</Text>
          </View>

          {/* Search Input Row */}
          <View style={styles.searchRow}>
            <View style={styles.searchModalInputWrap}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="User ID / Username / #Nomor"
                placeholderTextColor="#64748B"
                style={styles.searchModalInput}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={handleSearchUsers}
              />
            </View>
            <Pressable
              disabled={searching || !searchQuery.trim()}
              onPress={handleSearchUsers}
              style={({ pressed }) => [styles.cariBtn, pressed && styles.btnPressed]}
            >
              {searching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.cariBtnText}>Cari</Text>
              )}
            </Pressable>
          </View>

          {/* Results List */}
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSent = requestSentIds.has(item.id);
              const isAlreadyFriend = friends.some((f) => f.id === item.id);
              const srTierInfo = getTierForLevel(item.level || 1);
              const srActiveTier = srTierInfo?.currentTier;
              const srTierName = srActiveTier?.name || "Member";
              const srIsSpecial = isSpecialRole(item.role);
              const srCleanNum =
                "#" + (String(item.memberNumber).replace(/[^0-9]/g, "").replace(/^0+/, "") || "1");

              return (
                <View style={styles.searchResultCard}>
                  <Pressable
                    onPress={() => {
                      setShowAddFriendModal(false);
                      router.push(`/user/${item.id}` as never);
                    }}
                    style={styles.searchResultLeft}
                  >
                    <BorderAvatar
                      size={44}
                      borderId={item.equippedBorder}
                      avatarUrl={item.avatarUrl || "https://images.alphacoders.com/132/1328004.png"}
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      {/* Name + Checkmark */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Text style={styles.displayNameText} numberOfLines={1}>
                          {item.displayName}
                        </Text>
                        <UserVerificationBadge role={item.role} isVip={item.isVip} size={13} />
                      </View>
                      {/* Level + Tier + Member Number */}
                      <View style={styles.badgesRow}>
                        <View style={styles.levelPill}>
                          {srActiveTier?.imageUrl && (
                            <Image
                              source={{ uri: srActiveTier.imageUrl }}
                              style={styles.tierPillIcon}
                              contentFit="contain"
                              cachePolicy="memory-disk"
                            />
                          )}
                          <Text style={styles.levelPillText}>
                            Lvl {item.level.toLocaleString("id-ID")}
                          </Text>
                        </View>
                        <View style={styles.tierPill}>
                          <Text style={styles.tierPillText}>{srTierName.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.memberNumberText}>{srCleanNum}</Text>
                      </View>
                    </View>
                  </Pressable>

                  {item.id === currentUserId ? (
                    <View style={styles.ownAccountBadge}>
                      <Text style={styles.ownAccountText}>Akun Anda</Text>
                    </View>
                  ) : isAlreadyFriend ? (
                    <View style={styles.alreadyFriendBadge}>
                      <AppIcon name="check" size={12} color="#34D399" />
                      <Text style={styles.alreadyFriendText}>Berteman</Text>
                    </View>
                  ) : isSent ? (
                    <View style={styles.sentBadge}>
                      <Text style={styles.sentBadgeText}>Terkirim</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleSendRequest(item.id)}
                      style={({ pressed }) => [styles.addFriendActionBtn, pressed && styles.btnPressed]}
                    >
                      <AppIcon name="account-plus" size={14} color="#FFFFFF" />
                      <Text style={styles.addFriendActionText}>Tambah</Text>
                    </Pressable>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              searching ? (
                <View style={styles.emptyWrap}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                  <Text style={styles.emptySubtitle}>Mencari pengguna...</Text>
                </View>
              ) : hasSearched && searchQuery.trim().length > 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>Pengguna tidak ditemukan</Text>
                  <Text style={styles.emptySubtitle}>
                    Pastikan User ID, username, atau nomor member yang Anda masukkan sudah benar.
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <AppIcon name="account-search-outline" size={42} color="#475569" />
                  <Text style={styles.emptyTitle}>Cari Berdasarkan Nomor / Nama</Text>
                  <Text style={styles.emptySubtitle}>
                    Ketik nomor member (misal 0001, 0005) atau username di kolom pencarian di atas.
                  </Text>
                </View>
              )
            }
          />
        </SafeAreaView>
      </Modal>
      {/* ─── 7. BOTTOM SHEET MODAL: FRIEND OPTIONS (PERSIS SCREENSHOT 2) ─── */}
      <Modal
        visible={showFriendOptionsModal && Boolean(selectedFriend)}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFriendOptionsModal(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setShowFriendOptionsModal(false)}
        >
          <Pressable style={styles.bottomSheetCard} onPress={(e) => e.stopPropagation()}>
            {/* Grab Handle */}
            <View style={styles.sheetGrabHandle} />

            {/* Friend Header Preview */}
            {selectedFriend && (() => {
              const sfTier = getTierForLevel(selectedFriend.level).currentTier;
              const sfSpecial = isSpecialRole(selectedFriend.role);
              const sfCleanNum =
                "#" + (String(selectedFriend.memberNumber).replace(/[^0-9]/g, "").replace(/^0+/, "") || "1");

              return (
                <View style={styles.sheetFriendHeader}>
                  <BorderAvatar
                    size={46}
                    borderId={selectedFriend.equippedBorder}
                    avatarUrl={selectedFriend.avatarUrl || "https://images.alphacoders.com/132/1328004.png"}
                  />
                  <View style={styles.sheetFriendInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.displayNameText} numberOfLines={1}>
                        {selectedFriend.displayName}
                      </Text>
                      <AppIcon
                        name={sfSpecial ? "check-decagram" : "check-circle"}
                        size={14}
                        color={sfSpecial ? "#EF4444" : "#38BDF8"}
                      />
                    </View>
                    <View style={styles.badgesRow}>
                      <View style={styles.levelPill}>
                        {sfTier?.imageUrl && (
                          <Image
                            source={{ uri: sfTier.imageUrl }}
                            style={styles.tierPillIcon}
                            contentFit="contain"
                            cachePolicy="memory-disk"
                          />
                        )}
                        <Text style={styles.levelPillText}>
                          Lvl {selectedFriend.level.toLocaleString("id-ID")}
                        </Text>
                      </View>
                      <View style={styles.tierPill}>
                        <Text style={styles.tierPillText}>
                          {sfTier.name.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.memberNumberText}>{sfCleanNum}</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            <View style={styles.sheetDivider} />

            {/* Opsi 1: Lihat Profil */}
            <Pressable
              onPress={() => {
                if (!selectedFriend) return;
                setShowFriendOptionsModal(false);
                hapticLight();
                router.push(`/user/${selectedFriend.id}` as never);
              }}
              style={({ pressed }) => [styles.sheetActionRow, pressed && styles.btnPressed]}
            >
              <AppIcon name="account" size={20} color="#CBD5E1" />
              <Text style={styles.sheetActionText}>Lihat Profil</Text>
            </Pressable>

            <View style={styles.sheetDivider} />

            {/* Opsi 2: Hapus Teman */}
            <Pressable
              onPress={async () => {
                if (!selectedFriend || !currentUserId) return;
                hapticLight();
                const friendToDelete = selectedFriend;
                setShowFriendOptionsModal(false);

                const doUnfriend = async () => {
                  setFriends((prev) => prev.filter((f) => f.id !== friendToDelete.id));
                  await unfriendUser(currentUserId, friendToDelete.id);
                  loadData();
                };

                if (Platform.OS === "web") {
                  if (confirm(`Hapus ${friendToDelete.displayName} dari daftar teman?`)) {
                    await doUnfriend();
                  }
                } else {
                  Alert.alert(
                    "Hapus Teman",
                    `Apakah Anda yakin ingin menghapus ${friendToDelete.displayName} dari daftar teman?`,
                    [
                      { text: "Batal", style: "cancel" },
                      { text: "Hapus", style: "destructive", onPress: doUnfriend },
                    ]
                  );
                }
              }}
              style={({ pressed }) => [styles.sheetActionRow, pressed && styles.btnPressed]}
            >
              <AppIcon name="trash-can-outline" size={20} color="#F87171" />
              <Text style={[styles.sheetActionText, { color: "#F87171" }]}>Hapus Teman</Text>
            </Pressable>
          </Pressable>
        </Pressable>
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
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  // ─── HEADER ───
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerBtn: {
    padding: 6,
    borderRadius: 8,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  headerTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // ─── SEARCH BAR IN HEADER ───
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchBarInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#161B26",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#FFFFFF",
    padding: 0,
  },

  // ─── TABS ───
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
  },
  tabText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#94A3B8",
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontFamily: "Nunito-Black",
  },
  activeTabIndicator: {
    position: "absolute",
    bottom: 0,
    width: 42,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "#EF4444",
  },
  reqBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  reqBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
    color: "#FFFFFF",
  },

  // ─── LIST & CARDS ───
  listContent: {
    padding: 16,
    gap: 10,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  avatarWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  friendInfoCol: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  displayNameText: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  tierPillIcon: {
    width: 13,
    height: 13,
  },
  levelPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#34D399",
  },
  tierPill: {
    backgroundColor: "rgba(168, 85, 247, 0.16)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  tierPillText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    color: "#C084FC",
    letterSpacing: 0.5,
  },
  memberNumberText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
  },
  chatIconBtn: {
    padding: 8,
    borderRadius: 8,
  },

  // ─── REQUEST CARD (glassmorphism, matches Teman card) ───
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.75)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  requestLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  requestActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    shadowColor: "#10B981",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 2,
  },
  acceptBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },
  rejectBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.13)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  rejectBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
    letterSpacing: 0.1,
  },

  // ─── EMPTY & LOADING ───
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },

  // ─── FLOATING CAMERA BUTTON ───
  floatingCameraBtn: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#161B26",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  // ─── MODAL INFO CHAT ───
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  infoModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#1B2232",
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 12,
  },
  infoModalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 17,
    color: "#FFFFFF",
  },
  infoModalBody: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#CBD5E1",
    lineHeight: 19,
  },
  infoModalBtn: {
    alignSelf: "flex-end",
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  infoModalBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#38BDF8",
  },

  // ─── CARI TEMAN MODAL SCREEN ───
  searchModalContainer: {
    flex: 1,
    backgroundColor: "#0B0E17",
  },
  searchModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 10,
  },
  searchModalInputWrap: {
    flex: 1,
    backgroundColor: "#161B26",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  searchModalInput: {
    fontFamily: "Nunito-Regular",
    fontSize: 13.5,
    color: "#FFFFFF",
    padding: 0,
  },
  cariBtn: {
    backgroundColor: "#2B354C",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 70,
  },
  cariBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  searchResultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  searchResultLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  alreadyFriendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  alreadyFriendText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#34D399",
  },
  sentBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  sentBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  addFriendActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        cursor: "pointer",
      } as any)
      : {}),
  },
  addFriendActionText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  ownAccountBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ownAccountText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },

  // ─── BOTTOM SHEET MODAL (PERSIS SCREENSHOT 2) ───
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  bottomSheetCard: {
    backgroundColor: "#111622",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  sheetGrabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetFriendHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 14,
    marginBottom: 14,
  },
  sheetFriendInfo: {
    flex: 1,
    gap: 4,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    marginVertical: 4,
  },
  sheetActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  sheetActionText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
});
