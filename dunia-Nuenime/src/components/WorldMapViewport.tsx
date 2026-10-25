import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Navigation } from 'lucide-react';
import { WorldCity, WorldBossEvent } from '../types/nuenime';
import { WorldMapImage } from './WorldMapImage';
import { CityMarker } from './CityMarker';
import { CityBossIllustration } from './icons/CityBossIllustrations';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';
import { fantasySoundEngine } from '../utils/soundEngine';

interface WorldMapViewportProps {
  cities: WorldCity[];
  selectedCity: WorldCity | null;
  onSelectCity: (city: WorldCity | null) => void;
  selectedBoss: WorldBossEvent | null;
  onSelectBoss: (boss: WorldBossEvent | null) => void;
  transformState: {
    scale: number;
    tx: number;
    ty: number;
    isAnimated: boolean;
  };
  onUpdateTransform: (
    updater: (prev: { scale: number; tx: number; ty: number; isAnimated: boolean }) => {
      scale: number;
      tx: number;
      ty: number;
      isAnimated: boolean;
    }
  ) => void;
  onViewportResize: (width: number, height: number) => void;
  minScale: number;
  maxScale: number;
  clampTransform: (
    tx: number,
    ty: number,
    scale: number,
    vpWidth: number,
    vpHeight: number
  ) => { tx: number; ty: number };
}

/**
 * WorldMapViewport mengelola interaksi gesture:
 * - 1 jari / pointer drag untuk menggeser peta ke segala arah
 * - 2 jari pinch-to-zoom (dan wheel zoom untuk pengujian di desktop)
 * - Sistem koordinat dunia tunggal untuk gambar peta, 7 CityMarker, 7 Ilustrasi Bos Kota transparan, dan Jalur Kapal Udara
 */
export const WorldMapViewport: React.FC<WorldMapViewportProps> = ({
  cities,
  selectedCity,
  onSelectCity,
  selectedBoss,
  onSelectBoss,
  transformState,
  onUpdateTransform,
  onViewportResize,
  minScale,
  maxScale,
  clampTransform,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [vpSize, setVpSize] = useState<{ width: number; height: number }>({
    width: 412,
    height: 840,
  });

  const { worldBosses, activeRoute } = useNuenimeRpg();

  // Animated Airship progress along active travel route (0 to 1)
  const [routeProgress, setRouteProgress] = useState<number>(0);

  useEffect(() => {
    if (!activeRoute) return;
    let raf: number;
    let start: number | null = null;
    const durationMs = 5500;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const elapsed = (ts - start) % durationMs;
      setRouteProgress(elapsed / durationMs);
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [activeRoute]);

  // Gesture tracking refs
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragOriginRef = useRef<{ x: number; y: number; startTx: number; startTy: number } | null>(
    null
  );
  const pinchStateRef = useRef<{
    initialDist: number;
    initialScale: number;
    initialTx: number;
    initialTy: number;
    midX: number;
    midY: number;
  } | null>(null);
  const movedDistanceRef = useRef<number>(0);

  // Measure viewport dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setVpSize({ width: rect.width, height: rect.height });
        onViewportResize(rect.width, rect.height);
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onViewportResize]);

  // Base world dimensions maintain strict native 2:3 aspect ratio of /assets/aistudio/image_e062b5a4.png (1024 x 1536) without distortion
  const worldBaseWidth = Math.max(
    Math.round(vpSize.width * 1.36),
    Math.round((vpSize.height * 1.18) * (1024 / 1536)),
    560
  );
  const worldBaseHeight = Math.round(worldBaseWidth * (1536 / 1024));

  const getPinchMetrics = (pts: Array<{ x: number; y: number }>) => {
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    return {
      dist: Math.hypot(dx, dy),
      midX: (pts[0].x + pts[1].x) / 2,
      midY: (pts[0].y + pts[1].y) / 2,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    activePointersRef.current.set(e.pointerId, { x: localX, y: localY });

    if (activePointersRef.current.size === 1) {
      movedDistanceRef.current = 0;
      dragOriginRef.current = {
        x: localX,
        y: localY,
        startTx: transformState.tx,
        startTy: transformState.ty,
      };
      pinchStateRef.current = null;
    } else if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const { dist, midX, midY } = getPinchMetrics(pts);
      pinchStateRef.current = {
        initialDist: Math.max(dist, 20),
        initialScale: transformState.scale,
        initialTx: transformState.tx,
        initialTy: transformState.ty,
        midX,
        midY,
      };
      dragOriginRef.current = null;
      movedDistanceRef.current = 999;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    activePointersRef.current.set(e.pointerId, { x: localX, y: localY });

    if (activePointersRef.current.size === 2 && pinchStateRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const { dist, midX, midY } = getPinchMetrics(pts);
      const pinch = pinchStateRef.current;

      const rawScale = pinch.initialScale * (dist / pinch.initialDist);
      const nextScale = Math.max(minScale, Math.min(maxScale, rawScale));

      const scaleRatio = nextScale / pinch.initialScale;
      const rawTx =
        midX - (pinch.midX - pinch.initialTx) * scaleRatio + (midX - pinch.midX) * 0.25;
      const rawTy =
        midY - (pinch.midY - pinch.initialTy) * scaleRatio + (midY - pinch.midY) * 0.25;

      const clamped = clampTransform(rawTx, rawTy, nextScale, vpSize.width, vpSize.height);
      onUpdateTransform(() => ({
        scale: nextScale,
        tx: clamped.tx,
        ty: clamped.ty,
        isAnimated: false,
      }));
    } else if (activePointersRef.current.size === 1 && dragOriginRef.current) {
      const dx = localX - dragOriginRef.current.x;
      const dy = localY - dragOriginRef.current.y;
      const dist = Math.hypot(dx, dy);
      movedDistanceRef.current = Math.max(movedDistanceRef.current, dist);

      if (movedDistanceRef.current >= 3) {
        const rawTx = dragOriginRef.current.startTx + dx;
        const rawTy = dragOriginRef.current.startTy + dy;
        const clamped = clampTransform(
          rawTx,
          rawTy,
          transformState.scale,
          vpSize.width,
          vpSize.height
        );
        onUpdateTransform((prev) => ({
          ...prev,
          tx: clamped.tx,
          ty: clamped.ty,
          isAnimated: false,
        }));
      }
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);

    if (activePointersRef.current.size === 1) {
      const remaining = Array.from(activePointersRef.current.values())[0];
      dragOriginRef.current = {
        x: remaining.x,
        y: remaining.y,
        startTx: transformState.tx,
        startTy: transformState.ty,
      };
      pinchStateRef.current = null;
    } else if (activePointersRef.current.size === 0) {
      dragOriginRef.current = null;
      pinchStateRef.current = null;
    }
  };

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const zoomFactor = e.deltaY < 0 ? 1.14 : 0.88;

      onUpdateTransform((prev) => {
        const nextScale = Math.max(minScale, Math.min(maxScale, prev.scale * zoomFactor));
        const ratio = nextScale / prev.scale;
        const rawTx = cursorX - (cursorX - prev.tx) * ratio;
        const rawTy = cursorY - (cursorY - prev.ty) * ratio;
        const clamped = clampTransform(rawTx, rawTy, nextScale, vpSize.width, vpSize.height);
        return {
          scale: nextScale,
          tx: clamped.tx,
          ty: clamped.ty,
          isAnimated: false,
        };
      });
    },
    [clampTransform, maxScale, minScale, onUpdateTransform, vpSize.height, vpSize.width]
  );

  const handleMarkerClick = (city: WorldCity) => {
    if (movedDistanceRef.current >= 6) return;
    fantasySoundEngine.playMarkerSelect();
    onSelectBoss(null);
    onSelectCity(city);
  };

  const handleBossClick = (boss: WorldBossEvent) => {
    if (movedDistanceRef.current >= 6) return;
    fantasySoundEngine.playMarkerSelect();
    onSelectCity(null);
    onSelectBoss(boss);
  };

  const handleBackgroundClick = () => {
    if (movedDistanceRef.current < 6) {
      if (selectedCity) onSelectCity(null);
      if (selectedBoss) onSelectBoss(null);
    }
  };

  // Compute route coordinates if an expedition route is active
  const routeFromCity = activeRoute
    ? cities.find((c) => c.id === activeRoute.fromCityId)
    : undefined;
  const routeToCity = activeRoute
    ? cities.find((c) => c.id === activeRoute.toCityId)
    : undefined;

  let airshipPos: { x: number; y: number } | null = null;
  let routeSvgPath = '';
  if (routeFromCity && routeToCity) {
    const x1 = routeFromCity.worldXPercent * 10;
    const y1 = routeFromCity.worldYPercent * 10;
    const x2 = routeToCity.worldXPercent * 10;
    const y2 = routeToCity.worldYPercent * 10;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 - 85;
    routeSvgPath = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

    const t = routeProgress;
    const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
    airshipPos = { x: bx / 10, y: by / 10 };
  }

  // LOD simplification when zoomed out so city markers and monster illustrations never collide
  const isCompactBossView = transformState.scale < 0.96;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onWheel={handleWheel}
      onClick={handleBackgroundClick}
      className="relative h-full w-full cursor-grab overflow-hidden bg-[#071527] touch-none active:cursor-grabbing"
    >
      {/* Unified World Coordinate Container */}
      <div
        style={{
          width: `${worldBaseWidth}px`,
          height: `${worldBaseHeight}px`,
          transformOrigin: '0 0',
          transform: `translate3d(${transformState.tx}px, ${transformState.ty}px, 0) scale(${transformState.scale})`,
          transition: transformState.isAnimated
            ? 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)'
            : 'none',
          willChange: 'transform',
        }}
        className="relative select-none"
      >
        <WorldMapImage />

        {/* Subtle Tether Lines from each City to its Guardian Boss Monster */}
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        >
          {worldBosses.map((boss) => {
            const ownerCity = cities.find((c) => c.id === boss.cityId);
            if (!ownerCity) return null;
            return (
              <line
                key={`tether-${boss.id}`}
                x1={ownerCity.worldXPercent * 10}
                y1={ownerCity.worldYPercent * 10}
                x2={boss.worldXPercent * 10}
                y2={boss.worldYPercent * 10}
                stroke={boss.accentColor}
                strokeWidth="1.8"
                strokeDasharray="5 5"
                strokeOpacity={selectedBoss?.id === boss.id ? '0.75' : '0.32'}
              />
            );
          })}
        </svg>

        {/* Active Airship / Maritime Expedition Route Overlay */}
        {routeFromCity && routeToCity && (
          <svg
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 z-15 h-full w-full"
          >
            <path
              d={routeSvgPath}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="6"
              strokeOpacity="0.28"
              strokeLinecap="round"
            />
            <path
              d={routeSvgPath}
              fill="none"
              stroke="#FEF08A"
              strokeWidth="2.8"
              strokeDasharray="10 8"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Moving Airship / Vessel Badge along Active Route */}
        {airshipPos && activeRoute && (
          <div
            style={{
              left: `${airshipPos.x}%`,
              top: `${airshipPos.y}%`,
              transform: 'translate3d(-50%, -50%, 0)',
            }}
            className="pointer-events-none absolute z-30 flex items-center gap-1 rounded-full border border-amber-300/80 bg-slate-950/90 px-2 py-1 text-[10px] font-bold text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.65)]"
          >
            <Navigation className="h-3.5 w-3.5 text-amber-300" />
            <span className="whitespace-nowrap">{activeRoute.transportName}</span>
          </div>
        )}

        {/* Render all 7 CityMarkers in the same World Coordinate System */}
        {cities.map((city) => (
          <CityMarker
            key={city.id}
            city={city}
            isSelected={selectedCity?.id === city.id}
            mapScale={transformState.scale}
            onSelectCity={handleMarkerClick}
          />
        ))}

        {/* Render 7 Unique City Bosses with Transparent Monster Illustrations near each City */}
        {worldBosses.map((boss) => {
          const isBossSelected = selectedBoss?.id === boss.id;
          const hpPercent = Math.round((boss.currentHp / boss.maxHp) * 100);
          const isDefeated = boss.currentHp <= 0;

          return (
            <div
              key={boss.id}
              style={{
                left: `${boss.worldXPercent}%`,
                top: `${boss.worldYPercent}%`,
                transform: 'translate3d(-50%, -50%, 0)',
              }}
              className={`absolute select-none ${isBossSelected ? 'z-30' : 'z-20'}`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleBossClick(boss);
                }}
                aria-label={`Bos Kota ${boss.cityName}: ${boss.name}`}
                className="group relative flex flex-col items-center focus:outline-none"
              >
                {/* Pulsing Aura Under Monster (No rectangular background box) */}
                <span
                  className="animate-pulse-ring pointer-events-none absolute top-1 h-11 w-11 rounded-full"
                  style={{
                    boxShadow: `0 0 18px 3px ${isDefeated ? '#64748B' : boss.accentColor}`,
                    border: `1.5px solid ${isDefeated ? '#94A3B8' : boss.accentColor}`,
                    opacity: isBossSelected ? 0.95 : 0.65,
                  }}
                />

                {/* Transparent Fantasy Monster Illustration */}
                <div
                  className={`relative z-10 flex items-center justify-center transition-transform duration-150 ${
                    isBossSelected ? 'scale-115' : 'group-hover:scale-108 active:scale-95'
                  } ${isDefeated ? 'grayscale opacity-65' : ''}`}
                >
                  <CityBossIllustration
                    cityId={boss.cityId}
                    size={isCompactBossView && !isBossSelected ? 40 : 50}
                  />
                </div>

                {/* Compact Boss Name, Level & HP Bar Tag (Hidden in compact zoom unless selected) */}
                {(!isCompactBossView || isBossSelected) && (
                  <div className="-mt-1 flex flex-col items-center rounded-md border border-slate-600/80 bg-[#060c18]/95 px-1.5 py-0.5 shadow-[0_4px_10px_rgba(0,0,0,0.9)]">
                    <div className="flex items-center gap-1">
                      <span className="font-display text-[9px] font-bold text-white whitespace-nowrap">
                        {boss.name}
                      </span>
                      <span
                        className="font-mono text-[8px] font-bold tabular-nums"
                        style={{ color: boss.accentColor }}
                      >
                        Lv.{boss.level}
                      </span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-14 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full transition-all duration-200"
                        style={{
                          width: `${hpPercent}%`,
                          backgroundColor: isDefeated ? '#64748B' : boss.accentColor,
                        }}
                      />
                    </div>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Subtle atmospheric top & bottom vignette for HUD readability */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-slate-950/65 via-slate-950/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent" />
    </div>
  );
};
