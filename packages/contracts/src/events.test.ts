import { describe, expect, it } from "vitest";

import {
  createEventRequestSchema,
  deleteEventOccurrenceRequestSchema,
  eventOccurrenceSchema,
  eventRecurrenceInputSchema,
  updateEventOccurrenceRequestSchema,
  updateEventSeriesFromOccurrenceRequestSchema,
  updateEventSeriesRequestSchema,
} from "./events";

const baseEvent = {
  titleBg: "Работилница",
  titleEn: "Workshop",
  descriptionBg: "Описание",
  descriptionEn: "Description",
  startAt: "2026-08-03T09:00:00.000Z",
  endAt: "2026-08-03T11:00:00.000Z",
  isAllDay: false,
  location: "DevHubOne office",
};

describe("createEventRequestSchema", () => {
  it("accepts a valid one-time event", () => {
    expect(() => createEventRequestSchema.parse(baseEvent)).not.toThrow();
  });

  it("rejects end at or before start", () => {
    expect(() =>
      createEventRequestSchema.parse({ ...baseEvent, endAt: "2026-08-03T09:00:00.000Z" }),
    ).toThrow();
    expect(() =>
      createEventRequestSchema.parse({ ...baseEvent, endAt: "2026-08-03T08:00:00.000Z" }),
    ).toThrow();
  });

  it("rejects a missing title in either language", () => {
    expect(() => createEventRequestSchema.parse({ ...baseEvent, titleBg: "" })).toThrow();
    expect(() => createEventRequestSchema.parse({ ...baseEvent, titleEn: "" })).toThrow();
  });

  it("allows an empty description", () => {
    expect(() =>
      createEventRequestSchema.parse({ ...baseEvent, descriptionBg: "", descriptionEn: "" }),
    ).not.toThrow();
  });

  it("accepts a recurring event with a COUNT end condition", () => {
    expect(() =>
      createEventRequestSchema.parse({
        ...baseEvent,
        recurrence: { byWeekdays: ["MONDAY", "WEDNESDAY"], end: { type: "COUNT", count: 10 } },
      }),
    ).not.toThrow();
  });

  it("accepts a recurring event with an UNTIL end condition", () => {
    expect(() =>
      createEventRequestSchema.parse({
        ...baseEvent,
        recurrence: { byWeekdays: ["FRIDAY"], end: { type: "UNTIL", until: "2026-12-31" } },
      }),
    ).not.toThrow();
  });
});

describe("eventRecurrenceInputSchema", () => {
  it("rejects an empty weekday list", () => {
    expect(() =>
      eventRecurrenceInputSchema.parse({ byWeekdays: [], end: { type: "COUNT", count: 5 } }),
    ).toThrow();
  });

  it("rejects duplicate weekdays", () => {
    expect(() =>
      eventRecurrenceInputSchema.parse({
        byWeekdays: ["MONDAY", "MONDAY"],
        end: { type: "COUNT", count: 5 },
      }),
    ).toThrow();
  });

  it("rejects a COUNT beyond the maximum", () => {
    expect(() =>
      eventRecurrenceInputSchema.parse({ byWeekdays: ["MONDAY"], end: { type: "COUNT", count: 201 } }),
    ).toThrow();
  });

  it("rejects a COUNT below one", () => {
    expect(() =>
      eventRecurrenceInputSchema.parse({ byWeekdays: ["MONDAY"], end: { type: "COUNT", count: 0 } }),
    ).toThrow();
  });
});

describe("updateEventSeriesRequestSchema", () => {
  it("requires expectedUpdatedAt", () => {
    expect(() => updateEventSeriesRequestSchema.parse(baseEvent)).toThrow();
  });

  it("accepts a full series edit with expectedUpdatedAt", () => {
    expect(() =>
      updateEventSeriesRequestSchema.parse({
        ...baseEvent,
        expectedUpdatedAt: "2026-07-01T00:00:00.000Z",
      }),
    ).not.toThrow();
  });
});

describe("updateEventOccurrenceRequestSchema", () => {
  it("allows a null expectedUpdatedAt for a first-time occurrence override", () => {
    expect(() =>
      updateEventOccurrenceRequestSchema.parse({ ...baseEvent, expectedUpdatedAt: null }),
    ).not.toThrow();
  });
});

describe("deleteEventOccurrenceRequestSchema", () => {
  it("allows a null expectedUpdatedAt", () => {
    expect(() => deleteEventOccurrenceRequestSchema.parse({ expectedUpdatedAt: null })).not.toThrow();
  });
});

describe("updateEventSeriesFromOccurrenceRequestSchema", () => {
  it("requires a non-null expectedUpdatedAt", () => {
    expect(() =>
      updateEventSeriesFromOccurrenceRequestSchema.parse({ ...baseEvent, expectedUpdatedAt: null }),
    ).toThrow();
    expect(() =>
      updateEventSeriesFromOccurrenceRequestSchema.parse({
        ...baseEvent,
        expectedUpdatedAt: "2026-07-01T00:00:00.000Z",
      }),
    ).not.toThrow();
  });
});

describe("eventOccurrenceSchema", () => {
  it("accepts a full occurrence DTO", () => {
    expect(() =>
      eventOccurrenceSchema.parse({
        seriesId: "series-1",
        occurrenceDate: "2026-08-03",
        isRecurring: true,
        isException: false,
        ...baseEvent,
        coverImagePath: null,
        updatedAt: "2026-07-01T00:00:00.000Z",
        seriesUpdatedAt: "2026-07-01T00:00:00.000Z",
      }),
    ).not.toThrow();
  });
});
