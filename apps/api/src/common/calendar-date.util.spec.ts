import { addDays, addMonths, clampToHorizon, enumerateDates, weekdayOf } from "./calendar-date.util";

describe("weekdayOf", () => {
  it("computes the correct weekday for a known date", () => {
    // 2026-07-20 is a Monday.
    expect(weekdayOf("2026-07-20")).toBe("MONDAY");
    expect(weekdayOf("2026-07-21")).toBe("TUESDAY");
    expect(weekdayOf("2026-07-22")).toBe("WEDNESDAY");
    expect(weekdayOf("2026-07-24")).toBe("FRIDAY");
    expect(weekdayOf("2026-07-26")).toBe("SUNDAY");
  });
});

describe("addDays / addMonths", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-07-30", 3)).toBe("2026-08-02");
  });

  it("adds months preserving the day", () => {
    expect(addMonths("2026-07-20", 3)).toBe("2026-10-20");
  });
});

describe("enumerateDates", () => {
  it("returns an inclusive list of dates", () => {
    expect(enumerateDates("2026-07-20", "2026-07-23")).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
    ]);
  });

  it("returns a single date when from equals to", () => {
    expect(enumerateDates("2026-07-20", "2026-07-20")).toEqual(["2026-07-20"]);
  });
});

describe("clampToHorizon", () => {
  it("leaves a date within the horizon unchanged", () => {
    expect(clampToHorizon("2026-08-20", "2026-07-20")).toBe("2026-08-20");
  });

  it("clamps a date beyond the 3-month horizon", () => {
    expect(clampToHorizon("2027-01-01", "2026-07-20")).toBe("2026-10-20");
  });
});
