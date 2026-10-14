import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import {
  type AdminUser,
  type GachaConfig,
  getAdminGachaConfig,
  saveAdminGachaConfig,
  logAdminAction,
} from "@/lib/admin-service";

export default function AdminGachaScreen() {
  const [loading, setLoading] = useState(true);
  const [gachaConfig, setGachaConfig] = useState<GachaConfig | null>(null);
  const [saving, setSaving] = useState(false);

  // Mailbox mass gift
  const [giftTitle, setGiftTitle] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftType, setGiftType] = useState<"crystal" | "border">("crystal");
  const [giftValue, setGiftValue] = useState("100");
  const [showGiftConfirm, setShowGiftConfirm] = useState(false);
  const [sendingGift, setSendingGift] = useState(false);

  const mockAdmin: AdminUser = {
    id: "admin-super",
    email: "superadmin@nuenime.com",
    username: "Super Admin",
    role: "super_admin",
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const cfg = await getAdminGachaConfig();
      setGachaConfig(cfg);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveGacha = async () => {
    if (!gachaConfig) return;
    setSaving(true);
    await saveAdminGachaConfig(gachaConfig, mockAdmin);
    setSaving(false);
    hapticSuccess();
    Alert.alert("Tersimpan", "Pengaturan gacha dan banner berhasil diperbarui.");
  };

  const handleSendMassGift = async () => {
    if (!giftTitle.trim() || !giftMessage.trim()) {
      Alert.alert("Input Kosong", "Judul dan pesan hadiah wajib diisi.");
      return;
    }

    setSendingGift(true);
    await logAdminAction({
      admin: mockAdmin,
      action: "SEND_MASS_GIFT",
      targetType: "all_users",
      targetId: "broadcast_gift",
      details: {
        title: giftTitle,
        message: giftMessage,
        type: giftType,
        value: giftValue,
      },
    });
    setSendingGift(false);
    setShowGiftConfirm(false);
    setGiftTitle("");
    setGiftMessage("");
    hapticSuccess();
    Alert.alert("Hadiah Terkirim 🎉", "Hadiah massal berhasil dikirimkan ke kotak masuk seluruh pemain.");
  };

  return (
    <AdminLayout
      title="Gacha & Crystal Store"
      subtitle="Pengaturan banner gacha, biaya spin Dylan Crystal, peluang drop rate, dan hadiah massal"
    >
      {loading ? (
        <ActivityIndicator size="small" color="#8C57FF" style={{ padding: 40 }} />
      ) : (
        <View style={styles.contentWrap}>
          {/* ─── KARTU PENGATURAN BANNER & BIAYA ─── */}
          <View style={styles.cardBox}>
            <Text style={styles.cardBoxTitle}>Banner & Biaya Spin Gacha</Text>
            {gachaConfig && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Judul Banner Gacha:</Text>
                  <TextInput
                    value={gachaConfig.bannerTitle}
                    onChangeText={(t) => setGachaConfig({ ...gachaConfig, bannerTitle: t })}
                    style={styles.fieldInput}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Deskripsi Banner:</Text>
                  <TextInput
                    value={gachaConfig.bannerDesc}
                    onChangeText={(t) => setGachaConfig({ ...gachaConfig, bannerDesc: t })}
                    style={styles.fieldInput}
                  />
                </View>

                <View style={styles.rowTwoCols}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Biaya 1x Spin (Crystal):</Text>
                    <TextInput
                      value={String(gachaConfig.costSingle)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({ ...gachaConfig, costSingle: parseInt(t, 10) || 100 })
                      }
                      style={styles.fieldInput}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Biaya 10x Spin (Crystal):</Text>
                    <TextInput
                      value={String(gachaConfig.costMulti)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({ ...gachaConfig, costMulti: parseInt(t, 10) || 900 })
                      }
                      style={styles.fieldInput}
                    />
                  </View>
                </View>

                <View style={styles.formDivider} />
                <Text style={styles.subTitle}>Peluang Drop Rate Per Rarity (%):</Text>

                <View style={styles.ratesGrid}>
                  <View style={styles.rateBox}>
                    <Text style={[styles.rateLabel, { color: "#EC4899" }]}>Mythic (%)</Text>
                    <TextInput
                      value={String(gachaConfig.rates.mythic)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({
                          ...gachaConfig,
                          rates: { ...gachaConfig.rates, mythic: parseFloat(t) || 1 },
                        })
                      }
                      style={styles.fieldInputSmall}
                    />
                  </View>

                  <View style={styles.rateBox}>
                    <Text style={[styles.rateLabel, { color: "#F59E0B" }]}>Legends (%)</Text>
                    <TextInput
                      value={String(gachaConfig.rates.legends)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({
                          ...gachaConfig,
                          rates: { ...gachaConfig.rates, legends: parseFloat(t) || 4 },
                        })
                      }
                      style={styles.fieldInputSmall}
                    />
                  </View>

                  <View style={styles.rateBox}>
                    <Text style={[styles.rateLabel, { color: "#A855F7" }]}>Epic (%)</Text>
                    <TextInput
                      value={String(gachaConfig.rates.epic)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({
                          ...gachaConfig,
                          rates: { ...gachaConfig.rates, epic: parseFloat(t) || 15 },
                        })
                      }
                      style={styles.fieldInputSmall}
                    />
                  </View>

                  <View style={styles.rateBox}>
                    <Text style={[styles.rateLabel, { color: "#3B82F6" }]}>Rare (%)</Text>
                    <TextInput
                      value={String(gachaConfig.rates.rare)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({
                          ...gachaConfig,
                          rates: { ...gachaConfig.rates, rare: parseFloat(t) || 35 },
                        })
                      }
                      style={styles.fieldInputSmall}
                    />
                  </View>

                  <View style={styles.rateBox}>
                    <Text style={[styles.rateLabel, { color: "#10B981" }]}>Normal (%)</Text>
                    <TextInput
                      value={String(gachaConfig.rates.normal)}
                      keyboardType="numeric"
                      onChangeText={(t) =>
                        setGachaConfig({
                          ...gachaConfig,
                          rates: { ...gachaConfig.rates, normal: parseFloat(t) || 45 },
                        })
                      }
                      style={styles.fieldInputSmall}
                    />
                  </View>
                </View>

                <Pressable
                  disabled={saving}
                  onPress={handleSaveGacha}
                  style={styles.saveBtn}
                >
                  <AppIcon name="content-save-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>
                    {saving ? "Menyimpan..." : "Simpan Pengaturan Gacha"}
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          {/* ─── KARTU MAILBOX / HADIAH MASSAL ─── */}
          <View style={styles.cardBox}>
            <Text style={styles.cardBoxTitle}>🎁 Kirim Hadiah Massal (Mailbox Broadcast)</Text>
            <Text style={styles.cardBoxSubtitle}>
              Kirimkan Dylan Crystal atau Border gratis kepada seluruh pengguna aplikasi untuk
              perayaan event atau kompensasi maintenance.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Judul Hadiah:</Text>
              <TextInput
                value={giftTitle}
                onChangeText={setGiftTitle}
                placeholder="Contoh: Hadiah Spesial Perayaan Rilis Nuenime v0.0.1"
                placeholderTextColor="#64748B"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Pesan untuk Pengguna:</Text>
              <TextInput
                value={giftMessage}
                onChangeText={setGiftMessage}
                placeholder="Terima kasih atas dukungan Anda menonton anime di Nuenime!"
                placeholderTextColor="#64748B"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.rowTwoCols}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Jenis Hadiah:</Text>
                <View style={styles.giftTypeRow}>
                  <Pressable
                    onPress={() => setGiftType("crystal")}
                    style={[styles.giftTypeBtn, giftType === "crystal" && styles.giftTypeBtnActive]}
                  >
                    <Text style={styles.giftTypeBtnText}>Crystal</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setGiftType("border")}
                    style={[styles.giftTypeBtn, giftType === "border" && styles.giftTypeBtnActive]}
                  >
                    <Text style={styles.giftTypeBtnText}>Border Avatar</Text>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>
                  {giftType === "crystal" ? "Jumlah Crystal:" : "ID Border Avatar:"}
                </Text>
                <TextInput
                  value={giftValue}
                  onChangeText={setGiftValue}
                  placeholder={giftType === "crystal" ? "100" : "rare_06"}
                  placeholderTextColor="#64748B"
                  style={styles.fieldInput}
                />
              </View>
            </View>

            <Pressable
              onPress={() => setShowGiftConfirm(true)}
              style={styles.sendGiftBtn}
            >
              <AppIcon name="gift-outline" size={18} color="#FFFFFF" />
              <Text style={styles.sendGiftBtnText}>Kirim Hadiah ke Semua Pemain</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ─── MODAL KONFIRMASI HADIAH MASSAL ─── */}
      <Modal visible={showGiftConfirm} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Konfirmasi Pengiriman Hadiah Massal</Text>
            <Text style={styles.modalSub}>
              Hadiah akan didistribusikan ke seluruh akun pengguna aktif Nuenime:
              {"\n"}• Judul: {giftTitle}
              {"\n"}• Hadiah: {giftValue} {giftType === "crystal" ? "Dylan Crystal" : "Border ID"}
            </Text>
            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setShowGiftConfirm(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                disabled={sendingGift}
                onPress={handleSendMassGift}
                style={styles.modalConfirmBtn}
              >
                <Text style={styles.modalConfirmText}>
                  {sendingGift ? "Mengirim..." : "Ya, Kirim Sekarang"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  contentWrap: {
    gap: 20,
  },
  cardBox: {
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 14,
  },
  cardBoxTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  cardBoxSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 16,
  },
  formGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#CBD5E1",
  },
  fieldInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  fieldInputSmall: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    textAlign: "center",
  },
  rowTwoCols: {
    flexDirection: "row",
    gap: 12,
  },
  formDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 4,
  },
  subTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 13.5,
    color: "#E2E8F0",
  },
  ratesGrid: {
    flexDirection: "row",
    gap: 8,
  },
  rateBox: {
    flex: 1,
    padding: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 8,
    alignItems: "center",
    gap: 6,
  },
  rateLabel: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#8C57FF",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 6,
  },
  saveBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  giftTypeRow: {
    flexDirection: "row",
    gap: 6,
  },
  giftTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
  },
  giftTypeBtnActive: {
    backgroundColor: "#8C57FF",
  },
  giftTypeBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  sendGiftBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 6,
  },
  sendGiftBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#211D36",
    borderRadius: 14,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  modalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
  },
  modalSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 18,
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  modalCancelText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  modalConfirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#10B981",
  },
  modalConfirmText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
});
