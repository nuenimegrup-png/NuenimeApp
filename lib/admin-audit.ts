import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

// ─── ROLE-BASED ACCESS CONTROL (RBAC) ───
export type AdminRole = "super_admin" | "finance_admin" | "moderator";

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: AdminRole;
}

export function canManageFinance(role: AdminRole): boolean {
  return role === "super_admin" || role === "finance_admin";
}

export function canManageUsers(role: AdminRole): boolean {
  return role === "super_admin" || role === "finance_admin";
}

export function canModerate(role: AdminRole): boolean {
  return role === "super_admin" || role === "moderator";
}

export function canManageSystem(role: AdminRole): boolean {
  return role === "super_admin";
}

// ─── AUDIT LOG ENTRY ───
export interface AuditLogItem {
  id: string;
  adminId: string;
  adminEmail: string;
  adminRole: AdminRole;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, any>;
  createdAt: string;
}

export const STORAGE_AUDIT_LOGS = "nuenime.admin.audit_logs";

const SYSTEM_ADMIN_UUID = "73f6e447-2f8c-4f12-ad94-a737a78e279b";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mencatat tindakan penting admin ke dalam audit log
 */
export async function logAdminAction(params: {
  admin: AdminUser;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, any>;
}): Promise<AuditLogItem> {
  const adminUuid =
    params.admin?.id && UUID_REGEX.test(params.admin.id)
      ? params.admin.id
      : SYSTEM_ADMIN_UUID;

  const item: AuditLogItem = {
    id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    adminId: adminUuid,
    adminEmail: params.admin?.email || "admin@nuenime.com",
    adminRole: params.admin?.role || "super_admin",
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details || {},
    createdAt: new Date().toISOString(),
  };

  try {
    // 1. Simpan ke Supabase (tanpa field id agar default gen_random_uuid() dari Postgres aktif)
    try {
      const { data: dbItem, error: dbErr } = await supabase
        .from("admin_audit_logs")
        .insert({
          admin_id: adminUuid,
          admin_email: item.adminEmail,
          admin_role: item.adminRole,
          action: item.action,
          target_type: item.targetType,
          target_id: item.targetId,
          details: item.details,
          created_at: item.createdAt,
        })
        .select("id")
        .maybeSingle();

      if (dbItem?.id) {
        item.id = dbItem.id;
      }
    } catch (dbErr) {
      console.warn("[AuditLog] Gagal insert ke Supabase:", dbErr);
    }

    // 2. Simpan juga ke AsyncStorage lokal (hingga 500 entri)
    const raw = await AsyncStorage.getItem(STORAGE_AUDIT_LOGS);
    const list: AuditLogItem[] = raw ? JSON.parse(raw) : [];
    list.unshift(item);
    await AsyncStorage.setItem(STORAGE_AUDIT_LOGS, JSON.stringify(list.slice(0, 500)));
  } catch {}

  return item;
}

export async function getAdminAuditLogs(): Promise<AuditLogItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_AUDIT_LOGS);
    if (raw) return JSON.parse(raw);
    return [];
  } catch {
    return [];
  }
}
