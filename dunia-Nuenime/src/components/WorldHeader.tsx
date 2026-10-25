import React from 'react';
import {
  ArrowLeft,
  Sun,
  Sunset,
  Moon,
  Volume2,
  VolumeX,
  Navigation,
  Flame,
  UserCheck,
} from 'lucide-react';
import { WorldGlobeIcon } from './icons/NuenimeAssets';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';
import { TimeOfDayMode } from '../types/nuenime';

interface WorldHeaderProps {
  onBackClick: () => void;
  onOpenWorldInfo: () => void;
  onOpenLegendModal: () => void;
  onOpenRoutePlanner: () => void;
  onCycleWorldBoss: () => void;
}

function formatCompactCrystals(amount: number): string {
  if (amount >= 1_000_000_000) {
    return (amount / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(2).replace(/\.00$/, '').replace(/\.0$/, '') + 'M';
  }
  if (amount >= 100_000) {
    return (amount / 1_000).toFixed(0) + 'K';
  }
  return amount.toLocaleString('id-ID');
}

export const WorldHeader: React.FC<WorldHeaderProps> = ({
  onBackClick,
  onOpenWorldInfo,
  onOpenLegendModal,
  onOpenRoutePlanner,
  onCycleWorldBoss,
}) => {
  const {
    timeOfDay,
    setTimeOfDay,
    soundEnabled,
    toggleSound,
    activeRoute,
    activeAccount,
    userCrystals,
  } = useNuenimeRpg();

  const cycleTimeOfDay = () => {
    const next: Record<TimeOfDayMode, TimeOfDayMode> = {
      day: 'dusk',
      dusk: 'night',
      night: 'day',
    };
    setTimeOfDay(next[timeOfDay]);
  };

  return (
    <header className="pointer-events-none absolute top-0 left-0 right-0 z-30 flex flex-col gap-1.5 px-2 pt-2 sm:px-3 sm:pt-3">
      {/* Row 1: Main RPG Header Plaque */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        {/* Back Button */}
        <button
          type="button"
          onClick={onBackClick}
          aria-label="Kembali ke Nuenime"
          title="Kembali ke Aplikasi Utama Nuenime"
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-[#0B0E14]/95 text-slate-100 shadow-[0_4px_14px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-all hover:border-sky-400/60 hover:text-white active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Central Obsidian Plaque */}
        <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-xl border border-slate-700/80 bg-[#0B0E14]/95 px-2 py-1 shadow-[0_6px_20px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:px-2.5 sm:py-1.5">
          {/* Left: Emblem & Title */}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <img
              src="/assets/nuenime/dunia-nuenime-emblem.png"
              alt="Dunia Nuenime Emblem"
              className="h-6 w-6 shrink-0 object-contain drop-shadow-[0_0_8px_rgba(56,189,248,0.5)] sm:h-7 sm:w-7"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <h1 className="font-display truncate text-[13px] font-bold leading-tight text-white tracking-tight sm:text-[14px]">
                  Dunia Nuenime
                </h1>
                <span className="rounded border border-sky-400/40 bg-sky-950/90 px-1 py-0.2 font-mono text-[8px] font-bold text-sky-200 whitespace-nowrap">
                  RPG
                </span>
              </div>
              <p className="truncate text-[9.5px] leading-tight font-medium text-slate-400">
                {activeAccount.displayName}
              </p>
            </div>
          </div>

          {/* Right: Crystal Pill & RPG Actions */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {/* Crystal Balance Badge */}
            <div
              title={`Saldo Crystal: ${userCrystals.toLocaleString('id-ID')} Crystal\n(Dibutuhkan 2.000 Crystal untuk mendirikan klan)`}
              className="flex h-7 items-center gap-1 rounded-lg border border-sky-400/40 bg-sky-950/70 px-1.5 font-mono text-[10.5px] font-bold text-sky-200 shadow-sm sm:h-8 sm:px-2"
            >
              <span className="text-[11px] leading-none">💎</span>
              <span className="tabular-nums">
                <span className="min-[430px]:hidden">{formatCompactCrystals(userCrystals)}</span>
                <span className="hidden min-[430px]:inline">{userCrystals.toLocaleString('id-ID')}</span>
              </span>
            </div>

            {/* Audio Toggle Button */}
            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundEnabled ? 'Matikan suara RPG' : 'Aktifkan suara RPG'}
              title={soundEnabled ? 'Audio RPG Aktif' : 'Audio RPG Bisu'}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all active:scale-95 sm:h-8 sm:w-8 ${
                soundEnabled
                  ? 'border-sky-400/55 bg-sky-950/80 text-sky-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>

            {/* Guide Button */}
            <button
              type="button"
              onClick={onOpenLegendModal}
              aria-label="Panduan Eksplorasi Dunia"
              title="Panduan Peta & Kontrol"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-600/70 bg-slate-900 font-display text-xs font-bold text-slate-100 transition-all hover:border-sky-400/60 hover:text-sky-200 active:scale-95 sm:h-8 sm:w-8"
            >
              !
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Precision 4-Column Action Bar (No text cut-offs on any mobile width) */}
      <div className="pointer-events-auto grid grid-cols-4 gap-1 sm:gap-1.5">
        {/* Time of Day Atmosphere Switcher */}
        <button
          type="button"
          onClick={cycleTimeOfDay}
          className="flex h-[34px] items-center justify-center gap-1 rounded-xl border border-slate-700/80 bg-[#0B0E14]/95 px-1 text-[10px] font-semibold text-slate-100 shadow-md backdrop-blur-xl transition-all hover:border-sky-400/50 active:scale-95 sm:px-2 sm:text-[10.5px]"
        >
          {timeOfDay === 'day' && <Sun className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
          {timeOfDay === 'dusk' && <Sunset className="h-3.5 w-3.5 shrink-0 text-orange-300" />}
          {timeOfDay === 'night' && <Moon className="h-3.5 w-3.5 shrink-0 text-purple-300" />}
          <span className="truncate">
            {timeOfDay === 'day' ? 'Siang' : timeOfDay === 'dusk' ? 'Senja' : 'Malam'}
          </span>
        </button>

        {/* Airship / Route Simulator Trigger */}
        <button
          type="button"
          onClick={onOpenRoutePlanner}
          className={`flex h-[34px] items-center justify-center gap-1 rounded-xl border px-1 text-[10px] font-semibold shadow-md backdrop-blur-xl transition-all active:scale-95 sm:px-2 sm:text-[10.5px] ${
            activeRoute
              ? 'border-amber-400/70 bg-amber-950/95 text-amber-100'
              : 'border-slate-700/80 bg-[#0B0E14]/95 text-slate-100 hover:border-sky-400/50'
          }`}
        >
          <Navigation className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span className="truncate">
            {activeRoute ? 'Rute Aktif' : 'Rute'}
            <span className="hidden min-[380px]:inline">&nbsp;Kota</span>
          </span>
        </button>

        {/* 7 City Bosses Radar Trigger */}
        <button
          type="button"
          onClick={onCycleWorldBoss}
          className="flex h-[34px] items-center justify-center gap-1 rounded-xl border border-rose-500/40 bg-[#0B0E14]/95 px-1 text-[10px] font-semibold text-rose-100 shadow-md backdrop-blur-xl transition-all hover:border-rose-400 active:scale-95 sm:px-2 sm:text-[10.5px]"
        >
          <Flame className="h-3.5 w-3.5 shrink-0 text-rose-400" />
          <span className="truncate">
            7 Bos<span className="hidden min-[380px]:inline">&nbsp;Kota</span>
          </span>
        </button>

        {/* Info Dunia & Statistik Global Button */}
        <button
          type="button"
          onClick={onOpenWorldInfo}
          className="flex h-[34px] items-center justify-center gap-1 rounded-xl border border-slate-700/80 bg-[#0B0E14]/95 px-1 text-[10px] font-semibold text-slate-100 shadow-md backdrop-blur-xl transition-all hover:border-sky-400/50 active:scale-95 sm:px-2 sm:text-[10.5px]"
        >
          <WorldGlobeIcon size={14} className="shrink-0 text-sky-300" />
          <span className="truncate">
            Info<span className="hidden min-[380px]:inline">&nbsp;Dunia</span>
          </span>
        </button>
      </div>
    </header>
  );
};
