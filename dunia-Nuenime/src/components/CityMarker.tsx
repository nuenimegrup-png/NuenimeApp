import React from 'react';
import { WorldCity } from '../types/nuenime';
import { CityEmblemBadge } from './icons/NuenimeAssets';

interface CityMarkerProps {
  city: WorldCity;
  isSelected: boolean;
  mapScale: number;
  onSelectCity: (city: WorldCity) => void;
}

/**
 * CityMarker dirender di dalam sistem koordinat dunia yang sama dengan gambar peta.
 * Menggunakan plakat metalik gelap solid (#060c18) sehingga teks nama kota dan level
 * selalu tajam, kontras tinggi, dan tidak pernah tembus oleh latar di belakangnya.
 */
export const CityMarker: React.FC<CityMarkerProps> = ({
  city,
  isSelected,
  onSelectCity,
}) => {
  return (
    <div
      style={{
        left: `${city.worldXPercent}%`,
        top: `${city.worldYPercent}%`,
        transform: 'translate3d(-22px, -50%, 0)',
        transformOrigin: '22px 50%',
      }}
      className={`absolute select-none ${isSelected ? 'z-25' : 'z-15'}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelectCity(city);
        }}
        aria-label={`Pilih kota ${city.name} Level ${city.level}`}
        className="group relative flex min-h-[44px] items-center focus:outline-none"
      >
        {/* Outer highlight pulse ring when city is selected */}
        {isSelected && (
          <span
            className="animate-pulse-ring pointer-events-none absolute -left-1.5 h-[56px] w-[56px] rounded-full"
            style={{
              boxShadow: `0 0 20px 4px ${city.accentHex}`,
              border: `2px solid ${city.secondaryHex}`,
            }}
          />
        )}

        {/* Metallic City Emblem Shield Badge */}
        <div
          className={`relative z-10 flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-[#060c18] transition-transform duration-150 ${
            isSelected ? 'scale-105' : 'group-hover:scale-105 group-active:scale-95'
          }`}
          style={{
            filter: isSelected
              ? `drop-shadow(0 0 10px ${city.accentHex}) drop-shadow(0 4px 8px rgba(0,0,0,0.92))`
              : 'drop-shadow(0 4px 7px rgba(0,0,0,0.92))',
          }}
        >
          <CityEmblemBadge
            cityId={city.id}
            material={city.material}
            size={44}
            selected={isSelected}
          />
        </div>

        {/* Solid Beveled Dark Obsidian City Name & Level Plaque (No text bleed) */}
        <div
          className={`relative -ml-3 flex h-[32px] min-w-[102px] items-center gap-1.5 pl-4 pr-3.5 transition-all duration-150 ${
            isSelected ? 'bg-[#050a14] text-white' : 'bg-[#070e1c] text-slate-100 group-hover:bg-[#091326]'
          }`}
          style={{
            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.9)',
            borderTop: `1.5px solid ${isSelected ? city.accentHex : 'rgba(226, 232, 240, 0.45)'}`,
            borderBottom: `1.5px solid ${isSelected ? city.accentHex : 'rgba(148, 163, 184, 0.35)'}`,
          }}
        >
          <span className="font-display text-[12px] font-bold tracking-wide whitespace-nowrap">
            {city.name}
          </span>
          <span
            className="rounded px-1 py-0.2 font-mono text-[9.5px] font-bold tabular-nums whitespace-nowrap"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              color: city.secondaryHex,
              border: `1px solid ${city.accentHex}66`,
            }}
          >
            Lv.{city.level}
          </span>
        </div>
      </button>
    </div>
  );
};
