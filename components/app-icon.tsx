import { Platform } from "react-native";
import { AppIcon as NativeIcon } from "./app-icon.native";
import { AppIcon as WebIcon } from "./app-icon.web";

export const AppIcon = Platform.OS === "web" ? WebIcon : NativeIcon;
