import { useState, useCallback } from "react";
import { Alert } from "react-native";

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
 * Native implementation (Android & iOS).
 * LiveKit WebRTC is safely isolated to avoid Hermes startup crashes on native APKs.
 */
export function useNobarVoice(
  _roomId: string,
  _userId: string,
  _userName: string
): UseNobarVoiceResult {
  const [isConnected] = useState(false);
  const [isConnecting] = useState(false);
  const [isMicOn] = useState(false);
  const [isDeafened] = useState(false);
  const [speakingUserIds] = useState<string[]>([]);
  const [error] = useState<string | null>(null);

  const connectVoice = useCallback(async () => {}, []);
  const disconnectVoice = useCallback(() => {}, []);
  const toggleDeafen = useCallback(() => {}, []);

  const toggleMic = useCallback(async () => {
    Alert.alert(
      "Voice Chat Nobar",
      "Fitur on-mic suara saat ini sedang dioptimalkan untuk versi Android dan aktif di browser Web.",
      [{ text: "Mengerti" }]
    );
  }, []);

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

export async function getLiveKitVoiceToken(
  _roomId: string,
  _userId: string,
  _userName: string
): Promise<string> {
  return "";
}
