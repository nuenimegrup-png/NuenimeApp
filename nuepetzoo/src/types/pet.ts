export enum PetRarity {
  COMMON = 'Common',
  RARE = 'Rare',
  EPIC = 'Epic',
  LEGEND = 'Legend',
}

export type PetElement = 'fire' | 'ice' | 'nature' | 'mystic' | 'light';

export const ELEMENT_META: Record<
  PetElement,
  { label: string; icon: string; colorClass: string }
> = {
  fire: {
    label: 'Api / Magma',
    icon: '🔥',
    colorClass: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  ice: {
    label: 'Es / Air',
    icon: '❄️',
    colorClass: 'bg-sky-100 text-sky-800 border-sky-300',
  },
  nature: {
    label: 'Alam / Rimba',
    icon: '🌿',
    colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  mystic: {
    label: 'Abyss / Mistis',
    icon: '🔮',
    colorClass: 'bg-purple-100 text-purple-800 border-purple-300',
  },
  light: {
    label: 'Cahaya / Petir',
    icon: '⚡',
    colorClass: 'bg-amber-100 text-amber-900 border-amber-300',
  },
};

export enum PetSpeciesId {
  // Common (50 /hari)
  CERUH_DRAGON = 'ceruh_dragon',
  DRAKO_DRAGON = 'drako_dragon',
  RED_PANDA = 'red_panda', // Kova the Dragon
  HIJAU_SPROUT = 'hijau_sprout',
  FROSTA_MINI = 'frosta_mini',
  LUNA_MINI = 'luna_mini',
  // Rare (100 /hari)
  BABY_DRAGON = 'baby_dragon', // Ignis the Fire
  GLACIUS_ICE = 'glacius_ice',
  BLAZON_RARE = 'blazon_rare',
  STORMO_RARE = 'stormo_rare',
  // Epic (200 /hari)
  FOREST_CAT = 'forest_cat', // Eran the Dragon
  MYSTIC_FOX = 'mystic_fox', // Sylax the Dragon
  NEXAR_DRAGON = 'nexar_dragon',
  VRETH_DRAGON = 'vreth_dragon',
  // Legend (500 /hari)
  VOLT_LEGEND = 'volt_legend',
  VERDRA_LEGEND = 'verdra_legend',
}

export enum PetAIState {
  IDLE = 'IDLE',
  ROAM = 'ROAM',
  INTERACT = 'INTERACT',
  REACT_TAP = 'REACT_TAP',
}

export type InteractionTargetType = 'pond' | 'tree' | 'none';

export type TimeOfDay = 'day' | 'sunset' | 'night';

export type SkyAtmosphereId =
  | 'siang_cerah'
  | 'malam_hari'
  | 'sore_cerah'
  | 'senja_merah'
  | 'hari_hujan'
  | 'musim_salju'
  | 'luar_angkasa'
  | 'akatsuki';

export type IslandThemeId =
  | 'dc_island_1'
  | 'abyss_void'
  | 'inferno_hell'
  | 'dc_island_2'
  | 'dc_island_3'
  | 'dc_island_4'
  | 'frost_glacier'
  | 'celestial_gold';

export interface SkyAtmosphereConfig {
  id: SkyAtmosphereId;
  name: string;
  price: number;
  timeOfDayMapping: TimeOfDay;
  skyGradientClass: string;
}

export interface IslandThemeConfig {
  id: IslandThemeId;
  name: string;
  subtitle: string;
  price: number;
  boostedElements: PetElement[]; // +25% Elemental Synergy Boost
  cardBgColor: string;
  grassStops: [string, string, string, string, string];
  pathColor: string;
  rockStops: [string, string, string, string];
  boulderColors: [number, number, number];
  knollColor: number;
  waterStops: [string, string, string, string];
  waterColorHex: number;
  waterEmissiveHex: number;
  waterfallColor: string;
  tree1Colors: [number, number, number];
  tree2Colors: [number, number, number];
  tree3Colors: [number, number, number];
  shrubColors: [number, number];
}

export interface PetSpeciesConfig {
  id: PetSpeciesId;
  name: string;
  title: string;
  rarity: PetRarity;
  element: PetElement;
  gachaWeight: number;
  coinsPerDay: number; // Base ★1: 50, 100, 200, 500 /hari
  coinsPerTick: number;
  tapBonusCoins: number;
  moveSpeed: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  gifUrl: string; // Level 1 (★1) GIF
  spriteSheetUrl: string; // Level 1 (★1) 3D Sprite Sheet
  evolvedGifUrl?: string; // Level 2+ (★2+) Evolved Winged GIF
  evolvedSpriteSheetUrl?: string; // Level 2+ (★2+) Evolved 3D Sprite Sheet
  cssFilter?: string;
  spriteTintHex?: number;
  frameCount: number;
  sourceGifUrl: string;
  evolvedSourceGifUrl?: string;
  description: string;
  idleBehaviorDesc: string;
  interactBehaviorDesc: string;
  preferredZone: 'pond' | 'tree';
}

export interface OwnedPetInstance {
  instanceId: string;
  speciesId: PetSpeciesId;
  nickname: string;
  obtainedAt: number;
  level: number;
  star: number; // 1 = Lv.1 / ★1 (1x), 2 = Lv.2 / ★2 (Evolved form, 2x coins, 1.25x size), 3 = Lv.3 / ★3 (4x coins, 1.48x size)
  isDeployed: boolean;
  totalCoinsProduced: number;
  customGifUrl?: string;
}

export interface LivePetTelemetry {
  instanceId: string;
  speciesId: PetSpeciesId;
  nickname: string;
  state: PetAIState;
  stateTimer: number;
  targetZone: InteractionTargetType;
  position: { x: number; y: number; z: number };
  unclaimedCoins: number;
}

export const MAX_ISLAND_PETS = 15;
export const GACHA_SINGLE_COST = 500;
export const GACHA_TEN_COST = 5000;
export const COIN_TO_GEM_RATE = 10; // Aturan resmi: 10 Koin = 1 Crystal (50.000 Koin = 5.000 Crystal)
export const ELEMENT_SYNERGY_MULTIPLIER = 1.25; // +25% bonus coins

export const SKY_ATMOSPHERES_LIST: SkyAtmosphereConfig[] = [
  {
    id: 'siang_cerah',
    name: 'Siang Cerah',
    price: 0,
    timeOfDayMapping: 'day',
    skyGradientClass: 'from-[#7CC5F8] via-[#9AD9FB] to-[#BDE8FE]',
  },
  {
    id: 'malam_hari',
    name: 'Malam Hari',
    price: 160,
    timeOfDayMapping: 'night',
    skyGradientClass: 'from-[#090D16] via-[#1E1B4B] to-[#312E81]',
  },
  {
    id: 'sore_cerah',
    name: 'Sore Cerah',
    price: 420,
    timeOfDayMapping: 'sunset',
    skyGradientClass: 'from-[#F472B6] via-[#FBCFE8] to-[#FDE68A]',
  },
  {
    id: 'senja_merah',
    name: 'Senja Merah',
    price: 680,
    timeOfDayMapping: 'sunset',
    skyGradientClass: 'from-[#4C1D95] via-[#9D174D] to-[#EA580C]',
  },
  {
    id: 'hari_hujan',
    name: 'Hari Hujan',
    price: 860,
    timeOfDayMapping: 'day',
    skyGradientClass: 'from-[#334155] via-[#475569] to-[#64748B]',
  },
  {
    id: 'musim_salju',
    name: 'Musim Salju',
    price: 1100,
    timeOfDayMapping: 'day',
    skyGradientClass: 'from-[#93C5FD] via-[#DBEAFE] to-[#F8FAFC]',
  },
  {
    id: 'luar_angkasa',
    name: 'Luar Angkasa',
    price: 1500,
    timeOfDayMapping: 'night',
    skyGradientClass: 'from-[#030712] via-[#1E1B4B] to-[#3B0764]',
  },
  {
    id: 'akatsuki',
    name: 'Akatsuki',
    price: 1800,
    timeOfDayMapping: 'night',
    skyGradientClass: 'from-[#18181B] via-[#450A0A] to-[#7F1D1D]',
  },
];

export const ISLAND_THEMES_LIST: IslandThemeConfig[] = [
  {
    id: 'dc_island_1',
    name: 'DC Island',
    subtitle: 'Bonus +25% Elemen Alam 🌿',
    price: 0,
    boostedElements: ['nature'],
    cardBgColor: '#9CC7D9',
    grassStops: ['#AEEB5B', '#82D139', '#5CB026', '#3F8818', '#2B6110'],
    pathColor: 'rgba(214, 188, 142, 0.55)',
    rockStops: ['#C2A886', '#A68967', '#866B4D', '#574330'],
    boulderColors: [0xb59b7c, 0xa68967, 0x866b4d],
    knollColor: 0x74c635,
    waterStops: ['#0284C7', '#0EA5E9', '#38BDF8', '#BAE6FD'],
    waterColorHex: 0x38bdf8,
    waterEmissiveHex: 0x0284c7,
    waterfallColor: '#38BDF8',
    tree1Colors: [0x15803d, 0x22c55e, 0x86efac],
    tree2Colors: [0xdb2777, 0xf472b6, 0xfbcfe8],
    tree3Colors: [0x166534, 0x4ade80, 0xbef264],
    shrubColors: [0x22c55e, 0x4ade80],
  },
  {
    id: 'abyss_void',
    name: 'Abyss Island',
    subtitle: 'Bonus +25% Mistis 🔮 & Es ❄️',
    price: 2500,
    boostedElements: ['mystic', 'ice'],
    cardBgColor: '#312E81',
    grassStops: ['#4C1D95', '#3B0764', '#2E1065', '#1E1B4B', '#0F172A'],
    pathColor: 'rgba(139, 92, 246, 0.45)',
    rockStops: ['#334155', '#1E293B', '#0F172A', '#020617'],
    boulderColors: [0x312e81, 0x1e1b4b, 0x4c1d95],
    knollColor: 0x3b0764,
    waterStops: ['#7E22CE', '#A855F7', '#22D3EE', '#E0F2FE'],
    waterColorHex: 0xa855f7,
    waterEmissiveHex: 0x06b6d4,
    waterfallColor: '#22D3EE',
    tree1Colors: [0x312e81, 0x6366f1, 0x38bdf8],
    tree2Colors: [0x581c87, 0xa855f7, 0xf0abfc],
    tree3Colors: [0x1e3a8a, 0x06b6d4, 0x67e8f9],
    shrubColors: [0x6366f1, 0x22d3ee],
  },
  {
    id: 'inferno_hell',
    name: 'Neraka Island',
    subtitle: 'Bonus +25% Elemen Api 🔥',
    price: 3500,
    boostedElements: ['fire'],
    cardBgColor: '#7F1D1D',
    grassStops: ['#451A03', '#3F1D1D', '#291515', '#1C1917', '#0C0A09'],
    pathColor: 'rgba(249, 115, 22, 0.65)',
    rockStops: ['#44403C', '#292524', '#1C1917', '#0C0A09'],
    boulderColors: [0x44403c, 0x292524, 0x7f1d1d],
    knollColor: 0x3f1d1d,
    waterStops: ['#991B1B', '#DC2626', '#F97316', '#FDE047'],
    waterColorHex: 0xf97316,
    waterEmissiveHex: 0xdc2626,
    waterfallColor: '#F97316',
    tree1Colors: [0x7f1d1d, 0xdc2626, 0xf97316],
    tree2Colors: [0x451a03, 0xb45309, 0xfacc15],
    tree3Colors: [0x4c0519, 0xe11d48, 0xfb7185],
    shrubColors: [0xdc2626, 0xf97316],
  },
  {
    id: 'dc_island_2',
    name: 'DC Island 2',
    subtitle: 'Bonus +25% Cahaya ⚡ & Alam 🌿',
    price: 5000,
    boostedElements: ['light', 'nature'],
    cardBgColor: '#C5E1B5',
    grassStops: ['#BEF264', '#A3E635', '#65A30D', '#4D7C0F', '#365314'],
    pathColor: 'rgba(253, 224, 71, 0.5)',
    rockStops: ['#E7E5E4', '#D6D3D1', '#A8A29E', '#78716C'],
    boulderColors: [0xd6d3d1, 0xa8a29e, 0x78716c],
    knollColor: 0x84cc16,
    waterStops: ['#0D9488', '#14B8A6', '#2DD4BF', '#CCFBF1'],
    waterColorHex: 0x2dd4bf,
    waterEmissiveHex: 0x0d9488,
    waterfallColor: '#2DD4BF',
    tree1Colors: [0x15803d, 0x4ade80, 0xfef08a],
    tree2Colors: [0xbe185d, 0xf472b6, 0xfde047],
    tree3Colors: [0x047857, 0x34d399, 0xa7f3d0],
    shrubColors: [0x4ade80, 0xa3e635],
  },
  {
    id: 'dc_island_3',
    name: 'DC Island 3',
    subtitle: 'Bonus +25% Alam 🌿 & Api 🔥',
    price: 5000,
    boostedElements: ['nature', 'fire'],
    cardBgColor: '#D6CEE6',
    grassStops: ['#4ADE80', '#22C55E', '#16A34A', '#15803D', '#14532D'],
    pathColor: 'rgba(125, 211, 252, 0.55)',
    rockStops: ['#64748B', '#475569', '#334155', '#1E293B'],
    boulderColors: [0x64748b, 0x475569, 0x334155],
    knollColor: 0x16a34a,
    waterStops: ['#0369A1', '#0284C7', '#38BDF8', '#E0F2FE'],
    waterColorHex: 0x38bdf8,
    waterEmissiveHex: 0x0284c7,
    waterfallColor: '#7DD3FC',
    tree1Colors: [0x065f46, 0x10b981, 0x6ee7b7],
    tree2Colors: [0x3f6212, 0x84cc16, 0xd9f99d],
    tree3Colors: [0x14532d, 0x22c55e, 0x86efac],
    shrubColors: [0x10b981, 0x34d399],
  },
  {
    id: 'dc_island_4',
    name: 'DC Island 4',
    subtitle: 'Bonus +25% Mistis 🔮 & Cahaya ⚡',
    price: 5000,
    boostedElements: ['mystic', 'light'],
    cardBgColor: '#DFD2B2',
    grassStops: ['#86EFAC', '#4ADE80', '#22C55E', '#15803D', '#166534'],
    pathColor: 'rgba(244, 114, 182, 0.45)',
    rockStops: ['#D6D3D1', '#A8A29E', '#78716C', '#57534E'],
    boulderColors: [0xd6d3d1, 0xa8a29e, 0x78716c],
    knollColor: 0x4ade80,
    waterStops: ['#6D28D9', '#8B5CF6', '#C084FC', '#F3E8FF'],
    waterColorHex: 0xc084fc,
    waterEmissiveHex: 0x9333ea,
    waterfallColor: '#E879F9',
    tree1Colors: [0x9d174d, 0xec4899, 0xfbcfe8],
    tree2Colors: [0x7e22ce, 0xc084fc, 0xf5d0fe],
    tree3Colors: [0xbe185d, 0xf472b6, 0xfce7f3],
    shrubColors: [0xf472b6, 0xc084fc],
  },
  {
    id: 'frost_glacier',
    name: 'Frost Glacier',
    subtitle: 'Bonus +25% Elemen Es ❄️',
    price: 6500,
    boostedElements: ['ice'],
    cardBgColor: '#BAE6FD',
    grassStops: ['#F8FAFC', '#E0F2FE', '#BAE6FD', '#7DD3FC', '#38BDF8'],
    pathColor: 'rgba(125, 211, 252, 0.6)',
    rockStops: ['#93C5FD', '#60A5FA', '#3B82F6', '#1D4ED8'],
    boulderColors: [0xbfdbfe, 0x93c5fd, 0x60a5fa],
    knollColor: 0xe0f2fe,
    waterStops: ['#0284C7', '#38BDF8', '#7DD3FC', '#F0F9FF'],
    waterColorHex: 0x7dd3fc,
    waterEmissiveHex: 0x38bdf8,
    waterfallColor: '#E0F2FE',
    tree1Colors: [0x0369a1, 0x38bdf8, 0xf8fafc],
    tree2Colors: [0x1e40af, 0x60a5fa, 0xeff6ff],
    tree3Colors: [0x0f766e, 0x2dd4bf, 0xf0fdfa],
    shrubColors: [0x7dd3fc, 0xe0f2fe],
  },
  {
    id: 'celestial_gold',
    name: 'Celestial Gold',
    subtitle: 'Bonus +25% Cahaya ⚡ & Api 🔥',
    price: 8000,
    boostedElements: ['light', 'fire'],
    cardBgColor: '#FDE68A',
    grassStops: ['#FEF08A', '#FACC15', '#EAB308', '#CA8A04', '#A16207'],
    pathColor: 'rgba(255, 255, 255, 0.65)',
    rockStops: ['#FFFBEB', '#FEF3C7', '#FDE68A', '#D97706'],
    boulderColors: [0xfef3c7, 0xfde68a, 0xf59e0b],
    knollColor: 0xfacc15,
    waterStops: ['#0284C7', '#38BDF8', '#7DD3FC', '#FEF9C3'],
    waterColorHex: 0x38bdf8,
    waterEmissiveHex: 0xfacc15,
    waterfallColor: '#FEF08A',
    tree1Colors: [0xb45309, 0xf59e0b, 0xfef08a],
    tree2Colors: [0xa16207, 0xeab308, 0xfef9c3],
    tree3Colors: [0x047857, 0x34d399, 0xfef08a],
    shrubColors: [0xfacc15, 0xfde047],
  },
];

export const PET_SPECIES_CATALOG: Record<PetSpeciesId, PetSpeciesConfig> = {
  // ================= KARAKTER UTAMA AKTIF (10 KARAKTER DARI USER) =================
  // 0A. Ceruh / Solar Dragon: Level 1 (Bayi: Cur3VCU.gif) -> Level 2 (Bersayap Besar: bXTTt2.gif)
  [PetSpeciesId.CERUH_DRAGON]: {
    id: PetSpeciesId.CERUH_DRAGON,
    name: 'Ceruh',
    title: 'the Dragon',
    rarity: PetRarity.EPIC,
    element: 'light',
    gachaWeight: 12,
    coinsPerDay: 200,
    coinsPerTick: 8,
    tapBonusCoins: 30,
    moveSpeed: 1.5,
    primaryColor: '#F59E0B',
    secondaryColor: '#FEF08A',
    accentColor: '#D97706',
    gifUrl: '/assets/pets/dragon_solar_lv1.gif',
    spriteSheetUrl: '/assets/pets/dragon_solar_lv1_sheet.png',
    evolvedGifUrl: '/assets/pets/dragon_solar.gif',
    evolvedSpriteSheetUrl: '/assets/pets/dragon_solar_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://c.termai.cc/i113/Cur3VCU.gif',
    evolvedSourceGifUrl: 'https://c.termai.cc/i168/bXTTt2.gif',
    description:
      'Lv.1 berbentuk bayi naga mahkota emas, dan saat naik ke Lv.2 berevolusi menjadi naga besar bersayap!',
    idleBehaviorDesc: 'Lv.1 melompat ceria, Lv.2 mengepakkan sayap naga emas',
    interactBehaviorDesc: 'Bermain air di tepi laguna',
    preferredZone: 'pond',
  },

  // 1. Karakter Baru #1 — Vespera the Magician (Lv.1: jmxe4d58.gif -> Lv.2: mu8b9p4z.gif)
  [PetSpeciesId.STORMO_RARE]: {
    id: PetSpeciesId.STORMO_RARE,
    name: 'Vespera',
    title: 'the Magician',
    rarity: PetRarity.EPIC,
    element: 'mystic',
    gachaWeight: 12,
    coinsPerDay: 200,
    coinsPerTick: 8,
    tapBonusCoins: 30,
    moveSpeed: 1.55,
    primaryColor: '#A855F7',
    secondaryColor: '#F3E8FF',
    accentColor: '#DC2626',
    gifUrl: '/assets/pets/pet_1_lv1.gif',
    spriteSheetUrl: '/assets/pets/pet_1_lv1_sheet.png',
    evolvedGifUrl: '/assets/pets/pet_1_lv2.gif',
    evolvedSpriteSheetUrl: '/assets/pets/pet_1_lv2_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://imagepaste.org/i/jmxe4d58.gif',
    evolvedSourceGifUrl: 'https://imagepaste.org/i/mu8b9p4z.gif',
    description:
      'Naga pesulap malam bertopi pesulap hitam-merah. Berevolusi di Lv.2 menjadi ratu naga bersayap ungu anggun!',
    idleBehaviorDesc: 'Memainkan trik sulap topi malam',
    interactBehaviorDesc: 'Menari anggun di dekat pohon pulau',
    preferredZone: 'tree',
  },

  // 2. Karakter Baru #2 — Sumi the Ink Dragon (Lv.1: jhqrx9mk.gif -> Lv.2: u9hnudqj.gif)
  [PetSpeciesId.DRAKO_DRAGON]: {
    id: PetSpeciesId.DRAKO_DRAGON,
    name: 'Sumi',
    title: 'the Ink Dragon',
    rarity: PetRarity.RARE,
    element: 'mystic',
    gachaWeight: 16,
    coinsPerDay: 100,
    coinsPerTick: 4,
    tapBonusCoins: 15,
    moveSpeed: 1.5,
    primaryColor: '#44403C',
    secondaryColor: '#F5F5F4',
    accentColor: '#EF4444',
    gifUrl: '/assets/pets/pet_2_lv1.gif',
    spriteSheetUrl: '/assets/pets/pet_2_lv1_sheet.png',
    evolvedGifUrl: '/assets/pets/pet_2_lv2.gif',
    evolvedSpriteSheetUrl: '/assets/pets/pet_2_lv2_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://imagepaste.org/i/jhqrx9mk.gif',
    evolvedSourceGifUrl: 'https://imagepaste.org/i/u9hnudqj.gif',
    description:
      'Naga lukis tinta timur pembawa kuas kaligrafi raksasa. Di Lv.2 berevolusi menjadi naga panjang penjaga gulungan kuno!',
    idleBehaviorDesc: 'Melukis pusaran tinta di udara',
    interactBehaviorDesc: 'Mencelupkan kuas di tepi kolam jernih',
    preferredZone: 'pond',
  },

  // 3. Karakter Baru #3 — Nautilo the Captain (Lv.1: zwg76zaa.gif -> Lv.2: z8dbnrk5.gif)
  [PetSpeciesId.NEXAR_DRAGON]: {
    id: PetSpeciesId.NEXAR_DRAGON,
    name: 'Nautilo',
    title: 'the Captain',
    rarity: PetRarity.EPIC,
    element: 'ice',
    gachaWeight: 12,
    coinsPerDay: 200,
    coinsPerTick: 8,
    tapBonusCoins: 30,
    moveSpeed: 1.6,
    primaryColor: '#06B6D4',
    secondaryColor: '#ECFEFF',
    accentColor: '#FACC15',
    gifUrl: '/assets/pets/pet_3_lv1.gif',
    spriteSheetUrl: '/assets/pets/pet_3_lv1_sheet.png',
    evolvedGifUrl: '/assets/pets/pet_3_lv2.gif',
    evolvedSpriteSheetUrl: '/assets/pets/pet_3_lv2_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://imagepaste.org/i/zwg76zaa.gif',
    evolvedSourceGifUrl: 'https://imagepaste.org/i/z8dbnrk5.gif',
    description:
      'Naga kapten samudra bertopi jangkar emas. Saat naik ke Lv.2 berubah menjadi Laksamana Naga kekar bersayap lebar!',
    idleBehaviorDesc: 'Memberi hormat kapten samudra',
    interactBehaviorDesc: 'Berpatroli di dermaga & air terjun pulau',
    preferredZone: 'pond',
  },

  // 4. Karakter Baru #4 — Aurelia the Fae Fox (Lv.1: bp87hnku.gif -> Lv.2: 5kegmbcf.gif)
  [PetSpeciesId.MYSTIC_FOX]: {
    id: PetSpeciesId.MYSTIC_FOX,
    name: 'Aurelia',
    title: 'the Fae Fox',
    rarity: PetRarity.LEGEND,
    element: 'fire',
    gachaWeight: 8,
    coinsPerDay: 500,
    coinsPerTick: 20,
    tapBonusCoins: 60,
    moveSpeed: 1.75,
    primaryColor: '#F97316',
    secondaryColor: '#F3E8FF',
    accentColor: '#A855F7',
    gifUrl: '/assets/pets/pet_4_lv1.gif',
    spriteSheetUrl: '/assets/pets/pet_4_lv1_sheet.png',
    evolvedGifUrl: '/assets/pets/pet_4_lv2.gif',
    evolvedSpriteSheetUrl: '/assets/pets/pet_4_lv2_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://imagepaste.org/i/bp87hnku.gif',
    evolvedSourceGifUrl: 'https://imagepaste.org/i/5kegmbcf.gif',
    description:
      'Rubah naga kosmik bersayap pelangi. Berevolusi di Lv.2 menjadi Kitsune Fae agung berekor bunga galaksi!',
    idleBehaviorDesc: 'Menebarkan debu bintang pelangi',
    interactBehaviorDesc: 'Bersantai di bawah pohon keramat',
    preferredZone: 'tree',
  },

  // 5. Karakter Baru #5 — Flora the Blossom (Lv.1: q54j69cn.gif, Lv.2: TIDAK ADA)
  [PetSpeciesId.HIJAU_SPROUT]: {
    id: PetSpeciesId.HIJAU_SPROUT,
    name: 'Flora',
    title: 'the Blossom',
    rarity: PetRarity.COMMON,
    element: 'nature',
    gachaWeight: 22,
    coinsPerDay: 50,
    coinsPerTick: 2,
    tapBonusCoins: 8,
    moveSpeed: 1.4,
    primaryColor: '#10B981',
    secondaryColor: '#FCE7F3',
    accentColor: '#F43F5E',
    gifUrl: '/assets/pets/pet_5_lv1.gif',
    spriteSheetUrl: '/assets/pets/pet_5_lv1_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://imagepaste.org/i/q54j69cn.gif',
    description:
      'Naga kuncup bunga sakura dengan sahabat burung mungil di kepalanya. (Khusus form Lv.1, tidak memiliki evolusi Lv.2).',
    idleBehaviorDesc: 'Bermain bersama burung mungil di tanduk daunnya',
    interactBehaviorDesc: 'Merawat bunga-bunga di sekitar pohon',
    preferredZone: 'tree',
  },

  // 6. Karakter Baru #6 — Joy the Coin Dragon (Lv.1: ueqbcscb.gif -> Lv.2: wyq8dk2j.gif)
  [PetSpeciesId.VOLT_LEGEND]: {
    id: PetSpeciesId.VOLT_LEGEND,
    name: 'Joy',
    title: 'the Coin Dragon',
    rarity: PetRarity.LEGEND,
    element: 'light',
    gachaWeight: 8,
    coinsPerDay: 500,
    coinsPerTick: 20,
    tapBonusCoins: 60,
    moveSpeed: 1.75,
    primaryColor: '#FACC15',
    secondaryColor: '#FEF9C3',
    accentColor: '#0284C7',
    gifUrl: '/assets/pets/pet_6_lv1.gif',
    spriteSheetUrl: '/assets/pets/pet_6_lv1_sheet.png',
    evolvedGifUrl: '/assets/pets/pet_6_lv2.gif',
    evolvedSpriteSheetUrl: '/assets/pets/pet_6_lv2_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://imagepaste.org/i/ueqbcscb.gif',
    evolvedSourceGifUrl: 'https://imagepaste.org/i/wyq8dk2j.gif',
    description:
      'Naga koin emas pembawa keberuntungan yang selalu tertawa ceria. Di Lv.2 berevolusi menjadi naga koin raksasa bersayap lebar!',
    idleBehaviorDesc: 'Tertawa riang sambil memancarkan kilau koin emas',
    interactBehaviorDesc: 'Menyebarkan berkah koin di tepi kolam',
    preferredZone: 'pond',
  },

  // 7. Karakter Baru #7 — Vreth the Horned (Lv.1: veks83jp.gif, Lv.2: TIDAK ADA)
  [PetSpeciesId.VRETH_DRAGON]: {
    id: PetSpeciesId.VRETH_DRAGON,
    name: 'Vreth',
    title: 'the Horned',
    rarity: PetRarity.RARE,
    element: 'nature',
    gachaWeight: 18,
    coinsPerDay: 100,
    coinsPerTick: 4,
    tapBonusCoins: 15,
    moveSpeed: 1.5,
    primaryColor: '#16A34A',
    secondaryColor: '#DCFCE7',
    accentColor: '#CA8A04',
    gifUrl: '/assets/pets/pet_7_lv1.gif',
    spriteSheetUrl: '/assets/pets/pet_7_lv1_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://imagepaste.org/i/veks83jp.gif',
    description:
      'Naga rimba zamrud bertanduk rusa kuno dengan tato cahaya hijau. (Khusus form Lv.1, tidak memiliki evolusi Lv.2).',
    idleBehaviorDesc: 'Menghentakkan kaki menjaga hutan pulau',
    interactBehaviorDesc: 'Berteduh di bawah pohon rimbun',
    preferredZone: 'tree',
  },

  // 8. Kova the Dragon (dUICNe.gif — Lv.1 only)
  [PetSpeciesId.RED_PANDA]: {
    id: PetSpeciesId.RED_PANDA,
    name: 'Kova',
    title: 'the Dragon',
    rarity: PetRarity.COMMON,
    element: 'ice',
    gachaWeight: 20,
    coinsPerDay: 50,
    coinsPerTick: 2,
    tapBonusCoins: 8,
    moveSpeed: 1.35,
    primaryColor: '#38BDF8',
    secondaryColor: '#E0F2FE',
    accentColor: '#0284C7',
    gifUrl: '/assets/pets/dragon_frost.gif',
    spriteSheetUrl: '/assets/pets/dragon_frost_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://c.termai.cc/i126/dUICNe.gif',
    description:
      'Naga kristal biru muda yang gemar melayang di dekat air terjun pulau.',
    idleBehaviorDesc: 'Melayang mengepakkan kristal es biru',
    interactBehaviorDesc: 'Mendinginkan diri di tepi kolam air jernih',
    preferredZone: 'pond',
  },

  // 9. Ignis the Fire (Z5UwT.gif — Lv.1 only)
  [PetSpeciesId.BABY_DRAGON]: {
    id: PetSpeciesId.BABY_DRAGON,
    name: 'Ignis',
    title: 'the Fire',
    rarity: PetRarity.RARE,
    element: 'fire',
    gachaWeight: 15,
    coinsPerDay: 100,
    coinsPerTick: 4,
    tapBonusCoins: 15,
    moveSpeed: 1.55,
    primaryColor: '#EF4444',
    secondaryColor: '#FBBF24',
    accentColor: '#F97316',
    gifUrl: '/assets/pets/dragon_crimson.gif',
    spriteSheetUrl: '/assets/pets/dragon_crimson_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://c.termai.cc/i156/Z5UwT.gif',
    description:
      'Naga api merah membara dengan pedang magma yang menjaga jembatan pulau.',
    idleBehaviorDesc: 'Melayang gagah menggenggam pedang magma',
    interactBehaviorDesc: 'Berpatroli di dekat jembatan kayu & pohon',
    preferredZone: 'tree',
  },

  // ================= CADANGAN (SLOT BERIKUTNYA) =================
  [PetSpeciesId.FROSTA_MINI]: {
    id: PetSpeciesId.FROSTA_MINI,
    name: 'Frosta',
    title: 'the Mini',
    rarity: PetRarity.COMMON,
    element: 'ice',
    gachaWeight: 0,
    coinsPerDay: 50,
    coinsPerTick: 2,
    tapBonusCoins: 8,
    moveSpeed: 1.5,
    primaryColor: '#7DD3FC',
    secondaryColor: '#F0F9FF',
    accentColor: '#0369A1',
    gifUrl: '/assets/pets/dragon_frost.gif',
    spriteSheetUrl: '/assets/pets/dragon_frost_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://c.termai.cc/i126/dUICNe.gif',
    description: 'Slot karakter tahap berikutnya.',
    idleBehaviorDesc: 'Berputar lembut',
    interactBehaviorDesc: 'Minum air embun',
    preferredZone: 'pond',
  },
  [PetSpeciesId.LUNA_MINI]: {
    id: PetSpeciesId.LUNA_MINI,
    name: 'Luna',
    title: 'the Mini',
    rarity: PetRarity.COMMON,
    element: 'mystic',
    gachaWeight: 0,
    coinsPerDay: 50,
    coinsPerTick: 2,
    tapBonusCoins: 8,
    moveSpeed: 1.5,
    primaryColor: '#312E81',
    secondaryColor: '#818CF8',
    accentColor: '#1E1B4B',
    gifUrl: '/assets/pets/dragon_crimson.gif',
    spriteSheetUrl: '/assets/pets/dragon_crimson_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://c.termai.cc/i156/Z5UwT.gif',
    description: 'Slot karakter tahap berikutnya.',
    idleBehaviorDesc: 'Mengamati awan malam',
    interactBehaviorDesc: 'Berteduh di bayangan pohon',
    preferredZone: 'tree',
  },
  [PetSpeciesId.GLACIUS_ICE]: {
    id: PetSpeciesId.GLACIUS_ICE,
    name: 'Glacius',
    title: 'the Ice',
    rarity: PetRarity.RARE,
    element: 'ice',
    gachaWeight: 0,
    coinsPerDay: 100,
    coinsPerTick: 4,
    tapBonusCoins: 15,
    moveSpeed: 1.55,
    primaryColor: '#06B6D4',
    secondaryColor: '#CFFAFE',
    accentColor: '#0E7490',
    gifUrl: '/assets/pets/dragon_frost.gif',
    spriteSheetUrl: '/assets/pets/dragon_frost_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://c.termai.cc/i126/dUICNe.gif',
    description: 'Slot karakter tahap berikutnya.',
    idleBehaviorDesc: 'Mengepakkan sayap es',
    interactBehaviorDesc: 'Menjaga air terjun',
    preferredZone: 'pond',
  },
  [PetSpeciesId.BLAZON_RARE]: {
    id: PetSpeciesId.BLAZON_RARE,
    name: 'Blazon',
    title: 'the Rare',
    rarity: PetRarity.RARE,
    element: 'fire',
    gachaWeight: 0,
    coinsPerDay: 100,
    coinsPerTick: 4,
    tapBonusCoins: 15,
    moveSpeed: 1.6,
    primaryColor: '#EA580C',
    secondaryColor: '#FFEDD5',
    accentColor: '#C2410C',
    gifUrl: '/assets/pets/dragon_solar.gif',
    spriteSheetUrl: '/assets/pets/dragon_solar_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://c.termai.cc/i168/bXTTt2.gif',
    description: 'Slot karakter tahap berikutnya.',
    idleBehaviorDesc: 'Melayang hangat',
    interactBehaviorDesc: 'Beristirahat di taman',
    preferredZone: 'tree',
  },
  [PetSpeciesId.FOREST_CAT]: {
    id: PetSpeciesId.FOREST_CAT,
    name: 'Eran',
    title: 'the Dragon',
    rarity: PetRarity.EPIC,
    element: 'nature',
    gachaWeight: 0,
    coinsPerDay: 200,
    coinsPerTick: 8,
    tapBonusCoins: 30,
    moveSpeed: 1.65,
    primaryColor: '#10B981',
    secondaryColor: '#D1FAE5',
    accentColor: '#047857',
    gifUrl: '/assets/pets/dragon_solar_lv1.gif',
    spriteSheetUrl: '/assets/pets/dragon_solar_lv1_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://c.termai.cc/i113/Cur3VCU.gif',
    description: 'Slot karakter tahap berikutnya.',
    idleBehaviorDesc: 'Meliukkan tubuh naga',
    interactBehaviorDesc: 'Menjaga pohon utama',
    preferredZone: 'tree',
  },
  [PetSpeciesId.VERDRA_LEGEND]: {
    id: PetSpeciesId.VERDRA_LEGEND,
    name: 'Verdra',
    title: 'the Legend',
    rarity: PetRarity.LEGEND,
    element: 'nature',
    gachaWeight: 0,
    coinsPerDay: 500,
    coinsPerTick: 20,
    tapBonusCoins: 60,
    moveSpeed: 1.8,
    primaryColor: '#34D399',
    secondaryColor: '#ECFDF5',
    accentColor: '#F59E0B',
    gifUrl: '/assets/pets/dragon_solar.gif',
    spriteSheetUrl: '/assets/pets/dragon_solar_sheet.png',
    frameCount: 16,
    sourceGifUrl: 'https://c.termai.cc/i168/bXTTt2.gif',
    description: 'Slot karakter tahap berikutnya.',
    idleBehaviorDesc: 'Terbang anggun',
    interactBehaviorDesc: 'Memberkati pohon suci',
    preferredZone: 'tree',
  },
};

/**
 * Daftar karakter aktif saat ini: 7 karakter baru yang dikirim user + 3 karakter sebelumnya
 */
export const PET_SPECIES_LIST: PetSpeciesConfig[] = [
  PET_SPECIES_CATALOG[PetSpeciesId.STORMO_RARE], // 1. Vespera (Lv.1 & Lv.2)
  PET_SPECIES_CATALOG[PetSpeciesId.DRAKO_DRAGON], // 2. Sumi (Lv.1 & Lv.2)
  PET_SPECIES_CATALOG[PetSpeciesId.NEXAR_DRAGON], // 3. Nautilo (Lv.1 & Lv.2)
  PET_SPECIES_CATALOG[PetSpeciesId.MYSTIC_FOX], // 4. Aurelia (Lv.1 & Lv.2)
  PET_SPECIES_CATALOG[PetSpeciesId.HIJAU_SPROUT], // 5. Flora (Lv.1 saja, Lv.2 tidak ada)
  PET_SPECIES_CATALOG[PetSpeciesId.VOLT_LEGEND], // 6. Joy (Lv.1 & Lv.2)
  PET_SPECIES_CATALOG[PetSpeciesId.VRETH_DRAGON], // 7. Vreth (Lv.1 saja, Lv.2 tidak ada)
  PET_SPECIES_CATALOG[PetSpeciesId.CERUH_DRAGON], // 8. Ceruh (Lv.1 & Lv.2)
  PET_SPECIES_CATALOG[PetSpeciesId.RED_PANDA], // 9. Kova (Lv.1 saja)
  PET_SPECIES_CATALOG[PetSpeciesId.BABY_DRAGON], // 10. Ignis (Lv.1 saja)
];

/**
 * Returns stage-specific visual assets (Level 1 vs Level 2 Evolution if available)
 */
export function getPetStageVisuals(
  speciesId: PetSpeciesId,
  starOrLevel: number = 1
): {
  gifUrl: string;
  spriteSheetUrl: string;
  hasEvolution: boolean;
  isEvolved: boolean;
  stageLabel: string;
} {
  const spec = PET_SPECIES_CATALOG[speciesId];
  const hasEvolution = Boolean(spec.evolvedGifUrl && spec.evolvedSpriteSheetUrl);
  const isEvolved = hasEvolution && starOrLevel >= 2;
  return {
    gifUrl: isEvolved && spec.evolvedGifUrl ? spec.evolvedGifUrl : spec.gifUrl,
    spriteSheetUrl:
      isEvolved && spec.evolvedSpriteSheetUrl
        ? spec.evolvedSpriteSheetUrl
        : spec.spriteSheetUrl,
    hasEvolution,
    isEvolved,
    stageLabel: hasEvolution
      ? isEvolved
        ? 'Lv.2 Evolusi'
        : 'Lv.1 Bayi'
      : 'Lv.1 (Max)',
  };
}

/**
 * Checks if a pet species receives the +25% Elemental Synergy Boost on the active island
 */
export function hasIslandElementSynergy(
  speciesId: PetSpeciesId,
  islandId: IslandThemeId
): boolean {
  const spec = PET_SPECIES_CATALOG[speciesId];
  const island = ISLAND_THEMES_LIST.find((i) => i.id === islandId);
  if (!spec || !island) return false;
  return island.boostedElements.includes(spec.element);
}

/**
 * Computes effective daily coins taking into account Star level (★1=1x, ★2=2x, ★3=4x)
 * and +25% Island Elemental Synergy Boost
 */
export function getEffectiveCoinsPerDay(
  speciesId: PetSpeciesId,
  star: number = 1,
  islandId?: IslandThemeId
): number {
  const spec = PET_SPECIES_CATALOG[speciesId];
  const starMult = Math.pow(2, Math.max(0, (star || 1) - 1)); // ★1=1, ★2=2, ★3=4
  const synergyMult =
    islandId && hasIslandElementSynergy(speciesId, islandId)
      ? ELEMENT_SYNERGY_MULTIPLIER
      : 1;
  return Math.round(spec.coinsPerDay * starMult * synergyMult);
}

/**
 * Computes 3D visual scale multiplier for Star level (★1 = 1.0, ★2 = 1.25, ★3 = 1.48)
 */
export function getStarScaleMultiplier(star: number = 1): number {
  if (star >= 3) return 1.48;
  if (star === 2) return 1.25;
  return 1.0;
}
