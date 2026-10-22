import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { sendPushToAllUsers } from "@/lib/push-notification-service";
import type {
  TopUpTransaction,
  TopUpStatus,
  PaymentMethodId,
  CrystalPackage,
} from "@/lib/topup-service";
import {
  CRYSTAL_PACKAGES,
  getCrystalBalance,
  setCrystalBalance,
  addCrystalBalance,
  deductCrystalBalance,
  getTopUpTransactionsStorageKey,
  getUserTransactions,
  getPaymentMethodConfigs,
  formatRupiah,
  formatCrystalAmount,
} from "@/lib/topup-service";
import type { AvatarBorder, BorderRarity } from "@/lib/avatar-borders";
import {
  getBorderById,
  updateLiveBorderInCache,
  removeLiveBorderFromCache,
  fetchLiveBorderCatalog,
  BORDER_RARITY_PRICES,
} from "@/lib/avatar-borders";
import { createBorderCompensationGift } from "./mailbox-service";

export type { TopUpTransaction, TopUpStatus, PaymentMethodId, CrystalPackage };
export { formatRupiah, formatCrystalAmount, getCrystalBalance, deductCrystalBalance };
export type { AvatarBorder, BorderRarity };

// ─── ROLE-BASED ACCESS CONTROL (RBAC) & AUDIT LOG ───
import {
  AdminUser,
  AdminRole,
  canManageFinance,
  canManageUsers,
  canModerate,
  canManageSystem,
  AuditLogItem,
  logAdminAction,
  getAdminAuditLogs,
} from "./admin-audit";

export {
  AdminUser,
  AdminRole,
  canManageFinance,
  canManageUsers,
  canModerate,
  canManageSystem,
  AuditLogItem,
  logAdminAction,
  getAdminAuditLogs,
};

const STORAGE_SYSTEM_CONFIGS = "nuenime.admin.system_configs";

// ─── 1. FINANCE & TOP UP TRANSACTIONS ───

export interface AdminTopUpFilter {
  status?: TopUpStatus | "all";
  search?: string;
  paymentMethod?: PaymentMethodId | "all";
}

export async function getAllTransactionsForAdmin(
  filter?: AdminTopUpFilter
): Promise<TopUpTransaction[]> {
  try {
    // 1. Coba ambil dari Supabase
    const { data: dbData, error } = await supabase
      .from("topup_transactions")
      .select("*")
      .order("created_at", { ascending: false });

    let list: TopUpTransaction[] = [];
    if (!error && Array.isArray(dbData) && dbData.length > 0) {
      list = dbData.map((d) => ({
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
        crystalsGranted: d.crystals_granted,
      }));
    } else {
      // Fallback local storage
      const keys = await AsyncStorage.getAllKeys();
      const txKeys = keys.filter((k) => k.startsWith("nuenime.topup_transactions."));
      for (const k of txKeys) {
        const raw = await AsyncStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            list.push(...parsed);
          }
        }
      }
      // Hapus duplikat ID dan urutkan terbaru
      const map = new Map<string, TopUpTransaction>();
      list.forEach((t) => map.set(t.id, t));
      list = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    if (!filter) return list;

    return list.filter((t) => {
      if (filter.status && filter.status !== "all" && t.status !== filter.status) return false;
      if (
        filter.paymentMethod &&
        filter.paymentMethod !== "all" &&
        t.paymentMethod !== filter.paymentMethod
      )
        return false;
      if (filter.search && filter.search.trim().length > 0) {
        const q = filter.search.toLowerCase();
        return t.id.toLowerCase().includes(q) || t.username.toLowerCase().includes(q);
      }
      return true;
    });
  } catch {
    return [];
  }
}

/**
 * Admin menyetujui transaksi Top Up secara atomik:
 * Hanya dapat dijalankan untuk transaksi yang berstatus pending (menunggu_verifikasi/menunggu_konfirmasi).
 * Memberikan Dylan Crystal tepat 1 kali dan memperbarui status menjadi 'berhasil'.
 */
export async function adminApproveTransaction(params: {
  transactionId: string;
  admin: AdminUser;
}): Promise<{ success: boolean; error?: string; transaction?: TopUpTransaction; newBalance?: number }> {
  if (!canManageFinance(params.admin.role)) {
    return { success: false, error: "Role Anda tidak memiliki izin verifikasi keuangan." };
  }

  const all = await getAllTransactionsForAdmin();
  const tx = all.find((t) => t.id === params.transactionId);
  if (!tx) {
    return { success: false, error: "Transaksi tidak ditemukan." };
  }

  // VALIDASI KETAT: Hanya transaksi pending yang dapat disetujui
  if (tx.status !== "menunggu_verifikasi" && tx.status !== "menunggu_konfirmasi") {
    if (tx.status === "berhasil" && tx.crystalsGranted) {
      return { success: false, error: "Transaksi sudah pernah disetujui sebelumnya (saldo sudah diberikan)." };
    }
    return {
      success: false,
      error: `Transaksi tidak dapat disetujui karena berstatus '${tx.status}'. Hanya transaksi yang masih menunggu verifikasi yang dapat disetujui.`,
    };
  }

  if (tx.crystalsGranted) {
    return { success: false, error: "Crystal untuk transaksi ini sudah pernah diberikan (single-grant guard)." };
  }

  // 1. Tambah Crystal ke user
  const newBalance = await addCrystalBalance(tx.userId, tx.crystalAmount);
  tx.status = "berhasil";
  tx.crystalsGranted = true;
  tx.verifiedAt = new Date().toISOString();
  tx.statusNote = `Diverifikasi sah oleh ${params.admin.email}`;

  // 2. Simpan update di storage user
  const key = getTopUpTransactionsStorageKey(tx.userId);
  const userTxs = await getUserTransactions(tx.userId);
  const idx = userTxs.findIndex((t) => t.id === tx.id);
  if (idx !== -1) {
    userTxs[idx] = tx;
  } else {
    userTxs.unshift(tx);
  }
  await AsyncStorage.setItem(key, JSON.stringify(userTxs));

  // 3. Update Supabase
  try {
    await supabase
      .from("topup_transactions")
      .update({
        status: "berhasil",
        crystals_granted: true,
        verified_at: tx.verifiedAt,
        status_note: tx.statusNote,
      })
      .eq("id", tx.id);

    // Catat ke balance_adjustments di Supabase jika userId valid
    if (tx.userId && tx.userId !== "guest") {
      await supabase.from("balance_adjustments").insert({
        user_id: tx.userId,
        admin_id: params.admin.id && params.admin.id.length === 36 ? params.admin.id : "73f6e447-2f8c-4f12-ad94-a737a78e279b",
        admin_email: params.admin.email,
        amount: tx.crystalAmount,
        balance_before: newBalance - tx.crystalAmount,
        balance_after: newBalance,
        reason: `Persetujuan Top Up Transaksi ${tx.id}`,
      });
    }
  } catch {}

  // 4. Catat Audit Log
  await logAdminAction({
    admin: params.admin,
    action: "APPROVE_TOPUP",
    targetType: "transaction",
    targetId: tx.id,
    details: {
      userId: tx.userId,
      username: tx.username,
      crystalAmount: tx.crystalAmount,
      totalPayment: tx.totalPayment,
      newBalance,
    },
  });

  return { success: true, transaction: tx, newBalance };
}

/**
 * Admin menolak transaksi Top Up dengan alasan wajib.
 * Hanya dapat dilakukan untuk transaksi yang masih pending.
 */
export async function adminRejectTransaction(params: {
  transactionId: string;
  reason: string;
  admin: AdminUser;
}): Promise<{ success: boolean; error?: string; transaction?: TopUpTransaction }> {
  if (!canManageFinance(params.admin.role)) {
    return { success: false, error: "Role Anda tidak memiliki izin verifikasi keuangan." };
  }

  if (!params.reason || params.reason.trim().length === 0) {
    return { success: false, error: "Alasan penolakan wajib diisi oleh Admin." };
  }

  const all = await getAllTransactionsForAdmin();
  const tx = all.find((t) => t.id === params.transactionId);
  if (!tx) {
    return { success: false, error: "Transaksi tidak ditemukan." };
  }

  // VALIDASI KETAT: Transaksi yang sudah disetujui atau final tidak dapat ditolak
  if (tx.status !== "menunggu_verifikasi" && tx.status !== "menunggu_konfirmasi") {
    return {
      success: false,
      error: `Transaksi berstatus '${tx.status}' tidak dapat ditolak. Jika transaksi sudah disetujui, gunakan fitur 'Tarik Kembali Crystal'.`,
    };
  }

  tx.status = "ditolak";
  tx.statusNote = params.reason.trim();
  tx.verifiedAt = new Date().toISOString();

  // Simpan update di storage user
  const key = getTopUpTransactionsStorageKey(tx.userId);
  const userTxs = await getUserTransactions(tx.userId);
  const idx = userTxs.findIndex((t) => t.id === tx.id);
  if (idx !== -1) {
    userTxs[idx] = tx;
  } else {
    userTxs.unshift(tx);
  }
  await AsyncStorage.setItem(key, JSON.stringify(userTxs));

  // Update Supabase
  try {
    await supabase
      .from("topup_transactions")
      .update({
        status: "ditolak",
        status_note: tx.statusNote,
        verified_at: tx.verifiedAt,
      })
      .eq("id", tx.id);
  } catch {}

  // Audit Log
  await logAdminAction({
    admin: params.admin,
    action: "REJECT_TOPUP",
    targetType: "transaction",
    targetId: tx.id,
    details: {
      userId: tx.userId,
      username: tx.username,
      reason: params.reason.trim(),
    },
  });

  return { success: true, transaction: tx };
}

/**
 * Admin menarik kembali Crystal (Reversal) untuk transaksi yang SUDAH disetujui (approved/berhasil).
 * Mengurangi saldo Crystal pengguna sejumlah yang diberikan transaksi tersebut secara atomik.
 * Mencegah saldo negatif jika saldo pengguna saat ini tidak mencukupi.
 */
export async function adminReverseTransaction(params: {
  transactionId: string;
  reason: string;
  admin: AdminUser;
}): Promise<{
  success: boolean;
  error?: string;
  transaction?: TopUpTransaction;
  newBalance?: number;
  currentBalance?: number;
}> {
  if (!canManageFinance(params.admin.role)) {
    return { success: false, error: "Role Anda tidak memiliki izin penarikan kembali (reversal)." };
  }

  if (!params.reason || params.reason.trim().length === 0) {
    return { success: false, error: "Alasan penarikan kembali (reversal) wajib diisi oleh Admin." };
  }

  const all = await getAllTransactionsForAdmin();
  const tx = all.find((t) => t.id === params.transactionId);
  if (!tx) {
    return { success: false, error: "Transaksi tidak ditemukan." };
  }

  // VALIDASI KETAT 1: Hanya transaksi berstatus 'berhasil' yang dapat di-reverse
  if (tx.status !== "berhasil") {
    if (tx.status === "reversed") {
      return { success: false, error: "Transaksi ini sudah pernah ditarik kembali sebelumnya (reversal ganda dicegah)." };
    }
    return {
      success: false,
      error: `Hanya transaksi yang sudah berstatus 'berhasil' yang dapat ditarik kembali. Status saat ini: '${tx.status}'.`,
    };
  }

  // VALIDASI KETAT 2: Crystal harus sudah pernah diberikan
  if (!tx.crystalsGranted) {
    return { success: false, error: "Transaksi ini tercatat belum pernah memberikan Crystal." };
  }

  // VALIDASI KETAT 3: Periksa saldo pengguna saat ini (TIDAK BOLEH MENYEBABKAN SALDO NEGATIF)
  const currentBalance = await getCrystalBalance(tx.userId);
  if (currentBalance < tx.crystalAmount) {
    return {
      success: false,
      error: `Saldo pengguna saat ini (${currentBalance.toLocaleString(
        "id-ID"
      )} Crystal) tidak mencukupi untuk penarikan ${tx.crystalAmount.toLocaleString(
        "id-ID"
      )} Dylan Crystal. Saldo akun tidak boleh menjadi negatif.`,
      currentBalance,
    };
  }

  // 1. Kurangi Crystal pengguna secara atomik (dengan perlindungan anti-saldo negatif)
  const newBalance = await deductCrystalBalance(tx.userId, tx.crystalAmount);
  tx.status = "reversed";
  tx.statusNote = `[REVERSED]: ${params.reason.trim()}`;
  tx.verifiedAt = new Date().toISOString();

  // 2. Simpan update di storage user
  const key = getTopUpTransactionsStorageKey(tx.userId);
  const userTxs = await getUserTransactions(tx.userId);
  const idx = userTxs.findIndex((t) => t.id === tx.id);
  if (idx !== -1) {
    userTxs[idx] = tx;
  } else {
    userTxs.unshift(tx);
  }
  await AsyncStorage.setItem(key, JSON.stringify(userTxs));

  // 3. Update Supabase
  try {
    await supabase
      .from("topup_transactions")
      .update({
        status: "reversed",
        status_note: tx.statusNote,
        verified_at: tx.verifiedAt,
      })
      .eq("id", tx.id);

    // Catat ke balance_adjustments di Supabase jika userId valid
    if (tx.userId && tx.userId !== "guest") {
      await supabase.from("balance_adjustments").insert({
        user_id: tx.userId,
        admin_id: params.admin.id && params.admin.id.length === 36 ? params.admin.id : "73f6e447-2f8c-4f12-ad94-a737a78e279b",
        admin_email: params.admin.email,
        amount: -tx.crystalAmount,
        balance_before: currentBalance,
        balance_after: newBalance,
        reason: `Reversal Transaksi ${tx.id}: ${params.reason.trim()}`,
      });
    }
  } catch {}

  // 4. Catat Audit Log
  await logAdminAction({
    admin: params.admin,
    action: "REVERSE_TOPUP",
    targetType: "transaction",
    targetId: tx.id,
    details: {
      userId: tx.userId,
      username: tx.username,
      crystalAmount: tx.crystalAmount,
      totalPayment: tx.totalPayment,
      reason: params.reason.trim(),
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    },
  });

  return { success: true, transaction: tx, newBalance, currentBalance };
}

// ─── 2. KONFIGURASI GATEWAY PEMBAYARAN ───

export interface PaymentGatewaysConfig {
  adminWhatsapp: string;
  qrisUrl: string;
  qrisActive: boolean;
  shopeepayNumber: string;
  shopeepayName: string;
  shopeepayActive: boolean;
  gopayNumber: string;
  gopayName: string;
  gopayActive: boolean;
  danaNumber: string;
  danaName: string;
  danaActive: boolean;
}

const STORAGE_GATEWAY_CONFIG = "nuenime.admin.gateway_config";

export async function getPaymentGatewaysConfig(): Promise<PaymentGatewaysConfig> {
  // 1. Coba ambil dari Supabase system_configs
  try {
    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "payment_gateways")
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      const config: PaymentGatewaysConfig = {
        adminWhatsapp: parsed.admin_whatsapp ?? parsed.adminWhatsapp ?? process.env.EXPO_PUBLIC_ADMIN_WHATSAPP ?? "",
        qrisUrl: parsed.qris_url ?? parsed.qrisUrl ?? process.env.EXPO_PUBLIC_QRIS_URL ?? "",
        qrisActive: parsed.qris_active ?? parsed.qrisActive ?? true,
        shopeepayNumber: parsed.shopeepay_number ?? parsed.shopeepayNumber ?? process.env.EXPO_PUBLIC_SHOPEEPAY_NUMBER ?? "",
        shopeepayName: parsed.shopeepay_name ?? parsed.shopeepayName ?? "Nuenime Admin",
        shopeepayActive: parsed.shopeepay_active ?? parsed.shopeepayActive ?? true,
        gopayNumber: parsed.gopay_number ?? parsed.gopayNumber ?? process.env.EXPO_PUBLIC_GOPAY_NUMBER ?? "",
        gopayName: parsed.gopay_name ?? parsed.gopayName ?? "Nuenime Admin",
        gopayActive: parsed.gopay_active ?? parsed.gopayActive ?? true,
        danaNumber: parsed.dana_number ?? parsed.danaNumber ?? process.env.EXPO_PUBLIC_DANA_NUMBER ?? "",
        danaName: parsed.dana_name ?? parsed.danaName ?? "Nuenime Admin",
        danaActive: parsed.dana_active ?? parsed.danaActive ?? true,
      };
      await AsyncStorage.setItem(STORAGE_GATEWAY_CONFIG, JSON.stringify(config));
      return config;
    }
  } catch {}

  // 2. Fallback ke AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(STORAGE_GATEWAY_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch {}

  // 3. Fallback ke process.env
  return {
    adminWhatsapp: process.env.EXPO_PUBLIC_ADMIN_WHATSAPP || "",
    qrisUrl: process.env.EXPO_PUBLIC_QRIS_URL || "",
    qrisActive: true,
    shopeepayNumber: process.env.EXPO_PUBLIC_SHOPEEPAY_NUMBER || "",
    shopeepayName: "Nuenime Admin",
    shopeepayActive: true,
    gopayNumber: process.env.EXPO_PUBLIC_GOPAY_NUMBER || "",
    gopayName: "Nuenime Admin",
    gopayActive: true,
    danaNumber: process.env.EXPO_PUBLIC_DANA_NUMBER || "",
    danaName: "Nuenime Admin",
    danaActive: true,
  };
}

export async function savePaymentGatewaysConfig(
  config: PaymentGatewaysConfig,
  admin: AdminUser
): Promise<void> {
  // 1. Simpan ke local cache
  await AsyncStorage.setItem(STORAGE_GATEWAY_CONFIG, JSON.stringify(config));

  // 2. Simpan ke Supabase system_configs agar langsung tersinkron ke APK Mobile
  try {
    await supabase.from("system_configs").upsert({
      key: "payment_gateways",
      value: {
        admin_whatsapp: config.adminWhatsapp,
        qris_url: config.qrisUrl,
        qris_active: config.qrisActive,
        shopeepay_number: config.shopeepayNumber,
        shopeepay_name: config.shopeepayName,
        shopeepay_active: config.shopeepayActive,
        gopay_number: config.gopayNumber,
        gopay_name: config.gopayName,
        gopay_active: config.gopayActive,
        dana_number: config.danaNumber,
        dana_name: config.danaName,
        dana_active: config.danaActive,
      },
      updated_at: new Date().toISOString(),
    });
  } catch {}

  // 3. Catat ke audit log
  await logAdminAction({
    admin,
    action: "UPDATE_PAYMENT_GATEWAYS",
    targetType: "system_config",
    targetId: "payment_gateways",
    details: config,
  });
}

// ─── 3. KATALOG PAKET CRYSTAL CRUD ───

const STORAGE_CRYSTAL_PACKAGES = "nuenime.admin.crystal_packages";

/** Normalisasi paket agar selalu punya amountFormatted & priceFormatted */
function normalizePackage(p: any): CrystalPackage {
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
}

export async function getAdminCrystalPackages(): Promise<CrystalPackage[]> {
  // 1. Coba ambil dari Supabase system_configs
  try {
    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "crystal_packages")
      .maybeSingle();

    if (!error && data?.value && Array.isArray(data.value) && data.value.length > 0) {
      const normalized = data.value.map(normalizePackage);
      await AsyncStorage.setItem(STORAGE_CRYSTAL_PACKAGES, JSON.stringify(normalized));
      return normalized;
    }
  } catch {}

  // 2. Fallback ke AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(STORAGE_CRYSTAL_PACKAGES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normalizePackage);
    }
  } catch {}

  // 3. Fallback ke konstanta default
  return CRYSTAL_PACKAGES;
}

export async function saveAdminCrystalPackages(
  packages: CrystalPackage[],
  admin: AdminUser
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_CRYSTAL_PACKAGES, JSON.stringify(packages));

  try {
    await supabase.from("system_configs").upsert({
      key: "crystal_packages",
      value: packages,
      updated_at: new Date().toISOString(),
    });
  } catch {}

  await logAdminAction({
    admin,
    action: "UPDATE_CRYSTAL_PACKAGES",
    targetType: "crystal_packages",
    targetId: "all",
    details: { totalPackages: packages.length },
  });
}

// ─── 4. USER MANAGEMENT & DETAIL ───

export const NUENIME_USER_ROLES = [
  "Super Admin",
  "Admin",
  "Developer",
  "Pen Tester",
  "Security Analyst",
  "Moderator",
  "Finance Admin",
  "Content Manager",
  "DevOps Engineer",
  "Database Manager",
  "QA Tester",
  "Auditor",
  "API Manager",
  "Community Manager",
  "Support",
  "Member",
] as const;

export type NuenimeUserRole = typeof NUENIME_USER_ROLES[number];

export function isSpecialRole(role?: string | null): boolean {
  if (!role) return false;
  return role.trim().toLowerCase() !== "member";
}

export interface AdminUserListItem {
  id: string;
  email: string;
  username: string;
  displayName: string;
  memberNumber: string;
  createdAt: string;
  crystalBalance: number;
  level: number;
  exp: number;
  status: "active" | "banned";
  isBanned: boolean;
  bannedAt?: string | null;
  banReason?: string | null;
  bannedBy?: string | null;
  role: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  equippedBorder?: string | null;
  isVip?: boolean;
  nameUpdatedAt?: string | null;
  avatarUpdatedAt?: string | null;
  bannerUpdatedAt?: string | null;
  sanctionNote?: string;
}

export async function getAdminUsersList(search?: string): Promise<AdminUserListItem[]> {
  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });

    let list: AdminUserListItem[] = [];

    if (!error && Array.isArray(profiles) && profiles.length > 0) {
      for (const p of profiles) {
        const bal = await getCrystalBalance(p.id);
        const overrideRole = await AsyncStorage.getItem(`@nuenime_user_role_${p.id}`);
        const overrideBan = await AsyncStorage.getItem(`@nuenime_user_ban_${p.id}`);
        const overrideBanReason = await AsyncStorage.getItem(`@nuenime_user_ban_reason_${p.id}`);
        const resetName = await AsyncStorage.getItem(`@nuenime_user_cd_reset_${p.id}_name`);
        const resetAvatar = await AsyncStorage.getItem(`@nuenime_user_cd_reset_${p.id}_avatar`);
        const resetBanner = await AsyncStorage.getItem(`@nuenime_user_cd_reset_${p.id}_banner`);

        const isBanned = overrideBan !== null ? overrideBan === "true" : Boolean(p.is_banned);
        const role = overrideRole || p.role || "Member";
        const banReason = overrideBanReason !== null ? overrideBanReason : (p.ban_reason || null);
        const nameUpdatedAt = resetName ? null : (p.name_updated_at || null);
        const avatarUpdatedAt = resetAvatar ? null : (p.avatar_updated_at || null);
        const bannerUpdatedAt = resetBanner ? null : (p.banner_updated_at || null);

        list.push({
          id: p.id,
          email: p.username ? `${p.username}@nuenime.user` : "user@nuenime.com",
          username: p.username || "pengguna",
          displayName: p.display_name || p.username || "Pengguna",
          memberNumber: p.member_number ? `#${String(p.member_number).padStart(4, "0")}` : "#0001",
          createdAt: p.created_at || new Date().toISOString(),
          crystalBalance: bal,
          level: p.level || 1,
          exp: p.exp || 0,
          status: isBanned ? "banned" : "active",
          isBanned,
          bannedAt: p.banned_at || null,
          banReason,
          bannedBy: p.banned_by || null,
          role,
          avatarUrl: p.avatar_url || null,
          bannerUrl: p.banner_url || null,
          equippedBorder: p.equipped_border || null,
          isVip: Boolean(p.is_vip),
          nameUpdatedAt,
          avatarUpdatedAt,
          bannerUpdatedAt,
        });
      }
    } else {
      // Fallback sample user list for testing UI
      list = [
        {
          id: "guest",
          email: "guest@nuenime.com",
          username: "Tamu Nuenime",
          displayName: "Guest User",
          memberNumber: "#0001",
          createdAt: new Date().toISOString(),
          crystalBalance: await getCrystalBalance("guest"),
          level: 3,
          exp: 150,
          status: "active",
          isBanned: false,
          role: "Member",
        },
      ];
    }

    if (search && search.trim().length > 0) {
      const q = search.toLowerCase();
      return list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.memberNumber.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
      );
    }

    return list;
  } catch {
    return [];
  }
}

/**
 * Koreksi saldo manual oleh admin (+ atau -) dengan pencatatan audit log
 */
export async function adminAdjustUserBalance(params: {
  userId: string;
  amount: number;
  reason: string;
  admin: AdminUser;
}): Promise<{ success: boolean; error?: string; before: number; after: number }> {
  if (!canManageUsers(params.admin.role)) {
    return { success: false, error: "Role Anda tidak memiliki izin penyesuaian saldo.", before: 0, after: 0 };
  }

  if (!params.reason || params.reason.trim().length === 0) {
    return { success: false, error: "Alasan penyesuaian saldo wajib diisi.", before: 0, after: 0 };
  }

  const before = await getCrystalBalance(params.userId);
  const after = before + params.amount;

  if (after < 0) {
    return { success: false, error: "Saldo tidak boleh bernilai negatif.", before, after };
  }

  await setCrystalBalance(params.userId, after);

  await logAdminAction({
    admin: params.admin,
    action: "ADJUST_BALANCE",
    targetType: "user",
    targetId: params.userId,
    details: {
      amount: params.amount,
      before,
      after,
      reason: params.reason,
    },
  });

  return { success: true, before, after };
}

/**
 * Reset cooldown (Nama, Avatar, Banner, atau Semua)
 */
export async function adminResetUserCooldown(params: {
  userId: string;
  type: "name" | "avatar" | "banner" | "all";
  admin: AdminUser;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!canManageUsers(params.admin.role)) {
    return { success: false, error: "Role Anda tidak memiliki izin reset cooldown." };
  }

  try {
    // 1. Simpan local override & bersihkan cache cooldown
    if (params.type === "all") {
      await Promise.all([
        AsyncStorage.setItem(`@nuenime_user_cd_reset_${params.userId}_name`, "reset").catch(() => {}),
        AsyncStorage.setItem(`@nuenime_user_cd_reset_${params.userId}_avatar`, "reset").catch(() => {}),
        AsyncStorage.setItem(`@nuenime_user_cd_reset_${params.userId}_banner`, "reset").catch(() => {}),
        AsyncStorage.removeItem(`aniraku.cooldown.${params.userId}.name`).catch(() => {}),
        AsyncStorage.removeItem(`aniraku.cooldown.${params.userId}.avatar`).catch(() => {}),
        AsyncStorage.removeItem(`aniraku.cooldown.${params.userId}.banner`).catch(() => {}),
      ]);
    } else {
      await Promise.all([
        AsyncStorage.setItem(`@nuenime_user_cd_reset_${params.userId}_${params.type}`, "reset").catch(() => {}),
        AsyncStorage.removeItem(`aniraku.cooldown.${params.userId}.${params.type}`).catch(() => {}),
      ]);
    }

    // 2. Coba via RPC Security Definer (bebas pembatasan RLS)
    let dbUpdated = false;
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_reset_user_cooldown", {
        p_user_id: params.userId,
        p_type: params.type,
      });
      if (!rpcErr && rpcData && rpcData.success) {
        dbUpdated = true;
      }
    } catch {}

    // 3. Fallback direct update
    if (!dbUpdated) {
      const updateObj: Record<string, any> = { updated_at: new Date().toISOString() };
      if (params.type === "all") {
        updateObj.name_updated_at = null;
        updateObj.avatar_updated_at = null;
        updateObj.banner_updated_at = null;
      } else if (params.type === "name") {
        updateObj.name_updated_at = null;
      } else if (params.type === "avatar") {
        updateObj.avatar_updated_at = null;
      } else if (params.type === "banner") {
        updateObj.banner_updated_at = null;
      }

      const { data, error } = await supabase
        .from("profiles")
        .update(updateObj)
        .eq("id", params.userId)
        .select();

      if (!error && Array.isArray(data) && data.length > 0) {
        dbUpdated = true;
      }
    }

    await logAdminAction({
      admin: params.admin,
      action: `RESET_COOLDOWN_${params.type.toUpperCase()}`,
      targetType: "user",
      targetId: params.userId,
      details: { reason: params.reason, dbUpdated },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Mengubah role pengguna dengan proteksi Super Admin terakhir dan audit logging
 */
export async function adminUpdateUserRole(params: {
  userId: string;
  targetUsername: string;
  previousRole: string;
  newRole: string;
  admin: AdminUser;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (params.admin.role !== "super_admin") {
    return { success: false, error: "Hanya Super Admin yang berwenang mengubah role akun." };
  }

  try {
    // 1. Simpan ke local override agar UI & auth langsung aktif seketika
    await AsyncStorage.setItem(`@nuenime_user_role_${params.userId}`, params.newRole);

    // 2. Coba via RPC Security Definer (bebas pembatasan RLS)
    let dbUpdated = false;
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_update_user_role", {
        p_user_id: params.userId,
        p_new_role: params.newRole,
      });
      if (!rpcErr && rpcData && (rpcData.success || rpcData.id)) {
        dbUpdated = true;
      }
    } catch {}

    // 3. Fallback direct update jika RPC belum terpasang
    if (!dbUpdated) {
      const { data, error } = await supabase
        .from("profiles")
        .update({ role: params.newRole, updated_at: new Date().toISOString() })
        .eq("id", params.userId)
        .select();

      if (!error && Array.isArray(data) && data.length > 0) {
        dbUpdated = true;
      }
    }

    await logAdminAction({
      admin: params.admin,
      action: "UPDATE_USER_ROLE",
      targetType: "user",
      targetId: params.userId,
      details: {
        targetUsername: params.targetUsername,
        previousRole: params.previousRole,
        newRole: params.newRole,
        reason: params.reason || "Perubahan role melalui dashboard admin",
        dbUpdated,
      },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal memperbarui role pengguna." };
  }
}

/**
 * Menukar nomor member (#ID) antara dua akun (misal #0001 ditukar dengan #0005)
 */
export async function adminSwapMemberNumbers(params: {
  userAId: string;
  userBId: string;
  reason?: string;
  admin: AdminUser;
}): Promise<{ success: boolean; error?: string }> {
  if (params.admin.role !== "super_admin") {
    return { success: false, error: "Hanya Super Admin yang berwenang menukar nomor member." };
  }

  if (params.userAId === params.userBId) {
    return { success: false, error: "Tidak dapat menukar nomor member dengan akun yang sama." };
  }

  try {
    let dbUpdated = false;

    // 1. Coba via RPC Security Definer (aman dari bentrok UNIQUE constraint)
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_swap_member_numbers", {
        p_user_a_id: params.userAId,
        p_user_b_id: params.userBId,
      });
      if (!rpcErr && rpcData && rpcData.success) {
        dbUpdated = true;
      }
    } catch {}

    // 2. Fallback direct swap jika RPC belum dijalankan
    if (!dbUpdated) {
      const [{ data: userA }, { data: userB }] = await Promise.all([
        supabase.from("profiles").select("id, username, member_number").eq("id", params.userAId).single(),
        supabase.from("profiles").select("id, username, member_number").eq("id", params.userBId).single(),
      ]);

      if (!userA || !userB) {
        return { success: false, error: "Salah satu data profil pengguna tidak ditemukan." };
      }

      const numA = userA.member_number;
      const numB = userB.member_number;

      if (numA === null || numB === null) {
        return { success: false, error: "Nomor member pengguna belum terisi." };
      }

      // Hindari collision unique constraint dengan temporary unique number
      const tempNum = 900000000 + Math.floor(Math.random() * 90000000) + Number(numA);
      await supabase.from("profiles").update({ member_number: tempNum, updated_at: new Date().toISOString() }).eq("id", params.userAId);
      await supabase.from("profiles").update({ member_number: numA, updated_at: new Date().toISOString() }).eq("id", params.userBId);
      await supabase.from("profiles").update({ member_number: numB, updated_at: new Date().toISOString() }).eq("id", params.userAId);
      dbUpdated = true;
    }

    await logAdminAction({
      admin: params.admin,
      action: "SWAP_MEMBER_NUMBERS",
      targetType: "user",
      targetId: params.userAId,
      details: {
        userAId: params.userAId,
        userBId: params.userBId,
        reason: params.reason || "Penukaran nomor member (#ID) antar akun oleh Super Admin",
        dbUpdated,
      },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal menukar nomor member." };
  }
}

/**
 * Blokir atau buka blokir akun pengguna
 */
export async function adminSetUserBanStatus(params: {
  userId: string;
  targetUsername: string;
  isBanned: boolean;
  reason: string;
  admin: AdminUser;
}): Promise<{ success: boolean; error?: string }> {
  if (!canManageUsers(params.admin.role)) {
    return { success: false, error: "Role Anda tidak memiliki izin moderasi status akun." };
  }

  if (params.isBanned && (!params.reason || params.reason.trim().length === 0)) {
    return { success: false, error: "Alasan pemblokiran wajib diisi." };
  }

  try {
    // 1. Simpan ke local override
    await AsyncStorage.setItem(`@nuenime_user_ban_${params.userId}`, String(params.isBanned));
    if (params.isBanned) {
      await AsyncStorage.setItem(`@nuenime_user_ban_reason_${params.userId}`, params.reason.trim());
    } else {
      await AsyncStorage.removeItem(`@nuenime_user_ban_reason_${params.userId}`);
    }

    // 2. Coba RPC Security Definer
    let dbUpdated = false;
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_set_user_ban_status", {
        p_user_id: params.userId,
        p_is_banned: params.isBanned,
        p_reason: params.isBanned ? params.reason.trim() : null,
        p_banned_by: params.admin.username,
      });
      if (!rpcErr && rpcData && (rpcData.success || rpcData.id)) {
        dbUpdated = true;
      }
    } catch {}

    // 3. Fallback direct update
    if (!dbUpdated) {
      const updatePayload: Record<string, any> = {
        is_banned: params.isBanned,
        banned_at: params.isBanned ? new Date().toISOString() : null,
        ban_reason: params.isBanned ? params.reason.trim() : null,
        banned_by: params.isBanned ? params.admin.username : null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", params.userId)
        .select();

      if (!error && Array.isArray(data) && data.length > 0) {
        dbUpdated = true;
      }
    }

    await logAdminAction({
      admin: params.admin,
      action: params.isBanned ? "BAN_USER" : "UNBAN_USER",
      targetType: "user",
      targetId: params.userId,
      details: {
        targetUsername: params.targetUsername,
        reason: params.reason,
        dbUpdated,
      },
    });

    // Kirim notifikasi sistem status akun ke pengguna
    try {
      await supabase.from("notifications").insert({
        user_id: params.userId,
        title: params.isBanned ? "Akun Anda Diblokir ⚠️" : "Akun Anda Telah Dipulihkan ✅",
        message: params.isBanned
          ? `Akun Anda telah dinonaktifkan oleh administrator. Alasan: ${params.reason.trim()}`
          : "Blokir akun Anda telah dibuka oleh administrator. Selamat kembali ke Nuenime!",
        type: params.isBanned ? "account_banned" : "account_unbanned",
        read: false,
      });
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal mengubah status blokir akun." };
  }
}

export type UserHistoryCategory = "all" | "account" | "crystal" | "activity" | "admin" | "gacha";

export interface UserHistoryItem {
  id: string;
  category: "account" | "crystal" | "activity" | "admin" | "gacha";
  title: string;
  description: string;
  details?: Record<string, any>;
  createdAt: string;
  badge?: string;
  badgeColor?: string;
}

export async function getUserFullHistory(params: {
  userId: string;
  category: UserHistoryCategory;
  search?: string;
}): Promise<UserHistoryItem[]> {
  const items: UserHistoryItem[] = [];

  try {
    // 1. Crystal Transactions & Top Up
    if (params.category === "all" || params.category === "crystal") {
      const { data: topups } = await supabase
        .from("topup_transactions")
        .select("*")
        .eq("user_id", params.userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (topups) {
        for (const t of topups) {
          items.push({
            id: `TX-${t.id}`,
            category: "crystal",
            title: `Top Up ${t.package_name || "Crystal"} (+${t.crystal_amount} Crystal)`,
            description: `Metode: ${t.payment_method?.toUpperCase()} • Total: ${t.total_payment ? `Rp ${t.total_payment.toLocaleString("id-ID")}` : "-"} • Status: ${t.status}`,
            createdAt: t.created_at || new Date().toISOString(),
            badge: t.status === "berhasil" ? "Sukses" : t.status,
            badgeColor: t.status === "berhasil" ? "#10B981" : "#F59E0B",
          });
        }
      }

      // Pembelian border avatar
      const { data: borderPurchases } = await supabase
        .from("user_border_purchases")
        .select("*")
        .eq("user_id", params.userId)
        .order("purchased_at", { ascending: false })
        .limit(50);

      if (borderPurchases) {
        for (const b of borderPurchases) {
          items.push({
            id: `BORDER-${b.id || b.border_id}`,
            category: "crystal",
            title: `Beli Border: ${b.border_name || b.border_id} (-${b.price_paid || 0} Crystal)`,
            description: `Tingkat: ${b.rarity || "Custom"} • Pembelian resmi katalog`,
            createdAt: b.purchased_at || new Date().toISOString(),
            badge: "Border",
            badgeColor: "#38BDF8",
          });
        }
      }
    }

    // 2. Gacha Transactions
    if (params.category === "all" || params.category === "gacha") {
      const { data: gachaTx } = await supabase
        .from("gacha_transactions")
        .select("*")
        .eq("user_id", params.userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (gachaTx) {
        for (const g of gachaTx) {
          items.push({
            id: `GACHA-${g.id}`,
            category: "gacha",
            title: `Spin Gacha ${g.summon_type === "multi_10" ? "10x Tarikan" : "1x Tarikan"} (-${g.cost} Crystal)`,
            description: `Hasil: ${Array.isArray(g.results) ? g.results.map((r: any) => r.name || r.bannerName || "Item").join(", ") : "Hadiah diperoleh"}`,
            createdAt: g.created_at || new Date().toISOString(),
            badge: "Gacha Spin",
            badgeColor: "#A855F7",
          });
        }
      }
    }

    // 3. Aktivitas Aplikasi (Watch History & Komentar)
    if (params.category === "all" || params.category === "activity") {
      const { data: watchHist } = await supabase
        .from("watch_history")
        .select("*")
        .eq("user_id", params.userId)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (watchHist) {
        for (const w of watchHist) {
          items.push({
            id: `WATCH-${w.id}`,
            category: "activity",
            title: `Menonton: ${w.anime_title || "Anime"} Ep ${w.episode_number}`,
            description: `Progress: ${Math.round(w.progress || 0)}s / ${Math.round(w.duration || 0)}s`,
            createdAt: w.updated_at || new Date().toISOString(),
            badge: "Streaming",
            badgeColor: "#06B6D4",
          });
        }
      }

      const { data: comments } = await supabase
        .from("comments")
        .select("*")
        .eq("user_id", params.userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (comments) {
        for (const c of comments) {
          items.push({
            id: `CMT-${c.id}`,
            category: "activity",
            title: `Komentar di Episode ${c.episode_number || 1}`,
            description: c.content || "-",
            createdAt: c.created_at || new Date().toISOString(),
            badge: "Komentar",
            badgeColor: "#8B5CF6",
          });
        }
      }
    }

    // 4. Riwayat Administrasi (Audit logs on this user)
    if (params.category === "all" || params.category === "admin" || params.category === "account") {
      const { data: audits } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .eq("target_id", params.userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (audits) {
        for (const a of audits) {
          const isRole = a.action?.includes("ROLE");
          const isBan = a.action?.includes("BAN");
          const isBal = a.action?.includes("BALANCE");

          items.push({
            id: `AUDIT-${a.id}`,
            category: isRole || isBan ? "account" : isBal ? "crystal" : "admin",
            title: `[Tindakan Admin] ${a.action}`,
            description: `Pelaksana: ${a.admin_email || "Admin"} • Catatan: ${a.details?.reason || JSON.stringify(a.details || {})}`,
            createdAt: a.created_at || new Date().toISOString(),
            badge: a.action,
            badgeColor: isBan ? "#EF4444" : isBal ? "#38BDF8" : isRole ? "#F59E0B" : "#A855F7",
          });
        }
      }
    }
  } catch {}

  // Urutkan dari terbaru ke terlama
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase();
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q) ||
        it.id.toLowerCase().includes(q)
    );
  }

  return items;
}

export interface UserFriendItem {
  id: string;
  friendId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  status: "accepted" | "pending";
  createdAt: string;
  level?: number;
  exp?: number;
  role?: string;
  isVip?: boolean;
  memberNumber?: string;
}

export async function getUserFriendsList(userId: string, search?: string): Promise<UserFriendItem[]> {
  if (!userId) return [];
  try {
    // 1. Ambil hubungan dari tabel friendships (baik sebagai user_id pengirim maupun friend_id penerima)
    const [sentRes, receivedRes] = await Promise.all([
      supabase
        .from("friendships")
        .select("id, user_id, friend_id, status, created_at")
        .eq("user_id", userId),
      supabase
        .from("friendships")
        .select("id, user_id, friend_id, status, created_at")
        .eq("friend_id", userId),
    ]);

    const rows: any[] = [...(sentRes.data || []), ...(receivedRes.data || [])];

    // Jika Promise.all kosong tapi mungkin or(...) berhasil, atau sebaliknya
    if (rows.length === 0) {
      const { data: orRows } = await supabase
        .from("friendships")
        .select("id, user_id, friend_id, status, created_at")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
      if (orRows && orRows.length > 0) {
        rows.push(...orRows);
      }
    }

    if (rows.length === 0) {
      return [];
    }

    const otherUserMap = new Map<
      string,
      { friendshipId: string; status: "accepted" | "pending"; createdAt: string }
    >();

    rows.forEach((r: any) => {
      const otherId = r.user_id === userId ? r.friend_id : r.user_id;
      if (otherId && otherId !== userId) {
        const existing = otherUserMap.get(otherId);
        // Prioritaskan status accepted jika ada duplikat
        if (!existing || r.status === "accepted") {
          otherUserMap.set(otherId, {
            friendshipId: r.id,
            status: (r.status as "accepted" | "pending") || "accepted",
            createdAt: r.created_at || new Date().toISOString(),
          });
        }
      }
    });

    const otherIds = Array.from(otherUserMap.keys());
    if (otherIds.length === 0) return [];

    const { data: profiles, error: pError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, level, exp, role, is_vip, member_number")
      .in("id", otherIds);

    if (pError || !profiles || profiles.length === 0) {
      return otherIds.map((id) => {
        const meta = otherUserMap.get(id);
        return {
          id: meta?.friendshipId || id,
          friendId: id,
          username: "Pengguna",
          displayName: "Pengguna Nuenime",
          avatarUrl: null,
          status: meta?.status || "accepted",
          createdAt: meta?.createdAt || new Date().toISOString(),
          level: 1,
          exp: 0,
          role: "Member",
          isVip: false,
          memberNumber: "#0001",
        };
      });
    }

    let list: UserFriendItem[] = profiles.map((p: any) => {
      const meta = otherUserMap.get(p.id);
      return {
        id: meta?.friendshipId || p.id,
        friendId: p.id,
        username: p.username || "pengguna",
        displayName: p.display_name || p.username || "Pengguna Nuenime",
        avatarUrl: p.avatar_url || null,
        status: meta?.status || "accepted",
        createdAt: meta?.createdAt || new Date().toISOString(),
        level: Number(p.level) || 1,
        exp: Number(p.exp) || 0,
        role: p.role || "Member",
        isVip: Boolean(p.is_vip),
        memberNumber: p.member_number ? `#${String(p.member_number).padStart(4, "0")}` : "#0001",
      };
    });

    if (search && search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.username.toLowerCase().includes(q) ||
          f.displayName.toLowerCase().includes(q)
      );
    }

    return list;
  } catch (err) {
    console.warn("[admin-service] getUserFriendsList error:", err);
    return [];
  }
}

/**
 * Memutuskan hubungan pertemanan antar user langsung dari panel admin
 */
export async function adminDeleteFriendship(params: {
  friendshipId: string;
  userId: string;
  friendId: string;
  admin: AdminUser;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    let query = supabase.from("friendships").delete();
    if (params.friendshipId) {
      query = query.eq("id", params.friendshipId);
    } else {
      query = query.or(
        `and(user_id.eq.${params.userId},friend_id.eq.${params.friendId}),and(user_id.eq.${params.friendId},friend_id.eq.${params.userId})`
      );
    }

    const { error } = await query;
    if (error) throw error;

    await logAdminAction({
      admin: params.admin,
      action: "DELETE_FRIENDSHIP",
      targetType: "friendship",
      targetId: params.friendshipId || `${params.userId}_${params.friendId}`,
      details: {
        userId: params.userId,
        friendId: params.friendId,
        reason: params.reason || "Diputuskan oleh Administrator",
      },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal menghapus pertemanan." };
  }
}

/**
 * Menghubungkan 2 pengguna menjadi teman langsung dari panel admin
 */
export async function adminAddFriendship(params: {
  userId: string;
  targetUserId: string;
  admin: AdminUser;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!params.userId || !params.targetUserId || params.userId === params.targetUserId) {
      return { success: false, error: "Pilih 2 akun pengguna yang berbeda." };
    }

    // Periksa apakah sudah ada entri
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status")
      .or(
        `and(user_id.eq.${params.userId},friend_id.eq.${params.targetUserId}),and(user_id.eq.${params.targetUserId},friend_id.eq.${params.userId})`
      );

    if (existing && existing.length > 0) {
      await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", existing[0].id);
    } else {
      const { error: insErr } = await supabase.from("friendships").insert({
        user_id: params.userId,
        friend_id: params.targetUserId,
        status: "accepted",
      });
      if (insErr) throw insErr;
    }

    await logAdminAction({
      admin: params.admin,
      action: "ADD_FRIENDSHIP",
      targetType: "friendship",
      targetId: `${params.userId}_${params.targetUserId}`,
      details: {
        userId: params.userId,
        targetUserId: params.targetUserId,
        reason: params.reason || "Dihubungkan langsung oleh Administrator",
      },
    });

    try {
      await supabase.from("notifications").insert([
        {
          user_id: params.userId,
          title: "Pertemanan Baru Terhubung 🎉",
          message: "Akun Anda telah dihubungkan dengan teman baru oleh administrator Nuenime.",
          type: "friend_request_accepted",
          read: false,
        },
        {
          user_id: params.targetUserId,
          title: "Pertemanan Baru Terhubung 🎉",
          message: "Akun Anda telah dihubungkan dengan teman baru oleh administrator Nuenime.",
          type: "friend_request_accepted",
          read: false,
        },
      ]);
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal menghubungkan pertemanan." };
  }
}

// ─── 5. KATALOG 45 BORDER AVATAR MANAGEMENT ───

const STORAGE_BORDERS_OVERRIDE = "nuenime.admin.borders_override";

/**
 * Mengambil seluruh katalog border dari Supabase avatar_borders_config secara dinamis & fresh.
 * 100% database-driven tanpa data statis hardcoded.
 */
export async function getAdminBordersCatalog(): Promise<AvatarBorder[]> {
  try {
    return await fetchLiveBorderCatalog();
  } catch {
    return [];
  }
}

export interface CreateBorderInput {
  id: string;
  name: string;
  rarity: BorderRarity;
  assetUrl?: string | null;
  innerRatio?: number;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  isReleased?: boolean;
  description?: string;
  priceCrystal?: number | null;
}

/**
 * Menambahkan koleksi border baru ke database Supabase avatar_borders_config.
 */
export async function createAdminBorder(
  input: CreateBorderInput,
  admin: AdminUser
): Promise<{ success: boolean; border?: AvatarBorder; error?: string }> {
  try {
    const cleanId = input.id.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!cleanId) {
      return { success: false, error: "ID border tidak boleh kosong (gunakan huruf kecil, angka, atau underscore)." };
    }
    if (!input.name.trim()) {
      return { success: false, error: "Nama border tidak boleh kosong." };
    }

    const hasUrl = !!(input.assetUrl && input.assetUrl.trim().length > 0);
    const finalReleased = input.isReleased ?? hasUrl;

    const rowPayload = {
      id: cleanId,
      name: input.name.trim(),
      rarity: input.rarity,
      asset_url: input.assetUrl?.trim() || null,
      inner_ratio: input.innerRatio ?? 0.74,
      offset_x: input.offsetX ?? 0.0,
      offset_y: input.offsetY ?? 0.0,
      scale: input.scale ?? 1.0,
      is_released: finalReleased,
      description: input.description?.trim() || null,
      price_crystal: input.priceCrystal ? Number(input.priceCrystal) : null,
      is_active: true,
      sort_order: 100,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("avatar_borders_config")
      .upsert(rowPayload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const createdBorder: AvatarBorder = {
      id: data.id,
      name: data.name,
      rarity: data.rarity as BorderRarity,
      assetUrl: data.asset_url ?? null,
      innerRatio: data.inner_ratio ? Number(data.inner_ratio) : 0.74,
      offsetX: data.offset_x ? Number(data.offset_x) : 0.0,
      offsetY: data.offset_y ? Number(data.offset_y) : 0.0,
      scale: data.scale ? Number(data.scale) : 1.0,
      isReleased: data.is_released ?? false,
      description: data.description,
      priceCrystal: data.price_crystal ? Number(data.price_crystal) : null,
      isActive: data.is_active ?? true,
    };

    updateLiveBorderInCache(createdBorder);

    await logAdminAction({
      admin,
      action: "CREATE_BORDER",
      targetType: "border",
      targetId: cleanId,
      details: { border: createdBorder },
    });

    return { success: true, border: createdBorder };
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Gagal menambahkan border baru" };
  }
}

/**
 * Menghapus border secara permanen dari katalog Supabase avatar_borders_config dan cache lokal.
 * Secara otomatis mendeteksi pengguna yang pernah membeli border ini dan mengirimkan
 * reward pengembalian crystal ke kotak masuk (Mailbox) serta notifikasi klaim mereka.
 */
export async function deleteAdminBorder(
  borderId: string,
  admin: AdminUser
): Promise<{ success: boolean; mode: "deleted" | "soft_deactivated"; message: string; refundedUsersCount?: number }> {
  try {
    const borderObj = getBorderById(borderId);
    const borderName = borderObj?.name || borderId;
    const defaultRefundPrice = borderObj?.priceCrystal || (borderObj ? (BORDER_RARITY_PRICES[borderObj.rarity] || 2000) : 2000);

    // 1. Ambil data semua pengguna yang pernah membeli border ini untuk dikembalikan crystal-nya
    let purchasers: { user_id: string; border_name: string; price_paid: number }[] = [];
    try {
      const { data } = await supabase
        .from("user_border_purchases")
        .select("user_id, border_name, price_paid")
        .eq("border_id", borderId);

      if (Array.isArray(data) && data.length > 0) {
        purchasers = data;
      }
    } catch {}

    // 2. Kirim otomatis notifikasi & reward pengembalian crystal ke kotak masuk (Mailbox) setiap user
    let refundedCount = 0;
    if (purchasers.length > 0) {
      for (const p of purchasers) {
        if (!p.user_id) continue;
        const refundAmt = p.price_paid && p.price_paid > 0 ? p.price_paid : defaultRefundPrice;
        await createBorderCompensationGift({
          userId: p.user_id,
          borderId,
          borderName: p.border_name || borderName,
          refundAmount: refundAmt,
          admin,
        });
        refundedCount++;
      }
    }

    // 3. Reset equipped_border pada profile user jika ada yang sedang memakai border ini
    try {
      await supabase
        .from("profiles")
        .update({ equipped_border: null })
        .eq("equipped_border", borderId);
    } catch {}

    // 4. Bersihkan kepemilikan dari user_border_purchases
    try {
      await supabase
        .from("user_border_purchases")
        .delete()
        .eq("border_id", borderId);
    } catch {}

    // 5. Hapus langsung dari tabel avatar_borders_config
    const { error } = await supabase
      .from("avatar_borders_config")
      .delete()
      .eq("id", borderId);

    if (error) {
      console.warn("deleteAdminBorder delete error:", error.message);
      // Fallback: jika delete dihalangi foreign key, update status menjadi nonaktif
      await supabase
        .from("avatar_borders_config")
        .update({ is_released: false, is_active: false })
        .eq("id", borderId);
    }

    // 6. Hapus dari in-memory cache dan disk storage
    removeLiveBorderFromCache(borderId);

    await logAdminAction({
      admin,
      action: "DELETE_BORDER",
      targetType: "border",
      targetId: borderId,
      details: { borderId, refundedCount, borderName },
    });

    const refundMsg = refundedCount > 0
      ? ` Kompensasi pengembalian crystal telah dikirimkan ke kotak masuk ${refundedCount} pengguna yang pernah membelinya.`
      : "";

    return {
      success: true,
      mode: "deleted",
      message: `Border "${borderName}" berhasil dihapus permanen.${refundMsg}`,
      refundedUsersCount: refundedCount,
    };
  } catch (e: any) {
    removeLiveBorderFromCache(borderId);
    return {
      success: false,
      mode: "deleted",
      message: e?.message ?? "Gagal memproses penghapusan border",
    };
  }
}

/**
 * Memperbarui pengaturan border di Supabase avatar_borders_config.
 * Aturan otomatis: assetUrl diisi → isReleased true; dikosongkan → false.
 */
export async function updateAdminBorder(
  borderId: string,
  updates: Partial<{
    name: string;
    assetUrl: string | null;
    innerRatio: number;
    offsetX: number;
    offsetY: number;
    scale: number;
    isReleased: boolean;
    description: string;
    priceCrystal: number | null;
    isActive: boolean;
  }>,
  admin: AdminUser
): Promise<AvatarBorder | null> {
  let finalIsReleased = updates.isReleased;
  if (finalIsReleased === undefined && updates.assetUrl !== undefined) {
    finalIsReleased = !!(updates.assetUrl && updates.assetUrl.trim().length > 0);
  }

  const dbPayload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) dbPayload.name = updates.name;
  if (updates.assetUrl !== undefined) dbPayload.asset_url = updates.assetUrl || null;
  if (updates.innerRatio !== undefined) dbPayload.inner_ratio = updates.innerRatio;
  if (updates.offsetX !== undefined) dbPayload.offset_x = updates.offsetX;
  if (updates.offsetY !== undefined) dbPayload.offset_y = updates.offsetY;
  if (updates.scale !== undefined) dbPayload.scale = updates.scale;
  if (finalIsReleased !== undefined) dbPayload.is_released = finalIsReleased;
  if (updates.description !== undefined) dbPayload.description = updates.description;
  if (updates.priceCrystal !== undefined) dbPayload.price_crystal = updates.priceCrystal;
  if (updates.isActive !== undefined) dbPayload.is_active = updates.isActive;

  try {
    const currentBorder = getBorderById(borderId);
    const { data, error } = await supabase
      .from("avatar_borders_config")
      .upsert({
        id: borderId,
        name: updates.name ?? currentBorder?.name ?? borderId,
        rarity: currentBorder?.rarity ?? "Normal",
        sort_order: 0,
        ...dbPayload,
      })
      .select()
      .single();

    if (error) { console.warn("updateAdminBorder error:", error.message); return null; }

    const updatedBorder: AvatarBorder = {
      id: data.id,
      name: data.name,
      rarity: data.rarity,
      assetUrl: data.asset_url ?? null,
      innerRatio: data.inner_ratio ? Number(data.inner_ratio) : (currentBorder?.innerRatio ?? 0.74),
      offsetX: data.offset_x ? Number(data.offset_x) : (currentBorder?.offsetX ?? 0.0),
      offsetY: data.offset_y ? Number(data.offset_y) : (currentBorder?.offsetY ?? 0.0),
      scale: data.scale ? Number(data.scale) : (currentBorder?.scale ?? 1.0),
      isReleased: data.is_released ?? false,
      description: data.description,
      priceCrystal: data.price_crystal ? Number(data.price_crystal) : null,
      isActive: data.is_active ?? true,
    } as AvatarBorder;

    updateLiveBorderInCache(updatedBorder);

    await logAdminAction({
      admin,
      action: "UPDATE_BORDER",
      targetType: "border",
      targetId: borderId,
      details: { updates, finalIsReleased },
    });

    return updatedBorder;
  } catch (e) {
    console.warn("updateAdminBorder exception:", e);
    return null;
  }
}

// ─── 6. GACHA & CRYSTAL STORE CONFIG ───

export interface GachaConfig {
  costSingle: number;
  costMulti: number;
  rates: {
    mythic: number;
    legends: number;
    epic: number;
    rare: number;
    normal: number;
  };
  bannerTitle: string;
  bannerDesc: string;
}

const STORAGE_GACHA_CONFIG = "nuenime.admin.gacha_config";

export async function getAdminGachaConfig(): Promise<GachaConfig> {
  try {
    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "gacha_config")
      .maybeSingle();

    if (!error && data?.value && typeof data.value === "object") {
      const val = data.value as any;
      const res: GachaConfig = {
        costSingle: typeof val.cost_single === "number" ? val.cost_single : (val.costSingle ?? 1000),
        costMulti: typeof val.cost_multi === "number" ? val.cost_multi : (val.costMulti ?? 9000),
        rates: {
          mythic: typeof val.rates?.mythic === "number" ? val.rates.mythic : 2.0,
          legends: typeof val.rates?.legends === "number" ? val.rates.legends : 8.0,
          epic: typeof val.rates?.epic === "number" ? val.rates.epic : 20.0,
          rare: typeof val.rates?.rare === "number" ? val.rates.rare : 30.0,
          normal: typeof val.rates?.normal === "number" ? val.rates.normal : 40.0,
        },
        bannerTitle: typeof val.banner_title === "string" ? val.banner_title : (val.bannerTitle ?? "Bintang Istana Malam"),
        bannerDesc: typeof val.banner_desc === "string" ? val.banner_desc : (val.bannerDesc ?? "Wallpaper edisi terbatas & bingkai mistis malam purnama."),
      };
      await AsyncStorage.setItem(STORAGE_GACHA_CONFIG, JSON.stringify(res));
      return res;
    }
  } catch {}

  try {
    const raw = await AsyncStorage.getItem(STORAGE_GACHA_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch {}

  return {
    costSingle: 1000,
    costMulti: 9000,
    rates: {
      mythic: 2.0,
      legends: 8.0,
      epic: 20.0,
      rare: 30.0,
      normal: 40.0,
    },
    bannerTitle: "Bintang Istana Malam",
    bannerDesc: "Wallpaper edisi terbatas & bingkai mistis malam purnama.",
  };
}

export async function saveAdminGachaConfig(config: GachaConfig, admin: AdminUser): Promise<void> {
  await AsyncStorage.setItem(STORAGE_GACHA_CONFIG, JSON.stringify(config));
  try {
    await supabase.from("system_configs").upsert({
      key: "gacha_config",
      value: {
        cost_single: config.costSingle,
        cost_multi: config.costMulti,
        rates: config.rates,
        banner_title: config.bannerTitle,
        banner_desc: config.bannerDesc,
      },
      updated_at: new Date().toISOString(),
    });
  } catch {}

  await logAdminAction({
    admin,
    action: "UPDATE_GACHA_CONFIG",
    targetType: "gacha",
    targetId: "banner",
    details: config,
  });
}

// ─── 7. SYSTEM & APK UPDATE CONFIG ───

export interface AppReleaseConfig {
  version: string;
  apkUrl: string;
  changelog: string;
  forceUpdate: boolean;
  minVersion: string;
}

export interface MaintenanceModeConfig {
  isActive: boolean;
  message: string;
  endsAt?: string | null;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
  iconUrl?: string;
}

const STORAGE_APP_RELEASE = "nuenime.admin.app_release";
const STORAGE_MAINTENANCE = "nuenime.admin.maintenance";
const STORAGE_APP_ANNOUNCEMENT = "nuenime.admin.app_announcement";

// ─── GITHUB RELEASE AUTO-SYNC HELPER ───
export interface GitHubReleaseSyncResult {
  success: boolean;
  version: string;
  apkUrl: string;
  changelog: string;
  assetName?: string;
  assetSize?: number;
  assetSizeFormatted?: string;
  publishedAt?: string;
  releaseTitle?: string;
  error?: string;
}

export async function fetchGitHubReleaseInfo(inputUrl: string): Promise<GitHubReleaseSyncResult> {
  const clean = inputUrl.trim();
  if (!clean) {
    return { success: false, version: "", apkUrl: "", changelog: "", error: "Tautan GitHub tidak boleh kosong" };
  }

  try {
    let owner = "nuenimegrup-png";
    let repo = "NuenimeApp";
    let tag = "";

    const matchTag = clean.match(/github\.com\/([^\/]+)\/([^\/]+)\/releases\/tag\/([^\/\s#?]+)/i);
    const matchRepo = clean.match(/github\.com\/([^\/]+)\/([^\/\s#?]+)/i);
    const matchShort = clean.match(/^([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)$/);

    if (matchTag) {
      owner = matchTag[1];
      repo = matchTag[2].replace(/\.git$/i, "");
      tag = matchTag[3];
    } else if (matchRepo) {
      owner = matchRepo[1];
      repo = matchRepo[2].replace(/\.git$/i, "");
    } else if (matchShort) {
      owner = matchShort[1];
      repo = matchShort[2];
    }

    const apiUrl = tag && tag !== "latest"
      ? `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`
      : `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return {
          success: false,
          version: "",
          apkUrl: "",
          changelog: "",
          error: `Release tidak ditemukan di GitHub repository ${owner}/${repo}. Pastikan tag rilis publik sudah dibuat.`,
        };
      }
      return {
        success: false,
        version: "",
        apkUrl: "",
        changelog: "",
        error: `Gagal mengambil data dari GitHub API (HTTP ${res.status}).`,
      };
    }

    const data = await res.json();
    const tagName = String(data.tag_name || "").trim();
    const version = tagName.replace(/^v/i, "") || "1.0.0";
    const changelog = data.body || data.name || `Pembaruan Nuenime v${version}`;

    let apkDownloadUrl = data.html_url || clean;
    let assetName = "";
    let assetSizeFormatted = "";
    let assetSize: number | undefined;

    if (Array.isArray(data.assets) && data.assets.length > 0) {
      const apkAsset = data.assets.find(
        (a: any) => typeof a.name === "string" && a.name.toLowerCase().endsWith(".apk")
      );
      if (apkAsset) {
        apkDownloadUrl = apkAsset.browser_download_url;
        assetName = apkAsset.name;
        if (typeof apkAsset.size === "number") {
          assetSize = apkAsset.size;
          const mb = (apkAsset.size / (1024 * 1024)).toFixed(1);
          assetSizeFormatted = `${mb} MB`;
        }
      }
    }

    return {
      success: true,
      version,
      apkUrl: apkDownloadUrl,
      changelog,
      assetName,
      assetSize,
      assetSizeFormatted,
      publishedAt: data.published_at,
      releaseTitle: data.name || `Release ${tagName}`,
    };
  } catch (err: any) {
    return {
      success: false,
      version: "",
      apkUrl: "",
      changelog: "",
      error: err?.message || "Terjadi kesalahan saat menghubungi GitHub.",
    };
  }
}

export async function getAdminAppReleaseConfig(): Promise<AppReleaseConfig> {
  try {
    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "app_release")
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      const config: AppReleaseConfig = {
        version: parsed.version ?? "0.0.1",
        apkUrl: parsed.apk_url ?? parsed.apkUrl ?? "https://github.com/nuenimegrup-png/NuenimeApp.git",
        changelog: parsed.changelog ?? "Pembaruan sistem Nuenime.",
        forceUpdate: parsed.force_update ?? parsed.forceUpdate ?? false,
        minVersion: parsed.min_version ?? parsed.minVersion ?? "0.0.1",
      };
      await AsyncStorage.setItem(STORAGE_APP_RELEASE, JSON.stringify(config));
      return config;
    }
  } catch {}

  try {
    const raw = await AsyncStorage.getItem(STORAGE_APP_RELEASE);
    if (raw) return JSON.parse(raw);
  } catch {}

  return {
    version: "0.0.1",
    apkUrl: "https://github.com/nuenimegrup-png/NuenimeApp.git",
    changelog: "Pembaruan perdana Nuenime dengan fitur Avatar Borders & Dylan Crystal Store.",
    forceUpdate: false,
    minVersion: "0.0.1",
  };
}

export async function saveAdminAppReleaseConfig(
  config: AppReleaseConfig,
  admin: AdminUser
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_APP_RELEASE, JSON.stringify(config));

  try {
    await supabase.from("system_configs").upsert({
      key: "app_release",
      value: {
        version: config.version,
        apk_url: config.apkUrl,
        changelog: config.changelog,
        force_update: config.forceUpdate,
        min_version: config.minVersion,
      },
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Failed saving app_release to Supabase:", err);
  }

  await logAdminAction({
    admin,
    action: "UPDATE_APP_RELEASE",
    targetType: "system",
    targetId: "apk_release",
    details: config,
  });
}

export async function getAdminMaintenanceConfig(): Promise<MaintenanceModeConfig> {
  const defaultIcon = "https://i.ibb.co.com/rKCB8QhB/maintenance-nuenime.png";
  try {
    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      const config: MaintenanceModeConfig = {
        isActive: parsed.is_active ?? parsed.isActive ?? false,
        message: parsed.message ?? "Nuenime sedang dalam pemeliharaan sistem berkala. Mohon kembali beberapa saat lagi.",
        endsAt: parsed.ends_at ?? parsed.endsAt ?? null,
        primaryButtonText: parsed.primary_button_text ?? parsed.primaryButtonText ?? "Cek Status Server",
        secondaryButtonText: parsed.secondary_button_text ?? parsed.secondaryButtonText ?? "Komunitas Discord",
        secondaryButtonUrl: parsed.secondary_button_url ?? parsed.secondaryButtonUrl ?? "https://discord.gg/nuenime",
        iconUrl: parsed.icon_url ?? parsed.iconUrl ?? defaultIcon,
      };
      await AsyncStorage.setItem(STORAGE_MAINTENANCE, JSON.stringify(config));
      return config;
    }
  } catch {}

  try {
    const raw = await AsyncStorage.getItem(STORAGE_MAINTENANCE);
    if (raw) return JSON.parse(raw);
  } catch {}

  return {
    isActive: false,
    message: "Nuenime sedang dalam pemeliharaan sistem berkala. Mohon kembali beberapa saat lagi.",
    primaryButtonText: "Cek Status Server",
    secondaryButtonText: "Komunitas Discord",
    secondaryButtonUrl: "https://discord.gg/nuenime",
    iconUrl: defaultIcon,
  };
}

export async function saveAdminMaintenanceConfig(
  config: MaintenanceModeConfig,
  admin: AdminUser
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_MAINTENANCE, JSON.stringify(config));

  try {
    await supabase.from("system_configs").upsert({
      key: "maintenance_mode",
      value: {
        is_active: config.isActive,
        message: config.message,
        ends_at: config.endsAt ?? null,
        primary_button_text: config.primaryButtonText ?? "Cek Status Server",
        secondary_button_text: config.secondaryButtonText ?? "Komunitas Discord",
        secondary_button_url: config.secondaryButtonUrl ?? "https://discord.gg/nuenime",
        icon_url: config.iconUrl ?? "https://i.ibb.co.com/rKCB8QhB/maintenance-nuenime.png",
      },
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Failed saving maintenance_mode to Supabase:", err);
  }

  await logAdminAction({
    admin,
    action: "UPDATE_MAINTENANCE_MODE",
    targetType: "system",
    targetId: "maintenance",
    details: config,
  });
}

// ─── 7B. POP-UP AWAL (ANNOUNCEMENT MODAL) CONFIG ───
export interface AppAnnouncementConfig {
  isActive: boolean;
  title: string;
  content: string;
  buttonText: string;
  buttonUrl: string;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
  versionTag: string;
  dismissible: boolean;
  updatedAt?: string;
}

export const DEFAULT_ANNOUNCEMENT_CONFIG: AppAnnouncementConfig = {
  isActive: true,
  title: "[ INFO ]",
  content: `Gabung ke komunitas AnibiPlay di Discord! ✨

• Ngobrol bareng komunitas
• Dapatkan info & update terbaru
• Laporkan bug atau masalah
• Berikan saran untuk AnibiPlay

Jangan sampai ketinggalan info terbaru!
Tekan tombol di bawah untuk bergabung. 👇`,
  buttonText: "JOIN DISCORD",
  buttonUrl: "https://discord.gg/nuenime",
  secondaryButtonText: "DETAIL INFO",
  secondaryButtonUrl: "",
  versionTag: "Versi terbaru: 1.4.9",
  dismissible: true,
};

export async function getAppAnnouncementConfig(): Promise<AppAnnouncementConfig> {
  try {
    const { data, error } = await supabase
      .from("system_configs")
      .select("value, updated_at")
      .eq("key", "app_announcement")
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      const config: AppAnnouncementConfig = {
        isActive: parsed.is_active ?? parsed.isActive ?? true,
        title: parsed.title ?? DEFAULT_ANNOUNCEMENT_CONFIG.title,
        content: parsed.content ?? DEFAULT_ANNOUNCEMENT_CONFIG.content,
        buttonText: parsed.button_text ?? parsed.buttonText ?? DEFAULT_ANNOUNCEMENT_CONFIG.buttonText,
        buttonUrl: parsed.button_url ?? parsed.buttonUrl ?? DEFAULT_ANNOUNCEMENT_CONFIG.buttonUrl,
        secondaryButtonText:
          parsed.secondary_button_text ?? parsed.secondaryButtonText ?? DEFAULT_ANNOUNCEMENT_CONFIG.secondaryButtonText,
        secondaryButtonUrl:
          parsed.secondary_button_url ?? parsed.secondaryButtonUrl ?? DEFAULT_ANNOUNCEMENT_CONFIG.secondaryButtonUrl,
        versionTag: parsed.version_tag ?? parsed.versionTag ?? DEFAULT_ANNOUNCEMENT_CONFIG.versionTag,
        dismissible: parsed.dismissible ?? true,
        updatedAt: data.updated_at || new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_APP_ANNOUNCEMENT, JSON.stringify(config));
      return config;
    }
  } catch {}

  try {
    const raw = await AsyncStorage.getItem(STORAGE_APP_ANNOUNCEMENT);
    if (raw) return JSON.parse(raw);
  } catch {}

  return DEFAULT_ANNOUNCEMENT_CONFIG;
}

export async function saveAppAnnouncementConfig(
  config: AppAnnouncementConfig,
  admin: AdminUser
): Promise<void> {
  const payload = {
    is_active: config.isActive,
    title: config.title,
    content: config.content,
    button_text: config.buttonText,
    button_url: config.buttonUrl,
    secondary_button_text: config.secondaryButtonText ?? "",
    secondary_button_url: config.secondaryButtonUrl ?? "",
    version_tag: config.versionTag,
    dismissible: config.dismissible !== false,
  };

  await AsyncStorage.setItem(STORAGE_APP_ANNOUNCEMENT, JSON.stringify(config));

  try {
    await supabase.from("system_configs").upsert({
      key: "app_announcement",
      value: payload,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Failed saving app_announcement to Supabase:", err);
  }

  await logAdminAction({
    admin,
    action: "UPDATE_APP_ANNOUNCEMENT",
    targetType: "system",
    targetId: "app_announcement",
    details: config,
  });
}

// ─── 8. DASHBOARD KPI & ANALYTICS DATA ───

export interface DashboardKPIData {
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  totalCompletedTxs: number;
  totalPendingTxs: number;
  totalRejectedTxs: number;
  dau: number;
  totalRegisteredUsers: number;
  totalCrystalsPurchased: number;
  totalCrystalsSpent: number;
}

export async function getDashboardKPIData(): Promise<DashboardKPIData> {
  const txs = await getAllTransactionsForAdmin();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfDay - 6 * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let revToday = 0;
  let revWeek = 0;
  let revMonth = 0;
  let completed = 0;
  let pending = 0;
  let rejected = 0;
  let crystalsPurchased = 0;

  txs.forEach((t) => {
    const time = new Date(t.createdAt).getTime();
    if (t.status === "berhasil") {
      completed++;
      crystalsPurchased += t.crystalAmount;
      if (time >= startOfDay) revToday += t.totalPayment;
      if (time >= startOfWeek) revWeek += t.totalPayment;
      if (time >= startOfMonth) revMonth += t.totalPayment;
    } else if (t.status === "menunggu_verifikasi" || t.status === "menunggu_konfirmasi") {
      pending++;
    } else if (t.status === "ditolak") {
      rejected++;
    }
  });

  const users = await getAdminUsersList();

  return {
    revenueToday: revToday,
    revenueThisWeek: revWeek,
    revenueThisMonth: revMonth,
    totalCompletedTxs: completed,
    totalPendingTxs: pending,
    totalRejectedTxs: rejected,
    dau: Math.max(1, users.length),
    totalRegisteredUsers: users.length,
    totalCrystalsPurchased: crystalsPurchased,
    totalCrystalsSpent: Math.floor(crystalsPurchased * 0.45), // Estimasi gacha spending
  };
}

// ─── 9. ANIME CMS & STREAMING ───

export interface SpotlightItem {
  id: string;
  animeId: number;
  title: string;
  posterUrl: string;
  bannerUrl: string;
  synopsis: string;
  category: "spotlight" | "featured" | "editors_choice" | "trending";
  sortOrder: number;
  isActive: boolean;
}

const STORAGE_CMS_SPOTLIGHTS = "nuenime.admin.cms_spotlights";

const DEFAULT_SPOTLIGHTS: SpotlightItem[] = [
  {
    id: "spot-1",
    animeId: 5114,
    title: "Fullmetal Alchemist: Brotherhood",
    posterUrl: "https://cdn.myanimelist.net/images/anime/1208/94745.jpg",
    bannerUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&q=80",
    synopsis: "Dua bersaudara alkemis mencari Batu Bertuah untuk memulihkan tubuh mereka.",
    category: "spotlight",
    sortOrder: 1,
    isActive: true,
  },
  {
    id: "spot-2",
    animeId: 9253,
    title: "Steins;Gate",
    posterUrl: "https://cdn.myanimelist.net/images/anime/1935/127974.jpg",
    bannerUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&q=80",
    synopsis: "Sekelompok ilmuwan muda menemukan cara mengirim pesan masa lalu.",
    category: "featured",
    sortOrder: 2,
    isActive: true,
  },
  {
    id: "spot-3",
    animeId: 16498,
    title: "Attack on Titan",
    posterUrl: "https://cdn.myanimelist.net/images/anime/10/47347.jpg",
    bannerUrl: "https://images.unsplash.com/photo-1563089145-599997674d42?w=1200&q=80",
    synopsis: "Umat manusia bertahan di balik tembok raksasa melawan monster Titan.",
    category: "trending",
    sortOrder: 3,
    isActive: true,
  },
];

export async function getAdminSpotlights(): Promise<SpotlightItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_CMS_SPOTLIGHTS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_SPOTLIGHTS;
}

export async function saveAdminSpotlight(
  item: SpotlightItem,
  admin: AdminUser
): Promise<SpotlightItem[]> {
  const current = await getAdminSpotlights();
  const idx = current.findIndex((s) => s.id === item.id);
  if (idx !== -1) {
    current[idx] = item;
  } else {
    current.push(item);
  }
  await AsyncStorage.setItem(STORAGE_CMS_SPOTLIGHTS, JSON.stringify(current));
  await logAdminAction({
    admin,
    action: "SAVE_CMS_SPOTLIGHT",
    targetType: "cms_spotlight",
    targetId: item.id,
    details: { title: item.title, category: item.category },
  });
  return current;
}

export async function deleteAdminSpotlight(
  id: string,
  admin: AdminUser
): Promise<SpotlightItem[]> {
  const current = await getAdminSpotlights();
  const filtered = current.filter((s) => s.id !== id);
  await AsyncStorage.setItem(STORAGE_CMS_SPOTLIGHTS, JSON.stringify(filtered));
  await logAdminAction({
    admin,
    action: "DELETE_CMS_SPOTLIGHT",
    targetType: "cms_spotlight",
    targetId: id,
    details: {},
  });
  return filtered;
}

// ─── BROKEN STREAM REPORTS ───

export interface BrokenStreamReport {
  id: string;
  animeId: number;
  animeTitle: string;
  episodeNumber: number;
  serverName: string;
  issueDescription: string;
  status: "pending" | "investigating" | "fixed" | "invalid";
  reporter: string;
  createdAt: string;
}

const STORAGE_BROKEN_STREAMS = "nuenime.admin.broken_streams";

const DEFAULT_BROKEN_STREAMS: BrokenStreamReport[] = [
  {
    id: "BSR-101",
    animeId: 5114,
    animeTitle: "Fullmetal Alchemist: Brotherhood",
    episodeNumber: 12,
    serverName: "Track 4 (HD)",
    issueDescription: "Video buffering berulang-ulang di menit ke 14:20 dan audio hilang.",
    status: "pending",
    reporter: "user_kaze",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: "BSR-102",
    animeId: 16498,
    animeTitle: "Attack on Titan Season 3",
    episodeNumber: 5,
    serverName: "Track 6 (Full HD)",
    issueDescription: "Sub Indo tidak muncul dan player menampilkan error code 404.",
    status: "investigating",
    reporter: "arisu_99",
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
];

export async function getAdminBrokenStreamReports(): Promise<BrokenStreamReport[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_BROKEN_STREAMS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_BROKEN_STREAMS;
}

export async function updateBrokenStreamReportStatus(
  id: string,
  status: BrokenStreamReport["status"],
  admin: AdminUser
): Promise<BrokenStreamReport[]> {
  const list = await getAdminBrokenStreamReports();
  const idx = list.findIndex((r) => r.id === id);
  if (idx !== -1) {
    list[idx].status = status;
    await AsyncStorage.setItem(STORAGE_BROKEN_STREAMS, JSON.stringify(list));
    await logAdminAction({
      admin,
      action: "UPDATE_STREAM_REPORT_STATUS",
      targetType: "broken_stream_report",
      targetId: id,
      details: { status },
    });
  }
  return list;
}

// ─── STREAM TRACK CONFIGURATION (Track 4 & Track 6) ───

export interface StreamTrackConfig {
  primaryTrack: "track4" | "track6";
  backupTrack: "track4" | "track6";
  autoFallback: boolean;
  hlsBufferMs: number;
  cdnGeoRouting: boolean;
}

const STORAGE_STREAM_CONFIG = "nuenime.admin.stream_track_config";

export async function getAdminStreamTrackConfig(): Promise<StreamTrackConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_STREAM_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    primaryTrack: "track4",
    backupTrack: "track6",
    autoFallback: true,
    hlsBufferMs: 4000,
    cdnGeoRouting: true,
  };
}

export async function saveAdminStreamTrackConfig(
  config: StreamTrackConfig,
  admin: AdminUser
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_STREAM_CONFIG, JSON.stringify(config));
  await logAdminAction({
    admin,
    action: "UPDATE_STREAM_TRACK_CONFIG",
    targetType: "system_config",
    targetId: "stream_tracks",
    details: config,
  });
}

// ─── 10. SUPPORT & CUSTOMER SERVICE TICKETS ───

export interface SupportTicket {
  id: string;
  userId: string;
  username: string;
  userEmail: string;
  category: "account" | "video" | "payment" | "gacha" | "bug" | "other";
  subject: string;
  description: string;
  attachmentUrl?: string;
  status: "open" | "in_progress" | "waiting_user" | "resolved" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  isAdmin: boolean;
  message: string;
  createdAt: string;
}

const STORAGE_SUPPORT_TICKETS = "nuenime.admin.support_tickets";
const STORAGE_TICKET_MESSAGES = "nuenime.admin.ticket_messages";

const DEFAULT_SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: "TCK-8091",
    userId: "guest",
    username: "Tamu Nuenime",
    userEmail: "guest@nuenime.com",
    category: "payment",
    subject: "Konfirmasi Transfer QRIS Belum Masuk",
    description: "Saya sudah transfer Rp5.000 untuk paket Standard 5.000 Crystal tapi status masih menunggu verifikasi.",
    status: "open",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "TCK-8089",
    userId: "user-alpha",
    username: "AlphaOtaku",
    userEmail: "alpha@example.com",
    category: "gacha",
    subject: "Border Avatar Tidak Masuk ke Inventory",
    description: "Tadi gacha 10x dan dapat border Epic Cyber Blossom, tapi di inventory profil belum muncul.",
    status: "in_progress",
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

export async function getAdminSupportTickets(): Promise<SupportTicket[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_SUPPORT_TICKETS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_SUPPORT_TICKETS;
}

export async function getSupportTicketMessages(ticketId: string): Promise<SupportTicketMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_TICKET_MESSAGES}_${ticketId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [
    {
      id: `msg-init-${ticketId}`,
      ticketId,
      senderId: "user",
      senderName: "User",
      isAdmin: false,
      message: "Halo CS Nuenime, mohon bantuannya terkait kendala di atas. Terima kasih!",
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ];
}

export async function sendAdminTicketReply(params: {
  ticketId: string;
  message: string;
  admin: AdminUser;
}): Promise<SupportTicketMessage> {
  const msgs = await getSupportTicketMessages(params.ticketId);
  const newMsg: SupportTicketMessage = {
    id: `MSG-${Date.now()}`,
    ticketId: params.ticketId,
    senderId: params.admin.id,
    senderName: `CS Admin (${params.admin.username})`,
    isAdmin: true,
    message: params.message.trim(),
    createdAt: new Date().toISOString(),
  };
  msgs.push(newMsg);
  await AsyncStorage.setItem(`${STORAGE_TICKET_MESSAGES}_${params.ticketId}`, JSON.stringify(msgs));

  // Update ticket updatedAt
  const tickets = await getAdminSupportTickets();
  const tIdx = tickets.findIndex((t) => t.id === params.ticketId);
  if (tIdx !== -1) {
    tickets[tIdx].updatedAt = new Date().toISOString();
    if (tickets[tIdx].status === "open") {
      tickets[tIdx].status = "in_progress";
    }
    await AsyncStorage.setItem(STORAGE_SUPPORT_TICKETS, JSON.stringify(tickets));
  }

  await logAdminAction({
    admin: params.admin,
    action: "REPLY_SUPPORT_TICKET",
    targetType: "support_ticket",
    targetId: params.ticketId,
    details: { messagePreview: params.message.slice(0, 50) },
  });

  return newMsg;
}

export async function updateSupportTicketStatus(
  ticketId: string,
  status: SupportTicket["status"],
  admin: AdminUser
): Promise<SupportTicket[]> {
  const tickets = await getAdminSupportTickets();
  const tIdx = tickets.findIndex((t) => t.id === ticketId);
  if (tIdx !== -1) {
    tickets[tIdx].status = status;
    tickets[tIdx].updatedAt = new Date().toISOString();
    await AsyncStorage.setItem(STORAGE_SUPPORT_TICKETS, JSON.stringify(tickets));
    await logAdminAction({
      admin,
      action: "UPDATE_TICKET_STATUS",
      targetType: "support_ticket",
      targetId: ticketId,
      details: { status },
    });
  }
  return tickets;
}

// ─── 11. BROADCAST NOTIFICATIONS ───

export interface BroadcastNotification {
  id: string;
  title: string;
  message: string;
  actionUrl?: string;
  type: "system" | "promo" | "maintenance" | "event";
  recipientsCount: number;
  createdAt: string;
}

const STORAGE_BROADCASTS = "nuenime.admin.broadcasts";

export async function getAdminBroadcasts(): Promise<BroadcastNotification[]> {
  try {
    const { data, error } = await supabase
      .from("broadcast_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped: BroadcastNotification[] = data.map((b: any) => ({
        id: b.id,
        title: b.title,
        message: b.message,
        actionUrl: b.action_url ?? b.actionUrl,
        type: b.type || "system",
        recipientsCount: b.recipients_count ?? b.recipientsCount ?? 0,
        createdAt: b.created_at || new Date().toISOString(),
      }));
      await AsyncStorage.setItem(STORAGE_BROADCASTS, JSON.stringify(mapped));
      return mapped;
    }
  } catch {}

  try {
    const raw = await AsyncStorage.getItem(STORAGE_BROADCASTS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export async function getLatestBroadcastNotification(): Promise<BroadcastNotification | null> {
  try {
    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "broadcast_latest")
      .maybeSingle();

    if (!error && data?.value) {
      return typeof data.value === "string" ? JSON.parse(data.value) : data.value;
    }
  } catch {}

  try {
    const { data, error } = await supabase
      .from("broadcast_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id,
        title: data.title,
        message: data.message,
        actionUrl: data.action_url,
        type: data.type || "system",
        recipientsCount: data.recipients_count || 0,
        createdAt: data.created_at,
      };
    }
  } catch {}

  return null;
}

export async function sendAdminBroadcast(params: {
  title: string;
  message: string;
  type: BroadcastNotification["type"];
  actionUrl?: string;
  admin: AdminUser;
}): Promise<BroadcastNotification> {
  const users = await getAdminUsersList();
  const recipientsCount = Math.max(1, users.length);

  const item: BroadcastNotification = {
    id: `BC-${Date.now()}`,
    title: params.title.trim(),
    message: params.message.trim(),
    type: params.type,
    actionUrl: params.actionUrl,
    recipientsCount,
    createdAt: new Date().toISOString(),
  };

  // 1. Simpan ke Supabase broadcast_notifications
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.admin.id);
    const adminId = isUuid ? params.admin.id : null;

    await supabase.from("broadcast_notifications").insert({
      admin_id: adminId,
      title: item.title,
      message: item.message,
      action_url: item.actionUrl || null,
      type: item.type,
      recipients_count: item.recipientsCount,
      created_at: item.createdAt,
    });
  } catch (err) {
    console.warn("Failed saving broadcast to Supabase broadcast_notifications:", err);
  }

  // 2. Simpan ke system_configs broadcast_latest agar aplikasi langsung tersinkron
  try {
    await supabase.from("system_configs").upsert({
      key: "broadcast_latest",
      value: item,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Failed saving broadcast_latest to system_configs:", err);
  }

  // 3. Simpan ke local cache
  const broadcasts = await getAdminBroadcasts();
  broadcasts.unshift(item);
  await AsyncStorage.setItem(STORAGE_BROADCASTS, JSON.stringify(broadcasts));

  await logAdminAction({
    admin: params.admin,
    action: "SEND_BROADCAST",
    targetType: "broadcast",
    targetId: item.id,
    details: { title: item.title, type: item.type, recipientsCount: item.recipientsCount },
  });

  // 4. 🔔 Kirim Push Notification ke SEMUA pengguna (sampai walaupun APK sedang mati total!)
  void sendPushToAllUsers({
    title: item.title,
    body: item.message,
    channelId: "nuenime_broadcast",
    data: {
      type: "broadcast",
      actionUrl: item.actionUrl,
      broadcastId: item.id,
    },
  });

  return item;
}

export async function deleteAdminBroadcast(id: string, admin?: AdminUser): Promise<void> {
  // 1. Hapus dari Supabase broadcast_notifications
  try {
    await supabase.from("broadcast_notifications").delete().eq("id", id);
  } catch (err) {
    console.warn("Failed deleting from Supabase broadcast_notifications:", err);
  }

  // 2. Jika siaran ini adalah broadcast_latest di system_configs, hapus/kosongkan
  try {
    const { data } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "broadcast_latest")
      .maybeSingle();

    if (data?.value) {
      const val = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      if (val && val.id === id) {
        await supabase
          .from("system_configs")
          .update({ value: null, updated_at: new Date().toISOString() })
          .eq("key", "broadcast_latest");
      }
    }
  } catch (err) {
    console.warn("Failed clearing broadcast_latest from system_configs:", err);
  }

  // 3. Hapus dari local cache
  try {
    const raw = await AsyncStorage.getItem(STORAGE_BROADCASTS);
    if (raw) {
      const list: BroadcastNotification[] = JSON.parse(raw);
      const filtered = list.filter((b) => b.id !== id);
      await AsyncStorage.setItem(STORAGE_BROADCASTS, JSON.stringify(filtered));
    }
  } catch {}

  if (admin) {
    await logAdminAction({
      admin,
      action: "DELETE_BROADCAST",
      targetType: "broadcast",
      targetId: id,
      details: { broadcastId: id },
    });
  }
}

export async function clearAllAdminBroadcasts(admin?: AdminUser): Promise<void> {
  try {
    await supabase.from("broadcast_notifications").delete().neq("id", "0");
  } catch {}
  try {
    await supabase
      .from("system_configs")
      .update({ value: null, updated_at: new Date().toISOString() })
      .eq("key", "broadcast_latest");
  } catch {}
  try {
    await AsyncStorage.removeItem(STORAGE_BROADCASTS);
  } catch {}
  if (admin) {
    await logAdminAction({
      admin,
      action: "CLEAR_ALL_BROADCASTS",
      targetType: "broadcast",
      targetId: "all",
      details: { count: "all" },
    });
  }
}

// ─── 12. MAILBOX / MASS GIFT ───

export interface MassGiftCampaign {
  id: string;
  title: string;
  message: string;
  giftType: "crystal" | "border";
  giftValue: string;
  targetSegment: string;
  recipientsCount: number;
  createdAt: string;
}

const STORAGE_MASS_GIFTS = "nuenime.admin.mass_gifts";

export async function getAdminMassGifts(): Promise<MassGiftCampaign[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_MASS_GIFTS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export async function sendAdminMassGift(params: {
  title: string;
  message: string;
  giftType: "crystal" | "border";
  giftValue: string;
  targetSegment: string;
  admin: AdminUser;
}): Promise<{ success: boolean; campaign: MassGiftCampaign; recipientsCount: number }> {
  const users = await getAdminUsersList();
  const gifts = await getAdminMassGifts();

  // Jika berupa Crystal, tambahkan ke user
  if (params.giftType === "crystal") {
    const amt = parseInt(params.giftValue, 10);
    if (!isNaN(amt) && amt > 0) {
      for (const u of users) {
        await addCrystalBalance(u.id, amt);
      }
    }
  }

  const campaign: MassGiftCampaign = {
    id: `GIFT-${Date.now()}`,
    title: params.title,
    message: params.message,
    giftType: params.giftType,
    giftValue: params.giftValue,
    targetSegment: params.targetSegment,
    recipientsCount: users.length,
    createdAt: new Date().toISOString(),
  };

  gifts.unshift(campaign);
  await AsyncStorage.setItem(STORAGE_MASS_GIFTS, JSON.stringify(gifts));

  await logAdminAction({
    admin: params.admin,
    action: "SEND_MASS_GIFT",
    targetType: "mass_gift",
    targetId: campaign.id,
    details: {
      giftType: params.giftType,
      giftValue: params.giftValue,
      recipientsCount: users.length,
    },
  });

  return { success: true, campaign, recipientsCount: users.length };
}

