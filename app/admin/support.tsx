import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Image,
} from "react-native";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  type AdminUser,
  type SupportTicket,
  type SupportTicketMessage,
  getAdminSupportTickets,
  getSupportTicketMessages,
  sendAdminTicketReply,
  updateSupportTicketStatus,
} from "@/lib/admin-service";
import {
  type SupportConfig,
  getSupportConfig,
  saveSupportConfig,
  resetSupportConfigToDefault,
} from "@/lib/support-service";
import { AppIcon } from "@/components/app-icon";

export default function AdminSupportScreen() {
  const [activeTab, setActiveTab] = useState<"settings" | "tickets">("settings");

  // ── Support Settings State ──
  const [supportConfig, setSupportConfig] = useState<SupportConfig | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Editable Form fields
  const [formSaweriaUrl, setFormSaweriaUrl] = useState("");
  const [formSaweriaActive, setFormSaweriaActive] = useState(true);
  const [formHeroGifUrl, setFormHeroGifUrl] = useState("");
  const [formThankYouGifUrl, setFormThankYouGifUrl] = useState("");
  const [formHeadlineBadge, setFormHeadlineBadge] = useState("");
  const [formHeadlineTitle, setFormHeadlineTitle] = useState("");
  const [formHeadlineSubtitle, setFormHeadlineSubtitle] = useState("");
  const [formSaweriaTitle, setFormSaweriaTitle] = useState("");
  const [formSaweriaDescription, setFormSaweriaDescription] = useState("");
  const [formFootnote, setFormFootnote] = useState("");
  const [formPerks, setFormPerks] = useState<Array<{ icon: string; text: string }>>([]);
  const [newPerkText, setNewPerkText] = useState("");

  // ── Tickets State ──
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isTicketsLoading, setIsTicketsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [feedback, setFeedback] = useState<string | null>(null);

  const currentAdmin: AdminUser = {
    id: "admin-cs",
    email: "cs@nuenime.com",
    username: "Customer Care",
    role: "super_admin",
  };

  // Load Config
  const loadConfig = async () => {
    setIsConfigLoading(true);
    try {
      const cfg = await getSupportConfig();
      setSupportConfig(cfg);
      setFormSaweriaUrl(cfg.saweriaUrl);
      setFormSaweriaActive(cfg.saweriaActive);
      setFormHeroGifUrl(cfg.heroGifUrl);
      setFormThankYouGifUrl(cfg.thankYouGifUrl);
      setFormHeadlineBadge(cfg.headlineBadge);
      setFormHeadlineTitle(cfg.headlineTitle);
      setFormHeadlineSubtitle(cfg.headlineSubtitle);
      setFormSaweriaTitle(cfg.saweriaTitle);
      setFormSaweriaDescription(cfg.saweriaDescription);
      setFormFootnote(cfg.footnote);
      setFormPerks(cfg.perks || []);
    } finally {
      setIsConfigLoading(false);
    }
  };

  // Load Tickets
  const loadTickets = async () => {
    setIsTicketsLoading(true);
    try {
      const list = await getAdminSupportTickets();
      setTickets(list);
    } finally {
      setIsTicketsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadTickets();
  }, []);

  // Save Config
  const handleSaveConfig = async () => {
    if (!formSaweriaUrl.trim()) {
      alert("URL Saweria tidak boleh kosong!");
      return;
    }

    setIsSavingConfig(true);
    try {
      const updated: SupportConfig = {
        saweriaUrl: formSaweriaUrl.trim(),
        saweriaActive: formSaweriaActive,
        heroGifUrl: formHeroGifUrl.trim(),
        thankYouGifUrl: formThankYouGifUrl.trim(),
        headlineBadge: formHeadlineBadge.trim(),
        headlineTitle: formHeadlineTitle.trim(),
        headlineSubtitle: formHeadlineSubtitle.trim(),
        saweriaTitle: formSaweriaTitle.trim(),
        saweriaDescription: formSaweriaDescription.trim(),
        perks: formPerks,
        footnote: formFootnote.trim(),
      };

      await saveSupportConfig(updated, currentAdmin);
      setSupportConfig(updated);
      setFeedback("Pengaturan halaman Support & Saweria berhasil disimpan!");
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan pengaturan support.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Reset Config
  const handleResetConfig = async () => {
    if (confirm("Reset pengaturan halaman Support ke default Nuenime?")) {
      const def = await resetSupportConfigToDefault(currentAdmin);
      setSupportConfig(def);
      setFormSaweriaUrl(def.saweriaUrl);
      setFormSaweriaActive(def.saweriaActive);
      setFormHeroGifUrl(def.heroGifUrl);
      setFormThankYouGifUrl(def.thankYouGifUrl);
      setFormHeadlineBadge(def.headlineBadge);
      setFormHeadlineTitle(def.headlineTitle);
      setFormHeadlineSubtitle(def.headlineSubtitle);
      setFormSaweriaTitle(def.saweriaTitle);
      setFormSaweriaDescription(def.saweriaDescription);
      setFormFootnote(def.footnote);
      setFormPerks(def.perks);
      setFeedback("Pengaturan Support di-reset ke nilai bawaan.");
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  // Add Perk
  const handleAddPerk = () => {
    if (!newPerkText.trim()) return;
    setFormPerks([...formPerks, { icon: "heart", text: newPerkText.trim() }]);
    setNewPerkText("");
  };

  // Remove Perk
  const handleRemovePerk = (index: number) => {
    setFormPerks(formPerks.filter((_, i) => i !== index));
  };

  // Ticket handling
  const handleOpenTicket = async (t: SupportTicket) => {
    setSelectedTicket(t);
    const msgs = await getSupportTicketMessages(t.id);
    setMessages(msgs);
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setIsSendingReply(true);
    try {
      const newMsg = await sendAdminTicketReply({
        ticketId: selectedTicket.id,
        message: replyText,
        admin: currentAdmin,
      });
      setMessages([...messages, newMsg]);
      setReplyText("");
      const updatedList = await getAdminSupportTickets();
      setTickets(updatedList);
      const current = updatedList.find((t) => t.id === selectedTicket.id);
      if (current) setSelectedTicket(current);
      setFeedback("Balasan CS berhasil dikirim ke akun pengguna!");
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleStatusChange = async (status: SupportTicket["status"]) => {
    if (!selectedTicket) return;
    const updated = await updateSupportTicketStatus(selectedTicket.id, status, currentAdmin);
    setTickets(updated);
    const current = updated.find((t) => t.id === selectedTicket.id);
    if (current) setSelectedTicket(current);
    setFeedback(`Status tiket diubah menjadi: ${status}`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.id.toLowerCase().includes(q) ||
        t.username.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <AdminLayout activeKey="support" title="Support & Saweria">
      <ScrollView contentContainerStyle={styles.container}>
        {/* Main Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Support & Donasi Nuenime</Text>
            <Text style={styles.subtitle}>
              Atur link Saweria, banner GIF anime, deskripsi donasi, serta kelola tiket layanan pengguna.
            </Text>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "settings" && styles.tabBtnActive]}
              onPress={() => setActiveTab("settings")}
            >
              <AppIcon
                name="heart"
                size={15}
                color={activeTab === "settings" ? "#0B0E17" : "#CBD5E1"}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === "settings" && styles.tabBtnTextActive,
                ]}
              >
                Pengaturan Saweria & Donasi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "tickets" && styles.tabBtnActive]}
              onPress={() => setActiveTab("tickets")}
            >
              <AppIcon
                name="inbox-outline"
                size={15}
                color={activeTab === "tickets" ? "#0B0E17" : "#CBD5E1"}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === "tickets" && styles.tabBtnTextActive,
                ]}
              >
                Tiket Layanan CS ({tickets.filter((t) => t.status === "open").length})
              </Text>
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

        {/* ─── TAB 1: SUPPORT SETTINGS ─── */}
        {activeTab === "settings" && (
          <View style={styles.tabContent}>
            {isConfigLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color="#38BDF8" />
                <Text style={styles.loadingText}>Memuat konfigurasi support...</Text>
              </View>
            ) : (
              <View style={styles.settingsLayout}>
                {/* Form Column */}
                <View style={styles.formCard}>
                  <View style={styles.formHeader}>
                    <Text style={styles.formTitle}>Konfigurasi Tautan & Konten</Text>
                    <View style={styles.formHeaderBtns}>
                      <TouchableOpacity
                        style={styles.resetBtn}
                        onPress={handleResetConfig}
                      >
                        <AppIcon name="refresh" size={13} color="#94A3B8" />
                        <Text style={styles.resetBtnText}>Reset Default</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={handleSaveConfig}
                        disabled={isSavingConfig}
                      >
                        {isSavingConfig ? (
                          <ActivityIndicator size="small" color="#0B0E17" />
                        ) : (
                          <>
                            <AppIcon name="check" size={15} color="#0B0E17" />
                            <Text style={styles.saveBtnText}>Simpan Pengaturan</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Saweria Link & Active Toggle */}
                  <View style={styles.fieldRow}>
                    <View style={[styles.fieldGroup, { flex: 2 }]}>
                      <Text style={styles.fieldLabel}>URL Saweria Nuenime</Text>
                      <TextInput
                        style={styles.input}
                        value={formSaweriaUrl}
                        onChangeText={setFormSaweriaUrl}
                        placeholder="https://saweria.co/Nuenime"
                        placeholderTextColor="#64748B"
                      />
                    </View>

                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Status Donasi</Text>
                      <TouchableOpacity
                        style={[
                          styles.toggleBtn,
                          formSaweriaActive ? styles.toggleActive : styles.toggleInactive,
                        ]}
                        onPress={() => setFormSaweriaActive(!formSaweriaActive)}
                      >
                        <View
                          style={[
                            styles.toggleDot,
                            {
                              backgroundColor: formSaweriaActive
                                ? "#10B981"
                                : "#64748B",
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.toggleText,
                            { color: formSaweriaActive ? "#10B981" : "#94A3B8" },
                          ]}
                        >
                          {formSaweriaActive ? "AKTIF / ONLINE" : "NONAKTIF"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* GIF URLs */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>URL GIF Hero Anime (Banner Atas)</Text>
                    <TextInput
                      style={styles.input}
                      value={formHeroGifUrl}
                      onChangeText={setFormHeroGifUrl}
                      placeholder="https://media1.giphy.com/.../giphy.gif"
                      placeholderTextColor="#64748B"
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      URL GIF Ucapan Terima Kasih (Arigatou GIF)
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={formThankYouGifUrl}
                      onChangeText={setFormThankYouGifUrl}
                      placeholder="https://media2.giphy.com/.../giphy.gif"
                      placeholderTextColor="#64748B"
                    />
                  </View>

                  {/* Headlines */}
                  <View style={styles.fieldRow}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Teks Badge Hero</Text>
                      <TextInput
                        style={styles.input}
                        value={formHeadlineBadge}
                        onChangeText={setFormHeadlineBadge}
                        placeholder="🎌 NUENIME"
                        placeholderTextColor="#64748B"
                      />
                    </View>

                    <View style={[styles.fieldGroup, { flex: 2 }]}>
                      <Text style={styles.fieldLabel}>Judul Banner</Text>
                      <TextInput
                        style={styles.input}
                        value={formHeadlineTitle}
                        onChangeText={setFormHeadlineTitle}
                        placeholder="Jaga Nuenime Tetap Hidup"
                        placeholderTextColor="#64748B"
                      />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Subjudul Banner</Text>
                    <TextInput
                      style={styles.input}
                      value={formHeadlineSubtitle}
                      onChangeText={setFormHeadlineSubtitle}
                      placeholder="Setiap dukungan kamu sangat berarti..."
                      placeholderTextColor="#64748B"
                    />
                  </View>

                  {/* Card Saweria details */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Deskripsi Kartu Saweria</Text>
                    <TextInput
                      style={[styles.input, { height: 60, textAlignVertical: "top" }]}
                      multiline
                      value={formSaweriaDescription}
                      onChangeText={setFormSaweriaDescription}
                      placeholder="Dukung Nuenime lewat Saweria..."
                      placeholderTextColor="#64748B"
                    />
                  </View>

                  {/* Perks Editor */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      Daftar Manfaat & Tujuan Dukungan (Perks)
                    </Text>
                    <View style={styles.perksList}>
                      {formPerks.map((p, idx) => (
                        <View key={idx} style={styles.perkItemRow}>
                          <AppIcon name={p.icon || "heart"} size={15} color="#38BDF8" />
                          <Text style={styles.perkItemText}>{p.text}</Text>
                          <TouchableOpacity
                            onPress={() => handleRemovePerk(idx)}
                            style={styles.removePerkBtn}
                          >
                            <AppIcon name="close" size={14} color="#F87171" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>

                    <View style={styles.addPerkRow}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={newPerkText}
                        onChangeText={setNewPerkText}
                        placeholder="Tambah poin manfaat baru..."
                        placeholderTextColor="#64748B"
                      />
                      <TouchableOpacity
                        style={styles.addPerkBtn}
                        onPress={handleAddPerk}
                      >
                        <AppIcon name="plus" size={16} color="#0B0E17" />
                        <Text style={styles.addPerkBtnText}>Tambah</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Footnote */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Catatan Kaki (Footnote)</Text>
                    <TextInput
                      style={styles.input}
                      value={formFootnote}
                      onChangeText={setFormFootnote}
                      placeholder="Dukungan bersifat sukarela..."
                      placeholderTextColor="#64748B"
                    />
                  </View>
                </View>

                {/* Preview Column */}
                <View style={styles.previewColumn}>
                  <Text style={styles.previewHeading}>
                    LIVE PREVIEW TAMPILAN MOBILE
                  </Text>
                  <View style={styles.mockPhone}>
                    {/* Hero image preview */}
                    <View style={styles.mockHero}>
                      {formHeroGifUrl ? (
                        <Image
                          source={{ uri: formHeroGifUrl }}
                          style={styles.mockHeroImg}
                        />
                      ) : (
                        <View style={styles.mockHeroFallback}>
                          <Text style={{ color: "#94A3B8", fontSize: 12 }}>
                            [GIF Hero Anime]
                          </Text>
                        </View>
                      )}
                      <View style={styles.mockHeroOverlay} />
                      <View style={styles.mockHeroText}>
                        <Text style={styles.mockBadge}>{formHeadlineBadge || "NUENIME"}</Text>
                        <Text style={styles.mockTitle}>
                          {formHeadlineTitle || "Jaga Nuenime Tetap Hidup"}
                        </Text>
                        <Text style={styles.mockSub} numberOfLines={2}>
                          {formHeadlineSubtitle || "Dukungan kamu sangat berarti..."}
                        </Text>
                      </View>
                    </View>

                    {/* Saweria card mock */}
                    <View style={styles.mockCard}>
                      <View style={styles.mockCardTop}>
                        <Text style={styles.mockSaweriaTitle}>☕ Saweria</Text>
                        <View
                          style={[
                            styles.mockPill,
                            {
                              backgroundColor: formSaweriaActive
                                ? "rgba(16,185,129,0.15)"
                                : "rgba(239,68,68,0.15)",
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: formSaweriaActive ? "#10B981" : "#F87171",
                              fontSize: 9,
                              fontWeight: "700",
                            }}
                          >
                            {formSaweriaActive ? "AKTIF" : "OFFLINE"}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.mockDesc} numberOfLines={2}>
                        {formSaweriaDescription}
                      </Text>

                      <View style={styles.mockUrlBox}>
                        <AppIcon name="earth" size={12} color="#CBD5E1" />
                        <Text style={styles.mockUrlText} numberOfLines={1}>
                          {formSaweriaUrl || "saweria.co/Nuenime"}
                        </Text>
                      </View>

                      {/* Button */}
                      <View style={styles.mockBtn}>
                        <Text style={styles.mockBtnText}>☕ Dukung Sekarang</Text>
                      </View>
                    </View>

                    {/* Thank you gif mock */}
                    <View style={styles.mockThankYou}>
                      {formThankYouGifUrl ? (
                        <Image
                          source={{ uri: formThankYouGifUrl }}
                          style={{ width: "100%", height: 75 }}
                          resizeMode="contain"
                        />
                      ) : null}
                      <Text style={styles.mockThankYouText}>
                        Arigatou gozaimasu! 🙏
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ─── TAB 2: CS TICKETS ─── */}
        {activeTab === "tickets" && (
          <View style={styles.tabContent}>
            <View style={styles.filterBar}>
              <View style={styles.searchBox}>
                <AppIcon name="search" size={16} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari ID, username, atau judul keluhan..."
                  placeholderTextColor="#64748B"
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              <View style={styles.statusChips}>
                {["all", "open", "in_progress", "resolved"].map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.chip, statusFilter === st && styles.chipActive]}
                    onPress={() => setStatusFilter(st)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        statusFilter === st && styles.chipTextActive,
                      ]}
                    >
                      {st === "all" ? "Semua Status" : st.replace("_", " ").toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.splitView}>
              {/* Left Pane: Ticket List */}
              <View style={styles.leftPane}>
                <Text style={styles.paneTitle}>
                  Daftar Tiket Pengguna ({filteredTickets.length})
                </Text>

                {isTicketsLoading ? (
                  <ActivityIndicator
                    size="large"
                    color="#38BDF8"
                    style={{ marginVertical: 40 }}
                  />
                ) : filteredTickets.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Tidak ada tiket yang cocok dengan filter.
                  </Text>
                ) : (
                  <ScrollView style={styles.ticketList}>
                    {filteredTickets.map((t) => {
                      const isSelected = selectedTicket?.id === t.id;
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={[
                            styles.ticketCard,
                            isSelected && styles.ticketCardActive,
                          ]}
                          onPress={() => handleOpenTicket(t)}
                        >
                          <View style={styles.ticketTopRow}>
                            <View style={styles.categoryBadge}>
                              <Text style={styles.categoryBadgeText}>
                                {t.category.toUpperCase()}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.statusBadge,
                                t.status === "open" && styles.statusOpen,
                                t.status === "in_progress" && styles.statusInProgress,
                                t.status === "resolved" && styles.statusResolved,
                              ]}
                            >
                              <Text style={styles.statusBadgeText}>
                                {t.status.toUpperCase()}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.ticketSubject} numberOfLines={1}>
                            {t.subject}
                          </Text>
                          <Text style={styles.ticketDesc} numberOfLines={2}>
                            {t.description}
                          </Text>

                          <View style={styles.ticketFooter}>
                            <Text style={styles.ticketUser}>@{t.username}</Text>
                            <Text style={styles.ticketTime}>
                              {new Date(t.createdAt).toLocaleDateString("id-ID")}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              {/* Right Pane: Thread Details */}
              <View style={styles.rightPane}>
                {selectedTicket ? (
                  <View style={styles.ticketDetail}>
                    <View style={styles.detailHeader}>
                      <View>
                        <Text style={styles.detailId}>#{selectedTicket.id}</Text>
                        <Text style={styles.detailSubject}>
                          {selectedTicket.subject}
                        </Text>
                        <Text style={styles.detailMeta}>
                          Dari @{selectedTicket.username} · {selectedTicket.userEmail}
                        </Text>
                      </View>

                      <View style={styles.statusActionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.btnOpen]}
                          onPress={() => handleStatusChange("open")}
                        >
                          <Text style={styles.actionBtnText}>Buka</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.btnProgress]}
                          onPress={() => handleStatusChange("in_progress")}
                        >
                          <Text style={styles.actionBtnText}>Proses</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.btnResolve]}
                          onPress={() => handleStatusChange("resolved")}
                        >
                          <Text style={styles.actionBtnText}>Selesai</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <ScrollView style={styles.messagesList}>
                      <View style={styles.initialMsg}>
                        <Text style={styles.initialLabel}>KELUHAN AWAL:</Text>
                        <Text style={styles.initialText}>
                          {selectedTicket.description}
                        </Text>
                      </View>

                      {messages.map((m) => (
                        <View
                          key={m.id}
                          style={[
                            styles.messageBubble,
                            m.isAdmin
                              ? styles.msgAdmin
                              : styles.msgUser,
                          ]}
                        >
                          <View style={styles.msgHeader}>
                            <Text style={styles.msgSender}>{m.senderName}</Text>
                            <Text style={styles.msgTime}>
                              {new Date(m.createdAt).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </Text>
                          </View>
                          <Text style={styles.msgBody}>{m.message}</Text>
                        </View>
                      ))}
                    </ScrollView>

                    <View style={styles.replyBox}>
                      <TextInput
                        style={styles.replyInput}
                        placeholder="Ketik balasan CS ke pengguna..."
                        placeholderTextColor="#64748B"
                        value={replyText}
                        onChangeText={setReplyText}
                        multiline
                      />
                      <TouchableOpacity
                        style={styles.sendReplyBtn}
                        onPress={handleSendReply}
                        disabled={isSendingReply}
                      >
                        {isSendingReply ? (
                          <ActivityIndicator size="small" color="#0B0E17" />
                        ) : (
                          <>
                            <AppIcon name="send" size={15} color="#0B0E17" />
                            <Text style={styles.sendReplyBtnText}>Kirim</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noTicketSelected}>
                    <AppIcon name="inbox-outline" size={48} color="#64748B" />
                    <Text style={styles.noTicketTitle}>Pilih Tiket</Text>
                    <Text style={styles.noTicketSubtitle}>
                      Pilih salah satu tiket di kolom kiri untuk melihat riwayat percakapan dan membalas pesan pengguna.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
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
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 6,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: "#38BDF8",
  },
  tabBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#94A3B8",
  },
  tabBtnTextActive: {
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
  tabContent: {
    gap: 18,
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

  // Settings Layout
  settingsLayout: {
    flexDirection: "row",
    gap: 20,
    flexWrap: "wrap",
  },
  formCard: {
    flex: 3,
    minWidth: 320,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    padding: 20,
    gap: 16,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: 14,
    flexWrap: "wrap",
    gap: 12,
  },
  formTitle: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  formHeaderBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  resetBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#CBD5E1",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#38BDF8",
  },
  saveBtnText: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 12.5,
    color: "#0B0E17",
  },
  fieldRow: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
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
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  toggleInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  toggleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  toggleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
  },
  perksList: {
    gap: 8,
  },
  perkItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  perkItemText: {
    flex: 1,
    fontFamily: "Nunito-SemiBold",
    fontSize: 12.5,
    color: "#E2E8F0",
  },
  removePerkBtn: {
    padding: 4,
  },
  addPerkRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  addPerkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#38BDF8",
  },
  addPerkBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#0B0E17",
  },

  // Preview Column
  previewColumn: {
    flex: 2,
    minWidth: 280,
    gap: 10,
  },
  previewHeading: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
    letterSpacing: 1,
  },
  mockPhone: {
    backgroundColor: "#0B0E17",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    padding: 12,
    gap: 12,
    overflow: "hidden",
  },
  mockHero: {
    height: 120,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  mockHeroImg: {
    width: "100%",
    height: "100%",
  },
  mockHeroFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#161922",
    alignItems: "center",
    justifyContent: "center",
  },
  mockHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 14, 23, 0.55)",
  },
  mockHeroText: {
    position: "absolute",
    bottom: 8,
    left: 10,
    right: 10,
    gap: 2,
  },
  mockBadge: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 9,
    color: "#CBD5E1",
    letterSpacing: 0.5,
  },
  mockTitle: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  mockSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.75)",
  },
  mockCard: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    padding: 12,
    gap: 8,
  },
  mockCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mockSaweriaTitle: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  mockPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mockDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 15,
  },
  mockUrlBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  mockUrlText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10.5,
    color: "#CBD5E1",
    flex: 1,
  },
  mockBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    paddingVertical: 8,
    alignItems: "center",
  },
  mockBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },
  mockThankYou: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    padding: 10,
    alignItems: "center",
    gap: 6,
  },
  mockThankYouText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#CBD5E1",
  },

  // Tickets CSS
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#FFFFFF",
  },
  statusChips: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  chipActive: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  chipText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#94A3B8",
  },
  chipTextActive: {
    color: "#38BDF8",
  },
  splitView: {
    flexDirection: "row",
    gap: 18,
    minHeight: 520,
    flexWrap: "wrap",
  },
  leftPane: {
    flex: 2,
    minWidth: 280,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
    gap: 12,
  },
  paneTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#CBD5E1",
  },
  emptyText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 30,
  },
  ticketList: {
    flex: 1,
  },
  ticketCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  ticketCardActive: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  ticketTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#CBD5E1",
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusOpen: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  statusInProgress: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  statusResolved: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#FFFFFF",
  },
  ticketSubject: {
    fontFamily: "Nunito-Bold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  ticketDesc: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 16,
  },
  ticketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  ticketUser: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#38BDF8",
  },
  ticketTime: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#64748B",
  },
  rightPane: {
    flex: 3,
    minWidth: 320,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
  },
  ticketDetail: {
    flex: 1,
    gap: 14,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: 12,
    flexWrap: "wrap",
    gap: 10,
  },
  detailId: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  detailSubject: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  detailMeta: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
  },
  statusActionRow: {
    flexDirection: "row",
    gap: 6,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  btnOpen: { backgroundColor: "rgba(245, 158, 11, 0.2)" },
  btnProgress: { backgroundColor: "rgba(56, 189, 248, 0.2)" },
  btnResolve: { backgroundColor: "rgba(16, 185, 129, 0.2)" },
  actionBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  messagesList: {
    flex: 1,
    maxHeight: 380,
  },
  initialMsg: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 12,
    gap: 4,
  },
  initialLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  initialText: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#CBD5E1",
    lineHeight: 18,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    maxWidth: "85%",
  },
  msgAdmin: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  msgUser: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  msgHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    gap: 16,
  },
  msgSender: {
    fontFamily: "Nunito-Bold",
    fontSize: 11.5,
    color: "#38BDF8",
  },
  msgTime: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#94A3B8",
  },
  msgBody: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#F8FAFC",
    lineHeight: 18,
  },
  replyBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 10,
    alignItems: "flex-end",
  },
  replyInput: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#FFFFFF",
    maxHeight: 90,
  },
  sendReplyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#38BDF8",
  },
  sendReplyBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#0B0E17",
  },
  noTicketSelected: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 8,
  },
  noTicketTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  noTicketSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
    textAlign: "center",
    maxWidth: 280,
  },
});
