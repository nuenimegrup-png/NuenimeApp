// ==============================================================================
// NUENIME — LEADERBOARD SERVICE (FIXED)
// ==============================================================================

import { supabase } from "@/lib/supabase";
import { isSpecialRole } from "@/lib/admin-service";

export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "alltime";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  memberNumber: number | null;
  level: number;
  isVip: boolean;
  xpGained: number;
  periodStart: string;
  periodEnd: string;
  equippedBorder?: string | null;
  role?: string | null;
}

function getPeriodStart(period: LeaderboardPeriod): Date {
  const now = new Date();
  if (period === "daily") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "weekly") {
    const d = new Date(now);
    const diff = (d.getDay() + 6) % 7; // Monday-based
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "monthly") {
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }
  return new Date(0); // alltime
}

/**
 * Mengambil leaderboard XP.
 * - alltime → langsung dari profiles.exp (semua user, urut exp DESC)
 * - daily/weekly/monthly → aggregate user_xp_transactions, lalu fetch profiles terpisah
 */
export async function getLeaderboard(
  period: LeaderboardPeriod = "alltime",
  limit: number = 50
): Promise<LeaderboardEntry[]> {
  const now = new Date();
  const periodStart = getPeriodStart(period);

  // ── ALL-TIME: langsung dari profiles (khusus member biasa centang biru) ────
  if (period === "alltime") {
    const fetchLimit = Math.max(limit * 2, limit + 30);
    let { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, member_number, level, exp, is_vip, equipped_border, role")
      .or("role.is.null,role.ilike.member")
      .order("exp", { ascending: false })
      .limit(fetchLimit);

    if (error) {
      // Fallback jika query .or ditolak
      const fb = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, member_number, level, exp, is_vip, equipped_border, role")
        .order("exp", { ascending: false })
        .limit(fetchLimit);
      data = fb.data;
    }

    if (!data || data.length === 0) return [];

    // Filter ketat: Dilarang admin / role khusus centang merah masuk leaderboard
    const eligibleMembers = data
      .filter((p: any) => !isSpecialRole(p?.role))
      .slice(0, limit);

    return eligibleMembers.map((p: any, i) => ({
      rank: i + 1,
      userId: p.id,
      username: p.username ?? "Nuenime Member",
      displayName: p.display_name ?? p.username ?? "Nuenime Member",
      avatarUrl: p.avatar_url ?? null,
      memberNumber: p.member_number ?? null,
      level: p.level ?? 1,
      isVip: p.is_vip ?? false,
      xpGained: p.exp ?? 0,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      equippedBorder: p.equipped_border ?? null,
      role: p.role ?? "Member",
    }));
  }

  // ── PERIODIK: aggregate dari user_xp_transactions ─────────────────────────
  // Step 1: ambil semua transaksi XP dalam rentang waktu (tanpa join ke profiles)
  const { data: txData, error: txError } = await supabase
    .from("user_xp_transactions")
    .select("user_id, total_xp")
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", now.toISOString())
    .limit(1000);

  if (txError) {
    console.warn("[Leaderboard] tx error:", txError.message);
    return [];
  }
  if (!txData || txData.length === 0) {
    // Tidak ada XP hari ini/minggu ini — fallback: tampilkan all-time
    return getLeaderboard("alltime", limit);
  }

  // Step 2: aggregate XP per user
  const userXpMap: Record<string, number> = {};
  for (const tx of txData) {
    userXpMap[tx.user_id] = (userXpMap[tx.user_id] ?? 0) + (tx.total_xp ?? 0);
  }

  // Step 3: sort & ambil candidate user_ids (ambil lebih banyak agar cukup setelah filter admin)
  const candidateUserIds = Object.entries(userXpMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(limit * 3, limit + 50))
    .map(([uid]) => uid);

  if (candidateUserIds.length === 0) return [];

  // Step 4: fetch profiles untuk user tersebut
  const { data: profileData, error: profError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, member_number, level, is_vip, equipped_border, role")
    .in("id", candidateUserIds);

  if (profError) {
    console.warn("[Leaderboard] profile fetch error:", profError.message);
  }

  const profileMap = new Map((profileData ?? []).map((p: any) => [p.id, p]));

  // Step 5: Filter ketat khusus member biasa (centang biru), role admin / centang merah dilarang masuk
  const eligibleUserIds = candidateUserIds
    .filter((uid) => {
      const p: any = profileMap.get(uid);
      return !isSpecialRole(p?.role);
    })
    .slice(0, limit);

  return eligibleUserIds.map((uid, i) => {
    const p: any = profileMap.get(uid);
    return {
      rank: i + 1,
      userId: uid,
      username: p?.username ?? "Nuenime Member",
      displayName: p?.display_name ?? p?.username ?? "Nuenime Member",
      avatarUrl: p?.avatar_url ?? null,
      memberNumber: p?.member_number ?? null,
      level: p?.level ?? 1,
      isVip: p?.is_vip ?? false,
      xpGained: userXpMap[uid] ?? 0,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      equippedBorder: p?.equipped_border ?? null,
      role: p?.role ?? "Member",
    };
  });
}

/** Format XP dengan K/M suffix */
export function formatXp(xp: number): string {
  if (xp >= 1_000_000) return `+${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1_000) return `+${(xp / 1_000).toFixed(1)}K`;
  return `+${xp}`;
}

/** Label rentang tanggal periode */
export function getPeriodLabel(period: LeaderboardPeriod): string {
  const start = getPeriodStart(period);
  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (period === "alltime") return "All Time · Total XP";
  return `${fmt(start)} – ${fmt(now)}`;
}
