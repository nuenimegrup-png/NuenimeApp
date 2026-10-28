import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Image } from "expo-image";
import * as ScreenOrientation from "expo-screen-orientation";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Clipboard from "expo-clipboard";
import type { VideoRef, OnProgressData, OnLoadData } from "react-native-video";

import { UniversalVideo as Video } from "@/components/universal-video";
import { AppIcon } from "@/components/app-icon";
import { UserVerificationBadge } from "@/components/user-verification-badge";
import { isSpecialRole } from "@/lib/admin-service";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import {
  getNobarRoomById,
  getNobarMessages,
  sendNobarMessage,
  resolveNobarStream,
  closeNobarRoom,
  getRoomCode,
  type NobarRoom,
  type NobarMessage,
  type NobarSyncPayload,
  type NobarParticipant,
} from "@/lib/nobar-service";
import { useNobarVoice } from "@/lib/livekit-voice";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatChatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export default function NobarWatchPartyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = id as string;

  const insets = useSafeAreaInsets();
  const auth = useAnirakuAuth();
  // Safe KeepAwake (never throws unhandled NotAllowedError on web when page is hidden/unfocused)
  useEffect(() => {
    let active = true;
    if (Platform.OS === "web") {
      if (typeof document !== "undefined" && "wakeLock" in navigator) {
        let sentinel: any = null;
        const requestWakeLock = async () => {
          try {
            if (document.visibilityState === "visible" && active) {
              sentinel = await (navigator as any).wakeLock?.request("screen");
            }
          } catch {
            // Silently handle NotAllowedError if tab is not visible
          }
        };

        const handleVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            void requestWakeLock();
          }
        };

        void requestWakeLock();
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
          active = false;
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          try {
            sentinel?.release?.().catch(() => {});
          } catch {}
        };
      }
    } else {
      activateKeepAwakeAsync("nobar-watch-party").catch(() => {});
      return () => {
        try {
          void deactivateKeepAwake("nobar-watch-party").catch(() => {});
        } catch {}
      };
    }
  }, []);

  // Room Exit & Closure Modals State
  const [confirmCloseModalVisible, setConfirmCloseModalVisible] = useState(false);
  const [roomClosedModalVisible, setRoomClosedModalVisible] = useState(false);
  const [roomClosedReason, setRoomClosedReason] = useState("");
  const [closingRoomInProgress, setClosingRoomInProgress] = useState(false);
  const isLeavingRef = useRef(false);

  const videoRef = useRef<VideoRef | null>(null);

  // Room & Host State
  const [room, setRoom] = useState<NobarRoom | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [currentEpisode, setCurrentEpisode] = useState(1);

  const currentUserId = useMemo(() => {
    return auth.user?.id || "guest_viewer";
  }, [auth.user?.id]);

  const currentUserName = useMemo(() => {
    return (
      auth.profile?.display_name ||
      auth.profile?.username ||
      auth.user?.user_metadata?.full_name ||
      "Penonton"
    );
  }, [auth.profile, auth.user]);

  const currentUserAvatar = useMemo(() => {
    return auth.profile?.avatar_url || null;
  }, [auth.profile?.avatar_url]);

  const isHost = useMemo(() => {
    if (!room) return false;
    return room.host_id === currentUserId;
  }, [room, currentUserId]);

  // LiveKit RTC Voice Chat (On-Mic Realtime)
  const voice = useNobarVoice(roomId, currentUserId, currentUserName);
  const [remoteSpeakingIds, setRemoteSpeakingIds] = useState<string[]>([]);
  const speakingSet = useMemo(() => {
    return new Set([...voice.speakingUserIds, ...remoteSpeakingIds]);
  }, [voice.speakingUserIds, remoteSpeakingIds]);

  // Video Streaming State
  const [streamUri, setStreamUri] = useState<string | null>(null);
  const [streamHeaders, setStreamHeaders] = useState<Record<string, string> | undefined>();
  const [streamType, setStreamType] = useState<string | undefined>("m3u8");
  const [loadingStream, setLoadingStream] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Buffer Config standar ExoPlayer Android agar streaming HLS lancar tanpa frame drop
  const videoBufferConfig = useMemo(() => ({
    minBufferMs: 15_000,
    maxBufferMs: 120_000,
    bufferForPlaybackMs: 2_500,
    bufferForPlaybackAfterRebufferMs: 5_000,
  }), []);

  const videoSource = useMemo(() => {
    return {
      uri: streamUri || undefined,
      headers: streamHeaders,
      type: streamType || "m3u8",
      bufferConfig: videoBufferConfig,
    };
  }, [streamUri, streamHeaders, streamType, videoBufferConfig]);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync Telemetry & Anti-Flicker Refs
  const roomRef = useRef<NobarRoom | null>(null);
  roomRef.current = room;

  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const currentEpisodeRef = useRef(currentEpisode);
  currentEpisodeRef.current = currentEpisode;

  const isVideoLoadedRef = useRef(false);
  const targetSyncTimeRef = useRef<number | null>(null);
  const lastSeekAtRef = useRef(0);
  const lastSyncSentAt = useRef(0);
  const isSeekingRef = useRef(false);

  // Real-time Chat & Participants
  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat");
  const [messages, setMessages] = useState<NobarMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [participants, setParticipants] = useState<NobarParticipant[]>([]);
  const chatFlatListRef = useRef<FlatList | null>(null);

  // Episode Change Modal (Host Only)
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [newEpisodeInput, setNewEpisodeInput] = useState("");

  // 1. Fetch Room Data
  useEffect(() => {
    let mounted = true;
    const fetchRoom = async () => {
      try {
        const data = await getNobarRoomById(roomId);
        if (mounted) {
          if (data) {
            setRoom(data);
            roomRef.current = data;
            setCurrentEpisode(data.episode);
            currentEpisodeRef.current = data.episode;

            if (data.playback_time && data.playback_time > 0) {
              targetSyncTimeRef.current = data.playback_time;
              setCurrentTime(data.playback_time);
              currentTimeRef.current = data.playback_time;
            }
            if (data.is_playing) {
              setIsPlaying(true);
              isPlayingRef.current = true;
            }
          } else {
            setStreamError("Room nobar tidak ditemukan atau sudah ditutup.");
          }
        }
      } catch {
        if (mounted) setStreamError("Gagal memuat informasi room.");
      } finally {
        if (mounted) setLoadingRoom(false);
      }
    };

    void fetchRoom();
    return () => {
      mounted = false;
    };
  }, [roomId]);

  // Re-track presence secara otoritatif begitu data room termuat
  useEffect(() => {
    if (channelRef.current && room) {
      const amIHost = room.host_id === currentUserId;
      void channelRef.current.track({
        userId: currentUserId,
        name: currentUserName,
        avatar: currentUserAvatar,
        isHost: amIHost,
        role: amIHost ? "HOST" : (auth.profile?.role || "Member"),
        level: Number((auth.profile as any)?.level || 1),
        isVip: Boolean((auth.profile as any)?.is_vip),
      });
    }
  }, [room?.host_id, currentUserId, currentUserName, currentUserAvatar, auth.profile]);

  // 2. Fetch Video Stream Source
  const loadStream = useCallback(async (animeId: number, ep: number) => {
    setLoadingStream(true);
    setStreamError(null);
    isVideoLoadedRef.current = false;
    try {
      const res = await resolveNobarStream(animeId, ep);
      if (res.uri) {
        setStreamUri(res.uri);
        setStreamHeaders(res.headers);
        setStreamType(res.type || "m3u8");
      } else {
        setStreamError(res.error || "Gagal memuat link streaming anime.");
      }
    } catch (err: any) {
      setStreamError(err?.message || "Kesalahan koneksi saat memuat streaming.");
    } finally {
      setLoadingStream(false);
    }
  }, []);

  useEffect(() => {
    if (room?.anime_id && currentEpisode) {
      void loadStream(room.anime_id, currentEpisode);
    }
  }, [room?.anime_id, currentEpisode, loadStream]);

  // 3. Fetch Existing Chat Messages
  useEffect(() => {
    void getNobarMessages(roomId).then((msgs) => {
      setMessages(msgs);
    });
  }, [roomId]);

  const handleRoomEndedByHost = useCallback((reason?: string) => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    setIsPlaying(false);
    isPlayingRef.current = false;
    videoRef.current?.pause();
    setRoomClosedReason(reason || "Host telah mengakhiri sesi nobar ini.");
    setRoomClosedModalVisible(true);
  }, []);

  useEffect(() => {
    if (roomClosedModalVisible) {
      const timer = setTimeout(() => {
        router.replace("/nobar");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [roomClosedModalVisible]);

  // 4. Real-time Supabase Channel
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const channelName = `nobar:${roomId}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: currentUserId },
      },
    });

    channelRef.current = channel;

    // A. Listen to Playback Sync
    channel.on(
      "broadcast",
      { event: "nobar_sync" },
      (payload: { payload: NobarSyncPayload }) => {
        const sync = payload.payload;
        if (!sync) return;

        if (sync.type === "ROOM_CLOSED") {
          if (!isHostRef.current) {
            handleRoomEndedByHost(sync.reason);
          }
          return;
        }

        if (isHostRef.current) return;

        if (sync.type === "INITIAL_SYNC" || sync.type === "SEEK") {
          targetSyncTimeRef.current = sync.currentTime ?? 0;
          setCurrentTime(sync.currentTime ?? 0);
          currentTimeRef.current = sync.currentTime ?? 0;
          setIsPlaying(Boolean(sync.isPlaying));
          isPlayingRef.current = Boolean(sync.isPlaying);

          if (isVideoLoadedRef.current && typeof sync.currentTime === "number") {
            lastSeekAtRef.current = Date.now();
            videoRef.current?.seek(sync.currentTime);
            if (sync.isPlaying) videoRef.current?.resume();
            else videoRef.current?.pause();
          }
        } else if (sync.type === "PLAY") {
          setIsPlaying(true);
          isPlayingRef.current = true;
          videoRef.current?.resume();
        } else if (sync.type === "PAUSE") {
          setIsPlaying(false);
          isPlayingRef.current = false;
          videoRef.current?.pause();
        } else if (sync.type === "CHANGE_EPISODE") {
          if (sync.episode && sync.episode !== currentEpisodeRef.current) {
            targetSyncTimeRef.current = 0;
            setCurrentTime(0);
            currentTimeRef.current = 0;
            setCurrentEpisode(sync.episode);
            currentEpisodeRef.current = sync.episode;
          }
        } else if (sync.type === "HEARTBEAT") {
          if (typeof sync.isPlaying === "boolean" && sync.isPlaying !== isPlayingRef.current) {
            isPlayingRef.current = sync.isPlaying;
            setIsPlaying(sync.isPlaying);
            if (sync.isPlaying) videoRef.current?.resume();
            else videoRef.current?.pause();
          }

          // Anti-Kedip: toleransi drift 5 detik dan interval minimal 6 detik antar-seek
          if (typeof sync.currentTime === "number" && Number.isFinite(sync.currentTime)) {
            const drift = Math.abs(currentTimeRef.current - sync.currentTime);
            const timeSinceLastSeek = Date.now() - lastSeekAtRef.current;

            if (drift > 5.0 && timeSinceLastSeek > 6000) {
              lastSeekAtRef.current = Date.now();
              currentTimeRef.current = sync.currentTime;
              setCurrentTime(sync.currentTime);
              videoRef.current?.seek(sync.currentTime);
            }
          }
        }
      }
    );

    // B. Voice Chat on-mic state listener
    channel.on(
      "broadcast",
      { event: "voice_state" },
      (payload: { payload: { userId: string; isMicOn: boolean } }) => {
        const { userId: spkId, isMicOn: active } = payload?.payload || {};
        if (!spkId) return;
        setRemoteSpeakingIds((prev) => {
          if (active) {
            return prev.includes(spkId) ? prev : [...prev, spkId];
          } else {
            return prev.filter((id) => id !== spkId);
          }
        });
      }
    );

    // C. Host answers sync requests from new viewers
    channel.on("broadcast", { event: "request_sync" }, () => {
      if (isHostRef.current) {
        channel.send({
          type: "broadcast",
          event: "nobar_sync",
          payload: {
            type: "INITIAL_SYNC",
            currentTime: currentTimeRef.current,
            isPlaying: isPlayingRef.current,
            episode: currentEpisodeRef.current,
            timestamp: Date.now(),
            senderId: currentUserId,
          } as NobarSyncPayload,
        });
      }
    });

    // C. Listen to Realtime Chat
    channel.on(
      "broadcast",
      { event: "nobar_chat" },
      (payload: { payload: NobarMessage }) => {
        const msg = payload.payload;
        if (msg) {
          setMessages((prev) => [...prev, msg]);
        }
      }
    );

    // D. Presence Tracking
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const usersMap = new Map<string, NobarParticipant>();

        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p && p.userId) {
              const isUserHost =
                Boolean(p.isHost) ||
                (roomRef.current?.host_id ? p.userId === roomRef.current.host_id : false);
              const userRole = isUserHost ? "HOST" : (p.role || "Member");

              usersMap.set(p.userId, {
                userId: p.userId,
                name: p.name || "Penonton",
                avatar: p.avatar || null,
                isHost: isUserHost,
                role: userRole,
                level: Number(p.level || 1),
                isVip: Boolean(p.isVip),
              });
            }
          });
        });

        // Pastikan Host selalu terdaftar jika data room sudah ada
        if (roomRef.current && !usersMap.has(roomRef.current.host_id)) {
          usersMap.set(roomRef.current.host_id, {
            userId: roomRef.current.host_id,
            name: roomRef.current.host_name,
            avatar: roomRef.current.host_avatar || null,
            isHost: true,
            role: "HOST",
            level: 1,
            isVip: false,
          });
        }

        const users = Array.from(usersMap.values());
        // Host selalu berada di paling atas daftar penonton
        users.sort((a, b) => (b.isHost ? 1 : 0) - (a.isHost ? 1 : 0));
        setParticipants(users);
      })
      .on("presence", { event: "join" }, () => {
        if (isHostRef.current) {
          setTimeout(() => {
            channel.send({
              type: "broadcast",
              event: "nobar_sync",
              payload: {
                type: "INITIAL_SYNC",
                currentTime: currentTimeRef.current,
                isPlaying: isPlayingRef.current,
                episode: currentEpisodeRef.current,
                timestamp: Date.now(),
                senderId: currentUserId,
              } as NobarSyncPayload,
            });
          }, 350);
        }
      })
      // E. Room Status Postgres Changes (Listen to DELETE or status = 'closed')
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "nobar_rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE" || (payload.new as any)?.status === "closed") {
            if (!isHostRef.current) {
              handleRoomEndedByHost("Sesi nobar telah diakhiri oleh Host.");
            }
          }
        }
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const amIHost =
            Boolean(isHostRef.current) ||
            (roomRef.current?.host_id ? roomRef.current.host_id === currentUserId : false);

          await channel.track({
            userId: currentUserId,
            name: currentUserName,
            avatar: currentUserAvatar,
            isHost: amIHost,
            role: amIHost ? "HOST" : (auth.profile?.role || "Member"),
            level: Number((auth.profile as any)?.level || 1),
            isVip: Boolean((auth.profile as any)?.is_vip),
          });

          if (!amIHost) {
            channel.send({
              type: "broadcast",
              event: "request_sync",
              payload: { viewerId: currentUserId },
            });
          }
        }
      });

    return () => {
      void channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomId, currentUserId, currentUserName, currentUserAvatar, auth.profile?.role]);

  // Sync Voice On-Mic status to all room participants
  useEffect(() => {
    if (channelRef.current) {
      void channelRef.current.send({
        type: "broadcast",
        event: "voice_state",
        payload: { userId: currentUserId, isMicOn: voice.isMicOn },
      });
    }
  }, [voice.isMicOn, currentUserId]);

  // 5. Host Periodic Heartbeat Sync
  useEffect(() => {
    if (!isHost) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastSyncSentAt.current > 3500) {
        lastSyncSentAt.current = now;
        channelRef.current?.send({
          type: "broadcast",
          event: "nobar_sync",
          payload: {
            type: "HEARTBEAT",
            currentTime: currentTimeRef.current,
            isPlaying: isPlayingRef.current,
            episode: currentEpisodeRef.current,
            timestamp: now,
            senderId: currentUserId,
          } as NobarSyncPayload,
        });

        void supabase
          .from("nobar_rooms")
          .update({
            playback_time: currentTimeRef.current,
            is_playing: isPlayingRef.current,
            updated_at: new Date().toISOString(),
          })
          .eq("id", roomId);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isHost, roomId, currentUserId]);

  const triggerControls = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 4500);
  };

  // Host Action: Play / Pause
  const handleHostTogglePlay = () => {
    if (!isHost) {
      Alert.alert(
        "Mode Penonton",
        "Pemutaran video dikendalikan sepenuhnya oleh Host room."
      );
      return;
    }

    hapticLight();
    const nextPlay = !isPlaying;
    setIsPlaying(nextPlay);
    isPlayingRef.current = nextPlay;

    if (nextPlay) {
      videoRef.current?.resume();
    } else {
      videoRef.current?.pause();
    }

    channelRef.current?.send({
      type: "broadcast",
      event: "nobar_sync",
      payload: {
        type: nextPlay ? "PLAY" : "PAUSE",
        currentTime: currentTimeRef.current,
        isPlaying: nextPlay,
        episode: currentEpisode,
        timestamp: Date.now(),
        senderId: currentUserId,
      } as NobarSyncPayload,
    });

    void supabase
      .from("nobar_rooms")
      .update({
        playback_time: currentTimeRef.current,
        is_playing: nextPlay,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId);
  };

  // Host Action: Seek Forward / Rewind
  const handleHostSeekDelta = (deltaSeconds: number) => {
    if (!isHost) {
      Alert.alert("Mode Penonton", "Hanya Host yang dapat menggeser durasi video.");
      return;
    }

    hapticLight();
    const target = Math.max(0, Math.min(duration, currentTimeRef.current + deltaSeconds));
    setCurrentTime(target);
    currentTimeRef.current = target;
    lastSeekAtRef.current = Date.now();
    videoRef.current?.seek(target);

    channelRef.current?.send({
      type: "broadcast",
      event: "nobar_sync",
      payload: {
        type: "SEEK",
        currentTime: target,
        isPlaying: isPlayingRef.current,
        episode: currentEpisode,
        timestamp: Date.now(),
        senderId: currentUserId,
      } as NobarSyncPayload,
    });

    void supabase
      .from("nobar_rooms")
      .update({
        playback_time: target,
        is_playing: isPlayingRef.current,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId);
  };

  // Penonton: Sinkronisasi manual ke Host
  const handleManualSyncToHost = () => {
    hapticLight();
    channelRef.current?.send({
      type: "broadcast",
      event: "request_sync",
      payload: { viewerId: currentUserId },
    });
  };

  // Host Action: Ganti Episode
  const handleHostChangeEpisode = (ep: number) => {
    if (!isHost) return;
    hapticSuccess();
    setCurrentEpisode(ep);
    currentEpisodeRef.current = ep;
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setShowEpisodeModal(false);

    void sendNobarMessage({
      roomId,
      senderId: "system",
      senderName: "SISTEM",
      message: `Host mengganti tayangan ke Episode ${ep}`,
      isSystem: true,
    });

    channelRef.current?.send({
      type: "broadcast",
      event: "nobar_sync",
      payload: {
        type: "CHANGE_EPISODE",
        currentTime: 0,
        isPlaying: true,
        episode: ep,
        timestamp: Date.now(),
        senderId: currentUserId,
      } as NobarSyncPayload,
    });
  };

  // Kirim Pesan Chat
  const handleSendMessage = async () => {
    if (!inputText.trim() || sendingMessage) return;

    const text = inputText.trim();
    setInputText("");
    setSendingMessage(true);

    const res = await sendNobarMessage({
      roomId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderAvatar: currentUserAvatar,
      senderRole: isHost ? "HOST" : auth.profile?.role || "Member",
      senderLevel: Number((auth.profile as any)?.level || 1),
      senderIsVip: Boolean((auth.profile as any)?.is_vip),
      message: text,
    });

    setSendingMessage(false);

    if (res.success && res.data) {
      hapticLight();
      setMessages((prev) => [...prev, res.data!]);
      channelRef.current?.send({
        type: "broadcast",
        event: "nobar_chat",
        payload: res.data,
      });

      setTimeout(() => {
        chatFlatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // Toggle Fullscreen Landscape
  const toggleFullscreen = async () => {
    hapticLight();
    const target = !isFullscreen;
    setIsFullscreen(target);

    if (Platform.OS !== "web") {
      if (target) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else {
        await ScreenOrientation.unlockAsync();
      }
    }
  };

  // Host Close & Delete Room Flow
  const handleConfirmCloseRoom = async () => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    setClosingRoomInProgress(true);

    try {
      // 1. Broadcast ROOM_CLOSED to all connected viewers so they exit immediately
      channelRef.current?.send({
        type: "broadcast",
        event: "nobar_sync",
        payload: {
          type: "ROOM_CLOSED",
          timestamp: Date.now(),
          senderId: currentUserId,
          reason: "Host telah keluar dan mengakhiri sesi nobar.",
        } as NobarSyncPayload,
      });

      // 2. Close & delete room from supabase
      await closeNobarRoom(roomId, currentUserId);
    } catch {
      // Continue cleanup
    } finally {
      setConfirmCloseModalVisible(false);
      setClosingRoomInProgress(false);
      router.replace("/nobar");
    }
  };

  // Clean Exit (Host opens confirmation, Viewer exits directly)
  const handleExit = useCallback(() => {
    if (isFullscreen) {
      void toggleFullscreen();
      return;
    }

    if (isHost) {
      setConfirmCloseModalVisible(true);
    } else {
      router.back();
    }
  }, [isFullscreen, isHost]);

  // Intercept Android hardware back button
  useEffect(() => {
    const onBackPress = () => {
      handleExit();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [handleExit]);

  if (loadingRoom) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="small" color="#CBD5E1" />
        <Text style={styles.loadingText}>Menghubungkan ke room nobar...</Text>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={[styles.container, styles.center]}>
        <AppIcon name="alert-circle" size={40} color="#EF4444" />
        <Text style={styles.errorTitle}>Room Tidak Ditemukan</Text>
        <Text style={styles.errorSubtitle}>Room mungkin telah ditutup oleh Host.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtnAction}>
          <Text style={styles.backBtnActionText}>Kembali ke Lobby</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* ── TOP NAV BAR (PORTRAIT ONLY - SILVER GLASS THEME) ── */}
      {!isFullscreen && (
        <View style={styles.topBar}>
          <Pressable onPress={handleExit} style={styles.exitBtn} hitSlop={10}>
            <AppIcon name="arrow-left" size={18} color="#FFFFFF" />
          </Pressable>

          <View style={styles.topBarInfo}>
            <View style={styles.topBarTitleRow}>
              <Text style={styles.topBarTitle} numberOfLines={1}>
                {room.title}
              </Text>
              <Pressable
                onPress={() => {
                  void Clipboard.setStringAsync(getRoomCode(room));
                  hapticSuccess();
                  Alert.alert(
                    "Tag Room Disalin",
                    `Tag ${getRoomCode(room)} telah disalin. Bagikan ke teman agar mudah mencari room ini!`
                  );
                }}
                style={({ pressed }) => [styles.roomTagHeaderBadge, pressed && styles.btnPressed]}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Salin Tag Room"
              >
                <AppIcon name="pound" size={9} color="#E2E8F0" />
                <Text style={styles.roomTagHeaderText}>{getRoomCode(room)}</Text>
              </Pressable>
              <View style={styles.liveBadgeTop}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.topBarSub} numberOfLines={1}>
              Tag {getRoomCode(room)} • {room.anime_title} • Eps {currentEpisode}
            </Text>
          </View>

          <View style={styles.topBarRightActions}>
            {/* LiveKit Voice Chat Pill */}
            <Pressable
              onPress={() => {
                hapticLight();
                void voice.toggleMic();
              }}
              style={({ pressed }) => [
                styles.voiceTopPill,
                voice.isMicOn && styles.voiceTopPillActive,
                pressed && styles.btnPressed,
              ]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={voice.isMicOn ? "Matikan Mic" : "Nyalakan Mic"}
            >
              <AppIcon
                name={voice.isMicOn ? "microphone" : "microphone-off"}
                size={13}
                color={voice.isMicOn ? "#10B981" : "#94A3B8"}
              />
              <Text
                style={[
                  styles.voiceTopPillText,
                  voice.isMicOn && styles.voiceTopPillTextActive,
                ]}
              >
                {voice.isConnecting
                  ? "Hubung..."
                  : voice.isMicOn
                  ? "Mic ON"
                  : "On Mic"}
              </Text>
            </Pressable>

            <View style={styles.viewerCountPill}>
              <AppIcon name="account-group" size={14} color="#CBD5E1" />
              <Text style={styles.viewerCountText}>{participants.length || 1}</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── VIDEO PLAYER CONTAINER ── */}
      <View style={[styles.playerContainer, isFullscreen && styles.playerFullscreen]}>
        {loadingStream ? (
          <View style={styles.playerFallbackBox}>
            <ActivityIndicator size="small" color="#CBD5E1" />
            <Text style={styles.playerLoadingText}>Memuat tayangan video...</Text>
          </View>
        ) : streamError ? (
          <View style={styles.playerFallbackBox}>
            <AppIcon name="alert-circle" size={32} color="#EF4444" />
            <Text style={styles.playerErrorTitle}>Gagal Memutar Video</Text>
            <Text style={styles.playerErrorSub}>{streamError}</Text>
            {isHost && (
              <Pressable
                onPress={() => loadStream(room.anime_id, currentEpisode)}
                style={styles.retryBtn}
              >
                <AppIcon name="refresh" size={14} color="#0B0E17" />
                <Text style={styles.retryBtnText}>Coba Lagi</Text>
              </Pressable>
            )}
          </View>
        ) : streamUri ? (
          <Pressable onPress={triggerControls} style={StyleSheet.absoluteFillObject}>
            <Video
              ref={videoRef}
              source={videoSource}
              style={StyleSheet.absoluteFillObject}
              resizeMode="contain"
              paused={!isPlaying}
              muted={isMuted}
              onLoad={(data: OnLoadData) => {
                setDuration(data.duration);
                isVideoLoadedRef.current = true;
                setStreamError(null);
                if (!isHostRef.current) {
                  const target = targetSyncTimeRef.current;
                  if (target !== null && target > 0) {
                    lastSeekAtRef.current = Date.now();
                    videoRef.current?.seek(target);
                    setCurrentTime(target);
                    currentTimeRef.current = target;
                  }
                  if (isPlayingRef.current || roomRef.current?.is_playing) {
                    setIsPlaying(true);
                    isPlayingRef.current = true;
                    videoRef.current?.resume();
                  }
                } else {
                  setIsPlaying(true);
                  isPlayingRef.current = true;
                  videoRef.current?.resume();
                }
              }}
              onProgress={(data: OnProgressData) => {
                currentTimeRef.current = data.currentTime;
                if (!isSeekingRef.current) {
                  setCurrentTime(data.currentTime);
                }
              }}
              onBuffer={({ isBuffering: buf }) => setIsBuffering(buf)}
              onError={(err) => {
                console.warn("[Nobar Video playback error]:", err);
              }}
            />

            {/* Buffering Indicator */}
            {isBuffering && (
              <View style={styles.bufferingOverlay} pointerEvents="none">
                <ActivityIndicator size="small" color="#CBD5E1" />
              </View>
            )}

            {/* ── PLAYER CONTROLS OVERLAY (SILVER THEME) ── */}
            {showControls && (
              <View style={styles.controlsOverlay}>
                {/* Host vs Viewer Indicator Bar */}
                <View style={styles.controlsTopRow}>
                  {isHost ? (
                    <View style={styles.hostControlBadge}>
                      <AppIcon name="crown" size={12} color="#E2E8F0" />
                      <Text style={styles.hostControlText}>Anda Host (Kontrol Aktif)</Text>
                    </View>
                  ) : (
                    <View style={{ flex: 1 }} />
                  )}

                  <View style={styles.controlsRightActions}>

                    <Pressable
                      onPress={() => setIsMuted((m) => !m)}
                      style={styles.controlIconBtn}
                      hitSlop={8}
                    >
                      <AppIcon
                        name={isMuted ? "volume-off" : "volume-high"}
                        size={17}
                        color="#FFFFFF"
                      />
                    </Pressable>

                    <Pressable
                      onPress={toggleFullscreen}
                      style={styles.controlIconBtn}
                      hitSlop={8}
                    >
                      <AppIcon
                        name={isFullscreen ? "fullscreen-exit" : "fullscreen"}
                        size={18}
                        color="#FFFFFF"
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Center Action Buttons */}
                <View style={styles.controlsCenterRow}>
                  {isHost ? (
                    <>
                      <Pressable
                        onPress={() => handleHostSeekDelta(-10)}
                        style={styles.controlCenterBtn}
                        hitSlop={10}
                      >
                        <AppIcon name="rewind-10" size={26} color="#FFFFFF" />
                      </Pressable>

                      <Pressable
                        onPress={handleHostTogglePlay}
                        style={styles.playPauseLargeBtn}
                        hitSlop={10}
                      >
                        <AppIcon
                          name={isPlaying ? "pause" : "play"}
                          size={32}
                          color="#0B0E17"
                        />
                      </Pressable>

                      <Pressable
                        onPress={() => handleHostSeekDelta(10)}
                        style={styles.controlCenterBtn}
                        hitSlop={10}
                      >
                        <AppIcon name="fast-forward-10" size={26} color="#FFFFFF" />
                      </Pressable>
                    </>
                  ) : (
                    <View style={styles.viewerCenterInfo}>
                      <View style={styles.viewerPlayIcon}>
                        <AppIcon
                          name={isPlaying ? "play" : "pause"}
                          size={22}
                          color="#CBD5E1"
                        />
                      </View>
                      <Text style={styles.viewerSyncText}>
                        {isPlaying ? "Memutar secara sinkron" : "Dijeda oleh Host"}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Bottom Scrubber & Time Row */}
                <View style={styles.controlsBottomRow}>
                  <Text style={styles.timeLabel}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </Text>

                  {/* Scrubber Progress Bar */}
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(
                            100,
                            Math.max(0, (currentTime / (duration || 1)) * 100)
                          )}%`,
                        },
                      ]}
                    />
                  </View>

                  {isHost && (
                    <Pressable
                      onPress={() => setShowEpisodeModal(true)}
                      style={styles.changeEpsPill}
                    >
                      <Text style={styles.changeEpsText}>Eps {currentEpisode}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}
          </Pressable>
        ) : null}
      </View>

      {/* ── LOWER SECTION: CHAT & PARTICIPANTS (SILVER LIQUID GLASS) ── */}
      {!isFullscreen && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.lowerSection}
        >
          {/* Sub Navigation Tabs (Persis tabPill di LibraryView) */}
          <View style={styles.sectionTabs}>
            <Pressable
              onPress={() => setActiveTab("chat")}
              style={[styles.sectionTab, activeTab === "chat" && styles.sectionTabActive]}
            >
              <AppIcon
                name="chat"
                size={14}
                color={activeTab === "chat" ? "#E2E8F0" : "#94A3B8"}
              />
              <Text
                style={[
                  styles.sectionTabText,
                  activeTab === "chat" && styles.sectionTabTextActive,
                ]}
              >
                Live Chat ({messages.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("participants")}
              style={[
                styles.sectionTab,
                activeTab === "participants" && styles.sectionTabActive,
              ]}
            >
              <AppIcon
                name="account-group"
                size={14}
                color={activeTab === "participants" ? "#E2E8F0" : "#94A3B8"}
              />
              <Text
                style={[
                  styles.sectionTabText,
                  activeTab === "participants" && styles.sectionTabTextActive,
                ]}
              >
                Penonton ({participants.length || 1})
              </Text>
            </Pressable>
          </View>

          {/* TAB 1: LIVE CHAT */}
          {activeTab === "chat" ? (
            <View style={styles.chatWrapper}>
              <FlatList
                ref={chatFlatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.chatList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  if (item.is_system) {
                    return (
                      <View style={styles.systemMessageWrap}>
                        <AppIcon name="information-outline" size={13} color="#94A3B8" />
                        <Text style={styles.systemMessageText}>{item.message}</Text>
                      </View>
                    );
                  }

                  const isSenderHost =
                    item.sender_role === "HOST" ||
                    (room?.host_id ? item.sender_id === room.host_id : false);
                  const isSenderSpecial = isSpecialRole(item.sender_role);

                  return (
                    <View style={styles.chatRow}>
                      {item.sender_avatar ? (
                        <Image
                          source={{ uri: item.sender_avatar }}
                          style={styles.chatAvatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.chatAvatarPlaceholder}>
                          <Text style={styles.chatAvatarInitial}>
                            {(item.sender_name || "U").charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View style={styles.chatBubble}>
                        <View style={styles.chatHeaderRow}>
                          <Text style={styles.chatSenderName} numberOfLines={1}>
                            {item.sender_name}
                          </Text>

                          <UserVerificationBadge
                            role={isSenderHost ? "HOST" : item.sender_role}
                            isVip={item.sender_is_vip}
                            size={12}
                          />

                          <View style={styles.chatLevelPill}>
                            <Text style={styles.chatLevelPillText}>
                              Lvl {item.sender_level || 1}
                            </Text>
                          </View>

                          {isSenderHost ? (
                            <View style={styles.chatHostBadge}>
                              <Text style={styles.chatHostBadgeText}>HOST</Text>
                            </View>
                          ) : isSenderSpecial ? (
                            <View style={styles.chatSpecialBadge}>
                              <Text style={styles.chatSpecialBadgeText}>
                                {(item.sender_role || "ADMIN").toUpperCase()}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.chatMemberBadge}>
                              <Text style={styles.chatMemberBadgeText}>MEMBER</Text>
                            </View>
                          )}

                          <Text style={styles.chatTime}>{formatChatTime(item.created_at)}</Text>
                        </View>

                        <Text style={styles.chatMessageText}>{item.message}</Text>
                      </View>
                    </View>
                  );
                }}
              />

              {/* Chat Input Bar */}
              <View style={[styles.chatInputBar, { paddingBottom: Math.max(8, insets.bottom) }]}>
                {/* Voice Mic Toggle in Chat Bar */}
                <Pressable
                  onPress={() => {
                    hapticLight();
                    void voice.toggleMic();
                  }}
                  style={({ pressed }) => [
                    styles.chatMicBtn,
                    voice.isMicOn && styles.chatMicBtnActive,
                    pressed && styles.btnPressed,
                  ]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={voice.isMicOn ? "Matikan Mic" : "Nyalakan Mic"}
                >
                  <AppIcon
                    name={voice.isMicOn ? "microphone" : "microphone-off"}
                    size={16}
                    color={voice.isMicOn ? "#10B981" : "#94A3B8"}
                  />
                </Pressable>

                <TextInput
                  style={styles.chatTextInput}
                  placeholder="Kirim pesan ke room..."
                  placeholderTextColor="#64748B"
                  value={inputText}
                  onChangeText={setInputText}
                  maxLength={300}
                />
                <Pressable
                  onPress={handleSendMessage}
                  disabled={!inputText.trim() || sendingMessage}
                  style={[
                    styles.sendBtn,
                    (!inputText.trim() || sendingMessage) && styles.sendBtnDisabled,
                  ]}
                >
                  <AppIcon name="send" size={14} color="#0B0E17" />
                </Pressable>
              </View>
            </View>
          ) : (
            /* TAB 2: DAFTAR PENONTON (STYLE PERSIS GLASSCARD) */
            <FlatList
              data={participants}
              keyExtractor={(item, index) => item.userId + index}
              style={styles.flexList}
              contentContainerStyle={styles.participantsList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isItemHost =
                  Boolean(item.isHost) ||
                  (room?.host_id ? item.userId === room.host_id : false);
                const isSpecial = isSpecialRole(item.role);
                const isSpeaking = speakingSet.has(item.userId);

                return (
                  <View style={styles.participantRow}>
                    {item.avatar ? (
                      <Image
                        source={{ uri: item.avatar }}
                        style={[
                          styles.participantAvatar,
                          isSpeaking && styles.participantAvatarSpeaking,
                        ]}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.participantPlaceholderAvatar,
                          isSpeaking && styles.participantAvatarSpeaking,
                        ]}
                      >
                        <Text style={styles.participantInitial}>
                          {(item.name || "U").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.participantMeta}>
                      <View style={styles.participantNameRow}>
                        <Text style={styles.participantName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <UserVerificationBadge
                          role={isItemHost ? "HOST" : item.role}
                          isVip={item.isVip}
                          size={13}
                        />
                        <View style={styles.levelBadgePill}>
                          <Text style={styles.levelBadgeText}>Lvl {item.level || 1}</Text>
                        </View>
                        {isSpeaking ? (
                          <View style={styles.speakingBadge}>
                            <AppIcon name="microphone" size={10} color="#10B981" />
                            <Text style={styles.speakingBadgeText}>Bicara</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.participantStatus}>
                        {isItemHost ? "Pembuat Room (Host)" : "Anggota Menonton"}
                      </Text>
                    </View>

                    {isItemHost ? (
                      <View style={styles.hostRolePill}>
                        <AppIcon name="crown" size={11} color="#E2E8F0" />
                        <Text style={styles.hostRoleText}>HOST</Text>
                      </View>
                    ) : isSpecial ? (
                      <View style={styles.specialRolePill}>
                        <Text style={styles.specialRoleText}>
                          {(item.role || "ADMIN").toUpperCase()}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.memberRolePill}>
                        <Text style={styles.memberRoleText}>MEMBER</Text>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          )}
        </KeyboardAvoidingView>
      )}

      {/* ── MODAL: GANTI EPISODE (HOST ONLY - SILVER THEME) ── */}
      <Modal
        visible={showEpisodeModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEpisodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.episodeModalCard}>
            <Text style={styles.episodeModalTitle}>Ganti Episode</Text>
            <Text style={styles.episodeModalSub}>
              Episode baru akan langsung disinkronkan ke seluruh penonton.
            </Text>

            <TextInput
              style={styles.episodeModalInput}
              placeholder="Nomor episode (contoh: 2)"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={newEpisodeInput}
              onChangeText={setNewEpisodeInput}
            />

            <View style={styles.episodeModalActions}>
              <Pressable
                onPress={() => setShowEpisodeModal(false)}
                style={styles.episodeCancelBtn}
              >
                <Text style={styles.episodeCancelText}>Batal</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  const epNum = parseInt(newEpisodeInput.trim(), 10);
                  if (isNaN(epNum) || epNum < 1) {
                    Alert.alert("Perhatian", "Nomor episode tidak valid.");
                    return;
                  }
                  handleHostChangeEpisode(epNum);
                }}
                style={styles.episodeApplyBtn}
              >
                <Text style={styles.episodeApplyText}>Ganti</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: KONFIRMASI TUTUP ROOM (HOST ONLY - SILVER THEME) ── */}
      <Modal
        visible={confirmCloseModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (!closingRoomInProgress) setConfirmCloseModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <View style={styles.confirmModalIconWrap}>
              <AppIcon name="door-open" size={24} color="#E2E8F0" />
            </View>
            <Text style={styles.confirmModalTitle}>Tutup Sesi Nobar?</Text>
            <Text style={styles.confirmModalSub}>
              Keluar dari room akan menghapus room ini dan otomatis mengeluarkan seluruh penonton yang sedang menonton.
            </Text>

            <View style={styles.confirmModalActions}>
              <Pressable
                disabled={closingRoomInProgress}
                onPress={() => setConfirmCloseModalVisible(false)}
                style={styles.confirmCancelBtn}
              >
                <Text style={styles.confirmCancelText}>Batal</Text>
              </Pressable>

              <Pressable
                disabled={closingRoomInProgress}
                onPress={handleConfirmCloseRoom}
                style={styles.confirmExitBtn}
              >
                {closingRoomInProgress ? (
                  <ActivityIndicator size="small" color="#0B0E17" />
                ) : (
                  <Text style={styles.confirmExitText}>Tutup & Hapus</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: SESI NOBAR SELESAI (VIEWER NOTIFIKASI - SILVER THEME) ── */}
      <Modal
        visible={roomClosedModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => {
          router.replace("/nobar");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <View style={styles.confirmModalIconWrap}>
              <AppIcon name="film-strip" size={24} color="#CBD5E1" />
            </View>
            <Text style={styles.confirmModalTitle}>Sesi Nobar Selesai</Text>
            <Text style={styles.confirmModalSub}>
              {roomClosedReason || "Host telah mengakhiri sesi nobar ini. Terima kasih telah menonton bersama!"}
            </Text>

            <Pressable
              onPress={() => router.replace("/nobar")}
              style={styles.confirmDismissBtn}
            >
              <Text style={styles.confirmDismissText}>Kembali ke Lobby</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E17",
    height: Platform.OS === "web" ? ("100vh" as any) : "100%",
    maxHeight: Platform.OS === "web" ? ("100vh" as any) : undefined,
    overflow: "hidden",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    fontFamily: "Nunito-Regular",
    marginTop: 10,
    fontSize: 12,
    color: "#94A3B8",
  },
  errorTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 16,
    color: "#FFFFFF",
    marginTop: 10,
  },
  errorSubtitle: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4,
  },
  backBtnAction: {
    marginTop: 16,
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6,
  },
  backBtnActionText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#0B0E17",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  exitBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarInfo: {
    flex: 1,
    marginLeft: 10,
  },
  topBarTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topBarTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
    maxWidth: "55%",
  },
  roomTagHeaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    gap: 2,
  },
  roomTagHeaderText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  btnPressed: {
    opacity: 0.7,
  },
  liveBadgeTop: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    gap: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#EF4444",
  },
  liveBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 8.5,
    color: "#EF4444",
    letterSpacing: 0.5,
  },
  topBarSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  topBarRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voiceTopPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 4,
  },
  voiceTopPillActive: {
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  voiceTopPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  voiceTopPillTextActive: {
    color: "#10B981",
  },
  viewerCountPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    gap: 4,
  },
  viewerCountText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#CBD5E1",
  },
  playerContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000000",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  playerFullscreen: {
    flex: 1,
    aspectRatio: undefined,
  },
  playerFallbackBox: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  playerLoadingText: {
    fontFamily: "Nunito-Regular",
    marginTop: 8,
    fontSize: 12,
    color: "#94A3B8",
  },
  playerErrorTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#FFFFFF",
    marginTop: 8,
  },
  playerErrorSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 3,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 10,
    gap: 4,
  },
  retryBtnText: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
    color: "#0B0E17",
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "space-between",
    padding: 12,
  },
  controlsTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hostControlBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.3)",
    gap: 4,
  },
  hostControlText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#E2E8F0",
  },
  viewerControlBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    gap: 4,
  },
  viewerControlText: {
    fontFamily: "Nunito-Regular",
    fontSize: 9.5,
    color: "#CBD5E1",
  },
  controlsRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.3)",
    gap: 4,
  },
  syncBtnText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#E2E8F0",
  },
  controlIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlsCenterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 30,
  },
  controlCenterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  playPauseLargeBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerCenterInfo: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.68)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  viewerPlayIcon: {
    marginBottom: 3,
  },
  viewerSyncText: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 11,
    color: "#E2E8F0",
  },
  controlsBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeLabel: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#FFFFFF",
    minWidth: 68,
  },
  progressBarTrack: {
    flex: 1,
    height: 3.5,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#E2E8F0",
  },
  changeEpsPill: {
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  changeEpsText: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#FFFFFF",
  },
  lowerSection: {
    flex: 1,
    minHeight: 0,
    backgroundColor: "#0B0E17",
    overflow: "hidden",
  },
  flexList: {
    flex: 1,
    minHeight: 0,
  },
  // Sub Navigation Tabs (Persis tabPill LibraryView)
  sectionTabs: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  sectionTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 6,
  },
  sectionTabActive: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(226, 232, 240, 0.35)",
  },
  sectionTabText: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#94A3B8",
  },
  sectionTabTextActive: {
    color: "#E2E8F0",
    fontFamily: "Nunito-Black",
  },
  chatWrapper: {
    flex: 1,
  },
  chatList: {
    padding: 12,
    gap: 8,
  },
  systemMessageWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignSelf: "center",
    marginVertical: 4,
    gap: 5,
  },
  systemMessageText: {
    fontFamily: "Nunito-Regular",
    fontSize: 10.5,
    color: "#94A3B8",
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  chatAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#161B26",
  },
  chatAvatarPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatAvatarInitial: {
    fontFamily: "Nunito-Black",
    fontSize: 10,
    color: "#CBD5E1",
  },
  chatBubble: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  chatHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  chatSenderName: {
    fontFamily: "Nunito-Bold",
    fontSize: 11,
    color: "#CBD5E1",
    marginRight: 6,
  },
  chatHostBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.3)",
    marginRight: 6,
  },
  chatHostBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 8,
    color: "#E2E8F0",
  },
  chatTime: {
    fontFamily: "Nunito-Regular",
    fontSize: 9,
    color: "#64748B",
    marginLeft: "auto",
  },
  chatMessageText: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#FFFFFF",
    lineHeight: 16,
  },
  chatInputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "#0B0E17",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    gap: 8,
  },
  chatMicBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatMicBtnActive: {
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
  participantsList: {
    padding: 12,
    gap: 8,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 27, 38, 0.72)",
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  participantAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  participantAvatarSpeaking: {
    borderWidth: 2,
    borderColor: "#10B981",
  },
  speakingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    gap: 3,
  },
  speakingBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    color: "#10B981",
  },
  participantPlaceholderAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  participantInitial: {
    fontFamily: "Nunito-Black",
    fontSize: 11,
    color: "#CBD5E1",
  },
  participantMeta: {
    flex: 1,
    marginLeft: 10,
  },
  participantNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "nowrap",
  },
  participantName: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FFFFFF",
    maxWidth: 160,
  },
  participantStatus: {
    fontFamily: "Nunito-Regular",
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 1,
  },
  levelBadgePill: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  levelBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9,
    color: "#CBD5E1",
  },
  hostRolePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.3)",
    gap: 3,
  },
  hostRoleText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    color: "#E2E8F0",
  },
  specialRolePill: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  specialRoleText: {
    fontFamily: "Nunito-Black",
    fontSize: 9.5,
    color: "#EF4444",
  },
  memberRolePill: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  memberRoleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#38BDF8",
  },
  viewerRolePill: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  viewerRoleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 9.5,
    color: "#94A3B8",
  },
  chatLevelPill: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginRight: 4,
  },
  chatLevelPillText: {
    fontFamily: "Nunito-Bold",
    fontSize: 8.5,
    color: "#CBD5E1",
  },
  chatSpecialBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    marginRight: 6,
  },
  chatSpecialBadgeText: {
    fontFamily: "Nunito-Black",
    fontSize: 8,
    color: "#EF4444",
  },
  chatMemberBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    marginRight: 6,
  },
  chatMemberBadgeText: {
    fontFamily: "Nunito-Bold",
    fontSize: 8,
    color: "#38BDF8",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  episodeModalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#131722",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  episodeModalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 15,
    color: "#FFFFFF",
  },
  episodeModalSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#94A3B8",
    marginTop: 3,
    lineHeight: 16,
  },
  episodeModalInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginTop: 12,
    textAlign: "center",
  },
  episodeModalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  episodeCancelBtn: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  episodeCancelText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    color: "#94A3B8",
  },
  episodeApplyBtn: {
    flex: 1,
    backgroundColor: "#E2E8F0",
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: "center",
  },
  episodeApplyText: {
    fontFamily: "Nunito-Black",
    fontSize: 12,
    color: "#0B0E17",
  },
  confirmModalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "rgba(19, 23, 34, 0.95)",
    borderRadius: 14,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
  },
  confirmModalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  confirmModalTitle: {
    fontFamily: "Nunito-Black",
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: "center",
  },
  confirmModalSub: {
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  confirmModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    width: "100%",
  },
  confirmCancelBtn: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 10,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
  },
  confirmCancelText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#CBD5E1",
  },
  confirmExitBtn: {
    flex: 1.2,
    backgroundColor: "#E2E8F0",
    paddingVertical: 10,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmExitText: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#0B0E17",
  },
  confirmDismissBtn: {
    width: "100%",
    backgroundColor: "#E2E8F0",
    paddingVertical: 11,
    borderRadius: 7,
    alignItems: "center",
    marginTop: 18,
  },
  confirmDismissText: {
    fontFamily: "Nunito-Black",
    fontSize: 12.5,
    color: "#0B0E17",
  },
});
