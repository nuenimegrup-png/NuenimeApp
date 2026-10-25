import {
  CityBossRecord,
  CityId,
  CityLeaderProfile,
  ActiveDemoAccount,
  SimulationMission,
  ClanRelicInfo,
  WorldCity,
  ActiveTravelRoute,
} from '../types/nuenime';
import {
  SIMULATION_MISSIONS_CONFIG,
  computeCityTierFromLevel,
} from '../config/nuenimeSystemConfig';

/**
 * ============================================================================
 * 2. TUJUH PEMIMPIN KOTA SEMENTARA (DEMO CITY LEADERS)
 * ============================================================================
 * - Setiap kota mempunyai tepat satu pemimpin aktif pada tahap awal.
 * - Diberi penanda eksplisit `isDemoAccount: true` agar tidak dianggap akun asli.
 * - Bukan admin aplikasi (`isAppAdmin: false`, `role: 'CITY_LEADER'`).
 * - Memiliki field `replaceableByRealAccountId` agar dapat diganti akun asli nantinya.
 */
export const CANON_CITY_LEADERS: Record<CityId, CityLeaderProfile> = {
  aetheria: {
    id: 'leader-aetheria',
    cityId: 'aetheria',
    cityName: 'Aetheria',
    displayName: 'Archon Caelestis',
    handle: '@archon_caelestis',
    title: 'Kanselir Agung Puncak Salju',
    elementAffinity: 'Cahaya & Es Suci',
    isDemoAccount: false,
    role: 'CITY_LEADER',
    isAppAdmin: false,
    replaceableByRealAccountId: null,
    appointedAt: '2026-01-01T00:00:00.000Z',
  },
  lunaris: {
    id: 'leader-lunaris',
    cityId: 'lunaris',
    cityName: 'Lunaris',
    displayName: 'Lady Selene Vael',
    handle: '@selene_vael',
    title: 'Penguasa Pasang Rembulan',
    elementAffinity: 'Air Rembulan & Ilusi Pasang',
    isDemoAccount: false,
    role: 'CITY_LEADER',
    isAppAdmin: false,
    replaceableByRealAccountId: null,
    appointedAt: '2026-01-01T00:00:00.000Z',
  },
  velmora: {
    id: 'leader-velmora',
    cityId: 'velmora',
    cityName: 'Velmora',
    displayName: 'High Druid Elandor',
    handle: '@druid_elandor',
    title: 'Penjaga Takhta Yggdra-Sylph',
    elementAffinity: 'Alam, Angin & Kehidupan',
    isDemoAccount: false,
    role: 'CITY_LEADER',
    isAppAdmin: false,
    replaceableByRealAccountId: null,
    appointedAt: '2026-01-01T00:00:00.000Z',
  },
  eldoria: {
    id: 'leader-eldoria',
    cityId: 'eldoria',
    cityName: 'Eldoria',
    displayName: 'Regent Constantine',
    handle: '@constantine_rex',
    title: 'Wali Takhta Mahkota Emas',
    elementAffinity: 'Cahaya Kekaisaran & Tata Ruang',
    isDemoAccount: false,
    role: 'CITY_LEADER',
    isAppAdmin: false,
    replaceableByRealAccountId: null,
    appointedAt: '2026-01-01T00:00:00.000Z',
  },
  drakonia: {
    id: 'leader-drakonia',
    cityId: 'drakonia',
    cityName: 'Drakonia',
    displayName: 'Overlord Malakor',
    handle: '@overlord_malakor',
    title: 'Panglima Tertinggi Kaldera',
    elementAffinity: 'Magma Merah & Petir Abyssal',
    isDemoAccount: false,
    role: 'CITY_LEADER',
    isAppAdmin: false,
    replaceableByRealAccountId: null,
    appointedAt: '2026-01-01T00:00:00.000Z',
  },
  nivara: {
    id: 'leader-nivara',
    cityId: 'nivara',
    cityName: 'Nivara',
    displayName: 'Hierophant Kufu-Ra',
    handle: '@hierophant_kufura',
    title: 'Penjaga Obelisk Surya',
    elementAffinity: 'Pasir Emas & Api Matahari',
    isDemoAccount: false,
    role: 'CITY_LEADER',
    isAppAdmin: false,
    replaceableByRealAccountId: null,
    appointedAt: '2026-01-01T00:00:00.000Z',
  },
  astralis: {
    id: 'leader-astralis',
    cityId: 'astralis',
    cityName: 'Astralis',
    displayName: 'Grand Savant Astriel',
    handle: '@savant_astriel',
    title: 'Archmage Konstelasi Tujuh',
    elementAffinity: 'Kosmik, Kristal & Gravitasi Astral',
    isDemoAccount: false,
    role: 'CITY_LEADER',
    isAppAdmin: false,
    replaceableByRealAccountId: null,
    appointedAt: '2026-01-01T00:00:00.000Z',
  },
};

export const DEMO_CITY_LEADERS = CANON_CITY_LEADERS;
export const DEMO_SWITCHABLE_ACCOUNTS: ActiveDemoAccount[] = [];

/**
 * ============================================================================
 * 5. SISTEM BOS UNIK UNTUK SETIAP KOTA (7 MONSTER BERBEDA)
 * ============================================================================
 * Setiap kota memiliki bos uniknya sendiri (tidak berbagi satu monster global).
 * HP Bos disimpan terpisah dari HP Kota (10.000/10.000) dan tidak berkurang
 * secara otomatis hanya karena pengguna menyelesaikan misi menonton anime.
 */
export const INITIAL_CITY_BOSSES: CityBossRecord[] = [
  {
    id: 'boss-aetheria-seraph',
    cityId: 'aetheria',
    cityName: 'Aetheria',
    name: 'Guardian Seraph',
    title: 'Penjaga Sayap Cahaya Celestia',
    speciesType: 'Entitas Konstruk Langit',
    element: 'Cahaya Murni & Kristal Es',
    description:
      'Monster penjaga bersayap enam yang melayang di atas puncak glasial Aetheria, menguji kelayakan para ksatria pelindung utara.',
    characteristic:
      'Memancarkan halo cahaya suci dan badai kristal beku di sekitar Pegunungan Celestia.',
    level: 0,
    tier: 'Tier I',
    maxHp: 10000,
    currentHp: 10000,
    status: 'ACTIVE',
    accentColor: '#38BDF8',
    secondaryColor: '#E0F2FE',
    worldXPercent: 12.5,
    worldYPercent: 15.8,
    battleHistoryCount: 0,
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'boss-lunaris-moonfang',
    cityId: 'lunaris',
    cityName: 'Lunaris',
    name: 'Moonfang',
    title: 'Serigala Pasang Purnama',
    speciesType: 'Beast Astral Samudra',
    element: 'Air Pasang & Ilusi Rembulan',
    description:
      'Monster serigala raksasa berbulu perak-cyan yang berlari di atas permukaan laut dan mengendalikan gelombang pasang Kepulauan Lunaris.',
    characteristic:
      'Muncul bersama kabut purnama dan menciptakan pusaran air bercahaya di perairan timur laut.',
    level: 0,
    tier: 'Tier I',
    maxHp: 10000,
    currentHp: 10000,
    status: 'ACTIVE',
    accentColor: '#22D3EE',
    secondaryColor: '#CFFAFE',
    worldXPercent: 69.5,
    worldYPercent: 27.5,
    battleHistoryCount: 0,
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'boss-velmora-colossus',
    cityId: 'velmora',
    cityName: 'Velmora',
    name: 'Verdant Colossus',
    title: 'Raksasa Akar Rimba Abadi',
    speciesType: 'Behemoth Flora Purba',
    element: 'Alam, Akar & Angin Zamrud',
    description:
      'Monster penjaga hutan raksasa yang terbentuk dari jalinan akar pohon purba dan kristal mana zamrud di jantung Rimba Sylvanis.',
    characteristic:
      'Kulit kayunya sekeras baja dan mampu memanggil spora pelindung di perbatasan Velmora.',
    level: 0,
    tier: 'Tier I',
    maxHp: 10000,
    currentHp: 10000,
    status: 'ACTIVE',
    accentColor: '#34D399',
    secondaryColor: '#D1FAE5',
    worldXPercent: 9.5,
    worldYPercent: 34.5,
    battleHistoryCount: 0,
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'boss-eldoria-aureon',
    cityId: 'eldoria',
    cityName: 'Eldoria',
    name: 'Aureon',
    title: 'Singa Agung Mahkota Surya',
    speciesType: 'Chimera Kekaisaran Emas',
    element: 'Cahaya Emas & Perisai Sovereign',
    description:
      'Monster bertema emas dan cahaya berbentuk singa bersayap mahkota surya yang mengawasi dataran tengah Heartlands Eldoria.',
    characteristic:
      'Raungannya menggetarkan cincin leyline benua dan memancarkan kilau emas murni.',
    level: 0,
    tier: 'Tier I',
    maxHp: 10000,
    currentHp: 10000,
    status: 'ACTIVE',
    accentColor: '#FBBF24',
    secondaryColor: '#FEF3C7',
    worldXPercent: 38.0,
    worldYPercent: 46.5,
    battleHistoryCount: 0,
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'boss-drakonia-wyrm',
    cityId: 'drakonia',
    cityName: 'Drakonia',
    name: 'Infernal Wyrm',
    title: 'Naga Magma Kaldera Hitam',
    speciesType: 'Naga Vulkanik Purba',
    element: 'Api Magma & Lava Obsidian',
    description:
      'Naga raksasa bertema api dan lava yang bersarang di kawah vulkanik timur Drakonia dengan sisik batu obsidian menyala.',
    characteristic:
      'Sayapnya menyebarkan bara api vulkanik dan menyatu dengan badai petir di pesisir timur.',
    level: 0,
    tier: 'Tier I',
    maxHp: 10000,
    currentHp: 10000,
    status: 'ACTIVE',
    accentColor: '#F87171',
    secondaryColor: '#FECACA',
    worldXPercent: 88.5,
    worldYPercent: 38.5,
    battleHistoryCount: 0,
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'boss-nivara-frostmaw',
    cityId: 'nivara',
    cityName: 'Nivara',
    name: 'Frostmaw',
    title: 'Behemoth Es & Kuarsa Malam Gurun',
    speciesType: 'Leviathan Anomali Termal',
    element: 'Es Absolut & Badai Kuarsa',
    description:
      'Monster es purba yang bangkit dari palung bawah tanah dingin di bawah oasis Nivara, membekukan bukit pasir di sekitarnya.',
    characteristic:
      'Memiliki rahang kristal es raksasa yang menciptakan kontras ekstrem di tengah gurun selatan.',
    level: 0,
    tier: 'Tier I',
    maxHp: 10000,
    currentHp: 10000,
    status: 'ACTIVE',
    accentColor: '#F59E0B',
    secondaryColor: '#FDE68A',
    worldXPercent: 15.5,
    worldYPercent: 61.5,
    battleHistoryCount: 0,
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'boss-astralis-leviathan',
    cityId: 'astralis',
    cityName: 'Astralis',
    name: 'Astral Leviathan',
    title: 'Penguasa Dimensi Bintang Jatuh',
    speciesType: 'Entitas Kosmik Abyssal',
    element: 'Energi Kosmik & Gravitasi Bintang',
    description:
      'Monster naga samudra kosmik yang berenang melintasi anomali gravitasi di atas kawah kristal ungu Kepulauan Astralis.',
    characteristic:
      'Tubuhnya tersusun dari konstelasi bintang hidup dan membelokkan cahaya di sekitarnya.',
    level: 0,
    tier: 'Tier I',
    maxHp: 10000,
    currentHp: 10000,
    status: 'ACTIVE',
    accentColor: '#C084FC',
    secondaryColor: '#F3E8FF',
    worldXPercent: 76.5,
    worldYPercent: 69.5,
    battleHistoryCount: 0,
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const INITIAL_WORLD_BOSSES = INITIAL_CITY_BOSSES;
export const CLAN_MISSIONS: SimulationMission[] = SIMULATION_MISSIONS_CONFIG;

/**
 * Informasi Artefak Pusaka & Buff Elemen untuk Setiap Klan
 */
export function getClanRelicInfo(
  clanId: string,
  cityName: string,
  specialization: string
): ClanRelicInfo {
  return {
    clanId,
    relicName: `Pusaka Suci ${cityName}`,
    relicTitle: `Artefak Pusaka ${specialization || 'Komunitas'}`,
    elementBuffName: `Aura Kejayaan ${cityName}`,
    baseBonusPercent: 15,
    bonusPerLevel: 4,
    lore: `Artefak pusaka legendaris yang ditempa oleh pendiri klan di ${cityName} untuk memperkuat seluruh anggota klan.`,
  };
}

/**
 * Kalkulator Simulasi Rute Perjalanan & Kapal Udara Antar Kota
 */
export function calculateTravelRoute(
  fromCity: WorldCity,
  toCity: WorldCity
): ActiveTravelRoute {
  const dx = toCity.worldXPercent - fromCity.worldXPercent;
  const dy = toCity.worldYPercent - fromCity.worldYPercent;
  const distUnits = Math.hypot(dx, dy);
  const distanceLeagues = Math.max(12, Math.round(distUnits * 4.8));
  const durationMinutes = Math.max(4, Math.round(distanceLeagues / 9));

  const navalCities = ['lunaris', 'astralis', 'nivara'];
  const highAltitudeCities = ['aetheria', 'drakonia'];

  let transportName = 'Kapal Udara Aether';
  if (navalCities.includes(fromCity.id) && navalCities.includes(toCity.id)) {
    transportName = 'Armada Cepat Pasang Perak';
  } else if (
    highAltitudeCities.includes(fromCity.id) ||
    highAltitudeCities.includes(toCity.id)
  ) {
    transportName = 'Kapal Udara Sky-Galleon';
  } else {
    transportName = 'Skuadron Griffin Kekaisaran';
  }

  let hazardLevel = 'Aman (Jalur Patroli)';
  if (fromCity.id === 'drakonia' || toCity.id === 'drakonia') {
    hazardLevel = 'Tinggi (Wilayah Infernal Wyrm)';
  } else if (distUnits > 50) {
    hazardLevel = 'Menengah (Lintas Samudra)';
  }

  return {
    fromCityId: fromCity.id,
    toCityId: toCity.id,
    transportName,
    distanceLeagues,
    durationMinutes,
    hazardLevel,
  };
}
