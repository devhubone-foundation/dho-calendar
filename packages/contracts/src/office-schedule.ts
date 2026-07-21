import { z } from "zod";

import { calendarDateSchema } from "./calendar-date";

export const weekdaySchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);
export type Weekday = z.infer<typeof weekdaySchema>;

/** Monday-first display/iteration order for weekly-schedule UIs. */
export const WEEKDAYS_IN_ORDER: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

/** 24-hour "HH:mm" time of day, e.g. "12:00". Overnight intervals are not
 * supported (PRODUCT_BLUEPRINT.md §23), so end must be strictly after start. */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm time");

function refineOpenHours<T extends { isOpen: boolean; startTime: string | null; endTime: string | null }>(
  value: T,
  ctx: z.RefinementCtx,
): void {
  if (value.isOpen) {
    if (!value.startTime || !value.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start and end time are required when open",
        path: ["startTime"],
      });
      return;
    }
    if (value.endTime <= value.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be after start time",
        path: ["endTime"],
      });
    }
  } else if (value.startTime || value.endTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Start and end time must be empty when closed",
      path: ["startTime"],
    });
  }
}

/** One weekday's entry in an admin default-schedule update. */
export const officeScheduleDayInputSchema = z
  .object({
    weekday: weekdaySchema,
    isOpen: z.boolean(),
    startTime: timeOfDaySchema.nullable(),
    endTime: timeOfDaySchema.nullable(),
  })
  .superRefine(refineOpenHours);
export type OfficeScheduleDayInput = z.infer<typeof officeScheduleDayInputSchema>;

/** PATCH /api/office-schedule/defaults — admins may submit the whole week or
 * only the weekdays that changed; unchanged values are a no-op server-side. */
export const updateOfficeDefaultsRequestSchema = z.object({
  days: z.array(officeScheduleDayInputSchema).min(1).max(7),
});
export type UpdateOfficeDefaultsRequest = z.infer<typeof updateOfficeDefaultsRequestSchema>;

/** GET /api/office-schedule/defaults response — current effective defaults, one per weekday. */
export const officeScheduleDefaultSchema = z.object({
  weekday: weekdaySchema,
  isOpen: z.boolean(),
  startTime: timeOfDaySchema.nullable(),
  endTime: timeOfDaySchema.nullable(),
});
export type OfficeScheduleDefault = z.infer<typeof officeScheduleDefaultSchema>;

export const officeScheduleDefaultsResponseSchema = z.object({
  days: z.array(officeScheduleDefaultSchema),
});
export type OfficeScheduleDefaultsResponse = z.infer<typeof officeScheduleDefaultsResponseSchema>;

/** PUT /api/office-schedule/exceptions/:date request body. */
export const officeScheduleExceptionInputSchema = z
  .object({
    isOpen: z.boolean(),
    startTime: timeOfDaySchema.nullable(),
    endTime: timeOfDaySchema.nullable(),
  })
  .superRefine(refineOpenHours);
export type OfficeScheduleExceptionInput = z.infer<typeof officeScheduleExceptionInputSchema>;

export const officeScheduleExceptionSchema = z.object({
  date: calendarDateSchema,
  isOpen: z.boolean(),
  startTime: timeOfDaySchema.nullable(),
  endTime: timeOfDaySchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OfficeScheduleException = z.infer<typeof officeScheduleExceptionSchema>;

export const officeScheduleExceptionListResponseSchema = z.object({
  exceptions: z.array(officeScheduleExceptionSchema),
});
export type OfficeScheduleExceptionListResponse = z.infer<
  typeof officeScheduleExceptionListResponseSchema
>;

/** Resolved office state for one calendar date (default + exception precedence applied). */
export const officeEffectiveDaySchema = z.object({
  date: calendarDateSchema,
  isOpen: z.boolean(),
  startTime: timeOfDaySchema.nullable(),
  endTime: timeOfDaySchema.nullable(),
  source: z.enum(["DEFAULT", "EXCEPTION"]),
});
export type OfficeEffectiveDay = z.infer<typeof officeEffectiveDaySchema>;

export const officeEffectiveRangeResponseSchema = z.object({
  days: z.array(officeEffectiveDaySchema),
});
export type OfficeEffectiveRangeResponse = z.infer<typeof officeEffectiveRangeResponseSchema>;
