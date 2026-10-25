import { WorldCity, Clan, ClanMember } from '../types/nuenime';
import {
  NUENIME_SYSTEM_LIMITS,
  computeCityLevelProgressFromTotalExp,
  computeClanLevelFromExp,
} from '../config/nuenimeSystemConfig';
import { DEMO_CITY_LEADERS, INITIAL_CITY_BOSSES } from './nuenimeRpgFeaturesData';

/**
 * Data Dasar 7 Kota Dunia Nuenime (Local Repository Seed).
 * Dihidrasi melalui `hydrateWorldCitiesSeed()` agar seluruh relasi Pemimpin Kota,
 * Bos Unik Kota, HP Kota (10.000/10.000), kapasitas (15 klan/kota, 100 anggota/klan),
 * serta konsistensi EXP Anggota -> EXP Klan -> EXP Kota terjamin 100%.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    clans: [
      {
        id: 'clan-seraph-vanguard',
        cityId: 'aetheria',
        cityName: 'Aetheria',
        name: 'Ordo Sayap Seraphim',
        tag: 'SRPH',
        emblemVariant: 'star-shield',
        accentColor: '#38BDF8',
        motto: 'Cahaya kami tak akan padam di tengah badai tergelap.',
        description:
          'Klan pelindung tertua di Aetheria yang mengkhususkan diri pada pertahanan barisan depan dan sihir pemulihan suci.',
        historyLore:
          'Dibentuk oleh tujuh paladin legendaris pada Era Fajar Pertama. Ordo Sayap Seraphim memegang mandat langsung untuk menjaga Gerbang Utara Aetheria dan melatih para ksatria pelindung.',
        leaderName: 'Valerius Caelum',
        leaderTitle: 'Grand Paladin Utara',
        memberCount: 48,
        maxMembers: 50,
        foundedEra: 'Era Fajar Tahun 112',
        strongholdDistrict: 'Katedral Aurora',
        cityMapXPercent: 50,
        cityMapYPercent: 27,
        specialization: 'Pertahanan Suci & Pelindung Barisan',
        reputationRank: 'Peringkat I — Aetheria',
        members: [
          {
            id: 'm-1',
            name: 'Valerius Caelum',
            role: 'Pemimpin Klan',
            title: 'Grand Paladin Utara',
            elementAffinity: 'Cahaya Murni',
            contributionScore: 14820,
          },
          {
            id: 'm-2',
            name: 'Lyra Frostveil',
            role: 'Wakil Pemimpin',
            title: 'Penjaga Menara Kristal',
            elementAffinity: 'Es Suci',
            contributionScore: 12390,
          },
          {
            id: 'm-3',
            name: 'Alden Vance',
            role: 'Tetua',
            title: 'Komandan Perisai Perak',
            elementAffinity: 'Cahaya & Baja',
            contributionScore: 10940,
          },
          {
            id: 'm-4',
            name: 'Seraphina Dawn',
            role: 'Ksatria Inti',
            title: 'Uskup Perang Aether',
            elementAffinity: 'Cahaya Pemulih',
            contributionScore: 9650,
          },
        ],
      },
      {
        id: 'clan-frostguard',
        cityId: 'aetheria',
        cityName: 'Aetheria',
        name: 'Garda Kristal Glasial',
        tag: 'GLAC',
        emblemVariant: 'star-shield',
        accentColor: '#7DD3FC',
        motto: 'Setajam es abadi, sekokoh puncak Celestia.',
        description:
          'Klan ksatria tombak es dan pemburu monster pegunungan yang mengamankan jalur lereng bersalju Aetheria.',
        historyLore:
          'Garda Kristal Glasial berasal dari para penjaga perbatasan gletser yang mampu menempa es abadi menjadi baja ringan yang tak bisa dihancurkan oleh api biasa.',
        leaderName: 'Kaelen Winterborn',
        leaderTitle: 'Penguasa Tombak Glasial',
        memberCount: 39,
        maxMembers: 50,
        foundedEra: 'Era Fajar Tahun 204',
        strongholdDistrict: 'Benteng Perisai Perak',
        cityMapXPercent: 34,
        cityMapYPercent: 52,
        specialization: 'Serangan Tombak Es & Taktik Pegunungan',
        reputationRank: 'Peringkat II — Aetheria',
        members: [
          {
            id: 'm-5',
            name: 'Kaelen Winterborn',
            role: 'Pemimpin Klan',
            title: 'Penguasa Tombak Glasial',
            elementAffinity: 'Es Absolut',
            contributionScore: 11900,
          },
          {
            id: 'm-6',
            name: 'Freya Snowcrest',
            role: 'Wakil Pemimpin',
            title: 'Pemanah Badai Salju',
            elementAffinity: 'Angin & Es',
            contributionScore: 9840,
          },
          {
            id: 'm-7',
            name: 'Garrick Thorne',
            role: 'Ksatria Inti',
            title: 'Penempa Kristal',
            elementAffinity: 'Mineral Es',
            contributionScore: 8410,
          },
        ],
      },
      {
        id: 'clan-aurora-archive',
        cityId: 'aetheria',
        cityName: 'Aetheria',
        name: 'Konklaf Lentera Aurora',
        tag: 'AURA',
        emblemVariant: 'star-shield',
        accentColor: '#60A5FA',
        motto: 'Membaca bintang di langit utara, menuntun langkah para ksatria.',
        description:
          'Persekutuan penyihir cahaya dan cendekiawan strategi yang menjaga segel kuno di Observatorium Es.',
        historyLore:
          'Didirikan oleh para arsitek segel pelindung Aetheria, Konklaf Lentera Aurora memadukan ilmu astronomi kuno dengan sihir barikade jarak jauh.',
        leaderName: 'Isolde Starweaver',
        leaderTitle: 'Archmage Aurora',
        memberCount: 31,
        maxMembers: 45,
        foundedEra: 'Era Fajar Tahun 289',
        strongholdDistrict: 'Menara Observatorium Es',
        cityMapXPercent: 66,
        cityMapYPercent: 44,
        specialization: 'Sihir Barikade & Strategi Wilayah',
        reputationRank: 'Peringkat III — Aetheria',
        members: [
          {
            id: 'm-8',
            name: 'Isolde Starweaver',
            role: 'Pemimpin Klan',
            title: 'Archmage Aurora',
            elementAffinity: 'Cahaya Astral',
            contributionScore: 10450,
          },
          {
            id: 'm-9',
            name: 'Caspian Venn',
            role: 'Wakil Pemimpin',
            title: 'Juru Kunci Segel',
            elementAffinity: 'Rune Cahaya',
            contributionScore: 8920,
          },
        ],
      },
    ],
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
    clans: [
      {
        id: 'clan-silver-tide',
        cityId: 'lunaris',
        cityName: 'Lunaris',
        name: 'Armada Pasang Perak',
        tag: 'TIDE',
        emblemVariant: 'crescent-blade',
        accentColor: '#22D3EE',
        motto: 'Samudra tunduk pada kehendak bulan purnama.',
        description:
          'Klan maritim elit yang menguasai taktik pertempuran perairan dan sihir pengendali gelombang.',
        historyLore:
          'Sejak berdirinya dermaga pertama Lunaris, Armada Pasang Perak telah menjadi perisai utama yang menghalau monster laut dalam dari jalur pelayaran antar kota.',
        leaderName: 'Nerissa Moonwake',
        leaderTitle: 'Laksamana Rembulan',
        memberCount: 44,
        maxMembers: 50,
        foundedEra: 'Era Samudra Tahun 88',
        strongholdDistrict: 'Dermaga Cincin Turquoise',
        cityMapXPercent: 65,
        cityMapYPercent: 58,
        specialization: 'Navigasi Tempur & Sihir Samudra',
        reputationRank: 'Peringkat I — Lunaris',
        members: [
          {
            id: 'm-10',
            name: 'Nerissa Moonwake',
            role: 'Pemimpin Klan',
            title: 'Laksamana Rembulan',
            elementAffinity: 'Air Pasang',
            contributionScore: 13540,
          },
          {
            id: 'm-11',
            name: 'Zephyr Coralblade',
            role: 'Wakil Pemimpin',
            title: 'Kapten Pedang Arus',
            elementAffinity: 'Kabut & Air',
            contributionScore: 11200,
          },
        ],
      },
      {
        id: 'clan-crescent-echo',
        cityId: 'lunaris',
        cityName: 'Lunaris',
        name: 'Ordo Sabit Hening',
        tag: 'LUNA',
        emblemVariant: 'crescent-blade',
        accentColor: '#67E8F9',
        motto: 'Bergerak tanpa riak, menyerang bagai bayangan di permukaan air.',
        description:
          'Klan pengintai dan penjaga rahasia Kuil Cermin Rembulan yang ahli dalam seni ilusi kabut.',
        historyLore:
          'Para anggota Ordo Sabit Hening berlatih di bawah air terjun perak Lunaris hingga mampu melangkah di atas permukaan air tanpa meninggalkan jejak.',
        leaderName: 'Soren Noctis',
        leaderTitle: 'Penjaga Cermin Bulan',
        memberCount: 35,
        maxMembers: 45,
        foundedEra: 'Era Samudra Tahun 154',
        strongholdDistrict: 'Kuil Cermin Rembulan',
        cityMapXPercent: 50,
        cityMapYPercent: 27,
        specialization: 'Ilusi Kabut & Pengintaian Cepat',
        reputationRank: 'Peringkat II — Lunaris',
        members: [
          {
            id: 'm-12',
            name: 'Soren Noctis',
            role: 'Pemimpin Klan',
            title: 'Penjaga Cermin Bulan',
            elementAffinity: 'Ilusi Rembulan',
            contributionScore: 10890,
          },
          {
            id: 'm-13',
            name: 'Elowen Mist',
            role: 'Wakil Pemimpin',
            title: 'Penari Riak Perak',
            elementAffinity: 'Es & Air',
            contributionScore: 9120,
          },
        ],
      },
      {
        id: 'clan-abyssal-reef',
        cityId: 'lunaris',
        cityName: 'Lunaris',
        name: 'Penjaga Karang Abyssal',
        tag: 'REEF',
        emblemVariant: 'crescent-blade',
        accentColor: '#38BDF8',
        motto: 'Tak tergoyahkan oleh badai, menjaga batas terdalam samudra.',
        description:
          'Klan ksatria tombak karang yang mengawal Menara Suar Barat dan perbatasan terumbu Lunaris.',
        historyLore:
          'Didirikan oleh para penyelam ksatria Lunaris yang menempa zirah ringan dari sisik naga air dan mutiara mana.',
        leaderName: 'Thalassia Reef',
        leaderTitle: 'Komandan Terumbu Suci',
        memberCount: 32,
        maxMembers: 45,
        foundedEra: 'Era Samudra Tahun 210',
        strongholdDistrict: 'Menara Suar Karang Barat',
        cityMapXPercent: 34,
        cityMapYPercent: 52,
        specialization: 'Pertahanan Pesisir & Tombak Hidro',
        reputationRank: 'Peringkat III — Lunaris',
        members: [
          {
            id: 'm-13b',
            name: 'Thalassia Reef',
            role: 'Pemimpin Klan',
            title: 'Komandan Terumbu Suci',
            elementAffinity: 'Karang & Arus',
            contributionScore: 9640,
          },
        ],
      },
    ],
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
    clans: [
      {
        id: 'clan-sylvan-wardens',
        cityId: 'velmora',
        cityName: 'Velmora',
        name: 'Penjaga Mahkota Zamrud',
        tag: 'SYLV',
        emblemVariant: 'emerald-bough',
        accentColor: '#34D399',
        motto: 'Akar kami menghujam bumi, anak panah kami menembus cakrawala.',
        description:
          'Klan pemanah elit dan druid penjaga hutan yang mempertahankan keharmonisan Rimba Barat Velmora.',
        historyLore:
          'Penjaga Mahkota Zamrud merupakan klan tertua di Velmora yang memiliki ikatan batin dengan roh elang angin dan pohon pelindung kota.',
        leaderName: 'Thalion Greenbough',
        leaderTitle: 'High Ranger Velmora',
        memberCount: 46,
        maxMembers: 50,
        foundedEra: 'Era Rimba Tahun 45',
        strongholdDistrict: 'Anjungan Pemanah Angin',
        cityMapXPercent: 66,
        cityMapYPercent: 44,
        specialization: 'Panahan Presisi & Sihir Alam',
        reputationRank: 'Peringkat I — Velmora',
        members: [
          {
            id: 'm-14',
            name: 'Thalion Greenbough',
            role: 'Pemimpin Klan',
            title: 'High Ranger Velmora',
            elementAffinity: 'Angin & Flora',
            contributionScore: 13980,
          },
          {
            id: 'm-15',
            name: 'Sylphie Verdant',
            role: 'Wakil Pemimpin',
            title: 'Archdruid Mata Air',
            elementAffinity: 'Kehidupan Murni',
            contributionScore: 11670,
          },
        ],
      },
      {
        id: 'clan-whispering-root',
        cityId: 'velmora',
        cityName: 'Velmora',
        name: 'Persekutuan Akar Berbisik',
        tag: 'ROOT',
        emblemVariant: 'emerald-bough',
        accentColor: '#10B981',
        motto: 'Hutan mendengar segalanya, alam mengingat segalanya.',
        description:
          'Klan alkemis botani dan penyembuh yang meracik ramuan legendaris dari flora langka Velmora.',
        historyLore:
          'Bernaung di bawah Inti Pohon Sylvan, klan ini menjaga perpustakaan herbal dan membudidayakan tanaman mana bercahaya.',
        leaderName: 'Miriel Leafsong',
        leaderTitle: 'Master Alkemis Sylvan',
        memberCount: 33,
        maxMembers: 45,
        foundedEra: 'Era Rimba Tahun 190',
        strongholdDistrict: 'Inti Pohon Sylvan',
        cityMapXPercent: 50,
        cityMapYPercent: 27,
        specialization: 'Alkimia Herbal & Pemulihan Area',
        reputationRank: 'Peringkat II — Velmora',
        members: [
          {
            id: 'm-16',
            name: 'Miriel Leafsong',
            role: 'Pemimpin Klan',
            title: 'Master Alkemis Sylvan',
            elementAffinity: 'Botani Mana',
            contributionScore: 9850,
          },
        ],
      },
      {
        id: 'clan-silver-stag',
        cityId: 'velmora',
        cityName: 'Velmora',
        name: 'Ksatria Rusa Perak',
        tag: 'STAG',
        emblemVariant: 'emerald-bough',
        accentColor: '#6EE7B7',
        motto: 'Melompat melintasi lembah, menjaga ketenangan rimba suci.',
        description:
          'Klan kavaleri hutan yang berpatroli di sepanjang sungai dan jembatan akar selatan Velmora.',
        historyLore:
          'Mengendarai rusa mistis bertanduk perak, klan ini adalah garda tercepat yang merespons gangguan di perbatasan hutan.',
        leaderName: 'Faelan Swiftbough',
        leaderTitle: 'Kapten Lembah Zamrud',
        memberCount: 29,
        maxMembers: 40,
        foundedEra: 'Era Rimba Tahun 240',
        strongholdDistrict: 'Gerbang Lembah Rusa Perak',
        cityMapXPercent: 34,
        cityMapYPercent: 54,
        specialization: 'Mobilitas Rimba & Pertahanan Jembatan',
        reputationRank: 'Peringkat III — Velmora',
        members: [
          {
            id: 'm-16b',
            name: 'Faelan Swiftbough',
            role: 'Pemimpin Klan',
            title: 'Kapten Lembah Zamrud',
            elementAffinity: 'Angin Rimba',
            contributionScore: 9120,
          },
        ],
      },
    ],
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
    clans: [
      {
        id: 'clan-golden-sovereign',
        cityId: 'eldoria',
        cityName: 'Eldoria',
        name: 'Legiun Mahkota Emas',
        tag: 'GOLD',
        emblemVariant: 'imperial-crown',
        accentColor: '#FBBF24',
        motto: 'Satu mahkota, satu kehormatan, demi kejayaan abadi Eldoria.',
        description:
          'Klan ksatria kerajaan terkuat di Eldoria yang memimpin pengawalan ibu kota dan ekspedisi besar.',
        historyLore:
          'Didirikan langsung oleh Kaisar Pertama Eldoria, Legiun Mahkota Emas dikenal karena disiplin baja dan baju zirah bersepuh emas murni.',
        leaderName: 'Aurelius Rex',
        leaderTitle: 'Panglima Agung Kekaisaran',
        memberCount: 50,
        maxMembers: 50,
        foundedEra: 'Era Kekaisaran Tahun 1',
        strongholdDistrict: 'Istana Mahkota Surya',
        cityMapXPercent: 50,
        cityMapYPercent: 27,
        specialization: 'Komando Pasukan & Kavaleri Berat',
        reputationRank: 'Peringkat I — Eldoria',
        members: [
          {
            id: 'm-17',
            name: 'Aurelius Rex',
            role: 'Pemimpin Klan',
            title: 'Panglima Agung Kekaisaran',
            elementAffinity: 'Cahaya Emas',
            contributionScore: 16400,
          },
          {
            id: 'm-18',
            name: 'Beatrice Solaris',
            role: 'Wakil Pemimpin',
            title: 'Ksatria Panji Raja',
            elementAffinity: 'Api Surya',
            contributionScore: 14120,
          },
          {
            id: 'm-19',
            name: 'Lucian Vance',
            role: 'Tetua',
            title: 'Penasihat Senat Klan',
            elementAffinity: 'Rune Hukum',
            contributionScore: 12500,
          },
        ],
      },
      {
        id: 'clan-aegis-hearth',
        cityId: 'eldoria',
        cityName: 'Eldoria',
        name: 'Ksatria Perisai Griffin',
        tag: 'GRFN',
        emblemVariant: 'imperial-crown',
        accentColor: '#F59E0B',
        motto: 'Keberanian yang membumbung tinggi bagai kepak sayap griffin.',
        description:
          'Klan penunggang griffin dan penjaga jalur jembatan udara yang menghubungkan Eldoria dengan pulau-pulau sekitar.',
        historyLore:
          'Ksatria Perisai Griffin berpatroli dari menara-menara luar Eldoria dan menjadi garda terdepan ketika ancaman muncul di perbatasan tengah.',
        leaderName: 'Roland Highwing',
        leaderTitle: 'Komandan Langit Eldoria',
        memberCount: 45,
        maxMembers: 50,
        foundedEra: 'Era Kekaisaran Tahun 76',
        strongholdDistrict: 'Benteng Sungai Kembar',
        cityMapXPercent: 34,
        cityMapYPercent: 51,
        specialization: 'Serangan Udara & Mobilitas Cepat',
        reputationRank: 'Peringkat II — Eldoria',
        members: [
          {
            id: 'm-20',
            name: 'Roland Highwing',
            role: 'Pemimpin Klan',
            title: 'Komandan Langit Eldoria',
            elementAffinity: 'Angin Kencang',
            contributionScore: 12950,
          },
        ],
      },
      {
        id: 'clan-radiant-scales',
        cityId: 'eldoria',
        cityName: 'Eldoria',
        name: 'Gilda Neraca Kencana',
        tag: 'ORUM',
        emblemVariant: 'imperial-crown',
        accentColor: '#FDE047',
        motto: 'Kemakmuran dan strategi adalah fondasi setiap kemenangan.',
        description:
          'Klan penjelajah, kartografer, dan pengumpul artefak kuno yang berpusat di Plaza Pertemuan Agung.',
        historyLore:
          'Gilda Neraca Kencana memetakan jalur-jalur tersembunyi di Dunia Nuenime dan mendokumentasikan sejarah ketujuh kota besar.',
        leaderName: 'Cassian Mercer',
        leaderTitle: 'Grand Archivist Eldoria',
        memberCount: 41,
        maxMembers: 50,
        foundedEra: 'Era Kekaisaran Tahun 130',
        strongholdDistrict: 'Plaza Pertemuan Agung',
        cityMapXPercent: 53,
        cityMapYPercent: 65,
        specialization: 'Eksplorasi Artefak & Kartografi',
        reputationRank: 'Peringkat III — Eldoria',
        members: [
          {
            id: 'm-21',
            name: 'Cassian Mercer',
            role: 'Pemimpin Klan',
            title: 'Grand Archivist Eldoria',
            elementAffinity: 'Logam Mulia',
            contributionScore: 11320,
          },
        ],
      },
      {
        id: 'clan-sovereign-blade',
        cityId: 'eldoria',
        cityName: 'Eldoria',
        name: 'Ordo Pedang Sovereign',
        tag: 'SOVR',
        emblemVariant: 'imperial-crown',
        accentColor: '#FCD34D',
        motto: 'Keadilan ditegakkan oleh ketajaman pedang dan kemurnian hati.',
        description:
          'Klan ksatria duelis dan instruktur pedang kekaisaran yang bermarkas di Menara Garnisun Sovereign.',
        historyLore:
          'Mencetak para pendekar pedang terbaik di Heartlands dan menjaga ketertiban jalur jembatan timur Eldoria.',
        leaderName: 'Gideon Sterling',
        leaderTitle: 'Master Pedang Sovereign',
        memberCount: 38,
        maxMembers: 45,
        foundedEra: 'Era Kekaisaran Tahun 185',
        strongholdDistrict: 'Menara Garnisun Sovereign',
        cityMapXPercent: 66,
        cityMapYPercent: 44,
        specialization: 'Duel Pedang & Taktik Formasi',
        reputationRank: 'Peringkat IV — Eldoria',
        members: [
          {
            id: 'm-21b',
            name: 'Gideon Sterling',
            role: 'Pemimpin Klan',
            title: 'Master Pedang Sovereign',
            elementAffinity: 'Baja Cahaya',
            contributionScore: 10780,
          },
        ],
      },
    ],
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
    clans: [
      {
        id: 'clan-crimson-fang',
        cityId: 'drakonia',
        cityName: 'Drakonia',
        name: 'Taring Naga Merah',
        tag: 'DRAK',
        emblemVariant: 'dragon-fang',
        accentColor: '#EF4444',
        motto: 'Dari bara api kami bangkit, dengan taring naga kami menaklukkan.',
        description:
          'Klan petarung garis depan paling ditakuti di Drakonia yang menguasai seni bela diri api magma.',
        historyLore:
          'Dipimpin oleh keturunan penjinak naga api kuno, Taring Naga Merah hanya menerima ksatria yang sanggup melewati ujian di kawah Tungku Jantung Naga.',
        leaderName: 'Ignis Draven',
        leaderTitle: 'Dragonlord Obsidian',
        memberCount: 49,
        maxMembers: 50,
        foundedEra: 'Era Bara Tahun 19',
        strongholdDistrict: 'Tungku Jantung Naga',
        cityMapXPercent: 50,
        cityMapYPercent: 27,
        specialization: 'Serangan Agresif & Sihir Magma',
        reputationRank: 'Peringkat I — Drakonia',
        members: [
          {
            id: 'm-22',
            name: 'Ignis Draven',
            role: 'Pemimpin Klan',
            title: 'Dragonlord Obsidian',
            elementAffinity: 'Api Naga Purba',
            contributionScore: 15890,
          },
          {
            id: 'm-23',
            name: 'Kaelith Cinder',
            role: 'Wakil Pemimpin',
            title: 'Jenderal Pedang Bara',
            elementAffinity: 'Lava & Baja',
            contributionScore: 13410,
          },
        ],
      },
      {
        id: 'clan-stormforged',
        cityId: 'drakonia',
        cityName: 'Drakonia',
        name: 'Legiun Petir Hitam',
        tag: 'VOLT',
        emblemVariant: 'dragon-fang',
        accentColor: '#A855F7',
        motto: 'Secepat kilat menyambar, sekeras batu obsidian.',
        description:
          'Klan ksatria tombak petir yang menjaga perbatasan pesisir Drakonia dari anomali pusaran badai ungu.',
        historyLore:
          'Menggabungkan kekuatan fisik Drakonia dengan energi petir ungu dari laut timur, klan ini mampu melancarkan serangan berkecepatan tinggi.',
        leaderName: 'Varek Stormclaw',
        leaderTitle: 'Penguasa Menara Petir',
        memberCount: 42,
        maxMembers: 50,
        foundedEra: 'Era Bara Tahun 108',
        strongholdDistrict: 'Menara Penangkap Petir',
        cityMapXPercent: 66,
        cityMapYPercent: 44,
        specialization: 'Kecepatan Kilat & Penetrasi Perisai',
        reputationRank: 'Peringkat II — Drakonia',
        members: [
          {
            id: 'm-24',
            name: 'Varek Stormclaw',
            role: 'Pemimpin Klan',
            title: 'Penguasa Menara Petir',
            elementAffinity: 'Petir Ungu',
            contributionScore: 12780,
          },
        ],
      },
      {
        id: 'clan-obsidian-anvil',
        cityId: 'drakonia',
        cityName: 'Drakonia',
        name: 'Persaudaraan Paron Abadi',
        tag: 'ANVL',
        emblemVariant: 'dragon-fang',
        accentColor: '#F97316',
        motto: 'Baja terbaik lahir dari pukulan terkeras.',
        description:
          'Persekutuan pandai besi tempur dan ksatria perisai berat yang mempersenjatai seluruh benteng Drakonia.',
        historyLore:
          'Tanpa Persaudaraan Paron Abadi, dinding obsidian Drakonia tak akan pernah berdiri. Mereka adalah arsitek persenjataan terkuat di timur.',
        leaderName: 'Torunn Magmaheart',
        leaderTitle: 'Grand Forgemaster',
        memberCount: 37,
        maxMembers: 45,
        foundedEra: 'Era Bara Tahun 165',
        strongholdDistrict: 'Benteng Kaldera Barat',
        cityMapXPercent: 34,
        cityMapYPercent: 53,
        specialization: 'Penempaan Artefak & Zirah Berat',
        reputationRank: 'Peringkat III — Drakonia',
        members: [
          {
            id: 'm-25',
            name: 'Torunn Magmaheart',
            role: 'Pemimpin Klan',
            title: 'Grand Forgemaster',
            elementAffinity: 'Logam & Magma',
            contributionScore: 10940,
          },
        ],
      },
    ],
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
    clans: [
      {
        id: 'clan-sun-mirage',
        cityId: 'nivara',
        cityName: 'Nivara',
        name: 'Ordo Tombak Cakrawala Surya',
        tag: 'SOLR',
        emblemVariant: 'solar-ankh',
        accentColor: '#F59E0B',
        motto: 'Di bawah terik matahari, tiada bayangan yang dapat bersembunyi.',
        description:
          'Klan penjaga kerajaan Nivara yang menguasai sihir pasir emas dan tombak cahaya matahari.',
        historyLore:
          'Ordo Tombak Cakrawala Surya telah menjaga Ziggurat Nivara selama berabad-abad dan mampu membangkitkan badai pasir untuk menghentikan pasukan musuh.',
        leaderName: 'Azirion Sol',
        leaderTitle: 'Sun Warden Nivara',
        memberCount: 43,
        maxMembers: 50,
        foundedEra: 'Era Surya Tahun 62',
        strongholdDistrict: 'Ziggurat Obelisk Surya',
        cityMapXPercent: 50,
        cityMapYPercent: 27,
        specialization: 'Pengendalian Medan Pasir & Sihir Surya',
        reputationRank: 'Peringkat I — Nivara',
        members: [
          {
            id: 'm-26',
            name: 'Azirion Sol',
            role: 'Pemimpin Klan',
            title: 'Sun Warden Nivara',
            elementAffinity: 'Pasir & Surya',
            contributionScore: 13200,
          },
          {
            id: 'm-27',
            name: 'Amira Dunesong',
            role: 'Wakil Pemimpin',
            title: 'Penari Pedang Fatamorgana',
            elementAffinity: 'Angin Gurun',
            contributionScore: 11050,
          },
        ],
      },
      {
        id: 'clan-golden-caravan',
        cityId: 'nivara',
        cityName: 'Nivara',
        name: 'Serikat Pengembara Oasis',
        tag: 'DUNE',
        emblemVariant: 'solar-ankh',
        accentColor: '#FBBF24',
        motto: 'Menemukan jalan di tengah padang pasir tak bertepi.',
        description:
          'Klan pemburu relik kuno dan pengawal rute kafilah selatan yang mengenal setiap jengkal gurun Nivara.',
        historyLore:
          'Berawal dari kelompok penjelajah reruntuhan bawah pasir, Serikat Pengembara Oasis kini menjadi salah satu klan paling berpengaruh di selatan.',
        leaderName: 'Tariq Al-Zahir',
        leaderTitle: 'Master Kompas Gurun',
        memberCount: 38,
        maxMembers: 45,
        foundedEra: 'Era Surya Tahun 140',
        strongholdDistrict: 'Bazar Kafilah Emas',
        cityMapXPercent: 34,
        cityMapYPercent: 52,
        specialization: 'Perburuan Relik & Taktik Gerilya',
        reputationRank: 'Peringkat II — Nivara',
        members: [
          {
            id: 'm-28',
            name: 'Tariq Al-Zahir',
            role: 'Pemimpin Klan',
            title: 'Master Kompas Gurun',
            elementAffinity: 'Bumi & Kuarsa',
            contributionScore: 10410,
          },
        ],
      },
      {
        id: 'clan-mirage-jewel',
        cityId: 'nivara',
        cityName: 'Nivara',
        name: 'Garda Permata Fatamorgana',
        tag: 'MIRA',
        emblemVariant: 'solar-ankh',
        accentColor: '#FDE047',
        motto: 'Kilau kuarsa dan gelombang pirus adalah perisai kota kami.',
        description:
          'Klan penjaga kanal oasis dan Pelabuhan Teluk Pirus yang ahli dalam sihir pembiasan cahaya.',
        historyLore:
          'Mengamankan jalur perairan selatan Nivara dan menjaga kemurnian mata air oasis kota.',
        leaderName: 'Zahra Sunveil',
        leaderTitle: 'Penjaga Teluk Pirus',
        memberCount: 31,
        maxMembers: 45,
        foundedEra: 'Era Surya Tahun 205',
        strongholdDistrict: 'Pelabuhan Teluk Pirus',
        cityMapXPercent: 65,
        cityMapYPercent: 58,
        specialization: 'Ilusi Refraksi & Pertahanan Kanal',
        reputationRank: 'Peringkat III — Nivara',
        members: [
          {
            id: 'm-28b',
            name: 'Zahra Sunveil',
            role: 'Pemimpin Klan',
            title: 'Penjaga Teluk Pirus',
            elementAffinity: 'Cahaya & Air Oasis',
            contributionScore: 9520,
          },
        ],
      },
    ],
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
    clans: [
      {
        id: 'clan-void-stargazers',
        cityId: 'astralis',
        cityName: 'Astralis',
        name: 'Konklaf Penenun Bintang',
        tag: 'STAR',
        emblemVariant: 'astral-prism',
        accentColor: '#C084FC',
        motto: 'Takdir dunia tertulis di balik cahaya konstelasi.',
        description:
          'Klan penyihir kosmik terkemuka di Astralis yang menguasai sihir gravitasi dan proyeksi bintang.',
        historyLore:
          'Konklaf Penenun Bintang adalah pendiri Menara Nexus Kosmik yang pertama kali berhasil menjinakkan radiasi kristal meteorit selatan.',
        leaderName: 'Celestia Vane',
        leaderTitle: 'Grand Astromancer',
        memberCount: 47,
        maxMembers: 50,
        foundedEra: 'Era Kosmik Tahun 33',
        strongholdDistrict: 'Menara Nexus Kosmik',
        cityMapXPercent: 50,
        cityMapYPercent: 27,
        specialization: 'Sihir Kosmik & Pengendalian Gravitasi',
        reputationRank: 'Peringkat I — Astralis',
        members: [
          {
            id: 'm-29',
            name: 'Celestia Vane',
            role: 'Pemimpin Klan',
            title: 'Grand Astromancer',
            elementAffinity: 'Bintang & Gravitasi',
            contributionScore: 15120,
          },
          {
            id: 'm-30',
            name: 'Orion Nightshade',
            role: 'Wakil Pemimpin',
            title: 'Magus Prisma Ungu',
            elementAffinity: 'Kristal Arcane',
            contributionScore: 12640,
          },
        ],
      },
      {
        id: 'clan-amethyst-aegis',
        cityId: 'astralis',
        cityName: 'Astralis',
        name: 'Ordo Ksatria Amethyst',
        tag: 'AMTH',
        emblemVariant: 'astral-prism',
        accentColor: '#A855F7',
        motto: 'Pedang kami membelah mantra, perisai kami memantulkan bintang.',
        description:
          'Klan ksatria-penyihir (Spellblade) yang melindungi Akademi Prisma Ungu dan menara kristal Astralis.',
        historyLore:
          'Menyatukan seni berpedang dengan kristal penghantar mana, Ordo Ksatria Amethyst adalah perisai hidup bagi para cendekiawan Astralis.',
        leaderName: 'Vespera Thorne',
        leaderTitle: 'Komandan Spellblade',
        memberCount: 40,
        maxMembers: 50,
        foundedEra: 'Era Kosmik Tahun 95',
        strongholdDistrict: 'Akademi Prisma Ungu',
        cityMapXPercent: 34,
        cityMapYPercent: 52,
        specialization: 'Pertarungan Pedang Sihir & Anti-Mantra',
        reputationRank: 'Peringkat II — Astralis',
        members: [
          {
            id: 'm-31',
            name: 'Vespera Thorne',
            role: 'Pemimpin Klan',
            title: 'Komandan Spellblade',
            elementAffinity: 'Pedang Kristal',
            contributionScore: 11850,
          },
        ],
      },
      {
        id: 'clan-nebula-seekers',
        cityId: 'astralis',
        cityName: 'Astralis',
        name: 'Penjelajah Cakrawala Nebula',
        tag: 'NEBU',
        emblemVariant: 'astral-prism',
        accentColor: '#E879F9',
        motto: 'Menembus batas kabut selatan menuju rahasia terdalam dunia.',
        description:
          'Klan navigator astral yang menjelajahi kepulauan terluar dan menjaga suar Pelabuhan Bintang Jatuh.',
        historyLore:
          'Mereka memadukan kompas kristal Astralis dengan peta bintang untuk berlayar menembus kabut tebal di ujung selatan Dunia Nuenime.',
        leaderName: 'Lycoris Nova',
        leaderTitle: 'Navigator Bintang Selatan',
        memberCount: 34,
        maxMembers: 45,
        foundedEra: 'Era Kosmik Tahun 172',
        strongholdDistrict: 'Pelabuhan Bintang Jatuh',
        cityMapXPercent: 65,
        cityMapYPercent: 58,
        specialization: 'Eksplorasi Anomali & Navigasi Astral',
        reputationRank: 'Peringkat III — Astralis',
        members: [
          {
            id: 'm-32',
            name: 'Lycoris Nova',
            role: 'Pemimpin Klan',
            title: 'Navigator Bintang Selatan',
            elementAffinity: 'Cahaya Nebula',
            contributionScore: 9920,
          },
        ],
      },
    ],
  },
];

/**
 * Menghidrasi data awal 7 kota agar:
 * 1. Setiap kota dimulai pada Level 1 (Tier I) dengan HP 10.000 / 10.000.
 * 2. Setiap kota terhubung ke 1 Pemimpin Kota Demo dan 1 Bos Unik Kota.
 * 3. Setiap klan memiliki maxMembers = 100 dan memberCount === members.length.
 * 4. Total EXP Klan === jumlah contributionScore anggotanya.
 * 5. Total EXP Kota === jumlah totalExp seluruh klan di kota tersebut.
 */
function hydrateWorldCitiesSeed(): WorldCity[] {
  return RAW_WORLD_CITIES.map((rawCity, cityIndex) => {
    const cityId = rawCity.id as WorldCity['id'];
    const leaderProfile = DEMO_CITY_LEADERS[cityId];
    const bossRecord =
      INITIAL_CITY_BOSSES.find((b) => b.cityId === cityId) ?? INITIAL_CITY_BOSSES[0];

    // Kalibrasi EXP awal per klan agar setiap kota memulai pada Level 1 (< 500 EXP) dengan nilai unik
    const baseClanExpSeeds = [170, 125, 85, 65];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hydratedClans: Clan[] = (rawCity.clans ?? []).map((rawClan: any, clanIndex: number) => {
      const targetClanSeedExp =
        (baseClanExpSeeds[clanIndex] ?? 60) + ((cityIndex * 7 + clanIndex * 5) % 25);

      const rawMembers = rawClan.members ?? [];
      const memberCount = Math.max(1, rawMembers.length);

      // Distribusikan targetClanSeedExp secara presisi ke anggota klan
      let remainingExp = targetClanSeedExp;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hydratedMembers: ClanMember[] = rawMembers.map((m: any, mIdx: number) => {
        const isLast = mIdx === memberCount - 1;
        const share = isLast
          ? remainingExp
          : Math.max(10, Math.floor(targetClanSeedExp / memberCount) + (mIdx === 0 ? 15 : -5));
        remainingExp = Math.max(0, remainingExp - share);

        const isAdventurerSlot =
          rawClan.id === 'clan-seraph-vanguard' && mIdx === rawMembers.length - 1;

        return {
          id: m.id,
          userId: isAdventurerSlot ? 'user-demo-adventurer' : `user-${m.id}`,
          clanId: rawClan.id,
          cityId,
          name: isAdventurerSlot ? 'Raka Pratama (Anggota Demo)' : m.name,
          role: m.role,
          title: m.title,
          elementAffinity: m.elementAffinity,
          joinedAt: '2026-01-10T08:00:00.000Z',
          contributionScore: share,
          completedMissionsCount: Math.max(1, Math.round(share / 20)),
          status: 'ACTIVE',
        };
      });

      const clanTotalExp = hydratedMembers.reduce((sum, m) => sum + m.contributionScore, 0);

      return {
        ...rawClan,
        cityId,
        founderId: leaderProfile.id,
        leaderId: hydratedMembers[0]?.userId ?? `leader-${rawClan.id}`,
        memberCount: hydratedMembers.length,
        maxMembers: NUENIME_SYSTEM_LIMITS.MAX_MEMBERS_PER_CLAN,
        totalExp: clanTotalExp,
        level: computeClanLevelFromExp(clanTotalExp),
        createdAt: '2026-01-05T00:00:00.000Z',
        lastContributionAt: `2026-02-0${(clanIndex % 7) + 1}T12:00:00.000Z`,
        members: hydratedMembers,
      };
    });

    const cityTotalExp = hydratedClans.reduce((sum, c) => sum + c.totalExp, 0);
    const levelProgress = computeCityLevelProgressFromTotalExp(cityTotalExp);

    return {
      ...rawCity,
      leaderId: leaderProfile.id,
      leaderProfile,
      level: levelProgress.level,
      tier: levelProgress.tier,
      totalExp: levelProgress.totalExp,
      currentLevelExp: levelProgress.currentLevelExp,
      nextLevelTargetExp: levelProgress.nextLevelTargetExp,
      maxHp: NUENIME_SYSTEM_LIMITS.INITIAL_CITY_LEVEL_1_HP,
      currentHp: NUENIME_SYSTEM_LIMITS.INITIAL_CITY_LEVEL_1_HP,
      maxClans: NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY,
      bossId: bossRecord.id,
      boss: bossRecord,
      levelHistory: [],
      clans: hydratedClans,
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
    'Dunia Nuenime terdiri dari 7 kota independen yang dipimpin oleh 7 Pemimpin Kota dan dijaga oleh 7 Monster Bos unik. Aktivitas anggota menyelesaikan misi menyumbangkan EXP ke klan, meningkatkan total EXP kota, dan menaikkan Level serta Tier (Tier I–VIII) kota tersebut.',
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

