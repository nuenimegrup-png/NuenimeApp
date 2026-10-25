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
import { CompassRoseIcon, NuenimeCrestIcon, WorldGlobeIcon } from './icons/NuenimeAssets';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';
import { TimeOfDayMode } from '../types/nuenime';

interface WorldHeaderProps {
  onBackClick: () => void;
  onOpenWorldInfo: () => void;
  onOpenLegendModal: () => void;
  onOpenRoutePlanner: () => void;
  onCycleWorldBoss: () => void;
  onOpenAccountSwitcher: () => void;
}

export const WorldHeader: React.FC<WorldHeaderProps> = ({
  onBackClick,
  onOpenWorldInfo,
  onOpenLegendModal,
  onOpenRoutePlanner,
  onCycleWorldBoss,
  onOpenAccountSwitcher,
}) => {
  const {
    timeOfDay,
    setTimeOfDay,
    soundEnabled,
    toggleSound,
    activeRoute,
    activeAccount,
    cities,
  } = useNuenimeRpg();

  const cycleTimeOfDay = () => {
    const next: Record<TimeOfDayMode, TimeOfDayMode> = {
      day: 'dusk',
      dusk: 'night',
      night: 'day',
    };
    setTimeOfDay(next[timeOfDay]);
  };

  const ledCity = activeAccount.ledCityId
    ? cities.find((c) => c.id === activeAccount.ledCityId)
    : undefined;

  return (
    <header className="pointer-events-none absolute top-0 left-0 right-0 z-30 flex flex-col gap-1.5 px-2.5 pt-2.5">
      {/* Row 1: Main RPG Header Plaque */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        {/* Circular Back Button */}
        <button
          type="button"
          onClick={onBackClick}
          aria-label="Kembali"
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-slate-500/50 bg-[#070e1b]/95 text-slate-100 shadow-[0_4px_14px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-transform duration-150 hover:border-sky-300/60 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5 text-slate-100" />
        </button>

        {/* Central Dark Obsidian Title Plaque (Opaque so map labels never bleed through) */}
        <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-2xl border border-slate-500/45 bg-[#070e1b]/95 px-2.5 py-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <CompassRoseIcon
              size={26}
              className="shrink-0 drop-shadow-[0_0_6px_rgba(56,189,248,0.45)]"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="font-display truncate text-[14.5px] leading-tight font-bold tracking-wide text-white">
                  Dunia Nuenime
                </h1>
                <span className="rounded border border-amber-400/50 bg-amber-950/90 px-1 py-0.2 font-mono text-[8.5px] font-bold text-amber-200 whitespace-nowrap">
                  DEMO
                </span>
              </div>
              <p className="truncate text-[10px] leading-tight font-medium text-slate-300">
                {activeAccount.role === 'CITY_LEADER'
                  ? `Pemimpin Kota ${ledCity?.name ?? ''} (${activeAccount.displayName})`
                  : `Anggota Klan (${activeAccount.displayName})`}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {/* Demo Account Switcher Button (7 Pemimpin Kota & Anggota) */}
            <button
              type="button"
              onClick={onOpenAccountSwitcher}
              aria-label="Ganti Akun Demo Pemimpin Kota atau Anggota"
              title="Pilih Akun Demo (7 Pemimpin Kota / Anggota)"
              className="flex h-8 items-center gap-1 rounded-full border border-amber-400/55 bg-amber-950/85 px-2 text-[10px] font-bold text-amber-200 transition-colors hover:border-amber-300 active:scale-95"
            >
              <UserCheck className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              <span className="hidden xs:inline">Akun</span>
            </button>

            {/* Audio RPG Toggle Button */}
            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundEnabled ? 'Matikan suara RPG' : 'Aktifkan suara RPG'}
              title={soundEnabled ? 'Audio RPG Aktif' : 'Audio RPG Bisu'}
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors active:scale-95 ${
                soundEnabled
                  ? 'border-sky-400/55 bg-sky-950/80 text-sky-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>

            {/* Exclamation Guide Button */}
            <button
              type="button"
              onClick={onOpenLegendModal}
              aria-label="Panduan Eksplorasi Dunia"
              title="Panduan Peta & Kontrol"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-500/50 bg-slate-900 font-display text-xs font-bold text-slate-100 transition-colors hover:border-sky-300/60 hover:text-sky-200 active:scale-95"
            >
              !
            </button>

            {/* Decorative Fantasy Crest */}
            <button
              type="button"
              onClick={onOpenWorldInfo}
              aria-label="Simbol Dunia Nuenime"
              className="flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-95"
            >
              <NuenimeCrestIcon size={30} />
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Precision 4-Column RPG Action Bar (Fits 100% evenly on all mobile widths) */}
      <div className="pointer-events-auto grid grid-cols-4 gap-1.5">
        {/* Time of Day Atmosphere Switcher */}
        <button
          type="button"
          onClick={cycleTimeOfDay}
          className="flex h-[34px] items-center justify-center gap-1 rounded-xl border border-slate-500/45 bg-[#070e1b]/95 px-2 text-[10.5px] font-semibold text-slate-100 shadow-md backdrop-blur-xl transition-all hover:border-sky-300/60 active:scale-95"
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
          className={`flex h-[34px] items-center justify-center gap-1 rounded-xl border px-2 text-[10.5px] font-semibold shadow-md backdrop-blur-xl transition-all active:scale-95 ${
            activeRoute
              ? 'border-amber-400/70 bg-amber-950/95 text-amber-100'
              : 'border-slate-500/45 bg-[#070e1b]/95 text-slate-100 hover:border-sky-300/60'
          }`}
        >
          <Navigation className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span className="truncate">{activeRoute ? 'Rute Aktif' : 'Rute Kota'}</span>
        </button>

        {/* 7 City Bosses Radar Trigger */}
        <button
          type="button"
          onClick={onCycleWorldBoss}
          className="flex h-[34px] items-center justify-center gap-1 rounded-xl border border-rose-400/50 bg-[#070e1b]/95 px-2 text-[10.5px] font-semibold text-rose-100 shadow-md backdrop-blur-xl transition-all hover:border-rose-300 active:scale-95"
        >
          <Flame className="h-3.5 w-3.5 shrink-0 text-rose-400" />
          <span className="truncate">7 Bos Kota</span>
        </button>

        {/* Info Dunia & Statistik Global Button */}
        <button
          type="button"
          onClick={onOpenWorldInfo}
          className="flex h-[34px] items-center justify-center gap-1 rounded-xl border border-slate-500/45 bg-[#070e1b]/95 px-2 text-[10.5px] font-semibold text-slate-100 shadow-md backdrop-blur-xl transition-all hover:border-sky-300/60 active:scale-95"
        >
          <WorldGlobeIcon size={14} className="shrink-0 text-sky-300" />
          <span className="truncate">Info Dunia</span>
        </button>
      </div>
    </header>
  );
};
