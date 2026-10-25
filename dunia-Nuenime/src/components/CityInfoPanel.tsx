import React, { useState } from 'react';
import { ChevronRight, Users, X, Shield, Heart, Flame } from 'lucide-react';
import { WorldCity } from '../types/nuenime';
import { CityEmblemBadge } from './icons/NuenimeAssets';

interface CityInfoPanelProps {
  city: WorldCity | null;
  onEnterCity: (city: WorldCity) => void;
  onSelectCityBoss?: (city: WorldCity) => void;
  onClose: () => void;
}

/**
 * CityInfoPanel menampilkan kartu informasi kota yang dipilih di bagian bawah peta.
 * Didesain presisi, rapi, responsif mobile, tanpa bayangan (flat modern),
 * dengan ukuran tombol seragam dan tema Dark Obsidian Nuenime.
 */
export const CityInfoPanel: React.FC<CityInfoPanelProps> = ({
  city,
  onEnterCity,
  onSelectCityBoss,
  onClose,
}) => {
  const [thumbError, setThumbError] = useState<Record<string, boolean>>({});

  if (!city) return null;

  const hasError = !!thumbError[city.id];
  const expPercent = Math.min(
    100,
    Math.round((city.currentLevelExp / Math.max(1, city.nextLevelTargetExp)) * 100)
  );
  const remainingExp = Math.max(0, city.nextLevelTargetExp - city.currentLevelExp);

  return (
    <div
      className="pointer-events-auto absolute bottom-2.5 left-2.5 right-2.5 z-30 transition-all duration-200"
      role="region"
      aria-label={`Informasi Kota ${city.name}`}
    >
      {/* Nuenime Dark Obsidian Card (No shadow, flat modern & clean border) */}
      <div className="relative flex flex-col gap-2.5 rounded-2xl border border-slate-700/80 bg-[#0B0E14]/98 p-3 backdrop-blur-xl">
        {/* Top-right close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup panel informasi kota"
          className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/90 text-slate-300 transition-colors hover:border-slate-500 hover:text-white active:scale-95"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Top Row: Thumbnail + City Title, Level/Tier, HP & EXP */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Left Circular City Thumbnail with Top Diamond Spike & Bottom Shield Badge (No shadows) */}
          <div className="relative shrink-0 py-1">
            <div
              className="absolute top-0 left-1/2 z-10 h-2 w-2 -translate-x-1/2 rotate-45 border-t border-l border-sky-400/80 bg-slate-900"
              aria-hidden="true"
            />

            <div
              className="relative h-[66px] w-[66px] overflow-hidden rounded-full border-2 bg-slate-950 sm:h-[72px] sm:w-[72px]"
              style={{ borderColor: city.secondaryHex }}
            >
              {!hasError ? (
                <img
                  src={city.thumbnailAsset}
                  alt={`Ilustrasi kota ${city.name}`}
                  referrerPolicy="no-referrer"
                  onError={() => setThumbError((prev) => ({ ...prev, [city.id]: true }))}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{
                    background: `radial-gradient(circle, ${city.accentHex}44 0%, #0f172a 100%)`,
                  }}
                >
                  <CityEmblemBadge cityId={city.id} material={city.material} size={36} />
                </div>
              )}
            </div>

            {/* Bottom Shield Emblem Overlay */}
            <div className="absolute -bottom-1 left-1/2 z-10 -translate-x-1/2">
              <CityEmblemBadge cityId={city.id} material={city.material} size={24} selected />
            </div>
          </div>

          {/* Right Info Column */}
          <div className="min-w-0 flex-1">
            {/* Level, Tier & Region (Padded right so it never collides with close button) */}
            <div className="flex items-center gap-1.5 pr-7 flex-wrap">
              <span className="shrink-0 rounded border border-sky-400/40 bg-sky-950/80 px-1.5 py-0.2 font-mono text-[9px] font-bold text-sky-200 tabular-nums">
                Lv.{city.level} · {city.tier}
              </span>
              <span className="truncate text-[10px] font-medium text-slate-400">
                {city.regionName}
              </span>
            </div>

            {/* City Name */}
            <h2 className="font-display truncate text-[15px] font-bold leading-tight tracking-wide text-white mt-0.5">
              {city.name}
            </h2>

            {/* City HP & Open Clan Status (Cleanly formatted to never truncate on mobile) */}
            <div className="mt-1 flex items-center gap-1.5 text-[10px]">
              <div className="flex flex-1 min-w-0 items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-1.5 py-0.5 text-emerald-200">
                <Heart className="h-3 w-3 shrink-0 text-emerald-400" />
                <span className="font-mono font-bold tabular-nums truncate">
                  HP: {city.currentHp.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex flex-1 min-w-0 items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-950/30 px-1.5 py-0.5 text-amber-200">
                <Shield className="h-3 w-3 shrink-0 text-amber-300" />
                <span className="truncate">
                  Terbuka ({city.clans.length} Klan)
                </span>
              </div>
            </div>

            {/* City EXP Progress Bar */}
            <div className="mt-1">
              <div className="flex items-center justify-between text-[9.5px]">
                <span className="font-medium text-slate-300 truncate">
                  EXP: <strong className="font-mono text-sky-200 font-bold">{city.totalExp.toLocaleString('id-ID')}</strong>
                </span>
                <span className="font-mono text-slate-400 tabular-nums shrink-0 ml-1">
                  +{remainingExp.toLocaleString('id-ID')} ke Lv.{city.level + 1}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${expPercent}%`,
                    backgroundColor: city.accentHex,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer Row: All 3 Buttons have the EXACT SAME HEIGHT (h-[36px]), rounded-xl, no shadow */}
        <div className="grid grid-cols-3 gap-1.5 border-t border-slate-800/80 pt-2">
          {/* 1. Clan Capacity Indicator */}
          <div className="flex h-[36px] items-center justify-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/90 px-1 text-[11px] font-semibold text-slate-100">
            <Users className="h-3.5 w-3.5 shrink-0 text-sky-300" />
            <span className="font-mono tabular-nums">
              {city.clans.length}/{city.maxClans}
            </span>
            <span>Klan</span>
          </div>

          {/* 2. City Boss Quick Trigger */}
          {onSelectCityBoss ? (
            <button
              type="button"
              onClick={() => onSelectCityBoss(city)}
              className="flex h-[36px] items-center justify-center gap-1 rounded-xl border border-rose-500/40 bg-rose-950/40 px-1 text-[11px] font-semibold text-rose-200 transition-all hover:border-rose-400 active:scale-95"
            >
              <Flame className="h-3.5 w-3.5 shrink-0 text-rose-400" />
              <span className="truncate">Bos: {city.boss.name}</span>
            </button>
          ) : (
            <div className="flex h-[36px] items-center justify-center gap-1 rounded-xl border border-rose-500/30 bg-rose-950/20 px-1 text-[11px] font-semibold text-rose-300">
              <Flame className="h-3.5 w-3.5 shrink-0 text-rose-400" />
              <span className="truncate">Bos: {city.boss.name}</span>
            </div>
          )}

          {/* 3. "Masuk ke Kota" CTA Button (Matching h-[36px], rounded-xl, Nuenime Sky) */}
          <button
            type="button"
            onClick={() => onEnterCity(city)}
            className="flex h-[36px] items-center justify-center gap-1 rounded-xl border border-sky-400/50 bg-sky-600 px-1 text-[11px] font-bold text-white transition-all hover:bg-sky-500 active:scale-95"
          >
            <span className="truncate">Masuk Kota</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sky-100" />
          </button>
        </div>
      </div>
    </div>
  );
};
