import type { StyleProp, ViewStyle } from "react-native";
import { SVG_PATHS } from "./app-icon.paths";

export function AppIcon({
  name,
  size = 20,
  color = "#FFFFFF",
  style,
}: {
  name: string;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  const normalized = name ? name.trim() : "";
  const d =
    SVG_PATHS[normalized] ||
    SVG_PATHS[normalized.replace(/-outline$/, "")] ||
    SVG_PATHS[normalized + "-outline"] ||
    SVG_PATHS["circle-outline"];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        pointerEvents: "none",
        ...(style as any),
      }}
    >
      <path d={d} fill={color} style={{ pointerEvents: "none" }} />
    </svg>
  );
}
