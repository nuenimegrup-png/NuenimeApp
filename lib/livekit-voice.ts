import { useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import { SignJWT } from "jose";
import { Room, RoomEvent, Track, type Participant } from "livekit-client";

const LIVEKIT_URL =
  process.env.EXPO_PUBLIC_LIVEKIT_URL ||
  "wss://nuenime-nobar-h2gtgeqn.livekit.cloud";
const LIVEKIT_API_KEY = "APIEwYtdEeibv9m";
const LIVEKIT_API_SECRET = "YeBHtQxw0AebOfkbb2wZESAG37Dhi7PbQjKaO2E9yTuA";

/**
 * Membuat token LiveKit JWT secara aman (resilient: fetch backend atau direct jose fallback)
 */
export async function getLiveKitVoiceToken(
  roomId: string,
  userId: string,
  userName: string
): Promise<string> {
  // 1. Coba request ke backend server Express jika aktif
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const resp = await fetch(
      `/api/nobar/voice-token?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (resp.ok) {
      const data = await resp.json();
      if (data?.token) return data.token;
    }
  } catch {}

  // 2. Fallback instan menggunakan jose JWT signing
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
 * React Hook untuk Voice Chat LiveKit di Room Nobar
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

  const connectVoice = useCallback(async () => {
    if (roomRef.current?.state === "connected") return;
    setIsConnecting(true);
    setError(null);

    try {
      const token = await getLiveKitVoiceToken(roomId, userId, userName);

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const ids = speakers.map((s) => s.identity).filter(Boolean);
        setSpeakingUserIds(ids);
      });

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          try {
            if (Platform.OS === "web") {
              const audioEl = track.attach();
              audioEl.id = `lk-audio-${track.sid}`;
            }
          } catch {}
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        try {
          if (Platform.OS === "web") {
            track.detach();
          }
        } catch {}
      });

      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setIsMicOn(false);
        setSpeakingUserIds([]);
      });

      await room.connect(LIVEKIT_URL, token);
      roomRef.current = room;
      setIsConnected(true);
      setIsConnecting(false);
    } catch (err: any) {
      console.warn("[LiveKit Voice] connect error:", err);
      setError("Gagal terhubung ke voice server.");
      setIsConnecting(false);
    }
  }, [roomId, userId, userName]);

  const disconnectVoice = useCallback(() => {
    try {
      roomRef.current?.disconnect();
    } catch {}
    roomRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
    setIsMicOn(false);
    setSpeakingUserIds([]);
  }, []);

  const toggleMic = useCallback(async () => {
    if (!roomRef.current || roomRef.current.state !== "connected") {
      // Jika belum terhubung, hubungkan dulu lalu nyalakan mic
      await connectVoice();
      try {
        if (roomRef.current) {
          await roomRef.current.localParticipant.setMicrophoneEnabled(true);
          setIsMicOn(true);
        }
      } catch (err) {
        console.warn("[LiveKit Voice] mic enable error:", err);
      }
      return;
    }

    try {
      const nextState = !isMicOn;
      await roomRef.current.localParticipant.setMicrophoneEnabled(nextState);
      setIsMicOn(nextState);
    } catch (err) {
      console.warn("[LiveKit Voice] toggleMic error:", err);
    }
  }, [connectVoice, isMicOn]);

  const toggleDeafen = useCallback(() => {
    const nextDeafened = !isDeafened;
    setIsDeafened(nextDeafened);

    if (roomRef.current) {
      roomRef.current.remoteParticipants.forEach((p) => {
        p.audioTrackPublications.forEach((pub) => {
          pub.setSubscribed(!nextDeafened);
        });
      });
    }
  }, [isDeafened]);

  useEffect(() => {
    return () => {
      disconnectVoice();
    };
  }, [disconnectVoice]);

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
