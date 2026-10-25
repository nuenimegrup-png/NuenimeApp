import React, { useState } from 'react';
import { ChevronRight, Users, X, Shield, Heart, Sparkles, Flame } from 'lucide-react';
import { WorldCity } from '../types/nuenime';
import { CityEmblemBadge } from './icons/NuenimeAssets';

interface CityInfoPanelProps {
  city: WorldCity | null;
  onEnterCity: (city: WorldCity) => void;
  onSelectCityBoss?: (city: WorldCity) => void;
  onClose: () => void;
}

/**
 * CityInfoPanel menampilkan kartu informasi kota yang dipilih di bagian bawah peta
 * tepat di atas BottomNavigationBar dengan latar belakang solid (#070e1b/98)
 * dan menampilkan Level, Tier, HP Kota (10.000/10.000), Total EXP Kota,
 * Pemimpin Kota (Demo), Bos Kota, dan Jumlah Klan (X/15).
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
      {/* Solid High-Contrast Dark Obsidian RPG Panel */}
      <div className="relative flex flex-col gap-2.5 rounded-2xl border border-slate-400/40 bg-[#070e1b]/98 p-3 shadow-[0_12px_34px_rgba(0,0,0,0.94)] backdrop-blur-xl">
        {/* Top-right close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup panel informasi kota"
          className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/90 text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Top Row: Thumbnail + City Title, Level/Tier, Leader & Boss */}
        <div className="flex items-center gap-3">
          {/* Left Circular City Thumbnail with Top Crown Spike & Bottom Shield Badge */}
          <div className="relative shrink-0 py-1">
            <div
              className="absolute top-0 left-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-t border-l border-sky-200/80 bg-slate-900"
              aria-hidden="true"
            />

            <div
              className="relative h-[74px] w-[74px] overflow-hidden rounded-full border-2 bg-slate-950 shadow-[0_0_16px_rgba(56,189,248,0.28)]"
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
                  <CityEmblemBadge cityId={city.id} material={city.material} size={40} />
                </div>
              )}
            </div>

            {/* Bottom Shield Emblem Overlay */}
            <div className="absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 drop-shadow-[0_3px_6px_rgba(0,0,0,0.95)]">
              <CityEmblemBadge cityId={city.id} material={city.material} size={26} selected />
            </div>
          </div>

          {/* Right Info Column */}
          <div className="min-w-0 flex-1">
            <div className="pr-7">
              <div className="flex items-center gap-1.5">
                <span className="rounded border border-sky-400/50 bg-sky-950/90 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-sky-200 tabular-nums">
                  Lv.{city.level} · {city.tier}
                </span>
                <span className="truncate text-[10px] font-semibold text-slate-300">
                  {city.regionName}
                </span>
              </div>
              <h2 className="font-display mt-0.5 truncate text-base leading-tight font-bold tracking-wide text-white">
                {city.name}
              </h2>
            </div>

            {/* City HP & Leader Row */}
            <div className="mt-1 grid grid-cols-2 gap-1.5 text-[10.5px]">
              <div className="flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-950/40 px-2 py-1 text-emerald-200">
                <Heart className="h-3 w-3 shrink-0 text-emerald-400" />
                <span className="font-mono font-bold tabular-nums truncate">
                  HP Kota: {city.currentHp.toLocaleString('id-ID')}/{city.maxHp.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-950/35 px-2 py-1 text-amber-200">
                <Shield className="h-3 w-3 shrink-0 text-amber-300" />
                <span className="truncate">
                  Kota Terbuka ({city.clans.length} Klan)
                </span>
              </div>
            </div>

            {/* City EXP Progress Bar */}
            <div className="mt-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="inline-flex items-center gap-1 font-semibold text-sky-200">
                  <Sparkles className="h-3 w-3 text-sky-300" />
                  <span>Total EXP: {city.totalExp.toLocaleString('id-ID')}</span>
                </span>
                <span className="font-mono text-slate-300 tabular-nums">
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

        {/* Bottom Footer Row: Clans Count, Guardian Boss Quick Pill, and "Masuk ke Kota >" CTA */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-800/90 pt-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Clan capacity indicator (X / 15 Klan) */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-slate-100 whitespace-nowrap shrink-0">
              <Users className="h-3.5 w-3.5 text-sky-300" />
              <span className="font-mono tabular-nums">
                {city.clans.length}/{city.maxClans}
              </span>
              <span>Klan</span>
            </div>

            {/* City Boss Quick Trigger */}
            {onSelectCityBoss && (
              <button
                type="button"
                onClick={() => onSelectCityBoss(city)}
                className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/45 px-2 py-1 text-[10.5px] font-semibold text-rose-200 hover:border-rose-400/70 truncate"
              >
                <Flame className="h-3 w-3 shrink-0 text-rose-400" />
                <span className="truncate">Bos: {city.boss.name}</span>
              </button>
            )}
          </div>

          {/* "Masuk ke Kota >" CTA Button */}
          <button
            type="button"
            onClick={() => onEnterCity(city)}
            className="flex h-[36px] items-center gap-1 rounded-full border border-sky-200/60 bg-gradient-to-r from-slate-800 via-sky-900 to-slate-800 px-3.5 text-xs font-bold text-white shadow-[0_0_14px_rgba(56,189,248,0.28)] transition-all duration-150 hover:border-sky-200 active:scale-95 whitespace-nowrap shrink-0"
          >
            <span>Masuk ke Kota</span>
            <ChevronRight className="h-4 w-4 text-sky-200" />
          </button>
        </div>
      </div>
    </div>
  );
};
