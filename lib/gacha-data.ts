import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── KEYS ───
export const STORAGE_CRYSTAL_BALANCE = "nuenime.crystal.balance";
export const STORAGE_OWNED_WALLPAPERS = "nuenime.owned.wallpapers";
export const STORAGE_ACTIVE_WALLPAPER = "nuenime.active.wallpaper";
export const STORAGE_GACHA_HISTORY = "nuenime.gacha.history";

export type WallpaperRarity = "Mythic" | "Legendary" | "Epic" | "Rare" | "Normal";
export type WallpaperCategory = "Basic" | "Standard" | "Premium";

export interface WallpaperItem {
  id: string;
  name: string;
  anime: string;
  rarity: WallpaperRarity;
  category: WallpaperCategory;
  expBonus: number; // in percent, e.g. 20 for +20%
  image: string; // URL for high-res banner
  color: string; // Accent color for borders / badges
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function isValidImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false;
  return true;
}

export interface GachaTransaction {
  id: string;
  timestamp: number;
  type: "single" | "multi";
  cost: number;
  results: WallpaperItem[];
}

// ─── RARITY CONFIGURATION ───
export const RARITY_CONFIG: Record<
  WallpaperRarity,
  {
    category: WallpaperCategory;
    expBonus: number;
    color: string;
    bgColor: string;
    borderColor: string;
    rate: number; // percentage in pool
    label: string;
    price: number; // Harga Crystal: Normal 1.000, Rare 1.500, Epic 2.000, Legendary 3.500, Mythic 5.000
  }
> = {
  Mythic: {
    category: "Premium",
    expBonus: 25,
    color: "#EC4899", // Vibrant Pink/Rose
    bgColor: "rgba(236, 72, 153, 0.12)",
    borderColor: "#EC4899",
    rate: 2, // 2%
    label: "Mythic",
    price: 5000,
  },
  Legendary: {
    category: "Premium",
    expBonus: 20,
    color: "#EAB308", // Gold
    bgColor: "rgba(234, 179, 8, 0.12)",
    borderColor: "#EAB308",
    rate: 8, // 8%
    label: "Legendary",
    price: 3500,
  },
  Epic: {
    category: "Standard",
    expBonus: 15,
    color: "#A855F7", // Purple
    bgColor: "rgba(168, 85, 247, 0.12)",
    borderColor: "#A855F7",
    rate: 20, // 20%
    label: "Epic",
    price: 2000,
  },
  Rare: {
    category: "Standard",
    expBonus: 10,
    color: "#38BDF8", // Cyan / Blue
    bgColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "#38BDF8",
    rate: 30, // 30%
    label: "Rare",
    price: 1500,
  },
  Normal: {
    category: "Basic",
    expBonus: 5,
    color: "#94A3B8", // Neutral Slate
    bgColor: "rgba(148, 163, 184, 0.08)",
    borderColor: "#64748B",
    rate: 40, // 40%
    label: "Normal",
    price: 1000,
  },
};

// ─── GACHA COSTS & ANIMATION SETTINGS ───
let gachaBannerImage: any = 1;
let gachaAnimGif: any = 1;
let crystalIcon: any = 1;

try {
  if (typeof process === "undefined" || process.env?.NODE_ENV !== "test") {
    gachaBannerImage = require("../assets/images/gacha/banner.gif");
    gachaAnimGif = require("../assets/images/gacha/animasi-gacha.gif");
    crystalIcon = require("../assets/images/topup/topup-crystal.png");
  }
} catch {}

export const GACHA_BANNER_IMAGE = gachaBannerImage;
export const GACHA_ANIMATION_GIF = gachaAnimGif;
export const CRYSTAL_ICON = crystalIcon;

export const GACHA_SETTINGS = {
  cost1x: 1000, // 1000 Crystal untuk 1x Summon
  cost10x: 9000, // 9000 Crystal untuk 10x Summon
  gifDurationMs: 3000, // 3 detik animasi gacha
  defaultInitialBalance: 1500, // Initial free crystal for testers if balance is null
};

// ─── WALLPAPER CATALOG (100% DATABASE DRIVEN) ───
// Seluruh koleksi banner gacha diambil langsung dari tabel Supabase `gacha_banners`.
// Tidak ada data dummy / hardcoded katalog dalam kode APK.
export const WALLPAPER_CATALOG: WallpaperItem[] = [];

