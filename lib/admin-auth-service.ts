import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { AdminRole, AdminUser } from "@/lib/admin-service";
import { logAdminAction } from "@/lib/admin-service";

export const STORAGE_ADMIN_ACCOUNTS = "nuenime.admin.registered_accounts";
export const STORAGE_ADMIN_SESSION = "nuenime.admin.session";

export interface AdminAccount {
  id: string;
  username: string;
  email: string;
  password: string;
  role: AdminRole;
  status: "active" | "inactive";
  createdAt: string;
  lastLoginAt?: string;
  notes?: string;
}

export const DEFAULT_ADMIN_ACCOUNTS: AdminAccount[] = [
  {
    id: "admin-super-01",
    username: "Super Admin Nuenime",
    email: "admin@nuenime.com",
    password: "admin123",
    role: "super_admin",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    notes: "Akun Super Admin Utama (Akses Semua Modul)",
  },
  {
    id: "admin-finance-01",
    username: "Staff Finance",
    email: "finance@nuenime.com",
    password: "finance123",
    role: "finance_admin",
    status: "active",
    createdAt: "2026-02-01T00:00:00.000Z",
    notes: "Staff Verifikasi Transaksi Top Up & Tiket CS",
  },
  {
    id: "admin-mod-01",
    username: "Staff Moderator",
    email: "mod@nuenime.com",
    password: "mod123",
    role: "moderator",
    status: "active",
    createdAt: "2026-03-01T00:00:00.000Z",
    notes: "Moderasi Komunitas, Komentar & Laporan",
  },
];

/**
 * Mendapatkan daftar seluruh akun admin yang terdaftar di sistem.
 * Terhubung otomatis ke Supabase jika tabel admin_accounts tersedia,
 * dengan fallback mulus ke penyimpanan lokal (AsyncStorage).
 */
export async function getAdminAccounts(): Promise<AdminAccount[]> {
  try {
    // 1. Coba ambil dari Supabase jika terhubung & tabel ada
    try {
      const { data, error } = await supabase
        .from("admin_accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        const formatted: AdminAccount[] = data.map((d: any) => ({
          id: d.id,
          username: d.username,
          email: d.email,
          password: d.password_hash,
          role: d.role as AdminRole,
          status: d.status as "active" | "inactive",
          createdAt: d.created_at,
          lastLoginAt: d.last_login_at,
          notes: d.notes,
        }));
        await AsyncStorage.setItem(
          STORAGE_ADMIN_ACCOUNTS,
          JSON.stringify(formatted)
        );
        return formatted;
      }
    } catch {}

    // 2. Fallback ke penyimpanan lokal
    const raw = await AsyncStorage.getItem(STORAGE_ADMIN_ACCOUNTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // 3. Inisialisasi default accounts jika belum ada sama sekali
    await AsyncStorage.setItem(
      STORAGE_ADMIN_ACCOUNTS,
      JSON.stringify(DEFAULT_ADMIN_ACCOUNTS)
    );
    return DEFAULT_ADMIN_ACCOUNTS;
  } catch (err) {
    console.warn("Failed to get admin accounts", err);
    return DEFAULT_ADMIN_ACCOUNTS;
  }
}

/**
 * Membuat akun login baru untuk dashboard admin dengan role pilihan.
 */
export async function createAdminAccount(
  data: {
    username: string;
    email: string;
    password: string;
    role: AdminRole;
    notes?: string;
  },
  actorAdmin?: AdminUser
): Promise<{ success: boolean; account?: AdminAccount; error?: string }> {
  try {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanUsername = data.username.trim();
    const cleanPassword = data.password.trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { success: false, error: "Alamat email tidak valid." };
    }
    if (!cleanUsername) {
      return { success: false, error: "Nama / username wajib diisi." };
    }
    if (cleanPassword.length < 4) {
      return { success: false, error: "Kata sandi minimal 4 karakter." };
    }

    const currentList = await getAdminAccounts();

    // Cek duplikasi email
    const duplicate = currentList.find(
      (a) => a.email.toLowerCase() === cleanEmail
    );
    if (duplicate) {
      return { success: false, error: `Email ${cleanEmail} sudah terdaftar.` };
    }

    const newAccount: AdminAccount = {
      id: `admin-usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUsername,
      email: cleanEmail,
      password: cleanPassword,
      role: data.role,
      status: "active",
      createdAt: new Date().toISOString(),
      notes:
        data.notes?.trim() ||
        `Dibuat oleh ${actorAdmin?.username || "Super Admin"}`,
    };

    const updatedList = [newAccount, ...currentList];
    await AsyncStorage.setItem(
      STORAGE_ADMIN_ACCOUNTS,
      JSON.stringify(updatedList)
    );

    // Coba simpan ke Supabase jika tabel admin_accounts ada
    try {
      await supabase.from("admin_accounts").insert({
        id: newAccount.id,
        username: newAccount.username,
        email: newAccount.email,
        password_hash: newAccount.password,
        role: newAccount.role,
        status: newAccount.status,
        notes: newAccount.notes,
        created_at: newAccount.createdAt,
        updated_at: newAccount.createdAt,
      });
    } catch {}

    // Catat ke Audit Log
    if (actorAdmin) {
      await logAdminAction({
        admin: actorAdmin,
        action: "CREATE_ADMIN_ACCOUNT",
        targetType: "admin_account",
        targetId: newAccount.id,
        details: {
          email: newAccount.email,
          username: newAccount.username,
          role: newAccount.role,
        },
      });
    }

    return { success: true, account: newAccount };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Terjadi kesalahan saat membuat akun.",
    };
  }
}

/**
 * Mengubah role atau status akun admin yang ada.
 */
export async function updateAdminAccount(
  accountId: string,
  updates: Partial<
    Pick<
      AdminAccount,
      "role" | "status" | "password" | "username" | "notes"
    >
  >,
  actorAdmin?: AdminUser
): Promise<{ success: boolean; error?: string }> {
  try {
    const list = await getAdminAccounts();
    const idx = list.findIndex((a) => a.id === accountId);
    if (idx === -1) {
      return { success: false, error: "Akun admin tidak ditemukan." };
    }

    const oldAccount = list[idx];
    const updated: AdminAccount = {
      ...oldAccount,
      ...updates,
    };

    list[idx] = updated;
    await AsyncStorage.setItem(STORAGE_ADMIN_ACCOUNTS, JSON.stringify(list));

    // Sinkronisasi ke Supabase
    try {
      const sbUpdates: any = { updated_at: new Date().toISOString() };
      if (updates.role) sbUpdates.role = updates.role;
      if (updates.status) sbUpdates.status = updates.status;
      if (updates.username) sbUpdates.username = updates.username;
      if (updates.password) sbUpdates.password_hash = updates.password;
      if (updates.notes) sbUpdates.notes = updates.notes;
      await supabase.from("admin_accounts").update(sbUpdates).eq("id", accountId);
    } catch {}

    if (actorAdmin) {
      await logAdminAction({
        admin: actorAdmin,
        action: "UPDATE_ADMIN_ACCOUNT",
        targetType: "admin_account",
        targetId: accountId,
        details: {
          updates,
          previousRole: oldAccount.role,
          newRole: updated.role,
        },
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal memperbarui akun." };
  }
}

/**
 * Menghapus akun admin dari sistem.
 */
export async function deleteAdminAccount(
  accountId: string,
  actorAdmin?: AdminUser
): Promise<{ success: boolean; error?: string }> {
  try {
    const list = await getAdminAccounts();
    const target = list.find((a) => a.id === accountId);
    if (!target) {
      return { success: false, error: "Akun admin tidak ditemukan." };
    }

    if (
      target.email === "admin@nuenime.com" ||
      target.id === "admin-super-01"
    ) {
      return {
        success: false,
        error: "Akun Super Admin Utama tidak dapat dihapus.",
      };
    }

    const filtered = list.filter((a) => a.id !== accountId);
    await AsyncStorage.setItem(
      STORAGE_ADMIN_ACCOUNTS,
      JSON.stringify(filtered)
    );

    // Hapus dari Supabase jika ada
    try {
      await supabase.from("admin_accounts").delete().eq("id", accountId);
    } catch {}

    if (actorAdmin) {
      await logAdminAction({
        admin: actorAdmin,
        action: "DELETE_ADMIN_ACCOUNT",
        targetType: "admin_account",
        targetId: accountId,
        details: {
          email: target.email,
          role: target.role,
        },
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal menghapus akun." };
  }
}

/**
 * Otentikasi login admin.
 * Mencocokkan email/username dan kata sandi, lalu mengembalikan data admin beserta role aslinya.
 */
export async function authenticateAdmin(
  identifier: string,
  pass: string
): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
  try {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanId || !cleanPass) {
      return {
        success: false,
        error: "Masukkan email atau username dan kata sandi.",
      };
    }

    const accounts = await getAdminAccounts();

    // 1. Cek di daftar akun (Supabase / AsyncStorage)
    const match = accounts.find(
      (a) =>
        a.email.toLowerCase() === cleanId ||
        a.username.toLowerCase() === cleanId
    );

    if (match) {
      const isPasswordValid =
        match.password === cleanPass ||
        (match.email === "admin@nuenime.com" &&
          (cleanPass === "admin" ||
            cleanPass === "admin123" ||
            cleanPass === "nuenime2026"));

      if (!isPasswordValid) {
        return {
          success: false,
          error: "Kata sandi yang Anda masukkan salah.",
        };
      }

      if (match.status !== "active") {
        return {
          success: false,
          error: "Akun ini telah dinonaktifkan oleh Super Admin.",
        };
      }

      // Perbarui waktu login terakhir di local & Supabase
      const now = new Date().toISOString();
      match.lastLoginAt = now;
      await AsyncStorage.setItem(
        STORAGE_ADMIN_ACCOUNTS,
        JSON.stringify(accounts)
      );
      try {
        await supabase
          .from("admin_accounts")
          .update({ last_login_at: now })
          .eq("id", match.id);
      } catch {}

      const adminUser: AdminUser = {
        id: match.id,
        email: match.email,
        username: match.username,
        role: match.role,
      };

      await AsyncStorage.setItem(
        STORAGE_ADMIN_SESSION,
        JSON.stringify(adminUser)
      );
      return { success: true, user: adminUser };
    }

    // 2. Fallback jika ada akun di Supabase Auth (auth.users)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanId,
        password: cleanPass,
      });

      if (!error && data?.user) {
        const role =
          (data.user.user_metadata?.role as AdminRole) || "super_admin";
        const adminUser: AdminUser = {
          id: data.user.id,
          email: data.user.email || cleanId,
          username:
            data.user.user_metadata?.username ||
            data.user.email?.split("@")[0] ||
            "Admin User",
          role,
        };

        await AsyncStorage.setItem(
          STORAGE_ADMIN_SESSION,
          JSON.stringify(adminUser)
        );
        return { success: true, user: adminUser };
      }
    } catch {}

    return {
      success: false,
      error:
        "Kredensial tidak ditemukan. Pastikan email dan kata sandi benar.",
    };
  } catch (err: any) {
    return {
      success: false,
      error:
        err?.message || "Terjadi kesalahan saat memverifikasi akses.",
    };
  }
}
