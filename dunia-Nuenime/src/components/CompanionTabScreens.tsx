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

        {/* Hero Feature Card: Dunia Nuenime */}
        <div className="relative mt-3.5 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900 p-4">
          <img
            src="/assets/nuenime/city_eldoria.svg"
            alt="Dunia Nuenime"
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />

          <div className="relative z-10">
            <div className="text-[11px] font-semibold text-sky-300">Sistem Komunitas RPG Nuenime</div>
            <h2 className="font-display mt-0.5 text-xl font-bold text-white">
              7 Kota, 7 Bos Unik & Sistem Klan
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              Setiap kota memiliki Level, Tier, HP Kota (10.000/10.000), Pemimpin Kota, Bos Penjaga, dan hingga 15 Klan (maks 100 anggota/klan).
            </p>
            <button
              type="button"
              onClick={() => onOpenWorldMap()}
              className="mt-3 flex min-h-[42px] items-center gap-2 rounded-xl border border-sky-300/60 bg-gradient-to-r from-sky-800/90 to-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:border-sky-200 active:scale-95"
            >
              <CompassRoseIcon size={20} />
              <span>Mulai Jelajahi Peta Dunia</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick Jump to 7 Cities */}
        <div className="mt-4">
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
      <div className="nuenime-scroll flex h-full w-full flex-col overflow-y-auto bg-[#070d19] px-3.5 py-3.5 text-slate-100">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/85 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-sky-300/70 bg-slate-950">
              <CompassRoseIcon size={36} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-sky-300">{activeAccount.title}</span>
                <span className="rounded bg-amber-950 px-1.5 py-0.5 font-mono text-[9px] text-amber-300 border border-amber-400/40">
                  AKUN DEMO
                </span>
              </div>
              <h1 className="font-display text-lg font-bold text-white">
                {activeAccount.displayName}
              </h1>
              <p className="text-xs text-slate-400">
                Kota: {featuredCity.name} · Klan: {joinedClan.name}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-800 pt-3 text-center">
            <div>
              <div className="text-[10.5px] text-slate-400">Saldo Crystal</div>
              <div className="mt-0.5 text-xs font-bold text-amber-300">
                💎 {userCrystals.toLocaleString('id-ID')}
              </div>
            </div>
            <div>
              <div className="text-[10.5px] text-slate-400">Kota Aktif</div>
              <div className="mt-0.5 text-xs font-semibold text-sky-300">
                {featuredCity.name} (Lv.{featuredCity.level})
              </div>
            </div>
            <div>
              <div className="text-[10.5px] text-slate-400">Kontribusi EXP</div>
              <div className="font-mono mt-0.5 text-sm font-bold text-emerald-300 tabular-nums">
                {playerContribution.toLocaleString('id-ID')}
              </div>
            </div>
          </div>
        </div>

        {/* Pemilih Akun Demo (7 Pemimpin Kota & Anggota) */}
        <div className="mt-3.5 rounded-2xl border border-slate-800 bg-slate-900/75 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-amber-300" />
              <h2 className="font-display text-sm font-bold text-white">
                Ganti Akun Demo (7 Pemimpin Kota)
              </h2>
            </div>
            <span className="text-[10.5px] text-slate-400">Uji Izin Buat Klan</span>
          </div>

          <div className="space-y-1.5">
            {availableDemoAccounts.map((acc) => {
              const isSelected = acc.id === activeAccount.id;
              const accCity = acc.ledCityId
                ? cities.find((c) => c.id === acc.ledCityId)
                : undefined;

              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => switchDemoAccount(acc.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border p-2 text-left text-xs transition-all ${
                    isSelected
                      ? 'border-amber-400/60 bg-amber-950/35 text-white'
                      : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-sky-400/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">
                      {acc.displayName}{' '}
                      <span className="text-[10px] text-amber-300">
                        ({acc.role === 'CITY_LEADER' ? `Pemimpin ${accCity?.name}` : 'Anggota'})
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{acc.title}</div>
                  </div>
                  {isSelected && (
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 shrink-0">
                      Digunakan
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Afiliasi Kota & Klan */}
        <div className="mt-3.5 space-y-2.5">
          <h2 className="font-display text-sm font-bold text-white">Afiliasi Kota & Klan</h2>

          <button
            type="button"
            onClick={() => onOpenCityDetail(featuredCity)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-3 text-left hover:border-sky-400/50"
          >
            <div className="flex items-center gap-3 min-w-0">
              <CityEmblemBadge cityId={featuredCity.id} material={featuredCity.material} size={42} />
              <div className="min-w-0">
                <div className="text-[10.5px] text-sky-300">
                  Kota {featuredCity.name} · Lv.{featuredCity.level} ({featuredCity.tier})
                </div>
                <div className="font-display text-sm font-bold text-white">
                  {featuredCity.totalExp.toLocaleString('id-ID')} EXP · {featuredCity.clans.length}/
                  {featuredCity.maxClans} Klan
                </div>
                <div className="truncate text-xs text-slate-400">
                  Pemimpin: {featuredCity.leaderProfile.displayName}
                </div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onOpenClanDetail(joinedClan)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-3 text-left hover:border-sky-400/50"
          >
            <div className="flex items-center gap-3 min-w-0">
              <ClanEmblemIcon
                variant={joinedClan.emblemVariant}
                accentColor={joinedClan.accentColor}
                size={42}
              />
              <div className="min-w-0">
                <div className="text-[10.5px] text-amber-300">Klan Aktif</div>
                <div className="font-display text-sm font-bold text-white">{joinedClan.name}</div>
                <div className="truncate text-xs text-slate-400">
                  {joinedClan.totalExp.toLocaleString('id-ID')} EXP · {joinedClan.memberCount}/
                  {joinedClan.maxMembers} Anggota
                </div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
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
