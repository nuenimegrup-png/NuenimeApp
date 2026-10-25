import React from 'react';

/**
 * WorldMagicalEffectsLayer merender efek atmosfer fantasi (cahaya lembut, partikel berkilau,
 * cincin sihir, riak air, dan distorsi cahaya) yang terikat langsung pada sistem koordinat dunia
 * dari ilustrasi peta utama (/assets/aistudio/image_e062b5a4.png, 1000 x 1500 unit, rasio 2:3).
 */

interface MagicalParticleSpec {
  id: string;
  cx: number;
  cy: number;
  r: number;
  color: string;
  delay: string;
  duration: string;
  type: 'rise' | 'twinkle';
}

const WORLD_PARTICLES: MagicalParticleSpec[] = [
  // 1. Aetheria — Ice & Celestial Light Motes (around cx: 225, cy: 260)
  { id: 'aeth-p1', cx: 190, cy: 265, r: 2.5, color: '#E0F2FE', delay: '0s', duration: '4.2s', type: 'rise' },
  { id: 'aeth-p2', cx: 225, cy: 225, r: 3.2, color: '#7DD3FC', delay: '1.1s', duration: '4.8s', type: 'twinkle' },
  { id: 'aeth-p3', cx: 260, cy: 272, r: 2.4, color: '#BAE6FD', delay: '2.0s', duration: '3.9s', type: 'rise' },
  { id: 'aeth-p4', cx: 210, cy: 290, r: 2.2, color: '#FFFFFF', delay: '0.6s', duration: '4.5s', type: 'rise' },
  { id: 'aeth-p5', cx: 245, cy: 245, r: 2.8, color: '#38BDF8', delay: '2.7s', duration: '3.6s', type: 'twinkle' },

  // 2. Lunaris — Cyan Tidal & Lunar Sparkles (around cx: 565, cy: 465)
  { id: 'lun-p1', cx: 530, cy: 460, r: 2.4, color: '#CFFAFE', delay: '0.3s', duration: '4.3s', type: 'rise' },
  { id: 'lun-p2', cx: 565, cy: 430, r: 3.0, color: '#67E8F9', delay: '1.5s', duration: '3.5s', type: 'twinkle' },
  { id: 'lun-p3', cx: 602, cy: 472, r: 2.3, color: '#22D3EE', delay: '2.4s', duration: '4.6s', type: 'rise' },
  { id: 'lun-p4', cx: 548, cy: 488, r: 2.6, color: '#ECFEFF', delay: '0.9s', duration: '3.8s', type: 'twinkle' },

  // 3. Velmora — Emerald Forest Spores & Life Wisps (around cx: 180, cy: 550)
  { id: 'vel-p1', cx: 145, cy: 558, r: 2.6, color: '#A7F3D0', delay: '0.2s', duration: '4.7s', type: 'rise' },
  { id: 'vel-p2', cx: 180, cy: 515, r: 3.0, color: '#34D399', delay: '1.4s', duration: '4.1s', type: 'rise' },
  { id: 'vel-p3', cx: 215, cy: 552, r: 2.5, color: '#6EE7B7', delay: '2.3s', duration: '3.9s', type: 'twinkle' },
  { id: 'vel-p4', cx: 162, cy: 575, r: 2.3, color: '#FEF08A', delay: '0.8s', duration: '4.5s', type: 'rise' },
  { id: 'vel-p5', cx: 198, cy: 535, r: 2.2, color: '#D1FAE5', delay: '3.1s', duration: '4.0s', type: 'rise' },

  // 4. Eldoria — Imperial Sovereign Golden Motes (around cx: 488, cy: 718)
  { id: 'eld-p1', cx: 448, cy: 712, r: 2.6, color: '#FEF08A', delay: '0.1s', duration: '4.0s', type: 'rise' },
  { id: 'eld-p2', cx: 488, cy: 678, r: 3.4, color: '#FBBF24', delay: '1.2s', duration: '3.4s', type: 'twinkle' },
  { id: 'eld-p3', cx: 528, cy: 722, r: 2.5, color: '#FDE68A', delay: '2.1s', duration: '4.4s', type: 'rise' },
  { id: 'eld-p4', cx: 468, cy: 745, r: 2.4, color: '#FFFBEB', delay: '0.7s', duration: '3.8s', type: 'rise' },
  { id: 'eld-p5', cx: 512, cy: 698, r: 2.9, color: '#F59E0B', delay: '2.8s', duration: '3.7s', type: 'twinkle' },

  // 5. Drakonia & Eastern Void Storm (around cx: 835, cy: 620 & cx: 945, cy: 795)
  { id: 'drk-p1', cx: 802, cy: 625, r: 2.5, color: '#FCA5A5', delay: '0.4s', duration: '3.5s', type: 'rise' },
  { id: 'drk-p2', cx: 838, cy: 590, r: 2.9, color: '#F87171', delay: '1.6s', duration: '3.8s', type: 'rise' },
  { id: 'drk-p3', cx: 870, cy: 635, r: 2.4, color: '#FDBA74', delay: '2.5s', duration: '3.3s', type: 'rise' },
  { id: 'drk-p4', cx: 920, cy: 775, r: 3.0, color: '#D8B4FE', delay: '0.9s', duration: '3.6s', type: 'twinkle' },
  { id: 'drk-p5', cx: 952, cy: 812, r: 2.6, color: '#C084FC', delay: '1.9s', duration: '4.1s', type: 'twinkle' },

  // 6. Nivara — Solar Mirage & Golden Sand Sparkles (around cx: 268, cy: 952)
  { id: 'niv-p1', cx: 230, cy: 958, r: 2.4, color: '#FDE68A', delay: '0.5s', duration: '4.6s', type: 'rise' },
  { id: 'niv-p2', cx: 268, cy: 922, r: 2.9, color: '#FBBF24', delay: '1.7s', duration: '3.7s', type: 'twinkle' },
  { id: 'niv-p3', cx: 305, cy: 965, r: 2.3, color: '#FEF3C7', delay: '2.6s', duration: '4.3s', type: 'rise' },

  // 7. Astralis — Cosmic Prism & Falling Starlight Particles (around cx: 635, cy: 1075)
  { id: 'ast-p1', cx: 595, cy: 1075, r: 2.6, color: '#F3E8FF', delay: '0.2s', duration: '4.1s', type: 'rise' },
  { id: 'ast-p2', cx: 635, cy: 1035, r: 3.3, color: '#D8B4FE', delay: '1.3s', duration: '3.3s', type: 'twinkle' },
  { id: 'ast-p3', cx: 675, cy: 1085, r: 2.5, color: '#C084FC', delay: '2.2s', duration: '4.5s', type: 'rise' },
  { id: 'ast-p4', cx: 615, cy: 1105, r: 2.4, color: '#E879F9', delay: '0.8s', duration: '3.9s', type: 'twinkle' },
  { id: 'ast-p5', cx: 655, cy: 1055, r: 2.8, color: '#FFFFFF', delay: '2.9s', duration: '3.5s', type: 'twinkle' },
];

export const WorldMagicalEffectsLayer: React.FC = () => {
  return (
    <div
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
      aria-hidden="true"
    >
      <svg viewBox="0 0 1000 1500" className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <radialGradient id="glowAetheria" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.44" />
            <stop offset="55%" stopColor="#38BDF8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="glowLunaris" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#A5F3FC" stopOpacity="0.42" />
            <stop offset="55%" stopColor="#22D3EE" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#0891B2" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="glowVelmora" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.4" />
            <stop offset="55%" stopColor="#10B981" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="glowEldoria" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.48" />
            <stop offset="52%" stopColor="#F59E0B" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#B45309" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="glowDrakonia" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FCA5A5" stopOpacity="0.38" />
            <stop offset="55%" stopColor="#EF4444" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#7F1D1D" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="glowVoidVortex" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E9D5FF" stopOpacity="0.48" />
            <stop offset="48%" stopColor="#9333EA" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#3B0764" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="glowNivara" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.4" />
            <stop offset="55%" stopColor="#D97706" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#78350F" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="glowAstralis" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F3E8FF" stopOpacity="0.46" />
            <stop offset="52%" stopColor="#A855F7" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#4C1D95" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 1. AETHERIA (cx: 225, cy: 260) */}
        <g>
          <circle cx="225" cy="260" r="95" fill="url(#glowAetheria)" className="animate-magic-breathe" />
          <ellipse
            cx="225"
            cy="240"
            rx="68"
            ry="26"
            fill="none"
            stroke="#BAE6FD"
            strokeWidth="1.6"
            strokeOpacity="0.55"
            strokeDasharray="16 8 5 8"
            className="animate-mirage-sway"
          />
          <circle
            cx="225"
            cy="260"
            r="52"
            fill="none"
            stroke="#E0F2FE"
            strokeWidth="1.2"
            strokeOpacity="0.45"
            strokeDasharray="5 8"
            className="animate-magic-orbit"
          />
        </g>

        {/* 2. LUNARIS (cx: 565, cy: 465) */}
        <g>
          <circle
            cx="565"
            cy="465"
            r="90"
            fill="url(#glowLunaris)"
            className="animate-magic-breathe"
            style={{ animationDelay: '0.8s' }}
          />
          <ellipse
            cx="565"
            cy="472"
            rx="68"
            ry="38"
            fill="none"
            stroke="#67E8F9"
            strokeWidth="1.6"
            strokeOpacity="0.55"
            className="animate-tidal-ripple"
          />
          <ellipse
            cx="565"
            cy="472"
            rx="68"
            ry="38"
            fill="none"
            stroke="#CFFAFE"
            strokeWidth="1.3"
            strokeOpacity="0.45"
            className="animate-tidal-ripple"
            style={{ animationDelay: '2.6s' }}
          />
        </g>

        {/* 3. VELMORA (cx: 180, cy: 550) */}
        <g>
          <circle
            cx="180"
            cy="550"
            r="88"
            fill="url(#glowVelmora)"
            className="animate-magic-breathe"
            style={{ animationDelay: '1.4s' }}
          />
          <ellipse
            cx="180"
            cy="550"
            rx="58"
            ry="38"
            fill="none"
            stroke="#6EE7B7"
            strokeWidth="1.5"
            strokeOpacity="0.5"
            strokeDasharray="14 8"
            className="animate-mirage-sway"
          />
        </g>

        {/* 4. ELDORIA (cx: 488, cy: 718) */}
        <g>
          <circle
            cx="488"
            cy="718"
            r="110"
            fill="url(#glowEldoria)"
            className="animate-magic-breathe"
            style={{ animationDelay: '0.4s' }}
          />
          <circle
            cx="488"
            cy="718"
            r="68"
            fill="none"
            stroke="#FEF08A"
            strokeWidth="1.8"
            strokeOpacity="0.6"
            strokeDasharray="14 6 4 6"
            className="animate-magic-orbit"
          />
          <circle
            cx="488"
            cy="718"
            r="48"
            fill="none"
            stroke="#FBBF24"
            strokeWidth="1.4"
            strokeOpacity="0.48"
            strokeDasharray="6 10"
            className="animate-magic-orbit-reverse"
          />
        </g>

        {/* 5. DRAKONIA (cx: 835, cy: 620) & EASTERN VOID VORTEX (cx: 945, cy: 795) */}
        <g>
          <circle
            cx="835"
            cy="620"
            r="85"
            fill="url(#glowDrakonia)"
            className="animate-magic-breathe"
            style={{ animationDelay: '1.9s' }}
          />
          <circle
            cx="945"
            cy="795"
            r="92"
            fill="url(#glowVoidVortex)"
            className="animate-magic-breathe"
          />
          <circle
            cx="945"
            cy="795"
            r="48"
            fill="none"
            stroke="#D8B4FE"
            strokeWidth="1.8"
            strokeOpacity="0.6"
            strokeDasharray="14 8 4 8"
            className="animate-magic-orbit-reverse"
          />
          <path
            d="M865 650 L895 700 L882 720 L928 772"
            fill="none"
            stroke="#E9D5FF"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="animate-lightning-flicker"
          />
        </g>

        {/* 6. NIVARA (cx: 268, cy: 952) */}
        <g>
          <circle
            cx="268"
            cy="952"
            r="88"
            fill="url(#glowNivara)"
            className="animate-magic-breathe"
            style={{ animationDelay: '2.1s' }}
          />
          <path
            d="M210 950 Q 238 940 268 950 T 325 950"
            fill="none"
            stroke="#FDE68A"
            strokeWidth="1.5"
            strokeOpacity="0.48"
            className="animate-mirage-sway"
          />
        </g>

        {/* 7. ASTRALIS (cx: 635, cy: 1075) */}
        <g>
          <circle
            cx="635"
            cy="1075"
            r="98"
            fill="url(#glowAstralis)"
            className="animate-magic-breathe"
            style={{ animationDelay: '1.1s' }}
          />
          <circle
            cx="635"
            cy="1075"
            r="56"
            fill="none"
            stroke="#D8B4FE"
            strokeWidth="1.5"
            strokeOpacity="0.52"
            strokeDasharray="6 8"
            className="animate-magic-orbit-reverse"
          />
        </g>

        {/* SHIMMERING & RISING ELEMENTAL PARTICLES */}
        {WORLD_PARTICLES.map((p) =>
          p.type === 'twinkle' ? (
            <g
              key={p.id}
              className="animate-shimmer-twinkle"
              style={{
                animationDelay: p.delay,
                animationDuration: p.duration,
              }}
            >
              <path
                d={`M ${p.cx} ${p.cy - p.r * 2.2} L ${p.cx + p.r * 0.6} ${p.cy - p.r * 0.6} L ${
                  p.cx + p.r * 2.2
                } ${p.cy} L ${p.cx + p.r * 0.6} ${p.cy + p.r * 0.6} L ${p.cx} ${
                  p.cy + p.r * 2.2
                } L ${p.cx - p.r * 0.6} ${p.cy + p.r * 0.6} L ${p.cx - p.r * 2.2} ${p.cy} L ${
                  p.cx - p.r * 0.6
                } ${p.cy - p.r * 0.6} Z`}
                fill={p.color}
              />
              <circle cx={p.cx} cy={p.cy} r={p.r * 0.75} fill="#FFFFFF" />
            </g>
          ) : (
            <circle
              key={p.id}
              cx={p.cx}
              cy={p.cy}
              r={p.r}
              fill={p.color}
              className="animate-particle-rise"
              style={{
                animationDelay: p.delay,
                animationDuration: p.duration,
              }}
            />
          )
        )}
      </svg>
    </div>
  );
};
