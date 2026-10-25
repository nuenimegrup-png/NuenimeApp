import React from 'react';
import { CityId, MarkerMetalMaterial, Clan } from '../../types/nuenime';

interface IconProps {
  className?: string;
  size?: number;
}

export const CompassRoseIcon: React.FC<IconProps> = ({ className = '', size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="nuenimeCompassGrad" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="55%" stopColor="#CBD5E1" />
        <stop offset="100%" stopColor="#64748B" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="20" stroke="url(#nuenimeCompassGrad)" strokeWidth="2.2" opacity="0.9" />
    <circle cx="32" cy="32" r="14" stroke="#94A3B8" strokeWidth="1" strokeDasharray="2.5 2.5" opacity="0.65" />
    <path
      d="M32 3L36.8 25.2L59 32L36.8 38.8L32 61L27.2 38.8L5 32L27.2 25.2L32 3Z"
      fill="url(#nuenimeCompassGrad)"
      stroke="#F8FAFC"
      strokeWidth="1.2"
    />
    <path
      d="M32 14L34.5 29.5L50 32L34.5 34.5L32 50L29.5 34.5L14 32L29.5 29.5L32 14Z"
      fill="#0F172A"
    />
    <circle cx="32" cy="32" r="3.5" fill="#E2E8F0" />
  </svg>
);

export const NuenimeCrestIcon: React.FC<IconProps> = ({ className = '', size = 36 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="crestSilver" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F8FAFC" />
        <stop offset="50%" stopColor="#94A3B8" />
        <stop offset="100%" stopColor="#E2E8F0" />
      </linearGradient>
    </defs>
    {/* Outer ornate fantasy shield frame */}
    <path
      d="M32 4L54 14V31C54 45.5 44.2 55.2 32 60C19.8 55.2 10 45.5 10 31V14L32 4Z"
      fill="#0F172A"
      fillOpacity="0.85"
      stroke="url(#crestSilver)"
      strokeWidth="2.4"
    />
    <path
      d="M32 8L49 16.5V30.5C49 42.2 41.2 50.4 32 54.6C22.8 50.4 15 42.2 15 30.5V16.5L32 8Z"
      stroke="#64748B"
      strokeWidth="1.2"
    />
    {/* Inner star & compass motif */}
    <circle cx="32" cy="31" r="11" stroke="#CBD5E1" strokeWidth="1.5" opacity="0.8" />
    <path
      d="M32 13L35.2 27.8L50 31L35.2 34.2L32 49L28.8 34.2L14 31L28.8 27.8L32 13Z"
      fill="url(#crestSilver)"
    />
    <circle cx="32" cy="31" r="3.2" fill="#0F172A" stroke="#F8FAFC" strokeWidth="1.2" />
  </svg>
);

export const WorldGlobeIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
    <ellipse cx="12" cy="12" rx="4.2" ry="9" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3.6 9H20.4M3.6 15H20.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const MATERIAL_PALETTES: Record<
  MarkerMetalMaterial,
  { outerStart: string; outerMid: string; outerEnd: string; bgInner: string; glow: string; rim: string }
> = {
  'silver-ice': {
    outerStart: '#F8FAFC',
    outerMid: '#7DD3FC',
    outerEnd: '#334155',
    bgInner: '#0B223E',
    glow: '#38BDF8',
    rim: '#BAE6FD',
  },
  'lunar-cyan': {
    outerStart: '#ECFEFF',
    outerMid: '#67E8F9',
    outerEnd: '#1E3A5F',
    bgInner: '#08263A',
    glow: '#22D3EE',
    rim: '#A5F3FC',
  },
  'emerald-bronze': {
    outerStart: '#ECFDF5',
    outerMid: '#6EE7B7',
    outerEnd: '#14532D',
    bgInner: '#062C1E',
    glow: '#34D399',
    rim: '#A7F3D0',
  },
  'imperial-gold': {
    outerStart: '#FEF9C3',
    outerMid: '#FBBF24',
    outerEnd: '#78350F',
    bgInner: '#2C1B06',
    glow: '#F59E0B',
    rim: '#FDE68A',
  },
  'crimson-obsidian': {
    outerStart: '#FEE2E2',
    outerMid: '#F87171',
    outerEnd: '#450A0A',
    bgInner: '#2A080C',
    glow: '#EF4444',
    rim: '#FCA5A5',
  },
  'sun-amber': {
    outerStart: '#FEF3C7',
    outerMid: '#F59E0B',
    outerEnd: '#78350F',
    bgInner: '#2B1705',
    glow: '#FBBF24',
    rim: '#FDE68A',
  },
  'astral-violet': {
    outerStart: '#F3E8FF',
    outerMid: '#C084FC',
    outerEnd: '#3B0764',
    bgInner: '#1E0B36',
    glow: '#A855F7',
    rim: '#E9D5FF',
  },
};

export const CityEmblemBadge: React.FC<{
  cityId: CityId;
  material: MarkerMetalMaterial;
  size?: number;
  selected?: boolean;
  className?: string;
}> = ({ cityId, material, size = 44, selected = false, className = '' }) => {
  const palette = MATERIAL_PALETTES[material];
  const gradId = `metal-${cityId}-${size}`;
  const innerGradId = `inner-${cityId}-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={palette.outerStart} />
          <stop offset="48%" stopColor={palette.outerMid} />
          <stop offset="100%" stopColor={palette.outerEnd} />
        </linearGradient>
        <radialGradient id={innerGradId} cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor={palette.glow} stopOpacity="0.48" />
          <stop offset="100%" stopColor={palette.bgInner} stopOpacity="0.98" />
        </radialGradient>
      </defs>

      {/* Outer metallic shield circle & cardinal points matching screenshot */}
      <circle
        cx="32"
        cy="32"
        r="27"
        fill={`url(#${innerGradId})`}
        stroke={`url(#${gradId})`}
        strokeWidth={selected ? '3.8' : '3'}
      />
      <circle
        cx="32"
        cy="32"
        r="22.5"
        stroke={palette.rim}
        strokeOpacity="0.55"
        strokeWidth="1.1"
      />

      {/* Top & bottom metallic crown spikes */}
      <path
        d="M32 1.5L36.2 8.5H27.8L32 1.5ZM32 62.5L36.2 55.5H27.8L32 62.5ZM1.5 32L8.5 27.8V36.2L1.5 32ZM62.5 32L55.5 27.8V36.2L62.5 32Z"
        fill={`url(#${gradId})`}
      />

      {/* City-specific heraldic emblem inside */}
      {cityId === 'aetheria' && (
        <g>
          <path
            d="M32 12L37.5 24.5L50 27L39.5 35.5L42 48.5L32 41L22 48.5L24.5 35.5L14 27L26.5 24.5L32 12Z"
            fill={palette.glow}
            fillOpacity="0.45"
            stroke="#F0F9FF"
            strokeWidth="1.8"
          />
          <path d="M32 15V49M19 31H45" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="31" r="3.5" fill="#E0F2FE" />
        </g>
      )}

      {cityId === 'lunaris' && (
        <g>
          <path
            d="M37 15C27.5 16 21 24 22 33.5C23 41.5 30 47.5 39 46.5C32.5 50 23.5 48.5 18 42C12.5 35 13.5 24 20.5 17.5C25 13.5 31.5 13 37 15Z"
            fill="#22D3EE"
            fillOpacity="0.55"
            stroke="#ECFEFF"
            strokeWidth="1.8"
          />
          <path
            d="M39 19L41.8 26.2L49 29L41.8 31.8L39 39L36.2 31.8L29 29L36.2 26.2L39 19Z"
            fill="#CFFAFE"
          />
        </g>
      )}

      {cityId === 'velmora' && (
        <g>
          <path
            d="M32 13C23 20.5 19.5 31 24.5 42C27.5 47 32 50 32 50C32 50 36.5 47 39.5 42C44.5 31 41 20.5 32 13Z"
            fill="#10B981"
            fillOpacity="0.5"
            stroke="#ECFDF5"
            strokeWidth="1.8"
          />
          <path
            d="M32 18V49M32 29L24.5 23.5M32 35L39.5 28.5M32 40L25 35"
            stroke="#D1FAE5"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </g>
      )}

      {cityId === 'eldoria' && (
        <g>
          <path
            d="M18 43L16 24L25 30.5L32 16L39 30.5L48 24L46 43H18Z"
            fill="#F59E0B"
            fillOpacity="0.55"
            stroke="#FEF9C3"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path d="M19 46.5H45" stroke="#FDE68A" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="32" cy="14" r="2.6" fill="#FEF08A" />
        </g>
      )}

      {cityId === 'drakonia' && (
        <g>
          <path
            d="M32 12L43 25.5L37.5 29.5L46.5 42L32 51L17.5 42L26.5 29.5L21 25.5L32 12Z"
            fill="#EF4444"
            fillOpacity="0.5"
            stroke="#FEE2E2"
            strokeWidth="1.8"
          />
          <path d="M32 17V46M24 31L32 26L40 31" stroke="#FECACA" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="32" cy="34" r="3.2" fill="#FCA5A5" />
        </g>
      )}

      {cityId === 'nivara' && (
        <g>
          <circle
            cx="32"
            cy="32"
            r="9"
            fill="#F59E0B"
            fillOpacity="0.6"
            stroke="#FEF3C7"
            strokeWidth="1.9"
          />
          <path
            d="M32 12V19M32 45V52M12 32H19M45 32H52M18 18L23 23M41 41L46 46M46 18L41 23M23 41L18 46"
            stroke="#FDE68A"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}

      {cityId === 'astralis' && (
        <g>
          <polygon
            points="32,12 43,32 32,52 21,32"
            fill="#A855F7"
            fillOpacity="0.55"
            stroke="#F3E8FF"
            strokeWidth="1.8"
          />
          <polygon
            points="13,32 32,23 51,32 32,41"
            fill="#C084FC"
            fillOpacity="0.35"
            stroke="#E9D5FF"
            strokeWidth="1.5"
          />
          <circle cx="32" cy="32" r="3" fill="#FFFFFF" />
        </g>
      )}
    </svg>
  );
};

export const ClanEmblemIcon: React.FC<{
  variant: Clan['emblemVariant'];
  accentColor: string;
  size?: number;
  className?: string;
}> = ({ variant, accentColor, size = 44, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    {/* Shield base */}
    <path
      d="M32 5L54 13V30.5C54 44.8 44.5 54.6 32 59.5C19.5 54.6 10 44.8 10 30.5V13L32 5Z"
      fill="#0F172A"
      stroke={accentColor}
      strokeWidth="2.4"
    />
    <path
      d="M32 9.5L49.5 16V30C49.5 41.6 41.8 49.8 32 54C22.2 49.8 14.5 41.6 14.5 30V16L32 9.5Z"
      fill={accentColor}
      fillOpacity="0.16"
      stroke="#E2E8F0"
      strokeOpacity="0.35"
      strokeWidth="1.1"
    />
    {variant === 'star-shield' && (
      <path
        d="M32 16L36 27L47 31L36 35L32 46L28 35L17 31L28 27L32 16Z"
        fill={accentColor}
        stroke="#F8FAFC"
        strokeWidth="1.4"
      />
    )}
    {variant === 'crescent-blade' && (
      <path
        d="M36 18C28 19 23 26 24 34C25 40 30 45 38 44C32 47 24 45 20 39C16 33 17 24 23 19C27 16 32 16 36 18Z"
        fill={accentColor}
        stroke="#F8FAFC"
        strokeWidth="1.5"
      />
    )}
    {variant === 'emerald-bough' && (
      <path
        d="M32 16C24 23 22 32 26 41C29 45 32 47 32 47C32 47 35 45 38 41C42 32 40 23 32 16Z"
        fill={accentColor}
        stroke="#F8FAFC"
        strokeWidth="1.5"
      />
    )}
    {variant === 'imperial-crown' && (
      <path
        d="M20 41L18 25L26 31L32 19L38 31L46 25L44 41H20Z"
        fill={accentColor}
        stroke="#FEF9C3"
        strokeWidth="1.6"
      />
    )}
    {variant === 'dragon-fang' && (
      <path
        d="M32 15L42 27L37 31L44 42L32 49L20 42L27 31L22 27L32 15Z"
        fill={accentColor}
        stroke="#FEE2E2"
        strokeWidth="1.5"
      />
    )}
    {variant === 'solar-ankh' && (
      <g>
        <circle cx="32" cy="27" r="7" fill={accentColor} stroke="#FEF3C7" strokeWidth="1.6" />
        <path d="M32 34V47M25 39H39" stroke="#FEF3C7" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    )}
    {variant === 'astral-prism' && (
      <polygon
        points="32,15 42,31 32,47 22,31"
        fill={accentColor}
        stroke="#F3E8FF"
        strokeWidth="1.6"
      />
    )}
  </svg>
);

export const NavHomeFantasyIcon: React.FC<{ active?: boolean; size?: number }> = ({
  active = false,
  size = 24,
}) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path
      d="M4.5 13L14 4.5L23.5 13V23C23.5 23.6 23.1 24 22.5 24H16.8V17.2H11.2V24H5.5C4.9 24 4.5 23.6 4.5 23V13Z"
      fill={active ? 'rgba(56, 189, 248, 0.22)' : 'none'}
      stroke={active ? '#E0F2FE' : '#94A3B8'}
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

export const NavCharacterFantasyIcon: React.FC<{ active?: boolean; size?: number }> = ({
  active = false,
  size = 24,
}) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <circle
      cx="14"
      cy="9.5"
      r="4.2"
      fill={active ? 'rgba(56, 189, 248, 0.22)' : 'none'}
      stroke={active ? '#E0F2FE' : '#94A3B8'}
      strokeWidth="1.8"
    />
    <path
      d="M6 23.5C6 19.2 9.5 16.5 14 16.5C18.5 16.5 22 19.2 22 23.5"
      stroke={active ? '#E0F2FE' : '#94A3B8'}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const NavWorldCompassIcon: React.FC<{ active?: boolean; size?: number }> = ({
  active = false,
  size = 26,
}) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle
      cx="16"
      cy="16"
      r="10"
      stroke={active ? '#BAE6FD' : '#94A3B8'}
      strokeWidth="1.7"
      opacity={active ? 0.95 : 0.7}
    />
    <path
      d="M16 2.5L18.6 13.4L29.5 16L18.6 18.6L16 29.5L13.4 18.6L2.5 16L13.4 13.4L16 2.5Z"
      fill={active ? '#E0F2FE' : 'none'}
      stroke={active ? '#38BDF8' : '#94A3B8'}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <circle cx="16" cy="16" r="2.2" fill={active ? '#0284C7' : '#94A3B8'} />
  </svg>
);

export const NavClanCrestIcon: React.FC<{ active?: boolean; size?: number }> = ({
  active = false,
  size = 24,
}) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path
      d="M14 3.5L22.5 7V14C22.5 19.5 18.8 23.4 14 25C9.2 23.4 5.5 19.5 5.5 14V7L14 3.5Z"
      fill={active ? 'rgba(56, 189, 248, 0.22)' : 'none'}
      stroke={active ? '#E0F2FE' : '#94A3B8'}
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M14 7.5V20.5M9.5 13H18.5M10.5 9.5L17.5 16.5M17.5 9.5L10.5 16.5"
      stroke={active ? '#BAE6FD' : '#64748B'}
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
);

export const NavMoreGridIcon: React.FC<{ active?: boolean; size?: number }> = ({
  active = false,
  size = 24,
}) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect
      x="5"
      y="5"
      width="7"
      height="7"
      rx="1.6"
      fill={active ? 'rgba(56, 189, 248, 0.22)' : 'none'}
      stroke={active ? '#E0F2FE' : '#94A3B8'}
      strokeWidth="1.8"
    />
    <rect
      x="16"
      y="5"
      width="7"
      height="7"
      rx="1.6"
      fill={active ? 'rgba(56, 189, 248, 0.22)' : 'none'}
      stroke={active ? '#E0F2FE' : '#94A3B8'}
      strokeWidth="1.8"
    />
    <rect
      x="5"
      y="16"
      width="7"
      height="7"
      rx="1.6"
      fill={active ? 'rgba(56, 189, 248, 0.22)' : 'none'}
      stroke={active ? '#E0F2FE' : '#94A3B8'}
      strokeWidth="1.8"
    />
    <rect
      x="16"
      y="16"
      width="7"
      height="7"
      rx="1.6"
      fill={active ? 'rgba(56, 189, 248, 0.22)' : 'none'}
      stroke={active ? '#E0F2FE' : '#94A3B8'}
      strokeWidth="1.8"
    />
  </svg>
);
