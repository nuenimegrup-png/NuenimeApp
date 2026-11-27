import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { filterAndCensorMessage } from "./word-filter";
import {
  sanitizeMessage,
  checkChatCooldown,
  recordChatTimestamp,
  checkDuplicateSpamAndAutoBan,
} from "./security-defense";

export type GlobalRoom = "ngobrol_1" | "ngobrol_2";

export interface GlobalChatReplyInfo {
  id: string;
  senderName: string;
  text: string;
  memberNumber?: string;
  role?: string;
  isVip?: boolean;
}

export interface GlobalChatMessage {
  id: string;
  room: GlobalRoom;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderBorder: string | null;
  senderRole: string;
  senderLevel: number;
  senderMemberNumber: string;
  senderIsVip: boolean;
  clanTag?: string | null;
  clanColor?: string | null;
  message: string;
  replyTo?: GlobalChatReplyInfo | null;
  createdAt: string;
}

export const MAX_GLOBAL_CHAT_MESSAGES = 30;

const GLOBAL_CHAT_CACHE_PREFIX = "@nuenime_global_chat_v1:";
const LAST_SENT_TIMESTAMP_KEY = "@nuenime_global_last_sent";

export const GLOBAL_ROOMS: { id: GlobalRoom; label: string; icon: string; comingSoon?: boolean }[] = [
  { id: "ngobrol_1", label: "Ngobrol 1", icon: "pound" },
  { id: "ngobrol_2", label: "Ngobrol 2", icon: "pound" },
];

function formatMemberNumber(num: any): string {
  if (!num) return "#0001";
  const clean = String(num).replace(/[^0-9]/g, "").replace(/^0+/, "");
  return "#" + (clean || "1");
}

// In-memory cache profile untuk mengurangi network overhead
export const profileCache = new Map<string, any>();
const memGlobalChatCache = new Map<GlobalRoom, GlobalChatMessage[]>();

export function getCachedGlobalMessagesSync(room: GlobalRoom): GlobalChatMessage[] {
  const list = memGlobalChatCache.get(room) || [];
  return list.slice(-MAX_GLOBAL_CHAT_MESSAGES);
}

async function fetchSenderProfile(userId: string) {
  if (profileCache.has(userId)) {
    return profileCache.get(userId);
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, equipped_border, level, role, is_vip, member_number")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) {
      if (profileCache.size > 150) {
        profileCache.clear();
      }
      profileCache.set(userId, data);
      return data;
    }
  } catch {}

  return null;
}

let hasPurgedMockCache = false;

/**
 * Membersihkan cache pesan dummy/mock yang mungkin tersimpan di versi sebelumnya (cukup sekali saat awal)
 */
export async function purgeGlobalChatMockCache(): Promise<void> {
  if (hasPurgedMockCache) return;
  hasPurgedMockCache = true;
  try {
    const rooms: GlobalRoom[] = ["ngobrol_1", "ngobrol_2"];
    for (const r of rooms) {
      const key = `${GLOBAL_CHAT_CACHE_PREFIX}${r}`;
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((m: any) => !String(m.id).startsWith("seed-")).slice(-MAX_GLOBAL_CHAT_MESSAGES);
          await AsyncStorage.setItem(key, JSON.stringify(filtered));
        }
      }
    }
  } catch {}
}

/**
 * Mengambil daftar pesan terbaru dari room chat global (Maksimal 30 pesan terbaru)
 */
export async function getGlobalMessages(
  room: GlobalRoom,
  limit: number = MAX_GLOBAL_CHAT_MESSAGES
): Promise<GlobalChatMessage[]> {
  const cacheKey = `${GLOBAL_CHAT_CACHE_PREFIX}${room}`;
  let cached: GlobalChatMessage[] = [];

  try {
    const rawCache = await AsyncStorage.getItem(cacheKey);
    if (rawCache) {
      const parsed = JSON.parse(rawCache);
      if (Array.isArray(parsed)) {
        cached = parsed.filter((m) => !m.id.startsWith("seed-")).slice(-limit);
      }
    }
  } catch {}

  try {
    const { data: rows, error } = await supabase
      .from("global_messages")
      .select("id, room, sender_id, message, reply_to_id, reply_to_sender_name, reply_to_text, reply_to_member_number, clan_tag, created_at")
      .eq("room", room)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !rows || rows.length === 0) {
      return cached;
    }

    // Ambil profile sender secara unik (maksimal 30 sender)
    const uniqueSenderIds = Array.from(new Set(rows.map((r) => r.sender_id)));
    const missingSenderIds = uniqueSenderIds.filter((id) => !profileCache.has(id));

    if (missingSenderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, equipped_border, level, role, is_vip, member_number")
        .in("id", missingSenderIds);

      if (profiles) {
        if (profileCache.size + profiles.length > 200) {
          profileCache.clear();
        }
        profiles.forEach((p) => profileCache.set(p.id, p));
      }
    }

    const messages: GlobalChatMessage[] = rows.map((r) => {
      const p = profileCache.get(r.sender_id) || {};
      const cleanMsg = filterAndCensorMessage(r.message || "").processedText;

      let replyTo: GlobalChatReplyInfo | null = null;
      if (r.reply_to_sender_name && r.reply_to_text) {
        replyTo = {
          id: r.reply_to_id || "reply",
          senderName: r.reply_to_sender_name,
          text: r.reply_to_text,
          memberNumber: r.reply_to_member_number || undefined,
        };
      }

      return {
        id: r.id,
        room: r.room as GlobalRoom,
        senderId: r.sender_id,
        senderName: p.display_name || p.username || "Pengguna Nuenime",
        senderAvatar: p.avatar_url || null,
        senderBorder: p.equipped_border || null,
        senderRole: p.role || "Member",
        senderLevel: Number(p.level) || 1,
        senderMemberNumber: formatMemberNumber(p.member_number),
        senderIsVip: Boolean(p.is_vip),
        clanTag: r.clan_tag || null,
        clanColor: r.clan_tag === "KAGE" ? "#F59E0B" : r.clan_tag === "HOOD" ? "#10B981" : "#38BDF8",
        message: cleanMsg,
        replyTo,
        createdAt: r.created_at,
      };
    });

    // Urutkan dari terlama ke terbaru (kronologis) dan pastikan tepat maksimal 30 pesan
    const sorted = messages.reverse().slice(-limit);

    memGlobalChatCache.set(room, sorted);
    void AsyncStorage.setItem(cacheKey, JSON.stringify(sorted)).catch(() => {});
    return sorted;
  } catch (err) {
    console.warn("[global-chat] getGlobalMessages error:", err);
    return cached;
  }
}

/**
 * Mengambil cuplikan pesan terbaru dari room ngobrol_1 untuk banner Home
 */
export async function getLatestGlobalMessage(): Promise<{ senderName: string; message: string } | null> {
  try {
    const list = await getGlobalMessages("ngobrol_1");
    if (list && list.length > 0) {
      const latest = list[list.length - 1];
      return {
        senderName: latest.senderName,
        message: latest.message,
      };
    }
  } catch {}
  return null;
}

/**
 * Mengirim pesan baru ke ruang chat global
 */
export async function sendGlobalMessage({
  room,
  senderId,
  senderName,
  senderAvatar,
  senderBorder,
  senderRole,
  senderLevel,
  senderMemberNumber,
  senderIsVip,
  clanTag,
  message,
  replyTo,
}: {
  room: GlobalRoom;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  senderBorder?: string | null;
  senderRole?: string;
  senderLevel?: number;
  senderMemberNumber?: string;
  senderIsVip?: boolean;
  clanTag?: string | null;
  message: string;
  replyTo?: GlobalChatReplyInfo | null;
}): Promise<{ success: boolean; data?: GlobalChatMessage; error?: string; warning?: string; isBanned?: boolean }> {
  if (!senderId || senderId === "guest") {
    return { success: false, error: "Silakan login terlebih dahulu untuk mengirim pesan." };
  }

  // 1. Sanitasi anti-injeksi XSS, Script, SQL & Zero-Width Evasion
  const sanitizedText = sanitizeMessage(message, 500);
  if (!sanitizedText) {
    return { success: false, error: "Pesan tidak boleh kosong." };
  }

  // 2. Anti-DDoS & Flood Protection (Rate Limiting Jeda Chat)
  const cooldownCheck = await checkChatCooldown(senderId);
  if (!cooldownCheck.allowed) {
    return {
      success: false,
      error: `Terlalu cepat. Harap tunggu ${cooldownCheck.remainingSeconds} detik sebelum mengirim lagi.`,
    };
  }

  // 3. Deteksi Spam Pesan Sama (4x Berturut-turut = AUTO-BAN AKUN)
  const spamCheck = await checkDuplicateSpamAndAutoBan(senderId, "chat_global", sanitizedText);
  if (spamCheck.isBanned) {
    return {
      success: false,
      isBanned: true,
      error: spamCheck.errorMessage || "AKUN DIBLOKIR: Anda telah diblokir permanen karena mengirim pesan yang sama 4 kali!",
    };
  }

  // 4. Filter sensor kata terlarang
  const filtered = filterAndCensorMessage(sanitizedText);
  const now = Date.now();

  try {
    const isValidUuid = (str?: string | null) =>
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str));

    const payload: any = {
      room,
      sender_id: senderId,
      message: filtered.processedText,
      clan_tag: clanTag || null,
      reply_to_id: isValidUuid(replyTo?.id) ? replyTo!.id : null,
      reply_to_sender_name: replyTo?.senderName || null,
      reply_to_text: replyTo?.text ? replyTo.text.slice(0, 100) : null,
      reply_to_member_number: replyTo?.memberNumber || null,
    };

    const { data, error } = await supabase
      .from("global_messages")
      .insert(payload)
      .select("id, created_at")
      .single();

    if (error || !data) {
      console.warn("[global-chat] sendGlobalMessage error from Supabase:", error);
      return {
        success: false,
        error: error?.message || "Gagal mengirim pesan ke server chat.",
      };
    }

    const createdMsg: GlobalChatMessage = {
      id: data.id,
      room,
      senderId,
      senderName,
      senderAvatar: senderAvatar || null,
      senderBorder: senderBorder || null,
      senderRole: senderRole || "Member",
      senderLevel: senderLevel || 1,
      senderMemberNumber: senderMemberNumber || "#0001",
      senderIsVip: Boolean(senderIsVip),
      clanTag: clanTag || null,
      clanColor: clanTag === "KAGE" ? "#F59E0B" : clanTag === "HOOD" ? "#10B981" : "#38BDF8",
      message: filtered.processedText,
      replyTo: replyTo || null,
      createdAt: data?.created_at || new Date().toISOString(),
    };

    // Perbarui timestamp pengiriman terakhir (Anti-DDoS / Rate Limiting)
    await recordChatTimestamp(senderId);
    await AsyncStorage.setItem(LAST_SENT_TIMESTAMP_KEY, String(now));

    // Perbarui cache lokal (Maksimal 30 pesan terbaru)
    const cacheKey = `${GLOBAL_CHAT_CACHE_PREFIX}${room}`;
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      const list: GlobalChatMessage[] = raw ? JSON.parse(raw) : [];
      if (!list.some((m) => m.id === createdMsg.id)) {
        list.push(createdMsg);
      }
      const trimmed = list.slice(-MAX_GLOBAL_CHAT_MESSAGES);
      memGlobalChatCache.set(room, trimmed);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(trimmed));
    } catch {}

    return {
      success: true,
      data: createdMsg,
      warning: spamCheck.warningMessage,
    };
  } catch (err: any) {
    console.warn("[global-chat] sendGlobalMessage error:", err);
    return { success: false, error: err?.message || "Gagal mengirim pesan." };
  }
}

type RoomChannelState = {
  channel: ReturnType<typeof supabase.channel>;
  listeners: Set<(msg: GlobalChatMessage) => void>;
  status: string;
};

const activeRoomChannels = new Map<GlobalRoom, RoomChannelState>();

/**
 * Berlangganan pesan baru secara realtime via Supabase Realtime channel
 * Menggunakan deduplikasi channel, proteksi reconnect, dan zero double subscription.
 */
export function subscribeGlobalMessages(
  room: GlobalRoom,
  onNewMessage: (msg: GlobalChatMessage) => void
) {
  let state = activeRoomChannels.get(room);

  if (!state) {
    const channelName = `realtime-global-chat:${room}`;
    const listeners = new Set<(msg: GlobalChatMessage) => void>();
    listeners.add(onNewMessage);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "global_messages",
          filter: `room=eq.${room}`,
        },
        async (payload) => {
          const row = payload.new as any;
          if (!row || !row.id) return;

          // Hindari memproses ID pesan yang sudah pernah masuk (deduplikasi ketat)
          const currentMem = memGlobalChatCache.get(row.room as GlobalRoom) || [];
          if (currentMem.some((m) => m.id === row.id)) return;

          // Preload profile secara background jika belum ada di memori cache
          if (!profileCache.has(row.sender_id)) {
            void fetchSenderProfile(row.sender_id);
          }

          const p = (await fetchSenderProfile(row.sender_id)) || {};
          const cleanMsg = filterAndCensorMessage(row.message || "").processedText;

          let replyTo: GlobalChatReplyInfo | null = null;
          if (row.reply_to_sender_name && row.reply_to_text) {
            replyTo = {
              id: row.reply_to_id || "reply",
              senderName: row.reply_to_sender_name,
              text: row.reply_to_text,
              memberNumber: row.reply_to_member_number || undefined,
            };
          }

          const parsedMsg: GlobalChatMessage = {
            id: row.id,
            room: row.room as GlobalRoom,
            senderId: row.sender_id,
            senderName: p.display_name || p.username || "Pengguna Nuenime",
            senderAvatar: p.avatar_url || null,
            senderBorder: p.equipped_border || null,
            senderRole: p.role || "Member",
            senderLevel: Number(p.level) || 1,
            senderMemberNumber: formatMemberNumber(p.member_number),
            senderIsVip: Boolean(p.is_vip),
            clanTag: row.clan_tag || null,
            clanColor: row.clan_tag === "KAGE" ? "#F59E0B" : row.clan_tag === "HOOD" ? "#10B981" : "#38BDF8",
            message: cleanMsg,
            replyTo,
            createdAt: row.created_at,
          };

          // Update memory cache secara incremental dengan batas 30 pesan
          const mem = memGlobalChatCache.get(row.room as GlobalRoom) || [];
          if (!mem.some((m) => m.id === parsedMsg.id)) {
            const updatedMem = [...mem, parsedMsg].slice(-MAX_GLOBAL_CHAT_MESSAGES);
            memGlobalChatCache.set(row.room as GlobalRoom, updatedMem);
          }

          // Broadcast ke seluruh listeners aktif untuk room ini
          const currentListeners = activeRoomChannels.get(room)?.listeners;
          if (currentListeners) {
            currentListeners.forEach((listener) => {
              try {
                listener(parsedMsg);
              } catch (err) {
                console.warn("[global-chat] listener error:", err);
              }
            });
          }
        }
      );

    state = { channel, listeners, status: "CONNECTING" };
    activeRoomChannels.set(room, state);

    channel.subscribe((status, err) => {
      if (state) state.status = status;
      if (status === "CHANNEL_ERROR") {
        console.warn(`[global-chat] Realtime channel status error for room ${room}:`, err?.message || err);
      } else if (status === "TIMED_OUT") {
        console.warn(`[global-chat] Realtime channel timed out for room ${room}. Auto-reconnecting...`);
      }
    });
  } else {
    // Channel sudah ada: cukup daftarkan listener baru (mencegah subscription ganda)
    state.listeners.add(onNewMessage);
  }

  return () => {
    const currentState = activeRoomChannels.get(room);
    if (!currentState) return;
    currentState.listeners.delete(onNewMessage);

    // Jika sudah tidak ada listener yang mendengarkan room ini, lepas channel dengan aman
    if (currentState.listeners.size === 0) {
      activeRoomChannels.delete(room);
      try {
        supabase.removeChannel(currentState.channel).catch(() => {});
      } catch {}
    }
  };
}
