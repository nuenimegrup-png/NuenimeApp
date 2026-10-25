import React, { useState, useCallback } from 'react';
import {
  X,
  Compass,
  Sparkles,
  MapPin,
  Shield,
  Navigation,
  Swords,
  RotateCcw,
  ArrowRight,
  UserCheck,
  Trophy,
  Heart,
} from 'lucide-react';
import { WorldCity, WorldBossEvent, CityId } from '../types/nuenime';
import { WORLD_OVERVIEW_INFO } from '../data/nuenimeWorldData';
import { calculateTravelRoute } from '../data/nuenimeRpgFeaturesData';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';
import { WorldHeader } from './WorldHeader';
import { WorldMapViewport } from './WorldMapViewport';
import { WorldMapControls } from './WorldMapControls';
import { CityInfoPanel } from './CityInfoPanel';
import { CityEmblemBadge, CompassRoseIcon } from './icons/NuenimeAssets';
import { CityBossIllustration } from './icons/CityBossIllustrations';

interface WorldMapScreenProps {
  cities: WorldCity[];
  selectedCity: WorldCity | null;
  onSelectCity: (city: WorldCity | null) => void;
  onEnterCity: (city: WorldCity) => void;
  onBackFromMap: () => void;
  transformState: {
    scale: number;
    tx: number;
    ty: number;
    isAnimated: boolean;
  };
  onUpdateTransform: React.Dispatch<
    React.SetStateAction<{
      scale: number;
      tx: number;
      ty: number;
      isAnimated: boolean;
    }>
  >;
  vpDimensions: { width: number; height: number };
  onViewportResize: (width: number, height: number) => void;
  onFocusCityOnMap: (city: WorldCity) => void;
  onResetMapCamera: () => void;
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

export const WorldMapScreen: React.FC<WorldMapScreenProps> = ({
  cities,
  selectedCity,
  onSelectCity,
  onEnterCity,
  onBackFromMap,
  transformState,
  onUpdateTransform,
  vpDimensions,
  onViewportResize,
  onFocusCityOnMap,
  onResetMapCamera,
  minScale,
  maxScale,
  clampTransform,
}) => {
  const [activeModal, setActiveModal] = useState<
    'world-info' | 'guide' | 'route' | 'account-switcher' | null
  >(null);
  const [selectedBossId, setSelectedBossId] = useState<string | null>(null);
  const [bossIndex, setBossIndex] = useState<number>(0);
  const [lastDamageDealt, setLastDamageDealt] = useState<number | null>(null);

  // Route simulator state
  const [routeFromId, setRouteFromId] = useState<CityId>('aetheria');
  const [routeToId, setRouteToId] = useState<CityId>('eldoria');

  const {
    worldBosses,
    attackWorldBoss,
    resetWorldBoss,
    joinedClanId,
    getClanById,
    activeRoute,
    selectTravelRoute,
    clearTravelRoute,
    activeAccount,
    availableDemoAccounts,
    switchDemoAccount,
    globalWorldStats,
    resetAllSimulationData,
  } = useNuenimeRpg();

  const selectedBoss: WorldBossEvent | null =
    worldBosses.find((b) => b.id === selectedBossId) ?? null;

  const joinedClan = getClanById(joinedClanId);
  const selectedBossCity = selectedBoss
    ? cities.find((c) => c.id === selectedBoss.cityId)
    : undefined;

  const focusWorldCoordinates = useCallback(
    (xPct: number, yPct: number, targetScale = 1.2) => {
      const worldBaseWidth = Math.max(
        Math.round(vpDimensions.width * 1.36),
        Math.round((vpDimensions.height * 1.18) * (1024 / 1536)),
        560
      );
      const worldBaseHeight = Math.round(worldBaseWidth * (1536 / 1024));
      const worldX = (xPct / 100) * worldBaseWidth;
      const worldY = (yPct / 100) * worldBaseHeight;

      const rawTx = vpDimensions.width * 0.5 - worldX * targetScale;
      const rawTy = vpDimensions.height * 0.43 - worldY * targetScale;
      const clamped = clampTransform(
        rawTx,
        rawTy,
        targetScale,
        vpDimensions.width,
        vpDimensions.height
      );

      onUpdateTransform({
        scale: targetScale,
        tx: clamped.tx,
        ty: clamped.ty,
        isAnimated: true,
      });
    },
    [clampTransform, onUpdateTransform, vpDimensions.height, vpDimensions.width]
  );

  const handleSelectCityMarker = useCallback(
    (city: WorldCity | null) => {
      setSelectedBossId(null);
      onSelectCity(city);
      if (city) {
        onFocusCityOnMap(city);
      }
    },
    [onFocusCityOnMap, onSelectCity]
  );

  const handleSelectBossMarker = useCallback(
    (boss: WorldBossEvent | null) => {
      onSelectCity(null);
      setLastDamageDealt(null);
      setSelectedBossId(boss?.id ?? null);
      if (boss) {
        focusWorldCoordinates(boss.worldXPercent, boss.worldYPercent, 1.22);
      }
    },
    [focusWorldCoordinates, onSelectCity]
  );

  const handleCycleWorldBoss = useCallback(() => {
    if (worldBosses.length === 0) return;
    const nextIdx = (bossIndex + 1) % worldBosses.length;
    setBossIndex(nextIdx);
    const targetBoss = worldBosses[nextIdx];
    handleSelectBossMarker(targetBoss);
  }, [bossIndex, handleSelectBossMarker, worldBosses]);

  const handlePanBy = useCallback(
    (dx: number, dy: number) => {
      onUpdateTransform((prev) => {
        const clamped = clampTransform(
          prev.tx + dx,
          prev.ty + dy,
          prev.scale,
          vpDimensions.width,
          vpDimensions.height
        );
        return {
          ...prev,
          tx: clamped.tx,
          ty: clamped.ty,
          isAnimated: true,
        };
      });
    },
    [clampTransform, onUpdateTransform, vpDimensions.height, vpDimensions.width]
  );

  const handleZoomStep = useCallback(
    (factor: number) => {
      onUpdateTransform((prev) => {
        const nextScale = Math.max(minScale, Math.min(maxScale, prev.scale * factor));
        const centerX = vpDimensions.width / 2;
        const centerY = vpDimensions.height / 2;
        const ratio = nextScale / prev.scale;
        const rawTx = centerX - (centerX - prev.tx) * ratio;
        const rawTy = centerY - (centerY - prev.ty) * ratio;
        const clamped = clampTransform(
          rawTx,
          rawTy,
          nextScale,
          vpDimensions.width,
          vpDimensions.height
        );
        return {
          scale: nextScale,
          tx: clamped.tx,
          ty: clamped.ty,
          isAnimated: true,
        };
      });
    },
    [clampTransform, maxScale, minScale, onUpdateTransform, vpDimensions.height, vpDimensions.width]
  );

  const previewFromCity = cities.find((c) => c.id === routeFromId) ?? cities[0];
  const previewToCity = cities.find((c) => c.id === routeToId) ?? cities[3];
  const previewRoute = calculateTravelRoute(previewFromCity, previewToCity);

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      {/* Header Dunia Nuenime + RPG Utility Bar */}
      <WorldHeader
        onBackClick={onBackFromMap}
        onOpenWorldInfo={() => setActiveModal('world-info')}
        onOpenLegendModal={() => setActiveModal('guide')}
        onOpenRoutePlanner={() => setActiveModal('route')}
        onCycleWorldBoss={handleCycleWorldBoss}
        onOpenAccountSwitcher={() => setActiveModal('account-switcher')}
      />

      {/* Interactive 2D Top-Down Fantasy Map Viewport */}
      <WorldMapViewport
        cities={cities}
        selectedCity={selectedCity}
        onSelectCity={handleSelectCityMarker}
        selectedBoss={selectedBoss}
        onSelectBoss={handleSelectBossMarker}
        transformState={transformState}
        onUpdateTransform={onUpdateTransform}
        onViewportResize={onViewportResize}
        minScale={minScale}
        maxScale={maxScale}
        clampTransform={clampTransform}
      />

      {/* Virtual D-Pad, Zoom +/-, and Recenter Controls */}
      <WorldMapControls
        onPanBy={handlePanBy}
        onZoomIn={() => handleZoomStep(1.24)}
        onZoomOut={() => handleZoomStep(0.8)}
        onResetCenter={onResetMapCamera}
        scale={transformState.scale}
        minScale={minScale}
        maxScale={maxScale}
        hasActiveCityPanel={!!selectedCity || !!selectedBoss}
      />

      {/* Bottom City Info Panel */}
      <CityInfoPanel
        city={selectedCity}
        onEnterCity={onEnterCity}
        onSelectCityBoss={(city) => handleSelectBossMarker(city.boss)}
        onClose={() => onSelectCity(null)}
      />

      {/* Bottom Unique City Boss Panel when a City Boss Marker is Selected */}
      {selectedBoss && !selectedCity && (
        <div
          className="pointer-events-auto absolute bottom-2.5 left-2.5 right-2.5 z-30 transition-all duration-200"
          role="region"
          aria-label={`Informasi Bos Kota ${selectedBoss.name}`}
        >
          <div className="relative rounded-2xl border border-rose-400/50 bg-[#070e1b]/98 p-3.5 shadow-[0_12px_34px_rgba(0,0,0,0.92)] backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setSelectedBossId(null)}
              aria-label="Tutup panel Bos Kota"
              className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3 pr-6">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 bg-slate-950/90 shadow-lg"
                style={{ borderColor: selectedBoss.accentColor }}
              >
                <CityBossIllustration cityId={selectedBoss.cityId} size={48} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                  <span className="rounded border border-rose-400/50 bg-rose-950/90 px-1.5 py-0.5 font-mono text-rose-200">
                    Lv.{selectedBoss.level} · {selectedBoss.tier}
                  </span>
                  <span className="text-amber-300">Bos Kota {selectedBoss.cityName}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold ${
                      selectedBoss.currentHp > 0
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {selectedBoss.currentHp > 0 ? 'Status: Aktif' : 'Status: Kalah'}
                  </span>
                </div>
                <h2 className="font-display mt-0.5 truncate text-sm font-bold text-white">
                  {selectedBoss.name} — {selectedBoss.title}
                </h2>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-300">
                  {selectedBoss.description}
                </p>
              </div>
            </div>

            {/* Strict Separation of Boss HP vs City HP */}
            <div className="mt-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-rose-200">
                  HP Bos ({selectedBoss.element})
                </span>
                <span className="font-mono font-bold text-white tabular-nums">
                  {selectedBoss.currentHp.toLocaleString('id-ID')} /{' '}
                  {selectedBoss.maxHp.toLocaleString('id-ID')} HP
                  {lastDamageDealt ? (
                    <span className="ml-1.5 text-rose-400">
                      (-{lastDamageDealt.toLocaleString('id-ID')})
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full transition-all duration-200"
                  style={{
                    width: `${Math.round((selectedBoss.currentHp / selectedBoss.maxHp) * 100)}%`,
                    backgroundColor: selectedBoss.accentColor,
                  }}
                />
              </div>

              {selectedBossCity && (
                <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/75 px-2.5 py-1 text-[10px] text-slate-300">
                  <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                    <Heart className="h-3 w-3" />
                    HP Kota {selectedBossCity.name} (Terpisah dari HP Bos):
                  </span>
                  <span className="font-mono font-bold text-emerald-200 tabular-nums">
                    {selectedBossCity.currentHp.toLocaleString('id-ID')} /{' '}
                    {selectedBossCity.maxHp.toLocaleString('id-ID')} HP
                  </span>
                </div>
              )}
            </div>

            {/* Raid Action Footer */}
            <div className="mt-3 flex items-center justify-between gap-2">
              {selectedBossCity ? (
                <button
                  type="button"
                  onClick={() => handleSelectCityMarker(selectedBossCity)}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-[11px] font-semibold text-sky-200 hover:border-sky-400/50"
                >
                  <CityEmblemBadge
                    cityId={selectedBossCity.id}
                    material={selectedBossCity.material}
                    size={18}
                  />
                  <span>Ke Kota {selectedBossCity.name}</span>
                </button>
              ) : (
                <div className="text-[11px] text-slate-300 truncate">
                  Klan Aktif:{' '}
                  <span className="font-semibold text-sky-300">
                    {joinedClan?.name ?? 'Ordo Seraphim'}
                  </span>
                </div>
              )}

              {selectedBoss.currentHp > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const res = attackWorldBoss(selectedBoss.id);
                    setLastDamageDealt(res.damage);
                  }}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-rose-300/60 bg-gradient-to-r from-rose-700 to-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg transition-transform active:scale-95 whitespace-nowrap shrink-0"
                >
                  <Swords className="h-3.5 w-3.5" />
                  <span>Uji Serang Bos (-HP Bos)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    resetWorldBoss(selectedBoss.id);
                    setLastDamageDealt(null);
                  }}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-sky-400/50 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-sky-200 hover:bg-slate-700 active:scale-95 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Bangkitkan Bos</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Informasi Dunia / Panduan Peta / Simulasi Rute / Pemilih Akun Demo */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="nuenime-scroll max-h-[84vh] w-full max-w-[396px] overflow-y-auto rounded-2xl border border-slate-400/35 bg-slate-950/95 p-4 text-slate-100 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <CompassRoseIcon size={26} />
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    {activeModal === 'world-info'
                      ? WORLD_OVERVIEW_INFO.title
                      : activeModal === 'route'
                      ? 'Simulasi Rute & Kapal Udara'
                      : activeModal === 'account-switcher'
                      ? 'Pemilih Akun Demo Nuenime'
                      : 'Panduan Navigasi Peta'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {activeModal === 'world-info'
                      ? 'Statistik Global & Progres 7 Kota Independen'
                      : activeModal === 'route'
                      ? 'Pilih Kota Asal & Tujuan Ekspedisi'
                      : activeModal === 'account-switcher'
                      ? 'Uji Hak Akses 7 Pemimpin Kota & Anggota Klan'
                      : 'Kontrol Eksplorasi Dunia Nuenime'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900 text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeModal === 'account-switcher' ? (
              <div className="mt-3.5 space-y-3 text-xs">
                <div className="rounded-xl border border-amber-400/40 bg-amber-950/25 p-2.5 text-[11px] leading-relaxed text-amber-100">
                  <div className="font-bold text-amber-300">Mode Pengujian Peran (Akun Demo)</div>
                  <p className="mt-0.5 text-slate-300">
                    Setiap kota dipimpin oleh 1 Pemimpin Kota sementara (<code className="text-amber-200">isDemoAccount: true</code>). Pemimpin Kota hanya dapat membuat klan baru di kota yang dipimpinnya (maksimal 15 klan/kota).
                  </p>
                </div>

                <div className="space-y-2">
                  {availableDemoAccounts.map((acc) => {
                    const isSelected = activeAccount.id === acc.id;
                    const accCity = acc.ledCityId
                      ? cities.find((c) => c.id === acc.ledCityId)
                      : undefined;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          switchDemoAccount(acc.id);
                          setActiveModal(null);
                          if (accCity) {
                            handleSelectCityMarker(accCity);
                          }
                        }}
                        className={`flex w-full items-center justify-between gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                          isSelected
                            ? 'border-amber-400 bg-amber-950/40 text-white'
                            : 'border-slate-800 bg-slate-900/75 text-slate-200 hover:border-sky-400/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {accCity ? (
                            <CityEmblemBadge
                              cityId={accCity.id}
                              material={accCity.material}
                              size={32}
                              selected={isSelected}
                            />
                          ) : (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-400/50 bg-sky-950">
                              <UserCheck className="h-4 w-4 text-sky-300" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-display text-xs font-bold text-white truncate">
                                {acc.displayName}
                              </span>
                              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-amber-300">
                                {acc.role === 'CITY_LEADER' ? 'PEMIMPIN KOTA' : 'ANGGOTA'}
                              </span>
                            </div>
                            <div className="truncate text-[10.5px] text-slate-400">
                              {accCity
                                ? `Memimpin Kota ${accCity.name} (${accCity.clans.length}/${accCity.maxClans} Klan)`
                                : `${acc.title} · Bebas ganti & jalankan misi klan`}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 shrink-0">
                            Aktif
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-slate-800 pt-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      resetAllSimulationData();
                      setActiveModal(null);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-950/30 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-950/50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset Data Simulasi Dunia ke Awal (Level 1)</span>
                  </button>
                </div>
              </div>
            ) : activeModal === 'route' ? (
              <div className="mt-3.5 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                      Kota Keberangkatan
                    </label>
                    <select
                      value={routeFromId}
                      onChange={(e) => setRouteFromId(e.target.value as CityId)}
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 text-xs font-semibold text-white focus:border-sky-400 focus:outline-none"
                    >
                      {cities.map((c) => (
                        <option key={`from-${c.id}`} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                      Kota Tujuan
                    </label>
                    <select
                      value={routeToId}
                      onChange={(e) => setRouteToId(e.target.value as CityId)}
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 text-xs font-semibold text-white focus:border-sky-400 focus:outline-none"
                    >
                      {cities.map((c) => (
                        <option key={`to-${c.id}`} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {routeFromId === routeToId ? (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-center text-amber-200">
                    Pilih dua kota yang berbeda untuk menghitung jalur ekspedisi.
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/75 p-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-display font-bold text-white">
                        {previewFromCity.name} → {previewToCity.name}
                      </span>
                      <span className="font-mono text-sky-300 tabular-nums">
                        {previewRoute.distanceLeagues} League
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Armada Transportasi:</span>
                      <span className="font-semibold text-amber-300">
                        {previewRoute.transportName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Estimasi Waktu Tempuh:</span>
                      <span className="font-mono tabular-nums">
                        {previewRoute.durationMinutes} Menit Dunia
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Kondisi Jalur:</span>
                      <span className="font-medium text-emerald-300">
                        {previewRoute.hazardLevel}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    disabled={routeFromId === routeToId}
                    onClick={() => {
                      selectTravelRoute(routeFromId, routeToId);
                      setActiveModal(null);
                      onSelectCity(previewToCity);
                      onFocusCityOnMap(previewToCity);
                    }}
                    className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-amber-300/60 bg-gradient-to-r from-amber-600 to-sky-700 px-4 py-2 text-xs font-bold text-white shadow-lg disabled:opacity-40"
                  >
                    <Navigation className="h-4 w-4" />
                    <span>Tampilkan Jalur & Kapal Udara di Peta</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {activeRoute && (
                      <button
                        type="button"
                        onClick={() => {
                          clearTravelRoute();
                          setActiveModal(null);
                        }}
                        className="flex min-h-[38px] flex-1 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
                      >
                        Hentikan Rute
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        onEnterCity(previewToCity);
                      }}
                      className="flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-400/50 bg-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/30"
                    >
                      <span>Masuk ke {previewToCity.name}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : activeModal === 'world-info' ? (
              <div className="mt-3.5 space-y-3.5 text-xs leading-relaxed text-slate-300">
                {/* Global World Statistics Card */}
                <div className="rounded-xl border border-sky-400/40 bg-sky-950/25 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 font-display text-xs font-bold text-sky-200">
                    <Trophy className="h-4 w-4 text-amber-300" />
                    <span>Statistik Dunia Nuenime (Real-Time)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
                      <div className="text-[10px] text-slate-400">Total EXP Dunia</div>
                      <div className="font-mono mt-0.5 text-xs font-bold text-sky-300 tabular-nums">
                        {globalWorldStats.totalWorldExp.toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
                      <div className="text-[10px] text-slate-400">Total Klan</div>
                      <div className="font-mono mt-0.5 text-xs font-bold text-amber-300 tabular-nums">
                        {globalWorldStats.totalClansCount} / {7 * 15}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
                      <div className="text-[10px] text-slate-400">Total Anggota</div>
                      <div className="font-mono mt-0.5 text-xs font-bold text-emerald-300 tabular-nums">
                        {globalWorldStats.totalClanMembersCount}
                      </div>
                    </div>
                  </div>

                  {globalWorldStats.highestLevelCity && (
                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5 text-[11px]">
                      <span className="text-slate-400">Kota Level Tertinggi:</span>
                      <span className="font-semibold text-white">
                        {globalWorldStats.highestLevelCity.name} (Lv.
                        {globalWorldStats.highestLevelCity.level} ·{' '}
                        {globalWorldStats.highestLevelCity.tier})
                      </span>
                    </div>
                  )}

                  {globalWorldStats.topExpClan && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Klan EXP Tertinggi:</span>
                      <span className="font-semibold text-amber-300">
                        {globalWorldStats.topExpClan.name} (
                        {globalWorldStats.topExpClan.totalExp.toLocaleString('id-ID')} EXP)
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-display mb-2 text-xs font-semibold tracking-wider text-slate-200">
                    Daftar 7 Kota Independen Nuenime
                  </h4>
                  <div className="space-y-2">
                    {cities.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setActiveModal(null);
                          handleSelectCityMarker(c);
                        }}
                        className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-slate-800 bg-slate-900/70 p-2 text-left transition-colors hover:border-sky-400/50 hover:bg-slate-900"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CityEmblemBadge cityId={c.id} material={c.material} size={32} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-display text-xs font-bold text-white">
                                {c.name}
                              </span>
                              <span className="rounded bg-slate-800 px-1.5 py-0.2 font-mono text-[9.5px] text-sky-300">
                                Lv.{c.level} · {c.tier}
                              </span>
                            </div>
                            <div className="truncate text-[10.5px] text-slate-400">
                              Kota Terbuka · Bos: {c.boss.name}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-[11px] font-semibold text-amber-300 tabular-nums">
                            {c.totalExp.toLocaleString('id-ID')} EXP
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 tabular-nums">
                            {c.clans.length}/{c.maxClans} Klan
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3.5 space-y-3 text-xs leading-relaxed text-slate-300">
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
                  <Compass className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                  <div>
                    <div className="font-semibold text-white">Geser & Pinch-to-Zoom</div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Gunakan 1 jari untuk menggeser peta ke segala arah, dan cubit 2 jari untuk memperbesar atau memperkecil detail wilayah.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div>
                    <div className="font-semibold text-white">7 Kota & 7 Bos Penjaga Unik</div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Setiap kota memiliki Level, Tier, HP Kota (10.000/10.000), Pemimpin Kota, dan 1 Bos unik dengan HP Bos yang terpisah dari HP Kota.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <div>
                    <div className="font-semibold text-white">Sistem Klan (Maks 15/Kota & 100 Anggota)</div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Pemimpin Kota dapat membuat klan di kotanya hingga 15 klan. Setiap misi simulasi anggota menambah EXP Anggota → EXP Klan → Total EXP Kota.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" />
                  <div>
                    <div className="font-semibold text-white">Pemilih Akun Demo</div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Ketuk tombol Akun di kanan atas peta untuk beralih antara 7 Pemimpin Kota dan Anggota Klan.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
