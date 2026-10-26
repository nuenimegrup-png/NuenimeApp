import React from 'react';
import {
  getPetStageVisuals,
  PET_SPECIES_CATALOG,
  PetRarity,
  PetSpeciesId,
} from '../types/pet';

interface PetAvatarBadgeProps {
  speciesId: PetSpeciesId;
  size?: 'sm' | 'md' | 'lg';
  star?: number;
}

export const PetAvatarBadge: React.FC<PetAvatarBadgeProps> = ({
  speciesId,
  size = 'md',
  star,
}) => {
  const spec = PET_SPECIES_CATALOG[speciesId];
  const stageVisuals = getPetStageVisuals(speciesId, star || 1);
  const dim =
    size === 'sm'
      ? 'w-10 h-10 rounded-xl'
      : size === 'lg'
      ? 'w-24 h-24 rounded-2xl'
      : 'w-12 h-12 sm:w-14 sm:h-14 rounded-xl';

  return (
    <div
      className={`${dim} bg-white border border-slate-200/70 flex items-center justify-center shrink-0 overflow-hidden relative shadow-2xs`}
    >
      <img
        src={stageVisuals.gifUrl}
        alt={`${spec.name} (${stageVisuals.stageLabel})`}
        referrerPolicy="no-referrer"
        style={spec.cssFilter ? { filter: spec.cssFilter } : undefined}
        className="w-[108%] h-[108%] object-contain select-none pointer-events-none"
      />
      {star && star > 1 && (
        <span className="absolute bottom-0.5 right-0.5 px-1 py-0 rounded-md bg-amber-400 text-amber-950 font-extrabold text-[8px] leading-tight shadow-2xs">
          Lv.{star}
        </span>
      )}
    </div>
  );
};

export const RarityPillBadge: React.FC<{ rarity: PetRarity }> = ({ rarity }) => {
  const colorStyle =
    rarity === PetRarity.LEGEND
      ? 'bg-gradient-to-r from-[#FDE047] via-[#FACC15] to-[#EAB308] text-amber-950'
      : rarity === PetRarity.EPIC
      ? 'bg-[#7E42D0] text-white'
      : rarity === PetRarity.RARE
      ? 'bg-[#1682B4] text-white'
      : 'bg-[#5B6470] text-white';

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold leading-none tracking-wide whitespace-nowrap ${colorStyle}`}
    >
      {rarity}
    </span>
  );
};
