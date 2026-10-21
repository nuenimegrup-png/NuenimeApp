import { useCallback, useEffect, useMemo, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import {
  CRYSTAL_PACKAGES,
  type CrystalPackage,
  type PaymentMethodId,
  type PaymentMethodConfig,
  type TopUpTransaction,
  type TopUpStatus,
  createTopUpTransaction,
  getCrystalBalance,
  getPaymentMethodConfigs,
  fetchPaymentMethodConfigs,
  fetchCrystalPackages,
  fetchAdminWhatsAppNumber,
  getUserTransactions,
  fetchActivePendingTransaction,
  checkTransactionStatusFromBackend,
  openWhatsAppConfirmation,
  updateTransactionStatus,
  generateTransactionId,
  buildWhatsAppConfirmationMessage,
} from "@/lib/topup-service";

// Aset Resmi yang dikirim User
const TOPUP_BG = require("@/assets/images/topup/topup-bg.jpg");
const TOPUP_CRYSTAL = require("@/assets/images/topup/topup-crystal.png");

export { CRYSTAL_PACKAGES, type CrystalPackage };

export default function TopUpScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const { user, profile } = useAnirakuAuth();

  const userId = user?.id || null;
  const username =
    profile?.username ||
    profile?.display_name ||
    user?.email?.split("@")[0] ||
    "Pengguna";

  // ─── TAHAP NAVIGASI ALUR TOP UP ───
  // 1: Pilih Paket
  // 2: Pembayaran & Ringkasan
  // 3: Status Transaksi & Verifikasi
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // Paket yang dipilih
  const [selectedPkg, setSelectedPkg] = useState<CrystalPackage | null>(null);

  // Metode pembayaran yang dipilih di Tahap 2
  const [selectedMethodId, setSelectedMethodId] = useState<PaymentMethodId>("qris");

  // ID Transaksi sementara untuk Tahap 2 (agar ID konsisten sebelum dibuat)
  const [tempTxId, setTempTxId] = useState<string>("");

  // Transaksi aktif yang telah dibuat
  const [currentTx, setCurrentTx] = useState<TopUpTransaction | null>(null);

  // Status apakah ada transaksi pending yang mengunci alur
  const hasActivePendingTx = Boolean(
    currentTx &&
      (currentTx.status === "menunggu_verifikasi" || currentTx.status === "menunggu_konfirmasi")
  );

  // Saldo Crystal akun pengguna saat ini
  const [crystalBalance, setCrystalBalanceState] = useState<number>(0);

  // Riwayat transaksi
  const [userTransactions, setUserTransactions] = useState<TopUpTransaction[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Feedback copied
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Loading state proses transaksi
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Loading state pemeriksaan status pembayaran
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);

  // Konfigurasi metode pembayaran resmi (dinamis dari Admin Dashboard via Supabase & AsyncStorage)
  const [paymentConfigs, setPaymentConfigs] = useState<Record<PaymentMethodId, PaymentMethodConfig>>(() => getPaymentMethodConfigs());
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [availablePackages, setAvailablePackages] = useState<CrystalPackage[]>([]);
  const activeMethodConfig = paymentConfigs[selectedMethodId];

  // 2 kartu dalam 1 baris (padding 16px di kiri-kanan = 32px, gap 12px antar kartu)
  const cardWidth = Math.floor((Math.min(windowWidth, 600) - 32 - 12) / 2);

  // ─── LOAD DATA AWAL & PEMULIHAN TRANSAKSI AKTIF LANGSUNG DARI DATABASE ───
  const reloadData = useCallback(async () => {
    setIsLoadingInitial(true);
    try {
      const [balance, txs, dynConfigs, dynPkgs, pendingTx] = await Promise.all([
        getCrystalBalance(userId),
        getUserTransactions(userId),
        fetchPaymentMethodConfigs(),
        fetchCrystalPackages(),
        fetchActivePendingTransaction(userId),
      ]);
      setCrystalBalanceState(balance);
      setUserTransactions(txs);
      setPaymentConfigs(dynConfigs);
      setAvailablePackages(dynPkgs);

      // JIKA ADA TRANSAKSI PENDING AKTIF:
      // Kunci pengguna di Tahap 3 secara persisten (bahkan setelah reload/reopen app)
      if (pendingTx) {
        setCurrentTx(pendingTx);
        setActiveStep(3);
      } else if (!currentTx && txs.length > 0) {
        // Jika tidak ada transaksi pending tapi riwayat ada, jangan paksa kunci
      }
    } catch {
      // Abaikan error loading lokal
    } finally {
      setIsLoadingInitial(false);
    }
  }, [userId]);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // ─── SINKRONISASI REAL-TIME DENGAN KEPUTUSAN ADMIN (SUPABASE REALTIME & FALLBACK) ───
  useEffect(() => {
    if (!currentTx?.id) return;
    const isPending =
      currentTx.status === "menunggu_verifikasi" || currentTx.status === "menunggu_konfirmasi";

    if (!isPending) return;

    // 1. Supabase Realtime Subscription (postgres_changes)
    const channelName = `realtime-topup-${currentTx.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "topup_transactions",
          filter: `id=eq.${currentTx.id}`,
        },
        async (payload) => {
          const updated = payload.new as any;
          if (updated && updated.status !== currentTx.status) {
            const mappedTx: TopUpTransaction = {
              ...currentTx,
              status: updated.status,
              statusNote: updated.status_note,
              verifiedAt: updated.verified_at,
              crystalsGranted: Boolean(updated.crystals_granted),
            };
            setCurrentTx(mappedTx);

            // Perbarui saldo & riwayat secara atomik
            const [newBal, newTxs] = await Promise.all([
              getCrystalBalance(userId),
              getUserTransactions(userId),
            ]);
            setCrystalBalanceState(newBal);
            setUserTransactions(newTxs);

            if (updated.status === "berhasil") {
              hapticSuccess();
              Alert.alert(
                "Top Up Berhasil Disetujui! 🎉",
                `Admin Nuenime telah menyetujui transaksi Anda. Saldo ${mappedTx.crystalAmount.toLocaleString(
                  "id-ID"
                )} Dylan Crystal telah ditambahkan ke akun Anda.`
              );
            } else if (updated.status === "ditolak") {
              hapticWarning();
              Alert.alert(
                "Transaksi Ditolak",
                updated.status_note || "Pembayaran tidak valid atau bukti transfer tidak sesuai."
              );
            } else if (updated.status === "reversed") {
              hapticWarning();
              Alert.alert(
                "Crystal Ditarik Kembali (Reversed)",
                `Crystal dari transaksi ${mappedTx.id} telah ditarik kembali oleh Admin Nuenime.\nAlasan: ${
                  updated.status_note || "Koreksi saldo oleh admin."
                }`
              );
            }
          }
        }
      )
      .subscribe();

    // 2. Polling Fallback setiap 8 detik (jika koneksi websocket sleep di background)
    const pollInterval = setInterval(async () => {
      const latest = await checkTransactionStatusFromBackend(currentTx.id, userId);
      if (latest && latest.status !== currentTx.status) {
        setCurrentTx(latest);
        const [newBal, newTxs] = await Promise.all([
          getCrystalBalance(userId),
          getUserTransactions(userId),
        ]);
        setCrystalBalanceState(newBal);
        setUserTransactions(newTxs);

        if (latest.status === "berhasil") {
          hapticSuccess();
          Alert.alert(
            "Top Up Berhasil Disetujui! 🎉",
            `Admin Nuenime telah menyetujui transaksi Anda. Saldo ${latest.crystalAmount.toLocaleString(
              "id-ID"
            )} Dylan Crystal telah ditambahkan ke akun Anda.`
          );
        } else if (latest.status === "ditolak") {
          hapticWarning();
          Alert.alert(
            "Transaksi Ditolak",
            latest.statusNote || "Pembayaran tidak valid atau bukti transfer tidak sesuai."
          );
        } else if (latest.status === "reversed") {
          hapticWarning();
          Alert.alert(
            "Crystal Ditarik Kembali (Reversed)",
            `Crystal dari transaksi ${latest.id} telah ditarik kembali oleh Admin Nuenime.\nAlasan: ${
              latest.statusNote || "Koreksi saldo oleh admin."
            }`
          );
        }
      }
    }, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [currentTx?.id, currentTx?.status, userId]);

  // ─── TAHAP 1: PILIH PAKET ───
  const handleSelectPackage = (pkg: CrystalPackage) => {
    hapticLight();
    setSelectedPkg(pkg);
    // Hasilkan ID transaksi sementara untuk ringkasan Tahap 2 jika belum ada
    if (!tempTxId) {
      setTempTxId(generateTransactionId());
    }
    // Langsung berpindah ke Tahap 2 — Pembayaran tanpa pop-up/modal
    setActiveStep(2);
  };

  // ─── SALIN KE CLIPBOARD ───
  const handleCopyText = async (text: string, key: string, label: string) => {
    hapticSuccess();
    try {
      await Clipboard.setStringAsync(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
      if (Platform.OS === "web") {
        // Simple feedback
      } else {
        Alert.alert("Tersalin", `${label} berhasil disalin ke papan klip.`);
      }
    } catch {
      Alert.alert("Gagal Menyalin", "Tidak dapat menyalin teks.");
    }
  };

  // ─── UNDUH / SIMPAN QRIS ───
  const handleDownloadQRIS = () => {
    hapticLight();
    if (!activeMethodConfig.qrImageUrl) {
      Alert.alert(
        "QRIS Belum Tersedia",
        "Gambar QRIS resmi belum dikonfigurasi oleh pengelola aplikasi."
      );
      return;
    }

    if (Platform.OS === "web") {
      try {
        const a = document.createElement("a");
        a.href = activeMethodConfig.qrImageUrl;
        a.download = `QRIS-Nuenime-${tempTxId || "Store"}.png`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {
        window.open(activeMethodConfig.qrImageUrl, "_blank");
      }
    } else {
      Alert.alert(
        "Unduh QRIS",
        "Silakan lakukan tangkapan layar (screenshot) kode QR di bawah untuk dipindai di aplikasi pembayaran Anda."
      );
    }
  };

  // ─── TAHAP 2: PROSES KONFIRMASI & BUKA WHATSAPP ───
  const handleConfirmPayment = async () => {
    if (!selectedPkg) {
      Alert.alert("Error", "Pilih paket terlebih dahulu.");
      return;
    }

    if (!activeMethodConfig.isConfigured) {
      Alert.alert(
        "Metode Belum Tersedia",
        `Metode pembayaran ${activeMethodConfig.name} belum dikonfigurasi secara resmi oleh admin. Silakan pilih metode lain.`
      );
      return;
    }

    hapticLight();
    setIsSubmitting(true);

    try {
      // 1. Simpan transaksi terlebih dahulu sebelum membuka WhatsApp
      const newTx = await createTopUpTransaction({
        userId: userId || "guest",
        username,
        packageItem: selectedPkg,
        paymentMethod: selectedMethodId,
        additionalFee: 0,
      });

      // 2. Set status transaksi menjadi menunggu_verifikasi
      const updatedRes = await updateTransactionStatus(
        userId,
        newTx.id,
        "menunggu_verifikasi",
        "Menunggu verifikasi admin"
      );

      const savedTx = updatedRes.transaction || newTx;
      setCurrentTx(savedTx);

      // Refresh riwayat
      const updatedList = await getUserTransactions(userId);
      setUserTransactions(updatedList);

      // 3. Buka WhatsApp untuk konfirmasi
      await openWhatsAppConfirmation(savedTx);

      // 4. Beralih ke Tahap 3 — Status Transaksi
      setActiveStep(3);
    } catch {
      Alert.alert(
        "Gagal Memproses",
        "Terjadi kendala saat menyimpan transaksi. Pastikan koneksi aman dan coba lagi."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── PERIKSA STATUS PEMBAYARAN KE BACKEND REAL (SUPABASE) ───
  const handleCheckPaymentStatus = async () => {
    if (!currentTx) return;
    hapticLight();
    setIsCheckingStatus(true);

    try {
      const latest = await checkTransactionStatusFromBackend(currentTx.id, userId);
      if (latest) {
        setCurrentTx(latest);

        // Perbarui saldo & riwayat pengguna secara atomik
        const [newBal, newTxs] = await Promise.all([
          getCrystalBalance(userId),
          getUserTransactions(userId),
        ]);
        setCrystalBalanceState(newBal);
        setUserTransactions(newTxs);

        if (latest.status === "berhasil") {
          hapticSuccess();
          Alert.alert(
            "Verifikasi Berhasil! 🎉",
            `Pembayaran sah! Saldo ${latest.crystalAmount.toLocaleString(
              "id-ID"
            )} Dylan Crystal telah ditambahkan ke akun Anda. Saldo saat ini: ${newBal.toLocaleString(
              "id-ID"
            )} Crystal.`
          );
        } else if (latest.status === "ditolak") {
          hapticWarning();
          Alert.alert(
            "Transaksi Ditolak",
            latest.statusNote || "Pembayaran tidak valid atau belum masuk ke rekening admin."
          );
        } else {
          Alert.alert(
            "Status Transaksi",
            "Transaksi Anda saat ini masih dalam antrean verifikasi Admin Nuenime. Mohon tunggu beberapa saat lagi."
          );
        }
      } else {
        Alert.alert(
          "Pemeriksaan Status",
          "Status transaksi Anda belum berubah (masih menunggu verifikasi admin)."
        );
      }
    } catch {
      Alert.alert(
        "Koneksi Terganggu",
        "Gagal menghubungi server database. Status terakhir dipertahankan, silakan coba beberapa saat lagi."
      );
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // ─── MEMULAI TOP UP BARU SETELAH TRANSAKSI FINAL ───
  const handleResetAndStartNew = () => {
    hapticLight();
    setCurrentTx(null);
    setSelectedPkg(null);
    setTempTxId("");
    setActiveStep(1);
  };

  // ─── TAMPILAN STATUS BADGE ───
  const renderStatusBadge = (status: TopUpStatus) => {
    switch (status) {
      case "menunggu_konfirmasi":
        return (
          <View style={[styles.badgeBase, styles.badgeWarning]}>
            <AppIcon name="clock-outline" size={13} color="#F59E0B" />
            <Text style={[styles.badgeText, { color: "#F59E0B" }]}>Menunggu Konfirmasi</Text>
          </View>
        );
      case "menunggu_verifikasi":
        return (
          <View style={[styles.badgeBase, styles.badgeProcessing]}>
            <AppIcon name="progress-clock" size={13} color="#38BDF8" />
            <Text style={[styles.badgeText, { color: "#38BDF8" }]}>
              Sedang Diproses / Menunggu Verifikasi Admin
            </Text>
          </View>
        );
      case "berhasil":
        return (
          <View style={[styles.badgeBase, styles.badgeSuccess]}>
            <AppIcon name="check-circle" size={13} color="#10B981" />
            <Text style={[styles.badgeText, { color: "#10B981" }]}>Berhasil</Text>
          </View>
        );
      case "ditolak":
        return (
          <View style={[styles.badgeBase, styles.badgeDanger]}>
            <AppIcon name="alert-circle" size={13} color="#EF4444" />
            <Text style={[styles.badgeText, { color: "#EF4444" }]}>Ditolak / Tidak Valid</Text>
          </View>
        );
      case "reversed":
        return (
          <View style={[styles.badgeBase, styles.badgeReversed]}>
            <AppIcon name="history" size={13} color="#F97316" />
            <Text style={[styles.badgeText, { color: "#F97316" }]}>Ditarik Kembali (Reversed)</Text>
          </View>
        );
      case "kedaluwarsa":
        return (
          <View style={[styles.badgeBase, styles.badgeMuted]}>
            <AppIcon name="clock-alert-outline" size={13} color="#94A3B8" />
            <Text style={[styles.badgeText, { color: "#94A3B8" }]}>Kedaluwarsa</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.root}>
      {/* ─── BACKGROUND GAMBAR RESMI DARI USER ─── */}
      <Image
        source={TOPUP_BG}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={200}
      />

      {/* Dark overlay gradasi halus */}
      <LinearGradient
        colors={[
          "rgba(11, 14, 23, 0.72)",
          "rgba(11, 14, 23, 0.86)",
          "rgba(11, 14, 23, 0.96)",
        ]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeContainer}>
        {/* ─── TOP APP BAR: TOMBOL KEMBALI & SALDO ─── */}
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            onPress={() => {
              hapticLight();
              // KETIKA ADA TRANSAKSI PENDING AKTIF:
              // Pengguna tidak boleh diarahkan ke Tahap 1 atau Tahap 2.
              // Tombol kembali langsung keluar dari layar Top Up (router.back()).
              if (hasActivePendingTx) {
                router.back();
                return;
              }

              if (activeStep === 2) {
                // Dari Tahap 2, kembali ke Tahap 1 tanpa mereset paket
                setActiveStep(1);
              } else if (activeStep === 3) {
                // Dari Tahap 3 (jika sudah final), kembali ke Tahap 1
                handleResetAndStartNew();
              } else {
                router.back();
              }
            }}
            style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
            hitSlop={10}
          >
            <AppIcon name="arrow-left" size={22} color="#FFFFFF" />
          </Pressable>

          <View style={styles.titleWrap}>
            <Text style={styles.titleText}>Top Up Crystal</Text>
          </View>

          {/* Saldo Dylan Crystal Akun Pengguna Saat Ini */}
          <View style={styles.balancePill}>
            <Image source={TOPUP_CRYSTAL} style={styles.balancePillIcon} contentFit="contain" />
            {isLoadingInitial ? (
              <ActivityIndicator size="small" color="#38BDF8" style={{ transform: [{ scale: 0.75 }] }} />
            ) : (
              <Text style={styles.balancePillText}>
                {crystalBalance.toLocaleString("id-ID")}
              </Text>
            )}
          </View>
        </View>

        {/* ─── INDIKATOR TAHAPAN PROGRESS BAR (STEP 1, 2, 3) ─── */}
        <View style={styles.stepIndicatorRow}>
          <Pressable
            disabled={hasActivePendingTx}
            onPress={() => {
              if (hasActivePendingTx) {
                Alert.alert(
                  "Transaksi Sedang Diproses",
                  "Anda memiliki transaksi yang masih menunggu verifikasi admin. Pilihan paket baru dikunci hingga verifikasi selesai."
                );
                return;
              }
              hapticLight();
              setActiveStep(1);
            }}
            style={[
              styles.stepItem,
              activeStep === 1 && styles.stepItemActive,
              hasActivePendingTx && styles.stepItemDisabled,
            ]}
          >
            <View
              style={[
                styles.stepCircle,
                activeStep === 1
                  ? styles.stepCircleActive
                  : activeStep > 1
                  ? styles.stepCircleDone
                  : styles.stepCircleInactive,
              ]}
            >
              {activeStep > 1 ? (
                <AppIcon name="check" size={12} color="#0B0E17" />
              ) : (
                <Text
                  style={[
                    styles.stepNumber,
                    activeStep === 1 ? styles.stepNumberActive : styles.stepNumberInactive,
                  ]}
                >
                  1
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                activeStep === 1 ? styles.stepLabelActive : styles.stepLabelInactive,
              ]}
              numberOfLines={1}
            >
              Pilih Paket
            </Text>
          </Pressable>

          <View
            style={[styles.stepLine, activeStep >= 2 ? styles.stepLineActive : styles.stepLineInactive]}
          />

          <Pressable
            disabled={hasActivePendingTx || !selectedPkg}
            onPress={() => {
              if (hasActivePendingTx) {
                Alert.alert(
                  "Transaksi Sedang Diproses",
                  "Anda memiliki transaksi yang masih menunggu verifikasi admin."
                );
                return;
              }
              if (selectedPkg) {
                hapticLight();
                setActiveStep(2);
              }
            }}
            style={[
              styles.stepItem,
              activeStep === 2 && styles.stepItemActive,
              (hasActivePendingTx || !selectedPkg) && styles.stepItemDisabled,
            ]}
          >
            <View
              style={[
                styles.stepCircle,
                activeStep === 2
                  ? styles.stepCircleActive
                  : activeStep > 2
                  ? styles.stepCircleDone
                  : styles.stepCircleInactive,
              ]}
            >
              {activeStep > 2 ? (
                <AppIcon name="check" size={12} color="#0B0E17" />
              ) : (
                <Text
                  style={[
                    styles.stepNumber,
                    activeStep === 2 ? styles.stepNumberActive : styles.stepNumberInactive,
                  ]}
                >
                  2
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                activeStep === 2 ? styles.stepLabelActive : styles.stepLabelInactive,
              ]}
              numberOfLines={1}
            >
              Pembayaran
            </Text>
          </Pressable>

          <View
            style={[styles.stepLine, activeStep >= 3 ? styles.stepLineActive : styles.stepLineInactive]}
          />

          <Pressable
            disabled={!currentTx}
            onPress={() => {
              if (currentTx) {
                hapticLight();
                setActiveStep(3);
              }
            }}
            style={[styles.stepItem, activeStep === 3 && styles.stepItemActive]}
          >
            <View
              style={[
                styles.stepCircle,
                activeStep === 3 ? styles.stepCircleActive : styles.stepCircleInactive,
              ]}
            >
              <Text
                style={[
                  styles.stepNumber,
                  activeStep === 3 ? styles.stepNumberActive : styles.stepNumberInactive,
                ]}
              >
                3
              </Text>
            </View>
            <Text
              style={[
                styles.stepLabel,
                activeStep === 3 ? styles.stepLabelActive : styles.stepLabelInactive,
              ]}
              numberOfLines={1}
            >
              Status Transaksi
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ══════════════════════════════════════════════════════
              TAHAP 1: PILIH PAKET TOP UP
             ══════════════════════════════════════════════════════ */}
          {activeStep === 1 && (
            <View style={styles.stepContainer}>
              {/* Banner Informasi Toko */}
              <View style={styles.heroNoticeCard}>
                <View style={styles.heroBadgeRow}>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>DYLAN CRYSTAL STORE</Text>
                  </View>
                  {userTransactions.length > 0 && (
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        setShowHistoryModal(true);
                      }}
                      style={styles.historyShortcutBtn}
                    >
                      <AppIcon name="history" size={13} color="#38BDF8" />
                      <Text style={styles.historyShortcutText}>
                        Riwayat ({userTransactions.length})
                      </Text>
                    </Pressable>
                  )}
                </View>
                <Text style={styles.heroTitle}>Pilih Paket Crystal</Text>
                <Text style={styles.heroDesc}>
                  Pilih paket Dylan Crystal yang Anda inginkan. Setelah memilih paket, Anda akan
                  langsung diarahkan ke tahap metode pembayaran dan konfirmasi.
                </Text>
              </View>

              {/* Grid Paket: 2 Kartu Per Baris atau Skeleton Loading */}
              {isLoadingInitial ? (
                <View style={styles.loadingContainerInitial}>
                  <View style={styles.loadingHeaderRow}>
                    <ActivityIndicator size="small" color="#38BDF8" />
                    <Text style={styles.loadingTextInitial}>
                      Menghubungkan ke database Dylan Crystal...
                    </Text>
                  </View>
                  <View style={styles.packageGrid}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <View
                        key={`skeleton-${i}`}
                        style={[{ width: cardWidth }, styles.packageCard, styles.packageCardSkeleton]}
                      >
                        <View style={styles.skeletonIconWrap}>
                          <Image
                            source={TOPUP_CRYSTAL}
                            style={[styles.crystalIcon, { opacity: 0.2 }]}
                            contentFit="contain"
                          />
                        </View>
                        <View style={styles.skeletonBarTitle} />
                        <View style={styles.skeletonBarAmount} />
                        <View style={styles.skeletonBarPrice} />
                      </View>
                    ))}
                  </View>
                </View>
              ) : availablePackages.filter((pkg) => pkg.active !== false).length === 0 ? (
                <View style={styles.emptyContainerInitial}>
                  <AppIcon name="alert-circle-outline" size={32} color="#94A3B8" />
                  <Text style={styles.emptyTextInitial}>Belum ada paket top up tersedia di database.</Text>
                  <Pressable
                    onPress={reloadData}
                    style={({ pressed }) => [styles.retryBtn, pressed && styles.btnPressed]}
                  >
                    <Text style={styles.retryBtnText}>Muat Ulang</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.packageGrid}>
                  {availablePackages
                    .filter((pkg) => pkg.active !== false)
                    .map((pkg) => {
                      const isSelected = selectedPkg?.id === pkg.id;
                      return (
                        <Pressable
                          key={pkg.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Paket ${pkg.name}, ${pkg.amountFormatted} Crystal, harga ${pkg.priceFormatted}`}
                          onPress={() => handleSelectPackage(pkg)}
                          style={({ pressed }) => [
                            { width: cardWidth },
                            styles.packageCard,
                            isSelected && styles.packageCardSelected,
                            pressed && styles.cardPressed,
                          ]}
                        >
                          {/* Tag Opsional di Sudut Atas */}
                          {pkg.tag ? (
                            <View
                              style={[
                                styles.tagBadge,
                                { borderColor: pkg.tagColor, backgroundColor: `${pkg.tagColor}22` },
                              ]}
                            >
                              <Text style={[styles.tagBadgeText, { color: pkg.tagColor }]}>
                                {pkg.tag}
                              </Text>
                            </View>
                          ) : null}

                          {/* Ikon Crystal Resmi */}
                          <View style={styles.crystalIconWrap}>
                            <Image
                              source={TOPUP_CRYSTAL}
                              style={styles.crystalIcon}
                              contentFit="contain"
                            />
                          </View>

                          {/* Nama Paket */}
                          <Text style={styles.packageNameText} numberOfLines={1}>
                            {pkg.name}
                          </Text>

                          {/* Jumlah Crystal */}
                          <View style={styles.amountRow}>
                            <Text style={styles.amountNumber}>{pkg.amountFormatted}</Text>
                            <Text style={styles.amountUnit}>Crystal</Text>
                          </View>

                          {/* Harga Rupiah */}
                          <View style={styles.pricePill}>
                            <Text style={styles.priceText}>{pkg.priceFormatted}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                </View>
              )}

              {/* Catatan / Keterangan Pembayaran */}
              <View style={styles.footerInfoBox}>
                <AppIcon name="information-outline" size={16} color="#64748B" />
                <Text style={styles.footerInfoText}>
                  Crystal akan langsung ditambahkan ke saldo akun Nuenime setelah proses verifikasi
                  selesai dan dinyatakan valid.
                </Text>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAHAP 2: RINGKASAN & METODE PEMBAYARAN
             ══════════════════════════════════════════════════════ */}
          {activeStep === 2 && selectedPkg && (
            <View style={styles.stepContainer}>
              {/* 1. Ringkasan Transaksi */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeaderRow}>
                  <View style={styles.summaryTitleGroup}>
                    <AppIcon name="receipt" size={18} color="#38BDF8" />
                    <Text style={styles.summaryCardTitle}>Ringkasan Transaksi</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setActiveStep(1);
                    }}
                    style={styles.changePkgBtn}
                  >
                    <Text style={styles.changePkgBtnText}>Ganti Paket</Text>
                  </Pressable>
                </View>

                {/* Detail Baris */}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Paket Crystal</Text>
                  <Text style={styles.summaryValue}>
                    {selectedPkg.amountFormatted} Crystal ({selectedPkg.name})
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Harga Paket</Text>
                  <Text style={styles.summaryValue}>{selectedPkg.priceFormatted}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Biaya Layanan</Text>
                  <Text style={styles.summaryValue}>Rp0</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>ID Pesanan Sementara</Text>
                  <Pressable
                    onPress={() => handleCopyText(tempTxId, "tempTxId", "ID Pesanan")}
                    style={styles.copyInlineBtn}
                  >
                    <Text style={styles.summaryIdText}>{tempTxId}</Text>
                    <AppIcon
                      name={copiedKey === "tempTxId" ? "check" : "content-copy"}
                      size={13}
                      color="#38BDF8"
                    />
                  </Pressable>
                </View>

                <View style={styles.summaryDivider} />

                {/* Total Akhir */}
                <View style={styles.summaryTotalRow}>
                  <Text style={styles.summaryTotalLabel}>Total Pembayaran</Text>
                  <Text style={styles.summaryTotalValue}>{selectedPkg.priceFormatted}</Text>
                </View>
              </View>

              {/* 2. Pilihan Metode Pembayaran */}
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Pilih Metode Pembayaran</Text>
                <Text style={styles.sectionSubtitle}>
                  Detail pembayaran akan muncul di bawah sesuai metode yang dipilih.
                </Text>
              </View>

              <View style={styles.methodSelectorGrid}>
                {(
                  [
                    { id: "qris", name: "QRIS", icon: "qrcode-scan" },
                    { id: "shopeepay", name: "ShopeePay", icon: "shopping" },
                    { id: "gopay", name: "GoPay", icon: "wallet" },
                    { id: "dana", name: "DANA", icon: "credit-card-outline" },
                  ] as const
                ).map((m) => {
                  const cfg = paymentConfigs[m.id];
                  const isSelected = selectedMethodId === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => {
                        hapticLight();
                        setSelectedMethodId(m.id);
                      }}
                      style={({ pressed }) => [
                        styles.methodCard,
                        isSelected && styles.methodCardSelected,
                        !cfg.isConfigured && styles.methodCardDisabled,
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <View style={styles.methodCardHeader}>
                        <View
                          style={[
                            styles.methodIconBox,
                            isSelected && styles.methodIconBoxSelected,
                          ]}
                        >
                          <AppIcon
                            name={m.icon}
                            size={20}
                            color={isSelected ? "#38BDF8" : "#94A3B8"}
                          />
                        </View>
                        {isSelected && (
                          <View style={styles.selectedDot}>
                            <AppIcon name="check" size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.methodNameText,
                          isSelected && styles.methodNameTextSelected,
                        ]}
                      >
                        {m.name}
                      </Text>
                      {/* Indikator Status Ketersediaan */}
                      <View style={styles.methodStatusBadge}>
                        <Text
                          style={[
                            styles.methodStatusText,
                            cfg.isConfigured
                              ? styles.methodStatusAvailable
                              : styles.methodStatusUnavailable,
                          ]}
                        >
                          {cfg.isConfigured ? "Tersedia" : "Belum Dikonfigurasi"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* 3. Detail Pembayaran Sesuai Metode (Berubah Langsung di Tahap 2 Tanpa Pop-up) */}
              <View style={styles.paymentDetailCard}>
                <View style={styles.detailHeaderRow}>
                  <Text style={styles.detailCardTitle}>
                    Detail Pembayaran: {activeMethodConfig.name}
                  </Text>
                </View>

                {/* Kasus A: QRIS */}
                {selectedMethodId === "qris" ? (
                  activeMethodConfig.isConfigured && activeMethodConfig.qrImageUrl ? (
                    <View style={styles.qrisContentWrap}>
                      <View style={styles.qrisImageContainer}>
                        <Image
                          source={{ uri: activeMethodConfig.qrImageUrl }}
                          style={styles.qrisImage}
                          contentFit="contain"
                        />
                      </View>
                      <Text style={styles.qrisMerchantName}>
                        {activeMethodConfig.accountName || "Nuenime Official Store"}
                      </Text>
                      <Text style={styles.qrisTotalPay}>{selectedPkg.priceFormatted}</Text>

                      <Pressable
                        onPress={handleDownloadQRIS}
                        style={({ pressed }) => [
                          styles.downloadQrisBtn,
                          pressed && styles.btnPressed,
                        ]}
                      >
                        <AppIcon name="download" size={16} color="#FFFFFF" />
                        <Text style={styles.downloadQrisBtnText}>Unduh QRIS</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.unconfiguredBox}>
                      <AppIcon name="alert-circle-outline" size={32} color="#F59E0B" />
                      <Text style={styles.unconfiguredTitle}>QRIS Belum Dikonfigurasi</Text>
                      <Text style={styles.unconfiguredDesc}>
                        Data gambar QRIS resmi belum diatur oleh pengelola aplikasi di konfigurasi
                        resmi Nuenime. Pilihan pembayaran ini dinonaktifkan untuk mencegah
                        kesalahan transaksi ke tujuan yang belum diverifikasi.
                      </Text>
                    </View>
                  )
                ) : null}

                {/* Kasus B: ShopeePay, GoPay, DANA */}
                {selectedMethodId !== "qris" ? (
                  activeMethodConfig.isConfigured && activeMethodConfig.accountNumber ? (
                    <View style={styles.ewalletContentWrap}>
                      <View style={styles.ewalletInfoRow}>
                        <Text style={styles.ewalletInfoLabel}>Nama Penerima</Text>
                        <Text style={styles.ewalletInfoValue}>
                          {activeMethodConfig.accountName || "Nuenime Admin"}
                        </Text>
                      </View>

                      <View style={styles.ewalletInfoRow}>
                        <Text style={styles.ewalletInfoLabel}>Nomor Tujuan Transfer</Text>
                        <View style={styles.copyTargetRow}>
                          <Text style={styles.ewalletNumberValue}>
                            {activeMethodConfig.accountNumber}
                          </Text>
                          <Pressable
                            onPress={() =>
                              handleCopyText(
                                activeMethodConfig.accountNumber!,
                                "accountNumber",
                                "Nomor Rekening/Tujuan"
                              )
                            }
                            style={styles.copySmallBtn}
                          >
                            <AppIcon
                              name={copiedKey === "accountNumber" ? "check" : "content-copy"}
                              size={14}
                              color="#FFFFFF"
                            />
                            <Text style={styles.copySmallBtnText}>
                              {copiedKey === "accountNumber" ? "Tersalin" : "Salin"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.ewalletInfoRow}>
                        <Text style={styles.ewalletInfoLabel}>Nominal yang Harus Dibayar</Text>
                        <Text style={styles.ewalletTotalPay}>{selectedPkg.priceFormatted}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.unconfiguredBox}>
                      <AppIcon name="alert-circle-outline" size={32} color="#F59E0B" />
                      <Text style={styles.unconfiguredTitle}>
                        {activeMethodConfig.name} Belum Dikonfigurasi
                      </Text>
                      <Text style={styles.unconfiguredDesc}>
                        Nomor tujuan pembayaran resmi untuk metode ini belum diatur oleh
                        pengelola aplikasi. Pilihan dinonaktifkan hingga nomor pembayaran resmi
                        tersedia.
                      </Text>
                    </View>
                  )
                ) : null}

                {/* Petunjuk Pembayaran Sesuai Persyaratan Resmi */}
                <View style={styles.instructionsContainer}>
                  <Text style={styles.instructionsTitle}>Petunjuk Pembayaran:</Text>
                  {selectedMethodId === "qris" ? (
                    <View style={styles.stepList}>
                      <Text style={styles.stepText}>
                        1. Buka aplikasi pembayaran yang mendukung QRIS (BCA, GoPay, OVO, Dana,
                        ShopeePay, dll).
                      </Text>
                      <Text style={styles.stepText}>2. Pindai kode QR yang ditampilkan di atas.</Text>
                      <Text style={styles.stepText}>
                        3. Periksa nama penerima dan jumlah pembayaran (harus tepat{" "}
                        {selectedPkg.priceFormatted}).
                      </Text>
                      <Text style={styles.stepText}>
                        4. Selesaikan pembayaran sesuai instruksi aplikasi pembayaran Anda.
                      </Text>
                      <Text style={styles.stepText}>5. Setelah membayar, kembali ke Nuenime.</Text>
                      <Text style={styles.stepText}>
                        6. Klik tombol "Sudah Bayar, Lanjut Konfirmasi" di bawah.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.stepList}>
                      <Text style={styles.stepText}>
                        1. Buka aplikasi {activeMethodConfig.name}.
                      </Text>
                      <Text style={styles.stepText}>
                        2. Kirim pembayaran sesuai detail nomor tujuan yang ditampilkan di atas.
                      </Text>
                      <Text style={styles.stepText}>
                        3. Pastikan nominal pembayaran sesuai tepat {selectedPkg.priceFormatted}.
                      </Text>
                      <Text style={styles.stepText}>
                        4. Simpan bukti transfer (tangkapan layar / struk).
                      </Text>
                      <Text style={styles.stepText}>5. Kembali ke aplikasi Nuenime.</Text>
                      <Text style={styles.stepText}>
                        6. Klik tombol "Sudah Bayar, Lanjut Konfirmasi" di bawah.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Tombol Konfirmasi WhatsApp */}
                <View style={styles.actionBtnWrap}>
                  <Pressable
                    disabled={!activeMethodConfig.isConfigured || isSubmitting}
                    onPress={handleConfirmPayment}
                    style={({ pressed }) => [
                      styles.confirmActionBtn,
                      (!activeMethodConfig.isConfigured || isSubmitting) &&
                        styles.confirmActionBtnDisabled,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <AppIcon name="whatsapp" size={18} color="#FFFFFF" />
                    <Text style={styles.confirmActionBtnText}>
                      {isSubmitting
                        ? "Memproses Transaksi..."
                        : activeMethodConfig.isConfigured
                        ? "Sudah Bayar, Lanjut Konfirmasi"
                        : "Metode Belum Dikonfigurasi"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setActiveStep(1);
                    }}
                    style={styles.cancelStepBtn}
                  >
                    <Text style={styles.cancelStepBtnText}>← Kembali ke Pilih Paket</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              TAHAP 3: STATUS TRANSAKSI & VERIFIKASI
             ══════════════════════════════════════════════════════ */}
          {activeStep === 3 && (
            <View style={styles.stepContainer}>
              {currentTx ? (
                <>
                  {/* Status Transaksi Card */}
                  <View style={styles.statusMainCard}>
                    <View style={styles.statusBadgeWrap}>
                      {renderStatusBadge(currentTx.status)}
                    </View>

                    <Text style={styles.statusHeroTitle}>
                      {currentTx.status === "berhasil"
                        ? "Pembayaran Berhasil Diverifikasi!"
                        : currentTx.status === "ditolak"
                        ? "Pembayaran Ditolak"
                        : currentTx.status === "reversed"
                        ? "Crystal Ditarik Kembali"
                        : "Transaksi Sedang Diperiksa"}
                    </Text>

                    <Text style={styles.statusHeroSubtitle}>
                      {currentTx.status === "berhasil"
                        ? `Saldo Dylan Crystal telah ditambahkan ke akun Anda. Selamat menikmati fitur Nuenime!`
                        : currentTx.status === "ditolak"
                        ? `Alasan: ${currentTx.statusNote || "Bukti transfer tidak valid atau belum masuk ke rekening admin."}`
                        : currentTx.status === "reversed"
                        ? `Catatan Admin: ${currentTx.statusNote || "Crystal dari transaksi ini telah ditarik kembali oleh Admin Nuenime."}`
                        : "Dylan Crystal belum ditambahkan. Transaksi sedang menunggu verifikasi validitas oleh Admin Nuenime."}
                    </Text>

                    <View style={styles.summaryDivider} />

                    {/* Rincian Transaksi */}
                    <View style={styles.statusDetailGrid}>
                      <View style={styles.statusDetailRow}>
                        <Text style={styles.statusDetailLabel}>ID Transaksi</Text>
                        <Pressable
                          onPress={() =>
                            handleCopyText(currentTx.id, "activeTxId", "ID Transaksi")
                          }
                          style={styles.copyInlineBtn}
                        >
                          <Text style={styles.statusDetailValueBold}>{currentTx.id}</Text>
                          <AppIcon
                            name={copiedKey === "activeTxId" ? "check" : "content-copy"}
                            size={12}
                            color="#38BDF8"
                          />
                        </Pressable>
                      </View>

                      <View style={styles.statusDetailRow}>
                        <Text style={styles.statusDetailLabel}>Paket Crystal</Text>
                        <Text style={styles.statusDetailValue}>
                          {currentTx.crystalAmount.toLocaleString("id-ID")} Dylan Crystal (
                          {currentTx.packageName})
                        </Text>
                      </View>

                      <View style={styles.statusDetailRow}>
                        <Text style={styles.statusDetailLabel}>Metode Pembayaran</Text>
                        <Text style={styles.statusDetailValue}>
                          {currentTx.paymentMethod.toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.statusDetailRow}>
                        <Text style={styles.statusDetailLabel}>Total Pembayaran</Text>
                        <Text style={styles.statusDetailValueHighlight}>
                          Rp{currentTx.totalPayment.toLocaleString("id-ID")}
                        </Text>
                      </View>

                      <View style={styles.statusDetailRow}>
                        <Text style={styles.statusDetailLabel}>Tanggal Dibuat</Text>
                        <Text style={styles.statusDetailValue}>
                          {new Date(currentTx.createdAt).toLocaleString("id-ID")}
                        </Text>
                      </View>

                      {currentTx.verifiedAt && (
                        <View style={styles.statusDetailRow}>
                          <Text style={styles.statusDetailLabel}>Waktu Verifikasi</Text>
                          <Text style={styles.statusDetailValue}>
                            {new Date(currentTx.verifiedAt).toLocaleString("id-ID")}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* ─── TOMBOL TINDAKAN TAHAP 3 & KONTROL STATUS REAL ─── */}
                  <View style={styles.statusActionsWrap}>
                    {/* 1. Tombol Periksa Status Pembayaran (Real Database Check) */}
                    <Pressable
                      disabled={isCheckingStatus}
                      onPress={handleCheckPaymentStatus}
                      style={({ pressed }) => [
                        styles.checkStatusBtn,
                        isCheckingStatus && styles.checkStatusBtnLoading,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      {isCheckingStatus ? (
                        <>
                          <ActivityIndicator size="small" color="#38BDF8" />
                          <Text style={styles.checkStatusBtnText}>Memeriksa Status ke Server...</Text>
                        </>
                      ) : (
                        <>
                          <AppIcon name="refresh" size={18} color="#38BDF8" />
                          <Text style={styles.checkStatusBtnText}>Periksa Status Pembayaran</Text>
                        </>
                      )}
                    </Pressable>

                    {/* 2. Tombol Kirim Ulang Bukti via WhatsApp */}
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        openWhatsAppConfirmation(currentTx);
                      }}
                      style={({ pressed }) => [
                        styles.reopenWaBtn,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <AppIcon name="whatsapp" size={18} color="#FFFFFF" />
                      <Text style={styles.reopenWaBtnText}>Kirim Ulang Bukti via WhatsApp</Text>
                    </Pressable>

                    {/* 3. Penguncian Tahap 3: HANYA TAMPILKAN TOMBOL MULAI BARU KETIKA STATUS SUDAH FINAL */}
                    {hasActivePendingTx ? (
                      // Transaksi masih PENDING: KUNCI pembuatan transaksi baru!
                      <View style={styles.lockedNoticeBox}>
                        <View style={styles.lockedNoticeHeader}>
                          <AppIcon name="lock-outline" size={15} color="#F59E0B" />
                          <Text style={styles.lockedNoticeTitle}>
                            Tahap 3 Terkunci — Menunggu Verifikasi Admin
                          </Text>
                        </View>
                        <Text style={styles.lockedNoticeDesc}>
                          Transaksi sedang menunggu keputusan Admin Nuenime. Pilihan paket baru dikunci
                          untuk mencegah duplikasi transaksi. Tekan "Periksa Status Pembayaran" jika
                          Admin telah mengonfirmasi pembayaran Anda.
                        </Text>
                      </View>
                    ) : (
                      // Transaksi SUDAH FINAL (berhasil atau ditolak): BUKA PENGUNCIAN!
                      <Pressable
                        onPress={handleResetAndStartNew}
                        style={({ pressed }) => [
                          currentTx.status === "berhasil"
                            ? styles.startNewSuccessBtn
                            : styles.newTopupBtn,
                          pressed && styles.btnPressed,
                        ]}
                      >
                        <AppIcon
                          name={
                            currentTx.status === "berhasil"
                              ? "check-decagram"
                              : "plus-circle-outline"
                          }
                          size={18}
                          color="#FFFFFF"
                        />
                        <Text style={styles.startNewBtnText}>
                          {currentTx.status === "berhasil"
                            ? "Selesai & Mulai Top Up Baru"
                            : "Mulai Top Up Baru"}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </>
              ) : (
                <View style={styles.emptyStatusCard}>
                  <AppIcon name="receipt" size={32} color="#64748B" />
                  <Text style={styles.emptyStatusTitle}>Belum Ada Transaksi Aktif</Text>
                  <Text style={styles.emptyStatusDesc}>
                    Silakan pilih paket Crystal di Tahap 1 untuk memulai transaksi.
                  </Text>
                  <Pressable
                    onPress={() => setActiveStep(1)}
                    style={styles.emptyBackBtn}
                  >
                    <Text style={styles.emptyBackBtnText}>Pilih Paket Sekarang</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Bottom spacer */}
          <View style={{ height: 48 }} />
        </ScrollView>

        {/* ─── MODAL RIWAYAT TRANSAKSI ─── */}
        <Modal
          visible={showHistoryModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowHistoryModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleWrap}>
                  <AppIcon name="history" size={20} color="#38BDF8" />
                  <Text style={styles.modalTitleText}>Riwayat Transaksi Top Up</Text>
                </View>
                <Pressable
                  onPress={() => setShowHistoryModal(false)}
                  style={styles.modalCloseBtn}
                  hitSlop={10}
                >
                  <AppIcon name="close" size={20} color="#94A3B8" />
                </Pressable>
              </View>

              <ScrollView style={styles.modalListScroll} showsVerticalScrollIndicator={false}>
                {userTransactions.length === 0 ? (
                  <View style={styles.modalEmptyWrap}>
                    <Text style={styles.modalEmptyText}>Belum ada riwayat transaksi.</Text>
                  </View>
                ) : (
                  userTransactions.map((tx) => (
                    <Pressable
                      key={tx.id}
                      onPress={() => {
                        hapticLight();
                        setCurrentTx(tx);
                        setShowHistoryModal(false);
                        setActiveStep(3);
                      }}
                      style={styles.historyItemCard}
                    >
                      <View style={styles.historyItemTop}>
                        <Text style={styles.historyItemId}>{tx.id}</Text>
                        {renderStatusBadge(tx.status)}
                      </View>
                      <View style={styles.historyItemBottom}>
                        <Text style={styles.historyItemPkg}>
                          {tx.crystalAmount.toLocaleString("id-ID")} Crystal ({tx.packageName})
                        </Text>
                        <Text style={styles.historyItemPrice}>
                          Rp{tx.totalPayment.toLocaleString("id-ID")}
                        </Text>
                      </View>
                      <Text style={styles.historyItemDate}>
                        {new Date(tx.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
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
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },

  // ─── TOP HEADER BAR ───
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
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  balancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  balancePillIcon: {
    width: 16,
    height: 16,
  },
  balancePillText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#38BDF8",
  },

  // ─── INDIKATOR TAHAPAN PROGRESS BAR ───
  stepIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(11, 14, 23, 0.75)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepItemActive: {},
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleActive: {
    backgroundColor: "#38BDF8",
  },
  stepCircleDone: {
    backgroundColor: "#10B981",
  },
  stepCircleInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  stepNumber: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
  },
  stepNumberActive: {
    color: "#0B0E17",
  },
  stepNumberInactive: {
    color: "#94A3B8",
  },
  stepLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
  },
  stepLabelActive: {
    color: "#38BDF8",
  },
  stepLabelInactive: {
    color: "#64748B",
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    borderRadius: 1,
  },
  stepLineActive: {
    backgroundColor: "#38BDF8",
  },
  stepLineInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
  },
  stepContainer: {
    gap: 16,
  },

  // ─── NOTICE BANNER TAHAP 1 ───
  heroNoticeCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "rgba(18, 23, 34, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 6,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        } as any)
      : {}),
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 4,
    backgroundColor: "rgba(56, 189, 248, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  heroBadgeText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 9.5,
    color: "#38BDF8",
    letterSpacing: 0.6,
  },
  historyShortcutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
  },
  historyShortcutText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#38BDF8",
  },
  heroTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  heroDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#CBD5E1",
    lineHeight: 18,
  },

  // ─── 2 KARTU DALAM SATU BARIS ───
  packageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  packageCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(18, 23, 34, 0.85)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 6,
    position: "relative",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        } as any)
      : {}),
  },
  packageCardSelected: {
    borderColor: "#38BDF8",
    backgroundColor: "rgba(56, 189, 248, 0.1)",
  },
  tagBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  tagBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9,
    letterSpacing: 0.5,
  },
  crystalIconWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  crystalIcon: {
    width: 44,
    height: 44,
  },
  packageNameText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#94A3B8",
    textAlign: "center",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  amountNumber: {
    fontFamily: "Nunito-Black",
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  amountUnit: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 11,
    color: "#38BDF8",
  },
  pricePill: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  priceText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#F8FAFC",
  },

  footerInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(18, 23, 34, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  footerInfoText: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
  },

  // ─── INITIAL LOADING & SKELETON ───
  loadingContainerInitial: {
    width: "100%",
    gap: 12,
  },
  loadingHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
    marginBottom: 4,
  },
  loadingTextInitial: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#38BDF8",
  },
  packageCardSkeleton: {
    borderColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(18, 23, 34, 0.5)",
  },
  skeletonIconWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  skeletonBarTitle: {
    width: 50,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  skeletonBarAmount: {
    width: 76,
    height: 18,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    marginTop: 2,
  },
  skeletonBarPrice: {
    width: 68,
    height: 22,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginTop: 6,
  },
  emptyContainerInitial: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyTextInitial: {
    fontFamily: "Nunito-Medium",
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "#38BDF8",
  },
  retryBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#38BDF8",
  },

  // ─── TAHAP 2: RINGKASAN PESANAN ───
  summaryCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "rgba(18, 23, 34, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    gap: 10,
  },
  summaryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  summaryTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryCardTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  changePkgBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  changePkgBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#38BDF8",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
  },
  summaryValue: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#F1F5F9",
  },
  summaryIdText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 12,
    color: "#38BDF8",
  },
  copyInlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 4,
  },
  summaryTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryTotalLabel: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  summaryTotalValue: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#38BDF8",
  },

  // ─── TAHAP 2: PILIHAN METODE PEMBAYARAN ───
  sectionTitleRow: {
    gap: 2,
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  sectionSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  methodSelectorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  methodCard: {
    width: "48%",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(18, 23, 34, 0.85)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
    gap: 6,
  },
  methodCardSelected: {
    borderColor: "#38BDF8",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
  },
  methodCardDisabled: {
    opacity: 0.65,
  },
  methodCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  methodIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  methodIconBoxSelected: {
    backgroundColor: "rgba(56, 189, 248, 0.2)",
  },
  selectedDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#38BDF8",
    alignItems: "center",
    justifyContent: "center",
  },
  methodNameText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#E2E8F0",
  },
  methodNameTextSelected: {
    color: "#FFFFFF",
  },
  methodStatusBadge: {
    marginTop: 2,
  },
  methodStatusText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 9.5,
  },
  methodStatusAvailable: {
    color: "#10B981",
  },
  methodStatusUnavailable: {
    color: "#F59E0B",
  },

  // ─── TAHAP 2: DETAIL METODE PEMBAYARAN ───
  paymentDetailCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "rgba(18, 23, 34, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 14,
  },
  detailHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: 8,
  },
  detailCardTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14.5,
    color: "#FFFFFF",
  },

  // QRIS
  qrisContentWrap: {
    alignItems: "center",
    gap: 8,
  },
  qrisImageContainer: {
    width: 200,
    height: 200,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  qrisImage: {
    width: "100%",
    height: "100%",
  },
  qrisMerchantName: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  qrisTotalPay: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#38BDF8",
  },
  downloadQrisBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2563EB",
  },
  downloadQrisBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  // E-Wallet (ShopeePay, GoPay, DANA)
  ewalletContentWrap: {
    gap: 10,
  },
  ewalletInfoRow: {
    gap: 4,
  },
  ewalletInfoLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  ewalletInfoValue: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  copyTargetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ewalletNumberValue: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#38BDF8",
    letterSpacing: 0.5,
  },
  copySmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copySmallBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  ewalletTotalPay: {
    fontFamily: "Nunito-Black",
    fontSize: 17,
    color: "#38BDF8",
  },

  // Peringatan Belum Dikonfigurasi
  unconfiguredBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 10,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    gap: 8,
  },
  unconfiguredTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#F59E0B",
    textAlign: "center",
  },
  unconfiguredDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#CBD5E1",
    textAlign: "center",
    lineHeight: 17,
  },

  // Petunjuk
  instructionsContainer: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    gap: 6,
  },
  instructionsTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#F1F5F9",
  },
  stepList: {
    gap: 4,
  },
  stepText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
  },

  // Action Buttons Tahap 2
  actionBtnWrap: {
    gap: 8,
    marginTop: 4,
  },
  confirmActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#16A34A",
  },
  confirmActionBtnDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  confirmActionBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#FFFFFF",
  },
  cancelStepBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelStepBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },

  // ─── TAHAP 3: STATUS TRANSAKSI ───
  statusMainCard: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: "rgba(18, 23, 34, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 10,
  },
  statusBadgeWrap: {
    flexDirection: "row",
  },
  badgeBase: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeWarning: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  badgeProcessing: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  badgeSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  badgeDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  badgeReversed: {
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.4)",
  },
  badgeMuted: {
    backgroundColor: "rgba(148, 163, 184, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.4)",
  },
  badgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 10.5,
  },
  statusHeroTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 17,
    color: "#FFFFFF",
  },
  statusHeroSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#CBD5E1",
    lineHeight: 18,
  },
  statusDetailGrid: {
    gap: 8,
  },
  statusDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusDetailLabel: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
  },
  statusDetailValue: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#E2E8F0",
  },
  statusDetailValueBold: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#38BDF8",
  },
  statusDetailValueHighlight: {
    fontFamily: "Nunito-Black",
    fontSize: 14,
    color: "#38BDF8",
  },

  // Tombol Status Tahap 3
  statusActionsWrap: {
    gap: 10,
  },
  checkStatusBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    borderWidth: 1.5,
    borderColor: "#38BDF8",
  },
  checkStatusBtnLoading: {
    opacity: 0.8,
  },
  checkStatusBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#38BDF8",
  },
  reopenWaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#16A34A",
  },
  reopenWaBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  lockedNoticeBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    gap: 6,
  },
  lockedNoticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lockedNoticeTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#F59E0B",
  },
  lockedNoticeDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#CBD5E1",
    lineHeight: 16,
  },
  startNewSuccessBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#0284C7",
    borderWidth: 1,
    borderColor: "#38BDF8",
  },
  startNewBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  newTopupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  newTopupBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#38BDF8",
  },
  stepItemDisabled: {
    opacity: 0.45,
  },

  emptyStatusCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    borderRadius: 14,
    backgroundColor: "rgba(18, 23, 34, 0.8)",
    gap: 8,
  },
  emptyStatusTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  emptyStatusDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
  },
  emptyBackBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#38BDF8",
  },
  emptyBackBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#0B0E17",
  },

  // ─── MODAL RIWAYAT TRANSAKSI ───
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "80%",
    borderRadius: 16,
    backgroundColor: "#121722",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 16,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: 10,
  },
  modalTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalTitleText: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalListScroll: {
    maxHeight: 400,
  },
  modalEmptyWrap: {
    padding: 24,
    alignItems: "center",
  },
  modalEmptyText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
  },
  historyItemCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 6,
    marginBottom: 8,
  },
  historyItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyItemId: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#38BDF8",
  },
  historyItemBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyItemPkg: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  historyItemPrice: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#F8FAFC",
  },
  historyItemDate: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#64748B",
  },
});
