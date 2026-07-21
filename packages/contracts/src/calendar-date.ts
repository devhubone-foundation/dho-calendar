import { z } from "zod";

/** Plain calendar date, e.g. "2026-07-22". No timezone attached — office
 * schedule and attendance dates are office-local calendar days. */
export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO calendar date (YYYY-MM-DD)")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Enter a valid calendar date");
export type CalendarDate = z.infer<typeof calendarDateSchema>;

/** Shared "from"/"to" range query shape, reusable across office-schedule,
 * attendance, and later calendar/event range queries (#4/#5). */
export const dateRangeQuerySchema = z
  .object({
    from: calendarDateSchema,
    to: calendarDateSchema,
  })
  .refine((value) => value.from <= value.to, {
    message: "`to` must be on or after `from`",
    path: ["to"],
  });
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
