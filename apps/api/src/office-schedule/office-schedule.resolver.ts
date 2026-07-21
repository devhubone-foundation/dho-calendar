import type { OfficeEffectiveDay, Weekday } from "@dho/contracts";

import { enumerateDates, weekdayOf } from "../common/calendar-date.util";

export interface OfficeDefaultVersion {
  weekday: Weekday;
  isOpen: boolean;
  startTime: string | null;
  endTime: string | null;
  /** "YYYY-MM-DD" — the date this version starts applying from. */
  effectiveFrom: string;
  /** ISO timestamp, used only to break ties between same-day versions. */
  createdAt: string;
}

export interface OfficeExceptionRow {
  /** "YYYY-MM-DD" */
  date: string;
  isOpen: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface ResolvedOfficeHours {
  isOpen: boolean;
  startTime: string | null;
  endTime: string | null;
}

/**
 * Picks the version in force on `asOfDate` for one weekday: the latest
 * version with `effectiveFrom <= asOfDate`. This is what makes default edits
 * future-only — a past date always finds whichever version was already in
 * force on it, regardless of later edits (ARCHITECTURE.md §11).
 */
export function resolveOfficeDefaultForWeekday(
  versions: OfficeDefaultVersion[],
  weekday: Weekday,
  asOfDate: string,
): ResolvedOfficeHours {
  const candidates = versions.filter((v) => v.weekday === weekday && v.effectiveFrom <= asOfDate);
  if (candidates.length === 0) {
    return { isOpen: false, startTime: null, endTime: null };
  }
  const latest = candidates.reduce((best, current) => {
    if (current.effectiveFrom !== best.effectiveFrom) {
      return current.effectiveFrom > best.effectiveFrom ? current : best;
    }
    return current.createdAt > best.createdAt ? current : best;
  });
  return { isOpen: latest.isOpen, startTime: latest.startTime, endTime: latest.endTime };
}

/** Resolves a specific calendar date's own weekday against the default versions. */
export function resolveOfficeDefault(versions: OfficeDefaultVersion[], date: string): ResolvedOfficeHours {
  return resolveOfficeDefaultForWeekday(versions, weekdayOf(date), date);
}

/** Applies exception-over-default precedence for a single date (ARCHITECTURE.md §11, layers 1-2). */
export function resolveOfficeDay(
  defaultVersions: OfficeDefaultVersion[],
  exceptions: OfficeExceptionRow[],
  date: string,
): OfficeEffectiveDay {
  const exception = exceptions.find((e) => e.date === date);
  if (exception) {
    return {
      date,
      isOpen: exception.isOpen,
      startTime: exception.startTime,
      endTime: exception.endTime,
      source: "EXCEPTION",
    };
  }
  const resolved = resolveOfficeDefault(defaultVersions, date);
  return { date, ...resolved, source: "DEFAULT" };
}

export function resolveOfficeRange(
  defaultVersions: OfficeDefaultVersion[],
  exceptions: OfficeExceptionRow[],
  from: string,
  to: string,
): OfficeEffectiveDay[] {
  return enumerateDates(from, to).map((date) => resolveOfficeDay(defaultVersions, exceptions, date));
}
