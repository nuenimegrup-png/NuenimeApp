import { WorldCity, Clan } from '../types/nuenime';
import {
  NUENIME_SYSTEM_LIMITS,
  computeCityLevelProgressFromTotalExp,
} from '../config/nuenimeSystemConfig';
import { DEMO_CITY_LEADERS, INITIAL_CITY_BOSSES } from './nuenimeRpgFeaturesData';

const RAW_WORLD_CITIES: any[] = [
  {
    id: 'aetheria',
    name: 'Aetheria',
    epithet: 'Benteng Suci Puncak Salju Abadi',
    regionName: 'Pegunungan Utara Celestia',
    element: 'Cahaya & Es Suci',
    worldXPercent: 20.5,
    worldYPercent: 22.8,
    focusYPercent: 18.0,
    labelPosition: 'right',
    material: 'silver-ice',
    accentHex: '#38BDF8',
    secondaryHex: '#E0F2FE',
    thumbnailAsset: '/assets/nuenime/city_aetheria.png',
    emblemAsset: '/assets/nuenime/emblem_aetheria.svg',
    shortDescription:
      'Kota suci yang dijaga oleh cahaya dan harapan. Pusat kekuatan para ksatria dan pelindung dunia.',
    fullLore:
      'Didirikan di atas puncak tertinggi Pegunungan Celestia yang tak pernah mencair, Aetheria adalah mercusuar pertama yang menyala ketika era Kegelapan Purba melanda Nuenime. Menara katedral kristalnya menangkap cahaya aurora utara dan menyalurkannya menjadi perisai pelindung bagi seluruh wilayah utara.',
    geographyNote:
      'Puncak glasial bertingkat dengan jembatan marmer perak yang menghubungkan katedral utama dan pelabuhan udara.',
    magicPhenomenon: 'Lingkaran Halo Aether biru-putih yang berpendar abadi di atas menara utama.',
    rulingCouncil: 'Ordo Ksatria Seraphim & Majelis Cahaya',
    altitudeOrDepth: '4.820 mdpl',
    districts: [
      {
        id: 'aeth-1',
        name: 'Katedral Aurora',
        category: 'Pusat Pemerintahan',
        description: 'Aula suci tempat para pemimpin klan Aetheria bersumpah menjaga perdamaian benua.',
        xPercent: 48,
        yPercent: 30,
      },
      {
        id: 'aeth-2',
        name: 'Benteng Perisai Perak',
        category: 'Distrik Pertahanan',
        description: 'Garrison utama tempat ksatria pelindung berlatih formasi tombak cahaya.',
        xPercent: 24,
        yPercent: 54,
      },
      {
        id: 'aeth-3',
        name: 'Menara Observatorium Es',
        category: 'Distrik Akademi',
        description: 'Menara pengamat arus mana langit dan pergerakan badai di lautan utara.',
        xPercent: 72,
        yPercent: 48,
      },
    ],
    clans: [],
  },
  {
    id: 'lunaris',
    name: 'Lunaris',
    epithet: 'Sanctuary Pulau Pasang Rembulan',
    regionName: 'Kepulauan Samudra Timur Laut',
    element: 'Air Rembulan & Ilusi Pasang',
    worldXPercent: 54.5,
    worldYPercent: 34.5,
    focusYPercent: 30.5,
    labelPosition: 'right',
    material: 'lunar-cyan',
    accentHex: '#22D3EE',
    secondaryHex: '#CFFAFE',
    thumbnailAsset: '/assets/nuenime/city_lunaris.png',
    emblemAsset: '/assets/nuenime/emblem_lunaris.svg',
    shortDescription:
      'Kota kepulauan suci yang dikelilingi cincin pusaran air bercahaya dan menara perak pengatur pasang samudra.',
    fullLore:
      'Lunaris berdiri di atas pulau karang putih yang dikelilingi oleh cincin air sihir yang berputar mengikuti fase bulan. Para penduduk dan klan di Lunaris dikenal sebagai penguasa navigasi samudra, penyihir hidro-lunar, serta penjaga gerbang perairan Nuenime.',
    geographyNote:
      'Pulau benteng melingkar dengan kanal air bercahaya turquoise dan dermaga kapal kristal.',
    magicPhenomenon: 'Cincin Pasang Rembulan yang menahan gelombang badai dan memancarkan pendar cyan di malam hari.',
    rulingCouncil: 'Majelis Pasang Perak',
    altitudeOrDepth: '18 mdpl (Atol Karang Suci)',
    districts: [
      {
        id: 'lun-1',
        name: 'Kuil Cermin Rembulan',
        category: 'Pusat Spiritual',
        description: 'Kolam suci di puncak pulau yang memantulkan konstelasi bintang bahkan di siang hari.',
        xPercent: 48,
        yPercent: 35,
      },
      {
        id: 'lun-2',
        name: 'Dermaga Cincin Turquoise',
        category: 'Pelabuhan Armada',
        description: 'Pangkalan kapal cepat klan-klan penjaga samudra Nuenime.',
        xPercent: 65,
        yPercent: 62,
      },
      {
        id: 'lun-3',
        name: 'Menara Suar Karang Barat',
        category: 'Pos Pertahanan Laut',
        description: 'Menara kristal cyan yang memandu kapal melintasi terumbu karang di malam berkabut.',
        xPercent: 24,
        yPercent: 52,
      },
    ],
    clans: [],
  },
  {
    id: 'velmora',
    name: 'Velmora',
    epithet: 'Suaka Hutan Zamrud Abadi',
    regionName: 'Rimba Barat Sylvanis',
    element: 'Alam, Angin & Kehidupan',
    worldXPercent: 16.0,
    worldYPercent: 41.2,
    focusYPercent: 37.0,
    labelPosition: 'right',
    material: 'emerald-bronze',
    accentHex: '#34D399',
    secondaryHex: '#D1FAE5',
    thumbnailAsset: '/assets/nuenime/city_velmora.png',
    emblemAsset: '/assets/nuenime/emblem_velmora.svg',
    shortDescription:
      'Kota hutan zamrud tempat arsitektur kuno menyatu dengan pohon-pohon raksasa dan pusaran mana kehidupan.',
    fullLore:
      'Tersembunyi di jantung Rimba Sylvanis, Velmora dibangun tanpa menebang satu pun pohon purba. Menara-menara kotanya tumbuh dari jalinan akar pohon suci Yggdra-Sylph yang memancarkan cahaya hijau zamrud dan melindungi keanekaragaman makhluk mistis Nuenime.',
    geographyNote:
      'Lembah hutan berlapis dengan kanopi raksasa, sungai sebening kristal, dan jembatan akar bercahaya.',
    magicPhenomenon: 'Kubah Angin Zamrud yang memurnikan racun dan mempercepat regenerasi energi kehidupan.',
    rulingCouncil: 'Lingkaran Druid & Penjaga Rimba',
    altitudeOrDepth: '640 mdpl',
    districts: [
      {
        id: 'vel-1',
        name: 'Inti Pohon Sylvan',
        category: 'Suaka Alam',
        description: 'Jantung kota Velmora tempat mata air mana zamrud mengalir ke seluruh benua barat.',
        xPercent: 45,
        yPercent: 45,
      },
      {
        id: 'vel-2',
        name: 'Anjungan Pemanah Angin',
        category: 'Distrik Penjaga',
        description: 'Pos pengawas di puncak kanopi pohon raksasa yang memantau batas barat Nuenime.',
        xPercent: 64,
        yPercent: 34,
      },
      {
        id: 'vel-3',
        name: 'Gerbang Lembah Rusa Perak',
        category: 'Pos Perbatasan Rimba',
        description: 'Jembatan akar kuno yang menjaga jalur masuk selatan menuju hutan dalam Velmora.',
        xPercent: 26,
        yPercent: 65,
      },
    ],
    clans: [],
  },
  {
    id: 'eldoria',
    name: 'Eldoria',
    epithet: 'Ibu Kota Kekaisaran Mahkota Emas',
    regionName: 'Dataran Tengah Heartlands',
    element: 'Cahaya Kekaisaran & Tata Ruang',
    worldXPercent: 46.5,
    worldYPercent: 52.8,
    focusYPercent: 48.0,
    labelPosition: 'right',
    material: 'imperial-gold',
    accentHex: '#FBBF24',
    secondaryHex: '#FEF3C7',
    thumbnailAsset: '/assets/nuenime/city_eldoria.png',
    emblemAsset: '/assets/nuenime/emblem_eldoria.svg',
    shortDescription:
      'Pusat peradaban Dunia Nuenime yang megah dengan menara istana emas dan cincin sihir pelindung kedaulatan.',
    fullLore:
      'Berdiri tepat di jantung benua Nuenime, Eldoria adalah titik temu seluruh jalur perdagangan, diplomasi, dan ksatria dari enam penjuru dunia. Menara kekaisaran emasnya dikelilingi oleh Cincin Sovereign yang berputar megah di udara, melambangkan persatuan klan-klan besar.',
    geographyNote:
      'Daratan subur di pertemuan tiga sungai besar, dihubungkan oleh jembatan batu megah dan benteng berlapis.',
    magicPhenomenon: 'Cincin Emas Sovereign yang memancarkan aura keagungan dan menstabilkan leyline seluruh benua.',
    rulingCouncil: 'Takhta Agung Sovereign & Senat Klan Pusat',
    altitudeOrDepth: '320 mdpl',
    districts: [
      {
        id: 'eld-1',
        name: 'Istana Mahkota Surya',
        category: 'Pusat Kekaisaran',
        description: 'Menara tertinggi di Eldoria tempat Piagam Klan Dunia Nuenime disimpan.',
        xPercent: 48,
        yPercent: 30,
      },
      {
        id: 'eld-2',
        name: 'Plaza Pertemuan Agung',
        category: 'Distrik Diplomasi',
        description: 'Alun-alun marmer emas tempat utusan dari ketujuh kota berkumpul.',
        xPercent: 48,
        yPercent: 64,
      },
      {
        id: 'eld-3',
        name: 'Benteng Sungai Kembar',
        category: 'Gerbang Perdagangan',
        description: 'Pelabuhan sungai dan gerbang utama yang menghubungkan jalur darat dari utara ke selatan.',
        xPercent: 22,
        yPercent: 50,
      },
      {
        id: 'eld-4',
        name: 'Menara Garnisun Sovereign',
        category: 'Markas Militer Timur',
        description: 'Kompleks pelatihan ksatria kekaisaran dan gudang persenjataan emas Eldoria.',
        xPercent: 68,
        yPercent: 46,
      },
    ],
    clans: [],
  },
  {
    id: 'drakonia',
    name: 'Drakonia',
    epithet: 'Benteng Obsidian Kawah Petir',
    regionName: 'Tebing Vulkanik Timur',
    element: 'Magma Merah & Petir Abyssal',
    worldXPercent: 75.5,
    worldYPercent: 45.8,
    focusYPercent: 42.0,
    labelPosition: 'right',
    material: 'crimson-obsidian',
    accentHex: '#F87171',
    secondaryHex: '#FECACA',
    thumbnailAsset: '/assets/nuenime/city_drakonia.png',
    emblemAsset: '/assets/nuenime/emblem_drakonia.svg',
    shortDescription:
      'Kota benteng vulkanik dari batu obsidian hitam yang ditempa oleh api naga purba dan badai petir ungu.',
    fullLore:
      'Dibangun di atas kaldera gunung berapi aktif yang menghadap ke Pusaran Badai Ungu di pantai timur, Drakonia adalah rumah bagi para petarung paling tangguh dan penempa senjata legendaris di Nuenime. Aliran magma merah di bawah kota menjadi sumber energi abadi bagi tungku-tungku raksasa mereka.',
    geographyNote:
      'Tebing batu hitam meruncing dengan sungai lava menyala dan pusaran badai petir ungu di lepas pantai.',
    magicPhenomenon: 'Pertemuan energi Magma Naga dan Pusaran Petir Void yang menciptakan medan listrik abadi.',
    rulingCouncil: 'Dewan Panglima Darah Naga',
    altitudeOrDepth: '1.450 mdpl',
    districts: [
      {
        id: 'drk-1',
        name: 'Tungku Jantung Naga',
        category: 'Pusat Penempaan',
        description: 'Kawah magma tempat senjata obsidian dan baja naga ditempa oleh para master.',
        xPercent: 46,
        yPercent: 35,
      },
      {
        id: 'drk-2',
        name: 'Menara Penangkap Petir',
        category: 'Benteng Pesisir',
        description: 'Menara besi hitam yang menyerap sambaran petir ungu dari pusaran laut timur.',
        xPercent: 66,
        yPercent: 54,
      },
      {
        id: 'drk-3',
        name: 'Benteng Kaldera Barat',
        category: 'Gerbang Obsidian',
        description: 'Dinding pertahanan berlapis baja hitam yang menjaga jembatan lava menuju Drakonia.',
        xPercent: 24,
        yPercent: 60,
      },
    ],
    clans: [],
  },
  {
    id: 'nivara',
    name: 'Nivara',
    epithet: 'Permata Oasis Gurun Surya',
    regionName: 'Semenanjung Gurun Barat Daya',
    element: 'Pasir Emas & Api Matahari',
    worldXPercent: 24.5,
    worldYPercent: 68.2,
    focusYPercent: 64.0,
    labelPosition: 'right',
    material: 'sun-amber',
    accentHex: '#F59E0B',
    secondaryHex: '#FDE68A',
    thumbnailAsset: '/assets/nuenime/city_nivara.png',
    emblemAsset: '/assets/nuenime/emblem_nivara.svg',
    shortDescription:
      'Kota istana batu pasir keemasan yang berdiri megah di tepi oasis suci dan teluk pirus selatan.',
    fullLore:
      'Nivara tumbuh dari peradaban matahari kuno di Semenanjung Gurun Barat Daya. Menara-menara batu pasirnya dilapisi kaca kuarsa emas yang memantulkan sinar matahari menjadi energi pelindung kota, sementara terusan air pirus di sekelilingnya menghidupi taman-taman gantung yang subur.',
    geographyNote:
      'Semenanjung bukit pasir emas yang berbatasan langsung dengan perairan dangkal pirus dan tebing batu kuno.',
    magicPhenomenon: 'Fatamorgana Pelindung Surya yang menyamarkan gerbang kota dari pandangan penyusup.',
    rulingCouncil: 'Dinasti Hierophant Surya',
    altitudeOrDepth: '140 mdpl',
    districts: [
      {
        id: 'niv-1',
        name: 'Ziggurat Obelisk Surya',
        category: 'Kuil Agung',
        description: 'Bangunan puncak emas yang mengumpulkan energi matahari untuk menyinari Nivara di malam hari.',
        xPercent: 48,
        yPercent: 33,
      },
      {
        id: 'niv-2',
        name: 'Bazar Kafilah Emas',
        category: 'Pusat Niaga',
        description: 'Pasar rempah, permata mana, dan relik gurun terbesar di belahan selatan Nuenime.',
        xPercent: 24,
        yPercent: 56,
      },
      {
        id: 'niv-3',
        name: 'Pelabuhan Teluk Pirus',
        category: 'Dermaga Oasis Selatan',
        description: 'Dermaga marmer keemasan tempat kapal dagang selatan berlabuh di tepi gurun.',
        xPercent: 64,
        yPercent: 62,
      },
    ],
    clans: [],
  },
  {
    id: 'astralis',
    name: 'Astralis',
    epithet: 'Sanctuary Kristal Bintang Selatan',
    regionName: 'Kepulauan Arcane Tenggara',
    element: 'Kosmik, Kristal & Gravitasi Astral',
    worldXPercent: 60.5,
    worldYPercent: 76.5,
    focusYPercent: 72.0,
    labelPosition: 'right',
    material: 'astral-violet',
    accentHex: '#C084FC',
    secondaryHex: '#F3E8FF',
    thumbnailAsset: '/assets/nuenime/city_astralis.png',
    emblemAsset: '/assets/nuenime/emblem_astralis.svg',
    shortDescription:
      'Kota menara kristal ungu yang berpendar oleh energi bintang jatuh dan aliran sihir dimensi di laut selatan.',
    fullLore:
      'Astralis terbentuk di sekitar kawah meteorit kristal raksasa yang jatuh ke perairan tenggara Nuenime ribuan tahun silam. Menara-menara kristalnya beresonansi dengan energi kosmik, menjadikannya pusat tertinggi bagi para penyihir arcane, peramal bintang, dan peneliti dimensi.',
    geographyNote:
      'Gugusan pulau karang dengan formasi kristal ungu raksasa yang melayang dan terhubung oleh jembatan cahaya.',
    magicPhenomenon: 'Pilar Resonansi Astral yang memancarkan kilau bintang keunguan dan anomali gravitasi ringan.',
    rulingCouncil: 'Konklaf Archmage Bintang Tujuh',
    altitudeOrDepth: '290 mdpl',
    districts: [
      {
        id: 'ast-1',
        name: 'Menara Nexus Kosmik',
        category: 'Pusat Sihir Agung',
        description: 'Puncak kristal utama tempat aliran energi astral difokuskan untuk menjaga keseimbangan dimensi.',
        xPercent: 48,
        yPercent: 32,
      },
      {
        id: 'ast-2',
        name: 'Akademi Prisma Ungu',
        category: 'Distrik Riset',
        description: 'Kompleks perpustakaan melayang tempat para penyihir mempelajari mantra bintang kuno.',
        xPercent: 22,
        yPercent: 54,
      },
      {
        id: 'ast-3',
        name: 'Pelabuhan Bintang Jatuh',
        category: 'Dermaga Selatan',
        description: 'Titik berlabuh kapal-kapal sihir yang melintasi terumbu pirus selatan.',
        xPercent: 64,
        yPercent: 63,
      },
    ],
    clans: [],
  },
];

/**
 * Menghidrasi data 7 kota resmi Nuenime:
 * - Setiap kota dimulai murni dari Level 1 (Tier I) dengan HP 10.000 / 10.000.
 * - Klan dalam kota hanya diisi dari klan nyata yang didirikan pemain (tidak ada klan dummy).
 */
function hydrateWorldCitiesSeed(): WorldCity[] {
  return RAW_WORLD_CITIES.map((rawCity) => {
    const cityId = rawCity.id as WorldCity['id'];
    const leaderProfile = DEMO_CITY_LEADERS[cityId];
    const bossRecord =
      INITIAL_CITY_BOSSES.find((b) => b.cityId === cityId) ?? INITIAL_CITY_BOSSES[0];

    const levelProgress = computeCityLevelProgressFromTotalExp(0);

    return {
      ...rawCity,
      leaderId: leaderProfile?.id ?? `leader-${cityId}`,
      leaderProfile,
      level: levelProgress.level,
      tier: levelProgress.tier,
      totalExp: 0,
      currentLevelExp: 0,
      nextLevelTargetExp: levelProgress.nextLevelTargetExp,
      maxHp: NUENIME_SYSTEM_LIMITS.INITIAL_CITY_LEVEL_1_HP,
      currentHp: NUENIME_SYSTEM_LIMITS.INITIAL_CITY_LEVEL_1_HP,
      maxClans: NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY,
      bossId: bossRecord.id,
      boss: bossRecord,
      levelHistory: [],
      clans: [],
    } as WorldCity;
  });
}

export const WORLD_CITIES: WorldCity[] = hydrateWorldCitiesSeed();

export const ALL_CLANS: Clan[] = WORLD_CITIES.flatMap((city) => city.clans);

export function getCityById(cityId: string): WorldCity | undefined {
  return WORLD_CITIES.find((c) => c.id === cityId);
}

export function getClanById(clanId: string): Clan | undefined {
  return ALL_CLANS.find((c) => c.id === clanId);
}

export const WORLD_OVERVIEW_INFO = {
  title: 'Ensiklopedia Dunia Nuenime',
  subtitle: 'Sistem Perkembangan 7 Kota, Bos Unik, Klan & EXP Komunitas',
  summary:
    'Dunia Nuenime terdiri dari 7 kota independen yang dipimpin oleh 7 Pemimpin Kota dan dijaga oleh 7 Monster Bos unik. Setiap petualang dapat mendirikan klan di kota pilihannya, menyelesaikan misi, dan meningkatkan Level serta Tier kota tersebut.',
  pillars: [
    {
      label: '7 Kota Independen',
      value: 'Aetheria, Lunaris, Velmora, Eldoria, Drakonia, Nivara, Astralis',
    },
    {
      label: 'Kapasitas Sistem',
      value: 'Maks. 15 Klan/Kota · Maks. 100 Anggota/Klan',
    },
    {
      label: 'Alur Progres EXP',
      value: 'Anggota → EXP Klan → Total EXP Kota → Level & Tier Kota',
    },
  ],
};
