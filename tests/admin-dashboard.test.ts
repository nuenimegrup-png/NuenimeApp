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
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockResolvedValue({ error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: "b1", name: "Divine Celestial", rarity: "Mythic", is_released: true, inner_ratio: 0.74 },
            error: null,
          }),
        })),
      })),
    })),
  },
}));

import type { AdminUser } from "@/lib/admin-service";
import {
  canManageFinance,
  canManageUsers,
  canModerate,
  canManageSystem,
  adminApproveTransaction,
  adminRejectTransaction,
  adminAdjustUserBalance,
  logAdminAction,
  getAdminAuditLogs,
  getAdminBordersCatalog,
  updateAdminBorder,
  getAdminStreamTrackConfig,
  saveAdminStreamTrackConfig,
  getAdminSupportTickets,
  sendAdminTicketReply,
  updateSupportTicketStatus,
  sendAdminBroadcast,
  getAdminBroadcasts,
  sendAdminMassGift,
  getAdminMassGifts,
  getDashboardKPIData,
} from "@/lib/admin-service";
import {
  setCrystalBalance,
  getCrystalBalance,
  createTopUpTransaction,
  CRYSTAL_PACKAGES,
} from "@/lib/topup-service";

describe("Admin Dashboard Full System Tests", () => {
  const superAdmin: AdminUser = {
    id: "admin-super",
    email: "superadmin@nuenime.com",
    username: "SuperAdmin",
    role: "super_admin",
  };

  const moderatorAdmin: AdminUser = {
    id: "admin-mod",
    email: "mod@nuenime.com",
    username: "Moderator",
    role: "moderator",
  };

  beforeEach(async () => {
    memoryStorage.clear();
  });

  describe("1. RBAC (Role-Based Access Control)", () => {
    it("memvalidasi hak akses super_admin, finance_admin, dan moderator", () => {
      expect(canManageFinance("super_admin")).toBe(true);
      expect(canManageFinance("finance_admin")).toBe(true);
      expect(canManageFinance("moderator")).toBe(false);

      expect(canManageUsers("super_admin")).toBe(true);
      expect(canManageUsers("moderator")).toBe(false);

      expect(canModerate("super_admin")).toBe(true);
      expect(canModerate("moderator")).toBe(true);
      expect(canModerate("finance_admin")).toBe(false);

      expect(canManageSystem("super_admin")).toBe(true);
      expect(canManageSystem("finance_admin")).toBe(false);
      expect(canManageSystem("moderator")).toBe(false);
    });
  });

  describe("2. Top Up Verification (Single-Grant Guard)", () => {
    it("menolak approval jika role admin tidak memiliki hak akses finance", async () => {
      const res = await adminApproveTransaction({
        transactionId: "TX-TEST-001",
        admin: moderatorAdmin,
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Role Anda tidak memiliki izin");
    });

    it("menyetujui transaksi, menambah crystal tepat 1 kali, dan menolak double-grant", async () => {
      const userId = "test-user-topup-verify";
      await setCrystalBalance(userId, 500);

      // Buat transaksi pending
      const tx = await createTopUpTransaction({
        userId,
        username: "OtakuKing",
        packageItem: CRYSTAL_PACKAGES[0],
        paymentMethod: "qris",
      });

      expect(tx.status).toBe("menunggu_konfirmasi");
      expect(tx.crystalsGranted).toBe(false);

      // Approve pertama kali
      const approve1 = await adminApproveTransaction({
        transactionId: tx.id,
        admin: superAdmin,
      });

      expect(approve1.success).toBe(true);
      expect(approve1.newBalance).toBe(500 + CRYSTAL_PACKAGES[0].amount);
      const balanceAfter = await getCrystalBalance(userId);
      expect(balanceAfter).toBe(800);

      // Coba approve kedua kali (Single-grant guard / status check)
      const approve2 = await adminApproveTransaction({
        transactionId: tx.id,
        admin: superAdmin,
      });

      expect(approve2.success).toBe(false);
      expect(approve2.error).toContain("sudah pernah disetujui");

      // Pastikan saldo TIDAK bertambah dua kali
      const finalBalance = await getCrystalBalance(userId);
      expect(finalBalance).toBe(800);
    });

    it("menolak transaksi dengan alasan wajib dan tidak menambah saldo", async () => {
      const userId = "test-user-reject";
      await setCrystalBalance(userId, 100);

      const tx = await createTopUpTransaction({
        userId,
        username: "OtakuKing",
        packageItem: CRYSTAL_PACKAGES[0],
        paymentMethod: "dana",
      });

      // Penolakan tanpa alasan harus gagal
      const failReject = await adminRejectTransaction({
        transactionId: tx.id,
        reason: "",
        admin: superAdmin,
      });
      expect(failReject.success).toBe(false);

      // Penolakan dengan alasan sah
      const reject = await adminRejectTransaction({
        transactionId: tx.id,
        reason: "Bukti transfer tidak terbaca / buram",
        admin: superAdmin,
      });
      expect(reject.success).toBe(true);
      expect(reject.transaction?.status).toBe("ditolak");
      expect(reject.transaction?.statusNote).toBe("Bukti transfer tidak terbaca / buram");

      // Saldo tidak bertambah
      const bal = await getCrystalBalance(userId);
      expect(bal).toBe(100);
    });
  });

  describe("3. Manual Balance Adjustment", () => {
    it("menambah dan mengurangi saldo secara terkontrol serta melarang saldo negatif", async () => {
      const userId = "user-adjustment-test";
      await setCrystalBalance(userId, 1000);

      // Tambah 500
      const addRes = await adminAdjustUserBalance({
        userId,
        amount: 500,
        reason: "Kompensasi event downtime",
        admin: superAdmin,
      });
      expect(addRes.success).toBe(true);
      expect(addRes.before).toBe(1000);
      expect(addRes.after).toBe(1500);

      // Kurang 2000 (akan bernilai -500, harus ditolak)
      const negRes = await adminAdjustUserBalance({
        userId,
        amount: -2000,
        reason: "Koreksi salah kirim",
        admin: superAdmin,
      });
      expect(negRes.success).toBe(false);
      expect(negRes.error).toContain("negatif");

      const currentBal = await getCrystalBalance(userId);
      expect(currentBal).toBe(1500);
    });
  });

  describe("4. Audit Logs System", () => {
    it("merekam aksi admin ke dalam audit logs", async () => {
      await logAdminAction({
        admin: superAdmin,
        action: "TEST_SYSTEM_AUDIT",
        targetType: "system",
        targetId: "node-1",
        details: { test: true },
      });

      const logs = await getAdminAuditLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe("TEST_SYSTEM_AUDIT");
      expect(logs[0].adminEmail).toBe("superadmin@nuenime.com");
    });
  });

  describe("5. Borders Catalog Management", () => {
    it("mengambil 45 border dan memperbarui properti border", async () => {
      const borders = await getAdminBordersCatalog();
      expect(borders.length).toBe(45);

      const target = borders[0];
      const updated = await updateAdminBorder(
        target.id,
        { isReleased: true, innerRatio: 0.74 },
        superAdmin
      );
      expect(updated).not.toBeNull();
      expect(updated?.isReleased).toBe(true);
      expect(updated?.innerRatio).toBe(0.74);
    });
  });

  describe("6. Support Tickets & CS", () => {
    it("membalas tiket customer service dan memperbarui status", async () => {
      const tickets = await getAdminSupportTickets();
      expect(tickets.length).toBeGreaterThan(0);

      const t = tickets[0];
      const msg = await sendAdminTicketReply({
        ticketId: t.id,
        message: "Halo, kendala Anda sedang kami selesaikan.",
        admin: superAdmin,
      });
      expect(msg.isAdmin).toBe(true);
      expect(msg.message).toBe("Halo, kendala Anda sedang kami selesaikan.");

      const updatedTickets = await updateSupportTicketStatus(t.id, "resolved", superAdmin);
      const found = updatedTickets.find((x) => x.id === t.id);
      expect(found?.status).toBe("resolved");
    });
  });

  describe("7. Broadcast & Mass Gifts", () => {
    it("mengirim siaran notifikasi massal dan hadiah crystal", async () => {
      const bc = await sendAdminBroadcast({
        title: "Pemeliharaan Sukses",
        message: "Server kembali normal dengan kecepatan tinggi.",
        type: "system",
        admin: superAdmin,
      });
      expect(bc.title).toBe("Pemeliharaan Sukses");

      const bcs = await getAdminBroadcasts();
      expect(bcs.length).toBe(1);

      const gift = await sendAdminMassGift({
        title: "Hadiah Musim Panas",
        message: "Kado 100 Crystal untuk semua anggota!",
        giftType: "crystal",
        giftValue: "100",
        targetSegment: "all",
        admin: superAdmin,
      });
      expect(gift.success).toBe(true);
      expect(gift.campaign.giftValue).toBe("100");
    });
  });
});
