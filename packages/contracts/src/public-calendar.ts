import { z } from "zod";

import { attendanceSlotSchema } from "./attendance";
import { calendarDateSchema, dateRangeQuerySchema } from "./calendar-date";
import { eventOccurrenceSchema } from "./events";
import { timeOfDaySchema } from "./office-schedule";

/** GET /api/public/calendar?from&to query — same shape as the internal range
 * queries, reused verbatim for consistency. */
export const publicCalendarQuerySchema = dateRangeQuerySchema;
export type PublicCalendarQuery = z.infer<typeof publicCalendarQuerySchema>;

/** One member's publicly-visible attendance on a date. No internal user ID
 * (PRODUCT_BLUEPRINT.md §17: no internal identifiers publicly) — the contact
 * email is itself the intended public field and doubles as a stable list key.
 * `slots` are always the clamped public slots (never the entered slots),
 * per PRODUCT_BLUEPRINT.md §12.7/ARCHITECTURE.md §11; always at least one
 * entry, since a member with zero overlapping slots is excluded upstream. */
export const publicMemberAttendanceSchema = z.object({
  fullName: z.string(),
  profileImagePath: z.string().nullable(),
  qualificationBg: z.string(),
  qualificationEn: z.string(),
  contactEmail: z.string(),
  slots: z.array(attendanceSlotSchema).min(1),
});
export type PublicMemberAttendance = z.infer<typeof publicMemberAttendanceSchema>;

/** Resolved public office state for one date (PRODUCT_BLUEPRINT.md §9.5). */
export const publicOfficeStateSchema = z.object({
  isOpen: z.boolean(),
  startTime: timeOfDaySchema.nullable(),
  endTime: timeOfDaySchema.nullable(),
  isChanged: z.boolean(),
});
export type PublicOfficeState = z.infer<typeof publicOfficeStateSchema>;

/**
 * One calendar date in the public aggregation. `isPublicOpenDay` is the
 * PRODUCT_BLUEPRINT.md §13 public open-day rule already evaluated server-side
 * (office effectively open AND at least one `ATTENDING` member) — the client
 * never re-derives it. `confirmedAttendees` holds `ATTENDING` members;
 * `uncertainAttendees` holds `NOT_SURE` members; `NOT_ATTENDING` members and
 * inactive members never appear in either list.
 */
export const publicCalendarDaySchema = z.object({
  date: calendarDateSchema,
  office: publicOfficeStateSchema,
  isPublicOpenDay: z.boolean(),
  confirmedAttendees: z.array(publicMemberAttendanceSchema),
  uncertainAttendees: z.array(publicMemberAttendanceSchema),
});
export type PublicCalendarDay = z.infer<typeof publicCalendarDaySchema>;

/**
 * GET /api/public/calendar?from&to response. `events` is a flat list for the
 * whole range (reusing the shared `EventOccurrence` shape from Issue #4) since
 * a single event can span multiple days; events are independent from the
 * open-day rule and always included regardless of office/attendance state
 * (PRODUCT_BLUEPRINT.md §14.9).
 */
export const publicCalendarResponseSchema = z.object({
  range: dateRangeQuerySchema,
  days: z.array(publicCalendarDaySchema),
  events: z.array(eventOccurrenceSchema),
});
export type PublicCalendarResponse = z.infer<typeof publicCalendarResponseSchema>;
