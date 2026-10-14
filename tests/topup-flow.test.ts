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
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

import {
  CRYSTAL_PACKAGES,
  createTopUpTransaction,
  getCrystalBalance,
  getUserTransactions,
  getTransactionById,
  updateTransactionStatus,
  buildWhatsAppConfirmationMessage,
  getPaymentMethodConfigs,
  setCrystalBalance,
  generateTransactionId,
  openWhatsAppConfirmation,
  fetchActivePendingTransaction,
  checkTransactionStatusFromBackend,
  formatRupiah,
  formatCrystalAmount,
} from "@/lib/topup-service";

import {
  adminApproveTransaction,
  adminRejectTransaction,
  adminReverseTransaction,
  type AdminUser,
} from "@/lib/admin-service";

describe("Top Up Crystal - Business Logic & Verification Tests", () => {
  beforeEach(async () => {
    memoryStorage.clear();
    vi.clearAllMocks();
  });

  describe("1. Paket Crystal & Perhitungan Harga (Aturan 1 Crystal = Rp1)", () => {
    it("harus memiliki 6 paket resmi dengan aturan 1 Crystal = Rp1", () => {
      expect(CRYSTAL_PACKAGES.length).toBe(6);

      const expected = [
        { id: "starter", name: "Starter", amount: 300, price: 300, amountFormatted: "300", priceFormatted: "Rp300" },
        { id: "basic", name: "Basic", amount: 500, price: 500, amountFormatted: "500", priceFormatted: "Rp500" },
        { id: "standard", name: "Standard", amount: 1000, price: 1000, amountFormatted: "1.000", priceFormatted: "Rp1.000" },
        { id: "advanced", name: "Advanced", amount: 2500, price: 2500, amountFormatted: "2.500", priceFormatted: "Rp2.500" },
        { id: "premium", name: "Premium", amount: 25000, price: 25000, amountFormatted: "25.000", priceFormatted: "Rp25.000" },
        { id: "ultimate", name: "Ultimate", amount: 50000, price: 50000, amountFormatted: "50.000", priceFormatted: "Rp50.000" },
      ];

      for (const exp of expected) {
        const pkg = CRYSTAL_PACKAGES.find((p) => p.id === exp.id);
        expect(pkg).toBeDefined();
        expect(pkg?.amount).toBe(exp.amount);
        expect(pkg?.price).toBe(exp.price);
        expect(pkg?.amountFormatted).toBe(exp.amountFormatted);
        expect(pkg?.priceFormatted).toBe(exp.priceFormatted);
      }
    });

    it("formatter formatRupiah dan formatCrystalAmount menghasilkan output yang benar tanpa perkalian tidak sengaja", () => {
      expect(formatRupiah(300)).toBe("Rp300");
      expect(formatRupiah(500)).toBe("Rp500");
      expect(formatRupiah(1000)).toBe("Rp1.000");
      expect(formatRupiah(2500)).toBe("Rp2.500");
      expect(formatRupiah(25000)).toBe("Rp25.000");
      expect(formatRupiah(50000)).toBe("Rp50.000");

      expect(formatCrystalAmount(300)).toBe("300");
      expect(formatCrystalAmount(1000)).toBe("1.000");
      expect(formatCrystalAmount(25000)).toBe("25.000");
    });

    it("menghitung total pembayaran dengan benar berdasarkan harga paket (misal 300 Crystal = Rp300)", async () => {
      const starterPkg = CRYSTAL_PACKAGES[0];
      const tx = await createTopUpTransaction({
        userId: "user-test-1",
        username: "testuser",
        packageItem: starterPkg,
        paymentMethod: "qris",
        additionalFee: 0,
      });

      expect(tx.price).toBe(300);
      expect(tx.additionalFee).toBe(0);
      expect(tx.totalPayment).toBe(300);
    });
  });

  describe("2. ID Transaksi & Integritas Data", () => {
    it("menghasilkan ID transaksi unik yang diawali dengan format NUE-TP-", () => {
      const id1 = generateTransactionId();
      const id2 = generateTransactionId();
      expect(id1.startsWith("NUE-TP-")).toBe(true);
      expect(id2.startsWith("NUE-TP-")).toBe(true);
      expect(id1).not.toBe(id2);
    });

    it("membuat transaksi baru dengan status awal menunggu_konfirmasi dan crystalsGranted = false", async () => {
      const pkg = CRYSTAL_PACKAGES[0];
      const tx = await createTopUpTransaction({
        userId: "user-123",
        username: "naruto99",
        packageItem: pkg,
        paymentMethod: "shopeepay",
      });

      expect(tx.status).toBe("menunggu_konfirmasi");
      expect(tx.crystalsGranted).toBe(false);
      expect(tx.crystalAmount).toBe(300);
      expect(tx.userId).toBe("user-123");
      expect(tx.username).toBe("naruto99");

      // Transaksi tersimpan di riwayat
      const userTxs = await getUserTransactions("user-123");
      expect(userTxs.length).toBe(1);
      expect(userTxs[0].id).toBe(tx.id);
    });
  });

  describe("3. Konfigurasi Metode Pembayaran Resmi", () => {
    it("tidak membuat nomor rekening atau QRIS palsu jika env variable belum dikonfigurasi", () => {
      const configs = getPaymentMethodConfigs();

      // Secara default jika env tidak diset, isConfigured harus bernilai false
      expect(configs.qris.id).toBe("qris");
      expect(configs.shopeepay.id).toBe("shopeepay");
      expect(configs.gopay.id).toBe("gopay");
      expect(configs.dana.id).toBe("dana");

      // Cek apakah tidak ada nomor palsu yang di-hardcode
      if (!process.env.EXPO_PUBLIC_SHOPEEPAY_NUMBER) {
        expect(configs.shopeepay.isConfigured).toBe(false);
        expect(configs.shopeepay.accountNumber).toBeUndefined();
      }
      if (!process.env.EXPO_PUBLIC_QRIS_URL) {
        expect(configs.qris.isConfigured).toBe(false);
        expect(configs.qris.qrImageUrl).toBeNull();
      }
    });
  });

  describe("4. Format Pesan WhatsApp Konfirmasi", () => {
    it("menghasilkan pesan WhatsApp dengan format resmi dan data transaksi aktual", async () => {
      const pkg = CRYSTAL_PACKAGES[0]; // 300 Crystal
      const tx = await createTopUpTransaction({
        userId: "user-001",
        username: "dylan_kun",
        packageItem: pkg,
        paymentMethod: "qris",
      });

      const msg = buildWhatsAppConfirmationMessage(tx);

      expect(msg).toContain("Halo Admin Nuenime, saya ingin melakukan konfirmasi pembayaran Top Up Crystal.");
      expect(msg).toContain(`- ID Transaksi: ${tx.id}`);
      expect(msg).toContain("300 Crystal");
      expect(msg).toContain("- Metode Pembayaran: QRIS");
      expect(msg).toContain("Rp300");
      expect(msg).toContain("- Username: dylan_kun");
      expect(msg).toContain("Bukti pembayaran:");
    });

    it("dapat memanggil openWhatsAppConfirmation dengan URL yang valid", async () => {
      const pkg = CRYSTAL_PACKAGES[0];
      const tx = await createTopUpTransaction({
        userId: "user-001",
        username: "dylan_kun",
        packageItem: pkg,
        paymentMethod: "qris",
      });

      const res = await openWhatsAppConfirmation(tx, "08123456789");
      expect(res.opened).toBe(true);
      expect(res.url).toContain("https://wa.me/08123456789?text=");
    });
  });

  describe("5. Logika Verifikasi Pembayaran & Penambahan Crystal (Single-Grant)", () => {
    it("tidak menambahkan Crystal saat transaksi masih menunggu_konfirmasi atau menunggu_verifikasi", async () => {
      const pkg = CRYSTAL_PACKAGES[0];
      const tx = await createTopUpTransaction({
        userId: "user-test",
        username: "tester",
        packageItem: pkg,
        paymentMethod: "dana",
      });

      const initialBalance = await getCrystalBalance("user-test");
      expect(initialBalance).toBe(0);

      // Ubah ke menunggu_verifikasi
      await updateTransactionStatus("user-test", tx.id, "menunggu_verifikasi");
      const balanceAfterVerifyWaiting = await getCrystalBalance("user-test");
      expect(balanceAfterVerifyWaiting).toBe(0);
    });

    it("menambahkan Crystal ke akun HANYA setelah transaksi diverifikasi 'berhasil'", async () => {
      const pkg = CRYSTAL_PACKAGES[0]; // 300 Crystal
      const tx = await createTopUpTransaction({
        userId: "user-buyer",
        username: "buyer",
        packageItem: pkg,
        paymentMethod: "gopay",
      });

      // Verifikasi berhasil oleh admin
      const result = await updateTransactionStatus("user-buyer", tx.id, "berhasil");
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(300);

      const currentBalance = await getCrystalBalance("user-buyer");
      expect(currentBalance).toBe(300);

      const savedTx = await getTransactionById("user-buyer", tx.id);
      expect(savedTx?.crystalsGranted).toBe(true);
      expect(savedTx?.status).toBe("berhasil");
    });

    it("mencegah penambahan Crystal ganda jika tombol/verifikasi 'berhasil' dipanggil berulang kali", async () => {
      const pkg = CRYSTAL_PACKAGES[0]; // 300 Crystal
      const tx = await createTopUpTransaction({
        userId: "user-buyer",
        username: "buyer",
        packageItem: pkg,
        paymentMethod: "gopay",
      });

      // Panggilan pertama: berhasil (+300)
      const res1 = await updateTransactionStatus("user-buyer", tx.id, "berhasil");
      expect(res1.newBalance).toBe(300);

      // Panggilan kedua: dipanggil lagi (misal re-trigger atau spam tombol)
      const res2 = await updateTransactionStatus("user-buyer", tx.id, "berhasil");
      expect(res2.newBalance).toBeUndefined(); // Tidak ada penambahan baru

      // Saldo tetap 300, bukan 600!
      const currentBalance = await getCrystalBalance("user-buyer");
      expect(currentBalance).toBe(300);
    });

    it("tidak menambahkan Crystal jika transaksi 'ditolak'", async () => {
      const pkg = CRYSTAL_PACKAGES[1]; // 500 Crystal
      const tx = await createTopUpTransaction({
        userId: "user-rejected",
        username: "user_fail",
        packageItem: pkg,
        paymentMethod: "shopeepay",
      });

      const res = await updateTransactionStatus("user-rejected", tx.id, "ditolak", "Bukti transfer tidak valid");
      expect(res.success).toBe(true);
      expect(res.transaction?.status).toBe("ditolak");
      expect(res.transaction?.statusNote).toBe("Bukti transfer tidak valid");

      const balance = await getCrystalBalance("user-rejected");
      expect(balance).toBe(0);
    });
  });

  describe("6. Isolasi Saldo Antar Pengguna", () => {
    it("memastikan saldo dan riwayat transaksi tidak bercampur antar akun pengguna", async () => {
      const pkg = CRYSTAL_PACKAGES[0]; // 300 Crystal

      // Transaksi User A
      const txA = await createTopUpTransaction({
        userId: "user-A",
        username: "alice",
        packageItem: pkg,
        paymentMethod: "qris",
      });
      await updateTransactionStatus("user-A", txA.id, "berhasil");

      // Cek saldo User A vs User B
      const balanceA = await getCrystalBalance("user-A");
      const balanceB = await getCrystalBalance("user-B");

      expect(balanceA).toBe(300);
      expect(balanceB).toBe(0);

      // Riwayat transaksi User A vs User B
      const historyA = await getUserTransactions("user-A");
      const historyB = await getUserTransactions("user-B");

      expect(historyA.length).toBe(1);
      expect(historyB.length).toBe(0);
    });
  });

  describe("7. Persistensi Tahap 3 & Penguncian Transaksi Pending", () => {
    it("fetchActivePendingTransaction mengembalikan transaksi yang masih menunggu verifikasi", async () => {
      const pkg = CRYSTAL_PACKAGES[0];
      const tx = await createTopUpTransaction({
        userId: "user-persistent",
        username: "persistent_user",
        packageItem: pkg,
        paymentMethod: "qris",
      });

      // Status default menunggu_konfirmasi
      const pending1 = await fetchActivePendingTransaction("user-persistent");
      expect(pending1).not.toBeNull();
      expect(pending1?.id).toBe(tx.id);

      // Ubah status ke menunggu_verifikasi
      await updateTransactionStatus("user-persistent", tx.id, "menunggu_verifikasi");
      const pending2 = await fetchActivePendingTransaction("user-persistent");
      expect(pending2).not.toBeNull();
      expect(pending2?.status).toBe("menunggu_verifikasi");
    });

    it("fetchActivePendingTransaction mengembalikan null ketika transaksi sudah berhasil atau ditolak (penguncian lepas)", async () => {
      const pkg = CRYSTAL_PACKAGES[0];
      const tx = await createTopUpTransaction({
        userId: "user-done",
        username: "done_user",
        packageItem: pkg,
        paymentMethod: "dana",
      });

      // Verifikasi berhasil
      await updateTransactionStatus("user-done", tx.id, "berhasil");
      const pendingDone = await fetchActivePendingTransaction("user-done");
      expect(pendingDone).toBeNull(); // Penguncian dilepas!

      // Pengguna lain yang ditolak
      const tx2 = await createTopUpTransaction({
        userId: "user-rejected-2",
        username: "rejected_user",
        packageItem: pkg,
        paymentMethod: "gopay",
      });
      await updateTransactionStatus("user-rejected-2", tx2.id, "ditolak", "Bukti buram");
      const pendingRejected = await fetchActivePendingTransaction("user-rejected-2");
      expect(pendingRejected).toBeNull(); // Penguncian juga dilepas!
    });

    it("checkTransactionStatusFromBackend mengambil status dan memperbarui cache lokal", async () => {
      const pkg = CRYSTAL_PACKAGES[0];
      const tx = await createTopUpTransaction({
        userId: "user-check",
        username: "check_user",
        packageItem: pkg,
        paymentMethod: "shopeepay",
      });

      const checked1 = await checkTransactionStatusFromBackend(tx.id, "user-check");
      expect(checked1).not.toBeNull();
      expect(checked1?.id).toBe(tx.id);
      expect(checked1?.status).toBe("menunggu_konfirmasi");
    });
  });

  describe("8. Logika Admin Approve, Reject, dan Tarik Kembali (Reversal)", () => {
    const mockSuperAdmin: AdminUser = {
      id: "admin-super-1",
      email: "finance@nuenime.com",
      username: "Finance Super Admin",
      role: "super_admin",
    };

    it("adminApproveTransaction menyetujui transaksi pending dan menambahkan Crystal tepat 1 kali", async () => {
      const pkg = CRYSTAL_PACKAGES[0]; // 300 Crystal = Rp300
      const tx = await createTopUpTransaction({
        userId: "user-approve-test",
        username: "approve_user",
        packageItem: pkg,
        paymentMethod: "qris",
      });

      // Saldo awal 0
      expect(await getCrystalBalance("user-approve-test")).toBe(0);

      // Admin setujui
      const res = await adminApproveTransaction({
        transactionId: tx.id,
        admin: mockSuperAdmin,
      });

      expect(res.success).toBe(true);
      expect(res.transaction?.status).toBe("berhasil");
      expect(res.transaction?.crystalsGranted).toBe(true);
      expect(res.newBalance).toBe(300);

      // Saldo user bertambah jadi 300
      expect(await getCrystalBalance("user-approve-test")).toBe(300);
    });

    it("adminApproveTransaction menolak persetujuan ulang pada transaksi yang sudah disetujui", async () => {
      const pkg = CRYSTAL_PACKAGES[0];
      const tx = await createTopUpTransaction({
        userId: "user-dup-approve",
        username: "dup_user",
        packageItem: pkg,
        paymentMethod: "qris",
      });

      await adminApproveTransaction({ transactionId: tx.id, admin: mockSuperAdmin });

      // Coba setujui kedua kali
      const res2 = await adminApproveTransaction({ transactionId: tx.id, admin: mockSuperAdmin });
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("sudah pernah disetujui");

      // Saldo tetap 300, tidak dobel
      expect(await getCrystalBalance("user-dup-approve")).toBe(300);
    });

    it("adminRejectTransaction mewajibkan alasan penolakan dan tidak mengubah saldo pengguna", async () => {
      const pkg = CRYSTAL_PACKAGES[1]; // 500 Crystal
      const tx = await createTopUpTransaction({
        userId: "user-reject-test",
        username: "reject_user",
        packageItem: pkg,
        paymentMethod: "dana",
      });

      // Alasan kosong harus ditolak
      const failRes = await adminRejectTransaction({
        transactionId: tx.id,
        reason: "   ",
        admin: mockSuperAdmin,
      });
      expect(failRes.success).toBe(false);
      expect(failRes.error).toContain("Alasan penolakan wajib");

      // Alasan valid
      const successRes = await adminRejectTransaction({
        transactionId: tx.id,
        reason: "Bukti transfer tidak terbaca / buram",
        admin: mockSuperAdmin,
      });
      expect(successRes.success).toBe(true);
      expect(successRes.transaction?.status).toBe("ditolak");
      expect(successRes.transaction?.statusNote).toBe("Bukti transfer tidak terbaca / buram");

      // Saldo pengguna tetap 0
      expect(await getCrystalBalance("user-reject-test")).toBe(0);
    });

    it("adminRejectTransaction menolak jika transaksi sudah berstatus berhasil", async () => {
      const pkg = CRYSTAL_PACKAGES[0];
      const tx = await createTopUpTransaction({
        userId: "user-reject-approved",
        username: "approved_user",
        packageItem: pkg,
        paymentMethod: "qris",
      });

      await adminApproveTransaction({ transactionId: tx.id, admin: mockSuperAdmin });

      // Coba tolak transaksi yang sudah disetujui
      const res = await adminRejectTransaction({
        transactionId: tx.id,
        reason: "Salah transfer",
        admin: mockSuperAdmin,
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Tarik Kembali Crystal");
    });

    it("adminReverseTransaction menolak penarikan jika saldo pengguna saat ini tidak mencukupi (mencegah saldo negatif)", async () => {
      const pkg = CRYSTAL_PACKAGES[2]; // 1.000 Crystal
      const tx = await createTopUpTransaction({
        userId: "user-insufficient",
        username: "gacha_addict",
        packageItem: pkg,
        paymentMethod: "qris",
      });

      // Setujui transaksi (+1000 Crystal)
      await adminApproveTransaction({ transactionId: tx.id, admin: mockSuperAdmin });
      expect(await getCrystalBalance("user-insufficient")).toBe(1000);

      // Simulasikan pengguna membelanjakan 600 Crystal (misal gacha / border) sehingga sisa 400
      await setCrystalBalance("user-insufficient", 400);
      expect(await getCrystalBalance("user-insufficient")).toBe(400);

      // Admin mencoba menarik 1.000 Crystal dari transaksi tersebut
      const res = await adminReverseTransaction({
        transactionId: tx.id,
        reason: "Pembayaran terindikasi fraud / di-chargeback",
        admin: mockSuperAdmin,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("tidak mencukupi");
      expect(res.error).toContain("tidak boleh menjadi negatif");

      // Saldo tidak berubah menjadi negatif (-600), tetap 400
      expect(await getCrystalBalance("user-insufficient")).toBe(400);
    });

    it("adminReverseTransaction berhasil menarik Crystal, mengubah status ke reversed, dan mencatat alasan jika saldo cukup", async () => {
      const pkg = CRYSTAL_PACKAGES[1]; // 500 Crystal
      const tx = await createTopUpTransaction({
        userId: "user-reverse-success",
        username: "rev_user",
        packageItem: pkg,
        paymentMethod: "gopay",
      });

      // Setujui transaksi (+500 Crystal)
      await adminApproveTransaction({ transactionId: tx.id, admin: mockSuperAdmin });
      expect(await getCrystalBalance("user-reverse-success")).toBe(500);

      // Admin melakukan Tarik Kembali Crystal
      const revRes = await adminReverseTransaction({
        transactionId: tx.id,
        reason: "Transaksi dibatalkan atas kesepakatan pembeli",
        admin: mockSuperAdmin,
      });

      expect(revRes.success).toBe(true);
      expect(revRes.transaction?.status).toBe("reversed");
      expect(revRes.transaction?.statusNote).toContain("[REVERSED]: Transaksi dibatalkan atas kesepakatan pembeli");
      expect(revRes.newBalance).toBe(0);

      // Saldo pengguna kembali menjadi 0
      expect(await getCrystalBalance("user-reverse-success")).toBe(0);
    });

    it("adminReverseTransaction menolak jika ditarik kembali untuk kedua kalinya (anti double reversal)", async () => {
      const pkg = CRYSTAL_PACKAGES[0]; // 300 Crystal
      const tx = await createTopUpTransaction({
        userId: "user-anti-dup-rev",
        username: "antidup",
        packageItem: pkg,
        paymentMethod: "shopeepay",
      });

      await adminApproveTransaction({ transactionId: tx.id, admin: mockSuperAdmin });
      await adminReverseTransaction({
        transactionId: tx.id,
        reason: "Reversal pertama",
        admin: mockSuperAdmin,
      });

      // Coba penarikan kedua kali
      const secondRev = await adminReverseTransaction({
        transactionId: tx.id,
        reason: "Reversal kedua",
        admin: mockSuperAdmin,
      });

      expect(secondRev.success).toBe(false);
      expect(secondRev.error).toContain("reversal ganda dicegah");
    });
  });
});
