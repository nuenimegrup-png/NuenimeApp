import React from 'react';
import { X, Check, Plus, Sparkles, ArrowUpCircle } from 'lucide-react';
import {
  ELEMENT_META,
  getEffectiveCoinsPerDay,
  getPetStageVisuals,
  hasIslandElementSynergy,
  ISLAND_THEMES_LIST,
  IslandThemeConfig,
  IslandThemeId,
  MAX_ISLAND_PETS,
  OwnedPetInstance,
  PET_SPECIES_CATALOG,
  PetSpeciesId,
  SKY_ATMOSPHERES_LIST,
  SkyAtmosphereId,
} from '../types/pet';
import { soundFX } from '../utils/sound';
import { PetAvatarBadge, RarityPillBadge } from './PetAvatarBadge';

interface ManageIslandDrawerProps {
  isOpen: boolean;
  coins: number;
  ownedPets: OwnedPetInstance[];
  activeSkyId: SkyAtmosphereId;
  unlockedSkyIds: SkyAtmosphereId[];
  activeIslandId: IslandThemeId;
  unlockedIslandIds: IslandThemeId[];
  onSelectSky: (skyId: SkyAtmosphereId) => void;
  onSelectIsland: (islandId: IslandThemeId) => void;
  onMergeSpecies: (speciesId: PetSpeciesId, targetStar: number) => void;
  onDirectStarUpgrade: (instanceId: string) => void;
  onClose: () => void;
  onToggleDeploy: (instanceId: string) => void;
  onAutoDeployBest: () => void;
}

/**
 * Custom artwork banner for each of the 8 Sky Atmospheres matching Screenshot 2
 */
const SkyPreviewBanner: React.FC<{ skyId: SkyAtmosphereId }> = ({ skyId }) => {
  switch (skyId) {
    case 'siang_cerah':
      return (
        <div className="w-full h-20 sm:h-24 bg-[#6BCB4B] relative overflow-hidden">
          <div className="absolute -top-6 right-8 w-14 h-14 rounded-full bg-[#A8E68E]" />
        </div>
      );
    case 'malam_hari':
      return (
        <div className="w-full h-20 sm:h-24 bg-[#31A8BC] relative overflow-hidden">
          <div className="absolute top-3 left-6 w-2 h-2 rounded-full bg-white/70" />
          <div className="absolute top-5 right-10 w-1.5 h-1.5 rounded-full bg-white/60" />
        </div>
      );
    case 'sore_cerah':
      return (
        <div className="w-full h-20 sm:h-24 bg-[#A3D977] relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-10 bg-[#F8BBD0]" />
          <div className="absolute -top-4 -left-2 w-24 h-20 rounded-full bg-[#F8BBD0]" />
          <div className="absolute -top-3 right-0 w-24 h-20 rounded-full bg-[#F8BBD0]" />
          <div className="absolute top-7 left-[44%] w-5 h-5 rounded-full bg-[#D7CCC8]/70" />
        </div>
      );
    case 'senja_merah':
      return (
        <div className="w-full h-20 sm:h-24 bg-[#455A44] relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-9 bg-[#513B75]" />
          <div className="absolute top-1 left-7 w-11 h-11 rounded-full bg-white/15 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-[#FFF9E6]" />
          </div>
          <div className="absolute top-2.5 right-14 w-2 h-2 rounded-full bg-white" />
          <div className="absolute top-1.5 right-6 w-2.5 h-2.5 rounded-full bg-white" />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-20 h-6 rounded-full bg-[#A1663E]" />
        </div>
      );
    case 'hari_hujan':
      return (
        <div className="w-full h-20 sm:h-24 bg-[#60768B] relative overflow-hidden">
          <div className="absolute inset-0 opacity-35 bg-[repeating-linear-gradient(15deg,transparent,transparent_6px,#94A3B8_6px,#94A3B8_8px)]" />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-9 rounded-full bg-[#7A94B0]/70" />
        </div>
      );
    case 'musim_salju':
      return (
        <div className="w-full h-20 sm:h-24 bg-[#E3F0FF] relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-7 bg-[#B8D0EB]" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white/90" />
          <div className="absolute bottom-3 left-8 w-2 h-2 rounded-full bg-white" />
          <div className="absolute bottom-5 right-10 w-2 h-2 rounded-full bg-white" />
        </div>
      );
    case 'luar_angkasa':
      return (
        <div className="w-full h-20 sm:h-24 bg-gradient-to-br from-[#4A2559] via-[#34263E] to-[#2B2B30] relative overflow-hidden">
          <div className="absolute top-2.5 left-12 w-1 h-1 rounded-full bg-white" />
          <div className="absolute top-3.5 right-16 w-1.5 h-1.5 rounded-full bg-white" />
          <div className="absolute bottom-5 left-20 w-1 h-1 rounded-full bg-white/80" />
          <div className="absolute bottom-4 right-10 w-1 h-1 rounded-full bg-white/90" />
        </div>
      );
    case 'akatsuki':
      return (
        <div className="w-full h-20 sm:h-24 bg-[#3D3131] relative overflow-hidden flex items-center justify-center">
          <div className="absolute top-1.5 right-7 w-5 h-5 rounded-full bg-[#B93838]" />
          <div className="absolute top-1 right-6 w-4 h-4 rounded-full bg-[#3D3131]" />
          <svg
            viewBox="0 0 180 70"
            className="w-36 h-14 drop-shadow-xs"
            fill="none"
          >
            <path
              d="M25 50 C15 50 15 35 28 34 C30 18 52 15 62 26 C72 10 105 12 112 28 C126 20 148 26 146 42 C158 42 158 55 142 55 Z"
              fill="#B33636"
              stroke="#FFF3E0"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            <path
              d="M52 36 C46 36 45 28 52 28 C57 28 57 34 53 35"
              stroke="#FFF3E0"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M96 34 C90 34 89 26 96 26 C101 26 101 32 97 33"
              stroke="#FFF3E0"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      );
  }
};

/**
 * Custom Isometric Floating Island SVG Preview matching Screenshot 2
 */
const IslandIsometricPreview: React.FC<{ island: IslandThemeConfig }> = ({
  island,
}) => {
  const isAbyss = island.id === 'abyss_void';
  const isHell = island.id === 'inferno_hell';
  const isFrost = island.id === 'frost_glacier';
  const isGold = island.id === 'celestial_gold';
  const isVolcano = island.id === 'dc_island_3';
  const isSakura = island.id === 'dc_island_4';
  const isRainbow = island.id === 'dc_island_2';

  return (
    <div
      className="w-full h-26 sm:h-28 relative overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: island.cardBgColor }}
    >
      <svg viewBox="0 0 200 130" className="w-36 sm:w-40 h-24 overflow-visible">
        {isRainbow && (
          <path
            d="M 70 38 A 30 24 0 0 1 130 38"
            fill="none"
            stroke="#F43F5E"
            strokeWidth="3.5"
          />
        )}
        {isRainbow && (
          <path
            d="M 73 41 A 27 21 0 0 1 127 41"
            fill="none"
            stroke="#FACC15"
            strokeWidth="3"
          />
        )}
        {isRainbow && (
          <path
            d="M 76 44 A 24 18 0 0 1 124 44"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="3"
          />
        )}

        <polygon
          points="38,62 162,62 142,92 100,115 58,92"
          fill={island.rockStops[1]}
          stroke={island.rockStops[3]}
          strokeWidth="1.5"
        />
        <polygon
          points="58,62 142,62 125,95 100,115 75,95"
          fill={island.rockStops[2]}
        />

        <ellipse
          cx="100"
          cy="58"
          rx="62"
          ry="28"
          fill={island.grassStops[1]}
          stroke={island.rockStops[0]}
          strokeWidth="4"
        />
        <ellipse
          cx="98"
          cy="56"
          rx="52"
          ry="22"
          fill={island.grassStops[0]}
        />

        {(isVolcano || isHell) && (
          <g>
            <polygon
              points="82,42 100,12 118,42"
              fill={isHell ? '#292524' : '#65A30D'}
            />
            <ellipse
              cx="100"
              cy="13"
              rx="6"
              ry="2.5"
              fill={isHell ? '#F97316' : '#FACC15'}
            />
          </g>
        )}

        {(isAbyss || isSakura) && (
          <g>
            <polygon
              points="115,38 122,20 129,38"
              fill={isAbyss ? '#22D3EE' : '#F472B6'}
            />
            <polygon
              points="125,42 131,26 136,42"
              fill={isAbyss ? '#A855F7' : '#E879F9'}
            />
          </g>
        )}

        <path
          d="M 100 42 Q 86 55 96 68 Q 104 78 90 86"
          fill="none"
          stroke={island.waterfallColor}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 90 84 L 88 112"
          stroke={island.waterfallColor}
          strokeWidth="5"
          strokeLinecap="round"
        />

        {island.id === 'dc_island_1' && (
          <path
            d="M 132 34 Q 146 24 156 34"
            fill="none"
            stroke="#9A3412"
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}

        <circle
          cx="66"
          cy="44"
          r="9"
          fill={
            isHell
              ? '#EF4444'
              : isAbyss
              ? '#6366F1'
              : isFrost
              ? '#E0F2FE'
              : isGold
              ? '#FEF08A'
              : '#22C55E'
          }
        />
        <circle
          cx="132"
          cy="50"
          r="8"
          fill={
            isHell
              ? '#F97316'
              : isAbyss
              ? '#A855F7'
              : isSakura
              ? '#F472B6'
              : '#4ADE80'
          }
        />

        <ellipse
          cx="72"
          cy="106"
          rx="22"
          ry="8"
          fill={isHell ? 'rgba(251,146,60,0.35)' : 'rgba(255,255,255,0.75)'}
        />
        <ellipse
          cx="126"
          cy="104"
          rx="24"
          ry="9"
          fill={isHell ? 'rgba(251,146,60,0.35)' : 'rgba(255,255,255,0.75)'}
        />
      </svg>

      {/* Elemental Synergy Boost Pill on Island Card */}
      <span className="absolute bottom-1.5 left-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-slate-900/65 text-white text-[9px] font-bold text-center truncate">
        {island.subtitle}
      </span>
    </div>
  );
};

export const ManageIslandDrawer: React.FC<ManageIslandDrawerProps> = ({
  isOpen,
  coins,
  ownedPets,
  activeSkyId,
  unlockedSkyIds,
  activeIslandId,
  unlockedIslandIds,
  onSelectSky,
  onSelectIsland,
  onMergeSpecies,
  onDirectStarUpgrade,
  onClose,
  onToggleDeploy,
  onAutoDeployBest,
}) => {
  if (!isOpen) return null;

  const deployedPets = ownedPets.filter((p) => p.isDeployed);
  const deployedCount = deployedPets.length;
  const isQuotaFull = deployedCount >= MAX_ISLAND_PETS;

  // Count duplicate groups eligible for 3x Star Merge
  const dupCounts = new Map<string, { speciesId: PetSpeciesId; star: number; count: number }>();
  ownedPets.forEach((p) => {
    const st = p.star || 1;
    if (st < 3) {
      const key = `${p.speciesId}_${st}`;
      const prev = dupCounts.get(key) || { speciesId: p.speciesId, star: st, count: 0 };
      prev.count += 1;
      dupCounts.set(key, prev);
    }
  });
  const mergeableGroups = Array.from(dupCounts.values()).filter((g) => g.count >= 3);

  return (
    <div className="fixed inset-x-0 top-[60px] bottom-0 z-40 flex justify-center pointer-events-auto">
      <div className="w-full max-w-2xl h-full rounded-t-[28px] bg-white border-t border-slate-200/80 shadow-2xl flex flex-col overflow-hidden">
        {/* Grab handle matching reference screenshot 2 */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header matching reference screenshot 2 ("Kelola Pet" + square "X" button) */}
        <div className="px-4 sm:px-6 py-2 flex items-center justify-between shrink-0">
          <h2 className="font-['Fredoka'] text-lg sm:text-xl font-bold text-slate-800">
            Kelola Pet
          </h2>
          <button
            onClick={() => {
              soundFX.playUiClick();
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-[#F1F3F5] hover:bg-slate-200 flex items-center justify-center text-slate-800 font-extrabold text-sm transition-colors"
            aria-label="Tutup Kelola Pet"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Content (pb-28 prevents bottom dock overlap/bleed) */}
        <div className="px-3.5 sm:px-6 pb-28 pt-1 overflow-y-auto space-y-5 flex-1">
          {/* 1. SKY & WEATHER ATMOSPHERE GRID (Matches top of Screenshot 2) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {SKY_ATMOSPHERES_LIST.map((sky) => {
              const isActive = activeSkyId === sky.id;
              const isUnlocked = unlockedSkyIds.includes(sky.id);

              return (
                <button
                  key={sky.id}
                  onClick={() => {
                    soundFX.playUiClick();
                    onSelectSky(sky.id);
                  }}
                  className={`rounded-2xl overflow-hidden text-left transition-all bg-white shadow-xs ${
                    isActive
                      ? 'border-2 border-[#149E78] ring-2 ring-[#149E78]/15'
                      : 'border border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <SkyPreviewBanner skyId={sky.id} />
                  <div className="px-2.5 sm:px-3 py-2 bg-white flex items-center justify-between gap-1.5">
                    <span className="font-bold text-xs sm:text-sm text-slate-800 truncate">
                      {sky.name}
                    </span>
                    {isActive ? (
                      <span className="text-[11px] sm:text-xs font-bold text-[#149E78] shrink-0">
                        Aktif ✓
                      </span>
                    ) : isUnlocked ? (
                      <span className="text-[11px] font-semibold text-teal-600 shrink-0">
                        Pakai
                      </span>
                    ) : (
                      <span className="text-[11px] sm:text-xs font-bold text-slate-600 font-mono tabular-nums shrink-0">
                        {sky.price}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 2. ISLAND SECTION HEADER BAR (Exact match to Screenshot 2) */}
          <div className="bg-[#EEF6FB] rounded-2xl px-3.5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-5 rounded-full bg-[#4DB6AC]" />
              <div>
                <span className="font-bold text-sm text-slate-800 block leading-tight">
                  Island (Bonus Elemen +25%)
                </span>
                <span className="text-[10px] text-slate-500">
                  Pilih pulau untuk mengaktifkan sinergi elemen +25% Koin/hari
                </span>
              </div>
            </div>
            <span className="px-3 py-0.5 rounded-full bg-white text-xs font-bold text-slate-700 font-mono tabular-nums shadow-2xs shrink-0">
              {unlockedIslandIds.length}/{ISLAND_THEMES_LIST.length}
            </span>
          </div>

          {/* ISLAND 2-COLUMN GRID */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {ISLAND_THEMES_LIST.map((island) => {
              const isActive = activeIslandId === island.id;
              const isUnlocked = unlockedIslandIds.includes(island.id);

              return (
                <button
                  key={island.id}
                  onClick={() => {
                    soundFX.playUiClick();
                    onSelectIsland(island.id);
                  }}
                  className={`rounded-2xl overflow-hidden text-left transition-all bg-white shadow-xs ${
                    isActive
                      ? 'border-2 border-[#149E78] ring-2 ring-[#149E78]/15'
                      : 'border border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <IslandIsometricPreview island={island} />
                  <div className="px-2.5 sm:px-3 py-2 bg-white flex items-center justify-between gap-1.5">
                    <span className="font-bold text-xs sm:text-sm text-slate-800 truncate">
                      {island.name}
                    </span>
                    {isActive ? (
                      <span className="text-[11px] sm:text-xs font-bold text-[#149E78] shrink-0">
                        Aktif ✓
                      </span>
                    ) : isUnlocked ? (
                      <span className="text-[11px] font-semibold text-teal-600 shrink-0">
                        Pakai
                      </span>
                    ) : (
                      <span className="text-[11px] sm:text-xs font-bold text-slate-600 font-mono tabular-nums shrink-0">
                        {island.price}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 3. PET DI PULAU & EVOLUSI BINTANG (★ MERGE) SECTION */}
          <div className="bg-[#EEF6FB] rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-5 rounded-full bg-[#4DB6AC]" />
              <div>
                <span className="font-bold text-sm text-slate-800 block leading-tight">
                  Pet di Pulau & Evolusi ★
                </span>
                <span className="text-[10px] text-slate-500">
                  Gabung 3× pet kembar atau Upgrade ★ untuk ukuran lebih besar & Koin 2× lipat
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  soundFX.playUiClick();
                  onAutoDeployBest();
                }}
                className="px-2.5 py-1 rounded-full bg-[#149E78] text-white text-[11px] font-bold flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Otomatis
              </button>
              <span className="px-2.5 py-0.5 rounded-full bg-white text-xs font-bold text-slate-700 font-mono tabular-nums shadow-2xs">
                {deployedCount}/{MAX_ISLAND_PETS}
              </span>
            </div>
          </div>

          {/* Banner if 3x duplicate merge is available */}
          {mergeableGroups.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-amber-950 font-semibold">
                ✨ Ada <strong>{mergeableGroups.length} jenis Pet kembar (3×)</strong> siap digabung menjadi ★{mergeableGroups[0].star + 1}!
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mergeableGroups.map((g) => (
                  <button
                    key={`${g.speciesId}_${g.star}`}
                    onClick={() => {
                      soundFX.playCoinClaim();
                      onMergeSpecies(g.speciesId, g.star + 1);
                    }}
                    className="px-3 py-1 rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-950 font-extrabold text-xs flex items-center gap-1 shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Gabung 3× {PET_SPECIES_CATALOG[g.speciesId].name} → ★{g.star + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Owned Pets List with Deploy & Stage Evolution (Lv.1 -> Lv.2) Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ownedPets.map((pet) => {
              const spec = PET_SPECIES_CATALOG[pet.speciesId];
              const star = Math.max(pet.star || 1, pet.level || 1);
              const stageVisuals = getPetStageVisuals(pet.speciesId, star);
              const disabledAdd = !pet.isDeployed && isQuotaFull;
              const isBoosted = hasIslandElementSynergy(
                pet.speciesId,
                activeIslandId
              );
              const effectiveDaily = getEffectiveCoinsPerDay(
                pet.speciesId,
                star,
                activeIslandId
              );
              const elemMeta = ELEMENT_META[spec.element];

              return (
                <div
                  key={pet.instanceId}
                  className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 ${
                    pet.isDeployed
                      ? 'bg-[#F7FDFB] border-[#149E78]'
                      : 'bg-[#F7F7F2] border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PetAvatarBadge
                      speciesId={pet.speciesId}
                      size="sm"
                      star={star}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <h3 className="font-bold text-xs text-slate-900 truncate">
                          {spec.name} {spec.title}
                        </h3>
                        <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 font-extrabold text-[10px] shrink-0">
                          {stageVisuals.stageLabel} ({'★'.repeat(star)})
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <RarityPillBadge rarity={spec.rarity} />
                        <span className="text-[10px] font-bold text-teal-800 font-mono tabular-nums">
                          {elemMeta.icon} +{effectiveDaily}/hari
                        </span>
                        {isBoosted && (
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-extrabold">
                            +25% Pulau
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {stageVisuals.hasEvolution ? (
                      star < 2 ? (
                        <button
                          disabled={coins < 500}
                          onClick={() => {
                            if (coins >= 500) {
                              onDirectStarUpgrade(pet.instanceId);
                            }
                          }}
                          title={
                            coins >= 500
                              ? 'Evolusi ke Lv.2 (Biaya: 500 Koin)'
                              : 'Koin tidak cukup (Butuh 500 Koin)'
                          }
                          className={`px-2 py-1.5 rounded-xl text-[10px] font-extrabold flex items-center gap-0.5 shadow-2xs transition-all ${
                            coins >= 500
                              ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 active:scale-95 cursor-pointer'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                          <span>Naik Lv.2 (500 🪙)</span>
                        </button>
                      ) : (
                        <span className="px-2 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] font-extrabold flex items-center gap-0.5">
                          <span>Lv.2 Max ✓</span>
                        </span>
                      )
                    ) : (
                      <span className="px-2 py-1 rounded-xl bg-slate-200/80 text-slate-600 text-[9.5px] font-bold">
                        Lv.1 Max
                      </span>
                    )}

                    <button
                      disabled={disabledAdd}
                      onClick={() => {
                        soundFX.playUiClick();
                        onToggleDeploy(pet.instanceId);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 transition-colors ${
                        pet.isDeployed
                          ? 'bg-[#149E78] text-white'
                          : disabledAdd
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-800 text-white hover:bg-slate-700'
                      }`}
                    >
                      {pet.isDeployed ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Aktif</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Pakai</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
