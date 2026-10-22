import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { filterAndCensorMessage } from "./word-filter";

export interface PrivateMessage {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  createdAt: string;
}

const CHAT_CACHE_PREFIX = "nuenime_private_chat:";

function getChatKey(userA: string, userB: string): string {
  return [userA, userB].sort().join("_");
}

/**
 * Mengambil riwayat pesan pribadi antara dua pengguna (maksimal 7 hari terakhir).
 * Pesan yang lebih dari 7 hari otomatis tidak ditampilkan dan dibersihkan dari server.
 */
export async function getPrivateMessages(
  userA: string,
  userB: string
): Promise<PrivateMessage[]> {
  if (!userA || !userB) return [];

  const chatKey = getChatKey(userA, userB);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Bersihkan pesan kedaluwarsa secara otomatis di latar belakang (> 7 hari)
    void Promise.resolve(
      supabase
        .from("private_messages")
        .delete()
        .lt("created_at", sevenDaysAgo)
    ).catch(() => {});

    // 2. Ambil pesan aktif (usia <= 7 hari)
    const { data, error } = await supabase
      .from("private_messages")
      .select("id, sender_id, receiver_id, message, created_at")
      .or(
        `and(sender_id.eq.${userA},receiver_id.eq.${userB}),and(sender_id.eq.${userB},receiver_id.eq.${userA})`
      )
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error || !data) {
      // Fallback ke cache lokal jika offline
      const local = await AsyncStorage.getItem(`${CHAT_CACHE_PREFIX}${chatKey}`);
      if (local) {
        const parsed: PrivateMessage[] = JSON.parse(local);
        return parsed.filter((m) => new Date(m.createdAt).getTime() >= Date.now() - 7 * 86_400_000);
      }
      return [];
    }

    const messages: PrivateMessage[] = data.map((d) => ({
      id: d.id,
      senderId: d.sender_id,
      receiverId: d.receiver_id,
      message: filterAndCensorMessage(d.message).processedText,
      createdAt: d.created_at,
    }));

    // Simpan ke cache lokal
    void AsyncStorage.setItem(
      `${CHAT_CACHE_PREFIX}${chatKey}`,
      JSON.stringify(messages)
    ).catch(() => {});

    return messages;
  } catch (err) {
    console.warn("[private-chat] getPrivateMessages error:", err);
    return [];
  }
}

/**
 * Mengirim pesan chat pribadi baru.
 * Otomatis menyensor kata terlarang jika terdeteksi.
 */
export async function sendPrivateMessage(
  senderId: string,
  receiverId: string,
  text: string,
  senderName?: string | null
): Promise<{ success: boolean; data?: PrivateMessage; error?: string }> {
  const cleanText = text.trim();
  if (!cleanText || !senderId || !receiverId) {
    return { success: false, error: "Pesan tidak boleh kosong." };
  }

  // Filter kata terlarang secara otomatis sebelum disimpan ke database
  const filtered = filterAndCensorMessage(cleanText);
  const textToSave = filtered.processedText;

  try {
    const { data, error } = await supabase
      .from("private_messages")
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        message: textToSave,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Gagal mengirim pesan." };
    }

    const newMsg: PrivateMessage = {
      id: data.id,
      senderId: data.sender_id,
      receiverId: data.receiver_id,
      message: data.message,
      createdAt: data.created_at,
    };

    // Kirim notifikasi ke penerima pesan
    try {
      await supabase.from("notifications").insert({
        user_id: receiverId,
        title: `Pesan baru dari ${senderName || "Teman"}`,
        message: textToSave.length > 50 ? `${textToSave.slice(0, 50)}...` : textToSave,
        type: "private_chat",
        read: false,
      });
    } catch {}

    return { success: true, data: newMsg };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal mengirim pesan." };
  }
}

/**
 * Berlangganan pesan masuk secara realtime.
 */
export function subscribePrivateMessages(
  userA: string,
  userB: string,
  onNewMessage: (msg: PrivateMessage) => void
) {
  const channelName = `dm_${[userA, userB].sort().join("_")}_${Date.now()}`;

  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "private_messages",
      },
      (payload) => {
        const row = payload.new as any;
        if (
          row &&
          ((row.sender_id === userA && row.receiver_id === userB) ||
            (row.sender_id === userB && row.receiver_id === userA))
        ) {
          onNewMessage({
            id: row.id,
            senderId: row.sender_id,
            receiverId: row.receiver_id,
            message: filterAndCensorMessage(row.message).processedText,
            createdAt: row.created_at,
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
