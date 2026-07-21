import {
  type OfficeDefaultVersion,
  type OfficeExceptionRow,
  resolveOfficeDay,
  resolveOfficeDefault,
  resolveOfficeDefaultForWeekday,
  resolveOfficeRange,
} from "./office-schedule.resolver";

const SEED_EFFECTIVE_FROM = "2000-01-01";

function seedDefaults(): OfficeDefaultVersion[] {
  return [
    { weekday: "MONDAY", isOpen: true, startTime: "12:00", endTime: "20:00", effectiveFrom: SEED_EFFECTIVE_FROM, createdAt: "2000-01-01T00:00:00.000Z" },
    { weekday: "TUESDAY", isOpen: false, startTime: null, endTime: null, effectiveFrom: SEED_EFFECTIVE_FROM, createdAt: "2000-01-01T00:00:00.000Z" },
    { weekday: "WEDNESDAY", isOpen: true, startTime: "12:00", endTime: "20:00", effectiveFrom: SEED_EFFECTIVE_FROM, createdAt: "2000-01-01T00:00:00.000Z" },
    { weekday: "THURSDAY", isOpen: false, startTime: null, endTime: null, effectiveFrom: SEED_EFFECTIVE_FROM, createdAt: "2000-01-01T00:00:00.000Z" },
    { weekday: "FRIDAY", isOpen: true, startTime: "12:00", endTime: "20:00", effectiveFrom: SEED_EFFECTIVE_FROM, createdAt: "2000-01-01T00:00:00.000Z" },
    { weekday: "SATURDAY", isOpen: false, startTime: null, endTime: null, effectiveFrom: SEED_EFFECTIVE_FROM, createdAt: "2000-01-01T00:00:00.000Z" },
    { weekday: "SUNDAY", isOpen: false, startTime: null, endTime: null, effectiveFrom: SEED_EFFECTIVE_FROM, createdAt: "2000-01-01T00:00:00.000Z" },
  ];
}

describe("resolveOfficeDefault", () => {
  it("resolves the seeded Mon/Wed/Fri 12-20 defaults", () => {
    // 2026-07-20 = Monday
    expect(resolveOfficeDefault(seedDefaults(), "2026-07-20")).toEqual({
      isOpen: true,
      startTime: "12:00",
      endTime: "20:00",
    });
    // 2026-07-21 = Tuesday
    expect(resolveOfficeDefault(seedDefaults(), "2026-07-21")).toEqual({
      isOpen: false,
      startTime: null,
      endTime: null,
    });
  });

  it("is future-only: a same-day edit does not change a past date's resolution", () => {
    const versions = [
      ...seedDefaults(),
      // Admin changes Wednesday hours effective 2026-07-22 (today).
      { weekday: "WEDNESDAY" as const, isOpen: true, startTime: "14:00", endTime: "18:00", effectiveFrom: "2026-07-22", createdAt: "2026-07-22T09:00:00.000Z" },
    ];

    // A past Wednesday still resolves to the original seeded hours.
    expect(resolveOfficeDefault(versions, "2026-07-15")).toEqual({
      isOpen: true,
      startTime: "12:00",
      endTime: "20:00",
    });
    // Today and future Wednesdays use the new hours.
    expect(resolveOfficeDefault(versions, "2026-07-22")).toEqual({
      isOpen: true,
      startTime: "14:00",
      endTime: "18:00",
    });
    expect(resolveOfficeDefault(versions, "2026-07-29")).toEqual({
      isOpen: true,
      startTime: "14:00",
      endTime: "18:00",
    });
    // Other weekdays (Monday, Friday) are untouched.
    expect(resolveOfficeDefault(versions, "2026-07-27")).toEqual({
      isOpen: true,
      startTime: "12:00",
      endTime: "20:00",
    });
  });

  it("breaks ties between same-effectiveFrom versions using createdAt", () => {
    const versions: OfficeDefaultVersion[] = [
      { weekday: "MONDAY", isOpen: true, startTime: "12:00", endTime: "20:00", effectiveFrom: "2026-07-20", createdAt: "2026-07-20T09:00:00.000Z" },
      { weekday: "MONDAY", isOpen: true, startTime: "13:00", endTime: "19:00", effectiveFrom: "2026-07-20", createdAt: "2026-07-20T10:00:00.000Z" },
    ];
    expect(resolveOfficeDefault(versions, "2026-07-20")).toEqual({
      isOpen: true,
      startTime: "13:00",
      endTime: "19:00",
    });
  });

  it("falls back to closed when no version exists yet for a weekday", () => {
    expect(resolveOfficeDefault([], "2026-07-20")).toEqual({
      isOpen: false,
      startTime: null,
      endTime: null,
    });
  });
});

describe("resolveOfficeDefaultForWeekday", () => {
  it("resolves an arbitrary weekday as of a given date, independent of that date's own weekday", () => {
    // Asking "what is Wednesday's default as of 2026-07-20 (a Monday)?"
    expect(resolveOfficeDefaultForWeekday(seedDefaults(), "WEDNESDAY", "2026-07-20")).toEqual({
      isOpen: true,
      startTime: "12:00",
      endTime: "20:00",
    });
  });
});

describe("resolveOfficeDay", () => {
  const exceptions: OfficeExceptionRow[] = [
    { date: "2026-07-22", isOpen: false, startTime: null, endTime: null },
    { date: "2026-07-23", isOpen: true, startTime: "10:00", endTime: "16:00" },
  ];

  it("uses the default when there is no exception", () => {
    expect(resolveOfficeDay(seedDefaults(), exceptions, "2026-07-20")).toMatchObject({
      isOpen: true,
      startTime: "12:00",
      endTime: "20:00",
      source: "DEFAULT",
    });
  });

  it("closes a normally-open date via exception", () => {
    // 2026-07-22 is a Wednesday, normally open.
    expect(resolveOfficeDay(seedDefaults(), exceptions, "2026-07-22")).toMatchObject({
      isOpen: false,
      startTime: null,
      endTime: null,
      source: "EXCEPTION",
    });
  });

  it("opens a normally-closed date via exception with changed hours", () => {
    // 2026-07-23 is a Thursday, normally closed.
    expect(resolveOfficeDay(seedDefaults(), exceptions, "2026-07-23")).toMatchObject({
      isOpen: true,
      startTime: "10:00",
      endTime: "16:00",
      source: "EXCEPTION",
    });
  });
});

describe("resolveOfficeRange", () => {
  it("resolves each date in the inclusive range", () => {
    const result = resolveOfficeRange(seedDefaults(), [], "2026-07-20", "2026-07-22");
    expect(result.map((day) => day.date)).toEqual(["2026-07-20", "2026-07-21", "2026-07-22"]);
    expect(result[0]).toMatchObject({ isOpen: true }); // Monday
    expect(result[1]).toMatchObject({ isOpen: false }); // Tuesday
    expect(result[2]).toMatchObject({ isOpen: true }); // Wednesday
  });
});
