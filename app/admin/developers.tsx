import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AppIcon } from "@/components/app-icon";
import {
  type DeveloperMember,
  type SocialLink,
  getDevelopers,
  saveDevelopers,
  addDeveloper,
  updateDeveloper,
  deleteDeveloper,
  resetDevelopersToDefault,
} from "@/lib/developer-service";

const COLOR_PRESETS = [
  { label: "Silver", color: "#E2E8F0", bg: "rgba(226, 232, 240, 0.12)", border: "rgba(226, 232, 240, 0.3)" },
  { label: "Sky Blue", color: "#38BDF8", bg: "rgba(56, 189, 248, 0.15)", border: "rgba(56, 189, 248, 0.4)" },
  { label: "Violet", color: "#A78BFA", bg: "rgba(167, 139, 250, 0.15)", border: "rgba(167, 139, 250, 0.4)" },
  { label: "Gold", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.4)" },
  { label: "Emerald", color: "#10B981", bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.4)" },
  { label: "Rose", color: "#F43F5E", bg: "rgba(244, 63, 94, 0.15)", border: "rgba(244, 63, 94, 0.4)" },
];

export default function AdminDevelopersScreen() {
  const [developers, setDevelopers] = useState<DeveloperMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDev, setEditingDev] = useState<DeveloperMember | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formTag, setFormTag] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formAvatarUri, setFormAvatarUri] = useState("");
  const [formColorIndex, setFormColorIndex] = useState(0);
  const [formFacebook, setFormFacebook] = useState("");
  const [formInstagram, setFormInstagram] = useState("");
  const [formWebsite, setFormWebsite] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const list = await getDevelopers();
      setDevelopers(list);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingDev(null);
    setFormName("");
    setFormTag("");
    setFormRole("");
    setFormAvatarUri("");
    setFormColorIndex(0);
    setFormFacebook("");
    setFormInstagram("");
    setFormWebsite("");
    setIsModalOpen(true);
  };

  const openEditModal = (dev: DeveloperMember) => {
    setEditingDev(dev);
    setFormName(dev.name);
    setFormTag(dev.tag);
    setFormRole(dev.role);
    setFormAvatarUri(dev.avatarUri || "");

    const cIdx = COLOR_PRESETS.findIndex((p) => p.color.toLowerCase() === dev.accentColor.toLowerCase());
    setFormColorIndex(cIdx >= 0 ? cIdx : 0);

    const fb = dev.social.find((s) => s.icon === "facebook")?.url || "";
    const ig = dev.social.find((s) => s.icon === "instagram")?.url || "";
    const web = dev.social.find((s) => s.icon === "web")?.url || "";

    setFormFacebook(fb);
    setFormInstagram(ig);
    setFormWebsite(web);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      alert("Nama developer tidak boleh kosong!");
      return;
    }

    const preset = COLOR_PRESETS[formColorIndex] || COLOR_PRESETS[0];

    const social: SocialLink[] = [
      { icon: "facebook", label: "Facebook", url: formFacebook.trim() },
      { icon: "instagram", label: "Instagram", url: formInstagram.trim() },
      { icon: "web", label: "Website", url: formWebsite.trim() },
    ];

    try {
      if (editingDev) {
        // Update
        await updateDeveloper(editingDev.id, {
          name: formName.trim(),
          tag: formTag.trim(),
          role: formRole.trim(),
          avatarUri: formAvatarUri.trim() || undefined,
          accentColor: preset.color,
          badgeBg: preset.bg,
          badgeBorder: preset.border,
          social,
        });
        setFeedback(`Data developer "${formName.trim()}" berhasil diperbarui!`);
      } else {
        // Create
        await addDeveloper({
          name: formName.trim(),
          tag: formTag.trim(),
          role: formRole.trim(),
          avatarUri: formAvatarUri.trim() || undefined,
          accentColor: preset.color,
          badgeBg: preset.bg,
          badgeBorder: preset.border,
          social,
        });
        setFeedback(`Developer baru "${formName.trim()}" berhasil ditambahkan!`);
      }

      setIsModalOpen(false);
      await loadData();
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan data developer.");
    }
  };

  const handleDelete = async (dev: DeveloperMember) => {
    if (confirm(`Hapus developer "${dev.name}" dari tim?`)) {
      try {
        await deleteDeveloper(dev.id);
        setFeedback(`Developer "${dev.name}" telah dihapus.`);
        await loadData();
        setTimeout(() => setFeedback(null), 3500);
      } catch (err: any) {
        alert(err.message || "Gagal menghapus developer.");
      }
    }
  };

  const handleMoveOrder = async (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === developers.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const reordered = [...developers];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    setDevelopers(reordered);
    await saveDevelopers(reordered);
    setFeedback("Urutan tim developer berhasil diperbarui!");
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleResetToDefault = async () => {
    if (confirm("Reset daftar developer ke konfigurasi default (Valora & Nueva)?")) {
      const list = await resetDevelopersToDefault();
      setDevelopers(list);
      setFeedback("Daftar developer telah di-reset ke default.");
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  return (
    <AdminLayout activeKey="developers" title="Team Developer">
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Manajemen Tim Developer Nuenime</Text>
            <Text style={styles.subtitle}>
              Kelola profil perancang, pendiri, peran jabatan, tautan media sosial, serta urutan tampilan di aplikasi mobile.
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleResetToDefault}>
              <AppIcon name="refresh" size={14} color="#94A3B8" />
              <Text style={styles.resetBtnText}>Reset Default</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryBtn} onPress={openCreateModal}>
              <AppIcon name="plus" size={16} color="#0B0E17" />
              <Text style={styles.primaryBtnText}>Tambah Developer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Feedback Alert */}
        {feedback && (
          <View style={styles.feedbackBanner}>
            <AppIcon name="check-circle" size={18} color="#10B981" />
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{developers.length}</Text>
            <Text style={styles.statLabel}>Total Developer</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {developers.filter((d) => Boolean(d.avatarUri)).length}
            </Text>
            <Text style={styles.statLabel}>Dengan Foto Profil</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {developers.reduce(
                (acc, cur) => acc + cur.social.filter((s) => Boolean(s.url)).length,
                0
              )}
            </Text>
            <Text style={styles.statLabel}>Sosial Media Aktif</Text>
          </View>
        </View>

        {/* Developer List */}
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text style={styles.loadingText}>Memuat data tim developer...</Text>
          </View>
        ) : (
          <View style={styles.devList}>
            {developers.map((dev, idx) => (
              <View key={dev.id} style={styles.devCard}>
                {/* Order & Avatar */}
                <View style={styles.cardLeft}>
                  <View style={styles.orderControls}>
                    <TouchableOpacity
                      onPress={() => handleMoveOrder(idx, "up")}
                      disabled={idx === 0}
                      style={[styles.orderBtn, idx === 0 && { opacity: 0.3 }]}
                    >
                      <AppIcon name="chevron-up" size={16} color="#CBD5E1" />
                    </TouchableOpacity>
                    <Text style={styles.orderNum}>#{idx + 1}</Text>
                    <TouchableOpacity
                      onPress={() => handleMoveOrder(idx, "down")}
                      disabled={idx === developers.length - 1}
                      style={[
                        styles.orderBtn,
                        idx === developers.length - 1 && { opacity: 0.3 },
                      ]}
                    >
                      <AppIcon name="chevron-down" size={16} color="#CBD5E1" />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.avatarWrap, { borderColor: dev.accentColor }]}>
                    {dev.avatarUri ? (
                      <Image source={{ uri: dev.avatarUri }} style={styles.avatarImg} />
                    ) : (
                      <Text style={[styles.avatarInitial, { color: dev.accentColor }]}>
                        {dev.name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Details */}
                <View style={styles.cardCenter}>
                  <View style={styles.titleRow}>
                    <Text style={styles.devName}>{dev.name}</Text>
                    {dev.tag ? (
                      <View
                        style={[
                          styles.tagPill,
                          {
                            backgroundColor: dev.badgeBg || "rgba(255,255,255,0.08)",
                            borderColor: dev.badgeBorder || "rgba(255,255,255,0.2)",
                          },
                        ]}
                      >
                        <Text style={[styles.tagText, { color: dev.accentColor }]}>
                          {dev.tag}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.devRole}>{dev.role || "Anggota Tim"}</Text>

                  {/* Social links row */}
                  <View style={styles.socialRow}>
                    {dev.social.map((s) => (
                      <View
                        key={s.label}
                        style={[
                          styles.socialPill,
                          s.url ? styles.socialPillActive : styles.socialPillInactive,
                        ]}
                      >
                        <AppIcon
                          name={s.icon}
                          size={13}
                          color={s.url ? dev.accentColor : "#64748B"}
                        />
                        <Text
                          style={[
                            styles.socialPillText,
                            { color: s.url ? "#E2E8F0" : "#64748B" },
                          ]}
                        >
                          {s.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.cardRight}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => openEditModal(dev)}
                  >
                    <AppIcon name="pencil" size={15} color="#CBD5E1" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(dev)}
                  >
                    <AppIcon name="trash-can-outline" size={15} color="#F87171" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Modal Form */}
        <Modal
          visible={isModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={{ gap: 2 }}>
                  <Text style={styles.modalTitle}>
                    {editingDev ? "Edit Data Developer" : "Tambah Developer Baru"}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    Data ini akan langsung tersinkron ke halaman Pengaturan & Developer di aplikasi mobile.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setIsModalOpen(false)}
                >
                  <AppIcon name="close" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalForm}
                showsVerticalScrollIndicator={false}
              >
                {/* Nama */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Nama Developer <Text style={{ color: "#F87171" }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={formName}
                    onChangeText={setFormName}
                    placeholder="Contoh: Valora / Nueva / Kazuto"
                    placeholderTextColor="#64748B"
                  />
                </View>

                {/* Tag / Grup */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tag / Afiliasi Grup</Text>
                  <TextInput
                    style={styles.input}
                    value={formTag}
                    onChangeText={setFormTag}
                    placeholder="Contoh: Founder Valora Official Grup"
                    placeholderTextColor="#64748B"
                  />
                </View>

                {/* Jabatan / Peran */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Jabatan / Peran di Nuenime</Text>
                  <TextInput
                    style={[styles.input, { height: 72, textAlignVertical: "top" }]}
                    multiline
                    value={formRole}
                    onChangeText={setFormRole}
                    placeholder="Contoh: Perancang Nuenime, Desain Nuenime, Backend & Frontend"
                    placeholderTextColor="#64748B"
                  />
                </View>

                {/* Avatar URL */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>URL Foto Profil / Avatar</Text>
                  <TextInput
                    style={styles.input}
                    value={formAvatarUri}
                    onChangeText={setFormAvatarUri}
                    placeholder="https://i.ibb.co.com/... atau link gambar langsung"
                    placeholderTextColor="#64748B"
                  />
                </View>

                {/* Color Preset */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Warna Aksen Profil</Text>
                  <View style={styles.presetRow}>
                    {COLOR_PRESETS.map((p, idx) => (
                      <TouchableOpacity
                        key={p.label}
                        onPress={() => setFormColorIndex(idx)}
                        style={[
                          styles.presetPill,
                          formColorIndex === idx && {
                            borderColor: p.color,
                            backgroundColor: p.bg,
                          },
                        ]}
                      >
                        <View style={[styles.presetDot, { backgroundColor: p.color }]} />
                        <Text style={[styles.presetText, { color: p.color }]}>
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Media Sosial */}
                <Text style={styles.sectionHeading}>Tautan Media Sosial (Opsional)</Text>

                <View style={styles.fieldGroup}>
                  <View style={styles.socialLabelRow}>
                    <AppIcon name="facebook" size={14} color="#38BDF8" />
                    <Text style={styles.fieldLabel}>Facebook Profile / Page</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={formFacebook}
                    onChangeText={setFormFacebook}
                    placeholder="https://facebook.com/..."
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <View style={styles.socialLabelRow}>
                    <AppIcon name="instagram" size={14} color="#F43F5E" />
                    <Text style={styles.fieldLabel}>Instagram</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={formInstagram}
                    onChangeText={setFormInstagram}
                    placeholder="https://instagram.com/..."
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <View style={styles.socialLabelRow}>
                    <AppIcon name="web" size={14} color="#10B981" />
                    <Text style={styles.fieldLabel}>Website Pribadi</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={formWebsite}
                    onChangeText={setFormWebsite}
                    placeholder="https://example.com"
                    placeholderTextColor="#64748B"
                  />
                </View>

                {/* Live Preview Card */}
                <View style={styles.previewBox}>
                  <Text style={styles.previewTitle}>PREVIEW TAMPILAN APLIKASI</Text>
                  <View
                    style={[
                      styles.previewCard,
                      {
                        borderColor:
                          COLOR_PRESETS[formColorIndex]?.border ||
                          "rgba(255,255,255,0.18)",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.previewAvatar,
                        {
                          borderColor:
                            COLOR_PRESETS[formColorIndex]?.color || "#E2E8F0",
                        },
                      ]}
                    >
                      {formAvatarUri ? (
                        <Image
                          source={{ uri: formAvatarUri }}
                          style={{ width: "100%", height: "100%", borderRadius: 30 }}
                        />
                      ) : (
                        <Text
                          style={{
                            color:
                              COLOR_PRESETS[formColorIndex]?.color || "#E2E8F0",
                            fontFamily: "Nunito-Bold",
                            fontSize: 18,
                          }}
                        >
                          {(formName || "D").charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.previewName}>{formName || "Nama Developer"}</Text>
                      <Text
                        style={[
                          styles.previewTag,
                          {
                            color:
                              COLOR_PRESETS[formColorIndex]?.color || "#E2E8F0",
                          },
                        ]}
                      >
                        {formTag || "Founder / Designer"}
                      </Text>
                      <Text style={styles.previewRole}>
                        {formRole || "Perancang sistem Nuenime"}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsModalOpen(false)}
                >
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <AppIcon name="check" size={16} color="#0B0E17" />
                  <Text style={styles.saveBtnText}>Simpan Developer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
  },
  title: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#94A3B8",
    maxWidth: 620,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  resetBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#CBD5E1",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#38BDF8",
  },
  primaryBtnText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 13,
    color: "#0B0E17",
  },
  feedbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  feedbackText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#10B981",
  },
  statsRow: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
    gap: 4,
  },
  statNumber: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 24,
    color: "#FFFFFF",
  },
  statLabel: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#94A3B8",
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 13,
    color: "#94A3B8",
  },
  devList: {
    gap: 14,
  },
  devCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    padding: 16,
    gap: 16,
    flexWrap: "wrap",
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  orderControls: {
    alignItems: "center",
    gap: 2,
  },
  orderBtn: {
    padding: 3,
  },
  orderNum: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarInitial: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 22,
  },
  cardCenter: {
    flex: 1,
    minWidth: 240,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  devName: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 17,
    color: "#FFFFFF",
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
  },
  devRole: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#CBD5E1",
    lineHeight: 18,
  },
  socialRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },
  socialPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  socialPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  socialPillInactive: {
    backgroundColor: "transparent",
    borderColor: "rgba(255, 255, 255, 0.06)",
    opacity: 0.6,
  },
  socialPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
  },
  cardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  editBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "90%",
    backgroundColor: "#121622",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  modalTitle: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 18,
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    maxWidth: 480,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  modalScroll: {
    paddingHorizontal: 22,
  },
  modalForm: {
    paddingVertical: 18,
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#CBD5E1",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#FFFFFF",
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  presetPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  presetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  presetText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
  },
  sectionHeading: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  socialLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewBox: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 14,
    gap: 10,
    marginTop: 8,
  },
  previewTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#94A3B8",
    letterSpacing: 1,
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  previewAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  previewName: {
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  previewTag: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
  },
  previewRole: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  cancelBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#CBD5E1",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#38BDF8",
  },
  saveBtnText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 13,
    color: "#0B0E17",
  },
});
