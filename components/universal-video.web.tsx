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
  const uri = props.source?.uri;

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

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls =
      uri.includes(".m3u8") ||
      props.source?.type === "hls" ||
      uri.includes("proxy?url=") ||
      uri.includes("master");

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      hlsRef.current = hls;

      hls.loadSource(uri);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (props.onVideoTracks && data.levels) {
          props.onVideoTracks({
            videoTracks: data.levels.map((level, i) => ({
              trackId: i,
              width: level.width,
              height: level.height,
              bitrate: level.bitrate,
            })),
          });
        }
        if (!props.paused) {
          video.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn("[Hls] Fatal network error, recovering...", data.details);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("[Hls] Fatal media error, recovering...", data.details);
              hls.recoverMediaError();
              break;
            default:
              console.error("[Hls] Fatal unrecoverable error:", data);
              hls.destroy();
              props.onError?.({
                error: {
                  errorString: `HLS_${data.details || data.type}`,
                  errorCode: data.type,
                },
              });
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = uri;
      if (!props.paused) {
        video.play().catch(() => {});
      }
    } else {
      video.src = uri;
      if (!props.paused) {
        video.play().catch(() => {});
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
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

  const handleWaiting = () => props.onBuffer?.({ isBuffering: true });
  const handlePlaying = () => props.onBuffer?.({ isBuffering: false });
  const handleEnded = () => props.onEnd?.();
  const handleError = () => {
    if (!hlsRef.current) {
      const err = videoRef.current?.error;
      props.onError?.({
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
        webkit-playsinline="true"
        style={{
          width: "100%",
          height: "100%",
          objectFit,
          display: "block",
        }}
        onLoadedMetadata={handleLoadedMetadata}
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

export default UniversalVideo;
