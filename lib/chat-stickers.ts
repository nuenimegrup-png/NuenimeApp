import { Image } from "expo-image";

/**
 * Nuenime Global Chat - Sticker System & Data Store
 *
 * Mendukung pengiriman & rendering stiker interaktif di Ruang Chat Global.
 * Pengguna dapat memilih stiker dari panel stiker atau menambahkan tautan baru.
 */

export interface ChatSticker {
  id: string;
  name: string;
  url: string;
  category: string;
}

export interface StickerCategory {
  id: string;
  name: string;
}

export const STICKER_CATEGORIES: StickerCategory[] = [
  { id: "all", name: "Semua" },
  { id: "chibi", name: "Chibi" },
  { id: "reaksi", name: "Reaksi" },
];

/**
 * Daftar Koleksi Stiker Siap Pakai Nuenime.
 * Menggunakan tautan gambar langsung sesuai permintaan pengguna tanpa unggah lokal.
 */
export const DEFAULT_STICKERS: ChatSticker[] = [
  {
    id: "stk-nuenime-1",
    name: "Stiker 1",
    url: "https://i.ibb.co.com/DPwYqnC3/1.png",
    category: "chibi",
  },
  {
    id: "stk-nuenime-2",
    name: "Stiker 2",
    url: "https://i.ibb.co.com/Z161bwwc/2.png",
    category: "chibi",
  },
  {
    id: "stk-nuenime-3",
    name: "Stiker 3",
    url: "https://i.ibb.co.com/rGZBWc3X/3.png",
    category: "chibi",
  },
  {
    id: "stk-nuenime-4",
    name: "Stiker 4",
    url: "https://i.ibb.co.com/F4RXbRKk/4.png",
    category: "chibi",
  },
  {
    id: "stk-nuenime-5",
    name: "Stiker 5",
    url: "https://i.ibb.co.com/wFQK46S8/5.png",
    category: "chibi",
  },
  {
    id: "stk-nuenime-6",
    name: "Stiker 6",
    url: "https://i.ibb.co.com/whHGShnj/6.png",
    category: "chibi",
  },
  {
    id: "stk-nuenime-7",
    name: "Stiker 7",
    url: "https://i.ibb.co.com/svZ89T5x/7.png",
    category: "chibi",
  },
  {
    id: "stk-nuenime-8",
    name: "Stiker 8",
    url: "https://i.ibb.co.com/LDv31NJb/8.png",
    category: "chibi",
  },
  {
    id: "stk-nuenime-9",
    name: "Stiker 9",
    url: "https://i.ibb.co.com/ymK1KYcj/9.png",
    category: "reaksi",
  },
  {
    id: "stk-nuenime-10",
    name: "Stiker 10",
    url: "https://i.ibb.co.com/Zp8N4qX9/10.png",
    category: "reaksi",
  },
  {
    id: "stk-nuenime-11",
    name: "Stiker 11",
    url: "https://i.ibb.co.com/RTXkSzgx/11.png",
    category: "reaksi",
  },
  {
    id: "stk-nuenime-12",
    name: "Stiker 12",
    url: "https://i.ibb.co.com/pjPRyKHq/12.png",
    category: "reaksi",
  },
  {
    id: "stk-nuenime-13",
    name: "Stiker 13",
    url: "https://i.ibb.co.com/83qMjZd/13.png",
    category: "reaksi",
  },
  {
    id: "stk-nuenime-14",
    name: "Stiker 14",
    url: "https://i.ibb.co.com/tpJT1SXD/14.png",
    category: "reaksi",
  },
  {
    id: "stk-nuenime-15",
    name: "Stiker 15",
    url: "https://i.ibb.co.com/bgSPBqNx/15.png",
    category: "reaksi",
  },
  {
    id: "stk-nuenime-16",
    name: "Stiker 16",
    url: "https://i.ibb.co.com/TMz6YWKw/16.png",
    category: "reaksi",
  },
];

let hasPrefetchedStickers = false;

/**
 * Melakukan prefetch (download & simpan ke cache memori + disk secara agresif)
 * untuk seluruh stiker Nuenime.
 * Begitu selesai di-prefetch, saat pengguna membuka Chat Global atau membuka
 * panel stiker, gambarnya sudah instan 0ms tanpa loading ulang / tanpa lambat.
 */
export async function preloadChatStickers(): Promise<void> {
  if (hasPrefetchedStickers) return;
  hasPrefetchedStickers = true;
  try {
    const urls = DEFAULT_STICKERS.map((s) => s.url);
    await Image.prefetch(urls, "memory-disk");
  } catch (err) {
    console.warn("[chat-stickers] Prefetch warning:", err);
  }
}

// Prefetch otomatis di latar belakang saat modul dimuat pertama kali
try {
  preloadChatStickers();
} catch {}

/**
 * Memeriksa apakah pesan teks berformat stiker [sticker:URL]
 */
export function isStickerMessage(message?: string | null): boolean {
  if (!message) return false;
  const trimmed = message.trim();
  return trimmed.startsWith("[sticker:") && trimmed.endsWith("]");
}

/**
 * Mengekstrak URL stiker dari pesan
 */
export function extractStickerUrl(message?: string | null): string | null {
  if (!message) return null;
  const match = message.trim().match(/^\[sticker:(.+)\]$/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * Memformat string pengiriman pesan stiker
 */
export function formatStickerMessage(urlOrSticker: string | ChatSticker): string {
  const url = typeof urlOrSticker === "string" ? urlOrSticker.trim() : urlOrSticker.url.trim();
  return `[sticker:${url}]`;
}

