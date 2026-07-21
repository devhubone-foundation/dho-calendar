import { describe, expect, it } from "vitest";

import { avatarColorFromSeed, getInitials, shouldShowFallbackAvatar } from "./avatar";

describe("getInitials", () => {
  it("takes the first letter of the first and last word", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
  });

  it("handles a single-word name", () => {
    expect(getInitials("Ada")).toBe("A");
  });

  it("handles names with extra whitespace", () => {
    expect(getInitials("  Ada   Lovelace  ")).toBe("AL");
  });

  it("falls back to a placeholder for an empty name", () => {
    expect(getInitials("")).toBe("?");
  });
});

describe("avatarColorFromSeed", () => {
  it("is deterministic for the same seed", () => {
    expect(avatarColorFromSeed("user-123")).toBe(avatarColorFromSeed("user-123"));
  });

  it("can produce different colors for different seeds", () => {
    const colors = new Set(["a", "b", "c", "d", "e"].map(avatarColorFromSeed));
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe("shouldShowFallbackAvatar", () => {
  it("shows fallback when there is no image path", () => {
    expect(shouldShowFallbackAvatar(null, false)).toBe(true);
    expect(shouldShowFallbackAvatar(undefined, false)).toBe(true);
    expect(shouldShowFallbackAvatar("", false)).toBe(true);
    expect(shouldShowFallbackAvatar("   ", false)).toBe(true);
  });

  it("shows fallback when the image failed to load, even with a path", () => {
    expect(shouldShowFallbackAvatar("profiles/a.webp", true)).toBe(true);
  });

  it("does not show fallback for a valid, loadable path", () => {
    expect(shouldShowFallbackAvatar("profiles/a.webp", false)).toBe(false);
  });
});
