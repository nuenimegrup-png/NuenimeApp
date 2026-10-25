import React from 'react';
import { BottomNavTab } from '../types/nuenime';
import {
  NavHomeFantasyIcon,
  NavCharacterFantasyIcon,
  NavWorldCompassIcon,
  NavClanCrestIcon,
  NavMoreGridIcon,
} from './icons/NuenimeAssets';

interface BottomNavigationBarProps {
  activeTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
}

const NAV_ITEMS: Array<{ id: BottomNavTab; label: string }> = [
  { id: 'beranda', label: 'Beranda' },
  { id: 'karakter', label: 'Karakter' },
  { id: 'dunia', label: 'Dunia' },
  { id: 'klan', label: 'Klan' },
  { id: 'lainnya', label: 'Lainnya' },
];

/**
 * BottomNavigationBar dirender sebagai dock permanen (shrink-0) di bagian bawah frame Android
 * dengan latar belakang solid gelap berlapis metalik sehingga peta maupun teks halaman
 * tidak pernah tembus (bleed) ke balik bar navigasi.
 */
export const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <nav
      aria-label="Navigasi Utama Nuenime"
      className="relative z-40 h-[64px] w-full shrink-0 select-none border-t border-slate-700/80 bg-[#060b16] px-2 shadow-[0_-8px_24px_rgba(0,0,0,0.85)]"
    >
      {/* Subtle top metallic highlight line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-sky-300/40 to-transparent"
        aria-hidden="true"
      />

      <div className="grid h-full grid-cols-5 items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-150 focus:outline-none ${
                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              {/* Active frame, top diamond & bottom glow bar */}
              {isActive && (
                <>
                  <span
                    className="pointer-events-none absolute inset-x-1 inset-y-0.5 rounded-xl border border-sky-300/40 bg-gradient-to-b from-sky-400/20 via-sky-500/10 to-sky-400/25 shadow-[0_0_14px_rgba(56,189,248,0.22)]"
                    aria-hidden="true"
                  />
                  <span
                    className="pointer-events-none absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-sky-200 shadow-[0_0_8px_#38bdf8]"
                    aria-hidden="true"
                  />
                  <span
                    className="pointer-events-none absolute bottom-0.5 left-3 right-3 h-[2px] rounded-full bg-sky-300 shadow-[0_0_8px_#38bdf8]"
                    aria-hidden="true"
                  />
                </>
              )}

              <div className="relative z-10 flex h-6 items-center justify-center">
                {item.id === 'beranda' && <NavHomeFantasyIcon active={isActive} />}
                {item.id === 'karakter' && <NavCharacterFantasyIcon active={isActive} />}
                {item.id === 'dunia' && <NavWorldCompassIcon active={isActive} />}
                {item.id === 'klan' && <NavClanCrestIcon active={isActive} />}
                {item.id === 'lainnya' && <NavMoreGridIcon active={isActive} />}
              </div>

              <span
                className={`relative z-10 text-[10.5px] leading-none tracking-tight whitespace-nowrap ${
                  isActive ? 'font-bold text-white' : 'font-medium text-slate-400'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
