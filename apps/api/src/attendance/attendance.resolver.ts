import type { AttendanceStatus, OfficeEffectiveDay, Weekday } from "@dho/contracts";

import {
  type OfficeDefaultVersion,
  resolveOfficeDefaultForWeekday,
} from "../office-schedule/office-schedule.resolver";
import { weekdayOf } from "../common/calendar-date.util";

export interface MemberWeeklyVersion {
  weekday: Weekday;
  attends: boolean;
  startTime: string | null;
  endTime: string | null;
  /** "YYYY-MM-DD" — the date this version starts applying from. */
  effectiveFrom: string;
  /** ISO timestamp, used only to break ties between same-day versions. */
  createdAt: string;
}

export interface AttendanceExceptionRow {
  /** "YYYY-MM-DD" */
  date: string;
  status: AttendanceStatus;
  startTime: string | null;
  endTime: string | null;
}

export interface ResolvedWeeklyDay {
  attends: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface MemberDayResult {
  status: AttendanceStatus;
  enteredStartTime: string | null;
  enteredEndTime: string | null;
}

export interface MemberEffectiveAttendanceResult {
  status: AttendanceStatus;
  enteredStartTime: string | null;
  enteredEndTime: string | null;
  officeIsOpen: boolean;
  publicStartTime: string | null;
  publicEndTime: string | null;
  isClamped: boolean;
}

/** Picks the personal weekly-schedule version in force on `asOfDate` for one
 * weekday, the same future-only versioning rule as office defaults. Returns
 * `null` when the member has never explicitly saved that weekday — the
 * caller then falls back to the inherited office default. */
export function resolveMemberWeeklyForWeekday(
  versions: MemberWeeklyVersion[],
  weekday: Weekday,
  asOfDate: string,
): ResolvedWeeklyDay | null {
  const candidates = versions.filter((v) => v.weekday === weekday && v.effectiveFrom <= asOfDate);
  if (candidates.length === 0) {
    return null;
  }
  const latest = candidates.reduce((best, current) => {
    if (current.effectiveFrom !== best.effectiveFrom) {
      return current.effectiveFrom > best.effectiveFrom ? current : best;
    }
    return current.createdAt > best.createdAt ? current : best;
  });
  return { attends: latest.attends, startTime: latest.startTime, endTime: latest.endTime };
}

/**
 * Full precedence chain for one member/date, ARCHITECTURE.md §11 layers 3-4
 * plus the inheritance fallback: date exception > personal weekly > office
 * default as of the member's account-creation date (frozen there — the
 * personal schedule is independent from later office-default changes once
 * inherited, PRODUCT_BLUEPRINT.md §12.4).
 */
export function resolveMemberDay(
  weeklyVersions: MemberWeeklyVersion[],
  exceptions: AttendanceExceptionRow[],
  officeDefaultVersions: OfficeDefaultVersion[],
  memberCreatedAt: string,
  date: string,
): MemberDayResult {
  const exception = exceptions.find((e) => e.date === date);
  if (exception) {
    return {
      status: exception.status,
      enteredStartTime: exception.startTime,
      enteredEndTime: exception.endTime,
    };
  }

  const weekday = weekdayOf(date);
  const explicitWeekly = resolveMemberWeeklyForWeekday(weeklyVersions, weekday, date);
  if (explicitWeekly) {
    return explicitWeekly.attends
      ? {
          status: "ATTENDING",
          enteredStartTime: explicitWeekly.startTime,
          enteredEndTime: explicitWeekly.endTime,
        }
      : { status: "NOT_ATTENDING", enteredStartTime: null, enteredEndTime: null };
  }

  const inherited = resolveOfficeDefaultForWeekday(officeDefaultVersions, weekday, memberCreatedAt);
  return inherited.isOpen
    ? { status: "ATTENDING", enteredStartTime: inherited.startTime, enteredEndTime: inherited.endTime }
    : { status: "NOT_ATTENDING", enteredStartTime: null, enteredEndTime: null };
}

/**
 * Intersects the entered interval with effective office hours. Out-of-hours
 * attendance is never mutated — `enteredStartTime`/`enteredEndTime` always
 * carry exactly what was saved; `publicStartTime`/`publicEndTime` are the
 * clamped view, null whenever there is nothing to publicly show (not
 * attending, office closed, or zero overlap with office hours).
 */
export function clampToOfficeHours(
  memberDay: MemberDayResult,
  office: Pick<OfficeEffectiveDay, "isOpen" | "startTime" | "endTime">,
): MemberEffectiveAttendanceResult {
  const base = {
    status: memberDay.status,
    enteredStartTime: memberDay.enteredStartTime,
    enteredEndTime: memberDay.enteredEndTime,
    officeIsOpen: office.isOpen,
  };

  const hasInterval =
    memberDay.status !== "NOT_ATTENDING" &&
    office.isOpen &&
    memberDay.enteredStartTime !== null &&
    memberDay.enteredEndTime !== null &&
    office.startTime !== null &&
    office.endTime !== null;

  if (!hasInterval) {
    return { ...base, publicStartTime: null, publicEndTime: null, isClamped: false };
  }

  const enteredStart = memberDay.enteredStartTime as string;
  const enteredEnd = memberDay.enteredEndTime as string;
  const officeStart = office.startTime as string;
  const officeEnd = office.endTime as string;

  const clampedStart = enteredStart > officeStart ? enteredStart : officeStart;
  const clampedEnd = enteredEnd < officeEnd ? enteredEnd : officeEnd;

  if (clampedStart >= clampedEnd) {
    // The entered interval does not overlap office hours at all.
    return { ...base, publicStartTime: null, publicEndTime: null, isClamped: true };
  }

  const isClamped = clampedStart !== enteredStart || clampedEnd !== enteredEnd;
  return { ...base, publicStartTime: clampedStart, publicEndTime: clampedEnd, isClamped };
}
