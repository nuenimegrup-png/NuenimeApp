import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  COIN_TO_GEM_RATE,
  GACHA_SINGLE_COST,
  GACHA_TEN_COST,
  getEffectiveCoinsPerDay,
  getPetStageVisuals,
  ISLAND_THEMES_LIST,
  IslandThemeId,
  LivePetTelemetry,
  MAX_ISLAND_PETS,
  OwnedPetInstance,
  PET_SPECIES_CATALOG,
  PET_SPECIES_LIST,
  PetSpeciesId,
  SKY_ATMOSPHERES_LIST,
  SkyAtmosphereId,
  TimeOfDay,
} from './types/pet';
import { soundFX } from './utils/sound';
import { PerformanceMode, SanctuaryCanvas } from './components/SanctuaryCanvas';
import { GachaEggModal, GoldenEggIcon } from './components/GachaEggModal';
import { ManageIslandDrawer } from './components/ManageIslandDrawer';
import { PetCatalogDrawer } from './components/PetCatalogDrawer';
import { ArchitectureGuideDrawer } from './components/ArchitectureGuideDrawer';
import { LoadingScreen } from './components/LoadingScreen';
import { CoinConverterModal } from './components/CoinConverterModal';
import {
  syncNuePetAccount,
  claimPassiveCoins,
  convertCoinsToCrystals,
  performGachaWithCrystals,
  saveNuePetState,
  claimChestReward,
} from './services/nuepetService';

const CHEST_COOLDOWN_MS = 7 * 60 * 60 * 1000; // 7 Jam (25.200.000 ms)
const getChestStorageKey = (uid?: string) =>
  uid && uid !== 'guest'
    ? `nuepet_chest_${uid}_next_claim`
    : 'nuepet_chest_guest_next_claim';

function formatCountdownHMS(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((val) => String(val).padStart(2, '0'))
    .join(':');
}

interface ChestRewardResult {
  crystals: number;
  coins: number;
  claimedAt: number;
}

interface FloatingTapBadge {
  id: number;
  x: number;
  y: number;
  coins: number;
  nickname: string;
}

interface SuctionCoinParticle {
  id: number;
  startX: number;
  startY: number;
}

const INITIAL_PETS: OwnedPetInstance[] = [];

export default function App() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [coins, setCoins] = useState<number>(0);
  const [gems, setGems] = useState<number>(0);
  const [unclaimedCoins, setUnclaimedCoins] = useState<number>(0);

  const [ownedPets, setOwnedPets] = useState<OwnedPetInstance[]>([]);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
  const [activeSkyId, setActiveSkyId] =
    useState<SkyAtmosphereId>('siang_cerah');
  const [unlockedSkyIds, setUnlockedSkyIds] = useState<SkyAtmosphereId[]>([
    'siang_cerah',
  ]);

  const [activeIslandId, setActiveIslandId] =
    useState<IslandThemeId>('dc_island_1');
  const [unlockedIslandIds, setUnlockedIslandIds] = useState<IslandThemeId[]>([
    'dc_island_1',
  ]);

  const [performanceMode, setPerformanceMode] =
    useState<PerformanceMode>('potato');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [cameraResetTrigger, setCameraResetTrigger] = useState<number>(0);

  // 7-Hour Treasure Chest countdown state (Reset cooldown agar pengguna dapat langsung membuka dan mengklaim hadiah)
  const [chestNextClaimAt, setChestNextClaimAt] = useState<number>(() => {
    try {
      localStorage.removeItem(CHEST_STORAGE_KEY);
    } catch {}
    return 0; // Siap langsung dibuka!
  });
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [lastChestReward, setLastChestReward] =
    useState<ChestRewardResult | null>(null);
  const [chestAnimStage, setChestAnimStage] = useState<
    'shaking' | 'burst' | 'revealed'
  >('revealed');

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [userId, setUserId] = useState<string>('guest');

  // Sinkronisasi data akun dari Supabase (Setiap akun punya data dan koin sendiri)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const uid = urlParams.get('uid') || 'guest';
      setUserId(uid);

      if (uid && uid !== 'guest') {
        syncNuePetAccount(uid).then((data) => {
          if (data) {
            setCoins(data.coins);
            setGems(data.crystals);
            setActiveIslandId(data.activeIslandId);
            setActiveSkyId(data.activeSkyId);
            setUnlockedIslandIds(data.unlockedIslandIds);
            setUnlockedSkyIds(data.unlockedSkyIds);
            setOwnedPets(data.pets || []);

            // Hitung akumulasi koin offline presisi harian (1 hari = 86.400 detik)
            if (data.lastClaimAt) {
              const elapsedSec = Math.max(0, (Date.now() - data.lastClaimAt) / 1000);
              const activePets = data.pets || [];
              const totalDailyRate = activePets
                .filter((p) => p.isDeployed)
                .reduce(
                  (sum, p) =>
                    sum +
                    getEffectiveCoinsPerDay(
                      p.speciesId,
                      p.star || 1,
                      data.activeIslandId
                    ),
                  0
                );
              const offlineCoins = Math.floor(
                (elapsedSec / 86400) * totalDailyRate
              );
              setUnclaimedCoins(offlineCoins);
            }

            // Sinkronisasi status cooldown peti dari database (jika null, peti siap dibuka)
            if (data.lastChestClaimAt) {
              const nextClaim = data.lastChestClaimAt + CHEST_COOLDOWN_MS;
              if (Date.now() < nextClaim) {
                setChestNextClaimAt(nextClaim);
              } else {
                setChestNextClaimAt(0);
              }
            } else {
              setChestNextClaimAt(0);
            }
          }
        });
      } else {
        const urlCrystals = urlParams.get('crystals');
        if (urlCrystals) {
          const parsed = parseInt(urlCrystals, 10);
          if (!isNaN(parsed) && parsed >= 0) {
            setGems(parsed);
          }
        }

        // Akumulasi koin pasif offline untuk mode tamu (localStorage)
        try {
          const savedClaim = localStorage.getItem('nuepet_guest_last_claim_at');
          if (savedClaim) {
            const lastTime = Number(savedClaim);
            if (!isNaN(lastTime)) {
              const elapsedSec = Math.max(0, (Date.now() - lastTime) / 1000);
              const totalDailyRate = INITIAL_PETS
                .filter((p) => p.isDeployed)
                .reduce(
                  (sum, p) =>
                    sum + getEffectiveCoinsPerDay(p.speciesId, p.star || 1, 'dc_island_1'),
                  0
                );
              const offlineCoins = Math.floor((elapsedSec / 86400) * totalDailyRate);
              setUnclaimedCoins(offlineCoins);
            }
          } else {
            localStorage.setItem('nuepet_guest_last_claim_at', String(Date.now()));
          }
        } catch {}
      }
    } catch {}
  }, []);

  // Sinkronisasi pembaruan Crystal dari parent webview
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (
          data &&
          data.type === 'UPDATE_CRYSTALS' &&
          typeof data.crystals === 'number'
        ) {
          setGems(data.crystals);
        }
      } catch {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const chestRemainingMs = Math.max(0, chestNextClaimAt - nowMs);
  const isChestReady = chestRemainingMs <= 0;

  // Active modals / drawers
  const [activeModal, setActiveModal] = useState<
    | 'none'
    | 'gacha'
    | 'manage'
    | 'catalog'
    | 'architecture'
    | 'converter'
    | 'chest'
  >('none');

  // Live FSM AI telemetry for the Architecture Inspector
  const [liveTelemetry, setLiveTelemetry] = useState<LivePetTelemetry[]>([]);

  // Floating tap feedback & coin claim suction animations
  const [tapBadges, setTapBadges] = useState<FloatingTapBadge[]>([]);
  const [suctionCoins, setSuctionCoins] = useState<SuctionCoinParticle[]>([]);

  const deployedPets = useMemo(
    () => ownedPets.filter((p) => p.isDeployed),
    [ownedPets]
  );

  const handlePetTapped = useCallback(
    (
      _instanceId: string,
      _bonusCoins: number,
      screenX: number,
      screenY: number,
      nickname: string
    ) => {
      soundFX.playPetTap();
      // TIDAK ADA penambahan koin saat klik pet (koin hanya bertambah dari rate pasif harian)

      const badgeId = Date.now() + Math.random();
      setTapBadges((prev) => [
        ...prev,
        { id: badgeId, x: screenX, y: screenY, coins: 0, nickname },
      ]);
      setTimeout(() => {
        setTapBadges((prev) => prev.filter((b) => b.id !== badgeId));
      }, 1150);
    },
    []
  );

  const handlePassiveCoinTick = useCallback((coinsEarned: number) => {
    setUnclaimedCoins((prev) => prev + coinsEarned);
  }, []);

  const handleClaimAllCoins = () => {
    if (unclaimedCoins <= 0) return;
    soundFX.playCoinClaim();

    const batch: SuctionCoinParticle[] = Array.from({ length: 10 }).map(
      (_, i) => ({
        id: Date.now() + i,
        startX: window.innerWidth * (0.35 + Math.random() * 0.3),
        startY: window.innerHeight * (0.42 + Math.random() * 0.18),
      })
    );
    setSuctionCoins(batch);

    const amountToClaim = unclaimedCoins;
    setUnclaimedCoins(0);

    setTimeout(() => {
      setCoins((prev) => prev + amountToClaim);
      setSuctionCoins([]);

      // Sinkronkan klaim koin ke Supabase database
      if (userId && userId !== 'guest') {
        claimPassiveCoins(userId, amountToClaim).then((res) => {
          if (res) {
            setCoins(res.newTotalCoins);
          }
        });
      } else {
        try {
          localStorage.setItem('nuepet_guest_last_claim_at', String(Date.now()));
        } catch {}
      }
    }, 520);
  };

  const rollSingleGachaSpecies = (): PetSpeciesId => {
    const totalWeight = PET_SPECIES_LIST.reduce(
      (sum, s) => sum + s.gachaWeight,
      0
    );
    const roll = Math.random() * totalWeight;
    let cumulative = 0;
    for (const spec of PET_SPECIES_LIST) {
      cumulative += spec.gachaWeight;
      if (roll <= cumulative) {
        return spec.id;
      }
    }
    return PetSpeciesId.CERUH_DRAGON;
  };

  const handlePerformGacha = (count: 1 | 10): PetSpeciesId[] | null => {
    const cost = count === 1 ? GACHA_SINGLE_COST : GACHA_TEN_COST;
    if (gems < cost) return null;

    setGems((prev) => prev - cost);
    const results: PetSpeciesId[] = [];
    const newInstances: OwnedPetInstance[] = [];

    let currentDeployedCount = ownedPets.filter((p) => p.isDeployed).length;

    for (let i = 0; i < count; i++) {
      const speciesId = rollSingleGachaSpecies();
      results.push(speciesId);
      const spec = PET_SPECIES_CATALOG[speciesId];
      const shouldAutoDeploy = currentDeployedCount < MAX_ISLAND_PETS;
      if (shouldAutoDeploy) currentDeployedCount++;

      newInstances.push({
        instanceId: `pet_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        speciesId,
        nickname: `${spec.name} #${ownedPets.length + i + 1}`,
        obtainedAt: Date.now(),
        level: 1,
        star: 1,
        isDeployed: shouldAutoDeploy,
        totalCoinsProduced: 0,
      });
    }

    const updatedPets = [...ownedPets, ...newInstances];
    setOwnedPets(updatedPets);

    // Sinkronkan hasil draw gacha ke database Supabase (potong Crystal akun & simpan pet)
    if (userId && userId !== 'guest') {
      performGachaWithCrystals(userId, count, newInstances)
        .then((res) => {
          if (res) {
            setGems(res.newTotalCrystals);
          }
        })
        .catch((err) => {
          console.warn('Gagal sinkron gacha ke server:', err);
        });
    }

    return results;
  };

  const handleToggleDeploy = (instanceId: string) => {
    setOwnedPets((prev) => {
      const target = prev.find((p) => p.instanceId === instanceId);
      if (!target) return prev;

      const currentActive = prev.filter((p) => p.isDeployed).length;
      if (!target.isDeployed && currentActive >= MAX_ISLAND_PETS) {
        return prev;
      }

      return prev.map((p) =>
        p.instanceId === instanceId ? { ...p, isDeployed: !p.isDeployed } : p
      );
    });
  };

  const handleAutoDeployBest = () => {
    setOwnedPets((prev) => {
      const sorted = [...prev].sort(
        (a, b) =>
          getEffectiveCoinsPerDay(b.speciesId, b.star || 1, activeIslandId) -
          getEffectiveCoinsPerDay(a.speciesId, a.star || 1, activeIslandId)
      );
      const topIds = new Set(
        sorted.slice(0, MAX_ISLAND_PETS).map((p) => p.instanceId)
      );
      return prev.map((p) => ({
        ...p,
        isDeployed: topIds.has(p.instanceId),
      }));
    });
  };

  /**
   * Sistem Evolusi / Merge Bintang (3x Pet Kembar -> ★2 atau ★3 dengan ukuran lebih besar & koin 2x lipat)
   */
  const handleMergeSpecies = (speciesId: PetSpeciesId, targetStar: number) => {
    const sourceStar = targetStar - 1;
    setOwnedPets((prev) => {
      const candidates = prev.filter(
        (p) => p.speciesId === speciesId && (p.star || 1) === sourceStar
      );
      if (candidates.length < 3) return prev;

      // Keep the first candidate (prefer one already deployed) and consume the other 2
      const sortedCandidates = [...candidates].sort(
        (a, b) => Number(b.isDeployed) - Number(a.isDeployed)
      );
      const keeper = sortedCandidates[0];
      const consumedIds = new Set([
        sortedCandidates[1].instanceId,
        sortedCandidates[2].instanceId,
      ]);
      const anyDeployed = sortedCandidates
        .slice(0, 3)
        .some((c) => c.isDeployed);

      return prev
        .filter((p) => !consumedIds.has(p.instanceId))
        .map((p) =>
          p.instanceId === keeper.instanceId
            ? {
                ...p,
                star: targetStar,
                level: p.level + 1,
                isDeployed: p.isDeployed || anyDeployed,
              }
            : p
        );
    });
  };

  /**
   * Upgrade / Evolusi Level pet (Biaya: 500 Koin, langsung Max permanen tanpa reset)
   */
  const handleDirectStarUpgrade = (instanceId: string) => {
    const target = ownedPets.find((p) => p.instanceId === instanceId);
    if (!target) return;
    const visuals = getPetStageVisuals(target.speciesId, 1);
    if (!visuals.hasEvolution) return;

    const currentStar = Math.max(target.star || 1, target.level || 1);
    // Jika sudah Lv.2 atau lebih, langsung Max permanen (tidak ada reset ke Lv.1 lagi)
    if (currentStar >= 2) return;

    // Periksa saldo koin (harus minimal 500 koin)
    if (coins < 500) return;

    soundFX.playCoinClaim();
    const newCoins = coins - 500;
    setCoins(newCoins);

    const nextPets = ownedPets.map((p) =>
      p.instanceId === instanceId
        ? { ...p, star: 2, level: 2 }
        : p
    );
    setOwnedPets(nextPets);

    // Sinkronkan ke Supabase jika login
    if (userId && userId !== 'guest') {
      saveNuePetState(
        userId,
        newCoins,
        activeIslandId,
        activeSkyId,
        unlockedIslandIds,
        unlockedSkyIds,
        nextPets
      );
    }
  };

  /**
   * Mengubah form/level seluruh pet dari spesies tertentu (misal dari Katalog Pet: Lv.1 Bayi <-> Lv.2 Bersayap)
   */
  const handleEvolveSpeciesStage = (
    speciesId: PetSpeciesId,
    targetStage: number
  ) => {
    setOwnedPets((prev) =>
      prev.map((p) =>
        p.speciesId === speciesId
          ? { ...p, star: targetStage, level: targetStage }
          : p
      )
    );
  };

  const handleSelectSky = (skyId: SkyAtmosphereId) => {
    const config = SKY_ATMOSPHERES_LIST.find((s) => s.id === skyId);
    if (!config) return;

    if (!unlockedSkyIds.includes(skyId)) {
      if (coins >= config.price) {
        setCoins((prev) => prev - config.price);
      }
      setUnlockedSkyIds((prev) => [...prev, skyId]);
    }
    setActiveSkyId(skyId);
    setTimeOfDay(config.timeOfDayMapping);
  };

  const handleSelectIsland = (islandId: IslandThemeId) => {
    const config = ISLAND_THEMES_LIST.find((i) => i.id === islandId);
    if (!config) return;

    if (!unlockedIslandIds.includes(islandId)) {
      if (coins >= config.price) {
        setCoins((prev) => prev - config.price);
      }
      setUnlockedIslandIds((prev) => [...prev, islandId]);
    }
    setActiveIslandId(islandId);

    if (islandId === 'abyss_void') {
      setTimeOfDay('night');
      setActiveSkyId('luar_angkasa');
    } else if (islandId === 'inferno_hell') {
      setTimeOfDay('sunset');
      setActiveSkyId('akatsuki');
    }
  };

  // Konversi Koin ke Crystal: 50.000 Koin = 5.000 Crystal (Rasio 10:1)
  const handleConvertCoins = async (coinsToConvert: number) => {
    if (userId && userId !== 'guest') {
      const res = await convertCoinsToCrystals(userId, coinsToConvert);
      if (res) {
        setCoins(res.newTotalCoins);
        setGems(res.newTotalCrystals);
        return { crystalsGained: res.crystalsGained };
      }
    } else {
      // Fallback offline jika tanpa login
      const gained = Math.floor(coinsToConvert / COIN_TO_GEM_RATE);
      setCoins((prev) => prev - coinsToConvert);
      setGems((prev) => prev + gained);
      return { crystalsGained: gained };
    }
  };

  /**
   * Klaim Peti Harta 7 Jam: Hanya dijalankan saat waktu cooldown sudah habis (isChestReady).
   * Menampilkan animasi peti bergetar -> ledakan efek cahaya ("DUAAR!")
   * -> baru muncul hadiah Crystal & Koin, lalu user menekan 'Ambil Hadiah!' untuk mengklaim.
   */
  const handleClaimTreasureChest = () => {
    const bonusCrystals = 250 + Math.floor(Math.random() * 7) * 50; // +250 s/d +550 Crystal ✦
    const bonusCoins = 400 + Math.floor(Math.random() * 9) * 50; // +400 s/d +800 Koin 🪙

    setActiveModal('chest');
    setChestAnimStage('shaking');
    soundFX.playEggCrack();

    // Tahap 2: Efek ledakan ("DUAAR!") setelah peti bergetar
    window.setTimeout(() => {
      setChestAnimStage('burst');
      soundFX.playHatchFanfare('legendary');
      soundFX.playCoinClaim();

      setLastChestReward({
        crystals: bonusCrystals,
        coins: bonusCoins,
        claimedAt: Date.now(),
      });

      // Spawn flying celebratory particles
      const batch: SuctionCoinParticle[] = Array.from({ length: 14 }).map(
        (_, i) => ({
          id: Date.now() + i,
          startX: window.innerWidth * (0.3 + Math.random() * 0.4),
          startY: window.innerHeight * (0.35 + Math.random() * 0.25),
        })
      );
      setSuctionCoins(batch);
      window.setTimeout(() => {
        setSuctionCoins([]);
      }, 650);
    }, 950);

    // Tahap 3: Muncul hadiah Crystal & Koin setelah efek ledakan
    window.setTimeout(() => {
      setChestAnimStage('revealed');
    }, 1350);
  };

  /**
   * User menekan tombol 'Ambil Hadiah!': Saldo bertambah & cooldown 7 jam dimulai
   */
  const handleCollectChestReward = () => {
    if (!lastChestReward) {
      setActiveModal('none');
      return;
    }
    const nextClaimTimestamp = Date.now() + CHEST_COOLDOWN_MS;
    const addCrystals = lastChestReward.crystals;
    const addCoins = lastChestReward.coins;

    soundFX.playCoinClaim();
    setChestNextClaimAt(nextClaimTimestamp);
    setNowMs(Date.now());
    setLastChestReward(null);

    try {
      localStorage.setItem(getChestStorageKey(userId), String(nextClaimTimestamp));
    } catch {}

    // Update state koin & crystal lokal seketika
    setGems((prev) => prev + addCrystals);
    setCoins((prev) => prev + addCoins);

    // Sinkronkan hadiah secara riil ke database Supabase (Crystal masuk ke user_balances, Koin ke nuepet_user_states)
    if (userId && userId !== 'guest') {
      claimChestReward(userId, addCrystals, addCoins)
        .then((res) => {
          if (res) {
            setGems(res.newTotalCrystals);
            setCoins(res.newTotalCoins);
            if (res.nextClaimAt) {
              setChestNextClaimAt(res.nextClaimAt);
              try {
                localStorage.setItem(getChestStorageKey(userId), String(res.nextClaimAt));
              } catch {}
            }
          }
        })
        .catch((err) => {
          console.warn('Gagal sinkron hadiah peti ke server:', err);
        });
    }

    setActiveModal('none');
  };

  const handleChestWidgetClick = () => {
    if (isChestReady) {
      handleClaimTreasureChest();
    } else {
      soundFX.playUiClick();
      setChestAnimStage('revealed');
      setActiveModal('chest');
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFX.enabled = next;
    if (next) soundFX.playUiClick();
  };

  const activeSkyConfig =
    SKY_ATMOSPHERES_LIST.find((s) => s.id === activeSkyId) ||
    SKY_ATMOSPHERES_LIST[0];

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden bg-gradient-to-b ${activeSkyConfig.skyGradientClass} transition-colors duration-700 font-['Plus_Jakarta_Sans'] select-none`}
    >
      {/* Initial Game Loading Screen (Preloads 3D Island & Dragon Sprites) */}
      {isLoading && <LoadingScreen onFinished={() => setIsLoading(false)} />}

      {/* Zero-blur radial-gradient cloud layers (0% mobile GPU filter cost) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-10 left-[10%] w-72 h-28 rounded-full transition-opacity duration-700 ${
            timeOfDay === 'night'
              ? 'bg-[radial-gradient(closest-side,rgba(165,180,252,0.18),transparent)]'
              : 'bg-[radial-gradient(closest-side,rgba(255,255,255,0.42),transparent)]'
          }`}
        />
        <div
          className={`absolute top-20 right-[12%] w-80 h-32 rounded-full transition-opacity duration-700 ${
            timeOfDay === 'night'
              ? 'bg-[radial-gradient(closest-side,rgba(165,180,252,0.16),transparent)]'
              : 'bg-[radial-gradient(closest-side,rgba(255,255,255,0.36),transparent)]'
          }`}
        />
      </div>

      {/* 100% Unobstructed 3D Floating Island Viewport */}
      <main className="relative z-10 w-full h-full">
        <SanctuaryCanvas
          deployedPets={deployedPets}
          timeOfDay={timeOfDay}
          islandThemeId={activeIslandId}
          performanceMode={performanceMode}
          telemetryEnabled={activeModal === 'architecture'}
          cameraResetTrigger={cameraResetTrigger}
          onPetTapped={handlePetTapped}
          onPassiveCoinTick={handlePassiveCoinTick}
          onTelemetryUpdate={setLiveTelemetry}
        />
      </main>

      {/* Floating Pet Tap Reaction Badges (+Koin & Heart) */}
      <div className="fixed inset-0 pointer-events-none z-30">
        {tapBadges.map((b) => (
          <div
            key={b.id}
            style={{ left: b.x, top: b.y }}
            className="absolute -translate-x-1/2 -translate-y-full animate-bounce bg-white/95 border border-amber-300 px-3 py-1 rounded-2xl shadow-lg flex items-center gap-1.5"
          >
            <span className="text-rose-500 text-xs font-bold">♥</span>
            <span className="font-['Fredoka'] text-xs font-bold text-slate-800">
              {b.nickname}
            </span>
          </div>
        ))}

        {/* Flying Suction Coins when "Klaim Semua" is pressed */}
        {suctionCoins.map((c) => (
          <div
            key={c.id}
            style={{
              left: c.startX,
              top: c.startY,
              transform: 'translate(0, -260px) scale(0.5)',
              transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="w-6 h-6 rounded-full bg-gradient-to-b from-yellow-300 to-amber-500 border-2 border-white shadow-md flex items-center justify-center text-[10px] font-bold text-amber-950"
          >
            ✦
          </div>
        ))}
      </div>

      {/* TOP BAR HUD (NuePet Zoo Brand + Economy Controls) */}
      {!zenMode && (
        <header className="fixed top-0 left-0 right-0 z-50 px-2.5 sm:px-6 pt-2.5 pb-2 pointer-events-none">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-1.5 pointer-events-auto">
            {/* Left: Brand Title & Audio Toggle */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-['Fredoka'] text-xl sm:text-3xl font-bold tracking-tight text-slate-800 drop-shadow-xs whitespace-nowrap">
                NuePet Zoo
              </h1>

              <button
                onClick={toggleSound}
                title={soundEnabled ? 'Matikan Suara' : 'Nyalakan Suara'}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white border border-white shadow-md flex items-center justify-center text-slate-700 transition-transform active:scale-95 shrink-0"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-slate-700" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>

            {/* Right: "Klaim Semua" Button + Gem Counter matching reference screenshot */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={handleClaimAllCoins}
                className={`h-10 sm:h-11 px-2.5 sm:px-3.5 rounded-full border shadow-md flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 ${
                  unclaimedCoins > 0
                    ? 'bg-[#D6C79C]/95 hover:bg-[#CBB886] border-amber-200/90 text-slate-800 cursor-pointer'
                    : 'bg-[#D6C79C]/75 border-white/60 text-slate-600'
                }`}
              >
                <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-yellow-200 to-amber-500 border border-white shadow-inner inline-block shrink-0" />
                <span className="text-[11px] sm:text-sm font-bold whitespace-nowrap">
                  Klaim Semua
                </span>
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-[#A17C6B] text-white font-mono tabular-nums text-[10px] sm:text-xs font-bold">
                  {unclaimedCoins}
                </span>
              </button>

              {/* Koin Counter Pill (Menampilkan Jumlah Koin Pengguna) */}
              <button
                onClick={() => {
                  soundFX.playUiClick();
                  setActiveModal('converter');
                }}
                title="Jumlah Koin Anda (Klik untuk Tukar Koin ke Crystal)"
                className="h-10 sm:h-11 px-3 sm:px-4 rounded-full bg-[#4AA9DF] hover:bg-[#3898D0] border-2 border-sky-200 shadow-md flex items-center gap-1.5 text-white font-bold transition-transform active:scale-95 cursor-pointer"
              >
                <span className="text-xs sm:text-sm">🪙</span>
                <span className="font-mono tabular-nums text-xs sm:text-sm">
                  {coins.toLocaleString('id-ID')}
                </span>
              </button>
            </div>
          </div>

          {/* SECOND ROW HUD: Pure Treasure Chest (no background) + Countdown directly below (no background) */}
          {activeModal === 'none' && (
            <div className="max-w-5xl mx-auto mt-1 flex items-start justify-start pointer-events-none">
              <button
                onClick={handleChestWidgetClick}
                title="Peti Harta Karun (Hadiah Crystal & Koin setiap 7 Jam)"
                className="pointer-events-auto group relative flex flex-col items-center bg-transparent border-0 shadow-none p-0 focus:outline-none transition-transform active:scale-90"
              >
                {/* Pure Animated Treasure Chest Sprite (Tanpa Background Kotak) */}
                <div className="relative flex items-center justify-center">
                  {isChestReady && (
                    <span className="absolute -top-0.5 right-0 z-10 w-4 h-4 rounded-full bg-rose-500 border-2 border-white text-[9px] font-black text-white flex items-center justify-center animate-bounce shadow-sm">
                      !
                    </span>
                  )}
                  <img
                    src="/assets/pets/treasure_chest.gif"
                    alt="Peti Harta NuePet Zoo"
                    className={`w-13 h-13 sm:w-15 sm:h-15 object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.38)] group-hover:scale-110 transition-transform ${
                      isChestReady ? 'animate-bounce' : ''
                    }`}
                  />
                </div>

                {/* Waktu Hitung Mundur 7 Jam di Bawah Peti (Tanpa Background) */}
                {isChestReady ? (
                  <span className="-mt-1 font-['Fredoka'] text-[11px] sm:text-xs font-extrabold tracking-wide text-amber-300 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)] animate-pulse">
                    BUKA!
                  </span>
                ) : (
                  <span className="-mt-1 font-mono tabular-nums text-[11px] sm:text-xs font-black tracking-tight text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]">
                    {formatCountdownHMS(chestRemainingMs)}
                  </span>
                )}
              </button>
            </div>
          )}
        </header>
      )}

      {/* Floating Quick Controls (Always visible on mobile & desktop: Hemat Energi / HD + Reset Kamera + Mode Zen) */}
      {activeModal === 'none' && (
        <div className="fixed top-15 right-2.5 sm:right-6 z-40 flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => {
              soundFX.playUiClick();
              setPerformanceMode((prev) =>
                prev === 'potato' ? 'hd' : 'potato'
              );
            }}
            title="Ubah Mode Grafis: Hemat Energi (Anti-Lag 60FPS) atau HD"
            className={`h-8 px-3 rounded-xl border shadow-sm flex items-center gap-1.5 text-[11px] font-extrabold transition-all active:scale-95 ${
              performanceMode === 'potato'
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-300'
                : 'bg-sky-500 hover:bg-sky-600 text-white border-sky-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>
              {performanceMode === 'potato' ? 'Hemat Energi' : 'Mode HD'}
            </span>
          </button>

          <button
            onClick={() => {
              soundFX.playUiClick();
              setCameraResetTrigger((c) => c + 1);
            }}
            title="Reset Sudut Kamera Isometrik"
            className="w-8 h-8 rounded-xl bg-white/90 hover:bg-white border border-slate-200/80 shadow-sm flex items-center justify-center text-slate-700 transition-transform active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              soundFX.playUiClick();
              setZenMode((z) => !z);
            }}
            title={zenMode ? 'Tampilkan Navigasi' : 'Mode Zen (Sembunyikan UI)'}
            className="w-8 h-8 rounded-xl bg-white/90 hover:bg-white border border-slate-200/80 shadow-sm flex items-center justify-center text-slate-700 transition-transform active:scale-95"
          >
            {zenMode ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}

      {/* UNIFIED BOTTOM NAVIGATION DOCK (Solid base container so nothing bleeds through at the bottom) */}
      {!zenMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-2.5 pb-2.5 pt-1.5 bg-gradient-to-t from-[#DCEFFB] via-[#DCEFFB]/95 to-transparent pointer-events-none flex justify-center">
          <nav
            aria-label="Navigasi Utama NuePet Zoo"
            className="pointer-events-auto w-full max-w-md rounded-[24px] bg-[#EBF6FE] border-2 border-white shadow-xl p-1.5 flex items-center gap-2"
          >
            {/* 1. GACHA (Purple Button with True Tapered Golden Dragon Egg SVG Icon) */}
            <button
              onClick={() => {
                soundFX.playUiClick();
                setActiveModal((m) => (m === 'gacha' ? 'none' : 'gacha'));
              }}
              className="flex-1 h-13 sm:h-14 rounded-2xl bg-gradient-to-b from-[#9B4DFF] to-[#7C2AE8] hover:from-[#A855F7] hover:to-[#7E22CE] active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 px-2.5 text-white"
            >
              <GoldenEggIcon className="w-6 h-7 sm:w-6.5 sm:h-7.5" />
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-xs sm:text-sm tracking-wide whitespace-nowrap">
                Gacha
              </span>
            </button>

            {/* 2. KELOLA PULAU (Teal-Green Button with Pet Icon, X/15 Quota Pill & Red Badge) */}
            <button
              onClick={() => {
                soundFX.playUiClick();
                setActiveModal((m) => (m === 'manage' ? 'none' : 'manage'));
              }}
              className="relative flex-[1.3] h-13 sm:h-14 rounded-2xl bg-gradient-to-b from-[#26B99A] to-[#149E78] hover:from-[#14B8A6] hover:to-[#0F766E] active:scale-[0.98] transition-all shadow-md flex items-center justify-between px-2.5 text-white"
            >
              <div className="flex items-center gap-1 min-w-0">
                <img
                  src={PET_SPECIES_CATALOG[PetSpeciesId.CERUH_DRAGON].gifUrl}
                  alt="Kelola"
                  className="w-8 h-8 sm:w-9 sm:h-9 object-contain -ml-1 shrink-0"
                />
                <span className="font-['Plus_Jakarta_Sans'] font-bold text-xs sm:text-sm tracking-wide truncate">
                  Kelola
                </span>
              </div>

              <div className="relative shrink-0">
                <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white text-slate-800 font-mono tabular-nums text-[11px] sm:text-xs font-extrabold shadow-xs block">
                  {deployedPets.length}/{MAX_ISLAND_PETS}
                </span>
                <span className="absolute -top-2 -right-1.5 w-4.5 h-4.5 rounded-full bg-[#EF4444] border-2 border-white text-white text-[9px] font-extrabold flex items-center justify-center shadow-xs">
                  {ownedPets.length - deployedPets.length}
                </span>
              </div>
            </button>

            {/* 3. KATALOG PET (Clean White Card Button with Purple Book Icon) */}
            <button
              onClick={() => {
                soundFX.playUiClick();
                setActiveModal((m) => (m === 'catalog' ? 'none' : 'catalog'));
              }}
              className="w-22 sm:w-26 h-13 sm:h-14 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.98] transition-all border border-slate-200/90 shadow-sm flex flex-col items-center justify-center text-slate-800 shrink-0"
            >
              <BookOpen className="w-4.5 h-4.5 text-[#8B5CF6]" />
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-[11px] sm:text-xs mt-0.5 whitespace-nowrap">
                Katalog
              </span>
            </button>
          </nav>
        </div>
      )}



      {/* 7-Hour Treasure Chest Opening Ceremony & Reward Modal */}
      {activeModal === 'chest' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          {!isChestReady ? (
            /* TAMPILAN COOLDOWN: Hanya Menampilkan Hitung Mundur Waktu, TANPA Data Hadiah */
            <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#FFFDF7] via-white to-[#F8FAFC] border-2 border-slate-200 shadow-2xl p-6 text-center space-y-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="w-28 h-28 mx-auto relative flex items-center justify-center">
                <img
                  src="/assets/pets/treasure_chest.gif"
                  alt="Peti Harta NuePet Zoo"
                  className="w-24 h-24 object-contain opacity-90 drop-shadow-md"
                />
              </div>

              <div>
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider">
                  ⏳ Cooldown 7 Jam
                </span>
                <h2 className="font-['Fredoka'] text-2xl font-bold text-slate-800 mt-1.5">
                  Peti Sedang Terkunci
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Peti sedang mengumpulkan harta karun. Tunggu hitung mundur selesai untuk membuka peti!
                </p>
              </div>

              {/* Countdown Timer Box - Menonjol & Rapi Tanpa Data Hadiah */}
              <div className="py-3 px-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col items-center">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  Waktu Tersisa Menuju Buka Peti
                </span>
                <span className="font-mono tabular-nums text-2xl sm:text-3xl font-black text-amber-900 mt-1 tracking-wider">
                  {formatCountdownHMS(chestRemainingMs)}
                </span>
              </div>

              <div className="pt-1">
                <button
                  onClick={() => {
                    soundFX.playUiClick();
                    setActiveModal('none');
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          ) : chestAnimStage !== 'revealed' ? (
            /* STAGE 1 & 2: Peti Bergetar -> Efek Ledakan Cahaya "DUAAR!" */
            <div className="relative flex flex-col items-center justify-center select-none pointer-events-none">
              {/* Spinning Golden Sunburst Rays behind the Chest */}
              <div
                className="absolute w-72 h-72 sm:w-88 sm:h-88 rounded-full animate-chest-rays"
                style={{
                  background:
                    'conic-gradient(from 0deg, rgba(251,191,36,0.55), transparent 25deg, rgba(250,204,21,0.6) 50deg, transparent 75deg, rgba(245,158,11,0.55) 100deg, transparent 125deg, rgba(251,191,36,0.6) 150deg, transparent 175deg, rgba(250,204,21,0.55) 200deg, transparent 225deg, rgba(245,158,11,0.6) 250deg, transparent 275deg, rgba(251,191,36,0.55) 300deg, transparent 325deg, rgba(250,204,21,0.6) 350deg, transparent 360deg)',
                }}
              />

              {/* Glowing Ambient Core Aura */}
              <div className="absolute w-56 h-56 sm:w-68 sm:h-68 rounded-full bg-radial from-amber-300/80 via-yellow-400/35 to-transparent blur-md animate-pulse" />

              {/* Burst Outward Particle Emblems */}
              {chestAnimStage === 'burst' && (
                <>
                  {[
                    { tx: '-100px', ty: '-90px', sym: '✦', col: 'text-sky-300' },
                    { tx: '110px', ty: '-85px', sym: '🪙', col: 'text-amber-300' },
                    { tx: '-130px', ty: '20px', sym: '✦', col: 'text-amber-200' },
                    { tx: '130px', ty: '30px', sym: '🪙', col: 'text-yellow-300' },
                    { tx: '-75px', ty: '105px', sym: '✦', col: 'text-sky-300' },
                    { tx: '85px', ty: '100px', sym: '🪙', col: 'text-amber-300' },
                    { tx: '0px', ty: '-130px', sym: '✨', col: 'text-white' },
                    { tx: '0px', ty: '125px', sym: '✨', col: 'text-amber-200' },
                  ].map((p, idx) => (
                    <span
                      key={idx}
                      style={{
                        transform: `translate(${p.tx}, ${p.ty}) scale(1.35)`,
                        transition: 'all 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                      className={`absolute text-2xl sm:text-3xl font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] ${p.col}`}
                    >
                      {p.sym}
                    </span>
                  ))}
                </>
              )}

              {/* Floating Chest in Center (No Box Background) */}
              <img
                src="/assets/pets/treasure_chest.gif"
                alt="Membuka Peti Harta"
                className={`relative z-10 w-40 h-40 sm:w-48 sm:h-48 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.65)] ${
                  chestAnimStage === 'shaking'
                    ? 'animate-chest-shake'
                    : 'scale-135 transition-transform duration-300'
                }`}
              />

              <p className="relative z-10 mt-5 font-['Fredoka'] text-xl sm:text-2xl font-bold text-amber-200 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-pulse">
                {chestAnimStage === 'shaking'
                  ? 'Membuka Peti Harta...'
                  : 'DUAAR!! ✨'}
              </p>
            </div>
          ) : (
            /* STAGE 3: TAMPILAN HADIAH (Hanya Muncul Saat Peti Sudah Selesai Dibuka) */
            <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#FFFDF7] via-white to-[#FFF7E6] border-2 border-amber-300 shadow-2xl p-6 text-center space-y-4 overflow-hidden animate-chest-reward-pop">
              <div
                className="w-36 h-36 mx-auto relative flex items-center justify-center"
                style={{
                  background:
                    'radial-gradient(circle, rgba(250,204,21,0.5) 0%, rgba(251,191,36,0.2) 52%, transparent 72%)',
                }}
              >
                <img
                  src="/assets/pets/treasure_chest.gif"
                  alt="Peti Harta NuePet Zoo"
                  className="w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-xl"
                />
              </div>

              <div>
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Hadiah Peti Terbuka
                </span>
                <h2 className="font-['Fredoka'] text-2xl font-bold text-slate-800 mt-1.5">
                  Selamat! Hadiah Terbuka!
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kamu mendapatkan bonus Crystal & Koin berikut:
                </p>
              </div>

              {/* Pop-Out Reward Cards: Crystal (Permata ✦) & Coin (Koin 🪙) */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-gradient-to-b from-sky-50 to-sky-100/80 border-2 border-sky-200 shadow-xs flex flex-col items-center">
                  <span className="w-9 h-9 rounded-xl bg-[#4AA9DF] text-white flex items-center justify-center text-base font-bold shadow-xs">
                    ✦
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 mt-1.5">
                    Hadiah Crystal
                  </span>
                  <span className="font-mono tabular-nums text-base sm:text-lg font-black text-sky-700">
                    +{lastChestReward ? lastChestReward.crystals : 350} ✦
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-gradient-to-b from-amber-50 to-amber-100/80 border-2 border-amber-200 shadow-xs flex flex-col items-center">
                  <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-950 flex items-center justify-center text-base font-bold shadow-xs">
                    🪙
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 mt-1.5">
                    Hadiah Koin
                  </span>
                  <span className="font-mono tabular-nums text-base sm:text-lg font-black text-amber-700">
                    +{lastChestReward ? lastChestReward.coins : 550} 🪙
                  </span>
                </div>
              </div>

              <div className="pt-1">
                <button
                  onClick={handleCollectChestReward}
                  className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#26B99A] to-[#149E78] hover:from-[#14B8A6] hover:to-[#0F766E] text-white font-bold text-xs shadow-md transition-transform active:scale-95 cursor-pointer"
                >
                  Ambil Hadiah!
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Konversi Koin ke Crystal Akun (50.000 Koin = 5.000 Crystal) */}
      <CoinConverterModal
        isOpen={activeModal === 'converter'}
        coins={coins}
        crystals={gems}
        onClose={() => setActiveModal('none')}
        onConvert={handleConvertCoins}
      />

      {/* 3D Egg Gacha Modal (500 Crystal 1x / 5.000 Crystal 10x) */}
      <GachaEggModal
        isOpen={activeModal === 'gacha'}
        gems={gems}
        onClose={() => setActiveModal('none')}
        onPerformGacha={handlePerformGacha}
      />

      {/* Kelola Pet & Island Drawer */}
      <ManageIslandDrawer
        isOpen={activeModal === 'manage'}
        coins={coins}
        ownedPets={ownedPets}
        activeSkyId={activeSkyId}
        unlockedSkyIds={unlockedSkyIds}
        activeIslandId={activeIslandId}
        unlockedIslandIds={unlockedIslandIds}
        onSelectSky={handleSelectSky}
        onSelectIsland={handleSelectIsland}
        onMergeSpecies={handleMergeSpecies}
        onDirectStarUpgrade={handleDirectStarUpgrade}
        onClose={() => setActiveModal('none')}
        onToggleDeploy={handleToggleDeploy}
        onAutoDeployBest={handleAutoDeployBest}
      />

      {/* Katalog Pet Drawer */}
      <PetCatalogDrawer
        isOpen={activeModal === 'catalog'}
        ownedPets={ownedPets}
        activeIslandId={activeIslandId}
        onMergeSpecies={handleMergeSpecies}
        onEvolveSpeciesStage={handleEvolveSpeciesStage}
        onClose={() => setActiveModal('none')}
      />

      {/* Architecture & Live FSM AI State Inspector Drawer */}
      <ArchitectureGuideDrawer
        isOpen={activeModal === 'architecture'}
        telemetry={liveTelemetry}
        onClose={() => setActiveModal('none')}
      />
    </div>
  );
}
