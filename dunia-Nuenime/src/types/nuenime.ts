export type CityId =
  | 'aetheria'
  | 'lunaris'
  | 'velmora'
  | 'eldoria'
  | 'drakonia'
  | 'nivara'
  | 'astralis';

export type BottomNavTab = 'beranda' | 'karakter' | 'dunia' | 'klan' | 'lainnya';

export type TimeOfDayMode = 'day' | 'dusk' | 'night';

export type CityMaterialTheme =
  | 'silver-ice'
  | 'lunar-cyan'
  | 'emerald-bronze'
  | 'imperial-gold'
  | 'crimson-obsidian'
  | 'sun-amber'
  | 'astral-violet';

export type MarkerMetalMaterial = CityMaterialTheme;

export type ClanEmblemVariant =
  | 'seraph-wings'
  | 'frost-chalice'
  | 'crescent-tide'
  | 'abyssal-trident'
  | 'world-tree'
  | 'emerald-stag'
  | 'solar-crown'
  | 'aegis-scales'
  | 'dragon-fang'
  | 'storm-hammer'
  | 'mirage-hourglass'
  | 'astral-prism'
  | 'star-shield'
  | 'crescent-blade'
  | 'emerald-bough'
  | 'imperial-crown'
  | 'solar-ankh';

export type CityTierCode =
  | 'Tier I'
  | 'Tier II'
  | 'Tier III'
  | 'Tier IV'
  | 'Tier V'
  | 'Tier VI'
  | 'Tier VII'
  | 'Tier VIII';

export type ExpSourceType = 'simulation' | 'production';

/**
 * 2. TUJUH PEMIMPIN KOTA SEMENTARA (DEMO ACCOUNTS)
 * Peran dalam sistem Dunia Nuenime, bukan admin aplikasi.
 */
export interface CityLeaderProfile {
  id: string;
  cityId: CityId;
  cityName: string;
  displayName: string;
  handle: string;
  title: string;
  elementAffinity: string;
  isDemoAccount: true;
  role: 'CITY_LEADER';
  isAppAdmin: false;
  replaceableByRealAccountId: string | null;
  appointedAt: string;
}

/**
 * Akun aktif yang sedang disimulasikan pengguna (Pemimpin Kota Demo atau Anggota Klan Demo)
 */
export interface ActiveDemoAccount {
  id: string;
  displayName: string;
  handle: string;
  title: string;
  role: 'CITY_LEADER' | 'CLAN_MEMBER';
  ledCityId: CityId | null;
  joinedClanId: string;
  isDemoAccount: boolean;
  isAppAdmin: boolean;
  avatarUrl?: string | null;
  borderUrl?: string | null;
  level?: number;
  rank?: string;
  isVip?: boolean;
}

/**
 * 5. SISTEM BOS UNIK UNTUK SETIAP KOTA
 * Setiap kota wajib mempunyai bos sendiri (bukan monster global bersama).
 * HP Bos terpisah sepenuhnya dari HP Kota.
 */
export interface CityBossRecord {
  id: string;
  cityId: CityId;
  cityName: string;
  name: string;
  title: string;
  speciesType: string;
  element: string;
  description: string;
  characteristic: string;
  level: number;
  tier: CityTierCode;
  maxHp: number;
  currentHp: number;
  status: 'ACTIVE' | 'ENRANGED' | 'DORMANT';
  accentColor: string;
  secondaryColor: string;
  /** Posisi monster di peta dunia di dekat marker kota tanpa menutupi nama kota */
  worldXPercent: number;
  worldYPercent: number;
  battleHistoryCount: number;
  lastUpdatedAt: string;
}

/**
 * 4. SISTEM ANGGOTA KLAN (MAKSIMAL 100 ANGGOTA PER KLAN)
 */
export interface ClanMember {
  id: string;
  userId: string;
  clanId: string;
  cityId: CityId;
  name: string;
  role: 'Pemimpin Klan' | 'Wakil Pemimpin' | 'Tetua' | 'Ksatria Inti' | 'Anggota';
  title: string;
  elementAffinity: string;
  joinedAt: string;
  /** Total EXP kontribusi anggota ke klan ini */
  contributionScore: number;
  completedMissionsCount: number;
  status: 'ACTIVE' | 'INACTIVE';
}

/**
 * 3. SISTEM KLAN (MAKSIMAL 15 KLAN PER KOTA, MAKSIMAL 100 ANGGOTA PER KLAN)
 */
export interface Clan {
  id: string;
  cityId: CityId;
  cityName: string;
  name: string;
  tag: string;
  emblemVariant: ClanEmblemVariant;
  logoUrl?: string;
  accentColor: string;
  motto: string;
  description: string;
  historyLore: string;
  founderId: string;
  leaderId: string;
  leaderName: string;
  leaderTitle: string;
  memberCount: number;
  maxMembers: number;
  /** Total EXP kontribusi klan (akumulasi dari seluruh anggota klan) */
  totalExp: number;
  level: number;
  foundedEra: string;
  createdAt: string;
  lastContributionAt: string;
  strongholdDistrict: string;
  /** Koordinat X markas klan di dalam Peta Kota (0 - 100) */
  cityMapXPercent: number;
  cityMapYPercent: number;
  specialization: string;
  reputationRank: string;
  members: ClanMember[];
}

export interface CityDistrict {
  id: string;
  name: string;
  category: string;
  description: string;
  xPercent: number;
  yPercent: number;
}

/**
 * Riwayat Kenaikan Level Kota
 */
export interface CityLevelHistoryRecord {
  id: string;
  cityId: CityId;
  cityName: string;
  previousLevel: number;
  newLevel: number;
  previousTier: CityTierCode;
  newTier: CityTierCode;
  totalExpAtUpgrade: number;
  triggeredByClanId: string;
  triggeredByClanName: string;
  triggeredByUserId: string;
  triggeredByUserName: string;
  timestamp: string;
}

/**
 * 1. STRUKTUR KOTA DUNIA NUENIME (7 KOTA INDEPENDEN)
 */
export interface WorldCity {
  id: CityId;
  name: string;
  epithet: string;
  regionName: string;
  element: string;
  /** Posisi X dalam persentase lebar peta (0 - 100) */
  worldXPercent: number;
  /** Posisi Y dalam persentase tinggi peta (0 - 100) */
  worldYPercent: number;
  /** Titik fokus kamera Y saat kota dipilih */
  focusYPercent: number;
  labelPosition?: 'right' | 'left';
  material: CityMaterialTheme;
  accentHex: string;
  secondaryHex: string;
  thumbnailAsset: string;
  emblemAsset: string;
  shortDescription: string;
  fullLore: string;
  geographyNote: string;
  magicPhenomenon: string;
  rulingCouncil: string;
  altitudeOrDepth: string;
  /** Relasi Pemimpin Kota Sementara */
  leaderId: string;
  leaderProfile: CityLeaderProfile;
  /** Level & Tier Kota (Mulai dari Level 1, tidak dibatasi maksimum tetap) */
  level: number;
  tier: CityTierCode;
  /** Total EXP Kota sepanjang perkembangan (akumulasi kontribusi seluruh klan di kota ini) */
  totalExp: number;
  /** EXP yang telah diperoleh pada level saat ini */
  currentLevelExp: number;
  /** Target EXP yang dibutuhkan untuk naik ke level berikutnya */
  nextLevelTargetExp: number;
  /** HP Kota (Terpisah dari HP Bos; Level 1 dimulai dari 10.000 / 10.000 HP) */
  maxHp: number;
  currentHp: number;
  /** Kapasitas maksimal klan di kota ini (15) */
  maxClans: number;
  /** ID & Data Bos unik milik kota ini */
  bossId: string;
  boss: CityBossRecord;
  levelHistory: CityLevelHistoryRecord[];
  districts: CityDistrict[];
  clans: Clan[];
}

/**
 * 8. MISI KLAN — SIMULASI TERLEBIH DAHULU
 */
export type AnimeActivityType =
  | 'WATCH_EPISODE'
  | 'LIKE_ANIME'
  | 'COMMENT_ANIME'
  | 'WATCH_MILESTONE'
  | 'COMMUNITY_CHALLENGE';

export interface SimulationMission {
  id: string;
  title: string;
  description: string;
  activityType: AnimeActivityType;
  targetCount: number;
  rewardExp: number;
  rewardShard: number;
  isActive: boolean;
  isSimulation: true;
  source: ExpSourceType;
  cooldownSeconds: number;
  categoryLabel: string;
  difficulty: 'Harian' | 'Mingguan' | 'Tantangan';
}

export interface UserMissionProgressRecord {
  missionId: string;
  userId: string;
  currentProgress: number;
  targetCount: number;
  totalClaimedCount: number;
  totalExpEarned: number;
  lastClaimedAt: string | null;
}

/**
 * 9. BUKU BESAR TRANSAKSI EXP (EXPTransactions / ContributionLedger)
 */
export interface EXPTransactionRecord {
  id: string;
  idempotencyKey: string;
  userId: string;
  userName: string;
  clanId: string;
  clanName: string;
  cityId: CityId;
  cityName: string;
  missionId: string;
  missionTitle: string;
  activityType: AnimeActivityType;
  expAmount: number;
  source: ExpSourceType;
  cityLevelBefore: number;
  cityLevelAfter: number;
  timestamp: string;
}

/**
 * 11. STATISTIK GLOBAL DUNIA NUENIME
 */
export interface GlobalWorldStats {
  totalWorldExp: number;
  totalSimulationExp: number;
  totalProductionExp: number;
  totalClansCount: number;
  maxWorldClansCapacity: number;
  totalClanMembersCount: number;
  highestLevelCity: {
    cityId: CityId;
    name: string;
    level: number;
    tier: CityTierCode;
    totalExp: number;
  };
  topExpClan: {
    clanId: string;
    name: string;
    tag: string;
    cityId: CityId;
    cityName: string;
    totalExp: number;
  };
}

/**
 * Artefak Pusaka & Buff Elemen setiap Klan
 */
export interface ClanRelicInfo {
  clanId: string;
  relicName: string;
  relicTitle: string;
  elementBuffName: string;
  baseBonusPercent: number;
  bonusPerLevel: number;
  lore: string;
}

/**
 * Penguasaan Distrik Kota oleh Klan
 */
export interface DistrictInfluenceState {
  clanId: string;
  cityId: CityId;
  districtName: string;
  influencePercent: number;
}

/**
 * Simulasi Rute Perjalanan / Kapal Udara Antar Kota
 */
export interface ActiveTravelRoute {
  fromCityId: CityId;
  toCityId: CityId;
  transportName: string;
  distanceLeagues: number;
  durationMinutes: number;
  hazardLevel: string;
}

/**
 * Input pembuatan klan baru oleh Pemimpin Kota
 */
export interface CreateClanInput {
  cityId: CityId;
  name: string;
  tag: string;
  description: string;
  motto?: string;
  strongholdDistrict: string;
  specialization: string;
  emblemVariant: ClanEmblemVariant;
  logoUrl?: string;
  accentColor?: string;
  requestKey?: string;
}

export type ScreenViewState =
  | { type: 'WORLD_MAP' }
  | {
      type: 'CITY_DETAIL';
      cityId: CityId;
      initialTab?: 'map' | 'clans' | 'lore';
    }
  | { type: 'CLAN_MAIN' }
  | { type: 'CLAN_LEADERBOARD'; cityId?: CityId }
  | { type: 'CLAN_LIST'; cityId?: CityId; initialView?: 'leaderboard' | 'directory' }
  | { type: 'CLAN_DETAIL'; clanId: string; returnToCityId?: CityId };

/** Alias kompatibilitas untuk komponen */
export type WorldBossEvent = CityBossRecord;
export type ClanMission = SimulationMission;
