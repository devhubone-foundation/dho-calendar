import { describe, expect, it } from "vitest";

import {
  addDaysToKey,
  addMonthsToKey,
  getMonthGridDates,
  getWeekDates,
  groupOccurrencesByDate,
  mondayOnOrBefore,
  occurrenceDateSpan,
  yearMonthOfKey,
} from "./calendar-grid";

describe("addMonthsToKey", () => {
  it("shifts forward across a year boundary", () => {
    expect(addMonthsToKey("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("shifts backward across a year boundary", () => {
    expect(addMonthsToKey("2027-01-15", -1)).toBe("2026-12-15");
  });
});

describe("yearMonthOfKey", () => {
  it("splits into a 0-indexed month pair", () => {
    expect(yearMonthOfKey("2026-08-03")).toEqual({ year: 2026, month: 7 });
  });
});

describe("mondayOnOrBefore", () => {
  it("returns the same date when it is already a Monday", () => {
    expect(mondayOnOrBefore("2026-08-03")).toBe("2026-08-03");
  });

  it("returns the preceding Monday for a mid-week date", () => {
    expect(mondayOnOrBefore("2026-08-07")).toBe("2026-08-03"); // Friday
  });

  it("returns the preceding Monday for a Sunday", () => {
    expect(mondayOnOrBefore("2026-08-09")).toBe("2026-08-03");
  });
});

describe("getWeekDates", () => {
  it("returns Monday through Sunday for any date in that week", () => {
    expect(getWeekDates("2026-08-06")).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
    ]);
  });
});

describe("getMonthGridDates", () => {
  it("pads August 2026 to whole weeks starting Monday", () => {
    const dates = getMonthGridDates(2026, 7); // August (0-indexed)
    expect(dates[0]).toBe("2026-07-27"); // Monday before Aug 1 (a Saturday)
    // Aug 31, 2026 is itself a Monday, so its week runs through Sep 6.
    expect(dates[dates.length - 1]).toBe("2026-09-06");
    expect(dates.length % 7).toBe(0);
    expect(dates).toContain("2026-08-01");
    expect(dates).toContain("2026-08-31");
  });
});

describe("occurrenceDateSpan", () => {
  it("covers a single day for a timed event", () => {
    const span = occurrenceDateSpan({
      startAt: "2026-08-03T09:00:00.000Z",
      endAt: "2026-08-03T11:00:00.000Z",
      isAllDay: false,
    });
    expect(span).toEqual({ startKey: "2026-08-03", endKey: "2026-08-03" });
  });

  it("covers the exclusive end minus one day for a multi-day all-day event", () => {
    const span = occurrenceDateSpan({
      startAt: "2026-08-03T00:00:00.000Z",
      endAt: "2026-08-06T00:00:00.000Z", // exclusive end
      isAllDay: true,
    });
    expect(span).toEqual({ startKey: "2026-08-03", endKey: "2026-08-05" });
  });
});

describe("groupOccurrencesByDate", () => {
  const visibleDates = getWeekDates("2026-08-06");

  it("places a single-day occurrence only on its own date", () => {
    const grouped = groupOccurrencesByDate(
      [{ startAt: "2026-08-05T09:00:00.000Z", endAt: "2026-08-05T11:00:00.000Z", isAllDay: false }],
      visibleDates,
    );
    expect(grouped.get("2026-08-05")).toHaveLength(1);
    expect(grouped.get("2026-08-04")).toHaveLength(0);
  });

  it("places a multi-day occurrence on every day it spans", () => {
    // Exclusive end (isAllDay) -> covers Aug 4, 5, 6 only, not Aug 7.
    const occurrence = { startAt: "2026-08-04T00:00:00.000Z", endAt: "2026-08-07T00:00:00.000Z", isAllDay: true };
    const grouped = groupOccurrencesByDate([occurrence], visibleDates);
    expect(grouped.get("2026-08-04")).toEqual([occurrence]);
    expect(grouped.get("2026-08-05")).toEqual([occurrence]);
    expect(grouped.get("2026-08-06")).toEqual([occurrence]);
    expect(grouped.get("2026-08-07")).toEqual([]);
    expect(grouped.get("2026-08-08")).toEqual([]);
  });

  it("clamps a span extending outside the visible range", () => {
    const firstVisible = visibleDates[0] as string;
    const lastVisible = visibleDates[visibleDates.length - 1] as string;
    const occurrence = {
      startAt: addDaysToKey(firstVisible, -5) + "T00:00:00.000Z",
      endAt: addDaysToKey(lastVisible, 5) + "T00:00:00.000Z",
      isAllDay: true,
    };
    const grouped = groupOccurrencesByDate([occurrence], visibleDates);
    for (const date of visibleDates) {
      expect(grouped.get(date)).toEqual([occurrence]);
    }
  });
});
