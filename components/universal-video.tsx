import React, { forwardRef } from "react";
import RNVideo, { type VideoRef } from "react-native-video";

/**
 * Android & iOS Native Implementation.
 * Uses 100% native react-native-video (ExoPlayer on Android, AVPlayer on iOS).
 * Completely isolated from any web libraries or DOM elements.
 */
export const UniversalVideo = forwardRef<VideoRef, any>((props, ref) => {
  return <RNVideo ref={ref} {...props} />;
});

export default UniversalVideo;
