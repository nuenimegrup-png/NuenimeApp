import { useState } from "react";
import {
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
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

// Aset Resmi yang dikirim User
const TOPUP_BG = require("@/assets/images/topup/topup-bg.jpg");
const TOPUP_CRYSTAL = require("@/assets/images/topup/topup-crystal.png");

export interface CrystalPackage {
  id: string;
  name: string;
  amount: number;
  amountFormatted: string;
  priceFormatted: string;
  tag?: string;
  tagColor?: string;
}

export const CRYSTAL_PACKAGES: CrystalPackage[] = [
  {
    id: "starter",
    name: "Starter",
    amount: 1500,
    amountFormatted: "1.500",
    priceFormatted: "Rp1.500",
  },
  {
    id: "basic",
    name: "Basic",
    amount: 3000,
    amountFormatted: "3.000",
    priceFormatted: "Rp3.000",
  },
  {
    id: "standard",
    name: "Standard",
    amount: 5000,
    amountFormatted: "5.000",
    priceFormatted: "Rp5.000",
    tag: "POPULER",
    tagColor: "#38BDF8",
  },
  {
    id: "advanced",
    name: "Advanced",
    amount: 10000,
    amountFormatted: "10.000",
    priceFormatted: "Rp10.000",
  },
  {
    id: "premium",
    name: "Premium",
    amount: 25000,
    amountFormatted: "25.000",
    priceFormatted: "Rp25.000",
    tag: "HEMAT",
    tagColor: "#F59E0B",
  },
  {
    id: "ultimate",
    name: "Ultimate",
    amount: 50000,
    amountFormatted: "50.000",
    priceFormatted: "Rp50.000",
    tag: "TERBAIK",
    tagColor: "#A855F7",
  },
];

export default function TopUpScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const [selectedPkg, setSelectedPkg] = useState<CrystalPackage | null>(null);

  // 2 kartu dalam 1 baris (padding 16px di kiri-kanan = 32px, gap 12px antar kartu)
  const cardWidth = Math.floor((Math.min(windowWidth, 600) - 32 - 12) / 2);

  const handleCardPress = (pkg: CrystalPackage) => {
    hapticLight();
    setSelectedPkg(pkg);
  };

  return (
    <View style={styles.root}>
      {/* ─── 1. BACKGROUND GAMBAR DARI USER (TEMPEL KUDUS BERBINTANG) ─── */}
      <Image
        source={TOPUP_BG}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={200}
      />

      {/* Dark overlay gradasi halus untuk keterbacaan teks maksimal */}
      <LinearGradient
        colors={[
          "rgba(11, 14, 23, 0.70)",
          "rgba(11, 14, 23, 0.84)",
          "rgba(11, 14, 23, 0.94)",
        ]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeContainer}>
        {/* ─── 2. TOP APP BAR: TOMBOL KEMBALI & JUDUL ─── */}
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
            <Text style={styles.titleText}>Top Up Crystal</Text>
          </View>

          {/* Saldo Saat Ini di Header */}
          <View style={styles.balancePill}>
            <Image source={TOPUP_CRYSTAL} style={styles.balancePillIcon} contentFit="contain" />
            <Text style={styles.balancePillText}>0</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── 3. SUBTITLE / NOTICE BANNER ─── */}
          <View style={styles.heroNoticeCard}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>DYLAN CRYSTAL STORE</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>Pilih Paket Crystal</Text>
            <Text style={styles.heroDesc}>
              Gunakan Dylan Crystal untuk spin wallpaper istimewa, membuka efek profil, dan memasang avatar border eksklusif.
            </Text>
          </View>

          {/* ─── 4. DAFTAR PAKET: 2 KARTU DALAM SATU BARIS ─── */}
          <View style={styles.packageGrid}>
            {CRYSTAL_PACKAGES.map((pkg) => {
              return (
                <Pressable
                  key={pkg.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Paket ${pkg.name}, ${pkg.amountFormatted} Crystal, harga ${pkg.priceFormatted}`}
                  onPress={() => handleCardPress(pkg)}
                  style={({ pressed }) => [
                    { width: cardWidth },
                    styles.packageCard,
                    pressed && styles.cardPressed,
                  ]}
                >
                  {/* Tag Opsional di Sudut Atas (misal: POPULER / HEMAT / TERBAIK) */}
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

                  {/* Ikon Crystal Resmi di Bagian Atas */}
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

                  {/* Jumlah Crystal di Bawah Ikon */}
                  <View style={styles.amountRow}>
                    <Text style={styles.amountNumber}>{pkg.amountFormatted}</Text>
                    <Text style={styles.amountUnit}>Crystal</Text>
                  </View>

                  {/* Harga Rupiah di Bagian Bawah */}
                  <View style={styles.pricePill}>
                    <Text style={styles.priceText}>{pkg.priceFormatted}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Catatan / Keterangan Pembayaran */}
          <View style={styles.footerInfoBox}>
            <AppIcon name="information-outline" size={16} color="#64748B" />
            <Text style={styles.footerInfoText}>
              Crystal akan langsung ditambahkan ke saldo akun Nuenime setelah proses verifikasi selesai.
            </Text>
          </View>

          {/* Bottom spacer */}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ─── 5. MODAL DETAIL / KONFIRMASI PAKET ─── */}
        <Modal
          visible={selectedPkg !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedPkg(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleWrap}>
                  <Image
                    source={TOPUP_CRYSTAL}
                    style={{ width: 24, height: 24 }}
                    contentFit="contain"
                  />
                  <Text style={styles.modalTitleText}>Detail Paket Top Up</Text>
                </View>
                <Pressable
                  onPress={() => setSelectedPkg(null)}
                  style={styles.modalCloseBtn}
                  hitSlop={10}
                >
                  <AppIcon name="close" size={20} color="#94A3B8" />
                </Pressable>
              </View>

              {selectedPkg ? (
                <View style={styles.modalBody}>
                  <View style={styles.modalHeroIconWrap}>
                    <Image
                      source={TOPUP_CRYSTAL}
                      style={styles.modalHeroCrystal}
                      contentFit="contain"
                    />
                  </View>

                  <Text style={styles.modalPkgName}>Paket {selectedPkg.name}</Text>
                  <Text style={styles.modalPkgAmount}>
                    {selectedPkg.amountFormatted} Dylan Crystal
                  </Text>

                  <View style={styles.modalPriceRow}>
                    <Text style={styles.modalPriceLabel}>Total Pembayaran:</Text>
                    <Text style={styles.modalPriceValue}>{selectedPkg.priceFormatted}</Text>
                  </View>

                  <View style={styles.comingSoonBox}>
                    <Text style={styles.comingSoonTitle}>Metode Pembayaran</Text>
                    <Text style={styles.comingSoonDesc}>
                      Integrasi gateway pembayaran (QRIS, E-Wallet & Bank Transfer) akan segera tersedia pada pembaruan berikutnya.
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      hapticSuccess();
                      setSelectedPkg(null);
                    }}
                    style={({ pressed }) => [
                      styles.modalActionBtn,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <Text style={styles.modalActionBtnText}>TUTUP</Text>
                  </Pressable>
                </View>
              ) : null}
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
    fontSize: 21,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  balancePill: {
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
  balancePillIcon: {
    width: 16,
    height: 16,
  },
  balancePillText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#38BDF8",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },

  // ─── NOTICE BANNER ───
  heroNoticeCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "rgba(18, 23, 34, 0.82)",
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
    fontSize: 8.5,
    letterSpacing: 0.4,
  },
  crystalIconWrap: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  crystalIcon: {
    width: 54,
    height: 54,
  },
  packageNameText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 4,
  },
  amountNumber: {
    fontFamily: "Nunito-Black",
    fontSize: 18,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  amountUnit: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#38BDF8",
  },
  pricePill: {
    width: "100%",
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  priceText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#38BDF8",
    letterSpacing: -0.2,
  },

  // ─── FOOTER INFO BOX ───
  footerInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  footerInfoText: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    lineHeight: 16,
  },

  // ─── MODAL STYLES ───
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: "#121622",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitleText: {
    fontFamily: "Nunito-Black",
    fontSize: 17,
    color: "#FFFFFF",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    alignItems: "center",
    gap: 8,
  },
  modalHeroIconWrap: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  modalHeroCrystal: {
    width: 72,
    height: 72,
  },
  modalPkgName: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  modalPkgAmount: {
    fontFamily: "Nunito-Black",
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  modalPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginTop: 6,
  },
  modalPriceLabel: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 13,
    color: "#94A3B8",
  },
  modalPriceValue: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#38BDF8",
  },
  comingSoonBox: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    gap: 4,
    marginTop: 6,
  },
  comingSoonTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#F59E0B",
    letterSpacing: 0.3,
  },
  comingSoonDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#CBD5E1",
    lineHeight: 16,
  },
  modalActionBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#38BDF8",
    marginTop: 8,
  },
  modalActionBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#0B0E17",
    letterSpacing: 0.5,
  },
});
