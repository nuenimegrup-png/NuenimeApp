import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, useNavigation } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { AppIcon } from "@/components/app-icon";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { avatarUrl } from "@/lib/aniraku-avatars";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { getCrystalBalance, deductCrystalBalance } from "@/lib/topup-service";
import {
  BorderAvatar
} from "@/components/border-avatar";
import {
  RARITY_THEME,
  getEquippedBorderId,
  setEquippedBorderId,
  subscribeEquippedBorder,
} from "@/lib/avatar-borders";

// ─── 5 ASET GAMBAR RESMI DARI USER ───
const INVENTORY_BG = require("@/assets/images/inventory/inventory-bg.jpg");
const CLAN_CREST = require("@/assets/images/inventory/clan-crest.png");
const GACHA_BOOK = require("@/assets/images/inventory/border-magic-book.png");
const BORDER_WHITE_MAGE = require("@/assets/images/inventory/border-white-mage.png");
const EFFECT_CRYSTAL_STAR = require("@/assets/images/inventory/crystal-star.png");
const TUTORIAL_BADGE = require("@/assets/images/inventory/tutorial-badge.png");
const GACHA_BANNER_BG = INVENTORY_BG;

type MenuKey = "clans" | "gacha" | "avatar_border" | "profile_effects" | "tutorial";

interface MenuItem {
  id: MenuKey;
  title: string;
  subtitle: string;
  image: any;
  isComingSoon?: boolean;
}

// 5 Menu tanpa AniPet, hanya menampilkan aset gambar transparan tanpa background kotak
const MENU_ITEMS: MenuItem[] = [
  {
    id: "clans",
    title: "Clans",
    subtitle: "Komunitas & Wilayah",
    image: CLAN_CREST,
  },
  {
    id: "gacha",
    title: "Gacha Wallpaper",
    subtitle: "Spin banner",
    image: GACHA_BOOK,
  },
  {
    id: "avatar_border",
    title: "Avatar Border",
    subtitle: "Shop decoration",
    image: BORDER_WHITE_MAGE,
  },
  {
    id: "profile_effects",
    title: "Profile Effects",
    subtitle: "Coming Soon",
    image: EFFECT_CRYSTAL_STAR,
    isComingSoon: true,
  },
  {
    id: "tutorial",
    title: "Tutorial",
    subtitle: "Panduan",
    image: TUTORIAL_BADGE,
  },
];

export default function InventoryScreen() {
  const auth = useAnirakuAuth();
  const { width: windowWidth } = useWindowDimensions();

  // Active sub-modal view
  const [activeModal, setActiveModal] = useState<MenuKey | null>(null);

  // Coming Soon modal & toast notification states
  const [comingSoonModal, setComingSoonModal] = useState<{
    title: string;
    description: string;
    image: any;
  } | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const showToastNotice = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 3500);
  };

  // Selected customization states (default null agar avatar asli dari login terlihat bersih)
  const navigation = useNavigation();
  const [selectedBorder, setSelectedBorder] = useState<string | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<"crystal_star" | null>(null);
  const [gachaFeedback, setGachaFeedback] = useState<string | null>(null);
  const [crystalBalance, setCrystalBalance] = useState<number>(0);

  // Sync equipped border from Avatar Decorations (per-user account & reactive 0ms)
  const syncBorder = useCallback(async () => {
    try {
      const v = await getEquippedBorderId(auth.user?.id);
      setSelectedBorder(v);
    } catch {}
  }, [auth.user?.id]);

  useEffect(() => {
    syncBorder();
    const unsubFocus = navigation.addListener("focus" as any, syncBorder);
    const unsubEquip = subscribeEquippedBorder((newBorderId, targetUserId) => {
      if (!targetUserId || targetUserId === auth.user?.id) {
        setSelectedBorder(newBorderId);
      }
    });
    return () => {
      unsubFocus();
      unsubEquip();
    };
  }, [navigation, syncBorder, auth.user?.id]);

  // Sync crystal balance from Supabase & AsyncStorage
  const syncBalance = useCallback(async () => {
    try {
      const bal = await getCrystalBalance(auth.user?.id);
      setCrystalBalance(bal);
    } catch {}
  }, [auth.user?.id]);

  useEffect(() => {
    syncBalance();
    const unsubscribe = navigation.addListener("focus" as any, syncBalance);
    return unsubscribe;
  }, [navigation, syncBalance]);

  // Real-time synchronization dengan Supabase jika balance di-update via admin / topup
  useEffect(() => {
    if (!auth.user?.id || auth.user.id === "guest") return;

    const channel = supabase
      .channel(`inventory-crystal-${auth.user.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_balances",
          filter: `user_id=eq.${auth.user.id}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow && typeof newRow.crystal_balance === "number") {
            setCrystalBalance(newRow.crystal_balance);
          } else {
            syncBalance();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auth.user?.id, syncBalance]);

  // User details directly from authenticated login session
  const username =
    auth.profile?.username ||
    auth.user?.user_metadata?.username ||
    auth.user?.user_metadata?.full_name ||
    auth.user?.user_metadata?.name ||
    auth.user?.email?.split("@")[0] ||
    "User";

  const displayName =
    auth.profile?.display_name ||
    auth.user?.user_metadata?.full_name ||
    auth.user?.user_metadata?.name ||
    auth.profile?.username ||
    username;

  const rawAvatar =
    auth.profile?.avatar_url ||
    auth.user?.user_metadata?.avatar_url ||
    auth.user?.user_metadata?.picture;

  const avatar = rawAvatar ? avatarUrl(rawAvatar) : null;
  const initialLetter = (displayName || username).trim().charAt(0).toUpperCase() || "A";

  // 2-column calculation (padding 16 on each side, gap 16)
  const itemWidth = Math.floor((Math.min(windowWidth, 600) - 32 - 16) / 2);

  const handleMenuPress = (id: MenuKey) => {
    hapticLight();
    if (id === "avatar_border") {
      router.push("/avatar-decorations" as never);
      return;
    }
    if (id === "gacha") {
      router.push("/gacha" as never);
      return;
    }
    if (id === "clans") {
      router.push({
        pathname: "/dunia",
        params: { tab: "klan" },
      } as never);
      return;
    }
    if (id === "profile_effects") {
      showToastNotice("Fitur Profile Effects sedang dalam tahap pengembangan (Coming Soon)!");
      setComingSoonModal({
        title: "Fitur Profile Effects",
        description:
          "Efek aura kosmik dan animasi bingkai profil eksklusif sedang dalam tahap pengembangan dan akan segera hadir di pembaruan berikutnya!",
        image: EFFECT_CRYSTAL_STAR,
      });
      return;
    }
    setActiveModal(id);
  };

  const handleEquipBorder = async (id: string) => {
    hapticSuccess();
    const next = selectedBorder === id ? null : id;
    setSelectedBorder(next);
    await setEquippedBorderId(auth.user?.id, next);
  };

  const handleEquipEffect = (id: "crystal_star") => {
    hapticSuccess();
    setSelectedEffect((prev) => (prev === id ? null : id));
  };

  const handleSpinGacha = async (count: number) => {
    const cost = count === 1 ? 100 : 900;
    if (crystalBalance < cost) {
      hapticWarning();
      Alert.alert(
        "Crystal Tidak Mencukupi",
        `Saldo Crystal Anda (${crystalBalance.toLocaleString(
          "id-ID"
        )}) tidak mencukupi untuk melakukan spin ini (${cost.toLocaleString(
          "id-ID"
        )} Crystal). Silakan lakukan Top Up Crystal terlebih dahulu.`,
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Top Up Sekarang",
            onPress: () => {
              setActiveModal(null);
              router.push("/topup" as never);
            },
          },
        ]
      );
      return;
    }

    hapticLight();
    const newBal = await deductCrystalBalance(auth.user?.id, cost);
    setCrystalBalance(newBal);
    hapticSuccess();
    setGachaFeedback(
      `Berhasil melakukan Spin ${count}x! -${cost.toLocaleString(
        "id-ID"
      )} Dylan Crystal. Sisa saldo: ${newBal.toLocaleString("id-ID")} Crystal.`
    );
    setTimeout(() => setGachaFeedback(null), 4000);
  };

  return (
    <View style={styles.root}>
      {/* ─── 0. GAMBAR KE-2: BACKGROUND ISTANA MALAM BERBINTANG & BULAN PURNAMA ─── */}
      <Image
        source={INVENTORY_BG}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={200}
      />

      {/* Dark overlay untuk kontras optimal */}
      <LinearGradient
        colors={[
          "rgba(11, 14, 23, 0.72)",
          "rgba(11, 14, 23, 0.85)",
          "rgba(11, 14, 23, 0.95)",
        ]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ─── TOAST NOTIFICATION ─── */}
      {toastNotice && (
        <View style={styles.toastNoticeBox}>
          <AppIcon name="clock-outline" size={17} color="#F59E0B" />
          <Text style={styles.toastNoticeText}>{toastNotice}</Text>
        </View>
      )}

      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeContainer}>
        {/* ─── 1. TOP APP BAR: BACK ARROW + "Nuenime Inventory BETA" ─── */}
        <View style={styles.headerBar}>
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
            <AppIcon name="arrow-left" size={22} color="#FFFFFF" />
          </Pressable>

          <View style={styles.titleWrap}>
            <Text style={styles.titleText}>Nuenime Inventory</Text>
            <View style={styles.betaBadge}>
              <Text style={styles.betaBadgeText}>BETA</Text>
            </View>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── 2. TOP ACCOUNT CARD (SESUAI LOGIN USER: AVATAR ASLI, NAMA LOGIN, SALDO 0) ─── */}
          <View style={styles.accountCard}>
            <View style={styles.avatarWrap}>
              <BorderAvatar
                avatarUrl={avatar}
                fallbackText={initialLetter}
                borderId={selectedBorder}
                avatarSize={48}
              />

              {/* Live Preview Efek Bintang Kosmik Terpasang HANYA jika dipasang */}
              {selectedEffect === "crystal_star" && (
                <Image
                  source={EFFECT_CRYSTAL_STAR}
                  style={styles.avatarStarEffectOverlay}
                  contentFit="contain"
                />
              )}
            </View>

            <View style={styles.accountInfo}>
              <Text style={styles.accountNameText} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.accountSubtitleText}>Selamat datang!</Text>
            </View>

            {/* Saldo Dylan Crystal Akun Pengguna (Klik untuk Top Up Crystal) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Top Up Crystal"
              onPress={() => {
                hapticLight();
                router.push("/topup" as never);
              }}
              style={({ pressed }) => [styles.crystalPill, pressed && styles.btnPressed]}
            >
              <Image
                source={require("@/assets/images/topup/topup-crystal.png")}
                style={styles.crystalPillIcon}
                contentFit="contain"
              />
              <Text style={styles.crystalPillText}>{crystalBalance.toLocaleString("id-ID")}</Text>
              <AppIcon name="plus" size={11} color="#38BDF8" style={{ marginLeft: 2 }} />
            </Pressable>
          </View>

          {/* ─── 3. SECTION "MENU" TITLE ─── */}
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitleText}>Menu</Text>
          </View>

          {/* ─── 4. MENU TANPA BACKGROUND KOTAK: HANYA GAMBAR ASET RESMI & TEKS ─── */}
          <View style={styles.menuGrid}>
            {MENU_ITEMS.map((item, idx) => {
              const isLastOdd = idx === MENU_ITEMS.length - 1 && MENU_ITEMS.length % 2 === 1;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title} - ${item.subtitle}`}
                  onPress={() => handleMenuPress(item.id)}
                  style={({ pressed }) => [
                    styles.menuItemWrap,
                    { width: isLastOdd ? "100%" : itemWidth },
                    pressed && styles.itemPressed,
                  ]}
                >
                  {/* Badge Gambar Asli Transparan (Tanpa Background) */}
                  <View style={styles.badgeImageContainer}>
                    <Image
                      source={item.image}
                      style={[
                        styles.menuBadgeImage,
                        item.isComingSoon && styles.menuBadgeComingSoon,
                      ]}
                      contentFit="contain"
                    />
                    {item.isComingSoon && (
                      <View style={styles.comingSoonPill}>
                        <Text style={styles.comingSoonPillText}>COMING SOON</Text>
                      </View>
                    )}
                  </View>

                  {/* Judul & Subtitle */}
                  <Text style={styles.menuTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.menuSubtitle,
                      item.isComingSoon && styles.menuSubtitleComingSoon,
                    ]}
                    numberOfLines={1}
                  >
                    {item.subtitle}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Bottom space */}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ─── 5. MODAL INTERAKTIF ─── */}

        {/* A. AVATAR BORDER MODAL */}
        <Modal
          visible={activeModal === "avatar_border"}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveModal(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <AppIcon name="face-man-profile" size={20} color="#7C3AED" />
                  <Text style={styles.modalTitle}>Avatar Border Decoration</Text>
                </View>
                <Pressable
                  onPress={() => setActiveModal(null)}
                  style={styles.modalCloseBtn}
                  hitSlop={10}
                >
                  <AppIcon name="close" size={20} color="#94A3B8" />
                </Pressable>
              </View>

              <Text style={styles.modalSubtitle}>
                Pilih bingkai avatar eksklusif untuk dipasang di profil akunmu:
              </Text>

              <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
                {/* Item 1: White Sage Border */}
                <View
                  style={[
                    styles.itemCard,
                    selectedBorder === "white_mage" && styles.itemCardActive,
                  ]}
                >
                  <Image source={BORDER_WHITE_MAGE} style={styles.itemThumbImg} contentFit="contain" />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>White Sage Aegis</Text>
                    <Text style={styles.itemRarityLegend}>LEGENDARY FRAME</Text>
                    <Text style={styles.itemDesc}>Bingkai suci penyihir putih dengan tongkat emas.</Text>
                  </View>
                  <Pressable
                    onPress={() => handleEquipBorder("white_mage")}
                    style={[
                      styles.equipBtn,
                      selectedBorder === "white_mage" && styles.equipBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.equipBtnText,
                        selectedBorder === "white_mage" && styles.equipBtnTextActive,
                      ]}
                    >
                      {selectedBorder === "white_mage" ? "DIPAKAI" : "PASANG"}
                    </Text>
                  </Pressable>
                </View>

                {/* Item 2: Arcane Grimoire Border */}
                <View
                  style={[
                    styles.itemCard,
                    selectedBorder === "magic_book" && styles.itemCardActive,
                  ]}
                >
                  <Image source={GACHA_BOOK} style={styles.itemThumbImg} contentFit="contain" />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>Arcane Grimoire</Text>
                    <Text style={styles.itemRarityMythic}>MYTHIC FRAME</Text>
                    <Text style={styles.itemDesc}>Kitab mantra kuno dengan permata mata mistis.</Text>
                  </View>
                  <Pressable
                    onPress={() => handleEquipBorder("magic_book")}
                    style={[
                      styles.equipBtn,
                      selectedBorder === "magic_book" && styles.equipBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.equipBtnText,
                        selectedBorder === "magic_book" && styles.equipBtnTextActive,
                      ]}
                    >
                      {selectedBorder === "magic_book" ? "DIPAKAI" : "PASANG"}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* B. PROFILE EFFECTS MODAL */}
        <Modal
          visible={activeModal === "profile_effects"}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveModal(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <AppIcon name="star-four-points" size={20} color="#EF4444" />
                  <Text style={styles.modalTitle}>Profile Effects</Text>
                </View>
                <Pressable
                  onPress={() => setActiveModal(null)}
                  style={styles.modalCloseBtn}
                  hitSlop={10}
                >
                  <AppIcon name="close" size={20} color="#94A3B8" />
                </Pressable>
              </View>

              <Text style={styles.modalSubtitle}>
                Efek aura kosmik yang bersinar di samping avatar & profilmu:
              </Text>

              <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
                <View
                  style={[
                    styles.itemCard,
                    selectedEffect === "crystal_star" && styles.itemCardActive,
                  ]}
                >
                  <Image source={EFFECT_CRYSTAL_STAR} style={styles.itemThumbImg} contentFit="contain" />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>Cosmic Dylan Star</Text>
                    <Text style={styles.itemRarityLegend}>SPECIAL EFFECT</Text>
                    <Text style={styles.itemDesc}>Bintang kristal delapan sudut galaksi biru-ungu.</Text>
                  </View>
                  <Pressable
                    onPress={() => handleEquipEffect("crystal_star")}
                    style={[
                      styles.equipBtn,
                      selectedEffect === "crystal_star" && styles.equipBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.equipBtnText,
                        selectedEffect === "crystal_star" && styles.equipBtnTextActive,
                      ]}
                    >
                      {selectedEffect === "crystal_star" ? "DIPAKAI" : "PASANG"}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* C. GACHA WALLPAPER MODAL */}
        <Modal
          visible={activeModal === "gacha"}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveModal(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContainer, { maxHeight: "90%" }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <AppIcon name="sparkles" size={20} color="#9333EA" />
                  <Text style={styles.modalTitle}>Gacha Wallpaper</Text>
                </View>
                <Pressable
                  onPress={() => setActiveModal(null)}
                  style={styles.modalCloseBtn}
                  hitSlop={10}
                >
                  <AppIcon name="close" size={20} color="#94A3B8" />
                </Pressable>
              </View>

              <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.gachaBannerWrapper}>
                  <Image
                    source={GACHA_BANNER_BG}
                    style={styles.gachaBannerImage}
                    contentFit="cover"
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(11, 14, 23, 0.95)"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.gachaBannerOverlayTextWrap}>
                    <Text style={styles.gachaBannerTitle}>Bintang Istana Malam</Text>
                    <Text style={styles.gachaBannerDesc}>
                      Wallpaper edisi terbatas & bingkai mistis malam purnama.
                    </Text>
                  </View>
                </View>

                {/* Info Saldo Crystal Tersinkronisasi */}
                <View style={styles.gachaBalanceRow}>
                  <Text style={styles.gachaBalanceLabel}>Saldo Crystal Anda:</Text>
                  <View style={styles.gachaBalancePill}>
                    <Image
                      source={require("@/assets/images/topup/topup-crystal.png")}
                      style={styles.gachaBalanceIcon}
                      contentFit="contain"
                    />
                    <Text style={styles.gachaBalanceVal}>
                      {crystalBalance.toLocaleString("id-ID")}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setActiveModal(null);
                      router.push("/topup" as never);
                    }}
                    style={styles.gachaTopUpLink}
                  >
                    <Text style={styles.gachaTopUpLinkText}>+ Top Up</Text>
                  </Pressable>
                </View>

                {gachaFeedback ? (
                  <View style={styles.feedbackAlert}>
                    <Text style={styles.feedbackAlertText}>{gachaFeedback}</Text>
                  </View>
                ) : null}

                <View style={styles.gachaActionRow}>
                  <Pressable
                    onPress={() => handleSpinGacha(1)}
                    style={({ pressed }) => [styles.spinBtn, pressed && styles.btnPressed]}
                  >
                    <Text style={styles.spinBtnLabel}>SPIN 1X</Text>
                    <View style={styles.spinBtnCost}>
                      <Image
                        source={require("@/assets/images/dylan-crystal.png")}
                        style={styles.spinCrystalIcon}
                        contentFit="contain"
                      />
                      <Text style={styles.spinCostText}>100</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => handleSpinGacha(10)}
                    style={({ pressed }) => [
                      styles.spinBtn,
                      styles.spinBtnMulti,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <Text style={styles.spinBtnLabelMulti}>SPIN 10X</Text>
                    <View style={styles.spinBtnCost}>
                      <Image
                        source={require("@/assets/images/dylan-crystal.png")}
                        style={styles.spinCrystalIcon}
                        contentFit="contain"
                      />
                      <Text style={styles.spinCostText}>900</Text>
                    </View>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* D. CLANS MODAL (DENGAN ASET RESMI CLAN CREST) */}
        <Modal
          visible={activeModal === "clans"}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveModal(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <AppIcon name="shield-crown" size={20} color="#38BDF8" />
                  <Text style={styles.modalTitle}>Clans & Squad</Text>
                </View>
                <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                  <AppIcon name="close" size={20} color="#94A3B8" />
                </Pressable>
              </View>

              <View style={styles.clanHeroWrap}>
                <Image source={CLAN_CREST} style={styles.clanHeroImage} contentFit="contain" />
                <Text style={styles.clanHeroTitle}>Sistem Clan Nuenime</Text>
                <Text style={styles.clanHeroDesc}>
                  Bergabung dengan squad untuk mabar, kuis anime, dan dapatkan bonus Dylan Crystal mingguan!
                </Text>
              </View>

              <View style={styles.clanList}>
                <View style={styles.clanCard}>
                  <Image source={CLAN_CREST} style={{ width: 36, height: 36 }} contentFit="contain" />
                  <View style={styles.clanInfo}>
                    <Text style={styles.clanName}>Valora Guardians</Text>
                    <Text style={styles.clanMeta}>48/50 Anggota • Level 5 Squad</Text>
                  </View>
                  <View style={styles.clanJoinedTag}>
                    <Text style={styles.clanJoinedText}>TERGABUNG</Text>
                  </View>
                </View>

                <View style={styles.clanCard}>
                  <Image source={CLAN_CREST} style={{ width: 36, height: 36 }} contentFit="contain" />
                  <View style={styles.clanInfo}>
                    <Text style={styles.clanName}>Dylan Ice Knights</Text>
                    <Text style={styles.clanMeta}>32/50 Anggota • Level 3 Squad</Text>
                  </View>
                  <Pressable
                    onPress={() => hapticSuccess()}
                    style={styles.clanJoinBtn}
                  >
                    <Text style={styles.clanJoinBtnText}>GABUNG</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* E. TUTORIAL MODAL (DENGAN ASET RESMI TUTORIAL BADGE) */}
        <Modal
          visible={activeModal === "tutorial"}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveModal(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <AppIcon name="information" size={20} color="#38BDF8" />
                  <Text style={styles.modalTitle}>Panduan Inventory</Text>
                </View>
                <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                  <AppIcon name="close" size={20} color="#94A3B8" />
                </Pressable>
              </View>

              <View style={styles.clanHeroWrap}>
                <Image source={TUTORIAL_BADGE} style={styles.clanHeroImage} contentFit="contain" />
                <Text style={styles.clanHeroTitle}>Panduan Eksplorasi</Text>
              </View>

              <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.tutorialStep}>
                  <Text style={styles.tutorialStepNum}>1</Text>
                  <View style={styles.tutorialStepContent}>
                    <Text style={styles.tutorialStepTitle}>Koleksi Dylan Crystal</Text>
                    <Text style={styles.tutorialStepDesc}>
                      Tonton episode anime dan selesaikan misi harian untuk mendapatkan Dylan Crystal gratis.
                    </Text>
                  </View>
                </View>

                <View style={styles.tutorialStep}>
                  <Text style={styles.tutorialStepNum}>2</Text>
                  <View style={styles.tutorialStepContent}>
                    <Text style={styles.tutorialStepTitle}>Gacha & Beli Dekorasi</Text>
                    <Text style={styles.tutorialStepDesc}>
                      Gunakan Dylan Crystal untuk spin wallpaper eksklusif dan dekorasi avatar frame.
                    </Text>
                  </View>
                </View>

                <View style={styles.tutorialStep}>
                  <Text style={styles.tutorialStepNum}>3</Text>
                  <View style={styles.tutorialStepContent}>
                    <Text style={styles.tutorialStepTitle}>Pasang di Profil Akun</Text>
                    <Text style={styles.tutorialStepDesc}>
                      Pilih Avatar Border dan Profile Effects untuk membuat profilmu semakin keren!
                    </Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* F. COMING SOON MODAL NOTIFICATION */}
        <Modal
          visible={comingSoonModal !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setComingSoonModal(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.comingSoonCard}>
              {comingSoonModal && (
                <>
                  <View style={styles.comingSoonIconWrap}>
                    <Image
                      source={comingSoonModal.image}
                      style={styles.comingSoonImage}
                      contentFit="contain"
                    />
                  </View>

                  <Text style={styles.comingSoonTitle}>{comingSoonModal.title}</Text>

                  <View style={styles.comingSoonStatusPill}>
                    <AppIcon name="clock-outline" size={13} color="#F59E0B" />
                    <Text style={styles.comingSoonStatusText}>Segera Hadir • Coming Soon</Text>
                  </View>

                  <Text style={styles.comingSoonDesc}>{comingSoonModal.description}</Text>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setComingSoonModal(null)}
                    style={({ pressed }) => [styles.comingSoonBtn, pressed && styles.btnPressed]}
                  >
                    <Text style={styles.comingSoonBtnText}>Mengerti</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0B0E17",
  },
  safeContainer: {
    flex: 1,
  },
  btnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  itemPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.94 }],
  },

  // ─── TOP APP BAR ───
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  backBtn: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleText: {
    fontFamily: "Nunito-Black",
    fontSize: 21,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  betaBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
  },
  betaBadgeText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 10,
    color: "#4ADE80",
    letterSpacing: 0.6,
  },
  headerSpacer: {
    width: 32,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },

  // ─── TOP ACCOUNT CARD ───
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(18, 23, 34, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        } as any)
      : {}),
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1E293B",
  },
  avatarInitialWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#52A447",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialText: {
    fontFamily: "Nunito-Bold",
    fontSize: 22,
    color: "#FFFFFF",
  },
  avatarBorderOverlay: {
    position: "absolute",
    width: 68,
    height: 68,
    zIndex: 2,
  },
  avatarStarEffectOverlay: {
    position: "absolute",
    width: 76,
    height: 76,
    zIndex: 1,
  },
  accountInfo: {
    flex: 1,
    gap: 2,
  },
  accountNameText: {
    fontFamily: "Nunito-Black",
    fontSize: 15.5,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  accountSubtitleText: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#CBD5E1",
  },
  crystalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  crystalPillIcon: {
    width: 16,
    height: 16,
  },
  crystalPillText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#38BDF8",
  },

  // ─── SECTION "MENU" ───
  sectionTitleRow: {
    paddingHorizontal: 2,
    marginTop: 4,
  },
  sectionTitleText: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },

  // ─── MENU GRID: TANPA BACKGROUND KOTAK, HANYA GAMBAR & TEKS ───
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-between",
  },
  menuItemWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 8,
    backgroundColor: "transparent",
  },
  badgeImageContainer: {
    width: 124,
    height: 124,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  menuBadgeImage: {
    width: 116,
    height: 116,
  },
  menuTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16.5,
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.2,
    textShadowColor: "rgba(0, 0, 0, 0.85)",
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  menuSubtitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.85)",
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },

  // ─── CLAN HERO IN MODAL ───
  clanHeroWrap: {
    alignItems: "center",
    paddingVertical: 10,
    gap: 6,
  },
  clanHeroImage: {
    width: 96,
    height: 96,
    marginBottom: 6,
  },
  clanHeroTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16.5,
    color: "#FFFFFF",
  },
  clanHeroDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 17,
  },

  // ─── MODAL STYLES ───
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 16,
    backgroundColor: "#121622",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    padding: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 17,
    color: "#FFFFFF",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
    lineHeight: 18,
  },
  modalBodyScroll: {
    maxHeight: 380,
  },

  // ─── ITEM CARDS IN MODALS ───
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 10,
  },
  itemCardActive: {
    borderColor: "#38BDF8",
    backgroundColor: "rgba(56, 189, 248, 0.08)",
  },
  itemThumbImg: {
    width: 68,
    height: 68,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  itemRarityMythic: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 9.5,
    color: "#EC4899",
    letterSpacing: 0.5,
  },
  itemRarityLegend: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 9.5,
    color: "#EAB308",
    letterSpacing: 0.5,
  },
  itemRarityEpic: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 9.5,
    color: "#A855F7",
    letterSpacing: 0.5,
  },
  itemDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  equipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  equipBtnActive: {
    backgroundColor: "#38BDF8",
    borderColor: "#38BDF8",
  },
  equipBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  equipBtnTextActive: {
    fontFamily: "Nunito-Black",
    color: "#0B0E17",
  },

  // ─── GACHA WALLPAPER ───
  gachaBannerWrapper: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    position: "relative",
    justifyContent: "flex-end",
  },
  gachaBannerImage: {
    ...StyleSheet.absoluteFillObject,
  },
  gachaBannerOverlayTextWrap: {
    padding: 14,
    zIndex: 2,
  },
  gachaBannerTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  gachaBannerDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#E2E8F0",
    marginTop: 2,
  },
  gachaBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 12,
  },
  gachaBalanceLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  gachaBalancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gachaBalanceIcon: {
    width: 15,
    height: 15,
  },
  gachaBalanceVal: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#38BDF8",
  },
  gachaTopUpLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  gachaTopUpLinkText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },
  feedbackAlert: {
    padding: 10,
    borderRadius: 6,
    backgroundColor: "rgba(34, 197, 94, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.35)",
    marginBottom: 12,
  },
  feedbackAlertText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#4ADE80",
    textAlign: "center",
  },
  gachaActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  spinBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    gap: 4,
  },
  spinBtnMulti: {
    backgroundColor: "rgba(147, 51, 234, 0.25)",
    borderColor: "#9333EA",
  },
  spinBtnLabel: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  spinBtnLabelMulti: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#E9D5FF",
  },
  spinBtnCost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  spinCrystalIcon: {
    width: 14,
    height: 14,
  },
  spinCostText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
  },

  // ─── CLANS ───
  clanList: {
    gap: 10,
    marginTop: 6,
  },
  clanCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  clanInfo: {
    flex: 1,
    gap: 2,
  },
  clanName: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  clanMeta: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  clanJoinedTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(34, 197, 94, 0.16)",
  },
  clanJoinedText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 9.5,
    color: "#4ADE80",
  },
  clanJoinBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(56, 189, 248, 0.16)",
    borderWidth: 1,
    borderColor: "#38BDF8",
  },
  clanJoinBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },

  // ─── TUTORIAL ───
  tutorialStep: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  tutorialStepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    color: "#38BDF8",
    fontFamily: "Nunito-Black",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 26,
  },
  tutorialStepContent: {
    flex: 1,
    gap: 2,
  },
  tutorialStepTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  tutorialStepDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 17,
  },

  // ─── TOAST NOTIFICATION ───
  toastNoticeBox: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderColor: "rgba(245, 158, 11, 0.5)",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  toastNoticeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    flex: 1,
  },

  // ─── COMING SOON BADGE IN GRID ───
  menuBadgeComingSoon: {
    opacity: 0.85,
  },
  comingSoonPill: {
    position: "absolute",
    bottom: -4,
    backgroundColor: "rgba(245, 158, 11, 0.92)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FCD34D",
    zIndex: 3,
  },
  comingSoonPillText: {
    fontFamily: "Nunito-Black",
    fontSize: 8.5,
    color: "#000000",
    letterSpacing: 0.4,
  },
  menuSubtitleComingSoon: {
    color: "#F59E0B",
    fontFamily: "Nunito-Bold",
  },

  // ─── COMING SOON MODAL DIALOG ───
  comingSoonCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#111625",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    padding: 24,
    alignItems: "center",
  },
  comingSoonIconWrap: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  comingSoonImage: {
    width: 74,
    height: 74,
  },
  comingSoonTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 6,
  },
  comingSoonStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 14,
  },
  comingSoonStatusText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#F59E0B",
  },
  comingSoonDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  comingSoonBtn: {
    backgroundColor: "#0284C7",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  comingSoonBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
});
