import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  ELEMENT_META,
  getPetStageVisuals,
  hasIslandElementSynergy,
  ISLAND_THEMES_LIST,
  IslandThemeId,
  OwnedPetInstance,
  PET_SPECIES_LIST,
  PetRarity,
  PetSpeciesId,
} from '../types/pet';
import { soundFX } from '../utils/sound';
import { PetAvatarBadge, RarityPillBadge } from './PetAvatarBadge';

interface PetCatalogDrawerProps {
  isOpen: boolean;
  ownedPets: OwnedPetInstance[];
  activeIslandId: IslandThemeId;
  onMergeSpecies?: (speciesId: PetSpeciesId, targetStar: number) => void;
  onEvolveSpeciesStage?: (speciesId: PetSpeciesId, targetStage: number) => void;
  onClose: () => void;
}

export const PetCatalogDrawer: React.FC<PetCatalogDrawerProps> = ({
  isOpen,
  ownedPets,
  activeIslandId,
  onClose,
}) => {
  const [selectedRarity, setSelectedRarity] = useState<'ALL' | PetRarity>('ALL');

  if (!isOpen) return null;

  const activeIsland =
    ISLAND_THEMES_LIST.find((i) => i.id === activeIslandId) ||
    ISLAND_THEMES_LIST[0];

  const filteredList =
    selectedRarity === 'ALL'
      ? PET_SPECIES_LIST
      : PET_SPECIES_LIST.filter((s) => s.rarity === selectedRarity);

  return (
    <div className="fixed inset-x-0 top-[50px] sm:top-[60px] bottom-0 z-40 flex justify-center pointer-events-auto">
      <div className="w-full max-w-2xl h-full rounded-t-[28px] bg-white border-t border-slate-200/80 shadow-2xl flex flex-col overflow-hidden">
        {/* Grab handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header ("Katalog Pet" + square "X" button) */}
        <div className="px-4 sm:px-6 py-2 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-['Fredoka'] text-lg sm:text-xl font-bold text-slate-800 leading-tight">
                Katalog Pet
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                {PET_SPECIES_LIST.length} Karakter
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Pulau Aktif:{' '}
              <strong className="text-slate-700">{activeIsland.name}</strong> (
              {activeIsland.subtitle})
            </p>
          </div>
          <button
            onClick={() => {
              soundFX.playUiClick();
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-[#F1F3F5] hover:bg-slate-200 flex items-center justify-center text-slate-800 font-extrabold text-sm transition-colors shrink-0"
            aria-label="Tutup Katalog Pet"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Category Rarity Filter Bar */}
        <div className="px-3.5 sm:px-6 pb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {(
            [
              ['ALL', `Semua (${PET_SPECIES_LIST.length})`],
              [PetRarity.COMMON, 'Common'],
              [PetRarity.RARE, 'Rare'],
              [PetRarity.EPIC, 'Epic'],
              [PetRarity.LEGEND, 'Legend'],
            ] as const
          ).map(([key, label]) => {
            const active = selectedRarity === key;
            return (
              <button
                key={key}
                onClick={() => {
                  soundFX.playUiClick();
                  setSelectedRarity(key);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-[#F3F4F6] text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Tata Letak Kotak 2 Kolom Seperti Awal - Presisi dan Rapi tanpa Terpotong */}
        <div className="px-2.5 sm:px-5 pt-1 pb-28 overflow-y-auto grid grid-cols-2 gap-2 sm:gap-2.5 content-start flex-1 no-scrollbar">
          {filteredList.map((spec) => {
            const instances = ownedPets.filter((p) => p.speciesId === spec.id);
            const highestStar = instances.reduce(
              (max, p) => Math.max(max, p.star || 1, p.level || 1),
              1
            );
            const stageVisuals = getPetStageVisuals(spec.id, highestStar);
            const isBoosted = hasIslandElementSynergy(spec.id, activeIslandId);
            const elemMeta = ELEMENT_META[spec.element];

            return (
              <div
                key={spec.id}
                className={`p-2 sm:p-2.5 rounded-2xl border flex items-center gap-2 sm:gap-2.5 transition-all ${
                  isBoosted
                    ? 'bg-[#F4FBF8] border-[#BCE3DF]'
                    : 'bg-[#F7F7F2] border-[#E8E8E2]'
                }`}
              >
                <PetAvatarBadge
                  speciesId={spec.id}
                  size="sm"
                  star={highestStar}
                />

                <div className="min-w-0 flex-1 flex flex-col items-start justify-center">
                  <h3
                    className="font-['Plus_Jakarta_Sans'] font-bold text-[10.5px] sm:text-xs text-slate-900 leading-tight truncate w-full"
                    title={`${spec.name} ${spec.title}`}
                  >
                    {spec.name} {spec.title}
                  </h3>

                  <div className="mt-0.5 flex items-center gap-1">
                    <RarityPillBadge rarity={spec.rarity} />
                    <span
                      title={`Elemen: ${elemMeta.label}`}
                      className="text-[10px] leading-none shrink-0"
                    >
                      {elemMeta.icon}
                    </span>
                  </div>

                  <div className="mt-1">
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-extrabold text-[9px] leading-tight inline-block whitespace-nowrap">
                      {stageVisuals.stageLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
