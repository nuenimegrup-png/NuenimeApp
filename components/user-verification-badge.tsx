import React from "react";
import { AppIcon } from "@/components/app-icon";

export type VerificationStatus = "developer_admin" | "verified_member" | "none";

/**
 * Aturan Otoritatif Centang Verifikasi Nuenime:
 * - Centang Merah ("developer_admin"): Developer, Super Admin, Admin, Moderator, dsb.
 * - Centang Biru ("verified_member"): Member VIP atau peran komunitas resmi terverifikasi.
 * - None ("none"): Member biasa (TIDAK MENDAPATKAN CENTANG APAPUN).
 */
export function getVerificationStatus(
  role?: string | null,
  isVip?: boolean | null
): VerificationStatus {
  if (!role && !isVip) return "none";

  const cleanRole = (role || "").trim().toLowerCase();

  // 1. Centang Merah: Administrator & Developer
  const adminDeveloperRoles = [
    "super admin",
    "superadmin",
    "admin",
    "developer",
    "dev",
    "devops engineer",
    "security analyst",
    "pen tester",
    "database manager",
    "finance admin",
    "moderator",
  ];

  if (adminDeveloperRoles.includes(cleanRole)) {
    return "developer_admin";
  }

  // 2. Centang Biru: Member VIP atau terverifikasi resmi
  const verifiedMemberRoles = [
    "vip",
    "verified",
    "content manager",
    "community manager",
    "qa tester",
    "auditor",
    "support",
  ];

  if (Boolean(isVip) || verifiedMemberRoles.includes(cleanRole)) {
    return "verified_member";
  }

  // 3. Pengguna biasa tidak memiliki centang
  return "none";
}

export interface UserVerificationBadgeProps {
  role?: string | null;
  isVip?: boolean | null;
  size?: number;
}

export function UserVerificationBadge({
  role,
  isVip,
  size = 14,
}: UserVerificationBadgeProps) {
  const status = getVerificationStatus(role, isVip);

  if (status === "developer_admin") {
    return <AppIcon name="check-decagram" size={size} color="#EF4444" />;
  }

  if (status === "verified_member") {
    return <AppIcon name="check-circle" size={size} color="#38BDF8" />;
  }

  return null;
}
