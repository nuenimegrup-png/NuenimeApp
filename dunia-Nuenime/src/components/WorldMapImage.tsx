import React, { useState } from 'react';
import { WorldMagicalEffectsLayer } from './WorldMagicalEffectsLayer';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';

interface WorldMapImageProps {
  onImageLoaded?: () => void;
}

/**
 * WorldMapImage merender ilustrasi dasar Peta Dunia Nuenime 2D Top-Down yang bersih
 * (/assets/aistudio/image_e062b5a4.png, 1024 x 1536, rasio 2:3) tanpa teks atau UI tertanam.
 * Seluruh nama kota, emblem kota, marker, dan kontrol dirender terpisah sebagai komponen UI.
 */
export const WorldMapImage: React.FC<WorldMapImageProps> = ({ onImageLoaded }) => {
  const [loaded, setLoaded] = useState(false);
  const { timeOfDay } = useNuenimeRpg();

  const imageFilter =
    timeOfDay === 'day'
      ? 'contrast(1.02) saturate(1.03) brightness(1.0)'
      : timeOfDay === 'dusk'
      ? 'contrast(1.06) saturate(1.16) brightness(0.92) sepia(0.14)'
      : 'contrast(1.12) saturate(1.1) brightness(0.75)';

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#07182c]">
      {/* Clean Painted Fantasy World Map Illustration (1024 x 1536, 2:3 Aspect Ratio) */}
      <img
        src="/assets/aistudio/image_e062b5a4.png"
        alt="Ilustrasi Peta Dunia Fantasi Nuenime"
        draggable={false}
        decoding="async"
        fetchPriority="high"
        onLoad={() => {
          setLoaded(true);
          onImageLoaded?.();
        }}
        className={`pointer-events-none block h-full w-full select-none object-fill transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-95'
        }`}
        style={{
          filter: imageFilter,
        }}
      />

      {/* Dynamic Time-of-Day Atmosphere Lighting Scrim */}
      {timeOfDay === 'dusk' && (
        <div
          className="pointer-events-none absolute inset-0 mix-blend-overlay transition-opacity duration-500"
          style={{
            background:
              'linear-gradient(160deg, rgba(251, 146, 60, 0.3) 0%, rgba(168, 85, 247, 0.25) 65%, rgba(15, 23, 42, 0.42) 100%)',
          }}
        />
      )}

      {timeOfDay === 'night' && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(14, 30, 64, 0.26) 0%, rgba(4, 10, 26, 0.54) 100%)',
          }}
        />
      )}

      {/* World-Space Magical Glows, Rotating Rings, Tidal Ripples & Shimmering Particles */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
          timeOfDay === 'night'
            ? 'opacity-100 brightness-125'
            : timeOfDay === 'dusk'
            ? 'opacity-90 brightness-110'
            : 'opacity-80'
        }`}
      >
        <WorldMagicalEffectsLayer />
      </div>
    </div>
  );
};
