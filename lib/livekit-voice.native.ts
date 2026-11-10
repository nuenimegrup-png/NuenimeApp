import { useState, useCallback, useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import { requestRecordingPermissionsAsync, getRecordingPermissionsAsync } from "expo-audio";
import { registerGlobals, AudioSession, AndroidAudioTypePresets } from "@livekit/react-native";
import { Room, RoomEvent, Track, type Participant } from "livekit-client";
import { SignJWT } from "jose";
import { hapticLight, hapticSuccess, hapticWarning } from "./haptics";

// Pastikan globals WebRTC terdaftar
try {
  registerGlobals();
} catch (e) {
  console.warn("[LiveKit Native] registerGlobals init warning:", e);
}

const LIVEKIT_URL =
  process.env.EXPO_PUBLIC_LIVEKIT_URL ||
  "wss://nuenime-nobar-h2gtgeqn.livekit.cloud";
const LIVEKIT_API_KEY = "APIEwYtdEeibv9m";
const LIVEKIT_API_SECRET = "YeBHtQxw0AebOfkbb2wZESAG37Dhi7PbQjKaO2E9yTuA";

/**
 * Menghasilkan token JWT LiveKit untuk mobile native
 */
export async function getLiveKitVoiceToken(
  roomId: string,
  userId: string,
  userName: string
): Promise<string> {
  // 1. Coba fetch dari server jika ada endpoint aktif
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const serverUrl = `https://aniraku.tech/api/nobar/voice-token?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`;
    const resp = await fetch(serverUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (resp.ok) {
      const data = await resp.json();
      if (data?.token) return data.token;
    }
  } catch {}

  // 2. Direct client-side HS256 JWT signing via jose
  const secretBytes = new TextEncoder().encode(LIVEKIT_API_SECRET);
  const jwt = await new SignJWT({
    video: {
      room: `nobar_${roomId}`,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
    name: userName || "Penonton",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(LIVEKIT_API_KEY)
    .setSubject(userId)
    .setExpirationTime("6h")
    .sign(secretBytes);

  return jwt;
}

export interface UseNobarVoiceResult {
  isConnected: boolean;
  isConnecting: boolean;
  isMicOn: boolean;
  isDeafened: boolean;
  speakingUserIds: string[];
  error: string | null;
  toggleMic: () => Promise<void>;
  toggleDeafen: () => void;
  connectVoice: () => Promise<void>;
  disconnectVoice: () => void;
}

/**
 * Native WebRTC LiveKit Voice hook untuk Android & iOS.
 * Menggunakan @livekit/react-native + livekit-client untuk full realtime audio call.
 */
export function useNobarVoice(
  roomId: string,
  userId: string,
  userName: string
): UseNobarVoiceResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [speakingUserIds, setSpeakingUserIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const isConnectingRef = useRef(false);

  const connectVoice = useCallback(async () => {
    if (roomRef.current?.state === "connected" || isConnectingRef.current) return;
    if (!roomId || !userId) return;

    isConnectingRef.current = true;
    setIsConnecting(true);
    setError(null);

    try {
      // 1. Konfigurasi audio session Android / iOS untuk komunikasi suara yang jernih
      if (Platform.OS === "android") {
        await AudioSession.configureAudio({
          android: {
            preferredOutputList: ["speaker", "headset", "bluetooth"],
            audioTypeOptions: AndroidAudioTypePresets.communication,
          },
        }).catch((e) => console.warn("[LiveKit Native] configureAudio warn:", e));
      }
      await AudioSession.startAudioSession().catch((e) =>
        console.warn("[LiveKit Native] startAudioSession warn:", e)
      );

      // 2. Dapatkan token JWT LiveKit
      const token = await getLiveKitVoiceToken(roomId, userId, userName);

      // 3. Inisialisasi Room LiveKit
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // 4. Daftarkan event listener
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const ids = speakers.map((s) => s.identity).filter(Boolean);
        setSpeakingUserIds(ids);
      });

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          // Pada native React Native WebRTC, track audio otomatis dimainkan melalui audio hardware
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setIsMicOn(false);
        setSpeakingUserIds([]);
        isConnectingRef.current = false;
      });

      // 5. Sambungkan ke LiveKit SFU server
      await room.connect(LIVEKIT_URL, token);
      roomRef.current = room;
      setIsConnected(true);
      setIsConnecting(false);
      isConnectingRef.current = false;
    } catch (err: any) {
      console.warn("[LiveKit Native] connect error:", err);
      setError("Gagal terhubung ke voice server.");
      setIsConnecting(false);
      isConnectingRef.current = false;
    }
  }, [roomId, userId, userName]);

  const disconnectVoice = useCallback(() => {
    isConnectingRef.current = false;
    try {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    } catch {}
    try {
      void AudioSession.stopAudioSession().catch(() => {});
    } catch {}
    roomRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
    setIsMicOn(false);
    setSpeakingUserIds([]);
  }, []);

  const toggleMic = useCallback(async () => {
    // 1. Jika belum terhubung, hubungkan terlebih dahulu
    let room = roomRef.current;
    if (!room || room.state !== "connected") {
      await connectVoice();
      room = roomRef.current;
      if (!room || room.state !== "connected") {
        hapticWarning();
        Alert.alert("Koneksi Suara", "Sedang menghubungkan ke server suara, coba lagi dalam beberapa detik.");
        return;
      }
    }

    try {
      const nextMicState = !isMicOn;

      if (nextMicState) {
        // Cek dan minta izin mikrofon di Android
        let perm = await getRecordingPermissionsAsync();
        if (!perm.granted) {
          perm = await requestRecordingPermissionsAsync();
        }

        if (!perm.granted) {
          hapticWarning();
          Alert.alert(
            "Izin Mikrofon Diperlukan",
            "Aplikasi memerlukan izin mikrofon untuk mengaktifkan suara On-Mic saat menonton bersama.",
            [{ text: "Mengerti" }]
          );
          return;
        }

        await room.localParticipant.setMicrophoneEnabled(true);
        hapticSuccess();
        setIsMicOn(true);
        setSpeakingUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      } else {
        await room.localParticipant.setMicrophoneEnabled(false);
        hapticLight();
        setIsMicOn(false);
        setSpeakingUserIds((prev) => prev.filter((id) => id !== userId));
      }
    } catch (err: any) {
      console.warn("[LiveKit Native] toggleMic error:", err);
      hapticWarning();
      Alert.alert("Gagal Mikrofon", "Tidak dapat mengubah status mikrofon.");
    }
  }, [connectVoice, isMicOn, userId]);

  const toggleDeafen = useCallback(() => {
    const nextDeafened = !isDeafened;
    setIsDeafened(nextDeafened);
    hapticLight();

    if (roomRef.current) {
      roomRef.current.remoteParticipants.forEach((p) => {
        p.audioTrackPublications.forEach((pub) => {
          pub.setSubscribed(!nextDeafened);
        });
      });
    }
  }, [isDeafened]);

  // Otomatis join voice room saat masuk ke ruang nobar agar penonton bisa langsung mendengar suara
  useEffect(() => {
    if (roomId && userId) {
      void connectVoice();
    }
    return () => {
      disconnectVoice();
    };
  }, [roomId, userId, connectVoice, disconnectVoice]);

  return {
    isConnected,
    isConnecting,
    isMicOn,
    isDeafened,
    speakingUserIds,
    error,
    toggleMic,
    toggleDeafen,
    connectVoice,
    disconnectVoice,
  };
}
