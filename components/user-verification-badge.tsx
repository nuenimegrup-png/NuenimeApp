import React from "react";
import { AppIcon } from "@/components/app-icon";
import { isSpecialRole } from "@/lib/admin-service";

export type VerificationStatus = "developer_admin" | "verified_member" | "none";

export function getVerificationStatus(
  role?: string | null,
  isVip?: boolean | null
): VerificationStatus {
  if (!role || role === "guest") return "none";

  const cleanRole = (role || "").trim().toLowerCase();
  if (cleanRole === "guest" || cleanRole === "none") return "none";

  // 1. Centang Merah: Semua pengguna dengan Role Khusus (Admin, Developer, Owner, Support, Moderator, dll)
  if (isSpecialRole(cleanRole)) {
    return "developer_admin";
  }

  // 2. Centang Biru: Seluruh Member biasa / Member VIP
  return "verified_member";
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
    return <AppIcon name="check-decagram" size={size} color="#38BDF8" />;
  }

  return null;
}
