import type { Weekday } from "@dho/contracts";

const WEEKDAY_BY_JS_DAY: [Weekday, Weekday, Weekday, Weekday, Weekday, Weekday, Weekday] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

/** Weekday of a plain "YYYY-MM-DD" calendar date, independent of any timezone
 * (the date itself already denotes an office-local calendar day). */
export function weekdayOf(date: string): Weekday {
  // getUTCDay() always returns 0-6, matching the fixed-length tuple above.
  const jsDay = new Date(`${date}T00:00:00.000Z`).getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  return WEEKDAY_BY_JS_DAY[jsDay];
}

/** The calendar date a given instant falls on in an IANA timezone, as
 * "YYYY-MM-DD". Used to compute office-local dates from a UTC server clock
 * without pulling in a date library. */
export function dateInTimezone(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Today's calendar date in the given IANA timezone, as "YYYY-MM-DD". */
export function todayInTimezone(timezone: string): string {
  return dateInTimezone(new Date(), timezone);
}

export function addDays(date: string, amount: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

export function addMonths(date: string, amount: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + amount);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of "YYYY-MM-DD" dates from `from` to `to`. */
export function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/** ARCHITECTURE.md §10: Version 1 supports a forward horizon of three months.
 * Only the upper bound is clamped — viewing past dates is unrestricted. */
export function clampToHorizon(to: string, today: string, horizonMonths = 3): string {
  const maxTo = addMonths(today, horizonMonths);
  return to > maxTo ? maxTo : to;
}

/** Converts a "YYYY-MM-DD" string to a UTC-midnight Date for Prisma `@db.Date` columns. */
export function toDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Converts a Prisma `@db.Date` value back to "YYYY-MM-DD". */
export function fromDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
