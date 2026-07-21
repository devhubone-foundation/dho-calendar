import { z } from "zod";

import { calendarDateSchema } from "./calendar-date";
import { weekdaySchema } from "./office-schedule";

/** Full ISO-8601 instant (date + time), e.g. "2026-08-03T12:00:00.000Z".
 * Unlike `calendarDateSchema` (an office-local calendar day with no time
 * component), event start/end are stored as UTC instants per
 * ARCHITECTURE.md §10 ("Store timestamps in UTC"). */
export const isoDateTimeSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date and time");
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;

export const eventTitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(200, "Title must be at most 200 characters");

export const eventDescriptionSchema = z
  .string()
  .max(5000, "Description must be at most 5000 characters");

export const eventLocationSchema = z
  .string()
  .trim()
  .min(1, "Location is required")
  .max(300, "Location must be at most 300 characters");

/** Minimum recurrence surface required by PRODUCT_BLUEPRINT.md §14.7: weekly
 * on one or more selected weekdays, ending by a fixed occurrence count or an
 * until-date. Deliberately RRULE-compatible in spirit (FREQ=WEEKLY;BYDAY=...;
 * COUNT=... or UNTIL=...) without parsing/emitting a raw RRULE string. */
export const EVENT_RECURRENCE_MAX_COUNT = 200;

export const eventRecurrenceEndSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("COUNT"), count: z.number().int().min(1).max(EVENT_RECURRENCE_MAX_COUNT) }),
  z.object({ type: z.literal("UNTIL"), until: calendarDateSchema }),
]);
export type EventRecurrenceEnd = z.infer<typeof eventRecurrenceEndSchema>;

export const eventRecurrenceInputSchema = z.object({
  byWeekdays: z.array(weekdaySchema).min(1, "Select at least one weekday").refine(
    (weekdays) => new Set(weekdays).size === weekdays.length,
    "Weekdays must not repeat",
  ),
  end: eventRecurrenceEndSchema,
});
export type EventRecurrenceInput = z.infer<typeof eventRecurrenceInputSchema>;

function refineEventTimes<T extends { startAt: string; endAt: string }>(
  value: T,
  ctx: z.RefinementCtx,
): void {
  if (Date.parse(value.endAt) <= Date.parse(value.startAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End must be after start",
      path: ["endAt"],
    });
  }
}

/** POST /api/events — create a one-time or recurring event. */
export const createEventRequestSchema = z
  .object({
    titleBg: eventTitleSchema,
    titleEn: eventTitleSchema,
    descriptionBg: eventDescriptionSchema,
    descriptionEn: eventDescriptionSchema,
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
    isAllDay: z.boolean(),
    location: eventLocationSchema,
    recurrence: eventRecurrenceInputSchema.optional(),
  })
  .superRefine(refineEventTimes);
export type CreateEventRequest = z.infer<typeof createEventRequestSchema>;

const eventContentFieldsSchema = z.object({
  titleBg: eventTitleSchema,
  titleEn: eventTitleSchema,
  descriptionBg: eventDescriptionSchema,
  descriptionEn: eventDescriptionSchema,
  startAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema,
  isAllDay: z.boolean(),
  location: eventLocationSchema,
});

/** PATCH /api/events/:seriesId — scope = entire series. May also change the
 * recurrence pattern itself; existing recurrence-exceptions whose date no
 * longer matches the new pattern are left in place rather than silently
 * deleted (PRODUCT_BLUEPRINT.md §14.7/§14.8: never silently rewrite history). */
export const updateEventSeriesRequestSchema = eventContentFieldsSchema
  .extend({
    recurrence: eventRecurrenceInputSchema.optional(),
    expectedUpdatedAt: isoDateTimeSchema,
  })
  .superRefine(refineEventTimes);
export type UpdateEventSeriesRequest = z.infer<typeof updateEventSeriesRequestSchema>;

/** PUT /api/events/:seriesId/occurrences/:date — scope = this occurrence
 * only. `expectedUpdatedAt` is null when no exception exists yet for this
 * occurrence (first-time override); otherwise it must match the existing
 * exception's `updatedAt`. The cover image is not overridable per occurrence
 * — it always follows the parent series. */
export const updateEventOccurrenceRequestSchema = eventContentFieldsSchema
  .extend({ expectedUpdatedAt: isoDateTimeSchema.nullable() })
  .superRefine(refineEventTimes);
export type UpdateEventOccurrenceRequest = z.infer<typeof updateEventOccurrenceRequestSchema>;

/** DELETE .../occurrences/:date — scope = this occurrence only. */
export const deleteEventOccurrenceRequestSchema = z.object({
  expectedUpdatedAt: isoDateTimeSchema.nullable(),
});
export type DeleteEventOccurrenceRequest = z.infer<typeof deleteEventOccurrenceRequestSchema>;

/** PATCH .../occurrences/:date/future — scope = this and future occurrences.
 * `expectedUpdatedAt` refers to the series being split (the original series'
 * `updatedAt`), since this operation caps the original series and creates a
 * new one carrying the edit forward. The recurrence weekday pattern itself is
 * carried over unchanged; use the entire-series scope to change the pattern. */
export const updateEventSeriesFromOccurrenceRequestSchema = eventContentFieldsSchema
  .extend({ expectedUpdatedAt: isoDateTimeSchema })
  .superRefine(refineEventTimes);
export type UpdateEventSeriesFromOccurrenceRequest = z.infer<
  typeof updateEventSeriesFromOccurrenceRequestSchema
>;

/** DELETE .../occurrences/:date/future and DELETE /api/events/:seriesId —
 * scope = this+future delete and entire-series delete. Both only need to
 * confirm the caller has the current series `updatedAt`. */
export const deleteEventSeriesScopeRequestSchema = z.object({
  expectedUpdatedAt: isoDateTimeSchema,
});
export type DeleteEventSeriesScopeRequest = z.infer<typeof deleteEventSeriesScopeRequestSchema>;

/** GET /api/events/:seriesId — full series detail for prefilling edit forms. */
export const eventSeriesDetailSchema = z.object({
  id: z.string(),
  titleBg: z.string(),
  titleEn: z.string(),
  descriptionBg: z.string(),
  descriptionEn: z.string(),
  startAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema,
  isAllDay: z.boolean(),
  location: z.string(),
  coverImagePath: z.string().nullable(),
  recurrence: eventRecurrenceInputSchema.nullable(),
  updatedAt: isoDateTimeSchema,
});
export type EventSeriesDetail = z.infer<typeof eventSeriesDetailSchema>;

/**
 * GET /api/events?from&to — one expanded occurrence. This is the shared
 * public-calendar event shape Issue #5's aggregation endpoint is expected to
 * reuse (plus whatever office/attendance fields #5 composes alongside it):
 * bilingual content, a UTC start/end instant pair, and enough identity
 * (`seriesId` + `occurrenceDate`) to address this exact occurrence for a
 * scoped edit/delete.
 *
 * `updatedAt` is the exception's `updatedAt` when `isException` is true,
 * otherwise the series' `updatedAt` (i.e. the same value as
 * `seriesUpdatedAt`) — NOT null. Because of that, it is **not** directly
 * usable as `expectedUpdatedAt` for an occurrence-scope edit/delete: the API
 * requires `null` there when no exception exists yet (see
 * `updateEventOccurrenceRequestSchema`/`deleteEventOccurrenceRequestSchema`).
 * Callers making an OCCURRENCE-scope request must send
 * `isException ? updatedAt : null`. `seriesUpdatedAt` is always the series'
 * own `updatedAt` and is what SERIES and THIS_AND_FUTURE scope operations
 * expect as `expectedUpdatedAt`, regardless of `isException`.
 */
export const eventOccurrenceSchema = z.object({
  seriesId: z.string(),
  occurrenceDate: calendarDateSchema,
  isRecurring: z.boolean(),
  isException: z.boolean(),
  titleBg: z.string(),
  titleEn: z.string(),
  descriptionBg: z.string(),
  descriptionEn: z.string(),
  startAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema,
  isAllDay: z.boolean(),
  location: z.string(),
  coverImagePath: z.string().nullable(),
  updatedAt: isoDateTimeSchema,
  seriesUpdatedAt: isoDateTimeSchema,
});
export type EventOccurrence = z.infer<typeof eventOccurrenceSchema>;

export const eventOccurrenceListResponseSchema = z.object({
  occurrences: z.array(eventOccurrenceSchema),
});
export type EventOccurrenceListResponse = z.infer<typeof eventOccurrenceListResponseSchema>;

/** The three PRODUCT_BLUEPRINT.md §14.8 edit/delete scopes, used in audit
 * metadata to record which scope an action used. */
export const eventEditScopeSchema = z.enum(["OCCURRENCE", "THIS_AND_FUTURE", "SERIES"]);
export type EventEditScope = z.infer<typeof eventEditScopeSchema>;
