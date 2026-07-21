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
      { weekday: "WEDNESDAY", attends: true, startTime: "12:00", endTime: "20:00", effectiveFrom: "2000-01-01", createdAt: "2000-01-01T00:00:00.000Z" },
      { weekday: "WEDNESDAY", attends: true, startTime: "14:00", endTime: "18:00", effectiveFrom: "2026-07-22", createdAt: "2026-07-22T09:00:00.000Z" },
    ];
    expect(resolveMemberWeeklyForWeekday(versions, "WEDNESDAY", "2026-07-15")).toEqual({
      attends: true,
      startTime: "12:00",
      endTime: "20:00",
    });
    expect(resolveMemberWeeklyForWeekday(versions, "WEDNESDAY", "2026-07-29")).toEqual({
      attends: true,
      startTime: "14:00",
      endTime: "18:00",
    });
  });
});

describe("resolveMemberDay — precedence", () => {
  const weeklyVersions: MemberWeeklyVersion[] = [
    { weekday: "FRIDAY", attends: true, startTime: "12:00", endTime: "20:00", effectiveFrom: "2000-01-01", createdAt: "2000-01-01T00:00:00.000Z" },
  ];
  const exceptions: AttendanceExceptionRow[] = [
    { date: "2026-07-24", status: "NOT_ATTENDING", startTime: null, endTime: null },
  ];

  it("falls back to the office default (as of member creation) when no personal weekly row exists", () => {
    // 2026-07-20 is a Monday; member has no MONDAY weekly row.
    const result = resolveMemberDay([], [], officeDefaults(), "2026-01-01", "2026-07-20");
    expect(result).toEqual({ status: "ATTENDING", enteredStartTime: "12:00", enteredEndTime: "20:00" });
  });

  it("prefers the personal weekly schedule over the office-default fallback", () => {
    const customWeekly: MemberWeeklyVersion[] = [
      { weekday: "WEDNESDAY", attends: true, startTime: "14:00", endTime: "18:00", effectiveFrom: "2000-01-01", createdAt: "2000-01-01T00:00:00.000Z" },
    ];
    const result = resolveMemberDay(customWeekly, [], officeDefaults(), "2026-01-01", "2026-07-22");
    expect(result).toEqual({ status: "ATTENDING", enteredStartTime: "14:00", enteredEndTime: "18:00" });
  });

  it("a date exception always wins over the personal weekly schedule", () => {
    // 2026-07-24 is a Friday; weekly schedule says ATTENDING, exception says NOT_ATTENDING.
    const result = resolveMemberDay(weeklyVersions, exceptions, officeDefaults(), "2026-01-01", "2026-07-24");
    expect(result).toEqual({ status: "NOT_ATTENDING", enteredStartTime: null, enteredEndTime: null });
  });

  it("other Fridays without an exception still use the weekly schedule", () => {
    const result = resolveMemberDay(weeklyVersions, exceptions, officeDefaults(), "2026-01-01", "2026-07-31");
    expect(result).toEqual({ status: "ATTENDING", enteredStartTime: "12:00", enteredEndTime: "20:00" });
  });

  it("an explicit 'not attending' weekly row overrides the office-default fallback", () => {
    const explicitAbsence: MemberWeeklyVersion[] = [
      { weekday: "MONDAY", attends: false, startTime: null, endTime: null, effectiveFrom: "2000-01-01", createdAt: "2000-01-01T00:00:00.000Z" },
    ];
    const result = resolveMemberDay(explicitAbsence, [], officeDefaults(), "2026-01-01", "2026-07-20");
    expect(result).toEqual({ status: "NOT_ATTENDING", enteredStartTime: null, enteredEndTime: null });
  });

  it("inherits closed-by-default weekdays (e.g. Tuesday) as not attending", () => {
    const result = resolveMemberDay([], [], officeDefaults(), "2026-01-01", "2026-07-21");
    expect(result).toEqual({ status: "NOT_ATTENDING", enteredStartTime: null, enteredEndTime: null });
  });
});

describe("clampToOfficeHours", () => {
  const openOffice = { isOpen: true, startTime: "12:00", endTime: "20:00" };
  const closedOffice = { isOpen: false, startTime: null, endTime: null };

  it("does not clamp when the entered interval is fully inside office hours", () => {
    const result = clampToOfficeHours(
      { status: "ATTENDING", enteredStartTime: "13:00", enteredEndTime: "18:00" },
      openOffice,
    );
    expect(result).toMatchObject({ publicStartTime: "13:00", publicEndTime: "18:00", isClamped: false });
  });

  it("clamps an interval that starts before office hours", () => {
    const result = clampToOfficeHours(
      { status: "ATTENDING", enteredStartTime: "09:00", enteredEndTime: "14:00" },
      openOffice,
    );
    expect(result).toMatchObject({ publicStartTime: "12:00", publicEndTime: "14:00", isClamped: true });
    expect(result.enteredStartTime).toBe("09:00");
  });

  it("clamps an interval that ends after office hours", () => {
    const result = clampToOfficeHours(
      { status: "NOT_SURE", enteredStartTime: "18:00", enteredEndTime: "23:00" },
      openOffice,
    );
    expect(result).toMatchObject({ publicStartTime: "18:00", publicEndTime: "20:00", isClamped: true });
  });

  it("reports no public interval when the entered interval doesn't overlap office hours at all", () => {
    const result = clampToOfficeHours(
      { status: "ATTENDING", enteredStartTime: "07:00", enteredEndTime: "09:00" },
      openOffice,
    );
    expect(result).toMatchObject({ publicStartTime: null, publicEndTime: null, isClamped: true });
  });

  it("reports no public interval when the office is closed, without touching the entered interval", () => {
    const result = clampToOfficeHours(
      { status: "ATTENDING", enteredStartTime: "12:00", enteredEndTime: "20:00" },
      closedOffice,
    );
    expect(result).toMatchObject({
      officeIsOpen: false,
      publicStartTime: null,
      publicEndTime: null,
      isClamped: false,
      enteredStartTime: "12:00",
      enteredEndTime: "20:00",
    });
  });

  it("reports no public interval for NOT_ATTENDING", () => {
    const result = clampToOfficeHours({ status: "NOT_ATTENDING", enteredStartTime: null, enteredEndTime: null }, openOffice);
    expect(result).toMatchObject({ publicStartTime: null, publicEndTime: null, isClamped: false });
  });
});
