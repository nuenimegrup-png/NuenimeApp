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
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: "mock-gift-id" }, error: null }),
        })),
      })),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null }),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

import {
  sendMassGift,
  getUserMailboxGifts,
  claimGiftForUser,
  getAllAdminGifts,
} from "../lib/mailbox-service";

describe("Hadiah Massal (Mailbox & Gift Claim) Integration", () => {
  beforeEach(async () => {
    memoryStorage.clear();
  });

  it("admin dapat mengirim hadiah massal (Crystal)", async () => {
    const res = await sendMassGift(
      {
        title: "Kompensasi Server Maintenance",
        message: "Berikut 500 Crystal untuk seluruh user.",
        giftType: "crystal",
        giftValue: "500",
      },
      {
        id: "admin-1",
        username: "SuperAdmin",
        email: "admin@nuenime.com",
        role: "super_admin",
      }
    );

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.title).toBe("Kompensasi Server Maintenance");
    expect(res.data?.giftType).toBe("crystal");
    expect(res.data?.giftValue).toBe("500");

    const gifts = await getAllAdminGifts();
    expect(gifts.length).toBeGreaterThanOrEqual(1);
    expect(gifts[0].title).toBe("Kompensasi Server Maintenance");
  });

  it("user dapat melihat hadiah di mailbox dengan status belum diklaim", async () => {
    const res = await sendMassGift({
      title: "Hadiah Ulang Tahun Nuenime",
      message: "Border Avatar Eksklusif untuk kamu!",
      giftType: "border",
      giftValue: "border_cyber_neon",
    });

    const mailbox = await getUserMailboxGifts("user-123");
    expect(mailbox.length).toBeGreaterThanOrEqual(1);
    const item = mailbox.find((g) => g.id === res.data?.id);
    expect(item).toBeDefined();
    expect(item?.isClaimed).toBe(false);
  });

  it("user dapat mengklaim hadiah dan status berubah menjadi sudah diklaim (anti double-claim)", async () => {
    const res = await sendMassGift({
      title: "Bonus Dylan Crystal",
      message: "Nikmati 250 Crystal gratis!",
      giftType: "crystal",
      giftValue: "250",
    });

    const giftId = res.data!.id;
    const userId = "user-claim-test";

    // Klaim pertama
    const claimRes = await claimGiftForUser(giftId, userId);
    expect(claimRes.success).toBe(true);
    expect(claimRes.giftType).toBe("crystal");

    // Periksa status mailbox
    const mailboxAfter = await getUserMailboxGifts(userId);
    const claimedItem = mailboxAfter.find((g) => g.id === giftId);
    expect(claimedItem?.isClaimed).toBe(true);

    // Klaim kedua harus ditolak
    const secondClaim = await claimGiftForUser(giftId, userId);
    expect(secondClaim.success).toBe(false);
    expect(secondClaim.error).toMatch(/sudah pernah kamu klaim/i);
  });

  it("isolasi antar akun: user B tetap bisa klaim hadiah yang sudah diklaim user A", async () => {
    const res = await sendMassGift({
      title: "Hadiah Komunitas",
      message: "100 Crystal untuk semua",
      giftType: "crystal",
      giftValue: "100",
    });

    const giftId = res.data!.id;

    // User A klaim
    await claimGiftForUser(giftId, "user-A");
    const mailboxA = await getUserMailboxGifts("user-A");
    expect(mailboxA.find((g) => g.id === giftId)?.isClaimed).toBe(true);

    // User B cek mailbox -> harus belum diklaim
    const mailboxB = await getUserMailboxGifts("user-B");
    expect(mailboxB.find((g) => g.id === giftId)?.isClaimed).toBe(false);

    // User B klaim -> berhasil
    const claimB = await claimGiftForUser(giftId, "user-B");
    expect(claimB.success).toBe(true);

    // Sekarang User B juga sudah diklaim
    const mailboxBUpdated = await getUserMailboxGifts("user-B");
    expect(mailboxBUpdated.find((g) => g.id === giftId)?.isClaimed).toBe(true);
  });
});
