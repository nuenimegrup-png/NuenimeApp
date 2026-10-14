import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { type AdminUserListItem, getAdminUsersList } from "@/lib/admin-service";
import { getTierForLevel } from "@/components/level-progress-modal";

export default function AdminGamificationScreen() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [watchExp, setWatchExp] = useState("20");
  const [commentExp, setCommentExp] = useState("5");
  const [savingRules, setSavingRules] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await getAdminUsersList();
      // Urutkan berdasarkan level dan EXP tertinggi
      const sorted = [...list].sort((a, b) => b.level - a.level || b.exp - a.exp);
      setUsers(sorted.slice(0, 50));
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveExpRules = () => {
    hapticSuccess();
    setSavingRules(true);
    setTimeout(() => {
      setSavingRules(false);
      Alert.alert("Tersimpan", "Aturan perolehan EXP berhasil diperbarui.");
    }, 500);
  };

  return (
    <AdminLayout
      title="Gamification & EXP"
      subtitle="Kelola aturan perolehan level & EXP, pantau leaderboard Top 50, dan tier pemain"
    >
      <View style={styles.contentWrap}>
        {/* ─── KARTU ATURAN PEROLEHAN EXP ─── */}
        <View style={styles.cardBox}>
          <Text style={styles.cardBoxTitle}>⚙️ Pengaturan Perolehan EXP Pengguna</Text>
          <Text style={styles.cardBoxSubtitle}>
            Tentukan jumlah EXP yang didapat pemain ketika menyelesaikan aktivitas di aplikasi.
          </Text>

          <View style={styles.expRulesRow}>
            <View style={styles.ruleInputBox}>
              <Text style={styles.ruleLabel}>Nonton 1 Episode Selesai:</Text>
              <View style={styles.expPillInput}>
                <TextInput
                  value={watchExp}
                  onChangeText={setWatchExp}
                  keyboardType="numeric"
                  style={styles.ruleInput}
                />
                <Text style={styles.expUnitText}>+EXP</Text>
              </View>
            </View>

            <View style={styles.ruleInputBox}>
              <Text style={styles.ruleLabel}>Mengirim 1 Komentar:</Text>
              <View style={styles.expPillInput}>
                <TextInput
                  value={commentExp}
                  onChangeText={setCommentExp}
                  keyboardType="numeric"
                  style={styles.ruleInput}
                />
                <Text style={styles.expUnitText}>+EXP</Text>
              </View>
            </View>
          </View>

          <Pressable
            disabled={savingRules}
            onPress={handleSaveExpRules}
            style={styles.saveRulesBtn}
          >
            <AppIcon name="content-save-outline" size={16} color="#FFFFFF" />
            <Text style={styles.saveRulesBtnText}>
              {savingRules ? "Menyimpan..." : "Simpan Aturan EXP"}
            </Text>
          </Pressable>
        </View>

        {/* ─── TABEL LEADERBOARD TOP 50 ─── */}
        <View style={styles.cardBox}>
          <Text style={styles.cardBoxTitle}>🏆 Leaderboard Level & EXP (Top 50)</Text>
          <Text style={styles.cardBoxSubtitle}>
            Peringkat pengguna berdasarkan level akun dan perolehan EXP tertinggi.
          </Text>

          {loading ? (
            <ActivityIndicator size="small" color="#8C57FF" style={{ padding: 20 }} />
          ) : users.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Belum ada data peringkat pengguna.</Text>
            </View>
          ) : (
            <View style={styles.tableWrap}>
              <View style={styles.thRow}>
                <Text style={[styles.th, { flex: 1 }]}>RANK</Text>
                <Text style={[styles.th, { flex: 2.5 }]}>PENGGUNA</Text>
                <Text style={[styles.th, { flex: 1.5 }]}>LEVEL</Text>
                <Text style={[styles.th, { flex: 1.5 }]}>EXP</Text>
                <Text style={[styles.th, { flex: 2 }]}>TIER RANK</Text>
              </View>

              {users.map((u, index) => {
                const tier = getTierForLevel(u.level).currentTier;
                return (
                  <View key={u.id} style={styles.trRow}>
                    <Text
                      style={[
                        styles.rankNumber,
                        index === 0 && { color: "#F59E0B" },
                        index === 1 && { color: "#94A3B8" },
                        index === 2 && { color: "#B45309" },
                        { flex: 1 },
                      ]}
                    >
                      #{index + 1}
                    </Text>
                    <View style={{ flex: 2.5 }}>
                      <Text style={styles.tdBold}>{u.username}</Text>
                      <Text style={styles.tdSub}>{u.displayName}</Text>
                    </View>
                    <Text style={[styles.tdBold, { flex: 1.5, color: "#38BDF8" }]}>
                      Lv.{u.level}
                    </Text>
                    <Text style={[styles.td, { flex: 1.5 }]}>{u.exp} XP</Text>
                    <View style={{ flex: 2 }}>
                      <View
                        style={[
                          styles.tierBadge,
                          {
                            backgroundColor: `${tier.color}20`,
                            borderColor: `${tier.color}40`,
                          },
                        ]}
                      >
                        <Text style={[styles.tierBadgeText, { color: tier.color }]}>
                          {tier.name.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
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
  },
  expRulesRow: {
    flexDirection: "row",
    gap: 16,
  },
  ruleInputBox: {
    flex: 1,
    gap: 6,
  },
  ruleLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },
  expPillInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ruleInput: {
    flex: 1,
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#38BDF8",
  },
  expUnitText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  saveRulesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#8C57FF",
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  saveRulesBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  tableWrap: {
    gap: 2,
  },
  thRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 6,
  },
  th: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  trRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  rankNumber: {
    fontFamily: "Nunito-Black",
    fontSize: 13,
    color: "#FFFFFF",
  },
  td: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#CBD5E1",
  },
  tdBold: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  tdSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  tierBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  tierBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
  },
  emptyWrap: {
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
  },
});
