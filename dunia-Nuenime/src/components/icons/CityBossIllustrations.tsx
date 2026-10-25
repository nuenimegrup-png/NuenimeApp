import React from 'react';
import { CityId } from '../../types/nuenime';

interface CityBossIllustrationProps {
  cityId: CityId;
  size?: number;
  className?: string;
}

/**
 * Tujuh ilustrasi monster bos unik dengan background transparan yang disesuaikan
 * dengan karakter geografis masing-masing kota di Dunia Nuenime:
 * 1. Aetheria : Guardian Seraph (Monster Penjaga Bercahaya Bersayap Enam)
 * 2. Lunaris  : Moonfang (Serigala Pasang Rembulan Perak-Cyan)
 * 3. Velmora  : Verdant Colossus (Raksasa Penjaga Hutan Zamrud)
 * 4. Eldoria  : Aureon (Singa Bersayap Mahkota Emas & Cahaya)
 * 5. Drakonia : Infernal Wyrm (Naga Api & Lava Kaldera)
 * 6. Nivara   : Frostmaw (Behemoth Kristal Es & Badai)
 * 7. Astralis : Astral Leviathan (Leviathan Naga Kosmik Bintang)
 */
export const CityBossIllustration: React.FC<CityBossIllustrationProps> = ({
  cityId,
  size = 56,
  className = '',
}) => {
  switch (cityId) {
    case 'aetheria':
      // Guardian Seraph — Six-winged celestial construct with glowing halo & crystal spear
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 80 80"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="seraphAura" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="40" cy="40" r="36" fill="url(#seraphAura)" />
          {/* Celestial Halo Ring */}
          <circle
            cx="40"
            cy="22"
            r="12"
            stroke="#FEF08A"
            strokeWidth="2.2"
            strokeDasharray="6 3"
          />
          {/* Six Radiant Wings */}
          <path
            d="M36 34L8 16L14 32L34 40Z"
            fill="#BAE6FD"
            stroke="#E0F2FE"
            strokeWidth="1.4"
          />
          <path
            d="M44 34L72 16L66 32L46 40Z"
            fill="#BAE6FD"
            stroke="#E0F2FE"
            strokeWidth="1.4"
          />
          <path
            d="M35 42L6 38L16 50L35 47Z"
            fill="#38BDF8"
            stroke="#E0F2FE"
            strokeWidth="1.2"
          />
          <path
            d="M45 42L74 38L64 50L45 47Z"
            fill="#38BDF8"
            stroke="#E0F2FE"
            strokeWidth="1.2"
          />
          <path
            d="M36 48L18 66L28 62L38 52Z"
            fill="#0284C7"
            stroke="#BAE6FD"
            strokeWidth="1.2"
          />
          <path
            d="M44 48L62 66L52 62L42 52Z"
            fill="#0284C7"
            stroke="#BAE6FD"
            strokeWidth="1.2"
          />
          {/* Armored Seraph Core & Helm */}
          <path
            d="M40 16L47 28L44 56L40 68L36 56L33 28L40 16Z"
            fill="#0F172A"
            stroke="#FEF08A"
            strokeWidth="1.8"
          />
          <circle cx="40" cy="28" r="4.5" fill="#FEF08A" />
          <path d="M40 8V72" stroke="#E0F2FE" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case 'lunaris':
      // Moonfang — Spectral Lunar Fenrir Wolf wreathed in crescent tidal energy
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 80 80"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="moonfangAura" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#A5F3FC" stopOpacity="0.8" />
              <stop offset="65%" stopColor="#06B6D4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#083344" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="40" cy="40" r="36" fill="url(#moonfangAura)" />
          {/* Crescent Moon Backdrop */}
          <path
            d="M52 14C37 14 25 26 25 41C25 56 37 68 52 68C43 63 38 53 38 41C38 29 43 19 52 14Z"
            fill="#22D3EE"
            fillOpacity="0.45"
            stroke="#CFFAFE"
            strokeWidth="1.4"
          />
          {/* Wolf Ears & Fierce Head Silhouette */}
          <path
            d="M22 14L31 28L39 24L48 28L58 14L55 34L65 44L52 54L40 66L28 54L15 44L25 34L22 14Z"
            fill="#082F49"
            stroke="#67E8F9"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Glowing Cyan Eyes & Fangs */}
          <path d="M29 38L36 41L31 44Z" fill="#FEF08A" />
          <path d="M51 38L44 41L49 44Z" fill="#FEF08A" />
          <path d="M35 54L38 61L40 56L42 61L45 54" stroke="#ECFEFF" strokeWidth="1.8" />
          <circle cx="40" cy="31" r="3" fill="#22D3EE" />
        </svg>
      );

    case 'velmora':
      // Verdant Colossus — Ancient Root & Emerald Crystal Forest Behemoth
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 80 80"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="verdantAura" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.8" />
              <stop offset="65%" stopColor="#10B981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#064E3B" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="40" cy="40" r="36" fill="url(#verdantAura)" />
          {/* Antler Crown Branches */}
          <path
            d="M26 26L14 14M18 18L12 22M22 22L24 12M54 26L66 14M62 18L68 22M58 22L56 12"
            stroke="#6EE7B7"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Hulking Golem Shoulders & Torso */}
          <path
            d="M16 36L28 24H52L64 36L58 60L40 68L22 60L16 36Z"
            fill="#064E3B"
            stroke="#34D399"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Glowing Emerald Life Core & Eyes */}
          <polygon
            points="40,36 47,46 40,58 33,46"
            fill="#34D399"
            stroke="#D1FAE5"
            strokeWidth="1.4"
          />
          <circle cx="32" cy="32" r="2.8" fill="#FEF08A" />
          <circle cx="48" cy="32" r="2.8" fill="#FEF08A" />
        </svg>
      );

    case 'eldoria':
      // Aureon — Solar Crowned Golden Lion-Griffin Chimera
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 80 80"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="aureonAura" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.85" />
              <stop offset="62%" stopColor="#F59E0B" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#78350F" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="40" cy="40" r="36" fill="url(#aureonAura)" />
          {/* Radiant Sunburst Mane & Wings */}
          <path
            d="M40 10L46 22L58 14L54 28L68 26L58 38L70 46L56 50L60 62L46 56L40 68L34 56L20 62L24 50L10 46L22 38L12 26L26 28L22 14L34 22L40 10Z"
            fill="#78350F"
            stroke="#FBBF24"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Inner Golden Lion Crest */}
          <circle
            cx="40"
            cy="40"
            r="15"
            fill="#451A03"
            stroke="#FEF08A"
            strokeWidth="1.8"
          />
          <circle cx="34" cy="37" r="2.6" fill="#FEF08A" />
          <circle cx="46" cy="37" r="2.6" fill="#FEF08A" />
          <path d="M35 46L40 43L45 46" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'drakonia':
      // Infernal Wyrm — Horned Obsidian Lava Dragon
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 80 80"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="wyrmAura" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FCA5A5" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#EF4444" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#450A0A" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="40" cy="40" r="36" fill="url(#wyrmAura)" />
          {/* Dragon Bat-Wings */}
          <path
            d="M34 38L8 20L12 42L22 40L26 52L35 46Z"
            fill="#450A0A"
            stroke="#F87171"
            strokeWidth="1.6"
          />
          <path
            d="M46 38L72 20L68 42L58 40L54 52L45 46Z"
            fill="#450A0A"
            stroke="#F87171"
            strokeWidth="1.6"
          />
          {/* Horned Dragon Skull & Magma Jaw */}
          <path
            d="M26 12L34 26L40 22L46 26L54 12L52 32L58 44L46 64L40 70L34 64L22 44L28 32L26 12Z"
            fill="#18181B"
            stroke="#FB923C"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          {/* Glowing Magma Eyes & Breath Core */}
          <path d="M31 36L37 39L32 42Z" fill="#FEF08A" />
          <path d="M49 36L43 39L48 42Z" fill="#FEF08A" />
          <polygon points="40,47 45,56 40,63 35,56" fill="#EF4444" />
        </svg>
      );

    case 'nivara':
      // Frostmaw — Crystalline Glacial-Sand Leviathan Maw
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 80 80"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="frostmawAura" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#F59E0B" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0C4A6E" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="40" cy="40" r="36" fill="url(#frostmawAura)" />
          {/* Jagged Ice-Quartz Dorsal Spikes */}
          <polygon
            points="40,10 50,24 66,18 58,36 70,48 54,56 40,70 26,56 10,48 22,36 14,18 30,24"
            fill="#0C4A6E"
            stroke="#7DD3FC"
            strokeWidth="1.8"
          />
          {/* Inner Armored Maw & Fangs */}
          <circle cx="40" cy="42" r="14" fill="#082F49" stroke="#FDE68A" strokeWidth="1.8" />
          <path
            d="M31 38L34 45L37 38L40 46L43 38L46 45L49 38"
            stroke="#E0F2FE"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="31" r="2.6" fill="#FBBF24" />
          <circle cx="48" cy="31" r="2.6" fill="#FBBF24" />
        </svg>
      );

    case 'astralis':
    default:
      // Astral Leviathan — Cosmic Nebula Serpent with Floating Star Prism
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 80 80"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="leviathanAura" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F3E8FF" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#A855F7" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#3B0764" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="40" cy="40" r="36" fill="url(#leviathanAura)" />
          {/* Cosmic Orbit Ring */}
          <ellipse
            cx="40"
            cy="40"
            rx="31"
            ry="14"
            transform="rotate(-28 40 40)"
            stroke="#E9D5FF"
            strokeWidth="1.6"
            strokeDasharray="6 4"
          />
          {/* Coiled Leviathan Crest & Fins */}
          <path
            d="M40 12L54 24L64 20L56 38L66 52L48 56L40 68L32 56L14 52L24 38L16 20L26 24L40 12Z"
            fill="#2E1065"
            stroke="#C084FC"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Star Core */}
          <polygon
            points="40,26 44,36 54,40 44,44 40,54 36,44 26,40 36,36"
            fill="#F3E8FF"
          />
          <circle cx="33" cy="29" r="2.2" fill="#FEF08A" />
          <circle cx="47" cy="29" r="2.2" fill="#FEF08A" />
        </svg>
      );
  }
};
