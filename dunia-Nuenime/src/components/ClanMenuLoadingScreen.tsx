import React, { useEffect, useState } from 'react';
import { Shield, Trophy, Users } from 'lucide-react';
import { NuenimeCrestIcon, CompassRoseIcon } from './icons/NuenimeAssets';

interface ClanMenuLoadingScreenProps {
  title?: string;
  subtitle?: string;
  accentColor?: string;
  compact?: boolean;
}

const LOADING_STEPS = [
  'Menghubungkan ke Arsip Agung Klan Nuenime...',
  'Memverifikasi Kontribusi EXP & Kapasitas Anggota...',
  'Menyinkronkan Peringkat Leaderboard Klan...',
];

/**
 * Layar Loading bergaya Fantasi RPG saat pengguna masuk ke Menu Klan / Markas Klan.
 * Menampilkan lambang perisai klan berputar dengan cincin rune bercahaya,
 * indikator persentase progres, serta skeleton kartu klan di latar bawah.
 */
export const ClanMenuLoadingScreen: React.FC<ClanMenuLoadingScreenProps> = ({
  title = 'Membuka Aula Klan Nuenime',
  subtitle = 'Memuat Direktori & Leaderboard Klan 7 Kota',
  accentColor = '#38BDF8',
  compact = false,
}) => {
  const [progress, setProgress] = useState<number>(18);
  const [stepIndex, setStepIndex] = useState<number>(0);

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      setProgress(58);
      setStepIndex(1);
    }, 180);

    const t2 = window.setTimeout(() => {
      setProgress(92);
      setStepIndex(2);
    }, 360);

    const t3 = window.setTimeout(() => {
      setProgress(100);
    }, 520);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  return (
    <div
      className={`relative flex w-full flex-col items-center justify-center overflow-hidden bg-[#060c18] px-5 text-slate-100 select-none ${
        compact ? 'min-h-[380px] flex-1 py-8' : 'h-full flex-1 py-10'
      }`}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      {/* Atmospheric Radial Glow Background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          background: `radial-gradient(circle at 50% 38%, ${accentColor}44 0%, rgba(15, 23, 42, 0.1) 55%, transparent 80%)`,
        }}
      />

      {/* Central Arcane Rune & Shield Crest */}
      <div className="relative flex h-28 w-28 items-center justify-center">
        {/* Outer Pulsing Aura Ring */}
        <span
          className="animate-pulse-ring pointer-events-none absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 28px 4px ${accentColor}66`,
            border: `1.5px solid ${accentColor}`,
          }}
        />

        {/* Rotating Outer Rune Circle */}
        <svg
          viewBox="0 0 120 120"
          className="pointer-events-none absolute inset-0 h-full w-full animate-spin"
          style={{ animationDuration: '9s' }}
        >
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={accentColor}
            strokeWidth="1.5"
            strokeDasharray="8 6 2 6"
            strokeOpacity="0.75"
          />
          <circle
            cx="60"
            cy="60"
            r="44"
            fill="none"
            stroke="#FBBF24"
            strokeWidth="1.2"
            strokeDasharray="4 8"
            strokeOpacity="0.55"
          />
        </svg>

        {/* Inner Obsidian Medallion with Crest */}
        <div
          className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full border-2 bg-[#070e1b] shadow-[0_0_24px_rgba(0,0,0,0.9)]"
          style={{ borderColor: accentColor }}
        >
          <NuenimeCrestIcon size={46} />
          <CompassRoseIcon
            size={20}
            className="absolute -bottom-2 rounded-full border border-slate-700 bg-slate-950 p-0.5"
          />
        </div>
      </div>

      {/* RPG Loading Title & Subtitle */}
      <div className="relative z-10 mt-4 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-950/75 px-3 py-0.5 text-[10px] font-bold tracking-wider text-sky-200 uppercase">
          <Shield className="h-3 w-3 text-amber-300" />
          <span>Gerbang Komunitas Klan</span>
        </div>

        <h2 className="font-display mt-2 text-base font-bold tracking-wide text-white">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-slate-300">{subtitle}</p>
      </div>

      {/* Progress Bar & Step Status */}
      <div className="relative z-10 mt-5 w-full max-w-[290px]">
        <div className="mb-1.5 flex items-center justify-between text-[10.5px]">
          <span className="truncate font-medium text-sky-200">
            {LOADING_STEPS[stepIndex]}
          </span>
          <span className="font-mono font-bold text-amber-300 tabular-nums shrink-0 ml-2">
            {progress}%
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full border border-slate-700/80 bg-slate-900 p-0.5">
          <div
            className="h-full rounded-full transition-all duration-200 ease-out"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${accentColor}, #FBBF24)`,
              boxShadow: `0 0 12px ${accentColor}`,
            }}
          />
        </div>
      </div>

      {/* RPG Stat Pills Preview */}
      <div className="relative z-10 mt-5 grid w-full max-w-[320px] grid-cols-3 gap-2 text-center">
        <div className="flex flex-col items-center rounded-xl border border-slate-800/90 bg-slate-900/70 p-2">
          <Shield className="h-3.5 w-3.5 text-sky-300" />
          <span className="mt-1 text-[10px] font-semibold text-slate-300">Maks 15 Klan</span>
          <span className="text-[9px] text-slate-500">Per Kota</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-slate-800/90 bg-slate-900/70 p-2">
          <Users className="h-3.5 w-3.5 text-emerald-300" />
          <span className="mt-1 text-[10px] font-semibold text-slate-300">100 Anggota</span>
          <span className="text-[9px] text-slate-500">Per Klan</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-slate-800/90 bg-slate-900/70 p-2">
          <Trophy className="h-3.5 w-3.5 text-amber-300" />
          <span className="mt-1 text-[10px] font-semibold text-slate-300">Aliran EXP</span>
          <span className="text-[9px] text-slate-500">Anggota → Kota</span>
        </div>
      </div>

      {/* Subtle Skeleton Preview Rows */}
      {!compact && (
        <div className="relative z-10 mt-5 w-full max-w-[340px] space-y-2 opacity-60">
          {[1, 2].map((item) => (
            <div
              key={item}
              className="flex animate-pulse items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-2.5"
            >
              <div className="h-9 w-9 shrink-0 rounded-xl bg-slate-800" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-2/3 rounded bg-slate-800" />
                <div className="h-2.5 w-1/2 rounded bg-slate-800/80" />
              </div>
              <div className="h-6 w-14 rounded-lg bg-slate-800" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
