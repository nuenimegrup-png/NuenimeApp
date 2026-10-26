import React, { useEffect, useState } from 'react';
import { GoldenEggIcon } from './GachaEggModal';

interface LoadingScreenProps {
  onFinished: () => void;
}

const PRELOAD_ASSETS = [
  '/assets/pets/dragon_solar_lv1.gif',
  '/assets/pets/dragon_solar.gif',
  '/assets/pets/dragon_frost.gif',
  '/assets/pets/dragon_crimson.gif',
  '/assets/pets/treasure_chest.gif',
  '/assets/pets/dragon_solar_lv1_sheet.png',
  '/assets/pets/dragon_solar_sheet.png',
  '/assets/pets/dragon_frost_sheet.png',
  '/assets/pets/dragon_crimson_sheet.png',
];

const LOADING_STEPS = [
  { threshold: 0, label: 'Membangun Pulau 3D...' },
  { threshold: 35, label: 'Menyiapkan Pet Sanctuary...' },
  { threshold: 70, label: 'Memanggil Naga & Peliharaan...' },
  { threshold: 90, label: 'Siap Masuk ke NuePet Zoo!' },
];

const GAME_TIPS = [
  'Tips: Upgrade Ceruh the Dragon ke Lv.2 untuk berevolusi dari Bayi Naga menjadi Naga Besar Bersayap!',
  'Tips: Pilih pulau yang sesuai dengan elemen pet untuk mendapatkan bonus produksi +25% Koin/hari.',
  'Tips: Gunakan mode ⚡ Hemat Energi di pojok kanan atas agar permainan tetap ringan 60 FPS di HP.',
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onFinished }) => {
  const [progress, setProgress] = useState<number>(0);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [tipIndex, setTipIndex] = useState<number>(0);

  useEffect(() => {
    // Preload actual pet GIFs and 3D sprite sheets in background (non-blocking)
    PRELOAD_ASSETS.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    // Loading cepat & mulus (~600ms) agar pemain tidak menunggu lama
    const startTime = performance.now();
    const targetDuration = 650;

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      const ratio = Math.min(1, elapsed / targetDuration);
      const current = Math.round(ratio * 100);

      setProgress(current);

      if (ratio >= 1) {
        setProgress(100);
        clearInterval(interval);
        setTimeout(() => {
          setIsFadingOut(true);
          setTimeout(() => {
            onFinished();
          }, 200);
        }, 120);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [onFinished]);

  const currentStep =
    [...LOADING_STEPS].reverse().find((s) => progress >= s.threshold) ||
    LOADING_STEPS[0];

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 py-10 select-none bg-gradient-to-b from-[#4AA9DF] via-[#7CC5F8] to-[#BDE8FE] transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Decorative Soft Sky Clouds */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-12 left-[8%] w-64 h-24 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.55),transparent)]" />
        <div className="absolute top-24 right-[8%] w-72 h-28 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.48),transparent)]" />
        <div className="absolute bottom-24 left-[15%] w-80 h-28 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.38),transparent)]" />
      </div>

      {/* Center Hero Mascot & Brand Title */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full my-auto">
        {/* Magical Floating Island & Dragon Mascot Emblem */}
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center mb-4">
          {/* Glowing Golden Aura */}
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{
              background:
                'radial-gradient(circle, rgba(254,240,138,0.85) 0%, rgba(250,204,21,0.35) 52%, rgba(255,255,255,0) 74%)',
            }}
          />

          {/* Floating Island Base SVG */}
          <svg
            viewBox="0 0 200 90"
            className="absolute bottom-1 w-40 sm:w-44 h-20 drop-shadow-md"
          >
            <polygon
              points="35,34 165,34 140,66 100,86 60,66"
              fill="#A68967"
              stroke="#574330"
              strokeWidth="2"
            />
            <polygon
              points="58,34 142,34 124,68 100,86 76,68"
              fill="#866B4D"
            />
            <ellipse
              cx="100"
              cy="30"
              rx="68"
              ry="20"
              fill="#82D139"
              stroke="#C2A886"
              strokeWidth="3.5"
            />
            <ellipse cx="98" cy="28" rx="56" ry="15" fill="#AEEB5B" />
          </svg>

          {/* Animated Dragon Mascot */}
          <img
            src={
              progress >= 50
                ? '/assets/pets/dragon_solar.gif'
                : '/assets/pets/dragon_solar_lv1.gif'
            }
            alt="NuePet Dragon Mascot"
            className="relative z-10 w-32 h-32 sm:w-36 sm:h-36 object-contain -translate-y-4 drop-shadow-lg transition-transform duration-300"
          />

          {/* Floating Golden Egg Badge */}
          <div className="absolute top-3 right-3 z-20 bg-white/95 border-2 border-amber-300 rounded-2xl p-1.5 shadow-md animate-bounce">
            <GoldenEggIcon className="w-6 h-7" />
          </div>

          {/* Stage Evolution Indicator Pill */}
          <span className="absolute bottom-1.5 z-20 px-2.5 py-0.5 rounded-full bg-slate-900/80 text-amber-300 text-[10px] font-extrabold tracking-wide shadow-sm">
            {progress >= 50 ? '★ Lv.2 Naga Bersayap' : '★ Lv.1 Bayi Naga'}
          </span>
        </div>

        {/* Game Title */}
        <h1 className="font-['Fredoka'] text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight drop-shadow-xs">
          NuePet Zoo
        </h1>
        <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-1">
          Koleksi, Evolusi & Kelola Pulau Naga Impianmu
        </p>

        {/* Loading Progress Bar Card */}
        <div className="w-full mt-7 bg-white/90 border-2 border-white rounded-3xl p-4 shadow-xl space-y-2.5">
          <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
            <span className="truncate pr-2">{currentStep.label}</span>
            <span className="font-mono tabular-nums text-amber-600 shrink-0">
              {progress}%
            </span>
          </div>

          {/* Progress Track */}
          <div className="w-full h-4 rounded-full bg-slate-200/90 p-0.5 overflow-hidden shadow-inner">
            <div
              style={{ width: `${progress}%` }}
              className="h-full rounded-full bg-gradient-to-r from-[#26B99A] via-[#FACC15] to-[#F59E0B] transition-all duration-100 relative"
            >
              <div className="absolute inset-x-1 top-0.5 h-1 rounded-full bg-white/50" />
            </div>
          </div>

          {/* Rotating Gameplay Tip */}
          <p className="text-[11px] font-medium text-slate-600 leading-snug pt-0.5 min-h-[2.2rem] flex items-center justify-center">
            {GAME_TIPS[tipIndex]}
          </p>
        </div>
      </div>
    </div>
  );
};
