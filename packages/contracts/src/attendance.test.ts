import { describe, expect, it } from "vitest";

import {
  attendanceExceptionInputSchema,
  attendanceSlotSchema,
  updateWeeklyScheduleRequestSchema,
  weeklyScheduleDayInputSchema,
} from "./attendance";

describe("attendanceSlotSchema", () => {
  it("accepts a valid slot", () => {
    expect(() => attendanceSlotSchema.parse({ startTime: "10:00", endTime: "12:00" })).not.toThrow();
  });

  it("rejects end time not after start time", () => {
    expect(() => attendanceSlotSchema.parse({ startTime: "12:00", endTime: "12:00" })).toThrow();
    expect(() => attendanceSlotSchema.parse({ startTime: "17:00", endTime: "09:00" })).toThrow();
  });
});

describe("weeklyScheduleDayInputSchema", () => {
  it("accepts attending with one valid slot", () => {
    expect(() =>
      weeklyScheduleDayInputSchema.parse({
        weekday: "MONDAY",
        attends: true,
        slots: [{ startTime: "12:00", endTime: "20:00" }],
      }),
    ).not.toThrow();
  });

  it("accepts attending with multiple non-overlapping slots", () => {
    expect(() =>
      weeklyScheduleDayInputSchema.parse({
        weekday: "MONDAY",
        attends: true,
        slots: [
          { startTime: "10:00", endTime: "12:00" },
          { startTime: "14:00", endTime: "18:00" },
        ],
      }),
    ).not.toThrow();
  });

  it("accepts touching slots as two separate slots", () => {
    expect(() =>
      weeklyScheduleDayInputSchema.parse({
        weekday: "MONDAY",
        attends: true,
        slots: [
          { startTime: "10:00", endTime: "12:00" },
          { startTime: "12:00", endTime: "14:00" },
        ],
      }),
    ).not.toThrow();
  });

  it("accepts not attending with no slots", () => {
    expect(() =>
      weeklyScheduleDayInputSchema.parse({ weekday: "TUESDAY", attends: false, slots: [] }),
    ).not.toThrow();
  });

  it("rejects attending without any slots", () => {
    expect(() =>
      weeklyScheduleDayInputSchema.parse({ weekday: "MONDAY", attends: true, slots: [] }),
    ).toThrow();
  });

  it("rejects not-attending carrying stray slots", () => {
    expect(() =>
      weeklyScheduleDayInputSchema.parse({
        weekday: "TUESDAY",
        attends: false,
        slots: [{ startTime: "12:00", endTime: "20:00" }],
      }),
    ).toThrow();
  });

  it("rejects overlapping slots", () => {
    expect(() =>
      weeklyScheduleDayInputSchema.parse({
        weekday: "MONDAY",
        attends: true,
        slots: [
          { startTime: "10:00", endTime: "13:00" },
          { startTime: "12:00", endTime: "18:00" },
        ],
      }),
    ).toThrow();
  });

  it("rejects duplicate slots", () => {
    expect(() =>
      weeklyScheduleDayInputSchema.parse({
        weekday: "MONDAY",
        attends: true,
        slots: [
          { startTime: "10:00", endTime: "12:00" },
          { startTime: "10:00", endTime: "12:00" },
        ],
      }),
    ).toThrow();
  });
});

describe("updateWeeklyScheduleRequestSchema", () => {
  it("accepts a partial week update", () => {
    expect(() =>
      updateWeeklyScheduleRequestSchema.parse({
        days: [{ weekday: "FRIDAY", attends: false, slots: [] }],
      }),
    ).not.toThrow();
  });
});

describe("attendanceExceptionInputSchema", () => {
  it("requires slots for ATTENDING", () => {
    expect(() => attendanceExceptionInputSchema.parse({ status: "ATTENDING", slots: [] })).toThrow();
    expect(() =>
      attendanceExceptionInputSchema.parse({
        status: "ATTENDING",
        slots: [{ startTime: "09:00", endTime: "17:00" }],
      }),
    ).not.toThrow();
  });

  it("requires slots for NOT_SURE", () => {
    expect(() => attendanceExceptionInputSchema.parse({ status: "NOT_SURE", slots: [] })).toThrow();
    expect(() =>
      attendanceExceptionInputSchema.parse({
        status: "NOT_SURE",
        slots: [{ startTime: "09:00", endTime: "17:00" }],
      }),
    ).not.toThrow();
  });

  it("forbids slots for NOT_ATTENDING", () => {
    expect(() =>
      attendanceExceptionInputSchema.parse({
        status: "NOT_ATTENDING",
        slots: [{ startTime: "09:00", endTime: "17:00" }],
      }),
    ).toThrow();
    expect(() =>
      attendanceExceptionInputSchema.parse({ status: "NOT_ATTENDING", slots: [] }),
    ).not.toThrow();
  });

  it("accepts multiple non-overlapping slots", () => {
    expect(() =>
      attendanceExceptionInputSchema.parse({
        status: "ATTENDING",
        slots: [
          { startTime: "10:00", endTime: "12:00" },
          { startTime: "14:00", endTime: "18:00" },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects overlapping slots", () => {
    expect(() =>
      attendanceExceptionInputSchema.parse({
        status: "ATTENDING",
        slots: [
          { startTime: "10:00", endTime: "13:00" },
          { startTime: "12:00", endTime: "18:00" },
        ],
      }),
    ).toThrow();
  });

  it("rejects duplicate slots", () => {
    expect(() =>
      attendanceExceptionInputSchema.parse({
        status: "ATTENDING",
        slots: [
          { startTime: "10:00", endTime: "12:00" },
          { startTime: "10:00", endTime: "12:00" },
        ],
      }),
    ).toThrow();
  });

  it("rejects a slot with end time not after start time", () => {
    expect(() =>
      attendanceExceptionInputSchema.parse({
        status: "ATTENDING",
        slots: [{ startTime: "17:00", endTime: "09:00" }],
      }),
    ).toThrow();
  });
});
