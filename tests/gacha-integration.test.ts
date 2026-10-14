import { beforeEach, describe, expect, it, vi } from "vitest";

const { memoryStorage } = vi.hoisted(() => ({
  memoryStorage: new Map<string, string>(),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  NativeModules: {},
  Linking: {
    openURL: vi.fn().mockResolvedValue(true),
  },
  DeviceEventEmitter: { emit: vi.fn(), addListener: vi.fn() },
  TurboModuleRegistry: { get: vi.fn(), getEnforcing: vi.fn() },
}));
vi.mock("../assets/images/gacha/banner.gif", () => ({ default: "mock-banner.gif" }));
vi.mock("../assets/images/gacha/animasi-gacha.gif", () => ({ default: "mock-animasi.gif" }));
vi.mock("../assets/images/topup/topup-crystal.png", () => ({ default: "mock-crystal.png" }));
vi.mock("@/assets/images/gacha/banner.gif", () => ({ default: "mock-banner.gif" }));
vi.mock("@/assets/images/gacha/animasi-gacha.gif", () => ({ default: "mock-animasi.gif" }));
vi.mock("@/assets/images/topup/topup-crystal.png", () => ({ default: "mock-crystal.png" }));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => memoryStorage.get(key) ?? null),
    setItem: vi.fn(async (key: string, val: string) => {
      memoryStorage.set(key, String(val));
    }),
    removeItem: vi.fn(async (key: string) => {
      memoryStorage.delete(key);
    }),
    clear: vi.fn(async () => {
      memoryStorage.clear();
    }),
    getAllKeys: vi.fn(async () => Array.from(memoryStorage.keys())),
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "RPC not mocked, use fallback" } }),
  },
}));

import {
  isValidImageUrl,
  RARITY_CONFIG,
  WALLPAPER_CATALOG,
  type WallpaperItem,
} from "../lib/gacha-data";
import {
  getCrystalBalance,
  setCrystalBalance,
  getGachaConfig,
  saveGachaConfig,
  getAllGachaBanners,
  getActiveGachaBanners,
  addGachaBanner,
  updateGachaBanner,
  deleteGachaBanner,
  toggleGachaBannerActive,
  getOwnedWallpaperIds,
  recordBannerOwnership,
  getActiveWallpaperId,
  setActiveWallpaperId,
  executeGachaSummon,
  DEFAULT_GACHA_CONFIG,
  type DynamicGachaConfig,
} from "../lib/gacha-service";

describe("Nuenime Gacha & Profile Banner Integration Tests", () => {
  beforeEach(() => {
    memoryStorage.clear();
  });

  describe("1. URL Validation & Image Format Support", () => {
    it("validates external URLs for GIF (animated), PNG, and JPG", () => {
      expect(isValidImageUrl("https://media.giphy.com/media/xyz/giphy.gif")).toBe(true);
      expect(isValidImageUrl("http://example.com/banner.png")).toBe(true);
      expect(isValidImageUrl("https://images.alphacoders.com/banner.jpg")).toBe(true);
      expect(isValidImageUrl("https://images.alphacoders.com/banner.jpeg")).toBe(true);
      expect(isValidImageUrl("not-a-url")).toBe(false);
      expect(isValidImageUrl("ftp://example.com/banner.png")).toBe(false);
      expect(isValidImageUrl("")).toBe(false);
      expect(isValidImageUrl(null)).toBe(false);
      expect(isValidImageUrl(undefined)).toBe(false);
    });
  });

  describe("2. Dynamic Gacha Pricing & Config", () => {
    it("returns default pricing when no config is saved", async () => {
      const cfg = await getGachaConfig();
      expect(cfg.costSingle).toBe(1000);
      expect(cfg.costMulti).toBe(9000);
      expect(cfg.rates.mythic).toBe(2.0);
      expect(cfg.rates.normal).toBe(40.0);
    });

    it("allows admin to update gacha prices and drop rates dynamically", async () => {
      const customConfig: DynamicGachaConfig = {
        costSingle: 500,
        costMulti: 4500,
        rates: {
          mythic: 5.0,
          legends: 10.0,
          epic: 20.0,
          rare: 30.0,
          normal: 35.0,
        },
        bannerTitle: "Event Khusus Lebaran",
        bannerDesc: "Diskon 50% spin gacha!",
      };

      await saveGachaConfig(customConfig);
      const loaded = await getGachaConfig();
      expect(loaded.costSingle).toBe(500);
      expect(loaded.costMulti).toBe(4500);
      expect(loaded.rates.mythic).toBe(5.0);
      expect(loaded.bannerTitle).toBe("Event Khusus Lebaran");
    });
  });

  describe("3. Admin Banner CRUD & Pool Management", () => {
    it("loads default catalog when no database records exist", async () => {
      const banners = await getAllGachaBanners();
      expect(banners.length).toBeGreaterThanOrEqual(WALLPAPER_CATALOG.length);
      expect(banners.some((b) => b.id === "saitama_22")).toBe(true);
    });

    it("allows adding a new banner with GIF format and proper rarity metadata", async () => {
      const res = await addGachaBanner({
        name: "Luffy Gear 5 Sun God",
        anime: "One Piece",
        rarity: "Mythic",
        image: "https://media.giphy.com/media/luffy_g5.gif",
        isActive: true,
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.name).toBe("Luffy Gear 5 Sun God");
      expect(res.data?.rarity).toBe("Mythic");
      expect(res.data?.category).toBe("Premium");
      expect(res.data?.expBonus).toBe(25);
      expect(res.data?.color).toBe(RARITY_CONFIG.Mythic.color);

      const all = await getAllGachaBanners();
      expect(all.some((b) => b.name === "Luffy Gear 5 Sun God")).toBe(true);
    });

    it("allows toggling banner active/inactive from gacha pool", async () => {
      const res = await addGachaBanner({
        id: "banner_test_toggle",
        name: "Test Toggle Banner",
        rarity: "Normal",
        image: "https://example.com/banner.png",
        isActive: true,
      });
      expect(res.success).toBe(true);

      // Deactivate banner
      await toggleGachaBannerActive("banner_test_toggle", false);
      const activePool = await getActiveGachaBanners();
      expect(activePool.some((b) => b.id === "banner_test_toggle")).toBe(false);

      // Reactivate banner
      await toggleGachaBannerActive("banner_test_toggle", true);
      const activePoolReactivated = await getActiveGachaBanners();
      expect(activePoolReactivated.some((b) => b.id === "banner_test_toggle")).toBe(true);
    });

    it("allows editing and deleting banners", async () => {
      const res = await addGachaBanner({
        id: "banner_to_edit",
        name: "Banner Awal",
        rarity: "Rare",
        image: "https://example.com/awal.png",
      });
      expect(res.success).toBe(true);

      await updateGachaBanner({
        ...res.data!,
        name: "Banner Diedit",
        rarity: "Legendary",
      });

      const allAfterEdit = await getAllGachaBanners();
      const edited = allAfterEdit.find((b) => b.id === "banner_to_edit");
      expect(edited?.name).toBe("Banner Diedit");
      expect(edited?.rarity).toBe("Legendary");

      await deleteGachaBanner("banner_to_edit");
      const allAfterDelete = await getAllGachaBanners();
      expect(allAfterDelete.some((b) => b.id === "banner_to_edit")).toBe(false);
    });
  });

  describe("4. Crystal Balance & Summon Integration", () => {
    it("rejects summon when user balance is insufficient", async () => {
      const userId = "user_test_poor";
      await setCrystalBalance(userId, 200); // Only 200 Crystal

      const res = await executeGachaSummon(userId, 1);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Daylan Crystal tidak mencukupi");
      expect(res.results.length).toBe(0);

      // Balance remains unchanged
      const currentBalance = await getCrystalBalance(userId);
      expect(currentBalance).toBe(200);
    });

    it("deducts crystal, grants reward, and records transaction on successful summon", async () => {
      const userId = "user_test_rich";
      await setCrystalBalance(userId, 5000);

      const res = await executeGachaSummon(userId, 1);
      expect(res.success).toBe(true);
      expect(res.results.length).toBe(1);
      expect(res.newBalance).toBe(4000); // 5000 - 1000 = 4000
      expect(res.txId).toMatch(/^NUE-GC-/);

      // Verify balance in database/service
      const currentBalance = await getCrystalBalance(userId);
      expect(currentBalance).toBe(4000);

      // Verify ownership granted
      const owned = await getOwnedWallpaperIds(userId);
      expect(owned.includes(res.results[0].id)).toBe(true);
    });

    it("handles 10x summon with proper discount cost deduction", async () => {
      const userId = "user_multi_puller";
      await setCrystalBalance(userId, 15000);

      const res = await executeGachaSummon(userId, 10);
      expect(res.success).toBe(true);
      expect(res.results.length).toBe(10);
      expect(res.newBalance).toBe(6000); // 15000 - 9000 = 6000

      const owned = await getOwnedWallpaperIds(userId);
      for (const item of res.results) {
        expect(owned.includes(item.id)).toBe(true);
      }
    });

    it("enforces admin-configured custom price for summons", async () => {
      const userId = "user_discount_hunter";
      await setCrystalBalance(userId, 2000);

      const customCfg: DynamicGachaConfig = {
        costSingle: 300,
        costMulti: 2500,
        rates: DEFAULT_GACHA_CONFIG.rates,
        bannerTitle: "Flash Sale",
        bannerDesc: "Promo!",
      };
      await saveGachaConfig(customCfg);

      const res = await executeGachaSummon(userId, 1);
      expect(res.success).toBe(true);
      expect(res.newBalance).toBe(1700); // 2000 - 300 = 1700
    });
  });

  describe("5. Account Isolation & Equipping Banner", () => {
    it("keeps banner inventory isolated per user account", async () => {
      const userA = "user_account_alpha";
      const userB = "user_account_beta";

      await recordBannerOwnership(userA, ["saitama_22", "gojo_infinite_void"]);
      await recordBannerOwnership(userB, ["naruto_ramen"]);

      const ownedA = await getOwnedWallpaperIds(userA);
      const ownedB = await getOwnedWallpaperIds(userB);

      expect(ownedA).toContain("saitama_22");
      expect(ownedA).toContain("gojo_infinite_void");
      expect(ownedA).not.toContain("naruto_ramen");

      expect(ownedB).toContain("naruto_ramen");
      expect(ownedB).not.toContain("saitama_22");
      expect(ownedB).not.toContain("gojo_infinite_void");
    });

    it("persists equipped active banner per user account across sessions", async () => {
      const userA = "user_account_alpha";
      const userB = "user_account_beta";

      await setActiveWallpaperId(userA, "gojo_infinite_void");
      await setActiveWallpaperId(userB, "naruto_ramen");

      expect(await getActiveWallpaperId(userA)).toBe("gojo_infinite_void");
      expect(await getActiveWallpaperId(userB)).toBe("naruto_ramen");

      // Clear active wallpaper
      await setActiveWallpaperId(userA, null);
      expect(await getActiveWallpaperId(userA)).toBeNull();
      // User B remains unchanged
      expect(await getActiveWallpaperId(userB)).toBe("naruto_ramen");
    });
  });
});
