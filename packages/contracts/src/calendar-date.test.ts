import { describe, expect, it } from "vitest";

import { calendarDateSchema, dateRangeQuerySchema } from "./calendar-date";

describe("calendarDateSchema", () => {
  it("accepts a well-formed date", () => {
    expect(() => calendarDateSchema.parse("2026-07-22")).not.toThrow();
  });

  it("rejects a malformed date", () => {
    expect(() => calendarDateSchema.parse("22-07-2026")).toThrow();
    expect(() => calendarDateSchema.parse("2026-13-40")).toThrow();
  });
});

describe("dateRangeQuerySchema", () => {
  it("accepts from <= to", () => {
    expect(() => dateRangeQuerySchema.parse({ from: "2026-07-01", to: "2026-07-31" })).not.toThrow();
    expect(() => dateRangeQuerySchema.parse({ from: "2026-07-01", to: "2026-07-01" })).not.toThrow();
  });

  it("rejects from > to", () => {
    expect(() => dateRangeQuerySchema.parse({ from: "2026-07-31", to: "2026-07-01" })).toThrow();
  });
});
