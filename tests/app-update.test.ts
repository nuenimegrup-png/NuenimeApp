import { describe, expect, it } from "vitest";
import { compareVersions, isReleaseNewer, normalizeVersion, parseGitHubRelease, trustedAnirakuApkAsset, updateDismissalKey } from "../lib/app-update";

describe("Aniraku direct-distribution update logic", () => {
  it("normalizes and compares release tags without treating a suffix as a newer build", () => {
    expect(normalizeVersion("v4.2.1 — Stability")).toBe("4.2.1");
    expect(compareVersions("4.2.1", "4.2")).toBe(1);
    expect(compareVersions("4.2", "4.2.0")).toBe(0);
    expect(isReleaseNewer("4.2.1", "v4.2.1")).toBe(false);
  });

  it("accepts only a trusted Aniraku GitHub APK asset and namespaces dismissal by release", () => {
    const asset = { name: "Nuenime-v5.0.0.apk", size: 88_000_000, content_type: "application/vnd.android.package-archive", browser_download_url: "https://github.com/nuenimegrup-png/NuenimeApp/releases/download/v5.0.0/Nuenime-v5.0.0.apk" };
    expect(trustedAnirakuApkAsset(asset)).toMatchObject({ name: "Nuenime-v5.0.0.apk", size: 88_000_000 });
    expect(trustedAnirakuApkAsset({ ...asset, browser_download_url: "https://example.com/Nuenime-v5.0.0.apk" })).toBeNull();
    expect(parseGitHubRelease({ tag_name: "v5.0.0", name: "v5.0.0", html_url: "https://github.com/nuenimegrup-png/NuenimeApp/releases/tag/v5.0.0", assets: [asset] })).toMatchObject({ version: "5.0.0", assetName: "Nuenime-v5.0.0.apk" });
    expect(parseGitHubRelease({ tag_name: "v4.2.1" })).toBeNull();
    expect(updateDismissalKey("v4.2.4")).toBe("aniraku.update.dismissed:4.2.4");
  });
});
