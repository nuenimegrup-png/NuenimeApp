import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { OnProgressData, OnLoadData, OnBufferData, VideoRef } from "react-native-video";
import Hls from "hls.js";

export type UniversalVideoProps = {
  source?: {
    uri?: string;
    headers?: Record<string, string>;
    type?: string;
    bufferConfig?: any;
  };
  paused?: boolean;
  rate?: number;
  resizeMode?: "contain" | "cover" | "stretch";
  muted?: boolean;
  volume?: number;
  maxBitRate?: number;
  onLoad?: (data: OnLoadData) => void;
  onReadyForDisplay?: () => void;
  onProgress?: (data: OnProgressData) => void;
  onBuffer?: (data: OnBufferData) => void;
  onVideoTracks?: (data: any) => void;
  onBandwidthUpdate?: (data: any) => void;
  onPictureInPictureStatusChanged?: (data: { isActive: boolean }) => void;
  onError?: (event: any) => void;
  onEnd?: () => void;
  style?: any;
};

/**
 * Web Implementation.
 * Uses Hls.js to play HLS (.m3u8) streams in Chrome, Edge, Firefox,
 * and falls back to native HTML5 video for MP4 / Safari.
 */
export const UniversalVideo = forwardRef<VideoRef, UniversalVideoProps>((props, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const activeUriRef = useRef<string | undefined>(undefined);
  const lastProgressEmitRef = useRef(0);
  const uri = props.source?.uri;

  const callbacksRef = useRef(props);
  callbacksRef.current = props;

  useImperativeHandle(ref, () => ({
    seek: (time: number) => {
      if (videoRef.current && Number.isFinite(time)) {
        videoRef.current.currentTime = Math.max(0, time);
      }
    },
    pause: () => {
      videoRef.current?.pause();
    },
    resume: () => {
      void videoRef.current?.play().catch(() => {});
    },
    enterPictureInPicture: () => {
      if (videoRef.current && (document as any).pictureInPictureEnabled) {
        void videoRef.current.requestPictureInPicture().catch(() => {});
      }
    },
    dismissFullscreenPlayer: () => {},
    presentFullscreenPlayer: () => {},
    setFullScreen: () => {},
    save: async () => ({} as any),
    setVolume: (vol: number) => {
      if (videoRef.current) videoRef.current.volume = vol;
    },
    getCurrentPosition: async () => videoRef.current?.currentTime ?? 0,
    nativeRef: videoRef as any,
  } as unknown as VideoRef));

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !uri) return;
    let isCleanedUp = false;
    activeUriRef.current = uri;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let decodedTargetUrl = "";
    try {
      const parsed = new URL(uri, typeof window !== "undefined" ? window.location.origin : "http://localhost");
      decodedTargetUrl = parsed.searchParams.get("url") || "";
    } catch {}

    const isMp4Target = /\.mp4(?:$|[?#])/i.test(decodedTargetUrl || uri);
    const isHls =
      !isMp4Target &&
      (uri.includes(".m3u8") ||
        decodedTargetUrl.includes(".m3u8") ||
        props.source?.type === "hls" ||
        uri.includes("master"));

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
      hlsRef.current = hls;
      let networkRetries = 0;
      let mediaRetries = 0;

      hls.loadSource(uri);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (isCleanedUp) return;
        if (callbacksRef.current.onVideoTracks && data.levels) {
          callbacksRef.current.onVideoTracks({
            videoTracks: data.levels.map((level, i) => ({
              trackId: i,
              width: level.width,
              height: level.height,
              bitrate: level.bitrate,
            })),
          });
        }
        if (!callbacksRef.current.paused) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              video.muted = true;
              void video.play().catch(() => {});
            });
          }
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (isCleanedUp || !data.fatal) return;
        const httpStatus = data.response?.code;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 2) {
          networkRetries += 1;
          console.warn(`[Hls] Fatal network error (retry ${networkRetries}/2):`, data.details, httpStatus ?? "");
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < 1) {
          mediaRetries += 1;
          console.warn(`[Hls] Fatal media error (retry ${mediaRetries}/1):`, data.details);
          hls.recoverMediaError();
          return;
        }
        console.error("[Hls] Fatal unrecoverable error:", data.type, data.details, httpStatus ?? "");
        hls.destroy();
        if (hlsRef.current === hls) hlsRef.current = null;
        callbacksRef.current.onError?.({
          error: {
            errorString: `HLS_${data.details || data.type}`,
            errorCode: String(httpStatus || data.type),
            httpStatus,
            hlsDetails: data.details,
            hlsType: data.type,
          },
        });
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = uri;
      if (!props.paused) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            video.muted = true;
            void video.play().catch(() => {});
          });
        }
      }
    } else {
      video.src = uri;
      if (!props.paused) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            video.muted = true;
            void video.play().catch(() => {});
          });
        }
      }
    }

    return () => {
      isCleanedUp = true;
      activeUriRef.current = undefined;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [uri]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (props.paused) {
      video.pause();
    } else {
      void video.play().catch(() => {});
    }
  }, [props.paused]);

  useEffect(() => {
    if (videoRef.current && props.rate !== undefined) {
      videoRef.current.playbackRate = props.rate;
    }
  }, [props.rate]);

  useEffect(() => {
    if (videoRef.current) {
      if (props.muted !== undefined) videoRef.current.muted = props.muted;
      if (props.volume !== undefined) videoRef.current.volume = props.volume;
    }
  }, [props.muted, props.volume]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    props.onLoad?.({
      duration: video.duration || 0,
      currentTime: video.currentTime || 0,
      naturalSize: {
        width: video.videoWidth || 1920,
        height: video.videoHeight || 1080,
        orientation:
          (video.videoWidth || 1920) >= (video.videoHeight || 1080)
            ? "landscape"
            : "portrait",
      },
      videoTracks: [],
      audioTracks: [],
      textTracks: [],
    });
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const now = performance.now();
    if (now - lastProgressEmitRef.current < 250) return;
    lastProgressEmitRef.current = now;
    let playableDuration = 0;
    if (video.buffered.length > 0) {
      try {
        playableDuration = video.buffered.end(video.buffered.length - 1);
      } catch {}
    }
    props.onProgress?.({
      currentTime: video.currentTime,
      playableDuration,
      seekableDuration: video.duration || 0,
    });
  };

  const handleLoadedData = () => {
    props.onReadyForDisplay?.();
  };

  const handleWaiting = () => props.onBuffer?.({ isBuffering: true });
  const handlePlaying = () => {
    props.onBuffer?.({ isBuffering: false });
    props.onReadyForDisplay?.();
  };
  const handleEnded = () => props.onEnd?.();
  const handleError = () => {
    if (!activeUriRef.current) return;
    if (!hlsRef.current) {
      if (!videoRef.current?.getAttribute("src")) return;
      const err = videoRef.current?.error;
      callbacksRef.current.onError?.({
        error: {
          errorString: err?.message || "DEMUXER_ERROR_COULD_NOT_PARSE",
          errorCode: String(err?.code || 4),
        },
      });
    }
  };

  const objectFit =
    props.resizeMode === "cover"
      ? "cover"
      : props.resizeMode === "stretch"
      ? "fill"
      : "contain";

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      <video
        ref={videoRef}
        playsInline
        preload="auto"
        webkit-playsinline="true"
        style={{
          width: "100%",
          height: "100%",
          objectFit,
          display: "block",
        }}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadedData={handleLoadedData}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onCanPlay={handlePlaying}
        onEnded={handleEnded}
        onError={handleError}
      />
    </div>
  );
});

UniversalVideo.displayName = "UniversalVideo";

export default UniversalVideo;
