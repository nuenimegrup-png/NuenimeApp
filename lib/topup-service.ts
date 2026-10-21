import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, Platform } from "react-native";
import { supabase } from "@/lib/supabase";

export interface CrystalPackage {
  id: string;
  name: string;
  amount: number;
  amountFormatted: string;
  price: number;
  priceFormatted: string;
  tag?: string;
  tagColor?: string;
  active?: boolean;
}

export const STORAGE_GATEWAY_CONFIG = "nuenime.admin.gateway_config";
export const STORAGE_CRYSTAL_PACKAGES = "nuenime.admin.crystal_packages";

/**
 * ─── FORMATTER RESMI RUPIAH (INDONESIA) ───
 * Contoh: 300 -> Rp300, 1000 -> Rp1.000, 25000 -> Rp25.000
 */
export function formatRupiah(amount: number): string {
  const safe = Number(amount) || 0;
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
  // Hapus spasi jika ada agar konsisten 'Rp300'
  return formatted.replace(/\s+/g, "");
}

/**
 * ─── FORMATTER JUMLAH CRYSTAL RESMI ───
 * Contoh: 300 -> "300", 1000 -> "1.000", 25000 -> "25.000"
 */
export function formatCrystalAmount(amount: number): string {
  const safe = Number(amount) || 0;
  return safe.toLocaleString("id-ID");
}

// ─── HARGA RESMI NUENIME: 1 Crystal = Rp1 ───
export const CRYSTAL_PACKAGES: CrystalPackage[] = [
  {
    id: "starter",
    name: "Starter",
    amount: 1500,
    amountFormatted: "1.500",
    price: 1500,
    priceFormatted: "Rp1.500",
  },
  {
    id: "basic",
    name: "Basic",
    amount: 2500,
    amountFormatted: "2.500",
    price: 2500,
    priceFormatted: "Rp2.500",
  },
  {
    id: "standard",
    name: "Standard",
    amount: 4000,
    amountFormatted: "4.000",
    price: 4000,
    priceFormatted: "Rp4.000",
    tag: "POPULER",
    tagColor: "#38BDF8",
  },
  {
    id: "advanced",
    name: "Advanced",
    amount: 10000,
    amountFormatted: "10.000",
    price: 10000,
    priceFormatted: "Rp10.000",
  },
  {
    id: "premium",
    name: "Premium",
    amount: 25000,
    amountFormatted: "25.000",
    price: 25000,
    priceFormatted: "Rp25.000",
    tag: "HEMAT",
    tagColor: "#F59E0B",
  },
  {
    id: "ultimate",
    name: "Ultimate",
    amount: 50000,
    amountFormatted: "50.000",
    price: 50000,
    priceFormatted: "Rp50.000",
    tag: "TERBAIK",
    tagColor: "#A855F7",
  },
];

export type PaymentMethodId = "qris" | "shopeepay" | "gopay" | "dana";

export interface PaymentMethodConfig {
  id: PaymentMethodId;
  name: string;
  iconName: string;
  accountName?: string;
  accountNumber?: string;
  qrImageUrl?: string | null;
  isConfigured: boolean;
  instructionText: string;
}

/**
 * ─── KONFIGURASI METODE PEMBAYARAN RESMI ───
 * Membaca dari environment variable atau konfigurasi resmi.
 */
export function getPaymentMethodConfigs(): Record<PaymentMethodId, PaymentMethodConfig> {
  const adminWa = process.env.EXPO_PUBLIC_ADMIN_WHATSAPP?.trim() || "";
  const qrisUrl = process.env.EXPO_PUBLIC_QRIS_URL?.trim() || "";
  const spNumber = process.env.EXPO_PUBLIC_SHOPEEPAY_NUMBER?.trim() || "";
  const gpNumber = process.env.EXPO_PUBLIC_GOPAY_NUMBER?.trim() || "";
  const danaNumber = process.env.EXPO_PUBLIC_DANA_NUMBER?.trim() || "";

  return {
    qris: {
      id: "qris",
      name: "QRIS (Semua E-Wallet & Bank)",
      iconName: "qrcode-scan",
      accountName: "Nuenime Official Store",
      qrImageUrl: qrisUrl.length > 0 ? qrisUrl : null,
      isConfigured: qrisUrl.length > 0,
      instructionText:
        "Buka aplikasi e-wallet (GoPay, OVO, Dana, ShopeePay) atau m-Banking yang mendukung scan QRIS, lalu pindai kode QR.",
    },
    shopeepay: {
      id: "shopeepay",
      name: "ShopeePay",
      iconName: "shopping",
      accountName: "Nuenime Admin",
      accountNumber: spNumber.length > 0 ? spNumber : undefined,
      isConfigured: spNumber.length > 0,
      instructionText:
        "Kirim saldo ShopeePay ke nomor tujuan resmi Nuenime dengan nominal tepat sesuai total transaksi.",
    },
    gopay: {
      id: "gopay",
      name: "GoPay",
      iconName: "wallet",
      accountName: "Nuenime Admin",
      accountNumber: gpNumber.length > 0 ? gpNumber : undefined,
      isConfigured: gpNumber.length > 0,
      instructionText:
        "Buka aplikasi GoPay/Gojek, transfer ke nomor tujuan resmi Nuenime dengan nominal tepat sesuai total transaksi.",
    },
    dana: {
      id: "dana",
      name: "DANA",
      iconName: "credit-card-outline",
      accountName: "Nuenime Admin",
      accountNumber: danaNumber.length > 0 ? danaNumber : undefined,
      isConfigured: danaNumber.length > 0,
      instructionText:
        "Buka aplikasi DANA, kirim uang ke nomor tujuan resmi Nuenime dengan nominal tepat sesuai total transaksi.",
    },
  };
}

/**
 * Mengambil konfigurasi gateway dinamis yang disetel Admin dari Supabase atau AsyncStorage
 */
export async function fetchPaymentMethodConfigs(): Promise<Record<PaymentMethodId, PaymentMethodConfig>> {
  let configData: any = null;

  // 1. Coba ambil dari Supabase system_configs
  try {
    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "payment_gateways")
      .maybeSingle();

    if (!error && data?.value) {
      configData = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      await AsyncStorage.setItem(STORAGE_GATEWAY_CONFIG, JSON.stringify(configData));
    }
  } catch {}

  // 2. Fallback ke AsyncStorage
  if (!configData) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_GATEWAY_CONFIG);
      if (raw) configData = JSON.parse(raw);
    } catch {}
  }

  const qrisUrl = (configData?.qris_url ?? configData?.qrisUrl ?? process.env.EXPO_PUBLIC_QRIS_URL ?? "").trim();
  const qrisActive = configData?.qris_active ?? configData?.qrisActive ?? true;

  const spNumber = (configData?.shopeepay_number ?? configData?.shopeepayNumber ?? process.env.EXPO_PUBLIC_SHOPEEPAY_NUMBER ?? "").trim();
  const spName = configData?.shopeepay_name ?? configData?.shopeepayName ?? "Nuenime Admin";
  const spActive = configData?.shopeepay_active ?? configData?.shopeepayActive ?? true;

  const gpNumber = (configData?.gopay_number ?? configData?.gopayNumber ?? process.env.EXPO_PUBLIC_GOPAY_NUMBER ?? "").trim();
  const gpName = configData?.gopay_name ?? configData?.gopayName ?? "Nuenime Admin";
  const gpActive = configData?.gopay_active ?? configData?.gopayActive ?? true;

  const danaNumber = (configData?.dana_number ?? configData?.danaNumber ?? process.env.EXPO_PUBLIC_DANA_NUMBER ?? "").trim();
  const danaName = configData?.dana_name ?? configData?.danaName ?? "Nuenime Admin";
  const danaActive = configData?.dana_active ?? configData?.danaActive ?? true;

  return {
    qris: {
      id: "qris",
      name: "QRIS (Semua E-Wallet & Bank)",
      iconName: "qrcode-scan",
      accountName: "Nuenime Official Store",
      qrImageUrl: qrisUrl.length > 0 ? qrisUrl : null,
      isConfigured: qrisActive && qrisUrl.length > 0,
      instructionText:
        "Buka aplikasi e-wallet (GoPay, OVO, Dana, ShopeePay) atau m-Banking yang mendukung scan QRIS, lalu pindai kode QR.",
    },
    shopeepay: {
      id: "shopeepay",
      name: "ShopeePay",
      iconName: "shopping",
      accountName: spName,
      accountNumber: spNumber.length > 0 ? spNumber : undefined,
      isConfigured: spActive && spNumber.length > 0,
      instructionText:
        "Kirim saldo ShopeePay ke nomor tujuan resmi Nuenime dengan nominal tepat sesuai total transaksi.",
    },
    gopay: {
      id: "gopay",
      name: "GoPay",
      iconName: "wallet",
      accountName: gpName,
      accountNumber: gpNumber.length > 0 ? gpNumber : undefined,
      isConfigured: gpActive && gpNumber.length > 0,
      instructionText:
        "Buka aplikasi GoPay/Gojek, transfer ke nomor tujuan resmi Nuenime dengan nominal tepat sesuai total transaksi.",
    },
    dana: {
      id: "dana",
      name: "DANA",
      iconName: "credit-card-outline",
      accountName: danaName,
      accountNumber: danaNumber.length > 0 ? danaNumber : undefined,
      isConfigured: danaActive && danaNumber.length > 0,
      instructionText:
        "Buka aplikasi DANA, kirim uang ke nomor tujuan resmi Nuenime dengan nominal tepat sesuai total transaksi.",
    },
  };
}

export async function fetchCrystalPackages(): Promise<CrystalPackage[]> {
  try {
    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "crystal_packages")
      .maybeSingle();

    let val = data?.value;
    if (typeof val === "string") {
      try {
        val = JSON.parse(val);
      } catch {}
    }

    if (!error && val && Array.isArray(val) && val.length > 0) {
      const list: CrystalPackage[] = val.map((p: any) => {
        const amount = Number(p.amount) || 0;
        const price = Number(p.price) || 0;
        return {
          id: p.id,
          name: p.name,
          amount,
          amountFormatted: p.amountFormatted || formatCrystalAmount(amount),
          price,
          priceFormatted: p.priceFormatted || formatRupiah(price),
          tag: p.tag,
          tagColor: p.tagColor || p.tag_color,
          active: p.active !== false,
        };
      });
      await AsyncStorage.setItem(STORAGE_CRYSTAL_PACKAGES, JSON.stringify(list));
      return list;
    }
  } catch {}

  try {
    const raw = await AsyncStorage.getItem(STORAGE_CRYSTAL_PACKAGES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((p: any) => {
          const amount = Number(p.amount) || 0;
          const price = Number(p.price) || 0;
          return {
            id: p.id,
            name: p.name,
            amount,
            amountFormatted: formatCrystalAmount(amount),
            price,
            priceFormatted: formatRupiah(price),
            tag: p.tag,
            tagColor: p.tagColor || p.tag_color,
            active: p.active !== false,
          };
        });
      }
    }
  } catch {}

  return CRYSTAL_PACKAGES;
}

export async function fetchAdminWhatsAppNumber(): Promise<string> {
  try {
    const { data } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "payment_gateways")
      .maybeSingle();

    if (data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      const num = parsed.admin_whatsapp ?? parsed.adminWhatsapp;
      if (num && String(num).trim().length > 0) return String(num).trim();
    }
  } catch {}

  try {
    const raw = await AsyncStorage.getItem(STORAGE_GATEWAY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.adminWhatsapp) return parsed.adminWhatsapp;
    }
  } catch {}

  return getAdminWhatsAppNumber();
}

export function getAdminWhatsAppNumber(): string {
  return process.env.EXPO_PUBLIC_ADMIN_WHATSAPP?.trim() || "";
}

// ─── STATUS TRANSAKSI RESMI ───
export type TopUpStatus =
  | "menunggu_konfirmasi"
  | "menunggu_verifikasi"
  | "berhasil"
  | "ditolak"
  | "reversed"
  | "kedaluwarsa";

export interface TopUpTransaction {
  id: string; // Kode unik: NUE-TP-YYMMDD-XXXX
  userId: string;
  username: string;
  packageId: string;
  packageName: string;
  crystalAmount: number;
  price: number;
  additionalFee: number;
  totalPayment: number;
  paymentMethod: PaymentMethodId;
  status: TopUpStatus;
  statusNote?: string;
  createdAt: string;
  verifiedAt?: string;
  crystalsGranted: boolean; // Flag penjaga: Crystal hanya ditambahkan tepat 1 kali
}

// ─── STORAGE KEYS ───
const LEGACY_STORAGE_CRYSTAL_BALANCE = "nuenime.crystal.balance";

export function getCrystalBalanceStorageKey(userId?: string | null): string {
  if (userId && userId.trim().length > 0) {
    return `nuenime.crystal.balance.${userId.trim()}`;
  }
  return "nuenime.crystal.balance.guest";
}

export function getTopUpTransactionsStorageKey(userId?: string | null): string {
  if (userId && userId.trim().length > 0) {
    return `nuenime.topup_transactions.${userId.trim()}`;
  }
  return "nuenime.topup_transactions.guest";
}

/**
 * Mengambil saldo Crystal akun pengguna dari Supabase user_balances atau AsyncStorage
 */
export async function getCrystalBalance(userId?: string | null): Promise<number> {
  // 1. Coba ambil dari Supabase jika user logged-in
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    try {
      const { data, error } = await supabase
        .from("user_balances")
        .select("crystal_balance")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data && typeof data.crystal_balance === "number") {
        const key = getCrystalBalanceStorageKey(userId);
        await AsyncStorage.setItem(key, String(data.crystal_balance));
        return data.crystal_balance;
      }
    } catch {}
  }

  // 2. Fallback AsyncStorage
  try {
    const key = getCrystalBalanceStorageKey(userId);
    const val = await AsyncStorage.getItem(key);
    if (val !== null) {
      const num = parseInt(val, 10);
      if (!isNaN(num)) return num;
    }

    // Fallback legacy HANYA untuk pengguna tamu (guest / tanpa userId)
    if (!userId || userId.trim().length === 0) {
      const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_CRYSTAL_BALANCE);
      if (legacy !== null) {
        const num = parseInt(legacy, 10);
        if (!isNaN(num)) return num;
      }
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Menetapkan saldo Crystal akun pengguna (sinkron ke Supabase & AsyncStorage)
 */
export async function setCrystalBalance(
  userId: string | null | undefined,
  amount: number
): Promise<number> {
  const safeAmount = Math.max(0, Math.floor(amount));
  const key = getCrystalBalanceStorageKey(userId);
  await AsyncStorage.setItem(key, String(safeAmount));
  // Sinkronkan ke legacy key hanya untuk akun guest
  if (!userId || userId.trim().length === 0) {
    await AsyncStorage.setItem(LEGACY_STORAGE_CRYSTAL_BALANCE, String(safeAmount));
  }

  // Sinkronkan ke Supabase user_balances jika user valid
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    try {
      await supabase.from("user_balances").upsert({
        user_id: userId,
        crystal_balance: safeAmount,
        updated_at: new Date().toISOString(),
      });
    } catch {}
  }

  return safeAmount;
}

/**
 * Menambahkan Crystal ke saldo akun (mendukung delta positif maupun negatif, hasil minimal 0)
 */
export async function addCrystalBalance(
  userId: string | null | undefined,
  amountDelta: number
): Promise<number> {
  const current = await getCrystalBalance(userId);
  const next = Math.max(0, current + Math.floor(amountDelta));
  return setCrystalBalance(userId, next);
}

/**
 * Mengurangi Crystal dari saldo akun dengan penjaga saldo tidak negatif (floor 0)
 */
export async function deductCrystalBalance(
  userId: string | null | undefined,
  amountToDeduct: number
): Promise<number> {
  const current = await getCrystalBalance(userId);
  const positiveDeduct = Math.max(0, Math.floor(amountToDeduct));
  const next = Math.max(0, current - positiveDeduct);
  return setCrystalBalance(userId, next);
}

/**
 * Menghasilkan ID Transaksi unik acak berbasis timestamp
 */
export function generateTransactionId(): string {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `NUE-TP-${year}${month}${day}-${randomChars}`;
}

/**
 * Mengambil seluruh riwayat transaksi untuk akun pengguna dari Supabase & fallback AsyncStorage
 */
export async function getUserTransactions(userId?: string | null): Promise<TopUpTransaction[]> {
  // 1. Coba ambil dari Supabase jika user valid
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    try {
      const { data, error } = await supabase
        .from("topup_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped: TopUpTransaction[] = data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          username: d.username,
          packageId: d.package_id,
          packageName: d.package_name,
          crystalAmount: d.crystal_amount,
          price: d.price,
          additionalFee: d.additional_fee ?? 0,
          totalPayment: d.total_payment,
          paymentMethod: d.payment_method,
          status: d.status,
          statusNote: d.status_note,
          createdAt: d.created_at,
          verifiedAt: d.verified_at,
          crystalsGranted: d.crystals_granted ?? false,
        }));
        const key = getTopUpTransactionsStorageKey(userId);
        await AsyncStorage.setItem(key, JSON.stringify(mapped));
        return mapped;
      }
    } catch {}
  }

  // 2. Fallback AsyncStorage
  try {
    const key = getTopUpTransactionsStorageKey(userId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Mengambil transaksi aktif yang masih menunggu verifikasi / konfirmasi
 * Digunakan untuk mengunci pengguna di Tahap 3 saat aplikasi dibuka ulang.
 */
export async function fetchActivePendingTransaction(
  userId?: string | null
): Promise<TopUpTransaction | null> {
  if (userId && userId.trim().length > 0 && userId !== "guest") {
    try {
      const { data, error } = await supabase
        .from("topup_transactions")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["menunggu_verifikasi", "menunggu_konfirmasi"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        const d = data[0];
        return {
          id: d.id,
          userId: d.user_id,
          username: d.username,
          packageId: d.package_id,
          packageName: d.package_name,
          crystalAmount: d.crystal_amount,
          price: d.price,
          additionalFee: d.additional_fee ?? 0,
          totalPayment: d.total_payment,
          paymentMethod: d.payment_method,
          status: d.status,
          statusNote: d.status_note,
          createdAt: d.created_at,
          verifiedAt: d.verified_at,
          crystalsGranted: d.crystals_granted ?? false,
        };
      }
    } catch {}
  }

  // Fallback lokal jika offline
  const all = await getUserTransactions(userId);
  return (
    all.find(
      (t) => t.status === "menunggu_verifikasi" || t.status === "menunggu_konfirmasi"
    ) || null
  );
}

/**
 * Memeriksa status transaksi terbaru langsung dari backend Supabase
 */
export async function checkTransactionStatusFromBackend(
  transactionId: string,
  userId?: string | null
): Promise<TopUpTransaction | null> {
  try {
    const { data, error } = await supabase
      .from("topup_transactions")
      .select("*")
      .eq("id", transactionId)
      .maybeSingle();

    if (!error && data) {
      const mapped: TopUpTransaction = {
        id: data.id,
        userId: data.user_id,
        username: data.username,
        packageId: data.package_id,
        packageName: data.package_name,
        crystalAmount: data.crystal_amount,
        price: data.price,
        additionalFee: data.additional_fee ?? 0,
        totalPayment: data.total_payment,
        paymentMethod: data.payment_method,
        status: data.status,
        statusNote: data.status_note,
        createdAt: data.created_at,
        verifiedAt: data.verified_at,
        crystalsGranted: data.crystals_granted ?? false,
      };

      // Sinkronkan ke local storage
      const list = await getUserTransactions(userId);
      const idx = list.findIndex((t) => t.id === transactionId);
      if (idx !== -1) {
        list[idx] = mapped;
      } else {
        list.unshift(mapped);
      }
      const key = getTopUpTransactionsStorageKey(userId);
      await AsyncStorage.setItem(key, JSON.stringify(list));

      return mapped;
    }
  } catch {}

  return getTransactionById(userId, transactionId);
}

/**
 * Mengambil satu transaksi berdasarkan ID
 */
export async function getTransactionById(
  userId: string | null | undefined,
  transactionId: string
): Promise<TopUpTransaction | null> {
  const list = await getUserTransactions(userId);
  return list.find((t) => t.id === transactionId) || null;
}

/**
 * Membuat dan menyimpan transaksi baru ke Supabase dan AsyncStorage
 */
export async function createTopUpTransaction(params: {
  userId: string;
  username: string;
  packageItem: CrystalPackage;
  paymentMethod: PaymentMethodId;
  additionalFee?: number;
}): Promise<TopUpTransaction> {
  const fee = params.additionalFee ?? 0;
  const total = params.packageItem.price + fee;

  const transaction: TopUpTransaction = {
    id: generateTransactionId(),
    userId: params.userId,
    username: params.username,
    packageId: params.packageItem.id,
    packageName: params.packageItem.name,
    crystalAmount: params.packageItem.amount,
    price: params.packageItem.price,
    additionalFee: fee,
    totalPayment: total,
    paymentMethod: params.paymentMethod,
    status: "menunggu_konfirmasi",
    createdAt: new Date().toISOString(),
    crystalsGranted: false,
  };

  // 1. Simpan ke Supabase jika userId valid
  if (params.userId && params.userId !== "guest") {
    try {
      await supabase.from("topup_transactions").insert({
        id: transaction.id,
        user_id: params.userId,
        username: params.username,
        package_id: params.packageItem.id,
        package_name: params.packageItem.name,
        crystal_amount: params.packageItem.amount,
        price: params.packageItem.price,
        additional_fee: fee,
        total_payment: total,
        payment_method: params.paymentMethod,
        status: transaction.status,
        created_at: transaction.createdAt,
        crystals_granted: false,
      });
    } catch (e) {
      console.warn("createTopUpTransaction Supabase insert error:", e);
    }
  }

  // 2. Simpan ke AsyncStorage lokal
  const key = getTopUpTransactionsStorageKey(params.userId);
  const existing = await getUserTransactions(params.userId);
  const updated = [transaction, ...existing.filter((t) => t.id !== transaction.id)];
  await AsyncStorage.setItem(key, JSON.stringify(updated));

  return transaction;
}

/**
 * Memperbarui status transaksi ke Supabase dan AsyncStorage
 */
export async function updateTransactionStatus(
  userId: string | null | undefined,
  transactionId: string,
  newStatus: TopUpStatus,
  statusNote?: string
): Promise<{ success: boolean; transaction: TopUpTransaction | null; newBalance?: number }> {
  const list = await getUserTransactions(userId);
  const index = list.findIndex((t) => t.id === transactionId);
  if (index === -1) {
    return { success: false, transaction: null };
  }

  const tx = list[index];
  let newBalance: number | undefined;

  // Jika status berubah menjadi BERHASIL dan belum pernah diberikan Crystal:
  if (newStatus === "berhasil" && !tx.crystalsGranted) {
    newBalance = await addCrystalBalance(userId, tx.crystalAmount);
    tx.crystalsGranted = true;
    tx.verifiedAt = new Date().toISOString();
  }

  tx.status = newStatus;
  if (statusNote !== undefined) {
    tx.statusNote = statusNote;
  }

  list[index] = tx;
  const key = getTopUpTransactionsStorageKey(userId);
  await AsyncStorage.setItem(key, JSON.stringify(list));

  // Sinkronkan pembaruan ke Supabase
  if (userId && userId !== "guest") {
    try {
      await supabase
        .from("topup_transactions")
        .update({
          status: newStatus,
          status_note: statusNote ?? tx.statusNote ?? null,
          verified_at: tx.verifiedAt ?? null,
          crystals_granted: tx.crystalsGranted,
        })
        .eq("id", transactionId);
    } catch {}
  }

  return { success: true, transaction: tx, newBalance };
}

/**
 * Membuat format pesan WhatsApp konfirmasi pembayaran sesuai instruksi resmi
 */
export function buildWhatsAppConfirmationMessage(tx: TopUpTransaction): string {
  const methodName =
    tx.paymentMethod === "qris"
      ? "QRIS"
      : tx.paymentMethod === "shopeepay"
      ? "ShopeePay"
      : tx.paymentMethod === "gopay"
      ? "GoPay"
      : "DANA";

  return `Halo Admin Nuenime, saya ingin melakukan konfirmasi pembayaran Top Up Crystal.

- ID Transaksi: ${tx.id}
- Paket: ${formatCrystalAmount(tx.crystalAmount)} Crystal (${tx.packageName})
- Metode Pembayaran: ${methodName}
- Total Pembayaran: ${formatRupiah(tx.totalPayment)}
- Username: ${tx.username}

Saya telah menyelesaikan pembayaran. Mohon bantu verifikasi transaksi saya.

Bukti pembayaran: (Lampirkan foto/screenshot bukti transfer Anda di sini)`;
}

/**
 * Membuka WhatsApp untuk konfirmasi transaksi
 */
export async function openWhatsAppConfirmation(
  tx: TopUpTransaction,
  adminNumber?: string
): Promise<{ opened: boolean; url: string }> {
  const rawAdminNumber = adminNumber || (await fetchAdminWhatsAppNumber());
  const targetPhone = rawAdminNumber.replace(/\D/g, "");
  const message = buildWhatsAppConfirmationMessage(tx);
  const encodedText = encodeURIComponent(message);

  let waUrl = "";
  if (targetPhone.length > 0) {
    waUrl = `https://wa.me/${targetPhone}?text=${encodedText}`;
  } else {
    // Jika nomor belum diisi, buka tautan wa.me dengan teks saja
    waUrl = `https://wa.me/?text=${encodedText}`;
  }

  try {
    await Linking.openURL(waUrl);
    return { opened: true, url: waUrl };
  } catch {
    return { opened: false, url: waUrl };
  }
}
