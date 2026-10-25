import { CityTierCode, SimulationMission } from '../types/nuenime';

/**
 * ============================================================================
 * KONFIGURASI TERPUSAT SISTEM DUNIA NUENIME
 * ============================================================================
 * Seluruh parameter kapasitas, HP awal kota, tabel Tier I–VIII, formula EXP
 * kenaikan level kota tanpa batas maksimum tetap, dan nilai reward misi simulasi
 * disimpan di satu tempat agar balancing dapat diubah tanpa menyentuh komponen UI.
 */

export const NUENIME_SYSTEM_LIMITS = {
  /** Maksimal 15 klan per kota (Divalidasi di tingkat repository) */
  MAX_CLANS_PER_CITY: 15,
  /** Maksimal 100 anggota per klan termasuk pemimpin klan */
  MAX_MEMBERS_PER_CLAN: 100,
  /** HP awal setiap kota pada Level 1 adalah 10.000 / 10.000 HP */
  INITIAL_CITY_LEVEL_1_HP: 10000,
  /** Bonus HP maksimum kota setiap naik 1 level (jika sistem pertahanan kota berkembang) */
  CITY_HP_BONUS_PER_LEVEL: 0,
  /** Batas aman integer JavaScript (2^53 - 1) agar tidak terjadi overflow pada level tanpa batas */
  MAX_SAFE_EXP: Number.MAX_SAFE_INTEGER,
} as const;

/**
 * Parameter Formula EXP Level Kota:
 * Target EXP untuk naik dari Level L ke Level (L + 1):
 *   TargetEXP(L) = BASE_EXP + (L - 1) * LINEAR_STEP + Math.floor(Math.pow(L - 1, EXPONENT) * CURVE_FACTOR)
 *
 * Contoh nilai:
 * - Level 1 -> Level 2 : 500 EXP
 * - Level 2 -> Level 3 : 650 EXP
 * - Level 3 -> Level 4 : 820 EXP
 * - Level 10 -> Level 11 (Tier II): ~2.200 EXP
 */
export const CITY_LEVEL_EXP_FORMULA_PARAMS = {
  BASE_EXP_LEVEL_1: 500,
  LINEAR_EXP_STEP: 140,
  CURVE_FACTOR: 15,
  CURVE_EXPONENT: 1.35,
} as const;

/**
 * Konfigurasi Tabel Tier Kota (Tier I s/d Tier VIII)
 * Tier dihitung secara dinamis berdasarkan level kota saat ini.
 */
export interface CityTierDefinition {
  tier: CityTierCode;
  minLevel: number;
  maxLevel: number | null; // null berarti tidak terbatas (1.001 ke atas)
  title: string;
  badgeColor: string;
}

export const CITY_TIER_TABLE: CityTierDefinition[] = [
  { tier: 'Tier I', minLevel: 1, maxLevel: 10, title: 'Perintis Wilayah', badgeColor: '#94A3B8' },
  { tier: 'Tier II', minLevel: 11, maxLevel: 25, title: 'Benteng Berkembang', badgeColor: '#38BDF8' },
  { tier: 'Tier III', minLevel: 26, maxLevel: 50, title: 'Kota Kedaulatan', badgeColor: '#34D399' },
  { tier: 'Tier IV', minLevel: 51, maxLevel: 100, title: 'Metropolis Agung', badgeColor: '#A855F7' },
  { tier: 'Tier V', minLevel: 101, maxLevel: 250, title: 'Citadel Legendaris', badgeColor: '#F59E0B' },
  { tier: 'Tier VI', minLevel: 251, maxLevel: 500, title: 'Bastion Mythic', badgeColor: '#F97316' },
  { tier: 'Tier VII', minLevel: 501, maxLevel: 1000, title: 'Dominion Astral', badgeColor: '#EC4899' },
  { tier: 'Tier VIII', minLevel: 1001, maxLevel: null, title: 'Kekaisaran Abadi', badgeColor: '#FBBF24' },
];

/**
 * Menghitung Tier Kota secara otomatis berdasarkan Level Kota saat ini.
 */
export function computeCityTierFromLevel(level: number): CityTierCode {
  const safeLevel = Math.max(1, Math.floor(level));
  for (const def of CITY_TIER_TABLE) {
    if (def.maxLevel === null) {
      if (safeLevel >= def.minLevel) return def.tier;
    } else if (safeLevel >= def.minLevel && safeLevel <= def.maxLevel) {
      return def.tier;
    }
  }
  return 'Tier I';
}

export function getCityTierDefinition(level: number): CityTierDefinition {
  const tierCode = computeCityTierFromLevel(level);
  return CITY_TIER_TABLE.find((t) => t.tier === tierCode) ?? CITY_TIER_TABLE[0];
}

/**
 * Menghitung kebutuhan EXP untuk naik dari `level` ke `level + 1`.
 * Aman terhadap angka besar dan tidak akan overflow.
 */
export function getRequiredExpForCityLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  const { BASE_EXP_LEVEL_1, LINEAR_EXP_STEP, CURVE_FACTOR, CURVE_EXPONENT } =
    CITY_LEVEL_EXP_FORMULA_PARAMS;

  const n = safeLevel - 1;
  const raw =
    BASE_EXP_LEVEL_1 + n * LINEAR_EXP_STEP + Math.floor(Math.pow(n, CURVE_EXPONENT) * CURVE_FACTOR);

  return Math.min(NUENIME_SYSTEM_LIMITS.MAX_SAFE_EXP, Math.max(100, Math.round(raw)));
}

/**
 * Menghitung Level Kota, Tier Kota, EXP pada level saat ini, dan Target EXP level berikutnya
 * secara deterministik dari `totalExp` kota.
 * Mendukung kenaikan multi-level sekaligus apabila satu reward melewati beberapa ambang level.
 */
export function computeCityLevelProgressFromTotalExp(totalExp: number): {
  level: number;
  tier: CityTierCode;
  totalExp: number;
  currentLevelExp: number;
  nextLevelTargetExp: number;
  progressPercent: number;
} {
  const clampedTotalExp = Math.max(
    0,
    Math.min(NUENIME_SYSTEM_LIMITS.MAX_SAFE_EXP, Math.floor(totalExp))
  );

  let level = 1;
  let remainingExp = clampedTotalExp;
  let requiredForNext = getRequiredExpForCityLevel(level);

  // Loop aman untuk menghitung level tanpa batas maksimum tetap
  while (remainingExp >= requiredForNext && level < 1_000_000) {
    remainingExp -= requiredForNext;
    level += 1;
    requiredForNext = getRequiredExpForCityLevel(level);
  }

  const tier = computeCityTierFromLevel(level);
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((remainingExp / requiredForNext) * 100))
  );

  return {
    level,
    tier,
    totalExp: clampedTotalExp,
    currentLevelExp: remainingExp,
    nextLevelTargetExp: requiredForNext,
    progressPercent,
  };
}

/**
 * Menghitung Level Klan berdasarkan total EXP kontribusi klan
 */
export function computeClanLevelFromExp(clanTotalExp: number): number {
  const safeExp = Math.max(0, Math.floor(clanTotalExp));
  return Math.max(1, Math.floor(safeExp / 250) + 1);
}

/**
 * 8. KONFIGURASI MISI KLAN (MODE SIMULASI TAHAP AWAL)
 * Ditandai secara eksplisit sebagai `isSimulation: true` dan `source: 'simulation'`.
 */
export const SIMULATION_MISSIONS_CONFIG: SimulationMission[] = [
  {
    id: 'sim-watch-episode',
    title: 'Menonton 1 Episode Anime',
    description:
      'Simulasi aktivitas menyelesaikan tontonan satu episode anime di aplikasi Nuenime.',
    activityType: 'WATCH_EPISODE',
    targetCount: 1,
    rewardExp: 20,
    rewardShard: 1,
    isActive: true,
    isSimulation: true,
    source: 'simulation',
    cooldownSeconds: 0,
    categoryLabel: 'Aktivitas Menonton',
    difficulty: 'Harian',
  },
  {
    id: 'sim-like-anime',
    title: 'Memberi Like pada Episode / Seri Anime',
    description:
      'Simulasi aktivitas memberikan apresiasi like pada tayangan anime favoritmu.',
    activityType: 'LIKE_ANIME',
    targetCount: 1,
    rewardExp: 5,
    rewardShard: 1,
    isActive: true,
    isSimulation: true,
    source: 'simulation',
    cooldownSeconds: 0,
    categoryLabel: 'Interaksi Komunitas',
    difficulty: 'Harian',
  },
  {
    id: 'sim-comment-anime',
    title: 'Menulis Komentar Diskusi Valid',
    description:
      'Simulasi aktivitas menulis ulasan atau komentar diskusi yang valid pada halaman anime.',
    activityType: 'COMMENT_ANIME',
    targetCount: 1,
    rewardExp: 10,
    rewardShard: 1,
    isActive: true,
    isSimulation: true,
    source: 'simulation',
    cooldownSeconds: 0,
    categoryLabel: 'Interaksi Komunitas',
    difficulty: 'Harian',
  },
  {
    id: 'sim-watch-milestone',
    title: 'Menyelesaikan Target Menonton Harian (3 Episode)',
    description:
      'Simulasi pencapaian target maraton menonton harian anggota klan di Nuenime.',
    activityType: 'WATCH_MILESTONE',
    targetCount: 3,
    rewardExp: 50,
    rewardShard: 2,
    isActive: true,
    isSimulation: true,
    source: 'simulation',
    cooldownSeconds: 0,
    categoryLabel: 'Target Menonton',
    difficulty: 'Mingguan',
  },
  {
    id: 'sim-community-challenge',
    title: 'Tantangan Komunitas Klan Mingguan',
    description:
      'Simulasi partisipasi event nonton bareng dan diskusi komunitas antar anggota klan.',
    activityType: 'COMMUNITY_CHALLENGE',
    targetCount: 1,
    rewardExp: 120,
    rewardShard: 3,
    isActive: true,
    isSimulation: true,
    source: 'simulation',
    cooldownSeconds: 0,
    categoryLabel: 'Event Komunitas',
    difficulty: 'Tantangan',
  },
  {
    id: 'sim-expedition-burst',
    title: 'Uji Simulasi Burst Kontribusi Klan (+500 EXP)',
    description:
      'Khusus pengujian sistem: menyuntikkan +500 EXP simulasi untuk menguji kenaikan level dan Tier kota secara instan.',
    activityType: 'COMMUNITY_CHALLENGE',
    targetCount: 1,
    rewardExp: 500,
    rewardShard: 5,
    isActive: true,
    isSimulation: true,
    source: 'simulation',
    cooldownSeconds: 0,
    categoryLabel: 'Pengujian Level Kota',
    difficulty: 'Tantangan',
  },
];
