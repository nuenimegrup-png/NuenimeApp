import React, { useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react';

interface WorldMapControlsProps {
  onPanBy: (dx: number, dy: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetCenter: () => void;
  scale: number;
  minScale: number;
  maxScale: number;
  hasActiveCityPanel: boolean;
}

export const WorldMapControls: React.FC<WorldMapControlsProps> = ({
  onPanBy,
  onZoomIn,
  onZoomOut,
  onResetCenter,
  scale,
  minScale,
  maxScale,
  hasActiveCityPanel,
}) => {
  const holdIntervalRef = useRef<number | null>(null);

  const stopContinuousPan = () => {
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopContinuousPan();
  }, []);

  const startContinuousPan = (dx: number, dy: number) => {
    stopContinuousPan();
    onPanBy(dx, dy);
    holdIntervalRef.current = window.setInterval(() => {
      onPanBy(dx * 0.85, dy * 0.85);
    }, 45);
  };

  // When city panel or boss panel is active, hide analog D-pad and zoom controls completely
  if (hasActiveCityPanel) {
    return null;
  }

  return (
    <>
      {/* Left Virtual D-Pad */}
      <div className="pointer-events-auto absolute left-2.5 bottom-3.5 z-20 transition-all duration-200">
        <div
          className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full border border-slate-400/35 bg-[#070e1b]/90 shadow-[0_6px_20px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          aria-label="Kontrol Arah Peta"
        >
          {/* Up Button */}
          <button
            type="button"
            aria-label="Geser peta ke atas"
            onPointerDown={(e) => {
              e.stopPropagation();
              startContinuousPan(0, 68);
            }}
            onPointerUp={stopContinuousPan}
            onPointerLeave={stopContinuousPan}
            onPointerCancel={stopContinuousPan}
            className="absolute top-0.5 left-1/2 flex h-7 w-9 -translate-x-1/2 items-center justify-center rounded-t-full text-slate-200 transition-colors hover:text-white active:scale-90"
          >
            <ChevronUp className="h-4 w-4" />
          </button>

          {/* Down Button */}
          <button
            type="button"
            aria-label="Geser peta ke bawah"
            onPointerDown={(e) => {
              e.stopPropagation();
              startContinuousPan(0, -68);
            }}
            onPointerUp={stopContinuousPan}
            onPointerLeave={stopContinuousPan}
            onPointerCancel={stopContinuousPan}
            className="absolute bottom-0.5 left-1/2 flex h-7 w-9 -translate-x-1/2 items-center justify-center rounded-b-full text-slate-200 transition-colors hover:text-white active:scale-90"
          >
            <ChevronDown className="h-4 w-4" />
          </button>

          {/* Left Button */}
          <button
            type="button"
            aria-label="Geser peta ke kiri"
            onPointerDown={(e) => {
              e.stopPropagation();
              startContinuousPan(68, 0);
            }}
            onPointerUp={stopContinuousPan}
            onPointerLeave={stopContinuousPan}
            onPointerCancel={stopContinuousPan}
            className="absolute left-0.5 top-1/2 flex h-9 w-7 -translate-y-1/2 items-center justify-center rounded-l-full text-slate-200 transition-colors hover:text-white active:scale-90"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Right Button */}
          <button
            type="button"
            aria-label="Geser peta ke kanan"
            onPointerDown={(e) => {
              e.stopPropagation();
              startContinuousPan(-68, 0);
            }}
            onPointerUp={stopContinuousPan}
            onPointerLeave={stopContinuousPan}
            onPointerCancel={stopContinuousPan}
            className="absolute right-0.5 top-1/2 flex h-9 w-7 -translate-y-1/2 items-center justify-center rounded-r-full text-slate-200 transition-colors hover:text-white active:scale-90"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Metallic Center Orb (Recenter shortcut) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onResetCenter();
            }}
            aria-label="Pusatkan peta"
            title="Pusatkan Peta"
            className="h-6 w-6 rounded-full border border-slate-300/60 bg-gradient-to-b from-slate-200 via-slate-400 to-slate-600 shadow-[0_2px_6px_rgba(0,0,0,0.85)] transition-transform active:scale-90"
          />
        </div>
      </div>

      {/* Right Zoom In (+), Zoom Out (-), and Recenter Target Controls */}
      <div className="pointer-events-auto absolute right-2.5 bottom-3.5 z-20 flex flex-col gap-2 transition-all duration-200">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onZoomIn();
          }}
          disabled={scale >= maxScale - 0.02}
          aria-label="Perbesar peta"
          title="Perbesar Peta"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-400/40 bg-[#070e1b]/92 text-slate-100 shadow-[0_4px_14px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all hover:border-sky-300/60 active:scale-90 disabled:opacity-40"
        >
          <Plus className="h-4 w-4 stroke-[2.4]" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onZoomOut();
          }}
          disabled={scale <= minScale + 0.02}
          aria-label="Perkecil peta"
          title="Perkecil Peta"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-400/40 bg-[#070e1b]/92 text-slate-100 shadow-[0_4px_14px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all hover:border-sky-300/60 active:scale-90 disabled:opacity-40"
        >
          <Minus className="h-4 w-4 stroke-[2.4]" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onResetCenter();
          }}
          aria-label="Pusatkan peta ke posisi awal"
          title="Pusatkan Peta"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-400/40 bg-[#070e1b]/92 text-slate-100 shadow-[0_4px_14px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all hover:border-sky-300/60 active:scale-90"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <path
              d="M12 2.5V6M12 18V21.5M2.5 12H6M18 12H21.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </>
  );
};
