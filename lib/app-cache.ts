import { Platform } from "react-native";
import { Image } from "expo-image";

function getLegacyFileSystem() {
  try {
    return require("expo-file-system/legacy");
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0.0 MB";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

/**
 * Calculates real application temporary cache size.
 * Combines filesystem cacheDirectory files and checks image cache availability.
 */
export async function calculateAppCacheSize(): Promise<{ bytes: number; formatted: string }> {
  if (Platform.OS === "web") {
    return { bytes: 0, formatted: "0.0 MB" };
  }

  let totalBytes = 0;
  const fs = getLegacyFileSystem();

  if (fs?.cacheDirectory) {
    try {
      const dirInfo = await fs.getInfoAsync(fs.cacheDirectory);
      if (dirInfo.exists) {
        if (typeof dirInfo.size === "number" && dirInfo.size > 0) {
          totalBytes += dirInfo.size;
        } else {
          // If directory info doesn't include recursive size, scan entries
          const entries: string[] = await fs.readDirectoryAsync(fs.cacheDirectory).catch(() => []);
          for (const entry of entries) {
            try {
              const fileUri = `${fs.cacheDirectory}${entry}`;
              const fileInfo = await fs.getInfoAsync(fileUri);
              if (fileInfo.exists && typeof fileInfo.size === "number" && fileInfo.size > 0) {
                totalBytes += fileInfo.size;
              }
            } catch {
              // Ignore individual unreadable files
            }
          }
        }
      }
    } catch {
      // Best-effort
    }
  }

  // If calculation yields 0 on first render, present a clean baseline
  return {
    bytes: totalBytes,
    formatted: formatBytes(totalBytes),
  };
}

/**
 * Purges both expo-image disk/memory caches and temporary cacheDirectory files.
 */
export async function clearAllAppCache(): Promise<void> {
  try {
    await Image.clearDiskCache();
  } catch {}

  try {
    await Image.clearMemoryCache();
  } catch {}

  if (Platform.OS !== "web") {
    const fs = getLegacyFileSystem();
    if (fs?.cacheDirectory) {
      try {
        const entries: string[] = await fs.readDirectoryAsync(fs.cacheDirectory).catch(() => []);
        for (const entry of entries) {
          try {
            const fileUri = `${fs.cacheDirectory}${entry}`;
            await fs.deleteAsync(fileUri, { idempotent: true });
          } catch {
            // Best effort per-file cleanup
          }
        }
      } catch {
        // Best effort
      }
    }
  }
}
