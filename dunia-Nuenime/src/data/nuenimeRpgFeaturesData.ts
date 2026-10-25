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
export const DEMO_CITY_LEADERS: Record<CityId, CityLeaderProfile> = {
  aetheria: {
    id: 'leader-demo-aetheria',
    cityId: 'aetheria',
    cityName: 'Aetheria',
    displayName: 'Archon Caelestis',
    handle: '@demo_leader_aetheria',
    title: 'Kanselir Agung Puncak Salju (Demo)',
    elementAffinity: 'Cahaya & Es Suci',
    isDemoAccount: true,
    role: 'CITY_LEADER',
    isAppAdmin: false,
    replaceableByRealAccountId: null,
    appointedAt: '2026-01-01T00:00:00.000Z',
  },
  lunaris: {
    id: 'leader-demo-lunaris',
    cityId: 'lunaris',
    cityName: 'Lunaris',
    displayName: 'Lady Selene Vael',
    handle: '@demo_leader_lunaris',
    title: 'Penguasa Pasang Rembulan (Demo)',
    elementAffinity: 'Air Rembulan & Ilusi Pasang',
    isDemoAccount: true,
    role: 'CITY_LEADER',
    isAppAdmin: false,
    replaceableByRealAccountId: null,
    appointedAt: '2026-01-01T00:00:00.000Z',
  },
  velmora: {
    id: 'leader-demo-velmora',
    cityId: 'velmora',
    cityName: 'Velmora',
    displayName: 'High Druid Elandor',
    handle: '@demo_leader_velmora',
    title: 'Penjaga Takhta Yggdra-Sylph (Demo)',
    elementAffinity: 'Alam, Angin & Kehidupan',
    isDemoAccount: true,
    role: 'CITY_LEADER',
    isAppAdmin: false,
    replaceableByRealAccountId: null,
    appointedAt: '2026-01-01T00:00:00.000Z',
  },
  eldoria: {
    id: 'leader-demo-eldoria',
    cityId: 'eldoria',
    cityName: 'Eldoria',
    displayName: 'Regent Constantine',
    handle: '@demo_leader_eldoria',
    title: 'Wali Takhta Mahkota Emas (Demo)',
    elementAffinity: 'Cahaya Kekaisaran & Tata Ruang',
    isDemoAccount: true,
    role: 'CITY_LEADER',
    isAppAdmin: false,
    replaceableByRealAccountId: null,
    appointedAt: '2026-01-01T00:00:00.000Z',
  },
  drakonia: {
    id: 'leader-demo-drakonia',
    cityId: 'drakonia',
    cityName: 'Drakonia',
    displayName: 'Overlord Malakor',
    handle: '@demo_leader_drakonia',
    title: 'Panglima Tertinggi Kaldera (Demo)',
    elementAffinity: 'Magma Merah & Petir Abyssal',
    isDemoAccount: true,
    role: 'CITY_LEADER',
    isAppAdmin: false,
    replaceableByRealAccountId: null,
    appointedAt: '2026-01-01T00:00:00.000Z',
  },
  nivara: {
    id: 'leader-demo-nivara',
    cityId: 'nivara',
    cityName: 'Nivara',
    displayName: 'Hierophant Kufu-Ra',
    handle: '@demo_leader_nivara',
    title: 'Penjaga Obelisk Surya (Demo)',
    elementAffinity: 'Pasir Emas & Api Matahari',
    isDemoAccount: true,
    role: 'CITY_LEADER',
    isAppAdmin: false,
    replaceableByRealAccountId: null,
    appointedAt: '2026-01-01T00:00:00.000Z',
  },
  astralis: {
    id: 'leader-demo-astralis',
    cityId: 'astralis',
    cityName: 'Astralis',
    displayName: 'Grand Savant Astriel',
    handle: '@demo_leader_astralis',
    title: 'Archmage Konstelasi Tujuh (Demo)',
    elementAffinity: 'Kosmik, Kristal & Gravitasi Astral',
    isDemoAccount: true,
    role: 'CITY_LEADER',
    isAppAdmin: false,
    replaceableByRealAccountId: null,
    appointedAt: '2026-01-01T00:00:00.000Z',
  },
};

/**
 * Daftar Akun Demo yang dapat dipilih pengguna untuk menguji:
 * - Anggota Klan Biasa (menyelesaikan misi simulasi EXP, bergabung ke klan)
 * - 7 Pemimpin Kota Demonstrasi (membuat klan di kota yang dipimpinnya hingga maksimal 15 klan)
 */
export const DEMO_SWITCHABLE_ACCOUNTS: ActiveDemoAccount[] = [
  {
    id: 'user-demo-adventurer',
    displayName: 'Petualang Bebas Nuenime',
    handle: '@adventurer_nuenime',
    title: 'Petualang Independen Nuenime',
    role: 'CLAN_MEMBER',
    ledCityId: null,
    joinedClanId: null,
    isDemoAccount: true,
    isAppAdmin: false,
  },
  ...Object.values(DEMO_CITY_LEADERS).map((leader) => ({
    id: leader.id,
    displayName: `${leader.displayName} (Pemimpin ${leader.cityName})`,
    handle: leader.handle,
    title: leader.title,
    role: 'CITY_LEADER' as const,
    ledCityId: leader.cityId,
    joinedClanId: null,
    isDemoAccount: true as const,
    isAppAdmin: false as const,
  })),
];

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
  const catalog: Record<string, Omit<ClanRelicInfo, 'clanId'>> = {
    'clan-seraph-vanguard': {
      relicName: 'Tombak Cahaya Seraphim',
      relicTitle: 'Pusaka Suci Puncak Celestia',
      elementBuffName: 'Perisai Cahaya & Pemulihan',
      baseBonusPercent: 15,
      bonusPerLevel: 4,
      lore: 'Tombak kristal perak yang memancarkan sinar aurora dan meningkatkan pertahanan seluruh anggota klan.',
    },
    'clan-frostguard': {
      relicName: 'Perisai Es Abadi Boreas',
      relicTitle: 'Relik Garda Gletser',
      elementBuffName: 'Penetrasi Es & Ketahanan Beku',
      baseBonusPercent: 14,
      bonusPerLevel: 4,
      lore: 'Perisai yang ditempa dari es seribu tahun yang tak pernah retak oleh serangan naga.',
    },
    'clan-aurora-archive': {
      relicName: 'Lentera Bintang Utara',
      relicTitle: 'Fokus Arcane Observatorium',
      elementBuffName: 'Kapasitas Mana & Akurasi Mantra',
      baseBonusPercent: 16,
      bonusPerLevel: 5,
      lore: 'Lentera suci yang menyimpan cahaya bintang fajar untuk memperkuat mantra barikade.',
    },
    'clan-silver-tide': {
      relicName: 'Trisula Pasang Purnama',
      relicTitle: 'Pusaka Laksamana Lunaris',
      elementBuffName: 'Kecepatan Armada & Serangan Air',
      baseBonusPercent: 15,
      bonusPerLevel: 4,
      lore: 'Trisula perak biru yang mampu membelah ombak badai dan memanggil arus pelindung.',
    },
    'clan-sylvan-wardens': {
      relicName: 'Busur Angin Yggdra-Sylph',
      relicTitle: 'Pusaka Penjaga Rimba',
      elementBuffName: 'Serangan Kritikal & Kecepatan Angin',
      baseBonusPercent: 16,
      bonusPerLevel: 4,
      lore: 'Busur dari dahan pohon suci Velmora yang anak panahnya selalu dituntun oleh roh angin.',
    },
    'clan-golden-sovereign': {
      relicName: 'Pedang Agung Sovereign Rex',
      relicTitle: 'Regalia Mahkota Eldoria',
      elementBuffName: 'Otoritas Komando & Serangan Cahaya Emas',
      baseBonusPercent: 18,
      bonusPerLevel: 5,
      lore: 'Pedang pusaka Kaisar Pertama Eldoria yang membangkitkan semangat tempur seluruh legiun.',
    },
    'clan-crimson-fang': {
      relicName: 'Pedang Taring Ignis',
      relicTitle: 'Pusaka Kawah Obsidian',
      elementBuffName: 'Daya Hancur Magma & Penembus Zirah',
      baseBonusPercent: 18,
      bonusPerLevel: 5,
      lore: 'Bilah obsidian merah menyala yang ditempa langsung di jantung gunung berapi Drakonia.',
    },
    'clan-sun-mirage': {
      relicName: 'Ankh Cakrawala Surya',
      relicTitle: 'Relik Agung Ziggurat Nivara',
      elementBuffName: 'Refraksi Surya & Kekebalan Gurun',
      baseBonusPercent: 15,
      bonusPerLevel: 4,
      lore: 'Tongkat emas kuarsa yang memfokuskan terik matahari menjadi perisai fatamorgana.',
    },
    'clan-void-stargazers': {
      relicName: 'Orb Konstelasi Astral',
      relicTitle: 'Inti Nexus Bintang Jatuh',
      elementBuffName: 'Resonansi Kosmik & Manipulasi Gravitasi',
      baseBonusPercent: 17,
      bonusPerLevel: 5,
      lore: 'Bola kristal meteorit ungu yang memetakan pergerakan dimensi dan melipatgandakan daya sihir.',
    },
  };

  const found = catalog[clanId];
  if (found) {
    return { clanId, ...found };
  }

  return {
    clanId,
    relicName: `Relik Pusaka ${cityName}`,
    relicTitle: 'Artefak Kuno Markas Klan',
    elementBuffName: `Penguatan ${specialization}`,
    baseBonusPercent: 14,
    bonusPerLevel: 4,
    lore: `Artefak pusaka yang diwariskan oleh pendiri klan di ${cityName} untuk melipatgandakan kekuatan elemen anggota.`,
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
