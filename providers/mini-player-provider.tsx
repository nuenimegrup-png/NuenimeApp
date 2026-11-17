import React, { createContext, useContext, useState, useCallback, useMemo, useRef, type PropsWithChildren } from "react";
import { router } from "expo-router";

export type MiniPlayerData = {
  animeId: number;
  episode: number;
  animeTitle: string;
  episodeTitle: string;
  thumbnail: string;
  videoSourceUri: string;
  videoSourceHeaders?: Record<string, string>;
  videoContentType?: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  cachedStream?: any;
  cachedSource?: any;
  cachedProvider?: any;
  cachedProviders?: any;
  cachedServerIndex?: number;
  cachedQuality?: any;
  cachedLanguage?: any;
};

export type MiniPlayerContextValue = {
  playerData: MiniPlayerData | null;
  isMinimized: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  getCurrentTime: () => number;
  minimizePlayer: (data: MiniPlayerData) => void;
  restorePlayer: () => void;
  closeMiniPlayer: () => void;
  togglePlayPause: () => void;
  setIsPlaying: (playing: boolean) => void;
  updatePlaybackTime: (time: number, duration?: number) => void;
};

const MiniPlayerContext = createContext<MiniPlayerContextValue | null>(null);

export function MiniPlayerProvider({ children }: PropsWithChildren) {
  const [playerData, setPlayerData] = useState<MiniPlayerData | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const currentTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  const minimizePlayer = useCallback((data: MiniPlayerData) => {
    setPlayerData(data);
    currentTimeRef.current = data.currentTime;
    durationRef.current = data.duration || 0;
    setIsPlaying(data.isPlaying);
    setIsMinimized(true);
  }, []);

  const closeMiniPlayer = useCallback(() => {
    setIsMinimized(false);
    setIsPlaying(false);
    setPlayerData(null);
    currentTimeRef.current = 0;
    durationRef.current = 0;
  }, []);

  const restorePlayer = useCallback(() => {
    if (!playerData) return;
    setIsMinimized(false);
    router.push({
      pathname: "/watch/[id]",
      params: {
        id: String(playerData.animeId),
        episode: String(playerData.episode),
        title: playerData.animeTitle,
        image: playerData.thumbnail,
        resumeTime: String(Math.floor(currentTimeRef.current)),
        fromMini: "1",
      },
    } as never);
  }, [playerData]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const updatePlaybackTime = useCallback((time: number, dur?: number) => {
    if (Number.isFinite(time)) {
      currentTimeRef.current = time;
    }
    if (dur && Number.isFinite(dur) && dur > 0) {
      durationRef.current = dur;
    }
  }, []);

  const getCurrentTime = useCallback(() => currentTimeRef.current, []);

  const value = useMemo<MiniPlayerContextValue>(
    () => ({
      playerData,
      isMinimized,
      isPlaying,
      currentTime: currentTimeRef.current,
      duration: durationRef.current,
      getCurrentTime,
      minimizePlayer,
      restorePlayer,
      closeMiniPlayer,
      togglePlayPause,
      setIsPlaying,
      updatePlaybackTime,
    }),
    [
      playerData,
      isMinimized,
      isPlaying,
      getCurrentTime,
      minimizePlayer,
      restorePlayer,
      closeMiniPlayer,
      togglePlayPause,
      updatePlaybackTime,
    ]
  );

  return <MiniPlayerContext.Provider value={value}>{children}</MiniPlayerContext.Provider>;
}

export function useMiniPlayer(): MiniPlayerContextValue {
  const ctx = useContext(MiniPlayerContext);
  if (!ctx) {
    throw new Error("useMiniPlayer must be used within a MiniPlayerProvider");
  }
  return ctx;
}

