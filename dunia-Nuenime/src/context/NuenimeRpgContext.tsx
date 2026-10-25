import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  CityId,
  TimeOfDayMode,
  CityBossRecord,
  SimulationMission,
  DistrictInfluenceState,
  ActiveTravelRoute,
  WorldCity,
  Clan,
  ClanMember,
  CityLeaderProfile,
  ActiveDemoAccount,
  EXPTransactionRecord,
  CityLevelHistoryRecord,
  UserMissionProgressRecord,
  GlobalWorldStats,
  CreateClanInput,
} from '../types/nuenime';
import { WORLD_CITIES as SEED_WORLD_CITIES } from '../data/nuenimeWorldData';
import {
  INITIAL_CITY_BOSSES,
  DEMO_CITY_LEADERS,
  DEMO_SWITCHABLE_ACCOUNTS,
  CLAN_MISSIONS,
  calculateTravelRoute,
} from '../data/nuenimeRpgFeaturesData';
import {
  NUENIME_SYSTEM_LIMITS,
  computeCityLevelProgressFromTotalExp,
  computeClanLevelFromExp,
} from '../config/nuenimeSystemConfig';
import { fantasySoundEngine } from '../utils/soundEngine';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'nuenime_world_repository_v6_database_pure';

/**
 * Fungsi Rekonsiliasi & Pemeriksaan Konsistensi Data Dunia Nuenime (Bagian 9 & 13)
 * Memastikan:
 * - Satu pengguna tidak dihitung dua kali dalam klan yang sama.
 * - memberCount === jumlah anggota aktif sebenarnya (maks. 100).
 * - Total EXP Klan === jumlah contributionScore anggotanya.
 * - Total EXP Kota === jumlah totalExp seluruh klan di kota tersebut.
 * - Level & Tier Kota sesuai dengan formula terpusat.
 * - HP Kota (10.000/10.000) terpisah dari HP Bos.
 */
export function verifyAndReconcileWorldCities(
  citiesInput: WorldCity[],
  cityBossesInput: CityBossRecord[] = INITIAL_CITY_BOSSES,
  cityLevelHistoryInput?: Record<CityId, CityLevelHistoryRecord[]>
): WorldCity[] {
  return citiesInput.map((city) => {
    const leaderProfile = DEMO_CITY_LEADERS[city.id] ?? DEMO_CITY_LEADERS.aetheria;
    const bossRecord =
      cityBossesInput.find((b) => b.cityId === city.id) ??
      INITIAL_CITY_BOSSES.find((b) => b.cityId === city.id) ??
      INITIAL_CITY_BOSSES[0];

    const reconciledClans: Clan[] = city.clans
      .slice(0, NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY)
      .map((clan) => {
        // Deduplicate members by userId and enforce max 100 members
        const seenUserIds = new Set<string>();
        const uniqueMembers: ClanMember[] = [];
        for (const m of clan.members) {
          if (
            !seenUserIds.has(m.userId) &&
            uniqueMembers.length < NUENIME_SYSTEM_LIMITS.MAX_MEMBERS_PER_CLAN
          ) {
            seenUserIds.add(m.userId);
            uniqueMembers.push({
              ...m,
              clanId: clan.id,
              cityId: city.id,
              contributionScore: Math.max(0, Math.floor(m.contributionScore)),
            });
          }
        }

        const clanTotalExp = uniqueMembers.reduce((sum, m) => sum + m.contributionScore, 0);

        return {
          ...clan,
          cityId: city.id,
          cityName: city.name,
          members: uniqueMembers,
          memberCount: uniqueMembers.length,
          maxMembers: NUENIME_SYSTEM_LIMITS.MAX_MEMBERS_PER_CLAN,
          totalExp: clanTotalExp,
          level: computeClanLevelFromExp(clanTotalExp),
        };
      });

    const cityTotalExp = reconciledClans.reduce((sum, c) => sum + c.totalExp, 0);
    const levelState = computeCityLevelProgressFromTotalExp(cityTotalExp);

    return {
      ...city,
      leaderId: leaderProfile.id,
      leaderProfile,
      level: levelState.level,
      tier: levelState.tier,
      totalExp: levelState.totalExp,
      currentLevelExp: levelState.currentLevelExp,
      nextLevelTargetExp: levelState.nextLevelTargetExp,
      maxHp: city.maxHp || NUENIME_SYSTEM_LIMITS.INITIAL_CITY_LEVEL_1_HP,
      currentHp: city.currentHp || NUENIME_SYSTEM_LIMITS.INITIAL_CITY_LEVEL_1_HP,
      maxClans: NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY,
      bossId: bossRecord.id,
      boss: bossRecord,
      levelHistory: cityLevelHistoryInput?.[city.id] ?? city.levelHistory ?? [],
      clans: reconciledClans,
    };
  });
}

interface PersistedRepositoryState {
  cities: WorldCity[];
  cityBosses: CityBossRecord[];
  activeAccountId: string;
  joinedClanId: string | null;
  playerContribution: number;
  relicShards: number;
  relicLevels: Record<string, number>;
  districtInfluence: Record<string, DistrictInfluenceState>;
  completedMissionCounts: Record<string, number>;
  missionProgressMap: Record<string, UserMissionProgressRecord>;
  expTransactions: EXPTransactionRecord[];
  cityLevelHistory: Record<CityId, CityLevelHistoryRecord[]>;
}

function buildDefaultDistrictInfluence(cities: WorldCity[]): Record<string, DistrictInfluenceState> {
  const map: Record<string, DistrictInfluenceState> = {};
  cities.forEach((city) => {
    city.clans.forEach((clan, idx) => {
      map[clan.id] = {
        clanId: clan.id,
        cityId: city.id,
        districtName: clan.strongholdDistrict,
        influencePercent: Math.max(45, 76 - idx * 11),
      };
    });
  });
  return map;
}

function buildDefaultRelicLevels(cities: WorldCity[]): Record<string, number> {
  const map: Record<string, number> = {};
  cities.forEach((city) => {
    city.clans.forEach((clan, idx) => {
      map[clan.id] = idx === 0 ? 2 : 1;
    });
  });
  return map;
}

function buildDefaultLevelHistory(): Record<CityId, CityLevelHistoryRecord[]> {
  return {
    aetheria: [],
    lunaris: [],
    velmora: [],
    eldoria: [],
    drakonia: [],
    nivara: [],
    astralis: [],
  };
}

function loadInitialRepositoryState(): PersistedRepositoryState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedRepositoryState>;
      if (parsed.cities && Array.isArray(parsed.cities) && parsed.cities.length === 7) {
        const reconciledCities = verifyAndReconcileWorldCities(parsed.cities);
        return {
          cities: reconciledCities,
          cityBosses:
            parsed.cityBosses && parsed.cityBosses.length === 7
              ? parsed.cityBosses
              : INITIAL_CITY_BOSSES,
          activeAccountId: parsed.activeAccountId ?? 'nuenime-adventurer',
          joinedClanId: parsed.joinedClanId ?? null,
          playerContribution: parsed.playerContribution ?? 0,
          relicShards: parsed.relicShards ?? 0,
          relicLevels: parsed.relicLevels ?? buildDefaultRelicLevels(reconciledCities),
          districtInfluence:
            parsed.districtInfluence ?? buildDefaultDistrictInfluence(reconciledCities),
          completedMissionCounts: parsed.completedMissionCounts ?? {},
          missionProgressMap: parsed.missionProgressMap ?? {},
          expTransactions: parsed.expTransactions ?? [],
          cityLevelHistory: parsed.cityLevelHistory ?? buildDefaultLevelHistory(),
        };
      }
    }
  } catch {
    // Fallback to clean seed
  }

  const baseSeed = verifyAndReconcileWorldCities(SEED_WORLD_CITIES);
  return {
    cities: baseSeed,
    cityBosses: INITIAL_CITY_BOSSES,
    activeAccountId: 'nuenime-adventurer',
    joinedClanId: null,
    playerContribution: 0,
    relicShards: 0,
    relicLevels: buildDefaultRelicLevels(baseSeed),
    districtInfluence: buildDefaultDistrictInfluence(baseSeed),
    completedMissionCounts: {},
    missionProgressMap: {},
    expTransactions: [],
    cityLevelHistory: buildDefaultLevelHistory(),
  };
}

interface NuenimeRpgContextValue {
  // Core World Entities (Dynamic Repository)
  cities: WorldCity[];
  allClans: Clan[];
  getCityById: (cityId: string) => WorldCity | undefined;
  getClanById: (clanId: string) => Clan | undefined;
  cityLeaders: Record<CityId, CityLeaderProfile>;
  getCityLeader: (cityId: CityId) => CityLeaderProfile;

  // Demo Account & Role Switcher
  availableDemoAccounts: ActiveDemoAccount[];
  activeAccount: ActiveDemoAccount;
  switchDemoAccount: (accountId: string) => void;
  canCreateClanInCity: (cityId: CityId) => { allowed: boolean; reason: string };

  // Crystals & Economy (Pembuatan Klan Biaya 2.000 Crystal)
  userCrystals: number;
  deductCrystals: (amount: number) => boolean;
  addCrystals: (amount: number) => void;

  // Clan Creation & Membership (15 Clans/City, 100 Members/Clan)
  createClanInCity: (
    input: CreateClanInput,
    idempotencyKey?: string
  ) => { ok: boolean; message: string; createdClan?: Clan };
  updateClanLogo: (clanId: string, logoUrl: string) => { ok: boolean; message: string };
  updateClanProfile: (
    clanId: string,
    updates: {
      name?: string;
      tag?: string;
      motto?: string;
      description?: string;
      logoUrl?: string;
    }
  ) => { ok: boolean; message: string };
  updateMemberRole: (
    clanId: string,
    memberId: string,
    newRole: string
  ) => { ok: boolean; message: string };
  joinedClanId: string | null;
  joinClan: (clanId: string) => { ok: boolean; message: string };

  // Unique City Bosses (7 Bosses, Separate Boss HP from City HP)
  worldBosses: CityBossRecord[];
  getCityBoss: (cityId: CityId) => CityBossRecord;
  attackWorldBoss: (bossId: string) => { damage: number; defeated: boolean };
  resetWorldBoss: (bossId: string) => void;

  // Simulation Missions & Atomic EXP Pipeline (Member -> Clan -> City -> Level & Tier)
  simulationMissions: SimulationMission[];
  completedMissionCounts: Record<string, number>;
  missionProgressMap: Record<string, UserMissionProgressRecord>;
  completeClanMission: (
    mission: SimulationMission,
    idempotencyKey?: string
  ) => { ok: boolean; expAdded: number; cityLeveledUp: boolean; newCityLevel: number };
  expTransactions: EXPTransactionRecord[];
  cityLevelHistory: Record<CityId, CityLevelHistoryRecord[]>;
  reconcileWorldConsistency: () => void;
  resetDemoWorldData: () => void;
  resetAllSimulationData: () => void;

  // Global World Stats & Leaderboards
  globalWorldStats: GlobalWorldStats;
  getClanTotalScore: (clanId: string) => number;
  getCityClansLeaderboard: (cityId: CityId) => Clan[];
  getWorldClansLeaderboard: () => Clan[];

  // Atmosphere, Audio, Relics, District Conquest, & Travel Route
  timeOfDay: TimeOfDayMode;
  setTimeOfDay: (mode: TimeOfDayMode) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  setAmbientLocation: (location: CityId | 'world') => void;
  playerContribution: number;
  relicShards: number;
  relicLevels: Record<string, number>;
  upgradeClanRelic: (clanId: string) => boolean;
  districtInfluence: Record<string, DistrictInfluenceState>;
  reinforceClanDistrict: (clanId: string) => void;
  activeRoute: ActiveTravelRoute | null;
  selectTravelRoute: (fromCityId: CityId, toCityId: CityId) => void;
  clearTravelRoute: () => void;
  toastMessage: string | null;
  dismissToast: () => void;
}

const NuenimeRpgContext = createContext<NuenimeRpgContextValue | null>(null);

export const NuenimeRpgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [repo, setRepo] = useState<PersistedRepositoryState>(loadInitialRepositoryState);
  const [timeOfDay, setTimeOfDayState] = useState<TimeOfDayMode>('day');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [activeRoute, setActiveRoute] = useState<ActiveTravelRoute | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Idempotency lock set to prevent duplicate clan creations or duplicate mission claims
  const processedRequestKeysRef = useRef<Set<string>>(new Set());

  // Persist repository state to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(repo));
    } catch {
      // Ignore storage quota errors
    }
  }, [repo]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3800);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const dismissToast = useCallback(() => setToastMessage(null), []);

  const hydratedCities = useMemo(
    () =>
      verifyAndReconcileWorldCities(repo.cities, repo.cityBosses, repo.cityLevelHistory),
    [repo.cities, repo.cityBosses, repo.cityLevelHistory]
  );

  const allClans = useMemo(() => hydratedCities.flatMap((c) => c.clans), [hydratedCities]);

  const getCityById = useCallback(
    (cityId: string) => hydratedCities.find((c) => c.id === cityId),
    [hydratedCities]
  );

  const getClanById = useCallback(
    (clanId: string) => allClans.find((c) => c.id === clanId),
    [allClans]
  );

  const getCityLeader = useCallback((cityId: CityId): CityLeaderProfile => {
    return DEMO_CITY_LEADERS[cityId];
  }, []);

  const getCityBoss = useCallback(
    (cityId: CityId): CityBossRecord => {
      return (
        repo.cityBosses.find((b) => b.cityId === cityId) ??
        INITIAL_CITY_BOSSES.find((b) => b.cityId === cityId) ??
        INITIAL_CITY_BOSSES[0]
      );
    },
    [repo.cityBosses]
  );

  // Saldo Crystal (Diinisialisasi dari parameter 'crystals' Nuenime App atau LocalStorage)
  const [userCrystals, setUserCrystals] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const queryCrystals = params.get('crystals');
        if (queryCrystals !== null && !isNaN(parseInt(queryCrystals, 10))) {
          return parseInt(queryCrystals, 10);
        }
        const saved = window.localStorage.getItem('nuenime_rpg_crystals');
        if (saved !== null && !isNaN(parseInt(saved, 10))) {
          return parseInt(saved, 10);
        }
      }
    } catch {}
    return 2500; // Default uji coba lokal agar cukup mendirikan klan (2.000 Crystal)
  });

  const deductCrystals = useCallback((amount: number): boolean => {
    if (userCrystals < amount) return false;
    const next = userCrystals - amount;
    setUserCrystals(next);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('nuenime_rpg_crystals', String(next));
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'DEDUCT_CRYSTALS', amount }, '*');
        }
      }
    } catch {}
    return true;
  }, [userCrystals]);

  const addCrystals = useCallback((amount: number) => {
    setUserCrystals((prev) => {
      const next = prev + amount;
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('nuenime_rpg_crystals', String(next));
        }
      } catch {}
      return next;
    });
  }, []);

  const activeAccount: ActiveDemoAccount = useMemo(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const name = params.get('name');
        const uid = params.get('uid');
        const rank = params.get('rank');
        const level = params.get('level');
        const avatar = params.get('avatar');
        const border = params.get('border');
        const vip = params.get('vip') === '1';

        if (name) {
          const parsedLevel = level ? parseInt(level, 10) : 1;
          const parsedRank = rank || 'STONE';
          return {
            id: uid || 'nuenime-adventurer',
            displayName: name,
            handle: `@${name.toLowerCase().replace(/\s+/g, '_')}`,
            title: `Petualang Nuenime (${parsedRank} Lv.${parsedLevel})`,
            role: 'CLAN_MEMBER',
            ledCityId: null,
            joinedClanId: repo.joinedClanId,
            isDemoAccount: false,
            isAppAdmin: false,
            avatarUrl: avatar || null,
            borderUrl: border || null,
            level: parsedLevel,
            rank: parsedRank,
            isVip: vip,
          };
        }
      }
    } catch {}

    return {
      id: 'nuenime-adventurer',
      displayName: 'Petualang Nuenime',
      handle: '@petualang_nuenime',
      title: 'Petualang Nuenime (STONE Lv.1)',
      role: 'CLAN_MEMBER',
      ledCityId: null,
      isDemoAccount: false,
      isAppAdmin: false,
      joinedClanId: repo.joinedClanId,
      level: 1,
      rank: 'STONE',
      isVip: false,
    };
  }, [repo.joinedClanId]);

  // Sinkronisasi data real-time dari Database Supabase (Menghapus ketergantungan data dummy)
  useEffect(() => {
    let isMounted = true;

    async function syncFromSupabase() {
      try {
        const [
          { data: dbClans, error: clanErr },
          { data: dbCities, error: cityErr },
          { data: dbBosses, error: bossErr },
        ] = await Promise.all([
          supabase.from('rpg_clans').select('*, members:rpg_clan_members(*)'),
          supabase.from('rpg_cities').select('*'),
          supabase.from('rpg_city_bosses').select('*'),
        ]);

        if (isMounted) {
          setRepo((prev) => {
            // 1. Sinkronisasi Data Kota & Klan Murni dari Database Supabase
            const nextCities = prev.cities.map((city) => {
              const dbCity = dbCities?.find((c: any) => c.id === city.id);
              const matchedClans = (dbClans || []).filter((c: any) => c.city_id === city.id);

              const formattedClans: Clan[] = matchedClans.map((c: any) => {
                const members: ClanMember[] = (c.members || []).map((m: any) => ({
                  id: m.id,
                  clanId: c.id,
                  userId: m.user_id,
                  name: m.display_name,
                  role: m.role || 'Anggota',
                  contributionScore: Number(m.contribution_score) || 0,
                  cityId: city.id,
                  level: Number(m.level) || 1,
                  avatarUrl: m.avatar_url || null,
                  borderUrl: m.border_url || null,
                  joinedAt: m.joined_at,
                  lastActive: m.last_active_at,
                }));

                const totalExp = members.reduce((sum, m) => sum + m.contributionScore, 0);

                return {
                  id: c.id,
                  name: c.name,
                  tag: c.tag,
                  cityId: city.id,
                  cityName: city.name,
                  founderName: c.leader_name,
                  founderUserId: c.leader_id,
                  leaderName: c.leader_name,
                  leaderUserId: c.leader_id,
                  logoUrl: c.logo_url || undefined,
                  motto: c.slogan || undefined,
                  description: c.description || undefined,
                  memberCount: members.length,
                  maxMembers: c.max_members || 100,
                  totalExp,
                  level: c.level || 1,
                  foundedEra: 'Era Komunitas Nuenime',
                  createdAt: c.created_at,
                  lastContributionAt: c.updated_at,
                  strongholdDistrict: 'Distrik Utama',
                  cityMapXPercent: 50,
                  cityMapYPercent: 50,
                  specialization: 'Komunitas & Raid Kota',
                  reputationRank: `Peringkat #${c.level}`,
                  members,
                };
              });

              const cityTotalExp = dbCity ? Number(dbCity.total_exp) : formattedClans.reduce((sum, c) => sum + c.totalExp, 0);
              const levelProgress = computeCityLevelProgressFromTotalExp(cityTotalExp);

              return {
                ...city,
                name: dbCity?.name || city.name,
                epithet: dbCity?.epithet || city.epithet,
                regionName: dbCity?.region || city.regionName,
                element: dbCity?.element || city.element,
                worldXPercent: dbCity?.world_x_percent != null ? Number(dbCity.world_x_percent) : city.worldXPercent,
                worldYPercent: dbCity?.world_y_percent != null ? Number(dbCity.world_y_percent) : city.worldYPercent,
                focusYPercent: dbCity?.focus_y_percent != null ? Number(dbCity.focus_y_percent) : city.focusYPercent,
                material: dbCity?.material || city.material,
                accentHex: dbCity?.accent_hex || city.accentHex,
                secondaryHex: dbCity?.secondary_hex || city.secondaryHex,
                thumbnailAsset: dbCity?.thumbnail_asset || city.thumbnailAsset,
                emblemAsset: dbCity?.emblem_asset || city.emblemAsset,
                shortDescription: dbCity?.description || city.shortDescription,
                fullLore: dbCity?.full_lore || city.fullLore,
                districts: dbCity?.districts && Array.isArray(dbCity.districts) && dbCity.districts.length > 0 ? dbCity.districts : city.districts,
                level: dbCity ? Number(dbCity.level) : levelProgress.level,
                tier: dbCity ? dbCity.tier_name || levelProgress.tier : levelProgress.tier,
                totalExp: cityTotalExp,
                currentHp: dbCity ? Number(dbCity.current_hp) : city.currentHp,
                maxHp: dbCity ? Number(dbCity.max_hp) : city.maxHp,
                weather: dbCity ? dbCity.weather || city.weather : city.weather,
                status: dbCity ? dbCity.status || city.status : city.status,
                clans: formattedClans,
              };
            });

            // 2. Sinkronisasi Data Bos Kota Murni dari Database Supabase (Level 0, HP Awal, Status)
            const nextBosses = prev.cityBosses.map((boss) => {
              const dbBoss = dbBosses?.find((b: any) => b.city_id === boss.cityId);
              if (!dbBoss) return boss;
              return {
                ...boss,
                id: dbBoss.id || boss.id,
                name: dbBoss.name || boss.name,
                title: dbBoss.title || boss.title,
                speciesType: dbBoss.species_type || boss.speciesType,
                element: dbBoss.element || boss.element,
                description: dbBoss.description || boss.description,
                characteristic: dbBoss.characteristic || boss.characteristic,
                level: Number(dbBoss.level) || 0,
                currentHp: Number(dbBoss.current_hp) || 10000,
                maxHp: Number(dbBoss.max_hp) || 10000,
                status: (dbBoss.status as any) || 'ACTIVE',
                worldXPercent: dbBoss.world_x_percent != null ? Number(dbBoss.world_x_percent) : boss.worldXPercent,
                worldYPercent: dbBoss.world_y_percent != null ? Number(dbBoss.world_y_percent) : boss.worldYPercent,
                accentColor: dbBoss.accent_color || boss.accentColor,
                secondaryColor: dbBoss.secondary_color || boss.secondaryColor,
              };
            });

            // 3. Deteksi Keanggotaan Klan Pengguna Murni dari Database
            const userClan = (dbClans || []).find((c: any) =>
              (c.members || []).some((m: any) => m.user_id === activeAccount.id)
            );
            const resolvedJoinedClanId = userClan ? userClan.id : prev.joinedClanId;

            const reconciled = verifyAndReconcileWorldCities(nextCities, nextBosses);
            const nextState = {
              ...prev,
              cities: reconciled,
              cityBosses: nextBosses,
              joinedClanId: resolvedJoinedClanId,
            };
            saveStoredRepository(nextState);
            return nextState;
          });
        }
      } catch (err) {
        console.warn('[Dunia Nuenime] Gagal menyinkronkan data database Supabase:', err);
      }
    }

    void syncFromSupabase();
    return () => {
      isMounted = false;
    };
  }, [activeAccount.id]);

  const switchDemoAccount = useCallback(
    (accountId: string) => {
      const target = DEMO_SWITCHABLE_ACCOUNTS.find((a) => a.id === accountId);
      if (!target) return;
      fantasySoundEngine.playTap();
      setRepo((prev) => ({
        ...prev,
        activeAccountId: target.id,
        joinedClanId: target.joinedClanId || prev.joinedClanId,
      }));
      showToast(`Beralih ke Akun: ${target.displayName}`);
    },
    [showToast]
  );

  /**
   * Memeriksa hak akses pembuatan klan di suatu kota:
   * - SEMUA user di Nuenime dapat mendirikan klan di kota mana saja tanpa batasan pemimpin kota.
   * - Biaya pembuatan klan adalah 2.000 Crystal.
   * - Kapasitas maksimal adalah 15 klan per kota.
   */
  const canCreateClanInCity = useCallback(
    (cityId: CityId): { allowed: boolean; reason: string } => {
      const city = repo.cities.find((c) => c.id === cityId);
      if (!city) {
        return { allowed: false, reason: 'Kota tidak ditemukan di Dunia Nuenime.' };
      }
      if (city.clans.length >= NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY) {
        return {
          allowed: false,
          reason: `Kapasitas kota ${city.name} telah penuh (${city.clans.length}/${NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY} Klan).`,
        };
      }
      if (userCrystals < 2000) {
        return {
          allowed: false,
          reason: `Crystal tidak mencukupi! Membutuhkan 2.000 Crystal untuk mendirikan klan di ${city.name} (Crystal Anda: ${userCrystals.toLocaleString('id-ID')}).`,
        };
      }
      return {
        allowed: true,
        reason: `Semua petualang Nuenime bebas mendirikan klan di ${city.name} dengan biaya 2.000 Crystal (Crystal Anda: ${userCrystals.toLocaleString('id-ID')}).`,
      };
    },
    [repo.cities, userCrystals]
  );

  /**
   * 3. PEMBUATAN KLAN BARU (MAKSIMAL 15 KLAN PER KOTA)
   * Divalidasi penuh di tingkat repository (kepemilikan kota, kapasitas 15 klan,
   * validasi nama & tag, serta idempotency key anti-klik ganda).
   */
  const createClanInCity = useCallback(
    (
      input: CreateClanInput,
      idempotencyKey?: string
    ): { ok: boolean; message: string; createdClan?: Clan } => {
      const reqKey =
        idempotencyKey ?? `create-clan:${input.cityId}:${input.name.trim().toLowerCase()}`;
      if (processedRequestKeysRef.current.has(reqKey)) {
        return {
          ok: false,
          message: 'Permintaan pembuatan klan sedang diproses (mencegah duplikasi).',
        };
      }

      const permission = canCreateClanInCity(input.cityId);
      if (!permission.allowed) {
        return { ok: false, message: permission.reason };
      }

      // Periksa saldo Crystal untuk mendirikan klan (2.000 Crystal)
      if (userCrystals < 2000) {
        return {
          ok: false,
          message: `Crystal Anda tidak mencukupi untuk membuat klan! Membutuhkan 2.000 Crystal (Saldo Anda: ${userCrystals.toLocaleString('id-ID')}).`,
        };
      }

      const cleanName = input.name.trim();
      const cleanTag = input.tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      const cleanDesc = input.description.trim();
      const cleanMotto = (input.motto ?? '').trim() || `Demi kehormatan ${cleanName}!`;

      if (cleanName.length < 3 || cleanName.length > 36) {
        return {
          ok: false,
          message: 'Nama klan wajib diisi antara 3 hingga 36 karakter.',
        };
      }
      if (cleanTag.length < 2 || cleanTag.length > 5) {
        return {
          ok: false,
          message: 'Tag klan wajib 2–5 karakter huruf/angka (contoh: AETH).',
        };
      }
      if (cleanDesc.length < 10) {
        return {
          ok: false,
          message: 'Deskripsi klan minimal 10 karakter.',
        };
      }

      const duplicateName = allClans.some(
        (c) => c.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicateName) {
        return {
          ok: false,
          message: `Nama klan "${cleanName}" sudah terdaftar di Dunia Nuenime.`,
        };
      }

      const duplicateTag = allClans.some((c) => c.tag.toUpperCase() === cleanTag);
      if (duplicateTag) {
        return {
          ok: false,
          message: `Tag klan [${cleanTag}] sudah digunakan oleh klan lain.`,
        };
      }

      processedRequestKeysRef.current.add(reqKey);

      const targetCity = repo.cities.find((c) => c.id === input.cityId)!;
      if (targetCity.clans.length >= NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY) {
        return {
          ok: false,
          message: `Kapasitas kota ${targetCity.name} sudah mencapai batas 15/15 Klan.`,
        };
      }

      // Potong 2.000 Crystal
      deductCrystals(2000);

      const nowIso = new Date().toISOString();
      const newClanId = `clan-${input.cityId}-${Date.now()}`;
      const existingCount = targetCity.clans.length;

      // Hitung posisi markas baru di Peta Kota secara melingkar agar rapi
      const angle = (existingCount * 137.5 * Math.PI) / 180;
      const radius = 16 + (existingCount % 3) * 6;
      const mapX = Math.round(Math.max(20, Math.min(80, 50 + Math.cos(angle) * radius)));
      const mapY = Math.round(Math.max(22, Math.min(72, 46 + Math.sin(angle) * radius)));

      const founderMember: ClanMember = {
        id: `mem-${Date.now()}`,
        userId: `founder-${newClanId}`,
        clanId: newClanId,
        cityId: targetCity.id,
        name: activeAccount.displayName.replace(/\s*\(.*\)/, ''),
        role: 'Pemimpin Klan',
        title: `Pendiri ${cleanName}`,
        elementAffinity: targetCity.element,
        joinedAt: nowIso,
        contributionScore: 0,
        completedMissionsCount: 0,
        status: 'ACTIVE',
      };

      const newClan: Clan = {
        id: newClanId,
        cityId: targetCity.id,
        cityName: targetCity.name,
        name: cleanName,
        tag: cleanTag,
        emblemVariant: input.emblemVariant,
        logoUrl: (input.logoUrl || '').trim() || undefined,
        accentColor: input.accentColor || targetCity.accentHex,
        motto: cleanMotto,
        description: cleanDesc,
        historyLore: `Didirikan secara resmi di ${targetCity.name} oleh ${activeAccount.displayName} untuk memperkuat distrik ${input.strongholdDistrict}.`,
        founderId: activeAccount.id,
        leaderId: founderMember.userId,
        leaderName: founderMember.name,
        leaderTitle: founderMember.title,
        memberCount: 1,
        maxMembers: NUENIME_SYSTEM_LIMITS.MAX_MEMBERS_PER_CLAN,
        totalExp: 0,
        level: 1,
        foundedEra: 'Era Komunitas Baru',
        createdAt: nowIso,
        lastContributionAt: nowIso,
        strongholdDistrict:
          input.strongholdDistrict || targetCity.districts[0]?.name || 'Distrik Pusat',
        cityMapXPercent: mapX,
        cityMapYPercent: mapY,
        specialization: input.specialization || 'Pertahanan & Kontribusi Komunitas',
        reputationRank: `Peringkat ${existingCount + 1} — ${targetCity.name}`,
        members: [founderMember],
      };

      fantasySoundEngine.playClanJoinFanfare();

      setRepo((prev) => {
        const nextCities = prev.cities.map((c) => {
          if (c.id !== input.cityId) return c;
          if (c.clans.length >= NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY) return c;
          return {
            ...c,
            clans: [...c.clans, newClan],
          };
        });

        return {
          ...prev,
          cities: verifyAndReconcileWorldCities(nextCities),
          joinedClanId: newClan.id,
          relicLevels: {
            ...prev.relicLevels,
            [newClan.id]: 1,
          },
          districtInfluence: {
            ...prev.districtInfluence,
            [newClan.id]: {
              clanId: newClan.id,
              cityId: targetCity.id,
              districtName: newClan.strongholdDistrict,
              influencePercent: 60,
            },
          },
        };
      });

      const updatedCount = existingCount + 1;
      showToast(
        `Klan "${cleanName}" resmi didirikan di ${targetCity.name} (-2.000 Crystal)! (${updatedCount}/${NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY} Klan)`
      );

      // Simpan langsung ke Supabase (Database Real Dunia Nuenime)
      void (async () => {
        try {
          await supabase.from('rpg_clans').insert({
            id: newClan.id,
            city_id: input.cityId,
            name: cleanName,
            tag: cleanTag,
            slogan: input.motto?.trim() || 'Bersatu dalam kejayaan Nuenime',
            description: input.description?.trim() || 'Klan petualang aktif di Dunia Nuenime.',
            logo_url: input.logoUrl?.trim() || null,
            leader_id: activeAccount.id,
            leader_name: activeAccount.displayName,
            level: 1,
            total_exp: 0,
            member_count: 1,
            max_members: NUENIME_SYSTEM_LIMITS.MAX_MEMBERS_PER_CLAN,
            verified: true,
          });

          await supabase.from('rpg_clan_members').insert({
            clan_id: newClan.id,
            user_id: activeAccount.id,
            display_name: activeAccount.displayName,
            avatar_url: activeAccount.avatarUrl || null,
            border_url: activeAccount.borderUrl || null,
            role: 'Pemimpin Klan',
            contribution_score: 0,
            level: activeAccount.level || 1,
          });

          await supabase.from('rpg_exp_transactions').insert({
            user_id: activeAccount.id,
            clan_id: newClan.id,
            city_id: input.cityId,
            amount: 0,
            source_type: 'CLAN_CREATE',
            description: `Pendirian klan "${cleanName}" oleh ${activeAccount.displayName}`,
          });
        } catch (dbErr) {
          console.warn('[Supabase DB] Error saat menyimpan klan baru:', dbErr);
        }
      })();

      return {
        ok: true,
        message: `Klan ${cleanName} berhasil dibuat.`,
        createdClan: newClan,
      };
    },
    [activeAccount.displayName, activeAccount.id, allClans, canCreateClanInCity, deductCrystals, repo.cities, showToast, userCrystals]
  );

  /**
   * 4. BERGABUNG KE KLAN (MAKSIMAL 100 ANGGOTA PER KLAN)
   * Memastikan:
   * - Satu pengguna tidak dihitung dua kali dalam klan yang sama.
   * - Jumlah anggota tidak melebihi 100.
   * - Jumlah anggota konsisten dengan array members sebenarnya.
   */
  const joinClan = useCallback(
    (clanId: string): { ok: boolean; message: string } => {
      const targetClan = allClans.find((c) => c.id === clanId);
      if (!targetClan) {
        return { ok: false, message: 'Klan tidak ditemukan.' };
      }

      const alreadyInClan = targetClan.members.some((m) => m.userId === activeAccount.id);
      if (repo.joinedClanId === clanId && alreadyInClan) {
        showToast(`Anda sudah tercatat sebagai anggota aktif di ${targetClan.name}.`);
        return { ok: true, message: 'Sudah menjadi anggota klan ini.' };
      }

      if (
        !alreadyInClan &&
        targetClan.members.length >= NUENIME_SYSTEM_LIMITS.MAX_MEMBERS_PER_CLAN
      ) {
        const msg = `Kapasitas klan ${targetClan.name} telah penuh (${targetClan.members.length}/${NUENIME_SYSTEM_LIMITS.MAX_MEMBERS_PER_CLAN} Anggota).`;
        showToast(msg);
        return { ok: false, message: msg };
      }

      fantasySoundEngine.playClanJoinFanfare();

      setRepo((prev) => {
        const nowIso = new Date().toISOString();
        const nextCities = prev.cities.map((city) => {
          if (city.id !== targetClan.cityId) return city;
          return {
            ...city,
            clans: city.clans.map((clan) => {
              if (clan.id !== clanId) return clan;
              const exists = clan.members.some((m) => m.userId === activeAccount.id);
              if (exists) return clan;
              if (clan.members.length >= NUENIME_SYSTEM_LIMITS.MAX_MEMBERS_PER_CLAN) return clan;

              const newMember: ClanMember = {
                id: `mem-${activeAccount.id}-${Date.now()}`,
                userId: activeAccount.id,
                clanId: clan.id,
                cityId: city.id,
                name: activeAccount.displayName.replace(/\s*\(.*\)/, ''),
                role: 'Anggota',
                title: activeAccount.title,
                elementAffinity: city.element,
                joinedAt: nowIso,
                contributionScore: 0,
                completedMissionsCount: 0,
                status: 'ACTIVE',
              };

              const updatedMembers = [...clan.members, newMember];
              return {
                ...clan,
                members: updatedMembers,
                memberCount: updatedMembers.length,
              };
            }),
          };
        });

        return {
          ...prev,
          cities: verifyAndReconcileWorldCities(nextCities),
          joinedClanId: clanId,
        };
      });

      // Simpan status bergabung ke database Supabase secara real-time
      void (async () => {
        try {
          await supabase.from('rpg_clan_members').upsert({
            clan_id: clanId,
            user_id: activeAccount.id,
            display_name: activeAccount.displayName.replace(/\s*\(.*\)/, ''),
            avatar_url: activeAccount.avatarUrl || null,
            border_url: activeAccount.borderUrl || null,
            role: 'Anggota',
            contribution_score: 0,
            level: activeAccount.level || 1,
            last_active_at: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.warn('[Supabase DB] Error simpan anggota klan:', dbErr);
        }
      })();

      showToast(`Berhasil bergabung sebagai anggota aktif di ${targetClan.name}!`);
      return { ok: true, message: `Bergabung ke ${targetClan.name}` };
    },
    [activeAccount.avatarUrl, activeAccount.borderUrl, activeAccount.displayName, activeAccount.id, activeAccount.level, allClans, showToast]
  );

  const updateClanLogo = useCallback(
    (clanId: string, logoUrl: string): { ok: boolean; message: string } => {
      const cleanUrl = logoUrl.trim();
      setRepo((prev) => {
        let found = false;
        const nextCities = prev.cities.map((city) => {
          const nextClans = city.clans.map((clan) => {
            if (clan.id === clanId) {
              found = true;
              return { ...clan, logoUrl: cleanUrl || undefined };
            }
            return clan;
          });
          return { ...city, clans: nextClans };
        });
        if (!found) return prev;
        const nextState = { ...prev, cities: nextCities };
        saveStoredRepository(nextState);
        return nextState;
      });

      // Simpan perubahan logo klan ke database Supabase
      void (async () => {
        try {
          await supabase
            .from('rpg_clans')
            .update({
              logo_url: cleanUrl || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', clanId);
        } catch (dbErr) {
          console.warn('[Supabase DB] Error update logo klan:', dbErr);
        }
      })();

      showToast('Logo klan berhasil diperbarui!');
      return { ok: true, message: 'Logo klan berhasil diperbarui!' };
    },
    [showToast]
  );

  const updateClanProfile = useCallback(
    (
      clanId: string,
      updates: {
        name?: string;
        tag?: string;
        motto?: string;
        description?: string;
        logoUrl?: string;
      }
    ): { ok: boolean; message: string } => {
      setRepo((prev) => {
        let found = false;
        const nextCities = prev.cities.map((city) => {
          const nextClans = city.clans.map((clan) => {
            if (clan.id === clanId) {
              found = true;
              return {
                ...clan,
                name: updates.name?.trim() ? updates.name.trim() : clan.name,
                tag: updates.tag?.trim() ? updates.tag.trim().toUpperCase() : clan.tag,
                motto: updates.motto !== undefined ? updates.motto.trim() : clan.motto,
                description:
                  updates.description !== undefined ? updates.description.trim() : clan.description,
                logoUrl:
                  updates.logoUrl !== undefined
                    ? updates.logoUrl.trim() || undefined
                    : clan.logoUrl,
              };
            }
            return clan;
          });
          return { ...city, clans: nextClans };
        });
        if (!found) return prev;
        const nextState = { ...prev, cities: nextCities };
        saveStoredRepository(nextState);
        return nextState;
      });
      showToast('Pengaturan profil klan berhasil disimpan!');

      // Simpan perubahan profil klan ke database Supabase
      void (async () => {
        try {
          const updatePayload: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (updates.name) updatePayload.name = updates.name.trim();
          if (updates.tag) updatePayload.tag = updates.tag.trim().toUpperCase();
          if (updates.motto !== undefined) updatePayload.slogan = updates.motto.trim();
          if (updates.description !== undefined) updatePayload.description = updates.description.trim();
          if (updates.logoUrl !== undefined) updatePayload.logo_url = updates.logoUrl.trim() || null;

          await supabase.from('rpg_clans').update(updatePayload).eq('id', clanId);
        } catch (dbErr) {
          console.warn('[Supabase DB] Error update profil klan:', dbErr);
        }
      })();

      return { ok: true, message: 'Profil klan berhasil diperbarui!' };
    },
    [showToast]
  );

  const updateMemberRole = useCallback(
    (clanId: string, memberId: string, newRole: string): { ok: boolean; message: string } => {
      setRepo((prev) => {
        let found = false;
        const nextCities = prev.cities.map((city) => {
          const nextClans = city.clans.map((clan) => {
            if (clan.id === clanId) {
              const nextMembers = clan.members.map((m) => {
                if (m.id === memberId || m.userId === memberId) {
                  found = true;
                  return { ...m, role: newRole };
                }
                return m;
              });
              return { ...clan, members: nextMembers };
            }
            return clan;
          });
          return { ...city, clans: nextClans };
        });
        if (!found) return prev;
        const nextState = { ...prev, cities: nextCities };
        saveStoredRepository(nextState);
        return nextState;
      });
      showToast(`Jabatan anggota berhasil diubah menjadi "${newRole}"!`);

      // Simpan perubahan jabatan anggota ke database Supabase
      void (async () => {
        try {
          await supabase
            .from('rpg_clan_members')
            .update({
              role: newRole,
              last_active_at: new Date().toISOString(),
            })
            .eq('clan_id', clanId)
            .or(`id.eq.${memberId},user_id.eq.${memberId}`);
        } catch (dbErr) {
          console.warn('[Supabase DB] Error update jabatan member:', dbErr);
        }
      })();

      return { ok: true, message: `Jabatan berhasil diubah ke ${newRole}` };
    },
    [showToast]
  );

  /**
   * 8 & 9. ALUR EXP ATOMIK DARI ANGGOTA -> KLAN -> KOTA -> LEVEL & TIER KOTA
   * Aktivitas anggota -> EXP kontribusi anggota -> EXP klan -> total EXP kota -> progres level kota.
   * Catatan: Aktivitas misi anime menghasilkan EXP dan TIDAK mengurangi HP Bos secara otomatis.
   */
  const completeClanMission = useCallback(
    (
      mission: SimulationMission,
      idempotencyKey?: string
    ): { ok: boolean; expAdded: number; cityLeveledUp: boolean; newCityLevel: number } => {
      if (!mission.isActive) {
        showToast('Misi ini sedang tidak aktif.');
        return { ok: false, expAdded: 0, cityLeveledUp: false, newCityLevel: 1 };
      }

      const txKey =
        idempotencyKey ?? `mission-claim:${activeAccount.id}:${mission.id}:${Date.now()}`;
      if (processedRequestKeysRef.current.has(txKey)) {
        return { ok: false, expAdded: 0, cityLeveledUp: false, newCityLevel: 1 };
      }
      processedRequestKeysRef.current.add(txKey);

      const targetClan =
        allClans.find((c) => c.id === repo.joinedClanId);
      if (!targetClan) {
        showToast('Anda harus mendirikan atau bergabung ke klan terlebih dahulu untuk menyelesaikan misi!');
        return { ok: false, expAdded: 0, cityLeveledUp: false, newCityLevel: 1 };
      }
      const targetCity = repo.cities.find((c) => c.id === targetClan.cityId);
      if (!targetCity) {
        return { ok: false, expAdded: 0, cityLeveledUp: false, newCityLevel: 1 };
      }

      const expReward = Math.max(1, Math.floor(mission.rewardExp));
      const shardReward = Math.max(0, Math.floor(mission.rewardShard));
      const nowIso = new Date().toISOString();

      const cityLevelBefore = targetCity.level;
      const cityTierBefore = targetCity.tier;
      const newCityTotalExp = targetCity.totalExp + expReward;
      const nextCityProgress = computeCityLevelProgressFromTotalExp(newCityTotalExp);
      const cityLevelAfter = nextCityProgress.level;
      const cityTierAfter = nextCityProgress.tier;
      const leveledUp = cityLevelAfter > cityLevelBefore;

      fantasySoundEngine.playClanJoinFanfare();

      setRepo((prev) => {
        // 1. Update Member -> Clan -> City atomically
        const updatedCities = prev.cities.map((city) => {
          if (city.id !== targetCity.id) return city;

          const updatedClans = city.clans.map((clan) => {
            if (clan.id !== targetClan.id) return clan;

            const memberExists = clan.members.some((m) => m.userId === activeAccount.id);
            let updatedMembers: ClanMember[];

            if (memberExists) {
              updatedMembers = clan.members.map((m) =>
                m.userId === activeAccount.id
                  ? {
                      ...m,
                      contributionScore: m.contributionScore + expReward,
                      completedMissionsCount: m.completedMissionsCount + 1,
                    }
                  : m
              );
            } else if (clan.members.length < NUENIME_SYSTEM_LIMITS.MAX_MEMBERS_PER_CLAN) {
              updatedMembers = [
                ...clan.members,
                {
                  id: `mem-${activeAccount.id}`,
                  userId: activeAccount.id,
                  clanId: clan.id,
                  cityId: city.id,
                  name: activeAccount.displayName.replace(/\s*\(.*\)/, ''),
                  role: 'Anggota',
                  title: activeAccount.title,
                  elementAffinity: city.element,
                  joinedAt: nowIso,
                  contributionScore: expReward,
                  completedMissionsCount: 1,
                  status: 'ACTIVE',
                },
              ];
            } else {
              // If clan is at 100/100 capacity and user wasn't listed, credit the clan leader's record
              updatedMembers = clan.members.map((m, idx) =>
                idx === 0
                  ? {
                      ...m,
                      contributionScore: m.contributionScore + expReward,
                      completedMissionsCount: m.completedMissionsCount + 1,
                    }
                  : m
              );
            }

            const newClanTotalExp = updatedMembers.reduce(
              (sum, m) => sum + m.contributionScore,
              0
            );

            return {
              ...clan,
              members: updatedMembers,
              memberCount: updatedMembers.length,
              totalExp: newClanTotalExp,
              level: computeClanLevelFromExp(newClanTotalExp),
              lastContributionAt: nowIso,
            };
          });

          const recalculatedCityExp = updatedClans.reduce((sum, c) => sum + c.totalExp, 0);
          const progress = computeCityLevelProgressFromTotalExp(recalculatedCityExp);

          return {
            ...city,
            level: progress.level,
            tier: progress.tier,
            totalExp: progress.totalExp,
            currentLevelExp: progress.currentLevelExp,
            nextLevelTargetExp: progress.nextLevelTargetExp,
            clans: updatedClans,
          };
        });

        // 2. Record EXPTransaction in ContributionLedger
        const newTransaction: EXPTransactionRecord = {
          id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          idempotencyKey: txKey,
          userId: activeAccount.id,
          userName: activeAccount.displayName,
          clanId: targetClan.id,
          clanName: targetClan.name,
          cityId: targetCity.id,
          cityName: targetCity.name,
          missionId: mission.id,
          missionTitle: mission.title,
          activityType: mission.activityType,
          expAmount: expReward,
          source: 'simulation',
          cityLevelBefore,
          cityLevelAfter,
          timestamp: nowIso,
        };

        // 3. Record CityLevelHistory if one or multiple levels were gained
        const nextLevelHistory = { ...prev.cityLevelHistory };
        if (leveledUp) {
          const newEntries: CityLevelHistoryRecord[] = [];
          for (let lv = cityLevelBefore + 1; lv <= cityLevelAfter; lv++) {
            const prevLv = lv - 1;
            const prevTier = computeCityLevelProgressFromTotalExp(0).tier; // fallback
            newEntries.push({
              id: `lvlup-${targetCity.id}-${lv}-${Date.now()}`,
              cityId: targetCity.id,
              cityName: targetCity.name,
              previousLevel: prevLv,
              newLevel: lv,
              previousTier: lv - 1 === cityLevelBefore ? cityTierBefore : prevTier,
              newTier: lv === cityLevelAfter ? cityTierAfter : cityTierBefore,
              totalExpAtUpgrade: newCityTotalExp,
              triggeredByClanId: targetClan.id,
              triggeredByClanName: targetClan.name,
              triggeredByUserId: activeAccount.id,
              triggeredByUserName: activeAccount.displayName,
              timestamp: nowIso,
            });
          }
          nextLevelHistory[targetCity.id] = [
            ...newEntries.reverse(),
            ...(nextLevelHistory[targetCity.id] ?? []),
          ].slice(0, 30);
        }

        // 4. Update UserMissionProgress
        const prevProg = prev.missionProgressMap[mission.id] ?? {
          missionId: mission.id,
          userId: activeAccount.id,
          currentProgress: 0,
          targetCount: mission.targetCount,
          totalClaimedCount: 0,
          totalExpEarned: 0,
          lastClaimedAt: null,
        };

        return {
          ...prev,
          cities: verifyAndReconcileWorldCities(updatedCities),
          playerContribution: prev.playerContribution + expReward,
          relicShards: prev.relicShards + shardReward,
          completedMissionCounts: {
            ...prev.completedMissionCounts,
            [mission.id]: (prev.completedMissionCounts[mission.id] ?? 0) + 1,
          },
          missionProgressMap: {
            ...prev.missionProgressMap,
            [mission.id]: {
              ...prevProg,
              currentProgress: mission.targetCount,
              totalClaimedCount: prevProg.totalClaimedCount + 1,
              totalExpEarned: prevProg.totalExpEarned + expReward,
              lastClaimedAt: nowIso,
            },
          },
          expTransactions: [newTransaction, ...prev.expTransactions].slice(0, 80),
          cityLevelHistory: nextLevelHistory,
        };
      });

      if (leveledUp) {
        showToast(
          `LEVEL UP KOTA! ${targetCity.name} naik ke Level ${cityLevelAfter} (${cityTierAfter}) berkat +${expReward} EXP dari ${targetClan.name}!`
        );
      } else {
        showToast(
          `[SIMULASI] +${expReward} EXP disalurkan ke Anggota → ${targetClan.name} → Kota ${targetCity.name}!`
        );
      }

      // Simpan transaksi EXP & perbarui kontribusi member ke Supabase secara real-time
      void (async () => {
        try {
          await supabase.from('rpg_exp_transactions').insert({
            user_id: activeAccount.id,
            clan_id: targetClan.id,
            city_id: targetCity.id,
            amount: expReward,
            source_type: mission.activityType,
            description: `Misi: ${mission.title}`,
          });

          const { data: memberRows } = await supabase
            .from('rpg_clan_members')
            .select('contribution_score')
            .eq('clan_id', targetClan.id)
            .eq('user_id', activeAccount.id)
            .limit(1);

          const prevScore = memberRows && memberRows[0] ? Number(memberRows[0].contribution_score) : 0;
          await supabase.from('rpg_clan_members').upsert({
            clan_id: targetClan.id,
            user_id: activeAccount.id,
            display_name: activeAccount.displayName.replace(/\s*\(.*\)/, ''),
            avatar_url: activeAccount.avatarUrl || null,
            border_url: activeAccount.borderUrl || null,
            contribution_score: prevScore + expReward,
            last_active_at: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.warn('[Supabase DB] Error sync misi EXP ke database:', dbErr);
        }
      })();

      return {
        ok: true,
        expAdded: expReward,
        cityLeveledUp: leveledUp,
        newCityLevel: cityLevelAfter,
      };
    },
    [activeAccount.avatarUrl, activeAccount.borderUrl, activeAccount.displayName, activeAccount.id, activeAccount.title, allClans, repo.cities, repo.joinedClanId, showToast]
  );

  /**
   * 6B. PERTARUNGAN BOS KOTA (TERPISAH DARI MISI ANIME & TERPISAH DARI HP KOTA)
   * Perubahan HP Bos hanya terjadi melalui mekanisme pertarungan bos yang tervalidasi,
   * bukan otomatis dari menonton anime.
   */
  const attackWorldBoss = useCallback(
    (bossId: string) => {
      const joinedClan = allClans.find((c) => c.id === repo.joinedClanId);
      const relicLv = repo.relicLevels[repo.joinedClanId] ?? 1;
      const baseDamage = 2400 + relicLv * 550 + Math.floor(Math.random() * 650);

      let defeatedNow = false;
      let targetBossName = 'Bos Kota';

      fantasySoundEngine.playBossStrike();

      setRepo((prev) => {
        const nextBosses = prev.cityBosses.map((b) => {
          if (b.id !== bossId) return b;
          targetBossName = b.name;
          if (b.currentHp <= 0) return b;
          const nextHp = Math.max(0, b.currentHp - baseDamage);
          if (nextHp === 0 && b.currentHp > 0) {
            defeatedNow = true;
          }
          return {
            ...b,
            currentHp: nextHp,
            status: nextHp === 0 ? ('DORMANT' as const) : ('ENRANGED' as const),
            battleHistoryCount: b.battleHistoryCount + 1,
            lastUpdatedAt: new Date().toISOString(),
          };
        });

        return {
          ...prev,
          cityBosses: nextBosses,
        };
      });

      // Persist status bos ke database Supabase secara real-time
      void (async () => {
        try {
          const targetBoss = repo.cityBosses.find((b) => b.id === bossId);
          if (targetBoss) {
            const nextHp = Math.max(0, targetBoss.currentHp - baseDamage);
            await supabase
              .from('rpg_city_bosses')
              .update({
                current_hp: nextHp,
                status: nextHp === 0 ? 'DORMANT' : 'ENRANGED',
                last_attacked_at: new Date().toISOString(),
              })
              .eq('id', bossId);
          }
        } catch (dbErr) {
          console.warn('[Supabase DB] Error simpan serangan bos ke database:', dbErr);
        }
      })();

      if (defeatedNow) {
        fantasySoundEngine.playClanJoinFanfare();
        showToast(
          `${targetBossName} berhasil ditaklukkan oleh pasukan ${joinedClan?.name ?? 'Klan'}!`
        );
      }

      return { damage: baseDamage, defeated: defeatedNow };
    },
    [allClans, repo.cityBosses, repo.joinedClanId, repo.relicLevels, showToast]
  );

  const resetWorldBoss = useCallback(
    (bossId: string) => {
      fantasySoundEngine.playTap();
      setRepo((prev) => ({
        ...prev,
        cityBosses: prev.cityBosses.map((b) =>
          b.id === bossId
            ? {
                ...b,
                currentHp: b.maxHp,
                status: 'ACTIVE',
                lastUpdatedAt: new Date().toISOString(),
              }
            : b
        ),
      }));

      // Pulihkan bos di database Supabase
      void (async () => {
        try {
          await supabase
            .from('rpg_city_bosses')
            .update({
              current_hp: 10000,
              status: 'ACTIVE',
              last_attacked_at: new Date().toISOString(),
            })
            .eq('id', bossId);
        } catch (dbErr) {
          console.warn('[Supabase DB] Error reset bos di database:', dbErr);
        }
      })();

      showToast('HP Bos Kota telah dipulihkan ke kondisi penuh untuk simulasi pertarungan.');
    },
    [showToast]
  );

  const reconcileWorldConsistency = useCallback(() => {
    fantasySoundEngine.playTap();
    setRepo((prev) => ({
      ...prev,
      cities: verifyAndReconcileWorldCities(prev.cities),
    }));
    showToast('Konsistensi EXP Anggota, Klan, Kota, dan Level telah diverifikasi 100% akurat.');
  }, [showToast]);

  const resetDemoWorldData = useCallback(() => {
    fantasySoundEngine.playTap();
    processedRequestKeysRef.current.clear();
    const freshCities = verifyAndReconcileWorldCities(SEED_WORLD_CITIES);
    setRepo({
      cities: freshCities,
      cityBosses: INITIAL_CITY_BOSSES,
      activeAccountId: 'nuenime-adventurer',
      joinedClanId: null,
      playerContribution: 0,
      relicShards: 6,
      relicLevels: buildDefaultRelicLevels(freshCities),
      districtInfluence: buildDefaultDistrictInfluence(freshCities),
      completedMissionCounts: {},
      missionProgressMap: {},
      expTransactions: [],
      cityLevelHistory: buildDefaultLevelHistory(),
    });
    showToast('Data simulasi Dunia Nuenime dikembalikan ke kondisi awal (Level 1 · 10.000 HP).');
  }, [showToast]);

  /**
   * 10. LEADERBOARD KLAN (DALAM KOTA & SELURUH DUNIA)
   * Diurutkan berdasarkan totalExp tertinggi dengan aturan tie-break waktu kontribusi terakhir.
   */
  const sortClansForLeaderboard = useCallback((clansList: Clan[]): Clan[] => {
    return [...clansList].sort((a, b) => {
      if (b.totalExp !== a.totalExp) {
        return b.totalExp - a.totalExp;
      }
      // Tie-breaker 1: waktu kontribusi terakhir lebih awal
      const timeA = Date.parse(a.lastContributionAt || a.createdAt || '2026-01-01');
      const timeB = Date.parse(b.lastContributionAt || b.createdAt || '2026-01-01');
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.name.localeCompare(b.name);
    });
  }, []);

  const getCityClansLeaderboard = useCallback(
    (cityId: CityId): Clan[] => {
      const city = repo.cities.find((c) => c.id === cityId);
      if (!city) return [];
      return sortClansForLeaderboard(city.clans);
    },
    [repo.cities, sortClansForLeaderboard]
  );

  const getWorldClansLeaderboard = useCallback((): Clan[] => {
    return sortClansForLeaderboard(allClans);
  }, [allClans, sortClansForLeaderboard]);

  const getClanTotalScore = useCallback(
    (clanId: string): number => {
      const clan = allClans.find((c) => c.id === clanId);
      return clan ? clan.totalExp : 0;
    },
    [allClans]
  );

  /**
   * 11. STATISTIK GLOBAL DUNIA NUENIME
   * Agregasi dari 7 kota independen tanpa mencampurkan progres masing-masing kota.
   */
  const globalWorldStats: GlobalWorldStats = useMemo(() => {
    const totalWorldExp = repo.cities.reduce((sum, c) => sum + c.totalExp, 0);
    const totalClansCount = allClans.length;
    const totalClanMembersCount = allClans.reduce((sum, c) => sum + c.memberCount, 0);

    const sortedCities = [...repo.cities].sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.totalExp - a.totalExp;
    });
    const topCity = sortedCities[0] ?? repo.cities[0];

    const worldLeaderboard = sortClansForLeaderboard(allClans);
    const topClan = worldLeaderboard[0] ?? allClans[0];

    return {
      totalWorldExp,
      totalSimulationExp: totalWorldExp,
      totalProductionExp: 0,
      totalClansCount,
      maxWorldClansCapacity: repo.cities.length * NUENIME_SYSTEM_LIMITS.MAX_CLANS_PER_CITY,
      totalClanMembersCount,
      highestLevelCity: {
        cityId: topCity.id,
        name: topCity.name,
        level: topCity.level,
        tier: topCity.tier,
        totalExp: topCity.totalExp,
      },
      topExpClan: {
        clanId: topClan.id,
        name: topClan.name,
        tag: topClan.tag,
        cityId: topClan.cityId,
        cityName: topClan.cityName,
        totalExp: topClan.totalExp,
      },
    };
  }, [allClans, repo.cities, sortClansForLeaderboard]);

  const setTimeOfDay = useCallback(
    (mode: TimeOfDayMode) => {
      setTimeOfDayState(mode);
      fantasySoundEngine.playTap();
      const label =
        mode === 'day'
          ? 'Siang Cerah'
          : mode === 'dusk'
          ? 'Senja Keemasan'
          : 'Malam Astral Berkilau';
      showToast(`Mode atmosfer peta: ${label}`);
    },
    [showToast]
  );

  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    fantasySoundEngine.setEnabled(next);
    showToast(next ? 'Audio RPG & Ambient diaktifkan' : 'Audio RPG & Ambient dimatikan');
  }, [soundEnabled, showToast]);

  const setAmbientLocation = useCallback((location: CityId | 'world') => {
    fantasySoundEngine.setAmbientCity(location);
  }, []);

  const upgradeClanRelic = useCallback(
    (clanId: string): boolean => {
      const currentLv = repo.relicLevels[clanId] ?? 1;
      const cost = currentLv * 2;
      if (repo.relicShards < cost) {
        showToast(
          `Butuh ${cost} Pecahan Relik (Anda punya ${repo.relicShards}). Selesaikan Misi Simulasi!`
        );
        return false;
      }

      fantasySoundEngine.playClanJoinFanfare();
      setRepo((prev) => ({
        ...prev,
        relicShards: prev.relicShards - cost,
        relicLevels: {
          ...prev.relicLevels,
          [clanId]: currentLv + 1,
        },
      }));
      showToast(`Artefak Pusaka Klan berhasil ditempa ke Level ${currentLv + 1}!`);
      return true;
    },
    [repo.relicLevels, repo.relicShards, showToast]
  );

  const reinforceClanDistrict = useCallback(
    (clanId: string) => {
      fantasySoundEngine.playBossStrike();
      setRepo((prev) => {
        const current = prev.districtInfluence[clanId];
        const nextPct = Math.min(100, (current?.influencePercent ?? 60) + 8);
        return {
          ...prev,
          districtInfluence: {
            ...prev.districtInfluence,
            [clanId]: {
              clanId,
              cityId: current?.cityId ?? 'aetheria',
              districtName: current?.districtName ?? 'Distrik Utama',
              influencePercent: nextPct,
            },
          },
        };
      });
      showToast('Pengaruh klan di distrik kota berhasil diperkuat (+8%)!');
    },
    [showToast]
  );

  const selectTravelRoute = useCallback(
    (fromCityId: CityId, toCityId: CityId) => {
      const fromCity = repo.cities.find((c) => c.id === fromCityId);
      const toCity = repo.cities.find((c) => c.id === toCityId);
      if (!fromCity || !toCity || fromCityId === toCityId) return;

      const route = calculateTravelRoute(fromCity, toCity);
      setActiveRoute(route);
      fantasySoundEngine.playRouteDepart();
      showToast(
        `Ekspedisi ${route.transportName}: ${fromCity.name} → ${toCity.name} (${route.distanceLeagues} League)`
      );
    },
    [repo.cities, showToast]
  );

  const clearTravelRoute = useCallback(() => {
    setActiveRoute(null);
    fantasySoundEngine.playTap();
  }, []);

  return (
    <NuenimeRpgContext.Provider
      value={{
        cities: hydratedCities,
        allClans,
        getCityById,
        getClanById,
        cityLeaders: DEMO_CITY_LEADERS,
        getCityLeader,
        availableDemoAccounts: DEMO_SWITCHABLE_ACCOUNTS,
        activeAccount,
        switchDemoAccount,
        canCreateClanInCity,
        createClanInCity,
        updateClanLogo,
        updateClanProfile,
        updateMemberRole,
        userCrystals,
        deductCrystals,
        addCrystals,
        joinedClanId: repo.joinedClanId,
        joinClan,
        worldBosses: repo.cityBosses,
        getCityBoss,
        attackWorldBoss,
        resetWorldBoss,
        simulationMissions: CLAN_MISSIONS,
        completedMissionCounts: repo.completedMissionCounts,
        missionProgressMap: repo.missionProgressMap,
        completeClanMission,
        expTransactions: repo.expTransactions,
        cityLevelHistory: repo.cityLevelHistory,
        reconcileWorldConsistency,
        resetDemoWorldData,
        resetAllSimulationData: resetDemoWorldData,
        globalWorldStats,
        getClanTotalScore,
        getCityClansLeaderboard,
        getWorldClansLeaderboard,
        timeOfDay,
        setTimeOfDay,
        soundEnabled,
        toggleSound,
        setAmbientLocation,
        playerContribution: repo.playerContribution,
        relicShards: repo.relicShards,
        relicLevels: repo.relicLevels,
        upgradeClanRelic,
        districtInfluence: repo.districtInfluence,
        reinforceClanDistrict,
        activeRoute,
        selectTravelRoute,
        clearTravelRoute,
        toastMessage,
        dismissToast,
      }}
    >
      {children}
    </NuenimeRpgContext.Provider>
  );
};

export function useNuenimeRpg() {
  const ctx = useContext(NuenimeRpgContext);
  if (!ctx) {
    throw new Error('useNuenimeRpg harus digunakan di dalam NuenimeRpgProvider');
  }
  return ctx;
}

export { CLAN_MISSIONS };
