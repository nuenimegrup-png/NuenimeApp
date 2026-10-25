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
  Crown,
  Zap,
  X,
  Building2,
} from 'lucide-react';
import { WorldCity, Clan, CityId } from '../types/nuenime';
import { ClanEmblemIcon, CityEmblemBadge } from './icons/NuenimeAssets';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';
import { ClanMenuLoadingScreen } from './ClanMenuLoadingScreen';
import { fantasySoundEngine } from '../utils/soundEngine';

interface ClanLeaderboardScreenProps {
  cities: WorldCity[];
  initialCityFilter?: CityId;
  onBack: () => void;
  onSelectClan: (clan: Clan) => void;
}

export const ClanLeaderboardScreen: React.FC<ClanLeaderboardScreenProps> = ({
  cities,
  initialCityFilter,
  onBack,
  onSelectClan,
}) => {
  // Category Mode: 'world' (Leaderboard Dunia) vs 'city' (Leaderboard Berdasarkan Kota)
  const [categoryMode, setCategoryMode] = useState<'world' | 'city'>(
    initialCityFilter ? 'city' : 'world'
  );
  const [selectedCityId, setSelectedCityId] = useState<CityId | 'all'>(
    initialCityFilter ?? 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsLoading(true);
    fantasySoundEngine.playMarkerSelect();
    const timer = window.setTimeout(() => {
      setIsLoading(false);
    }, 450);
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

  // Ambil data ranking valid
  const baseRankedClans =
    categoryMode === 'world' || selectedCityId === 'all'
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
      // Urutkan berdasarkan total EXP klan tertinggi (dengan tie-break nama)
      const scoreA = getClanTotalScore(a.id);
      const scoreB = getClanTotalScore(b.id);
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return a.name.localeCompare(b.name);
    });

  const activeCityObj =
    categoryMode === 'city' && selectedCityId !== 'all'
      ? cities.find((c) => c.id === selectedCityId)
      : undefined;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#070d19] text-slate-100">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 bg-[#0B0E14]/95 px-3.5 py-2.5 backdrop-blur-md shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex h-[36px] items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-sky-400/50 hover:text-white active:scale-95 whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali</span>
        </button>

        <div className="min-w-0 text-right">
          <h1 className="font-display truncate text-xs sm:text-sm font-bold text-white tracking-wide uppercase">
            Leaderboard Klan
          </h1>
          <div className="mt-0.5 flex items-center justify-end gap-1.5 font-mono text-[10px]">
            <span className="rounded bg-sky-950/70 border border-sky-500/30 px-1.5 py-0.5 font-bold text-sky-300 tabular-nums">
              EXP Anda: {playerContribution.toLocaleString('id-ID')}
            </span>
            <span className="rounded bg-amber-950/70 border border-amber-500/30 px-1.5 py-0.5 font-bold text-amber-300 tabular-nums">
              {relicShards} Relik
            </span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <ClanMenuLoadingScreen
          title="Memuat Leaderboard Klan"
          subtitle={`Menyinkronkan peringkat ${allClans.length} klan Dunia Nuenime...`}
          accentColor="#38BDF8"
        />
      ) : (
        <>
          {/* Controls & Filter Section */}
          <div className="space-y-2.5 border-b border-slate-800/80 bg-[#0B0E14]/90 px-3.5 py-2.5 shrink-0">
            {/* Navigasi Kategori: Leaderboard Dunia vs Leaderboard Berdasarkan Kota */}
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-700/80 bg-slate-900/90 p-1">
              <button
                type="button"
                onClick={() => {
                  setCategoryMode('world');
                  setSelectedCityId('all');
                }}
                className={`flex h-[34px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  categoryMode === 'world'
                    ? 'bg-sky-600 text-white border border-sky-400/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="h-3.5 w-3.5 text-sky-300 shrink-0" />
                <span>Leaderboard Dunia</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCategoryMode('city');
                }}
                className={`flex h-[34px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  categoryMode === 'city'
                    ? 'bg-sky-600 text-white border border-sky-400/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                <span>Filter Kota</span>
              </button>
            </div>

            {/* Filter Pills Kota (Hanya jika memilih mode Filter Kota) */}
            {categoryMode === 'city' && (
              <div
                className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedCityId('all')}
                  className={`flex h-[30px] items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    selectedCityId === 'all'
                      ? 'bg-sky-500/25 text-sky-200 border border-sky-400/50'
                      : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Globe className="h-3.5 w-3.5 text-sky-300" />
                  <span>Semua Kota ({allClans.length})</span>
                </button>

                {cities.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCityId(c.id)}
                    className={`flex h-[30px] items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                      selectedCityId === c.id
                        ? 'bg-sky-500/25 text-white border border-sky-400/50'
                        : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <CityEmblemBadge cityId={c.id} material={c.material} size={15} />
                    <span>
                      {c.name} ({c.clans.length})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Search Input Bar */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama klan, kota, atau pemimpin..."
                className="h-8.5 w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-9 pr-8 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-400/60 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Indikator Status & Keterangan Mode */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
              <span>
                {categoryMode === 'world'
                  ? 'Peringkat Global Seluruh Kota'
                  : activeCityObj
                  ? `Leaderboard Kota ${activeCityObj.name} (Lv.${activeCityObj.level})`
                  : 'Peringkat Berdasarkan Kota'}
              </span>
              <span className="font-mono text-slate-300 font-semibold">
                {visibleClans.length} Klan Ditemukan
              </span>
            </div>
          </div>

          {/* Scrollable Clan Leaderboard List */}
          <div className="nuenime-scroll flex-1 space-y-2.5 overflow-y-auto px-3.5 py-2.5">
            {visibleClans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-10 w-10 text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-300">Tidak ada klan ditemukan</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Coba ubah kata kunci pencarian atau filter kota
                </p>
              </div>
            ) : (
              visibleClans.map((clan, idx) => {
                const rank = idx + 1;
                const totalScore = getClanTotalScore(clan.id);
                const isJoined = joinedClanId === clan.id;
                const influence = districtInfluence[clan.id]?.influencePercent ?? 68;
                const parentCity = cities.find((c) => c.id === clan.cityId);

                return (
                  <div
                    key={clan.id}
                    className={`relative overflow-hidden rounded-2xl border transition-all ${
                      isJoined
                        ? 'border-emerald-500/50 bg-[#0e241c]'
                        : 'border-slate-800/90 bg-[#111726]/90 hover:border-sky-500/40'
                    }`}
                  >
                    {/* Card Top: Rank + Emblem + Name & Tag + EXP */}
                    <div className="p-3 pb-2.5">
                      <div className="flex items-start gap-2.5">
                        {/* Rank Badge (Tanpa Bayangan) */}
                        <div
                          className={`flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl font-mono font-black tabular-nums ${
                            rank === 1
                              ? 'bg-amber-500 text-slate-950 ring-1 ring-amber-300'
                              : rank === 2
                              ? 'bg-slate-300 text-slate-950 ring-1 ring-white/60'
                              : rank === 3
                              ? 'bg-amber-700 text-amber-100 ring-1 ring-orange-400/60'
                              : 'bg-slate-900/90 text-slate-400 border border-slate-800 text-xs'
                          }`}
                        >
                          <span className="text-[11px] leading-none">#{rank}</span>
                          {rank <= 3 && (
                            <span className="text-[7.5px] font-sans font-bold uppercase tracking-tight">
                              Top
                            </span>
                          )}
                        </div>

                        {/* Clan Emblem */}
                        <div className="relative shrink-0">
                          <ClanEmblemIcon
                            variant={clan.emblemVariant}
                            accentColor={clan.accentColor}
                            logoUrl={clan.logoUrl}
                            size={38}
                            className="shrink-0"
                          />
                        </div>

                        {/* Main Info */}
                        <div className="min-w-0 flex-1">
                          {/* Title + Tag */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h2 className="font-bold text-[13.5px] leading-snug text-white tracking-wide">
                              {clan.name}
                            </h2>
                            <span className="rounded bg-sky-950/80 border border-sky-400/40 px-1.5 py-0.2 font-mono text-[9px] font-bold text-sky-300 shrink-0">
                              [{clan.tag}]
                            </span>
                          </div>

                          {/* Territory & City */}
                          <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-slate-400 flex-wrap">
                            <span className="font-semibold text-sky-400">
                              Kota {clan.cityName}
                              {parentCity ? ` (Lv.${parentCity.level})` : ''}
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-300 truncate">
                              {clan.strongholdDistrict}
                            </span>
                          </div>
                        </div>

                        {/* EXP Display */}
                        <div className="shrink-0 text-right pl-1">
                          <div className="font-mono text-sm font-extrabold text-amber-300 tabular-nums">
                            {totalScore.toLocaleString('id-ID')}
                          </div>
                          <div className="text-[9px] font-semibold uppercase tracking-wider text-amber-400/70">
                            EXP
                          </div>
                        </div>
                      </div>

                      {/* Metadata Row: Pemimpin, Anggota, Pengaruh */}
                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-800/60 pt-2 text-[10.5px]">
                        <div className="flex items-center gap-3 text-slate-400 min-w-0 flex-1">
                          <span className="flex items-center gap-1 truncate text-slate-300">
                            <Crown className="h-3 w-3 text-amber-400 shrink-0" />
                            <span className="truncate">{clan.leaderName}</span>
                          </span>
                          <span className="flex items-center gap-1 shrink-0 font-mono text-sky-300 font-medium">
                            <Users className="h-3 w-3 text-sky-400" />
                            {clan.memberCount}/{clan.maxMembers}
                          </span>
                          <span className="flex items-center gap-1 shrink-0 font-mono text-emerald-300 font-medium">
                            <Zap className="h-3 w-3 text-emerald-400" />
                            {influence}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Bottom: Clean Actions (Tanpa Bayangan) */}
                    <div className="flex items-center justify-between gap-2 border-t border-slate-800/80 bg-slate-950/40 px-3 py-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-[10px] text-slate-400 italic truncate">
                          "{clan.motto || clan.specialization}"
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isJoined ? (
                          <button
                            type="button"
                            onClick={() => joinClan(clan.id)}
                            className="flex h-[30px] items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-2.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-900/50 active:scale-95 transition-all"
                          >
                            <Shield className="h-3 w-3" />
                            <span>Gabung</span>
                          </button>
                        ) : (
                          <span className="flex h-[30px] items-center gap-1 rounded-xl border border-emerald-500/50 bg-emerald-950/90 px-2.5 text-[11px] font-bold text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Klan Anda</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => onSelectClan(clan)}
                          className="flex h-[30px] items-center gap-1 rounded-xl border border-sky-400/50 bg-sky-600 px-3 text-[11px] font-bold text-white hover:bg-sky-500 active:scale-95 transition-all"
                        >
                          <span>Detail</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};
