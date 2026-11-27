import type * as NotificationsTypes from "expo-notifications";

export type EventSubscription = NotificationsTypes.EventSubscription;

export const AndroidImportance = {
  UNKNOWN: 0,
  UNSPECIFIED: 1,
  NONE: 2,
  MIN: 3,
  LOW: 4,
  DEFAULT: 5,
  HIGH: 6,
  MAX: 7,
} as const;

export const AndroidNotificationVisibility = {
  UNKNOWN: 0,
  PUBLIC: 1,
  PRIVATE: 2,
  SECRET: 3,
} as const;

export const AndroidNotificationPriority = {
  MIN: "min",
  LOW: "low",
  DEFAULT: "default",
  HIGH: "high",
  MAX: "max",
} as const;

export const SchedulableTriggerInputTypes = {
  CALENDAR: "calendar",
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
  DATE: "date",
  TIME_INTERVAL: "timeInterval",
} as const;

export function setNotificationHandler(_handler: unknown) {}

export async function setNotificationChannelAsync(_channelId: string, _channel: unknown) {
  return null;
}

export async function getPermissionsAsync() {
  return { status: "denied" as const, granted: false, canAskAgain: false, expires: "never" as const };
}

export async function requestPermissionsAsync() {
  return { status: "denied" as const, granted: false, canAskAgain: false, expires: "never" as const };
}

export async function getExpoPushTokenAsync(_options?: unknown) {
  return { type: "expo" as const, data: "" };
}

export async function scheduleNotificationAsync(_request: unknown) {
  return "";
}

export async function cancelScheduledNotificationAsync(_identifier: string) {}

export function addNotificationReceivedListener(_listener: (notification: any) => void): EventSubscription {
  return { remove: () => {} };
}

export function addNotificationResponseReceivedListener(_listener: (response: any) => void): EventSubscription {
  return { remove: () => {} };
}

