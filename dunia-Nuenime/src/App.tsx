import React, { useState, useCallback, useEffect } from 'react';
import { Shield, Smartphone, Maximize2, Minimize2, MapPin, Bell } from 'lucide-react';
import { WorldCity, Clan, BottomNavTab, ScreenViewState, CityId } from './types/nuenime';
import { NuenimeRpgProvider, useNuenimeRpg } from './context/NuenimeRpgContext';
import { WorldMapScreen } from './components/WorldMapScreen';
import { CityDetailScreen } from './components/CityDetailScreen';
import { ClanListScreen } from './components/ClanListScreen';
import { ClanDetailScreen } from './components/ClanDetailScreen';
import { BottomNavigationBar } from './components/BottomNavigationBar';
import { CompanionTabScreens } from './components/CompanionTabScreens';
import { CityEmblemBadge, CompassRoseIcon } from './components/icons/NuenimeAssets';

const MIN_MAP_SCALE = 0.85;
const MAX_MAP_SCALE = 3.2;

function getWorldDimensions(vpWidth: number, vpHeight: number) {
  const worldBaseWidth = Math.max(
    Math.round(vpWidth * 1.36),
    Math.round((vpHeight * 1.18) * (1024 / 1536)),
    560
  );
  const worldBaseHeight = Math.round(worldBaseWidth * (1536 / 1024));
  return { worldBaseWidth, worldBaseHeight };
}

function NuenimeWorldAppInner() {
  const {
    cities,
    allClans,
    getCityById,
    getClanById,
    toastMessage,
    dismissToast,
    playerContribution,
    relicShards,
    joinedClanId,
    globalWorldStats,
  } = useNuenimeRpg();

  const [activeBottomTab, setActiveBottomTab] = useState<BottomNavTab>('dunia');
  const [screenStack, setScreenStack] = useState<ScreenViewState[]>([{ type: 'WORLD_MAP' }]);
  const [selectedCityId, setSelectedCityId] = useState<CityId | null>('aetheria');
  const [desktopFullscreenMode, setDesktopFullscreenMode] = useState<boolean>(false);

  // Always resolve selectedCity from live repository state so EXP/Level/Clans stay reactive
  const selectedCity = selectedCityId ? getCityById(selectedCityId) ?? null : null;
  const setSelectedCity = useCallback((city: WorldCity | null) => {
    setSelectedCityId(city?.id ?? null);
  }, []);

  const joinedClan = getClanById(joinedClanId);

  const [vpDimensions, setVpDimensions] = useState<{ width: number; height: number }>({
    width: 412,
    height: 840,
  });

  const [transformState, setTransformState] = useState<{
    scale: number;
    tx: number;
    ty: number;
    isAnimated: boolean;
  }>({
    scale: 1.0,
    tx: -24,
    ty: -415,
    isAnimated: false,
  });

  const [hasInitializedCamera, setHasInitializedCamera] = useState(false);

  // Clamp transform so the painted world map never leaves empty void inside the viewport
  const clampTransform = useCallback(
    (tx: number, ty: number, scale: number, vpWidth: number, vpHeight: number) => {
      const { worldBaseWidth, worldBaseHeight } = getWorldDimensions(vpWidth, vpHeight);

      const scaledWidth = worldBaseWidth * scale;
      const scaledHeight = worldBaseHeight * scale;

      const minTx = Math.min(0, vpWidth - scaledWidth);
      const maxTx = 0;
      const minTy = Math.min(0, vpHeight - scaledHeight);
      const maxTy = 0;

      return {
        tx: Math.max(minTx, Math.min(maxTx, tx)),
        ty: Math.max(minTy, Math.min(maxTy, ty)),
      };
    },
    []
  );

  // Center camera on the core archipelago matching the reference composition
  const computeDefaultCamera = useCallback(
    (vpWidth: number, vpHeight: number) => {
      const { worldBaseWidth, worldBaseHeight } = getWorldDimensions(vpWidth, vpHeight);
      const targetScale = 1.0;

      const focusX = worldBaseWidth * 0.48;
      const focusY = worldBaseHeight * 0.48;

      const rawTx = vpWidth / 2 - focusX * targetScale;
      const rawTy = vpHeight * 0.46 - focusY * targetScale;

      const clamped = clampTransform(rawTx, rawTy, targetScale, vpWidth, vpHeight);
      return {
        scale: targetScale,
        tx: clamped.tx,
        ty: clamped.ty,
        isAnimated: true,
      };
    },
    [clampTransform]
  );

  const handleViewportResize = useCallback(
    (width: number, height: number) => {
      setVpDimensions({ width, height });
      if (!hasInitializedCamera) {
        setTransformState(computeDefaultCamera(width, height));
        setHasInitializedCamera(true);
      } else {
        setTransformState((prev) => {
          const clamped = clampTransform(prev.tx, prev.ty, prev.scale, width, height);
          return { ...prev, tx: clamped.tx, ty: clamped.ty };
        });
      }
    },
    [clampTransform, computeDefaultCamera, hasInitializedCamera]
  );

  // Focus camera smoothly on a specific city's world coordinates
  const focusCityOnMap = useCallback(
    (city: WorldCity, customScale?: number) => {
      const { worldBaseWidth, worldBaseHeight } = getWorldDimensions(
        vpDimensions.width,
        vpDimensions.height
      );

      setTransformState((prev) => {
        const nextScale = customScale ?? Math.max(prev.scale, 1.15);
        const cityWorldX = (city.worldXPercent / 100) * worldBaseWidth;
        const cityWorldY = (city.focusYPercent / 100) * worldBaseHeight;

        const targetScreenX = vpDimensions.width * 0.5;
        const targetScreenY = vpDimensions.height * 0.42;

        const rawTx = targetScreenX - cityWorldX * nextScale;
        const rawTy = targetScreenY - cityWorldY * nextScale;
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
    [clampTransform, vpDimensions.height, vpDimensions.width]
  );

  const handleResetMapCamera = useCallback(() => {
    setTransformState(computeDefaultCamera(vpDimensions.width, vpDimensions.height));
  }, [computeDefaultCamera, vpDimensions.height, vpDimensions.width]);

  // Navigation stack helpers
  const currentScreen = screenStack[screenStack.length - 1] ?? { type: 'WORLD_MAP' };

  const pushScreen = (next: ScreenViewState) => {
    setScreenStack((prev) => [...prev, next]);
  };

  const popScreen = () => {
    setScreenStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const handleSelectBottomTab = (tab: BottomNavTab) => {
    setActiveBottomTab(tab);
    if (tab === 'dunia') {
      setScreenStack([{ type: 'WORLD_MAP' }]);
    } else if (tab === 'klan') {
      setScreenStack([{ type: 'CLAN_LIST' }]);
    }
  };

  const handleEnterCity = (city: WorldCity) => {
    setActiveBottomTab('dunia');
    pushScreen({ type: 'CITY_DETAIL', cityId: city.id, initialTab: 'map' });
  };

  const handleOpenClanDetail = (clan: Clan, returnToCityId?: WorldCity['id']) => {
    pushScreen({ type: 'CLAN_DETAIL', clanId: clan.id, returnToCityId });
  };

  // Keyboard arrow support for convenience
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeBottomTab !== 'dunia' || currentScreen.type !== 'WORLD_MAP') return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      const step = 55;
      if (e.key === 'ArrowUp') {
        setTransformState((prev) => ({
          ...prev,
          ...clampTransform(
            prev.tx,
            prev.ty + step,
            prev.scale,
            vpDimensions.width,
            vpDimensions.height
          ),
          isAnimated: true,
        }));
      } else if (e.key === 'ArrowDown') {
        setTransformState((prev) => ({
          ...prev,
          ...clampTransform(
            prev.tx,
            prev.ty - step,
            prev.scale,
            vpDimensions.width,
            vpDimensions.height
          ),
          isAnimated: true,
        }));
      } else if (e.key === 'ArrowLeft') {
        setTransformState((prev) => ({
          ...prev,
          ...clampTransform(
            prev.tx + step,
            prev.ty,
            prev.scale,
            vpDimensions.width,
            vpDimensions.height
          ),
          isAnimated: true,
        }));
      } else if (e.key === 'ArrowRight') {
        setTransformState((prev) => ({
          ...prev,
          ...clampTransform(
            prev.tx - step,
            prev.ty,
            prev.scale,
            vpDimensions.width,
            vpDimensions.height
          ),
          isAnimated: true,
        }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeBottomTab, clampTransform, currentScreen.type, vpDimensions.height, vpDimensions.width]);

  const renderActiveAndroidContent = () => {
    if (
      activeBottomTab === 'beranda' ||
      activeBottomTab === 'karakter' ||
      activeBottomTab === 'lainnya'
    ) {
      return (
        <CompanionTabScreens
          activeTab={activeBottomTab}
          cities={cities}
          clans={allClans}
          onOpenWorldMap={(city) => {
            setActiveBottomTab('dunia');
            setScreenStack([{ type: 'WORLD_MAP' }]);
            if (city) {
              setSelectedCity(city);
              setTimeout(() => focusCityOnMap(city, 1.35), 40);
            }
          }}
          onOpenCityDetail={(city) => {
            setActiveBottomTab('dunia');
            setSelectedCity(city);
            setScreenStack([
              { type: 'WORLD_MAP' },
              { type: 'CITY_DETAIL', cityId: city.id, initialTab: 'map' },
            ]);
          }}
          onOpenClanDetail={(clan) => {
            setActiveBottomTab('dunia');
            setScreenStack([
              { type: 'WORLD_MAP' },
              { type: 'CLAN_DETAIL', clanId: clan.id, returnToCityId: clan.cityId },
            ]);
          }}
          onSwitchTab={handleSelectBottomTab}
        />
      );
    }

    if (currentScreen.type === 'CITY_DETAIL') {
      const city = getCityById(currentScreen.cityId) ?? cities[0];
      return (
        <CityDetailScreen
          city={city}
          initialTab={currentScreen.initialTab}
          onBackToMap={popScreen}
          onSelectClan={(clan) => handleOpenClanDetail(clan, city.id)}
          onOpenFullClanList={(c) => pushScreen({ type: 'CLAN_LIST', cityId: c.id })}
        />
      );
    }

    if (currentScreen.type === 'CLAN_LIST') {
      return (
        <ClanListScreen
          cities={cities}
          initialCityFilter={currentScreen.cityId}
          onBack={() => {
            if (screenStack.length > 1) {
              popScreen();
            } else {
              handleSelectBottomTab('dunia');
            }
          }}
          onSelectClan={(clan) => handleOpenClanDetail(clan, currentScreen.cityId)}
        />
      );
    }

    if (currentScreen.type === 'CLAN_DETAIL') {
      const clan = getClanById(currentScreen.clanId) ?? allClans[0];
      const city = getCityById(clan.cityId);
      return (
        <ClanDetailScreen
          clan={clan}
          city={city}
          onBack={popScreen}
          onNavigateToCity={(cityId) => {
            pushScreen({ type: 'CITY_DETAIL', cityId, initialTab: 'map' });
          }}
        />
      );
    }

    return (
      <WorldMapScreen
        cities={cities}
        selectedCity={selectedCity}
        onSelectCity={setSelectedCity}
        onEnterCity={handleEnterCity}
        onBackFromMap={() => {
          if (selectedCity) {
            setSelectedCity(null);
          } else {
            handleResetMapCamera();
          }
        }}
        transformState={transformState}
        onUpdateTransform={setTransformState}
        vpDimensions={vpDimensions}
        onViewportResize={handleViewportResize}
        onFocusCityOnMap={(city) => focusCityOnMap(city)}
        onResetMapCamera={handleResetMapCamera}
        minScale={MIN_MAP_SCALE}
        maxScale={MAX_MAP_SCALE}
        clampTransform={clampTransform}
      />
    );
  };

  return (
    <div className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#050912] text-slate-100">
      <div
        className="pointer-events-none hidden lg:block absolute inset-0 opacity-30 blur-3xl"
        style={{
          background:
            'radial-gradient(circle at 25% 30%, rgba(56, 189, 248, 0.25), transparent 45%), radial-gradient(circle at 75% 70%, rgba(168, 85, 247, 0.22), transparent 45%)',
        }}
      />

      <div className="relative z-10 flex h-full w-full max-w-[1380px] items-center justify-center lg:gap-8 lg:px-6">
        {/* Left Desktop Companion Panel */}
        {!desktopFullscreenMode && (
          <aside className="hidden lg:flex w-[300px] shrink-0 flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-950/75 p-4 backdrop-blur-md">
            <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
              <CompassRoseIcon size={28} />
              <div>
                <h2 className="font-display text-sm font-bold text-white">Atlas Dunia Nuenime</h2>
                <p className="text-[11px] text-slate-400">
                  Total EXP Dunia: {globalWorldStats.totalWorldExp.toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              {cities.map((city) => {
                const isSelected = selectedCity?.id === city.id;
                return (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => {
                      setActiveBottomTab('dunia');
                      setScreenStack([{ type: 'WORLD_MAP' }]);
                      setSelectedCity(city);
                      focusCityOnMap(city, 1.35);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border p-2 text-left transition-all ${
                      isSelected
                        ? 'border-sky-400/60 bg-sky-950/40 text-white'
                        : 'border-slate-800/70 bg-slate-900/50 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CityEmblemBadge
                        cityId={city.id}
                        material={city.material}
                        size={30}
                        selected={isSelected}
                      />
                      <div className="min-w-0">
                        <div className="font-display text-xs font-bold truncate">
                          {city.name} (Lv.{city.level})
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {city.tier} · Bos: {city.boss.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[10.5px] text-amber-300 tabular-nums">
                        {city.totalExp.toLocaleString('id-ID')} EXP
                      </div>
                      <div className="font-mono text-[9.5px] text-sky-300 tabular-nums">
                        {city.clans.length}/{city.maxClans} Klan
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-slate-800/80 pt-3 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>Klan Aktif:</span>
                <span className="font-semibold text-emerald-300 truncate">
                  {joinedClan?.name ?? '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Kontribusi EXP:</span>
                <span className="font-mono text-amber-300 tabular-nums">
                  {playerContribution.toLocaleString('id-ID')} ({relicShards} Relik)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Zoom Kamera:</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {(transformState.scale * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </aside>
        )}

        {/* Main Android Portrait Interactive Viewport */}
        <main
          className={`relative flex flex-col overflow-hidden bg-[#070d19] shadow-[0_0_55px_rgba(0,0,0,0.9)] transition-all ${
            desktopFullscreenMode
              ? 'h-full w-full'
              : 'h-full w-full lg:h-[min(93dvh,890px)] lg:w-[428px] lg:rounded-[34px] lg:border-[3px] lg:border-slate-700/80'
          }`}
        >
          {/* Floating RPG Feedback Toast Banner */}
          {toastMessage && (
            <div
              onClick={dismissToast}
              className="pointer-events-auto absolute top-[96px] left-2.5 right-2.5 z-50 flex cursor-pointer items-center gap-2 rounded-xl border border-amber-300/70 bg-[#070e1b]/98 px-3 py-2 text-xs font-semibold text-amber-100 shadow-2xl backdrop-blur-xl"
            >
              <Bell className="h-4 w-4 shrink-0 text-amber-300" />
              <span className="truncate">{toastMessage}</span>
            </div>
          )}

          {/* Active Screen View (Strictly bounded above BottomNavigationBar so nothing bleeds under it) */}
          <div className="relative min-h-0 flex-1 overflow-hidden">{renderActiveAndroidContent()}</div>

          {/* Docked Fantasy Bottom Navigation Bar */}
          <BottomNavigationBar
            activeTab={activeBottomTab}
            onSelectTab={handleSelectBottomTab}
          />
        </main>

        {/* Right Desktop Inspector Panel */}
        {!desktopFullscreenMode && (
          <aside className="hidden xl:flex w-[300px] shrink-0 flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-950/75 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="font-display text-sm font-bold text-white">Hierarki Kota & Klan</h2>
                <p className="text-[11px] text-slate-400">
                  {selectedCity ? `Fokus: ${selectedCity.name}` : 'Pilih kota di peta'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDesktopFullscreenMode(true)}
                title="Perluas ke layar penuh"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            {selectedCity ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xs font-bold text-white">
                      {selectedCity.name} (Lv.{selectedCity.level} · {selectedCity.tier})
                    </span>
                    <span className="font-mono text-[10.5px] text-emerald-300 tabular-nums">
                      HP {selectedCity.currentHp.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                    Pemimpin: {selectedCity.leaderProfile.displayName} · Bos: {selectedCity.boss.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleEnterCity(selectedCity)}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-400/50 bg-sky-500/20 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/30"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Buka Kota {selectedCity.name}</span>
                  </button>
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-semibold text-slate-300">
                    Leaderboard Klan di {selectedCity.name} ({selectedCity.clans.length}/
                    {selectedCity.maxClans})
                  </div>
                  <div className="space-y-1.5 max-h-[280px] overflow-y-auto nuenime-scroll">
                    {selectedCity.clans.map((clan) => (
                      <button
                        key={clan.id}
                        type="button"
                        onClick={() => {
                          setActiveBottomTab('dunia');
                          handleOpenClanDetail(clan, selectedCity.id);
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-900/60 p-2 text-left hover:border-sky-400/50 hover:bg-slate-900"
                      >
                        <div className="min-w-0">
                          <div className="font-display text-xs font-semibold text-white truncate">
                            {clan.name}
                          </div>
                          <div className="text-[10.5px] text-slate-400 truncate">
                            {clan.totalExp.toLocaleString('id-ID')} EXP · Pemimpin: {clan.leaderName}
                          </div>
                        </div>
                        <span className="font-mono text-[10.5px] text-sky-300 tabular-nums shrink-0">
                          {clan.memberCount}/{clan.maxMembers}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center text-xs text-slate-400">
                Ketuk salah satu marker kota pada peta untuk melihat daftar klan dan status progresnya.
              </div>
            )}

            <div className="mt-auto border-t border-slate-800/80 pt-3 flex items-center justify-between text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Smartphone className="h-3.5 w-3.5 text-sky-300" />
                Android Portrait UI
              </span>
              <button
                type="button"
                onClick={() => handleSelectBottomTab('klan')}
                className="inline-flex items-center gap-1 text-sky-300 hover:underline"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Leaderboard ({allClans.length})</span>
              </button>
            </div>
          </aside>
        )}

        {desktopFullscreenMode && (
          <button
            type="button"
            onClick={() => setDesktopFullscreenMode(false)}
            className="hidden lg:flex fixed top-3 right-4 z-50 items-center gap-1.5 rounded-xl border border-slate-600/80 bg-slate-950/85 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur-md hover:border-sky-400/60 hover:text-white"
          >
            <Minimize2 className="h-4 w-4" />
            <span>Frame Android Portrait</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <NuenimeRpgProvider>
      <NuenimeWorldAppInner />
    </NuenimeRpgProvider>
  );
}
