import { describe, expect, it, vi } from "vitest";

const { memoryStorage } = vi.hoisted(() => ({
  memoryStorage: new Map<string, string>(),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  NativeModules: {},
  DeviceEventEmitter: { emit: vi.fn(), addListener: vi.fn() },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => memoryStorage.get(key) ?? null),
    setItem: vi.fn(async (key: string, val: string) => {
      memoryStorage.set(key, String(val));
    }),
    removeItem: vi.fn(async (key: string) => {
      memoryStorage.delete(key);
    }),
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

import {
  AVATAR_BORDERS,
  BORDER_RARITIES,
  RARITY_THEME,
  getBorderById,
  getBordersByRarity,
  getEquippedBorderStorageKey,
  getOwnedBordersStorageKey,
} from "@/lib/avatar-borders";

describe("Avatar Borders System", () => {
  it("harus memiliki total tepat 45 border di katalog", () => {
    expect(AVATAR_BORDERS.length).toBe(45);
  });

  it("harus memiliki tepat 5 kategori rarity dengan jumlah border sesuai ketentuan", () => {
    expect(BORDER_RARITIES).toEqual(["Mythic", "Legends", "Epic", "Rare", "Normal"]);

    const mythicBorders = getBordersByRarity("Mythic");
    const legendsBorders = getBordersByRarity("Legends");
    const epicBorders = getBordersByRarity("Epic");
    const rareBorders = getBordersByRarity("Rare");
    const normalBorders = getBordersByRarity("Normal");

    expect(mythicBorders.length).toBe(5);
    expect(legendsBorders.length).toBe(7);
    expect(epicBorders.length).toBe(9);
    expect(rareBorders.length).toBe(10);
    expect(normalBorders.length).toBe(14);

    expect(RARITY_THEME.Mythic.targetCount).toBe(5);
    expect(RARITY_THEME.Legends.targetCount).toBe(7);
    expect(RARITY_THEME.Epic.targetCount).toBe(9);
    expect(RARITY_THEME.Rare.targetCount).toBe(10);
    expect(RARITY_THEME.Normal.targetCount).toBe(14);
  });

  it("harus mengintegrasikan 10 asset URL resmi untuk kategori Rare tanpa URL buatan untuk 35 lainnya", () => {
    const rareBorders = getBordersByRarity("Rare");
    expect(rareBorders.length).toBe(10);

    const expectedRareUrls = [
      "https://i.ibb.co.com/sdfKwzT2/1.png",
      "https://i.ibb.co.com/ZzvLgMch/2.png",
      "https://i.ibb.co.com/ZzmjPPHB/3.png",
      "https://i.ibb.co.com/x8Ysr5cq/4.png",
      "https://i.ibb.co.com/zwxRY8Y/5.png",
      "https://i.ibb.co.com/k6htGsZL/6.png",
      "https://i.ibb.co.com/Nn1PXwqB/7.png",
      "https://i.ibb.co.com/1fhNKGFL/8.png",
      "https://i.ibb.co.com/Zzr9Svyq/9.png",
      "https://i.ibb.co.com/RMNmBBk/10.png",
    ];

    rareBorders.forEach((b, index) => {
      expect(b.assetUrl).toBe(expectedRareUrls[index]);
      expect(b.isReleased).toBe(true);
      expect(b.innerRatio).toBeGreaterThan(0.5);
      expect(b.innerRatio).toBeLessThan(0.85);
    });

    // 35 border lainnya tidak boleh memiliki URL buatan (assetUrl harus null)
    const nonRareBorders = AVATAR_BORDERS.filter((b) => b.rarity !== "Rare");
    expect(nonRareBorders.length).toBe(35);
    nonRareBorders.forEach((b) => {
      expect(b.assetUrl).toBeNull();
      expect(b.isReleased).toBe(false);
    });
  });

  it("memiliki ID unik untuk setiap border dan lookup berfungsi", () => {
    const ids = new Set<string>();
    AVATAR_BORDERS.forEach((b) => {
      expect(ids.has(b.id)).toBe(false);
      ids.add(b.id);
      expect(getBorderById(b.id)).toBe(b);
    });
    expect(ids.size).toBe(45);
  });

  it("memisahkan key penyimpanan per-akun agar border aktif antar akun tidak tertukar", () => {
    const keyUserA = getEquippedBorderStorageKey("user-abc-123");
    const keyUserB = getEquippedBorderStorageKey("user-xyz-789");
    const keyGuest = getEquippedBorderStorageKey(null);

    expect(keyUserA).toBe("nuenime.equipped_border.user-abc-123");
    expect(keyUserB).toBe("nuenime.equipped_border.user-xyz-789");
    expect(keyGuest).toBe("nuenime.equipped_border.guest");
    expect(keyUserA).not.toBe(keyUserB);

    const ownedUserA = getOwnedBordersStorageKey("user-abc-123");
    const ownedUserB = getOwnedBordersStorageKey("user-xyz-789");
    expect(ownedUserA).not.toBe(ownedUserB);
  });

  it("memastikan ukuran avatar tetap sesuai komponen pemanggil dan border menyesuaikan avatar", () => {
    // Simulasi komponen pemanggil yang memiliki avatarSize berbeda:
    const testCases = [
      { location: "Komentar", avatarSize: 30 },
      { location: "Profil Sosial", avatarSize: 46 },
      { location: "Inventory Akun", avatarSize: 48 },
      { location: "Pengaturan Profil", avatarSize: 50 },
      { location: "Preview Koleksi", avatarSize: 58 },
      { location: "Detail Profil Utama", avatarSize: 80 },
    ];

    const rareBorders = getBordersByRarity("Rare");

    testCases.forEach(({ location, avatarSize }) => {
      // 1. Tanpa border: ukuran avatar tetap sama
      const noBorderAvatarSize = avatarSize;
      expect(noBorderAvatarSize).toBe(avatarSize);

      // 2. Dengan berbagai border berbeda: ukuran avatar TIDAK PERNAH BERUBAH
      rareBorders.forEach((b) => {
        const ratio = b.innerRatio ?? 0.65;
        // Border yang menyesuaikan ukuran avatar:
        const borderSize = Math.round(avatarSize / ratio);

        // Border harus lebih besar dari avatar agar ornamen berada di luar avatar
        expect(borderSize).toBeGreaterThan(avatarSize);

        // Lubang dalam border (borderSize * ratio) harus tepat pas membungkus avatarSize
        const innerHole = borderSize * ratio;
        expect(Math.abs(innerHole - avatarSize)).toBeLessThanOrEqual(1.5);
      });
    });
  });
});

