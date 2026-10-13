import { describe, expect, it } from "vitest";
import { getLevelProgressInfo, EXP_RULES } from "@/lib/user-level";

describe("Sistem Level dan EXP Per Akun (Valora Film / Nuenime)", () => {
  it("menghitung Level 1 untuk pengguna baru dengan 0 EXP", () => {
    const info = getLevelProgressInfo(0);
    expect(info.level).toBe(1);
    expect(info.totalXp).toBe(0);
    expect(info.xpForThisLevel).toBe(50);
    expect(info.xpRemaining).toBe(50);
    expect(info.progressPercent).toBe(0);
    expect(info.nextLevelRequiredXp).toBe(50);
  });

  it("tetap berada di Level 1 saat EXP berada di batas bawah (misal 25 EXP)", () => {
    const info = getLevelProgressInfo(25);
    expect(info.level).toBe(1);
    expect(info.totalXp).toBe(25);
    expect(info.xpIntoCurrentLevel).toBe(25);
    expect(info.xpRemaining).toBe(25);
    expect(info.progressPercent).toBe(50);
  });

  it("naik ke Level 2 tepat saat mencapai 50 EXP", () => {
    const info = getLevelProgressInfo(50);
    expect(info.level).toBe(2);
    expect(info.totalXp).toBe(50);
    expect(info.currentLevelBaseXp).toBe(50);
    // Level 2 butuh 65 EXP (50 + 15)
    expect(info.xpForThisLevel).toBe(65);
    expect(info.xpIntoCurrentLevel).toBe(0);
    expect(info.xpRemaining).toBe(65);
    expect(info.progressPercent).toBe(0);
    expect(info.nextLevelRequiredXp).toBe(115);
  });

  it("memverifikasi contoh Akun A (250 EXP) dan Akun B (800 EXP) bersifat individual", () => {
    // Akun A: 250 EXP
    // L1: 0..50 (cost 50)
    // L2: 50..115 (cost 65)
    // L3: 115..195 (cost 80)
    // L4: 195..290 (cost 95) -> 250 berada di Level 4
    const akunA = getLevelProgressInfo(250);
    expect(akunA.level).toBe(4);
    expect(akunA.totalXp).toBe(250);
    expect(akunA.xpIntoCurrentLevel).toBe(55); // 250 - 195
    expect(akunA.xpRemaining).toBe(40); // 95 - 55
    expect(akunA.progressPercent).toBe(57); // floor(55 / 95 * 100)

    // Akun B: 800 EXP
    const akunB = getLevelProgressInfo(800);
    expect(akunB.level).toBe(8);
    expect(akunB.totalXp).toBe(800);
    expect(akunB.level).toBeGreaterThan(akunA.level);

    // Akun C: 0 EXP
    const akunC = getLevelProgressInfo(0);
    expect(akunC.level).toBe(1);
    expect(akunC.totalXp).toBe(0);
  });

  it("menghitung Level tinggi (seperti Level 87 pada screenshot user)", () => {
    // Di Level 87, cost per level = 50 + 86 * 15 = 1340 EXP
    // Sisa EXP berkisar antara 0 - 1340 EXP
    // Misal user punya akumulasi EXP sehingga sisa 13xx XP
    let totalXpTo87 = 0;
    for (let l = 1; l < 87; l++) {
      totalXpTo87 += 50 + (l - 1) * 15;
    }
    const info = getLevelProgressInfo(totalXpTo87);
    expect(info.level).toBe(87);
    expect(info.xpForThisLevel).toBe(1340);
    expect(info.xpRemaining).toBe(1340);
  });

  it("memiliki definisi EXP_RULES yang lengkap dan adil", () => {
    expect(EXP_RULES.WATCH_5MIN.xp).toBe(5);
    expect(EXP_RULES.COMPLETE_EPISODE.xp).toBe(15);
    expect(EXP_RULES.COMPLETE_MOVIE.xp).toBe(25);
    expect(EXP_RULES.LIKE_ANIME.xp).toBe(2);
    expect(EXP_RULES.COMMENT.xp).toBe(5);
    expect(EXP_RULES.RATE_EPISODE.xp).toBe(3);
    expect(EXP_RULES.DAILY_LOGIN.xp).toBe(5);
  });
});
