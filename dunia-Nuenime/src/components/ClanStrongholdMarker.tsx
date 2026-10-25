import React from 'react';
import { Clan } from '../types/nuenime';
import { ClanEmblemIcon } from './icons/NuenimeAssets';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';

interface ClanStrongholdMarkerProps {
  clan: Clan;
  isSelected: boolean;
  mapScale: number;
  onSelectClan: (clan: Clan) => void;
}

/**
 * ClanStrongholdMarker dirender di atas Peta Kota dalam sistem koordinat yang sama (cityMapXPercent, cityMapYPercent).
 * Menggunakan plakat solid (#060c18) 2-baris yang ringkas dan presisi agar tidak saling menumpuk di layar ponsel.
 */
export const ClanStrongholdMarker: React.FC<ClanStrongholdMarkerProps> = ({
  clan,
  isSelected,
  mapScale,
  onSelectClan,
}) => {
  const { joinedClanId, districtInfluence } = useNuenimeRpg();
  const inverseScale = Math.max(0.7, Math.min(1.1, 1 / Math.pow(mapScale, 0.42)));
  const isJoined = joinedClanId === clan.id;
  const influence = districtInfluence[clan.id]?.influencePercent ?? 68;

  return (
    <div
      style={{
        left: `${clan.cityMapXPercent}%`,
        top: `${clan.cityMapYPercent}%`,
        transform: `translate3d(-20px, -50%, 0) scale(${inverseScale})`,
        transformOrigin: '20px 50%',
      }}
      className={`absolute select-none ${isSelected ? 'z-20' : 'z-10'}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelectClan(clan);
        }}
        aria-label={`Pilih markas klan ${clan.name}`}
        className="group relative flex min-h-[42px] items-center focus:outline-none"
      >
        {/* Highlight pulse ring when clan is selected */}
        {isSelected && (
          <span
            className="animate-pulse-ring pointer-events-none absolute -left-1 h-11 w-11 rounded-full"
            style={{
              boxShadow: `0 0 18px 4px ${clan.accentColor}`,
              border: `1.5px solid #ffffff`,
            }}
          />
        )}

        {/* Clan Shield Emblem Badge */}
        <div
          className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#060c18] transition-transform duration-150 ${
            isSelected ? 'scale-105' : 'group-hover:scale-105 group-active:scale-95'
          }`}
          style={{
            filter: isSelected
              ? `drop-shadow(0 0 10px ${clan.accentColor}) drop-shadow(0 4px 8px rgba(0,0,0,0.92))`
              : 'drop-shadow(0 4px 7px rgba(0,0,0,0.92))',
          }}
        >
          <ClanEmblemIcon
            variant={clan.emblemVariant}
            accentColor={clan.accentColor}
            logoUrl={clan.logoUrl}
            size={40}
          />
        </div>

        {/* Compact Solid Dark Obsidian Plaque */}
        <div
          className={`relative -ml-2.5 flex flex-col justify-center py-1 pl-3.5 pr-3 text-left transition-all duration-150 ${
            isSelected ? 'bg-[#050a14] text-white' : 'bg-[#070e1c] text-slate-100'
          }`}
          style={{
            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.9)',
            borderTop: `1.5px solid ${isSelected ? clan.accentColor : 'rgba(226, 232, 240, 0.42)'}`,
            borderBottom: `1.5px solid ${isSelected ? clan.accentColor : 'rgba(148, 163, 184, 0.34)'}`,
          }}
        >
          <div className="flex items-center gap-1">
            <span className="font-display text-[11px] leading-tight font-bold tracking-wide whitespace-nowrap">
              {clan.name}
            </span>
            {isJoined && (
              <span className="font-mono text-[8.5px] font-bold text-emerald-300">
                · AKTIF
              </span>
            )}
          </div>

          <div className="mt-0.5 flex items-center gap-1.5 text-[9.5px] leading-tight font-medium text-slate-300 whitespace-nowrap">
            <span className="font-mono font-bold text-amber-300 tabular-nums">
              {influence}%
            </span>
            <div className="h-1 w-12 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${influence}%`,
                  backgroundColor: clan.accentColor,
                }}
              />
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};
