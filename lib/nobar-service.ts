import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { getServers, getStream, playableSources, anirakuProxyUrl, nativePlaybackHeaders } from "./aniraku-api";
import { filterAndCensorMessage } from "./word-filter";
import { sanitizeMessage } from "./security-defense";

export interface NobarRoom {
  id: string;
  room_code?: string;
  title: string;
  anime_id: number;
  anime_title: string;
  anime_poster: string | null;
  episode: number;
  host_id: string;
  host_name: string;
  host_avatar: string | null;
  is_private: boolean;
  password?: string | null;
  status: "active" | "closed";
  playback_time: number;
  is_playing: boolean;
  max_members: number;
  member_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface NobarMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  sender_role?: string;
  sender_level?: number;
  sender_is_vip?: boolean;
  message: string;
  is_system?: boolean;
  created_at: string;
}

export type NobarSyncActionType =
  | "PLAY"
  | "PAUSE"
  | "SEEK"
  | "CHANGE_EPISODE"
  | "HEARTBEAT"
  | "INITIAL_SYNC"
  | "ROOM_CLOSED";

export interface NobarSyncPayload {
  type: NobarSyncActionType;
  currentTime?: number;
  isPlaying?: boolean;
  episode?: number;
  timestamp: number;
  senderId?: string;
  reason?: string;
}

export interface NobarParticipant {
  userId: string;
  name: string;
  avatar: string | null;
  isHost: boolean;
  role?: string;
  level?: number;
  isVip?: boolean;
}

const LOCAL_ROOMS_CACHE_KEY = "@nuenime_nobar_rooms_cache_v1";

/**
 * Mengambil daftar room nobar yang sedang aktif
 */
export async function getActiveNobarRooms(): Promise<NobarRoom[]> {
  try {
    const { data, error } = await supabase
      .from("nobar_rooms")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && Array.isArray(data) && data.length > 0) {
      void AsyncStorage.setItem(LOCAL_ROOMS_CACHE_KEY, JSON.stringify(data)).catch(() => {});
      return data as NobarRoom[];
    }
  } catch (err) {
    console.warn("[nobar-service] getActiveNobarRooms db error:", err);
  }

  // Fallback ke cache lokal
  try {
    const raw = await AsyncStorage.getItem(LOCAL_ROOMS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as NobarRoom[];
      }
    }
  } catch {}

  return [];
}

/**
 * Mengambil detail room berdasarkan ID
 */
export async function getNobarRoomById(roomId: string): Promise<NobarRoom | null> {
  try {
    const { data, error } = await supabase
      .from("nobar_rooms")
      .select("*")
      .eq("id", roomId)
      .maybeSingle();

    if (!error && data) {
      return data as NobarRoom;
    }
  } catch (err) {
    console.warn("[nobar-service] getNobarRoomById db error:", err);
  }

  // Cek di cache lokal jika database gagal
  try {
    const raw = await AsyncStorage.getItem(LOCAL_ROOMS_CACHE_KEY);
    if (raw) {
      const rooms: NobarRoom[] = JSON.parse(raw);
      const found = rooms.find((r) => r.id === roomId);
      if (found) return found;
    }
  } catch {}

  return null;
}

/**
 * Membuat kode tag unik room 5-digit angka (contoh: #10492)
 */
export function generateRoomCode(): string {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `#${num}`;
}

/**
 * Mendapatkan tag nomor room yang rapi.
 * Jika room belum memiliki room_code, buat fallback hash deterministik dari ID room
 * agar nomor tag selalu konsisten dan tidak pernah kosong.
 */
export function getRoomCode(room?: Partial<NobarRoom> | null): string {
  if (!room) return "#10000";
  if (room.room_code && typeof room.room_code === "string" && room.room_code.trim()) {
    const clean = room.room_code.trim();
    return clean.startsWith("#") ? clean : `#${clean}`;
  }
  if (room.id && typeof room.id === "string") {
    let hash = 0;
    for (let i = 0; i < room.id.length; i++) {
      hash = ((hash << 5) - hash + room.id.charCodeAt(i)) | 0;
    }
    const num = (Math.abs(hash) % 90000) + 10000;
    return `#${num}`;
  }
  return "#10000";
}

/**
 * Membuat room nobar baru
 */
export async function createNobarRoom(params: {
  title: string;
  anime_id: number;
  anime_title: string;
  anime_poster?: string | null;
  episode: number;
  host_id: string;
  host_name: string;
  host_avatar?: string | null;
  is_private: boolean;
  password?: string | null;
}): Promise<{ success: boolean; data?: NobarRoom; error?: string }> {
  const cleanTitle = sanitizeMessage(params.title, 60);
  if (!cleanTitle) {
    return { success: false, error: "Nama room tidak boleh kosong." };
  }

  const roomCode = generateRoomCode();

  const newRoom: Omit<NobarRoom, "id" | "created_at" | "updated_at"> = {
    title: cleanTitle,
    room_code: roomCode,
    anime_id: params.anime_id,
    anime_title: params.anime_title,
    anime_poster: params.anime_poster || null,
    episode: params.episode || 1,
    host_id: params.host_id,
    host_name: params.host_name,
    host_avatar: params.host_avatar || null,
    is_private: params.is_private,
    password: params.is_private ? (params.password || "").trim() : null,
    status: "active",
    playback_time: 0,
    is_playing: false,
    max_members: 50,
  };

  try {
    const { data, error } = await supabase
      .from("nobar_rooms")
      .insert(newRoom)
      .select()
      .single();

    if (error) {
      console.warn("[nobar-service] createNobarRoom db error:", error);
      // Buat ID lokal untuk fallback
      const fallbackRoom: NobarRoom = {
        ...newRoom,
        id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        created_at: new Date().toISOString(),
      };
      await saveRoomToLocalCache(fallbackRoom);
      return { success: true, data: fallbackRoom };
    }

    const created = data as NobarRoom;
    await saveRoomToLocalCache(created);
    return { success: true, data: created };
  } catch (err: any) {
    console.warn("[nobar-service] createNobarRoom catch:", err);
    const fallbackRoom: NobarRoom = {
      ...newRoom,
      id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      created_at: new Date().toISOString(),
    };
    await saveRoomToLocalCache(fallbackRoom);
    return { success: true, data: fallbackRoom };
  }
}

async function saveRoomToLocalCache(room: NobarRoom) {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_ROOMS_CACHE_KEY);
    const list: NobarRoom[] = raw ? JSON.parse(raw) : [];
    const updated = [room, ...list.filter((r) => r.id !== room.id)].slice(0, 50);
    await AsyncStorage.setItem(LOCAL_ROOMS_CACHE_KEY, JSON.stringify(updated));
  } catch {}
}

/**
 * Menutup room nobar (oleh Host)
 */
export async function closeNobarRoom(roomId: string, hostId: string): Promise<boolean> {
  try {
    // 1. Update status to closed first (so any listeners get the update)
    await supabase
      .from("nobar_rooms")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", roomId)
      .eq("host_id", hostId);

    // 2. Delete the room completely (cascades to nobar_messages)
    await supabase
      .from("nobar_rooms")
      .delete()
      .eq("id", roomId)
      .eq("host_id", hostId);

    // Update cache lokal
    const raw = await AsyncStorage.getItem(LOCAL_ROOMS_CACHE_KEY);
    if (raw) {
      const list: NobarRoom[] = JSON.parse(raw);
      const filtered = list.filter((r) => r.id !== roomId);
      await AsyncStorage.setItem(LOCAL_ROOMS_CACHE_KEY, JSON.stringify(filtered));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Mengambil pesan chat untuk room nobar
 */
export async function getNobarMessages(roomId: string): Promise<NobarMessage[]> {
  try {
    const { data, error } = await supabase
      .from("nobar_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (!error && Array.isArray(data)) {
      return data as NobarMessage[];
    }
  } catch {}
  return [];
}

/**
 * Mengirim pesan chat di dalam room nobar
 */
export async function sendNobarMessage(params: {
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  senderRole?: string;
  senderLevel?: number;
  senderIsVip?: boolean;
  message: string;
  isSystem?: boolean;
}): Promise<{ success: boolean; data?: NobarMessage; error?: string }> {
  const sanitized = sanitizeMessage(params.message, 300);
  if (!sanitized && !params.isSystem) {
    return { success: false, error: "Pesan tidak boleh kosong." };
  }

  const cleanText = filterAndCensorMessage(sanitized || params.message).processedText;

  const msgPayload: NobarMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    room_id: params.roomId,
    sender_id: params.senderId,
    sender_name: params.senderName,
    sender_avatar: params.senderAvatar || null,
    sender_role: params.senderRole || "Member",
    sender_level: params.senderLevel || 1,
    sender_is_vip: Boolean(params.senderIsVip),
    message: cleanText,
    is_system: Boolean(params.isSystem),
    created_at: new Date().toISOString(),
  };

  try {
    await supabase.from("nobar_messages").insert({
      id: msgPayload.id,
      room_id: msgPayload.room_id,
      sender_id: msgPayload.sender_id,
      sender_name: msgPayload.sender_name,
      sender_avatar: msgPayload.sender_avatar,
      sender_role: msgPayload.sender_role,
      message: msgPayload.message,
      is_system: msgPayload.is_system,
      created_at: msgPayload.created_at,
    });
  } catch (err) {
    console.warn("[nobar-service] sendNobarMessage db error:", err);
  }

  return { success: true, data: msgPayload };
}

/**
 * Resolusi link stream anime untuk player nobar
 */
export async function resolveNobarStream(
  animeId: number,
  episode: number
): Promise<{ uri: string | null; headers?: Record<string, string>; isEmbed?: boolean; error?: string }> {
  try {
    // 1. Ambil server yang tersedia untuk episode ini
    const servers = await getServers(animeId, episode, "sub");
    if (!servers || servers.length === 0) {
      return { uri: null, error: "Tidak ada server video yang tersedia untuk episode ini." };
    }

    // 2. Ambil server pertama yang aktif
    const activeServer = servers[0];

    // Cek sumber langsung jika tersedia
    if (activeServer.sources && activeServer.sources.length > 0) {
      const valid = playableSources(activeServer.sources);
      if (valid.length > 0) {
        const src = valid[0];
        const isEmbed = src.type === "embed" || src.url?.includes("embed") || src.url?.includes("iframe");
        const headers = nativePlaybackHeaders(activeServer.headers);
        const finalUrl = isEmbed ? src.url : anirakuProxyUrl(src.url, headers);
        return { uri: finalUrl, headers, isEmbed };
      }
    }

    // 3. Panggil API getStream
    const streamData = await getStream({
      animeId,
      episode,
      provider: activeServer.provider || "anikoto",
      lang: "sub",
      quality: "auto",
    });

    if (streamData?.sources && streamData.sources.length > 0) {
      const valid = playableSources(streamData.sources);
      if (valid.length > 0) {
        const src = valid[0];
        const isEmbed = src.type === "embed" || src.url?.includes("embed") || src.url?.includes("iframe");
        const headers = nativePlaybackHeaders(streamData.headers || activeServer.headers);
        const finalUrl = isEmbed ? src.url : anirakuProxyUrl(src.url, headers);
        return { uri: finalUrl, headers, isEmbed };
      }
    }

    return { uri: null, error: "Gagal memuat sumber video anime." };
  } catch (err: any) {
    console.warn("[nobar-service] resolveNobarStream error:", err);
    return { uri: null, error: err?.message || "Terjadi kesalahan saat memuat streaming." };
  }
}
