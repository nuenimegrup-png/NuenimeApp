import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Shield,
  Users,
  MapPin,
  Award,
  Calendar,
  Compass,
  CheckCircle2,
  Swords,
  ArrowUpCircle,
} from 'lucide-react';
import { Clan, WorldCity } from '../types/nuenime';
import { ClanEmblemIcon, CityEmblemBadge } from './icons/NuenimeAssets';
import { useNuenimeRpg, CLAN_MISSIONS } from '../context/NuenimeRpgContext';
import { getClanRelicInfo } from '../data/nuenimeRpgFeaturesData';
import { ClanMenuLoadingScreen } from './ClanMenuLoadingScreen';
import { fantasySoundEngine } from '../utils/soundEngine';

interface ClanDetailScreenProps {
  clan: Clan;
  city?: WorldCity;
  onBack: () => void;
  onNavigateToCity: (cityId: Clan['cityId']) => void;
}

/**
 * ClanDetailScreen menampilkan profil lengkap klan, kapasitas anggota (X/100),
 * Artefak Pusaka & Buff Elemen, Misi Simulasi Komunitas, serta daftar anggota beserta kontribusi EXP.
 */
export const ClanDetailScreen: React.FC<ClanDetailScreenProps> = ({
  clan,
  city,
  onBack,
  onNavigateToCity,
}) => {
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(true);

  useEffect(() => {
    setIsLoadingDetail(true);
    fantasySoundEngine.playMarkerSelect();
    const timer = window.setTimeout(() => {
      setIsLoadingDetail(false);
    }, 580);
    return () => window.clearTimeout(timer);
  }, [clan.id]);

  const {
    joinedClanId,
    joinClan,
    relicShards,
    relicLevels,
    upgradeClanRelic,
    districtInfluence,
    reinforceClanDistrict,
    getClanTotalScore,
    completedMissionCounts,
    completeClanMission,
  } = useNuenimeRpg();

  const isJoined = joinedClanId === clan.id;
  const relicInfo = getClanRelicInfo(clan.id, clan.cityName, clan.specialization);
  const currentRelicLevel = relicLevels[clan.id] ?? 1;
  const currentBuffBonus =
    relicInfo.baseBonusPercent + (currentRelicLevel - 1) * relicInfo.bonusPerLevel;
  const upgradeShardCost = currentRelicLevel * 2;
  const totalClanExp = getClanTotalScore(clan.id);
  const influence = districtInfluence[clan.id]?.influencePercent ?? 68;
  const clanMissions = CLAN_MISSIONS;

  const sortedMembers = [...clan.members].sort(
    (a, b) => b.contributionScore - a.contributionScore
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#070d19] text-slate-100">
      {/* Sticky Header */}
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
          <div className="font-display truncate text-sm font-bold text-white">{clan.name}</div>
          <div className="font-mono text-[10.5px] text-slate-400 tabular-nums">
            EXP Klan: {totalClanExp.toLocaleString('id-ID')} · {relicShards} Pecahan Relik
          </div>
        </div>
      </div>

      {isLoadingDetail ? (
        <ClanMenuLoadingScreen
          title={`Memasuki Markas ${clan.name} [${clan.tag}]`}
          subtitle={`Distrik ${clan.strongholdDistrict} · Kota ${clan.cityName}`}
          accentColor={clan.accentColor}
        />
      ) : (
      /* Scrollable Clan Profile Content */
      <div className="nuenime-scroll flex-1 space-y-4 overflow-y-auto pb-5">
        {/* Hero Crest Pedestal Showcase */}
        <div className="relative flex flex-col items-center justify-end overflow-hidden border-b border-slate-800 px-4 pt-6 pb-5 text-center">
          <img
            src="/assets/nuenime/clan_emblem_pedestal.webp"
            alt=""
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070d19] via-[#070d19]/65 to-slate-950/40" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="rounded-full p-2">
              <ClanEmblemIcon
                variant={clan.emblemVariant}
                accentColor={clan.accentColor}
                size={76}
              />
            </div>

            <div className="mt-2 text-[11px] font-medium text-sky-300">
              {clan.reputationRank} · [{clan.tag}] · Level Klan {clan.level}
            </div>
            <h1 className="font-display mt-0.5 text-xl font-bold tracking-wide text-white">
              {clan.name}
            </h1>
            <p className="mt-1 max-w-xs text-xs italic text-slate-300">
              &ldquo;{clan.motto}&rdquo;
            </p>

            {/* Primary Join Clan / Active Clan Action */}
            <div className="mt-3.5 flex items-center gap-2">
              {isJoined ? (
                <div className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-400/60 bg-emerald-950/70 px-4 py-1.5 text-xs font-bold text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <span>Klan Aktif Anda</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => joinClan(clan.id)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-sky-300/65 bg-gradient-to-r from-sky-600 to-indigo-700 px-5 py-2 text-xs font-bold text-white transition-transform active:scale-95"
                >
                  <Shield className="h-4 w-4" />
                  <span>Gabung ke {clan.name}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onNavigateToCity(clan.cityId)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs font-semibold text-sky-200 hover:border-sky-400/50"
              >
                <MapPin className="h-4 w-4 text-sky-300" />
                <span>Kota {clan.cityName}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3.5 px-3.5">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-2.5 text-center">
              <div className="text-[10.5px] text-slate-400">Kapasitas Anggota</div>
              <div className="font-mono mt-0.5 text-sm font-bold text-white tabular-nums">
                {clan.memberCount} / {clan.maxMembers}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-2.5 text-center">
              <div className="text-[10.5px] text-slate-400">Kendali Distrik</div>
              <div className="font-mono mt-0.5 text-sm font-bold text-amber-300 tabular-nums">
                {influence}%
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-2.5 text-center">
              <div className="text-[10.5px] text-slate-400">Total EXP Klan</div>
              <div className="font-mono mt-0.5 text-sm font-bold text-sky-300 tabular-nums">
                {totalClanExp.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {/* Artefak Pusaka & Buff Elemen Klan */}
          <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-amber-950/25 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-300" />
                <h2 className="font-display text-sm font-bold text-white">
                  Artefak Pusaka & Buff Elemen
                </h2>
              </div>
              <span className="font-mono text-xs font-bold text-amber-300 tabular-nums">
                Level {currentRelicLevel}
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10.5px] font-medium text-amber-300">
                    {relicInfo.relicTitle}
                  </div>
                  <div className="font-display text-sm font-bold text-white">
                    {relicInfo.relicName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Buff Aktif</div>
                  <div className="font-mono text-xs font-bold text-emerald-300 tabular-nums">
                    +{currentBuffBonus}% {relicInfo.elementBuffName}
                  </div>
                </div>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-300">
                {relicInfo.lore}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="text-[11px] text-slate-300">
                Pecahan Relik Anda:{' '}
                <span className="font-mono font-bold text-amber-300 tabular-nums">
                  {relicShards}
                </span>
              </div>

              <button
                type="button"
                onClick={() => upgradeClanRelic(clan.id)}
                className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-amber-400/55 bg-amber-500/20 px-3.5 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-500/30 active:scale-95 whitespace-nowrap shrink-0"
              >
                <ArrowUpCircle className="h-4 w-4 text-amber-300" />
                <span>Tingkatkan Artefak ({upgradeShardCost} Relik)</span>
              </button>
            </div>
          </div>

          {/* Penguasaan Distrik Markas & Misi Simulasi Klan */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10.5px] text-sky-300">Distrik Markas Kota {clan.cityName}</div>
                <h2 className="font-display text-sm font-bold text-white">
                  {clan.strongholdDistrict} (Kendali {influence}%)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => reinforceClanDistrict(clan.id)}
                className="flex min-h-[34px] items-center gap-1 rounded-xl border border-sky-400/50 bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100 hover:bg-sky-500/30 active:scale-95 whitespace-nowrap shrink-0"
              >
                <Swords className="h-3.5 w-3.5 text-sky-300" />
                <span>Perkuat Distrik</span>
              </button>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${influence}%`, backgroundColor: clan.accentColor }}
              />
            </div>

            {/* Misi Simulasi Klan */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  Misi Komunitas Klan ({clanMissions.length})
                </span>
                <span className="rounded bg-amber-950/90 px-1.5 py-0.5 font-mono text-[9px] text-amber-300 border border-amber-400/40">
                  MODE SIMULASI
                </span>
              </div>
              {clanMissions.map((msn) => {
                const count = completedMissionCounts[msn.id] ?? 0;
                return (
                  <div
                    key={msn.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-xs font-bold text-white truncate">
                        {msn.title}
                      </div>
                      <div className="text-[10.5px] text-slate-400">
                        +{msn.rewardExp} EXP (Anggota → Klan → Kota {clan.cityName})
                        {count > 0 ? ` · Selesai ${count}x` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => completeClanMission(msn)}
                      className="rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30 active:scale-95 whitespace-nowrap shrink-0"
                    >
                      Simulasikan
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leader Highlight Card */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-3.5">
            <div className="text-[11px] font-semibold text-amber-300">Pemimpin Klan</div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-400/50 bg-slate-950">
                  <Shield className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-white">
                    {clan.leaderName}
                  </div>
                  <div className="text-xs text-slate-400">{clan.leaderTitle}</div>
                </div>
              </div>

              {city && (
                <button
                  type="button"
                  onClick={() => onNavigateToCity(city.id)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-950/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:border-sky-400/50"
                >
                  <CityEmblemBadge cityId={city.id} material={city.material} size={20} />
                  <span>
                    {city.name} (Lv.{city.level})
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Deskripsi & Sejarah Klan */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-3.5 space-y-2">
            <h2 className="font-display text-sm font-bold text-white">Profil & Sejarah Klan</h2>
            <p className="text-xs leading-relaxed text-slate-300">{clan.description}</p>
            <p className="text-xs leading-relaxed text-slate-400">{clan.historyLore}</p>

            <div className="mt-3 space-y-1.5 border-t border-slate-800 pt-2.5 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="h-3.5 w-3.5 text-sky-300 shrink-0" />
                <span>Markas Distrik: {clan.strongholdDistrict}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Compass className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                <span>Spesialisasi: {clan.specialization}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Calendar className="h-3.5 w-3.5 text-purple-300 shrink-0" />
                <span>Era Berdiri: {clan.foundedEra}</span>
              </div>
            </div>
          </div>

          {/* Daftar Anggota & Kontribusi EXP */}
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-300" />
                <h2 className="font-display text-sm font-bold text-white">
                  Daftar Anggota & Kontribusi EXP
                </h2>
              </div>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                {clan.memberCount} / {clan.maxMembers} Anggota
              </span>
            </div>

            <div className="divide-y divide-slate-800/80">
              {sortedMembers.map((member, index) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-400">#{index + 1}</span>
                      <span className="text-xs font-semibold text-white truncate">
                        {member.name}
                      </span>
                      <span className="text-[10.5px] text-sky-300">· {member.role}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {member.title} · Afinitas {member.elementAffinity}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-amber-300 tabular-nums">
                      <Award className="h-3.5 w-3.5" />
                      {member.contributionScore.toLocaleString('id-ID')} EXP
                    </div>
                    <div className="text-[10px] text-slate-500">Kontribusi Klan</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
