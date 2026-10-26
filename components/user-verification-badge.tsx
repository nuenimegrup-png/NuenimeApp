import React from "react";
import { AppIcon } from "@/components/app-icon";

export type VerificationStatus = "developer_admin" | "verified_member" | "none";

export function getVerificationStatus(
  role?: string | null,
  isVip?: boolean | null
): VerificationStatus {
  if (role === "guest") return "none";

  const cleanRole = (role || "").trim().toLowerCase();
  if (cleanRole === "guest") return "none";

  // 1. Centang Merah: Administrator & Developer / Owner
  const adminDeveloperRoles = [
    "owner",
    "ceo",
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
    "finance",
    "moderator",
  ];

  if (adminDeveloperRoles.includes(cleanRole)) {
    return "developer_admin";
  }

  // 2. Centang Biru: Seluruh Member resmi Nuenime, Member VIP, dan peran komunitas lainnya
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
