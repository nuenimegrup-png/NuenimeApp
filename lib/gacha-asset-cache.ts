import { useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

// ─── KONFIGURASI CACHE GACHA ANDROID ───
const CACHE_SUBDIR = "nuenime_gacha/";
const MANIFEST_STORAGE_KEY = "nuenime.gacha.asset_manifest_v1";
const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB batas aman penyimpanan lokal Android
const MAX_CACHE_FILES = 100; // Maksimal 100 aset aktif di cache

interface CacheManifestItem {
  url: string;
  localUri: string;
  filename: string;
  size: number;
  lastAccessed: number;
}

type CacheManifest = Record<string, CacheManifestItem>;

// Cache folder path (hanya di native, null di web)
function getCacheDirPath(): string | null {
  if (Platform.OS === "web" || !FileSystem.cacheDirectory) {
    return null;
  }
  return `${FileSystem.cacheDirectory}${CACHE_SUBDIR}`;
}

/**
 * Membuat hash sederhana yang stabil dan unik untuk nama file lokal
 */
function hashUrlToFilename(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  const cleanHash = Math.abs(hash).toString(36);

  // Deteksi ekstensi file dari URL
  const cleanUrl = url.split("?")[0].toLowerCase();
  let ext = ".jpg";
  if (cleanUrl.endsWith(".gif") || url.toLowerCase().includes(".gif")) {
    ext = ".gif";
  } else if (cleanUrl.endsWith(".png")) {
    ext = ".png";
  } else if (cleanUrl.endsWith(".webp")) {
    ext = ".webp";
  } else if (cleanUrl.endsWith(".jpeg")) {
    ext = ".jpeg";
  }

  return `gacha_${cleanHash}_${url.length}${ext}`;
}

// In-memory memory cache manifest untuk akses secepat kilat
let memoryManifest: CacheManifest | null = null;
let isInitPromise: Promise<void> | null = null;

async function loadManifest(): Promise<CacheManifest> {
  if (memoryManifest) return memoryManifest;
  try {
    const raw = await AsyncStorage.getItem(MANIFEST_STORAGE_KEY);
    memoryManifest = raw ? JSON.parse(raw) : {};
  } catch {
    memoryManifest = {};
  }
  return memoryManifest!;
}

async function saveManifest(manifest: CacheManifest): Promise<void> {
  memoryManifest = manifest;
  try {
    await AsyncStorage.setItem(MANIFEST_STORAGE_KEY, JSON.stringify(manifest));
  } catch {}
}

async function ensureDirectoryExists(): Promise<string | null> {
  const dir = getCacheDirPath();
  if (!dir) return null;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
  } catch (err) {
    console.warn("[gacha-cache] Gagal membuat direktori cache:", err);
    return null;
  }
}

/**
 * Mengambil URI lokal jika sudah ada di disk Android,
 * atau mengunduh aset secara asinkron di latar belakang dan mengembalikan URI lokal.
 */
export async function getOrDownloadGachaAsset(remoteUrl?: string | null): Promise<string> {
  if (!remoteUrl || typeof remoteUrl !== "string" || !remoteUrl.trim()) {
    return "";
  }

  const url = remoteUrl.trim();

  // Jika platform Web atau expo-file-system tidak tersedia, gunakan URL remote langsung
  if (Platform.OS === "web" || !FileSystem.cacheDirectory) {
    return url;
  }

  try {
    const dir = await ensureDirectoryExists();
    if (!dir) return url;

    const manifest = await loadManifest();
    const filename = hashUrlToFilename(url);
    const localUri = `${dir}${filename}`;

    // 1. Cek apakah sudah ada di manifest & file fisik valid di disk
    if (manifest[url]) {
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists && (fileInfo as any).size > 0) {
        manifest[url].lastAccessed = Date.now();
        // Simpan manifest update akses secara async
        saveManifest(manifest).catch(() => {});
        return localUri;
      }
    }

    // 2. Jika file belum ada atau rusak, unduh dari URL
    const downloadRes = await FileSystem.downloadAsync(url, localUri);
    if (downloadRes.status >= 200 && downloadRes.status < 300) {
      const info = await FileSystem.getInfoAsync(localUri);
      const size = (info as any).size || 0;

      manifest[url] = {
        url,
        localUri,
        filename,
        size,
        lastAccessed: Date.now(),
      };
      await saveManifest(manifest);

      // Jalankan pembersihan LRU jika melebihi batas aman
      enforceCacheQuota(manifest).catch(() => {});

      return localUri;
    }
  } catch (err) {
    console.warn("[gacha-cache] Gagal mengunduh aset ke cache lokal:", url, err);
  }

  // Fallback ke URL remote jika terjadi kendala pengunduhan
  return url;
}

/**
 * Menjaga kapasitas penyimpanan Android agar tidak membengkak (LRU Eviction)
 */
async function enforceCacheQuota(manifest: CacheManifest): Promise<void> {
  try {
    const items = Object.values(manifest);
    let totalBytes = items.reduce((sum, item) => sum + (item.size || 0), 0);

    if (totalBytes <= MAX_CACHE_SIZE_BYTES && items.length <= MAX_CACHE_FILES) {
      return;
    }

    // Urutkan berdasarkan waktu akses paling lama (LRU)
    items.sort((a, b) => a.lastAccessed - b.lastAccessed);

    while ((totalBytes > MAX_CACHE_SIZE_BYTES || items.length > MAX_CACHE_FILES) && items.length > 0) {
      const oldest = items.shift();
      if (!oldest) break;

      try {
        await FileSystem.deleteAsync(oldest.localUri, { idempotent: true });
      } catch {}

      totalBytes -= oldest.size || 0;
      delete manifest[oldest.url];
    }

    await saveManifest(manifest);
  } catch (err) {
    console.warn("[gacha-cache] enforceCacheQuota error:", err);
  }
}

/**
 * Membersihkan aset yang sudah tidak aktif/dihapus oleh admin dari database
 */
export async function cleanupOrphanedGachaAssets(activeUrls: string[]): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const activeSet = new Set(activeUrls.map((u) => u.trim()));
    const manifest = await loadManifest();
    let changed = false;

    for (const [url, item] of Object.entries(manifest)) {
      if (!activeSet.has(url)) {
        try {
          await FileSystem.deleteAsync(item.localUri, { idempotent: true });
        } catch {}
        delete manifest[url];
        changed = true;
      }
    }

    if (changed) {
      await saveManifest(manifest);
    }
  } catch (err) {
    console.warn("[gacha-cache] cleanupOrphanedGachaAssets error:", err);
  }
}

/**
 * Membersihkan seluruh cache lokal gacha
 */
export async function clearGachaAssetCache(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const dir = getCacheDirPath();
    if (dir) {
      await FileSystem.deleteAsync(dir, { idempotent: true });
      await ensureDirectoryExists();
    }
    await AsyncStorage.removeItem(MANIFEST_STORAGE_KEY);
    memoryManifest = {};
  } catch (err) {
    console.warn("[gacha-cache] clearGachaAssetCache error:", err);
  }
}

/**
 * React Hook untuk memuat aset gacha dengan cache lokal otomatis
 */
export function useCachedGachaAsset(remoteUrl?: string | null): {
  assetUri: string | null;
  isLocal: boolean;
  isLoading: boolean;
} {
  const [assetUri, setAssetUri] = useState<string | null>(remoteUrl || null);
  const [isLocal, setIsLocal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!remoteUrl || typeof remoteUrl !== "string") {
      setAssetUri(null);
      setIsLocal(false);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    getOrDownloadGachaAsset(remoteUrl)
      .then((uri) => {
        if (!isMounted) return;
        setAssetUri(uri);
        setIsLocal(uri.startsWith("file://"));
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setAssetUri(remoteUrl);
        setIsLocal(false);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [remoteUrl]);

  return { assetUri, isLocal, isLoading };
}
