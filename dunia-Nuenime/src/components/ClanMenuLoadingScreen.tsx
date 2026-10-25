import React, { useEffect, useState } from 'react';
import { Users, Gem, Trophy } from 'lucide-react';

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
 * Layar Loading minimalis saat pengguna masuk ke Menu Klan / Markas Klan.
 * Hanya menampilkan teks status, progress bar, dan 3 kartu informasi sistem klan.
 */
export const ClanMenuLoadingScreen: React.FC<ClanMenuLoadingScreenProps> = ({
  title = 'Membuka Aula Klan Nuenime',
  subtitle = 'Memuat Direktori & Leaderboard Klan',
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
      className={`relative flex w-full flex-col items-center justify-center overflow-hidden bg-[#070d19] px-4 text-slate-100 select-none ${
        compact ? 'min-h-[300px] flex-1 py-6' : 'h-full flex-1 py-8'
      }`}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      {/* Atmospheric Subtle Radial Glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${accentColor}33 0%, rgba(11, 14, 20, 0.4) 60%, transparent 85%)`,
        }}
      />

      <div className="relative z-10 flex w-full max-w-[340px] flex-col items-center text-center">
        {/* Title & Subtitle (Clean Text Only - No Logo) */}
        <h2 className="font-display text-base sm:text-lg font-bold tracking-wide text-white leading-snug">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-400 font-medium">
            {subtitle}
          </p>
        )}

        {/* Progress Bar & Status Step */}
        <div className="mt-5 w-full">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="truncate text-slate-300 font-medium text-left mr-2">
              {LOADING_STEPS[stepIndex]}
            </span>
            <span className="font-mono font-bold text-amber-300 tabular-nums shrink-0">
              {progress}%
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full border border-slate-700/80 bg-slate-900/90 p-0.5 shadow-inner">
            <div
              className="h-full rounded-full transition-all duration-200 ease-out"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${accentColor}, #FBBF24)`,
                boxShadow: `0 0 10px ${accentColor}88`,
              }}
            />
          </div>
        </div>

        {/* 3 Information Cards (Refined & Accurate to Rules) */}
        <div className="mt-6 grid w-full grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/90 bg-slate-900/80 px-2 py-3 shadow-sm">
            <Users className="h-4 w-4 text-sky-400 mb-1" />
            <span className="font-mono text-xs font-bold text-white tabular-nums">
              100 Anggota
            </span>
            <span className="mt-0.5 text-[9.5px] text-slate-400">
              Kapasitas Maks
            </span>
          </div>

          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/90 bg-slate-900/80 px-2 py-3 shadow-sm">
            <Gem className="h-4 w-4 text-amber-400 mb-1" />
            <span className="font-mono text-xs font-bold text-amber-300 tabular-nums">
              2.000 💎
            </span>
            <span className="mt-0.5 text-[9.5px] text-slate-400">
              Biaya Buat Klan
            </span>
          </div>

          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/90 bg-slate-900/80 px-2 py-3 shadow-sm">
            <Trophy className="h-4 w-4 text-emerald-400 mb-1" />
            <span className="font-mono text-xs font-bold text-emerald-300 tabular-nums">
              Misi & EXP
            </span>
            <span className="mt-0.5 text-[9.5px] text-slate-400">
              Kontribusi Level
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
