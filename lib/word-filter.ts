import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export const DEFAULT_BANNED_WORDS: string[] = [
  "judi",
  "slot",
  "gacor",
  "zeus",
  "pragmatic",
  "maxwin",
  "togel",
  "sbobet",
  "bokep",
  "porno",
  "porn",
  "colmek",
  "kontol",
  "memek",
  "pepek",
  "itil",
  "ngentot",
  "kenthu",
  "anjing",
  "babi",
  "bangsat",
  "tolol",
  "bajingan",
  "penipu",
  "scam",
  "chip",
];

const STORAGE_KEY = "nuenime_banned_words_cache";
export const CENSORED_MESSAGE_LABEL = "[Pesan mengandung kata terlarang]";

// In-memory cache
let inMemoryBannedWords: string[] = [...DEFAULT_BANNED_WORDS];
let isInitialized = false;

/**
 * Normalisasi kata: hilangkan simbol umum pengelabuan (contoh: j.u.d.i, j_u_d_i, j00di)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[._\-*#@!$%^&()+=]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Periksa apakah teks mengandung kata terlarang
 */
export function checkBannedWords(text: string, customList?: string[]): {
  isFlagged: boolean;
  foundWords: string[];
} {
  if (!text || typeof text !== "string") {
    return { isFlagged: false, foundWords: [] };
  }

  const list = customList && customList.length > 0 ? customList : inMemoryBannedWords;
  const lowerText = text.toLowerCase();
  const normalized = normalizeText(text);
  const foundWords: string[] = [];

  for (const rawWord of list) {
    const word = rawWord.trim().toLowerCase();
    if (!word) continue;

    // 1. Cek langsung dengan regex batas kata (word boundary)
    const regex = new RegExp(`(^|\\b|\\s|[.,!?;:_])${word}($|\\b|\\s|[.,!?;:_])`, "i");
    if (regex.test(lowerText) || lowerText.includes(word) || normalized.includes(word)) {
      foundWords.push(word);
    }
  }

  return {
    isFlagged: foundWords.length > 0,
    foundWords,
  };
}

/**
 * Filter pesan chat secara otomatis:
 * Jika mengandung kata terlarang, pesan akan otomatis diganti menjadi:
 * "[Pesan mengandung kata terlarang]"
 */
export function filterAndCensorMessage(text: string): {
  isFlagged: boolean;
  processedText: string;
  foundWords: string[];
} {
  const check = checkBannedWords(text);
  if (check.isFlagged) {
    return {
      isFlagged: true,
      processedText: CENSORED_MESSAGE_LABEL,
      foundWords: check.foundWords,
    };
  }

  return {
    isFlagged: false,
    processedText: text,
    foundWords: [],
  };
}

/**
 * Ambil daftar kata terlarang dari Supabase system_configs atau fallback ke cache
 */
export async function syncBannedWords(): Promise<string[]> {
  try {
    // 1. Muat dari local storage dulu jika memori belum inisialisasi
    if (!isInitialized) {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            inMemoryBannedWords = parsed;
          }
        } catch {}
      }
      isInitialized = true;
    }

    // 2. Tarik update terbaru dari Supabase system_configs
    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "word_blacklist")
      .maybeSingle();

    if (!error && data?.value && Array.isArray(data.value)) {
      inMemoryBannedWords = data.value.map((w: any) => String(w).trim().toLowerCase());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryBannedWords));
    }
  } catch (err) {
    console.warn("[word-filter] Error syncing banned words:", err);
  }

  return inMemoryBannedWords;
}

/**
 * Ambil daftar kata yang tersimpan saat ini secara sinkron
 */
export function getBannedWordsSync(): string[] {
  return inMemoryBannedWords;
}

// Jalankan sinkronisasi awal saat modul dimuat
void syncBannedWords();

// Berlangganan perubahan realtime system_configs dari admin secara aman
try {
  const channelName = `system_configs_blacklist_sync_${Date.now()}`;
  try {
    const existing = supabase.getChannels().filter((c) => c.topic?.includes("system_configs_blacklist_sync"));
    for (const ch of existing) {
      void supabase.removeChannel(ch);
    }
  } catch {}

  supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "system_configs",
        filter: "key=eq.word_blacklist",
      },
      (payload) => {
        const row = payload.new as any;
        if (row && Array.isArray(row.value)) {
          inMemoryBannedWords = row.value.map((w: any) => String(w).trim().toLowerCase());
          void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryBannedWords));
        }
      }
    )
    .subscribe();
} catch {}
