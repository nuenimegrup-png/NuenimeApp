import React from 'react';
import {
  ArrowLeft,
  Trophy,
  ChevronRight,
  Shield,
  Users,
  Globe,
  Crown,
  Zap,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { WorldCity, Clan, CityId } from '../types/nuenime';
import { ClanEmblemIcon } from './icons/NuenimeAssets';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';

interface ClanHomeScreenProps {
  cities: WorldCity[];
  onOpenLeaderboard: (cityId?: CityId) => void;
  onSelectClan: (clan: Clan) => void;
  onBack: () => void;
}

export const ClanHomeScreen: React.FC<ClanHomeScreenProps> = ({
  cities,
  onOpenLeaderboard,
  onSelectClan,
  onBack,
}) => {
  const {
    joinedClanId,
    playerContribution,
    relicShards,
    getClanTotalScore,
    districtInfluence,
    getWorldClansLeaderboard,
    globalWorldStats,
  } = useNuenimeRpg();

  // Valid ranking dari sistem (seluruh klan diurutkan berdasarkan EXP tertinggi)
  const rankedClans = getWorldClansLeaderboard();
  const topClan = rankedClans.length > 0 ? rankedClans[0] : null;
  const joinedClan = rankedClans.find((c) => c.id === joinedClanId);

  const topClanCity = topClan ? cities.find((c) => c.id === topClan.cityId) : null;
  const topClanScore = topClan ? getClanTotalScore(topClan.id) : 0;
  const topClanInfluence = topClan ? (districtInfluence[topClan.id]?.influencePercent ?? 76) : 0;

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
            Pusat Komunitas Klan
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

      {/* Main Content Area */}
      <div className="nuenime-scroll flex-1 space-y-3.5 overflow-y-auto px-3.5 py-3.5 pb-6">
        {/* Strip Statistik Ringkas Dunia (Tanpa Bayangan) */}
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-800/90 bg-slate-900/90 p-2 text-center">
          <div className="flex flex-col items-center justify-center min-w-0">
            <div className="flex items-center gap-1 text-[9.5px] text-slate-400">
              <Globe className="h-3 w-3 text-sky-400 shrink-0" />
              <span className="truncate">EXP Dunia</span>
            </div>
            <div className="font-mono text-[12.5px] font-extrabold text-sky-300 tabular-nums truncate mt-0.5">
              {globalWorldStats.totalWorldExp.toLocaleString('id-ID')}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center min-w-0 border-x border-slate-800/90 px-1">
            <div className="flex items-center gap-1 text-[9.5px] text-slate-400">
              <Shield className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="truncate">Total Klan</span>
            </div>
            <div className="font-mono text-[12.5px] font-extrabold text-amber-300 tabular-nums truncate mt-0.5">
              {globalWorldStats.totalClansCount}{' '}
              <span className="text-[9.5px] font-sans font-normal text-slate-400">Klan</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center min-w-0">
            <div className="flex items-center gap-1 text-[9.5px] text-slate-400">
              <Users className="h-3 w-3 text-emerald-400 shrink-0" />
              <span className="truncate">Anggota</span>
            </div>
            <div className="font-mono text-[12.5px] font-extrabold text-emerald-300 tabular-nums truncate mt-0.5">
              {globalWorldStats.totalClanMembersCount}{' '}
              <span className="text-[9.5px] font-sans font-normal text-slate-400">Jiwa</span>
            </div>
          </div>
        </div>

        {/* Klan Aktif Pengguna (Jika sudah bergabung) */}
        {joinedClan && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/25 p-3">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <ClanEmblemIcon
                  variant={joinedClan.emblemVariant}
                  accentColor={joinedClan.accentColor}
                  size={36}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-emerald-950/90 border border-emerald-500/50 px-1.5 py-0.2 text-[8.5px] font-bold text-emerald-300 uppercase tracking-wide">
                      Klan Aktif Anda
                    </span>
                    <span className="rounded bg-sky-950/80 border border-sky-400/40 px-1.5 py-0.2 font-mono text-[8.5px] font-bold text-sky-200">
                      [{joinedClan.tag}]
                    </span>
                  </div>
                  <div className="truncate font-bold text-xs text-white mt-0.5">
                    {joinedClan.name}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400 mt-0.5">
                    <span className="font-bold text-amber-300">
                      {joinedClan.totalExp.toLocaleString('id-ID')} EXP
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-sky-300 font-medium">Kota {joinedClan.cityName}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectClan(joinedClan)}
                className="flex h-[32px] items-center gap-1 rounded-xl border border-emerald-400/50 bg-emerald-600 px-3 text-[11px] font-bold text-white hover:bg-emerald-500 active:scale-95 whitespace-nowrap shrink-0"
              >
                <span>Markas Klan</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* SECTION 1: KARTU UNGGULAN KLAN NOMOR 1 */}
        {topClan ? (
          <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900/90 via-slate-900/75 to-[#0B0E14] p-4 text-slate-100">
            {/* Header Kartu: Peringkat #1 & Status */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-lg border border-amber-400/60 bg-amber-500/20 px-2.5 py-1 font-mono text-xs font-black text-amber-300 tracking-wide">
                  <Trophy className="h-3.5 w-3.5 text-amber-300" />
                  PERINGKAT #1 DUNIA
                </span>
              </div>
              <span className="rounded-md border border-slate-700/80 bg-slate-800/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-300">
                {topClan.reputationRank || 'Klan Juara'}
              </span>
            </div>

            {/* Emblem Besar & Identitas Klan */}
            <div className="mt-3.5 flex flex-col items-center text-center">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-950/80 p-2">
                <ClanEmblemIcon
                  variant={topClan.emblemVariant}
                  accentColor={topClan.accentColor}
                  size={58}
                  className="shrink-0"
                />
              </div>

              <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap">
                <h2 className="font-display text-base sm:text-lg font-bold text-white tracking-wide">
                  {topClan.name}
                </h2>
                <span className="rounded bg-sky-950/80 border border-sky-400/40 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-sky-200">
                  [{topClan.tag}]
                </span>
              </div>

              {topClan.motto && (
                <p className="mt-1 max-w-xs text-xs italic text-slate-400 leading-relaxed">
                  &ldquo;{topClan.motto}&rdquo;
                </p>
              )}
            </div>

            {/* Data Detail & Statistik (Liquid Glass Strip) */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
              {/* Kota Asal & Level */}
              <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <MapPin className="h-3 w-3 text-sky-400 shrink-0" />
                  <span>Kota Asal</span>
                </div>
                <div className="font-semibold text-white mt-0.5 truncate">
                  Kota {topClan.cityName}
                </div>
                {topClanCity && (
                  <div className="font-mono text-[9.5px] text-sky-300 mt-0.5">
                    Level {topClanCity.level} · Tier {topClanCity.tier}
                  </div>
                )}
              </div>

              {/* Total EXP Klan */}
              <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Trophy className="h-3 w-3 text-amber-400 shrink-0" />
                  <span>Total EXP</span>
                </div>
                <div className="font-mono text-sm font-extrabold text-amber-300 mt-0.5 tabular-nums">
                  {topClanScore.toLocaleString('id-ID')}
                </div>
                <div className="text-[9.5px] text-slate-400 mt-0.5">Poin Akumulasi</div>
              </div>

              {/* Pemimpin Klan */}
              <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Crown className="h-3 w-3 text-amber-400 shrink-0" />
                  <span>Pemimpin</span>
                </div>
                <div className="font-semibold text-white mt-0.5 truncate">
                  {topClan.leaderName}
                </div>
                <div className="text-[9.5px] text-slate-400 mt-0.5 truncate">
                  {topClan.leaderTitle}
                </div>
              </div>

              {/* Anggota & Pengaruh */}
              <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Users className="h-3 w-3 text-emerald-400 shrink-0" />
                  <span>Anggota & Pengaruh</span>
                </div>
                <div className="font-mono font-semibold text-white mt-0.5 tabular-nums">
                  {topClan.memberCount}/{topClan.maxMembers} Anggota
                </div>
                <div className="font-mono text-[9.5px] text-emerald-300 mt-0.5">
                  <Zap className="inline h-2.5 w-2.5 mr-0.5" />
                  {topClanInfluence}% Pengaruh
                </div>
              </div>
            </div>

            {/* Tombol Lihat Detail Klan #1 */}
            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => onSelectClan(topClan)}
                className="flex h-[38px] w-full items-center justify-center gap-1.5 rounded-xl border border-sky-400/60 bg-sky-600 px-4 text-xs font-bold text-white transition-all hover:bg-sky-500 active:scale-[0.98]"
              >
                <span>Lihat Detail Markas Klan #1</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Empty State yang rapi jika belum ada klan */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 py-12 px-4 text-center">
            <Shield className="h-10 w-10 text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-300">Belum Ada Klan yang Terdaftar</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Jadilah yang pertama mendirikan klan di salah satu dari 7 kota Dunia Nuenime!
            </p>
          </div>
        )}

        {/* SECTION 2: TOMBOL LEADERBOARD TERPISAH (Silver Liquid Glass) */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => onOpenLeaderboard()}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-600/80 bg-gradient-to-r from-slate-800/90 via-slate-800/60 to-slate-900/90 p-3.5 text-left transition-all hover:border-slate-400 hover:bg-slate-700/60 active:scale-[0.98]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-600 bg-slate-700/60 text-amber-300">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold text-white tracking-wide">
                    Leaderboard Klan
                  </span>
                  <span className="rounded bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.2 font-mono text-[9px] font-bold text-amber-300">
                    Semua Peringkat
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5 truncate">
                  Buka ranking lengkap Dunia & filter 7 kota
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="rounded-lg border border-slate-600 bg-slate-800/80 px-2 py-1 font-mono text-[10px] font-bold text-sky-200">
                {rankedClans.length} Klan
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
