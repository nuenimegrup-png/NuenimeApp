import React, { useState } from 'react';
import { WorldCity } from '../types/nuenime';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';

interface CityMapImageProps {
  city: WorldCity;
}

/**
 * CityMapImage merender Peta Kota Interaktif berbasis ilustrasi HD (/assets/nuenime/city_district_map.webp)
 * dengan medali Benteng Pusat (Citadel) bergambar ilustrasi kastil kota terkait (city.thumbnailAsset),
 * pencahayaan atmosfer elemen kota & siklus waktu, serta efek partikel sihir di sekitar setiap Markas Klan.
 */
export const CityMapImage: React.FC<CityMapImageProps> = ({ city }) => {
  const [loaded, setLoaded] = useState(false);
  const { timeOfDay } = useNuenimeRpg();

  const imageFilter =
    timeOfDay === 'day'
      ? 'contrast(1.06) saturate(1.08) brightness(1.0)'
      : timeOfDay === 'dusk'
      ? 'contrast(1.1) saturate(1.18) brightness(0.9) sepia(0.15)'
      : 'contrast(1.15) saturate(1.12) brightness(0.74)';

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#06121e]">
      {/* High-Definition Painted Fantasy City Map Illustration */}
      <img
        src="/assets/nuenime/city_district_map.webp"
        alt={`Peta Tata Ruang Kota ${city.name}`}
        draggable={false}
        decoding="async"
        fetchPriority="high"
        onLoad={() => setLoaded(true)}
        className={`pointer-events-none block h-full w-full select-none object-fill transition-all duration-500 ${
          loaded ? 'opacity-100' : 'opacity-95'
        }`}
        style={{
          filter: imageFilter,
        }}
      />

      {/* Subtle Elemental Biome Color Wash */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-color opacity-25"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${city.accentHex} 0%, transparent 72%)`,
        }}
      />

      {/* Time-of-Day Atmosphere Scrim on City Map */}
      {timeOfDay === 'dusk' && (
        <div
          className="pointer-events-none absolute inset-0 mix-blend-overlay"
          style={{
            background:
              'linear-gradient(155deg, rgba(251, 146, 60, 0.3) 0%, rgba(168, 85, 247, 0.25) 70%, rgba(15, 23, 42, 0.45) 100%)',
          }}
        />
      )}
      {timeOfDay === 'night' && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(14, 30, 64, 0.25) 0%, rgba(4, 10, 26, 0.55) 100%)',
          }}
        />
      )}

      {/* Central Citadel Medallion (Displays the City's HD Painted Castle!) */}
      <div
        style={{
          left: '50%',
          top: '49.6%',
          width: '21.8%',
          height: '21.8%',
          transform: 'translate(-50%, -50%)',
        }}
        className="pointer-events-none absolute z-10 flex flex-col items-center justify-center rounded-full"
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-full border-[3px] shadow-[0_0_28px_rgba(0,0,0,0.95)]"
          style={{
            borderColor: city.accentHex,
            boxShadow: `0 0 26px ${city.accentHex}66, inset 0 0 18px rgba(0,0,0,0.85)`,
          }}
        >
          <img
            src={city.thumbnailAsset}
            alt={`Benteng Pusat ${city.name}`}
            draggable={false}
            className="h-full w-full object-cover"
            style={{ filter: 'contrast(1.06) saturate(1.08)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-slate-950/40" />

          <div className="absolute inset-x-2 bottom-3 flex flex-col items-center text-center">
            <span
              className="font-mono text-[8.5px] font-bold tracking-[0.18em] uppercase"
              style={{ color: city.secondaryHex }}
            >
              PUSAT KOTA
            </span>
            <span className="font-display text-sm font-bold tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              {city.name.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* World-Space Magical Leylines, District Auras & Shimmering Particles for Clan Strongholds */}
      <svg
        viewBox="0 0 1000 1000"
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-500 ${
          timeOfDay === 'night' ? 'opacity-100 brightness-125' : 'opacity-90'
        }`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`cityAura-${city.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={city.secondaryHex} stopOpacity="0.42" />
            <stop offset="55%" stopColor={city.accentHex} stopOpacity="0.18" />
            <stop offset="100%" stopColor={city.accentHex} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle
          cx="500"
          cy="496"
          r="122"
          fill="none"
          stroke={city.secondaryHex}
          strokeWidth="1.8"
          strokeOpacity="0.55"
          strokeDasharray="12 8 4 8"
          className="animate-magic-orbit"
        />

        {city.clans.map((clan) => {
          const sx = clan.cityMapXPercent * 10;
          const sy = clan.cityMapYPercent * 10;
          return (
            <g key={`fx-${clan.id}`}>
              <line
                x1="500"
                y1="496"
                x2={sx}
                y2={sy}
                stroke={clan.accentColor}
                strokeWidth="2"
                strokeOpacity="0.4"
                strokeDasharray="6 8"
              />
              <circle
                cx={sx}
                cy={sy}
                r="52"
                fill={`url(#cityAura-${city.id})`}
                className="animate-magic-breathe"
              />
              <circle
                cx={sx}
                cy={sy}
                r="30"
                fill="none"
                stroke={clan.accentColor}
                strokeWidth="1.5"
                strokeOpacity="0.6"
                strokeDasharray="8 6"
                className="animate-magic-orbit-reverse"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
