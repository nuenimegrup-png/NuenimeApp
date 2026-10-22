import { supabase } from "./supabase";

// ==============================================================================
// NUENIME / VALORA FILM - SISTEM LEVEL & EXP (EXPERIENCE POINTS)
// ==============================================================================

export type LevelProgressInfo = {
  level: number;
  totalXp: number;
  currentLevelBaseXp: number;
  nextLevelRequiredXp: number;
  xpForThisLevel: number;
  xpIntoCurrentLevel: number;
  xpRemaining: number;
  progressPercent: number;
  isMaxLevel?: boolean;
};

/**
 * Aturan perolehan EXP berdasarkan aktivitas pengguna (Valora Film).
 */
export const EXP_RULES = {
  WATCH_5MIN: {
    type: "watch_5min" as const,
    xp: 5,
    label: "Menonton anime 5 menit",
  },
  COMPLETE_EPISODE: {
    type: "complete_episode" as const,
    xp: 15,
    label: "Episode selesai ditonton",
  },
  COMPLETE_MOVIE: {
    type: "complete_movie" as const,
    xp: 25,
    label: "Menyelesaikan film",
  },
  LIKE_ANIME: {
    type: "like_anime" as const,
    xp: 2,
    label: "Memberikan like",
  },
  COMMENT: {
    type: "comment" as const,
    xp: 5,
    label: "Komentar berhasil dikirim",
  },
  RATE_EPISODE: {
    type: "rate_episode" as const,
    xp: 3,
    label: "Memberikan rating",
  },
  QUALITY_REVIEW: {
    type: "quality_review" as const,
    xp: 10,
    label: "Ulasan anime berkualitas",
  },
  DAILY_LOGIN: {
    type: "daily_login" as const,
    xp: 5,
    label: "Login harian",
  },
  DAILY_MISSION: {
    type: "daily_mission" as const,
    xp: 20,
    label: "Misi harian selesai",
  },
  WEEKLY_MISSION: {
    type: "weekly_mission" as const,
    xp: 75,
    label: "Misi mingguan selesai",
  },
} as const;

export type ExpActivityKey = keyof typeof EXP_RULES;

/**
 * Menghitung detail level dan progress bar dari total EXP akun pengguna.
 * Rumus kurva:
 * Level 1 -> Level 2 butuh 50 EXP.
 * Setiap kenaikan level berikutnya butuh +15 EXP (Level 2: 65, Level 3: 80, dst.)
 * 100% konsisten dengan fungsi PostgreSQL calculate_user_level.
 */
export function getLevelProgressInfo(rawTotalXp: number | null | undefined): LevelProgressInfo {
  const totalXp = Math.max(0, Math.floor(Number(rawTotalXp) || 0));

  let level = 1;
  let currentLevelBaseXp = 0;

  while (true) {
    const xpForThisLevel = 50 + (level - 1) * 15;
    const nextBoundary = currentLevelBaseXp + xpForThisLevel;

    if (totalXp < nextBoundary) {
      const xpIntoCurrentLevel = totalXp - currentLevelBaseXp;
      const xpRemaining = Math.max(0, xpForThisLevel - xpIntoCurrentLevel);
      const progressPercent = Math.min(
        100,
        Math.max(0, Math.floor((xpIntoCurrentLevel / xpForThisLevel) * 100))
      );

      return {
        level,
        totalXp,
        currentLevelBaseXp,
        nextLevelRequiredXp: nextBoundary,
        xpForThisLevel,
        xpIntoCurrentLevel,
        xpRemaining,
        progressPercent,
        isMaxLevel: false,
      };
    }

    currentLevelBaseXp = nextBoundary;
    level++;

    // Safety guard cap
    if (level >= 200000) {
      return {
        level,
        totalXp,
        currentLevelBaseXp,
        nextLevelRequiredXp: currentLevelBaseXp,
        xpForThisLevel: 0,
        xpIntoCurrentLevel: 0,
        xpRemaining: 0,
        progressPercent: 100,
        isMaxLevel: true,
      };
    }
  }
}

export interface LiveExpConfig {
  watch_episode: number;
  comment: number;
  daily_login: number;
  weekend_boost_active: boolean;
  weekend_multiplier: number;
}

export const DEFAULT_LIVE_EXP_CONFIG: LiveExpConfig = {
  watch_episode: 20,
  comment: 5,
  daily_login: 10,
  weekend_boost_active: true,
  weekend_multiplier: 1.5,
};

/**
 * Mengambil konfigurasi live perolehan EXP dari Supabase system_configs.
 * Jika offline / tabel belum terisi, otomatis fallback ke default yang sinkron.
 */
export async function fetchLiveExpConfig(): Promise<LiveExpConfig> {
  try {
    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "exp_rules")
      .maybeSingle();

    if (!error && data?.value && typeof data.value === "object") {
      const val = data.value as any;
      return {
        watch_episode: typeof val.watch_episode === "number" ? val.watch_episode : DEFAULT_LIVE_EXP_CONFIG.watch_episode,
        comment: typeof val.comment === "number" ? val.comment : DEFAULT_LIVE_EXP_CONFIG.comment,
        daily_login: typeof val.daily_login === "number" ? val.daily_login : DEFAULT_LIVE_EXP_CONFIG.daily_login,
        weekend_boost_active:
          typeof val.weekend_boost_active === "boolean"
            ? val.weekend_boost_active
            : DEFAULT_LIVE_EXP_CONFIG.weekend_boost_active,
        weekend_multiplier:
          typeof val.weekend_multiplier === "number"
            ? val.weekend_multiplier
            : DEFAULT_LIVE_EXP_CONFIG.weekend_multiplier,
      };
    }
  } catch (err) {
    console.warn("[user-level] fetchLiveExpConfig error:", err);
  }
  return DEFAULT_LIVE_EXP_CONFIG;
}
