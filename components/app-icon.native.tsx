import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
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
  const d = SVG_PATHS[name] || SVG_PATHS["help-circle-outline"] || SVG_PATHS["circle-outline"];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none" style={[{ pointerEvents: "none" as any }, style]}>
      <Path d={d} fill={color} />
    </Svg>
  );
}
