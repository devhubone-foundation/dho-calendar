import { z } from "zod";

import { calendarDateSchema } from "./calendar-date";
import { timeOfDaySchema, weekdaySchema } from "./office-schedule";

export const attendanceStatusSchema = z.enum(["ATTENDING", "NOT_SURE", "NOT_ATTENDING"]);
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;

function refineAttendsHours<
  T extends { attends: boolean; startTime: string | null; endTime: string | null },
>(value: T, ctx: z.RefinementCtx): void {
  if (value.attends) {
    if (!value.startTime || !value.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start and end time are required when attending",
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
      message: "Start and end time must be empty when not attending",
      path: ["startTime"],
    });
  }
}

function refineStatusHours<
  T extends { status: AttendanceStatus; startTime: string | null; endTime: string | null },
>(value: T, ctx: z.RefinementCtx): void {
  const hoursRequired = value.status === "ATTENDING" || value.status === "NOT_SURE";
  if (hoursRequired) {
    if (!value.startTime || !value.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start and end time are required for Attending and Not sure",
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
      message: "Start and end time must be empty for Not attending",
      path: ["startTime"],
    });
  }
}

/** One weekday's entry in a personal weekly-schedule update. The recurring
 * weekly layer only distinguishes "attends with hours" vs "no attendance" —
 * `NOT_SURE` is only expressible via a date-specific exception
 * (PRODUCT_BLUEPRINT.md §12.4). */
export const weeklyScheduleDayInputSchema = z
  .object({
    weekday: weekdaySchema,
    attends: z.boolean(),
    startTime: timeOfDaySchema.nullable(),
    endTime: timeOfDaySchema.nullable(),
  })
  .superRefine(refineAttendsHours);
export type WeeklyScheduleDayInput = z.infer<typeof weeklyScheduleDayInputSchema>;

/** PATCH .../weekly request body — full or partial week. */
export const updateWeeklyScheduleRequestSchema = z.object({
  days: z.array(weeklyScheduleDayInputSchema).min(1).max(7),
});
export type UpdateWeeklyScheduleRequest = z.infer<typeof updateWeeklyScheduleRequestSchema>;

/** GET .../weekly response — current effective weekly schedule, one per weekday.
 * `isInherited` is true while the weekday still falls back to the office
 * default (the member has never explicitly saved that weekday). */
export const memberWeeklyScheduleDaySchema = z.object({
  weekday: weekdaySchema,
  attends: z.boolean(),
  startTime: timeOfDaySchema.nullable(),
  endTime: timeOfDaySchema.nullable(),
  isInherited: z.boolean(),
});
export type MemberWeeklyScheduleDay = z.infer<typeof memberWeeklyScheduleDaySchema>;

export const memberWeeklyScheduleResponseSchema = z.object({
  days: z.array(memberWeeklyScheduleDaySchema),
});
export type MemberWeeklyScheduleResponse = z.infer<typeof memberWeeklyScheduleResponseSchema>;

/** PUT .../exceptions/:date request body. */
export const attendanceExceptionInputSchema = z
  .object({
    status: attendanceStatusSchema,
    startTime: timeOfDaySchema.nullable(),
    endTime: timeOfDaySchema.nullable(),
  })
  .superRefine(refineStatusHours);
export type AttendanceExceptionInput = z.infer<typeof attendanceExceptionInputSchema>;

export const attendanceExceptionSchema = z.object({
  date: calendarDateSchema,
  status: attendanceStatusSchema,
  startTime: timeOfDaySchema.nullable(),
  endTime: timeOfDaySchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AttendanceException = z.infer<typeof attendanceExceptionSchema>;

export const attendanceExceptionListResponseSchema = z.object({
  exceptions: z.array(attendanceExceptionSchema),
});
export type AttendanceExceptionListResponse = z.infer<typeof attendanceExceptionListResponseSchema>;

/** Resolved effective attendance for one member on one date. `publicStartTime`
 * / `publicEndTime` are the entered interval intersected with effective office
 * hours (null when not applicable); `isClamped` is true whenever the public
 * interval differs from what was entered. The entered interval is always
 * preserved as-is in `enteredStartTime` / `enteredEndTime`. */
export const memberEffectiveAttendanceSchema = z.object({
  date: calendarDateSchema,
  status: attendanceStatusSchema,
  enteredStartTime: timeOfDaySchema.nullable(),
  enteredEndTime: timeOfDaySchema.nullable(),
  officeIsOpen: z.boolean(),
  publicStartTime: timeOfDaySchema.nullable(),
  publicEndTime: timeOfDaySchema.nullable(),
  isClamped: z.boolean(),
});
export type MemberEffectiveAttendance = z.infer<typeof memberEffectiveAttendanceSchema>;

export const memberEffectiveAttendanceRangeResponseSchema = z.object({
  days: z.array(memberEffectiveAttendanceSchema),
});
export type MemberEffectiveAttendanceRangeResponse = z.infer<
  typeof memberEffectiveAttendanceRangeResponseSchema
>;

/** GET /api/attendance/warnings response entry — an upcoming effectively-open
 * working day with no confirmed (`ATTENDING`) active member. */
export const attendanceWarningReasonSchema = z.enum(["NO_RECORDS", "ONLY_UNCERTAIN_OR_ABSENT"]);
export type AttendanceWarningReason = z.infer<typeof attendanceWarningReasonSchema>;

export const attendanceWarningSchema = z.object({
  date: calendarDateSchema,
  reason: attendanceWarningReasonSchema,
  officeStartTime: timeOfDaySchema.nullable(),
  officeEndTime: timeOfDaySchema.nullable(),
});
export type AttendanceWarning = z.infer<typeof attendanceWarningSchema>;

export const attendanceWarningListResponseSchema = z.object({
  warnings: z.array(attendanceWarningSchema),
});
export type AttendanceWarningListResponse = z.infer<typeof attendanceWarningListResponseSchema>;
