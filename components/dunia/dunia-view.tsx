import { Platform } from "react-native";
import { DuniaView as NativeView } from "./dunia-view.native";
import { DuniaView as WebView } from "./dunia-view.web";

export const DuniaView = Platform.OS === "web" ? WebView : NativeView;
