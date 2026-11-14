import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Image } from "expo-image";

import { AppIcon } from "@/components/app-icon";
import { ChibiLoading } from "@/components/chibi-loading";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { getCrystalBalance } from "@/lib/topup-service";
import {
  getLelangItems,
  getOwnedLelangItems,
  getLelangMissions,
  placeLelangBid,
  equipLelangItem,
  isLelangItemEquipped,
  claimLelangMission,
  markMissionProgress,
  getLelangRiwayat,
  bayarDanKlaimHadiah,
  type LelangItem,
  type LelangMission,
  type LelangRiwayatItem,
} from "@/lib/lelang-service";
import {
  getOwnedBorderIds,
  fetchLiveBorderCatalog,
  getEquippedBorderId,
  subscribeEquippedBorder,
  type AvatarBorder,
} from "@/lib/avatar-borders";
import { BorderAvatar } from "@/components/border-avatar";
import { UserVerificationBadge } from "@/components/user-verification-badge";
import { getLevelProgressInfo } from "@/lib/user-level";
import { LevelProgressModal, getTierForLevel } from "@/components/level-progress-modal";
import { isSpecialRole } from "@/lib/admin-service";
import { getOwnedWallpaperIds, getAllGachaBanners } from "@/lib/gacha-service";
import type { WallpaperItem } from "@/lib/gacha-data";
import { LelangItemArt } from "@/components/lelang-item-art";

const CRYSTAL_IMG = require("@/assets/images/dylan-crystal.png");

const LELANG_BANNER_IMG = require("@/assets/images/lelang-banner.jpg");

type NavTab = "home" | "lelang" | "koleksi" | "event" | "profile";
type FilterCategory = "semua" | "banner" | "border" | "segera";

function formatSecondsToClock(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00 : 00 : 00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)} : ${pad(m)} : ${pad(s)}`;
}

export default function LelangScreen() {
  const insets = useSafeAreaInsets();
  const auth = useAnirakuAuth();

  const userId = auth.user?.id || "guest";
  const userName =
    auth.profile?.display_name ||
    auth.profile?.username ||
    auth.user?.user_metadata?.full_name ||
    "Pengguna Nuenime";

  // Navigation State
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("semua");

  // Loading & Refreshing States
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Balance & Data States
  const [crystalBalance, setCrystalBalance] = useState<number>(0);
  const [, setLoadingBalance] = useState(true);

  // Lelang Items
  const [lelangItems, setLelangItems] = useState<LelangItem[]>([]);
  const [, setLoadingItems] = useState(true);
  const [now, setNow] = useState(Date.now());

  // DETAIL SCREEN STATE (SESUAI SCREENSHOT 1 & 2 DARI USER)
  const [selectedDetailItem, setSelectedDetailItem] = useState<LelangItem | null>(null);

  // SUB-SCREENS: RIWAYAT LELANG, KLAIM HADIAH, HASIL RESMI SERVER (SESUAI SCREENSHOT BARU DARI USER)
  type RiwayatFilter = "diikuti" | "dimenangkan" | "kalah";
  const [isRiwayatOpen, setIsRiwayatOpen] = useState(false);
  const [riwayatFilter, setRiwayatFilter] = useState<RiwayatFilter>("dimenangkan");
  const [riwayatList, setRiwayatList] = useState<LelangRiwayatItem[]>([]);
  const [selectedKlaimItem, setSelectedKlaimItem] = useState<LelangRiwayatItem | null>(null);
  const [selectedHasilServerItem, setSelectedHasilServerItem] = useState<LelangRiwayatItem | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isInfoLelangOpen, setIsInfoLelangOpen] = useState(false);

  // MODAL KONFIRMASI PENAWARAN STATE (SESUAI SCREENSHOT 3 DARI USER)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [bidAmountInput, setBidAmountInput] = useState<string>("");
  const [agreementChecked, setAgreementChecked] = useState(true);
  const [submittingBid, setSubmittingBid] = useState(false);

  // Koleksi Items
  const [ownedItems, setOwnedItems] = useState<LelangItem[]>([]);
  const [equippedMap, setEquippedMap] = useState<Record<string, boolean>>({});
  // AsyncStorage-backed IDs for borders and banners (lebih reliable dari Supabase tables)
  const [ownedBorderIds, setOwnedBorderIds] = useState<string[]>([]);
  const [ownedBannerIds, setOwnedBannerIds] = useState<string[]>([]);
  const [catalogBorders, setCatalogBorders] = useState<AvatarBorder[]>([]);
  const [catalogBanners, setCatalogBanners] = useState<WallpaperItem[]>([]);

  // Profile & Equipped Border State
  const [equippedBorderId, setEquippedBorderId] = useState<string | null>(null);
  const [showLevelModal, setShowLevelModal] = useState(false);

  useEffect(() => {
    void getEquippedBorderId(userId).then(setEquippedBorderId);
    const unsub = subscribeEquippedBorder((newBorderId, targetUserId) => {
      if (!targetUserId || targetUserId === userId) {
        setEquippedBorderId(newBorderId);
      }
    });
    return unsub;
  }, [userId]);

  const userExp = Math.max(0, Number(auth.profile?.exp || 0));
  const levelInfo = useMemo(() => getLevelProgressInfo(userExp), [userExp]);
  const userLevel = auth.profile?.level ?? levelInfo.level;
  const tierInfo = useMemo(() => getTierForLevel(userLevel, auth.profile?.role), [userLevel, auth.profile?.role]);
  const activeTier = tierInfo.currentTier;
  const initialLetter = (userName || "N").charAt(0).toUpperCase();
  const isSpecial = auth.profile?.role && isSpecialRole(auth.profile.role);
  const userRole = auth.profile?.role
    ? auth.profile.role.charAt(0).toUpperCase() + auth.profile.role.slice(1)
    : "Member";

  // Misi Crystal
  const [missions, setMissions] = useState<LelangMission[]>([]);
  const [claimingMissionId, setClaimingMissionId] = useState<string | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Fetch User Crystal Balance
  const refreshBalance = useCallback(async () => {
    try {
      const bal = await getCrystalBalance(userId);
      setCrystalBalance(bal);
    } catch {}
    setLoadingBalance(false);
  }, [userId]);

  // 2. Fetch Lelang Items
  const refreshLelangItems = useCallback(async () => {
    try {
      const items = await getLelangItems();
      setLelangItems(items);
      // Sinkronkan selected item jika sedang dibuka
      setSelectedDetailItem((prev) => {
        if (!prev) return null;
        return items.find((i) => i.id === prev.id) || prev;
      });
    } catch {}
    setLoadingItems(false);
  }, []);

  // 3. Fetch Koleksi & Equipped Status
  const refreshOwnedItems = useCallback(async () => {
    try {
      const list = await getOwnedLelangItems(userId);
      setOwnedItems(list);

      // Ambil border IDs & banner IDs dari AsyncStorage + Catalog Border & Banner (sumber utama kepemilikan)
      const [borderIds, bannerIds, catalog, banners] = await Promise.all([
        getOwnedBorderIds(userId),
        getOwnedWallpaperIds(userId),
        fetchLiveBorderCatalog().catch(() => []),
        getAllGachaBanners().catch(() => []),
      ]);
      setOwnedBorderIds(borderIds);
      setOwnedBannerIds(bannerIds);
      if (Array.isArray(catalog) && catalog.length > 0) setCatalogBorders(catalog);
      if (Array.isArray(banners) && banners.length > 0) setCatalogBanners(banners);

      const eqMap: Record<string, boolean> = {};
      for (const it of list) {
        eqMap[it.id] = await isLelangItemEquipped(it, userId);
      }
      setEquippedMap(eqMap);
    } catch {}
  }, [userId]);

  // 4. Fetch Missions
  const refreshMissions = useCallback(async () => {
    try {
      const m = await getLelangMissions(userId);
      setMissions(m);
    } catch {}
  }, [userId]);

  // 5. Fetch Riwayat Lelang
  const refreshRiwayat = useCallback(async () => {
    try {
      const rw = await getLelangRiwayat(userId);
      setRiwayatList(rw);
    } catch {}
  }, [userId]);

  const handleBayarDanKlaim = async (item: LelangRiwayatItem) => {
    const itemPrice = item.price || item.item?.currentBid || item.item?.startPrice || 0;
    if (itemPrice > 0 && (crystalBalance < itemPrice || crystalBalance <= 0)) {
      hapticWarning();
      Alert.alert(
        "Saldo Crystal Tidak Cukup",
        `Saldo Crystal Anda (${(crystalBalance || 0).toLocaleString("id-ID")} Crystal) tidak mencukupi untuk melunasi hadiah "${item.title}".\n\nDibutuhkan: ${itemPrice.toLocaleString("id-ID")} Crystal.\nKekurangan: ${Math.max(0, itemPrice - crystalBalance).toLocaleString("id-ID")} Crystal.\n\nSilakan lakukan top up Crystal terlebih dahulu.`,
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Top Up Sekarang",
            onPress: () => {
              router.push("/topup" as never);
            },
          },
        ]
      );
      return;
    }

    setIsProcessingPayment(true);
    try {
      const res = await bayarDanKlaimHadiah(item.itemId || item.id, userId, item);
      if (res.success) {
        hapticSuccess();
        showToast(res.message);

        // 1. Update status klaim langsung pada view terbuka
        setSelectedKlaimItem((prev) => (prev ? { ...prev, isClaimed: true } : null));
        setSelectedHasilServerItem((prev) => (prev ? { ...prev, isClaimed: true } : null));

        // 2. Masukkan ID ke owned borders / banners lokal seketika
        const targetSourceId = item.item?.sourceId || item.itemId || item.id;
        if (item.type === "border" || item.item?.type === "border") {
          setOwnedBorderIds((prev) => (prev.includes(targetSourceId) ? prev : [...prev, targetSourceId]));
        } else {
          setOwnedBannerIds((prev) => (prev.includes(targetSourceId) ? prev : [...prev, targetSourceId]));
        }

        // 3. Update riwayatList lokal agar seluruh badge & tombol langsung berubah
        const cleanTargetId = (item.itemId || item.id).replace(/^hasil-/, "").replace(/^rw_/, "");
        setRiwayatList((prev) =>
          prev.map((r) =>
            r.itemId === item.itemId ||
            r.id === item.id ||
            (cleanTargetId && (r.itemId === cleanTargetId || r.id === cleanTargetId))
              ? { ...r, isClaimed: true }
              : r
          )
        );

        // 4. Update saldo di local React state seketika
        if (typeof res.remainingBalance === "number") {
          setCrystalBalance(res.remainingBalance);
        }

        // 5. Refresh background data (saldo berkurang, koleksi bertambah)
        void refreshBalance();
        void refreshOwnedItems();
        void refreshRiwayat();
      } else {
        hapticWarning();
        showToast(res.message);
      }
    } catch {
      showToast("Terjadi kendala saat memproses klaim.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Initial Fetch Data langsung dari database dengan loader berputar
  useEffect(() => {
    let isMounted = true;
    const fetchAllData = async () => {
      try {
        await Promise.all([
          refreshBalance(),
          refreshLelangItems(),
          refreshOwnedItems(),
          refreshMissions(),
          refreshRiwayat(),
        ]);
      } catch (err) {
        console.warn("[lelang] Initial load error:", err);
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    };
    void fetchAllData();
    return () => {
      isMounted = false;
    };
  }, [refreshBalance, refreshLelangItems, refreshOwnedItems, refreshMissions, refreshRiwayat]);

  // Pull-to-refresh langsung menyegarkan data ke server database
  const handlePullRefresh = async () => {
    hapticLight();
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshBalance(),
        refreshLelangItems(),
        refreshOwnedItems(),
        refreshMissions(),
        refreshRiwayat(),
      ]);
    } catch {
      showToast("Gagal menyinkronkan data lelang.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Refresh missions saat pengguna membuka Tab Event
  useEffect(() => {
    if (activeTab === "event") {
      void refreshMissions();
    }
  }, [activeTab, refreshMissions]);

  // Timer Tick (1s) for live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filtered Lelang Items
  const filteredLelangItems = useMemo(() => {
    return lelangItems.filter((item) => {
      if (filterCategory === "banner") return item.type === "banner";
      if (filterCategory === "border") return item.type === "border";
      if (filterCategory === "segera") {
        const remaining = Math.max(0, Math.floor((item.endsAt - now) / 1000));
        return remaining < 3600 * 3;
      }
      return true;
    });
  }, [lelangItems, filterCategory, now]);

  // Daftar & Jumlah Item Lelang yang Benar-Benar Sedang Aktif
  const activeLelangItems = useMemo(() => {
    return lelangItems.filter((i) => {
      const remainingSec = Math.max(0, Math.floor((i.endsAt - now) / 1000));
      return (i.status === "active" || !i.status) && remainingSec > 0;
    });
  }, [lelangItems, now]);

  const activeLelangCount = activeLelangItems.length;

  // Cek apakah item lelang sudah benar-benar dimiliki dalam koleksi pengguna
  const isItemAlreadyOwned = useCallback(
    (item?: LelangItem | null): boolean => {
      if (!item) return false;

      // JIKA USER MENANG LELANG INI TAPI BELUM KLAIM, MAKA BELUM DIMILIKI (MASIH MENUNGGU KLAIM)
      const cleanItemId = item.id ? item.id.replace(/^hasil-/, "").replace(/^rw_/, "") : "";
      const rw = riwayatList.find(
        (r) =>
          r.itemId === item.id ||
          (cleanItemId && r.itemId === cleanItemId) ||
          r.id === item.id ||
          (cleanItemId && r.id === cleanItemId)
      );
      if (rw && rw.status === "menang" && !rw.isClaimed) {
        return false;
      }
      if (rw && rw.status === "menang" && rw.isClaimed) {
        return true;
      }

      // 1. Cek dari AsyncStorage-backed border IDs & nama katalog (sumber paling akurat)
      if (item.type === "border") {
        if (item.sourceId && ownedBorderIds.includes(item.sourceId)) return true;
        if (item.id && ownedBorderIds.includes(item.id)) return true;

        // Cek kecocokan berdasarkan nama border di katalog
        const ownedNames = catalogBorders
          .filter((b) => ownedBorderIds.includes(b.id))
          .map((b) => (b.name || "").trim().toLowerCase());
        if (item.title && ownedNames.includes(item.title.trim().toLowerCase())) {
          return true;
        }
      }

      // 2. Cek dari AsyncStorage-backed banner IDs & nama katalog
      if (item.type === "banner") {
        if (item.sourceId && ownedBannerIds.includes(item.sourceId)) return true;
        if (item.id && ownedBannerIds.includes(item.id)) return true;

        // Cek kecocokan berdasarkan nama banner di katalog
        const ownedNames = catalogBanners
          .filter((b) => ownedBannerIds.includes(b.id))
          .map((b) => (b.name || "").trim().toLowerCase());
        if (item.title && ownedNames.includes(item.title.trim().toLowerCase())) {
          return true;
        }
      }

      // 3. Cek dari daftar lelang yang SUDAH BERHASIL DIKLAIM (dari Supabase / lelang_winners)
      return ownedItems.some((owned) => {
        if (owned.type !== item.type) return false;
        if (owned.sourceId && item.sourceId && owned.sourceId === item.sourceId) return true;
        if (owned.id && item.sourceId && owned.id === item.sourceId) return true;
        if (owned.sourceId && item.id && owned.sourceId === item.id) return true;
        if (
          owned.title &&
          item.title &&
          owned.title.trim().toLowerCase() === item.title.trim().toLowerCase()
        ) {
          return true;
        }
        return false;
      });
    },
    [ownedItems, ownedBorderIds, ownedBannerIds, catalogBorders, catalogBanners, riwayatList]
  );

  // Cek apakah akun pengguna saat ini memegang penawaran tertinggi (Anti-Double Bidding)
  const isUserHighestBidder = useCallback(
    (item?: LelangItem | null): boolean => {
      if (!item) return false;

      // 1. Cek dari ID pengguna
      if (userId && userId !== "guest") {
        if (item.highestBidderId === userId) return true;
        if (
          item.bidHistory &&
          item.bidHistory.length > 0 &&
          item.bidHistory[0].bidderId === userId
        ) {
          return true;
        }
      }

      // 2. Cek dari seluruh variasi nama profil / user
      const userAliases = [
        userName,
        auth.profile?.display_name,
        auth.profile?.username,
        auth.user?.user_metadata?.full_name,
        auth.user?.email?.split("@")[0],
      ]
        .filter((n): n is string => Boolean(n && n.trim().length > 0))
        .map((n) => n.trim().toLowerCase());

      const cleanHighestName = item.highestBidderName?.trim().toLowerCase();
      if (cleanHighestName && userAliases.includes(cleanHighestName)) {
        return true;
      }

      const topBidderName =
        item.bidHistory && item.bidHistory.length > 0
          ? item.bidHistory[0].bidderName?.trim().toLowerCase()
          : null;
      if (topBidderName && userAliases.includes(topBidderName)) {
        return true;
      }

      return false;
    },
    [userId, userName, auth.profile?.display_name, auth.profile?.username, auth.user?.user_metadata?.full_name, auth.user?.email]
  );

  // Cek apakah user saat ini adalah pemenang lelang (lelang telah berakhir dan user penawar tertinggi)
  const isUserWinner = useCallback(
    (item?: LelangItem | null): boolean => {
      if (!item) return false;
      const remainingSec = Math.max(0, Math.floor((item.endsAt - now) / 1000));
      const ended = item.status === "ended" || remainingSec <= 0;
      if (!ended) return false;

      const hasAnyBids =
        (item.bidHistory && item.bidHistory.length > 0) ||
        ((item.totalBidders || 0) > 0);
      if (!hasAnyBids) return false;

      // 1. Cek dari ID pengguna
      if (userId && userId !== "guest") {
        if (item.highestBidderId === userId) return true;
        if (
          item.bidHistory &&
          item.bidHistory.length > 0 &&
          item.bidHistory[0].bidderId === userId
        ) {
          return true;
        }
      }

      // 2. Cek dari seluruh variasi nama profil / user
      const userAliases = [
        userName,
        auth.profile?.display_name,
        auth.profile?.username,
        auth.user?.user_metadata?.full_name,
        auth.user?.email?.split("@")[0],
      ]
        .filter((n): n is string => Boolean(n && n.trim().length > 0))
        .map((n) => n.trim().toLowerCase());

      const cleanHighestName = item.highestBidderName?.trim().toLowerCase();
      if (cleanHighestName && userAliases.includes(cleanHighestName)) {
        return true;
      }

      const topBidderName =
        item.bidHistory && item.bidHistory.length > 0
          ? item.bidHistory[0].bidderName?.trim().toLowerCase()
          : null;
      if (topBidderName && userAliases.includes(topBidderName)) {
        return true;
      }

      // 3. Cek dari riwayat pemenang akun
      const rw = riwayatList.find((r) => r.itemId === item.id);
      if (rw && rw.status === "menang") return true;

      return false;
    },
    [userId, userName, now, riwayatList, auth.profile?.display_name, auth.profile?.username, auth.user?.user_metadata?.full_name, auth.user?.email]
  );

  // Buka Halaman Detail Lelang saat item diklik (Gambar 1 & 2)
  const openItemDetail = (item: LelangItem) => {
    hapticLight();
    setSelectedDetailItem(item);
  };

  // Buka Hasil Resmi Lelang (Termasuk lelang yang berakhir tanpa penawar)
  const handleOpenHasilLelang = () => {
    hapticLight();
    if (!selectedDetailItem) return;

    const cleanId = selectedDetailItem.id.replace(/^hasil-/, "");
    let bidsHistory = selectedDetailItem.bidHistory || [];
    if (bidsHistory.length === 0) {
      const matched = lelangItems.find((l) => l.id === selectedDetailItem.id || l.id === cleanId);
      if (matched?.bidHistory && matched.bidHistory.length > 0) {
        bidsHistory = matched.bidHistory;
      }
    }

    const hasAnyBids =
      bidsHistory.length > 0 ||
      ((selectedDetailItem.totalBidders || 0) > 0);

    const rw = riwayatList.find(
      (r) =>
        r.itemId === selectedDetailItem.id ||
        r.itemId === cleanId ||
        r.id === selectedDetailItem.id ||
        r.id === cleanId
    );
    const isMe = hasAnyBids && isUserWinner(selectedDetailItem);
    const isClaimed = Boolean(
      rw?.isClaimed === true ||
      isItemAlreadyOwned(selectedDetailItem) ||
      ownedBorderIds.includes(selectedDetailItem.sourceId || cleanId) ||
      ownedBannerIds.includes(selectedDetailItem.sourceId || cleanId) ||
      ownedItems.some((o) => o.id === cleanId || o.sourceId === selectedDetailItem.sourceId)
    );

    const topBid = bidsHistory[0];
    const winnerName =
      !hasAnyBids
        ? "Tidak Ada Pemenang"
        : selectedDetailItem.highestBidderName || topBid?.bidderName || (isMe ? userName : "Peserta Lelang");

    setSelectedHasilServerItem({
      id: rw?.id || `hasil-${selectedDetailItem.id}`,
      itemId: selectedDetailItem.id,
      title: selectedDetailItem.title,
      type: selectedDetailItem.type,
      rarity: selectedDetailItem.rarity,
      status: !hasAnyBids ? "kalah" : isMe ? "menang" : "kalah",
      price: !hasAnyBids ? selectedDetailItem.startPrice : selectedDetailItem.currentBid,
      dateFormatted: selectedDetailItem.endTimeFormatted || "Selesai",
      isClaimed,
      winnerName,
      totalBidders: !hasAnyBids ? 0 : Math.max(selectedDetailItem.totalBidders || 0, new Set(bidsHistory.map((b) => b.bidderName)).size || 1),
      totalBids: bidsHistory.length,
      item: {
        ...selectedDetailItem,
        bidHistory: bidsHistory,
      },
    });
  };

  // Buka Modal Konfirmasi Penawaran saat tombol "Ajukan Penawaran" diklik (Gambar 3)
  const openConfirmModal = () => {
    if (!selectedDetailItem) return;
    if (isItemAlreadyOwned(selectedDetailItem)) {
      hapticWarning();
      Alert.alert(
        "Sudah Dimiliki",
        `Anda sudah memiliki ${selectedDetailItem.type === "banner" ? "banner" : "border"} "${selectedDetailItem.title}" dalam koleksi akun Anda, sehingga tidak dapat mengajukan penawaran.`
      );
      return;
    }
    if (isUserHighestBidder(selectedDetailItem)) {
      hapticWarning();
      Alert.alert(
        "Tawaranmu Sedang Memimpin",
        "Kamu saat ini sudah memegang penawaran tertinggi untuk item ini! Kamu tidak dapat menawar lagi sampai ada peserta lain yang menaikkan tawaran lelang."
      );
      return;
    }
    hapticLight();
    const minInc = selectedDetailItem.minIncrement || 100;
    const defaultBid = selectedDetailItem.currentBid + minInc;
    setBidAmountInput(String(defaultBid));
    setAgreementChecked(true);
    setIsConfirmModalOpen(true);
  };

  // Konfirmasi Pasang Tawaran (Submit Modal Gambar 3)
  const handleConfirmBid = async () => {
    if (!selectedDetailItem) return;
    if (isItemAlreadyOwned(selectedDetailItem)) {
      hapticWarning();
      Alert.alert(
        "Sudah Dimiliki",
        `Anda sudah memiliki ${selectedDetailItem.type === "banner" ? "banner" : "border"} ini dalam koleksi akun Anda.`
      );
      return;
    }
    if (isUserHighestBidder(selectedDetailItem)) {
      hapticWarning();
      Alert.alert(
        "Tawaranmu Sedang Memimpin",
        "Kamu saat ini sudah memegang penawaran tertinggi untuk item ini! Tunggu hingga ada peserta lain yang menawar lebih tinggi."
      );
      return;
    }
    if (!agreementChecked) {
      hapticWarning();
      Alert.alert("Perhatian", "Harap centang persetujuan ketentuan lelang terlebih dahulu.");
      return;
    }

    const amount = parseInt(bidAmountInput.replace(/\D/g, ""), 10);
    if (!Number.isFinite(amount) || amount <= selectedDetailItem.currentBid) {
      hapticWarning();
      Alert.alert(
        "Tawaran Tidak Valid",
        `Tawaran harus lebih tinggi dari harga tertinggi saat ini (${selectedDetailItem.currentBid.toLocaleString("id-ID")} Crystal).`
      );
      return;
    }

    if (crystalBalance < amount || crystalBalance <= 0) {
      hapticWarning();
      Alert.alert(
        "Saldo Crystal Tidak Cukup",
        `Saldo Crystal Anda (${(crystalBalance || 0).toLocaleString("id-ID")} Crystal) tidak mencukupi untuk memasang tawaran sebesar ${amount.toLocaleString("id-ID")} Crystal.\n\nKekurangan: ${Math.max(0, amount - crystalBalance).toLocaleString("id-ID")} Crystal.\n\nSilakan lakukan top up terlebih dahulu.`,
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Top Up Sekarang",
            onPress: () => {
              setIsConfirmModalOpen(false);
              router.push("/topup" as never);
            },
          },
        ]
      );
      return;
    }

    setSubmittingBid(true);
    const res = await placeLelangBid({
      itemId: selectedDetailItem.id,
      bidAmount: amount,
      userId,
      userName,
    });
    setSubmittingBid(false);

    if (res.success && res.updatedItem) {
      hapticSuccess();
      setSelectedDetailItem(res.updatedItem);
      setIsConfirmModalOpen(false);
      showToast(`Tawaranmu ${amount.toLocaleString("id-ID")} Crystal berhasil dipasang!`);
      void refreshBalance();
      void refreshLelangItems();
      void refreshMissions();
    } else {
      hapticWarning();
      Alert.alert("Gagal Memasang Tawaran", res.error || "Terjadi kesalahan.");
    }
  };

  // Equip Item
  const handleEquip = async (item: LelangItem) => {
    hapticLight();
    const res = await equipLelangItem(item, userId);
    if (res.success) {
      hapticSuccess();
      showToast(res.message);
      void refreshOwnedItems();
      void getEquippedBorderId(userId).then(setEquippedBorderId);
    } else {
      hapticWarning();
      Alert.alert("Gagal", res.message);
    }
  };

  // Claim Mission
  const handleClaimMission = async (missionId: string) => {
    hapticLight();
    setClaimingMissionId(missionId);
    const res = await claimLelangMission(missionId, userId);
    setClaimingMissionId(null);

    if (res.success) {
      hapticSuccess();
      showToast(`+${res.reward} Dylan Crystal berhasil diklaim!`);
      void refreshBalance();
      void refreshMissions();
    } else {
      hapticWarning();
      Alert.alert("Perhatian", res.error || "Misi belum dapat diklaim.");
    }
  };

  // Navigasi & Aksi untuk Misi Harian
  const handleMissionAction = async (m: LelangMission) => {
    hapticLight();
    if (m.id === "misi-lelang") {
      setActiveTab("lelang");
      showToast("Pilih salah satu item lelang aktif untuk menawar.");
    } else if (m.id === "misi-nobar") {
      await markMissionProgress("misi-nobar", userId);
      void refreshMissions();
      router.push("/nobar" as never);
    } else if (m.id === "misi-anime") {
      await markMissionProgress("misi-anime", userId);
      void refreshMissions();
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)" as never);
      }
    }
  };

  // Handle Back to Main Anime Feature
  const handleBackToAnime = () => {
    hapticLight();
    if (isInfoLelangOpen) {
      setIsInfoLelangOpen(false);
      return;
    }
    if (selectedDetailItem) {
      setSelectedDetailItem(null);
      return;
    }
    if (activeTab !== "home") {
      setActiveTab("home");
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)" as never);
      }
    }
  };

  // LOADING BULAT PUTAR PROPESIONAL SAAT AWAL MASUK LELANG (SESUAI REQUEST USER)
  if (isInitialLoading) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
        <View style={styles.headerBar}>
          <View style={styles.headerLeft}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kembali ke Anime"
              onPress={handleBackToAnime}
              style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
              hitSlop={8}
            >
              <AppIcon name="arrow-left" size={20} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Lelang Nuenime</Text>
              <Text style={styles.headerSubtitle}>Menghubungkan ke database...</Text>
            </View>
          </View>
        </View>

        <View style={styles.fullLoadingCenterWrap}>
          <View style={styles.fullLoadingContent}>
            <ChibiLoading size={80} style={{ marginBottom: 14 }} />
            <Text style={styles.fullLoadingTitle}>Memuat Lelang Nuenime</Text>
            <Text style={styles.fullLoadingSubtitle}>
              Mengambil data lelang & saldo langsung dari database server...
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* ══════════════════════════════════════════════════════════════
          1. HASIL RESMI SERVER (PERSIS GAMBAR 3 SCREENSHOT USER)
          ══════════════════════════════════════════════════════════════ */}
      {selectedHasilServerItem ? (
        <View style={styles.hasilContainer}>
          {/* Header */}
          <View style={styles.detailHeaderBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kembali"
              onPress={() => {
                hapticLight();
                setSelectedHasilServerItem(null);
              }}
              style={({ pressed }) => [styles.detailIconCircle, pressed && styles.btnPressed]}
              hitSlop={8}
            >
              <AppIcon name="arrow-left" size={20} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.hasilServerHeaderTitle}>Hasil Resmi Server</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.hasilScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Celebration Trophy Header */}
            <View style={styles.hasilCelebrationCard}>
              {(selectedHasilServerItem.totalBidders ?? 0) === 0 ? (
                <View
                  style={[
                    styles.trophyGlowWrap,
                    {
                      backgroundColor: "rgba(148, 163, 184, 0.12)",
                      borderColor: "rgba(148, 163, 184, 0.3)",
                      shadowColor: "#64748B",
                    },
                  ]}
                >
                  <AppIcon name="gavel" size={44} color="#94A3B8" />
                </View>
              ) : (
                <View style={styles.trophyGlowWrap}>
                  <AppIcon name="trophy" size={54} color="#F59E0B" />
                </View>
              )}
              <Text style={styles.hasilCelebrationTitle}>
                {(selectedHasilServerItem.totalBidders ?? 0) === 0
                  ? "Lelang Ditutup"
                  : "Lelang Berakhir!"}
              </Text>
              <Text style={styles.hasilCelebrationSubtitle}>
                {(selectedHasilServerItem.totalBidders ?? 0) === 0
                  ? "Sesi penawaran lelang telah selesai tanpa pemenang untuk item:"
                  : "Berikut adalah hasil lelang untuk:"}
              </Text>
            </View>

            {/* Item Card */}
            <View style={styles.hasilItemCard}>
              <LelangItemArt item={selectedHasilServerItem.item} size={46} />
              <View style={styles.hasilItemMetaCol}>
                <Text style={styles.hasilItemTitle}>{selectedHasilServerItem.title}</Text>
                <View style={styles.modalItemTag}>
                  <AppIcon
                    name={selectedHasilServerItem.type === "banner" ? "image-outline" : "crop-free"}
                    size={10}
                    color="#60A5FA"
                  />
                  <Text style={styles.modalItemTagText}>
                    {selectedHasilServerItem.type === "banner" ? "Banner" : "Border"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Pemenang Card */}
            <View style={styles.hasilWinnerCard}>
              {(selectedHasilServerItem.totalBidders ?? 0) === 0 ? (
                <View style={styles.hasilWinnerTopRow}>
                  <View style={styles.hasilWinnerBadgeTitle}>
                    <AppIcon name="alert-circle-outline" size={15} color="#94A3B8" />
                    <Text style={[styles.hasilWinnerTitleText, { color: "#94A3B8" }]}>Status Lelang</Text>
                  </View>
                  <View style={styles.hasilTutupPill}>
                    <Text style={styles.hasilTutupText}>Ditutup</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.hasilWinnerTopRow}>
                  <View style={styles.hasilWinnerBadgeTitle}>
                    <AppIcon name="crown" size={15} color="#F59E0B" />
                    <Text style={styles.hasilWinnerTitleText}>Pemenang</Text>
                  </View>
                  {selectedHasilServerItem.status === "menang" ? (
                    <View style={styles.hasilKamuMenangPill}>
                      <Text style={styles.hasilKamuMenangText}>Kamu Menang!</Text>
                    </View>
                  ) : (
                    <View style={styles.hasilSelesaiPill}>
                      <Text style={styles.hasilSelesaiText}>Selesai</Text>
                    </View>
                  )}
                </View>
              )}

              {/* User Row */}
              {(selectedHasilServerItem.totalBidders ?? 0) === 0 ? (
                <View style={styles.hasilUserRow}>
                  <View style={[styles.hasilUserAvatarCircle, { borderColor: "#334155", backgroundColor: "#0F172A" }]}>
                    <AppIcon name="gavel" size={20} color="#64748B" />
                  </View>
                  <View style={styles.hasilUserMetaCol}>
                    <Text style={styles.hasilUserNameText}>Tidak Ada Pemenang</Text>
                    <Text style={styles.hasilEmptySubtitle}>Sesi lelang berakhir tanpa penawaran</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.hasilUserRow}>
                  <View style={styles.hasilUserAvatarCircle}>
                    <AppIcon name="account" size={24} color="#CBD5E1" />
                  </View>
                  <View style={styles.hasilUserMetaCol}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Text style={styles.hasilUserNameText}>
                        {selectedHasilServerItem.winnerName ||
                          selectedHasilServerItem.item?.highestBidderName ||
                          userName}
                      </Text>
                      <AppIcon name="crown" size={13} color="#F59E0B" />
                    </View>
                    <View style={styles.hasilMemberTag}>
                      <Text style={styles.hasilMemberTagText}>Pemenang Lelang</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Specs */}
              <View style={styles.hasilPriceRow}>
                <Text style={styles.hasilPriceLabel}>
                  {(selectedHasilServerItem.totalBidders ?? 0) === 0 ? "Harga Awal" : "Harga Tertinggi"}
                </Text>
                <View style={styles.specValueRow}>
                  <Image source={CRYSTAL_IMG} style={styles.microCrystal} contentFit="contain" />
                  <Text style={styles.hasilPriceAmount}>
                    {(selectedHasilServerItem.price || 0).toLocaleString("id-ID")}
                  </Text>
                </View>
              </View>

              <View style={styles.hasilDivider} />

              <View style={styles.hasilDualStatsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hasilDualStatsLabel}>Total Penawar</Text>
                  <Text style={styles.hasilDualStatsVal}>
                    {selectedHasilServerItem.totalBidders ??
                      selectedHasilServerItem.item?.totalBidders ??
                      0}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hasilDualStatsLabel}>Total Penawaran</Text>
                  <Text style={styles.hasilDualStatsVal}>
                    {selectedHasilServerItem.totalBids ??
                      selectedHasilServerItem.item?.bidHistory?.length ??
                      0}
                  </Text>
                </View>
              </View>
            </View>

            {/* Leaderboard Card (Peringkat Penawaran Nyata dari Supabase) */}
            <View style={styles.hasilLeaderboardCard}>
              <Text style={styles.hasilLeaderboardTitle}>Peringkat Penawaran</Text>

              {selectedHasilServerItem.item?.bidHistory &&
              selectedHasilServerItem.item.bidHistory.length > 0 ? (
                selectedHasilServerItem.item.bidHistory.slice(0, 5).map((bid, index) => {
                  const rank = index + 1;
                  const badgeColor =
                    rank === 1 ? "#F59E0B" : rank === 2 ? "#94A3B8" : rank === 3 ? "#CD7F32" : "#475569";

                  return (
                    <View key={bid.id || `rank_${rank}`} style={styles.hasilLeaderboardRow}>
                      <View style={styles.hasilLeaderboardLeft}>
                        <View style={[styles.rankCircle, { borderColor: badgeColor }]}>
                          <Text style={[styles.rankCircleText, { color: badgeColor }]}>{rank}</Text>
                        </View>
                        <Text style={styles.rankNameText}>{bid.bidderName}</Text>
                      </View>
                      <View style={styles.specValueRow}>
                        <Image source={CRYSTAL_IMG} style={styles.microCrystal} contentFit="contain" />
                        <Text style={styles.rankAmountText}>{bid.amount.toLocaleString("id-ID")}</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={{ paddingVertical: 18, alignItems: "center", gap: 4 }}>
                  <AppIcon name="gavel" size={24} color="#475569" />
                  <Text style={{ color: "#94A3B8", fontSize: 13, fontFamily: "Nunito-Bold", marginTop: 4 }}>
                    {(selectedHasilServerItem.totalBidders ?? 0) === 0 ? "Tidak Ada Penawaran" : "Belum Ada Riwayat Penawaran"}
                  </Text>
                  <Text style={{ color: "#64748B", fontSize: 11.5, fontFamily: "Nunito-Regular", textAlign: "center" }}>
                    {(selectedHasilServerItem.totalBidders ?? 0) === 0
                      ? "Sesi lelang ini telah berakhir dan ditutup tanpa penawar."
                      : "Riwayat penawaran tidak tersedia."}
                  </Text>
                </View>
              )}
            </View>

            {/* Bottom CTA Buttons */}
            {(selectedHasilServerItem.totalBidders ?? 0) > 0 && selectedHasilServerItem.status === "menang" && (
              <Pressable
                onPress={() => {
                  hapticLight();
                  const cleanHasilId = selectedHasilServerItem.itemId.replace(/^hasil-/, "").replace(/^rw_/, "");
                  const rwClaim = riwayatList.find(
                    (r) =>
                      r.itemId === selectedHasilServerItem.itemId ||
                      r.itemId === cleanHasilId ||
                      r.id === selectedHasilServerItem.id
                  );
                  setSelectedKlaimItem({
                    ...selectedHasilServerItem,
                    isClaimed: Boolean(
                      selectedHasilServerItem.isClaimed ||
                      rwClaim?.isClaimed ||
                      isItemAlreadyOwned(selectedHasilServerItem.item)
                    ),
                  });
                  setSelectedHasilServerItem(null);
                }}
                style={({ pressed }) => [
                  styles.hasilBukaKlaimBtn,
                  selectedHasilServerItem.isClaimed && styles.hasilBukaKlaimBtnDone,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text
                  style={[
                    styles.hasilBukaKlaimBtnText,
                    selectedHasilServerItem.isClaimed && styles.hasilBukaKlaimBtnTextDone,
                  ]}
                >
                  {selectedHasilServerItem.isClaimed
                    ? "✓ Hadiah Sudah Diklaim (Lihat Status)"
                    : "Buka Klaim Hadiah Pemenang"}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                hapticLight();
                setSelectedDetailItem(selectedHasilServerItem.item);
                setSelectedHasilServerItem(null);
              }}
              style={({ pressed }) => [styles.hasilLihatDetailBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.hasilLihatDetailBtnText}>Lihat Detail Item</Text>
            </Pressable>
          </ScrollView>
        </View>
      ) : selectedKlaimItem ? (
        /* ══════════════════════════════════════════════════════════════
            2. KLAIM HADIAH & BAYAR (PERSIS GAMBAR 2 SCREENSHOT USER)
            ══════════════════════════════════════════════════════════════ */
        <View style={styles.klaimContainer}>
          {/* Header */}
          <View style={styles.detailHeaderBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kembali"
              onPress={() => {
                hapticLight();
                setSelectedKlaimItem(null);
              }}
              style={({ pressed }) => [styles.detailIconCircle, pressed && styles.btnPressed]}
              hitSlop={8}
            >
              <AppIcon name="arrow-left" size={20} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.klaimHeaderTitle}>Klaim Hadiah</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.klaimScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Item Header Preview Card */}
            <View style={styles.klaimItemCard}>
              <View style={styles.klaimItemTopRow}>
                <LelangItemArt item={selectedKlaimItem.item} size={54} />
                <View style={styles.klaimItemMetaCol}>
                  <Text style={styles.klaimItemTitle}>{selectedKlaimItem.title}</Text>
                  <View style={styles.modalItemTag}>
                    <AppIcon
                      name={selectedKlaimItem.type === "banner" ? "image-outline" : "crop-free"}
                      size={10}
                      color="#60A5FA"
                    />
                    <Text style={styles.modalItemTagText}>
                      {selectedKlaimItem.type === "banner" ? "Banner" : "Border"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Green Announcement Box */}
              <View style={styles.klaimGreenBox}>
                <AppIcon name="check-circle" size={18} color="#10B981" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.klaimGreenTitle}>Kamu adalah pemenang lelang!</Text>
                  <Text style={styles.klaimGreenDesc}>
                    Lakukan pembayaran Crystal sesuai harga akhir untuk mengklaim item.
                  </Text>
                </View>
              </View>
            </View>

            {/* 2. Detail Spec Card */}
            <View style={styles.klaimSpecCard}>
              <View style={styles.klaimSpecRow}>
                <Text style={styles.klaimSpecLabel}>Harga Akhir</Text>
                <View style={styles.specValueRow}>
                  <Image source={CRYSTAL_IMG} style={styles.microCrystal} contentFit="contain" />
                  <Text style={styles.klaimSpecValueBold}>
                    {selectedKlaimItem.price.toLocaleString("id-ID")}
                  </Text>
                </View>
              </View>

              <View style={styles.klaimSpecRow}>
                <Text style={styles.klaimSpecLabel}>Batas Waktu Klaim</Text>
                <Text style={styles.klaimSpecValue}>
                  {selectedKlaimItem.claimDeadline || "14 Okt 2025 • 18:20 (4 jam lagi)"}
                </Text>
              </View>

              <View style={styles.klaimDivider} />

              <View style={[styles.klaimSpecRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.klaimSpecLabel}>Status Pembayaran & Hadiah</Text>
                <Text
                  style={[
                    styles.klaimStatusText,
                    selectedKlaimItem.isClaimed && styles.klaimStatusTextDone,
                  ]}
                >
                  {selectedKlaimItem.isClaimed ? "Klaim Berhasil" : "Menunggu Klaim"}
                </Text>
              </View>
            </View>

            {/* 3. Saldo Crystal Card */}
            <View style={styles.klaimBalanceCard}>
              <Text style={styles.klaimBalanceLabel}>Saldo Crystal Kamu</Text>
              <View style={styles.klaimBalanceRow}>
                <View style={styles.specValueRow}>
                  <Image source={CRYSTAL_IMG} style={styles.mediumCrystalIcon} contentFit="contain" />
                  <Text style={styles.klaimBalanceAmount}>
                    {crystalBalance.toLocaleString("id-ID")}
                  </Text>
                </View>

                <Pressable
                  onPress={() => {
                    hapticLight();
                    router.push("/topup" as never);
                  }}
                  style={({ pressed }) => [styles.klaimTopupBtn, pressed && styles.btnPressed]}
                >
                  <Text style={styles.klaimTopupBtnText}>+ 1.000 Crystal &gt;</Text>
                </Pressable>
              </View>
            </View>

            {/* 4. Bottom Action */}
            {crystalBalance < (selectedKlaimItem.price || 0) && !selectedKlaimItem.isClaimed ? (
              <Pressable
                onPress={() => {
                  hapticLight();
                  router.push("/topup" as never);
                }}
                style={({ pressed }) => [
                  styles.klaimPayBtn,
                  { backgroundColor: "rgba(245, 158, 11, 0.95)" },
                  pressed && styles.btnPressed,
                ]}
              >
                <AppIcon name="plus-circle" size={17} color="#FFFFFF" />
                <Text style={styles.klaimPayBtnText}>
                  Saldo Kurang • Top Up Sekarang
                </Text>
              </Pressable>
            ) : (
              <Pressable
                disabled={isProcessingPayment || selectedKlaimItem.isClaimed}
                onPress={() => handleBayarDanKlaim(selectedKlaimItem)}
                style={({ pressed }) => [
                  styles.klaimPayBtn,
                  selectedKlaimItem.isClaimed && styles.klaimPayBtnDone,
                  pressed && !selectedKlaimItem.isClaimed && styles.btnPressed,
                ]}
              >
                {isProcessingPayment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : selectedKlaimItem.isClaimed ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <AppIcon name="check-circle" size={16} color="#10B981" />
                    <Text style={styles.klaimPayBtnTextDone}>Hadiah Sudah Diklaim</Text>
                  </View>
                ) : (
                  <Text style={styles.klaimPayBtnText}>Bayar & Klaim</Text>
                )}
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                hapticLight();
                Alert.alert(
                  "Syarat & Ketentuan Klaim Lelang",
                  "1. Pemenang lelang memiliki waktu maksimal 24 jam untuk melakukan pembayaran.\n2. Pembayaran memotong Crystal yang sudah direservasi atau saldo utama.\n3. Item yang telah diklaim otomatis menjadi hak milik permanen akun dan dapat dipasang di profil kapan saja.",
                  [{ text: "Mengerti" }]
                );
              }}
              style={styles.klaimTermsWrap}
            >
              <Text style={styles.klaimTermsText}>Syarat & Ketentuan</Text>
            </Pressable>
          </ScrollView>
        </View>
      ) : isInfoLelangOpen ? (
        /* ══════════════════════════════════════════════════════════════
            3. HALAMAN INFORMASI & PANDUAN LELANG (SESUAI REQUEST USER)
            ══════════════════════════════════════════════════════════════ */
        <View style={styles.hasilContainer}>
          {/* Header */}
          <View style={styles.detailHeaderBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kembali"
              onPress={() => {
                hapticLight();
                setIsInfoLelangOpen(false);
              }}
              style={({ pressed }) => [styles.detailIconCircle, pressed && styles.btnPressed]}
              hitSlop={8}
            >
              <AppIcon name="arrow-left" size={20} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.hasilServerHeaderTitle}>Informasi & Panduan Lelang</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.klaimScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Hero Card Info */}
            <View style={styles.infoHeroCard}>
              <View style={styles.infoHeroBadgeRow}>
                <View style={styles.heroLiveBadge}>
                  <Text style={styles.heroLiveText}>PANDUAN RESMI</Text>
                </View>
                <Text style={styles.heroLiveMeta}>Nuenime Auction System</Text>
              </View>
              <Text style={styles.infoHeroTitle}>Cara Kerja & Aturan Lelang</Text>
              <Text style={styles.infoHeroDesc}>
                Lelang Nuenime adalah sarana resmi bagi seluruh member untuk memperebutkan Banner profil dan Border avatar eksklusif secara adil, transparan, dan real-time menggunakan Dylan Crystal.
              </Text>
            </View>

            {/* 2. 4 Langkah Mudah Ikut Lelang */}
            <View style={styles.infoSectionCard}>
              <View style={styles.infoSectionHeader}>
                <View style={[styles.infoIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                  <AppIcon name="gavel" size={18} color="#38BDF8" />
                </View>
                <Text style={styles.infoSectionTitle}>4 Langkah Mudah Ikut Lelang</Text>
              </View>

              <View style={styles.infoStepList}>
                <View style={styles.infoStepItem}>
                  <View style={styles.infoStepNumberBox}>
                    <Text style={styles.infoStepNumberText}>1</Text>
                  </View>
                  <View style={styles.infoStepContent}>
                    <Text style={styles.infoStepHeading}>Pilih Item Impian</Text>
                    <Text style={styles.infoStepDesc}>
                      Buka tab Lelang dan cari Banner atau Border yang sedang dalam sesi penawaran aktif.
                    </Text>
                  </View>
                </View>

                <View style={styles.infoStepItem}>
                  <View style={styles.infoStepNumberBox}>
                    <Text style={styles.infoStepNumberText}>2</Text>
                  </View>
                  <View style={styles.infoStepContent}>
                    <Text style={styles.infoStepHeading}>Ajukan Penawaran Crystal</Text>
                    <Text style={styles.infoStepDesc}>
                      Tawar lebih tinggi dari harga tertinggi saat ini sesuai kelipatan kenaikan minimum.
                    </Text>
                  </View>
                </View>

                <View style={styles.infoStepItem}>
                  <View style={styles.infoStepNumberBox}>
                    <Text style={styles.infoStepNumberText}>3</Text>
                  </View>
                  <View style={styles.infoStepContent}>
                    <Text style={styles.infoStepHeading}>Sistem Anti-Double Bidding</Text>
                    <Text style={styles.infoStepDesc}>
                      Jika tawaranmu sedang memimpin, kamu tidak bisa menawar lagi sampai ada peserta lain yang menawar lebih tinggi.
                    </Text>
                  </View>
                </View>

                <View style={styles.infoStepItem}>
                  <View style={styles.infoStepNumberBox}>
                    <Text style={styles.infoStepNumberText}>4</Text>
                  </View>
                  <View style={styles.infoStepContent}>
                    <Text style={styles.infoStepHeading}>Pelunasan & Klaim Permanen</Text>
                    <Text style={styles.infoStepDesc}>
                      Bila menang saat sesi lelang berakhir, bayar & klaim hadiah. Item menjadi hak milik permanen akunmu!
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 3. Ketentuan & Kebijakan */}
            <View style={styles.infoSectionCard}>
              <View style={styles.infoSectionHeader}>
                <View style={[styles.infoIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                  <AppIcon name="shield-check" size={18} color="#F59E0B" />
                </View>
                <Text style={styles.infoSectionTitle}>Ketentuan & Kebijakan</Text>
              </View>

              <View style={styles.infoRuleRow}>
                <AppIcon name="check-circle" size={15} color="#10B981" />
                <Text style={styles.infoRuleText}>
                  Peserta yang sudah memiliki item dalam koleksi akun tidak diperkenankan menawar item yang sama demi menjaga keadilan kompetisi.
                </Text>
              </View>

              <View style={styles.infoRuleRow}>
                <AppIcon name="check-circle" size={15} color="#10B981" />
                <Text style={styles.infoRuleText}>
                  Pemenang lelang memiliki waktu 24 jam untuk melunasi dan mengklaim item hadiah kemenangan.
                </Text>
              </View>

              <View style={styles.infoRuleRow}>
                <AppIcon name="check-circle" size={15} color="#10B981" />
                <Text style={styles.infoRuleText}>
                  Crystal gratis dapat dikumpulkan setiap hari melalui Tab Event Misi Harian (Check-in, Tonton Anime, dan Room Nobar).
                </Text>
              </View>

              <View style={styles.infoRuleRow}>
                <AppIcon name="check-circle" size={15} color="#10B981" />
                <Text style={styles.infoRuleText}>
                  Setiap item yang diklaim langsung terhubung dengan profil akun dan dapat dipasang kapan saja dari menu Koleksi atau Profil.
                </Text>
              </View>
            </View>

            {/* 4. Bottom Button Masuk Ruang Lelang */}
            <Pressable
              onPress={() => {
                hapticLight();
                setIsInfoLelangOpen(false);
                setActiveTab("lelang");
              }}
              style={({ pressed }) => [styles.hasilBukaKlaimBtn, pressed && styles.btnPressed]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <AppIcon name="gavel" size={18} color="#FFFFFF" />
                <Text style={styles.hasilBukaKlaimBtnText}>Masuk ke Ruang Lelang</Text>
              </View>
            </Pressable>
          </ScrollView>
        </View>
      ) : selectedDetailItem ? (
        <View style={styles.detailContainer}>
          {/* Top Bar Detail: Back Arrow, Share, Menu */}
          <View style={styles.detailHeaderBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kembali ke daftar lelang"
              onPress={() => {
                hapticLight();
                setSelectedDetailItem(null);
              }}
              style={({ pressed }) => [styles.detailIconCircle, pressed && styles.btnPressed]}
              hitSlop={8}
            >
              <AppIcon name="arrow-left" size={20} color="#FFFFFF" />
            </Pressable>

            <View style={styles.detailHeaderRight}>
              <Pressable
                onPress={() => {
                  hapticLight();
                  void Share.share({
                    message: `Ayo ikuti Lelang Eksklusif "${selectedDetailItem.title}" di Nuenime! Tawaran saat ini: ${selectedDetailItem.currentBid.toLocaleString("id-ID")} Crystal.`,
                  });
                }}
                style={({ pressed }) => [styles.detailIconCircle, pressed && styles.btnPressed]}
              >
                <AppIcon name="share-variant" size={18} color="#FFFFFF" />
              </Pressable>

              <Pressable
                onPress={() => {
                  hapticLight();
                  Alert.alert(
                    "Info Item Lelang",
                    `Item: ${selectedDetailItem.title}\nTipe: ${selectedDetailItem.type.toUpperCase()}\nRarity: ${selectedDetailItem.rarity}\nStatus: ${selectedDetailItem.status}`,
                    [{ text: "Tutup" }]
                  );
                }}
                style={({ pressed }) => [styles.detailIconCircle, pressed && styles.btnPressed]}
              >
                <AppIcon name="dots-vertical" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.detailScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. ARTWORK SHOWCASE DISPLAY (CENTERED GLOWING BORDER ATAU FULL BANNER) */}
            <View style={styles.showcaseWrap}>
              {selectedDetailItem.type === "border" ? (
                <View style={styles.borderShowcaseBox}>
                  {/* Glowing Aura Ring */}
                  <View
                    style={[
                      styles.borderOuterAura,
                      {
                        backgroundColor:
                          selectedDetailItem.glowColor || "rgba(56, 189, 248, 0.18)",
                        shadowColor: selectedDetailItem.accentColor,
                      },
                    ]}
                  />
                  <LelangItemArt item={selectedDetailItem} size={180} variant="showcase" />
                </View>
              ) : (
                <View style={styles.bannerShowcaseBox}>
                  <LelangItemArt
                    item={selectedDetailItem}
                    size={220}
                    variant="showcase"
                    style={{ width: "100%", height: 160 }}
                  />
                </View>
              )}
            </View>

            {/* 2. TAG, TITLE & DESCRIPTION */}
            <View style={styles.detailMetaBlock}>
              <View style={styles.detailTagRow}>
                <View style={styles.detailTypeBadge}>
                  <AppIcon
                    name={selectedDetailItem.type === "banner" ? "image-outline" : "crop-free"}
                    size={11}
                    color="#60A5FA"
                  />
                  <Text style={styles.detailTypeBadgeText}>
                    {selectedDetailItem.type === "banner" ? "Banner" : "Border"}
                  </Text>
                </View>
              </View>

              <Text style={styles.detailTitle}>{selectedDetailItem.title}</Text>
              <Text style={styles.detailDesc}>{selectedDetailItem.description}</Text>
            </View>

            {/* 3. SPECIFICATION TABLE CARD */}
            <View style={styles.specCard}>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Harga Awal</Text>
                <View style={styles.specValueRow}>
                  <Image source={CRYSTAL_IMG} style={styles.microCrystal} contentFit="contain" />
                  <Text style={styles.specValueText}>
                    {selectedDetailItem.startPrice.toLocaleString("id-ID")}
                  </Text>
                </View>
              </View>

              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Kenaikan Minimum</Text>
                <View style={styles.specValueRow}>
                  <Image source={CRYSTAL_IMG} style={styles.microCrystal} contentFit="contain" />
                  <Text style={styles.specValueText}>
                    {(selectedDetailItem.minIncrement || 100).toLocaleString("id-ID")}
                  </Text>
                </View>
              </View>

              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Durasi</Text>
                <Text style={styles.specValueText}>
                  {selectedDetailItem.durationHours || 3} Jam
                </Text>
              </View>

              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Mulai</Text>
                <Text style={styles.specValueText}>
                  {selectedDetailItem.startTimeFormatted || "14 Okt 2025 • 11:00"}
                </Text>
              </View>

              <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.specLabel}>Berakhir</Text>
                <Text style={styles.specValueText}>
                  {selectedDetailItem.endTimeFormatted || "14 Okt 2025 • 14:00"}
                </Text>
              </View>
            </View>

            {/* 4. SISA WAKTU / STATUS LELANG BERAKHIR */}
            {(() => {
              const remainingSec = Math.max(0, Math.floor((selectedDetailItem.endsAt - now) / 1000));
              const isEnded = selectedDetailItem.status === "ended" || remainingSec <= 0;
              if (isEnded) {
                return (
                  <View style={styles.timerCardEnded}>
                    <View style={styles.timerClockRow}>
                      <AppIcon name="flag-checkered" size={17} color="#94A3B8" />
                      <Text style={styles.timerEndedTitle}>Sesi Lelang Telah Berakhir</Text>
                    </View>
                    <Text style={styles.timerEndedSub}>
                      Waktu penawaran untuk item ini telah ditutup.
                    </Text>
                  </View>
                );
              }
              const clockStr = formatSecondsToClock(remainingSec);
              return (
                <View style={styles.timerCard}>
                  <View style={styles.timerClockRow}>
                    <AppIcon name="clock-outline" size={17} color="#EF4444" />
                    <Text style={styles.timerClockText}>{clockStr}</Text>
                  </View>
                  <Text style={styles.timerSubText}>Sisa Waktu</Text>
                </View>
              );
            })()}

            {/* 5. PENAWARAN TERTINGGI CARD */}
            <View style={styles.highestBidCard}>
              <View style={styles.highestBidHeaderRow}>
                <Text style={styles.highestBidLabel}>Penawaran Tertinggi</Text>
                <Text style={styles.userBalanceHeader}>
                  Saldo kamu: <Text style={{ color: "#38BDF8", fontFamily: "Nunito-Bold" }}>{crystalBalance.toLocaleString("id-ID")} Crystal</Text>
                </Text>
              </View>

              <View style={styles.highestBidAmountBox}>
                <View style={styles.highestBidAmountLeft}>
                  <Image source={CRYSTAL_IMG} style={styles.largeCrystalIcon} contentFit="contain" />
                  <Text style={styles.highestBidAmountText}>
                    {selectedDetailItem.currentBid.toLocaleString("id-ID")}
                  </Text>
                </View>
                <Text style={styles.highestBidTimeAgo}>
                  {selectedDetailItem.bidHistory && selectedDetailItem.bidHistory.length > 0
                    ? selectedDetailItem.bidHistory[0].timeAgo
                    : "Belum ada penawar"}
                </Text>
              </View>

              <View style={styles.totalBiddersRow}>
                <Text style={styles.totalBiddersLabel}>Jumlah Penawar</Text>
                <Text style={styles.totalBiddersVal}>{selectedDetailItem.totalBidders || 0}</Text>
              </View>
            </View>

            {/* 6. PRIMARY CTA BUTTON: SESUAI STATUS LELANG & KEPEMILIKAN */}
            {(() => {
              const remainingSec = Math.max(0, Math.floor((selectedDetailItem.endsAt - now) / 1000));
              const isEnded = selectedDetailItem.status === "ended" || remainingSec <= 0;
              const hasAnyBids =
                (selectedDetailItem.bidHistory && selectedDetailItem.bidHistory.length > 0) ||
                ((selectedDetailItem.totalBidders || 0) > 0);
              const isWinner = hasAnyBids && isUserWinner(selectedDetailItem);
              const cleanDetailId = selectedDetailItem.id.replace(/^hasil-/, "").replace(/^rw_/, "");
              const rw = riwayatList.find(
                (r) =>
                  r.itemId === selectedDetailItem.id ||
                  r.itemId === cleanDetailId ||
                  r.id === selectedDetailItem.id ||
                  r.id === cleanDetailId
              );
              const isClaimed = Boolean(
                rw?.isClaimed === true ||
                ownedBorderIds.includes(selectedDetailItem.sourceId || cleanDetailId) ||
                ownedBannerIds.includes(selectedDetailItem.sourceId || cleanDetailId) ||
                ownedItems.some((o) => o.id === cleanDetailId || o.sourceId === selectedDetailItem.sourceId)
              );
              const isOwned = isClaimed || isItemAlreadyOwned(selectedDetailItem);

              // ── KONDISI 1: LELANG SUDAH BERAKHIR ──
              if (isEnded) {
                // Kasus A: User adalah PEMENANG dan BELUM KLAIM (2 Tombol: Lihat Hasil + Klaim Hadiah, tanpa banner hijau)
                if (isWinner && !isClaimed) {
                  return (
                    <View style={styles.detailEndedButtonsRow}>
                      <Pressable
                        onPress={handleOpenHasilLelang}
                        style={({ pressed }) => [styles.detailLihatHasilBtn, pressed && styles.btnPressed]}
                      >
                        <Text style={styles.detailLihatHasilBtnText}>Lihat Hasil Lelang</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          hapticLight();
                          const targetRw = rw || {
                            id: `hasil-${selectedDetailItem.id}`,
                            itemId: selectedDetailItem.id,
                            title: selectedDetailItem.title,
                            type: selectedDetailItem.type,
                            rarity: selectedDetailItem.rarity,
                            status: "menang",
                            price: selectedDetailItem.currentBid,
                            dateFormatted: selectedDetailItem.endTimeFormatted || "Selesai",
                            isClaimed: false,
                            winnerName: userName,
                            totalBidders: selectedDetailItem.totalBidders || 1,
                            item: selectedDetailItem,
                          };
                          setSelectedKlaimItem({
                            ...targetRw,
                            isClaimed,
                          });
                        }}
                        style={({ pressed }) => [styles.detailKlaimHadiahBtn, pressed && styles.btnPressed]}
                      >
                        <Text style={styles.detailKlaimHadiahBtnText}>Klaim Hadiah</Text>
                      </Pressable>
                    </View>
                  );
                }

                // Kasus B: User PEMENANG yang SUDAH KLAIM (Banner hijau + 1 Tombol Lihat Hasil Lelang)
                if (isWinner && isClaimed) {
                  return (
                    <View style={styles.alreadyOwnedContainer}>
                      <View style={styles.alreadyOwnedNoticeCard}>
                        <AppIcon name="check-circle" size={17} color="#10B981" />
                        <Text style={styles.alreadyOwnedNoticeText}>
                          Anda sudah memiliki {selectedDetailItem.type === "banner" ? "banner" : "border"} ini dalam koleksi akun Anda.
                        </Text>
                      </View>
                      <Pressable
                        onPress={handleOpenHasilLelang}
                        style={({ pressed }) => [styles.singleLihatHasilBtn, pressed && styles.btnPressed]}
                      >
                        <Text style={styles.singleLihatHasilBtnText}>Lihat Hasil Lelang</Text>
                      </Pressable>
                    </View>
                  );
                }

                // Kasus C: User BUKAN PEMENANG tapi SUDAH PUNYA ITEM sejak awal
                if (isOwned) {
                  return (
                    <View style={styles.alreadyOwnedContainer}>
                      <View style={styles.alreadyOwnedNoticeCard}>
                        <AppIcon name="check-circle" size={17} color="#10B981" />
                        <Text style={styles.alreadyOwnedNoticeText}>
                          Anda sudah memiliki {selectedDetailItem.type === "banner" ? "banner" : "border"} ini dalam koleksi akun Anda.
                        </Text>
                      </View>
                      <Pressable
                        onPress={handleOpenHasilLelang}
                        style={({ pressed }) => [styles.singleLihatHasilBtn, pressed && styles.btnPressed]}
                      >
                        <Text style={styles.singleLihatHasilBtnText}>Lihat Hasil Lelang</Text>
                      </Pressable>
                    </View>
                  );
                }

                // Kasus D: User BUKAN PEMENANG (kalah lelang, tidak ikut tawar, atau 0 penawar)
                // Hanya 1 tombol: [Lihat Hasil Lelang]
                return (
                  <View style={styles.alreadyOwnedContainer}>
                    <Pressable
                      onPress={handleOpenHasilLelang}
                      style={({ pressed }) => [styles.singleLihatHasilBtn, pressed && styles.btnPressed]}
                    >
                      <Text style={styles.singleLihatHasilBtnText}>Lihat Hasil Lelang</Text>
                    </Pressable>
                  </View>
                );
              }

              // ── KONDISI 2: LELANG MASIH AKTIF ──
              // Kasus D: Sudah punya item ini saat lelang masih aktif
              if (isOwned) {
                return (
                  <View style={styles.alreadyOwnedContainer}>
                    <View style={styles.alreadyOwnedNoticeCard}>
                      <AppIcon name="check-circle" size={17} color="#10B981" />
                      <Text style={styles.alreadyOwnedNoticeText}>
                        Anda sudah memiliki {selectedDetailItem.type === "banner" ? "banner" : "border"} ini dalam koleksi akun Anda.
                      </Text>
                    </View>
                    <View style={styles.ctaBtnDisabledBox}>
                      <AppIcon name="lock-outline" size={16} color="#64748B" />
                      <Text style={styles.ctaBtnDisabledText}>
                        Sudah Dimiliki (Tidak Dapat Mengikuti Lelang)
                      </Text>
                    </View>
                  </View>
                );
              }

              // Kasus E: User adalah penawar tertinggi saat ini (Anti double-bidding)
              if (isUserHighestBidder(selectedDetailItem)) {
                return (
                  <View style={styles.alreadyOwnedContainer}>
                    <View style={styles.leadingBidNoticeCard}>
                      <AppIcon name="crown" size={18} color="#F59E0B" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.leadingBidNoticeTitle}>
                          Tawaranmu Sedang Memimpin!
                        </Text>
                        <Text style={styles.leadingBidNoticeText}>
                          Kamu saat ini memegang penawaran tertinggi ({selectedDetailItem.currentBid.toLocaleString("id-ID")} Crystal). Kamu tidak dapat menawar lagi sampai ada peserta lain yang menaikkan harga lelang.
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        showToast("Tawaranmu sedang memimpin! Tunggu peserta lain menawar.");
                      }}
                      style={({ pressed }) => [styles.ctaBtnLeadingBox, pressed && styles.btnPressed]}
                    >
                      <AppIcon name="check-decagram" size={17} color="#F59E0B" />
                      <Text style={styles.ctaBtnLeadingText}>
                        Tawaran Tertinggi Milikmu
                      </Text>
                    </Pressable>
                  </View>
                );
              }

              // Kasus F: Lelang aktif dan user siap menawar
              return (
                <Pressable
                  onPress={openConfirmModal}
                  style={({ pressed }) => [styles.mainCtaBtn, pressed && styles.btnPressed]}
                >
                  <Text style={styles.mainCtaBtnText}>Ajukan Penawaran</Text>
                </Pressable>
              );
            })()}

            {/* 7. SECTION PENAWARAN TERAKHIR (REAL USER DATA DARI DATABASE) */}
            <View style={styles.bidHistorySection}>
              <View style={styles.bidHistoryHeaderRow}>
                <Text style={styles.bidHistoryTitle}>Penawaran Terakhir</Text>
                {selectedDetailItem.bidHistory && selectedDetailItem.bidHistory.length > 0 && (
                  <Text style={styles.bidHistoryCountText}>
                    {selectedDetailItem.bidHistory.length} Tawaran
                  </Text>
                )}
              </View>

              {/* Daftar Riwayat Tawaran Nyata dari Supabase */}
              {selectedDetailItem.bidHistory && selectedDetailItem.bidHistory.length > 0 ? (
                selectedDetailItem.bidHistory.map((bid) => (
                  <View key={bid.id} style={styles.bidHistoryRow}>
                    <View style={styles.bidHistoryLeft}>
                      <Image source={CRYSTAL_IMG} style={styles.microCrystal} contentFit="contain" />
                      <Text style={styles.bidHistoryAmount}>
                        {bid.amount.toLocaleString("id-ID")}
                      </Text>
                    </View>

                    <View style={styles.bidderBadgeBox}>
                      <View style={styles.bidderAvatarTiny}>
                        <AppIcon name="account" size={10} color="#94A3B8" />
                      </View>
                      <Text style={styles.bidderNameText}>{bid.bidderName}</Text>
                    </View>

                    <Text style={styles.bidTimeAgoText}>{bid.timeAgo}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyBidHistoryCard}>
                  <AppIcon name="gavel" size={24} color="rgba(255, 255, 255, 0.25)" />
                  <Text style={styles.emptyBidHistoryText}>
                    Belum ada penawaran. Jadilah penawar pertama!
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      ) : (
        /* ══════════════════════════════════════════════════════════════
            TAMPILAN UTAMA TAB (BERANDA / LELANG / KOLEKSI / EVENT)
            ══════════════════════════════════════════════════════════════ */
        <>
          {/* ── TOP HEADER (SELALU ADA TOMBOL KEMBALI KE ANIME) ── */}
          <View style={styles.headerBar}>
            <View style={styles.headerLeft}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Kembali"
                onPress={handleBackToAnime}
                style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
                hitSlop={8}
              >
                <AppIcon name="arrow-left" size={18} color="#FFFFFF" />
              </Pressable>

              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle}>
                  {isRiwayatOpen
                    ? "Riwayat Lelang"
                    : activeTab === "home"
                    ? "Lelang Nuenime"
                    : activeTab === "lelang"
                    ? "Ruang Lelang"
                    : activeTab === "koleksi"
                    ? "Koleksi Banner & Border"
                    : activeTab === "event"
                    ? "Event Spesial Nuenime"
                    : "Profil Akun"}
                </Text>
                {!isRiwayatOpen && (
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {activeTab === "home"
                      ? "Dapatkan Banner & Border Eksklusif"
                      : activeTab === "lelang"
                      ? "Temukan item eksklusif dan pasang penawaran terbaik"
                      : activeTab === "koleksi"
                      ? "Item eksklusif yang berhasil kamu menangkan"
                      : activeTab === "event"
                      ? "Klaim Dylan Crystal gratis setiap hari"
                      : "Status akun, border aktif, dan koleksi lelangmu"}
                  </Text>
                )}
              </View>
            </View>

            {/* Right Header Actions */}
            {isRiwayatOpen ? null : (
              <View style={styles.headerRight}>
                {/* Dylan Crystal Balance Pill */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Isi Ulang Dylan Crystal"
                  onPress={() => {
                    hapticLight();
                    router.push("/topup" as never);
                  }}
                  style={({ pressed }) => [styles.crystalPill, pressed && styles.btnPressed]}
                >
                  <Image source={CRYSTAL_IMG} style={styles.crystalIcon} contentFit="contain" />
                  <Text style={styles.crystalText}>
                    {crystalBalance.toLocaleString("id-ID")}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* ── MAIN CONTENT ACCORDING TO ACTIVE TAB ── */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handlePullRefresh}
                tintColor="#EF4444"
                colors={["#EF4444", "#38BDF8"]}
              />
            }
          >
            {/* ══════════════════════════════════════════════════════
                SUB-VIEW: RIWAYAT LELANG (PERSIS GAMBAR 1 DARI USER)
                ══════════════════════════════════════════════════════ */}
            {isRiwayatOpen ? (
              <View style={styles.riwayatContainer}>
                {/* Segment Filter: Diikuti | Dimenangkan | Kalah */}
                <View style={styles.riwayatFilterSegment}>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setRiwayatFilter("diikuti");
                    }}
                    style={[
                      styles.riwayatFilterTab,
                      riwayatFilter === "diikuti" && styles.riwayatFilterTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.riwayatFilterTabText,
                        riwayatFilter === "diikuti" && styles.riwayatFilterTabTextActive,
                      ]}
                    >
                      Diikuti
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setRiwayatFilter("dimenangkan");
                    }}
                    style={[
                      styles.riwayatFilterTab,
                      riwayatFilter === "dimenangkan" && styles.riwayatFilterTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.riwayatFilterTabText,
                        riwayatFilter === "dimenangkan" && styles.riwayatFilterTabTextActive,
                      ]}
                    >
                      Dimenangkan
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setRiwayatFilter("kalah");
                    }}
                    style={[
                      styles.riwayatFilterTab,
                      riwayatFilter === "kalah" && styles.riwayatFilterTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.riwayatFilterTabText,
                        riwayatFilter === "kalah" && styles.riwayatFilterTabTextActive,
                      ]}
                    >
                      Kalah
                    </Text>
                  </Pressable>
                </View>

                {/* Items List */}
                <View style={styles.riwayatListWrap}>
                  {riwayatList
                    .filter((it) => {
                      if (riwayatFilter === "dimenangkan") return it.status === "menang";
                      if (riwayatFilter === "kalah") return it.status === "kalah";
                      return true;
                    })
                    .map((it) => {
                      const isMenang = it.status === "menang";
                      return (
                        <View key={it.id} style={styles.riwayatCard}>
                          {/* Top Section */}
                          <View style={styles.riwayatCardTop}>
                            <LelangItemArt item={it.item} size={58} />
                            <View style={styles.riwayatCardInfoCol}>
                              <View style={styles.riwayatCardTitleRow}>
                                <Text style={styles.riwayatCardTitle} numberOfLines={1}>
                                  {it.title}
                                </Text>
                                <View
                                  style={[
                                    styles.riwayatBadge,
                                    isMenang ? styles.riwayatBadgeMenang : styles.riwayatBadgeKalah,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.riwayatBadgeText,
                                      isMenang ? styles.riwayatBadgeTextMenang : styles.riwayatBadgeTextKalah,
                                    ]}
                                  >
                                    {isMenang ? "Menang" : "Kalah"}
                                  </Text>
                                </View>
                              </View>

                              {/* Price Row */}
                              <View style={styles.riwayatMetaRow}>
                                <Text style={styles.riwayatMetaLabel}>
                                  {isMenang ? "Harga Akhir" : "Penawaran Terakhir"}
                                </Text>
                                <View style={styles.riwayatCrystalRow}>
                                  <Image source={CRYSTAL_IMG} style={styles.microCrystal} contentFit="contain" />
                                  <Text style={styles.riwayatCrystalText}>
                                    {it.price.toLocaleString("id-ID")}
                                  </Text>
                                </View>
                              </View>

                              {/* Date Row */}
                              <View style={styles.riwayatMetaRow}>
                                <Text style={styles.riwayatMetaLabel}>Tanggal</Text>
                                <Text style={styles.riwayatMetaValue}>{it.dateFormatted}</Text>
                              </View>
                            </View>
                          </View>

                          {/* Action Buttons Row */}
                          {isMenang ? (
                            <View style={styles.riwayatActionDualRow}>
                              <Pressable
                                onPress={() => {
                                  hapticLight();
                                  setSelectedDetailItem(it.item);
                                }}
                                style={({ pressed }) => [styles.riwayatDetailBtn, pressed && styles.btnPressed]}
                              >
                                <Text style={styles.riwayatDetailBtnText}>Lihat Detail</Text>
                              </Pressable>

                              <Pressable
                                onPress={() => {
                                  hapticLight();
                                  if (it.isClaimed) {
                                    setActiveTab("koleksi");
                                    setIsRiwayatOpen(false);
                                  } else {
                                    setSelectedKlaimItem(it);
                                  }
                                }}
                                style={({ pressed }) => [styles.riwayatKlaimBtn, pressed && styles.btnPressed]}
                              >
                                <Text style={styles.riwayatKlaimBtnText}>
                                  {it.isClaimed ? "Lihat Hadiah" : "Klaim Hadiah"}
                                </Text>
                              </Pressable>
                            </View>
                          ) : (
                            <Pressable
                              onPress={() => {
                                hapticLight();
                                setSelectedDetailItem(it.item);
                              }}
                              style={({ pressed }) => [styles.riwayatDetailBtnFull, pressed && styles.btnPressed]}
                            >
                              <Text style={styles.riwayatDetailBtnText}>Lihat Detail</Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                </View>
              </View>
            ) : (
              <>
            {/* ══════════════════════════════════════════════════════
                TAB 1: BERANDA LELANG (HOME UI)
                ══════════════════════════════════════════════════════ */}
            {activeTab === "home" && (
              <>
                {/* HERO CARD */}
                <View style={styles.heroCard}>
                  <Image
                    source={LELANG_BANNER_IMG}
                    style={styles.heroBannerImg}
                    contentFit="cover"
                  />
                  <View style={styles.heroOverlay}>
                    <View style={styles.heroBadgeRow}>
                      <View style={styles.heroLiveBadge}>
                        <Text style={styles.heroLiveText}>EVENT LELANG LIVE</Text>
                      </View>
                      <Text style={styles.heroLiveMeta}>
                        {activeLelangCount > 0
                          ? `${activeLelangCount} Item Eksklusif Aktif`
                          : "Sesi Lelang Selesai"}
                      </Text>
                    </View>

                    <Text style={styles.heroTitle}>
                      {activeLelangCount > 0
                        ? `Lelang Nuenime: ${activeLelangItems
                            .slice(0, 2)
                            .map((i) => `${i.type === "banner" ? "Banner" : "Border"} ${i.title}`)
                            .join(" & ")}`
                        : "Lelang Nuenime: Banner & Border Eksklusif"}
                    </Text>
                    <Text style={styles.heroDesc}>
                      Tawar dengan Crystal dan menangkan Banner & Border langka ke koleksi profilmu!
                    </Text>

                    <View style={styles.heroActionRow}>
                      <Pressable
                        onPress={() => {
                          hapticLight();
                          setActiveTab("lelang");
                        }}
                        style={({ pressed }) => [styles.heroPrimaryBtn, pressed && styles.btnPressed]}
                      >
                        <AppIcon name="gavel" size={15} color="#0B0E17" />
                        <Text style={styles.heroPrimaryBtnText}>Masuk Ruang Lelang</Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Informasi Lelang"
                        onPress={() => {
                          hapticLight();
                          setIsInfoLelangOpen(true);
                        }}
                        style={({ pressed }) => [styles.heroSecondaryBtn, pressed && styles.btnPressed]}
                      >
                        <AppIcon name="information-outline" size={14} color="#CBD5E1" />
                        <Text style={styles.heroSecondaryBtnText}>Info Lelang</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* 3 QUICK ACCESS BUTTONS (Lelang, Misi Crystal, Koleksi) */}
                <View style={styles.quickNavRow}>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setActiveTab("lelang");
                    }}
                    style={({ pressed }) => [
                      styles.quickNavCard,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <View style={[styles.quickNavIconBox, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
                      <AppIcon name="gavel" size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.quickNavText}>Lelang</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setActiveTab("event");
                    }}
                    style={({ pressed }) => [styles.quickNavCard, pressed && styles.btnPressed]}
                  >
                    <View style={[styles.quickNavIconBox, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                      <AppIcon name="trophy" size={18} color="#F59E0B" />
                    </View>
                    <Text style={styles.quickNavText}>Misi Crystal</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setActiveTab("koleksi");
                    }}
                    style={({ pressed }) => [styles.quickNavCard, pressed && styles.btnPressed]}
                  >
                    <View style={[styles.quickNavIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                      <AppIcon name="layers" size={18} color="#38BDF8" />
                    </View>
                    <Text style={styles.quickNavText}>Koleksi</Text>
                  </Pressable>
                </View>

                {/* SECTION: LELANG SEDANG BERLANGSUNG */}
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleWithIcon}>
                    <AppIcon name="fire" size={16} color="#CBD5E1" />
                    <Text style={styles.sectionTitle}>Lelang Sedang Berlangsung</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setActiveTab("lelang");
                    }}
                  >
                    <Text style={styles.sectionActionText}>Lihat Semua</Text>
                  </Pressable>
                </View>

                <View style={styles.compactListWrap}>
                  {lelangItems.length === 0 ? (
                    <View style={styles.emptyStateCard}>
                      <AppIcon name="gavel" size={28} color="#64748B" />
                      <Text style={styles.emptyStateTitle}>Belum Ada Lelang Aktif</Text>
                      <Text style={styles.emptyStateDesc}>
                        Item lelang baru dari server database akan segera dimulai.
                      </Text>
                    </View>
                  ) : (
                    lelangItems.slice(0, 2).map((item) => {
                    const remainingSec = Math.max(0, Math.floor((item.endsAt - now) / 1000));
                    const clockStr = formatSecondsToClock(remainingSec);
                    const isOwned = isItemAlreadyOwned(item);
                    const isEnded = item.status === "ended" || remainingSec <= 0;

                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => openItemDetail(item)}
                        style={({ pressed }) => [styles.compactAuctionCard, pressed && styles.btnPressed]}
                      >
                        <LelangItemArt item={item} size={58} />
                        <View style={styles.compactMetaCol}>
                          <Text style={styles.compactTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <View style={styles.compactPriceRow}>
                            <Image source={CRYSTAL_IMG} style={styles.microCrystal} contentFit="contain" />
                            <Text style={styles.compactPriceVal}>
                              {item.currentBid.toLocaleString("id-ID")} Crystal
                            </Text>
                          </View>
                          <Text style={styles.compactTimerText}>
                            {isEnded ? "Status: Selesai" : `Sisa: ${clockStr}`}
                          </Text>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          {isEnded ? (
                            isUserWinner(item) && !isOwned ? (
                              <View style={styles.compactLeadingBadge}>
                                <AppIcon name="crown" size={11} color="#F59E0B" />
                                <Text style={styles.compactLeadingBadgeText}>Pemenang</Text>
                              </View>
                            ) : isOwned ? (
                              <View style={styles.compactOwnedBadge}>
                                <AppIcon name="check" size={11} color="#10B981" />
                                <Text style={styles.compactOwnedBadgeText}>Dimiliki</Text>
                              </View>
                            ) : (
                              <View style={styles.compactEndedBadge}>
                                <Text style={styles.compactEndedBadgeText}>Selesai</Text>
                              </View>
                            )
                          ) : isOwned ? (
                            <View style={styles.compactOwnedBadge}>
                              <AppIcon name="check" size={11} color="#10B981" />
                              <Text style={styles.compactOwnedBadgeText}>Dimiliki</Text>
                            </View>
                          ) : isUserHighestBidder(item) ? (
                            <View style={styles.compactLeadingBadge}>
                              <AppIcon name="crown" size={11} color="#F59E0B" />
                              <Text style={styles.compactLeadingBadgeText}>Memimpin</Text>
                            </View>
                          ) : (
                            <Pressable
                              onPress={() => openItemDetail(item)}
                              style={({ pressed }) => [styles.compactBidBtn, pressed && styles.btnPressed]}
                            >
                              <Text style={styles.compactBidBtnText}>Tawar</Text>
                            </Pressable>
                          )}
                        </View>
                      </Pressable>
                    );
                  }))}
                </View>
              </>
            )}

            {/* ══════════════════════════════════════════════════════
                TAB 2: LELANG (FOKUS LELANG AJA)
                ══════════════════════════════════════════════════════ */}
            {activeTab === "lelang" && (
              <>
                {/* Filter Category Pills */}
                <View style={styles.filterRow}>
                  {(
                    [
                      { id: "semua", label: "Semua" },
                      { id: "banner", label: "Banner" },
                      { id: "border", label: "Border" },
                      { id: "segera", label: "Segera Berakhir" },
                    ] as const
                  ).map((f) => {
                    const isSelected = filterCategory === f.id;
                    return (
                      <Pressable
                        key={f.id}
                        onPress={() => {
                          hapticLight();
                          setFilterCategory(f.id);
                        }}
                        style={[
                          styles.filterPill,
                          isSelected && styles.filterPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterPillText,
                            isSelected && styles.filterPillTextActive,
                          ]}
                        >
                          {f.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* List Item Lelang (Klik langsung membuka Halaman Detail Gambar 1 & 2) */}
                {filteredLelangItems.length === 0 ? (
                  <View style={styles.emptyStateCard}>
                    <AppIcon name="gavel" size={32} color="#64748B" />
                    <Text style={styles.emptyStateTitle}>Tidak Ada Item Lelang</Text>
                    <Text style={styles.emptyStateDesc}>
                      Saat ini belum ada item lelang aktif dari server database.
                    </Text>
                  </View>
                ) : (
                  filteredLelangItems.map((item, index) => {
                  const remainingSec = Math.max(0, Math.floor((item.endsAt - now) / 1000));
                  const clockStr = formatSecondsToClock(remainingSec);
                  const isEnded = item.status === "ended" || remainingSec <= 0;
                  const isScheduled = !isEnded && index === 0 && remainingSec > 3600 * 8;

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => openItemDetail(item)}
                      style={({ pressed }) => [styles.auctionCard, pressed && styles.btnPressed]}
                    >
                      <View style={styles.cardMainRow}>
                        {/* Item Art Thumbnail */}
                        <LelangItemArt item={item} size={74} />

                        {/* Meta Info */}
                        <View style={styles.cardMetaCol}>
                          <View style={styles.cardTagRow}>
                            <View style={styles.typeBadge}>
                              <AppIcon
                                name={item.type === "banner" ? "image-outline" : "crop-free"}
                                size={10}
                                color="#94A3B8"
                              />
                              <Text style={styles.typeBadgeText}>
                                {item.type === "banner" ? "Banner" : "Border"}
                              </Text>
                            </View>
                            <AppIcon name="chevron-right" size={14} color="#64748B" />
                          </View>

                          <Text style={styles.cardTitle}>{item.title}</Text>

                          {/* Detail Harga Table */}
                          <View style={styles.priceDetailsTable}>
                            <View style={styles.priceTableRow}>
                              <Text style={styles.priceTableLabel}>Harga Awal</Text>
                              <View style={styles.priceCrystalRow}>
                                <Image source={CRYSTAL_IMG} style={styles.microCrystal} contentFit="contain" />
                                <Text style={styles.priceTableVal}>
                                  {item.startPrice.toLocaleString("id-ID")}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.priceTableRow}>
                              <Text style={styles.priceTableLabel}>Tertinggi</Text>
                              <View style={styles.priceCrystalRow}>
                                <Image source={CRYSTAL_IMG} style={styles.microCrystal} contentFit="contain" />
                                <Text style={[styles.priceTableVal, { color: "#38BDF8", fontFamily: "Nunito-Bold" }]}>
                                  {item.currentBid.toLocaleString("id-ID")}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.priceTableRow}>
                              <Text style={styles.priceTableLabel}>Penawar</Text>
                              <Text style={styles.priceTableVal}>{item.totalBidders}</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Card Footer: Timer & Status Pill */}
                      <View style={styles.cardFooterRow}>
                        <View style={styles.clockWrap}>
                          <AppIcon
                            name={isEnded ? "flag-checkered" : "clock-outline"}
                            size={13}
                            color={isEnded ? "#64748B" : "#94A3B8"}
                          />
                          <Text style={[styles.clockText, isEnded && { color: "#64748B" }]}>
                            {isEnded ? "Berakhir" : clockStr}
                          </Text>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          {(() => {
                            const cleanItemId = item.id.replace(/^hasil-/, "");
                            const rw = riwayatList.find(
                              (r) => r.itemId === item.id || r.itemId === cleanItemId || r.id === item.id
                            );
                            const isClaimed = Boolean(
                              rw?.isClaimed === true ||
                              ownedBorderIds.includes(item.sourceId || cleanItemId) ||
                              ownedBannerIds.includes(item.sourceId || cleanItemId) ||
                              ownedItems.some((o) => o.id === cleanItemId || o.sourceId === item.sourceId)
                            );
                            const hasAnyBids =
                              (item.bidHistory && item.bidHistory.length > 0) ||
                              ((item.totalBidders || 0) > 0);
                            const isWinner = hasAnyBids && isUserWinner(item);

                            if (isEnded) {
                              if (isWinner) {
                                if (isClaimed) {
                                  return (
                                    <View style={styles.statusPillOwned}>
                                      <AppIcon name="check" size={11} color="#10B981" />
                                      <Text style={styles.statusPillTextOwned}>Sudah Dimiliki</Text>
                                    </View>
                                  );
                                }
                                return (
                                  <View style={styles.statusPillWinner}>
                                    <AppIcon name="crown" size={11} color="#F59E0B" />
                                    <Text style={styles.statusPillTextWinner}>Pemenang Lelang</Text>
                                  </View>
                                );
                              }
                              if (isItemAlreadyOwned(item)) {
                                return (
                                  <View style={styles.statusPillOwned}>
                                    <AppIcon name="check" size={11} color="#10B981" />
                                    <Text style={styles.statusPillTextOwned}>Sudah Dimiliki</Text>
                                  </View>
                                );
                              }
                              return null;
                            }

                            if (isItemAlreadyOwned(item)) {
                              return (
                                <View style={styles.statusPillOwned}>
                                  <AppIcon name="check" size={11} color="#10B981" />
                                  <Text style={styles.statusPillTextOwned}>Sudah Dimiliki</Text>
                                </View>
                              );
                            }

                            return null;
                          })()}
                          {isEnded ? (
                            <View style={styles.statusPillEnded}>
                              <Text style={styles.statusPillTextEnded}>Selesai</Text>
                            </View>
                          ) : isUserHighestBidder(item) ? (
                            <View style={styles.statusPillLeading}>
                              <AppIcon name="crown" size={11} color="#F59E0B" />
                              <Text style={styles.statusPillTextLeading}>Memimpin</Text>
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.statusPill,
                                isScheduled ? styles.statusPillScheduled : styles.statusPillActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusPillText,
                                  isScheduled ? styles.statusPillTextScheduled : styles.statusPillTextActive,
                                ]}
                              >
                                {isScheduled ? "Terjadwal" : "Aktif"}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  );
                }))}
              </>
            )}

            {/* ══════════════════════════════════════════════════════
                TAB 3: KOLEKSI BANNER & BORDER
                ══════════════════════════════════════════════════════ */}
            {activeTab === "koleksi" && (
              <View style={styles.tabContentBlock}>
                <View style={styles.koleksiIntroCard}>
                  <Text style={styles.koleksiIntroDesc}>
                    Hadiah Banner dan Border yang dimenangkan dari Lelang Nuenime otomatis tersimpan di koleksi akun kamu dan dapat langsung dipasang ke profil.
                  </Text>
                </View>

                {ownedItems.length === 0 ? (
                  <View style={styles.emptyStateCard}>
                    <AppIcon name="gavel" size={32} color="#64748B" />
                    <Text style={styles.emptyStateTitle}>Belum Ada Koleksi Lelang</Text>
                    <Text style={styles.emptyStateDesc}>
                      Ikuti lelang aktif dan menangkan Banner atau Border eksklusif pertama kamu!
                    </Text>
                    <Pressable
                      onPress={() => setActiveTab("lelang")}
                      style={styles.emptyStateBtn}
                    >
                      <Text style={styles.emptyStateBtnText}>Buka Ruang Lelang</Text>
                    </Pressable>
                  </View>
                ) : (
                  ownedItems.map((item) => {
                    const isEquipped = Boolean(equippedMap[item.id]);

                    return (
                      <View key={item.id} style={styles.ownedCard}>
                        <LelangItemArt item={item} size={66} />

                        <View style={styles.ownedMetaCol}>
                          <View style={styles.ownedTagRow}>
                            <View style={styles.typeBadge}>
                              <Text style={styles.typeBadgeText}>
                                {item.type === "banner" ? "Banner" : "Border"}
                              </Text>
                            </View>
                            <View style={styles.ownedStatusPill}>
                              <Text style={styles.ownedStatusPillText}>• Milikmu</Text>
                            </View>
                          </View>

                          <Text style={styles.ownedTitle}>{item.title}</Text>
                          <Text style={styles.ownedSource}>
                            Diperoleh dari Lelang Nuenime
                          </Text>
                        </View>

                        <Pressable
                          onPress={() => handleEquip(item)}
                          style={[
                            styles.equipBtn,
                            isEquipped && styles.equipBtnActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.equipBtnText,
                              isEquipped && styles.equipBtnTextActive,
                            ]}
                          >
                            {isEquipped ? "Terpasang" : "Pasang"}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* ══════════════════════════════════════════════════════
                TAB 4: EVENT SPESIAL & MISI CRYSTAL
                ══════════════════════════════════════════════════════ */}
            {activeTab === "event" && (
              <View style={styles.tabContentBlock}>
                {/* Festival Card */}
                <View style={styles.eventSpecialCard}>
                  <View style={styles.eventSpecialHeader}>
                    <View style={styles.eventSpecialBadge}>
                      <Text style={styles.eventSpecialBadgeText}>EVENT UTAMA</Text>
                    </View>
                    <Text style={styles.eventSpecialActiveStatus}>
                      Sedang Berlangsung
                    </Text>
                  </View>

                  <Text style={styles.eventSpecialTitle}>
                    {activeLelangCount > 0
                      ? `Festival Lelang Nuenime — ${activeLelangItems
                          .slice(0, 2)
                          .map((i) => i.title)
                          .join(" & ")}`
                      : "Festival Lelang Nuenime"}
                  </Text>
                  <Text style={styles.eventSpecialDesc}>
                    {activeLelangCount > 0
                      ? `Ikuti sesi lelang eksklusif untuk ${activeLelangItems
                          .slice(0, 3)
                          .map((i) => `${i.type === "banner" ? "Banner" : "Border"} ${i.title}`)
                          .join(", ")} dengan sistem reservasi Crystal yang aman.`
                      : "Kumpulkan Dylan Crystal gratis setiap hari melalui misi dan nantikan sesi penawaran item eksklusif berikutnya."}
                  </Text>

                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setActiveTab("lelang");
                    }}
                    style={styles.eventSpecialActionBtn}
                  >
                    <Text style={styles.eventSpecialActionBtnText}>
                      Buka Halaman Utama Lelang
                    </Text>
                  </Pressable>
                </View>

                {/* Misi Harian Header: Anti-Tabrakan & Responsif */}
                <View style={styles.missionHeaderContainer}>
                  <View style={styles.missionHeaderTopRow}>
                    <View style={styles.missionHeaderTitleWrap}>
                      <AppIcon name="trophy" size={17} color="#F59E0B" />
                      <Text style={styles.missionHeaderTitle} numberOfLines={1}>
                        Event Misi Harian Berhadiah
                      </Text>
                    </View>
                    <View style={styles.dailyRewardPillBadge}>
                      <Image
                        source={CRYSTAL_IMG}
                        style={styles.microCrystal}
                        contentFit="contain"
                      />
                      <Text style={styles.dailyRewardPillText}>+900 Crystal/Hari</Text>
                    </View>
                  </View>
                  <Text style={styles.missionIntroSub}>
                    Kumpulkan Crystal gratis setiap hari untuk menawar item impianmu di Lelang Nuenime. Misi di-reset otomatis setiap pukul 00:00 WIB (1 hari 1 kali klaim).
                  </Text>
                </View>

                {/* Mission List */}
                {missions.map((m) => {
                  const isClaimed = m.claimed;
                  const isReady = m.progress >= m.maxProgress && !isClaimed;

                  return (
                    <View key={m.id} style={styles.missionCard}>
                      <View style={styles.missionIconWrap}>
                        <AppIcon name={m.icon} size={20} color="#E2E8F0" />
                      </View>

                      <View style={styles.missionInfoCol}>
                        <View style={styles.missionTitleRow}>
                          <Text style={styles.missionTitle} numberOfLines={1}>
                            {m.title}
                          </Text>
                          <View style={styles.missionRewardBadge}>
                            <Image
                              source={CRYSTAL_IMG}
                              style={styles.microCrystal}
                              contentFit="contain"
                            />
                            <Text style={styles.missionRewardText}>
                              +{m.rewardCrystal}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.missionDesc}>{m.desc}</Text>
                        <View style={styles.missionStatusIndicatorRow}>
                          {isClaimed ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <AppIcon name="check" size={11} color="#10B981" />
                              <Text style={[styles.missionProgressText, styles.missionProgressTextClaimed]}>
                                Sudah diklaim hari ini
                              </Text>
                            </View>
                          ) : (
                            <Text
                              style={[
                                styles.missionProgressText,
                                isReady && styles.missionProgressTextReady,
                              ]}
                            >
                              {isReady ? "Siap diklaim!" : `${m.progress}/${m.maxProgress} Selesai`}
                            </Text>
                          )}
                        </View>
                      </View>

                      {isClaimed ? (
                        <View style={styles.claimBtnClaimed}>
                          <AppIcon name="check" size={12} color="#10B981" />
                          <Text style={styles.claimBtnTextClaimed}>Selesai</Text>
                        </View>
                      ) : isReady ? (
                        <Pressable
                          disabled={claimingMissionId === m.id}
                          onPress={() => handleClaimMission(m.id)}
                          style={({ pressed }) => [
                            styles.claimBtn,
                            styles.claimBtnReady,
                            pressed && styles.btnPressed,
                          ]}
                        >
                          {claimingMissionId === m.id ? (
                            <ActivityIndicator size="small" color="#0B0E17" />
                          ) : (
                            <Text style={styles.claimBtnTextReady}>Klaim</Text>
                          )}
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => handleMissionAction(m)}
                          style={({ pressed }) => [
                            styles.claimBtn,
                            styles.claimBtnAction,
                            pressed && styles.btnPressed,
                          ]}
                        >
                          <Text style={styles.claimBtnTextAction}>
                            {m.actionText || "Mulai"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* ══════════════════════════════════════════════════════
                TAB 5: PROFIL & PENGATURAN LELANG
                ══════════════════════════════════════════════════════ */}
            {activeTab === "profile" && (
              <View style={styles.profileTabContent}>
                {/* 1. Profil User Card (Horizontal: Avatar di Kiri, Nama & Level di Kanan) */}
                <View style={styles.profileHeaderCard}>
                  <View style={styles.profileUserRow}>
                    {/* Avatar di Kiri dengan Border Terpasang */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Buka Dekorasi Avatar"
                      onPress={() => {
                        hapticLight();
                        router.push("/avatar-decorations" as never);
                      }}
                      style={styles.profileAvatarPressable}
                    >
                      <BorderAvatar
                        avatarUrl={auth.profile?.avatar_url}
                        fallbackText={initialLetter}
                        borderId={equippedBorderId}
                        avatarSize={58}
                      />
                    </Pressable>

                    {/* Informasi Pengguna di Kanan Avatar */}
                    <View style={styles.profileUserMetaCol}>
                      {/* Baris 1: Nama Pengguna + Centang Badge Sesuai Role */}
                      <View style={styles.profileNameRowHorizontal}>
                        <Text style={styles.profileDisplayNameHorizontal} numberOfLines={1}>
                          {userName}
                        </Text>
                        <UserVerificationBadge
                          role={auth.profile?.role}
                          isVip={auth.profile?.is_vip}
                          size={16}
                        />
                      </View>

                      {/* Baris 2: Pill Level + Icon Tier + Role Badge */}
                      <View style={styles.profileMetaBadgeRow}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Level ${userLevel}`}
                          onPress={() => {
                            hapticLight();
                            setShowLevelModal(true);
                          }}
                          style={({ pressed }) => [
                            styles.profileLevelPill,
                            pressed && styles.btnPressed,
                          ]}
                        >
                          {activeTier?.imageUrl ? (
                            <Image
                              source={{ uri: activeTier.imageUrl }}
                              style={styles.profileTierIcon}
                              contentFit="contain"
                            />
                          ) : (
                            <AppIcon name="shield-star" size={12} color="#38BDF8" />
                          )}
                          <Text
                            style={[
                              styles.profileLevelPillText,
                              tierInfo.isInfinity && { color: "#EF4444", fontFamily: "Nunito-Black" },
                            ]}
                          >
                            {tierInfo.isInfinity ? "∞" : `Lv. ${userLevel}`}
                          </Text>
                        </Pressable>

                        {isSpecial ? (
                          <View style={styles.profileSpecialRoleBadge}>
                            <AppIcon name="shield-check" size={11} color="#EF4444" />
                            <Text style={styles.profileSpecialRoleText}>{userRole}</Text>
                          </View>
                        ) : (
                          <View style={styles.profileMemberRoleBadge}>
                            <Text style={styles.profileMemberRoleText}>
                              {auth.profile?.is_vip ? "VIP Member" : "Member"}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Baris 3: Username Tag */}
                      <Text style={styles.profileUserTag} numberOfLines={1}>
                        @{auth.profile?.username || auth.user?.email?.split("@")[0] || "member"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 4. Section: Menu Lainnya */}
                <View style={styles.profileMenuSection}>
                  <Text style={styles.profileMenuSectionTitle}>Menu Lainnya</Text>

                  <View style={styles.profileMenuList}>
                    {/* Misi Harian */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Buka Misi Harian"
                      onPress={() => {
                        hapticLight();
                        setActiveTab("event");
                      }}
                      style={({ pressed }) => [styles.profileMenuItem, pressed && styles.btnPressed]}
                    >
                      <View style={styles.profileMenuLeft}>
                        <View style={styles.profileMenuIconBox}>
                          <AppIcon name="trophy-award" size={17} color="#94A3B8" />
                        </View>
                        <Text style={styles.profileMenuLabel}>Misi Harian</Text>
                      </View>
                      <AppIcon name="chevron-right" size={18} color="#64748B" />
                    </Pressable>

                    {/* Level & EXP */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Lihat Detail Level & EXP"
                      onPress={() => {
                        hapticLight();
                        setShowLevelModal(true);
                      }}
                      style={({ pressed }) => [styles.profileMenuItem, pressed && styles.btnPressed]}
                    >
                      <View style={styles.profileMenuLeft}>
                        <View style={styles.profileMenuIconBox}>
                          <AppIcon name="shield-outline" size={17} color="#94A3B8" />
                        </View>
                        <View style={{ gap: 2 }}>
                          <Text style={styles.profileMenuLabel}>Level & EXP</Text>
                          <Text style={styles.profileLevelSubtitle}>
                            Lv. {userLevel} • {activeTier?.name || "Member"} • {levelInfo.progressPercent}% Menuju Lv. {userLevel + 1}
                          </Text>
                        </View>
                      </View>
                      <AppIcon name="chevron-right" size={18} color="#64748B" />
                    </Pressable>

                    {/* Crystal */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Isi Ulang Crystal"
                      onPress={() => {
                        hapticLight();
                        router.push("/topup" as never);
                      }}
                      style={({ pressed }) => [styles.profileMenuItem, pressed && styles.btnPressed]}
                    >
                      <View style={styles.profileMenuLeft}>
                        <View style={styles.profileMenuIconBox}>
                          <Image source={CRYSTAL_IMG} style={{ width: 18, height: 18 }} contentFit="contain" />
                        </View>
                        <View style={{ gap: 2 }}>
                          <Text style={styles.profileMenuLabel}>Crystal</Text>
                          <Text style={styles.profileCrystalSubtitle}>
                            Tersedia: {crystalBalance.toLocaleString("id-ID")} Crystal
                          </Text>
                        </View>
                      </View>
                      <AppIcon name="chevron-right" size={18} color="#64748B" />
                    </Pressable>

                    {/* Riwayat */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Buka Riwayat Lelang"
                      onPress={() => {
                        hapticLight();
                        setIsRiwayatOpen(true);
                      }}
                      style={({ pressed }) => [styles.profileMenuItem, pressed && styles.btnPressed]}
                    >
                      <View style={styles.profileMenuLeft}>
                        <View style={styles.profileMenuIconBox}>
                          <AppIcon name="history" size={17} color="#94A3B8" />
                        </View>
                        <Text style={styles.profileMenuLabel}>Riwayat</Text>
                      </View>
                      <AppIcon name="chevron-right" size={18} color="#64748B" />
                    </Pressable>

                    {/* Bantuan */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Pusat Bantuan & Panduan Lelang"
                      onPress={() => {
                        hapticLight();
                        setIsInfoLelangOpen(true);
                      }}
                      style={({ pressed }) => [styles.profileMenuItem, pressed && styles.btnPressed]}
                    >
                      <View style={styles.profileMenuLeft}>
                        <View style={styles.profileMenuIconBox}>
                          <AppIcon name="help-circle-outline" size={17} color="#94A3B8" />
                        </View>
                        <Text style={styles.profileMenuLabel}>Bantuan & Panduan</Text>
                      </View>
                      <AppIcon name="chevron-right" size={18} color="#64748B" />
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
            </>
            )}
          </ScrollView>

          {/* ── BOTTOM NAVIGATION TABS (5 ITEMS) ── */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(12, insets.bottom) }]}>
            {/* 1. Beranda */}
            <Pressable
              onPress={() => {
                hapticLight();
                setIsRiwayatOpen(false);
                setActiveTab("home");
              }}
              style={styles.bottomTabItem}
            >
              <AppIcon
                name="home"
                size={20}
                color={activeTab === "home" && !isRiwayatOpen ? "#EF4444" : "#64748B"}
              />
              <Text
                style={[
                  styles.bottomTabLabel,
                  activeTab === "home" && !isRiwayatOpen && styles.bottomTabLabelActiveRed,
                ]}
              >
                Beranda
              </Text>
            </Pressable>

            {/* 2. Lelang */}
            <Pressable
              onPress={() => {
                hapticLight();
                setIsRiwayatOpen(false);
                setActiveTab("lelang");
              }}
              style={styles.bottomTabItem}
            >
              <AppIcon
                name="gavel"
                size={20}
                color={activeTab === "lelang" && !isRiwayatOpen ? "#EF4444" : "#64748B"}
              />
              <Text
                style={[
                  styles.bottomTabLabel,
                  activeTab === "lelang" && !isRiwayatOpen && styles.bottomTabLabelActiveRed,
                ]}
              >
                Lelang
              </Text>
            </Pressable>

            {/* 3. Koleksi */}
            <Pressable
              onPress={() => {
                hapticLight();
                setIsRiwayatOpen(false);
                setActiveTab("koleksi");
              }}
              style={styles.bottomTabItem}
            >
              <AppIcon
                name="layers"
                size={20}
                color={activeTab === "koleksi" && !isRiwayatOpen ? "#EF4444" : "#64748B"}
              />
              <Text
                style={[
                  styles.bottomTabLabel,
                  activeTab === "koleksi" && !isRiwayatOpen && styles.bottomTabLabelActiveRed,
                ]}
              >
                Koleksi
              </Text>
            </Pressable>

            {/* 4. Event */}
            <Pressable
              onPress={() => {
                hapticLight();
                setIsRiwayatOpen(false);
                setActiveTab("event");
              }}
              style={styles.bottomTabItem}
            >
              <AppIcon
                name="star"
                size={20}
                color={activeTab === "event" && !isRiwayatOpen ? "#EF4444" : "#64748B"}
              />
              <Text
                style={[
                  styles.bottomTabLabel,
                  activeTab === "event" && !isRiwayatOpen && styles.bottomTabLabelActiveRed,
                ]}
              >
                Event
              </Text>
            </Pressable>

            {/* 5. Profil */}
            <Pressable
              onPress={() => {
                hapticLight();
                setIsRiwayatOpen(false);
                setActiveTab("profile");
              }}
              style={styles.bottomTabItem}
            >
              <AppIcon
                name="account"
                size={20}
                color={activeTab === "profile" || isRiwayatOpen ? "#EF4444" : "#64748B"}
              />
              <Text
                style={[
                  styles.bottomTabLabel,
                  (activeTab === "profile" || isRiwayatOpen) && styles.bottomTabLabelActiveRed,
                ]}
              >
                Profil
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ── FLOATING TOAST NOTIFICATION ── */}
      {toastMessage && (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toastCard}>
            <AppIcon name="check" size={14} color="#10B981" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL KONFIRMASI PENAWARAN (PERSIS GAMBAR 3 DARI USER)
          ══════════════════════════════════════════════════════════════ */}
      <Modal
        visible={isConfirmModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (!submittingBid) setIsConfirmModalOpen(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCardLarge}>
            {selectedDetailItem && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitleLarge}>Konfirmasi Penawaran</Text>
                  <Pressable
                    disabled={submittingBid}
                    onPress={() => setIsConfirmModalOpen(false)}
                    style={styles.modalCloseBtn}
                  >
                    <AppIcon name="close" size={18} color="#94A3B8" />
                  </Pressable>
                </View>

                {/* 1. Item Row Preview */}
                <View style={styles.modalItemRowPreview}>
                  <LelangItemArt item={selectedDetailItem} size={50} />
                  <View style={styles.modalItemMetaCol}>
                    <Text style={styles.modalItemTitleText}>{selectedDetailItem.title}</Text>
                    <View style={styles.modalItemTag}>
                      <AppIcon
                        name={selectedDetailItem.type === "banner" ? "image-outline" : "crop-free"}
                        size={10}
                        color="#60A5FA"
                      />
                      <Text style={styles.modalItemTagText}>
                        {selectedDetailItem.type === "banner" ? "Banner" : "Border"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 2. Form Input Card: Penawaran Kamu */}
                <View style={styles.modalInputBlockCard}>
                  <View style={styles.modalInputTopRow}>
                    <Text style={styles.modalInputTopLabel}>Penawaran Kamu</Text>
                    <View style={styles.modalQuickChipsRow}>
                      <Pressable
                        onPress={() => {
                          hapticLight();
                          const minAmount = selectedDetailItem.currentBid + (selectedDetailItem.minIncrement || 100);
                          setBidAmountInput(String(minAmount));
                        }}
                        style={styles.chipPill}
                      >
                        <Text style={styles.chipPillText}>
                          Min ({selectedDetailItem.currentBid + (selectedDetailItem.minIncrement || 100)})
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          hapticLight();
                          const cur = parseInt(bidAmountInput.replace(/\D/g, ""), 10) || selectedDetailItem.currentBid;
                          setBidAmountInput(String(cur + 100));
                        }}
                        style={styles.chipPill}
                      >
                        <Text style={styles.chipPillText}>+100</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.modalTextInputBox}>
                    <Text style={styles.modalInputPlaceholder}>Masukkan Nominal</Text>
                    <View style={styles.modalInputNumericRow}>
                      <Image source={CRYSTAL_IMG} style={styles.microCrystal} contentFit="contain" />
                      <TextInput
                        style={styles.modalNumericInput}
                        keyboardType="number-pad"
                        value={bidAmountInput}
                        onChangeText={setBidAmountInput}
                        placeholderTextColor="#64748B"
                      />
                    </View>
                  </View>

                  <View style={styles.modalInputMetaRows}>
                    <View style={styles.modalMetaRowItem}>
                      <Text style={styles.modalMetaLabel}>Harga Tertinggi Saat Ini</Text>
                      <View style={styles.specValueRow}>
                        <Image source={CRYSTAL_IMG} style={styles.microCrystal} contentFit="contain" />
                        <Text style={styles.modalMetaVal}>
                          {selectedDetailItem.currentBid.toLocaleString("id-ID")}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.modalMetaRowItem}>
                      <Text style={styles.modalMetaLabel}>Kenaikan Minimum</Text>
                      <View style={styles.specValueRow}>
                        <Image source={CRYSTAL_IMG} style={styles.microCrystal} contentFit="contain" />
                        <Text style={styles.modalMetaVal}>
                          {(selectedDetailItem.minIncrement || 100).toLocaleString("id-ID")}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 3. Orange / Yellow Warning Banner */}
                {isUserHighestBidder(selectedDetailItem) ? (
                  <View
                    style={[
                      styles.modalWarningBanner,
                      {
                        borderColor: "rgba(245, 158, 11, 0.45)",
                        backgroundColor: "rgba(245, 158, 11, 0.14)",
                      },
                    ]}
                  >
                    <View style={styles.warningCircleIcon}>
                      <AppIcon name="alert-circle-outline" size={15} color="#F59E0B" />
                    </View>
                    <Text style={[styles.warningBannerText, { color: "#FBBF24" }]}>
                      Kamu saat ini sudah memegang penawaran tertinggi! Tunggu peserta lain menaikkan tawaran lelang.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.modalWarningBanner}>
                    <View style={styles.warningCircleIcon}>
                      <AppIcon name="arrow-down-circle" size={15} color="#F59E0B" />
                    </View>
                    <Text style={styles.warningBannerText}>
                      Penawaran harus lebih tinggi dari harga tertinggi saat ini.
                    </Text>
                  </View>
                )}

                {/* 4. Crystal yang Akan Direservasi Box */}
                {(() => {
                  const inputVal = parseInt(bidAmountInput.replace(/\D/g, ""), 10) || 0;
                  const sisa = Math.max(0, crystalBalance - inputVal);
                  return (
                    <View style={styles.reservationBox}>
                      <Text style={styles.reservationTitle}>Crystal yang akan direservasi</Text>
                      <View style={styles.reservationMainRow}>
                        <View style={styles.reservationAmountWrap}>
                          <Image source={CRYSTAL_IMG} style={styles.midCrystalIcon} contentFit="contain" />
                          <Text style={styles.reservationAmountText}>
                            {inputVal.toLocaleString("id-ID")}
                          </Text>
                        </View>
                        <Text style={styles.reservationSisaText}>Sisa: {sisa}</Text>
                      </View>

                      <View style={styles.reservationSubRow}>
                        <Text style={styles.reservationSubLabel}>Saldo Crystal Tersedia</Text>
                        <Text style={styles.reservationSubVal}>
                          {crystalBalance.toLocaleString("id-ID")}
                        </Text>
                      </View>

                      <View style={styles.reservationSubRow}>
                        <Text style={styles.reservationSubLabel}>Crystal Tereservasi</Text>
                        <Text style={styles.reservationSubVal}>
                          {inputVal.toLocaleString("id-ID")}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                {/* 5. Checkbox Persetujuan */}
                <Pressable
                  onPress={() => setAgreementChecked((prev) => !prev)}
                  style={styles.agreementRow}
                >
                  <View style={[styles.customCheckbox, agreementChecked && styles.customCheckboxChecked]}>
                    {agreementChecked && <AppIcon name="check" size={13} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.agreementText}>
                    Saya telah membaca dan menyetujui{" "}
                    <Text style={styles.agreementLinkText}>ketentuan lelang.</Text>
                  </Text>
                </Pressable>

                {/* 6. Action Buttons: Batal & Konfirmasi */}
                <View style={styles.modalButtonsRow}>
                  <Pressable
                    disabled={submittingBid}
                    onPress={() => setIsConfirmModalOpen(false)}
                    style={({ pressed }) => [styles.modalBatalBtn, pressed && styles.btnPressed]}
                  >
                    <Text style={styles.modalBatalBtnText}>Batal</Text>
                  </Pressable>

                  <Pressable
                    disabled={submittingBid || isUserHighestBidder(selectedDetailItem)}
                    onPress={handleConfirmBid}
                    style={({ pressed }) => [
                      styles.modalKonfirmasiBtn,
                      (submittingBid || isUserHighestBidder(selectedDetailItem)) && styles.btnDisabled,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    {submittingBid ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalKonfirmasiBtnText}>Konfirmasi</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── MODAL LEVEL PROGRESS (SINKRON DENGAN EXP & LEVEL SISTEM) ── */}
      <LevelProgressModal
        visible={showLevelModal}
        onClose={() => setShowLevelModal(false)}
        userLevel={userLevel}
        totalXP={userExp}
        role={auth.profile?.role}
      />
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
  btnDisabled: {
    opacity: 0.5,
  },

  /* ── TOP HEADER (LIQUID GLASS) ── */
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(11, 14, 23, 0.95)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16.5,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  crystalPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
  },
  crystalIcon: {
    width: 14,
    height: 14,
  },
  crystalText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  bellBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    color: "#FFFFFF",
  },

  /* ── TOAST NOTIFICATION ── */
  toastWrap: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    zIndex: 999,
    alignItems: "center",
  },
  toastCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#161B26",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  toastText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#E2E8F0",
  },

  /* ── SCROLL CONTENT (MAIN TABS) ── */
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  /* ── HERO BANNER CARD ── */
  heroCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    overflow: "hidden",
    marginBottom: 16,
  },
  heroBannerImg: {
    width: "100%",
    aspectRatio: 1024 / 380,
    maxHeight: 150,
  },
  heroOverlay: {
    padding: 14,
    backgroundColor: "rgba(11, 14, 23, 0.96)",
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  heroLiveBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  heroLiveText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  heroLiveMeta: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#94A3B8",
  },
  heroTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
    lineHeight: 20,
    marginBottom: 4,
  },
  heroDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
    marginBottom: 12,
  },
  heroActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  heroPrimaryBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#0B0E17",
  },
  heroSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  heroSecondaryBtnText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#E2E8F0",
  },

  /* ── 4 QUICK NAV BUTTONS ── */
  quickNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  quickNavCard: {
    flex: 1,
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    paddingVertical: 12,
    alignItems: "center",
    gap: 6,
  },
  quickNavIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quickNavText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#E2E8F0",
  },

  /* ── SECTION HEADERS ── */
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  sectionActionText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#CBD5E1",
  },

  /* ── COMPACT LIST (TAB HOME) ── */
  compactListWrap: {
    gap: 10,
    marginBottom: 10,
  },
  compactAuctionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    borderRadius: 10,
    padding: 10,
    gap: 12,
  },
  compactMetaCol: {
    flex: 1,
    gap: 3,
  },
  compactTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  compactPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  compactPriceVal: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
  },
  compactTimerText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  compactBidBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 6,
  },
  compactBidBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
    color: "#0B0E17",
  },

  /* ── FILTER PILLS (TAB LELANG) ── */
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  filterPillActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  filterPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  filterPillTextActive: {
    fontFamily: "Nunito-Black",
    color: "#0B0E17",
  },

  /* ── AUCTION CARDS (TAB LELANG) ── */
  auctionCard: {
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    padding: 12,
    marginBottom: 10,
  },
  cardMainRow: {
    flexDirection: "row",
    gap: 12,
  },
  cardMetaCol: {
    flex: 1,
  },
  cardTagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    color: "#CBD5E1",
  },
  cardTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
    marginBottom: 8,
  },
  priceDetailsTable: {
    gap: 4,
    paddingTop: 2,
  },
  priceTableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceTableLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },
  priceCrystalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  microCrystal: {
    width: 12,
    height: 12,
  },
  largeCrystalIcon: {
    width: 18,
    height: 18,
  },
  midCrystalIcon: {
    width: 16,
    height: 16,
  },
  priceTableVal: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#E2E8F0",
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  clockWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  clockText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusPillActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  statusPillScheduled: {
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  statusPillText: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
  },
  statusPillTextActive: {
    color: "#10B981",
  },
  statusPillTextScheduled: {
    color: "#60A5FA",
  },

  /* ── 2x2 CATALOG GRID ── */
  catalogGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  catalogCard: {
    width: (Dimensions.get("window").width - 42) / 2,
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    gap: 8,
  },
  catalogMeta: {
    alignItems: "center",
    width: "100%",
  },
  catalogRarity: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    marginBottom: 2,
  },
  catalogTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
    textAlign: "center",
  },
  catalogType: {
    fontFamily: "Nunito-Regular",
    fontSize: 9,
    color: "#94A3B8",
    marginTop: 1,
  },

  /* ── TAB 3: KOLEKSI ── */
  tabContentBlock: {
    gap: 12,
  },
  koleksiIntroCard: {
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    padding: 14,
  },
  koleksiIntroDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
  },
  ownedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  ownedMetaCol: {
    flex: 1,
  },
  ownedTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  ownedStatusPill: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownedStatusPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    color: "#10B981",
  },
  ownedTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  ownedSource: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
  },
  equipBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
  },
  equipBtnActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  equipBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#CBD5E1",
  },
  equipBtnTextActive: {
    color: "#10B981",
  },
  emptyStateCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 10,
  },
  emptyStateTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#E2E8F0",
  },
  emptyStateDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 16,
  },
  emptyStateBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  emptyStateBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#0B0E17",
  },

  /* ── TAB 4: EVENT SPESIAL & MISI ── */
  eventSpecialCard: {
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    padding: 16,
    gap: 8,
  },
  eventSpecialHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eventSpecialBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  eventSpecialBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    color: "#FFFFFF",
  },
  eventSpecialActiveStatus: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#10B981",
  },
  eventSpecialTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
    lineHeight: 20,
  },
  eventSpecialDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
  },
  eventSpecialActionBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  eventSpecialActionBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#0B0E17",
  },
  missionHeaderContainer: {
    marginTop: 18,
    marginBottom: 10,
  },
  missionHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  missionHeaderTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 6,
  },
  missionHeaderTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#FFFFFF",
    flexShrink: 1,
  },
  dailyRewardPillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    flexShrink: 0,
  },
  dailyRewardPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },
  missionRewardHeader: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },
  missionIntroSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
    marginBottom: 10,
  },
  missionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    borderRadius: 10,
    padding: 12,
    gap: 12,
    marginBottom: 8,
  },
  missionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  missionInfoCol: {
    flex: 1,
  },
  missionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 2,
  },
  missionTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
    flex: 1,
  },
  missionRewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexShrink: 0,
  },
  missionRewardText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#38BDF8",
  },
  missionDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#94A3B8",
  },
  missionStatusIndicatorRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  missionProgressText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10,
    color: "#64748B",
  },
  missionProgressTextReady: {
    color: "#38BDF8",
    fontFamily: "Nunito-Bold",
  },
  missionProgressTextClaimed: {
    color: "#10B981",
    fontFamily: "Nunito-SemiBold",
  },
  claimBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  claimBtnReady: {
    backgroundColor: "#FFFFFF",
  },
  claimBtnAction: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  claimBtnClaimed: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 64,
    justifyContent: "center",
  },
  claimBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
  },
  claimBtnTextReady: {
    fontFamily: "Nunito-Black",
    color: "#0B0E17",
  },
  claimBtnTextAction: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  claimBtnTextClaimed: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#10B981",
  },

  /* ── BOTTOM TABS ── */
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#0B0E17",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 10,
  },
  bottomTabItem: {
    alignItems: "center",
    gap: 3,
    minWidth: 52,
  },
  bottomTabLabel: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10,
    color: "#64748B",
  },
  bottomTabLabelActive: {
    fontFamily: "Nunito-Bold",
    color: "#FFFFFF",
  },
  bottomTabLabelActiveRed: {
    fontFamily: "Nunito-Bold",
    color: "#EF4444",
  },

  /* ══════════════════════════════════════════════════════════════
      STYLES KHUSUS TAB PROFIL & PENGATURAN LELANG
      ══════════════════════════════════════════════════════════════ */
  profileHeaderIconsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileHeaderIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  profileHeaderBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  profileHeaderBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    color: "#FFFFFF",
  },
  profileTabContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  profileHeaderCard: {
    backgroundColor: "#0D1322",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 16,
    marginBottom: 20,
  },
  profileUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileAvatarPressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  profileUserMetaCol: {
    flex: 1,
    justifyContent: "center",
    gap: 3,
  },
  profileNameRowHorizontal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profileDisplayNameHorizontal: {
    fontFamily: "Nunito-Black",
    fontSize: 16.5,
    color: "#FFFFFF",
    maxWidth: "85%",
  },
  profileMetaBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  profileLevelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  profileTierIcon: {
    width: 14,
    height: 14,
  },
  profileLevelPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#38BDF8",
  },
  profileSpecialRoleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  profileSpecialRoleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#EF4444",
  },
  profileMemberRoleBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  profileMemberRoleText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#94A3B8",
  },
  profileUserTag: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  profileStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  profileStatCol: {
    flex: 1,
    alignItems: "center",
  },
  profileStatValue: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  profileStatLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  profileStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  profileLevelSubtitle: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#94A3B8",
  },
  profileQuickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  profileQuickBtnActive: {
    flex: 1,
    height: 76,
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderWidth: 1.5,
    borderColor: "#EF4444",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  profileQuickBtn: {
    flex: 1,
    height: 76,
    backgroundColor: "#0D1322",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  profileQuickIconWrap: {
    position: "relative",
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  profileQuickBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  profileQuickBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    color: "#FFFFFF",
  },
  profileQuickBtnLabelActive: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  profileQuickBtnLabel: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#94A3B8",
  },
  profileMenuSection: {
    marginBottom: 20,
  },
  profileMenuSectionTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#94A3B8",
    marginBottom: 10,
    marginLeft: 2,
  },
  profileMenuList: {
    gap: 8,
  },
  profileMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0D1322",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  profileMenuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  profileMenuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileMenuLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#F1F5F9",
  },
  profileCrystalSubtitle: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#38BDF8",
  },
  profileBottomDualRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  profileAdminBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    backgroundColor: "#0D1322",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
  },
  profileAdminBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#22D3EE",
  },
  profileDownloadBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1.5,
    borderColor: "#EF4444",
    borderRadius: 12,
  },
  profileDownloadBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  /* ══════════════════════════════════════════════════════════════
      STYLES KHUSUS HALAMAN DETAIL LELANG (GAMBAR 1 & 2)
      ══════════════════════════════════════════════════════════════ */
  detailContainer: {
    flex: 1,
    backgroundColor: "#070A12",
  },
  detailHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(11, 14, 23, 0.9)",
  },
  detailIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailScroll: {
    flex: 1,
  },
  detailScrollContent: {
    padding: 16,
    paddingBottom: 50,
  },
  showcaseWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  borderShowcaseBox: {
    alignItems: "center",
    justifyContent: "center",
    width: 200,
    height: 200,
    position: "relative",
  },
  borderOuterAura: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 8,
  },
  bannerShowcaseBox: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  detailMetaBlock: {
    marginBottom: 16,
  },
  detailTagRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  detailTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(59, 130, 246, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  detailTypeBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#60A5FA",
  },
  detailTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  detailDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
    lineHeight: 18,
  },
  specCard: {
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 14,
  },
  specRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  specLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
  },
  specValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  specValueText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  timerCard: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: 14,
  },
  timerClockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  timerClockText: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
    letterSpacing: 1.5,
  },
  timerSubText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#EF4444",
  },
  timerCardEnded: {
    backgroundColor: "rgba(30, 41, 59, 0.55)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: 14,
  },
  timerEndedTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#E2E8F0",
  },
  timerEndedSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  highestBidCard: {
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 14,
    marginBottom: 16,
  },
  highestBidHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  highestBidLabel: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#38BDF8",
  },
  userBalanceHeader: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  highestBidAmountBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  highestBidAmountLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  highestBidAmountText: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
  },
  highestBidTimeAgo: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#94A3B8",
  },
  totalBiddersRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalBiddersLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  totalBiddersVal: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  mainCtaBtn: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  mainCtaBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  alreadyOwnedContainer: {
    gap: 10,
    marginBottom: 20,
  },
  alreadyOwnedNoticeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  alreadyOwnedNoticeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#34D399",
    flex: 1,
  },
  ctaBtnDisabledBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 10,
    paddingVertical: 13,
  },
  ctaBtnDisabledText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#94A3B8",
  },
  leadingBidNoticeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
  },
  leadingBidNoticeTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FBBF24",
    marginBottom: 2,
  },
  leadingBidNoticeText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11.5,
    color: "#FDE68A",
    lineHeight: 16,
  },
  ctaBtnLeadingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(245, 158, 11, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.45)",
    borderRadius: 10,
    paddingVertical: 13,
  },
  ctaBtnLeadingText: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#F59E0B",
  },
  compactLeadingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  compactLeadingBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#F59E0B",
  },
  statusPillLeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillTextLeading: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#F59E0B",
  },
  compactOwnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  compactOwnedBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#10B981",
  },
  compactEndedBadge: {
    backgroundColor: "rgba(100, 116, 139, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(100, 116, 139, 0.35)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  compactEndedBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  statusPillWinner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillTextWinner: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#F59E0B",
  },
  statusPillOwned: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillTextOwned: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#34D399",
  },
  statusPillEnded: {
    backgroundColor: "rgba(100, 116, 139, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(100, 116, 139, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillTextEnded: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#64748B",
  },
  bidHistorySection: {
    gap: 8,
  },
  bidHistoryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  bidHistoryTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  bidHistoryCountText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#60A5FA",
  },
  emptyBidHistoryCard: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(22, 27, 38, 0.4)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 8,
  },
  emptyBidHistoryText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12.5,
    color: "#94A3B8",
    textAlign: "center",
  },
  bidHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bidHistoryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 70,
  },
  bidHistoryAmount: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  bidderBadgeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  bidderAvatarTiny: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  bidderNameText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10.5,
    color: "#E2E8F0",
  },
  bidTimeAgoText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
  },

  /* ══════════════════════════════════════════════════════════════
      STYLES MODAL KONFIRMASI PENAWARAN (GAMBAR 3)
      ══════════════════════════════════════════════════════════════ */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  modalCardLarge: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#0B0F19",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    padding: 18,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 14,
  },
  modalTitleLarge: {
    fontFamily: "Nunito-Black",
    fontSize: 15.5,
    color: "#FFFFFF",
  },
  modalCloseBtn: {
    position: "absolute",
    right: 0,
    top: 0,
    padding: 2,
  },
  modalItemRowPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  modalItemMetaCol: {
    flex: 1,
    gap: 4,
  },
  modalItemTitleText: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  modalItemTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(59, 130, 246, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.35)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  modalItemTagText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#60A5FA",
  },
  modalInputBlockCard: {
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 12,
    marginBottom: 10,
  },
  modalInputTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalInputTopLabel: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#94A3B8",
  },
  modalQuickChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipPill: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chipPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#38BDF8",
  },
  modalTextInputBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  modalInputPlaceholder: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
  },
  modalInputNumericRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: "#38BDF8",
    paddingBottom: 2,
  },
  modalNumericInput: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
    minWidth: 55,
    textAlign: "right",
    padding: 0,
  },
  modalInputMetaRows: {
    gap: 4,
  },
  modalMetaRowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalMetaLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },
  modalMetaVal: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  modalWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  warningCircleIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  warningBannerText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10.5,
    color: "#F59E0B",
    flex: 1,
    lineHeight: 14,
  },
  reservationBox: {
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 12,
    marginBottom: 12,
  },
  reservationTitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 4,
  },
  reservationMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: 8,
    marginBottom: 8,
  },
  reservationAmountWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reservationAmountText: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
  },
  reservationSisaText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#64748B",
  },
  reservationSubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  reservationSubLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  reservationSubVal: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  agreementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  customCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  customCheckboxChecked: {
    backgroundColor: "#EF4444",
    borderColor: "#EF4444",
  },
  agreementText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    flex: 1,
  },
  agreementLinkText: {
    color: "#38BDF8",
    textDecorationLine: "underline",
  },
  modalButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalBatalBtn: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBatalBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#CBD5E1",
  },
  modalKonfirmasiBtn: {
    flex: 1,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  modalKonfirmasiBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#FFFFFF",
  },

  /* ── DETAIL VIEW ENDED STATE BUTTONS ── */
  detailEndedButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  detailLihatHasilBtn: {
    flex: 1,
    height: 46,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLihatHasilBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#E2E8F0",
  },
  detailKlaimHadiahBtn: {
    flex: 1,
    height: 46,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  detailKlaimHadiahBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  detailKlaimDoneBtn: {
    flex: 1,
    height: 46,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  detailKlaimDoneBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#10B981",
  },
  singleLihatHasilBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  singleLihatHasilBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },

  /* ══════════════════════════════════════════════════════════════
      STYLES RIWAYAT LELANG (GAMBAR 1 DARI USER)
      ══════════════════════════════════════════════════════════════ */
  riwayatContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  riwayatFilterSegment: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B0E17",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  riwayatFilterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  riwayatFilterTabActive: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  riwayatFilterTabText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12.5,
    color: "#64748B",
  },
  riwayatFilterTabTextActive: {
    fontFamily: "Nunito-Bold",
    color: "#FFFFFF",
  },
  riwayatListWrap: {
    gap: 12,
  },
  riwayatCard: {
    backgroundColor: "#0D1322",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    gap: 12,
  },
  riwayatCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  riwayatCardInfoCol: {
    flex: 1,
    gap: 4,
  },
  riwayatCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  riwayatCardTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
    flex: 1,
  },
  riwayatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  riwayatBadgeMenang: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  riwayatBadgeKalah: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  riwayatBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
  },
  riwayatBadgeTextMenang: {
    color: "#10B981",
  },
  riwayatBadgeTextKalah: {
    color: "#EF4444",
  },
  riwayatMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  riwayatMetaLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  riwayatMetaValue: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  riwayatCrystalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  riwayatCrystalText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  riwayatActionDualRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  riwayatDetailBtn: {
    flex: 1,
    height: 38,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  riwayatDetailBtnFull: {
    width: "100%",
    height: 38,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  riwayatDetailBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },
  riwayatKlaimBtn: {
    flex: 1,
    height: 38,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  riwayatKlaimBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  /* ══════════════════════════════════════════════════════════════
      STYLES KLAIM HADIAH (GAMBAR 2 DARI USER)
      ══════════════════════════════════════════════════════════════ */
  klaimContainer: {
    flex: 1,
    backgroundColor: "#070A12",
  },
  klaimHeaderTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  klaimScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 36,
  },
  klaimItemCard: {
    backgroundColor: "#0D1322",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    marginBottom: 12,
  },
  klaimItemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  klaimItemMetaCol: {
    flex: 1,
    gap: 4,
  },
  klaimItemTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  klaimGreenBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  klaimGreenTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#10B981",
  },
  klaimGreenDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
  },
  klaimSpecCard: {
    backgroundColor: "#0D1322",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    marginBottom: 12,
  },
  klaimSpecRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
  },
  klaimSpecLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
  },
  klaimSpecValue: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12.5,
    color: "#CBD5E1",
  },
  klaimSpecValueBold: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
  },
  klaimDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginVertical: 4,
  },
  klaimStatusText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#F59E0B",
  },
  klaimStatusTextDone: {
    color: "#10B981",
  },
  klaimBalanceCard: {
    backgroundColor: "#0D1322",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    marginBottom: 26,
  },
  klaimBalanceLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 10,
  },
  klaimBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mediumCrystalIcon: {
    width: 20,
    height: 20,
  },
  klaimBalanceAmount: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  klaimTopupBtn: {
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  klaimTopupBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
  },
  klaimPayBtn: {
    height: 48,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  klaimPayBtnDone: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  klaimPayBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  klaimPayBtnTextDone: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#10B981",
  },
  klaimTermsWrap: {
    alignItems: "center",
    marginTop: 14,
  },
  klaimTermsText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    textDecorationLine: "underline",
  },

  /* ══════════════════════════════════════════════════════════════
      STYLES HASIL RESMI SERVER (GAMBAR 3 DARI USER)
      ══════════════════════════════════════════════════════════════ */
  hasilContainer: {
    flex: 1,
    backgroundColor: "#070A12",
  },
  hasilServerHeaderTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14.5,
    color: "#94A3B8",
  },
  hasilScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 36,
  },
  hasilCelebrationCard: {
    alignItems: "center",
    marginBottom: 18,
  },
  trophyGlowWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(245, 158, 11, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 6,
  },
  hasilCelebrationTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 20,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  hasilCelebrationSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
  },
  hasilItemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0D1322",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 12,
    marginBottom: 12,
  },
  hasilItemMetaCol: {
    flex: 1,
    gap: 4,
  },
  hasilItemTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14.5,
    color: "#FFFFFF",
  },
  hasilWinnerCard: {
    backgroundColor: "#0D1322",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    marginBottom: 12,
  },
  hasilWinnerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  hasilWinnerBadgeTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hasilWinnerTitleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#F59E0B",
  },
  hasilKamuMenangPill: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hasilKamuMenangText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#10B981",
  },
  hasilTutupPill: {
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hasilTutupText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  hasilSelesaiPill: {
    backgroundColor: "rgba(100, 116, 139, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(100, 116, 139, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hasilSelesaiText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  hasilEmptySubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  hasilUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  hasilUserAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#6366F1",
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  hasilUserMetaCol: {
    gap: 3,
  },
  hasilUserNameText: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  hasilMemberTag: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  hasilMemberTagText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10,
    color: "#38BDF8",
  },
  hasilPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  hasilPriceLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
  },
  hasilPriceAmount: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
  },
  hasilDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginVertical: 6,
  },
  hasilDualStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 4,
  },
  hasilDualStatsLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#64748B",
  },
  hasilDualStatsVal: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
    marginTop: 2,
  },
  hasilLeaderboardCard: {
    backgroundColor: "#0D1322",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  hasilLeaderboardTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  hasilLeaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hasilLeaderboardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rankCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  rankCircleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
  },
  rankNameText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 13,
    color: "#E2E8F0",
  },
  rankAmountText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  hasilBukaKlaimBtn: {
    height: 46,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  hasilBukaKlaimBtnDone: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  hasilBukaKlaimBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  hasilBukaKlaimBtnTextDone: {
    color: "#10B981",
  },
  hasilLihatDetailBtn: {
    height: 44,
    backgroundColor: "#0D1322",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  hasilLihatDetailBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#CBD5E1",
  },

  /* ── HALAMAN INFORMASI & PANDUAN LELANG ── */
  infoHeroCard: {
    backgroundColor: "#0D1322",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 16,
    marginBottom: 14,
    gap: 8,
  },
  infoHeroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  infoHeroTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 16,
    color: "#FFFFFF",
    lineHeight: 22,
  },
  infoHeroDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
    lineHeight: 18,
  },
  infoSectionCard: {
    backgroundColor: "#0D1322",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  infoSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  infoSectionTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  infoStepList: {
    gap: 12,
  },
  infoStepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoStepNumberBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  infoStepNumberText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#EF4444",
  },
  infoStepContent: {
    flex: 1,
    gap: 2,
  },
  infoStepHeading: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#E2E8F0",
  },
  infoStepDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 17,
  },
  infoRuleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 2,
  },
  infoRuleText: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#CBD5E1",
    lineHeight: 17,
  },

  /* ── FULL SCREEN LOADING PROPESIONAL ── */
  fullLoadingCenterWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  fullLoadingContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    width: "100%",
    maxWidth: 340,
  },
  fullLoadingTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 6,
  },
  fullLoadingSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
  },
});
