import * as FileSystemLegacy from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

import type { ApkAsset } from "@/lib/app-update";

const APK_MIME_TYPE = "application/vnd.android.package-archive";
const FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;

const TRUSTED_DOWNLOAD_PREFIX =
  "/nuenimegrup-png/NuenimeApp/releases/download/";

export type DownloadProgress = {
  /** Bytes downloaded so far */
  bytesWritten: number;
  /** Total bytes (may be 0 if unknown) */
  totalBytes: number;
  /** 0–1, or null if unknown */
  fraction: number | null;
};

function validateAsset(asset: ApkAsset) {
  if (
    !asset.downloadUrl ||
    !asset.name ||
    !Number.isSafeInteger(asset.size) ||
    asset.size <= 0
  ) {
    throw new Error("ASET PEMBARUAN TIDAK DAPAT DIVERIFIKASI.");
  }
  let parsed: URL;
  try {
    parsed = new URL(asset.downloadUrl);
  } catch {
    throw new Error("ASET PEMBARUAN TIDAK DAPAT DIVERIFIKASI.");
  }
  const trusted =
    parsed.protocol === "https:" &&
    parsed.origin === "https://github.com" &&
    parsed.pathname.startsWith(TRUSTED_DOWNLOAD_PREFIX);
  const safeName =
    /^[A-Za-z0-9._-]+\.apk$/.test(asset.name) &&
    !asset.name.includes("..");
  if (!trusted || !safeName)
    throw new Error("ASET PEMBARUAN TIDAK DAPAT DIVERIFIKASI.");
}

function cacheDir(): string {
  return `${FileSystemLegacy.cacheDirectory ?? ""}nuenime-updates/`;
}

/**
 * Download an APK asset with real-time progress, then trigger Android's
 * system package installer. Calls `onProgress` every ~100ms while downloading.
 */
export async function downloadAndInstallApk(
  asset: ApkAsset,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  if (Platform.OS !== "android")
    throw new Error(
      "Instalasi APK langsung hanya tersedia di perangkat Android."
    );

  validateAsset(asset);

  const destDir = cacheDir();
  // Ensure cache directory exists
  const dirInfo = await FileSystemLegacy.getInfoAsync(destDir);
  if (!dirInfo.exists) {
    await FileSystemLegacy.makeDirectoryAsync(destDir, { intermediates: true });
  }

  const destUri = `${destDir}${asset.name}`;

  // Remove stale file if size differs
  const existing = await FileSystemLegacy.getInfoAsync(destUri).catch(
    () => null
  );
  if (existing?.exists) {
    const existingSize = (existing as { size?: number }).size ?? 0;
    if (existingSize !== asset.size) {
      await FileSystemLegacy.deleteAsync(destUri, { idempotent: true });
    }
  }

  // Check if already fully downloaded (resume skip)
  const afterDelete = await FileSystemLegacy.getInfoAsync(destUri).catch(
    () => null
  );
  const alreadyDownloaded =
    afterDelete?.exists &&
    ((afterDelete as { size?: number }).size ?? 0) === asset.size;

  if (!alreadyDownloaded) {
    const callback = onProgress
      ? (data: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
          const bytesWritten = data.totalBytesWritten;
          const totalBytes = data.totalBytesExpectedToWrite;
          onProgress({
            bytesWritten,
            totalBytes,
            fraction:
              totalBytes > 0 ? Math.min(bytesWritten / totalBytes, 1) : null,
          });
        }
      : undefined;

    const downloadResumable = FileSystemLegacy.createDownloadResumable(
      asset.downloadUrl,
      destUri,
      {},
      callback
    );

    const result = await downloadResumable.downloadAsync();
    if (!result?.uri) {
      await FileSystemLegacy.deleteAsync(destUri, { idempotent: true }).catch(
        () => {}
      );
      throw new Error("Unduhan gagal. Coba lagi.");
    }

    // Verify size
    const finalInfo = await FileSystemLegacy.getInfoAsync(result.uri);
    const finalSize = (finalInfo as { size?: number }).size ?? 0;
    if (finalSize !== asset.size) {
      await FileSystemLegacy.deleteAsync(result.uri, {
        idempotent: true,
      }).catch(() => {});
      throw new Error(
        "File yang diunduh tidak sesuai. Mungkin koneksi terputus."
      );
    }
  }

  const contentUri = await FileSystemLegacy.getContentUriAsync(destUri);
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: contentUri,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
    type: APK_MIME_TYPE,
  });
}

// Legacy compat
export async function downloadAndInstallAnirakuUpdate(
  release: { downloadUrl: string; assetName: string; assetSize: number },
  onProgress?: (progress: DownloadProgress) => void
) {
  return downloadAndInstallApk(
    {
      downloadUrl: release.downloadUrl,
      name: release.assetName,
      size: release.assetSize,
      abi: null,
    },
    onProgress
  );
}
