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
import { AppIcon } from "@/components/app-icon";

export default function AdminSupportScreen() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
    role: "finance_admin",
  };

  const loadTickets = async () => {
    setIsLoading(true);
    try {
      const list = await getAdminSupportTickets();
      setTickets(list);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

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
      // Refresh tickets
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
    <AdminLayout activeKey="support" title="Support & Customer Service">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Support & Customer Service Tickets</Text>
            <Text style={styles.subtitle}>
              Kelola keluhan penonton terkait pembayaran, streaming video, gacha, dan akun.
            </Text>
          </View>

          <View style={styles.filterBar}>
            <View style={styles.searchBox}>
              <AppIcon name="search" size={16} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari ID, username, atau judul..."
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
                  <Text style={[styles.chipText, statusFilter === st && styles.chipTextActive]}>
                    {st === "all" ? "Semua Status" : st.replace("_", " ").toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {feedback && (
          <View style={styles.feedbackBanner}>
            <AppIcon name="check-circle" size={18} color="#10B981" />
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        )}

        {/* Main Content: Split List and Thread */}
        <View style={styles.splitView}>
          {/* Left Side: Ticket List */}
          <View style={styles.leftPane}>
            <Text style={styles.paneTitle}>Daftar Tiket Antrean ({filteredTickets.length})</Text>

            {isLoading ? (
              <ActivityIndicator size="large" color="#8C57FF" style={{ marginVertical: 40 }} />
            ) : filteredTickets.length === 0 ? (
              <Text style={styles.emptyText}>Tidak ada tiket yang cocok dengan filter.</Text>
            ) : (
              <ScrollView style={styles.ticketList}>
                {filteredTickets.map((t) => {
                  const isSelected = selectedTicket?.id === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.ticketCard, isSelected && styles.ticketCardActive]}
                      onPress={() => handleOpenTicket(t)}
                    >
                      <View style={styles.ticketTopRow}>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText}>{t.category.toUpperCase()}</Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            t.status === "open" && styles.statusOpen,
                            t.status === "in_progress" && styles.statusInProgress,
                            t.status === "resolved" && styles.statusResolved,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              t.status === "open" && { color: "#F59E0B" },
                              t.status === "in_progress" && { color: "#38BDF8" },
                              t.status === "resolved" && { color: "#10B981" },
                            ]}
                          >
                            {t.status.replace("_", " ")}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.ticketSubject} numberOfLines={1}>
                        {t.subject}
                      </Text>
                      <Text style={styles.ticketDesc} numberOfLines={2}>
                        {t.description}
                      </Text>

                      <View style={styles.ticketBottomRow}>
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

          {/* Right Side: Conversation Thread */}
          <View style={styles.rightPane}>
            {selectedTicket ? (
              <View style={styles.threadContainer}>
                {/* Thread Header */}
                <View style={styles.threadHeader}>
                  <View>
                    <View style={styles.threadBadgeRow}>
                      <Text style={styles.threadTicketId}>{selectedTicket.id}</Text>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>
                          {selectedTicket.category.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.threadSubject}>{selectedTicket.subject}</Text>
                    <Text style={styles.threadUserMeta}>
                      Pelapor: {selectedTicket.username} ({selectedTicket.userEmail}) •{" "}
                      {new Date(selectedTicket.createdAt).toLocaleString("id-ID")}
                    </Text>
                  </View>

                  {/* Status Actions */}
                  <View style={styles.statusActionGroup}>
                    {(["open", "in_progress", "resolved"] as const).map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.statusToggleBtn,
                          selectedTicket.status === st && styles.statusToggleBtnActive,
                        ]}
                        onPress={() => handleStatusChange(st)}
                      >
                        <Text
                          style={[
                            styles.statusToggleBtnText,
                            selectedTicket.status === st && styles.statusToggleBtnTextActive,
                          ]}
                        >
                          {st.replace("_", " ").toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Initial Description Card */}
                <View style={styles.descCard}>
                  <Text style={styles.descLabel}>Uraian Masalah Awal:</Text>
                  <Text style={styles.descContent}>{selectedTicket.description}</Text>
                </View>

                {/* Messages Stream */}
                <ScrollView style={styles.messagesList}>
                  {messages.map((m) => (
                    <View
                      key={m.id}
                      style={[
                        styles.messageBubble,
                        m.isAdmin ? styles.msgAdmin : styles.msgUser,
                      ]}
                    >
                      <View style={styles.msgHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {m.isAdmin ? <AppIcon name="shield-check-outline" size={14} color="#8C57FF" /> : <AppIcon name="account" size={14} color="#38BDF8" />}
                          <Text style={[styles.msgSender, m.isAdmin && { color: "#8C57FF" }]}>
                            {m.senderName}
                          </Text>
                        </View>
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

                {/* Reply Input Form */}
                <View style={styles.replyBox}>
                  <TextInput
                    style={styles.replyInput}
                    value={replyText}
                    onChangeText={setReplyText}
                    placeholder="Ketik balasan resmi CS untuk pengguna ini..."
                    placeholderTextColor="#64748B"
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, (!replyText.trim() || isSendingReply) && { opacity: 0.5 }]}
                    onPress={handleSendReply}
                    disabled={!replyText.trim() || isSendingReply}
                  >
                    <AppIcon name="send" size={16} color="#FFF" />
                    <Text style={styles.sendBtnText}>Kirim Balasan</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.noTicketSelected}>
                <AppIcon name="help-circle-outline" size={48} color="#64748B" />
                <Text style={styles.noTicketTitle}>Pilih Tiket untuk Melihat Percakapan</Text>
                <Text style={styles.noTicketSubtitle}>
                  Klik salah satu tiket dari panel sebelah kiri untuk membaca detail dan membalas.
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    flex: 1,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  subtitle: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 4,
  },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#211D36",
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.2)",
    width: 320,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    color: "#F8FAFC",
    fontSize: 13,
  },
  statusChips: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    backgroundColor: "#211D36",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  chipActive: {
    backgroundColor: "rgba(140, 87, 255, 0.2)",
    borderColor: "#8C57FF",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  chipTextActive: {
    color: "#8C57FF",
  },
  feedbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10B981",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  feedbackText: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "600",
  },
  splitView: {
    flexDirection: "row",
    flex: 1,
    gap: 20,
    minHeight: 600,
  },
  leftPane: {
    width: "36%",
    minWidth: 320,
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.15)",
  },
  paneTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 12,
  },
  emptyText: {
    color: "#64748B",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 30,
  },
  ticketList: {
    flex: 1,
  },
  ticketCard: {
    backgroundColor: "#14121F",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  ticketCardActive: {
    borderColor: "#8C57FF",
    backgroundColor: "rgba(140, 87, 255, 0.1)",
  },
  ticketTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: "rgba(140, 87, 255, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    color: "#8C57FF",
    fontSize: 10,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
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
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  ticketSubject: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  ticketDesc: {
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 16,
    marginBottom: 10,
  },
  ticketBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingTop: 8,
  },
  ticketUser: {
    fontSize: 12,
    color: "#CBD5E1",
    fontWeight: "600",
  },
  ticketTime: {
    fontSize: 11,
    color: "#64748B",
  },
  rightPane: {
    flex: 1,
    backgroundColor: "#211D36",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.15)",
  },
  threadContainer: {
    flex: 1,
    flexDirection: "column",
  },
  threadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: 16,
    marginBottom: 16,
  },
  threadBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  threadTicketId: {
    fontSize: 13,
    color: "#8C57FF",
    fontWeight: "700",
  },
  threadSubject: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  threadUserMeta: {
    fontSize: 12,
    color: "#94A3B8",
  },
  statusActionGroup: {
    flexDirection: "row",
    gap: 6,
  },
  statusToggleBtn: {
    backgroundColor: "#14121F",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  statusToggleBtnActive: {
    backgroundColor: "rgba(140, 87, 255, 0.2)",
    borderColor: "#8C57FF",
  },
  statusToggleBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
  },
  statusToggleBtnTextActive: {
    color: "#8C57FF",
  },
  descCard: {
    backgroundColor: "#14121F",
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#8C57FF",
  },
  descLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8C57FF",
    marginBottom: 4,
  },
  descContent: {
    fontSize: 13,
    color: "#CBD5E1",
    lineHeight: 18,
  },
  messagesList: {
    flex: 1,
    marginBottom: 16,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    maxWidth: "85%",
  },
  msgAdmin: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(140, 87, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(140, 87, 255, 0.3)",
  },
  msgUser: {
    alignSelf: "flex-start",
    backgroundColor: "#14121F",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  msgHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 16,
  },
  msgSender: {
    fontSize: 12,
    fontWeight: "700",
    color: "#38BDF8",
  },
  msgTime: {
    fontSize: 10,
    color: "#64748B",
  },
  msgBody: {
    fontSize: 13,
    color: "#F8FAFC",
    lineHeight: 18,
  },
  replyBox: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#14121F",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "flex-end",
  },
  replyInput: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#8C57FF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sendBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  noTicketSelected: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  noTicketTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
    marginTop: 16,
    marginBottom: 4,
  },
  noTicketSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    maxWidth: 300,
  },
});
