import React from 'react';
import {
  Compass,
  Shield,
  MapPin,
  ChevronRight,
  Layers,
  Award,
  FolderOpen,
  UserCheck,
  Heart,
} from 'lucide-react';
import { WorldCity, Clan, BottomNavTab } from '../types/nuenime';
import { CityEmblemBadge, ClanEmblemIcon, CompassRoseIcon, NuenimeCrestIcon } from './icons/NuenimeAssets';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';

interface CompanionTabProps {
  activeTab: Exclude<BottomNavTab, 'dunia' | 'klan'>;
  cities: WorldCity[];
  clans: Clan[];
  onOpenWorldMap: (city?: WorldCity) => void;
  onOpenCityDetail: (city: WorldCity) => void;
  onOpenClanDetail: (clan: Clan) => void;
  onSwitchTab: (tab: BottomNavTab) => void;
}

const PREPARED_ANDROID_ASSETS = [
  { name: 'image_e062b5a4.png', role: 'Peta Dasar Dunia Nuenime Bersih (1024×1536 · 2:3)', path: '/assets/aistudio/image_e062b5a4.png' },
  { name: 'city_aetheria.svg', role: 'Ilustrasi HD Kota Aetheria (Vector)', path: '/assets/nuenime/city_aetheria.svg' },
  { name: 'city_lunaris.svg', role: 'Ilustrasi HD Kota Lunaris (Vector)', path: '/assets/nuenime/city_lunaris.svg' },
  { name: 'city_velmora.svg', role: 'Ilustrasi HD Kota Velmora (Vector)', path: '/assets/nuenime/city_velmora.svg' },
  { name: 'city_eldoria.svg', role: 'Ilustrasi HD Kota Eldoria (Vector)', path: '/assets/nuenime/city_eldoria.svg' },
  { name: 'city_drakonia.svg', role: 'Ilustrasi HD Kota Drakonia (Vector)', path: '/assets/nuenime/city_drakonia.svg' },
  { name: 'city_nivara.svg', role: 'Ilustrasi HD Kota Nivara (Vector)', path: '/assets/nuenime/city_nivara.svg' },
  { name: 'city_astralis.svg', role: 'Ilustrasi HD Kota Astralis (Vector)', path: '/assets/nuenime/city_astralis.svg' },
  { name: 'emblem_aetheria.svg', role: 'Emblem Kota Aetheria', path: '/assets/nuenime/emblem_aetheria.svg' },
  { name: 'emblem_lunaris.svg', role: 'Emblem Kota Lunaris', path: '/assets/nuenime/emblem_lunaris.svg' },
  { name: 'emblem_velmora.svg', role: 'Emblem Kota Velmora', path: '/assets/nuenime/emblem_velmora.svg' },
  { name: 'emblem_eldoria.svg', role: 'Emblem Kota Eldoria', path: '/assets/nuenime/emblem_eldoria.svg' },
  { name: 'emblem_drakonia.svg', role: 'Emblem Kota Drakonia', path: '/assets/nuenime/emblem_drakonia.svg' },
  { name: 'emblem_nivara.svg', role: 'Emblem Kota Nivara', path: '/assets/nuenime/emblem_nivara.svg' },
  { name: 'emblem_astralis.svg', role: 'Emblem Kota Astralis', path: '/assets/nuenime/emblem_astralis.svg' },
];

function resolveBorderAssetUrl(border: string | null | undefined): string | null {
  if (!border) return null;
  const trimmed = border.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes('white_mage') || lower.includes('white-mage')) {
    return '/assets/borders/border-white-mage.png';
  }
  if (lower.includes('magic_book') || lower.includes('magic-book')) {
    return '/assets/borders/border-magic-book.png';
  }
  return null;
}

export const CompanionTabScreens: React.FC<CompanionTabProps> = ({
  activeTab,
  cities,
  clans,
  onOpenWorldMap,
  onOpenCityDetail,
  onOpenClanDetail,
  onSwitchTab,
}) => {
  const {
    activeAccount,
    availableDemoAccounts,
    switchDemoAccount,
    joinedClanId,
    playerContribution,
    globalWorldStats,
    userCrystals,
  } = useNuenimeRpg();

  if (activeTab === 'beranda') {
    return (
      <div className="nuenime-scroll flex h-full w-full flex-col overflow-y-auto bg-[#070d19] px-3.5 py-3.5 text-slate-100">
        {/* Top Brand Header */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="flex items-center gap-2.5">
            <NuenimeCrestIcon size={36} />
            <div>
              <h1 className="font-display text-base font-bold text-white">Beranda Nuenime</h1>
              <p className="text-[11px] text-slate-400">
                7 Kota · {globalWorldStats.totalClansCount} Klan · {globalWorldStats.totalWorldExp.toLocaleString('id-ID')} EXP Dunia
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenWorldMap()}
            className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-sky-400/50 bg-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/30 whitespace-nowrap shrink-0"
          >
            <Compass className="h-4 w-4" />
            <span>Buka Peta</span>
          </button>
        </div>

        {/* Quick Jump to 7 Cities */}
        <div className="mt-3.5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">Status 7 Kota Nuenime</h3>
            <span className="text-[11px] text-slate-400">Ketuk untuk fokus di peta</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {cities.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-800/90 bg-slate-900/70 p-2.5"
              >
                <button
                  type="button"
                  onClick={() => onOpenWorldMap(c)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <CityEmblemBadge cityId={c.id} material={c.material} size={36} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display text-xs font-bold text-white">{c.name}</span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.2 font-mono text-[9.5px] text-sky-300">
                        Lv.{c.level} · {c.tier}
                      </span>
                    </div>
                    <div className="truncate text-[10.5px] text-slate-400">
                      HP Kota: {c.currentHp.toLocaleString('id-ID')}/{c.maxHp.toLocaleString('id-ID')} ·{' '}
                      {c.clans.length}/{c.maxClans} Klan · Bos: {c.boss.name}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenCityDetail(c)}
                  className="flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-sky-300 hover:border-sky-400/50 whitespace-nowrap shrink-0"
                >
                  <span>Masuk Kota</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'karakter') {
    const joinedClan = clans.find((c) => c.id === joinedClanId) ?? clans[0];
    const featuredCity =
      cities.find((c) => c.id === (activeAccount.ledCityId ?? joinedClan?.cityId)) ?? cities[0];

    return (
      <div className="nuenime-scroll flex h-full w-full flex-col overflow-y-auto bg-[#070d19] px-3.5 py-3.5 text-slate-100 space-y-3.5">
        {/* Profile Card: Real User Profile + Avatar Border + Level/Rank */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center gap-3">
            {/* Avatar with Equipped Border from Nuenime APK */}
            {(() => {
              const borderAsset = resolveBorderAssetUrl(activeAccount.borderUrl);
              return (
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                  {/* Circular Avatar / Fallback */}
                  <div
                    className={`relative h-14 w-14 overflow-hidden rounded-full bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-700 flex items-center justify-center ${
                      activeAccount.isVip
                        ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]'
                        : 'ring-2 ring-sky-400/80 shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                    }`}
                  >
                    {activeAccount.avatarUrl ? (
                      <img
                        src={activeAccount.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="font-display text-xl font-bold text-white uppercase">
                        {activeAccount.displayName.charAt(0) || 'P'}
                      </span>
                    )}
                  </div>

                  {/* Equipped Border Overlay: only renders when a valid border asset is resolved */}
                  {borderAsset && (
                    <img
                      src={borderAsset}
                      alt=""
                      className="pointer-events-none absolute inset-[-6px] h-[76px] w-[76px] object-contain drop-shadow-[0_0_8px_rgba(56,189,248,0.6)] z-10"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
              );
            })()}

            {/* User Identity Column (Clean, single-line typography) */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="shrink-0 rounded border border-sky-400/50 bg-sky-950/90 px-1.5 py-0.2 font-mono text-[9px] font-bold text-sky-200 tabular-nums">
                  LV.{activeAccount.level || 1} · {activeAccount.rank || 'STONE'}
                </span>
                {activeAccount.isVip && (
                  <span className="shrink-0 rounded border border-amber-400/50 bg-amber-950/90 px-1.5 py-0.2 font-mono text-[9px] font-bold text-amber-300">
                    VIP
                  </span>
                )}
                <span className="truncate text-[10px] font-medium text-slate-400">
                  Petualang Nuenime
                </span>
              </div>

              <h1 className="font-display truncate text-base font-bold text-white tracking-wide mt-0.5">
                {activeAccount.displayName}
              </h1>

              <p className="truncate text-[11px] text-slate-400 mt-0.5">
                Kota {featuredCity.name} · Klan {joinedClan.name}
              </p>
            </div>
          </div>

          {/* 3-Column Stats Row: Single-line values, crisp and clean */}
          <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-slate-800/90 pt-3 text-center">
            <div className="min-w-0">
              <div className="truncate text-[10px] font-medium text-slate-400">Saldo Crystal</div>
              <div className="mt-0.5 truncate text-xs font-bold text-amber-300 font-mono">
                💎 {userCrystals.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-[10px] font-medium text-slate-400">Kota Domisili</div>
              <div className="mt-0.5 truncate text-xs font-semibold text-sky-300">
                {featuredCity.name} (Lv.{featuredCity.level})
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-[10px] font-medium text-slate-400">Kontribusi EXP</div>
              <div className="mt-0.5 truncate text-xs font-bold text-emerald-300 font-mono tabular-nums">
                {playerContribution.toLocaleString('id-ID')} EXP
              </div>
            </div>
          </div>
        </div>

        {/* Ringkasan Eksplorasi & Izin Petualang */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-white">Status Petualang Nuenime</h2>
            <span className="rounded bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 text-[9.5px] font-bold text-emerald-300">
              Terverifikasi APK
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
              <div className="text-[10px] text-slate-400">Hak Pembuatan Klan</div>
              <div className="mt-0.5 font-semibold text-white">Bebas di 7 Kota</div>
              <div className="mt-0.5 text-[10px] text-amber-300 font-mono">Biaya: 2.000 Crystal</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
              <div className="text-[10px] text-slate-400">Wilayah Komunitas</div>
              <div className="mt-0.5 font-semibold text-sky-300">Terbuka untuk Semua</div>
              <div className="mt-0.5 text-[10px] text-slate-400">Tanpa Batas Pemimpin</div>
            </div>
          </div>
        </div>

        {/* Afiliasi Kota & Klan Terbuka */}
        <div className="space-y-2">
          <h2 className="font-display text-sm font-bold text-white">Afiliasi Wilayah & Klan</h2>

          {/* Kota Aktif */}
          <button
            type="button"
            onClick={() => onOpenCityDetail(featuredCity)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-left transition-colors hover:border-sky-400/50 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <CityEmblemBadge cityId={featuredCity.id} material={featuredCity.material} size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold text-sky-300 truncate">
                  Kota {featuredCity.name} · Lv.{featuredCity.level} ({featuredCity.tier})
                </div>
                <div className="font-display text-xs font-bold text-white truncate mt-0.5">
                  {featuredCity.totalExp.toLocaleString('id-ID')} EXP · {featuredCity.clans.length}/{featuredCity.maxClans} Klan
                </div>
                <div className="truncate text-[10px] text-slate-400 mt-0.5">
                  Wilayah Terbuka Komunitas Nuenime
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          </button>

          {/* Klan Aktif */}
          <button
            type="button"
            onClick={() => onOpenClanDetail(joinedClan)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-left transition-colors hover:border-sky-400/50 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <ClanEmblemIcon
                variant={joinedClan.emblemVariant}
                accentColor={joinedClan.accentColor}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold text-amber-300 truncate">Klan Aktif</div>
                <div className="font-display text-xs font-bold text-white truncate mt-0.5">
                  {joinedClan.name}
                </div>
                <div className="truncate text-[10px] text-slate-400 mt-0.5">
                  {joinedClan.totalExp.toLocaleString('id-ID')} EXP · {joinedClan.memberCount}/{joinedClan.maxMembers} Anggota
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          </button>
        </div>
      </div>
    );
  }

  // Tab "lainnya": Arsitektur & Katalog Aset Visual Dunia Nuenime
  return (
    <div className="nuenime-scroll flex h-full w-full flex-col overflow-y-auto bg-[#070d19] px-3.5 py-3.5 text-slate-100">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="h-5 w-5 text-sky-300" />
            <div>
              <h1 className="font-display text-sm font-bold text-white">
                Arsitektur Sistem Dunia Nuenime
              </h1>
              <p className="text-[11px] text-slate-400">
                7 Kota · 7 Pemimpin Demo · 7 Bos Unik · Aliran EXP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSwitchTab('dunia')}
            className="rounded-lg border border-sky-400/50 bg-sky-500/20 px-2.5 py-1 text-xs font-semibold text-sky-200"
          >
            Ke Peta
          </button>
        </div>

        <div className="mt-3 space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 text-xs text-slate-300">
          <div className="font-semibold text-white">Rantai Aliran EXP Terintegrasi:</div>
          <div className="font-mono text-[11px] text-sky-300">
            Aktivitas Simulasi Anggota → EXP Anggota → EXP Klan → Total EXP Kota → Level & Tier Kota
          </div>
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-emerald-300">
            <Heart className="h-3.5 w-3.5 shrink-0" />
            <span>HP Kota (10.000/10.000) terpisah sepenuhnya dari HP Bos Kota.</span>
          </div>
        </div>
      </div>

      {/* Daftar Aset Visual Terorganisasi */}
      <div className="mt-3.5 rounded-2xl border border-slate-800 bg-slate-900/75 p-3.5">
        <div className="mb-2.5 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-amber-300" />
          <h2 className="font-display text-sm font-bold text-white">
            Resource Aset Visual Terpisah (/assets/nuenime/)
          </h2>
        </div>

        <div className="divide-y divide-slate-800/80">
          {PREPARED_ANDROID_ASSETS.map((asset) => (
            <div
              key={asset.name}
              className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0 text-xs"
            >
              <div className="min-w-0">
                <div className="font-mono text-[11.5px] font-semibold text-sky-200 truncate">
                  {asset.name}
                </div>
                <div className="text-[10.5px] text-slate-400 truncate">{asset.role}</div>
              </div>
              <a
                href={asset.path}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[10.5px] font-medium text-slate-200 hover:border-sky-400/50 hover:text-white shrink-0"
              >
                Lihat File
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Pintasan Cepat */}
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSwitchTab('dunia')}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs font-semibold text-white hover:border-sky-400/50"
        >
          <MapPin className="h-4 w-4 text-sky-300" />
          <span>Peta Dunia</span>
        </button>
        <button
          type="button"
          onClick={() => onSwitchTab('klan')}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs font-semibold text-white hover:border-sky-400/50"
        >
          <Shield className="h-4 w-4 text-amber-300" />
          <span>Leaderboard Klan</span>
        </button>
      </div>
    </div>
  );
};
