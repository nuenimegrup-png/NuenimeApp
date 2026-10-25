import React, { useEffect, useState } from 'react';

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
 * Hanya menampilkan teks status dan progress bar (tanpa logo, tanpa bayangan, dan tanpa kotak-kotak).
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
      className={`relative flex w-full flex-col items-center justify-center overflow-hidden bg-[#070d19] px-6 text-slate-100 select-none ${
        compact ? 'min-h-[220px] flex-1 py-6' : 'h-full flex-1 py-8'
      }`}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="relative z-10 flex w-full max-w-[340px] flex-col items-center text-center">
        {/* Title & Subtitle (Clean Text Only) */}
        <h2 className="font-display text-base sm:text-lg font-bold tracking-wide text-white leading-snug">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-400 font-medium">
            {subtitle}
          </p>
        )}

        {/* Progress Bar & Status Step (No Shadows / No Boxes) */}
        <div className="mt-6 w-full">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="truncate text-slate-300 font-medium text-left mr-2">
              {LOADING_STEPS[stepIndex]}
            </span>
            <span className="font-mono font-bold text-amber-300 tabular-nums shrink-0">
              {progress}%
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full border border-slate-700/80 bg-slate-900/90 p-0.5">
            <div
              className="h-full rounded-full transition-all duration-200 ease-out"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${accentColor}, #FBBF24)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
