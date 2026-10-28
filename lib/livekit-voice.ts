import { Platform } from "react-native";
import * as WebVoice from "./livekit-voice.web";
import * as NativeVoice from "./livekit-voice.native";

export type { UseNobarVoiceResult } from "./livekit-voice.native";

export const useNobarVoice =
  Platform.OS === "web" ? WebVoice.useNobarVoice : NativeVoice.useNobarVoice;

export const getLiveKitVoiceToken =
  Platform.OS === "web" ? WebVoice.getLiveKitVoiceToken : NativeVoice.getLiveKitVoiceToken;
