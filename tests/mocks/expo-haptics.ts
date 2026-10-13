import { vi } from "vitest";

export const impactAsync = vi.fn().mockResolvedValue(undefined);
export const notificationAsync = vi.fn().mockResolvedValue(undefined);
export const selectionAsync = vi.fn().mockResolvedValue(undefined);

export enum ImpactFeedbackStyle {
  Light = "light",
  Medium = "medium",
  Heavy = "heavy",
}

export enum NotificationFeedbackType {
  Success = "success",
  Warning = "warning",
  Error = "error",
}
