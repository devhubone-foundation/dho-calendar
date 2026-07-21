import { describe, expect, it } from "vitest";

import {
  officeScheduleDayInputSchema,
  officeScheduleExceptionInputSchema,
  updateOfficeDefaultsRequestSchema,
} from "./office-schedule";

describe("officeScheduleDayInputSchema", () => {
  it("accepts an open day with valid hours", () => {
    expect(() =>
      officeScheduleDayInputSchema.parse({
        weekday: "MONDAY",
        isOpen: true,
        startTime: "12:00",
        endTime: "20:00",
      }),
    ).not.toThrow();
  });

  it("accepts a closed day with no hours", () => {
    expect(() =>
      officeScheduleDayInputSchema.parse({
        weekday: "TUESDAY",
        isOpen: false,
        startTime: null,
        endTime: null,
      }),
    ).not.toThrow();
  });

  it("rejects an open day missing hours", () => {
    expect(() =>
      officeScheduleDayInputSchema.parse({
        weekday: "MONDAY",
        isOpen: true,
        startTime: null,
        endTime: null,
      }),
    ).toThrow();
  });

  it("rejects end time not after start time", () => {
    expect(() =>
      officeScheduleDayInputSchema.parse({
        weekday: "MONDAY",
        isOpen: true,
        startTime: "20:00",
        endTime: "12:00",
      }),
    ).toThrow();
  });

  it("rejects a closed day carrying stray hours", () => {
    expect(() =>
      officeScheduleDayInputSchema.parse({
        weekday: "TUESDAY",
        isOpen: false,
        startTime: "12:00",
        endTime: null,
      }),
    ).toThrow();
  });

  it("rejects a malformed time", () => {
    expect(() =>
      officeScheduleDayInputSchema.parse({
        weekday: "MONDAY",
        isOpen: true,
        startTime: "25:00",
        endTime: "20:00",
      }),
    ).toThrow();
  });
});

describe("updateOfficeDefaultsRequestSchema", () => {
  it("accepts a partial update with a single changed weekday", () => {
    expect(() =>
      updateOfficeDefaultsRequestSchema.parse({
        days: [{ weekday: "WEDNESDAY", isOpen: true, startTime: "14:00", endTime: "18:00" }],
      }),
    ).not.toThrow();
  });

  it("rejects an empty days array", () => {
    expect(() => updateOfficeDefaultsRequestSchema.parse({ days: [] })).toThrow();
  });
});

describe("officeScheduleExceptionInputSchema", () => {
  it("accepts closing a normally-open day", () => {
    expect(() =>
      officeScheduleExceptionInputSchema.parse({ isOpen: false, startTime: null, endTime: null }),
    ).not.toThrow();
  });

  it("accepts opening a normally-closed day with hours", () => {
    expect(() =>
      officeScheduleExceptionInputSchema.parse({
        isOpen: true,
        startTime: "10:00",
        endTime: "16:00",
      }),
    ).not.toThrow();
  });

  it("rejects an open exception without hours", () => {
    expect(() =>
      officeScheduleExceptionInputSchema.parse({ isOpen: true, startTime: null, endTime: null }),
    ).toThrow();
  });
});
