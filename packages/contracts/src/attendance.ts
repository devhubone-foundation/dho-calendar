import { z } from "zod";

import { calendarDateSchema } from "./calendar-date";
import { timeOfDaySchema, weekdaySchema } from "./office-schedule";

export const attendanceStatusSchema = z.enum(["ATTENDING", "NOT_SURE", "NOT_ATTENDING"]);
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;

/** One attendance time range, e.g. "10:00"-"12:00". A weekday's personal
 * default or a date-specific change can carry any number of these
 * (PRODUCT_BLUEPRINT.md §12.4/§12.6), e.g. 10:00-12:00 and 14:00-18:00. */
export const attendanceSlotSchema = z
  .object({
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
  })
  .refine((slot) => slot.endTime > slot.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });
export type AttendanceSlot = z.infer<typeof attendanceSlotSchema>;

/**
 * Validates a list of slots for one weekday/date: no duplicates and no
 * overlaps. Touching slots (one's end equals the next's start, e.g.
 * 10:00-12:00 and 12:00-14:00) are deliberately allowed and kept as two
 * separate slots rather than merged into one — the stored/displayed slots
 * always match exactly what the member entered. Issues are attached to the
 * offending slot's own index in the original (unsorted) list so the error
 * displays next to the affected row.
 */
function refineSlotList(
  slots: readonly { startTime: string; endTime: string }[],
  ctx: z.RefinementCtx,
  path: (string | number)[],
): void {
  const withIndex = slots.map((slot, index) => ({ ...slot, index }));
  const sorted = withIndex.sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime),
  );
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1]!;
    const current = sorted[i]!;
    if (previous.startTime === current.startTime && previous.endTime === current.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate time slot",
        path: [...path, current.index],
      });
    } else if (current.startTime < previous.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Time slots must not overlap",
        path: [...path, current.index],
      });
    }
  }
}

function refineSlotsForAttendance<
  T extends { attends: boolean; slots: { startTime: string; endTime: string }[] },
>(value: T, ctx: z.RefinementCtx): void {
  if (value.attends) {
    if (value.slots.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one time slot is required when attending",
        path: ["slots"],
      });
      return;
    }
    refineSlotList(value.slots, ctx, ["slots"]);
  } else if (value.slots.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Time slots must be empty when not attending",
      path: ["slots"],
    });
  }
}

function refineSlotsForStatus<
  T extends { status: AttendanceStatus; slots: { startTime: string; endTime: string }[] },
>(value: T, ctx: z.RefinementCtx): void {
  const hoursRequired = value.status === "ATTENDING" || value.status === "NOT_SURE";
  if (hoursRequired) {
    if (value.slots.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one time slot is required for Attending and Not sure",
        path: ["slots"],
      });
      return;
    }
    refineSlotList(value.slots, ctx, ["slots"]);
  } else if (value.slots.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Time slots must be empty for Not attending",
      path: ["slots"],
    });
  }
}

/** One weekday's entry in a personal weekly-schedule update. The recurring
 * weekly layer only distinguishes "attends with slots" vs "no attendance" —
 * `NOT_SURE` is only expressible via a date-specific exception
 * (PRODUCT_BLUEPRINT.md §12.4). */
export const weeklyScheduleDayInputSchema = z
  .object({
    weekday: weekdaySchema,
    attends: z.boolean(),
    slots: z.array(attendanceSlotSchema),
  })
  .superRefine(refineSlotsForAttendance);
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
  slots: z.array(attendanceSlotSchema),
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
    slots: z.array(attendanceSlotSchema),
  })
  .superRefine(refineSlotsForStatus);
export type AttendanceExceptionInput = z.infer<typeof attendanceExceptionInputSchema>;

export const attendanceExceptionSchema = z.object({
  date: calendarDateSchema,
  status: attendanceStatusSchema,
  slots: z.array(attendanceSlotSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AttendanceException = z.infer<typeof attendanceExceptionSchema>;

export const attendanceExceptionListResponseSchema = z.object({
  exceptions: z.array(attendanceExceptionSchema),
});
export type AttendanceExceptionListResponse = z.infer<typeof attendanceExceptionListResponseSchema>;

/** Resolved effective attendance for one member on one date. `publicSlots` is
 * `enteredSlots` with each slot intersected with effective office hours
 * (slots with zero overlap are dropped); `isClamped` is true whenever the
 * public slot list differs from what was entered, including a dropped slot.
 * `enteredSlots` always preserves exactly what was saved. `isCustomized` is
 * true when this date has its own date-specific change rather than falling
 * back to the personal weekly default — it drives the daily editor's "use my
 * default schedule" reset action. */
export const memberEffectiveAttendanceSchema = z.object({
  date: calendarDateSchema,
  status: attendanceStatusSchema,
  isCustomized: z.boolean(),
  enteredSlots: z.array(attendanceSlotSchema),
  officeIsOpen: z.boolean(),
  publicSlots: z.array(attendanceSlotSchema),
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
