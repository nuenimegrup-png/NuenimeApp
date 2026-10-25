import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Users,
  Save,
  CheckCircle2,
  Crown,
  Swords,
  Scroll,
  Sparkles,
  Award,
  UserCheck,
  Sprout,
  Image as ImageIcon,
  Compass,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { Clan, ClanRoleTitle, WorldCity, BottomNavTab } from '../types/nuenime';
import { ClanEmblemIcon } from './icons/NuenimeAssets';
import { useNuenimeRpg } from '../context/NuenimeRpgContext';

interface ClanSettingsScreenProps {
  clans: Clan[];
  cities: WorldCity[];
  onSwitchTab: (tab: BottomNavTab) => void;
  onOpenClanDetail?: (clan: Clan) => void;
}

// 8 Pilihan Jabatan Resmi RPG Nuenime dengan Ikon dan Deskripsi
export const CLAN_ROLES_LIST: Array<{
  id: ClanRoleTitle;
  label: string;
  badgeColor: string;
  description: string;
}> = [
  {
    id: 'Pemimpin Klan',
    label: '👑 Pemimpin Klan',
    badgeColor: 'border-amber-400/60 bg-amber-500/20 text-amber-300',
    description: 'Penguasa tertinggi klan dengan kendali penuh pengaturan & anggota.',
  },
  {
    id: 'Wakil Pemimpin',
    label: '⚔️ Wakil Pemimpin',
    badgeColor: 'border-sky-400/60 bg-sky-500/20 text-sky-200',
    description: 'Tangan kanan pemimpin yang mengawasi aktivitas & rekrutmen klan.',
  },
  {
    id: 'Tetua Klan',
    label: '📜 Tetua Klan',
    badgeColor: 'border-purple-400/60 bg-purple-500/20 text-purple-200',
    description: 'Dewan penasihat klan yang dihormati dan memandu strategi petualang.',
  },
  {
    id: 'Panglima Ksatria',
    label: '🛡️ Panglima Ksatria',
    badgeColor: 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200',
    description: 'Komandan garda depan pertempuran distrik kota dan simulasi misi.',
  },
  {
    id: 'Arkanis Agung',
    label: '🔮 Arkanis Agung',
    badgeColor: 'border-indigo-400/60 bg-indigo-500/20 text-indigo-200',
    description: 'Penguasa pusaka relik dan pengelola berkah afinitas elemen klan.',
  },
  {
    id: 'Ksatria Inti',
    label: '🗡️ Ksatria Inti',
    badgeColor: 'border-teal-400/60 bg-teal-500/20 text-teal-200',
    description: 'Pejuang berdedikasi tinggi dengan kontribusi EXP harian yang aktif.',
  },
  {
    id: 'Anggota',
    label: '👥 Anggota',
    badgeColor: 'border-slate-600 bg-slate-800 text-slate-300',
    description: 'Warga setia komunitas klan yang berpartisipasi dalam misi kota.',
  },
  {
    id: 'Rekrut Baru',
    label: '🌱 Rekrut Baru',
    badgeColor: 'border-lime-500/50 bg-lime-950/40 text-lime-300',
    description: 'Anggota baru yang sedang menjalani masa bimbingan petualangan.',
  },
];

export const ClanSettingsScreen: React.FC<ClanSettingsScreenProps> = ({
  clans,
  cities,
  onSwitchTab,
  onOpenClanDetail,
}) => {
  const {
    joinedClanId,
    updateClanProfile,
    updateMemberRole,
    districtInfluence,
    getClanTotalScore,
  } = useNuenimeRpg();

  // Ambil klan aktif pengguna
  const currentClan = clans.find((c) => c.id === joinedClanId);

  // Form State Pengaturan Profil Klan
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [motto, setMotto] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  // Inisialisasi formulir dari data klan aktif
  useEffect(() => {
    if (currentClan) {
      setName(currentClan.name);
      setTag(currentClan.tag);
      setMotto(currentClan.motto || '');
      setDescription(currentClan.description || '');
      setLogoUrl(currentClan.logoUrl || '');
    }
  }, [currentClan]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClan) return;

    updateClanProfile(currentClan.id, {
      name,
      tag,
      motto,
      description,
      logoUrl,
    });

    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2400);
  };

  // Jika belum memiliki / bergabung ke klan
  if (!currentClan) {
    return (
      <div className="nuenime-scroll flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-[#070d19] px-5 py-8 text-center text-slate-100">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/90 text-amber-300 mb-3">
          <Shield className="h-8 w-8" />
        </div>
        <h1 className="font-display text-base font-bold text-white">
          Belum Ada Klan Aktif
        </h1>
        <p className="mt-1.5 max-w-xs text-xs text-slate-400 leading-relaxed">
          Menu Pengaturan & Manajemen Klan akan aktif setelah Anda mendirikan klan (biaya 2.000 💎 di kota mana pun) atau bergabung ke dalam klan petualang.
        </p>

        <div className="mt-5 flex flex-col gap-2 w-full max-w-xs">
          <button
            type="button"
            onClick={() => onSwitchTab('dunia')}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-sky-400/50 bg-sky-600 text-xs font-bold text-white hover:bg-sky-500 active:scale-95"
          >
            <Compass className="h-4 w-4" />
            <span>Peta Dunia & Aula Kota</span>
          </button>
          <button
            type="button"
            onClick={() => onSwitchTab('klan')}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-300 hover:text-white active:scale-95"
          >
            <Users className="h-4 w-4" />
            <span>Buka Leaderboard Klan</span>
          </button>
        </div>
      </div>
    );
  }

  const influence = districtInfluence[currentClan.id]?.influencePercent ?? 68;
  const totalScore = getClanTotalScore(currentClan.id);

  return (
    <div className="nuenime-scroll flex h-full w-full flex-col overflow-y-auto bg-[#070d19] px-3.5 py-3.5 pb-8 text-slate-100">
      {/* Header Utama Pengaturan Klan */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0B0E14]/95 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <ClanEmblemIcon
                variant={currentClan.emblemVariant}
                accentColor={currentClan.accentColor}
                logoUrl={currentClan.logoUrl}
                size={46}
                className="shrink-0"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                  Pengaturan Klan
                </span>
                <span className="rounded bg-sky-950/80 border border-sky-400/40 px-1.5 py-0.2 font-mono text-[9px] font-bold text-sky-200">
                  [{currentClan.tag}]
                </span>
              </div>
              <h1 className="font-display truncate text-sm font-bold text-white mt-0.5">
                {currentClan.name}
              </h1>
              <div className="flex items-center gap-2 text-[10.5px] text-slate-400 mt-0.5">
                <span className="text-sky-300">Kota {currentClan.cityName}</span>
                <span>·</span>
                <span className="font-mono text-amber-300 font-bold">{totalScore.toLocaleString('id-ID')} EXP</span>
              </div>
            </div>
          </div>

          {onOpenClanDetail && (
            <button
              type="button"
              onClick={() => onOpenClanDetail(currentClan)}
              className="flex h-8 items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/90 px-2.5 text-[11px] font-semibold text-slate-200 hover:text-white shrink-0 active:scale-95"
            >
              <span>Markas</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: FORMULIR UBAH PROFIL & LOGO KLAN */}
      <form onSubmit={handleSaveProfile} className="mt-3.5 space-y-3 rounded-2xl border border-slate-800/90 bg-slate-900/80 p-3.5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-sky-400" />
            <h2 className="font-display text-xs font-bold text-white uppercase tracking-wide">
              Pengaturan Profil & Identitas Klan
            </h2>
          </div>
          {isSavedRecently && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tersimpan
            </span>
          )}
        </div>

        {/* Preview & Input Link Foto Logo Bulat */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-amber-400" />
              <span>Link Foto / Logo Bulat Klan</span>
            </label>
            <span className="text-[10px] text-slate-400">(Format Gambar: .png / .jpg / .webp)</span>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/80 bg-slate-900">
              {logoUrl.trim() ? (
                <img
                  src={logoUrl.trim()}
                  alt="Preview Logo"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  className="h-full w-full object-cover rounded-full"
                />
              ) : (
                <ClanEmblemIcon
                  variant={currentClan.emblemVariant}
                  accentColor={currentClan.accentColor}
                  size={32}
                />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://i.ibb.co.com/.../logo.png"
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400">
                Foto akan otomatis dijadikan logo bulat dengan bingkai emas klan.
              </p>
            </div>
          </div>
        </div>

        {/* Nama & Tag Klan */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Nama Klan
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-sky-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Tag Klan
            </label>
            <input
              type="text"
              maxLength={5}
              required
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase())}
              className="h-9 w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 font-mono text-xs uppercase text-white focus:border-sky-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Motto / Slogan Klan */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">
            Moto / Slogan Klan
          </label>
          <input
            type="text"
            value={motto}
            onChange={(e) => setMotto(e.target.value)}
            placeholder="Contoh: Demi kehormatan dan persaudaraan!"
            className="h-9 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-sky-400 focus:outline-none"
          />
        </div>

        {/* Deskripsi & Lore Klan */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">
            Deskripsi Profil Klan
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-sky-400/50 bg-sky-600 text-xs font-bold text-white transition-all hover:bg-sky-500 active:scale-[0.98]"
        >
          <Save className="h-4 w-4" />
          <span>Simpan Perubahan Profil Klan</span>
        </button>
      </form>

      {/* SECTION 2: DAFTAR ANGGOTA & PEMBERIAN JABATAN */}
      <div className="mt-3.5 space-y-3 rounded-2xl border border-slate-800/90 bg-slate-900/80 p-3.5">
        <div className="border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              <h2 className="font-display text-xs font-bold text-white uppercase tracking-wide">
                Manajemen Anggota & Jabatan Klan
              </h2>
            </div>
            <span className="font-mono text-[10.5px] font-bold text-slate-300">
              {currentClan.memberCount}/{currentClan.maxMembers} Anggota
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Atur dan tetapkan gelar kehormatan untuk setiap anggota klan Anda di bawah ini:
          </p>
        </div>

        {/* Daftar Anggota dengan Dropdown Jabatan */}
        <div className="space-y-2.5">
          {currentClan.members.map((member, idx) => {
            return (
              <div
                key={member.id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-400">#{idx + 1}</span>
                      <span className="text-xs font-bold text-white truncate">
                        {member.name}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">
                        · Afinitas {member.elementAffinity}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-[10.5px]">
                      <span className="font-mono font-semibold text-amber-300">
                        {member.contributionScore.toLocaleString('id-ID')} EXP Kontribusi
                      </span>
                    </div>
                  </div>

                  {/* Dropdown Jabatan Kehormatan */}
                  <div className="shrink-0 text-right">
                    <label className="block text-[9.5px] font-semibold text-slate-400 mb-0.5">
                      Jabatan Anggota:
                    </label>
                    <select
                      value={member.role}
                      onChange={(e) =>
                        updateMemberRole(currentClan.id, member.id, e.target.value)
                      }
                      className="h-8 rounded-lg border border-slate-700 bg-slate-900 px-2 text-[11px] font-semibold text-sky-200 focus:border-sky-400 focus:outline-none"
                    >
                      {CLAN_ROLES_LIST.map((roleItem) => (
                        <option key={roleItem.id} value={roleItem.id}>
                          {roleItem.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: KETERANGAN HIERARKI JABATAN RESMI */}
      <div className="mt-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/60 p-3.5">
        <h3 className="font-display text-xs font-bold text-amber-300 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Award className="h-4 w-4" />
          <span>Panduan Hierarki Jabatan Klan Nuenime</span>
        </h3>
        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          {CLAN_ROLES_LIST.map((role) => (
            <div
              key={role.id}
              className="flex items-start gap-2 rounded-lg border border-slate-800/60 bg-slate-950/40 p-2"
            >
              <span className="font-bold text-white whitespace-nowrap shrink-0">
                {role.label}
              </span>
              <span className="text-slate-400 text-[10.5px] leading-snug">
                — {role.description}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
