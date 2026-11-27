import { Platform, type TextStyle, type ViewStyle } from "react-native";

export interface ShadowOptions {
  color?: string;
  offset?: { width: number; height: number };
  opacity?: number;
  radius?: number;
  elevation?: number;
}

export interface TextShadowOptions {
  color?: string;
  offset?: { width: number; height: number };
  radius?: number;
}

function toRgba(color: string, opacity: number): string {
  const trimmed = color.trim();
  if (trimmed === "transparent") return "rgba(0, 0, 0, 0)";
  if (trimmed.startsWith("rgba(") || trimmed.startsWith("rgb(")) {
    return trimmed;
  }
  const hex = trimmed.replace("#", "");
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return trimmed;
}

/**
 * Membuat style shadow lintas platform tanpa memicu warning deprecated
 * `shadow*` pada React Native Web.
 */
export function createShadow({
  color = "#000000",
  offset = { width: 0, height: 2 },
  opacity = 0.25,
  radius = 4,
  elevation,
}: ShadowOptions): ViewStyle {
  if (Platform.OS === "web") {
    if (opacity <= 0 || color === "transparent") {
      return { boxShadow: "none" } as ViewStyle;
    }
    const rgba = toRgba(color, opacity);
    return {
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px ${rgba}`,
    } as ViewStyle;
  }

  return {
    shadowColor: color,
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
    ...(elevation !== undefined ? { elevation } : {}),
  };
}

/**
 * Membuat style textShadow lintas platform tanpa memicu warning deprecated
 * `textShadow*` pada React Native Web.
 */
export function createTextShadow({
  color = "rgba(0, 0, 0, 0.75)",
  offset = { width: 0, height: 1 },
  radius = 2,
}: TextShadowOptions): TextStyle {
  if (Platform.OS === "web") {
    return {
      textShadow: `${offset.width}px ${offset.height}px ${radius}px ${color}`,
    } as TextStyle;
  }

  return {
    textShadowColor: color,
    textShadowOffset: offset,
    textShadowRadius: radius,
  };
}

