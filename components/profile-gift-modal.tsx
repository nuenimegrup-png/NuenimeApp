import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useQueryClient } from "@tanstack/react-query";
import { AppIcon } from "@/components/app-icon";
import { BorderAvatar } from "@/components/border-avatar";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { showToast } from "@/lib/toast";
import { getCrystalBalance } from "@/lib/topup-service";
import { isSpecialRole } from "@/lib/admin-service";
import {
  PROFILE_GIFTS_CATALOG,
  ProfileGiftItem,
  getUserGiftSummary,
  getUserReceivedGiftHistory,
  getUserTopGiftContributors,
  sendProfileGift,
  setEquippedProfileGift,
  formatCharisma,
  ReceivedGiftLog,
  GiftContributor,
} from "@/lib/profile-gifts-service";

const CRYSTAL_ICON = require("@/assets/images/topup/topup-crystal.png");

interface ProfileGiftModalProps {
  visible: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserName: string;
  targetUserAvatar?: string | null;
  onGiftSentSuccess?: () => void;
}

type ModalTab = "send" | "received" | "leaderboard";

export function ProfileGiftModal({
  visible,
  onClose,
  targetUserId,
  targetUserName,
  targetUserAvatar,
  onGiftSentSuccess,
}: ProfileGiftModalProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const queryClient = useQueryClient();
  const auth = useAnirakuAuth();
  const currentUserId = auth.user?.id;
  const isOwnProfile = Boolean(currentUserId && currentUserId === targetUserId);
  const isSpecialUser = Boolean(auth.user?.role && isSpecialRole(auth.user.role));

  const [activeTab, setActiveTab] = useState<ModalTab>("send");
  const [selectedGift, setSelectedGift] = useState<ProfileGiftItem | null>(null);
  const [giftQuantity, setGiftQuantity] = useState<number>(1);
  const [userCrystalBalance, setUserCrystalBalance] = useState<number>(0);
  const [isSending, setIsSending] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Data states
  const [totalReceivedValue, setTotalReceivedValue] = useState<number>(0);
  const [giftCounts, setGiftCounts] = useState<Record<string, number>>({});
  const [equippedGiftId, setEquippedGiftId] = useState<string | null>(null);
  const [equipModalGift, setEquipModalGift] = useState<ProfileGiftItem | null>(null);
  const [receivedLogs, setReceivedLogs] = useState<ReceivedGiftLog[]>([]);
  const [contributors, setContributors] = useState<GiftContributor[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Responsif mobile dialog max width & height
  const modalMaxWidth = Math.min(windowWidth - 24, 410);
  const modalHeight = Math.max(380, Math.min(windowHeight * 0.78, 530));

  // Load balance & gift summary
  useEffect(() => {
    if (!visible) return;

    if (currentUserId) {
      getCrystalBalance(currentUserId).then((bal) => setUserCrystalBalance(bal));
    }

    if (targetUserId) {
      setLoadingSummary(true);
      getUserGiftSummary(targetUserId)
        .then((res) => {
          setTotalReceivedValue(res.totalCharisma);
          setGiftCounts(res.giftCounts || {});
          setEquippedGiftId(res.equippedGiftId || null);
        })
        .finally(() => setLoadingSummary(false));
    }
  }, [visible, currentUserId, targetUserId]);

  // Load tab data
  useEffect(() => {
    if (!visible || !targetUserId) return;

    if (activeTab === "received") {
      setLoadingData(true);
      getUserReceivedGiftHistory(targetUserId)
        .then((logs) => setReceivedLogs(logs))
        .finally(() => setLoadingData(false));
    } else if (activeTab === "leaderboard") {
      setLoadingData(true);
      getUserTopGiftContributors(targetUserId)
        .then((list) => setContributors(list))
        .finally(() => setLoadingData(false));
    }
  }, [visible, targetUserId, activeTab]);

  const handleSelectGift = (gift: ProfileGiftItem) => {
    hapticLight();
    setSelectedGift(gift);
    setGiftQuantity(1);
    setIsPreviewing(false);
  };

  const handleStepQuantity = (delta: number) => {
    hapticLight();
    setGiftQuantity((prev) => Math.max(1, Math.min(999, prev + delta)));
  };

  const handleQuickQuantity = (qty: number) => {
    hapticLight();
    setGiftQuantity(qty);
  };

  const handleTriggerPreview = () => {
    hapticSuccess();
    setIsPreviewing(true);
    showToast(`Memutar preview efek ${selectedGift?.name || "Gift"}!`);
    setTimeout(() => {
      setIsPreviewing(false);
    }, 2800);
  };

  const handleEquipGift = async (gift: ProfileGiftItem) => {
    hapticSuccess();
    const newEquippedId = equippedGiftId === gift.id ? null : gift.id;
    setEquippedGiftId(newEquippedId);
    setEquipModalGift(null);

    await setEquippedProfileGift(targetUserId, newEquippedId);
    queryClient.invalidateQueries({ queryKey: ["profile-gift-summary", targetUserId] });

    if (newEquippedId) {
      showToast(`${gift.name} berhasil ditampilkan di samping profil kamu!`);
    } else {
      showToast("Tampilan gift profil dikembalikan ke default.");
    }
    if (onGiftSentSuccess) onGiftSentSuccess();
  };

  const handleSendGift = async () => {
    if (!selectedGift || !targetUserId) return;

    if (!currentUserId || currentUserId === "guest") {
      hapticWarning();
      Alert.alert("Perhatian", "Silakan login terlebih dahulu untuk mengirim gift.");
      return;
    }

    if (isOwnProfile && !isSpecialUser) {
      hapticWarning();
      Alert.alert(
        "Profil Sendiri",
        "Kamu tidak dapat mengirim gift ke profil sendiri. Kunjungi profil pengguna lain untuk mengirimkan gift."
      );
      return;
    }

    const totalCost = selectedGift.price * giftQuantity;
    if (selectedGift.currency === "crystal" && userCrystalBalance < totalCost) {
      hapticWarning();
      Alert.alert(
        "Saldo Tidak Cukup",
        `Saldo Dylan Crystal kamu tidak mencukupi (${userCrystalBalance} Crystal). Diperlukan ${totalCost} Crystal.`
      );
      return;
    }

    setIsSending(true);
    try {
      const res = await sendProfileGift({
        senderId: currentUserId,
        recipientId: targetUserId,
        giftId: selectedGift.id,
        quantity: giftQuantity,
      });

      if (res.success) {
        hapticSuccess();
        if (typeof res.newBalance === "number") {
          setUserCrystalBalance(res.newBalance);
        }
        setTotalReceivedValue((prev) => prev + (res.charismaAdded || 0));
        showToast(res.message || "Gift berhasil dikirim!");
        setSelectedGift(null);
        setGiftQuantity(1);
        if (onGiftSentSuccess) onGiftSentSuccess();
      }
    } catch (err: any) {
      hapticWarning();
      Alert.alert("Gagal Mengirim Gift", err?.message || "Terjadi kesalahan.");
    } finally {
      setIsSending(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.dialogContainer,
            {
              width: modalMaxWidth,
              height: modalHeight,
              maxHeight: Math.min(windowHeight * 0.88, 560),
            },
          ]}
        >
          {/* ─── MODAL HEADER (Persis Screenshot Mobile Legends) ─── */}
          <View style={styles.dialogHeader}>
            <Text style={styles.dialogHeaderTitle} numberOfLines={1}>
              {isOwnProfile
                ? `Koleksi Gift ${targetUserName}`
                : `Send ${targetUserName} a gift`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup Dialog Gift"
              onPress={() => {
                hapticLight();
                onClose();
              }}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
              hitSlop={10}
            >
              <AppIcon name="close" size={18} color="#94A3B8" />
            </Pressable>
          </View>

          {/* ─── TABS HEADER (Send Gift | Received | Leaderboard) ─── */}
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => {
                hapticLight();
                setActiveTab("send");
                setSelectedGift(null);
              }}
              style={[styles.tabItem, activeTab === "send" && styles.tabItemActive]}
            >
              <Text
                style={[
                  styles.tabItemText,
                  activeTab === "send" && styles.tabItemTextActive,
                ]}
              >
                {isOwnProfile ? "Koleksi Gift" : "Send Gift"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                hapticLight();
                setActiveTab("received");
                setSelectedGift(null);
              }}
              style={[styles.tabItem, activeTab === "received" && styles.tabItemActive]}
            >
              <Text
                style={[
                  styles.tabItemText,
                  activeTab === "received" && styles.tabItemTextActive,
                ]}
              >
                Received
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                hapticLight();
                setActiveTab("leaderboard");
                setSelectedGift(null);
              }}
              style={[styles.tabItem, activeTab === "leaderboard" && styles.tabItemActive]}
            >
              <Text
                style={[
                  styles.tabItemText,
                  activeTab === "leaderboard" && styles.tabItemTextActive,
                ]}
              >
                Leaderboard
              </Text>
            </Pressable>
          </View>

          {/* ─── TAB CONTENT 1: SEND GIFT & DETAIL VIEW ─── */}
          {activeTab === "send" && (
            <View style={styles.tabContentArea}>
              {selectedGift ? (
                /* ─── DETAIL CONFIRMATION VIEW (Screenshot 2: Mobile Legends Style) ─── */
                <View style={styles.detailViewContainer}>
                  {/* Back to Grid Button */}
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setSelectedGift(null);
                    }}
                    style={styles.detailBackBtn}
                  >
                    <AppIcon name="arrow-left" size={14} color="#38BDF8" />
                    <Text style={styles.detailBackText}>Katalog Gift</Text>
                  </Pressable>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, width: "100%" }} contentContainerStyle={styles.detailScrollContent}>
                    {/* Spotlight Podium with Gift Graphic */}
                    <View style={styles.spotlightPodium}>
                      <Image
                        source={{ uri: selectedGift.imageUrl }}
                        style={[
                          styles.spotlightGiftImg,
                          isPreviewing && styles.spotlightGiftImgPreview,
                        ]}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        transition={200}
                      />
                    </View>

                    {/* Title & Lore Description */}
                    <View style={styles.detailInfoCol}>
                      <Text style={styles.detailGiftTitle}>{selectedGift.name}</Text>
                      <Text style={styles.detailGiftLore} numberOfLines={2}>
                        {selectedGift.description}
                      </Text>
                      <View style={styles.detailCharismaRow}>
                        <Text style={styles.detailCharismaHighlight}>
                          Menerima gift ini menambah +{selectedGift.charisma.toLocaleString("id-ID")} Charisma
                        </Text>
                      </View>
                    </View>

                    {/* Stepper Quantity Counter & Quick Pills */}
                    <View style={styles.stepperSection}>
                      <View style={styles.stepperRow}>
                        <Pressable
                          onPress={() => handleStepQuantity(-1)}
                          style={({ pressed }) => [styles.stepperBtn, pressed && styles.btnPressed]}
                        >
                          <Text style={styles.stepperBtnText}>−</Text>
                        </Pressable>

                        <View style={styles.stepperDisplay}>
                          <Text style={styles.stepperDisplayText}>{giftQuantity}</Text>
                        </View>

                        <Pressable
                          onPress={() => handleStepQuantity(1)}
                          style={({ pressed }) => [styles.stepperBtn, pressed && styles.btnPressed]}
                        >
                          <Text style={styles.stepperBtnText}>+</Text>
                        </Pressable>
                      </View>

                      {/* Quick Multipliers: x1, x5, x10, x50 */}
                      <View style={styles.quickPillsRow}>
                        {[1, 5, 10, 50].map((qty) => (
                          <Pressable
                            key={qty}
                            onPress={() => handleQuickQuantity(qty)}
                            style={[
                              styles.quickPill,
                              giftQuantity === qty && styles.quickPillActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.quickPillText,
                                giftQuantity === qty && styles.quickPillTextActive,
                              ]}
                            >
                              x{qty}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    {/* Cost Calculation & Balance Info */}
                    <View style={styles.costSummaryRow}>
                      <Text style={styles.costSummaryLabel}>Total Harga:</Text>
                      <View style={styles.costValRow}>
                        <Image
                          source={CRYSTAL_ICON}
                          style={styles.crystalIconSmall}
                          contentFit="contain"
                          cachePolicy="memory-disk"
                        />
                        <Text style={styles.costValNumber}>
                          {(selectedGift.price * giftQuantity).toLocaleString("id-ID")}
                        </Text>
                      </View>
                      <View style={styles.balanceInlineRow}>
                        <Text style={styles.balanceInfoText}>(Saldo:</Text>
                        <Image
                          source={CRYSTAL_ICON}
                          style={styles.crystalIconTiny}
                          contentFit="contain"
                          cachePolicy="memory-disk"
                        />
                        <Text style={styles.balanceInfoText}>
                          {userCrystalBalance.toLocaleString("id-ID")})
                        </Text>
                      </View>
                    </View>

                    {/* Action Buttons: Preview & Send */}
                    <View style={styles.detailActionButtonsRow}>
                      <Pressable
                        onPress={handleTriggerPreview}
                        style={({ pressed }) => [styles.previewBtn, pressed && styles.btnPressed]}
                      >
                        <Text style={styles.previewBtnText}>Preview</Text>
                      </Pressable>

                      <Pressable
                        disabled={isSending || (isOwnProfile && !isSpecialUser)}
                        onPress={handleSendGift}
                        style={({ pressed }) => [
                          styles.sendBtn,
                          (isSending || (isOwnProfile && !isSpecialUser)) && { opacity: 0.5 },
                          pressed && styles.btnPressed,
                        ]}
                      >
                        {isSending ? (
                          <ActivityIndicator size="small" color="#0B0E14" />
                        ) : (
                          <Text style={styles.sendBtnText}>
                            {isOwnProfile
                              ? isSpecialUser
                                ? "Kirim (Test Admin)"
                                : "Profil Sendiri"
                              : "Send"}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </ScrollView>
                </View>
              ) : loadingSummary ? (
                /* ─── LOADING SKELETON / SPINNER VIEW ─── */
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                  <Text style={styles.loadingText}>Memuat Katalog Gift...</Text>
                </View>
              ) : (
                /* ─── 8 GIFTS GRID VIEW (Screenshot 1: Mobile Legends Style - 4 Kolom Rapi) ─── */
                <View style={{ flex: 1, width: "100%" }}>
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.giftsGrid}
                    showsVerticalScrollIndicator={false}
                  >
                    {PROFILE_GIFTS_CATALOG.map((gift) => {
                      const receivedCount = giftCounts[gift.id] || 0;
                      const isOwned = receivedCount > 0;
                      const isEquipped = isOwnProfile && equippedGiftId === gift.id;

                      const handleCardPress = () => {
                        if (isOwnProfile) {
                          hapticLight();
                          setEquipModalGift(gift);
                        } else {
                          handleSelectGift(gift);
                        }
                      };

                      return (
                        <Pressable
                          key={gift.id}
                          onPress={handleCardPress}
                          style={({ pressed }) => [
                            styles.giftCard,
                            isOwnProfile && !isOwned && styles.giftCardLocked,
                            isOwnProfile && isOwned && styles.giftCardOwned,
                            isEquipped && styles.giftCardEquipped,
                            pressed && styles.giftCardPressed,
                          ]}
                        >
                          {/* Equipped Active Indicator Badge */}
                          {isEquipped && (
                            <View style={styles.equippedBadge}>
                              <Text style={styles.equippedBadgeText}>Aktif</Text>
                            </View>
                          )}

                          {/* Gift Image Thumbnail */}
                          <View style={styles.giftCardImgBox}>
                            <Image
                              source={{ uri: gift.imageUrl }}
                              style={[
                                styles.giftCardImg,
                                isOwnProfile && !isOwned && styles.giftCardImgLocked,
                              ]}
                              contentFit="contain"
                              cachePolicy="memory-disk"
                            />
                          </View>

                          {/* Gift Name */}
                          <Text
                            style={[
                              styles.giftCardName,
                              isOwnProfile && !isOwned && styles.giftCardNameLocked,
                            ]}
                            numberOfLines={1}
                          >
                            {gift.name.replace(/^Gift:\s*/, "")}
                          </Text>

                          {/* Price Badge (di profil orang) / Jumlah Gift (di profil sendiri) */}
                          {isOwnProfile ? (
                            <View style={styles.giftCardCountRow}>
                              <Text
                                style={[
                                  styles.giftCardCountText,
                                  !isOwned && styles.giftCardCountTextLocked,
                                ]}
                              >
                                x{receivedCount}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.giftCardPriceRow}>
                              <Image
                                source={CRYSTAL_ICON}
                                style={styles.crystalIconTiny}
                                contentFit="contain"
                                cachePolicy="memory-disk"
                              />
                              <Text style={styles.priceNumber}>
                                {gift.price.toLocaleString("id-ID")}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {/* ─── BOTTOM STATUS BAR: RECEIVED GIFT VALUE & SALDO ─── */}
                  <View style={styles.footerStatusBar}>
                    <View style={styles.receivedValueGroup}>
                      <Text style={styles.receivedValueLabel}>Total Charisma:</Text>
                      <View style={styles.receivedValueRow}>
                        <Text style={styles.receivedValueText}>
                          {formatCharisma(totalReceivedValue)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.myBalanceGroup}>
                      <Text style={styles.myBalanceLabel}>Saldo:</Text>
                      <View style={styles.myBalanceRow}>
                        <Image
                          source={CRYSTAL_ICON}
                          style={styles.crystalIconTiny}
                          contentFit="contain"
                        />
                        <Text style={styles.myBalanceText}>
                          {userCrystalBalance.toLocaleString("id-ID")}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ─── TAB CONTENT 2: RECEIVED GIFTS ─── */}
          {activeTab === "received" && (
            <View style={styles.tabContentArea}>
              <View style={styles.receivedHeaderInfo}>
                <View style={styles.receivedHeaderRow}>
                  <Text style={styles.receivedHeaderTitle}>Total Charisma:</Text>
                  <Text style={styles.receivedHeaderTitleVal}>
                    {formatCharisma(totalReceivedValue)}
                  </Text>
                </View>
                <Text style={styles.receivedHeaderSub}>
                  Riwayat gift yang dikirimkan oleh teman dan komunitas.
                </Text>
              </View>

              {loadingData ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                  <Text style={styles.loadingText}>Memuat riwayat gift...</Text>
                </View>
              ) : receivedLogs.length === 0 ? (
                <View style={styles.emptyBox}>
                  <AppIcon name="gift-outline" size={36} color="#38BDF8" />
                  <Text style={styles.emptyTitle}>Belum Ada Gift Diterima</Text>
                  <Text style={styles.emptyDesc}>
                    Gift yang kamu terima dari teman akan tampil di sini.
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                  {receivedLogs.map((log) => (
                    <View key={log.id} style={styles.logRowItem}>
                      <BorderAvatar
                        size={36}
                        avatarUrl={log.senderAvatar}
                        borderId={log.senderBorder}
                        fallbackText={log.senderName}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.logSenderName} numberOfLines={1}>
                          {log.senderName}
                        </Text>
                        <Text style={styles.logGiftDetail}>
                          Mengirim {log.quantity}x {log.giftName} (+{(log.charismaValue * log.quantity).toLocaleString("id-ID")} Charisma)
                        </Text>
                      </View>
                      <View style={styles.logBadgeBox}>
                        <Text style={styles.logBadgeText}>
                          +{(log.charismaValue * log.quantity).toLocaleString("id-ID")} Charisma
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* ─── TAB CONTENT 3: LEADERBOARD / DONATUR TERATAS ─── */}
          {activeTab === "leaderboard" && (
            <View style={styles.tabContentArea}>
              <View style={styles.receivedHeaderInfo}>
                <Text style={styles.receivedHeaderTitle}>Top Donatur Gift</Text>
                <Text style={styles.receivedHeaderSub}>
                  Sosok yang paling sering memberikan gift dan dukungan terbaik.
                </Text>
              </View>

              {loadingData ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                  <Text style={styles.loadingText}>Memuat papan peringkat...</Text>
                </View>
              ) : contributors.length === 0 ? (
                <View style={styles.emptyBox}>
                  <AppIcon name="trophy-outline" size={36} color="#F59E0B" />
                  <Text style={styles.emptyTitle}>Belum Ada Donatur</Text>
                  <Text style={styles.emptyDesc}>
                    Jadilah yang pertama mengirimkan gift ke profil ini!
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                  {contributors.map((c, idx) => (
                    <View key={c.senderId} style={styles.logRowItem}>
                      <Text
                        style={[
                          styles.rankNumberText,
                          idx === 0 && { color: "#F59E0B" },
                          idx === 1 && { color: "#CBD5E1" },
                          idx === 2 && { color: "#F97316" },
                        ]}
                      >
                        #{idx + 1}
                      </Text>
                      <BorderAvatar
                        size={36}
                        avatarUrl={c.senderAvatar}
                        borderId={c.senderBorder}
                        fallbackText={c.senderName}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.logSenderName} numberOfLines={1}>
                          {c.senderName}
                        </Text>
                        <Text style={styles.logGiftDetail}>
                          {c.totalGiftsCount} Gift Terkirim
                        </Text>
                      </View>
                      <View style={styles.contributorScoreBox}>
                        <Text style={styles.contributorScoreNumber}>
                          {formatCharisma(c.totalCharisma)}
                        </Text>
                        <Text style={styles.contributorScoreLabel}>Charisma</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        {/* ─── POPUP TAMPILKAN DI PROFIL (In-Modal Sub-Overlay, bebas bug native Dialog Android) ─── */}
        {equipModalGift && (
          <View style={[StyleSheet.absoluteFillObject, styles.subModalOverlay]}>
            <View style={styles.equipDialogContainer}>
              <View style={styles.equipDialogHeader}>
                <Text style={styles.equipDialogTitle}>
                  {giftCounts[equipModalGift.id] ? "Tampilkan di Profil" : "Detail Koleksi Gift"}
                </Text>
                <Pressable
                  onPress={() => setEquipModalGift(null)}
                  style={styles.closeBtn}
                  hitSlop={8}
                >
                  <AppIcon name="close" size={16} color="#94A3B8" />
                </Pressable>
              </View>

              <View style={styles.equipDialogBody}>
                <View style={styles.equipGiftImgBox}>
                  <Image
                    source={{ uri: equipModalGift.imageUrl }}
                    style={styles.equipGiftImg}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                </View>

                <Text style={styles.equipGiftName}>{equipModalGift.name}</Text>
                <Text style={styles.equipGiftDesc}>{equipModalGift.description}</Text>

                <View style={styles.equipStatsRow}>
                  <View style={styles.equipStatPill}>
                    <Text style={styles.equipStatLabel}>Dimiliki:</Text>
                    <Text style={styles.equipStatVal}>
                      x{giftCounts[equipModalGift.id] || 0}
                    </Text>
                  </View>
                  <View style={styles.equipStatPill}>
                    <Text style={styles.equipStatLabel}>Charisma:</Text>
                    <Text style={styles.equipStatValCharisma}>
                      +{equipModalGift.charisma.toLocaleString("id-ID")}
                    </Text>
                  </View>
                </View>

                <Text style={styles.equipNoticeText}>
                  {giftCounts[equipModalGift.id]
                    ? equippedGiftId === equipModalGift.id
                      ? "Gift ini sedang aktif ditampilkan di samping foto profil kamu."
                      : "Pasang gift ini sebagai ikon yang tampil di samping foto profil kamu."
                    : "Kamu belum pernah menerima gift ini. Dapatkan gift ini dari teman atau penggemar untuk memasangnya di profil kamu!"}
                </Text>

                <View style={styles.equipActionsRow}>
                  <Pressable
                    onPress={() => setEquipModalGift(null)}
                    style={styles.equipCancelBtn}
                  >
                    <Text style={styles.equipCancelBtnText}>Tutup</Text>
                  </Pressable>

                  {Boolean(giftCounts[equipModalGift.id]) ? (
                    <Pressable
                      onPress={() => handleEquipGift(equipModalGift)}
                      style={[
                        styles.equipConfirmBtn,
                        equippedGiftId === equipModalGift.id && styles.equipRemoveBtn,
                      ]}
                    >
                      <Text
                        style={[
                          styles.equipConfirmBtnText,
                          equippedGiftId === equipModalGift.id && { color: "#FFFFFF" },
                        ]}
                      >
                        {equippedGiftId === equipModalGift.id
                          ? "Lepas dari Profil"
                          : "Tampilkan di Profil"}
                      </Text>
                    </Pressable>
                  ) : (
                    <View
                      style={[
                        styles.equipConfirmBtn,
                        { opacity: 0.5, backgroundColor: "#1E293B" },
                      ]}
                    >
                      <Text style={[styles.equipConfirmBtnText, { color: "#94A3B8" }]}>
                        Belum Dimiliki
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  dialogContainer: {
    width: "100%",
    backgroundColor: "#0D1522", // Dark Oceanic Blue game theme
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.45)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },

  // Header
  dialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
  },
  dialogHeaderTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#F1F5F9",
    flex: 1,
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 6,
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },

  // Tab Bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(11, 19, 33, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: "#38BDF8",
    backgroundColor: "rgba(56, 189, 248, 0.08)",
  },
  tabItemText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#64748B",
  },
  tabItemTextActive: {
    fontFamily: "Nunito-Black",
    color: "#38BDF8",
  },

  // Tab Content Area
  tabContentArea: {
    flex: 1,
    width: "100%",
  },

  // 8 Gifts Grid View (Mobile First: 4 Kolom Pas Tanpa Potongan)
  giftsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10,
    rowGap: 8,
  },
  giftCard: {
    width: "23.5%", // 4 kolom proporsional di mobile layar apapun
    backgroundColor: "rgba(18, 30, 49, 0.85)",
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: "rgba(56, 189, 248, 0.22)",
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    position: "relative",
  },
  giftCardLocked: {
    opacity: 0.38,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(10, 16, 26, 0.5)",
  },
  giftCardOwned: {
    borderColor: "rgba(56, 189, 248, 0.4)",
    backgroundColor: "rgba(18, 30, 49, 0.95)",
  },
  giftCardEquipped: {
    borderColor: "#10B981",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  giftCardPressed: {
    opacity: 0.8,
    borderColor: "#38BDF8",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    transform: [{ scale: 0.96 }],
  },
  giftCardImgBox: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  giftCardImg: {
    width: 36,
    height: 36,
  },
  giftCardImgLocked: {
    opacity: 0.35,
  },
  giftCardName: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#CBD5E1",
    textAlign: "center",
    paddingHorizontal: 2,
    maxWidth: "100%",
  },
  giftCardNameLocked: {
    color: "#64748B",
  },
  giftCardPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2.5,
  },
  giftCardCountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  giftCardCountText: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
    color: "#38BDF8",
  },
  giftCardCountTextLocked: {
    color: "#475569",
  },
  equippedBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#10B981",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    zIndex: 4,
  },
  equippedBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 7.5,
    color: "#0B0E14",
  },
  priceIcon: {
    fontSize: 9.5,
  },
  priceNumber: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
    color: "#F1F5F9",
  },

  // Footer Status Bar (Mobile-Friendly)
  footerStatusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(11, 19, 33, 0.92)",
  },
  receivedValueGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  receivedValueLabel: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  receivedValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  receivedValueText: {
    fontFamily: "Nunito-Black",
    fontSize: 11.5,
    color: "#38BDF8",
  },
  myBalanceGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  myBalanceLabel: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  myBalanceText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#F59E0B",
  },

  // Detail View (Screenshot 2)
  detailViewContainer: {
    flex: 1,
    padding: 12,
  },
  detailBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  detailBackText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#38BDF8",
  },
  detailScrollContent: {
    alignItems: "center",
    paddingBottom: 14,
  },
  spotlightPodium: {
    width: 120,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  spotlightGiftImg: {
    width: 80,
    height: 80,
    zIndex: 2,
  },
  spotlightGiftImgPreview: {
    transform: [{ scale: 1.15 }],
  },
  detailInfoCol: {
    alignItems: "center",
    gap: 3,
    marginVertical: 6,
    paddingHorizontal: 10,
  },
  detailGiftTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#F1F5F9",
  },
  detailGiftLore: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 15,
  },
  detailCharismaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  detailCharismaHighlight: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },
  crystalIconTiny: {
    width: 12,
    height: 12,
  },
  crystalIconSmall: {
    width: 14,
    height: 14,
  },
  balanceInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  myBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  receivedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  receivedHeaderTitleVal: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#38BDF8",
  },

  // Stepper Section
  stepperSection: {
    alignItems: "center",
    gap: 6,
    marginVertical: 6,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(18, 30, 49, 0.9)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    overflow: "hidden",
  },
  stepperBtn: {
    width: 36,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  stepperBtnText: {
    fontSize: 16,
    fontFamily: "Nunito-Black",
    color: "#38BDF8",
  },
  stepperDisplay: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperDisplayText: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#F1F5F9",
  },
  quickPillsRow: {
    flexDirection: "row",
    gap: 6,
  },
  quickPill: {
    paddingHorizontal: 9,
    paddingVertical: 2.5,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  quickPillActive: {
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    borderColor: "#38BDF8",
  },
  quickPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#94A3B8",
  },
  quickPillTextActive: {
    color: "#38BDF8",
  },

  // Cost Summary
  costSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginVertical: 4,
  },
  costSummaryLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  costValRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  costValNumber: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#F59E0B",
  },
  balanceInfoText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },

  // Detail Action Buttons (Preview & Send)
  detailActionButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    width: "100%",
    paddingHorizontal: 14,
  },
  previewBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#38BDF8",
  },
  sendBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#F59E0B", // Gold game theme button
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#0B0E14",
  },

  // Received & Leaderboard Lists
  receivedHeaderInfo: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  receivedHeaderTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#F1F5F9",
  },
  receivedHeaderSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 1,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  loadingText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    padding: 20,
  },
  emptyTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#CBD5E1",
  },
  emptyDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
    textAlign: "center",
  },
  logRowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
    gap: 9,
  },
  logSenderName: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#F1F5F9",
  },
  logGiftDetail: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
    marginTop: 1,
  },
  logBadgeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  logBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 10.5,
    color: "#38BDF8",
  },
  rankNumberText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#64748B",
    width: 22,
    textAlign: "center",
  },
  contributorScoreBox: {
    alignItems: "flex-end",
  },
  contributorScoreNumber: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#F59E0B",
  },
  contributorScoreLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 9,
    color: "#64748B",
  },

  // Equip Dialog Styles (Popup Pasang Gift di Profil Sendiri)
  subModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  equipDialogContainer: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#0D1522",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.45)",
    overflow: "hidden",
  },
  equipDialogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
  },
  equipDialogTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#F1F5F9",
  },
  equipDialogBody: {
    alignItems: "center",
    padding: 14,
  },
  equipGiftImgBox: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  equipGiftImg: {
    width: 64,
    height: 64,
  },
  equipGiftName: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#F1F5F9",
    textAlign: "center",
    marginTop: 4,
  },
  equipGiftDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 2,
    paddingHorizontal: 8,
  },
  equipStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginVertical: 10,
  },
  equipStatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  equipStatLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  equipStatVal: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
    color: "#38BDF8",
  },
  equipStatValCharisma: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
    color: "#F59E0B",
  },
  equipNoticeText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 12,
  },
  equipActionsRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  equipCancelBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  equipCancelBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  equipConfirmBtn: {
    flex: 1.5,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#38BDF8",
    alignItems: "center",
    justifyContent: "center",
  },
  equipRemoveBtn: {
    backgroundColor: "#EF4444",
  },
  equipConfirmBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#0B0E14",
  },
});

