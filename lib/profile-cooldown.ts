export const BANNER_COOLDOWN_SECONDS = 7 * 24 * 3600; // 7 days = 604800s
export const NAME_COOLDOWN_SECONDS = 24 * 3600; // 24 hours = 86400s
export const AVATAR_COOLDOWN_SECONDS = 24 * 3600; // 24 hours = 86400s

export type CooldownType = "banner" | "name" | "avatar" | "nama";

export type CooldownStatus = {
  canChange: boolean;
  secondsRemaining: number;
  remainingText: string;
  message: string;
  formatted: string;
};

/**
 * Formats a duration in seconds into an Indonesian time string (e.g. "5 hari 12 jam", "23 jam 45 menit")
 */
export function formatDurationIndonesian(seconds: number): string {
  if (seconds <= 0) return "segera";

  const days = Math.floor(seconds / 86400);
  const remAfterDays = seconds % 86400;
  const hours = Math.floor(remAfterDays / 3600);
  const remAfterHours = remAfterDays % 3600;
  const minutes = Math.floor(remAfterHours / 60);
  const secs = remAfterHours % 60;

  if (days >= 1) {
    return hours > 0 ? `${days} hari ${hours} jam` : `${days} hari`;
  }
  if (hours >= 1) {
    return minutes > 0 ? `${hours} jam ${minutes} menit` : `${hours} jam`;
  }
  if (minutes >= 1) {
    return secs > 0 ? `${minutes} menit ${secs} detik` : `${minutes} menit`;
  }
  return `${secs} detik`;
}

/**
 * Calculates current cooldown status and human-readable countdown.
 */
export function getProfileCooldownStatus(
  lastUpdatedAt: string | number | null | undefined,
  cooldownSeconds: number,
  type: CooldownType,
  nowMs: number = Date.now()
): CooldownStatus {
  const defaultAvailableText =
    type === "banner"
      ? "Perubahan tersedia (1x dalam 7 hari)"
      : "Perubahan tersedia (1x dalam 24 jam)";

  if (!lastUpdatedAt) {
    return {
      canChange: true,
      secondsRemaining: 0,
      remainingText: "sekarang",
      message: defaultAvailableText,
      formatted: defaultAvailableText,
    };
  }

  const lastTime =
    typeof lastUpdatedAt === "number" ? lastUpdatedAt : new Date(lastUpdatedAt).getTime();

  if (!Number.isFinite(lastTime)) {
    return {
      canChange: true,
      secondsRemaining: 0,
      remainingText: "sekarang",
      message: defaultAvailableText,
      formatted: defaultAvailableText,
    };
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - lastTime) / 1000));
  const secondsRemaining = Math.max(0, cooldownSeconds - elapsedSeconds);

  if (secondsRemaining <= 0) {
    return {
      canChange: true,
      secondsRemaining: 0,
      remainingText: "sekarang",
      message: defaultAvailableText,
      formatted: defaultAvailableText,
    };
  }

  const durStr = formatDurationIndonesian(secondsRemaining);
  let actionPrefix = "dapat diganti lagi dalam";
  if (type === "name" || type === "nama") {
    actionPrefix = "dapat diubah lagi dalam";
  }

  const label =
    type === "banner"
      ? "Banner"
      : (type === "name" || type === "nama")
      ? "Nama"
      : "Avatar";

  const msg = `${label} ${actionPrefix} ${durStr}`;

  return {
    canChange: false,
    secondsRemaining,
    remainingText: durStr,
    message: msg,
    formatted: msg,
  };
}

/**
 * Tries to extract direct image URL if user pasted a Google image result link
 * or a wrapped redirect URL (e.g. google.com/imgres?imgurl=...).
 */
export function extractDirectImageUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return "";

  // Check if it's a google image search redirect containing imgurl parameter
  if (trimmed.includes("google.") && trimmed.includes("imgurl=")) {
    try {
      const parsed = new URL(trimmed);
      const direct = parsed.searchParams.get("imgurl");
      if (direct && /^https?:\/\//i.test(direct)) {
        return decodeURIComponent(direct);
      }
    } catch {
      // Fallback regex matching
      const match = trimmed.match(/[?&]imgurl=([^&]+)/i);
      if (match && match[1]) {
        try {
          return decodeURIComponent(match[1]);
        } catch {
          return match[1];
        }
      }
    }
  }

  return trimmed;
}

/**
 * Validates whether a URL is a supported image link (GIF, PNG, JPG, JPEG, WEBP).
 */
export function validateImageUrl(url: string): {
  valid: boolean;
  error?: string;
  cleanUrl: string;
} {
  const cleanUrl = extractDirectImageUrl(url);
  if (!cleanUrl) {
    return { valid: false, error: "Tautan gambar tidak boleh kosong.", cleanUrl: "" };
  }

  if (cleanUrl.length > 2048) {
    return { valid: false, error: "Tautan gambar terlalu panjang (maks 2048 karakter).", cleanUrl };
  }

  if (!/^https?:\/\//i.test(cleanUrl)) {
    return {
      valid: false,
      error: "Tautan harus diawali dengan http:// atau https://",
      cleanUrl,
    };
  }

  // Reject generic search/html web pages
  const lower = cleanUrl.toLowerCase();
  if (
    lower.includes("google.com/search") ||
    lower.includes("google.com/imghp") ||
    lower.includes("youtube.com") ||
    lower.includes("facebook.com") ||
    lower.includes("instagram.com/p/")
  ) {
    return {
      valid: false,
      error:
        "Tautan ini mengarah ke halaman web, bukan gambar langsung. Silakan salin tautan gambar langsung (Copy image address).",
      cleanUrl,
    };
  }

  return { valid: true, cleanUrl };
}
