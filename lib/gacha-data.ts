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
export const GACHA_BANNER_IMAGE = require("../assets/images/gacha/banner.gif");
export const GACHA_ANIMATION_GIF = require("../assets/images/gacha/animasi-gacha.gif");
export const CRYSTAL_ICON = require("../assets/images/topup/topup-crystal.png");

export const GACHA_SETTINGS = {
  cost1x: 1000, // 1000 Crystal untuk 1x Summon
  cost10x: 9000, // 9000 Crystal untuk 10x Summon
  gifDurationMs: 3000, // 3 detik animasi gacha
  defaultInitialBalance: 1500, // Initial free crystal for testers if balance is null
};

// ─── INITIAL WALLPAPER CATALOG ───
// Curated HD anime landscape wallpapers matching reference characters
export const WALLPAPER_CATALOG: WallpaperItem[] = [
  // ─── LEGENDARY / MYTHIC (PREMIUM) ───
  {
    id: "saitama_22",
    name: "Saitama 22",
    anime: "One Punch Man",
    rarity: "Legendary",
    category: "Premium",
    expBonus: 20,
    image: "https://images.alphacoders.com/657/thumb-1920-657155.jpg",
    color: "#EAB308",
  },
  {
    id: "gojo_infinite_void",
    name: "Satoru Gojo Void",
    anime: "Jujutsu Kaisen",
    rarity: "Mythic",
    category: "Premium",
    expBonus: 25,
    image: "https://images.alphacoders.com/133/thumb-1920-1337446.png",
    color: "#EC4899",
  },
  {
    id: "jinwoo_monarch",
    name: "Sung Jinwoo Arise",
    anime: "Solo Leveling",
    rarity: "Mythic",
    category: "Premium",
    expBonus: 25,
    image: "https://images.alphacoders.com/134/thumb-1920-1348002.png",
    color: "#EC4899",
  },
  {
    id: "frieren_stargazing",
    name: "Frieren Stargazing",
    anime: "Sousou no Frieren",
    rarity: "Legendary",
    category: "Premium",
    expBonus: 20,
    image: "https://images.alphacoders.com/134/thumb-1920-1340156.jpeg",
    color: "#EAB308",
  },
  {
    id: "luffy_gear_5",
    name: "Monkey D. Luffy G5",
    anime: "One Piece",
    rarity: "Legendary",
    category: "Premium",
    expBonus: 20,
    image: "https://images.alphacoders.com/132/thumb-1920-1327704.jpeg",
    color: "#EAB308",
  },

  // ─── EPIC (STANDARD) ───
  {
    id: "anya_forger_18",
    name: "Anya Forger 18",
    anime: "Spy x Family",
    rarity: "Epic",
    category: "Standard",
    expBonus: 15,
    image: "https://images.alphacoders.com/123/thumb-1920-1237691.jpg",
    color: "#A855F7",
  },
  {
    id: "midoriya_16",
    name: "Izuku Midoriya 16",
    anime: "My Hero Academia",
    rarity: "Epic",
    category: "Standard",
    expBonus: 15,
    image: "https://images.alphacoders.com/743/thumb-1920-743126.png",
    color: "#A855F7",
  },
  {
    id: "yor_forger_17",
    name: "Yor Forger 17",
    anime: "Spy x Family",
    rarity: "Epic",
    category: "Standard",
    expBonus: 15,
    image: "https://images.alphacoders.com/124/thumb-1920-1246337.jpg",
    color: "#A855F7",
  },
  {
    id: "zoro_king_hell",
    name: "Roronoa Zoro Enma",
    anime: "One Piece",
    rarity: "Epic",
    category: "Standard",
    expBonus: 15,
    image: "https://images.alphacoders.com/131/thumb-1920-1317529.jpeg",
    color: "#A855F7",
  },
  {
    id: "megumin_explosion",
    name: "Megumin Explosion",
    anime: "KonoSuba",
    rarity: "Epic",
    category: "Standard",
    expBonus: 15,
    image: "https://images.alphacoders.com/805/thumb-1920-805177.png",
    color: "#A855F7",
  },

  // ─── RARE (STANDARD) ───
  {
    id: "anya_forger_15",
    name: "Anya Forger 15",
    anime: "Spy x Family",
    rarity: "Rare",
    category: "Standard",
    expBonus: 10,
    image: "https://images.alphacoders.com/124/thumb-1920-1243763.jpg",
    color: "#38BDF8",
  },
  {
    id: "fern_7",
    name: "Fern 7",
    anime: "Sousou no Frieren",
    rarity: "Rare",
    category: "Standard",
    expBonus: 10,
    image: "https://images.alphacoders.com/134/thumb-1920-1340157.png",
    color: "#38BDF8",
  },
  {
    id: "gojo_9",
    name: "Satoru Gojo 9",
    anime: "Jujutsu Kaisen",
    rarity: "Rare",
    category: "Standard",
    expBonus: 10,
    image: "https://images.alphacoders.com/112/thumb-1920-1127027.jpg",
    color: "#38BDF8",
  },
  {
    id: "shinobu_5",
    name: "Shinobu Kocho 5",
    anime: "Demon Slayer",
    rarity: "Rare",
    category: "Standard",
    expBonus: 10,
    image: "https://images.alphacoders.com/104/thumb-1920-1044431.jpg",
    color: "#38BDF8",
  },
  {
    id: "tanjirou_sun",
    name: "Tanjiro Hinokami",
    anime: "Demon Slayer",
    rarity: "Rare",
    category: "Standard",
    expBonus: 10,
    image: "https://images.alphacoders.com/105/thumb-1920-1051939.jpg",
    color: "#38BDF8",
  },

  // ─── NORMAL (BASIC) ───
  {
    id: "naruto_ramen",
    name: "Naruto Ichiraku",
    anime: "Naruto Shippuden",
    rarity: "Normal",
    category: "Basic",
    expBonus: 5,
    image: "https://images.alphacoders.com/131/thumb-1920-1313797.png",
    color: "#94A3B8",
  },
  {
    id: "deku_training",
    name: "Deku Training Ground",
    anime: "My Hero Academia",
    rarity: "Normal",
    category: "Basic",
    expBonus: 5,
    image: "https://images.alphacoders.com/949/thumb-1920-949430.jpg",
    color: "#94A3B8",
  },
  {
    id: "chopper_sakura",
    name: "Chopper Sakura Island",
    anime: "One Piece",
    rarity: "Normal",
    category: "Basic",
    expBonus: 5,
    image: "https://images.alphacoders.com/129/thumb-1920-1296684.png",
    color: "#94A3B8",
  },
  {
    id: "zenitsu_thunder",
    name: "Zenitsu Thunder Clap",
    anime: "Demon Slayer",
    rarity: "Normal",
    category: "Basic",
    expBonus: 5,
    image: "https://images.alphacoders.com/108/thumb-1920-1082531.jpg",
    color: "#94A3B8",
  },
];
