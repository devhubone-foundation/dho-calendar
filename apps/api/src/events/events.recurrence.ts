import type { Weekday } from "@dho/contracts";
import { WEEKDAYS_IN_ORDER } from "@dho/contracts";

import { addDays, toDateOnly, weekdayOf } from "../common/calendar-date.util";

/**
 * Pure occurrence-expansion and edit/delete-scope logic for events
 * (PRODUCT_BLUEPRINT.md §14.7/§14.8). No Prisma/env dependency — the service
 * layer maps rows to/from these shapes, keeping the riskiest date math fully
 * unit-testable in isolation (mirrors office-schedule.resolver.ts /
 * attendance.resolver.ts).
 *
 * Recurrence is intentionally minimal and RRULE-compatible in spirit
 * (FREQ=WEEKLY;BYDAY=...;COUNT=... or UNTIL=...): weekly on one or more
 * selected weekdays, ending by a fixed occurrence count or an until-date.
 *
 * A "this and future" edit/delete never rewrites the original series' past
 * occurrences: it caps the original series with `endsBeforeDate` (exclusive)
 * and, for an edit, a new series is created (by the caller) to carry the
 * pattern forward from the split date. `endsBeforeDate` is therefore not part
 * of the user-facing recurrence definition — it is an internal effective-end
 * override.
 *
 * Known limitation: occurrence instants are derived by shifting the first
 * occurrence's start/end by a whole-day offset, not by re-resolving the
 * office-local wall-clock time on each date. A recurring event's displayed
 * time can therefore drift by the DST offset (at most one hour) across a
 * daylight-saving transition. Office-schedule/attendance avoid this by
 * storing "HH:mm" strings interpreted fresh per day; events store instants
 * per ARCHITECTURE.md §10, so this trade-off is accepted for v1.
 */

export interface EventSeriesPattern {
  frequency: "NONE" | "WEEKLY";
  byWeekdays: Weekday[];
  recurrenceEndType: "COUNT" | "UNTIL" | null;
  recurrenceCount: number | null;
  /** "YYYY-MM-DD", inclusive upper bound (only meaningful for UNTIL). */
  recurrenceUntil: string | null;
  /** "YYYY-MM-DD", exclusive cap set only by a "this and future" split. */
  endsBeforeDate: string | null;
  /** "YYYY-MM-DD" — office-local calendar date of the very first occurrence. */
  anchorStartDate: string;
}

export interface OccurrenceContent {
  titleBg: string;
  titleEn: string;
  descriptionBg: string;
  descriptionEn: string;
  startAt: Date;
  endAt: Date;
  isAllDay: boolean;
  location: string;
}

export interface EventSeriesForExpansion extends EventSeriesPattern, OccurrenceContent {
  coverImagePath: string | null;
  updatedAt: Date;
}

export interface EventExceptionForExpansion {
  /** "YYYY-MM-DD" — the ORIGINAL scheduled date this exception overrides. */
  occurrenceDate: string;
  isCancelled: boolean;
  /** Full-field override snapshot; null/ignored when `isCancelled`. */
  override: OccurrenceContent | null;
  updatedAt: Date;
}

export interface ExpandedOccurrence {
  occurrenceDate: string;
  isException: boolean;
  content: OccurrenceContent;
  coverImagePath: string | null;
  /** The exception's `updatedAt` when `isException`, else the series'. */
  updatedAt: Date;
}

function daysSinceMonday(weekday: Weekday): number {
  return WEEKDAYS_IN_ORDER.indexOf(weekday);
}

function daysBetween(from: string, to: string): number {
  return Math.round((toDateOnly(to).getTime() - toDateOnly(from).getTime()) / 86_400_000);
}

/** UTC calendar-date key of an instant, e.g. for deriving which day a
 * (possibly-overridden) occurrence's start/end falls on. Consistent with
 * `fromDateOnly` in calendar-date.util.ts, applied to arbitrary instants
 * rather than only UTC-midnight `@db.Date` values. */
function instantToDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * All calendar dates this series' base pattern occupies, up to and including
 * `upperBoundDate`, respecting COUNT/UNTIL/endsBeforeDate. Ignores exceptions
 * entirely — this is the addressable set of occurrence keys a series exposes,
 * independent of which ones have since been edited/cancelled.
 */
export function generatePatternDates(pattern: EventSeriesPattern, upperBoundDate: string): string[] {
  if (pattern.frequency === "NONE") {
    return pattern.anchorStartDate <= upperBoundDate ? [pattern.anchorStartDate] : [];
  }

  const cutoffCandidates = [upperBoundDate];
  if (pattern.recurrenceEndType === "UNTIL" && pattern.recurrenceUntil) {
    cutoffCandidates.push(pattern.recurrenceUntil);
  }
  if (pattern.endsBeforeDate) {
    cutoffCandidates.push(addDays(pattern.endsBeforeDate, -1));
  }
  const cutoff = cutoffCandidates.reduce((min, candidate) => (candidate < min ? candidate : min));

  if (cutoff < pattern.anchorStartDate || pattern.byWeekdays.length === 0) {
    return [];
  }

  const maxCount =
    pattern.recurrenceEndType === "COUNT" && pattern.recurrenceCount != null
      ? pattern.recurrenceCount
      : Infinity;

  const orderedWeekdays = WEEKDAYS_IN_ORDER.filter((weekday) => pattern.byWeekdays.includes(weekday));
  const weekStart0 = addDays(pattern.anchorStartDate, -daysSinceMonday(weekdayOf(pattern.anchorStartDate)));

  const dates: string[] = [];
  const MAX_WEEKS = 600; // ~11.5 years — a defensive bound, not a product limit.
  for (let week = 0; week < MAX_WEEKS && dates.length < maxCount; week++) {
    const weekStart = addDays(weekStart0, week * 7);
    if (weekStart > cutoff) {
      break;
    }
    for (const weekday of orderedWeekdays) {
      const candidate = addDays(weekStart, daysSinceMonday(weekday));
      if (candidate < pattern.anchorStartDate || candidate > cutoff) {
        continue;
      }
      dates.push(candidate);
      if (dates.length >= maxCount) {
        break;
      }
    }
  }
  return dates;
}

/** Whether `date` is one of this series' addressable occurrence keys. */
export function isValidOccurrenceDate(pattern: EventSeriesPattern, date: string): boolean {
  if (pattern.frequency === "NONE") {
    return pattern.anchorStartDate === date;
  }
  return generatePatternDates(pattern, date).includes(date);
}

/** The base (un-overridden) content for one occurrence, derived by shifting
 * the series' first occurrence by the whole-day offset to `occurrenceDate`. */
export function buildOccurrenceContent(
  series: EventSeriesForExpansion,
  occurrenceDate: string,
): OccurrenceContent {
  const shiftMs = daysBetween(series.anchorStartDate, occurrenceDate) * 86_400_000;
  return {
    titleBg: series.titleBg,
    titleEn: series.titleEn,
    descriptionBg: series.descriptionBg,
    descriptionEn: series.descriptionEn,
    startAt: new Date(series.startAt.getTime() + shiftMs),
    endAt: new Date(series.endAt.getTime() + shiftMs),
    isAllDay: series.isAllDay,
    location: series.location,
  };
}

/** The last calendar date an occurrence's content visibly covers — for an
 * all-day event `endAt` is the exclusive midnight of the day after the last
 * day, so the covered end is one instant earlier. */
function coveredEndDateKey(content: OccurrenceContent): string {
  const effectiveEnd = content.isAllDay ? new Date(content.endAt.getTime() - 1) : content.endAt;
  return instantToDateKey(effectiveEnd);
}

/**
 * Expands a series into concrete occurrences overlapping [`from`, `to`]
 * (inclusive calendar dates), merging in exceptions (cancellations excluded,
 * edits fully override content — never the cover image) and using each
 * occurrence's *rendered* start/end for the range-overlap check, so a moved
 * "this occurrence" edit appears on its new date, not its original slot.
 */
export function expandOccurrences(
  series: EventSeriesForExpansion,
  exceptions: EventExceptionForExpansion[],
  from: string,
  to: string,
): ExpandedOccurrence[] {
  const patternDates = generatePatternDates(series, to);
  const exceptionByDate = new Map(exceptions.map((exception) => [exception.occurrenceDate, exception]));

  const results: ExpandedOccurrence[] = [];
  for (const occurrenceDate of patternDates) {
    const exception = exceptionByDate.get(occurrenceDate);
    if (exception?.isCancelled) {
      continue;
    }

    const baseContent = buildOccurrenceContent(series, occurrenceDate);
    const content = exception?.override ?? baseContent;

    const startKey = instantToDateKey(content.startAt);
    const endKey = coveredEndDateKey(content);
    if (endKey < from || startKey > to) {
      continue;
    }

    results.push({
      occurrenceDate,
      isException: Boolean(exception),
      content,
      coverImagePath: series.coverImagePath,
      updatedAt: exception ? exception.updatedAt : series.updatedAt,
    });
  }
  return results;
}

/**
 * Computes what a "this and future" edit/delete needs to know about the
 * ORIGINAL (not-yet-capped) series: whether `splitDate` is a real occurrence,
 * and — for a COUNT-bounded series — how many occurrences the new forward
 * series should carry (the remainder after the ones the original series
 * keeps). Returns null when the split is not applicable (non-recurring,
 * invalid date, or a COUNT series with nothing left after the split).
 */
export function computeSplitForFutureEdit(
  pattern: EventSeriesPattern,
  splitDate: string,
): { occurrencesBeforeSplit: number; newRecurrenceCount: number | null } | null {
  if (pattern.frequency !== "WEEKLY" || !isValidOccurrenceDate(pattern, splitDate)) {
    return null;
  }

  const occurrencesBeforeSplit = generatePatternDates(pattern, addDays(splitDate, -1)).length;
  const newRecurrenceCount =
    pattern.recurrenceEndType === "COUNT" && pattern.recurrenceCount != null
      ? pattern.recurrenceCount - occurrencesBeforeSplit
      : null;

  if (newRecurrenceCount !== null && newRecurrenceCount < 1) {
    return null;
  }

  return { occurrencesBeforeSplit, newRecurrenceCount };
}
