import { describe, expect, it } from "vitest";
import {
  BANNER_COOLDOWN_SECONDS,
  NAME_COOLDOWN_SECONDS,
  AVATAR_COOLDOWN_SECONDS,
  getProfileCooldownStatus,
  validateImageUrl,
  extractDirectImageUrl,
  formatDurationIndonesian,
} from "@/lib/profile-cooldown";

describe("Profile Cooldown & Media Utilities", () => {
  describe("Cooldown Constants", () => {
    it("enforces banner cooldown of 7 days (604,800 seconds)", () => {
      expect(BANNER_COOLDOWN_SECONDS).toBe(7 * 24 * 3600);
      expect(BANNER_COOLDOWN_SECONDS).toBe(604800);
    });

    it("enforces display name cooldown of 24 hours (86,400 seconds)", () => {
      expect(NAME_COOLDOWN_SECONDS).toBe(24 * 3600);
      expect(NAME_COOLDOWN_SECONDS).toBe(86400);
    });

    it("enforces avatar cooldown of 24 hours (86,400 seconds)", () => {
      expect(AVATAR_COOLDOWN_SECONDS).toBe(24 * 3600);
      expect(AVATAR_COOLDOWN_SECONDS).toBe(86400);
    });
  });

  describe("getProfileCooldownStatus()", () => {
    it("allows immediate change if user has never changed it (null/undefined)", () => {
      const bannerStatus = getProfileCooldownStatus(null, BANNER_COOLDOWN_SECONDS, "banner");
      expect(bannerStatus.canChange).toBe(true);
      expect(bannerStatus.secondsRemaining).toBe(0);
      expect(bannerStatus.remainingText).toBe("sekarang");

      const nameStatus = getProfileCooldownStatus(undefined, NAME_COOLDOWN_SECONDS, "nama");
      expect(nameStatus.canChange).toBe(true);
      expect(nameStatus.secondsRemaining).toBe(0);

      const avatarStatus = getProfileCooldownStatus("", AVATAR_COOLDOWN_SECONDS, "avatar");
      expect(avatarStatus.canChange).toBe(true);
      expect(avatarStatus.secondsRemaining).toBe(0);
    });

    it("blocks changes and formats countdown correctly while inside cooldown", () => {
      // Suppose banner was changed 2 days ago (5 days left of 7 days)
      const now = Date.now();
      const twoDaysAgo = new Date(now - 2 * 24 * 3600 * 1000).toISOString();
      const status = getProfileCooldownStatus(twoDaysAgo, BANNER_COOLDOWN_SECONDS, "banner");

      expect(status.canChange).toBe(false);
      expect(status.secondsRemaining).toBeGreaterThan(4 * 24 * 3600);
      expect(status.secondsRemaining).toBeLessThanOrEqual(5 * 24 * 3600 + 10);
      expect(status.remainingText).toContain("hari");
      expect(status.message).toContain("Banner dapat diganti lagi dalam");
    });

    it("blocks avatar and name within 24 hours", () => {
      const now = Date.now();
      // Changed 4 hours ago (20 hours left)
      const fourHoursAgo = new Date(now - 4 * 3600 * 1000).toISOString();

      const nameStatus = getProfileCooldownStatus(fourHoursAgo, NAME_COOLDOWN_SECONDS, "nama");
      expect(nameStatus.canChange).toBe(false);
      expect(nameStatus.secondsRemaining).toBeGreaterThan(19 * 3600);
      expect(nameStatus.remainingText).toContain("jam");

      const avatarStatus = getProfileCooldownStatus(fourHoursAgo, AVATAR_COOLDOWN_SECONDS, "avatar");
      expect(avatarStatus.canChange).toBe(false);
      expect(avatarStatus.message).toContain("Avatar dapat diganti lagi dalam");
    });

    it("allows change when cooldown duration has fully expired", () => {
      const now = Date.now();
      // Changed 8 days ago (more than 7 days)
      const eightDaysAgo = new Date(now - 8 * 24 * 3600 * 1000).toISOString();
      const bannerStatus = getProfileCooldownStatus(eightDaysAgo, BANNER_COOLDOWN_SECONDS, "banner");
      expect(bannerStatus.canChange).toBe(true);
      expect(bannerStatus.secondsRemaining).toBe(0);

      // Changed 25 hours ago (more than 24 hours)
      const twentyFiveHoursAgo = new Date(now - 25 * 3600 * 1000).toISOString();
      const nameStatus = getProfileCooldownStatus(twentyFiveHoursAgo, NAME_COOLDOWN_SECONDS, "nama");
      expect(nameStatus.canChange).toBe(true);
      expect(nameStatus.secondsRemaining).toBe(0);
    });
  });

  describe("formatDurationIndonesian()", () => {
    it("formats days and hours", () => {
      const text = formatDurationIndonesian(5 * 86400 + 12 * 3600);
      expect(text).toBe("5 hari 12 jam");
    });

    it("formats hours and minutes", () => {
      const text = formatDurationIndonesian(2 * 3600 + 35 * 60);
      expect(text).toBe("2 jam 35 menit");
    });

    it("formats minutes only", () => {
      const text = formatDurationIndonesian(45 * 60);
      expect(text).toBe("45 menit");
    });

    it("formats seconds only if under a minute", () => {
      const text = formatDurationIndonesian(42);
      expect(text).toBe("42 detik");
    });
  });

  describe("validateImageUrl()", () => {
    it("accepts valid image extensions including animated GIF", () => {
      expect(validateImageUrl("https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif").valid).toBe(true);
      expect(validateImageUrl("https://example.com/banner.png").valid).toBe(true);
      expect(validateImageUrl("https://example.com/photo.jpg").valid).toBe(true);
      expect(validateImageUrl("https://example.com/photo.jpeg").valid).toBe(true);
    });

    it("accepts image URLs with query strings", () => {
      const res = validateImageUrl("https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1200&format=jpg");
      expect(res.valid).toBe(true);
    });

    it("rejects non-http/https protocols", () => {
      expect(validateImageUrl("ftp://example.com/pic.png").valid).toBe(false);
      expect(validateImageUrl("javascript:alert(1)").valid).toBe(false);
      expect(validateImageUrl("").valid).toBe(false);
    });

    it("rejects general webpage search URLs without direct images", () => {
      const searchUrl = "https://www.google.com/search?q=luffy+pfp&tbm=isch";
      const res = validateImageUrl(searchUrl);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("halaman web");
    });

    it("rejects URLs exceeding 2048 characters", () => {
      const longUrl = "https://example.com/" + "a".repeat(2050) + ".png";
      const res = validateImageUrl(longUrl);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("terlalu panjang");
    });
  });

  describe("extractDirectImageUrl()", () => {
    it("extracts direct target image URL from Google Images redirect link", () => {
      const googleRedirect =
        "https://www.google.com/imgres?imgurl=https%3A%2F%2Fcdn.myanimelist.net%2Fimages%2Fcharacters%2F9%2F310307.jpg&imgrefurl=https%3A%2F%2Fmyanimelist.net&docid=xyz&tbnid=abc";
      const extracted = extractDirectImageUrl(googleRedirect);
      expect(extracted).toBe("https://cdn.myanimelist.net/images/characters/9/310307.jpg");
    });

    it("returns plain direct URL unchanged", () => {
      const plainUrl = "https://i.pinimg.com/originals/anime-girl.gif";
      expect(extractDirectImageUrl(plainUrl)).toBe(plainUrl);
    });
  });
});
