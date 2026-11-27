import React, { useEffect, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Image, type ImageProps, type ImageSource } from "expo-image";
import { AppIcon } from "@/components/app-icon";

export interface SafeImageProps extends Omit<ImageProps, "source"> {
  source?: ImageSource | number | string | null;
  fallbackSource?: ImageSource | number;
  fallbackIconName?: string;
  fallbackIconSize?: number;
  fallbackIconColor?: string;
  fallbackStyle?: StyleProp<ViewStyle>;
}

const MAX_FAILED_IMAGE_CACHE = 200;
const failedImageUrls = new Set<string>();

export function hasFailedImageUrl(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return failedImageUrls.has(uri.trim());
}

export function markFailedImageUrl(uri: string | null | undefined): void {
  if (!uri) return;
  const trimmed = uri.trim();
  if (!trimmed) return;
  if (failedImageUrls.size >= MAX_FAILED_IMAGE_CACHE) {
    const oldest = failedImageUrls.values().next().value;
    if (oldest !== undefined) {
      failedImageUrls.delete(oldest);
    }
  }
  failedImageUrls.add(trimmed);
}

function isValidUri(uri: string): boolean {
  const trimmed = uri.trim();
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("file://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("/")
  );
}

/**
 * Wrapper expo-image dengan validasi URI dan fallback otomatis
 * ketika URL kosong, tidak valid, atau gagal dimuat (HTTP 404/network error).
 */
export const SafeImage = React.memo(function SafeImage({
  source,
  fallbackSource,
  fallbackIconName = "image-off-outline",
  fallbackIconSize = 18,
  fallbackIconColor = "#64748B",
  fallbackStyle,
  style,
  onError,
  ...rest
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);

  const normalizedSource =
    typeof source === "string"
      ? isValidUri(source)
        ? { uri: source.trim() }
        : null
      : source && typeof source === "object" && "uri" in source
      ? source.uri && isValidUri(source.uri)
        ? source
        : null
      : source ?? null;

  const sourceKey =
    typeof source === "string"
      ? source
      : source && typeof source === "object" && "uri" in source
      ? source.uri
      : String(source ?? "");

  const normalizedUri =
    normalizedSource && typeof normalizedSource === "object" && "uri" in normalizedSource
      ? normalizedSource.uri
      : undefined;
  const isKnownFailed = hasFailedImageUrl(normalizedUri);

  useEffect(() => {
    setHasError(hasFailedImageUrl(normalizedUri));
  }, [sourceKey, normalizedUri]);

  if (!normalizedSource || hasError || isKnownFailed) {
    if (fallbackSource) {
      return <Image source={fallbackSource} style={style} {...rest} />;
    }
    return (
      <View
        style={[
          {
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255, 255, 255, 0.04)",
          },
          style as StyleProp<ViewStyle>,
          fallbackStyle,
        ]}
      >
        <AppIcon name={fallbackIconName} size={fallbackIconSize} color={fallbackIconColor} />
      </View>
    );
  }

  return (
    <Image
      source={normalizedSource}
      style={style}
      onError={(e) => {
        markFailedImageUrl(normalizedUri);
        setHasError(true);
        onError?.(e);
      }}
      {...rest}
    />
  );
});

