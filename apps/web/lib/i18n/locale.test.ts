import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, resolveLocale } from "./locale";

describe("resolveLocale", () => {
  it("accepts a supported locale", () => {
    expect(resolveLocale("bg")).toBe("bg");
    expect(resolveLocale("en")).toBe("en");
  });

  it("falls back to the default for a missing value", () => {
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
  });

  it("falls back to the default for an unsupported value", () => {
    expect(resolveLocale("fr")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("EN")).toBe(DEFAULT_LOCALE);
  });

  it("uses the first value when given an array (repeated query param)", () => {
    expect(resolveLocale(["bg", "en"])).toBe("bg");
  });

  it("falls back to the default for an empty array", () => {
    expect(resolveLocale([])).toBe(DEFAULT_LOCALE);
  });
});
