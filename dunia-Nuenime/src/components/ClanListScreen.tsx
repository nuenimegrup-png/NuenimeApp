import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  ChevronRight,
  Shield,
  Users,
  Trophy,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { WorldCity, Clan, CityId } from '../types/nuenime';
import { ClanEmblemIcon, CityEmblemBadge } from './icons/NuenimeAssets';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';
import { ClanMenuLoadingScreen } from './ClanMenuLoadingScreen';
import { fantasySoundEngine } from '../utils/soundEngine';

interface ClanListScreenProps {
  cities: WorldCity[];
  initialCityFilter?: CityId;
  onBack: () => void;
  onSelectClan: (clan: Clan) => void;
}

export const ClanListScreen: React.FC<ClanListScreenProps> = ({
  cities,
  initialCityFilter,
  onBack,
  onSelectClan,
}) => {
  const [selectedCityId, setSelectedCityId] = useState<CityId | 'all'>(
    initialCityFilter ?? 'all'
  );
  const [viewMode, setViewMode] = useState<'leaderboard' | 'directory'>('leaderboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingClanMenu, setIsLoadingClanMenu] = useState<boolean>(true);

  useEffect(() => {
    setIsLoadingClanMenu(true);
    fantasySoundEngine.playMarkerSelect();
    const timer = window.setTimeout(() => {
      setIsLoadingClanMenu(false);
    }, 620);
    return () => window.clearTimeout(timer);
  }, [initialCityFilter]);

  const {
    joinedClanId,
    joinClan,
    playerContribution,
    relicShards,
    getClanTotalScore,
    districtInfluence,
    getCityClansLeaderboard,
    getWorldClansLeaderboard,
    globalWorldStats,
  } = useNuenimeRpg();

  const baseRankedClans =
    selectedCityId === 'all'
      ? getWorldClansLeaderboard()
      : getCityClansLeaderboard(selectedCityId);

  const allClans = getWorldClansLeaderboard();
  const joinedClan = allClans.find((c) => c.id === joinedClanId);

  const visibleClans = [...baseRankedClans]
    .filter((clan) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        clan.name.toLowerCase().includes(q) ||
        clan.cityName.toLowerCase().includes(q) ||
        clan.leaderName.toLowerCase().includes(q) ||
        clan.specialization.toLowerCase().includes(q) ||
        clan.tag.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (viewMode === 'directory') {
        return a.name.localeCompare(b.name);
      }
      return 0; // Already deterministically sorted by leaderboard rank
    });

  const activeCityObj =
    selectedCityId !== 'all' ? cities.find((c) => c.id === selectedCityId) : undefined;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#070d19] text-slate-100">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/90 px-3 py-2.5 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-sky-400/50 hover:text-white active:scale-95 whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali</span>
        </button>

        <div className="min-w-0 text-right">
          <h1 className="font-display truncate text-sm font-bold text-white">
            {activeCityObj
              ? `Leaderboard Klan ${activeCityObj.name}`
              : 'Leaderboard Klan Dunia Nuenime'}
          </h1>
          <p className="font-mono text-[10.5px] text-slate-400 tabular-nums">
            EXP Anda: {playerContribution.toLocaleString('id-ID')} · {relicShards} Relik
          </p>
        </div>
      </div>

      {isLoadingClanMenu ? (
        <ClanMenuLoadingScreen
          title={
            activeCityObj
              ? `Membuka Aula Klan ${activeCityObj.name}`
              : 'Membuka Direktori & Leaderboard Klan'
          }
          subtitle={
            activeCityObj
              ? `Menyinkronkan ${activeCityObj.clans.length}/${activeCityObj.maxClans} Klan · Wilayah Terbuka ${activeCityObj.name}`
              : `Memuat ${globalWorldStats.totalClansCount} Klan & ${globalWorldStats.totalClanMembersCount} Anggota Dunia Nuenime`
          }
          accentColor={activeCityObj?.accentHex ?? '#38BDF8'}
        />
      ) : (
        <>

      {/* Global World Statistics Summary + Active Clan Banner */}
      <div className="space-y-2 border-b border-slate-800/70 bg-slate-950/60 px-3.5 py-2.5">
        {/* Global World Stats Bar */}
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-center text-[10.5px]">
          <div>
            <div className="text-slate-400">Total EXP Dunia</div>
            <div className="font-mono font-bold text-sky-300 tabular-nums">
              {globalWorldStats.totalWorldExp.toLocaleString('id-ID')}
            </div>
          </div>
          <div className="border-x border-slate-800">
            <div className="text-slate-400">Total Klan</div>
            <div className="font-mono font-bold text-amber-300 tabular-nums">
              {globalWorldStats.totalClansCount} Klan
            </div>
          </div>
          <div>
            <div className="text-slate-400">Total Anggota</div>
            <div className="font-mono font-bold text-emerald-300 tabular-nums">
              {globalWorldStats.totalClanMembersCount} Anggota
            </div>
          </div>
        </div>

        {joinedClan && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/25 px-3 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <ClanEmblemIcon
                variant={joinedClan.emblemVariant}
                accentColor={joinedClan.accentColor}
                size={26}
              />
              <div className="min-w-0">
                <div className="text-[10px] font-medium text-emerald-300">Klan Aktif Anda</div>
                <div className="font-display text-xs font-bold text-white truncate">
                  {joinedClan.name} [{joinedClan.tag}] · {joinedClan.totalExp.toLocaleString('id-ID')} EXP
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectClan(joinedClan)}
              className="rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/30 whitespace-nowrap shrink-0"
            >
              Markas Klan
            </button>
          </div>
        )}

        {/* Mode Switcher: Leaderboard EXP vs Direktori */}
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1">
          <button
            type="button"
            onClick={() => setViewMode('leaderboard')}
            className={`flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'leaderboard'
                ? 'bg-sky-500/25 text-white border border-sky-400/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="h-3.5 w-3.5 text-amber-300" />
            <span>
              {selectedCityId === 'all' ? 'Leaderboard Dunia' : `Leaderboard ${activeCityObj?.name}`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('directory')}
            className={`flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'directory'
                ? 'bg-sky-500/25 text-white border border-sky-400/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="h-3.5 w-3.5 text-sky-300" />
            <span>Direktori A-Z</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama klan, kota, atau pemimpin..."
            className="h-9 w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-400/60 focus:outline-none"
          />
        </div>

        {/* Interactive Filter Buttons by Scope: Seluruh Dunia vs Per Kota */}
        <div className="nuenime-scroll flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setSelectedCityId('all')}
            className={`flex min-h-[34px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              selectedCityId === 'all'
                ? 'bg-sky-500/25 text-sky-200 border border-sky-400/50'
                : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            <Globe className="h-3.5 w-3.5 text-sky-300" />
            <span>Dunia ({allClans.length})</span>
          </button>

          {cities.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCityId(c.id)}
              className={`flex min-h-[34px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                selectedCityId === c.id
                  ? 'bg-sky-500/25 text-white border border-sky-400/50'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              <CityEmblemBadge cityId={c.id} material={c.material} size={18} />
              <span>
                {c.name} ({c.clans.length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Clan Leaderboard & Directory List */}
      <div className="nuenime-scroll flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
        {visibleClans.map((clan, idx) => {
          const rank = idx + 1;
          const totalScore = getClanTotalScore(clan.id);
          const isJoined = joinedClanId === clan.id;
          const influence = districtInfluence[clan.id]?.influencePercent ?? 68;
          const parentCity = cities.find((c) => c.id === clan.cityId);

          return (
            <div
              key={clan.id}
              className={`flex flex-col gap-2 rounded-2xl border p-3 transition-all ${
                isJoined
                  ? 'border-emerald-400/50 bg-slate-900/90'
                  : 'border-slate-800/90 bg-slate-900/75 hover:border-sky-400/50'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Rank Badge in Leaderboard Mode */}
                {viewMode === 'leaderboard' && (
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold tabular-nums ${
                      rank === 1
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-400/50'
                        : rank === 2
                        ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40'
                        : rank === 3
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-400/40'
                        : 'bg-slate-800/90 text-slate-400'
                    }`}
                  >
                    #{rank}
                  </div>
                )}

                <ClanEmblemIcon
                  variant={clan.emblemVariant}
                  accentColor={clan.accentColor}
                  size={44}
                  className="shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display truncate text-sm font-bold text-white">
                      {clan.name}{' '}
                      <span className="font-mono text-[10.5px] text-sky-300">[{clan.tag}]</span>
                    </h2>
                    <span className="font-mono text-xs font-bold text-amber-300 tabular-nums shrink-0">
                      {totalScore.toLocaleString('id-ID')} EXP
                    </span>
                  </div>

                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="text-sky-300 font-medium">
                      Kota {clan.cityName}
                      {parentCity ? ` (Lv.${parentCity.level})` : ''}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{clan.strongholdDistrict}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-emerald-300 tabular-nums">
                      {influence}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-2 truncate">
                  <span className="inline-flex items-center gap-1 text-slate-200">
                    <Shield className="h-3 w-3 text-amber-300" />
                    {clan.leaderName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-mono text-sky-300 tabular-nums">
                    <Users className="h-3 w-3" />
                    {clan.memberCount}/{clan.maxMembers} Anggota
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!isJoined ? (
                    <button
                      type="button"
                      onClick={() => joinClan(clan.id)}
                      className="rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25"
                    >
                      Gabung
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aktif
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectClan(clan)}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-400/50 bg-sky-500/20 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-500/30"
                  >
                    <span>Detail</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
};
