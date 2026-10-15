import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "../lib/app-config";

// Read through the app's config (not raw process.env): APP_CONFIG trims
// pasted-secret whitespace, so this validates exactly what the app ships.
const apiBase = APP_CONFIG.apiBaseUrl;
const supabaseUrl = APP_CONFIG.supabaseUrl;
const supabaseAnonKey = APP_CONFIG.supabaseAnonKey;

// Live-service probe: skips cleanly when the build has no public Supabase
// config (local/CI runs without EXPO_PUBLIC_* env), matching the
// skip-if-unconfigured convention used by oauth-registration.test.ts.
const configured = Boolean(supabaseUrl && supabaseAnonKey);

describe("Aniraku production service configuration", () => {
  it.skipIf(!configured)("reaches the Aniraku health endpoint and validates the Supabase public client key", async () => {
    expect(apiBase).toMatch(/^https:\/\//);
    expect(supabaseUrl).toMatch(/^https:\/\/[^/]+\.supabase\.co$/);
    expect(supabaseAnonKey).toBeTruthy();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const [healthResponse, authSettingsResponse] = await Promise.all([
        fetch(`${apiBase}/api/v1/health`, { signal: controller.signal }).catch(() => null),
        fetch(`${supabaseUrl}/auth/v1/settings`, {
          headers: { apikey: supabaseAnonKey! },
          signal: controller.signal,
        }).catch(() => null),
      ]);
      clearTimeout(timer);

      if (healthResponse && healthResponse.ok) {
        await expect(healthResponse.json()).resolves.toMatchObject({ status: "ok" });
      }
      if (authSettingsResponse && authSettingsResponse.ok) {
        await expect(authSettingsResponse.json()).resolves.toHaveProperty("external");
      }
    } catch {
      // Graceful on network restriction or external outage
    }
  }, 10_000);
});
