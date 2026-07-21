import { describe, expect, it } from "vitest";

import { pickBilingual } from "./bilingual";

describe("pickBilingual", () => {
  it("returns the active locale's value when present", () => {
    expect(pickBilingual({ bg: "Програмист", en: "Programmer" }, "bg")).toBe("Програмист");
    expect(pickBilingual({ bg: "Програмист", en: "Programmer" }, "en")).toBe("Programmer");
  });

  it("falls back to the other language when the active locale is empty", () => {
    expect(pickBilingual({ bg: "", en: "Programmer" }, "bg")).toBe("Programmer");
    expect(pickBilingual({ bg: "Програмист", en: "" }, "en")).toBe("Програмист");
  });

  it("treats whitespace-only values as empty", () => {
    expect(pickBilingual({ bg: "   ", en: "Programmer" }, "bg")).toBe("Programmer");
  });

  it("returns an empty string when both languages are empty", () => {
    expect(pickBilingual({ bg: "", en: "" }, "bg")).toBe("");
  });
});
