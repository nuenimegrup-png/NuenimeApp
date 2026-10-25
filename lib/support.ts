export const SAWERIA_URL = "https://saweria.co/Nuenime";
export const PATREON_URL = "https://patreon.com/ShoIslam"; // legacy, tidak dipakai
export const SUPPORT_FUNDING_COPY = "Server, update rutin, dan pengembangan aplikasi.";

export const USDT_ASSET = "USDT";
export const USDT_NETWORK = "BNB Smart Chain (BEP20)";
export const USDT_NETWORK_SHORT = "BEP20";
export const USDT_BEP20_ADDRESS = "0x0dc085fc880f2f67b4e200f125bc0de352da904e";

export const SUPPORT_PROMPT_ACTIVE_MS = 30 * 60 * 1000;
export const SUPPORT_PROMPT_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
export const SUPPORT_PROMPT_DISMISS_KEY = "nuenime.support.dismissed-until";

export function isSupportPromptExcluded(pathname: string | null | undefined) {
  return String(pathname || "").startsWith("/watch/");
}

export function supportDismissedUntil(now = Date.now()) {
  return now + SUPPORT_PROMPT_DISMISS_MS;
}

export function shouldShowSupportPrompt({ activeMs, dismissedUntil, pathname, now = Date.now() }: { activeMs: number; dismissedUntil?: number | null; pathname?: string | null; now?: number }) {
  return activeMs >= SUPPORT_PROMPT_ACTIVE_MS && !isSupportPromptExcluded(pathname) && Number(dismissedUntil || 0) <= now;
}
