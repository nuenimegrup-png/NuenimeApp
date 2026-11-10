import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { hapticLight } from '@/lib/haptics';
import { clanProfileCache } from '@/lib/global-chat-service';

export interface ProfileCityPlaqueProps {
  userId?: string | null;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  inlineClan?: boolean;
  hideIfNoClan?: boolean;
  hideNoClanBadge?: boolean;
  onPress?: (() => void) | null;
}

interface CityTheme {
  name: string;
  accent: string;
  secondary: string;
  material: string;
}

export const WANDERER_THEME: CityTheme = {
  name: 'GELANDANGAN',
  accent: '#94A3B8',
  secondary: '#CBD5E1',
  material: 'iron',
};

const CITY_THEMES: Record<string, CityTheme> = {
  aetheria: { name: 'AETHERIA', accent: '#38BDF8', secondary: '#E0F2FE', material: 'diamond' },
  lunaris: { name: 'LUNARIS', accent: '#22D3EE', secondary: '#CFFAFE', material: 'silver' },
  velmora: { name: 'VELMORA', accent: '#10B981', secondary: '#D1FAE5', material: 'emerald' },
  eldoria: { name: 'ELDORIA', accent: '#F59E0B', secondary: '#FEF3C7', material: 'gold' },
  drakonia: { name: 'DRAKONIA', accent: '#EF4444', secondary: '#FEE2E2', material: 'ruby' },
  nivara: { name: 'NIVARA', accent: '#F59E0B', secondary: '#FEF08A', material: 'solar' },
  astralis: { name: 'ASTRALIS', accent: '#A855F7', secondary: '#F3E8FF', material: 'amethyst' },
};

/**
 * City Emblem SVG Icon for React Native
 */
const CityEmblemSvg: React.FC<{ cityId: string; size?: number; accent: string }> = React.memo(({
  cityId,
  size = 38,
  accent,
}) => {
  const normId = cityId.toLowerCase();

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <SvgGradient id="shieldGrad" x1="6" y1="4" x2="58" y2="60">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="50%" stopColor="#CBD5E1" />
          <Stop offset="100%" stopColor="#64748B" />
        </SvgGradient>
      </Defs>

      {/* Outer metallic shield circle */}
      <Circle cx="32" cy="32" r="27" fill="#060C18" stroke="url(#shieldGrad)" strokeWidth="3" />
      <Circle cx="32" cy="32" r="23" stroke={accent} strokeOpacity="0.75" strokeWidth="1.2" />

      {/* 4 Cardinal metallic points / crown spikes */}
      <Path d="M32 1.5L36 8H28L32 1.5ZM32 62.5L36 56H28L32 62.5ZM1.5 32L8 28V36L1.5 32ZM62.5 32L56 28V36L62.5 32Z" fill="url(#shieldGrad)" />

      {/* Emblem Symbol Inside */}
      {normId === 'gelandangan' ? (
        <>
          {/* Wanderer / Vagabond / Nomad: Crossed Explorer Staffs & Wind Rose */}
          <Defs>
            <SvgGradient id="wandererGrad" x1="10" y1="10" x2="54" y2="54">
              <Stop offset="0%" stopColor="#E2E8F0" />
              <Stop offset="50%" stopColor="#94A3B8" />
              <Stop offset="100%" stopColor="#475569" />
            </SvgGradient>
          </Defs>
          {/* Crossed traveler walking staff & explorer blade */}
          <Path
            d="M18 46L46 18M46 18L43 14L39 18M18 46L21 50L25 46"
            stroke="#94A3B8"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <Path
            d="M46 46L18 18M18 18L14 21L18 25M46 46L50 43L46 39"
            stroke="#64748B"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Center 4-Point Explorer Wind Rose / Wanderer Compass Star */}
          <Path
            d="M32 15L35.5 28.5L49 32L35.5 35.5L32 49L28.5 35.5L15 32L28.5 28.5L32 15Z"
            fill="url(#wandererGrad)"
            stroke="#F1F5F9"
            strokeWidth="1.6"
          />
          <Circle cx="32" cy="32" r="4.2" fill="#0B132B" stroke="#E2E8F0" strokeWidth="1.5" />
          <Circle cx="32" cy="32" r="1.8" fill="#38BDF8" />
        </>
      ) : normId === 'aetheria' || !CITY_THEMES[normId] ? (
        <>
          <Path
            d="M32 12L37.5 24.5L50 27L39.5 35.5L42 48.5L32 41L22 48.5L24.5 35.5L14 27L26.5 24.5L32 12Z"
            fill={accent}
            fillOpacity="0.4"
            stroke="#F0F9FF"
            strokeWidth="1.8"
          />
          <Path d="M32 15V49M19 31H45" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          <Circle cx="32" cy="31" r="3.2" fill="#E0F2FE" />
        </>
      ) : normId === 'lunaris' ? (
        <>
          <Path
            d="M37 15C27.5 16 21 24 22 33.5C23 41.5 30 47.5 39 46.5C32.5 50 23.5 48.5 18 42C12.5 35 13.5 24 20.5 17.5C25 13.5 31.5 13 37 15Z"
            fill={accent}
            fillOpacity="0.5"
            stroke="#ECFEFF"
            strokeWidth="1.8"
          />
          <Circle cx="39" cy="29" r="3" fill="#CFFAFE" />
        </>
      ) : normId === 'velmora' ? (
        <>
          <Path
            d="M32 13C23 20.5 19.5 31 24.5 42C27.5 47 32 50 32 50C32 50 36.5 47 39.5 42C44.5 31 41 20.5 32 13Z"
            fill={accent}
            fillOpacity="0.5"
            stroke="#ECFDF5"
            strokeWidth="1.8"
          />
          <Path d="M32 18V49" stroke="#D1FAE5" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : normId === 'eldoria' ? (
        <>
          <Path
            d="M18 43L16 24L25 30.5L32 16L39 30.5L48 24L46 43H18Z"
            fill={accent}
            fillOpacity="0.5"
            stroke="#FEF9C3"
            strokeWidth="1.8"
          />
          <Circle cx="32" cy="14" r="2.5" fill="#FEF08A" />
        </>
      ) : normId === 'drakonia' ? (
        <>
          <Path
            d="M32 12L43 25.5L37.5 29.5L46.5 42L32 51L17.5 42L26.5 29.5L21 25.5L32 12Z"
            fill={accent}
            fillOpacity="0.5"
            stroke="#FEE2E2"
            strokeWidth="1.8"
          />
          <Circle cx="32" cy="34" r="3" fill="#FCA5A5" />
        </>
      ) : normId === 'nivara' ? (
        <>
          <Circle cx="32" cy="32" r="9" fill={accent} fillOpacity="0.5" stroke="#FEF3C7" strokeWidth="1.8" />
          <Path d="M32 13V19M32 45V51M13 32H19M45 32H51" stroke="#FDE68A" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx="32" cy="32" r="10" fill={accent} fillOpacity="0.4" stroke="#F3E8FF" strokeWidth="1.8" />
          <Path d="M32 14L37 27L50 32L37 37L32 50L27 37L14 32L27 27L32 14Z" fill="#FFFFFF" fillOpacity="0.75" />
        </>
      )}
    </Svg>
  );
});

export const ProfileCityPlaque: React.FC<ProfileCityPlaqueProps> = React.memo(({
  userId,
  style,
  compact = false,
  inlineClan = false,
  hideIfNoClan = false,
  hideNoClanBadge = false,
  onPress,
}) => {
  // Gunakan data sinkron jika telah di-cache/batch oleh global-chat-service
  const cachedInitialData = userId && clanProfileCache.has(userId) ? clanProfileCache.get(userId) : undefined;

  // Query keanggotaan klan user dari Supabase
  const { data: clanData } = useQuery({
    queryKey: ['user-clan-profile-banner', userId],
    queryFn: async () => {
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: authData } = await supabase.auth.getUser();
        targetUserId = authData.user?.id || null;
      }
      if (!targetUserId) return null;

      // Cek memori cache global terlebih dahulu untuk hindari query redundan
      if (clanProfileCache.has(targetUserId)) {
        return clanProfileCache.get(targetUserId);
      }

      try {
        // 1. Cek dari keanggotaan klan aktif (rpg_clan_members WHERE status = 'active')
        const { data: memberData } = await supabase
          .from('rpg_clan_members')
          .select(`
            role,
            contribution_score,
            status,
            rpg_clans (
              id,
              name,
              tag,
              city_id,
              logo_url,
              level,
              total_exp,
              status
            )
          `)
          .eq('user_id', targetUserId)
          .eq('status', 'active')
          .maybeSingle();

        const rawClan = (memberData as any)?.rpg_clans;
        const joinedClan = Array.isArray(rawClan) ? rawClan[0] : rawClan;

        if (joinedClan && joinedClan.status !== 'disbanded') {
          const res = {
            clan: joinedClan,
            role: memberData?.role,
          };
          clanProfileCache.set(targetUserId, res);
          return res;
        }

        // 2. Fallback: Cek apakah user adalah pembuat/pemimpin klan langsung di rpg_clans yang belum dibubarkan
        const { data: leaderClan } = await supabase
          .from('rpg_clans')
          .select('id, name, tag, city_id, logo_url, level, total_exp, status')
          .eq('leader_id', targetUserId)
          .neq('status', 'disbanded')
          .maybeSingle();

        if (leaderClan) {
          const res = {
            clan: leaderClan,
            role: 'Pemimpin Klan',
          };
          clanProfileCache.set(targetUserId, res);
          return res;
        }

        clanProfileCache.set(targetUserId, null);
        return null;
      } catch (err) {
        console.warn('Error fetching user clan for plaque:', err);
        return null;
      }
    },
    initialData: cachedInitialData,
    staleTime: 1000 * 60 * 30, // 30 menit in-memory TanStack cache
    gcTime: 1000 * 60 * 60, // 60 menit
  });

  const clanInfo = clanData?.clan;
  const isJoinedClan = !!clanInfo;

  // Jika hideIfNoClan diaktifkan dan pengguna belum memiliki klan, sembunyikan sepenuhnya
  if (hideIfNoClan && !isJoinedClan) {
    return null;
  }

  // Jika belum gabung klan: Plakat menampilkan "GELANDANGAN" dengan logo pengelana/wanderer
  // Jika sudah gabung klan: Otomatis menyesuaikan dengan kota dan klan tempat bernaung
  const cityId = isJoinedClan
    ? (clanInfo.city_id || 'aetheria').toLowerCase()
    : 'gelandangan';

  const theme = isJoinedClan
    ? (CITY_THEMES[cityId] || CITY_THEMES.aetheria)
    : WANDERER_THEME;

  const cityName = theme.name;
  const clanTag = clanInfo?.tag ? clanInfo.tag.toUpperCase() : null;
  const clanName = clanInfo?.name || null;
  const cityLevel = isJoinedClan ? (clanInfo?.level || 1) : 0;
  const accentColor = theme.accent;

  const handlePress = () => {
    if (onPress === null) return;
    if (typeof onPress === 'function') {
      onPress();
      return;
    }
    hapticLight();
    router.push({
      pathname: '/dunia',
      params: { tab: 'klan' },
    } as never);
  };

  const isClickable = onPress !== null;

  return (
    <View
      style={[
        styles.outerContainer,
        inlineClan && styles.outerContainerInline,
        style,
      ]}
    >
      {/* 1. Plakat Kota / Status Pengelana */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isJoinedClan ? `Kota ${cityName}` : 'Status Gelandangan / Pengelana'}
        disabled={!isClickable}
        onPress={handlePress}
        // @ts-ignore
        onClick={handlePress}
        style={({ pressed }) => [
          styles.plaqueRow,
          compact && styles.plaqueRowCompact,
          pressed && isClickable && styles.pressed,
          Platform.OS === 'web' && isClickable && ({ cursor: 'pointer' } as any),
        ]}
        hitSlop={compact ? 4 : 6}
      >
        {/* Metallic City Emblem Shield Badge */}
        <View
          style={[
            styles.emblemWrapper,
            { shadowColor: accentColor },
            compact && styles.emblemWrapperCompact,
          ]}
        >
          <CityEmblemSvg
            cityId={cityId}
            size={compact ? 22 : 38}
            accent={accentColor}
          />
        </View>

        {/* Solid Beveled Dark Obsidian Plaque */}
        <View
          style={[
            styles.plaqueBody,
            {
              borderTopColor: accentColor,
              borderBottomColor: `${accentColor}88`,
            },
            compact && styles.plaqueBodyCompact,
          ]}
        >
          {/* City Name */}
          <Text
            style={[
              styles.cityNameText,
              compact && styles.cityNameTextCompact,
            ]}
            numberOfLines={1}
          >
            {cityName}
          </Text>

          {/* City Level Badge */}
          <View
            style={[
              styles.levelBadge,
              {
                borderColor: `${accentColor}66`,
              },
              compact && styles.levelBadgeCompact,
            ]}
          >
            <Text
              style={[
                styles.levelText,
                { color: theme.secondary },
                compact && styles.levelTextCompact,
              ]}
            >
              Lv.{cityLevel}
            </Text>
          </View>

          {/* Arrow Chevron Tip on Right */}
          <View
            style={[
              styles.chevronTip,
              compact && styles.chevronTipCompact,
            ]}
          >
            {compact ? (
              <Svg width={6} height={18} viewBox="0 0 6 18" fill="none">
                <Path
                  d="M0 0 L4 9 L0 18 Z"
                  fill="#070E1C"
                  stroke={accentColor}
                  strokeWidth={1}
                />
              </Svg>
            ) : (
              <Svg width={10} height={28} viewBox="0 0 10 28" fill="none">
                <Path
                  d="M0 0 L6 14 L0 28 Z"
                  fill="#070E1C"
                  stroke={accentColor}
                  strokeWidth={1.2}
                />
              </Svg>
            )}
          </View>
        </View>
      </Pressable>

      {/* 2. Informasi Klan di Luar Plakat */}
      {isJoinedClan && (clanName || clanTag) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Klan ${clanName || clanTag}`}
          disabled={!isClickable}
          onPress={handlePress}
          // @ts-ignore
          onClick={handlePress}
          style={({ pressed }) => [
            styles.clanBadgeBelow,
            inlineClan && styles.clanBadgeInline,
            compact && styles.clanBadgeCompact,
            pressed && isClickable && styles.pressed,
            Platform.OS === 'web' && isClickable && ({ cursor: 'pointer' } as any),
          ]}
        >
          {clanTag && (
            <View
              style={[
                styles.clanTagPill,
                { borderColor: `${accentColor}88` },
                compact && styles.clanTagPillCompact,
              ]}
            >
              <Text
                style={[
                  styles.clanTagText,
                  { color: accentColor },
                  compact && styles.clanTagTextCompact,
                ]}
              >
                [{clanTag}]
              </Text>
            </View>
          )}
          <Text
            style={[
              styles.clanNameText,
              compact && styles.clanNameTextCompact,
            ]}
            numberOfLines={1}
          >
            {clanName || 'Klan Anggota'}
          </Text>
        </Pressable>
      ) : !hideIfNoClan && !hideNoClanBadge ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Belum ada klan — Ketuk untuk cari klan"
          disabled={!isClickable}
          onPress={handlePress}
          // @ts-ignore
          onClick={handlePress}
          style={({ pressed }) => [
            styles.noClanBadgeBelow,
            inlineClan && styles.clanBadgeInline,
            compact && styles.clanBadgeCompact,
            pressed && isClickable && styles.pressed,
            Platform.OS === 'web' && isClickable && ({ cursor: 'pointer' } as any),
          ]}
        >
          <View style={styles.noClanDot} />
          <Text
            style={[
              styles.clanNameText,
              compact && styles.clanNameTextCompact,
              { color: '#94A3B8' },
            ]}
            numberOfLines={1}
          >
            Belum ada klan
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  outerContainer: {
    zIndex: 20,
    alignItems: 'flex-start',
  },
  outerContainerInline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  plaqueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plaqueRowCompact: {
    height: 20,
  },
  emblemWrapper: {
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#060C18',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  emblemWrapperCompact: {
    width: 22,
    height: 22,
    borderRadius: 11,
    elevation: 3,
  },
  plaqueBody: {
    position: 'relative',
    marginLeft: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    backgroundColor: '#070E1C',
    paddingLeft: 12,
    paddingRight: 10,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 4,
  },
  plaqueBodyCompact: {
    height: 18,
    marginLeft: -5,
    paddingLeft: 8,
    paddingRight: 6,
    gap: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    elevation: 2,
  },
  cityNameText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 11.5,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  cityNameTextCompact: {
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  levelBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  levelBadgeCompact: {
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    borderRadius: 3,
  },
  levelText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 9,
  },
  levelTextCompact: {
    fontSize: 7.5,
  },
  chevronTip: {
    position: 'absolute',
    right: -8,
    top: -1.5,
    height: 28,
    justifyContent: 'center',
  },
  chevronTipCompact: {
    right: -5,
    top: -1,
    height: 18,
  },
  clanBadgeBelow: {
    marginTop: 4,
    marginLeft: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: '#070E1C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    maxWidth: 200,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  clanBadgeInline: {
    marginTop: 0,
    marginLeft: 6,
  },
  clanBadgeCompact: {
    height: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    gap: 3.5,
    borderRadius: 4,
    maxWidth: 160,
  },
  clanTagPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderRadius: 3.5,
    paddingHorizontal: 3.5,
    paddingVertical: 0.5,
  },
  clanTagPillCompact: {
    paddingHorizontal: 3,
    paddingVertical: 0,
    borderRadius: 2.5,
  },
  clanTagText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 8.5,
    letterSpacing: 0.4,
  },
  clanTagTextCompact: {
    fontSize: 7.5,
    letterSpacing: 0.3,
  },
  clanNameText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 10,
    color: '#E2E8F0',
    letterSpacing: 0.3,
  },
  clanNameTextCompact: {
    fontSize: 8.5,
    letterSpacing: 0.2,
  },
  noClanDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#94A3B8',
    opacity: 0.8,
  },
  noClanBadgeBelow: {
    marginTop: 4,
    marginLeft: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: 'rgba(7, 14, 28, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  noClanText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 9,
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
});
