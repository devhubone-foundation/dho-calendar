import {
  buildOccurrenceContent,
  computeSplitForFutureEdit,
  type EventExceptionForExpansion,
  type EventSeriesForExpansion,
  type EventSeriesPattern,
  expandOccurrences,
  generatePatternDates,
  isValidOccurrenceDate,
} from "./events.recurrence";

// 2026-08-03 is a Monday.
const MONDAY = "2026-08-03";
const WEDNESDAY = "2026-08-05";
const FRIDAY = "2026-08-07";

function pattern(overrides: Partial<EventSeriesPattern> = {}): EventSeriesPattern {
  return {
    frequency: "WEEKLY",
    byWeekdays: ["MONDAY"],
    recurrenceEndType: "COUNT",
    recurrenceCount: 3,
    recurrenceUntil: null,
    endsBeforeDate: null,
    anchorStartDate: MONDAY,
    ...overrides,
  };
}

function series(overrides: Partial<EventSeriesForExpansion> = {}): EventSeriesForExpansion {
  return {
    ...pattern(),
    titleBg: "Работилница",
    titleEn: "Workshop",
    descriptionBg: "Описание",
    descriptionEn: "Description",
    startAt: new Date(`${MONDAY}T09:00:00.000Z`),
    endAt: new Date(`${MONDAY}T11:00:00.000Z`),
    isAllDay: false,
    location: "Office",
    coverImagePath: null,
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("generatePatternDates", () => {
  it("returns a single date for a non-recurring series", () => {
    expect(generatePatternDates(pattern({ frequency: "NONE" }), "2026-12-31")).toEqual([MONDAY]);
  });

  it("omits a non-recurring series' date once it is past the upper bound", () => {
    expect(generatePatternDates(pattern({ frequency: "NONE" }), "2026-08-02")).toEqual([]);
  });

  it("expands a single weekday up to COUNT", () => {
    expect(generatePatternDates(pattern(), "2026-12-31")).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
    ]);
  });

  it("expands multiple weekdays in chronological order within each week", () => {
    const dates = generatePatternDates(
      pattern({ byWeekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"], recurrenceCount: 6 }),
      "2026-12-31",
    );
    expect(dates).toEqual([MONDAY, WEDNESDAY, FRIDAY, "2026-08-10", "2026-08-12", "2026-08-14"]);
  });

  it("does not include a selected weekday from before the anchor date in week 0", () => {
    // Anchor is Wednesday; Monday of that same week must not appear.
    const dates = generatePatternDates(
      pattern({ anchorStartDate: WEDNESDAY, byWeekdays: ["MONDAY", "WEDNESDAY"], recurrenceCount: 3 }),
      "2026-12-31",
    );
    expect(dates).toEqual([WEDNESDAY, "2026-08-10", "2026-08-12"]);
  });

  it("stops at an UNTIL date inclusive", () => {
    const dates = generatePatternDates(
      pattern({ recurrenceEndType: "UNTIL", recurrenceCount: null, recurrenceUntil: "2026-08-10" }),
      "2026-12-31",
    );
    expect(dates).toEqual(["2026-08-03", "2026-08-10"]);
  });

  it("respects an upper-bound horizon shorter than COUNT/UNTIL", () => {
    expect(generatePatternDates(pattern({ recurrenceCount: 52 }), "2026-08-11")).toEqual([
      "2026-08-03",
      "2026-08-10",
    ]);
  });

  it("excludes dates on or after endsBeforeDate (a this+future split cap)", () => {
    const dates = generatePatternDates(pattern({ recurrenceCount: 10, endsBeforeDate: "2026-08-17" }), "2026-12-31");
    expect(dates).toEqual(["2026-08-03", "2026-08-10"]);
  });

  it("returns nothing once endsBeforeDate is at or before the anchor date", () => {
    expect(generatePatternDates(pattern({ endsBeforeDate: MONDAY }), "2026-12-31")).toEqual([]);
  });
});

describe("isValidOccurrenceDate", () => {
  it("is true for a generated pattern date", () => {
    expect(isValidOccurrenceDate(pattern(), "2026-08-10")).toBe(true);
  });

  it("is false for a date on a weekday that isn't selected", () => {
    expect(isValidOccurrenceDate(pattern(), FRIDAY)).toBe(false);
  });

  it("is false beyond COUNT", () => {
    expect(isValidOccurrenceDate(pattern({ recurrenceCount: 2 }), "2026-08-17")).toBe(false);
  });

  it("is true only for the anchor date on a non-recurring series", () => {
    const p = pattern({ frequency: "NONE" });
    expect(isValidOccurrenceDate(p, MONDAY)).toBe(true);
    expect(isValidOccurrenceDate(p, "2026-08-10")).toBe(false);
  });
});

describe("buildOccurrenceContent", () => {
  it("shifts start/end by the whole-day offset, preserving time-of-day and duration", () => {
    const content = buildOccurrenceContent(series(), "2026-08-17");
    expect(content.startAt.toISOString()).toBe("2026-08-17T09:00:00.000Z");
    expect(content.endAt.toISOString()).toBe("2026-08-17T11:00:00.000Z");
  });

  it("returns the original instants unchanged for the anchor date itself", () => {
    const content = buildOccurrenceContent(series(), MONDAY);
    expect(content.startAt.toISOString()).toBe(`${MONDAY}T09:00:00.000Z`);
  });
});

describe("expandOccurrences", () => {
  it("expands a recurring series with no exceptions", () => {
    const result = expandOccurrences(series(), [], "2026-08-01", "2026-12-31");
    expect(result.map((o) => o.occurrenceDate)).toEqual(["2026-08-03", "2026-08-10", "2026-08-17"]);
    expect(result.every((o) => !o.isException)).toBe(true);
  });

  it("excludes a cancelled occurrence", () => {
    const exceptions: EventExceptionForExpansion[] = [
      { occurrenceDate: "2026-08-10", isCancelled: true, override: null, updatedAt: new Date() },
    ];
    const result = expandOccurrences(series(), exceptions, "2026-08-01", "2026-12-31");
    expect(result.map((o) => o.occurrenceDate)).toEqual(["2026-08-03", "2026-08-17"]);
  });

  it("uses the override content and renders on the overridden date, keyed by the original date", () => {
    const overriddenStart = new Date("2026-08-12T14:00:00.000Z");
    const overriddenEnd = new Date("2026-08-12T16:00:00.000Z");
    const exceptionUpdatedAt = new Date("2026-07-20T00:00:00.000Z");
    const exceptions: EventExceptionForExpansion[] = [
      {
        occurrenceDate: "2026-08-10",
        isCancelled: false,
        override: {
          titleBg: "Преместена",
          titleEn: "Moved",
          descriptionBg: "",
          descriptionEn: "",
          startAt: overriddenStart,
          endAt: overriddenEnd,
          isAllDay: false,
          location: "Elsewhere",
        },
        updatedAt: exceptionUpdatedAt,
      },
    ];
    const result = expandOccurrences(series(), exceptions, "2026-08-01", "2026-12-31");
    const moved = result.find((o) => o.occurrenceDate === "2026-08-10");
    expect(moved).toBeDefined();
    expect(moved?.isException).toBe(true);
    expect(moved?.content.startAt).toEqual(overriddenStart);
    expect(moved?.content.titleEn).toBe("Moved");
    expect(moved?.updatedAt).toEqual(exceptionUpdatedAt);
    // Cover is never overridden per-occurrence.
    expect(moved?.coverImagePath).toBeNull();
  });

  it("includes a multi-day all-day event that starts before `from` but still overlaps it", () => {
    const multiDay = series({
      frequency: "NONE",
      recurrenceEndType: null,
      recurrenceCount: null,
      isAllDay: true,
      startAt: new Date("2026-08-01T00:00:00.000Z"),
      endAt: new Date("2026-08-04T00:00:00.000Z"), // exclusive end: covers Aug 1-3
    });
    const result = expandOccurrences(multiDay, [], "2026-08-03", "2026-08-31");
    expect(result).toHaveLength(1);

    const notOverlapping = expandOccurrences(multiDay, [], "2026-08-04", "2026-08-31");
    expect(notOverlapping).toHaveLength(0);
  });

  it("excludes occurrences entirely outside the requested range", () => {
    const result = expandOccurrences(series(), [], "2026-09-01", "2026-12-31");
    expect(result).toHaveLength(0);
  });
});

describe("computeSplitForFutureEdit", () => {
  it("subtracts consumed occurrences from a COUNT series", () => {
    const result = computeSplitForFutureEdit(pattern({ recurrenceCount: 5 }), "2026-08-17");
    expect(result).toEqual({ occurrencesBeforeSplit: 2, newRecurrenceCount: 3 });
  });

  it("carries the UNTIL date through unchanged", () => {
    const result = computeSplitForFutureEdit(
      pattern({ recurrenceEndType: "UNTIL", recurrenceCount: null, recurrenceUntil: "2026-09-01" }),
      "2026-08-17",
    );
    expect(result).toEqual({ occurrencesBeforeSplit: 2, newRecurrenceCount: null });
  });

  it("returns null for a non-recurring series", () => {
    expect(computeSplitForFutureEdit(pattern({ frequency: "NONE" }), MONDAY)).toBeNull();
  });

  it("returns null when the split date is not a real occurrence", () => {
    expect(computeSplitForFutureEdit(pattern(), FRIDAY)).toBeNull();
  });
});
