import { describe, expect, it } from "vitest";

import bg from "./bg";
import en from "./en";

function leafKeys(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") {
    return [prefix];
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      leafKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

describe("bg/en dictionary parity", () => {
  it("has exactly the same set of keys in both languages", () => {
    expect(leafKeys(bg).sort()).toEqual(leafKeys(en).sort());
  });

  it("has no empty translated strings", () => {
    for (const key of leafKeys(bg)) {
      const value = key.split(".").reduce<unknown>((acc, part) => (acc as never)[part], bg);
      expect(typeof value === "string" && value.trim().length > 0, `bg.${key} should not be empty`).toBe(
        true,
      );
    }
  });
});
