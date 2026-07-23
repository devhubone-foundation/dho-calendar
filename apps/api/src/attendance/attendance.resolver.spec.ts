import type { OfficeDefaultVersion } from "../office-schedule/office-schedule.resolver";
import {
  type AttendanceExceptionRow,
  type MemberWeeklyVersion,
  clampToOfficeHours,
  resolveMemberDay,
  resolveMemberWeeklyForWeekday,
} from "./attendance.resolver";

const SEED_EFFECTIVE_FROM = "2000-01-01";

function officeDefaults(): OfficeDefaultVersion[] {
  return [
    { weekday: "MONDAY", isOpen: true, startTime: "12:00", endTime: "20:00", effectiveFrom: SEED_EFFECTIVE_FROM, createdAt: "2000-01-01T00:00:00.000Z" },
    { weekday: "TUESDAY", isOpen: false, startTime: null, endTime: null, effectiveFrom: SEED_EFFECTIVE_FROM, createdAt: "2000-01-01T00:00:00.000Z" },
    { weekday: "WEDNESDAY", isOpen: true, startTime: "12:00", endTime: "20:00", effectiveFrom: SEED_EFFECTIVE_FROM, createdAt: "2000-01-01T00:00:00.000Z" },
    { weekday: "FRIDAY", isOpen: true, startTime: "12:00", endTime: "20:00", effectiveFrom: SEED_EFFECTIVE_FROM, createdAt: "2000-01-01T00:00:00.000Z" },
  ];
}

describe("resolveMemberWeeklyForWeekday", () => {
  it("returns null when the member has never saved that weekday", () => {
    expect(resolveMemberWeeklyForWeekday([], "MONDAY", "2026-07-20")).toBeNull();
  });

  it("is future-only, like office defaults", () => {
    const versions: MemberWeeklyVersion[] = [
      { weekday: "WEDNESDAY", attends: true, slots: [{ startTime: "12:00", endTime: "20:00" }], effectiveFrom: "2000-01-01", createdAt: "2000-01-01T00:00:00.000Z" },
      { weekday: "WEDNESDAY", attends: true, slots: [{ startTime: "14:00", endTime: "18:00" }], effectiveFrom: "2026-07-22", createdAt: "2026-07-22T09:00:00.000Z" },
    ];
    expect(resolveMemberWeeklyForWeekday(versions, "WEDNESDAY", "2026-07-15")).toEqual({
      attends: true,
      slots: [{ startTime: "12:00", endTime: "20:00" }],
    });
    expect(resolveMemberWeeklyForWeekday(versions, "WEDNESDAY", "2026-07-29")).toEqual({
      attends: true,
      slots: [{ startTime: "14:00", endTime: "18:00" }],
    });
  });

  it("resolves multiple slots for one weekday version", () => {
    const versions: MemberWeeklyVersion[] = [
      {
        weekday: "MONDAY",
        attends: true,
        slots: [
          { startTime: "10:00", endTime: "12:00" },
          { startTime: "14:00", endTime: "18:00" },
        ],
        effectiveFrom: "2000-01-01",
        createdAt: "2000-01-01T00:00:00.000Z",
      },
    ];
    expect(resolveMemberWeeklyForWeekday(versions, "MONDAY", "2026-07-20")).toEqual({
      attends: true,
      slots: [
        { startTime: "10:00", endTime: "12:00" },
        { startTime: "14:00", endTime: "18:00" },
      ],
    });
  });
});

describe("resolveMemberDay — precedence", () => {
  const weeklyVersions: MemberWeeklyVersion[] = [
    { weekday: "FRIDAY", attends: true, slots: [{ startTime: "12:00", endTime: "20:00" }], effectiveFrom: "2000-01-01", createdAt: "2000-01-01T00:00:00.000Z" },
  ];
  const exceptions: AttendanceExceptionRow[] = [
    { date: "2026-07-24", status: "NOT_ATTENDING", slots: [] },
  ];

  it("falls back to the office default (as of member creation) when no personal weekly row exists", () => {
    // 2026-07-20 is a Monday; member has no MONDAY weekly row.
    const result = resolveMemberDay([], [], officeDefaults(), "2026-01-01", "2026-07-20");
    expect(result).toEqual({
      status: "ATTENDING",
      enteredSlots: [{ startTime: "12:00", endTime: "20:00" }],
      isCustomized: false,
    });
  });

  it("prefers the personal weekly schedule over the office-default fallback", () => {
    const customWeekly: MemberWeeklyVersion[] = [
      { weekday: "WEDNESDAY", attends: true, slots: [{ startTime: "14:00", endTime: "18:00" }], effectiveFrom: "2000-01-01", createdAt: "2000-01-01T00:00:00.000Z" },
    ];
    const result = resolveMemberDay(customWeekly, [], officeDefaults(), "2026-01-01", "2026-07-22");
    expect(result).toEqual({
      status: "ATTENDING",
      enteredSlots: [{ startTime: "14:00", endTime: "18:00" }],
      isCustomized: false,
    });
  });

  it("resolves multiple slots from the personal weekly schedule", () => {
    const multiSlotWeekly: MemberWeeklyVersion[] = [
      {
        weekday: "WEDNESDAY",
        attends: true,
        slots: [
          { startTime: "10:00", endTime: "12:00" },
          { startTime: "14:00", endTime: "18:00" },
        ],
        effectiveFrom: "2000-01-01",
        createdAt: "2000-01-01T00:00:00.000Z",
      },
    ];
    const result = resolveMemberDay(multiSlotWeekly, [], officeDefaults(), "2026-01-01", "2026-07-22");
    expect(result).toEqual({
      status: "ATTENDING",
      enteredSlots: [
        { startTime: "10:00", endTime: "12:00" },
        { startTime: "14:00", endTime: "18:00" },
      ],
      isCustomized: false,
    });
  });

  it("a date exception always wins over the personal weekly schedule", () => {
    // 2026-07-24 is a Friday; weekly schedule says ATTENDING, exception says NOT_ATTENDING.
    const result = resolveMemberDay(weeklyVersions, exceptions, officeDefaults(), "2026-01-01", "2026-07-24");
    expect(result).toEqual({ status: "NOT_ATTENDING", enteredSlots: [], isCustomized: true });
  });

  it("resolves multiple slots from a date-specific exception", () => {
    const multiSlotException: AttendanceExceptionRow[] = [
      {
        date: "2026-07-24",
        status: "ATTENDING",
        slots: [
          { startTime: "09:00", endTime: "11:00" },
          { startTime: "13:00", endTime: "17:00" },
        ],
      },
    ];
    const result = resolveMemberDay(weeklyVersions, multiSlotException, officeDefaults(), "2026-01-01", "2026-07-24");
    expect(result).toEqual({
      status: "ATTENDING",
      enteredSlots: [
        { startTime: "09:00", endTime: "11:00" },
        { startTime: "13:00", endTime: "17:00" },
      ],
      isCustomized: true,
    });
  });

  it("other Fridays without an exception still use the weekly schedule", () => {
    const result = resolveMemberDay(weeklyVersions, exceptions, officeDefaults(), "2026-01-01", "2026-07-31");
    expect(result).toEqual({
      status: "ATTENDING",
      enteredSlots: [{ startTime: "12:00", endTime: "20:00" }],
      isCustomized: false,
    });
  });

  it("an explicit 'not attending' weekly row overrides the office-default fallback", () => {
    const explicitAbsence: MemberWeeklyVersion[] = [
      { weekday: "MONDAY", attends: false, slots: [], effectiveFrom: "2000-01-01", createdAt: "2000-01-01T00:00:00.000Z" },
    ];
    const result = resolveMemberDay(explicitAbsence, [], officeDefaults(), "2026-01-01", "2026-07-20");
    expect(result).toEqual({ status: "NOT_ATTENDING", enteredSlots: [], isCustomized: false });
  });

  it("inherits closed-by-default weekdays (e.g. Tuesday) as not attending", () => {
    const result = resolveMemberDay([], [], officeDefaults(), "2026-01-01", "2026-07-21");
    expect(result).toEqual({ status: "NOT_ATTENDING", enteredSlots: [], isCustomized: false });
  });
});

describe("clampToOfficeHours", () => {
  const openOffice = { isOpen: true, startTime: "12:00", endTime: "20:00" };
  const closedOffice = { isOpen: false, startTime: null, endTime: null };

  it("does not clamp when the entered slot is fully inside office hours", () => {
    const result = clampToOfficeHours(
      { status: "ATTENDING", enteredSlots: [{ startTime: "13:00", endTime: "18:00" }], isCustomized: false },
      openOffice,
    );
    expect(result).toMatchObject({ publicSlots: [{ startTime: "13:00", endTime: "18:00" }], isClamped: false });
  });

  it("clamps a slot that starts before office hours", () => {
    const result = clampToOfficeHours(
      { status: "ATTENDING", enteredSlots: [{ startTime: "09:00", endTime: "14:00" }], isCustomized: false },
      openOffice,
    );
    expect(result).toMatchObject({ publicSlots: [{ startTime: "12:00", endTime: "14:00" }], isClamped: true });
    expect(result.enteredSlots).toEqual([{ startTime: "09:00", endTime: "14:00" }]);
  });

  it("clamps a slot that ends after office hours", () => {
    const result = clampToOfficeHours(
      { status: "NOT_SURE", enteredSlots: [{ startTime: "18:00", endTime: "23:00" }], isCustomized: false },
      openOffice,
    );
    expect(result).toMatchObject({ publicSlots: [{ startTime: "18:00", endTime: "20:00" }], isClamped: true });
  });

  it("keeps only the overlapping slots and clamps each independently", () => {
    const result = clampToOfficeHours(
      {
        status: "ATTENDING",
        enteredSlots: [
          { startTime: "09:00", endTime: "13:00" },
          { startTime: "14:00", endTime: "22:00" },
        ],
        isCustomized: false,
      },
      openOffice,
    );
    expect(result).toMatchObject({
      publicSlots: [
        { startTime: "12:00", endTime: "13:00" },
        { startTime: "14:00", endTime: "20:00" },
      ],
      isClamped: true,
    });
  });

  it("drops a slot with zero overlap with office hours", () => {
    const result = clampToOfficeHours(
      { status: "ATTENDING", enteredSlots: [{ startTime: "07:00", endTime: "09:00" }], isCustomized: false },
      openOffice,
    );
    expect(result).toMatchObject({ publicSlots: [], isClamped: true });
  });

  it("reports no public slots for NOT_SURE when the office is closed, without touching entered slots", () => {
    const result = clampToOfficeHours(
      { status: "NOT_SURE", enteredSlots: [{ startTime: "12:00", endTime: "20:00" }], isCustomized: false },
      closedOffice,
    );
    expect(result).toMatchObject({
      officeIsOpen: false,
      publicSlots: [],
      isClamped: false,
      enteredSlots: [{ startTime: "12:00", endTime: "20:00" }],
    });
  });

  it("passes entered slots through unclamped for ATTENDING when the office is closed (PRODUCT_BLUEPRINT.md §12.8/§13 override)", () => {
    const result = clampToOfficeHours(
      { status: "ATTENDING", enteredSlots: [{ startTime: "09:00", endTime: "13:00" }], isCustomized: false },
      closedOffice,
    );
    expect(result).toMatchObject({
      officeIsOpen: false,
      publicSlots: [{ startTime: "09:00", endTime: "13:00" }],
      isClamped: false,
      enteredSlots: [{ startTime: "09:00", endTime: "13:00" }],
    });
  });

  it("reports no public slots for NOT_ATTENDING when the office is closed", () => {
    const result = clampToOfficeHours({ status: "NOT_ATTENDING", enteredSlots: [], isCustomized: false }, closedOffice);
    expect(result).toMatchObject({ publicSlots: [], isClamped: false });
  });

  it("reports no public slots for NOT_ATTENDING", () => {
    const result = clampToOfficeHours({ status: "NOT_ATTENDING", enteredSlots: [], isCustomized: false }, openOffice);
    expect(result).toMatchObject({ publicSlots: [], isClamped: false });
  });
});
