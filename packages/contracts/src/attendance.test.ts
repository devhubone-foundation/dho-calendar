import { describe, expect, it } from "vitest";

import {
  attendanceExceptionInputSchema,
  updateWeeklyScheduleRequestSchema,
  weeklyScheduleDayInputSchema,
} from "./attendance";

describe("weeklyScheduleDayInputSchema", () => {
  it("accepts attending with valid hours", () => {
    expect(() =>
      weeklyScheduleDayInputSchema.parse({
        weekday: "MONDAY",
        attends: true,
        startTime: "12:00",
        endTime: "20:00",
      }),
    ).not.toThrow();
  });

  it("accepts not attending with no hours", () => {
    expect(() =>
      weeklyScheduleDayInputSchema.parse({
        weekday: "TUESDAY",
        attends: false,
        startTime: null,
        endTime: null,
      }),
    ).not.toThrow();
  });

  it("rejects attending without hours", () => {
    expect(() =>
      weeklyScheduleDayInputSchema.parse({
        weekday: "MONDAY",
        attends: true,
        startTime: null,
        endTime: null,
      }),
    ).toThrow();
  });

  it("rejects not-attending carrying stray hours", () => {
    expect(() =>
      weeklyScheduleDayInputSchema.parse({
        weekday: "TUESDAY",
        attends: false,
        startTime: "12:00",
        endTime: "20:00",
      }),
    ).toThrow();
  });
});

describe("updateWeeklyScheduleRequestSchema", () => {
  it("accepts a partial week update", () => {
    expect(() =>
      updateWeeklyScheduleRequestSchema.parse({
        days: [{ weekday: "FRIDAY", attends: false, startTime: null, endTime: null }],
      }),
    ).not.toThrow();
  });
});

describe("attendanceExceptionInputSchema", () => {
  it("requires hours for ATTENDING", () => {
    expect(() =>
      attendanceExceptionInputSchema.parse({ status: "ATTENDING", startTime: null, endTime: null }),
    ).toThrow();
    expect(() =>
      attendanceExceptionInputSchema.parse({
        status: "ATTENDING",
        startTime: "09:00",
        endTime: "17:00",
      }),
    ).not.toThrow();
  });

  it("requires hours for NOT_SURE", () => {
    expect(() =>
      attendanceExceptionInputSchema.parse({ status: "NOT_SURE", startTime: null, endTime: null }),
    ).toThrow();
    expect(() =>
      attendanceExceptionInputSchema.parse({
        status: "NOT_SURE",
        startTime: "09:00",
        endTime: "17:00",
      }),
    ).not.toThrow();
  });

  it("forbids hours for NOT_ATTENDING", () => {
    expect(() =>
      attendanceExceptionInputSchema.parse({
        status: "NOT_ATTENDING",
        startTime: "09:00",
        endTime: "17:00",
      }),
    ).toThrow();
    expect(() =>
      attendanceExceptionInputSchema.parse({
        status: "NOT_ATTENDING",
        startTime: null,
        endTime: null,
      }),
    ).not.toThrow();
  });

  it("rejects end time not after start time", () => {
    expect(() =>
      attendanceExceptionInputSchema.parse({
        status: "ATTENDING",
        startTime: "17:00",
        endTime: "09:00",
      }),
    ).toThrow();
  });
});
