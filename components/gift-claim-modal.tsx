import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { type SystemGift, claimGiftForUser } from "@/lib/mailbox-service";
import { BorderAvatar } from "@/components/border-avatar";
import { getBorderById, getBorderByIdAsync, type AvatarBorder } from "@/lib/avatar-borders";

const CRYSTAL_ICON = require("@/assets/images/topup/topup-crystal.png");

interface GiftClaimModalProps {
  visible: boolean;
  gift: SystemGift | null;
  onClose: () => void;
  onClaimSuccess?: (gift: SystemGift, newBalance?: number) => void;
}

export function GiftClaimModal({
  visible,
  gift,
  onClose,
  onClaimSuccess,
}: GiftClaimModalProps) {
  const auth = useAnirakuAuth();
  const [claiming, setClaiming] = useState(false);
  const [borderInfo, setBorderInfo] = useState<AvatarBorder | null>(() => {
    return gift && gift.giftType === "border" ? getBorderById(gift.giftValue) || null : null;
  });

  React.useEffect(() => {
    if (gift && gift.giftType === "border") {
      const syncB = getBorderById(gift.giftValue);
      if (syncB) {
        setBorderInfo(syncB);
      } else {
        void getBorderByIdAsync(gift.giftValue).then((b) => {
          if (b) setBorderInfo(b);
        });
      }
    } else {
      setBorderInfo(null);
    }
  }, [gift?.giftType, gift?.giftValue]);

  if (!gift) return null;

  const isClaimed = Boolean(gift.isClaimed);

  const handleClaim = async () => {
    if (claiming || isClaimed) return;
    hapticLight();
    setClaiming(true);

    try {
      const res = await claimGiftForUser(gift.id, auth.user?.id);
      if (!res.success) {
        hapticWarning();
        Alert.alert("Gagal Klaim", res.error || "Terjadi kesalahan saat mengklaim hadiah.");
        setClaiming(false);
        return;
      }

      hapticSuccess();
      const bMeta = gift.giftType === "border" ? getBorderById(gift.giftValue) : null;
      const rewardText =
        gift.giftType === "crystal"
          ? `+${gift.giftValue} Dylan Crystal`
          : `Border Avatar "${bMeta?.name || gift.giftValue}"`;

      Alert.alert(
        "Klaim Berhasil 🎉",
        `Selamat! Kamu berhasil mendapatkan hadiah ${rewardText} yang telah dimasukkan ke akunmu.`
      );

      onClaimSuccess?.(gift, res.newBalance);
      onClose();
    } catch (err: any) {
      hapticWarning();
      Alert.alert("Error", err?.message || "Gagal memproses klaim.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          {/* Close button */}
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <AppIcon name="close" size={20} color={nothing.dim} />
          </Pressable>

          {/* Gift Icon Header */}
          <View style={styles.iconCircle}>
            <Image
              source={{ uri: "https://i.ibb.co.com/BHDK5h9W/hadiah-icon.png" }}
              style={{ width: 64, height: 64 }}
              contentFit="contain"
              transition={200}
            />
          </View>

          {/* Title & Date */}
          <Text style={styles.title}>{gift.title}</Text>
          <Text style={styles.tagline}>HADIAH KHUSUS PENGGUNA NUENIME</Text>

          {/* Message from Admin */}
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{gift.message}</Text>
          </View>

          {/* Reward Item Box */}
          <View
            style={[
              styles.rewardBox,
              gift.giftType === "border" && {
                backgroundColor: "rgba(168, 85, 247, 0.12)",
                borderColor: "rgba(168, 85, 247, 0.35)",
              },
            ]}
          >
            {gift.giftType === "crystal" ? (
              <>
                <Image source={CRYSTAL_ICON} style={styles.crystalIcon} contentFit="contain" />
                <View>
                  <Text style={styles.rewardLabel}>HADIAH CRYSTAL</Text>
                  <Text style={styles.rewardAmount}>+{gift.giftValue} Dylan Crystal</Text>
                </View>
              </>
            ) : (
              <View style={styles.borderRewardRow}>
                <View style={styles.borderAvatarWrapper}>
                  <BorderAvatar
                    size={48}
                    borderId={gift.giftValue}
                    avatarUrl={auth.profile?.avatar_url || "https://images.alphacoders.com/132/1328004.png"}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.rewardLabel, { color: "#C084FC" }]}>HADIAH BORDER AVATAR</Text>
                  <Text style={styles.rewardAmount}>
                    {borderInfo?.name || gift.giftValue}
                  </Text>
                  {borderInfo?.rarity && (
                    <Text style={styles.borderRarityTag}>
                      Kelangkaan: {borderInfo.rarity}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Claim Button */}
          <Pressable
            disabled={claiming || isClaimed}
            onPress={handleClaim}
            style={({ pressed }) => [
              styles.claimBtn,
              isClaimed ? styles.claimBtnDisabled : styles.claimBtnActive,
              pressed && !isClaimed && { opacity: 0.8 },
            ]}
          >
            {claiming ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : isClaimed ? (
              <>
                <AppIcon name="check" size={18} color="#94A3B8" />
                <Text style={styles.claimBtnTextDisabled}>Sudah Diklaim</Text>
              </>
            ) : (
              <>
                <AppIcon name="gift-outline" size={18} color="#FFFFFF" />
                <Text style={styles.claimBtnTextActive}>Klaim Hadiah Sekarang</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#1B1730",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 12,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
  },
  iconCircle: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  title: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 4,
  },
  tagline: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
    color: "#A78BFA",
    letterSpacing: 0.8,
  },
  messageBox: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  messageText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#CBD5E1",
    lineHeight: 18,
    textAlign: "center",
  },
  rewardBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  crystalIcon: {
    width: 38,
    height: 38,
  },
  rewardLabel: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
    color: "#10B981",
    letterSpacing: 0.6,
  },
  rewardAmount: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
    marginTop: 2,
  },
  claimBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 24,
    marginTop: 6,
  },
  claimBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.32)",
  },
  claimBtnDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  claimBtnTextActive: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  claimBtnTextDisabled: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#94A3B8",
  },
  borderRewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  borderAvatarWrapper: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
  },
  borderRarityTag: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#CBD5E1",
    marginTop: 1,
  },
});
